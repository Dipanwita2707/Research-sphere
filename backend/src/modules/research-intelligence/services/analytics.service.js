/**
 * Research analytics — Research Intelligence
 *
 * Institution, school, department and researcher level analytics, plus keyword trends.
 * Every query is tenant-scoped: Prisma calls by tenantExtension, raw SQL explicitly.
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { NotFoundError } = require('../../../shared/utils/AppError');
const { Prisma, YEAR, CITES, countedRc, authorshipCte } = require('./sql');
const { RESEARCHER_SELECT, researcherSummary } = require('./researchData');

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

/** Optional unit filter on research_contribution rc. */
const unitSql = ({ departmentIds, schoolIds } = {}) => {
  const parts = [];
  if (departmentIds?.length) parts.push(Prisma.sql`rc.department_id = ANY(${departmentIds}::uuid[])`);
  if (schoolIds?.length) parts.push(Prisma.sql`rc.school_id = ANY(${schoolIds}::uuid[])`);
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, ' AND ')}` : Prisma.empty;
};

/** Core metrics for the whole tenant or a unit. */
async function coreMetrics(tenantId, unit = {}) {
  const u = unitSql(unit);
  const [totals] = await prisma.$queryRaw`
    WITH ${authorshipCte(tenantId)}
    SELECT COUNT(*)::int AS publications,
           COALESCE(SUM(${CITES}), 0)::int AS citations,
           COUNT(*) FILTER (WHERE rc.quartile::text IN ('Top 1%','Top 5%','Q1'))::int AS q1_or_better,
           COUNT(*) FILTER (WHERE rc.international_author)::int AS international,
           COUNT(*) FILTER (WHERE rc.industry_collaboration)::int AS industry,
           COUNT(*) FILTER (WHERE ${YEAR} >= EXTRACT(YEAR FROM now())::int - 1)::int AS last_two_years,
           (SELECT COUNT(DISTINCT au.user_id)::int FROM authorship au JOIN research_contribution rc ON rc.id = au.contribution_id WHERE TRUE ${u}) AS researchers
      FROM research_contribution rc
     WHERE ${countedRc(tenantId)} ${u}`;
  const yearly = await prisma.$queryRaw`
    SELECT ${YEAR} AS year, COUNT(*)::int AS publications, COALESCE(SUM(${CITES}), 0)::int AS citations
      FROM research_contribution rc
     WHERE ${countedRc(tenantId)} ${u} AND ${YEAR} IS NOT NULL
     GROUP BY 1 ORDER BY 1`;
  const byType = await prisma.$queryRaw`
    SELECT rc.publication_type::text AS type, COUNT(*)::int AS count
      FROM research_contribution rc WHERE ${countedRc(tenantId)} ${u} GROUP BY 1 ORDER BY 2 DESC`;
  const byQuartile = await prisma.$queryRaw`
    SELECT COALESCE(rc.quartile::text, 'Unranked') AS quartile, COUNT(*)::int AS count
      FROM research_contribution rc WHERE ${countedRc(tenantId)} ${u} GROUP BY 1 ORDER BY 1`;
  const topJournals = await prisma.$queryRaw`
    SELECT rc.journal_name AS journal, COUNT(*)::int AS count, COALESCE(SUM(${CITES}), 0)::int AS citations
      FROM research_contribution rc
     WHERE ${countedRc(tenantId)} ${u} AND rc.journal_name IS NOT NULL AND rc.journal_name <> ''
     GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 10`;
  const topics = await prisma.$queryRaw`
    SELECT k.id::text AS id, k.canonical_name AS name, COUNT(DISTINCT rc.id)::int AS count, k.momentum::float AS momentum, k.growth_rate::float AS growth
      FROM rip_contribution_keyword ck
      JOIN rip_research_keyword k ON k.id = ck.keyword_id
      JOIN research_contribution rc ON rc.id = ck.contribution_id
     WHERE ck.university_id = ${tenantId}::uuid AND ${countedRc(tenantId)} ${u}
     GROUP BY k.id ORDER BY 3 DESC LIMIT 15`;
  const t = totals || {};
  return {
    totals: {
      publications: num(t.publications),
      citations: num(t.citations),
      researchers: num(t.researchers),
      q1OrBetter: num(t.q1_or_better),
      international: num(t.international),
      industry: num(t.industry),
      lastTwoYears: num(t.last_two_years),
      citationsPerPaper: t.publications ? Math.round((num(t.citations) / num(t.publications)) * 100) / 100 : 0,
    },
    yearly,
    byType,
    byQuartile,
    topJournals,
    topTopics: topics,
  };
}

/** Top researchers in a scope by output and impact. */
async function topResearchers(tenantId, unit = {}, limit = 10) {
  const u = unitSql(unit);
  const rows = await prisma.$queryRaw`
    WITH ${authorshipCte(tenantId)}
    SELECT au.user_id::text AS id, COUNT(*)::int AS publications, COALESCE(SUM(${CITES}), 0)::int AS citations,
           COUNT(*) FILTER (WHERE ${YEAR} >= EXTRACT(YEAR FROM now())::int - 2)::int AS recent
      FROM authorship au JOIN research_contribution rc ON rc.id = au.contribution_id
     WHERE TRUE ${u}
     GROUP BY au.user_id
     ORDER BY publications DESC, citations DESC
     LIMIT ${Math.min(Number(limit) || 10, 50)}`;
  const users = await prisma.userLogin.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: RESEARCHER_SELECT });
  const byId = new Map(users.map((x) => [x.id, researcherSummary(x)]));
  return rows.filter((r) => byId.has(r.id)).map((r) => ({ ...byId.get(r.id), publications: r.publications, citations: r.citations, recentPublications: r.recent }));
}

/** Topic concentration (Herfindahl-Hirschman index over keyword shares), 0 = diverse, 1 = focused. */
const concentration = (topics) => {
  const total = topics.reduce((s, x) => s + x.count, 0);
  return total ? Math.round(topics.reduce((s, x) => s + (x.count / total) ** 2, 0) * 1000) / 1000 : 0;
};

async function getOverview(tenantId) {
  const [core, researchers, domains, keywordKpis, departments, lastRun] = await Promise.all([
    coreMetrics(tenantId),
    topResearchers(tenantId, {}, 10),
    prisma.ripTaxonomyDomain.findMany({
      where: { status: 'active', publicationCount: { gt: 0 } },
      orderBy: { publicationCount: 'desc' },
      select: { id: true, name: true, colorHex: true, publicationCount: true, researcherCount: true },
    }),
    getKeywordKpis(),
    prisma.$queryRaw`
      SELECT d.id::text AS id, d.department_name AS name, COUNT(*)::int AS publications, COALESCE(SUM(${CITES}), 0)::int AS citations
        FROM research_contribution rc JOIN department d ON d.id = rc.department_id
       WHERE ${countedRc(tenantId)}
       GROUP BY d.id ORDER BY 3 DESC LIMIT 12`,
    prisma.ripPipelineRun.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);
  return { ...core, topResearchers: researchers, domains, departments, keywords: keywordKpis, lastPipelineRun: lastRun };
}

async function getUnitAnalytics(tenantId, { departmentId, schoolId }) {
  let unit;
  if (departmentId) {
    const d = await prisma.department.findFirst({ where: { id: departmentId }, select: { id: true, departmentName: true, faculty: { select: { facultyName: true } } } });
    if (!d) throw new NotFoundError('Department not found');
    unit = { type: 'department', id: d.id, name: d.departmentName, parent: d.faculty?.facultyName || null };
  } else {
    const s = await prisma.facultySchoolList.findFirst({ where: { id: schoolId }, select: { id: true, facultyName: true } });
    if (!s) throw new NotFoundError('School not found');
    unit = { type: 'school', id: s.id, name: s.facultyName, parent: null };
  }
  const filter = departmentId ? { departmentIds: [departmentId] } : { schoolIds: [schoolId] };
  const [core, researchers] = await Promise.all([coreMetrics(tenantId, filter), topResearchers(tenantId, filter, 10)]);
  return { unit, ...core, topResearchers: researchers, topicConcentration: concentration(core.topTopics) };
}

/** Side-by-side comparison of up to four departments/schools. */
async function compareUnits(tenantId, units) {
  const out = [];
  for (const u of units.slice(0, 4)) {
    const a = await getUnitAnalytics(tenantId, u);
    out.push({
      unit: a.unit,
      totals: a.totals,
      yearly: a.yearly,
      topTopics: a.topTopics.slice(0, 6),
      topResearchers: a.topResearchers.slice(0, 3),
      topicConcentration: a.topicConcentration,
    });
  }
  return out;
}

async function getResearcherProfile(tenantId, userId) {
  const user = await prisma.userLogin.findFirst({ where: { id: userId }, select: RESEARCHER_SELECT });
  if (!user) throw new NotFoundError('Researcher not found');
  const [profile, topics, papers, collaborators] = await Promise.all([
    prisma.ripResearcherExpertiseProfile.findFirst({ where: { userId } }),
    prisma.ripResearcherTopicScore.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: 10,
      select: { score: true, pubCount: true, citationCount: true, recentPubCount: true, firstYear: true, lastYear: true, category: { select: { id: true, name: true, domain: { select: { name: true, colorHex: true } } } } },
    }),
    prisma.$queryRaw`
      WITH ${authorshipCte(tenantId)}
      SELECT rc.id::text AS id, rc.title, rc.journal_name AS journal, ${YEAR} AS year, ${CITES} AS citations, rc.quartile::text AS quartile
        FROM authorship au JOIN research_contribution rc ON rc.id = au.contribution_id
       WHERE au.user_id = ${userId}::uuid
       ORDER BY citations DESC, year DESC NULLS LAST LIMIT 15`,
    prisma.$queryRaw`
      WITH ${authorshipCte(tenantId)}
      SELECT a2.user_id::text AS id, COUNT(*)::int AS shared
        FROM authorship a1 JOIN authorship a2 ON a2.contribution_id = a1.contribution_id AND a2.user_id <> a1.user_id
       WHERE a1.user_id = ${userId}::uuid
       GROUP BY a2.user_id ORDER BY shared DESC LIMIT 10`,
  ]);
  const [keywords, collabUsers, yearly] = await Promise.all([
    profile?.topKeywordIds?.length
      ? prisma.ripResearchKeyword.findMany({ where: { id: { in: profile.topKeywordIds } }, select: { id: true, canonicalName: true, publicationCount: true } })
      : [],
    prisma.userLogin.findMany({ where: { id: { in: collaborators.map((c) => c.id) } }, select: RESEARCHER_SELECT }),
    prisma.$queryRaw`
      WITH ${authorshipCte(tenantId)}
      SELECT ${YEAR} AS year, COUNT(*)::int AS publications, COALESCE(SUM(${CITES}), 0)::int AS citations
        FROM authorship au JOIN research_contribution rc ON rc.id = au.contribution_id
       WHERE au.user_id = ${userId}::uuid AND ${YEAR} IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
  ]);
  const kwOrder = new Map((profile?.topKeywordIds || []).map((id, i) => [id, i]));
  const collabById = new Map(collabUsers.map((x) => [x.id, researcherSummary(x)]));
  return {
    researcher: researcherSummary(user),
    metrics: profile
      ? {
        publications: profile.totalPubs,
        citations: profile.totalCitations,
        hIndex: profile.hIndex,
        recentPublications: profile.recentPubs,
        internalCollaborators: profile.collaboratorCount,
        externalCoAuthors: profile.externalCollabs,
        activeYears: profile.activeYears,
        computedAt: profile.lastComputedAt,
      }
      : null,
    topics: topics.map((t) => ({ ...t, score: Number(t.score) })),
    keywords: keywords.sort((a, b) => kwOrder.get(a.id) - kwOrder.get(b.id)),
    yearly,
    topPapers: papers,
    collaborators: collaborators.filter((c) => collabById.has(c.id)).map((c) => ({ ...collabById.get(c.id), sharedPapers: c.shared })),
  };
}

// ─── Keywords ─────────────────────────────────────────────────────────────────

async function getKeywordKpis() {
  const [total, mapped, pending, growing] = await Promise.all([
    prisma.ripResearchKeyword.count({ where: { publicationCount: { gt: 0 } } }),
    prisma.ripResearchKeyword.count({ where: { publicationCount: { gt: 0 }, taxonomyMappings: { some: { status: 'approved' } } } }),
    prisma.ripKeywordTaxonomyMapping.count({ where: { status: 'pending_review' } }),
    prisma.ripResearchKeyword.count({ where: { publicationCount: { gte: 2 }, growthRate: { gt: 25 } } }),
  ]);
  return { total, mapped, taxonomyCoverage: total ? Math.round((mapped / total) * 1000) / 10 : 0, pendingReview: pending, growing };
}

/**
 * Trending topics ranked by momentum (recency-weighted volume), plus "emerging" topics that
 * first appeared in the last two years and already recur.
 */
async function getTrendingKeywords({ limit = 20, minPubs = 2 } = {}) {
  const take = Math.min(Number(limit) || 20, 100);
  const now = new Date().getFullYear();
  const [trending, emerging] = await Promise.all([
    prisma.ripResearchKeyword.findMany({
      where: { publicationCount: { gte: Number(minPubs) || 2 } },
      orderBy: [{ momentum: 'desc' }, { publicationCount: 'desc' }],
      take,
      select: { id: true, canonicalName: true, publicationCount: true, researcherCount: true, totalCitations: true, growthRate: true, momentum: true, yearlyVolume: true, firstSeenYear: true },
    }),
    prisma.ripResearchKeyword.findMany({
      where: { publicationCount: { gte: 2 }, firstSeenYear: { gte: now - 1 } },
      orderBy: [{ publicationCount: 'desc' }],
      take: 10,
      select: { id: true, canonicalName: true, publicationCount: true, researcherCount: true, firstSeenYear: true },
    }),
  ]);
  const fix = (k) => ({ ...k, growthRate: k.growthRate === null ? null : Number(k.growthRate), momentum: k.momentum === null ? null : Number(k.momentum) });
  return { trending: trending.map(fix), emerging };
}

async function listKeywords({ search, categoryId, unmapped, sort = 'publications', limit = 50, offset = 0 } = {}) {
  const where = {
    publicationCount: { gt: 0 },
    ...(search ? { canonicalName: { contains: String(search), mode: 'insensitive' } } : {}),
    ...(categoryId ? { taxonomyMappings: { some: { categoryId } } } : {}),
    ...(unmapped === 'true' || unmapped === true ? { taxonomyMappings: { none: {} } } : {}),
  };
  const orderBy = sort === 'momentum' ? [{ momentum: 'desc' }] : sort === 'citations' ? [{ totalCitations: 'desc' }] : sort === 'name' ? [{ canonicalName: 'asc' }] : [{ publicationCount: 'desc' }];
  const [items, total] = await Promise.all([
    prisma.ripResearchKeyword.findMany({
      where,
      orderBy,
      take: Math.min(Number(limit) || 50, 200),
      skip: Math.max(Number(offset) || 0, 0),
      include: { taxonomyMappings: { select: { id: true, isPrimary: true, status: true, source: true, category: { select: { id: true, name: true } } } } },
    }),
    prisma.ripResearchKeyword.count({ where }),
  ]);
  return { items, total };
}

module.exports = {
  getOverview,
  getUnitAnalytics,
  compareUnits,
  getResearcherProfile,
  topResearchers,
  coreMetrics,
  getKeywordKpis,
  getTrendingKeywords,
  listKeywords,
};
