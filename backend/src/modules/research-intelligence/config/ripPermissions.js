/**
 * Research Intelligence permission keys and role templates.
 *
 * Access model (see services/access.service.js): inside a university that has the module enabled,
 * administrators have every capability; everyone else gets them from ROLES (the university's
 * reusable permission templates, assigned to employees) plus optional individual extra grants.
 * The keys appear in the Roles editor under the "Research Intelligence" category.
 */

'use strict';

const RIP_PERMISSION_DEFINITIONS = [
  { key: 'rip_access_research_gpt', label: 'AI Research Assistant', group: 'Use', description: 'Ask the AI assistant about publications, experts, topics and trends.' },
  { key: 'rip_view_overview', label: 'Overview dashboard', group: 'Use', description: 'University-wide output, impact, domains and trends.' },
  { key: 'rip_view_keyword_intelligence', label: 'Keywords & trends', group: 'Use', description: 'Research keywords, trending and emerging topics.' },
  { key: 'rip_view_taxonomy', label: 'Research taxonomy', group: 'Use', description: 'Browse domains, categories and specializations.' },
  { key: 'rip_view_knowledge_graph', label: 'Knowledge graph & experts', group: 'Use', description: 'Collaboration and topic networks; find experts.' },
  { key: 'rip_view_citation_analytics', label: 'Department & researcher analytics', group: 'Use', description: 'Analytics for any department, school or researcher.' },
  { key: 'rip_manage_taxonomy', label: 'Manage taxonomy & indexing', group: 'Manage', description: 'Edit the taxonomy, review AI classifications, run the index.' },
  { key: 'rip_manage_access', label: 'Manage user access', group: 'Manage', description: 'Assign Research Intelligence roles and extra access to other users.' },
];

const ALL_RIP_PERMISSION_KEYS = RIP_PERMISSION_DEFINITIONS.map((p) => p.key);

/**
 * Starting points for creating a real Role in the university (editable afterwards on the Roles page).
 * Access management is never part of a template.
 */
const RIP_TEMPLATES = [
  { key: 'assistant', label: 'Assistant', description: 'Can use the AI research assistant.', permissions: ['rip_access_research_gpt'] },
  {
    key: 'explorer',
    label: 'Explorer',
    description: 'Assistant plus topics, taxonomy, knowledge graph and experts.',
    permissions: ['rip_access_research_gpt', 'rip_view_keyword_intelligence', 'rip_view_taxonomy', 'rip_view_knowledge_graph'],
  },
  {
    key: 'analyst',
    label: 'Analyst',
    description: 'Explorer plus the overview dashboard and department/researcher analytics.',
    permissions: ['rip_access_research_gpt', 'rip_view_keyword_intelligence', 'rip_view_taxonomy', 'rip_view_knowledge_graph', 'rip_view_overview', 'rip_view_citation_analytics'],
  },
  {
    key: 'curator',
    label: 'Curator',
    description: 'Analyst plus managing the taxonomy and re-indexing.',
    permissions: ['rip_access_research_gpt', 'rip_view_keyword_intelligence', 'rip_view_taxonomy', 'rip_view_knowledge_graph', 'rip_view_overview', 'rip_view_citation_analytics', 'rip_manage_taxonomy'],
  },
];

/** Entries for the Roles editor (DRD central-department permission list). */
const RIP_DRD_PERMISSION_ENTRIES = RIP_PERMISSION_DEFINITIONS.map((p) => ({
  key: p.key,
  label: `Research Intelligence: ${p.label}`,
  category: 'Research Intelligence',
  type: p.group === 'Manage' ? 'action' : 'view',
  description: p.description,
}));

module.exports = { RIP_PERMISSION_DEFINITIONS, ALL_RIP_PERMISSION_KEYS, RIP_TEMPLATES, RIP_DRD_PERMISSION_ENTRIES };
