/**
 * Custom Field Controller
 * 
 * Handles HTTP requests for event custom field management
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const customFieldService = require('../services/customField.service');

/**
 * Get custom fields for an event
 * 
 * @route GET /api/events/:id/custom-fields
 * @access Protected
 */
const getCustomFields = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const fields = await customFieldService.getCustomFields(id);
  
  return ApiResponse.success(res, fields, 'Custom fields fetched successfully');
});

/**
 * Create a custom field
 * 
 * @route POST /api/events/:id/custom-fields
 * @access Protected (Event Creator only)
 */
const createCustomField = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const fieldData = req.body;
  
  if (!fieldData.fieldLabel) {
    return ApiResponse.error(res, 'Field label is required', 400);
  }
  
  if (!fieldData.fieldType) {
    return ApiResponse.error(res, 'Field type is required', 400);
  }
  
  const field = await customFieldService.createCustomField(id, userId, fieldData);
  
  return ApiResponse.success(res, field, 'Custom field created successfully', 201);
});

/**
 * Update a custom field
 * 
 * @route PATCH /api/events/custom-fields/:fieldId
 * @access Protected (Event Creator only)
 */
const updateCustomField = asyncHandler(async (req, res) => {
  const { fieldId } = req.params;
  const userId = req.user.id;
  const fieldData = req.body;
  
  const field = await customFieldService.updateCustomField(fieldId, userId, fieldData);
  
  return ApiResponse.success(res, field, 'Custom field updated successfully');
});

/**
 * Delete a custom field
 * 
 * @route DELETE /api/events/custom-fields/:fieldId
 * @access Protected (Event Creator only)
 */
const deleteCustomField = asyncHandler(async (req, res) => {
  const { fieldId } = req.params;
  const userId = req.user.id;
  
  const result = await customFieldService.deleteCustomField(fieldId, userId);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Reorder custom fields
 * 
 * @route PATCH /api/events/:id/custom-fields/reorder
 * @access Protected (Event Creator only)
 */
const reorderCustomFields = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { fieldOrderMap } = req.body;
  
  if (!fieldOrderMap || typeof fieldOrderMap !== 'object') {
    return ApiResponse.error(res, 'Field order map is required', 400);
  }
  
  const result = await customFieldService.reorderCustomFields(id, userId, fieldOrderMap);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Get registration settings for an event
 * 
 * @route GET /api/events/:id/registration-settings
 * @access Protected
 */
const getRegistrationSettings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const settings = await customFieldService.getRegistrationSettings(id);
  
  return ApiResponse.success(res, settings, 'Registration settings fetched successfully');
});

/**
 * Update registration settings for an event
 * 
 * @route PATCH /api/events/:id/registration-settings
 * @access Protected (Event Creator only)
 */
const updateRegistrationSettings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const settings = req.body;
  
  const updatedSettings = await customFieldService.updateRegistrationSettings(id, userId, settings);
  
  return ApiResponse.success(res, updatedSettings, 'Registration settings updated successfully');
});

module.exports = {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  getRegistrationSettings,
  updateRegistrationSettings,
};
