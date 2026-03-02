/**
 * Stall Management Controller
 * Handles stall applications and stall management for events
 */

const prisma = require('../../../shared/config/database');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { generateQRCode } = require('../utils/qrCodeGenerator');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const generateStallId = async (eventId) => {
  // 5-digit stall ID with collision check
  let stallId;
  let attempts = 0;
  do {
    const num = Math.floor(10000 + Math.random() * 90000);
    stallId = `ST${num}`;
    const existing = await prisma.stallApplication.findFirst({
      where: { stallId, eventId },
    });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);
  return stallId;
};

const generateStallQrCode = (stallId, eventId) => {
  // Full frontend path that the feedback scanner will recognise
  return `/events/${eventId}/stalls/${stallId}/feedback`;
};

const getEventOrFail = async (eventId) => {
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
  });
  if (!event) throw new NotFoundError('Event not found');
  return event;
};

// ──────────────────────────────────────────────────────────────
// GET /api/events?filter=stall-open
// Already handled in listEvents (event.service.js) — this is
// an additional explicit endpoint for the stall-opportunities page
// ──────────────────────────────────────────────────────────────

/**
 * Get stall opportunity events (events open for student stall applications)
 * @route GET /api/events/stall-opportunities
 */
const getStallOpportunities = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const now = new Date();
  const userId = req.user?.id;

  // Show any event where the organiser has explicitly opened stall applications,
  // regardless of whether the event is still in draft or already published.
  const where = {
    hasStalls: true,
    OR: [
      {
        // Case 1: Applications are open
        stallConfig: { path: ['enableStudentApplied'], equals: true }
      },
      {
        // Case 2: User has already applied (even if applications are now closed)
        StallApplication: { some: { applicantId: userId } }
      }
    ]
  };

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { startDate: 'asc' },
      include: {
        StallApplication: {
          where: { applicantId: userId },
          select: { id: true, applicationStatus: true, rejectionReason: true }
        },
        _count: {
          select: {
            StallApplication: {
              where: { applicationStatus: { in: ['pending', 'approved'] } },
            },
          },
        },
      }
    }),
    prisma.event.count({ where }),
  ]);

  // Enrich with computed stall info
  const enriched = events.map((event) => {
    const config = (event.stallConfig || {});
    const maxStudentStalls = config.maxStudentStalls || 0;

    // Count logic restored
    const appliedCount = event._count?.StallApplication || 0;
    const spotsLeft = Math.max(0, maxStudentStalls - appliedCount);

    const deadline = event.applicationDeadline;
    const applicationClosed = deadline ? new Date(deadline) < now : false;
    const myApp = event.StallApplication?.[0];

    return {
      eventId: event.eventId,
      id: event.id,
      eventName: event.name,
      eventDate: event.startDate,
      endDate: event.endDate,
      venue: event.venue,
      maxStudentStalls,
      appliedCount,
      spotsLeft,
      applicationDeadline: deadline,
      applicationClosed,
      status: event.status,
      enableStudentApplied: config.enableStudentApplied || false,
      stallFee: config.stallFee || 0,
      myApplication: myApp ? {
        id: myApp.id,
        status: myApp.applicationStatus,
        rejectionReason: myApp.rejectionReason
      } : null
    };
  });

  return ApiResponse.success(res, {
    events: enriched,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  }, 'Stall opportunities fetched successfully');
});

// ──────────────────────────────────────────────────────────────
// POST /api/events/:id/stall-applications
// ──────────────────────────────────────────────────────────────

/**
 * Submit a stall application for an event
 * @route POST /api/events/:id/stall-applications
 */
const submitStallApplication = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const applicantId = req.user.id;

  const event = await getEventOrFail(eventId);

  // Validate event allows stall applications
  if (!event.hasStalls) {
    throw new ValidationError('This event does not accept stall applications');
  }
  const config = event.stallConfig || {};
  if (!config.enableStudentApplied) {
    throw new ValidationError('Student stall applications are not enabled for this event');
  }

  // Check deadline
  if (event.applicationDeadline && new Date(event.applicationDeadline) < new Date()) {
    throw new ValidationError('Stall application deadline has passed');
  }

  // Check max stalls
  if (config.maxStudentStalls) {
    const count = await prisma.stallApplication.count({
      where: { eventId: event.id, applicationStatus: { in: ['pending', 'approved'] } },
    });
    if (count >= config.maxStudentStalls) {
      throw new ValidationError('All stall spots have been filled');
    }
  }

  // Check if already applied
  const existing = await prisma.stallApplication.findFirst({
    where: { eventId: event.id, applicantId },
  });
  if (existing) {
    throw new ValidationError('You have already submitted a stall application for this event');
  }

  const {
    stallName, stallType, stallDescription,
    businessName, contactNumber, emailId,
    isSelling, priceRangeMin, priceRangeMax,
    stallSize, customStallSize,
    electricityRequired, additionalPowerWatts,
    tableRequired, chairsCount, specialSetup, specialSetupOther,
    stallCategory, stallFees, paymentMode, transactionId,
    paymentScreenshot, documents,
    eventRulesAccepted, refundPolicyAccepted, safetyComplianceAccepted,
    // Unified single-checkbox form also accepted
    termsAccepted,
    // Infrastructure fields from the simplified form
    spaceRequired, waterRequired, specialRequirements,
    category, businessDescription, products, gstNumber, foodLicenseNumber, documentUrls,
  } = req.body;

  // Validation — accept either the unified flag or all three separate flags
  const termsOk = termsAccepted || (eventRulesAccepted && refundPolicyAccepted && safetyComplianceAccepted);
  if (!stallName?.trim()) throw new ValidationError('Stall name is required');
  if (!stallType) throw new ValidationError('Stall type is required');
  if (!termsOk) {
    throw new ValidationError('You must accept all terms and conditions');
  }

  // Generate unique stall ID
  const stallId = await generateStallId(event.id);
  const stallQrCode = generateStallQrCode(stallId, event.id);

  const application = await prisma.stallApplication.create({
    data: {
      eventId: event.id,
      applicantId,
      stallId,
      stallName: stallName.trim(),
      stallType,
      stallDescription: stallDescription || null,
      businessName: businessName || null,
      contactNumber: contactNumber || null,
      emailId: emailId || null,
      isSelling: isSelling || false,
      priceRangeMin: priceRangeMin || null,
      priceRangeMax: priceRangeMax || null,
      stallSize: stallSize || '6x6',
      customStallSize: customStallSize || null,
      electricityRequired: electricityRequired || false,
      additionalPowerWatts: additionalPowerWatts || null,
      tableRequired: tableRequired || false,
      chairsCount: chairsCount || 0,
      specialSetup: Array.isArray(specialSetup) ? specialSetup : [],
      specialSetupOther: specialSetupOther || null,
      stallCategory: stallCategory || 'Standard',
      stallFees: stallFees || 0,
      paymentMode: paymentMode || null,
      transactionId: transactionId || null,
      paymentScreenshot: paymentScreenshot || null,
      documents: Array.isArray(documents) ? documents : [],
      eventRulesAccepted: true,
      refundPolicyAccepted: true,
      safetyComplianceAccepted: true,
      stallQrCode,
      applicationStatus: 'pending',
    },
  });

  // Notify event creator
  try {
    await prisma.notification.create({
      data: {
        userId: event.createdById,
        title: 'New Stall Application',
        message: `A new stall application "${stallName}" has been submitted for your event "${event.name}".`,
        type: 'event',
        metadata: { eventId: event.id, applicationId: application.id, stallId },
        isRead: false,
      },
    });
  } catch (_) { /* Notification failure should not block submission */ }

  return ApiResponse.success(res, {
    applicationId: application.id,
    stallId: application.stallId,
    status: application.applicationStatus,
    message: 'Application submitted. You will be notified after review.',
  }, 'Stall application submitted successfully');
});

// ──────────────────────────────────────────────────────────────
// GET /api/events/:id/stall-applications
// ──────────────────────────────────────────────────────────────

/**
 * Get all stall applications for an event (for event creator)
 * @route GET /api/events/:id/stall-applications
 */
const getStallApplications = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  const { status, page = 1, limit = 50 } = req.query;

  const event = await getEventOrFail(eventId);

  // Only event creator can view all applications
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view stall applications');
  }

  const where = { eventId: event.id };
  if (status) where.applicationStatus = status;

  const [applications, total] = await Promise.all([
    prisma.stallApplication.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { appliedAt: 'desc' },
      include: {
        applicant: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                primaryDepartment: { select: { departmentName: true } },
                primarySchool: { select: { facultyName: true } },
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                program: {
                  select: {
                    department: {
                      select: {
                        departmentName: true,
                        faculty: { select: { facultyName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.stallApplication.count({ where }),
  ]);

  const formatted = applications.map((app) => {
    const u = app.applicant;
    const emp = u.employeeDetails;
    const stu = u.studentLogin;
    const ownerName = emp?.displayName || (emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : null)
      || stu?.displayName || (stu ? `${stu.firstName} ${stu.lastName || ''}`.trim() : null)
      || u.email || u.uid;

    let department = null;
    let school = null;

    if (emp) {
      department = emp.primaryDepartment?.departmentName;
      school = emp.primarySchool?.facultyName;
    } else if (stu) {
      department = stu.program?.department?.departmentName;
      school = stu.program?.department?.faculty?.facultyName;
    }

    return {
      id: app.id,
      applicationId: app.id,
      stallName: app.stallName,
      stallId: app.stallId,
      ownerName,
      ownerEmail: u.email || '',
      ownerDepartment: department,
      ownerSchool: school,
      businessName: app.businessName,
      stallType: app.stallType,
      stallCategory: app.stallCategory,
      appliedAt: app.appliedAt,
      status: app.applicationStatus,
      rejectionReason: app.rejectionReason,
      // Full details for modal
      stallDescription: app.stallDescription,
      isSelling: app.isSelling,
      priceRangeMin: app.priceRangeMin,
      priceRangeMax: app.priceRangeMax,
      stallSize: app.stallSize,
      customStallSize: app.customStallSize,
      electricityRequired: app.electricityRequired,
      additionalPowerWatts: app.additionalPowerWatts,
      tableRequired: app.tableRequired,
      chairsCount: app.chairsCount,
      specialSetup: app.specialSetup,
      specialSetupOther: app.specialSetupOther,
      stallFees: app.stallFees,
      paymentMode: app.paymentMode,
      transactionId: app.transactionId,
      paymentScreenshot: app.paymentScreenshot,
      documents: app.documents,
      stallQrCode: app.stallQrCode,
    };
  });

  return ApiResponse.success(res, {
    applications: formatted,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  }, 'Stall applications fetched successfully');
});

// ──────────────────────────────────────────────────────────────
// GET /api/events/:id/stall-applications/my
// ──────────────────────────────────────────────────────────────

/**
 * Get the current user's stall application for an event
 * @route GET /api/events/:id/stall-applications/my
 */
const getMyStallApplication = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const applicantId = req.user.id;

  const event = await getEventOrFail(eventId);

  const application = await prisma.stallApplication.findFirst({
    where: { eventId: event.id, applicantId },
  });

  if (application) {
    // Map applicationStatus to status for frontend consistency
    application.status = application.applicationStatus;
  }

  return ApiResponse.success(res, application, 'Application fetched');
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/events/:id/stall-applications/:appId
// ──────────────────────────────────────────────────────────────

/**
 * Approve or reject a stall application
 * @route PATCH /api/events/:id/stall-applications/:appId
 */
const updateStallApplication = asyncHandler(async (req, res) => {
  const { id: eventId, appId } = req.params;
  const userId = req.user.id;
  const { status, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw new ValidationError('Status must be "approved" or "rejected"');
  }

  const event = await getEventOrFail(eventId);

  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can review stall applications');
  }

  const application = await prisma.stallApplication.findFirst({
    where: { id: appId, eventId: event.id },
  });
  if (!application) throw new NotFoundError('Application not found');

  if (application.applicationStatus !== 'pending') {
    throw new ValidationError('Only pending applications can be reviewed');
  }

  if (status === 'rejected' && !rejectionReason?.trim()) {
    throw new ValidationError('Rejection reason is required');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.stallApplication.update({
      where: { id: appId },
      data: {
        applicationStatus: status,
        rejectionReason: status === 'rejected' ? rejectionReason.trim() : null,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });

    // If approved, create a Stall record
    if (status === 'approved') {
      // Always use a fresh QR URL with the correct /events/{eventId}/stalls/{stallId}/feedback path
      const freshQrCode = generateStallQrCode(application.stallId, event.id);

      // Also update the application's QR so its stall_qr_code is current
      await tx.stallApplication.update({
        where: { id: application.id },
        data: { stallQrCode: freshQrCode },
      });

      await tx.stall.upsert({
        where: { stallId: application.stallId },
        create: {
          eventId: event.id,
          stallId: application.stallId,
          stallName: application.stallName,
          stallType: application.stallType,
          stallCategory: application.stallCategory,
          description: application.stallDescription,
          ownerName: null, // resolved from applicant
          ownerId: application.applicantId,
          source: 'student-approved',
          size: application.stallSize === 'custom' ? application.customStallSize : application.stallSize,
          stallQrCode: freshQrCode,
          isActive: true,
        },
        update: { stallQrCode: freshQrCode },
      });
    }

    return app;
  });

  // Notify applicant
  try {
    const msg = status === 'approved'
      ? `Your stall application "${application.stallName}" has been approved! Stall ID: ${application.stallId}`
      : `Your stall application "${application.stallName}" has been rejected. Reason: ${rejectionReason}`;

    await prisma.notification.create({
      data: {
        userId: application.applicantId,
        title: `Stall Application ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: msg,
        type: 'event',
        metadata: { eventId: event.id, applicationId: appId, stallId: application.stallId, status },
        isRead: false,
      },
    });
  } catch (_) { }

  return ApiResponse.success(res, {
    applicationId: updated.id,
    status: updated.applicationStatus,
  }, `Application ${status} successfully`);
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/events/:id/stall-applications/bulk
// ──────────────────────────────────────────────────────────────

/**
 * Bulk approve or reject applications
 * @route PATCH /api/events/:id/stall-applications/bulk
 */
const bulkUpdateStallApplications = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  const { applicationIds, status, rejectionReason } = req.body;

  if (!Array.isArray(applicationIds) || !applicationIds.length) {
    throw new ValidationError('applicationIds array is required');
  }
  if (!['approved', 'rejected'].includes(status)) {
    throw new ValidationError('Status must be "approved" or "rejected"');
  }

  const event = await getEventOrFail(eventId);
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can review stall applications');
  }

  const apps = await prisma.stallApplication.findMany({
    where: { id: { in: applicationIds }, eventId: event.id, applicationStatus: 'pending' },
  });

  await prisma.$transaction(async (tx) => {
    for (const app of apps) {
      await tx.stallApplication.update({
        where: { id: app.id },
        data: {
          applicationStatus: status,
          rejectionReason: status === 'rejected' ? (rejectionReason || 'Bulk rejected') : null,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });

      if (status === 'approved') {
        const freshQrCode = generateStallQrCode(app.stallId, event.id);
        await tx.stallApplication.update({
          where: { id: app.id },
          data: { stallQrCode: freshQrCode },
        });
        await tx.stall.upsert({
          where: { stallId: app.stallId },
          create: {
            eventId: event.id,
            stallId: app.stallId,
            stallName: app.stallName,
            stallType: app.stallType,
            stallCategory: app.stallCategory,
            description: app.stallDescription,
            ownerId: app.applicantId,
            source: 'student-approved',
            size: app.stallSize === 'custom' ? app.customStallSize : app.stallSize,
            stallQrCode: freshQrCode,
            isActive: true,
          },
          update: { stallQrCode: freshQrCode },
        });
      }
    }
  });

  return ApiResponse.success(res, {
    updated: apps.length,
    status,
  }, `${apps.length} applications ${status} successfully`);
});

// ──────────────────────────────────────────────────────────────
// GET /api/events/:id/stalls
// ──────────────────────────────────────────────────────────────

/**
 * Get all stalls for an event (creator view: creator-made + approved student stalls)
 * @route GET /api/events/:id/stalls
 */
const getStalls = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;

  const event = await getEventOrFail(eventId);

  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view all stalls');
  }

  const stalls = await prisma.stall.findMany({
    where: { eventId: event.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      owner: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
          studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });

  const formatted = stalls.map((stall) => {
    const u = stall.owner;
    let ownerName = stall.ownerName;
    if (!ownerName && u) {
      const emp = u.employeeDetails;
      const stu = u.studentLogin;
      ownerName = emp?.displayName || (emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : null)
        || stu?.displayName || (stu ? `${stu.firstName} ${stu.lastName || ''}`.trim() : null)
        || u.email || u.uid;
    }

    return {
      stallId: stall.stallId,
      id: stall.id,
      stallName: stall.stallName,
      stallType: stall.stallType,
      stallCategory: stall.stallCategory,
      description: stall.description,
      ownerName,
      source: stall.source,
      size: stall.size,
      location: stall.location,
      stallQrCode: stall.stallQrCode,
      stallMetadata: stall.stallMetadata || null,
    };
  });

  return ApiResponse.success(res, { stalls: formatted }, 'Stalls fetched successfully');
});

// ──────────────────────────────────────────────────────────────
// POST /api/events/:id/stalls
// ──────────────────────────────────────────────────────────────

/**
 * Creator adds a new stall directly (no approval needed)
 * @route POST /api/events/:id/stalls
 */
const createStall = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;

  const event = await getEventOrFail(eventId);

  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can add stalls');
  }

  const { stallName, stallType, description, stallCategory, size, location, businessName, electricityRequired, waterRequired, specialRequirements, products } = req.body;

  if (!stallName?.trim()) throw new ValidationError('Stall name is required');

  const stallMetadata = {};
  if (businessName !== undefined) stallMetadata.businessName = String(businessName).trim() || null;
  if (electricityRequired !== undefined) stallMetadata.electricityRequired = !!electricityRequired;
  if (waterRequired !== undefined) stallMetadata.waterRequired = !!waterRequired;
  if (specialRequirements !== undefined) stallMetadata.specialRequirements = String(specialRequirements).trim() || null;
  if (Array.isArray(products)) stallMetadata.products = products.filter(Boolean);

  // Generate stall ID
  const stallId = await generateStallId(event.id);
  const stallQrCode = generateStallQrCode(stallId, event.id);

  const stall = await prisma.stall.create({
    data: {
      eventId: event.id,
      stallId,
      stallName: stallName.trim(),
      stallType: stallType || null,
      stallCategory: stallCategory || null,
      description: description || null,
      ownerId: userId,
      ownerName: null,
      source: 'creator',
      size: size || null,
      location: location || null,
      stallQrCode,
      isActive: true,
      stallMetadata: Object.keys(stallMetadata).length > 0 ? stallMetadata : null,
    },
  });

  // Ensure event is marked as having stalls
  if (!event.hasStalls) {
    await prisma.event.update({ where: { id: event.id }, data: { hasStalls: true } });
  }

  return ApiResponse.success(res, {
    stallId: stall.stallId,
    id: stall.id,
    stallName: stall.stallName,
    stallType: stall.stallType,
    source: stall.source,
    stallQrCode: stall.stallQrCode,
  }, 'Stall created successfully');
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/events/:id/stalls/:stallId
// ──────────────────────────────────────────────────────────────

/**
 * Update a creator-made stall
 * @route PATCH /api/events/:id/stalls/:stallId
 */
const updateStall = asyncHandler(async (req, res) => {
  const { id: eventId, stallId } = req.params;
  const userId = req.user.id;

  const event = await getEventOrFail(eventId);

  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can update stalls');
  }

  const stall = await prisma.stall.findFirst({
    where: { stallId, eventId: event.id },
  });
  if (!stall) throw new NotFoundError('Stall not found');

  if (stall.source !== 'creator') {
    throw new ValidationError('Only creator-made stalls can be edited');
  }

  const { stallName, stallType, description, stallCategory, size, location, businessName, electricityRequired, waterRequired, specialRequirements, products } = req.body;

  const updateData = {
    ...(stallName !== undefined && { stallName: String(stallName).trim() }),
    ...(stallType !== undefined && { stallType: stallType || null }),
    ...(description !== undefined && { description: description || null }),
    ...(stallCategory !== undefined && { stallCategory: stallCategory || null }),
    ...(size !== undefined && { size: size || null }),
    ...(location !== undefined && { location: location || null }),
  };

  if (businessName !== undefined || electricityRequired !== undefined || waterRequired !== undefined || specialRequirements !== undefined || products !== undefined) {
    const existingMeta = (stall.stallMetadata && typeof stall.stallMetadata === 'object') ? { ...stall.stallMetadata } : {};
    if (businessName !== undefined) existingMeta.businessName = String(businessName).trim() || null;
    if (electricityRequired !== undefined) existingMeta.electricityRequired = !!electricityRequired;
    if (waterRequired !== undefined) existingMeta.waterRequired = !!waterRequired;
    if (specialRequirements !== undefined) existingMeta.specialRequirements = String(specialRequirements).trim() || null;
    if (Array.isArray(products)) existingMeta.products = products.filter(Boolean);
    updateData.stallMetadata = existingMeta;
  }

  if (Object.keys(updateData).length === 0) {
    return ApiResponse.success(res, stall, 'No changes to apply');
  }

  const updated = await prisma.stall.update({
    where: { id: stall.id },
    data: updateData,
  });

  return ApiResponse.success(res, {
    stallId: updated.stallId,
    id: updated.id,
    stallName: updated.stallName,
    stallType: updated.stallType,
    stallCategory: updated.stallCategory,
    description: updated.description,
    size: updated.size,
    location: updated.location,
    source: updated.source,
  }, 'Stall updated successfully');
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/events/:id/stalls/:stallId
// ──────────────────────────────────────────────────────────────

/**
 * Delete a creator-made stall
 * @route DELETE /api/events/:id/stalls/:stallId
 */
const deleteStall = asyncHandler(async (req, res) => {
  const { id: eventId, stallId } = req.params;
  const userId = req.user.id;

  const event = await getEventOrFail(eventId);

  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can delete stalls');
  }

  const stall = await prisma.stall.findFirst({
    where: { stallId, eventId: event.id },
  });
  if (!stall) throw new NotFoundError('Stall not found');

  if (stall.source !== 'creator') {
    throw new ValidationError('Only creator-made stalls can be deleted');
  }

  await prisma.stall.update({
    where: { id: stall.id },
    data: { isActive: false },
  });

  return ApiResponse.success(res, null, 'Stall deleted successfully');
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/events/:id/stall-applications/toggle-open
// ──────────────────────────────────────────────────────────────

/**
 * Toggle the student stall application portal open/closed.
 * Works regardless of event draft/publish status.
 * @route PATCH /api/events/:id/stall-applications/toggle-open
 */
const toggleStallApplications = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const event = await getEventOrFail(id);

  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can manage stall applications');
  }

  if (!event.hasStalls) {
    throw new ValidationError('This event does not have stall management enabled');
  }

  const currentConfig = event.stallConfig || {};
  const newOpen = !currentConfig.enableStudentApplied;

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      stallConfig: {
        ...currentConfig,
        enableStudentApplied: newOpen,
      },
    },
    select: { id: true, stallConfig: true },
  });

  return ApiResponse.success(
    res,
    { stallApplicationsOpen: newOpen, stallConfig: updated.stallConfig },
    `Stall applications ${newOpen ? 'opened' : 'closed'} successfully`
  );
});

module.exports = {
  getStallOpportunities,
  submitStallApplication,
  getStallApplications,
  getMyStallApplication,
  updateStallApplication,
  bulkUpdateStallApplications,
  getStalls,
  createStall,
  updateStall,
  deleteStall,
  toggleStallApplications,
};
