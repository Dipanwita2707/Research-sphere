/**
 * Forgot/reset password: hashed single-use tokens, generic responses, session revocation.
 */
const crypto = require('crypto');

const mockTx = {
  passwordResetToken: { updateMany: jest.fn(), deleteMany: jest.fn() },
  userLogin: { update: jest.fn() },
};
const mockPrisma = {
  userLogin: { findFirst: jest.fn(), findUnique: jest.fn() },
  passwordResetToken: { findUnique: jest.fn(), deleteMany: jest.fn((a) => a), create: jest.fn((a) => a) },
  $transaction: jest.fn(),
};
const mockSendEmail = jest.fn(() => Promise.resolve());
const mockInvalidateUser = jest.fn();

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/config/redis', () => ({ invalidateUser: (...a) => mockInvalidateUser(...a) }));
jest.mock('../../core/services/email.service', () => ({ emailService: { sendEmail: (...a) => mockSendEmail(...a) } }));
jest.mock('../../../shared/middleware/audit.middleware', () => ({ getClientIp: () => '127.0.0.1' }));
jest.mock('../../../shared/utils/logger', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../../audit/services/audit.service', () => ({
  auditService: { log: jest.fn(() => Promise.resolve()) },
  AuditActionType: { UPDATE: 'UPDATE' },
  AuditSeverity: { INFO: 'INFO' },
  AuditModule: { AUTH: 'auth' },
}));

const bcrypt = require('bcryptjs');
const { forgotPassword, resetPassword } = require('../controllers/forgotPassword.controller');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const flush = () => new Promise((r) => setImmediate(r));
const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const reqWith = (body) => ({ body, headers: {}, originalUrl: '/api/v1/auth/x' });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((arg) => (typeof arg === 'function' ? arg(mockTx) : Promise.all(arg)));
});

describe('forgotPassword', () => {
  const GENERIC = { success: true, message: 'If this email is registered you will receive a reset link shortly.' };

  it('answers generically for an unknown email and sends nothing', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await forgotPassword(reqWith({ email: 'Nobody@Uni.edu' }), res);
    await flush();

    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(mockPrisma.userLogin.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'nobody@uni.edu' } }));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('stores only the SHA-256 of the token, replaces older tokens, and emails the raw token', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue({ id: 'u1', email: 'a@uni.edu', uid: 'a1', status: 'active', anonymizedAt: null, employeeDetails: null });
    const res = makeRes();
    await forgotPassword(reqWith({ email: 'a@uni.edu' }), res);
    await flush();

    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    const { data } = mockPrisma.passwordResetToken.create.mock.calls[0][0];
    const expiryMinutes = (data.expiresAt.getTime() - Date.now()) / 60000;
    expect(expiryMinutes).toBeGreaterThan(29);
    expect(expiryMinutes).toBeLessThanOrEqual(30);

    const rawToken = /token=([0-9a-f]+)/.exec(mockSendEmail.mock.calls[0][0].text)[1];
    expect(data.token).toBe(sha256(rawToken));
    expect(data.token).not.toBe(rawToken);
  });

  it('does not issue links for deactivated accounts', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue({ id: 'u1', email: 'a@uni.edu', uid: 'a1', status: 'inactive', anonymizedAt: null });
    const res = makeRes();
    await forgotPassword(reqWith({ email: 'a@uni.edu' }), res);
    await flush();

    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  const RAW = 'ab'.repeat(32);
  let currentHash;
  beforeAll(async () => {
    currentHash = await bcrypt.hash('OldPassword1', 4);
  });

  const validRecord = () => ({ id: 't1', userId: 'u1', token: sha256(RAW), usedAt: null, expiresAt: new Date(Date.now() + 10 * 60000) });
  const activeUser = () => ({ id: 'u1', uid: 'a1', email: 'a@uni.edu', passwordHash: currentHash, status: 'active', anonymizedAt: null, universityId: 'uni' });

  it('looks the token up by its hash and rejects unknown/used/expired tokens with one message', async () => {
    for (const record of [null, { ...validRecord(), usedAt: new Date() }, { ...validRecord(), expiresAt: new Date(Date.now() - 1000) }]) {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce(record);
      const res = makeRes();
      await resetPassword(reqWith({ token: RAW, newPassword: 'NewPassword12', confirmPassword: 'NewPassword12' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].code).toBe('RESET_LINK_INVALID');
    }
    expect(mockPrisma.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { token: sha256(RAW) } });
  });

  it('enforces the password policy, including reuse of the current password', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
    mockPrisma.userLogin.findUnique.mockResolvedValue(activeUser());

    let res = makeRes();
    await resetPassword(reqWith({ token: RAW, newPassword: 'short1', confirmPassword: 'short1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await resetPassword(reqWith({ token: RAW, newPassword: 'OldPassword1', confirmPassword: 'OldPassword1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/different from your current password/);
    expect(mockTx.userLogin.update).not.toHaveBeenCalled();
  });

  it('claims the token once, updates the password, revokes sessions and clears the lockout', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
    mockPrisma.userLogin.findUnique.mockResolvedValue(activeUser());
    mockTx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

    const res = makeRes();
    await resetPassword(reqWith({ token: RAW, newPassword: 'NewPassword12', confirmPassword: 'NewPassword12' }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockTx.passwordResetToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 't1', usedAt: null }),
    }));
    const { data } = mockTx.userLogin.update.mock.calls[0][0];
    expect(data).toEqual(expect.objectContaining({
      tokenVersion: { increment: 1 },
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: expect.any(Date),
    }));
    expect(await bcrypt.compare('NewPassword12', data.passwordHash)).toBe(true);
    expect(mockInvalidateUser).toHaveBeenCalledWith('u1');
  });

  it('fails when a concurrent request already used the token', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
    mockPrisma.userLogin.findUnique.mockResolvedValue(activeUser());
    mockTx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

    const res = makeRes();
    await resetPassword(reqWith({ token: RAW, newPassword: 'NewPassword12', confirmPassword: 'NewPassword12' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockTx.userLogin.update).not.toHaveBeenCalled();
    expect(mockInvalidateUser).not.toHaveBeenCalled();
  });
});
