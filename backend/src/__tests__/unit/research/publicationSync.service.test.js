const PublicationSyncService = require('../../../modules/research/services/publicationSync.service');

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

  test('runScheduledSync honors per-profile syncFrequencyDays', async () => {
    const prisma = {
      researchProfileIdentity: {
        findMany: jest.fn(async () => ([
          {
            userId: 'due-daily',
            lastSyncedAt: new Date('2026-04-27T11:00:00.000Z'),
            syncFrequencyDays: 1,
          },
          {
            userId: 'not-due-three-day',
            lastSyncedAt: new Date('2026-04-26T13:00:00.000Z'),
            syncFrequencyDays: 3,
          },
          {
            userId: 'never-synced',
            lastSyncedAt: null,
            syncFrequencyDays: 7,
          },
        ])),
      },
    };

    const service = new PublicationSyncService(prisma, {});
    const syncSpy = jest.spyOn(service, 'syncFacultyPublications')
      .mockResolvedValue({ createdCount: 1, updatedCount: 0 });

    const results = await service.runScheduledSync();

    expect(syncSpy).toHaveBeenCalledTimes(2);
    expect(syncSpy).toHaveBeenNthCalledWith(1, 'due-daily', { triggerType: 'scheduled' });
    expect(syncSpy).toHaveBeenNthCalledWith(2, 'never-synced', { triggerType: 'scheduled' });
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.userId)).toEqual(['due-daily', 'never-synced']);
  });

  test('_matchOwningFaculty prefers an actual faculty match over the first imported author', () => {
    const service = new PublicationSyncService({}, {});
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

    const result = await service._discoverCandidates(user, identity, ['orcid', 'openalex']);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe('ORCID Paper');
    expect(result.sourceErrors).toEqual([
      { source: 'openalex', message: 'OpenAlex author search failed (400)' },
    ]);
  });

  test('_findBestOpenAlexAuthorId retries without institution filter and supports last_known_institutions', async () => {
    const service = new PublicationSyncService({}, {});

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'https://openalex.org/A123456789',
              display_name: 'Sourav Test Mukhopadhyay',
              display_name_alternatives: ['S T Mukhopadhyay'],
              last_known_institutions: [
                { display_name: 'SGT University' },
              ],
              works_count: 24,
            },
          ],
        }),
      });

    const authorId = await service._findBestOpenAlexAuthorId(
      'Sourav Test Mukhopadhyay',
      'https://openalex.org/I987654321',
      { affiliationAliases: ['SGT University'] }
    );

    expect(authorId).toBe('https://openalex.org/A123456789');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toContain('per-page=10');
    expect(global.fetch.mock.calls[0][0]).toContain('last_known_institution.id%3AI987654321');
    expect(global.fetch.mock.calls[1][0]).toContain('per-page=10');
    expect(global.fetch.mock.calls[1][0]).not.toContain('last_known_institution.id');
  });

  test('_findExistingContribution ignores publication import and DOI matches owned by another user', async () => {
    const prisma = {
      publicationImport: {
        findUnique: jest.fn(async () => ({
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
        doi: '10.1000/example',
      },
    });
  });

  test('_upsertImportLinks does not overwrite another profile import link', async () => {
    const prisma = {
      publicationImport: {
        findUnique: jest.fn(async () => ({
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

    expect(prisma.publicationImport.findUnique).toHaveBeenCalled();
    expect(prisma.publicationImport.create).not.toHaveBeenCalled();
    expect(prisma.publicationImport.update).not.toHaveBeenCalled();
  });
});
