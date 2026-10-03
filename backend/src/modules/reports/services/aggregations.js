/**
 * @module reports/services/aggregations
 * @description Pure functions that turn loaded rows into NAAC / NIRF tables.
 * No I/O here: everything is unit-tested with plain objects.
 */
const { yearOf, yearLabel, fyStartOf, toIst } = require('../utils/period');

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(typeof v === 'object' && typeof v.toString === 'function' ? v.toString() : v);
  return Number.isFinite(n) ? n : null;
};

const isoDate = (value) => {
  const d = toIst(value);
  return d ? d.toISOString().slice(0, 10) : '';
};

const clean = (s) => (s === null || s === undefined ? '' : String(s).trim());

const emptyCounts = (years) => Object.fromEntries(years.map((y) => [y, 0]));

// ─── Publications ──────────────────────────────────────────────────────────────

/** Publication date, else conference date for conference papers. */
const effectiveDate = (c) => c.publicationDate || (c.publicationType === 'conference_paper' ? c.conferenceDate : null) || null;

/** Indexing databases a paper is in: subset of scopus / wos / pubmed (from all recorded sources). */
const classifyIndexing = (c) => {
  const out = new Set();
  const cats = Array.isArray(c.indexingCategories) ? c.indexingCategories : [];
  for (const cat of cats) {
    const k = String(cat).toLowerCase();
    if (k.includes('scopus')) out.add('scopus');
    if (k.includes('wos') || k.includes('scie')) out.add('wos');
    if (k.includes('pubmed')) out.add('pubmed');
  }
  const free = [clean(c.indexedIn), ...(Array.isArray(c.sourceSystems) ? c.sourceSystems : [])];
  const details = c.indexingDetails && typeof c.indexingDetails === 'object' ? c.indexingDetails : {};
  if (Array.isArray(details.sourceSystems)) free.push(...details.sourceSystems);
  for (const s of free) {
    const k = String(s || '').toLowerCase();
    if (!k) continue;
    if (k.includes('scopus')) out.add('scopus');
    if (k.includes('wos') || k.includes('web of science') || k.includes('scie') || k.includes('ssci')) out.add('wos');
    if (k.includes('pubmed') || k.includes('medline')) out.add('pubmed');
  }
  return out;
};

/** Citation count recorded by publication sync, or null when unknown. */
const citationCountOf = (c) => {
  const d = c.indexingDetails && typeof c.indexingDetails === 'object' ? c.indexingDetails : null;
  if (!d) return null;
  const raw = d.citationCount ?? d.citations;
  const n = toNum(raw);
  return n === null || n < 0 ? null : n;
};

const ugcCareFlag = (c) => (c.ugcCareListed === true ? 'Y' : c.ugcCareListed === false ? 'N' : 'Unknown');

const doiLink = (c) => {
  const doi = clean(c.doi || c.paperDoi);
  if (doi) return /^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi.replace(/^doi:\s*/i, '')}`;
  return clean(c.weblink || c.paperweblink);
};

const authorNames = (c) => (c.authors || []).map((a) => clean(a.name)).filter(Boolean).join('; ');

/** Internal authors who are teachers (faculty) in the teacher map, de-duplicated. */
const teacherAuthors = (c, teacherMap) => {
  const seen = new Set();
  const out = [];
  for (const a of c.authors || []) {
    if (!a.userId || seen.has(a.userId) || !teacherMap.has(a.userId)) continue;
    seen.add(a.userId);
    out.push(teacherMap.get(a.userId));
  }
  // An applicant who is a teacher but missing from the author list still owns the work.
  if (out.length === 0 && c.applicantUserId && teacherMap.has(c.applicantUserId)) out.push(teacherMap.get(c.applicantUserId));
  return out;
};

const departmentOfTeachers = (c, teachers) => {
  const names = [...new Set(teachers.map((t) => t.department).filter(Boolean))];
  return names.length ? names.join('; ') : clean(c.department?.departmentName);
};

/**
 * NAAC 3.3.1 rows: journal papers (research_paper) in the year range.
 * basis: 'calendar' (NAAC default) or 'academic'.
 */
const buildPaperRows = (contributions, teacherMap, { years, basis = 'calendar' }) => {
  const inRange = new Set(years);
  const rows = [];
  for (const c of contributions) {
    if (c.publicationType !== 'research_paper') continue;
    const year = yearOf(effectiveDate(c), basis);
    if (year === null || !inRange.has(year)) continue;
    const teachers = teacherAuthors(c, teacherMap);
    rows.push({
      id: c.id,
      year,
      yearLabel: basis === 'calendar' ? year : yearLabel(year, basis),
      title: clean(c.title),
      authors: authorNames(c),
      department: departmentOfTeachers(c, teachers),
      journal: clean(c.journalName),
      issn: clean(c.issn || c.issnIsbnIssueNo),
      ugcCare: ugcCareFlag(c),
      ugcCareGroup: clean(c.ugcCareGroup),
      link: doiLink(c),
      teacherIds: teachers.map((t) => t.userId),
    });
  }
  return rows;
};

const BOOK_KIND = { book: 'Book', book_chapter: 'Book chapter', conference_paper: 'Conference proceedings paper' };

const nationalInternational = (c) => {
  const v = clean(c.nationalInternational || c.conferenceType).toLowerCase();
  if (v.startsWith('inter')) return 'International';
  if (v.startsWith('nat')) return 'National';
  return v ? clean(c.nationalInternational || c.conferenceType) : '';
};

/**
 * NAAC 3.3.2 rows: books, chapters in edited volumes and papers in conference proceedings.
 * Conference records that are talks/organiser roles (not papers) are excluded.
 */
const buildBookRows = (contributions, teacherMap, { years, basis = 'calendar', universityName = '' }) => {
  const inRange = new Set(years);
  const rows = [];
  for (const c of contributions) {
    if (!BOOK_KIND[c.publicationType]) continue;
    if (c.publicationType === 'conference_paper' && /keynote|organizer|invited/i.test(clean(c.conferenceSubType))) continue;
    const year = yearOf(effectiveDate(c), basis);
    if (year === null || !inRange.has(year)) continue;
    const teachers = teacherAuthors(c, teacherMap);
    const isConf = c.publicationType === 'conference_paper';
    const isChapter = c.publicationType === 'book_chapter';
    rows.push({
      id: c.id,
      year,
      yearLabel: basis === 'calendar' ? year : yearLabel(year, basis),
      kind: BOOK_KIND[c.publicationType],
      teacher: teachers.map((t) => t.name).join('; ') || authorNames(c),
      bookOrChapterTitle: isConf ? '' : clean(isChapter ? c.title : c.bookTitle || c.title),
      bookTitle: isChapter ? clean(c.bookTitle) : '',
      paperTitle: isConf ? clean(c.title) : '',
      proceedingsTitle: isConf ? clean(c.proceedingsTitle || c.conferenceName) : '',
      conferenceName: isConf ? clean(c.conferenceName) : '',
      nationalInternational: nationalInternational(c),
      isbn: clean(c.isbn || c.issn || c.issnIsbnIssueNo),
      affiliatingInstitute: universityName ? `Yes (${universityName})` : 'Yes',
      publisher: clean(c.publisherName),
      teacherIds: teachers.map((t) => t.userId),
    });
  }
  return rows;
};

/**
 * Count items per teacher per year. Each row carries `teacherIds` and `year`; a row with
 * several teacher co-authors counts once for each of them (NAAC counts per teacher).
 * Returns teacher rows sorted by total desc, plus how many rows had no teacher author.
 */
const perTeacherCounts = (rows, teachers, years) => {
  const byId = new Map(teachers.map((t) => [t.userId, { teacher: t, counts: emptyCounts(years), total: 0 }]));
  let unattributed = 0;
  for (const row of rows) {
    if (!row.teacherIds || row.teacherIds.length === 0) {
      unattributed += 1;
      continue;
    }
    for (const id of row.teacherIds) {
      const entry = byId.get(id);
      if (!entry || entry.counts[row.year] === undefined) continue;
      entry.counts[row.year] += 1;
      entry.total += 1;
    }
  }
  const list = [...byId.values()].sort((a, b) => b.total - a.total || a.teacher.name.localeCompare(b.teacher.name));
  return { rows: list, unattributed };
};

/**
 * Teachers in post during each year: active today and joined on/before the year's end
 * (a missing join date counts as always in post). Exit dates are not tracked.
 */
const teachersPerYear = (teachers, years, basis = 'calendar') => {
  const out = {};
  for (const y of years) {
    out[y] = teachers.filter((t) => {
      if (!t.isActive) return false;
      if (!t.joinDate) return true;
      const joined = yearOf(t.joinDate, basis);
      return joined === null || joined <= y;
    }).length;
  }
  return out;
};

/** Per year: unique items and items per teacher (2 dp). */
const yearTotals = (rows, years, teacherCounts) =>
  years.map((y) => {
    const count = rows.filter((r) => r.year === y).length;
    const t = teacherCounts[y] || 0;
    return { year: y, count, teachers: t, perTeacher: t ? Math.round((count / t) * 100) / 100 : null };
  });

// ─── Grants ────────────────────────────────────────────────────────────────────

const AGENCY_LABELS = { dst: 'DST', dbt: 'DBT', anrf: 'ANRF (formerly SERB)', csir: 'CSIR', icssr: 'ICSSR', other: 'Other' };

const agencyName = (g) => clean(g.fundingAgencyName) || AGENCY_LABELS[g.fundingAgencyType] || '';

const grantType = (g) => (g.projectCategory === 'govt' ? 'Government' : g.projectCategory ? 'Non-Government' : '');

/** A DRD-approved record is an awarded project unless it is still only a proposal at the agency. */
const isAwarded = (g) =>
  g.projectStatus === 'approved' || !!g.sanctionDate || toNum(g.sanctionedAmount) !== null || (g.fundReceipts || []).length > 0;

/** Year-of-award date and where it came from. */
const awardDate = (g) => {
  if (g.sanctionDate) return { date: g.sanctionDate, source: 'sanction date' };
  if (g.projectStartDate) return { date: g.projectStartDate, source: 'project start date (no sanction date)' };
  if (g.approvedAt) return { date: g.approvedAt, source: 'DRD approval date (no sanction or start date)' };
  return { date: null, source: 'no date' };
};

/** Sanctioned amount and where it came from. */
const awardAmount = (g) => {
  const sanctioned = toNum(g.sanctionedAmount);
  if (sanctioned !== null) return { amount: sanctioned, source: 'sanctioned' };
  const submitted = toNum(g.submittedAmount);
  if (submitted !== null) return { amount: submitted, source: 'submitted (no sanctioned amount)' };
  return { amount: null, source: 'missing' };
};

const durationText = (g) => {
  let months = g.projectDurationMonths;
  if (!months && g.projectStartDate && g.projectEndDate) {
    const s = toIst(g.projectStartDate);
    const e = toIst(g.projectEndDate);
    if (s && e && e > s) months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) || 1;
  }
  if (!months) return '';
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? '' : 's'}`;
  return `${months} months`;
};

const investigatorText = (g) => {
  const inv = g.investigators || [];
  const pis = inv.filter((i) => i.roleType === 'pi').map((i) => clean(i.name)).filter(Boolean);
  const copis = inv.filter((i) => i.roleType === 'co_pi').map((i) => clean(i.name)).filter(Boolean);
  if (pis.length === 0) {
    const e = g.applicantUser?.employeeDetails;
    const applicant = e ? clean(e.displayName || [e.firstName, e.lastName].filter(Boolean).join(' ')) : '';
    if (applicant) pis.push(applicant);
  }
  return [pis.length ? `PI: ${pis.join(', ')}` : '', copis.length ? `Co-PI: ${copis.join(', ')}` : ''].filter(Boolean).join('; ');
};

const piDepartment = (g, teacherMap) => {
  const pi = (g.investigators || []).find((i) => i.roleType === 'pi');
  if (pi?.userId && teacherMap.has(pi.userId) && teacherMap.get(pi.userId).department) return teacherMap.get(pi.userId).department;
  return clean(pi?.department) || clean(g.department?.departmentName);
};

/** NAAC 3.1.1 rows: awarded grants whose award falls in the (academic) years. */
const buildGrantRows = (grants, teacherMap, { years, basis = 'academic' }) => {
  const inRange = new Set(years);
  const rows = [];
  for (const g of grants) {
    if (!isAwarded(g)) continue;
    const award = awardDate(g);
    const year = yearOf(award.date, basis);
    if (year === null || !inRange.has(year)) continue;
    const amt = awardAmount(g);
    const notes = [];
    if (award.source !== 'sanction date') notes.push(`Year from ${award.source}`);
    if (amt.source !== 'sanctioned') notes.push(amt.amount === null ? 'No amount recorded' : 'Amount is the submitted amount');
    rows.push({
      id: g.id,
      year,
      yearLabel: basis === 'calendar' ? year : yearLabel(year, basis),
      title: clean(g.title),
      investigators: investigatorText(g),
      department: piDepartment(g, teacherMap),
      agency: agencyName(g),
      type: grantType(g),
      amount: amt.amount,
      amountSource: amt.source,
      dateSource: award.source,
      duration: durationText(g),
      sanctionOrderNumber: clean(g.sanctionOrderNumber),
      notes: notes.join('; '),
    });
  }
  return rows.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
};

/**
 * Money received per financial year for each awarded grant.
 *  - Grants with fund receipts: sum of receipts per FY (bucketed by received date).
 *  - Grants without receipts: the sanctioned (else submitted) amount placed in the award FY,
 *    flagged as a fallback.
 * Returns rows that have money in at least one requested year, and per-year totals.
 */
const buildFundingByYear = (grants, { years }) => {
  const inRange = new Set(years);
  const rows = [];
  for (const g of grants) {
    if (!isAwarded(g)) continue;
    const perYear = emptyCounts(years);
    let basis;
    const receipts = g.fundReceipts || [];
    if (receipts.length > 0) {
      basis = 'receipts';
      for (const r of receipts) {
        const fy = fyStartOf(r.receivedDate);
        const amt = toNum(r.amount);
        if (fy !== null && inRange.has(fy) && amt !== null) perYear[fy] += amt;
      }
    } else {
      const amt = awardAmount(g);
      const fy = fyStartOf(awardDate(g).date);
      basis = amt.source === 'sanctioned' ? 'sanctioned_fallback' : amt.amount === null ? 'missing' : 'submitted_fallback';
      if (fy !== null && inRange.has(fy) && amt.amount !== null) perYear[fy] += amt.amount;
    }
    const total = Object.values(perYear).reduce((s, v) => s + v, 0);
    if (total <= 0) continue;
    rows.push({
      id: g.id,
      title: clean(g.title),
      agency: agencyName(g),
      type: grantType(g),
      perYear,
      total,
      basis,
      isFallback: basis !== 'receipts',
    });
  }
  const totals = emptyCounts(years);
  const fallbackTotals = emptyCounts(years);
  for (const r of rows) {
    for (const y of years) {
      totals[y] += r.perYear[y];
      if (r.isFallback) fallbackTotals[y] += r.perYear[y];
    }
  }
  return { rows, totals, fallbackTotals };
};

/** NIRF sponsored research per FY: projects receiving money, distinct agencies, amount. */
const sponsoredResearchByFy = (funding, years) =>
  years.map((y) => {
    const active = funding.rows.filter((r) => r.perYear[y] > 0);
    return {
      year: y,
      projects: active.length,
      agencies: new Set(active.map((r) => r.agency.toLowerCase()).filter(Boolean)).size,
      amount: funding.totals[y],
      fallbackAmount: funding.fallbackTotals[y],
      fallbackProjects: active.filter((r) => r.isFallback).length,
    };
  });

// ─── Patents ───────────────────────────────────────────────────────────────────

const FILED_STATUSES = new Set(['govt_application_filed', 'published', 'completed', 'under_finance_review', 'finance_approved', 'finance_rejected', 'govt_rejected']);

/** Patents filed / published / granted per year (by the event's own date). */
const patentCounts = (patents, years, basis = 'financial') => {
  const out = Object.fromEntries(years.map((y) => [y, { filed: 0, published: 0, granted: 0 }]));
  for (const p of patents) {
    for (const [key, date] of [['filed', p.govtFilingDate], ['published', p.publicationDate], ['granted', p.grantedAt]]) {
      const y = yearOf(date, basis);
      if (y !== null && out[y]) out[y][key] += 1;
    }
  }
  return years.map((y) => ({ year: y, ...out[y] }));
};

/** Patent records whose status implies an event but whose date is missing. */
const patentGaps = (patents) => ({
  filedByStatus: patents.filter((p) => FILED_STATUSES.has(p.status)).length,
  filedWithoutDate: patents.filter((p) => FILED_STATUSES.has(p.status) && !p.govtFilingDate).length,
  publishedWithoutDate: patents.filter((p) => p.status === 'published' && !p.publicationDate).length,
  grantedWithoutNumber: patents.filter((p) => p.grantedAt && !clean(p.patentNumber)).length,
  total: patents.length,
  granted: patents.filter((p) => p.grantedAt).length,
});

// ─── PhD ───────────────────────────────────────────────────────────────────────

const phdStartDate = (s) => s.phdRegistrationDate || s.admissionDate || null;

/**
 * Per FY: doctoral students enrolled at the FY end (registered by then and not yet awarded;
 * students marked inactive without an award date are excluded as they left), and students
 * awarded during the FY.
 */
const phdCounts = (students, years) =>
  years.map((y) => {
    let enrolled = 0;
    let graduated = 0;
    for (const s of students) {
      const awardedFy = fyStartOf(s.phdAwardedAt);
      if (awardedFy === y) graduated += 1;
      const startFy = fyStartOf(phdStartDate(s));
      if (startFy === null || startFy > y) continue;
      if (awardedFy !== null && awardedFy <= y) continue;
      if (awardedFy === null && s.isActive === false) continue;
      enrolled += 1;
    }
    return { year: y, enrolled, graduated };
  });

const phdGaps = (students) => ({
  total: students.length,
  withoutStartDate: students.filter((s) => !phdStartDate(s)).length,
  withoutRegistrationDate: students.filter((s) => !s.phdRegistrationDate).length,
  awarded: students.filter((s) => s.phdAwardedAt).length,
  inactiveWithoutAward: students.filter((s) => s.isActive === false && !s.phdAwardedAt).length,
});

// ─── NIRF publications ─────────────────────────────────────────────────────────

/** Journal + conference papers per year by indexing database, with citation coverage. */
const publicationsByIndexing = (contributions, years, basis = 'financial') => {
  const out = Object.fromEntries(
    years.map((y) => [y, { year: y, total: 0, scopus: 0, wos: 0, pubmed: 0, others: 0, citations: 0, withCitations: 0 }])
  );
  for (const c of contributions) {
    if (c.publicationType !== 'research_paper' && c.publicationType !== 'conference_paper') continue;
    const y = yearOf(effectiveDate(c), basis);
    if (y === null || !out[y]) continue;
    const row = out[y];
    const idx = classifyIndexing(c);
    row.total += 1;
    if (idx.has('scopus')) row.scopus += 1;
    if (idx.has('wos')) row.wos += 1;
    if (idx.has('pubmed')) row.pubmed += 1;
    if (idx.size === 0) row.others += 1;
    const cites = citationCountOf(c);
    if (cites !== null) {
      row.citations += cites;
      row.withCitations += 1;
    }
  }
  return years.map((y) => out[y]);
};

// ─── Data quality ──────────────────────────────────────────────────────────────

const paperQuality = (paperRows) => ({
  total: paperRows.length,
  ugcKnown: paperRows.filter((r) => r.ugcCare !== 'Unknown').length,
  ugcListed: paperRows.filter((r) => r.ugcCare === 'Y').length,
  withoutIssn: paperRows.filter((r) => !r.issn).length,
  withoutLink: paperRows.filter((r) => !r.link).length,
  withoutTeacher: paperRows.filter((r) => r.teacherIds.length === 0).length,
});

const grantQuality = (grantRows) => ({
  total: grantRows.length,
  withSanctionedAmount: grantRows.filter((r) => r.amountSource === 'sanctioned').length,
  withSanctionDate: grantRows.filter((r) => r.dateSource === 'sanction date').length,
  amountFallback: grantRows.filter((r) => r.amountSource !== 'sanctioned').length,
  dateFallback: grantRows.filter((r) => r.dateSource !== 'sanction date').length,
  totalAmount: grantRows.reduce((s, r) => s + (r.amount || 0), 0),
});

module.exports = {
  toNum,
  isoDate,
  effectiveDate,
  classifyIndexing,
  citationCountOf,
  ugcCareFlag,
  doiLink,
  teacherAuthors,
  buildPaperRows,
  buildBookRows,
  perTeacherCounts,
  teachersPerYear,
  yearTotals,
  agencyName,
  grantType,
  isAwarded,
  awardDate,
  awardAmount,
  durationText,
  buildGrantRows,
  buildFundingByYear,
  sponsoredResearchByFy,
  patentCounts,
  patentGaps,
  phdCounts,
  phdGaps,
  publicationsByIndexing,
  paperQuality,
  grantQuality,
};
