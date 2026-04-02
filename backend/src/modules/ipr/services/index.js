/**
 * IPR Services Factory
 * Wires up IprService with IprRepository and shared utilities.
 */

const prisma = require('../../../shared/config/database');
const IprRepository = require('../repositories/ipr.repository');
const IprService = require('./ipr.service');

const iprRepository = new IprRepository(prisma);
const iprService = new IprService(iprRepository);

module.exports = { iprService, iprRepository };
