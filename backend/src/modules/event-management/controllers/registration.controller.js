/**
 * Registration Controller
 * 
 * Handles HTTP requests for advanced event registration operations
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const registrationService = require('../services/registration.service');

/**
 * Get registration form for an event
 * 
 * @route GET /api/events/:id/registration-form
 * @access Protected
 */
const getRegistrationForm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const form = await registrationService.getRegistrationForm(id, userId);
  
  return ApiResponse.success(res, form, 'Registration form fetched successfully');
});

/**
 * Submit registration form
 * 
 * @route POST /api/events/:id/register-with-form
 * @access Protected
 */
const submitRegistrationForm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const formData = req.body;
  
  const result = await registrationService.submitRegistrationForm(id, userId, formData);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Get user's registration dashboard
 * 
 * @route GET /api/events/registration-dashboard
 * @access Protected
 */
const getRegistrationDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const dashboard = await registrationService.getRegistrationDashboard(userId);
  
  return ApiResponse.success(res, dashboard, 'Dashboard fetched successfully');
});

/**
 * Get user's profile data for auto-fill
 * 
 * @route GET /api/events/profile-data
 * @access Protected
 */
const getProfileData = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const profile = await registrationService.getUserProfileData(userId);
  
  return ApiResponse.success(res, profile, 'Profile data fetched successfully');
});

module.exports = {
  getRegistrationForm,
  submitRegistrationForm,
  getRegistrationDashboard,
  getProfileData,
};
