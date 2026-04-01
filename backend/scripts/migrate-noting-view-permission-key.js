const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LEGACY_KEY = 'noting_view_pending';
const CANONICAL_KEY = 'noting_view_department';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePermissionMap(rawPermissions) {
  if (!isPlainObject(rawPermissions)) {
    return { updated: false, permissions: rawPermissions };
  }

  const permissions = { ...rawPermissions };
  let updated = false;

  if (permissions[LEGACY_KEY] === true && permissions[CANONICAL_KEY] !== true) {
    permissions[CANONICAL_KEY] = true;
    updated = true;
  }

  return { updated, permissions };
}

function normalizeRolePermissions(rawRolePermissions) {
  if (!isPlainObject(rawRolePermissions)) {
    return { updated: false, permissions: rawRolePermissions };
  }

  const permissions = { ...rawRolePermissions };
  let updated = false;

  if (isPlainObject(permissions.centralDeptPermissions)) {
    const result = normalizePermissionMap(permissions.centralDeptPermissions);
    if (result.updated) {
      permissions.centralDeptPermissions = result.permissions;
      updated = true;
    }
  }

  if (isPlainObject(permissions.schoolDeptPermissions)) {
    const result = normalizePermissionMap(permissions.schoolDeptPermissions);
    if (result.updated) {
      permissions.schoolDeptPermissions = result.permissions;
      updated = true;
    }
  }

  // Backward compatibility for any role payloads that stored a flat map.
  const flatResult = normalizePermissionMap(permissions);
  if (flatResult.updated) {
    updated = true;
  }

  return { updated, permissions: flatResult.permissions };
}

async function migratePermissionRecords({
  model,
  modelName,
  normalizer,
  dryRun,
}) {
  const records = await model.findMany({
    select: { id: true, permissions: true },
  });

  let updatedCount = 0;

  for (const record of records) {
    const result = normalizer(record.permissions);
    if (!result.updated) continue;

    updatedCount += 1;
    if (dryRun) continue;

    await model.update({
      where: { id: record.id },
      data: { permissions: result.permissions },
    });
  }

  console.log(`${modelName}: scanned ${records.length}, updated ${updatedCount}${dryRun ? ' (dry-run)' : ''}`);
  return { scanned: records.length, updated: updatedCount };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('========================================================');
  console.log('  MIGRATE NOTING VIEW PERMISSION KEY');
  console.log('========================================================');
  console.log(`Legacy key   : ${LEGACY_KEY}`);
  console.log(`Canonical key: ${CANONICAL_KEY}`);
  console.log(`Mode         : ${dryRun ? 'DRY RUN' : 'WRITE'}`);

  const centralSummary = await migratePermissionRecords({
    model: prisma.centralDepartmentPermission,
    modelName: 'CentralDepartmentPermission',
    normalizer: normalizePermissionMap,
    dryRun,
  });

  const schoolSummary = await migratePermissionRecords({
    model: prisma.departmentPermission,
    modelName: 'DepartmentPermission',
    normalizer: normalizePermissionMap,
    dryRun,
  });

  const roles = await prisma.role.findMany({
    select: { id: true, permissions: true },
  });

  let roleUpdatedCount = 0;
  for (const role of roles) {
    const result = normalizeRolePermissions(role.permissions);
    if (!result.updated) continue;

    roleUpdatedCount += 1;
    if (dryRun) continue;

    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: result.permissions },
    });
  }

  console.log(`Role: scanned ${roles.length}, updated ${roleUpdatedCount}${dryRun ? ' (dry-run)' : ''}`);

  const totalUpdated = centralSummary.updated + schoolSummary.updated + roleUpdatedCount;
  console.log('--------------------------------------------------------');
  console.log(`Total records updated: ${totalUpdated}${dryRun ? ' (dry-run)' : ''}`);
  console.log('Migration completed.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
