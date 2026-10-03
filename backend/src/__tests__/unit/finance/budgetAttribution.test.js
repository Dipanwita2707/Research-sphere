/**
 * Budget attribution: every payout line is charged to the unit the PAYEE belongs to.
 * Never the work's own school/department, never the acting DRD/finance user; each co-author
 * separately. Covers every source that creates lines: research contributions (paper, book,
 * chapter, conference), IPR inventors and grant applicants.
 */

const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);

const payout = require('../../../modules/finance/services/incentivePayout.service');
const { createIprPayoutLines } = require('../../../modules/research/utils/iprIncentive');
const { createGrantPayoutLines } = require('../../../modules/grants/services/grant.service');

const SCHOOL = { FDS: 'f0000000-0000-4000-8000-000000000001', SOPS: 'f0000000-0000-4000-8000-000000000002', SOET: 'f0000000-0000-4000-8000-000000000003', DECOY: 'f0000000-0000-4000-8000-0000000000dd' };
const DEPT = { OPM: 'd0000000-0000-4000-8000-000000000001', PHM: 'd0000000-0000-4000-8000-000000000002', CSE: 'd0000000-0000-4000-8000-000000000003', DECOY: 'd0000000-0000-4000-8000-0000000000dd' };

// People and the units they belong to.
const EMPLOYEES = [
  { userLoginId: 'fac-fds', empId: 'F7', primarySchoolId: SCHOOL.FDS, primaryDepartmentId: DEPT.OPM, primaryDepartment: { facultyId: SCHOOL.FDS } },
  { userLoginId: 'fac-sops', empId: 'F9', primarySchoolId: SCHOOL.SOPS, primaryDepartmentId: DEPT.PHM, primaryDepartment: { facultyId: SCHOOL.SOPS } },
  { userLoginId: 'drd-head', empId: 'D1', primarySchoolId: SCHOOL.DECOY, primaryDepartmentId: DEPT.DECOY, primaryDepartment: { facultyId: SCHOOL.DECOY } },
];
const STUDENTS = [
  { userLoginId: 'stu-soet', program: { departmentId: DEPT.CSE, department: { facultyId: SCHOOL.SOET } } },
  { userLoginId: 'stu-section-only', program: null, section: { program: { departmentId: DEPT.CSE, department: { facultyId: SCHOOL.SOET } } } },
];

function reset() {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  Object.assign(mockPrisma, {
    employeeDetails: { findMany: jest.fn(async ({ where }) => EMPLOYEES.filter((e) => where.userLoginId.in.includes(e.userLoginId))) },
    userLogin: {
      findMany: jest.fn(async ({ where }) => where.id.in.filter((id) => id.startsWith('stu-')).map((id) => ({ id }))),
      findUnique: jest.fn(async () => ({ uid: 'X', employeeDetails: { displayName: 'Applicant' } })),
    },
    studentDetails: { findMany: jest.fn(async ({ where }) => STUDENTS.filter((s) => where.userLoginId.in.includes(s.userLoginId))) },
    incentivePayout: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(async ({ data }) => ({ count: data.length })) },
    incentivePayoutEvent: { create: jest.fn() },
  });
}
beforeEach(reset);

const created = () => Object.fromEntries(mockPrisma.incentivePayout.createMany.mock.calls[0][0].data.map((r) => [r.payeeUserId, r]));

describe.each(['research_paper', 'book', 'book_chapter', 'conference_paper'])('research contribution (%s)', (publicationType) => {
  test('co-authors from different schools each charge their own unit; the work\'s own school and the approver are ignored', async () => {
    await payout.createLinesForContribution(mockPrisma, {
      contribution: {
        id: 'c1', universityId: 'u1', publicationType, title: 'Mixed authors', applicationNumber: 'RC-1',
        schoolId: SCHOOL.DECOY, departmentId: DEPT.DECOY, // the work's own unit: must never be charged
      },
      actorId: 'drd-head', // approver belongs to the decoy school: must never be charged
      authorShares: [
        { userId: 'fac-fds', name: 'A', isInternal: true, incentiveShare: 5000, pointsShare: 5 },
        { userId: 'fac-sops', name: 'B', isInternal: true, incentiveShare: 3000, pointsShare: 3 },
        { userId: 'stu-soet', name: 'S', isInternal: true, incentiveShare: 2000, pointsShare: 2 },
      ],
    });
    const rows = created();
    expect(rows['fac-fds']).toMatchObject({ schoolId: SCHOOL.FDS, departmentId: DEPT.OPM, approvedAmount: 5000 });
    expect(rows['fac-sops']).toMatchObject({ schoolId: SCHOOL.SOPS, departmentId: DEPT.PHM, approvedAmount: 3000 });
    expect(rows['stu-soet']).toMatchObject({ schoolId: SCHOOL.SOET, departmentId: DEPT.CSE, approvedAmount: 2000 });
    expect(Object.values(rows).some((r) => r.schoolId === SCHOOL.DECOY || r.departmentId === DEPT.DECOY)).toBe(false);
  });
});

test('IPR: each inventor charges their own unit, not the IPR application\'s school', async () => {
  await createIprPayoutLines(mockPrisma, { id: 'ipr1', universityId: 'u1', iprType: 'patent', title: 'P', applicationNumber: 'IPR-1', schoolId: SCHOOL.DECOY, departmentId: DEPT.DECOY }, {
    inventors: [
      { userId: 'fac-fds', name: 'A', role: 'primary_inventor' },
      { userId: 'fac-sops', name: 'B', role: 'inventor' },
      { userId: 'stu-section-only', name: 'S', role: 'inventor', isStudent: true },
    ],
    perInventorIncentive: 10000, perInventorPoints: 10, approvedAt: new Date('2026-06-01'), actorId: 'drd-head',
  });
  const rows = created();
  expect(rows['fac-fds']).toMatchObject({ schoolId: SCHOOL.FDS, departmentId: DEPT.OPM, sourceType: 'ipr' });
  expect(rows['fac-sops']).toMatchObject({ schoolId: SCHOOL.SOPS, departmentId: DEPT.PHM });
  // student whose programme is only known through their section
  expect(rows['stu-section-only']).toMatchObject({ schoolId: SCHOOL.SOET, departmentId: DEPT.CSE, points: 0 });
});

test('grant: the applicant charges their own unit, not the grant\'s school', async () => {
  await createGrantPayoutLines(mockPrisma, {
    id: 'g1', universityId: 'u1', title: 'G', applicationNumber: 'GR-1', applicantUserId: 'fac-sops',
    incentiveAmount: 25000, pointsAwarded: 30, schoolId: SCHOOL.DECOY, departmentId: DEPT.DECOY,
  }, { approvedAt: new Date('2026-06-01'), actorId: 'drd-head' });
  const rows = created();
  expect(rows['fac-sops']).toMatchObject({ schoolId: SCHOOL.SOPS, departmentId: DEPT.PHM, sourceType: 'grant', approvedAmount: 25000 });
});

test('payee with no unit stays unassigned, even when the work has a school', async () => {
  await payout.createLines(mockPrisma, {
    universityId: 'u1', sourceType: 'research_contribution', sourceId: 's1', workType: 'research_paper', title: 'T',
    schoolId: SCHOOL.DECOY, departmentId: DEPT.DECOY, approvedAt: new Date('2026-06-01'), actorId: 'drd-head',
    payees: [{ userId: 'nobody', name: 'N', amount: 100, points: 1 }],
  });
  expect(created().nobody).toMatchObject({ schoolId: null, departmentId: null });
});
