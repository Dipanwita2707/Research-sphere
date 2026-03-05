/**
 * Event Settings / Visibility Controller
 *
 * Handles HTTP requests for event visibility configuration.
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const eventSettingsService = require('../services/eventSettings.service');

/**
 * GET /api/events/:id/settings
 * Get event visibility settings
 */
const getEventSettings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const settings = await eventSettingsService.getEventSettings(id, userId, req.user);

  return ApiResponse.success(res, settings, 'Event settings fetched successfully');
});

/**
 * PUT /api/events/:id/settings
 * Update event visibility settings
 */
const updateEventSettings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const settings = await eventSettingsService.updateEventSettings(id, userId, req.body, req.user);

  return ApiResponse.success(res, settings, 'Event settings updated successfully');
});

/**
 * PATCH /api/events/:id/settings/toggle-active
 * Toggle global event ON/OFF
 */
const toggleEventActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const settings = await eventSettingsService.toggleEventActive(id, userId, req.user);

  return ApiResponse.success(
    res,
    settings,
    `Registration is now ${settings.isActive ? 'OPEN' : 'CLOSED'}`
  );
});

/**
 * GET /api/events/hierarchy
 * Get hierarchy data (schools, departments, programs, sections, batch years)
 * Used by the Event Settings UI to populate dropdowns
 */
const getHierarchyData = asyncHandler(async (_req, res) => {
  const data = await eventSettingsService.getHierarchyData();

  return ApiResponse.success(res, data, 'Hierarchy data fetched successfully');
});

module.exports = {
  getEventSettings,
  updateEventSettings,
  toggleEventActive,
  getHierarchyData,
};
