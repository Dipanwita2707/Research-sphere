const { createModuleLogger } = require('../../../shared/utils/logger');
const { isAffiliationMatch } = require('../../../shared/utils/affiliationEngine');
const affiliationService = require('../../core/services/affiliation.service');

const log = createModuleLogger('research-publication-sync');

const DEFAULT_ORCID_BASE_URL = process.env.ORCID_API_BASE_URL || 'https://pub.orcid.org/v3.0';
const DEFAULT_SCOPUS_BASE_URL = process.env.SCOPUS_API_BASE_URL || 'https://api.elsevier.com/content';
const DEFAULT_OPENALEX_BASE_URL = process.env.OPENALEX_API_BASE_URL || 'https://api.openalex.org';

// Legacy SGT-specific Scopus Affiliation IDs. Scopus affiliation IDs are
// opaque numeric identifiers assigned by Elsevier per-institution — they
// cannot be derived algorithmically from a university's name, so this
// data-only fallback is retained and gated to tenants whose University.code
// is "SGT" (see _isSgtTenant()). Other universities simply won't have any
// afid fallback until/unless their own IDs are added here.
const SGT_SCOPUS_AFFIL_IDS = new Set([
  '60113772',  // Shree Guru Gobind Singh Tricentenary University, Gurugram
  '124037491', // SGT University Gurugram
  '123581218', // SGT University
  '133421016', // Shree Guru Gobind Singh Tricentenary (SGT) University
]);

class PublicationSyncService {
  constructor(prisma, contributionService) {
    this.prisma = prisma;
    this.contributionService = contributionService;
    // Per-sync-run affiliation context, populated by _loadAffiliationContext().
    this._affiliationVariants = [];
    this._canonicalUniversityName = 'University';
    this._universityCode = null;
  }

  /**
   * Load the tenant's dynamically-generated affiliation variants + canonical
   * name for the duration of a sync/import run, replacing the old hardcoded
   * SGT-only variant list. Must be called before any code path that relies
   * on this._isAffiliationMatch() / this._canonicalUniversityName.
   */
  async _loadAffiliationContext(user) {
    const { canonicalName, variants } = await affiliationService.getUniversityAffiliationVariants(
      user?.universityId
    );
    this._affiliationVariants = variants;
    this._canonicalUniversityName = canonicalName || 'University';
    this._universityCode = user?.university?.code || null;
    if (!this._universityCode && user?.universityId) {
      const uni = await this.prisma.university.findUnique({
        where: { id: user.universityId },
        select: { code: true },
      });
      this._universityCode = uni?.code || null;
    }
  }

  /** Whether the current tenant is the legacy SGT University (for Scopus afid fallback only). */
  _isSgtTenant() {
    return this._universityCode === 'SGT';
  }

  async getProfileIdentity(userId) {
    const identity = await this.prisma.researchProfileIdentity.findUnique({
      where: { userId },
      include: {
        importRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (identity) {
      return identity;
    }

    return {
      id: null,
      userId,
      orcid: null,
      scopusAuthorId: null,
      webOfScienceId: null,
      affiliationAliases: [],
      autoSyncEnabled: true,
      filterSgtOnly: false,
      syncFrequencyDays: 1,
      syncStatus: 'never_synced',
      syncError: null,
      lastSyncedAt: null,
      importRuns: [],
    };
  }

  async upsertProfileIdentity(userId, payload = {}) {
    const data = {
      orcid: payload.orcid !== undefined ? this._normalizeOrcid(payload.orcid) : undefined,
      scopusAuthorId: payload.scopusAuthorId !== undefined ? this._normalizeScopusAuthorId(payload.scopusAuthorId) : undefined,
      webOfScienceId: payload.webOfScienceId !== undefined ? this._cleanString(payload.webOfScienceId, 64) : undefined,
      affiliationAliases: Array.isArray(payload.affiliationAliases)
        ? payload.affiliationAliases.map((item) => this._cleanString(item, 256)).filter(Boolean)
        : undefined,
      autoSyncEnabled: payload.autoSyncEnabled !== undefined ? Boolean(payload.autoSyncEnabled) : undefined,
      filterSgtOnly: payload.filterSgtOnly !== undefined ? Boolean(payload.filterSgtOnly) : undefined,
      syncFrequencyDays:
        payload.syncFrequencyDays !== undefined
          ? Math.max(1, Number(payload.syncFrequencyDays) || 1)
          : undefined,
      syncStatus: payload.syncStatus ? this._cleanString(payload.syncStatus, 32) : undefined,
      syncError: payload.syncError === null ? null : this._cleanString(payload.syncError, 1000),
      lastSyncedAt: payload.lastSyncedAt ? new Date(payload.lastSyncedAt) : undefined,
    };

    if (payload.orcid && !data.orcid) {
      const error = new Error('Invalid ORCID format');
      error.statusCode = 400;
      throw error;
    }

    // --- Genuine Identity Verification Check ---
    const user = await this.prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: { select: { displayName: true } },
        studentLogin: { select: { displayName: true } }
      }
    });

    const userDisplayName = user?.employeeDetails?.displayName || user?.studentLogin?.displayName || user?.uid;

    if (userDisplayName) {
      // 1. Verify Scopus ID against OpenAlex
      if (data.scopusAuthorId) {
        try {
          const response = await fetch(`https://api.openalex.org/authors?filter=ids.scopus:${data.scopusAuthorId}`);
          if (response.ok) {
            const result = await response.json();
            const author = result.results?.[0];
            if (author) {
              const authorName = author.display_name;
              const alternatives = author.display_name_alternatives || [];
              const allNames = [authorName, ...alternatives];
              const nameMatches = allNames.some(name => this._isSamePersonName(name, userDisplayName));
              if (!nameMatches) {
                const error = new Error(`Scopus ID verification failed. The ID belongs to "${authorName}", which does not match your name "${userDisplayName}".`);
                error.statusCode = 400;
                throw error;
              }
            }
          }
        } catch (err) {
          log.error('Failed to verify Scopus Author ID on identity update:', err);
          if (err.statusCode === 400) throw err;
        }
      }

      // 2. Verify ORCID against OpenAlex
      if (data.orcid) {
        try {
          const response = await fetch(`https://api.openalex.org/authors?filter=orcid:${data.orcid}`);
          if (response.ok) {
            const result = await response.json();
            const author = result.results?.[0];
            if (author) {
              const authorName = author.display_name;
              const alternatives = author.display_name_alternatives || [];
              const allNames = [authorName, ...alternatives];
              const nameMatches = allNames.some(name => this._isSamePersonName(name, userDisplayName));
              if (!nameMatches) {
                const error = new Error(`ORCID verification failed. The ID belongs to "${authorName}", which does not match your name "${userDisplayName}".`);
                error.statusCode = 400;
                throw error;
              }
            }
          }
        } catch (err) {
          log.error('Failed to verify ORCID on identity update:', err);
          if (err.statusCode === 400) throw err;
        }
      }
    }

    return this.prisma.researchProfileIdentity.upsert({
      where: { userId },
      update: this._stripUndefined(data),
      create: {
        user: { connect: { id: userId } },
        ...this._stripUndefined(data),
      },
    });
  }

  async listImportRuns({ userId, limit = 20 } = {}) {
    let researchProfileId = undefined;
    if (userId) {
      const identity = await this.prisma.researchProfileIdentity.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!identity) return [];
      researchProfileId = identity.id;
    }

    const where = researchProfileId ? { researchProfileId } : {};
    return this.prisma.publicationImportRun.findMany({
      where,
      include: {
        researchProfile: {
          select: {
            id: true,
            userId: true,
            orcid: true,
            scopusAuthorId: true,
            user: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async importManualPublications(userId, options = {}) {
    const {
      publications = [],
      importFormat = 'manual',
      triggeredById = null,
      actor = { id: userId, role: 'faculty' },
    } = options;

    if (!Array.isArray(publications) || publications.length === 0) {
      const error = new Error('At least one publication is required for import');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: {
          include: {
            primaryDepartment: true,
            primarySchool: true,
          },
        },
        researchProfileIdentity: true,
      },
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    await this._loadAffiliationContext(user);

    let identity = user.researchProfileIdentity;
    if (!identity) {
      identity = await this.prisma.researchProfileIdentity.upsert({
        where: { userId },
        update: {},
        create: {
          user: { connect: { id: userId } },
        },
      });
    }

    const sourceSystem = this._cleanString(`manual_${String(importFormat).toLowerCase()}`, 32) || 'manual_upload';
    const run = await this.prisma.publicationImportRun.create({
      data: {
        researchProfileId: identity.id,
        triggeredById,
        triggerType: 'manual_upload',
        sourceSystems: [sourceSystem],
        status: 'running',
        metadata: {
          importFormat,
          publicationCount: publications.length,
        },
      },
    });

    const summary = {
      discoveredCount: publications.length,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      specialReviewCount: 0,
      errors: [],
      contributions: [],
    };

    try {
      for (const [index, publication] of publications.entries()) {
        try {
          const candidate = this._mapManualImportCandidate(publication, user, sourceSystem, index);
          const result = await this._upsertCandidate(user, identity, candidate);
          summary[result.outcome] += 1;
          if (result.specialReviewRequired) {
            summary.specialReviewCount += 1;
          }
          if (result.contributionId) {
            summary.contributions.push(result.contributionId);
          }
        } catch (error) {
          summary.failedCount += 1;
          summary.errors.push({
            title: publication?.title,
            message: error.message,
          });
          log.error('Failed to import manual publication', {
            userId,
            title: publication?.title,
            error: error.message,
          });
        }
      }

      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: summary.failedCount > 0 ? 'partial_success' : 'success',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: summary.failedCount,
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: summary.errors,
        },
      });

      await this.prisma.researchProfileIdentity.update({
        where: { id: identity.id },
        data: {
          syncStatus: summary.failedCount > 0 ? 'failed' : 'success',
          syncError: summary.failedCount > 0 ? `${summary.failedCount} publication(s) failed during import` : null,
          lastSyncedAt: new Date(),
        },
      });

      return { runId: run.id, ...summary };
    } catch (error) {
      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: Math.max(summary.failedCount, 1),
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: [...summary.errors, { message: error.message }],
        },
      });

      await this.prisma.researchProfileIdentity.update({
        where: { id: identity.id },
        data: {
          syncStatus: 'failed',
          syncError: error.message,
          lastSyncedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async syncFacultyPublications(userId, options = {}) {
    this._authorMatchCache = new Map();
    this._openAlexInstCache = null;
    const {
      triggeredById = null,
      triggerType = 'manual',
      sourcePreference = 'all',
    } = options;

    const user = await this.prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: {
          include: {
            primaryDepartment: true,
            primarySchool: true,
          },
        },
        researchProfileIdentity: true,
      },
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    await this._loadAffiliationContext(user);

    let identity = user.researchProfileIdentity;
    if (!identity) {
      identity = await this.prisma.researchProfileIdentity.upsert({
        where: { userId },
        update: {},
        create: {
          user: { connect: { id: userId } },
        },
      });
    }

    const sourceSystems = this._determineSourceSystems(identity, sourcePreference);
    if (sourceSystems.length === 0) {
      const error = new Error('Faculty research identity is not configured');
      error.statusCode = 400;
      throw error;
    }

    // ── Concurrent-sync guard ──────────────────────────────────────────────
    // If a sync run is already in-progress for this identity, bail out to
    // prevent race conditions that can create duplicate contributions.
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min
    const runningRun = await this.prisma.publicationImportRun.findFirst({
      where: {
        researchProfileId: identity.id,
        status: 'running',
        // Ignore stuck/stale runs older than 30 minutes
        startedAt: { gte: staleThreshold },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (runningRun) {
      log.warn('Sync already in progress, skipping duplicate trigger', {
        userId,
        runningRunId: runningRun.id,
        startedAt: runningRun.startedAt,
      });
      return {
        runId: runningRun.id,
        discoveredCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        specialReviewCount: 0,
        errors: [{ title: 'Sync skipped', message: 'Another sync is already running for this user' }],
        contributions: [],
      };
    }

    const run = await this.prisma.publicationImportRun.create({
      data: {
        researchProfileId: identity.id,
        triggeredById,
        triggerType: this._cleanString(triggerType, 32) || 'manual',
        sourceSystems,
        status: 'running',
      },
    });

    const summary = {
      discoveredCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      specialReviewCount: 0,
      errors: [],
      contributions: [],
    };

    try {
      const { candidates, sourceErrors } = await this._discoverCandidates(user, identity, run.sourceSystems);
      summary.discoveredCount = candidates.length;
      if (sourceErrors.length > 0) {
        summary.failedCount += sourceErrors.length;
        summary.errors.push(...sourceErrors.map((item) => ({
          title: `${String(item.source || 'external').toUpperCase()} sync`,
          message: item.message,
        })));
      }

      for (const candidate of candidates) {
        try {
          const result = await this._upsertCandidate(user, identity, candidate);
          summary[result.outcome] += 1;
          if (result.specialReviewRequired) {
            summary.specialReviewCount += 1;
          }
          if (result.contributionId) {
            summary.contributions.push(result.contributionId);
          }
        } catch (error) {
          summary.failedCount += 1;
          summary.errors.push({
            title: candidate.title,
            message: error.message,
          });
          log.error('Failed to import candidate', { userId, title: candidate.title, error: error.message });
        }
      }

      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: summary.failedCount > 0 ? 'partial_success' : 'success',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: summary.failedCount,
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: summary.errors,
        },
      });

      await this.prisma.researchProfileIdentity.update({
        where: { id: identity.id },
        data: {
          syncStatus: summary.failedCount > 0 ? 'failed' : 'success',
          syncError: summary.failedCount > 0 ? `${summary.failedCount} issue(s) encountered during sync` : null,
          lastSyncedAt: new Date(),
        },
      });

      this._authorMatchCache = null;
      this._openAlexInstCache = null;
      return { runId: run.id, ...summary };
    } catch (error) {
      this._authorMatchCache = null;
      this._openAlexInstCache = null;
      await this.prisma.publicationImportRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          discoveredCount: summary.discoveredCount,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          failedCount: Math.max(summary.failedCount, 1),
          specialReviewCount: summary.specialReviewCount,
          finishedAt: new Date(),
          errorSummary: [...summary.errors, { message: error.message }],
        },
      });

      await this.prisma.researchProfileIdentity.update({
        where: { id: identity.id },
        data: {
          syncStatus: 'failed',
          syncError: error.message,
          lastSyncedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async runScheduledSync() {
    const now = new Date();
    const identities = await this.prisma.researchProfileIdentity.findMany({
      where: {
        autoSyncEnabled: true,
      },
      select: {
        userId: true,
        lastSyncedAt: true,
        syncFrequencyDays: true,
      },
      take: 500,
    });

    const results = [];
    const dueIdentities = identities.filter((identity) => this._isSyncDue(identity, now));

    for (const identity of dueIdentities) {
      try {
        const result = await this.syncFacultyPublications(identity.userId, {
          triggerType: 'scheduled',
        });
        results.push({ userId: identity.userId, status: 'success', result });
      } catch (error) {
        results.push({ userId: identity.userId, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  async _upsertCandidate(user, identity, candidate) {
    // When "Filter SGT / home-university publications only" is enabled, import
    // ONLY if the paper is home-institution affiliated. Scopus search payloads
    // often omit author/affiliation fields even for AF-ID-filtered results, so
    // we also honor trustedHomeInstitutionQuery set during discovery.
    if (identity.filterSgtOnly) {
      const ownerAuthor = this._matchOwningFaculty(candidate.authors || [], user, identity);
      const isHome = this._isHomeInstitutionAuthor(ownerAuthor, candidate)
        || Boolean(candidate.trustedHomeInstitutionQuery);
      if (!isHome) {
        return { outcome: 'skippedCount', contributionId: null, specialReviewRequired: false };
      }
    }

    const existing = await this._findExistingContribution(user.id, candidate);
    const payload = await this._buildContributionInput(user, identity, candidate, existing);

    if (existing) {
      const updated = await this._updateExistingContribution(existing, payload, candidate);
      await this._upsertImportLinks(identity.id, updated.id, candidate);
      return {
        outcome: updated._outcome || 'updatedCount',
        contributionId: updated.id,
        specialReviewRequired: Boolean(updated.specialReviewRequired),
      };
    }

    const created = await this.contributionService.createContribution(payload, {});
    await this._ensureContributionAuthors(created.id, payload);
    await this._upsertImportLinks(identity.id, created.id, candidate);
    try {
      await this.contributionService.submitContribution(created.id, user.id, null);
    } catch (submitErr) {
      // Ignore if a concurrent import already advanced the status beyond draft
      if (submitErr.statusCode !== 400 || !submitErr.message.startsWith('Cannot submit contribution in status')) {
        throw submitErr;
      }
    }

    return {
      outcome: 'createdCount',
      contributionId: created.id,
      specialReviewRequired: Boolean(payload.specialReviewRequired),
    };
  }

  async _findExistingContribution(userId, candidate) {
    const normalizedTitle = this._normalizeTitle(candidate.title);
    const publishedYear = candidate.publicationDate ? new Date(candidate.publicationDate).getFullYear() : null;

    // ── 1. Try publicationImport index (fastest — direct FK lookup) ────────
    for (const [sourceSystem, externalId] of Object.entries(candidate.externalIds || {})) {
      if (!externalId) continue;
      const publicationImport = await this.prisma.publicationImport.findUnique({
        where: {
          sourceSystem_externalId: {
            sourceSystem,
            externalId: String(externalId),
          },
        },
        include: {
          researchContribution: true,
        },
      });
      if (publicationImport?.researchContribution?.applicantUserId === userId) {
        return publicationImport.researchContribution;
      }
    }

    // ── 2. Fallback: search by DOI field ──────────────────────────────────
    if (candidate.doi) {
      const byDoi = await this.prisma.researchContribution.findFirst({
        where: {
          applicantUserId: userId,
          doi: candidate.doi,
        },
      });
      if (byDoi) return byDoi;
    }

    // ── 3. Fallback: search by externalIds JSON values (catches orphaned   ──
    //        duplicates whose publicationImport link was not created, e.g.  ──
    //        due to concurrent sync runs)                                   ──
    for (const [, externalId] of Object.entries(candidate.externalIds || {})) {
      if (!externalId) continue;
      const byExternalId = await this.prisma.researchContribution.findFirst({
        where: {
          applicantUserId: userId,
          externalIds: { path: [], string_contains: String(externalId) },
        },
      });
      if (byExternalId) return byExternalId;
    }

    // ── 4. Last-resort: normalized-title + year match ─────────────────────
    return this.prisma.researchContribution.findFirst({
      where: {
        applicantUserId: userId,
        title: { equals: candidate.title, mode: 'insensitive' },
        ...(publishedYear ? {
          publicationDate: {
            gte: new Date(`${publishedYear}-01-01T00:00:00.000Z`),
            lte: new Date(`${publishedYear}-12-31T23:59:59.999Z`),
          },
        } : {}),
      },
    }).then((record) => {
      if (!record) return null;
      const existingTitle = this._normalizeTitle(record.title);
      return existingTitle === normalizedTitle ? record : null;
    });
  }

  async _updateExistingContribution(existing, payload, candidate) {
    const immutableStatuses = ['approved', 'completed', 'rejected'];
    const currentImportMetadata = this._asObject(existing.importMetadata);
    const currentProvenance = this._asObject(existing.fieldProvenance);

    const patch = {};
    const autoFields = [
      'abstract',
      'keywords',
      'journalName',
      'issn',
      'publisherName',
      'issue',
      'pageNumbers',
      'doi',
      'weblink',
      'paperweblink',
      'publicationDate',
      'conferenceName',
      'conferenceLocation',
      'conferenceDate',
      'proceedingsTitle',
      'bookTitle',
      'chapterNumber',
      'isbn',
      'edition',
      'publisherLocation',
      'proceedingsQuartile',
      'bookIndexingType',
      'conferenceSubType',
      'quartile',
      'sjr',
      'impactFactor',
      'naasRating',
      'subsidiaryImpactFactor',
      'volume',
      'sourceType',
      'sourceSystems',
      'externalIds',
      'lastSyncedAt',
      'specialReviewRequired',
      'importConfidence',
      'missingFields',
      'autoCalculatedFields',
      'fieldProvenance',
      'importMetadata',
      'indexingCategories',
      'indexingDetails',
    ];

    for (const field of autoFields) {
      const nextValue = payload[field];
      const currentValue = existing[field];
      const provenance = currentProvenance[field];
      const isEditableAutoField = provenance === 'auto' || provenance === undefined || provenance === null;

      if (immutableStatuses.includes(existing.status) && field !== 'lastSyncedAt' && field !== 'importMetadata' && field !== 'sourceSystems' && field !== 'indexingDetails') {
        continue;
      }

      if (!isEditableAutoField && field !== 'lastSyncedAt' && field !== 'importMetadata' && field !== 'indexingDetails') {
        continue;
      }

      if (field === 'indexingDetails') {
        if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
          patch[field] = nextValue;
        }
      } else if (field === 'publicationDate') {
        // Allow overwriting year-only defaults (YYYY-01-01) with more precise dates
        const isCurrentYearOnly = currentValue && String(currentValue).includes('T') && new Date(currentValue).getDate() === 1 && new Date(currentValue).getMonth() === 0;
        const isCurrentMonthFirst = currentValue && String(currentValue).includes('T') && new Date(currentValue).getDate() === 1;
        const newDate = nextValue ? new Date(nextValue) : null;
        const currentDate = currentValue ? new Date(currentValue) : null;
        // Replace if: no current value, or current is year-only (Jan 1st) and new date is more specific
        if (!currentValue || (isCurrentYearOnly && newDate && newDate.getDate() !== 1)) {
          patch[field] = newDate;
        } else if (isCurrentMonthFirst && newDate && !(newDate.getDate() === 1 && newDate.getMonth() === 0)) {
          // Current is month-first (day=1) and new has actual day
          patch[field] = newDate;
        }
      } else if (this._shouldApplyAutoValue(currentValue, nextValue)) {
        patch[field] = nextValue;
      }
    }

    patch.lastSyncedAt = new Date();
    patch.importMetadata = {
      ...currentImportMetadata,
      ...this._asObject(payload.importMetadata),
      lastSeenCandidate: {
        title: candidate.title,
        publicationDate: candidate.publicationDate || null,
      },
    };
    patch.sourceSystems = Array.from(new Set([...(existing.sourceSystems || []), ...(payload.sourceSystems || [])]));

    if (Object.keys(patch).length === 2 && patch.lastSyncedAt && patch.importMetadata) {
      return { ...existing, _outcome: 'skippedCount' };
    }

    const updated = await this.prisma.researchContribution.update({
      where: { id: existing.id },
      data: patch,
    });

    await this._ensureContributionAuthors(existing.id, payload);

    if (existing.status === 'draft' && existing.sourceType === 'auto_import') {
      await this.contributionService.submitContribution(existing.id, existing.applicantUserId, null);
    }

    return { ...updated, _outcome: 'updatedCount' };
  }

  async _ensureContributionAuthors(contributionId, payload) {
    const expected = Array.isArray(payload.authors) ? payload.authors.length : 0;
    if (expected <= 1) return;

    const existingCount = await this.prisma.researchContributionAuthor.count({
      where: { researchContributionId: contributionId },
    });

    const payloadHasScopusIds = payload.authors.some((author) => author.scopusAuthorId);
    let storedScopusCount = 0;
    if (payloadHasScopusIds) {
      storedScopusCount = await this.prisma.researchContributionAuthor.count({
        where: {
          researchContributionId: contributionId,
          scopusAuthorId: { not: null },
        },
      });
    }

    const shouldReplace =
      existingCount < expected
      || (payloadHasScopusIds && storedScopusCount === 0 && existingCount >= expected);

    if (!shouldReplace) return;

    await this.contributionService.replaceImportedAuthors(contributionId, payload);
  }

  async _upsertImportLinks(researchProfileId, contributionId, candidate) {
    const entries = Object.entries(candidate.externalIds || {}).filter(([, value]) => value);

    for (const [sourceSystem, externalId] of entries) {
      const existingImport = await this.prisma.publicationImport.findUnique({
        where: {
          sourceSystem_externalId: {
            sourceSystem,
            externalId: String(externalId),
          },
        },
      });

      const sharedData = {
        doi: this._cleanString(candidate.doi, 256),
        publishedYear: candidate.publicationDate ? new Date(candidate.publicationDate).getFullYear() : null,
        normalizedTitle: this._cleanString(this._normalizeTitle(candidate.title), 512),
        lastSeenAt: new Date(),
        metadata: {
          title: candidate.title,
          sourceSystems: candidate.sourceSystems,
        },
      };

      if (!existingImport) {
        try {
          await this.prisma.publicationImport.create({
            data: {
              researchProfile: { connect: { id: researchProfileId } },
              researchContribution: { connect: { id: contributionId } },
              sourceSystem,
              externalId: String(externalId),
              ...sharedData,
            },
          });
        } catch (createErr) {
          // P2002 = unique constraint — a concurrent sync inserted the same row
          if (createErr.code !== 'P2002') throw createErr;
          const concurrent = await this.prisma.publicationImport.findUnique({
            where: { sourceSystem_externalId: { sourceSystem, externalId: String(externalId) } },
          });
          if (concurrent && concurrent.researchProfileId === researchProfileId) {
            await this.prisma.publicationImport.update({
              where: { id: concurrent.id },
              data: { researchContributionId: contributionId, ...sharedData },
            });
          }
        }
        continue;
      }

      if (existingImport.researchProfileId !== researchProfileId) {
        continue;
      }

      await this.prisma.publicationImport.update({
        where: { id: existingImport.id },
        data: {
          researchContributionId: contributionId,
          ...sharedData,
        },
      });
    }
  }

  async _buildContributionInput(user, identity, candidate, existing) {
    const mapped = await this._resolveAuthors(candidate.authors || [], user, identity);
    const publicationType = this._inferPublicationType(candidate);
    const indexingCategories = this._deriveIndexingCategories(candidate);
    const missingFields = this._collectMissingFields(publicationType, candidate, indexingCategories, mapped);
    const specialReviewRequired = missingFields.length > 0 || mapped.hasAmbiguousInternalMatches;
    const importConfidence = this._calculateConfidence(missingFields, mapped);
    const fieldProvenance = {};
    const autoCalculatedFields = [];

    const payload = {
      userId: user.id,
      userRole: user.role,
      publicationType,
      title: candidate.title,
      abstract: candidate.abstract || null,
      keywords: Array.isArray(candidate.keywords) ? candidate.keywords.join(', ') : null,
      indexingCategories,
      quartile: candidate.quartile || null,
      sjr: candidate.sjr || null,
      impactFactor: candidate.impactFactor || null,
      naasRating: candidate.naasRating || null,
      subsidiaryImpactFactor: candidate.subsidiaryImpactFactor || null,
      journalName: candidate.journalName || candidate.venue || null,
      issue: candidate.issue || null,
      pageNumbers: candidate.pageNumbers || null,
      doi: candidate.doi || null,
      issn: candidate.issn || null,
      publisherName: candidate.publisherName || null,
      isbn: candidate.isbn || null,
      edition: candidate.edition || null,
      chapterNumber: candidate.chapterNumber || null,
      bookTitle: candidate.bookTitle || null,
      editors: candidate.editors || null,
      publisherLocation: candidate.publisherLocation || null,
      conferenceName: candidate.conferenceName || null,
      conferenceLocation: candidate.conferenceLocation || null,
      conferenceDate: candidate.conferenceDate || null,
      proceedingsTitle: candidate.proceedingsTitle || null,
      publicationDate: candidate.publicationDate || null,
      publicationStatus: candidate.publicationStatus || 'published',
      volume: candidate.volume || null,
      weblink: candidate.weblink || null,
      paperweblink: candidate.weblink || null,
      conferenceSubType: candidate.conferenceSubType || null,
      proceedingsQuartile: candidate.proceedingsQuartile || null,
      bookType: candidate.bookType || candidate.bookPublicationType || 'authored',
      bookPublicationType: candidate.bookPublicationType || candidate.bookType || 'authored',
      bookIndexingType: candidate.bookIndexingType || null,
      nationalInternational: candidate.nationalInternational || null,
      indexedIn: candidate.indexedIn || null,
      conferenceType: candidate.conferenceType || null,
      internationalAuthor: mapped.internationalAuthor,
      foreignCollaborationsCount: mapped.foreignCollaborationsCount,
      totalAuthors: mapped.authors.length,
      sgtAffiliatedAuthors: mapped.sgtAffiliatedAuthors,
      internalCoAuthors: mapped.internalCoAuthors,
      sourceType: 'auto_import',
      sourceSystems: candidate.sourceSystems || [],
      externalIds: candidate.externalIds || {},
      importedAt: existing?.importedAt || new Date(),
      lastSyncedAt: new Date(),
      specialReviewRequired,
      importConfidence,
      missingFields,
      autoCalculatedFields,
      fieldProvenance,
      importMetadata: {
        source: 'auto_import',
        sourceSystems: candidate.sourceSystems || [],
        rawExternalIds: candidate.externalIds || {},
        specialReviewRequired,
        importConfidence,
        missingFields,
      },
      indexingDetails: {
        ...(this._asObject(existing?.indexingDetails)),
        sourceSystems: candidate.sourceSystems || [],
        specialReviewRequired,
        importConfidence,
        citationCount: candidate.citationCount !== undefined ? candidate.citationCount : (this._asObject(existing?.indexingDetails)?.citationCount || 0),
        // Store affiliation summary for each source system
        affiliationSummary: this._buildAffiliationSummary(candidate.authors || [], mapped.sgtAffiliatedAuthors),
      },
      authors: mapped.authors,
      applicantDetails: {
        uid: user.uid,
        email: user.email,
        universityDeptName: user.employeeDetails?.primaryDepartment?.departmentName || null,
        metadata: {
          sourceType: 'auto_import',
          identityId: identity.id,
        },
      },
    };

    Object.keys(payload).forEach((field) => {
      if (field === 'authors' || field === 'applicantDetails') return;
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        fieldProvenance[field] = 'auto';
        autoCalculatedFields.push(field);
      }
    });

    payload.fieldProvenance = fieldProvenance;
    payload.autoCalculatedFields = Array.from(new Set(autoCalculatedFields));

    return payload;
  }

  async _resolveAuthors(authors, user, identity) {
    const resolvedAuthors = [];
    const ownerAuthor = this._matchOwningFaculty(authors, user, identity);
    const seenKeys = new Set();
    // Track matched internal user DB IDs to prevent the same person appearing twice
    // under different name representations (e.g. "Prateek Agrawal" vs "Agrawal P.")
    const seenUserIds = new Set([user.id]);
    let sgtAffiliatedAuthors = 0;
    let internalCoAuthors = 0;
    let foreignCollaborationsCount = 0;
    let internationalAuthor = false;
    let hasAmbiguousInternalMatches = false;

    const ownerPayload = await this._buildInternalAuthor(user, ownerAuthor || {
      name: user.employeeDetails?.displayName || user.uid,
      email: user.email,
      affiliation: user.employeeDetails?.primarySchool?.facultyName || this._canonicalUniversityName,
      isCorresponding: Boolean(ownerAuthor?.isCorresponding),
      authorOrder: 1,
    }, 1);

    resolvedAuthors.push(ownerPayload);
    seenKeys.add(this._authorDedupKey(ownerPayload));
    sgtAffiliatedAuthors += 1;

    for (const [index, author] of authors.entries()) {
      const matched = await this._matchInternalAuthor(author);
      const isSgtAffiliation = author.isSgtByAfid || this._isSgtAffiliation(author.affiliation);
      const order = Number(author.authorOrder || index + 1);
      const authorKey = this._authorDedupKey({
        userId: matched?.user?.id,
        email: author.email,
        name: author.name,
      });

      // Skip if already seen by dedup key OR if the matched user is the owner / already added
      if (seenKeys.has(authorKey) || (matched?.user && seenUserIds.has(matched.user.id))) {
        continue;
      }

      let finalAuthor;
      if (matched?.user) {
        seenUserIds.add(matched.user.id);
        finalAuthor = await this._buildInternalAuthor(matched.user, author, order);
        sgtAffiliatedAuthors += 1;
        if (order > 1) internalCoAuthors += 1;
      } else {
        const normalizedType = isSgtAffiliation ? 'internal_faculty' : 'external_academic';
        finalAuthor = {
          uid: null,
          registrationNumber: null,
          name: this._cleanString(author.name, 256) || `Author ${order}`,
          email: this._cleanString(author.email, 256),
          phone: null,
          affiliation: this._cleanString(author.affiliation, 256),
          country: this._cleanString(author.country, 64),
          department: this._cleanString(author.department, 256),
          designation: this._cleanString(author.designation, 256),
          orderNumber: order,
          authorPosition: order,
          isCorresponding: Boolean(author.isCorresponding),
          authorRole: this._deriveAuthorRole(order, Boolean(author.isCorresponding)),
          authorType: normalizedType,
          isInternational: !isSgtAffiliation,
          scopusAuthorId: this._normalizeScopusAuthorId(author.scopusAuthorId),
        };

        if (isSgtAffiliation) {
          sgtAffiliatedAuthors += 1;
          if (order > 1) internalCoAuthors += 1;
          hasAmbiguousInternalMatches = true;
        } else {
          foreignCollaborationsCount += 1;
          internationalAuthor = true;
        }
      }

      resolvedAuthors.push(finalAuthor);
      seenKeys.add(authorKey);
    }

    return {
      authors: resolvedAuthors.sort((left, right) => (left.orderNumber || 1) - (right.orderNumber || 1)),
      sgtAffiliatedAuthors,
      internalCoAuthors,
      foreignCollaborationsCount,
      internationalAuthor,
      hasAmbiguousInternalMatches,
    };
  }

  _matchOwningFaculty(authors, user, identity) {
    const authorList = Array.isArray(authors) ? authors : [];
    const normalizedName = this._normalizeName(user.employeeDetails?.displayName || user.uid);

    // Strongest signal: the user's registered Scopus Author ID matches the paper's author authid
    const userScopusId = this._normalizeScopusAuthorId(identity?.scopusAuthorId);
    if (userScopusId) {
      const byScopusId = authorList.find(
        (author) => this._normalizeScopusAuthorId(author.scopusAuthorId) === userScopusId
      );
      if (byScopusId) return byScopusId;
    }

    const byEmail = authorList.find((author) =>
      author.email && user.email && author.email.toLowerCase() === user.email.toLowerCase()
    );
    if (byEmail) {
      return byEmail;
    }

    const byNameAndAffiliation = authorList.find((author) =>
      this._normalizeName(author.name) === normalizedName && (author.isSgtByAfid || this._isSgtAffiliation(author.affiliation))
    );
    if (byNameAndAffiliation) {
      return byNameAndAffiliation;
    }

    const sameNameAuthors = authorList.filter((author) => this._normalizeName(author.name) === normalizedName);
    return sameNameAuthors.length === 1 ? sameNameAuthors[0] : null;
  }

  _isSyncDue(identity, now = new Date()) {
    if (!identity?.lastSyncedAt) {
      return true;
    }

    const syncFrequencyDays = Math.max(1, Number(identity.syncFrequencyDays) || 1);
    const threshold = now.getTime() - syncFrequencyDays * 24 * 60 * 60 * 1000;
    return new Date(identity.lastSyncedAt).getTime() <= threshold;
  }

  async _matchInternalAuthor(author) {
    const email = this._cleanString(author.email, 256);
    const uid = this._cleanString(author.uid || author.registrationNumber, 64);
    const scopusAuthorId = this._normalizeScopusAuthorId(author.scopusAuthorId);
    const normalizedName = this._normalizeName(author.name);

    // Create a unique lookup key for this author
    const cacheKey = `${scopusAuthorId || ''}|${email || ''}|${uid || ''}|${normalizedName || ''}`;
    if (this._authorMatchCache && this._authorMatchCache.has(cacheKey)) {
      return this._authorMatchCache.get(cacheKey);
    }

    const performMatch = async () => {
      // Highest-confidence match: Scopus Author ID stored in the user's research profile
      if (scopusAuthorId) {
        const byProfile = await this.prisma.researchProfileIdentity.findFirst({
          where: { scopusAuthorId },
          include: {
            user: { include: { employeeDetails: true, studentLogin: true } },
          },
        }).catch(() => null);
        if (byProfile?.user) return { user: byProfile.user, confidence: 1 };
      }

      if (email) {
        const byEmail = await this.prisma.userLogin.findUnique({
          where: { email },
          include: { employeeDetails: true, studentLogin: true },
        }).catch(() => null);
        if (byEmail) return { user: byEmail, confidence: 1 };
      }

      if (uid) {
        const byUid = await this.prisma.userLogin.findUnique({
          where: { uid },
          include: { employeeDetails: true, studentLogin: true },
        }).catch(() => null);
        if (byUid) return { user: byUid, confidence: 1 };
      }

      const candidates = await this.prisma.userLogin.findMany({
        where: {
          employeeDetails: {
            displayName: {
              equals: author.name,
              mode: 'insensitive',
            },
          },
        },
        include: {
          employeeDetails: true,
          studentLogin: true,
        },
        take: 3,
      });

      if (candidates.length === 1 && (author.isSgtByAfid || this._isSgtAffiliation(author.affiliation))) {
        return { user: candidates[0], confidence: 0.7 };
      }

      if (candidates.length > 1 && (author.isSgtByAfid || this._isSgtAffiliation(author.affiliation))) {
        const exact = candidates.find((item) => this._normalizeName(item.employeeDetails?.displayName || '') === normalizedName);
        if (exact) {
          return { user: exact, confidence: 0.55 };
        }
      }

      return null;
    };

    const result = await performMatch();
    if (this._authorMatchCache) {
      this._authorMatchCache.set(cacheKey, result);
    }
    return result;
  }

  async _buildInternalAuthor(user, author, order) {
    const isStudent = Boolean(user.studentLogin);
    const profileScopus = user.researchProfileIdentity?.scopusAuthorId;
    return {
      uid: user.uid,
      registrationNumber: isStudent ? user.uid : null,
      name: this._cleanString(author.name || user.employeeDetails?.displayName || user.uid, 256),
      email: this._cleanString(author.email || user.email, 256),
      phone: this._cleanString(author.phone || user.employeeDetails?.phoneNumber, 20),
      affiliation: this._cleanString(author.affiliation || user.employeeDetails?.primarySchool?.facultyName || this._canonicalUniversityName, 256),
      department: this._cleanString(author.department || user.employeeDetails?.primaryDepartment?.departmentName, 256),
      designation: this._cleanString(author.designation || user.employeeDetails?.designation, 256),
      orderNumber: order,
      authorPosition: order,
      isCorresponding: Boolean(author.isCorresponding),
      authorRole: this._deriveAuthorRole(order, Boolean(author.isCorresponding)),
      authorType: isStudent ? 'internal_student' : 'internal_faculty',
      isInternational: false,
      scopusAuthorId:
        this._normalizeScopusAuthorId(author.scopusAuthorId)
        || this._normalizeScopusAuthorId(profileScopus),
    };
  }

  async _discoverCandidates(user, identity, sourceSystems) {
    const byKey = new Map();
    const sourceErrors = [];

    const mergeWorks = (works) => {
      for (const work of works) {
        const key = this._candidateKey(work);
        const existing = byKey.get(key);
        byKey.set(key, existing ? this._mergeCandidate(existing, work) : work);
      }
    };

    const collectSource = async (source, shouldFetch, fetcher) => {
      if (!shouldFetch) {
        return;
      }

      try {
        mergeWorks(await fetcher());
      } catch (error) {
        sourceErrors.push({ source, message: error.message });
        log.warn('Skipping source after fetch failure', {
          userId: user.id,
          source,
          error: error.message,
        });
      }
    };

    await collectSource('orcid', sourceSystems.includes('orcid') && identity.orcid, async () =>
      this._fetchOrcidWorks(identity.orcid)
    );

    await collectSource('scopus', sourceSystems.includes('scopus') && identity.scopusAuthorId, async () =>
      this._fetchScopusWorks(identity.scopusAuthorId, { filterSgtOnly: Boolean(identity.filterSgtOnly) })
    );

    await collectSource('openalex', sourceSystems.includes('openalex'), async () =>
      this._fetchOpenAlexWorks(user, identity, { filterSgtOnly: Boolean(identity.filterSgtOnly) })
    );

    const values = Array.from(byKey.values()).filter((item) => item.title);
    values.sort((left, right) => new Date(right.publicationDate || 0).getTime() - new Date(left.publicationDate || 0).getTime());
    return { candidates: values, sourceErrors };
  }

  async _fetchOrcidWorks(orcid) {
    const headers = {
      Accept: 'application/json',
      ...(process.env.ORCID_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.ORCID_ACCESS_TOKEN}` } : {}),
    };

    let worksResponse;
    try {
      worksResponse = await fetch(`${DEFAULT_ORCID_BASE_URL}/${encodeURIComponent(orcid)}/works`, { headers });
    } catch (error) {
      throw new Error(`ORCID works fetch failed: ${error.message}`);
    }

    if (!worksResponse || !worksResponse.ok) {
      throw new Error(`ORCID works fetch failed (${worksResponse?.status || 'no response'})`);
    }

    const worksJson = await worksResponse.json();
    const groups = Array.isArray(worksJson.group) ? worksJson.group : [];
    const works = [];

    for (const group of groups) {
      const summaries = Array.isArray(group['work-summary']) ? group['work-summary'] : [];
      for (const summary of summaries) {
        const putCode = summary['put-code'];
        let detail = null;

        if (putCode !== undefined && putCode !== null) {
          try {
            const detailResponse = await fetch(`${DEFAULT_ORCID_BASE_URL}/${encodeURIComponent(orcid)}/work/${putCode}`, { headers });
            if (detailResponse && detailResponse.ok) {
              detail = await detailResponse.json();
            }
          } catch (error) {
            log.warn('Skipping ORCID detail fetch failure', { orcid, putCode, error: error.message });
          }
        }

        works.push(this._mapOrcidWork(summary, detail));
      }
    }

    return works;
  }

  async _fetchScopusWorks(scopusAuthorId, options = {}) {
    if (!process.env.SCOPUS_API_KEY) {
      log.warn('SCOPUS_API_KEY is not configured; skipping Scopus enrichment');
      return [];
    }

    const { filterSgtOnly = false } = options;
    const useAfidFilter = filterSgtOnly && this._isSgtTenant() && SGT_SCOPUS_AFFIL_IDS.size > 0;
    let query = `AU-ID(${scopusAuthorId})`;
    // When home-university filter is on for the SGT tenant, constrain Scopus at
    // the API level using known SGT affiliation IDs.
    if (useAfidFilter) {
      const afidClause = Array.from(SGT_SCOPUS_AFFIL_IDS)
        .map((id) => `AF-ID(${id})`)
        .join(' OR ');
      query = `AU-ID(${scopusAuthorId}) AND (${afidClause})`;
    }

    const allEntries = [];
    let start = 0;
    // Elsevier Scopus Search API tier limits items per page (often max 25).
    const count = Math.min(
      parseInt(process.env.SCOPUS_SEARCH_PAGE_SIZE || '25', 10) || 25,
      25
    );
    let totalResults = 0;

    do {
      // Avoid restrictive `field=` projection — it often strips author/affiliation
      // arrays from search results, which breaks affiliation filtering.
      const params = new URLSearchParams({
        query,
        count: String(count),
        start: String(start),
      });

      let response;
      try {
        response = await fetch(`${DEFAULT_SCOPUS_BASE_URL}/search/scopus?${params.toString()}`, {
          headers: {
            'X-ELS-APIKey': process.env.SCOPUS_API_KEY,
            Accept: 'application/json',
          },
        });
      } catch (error) {
        throw new Error(`Scopus search failed: ${error.message}`);
      }

      if (!response || !response.ok) {
        let detail = '';
        try {
          const errJson = await response.json();
          detail = errJson?.['service-error']?.status?.statusText
            || errJson?.['service-error']?.status?.statusCode
            || '';
        } catch {
          // ignore parse errors
        }
        const suffix = detail ? `: ${detail}` : '';
        throw new Error(`Scopus search failed (${response?.status || 'no response'})${suffix}`);
      }

      const json = await response.json();
      const searchResults = json?.['search-results'];
      totalResults = parseInt(searchResults?.['opensearch:totalResults'] || '0', 10);

      const entries = searchResults?.entry;
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        break;
      }

      if (entries.length === 1 && entries[0]?.error) {
        log.warn('Scopus returned error entry:', entries[0].error);
        break;
      }

      allEntries.push(...entries);
      start += entries.length;

      if (start >= totalResults || start >= 1000) {
        break;
      }
    } while (start < totalResults);

    return allEntries.map((entry) => {
      const mapped = this._mapScopusWork(entry);
      // AF-ID constrained query already guarantees home-institution papers.
      // Search payloads frequently omit author rows — mark as trusted so the
      // local filter does not drop every result.
      if (useAfidFilter) {
        mapped.trustedHomeInstitutionQuery = true;
        mapped.homeInstitutionOnPaper = true;
      }
      return mapped;
    });
  }

  async _fetchOpenAlexWorks(user, identity, options = {}) {
    const { filterSgtOnly = false } = options;
    const rawName = this._cleanString(user.employeeDetails?.displayName || user.uid, 256);
    if (!rawName) {
      return [];
    }
    // Strip common academic title prefixes/suffixes so OpenAlex can match cleanly
    const authorName = rawName
      .replace(/^(Prof\.?|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '')
      .replace(/\s*,?\s*(Ph\.?D\.?|M\.?D\.?|M\.?B\.?A\.?|M\.?Tech\.?|B\.?Tech\.?|MBA|PhD|MD|MS|MSc|BSc)(\.?\s*,?\s*(Ph\.?D\.?|M\.?D\.?|MBA|PhD|MD))*\s*$/i, '')
      .trim();
    if (!authorName) {
      return [];
    }

    const institutionId = await this._findOpenAlexInstitutionId(identity, user);
    const authorId = await this._findBestOpenAlexAuthorId(authorName, institutionId, identity, {
      requireInstitution: filterSgtOnly,
    });
    if (!authorId) {
      log.warn('No OpenAlex author match found', { userId: user.id, authorName });
      return [];
    }

    const normalizedAuthorId = this._toOpenAlexFilterId(authorId);
    const normalizedInstitutionId = this._toOpenAlexFilterId(institutionId);
    const allResults = [];
    let page = 1;
    const perPage = 100;
    let totalCount = 0;

    do {
      const filterParts = [`author.id:${normalizedAuthorId}`];
      if (filterSgtOnly && normalizedInstitutionId) {
        filterParts.push(`institutions.id:${normalizedInstitutionId}`);
      }
      const params = new URLSearchParams({
        filter: filterParts.join(','),
        sort: 'publication_date:desc',
        'per-page': String(perPage),
        page: String(page),
      });

      let response;
      try {
        response = await fetch(`${DEFAULT_OPENALEX_BASE_URL}/works?${params.toString()}`, {
          headers: this._openAlexHeaders(),
        });
      } catch (error) {
        throw new Error(`OpenAlex works fetch failed: ${error.message}`);
      }

      if (!response || !response.ok) {
        throw new Error(`OpenAlex works fetch failed (${response?.status || 'no response'})`);
      }

      const json = await response.json();
      totalCount = json?.meta?.count || 0;
      const results = Array.isArray(json?.results) ? json.results : [];
      if (results.length === 0) {
        break;
      }

      allResults.push(...results);

      if (allResults.length >= totalCount || allResults.length >= 1000) {
        break;
      }

      page += 1;
    } while (allResults.length < totalCount);

    return allResults.map((work) => this._mapOpenAlexWork(work));
  }

  async _findOpenAlexInstitutionId(identity, user) {
    if (this._openAlexInstCache) {
      return this._openAlexInstCache;
    }

    // Build the OpenAlex institution search candidate list from the tenant's
    // dynamically-generated affiliation variants (favouring longer/more
    // specific variants first, since OpenAlex's fuzzy search performs best
    // with fuller names) plus any per-user aliases and their school name.
    const sortedVariants = [...this._affiliationVariants].sort((a, b) => b.length - a.length);
    const candidates = [
      this._canonicalUniversityName,
      ...(Array.isArray(identity?.affiliationAliases) ? identity.affiliationAliases : []),
      user?.employeeDetails?.primarySchool?.facultyName,
      ...sortedVariants,
    ]
      .map((item) => this._cleanString(item, 256))
      .filter(Boolean);

    for (const name of candidates) {
      const params = new URLSearchParams({
        search: name,
        'per-page': '5',
      });

      let response;
      try {
        response = await fetch(`${DEFAULT_OPENALEX_BASE_URL}/institutions?${params.toString()}`, {
          headers: this._openAlexHeaders(),
        });
      } catch (error) {
        log.warn('OpenAlex institution search failed', { name, error: error.message });
        continue;
      }

      if (!response || !response.ok) {
        continue;
      }

      const json = await response.json();
      const institutions = Array.isArray(json?.results) ? json.results : [];
      const match = institutions.find((institution) =>
        this._normalizeName(institution?.display_name).includes(this._normalizeName(name))
      ) || institutions[0];

      if (match?.id) {
        this._openAlexInstCache = match.id;
        return match.id;
      }
    }

    return null;
  }

  async _findBestOpenAlexAuthorId(authorName, institutionId, identity, options = {}) {
    const { requireInstitution = false } = options;
    const normalizedInstitutionId = this._toOpenAlexFilterId(institutionId);
    const attemptParams = [
      this._stripUndefined({
        search: authorName,
        'per-page': '10',
        filter: normalizedInstitutionId ? `last_known_institutions.id:${normalizedInstitutionId}` : undefined,
      }),
    ];

    // Only fall back to an unfiltered name search when the home-university
    // filter is OFF — otherwise we pick authors from other institutions.
    if (!requireInstitution || !normalizedInstitutionId) {
      attemptParams.push({
        search: authorName,
        'per-page': '10',
      });
    }

    let lastError = null;

    for (const paramsObject of attemptParams) {
      const params = new URLSearchParams(paramsObject);
      
      let response;
      try {
        response = await fetch(`${DEFAULT_OPENALEX_BASE_URL}/authors?${params.toString()}`, {
          headers: this._openAlexHeaders(),
        });
      } catch (error) {
        lastError = new Error(`OpenAlex author search failed: ${error.message}`);
        log.warn('OpenAlex author search request failed', {
          error: error.message,
          params: params.toString(),
        });
        continue;
      }

      if (!response || !response.ok) {
        lastError = new Error(`OpenAlex author search failed (${response?.status || 'no response'})`);
        log.warn('OpenAlex author search request failed', {
          status: response?.status || 'no response',
          params: params.toString(),
        });
        continue;
      }

      const json = await response.json();
      const authors = Array.isArray(json?.results) ? json.results : [];
      if (authors.length === 0) {
        continue;
      }

      const scored = this._scoreOpenAlexAuthors(authors, authorName, identity);
      if (scored.length > 0) {
        return scored[0].id;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }

  _mapOrcidWork(summary, detail) {
    const title = detail?.title?.title?.value || summary?.title?.title?.value || null;
    const journalTitle = detail?.['journal-title']?.value || null;
    const publicationDate = this._orcidDate(detail?.['publication-date'] || summary?.['publication-date']);
    const externalIds = this._extractOrcidExternalIds(detail?.['external-ids'] || summary?.['external-ids']);
    const doi = externalIds.doi || null;
    const workType = detail?.type || summary?.type || null;
    const contributors = Array.isArray(detail?.contributors?.contributor)
      ? detail.contributors.contributor.map((item, index) => ({
          name: item?.['credit-name']?.value || `Author ${index + 1}`,
          email: null,
          affiliation: item?.['contributor-attributes']?.['contributor-role'] || null,
          department: null,
          designation: null,
          isCorresponding: false,
          authorOrder: index + 1,
        }))
      : [];

    return this._stripUndefined({
      title,
      abstract: detail?.shortDescription || null,
      keywords: Array.isArray(detail?.subject) ? detail.subject.map((item) => item?.value).filter(Boolean) : [],
      doi,
      journalName: journalTitle,
      publicationDate,
      issn: detail?.isbn?.value || null,
      publisherName: detail?.publisher?.name || null,
      volume: detail?.citation?.['citation-value'] || null,
      issue: null,
      pageNumbers: null,
      weblink: doi ? `https://doi.org/${doi}` : (detail?.url?.value || null),
      authors: contributors,
      venue: journalTitle,
      publicationStatus: 'published',
      sourceSystems: ['orcid'],
      externalIds: {
        orcid: String(summary?.['put-code'] || ''),
        ...(doi ? { doi } : {}),
      },
      rawType: workType,
    });
  }

  _mapScopusWork(entry) {
    const doi = this._cleanString(entry?.['prism:doi'], 256);
    const publicationDate = entry?.['prism:coverDate'] || null;
    const subtype = this._cleanString(entry?.subtypeDescription, 128);
    // Pass the entry-level affiliation array so authors get their country resolved
    const entryAffiliations = Array.isArray(entry?.affiliation) ? entry.affiliation
      : (entry?.affiliation ? [entry.affiliation] : []);
    const authorNames = this._parseScopusAuthors(entry?.author, entryAffiliations);
    const citationCount = entry?.['citedby-count'] ? parseInt(entry['citedby-count'], 10) : 0;

    // Paper-level home-institution signal (Scopus search payloads often omit
    // per-author afid/affiliation even when the document is AF-ID matched).
    const homeInstitutionOnPaper = entryAffiliations.some((afil) => {
      const afid = String(afil?.['@id'] || afil?.afid || afil?.['afid'] || '');
      if (this._isSgtTenant() && afid && SGT_SCOPUS_AFFIL_IDS.has(afid)) return true;
      const name = afil?.affilname || afil?.['affilname'] || '';
      return this._isSgtAffiliation(name);
    });

    return this._stripUndefined({
      title: this._cleanString(entry?.['dc:title'], 512),
      doi,
      journalName: this._cleanString(entry?.['prism:publicationName'], 512),
      issn: this._cleanString(entry?.['prism:issn'], 32),
      volume: this._cleanString(entry?.['prism:volume'], 64),
      issue: this._cleanString(entry?.['prism:issueIdentifier'], 64),
      pageNumbers: this._cleanString(entry?.['prism:pageRange'], 64),
      publicationDate,
      weblink: this._cleanString(this._resolveScopusLink(entry), 512),
      authors: authorNames,
      venue: this._cleanString(entry?.['prism:publicationName'], 512),
      publicationStatus: 'published',
      sourceSystems: ['scopus'],
      externalIds: {
        scopus: this._cleanString(entry?.['dc:identifier'], 191),
        ...(doi ? { doi } : {}),
      },
      indexedIn: 'scopus',
      quartile: this._inferQuartileFromTitle(entry?.['prism:publicationName']),
      rawType: subtype,
      abstract: null,
      keywords: this._parseKeywordList(entry?.authkeywords),
      citationCount,
      homeInstitutionOnPaper,
    });
  }

  _mapOpenAlexWork(work) {
    const doi = this._normalizeOpenAlexDoi(work?.doi || work?.ids?.doi);
    const journalName = this._cleanString(
      work?.primary_location?.source?.display_name || work?.host_venue?.display_name,
      512
    );
    const publicationDate = work?.publication_date
      || (work?.publication_year ? `${work.publication_year}-01-01` : null);
    const keywords = Array.isArray(work?.keywords)
      ? work.keywords.map((item) => item?.display_name).filter(Boolean)
      : Array.isArray(work?.concepts)
        ? work.concepts.map((item) => item?.display_name).filter(Boolean).slice(0, 10)
        : [];
    const citationCount = work?.cited_by_count ? parseInt(work.cited_by_count, 10) : 0;

    return this._stripUndefined({
      title: this._cleanString(work?.display_name, 512),
      doi,
      journalName,
      issn: this._cleanString(
        work?.primary_location?.source?.issn_l
          || (Array.isArray(work?.primary_location?.source?.issn) ? work.primary_location.source.issn[0] : null),
        32
      ),
      volume: this._cleanString(work?.biblio?.volume, 64),
      issue: this._cleanString(work?.biblio?.issue, 64),
      pageNumbers: this._formatPageRange(work?.biblio?.first_page, work?.biblio?.last_page),
      publicationDate,
      weblink: doi ? `https://doi.org/${doi}` : this._cleanString(work?.id, 512),
      authors: this._parseOpenAlexAuthors(work?.authorships),
      venue: journalName,
      publicationStatus: 'published',
      sourceSystems: ['openalex'],
      externalIds: {
        openalex: this._cleanString(work?.id, 191),
        ...(doi ? { doi } : {}),
      },
      rawType: this._cleanString(work?.type, 128),
      abstract: this._reconstructOpenAlexAbstract(work?.abstract_inverted_index),
      keywords,
      publisherName: this._cleanString(work?.primary_location?.source?.host_organization_name, 256),
      citationCount,
      homeInstitutionOnPaper: (Array.isArray(work?.authorships) ? work.authorships : []).some((authorship) =>
        (authorship?.institutions || []).some((inst) => this._isSgtAffiliation(inst?.display_name))
      ),
    });
  }

  _mergeCandidate(base, incoming) {
    return {
      ...base,
      ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== null && value !== undefined && value !== '')),
      sourceSystems: Array.from(new Set([...(base.sourceSystems || []), ...(incoming.sourceSystems || [])])),
      externalIds: {
        ...(base.externalIds || {}),
        ...(incoming.externalIds || {}),
      },
      authors: (base.authors && base.authors.length > 0) ? base.authors : incoming.authors,
      keywords: (base.keywords && base.keywords.length > 0) ? base.keywords : incoming.keywords,
      homeInstitutionOnPaper: Boolean(base.homeInstitutionOnPaper || incoming.homeInstitutionOnPaper),
      trustedHomeInstitutionQuery: Boolean(base.trustedHomeInstitutionQuery || incoming.trustedHomeInstitutionQuery),
    };
  }

  _deriveIndexingCategories(candidate) {
    const categories = new Set();
    if ((candidate.sourceSystems || []).includes('scopus') || candidate.indexedIn === 'scopus') {
      categories.add('scopus');
    }
    if (candidate.indexedIn === 'wos' || candidate.indexedIn === 'both') {
      categories.add('scie_wos');
    }
    if (candidate.naasRating && Number(candidate.naasRating) >= 6) {
      categories.add('naas_rating_6_plus');
    }
    if (candidate.impactFactor && Number(candidate.impactFactor) > 20) {
      categories.add('subsidiary_if_above_20');
    }
    if (candidate.journalName && /(nature|science|lancet|cell|nejm)/i.test(candidate.journalName)) {
      categories.add('nature_science_lancet_cell_nejm');
    }
    if (candidate.journalName && /(abdc)/i.test(candidate.journalName)) {
      categories.add('abdc_scopus_wos');
    }
    return Array.from(categories);
  }

  _inferPublicationType(candidate) {
    const rawType = String(candidate.rawType || '').toLowerCase();
    if (rawType.includes('conference')) return 'conference_paper';
    if (rawType.includes('book chapter') || rawType.includes('chapter')) return 'book_chapter';
    if (rawType.includes('book')) return 'book';
    return 'research_paper';
  }

  _collectMissingFields(publicationType, candidate, indexingCategories, mapped) {
    const missing = [];
    if (!candidate.title) missing.push('title');
    if (!candidate.publicationDate) missing.push('publicationDate');
    if (!candidate.authors || candidate.authors.length === 0) missing.push('authors');
    if (publicationType === 'research_paper') {
      if (!candidate.journalName) missing.push('journalName');
      if (indexingCategories.includes('scopus') && !candidate.quartile) missing.push('quartile');
      if (indexingCategories.includes('scopus') && !candidate.sjr) missing.push('sjr');
    }
    if (publicationType === 'conference_paper' && !candidate.conferenceName) {
      missing.push('conferenceName');
    }
    if ((publicationType === 'book' || publicationType === 'book_chapter') && !candidate.publisherName) {
      missing.push('publisherName');
    }
    if (mapped.hasAmbiguousInternalMatches) {
      missing.push('internalAuthorMapping');
    }
    return missing;
  }

  _calculateConfidence(missingFields, mapped) {
    let score = 100;
    score -= missingFields.length * 10;
    if (mapped.hasAmbiguousInternalMatches) {
      score -= 15;
    }
    return Math.max(20, Math.min(score, 100));
  }

  _shouldApplyAutoValue(currentValue, nextValue) {
    if (nextValue === undefined || nextValue === null || nextValue === '') return false;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (Array.isArray(nextValue) && nextValue.length > 0 && Array.isArray(currentValue) && currentValue.length === 0) return true;
    if (typeof nextValue === 'object' && !Array.isArray(nextValue) && Object.keys(nextValue).length > 0 && (!currentValue || Object.keys(this._asObject(currentValue)).length === 0)) {
      return true;
    }
    return false;
  }

  _normalizeScopusAuthorField(authorField) {
    if (!authorField) return [];
    if (Array.isArray(authorField)) return authorField;
    if (typeof authorField === 'object') return [authorField];
    return [];
  }

  _parseScopusAuthors(authorField, entryAffiliations) {
    const authorList = this._normalizeScopusAuthorField(authorField);
    if (authorList.length === 0) return [];

    // Build a lookup from afid -> { name, city, country } using the entry-level affiliation array.
    // The Search API returns per-paper affiliation details at entry level (with city, country),
    // and each author's afid[] array links them to their institution(s).
    const affilMap = {};
    if (Array.isArray(entryAffiliations)) {
      for (const afil of entryAffiliations) {
        const afid = afil?.['@id'] || afil?.afid || afil?.['afid'];
        if (afid) {
          affilMap[String(afid)] = {
            name: this._cleanString(afil?.affilname || afil?.['affilname'], 256),
            city: this._cleanString(afil?.['affiliation-city'] || afil?.city, 128),
            country: this._cleanString(afil?.['affiliation-country'] || afil?.country, 64),
          };
        }
      }
    }

    // Helper: extract all afids from an author (afid can be a string, object, or array of objects)
    const extractAfids = (author) => {
      const raw = author?.afid;
      if (!raw) return [];
      if (typeof raw === 'string') return [raw];
      if (Array.isArray(raw)) return raw.map((item) => (typeof item === 'object' ? item?.['$'] : item)).filter(Boolean);
      if (typeof raw === 'object') return [raw['$'] || raw['afid']].filter(Boolean);
      return [];
    };

    return authorList.map((author, index) => {
      const afids = extractAfids(author);
      const resolvedAffils = afids.map((afid) => affilMap[String(afid)]).filter(Boolean);

      // Legacy SGT-specific fast-path: author is home-institution-affiliated if
      // ANY of their afids is a known SGT Scopus institution ID. Scopus afids
      // can't be derived from a name algorithmically, so this only applies
      // when the current tenant IS SGT (see _isSgtTenant()); other tenants
      // rely purely on the name-based isAffiliationMatch() check below.
      const isSgtByAfid = this._isSgtTenant() && afids.some((afid) => SGT_SCOPUS_AFFIL_IDS.has(String(afid)));
      const primaryAfil = resolvedAffils[0] || null;
      const affiliationName = resolvedAffils.map((a) => a.name).filter(Boolean).join('; ')
        || this._cleanString(author?.affilname, 256)
        || null;
      const country = primaryAfil?.country || this._cleanString(author?.['affiliation-country'], 64) || null;

      return {
        name: this._cleanString(author?.authname || author?.ce?.['indexed-name'] || author?.['given-name'] || author?.surname, 256) || `Author ${index + 1}`,
        email: null,
        affiliation: affiliationName,
        country,
        city: primaryAfil?.city || null,
        isSgtByAfid,   // fast flag — true if afid directly matched an SGT Scopus institution
        scopusAfids: afids, // store all afids for future use / debugging
        department: null,
        designation: null,
        isCorresponding: false,
        authorOrder: Number(author?.['@seq'] || index + 1),
        // authid is the Scopus Author ID — used for definitive internal-user matching
        scopusAuthorId: this._normalizeScopusAuthorId(author?.authid || author?.['@auid']),
      };
    });
  }

  _parseOpenAlexAuthors(authorships) {
    if (!Array.isArray(authorships)) return [];
    return authorships.map((authorship, index) => {
      const institutions = Array.isArray(authorship?.institutions) ? authorship.institutions : [];
      const primaryInstitution = institutions[0];
      const country = this._cleanString(
        primaryInstitution?.country_code || primaryInstitution?.country || null,
        64
      );
      const affiliationNames = institutions.map((i) => i?.display_name).filter(Boolean);
      const affiliation = this._cleanString(affiliationNames.join(', '), 256) || null;
      const isSgtByAfid = affiliationNames.some((name) => this._isSgtAffiliation(name));
      return {
        name: this._cleanString(authorship?.author?.display_name, 256) || `Author ${index + 1}`,
        email: null,
        affiliation,
        country,
        department: null,
        designation: null,
        isCorresponding: Boolean(authorship?.is_corresponding),
        authorOrder: index + 1,
        isSgtByAfid,
      };
    });
  }

  /**
   * Build a compact affiliation summary for a candidate's author list.
   * Stored in indexingDetails so the frontend can display it without re-resolving authors.
   */
  _buildAffiliationSummary(candidateAuthors, sgtAffiliatedCount) {
    if (!Array.isArray(candidateAuthors) || candidateAuthors.length === 0) {
      return null;
    }
    const authorDetails = candidateAuthors.map((author) => {
      const isSgt = author.isSgtByAfid || this._isSgtAffiliation(author.affiliation);
      return {
        name: author.name || null,
        affiliation: author.affiliation || null,
        country: author.country || null,
        scopusAuthorId: this._normalizeScopusAuthorId(author.scopusAuthorId) || null,
        isSgtAffiliated: isSgt,
        isInternational: !isSgt && Boolean(author.country && author.country.toLowerCase() !== 'india'),
      };
    });
    const sgtCount = authorDetails.filter((a) => a.isSgtAffiliated).length;
    const internationalCount = authorDetails.filter((a) => a.isInternational).length;
    const countries = [...new Set(authorDetails.map((a) => a.country).filter(Boolean))];
    return {
      totalAuthors: authorDetails.length,
      sgtAffiliatedCount: sgtCount,
      externalCount: authorDetails.length - sgtCount,
      internationalCount,
      countries,
      authors: authorDetails,
    };
  }

  _parseKeywordList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  _extractOrcidExternalIds(externalIds) {
    const entries = Array.isArray(externalIds?.['external-id']) ? externalIds['external-id'] : [];
    return entries.reduce((acc, item) => {
      const type = String(item?.['external-id-type'] || '').toLowerCase();
      const value = this._cleanString(item?.['external-id-value'], 191);
      if (!type || !value) return acc;
      if (type.includes('doi')) acc.doi = value;
      else if (type.includes('eid') || type.includes('scopus')) acc.scopus = value;
      else acc[type] = value;
      return acc;
    }, {});
  }

  _mapManualImportCandidate(publication, user, sourceSystem, index) {
    const publicationType = this._cleanString(publication?.publicationType, 64)?.toLowerCase();
    const year = Number(publication?.year);
    const normalizedYear = Number.isFinite(year) && year > 1900 ? year : new Date().getFullYear();
    const normalizedTitle = this._cleanString(publication?.title, 512);

    if (!normalizedTitle) {
      const error = new Error('Publication title is required');
      error.statusCode = 400;
      throw error;
    }

    const authorList = Array.isArray(publication?.authors)
      ? publication.authors
      : String(publication?.authors || '')
          .split(/[;,]/)
          .map((author) => author.trim())
          .filter(Boolean)
          .map((name, authorIndex) => ({
            name,
            authorOrder: authorIndex + 1,
            isCorresponding: authorIndex === 0,
          }));

    return {
      title: normalizedTitle,
      abstract: this._cleanString(publication?.abstract, 4000),
      keywords: Array.isArray(publication?.keywords)
        ? publication.keywords.map((keyword) => this._cleanString(keyword, 128)).filter(Boolean)
        : [],
      doi: this._cleanString(publication?.doi, 256),
      volume: this._cleanString(publication?.volume, 64),
      issue: this._cleanString(publication?.issue, 64),
      pageNumbers: this._cleanString(publication?.pages || publication?.pageNumbers, 64),
      weblink: this._cleanString(publication?.publicationUrl || publication?.weblink, 512),
      journalName: publicationType === 'conference_paper' ? null : this._cleanString(publication?.venue || publication?.journalName, 512),
      conferenceName: publicationType === 'conference_paper' ? this._cleanString(publication?.venue || publication?.conferenceName, 512) : null,
      bookTitle: publicationType === 'book_chapter' ? this._cleanString(publication?.venue || publication?.bookTitle, 512) : null,
      publicationDate: `${normalizedYear}-01-01T00:00:00.000Z`,
      publicationStatus: 'published',
      publicationType: ['research_paper', 'conference_paper', 'book', 'book_chapter'].includes(publicationType)
        ? publicationType
        : 'research_paper',
      venue: this._cleanString(publication?.venue, 512),
      citationCount: Number(publication?.citationCount) || 0,
      sourceSystems: [sourceSystem],
      externalIds: {
        [sourceSystem]: this._cleanString(
          publication?.externalId || publication?.doi || `${user.id}-${normalizedYear}-${index}-${normalizedTitle}`,
          191
        ),
      },
      authors: authorList.length > 0 ? authorList : [{
        name: user.employeeDetails?.displayName || user.uid,
        email: user.email,
        affiliation: user.employeeDetails?.primarySchool?.facultyName || this._canonicalUniversityName,
        authorOrder: 1,
        isCorresponding: true,
      }],
    };
  }

  _openAlexHeaders() {
    const headers = { Accept: 'application/json' };
    if (process.env.OPENALEX_API_KEY) {
      headers['api-key'] = process.env.OPENALEX_API_KEY;
    }
    return headers;
  }

  _orcidDate(publicationDate) {
    const year = publicationDate?.year?.value;
    const month = publicationDate?.month?.value || '01';
    const day = publicationDate?.day?.value || '01';
    if (!year) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  _determineSourceSystems(identity, sourcePreference) {
    if (sourcePreference === 'orcid') return ['orcid'];
    if (sourcePreference === 'scopus') return ['scopus'];
    if (sourcePreference === 'openalex') return ['openalex'];
    const sources = [
      ...(identity.orcid ? ['orcid'] : []),
      ...(identity.scopusAuthorId ? ['scopus'] : []),
    ];
    if (process.env.OPENALEX_API_KEY) {
      sources.push('openalex');
    }
    return Array.from(new Set(sources));
  }

  _candidateKey(candidate) {
    const doi = this._cleanString(candidate.doi, 256);
    if (doi) return `doi:${doi.toLowerCase()}`;
    const external = Object.values(candidate.externalIds || {}).find(Boolean);
    if (external) return `external:${String(external).toLowerCase()}`;
    return `title:${this._normalizeTitle(candidate.title)}:${candidate.publicationDate ? new Date(candidate.publicationDate).getFullYear() : 'na'}`;
  }

  _authorDedupKey(author) {
    return `${author.userId || ''}|${String(author.email || '').toLowerCase()}|${this._normalizeName(author.name || '')}`;
  }

  _deriveAuthorRole(order, isCorresponding) {
    if (order === 1 && isCorresponding) return 'first_and_corresponding_author';
    if (order === 1) return 'first_author';
    if (isCorresponding) return 'corresponding_author';
    return 'co_author';
  }

  /**
   * Tenant-agnostic affiliation check — despite the legacy name (kept to
   * minimize call-site churn), this now delegates to the dynamic affiliation
   * engine using whatever variants were loaded for the current tenant via
   * _loadAffiliationContext(), instead of a hardcoded SGT-only list.
   */
  _isSgtAffiliation(value) {
    return isAffiliationMatch(value, this._affiliationVariants);
  }

  /**
   * True when the owning faculty author on a paper is affiliated with the
   * current tenant (Scopus AFID hit and/or affiliation-name match).
   * Falls back to paper-level homeInstitutionOnPaper when author rows from
   * Scopus search omit afid/affiliation text.
   */
  _isHomeInstitutionAuthor(author, candidate = null) {
    if (author?.isSgtByAfid) return true;

    const segments = [];
    const pushAffil = (value) => {
      String(value || '')
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => segments.push(part));
    };

    if (author) {
      pushAffil(author.affiliation);
      if (Array.isArray(author.scopusAfids) && this._isSgtTenant()) {
        if (author.scopusAfids.some((afid) => SGT_SCOPUS_AFFIL_IDS.has(String(afid)))) {
          return true;
        }
      }
    }

    if (segments.length > 0) {
      return segments.some((segment) => this._isSgtAffiliation(segment));
    }

    // Thin Scopus/OpenAlex payloads: accept document-level home affiliation
    // when we could not evaluate the author row directly.
    return Boolean(candidate?.homeInstitutionOnPaper);
  }

  _inferQuartileFromTitle(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('top 1')) return 'Top_1_';
    if (text.includes('top 5')) return 'Top_5_';
    if (text.includes('q1')) return 'Q1';
    if (text.includes('q2')) return 'Q2';
    if (text.includes('q3')) return 'Q3';
    if (text.includes('q4')) return 'Q4';
    return null;
  }

  _normalizeOrcid(orcid) {
    const clean = this._cleanString(orcid, 32);
    if (!clean) return null;
    return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(clean) ? clean.toUpperCase() : null;
  }

  _resolveScopusLink(entry) {
    const doi = this._cleanString(entry?.['prism:doi'], 256);
    if (doi) {
      return `https://doi.org/${doi}`;
    }

    if (Array.isArray(entry?.link)) {
      const scopusLinkObj = entry.link.find(
        (lnk) => lnk?.['@ref'] === 'scopus' || lnk?.ref === 'scopus' || lnk?.rel === 'scopus'
      );
      const url = scopusLinkObj?.['@href'] || scopusLinkObj?.href;
      if (url) return url;
    }

    const identifier = entry?.['dc:identifier'] || '';
    const match = identifier.match(/\d+/);
    if (match) {
      return `https://www.scopus.com/inward/record.uri?partnerID=HzOxMe3b&scp=${match[0]}&origin=inward`;
    }

    return entry?.['prism:url'] || null;
  }

  _normalizeScopusAuthorId(value) {
    const clean = this._cleanString(value, 64);
    if (!clean) return null;
    return /^[A-Za-z0-9-]+$/.test(clean) ? clean : null;
  }

  _normalizeTitle(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _isSamePersonName(nameA, nameB) {
    if (!nameA || !nameB) return false;
    
    const normalize = (n) => String(n).toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/aa+/g, 'a')
      .replace(/ee+/g, 'e')
      .replace(/oo+/g, 'o')
      .split(/\s+/)
      .filter(Boolean);

    const normA = normalize(nameA);
    const normB = normalize(nameB);
    
    if (normA.length === 0 || normB.length === 0) return false;

    if (normA.join(' ') === normB.join(' ')) return true;

    const getEditDistance = (s1, s2) => {
      if (s1.length === 0) return s2.length;
      if (s2.length === 0) return s1.length;
      const matrix = [];
      for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
      for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
          if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[s2.length][s1.length];
    };

    const isSimilarWord = (w1, w2) => {
      if (w1 === w2) return true;
      if (w1.length === 1 && w2.startsWith(w1)) return true;
      if (w2.length === 1 && w1.startsWith(w2)) return true;
      const dist = getEditDistance(w1, w2);
      const maxLen = Math.max(w1.length, w2.length);
      if (maxLen >= 5 && dist <= 2) return true;
      return false;
    };

    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    
    let matchedParts = 0;
    const usedIndices = new Set();
    
    shorter.forEach(sPart => {
      const matchedIdx = longer.findIndex((lPart, idx) => {
        if (usedIndices.has(idx)) return false;
        return isSimilarWord(sPart, lPart);
      });
      if (matchedIdx !== -1) {
        matchedParts++;
        usedIndices.add(matchedIdx);
      }
    });
    
    return matchedParts === shorter.length;
  }

  _cleanString(value, max = 512) {
    if (value === undefined || value === null) return null;
    const clean = String(value).trim();
    return clean ? clean.substring(0, max) : null;
  }

  _normalizeOpenAlexDoi(value) {
    const clean = this._cleanString(value, 256);
    if (!clean) return null;
    return clean.replace(/^https?:\/\/doi\.org\//i, '');
  }

  _toOpenAlexFilterId(value) {
    const clean = this._cleanString(value, 256);
    if (!clean) return null;
    const match = clean.match(/(?:https?:\/\/openalex\.org\/)?([A-Z]\d+)$/i);
    return match ? match[1].toUpperCase() : clean;
  }

  _extractOpenAlexInstitutionNames(author) {
    const institutions = Array.isArray(author?.last_known_institutions) && author.last_known_institutions.length > 0
      ? author.last_known_institutions
      : [author?.last_known_institution].filter(Boolean);

    return institutions
      .map((institution) => this._normalizeName(institution?.display_name || ''))
      .filter(Boolean);
  }

  _scoreOpenAlexAuthors(authors, authorName, identity) {
    const normalizedTarget = this._normalizeName(authorName);
    const aliases = new Set([
      ...(Array.isArray(identity?.affiliationAliases) ? identity.affiliationAliases : []),
      this._canonicalUniversityName,
      ...this._affiliationVariants,
    ].map((item) => this._normalizeName(item)).filter(Boolean));

    return authors.map((author) => {
      const normalizedNames = [
        author?.display_name,
        ...(Array.isArray(author?.display_name_alternatives) ? author.display_name_alternatives : []),
      ]
        .map((value) => this._normalizeName(value))
        .filter(Boolean);
      const institutionNames = this._extractOpenAlexInstitutionNames(author);
      let score = 0;

      if (normalizedNames.includes(normalizedTarget)) score += 100;
      else if (normalizedNames.some((name) => name.includes(normalizedTarget) || normalizedTarget.includes(name))) score += 50;

      for (const institutionName of institutionNames) {
        if (aliases.has(institutionName)) {
          score += 40;
          break;
        }
        if ([...aliases].some((alias) => institutionName.includes(alias) || alias.includes(institutionName))) {
          score += 20;
          break;
        }
      }

      score += Number(author?.works_count || 0) / 1000;
      return { id: author?.id, score };
    })
      .filter((item) => item.id)
      .sort((left, right) => right.score - left.score);
  }

  _formatPageRange(firstPage, lastPage) {
    const first = this._cleanString(firstPage, 32);
    const last = this._cleanString(lastPage, 32);
    if (first && last) return `${first}-${last}`;
    return first || last || null;
  }

  _reconstructOpenAlexAbstract(abstractIndex) {
    if (!abstractIndex || typeof abstractIndex !== 'object' || Array.isArray(abstractIndex)) {
      return null;
    }

    const words = [];
    for (const [word, positions] of Object.entries(abstractIndex)) {
      if (!Array.isArray(positions)) continue;
      for (const position of positions) {
        words[position] = word;
      }
    }

    const abstract = words.filter(Boolean).join(' ').trim();
    return abstract || null;
  }

  _stripUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
  }

  _asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    return {};
  }
}

module.exports = PublicationSyncService;
