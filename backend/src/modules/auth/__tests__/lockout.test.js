const { getLockState, recordFailedLogin, successfulLoginData, lockedResponseBody } = require('../utils/lockout');

const makeDb = (attemptsAfterIncrement) => ({
  userLogin: {
    update: jest.fn()
      .mockResolvedValueOnce({ failedLoginAttempts: attemptsAfterIncrement })
      .mockResolvedValue({}),
  },
});

describe('lockout: getLockState', () => {
  const now = new Date('2026-09-30T10:00:00Z');

  it('is unlocked when lockedUntil is empty or in the past', () => {
    expect(getLockState({ lockedUntil: null }, now)).toEqual({ locked: false, minutesRemaining: 0 });
    expect(getLockState({}, now)).toEqual({ locked: false, minutesRemaining: 0 });
    expect(getLockState({ lockedUntil: new Date('2026-09-30T09:59:59Z') }, now).locked).toBe(false);
    expect(getLockState({ lockedUntil: now }, now).locked).toBe(false);
  });

  it('reports the remaining minutes, rounded up, at least 1', () => {
    expect(getLockState({ lockedUntil: new Date('2026-09-30T10:14:01Z') }, now)).toEqual({ locked: true, minutesRemaining: 15 });
    expect(getLockState({ lockedUntil: new Date('2026-09-30T10:00:05Z') }, now)).toEqual({ locked: true, minutesRemaining: 1 });
    expect(getLockState({ lockedUntil: '2026-09-30T10:05:00Z' }, now)).toEqual({ locked: true, minutesRemaining: 5 });
  });
});

describe('lockout: recordFailedLogin', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const opts = { now, maxAttempts: 5, lockoutMinutes: 15 };

  it('increments the counter atomically and does not lock below the limit', async () => {
    const db = makeDb(3);
    const result = await recordFailedLogin(db, 'user-1', opts);

    expect(result).toEqual({ locked: false, attempts: 3 });
    expect(db.userLogin.update).toHaveBeenCalledTimes(1);
    expect(db.userLogin.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
  });

  it('locks the account for lockoutMinutes when the limit is reached and resets the counter', async () => {
    const db = makeDb(5);
    const result = await recordFailedLogin(db, 'user-1', opts);

    const expectedUntil = new Date('2026-09-30T10:15:00Z');
    expect(result).toEqual({ locked: true, attempts: 5, lockedUntil: expectedUntil, minutesRemaining: 15 });
    expect(db.userLogin.update).toHaveBeenLastCalledWith({
      where: { id: 'user-1' },
      data: { lockedUntil: expectedUntil, failedLoginAttempts: 0 },
    });
  });

  it('also locks when concurrent failures push the counter past the limit', async () => {
    const db = makeDb(7);
    const result = await recordFailedLogin(db, 'user-1', opts);
    expect(result.locked).toBe(true);
  });

  it('defaults to config.security settings', async () => {
    const config = require('../../../shared/config/app.config');
    const db = makeDb(config.security.maxLoginAttempts);
    const result = await recordFailedLogin(db, 'user-1', { now });
    expect(result.locked).toBe(true);
    expect(result.minutesRemaining).toBe(config.security.lockoutDuration);
  });
});

describe('lockout: helpers', () => {
  it('successfulLoginData clears the counter and lock', () => {
    const now = new Date();
    expect(successfulLoginData(now)).toEqual({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now });
  });

  it('lockedResponseBody carries the code and minutes', () => {
    expect(lockedResponseBody(1)).toMatchObject({ success: false, code: 'ACCOUNT_LOCKED', minutesRemaining: 1 });
    expect(lockedResponseBody(1).message).toMatch(/1 more minute\./);
    expect(lockedResponseBody(12).message).toMatch(/12 more minutes\./);
  });
});
