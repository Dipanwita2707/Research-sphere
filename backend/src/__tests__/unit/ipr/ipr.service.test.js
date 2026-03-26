/**
 * Unit Tests: IprService
 * Requirements: 2.8, 2.1
 */

const IprService = require('../../../modules/ipr/services/ipr.service');

function makeRepo(overrides = {}) {
  return {
    findActivePolicy: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByApplicant: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'ipr-1', applicationNumber: 'PAT-2024-0001' }),
    update: jest.fn().mockResolvedValue({ id: 'ipr-1' }),
    updateStatus: jest.fn().mockResolvedValue({ id: 'ipr-1' }),
    delete: jest.fn().mockResolvedValue({ id: 'ipr-1' }),
    createStatusHistory: jest.fn().mockResolvedValue({}),
    createContributor: jest.fn().mockResolvedValue({}),
    findContributors: jest.fn().mockResolvedValue([]),
    findFirstContributor: jest.fn().mockResolvedValue(null),
    upsertApplicantDetails: jest.fn().mockResolvedValue({}),
    findApplicantDetails: jest.fn().mockResolvedValue(null),
    deleteSdgs: jest.fn().mockResolvedValue({}),
    createManySdgs: jest.fn().mockResolvedValue({}),
    findUserById: jest.fn().mockResolvedValue(null),
    findUserByUid: jest.fn().mockResolvedValue(null),
    findEmployeeDetails: jest.fn().mockResolvedValue(null),
    findStudentDetails: jest.fn().mockResolvedValue(null),
    createNotification: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('IprService', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new IprService(repo);
  });

  // ── calculateIprIncentives ────────────────────────────────────────────────

  describe('calculateIprIncentives()', () => {
    test('returns zero incentives when no policy found', async () => {
      repo.findActivePolicy.mockResolvedValue(null);
      const result = await service.calculateIprIncentives('patent', 'provisional', null);
      expect(result.incentiveAmount).toBe(0);
      expect(result.pointsAwarded).toBe(0);
    });

    test('returns policy incentive amount when policy found', async () => {
      repo.findActivePolicy.mockResolvedValue({ baseIncentiveAmount: 50000, basePoints: 50 });
      const result = await service.calculateIprIncentives('patent', 'provisional', null);
      expect(result.incentiveAmount).toBe(50000);
      expect(result.pointsAwarded).toBe(50);
    });
  });

  // ── generateApplicationNumber ─────────────────────────────────────────────

  describe('generateApplicationNumber()', () => {
    test('generates PAT-YYYY-NNNN format for patent', async () => {
      repo.findFirst.mockResolvedValue(null);
      const num = await service.generateApplicationNumber('patent');
      expect(num).toMatch(/^PAT-\d{4}-\d{4}$/);
    });

    test('increments sequence based on latest application number', async () => {
      const year = new Date().getFullYear();
      repo.findFirst.mockResolvedValue({ applicationNumber: `PAT-${year}-0005` });
      const num = await service.generateApplicationNumber('patent');
      expect(num).toBe(`PAT-${year}-0006`);
    });

    test('uses CPY prefix for copyright', async () => {
      repo.findFirst.mockResolvedValue(null);
      const num = await service.generateApplicationNumber('copyright');
      expect(num).toMatch(/^CPY-\d{4}-\d{4}$/);
    });
  });

  // ── parseSdgs ─────────────────────────────────────────────────────────────

  describe('parseSdgs()', () => {
    test('returns empty array for null input', () => {
      expect(service.parseSdgs('ipr-1', null)).toEqual([]);
    });

    test('returns empty array for empty array input', () => {
      expect(service.parseSdgs('ipr-1', [])).toEqual([]);
    });

    test('maps string SDGs to records with iprApplicationId and sdgCode', () => {
      const result = service.parseSdgs('ipr-1', ['SDG1', 'SDG2', 'SDG3']);
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ iprApplicationId: 'ipr-1', sdgCode: 'SDG1' });
    });

    test('maps object SDGs with code/title fields', () => {
      const result = service.parseSdgs('ipr-1', [{ code: 'SDG4', title: 'Quality Education' }]);
      expect(result[0]).toMatchObject({ iprApplicationId: 'ipr-1', sdgCode: 'SDG4', sdgTitle: 'Quality Education' });
    });

    test('filters out null/empty SDG codes', () => {
      const result = service.parseSdgs('ipr-1', ['', null, 'SDG5']);
      expect(result).toHaveLength(1);
      expect(result[0].sdgCode).toBe('SDG5');
    });
  });

  // ── resolveSchoolDepartment ───────────────────────────────────────────────

  describe('resolveSchoolDepartment()', () => {
    test('returns provided ids directly when both given', async () => {
      const result = await service.resolveSchoolDepartment('user-1', 'school-1', 'dept-1');
      expect(result.resolvedSchoolId).toBe('school-1');
      expect(result.resolvedDepartmentId).toBe('dept-1');
    });

    test('returns null ids when user not found and no ids provided', async () => {
      repo.findEmployeeDetails.mockResolvedValue(null);
      repo.findStudentDetails.mockResolvedValue(null);
      const result = await service.resolveSchoolDepartment('user-1', null, null);
      expect(result.resolvedSchoolId).toBeNull();
      expect(result.resolvedDepartmentId).toBeNull();
    });

    test('resolves from employee details when ids not provided', async () => {
      repo.findEmployeeDetails.mockResolvedValue({ primarySchoolId: 'school-2', primaryDepartmentId: 'dept-2' });
      const result = await service.resolveSchoolDepartment('user-1', null, null);
      expect(result.resolvedSchoolId).toBe('school-2');
      expect(result.resolvedDepartmentId).toBe('dept-2');
    });
  });

  // ── getStatistics ─────────────────────────────────────────────────────────

  describe('getStatistics()', () => {
    test('returns stats object with total, pending, approved, rejected', async () => {
      // getStatistics calls repo.count 6 times and repo.groupBy 2 times
      repo.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(3)   // submitted (pending)
        .mockResolvedValueOnce(2)   // underReview
        .mockResolvedValueOnce(4)   // approved
        .mockResolvedValueOnce(1)   // rejected
        .mockResolvedValueOnce(0);  // completed
      repo.groupBy.mockResolvedValue([]);
      const result = await service.getStatistics({});
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('pending');
      expect(result).toHaveProperty('approved');
      expect(result).toHaveProperty('rejected');
      expect(result.total).toBe(10);
    });
  });

  // ── deleteApplication ─────────────────────────────────────────────────────

  describe('deleteApplication()', () => {
    test('throws when application not found', async () => {
      repo.findFirst.mockResolvedValue(null);
      await expect(service.deleteApplication('ipr-1', 'user-1')).rejects.toThrow();
    });

    test('deletes when user is applicant and status is draft', async () => {
      repo.findFirst.mockResolvedValue({ id: 'ipr-1', applicantUserId: 'user-1', status: 'draft' });
      repo.delete.mockResolvedValue({ id: 'ipr-1' });
      await expect(service.deleteApplication('ipr-1', 'user-1')).resolves.not.toThrow();
      expect(repo.delete).toHaveBeenCalledWith('ipr-1');
    });
  });
});

describe('IprService - additional coverage', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new IprService(repo);
  });

  // ── getAllApplications ────────────────────────────────────────────────────

  describe('getAllApplications()', () => {
    test('returns paginated results', async () => {
      repo.findAll.mockResolvedValue([{ id: 'ipr-1' }]);
      repo.count.mockResolvedValue(1);
      const result = await service.getAllApplications({ page: 1, limit: 10 });
      expect(result.applications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    test('applies status filter', async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);
      await service.getAllApplications({ status: 'submitted', page: 1, limit: 5 });
      expect(repo.findAll).toHaveBeenCalled();
    });
  });

  // ── getApplicationById ────────────────────────────────────────────────────

  describe('getApplicationById()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getApplicationById('ipr-1')).rejects.toThrow();
    });

    test('returns application when found', async () => {
      repo.findById.mockResolvedValue({ id: 'ipr-1', title: 'Test Patent' });
      const result = await service.getApplicationById('ipr-1');
      expect(result.id).toBe('ipr-1');
    });
  });

  // ── determineSubmissionStatus ─────────────────────────────────────────────

  describe('determineSubmissionStatus()', () => {
    test('returns submitted for non-student', async () => {
      repo.findUserById.mockResolvedValue({ role: 'faculty' });
      const result = await service.determineSubmissionStatus('user-1', null);
      expect(result.newStatus).toBe('submitted');
    });

    test('returns pending_mentor_approval for student with mentor', async () => {
      repo.findUserById.mockResolvedValue({ role: 'student' });
      const result = await service.determineSubmissionStatus('user-1', 'mentor-uid');
      expect(result.newStatus).toBe('pending_mentor_approval');
    });

    test('returns submitted for student without mentor', async () => {
      repo.findUserById.mockResolvedValue({ role: 'student' });
      const result = await service.determineSubmissionStatus('user-1', null);
      expect(result.newStatus).toBe('submitted');
    });
  });

  // ── parseSdgs edge cases ──────────────────────────────────────────────────

  describe('parseSdgs() - edge cases', () => {
    test('handles non-array input gracefully', () => {
      expect(service.parseSdgs('ipr-1', 'not-an-array')).toEqual([]);
    });

    test('handles object SDG with sdgCode field', () => {
      const result = service.parseSdgs('ipr-1', [{ sdgCode: 'SDG7', sdgTitle: 'Clean Energy' }]);
      expect(result[0]).toMatchObject({ sdgCode: 'SDG7', sdgTitle: 'Clean Energy' });
    });
  });

  // ── calculateIprIncentives with multipliers ───────────────────────────────

  describe('calculateIprIncentives() - multipliers', () => {
    test('applies filing type multiplier when present', async () => {
      repo.findActivePolicy.mockResolvedValue({
        baseIncentiveAmount: 100000,
        basePoints: 100,
        filingTypeMultiplier: { complete: 1.5 },
      });
      const result = await service.calculateIprIncentives('patent', 'complete', null);
      expect(result.incentiveAmount).toBe(150000);
    });

    test('applies project type bonus when present', async () => {
      repo.findActivePolicy.mockResolvedValue({
        baseIncentiveAmount: 100000,
        basePoints: 100,
        projectTypeBonus: { funded: 20000 },
      });
      const result = await service.calculateIprIncentives('patent', 'provisional', 'funded');
      expect(result.incentiveAmount).toBe(120000);
    });
  });
});

describe('IprService - workflow coverage', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new IprService(repo);
  });

  // ── submitApplication ─────────────────────────────────────────────────────

  describe('submitApplication()', () => {
    test('throws 404 when draft not found', async () => {
      repo.findFirst.mockResolvedValue(null);
      await expect(service.submitApplication('ipr-1', 'user-1', {})).rejects.toThrow();
    });

    test('submits to DRD for non-student', async () => {
      const mockReq = { headers: {}, ip: '127.0.0.1', user: { id: 'user-1' } };
      repo.findFirst.mockResolvedValue({
        id: 'ipr-1', iprType: 'patent', title: 'Test', applicationNumber: 'PAT-2024-0001',
        applicantUser: { role: 'faculty' },
        applicantDetails: { mentorUid: null, metadata: { contributors: [] } },
      });
      repo.update.mockResolvedValue({ id: 'ipr-1', status: 'submitted' });
      const result = await service.submitApplication('ipr-1', 'user-1', mockReq);
      expect(result.message).toContain('submitted successfully');
    });
  });

  // ── updateApplication ─────────────────────────────────────────────────────

  describe('updateApplication()', () => {
    test('throws 404 when application not found or not editable', async () => {
      repo.findFirst.mockResolvedValue(null);
      await expect(service.updateApplication('ipr-1', 'user-1', {}, {})).rejects.toThrow();
    });

    test('updates application fields', async () => {
      const mockReq = { headers: {}, ip: '127.0.0.1', user: { id: 'user-1' } };
      repo.findFirst.mockResolvedValue({ id: 'ipr-1', status: 'draft', applicantUserId: 'user-1' });
      repo.update.mockResolvedValue({ id: 'ipr-1', title: 'Updated Title' });
      const result = await service.updateApplication('ipr-1', 'user-1', { title: 'Updated Title' }, mockReq);
      expect(result.message).toContain('updated');
    });
  });

  // ── getMyApplications ─────────────────────────────────────────────────────

  describe('getMyApplications()', () => {
    test('returns applications for user', async () => {
      repo.findByApplicant.mockResolvedValue([{ id: 'ipr-1' }]);
      repo.groupBy.mockResolvedValue([]);
      const result = await service.getMyApplications('user-1', {});
      expect(result).toBeDefined();
    });

    test('returns pagination metadata when requested', async () => {
      repo.findByApplicant.mockResolvedValue([{ id: 'ipr-1', status: 'draft', statusHistory: [] }]);
      repo.groupBy.mockResolvedValue([{ status: 'draft', _count: { id: 7 } }]);
      repo.count.mockResolvedValue(7);
      const result = await service.getMyApplications('user-1', { page: '1', limit: '5' });
      expect(result.pagination).toMatchObject({ page: 1, limit: 5, total: 7, totalPages: 2 });
      expect(result.stats.total).toBe(7);
    });
  });

  // ── createContributors ────────────────────────────────────────────────────

  describe('createContributors()', () => {
    test('does nothing for empty contributors', async () => {
      await service.createContributors('ipr-1', 'Test', 'patent', 'user-1', []);
      expect(repo.createContributor).not.toHaveBeenCalled();
    });

    test('creates contributor records', async () => {
      repo.findUserByUid.mockResolvedValue({ id: 'contrib-user-1' });
      await service.createContributors('ipr-1', 'Test', 'patent', 'user-1', [
        { uid: 'contrib-uid', name: 'John Doe', email: 'john@example.com' },
      ]);
      expect(repo.createContributor).toHaveBeenCalledTimes(1);
      expect(repo.createNotification).toHaveBeenCalledTimes(1);
    });
  });

  // ── notifyMentor ──────────────────────────────────────────────────────────

  describe('notifyMentor()', () => {
    test('does nothing when mentor not found', async () => {
      repo.findUserByUid.mockResolvedValue(null);
      await service.notifyMentor('mentor-uid', 'patent', 'Test', 'PAT-2024-0001', 'ipr-1', 'user-1');
      expect(repo.createNotification).not.toHaveBeenCalled();
    });

    test('creates notification when mentor found', async () => {
      repo.findUserByUid.mockResolvedValue({ id: 'mentor-1' });
      await service.notifyMentor('mentor-uid', 'patent', 'Test', 'PAT-2024-0001', 'ipr-1', 'user-1');
      expect(repo.createNotification).toHaveBeenCalledTimes(1);
    });
  });

  // ── resolveSchoolDepartment - student path ────────────────────────────────

  describe('resolveSchoolDepartment() - student path', () => {
    test('resolves from student program when employee details missing', async () => {
      repo.findEmployeeDetails.mockResolvedValue(null);
      repo.findStudentDetails.mockResolvedValue({
        program: { department: { id: 'dept-3', facultyId: 'school-3' } },
      });
      const result = await service.resolveSchoolDepartment('user-1', null, null);
      expect(result.resolvedSchoolId).toBe('school-3');
      expect(result.resolvedDepartmentId).toBe('dept-3');
    });
  });
});

describe('IprService - resubmit and review coverage', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new IprService(repo);
  });

  // ── resubmitApplication ───────────────────────────────────────────────────

  describe('resubmitApplication()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.resubmitApplication('ipr-1', 'user-1')).rejects.toThrow();
    });

    test('throws 403 when user is not applicant', async () => {
      repo.findById.mockResolvedValue({ id: 'ipr-1', applicantUserId: 'other', status: 'changes_required', statusHistory: [] });
      await expect(service.resubmitApplication('ipr-1', 'user-1')).rejects.toThrow();
    });

    test('throws 400 when status is not changes_required', async () => {
      repo.findById.mockResolvedValue({ id: 'ipr-1', applicantUserId: 'user-1', status: 'draft', statusHistory: [] });
      await expect(service.resubmitApplication('ipr-1', 'user-1')).rejects.toThrow();
    });
  });

  // ── _resolveApplicantName ─────────────────────────────────────────────────

  describe('_resolveApplicantName()', () => {
    test('returns student name when studentLogin present', () => {
      const result = service._resolveApplicantName({ studentLogin: { firstName: 'John', lastName: 'Doe' } });
      expect(result).toBe('John Doe');
    });

    test('returns employee name when employeeDetails present', () => {
      const result = service._resolveApplicantName({ employeeDetails: { firstName: 'Jane', lastName: 'Smith' } });
      expect(result).toBe('Jane Smith');
    });

    test('returns default when no user details', () => {
      const result = service._resolveApplicantName(null);
      expect(result).toBe('An applicant');
    });
  });

  // ── getAllApplications - filters ──────────────────────────────────────────

  describe('getAllApplications() - filters', () => {
    test('applies iprType filter', async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);
      await service.getAllApplications({ iprType: 'patent', page: 1, limit: 10 });
      const callArgs = repo.findAll.mock.calls[0][0];
      expect(callArgs.where.iprType).toBe('patent');
    });

    test('applies schoolId filter', async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);
      await service.getAllApplications({ schoolId: 'school-1', page: 1, limit: 10 });
      const callArgs = repo.findAll.mock.calls[0][0];
      expect(callArgs.where.schoolId).toBe('school-1');
    });
  });
});
