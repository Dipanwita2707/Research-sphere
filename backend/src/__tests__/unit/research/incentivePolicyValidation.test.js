/**
 * Shared incentive-policy validation and effective-window rules (all policy types).
 */
const v = require('../../../modules/research/validators/incentivePolicy.validation');
const { policyWindowWhere, windowsOverlap, resolveOverlaps, startOfUtcDay } = require('../../../modules/research/utils/policyWindow');

const errorsOf = (fn) => {
  try { fn(); } catch (e) { return { status: e.statusCode, message: e.message, errors: e.errors }; }
  return null;
};

const research = (over = {}) => ({
  publicationType: 'research_paper', policyName: 'RP 2027', baseIncentiveAmount: 0, basePoints: 0,
  effectiveFrom: '2027-01-01', ...over,
});

describe('research policy validation', () => {
  test('stores first/corresponding % and the position table in their columns (and mirrors JSON)', () => {
    const d = v.parseResearchPolicy(research({
      distributionMethod: 'author_position_based',
      first_author_percentage: 35, corresponding_author_percentage: 30,
      positionPercentages: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }],
      indexingBonuses: { indexingCategoryBonuses: [] },
    }));
    expect(d).toMatchObject({
      first_author_percentage: 35, corresponding_author_percentage: 30,
      positionBasedDistribution: { 1: 50, 2: 30, 3: 20, '6+': 0 },
    });
    expect(d.indexingBonuses.rolePercentages).toEqual([
      { role: 'first_author', percentage: 35 }, { role: 'corresponding_author', percentage: 30 },
    ]);
    expect(d.indexingBonuses.positionPercentages).toHaveLength(3);
    expect(d.effectiveFrom.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  test('older clients that only send indexingBonuses.rolePercentages still set the columns', () => {
    const d = v.parseResearchPolicy(research({
      indexingBonuses: { rolePercentages: [{ role: 'first_author', percentage: 35 }, { role: 'corresponding_author', percentage: 25 }] },
    }));
    expect(d.first_author_percentage).toBe(35);
    expect(d.corresponding_author_percentage).toBe(25);
  });

  test.each([
    [{ baseIncentiveAmount: -5 }, /Base incentive amount cannot be negative/],
    [{ publicationType: 'poster' }, /Publication type must be one of/],
    [{ distributionMethod: 'random' }, /Distribution method must be one of/],
    [{ effectiveTo: '2026-12-31' }, /Effective to date cannot be before/],
    [{ firstAuthorPercentage: 70, correspondingAuthorPercentage: 40 }, /cannot exceed 100%/],
    [{ firstAuthorPercentage: 120 }, /between 0 and 100/],
    [{ distributionMethod: 'author_position_based', positionBasedDistribution: { 1: 60, 2: 30 } }, /must total 100%/],
    [{ indexingBonuses: { indexingCategoryBonuses: [{ category: 'pubmed', incentiveAmount: -1 }] } }, /indexingBonuses\.indexingCategoryBonuses\[0\]\.incentiveAmount cannot be negative/],
    [{ indexingBonuses: { quartileIncentives: [{ quartile: 'Q1', incentiveAmount: 1, points: 1 }] } }, /Missing required quartile incentives/],
    [{ indexingBonuses: { sjrRanges: [{ minSJR: 2, maxSJR: 1, incentiveAmount: 1 }] } }, /minimum cannot be greater than maximum/],
    [{ effectiveFrom: 'not-a-date' }, /Effective from date must be a valid date/],
  ])('rejects %j with 400', (over, msg) => {
    const e = errorsOf(() => v.parseResearchPolicy(research(over)));
    expect(e.status).toBe(400);
    expect(e.message).toMatch(msg);
  });

  test('create requires effectiveFrom', () => {
    expect(errorsOf(() => v.parseResearchPolicy(research({ effectiveFrom: undefined }))).message).toMatch(/effectiveFrom/);
  });

  test('update validates the merged policy (stored values + changes)', () => {
    const existing = {
      publicationType: 'research_paper', policyName: 'Old', baseIncentiveAmount: { toNumber: () => 0 }, basePoints: 0,
      splitPolicy: 'percentage_based', distributionMethod: 'author_role_based',
      first_author_percentage: { toNumber: () => 40 }, corresponding_author_percentage: { toNumber: () => 30 },
      effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, indexingBonuses: {},
    };
    // only changing the corresponding % to 70 breaks the 100% limit with the stored 40
    expect(errorsOf(() => v.parseResearchPolicy({ correspondingAuthorPercentage: 70 }, existing)).message).toMatch(/cannot exceed 100%/);
    // a valid partial change keeps the stored values; publicationType cannot be changed
    const d = v.parseResearchPolicy({ policyName: 'Renamed', publicationType: 'book' }, existing);
    expect(d).toMatchObject({ policyName: 'Renamed', publicationType: 'research_paper', first_author_percentage: 40 });
  });
});

describe('book / chapter / conference / grant / IPR validation', () => {
  test('book: amounts required, non-negative, enum split policy, window order', () => {
    expect(v.parseBookPolicy({ policyName: 'B', authoredIncentiveAmount: '70000', editedIncentiveAmount: 40000 }))
      .toMatchObject({ authoredIncentiveAmount: 70000, splitPolicy: 'equal', internationalBonus: 5000 });
    expect(errorsOf(() => v.parseBookPolicy({ policyName: 'B', authoredIncentiveAmount: 1, editedIncentiveAmount: 1, indexingBonuses: { scopus_indexed: -1 } })).message)
      .toMatch(/Scopus-indexed bonus cannot be negative/);
    expect(errorsOf(() => v.parseBookPolicy({ policyName: 'B', authoredIncentiveAmount: 1, editedIncentiveAmount: 1, splitPolicy: 'lottery' })).message)
      .toMatch(/Split policy must be one of/);
    expect(errorsOf(() => v.parseBookPolicy({ policyName: 'B', authoredIncentiveAmount: 1, editedIncentiveAmount: 1, effectiveFrom: '2026-05-01', effectiveTo: '2026-04-01' })).status).toBe(400);
    expect(errorsOf(() => v.parseBookPublicationType('journal')).status).toBe(400);
  });

  test('book update: a stored NULL bonus stays 0 (no create-time default sneaks in)', () => {
    const d = v.parseBookPolicy({ policyName: 'X' }, {
      policyName: 'B', authoredIncentiveAmount: 1, editedIncentiveAmount: 1, authoredPoints: 1, editedPoints: 1,
      splitPolicy: 'equal', indexingBonuses: null, internationalBonus: null, effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
    });
    expect(d.internationalBonus).toBe(0);
  });

  test('conference scopus: role percentages required and splitting to 100%', () => {
    const base = { policyName: 'C', conferenceSubType: 'paper_indexed_scopus', quartileIncentives: [{ quartile: 'Q1', incentiveAmount: 1, points: 1 }] };
    expect(errorsOf(() => v.parseConferencePolicy(base)).message).toMatch(/first author and corresponding author percentages/);
    expect(errorsOf(() => v.parseConferencePolicy({ ...base, rolePercentages: [{ role: 'first_author', percentage: 40 }, { role: 'corresponding_author', percentage: 40 }, { role: 'co_author', percentage: 30 }] })).message)
      .toMatch(/must total 100%/);
    expect(v.parseConferencePolicy({ ...base, rolePercentages: [{ role: 'first_author', percentage: 40 }, { role: 'corresponding_author', percentage: 30 }] }))
      .toMatchObject({ flatIncentiveAmount: null, rolePercentages: [{ role: 'first_author', percentage: 40 }, { role: 'corresponding_author', percentage: 30 }] });
    expect(errorsOf(() => v.parseConferencePolicy({ policyName: 'C', conferenceSubType: 'webinar' })).message).toMatch(/Conference sub-type must be one of/);
    expect(errorsOf(() => v.parseConferencePolicy({ policyName: 'C', conferenceSubType: 'paper_not_indexed', flatIncentiveAmount: -1, flatPoints: 1 })).message).toMatch(/cannot be negative/);
  });

  test('grant: percentage_based needs role percentages totalling 100 with no negatives', () => {
    const base = { policyName: 'G', projectCategory: 'govt', projectType: 'indian', baseIncentiveAmount: 25000, basePoints: 30 };
    expect(errorsOf(() => v.parseGrantPolicy({ ...base, splitPolicy: 'percentage_based', rolePercentages: [{ role: 'pi', percentage: 120 }, { role: 'co_pi', percentage: -20 }] })).status).toBe(400);
    expect(errorsOf(() => v.parseGrantPolicy({ ...base, splitPolicy: 'percentage_based', rolePercentages: [{ role: 'pi', percentage: 60 }, { role: 'co_pi', percentage: 30 }] })).message).toMatch(/must total 100%/);
    expect(v.parseGrantPolicy({ ...base, splitPolicy: 'equal' })).toMatchObject({ rolePercentages: [], internationalBonus: 10000 });
    expect(errorsOf(() => v.parseGrantPolicy({ ...base, splitPolicy: 'equal', projectCategory: 'ngo' })).message).toMatch(/Project category must be one of/);
  });

  test('IPR: type enum, non-negative JSON bonuses, primary-inventor share', () => {
    expect(v.parseIprPolicy({ iprType: 'PATENT', policyName: 'P', baseIncentiveAmount: 50000, basePoints: 50 }))
      .toMatchObject({ iprType: 'patent', isActive: true, splitPolicy: 'equal', effectiveTo: null });
    expect(errorsOf(() => v.parseIprPolicy({ iprType: 'trade_secret', policyName: 'P', baseIncentiveAmount: 1, basePoints: 1 })).message).toMatch(/IPR type must be one of/);
    expect(errorsOf(() => v.parseIprPolicy({ iprType: 'patent', policyName: 'P', baseIncentiveAmount: 1, basePoints: 1, projectTypeBonus: { sponsored: -10 } })).message).toMatch(/projectTypeBonus\.sponsored cannot be negative/);
    expect(errorsOf(() => v.parseIprPolicy({ iprType: 'patent', policyName: 'P', baseIncentiveAmount: 1, basePoints: 1, splitPolicy: 'primary_inventor' })).message).toMatch(/Primary inventor share is required/);
  });
});

describe('policy effective windows', () => {
  test('policyWindowWhere compares by calendar day and requires isActive', () => {
    const w = policyWindowWhere(new Date('2025-12-31T18:30:00Z'));
    expect(w.isActive).toBe(true);
    expect(w.effectiveFrom.lt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(w.OR).toEqual([{ effectiveTo: null }, { effectiveTo: { gte: new Date('2025-12-31T00:00:00Z') } }]);
  });

  test('windowsOverlap handles open ends and engulfing windows', () => {
    expect(windowsOverlap('2026-01-01', null, '2025-01-01', '2025-12-31')).toBe(false);
    expect(windowsOverlap('2025-01-01', null, '2025-03-01', '2025-04-01')).toBe(true); // engulfs
    expect(windowsOverlap('2025-03-01', '2025-04-01', '2025-01-01', null)).toBe(true); // inside
  });

  const delegateWith = (rows) => ({
    findMany: jest.fn().mockResolvedValue(rows),
    update: jest.fn().mockResolvedValue({}),
  });

  test('supersede: closes the previous open policy the day before the new one starts', async () => {
    const delegate = delegateWith([{ id: 'old', policyName: '2026', effectiveFrom: new Date('2026-01-01'), effectiveTo: null }]);
    const adjusted = await resolveOverlaps({ delegate, where: { publicationType: 'research_paper' }, from: startOfUtcDay('2027-01-01'), to: null, mode: 'supersede', actorId: 'u1' });
    expect(delegate.update).toHaveBeenCalledWith({ where: { id: 'old' }, data: { effectiveTo: new Date('2026-12-31T00:00:00Z'), updatedById: 'u1' } });
    expect(adjusted).toEqual([expect.objectContaining({ id: 'old' })]);
    // only enabled policies of the same key are considered
    expect(delegate.findMany.mock.calls[0][0].where).toMatchObject({ publicationType: 'research_paper', isActive: true });
  });

  test('supersede: a policy entirely inside the new window is replaced (disabled)', async () => {
    const delegate = delegateWith([{ id: 'same-day', policyName: 'v2', effectiveFrom: new Date('2027-01-01'), effectiveTo: null }]);
    await resolveOverlaps({ delegate, where: {}, from: startOfUtcDay('2027-01-01'), to: null, mode: 'supersede' });
    expect(delegate.update).toHaveBeenCalledWith({ where: { id: 'same-day' }, data: { isActive: false } });
  });

  test('supersede: a bounded window inside an open older policy is a 409 (cannot split it)', async () => {
    const delegate = delegateWith([{ id: 'old', policyName: 'Open', effectiveFrom: new Date('2026-01-01'), effectiveTo: null }]);
    await expect(resolveOverlaps({ delegate, where: {}, from: startOfUtcDay('2026-06-01'), to: startOfUtcDay('2026-06-30'), mode: 'supersede' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'POLICY_OVERLAP', conflictingPolicyId: 'old' });
    expect(delegate.update).not.toHaveBeenCalled();
  });

  test('reject: an engulfing window conflicts even when it starts before the existing one', async () => {
    const delegate = delegateWith([{ id: 'mid', policyName: 'Mid-2026', effectiveFrom: new Date('2026-04-01'), effectiveTo: new Date('2026-06-30') }]);
    await expect(resolveOverlaps({ delegate, where: {}, from: startOfUtcDay('2026-01-01'), to: startOfUtcDay('2026-12-31'), mode: 'reject' }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Mid-2026') });
  });

  test('reject: adjacent windows do not conflict', async () => {
    const delegate = delegateWith([{ id: 'a', policyName: 'A', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-30') }]);
    await expect(resolveOverlaps({ delegate, where: {}, from: startOfUtcDay('2026-07-01'), to: null, mode: 'reject' })).resolves.toEqual([]);
  });

  test('sendPolicyError maps a DB exclusion-constraint violation to 409', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    expect(v.sendPolicyError(res, new Error('conflicting key value violates exclusion constraint "research_incentive_policy_no_overlap"'))).toBe(true);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(v.sendPolicyError(res, new Error('boom'))).toBe(false);
  });
});

describe('IPR policy stores only the amount and points (equal split)', () => {
  test('split choice, primary share, multipliers and bonuses are never stored', () => {
    const { Prisma } = require('@prisma/client');
    const d = v.parseIprPolicy({
      iprType: 'patent', policyName: 'P', baseIncentiveAmount: 40000, basePoints: 40,
      splitPolicy: 'primary_inventor', primaryInventorShare: 60,
      filingTypeMultiplier: { provisional: 0.5 }, projectTypeBonus: { phd: 10000 },
    });
    expect(d.baseIncentiveAmount).toBe(40000);
    expect(d.splitPolicy).toBe('equal');
    expect(d.primaryInventorShare).toBeNull();
    expect(d.filingTypeMultiplier).toBe(Prisma.DbNull);
    expect(d.projectTypeBonus).toBe(Prisma.DbNull);
  });
});
