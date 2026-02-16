/**
 * DSW Club Category Service
 * Service for managing club categories
 */

const prisma = require('../../../shared/config/database');

/**
 * Get all club categories with hierarchical structure
 * @param {boolean} activeOnly - Return only active categories
 * @param {boolean} hierarchical - Return as parent-child tree structure
 * @returns {Promise<Array>} List of categories
 */
async function getAllCategories(activeOnly = true, hierarchical = false) {
  const where = {};
  if (activeOnly) {
    where.isActive = true;
  }

  if (hierarchical) {
    // Return hierarchical structure (main categories with children)
    const mainCategories = await prisma.clubCategory.findMany({
      where: {
        ...where,
        parentId: null, // Only main categories
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        children: {
          where: activeOnly ? { isActive: true } : {},
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
          include: {
            _count: {
              select: {
                clubs: {
                  where: {
                    status: 'active',
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            clubs: {
              where: {
                status: 'active',
              },
            },
          },
        },
      },
    });

    return mainCategories;
  } else {
    // Return flat list
    const categories = await prisma.clubCategory.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        parent: true, // Include parent info
        _count: {
          select: {
            clubs: {
              where: {
                status: 'active',
              },
            },
          },
        },
      },
    });

    return categories;
  }
}

/**
 * Get category by ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Category details
 */
async function getCategoryById(categoryId) {
  const category = await prisma.clubCategory.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          clubs: true,
        },
      },
    },
  });

  if (!category) {
    throw new Error('Category not found');
  }

  return category;
}

/**
 * Create a new category
 * @param {Object} categoryData - Category data
 * @returns {Promise<Object>} Created category
 */
async function createCategory(categoryData) {
  // Check for duplicate name
  const existing = await prisma.clubCategory.findUnique({
    where: { name: categoryData.name },
  });

  if (existing) {
    throw new Error('Category name already exists');
  }

  const category = await prisma.clubCategory.create({
    data: {
      name: categoryData.name,
      description: categoryData.description,
      sortOrder: categoryData.sortOrder ?? 0,
      isActive: true,
    },
  });

  return category;
}

/**
 * Update category
 * @param {string} categoryId - Category ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated category
 */
async function updateCategory(categoryId, updates) {
  // Check if category exists
  const existing = await prisma.clubCategory.findUnique({
    where: { id: categoryId },
  });

  if (!existing) {
    throw new Error('Category not found');
  }

  // Check for duplicate name if name is being updated
  if (updates.name && updates.name !== existing.name) {
    const duplicate = await prisma.clubCategory.findUnique({
      where: { name: updates.name },
    });

    if (duplicate) {
      throw new Error('Category name already exists');
    }
  }

  const category = await prisma.clubCategory.update({
    where: { id: categoryId },
    data: updates,
  });

  return category;
}

/**
 * Deactivate category (soft delete)
 * Cannot delete if clubs are using it
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Updated category
 */
async function deactivateCategory(categoryId) {
  // Check if any clubs are using this category
  const clubCount = await prisma.club.count({
    where: { 
      categoryId,
      status: 'active',
    },
  });

  if (clubCount > 0) {
    throw new Error('Cannot deactivate category with active clubs');
  }

  const category = await prisma.clubCategory.update({
    where: { id: categoryId },
    data: {
      isActive: false,
    },
  });

  return category;
}

/**
 * Seed default categories with hierarchical structure
 * Should be called during initial setup
 */
async function seedDefaultCategories() {
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
  
  try {
    console.log('🌱 Seeding club categories with hierarchical structure...');
    
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
        console.log(`✅ Created main category: ${mainCategory.name}`);
      } else {
        console.log(`⏩ Main category already exists: ${mainCategory.name}`);
      }

      // Create sub-categories
      if (mainCategoryData.children && mainCategoryData.children.length > 0) {
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
            console.log(`  ↳ Created sub-category: ${childCategory.name}`);
          }
        }
      }
    }

    console.log(`🎉 Seeding complete: ${created.length} categories created`);
    return created;
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
  seedDefaultCategories,
};
