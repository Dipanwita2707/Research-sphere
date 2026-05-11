/**
 * Research Review Service
 * Framework-agnostic business logic for the DRD review workflow.
 * Dependencies injected via constructor for testability.
 */

const { IncentiveCalculator } = require('./incentive-calculator');

const RESEARCH_REVIEW_LIST_SELECT = {
  id: true,
  applicationNumber: true,
  applicantUserId: true,
  publicationType: true,
  title: true,
  status: true,
  sourceType: true,
  sourceSystems: true,
  specialReviewRequired: true,
  importConfidence: true,
  missingFields: true,
  autoCalculatedFields: true,
  schoolId: true,
  departmentId: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  calculatedIncentiveAmount: true,
  calculatedPoints: true,
  school: {
    select: {
      id: true,
      facultyName: true,
      shortName: true,
    },
  },
  applicantUser: {
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
  reviews: {
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      reviewerId: true,
      decision: true,
      createdAt: true,
    },
  },
};

const GRANT_REVIEW_LIST_SELECT = {
  id: true,
  applicationNumber: true,
  applicantUserId: true,
  title: true,
  status: true,
  schoolId: true,
  departmentId: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  calculatedIncentiveAmount: true,
  calculatedPoints: true,
  applicantUser: {
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
  school: {
    select: {
      id: true,
      facultyName: true,
      facultyCode: true,
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
  consortiumOrganizations: {
    select: {
      id: true,
      organizationName: true,
      country: true,
    },
  },
};

function buildStatusStats(records = [], keys = []) {
  const stats = { total: 0 };
  keys.forEach((key) => {
    stats[key] = 0;
  });
  records.forEach((record) => {
    const count = Number(record?._count?.id ?? 1);
    stats.total += count;
    if (Object.prototype.hasOwnProperty.call(stats, record.status)) {
      stats[record.status] += count;
    }
  });
  return stats;
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

// Module-level TTL cache for DRD department permission lookups (per-user).
// Avoids redundant DB round-trips on every hot review-queue request.
const _drdPermCache = new Map(); // key: `drd:${userId}` → { data, expiresAt }
const DRD_PERM_CACHE_TTL_MS = 60_000; // 1 minute

class ReviewService {
  /**
   * @param {object} reviewRepository       - ReviewRepository instance
   * @param {object} contributionRepository - ContributionRepository instance
   * @param {object} emailService           - email sending service (optional)
   * @param {object} prisma                 - prisma client (for policy lookups & related tables)
   * @param {object} auditLogger            - audit logging utility (optional)
   */
  constructor(reviewRepository, contributionRepository, emailService, prisma, auditLogger = null, workflowQueue = null) {
    this.reviewRepo = reviewRepository;
    this.contributionRepo = contributionRepository;
    this.emailService = emailService;
    this.prisma = prisma;
    this.auditLogger = auditLogger;
    this.workflowQueue = workflowQueue;
  }

  /**
   * Cached DRD department permission lookup for a user.
   * Returns { permissions, assignedResearchSchoolIds, assignedBookSchoolIds,
   *           assignedConferenceSchoolIds, assignedGrantSchoolIds } or null if
   * the user has no DRD permission record.
   */
  async _getDrdPermissions(userId) {
    const key = `drd:${userId}`;
    const cached = _drdPermCache.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    let data = null;
    const drdDept = await this.prisma.centralDepartment.findFirst({
      where: { OR: [{ departmentCode: 'DRD' }, { departmentCode: 'drd' }, { shortName: 'DRD' }] },
      select: { id: true },
    });
    if (drdDept) {
      data = await this.prisma.centralDepartmentPermission.findFirst({
        where: { userId, isActive: true, centralDeptId: drdDept.id },
        select: {
          permissions: true,
          assignedResearchSchoolIds: true,
          assignedBookSchoolIds: true,
          assignedConferenceSchoolIds: true,
          assignedGrantSchoolIds: true,
        },
      });
    }
    _drdPermCache.set(key, { data, expiresAt: Date.now() + DRD_PERM_CACHE_TTL_MS });
    return data;
  }

  // ─── Reviewer assignment ─────────────────────────────────────────────────

  /**
   * Assign a reviewer to a contribution (move to under_review).
   * @param {string} contributionId
   * @param {string} reviewerId
   * @returns {object} updated contribution
   */
  async assignReviewer(contributionId, reviewerId) {
    const contribution = await this._requireContribution(contributionId);
    if (contribution.status === 'under_review' && contribution.currentReviewerId === reviewerId) {
      return contribution;
    }
    this._assertStatus(contribution, ['submitted', 'resubmitted'], 'start review');

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id: contributionId,
          status: { in: ['submitted', 'resubmitted'] },
        },
        data: {
          status: 'under_review',
          currentReviewerId: reviewerId,
        },
      });

      if (updateResult.count !== 1) {
        const latest = await tx.researchContribution.findUnique({ where: { id: contributionId } });
        if (latest?.status === 'under_review' && latest.currentReviewerId === reviewerId) {
          return latest;
        }
        const err = new Error('Review assignment conflicted with another reviewer action. Please refresh and try again.');
        err.statusCode = 409;
        throw err;
      }

      await this._createStatusHistory(
        contributionId,
        contribution.status,
        'under_review',
        reviewerId,
        'Review started',
        tx
      );

      return tx.researchContribution.findUnique({ where: { id: contributionId } });
    });

    // Audit: log reviewer assignment
    this._dispatchStatusAudit(result, contribution.status, 'under_review', reviewerId, null, 'Reviewer assigned').catch(() => {});

    return result;
  }

  // ─── Review submission ───────────────────────────────────────────────────

  /**
   * Submit a review decision (changes_required or recommended).
   * @param {string} contributionId
   * @param {string} reviewerId
   * @param {object} reviewData - { decision, comments, suggestions }
   * @returns {object} updated contribution
   */
  async submitReview(contributionId, reviewerId, reviewData) {
    const { decision, comments, suggestions = [] } = reviewData;
    const contribution = await this._requireContribution(contributionId);
    this._assertStatus(contribution, ['submitted', 'under_review', 'resubmitted'], 'submit review');
    this._assertReviewerOwnership(contribution, reviewerId, 'submit a review');
    const latestReview = await this.reviewRepo.findMany(
      {
        researchContributionId: contributionId,
        reviewerId,
      },
      {
        orderBy: { reviewedAt: 'desc' },
        take: 1,
      }
    );
    if (
      latestReview[0] &&
      latestReview[0].decision === decision &&
      contribution.status === 'changes_required'
    ) {
      return contribution;
    }

    const newStatus = decision === 'changes_required' ? 'changes_required' : 'under_review';
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.researchContributionReview.create({
        data: {
          researchContributionId: contributionId,
          reviewerId,
          reviewerRole: 'drd_reviewer',
          comments,
          decision,
          hasSuggestions: suggestions.length > 0,
          suggestionsCount: suggestions.length,
          pendingSuggestionsCount: suggestions.length,
          reviewedAt: new Date(),
        },
      });

      if (decision === 'changes_required' && suggestions.length > 0) {
        await this._createEditSuggestions(contributionId, reviewerId, suggestions, tx);
      }

      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id: contributionId,
          currentReviewerId: reviewerId,
          status: { in: ['submitted', 'under_review', 'resubmitted'] },
        },
        data: {
          status: newStatus,
          currentReviewerId: decision === 'changes_required' ? null : reviewerId,
        },
      });

      if (updateResult.count !== 1) {
        const err = new Error('Review submission conflicted with another update. Please refresh and try again.');
        err.statusCode = 409;
        throw err;
      }

      await this._createStatusHistory(
        contributionId,
        contribution.status,
        newStatus,
        reviewerId,
        comments || `Review decision: ${decision}`,
        tx
      );

      return tx.researchContribution.findUnique({ where: { id: contributionId } });
    });

    if (decision === 'changes_required') {
      await this._notifyApplicant(
        contribution,
        'research_changes_required',
        'Changes Requested',
        `Your publication "${contribution.title}" requires changes. Please review the feedback and resubmit.`
      );
    }

    // Audit: log review decision
    this._dispatchStatusAudit(updated, contribution.status, newStatus, reviewerId, null, comments || `Review decision: ${decision}`).catch(() => {});

    return updated;
  }

  // ─── Approval ────────────────────────────────────────────────────────────

  /**
   * Approve a contribution and credit incentives to all authors.
   * @param {string} contributionId
   * @param {string} approverId
   * @param {object} options - { comments, request }
   * @returns {object} { updated, incentiveBreakdown }
   */
  async approveContribution(contributionId, approverId, options = {}) {
    const { comments, request = null } = options;

    const contribution = await this.contributionRepo.findById(contributionId, { authors: true, applicantUser: true });
    if (!contribution) throw this._notFound('Research contribution');
    if (['approved', 'completed'].includes(contribution.status)) {
      return {
        updated: contribution,
        incentiveBreakdown: await this._buildIncentiveBreakdown(
          contribution,
          contribution.incentiveAmount || 0,
          contribution.pointsAwarded || 0
        ),
      };
    }
    this._assertStatus(contribution, ['submitted', 'under_review', 'resubmitted'], 'approve');

    const result = await this.prisma.$transaction(async (tx) => {
      const freshContribution = await tx.researchContribution.findUnique({
        where: { id: contributionId },
        include: { authors: true, applicantUser: true },
      });
      if (!freshContribution) throw this._notFound('Research contribution');
      if (['approved', 'completed'].includes(freshContribution.status)) {
        return {
          updated: freshContribution,
          totalIncentiveAwarded: freshContribution.incentiveAmount || 0,
          totalPointsAwarded: freshContribution.pointsAwarded || 0,
          authorShares: freshContribution.authors || [],
        };
      }
      this._assertStatus(freshContribution, ['submitted', 'under_review', 'resubmitted'], 'approve');

      const { totalIncentiveAwarded, totalPointsAwarded, authorShares } =
        await this._creditIncentivesToAuthors(freshContribution, contributionId, tx);

      await tx.researchContributionReview.create({
        data: {
          researchContributionId: contributionId,
          reviewerId: approverId,
          reviewerRole: 'drd_head',
          comments,
          decision: 'approved',
          reviewedAt: new Date(),
        },
      });

      const now = new Date();
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id: contributionId,
          status: { in: ['submitted', 'under_review', 'resubmitted'] },
        },
        data: {
          status: 'approved',
          currentReviewerId: null,
          incentiveAmount: totalIncentiveAwarded,
          pointsAwarded: totalPointsAwarded,
          creditedAt: now,
          completedAt: now,
        },
      });

      if (updateResult.count !== 1) {
        const err = new Error('Approval conflicted with another update. Please refresh and try again.');
        err.statusCode = 409;
        throw err;
      }

      await this._createStatusHistory(
        contributionId,
        freshContribution.status,
        'approved',
        approverId,
        comments || 'Approved by DRD Head - Incentives credited based on author roles',
        tx
      );

      const updated = await tx.researchContribution.findUnique({ where: { id: contributionId } });
      return { updated, totalIncentiveAwarded, totalPointsAwarded, authorShares };
    });

    await this._notifyAuthorsOnApproval(
      contribution,
      contributionId,
      result.totalIncentiveAwarded,
      result.totalPointsAwarded,
      result.authorShares
    );
    await this._notifyApplicantOnApproval(contribution, contributionId, result.totalIncentiveAwarded, result.totalPointsAwarded);
    await this._notifyRecommendingReviewers(contribution, contributionId);
    await this._dispatchStatusAudit(
      result.updated,
      contribution.status,
      'approved',
      approverId,
      request,
      comments || 'Approved by DRD Head'
    );

    return {
      updated: result.updated,
      incentiveBreakdown: await this._buildIncentiveBreakdown(
        contribution,
        result.totalIncentiveAwarded,
        result.totalPointsAwarded
      ),
    };
  }

  async _buildIncentiveBreakdown(contribution, totalIncentiveAwarded, totalPointsAwarded) {
    const activePolicy = await this._fetchActivePolicy();
    return {
      totalIncentiveAwarded,
      totalPointsAwarded,
      authorCount: contribution.authors.length,
      firstAuthorPercent: activePolicy ? Number(activePolicy.first_author_percentage) : null,
      correspondingAuthorPercent: activePolicy ? Number(activePolicy.corresponding_author_percentage) : null
    };
  }

  // ─── Rejection ───────────────────────────────────────────────────────────

  /**
   * Reject a contribution.
   * @param {string} contributionId
   * @param {string} rejecterId
   * @param {object} options - { comments, reason, request }
   * @returns {object} updated contribution
   */
  async rejectContribution(contributionId, rejecterId, options = {}) {
    const { comments, reason, request = null } = options;
    const contribution = await this._requireContribution(contributionId);
    if (contribution.status === 'rejected') return contribution;
    this._assertStatus(contribution, ['submitted', 'under_review', 'resubmitted'], 'reject');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.researchContributionReview.create({
        data: {
          researchContributionId: contributionId,
          reviewerId: rejecterId,
          reviewerRole: 'drd_head',
          comments: comments || reason,
          decision: 'rejected',
          reviewedAt: new Date(),
        },
      });

      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id: contributionId,
          status: { in: ['submitted', 'under_review', 'resubmitted'] },
        },
        data: {
          status: 'rejected',
          currentReviewerId: null,
        },
      });

      if (updateResult.count !== 1) {
        const err = new Error('Rejection conflicted with another update. Please refresh and try again.');
        err.statusCode = 409;
        throw err;
      }

      await this._createStatusHistory(
        contributionId,
        contribution.status,
        'rejected',
        rejecterId,
        comments || reason || 'Rejected by DRD',
        tx
      );

      return tx.researchContribution.findUnique({ where: { id: contributionId } });
    });

    await this._notifyApplicant(
      contribution,
      'research_rejected',
      `${this._publicationLabel(contribution.publicationType)} Rejected`,
      `Your publication "${contribution.title}" has been rejected. Reason: ${reason || comments || 'Not specified'}`
    );
    await this._dispatchStatusAudit(
      updated,
      contribution.status,
      'rejected',
      rejecterId,
      request,
      comments || reason || 'Rejected by DRD'
    );

    return updated;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  async _requireContribution(id) {
    const contribution = await this.contributionRepo.findById(id);
    if (!contribution) throw this._notFound('Research contribution');
    return contribution;
  }

  _assertStatus(contribution, allowedStatuses, action) {
    if (!allowedStatuses.includes(contribution.status)) {
      const err = new Error(`Cannot ${action} for contribution in status: ${contribution.status}`);
      err.statusCode = 400;
      throw err;
    }
  }

  _assertReviewerOwnership(contribution, reviewerId, action) {
    if (!contribution.currentReviewerId || contribution.currentReviewerId !== reviewerId) {
      const err = new Error(`Only the assigned reviewer can ${action}`);
      err.statusCode = 403;
      throw err;
    }
  }

  async _creditIncentivesToAuthors(contribution, contributionId, dbClient = this.prisma) {
    const activePolicy = await this._fetchActivePolicy(dbClient);
    if (!activePolicy) {
      const err = new Error('No active research policy found. Please configure policy in admin panel.');
      err.statusCode = 500;
      throw err;
    }

    const policyFirstPct = Number(activePolicy.first_author_percentage);
    const policyCorrespondingPct = Number(activePolicy.corresponding_author_percentage);

    const totalAuthors = contribution.authors.length;
    const internalAuthors = contribution.authors.filter(a =>
      !a.authorCategory?.toLowerCase().includes('external')
    );
    const internalCoAuthors = internalAuthors.filter(a =>
      a.authorType === 'co_author' || a.authorType === 'senior_author'
    );
    const internalEmployeeCoAuthors = internalCoAuthors.filter(a =>
      !a.authorType?.toLowerCase().includes('student')
    );
    const totalCoAuthors = contribution.authors.filter(a =>
      a.authorType === 'co_author' || a.authorType === 'senior_author'
    ).length;

    let externalFirstCorrespondingPct = 0;
    for (const a of contribution.authors) {
      if (a.authorCategory?.toLowerCase().includes('external')) {
        const role = a.authorType || 'co_author';
        if (role === 'first_author') externalFirstCorrespondingPct += policyFirstPct;
        if (role === 'corresponding_author') externalFirstCorrespondingPct += policyCorrespondingPct;
        if (role === 'first_and_corresponding_author' || role === 'first_and_corresponding') {
          externalFirstCorrespondingPct += policyFirstPct + policyCorrespondingPct;
        }
      }
    }

    const calculator = new IncentiveCalculator(dbClient);
    let totalIncentiveAwarded = 0;
    let totalPointsAwarded = 0;
    const authorShares = [];

    for (const author of contribution.authors) {
      const isExternal = author.authorCategory?.toLowerCase().includes('external');
      const authorRole = author.authorType || 'co_author';
      const isStudent = author.authorType?.toLowerCase().includes('student') || false;

      const result = await calculator.calculate({
        contributionData: contribution,
        publicationType: contribution.publicationType,
        authorRole,
        isStudent,
        sjrValue: contribution.sjr || 0,
        coAuthorCount: totalCoAuthors,
        totalAuthors,
        isInternal: !isExternal,
        internalCoAuthorCount: internalCoAuthors.length,
        externalFirstCorrespondingPct,
        internalEmployeeCoAuthorCount: internalEmployeeCoAuthors.length
      });

      const authorIncentive = result.incentiveAmount || 0;
      const authorPoints = result.points || 0;

      await dbClient.researchContributionAuthor.update({
        where: { id: author.id },
        data: { incentiveShare: Math.round(authorIncentive), pointsShare: authorPoints }
      });

      totalIncentiveAwarded += Math.round(authorIncentive);
      totalPointsAwarded += authorPoints;
      authorShares.push({
        ...author,
        incentiveShare: Math.round(authorIncentive),
        pointsShare: authorPoints,
      });
    }

    return { totalIncentiveAwarded, totalPointsAwarded, authorShares };
  }

  async _notifyAuthorsOnApproval(contribution, contributionId, totalIncentive, totalPoints, authorShares = []) {
    for (const author of authorShares) {
      if (!author.userId || author.authorCategory?.toLowerCase().includes('external')) continue;
      const label = this._publicationLabel(contribution.publicationType);
      await this._dispatchNotification({
        userId: author.userId,
        type: 'research_incentive_credited',
        title: `${label} Incentive Credited`,
        message: `You have been credited ₹${Math.round(author.incentiveShare || 0).toLocaleString()} and ${author.pointsShare || 0} points for "${contribution.title}".`,
        referenceType: 'research_contribution',
        referenceId: contributionId,
        metadata: {
          incentiveAmount: author.incentiveShare,
          points: author.pointsShare,
          authorRole: author.authorType,
          publicationType: contribution.publicationType
        }
      });
    }
  }

  async _notifyApplicantOnApproval(contribution, contributionId, totalIncentive, totalPoints) {
    if (!contribution.applicantUserId) return;
    const label = this._publicationLabel(contribution.publicationType);
    await this._dispatchNotification({
      userId: contribution.applicantUserId,
      type: 'research_approved',
      title: `${label} Approved`,
      message: `Your ${label.toLowerCase()} "${contribution.title}" has been approved. Total incentives: ₹${totalIncentive.toLocaleString()} and ${totalPoints} points distributed.`,
      referenceType: 'research_contribution',
      referenceId: contributionId,
      metadata: { incentiveAmount: totalIncentive, points: totalPoints, publicationType: contribution.publicationType }
    });
  }

  async _notifyRecommendingReviewers(contribution, contributionId) {
    const reviews = await this.reviewRepo.findByContribution(contributionId, {
      where: { decision: 'recommended' },
      include: { reviewer: true }
    });

    for (const review of reviews) {
      const label = this._publicationLabel(contribution.publicationType);
      await this._dispatchNotification({
        userId: review.reviewerId,
        type: 'research_recommendation_approved',
        title: 'Your Recommendation Approved',
        message: `Your recommended ${label.toLowerCase()} "${contribution.title}" has been approved.`,
        referenceType: 'research_contribution',
        referenceId: contributionId,
        metadata: { reviewId: review.id, publicationType: contribution.publicationType }
      });
    }
  }

  async _notifyApplicant(contribution, type, title, message) {
    if (!contribution.applicantUserId) return;
    await this._dispatchNotification({
      userId: contribution.applicantUserId,
      type,
      title,
      message,
      referenceType: 'research_contribution',
      referenceId: contribution.id,
      metadata: { publicationType: contribution.publicationType }
    });
  }

  async _createEditSuggestions(contributionId, reviewerId, suggestions, dbClient = this.prisma) {
    for (const suggestion of suggestions) {
      await dbClient.researchContributionEditSuggestion.create({
        data: {
          researchContributionId: contributionId,
          reviewerId,
          fieldName: suggestion.fieldName,
          fieldPath: suggestion.fieldPath,
          originalValue: suggestion.originalValue,
          suggestedValue: suggestion.suggestedValue,
          suggestionNote: suggestion.note,
          status: 'pending'
        }
      });
    }
  }

  async _createStatusHistory(contributionId, fromStatus, toStatus, changedById, comments, dbClient = this.prisma) {
    await dbClient.researchContributionStatusHistory.create({
      data: { researchContributionId: contributionId, fromStatus, toStatus, changedById, comments }
    });
  }

  async _fetchActivePolicy(dbClient = this.prisma) {
    return dbClient.researchIncentivePolicy.findFirst({
      where: { publicationType: 'research_paper', isActive: true },
      select: { first_author_percentage: true, corresponding_author_percentage: true }
    });
  }

  _requestContext(request = null) {
    if (!request) return { ipAddress: '0.0.0.0', userAgent: 'unknown' };
    return {
      ipAddress:
        request.ip ||
        request.headers?.['x-forwarded-for'] ||
        request.connection?.remoteAddress ||
        '0.0.0.0',
      userAgent: request.headers?.['user-agent'] || 'unknown',
    };
  }

  async _dispatchNotification(data) {
    if (this.workflowQueue?.dispatchNotification) {
      return this.workflowQueue.dispatchNotification(data);
    }
    return this.prisma.notification.create({ data });
  }

  async _dispatchStatusAudit(contribution, oldStatus, newStatus, userId, request, comments = null) {
    if (!this.auditLogger?.logResearchStatusChange) return;

    if (this.workflowQueue?.dispatchResearchStatusAudit) {
      return this.workflowQueue.dispatchResearchStatusAudit({
        contribution,
        oldStatus,
        newStatus,
        userId,
        requestContext: this._requestContext(request),
        comments,
      });
    }

    return this.auditLogger.logResearchStatusChange(
      contribution,
      oldStatus,
      newStatus,
      userId,
      request,
      comments
    );
  }

  _publicationLabel(publicationType) {
    const labels = {
      research_paper: 'Research Paper', book: 'Book', book_chapter: 'Book Chapter',
      conference_paper: 'Conference Paper', grant: 'Grant'
    };
    return labels[publicationType] || 'Publication';
  }

  _notFound(entity) {
    const err = new Error(`${entity} not found`);
    err.statusCode = 404;
    return err;
  }

  // ─── Additional workflow methods ─────────────────────────────────────────

  /**
   * Start review for a grant application (moves to under_review).
   */
  async assignGrantReviewer(grantId, reviewerId) {
    const grant = await this.prisma.grantApplication.findUnique({ where: { id: grantId } });
    if (!grant) throw this._notFound('Grant application');
    if (!['submitted', 'resubmitted'].includes(grant.status)) {
      const e = new Error(`Cannot start review for grant in status: ${grant.status}`); e.statusCode = 400; throw e;
    }
    const updated = await this.prisma.grantApplication.update({ where: { id: grantId }, data: { status: 'under_review', currentReviewerId: reviewerId } });
    await this.prisma.grantApplicationStatusHistory.create({ data: { grantApplicationId: grantId, fromStatus: grant.status, toStatus: 'under_review', changedById: reviewerId, comments: 'Review started' } });
    return updated;
  }

  /**
   * Mark a contribution as completed (after approval).
   */
  async markCompleted(contributionId, userId) {
    const contribution = await this._requireContribution(contributionId);
    if (contribution.status === 'completed') return contribution;
    if (contribution.status !== 'approved') {
      const e = new Error('Can only mark approved contributions as completed'); e.statusCode = 400; throw e;
    }
    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id: contributionId,
          status: 'approved',
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
          currentReviewerId: null,
        },
      });

      if (updateResult.count !== 1) {
        const latest = await tx.researchContribution.findUnique({ where: { id: contributionId } });
        if (latest?.status === 'completed') return latest;
        const e = new Error('Completion conflicted with another update. Please refresh and try again.');
        e.statusCode = 409;
        throw e;
      }

      await this._createStatusHistory(contributionId, 'approved', 'completed', userId, 'Process completed', tx);
      return tx.researchContribution.findUnique({ where: { id: contributionId } });
    });
  }

  /**
   * Recommend a contribution for final approval.
   */
  async recommendForApproval(contributionId, reviewerId, comments) {
    const contribution = await this.contributionRepo.findById(contributionId, { applicantUser: true });
    if (!contribution) throw this._notFound('Research contribution');
    this._assertStatus(contribution, ['submitted', 'under_review', 'resubmitted'], 'recommend');
    this._assertReviewerOwnership(contribution, reviewerId, 'recommend this contribution');

    const existingRecommendation = await this.reviewRepo.findMany(
      {
        researchContributionId: contributionId,
        reviewerId,
        decision: 'recommended',
      },
      { orderBy: { reviewedAt: 'desc' }, take: 1 }
    );
    if (existingRecommendation.length > 0 && contribution.status === 'under_review') {
      return contribution;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.researchContributionReview.create({
        data: {
          researchContributionId: contributionId,
          reviewerId,
          reviewerRole: 'drd_reviewer',
          decision: 'recommended',
          comments: comments || 'Recommended for final approval',
          reviewedAt: new Date(),
        },
      });

      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id: contributionId,
          currentReviewerId: reviewerId,
          status: { in: ['submitted', 'under_review', 'resubmitted'] },
        },
        data: {
          status: 'under_review',
          currentReviewerId: reviewerId,
        },
      });

      if (updateResult.count !== 1) {
        const e = new Error('Recommendation conflicted with another update. Please refresh and try again.');
        e.statusCode = 409;
        throw e;
      }

      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: contributionId,
          fromStatus: contribution.status,
          toStatus: 'under_review',
          changedById: reviewerId,
          comments: comments || 'Recommended for final approval by reviewer',
          metadata: {
            action: 'recommended_for_approval',
            decision: 'recommended',
          },
        },
      });

      return tx.researchContribution.findUnique({
        where: { id: contributionId },
        include: {
          authors: true,
          applicantUser: true,
          school: true,
          department: true,
          reviews: {
            include: { reviewer: { include: { employeeDetails: true } } },
            orderBy: { createdAt: 'desc' },
          },
          statusHistory: {
            include: {
              changedBy: {
                select: {
                  id: true,
                  uid: true,
                  employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
                },
              },
            },
            orderBy: { changedAt: 'desc' },
          },
        },
      });
    });
  }

  async getWorkflowHealthSummary(options = {}) {
    const thresholdDays = Number(options.thresholdDays || 14);
    const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

    const [
      totalUnderReview,
      stuckUnderReviewCount,
      missingReviewerAssignments,
      terminalWithReviewerCount,
      approvedWithoutCreditsCount,
      mentorPendingTooLongCount,
    ] = await Promise.all([
      this.prisma.researchContribution.count({ where: { status: 'under_review' } }),
      this.prisma.researchContribution.count({
        where: {
          status: 'under_review',
          updatedAt: { lt: thresholdDate },
        },
      }),
      this.prisma.researchContribution.count({
        where: {
          status: 'under_review',
          currentReviewerId: null,
        },
      }),
      this.prisma.researchContribution.count({
        where: {
          status: { in: ['approved', 'completed', 'rejected'] },
          currentReviewerId: { not: null },
        },
      }),
      this.prisma.researchContribution.count({
        where: {
          status: { in: ['approved', 'completed'] },
          OR: [
            { incentiveAmount: null },
            { pointsAwarded: null },
          ],
        },
      }),
      this.prisma.researchContribution.count({
        where: {
          status: 'pending_mentor_approval',
          updatedAt: { lt: thresholdDate },
        },
      }),
    ]);

    return {
      thresholdDays,
      queueStatus: this.workflowQueue?.isAvailable ? (this.workflowQueue.isAvailable() ? 'background' : 'sync_fallback') : 'sync_fallback',
      totalUnderReview,
      stuckUnderReviewCount,
      missingReviewerAssignments,
      terminalWithReviewerCount,
      approvedWithoutCreditsCount,
      mentorPendingTooLongCount,
    };
  }

  /**
   * Get review statistics.
   */
  async getStatistics(filters = {}) {
    const { schoolId, publicationType, startDate, endDate } = filters;
    const whereClause = {};
    if (schoolId) whereClause.schoolId = schoolId;
    if (publicationType) whereClause.publicationType = publicationType;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }
    const [statusCounts, typeCounts, totals, schoolCounts] = await Promise.all([
      this.contributionRepo.groupBy({ by: ['status'], where: whereClause, _count: { id: true } }),
      this.contributionRepo.groupBy({ by: ['publicationType'], where: whereClause, _count: { id: true } }),
      this.contributionRepo.aggregate({ where: { ...whereClause, status: { in: ['approved', 'completed'] } }, _sum: { incentiveAmount: true, pointsAwarded: true }, _count: { id: true } }),
      this.contributionRepo.groupBy({ by: ['schoolId'], where: whereClause, _count: { id: true } })
    ]);
    return {
      byStatus: statusCounts.reduce((acc, item) => { acc[item.status] = item._count.id; return acc; }, {}),
      byPublicationType: typeCounts.reduce((acc, item) => { acc[item.publicationType] = item._count.id; return acc; }, {}),
      totals: { approved: totals._count.id, totalIncentives: totals._sum.incentiveAmount || 0, totalPoints: totals._sum.pointsAwarded || 0 },
      bySchool: schoolCounts
    };
  }

  /**
   * Get pending research contributions for review based on user DRD permissions.
   */
  async getPendingReviews(userId, query, userCentralDeptPermissions = []) {
    const { status, publicationType, schoolId } = query;
    const pagination = parsePaginationQuery(query);

    let mergedPermissions = {};
    let assignedResearchSchoolIds = [];
    let assignedBookSchoolIds = [];
    let assignedConferenceSchoolIds = [];

    try {
      const userDrdPermission = await this._getDrdPermissions(userId);
      assignedResearchSchoolIds = userDrdPermission?.assignedResearchSchoolIds || [];
      assignedBookSchoolIds = userDrdPermission?.assignedBookSchoolIds || [];
      assignedConferenceSchoolIds = userDrdPermission?.assignedConferenceSchoolIds || [];
      mergedPermissions = { ...(userDrdPermission?.permissions || {}) };
      if (Array.isArray(userCentralDeptPermissions)) {
        userCentralDeptPermissions.forEach(p => { if (p.permissions) Object.assign(mergedPermissions, p.permissions); });
      }
    } catch (e) { /* ignore permission fetch errors */ }

    const permissions = mergedPermissions;
    const hasApprovePermission = permissions.research_approve === true || permissions.book_approve === true || permissions.conference_approve === true;
    const hasReviewPermission = permissions.research_review === true || permissions.book_review === true || permissions.conference_review === true;
    const hasResearchReview = permissions.research_review === true;
    const hasResearchApprove = permissions.research_approve === true;
    const hasBookReview = permissions.book_review === true;
    const hasBookApprove = permissions.book_approve === true;
    const hasConferenceReview = permissions.conference_review === true;
    const hasConferenceApprove = permissions.conference_approve === true;

    if (!hasApprovePermission && !hasReviewPermission) {
      return { contributions: [], stats: { submitted: 0, underReview: 0, changesRequired: 0, resubmitted: 0, recommended: 0, approved: 0, total: 0 }, userPermissions: { hasApprovePermission: false, hasReviewPermission: false, canReview: false, canApprove: false } };
    }

    const pendingStatuses = ['submitted', 'under_review', 'resubmitted', 'changes_required'];
    let whereClause = {};

    if (hasApprovePermission && !hasReviewPermission) {
      whereClause = {
        AND: [
          {
            OR: [
              { reviews: { some: { decision: 'recommended' } } },
              { reviews: { some: { reviewerId: userId, decision: 'approved' } } },
            ],
          },
          { status: { in: status ? [status] : ['under_review', 'approved', 'completed'] } },
        ],
      };
    } else if (hasReviewPermission && !hasApprovePermission) {
      const allAssigned = [...assignedResearchSchoolIds, ...assignedBookSchoolIds, ...assignedConferenceSchoolIds];
      if (allAssigned.length > 0) {
        const orConds = [];
        if (assignedResearchSchoolIds.length > 0 && hasResearchReview) orConds.push({ AND: [{ publicationType: 'research_paper' }, { OR: [{ schoolId: { in: assignedResearchSchoolIds } }, { schoolId: null }] }] });
        if (assignedBookSchoolIds.length > 0 && hasBookReview) orConds.push({ AND: [{ publicationType: { in: ['book', 'book_chapter'] } }, { OR: [{ schoolId: { in: assignedBookSchoolIds } }, { schoolId: null }] }] });
        if (assignedConferenceSchoolIds.length > 0 && hasConferenceReview) orConds.push({ AND: [{ publicationType: 'conference_paper' }, { OR: [{ schoolId: { in: assignedConferenceSchoolIds } }, { schoolId: null }] }] });
        whereClause = { AND: [{ status: { in: status ? [status] : pendingStatuses } }, { OR: orConds.length > 0 ? orConds : [{ id: 'none' }] }] };
      } else {
        whereClause = { status: { in: status ? [status] : pendingStatuses } };
      }
    } else {
      const allAssigned = [...assignedResearchSchoolIds, ...assignedBookSchoolIds, ...assignedConferenceSchoolIds];
      if (allAssigned.length > 0) {
        const orConds = [];
        if (assignedResearchSchoolIds.length > 0 && (hasResearchReview || hasResearchApprove)) orConds.push({ AND: [{ publicationType: 'research_paper' }, { OR: [{ schoolId: { in: assignedResearchSchoolIds } }, { schoolId: null }] }] });
        if (assignedBookSchoolIds.length > 0 && (hasBookReview || hasBookApprove)) orConds.push({ AND: [{ publicationType: { in: ['book', 'book_chapter'] } }, { OR: [{ schoolId: { in: assignedBookSchoolIds } }, { schoolId: null }] }] });
        if (assignedConferenceSchoolIds.length > 0 && (hasConferenceReview || hasConferenceApprove)) orConds.push({ AND: [{ publicationType: 'conference_paper' }, { OR: [{ schoolId: { in: assignedConferenceSchoolIds } }, { schoolId: null }] }] });
        orConds.push({ reviews: { some: { decision: 'recommended' } } });
        whereClause = { AND: [{ status: { in: status ? [status] : [...pendingStatuses, 'approved'] } }, { OR: orConds.length > 0 ? orConds : [{ id: 'none' }] }] };
      } else {
        whereClause = { status: { in: status ? [status] : [...pendingStatuses, 'approved'] } };
      }
    }

    if (publicationType) { if (whereClause.AND) whereClause.AND.push({ publicationType }); else whereClause.publicationType = publicationType; }
    if (schoolId) { if (whereClause.AND) whereClause.AND.push({ schoolId }); else whereClause.schoolId = schoolId; }

    const [contributions, total, statusCounts] = await Promise.all([
      this.contributionRepo.findAll({
        where: whereClause,
        select: RESEARCH_REVIEW_LIST_SELECT,
        orderBy: { submittedAt: 'asc' },
        ...(pagination.usePagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      }),
      pagination.usePagination ? this.contributionRepo.count(whereClause) : Promise.resolve(null),
      this.contributionRepo.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      }),
    ]);

    const rawStats = buildStatusStats(statusCounts, ['submitted', 'under_review', 'changes_required', 'resubmitted', 'approved']);
    const stats = {
      submitted: rawStats.submitted,
      underReview: rawStats.under_review,
      changesRequired: rawStats.changes_required,
      resubmitted: rawStats.resubmitted,
      approved: rawStats.approved,
      total: rawStats.total,
    };
    const enriched = contributions.map((contribution) => {
      const latestReview = contribution.reviews?.[0];
      return {
        ...contribution,
        isRecommended: latestReview?.decision === 'recommended',
        awaitingFinalApproval:
          latestReview?.decision === 'recommended' && contribution.status === 'under_review',
      };
    });

    return {
      contributions: enriched,
      stats,
      ...(pagination.usePagination ? {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      } : {}),
      userPermissions: { hasApprovePermission, hasReviewPermission, assignedResearchSchoolIds, assignedBookSchoolIds, assignedConferenceSchoolIds, assignedSchoolIds: assignedResearchSchoolIds, canReview: hasReviewPermission, canApprove: hasApprovePermission, hasResearchReview, hasResearchApprove, hasBookReview, hasBookApprove, hasConferenceReview, hasConferenceApprove },
    };
  }

  /**
   * Get pending grant reviews based on user DRD permissions.
   */
  async getPendingGrantReviews(userId, query) {
    const { status, schoolId } = query;
    const pagination = parsePaginationQuery(query);
    let userDrdPermission = null;
    try {
      userDrdPermission = await this._getDrdPermissions(userId);
    } catch (e) { /* ignore */ }

    const permissions = userDrdPermission?.permissions || {};
    const assignedSchoolIds = (userDrdPermission?.assignedGrantSchoolIds || []).filter(id => id != null);
    const hasGrantApprove = permissions.grant_approve === true;
    const hasGrantReview = permissions.grant_review === true;

    if (!hasGrantApprove && !hasGrantReview) {
      const e = new Error('Access denied - No grant review or approve permissions'); e.statusCode = 403; throw e;
    }

    const pendingStatuses = ['submitted', 'under_review', 'changes_required', 'resubmitted'];
    let whereClause = {};
    const buildWhereClause = (statuses) => {
      if (assignedSchoolIds.length > 0) return { AND: [{ status: { in: status ? [status] : statuses } }, { OR: [{ schoolId: { in: assignedSchoolIds } }] }] };
      return { status: { in: status ? [status] : statuses } };
    };

    if (hasGrantApprove && !hasGrantReview) whereClause = buildWhereClause(['recommended', 'approved']);
    else if (hasGrantReview && !hasGrantApprove) whereClause = buildWhereClause(pendingStatuses);
    else whereClause = buildWhereClause([...pendingStatuses, 'recommended', 'approved']);

    if (schoolId) { if (whereClause.AND) whereClause.AND.push({ schoolId }); else whereClause.schoolId = schoolId; }

    const [grants, total, statusCounts] = await Promise.all([
      this.prisma.grantApplication.findMany({
        where: whereClause,
        select: GRANT_REVIEW_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        ...(pagination.usePagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      }),
      pagination.usePagination ? this.prisma.grantApplication.count({ where: whereClause }) : Promise.resolve(null),
      this.prisma.grantApplication.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      }),
    ]);

    const transformedGrants = grants.map((grant) => ({
      ...grant,
      publicationType: 'grant_proposal',
      reviews: [],
      awaitingFinalApproval: false,
      isRecommended: false,
    }));
    const rawStats = buildStatusStats(statusCounts, ['submitted', 'under_review', 'changes_required', 'resubmitted', 'recommended', 'approved']);
    const stats = {
      submitted: rawStats.submitted,
      underReview: rawStats.under_review,
      changesRequired: rawStats.changes_required,
      resubmitted: rawStats.resubmitted,
      recommended: rawStats.recommended,
      approved: rawStats.approved,
      total: rawStats.total,
    };

    return {
      contributions: transformedGrants,
      stats,
      ...(pagination.usePagination ? {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      } : {}),
      userPermissions: { hasApprovePermission: hasGrantApprove, hasReviewPermission: hasGrantReview, assignedSchoolIds, canReview: hasGrantReview, canApprove: hasGrantApprove, hasGrantReview, hasGrantApprove },
    };
  }

  /**
   * Respond to an edit suggestion (accept or reject).
   */
  async respondToSuggestion(suggestionId, userId, accept, response) {
    const suggestion = await this.prisma.researchContributionEditSuggestion.findUnique({ where: { id: suggestionId }, include: { researchContribution: true } });
    if (!suggestion) throw this._notFound('Suggestion');
    if (suggestion.researchContribution.applicantUserId !== userId) {
      const e = new Error('Only the applicant can respond to suggestions'); e.statusCode = 403; throw e;
    }

    await this.prisma.researchContributionEditSuggestion.update({ where: { id: suggestionId }, data: { status: accept ? 'accepted' : 'rejected', applicantResponse: response, respondedAt: new Date() } });

    if (accept && suggestion.fieldName && suggestion.suggestedValue) {
      let valueToUpdate = suggestion.suggestedValue;
      if (suggestion.fieldName === 'sdg_goals') {
        valueToUpdate = typeof suggestion.suggestedValue === 'string' ? suggestion.suggestedValue.split(',').map(s => s.trim()).filter(s => s) : suggestion.suggestedValue;
      } else if (['totalPresenters', 'foreignCollaborationsCount'].includes(suggestion.fieldName)) {
        valueToUpdate = suggestion.suggestedValue ? parseInt(suggestion.suggestedValue, 10) : null;
      } else if (['communicatedWithOfficialId','interdisciplinaryFromSgt','studentsFromSgt','internationalAuthor','conferenceHeldAtSgt','virtualConference','industryCollaboration','centralFacilityUsed','conferenceBestPaperAward'].includes(suggestion.fieldName)) {
        valueToUpdate = typeof suggestion.suggestedValue === 'string' ? ['yes','true'].includes(suggestion.suggestedValue.toLowerCase()) : Boolean(suggestion.suggestedValue);
      } else if (suggestion.fieldName === 'quartile') {
        const map = { 'Top 1%': 'Top_1_', 'Top 5%': 'Top_5_', 'Q1': 'Q1', 'Q2': 'Q2', 'Q3': 'Q3', 'Q4': 'Q4', 'top1': 'Top_1_', 'top5': 'Top_5_', 'q1': 'Q1', 'q2': 'Q2', 'q3': 'Q3', 'q4': 'Q4' };
        valueToUpdate = map[suggestion.suggestedValue] || suggestion.suggestedValue;
      }
      if (suggestion.fieldName !== 'targetedResearchType') {
        await this.prisma.researchContribution.update({ where: { id: suggestion.researchContributionId }, data: { [suggestion.fieldName]: valueToUpdate } });
      }
    }

    const pendingCount = await this.prisma.researchContributionEditSuggestion.count({ where: { researchContributionId: suggestion.researchContributionId, status: 'pending' } });
    await this.prisma.researchContributionReview.updateMany({ where: { researchContributionId: suggestion.researchContributionId }, data: { pendingSuggestionsCount: pendingCount } });
  }

  /**
   * Get all schools for filtering.
   */
  async getSchoolsForFilter() {
    return this.prisma.facultySchoolList.findMany({ where: { isActive: true }, select: { id: true, facultyCode: true, facultyName: true, shortName: true }, orderBy: { facultyName: 'asc' } });
  }
}

module.exports = ReviewService;
