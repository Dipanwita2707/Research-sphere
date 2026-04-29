const prisma = require('../../../shared/config/database');

function formatPrintedBy(user) {
  const name = user?.employeeDetails?.displayName
    || (user?.employeeDetails ? `${user.employeeDetails.firstName} ${user.employeeDetails.lastName || ''}`.trim() : user?.uid || 'Unknown');

  return {
    uid: user?.uid || 'N/A',
    name,
  };
}

class FinanceAnalyticsService {
  /**
   * Get summary counts for fee structures and loan letters
   */
  async getSummary() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, now.getMonth(), 1);
    const startOfYear = new Date(currentYear, 0, 1);

    const [transportCount, hostelCount, academicCount, totalLetters, thisMonthLetters, thisYearLetters] = await Promise.all([
      prisma.feeStructure.count({ where: { type: 'TRANSPORT' } }),
      prisma.feeStructure.count({ where: { type: 'HOSTEL' } }),
      prisma.feeStructure.count({ where: { type: 'ACADEMIC' } }),
      prisma.loanLetter.count(),
      prisma.loanLetter.count({ where: { issuedAt: { gte: startOfMonth } } }),
      prisma.loanLetter.count({ where: { issuedAt: { gte: startOfYear } } }),
    ]);

    return {
      feeStructures: { TRANSPORT: transportCount, HOSTEL: hostelCount, ACADEMIC: academicCount },
      loanLetters: { total: totalLetters, thisMonth: thisMonthLetters, thisYear: thisYearLetters },
    };
  }

  /**
   * Get programme-wise academic fee breakdown (with specialization)
   */
  async getProgramFeeBreakdown() {
    const structures = await prisma.feeStructure.findMany({
      where: { type: 'ACADEMIC' },
      include: {
        program: {
          select: {
            id: true, programCode: true, programName: true,
            department: {
              select: {
                id: true, departmentCode: true, departmentName: true,
                faculty: { select: { id: true, facultyCode: true, facultyName: true } },
              },
            },
          },
        },
        specialization: { select: { id: true, specializationCode: true, specializationName: true } },
        heads: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const breakdown = {};
    for (const fs of structures) {
      if (!fs.program) continue;
      const key = fs.program.id;
      if (!breakdown[key]) {
        breakdown[key] = {
          programId: fs.program.id,
          programCode: fs.program.programCode,
          programName: fs.program.programName,
          schoolId: fs.program.department?.faculty?.id || null,
          schoolName: fs.program.department?.faculty?.facultyName || null,
          departmentId: fs.program.department?.id || null,
          departmentName: fs.program.department?.departmentName || null,
          totalStructures: 0,
          totalAmount: 0,
          specializations: [],
        };
      }
      const structureTotal = fs.heads.reduce((sum, h) => sum + Number(h.amount), 0);
      breakdown[key].totalStructures += 1;
      breakdown[key].totalAmount += structureTotal;
      // Collect all semester keys across all heads
      const allSemesters = new Set();
      fs.heads.forEach(h => {
        if (h.semesterAmounts && typeof h.semesterAmounts === 'object') {
          Object.keys(h.semesterAmounts).forEach(s => allSemesters.add(Number(s)));
        }
      });
      breakdown[key].specializations.push({
        id: fs.specialization ? fs.specialization.id : null,
        code: fs.specialization ? fs.specialization.specializationCode : null,
        name: fs.specialization ? fs.specialization.specializationName : null,
        amount: structureTotal,
        batchYear: fs.batchYear,
        semesters: Array.from(allSemesters).sort((a, b) => a - b),
        heads: fs.heads.map(h => ({
          headName: h.headName,
          amount: Number(h.amount),
          semesterAmounts: h.semesterAmounts || null,
        })),
      });
    }

    return Object.values(breakdown);
  }

  /**
   * Get loan letters grouped by programme (with individual letter details)
   */
  async getLoanLettersByProgram() {
    const groups = await prisma.loanLetter.groupBy({
      by: ['programId', 'programCode', 'programName'],
      _count: { _all: true },
    });

    return groups
      .map((group) => ({
        programId: group.programId,
        programCode: group.programCode,
        programName: group.programName,
        count: group._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get loan letters grouped by school (via programme → department → school)
   */
  async getLoanLettersBySchool() {
    const groups = await prisma.loanLetter.groupBy({
      by: ['programId'],
      _count: { _all: true },
    });

    const programIds = groups.map((group) => group.programId).filter(Boolean);
    const programs = programIds.length > 0
      ? await prisma.program.findMany({
          where: { id: { in: programIds } },
          select: {
            id: true,
            department: {
              select: {
                faculty: { select: { id: true, facultyCode: true, facultyName: true } },
              },
            },
          },
        })
      : [];

    const programMap = new Map(programs.map((program) => [program.id, program]));
    const schoolMap = {};
    for (const group of groups) {
      const faculty = programMap.get(group.programId)?.department?.faculty;
      const count = group._count._all;
      if (!faculty) {
        const k = '__unknown__';
        schoolMap[k] = schoolMap[k] || { schoolId: null, schoolCode: 'N/A', schoolName: 'Unknown', count: 0 };
        schoolMap[k].count += count;
        continue;
      }
      if (!schoolMap[faculty.id]) {
        schoolMap[faculty.id] = {
          schoolId: faculty.id,
          schoolCode: faculty.facultyCode,
          schoolName: faculty.facultyName,
          count: 0,
        };
      }
      schoolMap[faculty.id].count += count;
    }
    return Object.values(schoolMap).sort((a, b) => b.count - a.count);
  }

  /**
   * Get loan letters grouped by issuing staff member (with individual letter details)
   */
  async getLoanLettersByStaff() {
    const groups = await prisma.loanLetter.groupBy({
      by: ['printedById'],
      _count: { _all: true },
    });

    const staffIds = groups.map((group) => group.printedById).filter(Boolean);
    const staffMembers = staffIds.length > 0
      ? await prisma.userLogin.findMany({
          where: { id: { in: staffIds } },
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
          },
        })
      : [];

    const staffMap = new Map(staffMembers.map((user) => [user.id, user]));

    return groups
      .map((group) => {
        const user = group.printedById ? staffMap.get(group.printedById) : null;
        return {
          staffId: group.printedById || null,
          ...formatPrintedBy(user),
          count: group._count._all,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get month-wise loan letter trend for current year
   */
  async getLoanLetterMonthlyTrend() {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const letters = await prisma.loanLetter.findMany({
      where: { issuedAt: { gte: startOfYear } },
      select: { issuedAt: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(currentYear, i, 1).toLocaleString('en-IN', { month: 'short' }),
      count: 0,
    }));
    for (const l of letters) {
      const m = new Date(l.issuedAt).getMonth();
      months[m].count += 1;
    }
    return months;
  }

  async getProgramLoanLetterDetails({ programId, page = 1, limit = 20 }) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [letters, total] = await Promise.all([
      prisma.loanLetter.findMany({
        where: { programId },
        select: {
          id: true,
          uniqueNumber: true,
          applicationNumber: true,
          studentName: true,
          relationPrefix: true,
          relationName: true,
          selectedSemesters: true,
          transportIncluded: true,
          hostelIncluded: true,
          issuedAt: true,
          specialization: { select: { id: true, specializationCode: true, specializationName: true } },
          printedBy: {
            select: {
              uid: true,
              employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip,
        take,
      }),
      prisma.loanLetter.count({ where: { programId } }),
    ]);

    return {
      data: letters.map((letter) => ({
        id: letter.id,
        uniqueNumber: letter.uniqueNumber,
        applicationNumber: letter.applicationNumber,
        studentName: letter.studentName,
        relationPrefix: letter.relationPrefix,
        relationName: letter.relationName,
        selectedSemesters: letter.selectedSemesters,
        transportIncluded: letter.transportIncluded,
        hostelIncluded: letter.hostelIncluded,
        specialization: letter.specialization,
        issuedAt: letter.issuedAt,
        printedBy: formatPrintedBy(letter.printedBy),
      })),
      total,
      page: Number(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getStaffLoanLetterDetails({ staffId, page = 1, limit = 20 }) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = staffId === 'unknown'
      ? { printedById: null }
      : { printedById: staffId };

    const [letters, total] = await Promise.all([
      prisma.loanLetter.findMany({
        where,
        select: {
          id: true,
          uniqueNumber: true,
          applicationNumber: true,
          studentName: true,
          relationPrefix: true,
          relationName: true,
          programCode: true,
          programName: true,
          selectedSemesters: true,
          transportIncluded: true,
          hostelIncluded: true,
          issuedAt: true,
          specialization: { select: { specializationCode: true, specializationName: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip,
        take,
      }),
      prisma.loanLetter.count({ where }),
    ]);

    return {
      data: letters,
      total,
      page: Number(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }
}

module.exports = new FinanceAnalyticsService();
