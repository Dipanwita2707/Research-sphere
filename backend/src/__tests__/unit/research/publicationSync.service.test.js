const PublicationSyncService = require('../../../modules/research/services/publicationSync.service');
const { generateAffiliationVariants } = require('../../../shared/utils/affiliationEngine');

describe('PublicationSyncService', () => {
  const originalOpenAlexApiKey = process.env.OPENALEX_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-28T12:00:00.000Z'));
  });

  afterEach(() => {
    process.env.OPENALEX_API_KEY = originalOpenAlexApiKey;
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('runScheduledSync selects due profiles in the database, oldest first, and schedules recently synced ones', async () => {
    const prisma = {
      researchProfileIdentity: {
        findMany: jest.fn(async () => ([
          {
            id: 'i-due', userId: 'due-daily', nextSyncAt: new Date('2026-04-28T11:00:00.000Z'),
            lastSyncedAt: new Date('2026-04-27T11:00:00.000Z'), syncFrequencyDays: 1,
          },
          {
            id: 'i-never', userId: 'never-synced', nextSyncAt: null, lastSyncedAt: null, syncFrequencyDays: 7,
          },
          {
            // Synced 1h ago but never scheduled (pre-migration row): scheduled, not synced.
            id: 'i-recent', userId: 'recent', nextSyncAt: null,
            lastSyncedAt: new Date('2026-04-28T11:00:00.000Z'), syncFrequencyDays: 3,
          },
        ])),
        update: jest.fn(async () => ({})),
      },
    };

    const service = new PublicationSyncService(prisma, {});
    const syncSpy = jest.spyOn(service, 'syncFacultyPublications')
      .mockResolvedValue({ createdCount: 1, updatedCount: 0 });

    const results = await service.runScheduledSync({ concurrency: 1 });

    const query = prisma.researchProfileIdentity.findMany.mock.calls[0][0];
    expect(query.where).toEqual({
      autoSyncEnabled: true,
      OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: expect.any(Date) } }],
    });
    expect(query.orderBy).toEqual([
      { nextSyncAt: { sort: 'asc', nulls: 'first' } },
      { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
    ]);
    expect(query.take).toBe(50);
    expect(syncSpy).toHaveBeenCalledTimes(2);
    expect(syncSpy).toHaveBeenCalledWith('due-daily', { triggerType: 'scheduled' });
    expect(syncSpy).toHaveBeenCalledWith('never-synced', { triggerType: 'scheduled' });
    expect(results.map((item) => item.userId).sort()).toEqual(['due-daily', 'never-synced']);
    expect(prisma.researchProfileIdentity.update).toHaveBeenCalledWith({
      where: { id: 'i-recent' },
      data: { nextSyncAt: new Date('2026-05-01T11:00:00.000Z') },
    });
  });

  test('_matchOwningFaculty prefers an actual faculty match over the first imported author', () => {
    const service = new PublicationSyncService({}, {});
    service._affiliationVariants = generateAffiliationVariants({ name: 'SGT University' });
    service._ownerAffiliationVariants = service._affiliationVariants;
    const user = {
      uid: 'FAC001',
      email: 'alice@sgt.edu',
      employeeDetails: {
        displayName: 'Alice Sharma',
      },
    };

    const authors = [
      {
        name: 'Bob Chen',
        email: null,
        affiliation: 'External University',
      },
      {
        name: 'Alice Sharma',
        email: null,
        affiliation: 'SGT University',
      },
    ];

    const match = service._matchOwningFaculty(authors, user, {
      scopusAuthorId: '123456789',
    });

    expect(match).toEqual(authors[1]);
  });

  test('_isSyncDue uses syncFrequencyDays when deciding scheduled eligibility', () => {
    const service = new PublicationSyncService({}, {});

    expect(service._isSyncDue({
      lastSyncedAt: new Date('2026-04-27T11:59:00.000Z'),
      syncFrequencyDays: 1,
    })).toBe(true);

    expect(service._isSyncDue({
      lastSyncedAt: new Date('2026-04-27T12:01:00.000Z'),
      syncFrequencyDays: 1,
    })).toBe(false);

    expect(service._isSyncDue({
      lastSyncedAt: new Date('2026-04-26T11:59:00.000Z'),
      syncFrequencyDays: 2,
    })).toBe(true);
  });

  test('_determineSourceSystems includes OpenAlex for all-source sync when configured', () => {
    process.env.OPENALEX_API_KEY = 'test-key';
    const service = new PublicationSyncService({}, {});

    const sources = service._determineSourceSystems({
      orcid: null,
      scopusAuthorId: null,
    }, 'all');

    expect(sources).toEqual(['openalex']);
    expect(service._determineSourceSystems({}, 'openalex')).toEqual(['openalex']);
  });

  describe('Scopus alone in an all-source sync', () => {
    const originalScopusKey = process.env.SCOPUS_API_KEY;
    afterEach(() => { process.env.SCOPUS_API_KEY = originalScopusKey; });
    const both = { orcid: '0000-0001-6861-0698', scopusAuthorId: '57219768446' };

    test('with a Scopus ID and key, "all" fetches Scopus only and reports ORCID and OpenAlex as skipped', () => {
      process.env.SCOPUS_API_KEY = 'k';
      process.env.OPENALEX_API_KEY = 'test-key';
      const service = new PublicationSyncService({}, {});
      expect(service._determineSourceSystems(both, 'all')).toEqual(['scopus']);
      expect(service._sourcesSkippedForScopus(both, 'all').map((s) => s.source)).toEqual(['orcid', 'openalex']);
    });

    test('an explicit ORCID or OpenAlex sync still fetches that source', () => {
      process.env.SCOPUS_API_KEY = 'k';
      const service = new PublicationSyncService({}, {});
      expect(service._determineSourceSystems(both, 'orcid')).toEqual(['orcid']);
      expect(service._determineSourceSystems(both, 'openalex')).toEqual(['openalex']);
      expect(service._sourcesSkippedForScopus(both, 'orcid')).toEqual([]);
    });

    test('without a Scopus key, or without a Scopus ID, ORCID and OpenAlex are used as before', () => {
      delete process.env.SCOPUS_API_KEY;
      process.env.OPENALEX_API_KEY = 'test-key';
      const service = new PublicationSyncService({}, {});
      expect(service._determineSourceSystems(both, 'all')).toEqual(['orcid', 'scopus', 'openalex']);
      process.env.SCOPUS_API_KEY = 'k';
      expect(service._determineSourceSystems({ orcid: both.orcid, scopusAuthorId: null }, 'all')).toEqual(['orcid', 'openalex']);
    });
  });

  test('_mapOpenAlexWork normalizes a work payload into contribution candidate shape', () => {
    const service = new PublicationSyncService({}, {});

    const mapped = service._mapOpenAlexWork({
      id: 'https://openalex.org/W123',
      doi: 'https://doi.org/10.1000/example',
      display_name: 'OpenAlex Paper',
      type: 'journal-article',
      publication_date: '2025-01-15',
      primary_location: {
        source: {
          display_name: 'Journal of Testing',
          issn_l: '1234-5678',
          host_organization_name: 'Test Publisher',
        },
      },
      biblio: {
        volume: '10',
        issue: '2',
        first_page: '100',
        last_page: '110',
      },
      authorships: [
        {
          author: { display_name: 'Alice Sharma' },
          institutions: [{ display_name: 'SGT University' }],
          is_corresponding: true,
        },
      ],
      abstract_inverted_index: {
        Testing: [0],
        OpenAlex: [1],
      },
      concepts: [
        { display_name: 'Artificial Intelligence' },
      ],
    });

    expect(mapped.title).toBe('OpenAlex Paper');
    expect(mapped.doi).toBe('10.1000/example');
    expect(mapped.sourceSystems).toEqual(['openalex']);
    expect(mapped.externalIds.openalex).toBe('https://openalex.org/W123');
    expect(mapped.pageNumbers).toBe('100-110');
    expect(mapped.abstract).toBe('Testing OpenAlex');
    expect(mapped.authors).toHaveLength(1);
  });

  test('_discoverCandidates keeps other source results when OpenAlex fails', async () => {
    const service = new PublicationSyncService({}, {});
    const user = { id: 'user-1' };
    const identity = { orcid: '0000-0000-0000-0000' };

    jest.spyOn(service, '_fetchOrcidWorks').mockResolvedValue([
      {
        title: 'ORCID Paper',
        doi: '10.1000/orcid-paper',
        publicationDate: '2025-02-01',
        externalIds: { orcid: 'orcid-work-1' },
      },
    ]);
    jest.spyOn(service, '_fetchOpenAlexWorks').mockRejectedValue(new Error('OpenAlex author search failed (400)'));
    jest.spyOn(service, '_fetchOpenAlexAuthorsByDoi').mockResolvedValue(null);

    const result = await service._discoverCandidates(user, identity, ['orcid', 'openalex']);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe('ORCID Paper');
    expect(result.sourceErrors).toEqual([
      { source: 'openalex', message: 'OpenAlex author search failed (400)' },
    ]);
  });

  test('_resolveOpenAlexAuthorIds never searches OpenAlex by name', async () => {
    const service = new PublicationSyncService({}, {});
    global.fetch = jest.fn();

    const result = await service._resolveOpenAlexAuthorIds(
      { employeeDetails: { displayName: 'Suresh Patel' } },
      { orcid: null, scopusAuthorId: null }
    );

    expect(result.ids).toEqual([]);
    expect(result.reason).toMatch(/not searched by name/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe('_findExistingContribution: re-published editions', () => {
    const chapter2021 = {
      id: 'c-2021', applicantUserId: 'user-1', publicationType: 'book_chapter', doi: null,
      title: 'Impact of COVID-19 on lifestyle and education', publicationDate: new Date('2021-01-01T00:00:00Z'),
    };
    const serviceWith = (rows) => {
      const prisma = {
        publicationImport: { findFirst: jest.fn(async () => null) },
        // Honours the publication-year range, like the database would.
        researchContribution: {
          findFirst: jest.fn(async () => null),
          findMany: jest.fn(async ({ where }) => rows.filter((r) => !where.publicationDate
            || (r.publicationDate >= where.publicationDate.gte && r.publicationDate <= where.publicationDate.lte))),
        },
      };
      const service = new PublicationSyncService(prisma, {});
      jest.spyOn(service, '_inferPublicationType').mockImplementation((c) => c.publicationType);
      return { service, prisma };
    };

    test('a chapter reprinted in a later volume (same title, no DOI, within 3 years) is the existing work', async () => {
      const { service, prisma } = serviceWith([chapter2021]);
      const found = await service._findExistingContribution('user-1', {
        title: 'Impact of COVID-19 on Lifestyle and Education', publicationType: 'book_chapter', publicationDate: '2024-01-01', externalIds: {},
      });
      expect(found).toBe(chapter2021);
      expect(prisma.researchContribution.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { applicantUserId: 'user-1', publicationType: 'book_chapter', title: { equals: 'Impact of COVID-19 on Lifestyle and Education', mode: 'insensitive' } },
      }));
    });

    test('different DOIs, a gap over 3 years, or a generic title stay separate works', async () => {
      const { service } = serviceWith([{ ...chapter2021, doi: '10.1000/abc.2021' }]);
      expect(await service._findExistingContribution('user-1', {
        title: chapter2021.title, publicationType: 'book_chapter', doi: '10.1000/xyz.2022', publicationDate: '2022-01-01', externalIds: {},
      })).toBeNull();

      const { service: s2 } = serviceWith([chapter2021]);
      expect(await s2._findExistingContribution('user-1', {
        title: chapter2021.title, publicationType: 'book_chapter', publicationDate: '2026-01-01', externalIds: {},
      })).toBeNull();

      const preface = { ...chapter2021, title: 'Preface', publicationType: 'book' };
      const { service: s3, prisma: p3 } = serviceWith([preface]);
      expect(await s3._findExistingContribution('user-1', {
        title: 'Preface', publicationType: 'book', publicationDate: '2022-01-01', externalIds: {},
      })).toBeNull();
      // The re-published-edition lookup (by type) never runs for a generic title.
      expect(p3.researchContribution.findMany.mock.calls.some(([q]) => q.where.publicationType)).toBe(false);
    });

    test('two different Scopus records with the same title stay two works (Scopus counts both)', async () => {
      // Same chapter title in two different books: Scopus 85125212825 (2021) and 85216650092 (2024).
      const stored = { ...chapter2021, externalIds: { scopus: 'SCOPUS_ID:85125212825' } };
      const { service } = serviceWith([stored]);
      expect(await service._findExistingContribution('user-1', {
        title: 'Impact of COVID-19 on Lifestyle and Education', publicationType: 'book_chapter', publicationDate: '2024-01-01',
        externalIds: { scopus: 'SCOPUS_ID:85216650092' },
      })).toBeNull();
      // The same Scopus record (or a listing with no Scopus id) is still the existing work.
      expect(await service._findExistingContribution('user-1', {
        title: chapter2021.title, publicationType: 'book_chapter', publicationDate: '2021-09-03',
        externalIds: { scopus: '85125212825' },
      })).toBe(stored);
    });

    test('an import link to a work that holds another Scopus record is not reused', async () => {
      // A work merged before this rule: the 2021 Scopus id still points at the 2024 chapter.
      const merged = { ...chapter2021, id: 'c-2024', publicationDate: new Date('2024-01-01T00:00:00Z'), externalIds: { scopus: 'SCOPUS_ID:85216650092' } };
      const { service, prisma } = serviceWith([merged]);
      prisma.publicationImport.findFirst.mockResolvedValue({ researchContribution: merged });
      expect(await service._findExistingContribution('user-1', {
        title: chapter2021.title, publicationType: 'book_chapter', publicationDate: '2021-09-03',
        externalIds: { scopus: 'SCOPUS_ID:85125212825' },
      })).toBeNull();
    });

    test('two prefaces in the same year are different works unless the book is the same', async () => {
      const prefaceA = { id: 'pA', applicantUserId: 'user-1', publicationType: 'book', title: 'Preface', journalName: 'Integration of Cloud Computing with Emerging Technologies', publicationDate: new Date('2023-01-01T00:00:00Z') };
      const { service } = serviceWith([prefaceA]);
      expect(await service._findExistingContribution('user-1', {
        title: 'Preface', publicationType: 'book', venue: 'Trust-Based Communication Systems for IoT Applications', publicationDate: '2023-06-01', externalIds: {},
      })).toBeNull();
      expect(await service._findExistingContribution('user-1', {
        title: 'Preface', publicationType: 'book', venue: 'Integration of Cloud Computing with Emerging Technologies', publicationDate: '2023-06-01', externalIds: {},
      })).toBe(prefaceA);
    });
  });

  test('_findExistingContribution ignores publication import and DOI matches owned by another user', async () => {
    const prisma = {
      publicationImport: {
        findFirst: jest.fn(async () => ({
          researchContribution: {
            id: 'foreign-contribution',
            applicantUserId: 'other-user',
            title: 'Foreign owned paper',
          },
        })),
      },
      researchContribution: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'own-title-match',
            applicantUserId: 'user-1',
            title: 'My Synced Paper',
          }),
      },
    };

    const service = new PublicationSyncService(prisma, {});

    const result = await service._findExistingContribution('user-1', {
      title: 'My Synced Paper',
      doi: '10.1000/example',
      publicationDate: '2026-01-01',
      externalIds: {
        openalex: 'https://openalex.org/W123',
      },
    });

    expect(result).toEqual({
      id: 'own-title-match',
      applicantUserId: 'user-1',
      title: 'My Synced Paper',
    });
    expect(prisma.researchContribution.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        applicantUserId: 'user-1',
        OR: [
          { doi: { equals: '10.1000/example', mode: 'insensitive' } },
          { doi: { endsWith: '/10.1000/example', mode: 'insensitive' } },
        ],
      },
    });
  });

  test('_upsertImportLinks does not overwrite another profile import link', async () => {
    const prisma = {
      publicationImport: {
        findMany: jest.fn(async () => ([{
          id: 'foreign-import-link',
          researchProfileId: 'other-profile',
          sourceSystem: 'openalex',
          externalId: 'https://openalex.org/W123',
        }])),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const service = new PublicationSyncService(prisma, {});

    await service._upsertImportLinks('profile-1', 'contribution-1', {
      title: 'My Synced Paper',
      doi: '10.1000/example',
      publicationDate: '2026-01-01',
      sourceSystems: ['openalex'],
      externalIds: {
        openalex: 'https://openalex.org/W123',
      },
    });

    expect(prisma.publicationImport.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.publicationImport.create).not.toHaveBeenCalled();
    expect(prisma.publicationImport.update).not.toHaveBeenCalled();
    expect(prisma.publicationImport.updateMany).not.toHaveBeenCalled();
  });

  test('_upsertImportLinks: one lookup per work; unchanged links get one lastSeenAt bump, new ids are created', async () => {
    const candidate = {
      title: 'My Synced Paper', doi: '10.1000/example', publicationDate: '2026-01-01', sourceSystems: ['scopus'],
      externalIds: { scopus: 'SCOPUS_ID:1', doi: '10.1000/example' },
    };
    const prisma = {
      publicationImport: {
        findMany: jest.fn(async () => ([{
          id: 'own-link', researchProfileId: 'profile-1', researchContributionId: 'contribution-1', sourceSystem: 'scopus', externalId: 'SCOPUS_ID:1',
          doi: '10.1000/example', normalizedTitle: 'my synced paper', publishedYear: 2026,
        }])),
        create: jest.fn(async () => ({})),
        update: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };
    const service = new PublicationSyncService(prisma, {});
    await service._upsertImportLinks('profile-1', 'contribution-1', candidate);

    expect(prisma.publicationImport.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.publicationImport.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['own-link'] } }, data: { lastSeenAt: expect.any(Date) } });
    expect(prisma.publicationImport.update).not.toHaveBeenCalled();
    expect(prisma.publicationImport.create).toHaveBeenCalledTimes(1);
    expect(prisma.publicationImport.create.mock.calls[0][0].data).toMatchObject({ sourceSystem: 'doi', externalId: '10.1000/example' });
  });
});

describe('PublicationSyncService._deriveIndexingCategories — flagship journals', () => {
  const service = new PublicationSyncService({}, {});
  const cats = (journalName) => service._deriveIndexingCategories({ sourceSystems: ['scopus'], journalName });

  it('tags only Nature, Science, The Lancet, Cell and NEJM themselves', () => {
    for (const j of ['Nature', 'Science', 'The Lancet', 'Lancet', 'Cell', 'NEJM', 'New England Journal of Medicine']) {
      expect(cats(j)).toContain('nature_science_lancet_cell_nejm');
    }
  });

  it('does not tag journals that merely contain those words', () => {
    for (const j of ['Pertanika journal of science & technology', 'Scientific Reports', 'Applied Sciences', 'Cell Reports',
      'Nature Communications', 'Journal of Computer Science', 'Fuel Cells', 'Nature-Inspired Computing']) {
      expect(cats(j)).not.toContain('nature_science_lancet_cell_nejm');
      expect(cats(j)).toContain('scopus');
    }
  });
});
