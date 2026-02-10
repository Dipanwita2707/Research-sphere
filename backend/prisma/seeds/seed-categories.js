const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed DSW Club Categories Only
 * Creates hierarchical structure: 9 main categories with 68 total club types
 */
async function seedCategories() {
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
      name: 'Technology & Innovation',
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
      name: 'Special Interest',
      icon: '🎯',
      description: 'Miscellaneous and hobby-based clubs',
      sortOrder: 7,
      children: [
        { name: 'Photography & Videography Club', sortOrder: 1 },
        { name: 'Gaming Club', sortOrder: 2 },
        { name: 'Cooking & Culinary Club', sortOrder: 3 },
        { name: 'Travel & Adventure Club', sortOrder: 4 },
        { name: 'Book / Reading Club', sortOrder: 5 },
      ],
    },
    {
      name: 'Student Governance',
      icon: '🏛️',
      description: 'Student council and governance related clubs',
      sortOrder: 8,
      children: [
        { name: 'Student Council', sortOrder: 1 },
        { name: 'Cultural Committee', sortOrder: 2 },
        { name: 'Technical Committee', sortOrder: 3 },
        { name: 'Sports Committee', sortOrder: 4 },
      ],
    },
    {
      name: 'Miscellaneous',
      icon: '🌐',
      description: 'Other clubs not fitting specific categories',
      sortOrder: 9,
      children: [
        { name: 'Alumni Relations Club', sortOrder: 1 },
        { name: 'International Students Club', sortOrder: 2 },
        { name: 'Quiz Club', sortOrder: 3 },
        { name: 'Model UN Club', sortOrder: 4 },
      ],
    },
  ];

  const created = [];
  let totalCategories = 0;

  try {
    console.log('\n🌱 Seeding DSW Club Categories...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const mainCategoryData of CLUB_CATEGORIES) {
      // Check if main category already exists
      let mainCategory = await prisma.clubCategory.findFirst({
        where: { 
          name: mainCategoryData.name,
          parentId: null
        },
      });

      if (!mainCategory) {
        // Create main category
        mainCategory = await prisma.clubCategory.create({
          data: {
            name: mainCategoryData.name,
            icon: mainCategoryData.icon,
            description: mainCategoryData.description,
            sortOrder: mainCategoryData.sortOrder,
            isActive: true,
          },
        });
        created.push(mainCategory);
        totalCategories++;
        console.log(`✅ Created main category: ${mainCategoryData.icon} ${mainCategory.name}`);
      } else {
        console.log(`⏩ Main category already exists: ${mainCategoryData.icon} ${mainCategory.name}`);
      }

      // Create sub-categories
      if (mainCategoryData.children && mainCategoryData.children.length > 0) {
        let subCreated = 0;
        for (const childData of mainCategoryData.children) {
          const existingChild = await prisma.clubCategory.findFirst({
            where: {
              name: childData.name,
              parentId: mainCategory.id,
            },
          });

          if (!existingChild) {
            const childCategory = await prisma.clubCategory.create({
              data: {
                name: childData.name,
                sortOrder: childData.sortOrder,
                parentId: mainCategory.id,
                isActive: true,
              },
            });
            created.push(childCategory);
            totalCategories++;
            subCreated++;
          }
        }
        if (subCreated > 0) {
          console.log(`   ↳ Created ${subCreated} sub-categories\n`);
        } else {
          console.log(`   ↳ All sub-categories already exist\n`);
        }
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 Seeding complete!`);
    console.log(`📊 Total categories created: ${created.length}`);
    console.log(`📚 Total categories in database: ${totalCategories}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return created;
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedCategories()
  .then(() => {
    console.log('✅ Category seeding script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Category seeding script failed:', error);
    process.exit(1);
  });
