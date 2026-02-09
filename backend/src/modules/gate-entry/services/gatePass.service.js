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
    const count = await prisma.gatePass.count({
      where: {
        passId: {
          startsWith: `UNI-PASS-${today}`
        }
      }
    });
    
    const sequenceNumber = (count + 1).toString().padStart(3, '0');
    return `UNI-PASS-${today}-${sequenceNumber}`;
  }

  /**
   * Generate QR Code for gate pass
   */
  async generateQRCode(passId) {
    try {
      // Generate QR code as Data URL (base64 image)
      const qrCodeDataURL = await QRCode.toDataURL(passId, {
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
  async checkPersonAvailability(personToMeetId, visitDate, entryTime, exitTime) {
    if (!personToMeetId) {
      return null; // No conflict if no person to meet specified
    }

    // Get the start and end of the visit date in IST
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const visitDateObj = new Date(visitDate);
    
    // Create IST midnight for the visit date
    const startOfDayIST = new Date(visitDateObj.getTime() + istOffset);
    startOfDayIST.setUTCHours(0, 0, 0, 0);
    
    // Create IST end of day
    const endOfDayIST = new Date(startOfDayIST.getTime() + 24 * 60 * 60 * 1000 - 1);

    console.log('[CONFLICT CHECK] Person:', personToMeetId, 'Date Range:', startOfDayIST.toISOString(), '-', endOfDayIST.toISOString());

    // Find conflicting passes for the same person on the same day
    const conflicts = await prisma.gatePass.findMany({
      where: {
        personToMeetId: personToMeetId,
        visitDate: {
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
              { expectedEntryTime: { lte: entryTime } },
              { expectedExitTime: { gt: entryTime } }
            ]
          },
          // New visit ends during existing visit
          {
            AND: [
              { expectedEntryTime: { lt: exitTime } },
              { expectedExitTime: { gte: exitTime } }
            ]
          },
          // New visit completely contains existing visit
          {
            AND: [
              { expectedEntryTime: { gte: entryTime } },
              { expectedExitTime: { lte: exitTime } }
            ]
          }
        ]
      },
      include: {
        personToMeet: {
          include: {
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: {
        expectedEntryTime: 'asc'
      },
      take: 1
    });

    if (conflicts.length > 0) {
      console.log('[CONFLICT FOUND]', {
        personId: personToMeetId,
        conflictingPass: {
          passId: conflicts[0].passId,
          visitDate: conflicts[0].visitDate,
          entryTime: conflicts[0].expectedEntryTime,
          exitTime: conflicts[0].expectedExitTime
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
  async createPass(data, createdById) {
    try {
      // Validate required fields
      if (!data.visitorName || !data.mobileNumber || !data.idProofType || !data.idProofNumber) {
        throw new Error('Missing required visitor information');
      }
      
      if (!data.visitDate || !data.expectedEntryTime || !data.expectedExitTime) {
        throw new Error('Missing required visit timing information');
      }

      const passId = await this.generatePassId();
      
      // Parse and validate date - normalize to midnight IST
      const visitDateRaw = new Date(data.visitDate);
      if (isNaN(visitDateRaw.getTime())) {
        throw new Error('Invalid visit date format');
      }
      
      // Normalize to midnight IST to ensure consistent date storage
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const visitDate = new Date(visitDateRaw.getTime() + istOffset);
      visitDate.setUTCHours(0, 0, 0, 0);
      
      console.log('[CREATE PASS] Visit Date normalized to IST:', visitDate.toISOString());

      // Parse time strings (HH:MM format)
      const [entryHour, entryMinute] = data.expectedEntryTime.split(':').map(Number);
      const [exitHour, exitMinute] = data.expectedExitTime.split(':').map(Number);

      // Check for lunch time (1:00 PM - 2:00 PM)
      if ((entryHour >= 13 && entryHour < 14) || (exitHour >= 13 && exitHour < 14)) {
        throw new Error('This is lunch time (1:00 PM - 2:00 PM). Please schedule your visit before 1:00 PM or after 2:00 PM.');
      }

      // Fetch employee details if personToMeetId is provided
      let personToMeetName = data.personToMeetName || '';
      if (data.personToMeetId) {
        const employeeService = require('./employee.service');
        const employee = await employeeService.getEmployeeByUserLoginId(data.personToMeetId);
        
        if (!employee) {
          throw new Error('Selected employee not found or inactive');
        }
        
        personToMeetName = employee.name;

        // Check if person to meet is available at this time
        const conflictingPass = await this.checkPersonAvailability(
          data.personToMeetId,
          visitDate,
          data.expectedEntryTime,
          data.expectedExitTime
        );

        if (conflictingPass) {
          const suggestedTime = this.getSuggestedTime(conflictingPass.expectedExitTime);
          throw new Error(
            `${personToMeetName} is not available during ${data.expectedEntryTime} - ${data.expectedExitTime}. ` +
            `They have another meeting scheduled. Please schedule after ${suggestedTime}.`
          );
        }
      }
      
      // Generate QR Code
      const qrCodeDataURL = await this.generateQRCode(passId);
      
      // Create the pass
      const gatePass = await prisma.gatePass.create({
        data: {
          passId,
          qrCode: qrCodeDataURL,
          // Visitor details
          visitorName: data.visitorName,
          mobileNumber: data.mobileNumber,
          email: data.email || null,
          idProofType: data.idProofType,
          idProofNumber: data.idProofNumber,
          photoFilePath: data.photoFilePath || null,
          photo: data.photo || null,
          gender: data.gender || null,
          age: data.age ? parseInt(data.age) : null,
          
          // Visit details
          purposeOfVisit: data.purposeOfVisit,
          purposeOther: data.purposeOther || null,
          departmentToVisit: data.departmentToVisit,
          personToMeetId: data.personToMeetId || null,
          personToMeetName: personToMeetName,
          visitDate: visitDate,
          expectedEntryTime: data.expectedEntryTime,
          expectedExitTime: data.expectedExitTime,
          
          // Vehicle details
          hasVehicle: data.hasVehicle || false,
          vehicleType: data.vehicleType || null,
          vehicleNumber: data.vehicleNumber || null,
          vehicleModel: data.vehicleModel || null,
          
          // Additional info
          numberOfPersons: parseInt(data.numberOfPersons) || 1,
          itemsCarrying: data.itemsCarrying || null,
          specialInstructions: data.specialInstructions || null,
          
          // Status
          status: 'active',
          
          // Creator
          createdById
        },
        include: {
          createdBy: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true
                }
              }
            }
          }
        }
      });

      // Create history entry
      await prisma.gatePassHistory.create({
        data: {
          gatePassId: gatePass.id,
          action: 'created',
          performedById: createdById,
          remarks: 'Pass created successfully'
        }
      });

      // Create notifications (will be sent async) - Disabled for now
      // TODO: Enable after testing basic flow
      // await this.createNotifications(gatePass);

      // Display QR code and Pass ID in terminal for testing
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║           🎫 NEW GATE PASS CREATED                        ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Pass ID: ${passId.padEnd(42)}║`);
      console.log(`║ Visitor: ${gatePass.visitorName.padEnd(42)}║`);
      console.log(`║ Mobile:  ${gatePass.mobileNumber.padEnd(42)}║`);
      console.log(`║ Visit Date: ${visitDate.toISOString().split('T')[0].padEnd(38)}║`);
      console.log(`║ Entry Time: ${gatePass.expectedEntryTime.padEnd(38)}║`);
      console.log(`║ Exit Time:  ${gatePass.expectedExitTime.padEnd(38)}║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║ QR Code Data (Base64):                                    ║');
      console.log(`║ ${qrCodeDataURL.substring(0, 54)}...║`);
      console.log('║                                                            ║');
      console.log('║ ✅ Guard can scan this QR code or search by Pass ID       ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      logger.info(`Gate pass created: ${passId}`);
      return gatePass;
    } catch (error) {
      logger.error('Error creating gate pass:', error);
      throw error;
    }
  }

  /**
   * Get all gate passes with filters
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
        limit = 50
      } = filters;

      const where = {};

      // Search filter
      if (search) {
        where.OR = [
          { passId: { contains: search, mode: 'insensitive' } },
          { visitorName: { contains: search, mode: 'insensitive' } },
          { mobileNumber: { contains: search } },
          { vehicleNumber: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Status filter
      if (status && status !== 'all') {
        where.status = status;
      }

      // Date filter
      const today = new Date().toISOString().split('T')[0];
      if (dateFilter === 'today') {
        where.visitDate = new Date(today);
      } else if (dateFilter === 'upcoming') {
        where.visitDate = { gt: new Date(today) };
      } else if (dateFilter === 'past') {
        where.visitDate = { lt: new Date(today) };
      }

      const passes = await prisma.gatePass.findMany({
        where,
        include: {
          createdBy: {
            select: {
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          },
          personToMeet: {
            select: {
              employeeDetails: {
                select: {
                  displayName: true,
                  phoneNumber: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      });

      const total = await prisma.gatePass.count({ where });

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
      const result = await prisma.gatePass.updateMany({
        where: {
          visitDate: { lt: todayIST },
          status: { in: ['active', 'pending', 'checked_in'] }
        },
        data: {
          status: 'expired'
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
   */
  async getPassStats() {
    try {
      // Auto-expire past passes first
      await this.expirePastPasses();

      // Get today's date at midnight IST (matching expirePastPasses logic)
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setUTCHours(0, 0, 0, 0);
      
      const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

      console.log('[STATS CHECK] Today IST:', todayIST.toISOString(), 'Tomorrow IST:', tomorrowIST.toISOString());

      const [total, active, pending, completed, expired] = await Promise.all([
        prisma.gatePass.count(),
        // Active Today - active status on today's date
        prisma.gatePass.count({ 
          where: { 
            status: 'active', 
            visitDate: { gte: todayIST, lt: tomorrowIST }
          } 
        }),
        // Pending - all active and checked_in passes (not completed/cancelled/expired)
        prisma.gatePass.count({ 
          where: { 
            status: { in: ['active', 'checked_in', 'pending'] }
          } 
        }),
        // Completed
        prisma.gatePass.count({ where: { status: 'completed' } }),
        // Expired
        prisma.gatePass.count({ where: { status: 'expired' } })
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

      if (searchType === 'passId') {
        where.passId = { equals: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'mobile') {
        where.mobileNumber = searchTerm;
      } else if (searchType === 'name') {
        where.visitorName = { contains: searchTerm, mode: 'insensitive' };
      } else if (searchType === 'vehicle') {
        where.vehicleNumber = { equals: searchTerm, mode: 'insensitive' };
      }

      const pass = await prisma.gatePass.findFirst({
        where,
        include: {
          personToMeet: {
            select: {
              phone: true,
              employeeDetails: {
                select: {
                  displayName: true,
                  phoneNumber: true
                }
              }
            }
          },
          createdBy: {
            select: {
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          }
        }
      });

      if (!pass) {
        return null;
      }

      // Return pass with contact info
      return {
        ...pass,
        personToMeetContact: pass.personToMeet?.employeeDetails?.phoneNumber || 
                            pass.personToMeet?.phone || 
                            'N/A'
      };
    } catch (error) {
      logger.error('Error verifying pass:', error);
      throw error;
    }
  }

  /**
   * Allow entry (guard action)
   */
  async allowEntry(passId, guardId, entryData) {
    try {
      const pass = await prisma.gatePass.findUnique({
        where: { id: passId }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.status === 'cancelled' || pass.status === 'denied') {
        throw new Error('Pass is cancelled or denied');
      }

      const updatedPass = await prisma.gatePass.update({
        where: { id: passId },
        data: {
          status: 'checked_in',
          actualEntryTime: new Date(),
          entryGate: entryData.gate,
          entryGuardId: guardId,
          entryRemarks: entryData.remarks || null
        },
        include: {
          personToMeet: true
        }
      });

      // Create history
      await prisma.gatePassHistory.create({
        data: {
          gatePassId: passId,
          action: 'checked_in',
          performedById: guardId,
          remarks: entryData.remarks || 'Entry allowed',
          metadata: {
            gate: entryData.gate,
            entryTime: new Date().toISOString()
          }
        }
      });

      // Send notification to host
      await this.sendEntryNotification(updatedPass);

      logger.info(`Entry allowed for pass: ${pass.passId}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error allowing entry:', error);
      throw error;
    }
  }

  /**
   * Deny entry (guard action)
   */
  async denyEntry(passId, guardId, denialReason) {
    try {
      const pass = await prisma.gatePass.findUnique({
        where: { id: passId }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      const updatedPass = await prisma.gatePass.update({
        where: { id: passId },
        data: {
          status: 'denied',
          denialReason
        },
        include: {
          personToMeet: true
        }
      });

      // Create history
      await prisma.gatePassHistory.create({
        data: {
          gatePassId: passId,
          action: 'denied',
          performedById: guardId,
          remarks: denialReason
        }
      });

      // Notify host about denial
      await this.sendDenialNotification(updatedPass, denialReason);

      logger.info(`Entry denied for pass: ${pass.passId}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error denying entry:', error);
      throw error;
    }
  }

  /**
   * Record exit (guard action)
   */
  async recordExit(passId, guardId, exitData) {
    try {
      const pass = await prisma.gatePass.findUnique({
        where: { id: passId }
      });

      if (!pass) {
        throw new Error('Pass not found');
      }

      if (pass.status !== 'checked_in') {
        throw new Error('Visitor is not checked in');
      }

      const updatedPass = await prisma.gatePass.update({
        where: { id: passId },
        data: {
          status: 'completed',
          actualExitTime: new Date(),
          exitGate: exitData.gate,
          exitGuardId: guardId,
          exitRemarks: exitData.remarks || null
        }
      });

      // Create history
      await prisma.gatePassHistory.create({
        data: {
          gatePassId: passId,
          action: 'checked_out',
          performedById: guardId,
          remarks: exitData.remarks || 'Exit recorded',
          metadata: {
            gate: exitData.gate,
            exitTime: new Date().toISOString()
          }
        }
      });

      logger.info(`Exit recorded for pass: ${pass.passId}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error recording exit:', error);
      throw error;
    }
  }

  /**
   * Cancel pass
   */
  async cancelPass(passId, userId, reason) {
    try {
      const updatedPass = await prisma.gatePass.update({
        where: { id: passId },
        data: {
          status: 'cancelled'
        }
      });

      // Create history
      await prisma.gatePassHistory.create({
        data: {
          gatePassId: passId,
          action: 'cancelled',
          performedById: userId,
          remarks: reason || 'Pass cancelled'
        }
      });

      logger.info(`Pass cancelled: ${updatedPass.passId}`);
      return updatedPass;
    } catch (error) {
      logger.error('Error cancelling pass:', error);
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
          gatePassId: gatePass.id,
          recipientType: 'visitor',
          recipientEmail: gatePass.email,
          recipientPhone: gatePass.mobileNumber,
          notificationType: 'email',
          status: 'pending'
        });
      }

      notifications.push({
        gatePassId: gatePass.id,
        recipientType: 'visitor',
        recipientPhone: gatePass.mobileNumber,
        notificationType: 'whatsapp',
        status: 'pending'
      });

      // Notification to host
      if (gatePass.personToMeet?.email) {
        notifications.push({
          gatePassId: gatePass.id,
          recipientType: 'host',
          recipientId: gatePass.personToMeetId,
          recipientEmail: gatePass.personToMeet.email,
          notificationType: 'email',
          status: 'pending'
        });
      }

      // Security notification
      notifications.push({
        gatePassId: gatePass.id,
        recipientType: 'security',
        notificationType: 'email',
        status: 'pending'
      });

      await prisma.gatePassNotification.createMany({ data: notifications });
    } catch (error) {
      logger.error('Error creating notifications:', error);
    }
  }

  /**
   * Helper: Send entry notification
   */
  async sendEntryNotification(gatePass) {
    // Implement email/SMS sending logic here
    logger.info(`Entry notification sent for pass: ${gatePass.passId}`);
  }

  /**
   * Helper: Send denial notification
   */
  async sendDenialNotification(gatePass, reason) {
    // Implement email/SMS sending logic here
    logger.info(`Denial notification sent for pass: ${gatePass.passId}`);
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

        where.visitDate = {
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

        where.visitDate = {
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

      // Get passes with history
      const passes = await prisma.gatePass.findMany({
        where,
        include: {
          history: {
            orderBy: {
              timestamp: 'desc'
            },
            include: {
              performedBy: {
                select: {
                  uid: true,
                  email: true,
                  employeeDetails: {
                    select: {
                      firstName: true,
                      lastName: true,
                      displayName: true
                    }
                  }
                }
              }
            }
          },
          createdBy: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: {
          actualEntryTime: 'desc'
        }
      });

      // Format response with guard details
      const formattedHistory = passes.map(pass => {
        const entryAction = pass.history.find(h => h.action === 'allowed_entry');
        const exitAction = pass.history.find(h => h.action === 'recorded_exit');

        return {
          passId: pass.passId,
          visitorName: pass.visitorName,
          mobileNumber: pass.mobileNumber,
          visitDate: pass.visitDate,
          expectedEntryTime: pass.expectedEntryTime,
          expectedExitTime: pass.expectedExitTime,
          actualEntryTime: pass.actualEntryTime,
          actualExitTime: pass.actualExitTime,
          status: pass.status,
          departmentToVisit: pass.departmentToVisit,
          personToMeetName: pass.personToMeetName,
          purposeOfVisit: pass.purposeOfVisit,
          vehicleNumber: pass.vehicleNumber,
          entryGuard: entryAction ? {
            name: entryAction.performedBy?.employeeDetails?.displayName || 
                  `${entryAction.performedBy?.employeeDetails?.firstName} ${entryAction.performedBy?.employeeDetails?.lastName}`,
            uid: entryAction.performedBy?.uid,
            timestamp: entryAction.timestamp
          } : null,
          exitGuard: exitAction ? {
            name: exitAction.performedBy?.employeeDetails?.displayName || 
                  `${exitAction.performedBy?.employeeDetails?.firstName} ${exitAction.performedBy?.employeeDetails?.lastName}`,
            uid: exitAction.performedBy?.uid,
            timestamp: exitAction.timestamp
          } : null
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
        'Pass ID': pass.passId,
        'Visitor Name': pass.visitorName,
        'Mobile Number': pass.mobileNumber,
        'Visit Date': new Date(pass.visitDate).toLocaleDateString(),
        'Expected Entry': pass.expectedEntryTime,
        'Expected Exit': pass.expectedExitTime,
        'Actual Entry': pass.actualEntryTime ? new Date(pass.actualEntryTime).toLocaleTimeString() : '-',
        'Actual Exit': pass.actualExitTime ? new Date(pass.actualExitTime).toLocaleTimeString() : '-',
        'Status': pass.status.toUpperCase(),
        'Department': pass.departmentToVisit,
        'Person to Meet': pass.personToMeetName || '-',
        'Purpose': pass.purposeOfVisit,
        'Vehicle Number': pass.vehicleNumber || '-',
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
