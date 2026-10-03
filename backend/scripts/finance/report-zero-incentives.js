/**
 * DRY-RUN REPORT — changes nothing.
 *
 *   node scripts/finance/report-zero-incentives.js            # human-readable report
 *   node scripts/finance/report-zero-incentives.js --json     # same, as JSON on stdout
 *
 * Lists work that was approved / completed / credited with a ₹0 incentive although an
 * incentive policy (or the built-in defaults the calculator uses) now applies, with the
 * amount the current rules would pay. It exists so the university can decide what to do
 * about earlier ₹0 approvals (e.g. ones approved before the right policy was enabled).
 *
 * Uses exactly the calculation paths the app uses:
 *   - research contributions → ReviewService._creditIncentivesToAuthors (author shares are
 *     NOT written: the report runs it against a read-only client)
 *   - grants → GrantService.calculateGrantIncentives with the grant's policy date
 *     (sanction → submission → approval)
 *   - IPR → resolveIprPolicy + computeIprIncentive (what publication pays)
 *
 * Read-only: every model the calculation touches is wrapped so that any write throws.
 */

'use strict';

require('dotenv').config({ quiet: true });

const prisma = require('../../src/shared/config/database');
const tenantContext = require('../../src/shared/tenancy/tenantContext');
const ReviewService = require('../../src/modules/research/services/review.service');
const GrantService = require('../../src/modules/grants/services/grant.service');
const GrantRepository = require('../../src/modules/grants/repositories/grant.repository');
const { grantPolicyDate } = require('../../src/modules/grants/utils/grantPolicyDate');
const {
  IPR_CREDITED_STATUSES, resolveIprPolicy, resolveIprInventors, computeIprIncentive,
} = require('../../src/modules/research/utils/iprIncentive');

const AS_JSON = process.argv.includes('--json');
const PAID_STATUSES = ['approved', 'completed'];
const READ_METHODS = new Set(['findFirst', 'findUnique', 'findMany', 'count', 'aggregate', 'groupBy']);

/** Model delegates that refuse writes, so the report can never change data. */
function readOnlyClient(client, models) {
  const out = {};
  for (const model of models) {
    out[model] = new Proxy(client[model], {
      get(target, prop) {
        if (READ_METHODS.has(prop)) return target[prop].bind(target);
        return () => { throw new Error(`report-zero-incentives is read-only (blocked ${model}.${String(prop)})`); };
      },
    });
  }
  return out;
}

const isZero = (v) => v === null || v === undefined || Number(v) === 0;
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const short = (t) => (t && t.length > 70 ? `${t.slice(0, 67)}...` : t || '');

async function contributionsFor(summary) {
  const dry = readOnlyClient(prisma, [
    'researchIncentivePolicy', 'bookIncentivePolicy', 'bookChapterIncentivePolicy', 'conferenceIncentivePolicy', 'userLogin',
  ]);
  // _creditIncentivesToAuthors updates each author's share; in the report that is a no-op.
  dry.researchContributionAuthor = { update: async () => ({}) };
  const service = new ReviewService(null, null, null, prisma, null);

  const rows = await prisma.researchContribution.findMany({
    where: { status: { in: PAID_STATUSES }, OR: [{ incentiveAmount: null }, { incentiveAmount: 0 }] },
    include: { authors: true, applicantUser: { select: { universityId: true } } },
    orderBy: { applicationNumber: 'asc' },
  });
  summary.contributions.checked = rows.length;
  for (const c of rows) {
    const r = await service._creditIncentivesToAuthors(c, c.id, dry);
    const item = {
      kind: 'research_contribution',
      id: c.id,
      applicationNumber: c.applicationNumber,
      publicationType: c.publicationType,
      title: short(c.title),
      status: c.status,
      policyDate: day(c.publicationDate),
      policyFound: r.incentiveStatus.policyFound,
      usedDefaultPolicy: r.incentiveStatus.usedDefaultPolicy,
      wouldPay: r.totalIncentiveAwarded,
      wouldAwardPoints: r.totalPointsAwarded,
      authors: r.authorShares.filter((a) => a.isInternal !== false && a.incentiveShare > 0)
        .map((a) => ({ name: a.name, share: a.incentiveShare, points: a.pointsShare })),
    };
    if (item.wouldPay > 0) summary.contributions.items.push(item);
    else summary.contributions.stillZero.push({ applicationNumber: c.applicationNumber, reason: r.incentiveStatus.reason || 'policy computes ₹0' });
  }
}

async function grantsFor(summary) {
  const repo = new GrantRepository(readOnlyClient(prisma, ['grantIncentivePolicy']));
  const service = new GrantService(repo);
  const rows = await prisma.grantApplication.findMany({
    where: { status: { in: PAID_STATUSES }, OR: [{ incentiveAmount: null }, { incentiveAmount: 0 }] },
    select: {
      id: true, applicationNumber: true, title: true, status: true, projectCategory: true, projectType: true,
      numberOfConsortiumOrgs: true, sanctionDate: true, dateOfSubmission: true, submittedAt: true, approvedAt: true,
    },
    orderBy: { applicationNumber: 'asc' },
  });
  summary.grants.checked = rows.length;
  for (const g of rows) {
    const pd = grantPolicyDate(g, g.approvedAt || new Date());
    const r = await service.calculateGrantIncentives(g.projectCategory, g.projectType, g.numberOfConsortiumOrgs || 0, pd.date);
    if (r.policyFound && Number(r.calculatedIncentiveAmount) > 0) {
      summary.grants.items.push({
        kind: 'grant', id: g.id, applicationNumber: g.applicationNumber, title: short(g.title), status: g.status,
        policyDate: day(pd.date), policyDateBasis: pd.basis, policyId: r.policyId,
        wouldPay: r.calculatedIncentiveAmount, wouldAwardPoints: r.calculatedPoints,
      });
    } else {
      summary.grants.stillZero.push({ applicationNumber: g.applicationNumber, reason: r.policyFound ? 'policy computes ₹0' : `no grant policy for ${g.projectCategory}/${g.projectType} on ${pd.label} ${day(pd.date)}` });
    }
  }
}

async function iprFor(summary) {
  const dry = readOnlyClient(prisma, ['incentivePolicy', 'iprContributor', 'userLogin']);
  const rows = await prisma.iprApplication.findMany({
    where: { status: { in: IPR_CREDITED_STATUSES }, OR: [{ incentiveAmount: null }, { incentiveAmount: 0 }] },
    select: { id: true, applicationNumber: true, title: true, status: true, iprType: true, applicantUserId: true, publicationDate: true, creditedAt: true },
    orderBy: { applicationNumber: 'asc' },
  });
  summary.ipr.checked = rows.length;
  for (const a of rows) {
    const onDate = a.creditedAt || a.publicationDate || new Date();
    const { policy, usedDefaultPolicy } = await resolveIprPolicy(dry, a.iprType, onDate);
    const inventors = await resolveIprInventors(dry, a);
    const r = computeIprIncentive(policy, inventors.length || 1);
    summary.ipr.items.push({
      kind: 'ipr', id: a.id, applicationNumber: a.applicationNumber, title: short(a.title), status: a.status,
      policyDate: day(onDate), usedDefaultPolicy, policyId: policy.id || null,
      wouldPay: r.totalIncentive, perInventor: r.perInventorIncentive, inventors: r.inventorCount,
    });
  }
}

function printText(report) {
  console.log('Zero-incentive approvals report — DRY RUN, no data changed');
  console.log(`Generated ${report.generatedAt}\n`);
  for (const u of report.universities) {
    console.log(`== ${u.university}`);
    for (const [label, part] of [['Research contributions', u.contributions], ['Grants', u.grants], ['IPR', u.ipr]]) {
      const total = part.items.reduce((s, i) => s + Number(i.wouldPay || 0), 0);
      console.log(`  ${label}: ${part.checked} approved at ₹0; ${part.items.length} would now pay (₹${total.toLocaleString('en-IN')})`);
      for (const i of part.items) {
        const how = i.usedDefaultPolicy ? 'built-in DEFAULT policy' : (i.policyId ? `policy ${i.policyId}` : 'configured policy');
        console.log(`    - ${i.applicationNumber} [${i.status}] ${i.publicationType || i.kind} dated ${i.policyDate}${i.policyDateBasis ? ` (${i.policyDateBasis})` : ''}: ₹${Number(i.wouldPay).toLocaleString('en-IN')} via ${how} — ${i.title}`);
      }
      if (part.stillZero?.length) {
        const reasons = {};
        for (const z of part.stillZero) reasons[z.reason] = (reasons[z.reason] || 0) + 1;
        for (const [reason, n] of Object.entries(reasons)) console.log(`    · ${n} still ₹0: ${reason}`);
      }
    }
    console.log('');
  }
  console.log(`TOTAL would pay: ₹${report.totalWouldPay.toLocaleString('en-IN')} across ${report.totalItems} item(s). Nothing was changed.`);
}

async function main() {
  const universities = await tenantContext.runAsSystem(() => prisma.university.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }));
  const report = { generatedAt: new Date().toISOString(), dryRun: true, universities: [], totalItems: 0, totalWouldPay: 0 };
  for (const u of universities) {
    const summary = {
      university: `${u.code} (${u.name})`,
      contributions: { checked: 0, items: [], stillZero: [] },
      grants: { checked: 0, items: [], stillZero: [] },
      ipr: { checked: 0, items: [] },
    };
    // Tenant-scoped, like a request from that university.
    await tenantContext.runForTenant(u.id, async () => {
      await contributionsFor(summary);
      await grantsFor(summary);
      await iprFor(summary);
    });
    for (const part of [summary.contributions, summary.grants, summary.ipr]) {
      report.totalItems += part.items.length;
      report.totalWouldPay += part.items.reduce((s, i) => s + Number(i.wouldPay || 0), 0);
    }
    report.universities.push(summary);
  }
  if (AS_JSON) console.log(JSON.stringify(report, null, 2));
  else printText(report);
}

if (require.main === module) {
  main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect?.().catch(() => {}).finally(() => process.exit()));
}

module.exports = { readOnlyClient, main };
