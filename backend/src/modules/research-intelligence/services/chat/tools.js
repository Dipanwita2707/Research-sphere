/**
 * Research assistant tools — the model's only window onto institutional data.
 *
 * Replaces the reference's regex intent classifier: the model decides which lookups a
 * question needs (possibly several, possibly chained), and every fact it can state comes
 * from a tool result. Each publication or researcher a tool returns is registered as a
 * numbered source that the answer cites as [n].
 *
 * Tools are read-only and tenant-scoped. Parameter schemas use the JSON-schema subset that
 * both Gemini and Groq accept (no defaults, no additionalProperties).
 */

'use strict';

const search = require('../search.service');
const retrieval = require('../retrieval.service');
const graph = require('../graph.service');
const analytics = require('../analytics.service');
const taxonomy = require('../taxonomy.service');
const externalCollab = require('../externalCollaboration.service');

// ─── Source registry ──────────────────────────────────────────────────────────

class SourceRegistry {
  constructor() {
    this.items = [];
    this.byKey = new Map();
  }

  add(type, id, data) {
    const key = `${type}:${id}`;
    if (this.byKey.has(key)) return this.byKey.get(key).ref;
    const item = { ref: this.items.length + 1, type, id, ...data };
    this.items.push(item);
    this.byKey.set(key, item);
    return item.ref;
  }

  publication(p) {
    return this.add('publication', p.id, { title: p.title, journal: p.journal || null, year: p.year || null, doi: p.doi || null, citations: p.citations || 0, authors: (p.authors || []).slice(0, 6) });
  }

  researcher(r) {
    return this.add('researcher', r.id, { name: r.name, designation: r.designation || null, department: r.department || null });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : undefined;
};

/** Resolve a department/school name, returning ids plus a note when ambiguous or unknown. */
async function resolveUnit(name) {
  if (!name) return {};
  const depts = await search.resolveDepartments(name, 5);
  const exact = depts.find((d) => [d.name, d.shortName].some((x) => x && x.toLowerCase() === name.toLowerCase()));
  if (exact || depts.length === 1) {
    const d = exact || depts[0];
    return { departmentIds: [d.id], unit: { type: 'department', name: d.name, school: d.school } };
  }
  const schools = await search.resolveSchools(name, 5);
  if (schools.length === 1 || schools.find((s) => s.name.toLowerCase() === name.toLowerCase())) {
    const s = schools.find((x) => x.name.toLowerCase() === name.toLowerCase()) || schools[0];
    return { schoolIds: [s.id], unit: { type: 'school', name: s.name } };
  }
  if (depts.length > 1) return { departmentIds: depts.map((d) => d.id), unit: { type: 'departments', names: depts.map((d) => d.name) }, note: `"${name}" matched several departments; results include all of them.` };
  if (schools.length > 1) return { schoolIds: schools.map((s) => s.id), unit: { type: 'schools', names: schools.map((s) => s.name) }, note: `"${name}" matched several schools; results include all of them.` };
  return { notFound: `No department or school matching "${name}" was found.` };
}

async function resolveOneResearcher(name) {
  const matches = await search.resolveResearchers(name, 5);
  if (!matches.length) return { notFound: `No researcher matching "${name}" was found.` };
  if (matches.length > 1) {
    const exact = matches.find((m) => m.name.toLowerCase().replace(/^(dr|prof)\.?\s+/i, '') === name.toLowerCase().replace(/^(dr|prof)\.?\s+/i, ''));
    if (!exact) return { ambiguous: matches.map((m) => ({ name: m.name, designation: m.designation, department: m.department })) };
    return { researcher: exact };
  }
  return { researcher: matches[0] };
}

/** First ~600 characters of an abstract, cut at a word boundary; undefined when there is none. */
const abstractExcerpt = (text, max = 600) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40))} …`;
};

/** Characters of abstract per paper so that a search result stays well under the tool-result cap. */
const abstractBudget = (count) => Math.max(400, Math.min(2500, Math.floor(6000 / Math.max(1, count))));

const pubOut = (sources, excerptMax = 600) => (p) => ({
  ref: sources.publication(p),
  title: p.title,
  authors: p.authors.slice(0, 5).join(', ') + (p.authors.length > 5 ? ' et al.' : ''),
  journal: p.journal,
  year: p.year,
  citations: p.citations,
  quartile: p.quartile,
  department: p.department,
  // What the paper itself says: lets the model summarise a paper without guessing its content.
  abstract_excerpt: abstractExcerpt(p.abstract, excerptMax),
  // text = full-text hit; keyword = indexed keyword the query names; taxonomy = under a category /
  // specialization the query names; related = topic that co-occurs with the query's keywords
  matched_via: p.matchedVia?.length ? p.matchedVia : undefined,
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'search_publications',
    label: (a) => (a.query ? `Searching publications for “${a.query}”` : 'Searching publications'),
    description:
      'Search the university\'s research publications (papers, conference papers, books, chapters) by topic and filters. ' +
      'Use for any question about specific papers, what has been published on a topic, recent or highly cited work, or a unit\'s output. ' +
      'The query is automatically expanded through the keyword index (incl. abbreviations), the research taxonomy and related topics; ' +
      'each paper says how it matched. Use "category" to restrict results to a research area of the taxonomy.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or keywords, e.g. "federated learning healthcare". Omit to list by filters only.' },
        category: { type: 'string', description: 'Restrict to a taxonomy area (domain, category or specialization), e.g. "Oral Pathology" or "Computer Vision"' },
        year_from: { type: 'integer', description: 'Earliest publication year' },
        year_to: { type: 'integer', description: 'Latest publication year' },
        department: { type: 'string', description: 'Department or school name / short name, e.g. "CSE" or "Faculty of Dental Sciences"' },
        author: { type: 'string', description: 'Name of an internal researcher' },
        quartiles: { type: 'array', items: { type: 'string', enum: search.QUARTILES }, description: 'Journal quartile filter' },
        publication_type: { type: 'string', enum: search.PUB_TYPES },
        sort: { type: 'string', enum: ['relevance', 'recent', 'citations'] },
        limit: { type: 'integer', description: '1-15, default 8' },
      },
    },
    async run(args, { tenantId, sources }) {
      const unit = await resolveUnit(str(args.department));
      if (unit.notFound) return { error: unit.notFound };
      let authorUserIds;
      if (str(args.author)) {
        const r = await resolveOneResearcher(str(args.author));
        if (r.notFound) return { error: r.notFound };
        if (r.ambiguous) return { ambiguous_author: r.ambiguous, hint: 'Ask the user which researcher they mean, or retry with a fuller name.' };
        authorUserIds = [r.researcher.id];
      }
      let taxonomyFilter;
      if (str(args.category)) {
        taxonomyFilter = await retrieval.resolveTaxonomyFilter(tenantId, str(args.category));
        if (!taxonomyFilter.names.length) return { error: `No research area matching "${str(args.category)}" exists in the taxonomy. Try explore_taxonomy, or search by query instead.` };
      }
      const { total, results, expansion } = await search.searchPublications(tenantId, {
        query: str(args.query, 300),
        taxonomy: taxonomyFilter,
        yearFrom: int(args.year_from, 1900, 2100),
        yearTo: int(args.year_to, 1900, 2100),
        departmentIds: unit.departmentIds,
        schoolIds: unit.schoolIds,
        authorUserIds,
        quartiles: Array.isArray(args.quartiles) ? args.quartiles : undefined,
        publicationType: args.publication_type,
        sort: args.sort,
        limit: int(args.limit, 1, 15) || 8,
      });
      const ex = expansion;
      const expandedWith = ex && (ex.aliases.length || ex.direct.length || ex.related.length || Object.values(ex.taxonomy).some((v) => v.length))
        ? {
          abbreviations: ex.aliases.length ? ex.aliases : undefined,
          keywords: ex.direct.length ? ex.direct.slice(0, 10) : undefined,
          taxonomy_areas: [...ex.taxonomy.specializations, ...ex.taxonomy.categories, ...ex.taxonomy.domains].slice(0, 8),
          related_topics: ex.related.length ? ex.related : undefined,
        }
        : undefined;
      return {
        total_matching: total,
        shown: results.length,
        scope: unit.unit || 'whole university',
        research_area: taxonomyFilter?.names,
        expanded_with: expandedWith,
        note: unit.note,
        // Abstract budget shared by the results: few papers get their whole abstract (a summary must not
        // stop before the part that says what the paper does), many papers get a short excerpt each.
        publications: results.map(pubOut(sources, abstractBudget(results.length))),
      };
    },
    summarize: (r) => (r.error ? r.error : `${r.total_matching ?? 0} matching publication(s)`),
  },
  {
    name: 'find_experts',
    label: (a) => `Finding experts on “${a.topic || 'topic'}”`,
    description:
      'Find the university researchers with the strongest expertise in a research topic, ranked by relevant publications, ' +
      'citations, recency and taxonomy expertise scores. Use for "who works on X", "experts in X", "whom should I collaborate with on X".',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic, e.g. "computer vision" or "dental implants"' },
        department: { type: 'string', description: 'Optional department to restrict to' },
        limit: { type: 'integer', description: '1-15, default 8' },
      },
      required: ['topic'],
    },
    async run(args, { tenantId, sources }) {
      const unit = await resolveUnit(str(args.department));
      if (unit.notFound) return { error: unit.notFound };
      const res = await graph.findExperts(tenantId, { topic: str(args.topic), departmentId: unit.departmentIds?.[0], limit: int(args.limit, 1, 15) || 8 });
      return {
        topic: res.topic,
        matched_taxonomy: res.matchedTaxonomy?.length ? res.matchedTaxonomy : undefined,
        scored_categories: res.matchedCategories,
        expanded_with: res.expandedWith || undefined,
        experts: res.experts.map((e) => ({
          ref: sources.researcher(e),
          name: e.name,
          designation: e.designation,
          department: e.department,
          expertise_score_0_100: e.expertiseScore || undefined,
          relevant_publications: e.matchingPublications,
          citations: e.citations,
          last_active_year: e.lastActiveYear,
          example_papers: e.samplePapers,
        })),
      };
    },
    summarize: (r) => (r.error ? r.error : `${r.experts?.length || 0} expert(s) found`),
  },
  {
    name: 'get_researcher_profile',
    label: (a) => `Looking up ${a.name || 'researcher'}`,
    description:
      'Get a researcher\'s research profile: metrics (publications, citations, h-index), main topics, keywords, top papers, yearly output, ' +
      'internal collaborators (frequent_collaborators) and ALL co-authors without an account here, including those at other institutions (co_authors). ' +
      'Use it for "who does X collaborate / work with (most)".',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'Researcher name, e.g. "Dr. Anita Sharma"' } }, required: ['name'] },
    async run(args, { tenantId, sources }) {
      const r = await resolveOneResearcher(str(args.name));
      if (r.notFound) return { error: r.notFound };
      if (r.ambiguous) return { ambiguous: r.ambiguous, hint: 'Several researchers match; ask the user which one.' };
      const p = await analytics.getResearcherProfile(tenantId, r.researcher.id);
      return {
        ref: sources.researcher(p.researcher),
        researcher: p.researcher,
        metrics: p.metrics || 'Metrics not computed yet (the intelligence pipeline has not run).',
        topics: p.topics.map((t) => ({ topic: t.category.name, domain: t.category.domain?.name, score_0_100: t.score, papers: t.pubCount, active: `${t.firstYear || '?'}-${t.lastYear || '?'}` })),
        keywords: p.keywords.map((k) => k.canonicalName),
        yearly_output: p.yearly,
        top_papers: p.topPapers.slice(0, 8).map((x) => ({ ref: sources.publication({ ...x, authors: [p.researcher.name] }), title: x.title, journal: x.journal, year: x.year, citations: x.citations, quartile: x.quartile })),
        frequent_collaborators: p.collaborators.slice(0, 8).map((c) => ({ name: c.name, department: c.department, shared_papers: c.sharedPapers })),
        // Co-authors without an account here: external partners, and colleagues whose affiliation on the
        // paper is this university but who are not linked to an account yet (same_university_affiliation).
        co_authors: (p.coAuthors || []).slice(0, 15).map((c) => ({ name: c.name, affiliation: c.affiliation, shared_papers: c.sharedPapers, same_university_affiliation: c.homeInstitution })),
      };
    },
    summarize: (r) => (r.error || (r.ambiguous ? 'Several researchers matched' : `Profile of ${r.researcher?.name}`)),
  },
  {
    name: 'get_collaborations',
    label: (a) => `Mapping collaborations${a.researcher ? ` of ${a.researcher}` : a.department ? ` in ${a.department}` : ''}`,
    description:
      'INTERNAL co-authorship network among the university\'s own researchers: who collaborates with whom (weighted by shared papers). ' +
      'Give a researcher for their network, or a department for its internal network. ' +
      'For collaboration with other institutions, countries, international co-authors or industry, use get_external_collaborations instead. ' +
      'For ONE researcher\'s co-authors (internal and external), use get_researcher_profile.',
    parameters: {
      type: 'object',
      properties: {
        researcher: { type: 'string', description: 'Researcher name for an ego network' },
        department: { type: 'string', description: 'Department or school name' },
      },
    },
    async run(args, { tenantId, sources }) {
      let userId;
      if (str(args.researcher)) {
        const r = await resolveOneResearcher(str(args.researcher));
        if (r.notFound) return { error: r.notFound };
        if (r.ambiguous) return { ambiguous: r.ambiguous };
        userId = r.researcher.id;
      }
      const unit = await resolveUnit(str(args.department));
      if (unit.notFound) return { error: unit.notFound };
      const net = await graph.getCollaborationNetwork(tenantId, { userId, departmentId: unit.departmentIds?.[0], schoolId: unit.schoolIds?.[0], limit: 30 });
      const nameById = new Map(net.nodes.map((n) => [n.id, n.name]));
      const edges = net.edges.sort((a, b) => b.weight - a.weight).slice(0, 25);
      return {
        researchers: net.nodes.slice(0, 20).map((n) => ({ ref: sources.researcher(n), name: n.name, department: n.department, papers: n.pubs, collaborators: n.collaborators, main_topic: n.primaryTopic })),
        strongest_links: edges.map((e) => ({ between: [nameById.get(e.source), nameById.get(e.target)], shared_papers: e.weight })),
      };
    },
    summarize: (r) => (r.error ? r.error : `${r.researchers?.length || 0} researchers, ${r.strongest_links?.length || 0} links`),
  },
  {
    name: 'get_external_collaborations',
    label: (a) => `Mapping external collaborations${a.department ? ` of ${a.department}` : ''}`,
    description:
      'EXTERNAL collaboration with other institutions: top partner institutions (universities, hospitals, companies) and their countries, ' +
      'international vs domestic co-authored papers, papers with international co-authors, industry collaborations, and which of the ' +
      'university\'s researchers collaborate externally most. Use for questions about external, international, foreign, global, industry ' +
      'or inter-institutional collaboration, partner institutions/universities/countries, or "who collaborates with external institutions". ' +
      'Counts approved/completed contributions only.',
    parameters: {
      type: 'object',
      properties: {
        department: { type: 'string', description: 'Optional department or school name to restrict to' },
        year_from: { type: 'integer', description: 'Earliest publication year' },
        year_to: { type: 'integer', description: 'Latest publication year' },
        limit: { type: 'integer', description: 'How many partners/researchers/papers to list, 1-25, default 10' },
      },
    },
    async run(args, { tenantId, sources }) {
      const unit = await resolveUnit(str(args.department));
      if (unit.notFound) return { error: unit.notFound };
      const res = await externalCollab.getExternalCollaborations(tenantId, {
        departmentIds: unit.departmentIds,
        schoolIds: unit.schoolIds,
        yearFrom: int(args.year_from, 1900, 2100),
        yearTo: int(args.year_to, 1900, 2100),
        limit: int(args.limit, 1, 25) || 10,
      });
      const paper = (p) => ({ ref: sources.publication(p), title: p.title, year: p.year, journal: p.journal, citations: p.citations, partners: p.partners.slice(0, 5), countries: p.countries });
      return {
        scope: unit.unit || 'whole university',
        note: unit.note,
        home_country: res.homeCountry,
        summary: res.summary,
        top_partner_institutions: res.partners.map((p) => ({ name: p.name, country: p.country || 'unknown', shared_papers: p.papers, international: p.international, industry: p.industry || undefined })),
        countries: res.countries.map((c) => ({ country: c.country, papers: c.papers, home: c.home || undefined })),
        researchers_with_most_external_collaboration: res.researchers.map((r) => ({
          ref: sources.researcher(r), name: r.name, designation: r.designation, department: r.department,
          external_papers: r.externalPapers, international_papers: r.internationalPapers, industry_papers: r.industryPapers || undefined, partners: r.partners,
        })),
        papers_with_international_coauthors: res.internationalPapers.map(paper),
        industry_collaborations: res.industryPapers.map(paper),
        data_note: res.summary.papers_with_external_collaboration === 0
          ? 'No approved/completed contributions record external co-authors, partner affiliations or collaboration flags for this scope.'
          : res.truncated ? 'Very large result; only the most cited contributions were analysed.' : undefined,
      };
    },
    summarize: (r) => (r.error ? r.error : `${r.summary?.partner_institutions ?? 0} partner institution(s), ${r.summary?.papers_with_external_collaboration ?? 0} paper(s)`),
  },
  {
    name: 'get_trending_topics',
    label: () => 'Analysing research trends',
    description: 'Trending research topics at the university ranked by momentum (recency-weighted output), with growth rates, plus newly emerging topics.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', description: '1-20, default 12' } } },
    async run(args) {
      const { trending, emerging } = await analytics.getTrendingKeywords({ limit: int(args.limit, 1, 20) || 12 });
      return {
        trending: trending.map((k) => ({ topic: k.canonicalName, publications: k.publicationCount, researchers: k.researcherCount, growth_pct_2y: k.growthRate === null ? 'new' : Math.round(k.growthRate), yearly: k.yearlyVolume })),
        emerging: emerging.map((k) => ({ topic: k.canonicalName, publications: k.publicationCount, since: k.firstSeenYear })),
      };
    },
    summarize: (r) => `${r.trending?.length || 0} trending, ${r.emerging?.length || 0} emerging topics`,
  },
  {
    name: 'get_research_overview',
    label: (a) => `Summarising research${a.unit ? ` in ${a.unit}` : ''}`,
    description: 'Aggregate research statistics for the whole university or one department/school: totals, citations, quartiles, yearly trend, top journals, top topics and top researchers.',
    parameters: { type: 'object', properties: { unit: { type: 'string', description: 'Department or school; omit for the whole university' } } },
    async run(args, { tenantId, sources }) {
      const name = str(args.unit);
      let data;
      let scope = 'whole university';
      if (name) {
        const unit = await resolveUnit(name);
        if (unit.notFound) return { error: unit.notFound };
        if (unit.departmentIds?.length > 1 || unit.schoolIds?.length > 1) return { ambiguous: unit.unit, hint: 'Ask which unit the user means.' };
        data = await analytics.getUnitAnalytics(tenantId, { departmentId: unit.departmentIds?.[0], schoolId: unit.schoolIds?.[0] });
        scope = data.unit;
      } else {
        data = await analytics.getOverview(tenantId);
      }
      return {
        scope,
        totals: data.totals,
        yearly: data.yearly,
        by_quartile: data.byQuartile,
        by_type: data.byType,
        top_journals: data.topJournals.slice(0, 6),
        top_topics: data.topTopics.slice(0, 10).map((t) => t.name),
        top_researchers: data.topResearchers.slice(0, 6).map((r) => ({ ref: sources.researcher(r), name: r.name, department: r.department, publications: r.publications, citations: r.citations })),
        top_departments: data.departments?.slice(0, 8),
        research_domains: data.domains?.slice(0, 10).map((d) => ({ domain: d.name, publications: d.publicationCount, researchers: d.researcherCount })),
      };
    },
    summarize: (r) => (r.error ? r.error : `${r.totals?.publications ?? 0} publications`),
  },
  {
    name: 'compare_units',
    label: (a) => `Comparing ${(a.units || []).join(' vs ')}`,
    description: 'Compare 2-4 departments or schools side by side on output, citations, quality, topics and leading researchers.',
    parameters: {
      type: 'object',
      properties: { units: { type: 'array', items: { type: 'string' }, description: 'Department or school names, e.g. ["CSE", "ECE"]' } },
      required: ['units'],
    },
    async run(args, { tenantId }) {
      const names = (Array.isArray(args.units) ? args.units : []).map((u) => str(u)).filter(Boolean).slice(0, 4);
      if (names.length < 2) return { error: 'Provide at least two units to compare.' };
      const units = [];
      const problems = [];
      for (const n of names) {
        const u = await resolveUnit(n);
        if (u.notFound || u.departmentIds?.length > 1 || u.schoolIds?.length > 1) problems.push(u.notFound || `"${n}" is ambiguous`);
        else units.push({ departmentId: u.departmentIds?.[0], schoolId: u.schoolIds?.[0] });
      }
      if (units.length < 2) return { error: problems.join(' ') };
      const cmp = await analytics.compareUnits(tenantId, units);
      return {
        problems: problems.length ? problems : undefined,
        comparison: cmp.map((c) => ({
          unit: c.unit.name,
          totals: c.totals,
          yearly: c.yearly,
          top_topics: c.topTopics.map((t) => t.name),
          topic_concentration_0_1: c.topicConcentration,
          leading_researchers: c.topResearchers.map((r) => r.name),
        })),
      };
    },
    summarize: (r) => (r.error ? r.error : `Compared ${r.comparison?.length} units`),
  },
  {
    name: 'explore_taxonomy',
    label: () => 'Exploring research domains',
    description: 'The university\'s research landscape as a 3-level taxonomy: domains → categories → specializations, with publication counts and leading researchers. Use for "what are our research strengths", "which areas", "research domains", "what sub-areas exist in X".',
    parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Optional domain or category name to focus on' } } },
    async run(args, { sources }) {
      const focus = str(args.domain).toLowerCase();
      let map = await graph.getDomainMap();
      if (focus) {
        map = map
          .map((d) => (d.name.toLowerCase().includes(focus) ? d : { ...d, categories: d.categories.filter((c) => c.name.toLowerCase().includes(focus) || c.specializations?.some((sp) => sp.name.toLowerCase().includes(focus))) }))
          .filter((d) => d.categories.length || d.name.toLowerCase().includes(focus));
      }
      if (!map.length) {
        const tree = await taxonomy.getTree({ includeProposed: false });
        return { note: 'No classified publications yet for this area.', domains: tree.map((d) => ({ domain: d.name, categories: d.categories.map((c) => c.name) })) };
      }
      return {
        domains: map.slice(0, focus ? 3 : 12).map((d) => ({
          domain: d.name,
          publications: d.publicationCount,
          researchers: d.researcherCount,
          categories: d.categories.slice(0, focus ? 15 : 6).map((c) => ({
            category: c.name,
            publications: c.publicationCount,
            specializations: (c.specializations || []).slice(0, focus ? 12 : 4).map((sp) => ({ name: sp.name, publications: sp.publicationCount })),
            leaders: c.leaders.map((l) => ({ ref: sources.researcher(l), name: l.name })),
          })),
        })),
      };
    },
    summarize: (r) => `${r.domains?.length || 0} domain(s)`,
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Declarations for the provider (name/description/parameters only). */
const declarations = () => TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));

/** Execute a tool call, never throwing: errors become a result the model can react to. */
async function execute(name, rawArgs, ctx) {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) return { result: { error: `Unknown tool ${name}` }, summary: 'Unknown tool', label: name };
  // Models may send null for an optional argument they mean to leave out.
  const args = Object.fromEntries(Object.entries(rawArgs || {}).filter(([, v]) => v !== null));
  const label = tool.label(args || {});
  try {
    const result = await tool.run(args || {}, ctx);
    return { result, summary: tool.summarize(result), label };
  } catch (err) {
    return { result: { error: `Lookup failed: ${err.message}` }, summary: 'Lookup failed', label, failed: true };
  }
}

module.exports = { declarations, execute, SourceRegistry, TOOLS, abstractExcerpt, abstractBudget };
