const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');
const { previewDate, sendPolicyPreview } = require('../../utils/policyPreview');
const { parseResearchPolicy, sendPolicyError } = require('../../validators/incentivePolicy.validation');
const { savePolicy, policyWindowWhere } = require('../../utils/policyWindow');

// Default policies for research publications
const DEFAULT_RESEARCH_POLICIES = {
  research_paper: {
    baseIncentiveAmount: 30000,
    basePoints: 30,
    splitPolicy: 'author_role_based',
    authorRoleMultipliers: {
      first_and_corresponding: 1.0,
      first_author: 0.7,
      corresponding_author: 0.7,
      co_author: 0.3,
      senior_author: 0.4
    },
    indexingBonuses: {
      scopus: 10000,
      wos: 15000,
      sci: 20000,
      ugc: 5000,
      pubmed: 12000,
      ieee: 12000
    },
    quartileBonuses: {
      'Top 1%': 37500,
      'Top 5%': 30000,
      q1: 25000,
      q2: 15000,
      q3: 8000,
      q4: 3000
    },
    impactFactorTiers: [
      { minIF: 0, maxIF: 1, bonus: 0 },
      { minIF: 1, maxIF: 3, bonus: 5000 },
      { minIF: 3, maxIF: 5, bonus: 10000 },
      { minIF: 5, maxIF: 10, bonus: 20000 },
      { minIF: 10, maxIF: null, bonus: 40000 }
    ]
  },
  book: {
    baseIncentiveAmount: 50000,
    basePoints: 50,
    splitPolicy: 'author_role_based',
    authorRoleMultipliers: {
      first_and_corresponding: 1.0,
      first_author: 0.7,
      corresponding_author: 0.7,
      co_author: 0.3,
      senior_author: 0.4
    }
  },
  book_chapter: {
    baseIncentiveAmount: 20000,
    basePoints: 20,
    splitPolicy: 'author_role_based',
    authorRoleMultipliers: {
      first_and_corresponding: 1.0,
      first_author: 0.7,
      corresponding_author: 0.7,
      co_author: 0.3,
      senior_author: 0.4
    }
  },
  conference_paper: {
    baseIncentiveAmount: 15000,
    basePoints: 15,
    splitPolicy: 'author_role_based',
    authorRoleMultipliers: {
      first_and_corresponding: 1.0,
      first_author: 0.7,
      corresponding_author: 0.7,
      co_author: 0.3,
      senior_author: 0.4
    },
    conferenceTypeBonuses: {
      international: 10000,
      national: 5000,
      regional: 2000
    }
  },
  grant: {
    baseIncentiveAmount: 100000,
    basePoints: 100,
    splitPolicy: 'equal',
    grantAmountTiers: [
      { minAmount: 0, maxAmount: 500000, bonus: 0 },
      { minAmount: 500000, maxAmount: 2500000, bonus: 20000 },
      { minAmount: 2500000, maxAmount: 10000000, bonus: 50000 },
      { minAmount: 10000000, maxAmount: null, bonus: 100000 }
    ]
  }
};

/**
 * Get all research incentive policies
 * Accessible by: admin
 */
exports.getAllPolicies = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    
    const whereClause = includeInactive === 'true' ? {} : { isActive: true };
    if (req.tenantId) {
      whereClause.universityId = req.tenantId;
    }
    
    const policies = await prisma.researchIncentivePolicy.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true }
            }
          }
        },
        updatedBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true }
            }
          }
        }
      },
      orderBy: [
        { publicationType: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: policies
    });
  } catch (error) {
    console.error('Get all research policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch research incentive policies'
    });
  }
};

/**
 * Get active policy for a specific publication type
 * Accessible by: all authenticated users
 */
exports.getPolicyByType = async (req, res) => {
  try {
    const { publicationType } = req.params;
    const onDate = previewDate(req.query.publicationDate);

    // The policy in force on the date (enabled and inside its effective window).
    const policy = await prisma.researchIncentivePolicy.findFirst({
      where: {
        publicationType: publicationType.toLowerCase(),
        ...policyWindowWhere(onDate),
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // No built-in defaults: the calculator pays ₹0 without a policy, so the preview says so.
    return sendPolicyPreview(res, { policy });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get research policy by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch research incentive policy'
    });
  }
};

/**
 * Get applicable policy based on publication date
 * Accessible by: all authenticated users
 */
exports.getApplicablePolicyByDate = async (req, res) => {
  try {
    const { publicationType, publicationDate } = req.query;
    
    if (!publicationType) {
      return res.status(400).json({
        success: false,
        message: 'Publication type is required'
      });
    }

    const pubDate = previewDate(publicationDate);
        
    // Find policy where effectiveFrom <= publicationDate AND (effectiveTo >= publicationDate OR effectiveTo is null)
    const policy = await prisma.researchIncentivePolicy.findFirst({
      where: {
        publicationType: publicationType.toLowerCase(),
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        // Enabled and covering the publication's day (same rule the calculator uses)
        ...policyWindowWhere(pubDate)
      },
      orderBy: {
        effectiveFrom: 'desc' // Get the most recent applicable policy
      }
    });

    // Same answer the calculator gives: the policy, or policyFound:false (₹0) — never defaults.
    return sendPolicyPreview(res, { policy });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get applicable policy by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applicable research policy'
    });
  }
};

/**
 * Create or update a research policy in ONE transaction: validate, make room among the
 * enabled policies of the same type (closing the previous one the day before the new
 * window starts), then write. isActive is the admin's on/off switch and is never derived
 * from dates; which policy applies to a publication is decided by its effective window.
 */
function saveResearchPolicy({ data, existing = null, tenantId, actorId }) {
  return savePolicy({
    prisma,
    model: 'researchIncentivePolicy',
    keyWhere: { publicationType: data.publicationType },
    data,
    existing,
    tenantId,
    actorId,
    mode: 'supersede',
  });
}

/**
 * Create a new research incentive policy
 * Accessible by: admin
 */
exports.createPolicy = async (req, res) => {
  try {
    const data = parseResearchPolicy(req.body);
    const defaults = DEFAULT_RESEARCH_POLICIES.research_paper;
    if (data.authorTypeMultipliers === undefined) data.authorTypeMultipliers = defaults.authorRoleMultipliers;
    if (data.indexingBonuses === undefined) data.indexingBonuses = defaults.indexingBonuses;
    if (data.impactFactorTiers === undefined) data.impactFactorTiers = defaults.impactFactorTiers;

    const { policy, adjusted } = await saveResearchPolicy({ data, tenantId: req.tenantId, actorId: req.user.id });

    await auditLogger.logPolicyCreation(policy, 'research', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Research incentive policy created successfully',
      data: policy,
      adjustedPolicies: adjusted,
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Create research policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create research incentive policy'
    });
  }
};

/**
 * Update an existing research incentive policy
 * Accessible by: admin
 */
exports.updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.researchIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Research incentive policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    const data = parseResearchPolicy(req.body, existingPolicy);
    const { policy: updatedPolicy, adjusted } = await saveResearchPolicy({
      data, existing: existingPolicy, tenantId: req.tenantId, actorId: req.user.id,
    });

    await auditLogger.logPolicyUpdate(existingPolicy, updatedPolicy, 'research', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.json({
      success: true,
      message: 'Research incentive policy updated successfully',
      data: updatedPolicy,
      adjustedPolicies: adjusted,
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Update research policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update research incentive policy'
    });
  }
};

/**
 * Delete a research incentive policy
 * Accessible by: admin
 */
exports.deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.researchIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Research incentive policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    await prisma.researchIncentivePolicy.delete({
      where: { id }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(existingPolicy, 'research', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.json({
      success: true,
      message: 'Research incentive policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete research policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete research incentive policy'
    });
  }
};

/**
 * Calculate research incentive for a contribution based on policy
 * Used by review approval flow
 */
exports.calculateIncentive = async (contribution, authorRole = 'first_and_corresponding') => {
  try {
    const publicationType = contribution.publicationType || 'research_paper';
    
    // Get active policy or use default
    let policy = await prisma.researchIncentivePolicy.findFirst({
      where: {
        publicationType: publicationType.toLowerCase(),
        isActive: true
      }
    });

    if (!policy) {
      policy = DEFAULT_RESEARCH_POLICIES[publicationType] || DEFAULT_RESEARCH_POLICIES.research_paper;
    }

    let incentiveAmount = Number(policy.baseIncentiveAmount);
    let points = policy.basePoints;
    const breakdown = [];

    breakdown.push({ description: 'Base incentive', amount: incentiveAmount, points });

    // Apply author role multiplier
    const authorMultipliers = policy.authorTypeMultipliers || DEFAULT_RESEARCH_POLICIES.research_paper.authorRoleMultipliers;
    const roleMultiplier = authorMultipliers[authorRole] || 0.3;
    
    const roleAdjustedAmount = incentiveAmount * roleMultiplier;
    const roleAdjustedPoints = Math.round(points * roleMultiplier);
    
    breakdown.push({ 
      description: `Author role (${authorRole}): ${roleMultiplier * 100}%`, 
      amount: roleAdjustedAmount - incentiveAmount, 
      points: roleAdjustedPoints - points 
    });
    
    incentiveAmount = roleAdjustedAmount;
    points = roleAdjustedPoints;

    // Indexing bonus is now handled via indexingCategories array, not targetedResearchType
    // The bonus calculation is done in the main incentive calculation function

    // Apply quartile bonus if applicable
    if (contribution.quartile && policy.indexingBonuses?.quartileBonuses) {
      const quartileBonus = policy.indexingBonuses.quartileBonuses[contribution.quartile.toLowerCase()] || 0;
      if (quartileBonus > 0) {
        const adjustedQuartileBonus = quartileBonus * roleMultiplier;
        incentiveAmount += adjustedQuartileBonus;
        breakdown.push({ 
          description: `Quartile bonus (${contribution.quartile.toUpperCase()})`, 
          amount: adjustedQuartileBonus, 
          points: 0 
        });
      }
    }

    // Apply impact factor bonus if applicable
    if (contribution.impactFactor && policy.impactFactorTiers) {
      const impactFactor = Number(contribution.impactFactor);
      for (const tier of policy.impactFactorTiers) {
        if (impactFactor >= tier.minIF && (tier.maxIF === null || impactFactor < tier.maxIF)) {
          if (tier.bonus > 0) {
            const adjustedIFBonus = tier.bonus * roleMultiplier;
            incentiveAmount += adjustedIFBonus;
            breakdown.push({ 
              description: `Impact factor bonus (IF: ${impactFactor})`, 
              amount: adjustedIFBonus, 
              points: 0 
            });
          }
          break;
        }
      }
    }

    return {
      totalAmount: Math.round(incentiveAmount),
      totalPoints: points,
      breakdown,
      policyId: policy.id || null,
      policyName: policy.policyName || 'Default Policy',
      authorRole
    };
  } catch (error) {
    console.error('Calculate research incentive error:', error);
    throw error;
  }
};

// Export default policies for use elsewhere
exports.DEFAULT_RESEARCH_POLICIES = DEFAULT_RESEARCH_POLICIES;
