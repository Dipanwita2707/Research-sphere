const cron = require('node-cron');
const prisma = require('../shared/config/database');
const emailService = require('../shared/utils/emailService');

/**
 * QR Activation Cron Job
 * Runs every 15 minutes to:
 * 1. Activate QR codes 5 hours before entry time
 * 2. Expire QR codes at 6 PM IST on end date (room also freed at same time)
 */

// Passes expire at 23:59 on their end date —
// the first job run on the next day (any time) marks them expired.

// IST timezone helper
const getISTDate = () => {
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  return new Date(Date.now() + istOffset);
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

const ACTIVATION_HOURS_BEFORE = 5; // QR activates 5 hours before entry time

const activateQRCodes = async () => {
  try {
    const now = getISTDate();
    
    console.log(`[QR Activation Job] Running at ${now.toISOString()}`);

    // Use IST calendar date represented as UTC midnight for date-only comparisons.
    const todayIST = getISTCalendarDateUtcMidnight();
    
    // ============ ACTIVATE NEW PASSES (status=created) ============
    const passesToActivate = await prisma.gate_pass.findMany({
      where: {
        qr_status: 'inactive',
        pass_status: {
          in: ['created']
        },
        visit_date: {
          gte: todayIST
        }
      },
      select: {
        id: true,
        pass_id: true,
        entry_time: true,
        visit_date: true,
        visit_end_date: true
      }
    });

    if (passesToActivate.length === 0) {
      console.log(`[QR Activation Job] No passes to activate`);
    } else {
      // Filter passes where entry_time is within next 5 hours
      const passIdsToActivate = [];
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes since midnight
      const activationWindowMinutes = ACTIVATION_HOURS_BEFORE * 60;

      for (const pass of passesToActivate) {
        // Check if today is the visit date
        const visitDateStr = new Date(pass.visit_date).toISOString().split('T')[0];
        const todayStr = todayIST.toISOString().split('T')[0];
        
        if (visitDateStr !== todayStr) {
          continue; // Skip passes not for today
        }
        
        // Parse entry_time (format: "HH:MM")
        const [hours, minutes] = pass.entry_time.split(':').map(Number);
        const entryTimeInMinutes = hours * 60 + minutes;
        
        // Calculate time difference
        const timeDifferenceInMinutes = entryTimeInMinutes - currentTime;
        
        // Activate QR if:
        // 1. Entry time is within next 5 hours (upcoming visitors), OR
        // 2. Entry time has already passed but it's still the same day (late visitors - they can still enter)
        // We allow entry for the entire day once the activation window opens
        if (timeDifferenceInMinutes <= activationWindowMinutes) {
          passIdsToActivate.push(pass.id);
        }
      }

      if (passIdsToActivate.length > 0) {
        // Batch update passes
        const result = await prisma.gate_pass.updateMany({
          where: {
            id: {
              in: passIdsToActivate
            }
          },
          data: {
            qr_status: 'active',
            qr_activation_time: now
          }
        });

        console.log(`[QR Activation Job] ✅ Activated ${result.count} QR codes`);
        
        // Log activated passes
        const activatedPasses = passesToActivate.filter(p => passIdsToActivate.includes(p.id));
        activatedPasses.forEach(pass => {
          console.log(`  - Pass ID: ${pass.pass_id}, Entry Time: ${pass.entry_time}`);
        });
      } else {
        console.log(`[QR Activation Job] No passes within ${ACTIVATION_HOURS_BEFORE}-hour activation window`);
      }
    }

    // ============ RE-ACTIVATE CHECKED_OUT PASSES (all passes support unlimited in/out) ============
    // Find checked_out passes that have inactive QR and today is within their date range
    const passesToReactivate = await prisma.gate_pass.findMany({
      where: {
        qr_status: 'inactive',
        pass_status: 'checked_out',
        OR: [
          // Single-day passes: visit_date is today
          {
            visit_end_date: null,
            visit_date: { gte: todayIST, lt: new Date(todayIST.getTime() + 24 * 60 * 60 * 1000) }
          },
          // Multi-day passes: today is within date range
          {
            visit_end_date: { not: null, gte: todayIST },
            visit_date: { lte: todayIST }
          }
        ]
      },
      select: {
        id: true,
        pass_id: true,
        visit_date: true,
        visit_end_date: true
      }
    });

    if (passesToReactivate.length > 0) {
      const result = await prisma.gate_pass.updateMany({
        where: {
          id: { in: passesToReactivate.map(p => p.id) }
        },
        data: {
          qr_status: 'active',
          qr_activation_time: now
        }
      });

      console.log(`[QR Activation Job] 🔄 Re-activated ${result.count} checked_out pass QR codes for re-entry`);
      passesToReactivate.forEach(pass => {
        const endDate = pass.visit_end_date ? new Date(pass.visit_end_date).toISOString().split('T')[0] : 'single-day';
        console.log(`  - Pass ID: ${pass.pass_id}, Visit: ${new Date(pass.visit_date).toISOString().split('T')[0]}, End: ${endDate}`);
      });
    }

    // ============ EXPIRE PASSES ============
    // Passes are valid for the entire end date (until 23:59).
    // Use { lt: todayIST } so a pass whose end_date IS today stays active
    // all day and is only expired on the first job run tomorrow.
    const dateComparison = { lt: todayIST };
    
    // Find passes to expire even if QR is inactive (e.g., never activated/used)
    // so overdue passes do not remain visible as active/created forever.
    const passesToExpire = await prisma.gate_pass.findMany({
      where: {
        qr_status: {
          in: ['active', 'inactive']
        },
        pass_status: {
          in: ['created', 'approved', 'active', 'checked_in', 'checked_out']
        },
        OR: [
          // Single-day passes: visit_date expired based on 6 PM rule
          {
            visit_date: dateComparison,
            visit_end_date: null
          },
          // Multi-day passes: visit_end_date expired based on 6 PM rule
          {
            visit_end_date: dateComparison
          }
        ]
      },
      select: {
        id: true,
        pass_id: true,
        visit_date: true,
        visit_end_date: true
      }
    });

    if (passesToExpire.length > 0) {
      const passIdsToExpire = passesToExpire.map(p => p.id);

      const result = await prisma.gate_pass.updateMany({
        where: {
          id: {
            in: passIdsToExpire
          }
        },
        data: {
          status: 'expired',
          qr_status: 'expired',
          pass_status: 'expired'
        }
      });

      // Auto-close hostel bookings linked to expired passes.
      // This ensures rooms are no longer considered occupied in any booking-state views.
      const bookingCloseResult = await prisma.hostelBooking.updateMany({
        where: {
          gate_pass_id: { in: passIdsToExpire },
          booking_status: { in: ['pending', 'confirmed'] }
        },
        data: {
          booking_status: 'completed',
          checkout_reminder_sent: true,
          updated_at: new Date()
        }
      });

      console.log(`[QR Activation Job] ⏰ Expired ${result.count} passes`);
      if (bookingCloseResult.count > 0) {
        console.log(`[QR Activation Job] 🏨 Auto-completed ${bookingCloseResult.count} hostel booking(s) for expired passes`);
      }
      passesToExpire.forEach(pass => {
        const endDate = pass.visit_end_date || pass.visit_date;
        console.log(`  - Pass ID: ${pass.pass_id}, End Date: ${new Date(endDate).toISOString().split('T')[0]}`);
      });
    }

    // Safety backfill: if a pass is already marked expired from a previous run,
    // ensure any leftover pending/confirmed booking is auto-closed.
    const staleBookingCleanup = await prisma.hostelBooking.updateMany({
      where: {
        booking_status: { in: ['pending', 'confirmed'] },
        gate_pass: {
          pass_status: 'expired'
        }
      },
      data: {
        booking_status: 'completed',
        checkout_reminder_sent: true,
        updated_at: new Date()
      }
    });

    if (staleBookingCleanup.count > 0) {
      console.log(`[QR Activation Job] 🧹 Backfill auto-completed ${staleBookingCleanup.count} stale hostel booking(s) for already expired passes`);
    }

  } catch (error) {
    console.error(`[QR Activation Job] ❌ Error:`, error);
  }
};

/**
 * Send 4 PM checkout reminders (1 hour before 5 PM grace deadline).
 * Runs inside the 15-minute cron; only fires when IST hour = 16.
 */
const sendCheckoutReminders = async (options = {}) => {
  try {
    const { force = false } = options;
    const now = getISTDate();
    const istHour = now.getUTCHours(); // already shifted to IST

    // Only run between 4:00 PM and 4:14 PM IST (first cron tick of the 4 PM hour)
    if (!force && istHour !== 16) {
      return {
        skipped: true,
        reason: 'outside-reminder-window',
        now: now.toISOString()
      };
    }

    console.log(`[Checkout Reminder] Running at IST ${now.toISOString()}`);

    // Today's date range in IST
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Find active bookings checking out today that haven't been reminded.
    // Include pending as well because extension/payment flows can temporarily
    // keep a valid booking in pending state on checkout day.
    const bookings = await prisma.hostelBooking.findMany({
      where: {
        booking_status: { in: ['confirmed', 'pending'] },
        checkout_reminder_sent: false,
        check_out_datetime: {
          gte: todayStart,
          lt:  todayEnd
        }
      },
      include: {
        gate_pass: {
          include: {
            user_login_gate_pass_created_by_idTouser_login: {
              include: {
                studentLogin: {
                  include: {
                    parents: {
                      take: 5
                    }
                  }
                }
              }
            }
          }
        },
        room: {
          include: { hostel: true }
        }
      }
    });

    if (bookings.length === 0) {
      console.log(`[Checkout Reminder] No bookings to remind`);
      return {
        skipped: false,
        matchedBookings: 0,
        remindersSent: 0,
        now: now.toISOString()
      };
    }

    let sentCount = 0;
    for (const booking of bookings) {
      const pass = booking.gate_pass;
      const studentId = pass?.created_by_id;
      const parentCandidates = pass?.user_login_gate_pass_created_by_idTouser_login?.studentLogin?.parents || [];
      const parentDetails =
        parentCandidates.find((p) => p?.isPrimaryContact && p?.email) ||
        parentCandidates.find((p) => p?.email) ||
        null;

      // 1) Send notification to student's dashboard
      if (studentId) {
        await prisma.notification.create({
          data: {
            userId: studentId,
            type: 'checkout_reminder',
            title: 'Checkout Reminder – 5 PM Deadline',
            message: `Checkout before 5:00 PM or extra charge will apply. Room: ${booking.room?.room_number || '—'} at ${booking.room?.hostel?.name || 'Guest House'}.`,
            referenceType: 'hostel_booking',
            referenceId: booking.id,
            metadata: {
              actionUrl: '/notifications',
              actionLabel: 'View Reminder'
            }
          }
        });
      }

      // 2) Send email to parent (fire-and-forget)
      if (parentDetails?.email) {
        emailService.sendCheckoutReminder({
          parentEmail: parentDetails.email,
          parentName: `${parentDetails.firstName || ''} ${parentDetails.lastName || ''}`.trim() || parentDetails.fatherName || parentDetails.motherName || 'Parent',
          visitorName: pass.visitor_name,
          passId: pass.pass_id,
          roomNumber: booking.room?.room_number || '—',
          hostelName: booking.room?.hostel?.name || 'Guest House',
          checkOutDatetime: booking.check_out_datetime
        }).catch(err => console.error(`[Checkout Reminder] Email error for booking ${booking.id}:`, err));
      }

      // 3) Mark as reminded
      await prisma.hostelBooking.update({
        where: { id: booking.id },
        data: { checkout_reminder_sent: true }
      });

      sentCount++;
    }

    console.log(`[Checkout Reminder] ✅ Sent ${sentCount} reminders`);
    return {
      skipped: false,
      matchedBookings: bookings.length,
      remindersSent: sentCount,
      now: now.toISOString()
    };
  } catch (error) {
    console.error(`[Checkout Reminder] ❌ Error:`, error);
    throw error;
  }
};

/**
 * Apply one-day extra charge after 5 PM if checkout/cancellation was not completed.
 * The booking deadline is pushed to next day 5 PM to avoid duplicate charging in same day.
 */
const applyCheckoutDeadlineCharges = async (options = {}) => {
  try {
    const { force = false } = options;
    const now = getISTDate();
    const istHour = now.getUTCHours(); // already shifted to IST
    if (!force && istHour < 17) {
      return {
        skipped: true,
        reason: 'before-penalty-window',
        now: now.toISOString()
      };
    }

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const overdueBookings = await prisma.hostelBooking.findMany({
      where: {
        booking_status: 'confirmed',
        check_out_datetime: {
          gte: todayStart,
          lt: todayEnd
        }
      },
      include: {
        gate_pass: {
          include: {
            user_login_gate_pass_created_by_idTouser_login: {
              include: {
                studentLogin: {
                  include: {
                    parents: {
                      take: 5
                    }
                  }
                }
              }
            }
          }
        },
        room: {
          include: { hostel: true }
        }
      }
    });

    if (overdueBookings.length === 0) {
      return {
        skipped: false,
        matchedBookings: 0,
        chargedBookings: 0,
        now: now.toISOString()
      };
    }

    let chargedCount = 0;

    for (const booking of overdueBookings) {
      const currentCheckout = new Date(booking.check_out_datetime);
      const nextCheckout = new Date(currentCheckout);
      nextCheckout.setDate(nextCheckout.getDate() + 1);
      nextCheckout.setHours(17, 0, 0, 0);

      const currentBillableDays = Number(booking.billable_days || 1);
      const pricePerDay = Number(booking.price_per_day || 0);
      const currentTotal = Number(booking.total_price || 0);
      const newBillableDays = currentBillableDays + 1;
      const newTotal = Number((currentTotal + pricePerDay).toFixed(2));

      await prisma.hostelBooking.update({
        where: { id: booking.id },
        data: {
          billable_days: newBillableDays,
          total_price: newTotal,
          check_out_datetime: nextCheckout,
          checkout_reminder_sent: false,
          payment_status: pricePerDay > 0 ? 'pending' : booking.payment_status,
          updated_at: new Date()
        }
      });

      if (booking.gate_pass?.created_by_id) {
        await prisma.notification.create({
          data: {
            userId: booking.gate_pass.created_by_id,
            type: 'checkout_penalty_applied',
            title: 'Extra Day Charge Applied',
            message: `Checkout deadline (5:00 PM) missed for room ${booking.room?.room_number || '—'} at ${booking.room?.hostel?.name || 'Guest House'}. One extra day rent has been added.`,
            referenceType: 'hostel_booking',
            referenceId: booking.id,
            metadata: {
              actionUrl: '/notifications',
              actionLabel: 'View Charge Details'
            }
          }
        });
      }

      const parentCandidates = booking.gate_pass?.user_login_gate_pass_created_by_idTouser_login?.studentLogin?.parents || [];
      const parentDetails =
        parentCandidates.find((p) => p?.isPrimaryContact && p?.email) ||
        parentCandidates.find((p) => p?.email) ||
        null;
      if (parentDetails?.email) {
        emailService.sendCheckoutPenaltyApplied({
          parentEmail: parentDetails.email,
          parentName: `${parentDetails.firstName || ''} ${parentDetails.lastName || ''}`.trim() || parentDetails.fatherName || parentDetails.motherName || 'Parent',
          visitorName: booking.gate_pass?.visitor_name || 'Visitor',
          passId: booking.gate_pass?.pass_id || 'N/A',
          roomNumber: booking.room?.room_number || '—',
          hostelName: booking.room?.hostel?.name || 'Guest House',
          newCheckoutDatetime: nextCheckout,
          additionalAmount: pricePerDay
        }).catch(err => console.error(`[Checkout Deadline] Parent penalty email error for booking ${booking.id}:`, err));
      }

      chargedCount++;
    }

    if (chargedCount > 0) {
      console.log(`[Checkout Deadline] ✅ Applied extra-day charges for ${chargedCount} booking(s)`);
    }

    return {
      skipped: false,
      matchedBookings: overdueBookings.length,
      chargedBookings: chargedCount,
      now: now.toISOString()
    };
  } catch (error) {
    console.error('[Checkout Deadline] ❌ Error:', error);
    throw error;
  }
};

/**
 * Start the cron job
 * Schedule: Every 15 minutes
 */
const startQRActivationJob = () => {
  // Run every 15 minutes: */15 * * * *
  cron.schedule('*/15 * * * *', async () => {
    await activateQRCodes();
    await sendCheckoutReminders();
    await applyCheckoutDeadlineCharges();
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[QR Activation Job] 🚀 Started - Running every 15 minutes');
  
  // Run immediately on startup
  activateQRCodes();
  sendCheckoutReminders();
  applyCheckoutDeadlineCharges();
};

module.exports = {
  startQRActivationJob,
  activateQRCodes,
  sendCheckoutReminders,
  applyCheckoutDeadlineCharges
};
