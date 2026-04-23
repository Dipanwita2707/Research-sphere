const { Prisma } = require('@prisma/client');
const prisma = require('../../../shared/config/database');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../../audit/services/audit.service');

const REPRINT_ACTION = 'Loan letter reprinted';
const LOAN_LETTER_APPLICATION_INDEX = 'loan_letter_application_number_unique_ci';

function isUniqueViolation(error, targets = []) {
  if (!error) return false;

  if (error.code === 'P2002') {
    if (targets.length === 0) return true;
    const targetValues = Array.isArray(error.meta?.target)
      ? error.meta.target
      : error.meta?.target
        ? [String(error.meta.target)]
        : [];
    return targetValues.length === 0 || targets.some((target) => targetValues.includes(target));
  }

  return error.code === '23505'
    || targets.some((target) => String(error.message || '').includes(target));
}

function formatUserDisplayName(user) {
  return user?.employeeDetails?.displayName
    || (user?.employeeDetails ? `${user.employeeDetails.firstName} ${user.employeeDetails.lastName || ''}`.trim() : user?.uid || 'Unknown');
}

function latestFeeStructure(where) {
  return prisma.feeStructure.findFirst({
    where,
    include: { heads: { orderBy: { headName: 'asc' } } },
    orderBy: { batchYear: 'desc' },
  });
}

async function allocateLoanLetterSequence(tx, year) {
  const rows = await tx.$queryRaw`
    INSERT INTO "loan_letter_counter" ("counter_year", "last_value", "updated_at")
    VALUES (${year}, 1, NOW())
    ON CONFLICT ("counter_year")
    DO UPDATE SET
      "last_value" = "loan_letter_counter"."last_value" + 1,
      "updated_at" = NOW()
    RETURNING "last_value"
  `;

  const nextValue = Number(rows?.[0]?.last_value || 0);
  return `LL-${year}-${String(nextValue).padStart(5, '0')}`;
}

class LoanLetterService {
  /**
   * Generate the next unique loan letter number for a given year: LL-YYYY-00001
   */
  async generateUniqueNumber(year, tx = prisma) {
    return allocateLoanLetterSequence(tx, year);
  }

  async getReprintMap(letterIds) {
    if (!letterIds?.length) return {};

    const logs = await prisma.auditLog.findMany({
      where: {
        targetTable: 'loan_letter',
        targetId: { in: letterIds },
        action: REPRINT_ACTION,
      },
      include: {
        actor: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.reduce((acc, log) => {
      if (!acc[log.targetId]) acc[log.targetId] = [];
      acc[log.targetId].push({
        id: log.id,
        printedAt: log.createdAt,
        printedBy: {
          id: log.actor?.id || null,
          uid: log.actor?.uid || 'N/A',
          name: formatUserDisplayName(log.actor),
        },
      });
      return acc;
    }, {});
  }

  enrichLoanLetter(letter, reprintMap = {}) {
    const reprints = reprintMap[letter.id] || [];
    return {
      ...letter,
      reprintCount: reprints.length,
      reprints,
      lastReprintedAt: reprints[0]?.printedAt || null,
      lastReprintedBy: reprints[0]?.printedBy || null,
    };
  }

  /**
   * Create a new loan letter
   */
  async create({ applicationNumber, studentEmail, studentPhone, studentName, relationPrefix, relationName, programId, specializationId, selectedSemesters, transportIncluded, hostelIncluded, printedById }) {
    const normalizedApplicationNumber = String(applicationNumber || '').trim();
    const normalizedStudentEmail = studentEmail ? String(studentEmail).trim().toLowerCase() : null;
    const normalizedStudentPhone = studentPhone ? String(studentPhone).trim() : null;

    const existingLetter = await prisma.loanLetter.findFirst({
      where: {
        applicationNumber: {
          equals: normalizedApplicationNumber,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existingLetter) {
      throw {
        status: 409,
        code: 'APPLICATION_NUMBER_EXISTS',
        message: 'Application number already exists for a loan letter',
        data: await this.getById(existingLetter.id),
      };
    }

    // Fetch programme snapshot
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, programCode: true, programName: true },
    });
    if (!program) throw { status: 404, message: 'Programme not found' };

    // Validate specialization if provided
    if (specializationId) {
      const spec = await prisma.programSpecialization.findUnique({ where: { id: specializationId } });
      if (!spec) throw { status: 404, message: 'Specialization not found' };
    }

    const year = new Date().getFullYear();

    let letter;
    try {
      letter = await prisma.$transaction(async (tx) => {
        const uniqueNumber = await this.generateUniqueNumber(year, tx);

        return tx.loanLetter.create({
          data: {
            uniqueNumber,
            applicationNumber: normalizedApplicationNumber,
            studentEmail: normalizedStudentEmail,
            studentPhone: normalizedStudentPhone,
            studentName,
            relationPrefix,
            relationName,
            programId: program.id,
            programCode: program.programCode,
            programName: program.programName,
            selectedSemesters: selectedSemesters || [],
            transportIncluded: transportIncluded || false,
            hostelIncluded: hostelIncluded || false,
            specializationId: specializationId || null,
            printedById,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error, [LOAN_LETTER_APPLICATION_INDEX, 'application_number'])) {
        const duplicateLetter = await prisma.loanLetter.findFirst({
          where: {
            applicationNumber: {
              equals: normalizedApplicationNumber,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

        throw {
          status: 409,
          code: 'APPLICATION_NUMBER_EXISTS',
          message: 'Application number already exists for a loan letter',
          data: duplicateLetter ? await this.getById(duplicateLetter.id) : null,
        };
      }

      throw error;
    }

    // Return full data including fee breakdown (same as getById)
    return this.getById(letter.id);
  }

  /**
   * List loan letters (paginated)
   */
  async list({ page = 1, limit = 20, search, departmentId, programId, ownOnly = false, userId = null } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = { AND: [] };
    const include = {
      program: {
        select: {
          id: true,
          programCode: true,
          programName: true,
          department: {
            select: {
              id: true,
              departmentCode: true,
              departmentName: true,
              faculty: { select: { id: true, facultyCode: true, facultyName: true } },
            },
          },
        },
      },
      specialization: {
        select: { id: true, specializationCode: true, specializationName: true },
      },
      printedBy: {
        select: {
          id: true, uid: true,
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    };

    if (programId) {
      where.AND.push({ programId });
    }

    if (departmentId) {
      where.AND.push({ program: { departmentId } });
    }

    if (search) {
      where.AND.push({
        OR: [
          { uniqueNumber: { contains: search, mode: 'insensitive' } },
          { studentName: { contains: search, mode: 'insensitive' } },
          { studentEmail: { contains: search, mode: 'insensitive' } },
          { applicationNumber: { contains: search, mode: 'insensitive' } },
          { programName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (where.AND.length === 0) delete where.AND;

    if (ownOnly && userId) {
      const searchTerm = `%${String(search || '').trim()}%`;
      const programFilter = programId
        ? Prisma.sql`AND ll.program_id = ${programId}::uuid`
        : Prisma.empty;
      const departmentFilter = departmentId
        ? Prisma.sql`AND ll.program_id IN (SELECT p.id FROM "program" p WHERE p.department_id = ${departmentId}::uuid)`
        : Prisma.empty;
      const searchFilter = search
        ? Prisma.sql`
            AND (
              ll.unique_number ILIKE ${searchTerm}
              OR ll.student_name ILIKE ${searchTerm}
              OR COALESCE(ll.student_email, '') ILIKE ${searchTerm}
              OR ll.application_number ILIKE ${searchTerm}
              OR ll.program_name ILIKE ${searchTerm}
            )
          `
        : Prisma.empty;

      const ownOnlyPredicate = Prisma.sql`
        (
          ll.printed_by_id = ${userId}::uuid
          OR EXISTS (
            SELECT 1
            FROM "audit_log" al
            WHERE al.target_table = 'loan_letter'
              AND al.action = ${REPRINT_ACTION}
              AND al.actor_id = ${userId}::uuid
              AND al.target_id = ll.id
          )
        )
      `;

      const [idRows, totalRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT ll.id
          FROM "loan_letter" ll
          WHERE ${ownOnlyPredicate}
          ${programFilter}
          ${departmentFilter}
          ${searchFilter}
          ORDER BY ll.issued_at DESC
          LIMIT ${take}
          OFFSET ${skip}
        `,
        prisma.$queryRaw`
          SELECT COUNT(*)::int AS count
          FROM "loan_letter" ll
          WHERE ${ownOnlyPredicate}
          ${programFilter}
          ${departmentFilter}
          ${searchFilter}
        `,
      ]);

      const orderedIds = idRows.map((row) => row.id);
      const total = Number(totalRows[0]?.count || 0);

      if (orderedIds.length === 0) {
        return {
          data: [],
          total,
          page: Number(page),
          limit: take,
          totalPages: Math.ceil(total / take),
        };
      }

      const data = await prisma.loanLetter.findMany({
        where: { id: { in: orderedIds } },
        include,
      });

      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      data.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

      const reprintMap = await this.getReprintMap(orderedIds);

      return {
        data: data.map(item => this.enrichLoanLetter(item, reprintMap)),
        total,
        page: Number(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      };
    }

    const [data, total] = await Promise.all([
      prisma.loanLetter.findMany({
        where,
        include,
        orderBy: { issuedAt: 'desc' },
        skip,
        take,
      }),
      prisma.loanLetter.count({ where }),
    ]);

    const reprintMap = await this.getReprintMap(data.map(item => item.id));

    return {
      data: data.map(item => this.enrichLoanLetter(item, reprintMap)),
      total,
      page: Number(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Get a single loan letter by ID — includes fee breakdown for print view
   */
  async getById(id) {
    const letter = await prisma.loanLetter.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            id: true, programCode: true, programName: true,
            durationYears: true, durationMonths: true, durationSemesters: true,
          },
        },
        specialization: {
          select: { id: true, specializationCode: true, specializationName: true },
        },
        printedBy: {
          select: {
            id: true, uid: true,
            employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
          },
        },
      },
    });
    if (!letter) throw { status: 404, message: 'Loan letter not found' };

    const selectedSemesters = Array.isArray(letter.selectedSemesters) ? letter.selectedSemesters : [];

    // Helper: map fee heads to per-semester amounts (filtered to selected semesters)
    const mapHeads = (heads) =>
      heads.map(h => {
        const semAmounts = h.semesterAmounts || {};
        const filtered = {};
        selectedSemesters.forEach(sem => {
          filtered[sem] = Number(semAmounts[sem]) || Number(h.amount) || 0;
        });
        const total = selectedSemesters.reduce((s, sem) => s + (filtered[sem] || 0), 0);
        return { headName: h.headName, semesterAmounts: filtered, total };
      });

    // Base academic fees (no specialization add-on — specializationId must be null)
    const [reprintMap, baseAcademic, specFeeStructure, transportFeeStructure, hostelFeeStructure] = await Promise.all([
      this.getReprintMap([id]),
      latestFeeStructure({ type: 'ACADEMIC', programId: letter.programId, specializationId: null, isActive: true }),
      letter.specializationId
        ? latestFeeStructure({ type: 'ACADEMIC', specializationId: letter.specializationId, isActive: true })
        : Promise.resolve(null),
      letter.transportIncluded
        ? latestFeeStructure({ type: 'TRANSPORT', programId: null, isActive: true })
        : Promise.resolve(null),
      letter.hostelIncluded
        ? latestFeeStructure({ type: 'HOSTEL', programId: null, isActive: true })
        : Promise.resolve(null),
    ]);

    const academicHeads = mapHeads(baseAcademic?.heads || []);
    const specializationHeads = mapHeads(specFeeStructure?.heads || []);

    // Transport/Hostel are flat (not semester-split) — keep as flat amount
    const selectedYears = new Set(selectedSemesters.map((sem) => Math.floor((Number(sem) - 1) / 2)));
    const transportYears = selectedYears.size || 1;
    const hostelYears = selectedYears.size || 1;

    const transportHeads = (transportFeeStructure?.heads || []).map(h => ({
      headName: h.headName,
      amount: Number(h.amount) || 0,
      yearlyTotal: (Number(h.amount) || 0) * transportYears,
      years: transportYears,
    }));
    const hostelHeads = (hostelFeeStructure?.heads || []).map(h => ({
      headName: h.headName,
      amount: Number(h.amount) || 0,
      yearlyTotal: (Number(h.amount) || 0) * hostelYears,
      years: hostelYears,
    }));

    const academicTotal = academicHeads.reduce((s, h) => s + h.total, 0);
    const specTotal = specializationHeads.reduce((s, h) => s + h.total, 0);
    const transportTotal = transportHeads.reduce((s, h) => s + h.yearlyTotal, 0);
    const hostelTotal = hostelHeads.reduce((s, h) => s + h.yearlyTotal, 0);
    const grandTotal = academicTotal + specTotal + transportTotal + hostelTotal;

    return this.enrichLoanLetter({
      ...letter,
      feeBreakdown: {
        academic: academicHeads,
        specialization: specializationHeads,
        transport: transportHeads,
        hostel: hostelHeads,
        grandTotal,
        selectedSemesters,
          selectedYears: transportYears,
      },
    }, reprintMap);
  }

  async recordReprint({ id, actorId, ipAddress = null, userAgent = null }) {
    const letter = await prisma.loanLetter.findUnique({
      where: { id },
      select: {
        id: true,
        uniqueNumber: true,
        applicationNumber: true,
        studentName: true,
      },
    });

    if (!letter) throw { status: 404, message: 'Loan letter not found' };

    await auditService.log({
      actorId,
      action: REPRINT_ACTION,
      actionType: AuditActionType.DOWNLOAD,
      module: AuditModule.FINANCE,
      category: 'loan-letter',
      severity: AuditSeverity.INFO,
      targetTable: 'loan_letter',
      targetId: id,
      ipAddress,
      userAgent,
      details: {
        uniqueNumber: letter.uniqueNumber,
        applicationNumber: letter.applicationNumber,
        studentName: letter.studentName,
      },
    });

    return this.getById(id);
  }
}

module.exports = new LoanLetterService();
