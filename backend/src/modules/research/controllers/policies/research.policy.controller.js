const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');

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
    
    const policy = await prisma.researchIncentivePolicy.findFirst({
      where: {
        publicationType: publicationType.toLowerCase(),
        isActive: true
      }
    });

    if (!policy) {
      // Return default policy if none exists
      const defaultPolicy = DEFAULT_RESEARCH_POLICIES[publicationType.toLowerCase()] || DEFAULT_RESEARCH_POLICIES.research_paper;
      
      return res.json({
        success: true,
        data: {
          publicationType,
          ...defaultPolicy,
          isDefault: true
        }
      });
    }

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
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

    const pubDate = publicationDate ? new Date(publicationDate) : new Date();
    
    // Find policy where effectiveFrom <= publicationDate AND (effectiveTo >= publicationDate OR effectiveTo is null)
    const policy = await prisma.researchIncentivePolicy.findFirst({
      where: {
        publicationType: publicationType.toLowerCase(),
        effectiveFrom: {
          lte: pubDate
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: pubDate } }
        ]
      },
      orderBy: {
        effectiveFrom: 'desc' // Get the most recent applicable policy
      }
    });

    if (!policy) {
      // Return default policy if none exists
      const defaultPolicy = DEFAULT_RESEARCH_POLICIES[publicationType.toLowerCase()] || DEFAULT_RESEARCH_POLICIES.research_paper;
      
      return res.json({
        success: true,
        data: {
          publicationType,
          ...defaultPolicy,
          isDefault: true
        }
      });
    }

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get applicable policy by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applicable research policy'
    });
  }
};

/**
 * Create a new research incentive policy
 * Accessible by: admin
 */
exports.createPolicy = async (req, res) => {
  try {
    const {
      publicationType,
      policyName,
      baseIncentiveAmount,
      basePoints,
      splitPolicy,
      distributionMethod,
      primaryAuthorShare,
      authorTypeMultipliers,
      indexingBonuses,
      impactFactorTiers,
      effectiveFrom,
      effectiveTo,
      isActive,
      firstAuthorPercentage,
      correspondingAuthorPercentage,
      rolePercentages,
      positionPercentages
    } = req.body;

    // Validate required fields
    if (!publicationType || !policyName || baseIncentiveAmount === undefined || basePoints === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide publicationType, policyName, baseIncentiveAmount, and basePoints'
      });
    }

    if (!effectiveFrom) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an effectiveFrom date'
      });
    }

    // Validate quartile incentives if provided
    if (indexingBonuses && indexingBonuses.quartileIncentives) {
      const requiredQuartiles = ['Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4'];
      const providedQuartiles = indexingBonuses.quartileIncentives.map(q => q.quartile);
      const missingQuartiles = requiredQuartiles.filter(q => !providedQuartiles.includes(q));
      
      if (missingQuartiles.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required quartile incentives: ${missingQuartiles.join(', ')}. All six quartiles (Top 1%, Top 5%, Q1-Q4) must be provided.`
        });
      }
    }

    // Check for overlapping date ranges with existing policies of same publication type
    const existingPolicies = await prisma.researchIncentivePolicy.findMany({
      where: {
        publicationType: publicationType.toLowerCase()
      }
    });

    const newStartDate = new Date(effectiveFrom);
    const newEndDate = effectiveTo ? new Date(effectiveTo) : null;

    for (const existingPolicy of existingPolicies) {
      const existingStart = new Date(existingPolicy.effectiveFrom);
      const existingEnd = existingPolicy.effectiveTo ? new Date(existingPolicy.effectiveTo) : null;

      // Check for overlap
      const overlaps = (
        // New policy starts during existing policy
        (newStartDate >= existingStart && (!existingEnd || newStartDate <= existingEnd)) ||
        // New policy ends during existing policy
        (newEndDate && newEndDate >= existingStart && (!existingEnd || newEndDate <= existingEnd)) ||
        // New policy completely contains existing policy
        (newStartDate <= existingStart && (!newEndDate || (existingEnd && newEndDate >= existingEnd) || !existingEnd)) ||
        // Existing policy completely contains new policy
        (existingStart <= newStartDate && (!existingEnd || (newEndDate && existingEnd >= newEndDate) || !newEndDate))
      );

      if (overlaps) {
        // AUTO-FIX: Instead of throwing error, automatically adjust the conflicting policy's end date
        // If the new policy starts after the existing policy, set existing policy's end date to one day before new policy starts
        if (newStartDate > existingStart) {
          const oneDayBefore = new Date(newStartDate);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);
          
          await prisma.researchIncentivePolicy.update({
            where: { id: existingPolicy.id },
            data: { effectiveTo: oneDayBefore }
          });
        }
        // If the new policy completely contains the existing policy, deactivate the existing policy
        else if (newStartDate <= existingStart && (!newEndDate || !existingEnd || newEndDate >= existingEnd)) {
          await prisma.researchIncentivePolicy.update({
            where: { id: existingPolicy.id },
            data: { isActive: false }
          });
        }
      }
    }

    const now = new Date();
    const policyStartDate = new Date(effectiveFrom);
    const policyEndDate = effectiveTo ? new Date(effectiveTo) : null;
    
    // Determine if policy is currently active based on dates
    const isCurrentlyActive = policyStartDate <= now && (!policyEndDate || policyEndDate >= now);

    const policy = await prisma.researchIncentivePolicy.create({
      data: {
        publicationType: publicationType.toLowerCase(),
        policyName,
        baseIncentiveAmount,
        basePoints,
        splitPolicy: splitPolicy || 'equal',
        distributionMethod: distributionMethod || 'author_role_based',
        primaryAuthorShare,
        authorTypeMultipliers: authorTypeMultipliers || DEFAULT_RESEARCH_POLICIES.research_paper.authorRoleMultipliers,
        indexingBonuses: indexingBonuses || DEFAULT_RESEARCH_POLICIES.research_paper.indexingBonuses,
        impactFactorTiers: impactFactorTiers || DEFAULT_RESEARCH_POLICIES.research_paper.impactFactorTiers,
        first_author_percentage: firstAuthorPercentage ?? 40,
        corresponding_author_percentage: correspondingAuthorPercentage ?? 40,
        effectiveFrom: policyStartDate,
        effectiveTo: policyEndDate,
        isActive: isCurrentlyActive,
        createdById: req.user.id
      }
    });

    // Log policy creation
    await auditLogger.logPolicyCreation(policy, 'research', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Research incentive policy created successfully',
      data: policy
    });
  } catch (error) {
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
    const {
      policyName,
      baseIncentiveAmount,
      basePoints,
      splitPolicy,
      distributionMethod,
      primaryAuthorShare,
      authorTypeMultipliers,
      indexingBonuses,
      impactFactorTiers,
      effectiveFrom,
      effectiveTo,
      isActive,
      firstAuthorPercentage,
      correspondingAuthorPercentage,
      rolePercentages,
      positionPercentages
    } = req.body;

    // Check if policy exists
    const existingPolicy = await prisma.researchIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Research incentive policy not found'
      });
    }

    // Validate quartile incentives if provided
    if (indexingBonuses && indexingBonuses.quartileIncentives) {
      const requiredQuartiles = ['Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4'];
      const providedQuartiles = indexingBonuses.quartileIncentives.map(q => q.quartile);
      const missingQuartiles = requiredQuartiles.filter(q => !providedQuartiles.includes(q));
      
      if (missingQuartiles.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required quartile incentives: ${missingQuartiles.join(', ')}. All six quartiles (Top 1%, Top 5%, Q1-Q4) must be provided.`
        });
      }
    }

    // If dates are being updated, check for overlapping date ranges
    if (effectiveFrom || effectiveTo !== undefined) {
      const newStartDate = effectiveFrom ? new Date(effectiveFrom) : existingPolicy.effectiveFrom;
      const newEndDate = effectiveTo === null ? null : (effectiveTo ? new Date(effectiveTo) : existingPolicy.effectiveTo);

      const otherPolicies = await prisma.researchIncentivePolicy.findMany({
        where: {
          publicationType: existingPolicy.publicationType,
          id: { not: id }
        }
      });

      for (const otherPolicy of otherPolicies) {
        const existingStart = new Date(otherPolicy.effectiveFrom);
        const existingEnd = otherPolicy.effectiveTo ? new Date(otherPolicy.effectiveTo) : null;

        // Check for overlap
        const overlaps = (
          (newStartDate >= existingStart && (!existingEnd || newStartDate <= existingEnd)) ||
          (newEndDate && newEndDate >= existingStart && (!existingEnd || newEndDate <= existingEnd)) ||
          (newStartDate <= existingStart && (!newEndDate || (existingEnd && newEndDate >= existingEnd) || !existingEnd)) ||
          (existingStart <= newStartDate && (!existingEnd || (newEndDate && existingEnd >= newEndDate) || !newEndDate))
        );

        if (overlaps) {
          // AUTO-FIX: Instead of throwing error, automatically adjust the conflicting policy's end date
          // If the new policy starts after the existing policy, set existing policy's end date to one day before new policy starts
          if (newStartDate > existingStart) {
            const oneDayBefore = new Date(newStartDate);
            oneDayBefore.setDate(oneDayBefore.getDate() - 1);
            
            await prisma.researchIncentivePolicy.update({
              where: { id: otherPolicy.id },
              data: { effectiveTo: oneDayBefore }
            });
          }
          // If the new policy ends before the existing policy starts, adjust new policy's end date
          else if (newEndDate && newEndDate < existingStart) {
            // This case is fine, no overlap
            continue;
          }
          // If the new policy completely contains the existing policy, deactivate the existing policy
          else if (newStartDate <= existingStart && (!newEndDate || !existingEnd || newEndDate >= existingEnd)) {
            await prisma.researchIncentivePolicy.update({
              where: { id: otherPolicy.id },
              data: { isActive: false }
            });
          }
        }
      }
    }

    const now = new Date();
    const policyStartDate = effectiveFrom ? new Date(effectiveFrom) : existingPolicy.effectiveFrom;
    const policyEndDate = effectiveTo === null ? null : (effectiveTo ? new Date(effectiveTo) : existingPolicy.effectiveTo);
    
    // Determine if policy is currently active based on dates
    const isCurrentlyActive = policyStartDate <= now && (!policyEndDate || policyEndDate >= now);

    const updatedPolicy = await prisma.researchIncentivePolicy.update({
      where: { id },
      data: {
        policyName: policyName || existingPolicy.policyName,
        baseIncentiveAmount: baseIncentiveAmount ?? existingPolicy.baseIncentiveAmount,
        basePoints: basePoints ?? existingPolicy.basePoints,
        splitPolicy: splitPolicy || existingPolicy.splitPolicy,
        distributionMethod: distributionMethod || existingPolicy.distributionMethod || 'author_role_based',
        primaryAuthorShare: primaryAuthorShare ?? existingPolicy.primaryAuthorShare,
        authorTypeMultipliers: authorTypeMultipliers || existingPolicy.authorTypeMultipliers,
        indexingBonuses: indexingBonuses || existingPolicy.indexingBonuses,
        impactFactorTiers: impactFactorTiers || existingPolicy.impactFactorTiers,
        first_author_percentage: firstAuthorPercentage ?? existingPolicy.first_author_percentage,
        corresponding_author_percentage: correspondingAuthorPercentage ?? existingPolicy.corresponding_author_percentage,
        effectiveFrom: policyStartDate,
        effectiveTo: policyEndDate,
        isActive: isCurrentlyActive,
        updatedById: req.user.id
      }
    });

    // Log policy update
    await auditLogger.logPolicyUpdate(existingPolicy, updatedPolicy, 'research', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.json({
      success: true,
      message: 'Research incentive policy updated successfully',
      data: updatedPolicy
    });
  } catch (error) {
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
