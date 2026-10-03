const { locateAffiliation, institutionName, canonicalCountry } = require('../../../shared/utils/institutionGeo');

describe('institutionGeo', () => {
  describe('locateAffiliation', () => {
    it('places a known institution precisely', () => {
      expect(locateAffiliation('Department of Physics, Indian Institute of Technology Bombay, Mumbai, India')).toMatchObject({
        precision: 'institution',
        country: 'India',
        lat: 19.133,
      });
    });

    it('falls back to an Indian city', () => {
      expect(locateAffiliation('Govt. College, Rohtak, Haryana')).toMatchObject({ precision: 'city', country: 'India' });
    });

    it('falls back to a world city when the country is missing', () => {
      expect(locateAffiliation('University of Lagos')).toMatchObject({ precision: 'city', country: 'Nigeria' });
    });

    it('uses an explicit country hint when nothing more specific matches', () => {
      expect(locateAffiliation('Federal Polytechnic Nekede', 'Nigeria')).toMatchObject({ precision: 'country', country: 'Nigeria' });
    });

    it('does not treat "Indian" as the country India', () => {
      expect(locateAffiliation('Indian Institute of Information Technology')).toBeNull();
    });

    it('prefers the longest country name ("south korea" over "korea")', () => {
      expect(locateAffiliation('Some Lab, South Korea')).toMatchObject({ country: 'South Korea' });
    });

    it('places a tenant in Bhilai (Chhattisgarh) at the city, not the India centroid', () => {
      expect(locateAffiliation('Rungta University, Bhilai, Chhattisgarh', 'India')).toMatchObject({ precision: 'city', country: 'India', lat: 21.209, lng: 81.428 });
      expect(locateAffiliation('Rungta College of Engineering & Technology, Bhilai, India')).toMatchObject({ precision: 'city', lat: 21.209 });
    });

    it('locates partner cities seen on Indian co-authored papers (Nilai, Klagenfurt, Sonepat)', () => {
      expect(locateAffiliation('INTI International University, Nilai, Malaysia')).toMatchObject({ precision: 'city', country: 'Malaysia' });
      expect(locateAffiliation('Universität Klagenfurt, Klagenfurt, Austria')).toMatchObject({ precision: 'city', country: 'Austria' });
      expect(locateAffiliation('SRM University Delhi-NCR, Sonepat, India')).toMatchObject({ precision: 'city', country: 'India' });
    });

    it('returns null rather than inventing a position', () => {
      expect(locateAffiliation('Random Lab')).toBeNull();
      expect(locateAffiliation('')).toBeNull();
    });
  });

  describe('institutionName', () => {
    it('extracts the institution segment from a long affiliation', () => {
      expect(institutionName('Dept. of CSE, Johns Hopkins University, Baltimore, MD, USA')).toBe('Johns Hopkins University');
    });

    it('keeps a single-segment name as is', () => {
      expect(institutionName('CSIR-NPL')).toBe('CSIR-NPL');
    });
  });

  describe('canonicalCountry', () => {
    it('accepts ISO 3166 alpha-2 codes as reported by OpenAlex', () => {
      expect(canonicalCountry('MY')).toBe('Malaysia');
      expect(canonicalCountry('in')).toBe('India');
      expect(canonicalCountry('ZZ')).toBeNull();
      // a co-author whose affiliation text names no place is still placed by the source's country code
      expect(locateAffiliation('INTI International University', 'MY')).toMatchObject({ precision: 'country', country: 'Malaysia' });
      expect(locateAffiliation('SRM University', 'IN')).toMatchObject({ precision: 'country', country: 'India' });
    });

    it('normalises common aliases', () => {
      expect(canonicalCountry('USA')).toBe('United States');
      expect(canonicalCountry('uk')).toBe('United Kingdom');
      expect(canonicalCountry('india')).toBe('India');
      expect(canonicalCountry('Atlantis')).toBeNull();
    });
  });
});
