jest.mock('../../../shared/config/database', () => ({
  university: { findUnique: jest.fn() },
  employeeDetails: { findMany: jest.fn() },
  researchContribution: { findMany: jest.fn(), count: jest.fn() },
  grantApplication: { findMany: jest.fn() },
  iprApplication: { findMany: jest.fn() },
  studentDetails: { findMany: jest.fn() },
  ripResearcherExpertiseProfile: { aggregate: jest.fn() },
}));

const ExcelJS = require('exceljs');
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const service = require('../../../modules/reports/services/reports.service');

const d = (s) => new Date(`${s}T00:00:00+05:30`);
const TENANT = '11111111-1111-1111-1111-111111111111';

const naacParams = { fromYear: 2022, toYear: 2024, years: [2022, 2023, 2024], paperBasis: 'calendar' };
const nirfParams = { starts: [2023, 2024] };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.university.findUnique.mockResolvedValue({ id: TENANT, name: 'Test University', code: 'TU' });
  prisma.employeeDetails.findMany.mockResolvedValue([
    { userLoginId: 't1', empId: 'E1', displayName: 'Dr. A', designation: 'Professor', isActive: true, joinDate: null, primaryDepartment: { departmentName: 'CSE' } },
    { userLoginId: 't2', empId: 'E2', firstName: 'B', lastName: 'Bee', designation: 'Asst', isActive: true, joinDate: null, primaryDepartment: null },
  ]);
  prisma.researchContribution.findMany.mockResolvedValue([
    {
      id: 'p1', publicationType: 'research_paper', title: '=HYPERLINK("http://evil")', journalName: 'J', issn: '1', doi: '10.1/a',
      publicationDate: d('2023-05-01'), ugcCareListed: true, indexingCategories: ['scopus'], indexingDetails: { citationCount: 7 },
      authors: [{ name: 'Dr. A', userId: 't1' }, { name: 'B Bee', userId: 't2' }],
    },
    {
      id: 'p2', publicationType: 'research_paper', title: 'Second', journalName: 'J2', publicationDate: d('2024-02-01'),
      ugcCareListed: null, indexingCategories: [], authors: [{ name: 'Dr. A', userId: 't1' }],
    },
    {
      id: 'b1', publicationType: 'book', title: 'Book', bookTitle: 'Book', isbn: '978', publicationDate: d('2022-09-09'),
      authors: [{ name: 'B Bee', userId: 't2' }],
    },
  ]);
  prisma.researchContribution.count.mockResolvedValue(2);
  prisma.grantApplication.findMany.mockResolvedValue([
    {
      id: 'g1', title: 'Grant one', projectStatus: 'approved', projectCategory: 'govt', fundingAgencyType: 'dbt',
      sanctionedAmount: '1000000', sanctionDate: d('2023-06-01'), investigators: [{ name: 'Dr. A', userId: 't1', roleType: 'pi' }],
      fundReceipts: [{ amount: '600000', receivedDate: d('2023-07-01') }, { amount: '400000', receivedDate: d('2024-07-01') }],
    },
    {
      id: 'g2', title: 'Grant two', projectStatus: 'approved', projectCategory: 'non_govt', fundingAgencyName: 'Infosys Foundation',
      sanctionedAmount: null, submittedAmount: '250000', sanctionDate: null, projectStartDate: d('2024-05-01'), investigators: [], fundReceipts: [],
    },
    { id: 'g3', title: 'Proposal', projectStatus: 'submitted', sanctionedAmount: null, sanctionDate: null, investigators: [], fundReceipts: [] },
  ]);
  prisma.iprApplication.findMany.mockResolvedValue([
    { status: 'published', govtFilingDate: d('2023-05-01'), publicationDate: d('2024-05-01'), grantedAt: null },
  ]);
  prisma.studentDetails.findMany.mockResolvedValue([
    { isActive: true, phdRegistrationDate: d('2020-08-01'), phdAwardedAt: d('2024-09-01') },
    { isActive: true, phdRegistrationDate: null, admissionDate: d('2023-08-01'), phdAwardedAt: null },
  ]);
  prisma.ripResearcherExpertiseProfile.aggregate.mockResolvedValue({ _sum: { totalCitations: 120 }, _count: { _all: 2 } });
});

describe('reports.service', () => {
  test('refuses to run without a selected university (superadmin global view)', async () => {
    await expect(tenantContext.run({ tenantId: null }, () => service.getSummary(naacParams, nirfParams))).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.researchContribution.findMany).not.toHaveBeenCalled();
  });

  test('summary aggregates both sections with completeness metrics', async () => {
    const s = await tenantContext.runForTenant(TENANT, () => service.getSummary(naacParams, nirfParams));

    expect(prisma.university.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TENANT } }));
    expect(s.university).toEqual({ name: 'Test University', code: 'TU' });
    expect(s.naac.teachers.total).toBe(2);
    expect(s.naac.papers).toMatchObject({ count: 2, ugcCareListed: 1 });
    expect(s.naac.booksChapters).toMatchObject({ count: 1, books: 1 });
    expect(s.naac.grants).toMatchObject({ count: 2, totalSanctioned: 1250000, fundingFallbackRows: 1, excludedProposals: 1 });
    expect(s.naac.undatedPublications).toBe(2);
    expect(s.naac.completeness.ugcCareKnown).toEqual({ known: 1, total: 2, percent: 50 });
    expect(s.naac.completeness.grantSanctionedAmount).toEqual({ known: 1, total: 2, percent: 50 });

    expect(s.nirf.financialYears).toEqual(['2023-24', '2024-25']);
    expect(s.nirf.publications.total).toBe(2);
    expect(s.nirf.citations).toEqual({ total: 7, papersWithData: 1 });
    expect(s.nirf.patents).toMatchObject({ filed: 1, published: 1, granted: 0 });
    expect(s.nirf.sponsoredResearch).toMatchObject({ projects: 2, amountReceived: 1250000, fallbackAmount: 250000 });
    expect(s.nirf.phd).toMatchObject({ records: 2, graduated: 1, enrolledLatest: 1, withoutRegistrationDate: 1 });
  });

  test('NAAC workbook: expected sheets, filename, neutralised strings, per-teacher counts', async () => {
    const file = await tenantContext.runForTenant(TENANT, () => service.generateNaacWorkbook(naacParams));
    expect(file.filename).toBe('NAAC-Criterion3-TU-2022-2024.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Read me',
      '3.1.1 Grants',
      '3.1 Yearwise funding',
      '3.3.1 Papers',
      '3.3.1 Per teacher',
      '3.3.2 Books & chapters',
      '3.3.2 Per teacher',
      '3.2 Workshops (fill manually)',
      '3.4 Extension (fill manually)',
      '3.5 Collab-MoUs (fill manually)',
    ]);
    const papers = wb.getWorksheet('3.3.1 Papers');
    expect(papers.getCell('A4').value).toBe('\'=HYPERLINK("http://evil")');
    const perTeacher = wb.getWorksheet('3.3.1 Per teacher');
    expect(perTeacher.getRow(4).values.slice(1)).toEqual(['Dr. A', 'E1', 'Professor', 'CSE', 0, 1, 1, 2]);
    const funding = wb.getWorksheet('3.1 Yearwise funding');
    const fallbackRow = funding.getRow(5).values.slice(1);
    expect(fallbackRow).toContain('Y');
  });

  test('NIRF workbook: expected sheets and filename', async () => {
    const file = await tenantContext.runForTenant(TENANT, () => service.generateNirfWorkbook(nirfParams));
    expect(file.filename).toBe('NIRF-Research-TU-2023-24-to-2024-25.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Read me',
      'Publications',
      'Patents (FY)',
      'Patents (calendar year)',
      'Sponsored Research',
      'Sponsored Projects (detail)',
      'Consultancy (fill manually)',
      'PhD Students',
    ]);
    const sponsored = wb.getWorksheet('Sponsored Research');
    expect(sponsored.getRow(4).values.slice(1, 5)).toEqual(['2023-24', 1, 1, 600000]);
    expect(sponsored.getRow(5).values.slice(1, 5)).toEqual(['2024-25', 2, 2, 650000]);
  });
});

describe('nirfWorkbook.amountInWords', () => {
  const { amountInWords } = require('../../../modules/reports/services/nirfWorkbook');
  test.each([
    [0, 'Zero'],
    [1250000, 'Twelve Lakh Fifty Thousand Rupees'],
    [10000001, 'One Crore One Rupees'],
    [999, 'Nine Hundred Ninety Nine Rupees'],
  ])('%i', (n, words) => expect(amountInWords(n)).toBe(words));
});
