/**
 * IPR Repository
 * Centralizes all prisma.iprApplication.* and related IPR model calls.
 * Accepts a prisma client via constructor for testability.
 */

class IprRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // ─── iprApplication ────────────────────────────────────────────────────────

  /**
   * Create a new IPR application
   * @param {object} data - Prisma create data
   * @param {object} [include]
   */
  async create(data, include = {}) {
    return this.prisma.iprApplication.create({
      data,
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Find an IPR application by its ID
   * @param {string} id
   * @param {object} [include]
   */
  async findById(id, include = {}) {
    return this.prisma.iprApplication.findUnique({
      where: { id },
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Find the first IPR application matching a where clause
   * @param {object} where
   * @param {object} [options] - include, select, orderBy, etc.
   */
  async findFirst(where, options = {}) {
    return this.prisma.iprApplication.findFirst({ where, ...options });
  }

  /**
   * Find all IPR applications matching filters
   * @param {object} filters - { where, include, orderBy, skip, take }
   */
  async findAll(filters = {}) {
    const {
      where = {},
      include = {},
      orderBy = { createdAt: 'desc' },
      skip,
      take,
    } = filters;
    return this.prisma.iprApplication.findMany({
      where,
      ...(Object.keys(include).length > 0 && { include }),
      orderBy,
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
    });
  }

  /**
   * Count IPR applications matching a where clause
   * @param {object} where
   */
  async count(where = {}) {
    return this.prisma.iprApplication.count({ where });
  }

  /**
   * Group IPR applications by a field
   * @param {object} options - { by, where, _count }
   */
  async groupBy(options) {
    return this.prisma.iprApplication.groupBy(options);
  }

  /**
   * Update an IPR application by ID
   * @param {string} id
   * @param {object} data
   * @param {object} [include]
   */
  async update(id, data, include = {}) {
    return this.prisma.iprApplication.update({
      where: { id },
      data,
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Delete an IPR application by ID (cascades to related records)
   * @param {string} id
   */
  async delete(id) {
    return this.prisma.iprApplication.delete({ where: { id } });
  }

  /**
   * Find all applications with a given status
   * @param {string|string[]} status
   * @param {object} [options] - include, orderBy, etc.
   */
  async findByStatus(status, options = {}) {
    const where = Array.isArray(status)
      ? { status: { in: status } }
      : { status };
    return this.prisma.iprApplication.findMany({ where, ...options });
  }

  /**
   * Find all applications submitted by a given user
   * @param {string} userId
   * @param {object} [filters] - additional where clauses (status, iprType, etc.)
   * @param {object} [options] - include, orderBy, etc.
   */
  async findByApplicant(userId, filters = {}, options = {}) {
    return this.prisma.iprApplication.findMany({
      where: { applicantUserId: userId, ...filters },
      orderBy: { createdAt: 'desc' },
      ...options,
    });
  }

  /**
   * Update only the status (and optional extra fields) of an application
   * @param {string} id
   * @param {string} status
   * @param {object} [extra] - additional fields to update alongside status
   * @param {object} [include]
   */
  async updateStatus(id, status, extra = {}, include = {}) {
    return this.prisma.iprApplication.update({
      where: { id },
      data: { status, ...extra },
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  // ─── iprStatusHistory ──────────────────────────────────────────────────────

  /**
   * Create a status history entry
   * @param {object} data
   */
  async createStatusHistory(data) {
    return this.prisma.iprStatusHistory.create({ data });
  }

  // ─── iprContributor ────────────────────────────────────────────────────────

  /**
   * Create a contributor record
   * @param {object} data
   */
  async createContributor(data) {
    return this.prisma.iprContributor.create({ data });
  }

  /**
   * Find contributors matching a where clause
   * @param {object} where
   * @param {object} [options] - include, select, etc.
   */
  async findContributors(where, options = {}) {
    return this.prisma.iprContributor.findMany({ where, ...options });
  }

  /**
   * Find the first contributor matching a where clause
   * @param {object} where
   * @param {object} [options]
   */
  async findFirstContributor(where, options = {}) {
    return this.prisma.iprContributor.findFirst({ where, ...options });
  }

  // ─── iprApplicantDetails ───────────────────────────────────────────────────

  /**
   * Upsert applicant details for an application
   * @param {string} iprApplicationId
   * @param {object} data
   */
  async upsertApplicantDetails(iprApplicationId, data) {
    return this.prisma.iprApplicantDetails.upsert({
      where: { iprApplicationId },
      update: data,
      create: { iprApplicationId, ...data },
    });
  }

  /**
   * Find applicant details for an application
   * @param {string} iprApplicationId
   * @param {object} [select]
   */
  async findApplicantDetails(iprApplicationId, select = {}) {
    return this.prisma.iprApplicantDetails.findUnique({
      where: { iprApplicationId },
      ...(Object.keys(select).length > 0 && { select }),
    });
  }

  // ─── iprSdg ────────────────────────────────────────────────────────────────

  /**
   * Delete all SDGs for an application
   * @param {string} iprApplicationId
   */
  async deleteSdgs(iprApplicationId) {
    return this.prisma.iprSdg.deleteMany({ where: { iprApplicationId } });
  }

  /**
   * Create many SDG records
   * @param {object[]} data
   */
  async createManySdgs(data) {
    return this.prisma.iprSdg.createMany({ data });
  }

  // ─── incentivePolicy ───────────────────────────────────────────────────────

  /**
   * Find the active incentive policy for a given IPR type
   * @param {string} iprType
   */
  async findActivePolicy(iprType) {
    return this.prisma.incentivePolicy.findFirst({
      where: {
        iprType,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ─── userLogin ─────────────────────────────────────────────────────────────

  /**
   * Find a user by their primary key
   * @param {string} id
   * @param {object} [select]
   */
  async findUserById(id, select = {}) {
    return this.prisma.userLogin.findUnique({
      where: { id },
      ...(Object.keys(select).length > 0 && { select }),
    });
  }

  /**
   * Find a user by their UID
   * @param {string} uid
   * @param {object} [select]
   */
  async findUserByUid(uid, select = {}) {
    return this.prisma.userLogin.findFirst({
      where: { uid },
      ...(Object.keys(select).length > 0 && { select }),
    });
  }

  // ─── employeeDetails / studentDetails ─────────────────────────────────────

  /**
   * Find employee details for a user
   * @param {string} userLoginId
   * @param {object} [select]
   */
  async findEmployeeDetails(userLoginId, select = {}) {
    return this.prisma.employeeDetails.findUnique({
      where: { userLoginId },
      ...(Object.keys(select).length > 0 && { select }),
    });
  }

  /**
   * Find student details for a user
   * @param {string} userLoginId
   * @param {object} [select]
   */
  async findStudentDetails(userLoginId, select = {}) {
    return this.prisma.studentDetails.findUnique({
      where: { userLoginId },
      ...(Object.keys(select).length > 0 && { select }),
    });
  }

  // ─── notification ──────────────────────────────────────────────────────────

  /**
   * Create a notification
   * @param {object} data
   */
  async createNotification(data) {
    return this.prisma.notification.create({ data });
  }
}

module.exports = IprRepository;
