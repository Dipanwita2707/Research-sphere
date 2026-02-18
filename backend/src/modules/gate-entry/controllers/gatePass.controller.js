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
        visit_end_date: passData.visitEndDate || passData.checkOutDate || null,
        entry_time: passData.entryTime || passData.expectedEntryTime,
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

      logger.info(`[VERIFY PASS] Type: ${searchType}, Term: ${searchType === 'checkout_qr' ? 'QR Data' : searchTerm}`);

      const pass = await gatePassService.verifyPass(searchTerm, searchType);

      if (!pass) {
        return res.status(404).json(
          formatResponse(false, 'No pass found matching your search')
        );
      }

      // Transform pass for frontend
      const transformedPass = gatePassService.transformPassToFrontend(pass);

      // Add checkout QR info if available
      if (pass.pass_status === 'cancelled' && pass.checkout_qr_expires_at) {
        const now = new Date();
        const remainingMinutes = Math.floor((pass.checkout_qr_expires_at.getTime() - now.getTime()) / (1000 * 60));
        
        return res.status(200).json(
          formatResponse(true, `⚠️ CANCELLED PASS - Checkout QR valid for ${remainingMinutes} more minute(s)`, { 
            pass: transformedPass,
            isCancelled: true,
            checkoutQRRemaining: remainingMinutes
          })
        );
      }

      return res.status(200).json(
        formatResponse(true, 'Pass found successfully', { pass: transformedPass })
      );
    } catch (error) {
      logger.error('[VERIFY PASS] Error:', error);
      
      let userMessage = error.message || 'Failed to verify pass';
      let statusCode = 500;
      
      if (error.message.includes('expired') || error.message.includes('Invalid')) {
        statusCode = 400;
      }
      
      return res.status(statusCode).json(
        formatResponse(false, userMessage)
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

      logger.info(`[CANCEL PASS REQUEST] PassID: ${passId}, UserID: ${userId}, Reason: ${reason}`);

      const pass = await gatePassService.cancelPass(passId, userId, reason);
      
      // Transform pass data for frontend
      const transformedPass = gatePassService.transformPassToFrontend(pass);

      return res.status(200).json(
        formatResponse(true, 'Pass cancelled successfully. Checkout QR code sent to visitor (valid for 1 hour).', { pass: transformedPass })
      );
    } catch (error) {
      logger.error('[CANCEL PASS] Error:', error);
      
      // Handle specific error messages
      let userMessage = 'Failed to cancel pass';
      let statusCode = 500;
      
      if (error.message.includes('not found')) {
        userMessage = error.message;
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        userMessage = error.message;
        statusCode = 403;
      } else if (error.message.includes('only be cancelled after check-in')) {
        userMessage = error.message;
        statusCode = 400;
      }
      
      return res.status(statusCode).json(
        formatResponse(false, userMessage)
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

  /**
   * Extend pass (modify end date only)
   * POST /api/v1/gate-entry/extend-pass/:passId
   */
  async extendPass(req, res) {
    try {
      const { passId } = req.params;
      const { newEndDate, extensionReason } = req.body;

      logger.info(`[EXTEND PASS] Request received for passId: ${passId}, newEndDate: ${newEndDate}, reason: ${extensionReason}`);

      if (!newEndDate || !extensionReason) {
        return res.status(400).json(
          formatResponse(false, 'New end date and extension reason are required')
        );
      }

      const pass = await gatePassService.extendPass(passId, newEndDate, extensionReason);
      
      logger.info(`[EXTEND PASS] Pass extended successfully: ${passId}`);
      
      // Transform pass data to camelCase for frontend
      const transformedPass = gatePassService.transformPassToFrontend(pass);

      return res.status(200).json(
        formatResponse(true, 'Pass end date extended successfully. QR code expiration updated.', { pass: transformedPass })
      );
    } catch (error) {
      logger.error('Extend pass error:', error);
      
      // Handle common user-facing errors with friendly messages
      let userMessage = 'Failed to extend pass';
      
      if (error.message.includes('Pass not found')) {
        userMessage = 'Pass not found. Please check the Pass ID and try again.';
      } else if (error.message.includes('Cannot extend')) {
        userMessage = error.message; // Already user-friendly
      } else if (error.message.includes('New end date must be after')) {
        userMessage = error.message; // Already user-friendly
      } else if (error.message.includes('Invalid')) {
        userMessage = 'Invalid date format. Please select a valid date.';
      } else if (error.name === 'PrismaClientValidationError') {
        userMessage = 'Database validation error. Please contact support.';
      } else if (error.message) {
        userMessage = error.message;
      }
      
      return res.status(400).json(
        formatResponse(false, userMessage)
      );
    }
  }

  /**
   * Record checkout using checkout QR code
   * POST /api/v1/gate-entry/checkout/:passId
   */
  async recordCheckout(req, res) {
    try {
      const { passId } = req.params;
      const guardId = req.user.id;
      const exitData = {
        gate: req.body.gate,
        remarks: req.body.remarks,
        verificationCode: req.body.verificationCode
      };

      const pass = await gatePassService.recordCheckout(passId, guardId, exitData);

      return res.status(200).json(
        formatResponse(true, 'Checkout recorded successfully', { pass })
      );
    } catch (error) {
      logger.error('Record checkout error:', error);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to record checkout', null, error.message)
      );
    }
  }

  /**
   * Get available hostels
   * GET /api/v1/gate-entry/hostels/available?checkIn=2026-02-20&checkOut=2026-02-22
   */
  async getAvailableHostels(req, res) {
    try {
      const hostelBookingService = require('../services/hostelBooking.service');
      const { checkIn, checkOut } = req.query;

      if (!checkIn || !checkOut) {
        return res.status(400).json(
          formatResponse(false, 'Check-in and check-out dates are required')
        );
      }

      const hostels = await hostelBookingService.getAvailableHostels(
        new Date(checkIn),
        new Date(checkOut)
      );

      return res.status(200).json(
        formatResponse(true, 'Available hostels fetched successfully', { hostels })
      );
    } catch (error) {
      logger.error('Get available hostels error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch available hostels', null, error.message)
      );
    }
  }

  /**
   * Get available rooms for a hostel
   * GET /api/v1/gate-entry/hostels/:hostelId/rooms?checkIn=2026-02-20&checkOut=2026-02-22
   */
  async getHostelRooms(req, res) {
    try {
      const hostelBookingService = require('../services/hostelBooking.service');
      const { hostelId } = req.params;
      const { checkIn, checkOut } = req.query;

      if (!checkIn || !checkOut) {
        return res.status(400).json(
          formatResponse(false, 'Check-in and check-out dates are required')
        );
      }

      const rooms = await hostelBookingService.getRoomsByHostel(
        hostelId,
        new Date(checkIn),
        new Date(checkOut)
      );

      return res.status(200).json(
        formatResponse(true, 'Available rooms fetched successfully', { rooms })
      );
    } catch (error) {
      logger.error('Get hostel rooms error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch rooms', null, error.message)
      );
    }
  }

  /**
   * Create hostel booking
   * POST /api/v1/gate-entry/bookings/create
   */
  async createBooking(req, res) {
    try {
      const hostelBookingService = require('../services/hostelBooking.service');
      const userId = req.user.id;
      const bookingData = {
        passId: req.body.passId,
        hostelId: req.body.hostelId,
        roomId: req.body.roomId,
        checkInDate: new Date(req.body.checkInDate),
        checkOutDate: new Date(req.body.checkOutDate),
        guestCount: req.body.guestCount,
        createdById: userId
      };

      const booking = await hostelBookingService.createBooking(bookingData);

      return res.status(201).json(
        formatResponse(true, 'Hostel booking created successfully. Please complete payment.', { booking })
      );
    } catch (error) {
      logger.error('Create booking error:', error);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to create booking', null, error.message)
      );
    }
  }

  /**
   * Confirm payment for hostel booking
   * POST /api/v1/gate-entry/bookings/:bookingId/confirm-payment
   */
  async confirmPayment(req, res) {
    try {
      const hostelBookingService = require('../services/hostelBooking.service');
      const { bookingId } = req.params;
      const { paymentReference } = req.body;
      const verifiedByUserId = req.user.id;

      if (!paymentReference) {
        return res.status(400).json(
          formatResponse(false, 'Payment reference is required')
        );
      }

      const booking = await hostelBookingService.confirmPayment(
        bookingId,
        paymentReference,
        verifiedByUserId
      );

      return res.status(200).json(
        formatResponse(true, 'Payment confirmed successfully', { booking })
      );
    } catch (error) {
      logger.error('Confirm payment error:', error);
      return res.status(500).json(
        formatResponse(false, error.message || 'Failed to confirm payment', null, error.message)
      );
    }
  }

  /**
   * Get booking details for a pass
   * GET /api/v1/gate-entry/bookings/:passId
   */
  async getBookingByPass(req, res) {
    try {
      const hostelBookingService = require('../services/hostelBooking.service');
      const { passId } = req.params;

      const booking = await hostelBookingService.getBookingByPass(passId);

      if (!booking) {
        return res.status(404).json(
          formatResponse(false, 'No booking found for this pass')
        );
      }

      return res.status(200).json(
        formatResponse(true, 'Booking fetched successfully', { booking })
      );
    } catch (error) {
      logger.error('Get booking error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch booking', null, error.message)
      );
    }
  }
}

module.exports = new GatePassController();
