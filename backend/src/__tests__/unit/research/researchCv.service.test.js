/**
 * Unit tests: one-page research CV.
 *   - always exactly one page, even with a long record and every CV section filled
 *   - publications are a selection (most cited first), with totals; never the full list
 *   - built from the visibility-checked profile; patents/grants only when publications are visible
 *   - references only on the author's own copy; incentive amounts never printed
 *   - CV details the author enters are validated and capped
 * Prisma and the profile service are mocked.
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
const mockProfile = { getProfileForViewer: jest.fn() };
jest.mock('../../../modules/research/services/authorProfile.service', () => mockProfile);

const PDFDocument = require('pdfkit');
const cv = require('../../../modules/research/services/researchCv.service');

const pages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pub = (i, cites) => ({
  title: `Paper number ${i} on deep learning for something long enough to wrap onto a second line of the CV`,
  authors: [{ name: 'Dr. Prateek Agrawal' }, { name: 'Vishu Madaan' }, { name: 'Charu Gupta' }, { name: 'Another Author' }],
  venue: 'IEEE Transactions on Very Long Journal Names', publicationType: 'research_paper', year: 2020 + (i % 6), doi: `10.1000/x${i}`,
  citationCount: cites, incentive: { amount: 98765, points: 9, status: 'paid' },
});
const view = ({ sections = {}, publications = [pub(1, 5), pub(2, 300), pub(3, 40)], cvDetails = {} } = {}) => ({
  user: { id: 'u1', uid: 'FAC001', name: 'Dr. Prateek Agrawal', email: 'p@uni.example', phone: null, designation: 'Professor', department: 'CSE', school: 'SET', university: 'SGT University' },
  profile: { bio: null, researchInterests: ['IoT', 'Deep learning'], orcid: '0000-0001-6861-0698', scopusAuthorId: '57219768446', metrics: { totalCitations: 345, hIndex: 3 } },
  publications, publicationCount: publications.length, cvDetails,
  sections: { publications: true, metrics: true, researchInterests: true, ...sections },
});

beforeEach(() => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  Object.assign(mockPrisma, {
    iprApplication: { findMany: jest.fn().mockResolvedValue([{ title: 'Smart lock', iprType: 'patent', status: 'published', publicationId: 'PUB-1', publicationDate: new Date('2025-01-01'), grantedAt: null }]) },
    grantApplication: { findMany: jest.fn().mockResolvedValue([{ title: 'DST project', fundingAgencyName: 'DST', sanctionedAmount: 1200000, sanctionDate: new Date('2025-03-01'), applicantUserId: 'u1', investigators: [] }]) },
  });
  mockProfile.getProfileForViewer.mockReset();
});

const printedText = async (fn) => {
  const spy = jest.spyOn(PDFDocument.prototype, 'text');
  try {
    await fn();
    return spy.mock.calls.map((c) => String(c[0])).join(' ');
  } finally {
    spy.mockRestore();
  }
};

test('a one-page PDF named after the researcher, from the viewer-checked profile', async () => {
  mockProfile.getProfileForViewer.mockResolvedValue(view());
  const viewer = { id: 'v1', role: 'faculty', universityId: 'uni' };
  const { filename, buffer } = await cv.build('u1', viewer);
  expect(mockProfile.getProfileForViewer).toHaveBeenCalledWith('u1', viewer);
  expect(filename).toBe('Research-CV-Dr-Prateek-Agrawal.pdf');
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pages(buffer)).toBe(1);
});

test('still one page with 200 publications and every CV section filled', async () => {
  const many = Array.from({ length: 200 }, (_, i) => pub(i, 200 - i));
  const lines = (n, label) => Array.from({ length: n }, (_, i) => `${label} ${i + 1} with a reasonably long description that takes space`);
  mockProfile.getProfileForViewer.mockResolvedValue(view({
    publications: many,
    cvDetails: {
      education: Array.from({ length: 6 }, (_, i) => ({ degree: `Degree ${i}`, institution: 'Some University', year: String(2000 + i), thesis: 'A thesis title that is fairly long as well' })),
      experience: Array.from({ length: 8 }, (_, i) => ({ role: `Role ${i}`, organization: 'Org', period: '2010-2012', details: 'Did many things with many tools over a long time' })),
      presentations: lines(10, 'Talk'), awards: lines(10, 'Award'), teaching: lines(10, 'Course'),
      skills: lines(20, 'Skill'), memberships: lines(8, 'Society'),
      references: [{ name: 'Prof. A', designation: 'Professor', organization: 'Uni', email: 'a@x.org' }],
    },
  }));
  const { buffer } = await cv.build('u1', { id: 'u1' });
  expect(pages(buffer)).toBe(1);
});

test('lists the most cited papers with the totals, not every paper', async () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ ...pub(i, i), title: `Title ${i}` }));
  mockProfile.getProfileForViewer.mockResolvedValue(view({ publications: many }));
  const text = await printedText(() => cv.build('u1', { id: 'u1' }));
  expect(text).toMatch(/40 publications/);
  expect(text).toContain('Title 39.'); // most cited
  expect(text).not.toContain('Title 0.'); // least cited is left out
  const listed = (text.match(/Title \d+\./g) || []).length;
  expect(listed).toBeLessThanOrEqual(6);
});

test('a viewer who may not open the profile gets the same error, and nothing else is queried', async () => {
  mockProfile.getProfileForViewer.mockRejectedValue(Object.assign(new Error('private'), { statusCode: 403, code: 'PROFILE_PRIVATE' }));
  await expect(cv.build('u1', { id: 'x' })).rejects.toMatchObject({ statusCode: 403, code: 'PROFILE_PRIVATE' });
  expect(mockPrisma.iprApplication.findMany).not.toHaveBeenCalled();
});

test('patents and grants are left out when the author hides publications', async () => {
  mockProfile.getProfileForViewer.mockResolvedValue({ ...view({ sections: { publications: false } }), publications: [] });
  await cv.build('u1', { id: 'v1' });
  expect(mockPrisma.iprApplication.findMany).not.toHaveBeenCalled();
  expect(mockPrisma.grantApplication.findMany).not.toHaveBeenCalled();
});

test('references print on the author copy only; others see "available on request"; no incentive amounts', async () => {
  const refs = [{ name: 'Prof. R. Prodan', designation: 'Professor', organization: 'Klagenfurt', email: 'radu@example.org' }];
  mockProfile.getProfileForViewer.mockResolvedValue(view({ cvDetails: { references: refs } }));
  const own = await printedText(() => cv.build('u1', { id: 'u1' }));
  expect(own).toContain('Prof. R. Prodan');
  expect(own).not.toMatch(/98,?765/);

  mockProfile.getProfileForViewer.mockResolvedValue(view({ cvDetails: { references: [], hasReferences: true } }));
  const other = await printedText(() => cv.build('u1', { id: 'v2' }));
  expect(other).not.toContain('Prodan');
  expect(other).toContain('Available on request.');
});

test('text is mapped to the PDF font character set', () => {
  expect(cv._pdfText('“Smart” — AI…  ok')).toBe('"Smart" - AI... ok');
  expect(cv._pdfText('Müller Çelik')).toBe('Müller Çelik');
  expect(cv._pdfText('Dvořák')).toBe('Dvorák');
  expect(cv._pdfText(null)).toBe('');
});

describe('CV details the author enters', () => {
  const profile = jest.requireActual('../../../modules/research/services/authorProfile.service');

  test('are trimmed, capped and stored; a Google Scholar link must be https://scholar.google…', () => {
    const out = profile._validate({
      cvDetails: {
        googleScholarUrl: 'https://scholar.google.com/citations?user=abc',
        education: [{ degree: '  PhD  ', institution: 'LPU', year: '2016', junk: 'x' }, {}],
        skills: [' Python ', '', 'PyTorch'],
        awards: Array.from({ length: 40 }, (_, i) => `Award ${i}`),
      },
    }).cvDetails;
    expect(out.googleScholarUrl).toBe('https://scholar.google.com/citations?user=abc');
    expect(out.education).toEqual([{ degree: 'PhD', institution: 'LPU', year: '2016', thesis: '' }]);
    expect(out.skills).toEqual(['Python', 'PyTorch']);
    expect(out.awards).toHaveLength(15);
    expect(() => profile._validate({ cvDetails: { googleScholarUrl: 'http://evil.example/x' } })).toThrow(/Google Scholar/);
    expect(() => profile._validate({ cvDetails: { skills: 'Python' } })).toThrow(/must be a list/);
  });
});
