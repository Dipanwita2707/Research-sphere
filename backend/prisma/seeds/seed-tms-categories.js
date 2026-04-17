/**
 * TMS Category Seed Script
 * Seeds the 3-level category hierarchy for the Ticket Management System.
 *
 * Usage:
 *   node prisma/seeds/seed-tms-categories.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =====================================================// Category data: Master → Category → Sub-Category[]
// =====================================================const CATEGORY_TREE = [
  {
    name: 'Academics',
    isAcademic: true,
    sortOrder: 1,
    categories: [
      {
        name: 'Academics',
        subCategories: [
          'Backlog',
          'Behaviour of Staff',
          'Change of Programme',
          'Class Makeup / Adjustment',
          'Classroom Discipline',
          'Classroom Teaching Feedback',
          'Continuation of degree [Degree extension]',
          'Continuous Assessment (CA)',
          'Elective Polling',
          'Guest Lecture / Workshop / Educational Visit',
          'Programme Complete Mark',
          'Scheme / Syllabus / Instruction Plan / Lab Manual / Academic Calendars',
          'Semester Abroad / Credit Transfer',
          'Student Attendance',
          'Term off',
          'Time Table',
        ],
      },
      {
        name: 'EDU Revolution',
        subCategories: [
          'EDU Revolution',
          'MOOCs / Hackathon',
          'Values Added Courses / Cohort / Lab',
        ],
      },
      {
        name: 'Course Registration Issues',
        subCategories: [
          'School of Computer Science and Engineering',
        ],
      },
    ],
  },
  {
    name: 'Administrative Office (Students)',
    isAcademic: false,
    sortOrder: 2,
    categories: [
      {
        name: 'Concerns related to Faculty/Staff',
        subCategories: [
          'Behaviour of Staff',
        ],
      },
    ],
  },
  {
    name: 'Admissions',
    isAcademic: false,
    sortOrder: 3,
    categories: [
      {
        name: 'Admissions',
        subCategories: [
          'Accommodation Disclosure Issues',
          'Admission Query',
          'Any Other Issue',
          'Behaviour of Staff',
          'Faculty/Staff/Dependent Fee Waiver',
          'Financial Aid',
          'ID Card',
          'Loan Issues (New Admissions)',
          'Pending Documents (New Admissions)',
          'Pending Payments (New Admissions)',
          'Referral Policy (Students)',
          'Refund / Program Transfer (New Admissions)',
          'Scholarship offered by University',
          'Turnstile',
        ],
      },
    ],
  },
  {
    name: 'Division of Research and Development',
    isAcademic: true,
    sortOrder: 4,
    categories: [
      {
        name: 'Division of Research and Development',
        subCategories: [
          'Regarding Research Incentives',
          'Status of IPR / Patents / Copyrights',
          'Status of Log IDs',
        ],
      },
    ],
  },
  {
    name: 'Examination',
    isAcademic: true,
    sortOrder: 5,
    categories: [
      {
        name: 'Examination',
        subCategories: [
          'Behaviour of Staff',
          'Issues related to Invigilation / Proctoring',
          'Reappear Registration',
          'Reappear',
          'Results - Theory / ETP Exams',
          'Results - Capstone / Dissertation',
          'Results - Full Term Internship / Training / OJT',
          'Seating Plan - Theory / ETP Exams',
          'Seating Plan and VIVA - Capstone',
          'Seating Plan and VIVA - Full Term Internship',
          'UMC Cases',
        ],
      },
    ],
  },
];

async function seed() {
  console.log('🎫 Seeding TMS categories...\n');

  let masterCount = 0;
  let catCount = 0;
  let subCount = 0;

  for (const master of CATEGORY_TREE) {
    // Upsert master category (avoid duplicates on re-run)
    const existing = await prisma.tmsMasterCategory.findFirst({
      where: { name: master.name },
    });

    let masterCat;
    if (existing) {
      masterCat = existing;
      console.log(`  ⏭️  Master: "${master.name}" (already exists)`);
    } else {
      masterCat = await prisma.tmsMasterCategory.create({
        data: {
          name: master.name,
          isAcademic: master.isAcademic,
          sortOrder: master.sortOrder,
          isActive: true,
        },
      });
      masterCount++;
      console.log(`  ✅ Master: "${master.name}"`);
    }

    for (const cat of master.categories) {
      const existingCat = await prisma.tmsCategory.findFirst({
        where: { name: cat.name, masterCategoryId: masterCat.id },
      });

      let category;
      if (existingCat) {
        category = existingCat;
        console.log(`    ⏭️  Category: "${cat.name}" (already exists)`);
      } else {
        category = await prisma.tmsCategory.create({
          data: {
            name: cat.name,
            masterCategoryId: masterCat.id,
            isActive: true,
          },
        });
        catCount++;
        console.log(`    ✅ Category: "${cat.name}"`);
      }

      for (const subName of cat.subCategories) {
        const existingSub = await prisma.tmsSubCategory.findFirst({
          where: { name: subName, categoryId: category.id },
        });

        if (existingSub) {
          console.log(`      ⏭️  Sub: "${subName}" (already exists)`);
        } else {
          await prisma.tmsSubCategory.create({
            data: {
              name: subName,
              categoryId: category.id,
              isActive: true,
            },
          });
          subCount++;
          console.log(`      ✅ Sub: "${subName}"`);
        }
      }
    }
  }

  console.log(`\n🎉 TMS seed complete!`);
  console.log(`   Created: ${masterCount} master categories, ${catCount} categories, ${subCount} sub-categories`);
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
