/**
 * TMS Category Service
 * Admin operations for managing category hierarchy
 */
const prisma = require('../../../shared/config/database');
const { ERROR_MESSAGES } = require('../constants/tms.constants');

/**
 * Resolve an employee ID: accepts either a UUID (direct DB id) or a uid string like "TEACH019".
 * Returns the UUID of the UserLogin record, or throws if not found.
 */
async function resolveEmployeeId(employeeId) {
  if (!employeeId) return null;

  // Check if it looks like a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(employeeId)) return employeeId;

  // Otherwise treat as uid (e.g. "TEACH019")
  const user = await prisma.userLogin.findUnique({ where: { uid: employeeId }, select: { id: true } });
  if (!user) throw new Error(`Employee with UID "${employeeId}" not found`);
  return user.id;
}

const employeeSelect = {
  id: true,
  uid: true,
  employeeDetails: {
    select: {
      displayName: true,
      empId: true,
      designation: true,
    },
  },
};

// =============================================
// Master Categories
// =============================================

async function listMasterCategories(includeInactive = false) {
  const where = includeInactive ? {} : { isActive: true };

  return prisma.tmsMasterCategory.findMany({
    where,
    include: {
      employee: { select: employeeSelect },
      categories: {
        where: includeInactive ? {} : { isActive: true },
        include: {
          employee: { select: employeeSelect },
          masterCategory: { select: { id: true, name: true } },
          subCategories: {
            where: includeInactive ? {} : { isActive: true },
            include: {
              employee: { select: employeeSelect },
              category: { select: { id: true, name: true, masterCategory: { select: { id: true, name: true } } } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { tickets: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

async function createMasterCategory(data) {
  // Check duplicate name
  const existing = await prisma.tmsMasterCategory.findFirst({
    where: { name: { equals: data.name, mode: 'insensitive' } },
  });
  if (existing) throw new Error(ERROR_MESSAGES.DUPLICATE_CATEGORY);

  const resolvedEmployeeId = await resolveEmployeeId(data.employeeId);

  return prisma.tmsMasterCategory.create({
    data: {
      name: data.name,
      description: data.description || null,
      isAcademic: data.isAcademic || false,
      employeeId: resolvedEmployeeId,
      sortOrder: data.sortOrder || 0,
    },
    include: { employee: { select: employeeSelect } },
  });
}

async function updateMasterCategory(id, data) {
  const existing = await prisma.tmsMasterCategory.findUnique({ where: { id } });
  if (!existing) throw new Error(ERROR_MESSAGES.MASTER_CATEGORY_NOT_FOUND);

  // Check duplicate name (excluding self)
  if (data.name) {
    const dup = await prisma.tmsMasterCategory.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' }, id: { not: id } },
    });
    if (dup) throw new Error(ERROR_MESSAGES.DUPLICATE_CATEGORY);
  }

  const resolvedEmployeeId = data.employeeId !== undefined ? await resolveEmployeeId(data.employeeId) : undefined;

  return prisma.tmsMasterCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isAcademic !== undefined && { isAcademic: data.isAcademic }),
      ...(resolvedEmployeeId !== undefined && { employeeId: resolvedEmployeeId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    include: { employee: { select: employeeSelect } },
  });
}

async function deleteMasterCategory(id) {
  const existing = await prisma.tmsMasterCategory.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!existing) throw new Error(ERROR_MESSAGES.MASTER_CATEGORY_NOT_FOUND);
  if (existing._count.tickets > 0) {
    throw new Error('Cannot delete master category with existing tickets. Deactivate instead.');
  }

  await prisma.tmsMasterCategory.delete({ where: { id } });
}

// =============================================
// Categories
// =============================================

async function createCategory(data) {
  const master = await prisma.tmsMasterCategory.findUnique({ where: { id: data.masterCategoryId } });
  if (!master) throw new Error(ERROR_MESSAGES.MASTER_CATEGORY_NOT_FOUND);

  const existing = await prisma.tmsCategory.findFirst({
    where: {
      name: { equals: data.name, mode: 'insensitive' },
      masterCategoryId: data.masterCategoryId,
    },
  });
  if (existing) throw new Error(ERROR_MESSAGES.DUPLICATE_CATEGORY);

  const resolvedEmployeeId = await resolveEmployeeId(data.employeeId);

  return prisma.tmsCategory.create({
    data: {
      name: data.name,
      description: data.description || null,
      masterCategoryId: data.masterCategoryId,
      employeeId: resolvedEmployeeId,
      sortOrder: data.sortOrder || 0,
    },
    include: { employee: { select: employeeSelect }, masterCategory: { select: { id: true, name: true } } },
  });
}

async function updateCategory(id, data) {
  const existing = await prisma.tmsCategory.findUnique({ where: { id } });
  if (!existing) throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);

  if (data.name) {
    const dup = await prisma.tmsCategory.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        masterCategoryId: existing.masterCategoryId,
        id: { not: id },
      },
    });
    if (dup) throw new Error(ERROR_MESSAGES.DUPLICATE_CATEGORY);
  }

  const resolvedEmployeeId = data.employeeId !== undefined ? await resolveEmployeeId(data.employeeId) : undefined;

  return prisma.tmsCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(resolvedEmployeeId !== undefined && { employeeId: resolvedEmployeeId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    include: { employee: { select: employeeSelect }, masterCategory: { select: { id: true, name: true } } },
  });
}

async function deleteCategory(id) {
  const existing = await prisma.tmsCategory.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!existing) throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
  if (existing._count.tickets > 0) {
    throw new Error('Cannot delete category with existing tickets. Deactivate instead.');
  }

  await prisma.tmsCategory.delete({ where: { id } });
}

// =============================================
// Sub-Categories
// =============================================

async function createSubCategory(data) {
  const category = await prisma.tmsCategory.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);

  const existing = await prisma.tmsSubCategory.findFirst({
    where: {
      name: { equals: data.name, mode: 'insensitive' },
      categoryId: data.categoryId,
    },
  });
  if (existing) throw new Error(ERROR_MESSAGES.DUPLICATE_CATEGORY);

  const resolvedEmployeeId = await resolveEmployeeId(data.employeeId);

  return prisma.tmsSubCategory.create({
    data: {
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId,
      employeeId: resolvedEmployeeId,
      priority: data.priority || 'medium',
      slaHours: data.slaHours != null ? parseInt(data.slaHours, 10) : 48,
      sortOrder: data.sortOrder || 0,
    },
    include: { employee: { select: employeeSelect }, category: { select: { id: true, name: true, masterCategory: { select: { id: true, name: true } } } } },
  });
}

async function updateSubCategory(id, data) {
  const existing = await prisma.tmsSubCategory.findUnique({ where: { id } });
  if (!existing) throw new Error(ERROR_MESSAGES.SUB_CATEGORY_NOT_FOUND);

  if (data.name) {
    const dup = await prisma.tmsSubCategory.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        categoryId: existing.categoryId,
        id: { not: id },
      },
    });
    if (dup) throw new Error(ERROR_MESSAGES.DUPLICATE_CATEGORY);
  }

  const resolvedEmployeeId = data.employeeId !== undefined ? await resolveEmployeeId(data.employeeId) : undefined;

  return prisma.tmsSubCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(resolvedEmployeeId !== undefined && { employeeId: resolvedEmployeeId }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.slaHours !== undefined && { slaHours: parseInt(data.slaHours, 10) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    include: { employee: { select: employeeSelect }, category: { select: { id: true, name: true, masterCategory: { select: { id: true, name: true } } } } },
  });
}

async function deleteSubCategory(id) {
  const existing = await prisma.tmsSubCategory.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!existing) throw new Error(ERROR_MESSAGES.SUB_CATEGORY_NOT_FOUND);
  if (existing._count.tickets > 0) {
    throw new Error('Cannot delete sub-category with existing tickets. Deactivate instead.');
  }

  await prisma.tmsSubCategory.delete({ where: { id } });
}

// =============================================
// Role Handlers (Registrar, Dean, VC)
// =============================================

const ROLE_HANDLER_LEVELS = ['registrar', 'dean_academics', 'vice_chancellor'];

async function listRoleHandlers() {
  return prisma.tmsRoleHandler.findMany({
    include: {
      employee: {
        select: employeeSelect,
      },
    },
    orderBy: { role: 'asc' },
  });
}

async function upsertRoleHandler(role, employeeUid) {
  if (!ROLE_HANDLER_LEVELS.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${ROLE_HANDLER_LEVELS.join(', ')}`);
  }

  const resolvedId = await resolveEmployeeId(employeeUid);
  if (!resolvedId) throw new Error('Employee ID is required');

  // Use findFirst + create/update instead of upsert to avoid Prisma named unique constraint issues
  const existing = await prisma.tmsRoleHandler.findFirst({ where: { role } });

  if (existing) {
    return prisma.tmsRoleHandler.update({
      where: { id: existing.id },
      data: { employeeId: resolvedId, isActive: true },
      include: { employee: { select: employeeSelect } },
    });
  }

  return prisma.tmsRoleHandler.create({
    data: { role, employeeId: resolvedId },
    include: { employee: { select: employeeSelect } },
  });
}

async function deleteRoleHandler(role) {
  if (!ROLE_HANDLER_LEVELS.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${ROLE_HANDLER_LEVELS.join(', ')}`);
  }
  await prisma.tmsRoleHandler.deleteMany({ where: { role } });
}

/**
 * Get the employee ID for a given escalation role from the TmsRoleHandler table.
 * Used by the escalation service.
 */
async function getHandlerForRole(role) {
  const handler = await prisma.tmsRoleHandler.findFirst({
    where: { role },
    select: { employeeId: true, isActive: true },
  });
  return handler?.isActive ? handler.employeeId : null;
}

module.exports = {
  listMasterCategories,
  createMasterCategory,
  updateMasterCategory,
  deleteMasterCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  listRoleHandlers,
  upsertRoleHandler,
  deleteRoleHandler,
  getHandlerForRole,
};
