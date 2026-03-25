/**
 * Auth Service
 * Contains all authentication business logic extracted from auth.controller.js
 * Zero business logic changes — only moved from controller to service.
 */

const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');
const { prewarmAuthCache } = require('../../../shared/utils/authCache');
const { sanitizeInput } = require('../../../shared/utils/validators');
const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../audit/services/audit.service');
const { getClientIp } = require('../../../shared/middleware/audit.middleware');
const log = require('../../../shared/utils/logger');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire
  });
};

/**
 * Build cookie options based on request origin
 */
const buildCookieOptions = (req, expiresMs) => {
  const origin = req.headers.origin || '';
  const isSecureOrigin = config.env === 'production' || origin.startsWith('https://');
  return {
    expires: new Date(Date.now() + expiresMs),
    httpOnly: true,
    sameSite: isSecureOrigin ? 'none' : 'lax',
    secure: isSecureOrigin,
  };
};

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
 * Login user
 * @returns {{ token, userDetails, cookieOptions }}
 */
const login = async (username, password, req) => {
  if (!username || !password) {
    return { error: 'Please provide username and password', status: 400 };
  }

  const sanitizedUsername = sanitizeInput(username);

  // OPTIMIZED: Lean login query - only essential fields to reduce load time
  const user = await prisma.userLogin.findFirst({
    where: { uid: sanitizedUsername },
    select: {
      id: true,
      uid: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      profileImage: true,
      lastLoginAt: true,
      employeeDetails: {
        select: {
          empId: true,
          displayName: true,
          designation: true,
          phoneNumber: true,
          email: true,
          primaryDepartmentId: true,
          primaryCentralDeptId: true,
          primaryDepartment: {
            select: {
              id: true,
              departmentName: true,
              departmentCode: true,
              facultyId: true,
            }
          },
          primaryCentralDept: {
            select: {
              id: true,
              departmentName: true,
            }
          }
        }
      },
      studentLogin: {
        select: {
          studentId: true,
          registrationNo: true,
          displayName: true,
          currentSemester: true,
          programId: true,
          sectionId: true,
        }
      },
    }
  });

  if (!user) {
    return { error: 'Invalid credentials', status: 401 };
  }

  if (user.status !== 'active') {
    return { error: 'Account is deactivated', status: 403 };
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return { error: 'Invalid credentials', status: 401 };
  }

  // PERF: Run lastLoginAt update + permissions query in parallel
  const [, departmentPermissions] = await Promise.all([
    prisma.userLogin.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }),
    prisma.departmentPermission.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        departmentId: true,
        permissions: true,
        isPrimary: true
      }
    }),
  ]);

  // Prepare user details (match frontend User interface)
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
    permissions: departmentPermissions || []
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
      designation: user.employeeDetails.designation ? {
        name: user.employeeDetails.designation
      } : null
    };
  }

  if (user.studentLogin) {
    userDetails.firstName = user.studentLogin.firstName;
    userDetails.lastName = user.studentLogin.lastName;
    userDetails.student = {
      studentId: user.studentLogin.studentId,
      registrationNo: user.studentLogin.registrationNo,
      program: user.studentLogin.section?.program?.programName,
      semester: user.studentLogin.currentSemester,
      displayName: user.studentLogin.displayName
    };
  }

  const token = generateToken(user.id);

  // Pre-warm auth cache so first request after login doesn't hit DB
  prewarmAuthCache(user.id).catch(() => {});

  const cookieOptions = buildCookieOptions(req, config.jwt.cookieExpire * 24 * 60 * 60 * 1000);

  // PERF: Fire-and-forget audit log — don't block the response
  auditService.log({
    actorId: user.id,
    action: 'User logged in successfully',
    actionType: AuditActionType.LOGIN,
    module: AuditModule.AUTH,
    category: 'authentication',
    severity: AuditSeverity.INFO,
    targetTable: 'user_login',
    targetId: user.id,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    requestPath: req.originalUrl || req.url,
    requestMethod: 'POST',
    responseStatus: 200,
    metadata: {
      username: user.uid,
      role: user.role
    }
  }).catch(e => log.warn('Audit log (login) failed:', e.message));

  return { token, userDetails, cookieOptions };
};

/**
 * Logout user
 */
const logout = async (userId, req) => {
  const cookieOptions = buildCookieOptions(req, 1000);

  // PERF: Fire-and-forget audit log
  auditService.log({
    actorId: userId,
    action: 'User logged out',
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

  return { cookieOptions };
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

  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters', status: 400 };
  }

  const user = await prisma.userLogin.findUnique({
    where: { id: userId }
  });

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return { error: 'Current password is incorrect', status: 401 };
  }

  const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.rounds);

  await prisma.userLogin.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword }
  });

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

  return { success: true };
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
    settings = await prisma.userSettings.create({
      data: {
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
    showTips
  } = fields;

  let settings = await prisma.userSettings.findUnique({
    where: { userId }
  });

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

  if (settings) {
    settings = await prisma.userSettings.update({
      where: { userId },
      data: updateData
    });
  } else {
    settings = await prisma.userSettings.create({
      data: {
        userId,
        ...updateData
      }
    });
  }

  return settings;
};

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
  updateProfile,
  getSettings,
  updateSettings,
};
