/**
 * Research Contribution Repository
 * Centralizes all prisma.researchContribution.* calls for the research module.
 * Accepts a prisma client via constructor for testability.
 */

class ContributionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create a new research contribution
   * @param {object} data - Prisma create data
   */
  async create(data) {
    return this.prisma.researchContribution.create({ data });
  }

  /**
   * Find a contribution by its ID, with optional includes
   * @param {string} id
   * @param {object} [include]
   */
  async findById(id, include = {}) {
    return this.prisma.researchContribution.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find the first contribution matching a where clause
   * @param {object} where
   * @param {object} [options] - orderBy, select, etc.
   */
  async findFirst(where, options = {}) {
    return this.prisma.researchContribution.findFirst({ where, ...options });
  }

  /**
   * Find all contributions matching filters
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
    return this.prisma.researchContribution.findMany({
      where,
      ...(select ? { select } : {}),
      ...(!select && include ? { include } : {}),
      orderBy,
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take })
    });
  }

  /**
   * Count contributions matching a where clause
   * @param {object} where
   */
  async count(where = {}) {
    return this.prisma.researchContribution.count({ where });
  }

  /**
   * Update a contribution by ID
   * @param {string} id
   * @param {object} data
   * @param {object} [include]
   */
  async update(id, data, include = {}) {
    return this.prisma.researchContribution.update({
      where: { id },
      data,
      ...(Object.keys(include).length > 0 && { include })
    });
  }

  /**
   * Delete a contribution by ID (cascades to related records)
   * @param {string} id
   */
  async delete(id) {
    return this.prisma.researchContribution.delete({ where: { id } });
  }

  /**
   * Find all contributions where the given user is the primary applicant
   * @param {string} facultyId - user ID of the faculty member
   * @param {object} [filters] - additional where clauses (status, publicationType, etc.)
   */
  async findByFaculty(facultyId, filters = {}) {
    const include = {
      applicantDetails: true,
      authors: true,
      school: true,
      department: true,
      statusHistory: {
        orderBy: { changedAt: 'desc' },
        take: 5
      },
      editSuggestions: {
        where: { status: 'pending' }
      }
    };

    return this.prisma.researchContribution.findMany({
      where: {
        applicantUserId: facultyId,
        ...filters
      },
      include,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Find contributions pending mentor approval for a given mentor UID
   * @param {string} mentorUid
   */
  async findPendingReview(mentorUid) {
    return this.prisma.researchContribution.findMany({
      where: {
        status: 'pending_mentor_approval',
        applicantDetails: {
          mentorUid
        }
      },
      include: {
        applicantDetails: true,
        authors: true,
        school: true,
        department: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Group contributions by a field (e.g. status, publicationType)
   * @param {object} options - { by, where, _count, _sum, _avg }
   */
  async groupBy(options) {
    return this.prisma.researchContribution.groupBy(options);
  }

  /**
   * Aggregate contributions (sum, avg, count, etc.)
   * @param {object} options
   */
  async aggregate(options) {
    return this.prisma.researchContribution.aggregate(options);
  }
}

module.exports = ContributionRepository;
