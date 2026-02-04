const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');
const { isValidEmail, sanitizeInput } = require('../../../shared/utils/validators');
const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../audit/services/audit.service');
const { getClientIp } = require('../../../shared/middleware/audit.middleware');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire
  });
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    const sanitizedUsername = sanitizeInput(username);

    // OPTIMIZED: Lean login query - only essential fields to reduce load time
    const user = await prisma.userLogin.findFirst({
      where: {
        uid: sanitizedUsername
      },
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
            primarySchoolId: true,
            primaryCentralDeptId: true,
            primaryDepartment: {
              select: {
                id: true,
                departmentName: true,
                departmentCode: true,
                facultyId: true,
              }
            },
            primarySchool: {
              select: {
                id: true,
                facultyName: true,
                facultyCode: true,
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
        // Load permissions separately below for better performance
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await prisma.userLogin.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // OPTIMIZATION: Load permissions separately (lazy loading)
    const departmentPermissions = await prisma.departmentPermission.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        departmentId: true,
        permissions: true,
        isPrimary: true
      }
    });

    // Prepare user details (match frontend User interface)
    const userDetails = {
      id: user.id,
      username: user.uid,
      email: user.email,
      userType: user.role, // Keep faculty/staff distinction
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
      
      // Determine school/department display (same logic as /auth/me)
      let departmentInfo = null;
      let schoolInfo = null;
      
      // Priority: Use primarySchool if directly assigned
      if (user.employeeDetails.primarySchool) {
        schoolInfo = {
          id: user.employeeDetails.primarySchool.id,
          name: user.employeeDetails.primarySchool.facultyName
        };
      }
      // Otherwise, use school from department if department exists
      else if (user.employeeDetails.primaryDepartment?.faculty) {
        schoolInfo = {
          id: user.employeeDetails.primaryDepartment.faculty.id,
          name: user.employeeDetails.primaryDepartment.faculty.facultyName
        };
      }
      
      // Set department info if exists
      if (user.employeeDetails.primaryDepartment) {
        departmentInfo = {
          id: user.employeeDetails.primaryDepartment.id,
          name: user.employeeDetails.primaryDepartment.departmentName,
          school: schoolInfo
        };
      }
      // If no department but has central department, create a special structure
      else if (user.employeeDetails.primaryCentralDept) {
        departmentInfo = {
          id: user.employeeDetails.primaryCentralDept.id,
          name: user.employeeDetails.primaryCentralDept.departmentName,
          school: {
            id: user.employeeDetails.primaryCentralDept.id,
            name: 'Central Department'
          }
        };
      }
      // If only school, no department
      else if (schoolInfo) {
        departmentInfo = {
          id: null,
          name: 'Not Assigned',
          school: schoolInfo
        };
      }
      
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

    // Generate token
    const token = generateToken(user.id);

    // Set cookie with appropriate sameSite setting for cross-origin
    // sameSite: 'none' REQUIRES secure: true for cross-origin cookies
    const cookieOptions = {
      expires: new Date(Date.now() + config.jwt.cookieExpire * 24 * 60 * 60 * 1000),
      httpOnly: true,
      sameSite: config.env === 'production' ? 'none' : 'lax',
      secure: config.env === 'production' ? true : false, // Must be true when sameSite is 'none'
    };
    
    res.cookie('token', token, cookieOptions);

    // Audit log with full details
    await auditService.log({
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
    });

    res.status(200).json({
      success: true,
      token,
      user: userDetails
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    // Clear cookie with same options as login
    const cookieOptions = {
      expires: new Date(Date.now() + 1000),
      httpOnly: true,
      sameSite: config.env === 'production' ? 'none' : 'lax',
      secure: config.env === 'production' ? true : false,
    };
    
    res.cookie('token', 'none', cookieOptions);

    // Audit log with full details
    await auditService.log({
      actorId: req.user.id,
      action: 'User logged out',
      actionType: AuditActionType.LOGOUT,
      module: AuditModule.AUTH,
      category: 'authentication',
      severity: AuditSeverity.INFO,
      targetTable: 'user_login',
      targetId: req.user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: 'POST',
      responseStatus: 200
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// Get current user - OPTIMIZED WITH CACHING
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `${cache.CACHE_KEYS.USER}profile:${userId}`;

    // Try cache first for faster response
    const { data: cachedData, fromCache } = await cache.getOrSet(
      cacheKey,
      async () => {
        // OPTIMIZED: Parallel queries instead of deep includes
        const [user, permissions, studentProgram] = await Promise.all([
          // Basic user with employee details
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
          // Permissions separately
          prisma.departmentPermission.findMany({
            where: { userId, isActive: true },
            select: { departmentId: true, permissions: true }
          }),
          // Student program (only if student)
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

        // Format user data
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
          
          let departmentInfo = null;
          let schoolInfo = null;
          
          if (user.employeeDetails.primarySchool) {
            schoolInfo = {
              id: user.employeeDetails.primarySchool.id,
              name: user.employeeDetails.primarySchool.facultyName
            };
          } else if (user.employeeDetails.primaryDepartment?.faculty) {
            schoolInfo = {
              id: user.employeeDetails.primaryDepartment.faculty.id,
              name: user.employeeDetails.primaryDepartment.faculty.facultyName
            };
          }
          
          if (user.employeeDetails.primaryDepartment) {
            departmentInfo = {
              id: user.employeeDetails.primaryDepartment.id,
              name: user.employeeDetails.primaryDepartment.departmentName,
              school: schoolInfo
            };
          } else if (user.employeeDetails.primaryCentralDept) {
            departmentInfo = {
              id: user.employeeDetails.primaryCentralDept.id,
              name: user.employeeDetails.primaryCentralDept.departmentName,
              school: { id: user.employeeDetails.primaryCentralDept.id, name: 'Central Department' }
            };
          } else if (schoolInfo) {
            departmentInfo = { id: null, name: 'Not Assigned', school: schoolInfo };
          }
          
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

    if (!cachedData) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user: cachedData, cached: fromCache });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user data' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Get user
    const user = await prisma.userLogin.findUnique({
      where: { id: req.user.id }
    });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.rounds);

    // Update password
    await prisma.userLogin.update({
      where: { id: req.user.id },
      data: { passwordHash: hashedPassword }
    });

    // Audit log with full details
    await auditService.log({
      actorId: req.user.id,
      action: 'Password changed successfully',
      actionType: AuditActionType.UPDATE,
      module: AuditModule.AUTH,
      category: 'security',
      severity: AuditSeverity.INFO,
      targetTable: 'user_login',
      targetId: req.user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: 'PUT',
      responseStatus: 200
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, email } = req.body;
    const userId = req.user.id;

    // Get current user with employee details
    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      include: { employeeDetails: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update UserLogin email if provided and different
    if (email && email !== user.email) {
      // Check if email already exists
      const existingEmail = await prisma.userLogin.findFirst({
        where: { email, id: { not: userId } }
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
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
      if (phone !== undefined) updateData.phoneNumber = phone; // Field is phoneNumber in schema
      
      // Update displayName
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

    // Audit log with full details
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
              include: {
                faculty: true
              }
            },
            primarySchool: true
          }
        }
      }
    });

    // Format response - role is a scalar enum, not a relation
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

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userDetails
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// Get user settings
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user settings exist
    let settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    // Create default settings if not exists
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

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching settings'
    });
  }
};

// Update user settings
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
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
    } = req.body;

    // Check if settings exist
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

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating settings'
    });
  }
};
