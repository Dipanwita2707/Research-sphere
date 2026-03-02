// Simulate what getMyNotingPermissions controller does for Aisha Singh
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Import getDefaultPermissions
const { getDefaultPermissions } = require('./src/shared/config/permissions.config');

async function main() {
  const userId = '7a160bae-2466-4131-bdd5-22dba14d5438'; // Aisha Singh
  
  const user = await p.userLogin.findUnique({
    where: { id: userId },
    select: {
      id: true, uid: true, email: true, role: true,
      centralDeptPermissions: true,
      schoolDeptPermissions: true,
      assignedRoleIds: true,
    }
  });

  console.log('User:', user.uid, user.email, 'role:', user.role);

  // Step 1: Get defaults for student role
  const defaults = getDefaultPermissions(user.role);
  console.log('\nStudent defaults noting_create:', defaults.noting_create);
  console.log('Student defaults noting_view_own:', defaults.noting_view_own);

  // Step 2: Check club
  const chairClub = await p.club.findFirst({
    where: {
      chairpersonId: userId,
      status: { in: ['approved', 'active'] },
    },
    select: { id: true, clubId: true, name: true, status: true },
  });
  
  console.log('\nChairperson club:', chairClub ? `${chairClub.name} (${chairClub.status})` : 'NONE');

  // Step 3: Simulate result
  const result = {};
  const NOTING_PERM_KEYS = [
    'noting_create', 'noting_view_own', 'noting_view_department', 'noting_view_all',
    'noting_approve', 'noting_forward', 'noting_return', 'noting_add_comment',
    'noting_reject', 'noting_not_recommend',
  ];

  const allDeptPermissions = [
    ...(Array.isArray(user.centralDeptPermissions) ? user.centralDeptPermissions : []),
    ...(Array.isArray(user.schoolDeptPermissions) ? user.schoolDeptPermissions : []),
  ];

  for (const key of NOTING_PERM_KEYS) {
    if (defaults[key] === true) {
      result[key] = true;
      continue;
    }
    result[key] = allDeptPermissions.some(
      (dp) => dp.permissions && (dp.permissions[key] === true)
    );
  }

  // Chairperson override
  if (user.role === 'student' && !result.noting_create && chairClub) {
    result.noting_create = true;
    result.noting_view_own = true;
    result.isClubChairperson = true;
    result.chairpersonClubId = chairClub.id;
    result.chairpersonClubName = chairClub.name;
  }

  console.log('\nFinal result:');
  console.log('  noting_create:', result.noting_create);
  console.log('  noting_view_own:', result.noting_view_own);
  console.log('  isClubChairperson:', result.isClubChairperson);
  console.log('  chairpersonClubName:', result.chairpersonClubName);

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
