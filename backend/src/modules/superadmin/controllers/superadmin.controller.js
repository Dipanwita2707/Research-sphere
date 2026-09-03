const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { generateAffiliationVariants } = require('../../../shared/utils/affiliationEngine');
const { invalidateUniversityAffiliationCache } = require('../../core/services/affiliation.service');

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
        logoUrl: uni.logoUrl,
        primaryColor: uni.primaryColor,
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
      prisma.program.count({ where: { department: { faculty: { universityId: id } } } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...uni,
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
  const { code, name, slug, contactEmail, websiteUrl, tierId, adminUsername, adminPassword, adminEmail } = req.body;

  if (!code || !name || !slug || !tierId || !adminUsername || !adminPassword || !adminEmail) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
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

    // Check duplicate admin username
    const existingUser = await prisma.userLogin.findUnique({
      where: { uid: adminUsername }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `Admin username "${adminUsername}" is already taken`,
      });
    }

    // Email is globally unique across all tenants — reject early with a clear message
    const existingEmail = await prisma.userLogin.findFirst({
      where: { email: { equals: String(adminEmail).trim(), mode: 'insensitive' } },
      select: { uid: true, email: true },
    });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `Admin email "${adminEmail}" is already registered (user: ${existingEmail.uid}). Use a different admin email.`,
      });
    }

    // Fetch Tier
    const tier = await prisma.saaSTier.findUnique({
      where: { id: tierId }
    });

    if (!tier) {
      return res.status(400).json({ success: false, message: 'SaaS tier not found' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create university, subscription and admin user in a transaction
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

      // Provision Admin User
      const admin = await tx.userLogin.create({
        data: {
          uid: adminUsername,
          email: String(adminEmail).trim().toLowerCase(),
          passwordHash: hashedPassword,
          role: 'admin',
          status: 'active',
          universityId: university.id
        }
      });

      return { university, admin };
    });

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
    name, logoUrl, primaryColor, contactEmail, websiteUrl, isActive,
    address, city, state, country, affiliationAliases,
  } = req.body;

  try {
    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const updateData = {
      name,
      logoUrl,
      primaryColor,
      contactEmail,
      websiteUrl,
      isActive: isActive !== undefined ? isActive : uni.isActive,
    };
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (Array.isArray(affiliationAliases)) {
      updateData.affiliationAliases = affiliationAliases
        .map((alias) => String(alias || '').trim())
        .filter(Boolean);
    }

    const updated = await prisma.university.update({
      where: { id },
      data: updateData,
    });

    // Affiliation variants depend on name/city/state/aliases — invalidate the
    // cached variant list so the next lookup reflects this change.
    await invalidateUniversityAffiliationCache(id);

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
    const { adminUsername, adminEmail, adminPassword } = req.body;
    
    if (!adminUsername || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: 'Missing required admin credentials' });
    }

    // Check duplicate admin username
    const existingUser = await prisma.userLogin.findUnique({
      where: { uid: adminUsername }
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Admin username is already taken' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.userLogin.create({
      data: {
        uid: adminUsername,
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'admin',
        status: 'active',
        universityId: id
      },
      select: { id: true, uid: true, email: true, status: true, createdAt: true }
    });

    res.status(201).json({ success: true, data: admin, message: 'Admin created successfully' });
  } catch (error) {
    console.error('createUniversityAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to create tenant admin' });
  }
};