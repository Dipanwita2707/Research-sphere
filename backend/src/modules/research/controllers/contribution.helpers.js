/**
 * Pure helpers for the research contribution controller: list projection,
 * pagination parsing and dashboard summaries.
 */
const { contributionRepo } = require('../services/index');

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
  sourceType: true,
  sourceSystems: true,
  specialReviewRequired: true,
  homeAffiliation: true,
  homeAffiliationBasis: true,
  homeAffiliationDetail: true,
  importConfidence: true,
  missingFields: true,
  autoCalculatedFields: true,
  schoolId: true,
  departmentId: true,
  doi: true,
  publicationDate: true,
  indexingDetails: true,
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
      name: true,
      email: true,
      affiliation: true,
      isCorresponding: true,
      authorOrder: true,
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

module.exports = {
  RESEARCH_LIST_SELECT,
  parsePagination,
  buildPaginatedResearchSummary,
  buildContributionSummary,
};
