/**
 * One-off: delete auto-synced publications for a faculty UID,
 * enable filterSgtOnly, then re-sync from Scopus/OpenAlex/ORCID.
 *
 * Usage: node scripts/cleanup-and-resync-user.js <uid>
 */
const path = require('path');

async function main() {
  const uid = String(process.argv[2] || '').trim();
  if (!uid) {
    console.error('Usage: node scripts/cleanup-and-resync-user.js <uid>');
    process.exit(1);
  }

  // Ensure app-relative requires resolve when run from /app
  process.chdir(path.resolve(__dirname, '..'));

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const user = await prisma.userLogin.findFirst({
      where: { uid },
      include: {
        employeeDetails: { select: { displayName: true } },
        researchProfileIdentity: true,
      },
    });

    if (!user) {
      throw new Error(`User not found for uid=${uid}`);
    }

    console.log(JSON.stringify({
      step: 'found_user',
      uid: user.uid,
      userId: user.id,
      name: user.employeeDetails?.displayName || null,
      filterSgtOnly: user.researchProfileIdentity?.filterSgtOnly ?? null,
      scopusAuthorId: user.researchProfileIdentity?.scopusAuthorId || null,
    }, null, 2));

    const profile = user.researchProfileIdentity;

    // 1) Collect auto-imported contribution IDs via publication_import links
    const importLinks = profile
      ? await prisma.publicationImport.findMany({
          where: { researchProfileId: profile.id },
          select: { id: true, researchContributionId: true, sourceSystem: true },
        })
      : [];

    const importContributionIds = [
      ...new Set(importLinks.map((row) => row.researchContributionId).filter(Boolean)),
    ];

    // 2) Also catch synced papers owned by this user (sourceSystems / importedAt)
    const syncedOwned = await prisma.researchContribution.findMany({
      where: {
        applicantUserId: user.id,
        OR: [
          { id: { in: importContributionIds.length ? importContributionIds : ['00000000-0000-0000-0000-000000000000'] } },
          { importedAt: { not: null } },
          { sourceSystems: { hasSome: ['scopus', 'orcid', 'openalex'] } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        sourceSystems: true,
        importedAt: true,
      },
    });

    console.log(JSON.stringify({
      step: 'planned_delete',
      importLinkCount: importLinks.length,
      contributionCount: syncedOwned.length,
      titles: syncedOwned.slice(0, 25).map((c) => c.title),
    }, null, 2));

    // Detach progress trackers that point at these contributions
    const ids = syncedOwned.map((c) => c.id);
    if (ids.length > 0) {
      await prisma.researchProgressTracker.updateMany({
        where: { researchContributionId: { in: ids } },
        data: { researchContributionId: null },
      });
    }

    // Delete import links for this profile (must go before/around contribution deletes)
    if (profile) {
      const deletedImports = await prisma.publicationImport.deleteMany({
        where: { researchProfileId: profile.id },
      });
      console.log(JSON.stringify({ step: 'deleted_import_links', count: deletedImports.count }));
    }

    // Hard-delete synced contributions (child rows cascade where configured)
    let deletedContributions = 0;
    for (const contribution of syncedOwned) {
      await prisma.researchContribution.delete({ where: { id: contribution.id } });
      deletedContributions += 1;
    }
    console.log(JSON.stringify({ step: 'deleted_contributions', count: deletedContributions }));

    // Enable SGT-only filter and reset sync markers
    if (profile) {
      await prisma.researchProfileIdentity.update({
        where: { id: profile.id },
        data: {
          filterSgtOnly: true,
          autoSyncEnabled: true,
          syncStatus: 'never_synced',
          syncError: null,
          lastSyncedAt: null,
        },
      });
      console.log(JSON.stringify({ step: 'enabled_filter_sgt_only', filterSgtOnly: true }));
    } else {
      await prisma.researchProfileIdentity.create({
        data: {
          userId: user.id,
          filterSgtOnly: true,
          autoSyncEnabled: true,
          syncStatus: 'never_synced',
        },
      });
      console.log(JSON.stringify({ step: 'created_identity_with_filter_sgt_only' }));
    }

    // Re-sync using the live service
    const { publicationSyncService } = require('../src/modules/research/services');
    console.log(JSON.stringify({ step: 'resync_started', userId: user.id }));
    const result = await publicationSyncService.syncFacultyPublications(user.id, {
      triggerType: 'manual',
      sourcePreference: 'all',
    });
    console.log(JSON.stringify({
      step: 'resync_finished',
      discoveredCount: result.discoveredCount,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      specialReviewCount: result.specialReviewCount,
      errors: (result.errors || []).slice(0, 10),
    }, null, 2));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
});
