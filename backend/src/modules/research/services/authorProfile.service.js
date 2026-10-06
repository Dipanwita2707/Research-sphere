/**
 * Author profile service
 * ======================
 * Builds a researcher's profile from real records (employee details, research
 * contributions, expertise metrics) and enforces the author's privacy settings.
 *
 * Visibility levels (ResearchProfileIdentity.profileVisibility):
 *   public       anyone with the link, including people who are not signed in
 *   institution  signed-in members of the author's university (default)
 *   private      the author and university admins only
 *
 * Section toggles (showEmail, showPublications, ...) apply to every viewer
 * except the author and admins. Hidden sections are removed on the server, so
 * the data never reaches a viewer who is not allowed to see it.
 *
 * Incentives (amount, points, payout status per work and a summary) are money:
 * only the author and admins ever receive them, whatever the visibility settings.
 */
const prisma = require('../../../shared/config/database');
const { personNameKey, fullestName } = require('../../../shared/utils/personNameKey');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const path = require('path');
const { normalize } = require('../../../shared/utils/affiliationEngine');
const { resolveLocalFile } = require('../../uploads/fileAccess.service');

const VISIBILITY_LEVELS = ['public', 'institution', 'private'];
const SECTION_KEYS = ['showPhoto', 'showEmail', 'showPhone', 'showResearchInterests', 'showPublications', 'showCoAuthors', 'showMetrics'];
const PHOTO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const PUBLISHED_STATUSES = ['approved', 'completed'];
/**
 * Which works are on a profile (and so on the dashboard and the CV):
 *   - any work DRD approved (manual form or synced);
 *   - synced works straight away, whatever their incentive review stage, except ones DRD rejected
 *     (they may not be the researcher's at all). When the researcher has a Scopus author ID, only
 *     Scopus-indexed synced works count, so the profile reports what Scopus reports (the figures
 *     NAAC / NIRF use); without one, every synced work counts.
 * @param {boolean} scopusOnly
 */
function profileWorkFilter(scopusOnly) {
  return {
    OR: [
      { status: { in: PUBLISHED_STATUSES } },
      { sourceType: 'auto_import', status: { not: 'rejected' }, ...(scopusOnly ? { sourceSystems: { has: 'scopus' } } : {}) },
    ],
  };
}
/** Payout lines that count as money the author is owed or has received (cancelled lines do not). */
const PAYOUT_PAID = 'paid';
const PRIVILEGED_ROLES = new Set(['admin', 'superadmin']);
const MAX_INTERESTS = 15;
const MAX_INTEREST_LENGTH = 60;
const MAX_BIO_LENGTH = 2000;

const DEFAULT_SETTINGS = {
  bio: null,
  researchInterests: [],
  profileVisibility: 'institution',
  showEmail: false,
  showPhone: false,
  showResearchInterests: true,
  showPublications: true,
  showCoAuthors: true,
  showMetrics: true,
  showPhoto: true,
  allowSearchIndexing: false,
  publicHandle: null,
  cvDetails: {},
};

/**
 * Research CV sections the author fills in (the system has no other source for them).
 * Lists of short texts, or of small records; everything is trimmed and capped.
 */
const CV_LIST_LIMIT = 15;
const CV_TEXT = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const CV_RECORD_FIELDS = {
  education: ['degree', 'institution', 'year', 'thesis'],
  experience: ['role', 'organization', 'period', 'details'],
  references: ['name', 'designation', 'organization', 'email', 'phone'],
};
const CV_TEXT_LISTS = ['teaching', 'skills', 'memberships', 'awards', 'presentations'];

function cleanCvDetails(input) {
  if (input === null || input === undefined) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ProfileAccessError(400, 'VALIDATION_ERROR', 'cvDetails must be an object');
  }
  const out = {};
  const scholar = CV_TEXT(input.googleScholarUrl, 300);
  if (scholar) {
    let url;
    try { url = new URL(scholar); } catch { url = null; }
    if (!url || url.protocol !== 'https:' || !/(^|\.)scholar\.google\./i.test(url.hostname)) {
      throw new ProfileAccessError(400, 'VALIDATION_ERROR', 'Google Scholar link must be an https://scholar.google… address');
    }
    out.googleScholarUrl = url.toString();
  }
  for (const [key, fields] of Object.entries(CV_RECORD_FIELDS)) {
    if (input[key] === undefined) continue;
    if (!Array.isArray(input[key])) throw new ProfileAccessError(400, 'VALIDATION_ERROR', `${key} must be a list`);
    out[key] = input[key]
      .map((item) => Object.fromEntries(fields.map((f) => [f, CV_TEXT(item?.[f], f === 'details' || f === 'thesis' ? 400 : 200)])))
      .filter((item) => fields.some((f) => item[f]))
      .slice(0, CV_LIST_LIMIT);
  }
  for (const key of CV_TEXT_LISTS) {
    if (input[key] === undefined) continue;
    if (!Array.isArray(input[key])) throw new ProfileAccessError(400, 'VALIDATION_ERROR', `${key} must be a list`);
    out[key] = input[key].map((v) => CV_TEXT(v, 300)).filter(Boolean).slice(0, key === 'skills' ? 30 : CV_LIST_LIMIT);
  }
  return out;
}

class ProfileAccessError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const roleOf = (user) => (typeof user?.role === 'object' ? user.role?.name : user?.role) || null;
const isPrivileged = (user) => PRIVILEGED_ROLES.has(roleOf(user));

function displayNameOf(emp, fallback) {
  if (!emp) return fallback;
  return emp.displayName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || fallback;
}

function slugify(text) {
  return normalize(text || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'researcher';
}

function pickSettings(identity) {
  const out = { ...DEFAULT_SETTINGS };
  if (!identity) return out;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (identity[key] !== undefined && identity[key] !== null) out[key] = identity[key];
  }
  if (!VISIBILITY_LEVELS.includes(out.profileVisibility)) out.profileVisibility = 'institution';
  if (!out.cvDetails || typeof out.cvDetails !== 'object' || Array.isArray(out.cvDetails)) out.cvDetails = {};
  return out;
}

function hIndexOf(citationCounts) {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  while (h < sorted.length && sorted[h] >= h + 1) h += 1;
  return h;
}

/** Citations of a work: Scopus's own count when Scopus has the work, else the highest any source reported. */
function citationsOf(contribution) {
  const details = contribution.indexingDetails || {};
  const scopus = details.citationsBySource?.scopus;
  const n = Number(scopus ?? details.citationCount ?? details.citations ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function yearOf(contribution) {
  const d = contribution.publicationDate || contribution.submittedAt || contribution.createdAt;
  return d ? new Date(d).getFullYear() : null;
}

class AuthorProfileService {
  /** Load the author (scoped to the current tenant) or throw 404. */
  async _loadAuthor(userId) {
    const author = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uid: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        status: true,
        universityId: true,
        anonymizedAt: true,
        university: { select: { name: true, slug: true } },
        employeeDetails: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            designation: true,
            email: true,
            phoneNumber: true,
            primaryDepartment: { select: { departmentName: true } },
            primarySchool: { select: { facultyName: true } },
            primaryCentralDept: { select: { departmentName: true } },
          },
        },
        researchProfileIdentity: true,
      },
    });
    if (!author || author.anonymizedAt) {
      throw new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }
    return author;
  }

  /**
   * Who may see what. Returns { allowed, full } where `full` means the viewer
   * bypasses section toggles (the author themself or an admin).
   */
  resolveAccess(viewer, author, settings) {
    const isOwner = Boolean(viewer && viewer.id === author.id);
    const privileged = Boolean(viewer && isPrivileged(viewer));
    if (isOwner || privileged) return { allowed: true, full: true, isOwner, privileged };

    const level = settings.profileVisibility;
    if (level === 'public') return { allowed: true, full: false, isOwner, privileged };
    if (level === 'institution') {
      const sameUniversity = Boolean(viewer && viewer.universityId && viewer.universityId === author.universityId);
      return { allowed: sameUniversity, full: false, isOwner, privileged, reason: viewer ? 'institution' : 'login_required' };
    }
    return { allowed: false, full: false, isOwner, privileged, reason: 'private' };
  }

  /**
   * Approved works the person wrote or filed. Besides the account links (applicant, author.userId)
   * an internal author typed into the manual form by UID or email counts too, so a paper whose
   * author row never got linked to the account still reaches that person's profile.
   */
  async _publications(author) {
    const userId = author.id;
    const email = author.email || author.employeeDetails?.email || null;
    const byIdentity = [
      ...(author.uid ? [{ authors: { some: { userId: null, uid: { equals: author.uid, mode: 'insensitive' } } } }] : []),
      ...(email ? [{ authors: { some: { userId: null, email: { equals: email, mode: 'insensitive' } } } }] : []),
    ];
    return prisma.researchContribution.findMany({
      where: {
        publicationType: { not: 'grant_proposal' }, // proposals are not publications
        AND: [
          profileWorkFilter(Boolean(author.researchProfileIdentity?.scopusAuthorId)),
          { OR: [{ applicantUserId: userId }, { authors: { some: { userId } } }, ...byIdentity] },
        ],
      },
      select: {
        id: true,
        title: true,
        publicationType: true,
        journalName: true,
        conferenceName: true,
        bookTitle: true,
        publisherName: true,
        doi: true,
        issn: true,
        isbn: true,
        issue: true,
        pageNumbers: true,
        abstract: true,
        keywords: true,
        status: true,
        sourceType: true,
        sourceSystems: true,
        publicationDate: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
        indexingDetails: true,
        authors: {
          select: { userId: true, uid: true, email: true, name: true, affiliation: true, authorOrder: true, isCorresponding: true, isInternal: true, incentiveShare: true, pointsShare: true },
          orderBy: { authorOrder: 'asc' },
        },
      },
      orderBy: [{ publicationDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  _buildMetrics(contributions, expertise, { scopusOnly = false } = {}) {
    const counts = contributions.map(citationsOf);
    const total = counts.reduce((s, n) => s + n, 0);
    const byYear = new Map();
    contributions.forEach((c, i) => {
      const y = yearOf(c);
      if (y) byYear.set(y, (byYear.get(y) || 0) + counts[i]);
    });
    const computedH = hIndexOf(counts);
    return {
      // Prefer the Research Intelligence figures when they have been computed; they include synced citation data.
      // Scopus-reported profiles use only the Scopus figures; otherwise prefer the Research
      // Intelligence figures when they are higher (they include synced citation data).
      totalCitations: scopusOnly ? total : Math.max(total, expertise?.totalCitations || 0),
      hIndex: scopusOnly ? computedH : Math.max(computedH, expertise?.hIndex || 0),
      i10Index: counts.filter((n) => n >= 10).length,
      avgCitationsPerPaper: counts.length ? Number((total / counts.length).toFixed(2)) : 0,
      citationsPerYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
    };
  }

  _buildCoAuthors(userId, authorName, contributions) {
    const map = new Map();
    const self = normalize(authorName);
    for (const c of contributions) {
      const year = yearOf(c);
      for (const a of c.authors || []) {
        if (a.userId === userId || normalize(a.name) === self) continue;
        // One entry per person across name forms ("Vishu Madaan" / "Madaan, V.").
        const key = a.userId || personNameKey(a.name) || normalize(a.name);
        if (!key) continue;
        const known = map.get(key);
        if (known) {
          if (known.sharedPublications.includes(c.id)) continue;
          if (!known.profileUserId) known.name = fullestName([known.name, a.name]);
          if (!known.affiliation && a.affiliation) known.affiliation = a.affiliation;
          if (a.isInternal) known.isInternal = true;
        }
        const entry = known || {
          id: key,
          name: a.name,
          affiliation: a.affiliation || null,
          collaborationCount: 0,
          firstCollaboration: year,
          lastCollaboration: year,
          sharedPublications: [],
          profileUserId: a.userId || null,
          isInternal: Boolean(a.isInternal),
        };
        entry.collaborationCount += 1;
        entry.sharedPublications.push(c.id);
        if (year) {
          entry.firstCollaboration = Math.min(entry.firstCollaboration ?? year, year);
          entry.lastCollaboration = Math.max(entry.lastCollaboration ?? year, year);
        }
        map.set(key, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.collaborationCount - a.collaborationCount);
  }

  _derivedInterests(contributions) {
    const counts = new Map();
    for (const c of contributions) {
      for (const raw of String(c.keywords || '').split(/[,;]/)) {
        const k = raw.trim();
        if (k.length < 3 || k.length > MAX_INTEREST_LENGTH) continue;
        const key = k.toLowerCase();
        const prev = counts.get(key) || { label: k, n: 0 };
        prev.n += 1;
        counts.set(key, prev);
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((x) => x.label);
  }

  /**
   * What this person earned from each work: their payout line when finance has one (amount, status,
   * paid date), else the share DRD recorded on approval. Returns a Map(contributionId → incentive)
   * and a summary. Only called for the author and admins.
   */
  async _incentives(author, contributions) {
    const ids = contributions.map((c) => c.id);
    const lines = ids.length
      ? await prisma.incentivePayout
        .findMany({
          where: { payeeUserId: author.id, researchContributionId: { in: ids }, NOT: { status: 'cancelled' } },
          select: { researchContributionId: true, approvedAmount: true, points: true, status: true, paidAt: true },
        })
        .catch(() => [])
      : [];
    const lineOf = new Map(lines.map((l) => [l.researchContributionId, l]));
    const email = (author.email || author.employeeDetails?.email || '').toLowerCase();
    const mine = (a) => a.userId === author.id
      || (!a.userId && ((a.uid && a.uid.toLowerCase() === String(author.uid).toLowerCase()) || (email && a.email && a.email.toLowerCase() === email)));

    const byWork = new Map();
    const summary = { total: 0, paid: 0, inProcess: 0, points: 0, works: 0 };
    for (const c of contributions) {
      const line = lineOf.get(c.id);
      const share = (c.authors || []).find(mine);
      const amount = line ? Number(line.approvedAmount) || 0 : Number(share?.incentiveShare) || 0;
      const points = line ? Number(line.points) || 0 : Number(share?.pointsShare) || 0;
      const status = line ? line.status : null; // null: recorded at approval, not yet in the payout ledger
      byWork.set(c.id, { amount, points, status, paidAt: line?.paidAt || null });
      if (amount > 0 || points > 0) summary.works += 1;
      summary.total += amount;
      summary.points += points;
      if (status === PAYOUT_PAID) summary.paid += amount; else summary.inProcess += amount;
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    return { byWork, summary: { ...summary, total: r2(summary.total), paid: r2(summary.paid), inProcess: r2(summary.inProcess) } };
  }

  _mapPublication(c, userId, incentive = undefined) {
    return {
      id: c.id,
      profileId: userId,
      researchContributionId: c.id,
      title: c.title,
      authors: (c.authors || []).map((a, idx) => ({
        name: a.name,
        affiliation: a.affiliation || null,
        email: null,
        isCorresponding: Boolean(a.isCorresponding),
        authorOrder: a.authorOrder ?? idx,
      })),
      venue: c.journalName || c.conferenceName || c.bookTitle || c.publisherName || '',
      publicationType: c.publicationType,
      year: yearOf(c),
      volume: null,
      issue: c.issue || null,
      pages: c.pageNumbers || null,
      doi: c.doi || null,
      isbn: c.isbn || null,
      issn: c.issn || null,
      arxivId: null,
      pubmedId: null,
      citationCount: citationsOf(c),
      citationsPerYear: {},
      externalId: null,
      pdfUrl: null,
      publicationUrl: c.doi ? `https://doi.org/${c.doi}` : null,
      abstract: c.abstract || null,
      keywords: String(c.keywords || '').split(/[,;]/).map((k) => k.trim()).filter(Boolean),
      // Verified = approved by DRD. Synced works show before that, marked as not yet verified.
      isVerified: PUBLISHED_STATUSES.includes(c.status),
      source: c.sourceType === 'auto_import' ? 'synced' : 'manual',
      sourceSystems: c.sourceType === 'auto_import' ? (c.sourceSystems || []) : [],
      ...(incentive ? { incentive } : {}),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  async _build(author, access, settings, photoUrlFor = (a) => `/uploads/profiles/${a.profileImage}`) {
    const [contributions, expertise] = await Promise.all([
      this._publications(author),
      prisma.ripResearcherExpertiseProfile
        .findUnique({ where: { userId: author.id }, select: { totalCitations: true, hIndex: true } })
        .catch(() => null),
    ]);

    const emp = author.employeeDetails;
    const name = displayNameOf(emp, author.uid);
    const declared = (settings.researchInterests || []).filter(Boolean);
    const interests = declared.length ? declared : this._derivedInterests(contributions);
    const full = access.full;
    const show = (key) => full || settings[key];

    // Money is for the author and admins only, whatever the visibility settings say.
    const incentives = full ? await this._incentives(author, contributions) : null;
    const publications = contributions.map((c) => this._mapPublication(c, author.id, incentives?.byWork.get(c.id)));
    const scopusOnly = Boolean(author.researchProfileIdentity?.scopusAuthorId);
    const metrics = this._buildMetrics(contributions, expertise, { scopusOnly });
    const allCoAuthors = this._buildCoAuthors(author.id, name, contributions);
    const coAuthors = allCoAuthors.slice(0, 100); // the list is capped; the count is not

    const sections = {
      photo: show('showPhoto') && Boolean(author.profileImage),
      email: show('showEmail'),
      phone: show('showPhone'),
      researchInterests: show('showResearchInterests'),
      publications: show('showPublications'),
      coAuthors: show('showCoAuthors'),
      metrics: show('showMetrics'),
    };

    const citationCounts = publications.map((p) => p.citationCount);
    return {
      user: {
        id: author.id,
        uid: author.uid,
        name,
        email: sections.email ? emp?.email || author.email || null : null,
        phone: sections.phone ? emp?.phoneNumber || author.phone || null : null,
        photo: sections.photo ? photoUrlFor(author) : null,
        designation: emp?.designation || null,
        department: emp?.primaryDepartment?.departmentName || emp?.primaryCentralDept?.departmentName || null,
        school: emp?.primarySchool?.facultyName || null,
        university: author.university?.name || null,
      },
      profile: {
        id: author.researchProfileIdentity?.id || author.id,
        userId: author.id,
        bio: settings.bio || null,
        researchInterests: sections.researchInterests ? interests : [],
        researchInterestsSource: declared.length ? 'author' : 'derived',
        orcid: author.researchProfileIdentity?.orcid || null,
        scopusAuthorId: author.researchProfileIdentity?.scopusAuthorId || null,
        webOfScienceId: author.researchProfileIdentity?.webOfScienceId || null,
        googleScholarId: null,
        personalWebsite: null,
        lastSyncedAt: author.researchProfileIdentity?.lastSyncedAt || null,
        metrics: sections.metrics
          ? metrics
          : { totalCitations: 0, hIndex: 0, i10Index: 0, avgCitationsPerPaper: 0, citationsPerYear: [] },
      },
      publications: sections.publications ? publications : [],
      publicationCount: sections.publications ? publications.length : null,
      incentiveSummary: incentives ? incentives.summary : null,
      coAuthors: sections.coAuthors ? coAuthors : [],
      coAuthorCount: sections.coAuthors ? allCoAuthors.length : null,
      impactMetrics: sections.metrics
        ? {
            avgCitationsPerPaper: metrics.avgCitationsPerPaper,
            medianCitations: citationCounts.length ? [...citationCounts].sort((a, b) => a - b)[Math.floor(citationCounts.length / 2)] : 0,
            highlyCitedPapers: citationCounts.filter((n) => n >= 10).length,
            citationDistribution: [
              { range: '0-5', count: citationCounts.filter((n) => n <= 5).length },
              { range: '6-10', count: citationCounts.filter((n) => n > 5 && n <= 10).length },
              { range: '11-20', count: citationCounts.filter((n) => n > 10 && n <= 20).length },
              { range: '21+', count: citationCounts.filter((n) => n > 20).length },
            ],
          }
        : null,
      sections,
      cvDetails: (() => {
        const { references = [], ...rest } = settings.cvDetails || {};
        return full ? { ...rest, references } : { ...rest, references: [], hasReferences: references.length > 0 };
      })(),
      access: { isOwner: access.isOwner, canEdit: access.isOwner || access.privileged, canViewPrivate: access.full },
      // Only the author/admins see the raw settings and public link.
      settings: full ? { ...settings, publicPath: this._publicPath(author, settings) } : undefined,
      visibility: settings.profileVisibility,
      allowSearchIndexing: settings.allowSearchIndexing,
    };
  }

  _publicPath(author, settings) {
    if (settings.profileVisibility !== 'public' || !settings.publicHandle || !author.university?.slug) return null;
    return `/p/${author.university.slug}/${settings.publicHandle}`;
  }

  /** Authenticated view: tenant scoping comes from `protect`. */
  async getProfileForViewer(userId, viewer) {
    const author = await this._loadAuthor(userId);
    const settings = pickSettings(author.researchProfileIdentity);
    const access = this.resolveAccess(viewer, author, settings);
    if (!access.allowed) {
      throw new ProfileAccessError(
        403,
        access.reason === 'private' ? 'PROFILE_PRIVATE' : 'PROFILE_INSTITUTION_ONLY',
        access.reason === 'private' ? 'This profile is private' : 'This profile is visible to members of the author’s university only',
      );
    }
    return this._build(author, access, settings);
  }

  /** Unauthenticated view via /p/<university-slug>/<handle>. Anything but a public profile is a 404. */
  async getPublicProfile(universitySlug, handle) {
    const university = await tenantContext.runAsSystem(() =>
      prisma.university.findUnique({ where: { slug: universitySlug }, select: { id: true, isActive: true } }),
    );
    if (!university || !university.isActive) throw new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

    return tenantContext.runForTenant(university.id, async () => {
      const identity = await prisma.researchProfileIdentity.findFirst({
        where: { publicHandle: handle, profileVisibility: 'public' },
        select: { userId: true },
      });
      if (!identity) throw new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      const author = await this._loadAuthor(identity.userId);
      if (author.status && author.status !== 'active') throw new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      const settings = pickSettings(author.researchProfileIdentity);
      const profile = await this._build(
        author,
        { allowed: true, full: false, isOwner: false, privileged: false },
        settings,
        () => `/api/v1/public/profiles/${universitySlug}/${handle}/photo`,
      );
      profile.publicPath = this._publicPath(author, settings);
      return profile;
    });
  }

  /**
   * Absolute path of a public profile's photo, or a 404. Served only while the profile
   * is public and the author keeps "Photo" switched on.
   */
  async getPublicPhotoPath(universitySlug, handle) {
    const notFound = () => new ProfileAccessError(404, 'PROFILE_NOT_FOUND', 'Photo not found');
    const university = await tenantContext.runAsSystem(() =>
      prisma.university.findUnique({ where: { slug: universitySlug }, select: { id: true, isActive: true } }),
    );
    if (!university || !university.isActive) throw notFound();
    const file = await tenantContext.runForTenant(university.id, async () => {
      const identity = await prisma.researchProfileIdentity.findFirst({
        where: { publicHandle: handle, profileVisibility: 'public', showPhoto: true },
        select: { user: { select: { profileImage: true, anonymizedAt: true, status: true } } },
      });
      const user = identity?.user;
      if (!user || user.anonymizedAt || (user.status && user.status !== 'active')) return null;
      return user.profileImage;
    });
    if (!file || !PHOTO_EXTENSIONS.has(path.extname(file).toLowerCase()) || file !== path.basename(file)) throw notFound();
    const fullPath = resolveLocalFile(['profiles', file]);
    if (!fullPath) throw notFound();
    return fullPath;
  }

  _assertCanEdit(userId, actor) {
    if (!actor || (actor.id !== userId && !isPrivileged(actor))) {
      throw new ProfileAccessError(403, 'FORBIDDEN', 'You can only change your own profile settings');
    }
  }

  async getSettings(userId, actor) {
    this._assertCanEdit(userId, actor);
    const author = await this._loadAuthor(userId);
    const settings = pickSettings(author.researchProfileIdentity);
    return { ...settings, publicPath: this._publicPath(author, settings) };
  }

  _validate(input) {
    const data = {};
    if (input.profileVisibility !== undefined) {
      if (!VISIBILITY_LEVELS.includes(input.profileVisibility)) {
        throw new ProfileAccessError(400, 'VALIDATION_ERROR', `profileVisibility must be one of ${VISIBILITY_LEVELS.join(', ')}`);
      }
      data.profileVisibility = input.profileVisibility;
    }
    for (const key of [...SECTION_KEYS, 'allowSearchIndexing']) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'boolean') throw new ProfileAccessError(400, 'VALIDATION_ERROR', `${key} must be true or false`);
        data[key] = input[key];
      }
    }
    if (input.bio !== undefined) {
      const bio = input.bio === null ? '' : String(input.bio).trim();
      if (bio.length > MAX_BIO_LENGTH) throw new ProfileAccessError(400, 'VALIDATION_ERROR', `Bio must be ${MAX_BIO_LENGTH} characters or fewer`);
      data.bio = bio || null;
    }
    if (input.cvDetails !== undefined) {
      data.cvDetails = cleanCvDetails(input.cvDetails);
    }
    if (input.researchInterests !== undefined) {
      if (!Array.isArray(input.researchInterests)) throw new ProfileAccessError(400, 'VALIDATION_ERROR', 'researchInterests must be a list');
      const seen = new Set();
      data.researchInterests = input.researchInterests
        .map((s) => String(s || '').trim())
        .filter((s) => s && s.length <= MAX_INTEREST_LENGTH && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
        .slice(0, MAX_INTERESTS);
    }
    return data;
  }

  async _uniqueHandle(author) {
    const base = slugify(displayNameOf(author.employeeDetails, author.uid));
    for (let i = 0; i < 20; i += 1) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const taken = await prisma.researchProfileIdentity.findFirst({
        where: { publicHandle: candidate, NOT: { userId: author.id } },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${base}-${author.id.slice(0, 8)}`;
  }

  async updateSettings(userId, input, actor) {
    this._assertCanEdit(userId, actor);
    const data = this._validate(input || {});
    const author = await this._loadAuthor(userId);

    const current = pickSettings(author.researchProfileIdentity);
    const nextVisibility = data.profileVisibility || current.profileVisibility;
    // A stable handle is minted the first time the profile goes public and kept afterwards,
    // so links shared earlier start working again if the author re-publishes.
    if (nextVisibility === 'public' && !current.publicHandle) {
      data.publicHandle = await this._uniqueHandle(author);
    }

    const saved = await prisma.researchProfileIdentity.upsert({
      where: { userId },
      create: { userId, universityId: author.universityId, ...data },
      update: data,
    });
    const settings = pickSettings(saved);
    return { ...settings, publicPath: this._publicPath(author, settings) };
  }
}

module.exports = new AuthorProfileService();
module.exports.ProfileAccessError = ProfileAccessError;
module.exports.VISIBILITY_LEVELS = VISIBILITY_LEVELS;
