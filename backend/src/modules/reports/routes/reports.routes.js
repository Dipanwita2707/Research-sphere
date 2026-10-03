/**
 * Accreditation reports — mounted at /api/v1/reports.
 *
 *   GET /naac/criterion3?fromYear=2021&toYear=2025[&paperYearBasis=calendar|academic]  → .xlsx
 *   GET /nirf/research?financialYears=2022-23,2023-24,2024-25                        → .xlsx
 *   GET /summary?fromYear&toYear[&financialYears][&paperYearBasis]                   → JSON preview
 *
 * Access: admins, superadmins, and holders of applicant_analytics or drd_member_analytics.
 */
const express = require('express');
const controller = require('../controllers/reports.controller');
const { protect, checkAnyPermission } = require('../../../shared/middleware/auth');

const router = express.Router();

router.use(protect);

const analyticsCheck = checkAnyPermission(['applicant_analytics', 'drd_member_analytics'], {
  errorMessage: 'Accreditation reports need Applicant Analytics or DRD Member Analytics access',
});
const canExport = (req, res, next) =>
  req.user?.role === 'admin' || req.user?.role === 'superadmin' ? next() : analyticsCheck(req, res, next);

router.get('/naac/criterion3', canExport, controller.naacCriterion3);
router.get('/nirf/research', canExport, controller.nirfResearch);
router.get('/summary', canExport, controller.summary);

module.exports = router;
