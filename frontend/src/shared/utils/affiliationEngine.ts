/**
 * Client-side Affiliation Engine (mirrors backend affiliationEngine.js)
 * Used for live Super Admin preview without waiting on the API.
 */

const STOP_WORDS = new Set([
  'of', 'the', 'and', '&', 'at', 'in', 'for', 'a', 'an', 'to',
]);

const QUALIFIER_WORDS = [
  'university', 'institute', 'college', 'school', 'academy',
  'institution', 'polytechnic', 'campus',
];

const ABBREVIATION_MAP: Record<string, string[]> = {
  university: ['univ', 'univ.'],
  technology: ['tech', 'tech.'],
  technological: ['tech', 'tech.'],
  institute: ['inst', 'inst.'],
  institution: ['inst', 'inst.'],
  engineering: ['engg', 'eng', 'engg.', 'eng.'],
  science: ['sci', 'sci.'],
  sciences: ['sci', 'sci.'],
  management: ['mgmt', 'mgmt.'],
  medical: ['med', 'med.'],
  dental: ['dent', 'dent.'],
  agricultural: ['agri', 'agri.'],
  national: ['natl', 'natl.'],
  international: ['intl', 'intl.'],
  academy: ['acad', 'acad.'],
  research: ['res', 'res.']
};

const LEGAL_SUFFIX_PATTERNS = [
  /\(deemed to be university\)/gi,
  /\(deemed university\)/gi,
  /\(a deemed to be university\)/gi,
  /deemed to be university/gi,
  /\(autonomous\)/gi,
  /\(state university\)/gi,
  /\(central university\)/gi,
  /\(private university\)/gi,
];

export function normalize(value?: string | null): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLegalSuffixes(value: string): string {
  let result = String(value || '');
  LEGAL_SUFFIX_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, ' ');
  });
  return result.replace(/\s+/g, ' ').trim();
}

function tokenize(normalized: string): string[] {
  return normalized.split(/[\s,]+/).filter(Boolean);
}

function isQualifierToken(token: string): boolean {
  return QUALIFIER_WORDS.includes(token);
}

function buildAcronyms(tokens: string[]): string[] {
  const significant = tokens.filter((t) => !STOP_WORDS.has(t));
  if (significant.length === 0) return [];

  const acronyms = new Set<string>();
  const fullInitials = significant.map((t) => t[0]).join('');
  if (fullInitials.length >= 2) acronyms.add(fullInitials);

  const coreTokens: string[] = [];
  for (const t of significant) {
    if (isQualifierToken(t) && coreTokens.length > 0) break;
    coreTokens.push(t);
  }
  const coreInitials = coreTokens.map((t) => t[0]).join('');
  if (coreInitials.length >= 2) acronyms.add(coreInitials);

  const leadingShortTokens: string[] = [];
  for (const t of significant) {
    if (t.length <= 5 && !isQualifierToken(t)) {
      leadingShortTokens.push(t);
    } else {
      break;
    }
  }
  if (leadingShortTokens.length > 0) {
    acronyms.add(leadingShortTokens.join(''));
  }

  return Array.from(acronyms).filter((a) => a.length >= 2);
}

function buildWordDropVariants(tokens: string[]): string[] {
  let working = tokens.slice();
  const variants = new Set<string>();

  while (working.length > 1 && STOP_WORDS.has(working[0])) {
    working = working.slice(1);
  }
  if (working.length === 0) return [];

  variants.add(working.join(' '));

  let trimmed = working.slice();
  while (trimmed.length > 1 && isQualifierToken(trimmed[trimmed.length - 1])) {
    trimmed = trimmed.slice(0, -1);
    variants.add(trimmed.join(' '));
  }

  return Array.from(variants);
}

function buildLocationVariants(baseVariants: string[], city?: string | null, state?: string | null): string[] {
  const locations = [city, state].map((v) => normalize(v)).filter(Boolean);
  if (locations.length === 0) return [];

  const variants = new Set<string>();
  baseVariants.forEach((base) => {
    locations.forEach((loc) => {
      variants.add(`${base} ${loc}`);
      variants.add(`${base}, ${loc}`);
    });
  });
  return Array.from(variants);
}

function buildDottedAcronyms(acronyms: string[]): string[] {
  const dotted = new Set<string>();
  acronyms.forEach((acronym) => {
    if (/^[a-z]+$/i.test(acronym) && acronym.length >= 2) {
      const chars = acronym.split('');
      const dottedStr = chars.join('.');
      dotted.add(dottedStr);
      dotted.add(dottedStr + '.');
    }
  });
  return Array.from(dotted);
}

function buildSubphraseVariants(tokens: string[]): string[] {
  const significant = tokens.filter((t) => !STOP_WORDS.has(t) && !isQualifierToken(t));
  if (significant.length < 3) return [];

  const subphrases = new Set<string>();
  for (let len = 3; len <= significant.length; len++) {
    for (let i = 0; i <= significant.length - len; i++) {
      const slice = significant.slice(i, i + len);
      subphrases.add(slice.join(' '));
    }
  }
  return Array.from(subphrases);
}

function buildAbbreviationVariants(baseVariants: string[]): string[] {
  const result = new Set<string>();

  baseVariants.forEach((variant) => {
    const words = variant.split(/\s+/);
    
    const options = words.map((word) => {
      const opts = [word];
      const normalizedWord = word.replace(/[.,]/g, '');
      if (ABBREVIATION_MAP[normalizedWord]) {
        opts.push(...ABBREVIATION_MAP[normalizedWord]);
      }
      return opts;
    });

    function cartesianProduct(index: number, currentPhrase: string[]) {
      if (index === options.length) {
        result.add(currentPhrase.join(' '));
        return;
      }
      for (const opt of options[index]) {
        cartesianProduct(index + 1, [...currentPhrase, opt]);
      }
    }

    cartesianProduct(0, []);
  });

  return Array.from(result);
}

export interface AffiliationGenerateParams {
  name?: string | null;
  code?: string | null;
  legalName?: string | null;
  city?: string | null;
  state?: string | null;
  extraAliases?: string[];
}

export function generateAffiliationVariants({
  name,
  code,
  legalName,
  city,
  state,
  extraAliases = [],
}: AffiliationGenerateParams = {}): string[] {
  const variantSet = new Set<string>();
  const acronyms = new Set<string>();
  const baseVariants = new Set<string>();

  const namesToProcess = [name, legalName].filter(Boolean) as string[];

  namesToProcess.forEach((rawName) => {
    const cleaned = stripLegalSuffixes(rawName);
    const normalized = normalize(cleaned);
    if (!normalized) return;

    const tokens = tokenize(normalized);
    const wordDropVariants = buildWordDropVariants(tokens);
    const subphrases = buildSubphraseVariants(tokens);

    wordDropVariants.forEach((v) => {
      variantSet.add(v);
      baseVariants.add(v);
    });

    subphrases.forEach((v) => {
      variantSet.add(v);
      baseVariants.add(v);
    });

    buildAcronyms(tokens).forEach((a) => {
      variantSet.add(a);
      acronyms.add(a);
    });

    const locations = buildLocationVariants(wordDropVariants, city, state);
    locations.forEach((v) => {
      variantSet.add(v);
      baseVariants.add(v);
    });
  });

  if (code) {
    const normalizedCode = normalize(code);
    if (normalizedCode) {
      variantSet.add(normalizedCode);
      acronyms.add(normalizedCode);
    }
  }

  const abbrVariants = buildAbbreviationVariants(Array.from(baseVariants));
  abbrVariants.forEach((v) => variantSet.add(v));

  const dottedAcronyms = buildDottedAcronyms(Array.from(acronyms));
  dottedAcronyms.forEach((a) => variantSet.add(a));

  (Array.isArray(extraAliases) ? extraAliases : [])
    .map((alias) => normalize(alias))
    .filter(Boolean)
    .forEach((alias) => variantSet.add(alias));

  return Array.from(variantSet).filter((v) => v.length >= 2);
}
