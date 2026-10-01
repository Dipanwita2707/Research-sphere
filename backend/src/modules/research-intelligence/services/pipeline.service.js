/**
 * Intelligence pipeline — Research Intelligence
 *
 * One run rebuilds a tenant's intelligence layer, in order:
 *   taxonomy seed → keyword extraction → keyword metrics → AI classification (domain → category →
 *   specialization) → specialization refinement → taxonomy stats → expertise profiles
 *
 * Progress, per-stage stats and errors are recorded on RipPipelineRun so the UI can show
 * live status. Must run inside a tenant context (see jobs/researchIntelligenceQueue.js).
 */

'use strict';

const prisma = require('../../../shared/config/database');
const { ConflictError } = require('../../../shared/utils/AppError');
const { createModuleLogger } = require('../../../shared/utils/logger');
const keywords = require('./keywordExtraction.service');
const taxonomy = require('./taxonomy.service');
const expertise = require('./expertise.service');
const ai = require('./ai/aiProvider');

const log = createModuleLogger('rip:pipeline');

/** [stage, share of overall progress] */
const STAGES = [
  ['taxonomy_seed', 2],
  ['keywords', 35],
  ['keyword_metrics', 8],
  ['classification', 25],
  ['specializations', 10],
  ['taxonomy_stats', 5],
  ['expertise', 15],
];

const STALE_RUN_MS = 3 * 3600 * 1000;

/** Create a queued run, refusing when one is already active for the tenant. */
async function createRun({ triggeredById = null, options = {} } = {}) {
  const active = await prisma.ripPipelineRun.findFirst({
    where: { status: { in: ['queued', 'running'] }, createdAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
  });
  if (active) throw new ConflictError('An intelligence pipeline run is already in progress for this university');
  return prisma.ripPipelineRun.create({ data: { triggeredById, options, status: 'queued' } });
}

/**
 * Execute a run.
 * @param {string} tenantId
 * @param {string} runId
 * @param {object} options { rebuild?, useAi?, maxKeywords?, skipClassification? }
 */
async function execute(tenantId, runId, options = {}) {
  const stats = {};
  let done = 0;
  const update = (data) => prisma.ripPipelineRun.update({ where: { id: runId }, data }).catch((e) => log.warn('Run update failed', { error: e.message }));

  await update({ status: 'running', startedAt: new Date(), progress: 0 });
  const useAi = options.useAi !== false && ai.isConfigured();

  try {
    for (const [stage, weight] of STAGES) {
      let lastWrite = 0;
      const onProgress = (pct) => {
        // Throttle progress writes to at most one every 2 seconds.
        if (Date.now() - lastWrite < 2000) return;
        lastWrite = Date.now();
        update({ progress: Math.min(99, Math.round(done + (weight * pct) / 100)) });
      };
      await update({ stage, progress: Math.round(done) });
      const started = Date.now();

      switch (stage) {
        case 'taxonomy_seed':
          stats.taxonomySeeded = await taxonomy.ensureSeeded();
          break;
        case 'keywords':
          stats.keywords = await keywords.extractForTenant({ tenantId, rebuild: !!options.rebuild, useAi, onProgress });
          break;
        case 'keyword_metrics':
          stats.keywordMetrics = await keywords.recomputeKeywordMetrics(tenantId);
          break;
        case 'classification':
          stats.classification = useAi && !options.skipClassification
            ? await taxonomy.classifyKeywords({ maxKeywords: Number(options.maxKeywords) || 1500, onProgress })
            : { skipped: true, reason: useAi ? 'Skipped by request' : 'No AI provider configured' };
          break;
        case 'specializations':
          stats.specializations = useAi && !options.skipClassification
            ? await taxonomy.refineSpecializations({ maxKeywords: Number(options.maxKeywords) || 1500, onProgress })
            : { skipped: true, reason: useAi ? 'Skipped by request' : 'No AI provider configured' };
          break;
        case 'taxonomy_stats':
          await taxonomy.recomputeTaxonomyStats(tenantId);
          break;
        case 'expertise':
          stats.expertise = await expertise.computeForTenant(tenantId, { onProgress });
          break;
        default:
          break;
      }
      stats.timings = { ...(stats.timings || {}), [stage]: Date.now() - started };
      done += weight;
      await update({ stats, progress: Math.round(done) });
    }
    await update({ status: 'completed', stage: null, progress: 100, stats, finishedAt: new Date() });
    log.info('Pipeline run completed', { runId, tenantId });
    return stats;
  } catch (err) {
    log.error('Pipeline run failed', { runId, tenantId, error: err.message });
    await update({ status: 'failed', error: String(err.message || err).slice(0, 2000), stats, finishedAt: new Date() });
    throw err;
  }
}

const listRuns = (limit = 10) => prisma.ripPipelineRun.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Number(limit) || 10, 50) });

module.exports = { createRun, execute, listRuns, STAGES };
