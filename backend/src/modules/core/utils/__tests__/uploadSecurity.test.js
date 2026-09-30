/**
 * Upload folder validation (path traversal) and admin password generation.
 */
jest.mock('../../../../shared/config/database', () => ({}));

const { safeUploadFolder, uploaderOf, canDeleteFile } = require('../uploadPaths');
const { generateStrongPassword, preparePassword, PasswordPolicyError } = require('../userCredentials');
const { validatePasswordPolicy } = require('../../../auth/utils/passwordPolicy');
const bcrypt = require('bcryptjs');

describe('safeUploadFolder', () => {
  it.each([
    [undefined, 'documents'],
    ['', 'documents'],
    ['ipr/annexures', 'ipr/annexures'],
    ['programmes/btech-cs/batch-2026', 'programmes/btech-cs/batch-2026'],
    ['documents/', 'documents'],
  ])('accepts %p', (input, expected) => {
    expect(safeUploadFolder(input, 'documents')).toBe(expected);
  });

  it.each([
    '../etc',
    'documents/../../src',
    '/etc/passwd',
    'documents\\..\\x',
    'profiles',            // served by a different rule
    'bug-reports/screenshots',
    'audit-reports',
    'documents/a b',
    'documents/.hidden',
    'a/b/c/d/e/f',
    42,
  ])('rejects %p', (input) => {
    expect(safeUploadFolder(input, 'documents')).toBeNull();
  });
});

describe('uploaded file ownership', () => {
  const uid = '123e4567-e89b-12d3-a456-426614174000';
  it('finds the uploader segment', () => {
    expect(uploaderOf(['ipr', 'annexures', uid, 'f.pdf'])).toBe(uid);
    expect(uploaderOf(['documents', 'f.pdf'])).toBeNull();
  });
  it('lets only the uploader or an admin delete', () => {
    const segs = ['documents', uid, 'f.pdf'];
    expect(canDeleteFile(segs, { id: uid, role: 'faculty' })).toBe(true);
    expect(canDeleteFile(segs, { id: 'other', role: 'faculty' })).toBe(false);
    expect(canDeleteFile(segs, { id: 'other', role: 'admin' })).toBe(true);
    expect(canDeleteFile(segs, null)).toBe(false);
  });
});

describe('admin-set passwords', () => {
  it('generates strong random passwords that pass the policy', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const p = generateStrongPassword();
      expect(p).toHaveLength(16);
      expect(validatePasswordPolicy(p)).toBeNull();
      seen.add(p);
    }
    expect(seen.size).toBe(50);
  });

  it('generates and returns a password when none is given (no hardcoded default)', async () => {
    const out = await preparePassword(undefined, { uid: 'EMP1' });
    expect(out.generatedPassword).toBeTruthy();
    expect(out.generatedPassword).not.toBe('Welcome@123');
    expect(await bcrypt.compare(out.generatedPassword, out.passwordHash)).toBe(true);
    expect(out.passwordChangedAt).toBeInstanceOf(Date);
  });

  it('validates a chosen password against the policy', async () => {
    await expect(preparePassword('short1', {})).rejects.toBeInstanceOf(PasswordPolicyError);
    await expect(preparePassword('EMP0000001', { uid: 'emp0000001' })).rejects.toThrow(/username or email/);
    const ok = await preparePassword('correct-horse-9', { uid: 'x' });
    expect(ok.generatedPassword).toBeNull();
  });
});
