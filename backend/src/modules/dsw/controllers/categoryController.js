/**
 * DSW Category Controller
 * Handles HTTP requests for club category operations
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - getCategories cached for 1 hour (categories rarely change)
 * - Cache invalidated on create / update / deactivate mutations
 */

const categoryService = require("../services/categoryService");
const cache = require("../../../shared/config/redis");
const { SuccessMessages } = require("../constants");

// Cache key helpers — separate keys for flat vs hierarchical + activeOnly variants
const _catCacheKey = (activeOnly, hierarchical) =>
  `dsw:categories:ao${activeOnly ? 1 : 0}:h${hierarchical ? 1 : 0}:v1`;

const DSW_CAT_TTL = 60 * 60; // 1 hour

/** Invalidate all category cache variants after a mutation */
async function _invalidateCategoryCache() {
  await Promise.all([
    cache.del(_catCacheKey(true, false)),
    cache.del(_catCacheKey(true, true)),
    cache.del(_catCacheKey(false, false)),
    cache.del(_catCacheKey(false, true)),
  ]);
}

/**
 * Get all categories
 * GET /api/dsw/categories?hierarchical=true
 */
async function getCategories(req, res) {
  try {
    const activeOnly = req.query.activeOnly !== "false";
    const hierarchical = req.query.hierarchical === "true";

    // Try cache first
    const cacheKey = _catCacheKey(activeOnly, hierarchical);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const categories = await categoryService.getAllCategories(
      activeOnly,
      hierarchical,
    );

    // Store in cache
    await cache.set(cacheKey, categories, DSW_CAT_TTL);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error in getCategories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
}

/**
 * Get category by ID
 * GET /api/dsw/categories/:categoryId
 */
async function getCategoryById(req, res) {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.getCategoryById(categoryId);

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error in getCategoryById:", error);
    const status = error.message === "Category not found" ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Create new category
 * POST /api/dsw/categories
 */
async function createCategory(req, res) {
  try {
    const categoryData = {
      name: req.body.name,
      description: req.body.description,
      sortOrder: req.body.sortOrder,
    };

    const category = await categoryService.createCategory(categoryData);

    // Invalidate category cache
    await _invalidateCategoryCache();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error in createCategory:", error);
    const status = error.message === "Category name already exists" ? 409 : 500;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Update category
 * PATCH /api/dsw/categories/:categoryId
 */
async function updateCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const updates = {
      name: req.body.name,
      description: req.body.description,
      sortOrder: req.body.sortOrder,
      isActive: req.body.isActive,
    };

    // Remove undefined fields
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key],
    );

    const category = await categoryService.updateCategory(categoryId, updates);

    // Invalidate category cache
    await _invalidateCategoryCache();

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error in updateCategory:", error);
    const status =
      error.message === "Category not found"
        ? 404
        : error.message === "Category name already exists"
          ? 409
          : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Deactivate category
 * DELETE /api/dsw/categories/:categoryId
 */
async function deactivateCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.deactivateCategory(categoryId);

    // Invalidate category cache
    await _invalidateCategoryCache();

    res.json({
      success: true,
      message: "Category deactivated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error in deactivateCategory:", error);
    const status =
      error.message === "Category not found"
        ? 404
        : error.message.includes("active clubs")
          ? 409
          : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Seed default categories
 * POST /api/dsw/categories/seed
 */
async function seedCategories(req, res) {
  try {
    const categories = await categoryService.seedDefaultCategories();

    // Invalidate category cache after seeding
    await _invalidateCategoryCache();

    res.json({
      success: true,
      message: `Seeded ${categories.length} categories successfully`,
      data: categories,
    });
  } catch (error) {
    console.error("Error in seedCategories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to seed categories",
      error: error.message,
    });
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
  seedCategories,
};
