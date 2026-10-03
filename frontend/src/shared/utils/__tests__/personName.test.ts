import { countDistinctCoAuthors, personNameKey } from '../personName';

describe('personNameKey', () => {
  it('maps the usual name forms of one person to one key', () => {
    expect(personNameKey('Vishu Madaan')).toBe('madaan|v');
    expect(personNameKey('Madaan, V.')).toBe('madaan|v');
    expect(personNameKey('Dr. Vishu Madaan')).toBe('madaan|v');
    expect(personNameKey('')).toBeNull();
  });
});

describe('countDistinctCoAuthors', () => {
  it('counts each co-author once and never the user', () => {
    const papers = [
      { authors: [{ name: 'Prateek Agrawal', userId: 'me' }, { name: 'Vishu Madaan' }, { name: 'Wou Onn Choo' }] },
      { authors: [{ name: 'Agrawal, P.' }, { name: 'Madaan, V.' }, { name: 'Choo, W.O.' }, { name: 'Sharma, C.' }] },
    ];
    expect(countDistinctCoAuthors(papers, { id: 'me', name: 'Prateek Agrawal' })).toBe(3);
  });
});
