/**
 * Seed script: DRD Member Analytics Data
 * Creates realistic review records for ResearchContribution, IprApplication, and GrantApplication
 * so the DRD Member Performance analytics page shows meaningful data.
 *
 * Run: node seed-drd-member-analytics.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000);
}

function daysAgo(d) {
  return hoursAgo(d * 24);
}

/** Pick a random element from an array */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Weighted random decision
 * ~60% approved, ~15% rejected, ~18% changes_required, ~7% sent_back
 */
function randomDecision() {
  const r = Math.random();
  if (r < 0.60) return 'approved';
  if (r < 0.75) return 'rejected';
  if (r < 0.93) return 'changes_required';
  return 'sent_back';
}

/**
 * Spread N reviews across last 12 months, random dates within that window.
 */
function spreadDates(n, maxDaysBack = 365) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const daysBack = randomBetween(1, maxDaysBack);
    dates.push(daysBack);
  }
  return dates.sort((a, b) => b - a); // oldest first
}

// ─── Main seed logic ──────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting DRD Member Analytics seed...\n');

  // ── Step 1: Find reviewer candidates ──────────────────────────────────────
  console.log('📋 Finding reviewer candidates (faculty / admin users)...');

  const candidateUsers = await prisma.userLogin.findMany({
    where: {
      role: { in: ['faculty', 'admin', 'superadmin', 'staff'] },
      status: 'active',
    },
    select: {
      id: true,
      uid: true,
      role: true,
      employeeDetails: { select: { displayName: true } },
    },
    take: 20,
  });

  if (candidateUsers.length === 0) {
    console.error('❌ No faculty/admin users found. Run seed-users.js first.');
    return;
  }

  // Use up to 6 reviewers for realistic spread
  const reviewers = candidateUsers.slice(0, Math.min(6, candidateUsers.length));
  console.log(`✅ Using ${reviewers.length} reviewers:`);
  reviewers.forEach((u) =>
    console.log(`   - ${u.employeeDetails?.displayName || u.uid} (${u.role})`)
  );

  // ── Step 2: Find research contributions ────────────────────────────────────
  console.log('\n📄 Fetching research contributions...');
  const researchApps = await prisma.researchContribution.findMany({
    select: { id: true, title: true, publicationType: true },
    take: 60,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`   Found ${researchApps.length} research contributions`);

  // ── Step 3: Find IPR applications ─────────────────────────────────────────
  console.log('📄 Fetching IPR applications...');
  const iprApps = await prisma.iprApplication.findMany({
    select: { id: true, title: true },
    take: 40,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`   Found ${iprApps.length} IPR applications`);

  // ── Step 4: Find grant applications ───────────────────────────────────────
  console.log('📄 Fetching grant applications...');
  const grantApps = await prisma.grantApplication.findMany({
    select: { id: true, title: true },
    take: 30,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`   Found ${grantApps.length} grant applications`);

  const totalApps = researchApps.length + iprApps.length + grantApps.length;
  if (totalApps === 0) {
    console.error('❌ No applications found. Please seed application data first.');
    return;
  }

  // ── Step 5: Check existing reviews ────────────────────────────────────────
  console.log('\n🔍 Checking existing review counts...');
  const [existingResearch, existingIpr, existingGrant] = await Promise.all([
    prisma.researchContributionReview.count(),
    prisma.iprReview.count(),
    prisma.grantApplicationReview.count(),
  ]);
  console.log(
    `   Existing: ${existingResearch} research, ${existingIpr} IPR, ${existingGrant} grant reviews`
  );

  // ── Step 6: Create research contribution reviews ───────────────────────────
  let researchCreated = 0;
  if (researchApps.length > 0) {
    console.log('\n🔬 Creating research contribution reviews...');

    const dateOffsets = spreadDates(researchApps.length * 2, 365);
    let dateIdx = 0;

    for (const app of researchApps) {
      // Assign 1-3 reviewers per application
      const numReviewers = randomBetween(1, Math.min(3, reviewers.length));
      const shuffled = [...reviewers].sort(() => Math.random() - 0.5).slice(0, numReviewers);

      for (const reviewer of shuffled) {
        const daysBack = dateOffsets[dateIdx++] || randomBetween(1, 365);
        const createdAt = daysAgo(daysBack);
        // Turnaround: 4h – 5 days (some pending with null reviewedAt)
        const isPending = Math.random() < 0.1; // 10% pending
        const turnaroundHours = randomBetween(4, 120);
        const reviewedAt = isPending ? null : new Date(createdAt.getTime() + turnaroundHours * 3600 * 1000);
        const decision = isPending ? 'pending' : randomDecision();

        try {
          // Skip if already reviewed by this reviewer for this app
          const existing = await prisma.researchContributionReview.findFirst({
            where: { researchContributionId: app.id, reviewerId: reviewer.id },
          });
          if (existing) continue;

          await prisma.researchContributionReview.create({
            data: {
              researchContributionId: app.id,
              reviewerId: reviewer.id,
              reviewerRole: 'drd_member',
              decision,
              reviewedAt,
              createdAt,
              comments: decision === 'changes_required'
                ? 'Please revise the methodology section and resubmit.'
                : decision === 'rejected'
                ? 'Application does not meet the minimum quality criteria.'
                : decision === 'approved'
                ? 'Application meets all requirements. Approved.'
                : null,
            },
          });
          researchCreated++;
        } catch (err) {
          // Skip duplicate or FK violations silently
        }
      }
    }
    console.log(`   ✅ Created ${researchCreated} research reviews`);
  }

  // ── Step 7: Create IPR reviews ─────────────────────────────────────────────
  let iprCreated = 0;
  if (iprApps.length > 0) {
    console.log('\n🔒 Creating IPR application reviews...');

    for (const app of iprApps) {
      const numReviewers = randomBetween(1, Math.min(2, reviewers.length));
      const shuffled = [...reviewers].sort(() => Math.random() - 0.5).slice(0, numReviewers);

      for (const reviewer of shuffled) {
        const daysBack = randomBetween(1, 365);
        const createdAt = daysAgo(daysBack);
        const isPending = Math.random() < 0.12;
        const turnaroundHours = randomBetween(6, 96);
        const reviewedAt = isPending ? null : new Date(createdAt.getTime() + turnaroundHours * 3600 * 1000);
        const decision = isPending ? 'pending' : randomDecision();

        try {
          const existing = await prisma.iprReview.findFirst({
            where: { iprApplicationId: app.id, reviewerId: reviewer.id },
          });
          if (existing) continue;

          await prisma.iprReview.create({
            data: {
              iprApplicationId: app.id,
              reviewerId: reviewer.id,
              reviewerRole: 'drd_member',
              decision,
              reviewedAt,
              createdAt,
              comments: decision === 'changes_required'
                ? 'Please provide additional supporting documents.'
                : decision === 'rejected'
                ? 'The invention does not meet novelty requirements.'
                : decision === 'approved'
                ? 'Application is complete and recommended for filing.'
                : null,
            },
          });
          iprCreated++;
        } catch (err) {
          // Skip
        }
      }
    }
    console.log(`   ✅ Created ${iprCreated} IPR reviews`);
  }

  // ── Step 8: Create grant application reviews ───────────────────────────────
  let grantCreated = 0;
  if (grantApps.length > 0) {
    console.log('\n💰 Creating grant application reviews...');

    for (const app of grantApps) {
      const numReviewers = randomBetween(1, Math.min(2, reviewers.length));
      const shuffled = [...reviewers].sort(() => Math.random() - 0.5).slice(0, numReviewers);

      for (const reviewer of shuffled) {
        const daysBack = randomBetween(1, 365);
        const createdAt = daysAgo(daysBack);
        const isPending = Math.random() < 0.15;
        const turnaroundHours = randomBetween(8, 168);
        const reviewedAt = isPending ? null : new Date(createdAt.getTime() + turnaroundHours * 3600 * 1000);
        const decision = isPending ? 'pending' : randomDecision();

        try {
          const existing = await prisma.grantApplicationReview.findFirst({
            where: { grantApplicationId: app.id, reviewerId: reviewer.id },
          });
          if (existing) continue;

          await prisma.grantApplicationReview.create({
            data: {
              grantApplicationId: app.id,
              reviewerId: reviewer.id,
              reviewerRole: 'drd_member',
              decision,
              reviewedAt,
              createdAt,
              comments: decision === 'changes_required'
                ? 'Please revise the budget justification and project timeline.'
                : decision === 'rejected'
                ? 'Grant scope does not align with university research priorities.'
                : decision === 'approved'
                ? 'Grant application is well-justified and supported.'
                : null,
            },
          });
          grantCreated++;
        } catch (err) {
          // Skip
        }
      }
    }
    console.log(`   ✅ Created ${grantCreated} grant reviews`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalCreated = researchCreated + iprCreated + grantCreated;
  console.log('\n' + '═'.repeat(50));
  console.log(`🎉 Seed complete!`);
  console.log(`   Research reviews created : ${researchCreated}`);
  console.log(`   IPR reviews created      : ${iprCreated}`);
  console.log(`   Grant reviews created    : ${grantCreated}`);
  console.log(`   Total created            : ${totalCreated}`);
  console.log('═'.repeat(50));
  console.log('\n💡 Run "node clear-analytics-cache.js" to refresh the analytics cache.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
