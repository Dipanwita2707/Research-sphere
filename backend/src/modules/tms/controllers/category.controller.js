/**
 * TMS Category Controller
 * HTTP handlers for admin category hierarchy management
 */
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const categoryService = require('../services/category.service');

// ============================================
// MASTER CATEGORY
// ============================================

const listMasterCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.listMasterCategories(true); // includeInactive for admin
  return ApiResponse.success(res, result, 'Master categories fetched successfully');
});

const createMasterCategory = asyncHandler(async (req, res) => {
  const { name, description, isAcademic, employeeId } = req.body;
  const result = await categoryService.createMasterCategory({ name, description, isAcademic, employeeId });
  return ApiResponse.success(res, result, 'Master category created successfully', 201);
});

const updateMasterCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isAcademic, isActive, employeeId } = req.body;
  const result = await categoryService.updateMasterCategory(id, { name, description, isAcademic, isActive, employeeId });
  return ApiResponse.success(res, result, 'Master category updated successfully');
});

const deleteMasterCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteMasterCategory(req.params.id);
  return ApiResponse.success(res, null, 'Master category deleted successfully');
});

// ============================================
// CATEGORY
// ============================================

const createCategory = asyncHandler(async (req, res) => {
  const { name, description, masterCategoryId, employeeId } = req.body;
  const result = await categoryService.createCategory({ name, description, masterCategoryId, employeeId });
  return ApiResponse.success(res, result, 'Category created successfully', 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, employeeId } = req.body;
  const result = await categoryService.updateCategory(id, { name, description, isActive, employeeId });
  return ApiResponse.success(res, result, 'Category updated successfully');
});

const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  return ApiResponse.success(res, null, 'Category deleted successfully');
});

// ============================================
// SUB-CATEGORY
// ============================================

const createSubCategory = asyncHandler(async (req, res) => {
  const { name, description, categoryId, employeeId, priority, slaHours } = req.body;
  const result = await categoryService.createSubCategory({ name, description, categoryId, employeeId, priority, slaHours });
  return ApiResponse.success(res, result, 'Sub-category created successfully', 201);
});

const updateSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, employeeId, priority, slaHours } = req.body;
  const result = await categoryService.updateSubCategory(id, { name, description, isActive, employeeId, priority, slaHours });
  return ApiResponse.success(res, result, 'Sub-category updated successfully');
});

const deleteSubCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteSubCategory(req.params.id);
  return ApiResponse.success(res, null, 'Sub-category deleted successfully');
});

// ============================================
// PUBLIC: Get categories for ticket submission
// ============================================

const getActiveCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.listMasterCategories(false); // activeOnly = exclude inactive
  return ApiResponse.success(res, result, 'Active categories fetched successfully');
});

// ============================================
// ROLE HANDLERS (Registrar, Dean, VC)
// ============================================

const listRoleHandlers = asyncHandler(async (req, res) => {
  const result = await categoryService.listRoleHandlers();
  return ApiResponse.success(res, result, 'Role handlers fetched successfully');
});

const upsertRoleHandler = asyncHandler(async (req, res) => {
  const { role, employeeId } = req.body;
  const result = await categoryService.upsertRoleHandler(role, employeeId);
  return ApiResponse.success(res, result, 'Role handler updated successfully');
});

const deleteRoleHandler = asyncHandler(async (req, res) => {
  const { role } = req.params;
  await categoryService.deleteRoleHandler(role);
  return ApiResponse.success(res, null, 'Role handler removed successfully');
});

module.exports = {
  listMasterCategories,
  createMasterCategory,
  updateMasterCategory,
  deleteMasterCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  getActiveCategories,
  listRoleHandlers,
  upsertRoleHandler,
  deleteRoleHandler,
};
