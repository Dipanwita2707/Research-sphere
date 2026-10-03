/**
 * Student PhD fields (doctoral programmes): date format, award >= registration, not in the future.
 */
const { validateStudentPhdFields, hasPhdValues, validateUpdateStudent } = require('../../../shared/validations/student.validation');

const NOW = new Date('2026-10-02T06:00:00Z');

describe('validateStudentPhdFields', () => {
  it('accepts valid dates and a thesis title', () => {
    const r = validateStudentPhdFields({ phdRegistrationDate: '2021-08-01', phdAwardedAt: '2025-12-15', thesisTitle: '  On things ' }, {}, NOW);
    expect(r.success).toBe(true);
    expect(r.data.phdRegistrationDate.toISOString()).toBe('2021-08-01T00:00:00.000Z');
    expect(r.data.phdAwardedAt.toISOString()).toBe('2025-12-15T00:00:00.000Z');
    expect(r.data.thesisTitle).toBe('On things');
  });

  it('only returns the keys that were sent', () => {
    expect(validateStudentPhdFields({}, {}, NOW).data).toEqual({});
  });

  it('rejects an award before the registration', () => {
    const r = validateStudentPhdFields({ phdRegistrationDate: '2024-01-01', phdAwardedAt: '2023-12-31' }, {}, NOW);
    expect(r.success).toBe(false);
    expect(r.errors.phdAwardedAt).toMatch(/before the registration/);
  });

  it('checks a partial update against the stored registration date', () => {
    const r = validateStudentPhdFields({ phdAwardedAt: '2020-01-01' }, { phdRegistrationDate: new Date('2021-01-01') }, NOW);
    expect(r.success).toBe(false);
  });

  it('requires a registration date for an award', () => {
    const r = validateStudentPhdFields({ phdAwardedAt: '2025-01-01' }, {}, NOW);
    expect(r.errors.phdRegistrationDate).toBeDefined();
  });

  it('rejects invalid and future dates', () => {
    expect(validateStudentPhdFields({ phdRegistrationDate: '2024-13-01' }, {}, NOW).success).toBe(false);
    expect(validateStudentPhdFields({ phdRegistrationDate: '2027-01-01' }, {}, NOW).errors.phdRegistrationDate).toMatch(/future/);
  });

  it('clears fields sent as empty', () => {
    const r = validateStudentPhdFields({ phdRegistrationDate: '', phdAwardedAt: null, thesisTitle: '' }, {}, NOW);
    expect(r.data).toEqual({ phdRegistrationDate: null, phdAwardedAt: null, thesisTitle: null });
    expect(hasPhdValues(r.data)).toBe(false);
  });

  it('rejects an over-long thesis title', () => {
    expect(validateStudentPhdFields({ thesisTitle: 'x'.repeat(513) }, {}, NOW).success).toBe(false);
  });

  it('is accepted by the strict update schema', () => {
    expect(validateUpdateStudent({ phdRegistrationDate: '2021-08-01', phdAwardedAt: '', thesisTitle: 'T' }).success).toBe(true);
  });
});
