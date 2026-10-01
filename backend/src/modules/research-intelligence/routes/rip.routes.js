/**
 * Research Intelligence routes — mounted at /api/v1/research-intelligence
 *
 * All routes require authentication and a tenant (superadmins pick one with x-university-id).
 * Every route except /access/me also requires the university to have the module enabled, then a
 * per-user capability (rip_* key) — see services/access.service.js.
 * Platform (superadmin) routes live in platform.routes.js.
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../../../shared/middleware/auth');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ctrl = require('../controllers/rip.controller');
const accessCtrl = require('../controllers/access.controller');
const { requireModule, requireCapability } = require('../services/access.service');

const router = express.Router();
const h = asyncHandler;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_QUERY_KEYS = ['roleId', 'userId', 'departmentId', 'schoolId', 'categoryId', 'domainId', 'specializationId', 'authorId'];

const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({ success: false, message: 'Select a university to use Research Intelligence.' });
  }
  next();
};

/** Reject malformed ids before they reach raw SQL casts. */
const validateIds = (req, res, next) => {
  for (const [k, v] of Object.entries(req.params)) {
    if (k.endsWith('Id') && !UUID_RE.test(v)) return res.status(400).json({ success: false, message: `Invalid ${k}` });
  }
  for (const k of UUID_QUERY_KEYS) {
    const v = req.query[k];
    if (v !== undefined && !String(v).split(',').every((x) => UUID_RE.test(x.trim()))) {
      return res.status(400).json({ success: false, message: `Invalid ${k}` });
    }
  }
  next();
};

const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.RIP_CHAT_RATE_LIMIT) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `rip-chat:${req.user?.id}`,
  message: { success: false, message: 'Too many questions in a short time. Please wait a few minutes.' },
});

const perm = requireCapability;
const VIEW_OVERVIEW = perm('rip_view_overview');
const VIEW_KEYWORDS = perm('rip_view_keyword_intelligence');
const VIEW_TAXONOMY = perm('rip_view_taxonomy');
const MANAGE = perm('rip_manage_taxonomy');
const VIEW_GRAPH = perm('rip_view_knowledge_graph');
const VIEW_ANALYTICS = perm('rip_view_citation_analytics');
const CHAT = perm('rip_access_research_gpt');
const MANAGE_ACCESS = perm('rip_manage_access');

router.use(protect, requireTenant);
// Query-string ids are checked for every route; path ids per route (params exist only after matching).
router.use(validateIds);

// Own access — answers even when the module is disabled, so the UI can explain why.
router.get('/access/me', h(accessCtrl.getMyAccess));

// Everything below needs the module enabled for the university.
router.use(requireModule);

// Status & self-service (any user of an enabled university)
router.get('/status', h(ctrl.getStatus));
router.get('/analytics/me', h(ctrl.getResearcherAnalytics));

// Analytics
router.get('/analytics/overview', VIEW_OVERVIEW, h(ctrl.getOverview));
router.get('/analytics/departments/:departmentId', VIEW_ANALYTICS, validateIds, h(ctrl.getDepartmentAnalytics));
router.get('/analytics/schools/:schoolId', VIEW_ANALYTICS, validateIds, h(ctrl.getSchoolAnalytics));
router.get('/analytics/researchers/:userId', VIEW_ANALYTICS, validateIds, h(ctrl.getResearcherAnalytics));
router.post('/analytics/compare', VIEW_ANALYTICS, h(ctrl.compareUnits));

// Keywords
router.get('/keywords', VIEW_KEYWORDS, h(ctrl.listKeywords));
router.get('/keywords/trending', VIEW_KEYWORDS, h(ctrl.getTrending));
router.get('/keywords/kpis', VIEW_KEYWORDS, h(ctrl.getKeywordKpis));
router.get('/keywords/:keywordId/cooccurrences', VIEW_KEYWORDS, validateIds, h(ctrl.getCooccurrences));
router.delete('/keywords/:keywordId', MANAGE, validateIds, h(ctrl.deleteKeyword));

// Taxonomy
router.get('/taxonomy', VIEW_TAXONOMY, h(ctrl.getTaxonomy));
router.post('/taxonomy/domains', MANAGE, h(ctrl.createDomain));
router.patch('/taxonomy/domains/:domainId', MANAGE, validateIds, h(ctrl.updateDomain));
router.post('/taxonomy/categories', MANAGE, h(ctrl.createCategory));
router.patch('/taxonomy/categories/:categoryId', MANAGE, validateIds, h(ctrl.updateCategory));
router.post('/taxonomy/categories/:categoryId/merge', MANAGE, validateIds, h(ctrl.mergeCategory));
router.post('/taxonomy/specializations', MANAGE, h(ctrl.createSpecialization));
router.post('/taxonomy/keywords/:keywordId/assign', MANAGE, validateIds, h(ctrl.assignKeyword));
router.delete('/taxonomy/keywords/:keywordId/assign/:categoryId', MANAGE, validateIds, h(ctrl.unassignKeyword));
router.get('/taxonomy/review', MANAGE, h(ctrl.getReviewQueue));
router.post('/taxonomy/review', MANAGE, h(ctrl.applyReview));

// Knowledge graph & search
router.get('/graph/collaboration', VIEW_GRAPH, h(ctrl.getCollaborationNetwork));
router.get('/graph/keywords', VIEW_GRAPH, h(ctrl.getKeywordNetwork));
router.get('/graph/experts', VIEW_GRAPH, h(ctrl.findExperts));
router.get('/graph/domain-map', VIEW_GRAPH, h(ctrl.getDomainMap));
router.get('/search/publications', VIEW_OVERVIEW, h(ctrl.searchPublications));
router.get('/search/entities', VIEW_OVERVIEW, h(ctrl.searchEntities));

// Pipeline
router.get('/pipeline/runs', MANAGE, h(ctrl.listPipelineRuns));
router.post('/pipeline/runs', MANAGE, h(ctrl.startPipeline));

// Access management (university admins): role templates assigned to people, plus individual extras
router.get('/access', MANAGE_ACCESS, h(accessCtrl.getOverview));
router.get('/access/users', MANAGE_ACCESS, h(accessCtrl.listUsers));
router.post('/access/roles/from-template', MANAGE_ACCESS, h(accessCtrl.createRoleFromTemplate));
router.post('/access/bulk-roles', MANAGE_ACCESS, h(accessCtrl.bulkRoles));
router.put('/access/users/:userId/roles', MANAGE_ACCESS, validateIds, h(accessCtrl.setUserRoles));
router.put('/access/users/:userId', MANAGE_ACCESS, validateIds, h(accessCtrl.setUserGrant));
router.delete('/access/users/:userId', MANAGE_ACCESS, validateIds, h(accessCtrl.removeUserGrant));

// AI research assistant
router.get('/chat/sessions', CHAT, h(ctrl.listChatSessions));
router.post('/chat/sessions', CHAT, h(ctrl.createChatSession));
router.patch('/chat/sessions/:sessionId', CHAT, validateIds, h(ctrl.updateChatSession));
router.delete('/chat/sessions/:sessionId', CHAT, validateIds, h(ctrl.deleteChatSession));
router.get('/chat/sessions/:sessionId/messages', CHAT, validateIds, h(ctrl.getChatMessages));
router.post('/chat/sessions/:sessionId/messages', CHAT, validateIds, chatLimiter, h(ctrl.sendChatMessage));
router.post('/chat/messages/:messageId/feedback', CHAT, validateIds, h(ctrl.setMessageFeedback));

module.exports = router;
