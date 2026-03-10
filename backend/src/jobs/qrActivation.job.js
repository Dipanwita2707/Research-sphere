const cron = require('node-cron');
const prisma = require('../shared/config/database');

/**
 * QR Activation Cron Job
 * Runs every 15 minutes to:
 * 1. Activate QR codes 5 hours before entry time
 * 2. Expire QR codes at 6 PM IST on end date (room also freed at same time)
 */

const EXPIRY_HOUR_IST = 18; // 6 PM IST - QR expires & room frees

// IST timezone helper
const getISTDate = () => {
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  return new Date(Date.now() + istOffset);
};

const ACTIVATION_HOURS_BEFORE = 5; // QR activates 5 hours before entry time

const activateQRCodes = async () => {
  try {
    const now = getISTDate();
    
    console.log(`[QR Activation Job] Running at ${now.toISOString()}`);

    // Get today's date in YYYY-MM-DD format (IST)
    const todayIST = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
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
    // Expire QR codes at 6 PM IST on end date (room also freed at same time)
    // Before 6 PM: only expire past-date passes
    // After 6 PM: also expire today's passes (6 PM cutoff reached)
    
    const currentISTHour = now.getUTCHours(); // getUTCHours on IST-shifted date = IST hour
    
    // After 6 PM IST: expire today and past dates (lte)
    // Before 6 PM IST: only expire past dates (lt)
    const dateComparison = currentISTHour >= EXPIRY_HOUR_IST
      ? { lte: todayIST }
      : { lt: todayIST };
    
    // Find passes to expire (exclude multi-day daily passes that are checked_out and still within date range)
    const passesToExpire = await prisma.gate_pass.findMany({
      where: {
        qr_status: 'active',
        pass_status: {
          in: ['created', 'approved', 'active']
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
      const result = await prisma.gate_pass.updateMany({
        where: {
          id: {
            in: passesToExpire.map(p => p.id)
          }
        },
        data: {
          qr_status: 'expired',
          pass_status: 'completed'
        }
      });

      console.log(`[QR Activation Job] ⏰ Expired ${result.count} passes`);
      passesToExpire.forEach(pass => {
        const endDate = pass.visit_end_date || pass.visit_date;
        console.log(`  - Pass ID: ${pass.pass_id}, End Date: ${new Date(endDate).toISOString().split('T')[0]}`);
      });
    }

  } catch (error) {
    console.error(`[QR Activation Job] ❌ Error:`, error);
  }
};

/**
 * Start the cron job
 * Schedule: Every 15 minutes
 */
const startQRActivationJob = () => {
  // Run every 15 minutes: */15 * * * *
  cron.schedule('*/15 * * * *', activateQRCodes, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[QR Activation Job] 🚀 Started - Running every 15 minutes');
  
  // Run immediately on startup
  activateQRCodes();
};

module.exports = {
  startQRActivationJob,
  activateQRCodes
};
