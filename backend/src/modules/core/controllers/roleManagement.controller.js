const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const {
  getSchoolDeptPermissions,
  getAllCentralDeptPermissions,
} = require('../config/permissionDefinitions');
const { getIp } = require('../../../shared/utils/auditLogger');
const { auditService } = require('../../audit/services/audit.service');

/**
 * Get all available permission definitions for role creation
 */
exports.getPermissionDefinitionsForRole = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        schoolDepartments: getSchoolDeptPermissions(),
        centralDepartments: getAllCentralDeptPermissions(),
      },
    });
  } catch (error) {
    console.error('Get permission definitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission definitions',
    });
  }
};

/**
 * Create a new role (permission template)
 */
exports.createRole = async (req, res) => {
  try {
    const { roleCode, name, description, departmentType, permissions, requiresDepartmentAssignment } = req.body;

    console.log('Create role request body:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!roleCode) {
      return res.status(400).json({
        success: false,
        message: 'Role code is required',
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
      });
    }

    // Check if role code already exists
    const existingRoleByCode = await prisma.role.findUnique({
      where: { roleCode },
    });

    if (existingRoleByCode) {
      return res.status(400).json({
        success: false,
        message: 'A role with this code already exists',
      });
    }

    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'A role with this name already exists',
      });
    }

    // Check for duplicate permission sets across all roles
    if (permissions) {
      // Get all active roles that could have conflicting permissions
      const allRoles = await prisma.role.findMany({
        where: {
          isActive: true,
        },
      });

      // Helper function to check if two permission sets are identical
      const arePermissionSetsEqual = (perms1, perms2) => {
        const keys1 = Object.keys(perms1 || {}).filter(k => perms1[k]).sort();
        const keys2 = Object.keys(perms2 || {}).filter(k => perms2[k]).sort();
        return JSON.stringify(keys1) === JSON.stringify(keys2);
      };

      // For central departments, check against ALL roles that have central permissions
      if (permissions.centralDeptPermissions) {
        for (const role of allRoles) {
          // Check if the role has central permissions (CENTRAL or BOTH department types)
          if (role.permissions?.centralDeptPermissions && 
              (role.departmentType === 'CENTRAL' || role.departmentType === 'BOTH')) {
            if (arePermissionSetsEqual(permissions.centralDeptPermissions, role.permissions.centralDeptPermissions)) {
              return res.status(400).json({
                success: false,
                message: `A role with the exact same central department permission set already exists: "${role.name}" (${role.roleCode})`,
              });
            }
          }
        }
      }

      // For school departments, check against ALL roles that have school permissions
      if (permissions.schoolDeptPermissions) {
        for (const role of allRoles) {
          // Check if the role has school permissions (SCHOOL or BOTH department types)
          if (role.permissions?.schoolDeptPermissions && 
              (role.departmentType === 'SCHOOL' || role.departmentType === 'BOTH')) {
            if (arePermissionSetsEqual(permissions.schoolDeptPermissions, role.permissions.schoolDeptPermissions)) {
              return res.status(400).json({
                success: false,
                message: `A role with the exact same school department permission set already exists: "${role.name}" (${role.roleCode})`,
              });
            }
          }
        }
      }
    }

    // Create the role
    const role = await prisma.role.create({
      data: {
        roleCode,
        name,
        description: description || null,
        departmentType: departmentType || 'BOTH',
        permissions: permissions || {},
        requiresDepartmentAssignment: requiresDepartmentAssignment !== false,
        createdBy: req.user?.id || null,
        isActive: true,
      },
    });

    // Log audit event
    await auditService.log({
      actorId: req.user?.id,
      action: `Created role: ${name} (${roleCode})`,
      actionType: 'CREATE',
      module: 'admin',
      category: 'role_management',
      targetTable: 'role',
      targetId: role.id,
      details: { roleCode, roleName: name, departmentType, requiresDepartmentAssignment },
      ipAddress: getIp(req),
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role,
    });
  } catch (error) {
    console.error('Create role error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Get all roles
 */
exports.getAllRoles = async (req, res) => {
  try {
    const { isActive, departmentType } = req.query;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (departmentType) {
      where.departmentType = departmentType;
    }

    const roles = await prisma.role.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
    });
  }
};

/**
 * Get a single role by ID
 */
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role',
    });
  }
};

/**
 * Update a role
 */
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, departmentType, permissions, requiresDepartmentAssignment, isActive } = req.body;

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // Check if new name conflicts with existing role (if name is being changed)
    if (name && name !== existingRole.name) {
      const nameConflict = await prisma.role.findUnique({
        where: { name },
      });
      if (nameConflict) {
        return res.status(400).json({
          success: false,
          message: 'A role with this name already exists',
        });
      }
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (departmentType !== undefined) updateData.departmentType = departmentType;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (requiresDepartmentAssignment !== undefined) updateData.requiresDepartmentAssignment = requiresDepartmentAssignment;
    if (isActive !== undefined) updateData.isActive = isActive;

    const role = await prisma.role.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await auditService.log({
      actorId: req.user?.id,
      action: `Updated role: ${role.name}`,
      actionType: 'UPDATE',
      module: 'admin',
      category: 'role_management',
      targetTable: 'role',
      targetId: role.id,
      oldValues: existingRole,
      newValues: role,
      details: { roleName: role.name, changes: Object.keys(updateData) },
      ipAddress: getIp(req),
      userAgent: req.get('user-agent'),
    });

    // Invalidate cache for all users who have this role assigned
    try {
      const usersWithRole = await prisma.userLogin.findMany({
        where: { assignedRoleIds: { array_contains: id } },
        select: { id: true },
      });
      await Promise.all(usersWithRole.map(u => cache.invalidateUser(u.id)));
    } catch (cacheErr) {
      console.error('Cache invalidation error (updateRole):', cacheErr);
    }

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: role,
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message,
    });
  }
};

/**
 * Delete a role
 */
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    await prisma.role.delete({
      where: { id },
    });

    // Log audit event
    await auditService.log({
      actorId: req.user?.id,
      action: `Deleted role: ${role.name}`,
      actionType: 'DELETE',
      module: 'admin',
      category: 'role_management',
      targetTable: 'role',
      targetId: id,
      details: { roleName: role.name },
      ipAddress: getIp(req),
      userAgent: req.get('user-agent'),
    });

    // Invalidate cache for all users who had this role assigned
    try {
      const usersWithRole = await prisma.userLogin.findMany({
        where: { assignedRoleIds: { array_contains: id } },
        select: { id: true },
      });
      await Promise.all(usersWithRole.map(u => cache.invalidateUser(u.id)));
    } catch (cacheErr) {
      console.error('Cache invalidation error (deleteRole):', cacheErr);
    }

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
    });
  }
};

/**
 * Apply role permissions to a user
 * This copies the role's permissions to the user's permission records
 */
exports.applyRoleToUser = async (req, res) => {
  try {
    const { userId, roleId, departmentId, centralDeptId, isPrimary } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Role ID are required',
      });
    }

    // Get the role
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    if (!role.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply inactive role',
      });
    }

    // Get role permissions
    const rolePermissions = role.permissions || {};
    const results = { schoolDept: null, centralDept: null };

    // Apply school department permissions if provided
    if (departmentId && rolePermissions.schoolDeptPermissions) {
      const existingPerm = await prisma.departmentPermission.findUnique({
        where: {
          userId_departmentId: { userId, departmentId },
        },
      });

      if (existingPerm) {
        // Update existing permissions
        results.schoolDept = await prisma.departmentPermission.update({
          where: { id: existingPerm.id },
          data: {
            permissions: rolePermissions.schoolDeptPermissions,
            isPrimary: isPrimary || false,
            assignedBy: req.user?.id,
          },
        });
      } else {
        // Create new permissions
        results.schoolDept = await prisma.departmentPermission.create({
          data: {
            userId,
            departmentId,
            permissions: rolePermissions.schoolDeptPermissions,
            isPrimary: isPrimary || false,
            isActive: true,
            assignedBy: req.user?.id,
          },
        });
      }

      // If this is primary, unset other primaries
      if (isPrimary) {
        await prisma.departmentPermission.updateMany({
          where: {
            userId,
            departmentId: { not: departmentId },
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }
    }

    // Apply central department permissions if provided
    if (centralDeptId && rolePermissions.centralDeptPermissions) {
      const existingPerm = await prisma.centralDepartmentPermission.findUnique({
        where: {
          userId_centralDeptId: { userId, centralDeptId },
        },
      });

      if (existingPerm) {
        // Update existing permissions
        results.centralDept = await prisma.centralDepartmentPermission.update({
          where: { id: existingPerm.id },
          data: {
            permissions: rolePermissions.centralDeptPermissions,
            isPrimary: isPrimary || false,
            assignedBy: req.user?.id,
          },
        });
      } else {
        // Create new permissions
        results.centralDept = await prisma.centralDepartmentPermission.create({
          data: {
            userId,
            centralDeptId,
            permissions: rolePermissions.centralDeptPermissions,
            isPrimary: isPrimary || false,
            isActive: true,
            assignedBy: req.user?.id,
          },
        });
      }

      // If this is primary, unset other primaries
      if (isPrimary) {
        await prisma.centralDepartmentPermission.updateMany({
          where: {
            userId,
            centralDeptId: { not: centralDeptId },
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }
    }

    // Log audit event
    await auditService.log({
      actorId: req.user?.id,
      action: `Applied role "${role.name}" to user`,
      actionType: 'PERMISSION_CHANGE',
      module: 'admin',
      category: 'role_management',
      targetTable: 'user_login',
      targetId: userId,
      details: {
        roleName: role.name,
        roleId,
        departmentId,
        centralDeptId,
        isPrimary,
      },
      ipAddress: getIp(req),
      userAgent: req.get('user-agent'),
    });

    // Invalidate user cache so applied role permissions take effect immediately
    await cache.invalidateUser(userId);

    res.json({
      success: true,
      message: `Role "${role.name}" applied successfully`,
      data: results,
    });
  } catch (error) {
    console.error('Apply role to user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply role to user',
      error: error.message,
    });
  }
};

/**
 * Get role permissions as a template (without applying)
 * Useful for previewing what permissions a role contains
 */
exports.getRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        departmentType: true,
        permissions: true,
        requiresDepartmentAssignment: true,
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role permissions',
    });
  }
};

/**
 * Duplicate an existing role
 */
exports.duplicateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({
        success: false,
        message: 'New role name is required',
      });
    }

    // Get the source role
    const sourceRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!sourceRole) {
      return res.status(404).json({
        success: false,
        message: 'Source role not found',
      });
    }

    // Check if new name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: newName },
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'A role with this name already exists',
      });
    }

    // Create duplicate role
    const newRole = await prisma.role.create({
      data: {
        name: newName,
        description: sourceRole.description ? `Copy of: ${sourceRole.description}` : `Copy of ${sourceRole.name}`,
        departmentType: sourceRole.departmentType,
        permissions: sourceRole.permissions,
        requiresDepartmentAssignment: sourceRole.requiresDepartmentAssignment,
        createdBy: req.user?.id,
        isActive: true,
      },
    });

    // Log audit event
    await auditService.log({
      actorId: req.user?.id,
      action: `Duplicated role "${sourceRole.name}" as "${newName}"`,
      actionType: 'CREATE',
      module: 'admin',
      category: 'role_management',
      targetTable: 'role',
      targetId: newRole.id,
      details: { sourceRoleId: id, sourceRoleName: sourceRole.name, newRoleName: newName },
      ipAddress: getIp(req),
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Role duplicated successfully',
      data: newRole,
    });
  } catch (error) {
    console.error('Duplicate role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate role',
      error: error.message,
    });
  }
};
