/**
 * Seed Script for Club Categories (Two-Level Hierarchy)
 * Main Categories → Sub-Categories (Club Types)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLUB_CATEGORIES = [
  {
    name: 'Academic & Technical',
    icon: '🎓',
    description: 'Academic excellence and technical innovation focused clubs',
    sortOrder: 1,
    children: [
      { name: 'Coding Club', sortOrder: 1 },
      { name: 'Robotics Club', sortOrder: 2 },
      { name: 'AI / ML Club', sortOrder: 3 },
      { name: 'Data Science Club', sortOrder: 4 },
      { name: 'Cyber Security Club', sortOrder: 5 },
      { name: 'Electronics & IoT Club', sortOrder: 6 },
      { name: 'Research & Innovation Club', sortOrder: 7 },
      { name: 'Mathematics Club', sortOrder: 8 },
      { name: 'Astronomy / Space Club', sortOrder: 9 },
    ],
  },
  {
    name: 'Cultural & Creative',
    icon: '🎭',
    description: 'Arts, culture, and creative expression clubs',
    sortOrder: 2,
    children: [
      { name: 'Dance Club', sortOrder: 1 },
      { name: 'Music Club', sortOrder: 2 },
      { name: 'Drama / Theatre Club', sortOrder: 3 },
      { name: 'Fine Arts / Painting Club', sortOrder: 4 },
      { name: 'Photography Club', sortOrder: 5 },
      { name: 'Film & Media Club', sortOrder: 6 },
      { name: 'Fashion Club', sortOrder: 7 },
      { name: 'Literary / Poetry Club', sortOrder: 8 },
    ],
  },
  {
    name: 'Sports & Fitness',
    icon: '⚽',
    description: 'Physical fitness, sports, and wellness clubs',
    sortOrder: 3,
    children: [
      { name: 'Cricket Club', sortOrder: 1 },
      { name: 'Football Club', sortOrder: 2 },
      { name: 'Basketball Club', sortOrder: 3 },
      { name: 'Badminton Club', sortOrder: 4 },
      { name: 'Athletics Club', sortOrder: 5 },
      { name: 'Chess Club', sortOrder: 6 },
      { name: 'Yoga & Wellness Club', sortOrder: 7 },
      { name: 'Martial Arts Club', sortOrder: 8 },
    ],
  },
  {
    name: 'Social Service & Community',
    icon: '🌱',
    description: 'Community service, social welfare, and volunteering clubs',
    sortOrder: 4,
    children: [
      { name: 'NSS (National Service Scheme)', sortOrder: 1 },
      { name: 'NGO / Volunteering Club', sortOrder: 2 },
      { name: 'Blood Donation Club', sortOrder: 3 },
      { name: 'Environment & Sustainability Club', sortOrder: 4 },
      { name: 'Social Awareness Club', sortOrder: 5 },
      { name: 'Rural Development Club', sortOrder: 6 },
    ],
  },
  {
    name: 'Professional & Career',
    icon: '💼',
    description: 'Career development and professional skill building clubs',
    sortOrder: 5,
    children: [
      { name: 'Placement & Career Development Club', sortOrder: 1 },
      { name: 'Entrepreneurship / Startup Club', sortOrder: 2 },
      { name: 'Finance & Investment Club', sortOrder: 3 },
      { name: 'Consulting Club', sortOrder: 4 },
      { name: 'Marketing Club', sortOrder: 5 },
      { name: 'Public Speaking / Toastmasters Club', sortOrder: 6 },
    ],
  },
  {
    name: 'Technology & Innovation (Non-Academic)',
    icon: '🧑‍💻',
    description: 'Technology innovation and product development clubs',
    sortOrder: 6,
    children: [
      { name: 'Open Source Club', sortOrder: 1 },
      { name: 'Hackathon Club', sortOrder: 2 },
      { name: 'Product Development Club', sortOrder: 3 },
      { name: 'UI/UX Design Club', sortOrder: 4 },
      { name: 'Game Development Club', sortOrder: 5 },
    ],
  },
  {
    name: 'Media, Communication & Outreach',
    icon: '📰',
    description: 'Media, journalism, and communication clubs',
    sortOrder: 7,
    children: [
      { name: 'Media & PR Club', sortOrder: 1 },
      { name: 'Content Writing Club', sortOrder: 2 },
      { name: 'Podcasting Club', sortOrder: 3 },
      { name: 'Social Media Club', sortOrder: 4 },
      { name: 'Journalism Club', sortOrder: 5 },
    ],
  },
  {
    name: 'Personality Development',
    icon: '🧘',
    description: 'Leadership, communication, and personal growth clubs',
    sortOrder: 8,
    children: [
      { name: 'Leadership Club', sortOrder: 1 },
      { name: 'Debate Club', sortOrder: 2 },
      { name: 'Model United Nations (MUN) Club', sortOrder: 3 },
      { name: 'Ethics & Values Club', sortOrder: 4 },
      { name: 'Soft Skills Club', sortOrder: 5 },
    ],
  },
  {
    name: 'Special Interest / Others',
    icon: '🛡️',
    description: 'Special interest groups and miscellaneous clubs',
    sortOrder: 9,
    children: [
      { name: 'Defence & NCC Club', sortOrder: 1 },
      { name: 'Adventure & Trekking Club', sortOrder: 2 },
      { name: 'Travel Club', sortOrder: 3 },
      { name: 'Language Club (French, German, Japanese, etc.)', sortOrder: 4 },
      { name: 'Alumni Interaction Club', sortOrder: 5 },
    ],
  },
];

async function seedClubCategories() {
  console.log('🌱 Starting Club Category Seeding...\n');

  try {
    // Clear existing categories (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing club categories...');
    await prisma.clubCategory.deleteMany({});
    console.log('✅ Cleared existing categories\n');

    let mainCategoryCount = 0;
    let subCategoryCount = 0;

    for (const mainCategory of CLUB_CATEGORIES) {
      console.log(`📂 Creating Main Category: ${mainCategory.icon} ${mainCategory.name}`);

      // Create main category
      const createdMain = await prisma.clubCategory.create({
        data: {
          name: mainCategory.name,
          icon: mainCategory.icon,
          description: mainCategory.description,
          sortOrder: mainCategory.sortOrder,
          parentId: null, // Main category has no parent
          isActive: true,
        },
      });

      mainCategoryCount++;
      console.log(`   ✅ Created main category (ID: ${createdMain.id})`);

      // Create sub-categories (children)
      if (mainCategory.children && mainCategory.children.length > 0) {
        console.log(`   📝 Creating ${mainCategory.children.length} sub-categories...`);

        for (const subCategory of mainCategory.children) {
          await prisma.clubCategory.create({
            data: {
              name: subCategory.name,
              parentId: createdMain.id,
              sortOrder: subCategory.sortOrder,
              isActive: true,
            },
          });

          subCategoryCount++;
          console.log(`      ✓ ${subCategory.name}`);
        }
      }

      console.log('');
    }

    console.log('🎉 Club Category Seeding Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   └─ Main Categories: ${mainCategoryCount}`);
    console.log(`   └─ Sub-Categories: ${subCategoryCount}`);
    console.log(`   └─ Total Categories: ${mainCategoryCount + subCategoryCount}\n`);

    // Verify seeding
    const mainCategories = await prisma.clubCategory.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    console.log('📋 Verification - Category Tree:');
    mainCategories.forEach((main) => {
      console.log(`\n${main.icon} ${main.name} (${main.children.length} sub-categories)`);
      main.children.forEach((sub) => {
        console.log(`   └─ ${sub.name}`);
      });
    });

    console.log('\n✅ All categories seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding club categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding
seedClubCategories()
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  });
