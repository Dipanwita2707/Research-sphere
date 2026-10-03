/**
 * Grant Service
 * Contains all grant business logic, extracted from grant.controller.js.
 * Accepts grantRepository, emailService via constructor.
 */

const {
  logResearchFiling,
  logResearchUpdate,
  logResearchStatusChange,
  logFileUpload,
} = require('../../../shared/utils/auditLogger');
const log = require('../../../shared/utils/logger');
const { canViewGrant, notFound } = require('../../research/utils/objectAccess');
const reviewScope = require('../../research/services/reviewScope');
const payoutService = require('../../finance/services/incentivePayout.service');
const { toNumber, assertWithinCap } = require('../../research/utils/policyMath');
const { grantPolicyDate } = require('../utils/grantPolicyDate');
const {
  GrantProjectTypeEnum,
  GrantProjectStatusEnum,
  GrantProjectCategoryEnum,
  GrantFundingAgencyEnum,
  GrantInvestigatorRoleEnum,
} = require('@prisma/client');

/** Enum-typed inputs on grant create/update/suggestions, validated against the Prisma enums. */
const GRANT_ENUM_FIELDS = {
  projectType: GrantProjectTypeEnum,
  projectStatus: GrantProjectStatusEnum,
  projectCategory: GrantProjectCategoryEnum,
  fundingAgencyType: GrantFundingAgencyEnum,
  myRole: GrantInvestigatorRoleEnum,
};

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function checkEnumValue(label, value, enumObj) {
  if (value === undefined || value === null || value === '') return value;
  const allowed = Object.values(enumObj);
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (!allowed.includes(normalized)) {
    throw badRequest(`Invalid ${label} '${value}'. Allowed values: ${allowed.join(', ')}`);
  }
  return normalized;
}

/**
 * Validate (and normalise to lower case) the enum fields of a grant payload.
 * Unknown values are a 400 listing the allowed values, instead of a Prisma 500.
 * @param {object} data - request payload (not mutated)
 * @returns {object} a copy with normalised enum values
 */
function validateGrantEnums(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  for (const [field, enumObj] of Object.entries(GRANT_ENUM_FIELDS)) {
    if (field in out) out[field] = checkEnumValue(field, out[field], enumObj);
  }
  if (Array.isArray(out.investigators)) {
    out.investigators = out.investigators.map((inv, i) => (
      inv && typeof inv === 'object' && 'roleType' in inv
        ? { ...inv, roleType: checkEnumValue(`investigators[${i}].roleType`, inv.roleType, GrantInvestigatorRoleEnum) }
        : inv
    ));
  }
  return out;
}

const REVIEW_PERMISSION_KEYS = ['grant_review', 'research_review', 'drd_grant_review', 'drd_research_review'];
const MAX_REVIEWER_NOTIFICATIONS = 50;

function formatInr(amount) {
  return Number(amount || 0).toLocaleString('en-IN');
}

function displayNameOf(user) {
  const p = user?.employeeDetails || user?.studentLogin;
  return p?.displayName || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || user?.uid || null;
}

/**
 * Put an approved grant's incentive into the payout ledger.
 * The applicant receives the full incentive: per-investigator shares are not computed for
 * grants, so there is nothing to split by. Skipped when there is neither money nor points.
 * The date that selected the policy (grantPolicyDate) also picks the line's incentive cycle.
 */
async function createGrantPayoutLines(tx, grant, { approvedAt, actorId }) {
  const amount = Number(grant.incentiveAmount ?? grant.calculatedIncentiveAmount) || 0;
  const points = Number(grant.pointsAwarded ?? grant.calculatedPoints) || 0;
  if ((amount <= 0 && points <= 0) || !grant.applicantUserId) return { created: 0, skippedDuplicates: 0 };
  const applicant = await tx.userLogin.findUnique({
    where: { id: grant.applicantUserId },
    select: {
      uid: true,
      employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
      studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
    },
  });
  return payoutService.createLines(tx, {
    universityId: grant.universityId,
    sourceType: 'grant',
    sourceId: grant.id,
    workType: 'grant',
    title: grant.title,
    referenceNumber: grant.applicationNumber,
    workKey: null,
    approvedAt,
    policyDate: grantPolicyDate(grant, approvedAt).date,
    actorId,
    payees: [{ userId: grant.applicantUserId, name: displayNameOf(applicant), role: 'applicant', amount, points }],
  });
}

const GRANT_LIST_SELECT = {
  id: true,
  applicationNumber: true,
  applicantUserId: true,
  title: true,
  submittedAmount: true,
  projectType: true,
  totalInvestigators: true,
  fundingAgencyName: true,
  status: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  calculatedIncentiveAmount: true,
  calculatedPoints: true,
  isPIExternal: true,
  myRole: true,
  consortiumOrganizations: {
    select: {
      id: true,
      organizationName: true,
      country: true,
    },
  },
  investigators: {
    select: {
      id: true,
      isInternal: true,
      roleType: true,
    },
  },
  school: {
    select: {
      id: true,
      facultyName: true,
      shortName: true,
    },
  },
  department: {
    select: {
      id: true,
      departmentName: true,
      shortName: true,
    },
  },
  applicantUser: {
    select: {
      uid: true,
      email: true,
      employeeDetails: {
        select: {
          displayName: true,
        },
      },
    },
  },
};

function normalizeGrantListItem(grant) {
  return {
    ...grant,
    agencyName: grant.fundingAgencyName || null,
  };
}

function parsePaginationQuery(query = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  return {
    usePagination: query.page !== undefined || query.limit !== undefined,
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

class GrantService {
  /**
   * @param {import('../repositories/grant.repository')} grantRepository
   * @param {object} [emailService]
   */
  constructor(grantRepository, emailService = null, notifier = null) {
    this.repo = grantRepository;
    this.emailService = emailService;
    // Same dispatch mechanism as research (researchWorkflowQueue.dispatchNotification),
    // falling back to a direct notification insert.
    this.notifier = notifier;
  }

  // ─── Application Number Generation ────────────────────────────────────────

  /**
   * Generate a unique application number for grants.
   * @returns {Promise<string>}
   */
  async generateApplicationNumber() {
    const year = new Date().getFullYear();
    const prefix = `GRT-${year}`;

    const lastGrant = await this.repo.findFirst(
      { applicationNumber: { startsWith: prefix } },
      { orderBy: { applicationNumber: 'desc' } }
    );

    let nextNumber = 1;
    if (lastGrant?.applicationNumber) {
      const lastNumber = parseInt(lastGrant.applicationNumber.split('-').pop() || '0');
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  }

  // ─── Applicant Type Resolution ─────────────────────────────────────────────

  /**
   * Determine the applicant type from the user's role.
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async resolveApplicantType(userId) {
    const userLogin = await this.repo.findUserById(userId, {
      employeeDetails: true,
      studentLogin: true,
    });

    if (userLogin?.role === 'student') return 'internal_student';
    if (userLogin?.role === 'staff') return 'internal_staff';
    return 'internal_faculty';
  }

  // ─── Incentive Calculation ─────────────────────────────────────────────────

  /**
   * Calculate grant incentives based on the active policy.
   * @param {string} projectCategory
   * @param {string} projectType
   * @param {number} numberOfConsortiumOrgs
   * @param {Date} [onDate] date selecting the policy (see grantPolicyDate); default today
   * @returns {Promise<{ calculatedIncentiveAmount: number|null, calculatedPoints: number|null, policyFound: boolean }>}
   *   null amounts (policyFound false) when no policy covers the grant — approval then needs
   *   an explicit ₹0 confirmation. Database/programming errors and an amount above the
   *   per-work cap are logged and rethrown, never turned into a silent ₹0.
   */
  async calculateGrantIncentives(projectCategory, projectType, numberOfConsortiumOrgs, onDate = new Date()) {
    try {
      const policy = await this.repo.findActivePolicy(projectCategory, projectType, onDate);
      if (!policy) return { calculatedIncentiveAmount: null, calculatedPoints: null, policyFound: false };

      // Decimal columns → numbers before any arithmetic (no string concatenation).
      let amount = toNumber(policy.baseIncentiveAmount);
      const points = toNumber(policy.basePoints);

      if (projectType === 'international' && policy.internationalBonus) {
        amount += toNumber(policy.internationalBonus);
      }

      const consortiumOrgs = toNumber(numberOfConsortiumOrgs);
      if (consortiumOrgs > 0 && policy.consortiumBonus) {
        amount += toNumber(policy.consortiumBonus) * consortiumOrgs;
      }

      assertWithinCap(amount, 'this grant');
      return { calculatedIncentiveAmount: amount, calculatedPoints: points, policyFound: true, policyId: policy.id || null };
    } catch (err) {
      log.error('[GrantService] calculateGrantIncentives failed:', err.message);
      throw err;
    }
  }

  // ─── Investigator Creation ─────────────────────────────────────────────────

  /**
   * Create investigator records for a grant application.
   * @param {string} grantApplicationId
   * @param {object[]} investigators
   * @param {object} orgIdMap - mapping from input org IDs to created org IDs
   */
  async createInvestigators(grantApplicationId, investigators, orgIdMap = {}) {
    if (!investigators || investigators.length === 0) return;

    for (const inv of investigators) {
      await this.repo.createInvestigator({
        grantApplicationId,
        userId: inv.userId || null,
        uid: inv.uid || null,
        name: inv.name,
        email: inv.email || null,
        phone: inv.phone || null,
        designation: inv.designation || null,
        affiliation: inv.affiliation || null,
        department: inv.department || null,
        roleType: inv.roleType || 'co_pi',
        isInternal: inv.isInternal !== false,
        investigatorType: inv.investigatorType || 'Faculty',
        consortiumOrgId: inv.consortiumOrgId ? (orgIdMap[inv.consortiumOrgId] || null) : null,
        isTeamCoordinator: inv.isTeamCoordinator || false,
        displayOrder: inv.displayOrder || 0,
      });
    }
  }

  // ─── Create Application ────────────────────────────────────────────────────

  /**
   * Create a new grant application (draft or immediate submit).
   * @param {object} data - parsed request body
   * @param {string} userId
   * @param {object|null} file - uploaded file (from multer)
   * @param {Function} uploadToS3 - S3 upload utility
   * @param {object} req - Express request (for audit logging)
   * @returns {Promise<{ grant: object, message: string }>}
   */
  async createApplication(data, userId, file, uploadToS3, req) {
    data = validateGrantEnums(data);
    const applicantType = await this.resolveApplicantType(userId);

    // Auto-resolve school/dept from applicant profile (covers both employees and students)
    const { resolvedSchoolId, resolvedDepartmentId } = await this._resolveSchoolAndDepartment(
      userId, data.schoolId, data.departmentId
    );
    const enrichedData = { ...data, schoolId: resolvedSchoolId, departmentId: resolvedDepartmentId };

    let proposalFilePath = null;
    if (file) {
      const s3Result = await uploadToS3(
        file.buffer,
        'research/grants',
        userId.toString(),
        file.originalname,
        file.mimetype
      );
      proposalFilePath = s3Result.key;
    }

    const shouldSubmitImmediately = data.status === 'submitted';
    const createStatus = 'draft';

    const grantApplication = await this.repo.create(
      this._buildCreateData(enrichedData, userId, applicantType, proposalFilePath, createStatus),
      { consortiumOrganizations: true, school: true, department: true }
    );

    const orgIdMap = this._buildOrgIdMap(data.consortiumOrganizations, grantApplication.consortiumOrganizations);
    await this.createInvestigators(grantApplication.id, data.investigators, orgIdMap);

    await this.repo.createStatusHistory({
      grantApplicationId: grantApplication.id,
      fromStatus: null,
      toStatus: createStatus,
      changedById: userId,
      comments: 'Draft created',
    });

    let finalGrant = grantApplication;
    if (shouldSubmitImmediately) {
      finalGrant = await this._submitDraft(grantApplication, userId);
    }

    const completeGrant = await this._fetchComplete(grantApplication.id);
    await this._logCreation(completeGrant, userId, req, proposalFilePath, file, shouldSubmitImmediately, finalGrant);

    if (shouldSubmitImmediately) {
      await this._notifySubmitted({ ...grantApplication, ...finalGrant }, false);
    }

    const message = shouldSubmitImmediately
      ? 'Grant application submitted successfully'
      : 'Draft saved successfully';

    return { grant: completeGrant, message };
  }

  // ─── Get My Applications ───────────────────────────────────────────────────

  /**
   * Get all grant applications for the authenticated user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async getMyApplications(userId, query = {}) {
    const pagination = parsePaginationQuery(query);
    const where = {
      OR: [
        { applicantUserId: userId },
        { investigators: { some: { userId } } },
      ],
    };
    const [grants, total] = await Promise.all([
      this.repo.findAll({
        where,
        select: GRANT_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        ...(pagination.usePagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      }),
      pagination.usePagination ? this.repo.count(where) : Promise.resolve(null),
    ]);
    const data = grants.map(normalizeGrantListItem);
    return pagination.usePagination
      ? {
          data,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages: Math.ceil(total / pagination.limit),
          },
        }
      : data;
  }

  // ─── Get Application By ID ─────────────────────────────────────────────────

  /**
   * Get a single grant application by ID.
   * Tenant isolation is enforced by the Prisma extension; within the tenant only the
   * applicant, investigators, reviewers and grant/finance staff may see the record.
   * @param {string} id
   * @param {object} [viewer] - req.user; omit only from internal code that already authorised access
   * @returns {Promise<object>} throws 404 when missing or not visible to the viewer
   */
  async getApplicationById(id, viewer = undefined) {
    const grant = await this.repo.findById(id, this._detailInclude());
    if (!grant || (viewer !== undefined && !canViewGrant(viewer, grant))) {
      throw notFound('Grant application not found');
    }
    return grant;
  }

  // ─── Update Application ────────────────────────────────────────────────────

  /**
   * Update a grant application (draft or changes_required only).
   * @param {string} id
   * @param {string} userId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateApplication(id, userId, data) {
    data = validateGrantEnums(data);
    const existing = await this.repo.findById(id, {
      consortiumOrganizations: true,
      investigators: true,
    });

    if (!existing) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (existing.applicantUserId !== userId) {
      const err = new Error('You do not have permission to edit this application');
      err.statusCode = 403;
      throw err;
    }

    if (!['draft', 'changes_required'].includes(existing.status)) {
      const err = new Error('This application cannot be edited in its current status');
      err.statusCode = 400;
      throw err;
    }

    await this.repo.deleteInvestigators(id);
    await this.repo.deleteConsortiumOrgs(id);

    const updatedGrant = await this.repo.update(
      id,
      this._buildUpdateData(data),
      { consortiumOrganizations: true }
    );

    const orgIdMap = this._buildOrgIdMap(data.consortiumOrganizations, updatedGrant.consortiumOrganizations);
    await this.createInvestigators(id, data.investigators, orgIdMap);

    return this.repo.findById(id, {
      consortiumOrganizations: true,
      investigators: { include: { consortiumOrg: true }, orderBy: { displayOrder: 'asc' } },
      school: true,
      department: true,
    });
  }

  // ─── Submit Application ────────────────────────────────────────────────────

  /**
   * Submit a draft or changes_required grant application.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async submitApplication(id, userId) {
    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (grant.applicantUserId !== userId) {
      const err = new Error('You do not have permission to submit this application');
      err.statusCode = 403;
      throw err;
    }

    if (!['draft', 'changes_required'].includes(grant.status)) {
      const err = new Error('This application cannot be submitted in its current status');
      err.statusCode = 400;
      throw err;
    }

    let applicationNumber = grant.applicationNumber;
    if (!applicationNumber) {
      applicationNumber = await this.generateApplicationNumber();
    }

    const newStatus = grant.status === 'changes_required' ? 'resubmitted' : 'submitted';
    const statusComment = grant.status === 'changes_required'
      ? 'Resubmitted after changes'
      : 'Application submitted for review';

    const updatedGrant = await this.repo.update(id, {
      applicationNumber,
      status: newStatus,
      submittedAt: new Date(),
      revisionCount: grant.status === 'changes_required' ? grant.revisionCount + 1 : grant.revisionCount,
    });

    await this.repo.createStatusHistory({
      grantApplicationId: id,
      fromStatus: grant.status,
      toStatus: newStatus,
      changedById: userId,
      comments: statusComment,
    });

    await this._notifySubmitted({ ...grant, ...updatedGrant, applicationNumber }, newStatus === 'resubmitted');

    return updatedGrant;
  }

  // ─── Delete Application ────────────────────────────────────────────────────

  /**
   * Delete a draft grant application.
   * @param {string} id
   * @param {string} userId
   */
  async deleteApplication(id, userId) {
    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (grant.applicantUserId !== userId) {
      const err = new Error('You do not have permission to delete this application');
      err.statusCode = 403;
      throw err;
    }

    if (grant.status !== 'draft') {
      const err = new Error('Only draft applications can be deleted');
      err.statusCode = 400;
      throw err;
    }

    await this.repo.delete(id);
  }

  // ─── Get Pending Reviews ───────────────────────────────────────────────────

  /**
   * Get pending grant applications for DRD review.
   * @param {string} userId
   * @param {object} mergedPermissions
   * @returns {Promise<object[]>}
   */
  async getPendingReviews(userId, mergedPermissions, query = {}, tenantId = null) {
    const pagination = parsePaginationQuery(query);
    const hasReviewPerm = mergedPermissions.research_review === true || mergedPermissions.grant_review === true;
    const hasApprovePerm = mergedPermissions.research_approve === true || mergedPermissions.grant_approve === true;

    if (!hasReviewPerm && !hasApprovePerm) {
      const err = new Error('Access denied - No grant review permissions');
      err.statusCode = 403;
      throw err;
    }

    let assignedGrantSchoolIds = [];
    try {
      const drdDept = await this.repo.findDrdDepartment();
      if (drdDept) {
        const directPermission = await this.repo.findDirectPermission(userId, drdDept.id);
        assignedGrantSchoolIds = reviewScope.normalizeIds(directPermission?.assignedGrantSchoolIds);
      }
    } catch {
      // Non-fatal: proceed without school filter
    }

    const statusFilter = hasApprovePerm
      ? ['submitted', 'under_review', 'resubmitted', 'recommended']
      : ['submitted', 'under_review', 'resubmitted'];

    const where = { status: { in: statusFilter } };
    // Assigned grant schools restrict reviewers and approvers alike (empty list = all schools),
    // matching the school-scope check on every grant review action.
    if (assignedGrantSchoolIds.length > 0) {
      where.schoolId = { in: assignedGrantSchoolIds };
    }
    if (tenantId) {
      where.applicantUser = { universityId: tenantId };
    }

    const [grants, total] = await Promise.all([
      this.repo.findAll({
        where,
        select: GRANT_LIST_SELECT,
        orderBy: { submittedAt: 'asc' },
        ...(pagination.usePagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      }),
      pagination.usePagination ? this.repo.count(where) : Promise.resolve(null),
    ]);
    const data = grants.map(normalizeGrantListItem);
    return pagination.usePagination
      ? {
          data,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages: Math.ceil(total / pagination.limit),
          },
        }
      : data;
  }

  // ─── Start Review ──────────────────────────────────────────────────────────

  /**
   * Start reviewing a grant application.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async startReview(id, userId) {
    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['submitted', 'resubmitted'].includes(grant.status)) {
      const err = new Error('Grant application cannot be reviewed in its current status');
      err.statusCode = 400;
      throw err;
    }

    const updatedGrant = await this.repo.update(id, {
      status: 'under_review',
      currentReviewerId: userId,
    });

    await this.repo.createReview({
      grantApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'reviewer',
      decision: 'reviewing',
      comments: 'Review started',
    });

    await this.repo.createStatusHistory({
      grantApplicationId: id,
      fromStatus: grant.status,
      toStatus: 'under_review',
      changedById: userId,
      comments: 'Review process started',
    });

    return updatedGrant;
  }

  // ─── Request Changes ───────────────────────────────────────────────────────

  /**
   * Request changes on a grant application.
   * @param {string} id
   * @param {string} userId
   * @param {string} comments
   * @param {object[]} suggestions
   * @returns {Promise<object>}
   */
  async requestChanges(id, userId, comments, suggestions) {
    if (!comments && (!suggestions || suggestions.length === 0)) {
      const err = new Error('Comments or field suggestions are required when requesting changes');
      err.statusCode = 400;
      throw err;
    }

    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['under_review', 'resubmitted', 'recommended'].includes(grant.status)) {
      const err = new Error('Changes can only be requested for applications under review, resubmitted, or recommended');
      err.statusCode = 400;
      throw err;
    }

    const updatedGrant = await this.repo.update(id, {
      status: 'changes_required',
      currentReviewerId: null,
    });

    await this.repo.createReview({
      grantApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'reviewer',
      decision: 'changes_required',
      comments: comments || 'Field changes suggested',
      reviewedAt: new Date(),
    });

    if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
      await Promise.all(
        suggestions.map((s) =>
          this.repo.createSuggestion({
            grantApplicationId: id,
            reviewerId: userId,
            fieldName: s.fieldName,
            fieldPath: s.fieldPath,
            originalValue: s.originalValue || '',
            suggestedValue: s.suggestedValue || '',
            suggestionNote: s.note || '',
            status: 'pending',
          })
        )
      );
    }

    await this.repo.createStatusHistory({
      grantApplicationId: id,
      fromStatus: grant.status,
      toStatus: 'changes_required',
      changedById: userId,
      comments: comments || 'Field changes suggested',
    });

    const suggestionCount = Array.isArray(suggestions) ? suggestions.length : 0;
    await this._notifyApplicant(grant, {
      type: 'grant_changes_requested',
      title: 'Changes Requested for Your Grant Application',
      message: `DRD has requested changes to your grant application "${grant.title}".`
        + (comments ? ` Comments: ${comments}` : '')
        + (suggestionCount ? ` (${suggestionCount} field suggestion${suggestionCount === 1 ? '' : 's'})` : '')
        + ' Please update and resubmit.',
      metadata: { comments: comments || null, suggestionCount, actionLabel: 'View & Update' },
    });

    return updatedGrant;
  }

  // ─── Recommend For Approval ────────────────────────────────────────────────

  /**
   * Recommend a grant application for approval.
   * @param {string} id
   * @param {string} userId
   * @param {string} comments
   * @returns {Promise<object>}
   */
  async recommendForApproval(id, userId, comments) {
    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['under_review', 'resubmitted'].includes(grant.status)) {
      const err = new Error('Only applications under review or resubmitted can be recommended');
      err.statusCode = 400;
      throw err;
    }

    const previousStatus = grant.status;
    const updatedGrant = await this.repo.update(id, {
      status: 'recommended',
      currentReviewerId: null,
    });

    await this.repo.createReview({
      grantApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'reviewer',
      decision: 'recommended',
      comments: comments || 'Recommended for approval',
      reviewedAt: new Date(),
    });

    await this.repo.createStatusHistory({
      grantApplicationId: id,
      fromStatus: previousStatus,
      toStatus: 'recommended',
      changedById: userId,
      comments: comments || 'Recommended for approval by reviewer',
    });

    await this._notifyApplicant(grant, {
      type: 'grant_recommended',
      title: 'Grant Application Recommended',
      message: `Your grant application "${grant.title}" has been recommended for approval by the DRD reviewer.`,
      metadata: { comments: comments || null },
    });

    return updatedGrant;
  }

  // ─── Approve Grant ─────────────────────────────────────────────────────────

  /**
   * Approve a grant application (DRD Head).
   * @param {string} id
   * @param {string} userId
   * @param {string} comments
   * @param {object} [options]
   * @param {boolean} [options.confirmZeroIncentive] approve even though no policy applies (₹0)
   * @returns {Promise<object>}
   */
  async approveGrant(id, userId, comments, options = {}) {
    const { confirmZeroIncentive = false } = options;
    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['under_review', 'resubmitted', 'recommended'].includes(grant.status)) {
      const err = new Error('Only applications under review, resubmitted, or recommended can be approved');
      err.statusCode = 400;
      throw err;
    }

    const previousStatus = grant.status;
    // The policy is chosen by a date on the grant: sanction date, else submission date, else
    // the approval date (recorded in the history and returned in incentiveBreakdown).
    const policyDate = grantPolicyDate(grant, new Date());
    const policyDateText = `${policyDate.label} ${policyDate.date.toISOString().slice(0, 10)}`;
    const { calculatedIncentiveAmount, calculatedPoints, policyFound, policyId } = await this.calculateGrantIncentives(
      grant.projectCategory,
      grant.projectType,
      grant.numberOfConsortiumOrgs || 0,
      policyDate.date
    );

    // No policy (or a policy worth ₹0): never approve with a silent ₹0 — the approver must
    // confirm it explicitly (confirmZeroIncentive), and that is recorded in the history.
    const zeroIncentive = calculatedIncentiveAmount === null || calculatedIncentiveAmount === undefined
      || Number(calculatedIncentiveAmount) === 0;
    if (zeroIncentive && !confirmZeroIncentive) {
      const err = new Error(calculatedIncentiveAmount === null || calculatedIncentiveAmount === undefined
        ? `No grant incentive policy covers ${grant.projectCategory || 'this'} / ${grant.projectType || 'this'} grants on the grant's ${policyDateText} — approving now pays ₹0 incentive. Configure a policy, or confirm approval with ₹0 incentive.`
        : 'The applicable grant incentive policy computes ₹0 for this grant. Confirm approval with ₹0 incentive.');
      err.statusCode = 409;
      err.code = 'NO_INCENTIVE_POLICY';
      throw err;
    }
    const zeroNote = zeroIncentive
      ? ` [Approved with ₹0 incentive — confirmed by approver: ${calculatedIncentiveAmount === null || calculatedIncentiveAmount === undefined ? 'no grant incentive policy applies' : 'policy computes ₹0'}]`
      : '';

    // The approval writes and the payout line are one unit: an approved grant always has
    // its ledger line, and a failed ledger write rolls the approval back.
    const approve = async (repo, tx) => {
      const now = new Date();
      const updatedGrant = await repo.update(id, {
        status: 'approved',
        approvedAt: now,
        approvedById: userId,
        currentReviewerId: null,
        calculatedIncentiveAmount,
        calculatedPoints,
        incentiveAmount: calculatedIncentiveAmount,
        pointsAwarded: calculatedPoints,
      });

      await repo.createReview({
        grantApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'approver',
        decision: 'approved',
        comments: comments || 'Grant application approved',
        reviewedAt: now,
      });

      await repo.createStatusHistory({
        grantApplicationId: id,
        fromStatus: previousStatus,
        toStatus: 'approved',
        changedById: userId,
        comments: `${comments || 'Grant application approved by DRD'} [Incentive policy selected by ${policyDateText}]${zeroNote}`,
      });

      if (tx) await createGrantPayoutLines(tx, { ...grant, ...updatedGrant }, { approvedAt: now, actorId: userId });
      return updatedGrant;
    };

    const client = this.repo.prisma;
    const approvedGrant = !client?.$transaction
      ? await approve(this.repo, null)
      : await client.$transaction(async (tx) => {
        const txRepo = Object.create(this.repo);
        txRepo.prisma = tx;
        return approve(txRepo, tx);
      });

    // After commit: tell the applicant (never fails the approval).
    const amount = Number(calculatedIncentiveAmount) || 0;
    await this._notifyApplicant(grant, {
      type: 'grant_approved',
      title: amount > 0 ? 'Grant Approved [PAYMENT]' : 'Grant Approved',
      message: amount > 0
        ? `Your grant "${grant.title}" was approved. Incentive ₹${formatInr(amount)} approved; finance will process the payment.`
        : `Your grant "${grant.title}" was approved.`,
      metadata: { incentiveAmount: calculatedIncentiveAmount, pointsAwarded: calculatedPoints, comments: comments || null },
    });

    return {
      ...approvedGrant,
      incentiveBreakdown: {
        totalIncentiveAwarded: Number(calculatedIncentiveAmount) || 0,
        totalPointsAwarded: Number(calculatedPoints) || 0,
        policyFound: Boolean(policyFound),
        policyId: policyId || null,
        policyDateBasis: policyDate.basis,
        policyDate: policyDate.date.toISOString().slice(0, 10),
        zeroIncentiveConfirmed: zeroIncentive,
      },
    };
  }

  // ─── Reject Grant ──────────────────────────────────────────────────────────

  /**
   * Reject a grant application.
   * @param {string} id
   * @param {string} userId
   * @param {string} comments
   * @param {string} reason
   * @returns {Promise<object>}
   */
  async rejectGrant(id, userId, comments, reason) {
    if (!comments && !reason) {
      const err = new Error('Comments or reason required when rejecting');
      err.statusCode = 400;
      throw err;
    }

    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['under_review', 'submitted', 'resubmitted', 'recommended'].includes(grant.status)) {
      const err = new Error('Grant application cannot be rejected in its current status');
      err.statusCode = 400;
      throw err;
    }

    const updatedGrant = await this.repo.update(id, {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedById: userId,
      currentReviewerId: null,
    });

    await this.repo.createReview({
      grantApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'approver',
      decision: 'rejected',
      comments: comments || reason || 'Grant application rejected',
      reviewedAt: new Date(),
    });

    await this.repo.createStatusHistory({
      grantApplicationId: id,
      fromStatus: grant.status,
      toStatus: 'rejected',
      changedById: userId,
      comments: comments || reason || 'Grant application rejected',
    });

    const why = comments || reason;
    await this._notifyApplicant(grant, {
      type: 'grant_rejected',
      title: 'Grant Application Rejected',
      message: `Your grant application "${grant.title}" was rejected by DRD.${why ? ` Reason: ${why}` : ''}`,
      metadata: { comments: comments || null, reason: reason || null },
    });

    return updatedGrant;
  }

  // ─── Mark Completed ────────────────────────────────────────────────────────

  /**
   * Mark an approved grant application as completed.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async markCompleted(id, userId) {
    const grant = await this.repo.findById(id);

    if (!grant) {
      const err = new Error('Grant application not found');
      err.statusCode = 404;
      throw err;
    }

    if (grant.status !== 'approved') {
      const err = new Error('Only approved grants can be marked as completed');
      err.statusCode = 400;
      throw err;
    }

    const updatedGrant = await this.repo.update(id, {
      status: 'completed',
      completedAt: new Date(),
    });

    await this.repo.createStatusHistory({
      grantApplicationId: id,
      fromStatus: 'approved',
      toStatus: 'completed',
      changedById: userId,
      comments: 'Grant application marked as completed',
    });

    return updatedGrant;
  }

  // ─── Respond To Suggestion ─────────────────────────────────────────────────

  /**
   * Accept or reject a field suggestion for a grant application.
   * @param {string} suggestionId
   * @param {string} userId
   * @param {boolean} accept
   * @returns {Promise<object>}
   */
  async respondToSuggestion(suggestionId, userId, accept) {
    const suggestion = await this.repo.findSuggestionById(suggestionId, {
      grantApplication: true,
    });

    if (!suggestion) {
      const err = new Error('Suggestion not found');
      err.statusCode = 404;
      throw err;
    }

    if (suggestion.grantApplication.applicantUserId !== userId) {
      const err = new Error('You do not have permission to respond to this suggestion');
      err.statusCode = 403;
      throw err;
    }

    if (suggestion.status !== 'pending') {
      const err = new Error('This suggestion has already been responded to');
      err.statusCode = 400;
      throw err;
    }

    const updatedSuggestion = await this.repo.updateSuggestion(suggestionId, {
      status: accept ? 'accepted' : 'rejected',
      respondedAt: new Date(),
    });

    if (accept) {
      const updateData = validateGrantEnums(
        this._parseSuggestionValue(suggestion.fieldName, suggestion.suggestedValue)
      );
      await this.repo.update(suggestion.grantApplicationId, updateData);
    }

    return updatedSuggestion;
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  // Sent after the writes have committed; a failed send is logged and never fails the request.

  async _notify(data) {
    try {
      if (this.notifier?.dispatchNotification) {
        await this.notifier.dispatchNotification(data);
      } else if (this.repo?.prisma?.notification?.create) {
        await this.repo.prisma.notification.create({ data });
      }
    } catch (err) {
      log.warn(`[GrantService] notification '${data?.type}' failed: ${err.message}`);
    }
  }

  async _notifyApplicant(grant, { type, title, message, metadata = {} }) {
    if (!grant?.applicantUserId) return;
    await this._notify({
      userId: grant.applicantUserId,
      type,
      title,
      message,
      referenceType: 'grant_application',
      referenceId: grant.id,
      metadata: {
        applicationNumber: grant.applicationNumber || null,
        actionUrl: `/research/grant/${grant.id}`,
        ...metadata,
      },
    });
  }

  /** Applicant receipt + reviewer alert on submit / resubmit. */
  async _notifySubmitted(grant, isResubmission) {
    const ref = grant.applicationNumber ? ` (${grant.applicationNumber})` : '';
    await this._notifyApplicant(grant, isResubmission
      ? {
        type: 'grant_resubmitted',
        title: 'Grant Application Resubmitted',
        message: `Your revised grant application "${grant.title}"${ref} was received and is back with DRD for review.`,
      }
      : {
        type: 'grant_submitted',
        title: 'Grant Application Received',
        message: `Your grant application "${grant.title}"${ref} was received and is awaiting DRD review.`,
      });

    let reviewerIds = [];
    try {
      reviewerIds = await this._findReviewersToNotify(grant, isResubmission);
    } catch (err) {
      log.warn(`[GrantService] could not resolve grant reviewers: ${err.message}`);
    }
    for (const reviewerId of reviewerIds) {
      if (reviewerId === grant.applicantUserId) continue;
      await this._notify({
        userId: reviewerId,
        type: isResubmission ? 'grant_resubmitted_for_review' : 'grant_submitted_for_review',
        title: isResubmission ? 'Grant Application Resubmitted' : 'New Grant Application for Review',
        message: isResubmission
          ? `The grant application "${grant.title}"${ref} has been resubmitted after changes and is ready for your review.`
          : `A new grant application "${grant.title}"${ref} has been submitted and is awaiting review.`,
        referenceType: 'grant_application',
        referenceId: grant.id,
        metadata: {
          applicationNumber: grant.applicationNumber || null,
          actionUrl: `/drd/research/grant-review/${grant.id}`,
          actionLabel: 'Review Application',
        },
      });
    }
  }

  /**
   * Who to alert about a (re)submission. A resubmission goes back to the reviewer who
   * asked for the changes (as research does with its current reviewer); a new submission
   * goes to the DRD grant reviewers whose grant-school assignment covers the grant's school
   * (no assignment = all schools), from direct permissions and role templates.
   */
  async _findReviewersToNotify(grant, isResubmission) {
    const prisma = this.repo?.prisma;
    if (!prisma) return [];

    if (isResubmission && prisma.grantApplicationReview?.findFirst) {
      const last = await prisma.grantApplicationReview.findFirst({
        where: { grantApplicationId: grant.id, decision: 'changes_required' },
        orderBy: { createdAt: 'desc' },
        select: { reviewerId: true },
      });
      if (last?.reviewerId) return [last.reviewerId];
    }

    const hasReviewPerm = (perms) => !!perms && typeof perms === 'object'
      && REVIEW_PERMISSION_KEYS.some((k) => perms[k] === true);
    const ids = new Set();

    if (prisma.centralDepartmentPermission?.findMany) {
      const rows = await prisma.centralDepartmentPermission.findMany({
        where: { isActive: true },
        select: { userId: true, permissions: true, assignedGrantSchoolIds: true },
      });
      for (const row of rows) {
        if (!hasReviewPerm(row.permissions)) continue;
        const schools = Array.isArray(row.assignedGrantSchoolIds) ? row.assignedGrantSchoolIds : [];
        if (schools.length > 0 && grant.schoolId && !schools.includes(grant.schoolId)) continue;
        ids.add(row.userId);
      }
    }

    if (prisma.role?.findMany && prisma.userLogin?.findMany) {
      const tenantId = grant.universityId || null;
      const roles = await prisma.role.findMany({
        where: { isActive: true, ...(tenantId ? { OR: [{ universityId: tenantId }, { universityId: null }] } : {}) },
        select: { id: true, permissions: true },
      });
      for (const role of roles.filter((r) => hasReviewPerm(r.permissions?.centralDeptPermissions))) {
        const users = await prisma.userLogin.findMany({
          where: { status: 'active', assignedRoleIds: { array_contains: [role.id] } },
          select: { id: true },
        });
        users.forEach((u) => ids.add(u.id));
      }
    }

    return [...ids].slice(0, MAX_REVIEWER_NOTIFICATIONS);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Resolve schoolId and departmentId for the applicant.
   * Employees: resolved from employeeDetails.primaryDepartment.
   * Students: resolved from StudentDetails → Program → Department → FacultySchoolList.
   * @param {string} userId
   * @param {string|null} schoolId - explicitly provided value (may be null)
   * @param {string|null} departmentId - explicitly provided value (may be null)
   * @returns {Promise<{ resolvedSchoolId: string|null, resolvedDepartmentId: string|null }>}
   */
  async _resolveSchoolAndDepartment(userId, schoolId, departmentId) {
    let resolvedSchoolId = schoolId || null;
    let resolvedDepartmentId = departmentId || null;

    if (resolvedSchoolId && resolvedDepartmentId) {
      return { resolvedSchoolId, resolvedDepartmentId };
    }

    // Employee fallback
    const employee = await this.repo.prisma.employeeDetails.findFirst({
      where: { userLoginId: userId },
      select: {
        primaryDepartmentId: true,
        primaryDepartment: { select: { id: true, facultyId: true } },
      },
    });
    if (employee) {
      if (!resolvedDepartmentId) resolvedDepartmentId = employee.primaryDepartmentId || null;
      if (!resolvedSchoolId) resolvedSchoolId = employee.primaryDepartment?.facultyId || null;
    }

    // Student fallback: StudentDetails → Program → Department → facultyId (school)
    if (!resolvedSchoolId || !resolvedDepartmentId) {
      const student = await this.repo.prisma.studentDetails.findFirst({
        where: { userLoginId: userId },
        select: {
          program: {
            select: {
              departmentId: true,
              department: { select: { id: true, facultyId: true } },
            },
          },
        },
      });
      if (!resolvedDepartmentId && student?.program?.departmentId) {
        resolvedDepartmentId = student.program.departmentId;
      }
      if (!resolvedSchoolId && student?.program?.department?.facultyId) {
        resolvedSchoolId = student.program.department.facultyId;
      }
    }

    return { resolvedSchoolId, resolvedDepartmentId };
  }

  _buildCreateData(data, userId, applicantType, proposalFilePath, createStatus) {
    const {
      title, submittedAmount, sdgGoals, projectType, numberOfConsortiumOrgs,
      projectStatus, projectCategory, fundingAgencyType, fundingAgencyName,
      totalInvestigators, numberOfInternalPIs, numberOfInternalCoPIs, isPIExternal,
      myRole, dateOfSubmission, projectStartDate, projectEndDate, projectDurationMonths,
      schoolId, departmentId, consortiumOrganizations,
    } = data;

    return {
      applicationNumber: null,
      applicantUserId: userId,
      applicantType,
      title,
      submittedAmount: submittedAmount ? parseFloat(submittedAmount) : null,
      sdgGoals: sdgGoals || [],
      projectType: projectType || 'indian',
      numberOfConsortiumOrgs: numberOfConsortiumOrgs || 0,
      projectStatus: projectStatus || 'submitted',
      projectCategory: projectCategory || 'govt',
      fundingAgencyType: fundingAgencyType || null,
      fundingAgencyName: fundingAgencyName || null,
      totalInvestigators: totalInvestigators || 1,
      numberOfInternalPIs: numberOfInternalPIs || 1,
      numberOfInternalCoPIs: numberOfInternalCoPIs || 0,
      isPIExternal: isPIExternal || false,
      myRole: myRole || 'pi',
      dateOfSubmission: dateOfSubmission ? new Date(dateOfSubmission) : null,
      projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
      projectEndDate: projectEndDate ? new Date(projectEndDate) : null,
      projectDurationMonths: projectDurationMonths ? parseInt(projectDurationMonths) : null,
      schoolId: schoolId || null,
      departmentId: departmentId || null,
      status: createStatus,
      submittedAt: null,
      proposalFilePath: proposalFilePath,
      consortiumOrganizations:
        projectType === 'international' && consortiumOrganizations?.length > 0
          ? {
              create: consortiumOrganizations.map((org, index) => ({
                organizationName: org.organizationName,
                country: org.country,
                numberOfMembers: org.numberOfMembers || 1,
                displayOrder: index,
              })),
            }
          : undefined,
    };
  }

  _buildUpdateData(data) {
    const {
      title, submittedAmount, sdgGoals, projectType, numberOfConsortiumOrgs,
      projectStatus, projectCategory, fundingAgencyType, fundingAgencyName,
      totalInvestigators, numberOfInternalPIs, numberOfInternalCoPIs, isPIExternal,
      myRole, dateOfSubmission, projectStartDate, projectEndDate, projectDurationMonths,
      schoolId, departmentId, consortiumOrganizations,
    } = data;

    return {
      title,
      submittedAmount: submittedAmount ? parseFloat(submittedAmount) : null,
      sdgGoals: sdgGoals || [],
      projectType: projectType || 'indian',
      numberOfConsortiumOrgs: numberOfConsortiumOrgs || 0,
      projectStatus: projectStatus || 'submitted',
      projectCategory: projectCategory || 'govt',
      fundingAgencyType: fundingAgencyType || null,
      fundingAgencyName: fundingAgencyName || null,
      totalInvestigators: totalInvestigators || 1,
      numberOfInternalPIs: numberOfInternalPIs || 1,
      numberOfInternalCoPIs: numberOfInternalCoPIs || 0,
      isPIExternal: isPIExternal || false,
      myRole: myRole || 'pi',
      dateOfSubmission: dateOfSubmission ? new Date(dateOfSubmission) : null,
      projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
      projectEndDate: projectEndDate ? new Date(projectEndDate) : null,
      projectDurationMonths: projectDurationMonths ? parseInt(projectDurationMonths) : null,
      schoolId: schoolId || null,
      departmentId: departmentId || null,
      consortiumOrganizations:
        projectType === 'international' && consortiumOrganizations?.length > 0
          ? {
              create: consortiumOrganizations.map((org, index) => ({
                organizationName: org.organizationName,
                country: org.country,
                numberOfMembers: org.numberOfMembers || 1,
                displayOrder: index,
              })),
            }
          : undefined,
    };
  }

  _buildOrgIdMap(inputOrgs, createdOrgs) {
    const orgIdMap = {};
    if (inputOrgs && createdOrgs) {
      inputOrgs.forEach((inputOrg, index) => {
        const createdOrg = createdOrgs[index];
        if (createdOrg) orgIdMap[inputOrg.id] = createdOrg.id;
      });
    }
    return orgIdMap;
  }

  async _submitDraft(grantApplication, userId) {
    const applicationNumber = await this.generateApplicationNumber();
    const updated = await this.repo.update(grantApplication.id, {
      applicationNumber,
      status: 'submitted',
      submittedAt: new Date(),
    });
    await this.repo.createStatusHistory({
      grantApplicationId: grantApplication.id,
      fromStatus: 'draft',
      toStatus: 'submitted',
      changedById: userId,
      comments: 'Application submitted',
    });
    return updated;
  }

  async _fetchComplete(id) {
    return this.repo.findById(id, {
      consortiumOrganizations: true,
      investigators: {
        include: { consortiumOrg: true },
        orderBy: { displayOrder: 'asc' },
      },
      school: true,
      department: true,
      applicantUser: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true, designation: true },
          },
        },
      },
    });
  }

  async _logCreation(completeGrant, userId, req, proposalFilePath, file, shouldSubmitImmediately, finalGrant) {
    await logResearchFiling(completeGrant, userId, req);

    if (proposalFilePath) {
      await logFileUpload(
        proposalFilePath.split('/').pop(),
        file?.size || 0,
        proposalFilePath,
        userId,
        req,
        'RESEARCH',
        { grantId: completeGrant.id, type: 'proposal' }
      );
    }

    if (shouldSubmitImmediately) {
      await logResearchStatusChange(finalGrant, 'draft', 'submitted', userId, req, 'Application submitted');
    }
  }

  _detailInclude() {
    return {
      consortiumOrganizations: { orderBy: { displayOrder: 'asc' } },
      investigators: {
        include: {
          consortiumOrg: true,
          user: { select: { uid: true, email: true } },
        },
        orderBy: { displayOrder: 'asc' },
      },
      school: true,
      department: true,
      applicantUser: {
        select: {
          id: true,
          uid: true,
          email: true,
          universityId: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true, designation: true },
          },
        },
      },
      reviews: {
        include: {
          reviewer: { select: { uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true, designation: true } } } },
        },
      },
      statusHistory: {
        include: { changedBy: { select: { uid: true, email: true } } },
        orderBy: { changedAt: 'desc' },
      },
      editSuggestions: {
        include: {
          reviewer: {
            select: { uid: true, employeeDetails: { select: { displayName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    };
  }

  _parseSuggestionValue(fieldName, rawValue) {
    let value = rawValue;

    const numberFields = [
      'submittedAmount', 'totalInvestigators', 'numberOfInternalPIs',
      'numberOfInternalCoPIs', 'numberOfConsortiumOrgs', 'projectDurationMonths',
    ];
    const dateFields = ['dateOfSubmission', 'projectStartDate', 'projectEndDate'];
    const enumFields = ['fundingAgencyType', 'projectStatus', 'projectCategory'];

    if (numberFields.includes(fieldName)) {
      value = parseInt(value, 10);
    } else if (dateFields.includes(fieldName)) {
      if (value && !value.includes('T')) {
        value = new Date(value + 'T00:00:00.000Z').toISOString();
      }
    } else if (fieldName === 'sdgGoals') {
      value = value ? value.split(',').filter(Boolean) : [];
    } else if (fieldName === 'isPIExternal') {
      value = value === 'true' || value === true;
    } else if (enumFields.includes(fieldName)) {
      value = value ? value.toLowerCase() : value;
    }

    return { [fieldName]: value };
  }
}

module.exports = GrantService;
module.exports.createGrantPayoutLines = createGrantPayoutLines;
module.exports.validateGrantEnums = validateGrantEnums;
