/**
 * Gate Entry - Guardian/Parent Fetcher
 * Get student's parents/guardians for pass creation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get guardians for logged-in student
 * @param {string} userId - User Login ID
 * @returns {Array} List of guardians
 */
async function getStudentGuardians(userId) {
  try {
    // Get student details from UserLogin
    const userWithStudent = await prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        studentLogin: {
          include: {
            parents: {
              where: { isActive: true },
              orderBy: [
                { isPrimaryContact: 'desc' },
                { firstName: 'asc' }
              ]
            }
          }
        }
      }
    });

    if (!userWithStudent) {
      return [];
    }

    let studentRecord = userWithStudent.studentLogin;
    const uid = userWithStudent.uid ? String(userWithStudent.uid).trim() : null;
    const email = userWithStudent.email ? String(userWithStudent.email).trim() : null;

    // Fallback for older/deployed data where studentDetails.userLoginId may be missing
    // or not linked correctly. Prefer matching by UID==studentId, then by email.
    if (!studentRecord) {
      studentRecord = await prisma.studentDetails.findFirst({
        where: {
          OR: [
            ...(uid ? [{ studentId: uid }, { registrationNo: uid }] : []),
            ...(email ? [{ email }] : [])
          ]
        },
        include: {
          parents: {
            where: { isActive: true },
            orderBy: [
              { isPrimaryContact: 'desc' },
              { firstName: 'asc' }
            ]
          }
        }
      });
    }

    // Last fallback for UIDs like STU12201402 where studentId is numeric only.
    if (!studentRecord && uid) {
      const numericUid = uid.replace(/\D/g, '');
      if (numericUid) {
        studentRecord = await prisma.studentDetails.findFirst({
          where: {
            OR: [
              { studentId: numericUid },
              { registrationNo: numericUid }
            ]
          },
          include: {
            parents: {
              where: { isActive: true },
              orderBy: [
                { isPrimaryContact: 'desc' },
                { firstName: 'asc' }
              ]
            }
          }
        });
      }
    }

    if (!studentRecord) {
      return [];
    }

    const guardians = studentRecord.parents || [];

    // Transform to frontend format
    return guardians.map(parent => ({
      id: parent.id,
      name: `${parent.firstName} ${parent.lastName || ''}`.trim(),
      firstName: parent.firstName,
      lastName: parent.lastName,
      relationship: parent.relationship, // Father, Mother, Guardian
      phone: parent.phone,
      email: parent.email,
      occupation: parent.occupation,
      organization: parent.organization,
      address: parent.address,
      isPrimary: parent.isPrimaryContact
    }));

  } catch (error) {
    console.error('[GET GUARDIANS] Error:', error);
    throw error;
  }
}

module.exports = {
  getStudentGuardians
};
