const prisma = require('../../../shared/config/database');
const QRCode = require('qrcode');
const XLSX = require('xlsx');
const { hasViewAllPermission } = require('../../../shared/middleware/gateEntryAuth');

// Simple logger
const logger = {
  info: (msg, data) => console.log('[INFO]', msg, data || ''),
  error: (msg, error) => console.error('[ERROR]', msg, error)
};

class GatePassService {
  /**
   * Transform snake_case fields to camelCase for frontend
   */
  transformPassToFrontend(pass) {
    if (!pass) return null;
    
    console.log(`[TRANSFORM INPUT] Pass ${pass.pass_id}: extension_count=${pass.extension_count}, extension_reason="${pass.extension_reason}"`);
    
    // For multiday passes with hostel booking, use check_out_date as visitEndDate
    let visitEndDate = pass.visit_end_date;
    if (pass.hostel_booking?.check_out_date) {
      visitEndDate = pass.hostel_booking.check_out_date;
      console.log(`[TRANSFORM] Pass ${pass.pass_id}: Using hostel check_out_date ${visitEndDate} instead of visit_end_date ${pass.visit_end_date}`);
    }
    
    // Format dates to ISO string for consistent frontend handling
    const formatDateForFrontend = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.toISOString();
      }
      return date;
    };
    
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
      visitEndDate: formatDateForFrontend(visitEndDate), // Use hostel check_out_date if available
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
      checkInDate: formatDateForFrontend(pass.check_in_date || pass.hostel_booking?.check_in_date),
      checkOutDate: formatDateForFrontend(pass.check_out_date || pass.hostel_booking?.check_out_date),
      hostelName: pass.hostel_booking?.room?.hostel?.name,
      roomNumber: pass.hostel_booking?.room?.room_number,
      createdAt: formatDateForFrontend(pass.created_at),
      updatedAt: formatDateForFrontend(pass.updated_at),
      createdBy: pass.user_login_gate_pass_created_by_idTouser_login,
      // Cancellation related fields
      cancellationType: pass.cancellation_type,
      hostelRefund: pass.hostel_refund,
      checkoutQr: pass.checkout_qr,
      hostelBooking: pass.hostel_booking ? {
        ...pass.hostel_booking,
        check_in_date: formatDateForFrontend(pass.hostel_booking.check_in_date),
        check_out_date: formatDateForFrontend(pass.hostel_booking.check_out_date),
        totalPrice: pass.hostel_booking.total_price,
        bookingStatus: pass.hostel_booking.booking_status,
        paymentStatus: pass.hostel_booking.payment_status,
        hostelName: pass.hostel_booking.room?.hostel?.name,
        roomNumber: pass.hostel_booking.room?.room_number
      } : null
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
            notIn: ['cancelled', 'expired', 'checked_out']
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
          purpose_of_visit: data.purpose_of_visit,
          purpose_other: data.purpose_other || null,
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
          status: 'active', // Legacy field
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
            hostel_booking: {
              select: {
                id: true,
                check_in_date: true,
                check_out_date: true,
                total_price: true,
                booking_status: true,
                payment_status: true,
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
      // Get today's date at midnight IST
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setUTCHours(0, 0, 0, 0);

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
          pass_status: { notIn: ['checked_out', 'cancelled', 'expired'] }
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

      // Get today's date at midnight IST (matching expirePastPasses logic)
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setUTCHours(0, 0, 0, 0);
      
      const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

      console.log('[STATS CHECK] Today IST:', todayIST.toISOString(), 'Tomorrow IST:', tomorrowIST.toISOString());

      const [total, active, pending, completed, expired] = await Promise.all([
        prisma.gate_pass.count({ where: whereBase }),
        // Active Today - active status on today's date
        prisma.gate_pass.count({ 
          where: { 
            ...whereBase,
            status: 'active', 
            visit_date: { gte: todayIST, lt: tomorrowIST }
          } 
        }),
        // Pending - all active and checked_in passes (not completed/cancelled/expired)
        prisma.gate_pass.count({ 
          where: { 
            ...whereBase,
            status: { in: ['active', 'checked_in', 'pending'] }
          } 
        }),
        // Completed
        prisma.gate_pass.count({ where: { ...whereBase, status: 'completed' } }),
        // Expired
        prisma.gate_pass.count({ where: { ...whereBase, status: 'expired' } })
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

      const where = {};

      if (searchType === 'pass_id') {
        where.pass_id = { equals: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'mobile') {
        where.mobile_number = searchTerm;
      } else if (searchType === 'name') {
        where.visitor_name = { contains: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'vehicle') {
        where.vehicle_number = { equals: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'checkout_qr') {
        // Handle checkout QR verification (for cancelled passes with new unique checkout ID)
        try {
          const qrData = JSON.parse(searchTerm);
          if (qrData.type === 'CHECKOUT' && qrData.checkout_id) {
            // Search by the NEW checkout_unique_id
            where.checkout_unique_id = qrData.checkout_id;
            logger.info(`[VERIFY] Checkout QR scanned with checkout ID: ${qrData.checkout_id}`);
          } else {
            throw new Error('Invalid checkout QR code format');
          }
        } catch (parseError) {
          throw new Error('Invalid QR code data');
        }
      }

      let pass = await prisma.gate_pass.findFirst({
        where
      });

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
          throw new Error('Checkout QR code has expired (1-hour validity)');
        }
        
        if (pass.pass_status !== 'cancelled') {
          throw new Error('This pass is not cancelled. Use regular checkout process.');
        }
        
        logger.info(`[VERIFY] Checkout QR valid for pass: ${pass.pass_id}, expires: ${pass.checkout_qr_expires_at}`);
        return pass;
      }

      // Real-time QR activation check (for regular check-in)
      // If pass is inactive and should be active now, activate it
      if (pass.qr_status === 'inactive' && pass.pass_status === 'created') {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const nowIST = new Date(now.getTime() + istOffset);
        const todayStr = nowIST.toISOString().split('T')[0];
        const visitDateStr = new Date(pass.visit_date).toISOString().split('T')[0];
        
        // Check if visit date is today
        if (visitDateStr === todayStr && pass.entry_time) {
          const [hours, minutes] = pass.entry_time.split(':').map(Number);
          const entryTimeInMinutes = hours * 60 + minutes;
          const currentTimeInMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
          const activationWindowMinutes = 5 * 60; // 5 hours
          
          // Activate if within activation window or entry time has passed
          if ((entryTimeInMinutes - currentTimeInMinutes) <= activationWindowMinutes) {
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

      // Check QR status - must be active to allow entry
      if (pass.qr_status !== 'active') {
        throw new Error('QR code is not active yet. QR becomes active 5 hours before entry time.');
      }

      // If verification code is provided, validate it
      if (entryData.verification_code) {
        if (pass.verification_code !== entryData.verification_code) {
          throw new Error('Invalid verification code');
        }
      }

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'checked_in', // Legacy field
          pass_status: 'checked_in',
          actual_entry_time: new Date(),
          entry_gate: entryData.gate,
          entry_guard_id: guardId,
          entry_remarks: entryData.remarks || null
        }
      });

      // Create history (skip for now due to schema issues)
      // await prisma.gate_pass_history.create({...});

      // Skip notification for now
      // await this.sendEntryNotification(updatedPass);

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

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'completed', // Legacy field
          pass_status: 'checked_out',
          actual_exit_time: new Date(),
          exit_gate: exitData.gate,
          exit_guard_id: guardId,
          exit_remarks: exitData.remarks || null
        }
      });

      // Skip history for now

      logger.info(`Exit recorded for pass: ${pass.pass_id}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error recording exit:', error);
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
        const hostelBooking = await prisma.hostelBooking.findUnique({
          where: { gate_pass_id: pass.id },
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
          const checkInDate = new Date(hostelBooking.check_in_date);
          
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

          // Store refund info (RefundTransaction table not available yet)
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

          logger.info(`[CANCEL BEFORE CHECK-IN] Hostel booking cancelled with refund`);

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

      // Check if pass is already cancelled or checked out
      if (pass.pass_status === 'cancelled') {
        throw new Error('Pass is already cancelled');
      }

      if (pass.pass_status === 'checked_out') {
        throw new Error('Pass is already checked out. Cannot cancel.');
      }

      logger.info(`[CANCEL PASS] User ${userId} (admin:${isAdmin}, guard:${isGuard}, creator:${isCreator}) cancelling pass ${pass_id}, Status: ${pass.pass_status}`);

      // Route to appropriate cancellation flow based on pass status
      if (pass.pass_status === 'created') {
        // Before check-in cancellation (no checkout QR needed)
        return await this.cancelBeforeCheckIn(pass, userId, reason);
      } else if (pass.pass_status === 'checked_in') {
        // After check-in cancellation (generates checkout QR)
        return await this.cancelAfterCheckIn(pass, userId, reason);
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

      logger.info(`[CANCEL AFTER CHECK-IN] Pass cancelled: ${updatedPass.pass_id}, checkout QR generated with 1-hour validity`);

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
      
      // Generate checkout QR data with new unique checkout ID
      const checkoutData = {
        type: 'CHECKOUT',
        checkout_id: checkoutUniqueId,
        checkout_verification_code: checkoutVerificationCode,
        original_pass_id: pass.pass_id,
        timestamp: timestamp,
        expiresAt: expiresAt.toISOString()
      };

      // Generate QR code as Data URL
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(checkoutData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        width: 300
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
          const expiredMinutes = Math.floor((now.getTime() - pass.checkout_qr_expires_at.getTime()) / (1000 * 60));
          throw new Error(`Checkout credentials expired ${expiredMinutes} minute(s) ago. Visitor must contact admin for new checkout credentials.`);
        }

        // Validate NEW checkout verification code (different from check-in code)
        if (exitData.verificationCode) {
          if (!pass.checkout_verification_code) {
            throw new Error('No checkout verification code found. Please scan the checkout QR code.');
          }
          if (exitData.verificationCode !== pass.checkout_verification_code) {
            throw new Error('Invalid checkout verification code. Please use the NEW code sent after cancellation.');
          }
        }
        
        logger.info(`[CHECKOUT] Cancelled pass checkout: ${pass.pass_id}, checkout ID: ${pass.checkout_unique_id}, QR expires: ${pass.checkout_qr_expires_at}`);
      } else if (pass.pass_status !== 'checked_out' && pass.pass_status !== 'cancelled') {
        throw new Error(`Cannot checkout pass with status: ${pass.pass_status}`);
      }

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'completed', // Legacy field
          pass_status: 'checked_out',
          actual_exit_time: new Date(),
          exit_gate: exitData.gate || 'Main Gate',
          exit_guard_id: guardId,
          exit_remarks: exitData.remarks || (pass.pass_status === 'cancelled' ? 'Emergency checkout via cancelled pass QR' : null),
          // Clear checkout QR fields
          checkout_qr_code: null,
          checkout_qr_expires_at: null
        }
      });

      logger.info(`[CHECKOUT] Successful checkout for pass: ${pass.pass_id}, Status was: ${pass.pass_status}`);
      return updatedPass;
    } catch (error) {
      logger.error('[CHECKOUT] Error:', error);
      throw error;
    }
  }

  /**
   * Extend pass (modify existing pass with new entry time and date)
   */
  async extendPass(pass_id, newEndDate, extensionReason) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id },
        include: {
          hostel_booking: true
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
      const endDateRaw = new Date(newEndDate);
      if (isNaN(endDateRaw.getTime())) {
        throw new Error('Invalid end date format');
      }
      
      const istOffset = 5.5 * 60 * 60 * 1000;
      const visit_end_date = new Date(endDateRaw.getTime() + istOffset);
      visit_end_date.setUTCHours(0, 0, 0, 0);

      // Validate new end date is after current end date or visit date
      const currentEndDate = pass.visit_end_date || pass.visit_date;
      if (visit_end_date <= currentEndDate) {
        throw new Error('New end date must be after current end date');
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

        // If pass has hostel booking, update check_out_date too
        if (pass.hostel_booking) {
          const updatedBooking = await tx.hostelBooking.update({
            where: { id: pass.hostel_booking.id },
            data: {
              check_out_date: visit_end_date,
              updated_at: new Date()
            }
          });
          
          logger.info(`✅ Hostel booking updated in transaction: ${pass.hostel_booking.id}, new check_out_date: ${visit_end_date.toISOString()}`);
          logger.info(`Updated booking data:`, updatedBooking);
        } else {
          logger.info(`No hostel booking found for pass: ${pass.pass_id}`);
        }
      });

      // Fetch fresh data with updated hostel booking
      const updatedPass = await prisma.gate_pass.findUnique({
        where: { pass_id },
        include: {
          hostel_booking: {
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
        recentActivity
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

      // Return comprehensive analytics
      return {
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
        filters: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          purpose: purpose || 'all',
          status: status || 'all',
          vehicleType: vehicleType || 'all'
        }
      };
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
