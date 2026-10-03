/**
 * External collaboration — Research Intelligence
 *
 * Who the university publishes with outside its own walls: partner institutions, their
 * countries, international vs domestic co-authorship and industry collaboration.
 *
 * Signals per contribution (approved/completed only):
 *   - research_contribution_author rows with is_internal = false (affiliation, is_international)
 *   - indexing_details.affiliationSummary.authors imported from Scopus (affiliation, country)
 *   - research_contribution.international_author / foreign_collaborations_count / industry_collaboration
 *
 * Raw SQL is not tenant-scoped by tenantExtension, so every query filters university_id.
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { Prisma, YEAR, CITES } = require('./sql');
const { RESEARCHER_SELECT, researcherSummary } = require('./researchData');
const { locateAffiliation, institutionName, canonicalCountry } = require('../../../shared/utils/institutionGeo');
const { isAffiliationMatch, normalize: normalizeAffiliation } = require('../../../shared/utils/affiliationEngine');
const { getUniversityAffiliationVariants } = require('../../core/services/affiliation.service');

/** Only finalised work counts as an established collaboration. */
const FINAL_STATUSES = ['approved', 'completed'];
/** Safety cap on contributions scanned in one call. */
const MAX_PAPERS = 20000;

const INDUSTRY_RE = /\b(ltd|limited|inc|incorporated|pvt|private limited|corp|corporation|llc|llp|gmbh|plc|technologies|industries|pharmaceuticals?|labs? pvt|solutions)\b\.?/i;
const isIndustryAffiliation = (text) => INDUSTRY_RE.test(String(text || ''));

/**
 * Load candidate contributions (those with any external-collaboration signal) with their authors.
 * @returns {Promise<Array>} rows with id, title, journal, year, citations, doi, intl_flag, foreign_count,
 *   industry, applicant_user_id, summary_authors (json|null), authors (json array|null)
 */
async function loadCandidates(tenantId, { departmentIds, schoolIds, yearFrom, yearTo } = {}) {
  const where = [
    Prisma.sql`rc.university_id = ${tenantId}::uuid`,
    Prisma.sql`rc.status::text IN (${Prisma.join(FINAL_STATUSES)})`,
  ];
  if (departmentIds?.length) where.push(Prisma.sql`rc.department_id = ANY(${departmentIds}::uuid[])`);
  if (schoolIds?.length) where.push(Prisma.sql`rc.school_id = ANY(${schoolIds}::uuid[])`);
  if (yearFrom) where.push(Prisma.sql`${YEAR} >= ${yearFrom}`);
  if (yearTo) where.push(Prisma.sql`${YEAR} <= ${yearTo}`);

  return prisma.$queryRaw`
    SELECT rc.id::text AS id, rc.title, rc.journal_name AS journal, ${YEAR} AS year, ${CITES} AS citations,
           COALESCE(rc.doi, rc.paper_doi) AS doi,
           COALESCE(rc.international_author, false) AS intl_flag,
           COALESCE(rc.foreign_collaborations_count, 0) AS foreign_count,
           COALESCE(rc.industry_collaboration, false) AS industry,
           rc.applicant_user_id::text AS applicant_user_id,
           CASE WHEN jsonb_typeof(rc.indexing_details::jsonb #> '{affiliationSummary,authors}') = 'array'
                THEN rc.indexing_details::jsonb #> '{affiliationSummary,authors}' END AS summary_authors,
           (SELECT json_agg(json_build_object(
                     'name', a.name, 'userId', a.user_id::text, 'isInternal', a.is_internal,
                     'affiliation', a.affiliation, 'isInternational', a.is_international)
                   ORDER BY a.author_order)
              FROM research_contribution_author a
             WHERE a.research_contribution_id = rc.id AND a.university_id = ${tenantId}::uuid) AS authors
      FROM research_contribution rc
     WHERE ${Prisma.join(where, ' AND ')}
       AND (COALESCE(rc.international_author, false)
            OR COALESCE(rc.foreign_collaborations_count, 0) > 0
            OR COALESCE(rc.industry_collaboration, false)
            OR jsonb_typeof(rc.indexing_details::jsonb #> '{affiliationSummary,authors}') = 'array'
            OR EXISTS (SELECT 1 FROM research_contribution_author x
                        WHERE x.research_contribution_id = rc.id AND x.university_id = ${tenantId}::uuid
                          AND x.is_internal = false))
     ORDER BY ${CITES} DESC
     LIMIT ${MAX_PAPERS}`;
}

/**
 * Pure aggregation over candidate rows (exported for tests).
 * @param {Array} rows from loadCandidates
 * @param {{ homeCountry?: string|null, isHome?: (aff: string) => boolean }} opts
 */
function aggregate(rows, { homeCountry = null, isHome = () => false } = {}) {
  const home = homeCountry ? String(homeCountry).toLowerCase() : null;
  const partners = new Map();
  const countries = new Map();
  const researchers = new Map(); // userId -> { external, international, industry, partners:Set }
  const papers = [];
  const summary = { papers_with_external_collaboration: 0, international_papers: 0, domestic_only_papers: 0, industry_papers: 0, external_coauthors: 0 };

  for (const row of rows) {
    const seen = new Map(); // partner key -> { name, country, raw, industry }
    let externalAuthors = 0;
    let intlAuthor = false;
    const add = (raw, countryHint) => {
      const text = String(raw || '').trim();
      if (!text || isHome(text)) return;
      const name = institutionName(text);
      const key = normalizeAffiliation(name);
      if (!key || key.length < 3) return;
      const country = locateAffiliation(text, countryHint)?.country || canonicalCountry(countryHint) || null;
      const prev = seen.get(key);
      if (!prev || (!prev.country && country)) seen.set(key, { name, country: country || prev?.country || null, industry: isIndustryAffiliation(text) });
    };

    const authors = Array.isArray(row.authors) ? row.authors : [];
    const internalIds = new Set(row.applicant_user_id ? [row.applicant_user_id] : []);
    for (const a of authors) {
      if (a.isInternal === false) {
        externalAuthors += 1;
        if (a.isInternational) intlAuthor = true;
        add(a.affiliation, null);
      } else if (a.userId) {
        internalIds.add(a.userId);
      }
    }
    if (Array.isArray(row.summary_authors)) {
      for (const a of row.summary_authors) if (a && !a.isSgtAffiliated && !a.isHomeAffiliated) add(a.affiliation, a.country);
    }

    const partnerList = [...seen.values()];
    const foreignPartner = partnerList.some((p) => p.country && home && p.country.toLowerCase() !== home);
    const international = Boolean(row.intl_flag) || Number(row.foreign_count) > 0 || intlAuthor || foreignPartner;
    const industry = Boolean(row.industry) || partnerList.some((p) => p.industry);
    const external = international || industry || externalAuthors > 0 || partnerList.length > 0;
    if (!external) continue;

    summary.papers_with_external_collaboration += 1;
    summary.external_coauthors += externalAuthors;
    if (international) summary.international_papers += 1;
    else summary.domestic_only_papers += 1;
    if (industry) summary.industry_papers += 1;

    for (const [key, p] of seen) {
      const e = partners.get(key) || { name: p.name, country: null, papers: 0, industry: false };
      e.papers += 1;
      if (!e.country && p.country) e.country = p.country;
      e.industry = e.industry || p.industry;
      partners.set(key, e);
    }
    for (const c of new Set(partnerList.map((p) => p.country).filter(Boolean))) countries.set(c, (countries.get(c) || 0) + 1);

    for (const id of internalIds) {
      const r = researchers.get(id) || { external: 0, international: 0, industry: 0, partners: new Set() };
      r.external += 1;
      if (international) r.international += 1;
      if (industry) r.industry += 1;
      partnerList.forEach((p) => r.partners.add(p.name));
      researchers.set(id, r);
    }

    papers.push({
      id: row.id,
      title: row.title,
      journal: row.journal || null,
      year: row.year || null,
      doi: row.doi || null,
      citations: Number(row.citations) || 0,
      authors: authors.map((a) => a.name).filter(Boolean),
      international,
      industry,
      partners: partnerList.map((p) => p.name),
      countries: [...new Set(partnerList.map((p) => p.country).filter(Boolean))],
    });
  }

  const partnerList = [...partners.values()]
    .map((p) => ({ ...p, international: Boolean(p.country && home && p.country.toLowerCase() !== home) }))
    .sort((a, b) => b.papers - a.papers || a.name.localeCompare(b.name));
  summary.partner_institutions = partnerList.length;
  summary.international_partner_institutions = partnerList.filter((p) => p.international).length;
  summary.industry_partners = partnerList.filter((p) => p.industry).length;
  summary.countries = countries.size;

  return {
    summary,
    partners: partnerList,
    countries: [...countries.entries()].map(([country, n]) => ({ country, papers: n, home: Boolean(home && country.toLowerCase() === home) })).sort((a, b) => b.papers - a.papers),
    researchers: [...researchers.entries()]
      .map(([userId, r]) => ({ userId, externalPapers: r.external, internationalPapers: r.international, industryPapers: r.industry, partners: [...r.partners] }))
      .sort((a, b) => b.externalPapers - a.externalPapers || b.internationalPapers - a.internationalPapers),
    papers,
  };
}

/**
 * External collaboration profile of the university or a unit.
 * @param {string} tenantId
 * @param {{ departmentIds?: string[], schoolIds?: string[], yearFrom?: number, yearTo?: number, limit?: number }} opts
 */
async function getExternalCollaborations(tenantId, opts = {}) {
  if (!tenantId) throw new Error('tenantId is required');
  const limit = Math.max(1, Math.min(Number(opts.limit) || 10, 25));
  const [university, variants, rows] = await Promise.all([
    prisma.university.findFirst({ where: { id: tenantId }, select: { name: true, country: true } }),
    getUniversityAffiliationVariants(tenantId).catch(() => ({ variants: [] })),
    loadCandidates(tenantId, opts),
  ]);
  const homeVariants = variants?.variants || [];
  const agg = aggregate(rows, {
    homeCountry: university?.country || 'India',
    isHome: (aff) => homeVariants.length > 0 && isAffiliationMatch(aff, homeVariants),
  });

  const topResearchers = agg.researchers.slice(0, limit);
  const users = topResearchers.length
    ? await prisma.userLogin.findMany({ where: { id: { in: topResearchers.map((r) => r.userId) } }, select: RESEARCHER_SELECT })
    : [];
  const people = new Map(users.map((u) => [u.id, researcherSummary(u)]));

  return {
    homeCountry: university?.country || 'India',
    truncated: rows.length >= MAX_PAPERS,
    summary: agg.summary,
    partners: agg.partners.slice(0, limit * 2),
    countries: agg.countries.slice(0, 20),
    researchers: topResearchers.filter((r) => people.has(r.userId)).map((r) => ({ ...people.get(r.userId), ...r, partners: r.partners.slice(0, 5) })),
    internationalPapers: agg.papers.filter((p) => p.international).slice(0, limit),
    industryPapers: agg.papers.filter((p) => p.industry).slice(0, limit),
  };
}

module.exports = { getExternalCollaborations, _internals: { aggregate, isIndustryAffiliation, loadCandidates, FINAL_STATUSES, MAX_PAPERS } };
