/**
 * Research Contribution Controller (Thin)
 * parse req → call service → send res. No business logic, no direct Prisma calls.
 */
const { contributionRepo, contributionService } = require('../services/index');
const { downloadFromS3 } = require('../../../shared/utils/s3');

const _err = (res, error, fallback = 'Operation failed') => {
  const code = error.statusCode || 500;
  if (code < 500) return res.status(code).json({ success: false, message: error.message });
  console.error(error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};

const RESEARCH_LIST_SELECT = {
  id: true,
  applicationNumber: true,
  applicantUserId: true,
  publicationType: true,
  title: true,
  journalName: true,
  conferenceName: true,
  status: true,
  submittedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  incentiveAmount: true,
  pointsAwarded: true,
  calculatedIncentiveAmount: true,
  calculatedPoints: true,
  schoolId: true,
  departmentId: true,
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
  authors: {
    select: {
      userId: true,
      uid: true,
      registrationNo: true,
      authorType: true,
      incentiveShare: true,
      pointsShare: true,
    },
  },
};

function parsePagination(query = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    usePagination: query.page !== undefined || query.limit !== undefined,
  };
}

async function buildPaginatedResearchSummary(where, userId) {
  const asApplicantWhere = {
    AND: [
      where,
      { applicantUserId: userId },
    ],
  };
  const asCoAuthorWhere = {
    AND: [
      where,
      { applicantUserId: { not: userId } },
      { authors: { some: { userId } } },
    ],
  };
  const [statusCounts, completedTotals, asApplicant, asCoAuthor] = await Promise.all([
    contributionRepo.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    contributionRepo.aggregate({
      where: {
        AND: [
          where,
          { status: 'completed' },
        ],
      },
      _sum: {
        incentiveAmount: true,
        pointsAwarded: true,
      },
    }),
    contributionRepo.count(asApplicantWhere),
    contributionRepo.count(asCoAuthorWhere),
  ]);

  const summary = {
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    totalIncentives: Number(completedTotals._sum.incentiveAmount || 0),
    totalPoints: Number(completedTotals._sum.pointsAwarded || 0),
    asApplicant,
    asCoAuthor,
  };

  statusCounts.forEach((row) => {
    const count = row._count.id;
    summary.total += count;
    if (row.status === 'draft') summary.draft = count;
    if (['submitted', 'under_review', 'resubmitted', 'changes_required', 'pending_mentor_approval'].includes(row.status)) {
      summary.pending += count;
    }
    if (row.status === 'approved') summary.approved = count;
    if (row.status === 'completed') summary.completed = count;
    if (row.status === 'rejected') summary.rejected = count;
  });

  summary.totalIncentives = Number(summary.totalIncentives.toFixed(2));
  return summary;
}

function buildContributionSummary(contributions = []) {
  const summary = {
    total: contributions.length,
    draft: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    totalIncentives: 0,
    totalPoints: 0,
  };

  contributions.forEach((contribution) => {
    if (contribution.status === 'draft') summary.draft += 1;
    if (['submitted', 'under_review', 'resubmitted', 'changes_required', 'pending_mentor_approval'].includes(contribution.status)) {
      summary.pending += 1;
    }
    if (contribution.status === 'approved') summary.approved += 1;
    if (contribution.status === 'completed') {
      summary.completed += 1;
      summary.totalIncentives += Number(contribution.incentiveAmount || 0);
      summary.totalPoints += Number(contribution.pointsAwarded || 0);
    }
    if (contribution.status === 'rejected') summary.rejected += 1;
  });

  summary.totalIncentives = Number(summary.totalIncentives.toFixed(2));
  return summary;
}

exports.createResearchContribution = async (req, res) => {
  try {
    const body = { ...req.body };
    const cats = body.indexingCategories || [];
    if (cats.includes('subsidiary_if_above_20') && !body.subsidiaryImpactFactor && body.impactFactor) body.subsidiaryImpactFactor = body.impactFactor;
    const contribution = await contributionService.createContribution({ ...body, userId: req.user.id, userRole: req.user.role, request: req }, { manuscriptFilePath: body.manuscriptFilePath, supportingDocsFilePaths: body.supportingDocsFilePaths });
    res.status(201).json({ success: true, message: 'Research contribution created successfully', data: contribution });
  } catch (error) {
    if (error.validationErrors) return res.status(400).json({ success: false, message: error.message, errors: error.validationErrors });
    _err(res, error, 'Failed to create research contribution');
  }
};

exports.getMyResearchContributions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, publicationType } = req.query;
    const pagination = parsePagination(req.query);
    const where = { applicantUserId: userId };
    if (status) where.status = status;
    if (publicationType) where.publicationType = publicationType;

    if (pagination.usePagination) {
      const combinedWhere = {
        AND: [
          publicationType ? { publicationType } : {},
          status ? { status } : {},
          {
            OR: [
              { applicantUserId: userId },
              { authors: { some: { userId } } },
            ],
          },
        ],
      };

      const [contributions, total, summary] = await Promise.all([
        contributionRepo.findAll({
          where: combinedWhere,
          select: RESEARCH_LIST_SELECT,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        contributionRepo.count(combinedWhere),
        buildPaginatedResearchSummary(combinedWhere, userId),
      ]);

      const myContributions = contributions.filter((contribution) => contribution.applicantUserId === userId);
      const coAuthorContributions = contributions.filter((contribution) => contribution.applicantUserId !== userId);

      return res.status(200).json({
        success: true,
        data: {
          contributions,
          myContributions,
          coAuthorContributions,
          summary,
        },
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      });
    }

    const [myContributions, coAuthorContributions] = await Promise.all([
      contributionRepo.findAll({ where, select: RESEARCH_LIST_SELECT, orderBy: { createdAt: 'desc' }, take: 500 }),
      contributionRepo.findAll({
        where: {
          authors: { some: { userId } },
          applicantUserId: { not: userId },
        },
        select: RESEARCH_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const all = [...myContributions, ...coAuthorContributions];
    const summary = buildContributionSummary(all);

    res.status(200).json({
      success: true,
      data: {
        contributions: all,
        myContributions,
        coAuthorContributions,
        summary: {
          ...summary,
          asApplicant: myContributions.length,
          asCoAuthor: coAuthorContributions.length,
        },
      },
    });
  } catch (error) { _err(res, error, 'Failed to get research contributions'); }
};

exports.getPendingMentorApprovals = async (req, res) => {
  try {
    const contributions = await contributionRepo.findPendingReview(req.user.uid);
    res.status(200).json({ success: true, data: contributions, count: contributions.length });
  } catch (error) { _err(res, error, 'Failed to get pending mentor approvals'); }
};

exports.getContributedResearch = async (req, res) => {
  try {
    const { id: userId, uid: userUid } = req.user;
    const authorRecords = await contributionService.getContributedResearch(userId, userUid);
    const contributions = authorRecords
      .filter((authorRecord) => authorRecord.researchContribution.applicantUserId !== userId)
      .map((authorRecord) => ({
        ...authorRecord.researchContribution,
        myAuthorRole: authorRecord.authorType,
        myIncentiveShare: authorRecord.incentiveShare,
        myPointsShare: authorRecord.pointsShare,
      }))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    const summary = {
      total: contributions.length,
      completed: 0,
      totalIncentives: 0,
      totalPoints: 0,
    };

    contributions.forEach((contribution) => {
      if (contribution.status === 'completed') {
        summary.completed += 1;
        summary.totalIncentives += Number(contribution.myIncentiveShare || 0);
        summary.totalPoints += Number(contribution.myPointsShare || 0);
      }
    });

    summary.totalIncentives = Number(summary.totalIncentives.toFixed(2));

    res.status(200).json({
      success: true,
      data: {
        contributions,
        summary,
      },
    });
  } catch (error) { _err(res, error, 'Failed to get contributed research'); }
};

exports.getResearchContributionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let contribution = await contributionRepo.findById(id, {
      applicantDetails: true, authors: true, school: true, department: true,
      reviews: { include: { reviewer: { select: { id: true, uid: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } } }, orderBy: { createdAt: 'desc' } },
      statusHistory: { include: { changedBy: { select: { id: true, uid: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } } }, orderBy: { changedAt: 'desc' } },
      editSuggestions: { include: { reviewer: { select: { id: true, uid: true, employeeDetails: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } },
      applicantUser: { select: { id: true, uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true, designation: true } } } }
    });
    let isGrant = false;
    if (!contribution) {
      contribution = await contributionService.getGrantById(id);
      isGrant = true;
    }
    if (!contribution) return res.status(404).json({ success: false, message: 'Research contribution or grant not found' });
    const isApplicant = contribution.applicantUserId === userId;
    const isAuthor = isGrant ? contribution.investigators?.some(i => i.userId === userId || i.uid === req.user.uid) : contribution.authors?.some(a => a.userId === userId || a.uid === req.user.uid || a.registrationNo === req.user.uid);
    const n = v => v ? Number(v) : v;
    res.status(200).json({ success: true, data: { ...contribution, impactFactor: n(contribution.impactFactor), sjr: n(contribution.sjr), naasRating: n(contribution.naasRating), subsidiaryImpactFactor: n(contribution.subsidiaryImpactFactor), calculatedIncentiveAmount: n(contribution.calculatedIncentiveAmount), incentiveAmount: n(contribution.incentiveAmount), requestedAmount: n(contribution.requestedAmount), sanctionedAmount: n(contribution.sanctionedAmount), isApplicant, isAuthor, isGrant, publicationType: isGrant ? 'grant_proposal' : contribution.publicationType, hasPendingSuggestions: contribution.editSuggestions?.some(s => s.status === 'pending') || false } });
  } catch (error) { _err(res, error, 'Failed to get research contribution'); }
};

exports.updateResearchContribution = async (req, res) => {
  try {
    const result = await contributionService.updateContribution(req.params.id, req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Research contribution updated successfully', data: result });
  } catch (error) { _err(res, error, 'Failed to update research contribution'); }
};

exports.submitResearchContribution = async (req, res) => {
  try {
    const result = await contributionService.submitContribution(req.params.id, req.user.id, req);
    res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) { _err(res, error, 'Failed to submit research contribution'); }
};

exports.mentorApproveContribution = async (req, res) => {
  try {
    const result = await contributionService.mentorApprove(req.params.id, req.user.id, req.body.comments, req);
    res.status(200).json({ success: true, message: 'Research contribution approved and forwarded to DRD', data: result });
  } catch (error) { _err(res, error, 'Failed to approve contribution'); }
};

exports.mentorRejectContribution = async (req, res) => {
  try {
    const { comments } = req.body;
    if (!comments?.trim()) return res.status(400).json({ success: false, message: 'Comments are required for rejection' });
    const result = await contributionService.mentorReject(req.params.id, req.user.id, comments, req);
    res.status(200).json({ success: true, message: 'Contribution sent back to student with comments', data: result });
  } catch (error) { _err(res, error, 'Failed to reject contribution'); }
};

exports.resubmitResearchContribution = async (req, res) => {
  try {
    const result = await contributionService.resubmitContribution(req.params.id, req.user.id, req.body.comments);
    res.status(200).json({ success: true, message: 'Research contribution resubmitted successfully', data: result });
  } catch (error) { _err(res, error, 'Failed to resubmit research contribution'); }
};

exports.deleteResearchContribution = async (req, res) => {
  try {
    await contributionService.deleteContribution(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: 'Research contribution deleted successfully' });
  } catch (error) { _err(res, error, 'Failed to delete research contribution'); }
};

exports.addAuthor = async (req, res) => {
  try {
    const author = await contributionService.addAuthor(req.params.id, req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Author added successfully', data: author });
  } catch (error) { _err(res, error, 'Failed to add author'); }
};

exports.updateAuthor = async (req, res) => {
  try {
    const updated = await contributionService.updateAuthor(req.params.id, req.params.authorId, req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Author updated successfully', data: updated });
  } catch (error) { _err(res, error, 'Failed to update author'); }
};

exports.removeAuthor = async (req, res) => {
  try {
    await contributionService.removeAuthor(req.params.id, req.params.authorId, req.user.id);
    res.status(200).json({ success: true, message: 'Author removed successfully' });
  } catch (error) { _err(res, error, 'Failed to remove author'); }
};

exports.lookupByRegistration = async (req, res) => {
  try {
    const lookupValue = req.params.registrationNumber?.trim();
    if (!lookupValue) return res.status(400).json({ success: false, message: 'Registration number or UID is required' });
    const result = await contributionService.lookupUserByRegistration(lookupValue);
    if (!result) return res.status(404).json({ success: false, message: 'User not found with this registration number' });
    res.status(200).json({ success: true, data: result });
  } catch (error) { _err(res, error, 'Failed to lookup user'); }
};

exports.getIncentivePolicies = async (req, res) => {
  try {
    const policies = await contributionService.getIncentivePolicies();
    res.status(200).json({ success: true, data: policies });
  } catch (error) { _err(res, error, 'Failed to fetch incentive policies'); }
};

exports.uploadDocuments = async (req, res) => {
  try {
    const result = await contributionService.uploadDocuments(req.params.id, req.user.id, req.files);
    res.status(200).json({ success: true, message: 'Documents uploaded successfully', data: result });
  } catch (error) { _err(res, error, 'Failed to upload documents'); }
};

exports.downloadDocument = async (req, res) => {
  try {
    const { id, type, filename } = req.params;
    const contribution = await contributionRepo.findById(id);
    if (!contribution) return res.status(404).json({ success: false, message: 'Research contribution not found' });
    const canAccess = contribution.applicantUserId === req.user.id || ['admin','central_admin','reviewer'].includes(req.user.role);
    if (!canAccess) return res.status(403).json({ success: false, message: 'You do not have permission to access this file' });
    let s3Key = null, originalFilename = filename;
    if (type === 'manuscript' && contribution.manuscriptFilePath) {
      let m = contribution.manuscriptFilePath;
      if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { s3Key = m; } }
      if (m && typeof m === 'object') { s3Key = m.s3Key; originalFilename = m.name || filename; }
    } else if (type === 'supporting' && contribution.supportingDocsFilePaths) {
      const docs = typeof contribution.supportingDocsFilePaths === 'string' ? JSON.parse(contribution.supportingDocsFilePaths) : contribution.supportingDocsFilePaths;
      const doc = docs.files?.find(f => f.name === filename || f.s3Key?.includes(filename));
      if (doc) { s3Key = doc.s3Key; originalFilename = doc.name || filename; }
    }
    if (!s3Key) return res.status(404).json({ success: false, message: 'Document not found' });
    const fileData = await downloadFromS3(s3Key);
    res.setHeader('Content-Type', fileData.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
    res.setHeader('Content-Length', fileData.contentLength);
    fileData.stream.pipe(res);
  } catch (error) { _err(res, error, 'Failed to download document'); }
};

// Backward compatibility: calculateIncentives used by review.controller
exports.calculateIncentives = async (...args) => {
  try {
    const { IncentiveCalculator } = require('../services/incentive-calculator');
    const { prisma } = require('../services/index');
    const calc = new IncentiveCalculator(prisma);
    return await calc.calculate({ contributionData: args[0], publicationType: args[1], authorRole: args[2], isStudent: args[3], sjrValue: args[4], coAuthorCount: args[5], totalAuthors: args[6], isInternal: args[7], internalCoAuthorCount: args[8], externalFirstCorrespondingPct: args[9], internalEmployeeCoAuthorCount: args[10] });
  } catch (error) {
    console.error('[calculateIncentives] Error:', error);
    return { totalPoolAmount: 0, totalPoolPoints: 0, incentiveAmount: 0, points: 0 };
  }
};

module.exports = exports;
