/**
 * Query expansion for retrieval — Research Intelligence
 *
 * Turns a free-text research query (and optional taxonomy filters) into weighted keyword sets:
 *
 *   direct    keywords the query names, by canonical name or alias ("ML" → Machine Learning)  w = 0.35
 *   taxonomy  every keyword mapped under a domain / category / specialization the query names    w = 0.20
 *   related   keywords that co-occur with the direct ones in the knowledge graph (≥ 2 papers)     w = 0.08
 *
 * Search ranks papers by full-text relevance plus these weights, and reports which route
 * matched each paper so answers can say *why* a paper was included.
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { Prisma, likeEscape } = require('./sql');
const { ALIAS_MAP } = require('./keywordVocabulary');

const WEIGHTS = { direct: 0.35, taxonomy: 0.2, related: 0.08 };
const MAX_TAXONOMY_KEYWORDS = 400;

/** Lower-case word n-grams (1–4) of the query, for exact alias matching. */
function queryGrams(query) {
  const words = String(query || '').toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 40);
  const grams = new Set();
  for (let n = 1; n <= 4; n++) for (let i = 0; i + n <= words.length; i++) grams.add(words.slice(i, i + n).join(' '));
  return [...grams];
}

/** Canonical names for abbreviations used in the query ("ml", "cnn", "iot"). */
function aliasExpansions(query) {
  const out = new Set();
  for (const g of queryGrams(query)) if (ALIAS_MAP[g]) out.add(ALIAS_MAP[g]);
  return [...out];
}

/** Taxonomy nodes named in the text (name or alias contained in it, or it contained in the name). */
async function matchTaxonomyNodes(tenantId, text) {
  const q = String(text || '').trim();
  if (q.length < 3) return { domains: [], categories: [], specializations: [] };
  const like = `%${likeEscape(q)}%`;
  const grams = queryGrams(q);
  const node = (table) => Prisma.sql`
    SELECT id::text, name FROM ${Prisma.raw(table)} n
     WHERE n.university_id = ${tenantId}::uuid AND n.status = 'active'
       AND ((length(n.name) >= 4 AND ${q} ILIKE '%' || n.name || '%')
            OR n.name ILIKE ${like}
            OR EXISTS (SELECT 1 FROM unnest(n.aliases) a WHERE lower(a) = ANY(${grams}::text[])))
     LIMIT 5`;
  const [domains, categories, specializations] = await Promise.all([
    prisma.$queryRaw(node('rip_taxonomy_domain')),
    prisma.$queryRaw(node('rip_taxonomy_category')),
    prisma.$queryRaw(node('rip_taxonomy_specialization')),
  ]);
  return { domains, categories, specializations };
}

/** Approved keyword ids under the given taxonomy nodes (most published first). */
async function keywordsUnder(tenantId, { domainIds = [], categoryIds = [], specializationIds = [] }) {
  if (!domainIds.length && !categoryIds.length && !specializationIds.length) return [];
  return prisma.$queryRaw`
    SELECT DISTINCT ON (k.id) k.id::text AS id, k.canonical_name AS name, k.publication_count
      FROM rip_keyword_taxonomy_mapping m
      JOIN rip_research_keyword k ON k.id = m.keyword_id
      JOIN rip_taxonomy_category c ON c.id = m.category_id
     WHERE m.university_id = ${tenantId}::uuid AND m.status = 'approved' AND k.publication_count > 0
       AND (m.specialization_id = ANY(${specializationIds}::uuid[])
            OR m.category_id = ANY(${categoryIds}::uuid[])
            OR c.domain_id = ANY(${domainIds}::uuid[]))
     ORDER BY k.id, k.publication_count DESC`.then((rows) =>
    rows.sort((a, b) => b.publication_count - a.publication_count).slice(0, MAX_TAXONOMY_KEYWORDS)
  );
}

/**
 * @param {string} tenantId
 * @param {string} query
 * @param {object} [opts]
 * @param {boolean} [opts.useTaxonomy=true] expand through taxonomy nodes named in the query
 * @param {boolean} [opts.useGraph=true]    expand through co-occurring keywords
 * @returns {Promise<{ ftsQuery: string, keywords: {id:string,w:number,via:string}[], explain: object }>}
 */
async function expandQuery(tenantId, query, { useTaxonomy = true, useGraph = true } = {}) {
  const q = String(query || '').trim().slice(0, 300);
  const explain = { aliases: [], direct: [], taxonomy: { domains: [], categories: [], specializations: [] }, related: [] };
  if (!q) return { ftsQuery: '', keywords: [], explain };

  const aliases = aliasExpansions(q);
  explain.aliases = aliases;
  const grams = queryGrams(q);
  const like = `%${likeEscape(q)}%`;
  const aliasNames = aliases.map((a) => a.toLowerCase());

  const direct = await prisma.$queryRaw`
    SELECT k.id::text AS id, k.canonical_name AS name
      FROM rip_research_keyword k
     WHERE k.university_id = ${tenantId}::uuid AND k.publication_count > 0
       AND ((length(k.canonical_name) >= 4 AND ${q} ILIKE '%' || k.canonical_name || '%')
            OR k.canonical_name ILIKE ${like}
            OR lower(k.canonical_name) = ANY(${aliasNames}::text[])
            OR EXISTS (SELECT 1 FROM unnest(k.aliases) a WHERE lower(a) = ANY(${grams}::text[])))
     ORDER BY k.publication_count DESC
     LIMIT 30`;
  explain.direct = direct.map((k) => k.name);

  const weights = new Map();
  const put = (id, w, via) => {
    const cur = weights.get(id);
    if (!cur || w > cur.w) weights.set(id, { id, w, via });
  };
  direct.forEach((k) => put(k.id, WEIGHTS.direct, 'keyword'));

  if (useTaxonomy) {
    const nodes = await matchTaxonomyNodes(tenantId, q);
    explain.taxonomy = { domains: nodes.domains.map((n) => n.name), categories: nodes.categories.map((n) => n.name), specializations: nodes.specializations.map((n) => n.name) };
    const under = await keywordsUnder(tenantId, {
      domainIds: nodes.domains.map((n) => n.id),
      categoryIds: nodes.categories.map((n) => n.id),
      specializationIds: nodes.specializations.map((n) => n.id),
    });
    under.forEach((k) => put(k.id, WEIGHTS.taxonomy, 'taxonomy'));
  }

  if (useGraph && direct.length) {
    const related = await prisma.$queryRaw`
      SELECT c2.keyword_id::text AS id, k.canonical_name AS name, COUNT(*)::int AS shared
        FROM rip_contribution_keyword c1
        JOIN rip_contribution_keyword c2 ON c2.contribution_id = c1.contribution_id AND c2.keyword_id <> c1.keyword_id
        JOIN rip_research_keyword k ON k.id = c2.keyword_id
       WHERE c1.university_id = ${tenantId}::uuid AND c1.keyword_id = ANY(${direct.map((k) => k.id)}::uuid[])
       GROUP BY c2.keyword_id, k.canonical_name
      HAVING COUNT(*) >= 2
       ORDER BY shared DESC
       LIMIT 10`;
    const fresh = related.filter((r) => !weights.has(r.id));
    fresh.forEach((r) => put(r.id, WEIGHTS.related, 'related'));
    explain.related = fresh.map((r) => r.name);
  }

  // websearch syntax: original query OR quoted alias expansions.
  const ftsQuery = [q, ...aliases.map((a) => `"${a}"`)].join(' OR ');
  return { ftsQuery, keywords: [...weights.values()], explain };
}

/** Resolve taxonomy filter names ("Oral Pathology", "Computer Vision") to node ids. */
async function resolveTaxonomyFilter(tenantId, name) {
  const nodes = await matchTaxonomyNodes(tenantId, name);
  return {
    domainIds: nodes.domains.map((n) => n.id),
    categoryIds: nodes.categories.map((n) => n.id),
    specializationIds: nodes.specializations.map((n) => n.id),
    names: [...nodes.specializations, ...nodes.categories, ...nodes.domains].map((n) => n.name),
  };
}

module.exports = { expandQuery, resolveTaxonomyFilter, matchTaxonomyNodes, keywordsUnder, aliasExpansions, queryGrams, WEIGHTS };
