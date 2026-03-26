/**
 * IPR Service
 * Contains all IPR business logic, extracted from ipr.controller.js.
 * Accepts iprRepository, emailService, auditLogger via constructor.
 */

const { logIprFiling, logIprUpdate, logIprStatusChange, logFileUpload } = require('../../../shared/utils/auditLogger');
const log = require('../../../shared/utils/logger');

const IPR_LIST_INCLUDE = {
  contributors: {
    select: {
      id: true,
      uid: true,
      userId: true,
      name: true,
      role: true,
      canView: true,
      canEdit: true,
    },
  },
  reviews: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      decision: true,
      createdAt: true,
      reviewedAt: true,
    },
  },
  statusHistory: {
    orderBy: { changedAt: 'desc' },
    take: 1,
    select: {
      fromStatus: true,
      toStatus: true,
      comments: true,
    },
  },
};

const IPR_CONTRIBUTED_INCLUDE = {
  iprApplication: {
    include: {
      contributors: IPR_LIST_INCLUDE.contributors,
      reviews: IPR_LIST_INCLUDE.reviews,
      statusHistory: IPR_LIST_INCLUDE.statusHistory,
    },
  },
};

function parsePaginationQuery(query = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  return {
    usePagination: query.page !== undefined || query.limit !== undefined,
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

class IprService {
  /**
   * @param {import('../repositories/ipr.repository')} iprRepository
   * @param {object} [emailService]
   * @param {object} [auditLogger]
   */
  constructor(iprRepository, emailService = null, auditLogger = null) {
    this.repo = iprRepository;
    this.emailService = emailService;
    this.auditLogger = auditLogger;
  }

  // ─── Incentive Calculation ─────────────────────────────────────────────────

  /**
   * Calculate IPR incentives based on the active policy.
   * @param {string} iprType
   * @param {string} filingType
   * @param {string} projectType
   * @returns {{ incentiveAmount: number, pointsAwarded: number }}
   */
  async calculateIprIncentives(iprType, filingType, projectType) {
    try {
      const policy = await this.repo.findActivePolicy(iprType);
      if (!policy) return { incentiveAmount: 0, pointsAwarded: 0 };

      let incentiveAmount = parseFloat(policy.baseIncentiveAmount);
      let pointsAwarded = policy.basePoints;

      if (policy.filingTypeMultiplier && typeof policy.filingTypeMultiplier === 'object') {
        const multiplier = policy.filingTypeMultiplier[filingType];
        if (multiplier) incentiveAmount *= parseFloat(multiplier);
      }

      if (policy.projectTypeBonus && typeof policy.projectTypeBonus === 'object') {
        const bonus = policy.projectTypeBonus[projectType];
        if (bonus) incentiveAmount += parseFloat(bonus);
      }

      return {
        incentiveAmount: Math.round(incentiveAmount * 100) / 100,
        pointsAwarded,
      };
    } catch (err) {
      log.warn('[IprService] calculateIprIncentives failed, returning zero incentives:', err.message);
      return { incentiveAmount: 0, pointsAwarded: 0 };
    }
  }

  // ─── Application Number Generation ────────────────────────────────────────

  /**
   * Generate a unique application number for the given IPR type.
   * @param {string} iprType
   * @returns {string}
   */
  async generateApplicationNumber(iprType) {
    const currentYear = new Date().getFullYear();
    const typePrefix = { patent: 'PAT', copyright: 'CPY', trademark: 'TRM', design: 'DES' };
    const prefix = typePrefix[iprType] || 'IPR';

    const latestApp = await this.repo.findFirst(
      { applicationNumber: { startsWith: `${prefix}-${currentYear}-` } },
      { orderBy: { applicationNumber: 'desc' }, select: { applicationNumber: true } }
    );

    let nextNumber = 1;
    if (latestApp?.applicationNumber) {
      const parts = latestApp.applicationNumber.split('-');
      if (parts.length === 3) nextNumber = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
  }

  // ─── School / Department Resolution ───────────────────────────────────────

  /**
   * Resolve schoolId and departmentId from the user's profile when not provided.
   * @param {string} userId
   * @param {string|null} schoolId
   * @param {string|null} departmentId
   * @returns {{ resolvedSchoolId, resolvedDepartmentId }}
   */
  async resolveSchoolDepartment(userId, schoolId, departmentId) {
    let resolvedSchoolId = schoolId;
    let resolvedDepartmentId = departmentId;

    if (resolvedSchoolId && resolvedDepartmentId) {
      return { resolvedSchoolId, resolvedDepartmentId };
    }

    const employeeDetails = await this.repo.findEmployeeDetails(userId, {
      primarySchoolId: true,
      primaryDepartmentId: true,
    });

    if (employeeDetails) {
      if (!resolvedDepartmentId) resolvedDepartmentId = employeeDetails.primaryDepartmentId;
      if (!resolvedSchoolId) resolvedSchoolId = employeeDetails.primarySchoolId;
    }

    if (!resolvedSchoolId) {
      const studentDetails = await this.repo.findStudentDetails(userId, {
        programId: true,
        program: { select: { departmentId: true, department: { select: { id: true, facultyId: true } } } },
      });
      if (studentDetails?.program?.department) {
        if (!resolvedDepartmentId) resolvedDepartmentId = studentDetails.program.department.id;
        if (!resolvedSchoolId) resolvedSchoolId = studentDetails.program.department.facultyId;
      }
    }

    return { resolvedSchoolId, resolvedDepartmentId };
  }

  // ─── Submission Status Logic ───────────────────────────────────────────────

  /**
   * Determine the auto-submission status for a new application.
   * Students with a mentor go to pending_mentor_approval; everyone else to submitted.
   * @param {string} userId
   * @param {string|null} mentorUid
   * @returns {{ newStatus, statusComment }}
   */
  async determineSubmissionStatus(userId, mentorUid) {
    const user = await this.repo.findUserById(userId, { role: true });
    const isStudent = user?.role === 'student';
    const hasMentor = mentorUid && mentorUid.trim() !== '';
    const newStatus = isStudent && hasMentor ? 'pending_mentor_approval' : 'submitted';
    const statusComment = isStudent && hasMentor
      ? 'Application auto-submitted for mentor approval'
      : 'Application auto-submitted to DRD for review';
    return { newStatus, statusComment, isStudent, hasMentor };
  }

  // ─── Contributor Creation ──────────────────────────────────────────────────

  /**
   * Create contributor records and send notifications for each contributor.
   * @param {string} iprApplicationId
   * @param {string} iprTitle
   * @param {string} iprType
   * @param {string} applicantUserId
   * @param {object[]} contributors
   */
  async createContributors(iprApplicationId, iprTitle, iprType, applicantUserId, contributors) {
    if (!contributors || contributors.length === 0) return;

    for (const contributor of contributors) {
      let contributorUserId = null;
      if (contributor.uid) {
        const userLogin = await this.repo.findUserByUid(contributor.uid, { id: true });
        if (userLogin) contributorUserId = userLogin.id;
      }

      await this.repo.createContributor({
        iprApplicationId,
        userId: contributorUserId,
        uid: contributor.uid || null,
        name: contributor.name || 'Unknown',
        email: contributor.email || null,
        phone: contributor.phone || null,
        department: contributor.universityDeptName || null,
        employeeCategory: contributor.employeeCategory || null,
        employeeType: contributor.employeeType || null,
        role: 'inventor',
        canView: true,
        canEdit: false,
      });

      if (contributorUserId) {
        await this.repo.createNotification({
          userId: contributorUserId,
          type: 'ipr_contributor_added',
          title: 'Added as Inventor/Contributor',
          message: `You have been added as an inventor/contributor to IPR application: "${iprTitle}"`,
          metadata: { iprApplicationId, iprTitle, iprType, addedBy: applicantUserId },
        });
      }
    }
  }

  // ─── Mentor Notification ───────────────────────────────────────────────────

  /**
   * Notify a mentor that an application needs their approval.
   * @param {string} mentorUid
   * @param {string} iprType
   * @param {string} title
   * @param {string} applicationNumber
   * @param {string} iprApplicationId
   * @param {string} applicantUserId
   * @param {string} [applicantName]
   * @param {string} [notifType]
   */
  async notifyMentor(mentorUid, iprType, title, applicationNumber, iprApplicationId, applicantUserId, applicantName = 'An applicant', notifType = 'ipr_mentor_approval') {
    const mentorUser = await this.repo.findUserByUid(mentorUid);
    if (!mentorUser) return;

    await this.repo.createNotification({
      userId: mentorUser.id,
      type: notifType,
      title: 'IPR Application Needs Your Approval',
      message: `${applicantName} has submitted a ${iprType} application titled "${title}" and requires your approval. Application ID: ${applicationNumber}`,
      referenceType: 'ipr_application',
      referenceId: iprApplicationId,
      metadata: { iprType, applicantUserId, applicantName, applicationNumber, action: 'mentor_approval_required' },
    });
  }

  // ─── SDG Helpers ───────────────────────────────────────────────────────────

  /**
   * Parse and normalise an array of SDG values into { iprApplicationId, sdgCode, sdgTitle } objects.
   * @param {string} iprApplicationId
   * @param {Array<string|object>} sdgs
   * @returns {object[]}
   */
  parseSdgs(iprApplicationId, sdgs) {
    if (!sdgs || !Array.isArray(sdgs)) return [];

    return sdgs
      .map((sdg) => {
        let sdgCode = '';
        let sdgTitle = '';

        if (typeof sdg === 'string') {
          sdgCode = sdg;
          sdgTitle = `SDG ${sdg.replace(/SDG/gi, '').trim()}`;
        } else if (typeof sdg === 'object' && sdg !== null) {
          sdgCode = sdg.code || sdg.sdgCode || '';
          sdgTitle = sdg.title || sdg.sdgTitle || '';
          if (typeof sdgCode !== 'string') return null;
          if (!sdgTitle && sdgCode) sdgTitle = `SDG ${sdgCode.replace(/SDG/gi, '').trim()}`;
        }

        if (!sdgCode || sdgCode.trim() === '') return null;

        return {
          iprApplicationId,
          sdgCode: String(sdgCode).trim(),
          sdgTitle: sdgTitle || `SDG ${String(sdgCode).replace(/SDG/gi, '').trim()}`,
        };
      })
      .filter(Boolean);
  }

  // ─── Create Application ────────────────────────────────────────────────────

  /**
   * Create a new IPR application, apply incentives, create contributors, and auto-submit.
   * @param {object} data - parsed request body
   * @param {string} userId
   * @param {object} req - Express request (for audit logging)
   * @returns {{ application, message }}
   */
  async createApplication(data, userId, req) {
    const {
      applicantType, iprType, projectType, filingType, title, description, remarks,
      schoolId, departmentId, sdgs, applicantDetails, contributors,
      annexureFilePath, supportingDocsFilePaths, sourceProvisionalId, prototypeFilePath,
    } = data;

    const { resolvedSchoolId, resolvedDepartmentId } = await this.resolveSchoolDepartment(userId, schoolId, departmentId);

    // Validate conversion from provisional
    let isConversionFromProvisional = false;
    if (filingType === 'complete' && sourceProvisionalId) {
      const sourceApp = await this.repo.findFirst({
        id: sourceProvisionalId,
        applicantUserId: userId,
        filingType: 'provisional',
        status: 'published',
      }, { include: { applicantDetails: true, sdgs: true } });

      if (!sourceApp) {
        const err = new Error('Invalid source provisional application. Only your own published provisional applications can be converted.');
        err.statusCode = 400;
        throw err;
      }
      isConversionFromProvisional = true;
    }

    const application = await this._createApplicationWithRetry({
      userId, applicantType, iprType, projectType, filingType, title, description, remarks,
      resolvedSchoolId, resolvedDepartmentId, sdgs, applicantDetails, contributors,
      annexureFilePath, supportingDocsFilePaths, sourceProvisionalId, prototypeFilePath,
      isConversionFromProvisional,
    });

    await this._applyIncentives(application, iprType, filingType, projectType);
    await this.repo.createStatusHistory({ iprApplicationId: application.id, toStatus: 'draft', changedById: userId, comments: 'IPR application created' });
    await this.createContributors(application.id, title, iprType, userId, contributors);

    const mentorUid = applicantDetails?.mentorUid;
    const { newStatus, statusComment } = await this.determineSubmissionStatus(userId, mentorUid);

    await this.repo.updateStatus(application.id, newStatus, { submittedAt: new Date() });
    await this.repo.createStatusHistory({ iprApplicationId: application.id, fromStatus: 'draft', toStatus: newStatus, changedById: userId, comments: statusComment });

    if (newStatus === 'pending_mentor_approval' && mentorUid) {
      await this.notifyMentor(mentorUid, iprType, title, application.applicationNumber, application.id, userId);
    }

    await this._logCreationAudit(application, userId, req, annexureFilePath, supportingDocsFilePaths, prototypeFilePath, newStatus, statusComment);

    application.status = newStatus;
    application.submittedAt = new Date();

    const message = newStatus === 'pending_mentor_approval'
      ? 'IPR application submitted successfully. Awaiting mentor approval.'
      : 'IPR application submitted successfully for DRD review.';

    return { application, message };
  }

  // ─── Private: Create with Retry ───────────────────────────────────────────

  async _createApplicationWithRetry(params) {
    const {
      userId, applicantType, iprType, projectType, filingType, title, description, remarks,
      resolvedSchoolId, resolvedDepartmentId, sdgs, applicantDetails, contributors,
      annexureFilePath, supportingDocsFilePaths, sourceProvisionalId, prototypeFilePath,
      isConversionFromProvisional,
    } = params;

    const include = {
      applicantDetails: true, sdgs: true,
      school: { select: { facultyName: true, facultyCode: true } },
      department: { select: { departmentName: true, departmentCode: true } },
    };

    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const applicationNumber = await this.generateApplicationNumber(iprType);
        return await this.repo.create({
          applicationNumber,
          applicantUser: { connect: { id: userId } },
          applicantType, iprType, projectType, filingType, title, description, remarks,
          ...(resolvedSchoolId && { school: { connect: { id: resolvedSchoolId } } }),
          ...(resolvedDepartmentId && { department: { connect: { id: resolvedDepartmentId } } }),
          status: 'draft',
          annexureFilePath: annexureFilePath || '',
          supportingDocsFilePaths: supportingDocsFilePaths || [],
          ...(filingType === 'complete' && prototypeFilePath && { prototypeFilePath }),
          ...(isConversionFromProvisional && sourceProvisionalId && {
            sourceProvisional: { connect: { id: sourceProvisionalId } },
            conversionDate: new Date(),
          }),
          applicantDetails: applicantDetails ? { create: this._buildApplicantDetailsData(applicantDetails, contributors) } : undefined,
          sdgs: sdgs ? { create: sdgs.map((sdg) => ({ sdgCode: typeof sdg === 'string' ? sdg : sdg.code, sdgTitle: typeof sdg === 'string' ? '' : (sdg.title || '') })) } : undefined,
        }, include);
      } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('application_number') && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate unique application number after multiple attempts');
  }

  _buildApplicantDetailsData(applicantDetails, contributors) {
    return {
      employeeCategory: applicantDetails.employeeCategory || null,
      employeeType: applicantDetails.employeeType || null,
      uid: applicantDetails.uid || null,
      email: applicantDetails.email || null,
      phone: applicantDetails.phone || null,
      universityDeptName: applicantDetails.universityDeptName || null,
      mentorName: applicantDetails.mentorName || null,
      mentorUid: applicantDetails.mentorUid || null,
      isInventor: applicantDetails.isInventor || false,
      inventorName: applicantDetails.inventorName || null,
      inventorUid: applicantDetails.inventorUid || null,
      inventorEmail: applicantDetails.inventorEmail || null,
      inventorPhone: applicantDetails.inventorPhone || null,
      externalName: applicantDetails.externalName || null,
      externalOption: applicantDetails.externalOption || null,
      instituteType: applicantDetails.instituteType || null,
      companyUniversityName: applicantDetails.companyUniversityName || null,
      externalEmail: applicantDetails.externalEmail || null,
      externalPhone: applicantDetails.externalPhone || null,
      externalAddress: applicantDetails.externalAddress || null,
      metadata: { contributors: contributors || [], ...applicantDetails.metadata },
    };
  }

  async _applyIncentives(application, iprType, filingType, projectType) {
    const { incentiveAmount, pointsAwarded } = await this.calculateIprIncentives(iprType, filingType, projectType);
    if (incentiveAmount > 0 || pointsAwarded > 0) {
      const include = {
        applicantDetails: true, sdgs: true,
        school: { select: { facultyName: true, facultyCode: true } },
        department: { select: { departmentName: true, departmentCode: true } },
      };
      const updated = await this.repo.update(application.id, { incentiveAmount, pointsAwarded }, include);
      Object.assign(application, updated);
    }
  }

  async _logCreationAudit(application, userId, req, annexureFilePath, supportingDocsFilePaths, prototypeFilePath, newStatus, statusComment) {
    await logIprFiling(application, userId, req);

    if (annexureFilePath) {
      await logFileUpload(annexureFilePath.split('/').pop(), 0, annexureFilePath, userId, req, 'IPR', `IPR Application ${application.applicationNumber}`);
    }
    if (supportingDocsFilePaths?.length > 0) {
      for (const docPath of supportingDocsFilePaths) {
        await logFileUpload(docPath.split('/').pop(), 0, docPath, userId, req, 'IPR', `IPR Application ${application.applicationNumber}`);
      }
    }
    if (prototypeFilePath) {
      await logFileUpload(prototypeFilePath.split('/').pop(), 0, prototypeFilePath, userId, req, 'IPR', `IPR Application ${application.applicationNumber}`);
    }

    await logIprStatusChange(application, 'draft', newStatus, userId, req, statusComment);
  }

  // ─── Submit Application ────────────────────────────────────────────────────

  /**
   * Submit a draft IPR application (explicit submit action).
   * @param {string} id
   * @param {string} userId
   * @param {object} req
   * @returns {{ updated, message }}
   */
  async submitApplication(id, userId, req) {
    const include = {
      applicantDetails: true,
      applicantUser: {
        select: {
          id: true, uid: true, role: true,
          studentLogin: { select: { firstName: true, lastName: true } },
          employeeDetails: { select: { firstName: true, lastName: true } },
        },
      },
    };

    const application = await this.repo.findFirst({ id, applicantUserId: userId, status: 'draft' }, { include });
    if (!application) {
      const err = new Error('IPR application not found or already submitted');
      err.statusCode = 404;
      throw err;
    }

    const isStudent = application.applicantUser?.role === 'student';
    const hasMentor = application.applicantDetails?.mentorUid?.trim() !== '';
    const newStatus = isStudent && hasMentor ? 'pending_mentor_approval' : 'submitted';
    const statusComment = isStudent && hasMentor ? 'Application submitted, awaiting mentor approval' : 'Application submitted for DRD review';

    const updateInclude = { applicantDetails: true, sdgs: true, school: true, department: true };
    const updated = await this.repo.update(id, { status: newStatus, filingType: 'complete', submittedAt: new Date() }, updateInclude);
    await this.repo.createStatusHistory({ iprApplicationId: id, fromStatus: 'draft', toStatus: newStatus, changedById: userId, comments: statusComment });

    const applicantName = this._resolveApplicantName(application.applicantUser);
    const iprTypeLabel = { patent: 'Patent', copyright: 'Copyright', trademark: 'Trademark', design: 'Design' }[application.iprType] || application.iprType;

    if (newStatus === 'pending_mentor_approval' && hasMentor) {
      await this.notifyMentor(application.applicantDetails.mentorUid, application.iprType, application.title, application.applicationNumber, id, userId, applicantName);
    }

    await this._notifyContributors(application, applicantName, iprTypeLabel, id, userId);
    await logIprUpdate(application, updated, userId, req, 'Submitted IPR application');
    await logIprStatusChange(updated, 'draft', newStatus, userId, req, statusComment);

    const message = newStatus === 'pending_mentor_approval' ? 'IPR application submitted. Awaiting mentor approval.' : 'IPR application submitted successfully';
    return { updated, message };
  }

  _resolveApplicantName(applicantUser) {
    if (applicantUser?.studentLogin) {
      return `${applicantUser.studentLogin.firstName} ${applicantUser.studentLogin.lastName || ''}`.trim();
    }
    if (applicantUser?.employeeDetails) {
      return `${applicantUser.employeeDetails.firstName} ${applicantUser.employeeDetails.lastName || ''}`.trim();
    }
    return 'An applicant';
  }

  async _notifyContributors(application, applicantName, iprTypeLabel, iprApplicationId, applicantUserId) {
    const contributors = application.applicantDetails?.metadata?.contributors || [];
    for (const contributor of contributors) {
      if (!contributor.uid) continue;
      const contributorUser = await this.repo.findUserByUid(contributor.uid);
      if (!contributorUser || contributorUser.id === applicantUserId) continue;
      await this.repo.createNotification({
        userId: contributorUser.id,
        type: 'ipr_contributor',
        title: `You've been added as an inventor/contributor`,
        message: `${applicantName} has submitted a ${iprTypeLabel} application titled "${application.title}" and listed you as an inventor/contributor. Application ID: ${application.applicationNumber}`,
        referenceType: 'ipr_application',
        referenceId: iprApplicationId,
        metadata: { iprType: application.iprType, applicantUserId, applicantName, contributorRole: contributor.employeeType || 'contributor' },
      });
    }
  }

  // ─── Get All Applications ──────────────────────────────────────────────────

  /**
   * Get all IPR applications with pagination and filters.
   * @param {object} query - { status, iprType, schoolId, departmentId, applicantUserId, page, limit }
   * @returns {{ applications, total, page, limit }}
   */
  async getAllApplications(query) {
    const { status, iprType, schoolId, departmentId, applicantUserId, page = 1, limit = 10 } = query;

    const where = {};
    if (status) where.status = status;
    if (iprType) where.iprType = iprType;
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (applicantUserId) where.applicantUserId = applicantUserId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const include = {
      applicantUser: { select: { uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } },
      applicantDetails: true, sdgs: true,
      school: { select: { facultyName: true, facultyCode: true } },
      department: { select: { departmentName: true, departmentCode: true } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
    };

    const [applications, total] = await Promise.all([
      this.repo.findAll({ where, include, skip, take }),
      this.repo.count(where),
    ]);

    return { applications, total, page: parseInt(page), limit: parseInt(limit) };
  }

  // ─── Get Application By ID ─────────────────────────────────────────────────

  /**
   * Get a single IPR application by ID (admin/DRD view).
   * @param {string} id
   * @returns {object}
   */
  async getApplicationById(id) {
    const include = {
      applicantUser: {
        select: {
          uid: true, email: true, role: true,
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true, empId: true, phoneNumber: true, designation: true, primaryDepartment: { select: { departmentName: true } } } },
          studentLogin: { select: { firstName: true, lastName: true, displayName: true, registrationNo: true, phone: true, program: { select: { programName: true } } } },
        },
      },
      applicantDetails: true, sdgs: true,
      school: { select: { facultyName: true, facultyCode: true, shortName: true } },
      department: { select: { departmentName: true, departmentCode: true, shortName: true } },
      reviews: { include: { reviewer: { select: { uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } } }, orderBy: { createdAt: 'desc' } },
      statusHistory: { include: { changedBy: { select: { uid: true, employeeDetails: { select: { displayName: true } } } } }, orderBy: { changedAt: 'desc' } },
      contributors: { select: { id: true, uid: true, userId: true, name: true, email: true, phone: true, department: true, employeeCategory: true, employeeType: true, role: true } },
      financeRecords: { include: { financeReviewer: { select: { uid: true, employeeDetails: { select: { displayName: true } } } } } },
    };

    const application = await this.repo.findById(id, include);
    if (!application) {
      const err = new Error('IPR application not found');
      err.statusCode = 404;
      throw err;
    }
    return application;
  }

  // ─── Update Application ────────────────────────────────────────────────────

  /**
   * Update an IPR application (allowed in draft/changes_required/pending_mentor_approval/resubmitted).
   * @param {string} id
   * @param {string} userId
   * @param {object} data
   * @param {object} req
   * @returns {{ updated, finalStatus, message }}
   */
  async updateApplication(id, userId, data, req) {
    const { iprType, projectType, filingType, title, description, remarks, schoolId, departmentId, sdgs, applicantDetails, annexureFilePath, supportingDocsFilePaths } = data;

    const existing = await this.repo.findFirst({ id, applicantUserId: userId, status: { in: ['draft', 'changes_required', 'pending_mentor_approval', 'resubmitted'] } });
    if (!existing) {
      const err = new Error('IPR application not found or cannot be edited. Only draft and changes required applications can be edited.');
      err.statusCode = 404;
      throw err;
    }

    const updateInclude = { applicantDetails: true, sdgs: true, school: true, department: true };
    const updated = await this.repo.update(id, {
      iprType, projectType, filingType, title, description, remarks, schoolId, departmentId,
      ...(annexureFilePath && { annexureFilePath }),
      ...(supportingDocsFilePaths && { supportingDocsFilePaths }),
    }, updateInclude);

    if (applicantDetails) await this.repo.upsertApplicantDetails(id, applicantDetails);

    if (sdgs && Array.isArray(sdgs)) {
      await this.repo.deleteSdgs(id);
      const sdgData = this.parseSdgs(id, sdgs);
      if (sdgData.length > 0) await this.repo.createManySdgs(sdgData);
    }

    let finalStatus = existing.status;
    let message = 'IPR application updated successfully';

    if (filingType === 'complete' && existing.status === 'draft') {
      const result = await this._autoSubmitOnCompleteFilingType(id, userId, updated, req);
      finalStatus = result.newStatus;
      message = result.message;
    }

    await logIprUpdate(existing, { ...updated, status: finalStatus }, userId, req, 'Updated IPR application');
    return { updated, finalStatus, message };
  }

  async _autoSubmitOnCompleteFilingType(id, userId, updated, req) {
    const appDetails = await this.repo.findApplicantDetails(id, { mentorUid: true });
    const { newStatus, statusComment } = await this.determineSubmissionStatus(userId, appDetails?.mentorUid);

    await this.repo.updateStatus(id, newStatus, { submittedAt: new Date() });
    await this.repo.createStatusHistory({ iprApplicationId: id, fromStatus: 'draft', toStatus: newStatus, changedById: userId, comments: statusComment });

    if (newStatus === 'pending_mentor_approval' && appDetails?.mentorUid) {
      const mentorUser = await this.repo.findUserByUid(appDetails.mentorUid);
      if (mentorUser) {
        await this.repo.createNotification({
          userId: mentorUser.id, type: 'ipr_mentor_approval', title: 'IPR Application Needs Your Approval',
          message: `Your student has submitted a ${updated.iprType} application titled "${updated.title}" and requires your approval.`,
          referenceType: 'ipr_application', referenceId: id,
          metadata: { iprType: updated.iprType, applicationNumber: updated.applicationNumber, action: 'mentor_approval_required' },
        });
      }
    }

    await logIprStatusChange(updated, 'draft', newStatus, userId, req, statusComment);

    const message = newStatus === 'pending_mentor_approval'
      ? 'IPR application submitted successfully. Awaiting mentor approval.'
      : 'IPR application submitted successfully for DRD review.';

    return { newStatus, message };
  }

  // ─── Delete Application ────────────────────────────────────────────────────

  /**
   * Delete a draft IPR application.
   * @param {string} id
   * @param {string} userId
   */
  async deleteApplication(id, userId) {
    const existing = await this.repo.findFirst({ id, applicantUserId: userId, status: 'draft' });
    if (!existing) {
      const err = new Error('IPR application not found or cannot be deleted');
      err.statusCode = 404;
      throw err;
    }
    await this.repo.delete(id);
  }

  // ─── My Applications ───────────────────────────────────────────────────────

  /**
   * Get all applications for the authenticated applicant, grouped by status.
   * @param {string} userId
   * @param {object} query - { status, iprType }
   * @returns {{ applications, grouped, stats }}
   */
  async getMyApplications(userId, query) {
    const { status, iprType } = query;
    const pagination = parsePaginationQuery(query);
    const filters = {};
    if (status) filters.status = status;
    if (iprType) filters.iprType = iprType;

    const [applications, groupedCounts, total] = await Promise.all([
      this.repo.findByApplicant(userId, filters, {
        include: IPR_LIST_INCLUDE,
        ...(pagination.usePagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      }),
      this.repo.groupBy({
        by: ['status'],
        where: { applicantUserId: userId, ...filters },
        _count: { id: true },
      }),
      pagination.usePagination ? this.repo.count({ applicantUserId: userId, ...filters }) : Promise.resolve(null),
    ]);

    const withMentorFlag = applications.map(app => {
      const latestHistory = app.statusHistory?.[0];
      const changesRequestedByMentor = app.status === 'changes_required' && latestHistory?.fromStatus === 'pending_mentor_approval';
      return { ...app, changesRequestedByMentor };
    });

    const grouped = {
      draft: withMentorFlag.filter(a => a.status === 'draft'),
      submitted: withMentorFlag.filter(a => a.status === 'submitted'),
      under_review: withMentorFlag.filter(a => ['under_drd_review', 'recommended_to_head', 'under_finance_review'].includes(a.status)),
      changes_required: withMentorFlag.filter(a => a.status === 'changes_required'),
      approved: withMentorFlag.filter(a => ['drd_head_approved', 'finance_approved', 'completed', 'submitted_to_govt', 'govt_application_filed', 'published'].includes(a.status)),
      rejected: withMentorFlag.filter(a => ['drd_rejected', 'finance_rejected', 'cancelled'].includes(a.status)),
    };

    const countByStatus = groupedCounts.reduce((acc, row) => {
      acc[row.status] = row._count.id;
      return acc;
    }, {});

    const stats = {
      total: pagination.usePagination ? total : withMentorFlag.length,
      draft: countByStatus.draft || 0,
      submitted: countByStatus.submitted || 0,
      under_review:
        (countByStatus.under_drd_review || 0) +
        (countByStatus.recommended_to_head || 0) +
        (countByStatus.under_finance_review || 0),
      changes_required: countByStatus.changes_required || 0,
      approved:
        (countByStatus.drd_head_approved || 0) +
        (countByStatus.finance_approved || 0) +
        (countByStatus.completed || 0) +
        (countByStatus.submitted_to_govt || 0) +
        (countByStatus.govt_application_filed || 0) +
        (countByStatus.published || 0),
      rejected:
        (countByStatus.drd_rejected || 0) +
        (countByStatus.finance_rejected || 0) +
        (countByStatus.cancelled || 0),
    };

    return {
      applications: withMentorFlag,
      grouped,
      stats,
      ...(pagination.usePagination ? {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      } : {}),
    };
  }

  // ─── My Published Provisionals ─────────────────────────────────────────────

  /**
   * Get published provisional applications that can be converted to complete filing.
   * @param {string} userId
   * @returns {{ available, alreadyConverted, total }}
   */
  async getMyPublishedProvisionals(userId) {
    const select = {
      id: true, applicationNumber: true, title: true, description: true, iprType: true, createdAt: true, completedAt: true,
      applicantDetails: { select: { mentorName: true, mentorUid: true, isInventor: true, inventorName: true, inventorUid: true, inventorEmail: true, inventorPhone: true } },
      sdgs: { select: { sdgCode: true, sdgTitle: true } },
      school: { select: { id: true, facultyName: true } },
      department: { select: { id: true, departmentName: true } },
      conversions: { select: { id: true, applicationNumber: true, status: true } },
    };

    const provisionals = await this.repo.findAll({
      where: { applicantUserId: userId, filingType: 'provisional', status: 'published' },
      include: select,
      orderBy: { completedAt: 'desc' },
    });

    const available = provisionals.filter(a => !a.conversions || a.conversions.length === 0);
    const alreadyConverted = provisionals.filter(a => a.conversions && a.conversions.length > 0);

    return { available, alreadyConverted, total: provisionals.length };
  }

  // ─── My Application By ID ──────────────────────────────────────────────────

  /**
   * Get a single application for the authenticated applicant.
   * @param {string} id
   * @param {string} userId
   * @returns {object}
   */
  async getMyApplicationById(id, userId) {
    const include = {
      applicantUser: {
        select: {
          uid: true, email: true, role: true,
          studentLogin: { select: { firstName: true, lastName: true, displayName: true, studentId: true } },
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true, empId: true } },
        },
      },
      applicantDetails: true, sdgs: true,
      school: { select: { facultyName: true, facultyCode: true, shortName: true } },
      department: { select: { departmentName: true, departmentCode: true, shortName: true } },
      reviews: { include: { reviewer: { select: { uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } } }, orderBy: { createdAt: 'desc' } },
      statusHistory: {
        include: { changedBy: { select: { uid: true, employeeDetails: { select: { displayName: true } }, studentLogin: { select: { displayName: true } } } } },
        orderBy: { changedAt: 'desc' },
      },
      contributors: { select: { id: true, uid: true, name: true, email: true, phone: true, department: true, employeeCategory: true, employeeType: true, role: true } },
      financeRecords: { include: { financeReviewer: { select: { uid: true, employeeDetails: { select: { displayName: true } } } } } },
    };

    const application = await this.repo.findFirst({ id, applicantUserId: userId }, { include });
    if (!application) {
      const err = new Error('IPR application not found or you do not have permission to view it');
      err.statusCode = 404;
      throw err;
    }

    let changesRequestedByMentor = false;
    let changesRequestedBy = null;

    if (application.status === 'changes_required' && application.statusHistory?.length > 0) {
      const entry = application.statusHistory.find(h => h.toStatus === 'changes_required');
      if (entry) {
        changesRequestedByMentor = entry.fromStatus === 'pending_mentor_approval';
        const changedByUser = entry.changedBy;
        changesRequestedBy = {
          isMentor: changesRequestedByMentor,
          name: changedByUser?.employeeDetails?.displayName || changedByUser?.studentLogin?.displayName || changedByUser?.uid || 'Reviewer',
          comments: entry.comments,
        };
      }
    }

    return { ...application, changesRequestedByMentor, changesRequestedBy };
  }

  // ─── Statistics ────────────────────────────────────────────────────────────

  /**
   * Get IPR statistics for the dashboard.
   * @param {object} query - { schoolId, departmentId, userId }
   * @returns {object}
   */
  async getStatistics(query) {
    const { schoolId, departmentId, userId } = query;
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (userId) where.applicantUserId = userId;

    const [total, submitted, underReview, approved, rejected, completed, byType, byStatus] = await Promise.all([
      this.repo.count(where),
      this.repo.count({ ...where, status: 'submitted' }),
      this.repo.count({ ...where, status: { in: ['under_drd_review', 'recommended_to_head', 'under_finance_review'] } }),
      this.repo.count({ ...where, status: { in: ['drd_head_approved', 'finance_approved', 'submitted_to_govt', 'govt_application_filed', 'published'] } }),
      this.repo.count({ ...where, status: { in: ['drd_rejected', 'finance_rejected', 'cancelled'] } }),
      this.repo.count({ ...where, status: 'completed' }),
      this.repo.groupBy({ by: ['iprType'], where, _count: true }),
      this.repo.groupBy({ by: ['status'], where, _count: true }),
    ]);

    let myApplications = 0;
    if (userId) myApplications = await this.repo.count({ applicantUserId: userId });

    return { total, pending: submitted, underReview, approved, rejected, completed, myApplications, submitted, byType, byStatus };
  }

  // ─── Resubmit Application ──────────────────────────────────────────────────

  /**
   * Resubmit an application after changes_required.
   * @param {string} id
   * @param {string} userId
   * @returns {{ updatedApplication, message }}
   */
  async resubmitApplication(id, userId) {
    const include = {
      applicantUser: { include: { employeeDetails: true, studentLogin: true } },
      applicantDetails: true, sdgs: true, school: true, department: true,
      reviews: { include: { reviewer: { include: { employeeDetails: true } } }, orderBy: { createdAt: 'desc' } },
      statusHistory: { include: { changedBy: { include: { employeeDetails: true } } }, orderBy: { changedAt: 'desc' } },
    };

    const application = await this.repo.findById(id, { applicantUser: true, applicantDetails: true, statusHistory: { orderBy: { changedAt: 'desc' }, take: 5 } });
    if (!application) {
      const err = new Error('IPR application not found'); err.statusCode = 404; throw err;
    }
    if (application.applicantUserId !== userId) {
      const err = new Error('Not authorized to resubmit this application'); err.statusCode = 403; throw err;
    }
    if (application.status !== 'changes_required') {
      const err = new Error('Application cannot be resubmitted in its current status'); err.statusCode = 400; throw err;
    }

    const lastChange = application.statusHistory?.find(h => h.toStatus === 'changes_required');
    const isMentorResubmission = lastChange?.fromStatus === 'pending_mentor_approval';
    const newStatus = isMentorResubmission ? 'pending_mentor_approval' : 'resubmitted';

    const updatedApplication = await this.repo.update(id, {
      status: newStatus, submittedAt: new Date(),
      ...(isMentorResubmission ? {} : { revisionCount: { increment: 1 } }),
    }, include);

    await this.repo.createStatusHistory({
      iprApplicationId: id, fromStatus: 'changes_required', toStatus: newStatus, changedById: userId,
      comments: isMentorResubmission ? 'Application resubmitted to mentor for approval after changes' : 'Application resubmitted to DRD after making requested changes',
    });

    if (isMentorResubmission && application.applicantDetails?.mentorUid) {
      const mentorUser = await this.repo.findUserByUid(application.applicantDetails.mentorUid);
      if (mentorUser) {
        await this.repo.createNotification({
          userId: mentorUser.id, type: 'ipr_mentor_resubmission', title: 'IPR Application Resubmitted for Review',
          message: `A student has resubmitted their IPR application "${application.title}" after making changes. Please review again.`,
          referenceType: 'ipr_application', referenceId: id,
          metadata: { iprType: application.iprType, applicationNumber: application.applicationNumber },
        });
      }
    }

    const message = isMentorResubmission ? 'Application resubmitted to mentor for approval' : 'Application resubmitted to DRD successfully';
    return { updatedApplication, message };
  }

  // ─── Contributed Applications ──────────────────────────────────────────────

  /**
   * Get all applications where the user is a contributor (not the applicant).
   * @param {string} userId
   * @param {string} userUid
   * @returns {object[]}
   */
  async getContributedApplications(userId, userUid) {
    const contributions = await this.repo.findContributors(
      { OR: [{ userId }, { uid: userUid }], iprApplication: { NOT: { applicantUserId: userId } } },
      IPR_CONTRIBUTED_INCLUDE
    );

    return contributions.map(c => ({
      ...c.iprApplication,
      contributorRole: c.role,
      contributorCanView: c.canView,
      contributorCanEdit: c.canEdit,
      isContributor: true,
      isApplicant: false,
    }));
  }

  /**
   * Get a single contributed application by ID (view-only).
   * @param {string} id
   * @param {string} userId
   * @param {string} userUid
   * @returns {object}
   */
  async getContributedApplicationById(id, userId, userUid) {
    const contribution = await this.repo.findFirstContributor({ iprApplicationId: id, OR: [{ userId }, { uid: userUid }] });
    if (!contribution) {
      const err = new Error('You do not have access to view this application'); err.statusCode = 403; throw err;
    }

    const include = {
      applicantUser: { select: { uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, designation: true } } } },
      applicantDetails: true, contributors: true, sdgs: true,
      school: { select: { facultyName: true, facultyCode: true } },
      department: { select: { departmentName: true, departmentCode: true } },
      statusHistory: { orderBy: { changedAt: 'desc' }, include: { changedBy: { select: { uid: true, employeeDetails: { select: { firstName: true, lastName: true } } } } } },
      reviews: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { uid: true, employeeDetails: { select: { firstName: true, lastName: true } } } } } },
      editSuggestions: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { uid: true, employeeDetails: { select: { firstName: true, lastName: true } } } } } },
    };

    const application = await this.repo.findById(id, include);
    if (!application) {
      const err = new Error('IPR application not found'); err.statusCode = 404; throw err;
    }

    return { ...application, contributorRole: contribution.role, contributorCanView: contribution.canView, contributorCanEdit: contribution.canEdit, isContributor: true, isApplicant: false };
  }

  // ─── Mentor Workflow ───────────────────────────────────────────────────────

  /**
   * Get all applications pending mentor approval for the authenticated mentor.
   * @param {string} userUid
   * @returns {object[]}
   */
  async getPendingMentorApprovals(userUid) {
    const include = {
      applicantUser: { select: { uid: true, studentLogin: { select: { firstName: true, lastName: true, studentId: true, program: { select: { programName: true, programCode: true } } } } } },
      applicantDetails: true,
      school: { select: { facultyName: true, facultyCode: true } },
      department: { select: { departmentName: true, departmentCode: true } },
      sdgs: true,
    };

    const applications = await this.repo.findAll({
      where: { status: 'pending_mentor_approval', applicantDetails: { mentorUid: userUid } },
      include,
      orderBy: { submittedAt: 'desc' },
    });

    return applications.map(app => ({
      ...app,
      applicantUser: app.applicantUser ? { ...app.applicantUser, studentDetails: app.applicantUser.studentLogin } : null,
    }));
  }

  /**
   * Get all applications where the user is the mentor (full history).
   * @param {string} userUid
   * @returns {object}
   */
  async getMentorReviewHistory(userUid) {
    const include = {
      applicantUser: { select: { uid: true, studentLogin: { select: { firstName: true, lastName: true, studentId: true, program: { select: { programName: true, programCode: true } } } } } },
      applicantDetails: true,
      school: { select: { facultyName: true, facultyCode: true } },
      department: { select: { departmentName: true, departmentCode: true } },
      sdgs: true,
      statusHistory: {
        where: { OR: [{ toStatus: 'submitted' }, { toStatus: 'changes_required' }, { fromStatus: 'pending_mentor_approval' }] },
        include: { changedBy: { select: { uid: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } } },
        orderBy: { changedAt: 'desc' },
      },
    };

    const applications = await this.repo.findAll({ where: { applicantDetails: { mentorUid: userUid } }, include, orderBy: { updatedAt: 'desc' } });

    const pending = applications.filter(a => a.status === 'pending_mentor_approval');
    const changesRequired = applications.filter(a => a.status === 'changes_required');
    const approved = applications.filter(a => ['submitted', 'under_drd_review', 'recommended_to_head', 'drd_head_approved', 'published', 'completed'].includes(a.status));
    const rejected = applications.filter(a => a.status === 'rejected' || a.status === 'draft');

    return {
      data: { all: applications, pending, changesRequired, approved, rejected },
      stats: { total: applications.length, pending: pending.length, changesRequired: changesRequired.length, approved: approved.length, rejected: rejected.length },
    };
  }

  /**
   * Get a single application by ID for mentor review.
   * @param {string} id
   * @param {string} userUid
   * @returns {object}
   */
  async getMentorApplicationById(id, userUid) {
    const include = {
      applicantUser: {
        select: {
          uid: true, email: true, role: true,
          studentLogin: { select: { firstName: true, lastName: true, displayName: true, studentId: true } },
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true, empId: true } },
        },
      },
      applicantDetails: true, sdgs: true,
      school: { select: { facultyName: true, facultyCode: true, shortName: true } },
      department: { select: { departmentName: true, departmentCode: true, shortName: true } },
      reviews: { include: { reviewer: { select: { uid: true, email: true, employeeDetails: { select: { firstName: true, lastName: true, displayName: true } } } } }, orderBy: { createdAt: 'desc' } },
      statusHistory: { include: { changedBy: { select: { uid: true, employeeDetails: { select: { displayName: true } }, studentLogin: { select: { displayName: true } } } } }, orderBy: { changedAt: 'desc' } },
      contributors: { select: { id: true, uid: true, name: true, email: true, phone: true, department: true, employeeCategory: true, employeeType: true, role: true } },
    };

    const application = await this.repo.findFirst({ id, applicantDetails: { mentorUid: userUid } }, { include });
    if (!application) {
      const err = new Error('IPR application not found or you are not the mentor for this application'); err.statusCode = 404; throw err;
    }
    return application;
  }

  /**
   * Mentor approves an IPR application (moves to submitted).
   * @param {string} id
   * @param {string} userId
   * @param {string} userUid
   * @param {string} [comments]
   * @param {object} req
   * @returns {{ updated }}
   */
  async approveMentorApplication(id, userId, userUid, comments, req) {
    const application = await this.repo.findFirst(
      { id, status: 'pending_mentor_approval' },
      { include: { applicantDetails: true, applicantUser: { select: { id: true, uid: true, studentLogin: { select: { firstName: true, lastName: true } } } } } }
    );

    if (!application) {
      const err = new Error('IPR application not found or not pending mentor approval'); err.statusCode = 404; throw err;
    }
    if (application.applicantDetails?.mentorUid !== userUid) {
      const err = new Error('You are not the mentor for this application'); err.statusCode = 403; throw err;
    }

    const updateInclude = { applicantDetails: true, sdgs: true, school: true, department: true };
    const updated = await this.repo.updateStatus(id, 'submitted', {}, updateInclude);
    await this.repo.createStatusHistory({ iprApplicationId: id, fromStatus: 'pending_mentor_approval', toStatus: 'submitted', changedById: userId, comments: comments || 'Mentor approved the application' });

    await this.repo.createNotification({
      userId: application.applicantUserId, type: 'ipr_mentor_approved',
      title: 'Your IPR Application Has Been Approved by Mentor',
      message: `Your mentor has approved your IPR application "${application.title}". It has now been submitted to DRD for review.`,
      referenceType: 'ipr_application', referenceId: id,
      metadata: { iprType: application.iprType, applicationNumber: application.applicationNumber, mentorUid: userUid },
    });

    await logIprStatusChange(updated, 'pending_mentor_approval', 'submitted', userId, req, comments || 'Mentor approved the application');
    return { updated };
  }

  /**
   * Mentor rejects an IPR application (sends back to student for changes).
   * @param {string} id
   * @param {string} userId
   * @param {string} userUid
   * @param {string} comments
   * @param {object} req
   * @returns {{ updated }}
   */
  async rejectMentorApplication(id, userId, userUid, comments, req) {
    if (!comments) {
      const err = new Error('Comments are required when rejecting an application'); err.statusCode = 400; throw err;
    }

    const application = await this.repo.findFirst(
      { id, status: 'pending_mentor_approval' },
      { include: { applicantDetails: true, applicantUser: { select: { id: true, uid: true } } } }
    );

    if (!application) {
      const err = new Error('IPR application not found or not pending mentor approval'); err.statusCode = 404; throw err;
    }
    if (application.applicantDetails?.mentorUid !== userUid) {
      const err = new Error('You are not the mentor for this application'); err.statusCode = 403; throw err;
    }

    const updateInclude = { applicantDetails: true, sdgs: true, school: true, department: true };
    const updated = await this.repo.updateStatus(id, 'changes_required', {}, updateInclude);
    await this.repo.createStatusHistory({ iprApplicationId: id, fromStatus: 'pending_mentor_approval', toStatus: 'changes_required', changedById: userId, comments: `Mentor requested changes: ${comments}` });

    await this.repo.createNotification({
      userId: application.applicantUserId, type: 'ipr_mentor_rejected',
      title: 'Your IPR Application Needs Revision',
      message: `Your mentor has requested changes to your IPR application "${application.title}". Please review the feedback and resubmit.`,
      referenceType: 'ipr_application', referenceId: id,
      metadata: { iprType: application.iprType, applicationNumber: application.applicationNumber, mentorUid: userUid, mentorComments: comments },
    });

    await logIprStatusChange(updated, 'pending_mentor_approval', 'changes_required', userId, req, `Mentor requested changes: ${comments}`);
    return { updated };
  }
}

module.exports = IprService;
