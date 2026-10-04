/**
 * Unit tests: research profile incentives and manual-form papers.
 *   - an approved work reaches the author's profile even when the author row typed into the manual
 *     form (UID / email) was never linked to the account
 *   - the author and admins see what they earned per work (payout line first, else the share DRD
 *     recorded at approval) plus a summary; nobody else ever receives money data
 * Prisma is mocked.
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/tenancy/tenantContext', () => ({ getTenantId: () => 'uni-1', get: () => ({ tenantId: 'uni-1' }) }));

const svc = require('../../../modules/research/services/authorProfile.service');

const author = { id: 'u1', uid: 'FAC001', email: 'fac@uni.example', universityId: 'uni-1', university: { name: 'U', slug: 'u' }, employeeDetails: { email: 'fac@uni.example' }, researchProfileIdentity: null };
const work = (id, authors, extra = {}) => ({
  id, title: `Work ${id}`, publicationType: 'research_paper', status: 'approved', publicationDate: new Date('2026-01-10'),
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), indexingDetails: null, keywords: '', authors, ...extra,
});
const me = (over = {}) => ({ userId: 'u1', uid: 'FAC001', email: null, name: 'Dr Fac', authorOrder: 0, isInternal: true, incentiveShare: null, pointsShare: null, ...over });

beforeEach(() => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  Object.assign(mockPrisma, {
    researchContribution: { findMany: jest.fn().mockResolvedValue([]) },
    incentivePayout: { findMany: jest.fn().mockResolvedValue([]) },
    ripResearcherExpertiseProfile: { findUnique: jest.fn().mockResolvedValue(null) },
  });
});

describe('papers filed through the manual form', () => {
  it('are also found by the author’s UID or email when the author row has no linked account', async () => {
    await svc._publications(author);
    const where = mockPrisma.researchContribution.findMany.mock.calls[0][0].where;
    const [which, whose] = where.AND;
    // Manual works once approved; synced works straight away unless DRD rejected them.
    expect(which).toEqual({ OR: [
      { status: { in: ['approved', 'completed'] } },
      { sourceType: 'auto_import', status: { not: 'rejected' } },
    ] });
    expect(whose.OR).toEqual(expect.arrayContaining([
      { applicantUserId: 'u1' },
      { authors: { some: { userId: 'u1' } } },
      { authors: { some: { userId: null, uid: { equals: 'FAC001', mode: 'insensitive' } } } },
      { authors: { some: { userId: null, email: { equals: 'fac@uni.example', mode: 'insensitive' } } } },
    ]));
  });
});

describe('incentives on the profile', () => {
  const access = (full) => ({ full, isOwner: full, privileged: false });

  it('author/admin: payout line wins; otherwise the share recorded at approval; summary adds it up', async () => {
    const works = [
      work('w1', [me({ incentiveShare: 5000, pointsShare: 5 })]),                       // has a payout line (paid)
      work('w2', [me({ incentiveShare: 8000, pointsShare: 8 })]),                       // no line: award only
      work('w3', [me({ userId: null, incentiveShare: 3000, pointsShare: 3 })]),         // typed by UID, unlinked
      work('w4', [me()]),                                                                // nothing awarded
    ];
    mockPrisma.researchContribution.findMany.mockResolvedValue(works);
    mockPrisma.incentivePayout.findMany.mockResolvedValue([
      { researchContributionId: 'w1', approvedAmount: 12000, points: 12, status: 'paid', paidAt: new Date('2026-02-01') },
    ]);

    const out = await svc._build(author, access(true), { ...{ profileVisibility: 'institution' }, showPublications: true, researchInterests: [] });
    const byId = Object.fromEntries(out.publications.map((p) => [p.id, p.incentive]));
    expect(byId.w1).toMatchObject({ amount: 12000, points: 12, status: 'paid' });
    expect(byId.w2).toMatchObject({ amount: 8000, points: 8, status: null });
    expect(byId.w3).toMatchObject({ amount: 3000, points: 3, status: null });
    expect(byId.w4).toMatchObject({ amount: 0, points: 0 });
    expect(out.incentiveSummary).toEqual({ total: 23000, paid: 12000, inProcess: 11000, points: 23, works: 3 });
    expect(mockPrisma.incentivePayout.findMany.mock.calls[0][0].where).toMatchObject({ payeeUserId: 'u1', NOT: { status: 'cancelled' } });
  });

  it('any other viewer never receives money data, even with every section visible', async () => {
    mockPrisma.researchContribution.findMany.mockResolvedValue([work('w1', [me({ incentiveShare: 5000, pointsShare: 5 })])]);
    const out = await svc._build(author, access(false), { profileVisibility: 'public', showPublications: true, showMetrics: true, showPhoto: true, showEmail: true, showPhone: true, showResearchInterests: true, showCoAuthors: true, researchInterests: [] });
    expect(out.publications).toHaveLength(1);
    expect(out.publications[0].incentive).toBeUndefined();
    expect(out.incentiveSummary).toBeNull();
    expect(mockPrisma.incentivePayout.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(out)).not.toMatch(/5000/);
  });
});
