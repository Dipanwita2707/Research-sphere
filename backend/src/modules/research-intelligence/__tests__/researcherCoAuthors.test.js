/**
 * A researcher's co-authors without an account here (external partners and unmapped colleagues):
 * grouped across name forms, exposed to the chat through get_researcher_profile.
 */

jest.mock('../../../shared/config/database', () => ({}));

const { groupCoAuthors } = require('../services/analytics.service');
const tools = require('../services/chat/tools');

const rows = [
  { contribution_id: 'p1', name: 'Vishu Madaan', affiliation: 'Rungta College of Engineering and Technology; Rungta College', isInternal: true },
  { contribution_id: 'p2', name: 'Madaan, V.', affiliation: null, isInternal: false },
  { contribution_id: 'p1', name: 'Wou Onn Choo', affiliation: 'INTI International University', isInternal: false },
  { contribution_id: 'p2', name: 'Choo, W.O.', affiliation: null, isInternal: false },
  { contribution_id: 'p1', name: 'Dharmendra Pathak', affiliation: 'SRM University', isInternal: false },
];

describe('groupCoAuthors', () => {
  it('merges "Madaan, V." and "Vishu Madaan" into one person with two shared papers', () => {
    const out = groupCoAuthors(rows);
    expect(out[0]).toEqual({ name: 'Vishu Madaan', affiliation: 'Rungta College of Engineering and Technology; Rungta College', sharedPapers: 2, homeInstitution: true });
    expect(out.find((c) => c.name === 'Wou Onn Choo')).toMatchObject({ sharedPapers: 2, homeInstitution: false });
    expect(out.find((c) => c.name === 'Dharmendra Pathak')).toMatchObject({ sharedPapers: 1 });
    expect(out).toHaveLength(3);
  });

  it('does not merge different people who share a surname', () => {
    const out = groupCoAuthors([
      { contribution_id: 'a', name: 'Anil Kumar', affiliation: null, isInternal: false },
      { contribution_id: 'b', name: 'Sunil Kumar', affiliation: null, isInternal: false },
    ]);
    expect(out).toHaveLength(2);
  });

  it('ignores blank names', () => {
    expect(groupCoAuthors([{ contribution_id: 'a', name: '  ', affiliation: null }])).toEqual([]);
  });
});

describe('get_researcher_profile chat tool', () => {
  it('tells the model it covers all co-authors, so "who does X collaborate with" is answered from it', () => {
    const desc = tools.declarations().find((d) => d.name === 'get_researcher_profile').description;
    expect(desc).toMatch(/co_authors/);
    expect(desc).toMatch(/collaborate/);
    expect(tools.declarations().find((d) => d.name === 'get_collaborations').description).toMatch(/get_researcher_profile/);
  });

});

describe('abstractExcerpt (publication summaries are grounded in the abstract)', () => {
  it('returns short abstracts whole and cuts long ones at a word boundary', () => {
    expect(tools.abstractExcerpt('  A  short\nabstract. ')).toBe('A short abstract.');
    const long = 'word '.repeat(300);
    const out = tools.abstractExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(602);
    expect(out.endsWith(' …')).toBe(true);
    expect(tools.abstractExcerpt(null)).toBeUndefined();
  });
});

describe('abstractBudget', () => {
  it('gives one or two papers their whole abstract and keeps 15 papers within the tool-result cap', () => {
    expect(tools.abstractBudget(2)).toBe(2500);
    expect(tools.abstractBudget(8)).toBe(750);
    expect(tools.abstractBudget(15) * 15).toBeLessThanOrEqual(6000);
    expect(tools.abstractBudget(0)).toBe(2500);
  });
});
