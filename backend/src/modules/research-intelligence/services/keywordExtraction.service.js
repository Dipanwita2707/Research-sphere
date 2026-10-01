/**
 * Keyword Extraction — Research Intelligence
 *
 * Builds each tenant's research keyword index from its contributions.
 *
 * Vocabulary-anchored extraction (instead of blind n-grams, which flood the index with
 * fragments like "Deep Neural Network Model For"):
 *   1. Vocabulary = author keywords + OpenAlex concepts across the tenant's corpus
 *      + curated domain phrases + keywords already in the index.
 *   2. Every contribution links its own author keywords and concepts.
 *   3. Titles and abstracts are scanned with greedy longest-match against the vocabulary,
 *      so a paper without author keywords still links to the terms its peers use.
 *   4. Optionally, the AI proposes keywords for papers that are still (nearly) unlabeled.
 *
 * Keywords are de-duplicated by a normalised key (case, punctuation and plural insensitive).
 * All Prisma calls run inside a tenant context; raw SQL filters university_id explicitly.
 */

'use strict';

const { Prisma } = require('@prisma/client');
const prisma = require('../../../shared/config/database');
const { createModuleLogger } = require('../../../shared/utils/logger');
const ai = require('./ai/aiProvider');
const { STOPWORDS, GENERIC_TERMS, ALIAS_MAP, CURATED_PHRASES } = require('./keywordVocabulary');
const { countedWhere, COUNTED_STATUSES_SQL, asObject, toSlug } = require('./researchData');

const log = createModuleLogger('rip:keywords');

const SOURCE_CONFIDENCE = {
  author_keyword: 1.0,
  openalex_concept: 0.85,
  ai_extracted: 0.8,
  title_match: 0.9,
  abstract_match: 0.75,
};

const LOWER_SMALL_WORDS = new Set(['of', 'and', 'in', 'for', 'the', 'on', 'to', 'with', 'a', 'an', 'by', 'via', 'as', 'at']);

// ─── Normalisation ────────────────────────────────────────────────────────────

const singular = (w) => {
  if (w.length <= 4) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(ss|us|is|ics|sis|ous)$/.test(w)) return w;
  return w.endsWith('s') ? w.slice(0, -1) : w;
};

/** Dedup key: lowercase, punctuation-insensitive, last word singularised. */
const keyOf = (term) => {
  const words = String(term).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  words[words.length - 1] = singular(words[words.length - 1]);
  return toSlug(words.join(' '));
};

const isAcronym = (w) => /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(w) && /[A-Z]{2}/.test(w);
const hasInnerCaps = (w) => /[a-z][A-Z]|[A-Z].*[a-z].*[A-Z]/.test(w); // mRNA, SARS-CoV-2, CoV

const titleCase = (phrase) =>
  phrase
    .split(/\s+/)
    .map((w, i) => {
      if (isAcronym(w) || hasInnerCaps(w)) return w;
      const lower = w.toLowerCase();
      if (i > 0 && LOWER_SMALL_WORDS.has(lower)) return lower;
      return lower
        .split('-')
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join('-');
    })
    .join(' ');

/** Clean a raw keyword into a display name, or null when it is not a usable keyword. */
function normalizeTerm(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/[‐-―]/g, '-')
    .replace(/^[\s"'`([{<*#•\-–]+|[\s"'`)\]}>.,;:*]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 120) return null;
  const lower = cleaned.toLowerCase();
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];
  if (/^[\d\s.,%-]+$/.test(cleaned)) return null;

  const words = cleaned.split(' ');
  if (words.length > 7) return null;
  if (words.every((w) => STOPWORDS.has(w.toLowerCase()))) return null;
  if (words.length === 1 && (STOPWORDS.has(lower) || GENERIC_TERMS.has(lower))) return null;
  if (words.length === 1 && lower.length < 3 && !isAcronym(cleaned)) return null;
  return titleCase(cleaned);
}

const splitKeywordField = (raw) =>
  String(raw || '')
    .split(/[|;,\n]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 1 && k.length < 200);

const conceptsOf = (contribution) => {
  const meta = asObject(contribution.importMetadata);
  const list = Array.isArray(meta.concepts) ? meta.concepts : [];
  return list.map((c) => (typeof c === 'string' ? c : c?.display_name)).filter(Boolean);
};

// ─── Vocabulary & text matching ───────────────────────────────────────────────

class Vocabulary {
  constructor() {
    this.byKey = new Map(); // key → display name
    this.acronyms = new Map(); // ACRONYM → display name
  }

  add(name) {
    const display = normalizeTerm(name);
    if (!display) return null;
    const key = keyOf(display);
    if (!key) return null;
    if (!this.byKey.has(key)) this.byKey.set(key, display);
    if (isAcronym(display)) this.acronyms.set(display, display);
    return { key, name: this.byKey.get(key) };
  }

  /** Make an alternative spelling resolve to an existing canonical keyword in text matching. */
  addAlias(alias, canonicalName) {
    const canonical = this.add(canonicalName);
    const display = normalizeTerm(alias);
    if (!canonical || !display) return;
    const key = keyOf(display);
    if (key && !this.byKey.has(key)) this.byKey.set(key, canonical.name);
    if (isAcronym(display) && !this.acronyms.has(display)) this.acronyms.set(display, canonical.name);
  }

  /** Greedy longest-match of vocabulary phrases in free text. Never crosses punctuation. */
  match(text, limit = 25) {
    const found = new Map();
    if (!text) return found;
    const segments = String(text).split(/[.,;:!?()[\]{}"\n]+/);
    for (const seg of segments) {
      const words = seg.split(/\s+/).map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')).filter(Boolean);
      let i = 0;
      while (i < words.length) {
        let matched = 0;
        for (let len = Math.min(6, words.length - i); len >= 1; len--) {
          const gram = words.slice(i, i + len);
          if (len === 1) {
            const tok = gram[0];
            if (!isAcronym(tok)) break;
            const alias = ALIAS_MAP[tok.toLowerCase()];
            const name = alias || this.acronyms.get(tok);
            if (name) {
              found.set(keyOf(name), name);
              matched = 1;
            }
            break;
          }
          if (STOPWORDS.has(gram[0].toLowerCase()) || STOPWORDS.has(gram[len - 1].toLowerCase())) continue;
          const key = keyOf(gram.join(' '));
          if (this.byKey.has(key)) {
            found.set(key, this.byKey.get(key));
            matched = len;
            break;
          }
        }
        if (found.size >= limit) return found;
        i += matched || 1;
      }
    }
    return found;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

const CONTRIBUTION_SELECT = { id: true, title: true, abstract: true, keywords: true, importMetadata: true };

async function loadCorpus() {
  const out = [];
  let cursor;
  for (;;) {
    const page = await prisma.researchContribution.findMany({
      where: countedWhere(),
      select: CONTRIBUTION_SELECT,
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    out.push(...page);
    if (page.length < 500) break;
    cursor = page[page.length - 1].id;
  }
  return out;
}

async function buildVocabulary(corpus) {
  const vocab = new Vocabulary();
  CURATED_PHRASES.forEach((p) => vocab.add(p));
  Object.values(ALIAS_MAP).forEach((p) => vocab.add(p));
  const existing = await prisma.ripResearchKeyword.findMany({ select: { canonicalName: true, aliases: true } });
  existing.forEach((k) => {
    vocab.add(k.canonicalName);
    k.aliases.forEach((a) => vocab.addAlias(a, k.canonicalName));
  });
  for (const c of corpus) {
    splitKeywordField(c.keywords).forEach((k) => vocab.add(k));
    conceptsOf(c).forEach((k) => vocab.add(k));
  }
  return vocab;
}

/** Terms for one contribution: Map key → { name, source, confidence, raw }. Highest-confidence source wins. */
function extractTerms(contribution, vocab) {
  const terms = new Map();
  const put = (name, source, raw) => {
    const display = normalizeTerm(name);
    if (!display) return;
    const key = keyOf(display);
    if (!key) return;
    const confidence = SOURCE_CONFIDENCE[source];
    const cur = terms.get(key);
    if (!cur || confidence > cur.confidence) {
      terms.set(key, { name: vocab.byKey.get(key) || display, source, confidence, raw: String(raw || name).slice(0, 256) });
    }
  };
  splitKeywordField(contribution.keywords).forEach((k) => put(k, 'author_keyword', k));
  conceptsOf(contribution).forEach((k) => put(k, 'openalex_concept', k));
  vocab.match(contribution.title, 15).forEach((name) => put(name, 'title_match'));
  vocab.match(contribution.abstract, 12).forEach((name) => put(name, 'abstract_match'));
  return terms;
}

/** Ask the AI for keywords on papers that have (almost) none. Returns Map contributionId → string[]. */
async function aiKeywordsFor(contributions) {
  const result = new Map();
  const BATCH = 15;
  for (let i = 0; i < contributions.length; i += BATCH) {
    const batch = contributions.slice(i, i + BATCH);
    const list = batch
      .map((c, idx) => `${idx + 1}. ${c.title}${c.abstract ? ` — ${c.abstract.replace(/\s+/g, ' ').slice(0, 500)}` : ''}`)
      .join('\n');
    try {
      const { data } = await ai.completeJson({
        system:
          'You index academic papers. For each numbered paper return 3-6 specific research keywords ' +
          '(topics, methods, materials, diseases or phenomena). Prefer established multi-word terms ' +
          '(e.g. "Molecular Docking", "Federated Learning"). Never return generic words such as ' +
          '"study", "analysis", "approach", "system" or "review". Respond with JSON only: ' +
          '{"papers":[{"n":1,"keywords":["..."]}]}',
        prompt: list,
        maxTokens: 2048,
        cacheContext: 'keyword_extract',
      });
      for (const item of data?.papers || []) {
        const c = batch[Number(item.n) - 1];
        if (c && Array.isArray(item.keywords)) result.set(c.id, item.keywords.slice(0, 6));
      }
    } catch (err) {
      log.warn('AI keyword extraction batch failed', { error: err.message });
      if (err.name === 'AiUnavailableError') break;
    }
  }
  return result;
}

/** Make sure every term exists as a RipResearchKeyword; returns Map key → keywordId. */
async function ensureKeywords(termsByKey) {
  const keys = [...termsByKey.keys()];
  const idByKey = new Map();
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    const existing = await prisma.ripResearchKeyword.findMany({ where: { slug: { in: chunk } }, select: { id: true, slug: true } });
    existing.forEach((k) => idByKey.set(k.slug, k.id));
    const missing = chunk.filter((k) => !idByKey.has(k));
    if (missing.length) {
      await prisma.ripResearchKeyword.createMany({
        data: missing.map((slug) => ({ slug, canonicalName: termsByKey.get(slug).slice(0, 256) })),
        skipDuplicates: true,
      });
      const created = await prisma.ripResearchKeyword.findMany({ where: { slug: { in: missing } }, select: { id: true, slug: true } });
      created.forEach((k) => idByKey.set(k.slug, k.id));
    }
  }
  return idByKey;
}

/** keyOf(canonical name) → abbreviations that expand to it, e.g. machine-learning → ["ML"]. */
const REVERSE_ALIASES = new Map();
for (const [abbr, canonical] of Object.entries(ALIAS_MAP)) {
  const key = keyOf(canonical);
  if (!REVERSE_ALIASES.has(key)) REVERSE_ALIASES.set(key, []);
  if (abbr.toLowerCase() !== canonical.toLowerCase()) REVERSE_ALIASES.get(key).push(abbr.toUpperCase());
}

const MAX_ALIASES = 20;

/** Merge new aliases into keywords (de-duplicated case-insensitively, capped). Returns rows updated. */
async function saveAliases(tenantId, aliasesByKeyword) {
  const rows = [...aliasesByKeyword.entries()].map(([id, set]) => Prisma.sql`(${id}::uuid, ${[...set].slice(0, MAX_ALIASES)}::text[])`);
  let updated = 0;
  for (let i = 0; i < rows.length; i += 500) {
    updated += await prisma.$executeRaw`
      UPDATE rip_research_keyword AS k
         SET aliases = (
               SELECT COALESCE(array_agg(a ORDER BY a), '{}') FROM (
                 SELECT DISTINCT ON (lower(x)) x AS a FROM unnest(k.aliases || v.al) AS x
                  WHERE lower(x) <> lower(k.canonical_name)
                  ORDER BY lower(x), x
                  LIMIT ${MAX_ALIASES}) t)
        FROM (VALUES ${Prisma.join(rows.slice(i, i + 500))}) AS v(id, al)
       WHERE k.id = v.id AND k.university_id = ${tenantId}::uuid`;
  }
  return updated;
}

/**
 * Extract and link keywords for the current tenant.
 * @param {object} opts
 * @param {boolean} [opts.rebuild=false]   drop existing links first (full re-index)
 * @param {boolean} [opts.useAi=true]      use the AI for papers without keyword metadata
 * @param {number}  [opts.maxAiPapers=300]
 * @param {(pct:number)=>void} [opts.onProgress]
 */
async function extractForTenant({ tenantId, rebuild = false, useAi = true, maxAiPapers = 300, onProgress } = {}) {
  const corpus = await loadCorpus();
  onProgress?.(10);
  if (rebuild) await prisma.ripContributionKeyword.deleteMany({});

  const vocab = await buildVocabulary(corpus);
  onProgress?.(20);

  const alreadyLinked = rebuild
    ? new Set()
    : new Set((await prisma.ripContributionKeyword.findMany({ distinct: ['contributionId'], select: { contributionId: true } })).map((r) => r.contributionId));

  const todo = corpus.filter((c) => !alreadyLinked.has(c.id));
  const termsByContribution = new Map();
  for (const c of todo) termsByContribution.set(c.id, extractTerms(c, vocab));
  onProgress?.(40);

  let aiPapers = 0;
  if (useAi && ai.isConfigured()) {
    const sparse = todo.filter((c) => termsByContribution.get(c.id).size < 2).slice(0, maxAiPapers);
    aiPapers = sparse.length;
    if (sparse.length) {
      const aiTerms = await aiKeywordsFor(sparse);
      for (const [id, kws] of aiTerms) {
        const terms = termsByContribution.get(id);
        for (const k of kws) {
          const display = normalizeTerm(k);
          const key = display && keyOf(display);
          if (key && !terms.has(key)) terms.set(key, { name: vocab.byKey.get(key) || display, source: 'ai_extracted', confidence: SOURCE_CONFIDENCE.ai_extracted, raw: String(k).slice(0, 256) });
        }
      }
    }
  }
  onProgress?.(70);

  const namesByKey = new Map();
  for (const terms of termsByContribution.values()) for (const [key, t] of terms) if (!namesByKey.has(key)) namesByKey.set(key, t.name);
  const idByKey = await ensureKeywords(namesByKey);
  onProgress?.(85);

  const links = [];
  for (const [contributionId, terms] of termsByContribution) {
    for (const [key, t] of terms) {
      const keywordId = idByKey.get(key);
      if (keywordId) links.push({ contributionId, keywordId, rawTerm: t.raw, extractionSource: t.source, confidenceScore: t.confidence });
    }
  }
  let linked = 0;
  for (let i = 0; i < links.length; i += 1000) {
    const r = await prisma.ripContributionKeyword.createMany({ data: links.slice(i, i + 1000), skipDuplicates: true });
    linked += r.count;
  }

  // Record spelling variants and abbreviations as aliases, so search can resolve them later.
  const aliasesByKeyword = new Map();
  const addAlias = (keywordId, alias) => {
    if (!keywordId || !alias) return;
    if (!aliasesByKeyword.has(keywordId)) aliasesByKeyword.set(keywordId, new Set());
    aliasesByKeyword.get(keywordId).add(alias);
  };
  for (const terms of termsByContribution.values()) {
    for (const [key, t] of terms) {
      const raw = String(t.raw || '').trim();
      if (raw && raw.length <= 80 && raw.toLowerCase() !== t.name.toLowerCase()) addAlias(idByKey.get(key), raw);
    }
  }
  for (const [key, id] of idByKey) for (const abbr of REVERSE_ALIASES.get(key) || []) addAlias(id, abbr);
  const aliasesAdded = tenantId ? await saveAliases(tenantId, aliasesByKeyword) : 0;
  onProgress?.(100);

  const stats = { contributions: corpus.length, processed: todo.length, vocabulary: vocab.byKey.size, keywords: idByKey.size, linksCreated: linked, aiPapers, aliasesUpdated: aliasesAdded };
  log.info('Keyword extraction complete', stats);
  return stats;
}

/**
 * Recompute per-keyword metrics for a tenant with set-based SQL, then drop keywords
 * that no longer link to any contribution.
 */
async function recomputeKeywordMetrics(tenantId) {
  const statuses = Prisma.raw(COUNTED_STATUSES_SQL);
  const yearly = await prisma.$queryRaw`
    SELECT ck.keyword_id::text AS keyword_id,
           EXTRACT(YEAR FROM COALESCE(rc.publication_date::timestamptz, rc.submitted_at, rc.created_at))::int AS year,
           COUNT(*)::int AS pubs,
           COALESCE(SUM(CASE WHEN (rc.indexing_details->>'citationCount') ~ '^[0-9]+$'
                             THEN (rc.indexing_details->>'citationCount')::int ELSE 0 END), 0)::int AS cites
      FROM rip_contribution_keyword ck
      JOIN research_contribution rc ON rc.id = ck.contribution_id
     WHERE ck.university_id = ${tenantId}::uuid
       AND rc.university_id = ${tenantId}::uuid
       AND rc.status::text IN (${statuses})
     GROUP BY 1, 2`;
  const spread = await prisma.$queryRaw`
    SELECT ck.keyword_id::text AS keyword_id,
           COUNT(DISTINCT rc.applicant_user_id)::int AS researchers,
           COUNT(DISTINCT rc.school_id)::int AS schools,
           COUNT(DISTINCT rc.department_id)::int AS departments
      FROM rip_contribution_keyword ck
      JOIN research_contribution rc ON rc.id = ck.contribution_id
     WHERE ck.university_id = ${tenantId}::uuid
       AND rc.university_id = ${tenantId}::uuid
       AND rc.status::text IN (${statuses})
     GROUP BY 1`;

  const now = new Date().getFullYear();
  const byKeyword = new Map();
  for (const r of yearly) {
    const k = byKeyword.get(r.keyword_id) || { years: {}, pubs: 0, cites: 0 };
    if (r.year) k.years[r.year] = (k.years[r.year] || 0) + r.pubs;
    k.pubs += r.pubs;
    k.cites += r.cites;
    byKeyword.set(r.keyword_id, k);
  }
  const spreadBy = new Map(spread.map((r) => [r.keyword_id, r]));

  const rows = [];
  for (const [id, k] of byKeyword) {
    const y = (yr) => k.years[yr] || 0;
    const recent = y(now) + y(now - 1);
    const previous = y(now - 2) + y(now - 3);
    // Growth over two-year windows; null when there is no baseline to compare against.
    const growth = previous > 0 ? ((recent - previous) / previous) * 100 : recent > 0 ? null : 0;
    // Momentum: recency-weighted volume (half-life of two years).
    const momentum = Object.entries(k.years).reduce((s, [yr, n]) => s + n * 0.5 ** (Math.max(0, now - Number(yr)) / 2), 0);
    const years = Object.keys(k.years).map(Number);
    const s = spreadBy.get(id) || {};
    rows.push(Prisma.sql`(${id}::uuid, ${k.pubs}::int, ${s.researchers || 0}::int, ${k.cites}::int, ${JSON.stringify(k.years)}::jsonb,
      ${growth}::numeric, ${Math.round(momentum * 10000) / 10000}::numeric, ${k.pubs ? k.cites / k.pubs : 0}::numeric,
      ${s.schools || 0}::int, ${s.departments || 0}::int, ${years.length ? Math.min(...years) : null}::int)`);
  }

  for (let i = 0; i < rows.length; i += 400) {
    await prisma.$executeRaw`
      UPDATE rip_research_keyword AS k SET
        publication_count = v.pubs, researcher_count = v.researchers, total_citations = v.cites,
        yearly_volume = v.years, growth_rate = v.growth, momentum = v.momentum, citation_influence = v.influence,
        school_count = v.schools, department_count = v.departments, first_seen_year = v.first_year,
        last_computed_at = now(), updated_at = now()
      FROM (VALUES ${Prisma.join(rows.slice(i, i + 400))})
        AS v(id, pubs, researchers, cites, years, growth, momentum, influence, schools, departments, first_year)
      WHERE k.id = v.id AND k.university_id = ${tenantId}::uuid`;
  }

  const removed = await prisma.$executeRaw`
    DELETE FROM rip_research_keyword k
     WHERE k.university_id = ${tenantId}::uuid
       AND NOT EXISTS (SELECT 1 FROM rip_contribution_keyword ck WHERE ck.keyword_id = k.id)`;

  log.info('Keyword metrics recomputed', { updated: rows.length, removed });
  return { updated: rows.length, removedOrphans: removed };
}

module.exports = { extractForTenant, recomputeKeywordMetrics, normalizeTerm, keyOf, Vocabulary, extractTerms, _internals: { splitKeywordField, saveAliases, REVERSE_ALIASES } };
