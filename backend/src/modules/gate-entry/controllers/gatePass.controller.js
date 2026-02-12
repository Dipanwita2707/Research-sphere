const gatePassService = require('../services/gatePass.service');

// Simple logger
const logger = {
  info: (msg, data) => console.log('[INFO]', msg, data || ''),
  error: (msg, error) => console.error('[ERROR]', msg, error)
};

// Response formatter helper
const formatResponse = (success, message, data = null, error = null) => {
  const response = { success, message };
  if (data) response.data = data;
  if (error) response.error = error;
  return response;
};

class GatePassController {
  /**
   * Create a new gate pass
   * POST /api/v1/gate-entry/create-pass
   */
  async createPass(req, res) {
    try {
      const userId = req.user.id;
      const passData = req.body;

      // Debug log - full request body
      console.log('=== CREATE PASS REQUEST ===');
      console.log('User ID:', userId);
      console.log('Request Body:', JSON.stringify(passData, null, 2));

      // Map frontend field names to backend schema (simplified form)
      const mappedData = {
        // Required fields
        visitor_name: passData.fullName,
        mobile_number: passData.mobileNumber,
        purpose_of_visit: passData.purposeOfVisit,
        visit_date: passData.visitDate,
        expected_entry_time: passData.expectedEntryTime,
        expected_exit_time: passData.expectedExitTime,
        
        // Optional fields - only include if provided
        visitor_relation: passData.visitorRelation,
        purpose_other: passData.purposeOther,
        
        // Vehicle details (optional)
        has_vehicle: passData.bringingVehicle || false,
        vehicle_type: passData.vehicleType,
        vehicle_number: passData.vehicleNumber,
        vehicle_model: passData.vehicleModel,
        
        // Stay details (optional for multi-day visits)
        stay_required: passData.stayRequired || false,
        check_in_date: passData.checkInDate,
        check_out_date: passData.checkOutDate,
        hostel_name: passData.hostelName,
        room_number: passData.roomNumber,
        
        // Legacy fields (for backward compatibility - optional)
        email: passData.email,
        id_proof_type: passData.idProofType,
        id_proof_number: passData.idProofNumber,
        photo: passData.photo,
        gender: passData.gender,
        age: passData.age,
        department_to_visit: passData.departmentToVisit,
        person_to_meet_id: passData.personToMeetId,
        number_of_persons: passData.numberOfPersons || 1,
        items_carrying: passData.itemsCarrying,
        special_instructions: passData.specialInstructions
      };

      console.log('Mapped Data:', JSON.stringify(mappedData, null, 2));

      const gatePass = await gatePassService.createPass(mappedData, userId);

      return res.status(201).json(
        formatResponse(true, 'Gate pass created successfully', {
          pass: gatePass
        })
      );
    } catch (error) {
      logger.error('Create pass error:', error);
      console.error('Full Error Stack:', error.stack);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to create gate pass', null, error.message)
      );
    }
  }

  /**
   * Get all gate passes with filters  
   * GET /api/v1/gate-entry/passes
   * Admin and Guards see all passes, others see only their own
   */
  async getAllPasses(req, res) {
    try {
      const userId = req.user.id;
      
      const filters = {
        search: req.query.search,
        status: req.query.status,
        dateFilter: req.query.dateFilter,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        userId: userId  // Pass user ID for role-based filtering
      };

      const result = await gatePassService.getAllPasses(filters);

      return res.status(200).json(
        formatResponse(true, 'Gate passes fetched successfully', result)
      );
    } catch (error) {
      logger.error('Get passes error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch gate passes', null, error.message)
      );
    }
  }

  /**
   * Get pass statistics
   * GET /api/v1/gate-entry/stats
   * Admin and Guards see all stats, others see only their own
   */
  async getStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await gatePassService.getPassStats(userId);

      return res.status(200).json(
        formatResponse(true, 'Statistics fetched successfully', stats)
      );
    } catch (error) {
      logger.error('Get stats error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch statistics', null, error.message)
      );
    }
  }

  /**
   * Verify/Search pass (for guards)
   * POST /api/v1/gate-entry/verify
   */
  async verifyPass(req, res) {
    try {
      const { searchTerm, searchType } = req.body;

      if (!searchTerm || !searchType) {
        return res.status(400).json(
          formatResponse(false, 'Search term and type are required')
        );
      }

      const pass = await gatePassService.verifyPass(searchTerm, searchType);

      if (!pass) {
        return res.status(404).json(
          formatResponse(false, 'No pass found matching your search')
        );
      }

      return res.status(200).json(
        formatResponse(true, 'Pass found successfully', { pass })
      );
    } catch (error) {
      logger.error('Verify pass error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to verify pass', null, error.message)
      );
    }
  }

  /**
   * Allow entry (guard action)
   * POST /api/v1/gate-entry/allow-entry/:pass_id
   */
  async allowEntry(req, res) {
    try {
      const { passId } = req.params;
      const guardId = req.user.id;
      const entryData = {
        gate: req.body.gate,
        remarks: req.body.remarks,
        verification_code: req.body.verificationCode // Optional verification code
      };

      const pass = await gatePassService.allowEntry(passId, guardId, entryData);

      return res.status(200).json(
        formatResponse(true, 'Entry allowed successfully', { pass })
      );
    } catch (error) {
      logger.error('Allow entry error:', error);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to allow entry', null, error.message)
      );
    }
  }

  /**
   * Deny entry (guard action)
   * POST /api/v1/gate-entry/deny-entry/:pass_id
   */
  async denyEntry(req, res) {
    try {
      const { passId } = req.params;
      const guardId = req.user.id;
      const { denialReason } = req.body;

      if (!denialReason) {
        return res.status(400).json(
          formatResponse(false, 'Denial reason is required')
        );
      }

      const pass = await gatePassService.denyEntry(passId, guardId, denialReason);

      return res.status(200).json(
        formatResponse(true, 'Entry denied successfully', { pass })
      );
    } catch (error) {
      logger.error('Deny entry error:', error);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to deny entry', null, error.message)
      );
    }
  }

  /**
   * Record exit (guard action)
   * POST /api/v1/gate-entry/record-exit/:pass_id
   */
  async recordExit(req, res) {
    try {
      const { passId } = req.params;
      const guardId = req.user.id;
      const exitData = {
        gate: req.body.gate,
        remarks: req.body.remarks
      };

      const pass = await gatePassService.recordExit(passId, guardId, exitData);

      return res.status(200).json(
        formatResponse(true, 'Exit recorded successfully', { pass })
      );
    } catch (error) {
      logger.error('Record exit error:', error);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to record exit', null, error.message)
      );
    }
  }

  /**
   * Cancel pass
   * POST /api/v1/gate-entry/cancel/:pass_id
   */
  async cancelPass(req, res) {
    try {
      const { passId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      const pass = await gatePassService.cancelPass(passId, userId, reason);

      return res.status(200).json(
        formatResponse(true, 'Pass cancelled successfully', { pass })
      );
    } catch (error) {
      logger.error('Cancel pass error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to cancel pass', null, error.message)
      );
    }
  }

  /**
   * Get check-in history (for guards)
   * GET /api/v1/gate-entry/check-in-history
   */
  async getCheckInHistory(req, res) {
    try {
      const filters = {
        date: req.query.date, // Optional: filter by specific date
        status: req.query.status, // Optional: checked_in, completed
        guardId: req.query.guardId // Optional: filter by specific guard
      };

      const history = await gatePassService.getCheckInHistory(filters);

      return res.status(200).json(
        formatResponse(true, 'Check-in history fetched successfully', history)
      );
    } catch (error) {
      logger.error('Get check-in history error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch check-in history', null, error.message)
      );
    }
  }

  /**
   * Export check-in history to Excel
   * GET /api/v1/gate-entry/export-excel
   */
  async exportToExcel(req, res) {
    try {
      const filters = {
        date: req.query.date,
        status: req.query.status,
        guardId: req.query.guardId
      };

      const excelBuffer = await gatePassService.exportToExcel(filters);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=gate-entry-history-${new Date().toISOString().split('T')[0]}.xlsx`);

      return res.send(excelBuffer);
    } catch (error) {
      logger.error('Export to Excel error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to export to Excel', null, error.message)
      );
    }
  }
}

module.exports = new GatePassController();
