const agg = require('../../../modules/reports/services/aggregations');

const d = (s) => new Date(`${s}T00:00:00+05:30`);

const teachers = [
  { userId: 't1', name: 'Dr. A', empId: 'E1', designation: 'Professor', department: 'CSE', isActive: true, joinDate: d('2015-07-01') },
  { userId: 't2', name: 'Dr. B', empId: 'E2', designation: 'Asst. Prof.', department: 'ECE', isActive: true, joinDate: d('2023-08-01') },
  { userId: 't3', name: 'Dr. C', empId: 'E3', designation: 'Asst. Prof.', department: 'ME', isActive: false, joinDate: null },
];
const teacherMap = new Map(teachers.map((t) => [t.userId, t]));

const paper = (over = {}) => ({
  id: over.id || 'p',
  publicationType: 'research_paper',
  title: 'A paper',
  journalName: 'J',
  issn: '1234-5678',
  doi: '10.1/x',
  publicationDate: d('2023-05-10'),
  ugcCareListed: null,
  authors: [],
  department: { departmentName: 'Fallback Dept' },
  ...over,
});

describe('reports/aggregations — publications', () => {
  test('3.3.1 rows: only journal papers in range, UGC flag, DOI link, teacher department', () => {
    const rows = agg.buildPaperRows(
      [
        paper({ id: 'p1', ugcCareListed: true, authors: [{ name: 'Dr. A', userId: 't1' }, { name: 'Ext', userId: null }] }),
        paper({ id: 'p2', ugcCareListed: false, publicationDate: d('2019-01-01') }),
        paper({ id: 'p3', publicationType: 'book' }),
        paper({ id: 'p4', doi: null, weblink: 'https://example.org/p4' }),
      ],
      teacherMap,
      { years: [2022, 2023, 2024], basis: 'calendar' }
    );
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p4']);
    expect(rows[0]).toMatchObject({ year: 2023, yearLabel: 2023, ugcCare: 'Y', department: 'CSE', authors: 'Dr. A; Ext', link: 'https://doi.org/10.1/x', teacherIds: ['t1'] });
    expect(rows[1]).toMatchObject({ ugcCare: 'Unknown', department: 'Fallback Dept', link: 'https://example.org/p4', teacherIds: [] });
  });

  test('academic-year basis moves a January paper into the previous AY', () => {
    const rows = agg.buildPaperRows([paper({ publicationDate: d('2024-01-20') })], teacherMap, { years: [2023], basis: 'academic' });
    expect(rows).toHaveLength(1);
    expect(rows[0].yearLabel).toBe('2023-24');
  });

  test('3.3.2 rows: books, chapters and proceedings papers; talks excluded; conference date fallback', () => {
    const rows = agg.buildBookRows(
      [
        paper({ id: 'b1', publicationType: 'book', bookTitle: 'My Book', isbn: '978-1', authors: [{ name: 'Dr. B', userId: 't2' }] }),
        paper({ id: 'c1', publicationType: 'book_chapter', title: 'Chapter', bookTitle: 'Edited Vol' }),
        paper({ id: 'k1', publicationType: 'conference_paper', conferenceSubType: 'keynote_speaker_invited_talks' }),
        paper({ id: 'cp', publicationType: 'conference_paper', publicationDate: null, conferenceDate: d('2023-11-02'), proceedingsTitle: 'Proc', nationalInternational: 'international' }),
      ],
      teacherMap,
      { years: [2023], basis: 'calendar', universityName: 'SGT' }
    );
    expect(rows.map((r) => r.id)).toEqual(['b1', 'c1', 'cp']);
    expect(rows[0]).toMatchObject({ kind: 'Book', bookOrChapterTitle: 'My Book', teacher: 'Dr. B', isbn: '978-1' });
    expect(rows[1]).toMatchObject({ kind: 'Book chapter', bookOrChapterTitle: 'Chapter', bookTitle: 'Edited Vol' });
    expect(rows[2]).toMatchObject({ proceedingsTitle: 'Proc', paperTitle: 'A paper', nationalInternational: 'International', affiliatingInstitute: 'Yes (SGT)' });
  });

  test('per-teacher counts: a co-authored item counts once per teacher; unattributed tracked', () => {
    const rows = [
      { year: 2023, teacherIds: ['t1', 't2'] },
      { year: 2023, teacherIds: ['t1'] },
      { year: 2024, teacherIds: ['t1'] },
      { year: 2024, teacherIds: [] },
      { year: 2024, teacherIds: ['someone-else'] },
    ];
    const res = agg.perTeacherCounts(rows, teachers, [2023, 2024]);
    expect(res.unattributed).toBe(1);
    expect(res.rows[0]).toMatchObject({ teacher: { userId: 't1' }, counts: { 2023: 2, 2024: 1 }, total: 3 });
    expect(res.rows.find((r) => r.teacher.userId === 't2')).toMatchObject({ counts: { 2023: 1, 2024: 0 }, total: 1 });
    expect(res.rows.find((r) => r.teacher.userId === 't3').total).toBe(0);
  });

  test('applicant teacher counts when the author list has no linked teacher', () => {
    const rows = agg.buildPaperRows([paper({ applicantUserId: 't2', authors: [{ name: 'X' }] })], teacherMap, { years: [2023] });
    expect(rows[0].teacherIds).toEqual(['t2']);
  });

  test('teachers in post per year use join date and active status', () => {
    expect(agg.teachersPerYear(teachers, [2022, 2023, 2024], 'calendar')).toEqual({ 2022: 1, 2023: 2, 2024: 2 });
  });

  test('year totals compute per-teacher ratio', () => {
    const totals = agg.yearTotals([{ year: 2023 }, { year: 2023 }, { year: 2023 }], [2023, 2024], { 2023: 2, 2024: 0 });
    expect(totals).toEqual([
      { year: 2023, count: 3, teachers: 2, perTeacher: 1.5 },
      { year: 2024, count: 0, teachers: 0, perTeacher: null },
    ]);
  });

  test('indexing classification merges categories, free text and sync sources', () => {
    expect([...agg.classifyIndexing({ indexingCategories: ['scopus', 'scie_wos'] })].sort()).toEqual(['scopus', 'wos']);
    expect([...agg.classifyIndexing({ indexedIn: 'Web of Science, PubMed' })].sort()).toEqual(['pubmed', 'wos']);
    expect([...agg.classifyIndexing({ indexingDetails: { sourceSystems: ['scopus'] } })]).toEqual(['scopus']);
    expect(agg.classifyIndexing({ indexingCategories: ['sgtu_in_house'] }).size).toBe(0);
  });

  test('NIRF publications by FY with citation coverage', () => {
    const res = agg.publicationsByIndexing(
      [
        paper({ publicationDate: d('2023-04-01'), indexingCategories: ['scopus'], indexingDetails: { citationCount: 4 } }),
        paper({ publicationDate: d('2024-03-31'), indexedIn: 'WoS', indexingDetails: { citationCount: '6' } }),
        paper({ publicationDate: d('2024-04-01') }),
        paper({ publicationType: 'book', publicationDate: d('2023-06-01') }),
      ],
      [2023, 2024],
      'financial'
    );
    expect(res[0]).toMatchObject({ year: 2023, total: 2, scopus: 1, wos: 1, others: 0, citations: 10, withCitations: 2 });
    expect(res[1]).toMatchObject({ year: 2024, total: 1, others: 1, citations: 0, withCitations: 0 });
  });
});

describe('reports/aggregations — grants', () => {
  const grant = (over = {}) => ({
    id: over.id || 'g',
    title: 'Project',
    projectStatus: 'approved',
    projectCategory: 'govt',
    fundingAgencyType: 'dst',
    fundingAgencyName: null,
    submittedAmount: '500000',
    sanctionedAmount: '400000',
    sanctionDate: d('2023-06-15'),
    projectStartDate: d('2023-07-01'),
    projectEndDate: d('2025-06-30'),
    projectDurationMonths: 24,
    approvedAt: d('2023-01-10'),
    investigators: [
      { name: 'Dr. A', userId: 't1', roleType: 'pi' },
      { name: 'Dr. B', userId: 't2', roleType: 'co_pi' },
    ],
    fundReceipts: [],
    ...over,
  });

  test('awarded = approved at agency, or sanction/receipt recorded', () => {
    expect(agg.isAwarded(grant())).toBe(true);
    expect(agg.isAwarded(grant({ projectStatus: 'submitted', sanctionDate: null, sanctionedAmount: null }))).toBe(false);
    expect(agg.isAwarded(grant({ projectStatus: 'submitted', sanctionDate: null, sanctionedAmount: null, fundReceipts: [{ amount: 1 }] }))).toBe(true);
  });

  test('3.1.1 rows: academic year of sanction, PI department, fallbacks noted', () => {
    const rows = agg.buildGrantRows(
      [
        grant({ id: 'g1' }),
        grant({ id: 'g2', sanctionDate: null, sanctionedAmount: null, projectStartDate: d('2024-02-01'), projectCategory: 'industry', fundingAgencyName: 'Tata' }),
        grant({ id: 'g3', projectStatus: 'submitted', sanctionDate: null, sanctionedAmount: null }),
      ],
      teacherMap,
      { years: [2023], basis: 'academic' }
    );
    expect(rows.map((r) => r.id)).toEqual(['g1', 'g2']);
    expect(rows[0]).toMatchObject({ yearLabel: '2023-24', investigators: 'PI: Dr. A; Co-PI: Dr. B', department: 'CSE', agency: 'DST', type: 'Government', amount: 400000, duration: '2 years', notes: '' });
    expect(rows[1]).toMatchObject({ amount: 500000, amountSource: 'submitted (no sanctioned amount)', type: 'Non-Government', agency: 'Tata' });
    expect(rows[1].notes).toMatch(/project start date/);
    expect(rows[1].notes).toMatch(/submitted amount/);
  });

  test('funding by FY: receipts bucketed by received date; no receipts → flagged fallback', () => {
    const grants = [
      grant({
        id: 'with-receipts',
        fundReceipts: [
          { amount: '100000', receivedDate: d('2023-04-01') },
          { amount: '50000', receivedDate: d('2024-03-31') },
          { amount: '70000', receivedDate: d('2024-04-01') },
          { amount: '999', receivedDate: d('2030-01-01') },
        ],
      }),
      grant({ id: 'fallback' }),
      grant({ id: 'submitted-fallback', sanctionedAmount: null }),
      grant({ id: 'nothing', sanctionedAmount: null, submittedAmount: null }),
      grant({ id: 'out-of-range', sanctionDate: d('2019-05-01') }),
    ];
    const res = agg.buildFundingByYear(grants, { years: [2023, 2024] });
    const byId = Object.fromEntries(res.rows.map((r) => [r.id, r]));
    expect(Object.keys(byId).sort()).toEqual(['fallback', 'submitted-fallback', 'with-receipts']);
    expect(byId['with-receipts']).toMatchObject({ perYear: { 2023: 150000, 2024: 70000 }, total: 220000, basis: 'receipts', isFallback: false });
    expect(byId.fallback).toMatchObject({ perYear: { 2023: 400000, 2024: 0 }, basis: 'sanctioned_fallback', isFallback: true });
    expect(byId['submitted-fallback']).toMatchObject({ perYear: { 2023: 500000 }, basis: 'submitted_fallback', isFallback: true });
    expect(res.totals).toEqual({ 2023: 1050000, 2024: 70000 });
    expect(res.fallbackTotals).toEqual({ 2023: 900000, 2024: 0 });

    const nirf = agg.sponsoredResearchByFy(res, [2023, 2024]);
    expect(nirf[0]).toMatchObject({ year: 2023, projects: 3, agencies: 1, amount: 1050000, fallbackAmount: 900000, fallbackProjects: 2 });
    expect(nirf[1]).toMatchObject({ year: 2024, projects: 1, fallbackProjects: 0 });
  });

  test('grant quality counts fallbacks', () => {
    const rows = agg.buildGrantRows([grant(), grant({ sanctionedAmount: null })], teacherMap, { years: [2023] });
    expect(agg.grantQuality(rows)).toMatchObject({ total: 2, withSanctionedAmount: 1, amountFallback: 1, totalAmount: 900000 });
  });

  test('duration from dates when months are missing', () => {
    expect(agg.durationText({ projectStartDate: d('2023-01-01'), projectEndDate: d('2024-07-01') })).toBe('18 months');
    expect(agg.durationText({})).toBe('');
  });
});

describe('reports/aggregations — patents and PhD', () => {
  test('patents counted by their own event dates per FY and calendar year', () => {
    const patents = [
      { status: 'published', govtFilingDate: d('2023-02-01'), publicationDate: d('2023-08-01'), grantedAt: null },
      { status: 'completed', govtFilingDate: d('2023-05-01'), publicationDate: null, grantedAt: d('2024-06-01'), patentNumber: '' },
      { status: 'govt_application_filed', govtFilingDate: null },
    ];
    expect(agg.patentCounts(patents, [2022, 2023, 2024], 'financial')).toEqual([
      { year: 2022, filed: 1, published: 0, granted: 0 },
      { year: 2023, filed: 1, published: 1, granted: 0 },
      { year: 2024, filed: 0, published: 0, granted: 1 },
    ]);
    expect(agg.patentCounts(patents, [2023], 'calendar')).toEqual([{ year: 2023, filed: 2, published: 1, granted: 0 }]);
    expect(agg.patentGaps(patents)).toMatchObject({ total: 3, filedByStatus: 3, filedWithoutDate: 1, publishedWithoutDate: 0, grantedWithoutNumber: 1, granted: 1 });
  });

  test('PhD enrolled at FY end and graduated per FY', () => {
    const students = [
      { isActive: true, phdRegistrationDate: d('2021-08-01'), phdAwardedAt: d('2024-05-01') },
      { isActive: true, phdRegistrationDate: null, admissionDate: d('2023-01-10'), phdAwardedAt: null },
      { isActive: true, phdRegistrationDate: d('2024-01-01'), phdAwardedAt: null },
      { isActive: false, phdRegistrationDate: d('2020-01-01'), phdAwardedAt: null },
      { isActive: true, phdRegistrationDate: null, admissionDate: null, phdAwardedAt: null },
    ];
    expect(agg.phdCounts(students, [2022, 2023, 2024])).toEqual([
      { year: 2022, enrolled: 2, graduated: 0 },
      { year: 2023, enrolled: 3, graduated: 0 },
      { year: 2024, enrolled: 2, graduated: 1 },
    ]);
    expect(agg.phdGaps(students)).toMatchObject({ total: 5, withoutStartDate: 1, withoutRegistrationDate: 2, awarded: 1, inactiveWithoutAward: 1 });
  });
});
