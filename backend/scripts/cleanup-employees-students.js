/**
 * Delete ALL employees and students (and linked faculty/staff/student/parent logins).
 * Keeps admin / superadmin UserLogin accounts.
 *
 * Usage (from backend/): node scripts/cleanup-employees-students.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function safe(label, fn) {
  try {
    const result = await fn();
    const count = result?.count ?? result;
    if (count !== undefined) console.log(`  ${label}: ${count}`);
    return result;
  } catch (e) {
    console.warn(`  skip ${label}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

async function main() {
  const before = {
    employees: await prisma.employeeDetails.count(),
    students: await prisma.studentDetails.count(),
    parents: await prisma.parentDetails.count(),
    facultyLogins: await prisma.userLogin.count({ where: { role: 'faculty' } }),
    staffLogins: await prisma.userLogin.count({ where: { role: 'staff' } }),
    studentLogins: await prisma.userLogin.count({ where: { role: 'student' } }),
    parentLogins: await prisma.userLogin.count({ where: { role: 'parent' } }),
    adminLogins: await prisma.userLogin.count({
      where: { role: { in: ['admin', 'superadmin'] } },
    }),
  };
  console.log('BEFORE:', before);

  const usersToDelete = await prisma.userLogin.findMany({
    where: { role: { in: ['student', 'faculty', 'staff', 'parent'] } },
    select: { id: true },
  });
  const userIds = usersToDelete.map((u) => u.id);
  console.log(`Target user_login rows: ${userIds.length}`);
  console.log(`Keeping admin/superadmin: ${before.adminLogins}`);

  // Use a long transaction; delete in FK-safe order
  await prisma.$transaction(
    async (tx) => {
      if (userIds.length > 0) {
        console.log('Nulling / clearing references...');

        await safe('student mentorId', () =>
          tx.studentDetails.updateMany({
            where: { mentorId: { in: userIds } },
            data: { mentorId: null },
          })
        );
        await safe('student dataApprovedById', () =>
          tx.studentDetails.updateMany({
            where: { dataApprovedById: { in: userIds } },
            data: { dataApprovedById: null },
          })
        );
        await safe('department heads', () =>
          tx.department.updateMany({
            where: { headOfDepartmentId: { in: userIds } },
            data: { headOfDepartmentId: null },
          })
        );
        await safe('faculty school heads', () =>
          tx.facultySchoolList.updateMany({
            where: { headOfFacultyId: { in: userIds } },
            data: { headOfFacultyId: null },
          })
        );
        await safe('central dept heads', () =>
          tx.centralDepartment.updateMany({
            where: { headOfDepartmentId: { in: userIds } },
            data: { headOfDepartmentId: null },
          })
        );
        await safe('program coordinators', () =>
          tx.program.updateMany({
            where: { programCoordinatorId: { in: userIds } },
            data: { programCoordinatorId: null },
          })
        );
        await safe('section class teachers', () =>
          tx.section.updateMany({
            where: { classTeacherId: { in: userIds } },
            data: { classTeacherId: null },
          })
        );

        await safe('reportingStructure', () =>
          tx.reportingStructure.deleteMany({
            where: {
              OR: [{ userId: { in: userIds } }, { managerId: { in: userIds } }],
            },
          })
        );
        await safe('userDepartmentPermission', () =>
          tx.userDepartmentPermission.deleteMany({
            where: {
              OR: [{ userId: { in: userIds } }, { assignedById: { in: userIds } }],
            },
          })
        );
        await safe('departmentPermission', () =>
          tx.departmentPermission.deleteMany({
            where: {
              OR: [{ userId: { in: userIds } }, { assignedById: { in: userIds } }],
            },
          })
        );
        await safe('centralDepartmentPermission', () =>
          tx.centralDepartmentPermission.deleteMany({
            where: {
              OR: [{ userId: { in: userIds } }, { assignedById: { in: userIds } }],
            },
          })
        );

        await safe('notifications', () =>
          tx.notification.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('userSettings', () =>
          tx.userSettings.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('passwordResetToken', () =>
          tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('bugReports', () =>
          tx.bugReport.deleteMany({ where: { userId: { in: userIds } } })
        );

        // Research
        console.log('Clearing research data...');
        await safe('researchContributionAuthor', () =>
          tx.researchContributionAuthor.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('researchContributionReview', () =>
          tx.researchContributionReview.deleteMany({
            where: { reviewerId: { in: userIds } },
          })
        );
        await safe('researchContributionStatusHistory', () =>
          tx.researchContributionStatusHistory.deleteMany({
            where: { changedById: { in: userIds } },
          })
        );
        await safe('researchContributionEditSuggestion', () =>
          tx.researchContributionEditSuggestion.deleteMany({
            where: { suggestedById: { in: userIds } },
          })
        );

        const contribs = await tx.researchContribution.findMany({
          where: {
            OR: [
              { applicantUserId: { in: userIds } },
              { currentReviewerId: { in: userIds } },
            ],
          },
          select: { id: true },
        });
        const contribIds = contribs.map((c) => c.id);
        if (contribIds.length) {
          await safe('contrib authors by contrib', () =>
            tx.researchContributionAuthor.deleteMany({
              where: { contributionId: { in: contribIds } },
            })
          );
          await safe('contrib reviews by contrib', () =>
            tx.researchContributionReview.deleteMany({
              where: { contributionId: { in: contribIds } },
            })
          );
          await safe('contrib status by contrib', () =>
            tx.researchContributionStatusHistory.deleteMany({
              where: { contributionId: { in: contribIds } },
            })
          );
          await safe('contrib edits by contrib', () =>
            tx.researchContributionEditSuggestion.deleteMany({
              where: { contributionId: { in: contribIds } },
            })
          );
          // null reviewer before delete where still pointing
          await safe('null currentReviewerId', () =>
            tx.researchContribution.updateMany({
              where: { currentReviewerId: { in: userIds } },
              data: { currentReviewerId: null },
            })
          );
          await safe('researchContribution', () =>
            tx.researchContribution.deleteMany({
              where: { applicantUserId: { in: userIds } },
            })
          );
        }
        await safe('null remaining reviewers', () =>
          tx.researchContribution.updateMany({
            where: { currentReviewerId: { in: userIds } },
            data: { currentReviewerId: null },
          })
        );

        await safe('researchProgressTracker', () =>
          tx.researchProgressTracker.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('researchProfileIdentity', () =>
          tx.researchProfileIdentity.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('publicationImportRun', () =>
          tx.publicationImportRun.deleteMany({
            where: { triggeredById: { in: userIds } },
          })
        );
        await safe('researchPaperReview', () =>
          tx.researchPaperReview.deleteMany({ where: { reviewerId: { in: userIds } } })
        );
        await safe('researchPaperStatusHistory', () =>
          tx.researchPaperStatusHistory.deleteMany({
            where: { changedById: { in: userIds } },
          })
        );
        await safe('researchPaper', () =>
          tx.researchPaper.deleteMany({ where: { submittedById: { in: userIds } } })
        );

        // Grants
        console.log('Clearing grant data...');
        await safe('grantInvestigator', () =>
          tx.grantInvestigator.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('grantApplicationReview', () =>
          tx.grantApplicationReview.deleteMany({
            where: { reviewerId: { in: userIds } },
          })
        );
        await safe('grantApplicationStatusHistory', () =>
          tx.grantApplicationStatusHistory.deleteMany({
            where: { changedById: { in: userIds } },
          })
        );
        await safe('grantApplicationEditSuggestion', () =>
          tx.grantApplicationEditSuggestion.deleteMany({
            where: { suggestedById: { in: userIds } },
          })
        );
        await safe('grantApplication', () =>
          tx.grantApplication.deleteMany({
            where: { applicantUserId: { in: userIds } },
          })
        );

        // IPR
        console.log('Clearing IPR data...');
        await safe('iprContributor', () =>
          tx.iprContributor.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('iprReview', () =>
          tx.iprReview.deleteMany({ where: { reviewerId: { in: userIds } } })
        );
        await safe('iprStatusHistory', () =>
          tx.iprStatusHistory.deleteMany({ where: { changedById: { in: userIds } } })
        );
        await safe('iprStatusUpdate', () =>
          tx.iprStatusUpdate.deleteMany({ where: { createdById: { in: userIds } } })
        );
        await safe('iprEditSuggestion', () =>
          tx.iprEditSuggestion.deleteMany({
            where: { suggestedById: { in: userIds } },
          })
        );
        await safe('iprFinance', () =>
          tx.iprFinance.deleteMany({ where: { reviewedById: { in: userIds } } })
        );
        await safe('iprCollaborativeSession', () =>
          tx.iprCollaborativeSession.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('iPRDocument', () =>
          tx.iPRDocument.deleteMany({ where: { uploadedById: { in: userIds } } })
        );
        await safe('iprApplication', () =>
          tx.iprApplication.deleteMany({
            where: { applicantUserId: { in: userIds } },
          })
        );
        await safe('null IPR approver', () =>
          tx.iPR.updateMany({
            where: { approvedById: { in: userIds } },
            data: { approvedById: null },
          })
        );
        await safe('iPR', () =>
          tx.iPR.deleteMany({ where: { createdById: { in: userIds } } })
        );

        await safe('reissueRequest', () =>
          tx.reissueRequest.deleteMany({
            where: {
              OR: [
                { requestedById: { in: userIds } },
                { approvedById: { in: userIds } },
              ],
            },
          })
        );
        await safe('null card issuedBy', () =>
          tx.card.updateMany({
            where: { issuedById: { in: userIds } },
            data: { issuedById: null },
          })
        );
        await safe('auditLog', () =>
          tx.auditLog.deleteMany({ where: { userId: { in: userIds } } })
        );
        await safe('changeHistory', () =>
          tx.changeHistory.deleteMany({ where: { userId: { in: userIds } } })
        );
      }

      console.log('Deleting employee / student / parent details...');
      await safe('employeeDetails', () => tx.employeeDetails.deleteMany({}));
      await safe('parentDetails', () => tx.parentDetails.deleteMany({}));
      await safe('studentDetails', () => tx.studentDetails.deleteMany({}));

      if (userIds.length > 0) {
        console.log('Deleting user_login (non-admin)...');
        // Final catch-all: any remaining FK blockers — use raw DELETE with cascade where DB allows
        await safe('userLogin', () =>
          tx.userLogin.deleteMany({ where: { id: { in: userIds } } })
        );
      }
    },
    { timeout: 600000, maxWait: 60000 }
  );

  // If userLogin delete failed inside transaction due to remaining FKs, try raw SQL outside
  const remaining = await prisma.userLogin.count({
    where: { role: { in: ['student', 'faculty', 'staff', 'parent'] } },
  });
  if (remaining > 0) {
    console.log(`Retrying ${remaining} leftover user_login via SQL...`);
    await prisma.$executeRawUnsafe(`
      DELETE FROM user_login
      WHERE role IN ('student', 'faculty', 'staff', 'parent')
    `).catch(async (e) => {
      console.warn('Bulk role delete failed:', e.message.split('\n')[0]);
      // Last resort: report blockers
      const blockers = await prisma.$queryRawUnsafe(`
        SELECT conrelid::regclass AS table_name, confrelid::regclass AS refs
        FROM pg_constraint
        WHERE confrelid = 'user_login'::regclass AND contype = 'f'
        LIMIT 30
      `);
      console.log('FK constraints on user_login:', blockers);
      throw e;
    });
  }

  const after = {
    employees: await prisma.employeeDetails.count(),
    students: await prisma.studentDetails.count(),
    parents: await prisma.parentDetails.count(),
    facultyLogins: await prisma.userLogin.count({ where: { role: 'faculty' } }),
    staffLogins: await prisma.userLogin.count({ where: { role: 'staff' } }),
    studentLogins: await prisma.userLogin.count({ where: { role: 'student' } }),
    parentLogins: await prisma.userLogin.count({ where: { role: 'parent' } }),
    adminLogins: await prisma.userLogin.count({
      where: { role: { in: ['admin', 'superadmin'] } },
    }),
  };
  console.log('AFTER:', after);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('CLEANUP FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
