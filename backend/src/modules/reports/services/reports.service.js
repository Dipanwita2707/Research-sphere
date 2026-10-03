/**
 * @module reports/services/reports
 * @description NAAC Criterion 3 and NIRF research exports + JSON summary.
 * Runs inside the request's tenant context; the university is taken from that context.
 */
const tenantContext = require('../../../shared/tenancy/tenantContext');
const data = require('./reportData.service');
const agg = require('./aggregations');
const { buildNaacWorkbook } = require('./naacWorkbook');
const { buildNirfWorkbook } = require('./nirfWorkbook');
const { ReportParamError, fyLabel } = require('../utils/period');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Current tenant's university, or a 400 when a superadmin has not selected one. */
const resolveUniversity = async () => {
  const universityId = tenantContext.getTenantId();
  if (!universityId) throw new ReportParamError('Select a university before generating accreditation reports');
  const university = await data.loadUniversity(universityId);
  if (!university) throw new ReportParamError('University not found');
  return university;
};

const teacherMapOf = (teachers) => new Map(teachers.map((t) => [t.userId, t]));

/** Everything the NAAC workbook and the NAAC half of the summary need. */
const buildNaacDataset = async ({ fromYear, toYear, years, paperBasis = 'calendar' }, university) => {
  const [teachers, contributions, grants] = await Promise.all([
    data.loadTeachers(),
    data.loadContributions(data.windowFor(fromYear, toYear)),
    data.loadGrants(),
  ]);
  const teacherMap = teacherMapOf(teachers);
  const universityName = university.name;
  const paperRows = agg.buildPaperRows(contributions.rows, teacherMap, { years, basis: paperBasis });
  const bookRows = agg.buildBookRows(contributions.rows, teacherMap, { years, basis: paperBasis, universityName });
  const grantRows = agg.buildGrantRows(grants, teacherMap, { years, basis: 'academic' });
  const funding = agg.buildFundingByYear(grants, { years });
  const teacherCounts = agg.teachersPerYear(teachers, years, paperBasis);
  return {
    university,
    generatedAt: new Date(),
    years,
    paperBasis,
    grantBasis: 'academic',
    teachers,
    paperRows,
    bookRows,
    grantRows,
    funding,
    paperPerTeacher: agg.perTeacherCounts(paperRows, teachers, years),
    bookPerTeacher: agg.perTeacherCounts(bookRows, teachers, years),
    paperTotals: agg.yearTotals(paperRows, years, teacherCounts),
    bookTotals: agg.yearTotals(bookRows, years, teacherCounts),
    paperQuality: agg.paperQuality(paperRows),
    grantQuality: agg.grantQuality(grantRows),
    excludedProposals: grants.filter((g) => !agg.isAwarded(g)).length,
    undated: contributions.undated,
  };
};

/** Everything the NIRF workbook and the NIRF half of the summary need. */
const buildNirfDataset = async ({ starts }, university) => {
  const first = starts[0];
  const last = starts[starts.length - 1];
  const calendarYears = Array.from({ length: last - first + 2 }, (_, i) => first + i);
  const [contributions, grants, patents, students, expertise] = await Promise.all([
    data.loadContributions(data.windowFor(first, last + 1)),
    data.loadGrants(),
    data.loadPatents(),
    data.loadPhdStudents(),
    data.loadExpertiseTotals(),
  ]);
  const funding = agg.buildFundingByYear(grants, { years: starts });
  return {
    university,
    generatedAt: new Date(),
    fyStarts: starts,
    publications: agg.publicationsByIndexing(contributions.rows, starts, 'financial'),
    patentsFy: agg.patentCounts(patents, starts, 'financial'),
    patentsCy: agg.patentCounts(patents, calendarYears, 'calendar'),
    patentGaps: agg.patentGaps(patents),
    funding,
    sponsored: agg.sponsoredResearchByFy(funding, starts),
    phd: agg.phdCounts(students, starts),
    phdGaps: agg.phdGaps(students),
    expertise,
    undated: contributions.undated,
  };
};

const safeCode = (code) => String(code || 'UNIV').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'UNIV';

const generateNaacWorkbook = async (params) => {
  const university = await resolveUniversity();
  const dataset = await buildNaacDataset(params, university);
  const wb = buildNaacWorkbook(dataset);
  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `NAAC-Criterion3-${safeCode(university.code)}-${params.fromYear}-${params.toYear}.xlsx`,
    mime: XLSX_MIME,
  };
};

const generateNirfWorkbook = async (params) => {
  const university = await resolveUniversity();
  const dataset = await buildNirfDataset(params, university);
  const wb = buildNirfWorkbook(dataset);
  const buffer = await wb.xlsx.writeBuffer();
  const span = params.starts.length === 1 ? fyLabel(params.starts[0]) : `${fyLabel(params.starts[0])}-to-${fyLabel(params.starts[params.starts.length - 1])}`;
  return {
    buffer: Buffer.from(buffer),
    filename: `NIRF-Research-${safeCode(university.code)}-${span}.xlsx`,
    mime: XLSX_MIME,
  };
};

const ratio = (known, total) => ({ known, total, percent: total ? Math.round((known / total) * 1000) / 10 : null });

/** JSON preview for the reports page: counts per section and data completeness. */
const getSummary = async (naacParams, nirfParams) => {
  const university = await resolveUniversity();
  const [naac, nirf] = await Promise.all([buildNaacDataset(naacParams, university), buildNirfDataset(nirfParams, university)]);

  const pq = naac.paperQuality;
  const gq = naac.grantQuality;
  const fundingFallback = naac.funding.rows.filter((r) => r.isFallback).length;
  const pubTotal = nirf.publications.reduce((s, r) => s + r.total, 0);
  const pubWithCites = nirf.publications.reduce((s, r) => s + r.withCitations, 0);
  const nirfFundingFallback = nirf.funding.rows.filter((r) => r.isFallback).length;
  const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

  return {
    university: { name: university.name, code: university.code },
    generatedAt: new Date().toISOString(),
    naac: {
      fromYear: naacParams.fromYear,
      toYear: naacParams.toYear,
      paperBasis: naac.paperBasis,
      teachers: {
        total: naac.teachers.length,
        active: naac.teachers.filter((t) => t.isActive).length,
        perYear: naac.paperTotals.map((t) => ({ year: t.year, teachers: t.teachers })),
      },
      grants: {
        count: gq.total,
        totalSanctioned: gq.totalAmount,
        receivedTotal: Object.values(naac.funding.totals).reduce((s, v) => s + v, 0),
        fundingRows: naac.funding.rows.length,
        fundingFallbackRows: fundingFallback,
        excludedProposals: naac.excludedProposals,
      },
      papers: {
        count: pq.total,
        ugcCareListed: pq.ugcListed,
        perYear: naac.paperTotals,
        withoutTeacher: pq.withoutTeacher,
      },
      booksChapters: {
        count: naac.bookRows.length,
        books: naac.bookRows.filter((r) => r.kind === 'Book').length,
        chapters: naac.bookRows.filter((r) => r.kind === 'Book chapter').length,
        proceedings: naac.bookRows.filter((r) => r.kind === 'Conference proceedings paper').length,
        perYear: naac.bookTotals,
      },
      undatedPublications: naac.undated,
      completeness: {
        ugcCareKnown: ratio(pq.ugcKnown, pq.total),
        paperIssn: ratio(pq.total - pq.withoutIssn, pq.total),
        paperLink: ratio(pq.total - pq.withoutLink, pq.total),
        grantSanctionedAmount: ratio(gq.withSanctionedAmount, gq.total),
        grantSanctionDate: ratio(gq.withSanctionDate, gq.total),
        fundingFromReceipts: ratio(naac.funding.rows.length - fundingFallback, naac.funding.rows.length),
      },
    },
    nirf: {
      financialYears: nirfParams.starts.map(fyLabel),
      publications: { total: pubTotal, perYear: nirf.publications },
      citations: { total: sum(nirf.publications, 'citations'), papersWithData: pubWithCites },
      patents: {
        filed: sum(nirf.patentsFy, 'filed'),
        published: sum(nirf.patentsFy, 'published'),
        granted: sum(nirf.patentsFy, 'granted'),
        perYear: nirf.patentsFy,
        records: nirf.patentGaps.total,
        grantedRecords: nirf.patentGaps.granted,
        filedWithoutDate: nirf.patentGaps.filedWithoutDate,
        publishedWithoutDate: nirf.patentGaps.publishedWithoutDate,
      },
      sponsoredResearch: {
        projects: nirf.funding.rows.length,
        amountReceived: sum(nirf.sponsored, 'amount'),
        fallbackAmount: sum(nirf.sponsored, 'fallbackAmount'),
        perYear: nirf.sponsored,
      },
      phd: {
        records: nirf.phdGaps.total,
        enrolledLatest: nirf.phd.length ? nirf.phd[nirf.phd.length - 1].enrolled : 0,
        graduated: sum(nirf.phd, 'graduated'),
        perYear: nirf.phd,
        withoutRegistrationDate: nirf.phdGaps.withoutRegistrationDate,
        inactiveWithoutAward: nirf.phdGaps.inactiveWithoutAward,
      },
      completeness: {
        citationCoverage: ratio(pubWithCites, pubTotal),
        fundingFromReceipts: ratio(nirf.funding.rows.length - nirfFundingFallback, nirf.funding.rows.length),
        patentFilingDate: ratio(nirf.patentGaps.filedByStatus - nirf.patentGaps.filedWithoutDate, nirf.patentGaps.filedByStatus),
        phdRegistrationDate: ratio(nirf.phdGaps.total - nirf.phdGaps.withoutRegistrationDate, nirf.phdGaps.total),
      },
    },
  };
};

module.exports = {
  XLSX_MIME,
  buildNaacDataset,
  buildNirfDataset,
  generateNaacWorkbook,
  generateNirfWorkbook,
  getSummary,
};
