/**
 * Institution geocoder
 * ====================
 * Resolves a free-text affiliation (e.g. "Dept. of Physics, IIT Bombay, Mumbai, India")
 * to coordinates using offline gazetteers, most specific first:
 *   institution → Indian city → country (explicit field, then text).
 * Unresolvable strings return null — callers must list them as unmapped rather
 * than invent a position.
 */

const { normalize } = require('./affiliationEngine');

// Well-known institutions. Keys are normalized substrings.
const INSTITUTIONS = [
  ['iit delhi', 28.545, 77.193, 'India'], ['indian institute of technology delhi', 28.545, 77.193, 'India'],
  ['iit bombay', 19.133, 72.916, 'India'], ['indian institute of technology bombay', 19.133, 72.916, 'India'],
  ['iit madras', 12.991, 80.233, 'India'], ['indian institute of technology madras', 12.991, 80.233, 'India'],
  ['iit kanpur', 26.512, 80.232, 'India'], ['indian institute of technology kanpur', 26.512, 80.232, 'India'],
  ['iit kharagpur', 22.314, 87.31, 'India'], ['indian institute of technology kharagpur', 22.314, 87.31, 'India'],
  ['iit roorkee', 29.866, 77.897, 'India'], ['indian institute of technology roorkee', 29.866, 77.897, 'India'],
  ['iit guwahati', 26.187, 91.692, 'India'], ['iit hyderabad', 17.594, 78.123, 'India'],
  ['iit ropar', 30.968, 76.473, 'India'], ['iit (bhu)', 25.262, 82.989, 'India'],
  ['indian institute of science', 13.021, 77.567, 'India'], ['iisc bangalore', 13.021, 77.567, 'India'],
  ['aiims', 28.566, 77.21, 'India'], ['all india institute of medical sciences', 28.566, 77.21, 'India'],
  ['pgimer', 30.764, 76.775, 'India'], ['jawaharlal nehru university', 28.54, 77.166, 'India'],
  ['university of delhi', 28.69, 77.213, 'India'], ['delhi university', 28.69, 77.213, 'India'],
  ['jamia millia islamia', 28.561, 77.276, 'India'], ['jamia hamdard', 28.517, 77.25, 'India'],
  ['amity university', 28.544, 77.333, 'India'], ['banaras hindu university', 25.268, 82.994, 'India'],
  ['aligarh muslim university', 27.915, 78.078, 'India'], ['panjab university', 30.761, 76.768, 'India'],
  ['anna university', 13.01, 80.234, 'India'], ['osmania university', 17.411, 78.527, 'India'],
  ['university of hyderabad', 17.457, 78.326, 'India'], ['savitribai phule pune university', 18.552, 73.825, 'India'],
  ['university of mumbai', 18.932, 72.835, 'India'], ['university of calcutta', 22.578, 88.363, 'India'],
  ['jadavpur university', 22.498, 88.372, 'India'], ['bits pilani', 28.364, 75.587, 'India'],
  ['birla institute of technology and science', 28.364, 75.587, 'India'], ['manipal', 13.351, 74.788, 'India'],
  ['vellore institute of technology', 12.97, 79.159, 'India'], ['vit university', 12.97, 79.159, 'India'],
  ['nit trichy', 10.762, 78.813, 'India'], ['national institute of technology tiruchirappalli', 10.762, 78.813, 'India'],
  ['nit kurukshetra', 29.948, 76.817, 'India'], ['thapar', 30.356, 76.364, 'India'],
  ['chandigarh university', 30.769, 76.575, 'India'], ['lovely professional university', 31.255, 75.705, 'India'],
  ['sharda university', 28.473, 77.482, 'India'], ['galgotias university', 28.367, 77.54, 'India'],
  ['shiv nadar', 28.525, 77.575, 'India'], ['ashoka university', 28.946, 77.102, 'India'],
  ['kurukshetra university', 29.958, 76.817, 'India'], ['maharshi dayanand university', 28.875, 76.62, 'India'],
  ['guru gobind singh indraprastha', 28.594, 77.019, 'India'], ['iiit delhi', 28.545, 77.273, 'India'],
  ['csir', 28.636, 77.172, 'India'], ['icmr', 28.566, 77.208, 'India'], ['isro', 12.957, 77.68, 'India'],
  ['tata institute of fundamental research', 18.907, 72.806, 'India'], ['bhabha atomic research centre', 19.018, 72.92, 'India'],
  ['harvard', 42.374, -71.117, 'United States'], ['massachusetts institute of technology', 42.36, -71.092, 'United States'],
  ['stanford', 37.428, -122.17, 'United States'], ['university of california berkeley', 37.872, -122.259, 'United States'],
  ['ucla', 34.069, -118.445, 'United States'], ['columbia university', 40.808, -73.963, 'United States'],
  ['yale', 41.316, -72.922, 'United States'], ['princeton', 40.343, -74.651, 'United States'],
  ['johns hopkins', 39.329, -76.62, 'United States'], ['carnegie mellon', 40.443, -79.944, 'United States'],
  ['university of michigan', 42.278, -83.738, 'United States'], ['mayo clinic', 44.022, -92.466, 'United States'],
  ['university of oxford', 51.755, -1.254, 'United Kingdom'], ['university of cambridge', 52.205, 0.115, 'United Kingdom'],
  ['imperial college', 51.499, -0.175, 'United Kingdom'], ['university college london', 51.525, -0.134, 'United Kingdom'],
  ["king's college london", 51.511, -0.116, 'United Kingdom'], ['university of edinburgh', 55.944, -3.189, 'United Kingdom'],
  ['university of manchester', 53.467, -2.234, 'United Kingdom'],
  ['eth zurich', 47.377, 8.548, 'Switzerland'], ['epfl', 46.519, 6.566, 'Switzerland'],
  ['technical university of munich', 48.15, 11.568, 'Germany'], ['max planck', 48.137, 11.576, 'Germany'],
  ['sorbonne', 48.853, 2.346, 'France'], ['cnrs', 48.847, 2.268, 'France'],
  ['university of toronto', 43.663, -79.396, 'Canada'], ['mcgill', 45.505, -73.577, 'Canada'],
  ['university of british columbia', 49.261, -123.246, 'Canada'],
  ['university of melbourne', -37.796, 144.963, 'Australia'], ['university of sydney', -33.889, 151.187, 'Australia'],
  ['monash', -37.911, 145.134, 'Australia'], ['australian national university', -35.278, 149.12, 'Australia'],
  ['university of tokyo', 35.713, 139.762, 'Japan'], ['kyoto university', 35.026, 135.781, 'Japan'],
  ['tsinghua', 40.0, 116.326, 'China'], ['peking university', 39.993, 116.306, 'China'],
  ['national university of singapore', 1.297, 103.776, 'Singapore'], ['nanyang technological', 1.348, 103.683, 'Singapore'],
  ['seoul national university', 37.46, 126.953, 'South Korea'], ['kaist', 36.372, 127.362, 'South Korea'],
  ['king saud university', 24.716, 46.619, 'Saudi Arabia'], ['king abdulaziz university', 21.493, 39.25, 'Saudi Arabia'],
  ['universiti malaya', 3.12, 101.654, 'Malaysia'], ['university of malaya', 3.12, 101.654, 'Malaysia'],
  ['universiti teknologi malaysia', 1.559, 103.638, 'Malaysia'], ['universiti sains malaysia', 5.356, 100.302, 'Malaysia'],
  ['university of cape town', -33.957, 18.461, 'South Africa'], ['university of dhaka', 23.734, 90.393, 'Bangladesh'],
  ['tribhuvan university', 27.68, 85.288, 'Nepal'], ['university of colombo', 6.9, 79.861, 'Sri Lanka'],
  ['khalifa university', 24.448, 54.395, 'United Arab Emirates'], ['qatar university', 25.375, 51.49, 'Qatar'],
].map(([key, lat, lng, country]) => ({ key: normalize(key), lat, lng, country }));

const INDIAN_CITIES = {
  'new delhi': [28.614, 77.209], delhi: [28.704, 77.102], gurugram: [28.459, 77.027], gurgaon: [28.459, 77.027],
  noida: [28.535, 77.391], 'greater noida': [28.474, 77.504], faridabad: [28.408, 77.317], ghaziabad: [28.669, 77.454],
  mumbai: [19.076, 72.878], pune: [18.52, 73.856], bengaluru: [12.972, 77.595], bangalore: [12.972, 77.595],
  chennai: [13.083, 80.271], hyderabad: [17.385, 78.487], kolkata: [22.573, 88.364], ahmedabad: [23.023, 72.571],
  jaipur: [26.912, 75.787], lucknow: [26.847, 80.947], chandigarh: [30.733, 76.779], mohali: [30.704, 76.717],
  patiala: [30.34, 76.386], ludhiana: [30.901, 75.857], amritsar: [31.634, 74.872], jalandhar: [31.326, 75.576],
  dehradun: [30.317, 78.032], bhopal: [23.26, 77.413], indore: [22.72, 75.858], nagpur: [21.146, 79.088],
  varanasi: [25.318, 82.974], kanpur: [26.449, 80.332], patna: [25.594, 85.138], bhubaneswar: [20.296, 85.825],
  guwahati: [26.144, 91.736], thiruvananthapuram: [8.524, 76.937], kochi: [9.931, 76.267], coimbatore: [11.017, 76.956],
  mysuru: [12.296, 76.639], visakhapatnam: [17.687, 83.218], srinagar: [34.084, 74.797], jammu: [32.726, 74.857],
  rohtak: [28.895, 76.607], hisar: [29.149, 75.721], sonipat: [28.993, 77.016], meerut: [28.984, 77.706],
  agra: [27.177, 78.008], aligarh: [27.897, 78.088], roorkee: [29.854, 77.888], shimla: [31.105, 77.173],
  ranchi: [23.344, 85.31], raipur: [21.251, 81.63], surat: [21.17, 72.831], vadodara: [22.307, 73.181],
  bhilai: [21.209, 81.428], durg: [21.19, 81.284], sonepat: [28.993, 77.016], phagwara: [31.224, 75.771],
  darbhanga: [26.152, 85.897], mathura: [27.492, 77.673], lakshmangarh: [27.822, 75.025], amravati: [20.937, 77.779],
};

// Major world cities: catches affiliations like 'University of Lagos' that omit the country.
const WORLD_CITIES = {
  'lagos': [6.524, 3.379, 'Nigeria'],
  'abuja': [9.076, 7.398, 'Nigeria'],
  'ibadan': [7.377, 3.947, 'Nigeria'],
  'nairobi': [-1.286, 36.817, 'Kenya'],
  'cairo': [30.044, 31.236, 'Egypt'],
  'johannesburg': [-26.204, 28.047, 'South Africa'],
  'cape town': [-33.925, 18.424, 'South Africa'],
  'pretoria': [-25.747, 28.229, 'South Africa'],
  'lisbon': [38.722, -9.139, 'Portugal'],
  'porto': [41.158, -8.629, 'Portugal'],
  'madrid': [40.417, -3.704, 'Spain'],
  'barcelona': [41.385, 2.173, 'Spain'],
  'paris': [48.857, 2.352, 'France'],
  'lyon': [45.764, 4.836, 'France'],
  'berlin': [52.52, 13.405, 'Germany'],
  'munich': [48.135, 11.582, 'Germany'],
  'hamburg': [53.551, 9.994, 'Germany'],
  'heidelberg': [49.399, 8.672, 'Germany'],
  'aachen': [50.776, 6.084, 'Germany'],
  'rome': [41.903, 12.496, 'Italy'],
  'milan': [45.464, 9.19, 'Italy'],
  'bologna': [44.494, 11.343, 'Italy'],
  'padova': [45.406, 11.877, 'Italy'],
  'amsterdam': [52.368, 4.904, 'Netherlands'],
  'delft': [52.012, 4.357, 'Netherlands'],
  'leiden': [52.16, 4.497, 'Netherlands'],
  'utrecht': [52.091, 5.122, 'Netherlands'],
  'brussels': [50.85, 4.352, 'Belgium'],
  'leuven': [50.88, 4.7, 'Belgium'],
  'ghent': [51.054, 3.717, 'Belgium'],
  'zurich': [47.377, 8.542, 'Switzerland'],
  'geneva': [46.204, 6.143, 'Switzerland'],
  'lausanne': [46.52, 6.633, 'Switzerland'],
  'vienna': [48.208, 16.374, 'Austria'],
  'stockholm': [59.329, 18.069, 'Sweden'],
  'kth': [59.35, 18.07, 'Sweden'],
  'uppsala': [59.859, 17.639, 'Sweden'],
  'lund': [55.705, 13.191, 'Sweden'],
  'gothenburg': [57.709, 11.975, 'Sweden'],
  'oslo': [59.914, 10.752, 'Norway'],
  'copenhagen': [55.676, 12.568, 'Denmark'],
  'aarhus': [56.163, 10.204, 'Denmark'],
  'helsinki': [60.17, 24.938, 'Finland'],
  'dublin': [53.35, -6.26, 'Ireland'],
  'warsaw': [52.23, 21.012, 'Poland'],
  'krakow': [50.065, 19.945, 'Poland'],
  'prague': [50.075, 14.438, 'Czech Republic'],
  'athens': [37.984, 23.728, 'Greece'],
  'istanbul': [41.008, 28.978, 'Turkey'],
  'ankara': [39.934, 32.86, 'Turkey'],
  'moscow': [55.756, 37.617, 'Russia'],
  'london': [51.507, -0.128, 'United Kingdom'],
  'birmingham': [52.486, -1.89, 'United Kingdom'],
  'glasgow': [55.864, -4.252, 'United Kingdom'],
  'leeds': [53.801, -1.549, 'United Kingdom'],
  'bristol': [51.455, -2.588, 'United Kingdom'],
  'sheffield': [53.383, -1.465, 'United Kingdom'],
  'nottingham': [52.954, -1.158, 'United Kingdom'],
  'new york': [40.713, -74.006, 'United States'],
  'boston': [42.36, -71.059, 'United States'],
  'chicago': [41.878, -87.63, 'United States'],
  'los angeles': [34.052, -118.244, 'United States'],
  'san francisco': [37.775, -122.419, 'United States'],
  'seattle': [47.606, -122.332, 'United States'],
  'houston': [29.76, -95.37, 'United States'],
  'atlanta': [33.749, -84.388, 'United States'],
  'philadelphia': [39.953, -75.165, 'United States'],
  'pittsburgh': [40.441, -79.996, 'United States'],
  'baltimore': [39.29, -76.612, 'United States'],
  'toronto': [43.653, -79.383, 'Canada'],
  'montreal': [45.502, -73.567, 'Canada'],
  'vancouver': [49.283, -123.121, 'Canada'],
  'ottawa': [45.421, -75.697, 'Canada'],
  'calgary': [51.045, -114.072, 'Canada'],
  'sydney': [-33.869, 151.209, 'Australia'],
  'melbourne': [-37.814, 144.963, 'Australia'],
  'brisbane': [-27.47, 153.026, 'Australia'],
  'perth': [-31.95, 115.86, 'Australia'],
  'adelaide': [-34.929, 138.601, 'Australia'],
  'canberra': [-35.281, 149.13, 'Australia'],
  'auckland': [-36.849, 174.763, 'New Zealand'],
  'tokyo': [35.676, 139.65, 'Japan'],
  'osaka': [34.694, 135.502, 'Japan'],
  'kyoto': [35.012, 135.768, 'Japan'],
  'beijing': [39.904, 116.407, 'China'],
  'shanghai': [31.23, 121.474, 'China'],
  'wuhan': [30.593, 114.305, 'China'],
  'nanjing': [32.06, 118.797, 'China'],
  'guangzhou': [23.129, 113.264, 'China'],
  'shenzhen': [22.543, 114.058, 'China'],
  'seoul': [37.566, 126.978, 'South Korea'],
  'daejeon': [36.351, 127.385, 'South Korea'],
  'taipei': [25.033, 121.565, 'Taiwan'],
  'kuala lumpur': [3.139, 101.687, 'Malaysia'],
  'nilai': [2.814, 101.797, 'Malaysia'],
  'klagenfurt': [46.617, 14.264, 'Austria'],
  'penang': [5.414, 100.329, 'Malaysia'],
  'bangkok': [13.756, 100.502, 'Thailand'],
  'hanoi': [21.028, 105.854, 'Vietnam'],
  'ho chi minh': [10.823, 106.63, 'Vietnam'],
  'jakarta': [-6.208, 106.846, 'Indonesia'],
  'manila': [14.6, 120.984, 'Philippines'],
  'dhaka': [23.81, 90.413, 'Bangladesh'],
  'kathmandu': [27.717, 85.324, 'Nepal'],
  'colombo': [6.927, 79.861, 'Sri Lanka'],
  'lahore': [31.52, 74.359, 'Pakistan'],
  'karachi': [24.861, 67.01, 'Pakistan'],
  'islamabad': [33.684, 73.048, 'Pakistan'],
  'tehran': [35.689, 51.389, 'Iran'],
  'riyadh': [24.713, 46.675, 'Saudi Arabia'],
  'jeddah': [21.485, 39.193, 'Saudi Arabia'],
  'dubai': [25.205, 55.271, 'United Arab Emirates'],
  'abu dhabi': [24.454, 54.377, 'United Arab Emirates'],
  'doha': [25.286, 51.534, 'Qatar'],
  'muscat': [23.588, 58.383, 'Oman'],
  'amman': [31.954, 35.911, 'Jordan'],
  'tel aviv': [32.085, 34.782, 'Israel'],
  'sao paulo': [-23.551, -46.633, 'Brazil'],
  'rio de janeiro': [-22.907, -43.173, 'Brazil'],
  'buenos aires': [-34.604, -58.382, 'Argentina'],
  'santiago': [-33.449, -70.669, 'Chile'],
  'mexico city': [19.433, -99.133, 'Mexico'],
  'bogota': [4.711, -74.072, 'Colombia'],
  'lima': [-12.046, -77.043, 'Peru'],
};

const COUNTRIES = {
  india: [22.0, 79.0], 'united states': [39.8, -98.6], usa: [39.8, -98.6], 'u.s.a': [39.8, -98.6],
  'united kingdom': [54.0, -2.5], uk: [54.0, -2.5], england: [52.4, -1.5], scotland: [56.8, -4.2],
  canada: [56.1, -106.3], australia: [-25.3, 133.8], 'new zealand': [-41.0, 174.0], germany: [51.2, 10.4],
  france: [46.2, 2.2], italy: [42.8, 12.6], spain: [40.4, -3.7], portugal: [39.6, -8.0], netherlands: [52.1, 5.3],
  belgium: [50.5, 4.5], switzerland: [46.8, 8.2], austria: [47.5, 14.6], sweden: [62.0, 15.0], norway: [61.0, 9.0],
  denmark: [56.0, 10.0], finland: [64.0, 26.0], ireland: [53.4, -8.2], poland: [52.0, 19.1], 'czech republic': [49.8, 15.5],
  greece: [39.1, 22.9], turkey: [39.0, 35.2], russia: [61.5, 105.3], ukraine: [48.4, 31.2], romania: [45.9, 24.97],
  hungary: [47.2, 19.5], china: [35.9, 104.2], japan: [36.2, 138.3], 'south korea': [36.5, 127.9], korea: [36.5, 127.9],
  taiwan: [23.7, 121.0], 'hong kong': [22.32, 114.17], singapore: [1.35, 103.82], malaysia: [4.2, 102.0],
  thailand: [15.9, 101.0], vietnam: [14.1, 108.3], 'viet nam': [14.1, 108.3], indonesia: [-2.5, 118.0], philippines: [12.9, 121.8],
  bangladesh: [23.7, 90.4], nepal: [28.4, 84.1], 'sri lanka': [7.9, 80.8], pakistan: [30.4, 69.3], bhutan: [27.5, 90.4],
  afghanistan: [33.9, 67.7], iran: [32.4, 53.7], iraq: [33.2, 43.7], 'saudi arabia': [23.9, 45.1],
  'united arab emirates': [23.4, 53.8], uae: [23.4, 53.8], qatar: [25.35, 51.18], oman: [21.5, 55.9], kuwait: [29.3, 47.5],
  bahrain: [26.07, 50.55], jordan: [30.6, 36.2], israel: [31.0, 34.9], lebanon: [33.85, 35.86], egypt: [26.8, 30.8],
  morocco: [31.8, -7.1], algeria: [28.0, 1.7], tunisia: [33.9, 9.5], nigeria: [9.1, 8.7], ghana: [7.9, -1.0],
  kenya: [-0.02, 37.9], ethiopia: [9.1, 40.5], tanzania: [-6.4, 34.9], uganda: [1.4, 32.3], 'south africa': [-30.6, 22.9],
  brazil: [-14.2, -51.9], argentina: [-38.4, -63.6], chile: [-35.7, -71.5], mexico: [23.6, -102.6], colombia: [4.6, -74.3],
  peru: [-9.2, -75.0], kazakhstan: [48.0, 66.9], uzbekistan: [41.4, 64.6], mauritius: [-20.3, 57.6], maldives: [3.2, 73.2],
};

// Longest keys first so "south korea" wins over "korea", "new delhi" over "delhi".
const COUNTRY_KEYS = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);
const CITY_KEYS = Object.keys(INDIAN_CITIES).sort((a, b) => b.length - a.length);
const WORLD_CITY_KEYS = Object.keys(WORLD_CITIES).sort((a, b) => b.length - a.length);

const DISPLAY_COUNTRY = {
  usa: 'United States', 'u.s.a': 'United States', uk: 'United Kingdom', england: 'United Kingdom',
  scotland: 'United Kingdom', korea: 'South Korea', uae: 'United Arab Emirates', 'viet nam': 'Vietnam',
};

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ISO 3166-1 alpha-2 codes (OpenAlex and ROR report countries this way) → display names.
const ISO2_COUNTRY = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand',
  DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium',
  CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', IE: 'Ireland',
  PL: 'Poland', CZ: 'Czech Republic', GR: 'Greece', TR: 'Turkey', RU: 'Russia', UA: 'Ukraine', RO: 'Romania',
  HU: 'Hungary', CN: 'China', JP: 'Japan', KR: 'South Korea', TW: 'Taiwan', HK: 'Hong Kong', SG: 'Singapore',
  MY: 'Malaysia', TH: 'Thailand', VN: 'Vietnam', ID: 'Indonesia', PH: 'Philippines', BD: 'Bangladesh', NP: 'Nepal',
  LK: 'Sri Lanka', PK: 'Pakistan', BT: 'Bhutan', AF: 'Afghanistan', IR: 'Iran', IQ: 'Iraq', SA: 'Saudi Arabia',
  AE: 'United Arab Emirates', QA: 'Qatar', OM: 'Oman', KW: 'Kuwait', BH: 'Bahrain', JO: 'Jordan', IL: 'Israel',
  LB: 'Lebanon', EG: 'Egypt', MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya',
  ET: 'Ethiopia', TZ: 'Tanzania', UG: 'Uganda', ZA: 'South Africa', BR: 'Brazil', AR: 'Argentina', CL: 'Chile',
  MX: 'Mexico', CO: 'Colombia', PE: 'Peru', KZ: 'Kazakhstan', UZ: 'Uzbekistan', MU: 'Mauritius', MV: 'Maldives',
};

function canonicalCountry(raw) {
  if (!raw) return null;
  const code = String(raw).trim();
  if (/^[A-Za-z]{2}$/.test(code) && ISO2_COUNTRY[code.toUpperCase()]) return ISO2_COUNTRY[code.toUpperCase()];
  const n = normalize(raw);
  const key = COUNTRY_KEYS.find((k) => n === k || n.includes(k));
  if (!key) return null;
  return DISPLAY_COUNTRY[key] || titleCase(key);
}

function containsWord(haystack, needle) {
  return new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(haystack);
}

/**
 * @param {string} affiliation free text
 * @param {string|null} countryHint explicit country (e.g. from Scopus)
 * @returns {{ lat: number, lng: number, precision: 'institution'|'city'|'country', country: string|null } | null}
 */
function locateAffiliation(affiliation, countryHint = null) {
  const text = normalize(affiliation || '');
  const hinted = canonicalCountry(countryHint);

  if (text) {
    const inst = INSTITUTIONS.find((i) => containsWord(text, i.key));
    if (inst && (!hinted || hinted === inst.country)) {
      return { lat: inst.lat, lng: inst.lng, precision: 'institution', country: inst.country };
    }
  }

  const textCountryKey = text ? COUNTRY_KEYS.find((k) => containsWord(text, k)) : null;
  const country = hinted || (textCountryKey ? DISPLAY_COUNTRY[textCountryKey] || titleCase(textCountryKey) : null);

  if (text && (!country || country === 'India')) {
    const city = CITY_KEYS.find((c) => containsWord(text, c));
    if (city) {
      const [lat, lng] = INDIAN_CITIES[city];
      return { lat, lng, precision: 'city', country: 'India' };
    }
  }

  if (text) {
    const city = WORLD_CITY_KEYS.find((c) => containsWord(text, c));
    if (city) {
      const [lat, lng, cityCountry] = WORLD_CITIES[city];
      if (!country || country === cityCountry) return { lat, lng, precision: 'city', country: cityCountry };
    }
  }

  if (country) {
    const key = COUNTRY_KEYS.find((k) => (DISPLAY_COUNTRY[k] || titleCase(k)) === country);
    const [lat, lng] = COUNTRIES[key];
    return { lat, lng, precision: 'country', country };
  }

  return null;
}

/**
 * Pull the institution out of a long affiliation string:
 * "Dept. of Physics, University of X, City, Country" → "University of X".
 */
const INSTITUTION_WORDS = /\b(universit|institut|college|iit|iiit|nit|aiims|hospital|centre|center|laborator|academy|school of|council|foundation|polytechnic|research)/i;

function institutionName(affiliation) {
  const parts = String(affiliation || '').split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  const strong = parts.find((p) => /\b(universit|iit|iiit|nit|aiims|polytechnic)/i.test(p));
  if (strong) return strong;
  const any = parts.find((p) => INSTITUTION_WORDS.test(p) && !/^(dep(t|artment)|division|faculty)\b/i.test(p));
  return any || parts[0];
}

module.exports = { locateAffiliation, institutionName, canonicalCountry };
