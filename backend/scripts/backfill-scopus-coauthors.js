/**
 * Re-run Scopus sync for a user to backfill co-authors on existing imports.
 * Usage: node scripts/backfill-scopus-coauthors.js [userId]
 */
require('dotenv').config();
const prisma = require('../src/shared/config/database');
const { publicationSyncService: sync } = require('../src/modules/research/services');

const userId = process.argv[2] || '8fa6bb69-6cd9-48da-84a7-c3061e4dafbb';

(async () => {
  const before = await prisma.researchContributionAuthor.count({
    where: { researchContribution: { applicantUserId: userId } },
  });

  console.log('Starting Scopus re-sync for', userId, 'author rows before:', before);

  const result = await sync.syncFacultyPublications(userId, {
    triggeredById: userId,
    triggerType: 'manual_coauthor_backfill',
    sourcePreference: 'scopus',
  });

  const after = await prisma.researchContributionAuthor.count({
    where: { researchContribution: { applicantUserId: userId } },
  });

  const grouped = await prisma.researchContributionAuthor.groupBy({
    by: ['researchContributionId'],
    where: { researchContribution: { applicantUserId: userId } },
    _count: { _all: true },
  });
  const multi = grouped.filter((g) => g._count._all > 1).length;

  console.log('Sync summary:', {
    discoveredCount: result.discoveredCount,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
  });
  console.log('Author rows after:', after, 'papers with 2+ authors:', multi);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
