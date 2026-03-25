/**
 * Unit Tests: GrantService
 * Requirements: 2.8, 2.1
 */

const GrantService = require('../../../modules/grants/services/grant.service');

function makeRepo(overrides = {}) {
  return {
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'grant-1', applicationNumber: 'GRT-2024-00001' }),
    update: jest.fn().mockResolvedValue({ id: 'grant-1' }),
    updateStatus: jest.fn().mockResolvedValue({ id: 'grant-1' }),
    delete: jest.fn().mockResolvedValue({ id: 'grant-1' }),
    createInvestigator: jest.fn().mockResolvedValue({}),
    deleteInvestigators: jest.fn().mockResolvedValue({}),
    deleteConsortiumOrgs: jest.fn().mockResolvedValue({}),
    createStatusHistory: jest.fn().mockResolvedValue({}),
    createReview: jest.fn().mockResolvedValue({}),
    findSuggestionById: jest.fn().mockResolvedValue(null),
    createSuggestion: jest.fn().mockResolvedValue({}),
    updateSuggestion: jest.fn().mockResolvedValue({}),
    findActivePolicy: jest.fn().mockResolvedValue(null),
    findDrdDepartment: jest.fn().mockResolvedValue(null),
    findDirectPermission: jest.fn().mockResolvedValue(null),
    findUserById: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('GrantService', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new GrantService(repo);
  });

  // ── generateApplicationNumber ─────────────────────────────────────────────

  describe('generateApplicationNumber()', () => {
    test('generates GRT-YYYY-NNNNN format when no existing grants', async () => {
      repo.findFirst.mockResolvedValue(null);
      const num = await service.generateApplicationNumber();
      expect(num).toMatch(/^GRT-\d{4}-\d{5}$/);
    });

    test('increments sequence based on latest application number', async () => {
      const year = new Date().getFullYear();
      repo.findFirst.mockResolvedValue({ applicationNumber: `GRT-${year}-00009` });
      const num = await service.generateApplicationNumber();
      expect(num).toBe(`GRT-${year}-00010`);
    });
  });

  // ── calculateGrantIncentives ──────────────────────────────────────────────

  describe('calculateGrantIncentives()', () => {
    test('returns null when no policy found', async () => {
      repo.findActivePolicy.mockResolvedValue(null);
      const result = await service.calculateGrantIncentives('government', 'research', 0);
      expect(result.calculatedIncentiveAmount).toBeNull();
      expect(result.calculatedPoints).toBeNull();
    });

    test('returns calculated incentive when policy found', async () => {
      repo.findActivePolicy.mockResolvedValue({ baseIncentiveAmount: 100000, basePoints: 100 });
      const result = await service.calculateGrantIncentives('government', 'research', 0);
      expect(result.calculatedIncentiveAmount).toBe(100000);
      expect(result.calculatedPoints).toBe(100);
    });
  });

  // ── resolveApplicantType ──────────────────────────────────────────────────

  describe('resolveApplicantType()', () => {
    test('returns internal_faculty when user has no student/staff role', async () => {
      repo.findUserById.mockResolvedValue({ id: 'user-1', role: 'faculty' });
      const result = await service.resolveApplicantType('user-1');
      expect(result).toBe('internal_faculty');
    });

    test('returns internal_student when user role is student', async () => {
      repo.findUserById.mockResolvedValue({ id: 'user-1', role: 'student' });
      const result = await service.resolveApplicantType('user-1');
      expect(result).toBe('internal_student');
    });

    test('returns internal_staff when user role is staff', async () => {
      repo.findUserById.mockResolvedValue({ id: 'user-1', role: 'staff' });
      const result = await service.resolveApplicantType('user-1');
      expect(result).toBe('internal_staff');
    });

    test('returns internal_faculty when user not found', async () => {
      repo.findUserById.mockResolvedValue(null);
      const result = await service.resolveApplicantType('user-1');
      expect(result).toBe('internal_faculty');
    });
  });

  // ── getApplicationById ────────────────────────────────────────────────────

  describe('getApplicationById()', () => {
    test('throws 404 when application not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getApplicationById('grant-1')).rejects.toThrow();
    });

    test('returns application when found', async () => {
      const app = { id: 'grant-1', title: 'Test Grant' };
      repo.findById.mockResolvedValue(app);
      const result = await service.getApplicationById('grant-1');
      expect(result.id).toBe('grant-1');
    });
  });

  // ── deleteApplication ─────────────────────────────────────────────────────

  describe('deleteApplication()', () => {
    test('throws 404 when application not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteApplication('grant-1', 'user-1')).rejects.toThrow();
    });

    test('throws 403 when user is not the applicant', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'other-user', status: 'draft' });
      await expect(service.deleteApplication('grant-1', 'user-1')).rejects.toThrow();
    });

    test('throws when application is not in draft status', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'user-1', status: 'submitted' });
      await expect(service.deleteApplication('grant-1', 'user-1')).rejects.toThrow();
    });

    test('deletes when user is applicant and status is draft', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'user-1', status: 'draft' });
      repo.delete.mockResolvedValue({ id: 'grant-1' });
      await expect(service.deleteApplication('grant-1', 'user-1')).resolves.not.toThrow();
      expect(repo.delete).toHaveBeenCalledWith('grant-1');
    });
  });

  // ── _buildOrgIdMap ────────────────────────────────────────────────────────

  describe('_buildOrgIdMap()', () => {
    test('returns empty map for empty inputs', () => {
      expect(service._buildOrgIdMap([], [])).toEqual({});
    });

    test('maps input org ids to created org ids by index position', () => {
      const inputOrgs = [{ id: 'input-1', organizationName: 'Org A' }, { id: 'input-2', organizationName: 'Org B' }];
      const createdOrgs = [{ id: 'org-1', organizationName: 'Org A' }, { id: 'org-2', organizationName: 'Org B' }];
      const map = service._buildOrgIdMap(inputOrgs, createdOrgs);
      expect(map['input-1']).toBe('org-1');
      expect(map['input-2']).toBe('org-2');
    });
  });
});

describe('GrantService - additional coverage', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new GrantService(repo);
  });

  // ── getMyApplications ─────────────────────────────────────────────────────

  describe('getMyApplications()', () => {
    test('returns applications for user', async () => {
      repo.findAll.mockResolvedValue([{ id: 'grant-1' }]);
      const result = await service.getMyApplications('user-1');
      expect(result).toHaveLength(1);
      expect(repo.findAll).toHaveBeenCalled();
    });

    test('returns pagination metadata when requested', async () => {
      repo.findAll.mockResolvedValue([{ id: 'grant-1' }]);
      repo.count.mockResolvedValue(31);
      const result = await service.getMyApplications('user-1', { page: '2', limit: '10' });
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toMatchObject({ page: 2, limit: 10, total: 31, totalPages: 4 });
    });
  });

  // ── submitApplication ─────────────────────────────────────────────────────

  describe('submitApplication()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.submitApplication('grant-1', 'user-1')).rejects.toThrow();
    });

    test('throws 403 when user is not applicant', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'other', status: 'draft' });
      await expect(service.submitApplication('grant-1', 'user-1')).rejects.toThrow();
    });

    test('throws 400 when status is not draft or changes_required', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'user-1', status: 'submitted' });
      await expect(service.submitApplication('grant-1', 'user-1')).rejects.toThrow();
    });

    test('submits draft application successfully', async () => {
      const year = new Date().getFullYear();
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'user-1', status: 'draft', applicationNumber: null, revisionCount: 0 });
      repo.findFirst.mockResolvedValue(null);
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'submitted', applicationNumber: `GRT-${year}-00001` });
      const result = await service.submitApplication('grant-1', 'user-1');
      expect(result.status).toBe('submitted');
    });
  });

  // ── startReview ───────────────────────────────────────────────────────────

  describe('startReview()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.startReview('grant-1', 'reviewer-1')).rejects.toThrow();
    });

    test('throws 400 when status is not submitted or resubmitted', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'draft' });
      await expect(service.startReview('grant-1', 'reviewer-1')).rejects.toThrow();
    });

    test('starts review for submitted application', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'submitted' });
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'under_review' });
      const result = await service.startReview('grant-1', 'reviewer-1');
      expect(result.status).toBe('under_review');
    });
  });

  // ── calculateGrantIncentives with bonuses ─────────────────────────────────

  describe('calculateGrantIncentives() - bonuses', () => {
    test('adds international bonus for international project type', async () => {
      repo.findActivePolicy.mockResolvedValue({
        baseIncentiveAmount: 100000,
        basePoints: 100,
        internationalBonus: 50000,
      });
      const result = await service.calculateGrantIncentives('government', 'international', 0);
      expect(result.calculatedIncentiveAmount).toBe(150000);
    });

    test('adds consortium bonus per org', async () => {
      repo.findActivePolicy.mockResolvedValue({
        baseIncentiveAmount: 100000,
        basePoints: 100,
        consortiumBonus: 10000,
      });
      const result = await service.calculateGrantIncentives('government', 'research', 3);
      expect(result.calculatedIncentiveAmount).toBe(130000);
    });
  });

  // ── markCompleted ─────────────────────────────────────────────────────────

  describe('markCompleted()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.markCompleted('grant-1', 'user-1')).rejects.toThrow();
    });

    test('throws 400 when not approved', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'submitted' });
      await expect(service.markCompleted('grant-1', 'user-1')).rejects.toThrow();
    });

    test('marks approved grant as completed', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'approved' });
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'completed' });
      const result = await service.markCompleted('grant-1', 'user-1');
      expect(result.status).toBe('completed');
    });
  });
});

describe('GrantService - workflow coverage', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new GrantService(repo);
  });

  // ── requestChanges ────────────────────────────────────────────────────────

  describe('requestChanges()', () => {
    test('throws 400 when no comments or suggestions', async () => {
      await expect(service.requestChanges('grant-1', 'user-1', null, [])).rejects.toThrow();
    });

    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.requestChanges('grant-1', 'user-1', 'needs work', [])).rejects.toThrow();
    });

    test('requests changes on under_review application', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'under_review' });
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'changes_required' });
      const result = await service.requestChanges('grant-1', 'user-1', 'needs work', []);
      expect(result.status).toBe('changes_required');
    });
  });

  // ── recommendForApproval ──────────────────────────────────────────────────

  describe('recommendForApproval()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.recommendForApproval('grant-1', 'user-1', 'good')).rejects.toThrow();
    });

    test('recommends under_review application', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'under_review' });
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'recommended' });
      const result = await service.recommendForApproval('grant-1', 'user-1', 'good');
      expect(result.status).toBe('recommended');
    });
  });

  // ── approveGrant ──────────────────────────────────────────────────────────

  describe('approveGrant()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.approveGrant('grant-1', 'user-1', 'approved')).rejects.toThrow();
    });

    test('approves recommended application', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'recommended', projectCategory: 'govt', projectType: 'indian', numberOfConsortiumOrgs: 0 });
      repo.findActivePolicy.mockResolvedValue(null);
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'approved' });
      const result = await service.approveGrant('grant-1', 'user-1', 'approved');
      expect(result.status).toBe('approved');
    });
  });

  // ── rejectGrant ───────────────────────────────────────────────────────────

  describe('rejectGrant()', () => {
    test('throws 400 when no comments or reason', async () => {
      await expect(service.rejectGrant('grant-1', 'user-1', null, null)).rejects.toThrow();
    });

    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.rejectGrant('grant-1', 'user-1', 'rejected', null)).rejects.toThrow();
    });

    test('rejects under_review application', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', status: 'under_review' });
      repo.update.mockResolvedValue({ id: 'grant-1', status: 'rejected' });
      const result = await service.rejectGrant('grant-1', 'user-1', 'not eligible', null);
      expect(result.status).toBe('rejected');
    });
  });

  // ── updateApplication ─────────────────────────────────────────────────────

  describe('updateApplication()', () => {
    test('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateApplication('grant-1', 'user-1', {})).rejects.toThrow();
    });

    test('throws 403 when user is not applicant', async () => {
      repo.findById.mockResolvedValue({ id: 'grant-1', applicantUserId: 'other', status: 'draft', consortiumOrganizations: [], investigators: [] });
      await expect(service.updateApplication('grant-1', 'user-1', {})).rejects.toThrow();
    });

    test('updates draft application', async () => {
      repo.findById
        .mockResolvedValueOnce({ id: 'grant-1', applicantUserId: 'user-1', status: 'draft', consortiumOrganizations: [], investigators: [] })
        .mockResolvedValueOnce({ id: 'grant-1', title: 'Updated', consortiumOrganizations: [], investigators: [] });
      repo.update.mockResolvedValue({ id: 'grant-1', consortiumOrganizations: [] });
      const result = await service.updateApplication('grant-1', 'user-1', { title: 'Updated', investigators: [], consortiumOrganizations: [] });
      expect(result.id).toBe('grant-1');
    });
  });

  // ── createInvestigators ───────────────────────────────────────────────────

  describe('createInvestigators()', () => {
    test('does nothing for empty investigators', async () => {
      await service.createInvestigators('grant-1', []);
      expect(repo.createInvestigator).not.toHaveBeenCalled();
    });

    test('creates investigator records', async () => {
      await service.createInvestigators('grant-1', [{ name: 'Dr. Smith', email: 'smith@example.com' }]);
      expect(repo.createInvestigator).toHaveBeenCalledTimes(1);
    });
  });
});

describe('GrantService - respondToSuggestion and _parseSuggestionValue', () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = makeRepo();
    service = new GrantService(repo);
  });

  // ── respondToSuggestion ───────────────────────────────────────────────────

  describe('respondToSuggestion()', () => {
    test('throws 404 when suggestion not found', async () => {
      repo.findSuggestionById.mockResolvedValue(null);
      await expect(service.respondToSuggestion('sug-1', 'user-1', true)).rejects.toThrow();
    });

    test('throws 403 when user is not the applicant', async () => {
      repo.findSuggestionById.mockResolvedValue({
        id: 'sug-1', status: 'pending',
        grantApplication: { applicantUserId: 'other-user' },
      });
      await expect(service.respondToSuggestion('sug-1', 'user-1', true)).rejects.toThrow();
    });

    test('throws 400 when suggestion already responded to', async () => {
      repo.findSuggestionById.mockResolvedValue({
        id: 'sug-1', status: 'accepted',
        grantApplication: { applicantUserId: 'user-1' },
      });
      await expect(service.respondToSuggestion('sug-1', 'user-1', true)).rejects.toThrow();
    });

    test('accepts suggestion and applies field update', async () => {
      repo.findSuggestionById.mockResolvedValue({
        id: 'sug-1', status: 'pending',
        fieldName: 'title', suggestedValue: 'New Title',
        grantApplicationId: 'grant-1',
        grantApplication: { applicantUserId: 'user-1' },
      });
      repo.updateSuggestion.mockResolvedValue({ id: 'sug-1', status: 'accepted' });
      repo.update.mockResolvedValue({ id: 'grant-1' });

      const result = await service.respondToSuggestion('sug-1', 'user-1', true);
      expect(result.status).toBe('accepted');
      expect(repo.update).toHaveBeenCalledWith('grant-1', { title: 'New Title' });
    });

    test('rejects suggestion without applying field update', async () => {
      repo.findSuggestionById.mockResolvedValue({
        id: 'sug-1', status: 'pending',
        fieldName: 'title', suggestedValue: 'New Title',
        grantApplicationId: 'grant-1',
        grantApplication: { applicantUserId: 'user-1' },
      });
      repo.updateSuggestion.mockResolvedValue({ id: 'sug-1', status: 'rejected' });

      const result = await service.respondToSuggestion('sug-1', 'user-1', false);
      expect(result.status).toBe('rejected');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ── getPendingReviews ─────────────────────────────────────────────────────

  describe('getPendingReviews()', () => {
    test('throws 403 when user has no review or approve permissions', async () => {
      await expect(service.getPendingReviews('user-1', {})).rejects.toThrow();
    });

    test('returns submitted/under_review/resubmitted for reviewer', async () => {
      repo.findDrdDepartment.mockResolvedValue(null);
      repo.findAll.mockResolvedValue([{ id: 'grant-1', status: 'submitted' }]);
      const result = await service.getPendingReviews('user-1', { research_review: true });
      expect(result).toHaveLength(1);
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { in: ['submitted', 'under_review', 'resubmitted'] } }) })
      );
    });

    test('includes recommended status for approver', async () => {
      repo.findDrdDepartment.mockResolvedValue(null);
      repo.findAll.mockResolvedValue([]);
      await service.getPendingReviews('user-1', { research_approve: true });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { in: ['submitted', 'under_review', 'resubmitted', 'recommended'] } }) })
      );
    });

    test('applies school filter when reviewer has assigned schools', async () => {
      repo.findDrdDepartment.mockResolvedValue({ id: 'dept-1' });
      repo.findDirectPermission.mockResolvedValue({ assignedGrantSchoolIds: ['school-1', 'school-2'] });
      repo.findAll.mockResolvedValue([]);
      await service.getPendingReviews('user-1', { research_review: true });
      const callArgs = repo.findAll.mock.calls[0][0];
      expect(callArgs.where.schoolId).toEqual({ in: ['school-1', 'school-2'] });
    });

    test('proceeds without school filter when DRD dept lookup fails', async () => {
      repo.findDrdDepartment.mockRejectedValue(new Error('DB error'));
      repo.findAll.mockResolvedValue([]);
      await expect(service.getPendingReviews('user-1', { research_review: true })).resolves.toBeDefined();
    });
  });

  // ── _parseSuggestionValue ─────────────────────────────────────────────────

  describe('_parseSuggestionValue()', () => {
    test('parses number fields as integers', () => {
      expect(service._parseSuggestionValue('submittedAmount', '500000')).toEqual({ submittedAmount: 500000 });
      expect(service._parseSuggestionValue('totalInvestigators', '3')).toEqual({ totalInvestigators: 3 });
    });

    test('parses date fields by appending time component', () => {
      const result = service._parseSuggestionValue('projectStartDate', '2024-01-15');
      expect(result.projectStartDate).toContain('2024-01-15');
    });

    test('parses sdgGoals as comma-split array', () => {
      expect(service._parseSuggestionValue('sdgGoals', 'SDG1,SDG2,SDG3')).toEqual({ sdgGoals: ['SDG1', 'SDG2', 'SDG3'] });
    });

    test('parses isPIExternal as boolean', () => {
      expect(service._parseSuggestionValue('isPIExternal', 'true')).toEqual({ isPIExternal: true });
      expect(service._parseSuggestionValue('isPIExternal', 'false')).toEqual({ isPIExternal: false });
    });

    test('lowercases enum fields', () => {
      expect(service._parseSuggestionValue('projectCategory', 'GOVT')).toEqual({ projectCategory: 'govt' });
    });

    test('returns raw string for unrecognized fields', () => {
      expect(service._parseSuggestionValue('title', 'My Grant')).toEqual({ title: 'My Grant' });
    });
  });
});
