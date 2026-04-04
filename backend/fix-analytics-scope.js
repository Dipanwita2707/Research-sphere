/**
 * Fix: Set assignedSchoolIds on user's centralDeptPermission
 * to match the school IDs in the role's analyticsScope.
 * This ensures analytics scope works regardless of which code version is running.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ENGINEERING_SCHOOL_ID = '61d56122-b492-4538-9b43-6202d0934264';
const USER_ID = '494a6ed6-149c-4aad-b9e6-ae0e3eaf5e0a'; // sourav test mukhopadhyay

async function main() {
  // Get current state
  const before = await prisma.centralDepartmentPermission.findFirst({
    where: { userId: USER_ID, isActive: true },
    select: { id: true, assignedSchoolIds: true, assignedResearchSchoolIds: true }
  });
  console.log('BEFORE:', JSON.stringify(before));

  // Update: set assignedSchoolIds to include the Engineering school
  const updated = await prisma.centralDepartmentPermission.update({
    where: { id: before.id },
    data: {
      assignedSchoolIds: [ENGINEERING_SCHOOL_ID],
      // Also set the category-specific school fields so they work too
      assignedResearchSchoolIds: [ENGINEERING_SCHOOL_ID],
      assignedBookSchoolIds: [ENGINEERING_SCHOOL_ID],
      assignedConferenceSchoolIds: [ENGINEERING_SCHOOL_ID],
      assignedGrantSchoolIds: [ENGINEERING_SCHOOL_ID],
    },
    select: { id: true, assignedSchoolIds: true, assignedResearchSchoolIds: true }
  });
  console.log('AFTER:', JSON.stringify(updated));
  console.log('\n✅ Done! The user should now see research analytics data.');
  console.log('Note: Clear Redis analytics cache or wait 2 minutes for cached results to expire.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
