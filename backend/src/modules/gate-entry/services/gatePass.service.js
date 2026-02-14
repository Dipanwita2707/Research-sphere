const prisma = require('../../../shared/config/database');
const QRCode = require('qrcode');
const XLSX = require('xlsx');

// Simple logger
const logger = {
  info: (msg, data) => console.log('[INFO]', msg, data || ''),
  error: (msg, error) => console.error('[ERROR]', msg, error)
};

class GatePassService {
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
      // Auto-expire past date passes before fetching
      await this.expirePastPasses();

      const {
        search,
        status,
        dateFilter,
        page = 1,
        limit = 50,
        userId
      } = filters;

      // Check user role for filtering
      let showAllPasses = false;
      if (userId) {
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

        if (user) {
          const role = user.role?.toLowerCase() || '';
          const designation = user.employeeDetails?.designation?.toLowerCase() || '';
          
          const isAdmin = role === 'admin';
          const isGuard = designation.includes('guard') || designation.includes('security') || designation.includes('volunteer');
          
          // Admin and Guards see all passes
          showAllPasses = isAdmin || isGuard;
          
          console.log(`[PASS FILTER] User: ${userId}, Role: ${role}, Designation: ${designation}, ShowAll: ${showAllPasses}`);
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

      const passes = await prisma.gate_pass.findMany({
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

      const total = await prisma.gate_pass.count({ where });

      return {
        passes,
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
      const result = await prisma.gate_pass.updateMany({
        where: {
          visit_date: { lt: todayIST },
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

      // Determine if user should see all passes or only their own
      let showAllPasses = false;
      
      if (userId) {
        const user = await prisma.userLogin.findUnique({
          where: { id: userId },
          select: {
            role: true,
            employeeDetails: {
              select: {
                designation: true
              }
            }
          }
        });

        if (user) {
          const role = user.role?.toLowerCase() || '';
          const designation = user.employeeDetails?.designation?.toLowerCase() || '';
          
          const isAdmin = role === 'admin';
          const isGuard = designation.includes('guard') || designation.includes('security') || designation.includes('volunteer');
          
          // Admin and Guards see all passes
          showAllPasses = isAdmin || isGuard;
          
          console.log(`[STATS FILTER] User: ${userId}, Role: ${role}, Designation: ${designation}, ShowAll: ${showAllPasses}`);
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
      // Auto-expire past passes before verification
      await this.expirePastPasses();

      const where = {};

      if (searchType === 'pass_id') {
        where.pass_id = { equals: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'mobile') {
        where.mobile_number = searchTerm;
      } else if (searchType === 'name') {
        where.visitor_name = { contains: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'vehicle') {
        where.vehicle_number = { equals: searchTerm, mode: 'insensitive' };
      }

      let pass = await prisma.gate_pass.findFirst({
        where
      });

      if (!pass) {
        return null;
      }

      // Real-time QR activation check
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
   * Cancel pass
   */
  async cancelPass(pass_id, userId, reason) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      // Generate checkout QR code
      const checkoutQRData = await this.generateCheckoutQR(pass.id);

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'cancelled', // Legacy field
          pass_status: 'cancelled',
          qr_status: 'cancelled',
          cancellation_time: new Date(),
          checkout_qr_code: checkoutQRData.qr_code,
          checkout_qr_expires_at: checkoutQRData.expires_at
        }
      });

      // Skip history for now

      logger.info(`Pass cancelled: ${updatedPass.pass_id}`);
      return {
        ...updatedPass,
        checkout_qr: {
          qr_code: checkoutQRData.qr_code,
          expires_at: checkoutQRData.expires_at,
          expires_in_minutes: 60
        }
      };
    } catch (error) {
      logger.error('Error cancelling pass:', error);
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
   * Generate checkout QR code (valid for 1 hour)
   */
  async generateCheckoutQR(passId) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { id: passId }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      const timestamp = Date.now();
      const expiresAt = new Date(timestamp + 60 * 60 * 1000); // 1 hour from now
      
      // Generate unique checkout QR data
      const checkoutData = {
        type: 'CHECKOUT',
        passId: pass.id,
        pass_id: pass.pass_id,
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

      logger.info(`Checkout QR generated for pass: ${pass.pass_id}, expires at: ${expiresAt.toISOString()}`);

      return {
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

      // Validate checkout QR exists and not expired
      if (!pass.checkout_qr_code || !pass.checkout_qr_expires_at) {
        throw new Error('No checkout QR code found. Please cancel the pass first.');
      }

      const now = new Date();
      if (now > pass.checkout_qr_expires_at) {
        throw new Error('Checkout QR code has expired. Please generate a new one by cancelling again.');
      }

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          status: 'completed', // Legacy field
          pass_status: 'checked_out',
          actual_exit_time: now,
          exit_gate: exitData.gate,
          exit_guard_id: guardId,
          exit_remarks: exitData.remarks || null,
          // Clear checkout QR fields
          checkout_qr_code: null,
          checkout_qr_expires_at: null
        }
      });

      logger.info(`Checkout recorded for pass: ${pass.pass_id}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error recording checkout:', error);
      throw error;
    }
  }

  /**
   * Extend pass (modify existing pass with new entry time and date)
   */
  async extendPass(pass_id, newEntryTime, newVisitDate) {
    try {
      const pass = await prisma.gate_pass.findUnique({
        where: { pass_id }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.pass_status === 'checked_out') {
        throw new Error('Cannot extend a pass that has been checked out');
      }

      // Parse and normalize new visit date
      const visitDateRaw = new Date(newVisitDate);
      if (isNaN(visitDateRaw.getTime())) {
        throw new Error('Invalid visit date format');
      }
      
      const istOffset = 5.5 * 60 * 60 * 1000;
      const visit_date = new Date(visitDateRaw.getTime() + istOffset);
      visit_date.setUTCHours(0, 0, 0, 0);

      // Regenerate QR code with same pass_id
      const qrCodeDataURL = await this.generateQRCode(pass_id);

      const updatedPass = await prisma.gate_pass.update({
        where: { pass_id },
        data: {
          entry_time: newEntryTime,
          expected_entry_time: newEntryTime, // Backward compatibility
          visit_date: visit_date,
          qr_code: qrCodeDataURL,
          qr_status: 'inactive', // Will be activated 5 hours before new entry time
          qr_activation_time: null,
          extension_count: { increment: 1 },
          updated_at: new Date()
        }
      });

      logger.info(`Pass extended: ${pass.pass_id}, new entry: ${newEntryTime}, new date: ${visit_date.toISOString()}`);
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
}

module.exports = new GatePassService();
