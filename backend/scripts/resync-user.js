/**
 * Re-sync a faculty user with filterSgtOnly enabled (no delete).
 * Usage: node scripts/resync-user.js <uid>
 */
const path = require('path');

async function main() {
  const uid = String(process.argv[2] || '').trim();
  if (!uid) {
    console.error('Usage: node scripts/resync-user.js <uid>');
    process.exit(1);
  }

  process.chdir(path.resolve(__dirname, '..'));
  const { publicationSyncService, prisma } = require('../src/modules/research/services');

  try {
    const user = await prisma.userLogin.findFirst({
      where: { uid },
      include: { researchProfileIdentity: true, employeeDetails: { select: { displayName: true } } },
    });
    if (!user?.researchProfileIdentity) {
      throw new Error(`User/identity not found for uid=${uid}`);
    }

    await prisma.researchProfileIdentity.update({
      where: { id: user.researchProfileIdentity.id },
      data: { filterSgtOnly: true },
    });

    const before = await prisma.researchContribution.count({ where: { applicantUserId: user.id } });
    console.log(JSON.stringify({
      uid: user.uid,
      name: user.employeeDetails?.displayName || null,
      beforeCount: before,
      filterSgtOnly: true,
    }, null, 2));

    const result = await publicationSyncService.syncFacultyPublications(user.id, {
      triggerType: 'manual',
      sourcePreference: 'all',
    });

    const after = await prisma.researchContribution.count({ where: { applicantUserId: user.id } });
    console.log(JSON.stringify({
      afterCount: after,
      discoveredCount: result.discoveredCount,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      errors: (result.errors || []).slice(0, 8),
    }, null, 2));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
