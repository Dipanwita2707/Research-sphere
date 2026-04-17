/**
 * Seed script to create a research policy with the new 10-category structure:
 * 
 * 10 Target Research Categories:
 * 1. Nature/Science/Lancet/Cell/NEJM - Flat incentive
 * 2. Subsidiary Journals (IF > 20) - Flat incentive (requires IF > 20)
 * 3. SCOPUS - Nested quartile-based incentives (requires Quartile + IF)
 * 4. SCIE/SCI (WOS) - Nested SJR-based incentives (requires SJR)
 * 5. PubMed - Flat incentive
 * 6. UGC - Flat incentive
 * 7. NAAS (Rating ≥ 6) - Nested rating-based incentives (requires Rating ≥ 6)
 * 8. ABDC Journals (SCOPUS/WOS) - Flat incentive
 * 9. SGTU In-House Journal - Flat incentive
 * 10. The Case Centre UK - Flat incentive
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding research policy with 11-category structure...');

  // Get an admin user to use as creator
  const adminUser = await prisma.userLogin.findFirst({
    where: {
      role: { in: ['admin', 'superadmin'] }
    }
  });

  if (!adminUser) {
    console.error('❌ No admin user found. Please create an admin user first.');
    process.exit(1);
  }

  console.log(`✅ Using admin user: ${adminUser.email} (${adminUser.id})`);

  // Delete existing research paper policies
  const deletedPolicies = await prisma.researchIncentivePolicy.deleteMany({
    where: {
      publicationType: 'research_paper'
    }
  });
  console.log(`✅ Deleted ${deletedPolicies.count} existing research paper policies`);

  // Create new research policy with 11-category structure
  const policy = await prisma.researchIncentivePolicy.create({
    data: {
      publicationType: 'research_paper',
      policyName: 'Research Paper Policy 2026 - 11 Categories',
      baseIncentiveAmount: 0, // No base amount, everything comes from categories
      basePoints: 0,
      splitPolicy: 'percentage_based',
      distributionMethod: 'author_position_based',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      isActive: true,
      createdById: adminUser.id,
      positionBasedDistribution: {
        "1": 40,  // 1st author gets 40%
        "2": 30,  // 2nd author gets 30%
        "3": 15,  // 3rd author gets 15%
        "4": 10,  // 4th author gets 10%
        "5": 5,   // 5th author gets 5%
        "6+": 0   // More than 5th gets 0%
      },
      indexingBonuses: {
        // =================================        // FLAT CATEGORY BONUSES (no sub-fields)
        // =================================        indexingCategoryBonuses: [
          // 1. Nature/Science/Lancet/Cell/NEJM - Top tier
          { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
          
          // 2. Subsidiary Journals (IF > 20) - Validation happens at backend
          { category: 'subsidiary_if_above_20', incentiveAmount: 100000, points: 50 },
          
          // 5. PubMed
          { category: 'pubmed', incentiveAmount: 15000, points: 15 },
          
          // 8. ABDC Journals (SCOPUS/WOS indexed)
          { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
          
          // 9. SGTU In-House Journal
          { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
          
          // 10. The Case Centre UK
          { category: 'case_centre_uk', incentiveAmount: 8000, points: 8 },
          
          // 11. Conference Proceedings (SCOPUS)
          { category: 'conference_scopus', incentiveAmount: 7000, points: 7 }
        ],
        
        // =================================        // QUARTILE-BASED INCENTIVES (for SCOPUS)
        // =================================        quartileIncentives: [
          { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
          { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
          { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
          { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
          { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
          { quartile: 'Q4', incentiveAmount: 5000, points: 5 }
        ],
        
        // =================================        // SJR-BASED INCENTIVES (for SCIE/SCI WOS)
        // =================================        sjrRanges: [
          { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
          { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
          { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
          { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 }
        ],
        
        // =================================        // NESTED CATEGORY INCENTIVES
        // =================================        nestedCategoryIncentives: {
          // 7. NAAS - Rating-based incentives (only NAAS uses nested structure)
          naasRatingIncentives: [
            { minRating: 10, maxRating: 20, incentiveAmount: 30000, points: 30 },
            { minRating: 8, maxRating: 9.99, incentiveAmount: 20000, points: 20 },
            { minRating: 6, maxRating: 7.99, incentiveAmount: 10000, points: 10 }
          ]
        },
        
        // =================================        // DISTRIBUTION PERCENTAGES
        // =================================        // Role percentages (for role-based distribution)
        rolePercentages: [
          { role: 'first_author', percentage: 35 },
          { role: 'corresponding_author', percentage: 30 }
        ]
      }
    }
  });

  console.log('✅ Created research policy:', {
    id: policy.id,
    policyName: policy.policyName,
    distributionMethod: policy.distributionMethod,
    effectiveFrom: policy.effectiveFrom
  });

  // Also create a role-based policy for comparison
  const roleBasedPolicy = await prisma.researchIncentivePolicy.create({
    data: {
      publicationType: 'research_paper',
      policyName: 'Research Paper Policy 2025 - Role Based (Legacy)',
      baseIncentiveAmount: 0,
      basePoints: 0,
      splitPolicy: 'percentage_based',
      distributionMethod: 'author_role_based',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
      isActive: false, // Make it inactive so position-based is the active one
      createdById: adminUser.id,
      indexingBonuses: {
        // Same category bonuses
        indexingCategoryBonuses: [
          { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
          { category: 'subsidiary_if_above_20', incentiveAmount: 100000, points: 50 },
          { category: 'pubmed', incentiveAmount: 15000, points: 15 },
          { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
          { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
          { category: 'case_centre_uk', incentiveAmount: 8000, points: 8 }
        ],
        quartileIncentives: [
          { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
          { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
          { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
          { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
          { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
          { quartile: 'Q4', incentiveAmount: 5000, points: 5 }
        ],
        sjrRanges: [
          { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
          { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
          { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
          { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 }
        ],
        nestedCategoryIncentives: {
          naasRatingIncentives: [
            { minRating: 10, maxRating: 20, incentiveAmount: 30000, points: 30 },
            { minRating: 8, maxRating: 9.99, incentiveAmount: 20000, points: 20 },
            { minRating: 6, maxRating: 7.99, incentiveAmount: 10000, points: 10 }
          ]
        },
        rolePercentages: [
          { role: 'first_author', percentage: 35 },
          { role: 'corresponding_author', percentage: 30 }
        ],
        positionPercentages: [
          { position: 1, percentage: 40 },
          { position: 2, percentage: 25 },
          { position: 3, percentage: 15 },
          { position: 4, percentage: 12 },
          { position: 5, percentage: 8 }
        ]
      }
    }
  });

  console.log('✅ Created role-based policy:', {
    id: roleBasedPolicy.id,
    policyName: roleBasedPolicy.policyName,
    distributionMethod: roleBasedPolicy.distributionMethod,
    isActive: roleBasedPolicy.isActive
  });

  console.log('\n📊 Summary:');
  console.log('- Position-based policy (2026): ACTIVE');
  console.log('- Role-based policy (2025): INACTIVE (for reference)');
  console.log('📋 10 Target Research Categories:');
  console.log('  1. Nature/Science/Lancet/Cell/NEJM - ₹200,000 (100 pts)');
  console.log('  2. Subsidiary Journals (IF > 20) - ₹100,000 (50 pts) [requires IF > 20]');
  console.log('  3. SCOPUS - Quartile-based: Top 1% ₹75k to Q4 ₹5k [requires Quartile + IF]');
  console.log('  4. SCIE/SCI (WOS) - SJR-based: 2.0+ ₹50k to 0-0.49 ₹5k [requires SJR]');
  console.log('  5. PubMed - ₹15,000 (15 pts)');
  console.log('  6. NAAS (Rating ≥ 6) - Rating-based: 10+ ₹30k to 6-7.99 ₹10k [requires Rating]');
  console.log('  7. ABDC (SCOPUS/WOS) - ₹20,000 (20 pts)');
  console.log('  8. SGTU In-House - ₹5,000 (5 pts)');
  console.log('  9. Case Centre UK - ₹8,000 (8 pts)');
  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
