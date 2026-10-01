/**
 * Auth Service
 * Contains all authentication business logic extracted from auth.controller.js
 * Zero business logic changes — only moved from controller to service.
 */

const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');
const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../audit/services/audit.service');
const { getClientIp } = require('../../../shared/middleware/audit.middleware');
const log = require('../../../shared/utils/logger');
const { checkNewPassword } = require('../utils/passwordPolicy');
const { REVOKE_SESSIONS_DATA } = require('./session.service');

/**
 * Format employee department/school info for response
 */
const formatDepartmentInfo = (employeeDetails) => {
  let departmentInfo = null;
  let schoolInfo = null;

  if (employeeDetails.primarySchool) {
    schoolInfo = {
      id: employeeDetails.primarySchool.id,
      name: employeeDetails.primarySchool.facultyName
    };
  } else if (employeeDetails.primaryDepartment?.faculty) {
    schoolInfo = {
      id: employeeDetails.primaryDepartment.faculty.id,
      name: employeeDetails.primaryDepartment.faculty.facultyName
    };
  }

  if (employeeDetails.primaryDepartment) {
    departmentInfo = {
      id: employeeDetails.primaryDepartment.id,
      name: employeeDetails.primaryDepartment.departmentName,
      school: schoolInfo
    };
  } else if (employeeDetails.primaryCentralDept) {
    departmentInfo = {
      id: employeeDetails.primaryCentralDept.id,
      name: employeeDetails.primaryCentralDept.departmentName,
      school: {
        id: employeeDetails.primaryCentralDept.id,
        name: 'Central Department'
      }
    };
  } else if (schoolInfo) {
    departmentInfo = {
      id: null,
      name: 'Not Assigned',
      school: schoolInfo
    };
  }

  return departmentInfo;
};

/**
 * Logout user (audit only; the controller clears the auth cookie).
 * @param {{ allDevices?: boolean }} [options]
 */
const logout = async (userId, req, { allDevices = false } = {}) => {
  // PERF: Fire-and-forget audit log
  auditService.log({
    actorId: userId,
    action: allDevices ? 'User logged out from all devices' : 'User logged out',
    actionType: AuditActionType.LOGOUT,
    module: AuditModule.AUTH,
    category: 'authentication',
    severity: AuditSeverity.INFO,
    targetTable: 'user_login',
    targetId: userId,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    requestPath: req.originalUrl || req.url,
    requestMethod: 'POST',
    responseStatus: 200
  }).catch(e => log.warn('Audit log (logout) failed:', e.message));

  return { success: true };
};

/**
 * Get current user profile (cached)
 */
const getMe = async (userId) => {
  const cacheKey = `${cache.CACHE_KEYS.USER}profile:${userId}`;

  const { data: cachedData, fromCache } = await cache.getOrSet(
    cacheKey,
    async () => {
      // OPTIMIZED: Parallel queries instead of deep includes
      const [user, permissions, studentProgram] = await Promise.all([
        prisma.userLogin.findUnique({
          where: { id: userId },
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            profileImage: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                designation: true,
                displayName: true,
                phoneNumber: true,
                email: true,
                joinDate: true,
                primarySchoolId: true,
                primaryDepartmentId: true,
                primaryCentralDeptId: true,
                primarySchool: {
                  select: { id: true, facultyName: true }
                },
                primaryDepartment: {
                  select: {
                    id: true,
                    departmentName: true,
                    faculty: {
                      select: { id: true, facultyName: true }
                    }
                  }
                },
                primaryCentralDept: {
                  select: { id: true, departmentName: true }
                }
              }
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                studentId: true,
                registrationNo: true,
                currentSemester: true,
                displayName: true,
                programId: true
              }
            }
          }
        }),
        prisma.departmentPermission.findMany({
          where: { userId, isActive: true },
          select: { departmentId: true, permissions: true }
        }),
        prisma.studentDetails.findUnique({
          where: { userLoginId: userId },
          select: {
            program: {
              select: { programName: true }
            }
          }
        }).catch(() => null)
      ]);

      if (!user) return null;

      const userDetails = {
        id: user.id,
        username: user.uid,
        email: user.email,
        userType: user.role,
        firstName: null,
        lastName: null,
        uid: user.uid,
        role: {
          name: user.role,
          displayName: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : null
        },
        profileImage: user.profileImage,
        permissions: permissions || []
      };

      if (user.employeeDetails) {
        userDetails.firstName = user.employeeDetails.firstName;
        userDetails.lastName = user.employeeDetails.lastName;
        userDetails.employee = {
          empId: user.employeeDetails.empId,
          designation: user.employeeDetails.designation,
          displayName: user.employeeDetails.displayName
        };

        const departmentInfo = formatDepartmentInfo(user.employeeDetails);

        userDetails.employeeDetails = {
          employeeId: user.employeeDetails.empId,
          phone: user.employeeDetails.phoneNumber,
          email: user.employeeDetails.email,
          joiningDate: user.employeeDetails.joinDate,
          department: departmentInfo,
          designation: user.employeeDetails.designation ? { name: user.employeeDetails.designation } : null
        };
      }

      if (user.studentLogin) {
        userDetails.firstName = user.studentLogin.firstName;
        userDetails.lastName = user.studentLogin.lastName;
        userDetails.student = {
          studentId: user.studentLogin.studentId,
          registrationNo: user.studentLogin.registrationNo,
          program: studentProgram?.program?.programName,
          semester: user.studentLogin.currentSemester,
          displayName: user.studentLogin.displayName
        };
      }

      return userDetails;
    },
    cache.CACHE_TTL.USER_PROFILE
  );

  return { data: cachedData, fromCache };
};

/**
 * Change password
 */
const changePassword = async (userId, currentPassword, newPassword, req) => {
  if (!currentPassword || !newPassword) {
    return { error: 'Please provide current and new password', status: 400 };
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return { error: 'Please provide current and new password', status: 400 };
  }

  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: { id: true, uid: true, email: true, passwordHash: true }
  });
  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    // 400, not 401: a wrong current password must not look like an expired session
    return { error: 'Current password is incorrect', status: 400 };
  }

  const policyError = await checkNewPassword(newPassword, user);
  if (policyError) {
    return { error: policyError, status: 400 };
  }

  const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.rounds);

  // Changing the password revokes every existing session (tokenVersion++)
  const updated = await prisma.userLogin.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword, passwordChangedAt: new Date(), ...REVOKE_SESSIONS_DATA },
    select: { id: true, universityId: true, role: true, tokenVersion: true }
  });
  await cache.invalidateUser(userId);

  await auditService.log({
    actorId: userId,
    action: 'Password changed successfully',
    actionType: AuditActionType.UPDATE,
    module: AuditModule.AUTH,
    category: 'security',
    severity: AuditSeverity.INFO,
    targetTable: 'user_login',
    targetId: userId,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    requestPath: req.originalUrl || req.url,
    requestMethod: 'PUT',
    responseStatus: 200
  });

  return { success: true, user: updated };
};

/**
 * Update profile
 */
const updateProfile = async (userId, { firstName, lastName, phone, email }, req) => {
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: { employeeDetails: true }
  });

  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  // Update UserLogin email if provided and different
  if (email && email !== user.email) {
    const existingEmail = await prisma.userLogin.findFirst({
      where: { email, id: { not: userId } }
    });
    if (existingEmail) {
      return { error: 'Email already in use', status: 400 };
    }
    await prisma.userLogin.update({
      where: { id: userId },
      data: { email }
    });
  }

  // Update employee details if user has them
  if (user.employeeDetails) {
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phoneNumber = phone;

    if (firstName || lastName) {
      updateData.displayName = `${firstName || user.employeeDetails.firstName} ${lastName || user.employeeDetails.lastName}`.trim();
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.employeeDetails.update({
        where: { id: user.employeeDetails.id },
        data: updateData
      });
    }
  }

  // Audit log
  await auditService.log({
    actorId: userId,
    action: 'Profile updated successfully',
    actionType: AuditActionType.UPDATE,
    module: AuditModule.USER,
    category: 'profile',
    severity: AuditSeverity.INFO,
    targetTable: 'user_login',
    targetId: userId,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    requestPath: req.originalUrl || req.url,
    requestMethod: 'PUT',
    responseStatus: 200,
    metadata: { firstName, lastName, phone, email }
  });

  // Fetch updated user
  const updatedUser = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: {
      employeeDetails: {
        include: {
          primaryDepartment: {
            include: { faculty: true }
          },
          primarySchool: true
        }
      }
    }
  });

  // Format response
  const userDetails = {
    id: updatedUser.id,
    username: updatedUser.uid,
    email: updatedUser.email,
    userType: updatedUser.role,
    firstName: updatedUser.employeeDetails?.firstName || null,
    lastName: updatedUser.employeeDetails?.lastName || null,
    uid: updatedUser.uid,
    role: {
      name: updatedUser.role,
      displayName: updatedUser.role ? updatedUser.role.charAt(0).toUpperCase() + updatedUser.role.slice(1) : null
    },
    employeeDetails: updatedUser.employeeDetails ? {
      id: updatedUser.employeeDetails.id,
      employeeId: updatedUser.employeeDetails.empId,
      phone: updatedUser.employeeDetails.phoneNumber,
      email: updatedUser.employeeDetails.email,
      joiningDate: updatedUser.employeeDetails.joinDate,
      department: updatedUser.employeeDetails.primaryDepartment ? {
        id: updatedUser.employeeDetails.primaryDepartment.id,
        name: updatedUser.employeeDetails.primaryDepartment.departmentName,
        code: updatedUser.employeeDetails.primaryDepartment.departmentCode,
        school: updatedUser.employeeDetails.primaryDepartment.faculty ? {
          id: updatedUser.employeeDetails.primaryDepartment.faculty.id,
          name: updatedUser.employeeDetails.primaryDepartment.faculty.facultyName,
          code: updatedUser.employeeDetails.primaryDepartment.faculty.facultyCode
        } : null
      } : null,
      designation: updatedUser.employeeDetails.designation ? {
        name: updatedUser.employeeDetails.designation
      } : null
    } : null
  };

  return { userDetails };
};

/**
 * Get user settings
 */
const getSettings = async (userId) => {
  let settings = await prisma.userSettings.findUnique({
    where: { userId }
  });

  if (!settings) {
    // Upsert so concurrent first requests do not race on the unique userId.
    settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        emailNotifications: true,
        pushNotifications: true,
        iprUpdates: true,
        taskReminders: true,
        systemAlerts: true,
        weeklyDigest: false,
        theme: 'light',
        language: 'en',
        compactView: false,
        showTips: true
      }
    });
  }

  return settings;
};

/**
 * Update user settings
 */
const updateSettings = async (userId, fields) => {
  const {
    emailNotifications,
    pushNotifications,
    iprUpdates,
    taskReminders,
    systemAlerts,
    weeklyDigest,
    theme,
    language,
    compactView,
    showTips,
    affiliationOverride,
  } = fields;

  const updateData = {};
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
  if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
  if (iprUpdates !== undefined) updateData.iprUpdates = iprUpdates;
  if (taskReminders !== undefined) updateData.taskReminders = taskReminders;
  if (systemAlerts !== undefined) updateData.systemAlerts = systemAlerts;
  if (weeklyDigest !== undefined) updateData.weeklyDigest = weeklyDigest;
  if (theme !== undefined) updateData.theme = theme;
  if (language !== undefined) updateData.language = language;
  if (compactView !== undefined) updateData.compactView = compactView;
  if (showTips !== undefined) updateData.showTips = showTips;
  // Empty string clears the override so the UI falls back to the
  // affiliation engine's auto-suggested name.
  if (affiliationOverride !== undefined) {
    updateData.affiliationOverride = affiliationOverride === null || affiliationOverride === ''
      ? null
      : String(affiliationOverride).slice(0, 256);
  }

  // Upsert: a concurrent GET /settings may create the row between the lookup and this write.
  return prisma.userSettings.upsert({
    where: { userId },
    update: updateData,
    create: { userId, ...updateData }
  });
};

module.exports = {
  logout,
  getMe,
  changePassword,
  updateProfile,
  getSettings,
  updateSettings,
};
