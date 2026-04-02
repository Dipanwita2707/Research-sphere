/**
 * Auth Controller
 * Thin HTTP adapter — delegates all business logic to auth.service.js
 */

const authService = require('../services/auth.service');
const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');
const { sanitizeInput } = require('../../../shared/utils/validators');
const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../audit/services/audit.service');
const { getClientIp } = require('../../../shared/middleware/audit.middleware');
const log = require('../../../shared/utils/logger');
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire
  });
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
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
      profileImageUrl: user.profileImage ? `/uploads/profiles/${user.profileImage}` : null,
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
    log.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const result = await authService.logout(req.user.id, req);

    res.cookie('token', 'none', result.cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    log.error('Logout error:', error.message);
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
          profileImageUrl: user.profileImage ? `/uploads/profiles/${user.profileImage}` : null,
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
    log.error('Get user error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching user data' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword, req);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    log.error('Change password error:', error.message);
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
    const result = await authService.updateProfile(req.user.id, { firstName, lastName, phone, email }, req);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: result.userDetails
    });
  } catch (error) {
    log.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// Get user settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await authService.getSettings(req.user.id);

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    log.error('Get settings error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error fetching settings'
    });
  }
};

// Update user settings
exports.updateSettings = async (req, res) => {
  try {
    const settings = await authService.updateSettings(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    log.error('Update settings error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error updating settings'
    });
  }
};

// Upload profile photo
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 5MB limit'
      });
    }

    const fs = require('fs').promises;
    const path = require('path');
    const crypto = require('crypto');

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'profiles');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename (shortened to fit 64 char limit)
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${randomString}${ext}`; // Format: timestamp-random.ext
    const filePath = path.join(uploadsDir, filename);

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Update user's profile image path in database
    const updatedUser = await prisma.userLogin.update({
      where: { id: userId },
      data: {
        profileImage: filename,
        profileImageFilePath: `/uploads/profiles/${filename}`
      },
      select: {
        id: true,
        profileImage: true,
        profileImageFilePath: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profileImage: updatedUser.profileImage,
        profileImagePath: updatedUser.profileImageFilePath,
        profileImageUrl: `/uploads/profiles/${updatedUser.profileImage}`
      }
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading profile photo'
    });
  }
};

// Delete profile photo
exports.deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current user
    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { profileImage: true }
    });

    if (!user || !user.profileImage) {
      return res.status(404).json({
        success: false,
        message: 'No profile photo to delete'
      });
    }

    const fs = require('fs').promises;
    const path = require('path');

    // Delete file from disk
    const filePath = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'profiles', user.profileImage);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, continue anyway
      console.log('File deletion warning:', error.message);
    }

    // Update database
    await prisma.userLogin.update({
      where: { id: userId },
      data: {
        profileImage: null,
        profileImageFilePath: null
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting profile photo'
    });
  }
};
