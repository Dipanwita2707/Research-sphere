const bcrypt = require('bcryptjs');
const { validatePasswordPolicy, checkNewPassword, MIN_LENGTH } = require('../utils/passwordPolicy');

describe('password policy', () => {
  const user = { uid: 'jdoe2024', email: 'john.doe@uni.edu' };

  it('accepts a password with letters and digits of the minimum length', () => {
    expect(MIN_LENGTH).toBe(10);
    expect(validatePasswordPolicy('abcdefgh12', user)).toBeNull();
  });

  it('rejects missing or non-string passwords', () => {
    expect(validatePasswordPolicy(undefined, user)).toMatch(/required/i);
    expect(validatePasswordPolicy('', user)).toMatch(/required/i);
    expect(validatePasswordPolicy(12345678901, user)).toMatch(/required/i);
  });

  it('rejects passwords shorter than 10 characters', () => {
    expect(validatePasswordPolicy('abcde1234', user)).toMatch(/at least 10/);
  });

  it('rejects overly long passwords', () => {
    expect(validatePasswordPolicy(`a1${'x'.repeat(200)}`, user)).toMatch(/at most/);
  });

  it('requires at least one letter and one digit', () => {
    expect(validatePasswordPolicy('abcdefghijk', user)).toMatch(/letter and one digit/);
    expect(validatePasswordPolicy('12345678901', user)).toMatch(/letter and one digit/);
  });

  it('rejects a password equal to the uid or email (case-insensitive)', () => {
    const u = { uid: 'Student2024', email: 'Alice.Smith1@uni.edu' };
    expect(validatePasswordPolicy('student2024', u)).toMatch(/username or email/);
    expect(validatePasswordPolicy('student2025', u)).toBeNull();
    expect(validatePasswordPolicy('alice.smith1@uni.edu', u)).toMatch(/username or email/);
    expect(validatePasswordPolicy('ALICE.SMITH1', u)).toMatch(/username or email/);
  });

  it('works without user identifiers', () => {
    expect(validatePasswordPolicy('abcdefgh12')).toBeNull();
    expect(validatePasswordPolicy('abcdefgh12', { uid: null, email: null })).toBeNull();
  });

  describe('checkNewPassword', () => {
    let currentHash;
    beforeAll(async () => {
      currentHash = await bcrypt.hash('CurrentPass123', 4);
    });

    it('rejects reuse of the current password', async () => {
      await expect(checkNewPassword('CurrentPass123', { ...user, passwordHash: currentHash }))
        .resolves.toMatch(/different from your current password/);
    });

    it('accepts a new compliant password', async () => {
      await expect(checkNewPassword('BrandNewPass9', { ...user, passwordHash: currentHash })).resolves.toBeNull();
    });

    it('applies the rule checks before comparing hashes', async () => {
      await expect(checkNewPassword('short1', { ...user, passwordHash: currentHash })).resolves.toMatch(/at least 10/);
    });
  });
});
