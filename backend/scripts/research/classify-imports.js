/**
 * One-off: bring existing synced works into the "researcher submits for incentive" flow.
 *
 *   1. Classify every auto-imported contribution that has no home-affiliation yet, from the data
 *      stored with it (the owner's author row, the per-author affiliation summary) plus the
 *      byline affiliation stored with it — the same rules as a sync (_classifyHomeAffiliation).
 *      Scopus AF-IDs are not stored, so a later re-sync can still upgrade "unknown" to "affiliated".
 *   2. Return auto-imported works to draft when DRD has not touched them: status "submitted",
 *      no review, no status change after the automatic submit, no payout line. The researcher then
 *      decides what to submit. Anything reviewed, approved or paid is left alone.
 *
 * Dry run by default (prints what it would do). Writes only with --apply.
 *   node scripts/research/classify-imports.js [--apply] [--university <id>]
 */
require('dotenv').config({ quiet: true });

const prisma = require('../../src/shared/config/database');
const tenantContext = require('../../src/shared/tenancy/tenantContext');
const PublicationSyncService = require('../../src/modules/research/services/publicationSync.service');

const APPLY = process.argv.includes('--apply');
const uniArg = process.argv.indexOf('--university');
const ONLY_UNIVERSITY = uniArg > -1 ? process.argv[uniArg + 1] : null;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

async function ownerAuthorOf(c) {
  const rows = c.authors || [];
  const own = rows.find((a) => a.userId === c.applicantUserId)
    || rows.find((a) => a.uid && c.applicantUser?.uid && a.uid.toLowerCase() === c.applicantUser.uid.toLowerCase());
  let affiliation = own?.affiliation || null;
  if (!affiliation && own?.name) {
    const summary = c.indexingDetails?.affiliationSummary?.authors || [];
    affiliation = summary.find((a) => norm(a.name) === norm(own.name))?.affiliation || null;
  }
  return own ? { name: own.name, affiliation } : null;
}

async function classifyUniversity(universityId, totals) {
  const contributions = await prisma.researchContribution.findMany({
    where: { sourceType: 'auto_import', homeAffiliation: null },
    select: {
      id: true, title: true, status: true, applicantUserId: true, publicationDate: true, indexingDetails: true,
      applicantUser: { select: { uid: true } },
      authors: { select: { userId: true, uid: true, name: true, affiliation: true } },
    },
  });
  const byOwner = new Map();
  for (const c of contributions) {
    if (!byOwner.has(c.applicantUserId)) byOwner.set(c.applicantUserId, []);
    byOwner.get(c.applicantUserId).push(c);
  }
  for (const [userId, works] of byOwner) {
    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { id: true, uid: true, universityId: true, university: { select: { code: true } }, researchProfileIdentity: true },
    });
    if (!user) continue;
    const sync = new PublicationSyncService(prisma, {});
    await sync._loadAffiliationContext(user, user.researchProfileIdentity);
    for (const c of works) {
      const owner = await ownerAuthorOf(c);
      const homeOnPaper = (c.indexingDetails?.affiliationSummary?.sgtAffiliatedCount || 0) > 0;
      const result = sync._classifyHomeAffiliation(owner, { publicationDate: c.publicationDate, homeInstitutionOnPaper: homeOnPaper });
      totals[result.status] += 1;
      if (APPLY) {
        await prisma.researchContribution.update({
          where: { id: c.id },
          data: { homeAffiliation: result.status, homeAffiliationBasis: result.basis, homeAffiliationDetail: result.detail },
        });
      }
    }
    console.log(`  ${user.uid}: ${works.length} classified from the stored byline affiliations`);
  }
}

async function returnUntouchedToDraft(totals) {
  const submitted = await prisma.researchContribution.findMany({
    where: { sourceType: 'auto_import', status: 'submitted' },
    select: {
      id: true, title: true, applicantUserId: true,
      _count: { select: { reviews: true, statusHistory: true } },
    },
  });
  for (const c of submitted) {
    const [payouts, laterChanges] = await Promise.all([
      prisma.incentivePayout.count({ where: { researchContributionId: c.id } }),
      // Any status beyond the automatic draft → submitted means someone acted on it.
      prisma.researchContributionStatusHistory.count({ where: { researchContributionId: c.id, toStatus: { notIn: ['draft', 'submitted'] } } }),
    ]);
    if (c._count.reviews > 0 || payouts > 0 || laterChanges > 0) {
      totals.keptSubmitted += 1;
      continue;
    }
    totals.returnedToDraft += 1;
    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      const moved = await tx.researchContribution.updateMany({
        where: { id: c.id, status: 'submitted' },
        data: { status: 'draft', submittedAt: null, currentReviewerId: null },
      });
      if (moved.count !== 1) return;
      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: c.id,
          fromStatus: 'submitted',
          toStatus: 'draft',
          changedById: c.applicantUserId,
          comments: 'Returned to draft: synced works are now submitted for incentive by the researcher (affiliated works only).',
        },
      });
    });
  }
}

(async () => {
  const universities = await tenantContext.runAsSystem(() => prisma.university.findMany({
    where: ONLY_UNIVERSITY ? { id: ONLY_UNIVERSITY } : {},
    select: { id: true, name: true },
  }));
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');
  for (const u of universities) {
    const totals = { affiliated: 0, not_affiliated: 0, unknown: 0, returnedToDraft: 0, keptSubmitted: 0 };
    await tenantContext.runForTenant(u.id, async () => {
      await classifyUniversity(u.id, totals);
      await returnUntouchedToDraft(totals);
    });
    console.log(`${u.name}:`, totals);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
