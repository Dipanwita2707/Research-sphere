/**
 * Taxonomy — Research Intelligence
 *
 * Three levels per tenant: Domain → Category → Specialization. Keywords map to categories.
 *
 * Governance over the reference implementation:
 *   - the AI never silently grows the tree: new domains/categories it needs are created with
 *     status "proposed" and appear in the review queue until an admin approves them;
 *   - low-confidence mappings (and every mapping into a proposed node) are "pending_review";
 *   - "uncategorized" is allowed, so the model is never forced into a bad mapping.
 * Analytics only count active nodes and approved mappings.
 */

'use strict';

const { Prisma } = require('@prisma/client');
const prisma = require('../../../shared/config/database');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { ValidationError, NotFoundError, ConflictError } = require('../../../shared/utils/AppError');
const ai = require('./ai/aiProvider');
const DEFAULT_TAXONOMY = require('./defaultTaxonomy');
const { toSlug, COUNTED_STATUSES_SQL } = require('./researchData');

const log = createModuleLogger('rip:taxonomy');

const AUTO_APPROVE_CONFIDENCE = 0.75;
const NODE_FIELDS = ['name', 'description', 'aliases', 'iconCode', 'colorHex', 'sortOrder', 'status'];
const NODE_STATUSES = ['active', 'proposed', 'retired'];

const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => obj?.[f] !== undefined).map((f) => [f, obj[f]]));

const cleanNodeInput = (body, { requireName = true } = {}) => {
  const data = pick(body, NODE_FIELDS);
  if (data.name !== undefined) {
    data.name = String(data.name).trim().slice(0, 128);
    if (!data.name) throw new ValidationError('Name is required');
    data.slug = toSlug(data.name, 128);
  } else if (requireName) {
    throw new ValidationError('Name is required');
  }
  if (data.status !== undefined && !NODE_STATUSES.includes(data.status)) throw new ValidationError(`status must be one of ${NODE_STATUSES.join(', ')}`);
  if (data.aliases !== undefined) data.aliases = (Array.isArray(data.aliases) ? data.aliases : []).map(String).slice(0, 30);
  if (data.description !== undefined) data.description = data.description ? String(data.description).slice(0, 512) : null;
  return data;
};

const rethrowUnique = (err, what) => {
  if (err?.code === 'P2002') throw new ConflictError(`A ${what} with this name already exists`);
  throw err;
};

// ─── Tree ─────────────────────────────────────────────────────────────────────

async function getTree({ includeRetired = false, includeProposed = true } = {}) {
  const statuses = ['active', ...(includeProposed ? ['proposed'] : []), ...(includeRetired ? ['retired'] : [])];
  return prisma.ripTaxonomyDomain.findMany({
    where: { status: { in: statuses } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      categories: {
        where: { status: { in: statuses } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          specializations: {
            where: { status: { in: statuses } },
            orderBy: [{ publicationCount: 'desc' }, { name: 'asc' }],
            include: { _count: { select: { keywordMappings: { where: { status: 'approved' } } } } },
          },
          _count: { select: { keywordMappings: { where: { status: 'approved' } } } },
        },
      },
    },
  });
}

/** Seed the starter taxonomy when the tenant has none. Returns true when seeded. */
async function ensureSeeded() {
  if (await prisma.ripTaxonomyDomain.count()) return false;
  for (const [i, d] of DEFAULT_TAXONOMY.entries()) {
    await prisma.ripTaxonomyDomain.create({
      data: {
        name: d.name,
        slug: toSlug(d.name, 128),
        colorHex: d.color,
        iconCode: d.icon,
        sortOrder: i,
        categories: { create: d.categories.map((name, j) => ({ name, slug: toSlug(name, 128), sortOrder: j })) },
      },
    });
  }
  log.info('Seeded starter taxonomy', { domains: DEFAULT_TAXONOMY.length });
  return true;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const createDomain = (body) =>
  prisma.ripTaxonomyDomain.create({ data: cleanNodeInput(body) }).catch((e) => rethrowUnique(e, 'domain'));

async function updateDomain(id, body) {
  const data = cleanNodeInput(body, { requireName: false });
  const r = await prisma.ripTaxonomyDomain.updateMany({ where: { id }, data }).catch((e) => rethrowUnique(e, 'domain'));
  if (!r.count) throw new NotFoundError('Domain not found');
  return prisma.ripTaxonomyDomain.findFirst({ where: { id } });
}

async function createCategory(body) {
  const domain = await prisma.ripTaxonomyDomain.findFirst({ where: { id: body?.domainId }, select: { id: true } });
  if (!domain) throw new NotFoundError('Domain not found');
  return prisma.ripTaxonomyCategory
    .create({ data: { ...cleanNodeInput(body), domainId: domain.id } })
    .catch((e) => rethrowUnique(e, 'category'));
}

async function updateCategory(id, body) {
  const data = cleanNodeInput(body, { requireName: false });
  if (body?.domainId) {
    const domain = await prisma.ripTaxonomyDomain.findFirst({ where: { id: body.domainId }, select: { id: true } });
    if (!domain) throw new NotFoundError('Domain not found');
    data.domainId = domain.id;
  }
  const r = await prisma.ripTaxonomyCategory.updateMany({ where: { id }, data }).catch((e) => rethrowUnique(e, 'category'));
  if (!r.count) throw new NotFoundError('Category not found');
  return prisma.ripTaxonomyCategory.findFirst({ where: { id } });
}

async function createSpecialization(body) {
  const category = await prisma.ripTaxonomyCategory.findFirst({ where: { id: body?.categoryId }, select: { id: true } });
  if (!category) throw new NotFoundError('Category not found');
  const data = cleanNodeInput(body);
  delete data.iconCode;
  delete data.colorHex;
  return prisma.ripTaxonomySpecialization
    .create({ data: { ...data, categoryId: category.id } })
    .catch((e) => rethrowUnique(e, 'specialization'));
}

/** Move all keyword mappings (and expertise scores) from one category into another, then retire it. */
async function mergeCategories(fromId, intoId) {
  if (!fromId || !intoId || fromId === intoId) throw new ValidationError('Choose two different categories to merge');
  const [from, into] = await Promise.all([
    prisma.ripTaxonomyCategory.findFirst({ where: { id: fromId } }),
    prisma.ripTaxonomyCategory.findFirst({ where: { id: intoId } }),
  ]);
  if (!from || !into) throw new NotFoundError('Category not found');

  const moved = await prisma.$transaction(async (tx) => {
    const mappings = await tx.ripKeywordTaxonomyMapping.findMany({ where: { categoryId: fromId } });
    const existing = new Set((await tx.ripKeywordTaxonomyMapping.findMany({ where: { categoryId: intoId }, select: { keywordId: true } })).map((m) => m.keywordId));
    const toMove = mappings.filter((m) => !existing.has(m.keywordId)).map((m) => m.id);
    if (toMove.length) await tx.ripKeywordTaxonomyMapping.updateMany({ where: { id: { in: toMove } }, data: { categoryId: intoId } });
    await tx.ripKeywordTaxonomyMapping.deleteMany({ where: { categoryId: fromId } });
    await tx.ripResearcherTopicScore.deleteMany({ where: { categoryId: fromId } });
    // Move specializations whose slug is free in the target; drop the duplicates.
    const intoSlugs = (await tx.ripTaxonomySpecialization.findMany({ where: { categoryId: intoId }, select: { slug: true } })).map((s) => s.slug);
    await tx.ripTaxonomySpecialization.updateMany({ where: { categoryId: fromId, slug: { notIn: intoSlugs } }, data: { categoryId: intoId } });
    await tx.ripTaxonomySpecialization.deleteMany({ where: { categoryId: fromId } });
    await tx.ripTaxonomyCategory.updateMany({ where: { id: fromId }, data: { status: 'retired', mergedIntoCategoryId: intoId } });
    await tx.ripTaxonomyCategory.updateMany({ where: { id: intoId }, data: { aliases: [...new Set([...into.aliases, from.name, ...from.aliases])] } });
    return toMove.length;
  });
  return { movedMappings: moved, mergedInto: into.name };
}

// ─── Keyword mapping & review ─────────────────────────────────────────────────

/** Map a keyword to a category, optionally placing it in one of that category's specializations. */
async function assignKeyword(keywordId, categoryId, { isPrimary = true, specializationId = null } = {}) {
  const [kw, cat, spec] = await Promise.all([
    prisma.ripResearchKeyword.findFirst({ where: { id: keywordId }, select: { id: true } }),
    prisma.ripTaxonomyCategory.findFirst({ where: { id: categoryId }, select: { id: true } }),
    specializationId ? prisma.ripTaxonomySpecialization.findFirst({ where: { id: specializationId }, select: { id: true, categoryId: true } }) : null,
  ]);
  if (!kw) throw new NotFoundError('Keyword not found');
  if (!cat) throw new NotFoundError('Category not found');
  if (specializationId && (!spec || spec.categoryId !== categoryId)) throw new ValidationError('Specialization does not belong to this category');
  if (isPrimary) await prisma.ripKeywordTaxonomyMapping.updateMany({ where: { keywordId, isPrimary: true }, data: { isPrimary: false } });
  const found = await prisma.ripKeywordTaxonomyMapping.findFirst({ where: { keywordId, categoryId } });
  const data = { source: 'manual', confidenceScore: 1, isPrimary, status: 'approved', specializationId: spec?.id || null };
  return found
    ? prisma.ripKeywordTaxonomyMapping.update({ where: { id: found.id }, data })
    : prisma.ripKeywordTaxonomyMapping.create({ data: { keywordId, categoryId, ...data } });
}

const unassignKeyword = (keywordId, categoryId) => prisma.ripKeywordTaxonomyMapping.deleteMany({ where: { keywordId, categoryId } });

/** Everything awaiting human review: proposed nodes and pending mappings. */
async function getReviewQueue({ limit = 100 } = {}) {
  const [domains, categories, specializations, mappings, pendingCount] = await Promise.all([
    prisma.ripTaxonomyDomain.findMany({ where: { status: 'proposed' }, orderBy: { createdAt: 'desc' } }),
    prisma.ripTaxonomyCategory.findMany({
      where: { status: 'proposed' },
      include: { domain: { select: { id: true, name: true } }, _count: { select: { keywordMappings: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ripTaxonomySpecialization.findMany({
      where: { status: 'proposed' },
      include: { category: { select: { id: true, name: true } }, _count: { select: { keywordMappings: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ripKeywordTaxonomyMapping.findMany({
      where: { status: 'pending_review' },
      include: {
        keyword: { select: { id: true, canonicalName: true, publicationCount: true } },
        category: { select: { id: true, name: true, status: true, domain: { select: { name: true } } } },
        specialization: { select: { id: true, name: true } },
      },
      orderBy: [{ keyword: { publicationCount: 'desc' } }],
      take: Math.min(Number(limit) || 100, 500),
    }),
    prisma.ripKeywordTaxonomyMapping.count({ where: { status: 'pending_review' } }),
  ]);
  return { proposedDomains: domains, proposedCategories: categories, proposedSpecializations: specializations, pendingMappings: mappings, pendingMappingCount: pendingCount };
}

/**
 * Apply review decisions.
 * @param {{ approveMappingIds?, rejectMappingIds?, approveNodeIds?, rejectNodeIds? }} decisions
 */
async function applyReview({ approveMappingIds = [], rejectMappingIds = [], approveNodeIds = [], rejectNodeIds = [] } = {}) {
  const ids = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 1000) : []);
  const [am, rm, an, rn] = [ids(approveMappingIds), ids(rejectMappingIds), ids(approveNodeIds), ids(rejectNodeIds)];
  return prisma.$transaction(async (tx) => {
    // Approving a node approves its parent domain too, so an active category never hangs off a proposed domain.
    const approvedCats = await tx.ripTaxonomyCategory.findMany({ where: { id: { in: an } }, select: { domainId: true } });
    const domainIds = [...new Set([...an, ...approvedCats.map((c) => c.domainId)])];
    const nodes =
      (await tx.ripTaxonomyDomain.updateMany({ where: { id: { in: domainIds }, status: 'proposed' }, data: { status: 'active' } })).count +
      (await tx.ripTaxonomyCategory.updateMany({ where: { id: { in: an }, status: 'proposed' }, data: { status: 'active' } })).count +
      (await tx.ripTaxonomySpecialization.updateMany({ where: { id: { in: an }, status: 'proposed' }, data: { status: 'active' } })).count;
    // Rejecting a node removes it; category/domain mappings cascade, specialization links are cleared.
    const removedNodes =
      (await tx.ripTaxonomySpecialization.deleteMany({ where: { id: { in: rn }, status: 'proposed' } })).count +
      (await tx.ripTaxonomyCategory.deleteMany({ where: { OR: [{ id: { in: rn } }, { domainId: { in: rn } }], status: 'proposed' } })).count +
      (await tx.ripTaxonomyDomain.deleteMany({ where: { id: { in: rn }, status: 'proposed' } })).count;
    const approved = (await tx.ripKeywordTaxonomyMapping.updateMany({ where: { id: { in: am } }, data: { status: 'approved' } })).count;
    const rejected = (await tx.ripKeywordTaxonomyMapping.deleteMany({ where: { id: { in: rm } } })).count;
    return { approvedNodes: nodes, removedNodes, approvedMappings: approved, rejectedMappings: rejected };
  });
}

// ─── AI classification ────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `You are the research taxonomist for a university's research intelligence system.
Classify each research keyword into the university's 3-level taxonomy: domain → category → specialization.
Categories are identified as "domain-slug/category-slug"; existing specializations are listed under their category as "· slug: Name".

Rules:
- Give each keyword one primary category and at most two secondary categories (only when it genuinely spans fields).
- Inside the primary category, place the keyword in a specialization: reuse an existing slug ("specialization"), or, if none fits and
  the keyword belongs to a coherent sub-area, name a new one ("new_specialization", 2-5 words, reusable by sibling keywords).
  Leave both null when the keyword is as broad as the category itself (e.g. "Machine Learning" in AI & Machine Learning).
- Confidence is 0-1. Use below 0.6 when unsure.
- If no existing category fits well, you may propose ONE new category per missing area (under an existing domain when possible,
  otherwise under a new domain) and use its id "domain-slug/new-category-slug". Do not propose near-duplicates of existing categories.
- If a keyword is too generic to classify (e.g. "Survey", "Optimization"), return it with "primary": null.
- Respond with JSON only, exactly:
{"classifications":[{"keyword":"...","primary":"domain/category"|null,"specialization":"slug"|null,"new_specialization":"Name"|null,"confidence":0.0,"secondary":[{"category":"domain/category","confidence":0.0}]}],
 "proposals":[{"id":"domain/category","categoryName":"...","domainName":"...","description":"<= 12 words"}]}`;

const MAX_SPECS_IN_PROMPT = 15;

const treeContext = (domains) =>
  domains
    .map((d) => {
      const cats = d.categories.map((c) => {
        const specs = (c.specializations || []).slice(0, MAX_SPECS_IN_PROMPT).map((sp) => `      · ${sp.slug}: ${sp.name}`);
        return [`  ${d.slug}/${c.slug}: ${c.name}`, ...specs].join('\n');
      });
      return `${d.slug}: ${d.name}\n${cats.join('\n')}`;
    })
    .join('\n');

/**
 * Find or create a specialization under a category. AI-created specializations are active when
 * their category is active (leaf level, cheap to merge or retire), otherwise proposed with it.
 */
async function ensureSpecialization(category, name, specsByCat, stats) {
  const display = String(name || '').trim().slice(0, 128);
  const slug = toSlug(display, 128);
  if (!slug) return null;
  const known = specsByCat.get(category.id) || new Map();
  if (known.has(slug)) return known.get(slug);
  const status = category.status === 'active' && category.domainStatus === 'active' ? 'active' : 'proposed';
  const select = { id: true, slug: true, name: true, status: true };
  const spec = await prisma.ripTaxonomySpecialization
    .create({ data: { categoryId: category.id, name: display, slug, status, origin: 'ai' }, select })
    .catch(() => prisma.ripTaxonomySpecialization.findFirst({ where: { categoryId: category.id, slug }, select }));
  if (spec) {
    known.set(slug, spec);
    specsByCat.set(category.id, known);
    if (stats) stats.newSpecializations = (stats.newSpecializations || 0) + 1;
  }
  return spec;
}

/**
 * Classify unmapped keywords with the AI.
 * @param {object} opts
 * @param {number} [opts.maxKeywords=1500]
 * @param {number} [opts.batchSize=40]
 * @param {boolean} [opts.allowProposals=true]
 * @param {(pct:number)=>void} [opts.onProgress]
 */
async function classifyKeywords({ maxKeywords = 1500, batchSize = 40, allowProposals = true, onProgress } = {}) {
  if (!ai.isConfigured()) return { skipped: true, reason: 'No AI provider configured' };
  await ensureSeeded();

  const stats = { processed: 0, mapped: 0, pending: 0, unclassified: 0, proposedCategories: 0, proposedDomains: 0, failedBatches: 0 };
  const attempted = new Set();

  while (stats.processed < maxKeywords) {
    const domains = await prisma.ripTaxonomyDomain.findMany({
      where: { status: { in: ['active', 'proposed'] } },
      include: {
        categories: {
          where: { status: { in: ['active', 'proposed'] } },
          select: {
            id: true, slug: true, name: true, status: true,
            specializations: { where: { status: { in: ['active', 'proposed'] } }, select: { id: true, slug: true, name: true, status: true }, orderBy: { publicationCount: 'desc' } },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    const catById = new Map();
    const specsByCat = new Map();
    const domainBySlug = new Map(domains.map((d) => [d.slug, d]));
    for (const d of domains) {
      for (const c of d.categories) {
        catById.set(`${d.slug}/${c.slug}`, { ...c, domainStatus: d.status });
        specsByCat.set(c.id, new Map(c.specializations.map((sp) => [sp.slug, sp])));
      }
    }

    const batch = await prisma.ripResearchKeyword.findMany({
      where: { id: { notIn: [...attempted] }, publicationCount: { gt: 0 }, taxonomyMappings: { none: {} } },
      select: { id: true, canonicalName: true },
      orderBy: [{ publicationCount: 'desc' }, { canonicalName: 'asc' }],
      take: Math.min(batchSize, maxKeywords - stats.processed),
    });
    if (!batch.length) break;
    batch.forEach((k) => attempted.add(k.id));
    stats.processed += batch.length;

    let data;
    try {
      ({ data } = await ai.completeJson({
        system: CLASSIFIER_SYSTEM,
        prompt: `TAXONOMY:\n${treeContext(domains)}\n\nKEYWORDS:\n${batch.map((k) => `- ${k.canonicalName}`).join('\n')}`,
        maxTokens: 6000,
        cacheContext: 'taxonomy_classify',
      }));
    } catch (err) {
      stats.failedBatches++;
      log.warn('Taxonomy classification batch failed', { error: err.message });
      if (err.name === 'AiUnavailableError' && stats.failedBatches >= 3) break;
      continue;
    }

    // Materialise proposals as "proposed" nodes.
    if (allowProposals) {
      for (const p of Array.isArray(data?.proposals) ? data.proposals : []) {
        const [dSlugRaw, cSlugRaw] = String(p?.id || '').split('/');
        const dSlug = toSlug(dSlugRaw || p?.domainName || '', 128);
        const cSlug = toSlug(cSlugRaw || p?.categoryName || '', 128);
        if (!dSlug || !cSlug || catById.has(`${dSlug}/${cSlug}`)) continue;
        let domain = domainBySlug.get(dSlug);
        if (!domain) {
          if (!p.domainName) continue;
          domain = await prisma.ripTaxonomyDomain
            .create({ data: { name: String(p.domainName).slice(0, 128), slug: dSlug, status: 'proposed', origin: 'ai', sortOrder: 999 } })
            .catch(() => prisma.ripTaxonomyDomain.findFirst({ where: { slug: dSlug } }));
          if (!domain) continue;
          domain.categories = [];
          domainBySlug.set(dSlug, domain);
          stats.proposedDomains++;
        }
        const category = await prisma.ripTaxonomyCategory
          .create({
            data: {
              domainId: domain.id,
              name: String(p.categoryName || cSlugRaw).slice(0, 128),
              slug: cSlug,
              description: p.description ? String(p.description).slice(0, 512) : null,
              status: 'proposed',
              origin: 'ai',
            },
          })
          .catch(() => prisma.ripTaxonomyCategory.findFirst({ where: { domainId: domain.id, slug: cSlug } }));
        if (!category) continue;
        catById.set(`${dSlug}/${cSlug}`, { ...category, domainStatus: domain.status });
        stats.proposedCategories++;
      }
    }

    const byName = new Map(batch.map((k) => [k.canonicalName.toLowerCase(), k.id]));
    const rows = [];
    for (const c of Array.isArray(data?.classifications) ? data.classifications : []) {
      const keywordId = byName.get(String(c?.keyword || '').toLowerCase());
      if (!keywordId) continue;
      if (!c.primary) {
        stats.unclassified++;
        continue;
      }
      const targets = [{ id: c.primary, confidence: Number(c.confidence) || 0.5, isPrimary: true }];
      for (const s of Array.isArray(c.secondary) ? c.secondary.slice(0, 2) : []) targets.push({ id: s?.category, confidence: Number(s?.confidence) || 0.5, isPrimary: false });
      const seen = new Set();
      for (const t of targets) {
        const cat = catById.get(String(t.id || '').toLowerCase());
        if (!cat || seen.has(cat.id)) continue;
        seen.add(cat.id);
        const confidence = Math.max(0, Math.min(1, t.confidence));
        const approved = confidence >= AUTO_APPROVE_CONFIDENCE && cat.status === 'active' && cat.domainStatus === 'active';
        let specializationId = null;
        if (t.isPrimary) {
          const existing = c.specialization ? specsByCat.get(cat.id)?.get(toSlug(c.specialization, 128)) : null;
          const spec = existing || (c.new_specialization ? await ensureSpecialization(cat, c.new_specialization, specsByCat, stats) : null);
          specializationId = spec?.id || null;
          if (specializationId) stats.specialized = (stats.specialized || 0) + 1;
        }
        rows.push({ keywordId, categoryId: cat.id, specializationId, source: 'ai', confidenceScore: confidence, isPrimary: t.isPrimary, status: approved ? 'approved' : 'pending_review' });
        if (approved) stats.mapped++;
        else stats.pending++;
      }
    }
    if (rows.length) await prisma.ripKeywordTaxonomyMapping.createMany({ data: rows, skipDuplicates: true });
    onProgress?.(Math.round((stats.processed / maxKeywords) * 100));
  }

  log.info('Taxonomy classification complete', stats);
  return stats;
}

const SPECIALIZER_SYSTEM = `You organise research keywords inside ONE category of a university research taxonomy into specializations (sub-areas).
Reuse an existing specialization slug whenever it fits. Otherwise create a new specialization: a 2-5 word, established sub-field name
that several of the listed keywords can share. Do not create one specialization per keyword. Aim for roughly 3-12 specializations per
category in total. If a keyword is as broad as the category itself, leave it unassigned (both fields null).
Respond with JSON only: {"assignments":[{"keyword":"...","specialization":"existing-slug"|null,"new_specialization":"Name"|null}]}`;

/**
 * Place approved primary mappings that have no specialization yet (e.g. mapped before this
 * level existed, or by hand) into specializations, one focused AI prompt per category.
 */
async function refineSpecializations({ maxKeywords = 1500, batchSize = 60, onProgress } = {}) {
  if (!ai.isConfigured()) return { skipped: true, reason: 'No AI provider configured' };
  const stats = { processed: 0, specialized: 0, newSpecializations: 0, categories: 0, failedBatches: 0 };

  const pending = await prisma.ripKeywordTaxonomyMapping.findMany({
    where: { status: 'approved', isPrimary: true, specializationId: null, category: { status: 'active', domain: { status: 'active' } } },
    select: { id: true, categoryId: true, keyword: { select: { canonicalName: true } } },
    orderBy: { keyword: { publicationCount: 'desc' } },
    take: maxKeywords,
  });
  const byCategory = new Map();
  for (const m of pending) {
    if (!byCategory.has(m.categoryId)) byCategory.set(m.categoryId, []);
    byCategory.get(m.categoryId).push(m);
  }
  const categories = await prisma.ripTaxonomyCategory.findMany({
    where: { id: { in: [...byCategory.keys()] } },
    select: {
      id: true, name: true, status: true, domain: { select: { name: true, status: true } },
      specializations: { where: { status: { in: ['active', 'proposed'] } }, select: { id: true, slug: true, name: true, status: true } },
    },
  });

  let done = 0;
  for (const cat of categories) {
    const mappings = byCategory.get(cat.id);
    // A lone generic keyword is not worth a sub-area unless sub-areas already exist.
    if (!cat.specializations.length && mappings.length < 3) {
      done += mappings.length;
      continue;
    }
    stats.categories++;
    const specsByCat = new Map([[cat.id, new Map(cat.specializations.map((sp) => [sp.slug, sp]))]]);
    const catNode = { id: cat.id, status: cat.status, domainStatus: cat.domain.status };

    for (let i = 0; i < mappings.length; i += batchSize) {
      const batch = mappings.slice(i, i + batchSize);
      const existing = [...specsByCat.get(cat.id).values()].map((sp) => `· ${sp.slug}: ${sp.name}`).join('\n') || '(none yet)';
      let data;
      try {
        ({ data } = await ai.completeJson({
          system: SPECIALIZER_SYSTEM,
          prompt: `CATEGORY: ${cat.name} (domain: ${cat.domain.name})\nEXISTING SPECIALIZATIONS:\n${existing}\n\nKEYWORDS:\n${batch.map((m) => `- ${m.keyword.canonicalName}`).join('\n')}`,
          maxTokens: 4000,
          cacheContext: 'taxonomy_specialize',
        }));
      } catch (err) {
        stats.failedBatches++;
        log.warn('Specialization batch failed', { category: cat.name, error: err.message });
        if (err.name === 'AiUnavailableError' && stats.failedBatches >= 3) return stats;
        continue;
      }
      const byName = new Map(batch.map((m) => [m.keyword.canonicalName.toLowerCase(), m.id]));
      const updates = new Map(); // specializationId → mapping ids
      for (const a of Array.isArray(data?.assignments) ? data.assignments : []) {
        const mappingId = byName.get(String(a?.keyword || '').toLowerCase());
        if (!mappingId) continue;
        const spec = (a.specialization && specsByCat.get(cat.id).get(toSlug(a.specialization, 128))) ||
          (a.new_specialization ? await ensureSpecialization(catNode, a.new_specialization, specsByCat, stats) : null);
        if (!spec) continue;
        if (!updates.has(spec.id)) updates.set(spec.id, []);
        updates.get(spec.id).push(mappingId);
      }
      for (const [specializationId, ids] of updates) {
        stats.specialized += (await prisma.ripKeywordTaxonomyMapping.updateMany({ where: { id: { in: ids }, specializationId: null }, data: { specializationId } })).count;
      }
      stats.processed += batch.length;
      done += batch.length;
      onProgress?.(Math.round((done / Math.max(pending.length, 1)) * 100));
    }
  }
  log.info('Specialization refinement complete', stats);
  return stats;
}

/** Recompute publication/researcher counts on taxonomy nodes from approved mappings. */
async function recomputeTaxonomyStats(tenantId) {
  const statuses = Prisma.raw(COUNTED_STATUSES_SQL);
  await prisma.$executeRaw`
    UPDATE rip_taxonomy_specialization sp SET
      publication_count = COALESCE(s.pubs, 0), researcher_count = COALESCE(s.researchers, 0), updated_at = now()
    FROM rip_taxonomy_specialization sp2
    LEFT JOIN (
      SELECT m.specialization_id, COUNT(DISTINCT rc.id)::int AS pubs, COUNT(DISTINCT rc.applicant_user_id)::int AS researchers
        FROM rip_keyword_taxonomy_mapping m
        JOIN rip_contribution_keyword ck ON ck.keyword_id = m.keyword_id
        JOIN research_contribution rc ON rc.id = ck.contribution_id AND rc.status::text IN (${statuses})
       WHERE m.university_id = ${tenantId}::uuid AND m.status = 'approved' AND m.specialization_id IS NOT NULL
       GROUP BY m.specialization_id
    ) s ON s.specialization_id = sp2.id
    WHERE sp.id = sp2.id AND sp.university_id = ${tenantId}::uuid`;
  await prisma.$executeRaw`
    UPDATE rip_taxonomy_category c SET
      publication_count = COALESCE(s.pubs, 0), researcher_count = COALESCE(s.researchers, 0), updated_at = now()
    FROM rip_taxonomy_category c2
    LEFT JOIN (
      SELECT m.category_id, COUNT(DISTINCT rc.id)::int AS pubs, COUNT(DISTINCT rc.applicant_user_id)::int AS researchers
        FROM rip_keyword_taxonomy_mapping m
        JOIN rip_contribution_keyword ck ON ck.keyword_id = m.keyword_id
        JOIN research_contribution rc ON rc.id = ck.contribution_id AND rc.status::text IN (${statuses})
       WHERE m.university_id = ${tenantId}::uuid AND m.status = 'approved'
       GROUP BY m.category_id
    ) s ON s.category_id = c2.id
    WHERE c.id = c2.id AND c.university_id = ${tenantId}::uuid`;
  await prisma.$executeRaw`
    UPDATE rip_taxonomy_domain d SET
      publication_count = COALESCE(s.pubs, 0), researcher_count = COALESCE(s.researchers, 0), updated_at = now()
    FROM rip_taxonomy_domain d2
    LEFT JOIN (
      SELECT c.domain_id, COUNT(DISTINCT rc.id)::int AS pubs, COUNT(DISTINCT rc.applicant_user_id)::int AS researchers
        FROM rip_keyword_taxonomy_mapping m
        JOIN rip_taxonomy_category c ON c.id = m.category_id AND c.status = 'active'
        JOIN rip_contribution_keyword ck ON ck.keyword_id = m.keyword_id
        JOIN research_contribution rc ON rc.id = ck.contribution_id AND rc.status::text IN (${statuses})
       WHERE m.university_id = ${tenantId}::uuid AND m.status = 'approved'
       GROUP BY c.domain_id
    ) s ON s.domain_id = d2.id
    WHERE d.id = d2.id AND d.university_id = ${tenantId}::uuid`;
}

async function deleteKeyword(keywordId) {
  const r = await prisma.ripResearchKeyword.deleteMany({ where: { id: keywordId } });
  if (!r.count) throw new NotFoundError('Keyword not found');
}

module.exports = {
  getTree,
  ensureSeeded,
  createDomain,
  updateDomain,
  createCategory,
  updateCategory,
  createSpecialization,
  mergeCategories,
  assignKeyword,
  unassignKeyword,
  getReviewQueue,
  applyReview,
  classifyKeywords,
  refineSpecializations,
  recomputeTaxonomyStats,
  deleteKeyword,
};
