const cron = require('node-cron');
const prisma = require('../shared/config/database');

let apiUsageJob = null;

// Aggregates API usage for all universities for a specific date
async function aggregateApiUsageForDate(date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  console.log(`[ApiUsageJob] Starting aggregation for date: ${startDate.toISOString().slice(0, 10)}`);

  // Get all active universities
  const universities = await prisma.university.findMany({
    where: { isActive: true },
    include: {
      subscription: {
        include: {
          tier: true
        }
      }
    }
  });

  for (const university of universities) {
    try {
      // 1. Count total requests, success, and errors
      const totalRequests = await prisma.auditLog.count({
        where: {
          universityId: university.id,
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      if (totalRequests === 0) {
        // No activity for this university today, skip or create empty entry
        continue;
      }

      const successRequests = await prisma.auditLog.count({
        where: {
          universityId: university.id,
          createdAt: { gte: startDate, lte: endDate },
          responseStatus: { lt: 400 }
        }
      });

      const errorRequests = totalRequests - successRequests;

      // 2. Average Duration
      const avgDurationAgg = await prisma.auditLog.aggregate({
        where: {
          universityId: university.id,
          createdAt: { gte: startDate, lte: endDate },
          duration: { not: null }
        },
        _avg: {
          duration: true
        }
      });
      const avgDurationMs = Math.round(avgDurationAgg._avg.duration || 0);

      // 3. P95 Duration (native DB percentile query using skip)
      const durationCount = await prisma.auditLog.count({
        where: {
          universityId: university.id,
          createdAt: { gte: startDate, lte: endDate },
          duration: { not: null }
        }
      });

      let p95DurationMs = 0;
      if (durationCount > 0) {
        const p95Index = Math.max(0, Math.floor(durationCount * 0.95) - 1);
        const p95Record = await prisma.auditLog.findMany({
          where: {
            universityId: university.id,
            createdAt: { gte: startDate, lte: endDate },
            duration: { not: null }
          },
          select: { duration: true },
          orderBy: { duration: 'asc' },
          skip: p95Index,
          take: 1
        });
        if (p95Record.length > 0) {
          p95DurationMs = p95Record[0].duration || 0;
        }
      }

      // 4. Unique Users
      const uniqueUsersResult = await prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          universityId: university.id,
          createdAt: { gte: startDate, lte: endDate },
          actorId: { not: null }
        }
      });
      const uniqueUsers = uniqueUsersResult.length;

      // 5. Popular Endpoints Breakdown
      const endpointStats = await prisma.auditLog.groupBy({
        by: ['requestPath'],
        where: {
          universityId: university.id,
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10
      });

      const endpointBreakdown = {};
      endpointStats.forEach(item => {
        if (item.requestPath) {
          endpointBreakdown[item.requestPath] = item._count.id;
        }
      });

      // 6. Calculate billing and overage
      let billableUnits = 0;
      let billableAmountCents = 0;

      const sub = university.subscription;
      if (sub && sub.tier && sub.tier.maxApiCallsPerMonth !== -1) {
        const tier = sub.tier;
        const maxQuota = tier.maxApiCallsPerMonth;
        const overageRate = tier.overagePer1kCalls; // in cents/paisa per 1k calls

        // Get start of the subscription period (this billing cycle)
        const cycleStart = new Date(sub.currentPeriodStart);
        const cycleEnd = new Date(sub.currentPeriodEnd);

        // Sum previous API usage in this billing period (excluding today)
        const previousMtdUsage = await prisma.apiUsageDaily.aggregate({
          where: {
            universityId: university.id,
            date: { gte: cycleStart, lt: startDate }
          },
          _sum: {
            totalRequests: true
          }
        });

        const mtdUsageBeforeToday = previousMtdUsage._sum.totalRequests || 0;
        const mtdUsageWithToday = mtdUsageBeforeToday + totalRequests;

        if (mtdUsageWithToday > maxQuota) {
          // We have breached or already were in overage
          const usageInOverage = Math.max(0, mtdUsageWithToday - maxQuota);
          const previouslyBilledOverage = Math.max(0, mtdUsageBeforeToday - maxQuota);
          
          // Billable units for today is the difference
          billableUnits = usageInOverage - previouslyBilledOverage;
          
          if (billableUnits > 0) {
            // Price is per 1000 requests
            billableAmountCents = Math.round((billableUnits / 1000) * overageRate);
          }
        }
      }

      // 7. Upsert daily api usage stats
      await prisma.apiUsageDaily.upsert({
        where: {
          universityId_date: {
            universityId: university.id,
            date: startDate
          }
        },
        update: {
          totalRequests,
          successRequests,
          errorRequests,
          avgDurationMs,
          p95DurationMs,
          uniqueUsers,
          billableUnits,
          billableAmountCents,
          endpointBreakdown,
          computedAt: new Date()
        },
        create: {
          universityId: university.id,
          date: startDate,
          totalRequests,
          successRequests,
          errorRequests,
          avgDurationMs,
          p95DurationMs,
          uniqueUsers,
          billableUnits,
          billableAmountCents,
          endpointBreakdown,
          computedAt: new Date()
        }
      });

      console.log(`[ApiUsageJob] Success: Aggregated ${totalRequests} logs for ${university.name} (${university.code}). Overage amount: ${billableAmountCents} cents.`);
    } catch (uniError) {
      console.error(`[ApiUsageJob] Error aggregating for university ${university.name}:`, uniError);
    }
  }
}

// Starts the scheduled job to run daily at 00:30 UTC / 06:00 IST
function startApiUsageJob() {
  if (apiUsageJob) {
    return apiUsageJob;
  }

  // Runs every day at 00:30 UTC
  const cronExpression = process.env.API_USAGE_CRON || '30 0 * * *';
  const enabled = process.env.API_USAGE_ENABLED !== 'false';

  if (!enabled) {
    console.log('[ApiUsageJob] Disabled by API_USAGE_ENABLED=false');
    return null;
  }

  apiUsageJob = cron.schedule(cronExpression, async () => {
    try {
      console.log('[ApiUsageJob] Starting daily API usage aggregation job');
      // Aggregate for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await aggregateApiUsageForDate(yesterday);
      console.log('[ApiUsageJob] Daily API usage aggregation job finished');
    } catch (error) {
      console.error('[ApiUsageJob] Background job execution failed:', error);
    }
  });

  console.log(`[ApiUsageJob] Scheduled with cron "${cronExpression}"`);
  return apiUsageJob;
}

function stopApiUsageJob() {
  if (apiUsageJob) {
    apiUsageJob.stop();
    apiUsageJob = null;
  }
}

module.exports = {
  startApiUsageJob,
  stopApiUsageJob,
  aggregateApiUsageForDate
};
