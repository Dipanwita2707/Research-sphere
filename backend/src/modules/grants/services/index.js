/**
 * Grants Services Factory
 * Wires up GrantService with GrantRepository and shared utilities.
 */

const prisma = require('../../../shared/config/database');
const GrantRepository = require('../repositories/grant.repository');
const GrantService = require('./grant.service');
const workflowQueue = require('../../../jobs/researchWorkflowQueue');

const grantRepository = new GrantRepository(prisma);
const grantService = new GrantService(grantRepository, null, workflowQueue);

module.exports = { grantService, grantRepository };
