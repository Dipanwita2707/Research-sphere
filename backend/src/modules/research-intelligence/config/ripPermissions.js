/**
 * Research Intelligence permission keys.
 *
 * Effective access = the university has the module enabled (superadmin switch, see
 * services/access.service.js) AND the user holds the key through any of: admin role, a direct
 * per-user grant, a DRD / role permission assignment, or the university's role defaults.
 * Keys match the reference implementation so existing assignments carry over.
 */

'use strict';

const RIP_PERMISSION_DEFINITIONS = [
  { key: 'rip_view_overview', label: 'Research Intelligence: Overview', type: 'view', description: 'View the institutional research intelligence dashboard (output, impact, domains, trends).' },
  { key: 'rip_view_keyword_intelligence', label: 'Research Intelligence: Keywords & Trends', type: 'view', description: 'View research keywords, trending and emerging topics, and topic co-occurrence.' },
  { key: 'rip_view_taxonomy', label: 'Research Intelligence: View Taxonomy', type: 'view', description: 'Browse the research taxonomy (domains, categories, specializations).' },
  { key: 'rip_manage_taxonomy', label: 'Research Intelligence: Manage Taxonomy & Pipeline', type: 'action', description: 'Edit the taxonomy, review AI classifications, and run the intelligence pipeline.' },
  { key: 'rip_view_knowledge_graph', label: 'Research Intelligence: Knowledge Graph & Experts', type: 'view', description: 'Explore collaboration and topic networks and find experts.' },
  { key: 'rip_view_citation_analytics', label: 'Research Intelligence: Unit & Researcher Analytics', type: 'view', description: 'View analytics for any department, school or researcher.' },
  { key: 'rip_manage_access', label: 'Research Intelligence: Manage User Access', type: 'action', description: 'Grant or revoke Research Intelligence capabilities for individual users and set role defaults.' },
  { key: 'rip_access_research_gpt', label: 'Research Intelligence: AI Research Assistant', type: 'action', description: 'Use the AI research assistant to query institutional research.' },
];

const RIP_PERMISSIONS = {
  RIP_CORE: {
    category: 'Research Intelligence',
    permissions: Object.fromEntries(RIP_PERMISSION_DEFINITIONS.map((p) => [p.key, { key: p.key, label: p.label, description: p.description }])),
  },
};

const ALL_RIP_PERMISSION_KEYS = RIP_PERMISSION_DEFINITIONS.map((p) => p.key);

const allTrue = Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, true]));

/** Role defaults merged into getDefaultPermissions(). */
const RIP_ROLE_DEFAULTS = { admin: allTrue, superadmin: allTrue };

/** Keys a university can hand out through role defaults (access management stays explicit). */
const RIP_ROLE_DEFAULTABLE_KEYS = ALL_RIP_PERMISSION_KEYS.filter((k) => k !== 'rip_manage_access');

/** Entries for the central-department permission picker (DRD). */
const RIP_DRD_PERMISSION_ENTRIES = RIP_PERMISSION_DEFINITIONS.map((p) => ({ ...p, category: 'Research Intelligence' }));

module.exports = { RIP_PERMISSIONS, ALL_RIP_PERMISSION_KEYS, RIP_ROLE_DEFAULTABLE_KEYS, RIP_ROLE_DEFAULTS, RIP_DRD_PERMISSION_ENTRIES, RIP_PERMISSION_DEFINITIONS };
