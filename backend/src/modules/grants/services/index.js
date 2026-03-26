/**
 * Grants Services Factory
 * Wires up GrantService with GrantRepository and shared utilities.
 */

const prisma = require('../../../shared/config/database');
const GrantRepository = require('../repositories/grant.repository');
const GrantService = require('./grant.service');

const grantRepository = new GrantRepository(prisma);
const grantService = new GrantService(grantRepository);

module.exports = { grantService, grantRepository };
