const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('========================================================');
  console.log('  CLEANUP INVALID ASSIGNED ROLE IDS');
  console.log('========================================================');

  const roles = await prisma.role.findMany({
    select: { id: true, name: true, isActive: true },
  });

  const validRoleIds = new Set(roles.map((role) => role.id));
  const users = await prisma.userLogin.findMany({
    select: {
      id: true,
      uid: true,
      email: true,
      assignedRoleIds: true,
    },
  });

  const usersToFix = users
    .map((user) => {
      const assignedRoleIds = Array.isArray(user.assignedRoleIds) ? user.assignedRoleIds : [];
      const cleanedRoleIds = assignedRoleIds.filter((roleId) => validRoleIds.has(roleId));
      const invalidRoleIds = assignedRoleIds.filter((roleId) => !validRoleIds.has(roleId));

      return {
        ...user,
        cleanedRoleIds,
        invalidRoleIds,
      };
    })
    .filter((user) => user.invalidRoleIds.length > 0);

  if (usersToFix.length === 0) {
    console.log('No invalid assignedRoleIds found. Nothing to clean.');
    return;
  }

  console.log(`Found ${usersToFix.length} user(s) with invalid assignedRoleIds.\n`);

  await prisma.$transaction(async (tx) => {
    for (const user of usersToFix) {
      await tx.userLogin.update({
        where: { id: user.id },
        data: {
          assignedRoleIds: user.cleanedRoleIds,
        },
      });
    }
  });

  for (const user of usersToFix) {
    console.log(
      `Cleaned ${user.uid} (${user.email || 'no-email'}) -> removed: ${user.invalidRoleIds.join(', ')}`
    );
  }

  console.log('\nCleanup completed successfully.');
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });