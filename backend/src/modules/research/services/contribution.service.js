/**
 * Research Contribution Service
 * Framework-agnostic business logic for research contributions.
 * Dependencies injected via constructor for testability.
 */

const { analyzeAuthorComposition, IncentiveCalculator } = require('./incentive-calculator');

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

    const incentiveCalculation = await this._calculateApplicantIncentives(data);
    const resolvedIds = await this._resolveSchoolAndDepartment(data);

    let contribution;
    let attempts = 0;
    while (attempts < 5) {
      const applicationNumber = await this._generateApplicationNumber(data.publicationType);
      try {
        contribution = await this.repo.create(
          this._buildContributionPayload(data, files, applicationNumber, incentiveCalculation, resolvedIds)
        );
        break;
      } catch (err) {
        // P2002 on application_number = concurrent sync generated the same sequence number
        if (err.code === 'P2002' && err.meta?.target?.includes('application_number') && attempts < 4) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    await this._createApplicantDetails(contribution.id, data.applicantDetails);
    await this._createAuthors(contribution.id, data);
    await this._createStatusHistory(contribution.id, null, 'draft', data.userId, 'Research contribution created');

    const fullContribution = await this.repo.findById(contribution.id, {
      applicantDetails: true,
      authors: true,
      statusHistory: { orderBy: { changedAt: 'desc' } },
      school: true,
      department: true
    });

    await this.dispatchPostCreationSideEffects(fullContribution, data.userId, data.request);
    return fullContribution;
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

  async _generateApplicationNumber(publicationType) {
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
    return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async _calculateApplicantIncentives(data) {
    const activePolicy = await this.prisma.researchIncentivePolicy.findFirst({
      where: { publicationType: 'research_paper', isActive: true },
      select: { first_author_percentage: true, corresponding_author_percentage: true }
    });

    if (!activePolicy?.first_author_percentage || !activePolicy?.corresponding_author_percentage) {
      const err = new Error('No active research policy configured. Please configure policy in admin panel.');
      err.statusCode = 500;
      throw err;
    }

    const authorsList = data.authors || [];
    const totalAuthorCount = authorsList.length || 1;
    const applicantAuthorRole = authorsList[0]?.authorRole || 'co_author';
    const effectiveApplicantRole = totalAuthorCount === 1 ? 'first_and_corresponding_author' : applicantAuthorRole;

    const applicantType = this._resolveApplicantType(data.userRole);
    const authorComposition = analyzeAuthorComposition(
      authorsList, applicantType, effectiveApplicantRole,
      Number(activePolicy.first_author_percentage),
      Number(activePolicy.corresponding_author_percentage)
    );

    const calculator = new IncentiveCalculator(this.prisma);
    return calculator.calculate({
      contributionData: this._buildIncentiveContributionData(data),
      publicationType: data.publicationType,
      authorRole: effectiveApplicantRole,
      isStudent: data.userRole === 'student',
      sjrValue: Number(data.sjr) || 0,
      coAuthorCount: authorComposition.internalCoAuthorCount + authorComposition.externalCoAuthorCount,
      totalAuthors: totalAuthorCount,
      isInternal: true,
      internalCoAuthorCount: authorComposition.internalCoAuthorCount,
      externalFirstCorrespondingPct: authorComposition.externalFirstCorrespondingPct,
      internalEmployeeCoAuthorCount: authorComposition.internalEmployeeCoAuthorCount
    });
  }

  _resolveApplicantType(userRole) {
    if (userRole === 'student') return 'internal_student';
    if (userRole === 'staff') return 'internal_staff';
    return 'internal_faculty';
  }

  _buildIncentiveContributionData(data) {
    const normalizedBookType = data.bookType || data.bookPublicationType || null;
    const subsidiaryIF = data.subsidiaryImpactFactor ||
      ((data.indexingCategories || []).includes('subsidiary_if_above_20') ? data.impactFactor : null);
    return {
      publicationDate: data.publicationDate,
      quartile: data.quartile,
      conferenceSubType: data.conferenceSubType,
      proceedingsQuartile: data.proceedingsQuartile,
      bookType: normalizedBookType,
      indexingCategories: data.indexingCategories || [],
      impactFactor: data.impactFactor ? Number(data.impactFactor) : null,
      sjr: Number(data.sjr) || 0,
      naasRating: data.naasRating ? Number(data.naasRating) : null,
      subsidiaryImpactFactor: subsidiaryIF ? Number(subsidiaryIF) : null,
      conferenceType: data.conferenceType,
      conferenceBestPaperAward: data.conferenceBestPaperAward,
      isInternational: data.isInternational
    };
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

  async _createAuthors(contributionId, data) {
    const { authors = [], userId, publicationType, indexingCategories, impactFactor,
      sjr, naasRating, subsidiaryImpactFactor, publicationDate, quartile,
      conferenceSubType, proceedingsQuartile, userRole } = data;
    const bookType = data.bookType || data.bookPublicationType || null;

    if (!authors.length) return;

    const authorsList = authors;
    const totalAuthorCount = authorsList.length || 1;
    const applicantType = this._resolveApplicantType(userRole);
    const applicantAuthorRole = authorsList[0]?.authorRole || 'co_author';
    const effectiveApplicantRole = totalAuthorCount === 1 ? 'first_and_corresponding_author' : applicantAuthorRole;

    const activePolicy = await this.prisma.researchIncentivePolicy.findFirst({
      where: { publicationType: 'research_paper', isActive: true },
      select: { first_author_percentage: true, corresponding_author_percentage: true }
    });

    const policyFirstPct = Number(activePolicy?.first_author_percentage || 40);
    const policyCorrespondingPct = Number(activePolicy?.corresponding_author_percentage || 40);

    const authorComposition = analyzeAuthorComposition(
      authorsList, applicantType, effectiveApplicantRole, policyFirstPct, policyCorrespondingPct
    );

    const subsidiaryIF = subsidiaryImpactFactor ||
      ((indexingCategories || []).includes('subsidiary_if_above_20') ? impactFactor : null);

    const incentiveContributionData = {
      publicationDate, quartile, conferenceSubType, proceedingsQuartile, bookType,
      indexingCategories: indexingCategories || [],
      impactFactor: impactFactor ? Number(impactFactor) : null,
      sjr: Number(sjr) || 0,
      naasRating: naasRating ? Number(naasRating) : null,
      subsidiaryImpactFactor: subsidiaryIF ? Number(subsidiaryIF) : null
    };

    const calculator = new IncentiveCalculator(this.prisma);
    const t = (v, max) => (v ? String(v).substring(0, max) : v);

    // Batch-resolve all author UIDs in a single query instead of one per author
    const authorUids = authorsList
      .map(a => a.registrationNumber || a.uid)
      .filter(Boolean);
    const resolvedUsers = authorUids.length
      ? await this.prisma.userLogin.findMany({
          where: { uid: { in: authorUids } },
          select: { id: true, uid: true }
        })
      : [];
    const uidToUserId = Object.fromEntries(resolvedUsers.map(u => [u.uid, u.id]));

    // Compute per-author data (incentive calc remains async — run in parallel)
    const enrichedAuthors = await Promise.all(
      authorsList.map(async (author) => {
        const uidKey = author.registrationNumber || author.uid;
        const authorUserId = (uidKey && uidToUserId[uidKey]) || null;

        const mappedAuthorType = this._mapAuthorRole(author);
        const isInternalAuthor = author.authorType?.startsWith('internal_') ||
          author.affiliation?.toLowerCase().includes('sgt') ||
          author.affiliation?.toLowerCase().includes('university') || false;
        const authorIsStudent = author.authorType === 'internal_student';
        const authorCategory = this._resolveAuthorCategory(author.authorType);

        const authorIncentive = await calculator.calculate({
          contributionData: incentiveContributionData,
          publicationType,
          authorRole: mappedAuthorType,
          isStudent: authorIsStudent,
          sjrValue: Number(sjr) || 0,
          coAuthorCount: authorComposition.internalCoAuthorCount + authorComposition.externalCoAuthorCount,
          totalAuthors: totalAuthorCount,
          isInternal: isInternalAuthor,
          internalCoAuthorCount: authorComposition.internalCoAuthorCount,
          externalFirstCorrespondingPct: authorComposition.externalFirstCorrespondingPct,
          internalEmployeeCoAuthorCount: authorComposition.internalEmployeeCoAuthorCount
        });

        return {
          authorUserId,
          mappedAuthorType,
          isInternalAuthor,
          authorCategory,
          authorIncentive,
          author,
        };
      })
    );

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

    const { authors, applicantDetails, mentorUid, schoolId, departmentId,
      targetedResearchType: _t, citationIndex: _c, ...contributionData } = updateData;

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

    const updatedApplicantDetails = { ...(applicantDetails || {}), ...(mentorUid !== undefined ? { mentorUid } : {}) };
    if (Object.keys(updatedApplicantDetails).length > 0 && contribution.applicantDetails) {
      await this.prisma.researchContributionApplicantDetails.update({
        where: { id: contribution.applicantDetails.id }, data: updatedApplicantDetails
      });
    }

    if (authors && Array.isArray(authors)) {
      await this.prisma.researchContributionAuthor.deleteMany({ where: { researchContributionId: id } });
      await this._createAuthors(id, { ...updateData, userId, publicationType: contribution.publicationType });
    }

    // Audit: log update
    if (this.auditLogger?.logResearchUpdate) {
      this.auditLogger.logResearchUpdate(contribution, updated, userId, null, 'Updated research contribution').catch(() => {});
    }

    return this.repo.findById(id, {
      applicantDetails: true, authors: { orderBy: { authorOrder: 'asc' } }, school: true, department: true
    });
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

    const isStudent = contribution.applicantUser?.studentLogin?.id || contribution.applicantUser?.role?.toLowerCase() === 'student';
    const hasMentor = contribution.applicantDetails?.mentorUid || contribution.applicantDetails?.mentorName;
    let newStatus = 'submitted';
    let statusMessage = 'Submitted for DRD review';
    let mentorId = null;

    if (isStudent && hasMentor && contribution.applicantDetails?.mentorUid) {
      newStatus = 'pending_mentor_approval';
      statusMessage = 'Submitted for mentor approval';
      const mentor = await this.prisma.userLogin.findFirst({ where: { uid: contribution.applicantDetails.mentorUid } });
      if (mentor) mentorId = mentor.id;
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
          ...(mentorId && { mentorId }),
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

    return {
      message: isStudent && hasMentor ? 'Research contribution submitted to mentor for approval' : 'Research contribution submitted for DRD review',
      data: updated
    };
  }

  // ─── Mentor actions ──────────────────────────────────────────────────────

  async mentorApprove(id, mentorId, comments, request = null) {
    const contribution = await this.repo.findById(id, { applicantDetails: true });
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.status !== 'pending_mentor_approval') { const e = new Error(`Cannot approve contribution in status: ${contribution.status}`); e.statusCode = 400; throw e; }

    const mentor = await this.prisma.userLogin.findUnique({ where: { id: mentorId } });
    if (!mentor || mentor.uid !== contribution.applicantDetails?.mentorUid) {
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
          mentorApprovedAt: new Date(),
          mentorRemarks: comments || 'Approved by mentor',
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
    return updated;
  }

  async mentorReject(id, mentorId, comments, request = null) {
    const contribution = await this.repo.findById(id, { applicantDetails: true });
    if (!contribution) { const e = new Error('Research contribution not found'); e.statusCode = 404; throw e; }
    if (contribution.status !== 'pending_mentor_approval') { const e = new Error(`Cannot reject contribution in status: ${contribution.status}`); e.statusCode = 400; throw e; }

    const mentor = await this.prisma.userLogin.findUnique({ where: { id: mentorId } });
    if (!mentor || mentor.uid !== contribution.applicantDetails?.mentorUid) {
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
          mentorRemarks: comments,
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

    // Find the last reviewer who requested changes so they are auto-assigned for re-review
    const lastChangesReview = await this.prisma.researchContributionReview.findFirst({
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
          status: 'resubmitted',
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
          toStatus: 'resubmitted',
          changedById: userId,
          comments: comments || 'Resubmitted after making requested changes',
        },
      });

      return tx.researchContribution.findUnique({ where: { id } });
    });

    // Audit: log resubmission status change
    this._dispatchStatusAudit(updated, 'changes_required', 'resubmitted', userId, null, comments || 'Resubmitted after making requested changes').catch(() => {});

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

    const activePolicy = await this.prisma.researchIncentivePolicy.findFirst({
      where: { publicationType: 'research_paper', isActive: true },
      select: { first_author_percentage: true, corresponding_author_percentage: true }
    });
    if (!activePolicy?.first_author_percentage || !activePolicy?.corresponding_author_percentage) {
      const e = new Error('No active research policy configured. Please configure policy in admin panel.'); e.statusCode = 500; throw e;
    }

    const calculator = new IncentiveCalculator(this.prisma);
    const authorIncentive = await calculator.calculate({
      contributionData: contribution,
      publicationType: contribution.publicationType,
      authorRole: authorData.authorRole || 'co_author',
      isStudent: authorData.authorType === 'internal_student',
      sjrValue: Number(contribution.sjr) || 0,
      coAuthorCount: 1, totalAuthors: 2, isInternal: authorData.authorType?.startsWith('internal_') !== false,
      internalCoAuthorCount: 1, externalFirstCorrespondingPct: 0, internalEmployeeCoAuthorCount: 1
    });

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
        incentiveShare: authorIncentive.incentiveAmount, pointsShare: authorIncentive.points,
        canView: true, canEdit: false
      }
    });

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
    const updatedAuthor = await this.prisma.researchContributionAuthor.update({ where: { id: authorId }, data });

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
    const removedAuthor = await this.prisma.researchContributionAuthor.findUnique({ where: { id: authorId }, select: { name: true, uid: true } });
    await this.prisma.researchContributionAuthor.delete({ where: { id: authorId } });
    const authorCount = await this.prisma.researchContributionAuthor.count({ where: { researchContributionId: id } });
    await this.repo.update(id, { totalAuthors: authorCount + 1 });

    // Audit: log author removal
    if (this.auditLogger?.logResearchUpdate) {
      this.auditLogger.logResearchUpdate({ id, title: contribution.title }, { id, authorRemoved: removedAuthor?.name || removedAuthor?.uid || authorId }, userId, null, `Removed author: ${removedAuthor?.name || removedAuthor?.uid || authorId}`).catch(() => {});
    }
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

  async getIncentivePolicies() {
    return this.prisma.researchIncentivePolicy.findMany({ orderBy: [{ publicationType: 'asc' }, { authorType: 'asc' }] });
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
