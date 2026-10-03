jest.mock('../../../shared/config/database', () => ({
  centralDepartmentPermission: { findMany: jest.fn() },
  departmentPermission: { findMany: jest.fn() },
  department: { findMany: jest.fn() },
  facultySchoolList: { findMany: jest.fn() },
  userLogin: { findMany: jest.fn() },
  researchContribution: { findMany: jest.fn() },
  iprApplication: { findMany: jest.fn() },
  grantApplication: { findMany: jest.fn() },
  researchContributionReview: { findMany: jest.fn() },
  iprReview: { findMany: jest.fn() },
  grantApplicationReview: { findMany: jest.fn() },
}));

const prisma = require('../../../shared/config/database');
const service = require('../../../modules/drd-analytics/services/drdAnalytics.service');

describe('drdAnalytics.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('applicant analytics expands school scope with department assignments', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      {
        permissions: { applicant_analytics: true },
        assignedSchoolIds: ['school-1'],
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
        assignedGrantSchoolIds: [],
      },
    ]);
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }, { id: 'dept-2' }]);
    prisma.researchContribution.findMany.mockResolvedValue([]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);

    const user = {
      id: 'user-1',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { applicant_analytics: true } }],
      schoolDeptPermissions: [],
    };

    const result = await service.getApplicantAnalytics(user, {});

    expect(result.meta.scopeApplied.schoolIds).toEqual(['school-1']);
    expect(result.meta.scopeApplied.departmentIds).toEqual(['dept-1', 'dept-2']);
    expect(result.meta.scopeApplied.scopeLevel).toBe('school');
  });

  test('drd member analytics includes assigned work without review response', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      {
        permissions: { drd_member_analytics: true },
        assignedSchoolIds: ['school-1'],
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
        assignedGrantSchoolIds: [],
      },
    ]);
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }]);
    prisma.researchContributionReview.findMany.mockResolvedValue([]);
    prisma.iprReview.findMany.mockResolvedValue([]);
    prisma.grantApplicationReview.findMany.mockResolvedValue([]);
    prisma.researchContribution.findMany.mockResolvedValue([
      {
        id: 'rc-1',
        title: 'Assigned paper',
        submittedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        currentReviewerId: 'reviewer-1',
        schoolId: 'school-1',
        departmentId: 'dept-1',
      },
    ]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);
    prisma.userLogin.findMany.mockResolvedValue([
      { id: 'reviewer-1', uid: 'reviewer-1', employeeDetails: { displayName: 'Reviewer One' } },
    ]);

    const user = {
      id: 'head-1',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { drd_member_analytics: true, ipr_approve: true } }],
      schoolDeptPermissions: [],
    };

    const result = await service.getDrdMemberAnalytics(user, {});

    expect(result.reviewers[0].assignedCount).toBe(1);
    expect(result.reviewers[0].pendingCount).toBe(1);
    expect(result.reviewers[0].respondedCount).toBe(0);
  });

  test('applicant analytics supports department-only scope', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([]);
    prisma.departmentPermission.findMany.mockResolvedValue([
      {
        departmentId: 'dept-only',
        permissions: { applicant_analytics: true },
        department: { id: 'dept-only', facultyId: 'school-2' },
      },
    ]);
    prisma.researchContribution.findMany.mockResolvedValue([]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);

    const user = {
      id: 'user-2',
      role: 'staff',
      centralDeptPermissions: [],
      schoolDeptPermissions: [{ departmentId: 'dept-only', permissions: { applicant_analytics: true } }],
    };

    const result = await service.getApplicantAnalytics(user, {});

    expect(result.meta.scopeApplied.schoolIds).toEqual([]);
    expect(result.meta.scopeApplied.departmentIds).toEqual(['dept-only']);
    expect(result.meta.scopeApplied.scopeLevel).toBe('department');
  });

  test('applicant analytics unions school and department assignments', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      {
        permissions: { applicant_analytics: true },
        assignedSchoolIds: ['school-1'],
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
        assignedGrantSchoolIds: [],
      },
    ]);
    prisma.departmentPermission.findMany.mockResolvedValue([
      {
        departmentId: 'dept-extra',
        permissions: { applicant_analytics: true },
        department: { id: 'dept-extra', facultyId: 'school-9' },
      },
    ]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }, { id: 'dept-2' }]);
    prisma.researchContribution.findMany.mockResolvedValue([]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);

    const user = {
      id: 'user-3',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { applicant_analytics: true } }],
      schoolDeptPermissions: [{ departmentId: 'dept-extra', permissions: { applicant_analytics: true } }],
    };

    const result = await service.getApplicantAnalytics(user, {});

    expect(result.meta.scopeApplied.schoolIds).toEqual(['school-1']);
    expect(result.meta.scopeApplied.departmentIds).toEqual(
      expect.arrayContaining(['dept-1', 'dept-2', 'dept-extra'])
    );
    expect(result.meta.scopeApplied.scopeLevel).toBe('mixed');
  });

  test('drd member analytics restricts non-supervisors to self view', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      {
        permissions: { drd_member_analytics: true },
        assignedSchoolIds: ['school-1'],
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
        assignedGrantSchoolIds: [],
      },
    ]);
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }]);
    prisma.researchContributionReview.findMany.mockResolvedValue([]);
    prisma.iprReview.findMany.mockResolvedValue([]);
    prisma.grantApplicationReview.findMany.mockResolvedValue([]);
    prisma.researchContribution.findMany.mockResolvedValue([
      {
        id: 'rc-self',
        title: 'Self assigned paper',
        submittedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        currentReviewerId: 'reviewer-self',
        schoolId: 'school-1',
        departmentId: 'dept-1',
      },
    ]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);
    prisma.userLogin.findMany.mockResolvedValue([
      { id: 'reviewer-self', uid: 'reviewer-self', employeeDetails: { displayName: 'Self Reviewer' } },
    ]);

    const user = {
      id: 'reviewer-self',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { drd_member_analytics: true } }],
      schoolDeptPermissions: [],
      employeeDetails: { displayName: 'Self Reviewer' },
    };

    const result = await service.getDrdMemberAnalytics(user, { reviewerId: 'other-reviewer' });

    expect(result.extensions.selfView).toBe(true);
    expect(result.reviewers).toHaveLength(1);
    expect(result.reviewers[0].reviewerId).toBe('reviewer-self');
  });

  test('applicant analytics includes monthly trend aggregation', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      {
        permissions: { applicant_analytics: true },
        assignedSchoolIds: ['school-1'],
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
        assignedGrantSchoolIds: [],
      },
    ]);
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }]);
    prisma.researchContribution.findMany
      .mockResolvedValueOnce([
        {
          id: 'research-1',
          status: 'approved',
          incentiveAmount: 100,
          submittedAt: new Date('2026-01-15T00:00:00.000Z'),
          createdAt: new Date('2026-01-15T00:00:00.000Z'),
          applicantUserId: 'applicant-1',
          schoolId: 'school-1',
          departmentId: 'dept-1',
          school: { shortName: 'School One' },
          department: { shortName: 'Dept One' },
          applicantUser: { uid: 'applicant-1', employeeDetails: { displayName: 'Applicant One' } },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.iprApplication.findMany.mockResolvedValue([
      {
        id: 'ipr-1',
        status: 'approved',
        incentiveAmount: 50,
        submittedAt: new Date('2026-02-10T00:00:00.000Z'),
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        applicantUserId: 'applicant-2',
        schoolId: 'school-1',
        departmentId: 'dept-1',
        school: { shortName: 'School One' },
        department: { shortName: 'Dept One' },
        applicantUser: { uid: 'applicant-2', employeeDetails: { displayName: 'Applicant Two' } },
      },
    ]);
    prisma.grantApplication.findMany.mockResolvedValue([]);

    const user = {
      id: 'user-4',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { applicant_analytics: true } }],
      schoolDeptPermissions: [],
    };

    const result = await service.getApplicantAnalytics(user, {
      from: '2026-01-01',
      to: '2026-03-31',
    });

    const january = result.extensions.monthlyTrend.find((entry) => entry.month === '2026-01');
    const february = result.extensions.monthlyTrend.find((entry) => entry.month === '2026-02');

    expect(january.totalApplications).toBe(1);
    expect(january.totalIncentive).toBe(100);
    expect(february.totalApplications).toBe(1);
    expect(february.totalIncentive).toBe(50);
  });

  test('applicant analytics honours category-specific analytics permission and scope', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      {
        permissions: { ipr_applicant_analytics: true },
        assignedSchoolIds: [],
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
        assignedGrantSchoolIds: [],
        assignedIprAnalyticsSchoolIds: ['school-ipr'],
        assignedResearchAnalyticsSchoolIds: [],
        assignedBookAnalyticsSchoolIds: [],
        assignedConferenceAnalyticsSchoolIds: [],
        assignedGrantAnalyticsSchoolIds: [],
      },
    ]);
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-ipr' }]);
    prisma.iprApplication.findMany.mockResolvedValue([]);

    const user = {
      id: 'user-5',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { ipr_applicant_analytics: true } }],
      schoolDeptPermissions: [],
    };

    const result = await service.getApplicantAnalytics(user, { category: 'ipr' });

    expect(result.meta.scopeApplied.schoolIds).toEqual(['school-ipr']);
    expect(result.extensions.availableCategories).toEqual(['ipr']);
  });
});

describe('drdAnalytics.service - unassigned scope and cache invalidation', () => {
  const emptyRow = (permissions) => ({
    permissions,
    assignedSchoolIds: [],
    assignedResearchSchoolIds: [],
    assignedBookSchoolIds: [],
    assignedConferenceSchoolIds: [],
    assignedGrantSchoolIds: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }, { id: 'dept-2' }]);
    prisma.facultySchoolList.findMany.mockResolvedValue([{ id: 'school-1' }, { id: 'school-2' }]);
    prisma.researchContribution.findMany.mockResolvedValue([]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);
  });

  test('applicant_analytics with no school/department assignment is university-wide (same rule as review queues)', async () => {
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([emptyRow({ applicant_analytics: true })]);
    const user = {
      id: 'user-unassigned',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { applicant_analytics: true } }],
      schoolDeptPermissions: [],
    };

    const result = await service.getApplicantAnalytics(user, {});

    expect(result.meta.scopeApplied.scopeLevel).toBe('university');
    expect(result.meta.scopeApplied.schoolIds).toEqual(['school-1', 'school-2']);
    // University-wide query: no "id in []" zero-result filter
    const where = JSON.stringify(prisma.researchContribution.findMany.mock.calls[0][0].where);
    expect(where).not.toContain('"in":[]');
  });

  test('cache.invalidateUser drops the cached analytics scope for that user', async () => {
    const cache = require('../../../shared/config/redis');
    const user = {
      id: 'user-reassigned',
      role: 'staff',
      centralDeptPermissions: [{ permissions: { applicant_analytics: true } }],
      schoolDeptPermissions: [],
    };
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([emptyRow({ applicant_analytics: true })]);
    const before = await service.getApplicantAnalytics(user, {});
    expect(before.meta.scopeApplied.scopeLevel).toBe('university');

    prisma.centralDepartmentPermission.findMany.mockResolvedValue([
      { ...emptyRow({ applicant_analytics: true }), assignedSchoolIds: ['school-1'] },
    ]);
    await cache.invalidateUser(user.id);
    const after = await service.getApplicantAnalytics(user, {});
    expect(after.meta.scopeApplied.schoolIds).toEqual(['school-1']);
  });
  test('research category labels name no particular university (multi-tenant)', () => {
    const labels = Object.values(service.RESEARCH_CATEGORY_LABELS);
    expect(service.RESEARCH_CATEGORY_LABELS.sgtu_in_house).toBe('University In-House Journal');
    labels.forEach((label) => expect(label).not.toMatch(/SGT|Shree Guru/i));
  });

  test('DRD member performance reports decision totals for the overview pipeline card', async () => {
    const rc = (id) => ({ id, title: id, publicationType: 'research_paper', status: 'approved', submittedAt: new Date(), createdAt: new Date(), schoolId: 's1', departmentId: 'd1', school: { facultyName: 'S', shortName: 'S' }, department: { departmentName: 'D', shortName: 'D' } });
    const now = new Date();
    prisma.researchContributionReview.findMany.mockResolvedValue([
      { id: 'r1', reviewerId: 'rev', decision: 'recommended', reviewedAt: now, createdAt: now, researchContribution: rc('p1') },
      { id: 'r2', reviewerId: 'rev', decision: 'approved', reviewedAt: now, createdAt: now, researchContribution: rc('p1') },
      { id: 'r3', reviewerId: 'rev', decision: 'rejected', reviewedAt: now, createdAt: now, researchContribution: rc('p2') },
    ]);
    prisma.iprReview.findMany.mockResolvedValue([]);
    prisma.grantApplicationReview.findMany.mockResolvedValue([]);
    prisma.researchContribution.findMany.mockResolvedValue([]);
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.grantApplication.findMany.mockResolvedValue([]);
    prisma.userLogin.findMany.mockResolvedValue([{ id: 'rev', uid: '70002', employeeDetails: { displayName: 'Research Reviewer', designation: 'DRD Reviewer' } }]);
    prisma.centralDepartmentPermission.findMany.mockResolvedValue([]);
    prisma.departmentPermission.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.facultySchoolList.findMany.mockResolvedValue([]);

    const out = await service.getDrdMemberPerformance({ id: 'admin-1', role: 'admin' }, {});
    expect(out.kpis).toMatchObject({ approvedCount: 2, rejectedCount: 1 });
  });

});
