/**
 * Research Intelligence controllers.
 * Services are tenant-scoped by tenantExtension; raw-SQL services also receive req.tenantId.
 */

'use strict';

const { ValidationError } = require('../../../shared/utils/AppError');
const ai = require('../services/ai/aiProvider');
const analytics = require('../services/analytics.service');
const graph = require('../services/graph.service');
const search = require('../services/search.service');
const taxonomy = require('../services/taxonomy.service');
const pipeline = require('../services/pipeline.service');
const chat = require('../services/chat/chat.service');
const queue = require('../../../jobs/researchIntelligenceQueue');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : undefined);

// ─── Status ───────────────────────────────────────────────────────────────────

const getStatus = async (req, res) => {
  const [lastRun, keywordKpis] = await Promise.all([
    pipeline.listRuns(1).then((r) => r[0] || null),
    analytics.getKeywordKpis(),
  ]);
  ok(res, {
    ai: ai.status(),
    lastRun,
    keywords: keywordKpis,
    permissions: req.ripAccess.permissions,
  });
};

// ─── Analytics ────────────────────────────────────────────────────────────────

const getOverview = async (req, res) => ok(res, await analytics.getOverview(req.tenantId));
const getDepartmentAnalytics = async (req, res) => ok(res, await analytics.getUnitAnalytics(req.tenantId, { departmentId: req.params.departmentId }));
const getSchoolAnalytics = async (req, res) => ok(res, await analytics.getUnitAnalytics(req.tenantId, { schoolId: req.params.schoolId }));
const getResearcherAnalytics = async (req, res) => ok(res, await analytics.getResearcherProfile(req.tenantId, req.params.userId || req.user.id));

const compareUnits = async (req, res) => {
  const units = (Array.isArray(req.body?.units) ? req.body.units : [])
    .map((u) => (u?.departmentId ? { departmentId: String(u.departmentId) } : u?.schoolId ? { schoolId: String(u.schoolId) } : null))
    .filter(Boolean);
  if (units.length < 2 || units.length > 4) throw new ValidationError('Provide 2-4 units ({ departmentId } or { schoolId })');
  ok(res, await analytics.compareUnits(req.tenantId, units));
};

// ─── Keywords ─────────────────────────────────────────────────────────────────

const listKeywords = async (req, res) => ok(res, await analytics.listKeywords(req.query));
const getTrending = async (req, res) => ok(res, await analytics.getTrendingKeywords({ limit: req.query.limit, minPubs: req.query.minPubs }));
const getKeywordKpis = async (req, res) => ok(res, await analytics.getKeywordKpis());
const getCooccurrences = async (req, res) => ok(res, await graph.getKeywordCooccurrences(req.tenantId, req.params.keywordId, req.query.limit));
const deleteKeyword = async (req, res) => {
  await taxonomy.deleteKeyword(req.params.keywordId);
  ok(res, { deleted: true });
};

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

const getTaxonomy = async (req, res) => {
  await taxonomy.ensureSeeded();
  ok(res, await taxonomy.getTree({ includeRetired: req.query.includeRetired === 'true', includeProposed: req.query.includeProposed !== 'false' }));
};
const createDomain = async (req, res) => ok(res, await taxonomy.createDomain(req.body), 201);
const updateDomain = async (req, res) => ok(res, await taxonomy.updateDomain(req.params.domainId, req.body));
const createCategory = async (req, res) => ok(res, await taxonomy.createCategory(req.body), 201);
const updateCategory = async (req, res) => ok(res, await taxonomy.updateCategory(req.params.categoryId, req.body));
const mergeCategory = async (req, res) => ok(res, await taxonomy.mergeCategories(req.params.categoryId, req.body?.intoCategoryId));
const createSpecialization = async (req, res) => ok(res, await taxonomy.createSpecialization(req.body), 201);
const assignKeyword = async (req, res) => ok(res, await taxonomy.assignKeyword(req.params.keywordId, req.body?.categoryId, { isPrimary: req.body?.isPrimary !== false, specializationId: req.body?.specializationId || null }));
const unassignKeyword = async (req, res) => ok(res, await taxonomy.unassignKeyword(req.params.keywordId, req.params.categoryId));
const getReviewQueue = async (req, res) => ok(res, await taxonomy.getReviewQueue({ limit: req.query.limit }));
const applyReview = async (req, res) => ok(res, await taxonomy.applyReview(req.body || {}));

// ─── Graph & search ───────────────────────────────────────────────────────────

const getCollaborationNetwork = async (req, res) =>
  ok(res, await graph.getCollaborationNetwork(req.tenantId, { userId: req.query.userId, departmentId: req.query.departmentId, schoolId: req.query.schoolId, limit: req.query.limit }));
const getKeywordNetwork = async (req, res) =>
  ok(res, await graph.getKeywordNetwork(req.tenantId, { categoryId: req.query.categoryId, limit: req.query.limit, minWeight: req.query.minWeight }));
const findExperts = async (req, res) =>
  ok(res, await graph.findExperts(req.tenantId, { topic: req.query.topic, categoryId: req.query.categoryId, domainId: req.query.domainId, departmentId: req.query.departmentId, limit: req.query.limit }));
const getDomainMap = async (req, res) => ok(res, await graph.getDomainMap({ schoolId: req.query.schoolId }));

const searchPublications = async (req, res) =>
  ok(res, await search.searchPublications(req.tenantId, {
    query: req.query.q,
    yearFrom: req.query.yearFrom,
    yearTo: req.query.yearTo,
    departmentIds: csv(req.query.departmentId),
    schoolIds: csv(req.query.schoolId),
    authorUserIds: csv(req.query.authorId),
    quartiles: csv(req.query.quartile),
    taxonomy: { domainIds: csv(req.query.domainId), categoryIds: csv(req.query.categoryId), specializationIds: csv(req.query.specializationId) },
    expand: req.query.expand !== 'false',
    publicationType: req.query.type,
    sort: req.query.sort,
    limit: req.query.limit,
  }));

const searchEntities = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return ok(res, { departments: [], schools: [], researchers: [], keywords: [], categories: [] });
  const [departments, schools, researchers, keywords, categories] = await Promise.all([
    search.resolveDepartments(q, 5),
    search.resolveSchools(q, 5),
    search.resolveResearchers(q, 8),
    search.resolveKeywords(q, 8),
    search.resolveCategories(q, 5),
  ]);
  ok(res, { departments, schools, researchers, keywords, categories });
};

// ─── Pipeline ─────────────────────────────────────────────────────────────────

const startPipeline = async (req, res) => {
  const options = {
    rebuild: req.body?.rebuild === true,
    useAi: req.body?.useAi !== false,
    skipClassification: req.body?.skipClassification === true,
    maxKeywords: Math.min(Number(req.body?.maxKeywords) || 1500, 5000),
    trigger: 'manual',
  };
  const run = await pipeline.createRun({ triggeredById: req.user.id, options });
  const { mode } = await queue.enqueueRun(req.tenantId, run.id, options);
  ok(res, { ...run, mode }, 202);
};
const listPipelineRuns = async (req, res) => ok(res, await pipeline.listRuns(req.query.limit));

// ─── Chat ─────────────────────────────────────────────────────────────────────

const listChatSessions = async (req, res) => ok(res, await chat.listSessions(req.user.id, { search: req.query.search, limit: req.query.limit }));
const createChatSession = async (req, res) => ok(res, await chat.createSession(req.user.id, req.body?.title), 201);
const updateChatSession = async (req, res) => ok(res, await chat.updateSession(req.params.sessionId, req.user.id, { title: req.body?.title, pinned: req.body?.pinned }));
const deleteChatSession = async (req, res) => {
  await chat.deleteSession(req.params.sessionId, req.user.id);
  ok(res, { deleted: true });
};
const getChatMessages = async (req, res) => ok(res, await chat.getMessages(req.params.sessionId, req.user.id));
const setMessageFeedback = async (req, res) => ok(res, await chat.setFeedback(req.params.messageId, req.user.id, Number(req.body?.value)));

/** Stream an answer as Server-Sent Events. Errors before the first event become normal JSON errors. */
const sendChatMessage = async (req, res) => {
  const controller = new AbortController();
  let started = false;
  let heartbeat;
  const startStream = () => {
    if (started) return;
    started = true;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform stops the global compression middleware from buffering the stream
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    heartbeat = setInterval(() => {
      res.write(': ping\n\n');
      res.flush?.();
    }, 15000);
  };
  const emit = (event, data) => {
    if (res.writableEnded || controller.signal.aborted) return;
    startStream();
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    res.flush?.();
  };
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    await chat.streamReply({ sessionId: req.params.sessionId, user: req.user, tenantId: req.tenantId, message: req.body?.message, emit, signal: controller.signal });
  } catch (err) {
    if (!started) throw err;
    emit('error', { message: err.isOperational ? err.message : 'Something went wrong while answering.' });
  } finally {
    clearInterval(heartbeat);
    if (started && !res.writableEnded) res.end();
  }
};

module.exports = {
  getStatus,
  getOverview,
  getDepartmentAnalytics,
  getSchoolAnalytics,
  getResearcherAnalytics,
  compareUnits,
  listKeywords,
  getTrending,
  getKeywordKpis,
  getCooccurrences,
  deleteKeyword,
  getTaxonomy,
  createDomain,
  updateDomain,
  createCategory,
  updateCategory,
  mergeCategory,
  createSpecialization,
  assignKeyword,
  unassignKeyword,
  getReviewQueue,
  applyReview,
  getCollaborationNetwork,
  getKeywordNetwork,
  findExperts,
  getDomainMap,
  searchPublications,
  searchEntities,
  startPipeline,
  listPipelineRuns,
  listChatSessions,
  createChatSession,
  updateChatSession,
  deleteChatSession,
  getChatMessages,
  setMessageFeedback,
  sendChatMessage,
};
