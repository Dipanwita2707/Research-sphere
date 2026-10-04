/**
 * Research Contribution Controller (Thin)
 * parse req → call service → send res. No business logic, no direct Prisma calls.
 */
const { contributionRepo, contributionService } = require('../services/index');
const { downloadFromS3 } = require('../../../shared/utils/s3');
const { contentTypeFor } = require('../../../shared/utils/fileTypes');
const { createModuleLogger } = require('../../../shared/utils/logger');
const reviewScope = require('../services/reviewScope');
const { isContributionParticipant, isGrantParticipant } = require('../utils/objectAccess');
const { parseIncentivePreview } = require('../validators/incentivePreview.validation');
const tenantContext = require('../../../shared/tenancy/tenantContext');

// Create module-specific logger
const logger = createModuleLogger('research');

const _err = (res, error, fallback = 'Operation failed') => {
  const code = error.statusCode || 500;
  if (code < 500) {
    return res.status(code).json({
      success: false,
      message: error.message,
      ...(error.code && typeof error.code === 'string' && !error.code.startsWith('P') ? { code: error.code } : {}),
      ...(error.existing ? { existing: error.existing } : {}),
    });
  }
  logger.error(error.message || error, { stack: error.stack, statusCode: code });
  return res.status(500).json({ success: false, message: fallback });
};

const {
  RESEARCH_LIST_SELECT,
  parsePagination,
  buildPaginatedResearchSummary,
  buildContributionSummary,
} = require('./contribution.helpers');

exports.createResearchContribution = async (req, res) => {
  try {
    logger.logUserAction(req.user.id, 'create_contribution', 'Creating new research contribution', {
      publicationType: req.body.publicationType,
      title: req.body.title
    });
    
    const body = { ...req.body };
    // Import provenance is written only by the publication-sync job, never by a user request
    for (const key of ['sourceType', 'sourceSystems', 'externalIds', 'importedAt', 'lastSyncedAt',
      'specialReviewRequired', 'importConfidence', 'missingFields', 'autoCalculatedFields',
      'fieldProvenance', 'importMetadata']) {
      delete body[key];
    }
    const cats = body.indexingCategories || [];
    if (cats.includes('subsidiary_if_above_20') && !body.subsidiaryImpactFactor && body.impactFactor) body.subsidiaryImpactFactor = body.impactFactor;
    const contribution = await contributionService.createContribution({ ...body, userId: req.user.id, userRole: req.user.role, request: req }, { manuscriptFilePath: body.manuscriptFilePath, supportingDocsFilePaths: body.supportingDocsFilePaths });
    
    logger.logUserAction(req.user.id, 'create_contribution_success', 'Research contribution created successfully', {
      contributionId: contribution.id,
      applicationNumber: contribution.applicationNumber
    });
    
    res.status(201).json({ success: true, message: 'Research contribution created successfully', data: contribution });
  } catch (error) {
    logger.logError('create_contribution', error, { userId: req.user.id });
    if (error.validationErrors) return res.status(400).json({ success: false, message: error.message, errors: error.validationErrors });
    _err(res, error, 'Failed to create research contribution');
  }
};

/**
 * POST /research/incentive-preview — what saving this form payload would pay each author.
 * Read-only; policies are looked up in the caller's university (tenant-scoped client).
 */
exports.previewIncentive = async (req, res) => {
  try {
    if (!tenantContext.getTenantId()) {
      return res.status(400).json({ success: false, message: 'Select a university to preview incentives' });
    }
    const data = parseIncentivePreview(req.body);
    const preview = await contributionService.previewIncentiveShares({ ...data, userId: req.user.id, userRole: req.user.role });
    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    if (error.validationErrors) return res.status(400).json({ success: false, message: error.message, errors: error.validationErrors });
    _err(res, error, 'Failed to preview incentives');
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
    const userId = req.user.id;
    // 404 for records that do not exist or that this user may not see (object-level authz)
    const { record: contribution, isGrant } = await contributionService.getContributionForViewer(req.params.id, req.user);
    // DRD reviewers may open items only inside their assigned schools for that category
    await reviewScope.assertCanViewInScope(
      req.user,
      isGrant ? 'grant' : reviewScope.categoryForPublicationType(contribution.publicationType),
      contribution.schoolId,
      {
        participant: isGrant ? isGrantParticipant(req.user, contribution) : isContributionParticipant(req.user, contribution),
        notFoundMessage: 'Research contribution or grant not found',
      }
    );
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
    logger.logUserAction(req.user.id, 'submit_contribution', 'Submitting research contribution for review', {
      contributionId: req.params.id
    });
    
    const result = await contributionService.submitContribution(req.params.id, req.user.id, req);
    
    logger.logUserAction(req.user.id, 'submit_contribution_success', 'Research contribution submitted successfully', {
      contributionId: req.params.id,
      status: result.data?.status
    });
    
    res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) { 
    logger.logError('submit_contribution', error, { userId: req.user.id, contributionId: req.params.id });
    _err(res, error, 'Failed to submit research contribution'); 
  }
};

/** POST /research/submit-many { ids } — submit each draft in turn; one failure never stops the rest. */
exports.submitManyContributions = async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String))] : [];
  if (!ids.length) return res.status(400).json({ success: false, message: 'Select at least one contribution' });
  if (ids.length > 200) return res.status(400).json({ success: false, message: 'Submit at most 200 contributions at a time' });
  const results = [];
  for (const id of ids) {
    try {
      const result = await contributionService.submitContribution(id, req.user.id, req);
      results.push({ id, ok: true, status: result.data?.status || null });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) logger.logError('submit_many_contribution', error, { userId: req.user.id, contributionId: id });
      results.push({ id, ok: false, code: error.code || null, message: error.statusCode && error.statusCode < 500 ? error.message : 'Failed to submit' });
    }
  }
  const submitted = results.filter((r) => r.ok).length;
  logger.logUserAction(req.user.id, 'submit_many_contributions', 'Bulk submit', { requested: ids.length, submitted });
  return res.status(200).json({ success: true, data: { submitted, failed: results.length - submitted, results } });
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
    // Applicant, authors, mentor, reviewers and DRD staff only; everyone else gets 404
    const { s3Key, filename: originalFilename } = await contributionService.resolveDocumentForViewer(id, req.user, type, filename);
    const fileData = await downloadFromS3(s3Key);
    const safeName = String(originalFilename).replace(/["\r\n\\]/g, '_');
    // Type from the extension, never the stored (uploader-declared) ContentType
    res.setHeader('Content-Type', contentTypeFor(s3Key));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', fileData.contentLength);
    fileData.stream.pipe(res);
  } catch (error) { _err(res, error, 'Failed to download document'); }
};

exports.getPublicRepository = async (req, res) => {
  try {
    const all = await contributionRepo.findAll({
      where: {
        status: { in: ['approved', 'completed'] }
      },
      select: {
        id: true,
        applicationNumber: true,
        title: true,
        publicationType: true,
        journalName: true,
        publisherName: true,
        conferenceName: true,
        doi: true,
        publicationDate: true,
        completedAt: true,
        createdAt: true,
        status: true,
        schoolId: true,
        departmentId: true,
        school: { select: { id: true, facultyName: true } },
        department: { select: { id: true, departmentName: true } },
        authors: {
          select: {
            id: true,
            name: true,
            affiliation: true,
            isCorresponding: true,
            // Home-institution author, as classified at import/filing against this
            // university's own affiliation names (the UI highlights these).
            isInternal: true
          }
        }
      },
      orderBy: { completedAt: 'desc' }
    });
    
    return res.status(200).json({
      success: true,
      data: all
    });
  } catch (error) {
    logger.error('Error fetching public research repository', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to fetch public research repository' });
  }
};

// Backward compatibility: calculateIncentives used by review.controller
exports.calculateIncentives = async (...args) => {
  try {
    const { IncentiveCalculator } = require('../services/incentive-calculator');
    const { prisma } = require('../services/index');
    const calc = new IncentiveCalculator(prisma);
    return await calc.calculate({ contributionData: args[0], publicationType: args[1], authorRole: args[2], isStudent: args[3], sjrValue: args[4], coAuthorCount: args[5], totalAuthors: args[6], isInternal: args[7], internalCoAuthorCount: args[8], externalFirstCorrespondingPct: args[9], internalEmployeeCoAuthorCount: args[10] });
  } catch (error) {
    logger.error('Error calculating incentives', { error: error.message, stack: error.stack });
    return { totalPoolAmount: 0, totalPoolPoints: 0, incentiveAmount: 0, points: 0 };
  }
};

module.exports = exports;
