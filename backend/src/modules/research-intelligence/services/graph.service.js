/**
 * Knowledge graph queries — Research Intelligence
 *
 * The graph is derived live from relational data rather than a denormalised edge table,
 * so it is always consistent and edge weights are real counts:
 *   researcher —co-authored (n shared papers)— researcher
 *   keyword    —co-occurs  (n shared papers)— keyword
 *   researcher —expert in (score)— category —in— domain
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { Prisma, YEAR, CITES, DOC, countedRc, authorshipCte } = require('./sql');
const { RESEARCHER_SELECT, researcherSummary } = require('./researchData');
const expertise = require('./expertise.service');
const retrieval = require('./retrieval.service');

const clamp = (n, def, max) => Math.max(1, Math.min(Number(n) || def, max));

async function describeResearchers(ids, { withUnitIds = false } = {}) {
  if (!ids.length) return new Map();
  const users = await prisma.userLogin.findMany({ where: { id: { in: ids } }, select: RESEARCHER_SELECT });
  return new Map(
    users.map((u) => [
      u.id,
      withUnitIds
        ? {
            ...researcherSummary(u),
            departmentId: u.employeeDetails?.primaryDepartment?.id || null,
            schoolId: u.employeeDetails?.primarySchool?.id || null,
          }
        : researcherSummary(u),
    ])
  );
}

/**
 * Co-authorship network.
 * - With userId: that researcher, their co-authors, and edges among them (ego network).
 * - Otherwise: the most connected researchers (optionally within a department/school).
 * - minJointPapers keeps only links with at least that many shared papers; with a threshold
 *   above 1, researchers left without a qualifying link are dropped (the ego researcher stays).
 *   Node stats (collaborators, strength) always count every link.
 */
async function getCollaborationNetwork(tenantId, { userId, departmentId, schoolId, limit = 60, minJointPapers = 1 } = {}) {
  const max = clamp(limit, 60, 200);
  const minJoint = clamp(minJointPapers, 1, 1000);
  const scope = [];
  if (departmentId) scope.push(Prisma.sql`ed.primary_department_id = ${departmentId}::uuid`);
  if (schoolId) scope.push(Prisma.sql`ed.primary_school_id = ${schoolId}::uuid`);
  const scopeSql = scope.length ? Prisma.sql`AND ${Prisma.join(scope, ' AND ')}` : Prisma.empty;

  const nodes = await prisma.$queryRaw`
    WITH ${authorshipCte(tenantId)},
    pairs AS (
      SELECT a1.user_id AS a, a2.user_id AS b, COUNT(*)::int AS w
        FROM authorship a1 JOIN authorship a2 ON a1.contribution_id = a2.contribution_id AND a1.user_id < a2.user_id
       GROUP BY 1, 2
    ),
    strong AS (SELECT a, b FROM pairs WHERE w >= ${minJoint}),
    degree AS (
      SELECT u AS user_id, SUM(w)::int AS strength, COUNT(*)::int AS collaborators
        FROM (SELECT a AS u, w FROM pairs UNION ALL SELECT b AS u, w FROM pairs) x GROUP BY u
    ),
    pubs AS (SELECT user_id, COUNT(*)::int AS pubs FROM authorship GROUP BY user_id)
    SELECT p.user_id::text AS id, p.pubs, COALESCE(d.strength, 0) AS strength, COALESCE(d.collaborators, 0) AS collaborators
      FROM pubs p
      LEFT JOIN degree d ON d.user_id = p.user_id
      LEFT JOIN employee_details ed ON ed.user_login_id = p.user_id
     WHERE ${userId ? Prisma.sql`(p.user_id = ${userId}::uuid OR p.user_id IN (
              SELECT CASE WHEN a = ${userId}::uuid THEN b ELSE a END FROM strong WHERE a = ${userId}::uuid OR b = ${userId}::uuid))` : Prisma.sql`TRUE`}
       ${minJoint > 1 ? Prisma.sql`AND (EXISTS (SELECT 1 FROM strong s WHERE s.a = p.user_id OR s.b = p.user_id) ${userId ? Prisma.sql`OR p.user_id = ${userId}::uuid` : Prisma.empty})` : Prisma.empty}
       ${scopeSql}
     ORDER BY ${userId ? Prisma.sql`(p.user_id = ${userId}::uuid) DESC,` : Prisma.empty} strength DESC, p.pubs DESC
     LIMIT ${max}`;

  const ids = nodes.map((n) => n.id);
  const edges = ids.length
    ? await prisma.$queryRaw`
        WITH ${authorshipCte(tenantId)}
        SELECT a1.user_id::text AS source, a2.user_id::text AS target, COUNT(*)::int AS weight
          FROM authorship a1 JOIN authorship a2 ON a1.contribution_id = a2.contribution_id AND a1.user_id < a2.user_id
         WHERE a1.user_id = ANY(${ids}::uuid[]) AND a2.user_id = ANY(${ids}::uuid[])
         GROUP BY 1, 2
        HAVING COUNT(*) >= ${minJoint}`
    : [];

  const [people, profiles] = await Promise.all([
    describeResearchers(ids, { withUnitIds: true }),
    prisma.ripResearcherExpertiseProfile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, hIndex: true, totalCitations: true, primaryCategoryId: true },
    }),
  ]);
  const catIds = [...new Set(profiles.map((p) => p.primaryCategoryId).filter(Boolean))];
  const cats = catIds.length
    ? await prisma.ripTaxonomyCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, domain: { select: { name: true, colorHex: true } } } })
    : [];
  const catById = new Map(cats.map((c) => [c.id, c]));
  const profileBy = new Map(profiles.map((p) => [p.userId, p]));

  return {
    focusUserId: userId || null,
    minJointPapers: minJoint,
    nodes: nodes.map((n) => {
      const p = profileBy.get(n.id);
      const cat = p?.primaryCategoryId ? catById.get(p.primaryCategoryId) : null;
      return {
        ...people.get(n.id),
        id: n.id,
        pubs: n.pubs,
        collaborators: n.collaborators,
        strength: n.strength,
        hIndex: p?.hIndex || 0,
        citations: p?.totalCitations || 0,
        primaryTopic: cat?.name || null,
        domain: cat?.domain?.name || null,
        color: cat?.domain?.colorHex || null,
      };
    }),
    edges,
  };
}

/** Keyword co-occurrence network, optionally limited to one taxonomy category. */
async function getKeywordNetwork(tenantId, { categoryId, limit = 60, minWeight = 2 } = {}) {
  const max = clamp(limit, 60, 200);
  const catFilter = categoryId
    ? Prisma.sql`AND k.id IN (SELECT keyword_id FROM rip_keyword_taxonomy_mapping WHERE category_id = ${categoryId}::uuid AND status = 'approved')`
    : Prisma.empty;
  const nodes = await prisma.$queryRaw`
    SELECT k.id::text AS id, k.canonical_name AS name, k.publication_count AS pubs, k.momentum::float AS momentum,
           cat.id AS "categoryId", cat.name AS category
      FROM rip_research_keyword k
      LEFT JOIN LATERAL (
        SELECT c.id::text AS id, c.name FROM rip_keyword_taxonomy_mapping m JOIN rip_taxonomy_category c ON c.id = m.category_id
         WHERE m.keyword_id = k.id AND m.status = 'approved' ORDER BY m.is_primary DESC, c.name LIMIT 1) cat ON TRUE
     WHERE k.university_id = ${tenantId}::uuid AND k.publication_count > 0 ${catFilter}
     ORDER BY k.publication_count DESC
     LIMIT ${max}`;
  const ids = nodes.map((n) => n.id);
  const edges = ids.length
    ? await prisma.$queryRaw`
        SELECT c1.keyword_id::text AS source, c2.keyword_id::text AS target, COUNT(*)::int AS weight
          FROM rip_contribution_keyword c1
          JOIN rip_contribution_keyword c2 ON c1.contribution_id = c2.contribution_id AND c1.keyword_id < c2.keyword_id
         WHERE c1.university_id = ${tenantId}::uuid
           AND c1.keyword_id = ANY(${ids}::uuid[]) AND c2.keyword_id = ANY(${ids}::uuid[])
         GROUP BY 1, 2
        HAVING COUNT(*) >= ${Math.max(1, Number(minWeight) || 1)}`
    : [];
  return { nodes, edges };
}

/** Keywords that most often appear alongside one keyword. */
async function getKeywordCooccurrences(tenantId, keywordId, limit = 12) {
  return prisma.$queryRaw`
    SELECT k.id::text AS id, k.canonical_name AS name, COUNT(*)::int AS shared, k.publication_count AS pubs
      FROM rip_contribution_keyword c1
      JOIN rip_contribution_keyword c2 ON c2.contribution_id = c1.contribution_id AND c2.keyword_id <> c1.keyword_id
      JOIN rip_research_keyword k ON k.id = c2.keyword_id
     WHERE c1.university_id = ${tenantId}::uuid AND c1.keyword_id = ${keywordId}::uuid
     GROUP BY k.id
     ORDER BY shared DESC, k.publication_count DESC
     LIMIT ${clamp(limit, 12, 50)}`;
}

/**
 * Find experts on a topic. Combines two signals:
 *  - taxonomy expertise scores when the topic resolves to categories;
 *  - direct evidence: researchers' papers matching the topic (full text + keywords).
 */
async function findExperts(tenantId, { topic, categoryId, domainId, departmentId, limit = 10 } = {}) {
  const max = clamp(limit, 10, 30);
  let categories = [];
  let matchedNodes = [];
  let expansion = null;
  if (categoryId) categories = await prisma.ripTaxonomyCategory.findMany({ where: { id: categoryId }, select: { id: true, name: true } });
  else if (domainId) categories = await prisma.ripTaxonomyCategory.findMany({ where: { domainId, status: 'active' }, select: { id: true, name: true } });
  else if (topic) {
    // Topic → taxonomy nodes at any level; expertise scores live at category level, so a
    // specialization or domain contributes its parent / child categories.
    const nodes = await retrieval.matchTaxonomyNodes(tenantId, topic);
    matchedNodes = [...nodes.specializations, ...nodes.categories, ...nodes.domains].map((n) => n.name);
    const catIds = new Set(nodes.categories.map((n) => n.id));
    if (nodes.specializations.length) {
      (await prisma.ripTaxonomySpecialization.findMany({ where: { id: { in: nodes.specializations.map((n) => n.id) } }, select: { categoryId: true } })).forEach((x) => catIds.add(x.categoryId));
    }
    if (nodes.domains.length && !catIds.size) {
      (await prisma.ripTaxonomyCategory.findMany({ where: { domainId: { in: nodes.domains.map((n) => n.id) }, status: 'active' }, select: { id: true } })).forEach((x) => catIds.add(x.id));
    }
    categories = catIds.size ? await prisma.ripTaxonomyCategory.findMany({ where: { id: { in: [...catIds] } }, select: { id: true, name: true } }) : [];
    expansion = await retrieval.expandQuery(tenantId, topic, { useGraph: false });
  }

  const byUser = new Map();
  const add = (userId, patch) => byUser.set(userId, { userId, taxonomyScore: 0, matchingPubs: 0, citations: 0, lastYear: null, samplePapers: [], ...byUser.get(userId), ...patch });

  if (categories.length) {
    for (const r of await expertise.topExpertsForCategories(categories.map((c) => c.id), { limit: max * 2, departmentId })) {
      add(r.userId, { taxonomyScore: Number(r.score), topic: r.category?.name, citations: r.citationCount, lastYear: r.lastYear, matchingPubs: r.pubCount });
    }
  }

  if (topic) {
    const deptSql = departmentId ? Prisma.sql`AND rc.department_id = ${departmentId}::uuid` : Prisma.empty;
    // Evidence: papers matching the topic text (with aliases) or linked to its direct / taxonomy keywords.
    const kwIds = (expansion?.keywords || []).map((k) => k.id);
    const rows = await prisma.$queryRaw`
      WITH ${authorshipCte(tenantId)},
      q AS (SELECT websearch_to_tsquery('english', ${expansion?.ftsQuery || String(topic).slice(0, 200)}) AS tsq),
      hits AS (
        SELECT rc.id, rc.title, ${YEAR} AS year, ${CITES} AS cites
          FROM research_contribution rc CROSS JOIN q
         WHERE ${countedRc(tenantId)} ${deptSql}
           AND (${DOC} @@ q.tsq OR EXISTS (
                 SELECT 1 FROM rip_contribution_keyword ck
                  WHERE ck.contribution_id = rc.id AND ck.keyword_id = ANY(${kwIds}::uuid[])))
      )
      SELECT au.user_id::text AS user_id, COUNT(*)::int AS pubs, SUM(h.cites)::int AS cites, MAX(h.year) AS last_year,
             (array_agg(h.title ORDER BY h.cites DESC, h.year DESC))[1:3] AS titles
        FROM hits h JOIN authorship au ON au.contribution_id = h.id
       GROUP BY au.user_id
       ORDER BY pubs DESC, cites DESC
       LIMIT ${max * 2}`;
    for (const r of rows) {
      const cur = byUser.get(r.user_id);
      add(r.user_id, {
        matchingPubs: Math.max(cur?.matchingPubs || 0, r.pubs),
        citations: Math.max(cur?.citations || 0, r.cites),
        lastYear: Math.max(cur?.lastYear || 0, r.last_year || 0) || null,
        samplePapers: r.titles || [],
      });
    }
  }

  const now = new Date().getFullYear();
  const ranked = [...byUser.values()]
    .map((e) => ({
      ...e,
      // Blend: taxonomy score (0-100) with direct evidence volume, impact and recency.
      rank: e.taxonomyScore + 12 * Math.log1p(e.matchingPubs) + 4 * Math.log1p(e.citations) + (e.lastYear && now - e.lastYear <= 2 ? 5 : 0),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, max);

  const people = await describeResearchers(ranked.map((r) => r.userId));
  return {
    topic: topic || categories.map((c) => c.name).join(', ') || null,
    matchedCategories: categories.map((c) => c.name),
    matchedTaxonomy: matchedNodes,
    expandedWith: expansion ? { aliases: expansion.explain.aliases, keywords: expansion.explain.direct.slice(0, 10) } : null,
    experts: ranked
      .filter((r) => people.has(r.userId))
      .map((r) => ({
        ...people.get(r.userId),
        expertiseScore: Math.round(r.taxonomyScore),
        matchingPublications: r.matchingPubs,
        citations: r.citations,
        lastActiveYear: r.lastYear,
        topic: r.topic || null,
        samplePapers: r.samplePapers,
      })),
  };
}

/** Domain → category landscape with volumes and leading researchers. */
async function getDomainMap({ schoolId } = {}) {
  const domains = await prisma.ripTaxonomyDomain.findMany({
    where: { status: 'active' },
    orderBy: [{ publicationCount: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true, name: true, colorHex: true, iconCode: true, publicationCount: true, researcherCount: true,
      categories: {
        where: { status: 'active', publicationCount: { gt: 0 } },
        orderBy: { publicationCount: 'desc' },
        select: {
          id: true, name: true, publicationCount: true, researcherCount: true,
          specializations: {
            where: { status: 'active', publicationCount: { gt: 0 } },
            orderBy: { publicationCount: 'desc' },
            select: { id: true, name: true, publicationCount: true, researcherCount: true },
          },
        },
      },
    },
  });
  const categoryIds = domains.flatMap((d) => d.categories.map((c) => c.id));
  const leaders = categoryIds.length
    ? await prisma.ripResearcherTopicScore.findMany({
      where: { categoryId: { in: categoryIds }, ...(schoolId ? { user: { employeeDetails: { primarySchoolId: schoolId } } } : {}) },
      orderBy: { score: 'desc' },
      select: { categoryId: true, userId: true, score: true },
      take: 2000,
    })
    : [];
  const topByCat = new Map();
  for (const l of leaders) {
    const arr = topByCat.get(l.categoryId) || [];
    if (arr.length < 3) arr.push(l);
    topByCat.set(l.categoryId, arr);
  }
  const people = await describeResearchers([...new Set([...topByCat.values()].flat().map((l) => l.userId))]);
  return domains.map((d) => ({
    ...d,
    categories: d.categories.map((c) => ({
      ...c,
      leaders: (topByCat.get(c.id) || []).map((l) => ({ ...people.get(l.userId), score: Number(l.score) })).filter((p) => p.id),
    })),
  }));
}

module.exports = { getCollaborationNetwork, getKeywordNetwork, getKeywordCooccurrences, findExperts, getDomainMap };
