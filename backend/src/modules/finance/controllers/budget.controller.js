const budgets = require('../services/budget.service');
const cycles = require('../services/incentiveCycle.service');
const logger = require('../../../shared/utils/logger');

/** Service call → { success, data }; BudgetError/PayoutError → its status, code, message and details. */
const handle = (work, fallback = 'Budget request failed') => async (req, res) => {
  try {
    const data = await work(req, res);
    if (!res.headersSent) res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({
        success: false, code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}),
      });
    }
    logger.error(fallback, error);
    return res.status(500).json({ success: false, message: fallback });
  }
};

const cycleOf = (req) => req.params.cycle;

exports.listCycles = handle(async (req) => ({
  ...(await cycles.listCycles(req.budgetScope)),
  access: { canEdit: !!req.budgetCanEdit && !!req.budgetScope.all, scoped: !req.budgetScope.all },
}), 'Failed to load incentive cycles');
exports.createCycle = handle((req) => cycles.createCycle(req.body || {}, req.user), 'Failed to create the cycle');
exports.updateCycle = handle((req) => cycles.updateCycle(req.params.cycleId, req.body || {}, req.user), 'Failed to save the cycle');
exports.deleteCycle = handle((req) => cycles.deleteCycle(req.params.cycleId), 'Failed to delete the cycle');
exports.cyclePolicies = handle((req) => cycles.cyclePolicies(cycleOf(req)), 'Failed to load the cycle policies');

exports.getTree = handle((req) => budgets.getTree(cycleOf(req), { scope: req.budgetScope, canEdit: req.budgetCanEdit }), 'Failed to load the research budget');
exports.upsertBudget = handle((req) => budgets.upsertBudget(cycleOf(req), req.body || {}, req.user), 'Failed to save the research budget');
exports.upsertAllocation = handle((req) => budgets.upsertAllocation(cycleOf(req), req.body || {}, req.user), 'Failed to save the allocation');
exports.history = handle((req) => budgets.history(cycleOf(req), {
  nodeType: req.query.nodeType || undefined,
  nodeId: req.query.nodeId || undefined,
  limit: req.query.limit,
}, req.budgetScope));
exports.nodeDetail = handle((req) => budgets.nodeDetail(cycleOf(req), req.params.nodeType, req.params.nodeId, req.budgetScope), 'Failed to load budget details');
exports.analytics = handle((req) => budgets.analytics(cycleOf(req), req.budgetScope), 'Failed to load budget analytics');

exports.exportXlsx = handle(async (req, res) => {
  const { filename, buffer } = await budgets.exportXlsx(cycleOf(req), req.budgetScope);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(Buffer.from(buffer));
}, 'Failed to export the research budget');
