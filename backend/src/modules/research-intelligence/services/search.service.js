/**
 * Search & entity resolution — Research Intelligence
 *
 * Publication search combines:
 *   - PostgreSQL full-text search (websearch syntax, English stemming) over title + keywords +
 *     abstract, with abbreviation aliases OR-ed in ("ML" also searches "Machine Learning");
 *   - keyword-index expansion from retrieval.service: keywords the query names, keywords under
 *     taxonomy nodes it names (domain → category → specialization), and co-occurring keywords
 *     from the knowledge graph — each with its own weight;
 *   - optional hard taxonomy filters (category / specialization / domain).
 * Each result reports how it matched (text, keyword, taxonomy, related).
 * Entity resolvers turn free-text names ("CSE", "Dr. Sharma") into tenant records.
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { Prisma, YEAR, CITES, DOC, countedRc, likeEscape } = require('./sql');
const { RESEARCHER_SELECT, researcherSummary, toSlug } = require('./researchData');
const retrieval = require('./retrieval.service');

const clampLimit = (n, def = 10, max = 25) => Math.max(1, Math.min(Number(n) || def, max));

const QUARTILES = ['Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4'];
const PUB_TYPES = ['research_paper', 'book', 'book_chapter', 'conference_paper', 'grant_proposal'];

/**
 * @param {string} tenantId
 * @param {object} f
 * @param {string} [f.query]
 * @param {number} [f.yearFrom] @param {number} [f.yearTo]
 * @param {string[]} [f.departmentIds] @param {string[]} [f.schoolIds] @param {string[]} [f.authorUserIds]
 * @param {string[]} [f.quartiles] @param {string} [f.publicationType]
 * @param {{domainIds?:string[],categoryIds?:string[],specializationIds?:string[]}} [f.taxonomy] hard filter
 * @param {boolean} [f.expand=true] taxonomy + graph expansion of the query
 * @param {'relevance'|'recent'|'citations'} [f.sort]
 * @param {number} [f.limit]
 * @returns {Promise<{ total: number, results: object[], expansion: object|null }>}
 */
async function searchPublications(tenantId, f = {}) {
  const query = String(f.query || '').trim().slice(0, 300);
  const limit = clampLimit(f.limit);
  const conds = [countedRc(tenantId)];

  if (f.yearFrom) conds.push(Prisma.sql`${YEAR} >= ${Number(f.yearFrom)}`);
  if (f.yearTo) conds.push(Prisma.sql`${YEAR} <= ${Number(f.yearTo)}`);
  if (f.departmentIds?.length) conds.push(Prisma.sql`rc.department_id = ANY(${f.departmentIds}::uuid[])`);
  if (f.schoolIds?.length) conds.push(Prisma.sql`rc.school_id = ANY(${f.schoolIds}::uuid[])`);
  const quartiles = (f.quartiles || []).filter((q) => QUARTILES.includes(q));
  if (quartiles.length) conds.push(Prisma.sql`rc.quartile::text = ANY(${quartiles}::text[])`);
  if (PUB_TYPES.includes(f.publicationType)) conds.push(Prisma.sql`rc.publication_type::text = ${f.publicationType}`);
  if (f.authorUserIds?.length) {
    conds.push(Prisma.sql`(rc.applicant_user_id = ANY(${f.authorUserIds}::uuid[]) OR EXISTS (
      SELECT 1 FROM research_contribution_author a
       WHERE a.research_contribution_id = rc.id AND a.user_id = ANY(${f.authorUserIds}::uuid[])))`);
  }
  const tax = f.taxonomy || {};
  if (tax.domainIds?.length || tax.categoryIds?.length || tax.specializationIds?.length) {
    conds.push(Prisma.sql`EXISTS (
      SELECT 1 FROM rip_contribution_keyword ck
        JOIN rip_keyword_taxonomy_mapping m ON m.keyword_id = ck.keyword_id AND m.status = 'approved'
        JOIN rip_taxonomy_category c ON c.id = m.category_id
       WHERE ck.contribution_id = rc.id
         AND (m.specialization_id = ANY(${tax.specializationIds || []}::uuid[])
              OR m.category_id = ANY(${tax.categoryIds || []}::uuid[])
              OR c.domain_id = ANY(${tax.domainIds || []}::uuid[])))`);
  }

  let expansion = null;
  let withClause = Prisma.empty;
  let from = Prisma.sql`research_contribution rc`;
  let relevance = Prisma.sql`0`;
  let via = Prisma.sql`ARRAY[]::text[]`;
  if (query) {
    expansion = await retrieval.expandQuery(tenantId, query, { useTaxonomy: f.expand !== false, useGraph: f.expand !== false });
    const ids = expansion.keywords.map((k) => k.id);
    const ws = expansion.keywords.map((k) => k.w);
    const vias = expansion.keywords.map((k) => k.via);
    withClause = Prisma.sql`WITH q AS (SELECT websearch_to_tsquery('english', ${expansion.ftsQuery}) AS tsq),
      kw AS (
        SELECT ck.contribution_id, LEAST(SUM(x.w), 1.5) AS score, array_agg(DISTINCT x.via) AS via
          FROM rip_contribution_keyword ck
          JOIN unnest(${ids}::uuid[], ${ws}::float8[], ${vias}::text[]) AS x(id, w, via) ON x.id = ck.keyword_id
         WHERE ck.university_id = ${tenantId}::uuid
         GROUP BY ck.contribution_id)`;
    from = Prisma.sql`research_contribution rc CROSS JOIN q LEFT JOIN kw ON kw.contribution_id = rc.id`;
    conds.push(Prisma.sql`(${DOC} @@ q.tsq OR kw.score IS NOT NULL OR rc.title ILIKE ${`%${likeEscape(query)}%`})`);
    relevance = Prisma.sql`(ts_rank_cd(${DOC}, q.tsq) + COALESCE(kw.score, 0))`;
    via = Prisma.sql`(CASE WHEN ${DOC} @@ q.tsq THEN ARRAY['text'] ELSE ARRAY[]::text[] END) || COALESCE(kw.via, ARRAY[]::text[])`;
  }

  const order =
    f.sort === 'recent'
      ? Prisma.sql`year DESC NULLS LAST, relevance DESC`
      : f.sort === 'citations'
        ? Prisma.sql`citations DESC, relevance DESC`
        : query
          ? Prisma.sql`relevance DESC, citations DESC`
          : Prisma.sql`year DESC NULLS LAST, citations DESC`;

  const rows = await prisma.$queryRaw`
    ${withClause}
    SELECT rc.id::text AS id, rc.title, rc.journal_name AS journal, ${YEAR} AS year, ${CITES} AS citations,
           COALESCE(rc.doi, rc.paper_doi) AS doi, rc.quartile::text AS quartile, rc.publication_type::text AS type,
           ${relevance} AS relevance, ${via} AS matched_via, COUNT(*) OVER()::int AS total
      FROM ${from}
     WHERE ${Prisma.join(conds, ' AND ')}
     ORDER BY ${order}
     LIMIT ${limit}`;

  const explain = expansion?.explain || null;
  if (!rows.length) return { total: 0, results: [], expansion: explain };
  const details = await prisma.researchContribution.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: {
      id: true,
      department: { select: { departmentName: true } },
      school: { select: { facultyName: true } },
      authors: { select: { name: true, userId: true, isInternal: true, affiliation: true }, orderBy: { authorOrder: 'asc' }, take: 8 },
      applicantUser: { select: RESEARCHER_SELECT },
    },
  });
  const byId = new Map(details.map((d) => [d.id, d]));
  return {
    total: rows[0].total,
    expansion: explain,
    results: rows.map((r) => {
      const d = byId.get(r.id) || {};
      const authors = d.authors?.length ? d.authors.map((a) => a.name) : d.applicantUser ? [researcherSummary(d.applicantUser).name] : [];
      return {
        id: r.id,
        title: r.title,
        journal: r.journal,
        year: r.year,
        citations: r.citations,
        doi: r.doi,
        quartile: r.quartile,
        type: r.type,
        department: d.department?.departmentName || null,
        school: d.school?.facultyName || null,
        authors,
        matchedVia: [...new Set(r.matched_via || [])],
        relevance: Math.round(Number(r.relevance) * 1000) / 1000,
      };
    }),
  };
}

// ─── Entity resolution ────────────────────────────────────────────────────────

const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').trim();

/** Departments whose name, short name or code matches the text (e.g. "CSE", "computer science"). */
async function resolveDepartments(text, take = 5) {
  const t = String(text || '').trim();
  if (!t) return [];
  const rows = await prisma.department.findMany({
    where: {
      isActive: true,
      OR: [
        { departmentName: { contains: t, mode: 'insensitive' } },
        { shortName: { equals: t, mode: 'insensitive' } },
        { departmentCode: { equals: t, mode: 'insensitive' } },
      ],
    },
    select: { id: true, departmentName: true, shortName: true, faculty: { select: { id: true, facultyName: true } } },
    take,
  });
  return rows.map((d) => ({ id: d.id, name: d.departmentName, shortName: d.shortName, school: d.faculty?.facultyName, schoolId: d.faculty?.id }));
}

async function resolveSchools(text, take = 5) {
  const t = String(text || '').trim();
  if (!t) return [];
  const rows = await prisma.facultySchoolList.findMany({
    where: {
      OR: [
        { facultyName: { contains: t, mode: 'insensitive' } },
        { shortName: { equals: t, mode: 'insensitive' } },
        { facultyCode: { equals: t, mode: 'insensitive' } },
      ],
    },
    select: { id: true, facultyName: true, shortName: true },
    take,
  });
  return rows.map((s) => ({ id: s.id, name: s.facultyName, shortName: s.shortName }));
}

/** Researchers by (partial) name, ignoring honorifics. Tokens must all match. */
async function resolveResearchers(text, take = 5) {
  const tokens = words(String(text || '').replace(/\b(dr|prof|professor|mr|mrs|ms|er)\b\.?/gi, ' '))
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 4);
  if (!tokens.length) return [];
  const rows = await prisma.employeeDetails.findMany({
    where: {
      userLoginId: { not: null },
      AND: tokens.map((tok) => ({
        OR: [
          { displayName: { contains: tok, mode: 'insensitive' } },
          { firstName: { contains: tok, mode: 'insensitive' } },
          { lastName: { contains: tok, mode: 'insensitive' } },
        ],
      })),
    },
    select: { userLogin: { select: RESEARCHER_SELECT } },
    take,
  });
  return rows.filter((r) => r.userLogin).map((r) => researcherSummary(r.userLogin));
}

/** Taxonomy categories matching a topic by name, alias or slug. */
async function resolveCategories(text, take = 5) {
  const t = String(text || '').trim();
  if (!t) return [];
  return prisma.ripTaxonomyCategory.findMany({
    where: {
      status: 'active',
      OR: [
        { name: { contains: t, mode: 'insensitive' } },
        { aliases: { has: t } },
        { slug: toSlug(t, 128) },
        { domain: { name: { contains: t, mode: 'insensitive' } } },
      ],
    },
    select: { id: true, name: true, domain: { select: { id: true, name: true } } },
    take,
  });
}

/** Indexed keywords matching a topic, most published first. */
async function resolveKeywords(text, take = 10) {
  const t = String(text || '').trim();
  if (!t) return [];
  return prisma.ripResearchKeyword.findMany({
    where: { canonicalName: { contains: t, mode: 'insensitive' }, publicationCount: { gt: 0 } },
    select: { id: true, canonicalName: true, publicationCount: true },
    orderBy: { publicationCount: 'desc' },
    take,
  });
}

module.exports = {
  searchPublications,
  resolveDepartments,
  resolveSchools,
  resolveResearchers,
  resolveCategories,
  resolveKeywords,
  QUARTILES,
  PUB_TYPES,
};
