const prisma = require('../../../shared/config/database');

// Get user's department permissions
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check authorization
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these permissions'
      });
    }

    const permissions = await prisma.userDepartmentPermission.findMany({
      where: { userId },
      include: {
        assignedByUser: {
          select: {
            uid: true,
            email: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching permissions'
    });
  }
};

// Grant department permissions (admin only)
exports.grantPermissions = async (req, res) => {
  try {
    const { userId, department, permissions } = req.body;

    if (!userId || !department || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId, department, and permissions'
      });
    }

    // Only admin can grant permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to grant permissions'
      });
    }

    // Upsert permission
    const permission = await prisma.userDepartmentPermission.upsert({
      where: {
        userId_department: {
          userId,
          department
        }
      },
      update: {
        permissions,
        isActive: true,
        assignedBy: req.user.id,
        assignedAt: new Date()
      },
      create: {
        userId,
        department,
        permissions,
        isActive: true,
        assignedBy: req.user.id
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actor: { connect: { id: req.user.id } },
        action: 'GRANT_PERMISSIONS',
        targetTable: 'user_department_permission',
        targetId: permission.id,
        details: { userId, department, permissions }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Permissions granted successfully',
      data: permission
    });
  } catch (error) {
    console.error('Grant permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error granting permissions'
    });
  }
};

// Revoke department permissions (admin only)
exports.revokePermissions = async (req, res) => {
  try {
    const { userId, department } = req.body;

    if (!userId || !department) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId and department'
      });
    }

    // Only admin can revoke permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke permissions'
      });
    }

    await prisma.userDepartmentPermission.update({
      where: {
        userId_department: {
          userId,
          department
        }
      },
      data: {
        isActive: false
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actor: { connect: { id: req.user.id } },
        action: 'REVOKE_PERMISSIONS',
        targetTable: 'user_department_permission',
        details: { userId, department }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Permissions revoked successfully'
    });
  } catch (error) {
    console.error('Revoke permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error revoking permissions'
    });
  }
};

// Check if user has specific permission
exports.checkPermission = async (req, res) => {
  try {
    const { department, permissionKey } = req.query;

    if (!department || !permissionKey) {
      return res.status(400).json({
        success: false,
        message: 'Please provide department and permissionKey'
      });
    }

    const permission = await prisma.userDepartmentPermission.findUnique({
      where: {
        userId_department: {
          userId: req.user.id,
          department
        }
      }
    });

    const hasPermission = permission && 
                          permission.isActive && 
                          permission.permissions && 
                          permission.permissions[permissionKey] === true;

    res.status(200).json({
      success: true,
      hasPermission
    });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking permission'
    });
  }
};
