const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { generateAffiliationVariants } = require('../../../shared/utils/affiliationEngine');
const { invalidateUniversityAffiliationCache } = require('../../core/services/affiliation.service');
const { invalidateTenantStatus } = require('../../../shared/middleware/auth');
const { validatePasswordPolicy } = require('../../auth/utils/passwordPolicy');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../../audit/services/audit.service');
const brandingService = require('../../branding/services/branding.service');
const { parseBrandingUpdate } = require('../../branding/validation/branding.validation');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Central departments every tenant needs from day one: research, IPR and grant
 * workflows look up the DRD department by code; the research incentive payout and budget
 * permissions (finance_*) are granted through the Finance department.
 */
const DEFAULT_CENTRAL_DEPARTMENTS = [
  {
    departmentCode: 'DRD',
    departmentName: 'Director of Research and Development',
    shortName: 'DRD',
    departmentType: 'drd',
  },
  {
    departmentCode: 'FINANCE',
    departmentName: 'Finance (Research Incentives)',
    shortName: 'Finance',
    departmentType: 'finance',
  },
];

/**
 * Create the per-tenant rows a new university needs. Superadmin requests run without a
 * tenant context, so universityId is always passed explicitly. Idempotent.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} universityId
 */
async function provisionTenantDefaults(tx, universityId) {
  for (const dept of DEFAULT_CENTRAL_DEPARTMENTS) {
    await tx.centralDepartment.upsert({
      where: { universityId_departmentCode: { universityId, departmentCode: dept.departmentCode } },
      update: {},
      create: { ...dept, universityId, isActive: true },
    });
  }
}

/**
 * Create a tenant admin login plus the profile rows the UI expects
 * (EmployeeDetails for the display name, UserSettings for preferences).
 */
async function createTenantAdmin(tx, { universityId, uid, email, passwordHash, displayName }) {
  const admin = await tx.userLogin.create({
    data: {
      uid,
      email,
      passwordHash,
      passwordChangedAt: new Date(),
      role: 'admin',
      status: 'active',
      universityId,
    },
    select: { id: true, uid: true, email: true, status: true, role: true, universityId: true, createdAt: true },
  });
  const name = String(displayName || uid).trim().slice(0, 100);
  await tx.employeeDetails.create({
    data: {
      universityId,
      userLoginId: admin.id,
      firstName: name,
      displayName: name,
      email,
      designation: 'University Administrator',
      isActive: true,
    },
  });
  await tx.userSettings.create({ data: { userId: admin.id } });
  return admin;
}

/** Validate admin credentials from a request body. Returns an error message or null. */
function validateAdminCredentials({ adminUsername, adminEmail, adminPassword }) {
  if (typeof adminUsername !== 'string' || !/^[A-Za-z0-9._-]{3,50}$/.test(adminUsername)) {
    return 'Admin username must be 3-50 characters (letters, digits, dot, dash, underscore)';
  }
  if (typeof adminEmail !== 'string' || !EMAIL_RE.test(adminEmail.trim()) || adminEmail.length > 254) {
    return 'Admin email is not a valid email address';
  }
  return validatePasswordPolicy(adminPassword, { uid: adminUsername, email: adminEmail });
}

/** Globally unique login identifiers (uid/email are unique across all tenants). */
async function findLoginConflict(uid, email) {
  const existing = await prisma.userLogin.findFirst({
    where: {
      OR: [
        { uid },
        { email: { equals: String(email).trim(), mode: 'insensitive' } },
      ],
    },
    select: { uid: true, email: true },
  });
  if (!existing) return null;
  return existing.uid === uid
    ? `Admin username "${uid}" is already taken`
    : `Admin email "${email}" is already registered. Use a different admin email.`;
}


// =====================================
// Universities CRUD
// =====================================

// Get all universities with stats (subscription, users count, api usage)
exports.getAllUniversities = async (req, res) => {
  try {
    const universities = await prisma.university.findMany({
      include: {
        subscription: {
          include: {
            tier: true
          }
        },
        _count: {
          select: {
            users: true,
            schools: true,
            centralDepts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format output with additional statistics
    const formatted = await Promise.all(universities.map(async (uni) => {
      // Get API usage for current month (so far)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyUsage = await prisma.apiUsageDaily.aggregate({
        where: {
          universityId: uni.id,
          date: { gte: startOfMonth }
        },
        _sum: {
          totalRequests: true
        }
      });

      return {
        id: uni.id,
        code: uni.code,
        name: uni.name,
        slug: uni.slug,
        // Browser URL of the uploaded logo (the column holds a storage key)
        logoUrl: brandingService.toBrandingDto(uni).logoUrl,
        primaryColor: uni.primaryColor,
        themePreset: uni.themePreset,
        displayName: uni.displayName || uni.name,
        shortName: uni.shortName,
        contactEmail: uni.contactEmail,
        websiteUrl: uni.websiteUrl,
        isActive: uni.isActive,
        createdAt: uni.createdAt,
        counts: {
          users: uni._count.users,
          schools: uni._count.schools,
          centralDepts: uni._count.centralDepts
        },
        subscription: uni.subscription ? {
          id: uni.subscription.id,
          status: uni.subscription.status,
          tierName: uni.subscription.tier.displayName,
          billingCycle: uni.subscription.billingCycle,
          currentPeriodEnd: uni.subscription.currentPeriodEnd,
          maxApiCalls: uni.subscription.tier.maxApiCallsPerMonth,
          maxUsers: uni.subscription.tier.maxUsers
        } : null,
        apiUsageMtd: monthlyUsage._sum.totalRequests || 0
      };
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('getAllUniversities error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve universities' });
  }
};

// Get a single university by ID
exports.getUniversityById = async (req, res) => {
  try {
    const { id } = req.params;
    const uni = await prisma.university.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            tier: true
          }
        }
      }
    });

    if (!uni) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    // Get statistics
    const [userCount, schoolCount, deptCount, programCount] = await Promise.all([
      prisma.userLogin.count({ where: { universityId: id } }),
      prisma.facultySchoolList.count({ where: { universityId: id } }),
      prisma.centralDepartment.count({ where: { universityId: id } }),
      prisma.program.count({ where: { universityId: id } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...uni,
        logoUrl: brandingService.toBrandingDto(uni).logoUrl,
        branding: brandingService.toBrandingDto(uni),
        stats: {
          users: userCount,
          schools: schoolCount,
          centralDepts: deptCount,
          programs: programCount
        }
      }
    });
  } catch (error) {
    console.error('getUniversityById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve university details' });
  }
};

// Create a new university & provision default admin user + initial trial subscription
exports.createUniversity = async (req, res) => {
  const { code, name, slug, contactEmail, websiteUrl, tierId, adminUsername, adminPassword, adminEmail, adminName } = req.body;

  if (!code || !name || !slug || !tierId || !adminUsername || !adminPassword || !adminEmail) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(String(code)) || !/^[a-z0-9-]{2,63}$/i.test(String(slug))) {
    return res.status(400).json({
      success: false,
      message: 'University code must be 2-20 letters/digits/-/_ and slug 2-63 letters/digits/-',
    });
  }
  const credentialError = validateAdminCredentials({ adminUsername, adminEmail, adminPassword });
  if (credentialError) {
    return res.status(400).json({ success: false, message: credentialError });
  }
  // Optional "Branding & theme" section of the create form (logos are uploaded afterwards)
  const { branding } = req.body;
  if (branding !== undefined && branding !== null) {
    const parsedBranding = parseBrandingUpdate(branding);
    if (!parsedBranding.ok) {
      return res.status(400).json({ success: false, message: parsedBranding.errors[0], errors: parsedBranding.errors });
    }
  }

  try {
    // Check duplicates
    const existingUni = await prisma.university.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase() },
          { slug: slug.toLowerCase() }
        ]
      }
    });

    if (existingUni) {
      const conflict =
        existingUni.code === code.toUpperCase()
          ? `University code "${code.toUpperCase()}" is already taken`
          : `Subdomain slug "${slug.toLowerCase()}" is already taken`;
      return res.status(400).json({
        success: false,
        message: conflict,
      });
    }

    // uid and email are unique across all tenants — reject early with a clear message
    const loginConflict = await findLoginConflict(adminUsername, adminEmail);
    if (loginConflict) {
      return res.status(400).json({ success: false, message: loginConflict });
    }

    // Fetch Tier
    const tier = await prisma.saaSTier.findUnique({
      where: { id: tierId }
    });

    if (!tier) {
      return res.status(400).json({ success: false, message: 'SaaS tier not found' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create university, subscription, default tenant rows and admin user in a transaction.
    // Superadmin routes run without a tenant context: every tenant row gets universityId explicitly.
    const result = await prisma.$transaction(async (tx) => {
      const university = await tx.university.create({
        data: {
          code: code.toUpperCase(),
          name,
          slug: slug.toLowerCase(),
          contactEmail,
          websiteUrl,
          isActive: true
        }
      });

      // Provision Subscription (Trial starts today, ends in 30 days)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      await tx.universitySubscription.create({
        data: {
          universityId: university.id,
          tierId: tier.id,
          status: 'trialing',
          billingCycle: 'monthly',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate
        }
      });

      await provisionTenantDefaults(tx, university.id);

      // Provision Admin User (+ profile rows)
      const admin = await createTenantAdmin(tx, {
        universityId: university.id,
        uid: adminUsername,
        email: String(adminEmail).trim().toLowerCase(),
        passwordHash: hashedPassword,
        displayName: adminName,
      });

      return { university, admin };
    });

    await auditService.log({
      actorId: req.user?.id,
      universityId: result.university.id,
      action: `Provisioned university ${result.university.code} with admin ${result.admin.uid}`,
      actionType: AuditActionType.CREATE,
      module: AuditModule.ADMIN,
      category: 'tenant_provisioning',
      severity: AuditSeverity.INFO,
      targetTable: 'university',
      targetId: result.university.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (branding) {
      const applied = await brandingService.updateBranding(result.university.id, branding, { actor: req.user, req });
      result.branding = applied.branding;
    }

    res.status(201).json({
      success: true,
      message: 'University created and provisioned successfully',
      data: result
    });
  } catch (error) {
    console.error('createUniversity error:', error);
    if (error?.code === 'P2002') {
      const fields = error?.meta?.target;
      const fieldList = Array.isArray(fields) ? fields.join(', ') : String(fields || 'unique field');
      return res.status(400).json({
        success: false,
        message: `A record with this ${fieldList} already exists. Choose a different value and try again.`,
      });
    }
    res.status(500).json({ success: false, message: 'Failed to create university' });
  }
};

// Update university details
exports.updateUniversity = async (req, res) => {
  const { id } = req.params;
  const {
    // Logo and colours are branding: they change only through /universities/:id/branding,
    // which validates colours and re-encodes images (logoUrl/primaryColor are ignored here).
    name, contactEmail, websiteUrl, isActive,
    address, city, state, country, affiliationAliases, scopusAffiliationIds,
    dpoName, dpoEmail, dpoPhone, requireGuardianConsentForMinors,
  } = req.body;

  try {
    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const updateData = {
      name,
      contactEmail,
      websiteUrl,
      isActive: isActive !== undefined ? isActive : uni.isActive,
    };
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (dpoName !== undefined) updateData.dpoName = dpoName;
    if (dpoEmail !== undefined) updateData.dpoEmail = dpoEmail;
    if (dpoPhone !== undefined) updateData.dpoPhone = dpoPhone;
    if (typeof requireGuardianConsentForMinors === 'boolean') {
      updateData.requireGuardianConsentForMinors = requireGuardianConsentForMinors;
    }
    if (Array.isArray(affiliationAliases)) {
      updateData.affiliationAliases = affiliationAliases
        .map((alias) => String(alias || '').trim())
        .filter(Boolean);
    }
    // Elsevier Scopus affiliation ids (AF-ID) used by publication sync for this university.
    if (Array.isArray(scopusAffiliationIds)) {
      updateData.scopusAffiliationIds = Array.from(new Set(scopusAffiliationIds
        .map((afid) => String(afid || '').trim())
        .filter((afid) => /^\d{5,12}$/.test(afid))));
    }

    const updated = await prisma.university.update({
      where: { id },
      data: updateData,
    });

    // Affiliation variants depend on name/city/state/aliases — invalidate the
    // cached variant list so the next lookup reflects this change.
    await invalidateUniversityAffiliationCache(id);
    await invalidateTenantStatus(id);

    res.status(200).json({
      success: true,
      message: 'University updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('updateUniversity error:', error);
    res.status(500).json({ success: false, message: 'Failed to update university' });
  }
};

// Preview affiliation-variant generation for a university without persisting
// anything — lets Super Admin see what the engine derives (plus any
// already-saved custom aliases) before/while editing name/city/state.
// Accepts either an existing university id (:id) merged with optional query
// overrides, so the UI can live-preview unsaved form edits.
exports.previewUniversityAffiliationVariants = async (req, res) => {
  const { id } = req.params;
  const { name, city, state, aliases } = req.query;

  try {
    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const parsedAliases = aliases !== undefined
      ? String(aliases).split(',').map((a) => a.trim()).filter(Boolean)
      : (Array.isArray(uni.affiliationAliases) ? uni.affiliationAliases : []);

    const variants = generateAffiliationVariants({
      name: name || uni.name,
      code: uni.code,
      city: city || uni.city,
      state: state || uni.state,
      extraAliases: parsedAliases,
    });

    res.status(200).json({
      success: true,
      data: {
        canonicalName: name || uni.name,
        variants,
        aliases: parsedAliases,
      },
    });
  } catch (error) {
    console.error('previewUniversityAffiliationVariants error:', error);
    res.status(500).json({ success: false, message: 'Failed to preview affiliation variants' });
  }
};

// Suspend university (Toggle active/inactive)
exports.suspendUniversity = async (req, res) => {
  const { id } = req.params;
  const { suspend } = req.body; // true to suspend, false to resume

  try {
    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const updated = await prisma.university.update({
      where: { id },
      data: { isActive: !suspend }
    });

    // Takes effect on the next request of every user of this university
    await invalidateTenantStatus(id);

    // Optionally revoke user sessions from cache
    if (suspend) {
      // Find all users from this university
      const users = await prisma.userLogin.findMany({
        where: { universityId: id },
        select: { id: true }
      });

      // Flush user cache keys in parallel
      await Promise.all(users.map(async (u) => {
        const cacheKey = `${cache.CACHE_KEYS.USER}auth:${u.id}`;
        await cache.del(cacheKey);
      }));
    }

    res.status(200).json({
      success: true,
      message: suspend ? 'University suspended successfully' : 'University activated successfully',
      data: updated
    });
  } catch (error) {
    console.error('suspendUniversity error:', error);
    res.status(500).json({ success: false, message: 'Operation failed' });
  }
};

// =====================================
// SaaS Tiers CRUD
// =====================================

exports.getAllTiers = async (req, res) => {
  try {
    const tiers = await prisma.saaSTier.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    res.status(200).json({ success: true, data: tiers });
  } catch (error) {
    console.error('getAllTiers error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve SaaS tiers' });
  }
};

exports.createTier = async (req, res) => {
  const { name, displayName, monthlyPriceCents, yearlyPriceCents, maxUsers, maxApiCallsPerMonth, maxStorageGb, features, overagePer1kCalls, isPublic, sortOrder } = req.body;

  if (!name || !displayName || monthlyPriceCents === undefined || yearlyPriceCents === undefined || maxUsers === undefined || maxApiCallsPerMonth === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }

  try {
    const existing = await prisma.saaSTier.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A tier with this name already exists' });
    }

    const tier = await prisma.saaSTier.create({
      data: {
        name,
        displayName,
        monthlyPriceCents,
        yearlyPriceCents,
        maxUsers,
        maxApiCallsPerMonth,
        maxStorageGb: maxStorageGb || 10,
        features: features || {},
        overagePer1kCalls: overagePer1kCalls || 10,
        isPublic: isPublic !== undefined ? isPublic : true,
        sortOrder: sortOrder || 0
      }
    });

    res.status(201).json({ success: true, message: 'SaaS tier created successfully', data: tier });
  } catch (error) {
    console.error('createTier error:', error);
    res.status(500).json({ success: false, message: 'Failed to create SaaS tier' });
  }
};

exports.updateTier = async (req, res) => {
  const { id } = req.params;
  const { displayName, monthlyPriceCents, yearlyPriceCents, maxUsers, maxApiCallsPerMonth, maxStorageGb, features, overagePer1kCalls, isPublic, sortOrder } = req.body;

  try {
    const existing = await prisma.saaSTier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tier not found' });
    }

    const updated = await prisma.saaSTier.update({
      where: { id },
      data: {
        displayName,
        monthlyPriceCents,
        yearlyPriceCents,
        maxUsers,
        maxApiCallsPerMonth,
        maxStorageGb,
        features,
        overagePer1kCalls,
        isPublic,
        sortOrder
      }
    });

    res.status(200).json({ success: true, message: 'SaaS tier updated successfully', data: updated });
  } catch (error) {
    console.error('updateTier error:', error);
    res.status(500).json({ success: false, message: 'Failed to update SaaS tier' });
  }
};

// =====================================
// Superadmin Dashboard Analytics
// =====================================

// Get Global SaaS KPIs
exports.getGlobalStats = async (req, res) => {
  try {
    const [uniCount, userCount, activeSubCount] = await Promise.all([
      prisma.university.count(),
      prisma.userLogin.count({ where: { role: { not: 'superadmin' } } }),
      prisma.universitySubscription.count({ where: { status: 'active' } })
    ]);

    // Compute revenue estimate (in cents)
    const activeSubs = await prisma.universitySubscription.findMany({
      where: { status: 'active' },
      include: { tier: true }
    });

    const mrrCents = activeSubs.reduce((acc, sub) => {
      const price = sub.billingCycle === 'yearly'
        ? Math.round(sub.tier.yearlyPriceCents / 12)
        : sub.tier.monthlyPriceCents;
      return acc + price;
    }, 0);

    // Compute monthly API calls across all tenants
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const apiUsage = await prisma.apiUsageDaily.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { totalRequests: true }
    });

    res.status(200).json({
      success: true,
      data: {
        totalUniversities: uniCount,
        totalUsers: userCount,
        activeSubscriptions: activeSubCount,
        monthlyRecurringRevenueCents: mrrCents,
        mtdApiRequests: apiUsage._sum.totalRequests || 0
      }
    });
  } catch (error) {
    console.error('getGlobalStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate stats' });
  }
};

// Real-time API Monitor Stats for Superadmin
exports.getApiMonitorStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logsStats = await prisma.apiUsageDaily.findMany({
      where: { date: today },
      include: {
        university: {
          select: { name: true, code: true }
        }
      }
    });

    const formatted = logsStats.map(stat => ({
      universityId: stat.universityId,
      name: stat.university.name,
      code: stat.university.code,
      requests: stat.totalRequests,
      successRequests: stat.successRequests,
      errorRequests: stat.errorRequests,
      avgDurationMs: stat.avgDurationMs,
      p95DurationMs: stat.p95DurationMs,
      endpointBreakdown: stat.endpointBreakdown
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('getApiMonitorStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve API metrics' });
  }
};
exports.getUniversityAdmins = async (req, res) => {
  try {
    const { id } = req.params;
    const admins = await prisma.userLogin.findMany({
      where: { universityId: id, role: 'admin' },
      select: { id: true, uid: true, email: true, status: true, createdAt: true }
    });
    res.status(200).json({ success: true, data: admins });
  } catch (error) {
    console.error('getUniversityAdmins error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tenant admins' });
  }
};

exports.createUniversityAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUsername, adminEmail, adminPassword, adminName } = req.body;

    if (!adminUsername || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: 'Missing required admin credentials' });
    }
    const credentialError = validateAdminCredentials({ adminUsername, adminEmail, adminPassword });
    if (credentialError) {
      return res.status(400).json({ success: false, message: credentialError });
    }

    const university = await prisma.university.findUnique({ where: { id }, select: { id: true, code: true } });
    if (!university) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const loginConflict = await findLoginConflict(adminUsername, adminEmail);
    if (loginConflict) {
      return res.status(400).json({ success: false, message: loginConflict });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.$transaction(async (tx) => {
      // Older tenants may predate default provisioning
      await provisionTenantDefaults(tx, university.id);
      return createTenantAdmin(tx, {
        universityId: university.id,
        uid: adminUsername,
        email: String(adminEmail).trim().toLowerCase(),
        passwordHash: hashedPassword,
        displayName: adminName,
      });
    });

    await auditService.log({
      actorId: req.user?.id,
      universityId: university.id,
      action: `Created tenant admin ${admin.uid} for ${university.code}`,
      actionType: AuditActionType.CREATE,
      module: AuditModule.ADMIN,
      category: 'tenant_provisioning',
      severity: AuditSeverity.INFO,
      targetTable: 'user_login',
      targetId: admin.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const { role, universityId, ...adminSummary } = admin;
    res.status(201).json({ success: true, data: adminSummary, message: 'Admin created successfully' });
  } catch (error) {
    console.error('createUniversityAdmin error:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Admin username or email is already registered' });
    }
    res.status(500).json({ success: false, message: 'Failed to create tenant admin' });
  }
};
// =====================================
// Users <-> University linking
// =====================================

/**
 * List login accounts for linking (e.g. seeded accounts without a university).
 * GET /superadmin/users?unassigned=true&search=...&universityId=...
 */
exports.listUsers = async (req, res) => {
  try {
    const { unassigned, search, universityId } = req.query;
    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const where = { role: { not: 'superadmin' } };
    if (String(unassigned) === 'true') where.universityId = null;
    else if (universityId && UUID_RE.test(String(universityId))) where.universityId = String(universityId);
    if (search) {
      const term = String(search).trim().slice(0, 100);
      where.OR = [
        { uid: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }
    const users = await prisma.userLogin.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, uid: true, email: true, role: true, status: true, universityId: true, createdAt: true,
        university: { select: { id: true, code: true, name: true } },
      },
    });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('listUsers error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
};

/**
 * Attach an existing login account to a university.
 * PATCH /superadmin/users/:id/university  { universityId }
 *
 * Only accounts without a university (or already in the target one) can be linked:
 * moving a user between tenants would strand their tenant-owned records.
 */
exports.linkUserToUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const { universityId } = req.body || {};

    if (!UUID_RE.test(String(id || '')) || !UUID_RE.test(String(universityId || ''))) {
      return res.status(400).json({ success: false, message: 'Valid user id and universityId are required' });
    }

    const [user, university] = await Promise.all([
      prisma.userLogin.findUnique({ where: { id }, select: { id: true, uid: true, role: true, universityId: true } }),
      prisma.university.findUnique({ where: { id: universityId }, select: { id: true, code: true, name: true } }),
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!university) return res.status(404).json({ success: false, message: 'University not found' });
    if (user.role === 'superadmin') {
      return res.status(400).json({ success: false, message: 'Superadmin accounts are platform-level and cannot belong to a university' });
    }
    if (user.universityId && user.universityId !== universityId) {
      return res.status(409).json({
        success: false,
        message: 'User already belongs to another university. Moving users between universities is not supported.',
      });
    }

    const select = { id: true, uid: true, email: true, role: true, universityId: true };
    const changed = user.universityId !== universityId;
    const updated = changed
      ? await prisma.userLogin.update({ where: { id }, data: { universityId }, select })
      : await prisma.userLogin.findUnique({ where: { id }, select });

    // protect() caches the user (incl. universityId); drop it so the link applies immediately
    await cache.invalidateUser(id);

    if (changed) {
      await auditService.log({
        actorId: req.user?.id,
        universityId,
        action: `Linked user ${user.uid} to university ${university.code}`,
        actionType: AuditActionType.UPDATE,
        module: AuditModule.ADMIN,
        category: 'tenant_provisioning',
        severity: AuditSeverity.WARNING,
        targetTable: 'user_login',
        targetId: id,
        oldValues: { universityId: user.universityId },
        newValues: { universityId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.status(200).json({
      success: true,
      message: `User linked to ${university.name}`,
      data: { ...updated, university },
    });
  } catch (error) {
    console.error('linkUserToUniversity error:', error);
    res.status(500).json({ success: false, message: 'Failed to link user to university' });
  }
};
