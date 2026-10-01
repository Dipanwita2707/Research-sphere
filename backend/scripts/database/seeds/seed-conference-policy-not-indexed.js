/**
 * Seed default conference incentive policies for one university:
 * paper_not_indexed, keynote_speaker_invited_talks, organizer_coordinator_member.
 *
 *   npm run seed:conference-policies -- --university SGT [--force]
 *
 * Idempotent: a sub-type that already has an active policy in that university is skipped.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const tenantContext = require('../../../src/shared/tenancy/tenantContext');
const {
  assertNotProduction, requireUniversity, findTenantAdmin,
} = require('../../../src/shared/database/seedUtils');

const SCRIPT = 'seed:conference-policies';

const POLICIES = [
  {
    policyName: 'Conference Paper (Not Indexed) - Default Policy',
    conferenceSubType: 'paper_not_indexed',
    flatIncentiveAmount: 15000,
    flatPoints: 15,
    internationalBonus: 5000,
    bestPaperAwardBonus: 5000,
  },
  {
    policyName: 'Conference Keynote/Invited Speaker - Default Policy',
    conferenceSubType: 'keynote_speaker_invited_talks',
    flatIncentiveAmount: 20000,
    flatPoints: 20,
    internationalBonus: 5000,
    bestPaperAwardBonus: 0,
  },
  {
    policyName: 'Conference Organizer/Coordinator - Default Policy',
    conferenceSubType: 'organizer_coordinator_member',
    flatIncentiveAmount: 10000,
    flatPoints: 10,
    internationalBonus: 5000,
    bestPaperAwardBonus: 0,
  },
];

async function seedConferencePolicies(prisma) {
  const university = await requireUniversity(prisma);
  const universityId = university.id;

  await tenantContext.runForTenant(universityId, async () => {
    const admin = await findTenantAdmin(prisma, universityId);
    for (const p of POLICIES) {
      const existing = await prisma.conferenceIncentivePolicy.findFirst({
        where: { universityId, conferenceSubType: p.conferenceSubType, isActive: true },
        select: { policyName: true },
      });
      if (existing) {
        console.log(`Skip ${p.conferenceSubType}: active policy "${existing.policyName}" exists`);
        continue;
      }
      await prisma.conferenceIncentivePolicy.create({
        data: {
          ...p,
          universityId,
          splitPolicy: 'equal',
          isActive: true,
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: null,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
      console.log(`Created ${p.conferenceSubType}`);
    }
  });
  console.log(`Conference policies seeded for ${university.code}.`);
}

if (require.main === module) {
  assertNotProduction(SCRIPT);
  const prisma = require('../../../src/shared/config/database');
  seedConferencePolicies(prisma)
    .catch((error) => {
      console.error(`[${SCRIPT}] failed:`, error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedConferencePolicies };
