/**
 * TMS Routes
 * All API routes for the Ticket Management System
 * 
 * Base path: /api/v1/tms
 * 
 * STUDENT ROUTES:
 *   POST   /tickets              - Submit a new ticket
 *   GET    /tickets/my           - List my tickets
 *   GET    /tickets/:id          - View ticket detail
 *   POST   /tickets/:id/rate     - Rate a resolved ticket
 * 
 * EMPLOYEE ROUTES:
 *   GET    /tickets/assigned     - List assigned tickets
 *   POST   /tickets/:id/remark   - Add remark/response
 *   POST   /tickets/:id/escalate - Escalate to next level
 *   POST   /tickets/:id/resolve  - Resolve the ticket
 *   POST   /tickets/:id/close    - Close the ticket
 * 
 * CATEGORY MANAGEMENT (Admin):
 *   GET    /categories           - Get active categories (for ticket submission)
 *   GET    /categories/all       - List all categories (admin)
 *   POST   /categories/master    - Create master category
 *   PATCH  /categories/master/:id - Update master category
 *   DELETE /categories/master/:id - Delete master category
 *   POST   /categories/category   - Create category
 *   PATCH  /categories/category/:id - Update category
 *   DELETE /categories/category/:id - Delete category
 *   POST   /categories/sub-category   - Create sub-category
 *   PATCH  /categories/sub-category/:id - Update sub-category
 *   DELETE /categories/sub-category/:id - Delete sub-category
 * 
 * ADMIN ROUTES:
 *   GET    /admin/analytics/overview  - Dashboard overview stats
 *   GET    /admin/analytics/employees - Per-employee stats
 *   GET    /admin/analytics/categories - Per-category stats
 *   GET    /admin/tickets             - List all tickets with filters
 */

const express = require('express');
const router = express.Router();
const { protect, checkPermission, checkAnyPermission } = require('../../../shared/middleware/auth');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ticketController = require('../controllers/ticket.controller');
const categoryController = require('../controllers/category.controller');
const adminController = require('../controllers/admin.controller');
const validators = require('../validators/tms.validators');
const { requireTicketCreator, requireTicketAssignee, requireTicketAccess } = require('../middleware/tmsAuth');

// All routes require authentication
router.use(protect);

// ============================================
// CATEGORY ROUTES (placed before param routes)
// ============================================

// Get active categories (for ticket form & filters)
router.get(
  '/categories',
  checkAnyPermission(
    ['tms_submit_ticket', 'tms_view_own_tickets', 'tms_view_assigned_tickets', 'tms_view_analytics'],
    { checkDefaultPermissions: true }
  ),
  categoryController.getActiveCategories
);

// Admin: Full category management
router.get(
  '/categories/all',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.listMasterCategories
);

// Master Categories
router.post(
  '/categories/master',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  validators.createMasterCategoryValidation,
  categoryController.createMasterCategory
);

router.patch(
  '/categories/master/:id',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  validators.updateCategoryValidation,
  categoryController.updateMasterCategory
);

router.delete(
  '/categories/master/:id',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.deleteMasterCategory
);

// Categories
router.post(
  '/categories/category',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  validators.createCategoryValidation,
  categoryController.createCategory
);

router.patch(
  '/categories/category/:id',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  validators.updateCategoryValidation,
  categoryController.updateCategory
);

router.delete(
  '/categories/category/:id',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.deleteCategory
);

// Sub-Categories
router.post(
  '/categories/sub-category',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  validators.createSubCategoryValidation,
  categoryController.createSubCategory
);

router.patch(
  '/categories/sub-category/:id',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  validators.updateCategoryValidation,
  categoryController.updateSubCategory
);

router.delete(
  '/categories/sub-category/:id',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.deleteSubCategory
);

// ============================================
// ADMIN ROUTES
// ============================================

// Role Handlers (Registrar, Dean, VC assignments)
router.get(
  '/role-handlers',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.listRoleHandlers
);

router.put(
  '/role-handlers',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.upsertRoleHandler
);

router.delete(
  '/role-handlers/:role',
  checkPermission('tms_manage_categories', { checkDefaultPermissions: true }),
  categoryController.deleteRoleHandler
);

router.get(
  '/admin/analytics/overview',
  checkPermission('tms_view_analytics', { checkDefaultPermissions: true }),
  adminController.getOverviewAnalytics
);

router.get(
  '/admin/analytics/employees',
  checkPermission('tms_view_analytics', { checkDefaultPermissions: true }),
  adminController.getEmployeeAnalytics
);

router.get(
  '/admin/analytics/categories',
  checkPermission('tms_view_analytics', { checkDefaultPermissions: true }),
  adminController.getCategoryAnalytics
);

router.get(
  '/admin/tickets',
  checkPermission('tms_view_analytics', { checkDefaultPermissions: true }),
  validators.listTicketsValidation,
  adminController.listAllTickets
);

// ============================================
// TICKET ROUTES
// ============================================

// Student: Submit a new ticket
router.post(
  '/tickets',
  checkPermission('tms_submit_ticket', { checkDefaultPermissions: true }),
  validators.createTicketValidation,
  ticketController.createTicket
);

// Student: List my tickets
router.get(
  '/tickets/my',
  checkPermission('tms_view_own_tickets', { checkDefaultPermissions: true }),
  validators.listTicketsValidation,
  ticketController.getMyTickets
);

// Employee: List assigned tickets
router.get(
  '/tickets/assigned',
  checkPermission('tms_view_assigned_tickets', { checkDefaultPermissions: true }),
  validators.listTicketsValidation,
  ticketController.getAssignedTickets
);

// Employee/Admin: Request history (tickets they acted on)
router.get(
  '/tickets/history',
  checkAnyPermission(
    ['tms_view_assigned_tickets', 'tms_view_analytics'],
    { checkDefaultPermissions: true }
  ),
  validators.listTicketsValidation,
  ticketController.getMyHistory
);

// View ticket detail (creator, assignee, or admin)
router.get(
  '/tickets/:id',
  checkAnyPermission(
    ['tms_view_own_tickets', 'tms_view_assigned_tickets', 'tms_view_analytics'],
    { checkDefaultPermissions: true }
  ),
  validators.ticketIdValidation,
  asyncHandler(requireTicketAccess),
  ticketController.getTicketById
);

// Student: Rate a resolved ticket
router.post(
  '/tickets/:id/rate',
  checkPermission('tms_view_own_tickets', { checkDefaultPermissions: true }),
  validators.ticketIdValidation,
  validators.ratingValidation,
  asyncHandler(requireTicketCreator),
  ticketController.rateTicket
);

// Employee: Add remark
router.post(
  '/tickets/:id/remark',
  checkPermission('tms_update_ticket', { checkDefaultPermissions: true }),
  validators.ticketIdValidation,
  validators.addRemarkValidation,
  asyncHandler(requireTicketAssignee),
  ticketController.addRemark
);

// Employee: Escalate ticket
router.post(
  '/tickets/:id/escalate',
  checkPermission('tms_escalate_ticket', { checkDefaultPermissions: true }),
  validators.ticketIdValidation,
  validators.escalateValidation,
  asyncHandler(requireTicketAssignee),
  ticketController.escalateTicket
);

// Employee: Resolve ticket
router.post(
  '/tickets/:id/resolve',
  checkPermission('tms_resolve_ticket', { checkDefaultPermissions: true }),
  validators.ticketIdValidation,
  validators.resolveValidation,
  asyncHandler(requireTicketAssignee),
  ticketController.resolveTicket
);

// Employee: Close ticket
router.post(
  '/tickets/:id/close',
  checkAnyPermission(['tms_close_ticket', 'tms_view_analytics'], { checkDefaultPermissions: true }),
  validators.ticketIdValidation,
  validators.closeValidation,
  ticketController.closeTicket
);

module.exports = router;
