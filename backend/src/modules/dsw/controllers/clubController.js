/**
 * DSW Club Controller
 * Handles HTTP requests for club operations
 */

const clubService = require('../services/clubService');
const notingIntegrationService = require('../services/notingIntegrationService');
const { SuccessMessages, ErrorMessages } = require('../constants');

/**
 * Get all clubs with filtering
 * GET /api/dsw/clubs
 */
async function getClubs(req, res) {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      categoryId: req.query.categoryId,
      search: req.query.search,
      academicSession: req.query.academicSession,
      myClubs: req.query.myClubs === 'true',
    };

    const result = await clubService.getClubs(filters, req.user);

    res.json({
      success: true,
      data: result.clubs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error in getClubs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clubs',
      error: error.message,
    });
  }
}

/**
 * Get club by ID
 * GET /api/dsw/clubs/:clubId
 */
async function getClubById(req, res) {
  try {
    const { clubId } = req.params;
    const club = await clubService.getClubById(clubId, req.user);

    res.json({
      success: true,
      data: club,
    });
  } catch (error) {
    console.error('Error in getClubById:', error);
    const status = error.message === ErrorMessages.CLUB_NOT_FOUND ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Get my clubs (where user is facilitator, vice chairperson, or member)
 * GET /api/dsw/clubs/my
 */
async function getMyClubs(req, res) {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      myClubs: true,
    };

    const result = await clubService.getClubs(filters, req.user);

    res.json({
      success: true,
      data: result.clubs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error in getMyClubs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your clubs',
      error: error.message,
    });
  }
}

/**
 * Add member to club
 * POST /api/dsw/clubs/:clubId/members
 */
async function addMember(req, res) {
  try {
    const { clubId } = req.params;
    const { studentId } = req.body;

    const member = await clubService.addMember(
      clubId,
      studentId,
      req.user.id,
      req
    );

    res.status(201).json({
      success: true,
      message: SuccessMessages.MEMBER_ADDED,
      data: member,
    });
  } catch (error) {
    console.error('Error in addMember:', error);
    const status = 
      error.message === ErrorMessages.CLUB_NOT_FOUND ? 404 :
      error.message === ErrorMessages.DUPLICATE_MEMBER ? 409 :
      error.message === ErrorMessages.INVALID_MEMBER ? 400 :
      500;
    
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Remove member from club
 * DELETE /api/dsw/clubs/:clubId/members/:memberId
 */
async function removeMember(req, res) {
  try {
    const { clubId, memberId } = req.params;
    const { reason } = req.body;

    const member = await clubService.removeMember(
      clubId,
      memberId,
      req.user.id,
      reason,
      req
    );

    res.json({
      success: true,
      message: SuccessMessages.MEMBER_REMOVED,
      data: member,
    });
  } catch (error) {
    console.error('Error in removeMember:', error);
    const status = 
      error.message === ErrorMessages.MEMBER_NOT_FOUND ? 404 :
      500;
    
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Get club members
 * GET /api/dsw/clubs/:clubId/members
 */
async function getClubMembers(req, res) {
  try {
    const { clubId } = req.params;
    const club = await clubService.getClubById(clubId, req.user);

    res.json({
      success: true,
      data: club.members,
      count: club._count.members,
    });
  } catch (error) {
    console.error('Error in getClubMembers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch club members',
      error: error.message,
    });
  }
}

/**
 * Update club editable fields
 * PATCH /api/dsw/clubs/:clubId
 */
async function updateClub(req, res) {
  try {
    const { clubId } = req.params;
    const updates = req.body;

    const club = await clubService.updateClubEditableFields(
      clubId,
      updates,
      req.user.id,
      req
    );

    res.json({
      success: true,
      message: SuccessMessages.CLUB_UPDATED,
      data: club,
    });
  } catch (error) {
    console.error('Error in updateClub:', error);
    const status = 
      error.message === ErrorMessages.CLUB_NOT_FOUND ? 404 :
      error.message === ErrorMessages.IMMUTABLE_FIELD_UPDATE ? 403 :
      500;
    
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Get club statistics
 * GET /api/dsw/statistics
 */
async function getStatistics(req, res) {
  try {
    const stats = await clubService.getClubStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error in getStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
}

/**
 * Create a new club (via noting workflow)
 * Faculty fills club creation form → Noting created → Goes to DSW for approval → Club created on approval
 * POST /api/dsw/clubs
 */
async function createClub(req, res) {
  try {
    // Validate user is faculty
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Only faculty members can create clubs',
      });
    }

    const clubData = req.body;

    // Create noting with club data (similar to event creation)
    const noting = await notingIntegrationService.createClubCreationNoting(
      clubData,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Club creation noting submitted successfully. Awaiting approval from DSW.',
      data: {
        noting: {
          id: noting.id,
          notingId: noting.notingId,
          status: noting.status,
          clubName: noting.clubName,
          createdAt: noting.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Error in createClub:', error);
    const status = 
      error.message.includes('duplicate') || error.message.includes('already exists') ? 409 :
      error.message.includes('Invalid') || error.message.includes('required') ? 400 :
      500;
    
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  createClub,
  getClubs,
  getClubById,
  getMyClubs,
  addMember,
  removeMember,
  getClubMembers,
  updateClub,
  getStatistics,
};
