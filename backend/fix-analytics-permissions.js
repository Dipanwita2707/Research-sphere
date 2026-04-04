/**
 * fix-analytics-permissions.js
 * Updates the analytics viewer's CentralDepartmentPermission to include
 * all seeded schools and departments so the data appears in the dashboard.
 * Run from backend/: node fix-analytics-permissions.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_USER_ID = '494a6ed6-149c-4aad-b9e6-ae0e3eaf5e0a';

async function main() {
  // 1. Fetch all seeded schools by code
  const schools = await prisma.facultySchoolList.findMany({
    where: { facultyCode: { in: ['SOE', 'SOM', 'SOS', 'ENG', 'MGT'] } },
    select: { id: true, facultyCode: true, facultyName: true },
  });
  console.log('Schools found:', schools.map((s) => `${s.facultyCode} (${s.id})`).join(', '));

  const schoolIds = schools.map((s) => s.id);

  // 2. Fetch all seeded departments
  const departments = await prisma.department.findMany({
    where: {
      departmentCode: { in: ['SOE-CSE', 'SOE-ECE', 'SOM-MBA', 'SOM-MKT', 'SOS-PHY', 'SOS-CHEM', 'MBA', 'ENG-CSE'] },
    },
    select: { id: true, departmentCode: true, departmentName: true },
  });
  console.log('Departments found:', departments.map((d) => `${d.departmentCode} (${d.id})`).join(', '));

  const departmentIds = departments.map((d) => d.id);

  // 3. Fetch the existing permission for the target user
  const perm = await prisma.centralDepartmentPermission.findFirst({
    where: { userId: TARGET_USER_ID },
  });

  if (!perm) {
    console.error('No CentralDepartmentPermission found for user', TARGET_USER_ID);
    process.exit(1);
  }
  console.log('\nExisting permission ID:', perm.id);
  console.log('Current assignedSchoolIds:', JSON.stringify(perm.assignedSchoolIds));

  // 4. Update all school-scope and monthly-report fields (these are in Prisma schema)
  const updated = await prisma.centralDepartmentPermission.update({
    where: { id: perm.id },
    data: {
      assignedSchoolIds: schoolIds,
      assignedResearchSchoolIds: schoolIds,
      assignedBookSchoolIds: schoolIds,
      assignedConferenceSchoolIds: schoolIds,
      assignedGrantSchoolIds: schoolIds,
      assignedMonthlyReportSchoolIds: schoolIds,
      assignedMonthlyReportDepartmentIds: departmentIds,
    },
  });
  console.log('\n✅ Updated assignedSchoolIds:', JSON.stringify(updated.assignedSchoolIds));
  console.log('✅ Updated assignedMonthlyReportDepartmentIds:', JSON.stringify(updated.assignedMonthlyReportDepartmentIds));

  // 5. Try to update the analytics-specific department columns via raw SQL
  //    (these columns may exist in DB but not in Prisma schema yet)
  const deptArray = JSON.stringify(departmentIds);
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE central_department_permission
      SET
        assigned_research_analytics_department_ids = $1::jsonb,
        assigned_book_analytics_department_ids     = $1::jsonb,
        assigned_conference_analytics_department_ids = $1::jsonb,
        assigned_ipr_analytics_department_ids      = $1::jsonb,
        assigned_grant_analytics_department_ids    = $1::jsonb
      WHERE id = $2::uuid
    `, deptArray, perm.id);
    console.log('✅ Raw SQL: analytics department columns updated');
  } catch (e) {
    // Columns may not exist yet — that is fine; school scope covers everything
    console.log('ℹ️  Raw SQL department columns skipped (columns may not exist):', e.message);
  }

  // 6. Also try the analytics-specific school columns via raw SQL
  const schoolArray = JSON.stringify(schoolIds);
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE central_department_permission
      SET
        assigned_research_analytics_school_ids     = $1::jsonb,
        assigned_book_analytics_school_ids         = $1::jsonb,
        assigned_conference_analytics_school_ids   = $1::jsonb,
        assigned_ipr_analytics_school_ids          = $1::jsonb,
        assigned_grant_analytics_school_ids        = $1::jsonb
      WHERE id = $2::uuid
    `, schoolArray, perm.id);
    console.log('✅ Raw SQL: analytics school columns updated');
  } catch (e) {
    console.log('ℹ️  Raw SQL school columns skipped (columns may not exist):', e.message);
  }

  console.log('\n🎉 Permission fix complete!');
  console.log('Schools in scope:', schools.map((s) => s.facultyCode).join(', '));
  console.log('Departments in scope:', departments.map((d) => d.departmentCode).join(', '));
  console.log('\nNow run: node clear-analytics-cache.js');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
