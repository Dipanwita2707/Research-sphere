jest.mock('../../../shared/config/database', () => ({
  university: { findUnique: jest.fn() },
  facultySchoolList: { findMany: jest.fn() },
  userLogin: { findUnique: jest.fn() },
  userSettings: { findUnique: jest.fn() },
}));
jest.mock('../../../shared/config/redis', () => ({ get: jest.fn(async () => null), set: jest.fn(), del: jest.fn() }));

const prisma = require('../../../shared/config/database');
const { generateAffiliationVariants, isAffiliationMatch } = require('../../../shared/utils/affiliationEngine');
const affiliationService = require('../../../modules/core/services/affiliation.service');
const probes = require('../../../shared/utils/__fixtures__/affiliationProbes');

const TENANTS = {
  sgt: {
    col: 1,
    cfg: { name: 'SGT University', code: 'SGT', city: 'Gurugram', state: 'Haryana', extraAliases: ['Shree Guru Gobind Singh Tricentenary University'] },
  },
  demo: {
    col: 1,
    cfg: {
      name: 'SGT Demo University', code: 'DEMO', city: 'Gurugram', state: 'Haryana',
      extraAliases: ['SGT Demo University', 'SGT University', 'Shree Guru Gobind Singh Tricentenary University'],
      schools: ['Faculty of Dental Sciences', 'FDS', 'School of Engineering & Technology', 'SOET'],
    },
  },
  dtu: {
    col: 2,
    cfg: { name: 'Delhi Technological University', code: 'DTU', city: 'New Delhi', state: 'Delhi' },
  },
};

function score(tenant) {
  const { cfg, col } = TENANTS[tenant];
  const variants = generateAffiliationVariants(cfg);
  let tp = 0; let fp = 0; let fn = 0;
  const wrong = [];
  for (const probe of probes) {
    const truth = Boolean(probe[col]);
    const hit = isAffiliationMatch(probe[0], variants, { locations: [cfg.city, cfg.state], country: 'India' });
    if (hit && truth) tp += 1;
    else if (hit) { fp += 1; wrong.push(`FP ${probe[0]}`); } else if (truth) { fn += 1; wrong.push(`FN ${probe[0]}`); }
  }
  return { precision: tp / Math.max(tp + fp, 1), recall: tp / Math.max(tp + fn, 1), wrong };
}

describe('affiliation engine precision/recall on the labelled probe set', () => {
  test('probe set is large enough', () => {
    expect(probes.length).toBeGreaterThanOrEqual(60);
  });

  test.each(Object.keys(TENANTS))('%s tenant: precision >= 0.97, recall >= 0.9', (tenant) => {
    const { precision, recall, wrong } = score(tenant);
    expect({ tenant, precision, wrong }).toEqual(expect.objectContaining({ precision: expect.any(Number) }));
    expect(precision).toBeGreaterThanOrEqual(0.97);
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });
});

describe('affiliation engine rules', () => {
  const sgt = generateAffiliationVariants(TENANTS.sgt.cfg);
  const dtu = generateAffiliationVariants(TENANTS.dtu.cfg);

  test('variants never contain a bare city/state or the tenant code alone when it is not the acronym', () => {
    const demo = generateAffiliationVariants({ name: 'SGT Demo University', code: 'DEMO', city: 'Gurugram', state: 'Haryana' });
    expect(demo).not.toContain('gurugram');
    expect(demo).not.toContain('haryana');
    expect(demo).not.toContain('demo');
    expect(demo).toContain('sgt demo university, gurugram');
    expect(dtu).toContain('dtu');
  });

  test.each([
    ['Gurugram', false], ['Gurugram, Haryana, India', false], ['Amity University, Gurugram', false],
    ['Sgt. Pepper Lab', false], ['Sgtx Corp', false], ['SGT College', false], ['SGT Public School', false],
    ['S.G.T. University', true], ['SGTU', true], ['SGT Univ.', true], ['Sri Guru Gobind Singh Tricentenary Univ', true],
  ])('SGT tenant: %s -> %s', (value, expected) => {
    expect(isAffiliationMatch(value, sgt)).toBe(expected);
  });

  test('acronym hits need the acronym alone in its part, a home location, and no foreign country', () => {
    expect(isAffiliationMatch('DTU', dtu)).toBe(true);
    expect(isAffiliationMatch('Dept. of Computer Engineering, DTU, Delhi', dtu)).toBe(true);
    expect(isAffiliationMatch('DTU Space, Kgs. Lyngby', dtu)).toBe(false);
    expect(isAffiliationMatch('Technical University of Denmark (DTU), Lyngby, Denmark', dtu)).toBe(false);
    expect(isAffiliationMatch('IIT Delhi', dtu)).toBe(false);
  });

  test('works on the legacy variant-list call signature (no options)', () => {
    expect(isAffiliationMatch('Department of Physics, SGT University, Budhera', sgt)).toBe(true);
    expect(isAffiliationMatch('University', sgt)).toBe(false);
    expect(isAffiliationMatch('', sgt)).toBe(false);
    expect(isAffiliationMatch('SGT University', [])).toBe(false);
  });
});

describe('affiliation.service', () => {
  test('personalAffiliationAliases keeps institution names and acronyms, drops locations, generic words and sub-units', () => {
    const out = affiliationService.personalAffiliationAliases({
      affiliationOverride: 'School of CS, SGT Medical College, Gurugram',
      identityAliases: ['Gurugram', 'University', 'SGTU', 'Haryana, India'],
      locations: ['Gurugram', 'Haryana'],
    });
    expect(out).toEqual(['SGT Medical College', 'SGTU']);
  });

  test('getUniversityAffiliationVariants returns locations, country and the tenant Scopus affiliation ids', async () => {
    prisma.university.findUnique.mockResolvedValue({
      name: 'SGT University', code: 'SGT', city: 'Gurugram', state: 'Haryana', country: 'India',
      affiliationAliases: [], scopusAffiliationIds: ['60113772', ' 124037491 '],
    });
    prisma.facultySchoolList.findMany.mockResolvedValue([]);
    const ctx = await affiliationService.getUniversityAffiliationVariants('u-1');
    expect(ctx.locations).toEqual(['Gurugram', 'Haryana']);
    expect(ctx.country).toBe('India');
    expect(ctx.scopusAffiliationIds).toEqual(['60113772', '124037491']);
    expect(ctx.variants).toContain('sgt university');
  });
});
