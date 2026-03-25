/**
 * Research module service factory.
 * Pre-instantiates services with their dependencies so controllers
 * don't need to import prisma directly.
 */
const prisma = require('../../../shared/config/database');
const ContributionRepository = require('../repositories/contribution.repository');
const ReviewRepository = require('../repositories/review.repository');
const ContributionService = require('./contribution.service');
const ReviewService = require('./review.service');
const auditLogger = require('../../../shared/utils/auditLogger');
const workflowQueue = require('../../../jobs/researchWorkflowQueue');

const contributionRepo = new ContributionRepository(prisma);
const reviewRepo = new ReviewRepository(prisma);

const contributionService = new ContributionService(
  contributionRepo,
  null,
  auditLogger,
  prisma,
  workflowQueue
);

const reviewService = new ReviewService(
  reviewRepo,
  contributionRepo,
  null,
  prisma,
  auditLogger,
  workflowQueue
);

module.exports = { contributionRepo, reviewRepo, contributionService, reviewService, prisma };
