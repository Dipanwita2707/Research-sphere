const gatePassService = require('../services/gatePass.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const emailService = require('../../../shared/utils/emailService');

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

      // Send email notification (fire-and-forget)
      emailService.sendPassCreated(gatePass).catch(e => console.error('[EMAIL] createPass failed:', e.message));

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

      // Handle cancelled passes
      if (pass.pass_status === 'cancelled') {
        // Determine cancellation type - use field or infer from actual_entry_time
        const cancellationType = pass.cancellation_type || 
          (pass.actual_entry_time ? 'after_check_in' : 'before_check_in');
        
        // After check-in cancellation - has checkout QR with expiry
        if (cancellationType === 'after_check_in' && pass.checkout_qr_expires_at) {
          const now = new Date();
          const remainingMinutes = Math.floor((pass.checkout_qr_expires_at.getTime() - now.getTime()) / (1000 * 60));
          
          return res.status(200).json(
            formatResponse(true, `⚠️ CANCELLED PASS (After Check-In) - Checkout required within ${remainingMinutes} minute(s)`, { 
              pass: { ...transformedPass, cancellationType },
              isCancelled: true,
              checkoutQRRemaining: remainingMinutes
            })
          );
        }
        
        // Before check-in cancellation - no checkout required
        return res.status(200).json(
          formatResponse(true, `❌ PASS CANCELLED - Visitor cancelled before check-in`, { 
            pass: { ...transformedPass, cancellationType: 'before_check_in' },
            isCancelled: true,
            checkoutQRRemaining: 0
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

      // Send email notification (fire-and-forget)
      emailService.sendEntryAllowed(pass).catch(e => console.error('[EMAIL] allowEntry failed:', e.message));

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

      // Send email notification (fire-and-forget)
      emailService.sendEntryDenied(pass, denialReason).catch(e => console.error('[EMAIL] denyEntry failed:', e.message));

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

      // Send email notification (fire-and-forget)
      emailService.sendExitRecorded(pass).catch(e => console.error('[EMAIL] recordExit failed:', e.message));

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

      // Send email notification based on cancellation type (fire-and-forget)
      if (pass.cancellation_type === 'after_check_in') {
        emailService.sendPassCancelledAfterEntry(pass, reason).catch(e => console.error('[EMAIL] cancelPass(after) failed:', e.message));
      } else {
        emailService.sendPassCancelledBeforeEntry(pass, reason).catch(e => console.error('[EMAIL] cancelPass(before) failed:', e.message));
      }

      // Different messages based on cancellation type
      let successMessage = 'Pass cancelled successfully.';
      if (pass.cancellation_type === 'after_check_in') {
        successMessage = 'Pass cancelled successfully. Emergency checkout QR code sent to visitor (valid for 1 hour).';
      } else if (pass.cancellation_type === 'before_check_in') {
        successMessage = 'Pass cancelled successfully. Visitor has been notified via WhatsApp and email.';
      }

      return res.status(200).json(
        formatResponse(true, successMessage, { 
          pass: transformedPass,
          cancellationType: pass.cancellation_type,
          hasCheckoutQR: !!pass.checkout_qr
        })
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
      
      // Send email notification (fire-and-forget)
      emailService.sendPassExtended(pass, newEndDate, extensionReason).catch(e => console.error('[EMAIL] extendPass failed:', e.message));

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

      // Send email notification (fire-and-forget)
      emailService.sendExitRecorded(pass).catch(e => console.error('[EMAIL] recordCheckout failed:', e.message));

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

      // Note: Email will be sent only after payment confirmation (confirmPayment endpoint)
      // No email sent here as booking is still pending payment

      return res.status(201).json(
        formatResponse(true, 'Hostel booking created successfully. Please complete payment.', { booking })
      );
    } catch (error) {
      logger.error('Create booking error:', error);
      
      // Handle specific error types with user-friendly messages
      let errorMessage = 'Failed to create booking';
      let statusCode = 500;

      if (error.message.includes('already has a hostel booking')) {
        errorMessage = 'This pass already has a room booking';
        statusCode = 400;
      } else if (error.message.includes('not available')) {
        errorMessage = 'Selected room is not available for these dates';
        statusCode = 400;
      } else if (error.message.includes('not found')) {
        errorMessage = 'Invalid pass or room selection';
        statusCode = 404;
      } else if (error.message.includes('PrismaClientValidation')) {
        errorMessage = 'Invalid booking data. Please check your input and try again.';
        statusCode = 400;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return res.status(statusCode).json(
        formatResponse(false, errorMessage, null)
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

      // Send hostel booking confirmation email (fire-and-forget)
      const guestEmail = booking.gate_pass?.email;
      console.log('[EMAIL] confirmPayment → gate_pass.email =', guestEmail || 'NULL/MISSING');
      if (guestEmail) {
        emailService.sendHostelBookingConfirmed(booking)
          .then(() => console.log('[EMAIL] confirmPayment hostel email sent to', guestEmail))
          .catch(e => console.error('[EMAIL] confirmPayment hostel email FAILED:', e.message));
      } else {
        console.warn('[EMAIL] Skipping hostel email — no email on gate pass');
      }

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

  /**
   * Get advanced analytics for Gate Entry module
   * GET /api/v1/gate-entry/analytics
   */
  async getAdvancedAnalytics(req, res) {
    try {
      const { dateFrom, dateTo, purpose, status, vehicleType } = req.query;

      logger.info('[ANALYTICS] Fetching analytics with filters:', { dateFrom, dateTo, purpose, status, vehicleType });

      const filters = {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        purpose: purpose || 'all',
        status: status || 'all',
        vehicleType: vehicleType || 'all'
      };

      const analytics = await gatePassService.getAdvancedAnalytics(filters);

      return res.status(200).json(
        formatResponse(true, 'Analytics fetched successfully', analytics)
      );
    } catch (error) {
      logger.error('[ANALYTICS] Error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch analytics', null, error.message)
      );
    }
  }

  /**
   * Get system configuration by key
   */
  async getSystemConfig(req, res) {
    try {
      const { key } = req.params;

      const config = await gatePassService.getSystemConfig(key);

      if (!config) {
        return res.status(404).json(
          formatResponse(false, `Configuration '${key}' not found`, null)
        );
      }

      return res.status(200).json(
        formatResponse(true, 'Configuration retrieved successfully', config)
      );
    } catch (error) {
      logger.error('[GET SYSTEM CONFIG] Error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch configuration', null, error.message)
      );
    }
  }

  /**
   * Update system configuration (admin only)
   */
  async updateSystemConfig(req, res) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const userId = req.user.id;

      if (!value) {
        return res.status(400).json(
          formatResponse(false, 'Configuration value is required', null)
        );
      }

      const config = await gatePassService.updateSystemConfig(key, value, userId);

      return res.status(200).json(
        formatResponse(true, 'Configuration updated successfully', config)
      );
    } catch (error) {
      logger.error('[UPDATE SYSTEM CONFIG] Error:', error);
      const statusCode = error.message.includes('Only administrators') ? 403 : 500;
      return res.status(statusCode).json(
        formatResponse(false, error.message || 'Failed to update configuration', null)
      );
    }
  }

  /**
   * Get all system configurations (admin only)
   */
  async getAllSystemConfigs(req, res) {
    try {
      const userId = req.user.id;
      const configs = await gatePassService.getAllSystemConfigs(userId);

      return res.status(200).json(
        formatResponse(true, 'Configurations retrieved successfully', configs)
      );
    } catch (error) {
      logger.error('[GET ALL SYSTEM CONFIGS] Error:', error);
      const statusCode = error.message.includes('Only administrators') ? 403 : 500;
      return res.status(statusCode).json(
        formatResponse(false, error.message || 'Failed to fetch configurations', null)
      );
    }
  }

  /**
   * Get all refund transactions (admin only)
   */
  async getAllRefunds(req, res) {
    try {
      const userId = req.user.id;

      // Check if user is admin
      const user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role?.toLowerCase() !== 'admin') {
        return res.status(403).json(
          formatResponse(false, 'Only administrators can view all refunds', null)
        );
      }

      const refunds = await prisma.refundTransaction.findMany({
        include: {
          booking: {
            include: {
              room: {
                include: {
                  hostel: true
                }
              }
            }
          },
          gate_pass: {
            select: {
              pass_id: true,
              visitor_name: true,
              mobile_number: true
            }
          },
          processed_by: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      const formattedRefunds = refunds.map(r => ({
        id: r.id,
        booking_id: r.booking_id,
        pass_id: r.gate_pass.pass_id,
        visitor_name: r.gate_pass.visitor_name,
        mobile_number: r.gate_pass.mobile_number,
        hostel_name: r.booking.room.hostel.name,
        room_number: r.booking.room.room_number,
        original_amount: r.original_amount,
        cancellation_fee_percent: r.cancellation_fee_percent,
        cancellation_fee_amount: r.cancellation_fee_amount,
        refund_amount: r.refund_amount,
        refund_status: r.refund_status,
        processed_by: r.processed_by?.employeeDetails?.displayName || r.processed_by?.uid || 'System',
        processed_at: r.processed_at,
        remarks: r.remarks,
        created_at: r.created_at
      }));

      return res.status(200).json(
        formatResponse(true, 'Refunds retrieved successfully', formattedRefunds)
      );
    } catch (error) {
      logger.error('[GET ALL REFUNDS] Error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch refunds', null, error.message)
      );
    }
  }

  /**
   * Get refund transaction for specific booking
   */
  async getRefundByBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;

      const refund = await prisma.refundTransaction.findFirst({
        where: { booking_id: bookingId },
        include: {
          booking: {
            include: {
              room: {
                include: {
                  hostel: true
                }
              },
              created_by: {
                select: {
                  id: true,
                  uid: true
                }
              }
            }
          },
          gate_pass: {
            select: {
              pass_id: true,
              visitor_name: true,
              mobile_number: true,
              created_by_id: true
            }
          },
          processed_by: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          }
        }
      });

      if (!refund) {
        return res.status(404).json(
          formatResponse(false, 'Refund transaction not found', null)
        );
      }

      // Check permission: only creator or admin can view
      const user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      const isAdmin = user?.role?.toLowerCase() === 'admin';
      const isCreator = refund.gate_pass.created_by_id === userId;

      if (!isAdmin && !isCreator) {
        return res.status(403).json(
          formatResponse(false, 'You do not have permission to view this refund', null)
        );
      }

      const formattedRefund = {
        id: refund.id,
        booking_id: refund.booking_id,
        pass_id: refund.gate_pass.pass_id,
        visitor_name: refund.gate_pass.visitor_name,
        mobile_number: refund.gate_pass.mobile_number,
        hostel_name: refund.booking.room.hostel.name,
        room_number: refund.booking.room.room_number,
        original_amount: refund.original_amount,
        cancellation_fee_percent: refund.cancellation_fee_percent,
        cancellation_fee_amount: refund.cancellation_fee_amount,
        refund_amount: refund.refund_amount,
        refund_status: refund.refund_status,
        processed_by: refund.processed_by?.employeeDetails?.displayName || refund.processed_by?.uid || 'System',
        processed_at: refund.processed_at,
        remarks: refund.remarks,
        created_at: refund.created_at
      };

      return res.status(200).json(
        formatResponse(true, 'Refund retrieved successfully', formattedRefund)
      );
    } catch (error) {
      logger.error('[GET REFUND BY BOOKING] Error:', error);
      return res.status(500).json(
        formatResponse(false, 'Failed to fetch refund', null, error.message)
      );
    }
  }
}

module.exports = new GatePassController();
