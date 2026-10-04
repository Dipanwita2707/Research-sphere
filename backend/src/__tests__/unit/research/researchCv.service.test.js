/**
 * Unit tests: research CV (PDF).
 *   - built from the visibility-checked profile view, so a viewer who may not open the profile gets the same error
 *   - patents and grants are added only when publications are visible
 *   - never prints incentive amounts; text is safe for the built-in PDF fonts
 * Prisma and the profile service are mocked.
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
const mockProfile = { getProfileForViewer: jest.fn() };
jest.mock('../../../modules/research/services/authorProfile.service', () => mockProfile);

const cv = require('../../../modules/research/services/researchCv.service');

const view = (sections = {}) => ({
  user: { id: 'u1', uid: 'FAC001', name: 'Dr. Prateek Agrawal', email: 'p@uni.example', phone: null, designation: 'Professor', department: 'CSE', school: 'SET', university: 'SGT University' },
  profile: { bio: 'Works on IoT “security” — and edge AI…', researchInterests: ['IoT'], orcid: '0000-0001-6861-0698', scopusAuthorId: '57219768446', webOfScienceId: null, metrics: { totalCitations: 40, hIndex: 4, i10Index: 2 } },
  publications: [
    { title: 'Edge AI for IoT', authors: [{ name: 'Prateek Agrawal' }, { name: 'Vishu Madaan' }], venue: 'IEEE Access', publicationType: 'research_paper', year: 2024, doi: '10.1109/x', citationCount: 5, incentive: { amount: 98765, points: 9, status: 'paid' } },
  ],
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

test('produces a PDF named after the researcher, using the viewer-checked profile', async () => {
  mockProfile.getProfileForViewer.mockResolvedValue(view());
  const viewer = { id: 'v1', role: 'faculty', universityId: 'uni' };
  const { filename, buffer } = await cv.build('u1', viewer);
  expect(mockProfile.getProfileForViewer).toHaveBeenCalledWith('u1', viewer);
  expect(filename).toBe('Research-CV-Dr-Prateek-Agrawal.pdf');
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  expect(mockPrisma.iprApplication.findMany).toHaveBeenCalled();
  expect(mockPrisma.grantApplication.findMany.mock.calls[0][0].where).toMatchObject({ status: { in: ['approved', 'completed'] } });
});

test('a viewer who may not open the profile gets the same error, and nothing else is queried', async () => {
  mockProfile.getProfileForViewer.mockRejectedValue(Object.assign(new Error('private'), { statusCode: 403, code: 'PROFILE_PRIVATE' }));
  await expect(cv.build('u1', { id: 'x' })).rejects.toMatchObject({ statusCode: 403, code: 'PROFILE_PRIVATE' });
  expect(mockPrisma.iprApplication.findMany).not.toHaveBeenCalled();
});

test('patents and grants are left out when the author hides publications', async () => {
  mockProfile.getProfileForViewer.mockResolvedValue({ ...view({ publications: false }), publications: [] });
  await cv.build('u1', { id: 'v1' });
  expect(mockPrisma.iprApplication.findMany).not.toHaveBeenCalled();
  expect(mockPrisma.grantApplication.findMany).not.toHaveBeenCalled();
});

test('incentive amounts are never written into the CV', async () => {
  mockProfile.getProfileForViewer.mockResolvedValue(view());
  const spy = jest.spyOn(require('pdfkit').prototype, 'text');
  await cv.build('u1', { id: 'u1' });
  const printed = spy.mock.calls.map((c) => String(c[0])).join(' ');
  spy.mockRestore();
  expect(printed).toContain('Edge AI for IoT');
  expect(printed).not.toMatch(/98,?765/);
});

test('text is mapped to the PDF font character set', () => {
  expect(cv._pdfText('“Smart” — AI…  ok')).toBe('"Smart" - AI... ok');
  expect(cv._pdfText('Müller Çelik')).toBe('Müller Çelik'); // Latin-1 kept
  expect(cv._pdfText('Dvořák')).toBe('Dvorák'); // ř is outside Latin-1 (accent dropped), á is kept
  expect(cv._pdfText(null)).toBe('');
});
