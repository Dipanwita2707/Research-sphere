const { keysFor, findActiveClaims, normalizeDoi } = require('./duplicateClaim.service');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { isAffiliationMatch } = require('../../../shared/utils/affiliationEngine');
const affiliationService = require('../../core/services/affiliation.service');
const tenantContext = require('../../../shared/tenancy/tenantContext');

const log = createModuleLogger('research-publication-sync');

const DEFAULT_ORCID_BASE_URL = process.env.ORCID_API_BASE_URL || 'https://pub.orcid.org/v3.0';
const DEFAULT_SCOPUS_BASE_URL = process.env.SCOPUS_API_BASE_URL || 'https://api.elsevier.com/content';
const DEFAULT_OPENALEX_BASE_URL = process.env.OPENALEX_API_BASE_URL || 'https://api.openalex.org';
/**
 * Records sources list that are not research works: front / back matter of a book or issue,
 * retraction and correction notices, and machine-translated copies of existing papers (JST).
 * "Preface", "Foreword" and "Editorial" are kept: editors write real ones.
 */
const NON_RESEARCH_TITLES = new Set([
  'front matter', 'back matter', 'frontmatter', 'backmatter', 'index', 'author index', 'subject index',
  'also of interest', 'table of contents', 'contents', 'cover', 'cover image', 'title page', 'half title page',
  'copyright page', 'copyright', 'list of contributors', 'contributors', 'about the editors', 'about the authors',
  'about the author', 'about the editor', 'editorial board', 'masthead', 'bibliography', 'references', 'erratum',
  'corrigendum', 'errata', 'dedication', 'acknowledgements', 'acknowledgments', 'list of figures', 'list of tables',
]);
const NON_RESEARCH_PATTERNS = [
  // "Retracted: X", "Retraction Notice: X", "RETRACTED ARTICLE: X" (a separator is required:
  // "Retraction behaviour in social networks" is a paper)
  /^(retracted(\s+article)?|retraction(\s+notice)?|withdrawn(\s+article)?|expression of concern)\s*[:\-–]/i,
  /^notice of retraction\b/i,
  /^(correction|erratum|corrigendum|addendum)\s+(to|for)\b/i,
  /【\s*JST|京大機械翻訳|機械翻訳】/,
];

/** A re-published copy (reprint, encyclopedia volume) within this many years is the same work. */
const REPUBLISHED_YEAR_WINDOW = 3;
/** Front-matter titles shared by unrelated works; never used to merge two records. */
const GENERIC_WORK_TITLES = new Set([
  'preface', 'foreword', 'editorial', 'introduction', 'conclusion', 'conclusions', 'front matter', 'back matter',
  'index', 'table of contents', 'contents', 'acknowledgements', 'acknowledgments', 'erratum', 'corrigendum',
  'guest editorial', 'about the editors', 'about the authors', 'list of contributors', 'bibliography', 'references',
]);

const numberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

/** Per-request timeout for external registries (ms). */
const httpTimeoutMs = () => numberEnv('PUBLICATION_SYNC_HTTP_TIMEOUT_MS', 20000);
/** Retries after the first attempt for timeouts, network errors, 429 and 5xx. */
const httpRetries = () => numberEnv('PUBLICATION_SYNC_HTTP_RETRIES', 2);
/** Hours until the next attempt when a source failed during a sync. */
const retryHours = () => numberEnv('PUBLICATION_SYNC_RETRY_HOURS', 6);
/** Parallel per-paper lookups (Scopus abstract / OpenAlex by DOI / ORCID work detail). */
const lookupConcurrency = () => Math.max(1, numberEnv('PUBLICATION_SYNC_LOOKUP_CONCURRENCY', 4));

const MAX_RETRY_AFTER_MS = 60000;

// Process-wide knowledge about the Scopus key's entitlements (the same key is used
// for every tenant), plus a small cache of per-paper author lists.
const scopusState = { completeViewDenied: false, abstractDenied: false };
const scopusAuthorCache = new Map();
const SCOPUS_AUTHOR_CACHE_MAX = 5000;

const cacheScopusAuthors = (scopusId, authors) => {
  if (!scopusId) return;
  if (scopusAuthorCache.size >= SCOPUS_AUTHOR_CACHE_MAX) {
    scopusAuthorCache.delete(scopusAuthorCache.keys().next().value);
  }
  scopusAuthorCache.set(scopusId, authors);
};

const toArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const DATE_PRECISION_RANK = { year: 1, month: 2, day: 3 };

// Missing values that are enrichment gaps (no source supplies them), not reasons to hold
// an imported work for special review.
const ENRICHMENT_ONLY_FIELDS = new Set(['quartile', 'sjr']);

// Nature / Science / The Lancet / Cell / NEJM as whole journal titles (incentive category
// "nature_science_lancet_cell_nejm"). Sister journals are classified by their own indexing.
const FLAGSHIP_JOURNAL_RE = /^(the\s+)?(nature|science|lancet|cell|nejm|new\s+england\s+journal\s+of\s+medicine)\.?$/i;

const NAME_TITLES = new Set([
  'dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'er', 'smt', 'sir', 'phd', 'md', 'jr', 'sr', 'ii', 'iii',
]);

class PublicationSyncService {
  constructor(prisma, contributionService) {
    this.prisma = prisma;
    this.contributionService = contributionService;
    // Per-sync-run affiliation context, populated by _loadAffiliationContext().
    this._affiliationVariants = [];
    this._ownerAffiliationVariants = [];
    this._affiliationOptions = {};
    this._scopusAffiliationIds = new Set();
    this._canonicalUniversityName = 'University';
    this._universityCode = null;
    this._homeCountry = 'india';
  }

  /** Overridable in tests. */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * fetch() with a timeout and bounded retries. Retries network errors, timeouts,
   * 429 and 5xx (honouring Retry-After); returns any other response to the caller.
   * Throws when every attempt failed.
   */
  async _fetchWithRetry(url, init = {}, { source = 'external', timeoutMs = httpTimeoutMs(), retries = httpRetries() } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      let response;
      try {
        response = await fetch(url, { ...init, ...(controller ? { signal: controller.signal } : {}) });
      } catch (error) {
        lastError = error?.name === 'AbortError'
          ? new Error(`${source} request timed out after ${timeoutMs}ms`)
          : new Error(`${source} request failed: ${error.message}`);
      } finally {
        if (timer) clearTimeout(timer);
      }

      if (response) {
        const status = response.status;
        const retryable = status === 429 || (status >= 500 && status <= 599);
        if (!retryable || attempt === retries) return response;
        lastError = new Error(`${source} responded ${status}`);
        const retryAfter = this._retryAfterMs(response);
        if (retryAfter !== null) {
          await this._sleep(Math.min(retryAfter, MAX_RETRY_AFTER_MS));
          continue;
        }
      }

      if (attempt < retries) {
        await this._sleep(Math.min(1000 * 2 ** attempt + Math.floor(Math.random() * 250), MAX_RETRY_AFTER_MS));
      }
    }
    throw lastError || new Error(`${source} request failed`);
  }

  _retryAfterMs(response) {
    const header = response?.headers?.get ? response.headers.get('retry-after') : null;
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const at = Date.parse(header);
    return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
  }

  /** Run fn over items with at most `limit` in flight; results keep input order. */
  async _mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  /**
   * Load the tenant's affiliation matcher context (name variants, city/state,
   * Scopus affiliation ids) plus the user's own aliases for the duration of a
   * sync/import run. Must be called before any code path that relies on
   * this._isSgtAffiliation() / this._canonicalUniversityName.
   */
  async _loadAffiliationContext(user, identity = null) {
    const context = await affiliationService.getUniversityAffiliationVariants(user?.universityId);
    const { canonicalName, variants = [], locations = [], country = null, scopusAffiliationIds = [] } = context || {};
    this._affiliationVariants = variants;
    this._affiliationOptions = { locations, country: country || 'India' };
    this._homeCountry = String(country || 'India').toLowerCase();
    this._scopusAffiliationIds = new Set((scopusAffiliationIds || []).map(String));
    this._canonicalUniversityName = canonicalName || 'University';
    this._universityCode = user?.university?.code || context?.code || null;

    // The user's Settings override and research-identity aliases count for the
    // user's own author entry only (never for classifying co-authors).
    let affiliationOverride = null;
    try {
      const settings = this.prisma.userSettings?.findUnique
        ? await this.prisma.userSettings.findUnique({ where: { userId: user.id }, select: { affiliationOverride: true } })
        : null;
      affiliationOverride = settings?.affiliationOverride || null;
    } catch (error) {
      log.warn('Could not load affiliation override', { userId: user?.id, error: error.message });
    }
    const personal = typeof affiliationService.personalAffiliationAliases === 'function'
      ? affiliationService.personalAffiliationAliases({
        affiliationOverride,
        identityAliases: (identity || user?.researchProfileIdentity)?.affiliationAliases,
        locations,
      })
      : [];
    this._ownerAffiliationVariants = personal.length > 0 ? [...variants, ...personal] : variants;


  }

  /**
   * Run fn(runner) for one user inside that user's university, on a per-run copy of
   * this service.
   *
   * - Inside a tenant context (request or job) the run stays in that tenant; a
   *   different explicit universityId is refused (the user is "not found").
   * - Outside any tenant (legacy scheduler, superadmin global view) the user's own
   *   university is looked up and the run is wrapped in runForTenant, so reads are
   *   filtered and created contributions/imports are stamped with universityId.
   * - The sync keeps per-run caches and the affiliation context on `this`; the copy
   *   (Object.create) keeps concurrent runs for different tenants from sharing them.
   */
  async _runForUser(userId, universityId, fn) {
    const runner = Object.create(this);
    const current = tenantContext.getTenantId();
    if (current) {
      if (universityId && universityId !== current) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      return fn(runner);
    }
    let tenantId = universityId || null;
    if (!tenantId) {
      const owner = await tenantContext.runAsSystem(() =>
        this.prisma.userLogin.findUnique({ where: { id: userId }, select: { universityId: true } })
      );
      tenantId = owner?.universityId || null;
    }
    return tenantId ? tenantContext.runForTenant(tenantId, () => fn(runner)) : fn(runner);
  }

  async getProfileIdentity(userId) {
    const identity = await this.prisma.researchProfileIdentity.findUnique({
      where: { userId },
      include: {
        importRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (identity) {
      return identity;
    }

    return {
      id: null,
      userId,
      orcid: null,
      scopusAuthorId: null,
      webOfScienceId: null,
      affiliationAliases: [],
      autoSyncEnabled: true,
      filterSgtOnly: false,
      syncFrequencyDays: 1,
      syncStatus: 'never_synced',
      syncError: null,
      lastSyncedAt: null,
      nextSyncAt: null,
      identityVerification: null,
      importRuns: [],
    };
  }

  /**
   * Create/update a user's research profile identity.
   * @param {string} userId
   * @param {object} payload
   * @param {{ universityId?: string }} [options] - tenant to run in when called outside a request
   */
  async upsertProfileIdentity(userId, payload = {}, { universityId } = {}) {
    return this._runForUser(userId, universityId, (runner) => runner._upsertProfileIdentity(userId, payload));
  }

  async _upsertProfileIdentity(userId, payload = {}) {
    const data = {
      orcid: payload.orcid !== undefined ? this._normalizeOrcid(payload.orcid) : undefined,
      scopusAuthorId: payload.scopusAuthorId !== undefined ? this._normalizeScopusAuthorId(payload.scopusAuthorId) : undefined,
      webOfScienceId: payload.webOfScienceId !== undefined ? this._cleanString(payload.webOfScienceId, 64) : undefined,
      affiliationAliases: Array.isArray(payload.affiliationAliases)
        ? payload.affiliationAliases.map((item) => this._cleanString(item, 256)).filter(Boolean)
        : undefined,
      autoSyncEnabled: payload.autoSyncEnabled !== undefined ? Boolean(payload.autoSyncEnabled) : undefined,
      filterSgtOnly: payload.filterSgtOnly !== undefined ? Boolean(payload.filterSgtOnly) : undefined,
      syncFrequencyDays:
        payload.syncFrequencyDays !== undefined
          ? Math.max(1, Number(payload.syncFrequencyDays) || 1)
          : undefined,
      syncStatus: payload.syncStatus ? this._cleanString(payload.syncStatus, 32) : undefined,
      syncError: payload.syncError === null ? null : this._cleanString(payload.syncError, 1000),
      lastSyncedAt: payload.lastSyncedAt ? new Date(payload.lastSyncedAt) : undefined,
    };

    if (payload.orcid && !data.orcid) {
      const error = new Error('Invalid ORCID format');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: { select: { displayName: true } },
        studentLogin: { select: { displayName: true } },
        researchProfileIdentity: true,
      },
    });

    // The lookup is tenant-scoped: never create an identity for a user of another university
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const current = user.researchProfileIdentity || null;
    const userDisplayName = user?.employeeDetails?.displayName || user?.studentLogin?.displayName || null;

    // Verify ids that are new or changed. A registry that cannot be reached does not
    // block the save: the id is stored and marked unverified. A clear name mismatch or
    // an id the registry does not know is rejected.
    const verification = { ...this._asObject(current?.identityVerification) };
    let verificationChanged = false;
    if (data.orcid !== undefined && data.orcid !== (current?.orcid || null)) {
      verificationChanged = true;
      if (data.orcid) verification.orcid = await this._verifyOrcid(data.orcid, userDisplayName);
      else delete verification.orcid;
    }
    if (data.scopusAuthorId !== undefined && data.scopusAuthorId !== (current?.scopusAuthorId || null)) {
      verificationChanged = true;
      if (data.scopusAuthorId) verification.scopus = await this._verifyScopusAuthor(data.scopusAuthorId, userDisplayName);
      else delete verification.scopus;
    }
    if (verificationChanged) {
      data.identityVerification = verification;
      // The OpenAlex author was resolved from the old ids.
      data.openAlexAuthorId = null;
    }

    if (data.syncFrequencyDays !== undefined && current?.lastSyncedAt) {
      data.nextSyncAt = new Date(new Date(current.lastSyncedAt).getTime() + data.syncFrequencyDays * 86400000);
    }

    return this.prisma.researchProfileIdentity.upsert({
      where: { userId },
      update: this._stripUndefined(data),
      create: {
        user: { connect: { id: userId } },
        ...this._stripUndefined(data),
      },
    });
  }

  _orcidHeaders() {
    return {
      Accept: 'application/json',
      ...(process.env.ORCID_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.ORCID_ACCESS_TOKEN}` } : {}),
    };
  }

  _scopusHeaders() {
    return { 'X-ELS-APIKey': process.env.SCOPUS_API_KEY, Accept: 'application/json' };
  }

  _verificationResult(status, extra = {}) {
    return { status, checkedAt: new Date().toISOString(), ...extra };
  }

  _rejectIdentity(message) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }

  _anyNameMatches(names, personName) {
    return names.some((name) => this._personNameMatches(name, personName) || this._isSamePersonName(name, personName));
  }

  /** Check an ORCID iD against the ORCID public registry. */
  async _verifyOrcid(orcid, userDisplayName) {
    let response;
    try {
      response = await this._fetchWithRetry(`${DEFAULT_ORCID_BASE_URL}/${encodeURIComponent(orcid)}/person`, {
        headers: this._orcidHeaders(),
      }, { source: 'ORCID', retries: 1 });
    } catch (error) {
      log.warn('ORCID verification lookup failed; saving as unverified', { orcid, error: error.message });
      return this._verificationResult('unverified', { reason: `ORCID registry unreachable: ${error.message}` });
    }
    if (response.status === 404) {
      this._rejectIdentity(`ORCID iD ${orcid} does not exist in the ORCID registry.`);
    }
    if (!response.ok) {
      return this._verificationResult('unverified', { reason: `ORCID registry responded ${response.status}` });
    }
    let person;
    try {
      person = await response.json();
    } catch {
      return this._verificationResult('unverified', { reason: 'ORCID registry returned an unreadable response' });
    }
    const nameBlock = person?.name || {};
    const fullName = [nameBlock?.['given-names']?.value, nameBlock?.['family-name']?.value].filter(Boolean).join(' ');
    const names = [
      nameBlock?.['credit-name']?.value,
      fullName,
      ...toArray(person?.['other-names']?.['other-name']).map((item) => item?.content),
    ].filter(Boolean);
    const registeredName = nameBlock?.['credit-name']?.value || fullName || null;

    if (names.length === 0) {
      return this._verificationResult('unverified', { reason: 'The ORCID record does not make its name public' });
    }
    if (!userDisplayName) {
      return this._verificationResult('unverified', { name: registeredName, reason: 'No employee name to compare with' });
    }
    if (!this._anyNameMatches(names, userDisplayName)) {
      this._rejectIdentity(`ORCID verification failed. The ID belongs to "${registeredName}", which does not match your name "${userDisplayName}".`);
    }
    return this._verificationResult('verified', { name: registeredName, via: 'orcid' });
  }

  /** Check a Scopus author id via the Scopus Author API, falling back to OpenAlex. */
  async _verifyScopusAuthor(scopusAuthorId, userDisplayName) {
    let names = null;
    let via = null;
    let reason = null;

    if (process.env.SCOPUS_API_KEY) {
      try {
        const response = await this._fetchWithRetry(
          `${DEFAULT_SCOPUS_BASE_URL}/author/author_id/${encodeURIComponent(scopusAuthorId)}?view=LIGHT`,
          { headers: this._scopusHeaders() },
          { source: 'Scopus', retries: 1 }
        );
        if (response.status === 404) {
          this._rejectIdentity(`Scopus author id ${scopusAuthorId} does not exist in Scopus.`);
        }
        if (response.ok) {
          const json = await response.json();
          const record = toArray(json?.['author-retrieval-response'])[0];
          if (record && record['@status'] !== 'not_found') {
            names = [record['preferred-name'], ...toArray(record['name-variants'] || record['name-variant'])]
              .filter(Boolean)
              .map((n) => [n['given-name'], n.surname].filter(Boolean).join(' '))
              .filter(Boolean);
            via = 'scopus';
          } else if (record) {
            this._rejectIdentity(`Scopus author id ${scopusAuthorId} does not exist in Scopus.`);
          }
        } else {
          reason = `Scopus Author API responded ${response.status}`;
        }
      } catch (error) {
        if (error.statusCode === 400) throw error;
        reason = `Scopus Author API unreachable: ${error.message}`;
      }
    }

    if (!names) {
      try {
        const response = await this._fetchWithRetry(
          `${DEFAULT_OPENALEX_BASE_URL}/authors?filter=scopus:${encodeURIComponent(scopusAuthorId)}`,
          { headers: this._openAlexHeaders() },
          { source: 'OpenAlex', retries: 1 }
        );
        if (response.ok) {
          const author = (await response.json())?.results?.[0];
          if (author) {
            names = [author.display_name, ...(author.display_name_alternatives || [])].filter(Boolean);
            via = 'openalex';
          } else {
            reason = reason || 'Scopus id not found in OpenAlex and Scopus not available';
          }
        } else {
          reason = reason || `OpenAlex responded ${response.status}`;
        }
      } catch (error) {
        reason = reason || `OpenAlex unreachable: ${error.message}`;
      }
    }

    if (!names || names.length === 0) {
      log.warn('Scopus author id could not be verified; saving as unverified', { scopusAuthorId, reason });
      return this._verificationResult('unverified', { reason: reason || 'No registry returned a name for this id' });
    }
    if (!userDisplayName) {
      return this._verificationResult('unverified', { name: names[0], reason: 'No employee name to compare with' });
    }
    if (!this._anyNameMatches(names, userDisplayName)) {
      this._rejectIdentity(`Scopus ID verification failed. The ID belongs to "${names[0]}", which does not match your name "${userDisplayName}".`);
    }
    return this._verificationResult('verified', { name: names[0], via });
  }

  async listImportRuns({ userId, limit = 20 } = {}) {
    let researchProfileId = undefined;
    if (userId) {
      const identity = await this.prisma.researchProfileIdentity.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!identity) return [];
      researchProfileId = identity.id;
    }

    const where = researchProfileId ? { researchProfileId } : {};
    return this.prisma.publicationImportRun.findMany({
      where,
      include: {
        researchProfile: {
          select: {
            id: true,
            userId: true,
            orcid: true,
            scopusAuthorId: true,
            user: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  /**
   * Import manually supplied publications for a user.
   * @param {string} userId
   * @param {object} options - { publications, importFormat, triggeredById, actor, universityId? }
   *   universityId: tenant to run in when called outside a request (optional otherwise)
   */
  async importManualPublications(userId, options = {}) {
    return this._runForUser(userId, options.universityId, (runner) => runner._importManualPublications(userId, options));
  }

  async _importManualPublications(userId, options = {}) {
    this._authorMatchCache = new Map();
    this._surnameCandidateCache = new Map();
    const {
      publications = [],
      importFormat = 'manual',
      triggeredById = null,
    } = options;

    if (!Array.isArray(publications) || publications.length === 0) {
      const error = new Error('At least one publication is required for import');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: {
          include: {
            primaryDepartment: true,
            primarySchool: true,
          },
        },
        researchProfileIdentity: true,
      },
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    await this._loadAffiliationContext(user);

    let identity = user.researchProfileIdentity;
    if (!identity) {
      identity = await this.prisma.researchProfileIdentity.upsert({
        where: { userId },
        update: {},
        create: {
          user: { connect: { id: userId } },
        },
      });
    }

    const sourceSystem = this._cleanString(`manual_${String(importFormat).toLowerCase()}`, 32) || 'manual_upload';
    const run = await this.prisma.publicationImportRun.create({
      data: {
        researchProfileId: identity.id,
        triggeredById,
        triggerType: 'manual_upload',
        sourceSystems: [sourceSystem],
        status: 'running',
        metadata: {
          importFormat,
          publicationCount: publications.length,
        },
      },
    });

    const summary = {
      discoveredCount: publications.length,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      specialReviewCount: 0,
      affiliation: { affiliated: 0, not_affiliated: 0, unknown: 0 },
      errors: [],
      contributions: [],
    };

    try {
      for (const [index, publication] of publications.entries()) {
        try {
          const candidate = this._mapManualImportCandidate(publication, user, sourceSystem, index);
          const result = await this._upsertCandidate(user, identity, candidate);
          summary[result.outcome] += 1;
          if (result.affiliation && summary.affiliation) summary.affiliation[result.affiliation] += 1;
          if (result.specialReviewRequired) {
            summary.specialReviewCount += 1;
          }
          if (result.contributionId) {
            summary.contributions.push(result.contributionId);
          }
        } catch (error) {
          summary.failedCount += 1;
          summary.errors.push({
            title: publication?.title,
            message: error.message,
          });
          log.error('Failed to import manual publication', {
            userId,
            title: publication?.title,
            error: error.message,
          });
        }
      }

      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: summary.failedCount > 0 ? 'partial_success' : 'success',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: summary.failedCount,
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: summary.errors,
        },
      });

      await this.prisma.researchProfileIdentity.update({
        where: { id: identity.id },
        data: {
          syncStatus: summary.failedCount > 0 ? 'failed' : 'success',
          syncError: summary.failedCount > 0 ? `${summary.failedCount} publication(s) failed during import` : null,
          lastSyncedAt: new Date(),
        },
      });

      return { runId: run.id, ...summary };
    } catch (error) {
      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: Math.max(summary.failedCount, 1),
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: [...summary.errors, { message: error.message }],
        },
      });

      await this.prisma.researchProfileIdentity.update({
        where: { id: identity.id },
        data: {
          syncStatus: 'failed',
          syncError: error.message,
          lastSyncedAt: new Date(),
        },
      });

      throw error;
    } finally {
      this._authorMatchCache = null;
      this._surnameCandidateCache = null;
    }
  }

  /**
   * Sync a faculty member's publications from ORCID/Scopus/OpenAlex.
   * @param {string} userId
   * @param {object} options - { triggeredById, triggerType, sourcePreference, universityId? }
   *   universityId: tenant to run in when called outside a request (optional otherwise)
   */
  async syncFacultyPublications(userId, options = {}) {
    return this._runForUser(userId, options.universityId, (runner) => runner._syncFacultyPublications(userId, options));
  }

  async _syncFacultyPublications(userId, options = {}) {
    this._authorMatchCache = new Map();
    this._surnameCandidateCache = new Map();
    this._openAlexInstCache = undefined;
    const {
      triggeredById = null,
      triggerType = 'manual',
      sourcePreference = 'all',
    } = options;

    const user = await this.prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: {
          include: {
            primaryDepartment: true,
            primarySchool: true,
          },
        },
        researchProfileIdentity: true,
      },
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    let identity = user.researchProfileIdentity;
    if (!identity) {
      identity = await this.prisma.researchProfileIdentity.upsert({
        where: { userId },
        update: {},
        create: {
          user: { connect: { id: userId } },
        },
      });
    }

    await this._loadAffiliationContext(user, identity);

    const sourceSystems = this._determineSourceSystems(identity, sourcePreference);
    if (sourceSystems.length === 0) {
      const error = new Error('Faculty research identity is not configured');
      error.statusCode = 400;
      throw error;
    }

    // ── Concurrent-sync guard ──────────────────────────────────────────────
    // If a sync run is already in-progress for this identity, bail out to
    // prevent race conditions that can create duplicate contributions.
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min
    const runningRun = await this.prisma.publicationImportRun.findFirst({
      where: {
        researchProfileId: identity.id,
        status: 'running',
        // Ignore stuck/stale runs older than 30 minutes
        startedAt: { gte: staleThreshold },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (runningRun) {
      log.warn('Sync already in progress, skipping duplicate trigger', {
        userId,
        runningRunId: runningRun.id,
        startedAt: runningRun.startedAt,
      });
      return {
        runId: runningRun.id,
        discoveredCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        specialReviewCount: 0,
        errors: [{ title: 'Sync skipped', message: 'Another sync is already running for this user' }],
        contributions: [],
      };
    }

    const run = await this.prisma.publicationImportRun.create({
      data: {
        researchProfileId: identity.id,
        triggeredById,
        triggerType: this._cleanString(triggerType, 32) || 'manual',
        sourceSystems,
        status: 'running',
      },
    });

    const summary = {
      discoveredCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      specialReviewCount: 0,
      affiliation: { affiliated: 0, not_affiliated: 0, unknown: 0 },
      errors: [],
      contributions: [],
      sourceSkips: [],
    };
    let sourceFailures = 0;

    try {
      const { candidates, sourceErrors, sourceSkips = [], stats = {} } =
        await this._discoverCandidates(user, identity, run.sourceSystems);
      sourceSkips.push(...this._sourcesSkippedForScopus(identity, sourcePreference));
      summary.discoveredCount = candidates.length;
      summary.sourceSkips = sourceSkips;
      sourceFailures = sourceErrors.length;
      if (sourceErrors.length > 0) {
        summary.failedCount += sourceErrors.length;
        summary.errors.push(...sourceErrors.map((item) => ({
          title: `${String(item.source || 'external').toUpperCase()} sync`,
          message: item.message,
        })));
      }
      // A source that was deliberately not queried is reported, not counted as a failure.
      summary.errors.push(...sourceSkips.map((item) => ({
        title: `${String(item.source || 'external').toUpperCase()} skipped`,
        message: item.reason,
        skipped: true,
      })));

      await this._attachOpenAlexBylines(candidates, user, identity);

      for (const candidate of candidates) {
        try {
          const result = await this._upsertCandidate(user, identity, candidate);
          summary[result.outcome] += 1;
          if (result.affiliation && summary.affiliation) summary.affiliation[result.affiliation] += 1;
          if (result.specialReviewRequired) {
            summary.specialReviewCount += 1;
          }
          if (result.contributionId) {
            summary.contributions.push(result.contributionId);
          }
        } catch (error) {
          summary.failedCount += 1;
          summary.errors.push({
            title: candidate.title,
            message: error.message,
          });
          log.error('Failed to import candidate', { userId, title: candidate.title, error: error.message });
        }
      }

      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: summary.failedCount > 0 ? 'partial_success' : 'success',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: summary.failedCount,
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: summary.errors,
          metadata: { sourceSkips, sourceFailures, ...stats },
        },
      });

      await this._recordSyncOutcome(identity, {
        ok: summary.failedCount === 0,
        error: summary.failedCount > 0
          ? (sourceFailures > 0
            ? `${sourceFailures} source(s) failed; retrying in ${retryHours()} hour(s)`
            : `${summary.failedCount} publication(s) failed to import; retrying in ${retryHours()} hour(s)`)
          : null,
        partial: summary.failedCount > 0,
      });

      return { runId: run.id, ...summary };
    } catch (error) {
      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: Math.max(summary.failedCount, 1),
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: [...summary.errors, { message: error.message }],
        },
      });

      await this._recordSyncOutcome(identity, { ok: false, error: error.message, partial: false });

      throw error;
    } finally {
      this._authorMatchCache = null;
      this._surnameCandidateCache = null;
      this._openAlexInstCache = undefined;
    }
  }

  /**
   * After a clean run the profile is synced and comes due again after
   * syncFrequencyDays. When a source (or the run) failed it is NOT marked synced:
   * lastSyncedAt keeps the last clean run and the next attempt is a few hours away.
   */
  async _recordSyncOutcome(identity, { ok, error = null, partial = false }) {
    const now = new Date();
    const frequencyDays = Math.max(1, Number(identity.syncFrequencyDays) || 1);
    const data = ok
      ? {
        syncStatus: 'success',
        syncError: null,
        lastSyncedAt: now,
        nextSyncAt: new Date(now.getTime() + frequencyDays * 86400000),
      }
      : {
        syncStatus: partial ? 'partial_success' : 'failed',
        syncError: this._cleanString(error, 1000),
        nextSyncAt: new Date(now.getTime() + retryHours() * 3600000),
      };
    await this.prisma.researchProfileIdentity.update({ where: { id: identity.id }, data });
  }

  /**
   * Sync every profile that is due.
   *
   * Due profiles are selected in the database (nextSyncAt reached, or never
   * scheduled), oldest first, in batches, so nobody starves behind a large
   * tenant. Up to `concurrency` profiles sync at once and no new profile starts
   * after `deadline`.
   *
   * @param {{ universityId?: string, now?: Date, batchSize?: number, concurrency?: number, deadline?: number }} [options]
   *   universityId: process only this university (runs inside runForTenant when no tenant
   *   context is active). Without it and without a tenant context, profiles of every
   *   university are read explicitly (runAsSystem) and each is synced inside its own
   *   university's context.
   * @returns {Promise<Array<{ userId, status, result?, error? }>>}
   */
  async runScheduledSync(options = {}) {
    const { universityId } = options;
    const current = tenantContext.getTenantId();
    if (universityId && current !== universityId) {
      if (current) throw new Error('runScheduledSync: universityId does not match the active tenant');
      return tenantContext.runForTenant(universityId, () => this.runScheduledSync(options));
    }

    const now = options.now || new Date();
    const batchSize = Math.max(1, Number(options.batchSize) || numberEnv('PUBLICATION_SYNC_BATCH_SIZE', 50));
    const concurrency = Math.max(1, Number(options.concurrency) || numberEnv('PUBLICATION_SYNC_CONCURRENCY', 3));
    const deadline = options.deadline || (Date.now() + numberEnv('PUBLICATION_SYNC_MAX_RUN_MS', 45 * 60 * 1000));
    const scoped = Boolean(current);
    const asScope = (fn) => (scoped ? fn() : tenantContext.runAsSystem(fn));

    const identities = await asScope(() => this.prisma.researchProfileIdentity.findMany({
      where: {
        autoSyncEnabled: true,
        OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }],
      },
      select: {
        id: true,
        userId: true,
        universityId: true,
        lastSyncedAt: true,
        syncFrequencyDays: true,
        nextSyncAt: true,
      },
      orderBy: [
        { nextSyncAt: { sort: 'asc', nulls: 'first' } },
        { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
      ],
      take: batchSize,
    }));

    // Rows without a schedule that were synced recently: schedule them instead of syncing.
    const due = [];
    for (const identity of identities) {
      if (identity.nextSyncAt || this._isSyncDue(identity, now)) {
        due.push(identity);
        continue;
      }
      const frequencyDays = Math.max(1, Number(identity.syncFrequencyDays) || 1);
      const nextSyncAt = new Date(new Date(identity.lastSyncedAt).getTime() + frequencyDays * 86400000);
      try {
        await asScope(() => this.prisma.researchProfileIdentity.update({ where: { id: identity.id }, data: { nextSyncAt } }));
      } catch (error) {
        log.warn('Could not schedule research profile', { identityId: identity.id, error: error.message });
      }
    }

    const results = [];
    await this._mapLimit(due, concurrency, async (identity) => {
      if (Date.now() > deadline) {
        results.push({ userId: identity.userId, status: 'deferred' });
        return;
      }
      try {
        const run = () => this.syncFacultyPublications(identity.userId, {
          triggerType: 'scheduled',
        });
        const result = !scoped && identity.universityId
          ? await tenantContext.runForTenant(identity.universityId, run)
          : await run();
        results.push({ userId: identity.userId, status: 'success', result });
      } catch (error) {
        results.push({ userId: identity.userId, status: 'failed', error: error.message });
      }
    });

    return results;
  }

  /**
   * Import one work as a draft and record whether its owner is affiliated with this university
   * on it (_classifyHomeAffiliation). Nothing is submitted here: the researcher submits affiliated
   * works for incentive from My Contributions (contribution.service enforces it), and sends
   * works of unknown affiliation to DRD for verification. Works of other institutions are kept
   * as drafts so they show on the list, but can never be submitted for incentive.
   */
  /** Front/back matter, retraction or correction notices, machine-translated copies (see NON_RESEARCH_*). */
  _isNonResearchRecord(candidate) {
    const raw = String(candidate?.title || '').trim();
    if (!raw) return true;
    const title = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (NON_RESEARCH_TITLES.has(title)) return true;
    return NON_RESEARCH_PATTERNS.some((re) => re.test(raw));
  }

  async _upsertCandidate(user, identity, candidate) {
    if (this._isNonResearchRecord(candidate)) {
      return { outcome: 'skippedCount', contributionId: null, specialReviewRequired: false, nonResearch: true };
    }
    const matched = this._matchOwningFaculty(candidate.authors || [], user, identity);
    // The source gave no affiliation for the owner on this paper: use the byline OpenAlex has for it.
    const ownerAuthor = (!matched?.affiliation || !String(matched.affiliation).trim()) && candidate.ownerBylineAffiliation
      ? { ...(matched || {}), affiliation: candidate.ownerBylineAffiliation, affiliationFrom: 'openalex' }
      : matched;
    const affiliation = this._classifyHomeAffiliation(ownerAuthor, candidate);

    const existing = await this._findExistingContribution(user.id, candidate);
    const payload = await this._buildContributionInput(user, identity, candidate, existing);

    if (existing) {
      const updated = await this._updateExistingContribution(existing, payload, candidate);
      await this._upsertImportLinks(identity.id, updated.id, candidate);
      await this._recordHomeAffiliation(updated, affiliation);
      return {
        outcome: updated._outcome || 'updatedCount',
        contributionId: updated.id,
        specialReviewRequired: Boolean(updated.specialReviewRequired),
        affiliation: affiliation.status,
      };
    }

    // A co-author at this university already claimed this work: don't create a second claim.
    const colleagueClaims = await findActiveClaims(keysFor(payload));
    if (colleagueClaims.some((c) => c.applicantUserId !== user.id)) {
      return { outcome: 'skippedCount', contributionId: colleagueClaims[0].id, specialReviewRequired: false, duplicateOfClaim: true };
    }

    const created = await this.contributionService.createContribution(payload, {});
    await this._ensureContributionAuthors(created.id, payload);
    await this._upsertImportLinks(identity.id, created.id, candidate);
    await this._recordHomeAffiliation(created, affiliation);

    return {
      outcome: 'createdCount',
      contributionId: created.id,
      specialReviewRequired: Boolean(payload.specialReviewRequired),
      affiliation: affiliation.status,
    };
  }

  /**
   * Is the owner affiliated with this university ON THIS PAPER? Only the affiliation the owner
   * used in the paper's byline counts — never where they work today or worked that year — and it
   * must be their PRIMARY affiliation: the first one listed for them on the paper.
   *   affiliated      the owner's first byline affiliation is this university (Scopus AF-ID, or
   *                   text naming it or one of the owner's own aliases)
   *   not_affiliated  the first byline affiliation is another institution — basis "not_primary"
   *                   when this university is listed later, "other_institution" when it is absent
   *   unknown         no source has the owner's byline for this paper (DRD verifies it)
   * Byline affiliations are kept in printed order: Scopus lists an author's afids in byline order,
   * OpenAlex lists raw_affiliation_strings in byline order; both are joined with "; ".
   * Byline text comes from the source of the record, else from OpenAlex by DOI
   * (_attachOpenAlexBylines); basis gets "_openalex" in that case.
   * @returns {{ status: 'affiliated'|'not_affiliated'|'unknown', basis: string, detail: string|null }}
   */
  _classifyHomeAffiliation(ownerAuthor, candidate) {
    const clip = (v) => (v ? String(v).replace(/\s+/g, ' ').trim().slice(0, 500) : null);
    const afids = Array.isArray(ownerAuthor?.scopusAfids) ? ownerAuthor.scopusAfids.map(String) : [];
    const own = ownerAuthor?.affiliation && String(ownerAuthor.affiliation).trim();
    const notPrimary = (detail, via = '') => ({
      status: 'not_affiliated',
      basis: `not_primary${via}`,
      detail: clip(`${this._canonicalUniversityName || 'This university'} is listed, but not as your primary affiliation: ${detail}`),
    });

    // 1. Scopus affiliation ids, in byline order.
    if (afids.length && this._scopusAffiliationIds.has(afids[0])) {
      return { status: 'affiliated', basis: 'scopus_afid', detail: clip(own) || 'Scopus affiliation ID of this university' };
    }
    // 2. Byline text, in printed order: the first affiliation decides.
    if (own) {
      const via = ownerAuthor.affiliationFrom === 'openalex' ? '_openalex' : '';
      const listed = own.split(/\s*;\s*/).filter(Boolean);
      const primary = listed[0] || own;
      const homeBy = (text) => (isAffiliationMatch(text, this._affiliationVariants, this._affiliationOptions) ? 'name_match'
        : (this._ownerAffiliationVariants !== this._affiliationVariants
          && isAffiliationMatch(text, this._ownerAffiliationVariants, this._affiliationOptions)) ? 'personal_alias' : null);
      const primaryBasis = homeBy(primary);
      if (primaryBasis) return { status: 'affiliated', basis: `${primaryBasis}${via}`, detail: clip(own) };
      if (listed.slice(1).some(homeBy) || afids.some((id) => this._scopusAffiliationIds.has(id))) return notPrimary(own, via);
      return { status: 'not_affiliated', basis: `other_institution${via}`, detail: clip(own) };
    }
    if (afids.length > 0) {
      if (afids.some((id) => this._scopusAffiliationIds.has(id))) return notPrimary('Scopus affiliation ids');
      return { status: 'not_affiliated', basis: 'other_institution', detail: 'Scopus lists another institution for you on this work' };
    }
    // 3. No byline for the owner, but the work came from a Scopus search limited to this university.
    if (candidate?.trustedHomeInstitutionQuery) {
      return { status: 'affiliated', basis: 'trusted_query', detail: 'Found by a Scopus search limited to this university' };
    }
    // No byline affiliation for the owner on this paper in any source.
    return {
      status: 'unknown',
      basis: 'no_data',
      detail: candidate?.homeInstitutionOnPaper
        ? 'A co-author lists this university, but no source shows the affiliation you used on this paper'
        : 'No source shows the affiliation you used on this paper',
    };
  }

  /**
   * For works whose source gave no affiliation for the owner, read the owner's byline on that
   * paper from OpenAlex by DOI (authorships[].raw_affiliation_strings, else its institutions).
   * The owner is the authorship with the owner's ORCID iD, else the one whose name matches.
   * Batched 50 DOIs per request; never fails the sync. Sets candidate.ownerBylineAffiliation.
   */
  async _attachOpenAlexBylines(candidates, user, identity) {
    const needs = (candidates || []).filter((c) => {
      if (!normalizeDoi(c.doi)) return false;
      const owner = this._matchOwningFaculty(c.authors || [], user, identity);
      return !(owner?.affiliation && String(owner.affiliation).trim());
    });
    if (!needs.length) return 0;
    const orcid = this._normalizeOrcid(identity?.orcid);
    const ownerNames = new Set([
      user?.employeeDetails?.displayName,
      [user?.employeeDetails?.firstName, user?.employeeDetails?.lastName].filter(Boolean).join(' '),
    ].filter(Boolean).map((n) => this._normalizeName(n)));
    let found = 0;
    for (let i = 0; i < needs.length; i += 50) {
      const chunk = needs.slice(i, i + 50);
      const byDoi = new Map(chunk.map((c) => [normalizeDoi(c.doi), c]));
      const params = new URLSearchParams({ filter: `doi:${[...byDoi.keys()].join('|')}`, 'per-page': '50', select: 'doi,authorships' });
      try {
        const res = await this._fetchWithRetry(`${DEFAULT_OPENALEX_BASE_URL}/works?${params.toString()}`, { headers: this._openAlexHeaders() }, { source: 'OpenAlex bylines' });
        if (!res || !res.ok) continue;
        const json = await res.json();
        for (const work of json?.results || []) {
          const candidate = byDoi.get(normalizeDoi(work.doi));
          if (!candidate) continue;
          const authorship = (work.authorships || []).find((a) => orcid && this._normalizeOrcid(a?.author?.orcid) === orcid)
            || (work.authorships || []).find((a) => ownerNames.has(this._normalizeName(a?.author?.display_name || a?.raw_author_name || '')));
          if (!authorship) continue;
          const raw = (authorship.raw_affiliation_strings || []).filter(Boolean);
          const text = (raw.length ? raw : (authorship.institutions || []).map((inst) => inst?.display_name).filter(Boolean)).join('; ');
          if (text) {
            candidate.ownerBylineAffiliation = text;
            found += 1;
          }
        }
      } catch (error) {
        log.warn('OpenAlex byline lookup failed', { error: error.message });
      }
    }
    return found;
  }

  /** Store the classification on the contribution (only when it changed). */
  async _recordHomeAffiliation(contribution, affiliation) {
    if (!contribution?.id || !affiliation) return;
    if (contribution.homeAffiliation === affiliation.status
      && contribution.homeAffiliationBasis === affiliation.basis
      && contribution.homeAffiliationDetail === affiliation.detail) return;
    await this.prisma.researchContribution.update({
      where: { id: contribution.id },
      data: { homeAffiliation: affiliation.status, homeAffiliationBasis: affiliation.basis, homeAffiliationDetail: affiliation.detail },
    });
  }

  async _findExistingContribution(userId, candidate) {
    const normalizedTitle = this._normalizeTitle(candidate.title);
    const publishedYear = candidate.publicationDate ? new Date(candidate.publicationDate).getFullYear() : null;

    // ── 1. Try publicationImport index (fastest — direct FK lookup) ────────
    for (const [sourceSystem, externalId] of Object.entries(candidate.externalIds || {})) {
      if (!externalId) continue;
      const publicationImport = await this.prisma.publicationImport.findFirst({
        where: { sourceSystem, externalId: String(externalId) },
        include: {
          researchContribution: true,
        },
      });
      if (publicationImport?.researchContribution?.applicantUserId === userId
        && !this._isOtherScopusDocument(publicationImport.researchContribution, candidate)) {
        return publicationImport.researchContribution;
      }
    }

    // ── 2. Fallback: search by DOI (normalised; stored rows may carry a URL prefix or other case)
    const doi = normalizeDoi(candidate.doi);
    if (doi) {
      const byDoi = await this.prisma.researchContribution.findFirst({
        where: {
          applicantUserId: userId,
          OR: [
            { doi: { equals: doi, mode: 'insensitive' } },
            { doi: { endsWith: `/${doi}`, mode: 'insensitive' } },
          ],
        },
      });
      if (byDoi && !this._isOtherScopusDocument(byDoi, candidate)) return byDoi;
    }

    // ── 3. Fallback: search by externalIds JSON values (catches orphaned   ──
    //        duplicates whose publicationImport link was not created, e.g.  ──
    //        due to concurrent sync runs)                                   ──
    for (const [, externalId] of Object.entries(candidate.externalIds || {})) {
      if (!externalId) continue;
      const byExternalId = await this.prisma.researchContribution.findFirst({
        where: {
          applicantUserId: userId,
          externalIds: { path: [], string_contains: String(externalId) },
        },
      });
      if (byExternalId && !this._isOtherScopusDocument(byExternalId, candidate)) return byExternalId;
    }

    // ── 4. Last-resort: normalized-title + year match ─────────────────────
    // A generic title ("Preface", "Editorial") is shared by unrelated works, even in one year:
    // those match only when the book / journal is the same too.
    const generic = GENERIC_WORK_TITLES.has(normalizedTitle);
    const candidateVenue = this._normalizeTitle(candidate.bookTitle || candidate.venue || candidate.journalName || candidate.conferenceName || '');
    return this.prisma.researchContribution.findMany({
      where: {
        applicantUserId: userId,
        title: { equals: candidate.title, mode: 'insensitive' },
        ...(publishedYear ? {
          publicationDate: {
            gte: new Date(`${publishedYear}-01-01T00:00:00.000Z`),
            lte: new Date(`${publishedYear}-12-31T23:59:59.999Z`),
          },
        } : {}),
      },
      take: 20,
    }).then((records) => (records || []).find((record) => {
      if (this._normalizeTitle(record.title) !== normalizedTitle) return false;
      if (this._isOtherScopusDocument(record, candidate)) return false;
      if (!generic) return true;
      const venue = this._normalizeTitle(record.bookTitle || record.journalName || record.conferenceName || '');
      return Boolean(candidateVenue) && venue === candidateVenue;
    }) || null).then((record) => record || this._findRepublishedEdition(userId, candidate, normalizedTitle, publishedYear));
  }

  /**
   * ── 5. The same work re-published (a chapter reprinted in a later encyclopedia volume,
   * a conference paper re-listed with the proceedings year): same author, same type, same
   * distinctive title, published within REPUBLISHED_YEAR_WINDOW years, and at most one of
   * the two carries a DOI (two different DOIs are two different published items).
   * Generic front-matter titles ("Preface", "Editorial", ...) never merge: an editor writes
   * one per book. Neither do two different Scopus records (see _isOtherScopusDocument).
   */
  async _findRepublishedEdition(userId, candidate, normalizedTitle, publishedYear) {
    const words = normalizedTitle.split(' ').filter(Boolean);
    if (words.length < 4 || normalizedTitle.length < 25 || GENERIC_WORK_TITLES.has(normalizedTitle)) return null;
    const publicationType = this._inferPublicationType(candidate);
    const rows = await this.prisma.researchContribution.findMany({
      where: { applicantUserId: userId, publicationType, title: { equals: candidate.title, mode: 'insensitive' } },
      orderBy: { publicationDate: 'asc' },
      take: 10,
    });
    const candidateDoi = normalizeDoi(candidate.doi);
    return rows.find((row) => {
      if (this._normalizeTitle(row.title) !== normalizedTitle) return false;
      if (this._isOtherScopusDocument(row, candidate)) return false;
      const rowDoi = normalizeDoi(row.doi);
      if (candidateDoi && rowDoi && candidateDoi !== rowDoi) return false;
      const rowYear = row.publicationDate ? new Date(row.publicationDate).getFullYear() : null;
      return !publishedYear || !rowYear || Math.abs(rowYear - publishedYear) <= REPUBLISHED_YEAR_WINDOW;
    }) || null;
  }

  /**
   * Two different Scopus records are two documents, even with the same title (a chapter in two
   * different books, say): Scopus counts both, and a profile with a Scopus ID reports what Scopus
   * reports. So a stored work already linked to another Scopus id is never the match for this one.
   */
  _isOtherScopusDocument(record, candidate) {
    const incoming = this._scopusNumericId(candidate?.externalIds?.scopus);
    const stored = this._scopusNumericId(this._asObject(record?.externalIds).scopus);
    return Boolean(incoming && stored && incoming !== stored);
  }

  async _updateExistingContribution(existing, payload, candidate) {
    const immutableStatuses = ['approved', 'completed', 'rejected'];
    const currentImportMetadata = this._asObject(existing.importMetadata);
    const currentProvenance = this._asObject(existing.fieldProvenance);

    const patch = {};
    const autoFields = [
      'abstract',
      'keywords',
      'journalName',
      'issn',
      'publisherName',
      'issue',
      'pageNumbers',
      'doi',
      'weblink',
      'paperweblink',
      'publicationDate',
      'conferenceName',
      'conferenceLocation',
      'conferenceDate',
      'proceedingsTitle',
      'bookTitle',
      'chapterNumber',
      'isbn',
      'edition',
      'publisherLocation',
      'proceedingsQuartile',
      'bookIndexingType',
      'conferenceSubType',
      'quartile',
      'sjr',
      'impactFactor',
      'naasRating',
      'subsidiaryImpactFactor',
      'volume',
      'sourceType',
      'sourceSystems',
      'externalIds',
      'lastSyncedAt',
      'specialReviewRequired',
      'importConfidence',
      'missingFields',
      'autoCalculatedFields',
      'fieldProvenance',
      'importMetadata',
      'indexingCategories',
      'indexingDetails',
    ];

    for (const field of autoFields) {
      const nextValue = payload[field];
      const currentValue = existing[field];
      const provenance = currentProvenance[field];
      const isEditableAutoField = provenance === 'auto' || provenance === undefined || provenance === null;

      if (immutableStatuses.includes(existing.status) && field !== 'lastSyncedAt' && field !== 'importMetadata' && field !== 'sourceSystems' && field !== 'indexingDetails') {
        continue;
      }

      if (!isEditableAutoField && field !== 'lastSyncedAt' && field !== 'importMetadata' && field !== 'indexingDetails') {
        continue;
      }

      if (field === 'indexingDetails') {
        if (!this._deepEqual(currentValue, nextValue)) {
          patch[field] = nextValue;
        }
      } else if (field === 'publicationDate') {
        // Allow overwriting year-only defaults (YYYY-01-01) with more precise dates
        const isCurrentYearOnly = currentValue && new Date(currentValue).getUTCDate() === 1 && new Date(currentValue).getUTCMonth() === 0;
        const isCurrentMonthFirst = currentValue && new Date(currentValue).getUTCDate() === 1;
        const newDate = nextValue ? new Date(nextValue) : null;
        const sameDay = newDate && currentValue && newDate.getTime() === new Date(currentValue).getTime();
        if (sameDay) continue;
        if (!currentValue && newDate) {
          patch[field] = newDate;
        } else if (isCurrentYearOnly && newDate && !(newDate.getUTCDate() === 1 && newDate.getUTCMonth() === 0)
          && newDate.getUTCFullYear() === new Date(currentValue).getUTCFullYear()) {
          patch[field] = newDate;
        } else if (isCurrentMonthFirst && newDate && newDate.getUTCDate() !== 1
          && newDate.getUTCFullYear() === new Date(currentValue).getUTCFullYear()
          && newDate.getUTCMonth() === new Date(currentValue).getUTCMonth()) {
          // Current is month-first (day=1) and new has the actual day
          patch[field] = newDate;
        }
      } else if (field === 'doi') {
        if (this._shouldApplyAutoValue(currentValue, nextValue) && normalizeDoi(currentValue) !== normalizeDoi(nextValue)) {
          patch[field] = nextValue;
        }
      } else if (this._shouldApplyAutoValue(currentValue, nextValue)) {
        patch[field] = nextValue;
      }
    }

    const mergedSources = Array.from(new Set([...(existing.sourceSystems || []), ...(payload.sourceSystems || [])]));
    if (mergedSources.length !== (existing.sourceSystems || []).length) {
      patch.sourceSystems = mergedSources;
    }

    // Authors are refreshed when the stored list is shorter / lacks Scopus ids.
    const authorsReplaced = await this._ensureContributionAuthors(existing.id, payload);

    // Bookkeeping (lastSyncedAt / importMetadata) is not a change: a re-sync that only
    // touches those reports "skipped".
    const changed = Object.keys(patch).filter((key) => key !== 'lastSyncedAt' && key !== 'importMetadata');
    const bookkeeping = {
      lastSyncedAt: new Date(),
      importMetadata: {
        ...currentImportMetadata,
        ...this._asObject(payload.importMetadata),
        lastSeenCandidate: {
          title: candidate.title,
          publicationDate: candidate.publicationDate || null,
        },
      },
    };

    if (changed.length === 0 && !authorsReplaced) {
      await this.prisma.researchContribution.update({ where: { id: existing.id }, data: bookkeeping });
      return { ...existing, _outcome: 'skippedCount' };
    }

    const updated = await this.prisma.researchContribution.update({
      where: { id: existing.id },
      data: { ...patch, ...bookkeeping },
    });

    return { ...updated, _outcome: 'updatedCount' };
  }

  /** @returns {Promise<boolean>} true when the stored author list was replaced */
  async _ensureContributionAuthors(contributionId, payload) {
    const expected = Array.isArray(payload.authors) ? payload.authors.length : 0;
    if (expected <= 1) return false;

    const existingCount = await this.prisma.researchContributionAuthor.count({
      where: { researchContributionId: contributionId },
    });

    const payloadHasScopusIds = payload.authors.some((author) => author.scopusAuthorId);
    let storedScopusCount = 0;
    if (payloadHasScopusIds) {
      storedScopusCount = await this.prisma.researchContributionAuthor.count({
        where: {
          researchContributionId: contributionId,
          scopusAuthorId: { not: null },
        },
      });
    }

    const shouldReplace =
      existingCount < expected
      || (payloadHasScopusIds && storedScopusCount === 0 && existingCount >= expected);

    if (!shouldReplace) return false;

    await this.contributionService.replaceImportedAuthors(contributionId, payload);
    return true;
  }

  /**
   * Link each external id of the work (Scopus EID, DOI, …) to the contribution. One lookup for all
   * of the work's ids; rows already pointing at this contribution with the same DOI / title only
   * get lastSeenAt bumped (one statement); new ids are created; changed rows are updated. A row
   * owned by another researcher's profile is left alone.
   */
  async _upsertImportLinks(researchProfileId, contributionId, candidate) {
    const entries = Object.entries(candidate.externalIds || {})
      .filter(([, value]) => value)
      .map(([sourceSystem, value]) => ({ sourceSystem, externalId: String(value) }));
    if (!entries.length) return;

    const sharedData = {
      doi: this._cleanString(normalizeDoi(candidate.doi), 256),
      publishedYear: candidate.publicationDate ? new Date(candidate.publicationDate).getFullYear() : null,
      normalizedTitle: this._cleanString(this._normalizeTitle(candidate.title), 512),
      lastSeenAt: new Date(),
      metadata: {
        title: candidate.title,
        sourceSystems: candidate.sourceSystems,
      },
    };
    const keyOf = (r) => `${r.sourceSystem}\u0001${r.externalId}`;
    const existing = new Map((await this.prisma.publicationImport.findMany({ where: { OR: entries } })).map((r) => [keyOf(r), r]));

    const unchanged = [];
    for (const entry of entries) {
      const row = existing.get(keyOf(entry));
      if (!row) {
        try {
          await this.prisma.publicationImport.create({
            data: {
              researchProfile: { connect: { id: researchProfileId } },
              researchContribution: { connect: { id: contributionId } },
              ...entry,
              ...sharedData,
            },
          });
        } catch (createErr) {
          // P2002 = unique constraint — a concurrent sync inserted the same row
          if (createErr.code !== 'P2002') throw createErr;
          const concurrent = await this.prisma.publicationImport.findFirst({ where: entry });
          if (concurrent && concurrent.researchProfileId === researchProfileId) {
            await this.prisma.publicationImport.update({
              where: { id: concurrent.id },
              data: { researchContributionId: contributionId, ...sharedData },
            });
          }
        }
        continue;
      }
      if (row.researchProfileId !== researchProfileId) continue;
      if (row.researchContributionId === contributionId && row.doi === sharedData.doi
        && row.normalizedTitle === sharedData.normalizedTitle && row.publishedYear === sharedData.publishedYear) {
        unchanged.push(row.id);
        continue;
      }
      await this.prisma.publicationImport.update({
        where: { id: row.id },
        data: { researchContributionId: contributionId, ...sharedData },
      });
    }
    if (unchanged.length) {
      await this.prisma.publicationImport.updateMany({ where: { id: { in: unchanged } }, data: { lastSeenAt: sharedData.lastSeenAt } });
    }
  }

  async _buildContributionInput(user, identity, candidate, existing) {
    const mapped = await this._resolveAuthors(candidate.authors || [], user, identity);
    const publicationType = this._inferPublicationType(candidate);
    const indexingCategories = this._deriveIndexingCategories(candidate);
    const missingFields = this._collectMissingFields(publicationType, candidate, indexingCategories, mapped);
    const reviewReasons = missingFields.filter((field) => !ENRICHMENT_ONLY_FIELDS.has(field));
    const specialReviewRequired = reviewReasons.length > 0;
    const importConfidence = this._calculateConfidence(missingFields, mapped);
    const fieldProvenance = {};
    const autoCalculatedFields = [];
    const doi = normalizeDoi(candidate.doi);
    const existingDetails = this._asObject(existing?.indexingDetails);
    // Citation counts from different sources/runs: keep the highest seen.
    const citationCount = Math.max(
      Number(candidate.citationCount) || 0,
      Number(existingDetails.citationCount) || 0
    );

    const payload = {
      userId: user.id,
      userRole: user.role,
      publicationType,
      title: candidate.title,
      abstract: candidate.abstract || null,
      keywords: Array.isArray(candidate.keywords) ? candidate.keywords.join(', ') : null,
      indexingCategories,
      quartile: candidate.quartile || null,
      sjr: candidate.sjr || null,
      impactFactor: candidate.impactFactor || null,
      naasRating: candidate.naasRating || null,
      subsidiaryImpactFactor: candidate.subsidiaryImpactFactor || null,
      journalName: candidate.journalName || candidate.venue || null,
      issue: candidate.issue || null,
      pageNumbers: candidate.pageNumbers || null,
      doi: doi || null,
      issn: candidate.issn || null,
      publisherName: candidate.publisherName || null,
      isbn: candidate.isbn || null,
      edition: candidate.edition || null,
      chapterNumber: candidate.chapterNumber || null,
      bookTitle: candidate.bookTitle || null,
      editors: candidate.editors || null,
      publisherLocation: candidate.publisherLocation || null,
      conferenceName: candidate.conferenceName || (publicationType === 'conference_paper' ? (candidate.venue || candidate.journalName || null) : null),
      conferenceLocation: candidate.conferenceLocation || null,
      conferenceDate: candidate.conferenceDate || null,
      proceedingsTitle: candidate.proceedingsTitle || null,
      publicationDate: candidate.publicationDate || null,
      publicationStatus: candidate.publicationStatus || 'published',
      volume: candidate.volume || null,
      weblink: candidate.weblink || null,
      paperweblink: candidate.weblink || null,
      conferenceSubType: candidate.conferenceSubType || null,
      proceedingsQuartile: candidate.proceedingsQuartile || null,
      bookType: candidate.bookType || candidate.bookPublicationType || 'authored',
      bookPublicationType: candidate.bookPublicationType || candidate.bookType || 'authored',
      bookIndexingType: candidate.bookIndexingType || null,
      nationalInternational: candidate.nationalInternational || null,
      indexedIn: candidate.indexedIn || null,
      conferenceType: candidate.conferenceType || null,
      internationalAuthor: mapped.internationalAuthor,
      foreignCollaborationsCount: mapped.foreignCollaborationsCount,
      totalAuthors: mapped.authors.length,
      sgtAffiliatedAuthors: mapped.sgtAffiliatedAuthors,
      internalCoAuthors: mapped.internalCoAuthors,
      sourceType: 'auto_import',
      sourceSystems: candidate.sourceSystems || [],
      externalIds: candidate.externalIds || {},
      importedAt: existing?.importedAt || new Date(),
      lastSyncedAt: new Date(),
      specialReviewRequired,
      importConfidence,
      missingFields,
      autoCalculatedFields,
      fieldProvenance,
      importMetadata: {
        source: 'auto_import',
        sourceSystems: candidate.sourceSystems || [],
        rawExternalIds: candidate.externalIds || {},
        specialReviewRequired,
        specialReviewReasons: reviewReasons,
        importConfidence,
        missingFields,
        ownerFoundInAuthorList: mapped.ownerFound,
        authorsSource: candidate.authorsSource || null,
      },
      indexingDetails: {
        ...existingDetails,
        sourceSystems: candidate.sourceSystems || [],
        specialReviewRequired,
        importConfidence,
        citationCount,
        // This run's count per source wins over an older one; sources not seen this run keep theirs.
        citationsBySource: { ...(existingDetails.citationsBySource || {}), ...(candidate.citationsBySource || {}) },
        // Store affiliation summary for each source system
        affiliationSummary: this._buildAffiliationSummary(candidate.authors || [], mapped.sgtAffiliatedAuthors),
      },
      authors: mapped.authors,
      applicantDetails: {
        uid: user.uid,
        email: user.email,
        universityDeptName: user.employeeDetails?.primaryDepartment?.departmentName || null,
        metadata: {
          sourceType: 'auto_import',
          identityId: identity.id,
        },
      },
    };

    Object.keys(payload).forEach((field) => {
      if (field === 'authors' || field === 'applicantDetails') return;
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        fieldProvenance[field] = 'auto';
        autoCalculatedFields.push(field);
      }
    });

    payload.fieldProvenance = fieldProvenance;
    payload.autoCalculatedFields = Array.from(new Set(autoCalculatedFields));

    return payload;
  }

  /**
   * Map a work's author list onto internal/external authors. The owner is matched to
   * their own entry (ids first, then name + home affiliation) and that entry is marked;
   * the owner is never invented — when they cannot be found, `ownerFound` is false and
   * the work goes to special review.
   */
  async _resolveAuthors(authors, user, identity) {
    const authorList = Array.isArray(authors) ? authors : [];
    const ownerIndex = this._findOwnerIndex(authorList, user, identity);
    const matches = await this._matchInternalAuthors(authorList, ownerIndex);

    const resolvedAuthors = [];
    const seenKeys = new Set();
    // The same person may appear under different name forms ("Prateek Agrawal" / "Agrawal P.").
    const seenUserIds = new Set();
    let sgtAffiliatedAuthors = 0;
    let internalCoAuthors = 0;
    let foreignCollaborationsCount = 0;
    let internationalAuthor = false;
    let hasAmbiguousInternalMatches = false;

    for (const [index, author] of authorList.entries()) {
      const order = Number(author.authorOrder || index + 1);

      if (index === ownerIndex) {
        const ownerPayload = await this._buildInternalAuthor(user, author, order);
        resolvedAuthors.push(ownerPayload);
        seenUserIds.add(user.id);
        seenKeys.add(this._authorDedupKey({ userId: user.id, email: author.email, name: author.name }));
        sgtAffiliatedAuthors += 1;
        continue;
      }

      const matched = matches[index];
      const authorKey = this._authorDedupKey({
        userId: matched?.user?.id,
        email: author.email,
        name: author.name,
      });
      if (seenKeys.has(authorKey) || (matched?.user && seenUserIds.has(matched.user.id))) {
        continue;
      }
      if (matched?.ambiguous) hasAmbiguousInternalMatches = true;

      const isHome = this._isAuthorHomeAffiliated(author);
      let finalAuthor;
      if (matched?.user && matched.user.id !== user.id) {
        seenUserIds.add(matched.user.id);
        finalAuthor = await this._buildInternalAuthor(matched.user, author, order);
        sgtAffiliatedAuthors += 1;
        internalCoAuthors += 1;
      } else {
        const isForeign = this._isForeignCountry(author.country);
        finalAuthor = {
          uid: null,
          registrationNumber: null,
          name: this._cleanString(author.name, 256) || `Author ${order}`,
          email: this._cleanString(author.email, 256),
          phone: null,
          affiliation: this._cleanString(author.affiliation, 256),
          country: this._cleanString(author.country, 64),
          department: this._cleanString(author.department, 256),
          designation: this._cleanString(author.designation, 256),
          orderNumber: order,
          authorPosition: order,
          isCorresponding: Boolean(author.isCorresponding),
          authorRole: this._deriveAuthorRole(order, Boolean(author.isCorresponding)),
          authorType: isHome ? 'internal_faculty' : 'external_academic',
          isInternational: !isHome && isForeign,
          scopusAuthorId: this._normalizeScopusAuthorId(author.scopusAuthorId),
        };

        if (isHome) {
          // Home-affiliated but not linked to an account: someone must map it.
          sgtAffiliatedAuthors += 1;
          internalCoAuthors += 1;
          hasAmbiguousInternalMatches = true;
        } else if (isForeign) {
          foreignCollaborationsCount += 1;
          internationalAuthor = true;
        }
      }

      resolvedAuthors.push(finalAuthor);
      seenKeys.add(authorKey);
    }

    return {
      authors: resolvedAuthors.sort((left, right) => (left.orderNumber || 1) - (right.orderNumber || 1)),
      sgtAffiliatedAuthors,
      internalCoAuthors,
      foreignCollaborationsCount,
      internationalAuthor,
      hasAmbiguousInternalMatches,
      ownerFound: ownerIndex !== -1,
    };
  }

  /** The owner's entry in a work's author list, or null. */
  _matchOwningFaculty(authors, user, identity) {
    const authorList = Array.isArray(authors) ? authors : [];
    const index = this._findOwnerIndex(authorList, user, identity);
    return index === -1 ? null : authorList[index];
  }

  _findOwnerIndex(authorList, user, identity) {
    if (!Array.isArray(authorList) || authorList.length === 0) return -1;

    // Strongest signals: registry ids.
    const userScopusId = this._normalizeScopusAuthorId(identity?.scopusAuthorId);
    if (userScopusId) {
      const i = authorList.findIndex((a) => this._normalizeScopusAuthorId(a.scopusAuthorId) === userScopusId);
      if (i !== -1) return i;
    }
    const userOrcid = this._normalizeOrcid(identity?.orcid);
    if (userOrcid) {
      const i = authorList.findIndex((a) => this._normalizeOrcid(this._stripOrcidUrl(a.orcid)) === userOrcid);
      if (i !== -1) return i;
    }
    const openAlexIds = this._openAlexIdList(identity?.openAlexAuthorId);
    if (openAlexIds.length > 0) {
      const i = authorList.findIndex((a) => a.openAlexAuthorId && openAlexIds.includes(this._toOpenAlexFilterId(a.openAlexAuthorId)));
      if (i !== -1) return i;
    }
    if (user?.email) {
      const email = user.email.toLowerCase();
      const i = authorList.findIndex((a) => a.email && a.email.toLowerCase() === email);
      if (i !== -1) return i;
    }

    // Name match: accepted only when that entry is not clearly at another institution.
    const ownerName = user?.employeeDetails?.displayName || null;
    if (!ownerName) return -1;
    const byName = authorList
      .map((author, index) => ({ author, index }))
      .filter(({ author }) => this._personNameMatches(author.name, ownerName));
    if (byName.length === 0) return -1;

    const home = byName.filter(({ author }) => this._isHomeInstitutionAuthor(author, null, { owner: true }));
    if (home.length === 1) return home[0].index;
    if (home.length > 1) return -1;

    const unknownAffiliation = byName.filter(({ author }) => !this._hasAffiliationData(author));
    return unknownAffiliation.length === 1 && byName.length === 1 ? unknownAffiliation[0].index : -1;
  }

  _hasAffiliationData(author) {
    return Boolean(
      (author?.affiliation && String(author.affiliation).trim())
      || (Array.isArray(author?.scopusAfids) && author.scopusAfids.length > 0)
    );
  }

  _isSyncDue(identity, now = new Date()) {
    if (!identity?.lastSyncedAt) {
      return true;
    }

    const syncFrequencyDays = Math.max(1, Number(identity.syncFrequencyDays) || 1);
    const threshold = now.getTime() - syncFrequencyDays * 24 * 60 * 60 * 1000;
    return new Date(identity.lastSyncedAt).getTime() <= threshold;
  }

  /**
   * Resolve every author of one paper to internal users with a handful of batched
   * queries (ids, emails, uids, then surnames for home-affiliated names) instead of
   * several queries per author. Returns an array aligned with `authorList`:
   * { user, confidence } | { ambiguous: true } | null.
   */
  async _matchInternalAuthors(authorList, skipIndex = -1) {
    const results = new Array(authorList.length).fill(null);
    if (!this._authorMatchCache) this._authorMatchCache = new Map();
    if (!this._surnameCandidateCache) this._surnameCandidateCache = new Map();
    const userInclude = {
      employeeDetails: true,
      studentLogin: true,
      researchProfileIdentity: { select: { scopusAuthorId: true, orcid: true } },
    };

    const pending = [];
    authorList.forEach((author, index) => {
      if (index === skipIndex) return;
      const key = this._authorMatchKey(author);
      if (this._authorMatchCache.has(key)) {
        results[index] = this._authorMatchCache.get(key);
      } else {
        pending.push({ author, index, key });
      }
    });
    if (pending.length === 0) return results;

    const scopusIds = [...new Set(pending.map(({ author }) => this._normalizeScopusAuthorId(author.scopusAuthorId)).filter(Boolean))];
    const orcids = [...new Set(pending.map(({ author }) => this._normalizeOrcid(this._stripOrcidUrl(author.orcid))).filter(Boolean))];
    const emails = [...new Set(pending.map(({ author }) => this._cleanString(author.email, 256)).filter(Boolean))];
    const uids = [...new Set(pending.map(({ author }) => this._cleanString(author.uid || author.registrationNumber, 64)).filter(Boolean))];

    const safe = (promise) => Promise.resolve(promise).catch((error) => {
      log.warn('Internal author lookup failed', { error: error.message });
      return [];
    });

    const [profiles, byEmail, byUid] = await Promise.all([
      scopusIds.length || orcids.length
        ? safe(this.prisma.researchProfileIdentity.findMany({
          where: {
            OR: [
              ...(scopusIds.length ? [{ scopusAuthorId: { in: scopusIds } }] : []),
              ...(orcids.length ? [{ orcid: { in: orcids } }] : []),
            ],
          },
          include: { user: { include: userInclude } },
        }))
        : [],
      emails.length ? safe(this.prisma.userLogin.findMany({ where: { email: { in: emails } }, include: userInclude })) : [],
      uids.length ? safe(this.prisma.userLogin.findMany({ where: { uid: { in: uids } }, include: userInclude })) : [],
    ]);

    // Name candidates only for home-affiliated authors, fetched once per surname per run.
    const namePending = pending.filter(({ author }) => author.name && this._isAuthorHomeAffiliated(author));
    const surnames = [...new Set(namePending.flatMap(({ author }) => this._surnameCandidates(author.name)))]
      .filter((s) => !this._surnameCandidateCache.has(s));
    if (surnames.length > 0) {
      const rows = await safe(this.prisma.userLogin.findMany({
        where: {
          OR: surnames.map((surname) => ({ employeeDetails: { displayName: { contains: surname, mode: 'insensitive' } } })),
        },
        include: userInclude,
        take: 500,
      }));
      for (const surname of surnames) {
        this._surnameCandidateCache.set(surname, rows.filter((row) =>
          this._nameParts(row.employeeDetails?.displayName).includes(surname)));
      }
    }

    for (const { author, index, key } of pending) {
      let match = null;
      const scopusId = this._normalizeScopusAuthorId(author.scopusAuthorId);
      const orcid = this._normalizeOrcid(this._stripOrcidUrl(author.orcid));
      const profile = profiles.find((p) => (scopusId && p.scopusAuthorId === scopusId) || (orcid && p.orcid === orcid));
      if (profile?.user) match = { user: profile.user, confidence: 1 };

      const email = this._cleanString(author.email, 256);
      if (!match && email) {
        const found = byEmail.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
        if (found) match = { user: found, confidence: 1 };
      }
      const uid = this._cleanString(author.uid || author.registrationNumber, 64);
      if (!match && uid) {
        const found = byUid.find((u) => u.uid === uid);
        if (found) match = { user: found, confidence: 1 };
      }

      // Name matches need a home affiliation on this paper; another institution's
      // affiliation never links an author to one of our users.
      if (!match && author.name && this._isAuthorHomeAffiliated(author)) {
        const pool = new Map();
        this._surnameCandidates(author.name).forEach((surname) => {
          (this._surnameCandidateCache.get(surname) || []).forEach((row) => pool.set(row.id, row));
        });
        const named = [...pool.values()].filter((row) =>
          this._personNameMatches(author.name, row.employeeDetails?.displayName));
        if (named.length === 1) {
          match = { user: named[0], confidence: 0.7 };
        } else if (named.length > 1) {
          const exact = named.filter((row) =>
            this._normalizeName(row.employeeDetails?.displayName) === this._normalizeName(this._stripTitles(author.name)));
          match = exact.length === 1 ? { user: exact[0], confidence: 0.55 } : { ambiguous: true };
        }
      }

      this._authorMatchCache.set(key, match);
      results[index] = match;
    }
    return results;
  }

  /** Single-author convenience wrapper (kept for callers/tests). */
  async _matchInternalAuthor(author) {
    const [match] = await this._matchInternalAuthors([author]);
    return match && match.user ? match : null;
  }

  _authorMatchKey(author) {
    return [
      this._normalizeScopusAuthorId(author.scopusAuthorId) || '',
      this._normalizeOrcid(this._stripOrcidUrl(author.orcid)) || '',
      String(author.email || '').toLowerCase(),
      author.uid || author.registrationNumber || '',
      this._normalizeName(author.name),
      this._isAuthorHomeAffiliated(author) ? 'home' : 'away',
    ].join('|');
  }

  async _buildInternalAuthor(user, author, order) {
    const isStudent = Boolean(user.studentLogin);
    const profileScopus = user.researchProfileIdentity?.scopusAuthorId;
    return {
      uid: user.uid,
      registrationNumber: isStudent ? user.uid : null,
      name: this._cleanString(author.name || user.employeeDetails?.displayName || user.uid, 256),
      email: this._cleanString(author.email || user.email, 256),
      phone: this._cleanString(author.phone || user.employeeDetails?.phoneNumber, 20),
      // An author entry taken from a source keeps the source's affiliation (possibly none):
      // a 2008 paper must not be stamped with the user's current school.
      affiliation: author.affiliation !== undefined
        ? this._cleanString(author.affiliation, 256)
        : this._cleanString(user.employeeDetails?.primarySchool?.facultyName || this._canonicalUniversityName, 256),
      department: this._cleanString(author.department || user.employeeDetails?.primaryDepartment?.departmentName, 256),
      designation: this._cleanString(author.designation || user.employeeDetails?.designation, 256),
      orderNumber: order,
      authorPosition: order,
      isCorresponding: Boolean(author.isCorresponding),
      authorRole: this._deriveAuthorRole(order, Boolean(author.isCorresponding)),
      authorType: isStudent ? 'internal_student' : 'internal_faculty',
      isInternational: false,
      scopusAuthorId:
        this._normalizeScopusAuthorId(author.scopusAuthorId)
        || this._normalizeScopusAuthorId(profileScopus),
    };
  }

  async _discoverCandidates(user, identity, sourceSystems) {
    const byKey = new Map();
    const sourceErrors = [];
    const sourceSkips = [];
    const stats = {};

    const mergeWorks = (works) => {
      for (const work of works) {
        const key = this._candidateKey(work);
        const existing = byKey.get(key);
        byKey.set(key, existing ? this._mergeCandidate(existing, work) : work);
      }
    };

    const collectSource = async (source, shouldFetch, fetcher) => {
      if (!shouldFetch) {
        return;
      }

      try {
        const out = await fetcher();
        const works = Array.isArray(out) ? out : (out?.works || []);
        if (out && !Array.isArray(out)) {
          if (out.skipped) sourceSkips.push({ source, reason: out.skipped });
          if (Array.isArray(out.warnings)) out.warnings.forEach((message) => sourceErrors.push({ source, message }));
          if (out.stats) stats[source] = out.stats;
        }
        mergeWorks(works);
      } catch (error) {
        sourceErrors.push({ source, message: error.message });
        log.warn('Skipping source after fetch failure', {
          userId: user.id,
          source,
          error: error.message,
        });
      }
    };

    await collectSource('orcid', sourceSystems.includes('orcid') && identity.orcid, async () =>
      this._fetchOrcidWorks(identity.orcid)
    );

    await collectSource('scopus', sourceSystems.includes('scopus') && identity.scopusAuthorId, async () =>
      this._fetchScopusWorks(identity.scopusAuthorId, { filterSgtOnly: Boolean(identity.filterSgtOnly) })
    );

    await collectSource('openalex', sourceSystems.includes('openalex'), async () =>
      this._fetchOpenAlexWorks(user, identity, { filterSgtOnly: Boolean(identity.filterSgtOnly) })
    );

    const values = Array.from(byKey.values()).filter((item) => item.title);

    // Works still without an author list (e.g. ORCID records without contributors):
    // take the list from OpenAlex by DOI.
    const authorless = values.filter((item) => (!item.authors || item.authors.length === 0) && item.doi);
    if (authorless.length > 0) {
      await this._mapLimit(authorless, lookupConcurrency(), async (item) => {
        const authors = await this._fetchOpenAlexAuthorsByDoi(item.doi).catch(() => null);
        if (authors && authors.length > 0) {
          item.authors = authors;
          item.authorsSource = 'openalex_doi';
          item.homeInstitutionOnPaper = Boolean(item.homeInstitutionOnPaper || authors.some((a) => this._isAuthorHomeAffiliated(a)));
        }
      });
    }

    values.sort((left, right) => new Date(right.publicationDate || 0).getTime() - new Date(left.publicationDate || 0).getTime());
    return { candidates: values, sourceErrors, sourceSkips, stats };
  }

  async _fetchOrcidWorks(orcid) {
    const headers = this._orcidHeaders();

    const worksResponse = await this._fetchWithRetry(`${DEFAULT_ORCID_BASE_URL}/${encodeURIComponent(orcid)}/works`, { headers }, { source: 'ORCID works' })
      .catch((error) => {
        throw new Error(`ORCID works fetch failed: ${error.message}`);
      });

    if (!worksResponse || !worksResponse.ok) {
      throw new Error(`ORCID works fetch failed (${worksResponse?.status || 'no response'})`);
    }

    const worksJson = await worksResponse.json();
    const groups = Array.isArray(worksJson.group) ? worksJson.group : [];
    const summaries = groups.flatMap((group) => (Array.isArray(group['work-summary']) ? group['work-summary'] : []));
    let detailFailures = 0;

    const works = await this._mapLimit(summaries, lookupConcurrency(), async (summary) => {
      const putCode = summary['put-code'];
      let detail = null;
      if (putCode !== undefined && putCode !== null) {
        try {
          const detailResponse = await this._fetchWithRetry(
            `${DEFAULT_ORCID_BASE_URL}/${encodeURIComponent(orcid)}/work/${putCode}`,
            { headers },
            { source: 'ORCID work' }
          );
          if (detailResponse && detailResponse.ok) {
            detail = await detailResponse.json();
          } else if (detailResponse?.status !== 404) {
            detailFailures += 1;
          }
        } catch (error) {
          detailFailures += 1;
          log.warn('ORCID detail fetch failure', { orcid, putCode, error: error.message });
        }
      }
      return this._mapOrcidWork(summary, detail, orcid);
    });

    return {
      works,
      warnings: detailFailures > 0 ? [`${detailFailures} ORCID work detail(s) could not be fetched`] : [],
      stats: { works: works.length, detailFailures },
    };
  }

  async _fetchScopusWorks(scopusAuthorId, options = {}) {
    if (!process.env.SCOPUS_API_KEY) {
      log.warn('SCOPUS_API_KEY is not configured; skipping Scopus enrichment');
      return { works: [], skipped: 'Scopus API key is not configured' };
    }

    const { filterSgtOnly = false } = options;
    const affiliationIds = Array.from(this._scopusAffiliationIds || []);
    const useAfidFilter = filterSgtOnly && affiliationIds.length > 0;
    let query = `AU-ID(${scopusAuthorId})`;
    // "My university only": constrain Scopus with this university's affiliation ids.
    if (useAfidFilter) {
      const afidClause = affiliationIds.map((id) => `AF-ID(${id})`).join(' OR ');
      query = `AU-ID(${scopusAuthorId}) AND (${afidClause})`;
    }

    const allEntries = [];
    let start = 0;
    // Elsevier Scopus Search API tier limits items per page (often max 25).
    const count = Math.min(
      parseInt(process.env.SCOPUS_SEARCH_PAGE_SIZE || '25', 10) || 25,
      25
    );
    let totalResults = 0;
    // COMPLETE carries author[] with afids; keys without that entitlement get 401/403.
    let view = scopusState.completeViewDenied ? 'STANDARD' : 'COMPLETE';

    for (;;) {
      const params = new URLSearchParams({
        query,
        count: String(count),
        start: String(start),
        view,
      });

      const response = await this._fetchWithRetry(`${DEFAULT_SCOPUS_BASE_URL}/search/scopus?${params.toString()}`, {
        headers: this._scopusHeaders(),
      }, { source: 'Scopus search' }).catch((error) => {
        throw new Error(`Scopus search failed: ${error.message}`);
      });

      if (view === 'COMPLETE' && (response?.status === 401 || response?.status === 403)) {
        scopusState.completeViewDenied = true;
        view = 'STANDARD';
        log.info('Scopus COMPLETE view not permitted for this key; using STANDARD + abstract lookups');
        continue;
      }

      if (!response || !response.ok) {
        let detail = '';
        try {
          const errJson = await response.json();
          detail = errJson?.['service-error']?.status?.statusText
            || errJson?.['service-error']?.status?.statusCode
            || '';
        } catch {
          // ignore parse errors
        }
        const suffix = detail ? `: ${detail}` : '';
        throw new Error(`Scopus search failed (${response?.status || 'no response'})${suffix}`);
      }

      const json = await response.json();
      const searchResults = json?.['search-results'];
      totalResults = parseInt(searchResults?.['opensearch:totalResults'] || '0', 10);

      const entries = searchResults?.entry;
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        break;
      }

      if (entries.length === 1 && entries[0]?.error) {
        log.warn('Scopus returned error entry:', entries[0].error);
        break;
      }

      allEntries.push(...entries);
      start += entries.length;

      if (start >= totalResults || start >= 1000) {
        break;
      }
    }

    const works = allEntries.map((entry) => {
      const mapped = this._mapScopusWork(entry);
      if (useAfidFilter) {
        mapped.trustedHomeInstitutionQuery = true;
        mapped.homeInstitutionOnPaper = true;
      }
      return mapped;
    });

    const stats = await this._enrichScopusAuthors(works);
    return { works, stats: { works: works.length, view, ...stats } };
  }

  /**
   * Fill author lists for Scopus works whose search entry carried none: Abstract
   * Retrieval API first (cached per paper), then OpenAlex by DOI. Works that still
   * have no authors keep an empty list (and are reviewed for it).
   */
  async _enrichScopusAuthors(works) {
    const stats = { authorsFromSearch: 0, authorsFromAbstract: 0, authorsFromOpenAlex: 0, authorsMissing: 0 };
    const missing = [];
    for (const work of works) {
      if (Array.isArray(work.authors) && work.authors.length > 0) {
        work.authorsSource = work.authorsSource || 'scopus_search';
        stats.authorsFromSearch += 1;
      } else {
        missing.push(work);
      }
    }

    await this._mapLimit(missing, lookupConcurrency(), async (work) => {
      const scopusId = this._scopusNumericId(work.externalIds?.scopus);
      let authors = scopusId && scopusAuthorCache.has(scopusId) ? scopusAuthorCache.get(scopusId) : null;
      let via = authors ? 'scopus_abstract' : null;

      if (!authors && scopusId && !scopusState.abstractDenied) {
        authors = await this._fetchScopusAbstractAuthors(scopusId).catch(() => null);
        if (authors && authors.length > 0) {
          via = 'scopus_abstract';
          cacheScopusAuthors(scopusId, authors);
        }
      }
      if ((!authors || authors.length === 0) && work.doi) {
        authors = await this._fetchOpenAlexAuthorsByDoi(work.doi).catch(() => null);
        if (authors && authors.length > 0) via = 'openalex_doi';
      }

      if (authors && authors.length > 0) {
        work.authors = authors;
        work.authorsSource = via;
        work.homeInstitutionOnPaper = Boolean(work.homeInstitutionOnPaper || authors.some((a) => this._isAuthorHomeAffiliated(a)));
        if (via === 'scopus_abstract') stats.authorsFromAbstract += 1;
        else stats.authorsFromOpenAlex += 1;
      } else {
        stats.authorsMissing += 1;
      }
    });
    return stats;
  }

  async _fetchScopusAbstractAuthors(scopusId) {
    for (const view of ['FULL', 'META_ABS']) {
      const response = await this._fetchWithRetry(
        `${DEFAULT_SCOPUS_BASE_URL}/abstract/scopus_id/${encodeURIComponent(scopusId)}?view=${view}`,
        { headers: this._scopusHeaders() },
        { source: 'Scopus abstract' }
      );
      if (response.status === 401 || response.status === 403) {
        if (view === 'META_ABS') scopusState.abstractDenied = true;
        continue;
      }
      if (!response.ok) return null;
      const json = await response.json();
      const authors = this._parseScopusAbstractAuthors(json);
      if (authors.length > 0) return authors;
    }
    return null;
  }

  _parseScopusAbstractAuthors(json) {
    const root = json?.['abstracts-retrieval-response'];
    const authors = this._normalizeScopusAuthorField(root?.authors?.author);
    if (authors.length === 0) return [];
    const entryAffiliations = toArray(root?.affiliation).map((aff) => ({
      afid: aff?.['@id'],
      affilname: aff?.affilname,
      'affiliation-city': aff?.['affiliation-city'],
      'affiliation-country': aff?.['affiliation-country'],
    }));
    const seen = new Set();
    const shaped = [];
    for (const author of authors) {
      const seq = author?.['@seq'];
      if (seq && seen.has(seq)) continue;
      if (seq) seen.add(seq);
      shaped.push({
        '@seq': seq,
        authid: author?.['@auid'],
        authname: author?.['ce:indexed-name'] || author?.['preferred-name']?.['ce:indexed-name'],
        'given-name': author?.['ce:given-name'] || author?.['preferred-name']?.['ce:given-name'],
        surname: author?.['ce:surname'] || author?.['preferred-name']?.['ce:surname'],
        orcid: author?.['@orcid'] || author?.orcid,
        afid: toArray(author?.affiliation).map((aff) => ({ $: aff?.['@id'] })).filter((a) => a.$),
      });
    }
    return this._parseScopusAuthors(shaped, entryAffiliations);
  }

  async _fetchOpenAlexAuthorsByDoi(doi) {
    const clean = normalizeDoi(doi);
    if (!clean) return null;
    const response = await this._fetchWithRetry(`${DEFAULT_OPENALEX_BASE_URL}/works/doi:${clean}`, {
      headers: this._openAlexHeaders(),
    }, { source: 'OpenAlex work' });
    if (!response.ok) return null;
    const work = await response.json();
    return this._parseOpenAlexAuthors(work?.authorships);
  }

  /**
   * OpenAlex works are fetched only for an author resolved from a strong identifier
   * (stored OpenAlex id, ORCID, or Scopus id) — never from the name alone, which
   * imported a namesake's papers. Without one, OpenAlex is skipped for the user.
   */
  async _fetchOpenAlexWorks(user, identity, options = {}) {
    const { filterSgtOnly = false } = options;
    const resolution = await this._resolveOpenAlexAuthorIds(user, identity);
    if (!resolution.ids.length) {
      log.info('OpenAlex skipped: no author resolved from a strong identifier', { userId: user.id, reason: resolution.reason });
      return { works: [], skipped: resolution.reason };
    }

    const institutionId = filterSgtOnly ? await this._findOpenAlexInstitutionId(identity, user) : null;
    const authorFilter = resolution.ids.join('|');
    const allResults = [];
    let page = 1;
    const perPage = 100;
    let totalCount = 0;

    for (;;) {
      const filterParts = [`author.id:${authorFilter}`];
      if (filterSgtOnly && institutionId) {
        filterParts.push(`institutions.id:${this._toOpenAlexFilterId(institutionId)}`);
      }
      const params = new URLSearchParams({
        filter: filterParts.join(','),
        sort: 'publication_date:desc',
        'per-page': String(perPage),
        page: String(page),
      });

      const response = await this._fetchWithRetry(`${DEFAULT_OPENALEX_BASE_URL}/works?${params.toString()}`, {
        headers: this._openAlexHeaders(),
      }, { source: 'OpenAlex works' }).catch((error) => {
        throw new Error(`OpenAlex works fetch failed: ${error.message}`);
      });

      if (!response || !response.ok) {
        throw new Error(`OpenAlex works fetch failed (${response?.status || 'no response'})`);
      }

      const json = await response.json();
      totalCount = json?.meta?.count || 0;
      const results = Array.isArray(json?.results) ? json.results : [];
      if (results.length === 0) {
        break;
      }

      allResults.push(...results);

      if (allResults.length >= totalCount || allResults.length >= 1000) {
        break;
      }

      page += 1;
    }

    // Every imported work must list the resolved author (by OpenAlex id or ORCID).
    const idSet = new Set(resolution.ids);
    const orcid = this._normalizeOrcid(identity?.orcid);
    const verified = allResults.filter((work) => (Array.isArray(work?.authorships) ? work.authorships : []).some((a) =>
      idSet.has(this._toOpenAlexFilterId(a?.author?.id))
      || (orcid && this._normalizeOrcid(this._stripOrcidUrl(a?.author?.orcid)) === orcid)));

    return {
      works: verified.map((work) => this._mapOpenAlexWork(work)),
      stats: { resolvedVia: resolution.via, authorIds: resolution.ids, works: verified.length, droppedNotListingAuthor: allResults.length - verified.length },
    };
  }

  /**
   * @returns {Promise<{ ids: string[], via: string|null, reason: string|null }>}
   */
  async _resolveOpenAlexAuthorIds(user, identity) {
    const orcid = this._normalizeOrcid(identity?.orcid);
    const scopusId = this._normalizeScopusAuthorId(identity?.scopusAuthorId);
    // A stored id is reused while the ORCID/Scopus id it was resolved from is unchanged
    // (ids can be edited elsewhere, e.g. employee bulk upload); an id stored without a
    // source (set by an administrator) is always trusted.
    const stored = this._openAlexIdList(identity?.openAlexAuthorId);
    const resolvedFrom = this._asObject(this._asObject(identity?.identityVerification).openalex).resolvedFrom;
    const storedStillValid = !resolvedFrom
      || (orcid && resolvedFrom === `orcid:${orcid}`)
      || (scopusId && resolvedFrom === `scopus:${scopusId}`);
    if (stored.length > 0 && storedStillValid) return { ids: stored, via: 'stored', reason: null };

    const employeeName = user?.employeeDetails?.displayName || null;
    const attempts = [];
    if (orcid) attempts.push({ via: 'orcid', filter: `orcid:${orcid}`, check: (a) => this._normalizeOrcid(this._stripOrcidUrl(a?.orcid)) === orcid });
    if (scopusId) attempts.push({ via: 'scopus', filter: `scopus:${scopusId}`, check: () => true });

    if (attempts.length === 0) {
      return { ids: [], via: null, reason: 'No ORCID, Scopus or OpenAlex author id on the research profile; OpenAlex is not searched by name.' };
    }

    const reasons = [];
    for (const attempt of attempts) {
      const params = new URLSearchParams({ filter: attempt.filter, 'per-page': '25' });
      const response = await this._fetchWithRetry(`${DEFAULT_OPENALEX_BASE_URL}/authors?${params.toString()}`, {
        headers: this._openAlexHeaders(),
      }, { source: 'OpenAlex authors' }).catch((error) => {
        throw new Error(`OpenAlex author lookup failed: ${error.message}`);
      });
      if (!response.ok) {
        throw new Error(`OpenAlex author lookup failed (${response.status})`);
      }
      const json = await response.json();
      const found = (Array.isArray(json?.results) ? json.results : []).filter((a) => a?.id && attempt.check(a));
      if (found.length === 0) {
        reasons.push(`no OpenAlex author has this ${attempt.via === 'orcid' ? 'ORCID' : 'Scopus id'}`);
        continue;
      }

      let chosen = found;
      if (found.length > 1) {
        // Several OpenAlex profiles claim the id: keep those that are this person.
        chosen = employeeName
          ? found.filter((a) => this._anyNameMatches([a.display_name, ...(a.display_name_alternatives || [])].filter(Boolean), employeeName))
          : [];
        if (chosen.length === 0) {
          reasons.push(`${found.length} OpenAlex authors share this ${attempt.via === 'orcid' ? 'ORCID' : 'Scopus id'} and none matches the employee name`);
          continue;
        }
      }
      const ids = chosen.slice(0, 5).map((a) => this._toOpenAlexFilterId(a.id));
      if (identity?.id && this.prisma.researchProfileIdentity?.update) {
        const source = attempt.via === 'orcid' ? `orcid:${orcid}` : `scopus:${scopusId}`;
        await this.prisma.researchProfileIdentity.update({
          where: { id: identity.id },
          data: {
            openAlexAuthorId: ids.join('|'),
            identityVerification: {
              ...this._asObject(identity.identityVerification),
              openalex: { resolvedFrom: source, ids, checkedAt: new Date().toISOString() },
            },
          },
        }).catch((error) => log.warn('Could not store OpenAlex author id', { error: error.message }));
      }
      return { ids, via: attempt.via, reason: null };
    }

    return { ids: [], via: null, reason: `OpenAlex author not resolved: ${reasons.join('; ')}.` };
  }

  /**
   * The tenant's OpenAlex institution id, only when a search result's name is an
   * exact/high-similarity match for the university (never the first search hit).
   */
  async _findOpenAlexInstitutionId() {
    if (this._openAlexInstCache !== undefined) {
      return this._openAlexInstCache;
    }
    this._openAlexInstCache = null;
    const params = new URLSearchParams({ search: this._canonicalUniversityName, 'per-page': '10' });
    let response;
    try {
      response = await this._fetchWithRetry(`${DEFAULT_OPENALEX_BASE_URL}/institutions?${params.toString()}`, {
        headers: this._openAlexHeaders(),
      }, { source: 'OpenAlex institutions', retries: 1 });
    } catch (error) {
      log.warn('OpenAlex institution search failed', { error: error.message });
      return null;
    }
    if (!response || !response.ok) return null;
    const json = await response.json();
    const institutions = Array.isArray(json?.results) ? json.results : [];
    const match = institutions.find((institution) =>
      [institution?.display_name, ...(institution?.display_name_alternatives || []), ...(institution?.display_name_acronyms || [])]
        .filter(Boolean)
        .some((name) => this._isSgtAffiliation(name)));
    this._openAlexInstCache = match?.id || null;
    return this._openAlexInstCache;
  }

  _mapOrcidWork(summary, detail, ownerOrcid = null) {
    const title = detail?.title?.title?.value || summary?.title?.title?.value || null;
    const bibtexRaw = detail?.citation?.['citation-type'] === 'bibtex' ? detail?.citation?.['citation-value'] : null;
    const journalTitle = detail?.['journal-title']?.value || summary?.['journal-title']?.value
      || this._bibtexField(bibtexRaw, 'journal') || null;
    const { date: publicationDate, precision: datePrecision } = this._orcidDateInfo(detail?.['publication-date'] || summary?.['publication-date']);
    const ids = this._extractOrcidExternalIds(detail?.['external-ids'] || summary?.['external-ids']);
    const doi = normalizeDoi(ids.doi);
    const workType = detail?.type || summary?.type || null;
    const bibtex = bibtexRaw;
    const normalizedOwnerOrcid = this._normalizeOrcid(ownerOrcid);

    const contributors = toArray(detail?.contributors?.contributor)
      .filter((item) => {
        const role = String(item?.['contributor-attributes']?.['contributor-role'] || 'author').toLowerCase();
        return role === 'author' || role === 'co-investigator' || role === 'principal-investigator' || role === '';
      })
      .map((item, index) => {
        const contributorOrcid = this._normalizeOrcid(item?.['contributor-orcid']?.path);
        return {
          name: item?.['credit-name']?.value || `Author ${index + 1}`,
          email: null,
          // ORCID contributor records carry no affiliation.
          affiliation: null,
          orcid: contributorOrcid,
          department: null,
          designation: null,
          isCorresponding: false,
          authorOrder: index + 1,
          isOrcidOwner: Boolean(normalizedOwnerOrcid && contributorOrcid === normalizedOwnerOrcid),
        };
      });
    const editors = toArray(detail?.contributors?.contributor)
      .filter((item) => String(item?.['contributor-attributes']?.['contributor-role'] || '').toLowerCase() === 'editor')
      .map((item) => item?.['credit-name']?.value)
      .filter(Boolean);

    const url = detail?.url?.value || summary?.url?.value || null;

    return this._stripUndefined({
      title,
      abstract: detail?.['short-description'] || null,
      keywords: [],
      doi,
      journalName: journalTitle,
      publicationDate,
      datePrecision,
      issn: this._cleanString(ids.issn, 32),
      isbn: this._cleanString(ids.isbn, 32),
      publisherName: detail?.publisher?.name || null,
      volume: this._cleanString(detail?.['journal-volume']?.value || this._bibtexField(bibtex, 'volume'), 64),
      issue: this._cleanString(detail?.['journal-issue']?.value || this._bibtexField(bibtex, 'number'), 64),
      pageNumbers: this._cleanString(this._bibtexField(bibtex, 'pages'), 64),
      weblink: doi ? `https://doi.org/${doi}` : this._cleanString(url, 512),
      authors: contributors,
      editors: editors.length > 0 ? editors.join(', ') : undefined,
      venue: journalTitle,
      publicationStatus: 'published',
      sourceSystems: ['orcid'],
      externalIds: {
        orcid: String(summary?.['put-code'] || ''),
        ...(doi ? { doi } : {}),
      },
      rawType: workType,
    });
  }

  /** A single field of a BibTeX record, e.g. volume={9} / volume = "9". */
  _bibtexField(bibtex, field) {
    if (!bibtex || typeof bibtex !== 'string') return null;
    const match = bibtex.match(new RegExp(`(?:^|[,\\s])${field}\\s*=\\s*(?:\\{([^{}]*)\\}|"([^"]*)"|(\\d+))`, 'i'));
    if (!match) return null;
    const value = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    return value || null;
  }

  _mapScopusWork(entry) {
    const doi = normalizeDoi(entry?.['prism:doi']);
    const publicationDate = entry?.['prism:coverDate'] || null;
    const subtype = this._cleanString(entry?.subtypeDescription, 128);
    const aggregationType = this._cleanString(entry?.['prism:aggregationType'], 64);
    // Pass the entry-level affiliation array so authors get their country resolved
    const entryAffiliations = toArray(entry?.affiliation);
    const authorNames = this._parseScopusAuthors(entry?.author, entryAffiliations);
    const citationCount = entry?.['citedby-count'] ? parseInt(entry['citedby-count'], 10) : 0;

    // Paper-level home-institution signal: one of this university's Scopus
    // affiliation ids, or an affiliation name that matches it.
    const homeInstitutionOnPaper = entryAffiliations.some((afil) => {
      const afid = String(afil?.['@id'] || afil?.afid || '');
      if (afid && this._scopusAffiliationIds.has(afid)) return true;
      return this._isSgtAffiliation(afil?.affilname || '');
    });

    return this._stripUndefined({
      title: this._cleanString(entry?.['dc:title'], 512),
      doi,
      journalName: this._cleanString(entry?.['prism:publicationName'], 512),
      issn: this._cleanString(entry?.['prism:issn'] || entry?.['prism:eIssn'], 32),
      isbn: this._cleanString(toArray(entry?.['prism:isbn'])[0]?.$ || toArray(entry?.['prism:isbn'])[0], 32),
      volume: this._cleanString(entry?.['prism:volume'], 64),
      issue: this._cleanString(entry?.['prism:issueIdentifier'], 64),
      pageNumbers: this._cleanString(entry?.['prism:pageRange'], 64),
      publicationDate,
      datePrecision: publicationDate ? 'day' : undefined,
      weblink: this._cleanString(this._resolveScopusLink(entry), 512),
      authors: authorNames,
      venue: this._cleanString(entry?.['prism:publicationName'], 512),
      publicationStatus: 'published',
      sourceSystems: ['scopus'],
      externalIds: {
        scopus: this._cleanString(entry?.['dc:identifier'], 191),
        ...(doi ? { doi } : {}),
      },
      indexedIn: 'scopus',
      quartile: this._inferQuartileFromTitle(entry?.['prism:publicationName']),
      rawType: subtype || aggregationType,
      aggregationType,
      abstract: this._cleanString(entry?.['dc:description'], 8000),
      keywords: this._parseKeywordList(entry?.authkeywords),
      citationCount,
      citationsBySource: { scopus: citationCount },
      homeInstitutionOnPaper,
    });
  }

  _mapOpenAlexWork(work) {
    const doi = normalizeDoi(work?.doi || work?.ids?.doi);
    const journalName = this._cleanString(
      work?.primary_location?.source?.display_name || work?.host_venue?.display_name,
      512
    );
    const publicationDate = work?.publication_date
      || (work?.publication_year ? `${work.publication_year}-01-01` : null);
    const keywords = Array.isArray(work?.keywords)
      ? work.keywords.map((item) => item?.display_name).filter(Boolean)
      : Array.isArray(work?.concepts)
        ? work.concepts.map((item) => item?.display_name).filter(Boolean).slice(0, 10)
        : [];
    const citationCount = work?.cited_by_count ? parseInt(work.cited_by_count, 10) : 0;
    const authors = this._parseOpenAlexAuthors(work?.authorships);

    return this._stripUndefined({
      title: this._cleanString(work?.display_name || work?.title, 512),
      doi,
      journalName,
      issn: this._cleanString(
        work?.primary_location?.source?.issn_l
          || (Array.isArray(work?.primary_location?.source?.issn) ? work.primary_location.source.issn[0] : null),
        32
      ),
      volume: this._cleanString(work?.biblio?.volume, 64),
      issue: this._cleanString(work?.biblio?.issue, 64),
      pageNumbers: this._formatPageRange(work?.biblio?.first_page, work?.biblio?.last_page),
      publicationDate,
      datePrecision: work?.publication_date ? 'day' : (work?.publication_year ? 'year' : undefined),
      weblink: doi ? `https://doi.org/${doi}` : this._cleanString(work?.id, 512),
      authors,
      authorsSource: 'openalex',
      venue: journalName,
      publicationStatus: 'published',
      sourceSystems: ['openalex'],
      externalIds: {
        openalex: this._cleanString(work?.id, 191),
        ...(doi ? { doi } : {}),
      },
      rawType: this._cleanString(work?.type_crossref || work?.type, 128),
      sourceKind: this._cleanString(work?.primary_location?.source?.type, 64),
      abstract: this._reconstructOpenAlexAbstract(work?.abstract_inverted_index),
      keywords,
      publisherName: this._cleanString(work?.primary_location?.source?.host_organization_name, 256),
      citationCount,
      citationsBySource: { openalex: citationCount },
      homeInstitutionOnPaper: authors.some((author) => author.isSgtByAfid),
    });
  }

  _mergeCandidate(base, incoming) {
    const merged = {
      ...base,
      ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== null && value !== undefined && value !== '')),
      sourceSystems: Array.from(new Set([...(base.sourceSystems || []), ...(incoming.sourceSystems || [])])),
      externalIds: {
        ...(base.externalIds || {}),
        ...(incoming.externalIds || {}),
      },
      authors: (base.authors && base.authors.length > 0) ? base.authors : incoming.authors,
      authorsSource: (base.authors && base.authors.length > 0) ? base.authorsSource : incoming.authorsSource,
      keywords: (base.keywords && base.keywords.length > 0) ? base.keywords : incoming.keywords,
      homeInstitutionOnPaper: Boolean(base.homeInstitutionOnPaper || incoming.homeInstitutionOnPaper),
      trustedHomeInstitutionQuery: Boolean(base.trustedHomeInstitutionQuery || incoming.trustedHomeInstitutionQuery),
      // Citation counts differ per source: keep the highest, not the last one seen, and each source's own.
      citationCount: Math.max(Number(base.citationCount) || 0, Number(incoming.citationCount) || 0),
      citationsBySource: { ...(base.citationsBySource || {}), ...(incoming.citationsBySource || {}) },
    };

    // Keep the most precise publication date (a full date beats a year-only one).
    const baseRank = DATE_PRECISION_RANK[base.datePrecision] || (base.publicationDate ? 2 : 0);
    const incomingRank = DATE_PRECISION_RANK[incoming.datePrecision] || (incoming.publicationDate ? 2 : 0);
    if (base.publicationDate && baseRank >= incomingRank) {
      merged.publicationDate = base.publicationDate;
      merged.datePrecision = base.datePrecision;
    }

    // Prefer an author list that carries affiliations over one that doesn't.
    const hasAffiliations = (list) => Array.isArray(list) && list.some((a) => a.affiliation || (a.scopusAfids || []).length);
    if (!hasAffiliations(merged.authors) && hasAffiliations(incoming.authors)) {
      merged.authors = incoming.authors;
      merged.authorsSource = incoming.authorsSource;
    }

    return merged;
  }

  _deriveIndexingCategories(candidate) {
    const categories = new Set();
    if ((candidate.sourceSystems || []).includes('scopus') || candidate.indexedIn === 'scopus') {
      categories.add('scopus');
    }
    if (candidate.indexedIn === 'wos' || candidate.indexedIn === 'both') {
      categories.add('scie_wos');
    }
    if (candidate.naasRating && Number(candidate.naasRating) >= 6) {
      categories.add('naas_rating_6_plus');
    }
    if (candidate.impactFactor && Number(candidate.impactFactor) > 20) {
      categories.add('subsidiary_if_above_20');
    }
    // Only the flagship journals themselves: a substring test also caught "Pertanika Journal of
    // Science & Technology", "Applied Sciences", "Cell Reports", "Nature-Inspired Computing", ...
    if (candidate.journalName && FLAGSHIP_JOURNAL_RE.test(String(candidate.journalName).trim())) {
      categories.add('nature_science_lancet_cell_nejm');
    }
    if (candidate.journalName && /(abdc)/i.test(candidate.journalName)) {
      categories.add('abdc_scopus_wos');
    }
    return Array.from(categories);
  }

  _inferPublicationType(candidate) {
    const rawType = String(candidate.rawType || '').toLowerCase().replace(/_/g, '-');
    const aggregation = String(candidate.aggregationType || candidate.sourceKind || '').toLowerCase();
    if (rawType.includes('conference') || rawType.includes('proceedings')) return 'conference_paper';
    if (rawType.includes('book chapter') || rawType.includes('book-chapter') || rawType.includes('chapter')) return 'book_chapter';
    if (rawType.includes('book')) return 'book';
    if (aggregation.includes('conference') || aggregation.includes('proceedings')) return 'conference_paper';
    return 'research_paper';
  }

  _collectMissingFields(publicationType, candidate, indexingCategories, mapped) {
    const missing = [];
    if (!candidate.title) missing.push('title');
    if (!candidate.publicationDate) missing.push('publicationDate');
    if (!candidate.authors || candidate.authors.length === 0) missing.push('authors');
    else if (mapped && mapped.ownerFound === false) missing.push('ownerNotInAuthorList');
    if (publicationType === 'research_paper') {
      if (!candidate.journalName) missing.push('journalName');
      if (indexingCategories.includes('scopus') && !candidate.quartile) missing.push('quartile');
      if (indexingCategories.includes('scopus') && !candidate.sjr) missing.push('sjr');
    }
    if (publicationType === 'conference_paper' && !candidate.conferenceName && !candidate.venue && !candidate.journalName) {
      missing.push('conferenceName');
    }
    if ((publicationType === 'book' || publicationType === 'book_chapter') && !candidate.publisherName) {
      missing.push('publisherName');
    }
    if (mapped?.hasAmbiguousInternalMatches) {
      missing.push('internalAuthorMapping');
    }
    return missing;
  }

  _calculateConfidence(missingFields, mapped) {
    let score = 100;
    score -= missingFields.length * 10;
    if (mapped.hasAmbiguousInternalMatches) {
      score -= 15;
    }
    return Math.max(20, Math.min(score, 100));
  }

  _shouldApplyAutoValue(currentValue, nextValue) {
    if (nextValue === undefined || nextValue === null || nextValue === '') return false;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (Array.isArray(nextValue) && nextValue.length > 0 && Array.isArray(currentValue) && currentValue.length === 0) return true;
    if (typeof nextValue === 'object' && !Array.isArray(nextValue) && !(nextValue instanceof Date)
      && Object.keys(nextValue).length > 0 && (!currentValue || Object.keys(this._asObject(currentValue)).length === 0)) {
      return true;
    }
    return false;
  }

  _normalizeScopusAuthorField(authorField) {
    if (!authorField) return [];
    if (Array.isArray(authorField)) return authorField;
    if (typeof authorField === 'object') return [authorField];
    return [];
  }

  _parseScopusAuthors(authorField, entryAffiliations) {
    const authorList = this._normalizeScopusAuthorField(authorField);
    if (authorList.length === 0) return [];

    // Build a lookup from afid -> { name, city, country } using the entry-level affiliation array.
    // Each author's afid[] array links them to their institution(s).
    const affilMap = {};
    if (Array.isArray(entryAffiliations)) {
      for (const afil of entryAffiliations) {
        const afid = afil?.['@id'] || afil?.afid;
        if (afid) {
          affilMap[String(afid)] = {
            name: this._cleanString(afil?.affilname, 256),
            city: this._cleanString(afil?.['affiliation-city'] || afil?.city, 128),
            country: this._cleanString(afil?.['affiliation-country'] || afil?.country, 64),
          };
        }
      }
    }

    // afid can be a string, object, or array of objects
    const extractAfids = (author) => {
      const raw = author?.afid;
      if (!raw) return [];
      if (typeof raw === 'string') return [raw];
      if (Array.isArray(raw)) return raw.map((item) => (typeof item === 'object' ? item?.['$'] : item)).filter(Boolean);
      if (typeof raw === 'object') return [raw['$'] || raw['afid']].filter(Boolean);
      return [];
    };

    return authorList.map((author, index) => {
      const afids = extractAfids(author).map(String);
      const resolvedAffils = afids.map((afid) => affilMap[afid]).filter(Boolean);

      // Home-affiliated when any afid is one of this university's Scopus affiliation ids.
      const isSgtByAfid = afids.some((afid) => this._scopusAffiliationIds.has(afid));
      const primaryAfil = resolvedAffils[0] || null;
      const affiliationName = resolvedAffils.map((a) => a.name).filter(Boolean).join('; ')
        || this._cleanString(author?.affilname, 256)
        || null;
      const country = primaryAfil?.country || this._cleanString(author?.['affiliation-country'], 64) || null;
      const given = this._cleanString(author?.['given-name'], 128);
      const surname = this._cleanString(author?.surname, 128);

      return {
        name: (given && surname ? `${given} ${surname}` : null)
          || this._cleanString(author?.authname || author?.ce?.['indexed-name'] || surname, 256)
          || `Author ${index + 1}`,
        indexedName: this._cleanString(author?.authname, 256),
        email: null,
        affiliation: affiliationName,
        country,
        city: primaryAfil?.city || null,
        isSgtByAfid,
        scopusAfids: afids,
        department: null,
        designation: null,
        isCorresponding: false,
        authorOrder: Number(author?.['@seq'] || index + 1),
        orcid: this._normalizeOrcid(this._stripOrcidUrl(author?.orcid)),
        // authid is the Scopus Author ID — used for definitive internal-user matching
        scopusAuthorId: this._normalizeScopusAuthorId(author?.authid || author?.['@auid']),
      };
    });
  }

  _parseOpenAlexAuthors(authorships) {
    if (!Array.isArray(authorships)) return [];
    return authorships.map((authorship, index) => {
      const institutions = Array.isArray(authorship?.institutions) ? authorship.institutions : [];
      const primaryInstitution = institutions[0];
      const countryCode = primaryInstitution?.country_code || (authorship?.countries || [])[0] || null;
      const affiliationNames = institutions.map((i) => i?.display_name).filter(Boolean);
      const rawAffiliations = (authorship?.raw_affiliation_strings || []).filter(Boolean);
      const affiliation = this._cleanString(affiliationNames.join('; '), 256)
        || this._cleanString(rawAffiliations.join('; '), 256)
        || null;
      const isSgtByAfid = [...affiliationNames, ...rawAffiliations].some((name) => this._isSgtAffiliation(name));
      return {
        name: this._cleanString(authorship?.author?.display_name || authorship?.raw_author_name, 256) || `Author ${index + 1}`,
        email: null,
        affiliation,
        country: this._cleanString(countryCode, 64),
        department: null,
        designation: null,
        isCorresponding: Boolean(authorship?.is_corresponding),
        authorOrder: index + 1,
        isSgtByAfid,
        openAlexAuthorId: this._toOpenAlexFilterId(authorship?.author?.id),
        orcid: this._normalizeOrcid(this._stripOrcidUrl(authorship?.author?.orcid)),
      };
    });
  }

  /**
   * Build a compact affiliation summary for a candidate's author list.
   * Stored in indexingDetails so the frontend can display it without re-resolving authors.
   */
  _buildAffiliationSummary(candidateAuthors) {
    if (!Array.isArray(candidateAuthors) || candidateAuthors.length === 0) {
      return null;
    }
    const authorDetails = candidateAuthors.map((author) => {
      const isSgt = this._isAuthorHomeAffiliated(author);
      return {
        name: author.name || null,
        affiliation: author.affiliation || null,
        country: author.country || null,
        scopusAuthorId: this._normalizeScopusAuthorId(author.scopusAuthorId) || null,
        isSgtAffiliated: isSgt,
        isInternational: !isSgt && this._isForeignCountry(author.country),
      };
    });
    const sgtCount = authorDetails.filter((a) => a.isSgtAffiliated).length;
    const internationalCount = authorDetails.filter((a) => a.isInternational).length;
    const countries = [...new Set(authorDetails.map((a) => a.country).filter(Boolean))];
    return {
      totalAuthors: authorDetails.length,
      sgtAffiliatedCount: sgtCount,
      externalCount: authorDetails.length - sgtCount,
      internationalCount,
      countries,
      authors: authorDetails,
    };
  }

  _isForeignCountry(country) {
    const value = String(country || '').trim().toLowerCase();
    if (!value) return false;
    const home = this._homeCountry || 'india';
    const homeCodes = home === 'india' ? ['in', 'ind', 'india', 'bharat'] : [home];
    return !homeCodes.includes(value);
  }

  _parseKeywordList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  _extractOrcidExternalIds(externalIds) {
    const entries = Array.isArray(externalIds?.['external-id']) ? externalIds['external-id'] : [];
    return entries.reduce((acc, item) => {
      const type = String(item?.['external-id-type'] || '').toLowerCase();
      const value = this._cleanString(item?.['external-id-value'] || item?.['external-id-normalized']?.value, 191);
      if (!type || !value) return acc;
      if (type === 'doi') acc.doi = value;
      else if (type === 'eid') acc.scopus = value;
      else if (type === 'issn') acc.issn = acc.issn || value;
      else if (type === 'isbn') acc.isbn = acc.isbn || value;
      else acc[type] = value;
      return acc;
    }, {});
  }

  _mapManualImportCandidate(publication, user, sourceSystem, index) {
    const publicationType = this._cleanString(publication?.publicationType, 64)?.toLowerCase();
    const year = Number(publication?.year);
    const normalizedYear = Number.isFinite(year) && year > 1900 ? year : new Date().getFullYear();
    const normalizedTitle = this._cleanString(publication?.title, 512);

    if (!normalizedTitle) {
      const error = new Error('Publication title is required');
      error.statusCode = 400;
      throw error;
    }

    const authorList = Array.isArray(publication?.authors)
      ? publication.authors
      : String(publication?.authors || '')
          .split(/[;,]/)
          .map((author) => author.trim())
          .filter(Boolean)
          .map((name, authorIndex) => ({
            name,
            authorOrder: authorIndex + 1,
            isCorresponding: authorIndex === 0,
          }));

    return {
      title: normalizedTitle,
      abstract: this._cleanString(publication?.abstract, 4000),
      keywords: Array.isArray(publication?.keywords)
        ? publication.keywords.map((keyword) => this._cleanString(keyword, 128)).filter(Boolean)
        : [],
      doi: normalizeDoi(publication?.doi),
      volume: this._cleanString(publication?.volume, 64),
      issue: this._cleanString(publication?.issue, 64),
      pageNumbers: this._cleanString(publication?.pages || publication?.pageNumbers, 64),
      weblink: this._cleanString(publication?.publicationUrl || publication?.weblink, 512),
      journalName: publicationType === 'conference_paper' ? null : this._cleanString(publication?.venue || publication?.journalName, 512),
      conferenceName: publicationType === 'conference_paper' ? this._cleanString(publication?.venue || publication?.conferenceName, 512) : null,
      bookTitle: publicationType === 'book_chapter' ? this._cleanString(publication?.venue || publication?.bookTitle, 512) : null,
      publicationDate: `${normalizedYear}-01-01T00:00:00.000Z`,
      datePrecision: 'year',
      publicationStatus: 'published',
      publicationType: ['research_paper', 'conference_paper', 'book', 'book_chapter'].includes(publicationType)
        ? publicationType
        : 'research_paper',
      rawType: publicationType,
      venue: this._cleanString(publication?.venue, 512),
      citationCount: Number(publication?.citationCount) || 0,
      sourceSystems: [sourceSystem],
      externalIds: {
        [sourceSystem]: this._cleanString(
          publication?.externalId || normalizeDoi(publication?.doi) || `${user.id}-${normalizedYear}-${index}-${normalizedTitle}`,
          191
        ),
      },
      // The uploader is an author of what they upload; without a list, they are the list.
      authors: authorList.length > 0 ? authorList : [{
        name: user.employeeDetails?.displayName || user.uid,
        email: user.email,
        affiliation: user.employeeDetails?.primarySchool?.facultyName || this._canonicalUniversityName,
        authorOrder: 1,
        isCorresponding: true,
      }],
    };
  }

  _openAlexHeaders() {
    const headers = { Accept: 'application/json' };
    if (process.env.OPENALEX_API_KEY) {
      headers['api-key'] = process.env.OPENALEX_API_KEY;
    }
    return headers;
  }

  /** ORCID dates keep their precision; missing month/day default to 01. */
  _orcidDateInfo(publicationDate) {
    const year = publicationDate?.year?.value;
    if (!year) return { date: null, precision: null };
    const month = publicationDate?.month?.value;
    const day = publicationDate?.day?.value;
    const precision = month && day ? 'day' : (month ? 'month' : 'year');
    return {
      date: `${year}-${String(month || '01').padStart(2, '0')}-${String(day || '01').padStart(2, '0')}`,
      precision,
    };
  }

  _orcidDate(publicationDate) {
    return this._orcidDateInfo(publicationDate).date;
  }

  /** "All sources" with Scopus available: Scopus covers the profile on its own. */
  _scopusOnlySync(identity, sourcePreference) {
    return sourcePreference === 'all' && Boolean(identity?.scopusAuthorId && process.env.SCOPUS_API_KEY);
  }

  /**
   * Sources to fetch. An explicit choice (orcid / scopus / openalex) is always honoured. For
   * "all" (the Sync All button and scheduled syncs):
   *   - Scopus author ID and Scopus configured: Scopus only. The profile counts Scopus-indexed
   *     works; ORCID (slow per-work fetch) and OpenAlex (looked up through the ORCID iD) add nothing.
   *   - otherwise: ORCID and Scopus as available, plus OpenAlex when configured.
   */
  _determineSourceSystems(identity, sourcePreference) {
    if (sourcePreference === 'orcid') return ['orcid'];
    if (sourcePreference === 'scopus') return ['scopus'];
    if (sourcePreference === 'openalex') return ['openalex'];
    if (this._scopusOnlySync(identity, sourcePreference)) return ['scopus'];
    const sources = [
      ...(identity.orcid ? ['orcid'] : []),
      ...(identity.scopusAuthorId ? ['scopus'] : []),
    ];
    if (process.env.OPENALEX_API_KEY) {
      sources.push('openalex');
    }
    return Array.from(new Set(sources));
  }

  /** Sources an "all" sync left out because Scopus covers the profile (reported, not failures). */
  _sourcesSkippedForScopus(identity, sourcePreference) {
    if (!this._scopusOnlySync(identity, sourcePreference)) return [];
    const reason = (name) => `Not needed: Scopus covers this profile. Use "Sync ${name}" to fetch it anyway.`;
    return [
      ...(identity.orcid ? [{ source: 'orcid', reason: reason('ORCID') }] : []),
      ...(process.env.OPENALEX_API_KEY ? [{ source: 'openalex', reason: reason('OpenAlex') }] : []),
    ];
  }

  _candidateKey(candidate) {
    const doi = normalizeDoi(candidate.doi);
    if (doi) return `doi:${doi}`;
    const external = Object.values(candidate.externalIds || {}).find(Boolean);
    if (external) return `external:${String(external).toLowerCase()}`;
    return `title:${this._normalizeTitle(candidate.title)}:${candidate.publicationDate ? new Date(candidate.publicationDate).getFullYear() : 'na'}`;
  }

  _authorDedupKey(author) {
    return `${author.userId || ''}|${String(author.email || '').toLowerCase()}|${this._normalizeName(author.name || '')}`;
  }

  _deriveAuthorRole(order, isCorresponding) {
    if (order === 1 && isCorresponding) return 'first_and_corresponding_author';
    if (order === 1) return 'first_author';
    if (isCorresponding) return 'corresponding_author';
    return 'co_author';
  }

  /**
   * Does `value` name this university? (The name is legacy; it is tenant-agnostic
   * and uses the variants loaded by _loadAffiliationContext().)
   */
  _isSgtAffiliation(value) {
    return isAffiliationMatch(value, this._affiliationVariants, this._affiliationOptions);
  }

  /** Home affiliation for a co-author: this university's AF-IDs or name variants only. */
  _isAuthorHomeAffiliated(author) {
    if (!author) return false;
    if (author.isSgtByAfid) return true;
    if (Array.isArray(author.scopusAfids) && author.scopusAfids.some((afid) => this._scopusAffiliationIds.has(String(afid)))) {
      return true;
    }
    return Boolean(author.affiliation) && this._isSgtAffiliation(author.affiliation);
  }

  /**
   * True when the owner's entry on a paper is affiliated with this university:
   * AF-ID hit, or an affiliation segment naming the university (or one of the
   * user's own aliases). The whole affiliation string is evaluated per segment
   * group — never per comma token, so "Amity University, Gurugram" does not
   * match through "Gurugram". Falls back to the paper-level signal only when the
   * author row carries no affiliation data at all.
   */
  _isHomeInstitutionAuthor(author, candidate = null, { owner = true } = {}) {
    if (author?.isSgtByAfid) return true;
    if (author && Array.isArray(author.scopusAfids)
      && author.scopusAfids.some((afid) => this._scopusAffiliationIds.has(String(afid)))) {
      return true;
    }
    if (author?.affiliation && String(author.affiliation).trim()) {
      const variants = owner ? this._ownerAffiliationVariants : this._affiliationVariants;
      return isAffiliationMatch(author.affiliation, variants && variants.length ? variants : this._affiliationVariants, this._affiliationOptions);
    }
    if (author && Array.isArray(author.scopusAfids) && author.scopusAfids.length > 0) return false;
    return Boolean(candidate?.homeInstitutionOnPaper);
  }

  _inferQuartileFromTitle(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('top 1')) return 'Top_1_';
    if (text.includes('top 5')) return 'Top_5_';
    if (text.includes('q1')) return 'Q1';
    if (text.includes('q2')) return 'Q2';
    if (text.includes('q3')) return 'Q3';
    if (text.includes('q4')) return 'Q4';
    return null;
  }

  _normalizeOrcid(orcid) {
    const clean = this._cleanString(orcid, 64);
    if (!clean) return null;
    const bare = this._stripOrcidUrl(clean);
    return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(bare) ? bare.toUpperCase() : null;
  }

  _stripOrcidUrl(value) {
    if (!value) return value;
    return String(value).trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, '');
  }

  _scopusNumericId(value) {
    const match = String(value || '').match(/(\d{6,})/);
    return match ? match[1] : null;
  }

  _resolveScopusLink(entry) {
    const doi = normalizeDoi(entry?.['prism:doi']);
    if (doi) {
      return `https://doi.org/${doi}`;
    }

    if (Array.isArray(entry?.link)) {
      const scopusLinkObj = entry.link.find(
        (lnk) => lnk?.['@ref'] === 'scopus' || lnk?.ref === 'scopus' || lnk?.rel === 'scopus'
      );
      const url = scopusLinkObj?.['@href'] || scopusLinkObj?.href;
      if (url) return url;
    }

    const identifier = entry?.['dc:identifier'] || '';
    const match = identifier.match(/\d+/);
    if (match) {
      return `https://www.scopus.com/inward/record.uri?partnerID=HzOxMe3b&scp=${match[0]}&origin=inward`;
    }

    return entry?.['prism:url'] || null;
  }

  _normalizeScopusAuthorId(value) {
    const clean = this._cleanString(value, 64);
    if (!clean) return null;
    return /^[A-Za-z0-9-]+$/.test(clean) ? clean : null;
  }

  _normalizeTitle(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _stripTitles(value) {
    return this._nameParts(value).join(' ');
  }

  /**
   * Name tokens: diacritics removed, "Last, First" reordered, titles (Dr., Prof.,
   * Mr., …) and degree suffixes dropped, initials split ("T.P." -> t, p).
   */
  _nameParts(value) {
    let text = String(value || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
    if (!text) return [];
    const commaParts = text.split(',').map((part) => part.trim()).filter(Boolean);
    if (commaParts.length === 2 && !/^(ph\.?\s?d|m\.?\s?d|jr|sr)\.?$/i.test(commaParts[1])) {
      text = `${commaParts[1]} ${commaParts[0]}`;
    }
    return text
      .toLowerCase()
      .replace(/[^a-z\s.\-]/g, ' ')
      .split(/[\s.\-]+/)
      .filter(Boolean)
      .filter((token) => !NAME_TITLES.has(token));
  }

  _surnameCandidates(name) {
    return this._nameParts(name).filter((token) => token.length > 2);
  }

  /**
   * Same person? Tolerates initials ("R. Das", "Das R."), "Last, First", titles and
   * small typos in long name parts. Requires a shared surname-like token plus
   * compatible given names; a lone shared surname is not enough.
   */
  _personNameMatches(nameA, nameB) {
    const a = this._nameParts(nameA);
    const b = this._nameParts(nameB);
    if (a.length === 0 || b.length === 0) return false;

    const tokenEq = (x, y) => {
      if (x === y) return true;
      if (x.length >= 6 && y.length >= 6) {
        return this._editDistance(x, y) <= 1;
      }
      return false;
    };
    const compatible = (x, y) => tokenEq(x, y)
      || (x.length === 1 && y.startsWith(x))
      || (y.length === 1 && x.startsWith(y));

    for (const surname of b.filter((t) => t.length > 1)) {
      const ia = a.findIndex((t) => t.length > 1 && tokenEq(t, surname));
      if (ia === -1) continue;
      const restA = a.filter((_, k) => k !== ia);
      const ib = b.indexOf(surname);
      const restB = b.filter((_, k) => k !== ib);
      if (restA.length === 0 && restB.length === 0) return true;
      if (restA.length === 0 || restB.length === 0) continue;
      const [shorter, longer] = restA.length <= restB.length ? [restA, restB] : [restB, restA];
      const used = new Set();
      const allMatch = shorter.every((token) => {
        const j = longer.findIndex((other, k) => !used.has(k) && compatible(token, other));
        if (j === -1) return false;
        used.add(j);
        return true;
      });
      if (allMatch) return true;
    }
    return false;
  }

  _editDistance(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }

  _isSamePersonName(nameA, nameB) {
    if (!nameA || !nameB) return false;

    const normalize = (n) => this._nameParts(n).join(' ')
      .replace(/[^a-z\s]/g, '')
      .replace(/aa+/g, 'a')
      .replace(/ee+/g, 'e')
      .replace(/oo+/g, 'o')
      .split(/\s+/)
      .filter(Boolean);

    const normA = normalize(nameA);
    const normB = normalize(nameB);

    if (normA.length === 0 || normB.length === 0) return false;

    if (normA.join(' ') === normB.join(' ')) return true;

    const isSimilarWord = (w1, w2) => {
      if (w1 === w2) return true;
      if (w1.length === 1 && w2.startsWith(w1)) return true;
      if (w2.length === 1 && w1.startsWith(w2)) return true;
      const dist = this._editDistance(w1, w2);
      const maxLen = Math.max(w1.length, w2.length);
      if (maxLen >= 5 && dist <= 2) return true;
      return false;
    };

    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    // A single shared word ("Das") is not a person match.
    if (shorter.length < 2) return false;

    let matchedParts = 0;
    const usedIndices = new Set();

    shorter.forEach((sPart) => {
      const matchedIdx = longer.findIndex((lPart, idx) => {
        if (usedIndices.has(idx)) return false;
        return isSimilarWord(sPart, lPart);
      });
      if (matchedIdx !== -1) {
        matchedParts++;
        usedIndices.add(matchedIdx);
      }
    });

    return matchedParts === shorter.length;
  }

  _cleanString(value, max = 512) {
    if (value === undefined || value === null) return null;
    const clean = String(value).trim();
    return clean ? clean.substring(0, max) : null;
  }

  _normalizeOpenAlexDoi(value) {
    return normalizeDoi(value);
  }

  _toOpenAlexFilterId(value) {
    const clean = this._cleanString(value, 256);
    if (!clean) return null;
    const match = clean.match(/(?:https?:\/\/openalex\.org\/)?([A-Z]\d+)$/i);
    return match ? match[1].toUpperCase() : clean;
  }

  _openAlexIdList(value) {
    return String(value || '')
      .split(/[|,\s]+/)
      .map((item) => this._toOpenAlexFilterId(item))
      .filter((item) => item && /^A\d+$/.test(item));
  }

  _formatPageRange(firstPage, lastPage) {
    const first = this._cleanString(firstPage, 32);
    const last = this._cleanString(lastPage, 32);
    if (first && last) return `${first}-${last}`;
    return first || last || null;
  }

  _reconstructOpenAlexAbstract(abstractIndex) {
    if (!abstractIndex || typeof abstractIndex !== 'object' || Array.isArray(abstractIndex)) {
      return null;
    }

    const words = [];
    for (const [word, positions] of Object.entries(abstractIndex)) {
      if (!Array.isArray(positions)) continue;
      for (const position of positions) {
        words[position] = word;
      }
    }

    const abstract = words.filter(Boolean).join(' ').trim();
    return abstract || null;
  }

  _deepEqual(a, b) {
    const stable = (value) => {
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.map(stable);
      if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((acc, key) => {
          if (value[key] !== undefined) acc[key] = stable(value[key]);
          return acc;
        }, {});
      }
      return value;
    };
    return JSON.stringify(stable(a ?? null)) === JSON.stringify(stable(b ?? null));
  }

  _stripUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
  }

  _asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    return {};
  }
}

PublicationSyncService._scopusState = scopusState;
PublicationSyncService._scopusAuthorCache = scopusAuthorCache;

module.exports = PublicationSyncService;
