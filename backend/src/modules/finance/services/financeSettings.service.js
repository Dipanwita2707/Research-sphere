/**
 * Per-university finance rules (FinanceSettings). Today: allowSelfApproval — for small finance
 * teams, the person who prepared a payment batch or recommended its lines may also approve it,
 * giving a reason each time. Off by default (a second person approves).
 *
 * Only a tenant admin changes the rules (route guard); every change needs a reason and is
 * written to the payout event trail. Runs inside the request's tenant context.
 */
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');

class SettingsError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const DEFAULTS = { allowSelfApproval: false };
const PERSON = { select: { id: true, uid: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } };

function requireTenant() {
  const id = tenantContext.getTenantId();
  if (!id) throw new SettingsError(400, 'Select a university first', 'TENANT_REQUIRED');
  return id;
}

const serialize = (row) => ({
  allowSelfApproval: !!row?.allowSelfApproval,
  updatedAt: row?.updatedAt || null,
  updatedBy: row?.updatedBy || null,
});

/** GET /finance/settings */
async function getSettings(client = prisma) {
  requireTenant();
  const row = await client.financeSettings.findFirst({ include: { updatedBy: PERSON } });
  return serialize(row || DEFAULTS);
}

/** PUT /finance/settings — { allowSelfApproval: boolean, reason } */
async function updateSettings(input = {}, actor) {
  const universityId = requireTenant();
  if (typeof input.allowSelfApproval !== 'boolean') {
    throw new SettingsError(400, 'allowSelfApproval must be true or false', 'INVALID_SETTINGS');
  }
  const reason = String(input.reason || '').trim();
  if (reason.length < 10) throw new SettingsError(400, 'Give a reason for changing the approval rule (at least 10 characters)', 'REASON_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.financeSettings.findFirst();
    const before = !!existing?.allowSelfApproval;
    if (existing && before === input.allowSelfApproval) return getSettings(tx);
    if (existing) {
      await tx.financeSettings.update({ where: { id: existing.id }, data: { allowSelfApproval: input.allowSelfApproval, updatedById: actor.id } });
    } else {
      await tx.financeSettings.create({ data: { universityId, allowSelfApproval: input.allowSelfApproval, updatedById: actor.id } });
    }
    await tx.incentivePayoutEvent.create({
      data: {
        universityId,
        action: input.allowSelfApproval ? 'self_approval_enabled' : 'self_approval_disabled',
        comments: `${input.allowSelfApproval ? 'Allowed' : 'Stopped'} batch self-approval: ${reason.slice(0, 1900)}`,
        actorId: actor.id,
      },
    });
    return getSettings(tx);
  });
}

module.exports = { getSettings, updateSettings, SettingsError };
