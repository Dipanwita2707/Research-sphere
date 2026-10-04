/**
 * Unit tests: synced works and incentive eligibility.
 *   - each synced work is classified affiliated / not_affiliated / unknown, with the reason
 *     (Scopus AF-ID, affiliation text, ORCID employment here or elsewhere that year)
 *   - the sync never submits: works stay drafts for the researcher
 *   - submitting a synced work of another institution is refused; an unknown one goes to DRD
 *     flagged for verification; affiliated and manual works submit normally
 */
jest.mock('../../../modules/research/services/duplicateClaim.service', () => ({
  ...jest.requireActual('../../../modules/research/services/duplicateClaim.service'),
  findActiveClaims: jest.fn(async () => []),
  assertNoActiveClaim: jest.fn(async () => ({ workKey: 'k', titleWorkKey: 't' })),
}));

const PublicationSyncService = require('../../../modules/research/services/publicationSync.service');
const ContributionService = require('../../../modules/research/services/contribution.service');
const { generateAffiliationVariants } = require('../../../shared/utils/affiliationEngine');

const variants = generateAffiliationVariants({
  name: 'SGT University', code: 'SGTU', city: 'Gurugram', state: 'Haryana',
  extraAliases: ['Shree Guru Gobind Singh Tricentenary University'],
});

function syncService(prisma = {}, contributionService = {}) {
  const s = new PublicationSyncService(prisma, contributionService);
  s._affiliationVariants = variants;
  s._ownerAffiliationVariants = variants;
  s._affiliationOptions = { locations: ['Gurugram', 'Haryana'], country: 'India' };
  s._scopusAffiliationIds = new Set(['60000001']);
  return s;
}
const year = (y) => ({ publicationDate: `${y}-06-01` });

describe('_classifyHomeAffiliation', () => {
  test('Scopus AF-ID of this university, or a search limited to it', () => {
    const s = syncService();
    expect(s._classifyHomeAffiliation({ scopusAfids: ['60000001'] }, year(2024))).toMatchObject({ status: 'affiliated', basis: 'scopus_afid' });
    expect(s._classifyHomeAffiliation(null, { ...year(2024), trustedHomeInstitutionQuery: true })).toMatchObject({ status: 'affiliated', basis: 'trusted_query' });
  });

  test('the owner’s affiliation text decides, including the legal name', () => {
    const s = syncService();
    expect(s._classifyHomeAffiliation({ affiliation: 'Dept of CSE, SGT University, Gurugram, India' }, year(2025)))
      .toMatchObject({ status: 'affiliated', basis: 'name_match' });
    expect(s._classifyHomeAffiliation({ affiliation: 'Shree Guru Gobind Singh Tricentenary University, Gurugram' }, year(2025)))
      .toMatchObject({ status: 'affiliated' });
    expect(s._classifyHomeAffiliation({ affiliation: 'Lovely Professional University, Phagwara, Punjab' }, year(2021)))
      .toMatchObject({ status: 'not_affiliated', basis: 'other_institution', detail: 'Lovely Professional University, Phagwara, Punjab' });
    expect(s._classifyHomeAffiliation({ affiliation: null, scopusAfids: ['99999'] }, year(2021)))
      .toMatchObject({ status: 'not_affiliated' });
  });

  test('primary affiliation only: SGT must be the first affiliation listed for the author', () => {
    const s = syncService();
    // SGT alone, or listed first → affiliated
    expect(s._classifyHomeAffiliation({ affiliation: 'Shree Guru Gobind Singh Tricentenary University' }, year(2026))).toMatchObject({ status: 'affiliated' });
    expect(s._classifyHomeAffiliation({ affiliation: 'Shree Guru Gobind Singh Tricentenary University; INTI International University' }, year(2025)))
      .toMatchObject({ status: 'affiliated' });
    // SGT listed after LPU / INTI → not primary
    const lpuFirst = s._classifyHomeAffiliation({ affiliation: 'Lovely Professional University; Shree Guru Gobind Singh Tricentenary University' }, year(2024));
    expect(lpuFirst).toMatchObject({ status: 'not_affiliated', basis: 'not_primary', detail: expect.stringContaining('not as your primary affiliation') });
    expect(s._classifyHomeAffiliation({ affiliation: 'INTI International University; Shree Guru Gobind Singh Tricentenary University; Lovely Professional University' }, year(2025)))
      .toMatchObject({ status: 'not_affiliated', basis: 'not_primary' });
    // Scopus afids in byline order: home afid first → affiliated; later → not primary
    expect(s._classifyHomeAffiliation({ scopusAfids: ['60000001', '60104915'] }, year(2025))).toMatchObject({ status: 'affiliated', basis: 'scopus_afid' });
    expect(s._classifyHomeAffiliation({ scopusAfids: ['60104915', '60000001'] }, year(2025))).toMatchObject({ status: 'not_affiliated', basis: 'not_primary' });
    // A Scopus search limited to the university only decides when there is no byline at all
    expect(s._classifyHomeAffiliation({ affiliation: 'Lovely Professional University' }, { ...year(2025), trustedHomeInstitutionQuery: true }))
      .toMatchObject({ status: 'not_affiliated', basis: 'other_institution' });
  });

  test('only the byline on the paper counts: no byline in any source stays unknown (never employment)', () => {
    const s = syncService();
    expect(s._classifyHomeAffiliation({ affiliation: null }, year(2025))).toMatchObject({ status: 'unknown', basis: 'no_data' });
    expect(s._classifyHomeAffiliation(null, { ...year(2026), homeInstitutionOnPaper: true }))
      .toMatchObject({ status: 'unknown', detail: expect.stringContaining('co-author') });
  });

  test('a byline read from OpenAlex is marked as such', () => {
    const s = syncService();
    expect(s._classifyHomeAffiliation({ affiliation: 'SGT University, Gurugram, India', affiliationFrom: 'openalex' }, year(2025)))
      .toMatchObject({ status: 'affiliated', basis: 'name_match_openalex' });
    expect(s._classifyHomeAffiliation({ affiliation: 'Lovely Professional University, Phagwara, Punjab, India', affiliationFrom: 'openalex' }, year(2021)))
      .toMatchObject({ status: 'not_affiliated', basis: 'other_institution_openalex' });
  });
});

describe('OpenAlex byline lookup', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  test('fills the owner byline by DOI (ORCID match first, then name) only where the source had none', async () => {
    const s = syncService();
    const user = { id: 'u1', employeeDetails: { displayName: 'Prateek Agrawal', firstName: 'Prateek', lastName: 'Agrawal' } };
    const identity = { orcid: '0000-0001-6861-0698' };
    const withByline = { title: 'A', doi: '10.1000/a', authors: [{ name: 'Prateek Agrawal', affiliation: 'SGT University' }] };
    const noByline = { title: 'B', doi: '10.1000/b', authors: [{ name: 'Prateek Agrawal' }] };
    const noDoi = { title: 'C', authors: [{ name: 'Prateek Agrawal' }] };
    jest.spyOn(s, '_matchOwningFaculty').mockImplementation((authors) => authors[0]);
    global.fetch = jest.fn(async (url) => {
      expect(decodeURIComponent(String(url))).toContain('filter=doi:10.1000/b');
      return { ok: true, status: 200, json: async () => ({ results: [{ doi: 'https://doi.org/10.1000/b', authorships: [
        { author: { display_name: 'Vishu Madaan' }, raw_affiliation_strings: ['Lovely Professional University'] },
        { author: { display_name: 'P. Agrawal', orcid: 'https://orcid.org/0000-0001-6861-0698' }, raw_affiliation_strings: ['SGT University, Gurugram, Haryana, India'] },
      ] }] }) };
    });
    const found = await s._attachOpenAlexBylines([withByline, noByline, noDoi], user, identity);
    expect(found).toBe(1);
    expect(noByline.ownerBylineAffiliation).toBe('SGT University, Gurugram, Haryana, India');
    expect(withByline.ownerBylineAffiliation).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('sync never submits', () => {
  test('a new work is created as a draft with its affiliation; submitContribution is not called', async () => {
    const prisma = { researchContribution: { update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })) } };
    const contributionService = { createContribution: jest.fn(async () => ({ id: 'c1', status: 'draft' })), submitContribution: jest.fn() };
    const s = syncService(prisma, contributionService);
    jest.spyOn(s, '_matchOwningFaculty').mockReturnValue({ affiliation: 'Lovely Professional University, Punjab' });
    jest.spyOn(s, '_findExistingContribution').mockResolvedValue(null);
    jest.spyOn(s, '_buildContributionInput').mockResolvedValue({ title: 'T', publicationType: 'research_paper', authors: [] });
    jest.spyOn(s, '_ensureContributionAuthors').mockResolvedValue(false);
    jest.spyOn(s, '_upsertImportLinks').mockResolvedValue();

    const result = await s._upsertCandidate({ id: 'u1' }, { id: 'i1', filterSgtOnly: true }, { title: 'T', ...year(2021) });
    expect(result).toMatchObject({ outcome: 'createdCount', contributionId: 'c1', affiliation: 'not_affiliated' });
    expect(contributionService.submitContribution).not.toHaveBeenCalled();
    expect(prisma.researchContribution.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { homeAffiliation: 'not_affiliated', homeAffiliationBasis: 'other_institution', homeAffiliationDetail: 'Lovely Professional University, Punjab' },
    });
  });
});

describe('submitting a synced work', () => {
  function contributionService(contribution) {
    const writes = [];
    const tx = {
      researchContribution: {
        updateMany: jest.fn(async (args) => { writes.push(args.data); return { count: 1 }; }),
        findUnique: jest.fn(async () => ({ ...contribution, status: 'submitted' })),
      },
      researchContributionStatusHistory: { create: jest.fn(async ({ data }) => { writes.push({ history: data.comments }); }) },
    };
    const prisma = { $transaction: jest.fn(async (cb) => cb(tx)), userLogin: { findFirst: jest.fn() } };
    const repo = { findById: jest.fn(async () => ({ applicantUser: { role: 'faculty' }, authors: [], ...contribution })) };
    const svc = new ContributionService(repo, null, null, prisma);
    jest.spyOn(svc, '_notifyDrdOfSubmission').mockResolvedValue();
    svc._dispatchNotification = jest.fn();
    return { svc, writes };
  }
  const base = { id: 'c1', applicantUserId: 'u1', status: 'draft', sourceType: 'auto_import' };

  test('another institution: refused with NOT_AFFILIATED', async () => {
    const { svc, writes } = contributionService({ ...base, homeAffiliation: 'not_affiliated', homeAffiliationDetail: 'Lovely Professional University' });
    await expect(svc.submitContribution('c1', 'u1')).rejects.toMatchObject({ statusCode: 403, code: 'NOT_AFFILIATED', message: expect.stringContaining('Lovely Professional University') });
    expect(writes).toHaveLength(0);
  });

  test('unknown: goes to DRD flagged for special review, with a note in the history', async () => {
    const { svc, writes } = contributionService({ ...base, homeAffiliation: 'unknown', homeAffiliationDetail: 'The source gives no affiliation for you on this work' });
    await svc.submitContribution('c1', 'u1');
    expect(writes[0]).toMatchObject({ status: 'submitted', specialReviewRequired: true });
    expect(writes[1].history).toMatch(/not confirmed by the sync: verify before approving/);
  });

  test('affiliated synced works and manual entries submit normally', async () => {
    const a = contributionService({ ...base, homeAffiliation: 'affiliated' });
    await a.svc.submitContribution('c1', 'u1');
    expect(a.writes[0]).toMatchObject({ status: 'submitted' });
    expect(a.writes[0].specialReviewRequired).toBeUndefined();

    const m = contributionService({ ...base, sourceType: null, homeAffiliation: null });
    await m.svc.submitContribution('c1', 'u1');
    expect(m.writes[0]).toMatchObject({ status: 'submitted' });
    expect(m.writes[0].specialReviewRequired).toBeUndefined();
  });
});
