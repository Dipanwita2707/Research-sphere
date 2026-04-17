/**
 * Direct test of analytics service for the user
 */
const prisma = require('./src/shared/config/database');

// Inline the core of the analytics check
async function main() {
  const userId = '494a6ed6-149c-4aad-b9e6-ae0e3eaf5e0a'; // sourav
  
  // ---- Replicate what the running backend does ----
  
  // 1. Get user + roleIds
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: { id: true, uid: true, role: true, assignedRoleIds: true }
  });
  console.log('User role:', user.role);
  console.log('User assignedRoleIds:', user.assignedRoleIds);

  // 2. Get centralDeptPermissions
  const directCentralPerms = await prisma.centralDepartmentPermission.findMany({
    where: { userId, isActive: true },
    select: {
      permissions: true,
      assignedSchoolIds: true,
      assignedResearchSchoolIds: true,
      assignedBookSchoolIds: true,
      assignedConferenceSchoolIds: true,
      assignedGrantSchoolIds: true,
    }
  });
  console.log('\ndirectCentralPerms count:', directCentralPerms.length);
  if (directCentralPerms.length > 0) {
    const p = directCentralPerms[0];
    console.log('  permissions (analytics keys):', Object.entries(p.permissions || {}).filter(([,v]) => v).filter(([k]) => k.includes('analytics')).map(([k]) => k));
    console.log('  assignedSchoolIds:', p.assignedSchoolIds);
    console.log('  assignedResearchSchoolIds:', p.assignedResearchSchoolIds);
    // Check if the analytics-specific field exists in the select result
    console.log('  "assignedResearchAnalyticsSchoolIds" in perm?', 'assignedResearchAnalyticsSchoolIds' in p);
    console.log('  "assignedSchoolIds" in perm?', 'assignedSchoolIds' in p);
  }

  // 3. Get assigned roles with analyticsScope
  const assignedRoles = await prisma.role.findMany({
    where: { id: { in: user.assignedRoleIds || [] }, isActive: true },
    select: { permissions: true, name: true }
  });
  console.log('\nAssigned roles count:', assignedRoles.length);
  assignedRoles.forEach(role => {
    const analyticsScope = role.permissions?.analyticsScope || {};
    console.log('  Role:', role.name);
    console.log('  analyticsScope:', JSON.stringify(analyticsScope));
    const permCheck = ['research_applicant_analytics', 'applicant_analytics'];
    const passes = permCheck.some(key => role.permissions?.centralDeptPermissions?.[key] === true);
    console.log('  permCheck passes?', passes);
  });

  // 4. Simulate scope resolution for 'research' category
  const SCHOOL_FIELD_TO_ANALYTICS_CATEGORY = {
    assignedResearchAnalyticsSchoolIds: 'research',
    assignedBookAnalyticsSchoolIds: 'book',
    assignedConferenceAnalyticsSchoolIds: 'conference',
    assignedIprAnalyticsSchoolIds: 'ipr',
    assignedGrantAnalyticsSchoolIds: 'grants',
  };
  const schoolFields = ['assignedResearchAnalyticsSchoolIds', 'assignedSchoolIds'];
  const explicitSchoolIds = [];

  // From direct perms
  directCentralPerms.forEach(perm => {
    schoolFields.forEach(field => {
      if (!(field in perm)) {
        console.log(`\n⚠ Field "${field}" NOT in directCentralPerm object — skipping`);
        return;
      }
      const vals = perm[field] || [];
      console.log(`\n✓ Field "${field}" in perm = ${JSON.stringify(vals)}`);
      explicitSchoolIds.push(...vals);
    });
  });

  // From roles
  assignedRoles.forEach(role => {
    const rolePerms = role.permissions || {};
    const permKeys = ['research_applicant_analytics', 'applicant_analytics'];
    if (!permKeys.some(key => rolePerms.centralDeptPermissions?.[key] === true)) return;
    const analyticsScope = rolePerms.analyticsScope || {};
    schoolFields.forEach(field => {
      const category = SCHOOL_FIELD_TO_ANALYTICS_CATEGORY[field];
      if (category) {
        const schools = analyticsScope[category]?.schools || [];
        console.log(`\n[ROLE] field="${field}" → category="${category}" → schools=${JSON.stringify(schools)}`);
        explicitSchoolIds.push(...schools);
      } else if (field === 'assignedSchoolIds') {
        console.log('\n[ROLE] field="assignedSchoolIds" → union all categories');
        Object.values(analyticsScope).forEach(catScope => {
          if (Array.isArray(catScope?.schools)) explicitSchoolIds.push(...catScope.schools);
        });
      }
    });
  });

  console.log('\n===== FINAL explicitSchoolIds =====', [...new Set(explicitSchoolIds)]);

  // 5. Check what records would be returned
  const schoolIds = [...new Set(explicitSchoolIds)];
  if (schoolIds.length > 0) {
    const count = await prisma.researchContribution.count({
      where: {
        AND: [
          { schoolId: { in: schoolIds } },
          { submittedAt: { gte: new Date('2026-01-03'), lte: new Date('2026-04-03T23:59:59.999Z') } },
          { publicationType: 'research_paper' }
        ]
      }
    });
    console.log('\n✅ Records matching scope query:', count);
  } else {
    console.log('\n❌ No school IDs resolved → 0 results would be returned');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
