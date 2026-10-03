/**
 * Unit tests: finance settings (batch self-approval switch). Prisma is mocked.
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/tenancy/tenantContext', () => ({ getTenantId: () => 'uni-1', get: () => ({ tenantId: 'uni-1' }) }));

const settings = require('../../../modules/finance/services/financeSettings.service');

beforeEach(() => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  let row = null;
  Object.assign(mockPrisma, {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    financeSettings: {
      findFirst: jest.fn(async () => row),
      create: jest.fn(async ({ data }) => { row = { id: 's1', ...data }; return row; }),
      update: jest.fn(async ({ data }) => { row = { ...row, ...data }; return row; }),
    },
    incentivePayoutEvent: { create: jest.fn(async ({ data }) => data) },
  });
});

test('defaults to the two-person rule', async () => {
  await expect(settings.getSettings()).resolves.toMatchObject({ allowSelfApproval: false });
});

test('changing the rule needs a boolean and a reason, and is logged', async () => {
  const admin = { id: 'admin' };
  await expect(settings.updateSettings({ allowSelfApproval: 'yes', reason: 'Only one finance officer' }, admin)).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
  await expect(settings.updateSettings({ allowSelfApproval: true, reason: 'short' }, admin)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  await expect(settings.updateSettings({ allowSelfApproval: true, reason: 'Only one finance officer' }, admin)).resolves.toMatchObject({ allowSelfApproval: true });
  expect(mockPrisma.financeSettings.create).toHaveBeenCalledWith({ data: { universityId: 'uni-1', allowSelfApproval: true, updatedById: 'admin' } });
  expect(mockPrisma.incentivePayoutEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'self_approval_enabled', comments: expect.stringContaining('Only one finance officer'), actorId: 'admin' }) });

  // No-op change writes nothing.
  mockPrisma.incentivePayoutEvent.create.mockClear();
  await settings.updateSettings({ allowSelfApproval: true, reason: 'Only one finance officer' }, admin);
  expect(mockPrisma.incentivePayoutEvent.create).not.toHaveBeenCalled();

  await settings.updateSettings({ allowSelfApproval: false, reason: 'Second officer has joined' }, admin);
  expect(mockPrisma.incentivePayoutEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'self_approval_disabled' }) });
});
