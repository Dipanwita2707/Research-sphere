/**
 * Diagnose SGT filter decisions for a user without writing contributions.
 * Usage: node scripts/diagnose-sgt-filter.js <uid>
 */
const path = require('path');

async function main() {
  const uid = String(process.argv[2] || '').trim();
  process.chdir(path.resolve(__dirname, '..'));
  const { publicationSyncService, prisma } = require('../src/modules/research/services');

  try {
    const user = await prisma.userLogin.findFirst({
      where: { uid },
      include: {
        employeeDetails: { include: { primarySchool: true, primaryDepartment: true } },
        researchProfileIdentity: true,
        university: { select: { id: true, name: true, code: true, city: true, state: true } },
      },
    });
    if (!user) throw new Error('user not found');

    await publicationSyncService._loadAffiliationContext(user);
    const identity = user.researchProfileIdentity;

    console.log(JSON.stringify({
      uid: user.uid,
      university: user.university,
      universityCode: publicationSyncService._universityCode,
      isSgtTenant: publicationSyncService._isSgtTenant(),
      canonicalName: publicationSyncService._canonicalUniversityName,
      variantCount: publicationSyncService._affiliationVariants.length,
      variantsSample: publicationSyncService._affiliationVariants.slice(0, 15),
      filterSgtOnly: identity?.filterSgtOnly,
      scopusAuthorId: identity?.scopusAuthorId,
    }, null, 2));

    const { candidates, sourceErrors } = await publicationSyncService._discoverCandidates(
      user,
      identity,
      publicationSyncService._determineSourceSystems(identity, 'all')
    );

    console.log(JSON.stringify({ discovered: candidates.length, sourceErrors }, null, 2));

    const decisions = candidates.slice(0, 30).map((candidate) => {
      const owner = publicationSyncService._matchOwningFaculty(candidate.authors || [], user, identity);
      const home = publicationSyncService._isHomeInstitutionAuthor(owner, candidate);
      return {
        title: candidate.title,
        sources: candidate.sourceSystems,
        homeInstitutionOnPaper: Boolean(candidate.homeInstitutionOnPaper),
        ownerName: owner?.name || null,
        ownerAffil: owner?.affiliation || null,
        ownerIsSgtByAfid: Boolean(owner?.isSgtByAfid),
        ownerAfids: owner?.scopusAfids || [],
        wouldImport: home,
        authorCount: (candidate.authors || []).length,
        authorAffils: (candidate.authors || []).slice(0, 4).map((a) => ({
          name: a.name,
          affil: a.affiliation,
          isSgtByAfid: a.isSgtByAfid,
          afids: a.scopusAfids || [],
        })),
      };
    });

    console.log(JSON.stringify({
      wouldImportCount: decisions.filter((d) => d.wouldImport).length,
      wouldSkipCount: decisions.filter((d) => !d.wouldImport).length,
      decisions,
    }, null, 2));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
