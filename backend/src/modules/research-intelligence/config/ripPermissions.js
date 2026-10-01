/**
 * Research Intelligence permission keys and presets.
 *
 * Access is user-wise: inside a university that has the module enabled, administrators have
 * every capability and everyone else holds exactly the keys granted to them individually
 * (see services/access.service.js). These keys are deliberately NOT part of the generic
 * department/role permission system.
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
  { key: 'rip_manage_access', label: 'Manage user access', group: 'Manage', description: 'Grant or remove Research Intelligence access for other users.' },
];

const ALL_RIP_PERMISSION_KEYS = RIP_PERMISSION_DEFINITIONS.map((p) => p.key);

/** Ready-made bundles shown in the access UI. Access management is never part of a preset. */
const RIP_PRESETS = [
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

module.exports = { RIP_PERMISSION_DEFINITIONS, ALL_RIP_PERMISSION_KEYS, RIP_PRESETS };
