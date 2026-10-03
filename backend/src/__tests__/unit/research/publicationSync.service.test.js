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
        findFirst: jest.fn(async () => ({
          id: 'foreign-import-link',
          researchProfileId: 'other-profile',
        })),
        create: jest.fn(),
        update: jest.fn(),
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

    expect(prisma.publicationImport.findFirst).toHaveBeenCalled();
    expect(prisma.publicationImport.create).not.toHaveBeenCalled();
    expect(prisma.publicationImport.update).not.toHaveBeenCalled();
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
