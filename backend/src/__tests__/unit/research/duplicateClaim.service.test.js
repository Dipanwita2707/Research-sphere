/**
 * Unit tests: duplicate-claim detection (work keys and the active-claim guard).
 */

jest.mock('../../../shared/config/database', () => ({ researchContribution: { findMany: jest.fn() } }));

const {
  computeWorkKey,
  assertNoActiveClaim,
  DuplicateClaimError,
  ACTIVE_CLAIM_STATUSES,
} = require('../../../modules/research/services/duplicateClaim.service');

describe('computeWorkKey()', () => {
  describe('DOI', () => {
    test.each([
      ['10.1234/ABC.Def', 'doi:10.1234/abc.def'],
      ['https://doi.org/10.1234/ABC.def', 'doi:10.1234/abc.def'],
      ['http://dx.doi.org/10.1234/abc.DEF', 'doi:10.1234/abc.def'],
      ['  doi: 10.1234/abc.def ', 'doi:10.1234/abc.def'],
      ['HTTPS://DOI.ORG/10.1234/Abc.Def', 'doi:10.1234/abc.def'],
    ])('normalises %p', (doi, key) => {
      expect(computeWorkKey({ publicationType: 'research_paper', doi, title: 'Something long enough' })).toBe(key);
    });

    test('same paper with differently written DOIs gets the same key', () => {
      const a = computeWorkKey({ publicationType: 'research_paper', doi: 'https://doi.org/10.5555/XYZ-1' });
      const b = computeWorkKey({ publicationType: 'research_paper', doi: '10.5555/xyz-1' });
      expect(a).toBe(b);
    });

    test('falls back to paperDoi (conference papers) when doi is missing or invalid', () => {
      expect(computeWorkKey({ publicationType: 'conference_paper', doi: null, paperDoi: 'https://doi.org/10.5555/Conf.42' }))
        .toBe('doi:10.5555/conf.42');
      expect(computeWorkKey({ publicationType: 'conference_paper', doi: 'not-a-doi', paperDoi: '10.5555/conf.42' }))
        .toBe('doi:10.5555/conf.42');
    });

    test('DOI wins over ISBN and title', () => {
      expect(computeWorkKey({ publicationType: 'book', doi: '10.1000/book.1', isbn: '9783161484100', title: 'A long book title' }))
        .toBe('doi:10.1000/book.1');
    });
  });

  describe('ISBN', () => {
    test('ISBN-10 for books (hyphens removed, X kept)', () => {
      expect(computeWorkKey({ publicationType: 'book', isbn: '0-306-40615-2' })).toBe('isbn:0306406152');
      expect(computeWorkKey({ publicationType: 'book', isbn: '0-8044-2957-x' })).toBe('isbn:080442957X');
    });

    test('ISBN-13 for books', () => {
      expect(computeWorkKey({ publicationType: 'book', isbn: 'ISBN 978-3-16-148410-0' })).toBe('isbn:9783161484100');
    });

    test('an ISBN of the wrong length falls back to title + year', () => {
      expect(computeWorkKey({ publicationType: 'book', isbn: '12345', title: 'Handbook of Soil Science', publicationDate: '2023-02-01' }))
        .toBe('t:book:handbook of soil science:2023');
    });

    test('book chapter key includes the chapter title (chapters share the book ISBN)', () => {
      const ch1 = computeWorkKey({ publicationType: 'book_chapter', isbn: '978-3-16-148410-0', title: 'Deep Learning for Crops' });
      const ch2 = computeWorkKey({ publicationType: 'book_chapter', isbn: '978-3-16-148410-0', title: 'Irrigation Scheduling Models' });
      expect(ch1).toBe('isbn:9783161484100:ch:deep learning for crops');
      expect(ch2).not.toBe(ch1);
    });

    test('ISBN is not used for journal papers', () => {
      expect(computeWorkKey({ publicationType: 'research_paper', isbn: '9783161484100', title: 'Journal paper title' }))
        .toBe('t:research_paper:journal paper title');
    });
  });

  describe('title + year fallback', () => {
    test('normalises case, punctuation and accents and appends the publication year', () => {
      expect(computeWorkKey({ publicationType: 'research_paper', title: '  A Study of Café   Networks: Part-1! ', publicationDate: '2024-05-01' }))
        .toBe('t:research_paper:a study of cafe networks part 1:2024');
    });

    test('uses the conference date when there is no publication date', () => {
      expect(computeWorkKey({ publicationType: 'conference_paper', title: 'Edge computing for farms', conferenceDate: new Date('2025-11-20') }))
        .toBe('t:conference_paper:edge computing for farms:2025');
    });

    test('without any date there is no year suffix', () => {
      expect(computeWorkKey({ publicationType: 'research_paper', title: 'Edge computing for farms' }))
        .toBe('t:research_paper:edge computing for farms');
    });

    test('type is part of the key', () => {
      const a = computeWorkKey({ publicationType: 'research_paper', title: 'Edge computing for farms' });
      const b = computeWorkKey({ publicationType: 'conference_paper', title: 'Edge computing for farms' });
      expect(a).not.toBe(b);
    });
  });

  describe('no key', () => {
    test('grant proposals never get a key', () => {
      expect(computeWorkKey({ publicationType: 'grant_proposal', doi: '10.1000/x', title: 'Some grant proposal title' })).toBeNull();
    });

    test('missing type', () => {
      expect(computeWorkKey({ title: 'A perfectly good title' })).toBeNull();
      expect(computeWorkKey()).toBeNull();
    });

    test('titles shorter than 8 normalised characters', () => {
      expect(computeWorkKey({ publicationType: 'research_paper', title: 'AI & ML' })).toBeNull();
      expect(computeWorkKey({ publicationType: 'research_paper', title: '!!!' })).toBeNull();
    });
  });
});

describe('assertNoActiveClaim()', () => {
  const contribution = { id: 'c2', publicationType: 'research_paper', doi: '10.1234/abc' };

  test('throws DuplicateClaimError (DUPLICATE_CLAIM, 409) when another active claim exists', async () => {
    const client = {
      researchContribution: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'c1', applicationNumber: 'RP-2026-0001', status: 'under_review', title: 'Paper', publicationType: 'research_paper',
          submittedAt: new Date('2026-01-01'), applicantUserId: 'u1',
          applicantUser: { uid: 'FAC1', employeeDetails: { displayName: 'Dr Asha Rao' }, studentLogin: null },
        }]),
      },
    };

    const err = await assertNoActiveClaim(contribution, { client }).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateClaimError);
    expect(err).toMatchObject({ code: 'DUPLICATE_CLAIM', statusCode: 409 });
    expect(err.existing).toMatchObject({ applicationNumber: 'RP-2026-0001', claimedBy: 'Dr Asha Rao', status: 'under_review' });
    expect(err.message).toContain('RP-2026-0001');
    expect(err.message).toContain('under review');

    expect(client.researchContribution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ workKey: 'doi:10.1234/abc' }], status: { in: ACTIVE_CLAIM_STATUSES }, NOT: { id: 'c2' } },
    }));
  });

  test('returns the keys to store when there is no other active claim', async () => {
    const client = { researchContribution: { findMany: jest.fn().mockResolvedValue([]) } };
    await expect(assertNoActiveClaim(contribution, { client })).resolves.toEqual({ workKey: 'doi:10.1234/abc', titleWorkKey: null });
  });

  test('returns empty keys without querying when no key can be computed', async () => {
    const client = { researchContribution: { findMany: jest.fn() } };
    await expect(assertNoActiveClaim({ id: 'g', publicationType: 'grant_proposal' }, { client })).resolves.toEqual({ workKey: null, titleWorkKey: null });
    expect(client.researchContribution.findMany).not.toHaveBeenCalled();
  });

  test('a DOI claim and a title-only claim of the same work collide', async () => {
    const existing = {
      id: 'c1', applicationNumber: 'RP-1', status: 'approved', title: 'Graph networks for crop yield', publicationType: 'research_paper',
      workKey: 'doi:10.1234/x', submittedAt: new Date(), applicantUserId: 'u1', applicantUser: { uid: 'F1' },
    };
    const client = { researchContribution: { findMany: jest.fn().mockResolvedValue([existing]) } };
    const titleOnly = { id: 'c2', publicationType: 'research_paper', title: 'Graph networks for crop yield', publicationDate: '2026-02-01' };
    const err = await assertNoActiveClaim(titleOnly, { client }).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateClaimError);
  });

  test('two claims with different DOIs but the same title are different works', async () => {
    const existing = {
      id: 'c1', applicationNumber: 'RP-1', status: 'approved', title: 'Graph networks for crop yield', publicationType: 'research_paper',
      workKey: 'doi:10.1234/preprint', submittedAt: new Date(), applicantUserId: 'u1', applicantUser: { uid: 'F1' },
    };
    const client = { researchContribution: { findMany: jest.fn().mockResolvedValue([existing]) } };
    const published = { id: 'c2', publicationType: 'research_paper', doi: '10.1234/published', title: 'Graph networks for crop yield', publicationDate: '2026-02-01' };
    await expect(assertNoActiveClaim(published, { client })).resolves.toMatchObject({ workKey: 'doi:10.1234/published' });
  });

  test('drafts, rejected and cancelled contributions do not hold a claim', () => {
    expect(ACTIVE_CLAIM_STATUSES).not.toEqual(expect.arrayContaining(['draft']));
    expect(ACTIVE_CLAIM_STATUSES).not.toContain('rejected');
    expect(ACTIVE_CLAIM_STATUSES).not.toContain('cancelled');
    expect(ACTIVE_CLAIM_STATUSES).toEqual(expect.arrayContaining(['submitted', 'approved', 'completed']));
  });
});
