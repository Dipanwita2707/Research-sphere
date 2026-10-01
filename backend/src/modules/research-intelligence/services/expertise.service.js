/**
 * Expertise profiling — Research Intelligence
 *
 * For every researcher (applicant or internal co-author) and every taxonomy category their
 * papers fall into, computes a 0-100 score that is comparable ACROSS researchers:
 *
 *   score = 100 * ( 0.40 * volume  / maxVolume
 *                 + 0.25 * impact  / maxImpact
 *                 + 0.25 * recency / maxRecency
 *                 + 0.10 * consistency )
 *
 *   volume      = log(1 + papers)          (secondary-category papers count half)
 *   impact      = log(1 + citations)
 *   recency     = Σ 0.5^(age / 3 years)    per paper
 *   consistency = distinct active years / 6, capped at 1
 *   max*        = the maximum within the same category and tenant
 *
 * Also stores a per-researcher profile (h-index, collaborators, top keywords, …).
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { YEAR, CITES, authorshipCte } = require('./sql');
const { hIndex } = require('./researchData');

const log = createModuleLogger('rip:expertise');

const W = { volume: 0.4, impact: 0.25, recency: 0.25, consistency: 0.1 };
const RECENT_YEARS = 3;

async function computeForTenant(tenantId, { onProgress } = {}) {
  const now = new Date().getFullYear();

  const papers = await prisma.$queryRaw`
    WITH ${authorshipCte(tenantId)}
    SELECT au.user_id::text AS user_id, rc.id::text AS contribution_id, ${YEAR} AS year, ${CITES} AS cites
      FROM authorship au
      JOIN research_contribution rc ON rc.id = au.contribution_id
      JOIN user_login u ON u.id = au.user_id`;
  onProgress?.(25);

  const paperCategories = await prisma.$queryRaw`
    SELECT ck.contribution_id::text AS contribution_id, m.category_id::text AS category_id, bool_or(m.is_primary) AS is_primary
      FROM rip_contribution_keyword ck
      JOIN rip_keyword_taxonomy_mapping m ON m.keyword_id = ck.keyword_id AND m.status = 'approved'
      JOIN rip_taxonomy_category c ON c.id = m.category_id AND c.status = 'active'
     WHERE ck.university_id = ${tenantId}::uuid
     GROUP BY 1, 2`;

  const paperKeywords = await prisma.$queryRaw`
    SELECT ck.contribution_id::text AS contribution_id, ck.keyword_id::text AS keyword_id
      FROM rip_contribution_keyword ck
     WHERE ck.university_id = ${tenantId}::uuid`;

  const coauthors = await prisma.$queryRaw`
    WITH ${authorshipCte(tenantId)}
    SELECT a1.user_id::text AS user_id,
           COUNT(DISTINCT a2.user_id)::int AS internal,
           (SELECT COUNT(DISTINCT lower(x.name))::int
              FROM research_contribution_author x
              JOIN authorship a3 ON a3.contribution_id = x.research_contribution_id AND a3.user_id = a1.user_id
             WHERE x.university_id = ${tenantId}::uuid AND (x.is_internal = false OR x.user_id IS NULL)) AS external
      FROM authorship a1
      LEFT JOIN authorship a2 ON a2.contribution_id = a1.contribution_id AND a2.user_id <> a1.user_id
     GROUP BY a1.user_id`;
  onProgress?.(50);

  const catsByPaper = new Map();
  for (const r of paperCategories) {
    if (!catsByPaper.has(r.contribution_id)) catsByPaper.set(r.contribution_id, []);
    catsByPaper.get(r.contribution_id).push({ categoryId: r.category_id, weight: r.is_primary ? 1 : 0.5 });
  }
  const kwsByPaper = new Map();
  for (const r of paperKeywords) {
    if (!kwsByPaper.has(r.contribution_id)) kwsByPaper.set(r.contribution_id, []);
    kwsByPaper.get(r.contribution_id).push(r.keyword_id);
  }
  const coBy = new Map(coauthors.map((r) => [r.user_id, r]));

  // user → { papers: [{year, cites, id}], topics: Map(categoryId → agg), keywords: Map }
  const users = new Map();
  for (const p of papers) {
    let u = users.get(p.user_id);
    if (!u) {
      u = { papers: [], topics: new Map(), keywords: new Map() };
      users.set(p.user_id, u);
    }
    u.papers.push(p);
    for (const kw of kwsByPaper.get(p.contribution_id) || []) u.keywords.set(kw, (u.keywords.get(kw) || 0) + 1);
    for (const { categoryId, weight } of catsByPaper.get(p.contribution_id) || []) {
      const t = u.topics.get(categoryId) || { pubs: 0, weighted: 0, cites: 0, recent: 0, recency: 0, years: new Set() };
      t.pubs += 1;
      t.weighted += weight;
      t.cites += p.cites * weight;
      if (p.year) {
        t.years.add(p.year);
        t.recency += weight * 0.5 ** (Math.max(0, now - p.year) / 3);
        if (p.year > now - RECENT_YEARS) t.recent += 1;
      }
      u.topics.set(categoryId, t);
    }
  }

  // Category-level maxima for normalisation.
  const max = new Map();
  for (const u of users.values()) {
    for (const [cat, t] of u.topics) {
      const m = max.get(cat) || { volume: 0, impact: 0, recency: 0 };
      m.volume = Math.max(m.volume, Math.log1p(t.weighted));
      m.impact = Math.max(m.impact, Math.log1p(t.cites));
      m.recency = Math.max(m.recency, t.recency);
      max.set(cat, m);
    }
  }
  const ratio = (v, m) => (m > 0 ? v / m : 0);

  const topicRows = [];
  const profiles = [];
  for (const [userId, u] of users) {
    let best = null;
    for (const [categoryId, t] of u.topics) {
      const m = max.get(categoryId);
      const score =
        100 *
        (W.volume * ratio(Math.log1p(t.weighted), m.volume) +
          W.impact * ratio(Math.log1p(t.cites), m.impact) +
          W.recency * ratio(t.recency, m.recency) +
          W.consistency * Math.min(t.years.size / 6, 1));
      const years = [...t.years];
      const row = {
        userId,
        categoryId,
        score: Math.round(score * 100) / 100,
        pubCount: t.pubs,
        citationCount: Math.round(t.cites),
        recentPubCount: t.recent,
        firstYear: years.length ? Math.min(...years) : null,
        lastYear: years.length ? Math.max(...years) : null,
      };
      topicRows.push(row);
      if (!best || row.score > best.score || (row.score === best.score && row.pubCount > best.pubCount)) best = row;
    }

    const years = new Set(u.papers.map((p) => p.year).filter(Boolean));
    const co = coBy.get(userId) || {};
    profiles.push({
      userId,
      primaryCategoryId: best?.categoryId || null,
      totalPubs: u.papers.length,
      totalCitations: u.papers.reduce((s, p) => s + p.cites, 0),
      hIndex: hIndex(u.papers.map((p) => p.cites)),
      recentPubs: u.papers.filter((p) => p.year && p.year > now - RECENT_YEARS).length,
      collaboratorCount: co.internal || 0,
      externalCollabs: co.external || 0,
      activeYears: years.size,
      topKeywordIds: [...u.keywords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id),
      lastComputedAt: new Date(),
    });
  }
  onProgress?.(70);

  // Replace topic scores wholesale; upsert profiles so ids stay stable.
  await prisma.ripResearcherTopicScore.deleteMany({});
  for (let i = 0; i < topicRows.length; i += 1000) {
    await prisma.ripResearcherTopicScore.createMany({ data: topicRows.slice(i, i + 1000), skipDuplicates: true });
  }
  for (let i = 0; i < profiles.length; i += 25) {
    await Promise.all(
      profiles.slice(i, i + 25).map(({ userId, ...data }) =>
        prisma.ripResearcherExpertiseProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } })
      )
    );
  }
  await prisma.ripResearcherExpertiseProfile.deleteMany({ where: { userId: { notIn: [...users.keys()] } } });
  onProgress?.(100);

  const stats = { researchers: profiles.length, topicScores: topicRows.length };
  log.info('Expertise computed', stats);
  return stats;
}

/** Researchers ranked for a taxonomy category (or every category in a domain). */
async function topExpertsForCategories(categoryIds, { limit = 10, departmentId } = {}) {
  const rows = await prisma.ripResearcherTopicScore.findMany({
    where: {
      categoryId: { in: categoryIds },
      ...(departmentId ? { user: { employeeDetails: { primaryDepartmentId: departmentId } } } : {}),
    },
    orderBy: [{ score: 'desc' }, { pubCount: 'desc' }],
    take: Math.min(limit * 3, 150),
    select: {
      userId: true,
      score: true,
      pubCount: true,
      citationCount: true,
      recentPubCount: true,
      lastYear: true,
      category: { select: { name: true } },
    },
  });
  // A researcher may rank in several of the categories: keep their best one.
  const best = new Map();
  for (const r of rows) if (!best.has(r.userId)) best.set(r.userId, r);
  return [...best.values()].slice(0, limit);
}

module.exports = { computeForTenant, topExpertsForCategories, WEIGHTS: W };
