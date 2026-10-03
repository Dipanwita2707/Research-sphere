jest.mock('../../../shared/config/database', () => ({}));

const svc = require('../../../modules/research/services/authorProfile.service');

const UNI = 'uni-1';
const author = { id: 'author', universityId: UNI };
const colleague = { id: 'colleague', role: 'faculty', universityId: UNI };
const outsider = { id: 'outsider', role: 'faculty', universityId: 'uni-2' };
const admin = { id: 'admin', role: 'admin', universityId: UNI };
const settings = (profileVisibility) => ({ profileVisibility });

describe('authorProfile.resolveAccess', () => {
  it('always lets the author and admins see everything', () => {
    for (const level of ['public', 'institution', 'private']) {
      expect(svc.resolveAccess(author, author, settings(level))).toMatchObject({ allowed: true, full: true, isOwner: true });
      expect(svc.resolveAccess(admin, author, settings(level))).toMatchObject({ allowed: true, full: true, privileged: true });
    }
  });

  it('public: everyone, including anonymous visitors, gets the filtered view', () => {
    expect(svc.resolveAccess(null, author, settings('public'))).toMatchObject({ allowed: true, full: false });
    expect(svc.resolveAccess(outsider, author, settings('public'))).toMatchObject({ allowed: true, full: false });
  });

  it('institution: same-university members only', () => {
    expect(svc.resolveAccess(colleague, author, settings('institution'))).toMatchObject({ allowed: true, full: false });
    expect(svc.resolveAccess(outsider, author, settings('institution'))).toMatchObject({ allowed: false });
    expect(svc.resolveAccess(null, author, settings('institution'))).toMatchObject({ allowed: false, reason: 'login_required' });
  });

  it('private: nobody but the author and admins', () => {
    expect(svc.resolveAccess(colleague, author, settings('private'))).toMatchObject({ allowed: false, reason: 'private' });
    expect(svc.resolveAccess(null, author, settings('private'))).toMatchObject({ allowed: false });
  });
});

describe('authorProfile._validate', () => {
  it('rejects unknown visibility levels and non-boolean toggles', () => {
    expect(() => svc._validate({ profileVisibility: 'everyone' })).toThrow(/profileVisibility/);
    expect(() => svc._validate({ showEmail: 'yes' })).toThrow(/showEmail/);
  });

  it('trims, de-duplicates and caps research interests', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Topic ${i}`);
    expect(svc._validate({ researchInterests: [' AI ', 'ai', '', 'x'.repeat(61), 'IoT'] }).researchInterests).toEqual(['AI', 'IoT']);
    expect(svc._validate({ researchInterests: many }).researchInterests).toHaveLength(15);
  });

  it('stores an empty bio as null and caps its length', () => {
    expect(svc._validate({ bio: '   ' }).bio).toBeNull();
    expect(() => svc._validate({ bio: 'x'.repeat(2001) })).toThrow(/Bio/);
  });

  it('only allows the author or an admin to edit', () => {
    expect(() => svc._assertCanEdit('author', colleague)).toThrow(/own profile/);
    expect(() => svc._assertCanEdit('author', author)).not.toThrow();
    expect(() => svc._assertCanEdit('author', admin)).not.toThrow();
  });
});

describe('authorProfile._buildCoAuthors', () => {
  it('counts one co-author once across name forms (Scopus "Madaan, V." vs OpenAlex "Vishu Madaan")', () => {
    const contributions = [
      { id: 'p1', publicationDate: '2026-12-01', authors: [
        { userId: 'author', name: 'Prateek Agrawal' },
        { userId: null, name: 'Vishu Madaan', affiliation: 'Rungta College', isInternal: true },
        { userId: null, name: 'Wou Onn Choo', affiliation: 'INTI International University' },
      ] },
      { id: 'p2', publicationDate: '2026-06-01', authors: [
        { userId: null, name: 'Madaan, V.', affiliation: null },
        { userId: 'author', name: 'Agrawal, P.' },
        { userId: null, name: 'Choo, W.O.', affiliation: null },
        { userId: null, name: 'Sharma, C.', affiliation: null },
      ] },
    ];
    const out = svc._buildCoAuthors('author', 'Prateek Agrawal', contributions);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ name: 'Vishu Madaan', collaborationCount: 2, affiliation: 'Rungta College', isInternal: true });
    expect(out.find((c) => c.name === 'Wou Onn Choo')).toMatchObject({ collaborationCount: 2, sharedPublications: ['p1', 'p2'] });
  });

  it('keeps different people with the same surname apart', () => {
    const out = svc._buildCoAuthors('author', 'X Y', [{ id: 'p', authors: [{ name: 'Anil Kumar' }, { name: 'Sunil Kumar' }] }]);
    expect(out).toHaveLength(2);
  });
});
