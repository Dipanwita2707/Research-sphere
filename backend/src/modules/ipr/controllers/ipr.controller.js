const prisma = require('../../../shared/config/database');
const { logIprFiling, logIprUpdate, logIprStatusChange, logFileUpload, getIp } = require('../../../shared/utils/auditLogger');

// Helper function to calculate IPR incentives based on policy
const calculateIprIncentives = async (iprType, filingType, projectType) => {
  try {
    // Fetch the active policy for this IPR type
    const policy = await prisma.incentivePolicy.findFirst({
      where: {
        iprType,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } }
        ]
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    });

    if (!policy) {
      console.log(`No active policy found for IPR type: ${iprType}`);
      return { incentiveAmount: 0, pointsAwarded: 0 };
    }

    let incentiveAmount = parseFloat(policy.baseIncentiveAmount);
    let pointsAwarded = policy.basePoints;

    // Apply filing type multiplier if exists
    if (policy.filingTypeMultiplier && typeof policy.filingTypeMultiplier === 'object') {
      const multiplier = policy.filingTypeMultiplier[filingType];
      if (multiplier) {
        incentiveAmount *= parseFloat(multiplier);
      }
    }

    // Apply project type bonus if exists
    if (policy.projectTypeBonus && typeof policy.projectTypeBonus === 'object') {
      const bonus = policy.projectTypeBonus[projectType];
      if (bonus) {
        incentiveAmount += parseFloat(bonus);
      }
    }

    console.log(`IPR Incentive calculated - Type: ${iprType}, Filing: ${filingType}, Project: ${projectType}, Amount: ${incentiveAmount}, Points: ${pointsAwarded}`);

    return {
      incentiveAmount: Math.round(incentiveAmount * 100) / 100, // Round to 2 decimal places
      pointsAwarded
    };
  } catch (error) {
    console.error('Error calculating IPR incentives:', error);
    return { incentiveAmount: 0, pointsAwarded: 0 };
  }
};

// Helper function to generate unique application number
const generateApplicationNumber = async (iprType) => {
  const currentYear = new Date().getFullYear();
  const typePrefix = {
    patent: 'PAT',
    copyright: 'CPY',
    trademark: 'TRM',
    design: 'DES'
  };
  
  const prefix = typePrefix[iprType] || 'IPR';
  
  // Get the highest application number for this type and year
  const latestApp = await prisma.iprApplication.findFirst({
    where: {
      applicationNumber: {
        startsWith: `${prefix}-${currentYear}-`
      }
    },
    orderBy: {
      applicationNumber: 'desc'
    },
    select: {
      applicationNumber: true
    }
  });
  
  let nextNumber = 1;
  if (latestApp && latestApp.applicationNumber) {
    // Extract the number part (e.g., "PAT-2025-0010" -> 10)
    const parts = latestApp.applicationNumber.split('-');
    if (parts.length === 3) {
      nextNumber = parseInt(parts[2], 10) + 1;
    }
  }
  
  // Generate number: PAT-2025-0001
  return `${prefix}-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
};

// Create new IPR application (Patent/Copyright/Trademark)
const createIprApplication = async (req, res) => {
  try {
    const {
      applicantType,
      iprType,
      projectType,
      filingType,
      title,
      description,
      remarks,
      schoolId,
      departmentId,
      sdgs, // Array of SDG codes
      applicantDetails, // Object with internal/external applicant details
      contributors, // Array of additional contributors
      annexureFilePath,
      supportingDocsFilePaths,
      // Complete filing specific fields
      sourceProvisionalId, // ID of the published provisional application to convert from
      prototypeFilePath, // ZIP file path for complete filing prototypes
    } = req.body;

    const userId = req.user.id;

    // Auto-detect schoolId and departmentId from user's profile if not provided
    let resolvedSchoolId = schoolId;
    let resolvedDepartmentId = departmentId;
    
    if (!resolvedSchoolId || !resolvedDepartmentId) {
      // Try to get from employee details first (faculty/staff)
      const employeeDetails = await prisma.employeeDetails.findUnique({
        where: { userLoginId: userId },
        select: {
          primarySchoolId: true,
          primaryDepartmentId: true,
        }
      });
      
      if (employeeDetails) {
        if (!resolvedDepartmentId && employeeDetails.primaryDepartmentId) {
          resolvedDepartmentId = employeeDetails.primaryDepartmentId;
        }
        if (!resolvedSchoolId && employeeDetails.primarySchoolId) {
          resolvedSchoolId = employeeDetails.primarySchoolId;
        }
      }
      
      // If still no school, try from student details
      if (!resolvedSchoolId) {
        const studentDetails = await prisma.studentDetails.findUnique({
          where: { userLoginId: userId },
          select: {
            programId: true,
            program: {
              select: {
                departmentId: true,
                department: {
                  select: {
                    id: true,
                    facultyId: true,
                  }
                }
              }
            }
          }
        });
        
        if (studentDetails?.program?.department) {
          if (!resolvedDepartmentId) {
            resolvedDepartmentId = studentDetails.program.department.id;
          }
          if (!resolvedSchoolId && studentDetails.program.department.facultyId) {
            resolvedSchoolId = studentDetails.program.department.facultyId;
          }
        }
      }
    }

    // Create IPR application with retry logic for application number conflicts
    let iprApplication;
    let retryCount = 0;
    const maxRetries = 5;
    
    // For complete filing with sourceProvisionalId, validate and mark as conversion
    let isConversionFromProvisional = false;
    let sourceProvisionalApp = null;
    
    if (filingType === 'complete' && sourceProvisionalId) {
      sourceProvisionalApp = await prisma.iprApplication.findFirst({
        where: {
          id: sourceProvisionalId,
          applicantUserId: userId,
          filingType: 'provisional',
          status: 'published', // Only allow conversion from published provisional
        },
        include: {
          applicantDetails: true,
          sdgs: true,
        }
      });
      
      if (!sourceProvisionalApp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid source provisional application. Only your own published provisional applications can be converted.',
        });
      }
      
      isConversionFromProvisional = true;
    }
    
    while (retryCount < maxRetries) {
      try {
        // Generate unique application number (regenerate on each retry)
        const applicationNumber = await generateApplicationNumber(iprType);
        
        iprApplication = await prisma.iprApplication.create({
          data: {
            applicationNumber,
            applicantUser: {
              connect: { id: userId }
            },
            applicantType,
            iprType,
            projectType,
            filingType,
            title,
            description,
            remarks,
            ...(resolvedSchoolId && { school: { connect: { id: resolvedSchoolId } } }),
            ...(resolvedDepartmentId && { department: { connect: { id: resolvedDepartmentId } } }),
            status: 'draft',
            annexureFilePath: annexureFilePath || '',
            supportingDocsFilePaths: supportingDocsFilePaths || [],
            // Complete filing specific fields
            ...(filingType === 'complete' && prototypeFilePath && { prototypeFilePath }),
            ...(isConversionFromProvisional && sourceProvisionalId && { 
              sourceProvisional: { connect: { id: sourceProvisionalId } },
              conversionDate: new Date(),
            }),
            applicantDetails: applicantDetails
              ? {
                  create: {
                    employeeCategory: applicantDetails.employeeCategory || null,
                    employeeType: applicantDetails.employeeType || null,
                    uid: applicantDetails.uid || null,
                    email: applicantDetails.email || null,
                    phone: applicantDetails.phone || null,
                    universityDeptName: applicantDetails.universityDeptName || null,
                    // Student-specific fields
                    mentorName: applicantDetails.mentorName || null,
                    mentorUid: applicantDetails.mentorUid || null,
                    // Inventor fields
                    isInventor: applicantDetails.isInventor || false,
                    inventorName: applicantDetails.inventorName || null,
                    inventorUid: applicantDetails.inventorUid || null,
                    inventorEmail: applicantDetails.inventorEmail || null,
                    inventorPhone: applicantDetails.inventorPhone || null,
                    // External applicant fields
                    externalName: applicantDetails.externalName || null,
                    externalOption: applicantDetails.externalOption || null,
                    instituteType: applicantDetails.instituteType || null,
                    companyUniversityName: applicantDetails.companyUniversityName || null,
                    externalEmail: applicantDetails.externalEmail || null,
                    externalPhone: applicantDetails.externalPhone || null,
                    externalAddress: applicantDetails.externalAddress || null,
                    // Store contributors in metadata
                    metadata: {
                      contributors: contributors || [],
                      ...applicantDetails.metadata,
                    },
                  },
                }
              : undefined,
            sdgs: sdgs
              ? {
                  create: sdgs.map((sdg) => ({
                    sdgCode: typeof sdg === 'string' ? sdg : sdg.code,
                    sdgTitle: typeof sdg === 'string' ? '' : (sdg.title || ''),
                  })),
                }
              : undefined,
          },
          include: {
            applicantDetails: true,
            sdgs: true,
            school: {
              select: {
                facultyName: true,
                facultyCode: true,
              },
            },
            department: {
              select: {
                departmentName: true,
                departmentCode: true,
              },
            },
          },
        });
        
        // Success - break out of retry loop
        break;
      } catch (error) {
        // Check if it's a unique constraint error on application_number
        if (error.code === 'P2002' && error.meta?.target?.includes('application_number')) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error('Failed to generate unique application number after multiple attempts');
          }
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }

    // Calculate incentives based on policy
    const { incentiveAmount, pointsAwarded } = await calculateIprIncentives(iprType, filingType, projectType);
    
    // Update the IPR application with calculated incentives
    if (incentiveAmount > 0 || pointsAwarded > 0) {
      iprApplication = await prisma.iprApplication.update({
        where: { id: iprApplication.id },
        data: {
          incentiveAmount,
          pointsAwarded
        },
        include: {
          applicantDetails: true,
          sdgs: true,
          school: {
            select: {
              facultyName: true,
              facultyCode: true,
            },
          },
          department: {
            select: {
              departmentName: true,
              departmentCode: true,
            },
          },
        },
      });
    }

    // Create status history entry
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: iprApplication.id,
        toStatus: 'draft',
        changedById: userId,
        comments: 'IPR application created',
      },
    });

    // Create contributor records for each contributor (so they can view the application)
    if (contributors && contributors.length > 0) {
      for (const contributor of contributors) {
        // Try to find the user by UID to link them
        let contributorUserId = null;
        if (contributor.uid) {
          const userLogin = await prisma.userLogin.findUnique({
            where: { uid: contributor.uid },
            select: { id: true }
          });
          if (userLogin) {
            contributorUserId = userLogin.id;
          }
        }

        await prisma.iprContributor.create({
          data: {
            iprApplicationId: iprApplication.id,
            userId: contributorUserId,
            uid: contributor.uid || null,
            name: contributor.name || 'Unknown',
            email: contributor.email || null,
            phone: contributor.phone || null,
            department: contributor.universityDeptName || null,
            employeeCategory: contributor.employeeCategory || null,
            employeeType: contributor.employeeType || null,
            role: 'inventor',
            canView: true,
            canEdit: false,
          },
        });

        // Create notification for internal contributors
        if (contributorUserId) {
          await prisma.notification.create({
            data: {
              userId: contributorUserId,
              type: 'ipr_contributor_added',
              title: 'Added as Inventor/Contributor',
              message: `You have been added as an inventor/contributor to IPR application: "${title}"`,
              metadata: {
                iprApplicationId: iprApplication.id,
                iprTitle: title,
                iprType: iprType,
                addedBy: userId,
              },
            },
          });
        }
      }
    }

    // AUTO-SUBMISSION LOGIC BASED ON FILING TYPE
    // Both 'provisional' and 'complete' filing types now get submitted:
    // - Students with mentor: goes to mentor for approval (pending_mentor_approval)
    // - Students without mentor, Faculty, and Staff: goes directly to DRD (submitted)
    
    // Get user role
    const userWithRole = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isStudent = userWithRole?.role === 'student';
    const hasMentor = applicantDetails?.mentorUid && applicantDetails.mentorUid.trim() !== '';
    
    // Determine new status based on user type and mentor assignment
    // Students with mentor -> pending_mentor_approval
    // Everyone else (students without mentor, faculty, staff) -> submitted to DRD
    const newStatus = (isStudent && hasMentor) ? 'pending_mentor_approval' : 'submitted';
    const statusComment = (isStudent && hasMentor) 
      ? `Application auto-submitted for mentor approval (filing type: ${filingType})`
      : `Application auto-submitted to DRD for review (filing type: ${filingType})`;
    
    // Update application status
    await prisma.iprApplication.update({
      where: { id: iprApplication.id },
      data: {
        status: newStatus,
        submittedAt: new Date(),
      },
    });
    
    // Create status history entry for submission
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: iprApplication.id,
        fromStatus: 'draft',
        toStatus: newStatus,
        changedById: userId,
        comments: statusComment,
      },
    });
    
    // Get applicant name for notifications
    const applicantNameForNotif = applicantDetails?.name || 'An applicant';
    
    // If pending mentor approval, notify the mentor
    if (newStatus === 'pending_mentor_approval' && hasMentor) {
      const mentorUser = await prisma.userLogin.findFirst({
        where: { uid: applicantDetails.mentorUid }
      });

      if (mentorUser) {
        await prisma.notification.create({
          data: {
            userId: mentorUser.id,
            type: 'ipr_mentor_approval',
            title: `IPR Application Needs Your Approval`,
            message: `Your student has submitted a ${iprType} application titled "${title}" and requires your approval. Application ID: ${iprApplication.applicationNumber}`,
            referenceType: 'ipr_application',
            referenceId: iprApplication.id,
            metadata: {
              iprType: iprType,
              applicantUserId: userId,
              applicationNumber: iprApplication.applicationNumber,
              action: 'mentor_approval_required'
            }
          }
        });
        console.log(`Mentor approval notification sent to: ${applicantDetails.mentorUid}`);
      }
    }
    
    // Update the response to reflect the new status
    iprApplication.status = newStatus;
    iprApplication.submittedAt = new Date();
    
    // === COMPREHENSIVE AUDIT LOGGING ===
    // Log the IPR filing
    await logIprFiling(iprApplication, userId, req);
    
    // Log file uploads if any
    if (annexureFilePath) {
      await logFileUpload(
        annexureFilePath.split('/').pop(),
        0,
        annexureFilePath,
        userId,
        req,
        'IPR',
        `IPR Application ${iprApplication.applicationNumber}`
      );
    }
    
    if (supportingDocsFilePaths && supportingDocsFilePaths.length > 0) {
      for (const docPath of supportingDocsFilePaths) {
        await logFileUpload(
          docPath.split('/').pop(),
          0,
          docPath,
          userId,
          req,
          'IPR',
          `IPR Application ${iprApplication.applicationNumber}`
        );
      }
    }
    
    if (prototypeFilePath) {
      await logFileUpload(
        prototypeFilePath.split('/').pop(),
        0,
        prototypeFilePath,
        userId,
        req,
        'IPR',
        `IPR Application ${iprApplication.applicationNumber}`
      );
    }
    
    // Log the automatic status change (draft → submitted/pending_mentor_approval)
    await logIprStatusChange(
      iprApplication,
      'draft',
      newStatus,
      userId,
      req,
      statusComment
    );
    // === END AUDIT LOGGING ===
    
    // Determine response message based on status
    let responseMessage = 'IPR application submitted successfully';
    if (iprApplication.status === 'pending_mentor_approval') {
      responseMessage = 'IPR application submitted successfully. Awaiting mentor approval.';
    } else if (iprApplication.status === 'submitted') {
      responseMessage = 'IPR application submitted successfully for DRD review.';
    }
    
    res.status(201).json({
      success: true,
      message: responseMessage,
      data: iprApplication,
    });
  } catch (error) {
    console.error('Create IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create IPR application',
      error: error.message,
    });
  }
};

// Submit IPR application (move from draft to submitted)
const submitIprApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if application exists and belongs to user
    const iprApplication = await prisma.iprApplication.findFirst({
      where: {
        id,
        applicantUserId: userId,
        status: 'draft',
      },
      include: {
        applicantDetails: true,
        applicantUser: {
          select: {
            id: true,
            uid: true,
            role: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
              }
            },
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or already submitted',
      });
    }

    // Check if the applicant is a student and has a mentor
    const isStudent = iprApplication.applicantUser?.role === 'student';
    const hasMentor = iprApplication.applicantDetails?.mentorUid && 
                      iprApplication.applicantDetails.mentorUid.trim() !== '';

    // Determine the new status
    // If student with mentor: pending_mentor_approval
    // Otherwise: submitted directly to DRD
    const newStatus = (isStudent && hasMentor) ? 'pending_mentor_approval' : 'submitted';
    const statusComment = (isStudent && hasMentor) 
      ? 'Application submitted, awaiting mentor approval'
      : 'Application submitted for DRD review';

    // Update status and set filing type to 'complete' since user is explicitly submitting
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: newStatus,
        filingType: 'complete', // Mark as complete since user explicitly submitted
        submittedAt: new Date(),
      },
      include: {
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
      },
    });

    // Create status history entry
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: 'draft',
        toStatus: newStatus,
        changedById: userId,
        comments: statusComment,
      },
    });

    // Get applicant name
    const applicantName = iprApplication.applicantUser?.studentLogin
      ? `${iprApplication.applicantUser.studentLogin.firstName} ${iprApplication.applicantUser.studentLogin.lastName || ''}`.trim()
      : iprApplication.applicantUser?.employeeDetails 
        ? `${iprApplication.applicantUser.employeeDetails.firstName} ${iprApplication.applicantUser.employeeDetails.lastName || ''}`.trim()
        : 'An applicant';

    // Get IPR type label
    const iprTypeLabels = {
      'patent': 'Patent',
      'copyright': 'Copyright',
      'trademark': 'Trademark',
      'design': 'Design'
    };
    const iprTypeLabel = iprTypeLabels[iprApplication.iprType] || iprApplication.iprType;

    // If pending mentor approval, notify the mentor
    if (newStatus === 'pending_mentor_approval' && hasMentor) {
      const mentorUid = iprApplication.applicantDetails.mentorUid;
      const mentorUser = await prisma.userLogin.findFirst({
        where: { uid: mentorUid }
      });

      if (mentorUser) {
        await prisma.notification.create({
          data: {
            userId: mentorUser.id,
            type: 'ipr_mentor_approval',
            title: `IPR Application Needs Your Approval`,
            message: `Your student ${applicantName} has submitted a ${iprTypeLabel} application titled "${iprApplication.title}" and requires your approval. Application ID: ${iprApplication.applicationNumber}`,
            referenceType: 'ipr_application',
            referenceId: id,
            metadata: {
              iprType: iprApplication.iprType,
              applicantUserId: userId,
              applicantName: applicantName,
              applicationNumber: iprApplication.applicationNumber,
              action: 'mentor_approval_required'
            }
          }
        });
        console.log(`Mentor approval notification sent to: ${mentorUid}`);
      }
    }

    // Notify contributors/inventors from metadata
    const contributors = iprApplication.applicantDetails?.metadata?.contributors || [];
    
    for (const contributor of contributors) {
      if (contributor.uid) {
        // Find user by UID
        const contributorUser = await prisma.userLogin.findFirst({
          where: { uid: contributor.uid }
        });

        if (contributorUser && contributorUser.id !== userId) {
          // Create notification for contributor
          await prisma.notification.create({
            data: {
              userId: contributorUser.id,
              type: 'ipr_contributor',
              title: `You've been added as an inventor/contributor`,
              message: `${applicantName} has submitted a ${iprTypeLabel} application titled "${iprApplication.title}" and listed you as an inventor/contributor. Application ID: ${iprApplication.applicationNumber}`,
              referenceType: 'ipr_application',
              referenceId: id,
              metadata: {
                iprType: iprApplication.iprType,
                applicantUserId: userId,
                applicantName: applicantName,
                contributorRole: contributor.employeeType || 'contributor',
              }
            }
          });
          console.log(`Notification sent to contributor: ${contributor.uid}`);
        }
      }
    }

    // === COMPREHENSIVE AUDIT LOGGING ===
    // Log the IPR submission
    await logIprUpdate(
      iprApplication,
      updated,
      userId,
      req,
      'Submitted IPR application'
    );
    
    // Log the status change
    await logIprStatusChange(
      updated,
      'draft',
      newStatus,
      userId,
      req,
      statusComment
    );
    // === END AUDIT LOGGING ===

    res.json({
      success: true,
      message: newStatus === 'pending_mentor_approval' 
        ? 'IPR application submitted. Awaiting mentor approval.'
        : 'IPR application submitted successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Submit IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit IPR application',
      error: error.message,
    });
  }
};

// Get all IPR applications (with filters)
const getAllIprApplications = async (req, res) => {
  try {
    const {
      status,
      iprType,
      schoolId,
      departmentId,
      applicantUserId,
      page = 1,
      limit = 10,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (iprType) where.iprType = iprType;
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (applicantUserId) where.applicantUserId = applicantUserId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [applications, total] = await Promise.all([
      prisma.iprApplication.findMany({
        where,
        skip,
        take,
        include: {
          applicantUser: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          applicantDetails: true,
          sdgs: true,
          school: {
            select: {
              facultyName: true,
              facultyCode: true,
            },
          },
          department: {
            select: {
              departmentName: true,
              departmentCode: true,
            },
          },
          reviews: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.iprApplication.count({ where }),
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get IPR applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR applications',
      error: error.message,
    });
  }
};

// Get IPR application by ID
const getIprApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: {
        applicantUser: {
          select: {
            uid: true,
            email: true,
            role: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
                phoneNumber: true,
                designation: true,
                primaryDepartment: {
                  select: {
                    departmentName: true,
                  },
                },
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                registrationNo: true,
                phone: true,
                program: {
                  select: {
                    programName: true,
                  },
                },
              },
            },
          },
        },
        applicantDetails: true,
        sdgs: true,
        school: {
          select: {
            facultyName: true,
            facultyCode: true,
            shortName: true,
          },
        },
        department: {
          select: {
            departmentName: true,
            departmentCode: true,
            shortName: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
        contributors: {
          select: {
            id: true,
            uid: true,
            userId: true,
            name: true,
            email: true,
            phone: true,
            department: true,
            employeeCategory: true,
            employeeType: true,
            role: true,
          },
        },
        financeRecords: {
          include: {
            financeReviewer: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    res.json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error('Get IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR application',
      error: error.message,
    });
  }
};

// Update IPR application (allowed in draft or changes_required status for applicant)
const updateIprApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      iprType,
      projectType,
      filingType,
      title,
      description,
      remarks,
      schoolId,
      departmentId,
      sdgs,
      applicantDetails,
      annexureFilePath,
      supportingDocsFilePaths,
    } = req.body;

    console.log('[updateIprApplication] Updating application:', { id, userId });

    // Check if application exists and is editable
    // Allow editing in: draft, changes_required, pending_mentor_approval, and resubmitted (student can still edit before review)
    const existing = await prisma.iprApplication.findFirst({
      where: {
        id,
        applicantUserId: userId,
        status: { in: ['draft', 'changes_required', 'pending_mentor_approval', 'resubmitted'] },
      },
    });

    console.log('[updateIprApplication] Found existing:', existing ? { id: existing.id, status: existing.status, applicantUserId: existing.applicantUserId } : 'NOT FOUND');

    if (!existing) {
      // Additional debug: check if application exists at all
      const anyMatch = await prisma.iprApplication.findUnique({
        where: { id },
        select: { id: true, status: true, applicantUserId: true }
      });
      console.log('[updateIprApplication] Application without filters:', anyMatch);
      
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or cannot be edited. Only draft and changes required applications can be edited.',
      });
    }

    // Update application
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        iprType,
        projectType,
        filingType,
        title,
        description,
        remarks,
        schoolId,
        departmentId,
        ...(annexureFilePath && { annexureFilePath }),
        ...(supportingDocsFilePaths && { supportingDocsFilePaths }),
      },
      include: {
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
      },
    });

    // Update applicant details if provided
    if (applicantDetails) {
      await prisma.iprApplicantDetails.upsert({
        where: { iprApplicationId: id },
        update: applicantDetails,
        create: {
          iprApplicationId: id,
          ...applicantDetails,
        },
      });
    }

    // Update SDGs if provided
    if (sdgs && Array.isArray(sdgs)) {
      // Delete existing SDGs
      await prisma.iprSdg.deleteMany({
        where: { iprApplicationId: id },
      });
      
      // Create new SDGs - handle multiple formats: array of strings or array of objects
      const sdgData = sdgs
        .map((sdg) => {
          let sdgCode = '';
          let sdgTitle = '';
          
          if (typeof sdg === 'string') {
            sdgCode = sdg;
            sdgTitle = `SDG ${sdg.replace(/SDG/gi, '').trim()}`;
          } else if (typeof sdg === 'object' && sdg !== null) {
            // Handle object format: { code, title } or { sdgCode, sdgTitle }
            sdgCode = sdg.code || sdg.sdgCode || '';
            sdgTitle = sdg.title || sdg.sdgTitle || '';
            
            // If sdgCode is still an object, skip this entry
            if (typeof sdgCode !== 'string') {
              return null;
            }
            
            // Generate title if not provided
            if (!sdgTitle && sdgCode) {
              sdgTitle = `SDG ${sdgCode.replace(/SDG/gi, '').trim()}`;
            }
          }
          
          // Skip invalid entries (empty code)
          if (!sdgCode || sdgCode.trim() === '') {
            return null;
          }
          
          return {
            iprApplicationId: id,
            sdgCode: String(sdgCode).trim(),
            sdgTitle: sdgTitle || `SDG ${String(sdgCode).replace(/SDG/gi, '').trim()}`,
          };
        })
        .filter(item => item !== null); // Remove null entries
      
      if (sdgData.length > 0) {
        await prisma.iprSdg.createMany({
          data: sdgData,
        });
      }
    }

    // AUTO-SUBMISSION LOGIC: If filingType changed to 'complete' and current status is draft
    let finalStatus = existing.status;
    let responseMessage = 'IPR application updated successfully';
    
    if (filingType === 'complete' && existing.status === 'draft') {
      // Get user role to determine where to submit
      const userWithRole = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      
      // Get applicant details to check for mentor
      const appDetails = await prisma.iprApplicantDetails.findUnique({
        where: { iprApplicationId: id },
        select: { mentorUid: true }
      });
      
      const isStudent = userWithRole?.role === 'student';
      const hasMentor = appDetails?.mentorUid && appDetails.mentorUid.trim() !== '';
      
      // Determine new status
      const newStatus = (isStudent && hasMentor) ? 'pending_mentor_approval' : 'submitted';
      const statusComment = (isStudent && hasMentor)
        ? 'Application submitted for mentor approval (filing type: complete)'
        : 'Application submitted to DRD for review (filing type: complete)';
      
      // Update application status
      await prisma.iprApplication.update({
        where: { id },
        data: {
          status: newStatus,
          submittedAt: new Date(),
        },
      });
      
      // Create status history
      await prisma.iprStatusHistory.create({
        data: {
          iprApplicationId: id,
          fromStatus: 'draft',
          toStatus: newStatus,
          changedById: userId,
          comments: statusComment,
        },
      });
      
      // Notify mentor if student
      if (newStatus === 'pending_mentor_approval' && hasMentor) {
        const mentorUser = await prisma.userLogin.findFirst({
          where: { uid: appDetails.mentorUid }
        });
        
        if (mentorUser) {
          await prisma.notification.create({
            data: {
              userId: mentorUser.id,
              type: 'ipr_mentor_approval',
              title: 'IPR Application Needs Your Approval',
              message: `Your student has submitted a ${updated.iprType} application titled "${updated.title}" and requires your approval.`,
              referenceType: 'ipr_application',
              referenceId: id,
              metadata: {
                iprType: updated.iprType,
                applicationNumber: updated.applicationNumber,
                action: 'mentor_approval_required'
              }
            }
          });
        }
      }
      
      finalStatus = newStatus;
      responseMessage = (isStudent && hasMentor)
        ? 'IPR application submitted successfully. Awaiting mentor approval.'
        : 'IPR application submitted successfully for DRD review.';
      
      // === COMPREHENSIVE AUDIT LOGGING FOR AUTO-SUBMIT ===
      await logIprStatusChange(
        updated,
        'draft',
        newStatus,
        userId,
        req,
        statusComment
      );
      // === END AUDIT LOGGING ===
    }

    // === COMPREHENSIVE AUDIT LOGGING FOR UPDATE ===
    await logIprUpdate(
      existing,
      { ...updated, status: finalStatus },
      userId,
      req,
      'Updated IPR application'
    );
    // === END AUDIT LOGGING ===

    res.json({
      success: true,
      message: responseMessage,
      data: { ...updated, status: finalStatus },
    });
  } catch (error) {
    console.error('Update IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update IPR application',
      error: error.message,
    });
  }
};

// Delete IPR application (only in draft status)
const deleteIprApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if application exists and is in draft status
    const existing = await prisma.iprApplication.findFirst({
      where: {
        id,
        applicantUserId: userId,
        status: 'draft',
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or cannot be deleted',
      });
    }

    // Delete application (cascade will handle related records)
    await prisma.iprApplication.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'IPR application deleted successfully',
    });
  } catch (error) {
    console.error('Delete IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete IPR application',
      error: error.message,
    });
  }
};

// Get my IPR applications (for applicant)
const getMyIprApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, iprType } = req.query;

    const where = { applicantUserId: userId };
    if (status) where.status = status;
    if (iprType) where.iprType = iprType;

    const applications = await prisma.iprApplication.findMany({
      where,
      include: {
        applicantUser: {
          select: {
            uid: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        applicantDetails: true,
        contributors: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            department: true,
            role: true,
          }
        },
        sdgs: true,
        school: {
          select: {
            facultyName: true,
          },
        },
        department: {
          select: {
            departmentName: true,
          },
        },
        reviews: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        // Include latest status history to determine who requested changes
        statusHistory: {
          orderBy: {
            changedAt: 'desc',
          },
          take: 1,
          select: {
            fromStatus: true,
            toStatus: true,
            comments: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Add helper field to determine if changes were requested by mentor
    const applicationsWithMentorFlag = applications.map(app => {
      // Changes were requested by mentor if the fromStatus was pending_mentor_approval
      const latestHistory = app.statusHistory?.[0];
      const changesRequestedByMentor = app.status === 'changes_required' && 
        latestHistory?.fromStatus === 'pending_mentor_approval';
      
      return {
        ...app,
        changesRequestedByMentor,
      };
    });

    // Group applications by status
    const grouped = {
      draft: applicationsWithMentorFlag.filter((app) => app.status === 'draft'),
      submitted: applicationsWithMentorFlag.filter((app) => app.status === 'submitted'),
      under_review: applicationsWithMentorFlag.filter((app) => 
        ['under_drd_review', 'recommended_to_head', 'under_finance_review'].includes(app.status)
      ),
      changes_required: applicationsWithMentorFlag.filter((app) => app.status === 'changes_required'),
      approved: applicationsWithMentorFlag.filter((app) => 
        ['drd_head_approved', 'finance_approved', 'completed', 'submitted_to_govt', 'govt_application_filed', 'published'].includes(app.status)
      ),
      rejected: applicationsWithMentorFlag.filter((app) => 
        ['drd_rejected', 'finance_rejected', 'cancelled'].includes(app.status)
      ),
    };

    // Calculate statistics
    const stats = {
      total: applicationsWithMentorFlag.length,
      draft: grouped.draft.length,
      submitted: grouped.submitted.length,
      under_review: grouped.under_review.length,
      changes_required: grouped.changes_required.length,
      approved: grouped.approved.length,
      rejected: grouped.rejected.length,
    };

    res.json({
      success: true,
      data: applicationsWithMentorFlag,
      grouped,
      stats,
    });
  } catch (error) {
    console.error('Get my IPR applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your IPR applications',
      error: error.message,
    });
  }
};

/**
 * Get user's published provisional applications that can be converted to complete filing
 * Only returns provisional applications with status 'completed' (published)
 */
const getMyPublishedProvisionals = async (req, res) => {
  try {
    const userId = req.user.id;

    const provisionalApplications = await prisma.iprApplication.findMany({
      where: {
        applicantUserId: userId,
        filingType: 'provisional',
        status: 'published', // Only published provisional applications
      },
      select: {
        id: true,
        applicationNumber: true,
        title: true,
        description: true,
        iprType: true,
        createdAt: true,
        completedAt: true,
        applicantDetails: {
          select: {
            mentorName: true,
            mentorUid: true,
            isInventor: true,
            inventorName: true,
            inventorUid: true,
            inventorEmail: true,
            inventorPhone: true,
          }
        },
        sdgs: {
          select: {
            sdgCode: true,
            sdgTitle: true,
          }
        },
        school: {
          select: {
            id: true,
            facultyName: true,
          }
        },
        department: {
          select: {
            id: true,
            departmentName: true,
          }
        },
        // Check if already converted to complete
        conversions: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
          }
        }
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Filter out provisionals that already have a complete filing conversion
    const availableProvisionals = provisionalApplications.filter(
      app => !app.conversions || app.conversions.length === 0
    );

    // Also return already converted ones for reference
    const alreadyConverted = provisionalApplications.filter(
      app => app.conversions && app.conversions.length > 0
    );

    res.json({
      success: true,
      data: {
        available: availableProvisionals,
        alreadyConverted: alreadyConverted,
        total: provisionalApplications.length,
      },
    });
  } catch (error) {
    console.error('Get published provisionals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published provisional applications',
      error: error.message,
    });
  }
};

// Get my IPR application by ID (for applicant to view their own application details)
const getMyIprApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const application = await prisma.iprApplication.findFirst({
      where: {
        id,
        applicantUserId: userId,
      },
      include: {
        applicantUser: {
          select: {
            uid: true,
            email: true,
            role: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                studentId: true,
              },
            },
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
              },
            },
          },
        },
        applicantDetails: true,
        sdgs: true,
        school: {
          select: {
            facultyName: true,
            facultyCode: true,
            shortName: true,
          },
        },
        department: {
          select: {
            departmentName: true,
            departmentCode: true,
            shortName: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
        contributors: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            phone: true,
            department: true,
            employeeCategory: true,
            employeeType: true,
            role: true,
          },
        },
        financeRecords: {
          include: {
            financeReviewer: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or you do not have permission to view it',
      });
    }

    // Determine who requested changes (for changes_required status)
    let changesRequestedByMentor = false;
    let changesRequestedBy = null;
    
    if (application.status === 'changes_required' && application.statusHistory?.length > 0) {
      // Find the status change that led to changes_required
      const changesRequiredEntry = application.statusHistory.find(h => h.toStatus === 'changes_required');
      if (changesRequiredEntry) {
        changesRequestedByMentor = changesRequiredEntry.fromStatus === 'pending_mentor_approval';
        const changedByUser = changesRequiredEntry.changedBy;
        changesRequestedBy = {
          isMentor: changesRequestedByMentor,
          name: changedByUser?.employeeDetails?.displayName || 
                changedByUser?.studentLogin?.displayName || 
                changedByUser?.uid || 'Reviewer',
          comments: changesRequiredEntry.comments,
        };
      }
    }

    res.json({
      success: true,
      data: {
        ...application,
        changesRequestedByMentor,
        changesRequestedBy,
      },
    });
  } catch (error) {
    console.error('Get my IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR application',
      error: error.message,
    });
  }
};

// Get IPR statistics (for dashboard)
const getIprStatistics = async (req, res) => {
  try {
    const { schoolId, departmentId, userId } = req.query;

    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (userId) where.applicantUserId = userId;

    const [
      totalApplications,
      submittedApplications,
      underReviewApplications,
      approvedApplications,
      rejectedApplications,
      completedApplications,
      byType,
      byStatus,
    ] = await Promise.all([
      prisma.iprApplication.count({ where }),
      prisma.iprApplication.count({ where: { ...where, status: 'submitted' } }),
      prisma.iprApplication.count({
        where: {
          ...where,
          status: { in: ['under_drd_review', 'recommended_to_head', 'under_finance_review'] },
        },
      }),
      prisma.iprApplication.count({
        where: {
          ...where,
          status: { in: ['drd_head_approved', 'finance_approved', 'submitted_to_govt', 'govt_application_filed', 'published'] },
        },
      }),
      prisma.iprApplication.count({
        where: {
          ...where,
          status: { in: ['drd_rejected', 'finance_rejected', 'cancelled'] },
        },
      }),
      prisma.iprApplication.count({ where: { ...where, status: 'completed' } }),
      prisma.iprApplication.groupBy({
        by: ['iprType'],
        where,
        _count: true,
      }),
      prisma.iprApplication.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    // For dashboard consistency, also get user's own applications if userId provided
    let myApplications = 0;
    if (userId) {
      myApplications = await prisma.iprApplication.count({ 
        where: { applicantUserId: userId } 
      });
    }

    res.json({
      success: true,
      data: {
        total: totalApplications,
        pending: submittedApplications,
        underReview: underReviewApplications,
        approved: approvedApplications,
        rejected: rejectedApplications,
        completed: completedApplications,
        myApplications,
        submitted: submittedApplications,
        byType,
        byStatus,
      },
    });
  } catch (error) {
    console.error('Get IPR statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR statistics',
      error: error.message,
    });
  }
};

// Resubmit IPR application after changes (handles both mentor and DRD changes_required)
const resubmitIprApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get the application with status history
    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: { 
        applicantUser: true,
        applicantDetails: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5,
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Check if user owns this application
    if (application.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to resubmit this application'
      });
    }

    // Check if application can be resubmitted
    if (application.status !== 'changes_required') {
      return res.status(400).json({
        success: false,
        message: 'Application cannot be resubmitted in its current status'
      });
    }

    // Determine if changes were requested by mentor or DRD by checking status history
    const lastStatusChange = application.statusHistory.find(h => h.toStatus === 'changes_required');
    const previousStatus = lastStatusChange?.fromStatus;
    
    // If previous status was pending_mentor_approval, resubmit goes back to mentor
    // Otherwise, it goes back to DRD
    const isMentorResubmission = previousStatus === 'pending_mentor_approval';
    const newStatus = isMentorResubmission ? 'pending_mentor_approval' : 'resubmitted';

    // Update application status (application number stays the same)
    const updatedApplication = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: newStatus,
        submittedAt: new Date(),
        ...(isMentorResubmission ? {} : { revisionCount: { increment: 1 } })
      },
      include: {
        applicantUser: {
          include: {
            employeeDetails: true,
            studentLogin: true
          }
        },
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
        reviews: {
          include: {
            reviewer: {
              include: {
                employeeDetails: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        statusHistory: {
          include: {
            changedBy: {
              include: {
                employeeDetails: true
              }
            }
          },
          orderBy: { changedAt: 'desc' }
        }
      }
    });

    // Create status history entry
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: 'changes_required',
        toStatus: newStatus,
        changedById: userId,
        comments: isMentorResubmission 
          ? 'Application resubmitted to mentor for approval after changes'
          : 'Application resubmitted to DRD after making requested changes'
      }
    });

    // If resubmitting to mentor, notify the mentor
    if (isMentorResubmission && application.applicantDetails?.mentorUid) {
      const mentorUser = await prisma.userLogin.findFirst({
        where: { uid: application.applicantDetails.mentorUid }
      });
      
      if (mentorUser) {
        await prisma.notification.create({
          data: {
            userId: mentorUser.id,
            type: 'ipr_mentor_resubmission',
            title: 'IPR Application Resubmitted for Review',
            message: `A student has resubmitted their IPR application "${application.title}" after making changes. Please review again.`,
            referenceType: 'ipr_application',
            referenceId: id,
            metadata: {
              iprType: application.iprType,
              applicationNumber: application.applicationNumber,
            }
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: isMentorResubmission 
        ? 'Application resubmitted to mentor for approval'
        : 'Application resubmitted to DRD successfully',
      data: updatedApplication
    });

  } catch (error) {
    console.error('Error resubmitting IPR application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resubmit IPR application',
      error: error.message
    });
  }
};

// Get IPR applications where user is a contributor (view-only access)
// Excludes applications where user is the applicant
const getContributedIprApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userUid = req.user.uid;

    // Find all applications where user is a contributor BUT NOT the applicant
    const contributions = await prisma.iprContributor.findMany({
      where: {
        OR: [
          { userId: userId },
          { uid: userUid }
        ],
        // Exclude applications where this user is the applicant
        iprApplication: {
          NOT: {
            applicantUserId: userId
          }
        }
      },
      include: {
        iprApplication: {
          include: {
            applicantUser: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            },
            applicantDetails: true,
            contributors: true,
            sdgs: true,
            school: {
              select: {
                facultyName: true,
                facultyCode: true,
              }
            },
            department: {
              select: {
                departmentName: true,
                departmentCode: true,
              }
            },
            statusHistory: {
              orderBy: { changedAt: 'desc' },
              take: 5,
              include: {
                changedBy: {
                  select: {
                    uid: true,
                    employeeDetails: {
                      select: {
                        firstName: true,
                        lastName: true,
                      }
                    }
                  }
                }
              }
            },
            reviews: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                id: true,
                decision: true,
                comments: true,
                reviewerRole: true,
                reviewedAt: true,
                createdAt: true,
              }
            },
            editSuggestions: {
              where: {
                status: { in: ['pending', 'accepted', 'rejected'] }
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                fieldName: true,
                originalValue: true,
                suggestedValue: true,
                status: true,
                createdAt: true,
              }
            }
          }
        }
      }
    });

    // Transform to return applications with contributor's role info
    const applications = contributions.map(contribution => ({
      ...contribution.iprApplication,
      contributorRole: contribution.role,
      contributorCanView: contribution.canView,
      contributorCanEdit: contribution.canEdit,
      isContributor: true,
      isApplicant: false,
    }));

    res.status(200).json({
      success: true,
      message: 'Contributed IPR applications retrieved successfully',
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('Get contributed IPR applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get contributed IPR applications',
      error: error.message,
    });
  }
};

// Get single IPR application for contributor (view-only)
const getContributedIprApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userUid = req.user.uid;

    // Check if user is a contributor to this application
    const contribution = await prisma.iprContributor.findFirst({
      where: {
        iprApplicationId: id,
        OR: [
          { userId: userId },
          { uid: userUid }
        ]
      }
    });

    if (!contribution) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to view this application',
      });
    }

    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: {
        applicantUser: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                designation: true,
              }
            }
          }
        },
        applicantDetails: true,
        contributors: true,
        sdgs: true,
        school: {
          select: {
            facultyName: true,
            facultyCode: true,
          }
        },
        department: {
          select: {
            departmentName: true,
            departmentCode: true,
          }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          include: {
            changedBy: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        editSuggestions: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...application,
        contributorRole: contribution.role,
        contributorCanView: contribution.canView,
        contributorCanEdit: contribution.canEdit,
        isContributor: true,
        isApplicant: false,
      }
    });
  } catch (error) {
    console.error('Get contributed IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IPR application',
      error: error.message,
    });
  }
};

// Get IPR applications pending mentor approval (for faculty mentors)
const getPendingMentorApprovals = async (req, res) => {
  try {
    const userId = req.user.id;
    const userUid = req.user.uid;

    // Find all applications where this user is the mentor
    const applications = await prisma.iprApplication.findMany({
      where: {
        status: 'pending_mentor_approval',
        applicantDetails: {
          mentorUid: userUid
        }
      },
      include: {
        applicantUser: {
          select: {
            uid: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                studentId: true,
                program: {
                  select: {
                    programName: true,
                    programCode: true
                  }
                }
              }
            }
          }
        },
        applicantDetails: true,
        school: {
          select: {
            facultyName: true,
            facultyCode: true,
          }
        },
        department: {
          select: {
            departmentName: true,
            departmentCode: true,
          }
        },
        sdgs: true,
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Transform to add studentDetails field for frontend compatibility
    const transformedApplications = applications.map(app => ({
      ...app,
      applicantUser: app.applicantUser ? {
        ...app.applicantUser,
        studentDetails: app.applicantUser.studentLogin
      } : null
    }));

    res.json({
      success: true,
      data: transformedApplications,
      total: transformedApplications.length,
    });
  } catch (error) {
    console.error('Get pending mentor approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending mentor approvals',
      error: error.message,
    });
  }
};

// Get all applications where user is mentor (approved, rejected, pending, changes_required)
const getMentorReviewHistory = async (req, res) => {
  try {
    const userUid = req.user.uid;

    // Find all applications where this user is the mentor
    const applications = await prisma.iprApplication.findMany({
      where: {
        applicantDetails: {
          mentorUid: userUid
        }
      },
      include: {
        applicantUser: {
          select: {
            uid: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                studentId: true,
                program: {
                  select: {
                    programName: true,
                    programCode: true
                  }
                }
              }
            }
          }
        },
        applicantDetails: true,
        school: {
          select: {
            facultyName: true,
            facultyCode: true,
          }
        },
        department: {
          select: {
            departmentName: true,
            departmentCode: true,
          }
        },
        sdgs: true,
        statusHistory: {
          where: {
            OR: [
              { toStatus: 'submitted' },
              { toStatus: 'changes_required' },
              { fromStatus: 'pending_mentor_approval' }
            ]
          },
          include: {
            changedBy: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          },
          orderBy: { changedAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Categorize applications by mentor action
    const pending = applications.filter(app => app.status === 'pending_mentor_approval');
    const changesRequired = applications.filter(app => app.status === 'changes_required');
    const approved = applications.filter(app => 
      ['submitted', 'under_drd_review', 'recommended_to_head', 'drd_head_approved', 'published', 'completed'].includes(app.status)
    );
    const rejected = applications.filter(app => 
      app.status === 'rejected' || app.status === 'draft'
    );

    res.json({
      success: true,
      data: {
        all: applications,
        pending,
        changesRequired,
        approved,
        rejected,
      },
      stats: {
        total: applications.length,
        pending: pending.length,
        changesRequired: changesRequired.length,
        approved: approved.length,
        rejected: rejected.length,
      }
    });
  } catch (error) {
    console.error('Get mentor review history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentor review history',
      error: error.message,
    });
  }
};

// Get IPR application by ID for mentor review
const getMentorApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userUid = req.user.uid;

    // Find the application
    const application = await prisma.iprApplication.findFirst({
      where: {
        id,
        applicantDetails: {
          mentorUid: userUid
        }
      },
      include: {
        applicantUser: {
          select: {
            uid: true,
            email: true,
            role: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                studentId: true,
              },
            },
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
              },
            },
          },
        },
        applicantDetails: true,
        sdgs: true,
        school: {
          select: {
            facultyName: true,
            facultyCode: true,
            shortName: true,
          },
        },
        department: {
          select: {
            departmentName: true,
            departmentCode: true,
            shortName: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
        contributors: {
          select: {
            id: true,
            uid: true,
            name: true,
            email: true,
            phone: true,
            department: true,
            employeeCategory: true,
            employeeType: true,
            role: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or you are not the mentor for this application',
      });
    }

    res.json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error('Get mentor IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR application',
      error: error.message,
    });
  }
};

// Mentor approves IPR application
const approveMentorApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userUid = req.user.uid;

    // Check if application exists and is pending mentor approval
    const iprApplication = await prisma.iprApplication.findFirst({
      where: {
        id,
        status: 'pending_mentor_approval',
      },
      include: {
        applicantDetails: true,
        applicantUser: {
          select: {
            id: true,
            uid: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or not pending mentor approval',
      });
    }

    // Verify that the current user is the mentor
    if (iprApplication.applicantDetails?.mentorUid !== userUid) {
      return res.status(403).json({
        success: false,
        message: 'You are not the mentor for this application',
      });
    }

    // Update status to submitted (approved by mentor)
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'submitted',
      },
      include: {
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
      },
    });

    // Create status history entry
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: 'pending_mentor_approval',
        toStatus: 'submitted',
        changedById: userId,
        comments: comments || 'Mentor approved the application',
      },
    });

    // Notify the student that mentor approved
    const studentName = iprApplication.applicantUser?.studentLogin
      ? `${iprApplication.applicantUser.studentLogin.firstName} ${iprApplication.applicantUser.studentLogin.lastName || ''}`.trim()
      : 'Student';

    await prisma.notification.create({
      data: {
        userId: iprApplication.applicantUserId,
        type: 'ipr_mentor_approved',
        title: 'Your IPR Application Has Been Approved by Mentor',
        message: `Your mentor has approved your IPR application "${iprApplication.title}". It has now been submitted to DRD for review.`,
        referenceType: 'ipr_application',
        referenceId: id,
        metadata: {
          iprType: iprApplication.iprType,
          applicationNumber: iprApplication.applicationNumber,
          mentorUid: userUid,
        }
      }
    });

    // === COMPREHENSIVE AUDIT LOGGING ===
    await logIprStatusChange(
      updated,
      'pending_mentor_approval',
      'submitted',
      userId,
      req,
      comments || 'Mentor approved the application'
    );
    // === END AUDIT LOGGING ===

    res.json({
      success: true,
      message: 'IPR application approved and submitted to DRD',
      data: updated,
    });
  } catch (error) {
    console.error('Mentor approve IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve IPR application',
      error: error.message,
    });
  }
};

// Mentor rejects IPR application (sends back to student)
const rejectMentorApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userUid = req.user.uid;

    if (!comments) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required when rejecting an application',
      });
    }

    // Check if application exists and is pending mentor approval
    const iprApplication = await prisma.iprApplication.findFirst({
      where: {
        id,
        status: 'pending_mentor_approval',
      },
      include: {
        applicantDetails: true,
        applicantUser: {
          select: {
            id: true,
            uid: true,
          }
        }
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found or not pending mentor approval',
      });
    }

    // Verify that the current user is the mentor
    if (iprApplication.applicantDetails?.mentorUid !== userUid) {
      return res.status(403).json({
        success: false,
        message: 'You are not the mentor for this application',
      });
    }

    // Update status to changes_required (mentor requested changes)
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'changes_required',
      },
      include: {
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
      },
    });

    // Create status history entry
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: 'pending_mentor_approval',
        toStatus: 'changes_required',
        changedById: userId,
        comments: `Mentor requested changes: ${comments}`,
      },
    });

    // Notify the student that mentor requested changes
    await prisma.notification.create({
      data: {
        userId: iprApplication.applicantUserId,
        type: 'ipr_mentor_rejected',
        title: 'Your IPR Application Needs Revision',
        message: `Your mentor has requested changes to your IPR application "${iprApplication.title}". Please review the feedback and resubmit.`,
        referenceType: 'ipr_application',
        referenceId: id,
        metadata: {
          iprType: iprApplication.iprType,
          applicationNumber: iprApplication.applicationNumber,
          mentorUid: userUid,
          mentorComments: comments,
        }
      }
    });

    // === COMPREHENSIVE AUDIT LOGGING ===
    await logIprStatusChange(
      updated,
      'pending_mentor_approval',
      'changes_required',
      userId,
      req,
      `Mentor requested changes: ${comments}`
    );
    // === END AUDIT LOGGING ===

    res.json({
      success: true,
      message: 'Application sent back to student for revision',
      data: updated,
    });
  } catch (error) {
    console.error('Mentor reject IPR application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject IPR application',
      error: error.message,
    });
  }
};

module.exports = {
  createIprApplication,
  submitIprApplication,
  resubmitIprApplication,
  getAllIprApplications,
  getIprApplicationById,
  getMyIprApplicationById,
  getMentorApplicationById,
  updateIprApplication,
  deleteIprApplication,
  getMyIprApplications,
  getMyPublishedProvisionals,
  getIprStatistics,
  getContributedIprApplications,
  getContributedIprApplicationById,
  getPendingMentorApprovals,
  getMentorReviewHistory,
  approveMentorApplication,
  rejectMentorApplication,
};
