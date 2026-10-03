import { isHomeInstitutionAuthor } from '../utils/homeAuthor';

describe('isHomeInstitutionAuthor', () => {
  it('follows the backend classification, not the affiliation text', () => {
    expect(isHomeInstitutionAuthor({ isInternal: true })).toBe(true);
    // an SGT affiliation in another tenant is not "home"
    expect(isHomeInstitutionAuthor({ isInternal: false, affiliation: 'SGT University, Gurugram' } as never)).toBe(false);
    expect(isHomeInstitutionAuthor({ affiliation: 'Rungta College' } as never)).toBe(false);
    expect(isHomeInstitutionAuthor(null)).toBe(false);
  });
});
