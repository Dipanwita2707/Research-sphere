/**
 * Research Contribution Service
 * Framework-agnostic business logic for research contributions.
 * Dependencies injected via constructor for testability.
 */

const tenantContext = require('../../../shared/tenancy/tenantContext');
const logger = require('../../../shared/utils/logger');
const { isAffiliationMatch } = require('../../../shared/utils/affiliationEngine');
const { getUniversityAffiliationVariants } = require('../../core/services/affiliation.service');
const { assertNoActiveClaim } = require('./duplicateClaim.service');
const { toIncentiveInput } = require('../utils/incentiveInput');
const { IncentiveCalculator } = require('./incentive-calculator');
const { computeAuthorShares, storedAuthorsForShares, NO_POLICY_WARNING_MESSAGE } = require('./authorShares');
const { canViewContribution, canViewGrant, notFound, CONTRIBUTION_ACCESS_INCLUDE } = require('../utils/objectAccess');
const {
  APPLICANT_EDITABLE_FIELDS, APPLICANT_DETAILS_EDITABLE_FIELDS, AUTHOR_EDITABLE_FIELDS, pickAllowed,
} = require('../utils/editableFields');
const { normalizeUgcCare, resolveUgcCare, ugcCareFromIndexing } = require('../utils/ugcCare');

class ContributionService {
  /**
   * @param {object} contributionRepository - ContributionRepository instance
   * @param {object} emailService           - email sending service (optional)
   * @param {object} auditLogger            - audit logging utility
   * @param {object} prisma                 - prisma client (for policy lookups & related tables)
   */
  constructor(contributionRepository, emailService, auditLogger, prisma, workflowQueue = null) {
    this.repo = contributionRepository;
    this.emailService = emailService;
    this.auditLogger = auditLogger;
    this.prisma = prisma;
    this.workflowQueue = workflowQueue;
  }

  // ─── Public orchestration ────────────────────────────────────────────────

  /**
   * Create a new research contribution (orchestration only).
   * @param {object} data   - validated contribution fields + applicant info
   * @param {object} files  - { manuscriptFile, supportingDocs } (already uploaded paths)
   * @returns {object} created contribution with relations
   */
  async createContribution(data, files = {}) {
    await this.validateContributionData(data);
    // Fail fast (400) on an invalid UGC-CARE pair before any other work
    if (data.publicationType === 'research_paper') resolveUgcCare(data.ugcCareListed, data.ugcCareGroup, data.indexingCategories);

    // Pool and every author's share in one pass (the same computation the form previews).
    const submittedShares = await this._computeSubmittedShares(data);
    const incentiveCalculation = this._poolResult(submittedShares.shares);
    const resolvedIds = await this._resolveSchoolAndDepartment(data);

    let contribution;
    let attempts = 0;
    while (attempts < 5) {
      const applicationNumber = await this._generateApplicationNumber(data.publicationType, attempts);
      try {
        contribution = await this.repo.create(
          this._buildContributionPayload(data, files, applicationNumber, incentiveCalculation, resolvedIds)
        );
        break;
      } catch (err) {
        // P2002 on application_number = concurrent sync generated the same sequence number
        // Prisma 7 driver adapters don't set meta.target; the constraint name lives elsewhere in meta/message.
        const onAppNumber = err.code === 'P2002'
          && /application_?number/i.test(`${JSON.stringify(err.meta || {})} ${err.message || ''}`);
        if (onAppNumber && attempts < 4) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    await this._createApplicantDetails(contribution.id, this._withTopLevelMentor(data.applicantDetails, data));
    await this._createAuthors(contribution.id, data, submittedShares);
    await this._createStatusHistory(contribution.id, null, 'draft', data.userId, 'Research contribution created');

    const fullContribution = await this.repo.findById(contribution.id, {
      applicantDetails: true,
      authors: true,
      statusHistory: { orderBy: { changedAt: 'desc' } },
      school: true,
      department: true
    });

    await this.dispatchPostCreationSideEffects(fullContribution, data.userId, data.request);
    const incentiveWarning = this._incentiveWarningFrom(incentiveCalculation);
    return incentiveWarning ? { ...fullContribution, incentiveWarning } : fullContribution;
  }

  /**
   * Incentive preview for the submission form: exactly what saving this payload would store
   * per author (same normalisation, same computeAuthorShares call), without writing anything.
   * @param {object} data  form payload + userId/userRole of the applicant
   */
  async previewIncentiveShares(data) {
    const { enriched, shares } = await this._computeSubmittedShares(data);
    return {
      ...shares,
      authors: shares.authors.map((share, i) => ({
        ...share,
        name: enriched[i].author.name || null,
        uid: enriched[i].author.registrationNumber || enriched[i].author.uid || null,
        authorType: enriched[i].mappedAuthorType,
        authorCategory: enriched[i].authorCategory,
      })),
    };
  }

  /** Calculator-shaped pool result (contribution columns + incentiveWarning) from shares. */
  _poolResult(shares) {
    return {
      totalPoolAmount: shares.pool.amount,
      totalPoolPoints: shares.pool.points,
      policyFound: shares.policy.found,
      usedDefaultPolicy: shares.policy.usedDefault,
      reason: shares.policy.reason,
    };
  }

  /** incentiveWarning for a calculator result, or null when a policy applies. */
  _incentiveWarningFrom(result) {
    if (!result || result.policyFound !== false) return null;
    return { code: 'NO_INCENTIVE_POLICY', message: NO_POLICY_WARNING_MESSAGE, reason: result.reason || null };
  }

  /** Re-check policy coverage for a stored contribution (after an edit). */
  async _incentiveWarningFor(contribution) {
    if (!contribution) return null;
    try {
      const calculator = new IncentiveCalculator(this.prisma);
      const result = await calculator.calculate({
        contributionData: toIncentiveInput(contribution),
        publicationType: contribution.publicationType,
        authorRole: 'first_and_corresponding_author',
        totalAuthors: 1,
        isInternal: true,
      });
      return this._incentiveWarningFrom(result);
    } catch (error) {
      // The edit is already saved; a failed coverage check must not turn it into an error.
      logger.error?.('[ContributionService] incentive policy check failed', { id: contribution.id, error: error.message });
      return null;
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  /**
   * Validate category-specific required fields.
   * Throws an error with a `validationErrors` array if invalid.
   * @param {object} data
   */
  async validateContributionData(data) {
    if (data.sourceType === 'auto_import') {
      return;
    }

    const errors = [];
    const categories = data.indexingCategories || [];

    // Basic required fields (otherwise the insert fails in the database with a 500).
    const { ResearchPublicationTypeEnum } = require('@prisma/client');
    if (!data.title || !String(data.title).trim()) errors.push('Title is required');
    if (!Object.values(ResearchPublicationTypeEnum).includes(data.publicationType)) {
      errors.push(`Publication type must be one of: ${Object.values(ResearchPublicationTypeEnum).join(', ')}`);
    }

    if (categories.includes('scopus')) {
      if (!data.quartile) errors.push('Quartile is required when SCOPUS category is selected');
      if (!data.sjr) errors.push('SJR is required when SCOPUS category is selected');
    }

    if (categories.includes('naas_rating_6_plus')) {
      if (!data.naasRating) {
        errors.push('NAAS Rating is required when NAAS category is selected');
      } else if (Number(data.naasRating) < 6) {
        errors.push('NAAS Rating must be 6 or above');
      } else if (Number(data.naasRating) > 10) {
        errors.push('NAAS Rating must be 10 or below');
      }
    } else if (data.naasRating && Number(data.naasRating) > 10) {
      errors.push('NAAS Rating must be between 0 and 10');
    }

    const subsidiaryIF = data.subsidiaryImpactFactor || data.impactFactor;
    if (categories.includes('subsidiary_if_above_20')) {
      if (!subsidiaryIF) {
        errors.push('Impact Factor is required when Subsidiary Journals category is selected');
      } else if (Number(subsidiaryIF) <= 20) {
        errors.push('Impact Factor must be greater than 20 for Subsidiary Journals');
      }
    }

    if (errors.length > 0) {
      const err = new Error('Validation failed for selected categories');
      err.validationErrors = errors;
      err.statusCode = 400;
      throw err;
    }
  }

  // ─── File handling ───────────────────────────────────────────────────────

  /**
   * Process file uploads and return resolved file paths.
   * Files are expected to already be uploaded (paths provided by middleware).
   * @param {object} files - { manuscriptFile, supportingDocs }
   * @returns {{ manuscriptFilePath: string|null, supportingDocsFilePaths: string[] }}
   */
  processFileUploads(files = {}) {
    return {
      manuscriptFilePath: files.manuscriptFile?.path || files.manuscriptFilePath || null,
      supportingDocsFilePaths: files.supportingDocs?.map(f => f.path) || files.supportingDocsFilePaths || []
    };
  }

  _requestContext(request = null) {
    if (!request) return { ipAddress: '0.0.0.0', userAgent: 'unknown' };
    return {
      ipAddress:
        request.ip ||
        request.headers?.['x-forwarded-for'] ||
        request.connection?.remoteAddress ||
        '0.0.0.0',
      userAgent: request.headers?.['user-agent'] || 'unknown',
    };
  }

  async _dispatchNotification(data) {
    if (this.workflowQueue?.dispatchNotification) {
      return this.workflowQueue.dispatchNotification(data);
    }
    return this.prisma.notification.create({ data });
  }

  async _dispatchStatusAudit(contribution, oldStatus, newStatus, userId, request, comments = null) {
    if (!this.auditLogger?.logResearchStatusChange) return;

    if (this.workflowQueue?.dispatchResearchStatusAudit) {
      return this.workflowQueue.dispatchResearchStatusAudit({
        contribution,
        oldStatus,
        newStatus,
        userId,
        requestContext: this._requestContext(request),
        comments,
      });
    }

    return this.auditLogger.logResearchStatusChange(
      contribution,
      oldStatus,
      newStatus,
      userId,
      request,
      comments
    );
  }

  // ─── Post-creation side effects ──────────────────────────────────────────

  /**
   * Dispatch audit logs and file-upload audit entries after creation.
   * @param {object} contribution - full contribution with relations
   * @param {string} userId
   * @param {object} [request]    - original HTTP request (for IP logging); may be null in tests
   */
  async dispatchPostCreationSideEffects(contribution, userId, request = null) {
    if (!request) {
      return;
    }

    if (this.auditLogger?.logResearchFiling) {
      await this.auditLogger.logResearchFiling(contribution, userId, request);
    }

    const { manuscriptFilePath, supportingDocsFilePaths } = contribution;

    if (manuscriptFilePath && this.auditLogger?.logFileUpload) {
      await this.auditLogger.logFileUpload(
        manuscriptFilePath.split('/').pop(), 0, manuscriptFilePath,
        userId, request, 'RESEARCH', { contributionId: contribution.id, type: 'manuscript' }
      );
    }

    if (supportingDocsFilePaths?.length && this.auditLogger?.logFileUpload) {
      for (const docPath of supportingDocsFilePaths) {
        await this.auditLogger.logFileUpload(
          docPath.split('/').pop(), 0, docPath,
          userId, request, 'RESEARCH', { contributionId: contribution.id, type: 'supporting_document' }
        );
      }
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  async _generateApplicationNumber(publicationType, bump = 0) {
    const typePrefix = {
      research_paper: 'RP', book: 'BK', book_chapter: 'BC',
      conference_paper: 'CP', grant_proposal: 'GP'
    };
    const prefix = typePrefix[publicationType] || 'RC';
    const year = new Date().getFullYear();

    const latest = await this.repo.findFirst(
      { applicationNumber: { startsWith: `${prefix}-${year}-` } },
      { orderBy: { applicationNumber: 'desc' } }
    );

    let sequence = 1;
    if (latest?.applicationNumber) {
      const parts = latest.applicationNumber.split('-');
      sequence = parseInt(parts[2]) + 1;
    }
    // bump skips ahead on a retry after a collision so a stuck sequence cannot collide forever
    return `${prefix}-${year}-${(sequence + bump).toString().padStart(4, '0')}`;
  }

  _resolveApplicantType(userRole) {
    if (userRole === 'student') return 'internal_student';
    if (userRole === 'staff') return 'internal_staff';
    return 'internal_faculty';
  }

  _buildIncentiveContributionData(data) {
    return toIncentiveInput(data);
  }

  async _resolveSchoolAndDepartment(data) {
    let { schoolId, departmentId } = data;

    if (departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: departmentId }, select: { id: true, facultyId: true }
      });
      if (!dept) {
        departmentId = null;
      } else if (!schoolId && dept.facultyId) {
        schoolId = dept.facultyId;
      }
    }

    if (schoolId) {
      const school = await this.prisma.facultySchoolList.findUnique({
        where: { id: schoolId }, select: { id: true }
      });
      if (!school) schoolId = null;
    }

    if (!schoolId || !departmentId) {
      const employee = await this.prisma.employeeDetails.findFirst({
        where: { userLoginId: data.userId },
        select: { primaryDepartmentId: true, primaryDepartment: { select: { id: true, facultyId: true } } }
      });
      if (!departmentId && employee?.primaryDepartmentId) departmentId = employee.primaryDepartmentId;
      if (!schoolId) schoolId = employee?.primaryDepartment?.facultyId || null;
    }

    // Student fallback: no employee record exists for students — resolve via
    // StudentDetails → Program → Department → FacultySchoolList (school)
    if (!schoolId || !departmentId) {
      const student = await this.prisma.studentDetails.findFirst({
        where: { userLoginId: data.userId },
        select: {
          program: {
            select: {
              departmentId: true,
              department: { select: { id: true, facultyId: true } },
            },
          },
        },
      });
      if (!departmentId && student?.program?.departmentId) {
        departmentId = student.program.departmentId;
      }
      if (!schoolId && student?.program?.department?.facultyId) {
        schoolId = student.program.department.facultyId;
      }
    }

    return { schoolId, departmentId };
  }

  _buildContributionPayload(data, files, applicationNumber, incentiveCalc, resolvedIds) {
    const t = (v, max) => (v ? String(v).substring(0, max) : v);
    const sdgGoals = data.sdgGoals === null || data.sdgGoals === undefined ? [] : data.sdgGoals;
    const normalizedBookPublicationType = data.bookPublicationType || data.bookType || null;
    const subsidiaryIF = data.subsidiaryImpactFactor ||
      ((data.indexingCategories || []).includes('subsidiary_if_above_20') ? data.impactFactor : null);

    return {
      applicationNumber,
      applicantUser: { connect: { id: data.userId } },
      applicantType: this._resolveApplicantType(data.userRole),
      publicationType: data.publicationType,
      title: t(data.title, 512),
      abstract: data.abstract,
      keywords: t(data.keywords, 512),
      ...(resolvedIds.schoolId && { school: { connect: { id: resolvedIds.schoolId } } }),
      ...(resolvedIds.departmentId && { department: { connect: { id: resolvedIds.departmentId } } }),
      status: 'draft',
      indexingCategories: data.indexingCategories || [],
      internationalAuthor: data.internationalAuthor || false,
      foreignCollaborationsCount: data.foreignCollaborationsCount || 0,
      impactFactor: data.impactFactor ? Number(data.impactFactor) : null,
      quartile: this._normalizeQuartile(data.quartile),
      sjr: data.sjr ? Number(data.sjr) : null,
      naasRating: data.naasRating ? Number(data.naasRating) : null,
      subsidiaryImpactFactor: subsidiaryIF ? Number(subsidiaryIF) : null,
      interdisciplinaryFromSgt: data.interdisciplinaryFromSgt || false,
      studentsFromSgt: data.studentsFromSgt || false,
      journalName: t(data.journalName, 512),
      totalAuthors: data.totalAuthors || 1,
      sgtAffiliatedAuthors: data.sgtAffiliatedAuthors || 1,
      internalCoAuthors: data.internalCoAuthors || 0,
      volume: t(data.volume, 64), issue: t(data.issue, 64),
      pageNumbers: t(data.pageNumbers, 64), doi: t(data.doi, 256),
      issn: t(data.issn, 32), publisherName: t(data.publisherName, 256),
      isbn: t(data.isbn, 32), edition: t(data.edition, 64),
      chapterNumber: t(data.chapterNumber, 32), bookTitle: t(data.bookTitle, 512),
      editors: t(data.editors, 512), publisherLocation: t(data.publisherLocation, 256),
      nationalInternational: t(data.nationalInternational, 32),
      bookPublicationType: t(normalizedBookPublicationType, 32),
      bookIndexingType: t(data.bookIndexingType, 32),
      bookLetter: t(data.bookLetter, 8),
      communicatedWithOfficialId: data.communicatedWithOfficialId === 'yes' || data.communicatedWithOfficialId === true,
      personalEmail: t(data.personalEmail, 256), facultyRemarks: data.facultyRemarks,
      conferenceName: t(data.conferenceName, 512),
      conferenceLocation: t(data.conferenceLocation, 256),
      conferenceDate: data.conferenceDate ? new Date(data.conferenceDate) : null,
      proceedingsTitle: t(data.proceedingsTitle, 512),
      conferenceSubType: t(data.conferenceSubType, 64),
      proceedingsQuartile: t(data.proceedingsQuartile, 16),
      totalPresenters: data.totalPresenters ? Number(data.totalPresenters) : 1,
      isPresenter: data.isPresenter === 'yes' || data.isPresenter === true,
      virtualConference: data.virtualConference === 'yes' || data.virtualConference === true,
      fullPaper: data.fullPaper === 'yes' || data.fullPaper === true,
      conferenceHeldAtSgt: data.conferenceHeldAtSgt === 'yes' || data.conferenceHeldAtSgt === true,
      conferenceBestPaperAward: data.conferenceBestPaperAward === 'yes' || data.conferenceBestPaperAward === true,
      industryCollaboration: data.industryCollaboration === 'yes' || data.industryCollaboration === true,
      centralFacilityUsed: data.centralFacilityUsed === 'yes' || data.centralFacilityUsed === true,
      issnIsbnIssueNo: t(data.issnIsbnIssueNo, 64), paperDoi: t(data.paperDoi, 256),
      weblink: t(data.weblink, 512), paperweblink: t(data.paperweblink, 512),
      priorityFundingArea: t(data.priorityFundingArea, 256),
      conferenceRole: t(data.conferenceRole, 64), indexedIn: t(data.indexedIn, 32),
      conferenceHeldLocation: t(data.conferenceHeldLocation, 32),
      venue: t(data.venue, 512), topic: t(data.topic, 512),
      attendedVirtual: data.attendedVirtual === 'yes' || data.attendedVirtual === true,
      eventCategory: t(data.eventCategory, 32), organizerRole: t(data.organizerRole, 64),
      conferenceType: t(data.conferenceType, 32),
      fundingAgency: t(data.fundingAgency, 256), proposalType: t(data.proposalType, 64),
      requestedAmount: data.requestedAmount ? Number(data.requestedAmount) : null,
      sanctionedAmount: data.sanctionedAmount ? Number(data.sanctionedAmount) : null,
      projectDurationMonths: data.projectDurationMonths,
      projectStartDate: data.projectStartDate ? new Date(data.projectStartDate) : null,
      projectEndDate: data.projectEndDate ? new Date(data.projectEndDate) : null,
      publicationDate: data.publicationDate ? new Date(data.publicationDate) : null,
      publicationStatus: t(data.publicationStatus, 64),
      manuscriptFilePath: t(files.manuscriptFilePath || data.manuscriptFilePath, 512),
      supportingDocsFilePaths: files.supportingDocsFilePaths || data.supportingDocsFilePaths,
      indexingDetails: data.indexingDetails,
      // UGC-CARE listing applies to journal papers only (validated in createContribution)
      // Scopus / Web of Science indexing settles it (Group II); otherwise the author's answer.
      ...(data.publicationType === 'research_paper'
        ? resolveUgcCare(data.ugcCareListed, data.ugcCareGroup, data.indexingCategories)
        : { ugcCareListed: null, ugcCareGroup: null }),
      sdg_goals: sdgGoals,
      calculatedIncentiveAmount: incentiveCalc.totalPoolAmount,
      calculatedPoints: incentiveCalc.totalPoolPoints,
      sourceType: t(data.sourceType, 32),
      sourceSystems: data.sourceSystems || [],
      externalIds: data.externalIds || {},
      importedAt: data.importedAt ? new Date(data.importedAt) : null,
      lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : null,
      specialReviewRequired: data.specialReviewRequired === true,
      importConfidence: data.importConfidence ? Number(data.importConfidence) : null,
      missingFields: data.missingFields || [],
      autoCalculatedFields: data.autoCalculatedFields || [],
      fieldProvenance: data.fieldProvenance || {},
      importMetadata: data.importMetadata || {},
    };
  }

  /** The submission form sends mentorUid/mentorName at the top level; fold them into applicantDetails. */
  _withTopLevelMentor(applicantDetails, data = {}) {
    const details = { ...(applicantDetails || {}) };
    if (!details.mentorUid && data.mentorUid) details.mentorUid = data.mentorUid;
    if (!details.mentorName && data.mentorName) details.mentorName = data.mentorName;
    return Object.keys(details).length ? details : null;
  }

  /**
   * The mentor a student's work goes to. Must be an active faculty/staff member of this
   * university, never the student themselves, and — when the student has an assigned mentor
   * on record — that mentor. With no mentor typed, the assigned mentor is used.
   * @returns {Promise<{ id: string, uid: string } | null>}
   */
  async _resolveStudentMentor(applicantUserId, typedMentorUid) {
    const student = await this.prisma.studentDetails.findFirst({
      where: { userLoginId: applicantUserId },
      select: { mentorId: true },
    });
    const assigned = student?.mentorId
      ? await this.prisma.userLogin.findFirst({ where: { id: student.mentorId }, select: { id: true, uid: true, role: true, status: true } })
      : null;
    const uid = typedMentorUid ? String(typedMentorUid).trim() : null;
    if (!uid) return assigned && assigned.status === 'active' ? { id: assigned.id, uid: assigned.uid } : null;

    const mentor = await this.prisma.userLogin.findFirst({ where: { uid }, select: { id: true, uid: true, role: true, status: true } });
    const fail = (message) => { const e = new Error(message); e.statusCode = 400; e.code = 'INVALID_MENTOR'; throw e; };
    if (!mentor) fail(`Mentor ${uid} was not found at this university`);
    if (mentor.id === applicantUserId) fail('You cannot be your own mentor');
    if (!['faculty', 'staff'].includes(mentor.role)) fail('The mentor must be a faculty or staff member');
    if (mentor.status !== 'active') fail('The selected mentor account is not active');
    if (assigned && assigned.id !== mentor.id) fail(`Your assigned mentor is ${assigned.uid}; submit to them or ask the admin to change your mentor`);
    return { id: mentor.id, uid: mentor.uid };
  }

  async _createApplicantDetails(contributionId, applicantDetails) {
    if (!applicantDetails) return;
    const t = (v, max) => (v ? String(v).substring(0, max) : v);
    await this.prisma.researchContributionApplicantDetails.create({
      data: {
        researchContributionId: contributionId,
        employeeCategory: t(applicantDetails.employeeCategory, 64),
        employeeType: t(applicantDetails.employeeType, 64),
        uid: t(applicantDetails.uid, 64),
        email: t(applicantDetails.email, 256),
        phone: t(applicantDetails.phone, 20),
        universityDeptName: t(applicantDetails.universityDeptName, 256),
        mentorName: t(applicantDetails.mentorName, 256),
        mentorUid: t(applicantDetails.mentorUid, 64),
        isPhdWork: applicantDetails.isPhdWork || false,
        phdTitle: t(applicantDetails.phdTitle, 512),
        phdObjectives: applicantDetails.phdObjectives,
        coveredObjectives: t(applicantDetails.coveredObjectives, 256),
        addressesSocietal: applicantDetails.addressesSocietal || false,
        addressesGovernment: applicantDetails.addressesGovernment || false,
        addressesEnvironmental: applicantDetails.addressesEnvironmental || false,
        addressesIndustrial: applicantDetails.addressesIndustrial || false,
        addressesBusiness: applicantDetails.addressesBusiness || false,
        addressesConceptual: applicantDetails.addressesConceptual || false,
        enrichesDiscipline: applicantDetails.enrichesDiscipline || false,
        isNewsworthy: applicantDetails.isNewsworthy || false,
        metadata: applicantDetails.metadata || {}
      }
    });
  }

  /**
   * Resolve the submitted authors (linked accounts, internal/external, student) and split the
   * pool among them with computeAuthorShares. Read-only: used by create/edit before the rows
   * are written and by the form preview, so the preview is what gets saved.
   * @returns {Promise<{ enriched: Array, shares: object }>}
   */
  async _computeSubmittedShares(data) {
    const authorsList = Array.isArray(data.authors) ? data.authors : [];

    // Batch-resolve all author UIDs in a single query instead of one per author
    const authorUids = [...new Set(authorsList.map((a) => a.registrationNumber || a.uid).filter(Boolean))];
    const resolvedUsers = authorUids.length
      ? await this.prisma.userLogin.findMany({
          where: { uid: { in: authorUids } },
          select: { id: true, uid: true, role: true }
        })
      : [];
    const usersByUid = Object.fromEntries(resolvedUsers.map((u) => [u.uid, u]));

    // "Internal" means the author belongs to this university: an internal_* author type, a
    // linked account, or an affiliation matching the university's name variants. Any external_*
    // type is external, whatever the affiliation says ("Stanford University" is not internal).
    const { variants: homeVariants } = authorsList.length
      ? await getUniversityAffiliationVariants(tenantContext.getTenantId())
      : { variants: [] };

    const enriched = authorsList.map((author) => {
      const uidKey = author.registrationNumber || author.uid;
      const linkedUser = (uidKey && usersByUid[uidKey]) || null;
      const isInternalAuthor = author.authorType?.startsWith('external') || author.isInternal === false
        ? false
        : Boolean(
            author.authorType?.startsWith('internal_') ||
            linkedUser ||
            author.isInternal === true ||
            (author.affiliation && homeVariants.length && isAffiliationMatch(author.affiliation, homeVariants))
          );
      return {
        author,
        authorUserId: linkedUser?.id || null,
        mappedAuthorType: this._mapAuthorRole(author),
        isInternalAuthor,
        // Students earn money but no points: a student author type or a linked student account.
        isStudent: author.authorType === 'internal_student' || author.isStudent === true || linkedUser?.role === 'student',
        authorCategory: this._resolveAuthorCategory(author.authorType),
        // Same value that is stored as authorPosition, which approval reads back.
        position: Number(author.authorPosition || author.orderNumber || 1) || 1,
      };
    });

    const shares = await computeAuthorShares(this.prisma, {
      contributionData: toIncentiveInput(data),
      publicationType: data.publicationType,
      authors: enriched.map((e) => ({
        role: e.mappedAuthorType, isInternal: e.isInternalAuthor, isStudent: e.isStudent, position: e.position,
      })),
    });
    return { enriched, shares };
  }

  /**
   * Write the author rows with their shares. `submitted` is a _computeSubmittedShares result
   * already computed for this data (create); otherwise it is computed here (edit, import).
   */
  async _createAuthors(contributionId, data, submitted = null) {
    const { authors = [], userId } = data;
    if (!authors.length) return;

    const { enriched, shares } = submitted || await this._computeSubmittedShares(data);
    const t = (v, max) => (v ? String(v).substring(0, max) : v);
    const enrichedAuthors = enriched.map((e, i) => ({
      ...e,
      authorIncentive: { incentiveAmount: shares.authors[i].incentive, points: shares.authors[i].points },
    }));

    // Batch insert all authors with createMany (single DB round-trip)
    await this.prisma.researchContributionAuthor.createMany({
      data: enrichedAuthors.map(({ authorUserId, mappedAuthorType, isInternalAuthor, authorCategory, authorIncentive, author }) => ({
        researchContributionId: contributionId,
        userId: authorUserId,
        uid: t(author.uid, 64),
        registrationNo: t(author.registrationNumber, 64),
        name: t(author.name, 256),
        email: t(author.email, 256),
        phone: t(author.phone, 20),
        affiliation: t(author.affiliation, 256),
        department: t(author.department, 256),
        designation: t(author.designation, 256),
        isInternational: author.isInternational || false,
        authorOrder: author.orderNumber || 1,
        authorPosition: author.authorPosition || author.orderNumber || 1,
        isCorresponding: author.isCorresponding || false,
        authorType: mappedAuthorType,
        isInternal: isInternalAuthor,
        authorCategory: t(authorCategory, 64),
        isPhdWork: author.isPhdWork || false,
        phdTitle: t(author.phdTitle, 512),
        phdObjectives: author.phdObjectives,
        coveredObjectives: t(author.coveredObjectives, 256),
        addressesSocietal: author.addressesSocietal || false,
        addressesGovernment: author.addressesGovernment || false,
        addressesEnvironmental: author.addressesEnvironmental || false,
        addressesIndustrial: author.addressesIndustrial || false,
        addressesBusiness: author.addressesBusiness || false,
        addressesConceptual: author.addressesConceptual || false,
        isNewsworthy: author.isNewsworthy || false,
        incentiveShare: authorIncentive.incentiveAmount,
        pointsShare: authorIncentive.points,
        canView: true,
        canEdit: false,
        scopusAuthorId: t(author.scopusAuthorId, 64),
      })),
      skipDuplicates: true,
    });

    // Batch insert co-author notifications (single DB round-trip)
    const notificationRows = enrichedAuthors
      .filter(({ authorUserId }) => authorUserId && authorUserId !== userId)
      .map(({ authorUserId, mappedAuthorType, authorIncentive }) => ({
        userId: authorUserId,
        type: 'research_author_added',
        title: 'Added to Research Contribution',
        message: `You have been added as ${mappedAuthorType.replace(/_/g, ' ')} to the research contribution "${data.title}".`,
        referenceType: 'research_contribution',
        referenceId: contributionId,
        metadata: {
          authorRole: mappedAuthorType,
          contributionTitle: data.title,
          estimatedIncentive: authorIncentive.incentiveAmount,
          estimatedPoints: authorIncentive.points,
        },
      }));

    if (notificationRows.length) {
      await this.prisma.notification.createMany({ data: notificationRows });
    }
  }

  /**
   * Replace author rows for auto-imported contributions (e.g. Scopus co-author backfill).
   */
  async replaceImportedAuthors(contributionId, data) {
    const authors = Array.isArray(data.authors) ? data.authors : [];
    if (authors.length === 0) return;

    await this.prisma.researchContributionAuthor.deleteMany({
      where: { researchContributionId: contributionId },
    });
    await this._createAuthors(contributionId, data);

    await this.prisma.researchContribution.update({
      where: { id: contributionId },
      data: {
        totalAuthors: data.totalAuthors || authors.length,
        internalCoAuthors: data.internalCoAuthors ?? undefined,
        foreignCollaborationsCount: data.foreignCollaborationsCount ?? undefined,
        internationalAuthor: data.internationalAuthor ?? undefined,
        sgtAffiliatedAuthors: data.sgtAffiliatedAuthors ?? undefined,
      },
    });
  }

  async _createStatusHistory(contributionId, fromStatus, toStatus, changedById, comments) {
    await this.prisma.researchContributionStatusHistory.create({
      data: { researchContributionId: contributionId, fromStatus, toStatus, changedById, comments }
    });
  }

  _mapAuthorRole(author) {
    const role = author.authorRole;
    if (role === 'first_and_corresponding' || role === 'first_and_corresponding_author') {
      return 'first_and_corresponding_author';
    }
    if ((role === 'first_author' || role === 'first') && author.isCorresponding) {
      return 'first_and_corresponding_author';
    }
    if (role === 'first_author' || role === 'first') return 'first_author';
    if (role === 'corresponding_author' || role === 'corresponding') return 'corresponding_author';
    return 'co_author';
  }

  _resolveAuthorCategory(authorType) {
    const map = {
      internal_faculty: 'faculty', internal_student: 'student',
      external_academic: 'academic', external_industry: 'industry', external_other: 'other'
    };
    return map[authorType] || null;
  }

  _normalizeQuartile(quartile) {
    if (!quartile) return null;
    const mapping = {
      'top1': 'Top_1_', 'top 1': 'Top_1_', 'top 1%': 'Top_1_', 'top1%': 'Top_1_', 'top_1_': 'Top_1_',
      'top5': 'Top_5_', 'top 5': 'Top_5_', 'top 5%': 'Top_5_', 'top5%': 'Top_5_', 'top_5_': 'Top_5_',
      'q1': 'Q1', 'q2': 'Q2', 'q3': 'Q3', 'q4': 'Q4'
    };
    return mapping[quartile.toLowerCase().trim()] || quartile;
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async updateContribution(id, userId, updateData) {
    const contribution = await this.repo.findById(id, { applicantDetails: true, authors: true });
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('Only the applicant can update this contribution'); e.statusCode = 403; throw e; }
    const editableStatuses = ['draft', 'changes_required', 'resubmitted'];
    if (!editableStatuses.includes(contribution.status)) {
      const e = new Error(`Cannot edit contribution in status: ${contribution.status}`); e.statusCode = 400; throw e;
    }

    const selectedCategories = updateData.indexingCategories || [];
    if (selectedCategories.includes('subsidiary_if_above_20') && !updateData.subsidiaryImpactFactor && updateData.impactFactor) {
      updateData.subsidiaryImpactFactor = updateData.impactFactor;
    }

    const { authors, applicantDetails, mentorUid } = updateData;
    // Mass-assignment guard: only applicant-editable publication fields reach the update.
    // School/department go through _resolveSchoolAndDepartment below.
    const contributionData = pickAllowed(updateData, APPLICANT_EDITABLE_FIELDS);

    const booleanFields = ['communicatedWithOfficialId','isPresenter','virtualConference','fullPaper',
      'conferenceHeldAtSgt','conferenceBestPaperAward','industryCollaboration','centralFacilityUsed',
      'attendedVirtual','internationalAuthor','interdisciplinaryFromSgt','studentsFromSgt'];
    booleanFields.forEach(f => {
      if (contributionData[f] !== undefined) contributionData[f] = contributionData[f] === 'yes' || contributionData[f] === true;
    });
    if (contributionData.sdgGoals !== undefined) {
      contributionData.sdg_goals = contributionData.sdgGoals || [];
      delete contributionData.sdgGoals;
    }
    if (contributionData.quartile) contributionData.quartile = this._normalizeQuartile(contributionData.quartile);
    if ('ugcCareListed' in contributionData || 'ugcCareGroup' in contributionData) {
      const { ugcCareListed, ugcCareGroup } = contributionData;
      delete contributionData.ugcCareListed;
      delete contributionData.ugcCareGroup;
      // A group can only be sent together with "listed" (or when it is already listed)
      const listed = ugcCareListed !== undefined ? ugcCareListed
        : (ugcCareGroup ? (contribution.ugcCareListed === true ? true : undefined) : undefined);
      Object.assign(contributionData, normalizeUgcCare(listed, ugcCareGroup, { partial: true }));
    }
    // Scopus / Web of Science indexing implies UGC-CARE Group II, whatever was sent.
    if (contribution.publicationType === 'research_paper') {
      const implied = ugcCareFromIndexing(contributionData.indexingCategories ?? contribution.indexingCategories);
      if (implied) Object.assign(contributionData, implied);
    }

    const resolvedIds = await this._resolveSchoolAndDepartment({ ...updateData, userId });
    let schoolOperation = {};
    let departmentOperation = {};
    if (resolvedIds.schoolId !== contribution.schoolId) {
      schoolOperation = resolvedIds.schoolId ? { school: { connect: { id: resolvedIds.schoolId } } } : { school: { disconnect: true } };
    }
    if (resolvedIds.departmentId !== contribution.departmentId) {
      departmentOperation = resolvedIds.departmentId ? { department: { connect: { id: resolvedIds.departmentId } } } : { department: { disconnect: true } };
    }

    const updated = await this.repo.update(id, {
      ...contributionData, ...schoolOperation, ...departmentOperation, updatedAt: new Date()
    }, { applicantDetails: true, authors: { orderBy: { authorOrder: 'asc' } }, school: true, department: true });

    const updatedApplicantDetails = {
      ...pickAllowed(applicantDetails, APPLICANT_DETAILS_EDITABLE_FIELDS),
      ...(mentorUid !== undefined ? { mentorUid } : {}),
    };
    if (Object.keys(updatedApplicantDetails).length > 0 && contribution.applicantDetails) {
      await this.prisma.researchContributionApplicantDetails.update({
        where: { id: contribution.applicantDetails.id }, data: updatedApplicantDetails
      });
    } else if (Object.keys(updatedApplicantDetails).length > 0) {
      await this._createApplicantDetails(id, updatedApplicantDetails);
    }

    if (authors && Array.isArray(authors)) {
      await this.prisma.researchContributionAuthor.deleteMany({ where: { researchContributionId: id } });
      // Shares are computed from the saved publication fields overlaid with this edit, so a
      // partial edit (authors only) still uses the stored indexing / date / book fields.
      const { authors: _storedAuthors, applicantDetails: _storedDetails, ...storedFields } = contribution;
      await this._createAuthors(id, { ...storedFields, ...updateData, userId, publicationType: contribution.publicationType });
    }

    // Audit: log update
    if (this.auditLogger?.logResearchUpdate) {
      this.auditLogger.logResearchUpdate(contribution, updated, userId, null, 'Updated research contribution').catch(() => {});
    }

    const result = await this.repo.findById(id, {
      applicantDetails: true, authors: { orderBy: { authorOrder: 'asc' } }, school: true, department: true
    });
    const incentiveWarning = await this._incentiveWarningFor(result);
    return incentiveWarning ? { ...result, incentiveWarning } : result;
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async submitContribution(id, userId, request = null) {
    const contribution = await this.repo.findById(id, {
      applicantDetails: true, authors: true,
      applicantUser: { select: { id: true, uid: true, role: true, studentLogin: { select: { id: true } } } }
    });
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('Only the applicant can submit this contribution'); e.statusCode = 403; throw e; }
    if (contribution.status !== 'draft') { const e = new Error(`Cannot submit contribution in status: ${contribution.status}`); e.statusCode = 400; throw e; }

    // One claim per work per university: a co-author's earlier claim blocks this one.
    const { workKey, titleWorkKey } = await assertNoActiveClaim(contribution, this.prisma ? { client: this.prisma } : undefined);

    const isStudent = contribution.applicantUser?.studentLogin?.id || contribution.applicantUser?.role?.toLowerCase() === 'student';
    let newStatus = 'submitted';
    let statusMessage = 'Submitted for DRD review';
    let mentorId = null;

    if (isStudent) {
      const mentor = await this._resolveStudentMentor(contribution.applicantUserId, contribution.applicantDetails?.mentorUid);
      if (mentor) {
        newStatus = 'pending_mentor_approval';
        statusMessage = 'Submitted for mentor approval';
        mentorId = mentor.id;
        if (contribution.applicantDetails?.mentorUid !== mentor.uid) {
          // Record the (assigned) mentor so the mentor's queue and checks find it.
          if (contribution.applicantDetails?.id) {
            await this.prisma.researchContributionApplicantDetails.update({ where: { id: contribution.applicantDetails.id }, data: { mentorUid: mentor.uid } });
          } else {
            await this._createApplicantDetails(id, { mentorUid: mentor.uid });
          }
          contribution.applicantDetails = { ...(contribution.applicantDetails || {}), mentorUid: mentor.uid };
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id,
          applicantUserId: userId,
          status: 'draft',
        },
        data: {
          status: newStatus,
          submittedAt: new Date(),
          workKey,
          titleWorkKey,
          // The mentor is identified by applicantDetails.mentorUid; there is no mentorId column
          // on ResearchContribution (writing one made every student-with-mentor submission fail).
        },
      });

      if (updateResult.count !== 1) {
        const e = new Error('Contribution submission conflicted with another update. Please refresh and try again.');
        e.statusCode = 409;
        throw e;
      }

      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: id,
          fromStatus: 'draft',
          toStatus: newStatus,
          changedById: userId,
          comments: statusMessage,
        },
      });

      return tx.researchContribution.findUnique({ where: { id } });
    });

    if (newStatus === 'pending_mentor_approval' && contribution.applicantDetails?.mentorUid) {
      const mentor = await this.prisma.userLogin.findFirst({ where: { uid: contribution.applicantDetails.mentorUid } });
      if (mentor) {
        await this._dispatchNotification({
          userId: mentor.id, type: 'research_mentor_review',
          title: 'Research Paper Pending Your Approval',
          message: `Student submitted "${contribution.title}" for your review.`,
          metadata: { contributionId: id, applicationType: 'research_contribution', applicationNumber: contribution.applicationNumber }
        });
      }
    }

    await this._dispatchStatusAudit(updated, 'draft', newStatus, userId, request, statusMessage);
    if (newStatus === 'submitted') await this._notifyDrdOfSubmission({ ...contribution, ...updated });

    return {
      message: newStatus === 'pending_mentor_approval' ? 'Research contribution submitted to mentor for approval' : 'Research contribution submitted for DRD review',
      data: updated
    };
  }


  /**
   * Tell DRD a contribution is waiting in their queue: every active DRD member holding the
   * review or approve permission for this publication type, limited to their assigned schools
   * when they have any. Never the applicant. Failures are logged, never thrown.
   */
  async _notifyDrdOfSubmission(contribution, { resubmitted = false } = {}) {
    try {
      const type = contribution.publicationType;
      const keyPrefix = { research_paper: 'research', book: 'book', book_chapter: 'book', conference_paper: 'conference', grant_proposal: 'grant' }[type] || 'research';
      const schoolField = { research: 'assignedResearchSchoolIds', book: 'assignedBookSchoolIds', conference: 'assignedConferenceSchoolIds', grant: 'assignedGrantSchoolIds' }[keyPrefix];
      const drd = await this.prisma.centralDepartment.findFirst({
        where: { OR: [{ departmentCode: 'DRD' }, { departmentCode: 'drd' }, { shortName: 'DRD' }] },
        select: { id: true },
      });
      if (!drd) return;
      const rows = await this.prisma.centralDepartmentPermission.findMany({
        where: { centralDeptId: drd.id, isActive: true, user: { status: 'active' } },
        select: { userId: true, permissions: true, [schoolField]: true },
      });
      const label = { research_paper: 'Research paper', book: 'Book', book_chapter: 'Book chapter', conference_paper: 'Conference paper', grant_proposal: 'Grant proposal' }[type] || 'Contribution';
      const recipients = rows.filter((r) => {
        if (r.userId === contribution.applicantUserId) return false;
        const perms = r.permissions || {};
        // DRD staff review every publication type under research_*; type-specific keys also count.
        const canAct = perms[`${keyPrefix}_review`] || perms[`${keyPrefix}_approve`] || perms.research_review || perms.research_approve;
        if (!canAct) return false;
        const schools = (r[schoolField] || []).filter(Boolean);
        return schools.length === 0 || (contribution.schoolId && schools.includes(contribution.schoolId));
      });
      for (const r of recipients) {
        await this._dispatchNotification({
          userId: r.userId,
          type: resubmitted ? 'research_resubmitted_for_review' : 'research_submitted_for_review',
          title: resubmitted ? `${label} resubmitted` : `New ${label.toLowerCase()} to review`,
          message: `"${contribution.title}" (${contribution.applicationNumber || 'new'}) is waiting for DRD review.`,
          metadata: { contributionId: contribution.id, applicationType: 'research_contribution', applicationNumber: contribution.applicationNumber },
        });
      }
    } catch (error) {
      // Notifications must never block a submission.
      logger.warn('[research] DRD submission notification failed:', error.message);
    }
  }

  // ─── Mentor actions ──────────────────────────────────────────────────────

  async mentorApprove(id, mentorId, comments, request = null) {
    const contribution = await this.repo.findById(id, { applicantDetails: true });
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.status !== 'pending_mentor_approval') { const e = new Error(`Cannot approve contribution in status: ${contribution.status}`); e.statusCode = 400; throw e; }

    const mentor = await this.prisma.userLogin.findUnique({ where: { id: mentorId } });
    if (!mentor || mentor.uid !== contribution.applicantDetails?.mentorUid || mentor.id === contribution.applicantUserId) {
      const e = new Error('Only the assigned mentor can approve this contribution'); e.statusCode = 403; throw e;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id,
          status: 'pending_mentor_approval',
        },
        data: {
          status: 'submitted',
        },
      });

      if (updateResult.count !== 1) {
        const e = new Error('Mentor approval conflicted with another update. Please refresh and try again.');
        e.statusCode = 409;
        throw e;
      }

      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: id,
          fromStatus: 'pending_mentor_approval',
          toStatus: 'submitted',
          changedById: mentorId,
          comments: comments || 'Approved by mentor, forwarded to DRD',
        },
      });

      return tx.researchContribution.findUnique({ where: { id } });
    });

    const label = this._publicationLabel(contribution.publicationType);
    await this._dispatchNotification({
      userId: contribution.applicantUserId, type: 'research_mentor_approved',
      title: `Mentor Approved Your ${label}`,
      message: `Your mentor approved "${contribution.title}". It has been forwarded to DRD for review.`,
      metadata: { contributionId: id, applicationType: 'research_contribution', publicationType: contribution.publicationType }
    });

    await this._dispatchStatusAudit(
      updated,
      'pending_mentor_approval',
      'submitted',
      mentorId,
      request,
      comments || 'Approved by mentor, forwarded to DRD'
    );
    await this._notifyDrdOfSubmission({ ...contribution, ...updated });
    return updated;
  }

  async mentorReject(id, mentorId, comments, request = null) {
    const contribution = await this.repo.findById(id, { applicantDetails: true });
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.status !== 'pending_mentor_approval') { const e = new Error(`Cannot reject contribution in status: ${contribution.status}`); e.statusCode = 400; throw e; }

    const mentor = await this.prisma.userLogin.findUnique({ where: { id: mentorId } });
    if (!mentor || mentor.uid !== contribution.applicantDetails?.mentorUid || mentor.id === contribution.applicantUserId) {
      const e = new Error('Only the assigned mentor can reject this contribution'); e.statusCode = 403; throw e;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id,
          status: 'pending_mentor_approval',
        },
        data: {
          status: 'changes_required',
        },
      });

      if (updateResult.count !== 1) {
        const e = new Error('Mentor rejection conflicted with another update. Please refresh and try again.');
        e.statusCode = 409;
        throw e;
      }

      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: id,
          fromStatus: 'pending_mentor_approval',
          toStatus: 'changes_required',
          changedById: mentorId,
          comments,
        },
      });

      return tx.researchContribution.findUnique({ where: { id } });
    });

    await this._dispatchNotification({
      userId: contribution.applicantUserId, type: 'research_mentor_changes_required',
      title: 'Mentor Requested Changes',
      message: `Your mentor requested changes to "${contribution.title}". Please review and resubmit.`,
      metadata: { contributionId: id, applicationType: 'research_contribution', comments }
    });

    await this._dispatchStatusAudit(updated, 'pending_mentor_approval', 'changes_required', mentorId, request, comments);
    return updated;
  }

  // ─── Resubmit / Delete ───────────────────────────────────────────────────

  async resubmitContribution(id, userId, comments) {
    const contribution = await this.repo.findById(id);
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('Only the applicant can resubmit this contribution'); e.statusCode = 403; throw e; }
    if (contribution.status !== 'changes_required') { const e = new Error(`Cannot resubmit contribution in status: ${contribution.status}`); e.statusCode = 400; throw e; }

    // Who asked for the changes? If it was the mentor, the work goes back to the mentor, not DRD.
    const lastChangeRequest = await this.prisma.researchContributionStatusHistory.findFirst({
      where: { researchContributionId: id, toStatus: 'changes_required' },
      orderBy: { changedAt: 'desc' },
      select: { changedById: true },
    });
    const details = await this.prisma.researchContributionApplicantDetails.findFirst({
      where: { researchContributionId: id }, select: { mentorUid: true },
    });
    const mentorUser = details?.mentorUid
      ? await this.prisma.userLogin.findFirst({ where: { uid: details.mentorUid }, select: { id: true } })
      : null;
    const backToMentor = Boolean(mentorUser && lastChangeRequest?.changedById === mentorUser.id);
    const nextStatus = backToMentor ? 'pending_mentor_approval' : 'resubmitted';

    // Find the last reviewer who requested changes so they are auto-assigned for re-review
    const lastChangesReview = backToMentor ? null : await this.prisma.researchContributionReview.findFirst({
      where: { researchContributionId: id, decision: 'changes_required' },
      orderBy: { reviewedAt: 'desc' },
    });
    const originalReviewerId = lastChangesReview?.reviewerId || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.researchContribution.updateMany({
        where: {
          id,
          applicantUserId: userId,
          status: 'changes_required',
        },
        data: {
          status: nextStatus,
          revisionCount: (contribution.revisionCount || 0) + 1,
          currentReviewerId: originalReviewerId,
        },
      });

      if (updateResult.count !== 1) {
        const e = new Error('Contribution resubmission conflicted with another update. Please refresh and try again.');
        e.statusCode = 409;
        throw e;
      }

      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: id,
          fromStatus: 'changes_required',
          toStatus: nextStatus,
          changedById: userId,
          comments: comments || (backToMentor ? 'Resubmitted to mentor after making requested changes' : 'Resubmitted after making requested changes'),
        },
      });

      return tx.researchContribution.findUnique({ where: { id } });
    });

    // Audit: log resubmission status change
    this._dispatchStatusAudit(updated, 'changes_required', nextStatus, userId, null, comments || 'Resubmitted after making requested changes').catch(() => {});
    if (backToMentor) {
      await this._dispatchNotification({
        userId: mentorUser.id, type: 'research_mentor_review',
        title: 'Research resubmitted for your approval',
        message: `"${contribution.title}" was updated by the student and is waiting for your approval again.`,
        metadata: { contributionId: id, applicationType: 'research_contribution', applicationNumber: contribution.applicationNumber },
      }).catch(() => {});
    } else if (originalReviewerId) {
      await this._dispatchNotification({
        userId: originalReviewerId, type: 'research_resubmitted_for_review',
        title: 'Changes made — ready for re-review',
        message: `"${contribution.title}" (${contribution.applicationNumber}) was resubmitted after the changes you requested.`,
        metadata: { contributionId: id, applicationType: 'research_contribution', applicationNumber: contribution.applicationNumber },
      }).catch(() => {});
    } else {
      await this._notifyDrdOfSubmission({ ...contribution, ...updated }, { resubmitted: true });
    }

    return updated;
  }

  async deleteContribution(id, userId) {
    const contribution = await this.repo.findById(id);
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('Only the applicant can delete this contribution'); e.statusCode = 403; throw e; }
    if (contribution.status !== 'draft') { const e = new Error('Can only delete draft contributions'); e.statusCode = 400; throw e; }

    // Audit: log deletion
    if (this.auditLogger?.logResearchStatusChange) {
      this.auditLogger.logResearchStatusChange(contribution, 'draft', 'deleted', userId, null, 'Contribution deleted by applicant').catch(() => {});
    }

    await this.repo.delete(id);
  }

  // ─── Author management ───────────────────────────────────────────────────

  async addAuthor(id, userId, authorData) {
    const contribution = await this.repo.findById(id);
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('Only the applicant can add authors'); e.statusCode = 403; throw e; }

    let authorUserId = null;
    if (authorData.registrationNo || authorData.uid) {
      const user = await this.prisma.userLogin.findFirst({ where: { uid: authorData.registrationNo || authorData.uid } });
      if (user) authorUserId = user.id;
    }

    const author = await this.prisma.researchContributionAuthor.create({
      data: {
        researchContributionId: id, userId: authorUserId,
        uid: authorData.uid, registrationNo: authorData.registrationNo,
        name: authorData.name, email: authorData.email, phone: authorData.phone,
        affiliation: authorData.affiliation, department: authorData.department,
        authorOrder: authorData.authorOrder || 1, isCorresponding: authorData.isCorresponding || false,
        authorType: authorData.authorType || 'co_author', isInternal: authorData.isInternal !== false,
        authorCategory: authorData.authorCategory, isPhdWork: authorData.isPhdWork || false,
        phdTitle: authorData.phdTitle, phdObjectives: authorData.phdObjectives,
        coveredObjectives: authorData.coveredObjectives,
        addressesSocietal: authorData.addressesSocietal || false, addressesGovernment: authorData.addressesGovernment || false,
        addressesEnvironmental: authorData.addressesEnvironmental || false, addressesIndustrial: authorData.addressesIndustrial || false,
        addressesBusiness: authorData.addressesBusiness || false, addressesConceptual: authorData.addressesConceptual || false,
        isNewsworthy: authorData.isNewsworthy || false,
        incentiveShare: 0, pointsShare: 0,
        canView: true, canEdit: false
      }
    });
    // Every author's share depends on the whole author list, so all of them are recomputed.
    const shares = await this._recomputeStoredShares(id);
    const share = shares?.find((s) => s.id === author.id);
    if (share) Object.assign(author, { incentiveShare: share.incentiveShare, pointsShare: share.pointsShare });

    const authorCount = await this.prisma.researchContributionAuthor.count({ where: { researchContributionId: id } });
    await this.repo.update(id, { totalAuthors: authorCount + 1 });

    if (authorUserId) {
      await this.prisma.notification.create({ data: {
        userId: authorUserId, type: 'research_author_added', title: 'Added as Author',
        message: `You have been added as a ${authorData.authorType || 'co-author'} to research contribution: ${contribution.title}`,
        referenceType: 'research_contribution', referenceId: id
      }});
    }
    // Audit: log author addition
    if (this.auditLogger?.logResearchUpdate) {
      this.auditLogger.logResearchUpdate(null, { id, title: contribution.title, authorAdded: authorData.name || authorData.uid }, userId, null, `Added author: ${authorData.name || authorData.uid || 'unknown'}`).catch(() => {});
    }

    return author;
  }

  async updateAuthor(id, authorId, userId, data) {
    const contribution = await this.repo.findFirst({ id, applicantUserId: userId, status: { in: ['draft', 'changes_required'] } });
    if (!contribution) { const e = new Error('Contribution not found or cannot be edited'); e.statusCode = 404; throw e; }
    // The author must belong to THIS contribution (not any author row in the university)
    const author = await this.prisma.researchContributionAuthor.findFirst({
      where: { id: authorId, researchContributionId: id }, select: { id: true }
    });
    if (!author) { const e = new Error('Author not found'); e.statusCode = 404; throw e; }
    const updatedAuthor = await this.prisma.researchContributionAuthor.update({
      where: { id: author.id }, data: pickAllowed(data, AUTHOR_EDITABLE_FIELDS)
    });

    // Audit: log author update
    if (this.auditLogger?.logResearchUpdate) {
      this.auditLogger.logResearchUpdate(null, { id, title: contribution.title, authorUpdated: authorId }, userId, null, 'Updated author details').catch(() => {});
    }

    return updatedAuthor;
  }

  async removeAuthor(id, authorId, userId) {
    const contribution = await this.repo.findById(id);
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('Only the applicant can remove authors'); e.statusCode = 403; throw e; }
    // The author must belong to THIS contribution (not any author row in the university)
    const removedAuthor = await this.prisma.researchContributionAuthor.findFirst({
      where: { id: authorId, researchContributionId: id }, select: { id: true, name: true, uid: true }
    });
    if (!removedAuthor) { const e = new Error('Author not found'); e.statusCode = 404; throw e; }
    await this.prisma.researchContributionAuthor.delete({ where: { id: removedAuthor.id } });
    const authorCount = await this.prisma.researchContributionAuthor.count({ where: { researchContributionId: id } });
    await this.repo.update(id, { totalAuthors: authorCount + 1 });
    await this._recomputeStoredShares(id);

    // Audit: log author removal
    if (this.auditLogger?.logResearchUpdate) {
      this.auditLogger.logResearchUpdate({ id, title: contribution.title }, { id, authorRemoved: removedAuthor?.name || removedAuthor?.uid || authorId }, userId, null, `Removed author: ${removedAuthor?.name || removedAuthor?.uid || authorId}`).catch(() => {});
    }
  }

  /**
   * Recompute and store every author's share of a contribution from its stored rows (after
   * an author is added or removed), with the same computation approval uses.
   * @returns {Promise<Array<{id, incentiveShare, pointsShare}>|null>}
   */
  async _recomputeStoredShares(contributionId) {
    const contribution = await this.prisma.researchContribution.findUnique({
      where: { id: contributionId },
      include: { authors: { orderBy: { authorOrder: 'asc' } } },
    });
    if (!contribution?.authors?.length) return null;
    const shares = await computeAuthorShares(this.prisma, {
      contributionData: toIncentiveInput(contribution),
      publicationType: contribution.publicationType,
      authors: await storedAuthorsForShares(this.prisma, contribution.authors),
    });
    const updated = contribution.authors.map((a, i) => ({
      id: a.id, incentiveShare: shares.authors[i].incentive, pointsShare: shares.authors[i].points,
    }));
    for (const row of updated) {
      await this.prisma.researchContributionAuthor.update({
        where: { id: row.id }, data: { incentiveShare: row.incentiveShare, pointsShare: row.pointsShare },
      });
    }
    return updated;
  }

  // ─── Lookup ──────────────────────────────────────────────────────────────

  async lookupUserByRegistration(lookupValue) {
    const user = await this.prisma.userLogin.findFirst({
      where: { uid: lookupValue },
      select: {
        uid: true, email: true, phone: true, role: true,
        employeeDetails: { select: { firstName: true, lastName: true, displayName: true, email: true, phoneNumber: true, designation: true,
          primaryDepartment: { select: { departmentName: true, faculty: { select: { facultyName: true } } } }
        }},
        studentLogin: { select: { firstName: true, lastName: true, displayName: true, email: true, phone: true, currentSemester: true,
          program: { select: { programName: true, department: { select: { departmentName: true } } } }
        }}
      }
    });
    if (!user) return null;

    let userEmail = user.email || user.employeeDetails?.email || user.studentLogin?.email || '';
    let userPhone = user.phone || user.employeeDetails?.phoneNumber || user.studentLogin?.phone || '';
    const name = user.employeeDetails?.displayName || user.studentLogin?.displayName ||
      `${user.employeeDetails?.firstName || user.studentLogin?.firstName || ''} ${user.employeeDetails?.lastName || user.studentLogin?.lastName || ''}`.trim() || user.uid;

    return {
      uid: user.uid, name, displayName: name, email: userEmail, phone: userPhone,
      designation: user.employeeDetails?.designation,
      department: user.employeeDetails?.primaryDepartment?.departmentName || user.studentLogin?.program?.department?.departmentName,
      school: user.employeeDetails?.primarySchool?.facultyName,
      course: user.studentLogin?.program?.programName, semester: user.studentLogin?.currentSemester,
      role: user.role, userType: user.role === 'student' ? 'student' : user.role,
      employeeDetails: user.employeeDetails, studentProfile: user.studentLogin
    };
  }

  // ─── Read helpers ────────────────────────────────────────────────────────

  async getContributedResearch(userId, userUid) {
    return this.prisma.researchContributionAuthor.findMany({
      where: { OR: [{ userId }, { uid: userUid }, { registrationNo: userUid }] },
      select: {
        authorType: true,
        incentiveShare: true,
        pointsShare: true,
        researchContribution: {
          select: {
            id: true,
            applicationNumber: true,
            applicantUserId: true,
            publicationType: true,
            title: true,
            journalName: true,
            conferenceName: true,
            status: true,
            submittedAt: true,
            createdAt: true,
            incentiveAmount: true,
            pointsAwarded: true,
            calculatedIncentiveAmount: true,
            calculatedPoints: true,
            schoolId: true,
            departmentId: true,
            school: {
              select: {
                id: true,
                facultyName: true,
                shortName: true,
              },
            },
            department: {
              select: {
                id: true,
                departmentName: true,
                shortName: true,
              },
            },
            authors: {
              select: {
                userId: true,
                uid: true,
                registrationNo: true,
                authorType: true,
                incentiveShare: true,
                pointsShare: true,
              },
            },
          },
        },
      },
    });
  }

  async getGrantById(id) {
    return this.prisma.grantApplication.findUnique({
      where: { id },
      include: {
        applicantUser: { select: { id: true, uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true, designation: true } } } },
        school: true, investigators: true, reviews: true,
        statusHistory: { include: { changedBy: { select: { id: true, uid: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } } }, orderBy: { changedAt: 'desc' } }
      }
    });
  }

  /**
   * Load a contribution (or, as a fallback, a grant application) that the viewer may see.
   * Throws 404 when the record is missing OR the viewer has no relationship/permission,
   * so another user's record is indistinguishable from a missing one.
   * @param {string} id
   * @param {object} user - req.user
   * @returns {Promise<{ record: object, isGrant: boolean }>}
   */
  async getContributionForViewer(id, user) {
    const person = { select: { id: true, uid: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } };
    const contribution = await this.repo.findById(id, {
      applicantDetails: true, authors: true, school: true, department: true,
      reviews: { include: { reviewer: person }, orderBy: { createdAt: 'desc' } },
      statusHistory: { include: { changedBy: person }, orderBy: { changedAt: 'desc' } },
      editSuggestions: { include: { reviewer: { select: { id: true, uid: true, employeeDetails: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } },
      applicantUser: { select: { id: true, uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true, designation: true } } } },
    });
    if (contribution) {
      if (!canViewContribution(user, contribution)) throw notFound('Research contribution or grant not found');
      return { record: contribution, isGrant: false };
    }
    const grant = await this.getGrantById(id);
    if (!grant || !canViewGrant(user, grant)) throw notFound('Research contribution or grant not found');
    return { record: grant, isGrant: true };
  }

  /**
   * Resolve the S3 key of a contribution document the viewer may download.
   * @param {string} id
   * @param {object} user - req.user
   * @param {'manuscript'|'supporting'} type
   * @param {string} filename
   * @returns {Promise<{ s3Key: string, filename: string }>} throws 404 when missing or not visible
   */
  async resolveDocumentForViewer(id, user, type, filename) {
    const contribution = await this.repo.findById(id, CONTRIBUTION_ACCESS_INCLUDE);
    if (!contribution || !canViewContribution(user, contribution)) throw notFound('Research contribution not found');

    let s3Key = null;
    let originalFilename = filename;
    if (type === 'manuscript' && contribution.manuscriptFilePath) {
      let m = contribution.manuscriptFilePath;
      if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { s3Key = m; } }
      if (m && typeof m === 'object') { s3Key = m.s3Key; originalFilename = m.name || filename; }
    } else if (type === 'supporting' && contribution.supportingDocsFilePaths) {
      let docs = contribution.supportingDocsFilePaths;
      if (typeof docs === 'string') { try { docs = JSON.parse(docs); } catch (e) { docs = null; } }
      const doc = docs?.files?.find(f => f.name === filename || f.s3Key?.includes(filename));
      if (doc) { s3Key = doc.s3Key; originalFilename = doc.name || filename; }
    }
    if (!s3Key) throw notFound('Document not found');
    return { s3Key, filename: originalFilename };
  }

  async getIncentivePolicies() {
    return this.prisma.researchIncentivePolicy.findMany({ orderBy: [{ publicationType: 'asc' }, { effectiveFrom: 'desc' }] });
  }

  // ─── Document upload ────────────────────────────────────────────────────

  async uploadDocuments(id, userId, files) {
    const { uploadToS3 } = require('../../../shared/utils/s3');
    const contribution = await this.repo.findById(id);
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.applicantUserId !== userId) { const e = new Error('You can only upload documents for your own contributions'); e.statusCode = 403; throw e; }

    const uploadedFiles = { researchDocument: null, supportingDocuments: [] };

    if (files) {
      if (files.researchDocument?.[0]) {
        const file = files.researchDocument[0];
        const s3Result = await uploadToS3(file.buffer, 'research', userId.toString(), file.originalname, file.mimetype);
        uploadedFiles.researchDocument = { filename: file.originalname, originalName: file.originalname, path: s3Result.key, s3Key: s3Result.key, size: file.size, mimetype: file.mimetype };
      }
      if (files.supportingDocuments) {
        for (const file of files.supportingDocuments) {
          const s3Result = await uploadToS3(file.buffer, 'research/supporting', userId.toString(), file.originalname, file.mimetype);
          uploadedFiles.supportingDocuments.push({ filename: file.originalname, originalName: file.originalname, path: s3Result.key, s3Key: s3Result.key, size: file.size, mimetype: file.mimetype });
        }
      }
    }

    const updateData = {};
    if (uploadedFiles.researchDocument) {
      updateData.manuscriptFilePath = JSON.stringify({ s3Key: uploadedFiles.researchDocument.s3Key, name: uploadedFiles.researchDocument.originalName, size: uploadedFiles.researchDocument.size, mimetype: uploadedFiles.researchDocument.mimetype, uploadedAt: new Date().toISOString() });
    }
    if (uploadedFiles.supportingDocuments.length > 0) {
      const existing = contribution.supportingDocsFilePaths || { files: [] };
      updateData.supportingDocsFilePaths = { files: [...(existing.files || []), ...uploadedFiles.supportingDocuments.map(doc => ({ path: doc.path, s3Key: doc.s3Key, name: doc.originalName, size: doc.size, mimetype: doc.mimetype, uploadedAt: new Date().toISOString() }))] };
    }

    const updatedContribution = await this.repo.update(id, updateData);
    return { researchDocument: uploadedFiles.researchDocument, supportingDocuments: uploadedFiles.supportingDocuments, contribution: { id: updatedContribution.id, manuscriptFilePath: updatedContribution.manuscriptFilePath, supportingDocsFilePaths: updatedContribution.supportingDocsFilePaths } };
  }

  _publicationLabel(publicationType) {
    const labels = { research_paper: 'Research Paper', book: 'Book', book_chapter: 'Book Chapter', conference_paper: 'Conference Paper', grant: 'Grant' };
    return labels[publicationType] || 'Publication';
  }
}

module.exports = ContributionService;
