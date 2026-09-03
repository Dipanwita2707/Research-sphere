const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🏁 Starting Tenancy Migration and Backfill Script...');

  try {
    // 1. Create default SaaS Tiers if they don't exist
    console.log('📦 Provisioning standard SaaS Pricing Tiers...');
    
    const starterTier = await prisma.saaSTier.upsert({
      where: { name: 'starter' },
      update: {},
      create: {
        name: 'starter',
        displayName: 'Starter Plan',
        monthlyPriceCents: 500000, // ₹5,000/mo
        yearlyPriceCents: 5000000, // ₹50,000/yr (discounted)
        maxUsers: 500,
        maxApiCallsPerMonth: 100000, // 100k
        maxStorageGb: 10,
        overagePer1kCalls: 1000, // ₹10 per 1k overage
        isPublic: true,
        sortOrder: 1,
        features: {
          audit_logs: true,
          custom_domain: false,
          sso: false
        }
      }
    });

    const growthTier = await prisma.saaSTier.upsert({
      where: { name: 'growth' },
      update: {},
      create: {
        name: 'growth',
        displayName: 'Growth Plan',
        monthlyPriceCents: 1500000, // ₹15,000/mo
        yearlyPriceCents: 15000000, // ₹1,50,000/yr
        maxUsers: 2500,
        maxApiCallsPerMonth: 1000000, // 1M
        maxStorageGb: 50,
        overagePer1kCalls: 500, // ₹5 per 1k overage
        isPublic: true,
        sortOrder: 2,
        features: {
          audit_logs: true,
          custom_domain: true,
          sso: false
        }
      }
    });

    const enterpriseTier = await prisma.saaSTier.upsert({
      where: { name: 'enterprise' },
      update: {},
      create: {
        name: 'enterprise',
        displayName: 'Enterprise Plan',
        monthlyPriceCents: 5000000, // ₹50,000/mo
        yearlyPriceCents: 50000000, // ₹5,000,000/yr
        maxUsers: -1, // Unlimited
        maxApiCallsPerMonth: -1, // Unlimited
        maxStorageGb: 500,
        overagePer1kCalls: 0,
        isPublic: true,
        sortOrder: 3,
        features: {
          audit_logs: true,
          custom_domain: true,
          sso: true
        }
      }
    });

    console.log('✅ SaaS Tiers provisioned.');

    // 2. Create the default "SGT University" tenant
    console.log('🏛 Provisioning SGT University default tenant...');
    const sgtUni = await prisma.university.upsert({
      where: { code: 'SGT' },
      update: {},
      create: {
        code: 'SGT',
        name: 'SGT University',
        slug: 'sgt',
        contactEmail: 'admin@sgtuniversity.edu.in',
        websiteUrl: 'https://sgtuniversity.ac.in',
        isActive: true
      }
    });
    console.log(`✅ Default tenant provisioned with ID: ${sgtUni.id}`);

    // 3. Provision SGT Subscription to Enterprise Tier
    console.log('💳 Activating Enterprise Subscription for SGT...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year contract

    await prisma.universitySubscription.upsert({
      where: { universityId: sgtUni.id },
      update: {
        tierId: enterpriseTier.id,
        status: 'active',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate
      },
      create: {
        universityId: sgtUni.id,
        tierId: enterpriseTier.id,
        status: 'active',
        billingCycle: 'yearly',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate
      }
    });
    console.log('✅ Subscription active.');

    // 4. Backfill existing records to SGT University
    console.log('🔄 Backfilling universityId across existing records...');

    // A. Backfill UserLogin (excluding superadmin users)
    const userUpdate = await prisma.userLogin.updateMany({
      where: {
        role: { not: 'superadmin' },
        universityId: null
      },
      data: {
        universityId: sgtUni.id
      }
    });
    console.log(`- Backfilled ${userUpdate.count} UserLogin records.`);

    // B. Backfill FacultySchoolList
    const schoolUpdate = await prisma.facultySchoolList.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${schoolUpdate.count} FacultySchoolList records.`);

    // C. Backfill CentralDepartment
    const deptUpdate = await prisma.centralDepartment.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${deptUpdate.count} CentralDepartment records.`);

    // D. Backfill Roles
    const roleUpdate = await prisma.role.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${roleUpdate.count} Role records.`);

    // E. Backfill AuditLog
    const auditUpdate = await prisma.auditLog.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${auditUpdate.count} AuditLog records.`);

    // F. Backfill Notification
    const notificationUpdate = await prisma.notification.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${notificationUpdate.count} Notification records.`);

    // G. Backfill BugReport
    const bugUpdate = await prisma.bugReport.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${bugUpdate.count} BugReport records.`);

    // H. Backfill all 5 IncentivePolicy models
    const policy1 = await prisma.incentivePolicy.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    const policy2 = await prisma.researchIncentivePolicy.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    const policy3 = await prisma.bookIncentivePolicy.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    const policy4 = await prisma.bookChapterIncentivePolicy.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    const policy5 = await prisma.conferenceIncentivePolicy.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    const policy6 = await prisma.grantIncentivePolicy.updateMany({
      where: { universityId: null },
      data: { universityId: sgtUni.id }
    });
    console.log(`- Backfilled ${policy1.count + policy2.count + policy3.count + policy4.count + policy5.count + policy6.count} Incentive Policy records.`);

    console.log('🎉 Tenancy Migration and Backfill Completed Successfully!');
  } catch (error) {
    console.error('❌ Migration script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
