/**
 * Grant Repository
 * Centralizes all Prisma calls for grant-related models.
 * Accepts a prisma client via constructor for testability.
 */

class GrantRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // ─── grantApplication ──────────────────────────────────────────────────────

  /**
   * Create a new grant application
   * @param {object} data
   * @param {object} [include]
   */
  async create(data, include = {}) {
    return this.prisma.grantApplication.create({
      data,
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Find a grant application by its ID
   * @param {string} id
   * @param {object} [include]
   */
  async findById(id, include = {}) {
    return this.prisma.grantApplication.findUnique({
      where: { id },
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Find the first grant application matching a where clause
   * @param {object} where
   * @param {object} [options]
   */
  async findFirst(where, options = {}) {
    return this.prisma.grantApplication.findFirst({ where, ...options });
  }

  /**
   * Find all grant applications matching filters
   * @param {object} filters - { where, include, orderBy, skip, take }
   */
  async findAll(filters = {}) {
    const {
      where = {},
      include = null,
      select = null,
      orderBy = { createdAt: 'desc' },
      skip,
      take,
    } = filters;
    return this.prisma.grantApplication.findMany({
      where,
      ...(select ? { select } : {}),
      ...(!select && include && Object.keys(include).length > 0 && { include }),
      orderBy,
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
    });
  }

  /**
   * Count grant applications matching a where clause
   * @param {object} where
   */
  async count(where = {}) {
    return this.prisma.grantApplication.count({ where });
  }

  /**
   * Update a grant application by ID
   * @param {string} id
   * @param {object} data
   * @param {object} [include]
   */
  async update(id, data, include = {}) {
    return this.prisma.grantApplication.update({
      where: { id },
      data,
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Update only the status (and optional extra fields) of an application
   * @param {string} id
   * @param {string} status
   * @param {object} [extra]
   * @param {object} [include]
   */
  async updateStatus(id, status, extra = {}, include = {}) {
    return this.prisma.grantApplication.update({
      where: { id },
      data: { status, ...extra },
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Delete a grant application by ID
   * @param {string} id
   */
  async delete(id) {
    return this.prisma.grantApplication.delete({ where: { id } });
  }

  // ─── grantInvestigator ─────────────────────────────────────────────────────

  /**
   * Create a grant investigator record
   * @param {object} data
   */
  async createInvestigator(data) {
    return this.prisma.grantInvestigator.create({ data });
  }

  /**
   * Delete all investigators for a grant application
   * @param {string} grantApplicationId
   */
  async deleteInvestigators(grantApplicationId) {
    return this.prisma.grantInvestigator.deleteMany({ where: { grantApplicationId } });
  }

  // ─── grantConsortiumOrganization ───────────────────────────────────────────

  /**
   * Delete all consortium organizations for a grant application
   * @param {string} grantApplicationId
   */
  async deleteConsortiumOrgs(grantApplicationId) {
    return this.prisma.grantConsortiumOrganization.deleteMany({ where: { grantApplicationId } });
  }

  // ─── grantApplicationStatusHistory ────────────────────────────────────────

  /**
   * Create a status history entry
   * @param {object} data
   */
  async createStatusHistory(data) {
    return this.prisma.grantApplicationStatusHistory.create({ data });
  }

  // ─── grantApplicationReview ────────────────────────────────────────────────

  /**
   * Create a review record
   * @param {object} data
   */
  async createReview(data) {
    return this.prisma.grantApplicationReview.create({ data });
  }

  // ─── grantApplicationEditSuggestion ───────────────────────────────────────

  /**
   * Find an edit suggestion by ID (with optional include)
   * @param {string} id
   * @param {object} [include]
   */
  async findSuggestionById(id, include = {}) {
    return this.prisma.grantApplicationEditSuggestion.findUnique({
      where: { id },
      ...(Object.keys(include).length > 0 && { include }),
    });
  }

  /**
   * Create an edit suggestion
   * @param {object} data
   */
  async createSuggestion(data) {
    return this.prisma.grantApplicationEditSuggestion.create({ data });
  }

  /**
   * Update an edit suggestion by ID
   * @param {string} id
   * @param {object} data
   */
  async updateSuggestion(id, data) {
    return this.prisma.grantApplicationEditSuggestion.update({ where: { id }, data });
  }

  // ─── grantIncentivePolicy ──────────────────────────────────────────────────

  /**
   * Find the active incentive policy for a given project category and type
   * @param {string} projectCategory
   * @param {string} projectType
   */
  async findActivePolicy(projectCategory, projectType) {
    const currentDate = new Date();
    return this.prisma.grantIncentivePolicy.findFirst({
      where: {
        projectCategory,
        projectType,
        isActive: true,
        effectiveFrom: { lte: currentDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: currentDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ─── centralDepartment / centralDepartmentPermission ──────────────────────

  /**
   * Find the DRD central department
   */
  async findDrdDepartment() {
    return this.prisma.centralDepartment.findFirst({
      where: { OR: [{ departmentCode: 'DRD' }, { shortName: 'DRD' }] },
    });
  }

  /**
   * Find a user's direct permission for a central department
   * @param {string} userId
   * @param {string} centralDeptId
   */
  async findDirectPermission(userId, centralDeptId) {
    return this.prisma.centralDepartmentPermission.findFirst({
      where: { userId, isActive: true, centralDeptId },
      select: { assignedGrantSchoolIds: true },
    });
  }

  // ─── userLogin ─────────────────────────────────────────────────────────────

  /**
   * Find a user by their primary key (with optional include)
   * @param {string} id
   * @param {object} [include]
   */
  async findUserById(id, include = {}) {
    return this.prisma.userLogin.findUnique({
      where: { id },
      ...(Object.keys(include).length > 0 && { include }),
    });
  }
}

module.exports = GrantRepository;
