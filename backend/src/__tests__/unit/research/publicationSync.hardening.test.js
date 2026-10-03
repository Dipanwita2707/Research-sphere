/**
 * Publication sync hardening: strong-identifier OpenAlex resolution, per-tenant Scopus
 * affiliation ids, Scopus author lists, owner matching, ORCID mapping, DOI handling,
 * retries/timeouts, re-sync "unchanged" detection and identity verification.
 * External APIs are mocked with fixture payloads shaped like the real responses.
 */
const PublicationSyncService = require('../../../modules/research/services/publicationSync.service');
const { generateAffiliationVariants } = require('../../../shared/utils/affiliationEngine');

const SGT_VARIANTS = generateAffiliationVariants({
  name: 'SGT University',
  code: 'SGT',
  city: 'Gurugram',
  state: 'Haryana',
  extraAliases: ['Shree Guru Gobind Singh Tricentenary University'],
});

const jsonResponse = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
  json: async () => body,
});

function makeService(prisma = {}, contributionService = {}) {
  const service = new PublicationSyncService(prisma, contributionService);
  service._affiliationVariants = SGT_VARIANTS;
  service._ownerAffiliationVariants = SGT_VARIANTS;
  service._affiliationOptions = { locations: ['Gurugram', 'Haryana'], country: 'India' };
  service._scopusAffiliationIds = new Set(['60113772']);
  service._canonicalUniversityName = 'SGT University';
  service._sleep = jest.fn(async () => {});
  return service;
}

const owner = {
  id: 'user-owner',
  uid: 'FAC-10',
  email: 'rahul.das@sgt.example',
  role: 'faculty',
  employeeDetails: { displayName: 'Dr. Rahul Das' },
};

// ── Fixtures ────────────────────────────────────────────────────────────────
// Scopus Search API, view=COMPLETE (trimmed real payload shape)
const scopusCompleteEntry = {
  'dc:identifier': 'SCOPUS_ID:85071121599',
  'dc:title': 'Plasmonic sensing with graphene',
  'prism:publicationName': 'Journal of Applied Physics',
  'prism:doi': '10.1063/1.5110000',
  'prism:coverDate': '2019-08-14',
  'citedby-count': '12',
  subtypeDescription: 'Article',
  affiliation: [
    { afid: '60113772', affilname: 'SGT University', 'affiliation-city': 'Gurugram', 'affiliation-country': 'India' },
    { afid: '60025447', affilname: "St. John's University", 'affiliation-city': 'Queens', 'affiliation-country': 'United States' },
  ],
  author: [
    { '@seq': '1', authid: '57200000001', authname: 'Das R.', 'given-name': 'Rahul', surname: 'Das', afid: [{ $: '60113772' }] },
    { '@seq': '2', authid: '6506506893', authname: 'Lukeman P.S.', 'given-name': 'Philip S.', surname: 'Lukeman', afid: [{ $: '60025447' }] },
    { '@seq': '3', authid: '57200000003', authname: 'Sharma A.', 'given-name': 'Anita', surname: 'Sharma', afid: [{ $: '60113772' }] },
  ],
};
const scopusStandardEntry = { ...scopusCompleteEntry };
delete scopusStandardEntry.author;

// Scopus Abstract Retrieval API (view=FULL)
const scopusAbstract = {
  'abstracts-retrieval-response': {
    affiliation: [
      { '@id': '60113772', affilname: 'SGT University', 'affiliation-city': 'Gurugram', 'affiliation-country': 'India' },
      { '@id': '60025447', affilname: "St. John's University", 'affiliation-city': 'Queens', 'affiliation-country': 'United States' },
    ],
    authors: {
      author: [
        { '@seq': '1', '@auid': '57200000001', 'ce:indexed-name': 'Das R.', 'ce:given-name': 'Rahul', 'ce:surname': 'Das', affiliation: { '@id': '60113772' } },
        { '@seq': '2', '@auid': '6506506893', 'ce:indexed-name': 'Lukeman P.S.', 'ce:given-name': 'Philip S.', 'ce:surname': 'Lukeman', affiliation: [{ '@id': '60025447' }] },
      ],
    },
  },
};

// OpenAlex work (trimmed)
const openAlexWork = (overrides = {}) => ({
  id: 'https://openalex.org/W100',
  doi: 'https://doi.org/10.1063/1.5110000',
  display_name: 'Plasmonic sensing with graphene',
  type: 'article',
  type_crossref: 'journal-article',
  publication_date: '2019-08-14',
  cited_by_count: 30,
  primary_location: { source: { display_name: 'Journal of Applied Physics', issn_l: '0021-8979', type: 'journal' } },
  authorships: [
    {
      author: { id: 'https://openalex.org/A111', display_name: 'Rahul Das', orcid: 'https://orcid.org/0000-0002-1825-0097' },
      institutions: [{ display_name: 'SGT University', country_code: 'IN' }],
    },
    {
      author: { id: 'https://openalex.org/A222', display_name: 'Philip Lukeman', orcid: null },
      institutions: [{ display_name: "St. John's University", country_code: 'US' }],
    },
  ],
  ...overrides,
});

// ORCID v3 work detail (real record of the public test ORCID 0000-0002-1825-0097)
const orcidSummary = { 'put-code': 4562455, title: { title: { value: 'The Memory Bus Considered Harmful' } } };
const orcidDetail = {
  title: { title: { value: 'The Memory Bus Considered Harmful' } },
  'journal-title': null,
  citation: {
    'citation-type': 'bibtex',
    'citation-value': '@article{Carberry_2012, title={The Memory Bus Considered Harmful}, volume={9}, url={http://dx.doi.org/10.5555/666655554444}, DOI={10.5555/666655554444}, number={11}, journal={Journal of Psychoceramics}, publisher={CrossRef test user}, author={Carberry, Josiah}, year={2012}, month={Oct}, pages={1-3}}',
  },
  type: 'journal-article',
  'publication-date': { year: { value: '2012' }, month: { value: '10' }, day: { value: '05' } },
  'external-ids': {
    'external-id': [
      { 'external-id-type': 'issn', 'external-id-value': '0264-3561', 'external-id-relationship': 'part-of' },
      { 'external-id-type': 'isbn', 'external-id-value': '978-3-16-148410-0', 'external-id-relationship': 'part-of' },
      { 'external-id-type': 'doi', 'external-id-value': 'https://doi.org/10.5555/666655554444', 'external-id-relationship': 'self' },
    ],
  },
  contributors: {
    contributor: [
      { 'contributor-orcid': { path: '0000-0002-1825-0097' }, 'credit-name': { value: 'Carberry, Josiah' }, 'contributor-attributes': { 'contributor-sequence': 'first', 'contributor-role': 'author' } },
      { 'contributor-orcid': null, 'credit-name': { value: 'Quinn, J.J.' }, 'contributor-attributes': { 'contributor-sequence': 'additional', 'contributor-role': 'author' } },
    ],
  },
};

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
  PublicationSyncService._scopusState.completeViewDenied = false;
  PublicationSyncService._scopusState.abstractDenied = false;
  PublicationSyncService._scopusAuthorCache.clear();
});

describe('OpenAlex author resolution (no name-only matching)', () => {
  test('without ORCID / Scopus / stored OpenAlex id, OpenAlex is skipped with a reason and never queried', async () => {
    const service = makeService();
    global.fetch = jest.fn();
    const out = await service._fetchOpenAlexWorks(
      { id: 'u', employeeDetails: { displayName: 'Suresh Patel' } },
      { orcid: null, scopusAuthorId: null, openAlexAuthorId: null }
    );
    expect(out.works).toEqual([]);
    expect(out.skipped).toMatch(/not searched by name/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('resolves the author by ORCID, stores the id, filters works by author.id and drops works not listing the author', async () => {
    const prisma = { researchProfileIdentity: { update: jest.fn(async () => ({})) } };
    const service = makeService(prisma);
    global.fetch = jest.fn(async (url) => {
      if (url.includes('/authors?')) {
        expect(url).toContain('filter=orcid%3A0000-0002-1825-0097');
        return jsonResponse({ results: [{ id: 'https://openalex.org/A111', display_name: 'Rahul Das', orcid: 'https://orcid.org/0000-0002-1825-0097' }] });
      }
      expect(url).toContain('author.id%3AA111');
      return jsonResponse({
        meta: { count: 2 },
        results: [
          openAlexWork(),
          // A work that does not list A111 (e.g. index glitch): must not be imported
          openAlexWork({ id: 'https://openalex.org/W999', doi: null, display_name: 'Someone else', authorships: [{ author: { id: 'https://openalex.org/A777', display_name: 'R. Das' }, institutions: [] }] }),
        ],
      });
    });

    const out = await service._fetchOpenAlexWorks(owner, { id: 'ident-1', orcid: '0000-0002-1825-0097' });
    expect(out.works.map((w) => w.title)).toEqual(['Plasmonic sensing with graphene']);
    expect(out.stats).toMatchObject({ resolvedVia: 'orcid', authorIds: ['A111'], droppedNotListingAuthor: 1 });
    expect(prisma.researchProfileIdentity.update).toHaveBeenCalledWith({
      where: { id: 'ident-1' },
      data: {
        openAlexAuthorId: 'A111',
        identityVerification: { openalex: { resolvedFrom: 'orcid:0000-0002-1825-0097', ids: ['A111'], checkedAt: expect.any(String) } },
      },
    });
  });

  test('a stored OpenAlex id resolved from an ORCID that has since changed is re-resolved', async () => {
    const service = makeService({ researchProfileIdentity: { update: jest.fn(async () => ({})) } });
    global.fetch = jest.fn(async () => jsonResponse({ results: [{ id: 'https://openalex.org/A555', display_name: 'Rahul Das', orcid: 'https://orcid.org/0000-0001-0000-0002' }] }));
    const result = await service._resolveOpenAlexAuthorIds(owner, {
      id: 'i', orcid: '0000-0001-0000-0002', openAlexAuthorId: 'A111',
      identityVerification: { openalex: { resolvedFrom: 'orcid:0000-0002-1825-0097' } },
    });
    expect(result).toMatchObject({ ids: ['A555'], via: 'orcid' });
  });

  test('several OpenAlex profiles sharing an ORCID, none with the employee name: skipped (namesake protection)', async () => {
    const service = makeService({ researchProfileIdentity: { update: jest.fn() } });
    global.fetch = jest.fn(async () => jsonResponse({
      results: [
        { id: 'https://openalex.org/A1', display_name: 'Iain S. Burns', orcid: 'https://orcid.org/0000-0002-1825-0097' },
        { id: 'https://openalex.org/A2', display_name: 'Lucimar Santiago de Abreu', orcid: 'https://orcid.org/0000-0002-1825-0097' },
      ],
    }));
    const out = await service._fetchOpenAlexWorks(owner, { id: 'i', orcid: '0000-0002-1825-0097' });
    expect(out.works).toEqual([]);
    expect(out.skipped).toMatch(/share this ORCID and none matches/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a stored OpenAlex author id is used without any author search', async () => {
    const service = makeService();
    global.fetch = jest.fn(async () => jsonResponse({ meta: { count: 1 }, results: [openAlexWork()] }));
    const out = await service._fetchOpenAlexWorks(owner, { openAlexAuthorId: 'A111' });
    expect(out.works).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/works?');
  });

  test('institution lookup never falls back to the first search hit', async () => {
    const service = makeService();
    global.fetch = jest.fn(async () => jsonResponse({
      results: [{ id: 'https://openalex.org/I38538140', display_name: 'Asian Institute of Technology' }],
    }));
    await expect(service._findOpenAlexInstitutionId()).resolves.toBeNull();

    const service2 = makeService();
    global.fetch = jest.fn(async () => jsonResponse({
      results: [
        { id: 'https://openalex.org/I1', display_name: 'Amity University' },
        { id: 'https://openalex.org/I2', display_name: 'Shree Guru Gobind Singh Tricentenary University' },
      ],
    }));
    await expect(service2._findOpenAlexInstitutionId()).resolves.toBe('https://openalex.org/I2');
  });
});

describe('Scopus: per-tenant affiliation ids and author lists', () => {
  test('home authors come from the tenant\'s configured Scopus affiliation ids, not a hard-coded list', () => {
    const service = makeService();
    const mapped = service._mapScopusWork(scopusCompleteEntry);
    expect(mapped.authors.map((a) => [a.name, a.isSgtByAfid])).toEqual([
      ['Rahul Das', true], ['Philip S. Lukeman', false], ['Anita Sharma', true],
    ]);
    expect(mapped.homeInstitutionOnPaper).toBe(true);

    const other = makeService();
    other._scopusAffiliationIds = new Set(); // another tenant: SGT's afid means nothing there
    other._affiliationVariants = generateAffiliationVariants({ name: 'Delhi Technological University', code: 'DTU' });
    const mappedOther = other._mapScopusWork(scopusCompleteEntry);
    expect(mappedOther.authors.some((a) => a.isSgtByAfid)).toBe(false);
    expect(mappedOther.homeInstitutionOnPaper).toBe(false);
  });

  test('"my university only" constrains the search with the tenant\'s AF-IDs; requests view=COMPLETE', async () => {
    process.env.SCOPUS_API_KEY = 'k';
    const service = makeService();
    service._scopusAffiliationIds = new Set(['60113772', '124037491']);
    global.fetch = jest.fn(async () => jsonResponse({ 'search-results': { 'opensearch:totalResults': '1', entry: [scopusCompleteEntry] } }));
    const out = await service._fetchScopusWorks('57200000001', { filterSgtOnly: true });
    const url = decodeURIComponent(global.fetch.mock.calls[0][0]).replace(/\+/g, ' ');
    expect(url).toContain('AU-ID(57200000001) AND (AF-ID(60113772) OR AF-ID(124037491))');
    expect(url).toContain('view=COMPLETE');
    expect(out.works[0].authors).toHaveLength(3);
    expect(out.stats.authorsFromSearch).toBe(1);
  });

  test('COMPLETE view denied (403): falls back to STANDARD and fetches authors via the Abstract API', async () => {
    process.env.SCOPUS_API_KEY = 'k';
    const service = makeService();
    global.fetch = jest.fn(async (url) => {
      if (url.includes('/search/scopus') && url.includes('view=COMPLETE')) return jsonResponse({}, 403);
      if (url.includes('/search/scopus')) return jsonResponse({ 'search-results': { 'opensearch:totalResults': '1', entry: [scopusStandardEntry] } });
      if (url.includes('/abstract/scopus_id/85071121599')) return jsonResponse(scopusAbstract);
      throw new Error(`unexpected ${url}`);
    });
    const out = await service._fetchScopusWorks('57200000001');
    expect(out.stats).toMatchObject({ view: 'STANDARD', authorsFromAbstract: 1, authorsMissing: 0 });
    expect(out.works[0].authors.map((a) => [a.name, a.scopusAuthorId, a.isSgtByAfid, a.country])).toEqual([
      ['Rahul Das', '57200000001', true, 'India'],
      ['Philip S. Lukeman', '6506506893', false, 'United States'],
    ]);
    expect(out.works[0].authorsSource).toBe('scopus_abstract');

    // Abstract results are cached per paper; COMPLETE is not retried for this key.
    global.fetch.mockClear();
    await service._fetchScopusWorks('57200000001');
    expect(global.fetch.mock.calls.map((c) => c[0]).filter((u) => u.includes('/abstract/'))).toHaveLength(0);
    expect(global.fetch.mock.calls[0][0]).toContain('view=STANDARD');
  });

  test('Abstract API not entitled: authors come from OpenAlex by DOI', async () => {
    process.env.SCOPUS_API_KEY = 'k';
    const service = makeService();
    PublicationSyncService._scopusState.completeViewDenied = true;
    global.fetch = jest.fn(async (url) => {
      if (url.includes('/search/scopus')) return jsonResponse({ 'search-results': { 'opensearch:totalResults': '1', entry: [scopusStandardEntry] } });
      if (url.includes('/abstract/')) return jsonResponse({}, 401);
      if (url.includes('/works/doi:10.1063/1.5110000')) return jsonResponse(openAlexWork());
      throw new Error(`unexpected ${url}`);
    });
    const out = await service._fetchScopusWorks('57200000001');
    expect(out.stats).toMatchObject({ authorsFromOpenAlex: 1 });
    expect(out.works[0].authors.map((a) => a.name)).toEqual(['Rahul Das', 'Philip Lukeman']);
    expect(out.works[0].authorsSource).toBe('openalex_doi');
  });
});

describe('Author resolution: owner matching, no invented owner, batched lookups', () => {
  const prismaFor = (rows = []) => ({
    researchProfileIdentity: { findMany: jest.fn(async () => []) },
    userLogin: { findMany: jest.fn(async () => rows) },
  });

  test('owner matched by Scopus id at their real position; co-author home counting runs', async () => {
    const service = makeService(prismaFor());
    const { authors } = service._mapScopusWork(scopusCompleteEntry);
    const mapped = await service._resolveAuthors(authors, owner, { scopusAuthorId: '57200000001' });
    expect(mapped.ownerFound).toBe(true);
    expect(mapped.authors).toHaveLength(3);
    expect(mapped.authors[0]).toMatchObject({ uid: 'FAC-10', orderNumber: 1, authorType: 'internal_faculty' });
    expect(mapped.authors[1]).toMatchObject({ name: 'Philip S. Lukeman', authorType: 'external_academic', isInternational: true });
    // Anita Sharma is SGT-affiliated but has no account here: counted as home, flagged for mapping
    expect(mapped.authors[2]).toMatchObject({ name: 'Anita Sharma', authorType: 'internal_faculty' });
    expect(mapped.sgtAffiliatedAuthors).toBe(2);
    expect(mapped.foreignCollaborationsCount).toBe(1);
  });

  test('owner absent from the author list: nobody is invented and the work goes to special review', async () => {
    const service = makeService(prismaFor());
    const authors = [
      { name: 'Philip S. Lukeman', affiliation: "St. John's University", country: 'United States', authorOrder: 1 },
      { name: 'Dustin J. Covell', affiliation: 'Franklin and Marshall College', country: 'United States', authorOrder: 2 },
    ];
    const mapped = await service._resolveAuthors(authors, owner, {});
    expect(mapped.ownerFound).toBe(false);
    expect(mapped.authors.map((a) => a.name)).toEqual(['Philip S. Lukeman', 'Dustin J. Covell']);
    expect(mapped.authors.some((a) => a.uid === 'FAC-10')).toBe(false);

    const payload = await service._buildContributionInput(owner, { id: 'i' }, {
      title: 'T', publicationDate: '2020-01-01', journalName: 'J', authors, sourceSystems: ['orcid'], externalIds: {},
    }, null);
    expect(payload.specialReviewRequired).toBe(true);
    expect(payload.missingFields).toContain('ownerNotInAuthorList');
    expect(payload.importMetadata.ownerFoundInAuthorList).toBe(false);
  });

  test('owner matched by name forms (initials, "Last, First", titles) only with a home or unknown affiliation', () => {
    const service = makeService();
    expect(service._matchOwningFaculty([{ name: 'Das, R.', affiliation: 'Dept. of Physics, SGT University, Gurugram' }], owner, {})).toBeTruthy();
    expect(service._matchOwningFaculty([{ name: 'Das R.', affiliation: null }], owner, {})).toBeTruthy();
    // Same name at another institution: not the owner
    expect(service._matchOwningFaculty([{ name: 'Rahul Das', affiliation: 'IIT Bombay, Mumbai' }], owner, {})).toBeNull();
    expect(service._matchOwningFaculty([{ name: 'Rohit Das', affiliation: 'SGT University' }], owner, {})).toBeNull();
  });

  test('_personNameMatches normalisation', () => {
    const s = makeService();
    expect(s._personNameMatches('Dr. Rahul Das', 'Das R.')).toBe(true);
    expect(s._personNameMatches('Prof. Anita K. Sharma', 'Sharma, A.K.')).toBe(true);
    expect(s._personNameMatches('Carberry T.P.', 'Tom P. Carberry')).toBe(true);
    expect(s._personNameMatches('Rahul Kumar', 'Amit Kumar')).toBe(false);
    expect(s._personNameMatches('Das', 'Rahul Das')).toBe(false);
  });

  test('co-author name match is refused when the affiliation belongs to another institution; lookups are batched', async () => {
    const colleague = { id: 'user-2', uid: 'FAC-02', email: 'a@x', employeeDetails: { displayName: 'Anita Sharma' } };
    const prisma = prismaFor([colleague]);
    const service = makeService(prisma);
    const authors = [
      { name: 'Das R.', scopusAuthorId: '57200000001', affiliation: 'SGT University', authorOrder: 1 },
      { name: 'Sharma A.', affiliation: 'Amity University, Gurugram', authorOrder: 2 },
      { name: 'Sharma A.', affiliation: 'SGT University, Gurugram', authorOrder: 3 },
      { name: 'Lee K.', affiliation: 'KAIST, Korea', authorOrder: 4 },
    ];
    const matches = await service._matchInternalAuthors(authors, 0);
    expect(matches[1]).toBeNull();
    expect(matches[2]).toMatchObject({ user: { id: 'user-2' }, confidence: 0.7 });
    expect(matches[3]).toBeNull();
    // one surname query for the whole paper (home-affiliated names only), no per-author queries
    expect(prisma.userLogin.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.researchProfileIdentity.findMany).not.toHaveBeenCalled();
  });
});

describe('ORCID mapping, DOIs and type mapping', () => {
  test('_mapOrcidWork maps volume/issue/pages from the record, issn from external-ids, contributors without role-as-affiliation', () => {
    const service = makeService();
    const work = service._mapOrcidWork(orcidSummary, orcidDetail, '0000-0002-1825-0097');
    expect(work.volume).toBe('9');
    expect(work.issue).toBe('11');
    expect(work.pageNumbers).toBe('1-3');
    expect(work.issn).toBe('0264-3561');
    expect(work.isbn).toBe('978-3-16-148410-0');
    expect(work.journalName).toBe('Journal of Psychoceramics');
    expect(work.doi).toBe('10.5555/666655554444');
    expect(work.weblink).toBe('https://doi.org/10.5555/666655554444');
    expect(work.publicationDate).toBe('2012-10-05');
    expect(work.datePrecision).toBe('day');
    expect(work.authors).toEqual([
      expect.objectContaining({ name: 'Carberry, Josiah', affiliation: null, orcid: '0000-0002-1825-0097', isOrcidOwner: true }),
      expect.objectContaining({ name: 'Quinn, J.J.', affiliation: null, orcid: null }),
    ]);
  });

  test('year-only ORCID dates keep year precision and lose to a full date when merged', () => {
    const service = makeService();
    const yearOnly = service._mapOrcidWork(orcidSummary, { ...orcidDetail, 'publication-date': { year: { value: '2012' }, month: null, day: null } });
    expect(yearOnly).toMatchObject({ publicationDate: '2012-01-01', datePrecision: 'year' });
    const merged = service._mergeCandidate(
      { ...yearOnly, citationCount: 40 },
      { title: 'x', publicationDate: '2012-10-05', datePrecision: 'day', sourceSystems: ['scopus'], citationCount: 12 }
    );
    expect(merged.publicationDate).toBe('2012-10-05');
    // citation counts: highest across sources, not last writer
    expect(merged.citationCount).toBe(40);
    const fullFirst = service._mergeCandidate(
      { title: 'x', publicationDate: '2012-10-05', datePrecision: 'day', sourceSystems: ['scopus'] },
      { title: 'x', publicationDate: '2012-01-01', datePrecision: 'year', sourceSystems: ['openalex'] }
    );
    expect(fullFirst.publicationDate).toBe('2012-10-05');
  });

  test('DOIs are normalised for keys and lookups', () => {
    const service = makeService();
    expect(service._candidateKey({ doi: 'https://doi.org/10.1000/ABC.5' }))
      .toBe(service._candidateKey({ doi: '10.1000/abc.5' }));
    expect(service._mapOpenAlexWork(openAlexWork({ doi: 'https://doi.org/10.1063/1.5110000' })).weblink)
      .toBe('https://doi.org/10.1063/1.5110000');
  });

  test('proceedings-article / conference types map to conference_paper', () => {
    const service = makeService();
    expect(service._inferPublicationType({ rawType: 'proceedings-article' })).toBe('conference_paper');
    expect(service._inferPublicationType({ rawType: 'CONFERENCE_PAPER' })).toBe('conference_paper');
    expect(service._inferPublicationType({ rawType: 'book-chapter' })).toBe('book_chapter');
    expect(service._inferPublicationType({ rawType: 'Article', aggregationType: 'Conference Proceeding' })).toBe('conference_paper');
    expect(service._inferPublicationType({ rawType: 'journal-article' })).toBe('research_paper');
  });
});

describe('Owner affiliation check (filter "my university only")', () => {
  test('city-only matches are rejected; segments, user aliases and AF-IDs accepted', () => {
    const service = makeService();
    expect(service._isHomeInstitutionAuthor({ affiliation: 'Amity University, Gurugram, Haryana' })).toBe(false);
    expect(service._isHomeInstitutionAuthor({ affiliation: 'Medanta Hospital, Gurugram' })).toBe(false);
    expect(service._isHomeInstitutionAuthor({ affiliation: 'IIT Delhi; Dept. of Physics, SGT University, Gurugram' })).toBe(true);
    expect(service._isHomeInstitutionAuthor({ affiliation: '', scopusAfids: ['60113772'] })).toBe(true);
    expect(service._isHomeInstitutionAuthor({ affiliation: '', scopusAfids: ['99999'] })).toBe(false);

    service._ownerAffiliationVariants = [...SGT_VARIANTS, 'SGT Medical College'];
    expect(service._isHomeInstitutionAuthor({ affiliation: 'SGT Medical College, Budhera' })).toBe(true);
    // ...but the user's alias never makes a co-author home-affiliated
    expect(service._isAuthorHomeAffiliated({ affiliation: 'SGT Medical College, Budhera' })).toBe(false);
  });
});

describe('Reliability', () => {
  test('_fetchWithRetry honours Retry-After on 429 and then succeeds', async () => {
    const service = makeService();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const res = await service._fetchWithRetry('https://x', {}, { retries: 2 });
    expect(res.status).toBe(200);
    expect(service._sleep).toHaveBeenCalledWith(2000);
  });

  test('_fetchWithRetry aborts slow requests and gives up after bounded retries', async () => {
    const service = makeService();
    global.fetch = jest.fn((url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    await expect(service._fetchWithRetry('https://slow', {}, { source: 'ORCID', timeoutMs: 10, retries: 1 }))
      .rejects.toThrow('ORCID request timed out after 10ms');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('_fetchWithRetry does not retry a 404', async () => {
    const service = makeService();
    global.fetch = jest.fn(async () => jsonResponse({}, 404));
    const res = await service._fetchWithRetry('https://x', {}, { retries: 3 });
    expect(res.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a failed source does not mark the profile synced: short retry instead of syncFrequencyDays', async () => {
    const prisma = { researchProfileIdentity: { update: jest.fn(async () => ({})) } };
    const service = makeService(prisma);
    const before = Date.now();
    await service._recordSyncOutcome({ id: 'i', syncFrequencyDays: 7 }, { ok: false, error: 'SCOPUS failed', partial: true });
    const failed = prisma.researchProfileIdentity.update.mock.calls[0][0].data;
    expect(failed.lastSyncedAt).toBeUndefined();
    expect(failed.syncStatus).toBe('partial_success');
    expect(failed.nextSyncAt.getTime() - before).toBeGreaterThanOrEqual(6 * 3600000 - 1000);
    expect(failed.nextSyncAt.getTime() - before).toBeLessThan(7 * 3600000);

    await service._recordSyncOutcome({ id: 'i', syncFrequencyDays: 7 }, { ok: true });
    const ok = prisma.researchProfileIdentity.update.mock.calls[1][0].data;
    expect(ok.lastSyncedAt).toBeInstanceOf(Date);
    expect(ok.nextSyncAt.getTime() - ok.lastSyncedAt.getTime()).toBe(7 * 86400000);
  });

  test('re-sync with nothing new reports skipped and writes only bookkeeping', async () => {
    const prisma = {
      researchContribution: { update: jest.fn(async ({ data }) => ({ id: 'c1', ...data })) },
      researchContributionAuthor: { count: jest.fn(async () => 2) },
    };
    const service = makeService(prisma, { submitContribution: jest.fn() });
    const existing = {
      id: 'c1',
      status: 'submitted',
      sourceType: 'auto_import',
      title: 'T',
      doi: '10.1/x',
      journalName: 'J',
      publicationDate: new Date('2020-05-01T00:00:00.000Z'),
      sourceSystems: ['scopus'],
      specialReviewRequired: false,
      fieldProvenance: { doi: 'auto' },
      indexingDetails: { citationCount: 3, sourceSystems: ['scopus'] },
      importMetadata: {},
    };
    const payload = {
      title: 'T', doi: '10.1/x', journalName: 'J', publicationDate: '2020-05-01',
      sourceSystems: ['scopus'], specialReviewRequired: false,
      indexingDetails: { sourceSystems: ['scopus'], citationCount: 3 },
      importMetadata: { source: 'auto_import' },
      authors: [{ name: 'a' }, { name: 'b' }],
    };
    const result = await service._updateExistingContribution(existing, payload, { title: 'T' });
    expect(result._outcome).toBe('skippedCount');
    expect(Object.keys(prisma.researchContribution.update.mock.calls[0][0].data).sort()).toEqual(['importMetadata', 'lastSyncedAt']);

    // A real change (new citation count) is an update
    const changed = await service._updateExistingContribution(existing, {
      ...payload, indexingDetails: { sourceSystems: ['scopus'], citationCount: 9 },
    }, { title: 'T' });
    expect(changed._outcome).toBe('updatedCount');
  });
});

describe('Identity verification', () => {
  const prismaWithUser = (identity = null) => ({
    userLogin: {
      findUnique: jest.fn(async () => ({
        id: 'u1', employeeDetails: { displayName: 'Josiah Carberry' }, researchProfileIdentity: identity,
      })),
    },
    researchProfileIdentity: { upsert: jest.fn(async ({ update }) => ({ id: 'i', ...update })) },
  });

  test('ORCID verified against the ORCID public registry by name', async () => {
    const prisma = prismaWithUser();
    const service = makeService(prisma);
    global.fetch = jest.fn(async (url) => {
      expect(url).toContain('/0000-0002-1825-0097/person');
      return jsonResponse({ name: { 'given-names': { value: 'Josiah' }, 'family-name': { value: 'Carberry' } } });
    });
    const saved = await service._upsertProfileIdentity('u1', { orcid: '0000-0002-1825-0097' });
    expect(saved.identityVerification.orcid).toMatchObject({ status: 'verified', name: 'Josiah Carberry' });
    expect(saved.openAlexAuthorId).toBeNull();
  });

  test('ORCID of someone else is rejected; unknown ORCID is rejected', async () => {
    const service = makeService(prismaWithUser());
    global.fetch = jest.fn(async () => jsonResponse({ name: { 'given-names': { value: 'Iain' }, 'family-name': { value: 'Burns' } } }));
    await expect(service._upsertProfileIdentity('u1', { orcid: '0000-0002-1825-0097' }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('does not match your name') });

    global.fetch = jest.fn(async () => jsonResponse({}, 404));
    await expect(service._upsertProfileIdentity('u1', { orcid: '0000-0002-1825-0098' }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('does not exist') });
  });

  test('registry unreachable: the id is saved and marked unverified (not rejected, not silently accepted)', async () => {
    const service = makeService(prismaWithUser());
    global.fetch = jest.fn(async () => { throw new Error('ECONNRESET'); });
    const saved = await service._upsertProfileIdentity('u1', { orcid: '0000-0002-1825-0097' });
    expect(saved.orcid).toBe('0000-0002-1825-0097');
    expect(saved.identityVerification.orcid).toMatchObject({ status: 'unverified', reason: expect.stringContaining('unreachable') });
  });

  test('Scopus id checked with the configured Scopus key/base URL', async () => {
    process.env.SCOPUS_API_KEY = 'k';
    const service = makeService(prismaWithUser());
    global.fetch = jest.fn(async (url, init) => {
      expect(url).toContain('/author/author_id/54789459100?view=LIGHT');
      expect(init.headers['X-ELS-APIKey']).toBe('k');
      return jsonResponse({ 'author-retrieval-response': [{ '@status': 'found', 'preferred-name': { surname: 'Carberry', 'given-name': 'J.' } }] });
    });
    const saved = await service._upsertProfileIdentity('u1', { scopusAuthorId: '54789459100' });
    expect(saved.identityVerification.scopus).toMatchObject({ status: 'verified', via: 'scopus' });
  });

  test('unchanged ids are not re-verified', async () => {
    const service = makeService(prismaWithUser({ orcid: '0000-0002-1825-0097', identityVerification: { orcid: { status: 'verified' } } }));
    global.fetch = jest.fn();
    const saved = await service._upsertProfileIdentity('u1', { orcid: '0000-0002-1825-0097', autoSyncEnabled: false });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(saved.identityVerification).toBeUndefined();
  });
});
