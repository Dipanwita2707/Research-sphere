/**
 * Research Review Repository
 * Centralizes all prisma.researchContributionReview.* calls for the research module.
 * Accepts a prisma client via constructor for testability.
 */

class ReviewRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Create a new review record
   * @param {object} data - Prisma create data
   */
  async create(data) {
    return this.prisma.researchContributionReview.create({ data });
  }

  /**
   * Find all reviews for a given contribution
   * @param {string} contributionId
   * @param {object} [options] - additional where clauses, orderBy, etc.
   */
  async findByContribution(contributionId, options = {}) {
    const { where = {}, orderBy = { reviewedAt: 'desc' }, include = {} } = options;
    return this.prisma.researchContributionReview.findMany({
      where: {
        researchContributionId: contributionId,
        ...where
      },
      orderBy,
      ...(Object.keys(include).length > 0 && { include })
    });
  }

  /**
   * Find all reviews submitted by a given reviewer
   * @param {string} reviewerId
   * @param {object} [options] - additional where clauses, orderBy, etc.
   */
  async findByReviewer(reviewerId, options = {}) {
    const { where = {}, orderBy = { reviewedAt: 'desc' }, include = {} } = options;
    return this.prisma.researchContributionReview.findMany({
      where: {
        reviewerId,
        ...where
      },
      orderBy,
      ...(Object.keys(include).length > 0 && { include })
    });
  }

  /**
   * Update a review record by ID
   * @param {string} id
   * @param {object} data
   */
  async update(id, data) {
    return this.prisma.researchContributionReview.update({
      where: { id },
      data
    });
  }

  /**
   * Update many review records matching a where clause
   * @param {object} where
   * @param {object} data
   */
  async updateMany(where, data) {
    return this.prisma.researchContributionReview.updateMany({ where, data });
  }

  /**
   * Find all reviews matching a where clause
   * @param {object} where
   * @param {object} [options] - select, orderBy, etc.
   */
  async findMany(where, options = {}) {
    return this.prisma.researchContributionReview.findMany({ where, ...options });
  }
}

module.exports = ReviewRepository;
