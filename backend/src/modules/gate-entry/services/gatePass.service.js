const prisma = require('../../../shared/config/database');
const QRCode = require('qrcode');
const XLSX = require('xlsx');
const cache = require('../../../shared/config/redis');
const { hasViewAllPermission } = require('../../../shared/middleware/gateEntryAuth');

// Simple logger
const logger = {
  info: (msg, data) => console.log('[INFO]', msg, data || ''),
  error: (msg, error) => console.error('[ERROR]', msg, error)
};

const getISTCalendarDateUtcMidnight = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
};

// Match hostel booking availability cutoff behavior used in booking creation flow.
const getBookingCutoffDate = () => {
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()));
};

class GatePassService {
  /**
   * Transform snake_case fields to camelCase for frontend
   */
  transformPassToFrontend(pass) {
    if (!pass) return null;

    const latestHostelBooking = pass.hostel_booking || (Array.isArray(pass.hostel_bookings) ? pass.hostel_bookings[0] : null);

    console.log(`[TRANSFORM INPUT] Pass ${pass.pass_id}: extension_count=${pass.extension_count}, extension_reason="${pass.extension_reason}"`);

    // For multiday passes with hostel booking, use check_out_datetime as visitEndDate
    let visitEndDate = pass.visit_end_date;
    if (latestHostelBooking?.check_out_datetime) {
      visitEndDate = latestHostelBooking.check_out_datetime;
      console.log(`[TRANSFORM] Pass ${pass.pass_id}: Using hostel check_out_datetime ${visitEndDate} instead of visit_end_date ${pass.visit_end_date}`);
    }

    // Format dates to ISO string for consistent frontend handling
    const formatDateForFrontend = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.toISOString();
      }
      return date;
    };

    const normalizeBooking = (booking) => ({
      ...booking,
      check_in_datetime: formatDateForFrontend(booking.check_in_datetime),
      check_out_datetime: formatDateForFrontend(booking.check_out_datetime),
      totalPrice: booking.total_price,
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      hostelName: booking.room?.hostel?.name,
      roomNumber: booking.room?.room_number,
      requestedCheckinTime: booking.requested_checkin_time ? formatDateForFrontend(booking.requested_checkin_time) : null,
      checkinRequestStatus: booking.checkin_request_status || null,
      checkinRequestRejectReason: booking.checkin_request_reject_reason || null,
      roomCancelRequestStatus: booking.room_cancel_request_status || null,
      roomCancelRequestReason: booking.room_cancel_request_reason || null,
      roomCancelRequestRejectReason: booking.room_cancel_request_reject_reason || null,
      roomCancelRequestedAt: booking.room_cancel_request_requested_at ? formatDateForFrontend(booking.room_cancel_request_requested_at) : null,
      roomCancelReviewedAt: booking.room_cancel_request_reviewed_at ? formatDateForFrontend(booking.room_cancel_request_reviewed_at) : null
    });

    const transformed = {
      ...pass,
      passId: pass.pass_id,
      passStatus: pass.pass_status,
      visitorName: pass.visitor_name,
      mobileNumber: pass.mobile_number,
      visitorRelation: pass.visitor_relation,
      purposeOfVisit: pass.purpose_of_visit,
      purposeOther: pass.purpose_other,
      visitDate: formatDateForFrontend(pass.visit_date),
      visitEndDate: formatDateForFrontend(visitEndDate), // Use hostel check_out_datetime if available
      expectedEntryTime: pass.expected_entry_time,
      expectedExitTime: pass.expected_exit_time,
      entryTime: pass.entry_time,
      actualEntryTime: formatDateForFrontend(pass.actual_entry_time),
      actualExitTime: formatDateForFrontend(pass.actual_exit_time),
      qrStatus: pass.qr_status,
      qrActivationTime: formatDateForFrontend(pass.qr_activation_time),
      verificationCode: pass.verification_code,
      checkoutUniqueId: pass.checkout_unique_id,
      checkoutVerificationCode: pass.checkout_verification_code,
      checkoutQrCode: pass.checkout_qr_code,
      checkoutQrExpiresAt: formatDateForFrontend(pass.checkout_qr_expires_at),
      extensionCount: pass.extension_count,
      extensionReason: pass.extension_reason,
      hasVehicle: pass.has_vehicle,
      vehicleNumber: pass.vehicle_number,
      vehicleType: pass.vehicle_type,
      vehicleModel: pass.vehicle_model,
      stayRequired: pass.stay_required,
      checkInDate: formatDateForFrontend(pass.check_in_date || latestHostelBooking?.check_in_datetime),
      checkOutDate: formatDateForFrontend(pass.check_out_date || latestHostelBooking?.check_out_datetime),
      hostelName: latestHostelBooking?.room?.hostel?.name,
      roomNumber: latestHostelBooking?.room?.room_number,
      createdAt: formatDateForFrontend(pass.created_at),
      updatedAt: formatDateForFrontend(pass.updated_at),
      createdBy: pass.user_login_gate_pass_created_by_idTouser_login,
      // Cancellation related fields
      cancellationType: pass.cancellation_type,
      hostelRefund: pass.hostel_refund,
      checkoutQr: pass.checkout_qr,
      hostelBooking: latestHostelBooking ? normalizeBooking(latestHostelBooking) : null,
      hostelBookings: Array.isArray(pass.hostel_bookings)
        ? pass.hostel_bookings.map(normalizeBooking)
        : (latestHostelBooking ? [normalizeBooking(latestHostelBooking)] : []),
      // Multi-day daily check-in/check-out data
      // All passes support unlimited in/out cycling
      isMultiDayDaily: true,
      dailyEntries: (pass.daily_entries || []).map(e => ({
        id: e.id,
        dayNumber: e.day_number,
        entryDate: formatDateForFrontend(e.entry_date),
        entryTime: formatDateForFrontend(e.entry_time),
        exitTime: formatDateForFrontend(e.exit_time),
        entryGate: e.entry_gate,
        exitGate: e.exit_gate
      }))
    };

    console.log(`[TRANSFORM DEBUG] Pass ${pass.pass_id}: visitEndDate = ${transformed.visitEndDate}, checkOutDate = ${transformed.checkOutDate}, extensionCount = ${transformed.extensionCount}, extensionReason = "${transformed.extensionReason}"`);

    // Clean up - remove snake_case duplicates (keep original for nested queries)
    return transformed;
  }

  /**
   * Generate unique Pass ID
   */
  async generatePassId() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Get count of passes created today
    const count = await prisma.gate_pass.count({
      where: {
        pass_id: {
          startsWith: `UNI-PASS-${today}`
        }
      }
    });

    const sequenceNumber = (count + 1).toString().padStart(3, '0');
    return `UNI-PASS-${today}-${sequenceNumber}`;
  }

  /**
   * Generate 6-digit verification code
   */
  generateVerificationCode() {
    // Generate 6 random digits
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Check for duplicate passes for same visitor
   * @param {string} mobileNumber - Visitor's mobile number
   * @param {string} visitorName - Visitor's name
   * @param {Date} visitDate - Start date of visit
   * @param {Date} visitEndDate - End date of visit (null for single-day)
   * @returns {Object} { isDuplicate: boolean, conflictingPasses: [] }
   */
  async checkDuplicatePass(mobileNumber, visitorName, visitDate, visitEndDate = null) {
    try {
      // Normalize visitor name for case-insensitive comparison
      const normalizedName = visitorName.trim();

      // Parse dates for comparison
      const startDate = new Date(visitDate);
      const endDate = visitEndDate ? new Date(visitEndDate) : startDate;

      console.log('[DUPLICATE CHECK] Checking for:', {
        mobile: mobileNumber,
        name: normalizedName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Find conflicting passes
      // Exclude: cancelled, expired, checked_out statuses
      const conflictingPasses = await prisma.gate_pass.findMany({
        where: {
          mobile_number: mobileNumber,
          visitor_name: {
            equals: normalizedName,
            mode: 'insensitive' // Case-insensitive match
          },
          pass_status: {
            notIn: ['cancelled', 'expired', 'checked_out', 'completed']
          },
          // Date overlap check:
          // Conflicts if: (existing_start <= new_end) AND (existing_end >= new_start)
          AND: [
            {
              visit_date: {
                lte: endDate
              }
            },
            {
              OR: [
                // Single-day pass (no visit_end_date)
                {
                  AND: [
                    { visit_end_date: null },
                    { visit_date: { gte: startDate } }
                  ]
                },
                // Multi-day pass with visit_end_date
                {
                  visit_end_date: {
                    gte: startDate
                  }
                }
              ]
            }
          ]
        },
        select: {
          pass_id: true,
          visitor_name: true,
          mobile_number: true,
          visit_date: true,
          visit_end_date: true,
          entry_time: true,
          pass_status: true,
          qr_status: true,
          created_at: true
        },
        orderBy: {
          visit_date: 'asc'
        }
      });

      if (conflictingPasses.length > 0) {
        console.log('[DUPLICATE FOUND]', {
          count: conflictingPasses.length,
          passes: conflictingPasses.map(p => ({
            pass_id: p.pass_id,
            visit_date: p.visit_date,
            visit_end_date: p.visit_end_date,
            status: p.pass_status
          }))
        });

        return {
          isDuplicate: true,
          conflictingPasses: conflictingPasses.map(pass => ({
            passId: pass.pass_id,
            visitorName: pass.visitor_name,
            visitDate: pass.visit_date,
            visitEndDate: pass.visit_end_date,
            entryTime: pass.entry_time,
            status: pass.pass_status,
            qrStatus: pass.qr_status,
            createdAt: pass.created_at
          }))
        };
      }

      console.log('[DUPLICATE CHECK] No conflicts found');
      return {
        isDuplicate: false,
        conflictingPasses: []
      };
    } catch (error) {
      logger.error('Error checking duplicate pass:', error);
      throw new Error('Failed to check for duplicate passes');
    }
  }

  /**
   * Generate QR Code for gate pass
   */
  async generateQRCode(pass_id) {
    try {
      // Generate QR code as Data URL (base64 image)
      const qrCodeDataURL = await QRCode.toDataURL(pass_id, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        width: 300
      });

      return qrCodeDataURL;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Check if person is available at the given time
   */
  async checkPersonAvailability(person_to_meet_id, visit_date, entryTime, exitTime) {
    if (!person_to_meet_id) {
      return null; // No conflict if no person to meet specified
    }

    // Get the start and end of the visit date in IST
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const visitDateObj = new Date(visit_date);

    // Create IST midnight for the visit date
    const startOfDayIST = new Date(visitDateObj.getTime() + istOffset);
    startOfDayIST.setUTCHours(0, 0, 0, 0);

    // Create IST end of day
    const endOfDayIST = new Date(startOfDayIST.getTime() + 24 * 60 * 60 * 1000 - 1);

    console.log('[CONFLICT CHECK] Person:', person_to_meet_id, 'Date Range:', startOfDayIST.toISOString(), '-', endOfDayIST.toISOString());

    // Find conflicting passes for the same person on the same day
    const conflicts = await prisma.gate_pass.findMany({
      where: {
        person_to_meet_id: person_to_meet_id,
        visit_date: {
          gte: startOfDayIST,
          lte: endOfDayIST
        },
        status: {
          in: ['active', 'pending', 'checked_in']
        },
        // Check for time overlap
        OR: [
          // New visit starts during existing visit
          {
            AND: [
              { expected_entry_time: { lte: entryTime } },
              { expected_exit_time: { gt: entryTime } }
            ]
          },
          // New visit ends during existing visit
          {
            AND: [
              { expected_entry_time: { lt: exitTime } },
              { expected_exit_time: { gte: exitTime } }
            ]
          },
          // New visit completely contains existing visit
          {
            AND: [
              { expected_entry_time: { gte: entryTime } },
              { expected_exit_time: { lte: exitTime } }
            ]
          }
        ]
      },
      orderBy: {
        expected_entry_time: 'asc'
      },
      take: 1
    });

    if (conflicts.length > 0) {
      console.log('[CONFLICT FOUND]', {
        personId: person_to_meet_id,
        conflictingPass: {
          pass_id: conflicts[0].pass_id,
          visit_date: conflicts[0].visit_date,
          entryTime: conflicts[0].expected_entry_time,
          exitTime: conflicts[0].expected_exit_time
        },
        requestedTime: {
          entryTime,
          exitTime
        }
      });
    }

    return conflicts.length > 0 ? conflicts[0] : null;
  }

  /**
   * Suggest next available time slot
   */
  getSuggestedTime(exitTime) {
    // Parse exit time (HH:MM format)
    const [hour, minute] = exitTime.split(':').map(Number);

    // Add 15 minutes buffer
    let suggestedHour = hour;
    let suggestedMinute = minute + 15;

    if (suggestedMinute >= 60) {
      suggestedHour += 1;
      suggestedMinute -= 60;
    }

    // Format as HH:MM
    return `${suggestedHour.toString().padStart(2, '0')}:${suggestedMinute.toString().padStart(2, '0')}`;
  }

  /**
   * Create a new gate pass
   */
  async createPass(data, created_by_id) {
    try {
      // Validate required fields (simplified - ID proof is optional, will be checked by guard)
      if (!data.visitor_name || !data.mobile_number) {
        throw new Error('Visitor name and mobile number are required');
      }

      if (!data.visit_date || !data.entry_time) {
        throw new Error('Missing required visit timing information');
      }

      if (!data.purpose_of_visit) {
        throw new Error('Purpose of visit is required');
      }

      // Check for duplicate passes
      const duplicateCheck = await this.checkDuplicatePass(
        data.mobile_number,
        data.visitor_name,
        data.visit_date,
        data.visit_end_date || null
      );

      if (duplicateCheck.isDuplicate) {
        const conflictingPass = duplicateCheck.conflictingPasses[0];
        const dateRange = conflictingPass.visitEndDate
          ? `${new Date(conflictingPass.visitDate).toLocaleDateString()} to ${new Date(conflictingPass.visitEndDate).toLocaleDateString()}`
          : new Date(conflictingPass.visitDate).toLocaleDateString();

        throw new Error(
          `${data.visitor_name} (${data.mobile_number}) already has an active pass (${conflictingPass.passId}) for ${dateRange}. ` +
          `Status: ${conflictingPass.status}. Please cancel or complete the existing pass before creating a new one.`
        );
      }

      // Student role validation - can only create passes for parents
      if (created_by_id) {
        const creator = await prisma.userLogin.findUnique({
          where: { id: created_by_id },
          select: { role: true }
        });

        if (creator && creator.role?.toLowerCase() === 'student') {
          data.visitor_relation = 'Parent';
        }
      }

      // Vehicle model validation
      if (data.has_vehicle && !data.vehicle_model) {
        throw new Error('Vehicle model is required when vehicle is selected');
      }

      // Backward-compatible purpose normalization:
      // Some deployed DBs still have legacy visit_purpose_enum without "emergency".
      // Persist as "other" while preserving semantic meaning in purpose_other.
      const normalizedPurpose = data.purpose_of_visit === 'emergency' ? 'other' : data.purpose_of_visit;
      const normalizedPurposeOther = data.purpose_of_visit === 'emergency'
        ? (data.purpose_other || 'Emergency')
        : (data.purpose_other || null);

      const pass_id = await this.generatePassId();

      // Parse and validate date - normalize to midnight IST
      const visitDateRaw = new Date(data.visit_date);
      if (isNaN(visitDateRaw.getTime())) {
        throw new Error('Invalid visit date format');
      }

      // Normalize to midnight IST to ensure consistent date storage
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const visit_date = new Date(visitDateRaw.getTime() + istOffset);
      visit_date.setUTCHours(0, 0, 0, 0);

      console.log('[CREATE PASS] Visit Date normalized to IST:', visit_date.toISOString());

      // Parse entry time (HH:MM format)
      const [entryHour, entryMinute] = data.entry_time.split(':').map(Number);

      // Check for lunch time (1:00 PM - 2:00 PM)
      if (entryHour >= 13 && entryHour < 14) {
        throw new Error('This is lunch time (1:00 PM - 2:00 PM). Please schedule your visit before 1:00 PM or after 2:00 PM.');
      }

      // Fetch employee details if person_to_meet_id is provided
      let person_to_meet_name = data.person_to_meet_name || '';
      if (data.person_to_meet_id) {
        const employeeService = require('./employee.service');
        const employee = await employeeService.getEmployeeByUserLoginId(data.person_to_meet_id);

        if (!employee) {
          throw new Error('Selected employee not found or inactive');
        }

        person_to_meet_name = employee.name;

        // TODO: Person availability check - requires expected_exit_time
        // Can be added back if needed for scheduling conflicts
      }

      // Generate QR Code
      const qrCodeDataURL = await this.generateQRCode(pass_id);

      // Generate 6-digit verification code
      const verification_code = this.generateVerificationCode();

      // Calculate checkout QR expiry (midnight of the day AFTER visit_end_date or visit_date)
      const effectiveEndDate = data.visit_end_date
        ? new Date(new Date(data.visit_end_date).getTime() + istOffset)
        : visit_date;
      effectiveEndDate.setUTCHours(0, 0, 0, 0);

      // Add 1 day to get midnight of the next day (12:00 AM)
      const checkout_qr_expires_at = new Date(effectiveEndDate.getTime() + 24 * 60 * 60 * 1000);

      console.log('[CREATE PASS] Checkout QR expires at:', checkout_qr_expires_at.toISOString());

      // Create the pass
      const gatePass = await prisma.gate_pass.create({
        data: {
          pass_id,
          qr_code: qrCodeDataURL,
          verification_code,
          // Visitor details
          visitor_name: data.visitor_name,
          mobile_number: data.mobile_number,
          visitor_relation: data.visitor_relation || null,
          email: data.email || null,
          id_proof_type: data.id_proof_type || null,
          id_proof_number: data.id_proof_number || null,
          photo_file_path: data.photoFilePath || null,
          photo: data.photo || null,
          gender: data.gender || null,
          age: data.age ? parseInt(data.age) : null,

          // Visit details
          purpose_of_visit: normalizedPurpose,
          purpose_other: normalizedPurposeOther,
          department_to_visit: data.department_to_visit || null,
          person_to_meet_name: person_to_meet_name || null,
          visit_date: visit_date,
          visit_end_date: data.visit_end_date ? new Date(data.visit_end_date) : null,
          entry_time: data.entry_time,
          expected_entry_time: data.entry_time, // Backward compatibility
          expected_exit_time: data.expected_exit_time || null,

          // Stay details
          stay_required: data.stay_required || false,

          // Vehicle details
          has_vehicle: data.has_vehicle || false,
          vehicle_type: data.vehicle_type || null,
          vehicle_number: data.vehicle_number || null,
          vehicle_model: data.vehicle_model || null,

          // Additional info
          number_of_persons: parseInt(data.number_of_persons) || 1,
          items_carrying: data.items_carrying || null,
          special_instructions: data.special_instructions || null,

          // Status fields
          status: 'pending', // Legacy field mirrors pass_status='created'
          qr_status: 'inactive', // New field - QR activates 5 hours before entry
          pass_status: 'created', // New field - replaces status
          checkout_qr_expires_at: checkout_qr_expires_at, // Expiry at midnight after visit end date

          // Relations - use connect syntax for FK fields
          user_login_gate_pass_created_by_idTouser_login: {
            connect: { id: created_by_id }
          },
          ...(data.person_to_meet_id ? {
            user_login_gate_pass_person_to_meet_idTouser_login: {
              connect: { id: data.person_to_meet_id }
            }
          } : {})
        },
      });

      // Create history entry
      // History creation moved to async background task

      // Create notifications (will be sent async) - Disabled for now
      // TODO: Enable after testing basic flow
      // await this.createNotifications(gatePass);

      // Calculate QR activation time (5 hours before entry on visit_date)
      const [entryH, entryM] = data.entry_time.split(':').map(Number);
      let activationHour = entryH - 5;
      let activationDate = visit_date.toISOString().split('T')[0];
      if (activationHour < 0) {
        activationHour = 24 + activationHour;
        // Activation would be previous day - show as "day before"
        activationDate = '(day before)';
      }
      const activationTimeStr = `${activationDate} ${activationHour.toString().padStart(2, '0')}:${entryM.toString().padStart(2, '0')}`;

      // Calculate expiration (end of visit_end_date or visit_date at 23:59)
      const endDateStr = data.visit_end_date || visit_date.toISOString().split('T')[0];

      // Display QR code and Pass ID in terminal for testing
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║           🎫 NEW GATE PASS CREATED                        ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Pass ID: ${pass_id.padEnd(42)}║`);
      console.log(`║ Verification Code: ${verification_code.padEnd(34)}║`);
      console.log(`║ Visitor: ${gatePass.visitor_name.substring(0, 42).padEnd(42)}║`);
      console.log(`║ Mobile:  ${gatePass.mobile_number.padEnd(42)}║`);
      console.log(`║ Visit Date: ${visit_date.toISOString().split('T')[0].padEnd(38)}║`);
      if (data.visit_end_date) {
        console.log(`║ End Date:   ${data.visit_end_date.padEnd(38)}║`);
        console.log(`║ Stay Type:  Multi-Day                                     ║`);
      }
      console.log(`║ Entry Time: ${gatePass.entry_time.padEnd(38)}║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ QR Status: ${gatePass.qr_status.toUpperCase().padEnd(39)}║`);
      console.log(`║ QR Activates: ${activationTimeStr.padEnd(36)}║`);
      console.log(`║ QR Expires: ${endDateStr} 23:59${''.padEnd(25)}║`);
      console.log(`║ Pass Status: ${gatePass.pass_status.padEnd(37)}║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║ ✅ Guard can scan QR code, enter verification code,      ║');
      console.log('║    or search by Pass ID                                   ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      logger.info(`Gate pass created: ${pass_id}`);
      return gatePass;
    } catch (error) {
      logger.error('Error creating gate pass:', error);
      throw error;
    }
  }

  /**
   * Get all gate passes with filters
   * Role-based access: Admin/Guard see all, others see only their own
   */
  async getAllPasses(filters = {}) {
    try {
      // NOTE: Not auto-expiring here to prevent timeout on frequent reads
      // Expiry is handled by: 1) getPassStats (runs less frequently), 2) cron job, 3) individual pass checks

      const {
        search,
        status,
        dateFilter,
        page = 1,
        limit = 50,
        userId
      } = filters;

      // Check user role for filtering using new permission system
      let showAllPasses = false;
      if (userId) {
        const user = await prisma.userLogin.findUnique({
          where: { id: userId },
          select: {
            id: true,
            role: true
          }
        });

        if (user) {
          // Use new permission system: Admin and Guard (staff) see all passes
          showAllPasses = hasViewAllPermission(user);

          console.log(`[PASS FILTER] User: ${userId}, Role: ${user.role}, VIEW_ALL Permission: ${showAllPasses}`);
        }
      }

      const where = {};

      // Filter by creator if not admin/guard
      if (!showAllPasses && userId) {
        where.created_by_id = userId;
      }

      // Search filter
      if (search) {
        where.OR = [
          { pass_id: { contains: search, mode: 'insensitive' } },
          { visitor_name: { contains: search, mode: 'insensitive' } },
          { mobile_number: { contains: search } },
          { vehicle_number: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Status filter
      if (status && status !== 'all') {
        where.status = status;
      }

      // Date filter
      const today = new Date().toISOString().split('T')[0];
      if (dateFilter === 'today') {
        where.visit_date = new Date(today);
      } else if (dateFilter === 'upcoming') {
        where.visit_date = { gt: new Date(today) };
      } else if (dateFilter === 'past') {
        where.visit_date = { lt: new Date(today) };
      }

      // Run count and findMany in parallel for better performance
      const [passes, total] = await Promise.all([
        prisma.gate_pass.findMany({
          where,
          orderBy: {
            created_at: 'desc'
          },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user_login_gate_pass_created_by_idTouser_login: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true
                  }
                }
              }
            },
            hostel_bookings: {
              orderBy: {
                created_at: 'desc'
              },
              select: {
                id: true,
                check_in_datetime: true,
                check_out_datetime: true,
                billable_days: true,
                price_per_day: true,
                total_price: true,
                booking_status: true,
                payment_status: true,
                requested_checkin_time: true,
                checkin_request_status: true,
                checkin_request_reject_reason: true,
                room_cancel_request_status: true,
                room_cancel_request_reason: true,
                room_cancel_request_reject_reason: true,
                room_cancel_request_requested_at: true,
                room_cancel_request_reviewed_at: true,
                room: {
                  select: {
                    id: true,
                    room_number: true,
                    hostel: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }),
        prisma.gate_pass.count({ where })
      ]);

      // Transform passes to camelCase for frontend
      const transformedPasses = passes.map(pass => this.transformPassToFrontend(pass));

      return {
        passes: transformedPasses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching gate passes:', error);
      throw error;
    }
  }

  /**
   * Auto-expire past date passes
   */
  async expirePastPasses() {
    try {
      // Use IST calendar date represented as UTC midnight for date-only comparisons.
      const todayIST = getISTCalendarDateUtcMidnight();

      console.log('[EXPIRE CHECK] Today IST:', todayIST.toISOString());

      // Update all active/pending passes with past dates to expired
      // Check visit_end_date if present, otherwise check visit_date
      const result = await prisma.gate_pass.updateMany({
        where: {
          OR: [
            // Single-day passes: check visit_date
            {
              visit_end_date: null,
              visit_date: { lt: todayIST }
            },
            // Multi-day passes: check visit_end_date
            {
              visit_end_date: { lt: todayIST }
            }
          ],
          pass_status: { notIn: ['cancelled', 'expired'] }
        },
        data: {
          status: 'expired', // Legacy field
          pass_status: 'expired',
          qr_status: 'expired'
        }
      });

      if (result.count > 0) {
        logger.info(`✅ Expired ${result.count} past date passes`);
        console.log(`✅ Expired ${result.count} past date passes`);
      }

      return result.count;
    } catch (error) {
      logger.error('Error expiring past passes:', error);
      console.error('❌ Error expiring past passes:', error);
      return 0;
    }
  }

  /**
   * Get pass statistics
   * @param {string} userId - The user ID for role-based filtering
   */
  async getPassStats(userId) {
    try {
      // Auto-expire past passes first
      await this.expirePastPasses();

      // Determine if user should see all passes or only their own (using new permission system)
      let showAllPasses = false;

      if (userId) {
        const user = await prisma.userLogin.findUnique({
          where: { id: userId },
          select: {
            role: true
          }
        });

        if (user) {
          // Use new permission system: Admin and Guard (staff) see all stats
          showAllPasses = hasViewAllPermission(user);

          console.log(`[STATS FILTER] User: ${userId}, Role: ${user.role}, VIEW_ALL Permission: ${showAllPasses}`);
        }
      }

      // Build where clause for filtering by user
      const whereBase = !showAllPasses && userId ? { created_by_id: userId } : {};

      // Keep stats cutoff aligned with expiry cutoff.
      const todayIST = getISTCalendarDateUtcMidnight();

      const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

      console.log('[STATS CHECK] Today IST:', todayIST.toISOString(), 'Tomorrow IST:', tomorrowIST.toISOString());

      const [total, active, pending, completed, expired] = await Promise.all([
        prisma.gate_pass.count({ where: whereBase }),
        // Active Today - active status on today's date
        prisma.gate_pass.count({
          where: {
            ...whereBase,
            pass_status: { in: ['created', 'pending', 'approved', 'active', 'checked_in', 'checked_out'] },
            visit_date: { gte: todayIST, lt: tomorrowIST }
          }
        }),
        // Pending - all active and checked_in passes (not completed/cancelled/expired)
        prisma.gate_pass.count({
          where: {
            ...whereBase,
            pass_status: { in: ['created', 'pending', 'approved', 'active', 'checked_in', 'checked_out'] }
          }
        }),
        // Completed
        prisma.gate_pass.count({ where: { ...whereBase, pass_status: 'completed' } }),
        // Expired
        prisma.gate_pass.count({ where: { ...whereBase, pass_status: 'expired' } })
      ]);

      return {
        total,
        active,
        pending,
        completed,
        expired
      };
    } catch (error) {
      logger.error('Error fetching pass stats:', error);
      throw error;
    }
  }

  /**
   * Search/Verify pass for guard
   */
  async verifyPass(searchTerm, searchType) {
    try {
      // NOTE: Not auto-expiring here to keep verification fast
      // Pass expiry is checked individually after retrieval

      const verifySelect = {
        id: true,
        pass_id: true,
        status: true,
        pass_status: true,
        visitor_name: true,
        mobile_number: true,
        visitor_relation: true,
        purpose_of_visit: true,
        purpose_other: true,
        visit_date: true,
        visit_end_date: true,
        expected_entry_time: true,
        expected_exit_time: true,
        entry_time: true,
        actual_entry_time: true,
        actual_exit_time: true,
        qr_status: true,
        qr_activation_time: true,
        verification_code: true,
        checkout_unique_id: true,
        checkout_verification_code: true,
        checkout_qr_code: true,
        checkout_qr_expires_at: true,
        extension_count: true,
        extension_reason: true,
        has_vehicle: true,
        vehicle_number: true,
        vehicle_type: true,
        vehicle_model: true,
        stay_required: true,
        created_at: true,
        updated_at: true,
        cancellation_time: true,
        cancellation_reason: true,
        hostel_bookings: {
          take: 1,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            booking_status: true,
            payment_status: true,
            check_in_datetime: true,
            check_out_datetime: true,
            total_price: true,
            requested_checkin_time: true,
            checkin_request_status: true,
            checkin_request_reject_reason: true,
            room_cancel_request_status: true,
            room_cancel_request_reason: true,
            room_cancel_request_reject_reason: true,
            room_cancel_request_requested_at: true,
            room_cancel_request_reviewed_at: true,
            room: {
              select: {
                room_number: true,
                hostel: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        daily_entries: {
          select: {
            id: true,
            day_number: true,
            entry_date: true,
            entry_time: true,
            exit_time: true,
            entry_gate: true,
            exit_gate: true
          },
          orderBy: [{ day_number: 'asc' }, { entry_time: 'asc' }]
        }
      };

      const where = {};
      let pass;

      if (searchType === 'pass_id') {
        const normalizedPassId = searchTerm.trim().toUpperCase();

        // Fast path: unique lookup against normalized pass ID.
        pass = await prisma.gate_pass.findUnique({
          where: { pass_id: normalizedPassId },
          select: verifySelect
        });

        // Compatibility fallback for any legacy non-standard casing.
        if (!pass) {
          where.pass_id = { equals: searchTerm.trim(), mode: 'insensitive' };
        }
      } else if (searchType === 'mobile') {
        where.mobile_number = searchTerm.trim();
      } else if (searchType === 'name') {
        where.visitor_name = { contains: searchTerm.trim(), mode: 'insensitive' };
      } else if (searchType === 'vehicle') {
        const normalizedVehicleNumber = searchTerm.trim().toUpperCase();

        // Fast path: exact normalized match first.
        pass = await prisma.gate_pass.findFirst({
          where: { vehicle_number: normalizedVehicleNumber },
          orderBy: { updated_at: 'desc' },
          select: verifySelect
        });

        // Compatibility fallback for mixed-case stored values.
        if (!pass) {
          where.vehicle_number = { equals: searchTerm.trim(), mode: 'insensitive' };
        }
      } else if (searchType === 'checkout_qr') {
        // Handle checkout QR verification (for cancelled passes with new unique checkout ID)
        try {
          const qrData = JSON.parse(searchTerm);
          if (qrData.type === 'CHECKOUT' && qrData.checkout_id) {
            // checkout_unique_id is unique; use direct lookup.
            pass = await prisma.gate_pass.findUnique({
              where: { checkout_unique_id: qrData.checkout_id },
              select: verifySelect
            });
            logger.info(`[VERIFY] Checkout QR scanned with checkout ID: ${qrData.checkout_id}`);
          } else {
            throw new Error('Invalid checkout QR code format');
          }
        } catch (parseError) {
          throw new Error('Invalid QR code data');
        }
      }

      if (!pass) {
        pass = await prisma.gate_pass.findFirst({
          where,
          orderBy: { updated_at: 'desc' },
          select: verifySelect
        });
      }

      if (!pass) {
        return null;
      }

      // For checkout QR verification, validate expiry
      if (searchType === 'checkout_qr') {
        if (!pass.checkout_qr_code || !pass.checkout_qr_expires_at) {
          throw new Error('No valid checkout QR found for this pass');
        }

        const now = new Date();
        if (now > pass.checkout_qr_expires_at) {
          throw new Error('Checkout QR code has expired. Please contact admin to regenerate checkout credentials.');
        }

        if (pass.pass_status !== 'cancelled') {
          throw new Error('This pass is not cancelled. Use regular checkout process.');
        }

        logger.info(`[VERIFY] Checkout QR valid for pass: ${pass.pass_id}, expires: ${pass.checkout_qr_expires_at}`);
        return pass;
      }

      // Real-time QR activation check (for regular check-in)
      // If pass is inactive and should be active now, activate it
      // Also handle checked_out passes that need re-activation for re-entry
      const needsActivation = pass.qr_status === 'inactive' && (
        pass.pass_status === 'created' ||
        pass.pass_status === 'checked_out'
      );
      if (needsActivation) {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const nowIST = new Date(now.getTime() + istOffset);
        const todayStr = nowIST.toISOString().split('T')[0];
        const visitDateStr = new Date(pass.visit_date).toISOString().split('T')[0];
        const endDateStr = pass.visit_end_date ? new Date(pass.visit_end_date).toISOString().split('T')[0] : visitDateStr;

        // Check if today is within the visit date range
        const isWithinRange = todayStr >= visitDateStr && todayStr <= endDateStr;

        if (isWithinRange && pass.entry_time) {
          // For first day, check activation window. For subsequent days, activate immediately.
          const isFirstDay = todayStr === visitDateStr;
          let shouldActivate = !isFirstDay; // subsequent days: always activate

          if (isFirstDay) {
            const [hours, minutes] = pass.entry_time.split(':').map(Number);
            const entryTimeInMinutes = hours * 60 + minutes;
            // Use toISOString() to extract hours/minutes from the IST-shifted Date
            // (avoids double-counting IST on machines already in IST timezone)
            const istTimeStr = nowIST.toISOString().split('T')[1]; // e.g. "09:30:00.000Z"
            const currentTimeInMinutes = parseInt(istTimeStr.split(':')[0]) * 60 + parseInt(istTimeStr.split(':')[1]);
            const activationWindowMinutes = 5 * 60; // 5 hours

            // Activate if within activation window or entry time has passed
            shouldActivate = (entryTimeInMinutes - currentTimeInMinutes) <= activationWindowMinutes;
          }

          if (shouldActivate) {
            pass = await prisma.gate_pass.update({
              where: { id: pass.id },
              data: {
                qr_status: 'active',
                qr_activation_time: now
              }
            });
            logger.info(`Real-time QR activation for pass: ${pass.pass_id}`);
          }
        }
      }

      // Return pass data
      return pass;
    } catch (error) {
      logger.error('Error verifying pass:', error);
      throw error;
    }
  }

  /**
   * Check if a pass qualifies for multi-day daily check-in/check-out flow
   * Criteria: has visit_end_date, stay_required is false, visitor_relation is NOT Parent/Guardian
   */
  isMultiDayDailyPass(pass) {
    if (!pass.visit_end_date) return false;
    if (pass.stay_required) return false;
    const relation = (pass.visitor_relation || '').toLowerCase();
    if (relation === 'parent' || relation === 'guardian') return false;
    return true;
  }

  /**
   * Allow entry (guard action)
   */
  async allowEntry(pass_id, guardId, entryData) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.pass_status === 'cancelled' || pass.status === 'denied') {
        throw new Error('Pass is cancelled or denied');
      }

      // Allow entry for 'created' passes (first entry) and 'checked_out' passes (re-entry)
      // All passes support unlimited in/out. Cancel = final checkout.
      if (pass.pass_status !== 'created' && pass.pass_status !== 'checked_out') {
        throw new Error('Pass is not in a valid state for entry');
      }

      // Check QR status - must be active to allow entry
      if (pass.qr_status !== 'active') {
        throw new Error('QR code is not active yet. QR becomes active 5 hours before entry time.');
      }

      // For re-entry (checked_out), validate today is within date range
      if (pass.pass_status === 'checked_out') {
        const now2 = new Date();
        const istOffset2 = 5.5 * 60 * 60 * 1000;
        const nowIST2 = new Date(now2.getTime() + istOffset2);
        const todayStr = nowIST2.toISOString().split('T')[0];
        const startStr = new Date(pass.visit_date).toISOString().split('T')[0];
        const endStr = pass.visit_end_date
          ? new Date(pass.visit_end_date).toISOString().split('T')[0]
          : startStr; // Single-day pass: end = start
        if (todayStr < startStr || todayStr > endStr) {
          throw new Error('Today is outside the valid date range for this pass');
        }
      }

      // If verification code is provided, validate it
      if (entryData.verification_code) {
        if (pass.verification_code !== entryData.verification_code) {
          throw new Error('Invalid verification code');
        }
      }

      const now = new Date();

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'checked_in', // Legacy field
          pass_status: 'checked_in',
          actual_entry_time: now,
          entry_gate: entryData.gate,
          entry_guard_id: guardId,
          entry_remarks: entryData.remarks || null
        }
      });

      // Track daily entry for all passes (in/out count) - always create a new record
      {
        // Get today's date in IST using proper timezone conversion
        // Using Date.UTC() ensures PostgreSQL @db.Date stores the correct IST date
        // (not local-midnight which would be UTC previous day on an IST server)
        const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayDate = new Date(Date.UTC(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate()));
        const startDate = new Date(pass.visit_date);
        const startIST = new Date(startDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const startDateOnly = new Date(Date.UTC(startIST.getFullYear(), startIST.getMonth(), startIST.getDate()));
        const dayNumber = Math.floor((todayDate - startDateOnly) / (24 * 60 * 60 * 1000)) + 1;

        await prisma.gate_pass_daily_entry.create({
          data: {
            gate_pass_id: pass.id,
            day_number: dayNumber,
            entry_date: todayDate,
            entry_time: now,
            entry_gate: entryData.gate,
            entry_guard_id: guardId,
            entry_remarks: entryData.remarks || null
          }
        });

        logger.info(`Daily entry recorded for pass ${pass.pass_id}, day ${dayNumber} (entry #${await prisma.gate_pass_daily_entry.count({ where: { gate_pass_id: pass.id } })})`);
      }

      logger.info(`Entry allowed for pass: ${pass.pass_id}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error allowing entry:', error);
      throw error;
    }
  }

  /**
   * Deny entry (guard action)
   */
  async denyEntry(pass_id, guardId, denial_reason) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'denied',
          denial_reason
        }
      });

      // Skip history and notification for now

      logger.info(`Entry denied for pass: ${pass.pass_id}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error denying entry:', error);
      throw error;
    }
  }

  /**
   * Record exit (guard action)
   */
  async recordExit(pass_id, guardId, exitData) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.pass_status !== 'checked_in') {
        throw new Error('Visitor is not checked in');
      }

      // If verification code is provided, validate it against the ORIGINAL code (same as entry)
      // QR scan path sends no code (trusted physical scan); manual path must match original verification_code
      if (exitData.verification_code) {
        if (pass.verification_code !== exitData.verification_code) {
          throw new Error('Invalid verification code. Please use the original code from the pass.');
        }
      }

      const now = new Date();

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'active', // Legacy enum field - 'checked_out' not in gate_pass_status_enum, use 'active' since pass is still valid
          pass_status: 'checked_out',
          actual_exit_time: now,
          exit_gate: exitData.gate,
          exit_guard_id: guardId,
          exit_remarks: exitData.remarks || null,
          // Deactivate QR until next scan (verifyPass) or cron re-activates it
          qr_status: 'inactive'
        }
      });

      // Track daily exit - find the most recent entry without an exit time
      {
        const latestOpenEntry = await prisma.gate_pass_daily_entry.findFirst({
          where: {
            gate_pass_id: pass.id,
            exit_time: null
          },
          orderBy: { entry_date: 'desc' }
        });

        if (latestOpenEntry) {
          await prisma.gate_pass_daily_entry.update({
            where: { id: latestOpenEntry.id },
            data: {
              exit_time: now,
              exit_gate: exitData.gate,
              exit_guard_id: guardId,
              exit_remarks: exitData.remarks || null
            }
          });
        }

        logger.info(`Daily exit recorded for pass ${pass.pass_id}`);
      }

      logger.info(`Exit recorded for pass: ${pass.pass_id}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error recording exit:', error);
      throw error;
    }
  }

  /**
   * Get daily entry/exit records for a multi-day pass
   */
  async getDailyEntries(pass_id) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id },
        select: { id: true, pass_id: true, visit_date: true, visit_end_date: true, stay_required: true, visitor_relation: true }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      const entries = await prisma.gate_pass_daily_entry.findMany({
        where: { gate_pass_id: pass.id },
        orderBy: { day_number: 'asc' },
        include: {
          entry_guard: { select: { id: true, uid: true } },
          exit_guard: { select: { id: true, uid: true } }
        }
      });

      return {
        passId: pass.pass_id,
        totalDays: pass.visit_end_date
          ? Math.ceil((new Date(pass.visit_end_date) - new Date(pass.visit_date)) / (24 * 60 * 60 * 1000)) + 1
          : 1,
        entries: entries.map(e => ({
          id: e.id,
          dayNumber: e.day_number,
          entryDate: e.entry_date,
          entryTime: e.entry_time,
          exitTime: e.exit_time,
          entryGate: e.entry_gate,
          exitGate: e.exit_gate,
          entryGuard: e.entry_guard?.uid || null,
          exitGuard: e.exit_guard?.uid || null,
          entryRemarks: e.entry_remarks,
          exitRemarks: e.exit_remarks
        }))
      };
    } catch (error) {
      logger.error('Error fetching daily entries:', error);
      throw error;
    }
  }

  /**
   * Cancel pass before check-in (with hostel refund logic if applicable)
   * @param {Object} pass - The gate pass object
   * @param {string} userId - User cancelling the pass
   * @param {string} reason - Cancellation reason
   */
  async cancelBeforeCheckIn(pass, userId, reason) {
    try {
      logger.info(`[CANCEL BEFORE CHECK-IN] Pass ${pass.pass_id}, User: ${userId}`);

      let hostelRefundData = null;

      // Check if pass has hostel booking
      if (pass.stay_required) {
        const hostelBooking = await prisma.hostelBooking.findFirst({
          where: {
            gate_pass_id: pass.id,
            booking_status: { in: ['pending', 'confirmed'] }
          },
          orderBy: {
            created_at: 'desc'
          },
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        });

        if (hostelBooking) {
          logger.info(`[CANCEL BEFORE CHECK-IN] Hostel booking found: ${hostelBooking.id}, Amount: ${hostelBooking.total_price}`);

          // Dynamic refund calculation based on time before check-in
          const now = new Date();
          const checkInDate = new Date(hostelBooking.check_in_datetime);

          // Calculate hours until check-in
          const timeUntilCheckIn = checkInDate.getTime() - now.getTime();
          const hoursUntilCheckIn = timeUntilCheckIn / (1000 * 60 * 60);
          const daysUntilCheckIn = hoursUntilCheckIn / 24;

          let refundPercent = 0;
          let appliedSlab = '';

          if (daysUntilCheckIn >= 3) {
            refundPercent = 90;
            appliedSlab = '3+ days before check-in';
          } else if (daysUntilCheckIn >= 1) {
            refundPercent = 70;
            appliedSlab = '1-3 days before check-in';
          } else if (hoursUntilCheckIn >= 2) {
            refundPercent = 40;
            appliedSlab = '2-24 hours before check-in';
          } else {
            refundPercent = 0;
            appliedSlab = 'Less than 2 hours before check-in';
          }

          logger.info(`[CANCEL BEFORE CHECK-IN] Time until check-in: ${daysUntilCheckIn.toFixed(2)} days (${hoursUntilCheckIn.toFixed(2)} hours)`);
          logger.info(`[CANCEL BEFORE CHECK-IN] Applied refund slab: ${appliedSlab} (${refundPercent}% refund)`);

          // Calculate refund amounts
          const originalAmount = parseFloat(hostelBooking.total_price) || 0;
          const cancellationFeePercent = 100 - refundPercent;
          const cancellationFeeAmount = (originalAmount * cancellationFeePercent) / 100;
          const refundAmount = originalAmount - cancellationFeeAmount;

          logger.info(`[CANCEL BEFORE CHECK-IN] Refund calculation: Original: ${originalAmount}, Fee: ${cancellationFeeAmount} (${cancellationFeePercent}%), Refund: ${refundAmount}`);

          logger.info(`[CANCEL BEFORE CHECK-IN] Refund will be processed: ₹${refundAmount}`);

          // Update HostelBooking status
          await prisma.hostelBooking.update({
            where: { id: hostelBooking.id },
            data: {
              booking_status: 'cancelled',
              payment_status: 'refunded',
              updated_at: new Date()
            }
          });

          // Create RefundTransaction record
          await prisma.refundTransaction.create({
            data: {
              booking_id: hostelBooking.id,
              pass_id: pass.id,
              original_amount: originalAmount,
              cancellation_fee_percent: cancellationFeePercent,
              cancellation_fee_amount: cancellationFeeAmount,
              refund_amount: refundAmount,
              refund_status: 'processed',
              processed_at: new Date(),
              remarks: `Cancelled before check-in. Slab: ${appliedSlab} (${refundPercent}% refund)`,
            }
          });

          logger.info(`[CANCEL BEFORE CHECK-IN] Hostel booking cancelled with refund, RefundTransaction created`);

          hostelRefundData = {
            booking_id: hostelBooking.id,
            room_number: hostelBooking.room?.room_number || hostelBooking.room_number,
            hostel_name: hostelBooking.room?.hostel?.name || hostelBooking.hostel_name,
            original_amount: originalAmount,
            cancellation_fee_percent: cancellationFeePercent,
            cancellation_fee_amount: cancellationFeeAmount,
            refund_amount: refundAmount,
            applied_slab: appliedSlab,
            refund_percent: refundPercent
          };
        }
      }

      // Update pass status to cancelled (no checkout QR needed)
      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id: pass.pass_id },
        data: {
          status: 'cancelled', // Legacy field
          pass_status: 'cancelled',
          qr_status: 'inactive', // QR is no longer valid
          cancellation_time: new Date(),
          cancellation_reason: reason
        }
      });

      logger.info(`[CANCEL BEFORE CHECK-IN] Pass cancelled: ${updatedPass.pass_id}`);

      return {
        ...updatedPass,
        hostel_refund: hostelRefundData,
        cancellation_type: 'before_check_in'
      };
    } catch (error) {
      logger.error('[CANCEL BEFORE CHECK-IN] Error:', error);
      throw error;
    }
  }

  /**
   * Cancel pass
   */
  async cancelPass(pass_id, userId, reason) {
    try {
      // Fetch pass with creator info
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id },
        include: {
          user_login_gate_pass_created_by_idTouser_login: {
            select: {
              id: true,
              role: true,
              employeeDetails: {
                select: {
                  designation: true
                }
              }
            }
          }
        }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      // Check permissions: only creator, guard, or admin can cancel
      const user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          employeeDetails: {
            select: {
              designation: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const activeRoomBooking = await prisma.hostelBooking.findFirst({
        where: {
          gate_pass_id: pass.id,
          booking_status: { in: ['pending', 'confirmed'] }
        },
        orderBy: {
          created_at: 'desc'
        },
        select: {
          id: true,
          booking_status: true,
          room_cancel_request_status: true
        }
      });

      if (activeRoomBooking && activeRoomBooking.booking_status !== 'cancelled') {
        throw new Error('First cancel the room, then only you can cancel the pass.');
      }

      const role = user.role?.toLowerCase() || '';
      const designation = user.employeeDetails?.designation?.toLowerCase() || '';
      const isAdmin = role === 'admin';
      const isGuard = designation.includes('guard') || designation.includes('security') || designation.includes('volunteer');
      const isCreator = pass.created_by_id === userId;

      if (!isAdmin && !isGuard && !isCreator) {
        throw new Error('You do not have permission to cancel this pass. Only the pass creator, guards, or admin can cancel.');
      }

      // Validate reason is provided
      if (!reason || reason.trim() === '') {
        throw new Error('Cancellation reason is required');
      }

      // Check if pass is already cancelled or completed
      if (pass.pass_status === 'cancelled') {
        throw new Error('Pass is already cancelled');
      }

      if (pass.pass_status === 'completed') {
        throw new Error('Pass is already completed. Cannot cancel.');
      }

      logger.info(`[CANCEL PASS] User ${userId} (admin:${isAdmin}, guard:${isGuard}, creator:${isCreator}) cancelling pass ${pass_id}, Status: ${pass.pass_status}`);

      // Route to appropriate cancellation flow based on pass status
      if (pass.pass_status === 'created') {
        // Before check-in cancellation (no checkout QR needed)
        return await this.cancelBeforeCheckIn(pass, userId, reason);
      } else if (pass.pass_status === 'checked_in') {
        // After check-in cancellation (generates checkout QR for final checkout)
        return await this.cancelAfterCheckIn(pass, userId, reason);
      } else if (pass.pass_status === 'checked_out') {
        // Person is already outside - just cancel and mark as final
        return await this.cancelFromCheckedOut(pass, userId, reason);
      } else {
        throw new Error(`Cannot cancel pass with status: ${pass.pass_status}`);
      }
    } catch (error) {
      logger.error('[CANCEL PASS] Error:', error);
      throw error;
    }
  }

  /**
   * Cancel pass after check-in (generates checkout QR)
   * @param {Object} pass - The gate pass object
   * @param {string} userId - User cancelling the pass
   * @param {string} reason - Cancellation reason
   */
  async cancelAfterCheckIn(pass, userId, reason) {
    try {
      logger.info(`[CANCEL AFTER CHECK-IN] Pass ${pass.pass_id}, User: ${userId}`);

      // Cancel associated hostel booking so room becomes available again
      const hostelBooking = await prisma.hostelBooking.findFirst({
        where: {
          gate_pass_id: pass.id,
          booking_status: { in: ['pending', 'confirmed'] }
        },
        orderBy: {
          created_at: 'desc'
        },
        include: { room: { include: { hostel: true } } }
      });
      if (hostelBooking && hostelBooking.booking_status !== 'cancelled') {
        // After check-in: calculate refund based on same slab policy
        const now = new Date();
        const checkInDate = new Date(hostelBooking.check_in_datetime);
        const timeUntilCheckIn = checkInDate.getTime() - now.getTime();
        const hoursUntilCheckIn = timeUntilCheckIn / (1000 * 60 * 60);
        const daysUntilCheckIn = hoursUntilCheckIn / 24;

        let refundPercent = 0;
        let appliedSlab = '';
        if (daysUntilCheckIn >= 3) {
          refundPercent = 90;
          appliedSlab = '3+ days before check-in';
        } else if (daysUntilCheckIn >= 1) {
          refundPercent = 70;
          appliedSlab = '1-3 days before check-in';
        } else if (hoursUntilCheckIn >= 2) {
          refundPercent = 40;
          appliedSlab = '2-24 hours before check-in';
        } else {
          refundPercent = 0;
          appliedSlab = 'After check-in / Less than 2 hours';
        }

        const originalAmount = parseFloat(hostelBooking.total_price) || 0;
        const cancellationFeePercent = 100 - refundPercent;
        const cancellationFeeAmount = (originalAmount * cancellationFeePercent) / 100;
        const refundAmount = originalAmount - cancellationFeeAmount;

        logger.info(`[CANCEL AFTER CHECK-IN] Refund: Original=${originalAmount}, Fee=${cancellationFeeAmount} (${cancellationFeePercent}%), Refund=${refundAmount}`);

        const shouldRefund = hostelBooking.payment_status === 'completed' && refundAmount > 0;

        await prisma.hostelBooking.update({
          where: { id: hostelBooking.id },
          data: {
            booking_status: 'cancelled',
            payment_status: shouldRefund ? 'refunded' : hostelBooking.payment_status,
            updated_at: new Date()
          }
        });

        // Create RefundTransaction record
        if (hostelBooking.payment_status === 'completed') {
          await prisma.refundTransaction.create({
            data: {
              booking_id: hostelBooking.id,
              pass_id: pass.id,
              original_amount: originalAmount,
              cancellation_fee_percent: cancellationFeePercent,
              cancellation_fee_amount: cancellationFeeAmount,
              refund_amount: refundAmount,
              refund_status: 'processed',
              processed_at: new Date(),
              remarks: `Cancelled after check-in. Slab: ${appliedSlab} (${refundPercent}% refund)`,
            }
          });
        }

        logger.info(`[CANCEL AFTER CHECK-IN] Hostel booking ${hostelBooking.id} cancelled, room freed, RefundTransaction created`);
      }

      // Generate NEW unique checkout ID and QR code with 1-hour validity
      const checkoutQRData = await this.generateCheckoutQR(pass.id);

      logger.info(`[CANCEL AFTER CHECK-IN] New checkout ID: ${checkoutQRData.checkout_unique_id}, verification code: ${checkoutQRData.checkout_verification_code}`);

      // Update pass status to cancelled with new checkout unique ID and verification code
      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id: pass.pass_id },
        data: {
          status: 'cancelled', // Legacy field
          pass_status: 'cancelled',
          qr_status: 'inactive', // QR is no longer valid
          cancellation_time: new Date(),
          cancellation_reason: reason,
          checkout_unique_id: checkoutQRData.checkout_unique_id,
          checkout_verification_code: checkoutQRData.checkout_verification_code,
          checkout_qr_code: checkoutQRData.qr_code,
          checkout_qr_expires_at: checkoutQRData.expires_at
        }
      });

      logger.info(`[CANCEL AFTER CHECK-IN] Pass cancelled: ${updatedPass.pass_id}, checkout QR generated with 24-hour validity`);

      // TODO: Send email and WhatsApp notification to visitor with checkout QR
      // This will be implemented with notification service
      logger.info(`[CANCEL AFTER CHECK-IN] Notification queued for mobile: ${pass.mobile_number}, email: ${pass.email || 'N/A'}`);

      return {
        ...updatedPass,
        checkout_qr: {
          checkout_unique_id: checkoutQRData.checkout_unique_id,
          checkout_verification_code: checkoutQRData.checkout_verification_code,
          qr_code: checkoutQRData.qr_code,
          expires_at: checkoutQRData.expires_at,
          expires_in_minutes: 60
        },
        cancellation_type: 'after_check_in'
      };
    } catch (error) {
      logger.error('[CANCEL AFTER CHECK-IN] Error:', error);
      throw error;
    }
  }

  /**
   * Cancel pass from checked_out state (person already exited campus)
   * No checkout QR needed since visitor is already outside.
   * This is a final closure of the pass.
   */
  async cancelFromCheckedOut(pass, userId, reason) {
    try {
      logger.info(`[CANCEL FROM CHECKED_OUT] Pass ${pass.pass_id}, User: ${userId}`);

      // Cancel associated hostel booking so room becomes available
      const hostelBooking = await prisma.hostelBooking.findFirst({
        where: {
          gate_pass_id: pass.id,
          booking_status: { in: ['pending', 'confirmed'] }
        },
        orderBy: {
          created_at: 'desc'
        },
        include: { room: { include: { hostel: true } } }
      });
      if (hostelBooking && hostelBooking.booking_status !== 'cancelled') {
        const originalAmount = parseFloat(hostelBooking.total_price) || 0;

        await prisma.hostelBooking.update({
          where: { id: hostelBooking.id },
          data: {
            booking_status: 'cancelled',
            updated_at: new Date()
          }
        });

        // Create RefundTransaction record if payment was completed
        if (hostelBooking.payment_status === 'completed' && originalAmount > 0) {
          await prisma.refundTransaction.create({
            data: {
              booking_id: hostelBooking.id,
              pass_id: pass.id,
              original_amount: originalAmount,
              cancellation_fee_percent: 100,
              cancellation_fee_amount: originalAmount,
              refund_amount: 0,
              refund_status: 'processed',
              processed_at: new Date(),
              remarks: `Cancelled from checked_out state. No refund - visitor already checked out.`,
            }
          });
        }

        logger.info(`[CANCEL FROM CHECKED_OUT] Hostel booking ${hostelBooking.id} cancelled`);
      }

      // Mark pass as cancelled (final state - person already outside)
      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id: pass.pass_id },
        data: {
          status: 'cancelled',
          pass_status: 'cancelled',
          qr_status: 'inactive',
          cancellation_time: new Date(),
          cancellation_reason: reason
        }
      });

      logger.info(`[CANCEL FROM CHECKED_OUT] Pass cancelled: ${updatedPass.pass_id} - final closure, visitor already outside`);

      return {
        ...updatedPass,
        cancellation_type: 'from_checked_out'
      };
    } catch (error) {
      logger.error('[CANCEL FROM CHECKED_OUT] Error:', error);
      throw error;
    }
  }

  /**
   * Activate QR Code (can be called manually or by cron job)
   */
  async activateQRCode(passId) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { id: passId }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.qr_status !== 'inactive') {
        throw new Error('QR code is not in inactive state');
      }

      const updatedPass = await prisma.gate_pass.update({
        where: { id: passId },
        data: {
          qr_status: 'active',
          qr_activation_time: new Date()
        }
      });

      logger.info(`QR code activated for pass: ${updatedPass.pass_id}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error activating QR code:', error);
      throw error;
    }
  }

  /**
   * Generate checkout QR code with unique checkout ID (valid for 1 hour)
   */
  async generateCheckoutQR(passId) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { id: passId }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      // Generate unique checkout ID (different from pass_id)
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

      // Get count of checkouts today to generate sequence number
      const checkoutCountToday = await prisma.gate_pass.count({
        where: {
          cancellation_time: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lt: new Date(today.setHours(23, 59, 59, 999))
          },
          checkout_unique_id: {
            not: null
          }
        }
      });

      const sequence = String(checkoutCountToday + 1).padStart(3, '0');
      const checkoutUniqueId = `CHECKOUT-${dateStr}-${sequence}`;

      // Generate NEW 6-digit verification code for checkout (different from original)
      const checkoutVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const timestamp = Date.now();
      const expiresAt = new Date(timestamp + 60 * 60 * 1000); // 1 hour from now

      // Generate checkout QR data — keep minimal to reduce QR density and improve scannability
      const checkoutData = {
        type: 'CHECKOUT',
        checkout_id: checkoutUniqueId,
        checkout_verification_code: checkoutVerificationCode
      };

      // Generate QR code as Data URL — use 'M' error correction (less dense, easier to scan)
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(checkoutData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 2,
        width: 500
      });

      logger.info(`[CHECKOUT QR] Generated new checkout ID: ${checkoutUniqueId}, verification code: ${checkoutVerificationCode} for pass: ${pass.pass_id}, expires at: ${expiresAt.toISOString()}`);

      return {
        checkout_unique_id: checkoutUniqueId,
        checkout_verification_code: checkoutVerificationCode,
        qr_code: qrCodeDataURL,
        expires_at: expiresAt
      };
    } catch (error) {
      logger.error('Error generating checkout QR:', error);
      throw error;
    }
  }

  /**
   * Record checkout using checkout QR code
   */
  async recordCheckout(pass_id, guardId, exitData) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      // Check if pass is checked_in but NOT cancelled - must cancel first
      if (pass.pass_status === 'checked_in') {
        throw new Error('Pass must be cancelled before checkout. Guard should cancel the pass first.');
      }

      // Check if pass is cancelled - requires verification
      if (pass.pass_status === 'cancelled') {
        // Validate checkout credentials exist and not expired
        if ((!pass.checkout_unique_id || !pass.checkout_verification_code) && !pass.checkout_qr_expires_at) {
          throw new Error('No checkout credentials found. This cancelled pass requires valid checkout verification.');
        }

        const now = new Date();
        if (pass.checkout_qr_expires_at && now > pass.checkout_qr_expires_at) {
          const expiredHours = Math.floor((now.getTime() - pass.checkout_qr_expires_at.getTime()) / (1000 * 60 * 60));
          const expiredMinutes = Math.floor(((now.getTime() - pass.checkout_qr_expires_at.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
          throw new Error(`Checkout credentials expired ${expiredHours > 0 ? expiredHours + 'h ' : ''}${expiredMinutes}m ago. Please contact admin to regenerate checkout credentials.`);
        }

        // Validate NEW checkout verification code — MANDATORY for final checkout
        // The checkout code is different from the original entry/exit code.
        // Original pass codes are NOT accepted here; only the new checkout QR/code works.
        if (!exitData.verificationCode) {
          throw new Error('Checkout verification code is required. Please scan the new checkout QR code or enter the 6-digit code generated after cancellation.');
        }
        if (!pass.checkout_verification_code) {
          throw new Error('No checkout credentials found for this pass. Please contact admin.');
        }
        if (exitData.verificationCode !== pass.checkout_verification_code) {
          throw new Error('Invalid checkout verification code. Use the NEW code generated after cancellation — the original pass code will not work here.');
        }

        logger.info(`[CHECKOUT] Cancelled pass checkout: ${pass.pass_id}, checkout ID: ${pass.checkout_unique_id}, QR expires: ${pass.checkout_qr_expires_at}`);
      } else if (pass.pass_status !== 'checked_out' && pass.pass_status !== 'cancelled') {
        throw new Error(`Cannot checkout pass with status: ${pass.pass_status}`);
      }

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'completed', // Legacy field
          pass_status: 'completed', // FINAL checkout - no more actions allowed
          qr_status: 'used', // QR permanently disabled
          actual_exit_time: new Date(),
          exit_gate: exitData.gate || 'Main Gate',
          exit_guard_id: guardId,
          exit_remarks: exitData.remarks || (pass.pass_status === 'cancelled' ? 'Final checkout via cancelled pass QR' : 'Final checkout'),
          // Clear checkout QR fields
          checkout_qr_code: null,
          checkout_qr_expires_at: null
        }
      });

      logger.info(`[CHECKOUT] Final checkout for pass: ${pass.pass_id}, Status was: ${pass.pass_status} → completed`);
      return updatedPass;
    } catch (error) {
      logger.error('[CHECKOUT] Error:', error);
      throw error;
    }
  }

  /**
   * Extension billing helper aligned with guest house rules.
   */
  calculateExtensionBillableDays(checkInDatetime, checkOutDatetime) {
    const GRACE_CHECKOUT_HOUR = 17;
    const checkIn = new Date(checkInDatetime);
    const checkOut = new Date(checkOutDatetime);

    const checkInDay = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const checkOutDay = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    const baseDays = Math.round((checkOutDay - checkInDay) / (1000 * 60 * 60 * 24));
    const checkOutHour = checkOut.getHours() + checkOut.getMinutes() / 60;

    if (checkOutHour > GRACE_CHECKOUT_HOUR) {
      return Math.max(baseDays + 1, 1);
    }

    return Math.max(baseDays, 1);
  }

  normalizeCheckoutDeadlineDatetime(dateInput) {
    const checkout = new Date(dateInput);
    checkout.setHours(17, 0, 0, 0);
    return checkout;
  }

  /**
   * Parse and validate extend date (must be strictly after current end date).
   */
  normalizeExtensionDate(newEndDate, currentEndDate) {
    const endDateRaw = new Date(newEndDate);
    if (isNaN(endDateRaw.getTime())) {
      throw new Error('Invalid end date format');
    }

    const istOffset = 5.5 * 60 * 60 * 1000;
    const visit_end_date = new Date(endDateRaw.getTime() + istOffset);
    visit_end_date.setUTCHours(0, 0, 0, 0);

    if (visit_end_date <= currentEndDate) {
      throw new Error('New end date must be after current end date');
    }

    return visit_end_date;
  }

  /**
   * Determine whether a room is free for extension window.
   */
  async isRoomAvailableForExtension(roomId, currentBookingId, extensionStart, extensionEnd) {
    const conflicts = await prisma.hostelBooking.count({
      where: {
        room_id: roomId,
        id: { not: currentBookingId },
        booking_status: { in: ['confirmed', 'pending'] },
        AND: [
          { check_out_datetime: { gte: getBookingCutoffDate() } },
          { check_in_datetime: { lt: extensionEnd } },
          { check_out_datetime: { gte: extensionStart } }
        ]
      }
    });

    return conflicts === 0;
  }

  /**
   * Step-1 for booked guest house pass extension.
   */
  async getExtendPassOptions(pass_id, newEndDate) {
    const pass = await prisma.gate_pass.findUnique({
      where: { pass_id },
      include: {
        hostel_bookings: {
          orderBy: {
            created_at: 'desc'
          },
          take: 1,
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        }
      }
    });

    if (!pass) {
      throw new Error('Pass not found');
    }

    pass.hostel_booking = (pass.hostel_bookings && pass.hostel_bookings[0]) || null;

    if (pass.status === 'checked_out' || pass.pass_status === 'checked_out') {
      throw new Error('Cannot extend a pass that has been checked out');
    }

    if (pass.status === 'cancelled' || pass.pass_status === 'cancelled') {
      throw new Error('Cannot extend a cancelled pass');
    }

    if (pass.status === 'expired' || pass.pass_status === 'expired') {
      throw new Error('Cannot extend an expired pass. The pass has already ended.');
    }

    const currentEndDate = pass.visit_end_date || pass.visit_date;
    const visit_end_date = this.normalizeExtensionDate(newEndDate, currentEndDate);

    if (!pass.hostel_booking) {
      return {
        hasHostelBooking: false,
        passId: pass.pass_id,
        currentEndDate,
        proposedEndDate: visit_end_date,
        sameRoomAvailable: true,
        additionalNights: 0,
        additionalAmount: 0,
        requiresPayment: false,
        currentRoom: null,
        alternativeHostels: []
      };
    }

    const booking = pass.hostel_booking;
    if (!booking.room_id || !booking.check_in_datetime || !booking.check_out_datetime) {
      throw new Error('Guest house booking data is incomplete. Please contact admin.');
    }

    const extensionStart = new Date(booking.check_out_datetime);
    const extensionCheckoutDeadline = this.normalizeCheckoutDeadlineDatetime(visit_end_date);
    const sameRoomAvailable = await this.isRoomAvailableForExtension(
      booking.room_id,
      booking.id,
      extensionStart,
      extensionCheckoutDeadline
    );

    const hostelBookingService = require('./hostelBooking.service');
    const availableHostels = await hostelBookingService.getAvailableHostels(
      extensionStart,
      extensionCheckoutDeadline,
      pass.created_by_id
    );

    const currentBillableDays = booking.billable_days || 1;
    const newBillableDays = this.calculateExtensionBillableDays(booking.check_in_datetime, extensionCheckoutDeadline);
    const additionalNights = Math.max(newBillableDays - currentBillableDays, 0);
    const pricePerDay = parseFloat(booking.price_per_day || booking.room?.price_per_night || 0);
    const additionalAmount = Number((additionalNights * pricePerDay).toFixed(2));

    return {
      hasHostelBooking: true,
      passId: pass.pass_id,
      bookingId: booking.id,
      currentEndDate,
      proposedEndDate: visit_end_date,
      sameRoomAvailable,
      requiresPayment: additionalAmount > 0,
      additionalNights,
      additionalAmount,
      currentRoom: {
        id: booking.room?.id,
        roomId: booking.room_id,
        roomNumber: booking.room?.room_number || booking.room_number,
        hostelId: booking.room?.hostel_id,
        hostelName: booking.room?.hostel?.name || booking.hostel_name,
        pricePerNight: parseFloat(booking.room?.price_per_night || booking.price_per_day || 0)
      },
      alternativeHostels: availableHostels
    };
  }

  /**
   * Step-2 confirm extension with same-room or alternate-room decision.
   */
  async confirmExtendPass(pass_id, newEndDate, extensionReason, decision = {}) {
    const pass = await prisma.gate_pass.findUnique({
      where: { pass_id },
      include: {
        hostel_bookings: {
          orderBy: {
            created_at: 'desc'
          },
          take: 1,
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        }
      }
    });

    if (!pass) {
      throw new Error('Pass not found');
    }

    pass.hostel_booking = (pass.hostel_bookings && pass.hostel_bookings[0]) || null;

    if (!pass.hostel_booking) {
      const updatedPass = await this.extendPass(pass_id, newEndDate, extensionReason);
      return {
        pass: updatedPass,
        extension: {
          hasHostelBooking: false,
          additionalNights: 0,
          additionalAmount: 0,
          requiresPayment: false
        }
      };
    }

    if (!extensionReason || !extensionReason.trim()) {
      throw new Error('Extension reason is required');
    }

    const options = await this.getExtendPassOptions(pass_id, newEndDate);
    const booking = pass.hostel_booking;
    const useSameRoom = decision.useSameRoom !== false;
    const selectedRoomId = decision.selectedRoomId || null;
    const visit_end_date = new Date(options.proposedEndDate);
    const extensionCheckoutDeadline = this.normalizeCheckoutDeadlineDatetime(visit_end_date);
    const checkout_qr_expires_at = new Date(visit_end_date.getTime() + 24 * 60 * 60 * 1000);

    let finalRoomId = booking.room_id;
    if (useSameRoom) {
      if (!options.sameRoomAvailable) {
        throw new Error('Current room is not available for selected extension date. Please choose another room.');
      }
    } else {
      if (!selectedRoomId) {
        throw new Error('Please select a room for extension.');
      }
      finalRoomId = selectedRoomId;
    }

    const extensionStart = new Date(booking.check_out_datetime);
    const finalRoom = await prisma.hostelRoom.findUnique({
      where: { id: finalRoomId },
      include: {
        hostel: true
      }
    });

    if (!finalRoom || !finalRoom.is_available) {
      throw new Error('Selected room is not available.');
    }

    const finalRoomAvailable = await this.isRoomAvailableForExtension(
      finalRoomId,
      booking.id,
      extensionStart,
      extensionCheckoutDeadline
    );

    if (!finalRoomAvailable) {
      throw new Error('Selected room is no longer available for extension period. Please re-check availability.');
    }

    const newBillableDays = this.calculateExtensionBillableDays(booking.check_in_datetime, extensionCheckoutDeadline);
    const newPricePerDay = parseFloat(finalRoom.price_per_night || booking.price_per_day || 0);
    const newTotalPrice = Number((newBillableDays * newPricePerDay).toFixed(2));
    const currentTotalPrice = parseFloat(booking.total_price || 0);
    const additionalAmount = Number(Math.max(newTotalPrice - currentTotalPrice, 0).toFixed(2));
    const requiresPayment = additionalAmount > 0;
    let additionalNightsResult = Math.max(newBillableDays - (booking.billable_days || 1), 0);
    let additionalAmountResult = additionalAmount;
    let requiresPaymentResult = requiresPayment;

    const hostelBookingService = require('./hostelBooking.service');

    await prisma.$transaction(async (tx) => {
      await tx.gate_pass.update({
        where: { pass_id },
        data: {
          visit_end_date: visit_end_date,
          checkout_qr_expires_at: checkout_qr_expires_at,
          extension_count: { increment: 1 },
          extension_reason: extensionReason,
          updated_at: new Date()
        }
      });

      if (finalRoom.id === booking.room_id) {
        const normalizedPaymentStatus = requiresPaymentResult
          ? 'pending'
          : (booking.payment_status === 'refunded' ? 'completed' : (booking.payment_status || 'completed'));

        const bookingPatch = {
          check_out_datetime: extensionCheckoutDeadline,
          billable_days: newBillableDays,
          price_per_day: newPricePerDay,
          total_price: newTotalPrice,
          booking_status: requiresPaymentResult ? 'pending' : 'confirmed',
          payment_status: normalizedPaymentStatus,
          room_cancel_request_status: null,
          room_cancel_request_reason: null,
          room_cancel_request_requested_at: null,
          room_cancel_request_reviewed_by_id: null,
          room_cancel_request_reviewed_at: null,
          room_cancel_request_reject_reason: null,
          updated_at: new Date()
        };

        if (requiresPaymentResult) {
          const paymentQR = await hostelBookingService.generatePaymentQR(booking.id, additionalAmount);
          bookingPatch.payment_qr_code = paymentQR;
          bookingPatch.payment_reference = `EXT-${booking.id.substring(0, 8).toUpperCase()}`;
        }

        await tx.hostelBooking.update({
          where: { id: booking.id },
          data: bookingPatch
        });
      } else {
        const extensionBillableDays = this.calculateExtensionBillableDays(extensionStart, extensionCheckoutDeadline);
        const extensionTotalPrice = Number((extensionBillableDays * newPricePerDay).toFixed(2));
        additionalNightsResult = extensionBillableDays;
        additionalAmountResult = extensionTotalPrice;
        requiresPaymentResult = additionalAmountResult > 0;

        const paymentQR = requiresPaymentResult
          ? await hostelBookingService.generatePaymentQR(booking.id, additionalAmountResult)
          : null;

        await tx.hostelBooking.create({
          data: {
            gate_pass: { connect: { id: pass.id } },
            room: { connect: { id: finalRoom.id } },
            room_number: finalRoom.room_number,
            hostel_name: finalRoom.hostel?.name || booking.hostel_name,
            check_in_datetime: extensionStart,
            check_out_datetime: extensionCheckoutDeadline,
            guest_count: booking.guest_count || 1,
            billable_days: extensionBillableDays,
            price_per_day: newPricePerDay,
            total_price: extensionTotalPrice,
            booking_status: requiresPaymentResult ? 'pending' : 'confirmed',
            payment_status: requiresPaymentResult ? 'pending' : 'completed',
            payment_qr_code: paymentQR,
            payment_reference: requiresPaymentResult ? `EXT-${booking.id.substring(0, 8).toUpperCase()}` : booking.payment_reference,
            created_by: { connect: { id: booking.created_by_id } }
          }
        });
      }
    });

    const updatedPass = await prisma.gate_pass.findUnique({
      where: { pass_id },
      include: {
        hostel_bookings: {
          orderBy: {
            created_at: 'desc'
          },
          take: 1,
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        },
        user_login_gate_pass_created_by_idTouser_login: {
          select: {
            id: true,
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

    return {
      pass: updatedPass,
      extension: {
        hasHostelBooking: true,
        usedSameRoom: finalRoom.id === booking.room_id,
        selectedRoomId: finalRoom.id,
        selectedRoomNumber: finalRoom.room_number,
        selectedHostelName: finalRoom.hostel?.name || booking.hostel_name,
        additionalNights: additionalNightsResult,
        additionalAmount: additionalAmountResult,
        requiresPayment: requiresPaymentResult
      }
    };
  }

  /**
   * Extend pass (modify existing pass with new entry time and date)
   */
  async extendPass(pass_id, newEndDate, extensionReason) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id },
        include: {
          hostel_bookings: {
            orderBy: {
              created_at: 'desc'
            },
            take: 1
          }
        }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.status === 'checked_out' || pass.pass_status === 'checked_out') {
        throw new Error('Cannot extend a pass that has been checked out');
      }

      if (pass.status === 'cancelled' || pass.pass_status === 'cancelled') {
        throw new Error('Cannot extend a cancelled pass');
      }

      if (pass.status === 'expired' || pass.pass_status === 'expired') {
        throw new Error('Cannot extend an expired pass. The pass has already ended.');
      }

      // Parse and normalize new end date
      const currentEndDate = pass.visit_end_date || pass.visit_date;
      const visit_end_date = this.normalizeExtensionDate(newEndDate, currentEndDate);

      const latestHostelBooking = (pass.hostel_bookings && pass.hostel_bookings[0]) || null;

      if (latestHostelBooking) {
        throw new Error('Guest house booking found. Please use extension check flow before confirming extension.');
      }

      // Calculate new checkout QR expiry (midnight of the day AFTER new visit_end_date)
      const checkout_qr_expires_at = new Date(visit_end_date.getTime() + 24 * 60 * 60 * 1000);
      console.log('[EXTEND PASS] New checkout QR expires at:', checkout_qr_expires_at.toISOString());

      // Use Prisma transaction to ensure both updates commit atomically
      await prisma.$transaction(async (tx) => {
        // Update gate pass
        await tx.gate_pass.update({
          where: { pass_id },
          data: {
            visit_end_date: visit_end_date,
            checkout_qr_expires_at: checkout_qr_expires_at,
            extension_count: { increment: 1 },
            extension_reason: extensionReason,
            updated_at: new Date()
          }
        });

        logger.info(`Gate pass updated: ${pass.pass_id}, new end date: ${visit_end_date.toISOString()}`);

        logger.info(`No hostel booking found for pass: ${pass.pass_id}`);
      });

      // Fetch fresh data with updated hostel booking
      const updatedPass = await prisma.gate_pass.findUnique({
        where: { pass_id },
        include: {
          hostel_bookings: {
            orderBy: {
              created_at: 'desc'
            },
            take: 1,
            include: {
              room: {
                include: {
                  hostel: true
                }
              }
            }
          },
          user_login_gate_pass_created_by_idTouser_login: {
            select: {
              id: true,
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

      logger.info(`Pass extended: ${pass.pass_id}, new end date: ${visit_end_date.toISOString()}, reason: ${extensionReason}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error extending pass:', error);
      throw error;
    }
  }

  /**
   * Helper: Create notifications
   */
  async createNotifications(gatePass) {
    try {
      const notifications = [];

      // Notification to visitor (email + whatsapp)
      if (gatePass.email) {
        notifications.push({
          gate_pass_id: gatePass.id,
          recipient_type: 'visitor',
          recipient_email: gatePass.email,
          recipient_phone: gatePass.mobile_number,
          notification_type: 'email',
          status: 'pending'
        });
      }

      notifications.push({
        gate_pass_id: gatePass.id,
        recipient_type: 'visitor',
        recipient_phone: gatePass.mobile_number,
        notification_type: 'whatsapp',
        status: 'pending'
      });

      // Security notification
      notifications.push({
        gate_pass_id: gatePass.id,
        recipient_type: 'security',
        notification_type: 'email',
        status: 'pending'
      });

      await prisma.gate_pass_notification.createMany({ data: notifications });
    } catch (error) {
      logger.error('Error creating notifications:', error);
    }
  }

  /**
   * Helper: Send entry notification
   */
  async sendEntryNotification(gatePass) {
    // Implement email/SMS sending logic here
    logger.info(`Entry notification sent for pass: ${gatePass.pass_id}`);
  }

  /**
   * Helper: Send denial notification
   */
  async sendDenialNotification(gatePass, reason) {
    // Implement email/SMS sending logic here
    logger.info(`Denial notification sent for pass: ${gatePass.pass_id}`);
  }

  /**
   * Get check-in history for guards
   */
  async getCheckInHistory(filters = {}) {
    try {
      const { date, status, guardId } = filters;
      const where = {};

      // Filter by date (default to today)
      if (date) {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        where.visit_date = {
          gte: startOfDay,
          lte: endOfDay
        };
      } else {
        // Default to today
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        where.visit_date = {
          gte: startOfDay,
          lte: endOfDay
        };
      }

      // Filter by status (checked_in or completed)
      if (status) {
        where.status = status;
      } else {
        // Show only checked_in and completed passes
        where.status = {
          in: ['checked_in', 'completed']
        };
      }

      // Get passes (simplified - no history includes)
      const passes = await prisma.gate_pass.findMany({
        where,
        orderBy: {
          actual_entry_time: 'desc'
        }
      });

      // Format response
      const formattedHistory = passes.map(pass => {
        return {
          pass_id: pass.pass_id,
          visitor_name: pass.visitor_name,
          mobile_number: pass.mobile_number,
          visit_date: pass.visit_date,
          expected_entry_time: pass.expected_entry_time,
          expected_exit_time: pass.expected_exit_time,
          actual_entry_time: pass.actual_entry_time,
          actual_exit_time: pass.actual_exit_time,
          status: pass.status,
          department_to_visit: pass.department_to_visit,
          person_to_meet_name: pass.person_to_meet_name,
          purpose_of_visit: pass.purpose_of_visit,
          vehicle_number: pass.vehicle_number,
          entryGuard: null,
          exitGuard: null
        };
      });

      return {
        total: formattedHistory.length,
        history: formattedHistory
      };
    } catch (error) {
      logger.error('Error fetching check-in history:', error);
      throw error;
    }
  }

  /**
   * Export check-in history to Excel
   */
  async exportToExcel(filters = {}) {
    try {
      // Get history data
      const { history } = await this.getCheckInHistory(filters);

      // Prepare data for Excel
      const excelData = history.map(pass => ({
        'Pass ID': pass.pass_id,
        'Visitor Name': pass.visitor_name,
        'Mobile Number': pass.mobile_number,
        'Visit Date': new Date(pass.visit_date).toLocaleDateString(),
        'Expected Entry': pass.expected_entry_time,
        'Expected Exit': pass.expected_exit_time,
        'Actual Entry': pass.actual_entry_time ? new Date(pass.actual_entry_time).toLocaleTimeString() : '-',
        'Actual Exit': pass.actual_exit_time ? new Date(pass.actual_exit_time).toLocaleTimeString() : '-',
        'Status': pass.status.toUpperCase(),
        'Department': pass.department_to_visit,
        'Person to Meet': pass.person_to_meet_name || '-',
        'Purpose': pass.purpose_of_visit,
        'Vehicle Number': pass.vehicle_number || '-',
        'Entry Guard': pass.entryGuard?.name || '-',
        'Exit Guard': pass.exitGuard?.name || '-'
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Pass ID
        { wch: 25 }, // Visitor Name
        { wch: 15 }, // Mobile
        { wch: 12 }, // Visit Date
        { wch: 12 }, // Expected Entry
        { wch: 12 }, // Expected Exit
        { wch: 15 }, // Actual Entry
        { wch: 15 }, // Actual Exit
        { wch: 12 }, // Status
        { wch: 20 }, // Department
        { wch: 25 }, // Person to Meet
        { wch: 20 }, // Purpose
        { wch: 15 }, // Vehicle
        { wch: 20 }, // Entry Guard
        { wch: 20 }  // Exit Guard
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Check-in History');

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      logger.info(`Excel export generated with ${excelData.length} records`);
      return excelBuffer;
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics data for Gate Entry module
   * @param {Object} filters - Filter options
   * @param {string} filters.dateFrom - Start date (YYYY-MM-DD)
   * @param {string} filters.dateTo - End date (YYYY-MM-DD)
   * @param {string} filters.purpose - Purpose filter
   * @param {string} filters.status - Status filter
   * @param {string} filters.vehicleType - Vehicle type filter
   * @returns {Object} Analytics data
   */
  async getAdvancedAnalytics(filters = {}) {
    try {
      const { dateFrom, dateTo, purpose, status, vehicleType } = filters;

      const normalizedFilterKey = JSON.stringify({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        purpose: purpose || 'all',
        status: status || 'all',
        vehicleType: vehicleType || 'all'
      });
      const cacheKey = `${cache.CACHE_KEYS.ANALYTICS}gate-entry:advanced:${normalizedFilterKey}`;
      const cachedAnalytics = await cache.get(cacheKey);
      if (cachedAnalytics) {
        return cachedAnalytics;
      }

      // Build where clause based on filters
      const whereClause = {};

      if (dateFrom || dateTo) {
        whereClause.visit_date = {};
        if (dateFrom) whereClause.visit_date.gte = new Date(dateFrom);
        if (dateTo) whereClause.visit_date.lte = new Date(dateTo);
      }

      if (purpose && purpose !== 'all') {
        whereClause.purpose_of_visit = purpose;
      }

      if (status && status !== 'all') {
        whereClause.pass_status = status;
      }

      if (vehicleType && vehicleType !== 'all') {
        if (vehicleType === 'none') {
          whereClause.has_vehicle = false;
        } else {
          whereClause.has_vehicle = true;
          whereClause.vehicle_type = vehicleType;
        }
      }

      // Get today's date for "today" specific stats
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setUTCHours(0, 0, 0, 0);
      const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(todayIST);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // RUN ALL QUERIES IN PARALLEL FOR MAXIMUM SPEED
      const [
        // Overview stats (8 counts)
        total,
        activeToday,
        checkedInNow,
        completedToday,
        totalCompleted,
        pending,
        expired,
        cancelled,

        // Grouping queries
        byPurpose,
        byStatus,
        vehiclesByType,

        // Aggregate queries
        totalWithVehicle,
        totalWithoutVehicle,
        extensionStats,

        // Group by queries for performance
        guardCheckIns,
        guardCheckOuts,
        dailyPasses,
        passCreators,

        // Recent data
        recentActivity,

        // Guest House stats
        guestHouseBookingCount,
        guestHouseRevenueAgg,
        guestHouseByStatus,
        topGuestHouses,
        recentBookings,
        refundStats,
        checkedInVisitors
      ] = await Promise.all([
        // 1-8: Overview counts
        prisma.gate_pass.count({ where: whereClause }),
        prisma.gate_pass.count({
          where: {
            ...whereClause,
            pass_status: 'created',
            visit_date: { gte: todayIST, lt: tomorrowIST }
          }
        }),
        prisma.gate_pass.count({
          where: { ...whereClause, pass_status: 'checked_in' }
        }),
        prisma.gate_pass.count({
          where: {
            ...whereClause,
            pass_status: 'checked_out',
            actual_exit_time: { gte: todayIST, lt: tomorrowIST }
          }
        }),
        prisma.gate_pass.count({
          where: { ...whereClause, pass_status: 'checked_out' }
        }),
        prisma.gate_pass.count({
          where: {
            ...whereClause,
            pass_status: { in: ['created', 'checked_in'] }
          }
        }),
        prisma.gate_pass.count({
          where: { ...whereClause, pass_status: 'expired' }
        }),
        prisma.gate_pass.count({
          where: { ...whereClause, pass_status: 'cancelled' }
        }),

        // 8-10: Group by queries
        prisma.gate_pass.groupBy({
          by: ['purpose_of_visit'],
          _count: true,
          where: whereClause
        }),
        prisma.gate_pass.groupBy({
          by: ['pass_status'],
          _count: true,
          where: whereClause
        }),
        prisma.gate_pass.groupBy({
          by: ['vehicle_type'],
          _count: true,
          where: {
            ...whereClause,
            has_vehicle: true,
            vehicle_type: { not: null }
          }
        }),

        // 11-12: Vehicle counts
        prisma.gate_pass.count({
          where: { ...whereClause, has_vehicle: true }
        }),
        prisma.gate_pass.count({
          where: { ...whereClause, has_vehicle: false }
        }),

        // 13: Extension stats
        prisma.gate_pass.aggregate({
          _sum: { extension_count: true },
          _avg: { extension_count: true },
          _count: { extension_count: true },
          where: {
            ...whereClause,
            extension_count: { gt: 0 }
          }
        }),

        // 14-15: Guard performance
        prisma.gate_pass.groupBy({
          by: ['entry_guard_id'],
          _count: true,
          where: {
            ...whereClause,
            entry_guard_id: { not: null }
          }
        }),
        prisma.gate_pass.groupBy({
          by: ['exit_guard_id'],
          _count: true,
          where: {
            ...whereClause,
            exit_guard_id: { not: null }
          }
        }),

        // 16: Daily trend (last 30 days)
        prisma.gate_pass.groupBy({
          by: ['visit_date'],
          _count: true,
          where: {
            visit_date: { gte: thirtyDaysAgo, lte: todayIST }
          },
          orderBy: {
            visit_date: 'asc'
          }
        }),

        // 17: Top creators
        prisma.gate_pass.groupBy({
          by: ['created_by_id'],
          _count: true,
          where: whereClause,
          orderBy: {
            _count: {
              created_by_id: 'desc'
            }
          },
          take: 10
        }),

        // 18: Recent activity (only last 10 for speed)
        prisma.gate_pass_history.findMany({
          take: 10,
          orderBy: { created_at: 'desc' },
          select: {
            action: true,
            created_at: true,
            remarks: true,
            gate_pass: {
              select: {
                pass_id: true,
                visitor_name: true
              }
            },
            user_login: {
              select: {
                uid: true,
                role: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                    firstName: true,
                    lastName: true
                  }
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }),

        // 19: Guest House total bookings
        prisma.hostelBooking.count(),

        // 20: Guest House revenue aggregate
        prisma.hostelBooking.aggregate({
          _sum: { total_price: true },
          _avg: { total_price: true },
        }),

        // 21: Guest House bookings by status
        prisma.hostelBooking.groupBy({
          by: ['booking_status'],
          _count: true,
        }),

        // 22: Top guest houses by bookings count + revenue
        prisma.hostelBooking.groupBy({
          by: ['hostel_name'],
          _count: true,
          _sum: { total_price: true },
          orderBy: { _count: { hostel_name: 'desc' } },
          take: 10,
        }),

        // 23: Recent bookings with full details (use room relation for names)
        prisma.hostelBooking.findMany({
          take: 20,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            hostel_name: true,
            room_number: true,
            check_in_datetime: true,
            check_out_datetime: true,
            billable_days: true,
            price_per_day: true,
            total_price: true,
            booking_status: true,
            payment_status: true,
            guest_count: true,
            created_at: true,
            room: {
              select: {
                room_number: true,
                hostel: { select: { name: true } }
              }
            },
            gate_pass: {
              select: {
                pass_id: true,
                visitor_name: true,
                mobile_number: true,
              }
            },
            refund_transactions: {
              select: {
                refund_amount: true,
                refund_status: true,
                cancellation_fee_amount: true,
                cancellation_fee_percent: true,
                original_amount: true,
                remarks: true,
              }
            }
          }
        }),

        // 24: Refund stats aggregate
        prisma.refundTransaction.aggregate({
          _count: true,
          _sum: { refund_amount: true, original_amount: true, cancellation_fee_amount: true },
        }),

        // 25: Currently checked-in visitors (inside campus right now)
        prisma.gate_pass.findMany({
          where: { pass_status: 'checked_in' },
          orderBy: { actual_entry_time: 'desc' },
          take: 50,
          select: {
            pass_id: true,
            visitor_name: true,
            mobile_number: true,
            purpose_of_visit: true,
            actual_entry_time: true,
            entry_gate: true,
            number_of_persons: true,
            has_vehicle: true,
            vehicle_type: true,
            vehicle_number: true,
            person_to_meet_name: true,
            department_to_visit: true,
          }
        })
      ]);

      // Process data after all queries complete
      const purposeData = byPurpose.map(item => ({
        purpose: item.purpose_of_visit || 'other',
        count: item._count
      }));

      const statusData = byStatus.map(item => ({
        status: item.pass_status || 'created',
        count: item._count
      }));

      const vehicleStats = {
        total: totalWithVehicle,
        withoutVehicle: totalWithoutVehicle,
        twoWheeler: vehiclesByType.find(v => v.vehicle_type === 'two_wheeler')?._count || 0,
        fourWheeler: vehiclesByType.find(v => v.vehicle_type === 'four_wheeler')?._count || 0,
        other: vehiclesByType.find(v => v.vehicle_type === 'other')?._count || 0
      };

      const totalExtensions = extensionStats._sum.extension_count || 0;
      const avgExtensionCount = extensionStats._avg.extension_count || 0;
      const extensionRate = total > 0 ? ((extensionStats._count.extension_count || 0) / total * 100).toFixed(2) : 0;

      const dailyTrend = dailyPasses.map(item => ({
        date: item.visit_date.toISOString().split('T')[0],
        count: item._count
      }));

      // Process guard names (fetch separately for only top 10 guards)
      const guardIds = [
        ...new Set([
          ...guardCheckIns.slice(0, 10).map(g => g.entry_guard_id),
          ...guardCheckOuts.slice(0, 10).map(g => g.exit_guard_id)
        ])
      ].filter(Boolean);

      const guards = guardIds.length > 0 ? await prisma.userLogin.findMany({
        where: { id: { in: guardIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true
            }
          },
          studentLogin: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }) : [];

      const guardMap = {};
      guards.forEach(g => {
        let name = 'Unknown';
        if (g.employeeDetails) {
          name = g.employeeDetails.displayName ||
            `${g.employeeDetails.firstName} ${g.employeeDetails.lastName || ''}`.trim();
        } else if (g.studentLogin) {
          name = `${g.studentLogin.firstName} ${g.studentLogin.lastName || ''}`.trim();
        } else {
          name = g.uid;
        }
        guardMap[g.id] = name;
      });

      const guardData = {};
      guardCheckIns.slice(0, 10).forEach(g => {
        if (!guardData[g.entry_guard_id]) {
          guardData[g.entry_guard_id] = { checkIns: 0, checkOuts: 0 };
        }
        guardData[g.entry_guard_id].checkIns = g._count;
      });

      guardCheckOuts.slice(0, 10).forEach(g => {
        if (!guardData[g.exit_guard_id]) {
          guardData[g.exit_guard_id] = { checkIns: 0, checkOuts: 0 };
        }
        guardData[g.exit_guard_id].checkOuts = g._count;
      });

      const guardPerformance = Object.keys(guardData).map(guardId => ({
        guardId,
        guardName: guardMap[guardId] || 'Unknown',
        checkIns: guardData[guardId].checkIns,
        checkOuts: guardData[guardId].checkOuts,
        total: guardData[guardId].checkIns + guardData[guardId].checkOuts
      })).sort((a, b) => b.total - a.total).slice(0, 10);

      // Process activity log
      const activityLog = recentActivity.map(activity => {
        let performedBy = 'System';
        if (activity.user_login) {
          if (activity.user_login.employeeDetails) {
            performedBy = activity.user_login.employeeDetails.displayName ||
              `${activity.user_login.employeeDetails.firstName} ${activity.user_login.employeeDetails.lastName || ''}`.trim();
          } else if (activity.user_login.studentLogin) {
            performedBy = `${activity.user_login.studentLogin.firstName} ${activity.user_login.studentLogin.lastName || ''}`.trim();
          } else {
            performedBy = activity.user_login.uid;
          }
        }
        return {
          passId: activity.gate_pass?.pass_id || 'N/A',
          visitorName: activity.gate_pass?.visitor_name || 'N/A',
          action: activity.action,
          performedBy,
          role: activity.user_login?.role || 'system',
          timestamp: activity.created_at,
          remarks: activity.remarks
        };
      });

      // Process creator info (fetch separately)
      const creatorIds = passCreators.map(c => c.created_by_id).filter(Boolean);
      const creators = creatorIds.length > 0 ? await prisma.userLogin.findMany({
        where: { id: { in: creatorIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              primaryDepartment: {
                select: {
                  departmentName: true
                }
              }
            }
          },
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
              program: {
                select: {
                  department: {
                    select: {
                      departmentName: true
                    }
                  }
                }
              }
            }
          }
        }
      }) : [];

      const creatorMap = {};
      creators.forEach(c => {
        let name = 'Unknown';
        let deptName = 'N/A';

        if (c.employeeDetails) {
          name = c.employeeDetails.displayName ||
            `${c.employeeDetails.firstName} ${c.employeeDetails.lastName || ''}`.trim();
          deptName = c.employeeDetails.primaryDepartment?.departmentName || 'N/A';
        } else if (c.studentLogin) {
          name = `${c.studentLogin.firstName} ${c.studentLogin.lastName || ''}`.trim();
          deptName = c.studentLogin.program?.department?.departmentName || 'Student';
        } else {
          name = c.uid;
        }

        creatorMap[c.id] = {
          name,
          department: deptName
        };
      });

      const topCreators = passCreators.map(c => ({
        creatorId: c.created_by_id,
        creatorName: creatorMap[c.created_by_id]?.name || 'Unknown',
        department: creatorMap[c.created_by_id]?.department || 'N/A',
        passesCreated: c._count
      }));

      // Process Guest House data
      const guestHouseStatsData = {
        totalBookings: guestHouseBookingCount,
        totalRevenue: parseFloat(guestHouseRevenueAgg._sum.total_price || 0),
        avgRevenue: parseFloat(guestHouseRevenueAgg._avg.total_price || 0),
        pending: guestHouseByStatus.find(s => s.booking_status === 'pending')?._count || 0,
        confirmed: guestHouseByStatus.find(s => s.booking_status === 'confirmed')?._count || 0,
        cancelled: guestHouseByStatus.find(s => s.booking_status === 'cancelled')?._count || 0,
        completed: guestHouseByStatus.find(s => s.booking_status === 'completed')?._count || 0,
      };

      const topGuestHousesData = topGuestHouses
        .filter(h => h.hostel_name)
        .map(h => ({
          name: h.hostel_name,
          bookings: h._count,
          revenue: parseFloat(h._sum.total_price || 0),
        }));

      const recentBookingsData = recentBookings.map(b => ({
        id: b.id,
        guestHouse: b.hostel_name || b.room?.hostel?.name || 'N/A',
        roomNumber: b.room_number || b.room?.room_number || 'N/A',
        checkIn: b.check_in_datetime,
        checkOut: b.check_out_datetime,
        visitorName: b.gate_pass?.visitor_name || 'N/A',
        visitorPhone: b.gate_pass?.mobile_number || '',
        passId: b.gate_pass?.pass_id || 'N/A',
        totalPrice: parseFloat(b.total_price || 0),
        bookingStatus: b.booking_status || 'pending',
        paymentStatus: b.payment_status || 'pending',
        guestCount: b.guest_count,
        createdAt: b.created_at,
        refund: b.refund_transactions.length > 0 ? {
          refundAmount: b.refund_transactions[0].refund_amount,
          refundStatus: b.refund_transactions[0].refund_status,
          cancellationFee: b.refund_transactions[0].cancellation_fee_amount,
          cancellationFeePercent: b.refund_transactions[0].cancellation_fee_percent,
          originalAmount: b.refund_transactions[0].original_amount,
          remarks: b.refund_transactions[0].remarks,
        } : (b.payment_status === 'refunded' ? {
          refundAmount: parseFloat(b.total_price || 0),
          refundStatus: 'processed',
          cancellationFee: 0,
          cancellationFeePercent: 0,
          originalAmount: parseFloat(b.total_price || 0),
          remarks: 'Refunded',
        } : null),
      }));

      // Process checked-in visitors
      const checkedInVisitorsData = checkedInVisitors.map(v => ({
        passId: v.pass_id,
        visitorName: v.visitor_name,
        phone: v.mobile_number,
        purpose: v.purpose_of_visit,
        entryTime: v.actual_entry_time,
        entryGate: v.entry_gate || 'N/A',
        persons: v.number_of_persons,
        hasVehicle: v.has_vehicle,
        vehicleType: v.vehicle_type,
        vehicleNumber: v.vehicle_number,
        personToMeet: v.person_to_meet_name || 'N/A',
        department: v.department_to_visit || 'N/A',
      }));

      const refundStatsData = {
        totalRefunds: refundStats._count,
        totalRefundAmount: refundStats._sum.refund_amount || 0,
        totalOriginalAmount: refundStats._sum.original_amount || 0,
        totalCancellationFees: refundStats._sum.cancellation_fee_amount || 0,
      };

      // Return comprehensive analytics
      const analyticsPayload = {
        overview: {
          total,
          activeToday,
          checkedInNow,
          completedToday,
          totalCompleted,
          pending,
          expired,
          cancelled
        },
        byPurpose: purposeData,
        byStatus: statusData,
        vehicleStats,
        extensionStats: {
          totalExtensions,
          avgExtensionCount: parseFloat(avgExtensionCount.toFixed(2)),
          extensionRate: parseFloat(extensionRate)
        },
        guardPerformance,
        dailyTrend,
        recentActivity: activityLog,
        topCreators,
        guestHouseStats: guestHouseStatsData,
        topGuestHouses: topGuestHousesData,
        recentBookings: recentBookingsData,
        refundStats: refundStatsData,
        checkedInVisitors: checkedInVisitorsData,
        filters: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          purpose: purpose || 'all',
          status: status || 'all',
          vehicleType: vehicleType || 'all'
        }
      };

      await cache.set(cacheKey, analyticsPayload, cache.CACHE_TTL.ANALYTICS);
      return analyticsPayload;
    } catch (error) {
      logger.error('Error fetching advanced analytics:', error);
      throw error;
    }
  }

  /**
   * Get system configuration by key
   * @param {string} configKey - The configuration key to retrieve
   */
  async getSystemConfig(configKey) {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { config_key: configKey }
      });

      if (!config) {
        return null;
      }

      return {
        key: config.config_key,
        value: config.config_value,
        type: config.config_type,
        description: config.description,
        updated_at: config.updated_at
      };
    } catch (error) {
      logger.error('Error fetching system config:', error);
      throw error;
    }
  }

  /**
   * Update system configuration
   * @param {string} configKey - The configuration key to update
   * @param {string} configValue - The new value
   * @param {string} userId - User making the update (must be admin)
   */
  async updateSystemConfig(configKey, configValue, userId) {
    try {
      // Verify user is admin
      const user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role?.toLowerCase() !== 'admin') {
        throw new Error('Only administrators can update system configuration');
      }

      // Validate value based on config type
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { config_key: configKey }
      });

      if (!existingConfig) {
        throw new Error(`Configuration key '${configKey}' not found`);
      }

      // Type-specific validation
      if (existingConfig.config_type === 'PERCENTAGE') {
        const numValue = parseFloat(configValue);
        if (isNaN(numValue) || numValue < 0 || numValue > 100) {
          throw new Error('Percentage value must be between 0 and 100');
        }
      } else if (existingConfig.config_type === 'NUMBER') {
        const numValue = parseFloat(configValue);
        if (isNaN(numValue)) {
          throw new Error('Value must be a valid number');
        }
      } else if (existingConfig.config_type === 'BOOLEAN') {
        if (!['true', 'false', '1', '0'].includes(configValue.toLowerCase())) {
          throw new Error('Boolean value must be true/false or 1/0');
        }
      }

      // Update configuration
      const updatedConfig = await prisma.systemConfig.update({
        where: { config_key: configKey },
        data: {
          config_value: configValue,
          updated_at: new Date()
        }
      });

      logger.info(`[SYSTEM CONFIG] Updated ${configKey} = ${configValue} by user ${userId}`);

      return {
        key: updatedConfig.config_key,
        value: updatedConfig.config_value,
        type: updatedConfig.config_type,
        description: updatedConfig.description,
        updated_at: updatedConfig.updated_at
      };
    } catch (error) {
      logger.error('Error updating system config:', error);
      throw error;
    }
  }

  /**
   * Get all system configurations (admin only)
   */
  async getAllSystemConfigs(userId) {
    try {
      // Verify user is admin
      const user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role?.toLowerCase() !== 'admin') {
        throw new Error('Only administrators can view all system configurations');
      }

      const configs = await prisma.systemConfig.findMany({
        orderBy: { config_key: 'asc' }
      });

      return configs.map(c => ({
        key: c.config_key,
        value: c.config_value,
        type: c.config_type,
        description: c.description,
        updated_at: c.updated_at
      }));
    } catch (error) {
      logger.error('Error fetching all system configs:', error);
      throw error;
    }
  }
}

module.exports = new GatePassService();
