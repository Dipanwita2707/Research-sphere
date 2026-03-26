const prisma = require('../shared/config/database');
const log = require('../shared/utils/logger');

const INTERVAL_MS = 60 * 60 * 1000;
const STUCK_REVIEW_DAYS = Number(process.env.WORKFLOW_MONITOR_STUCK_REVIEW_DAYS || 7);
const STUCK_SUBMISSION_DAYS = Number(process.env.WORKFLOW_MONITOR_STUCK_SUBMISSION_DAYS || 14);

let intervalHandle = null;

function buildThresholdDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function getHealthSnapshot() {
  const reviewThreshold = buildThresholdDate(STUCK_REVIEW_DAYS);
  const submissionThreshold = buildThresholdDate(STUCK_SUBMISSION_DAYS);
  const researchWorkflowQueue = require('./researchWorkflowQueue');
  const emailQueue = require('./emailQueue');

  const [
    stuckResearchReview,
    researchMissingReviewer,
    stuckIprReview,
    iprMissingReviewer,
    stuckGrantReview,
    grantMissingReviewer,
    staleSubmittedResearch,
    staleSubmittedIpr,
    staleSubmittedGrant,
  ] = await Promise.all([
    prisma.researchContribution.count({
      where: { status: 'under_review', updatedAt: { lt: reviewThreshold } },
    }),
    prisma.researchContribution.count({
      where: { status: 'under_review', currentReviewerId: null },
    }),
    prisma.iprApplication.count({
      where: {
        status: { in: ['under_drd_review', 'recommended_to_head', 'under_finance_review'] },
        updatedAt: { lt: reviewThreshold },
      },
    }),
    prisma.iprApplication.count({
      where: {
        status: { in: ['under_drd_review', 'recommended_to_head', 'under_finance_review'] },
        currentReviewerId: null,
      },
    }),
    prisma.grantApplication.count({
      where: { status: 'under_review', updatedAt: { lt: reviewThreshold } },
    }),
    prisma.grantApplication.count({
      where: { status: 'under_review', currentReviewerId: null },
    }),
    prisma.researchContribution.count({
      where: {
        // Keep this aligned with ResearchContributionStatusEnum in Prisma.
        status: { in: ['submitted', 'resubmitted', 'changes_required'] },
        updatedAt: { lt: submissionThreshold },
      },
    }),
    prisma.iprApplication.count({
      where: {
        status: { in: ['submitted', 'changes_required', 'resubmitted', 'pending_mentor_approval'] },
        updatedAt: { lt: submissionThreshold },
      },
    }),
    prisma.grantApplication.count({
      where: {
        status: { in: ['submitted', 'resubmitted', 'changes_required'] },
        updatedAt: { lt: submissionThreshold },
      },
    }),
  ]);

  return {
    queues: {
      email: emailQueue.isAvailable(),
      researchWorkflow: researchWorkflowQueue.isAvailable(),
    },
    research: {
      stuckReview: stuckResearchReview,
      missingReviewer: researchMissingReviewer,
      staleSubmitted: staleSubmittedResearch,
    },
    ipr: {
      stuckReview: stuckIprReview,
      missingReviewer: iprMissingReviewer,
      staleSubmitted: staleSubmittedIpr,
    },
    grants: {
      stuckReview: stuckGrantReview,
      missingReviewer: grantMissingReviewer,
      staleSubmitted: staleSubmittedGrant,
    },
  };
}

function emitAlerts(snapshot) {
  if (!snapshot.queues.email) {
    log.warn('[WorkflowMonitor] Email queue running in sync fallback mode');
  }
  if (!snapshot.queues.researchWorkflow) {
    log.warn('[WorkflowMonitor] Research workflow queue running in sync fallback mode');
  }

  const buckets = [
    ['research', snapshot.research],
    ['ipr', snapshot.ipr],
    ['grants', snapshot.grants],
  ];

  buckets.forEach(([label, data]) => {
    if (data.stuckReview > 0) {
      log.warn(`[WorkflowMonitor] ${label} has ${data.stuckReview} item(s) stuck in review for more than ${STUCK_REVIEW_DAYS} day(s)`);
    }
    if (data.missingReviewer > 0) {
      log.warn(`[WorkflowMonitor] ${label} has ${data.missingReviewer} under-review item(s) without a reviewer`);
    }
    if (data.staleSubmitted > 0) {
      log.warn(`[WorkflowMonitor] ${label} has ${data.staleSubmitted} submitted item(s) inactive for more than ${STUCK_SUBMISSION_DAYS} day(s)`);
    }
  });
}

async function runWorkflowHealthCheck() {
  try {
    const snapshot = await getHealthSnapshot();
    emitAlerts(snapshot);
    return snapshot;
  } catch (error) {
    log.error('[WorkflowMonitor] Health check failed', error);
    return null;
  }
}

function startWorkflowHealthMonitor() {
  if (intervalHandle) return;

  log.info('[WorkflowMonitor] Started - Running every hour');
  runWorkflowHealthCheck();
  intervalHandle = setInterval(runWorkflowHealthCheck, INTERVAL_MS);
}

function stopWorkflowHealthMonitor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startWorkflowHealthMonitor,
  stopWorkflowHealthMonitor,
  runWorkflowHealthCheck,
};
