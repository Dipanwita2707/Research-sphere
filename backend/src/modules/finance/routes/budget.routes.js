/**
 * Research budget allocation, mounted at /api/v1/finance/budgets. Budgets are per incentive cycle
 * (the period the incentive policies share); `:cycle` is a cycle id or "current".
 *   view (cycles, tree, analytics, node detail, history, export, cycle policies): any finance
 *     permission, admin; DRD applicant-analytics holders read-only for their own schools
 *   edit (cycles, budget total, allocations): finance_budget_manage (admins hold it by default)
 */
const express = require('express');
const { protect } = require('../../../shared/middleware/auth');
const { budgetViewAccess, requireBudgetEdit } = require('../middleware/budgetAccess');
const c = require('../controllers/budget.controller');

const router = express.Router();
router.use(protect, budgetViewAccess);

router.get('/', c.listCycles);
router.get('/cycles', c.listCycles);
router.post('/cycles', requireBudgetEdit, c.createCycle);
router.put('/cycles/:cycleId', requireBudgetEdit, c.updateCycle);
router.delete('/cycles/:cycleId', requireBudgetEdit, c.deleteCycle);

const CYCLE = ':cycle'; // a cycle id or "current", resolved by the service

router.get(`/${CYCLE}`, c.getTree);
router.put(`/${CYCLE}`, requireBudgetEdit, c.upsertBudget);
router.put(`/${CYCLE}/allocations`, requireBudgetEdit, c.upsertAllocation);
router.get(`/${CYCLE}/history`, c.history);
router.get(`/${CYCLE}/analytics`, c.analytics);
router.get(`/${CYCLE}/policies`, c.cyclePolicies);
router.get(`/${CYCLE}/export`, c.exportXlsx);
router.get(`/${CYCLE}/nodes/:nodeType/:nodeId`, c.nodeDetail);

module.exports = router;
