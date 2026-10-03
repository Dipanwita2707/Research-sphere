/**
 * Backfill the incentive payout ledger from work approved before the ledger existed.
 *
 *   node scripts/finance/backfill-payouts.js            # dry run (default): report only
 *   node scripts/finance/backfill-payouts.js --apply    # write
 *
 * For every university:
 *   a) store the work key on research contributions that have none
 *   b) report duplicate claims: active contributions that share a work key
 *   c) approved/completed contributions without payout lines → one line per internal author
 *      (from ResearchContributionAuthor incentiveShare / pointsShare). Contributions that are
 *      part of a duplicate group get their lines put ON HOLD for finance to verify.
 *   d) approved/completed grants (applicant gets the full incentive) and credited IPR
 *      applications (each internal inventor gets the stored per-inventor share)
 *
 * Idempotent: anything that already has payout lines is skipped, and the ledger's unique
 * keys stop doubles. Lines are created as pending_verification (or on_hold), never paid.
 */

'use strict';

require('dotenv').config({ quiet: true });

const prisma = require('../../src/shared/config/database');
const tenantContext = require('../../src/shared/tenancy/tenantContext');
const { computeWorkKey, computeTitleKey, ACTIVE_CLAIM_STATUSES } = require('../../src/modules/research/services/duplicateClaim.service');
const payoutService = require('../../src/modules/finance/services/incentivePayout.service');
const { createGrantPayoutLines } = require('../../src/modules/grants/services/grant.service');
const { IPR_CREDITED_STATUSES, resolveIprInventors, createIprPayoutLines } = require('../../src/modules/research/utils/iprIncentive');

const APPLY = process.argv.includes('--apply');
const PAID_CONTRIBUTION_STATUSES = ['approved', 'completed'];
const PAID_GRANT_STATUSES = ['approved', 'completed'];

const sys = (fn) => tenantContext.runAsSystem(fn);
const nameOf = (user) => {
  const p = user?.employeeDetails || user?.studentLogin;
  return p?.displayName || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || user?.uid || '?';
};
const USER_NAME = {
  select: {
    uid: true,
    employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
    studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
  },
};

function newSummary(u) {
  return {
    university: `${u.code} (${u.name})`,
    workKeys: { missing: 0, computed: 0, uncomputable: 0 },
    duplicateGroups: [],
    contributions: { candidates: 0, linesCreated: 0, wouldCreate: 0, onHold: 0, noEligibleAuthors: 0, alreadyPaidViaOtherClaim: 0, alreadyInLedger: 0 },
    grants: { candidates: 0, linesCreated: 0, wouldCreate: 0, noIncentive: 0, alreadyInLedger: 0 },
    ipr: { candidates: 0, linesCreated: 0, wouldCreate: 0, noIncentive: 0, alreadyInLedger: 0, creditedAtSet: 0 },
    warnings: [],
  };
}

async function existingSources(sourceType) {
  const rows = await prisma.incentivePayout.findMany({ where: { sourceType }, select: { sourceId: true }, distinct: ['sourceId'] });
  return new Set(rows.map((r) => r.sourceId));
}

// ─── a + b: work keys and duplicate groups ──────────────────────────────────

async function workKeysAndDuplicates(summary) {
  const rows = await prisma.researchContribution.findMany({
    select: {
      id: true, universityId: true, applicationNumber: true, status: true, title: true, publicationType: true,
      doi: true, paperDoi: true, isbn: true, publicationDate: true, conferenceDate: true, workKey: true, titleWorkKey: true,
      creditedAt: true, completedAt: true, updatedAt: true, applicantUser: USER_NAME,
    },
  });

  for (const c of rows) {
    // Title key: lets a DOI claim and a title-only claim of the same work collide.
    if (!c.titleWorkKey) {
      const tk = computeTitleKey(c);
      if (tk) {
        c.titleWorkKey = tk;
        if (APPLY) await prisma.researchContribution.update({ where: { id: c.id }, data: { titleWorkKey: tk } });
      }
    }
    if (c.workKey) continue;
    summary.workKeys.missing += 1;
    const key = computeWorkKey(c);
    if (!key) { summary.workKeys.uncomputable += 1; continue; }
    c.workKey = key; // effective key for this run (also in dry-run)
    summary.workKeys.computed += 1;
    if (APPLY) await prisma.researchContribution.update({ where: { id: c.id }, data: { workKey: key } });
  }

  const groups = new Map();
  for (const c of rows) {
    if (!c.workKey || !ACTIVE_CLAIM_STATUSES.includes(c.status)) continue;
    if (!groups.has(c.workKey)) groups.set(c.workKey, []);
    groups.get(c.workKey).push(c);
  }
  // Title-key duplicates where at least one side has no DOI (same rule as duplicateClaim.service).
  const byTitle = new Map();
  for (const c of rows) {
    if (!c.titleWorkKey || !ACTIVE_CLAIM_STATUSES.includes(c.status)) continue;
    if (!byTitle.has(c.titleWorkKey)) byTitle.set(c.titleWorkKey, []);
    byTitle.get(c.titleWorkKey).push(c);
  }
  for (const [tk, members] of byTitle) {
    const doiKeys = new Set(members.filter((m) => m.workKey?.startsWith('doi:')).map((m) => m.workKey));
    const hasNonDoi = members.some((m) => !m.workKey?.startsWith('doi:'));
    if (members.length < 2 || !hasNonDoi || doiKeys.size > 1) continue;
    const already = groups.get(members[0].workKey);
    if (already && members.every((m) => already.includes(m))) continue;
    groups.set(`title:${tk}`, members);
  }
  const groupOf = new Map();
  for (const [workKey, members] of groups) {
    if (members.length < 2) continue;
    summary.duplicateGroups.push({
      workKey,
      claims: members.map((m) => ({ applicationNumber: m.applicationNumber, applicant: nameOf(m.applicantUser), status: m.status, title: m.title.slice(0, 80) })),
    });
    for (const m of members) groupOf.set(m.id, members);
  }
  return { rows, groupOf };
}

// ─── c: research contributions ──────────────────────────────────────────────

async function backfillContributions(summary, { rows, groupOf }, actorId) {
  const inLedger = await existingSources('research_contribution');
  const candidates = rows.filter((c) => PAID_CONTRIBUTION_STATUSES.includes(c.status));
  summary.contributions.candidates = candidates.length;
  const todo = candidates.filter((c) => {
    if (inLedger.has(c.id)) { summary.contributions.alreadyInLedger += 1; return false; }
    return true;
  });
  if (!todo.length) return;

  const authors = await prisma.researchContributionAuthor.findMany({
    where: { researchContributionId: { in: todo.map((c) => c.id) } },
    select: { researchContributionId: true, userId: true, name: true, authorType: true, isInternal: true, incentiveShare: true, pointsShare: true },
  });
  const authorsOf = new Map();
  for (const a of authors) {
    if (!authorsOf.has(a.researchContributionId)) authorsOf.set(a.researchContributionId, []);
    authorsOf.get(a.researchContributionId).push(a);
  }

  for (const c of todo) {
    const eligible = (authorsOf.get(c.id) || []).filter(
      (a) => a.userId && a.isInternal !== false && (Number(a.incentiveShare) > 0 || Number(a.pointsShare) > 0),
    );
    if (!eligible.length) { summary.contributions.noEligibleAuthors += 1; continue; }

    // Authors already holding a line for this work through another claim are never paid twice.
    const blocked = c.workKey
      ? new Set((await prisma.incentivePayout.findMany({
          where: { workKey: c.workKey, payeeUserId: { in: eligible.map((a) => a.userId) }, NOT: { sourceId: c.id } },
          select: { payeeUserId: true },
        })).map((r) => r.payeeUserId))
      : new Set();
    const payable = eligible.filter((a) => !blocked.has(a.userId));
    if (!payable.length) { summary.contributions.alreadyPaidViaOtherClaim += 1; continue; }

    const group = groupOf.get(c.id);
    const others = group ? group.filter((m) => m.id !== c.id).map((m) => m.applicationNumber || m.id) : [];
    if (!APPLY) {
      summary.contributions.wouldCreate += payable.length;
      if (group) summary.contributions.onHold += payable.length;
      continue;
    }

    const approvedAt = c.creditedAt || c.completedAt || c.updatedAt;
    await prisma.$transaction(async (tx) => {
      const res = await payoutService.createLinesForContribution(tx, { contribution: c, authorShares: eligible, approvedAt, actorId });
      summary.contributions.linesCreated += res.created;
      if (!group || !res.created) return;
      const holdReason = `Possible duplicate claim of ${others.join(', ')} — verify before paying`;
      const lines = await tx.incentivePayout.findMany({
        where: { sourceType: 'research_contribution', sourceId: c.id, status: 'pending_verification', batchId: null },
        select: { id: true, approvedAmount: true },
      });
      await tx.incentivePayout.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { status: 'on_hold', holdReason } });
      await tx.incentivePayoutEvent.createMany({
        data: lines.map((l) => ({
          universityId: c.universityId, payoutId: l.id, action: 'backfill_hold', fromStatus: 'pending_verification',
          toStatus: 'on_hold', amount: l.approvedAmount, comments: holdReason, actorId,
        })),
      });
      summary.contributions.onHold += lines.length;
    });
  }
}

// ─── d: grants and IPR ──────────────────────────────────────────────────────

async function backfillGrants(summary, actorId) {
  const inLedger = await existingSources('grant');
  const grants = await prisma.grantApplication.findMany({
    where: { status: { in: PAID_GRANT_STATUSES } },
    select: {
      id: true, universityId: true, applicationNumber: true, title: true, applicantUserId: true, approvedAt: true, updatedAt: true,
      sanctionDate: true, dateOfSubmission: true, submittedAt: true,
      incentiveAmount: true, calculatedIncentiveAmount: true, pointsAwarded: true, calculatedPoints: true,
    },
  });
  summary.grants.candidates = grants.length;
  for (const g of grants) {
    if (inLedger.has(g.id)) { summary.grants.alreadyInLedger += 1; continue; }
    const amount = Number(g.incentiveAmount ?? g.calculatedIncentiveAmount) || 0;
    const points = Number(g.pointsAwarded ?? g.calculatedPoints) || 0;
    if ((amount <= 0 && points <= 0) || !g.applicantUserId) { summary.grants.noIncentive += 1; continue; }
    if (!APPLY) { summary.grants.wouldCreate += 1; continue; }
    const res = await prisma.$transaction((tx) => createGrantPayoutLines(tx, g, { approvedAt: g.approvedAt || g.updatedAt, actorId }));
    summary.grants.linesCreated += res.created;
  }
}

async function backfillIpr(summary, actorId) {
  const inLedger = await existingSources('ipr');
  const iprs = await prisma.iprApplication.findMany({
    where: { OR: [{ creditedAt: { not: null } }, { status: { in: IPR_CREDITED_STATUSES } }] },
    select: {
      id: true, universityId: true, applicationNumber: true, title: true, iprType: true, status: true, applicantUserId: true,
      publicationId: true, incentiveAmount: true, pointsAwarded: true, creditedAt: true, completedAt: true, publicationDate: true, updatedAt: true,
    },
  });
  summary.ipr.candidates = iprs.length;
  for (const ipr of iprs) {
    const approvedAt = ipr.creditedAt || ipr.completedAt || ipr.publicationDate || ipr.updatedAt;
    if (!ipr.creditedAt) {
      // creditedAt is the "incentive already credited" marker that guards re-crediting.
      summary.ipr.creditedAtSet += 1;
      if (APPLY) await prisma.iprApplication.update({ where: { id: ipr.id }, data: { creditedAt: approvedAt } });
    }
    if (inLedger.has(ipr.id)) { summary.ipr.alreadyInLedger += 1; continue; }
    const perIncentive = Number(ipr.incentiveAmount) || 0;
    const perPoints = Number(ipr.pointsAwarded) || 0;
    if (perIncentive <= 0 && perPoints <= 0) { summary.ipr.noIncentive += 1; continue; }

    // DRD publication split the incentive equally among inventors (stored per-inventor share).
    // Applications credited only through the old finance screen paid the applicant alone.
    const inventors = ipr.publicationId
      ? await resolveIprInventors(prisma, ipr)
      : (await resolveIprInventors(prisma, ipr)).filter((i) => i.userId === ipr.applicantUserId);
    if (!inventors.length) { summary.ipr.noIncentive += 1; continue; }
    if (!APPLY) { summary.ipr.wouldCreate += inventors.length; continue; }
    const res = await prisma.$transaction((tx) => createIprPayoutLines(tx, ipr, {
      inventors, perInventorIncentive: perIncentive, perInventorPoints: perPoints, approvedAt, actorId,
    }));
    summary.ipr.linesCreated += res.created;
  }
}

// ─── Driver ─────────────────────────────────────────────────────────────────

async function processUniversity(u) {
  const summary = newSummary(u);
  const admin = await sys(async () => prisma.userLogin.findFirst({
    where: { universityId: u.id, role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true, uid: true },
  }));
  if (!admin) summary.warnings.push('No admin user: payout lines not created for this university (events need an actor).');

  await tenantContext.runForTenant(u.id, async () => {
    const keyed = await workKeysAndDuplicates(summary);
    if (!admin) return;
    await backfillContributions(summary, keyed, admin.id);
    await backfillGrants(summary, admin.id);
    await backfillIpr(summary, admin.id);
  });
  return summary;
}

function print(summary) {
  const verb = APPLY ? 'created' : 'would create';
  const created = (s) => (APPLY ? s.linesCreated : s.wouldCreate);
  console.log(`\n=== ${summary.university} ===`);
  for (const w of summary.warnings) console.log(`  WARNING: ${w}`);
  const wk = summary.workKeys;
  console.log(`  Work keys: ${wk.missing} missing, ${wk.computed} ${APPLY ? 'stored' : 'computable'}, ${wk.uncomputable} not computable (no DOI/ISBN/usable title)`);
  console.log(`  Duplicate claim groups (active contributions sharing a work key): ${summary.duplicateGroups.length}`);
  for (const g of summary.duplicateGroups) {
    console.log(`    ${g.workKey}`);
    for (const c of g.claims) console.log(`      - ${c.applicationNumber || '(no number)'} | ${c.applicant} | ${c.status} | ${c.title}`);
  }
  const c = summary.contributions;
  console.log(`  Contributions approved/completed: ${c.candidates}; already in ledger ${c.alreadyInLedger}; no eligible internal author ${c.noEligibleAuthors}; authors already paid via another claim ${c.alreadyPaidViaOtherClaim}`);
  console.log(`    lines ${verb}: ${created(c)} (of which on hold as possible duplicates: ${c.onHold})`);
  const g = summary.grants;
  console.log(`  Grants approved/completed: ${g.candidates}; already in ledger ${g.alreadyInLedger}; no incentive ${g.noIncentive}; lines ${verb}: ${created(g)}`);
  const i = summary.ipr;
  console.log(`  IPR credited: ${i.candidates}; creditedAt ${APPLY ? 'set' : 'to set'} ${i.creditedAtSet}; already in ledger ${i.alreadyInLedger}; no incentive/inventor ${i.noIncentive}; lines ${verb}: ${created(i)}`);
}

async function main() {
  console.log(`Incentive payout backfill — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes; pass --apply to write)'}`);
  const universities = await sys(async () => prisma.university.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }));
  const totals = { lines: 0, holds: 0, workKeys: 0, duplicateGroups: 0 };
  for (const u of universities) {
    const s = await processUniversity(u);
    print(s);
    const pick = (x) => (APPLY ? x.linesCreated : x.wouldCreate);
    totals.lines += pick(s.contributions) + pick(s.grants) + pick(s.ipr);
    totals.holds += s.contributions.onHold;
    totals.workKeys += s.workKeys.computed;
    totals.duplicateGroups += s.duplicateGroups.length;
  }
  console.log(`\nTotal over ${universities.length} universities: work keys ${APPLY ? 'stored' : 'to store'} ${totals.workKeys}, ` +
    `duplicate groups ${totals.duplicateGroups}, payout lines ${APPLY ? 'created' : 'to create'} ${totals.lines} (on hold ${totals.holds}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
