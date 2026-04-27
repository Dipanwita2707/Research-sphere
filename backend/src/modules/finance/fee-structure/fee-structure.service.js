const prisma = require('../../../shared/config/database');

const FEE_STRUCTURE_UNIQUE_INDEXES = [
  'fee_structure_transport_hostel_unique_idx',
  'fee_structure_academic_base_unique_idx',
  'fee_structure_academic_specialization_unique_idx',
];

function mapFeeHeadData(heads, feeStructureId) {
  return heads.map((h) => ({
    feeStructureId,
    headName: h.headName,
    amount: h.amount !== undefined
      ? Number(h.amount)
      : h.semesterAmounts
        ? Object.values(h.semesterAmounts).reduce((s, a) => s + Number(a), 0)
        : 0,
    semesterAmounts: h.semesterAmounts || null,
  }));
}

function sumSemesterAmounts(semesterAmounts) {
  if (!semesterAmounts || typeof semesterAmounts !== 'object') return 0;
  return Object.values(semesterAmounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function normalizeAndValidateHeads(heads, { requireSemesterAmounts = false, contextLabel = 'Fee head' } = {}) {
  if (!Array.isArray(heads)) return [];

  return heads
    .filter((head) => head && String(head.headName || '').trim())
    .map((head, index) => {
      const headName = String(head.headName || '').trim();
      const amount = Number(head.amount) || 0;
      const semesterAmounts = head.semesterAmounts || null;
      const semesterTotal = sumSemesterAmounts(semesterAmounts);

      if (amount <= 0) {
        throw { status: 400, message: `${contextLabel} row ${index + 1} (${headName}): total amount is required` };
      }
      if (requireSemesterAmounts && (!semesterAmounts || semesterTotal <= 0)) {
        throw { status: 400, message: `${contextLabel} row ${index + 1} (${headName}): semester amounts are required` };
      }
      if (semesterAmounts && semesterTotal !== amount) {
        throw { status: 400, message: `${contextLabel} row ${index + 1} (${headName}): semester total ${semesterTotal} must match head total ${amount}` };
      }

      return { headName, amount, semesterAmounts };
    });
}

function getProgramChargeRules(program) {
  const metadata = program?.metadata;
  if (!metadata || typeof metadata !== 'object' || !Array.isArray(metadata.specializationChargeRules)) return [];
  return metadata.specializationChargeRules
    .map((rule) => ({
      specializationCode: String(rule.specializationCode || '').trim().toUpperCase(),
      specializationName: String(rule.specializationName || '').trim().toLowerCase(),
      batchYear: Number(rule.batchYear),
      startSemester: Number(rule.startSemester),
      requireNonZeroCharge: rule.requireNonZeroCharge !== false,
    }))
    .filter((rule) => rule.requireNonZeroCharge && Number.isInteger(rule.batchYear) && Number.isInteger(rule.startSemester));
}

function findSpecializationChargeRule(program, specialization, batchYear) {
  if (!specialization) return null;
  const rules = getProgramChargeRules(program);
  return rules.find((rule) => (
    rule.batchYear === Number(batchYear)
    && (
      rule.specializationCode === String(specialization.specializationCode || '').trim().toUpperCase()
      || rule.specializationName === String(specialization.specializationName || '').trim().toLowerCase()
    )
  )) || null;
}

function enforceSpecializationChargeRule({ program, specialization, batchYear, heads, contextLabel }) {
  const rule = findSpecializationChargeRule(program, specialization, batchYear);
  if (!rule) return;

  const durationSemesters = Number(program.durationSemesters) || 0;
  const lastSemester = durationSemesters > 0 ? durationSemesters : Math.max(...heads.flatMap((head) => Object.keys(head.semesterAmounts || {}).map(Number)), rule.startSemester);

  for (let semester = rule.startSemester; semester <= lastSemester; semester++) {
    const semesterTotal = heads.reduce((sum, head) => sum + (Number(head.semesterAmounts?.[semester]) || 0), 0);
    if (semesterTotal <= 0) {
      throw {
        status: 400,
        message: `${contextLabel}: ${specialization.specializationCode} requires a non-zero add-on charge from semester ${rule.startSemester} for batch year ${batchYear}`,
      };
    }
  }
}

function isFeeStructureUniqueViolation(error) {
  if (!error) return false;

  if (error.code === 'P2002') return true;
  if (error.code === '23505') return true;

  const message = String(error.message || '');
  return FEE_STRUCTURE_UNIQUE_INDEXES.some((indexName) => message.includes(indexName));
}

function buildFeeStructureConflict(type, batchYear, programId, specializationId) {
  return {
    status: 409,
    message: `A ${type} fee structure for batch year ${batchYear}${programId ? ' and this programme' : ''}${specializationId ? ' and this specialization' : ''} already exists`,
  };
}

class FeeStructureService {
  /**
   * List all fee structures with optional filters
   */
  async listAll({ type, batchYear, programId } = {}) {
    const where = {};
    if (type) where.type = type;
    if (batchYear) where.batchYear = Number(batchYear);
    if (programId) where.programId = programId;

    return prisma.feeStructure.findMany({
      where,
      include: {
        heads: { orderBy: { headName: 'asc' } },
        program: {
          select: { id: true, programCode: true, programName: true, shortName: true },
        },
        specialization: {
          select: { id: true, specializationCode: true, specializationName: true },
        },
      },
      orderBy: [{ type: 'asc' }, { batchYear: 'desc' }],
    });
  }

  /**
   * Get a single fee structure by ID
   */
  async getById(id) {
    return prisma.feeStructure.findUnique({
      where: { id },
      include: {
        heads: { orderBy: { headName: 'asc' } },
        program: {
          select: { id: true, programCode: true, programName: true, shortName: true },
        },
        specialization: {
          select: { id: true, specializationCode: true, specializationName: true },
        },
      },
    });
  }

  /**
   * Create a fee structure with heads in a single transaction
   */
  async create({ type, batchYear, programId, specializationId, heads }) {
    // Enforce uniqueness: TRANSPORT/HOSTEL → unique(type, batchYear); ACADEMIC → unique(type, programId, batchYear)
    const duplicateWhere = { type, batchYear: Number(batchYear) };
    if (type === 'TRANSPORT' || type === 'HOSTEL') {
      duplicateWhere.programId = null;
      duplicateWhere.specializationId = null;
    } else {
      if (!programId) throw { status: 400, message: 'programId is required for ACADEMIC fee structures' };
      duplicateWhere.programId = programId;
      if (specializationId) {
        duplicateWhere.specializationId = specializationId;
      } else {
        duplicateWhere.specializationId = null;
      }
    }

    const existing = await prisma.feeStructure.findFirst({ where: duplicateWhere });
    if (existing) {
      throw buildFeeStructureConflict(type, batchYear, programId, specializationId);
    }

    const normalizedHeads = normalizeAndValidateHeads(heads, {
      requireSemesterAmounts: type === 'ACADEMIC',
      contextLabel: 'Fee head',
    });

    if (type === 'ACADEMIC' && specializationId) {
      const [program, specialization] = await Promise.all([
        prisma.program.findUnique({
          where: { id: programId },
          select: { id: true, durationSemesters: true, metadata: true },
        }),
        prisma.programSpecialization.findFirst({
          where: { id: specializationId, programId },
          select: { id: true, specializationCode: true, specializationName: true },
        }),
      ]);
      if (!program) throw { status: 404, message: 'Programme not found' };
      if (!specialization) throw { status: 404, message: 'Specialization not found for this programme' };
      enforceSpecializationChargeRule({
        program,
        specialization,
        batchYear,
        heads: normalizedHeads,
        contextLabel: 'Fee head',
      });
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const feeStructure = await tx.feeStructure.create({
          data: {
            type,
            batchYear: Number(batchYear),
            programId: (type === 'TRANSPORT' || type === 'HOSTEL') ? null : programId,
            specializationId: specializationId || null,
            isActive: true,
          },
        });

        if (normalizedHeads.length > 0) {
          await tx.feeHead.createMany({
            data: mapFeeHeadData(normalizedHeads, feeStructure.id),
          });
        }

        return tx.feeStructure.findUnique({
          where: { id: feeStructure.id },
          include: {
            heads: { orderBy: { headName: 'asc' } },
            program: { select: { id: true, programCode: true, programName: true } },
            specialization: { select: { id: true, specializationCode: true, specializationName: true } },
          },
        });
      });
    } catch (error) {
      if (isFeeStructureUniqueViolation(error)) {
        throw buildFeeStructureConflict(type, batchYear, programId, specializationId);
      }
      throw error;
    }
  }

  async createAcademicBatch({ batchYear, programId, baseHeads = [], specializationStructures = [] }) {
    const normalizedBatchYear = Number(batchYear);
    if (!programId) throw { status: 400, message: 'programId is required for batched academic fee structures' };

    const requestedStructures = [];

    if (Array.isArray(baseHeads) && baseHeads.length > 0) {
      requestedStructures.push({
        specializationId: null,
        heads: normalizeAndValidateHeads(baseHeads, { requireSemesterAmounts: true, contextLabel: 'Base fee head' }),
      });
    }

    if (Array.isArray(specializationStructures)) {
      for (const structure of specializationStructures) {
        if (!structure?.specializationId || !Array.isArray(structure.heads) || structure.heads.length === 0) continue;
        requestedStructures.push({
          specializationId: structure.specializationId,
          heads: normalizeAndValidateHeads(structure.heads, { requireSemesterAmounts: true, contextLabel: 'Specialization fee head' }),
        });
      }
    }

    if (requestedStructures.length === 0) {
      throw { status: 400, message: 'At least one academic fee structure with heads is required' };
    }

    const uniqueSpecializationIds = [...new Set(
      requestedStructures.map(structure => structure.specializationId).filter(Boolean)
    )];

    const [program, specializations, existingStructures] = await Promise.all([
      prisma.program.findUnique({
        where: { id: programId },
        select: { id: true, programCode: true, programName: true, durationSemesters: true, metadata: true },
      }),
      uniqueSpecializationIds.length > 0
        ? prisma.programSpecialization.findMany({
            where: {
              id: { in: uniqueSpecializationIds },
              programId,
            },
            select: {
              id: true,
              specializationCode: true,
              specializationName: true,
            },
          })
        : Promise.resolve([]),
      prisma.feeStructure.findMany({
        where: {
          type: 'ACADEMIC',
          batchYear: normalizedBatchYear,
          programId,
          OR: requestedStructures.map(structure => ({
            specializationId: structure.specializationId || null,
          })),
        },
        include: {
          specialization: {
            select: { specializationName: true },
          },
        },
      }),
    ]);

    if (!program) throw { status: 404, message: 'Programme not found' };

    if (specializations.length !== uniqueSpecializationIds.length) {
      throw { status: 404, message: 'One or more specializations were not found for this programme' };
    }

    const specializationById = new Map(specializations.map((specialization) => [specialization.id, specialization]));
    for (const structure of requestedStructures) {
      if (!structure.specializationId) continue;
      enforceSpecializationChargeRule({
        program,
        specialization: specializationById.get(structure.specializationId),
        batchYear: normalizedBatchYear,
        heads: structure.heads,
        contextLabel: 'Specialization fee head',
      });
    }

    if (existingStructures.length > 0) {
      const duplicate = existingStructures[0];
      const duplicateLabel = duplicate.specialization?.specializationName || 'the base programme';
      throw {
        status: 409,
        message: `An ACADEMIC fee structure for batch year ${normalizedBatchYear} already exists for ${duplicateLabel}`,
      };
    }

    let createdIds;
    try {
      createdIds = await prisma.$transaction(async (tx) => {
        const ids = [];

        for (const structure of requestedStructures) {
          const feeStructure = await tx.feeStructure.create({
            data: {
              type: 'ACADEMIC',
              batchYear: normalizedBatchYear,
              programId: program.id,
              specializationId: structure.specializationId || null,
              isActive: true,
            },
          });

          await tx.feeHead.createMany({
            data: mapFeeHeadData(structure.heads, feeStructure.id),
          });

          ids.push(feeStructure.id);
        }

        return ids;
      });
    } catch (error) {
      if (isFeeStructureUniqueViolation(error)) {
        throw {
          status: 409,
          message: `An ACADEMIC fee structure for batch year ${normalizedBatchYear} already exists for this programme`,
        };
      }
      throw error;
    }

    return prisma.feeStructure.findMany({
      where: { id: { in: createdIds } },
      include: {
        heads: { orderBy: { headName: 'asc' } },
        program: { select: { id: true, programCode: true, programName: true } },
        specialization: { select: { id: true, specializationCode: true, specializationName: true } },
      },
      orderBy: [{ specializationId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Update a fee structure (replace heads)
   */
  async update(id, { heads, isActive }) {
    const existing = await prisma.feeStructure.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Fee structure not found' };

    const normalizedHeads = Array.isArray(heads)
      ? normalizeAndValidateHeads(heads, { requireSemesterAmounts: existing.type === 'ACADEMIC', contextLabel: 'Fee head' })
      : null;

    if (normalizedHeads && existing.type === 'ACADEMIC' && existing.specializationId) {
      const [program, specialization] = await Promise.all([
        prisma.program.findUnique({
          where: { id: existing.programId },
          select: { id: true, durationSemesters: true, metadata: true },
        }),
        prisma.programSpecialization.findUnique({
          where: { id: existing.specializationId },
          select: { id: true, specializationCode: true, specializationName: true },
        }),
      ]);
      enforceSpecializationChargeRule({
        program,
        specialization,
        batchYear: existing.batchYear,
        heads: normalizedHeads,
        contextLabel: 'Fee head',
      });
    }

    return prisma.$transaction(async (tx) => {
      if (isActive !== undefined) {
        await tx.feeStructure.update({ where: { id }, data: { isActive } });
      }

      if (Array.isArray(normalizedHeads)) {
        await tx.feeHead.deleteMany({ where: { feeStructureId: id } });
        if (normalizedHeads.length > 0) {
          await tx.feeHead.createMany({
            data: mapFeeHeadData(normalizedHeads, id),
          });
        }
      }

      return tx.feeStructure.findUnique({
        where: { id },
        include: {
          heads: { orderBy: { headName: 'asc' } },
          program: { select: { id: true, programCode: true, programName: true } },
          specialization: { select: { id: true, specializationCode: true, specializationName: true } },
        },
      });
    });
  }

  /**
   * Delete a fee structure and its heads (cascade)
   */
  async remove(id) {
    const existing = await prisma.feeStructure.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Fee structure not found' };
    await prisma.feeStructure.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Bulk create ACADEMIC fee structures from parsed CSV rows.
  * Each row: { programCode, batchYear, specializationCode, headName, totalAmount, sem1..sem8 }
   * Rows are grouped by (programCode, batchYear, specializationCode).
   */
  async bulkCreate(rows) {
    const programCodes = [...new Set(rows.map(r => (r.programCode || '').trim().toUpperCase()).filter(Boolean))];
    if (programCodes.length === 0) throw { status: 400, message: 'No valid programme codes found in upload' };

    const programs = await prisma.program.findMany({
      where: { programCode: { in: programCodes } },
      include: { specializations: true },
    });
    const programMap = new Map(programs.map(p => [p.programCode.trim().toUpperCase(), p]));

    // Group rows by (programCode | batchYear | specializationCode)
    const groups = new Map();
    for (const row of rows) {
      const pCode = (row.programCode || '').trim().toUpperCase();
      if (!pCode) continue;
      const specCode = (row.specializationCode || '').trim().toUpperCase();
      const by = Number(row.batchYear) || new Date().getFullYear();
      const key = `${pCode}|||${by}|||${specCode}`;
      if (!groups.has(key)) groups.set(key, { programCode: pCode, batchYear: by, specializationCode: specCode, rows: [] });
      groups.get(key).rows.push(row);
    }

    const results = { created: 0, skipped: 0, errors: [], groups: [] };
    const readyToCreate = [];

    for (const [, group] of groups) {
      const { programCode, batchYear, specializationCode, rows: groupRows } = group;
      const groupKey = `${programCode}|||${batchYear}|||${specializationCode}`;
      const prog = programMap.get(programCode);
      if (!prog) {
        const message = `Programme "${programCode}" not found`;
        results.errors.push(message);
        results.groups.push({
          key: groupKey,
          programCode,
          batchYear,
          specializationCode,
          headCount: 0,
          status: 'error',
          message,
        });
        continue;
      }

      const uploadedSemesterNumbers = [...new Set(
        groupRows.flatMap((row) => Object.keys(row)
          .map((key) => {
            const match = /^sem(\d+)$/i.exec(key);
            return match ? Number(match[1]) : null;
          })
          .filter((value) => Number.isInteger(value) && value > 0)),
      )].sort((a, b) => a - b);

      const maxUploadedSemester = uploadedSemesterNumbers[uploadedSemesterNumbers.length - 1] || 0;
      const sems = prog.durationSemesters || maxUploadedSemester || 8;
      let specializationId = null;
      let specialization = null;

      if (maxUploadedSemester > sems) {
        const message = `${programCode}/${batchYear}/${specializationCode || 'base'}: uploaded semester columns exceed configured duration (${sems})`;
        results.errors.push(message);
        results.groups.push({
          key: groupKey,
          programCode,
          batchYear,
          specializationCode,
          headCount: 0,
          status: 'error',
          message,
        });
        continue;
      }

      if (specializationCode) {
        const spec = prog.specializations.find(
          s => s.specializationCode.trim().toUpperCase() === specializationCode,
        );
        if (!spec) {
          const message = `Specialization "${specializationCode}" not found in programme "${programCode}"`;
          results.errors.push(message);
          results.groups.push({
            key: groupKey,
            programCode,
            batchYear,
            specializationCode,
            headCount: 0,
            status: 'error',
            message,
          });
          continue;
        }
        specializationId = spec.id;
        specialization = spec;
      }

      const heads = groupRows
        .filter(r => (r.headName || '').trim())
        .map(r => {
          const semesterAmounts = {};
          for (let s = 1; s <= sems; s++) {
            const v = Number(r[`sem${s}`]) || 0;
            semesterAmounts[s] = v;
          }
          return { headName: r.headName.trim(), amount: Number(r.totalAmount) || 0, semesterAmounts };
        })
        .filter(h => h.amount > 0 || sumSemesterAmounts(h.semesterAmounts) > 0);

      let normalizedHeads;
      try {
        normalizedHeads = normalizeAndValidateHeads(heads, {
          requireSemesterAmounts: true,
          contextLabel: `${programCode}/${batchYear}/${specializationCode || 'base'}`,
        });
        if (specialization) {
          enforceSpecializationChargeRule({
            program: prog,
            specialization,
            batchYear,
            heads: normalizedHeads,
            contextLabel: `${programCode}/${batchYear}/${specializationCode}`,
          });
        }
      } catch (error) {
        const message = error.message || 'Invalid head totals';
        results.errors.push(message);
        results.groups.push({
          key: groupKey,
          programCode,
          batchYear,
          specializationCode,
          headCount: 0,
          status: 'error',
          message,
        });
        continue;
      }

      if (normalizedHeads.length === 0) {
        results.skipped++;
        results.groups.push({
          key: groupKey,
          programCode,
          batchYear,
          specializationCode,
          headCount: 0,
          status: 'skipped',
          message: 'No fee heads with semester amounts were found in this group',
        });
        continue;
      }

      readyToCreate.push({
        key: groupKey,
        programCode,
        batchYear,
        specializationCode,
        headCount: normalizedHeads.length,
        programId: prog.id,
        specializationId,
        heads: normalizedHeads,
      });
    }

    if (readyToCreate.length === 0) {
      return results;
    }

    const existingStructures = await prisma.feeStructure.findMany({
      where: {
        OR: readyToCreate.map((group) => ({
          type: 'ACADEMIC',
          batchYear: group.batchYear,
          programId: group.programId,
          specializationId: group.specializationId || null,
        })),
      },
      include: {
        specialization: {
          select: { specializationName: true },
        },
      },
    });

    const existingKeys = new Set(
      existingStructures.map((structure) => `${structure.programId}|||${structure.batchYear}|||${structure.specializationId || ''}`)
    );
    const groupsToCreate = [];

    for (const group of readyToCreate) {
      const duplicateKey = `${group.programId}|||${group.batchYear}|||${group.specializationId || ''}`;
      if (existingKeys.has(duplicateKey)) {
        results.skipped++;
        results.groups.push({
          key: group.key,
          programCode: group.programCode,
          batchYear: group.batchYear,
          specializationCode: group.specializationCode,
          headCount: group.headCount,
          status: 'skipped',
          message: 'A matching fee structure already exists',
        });
      } else {
        groupsToCreate.push(group);
      }
    }

    if (groupsToCreate.length === 0) {
      return results;
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const group of groupsToCreate) {
          const feeStructure = await tx.feeStructure.create({
            data: {
              type: 'ACADEMIC',
              batchYear: group.batchYear,
              programId: group.programId,
              specializationId: group.specializationId || null,
              isActive: true,
            },
          });

          await tx.feeHead.createMany({
            data: mapFeeHeadData(group.heads, feeStructure.id),
          });
        }
      });

      for (const group of groupsToCreate) {
        results.created++;
        results.groups.push({
          key: group.key,
          programCode: group.programCode,
          batchYear: group.batchYear,
          specializationCode: group.specializationCode,
          headCount: group.headCount,
          status: 'created',
          message: `Created ${group.headCount} head(s)`,
        });
      }
    } catch (err) {
      if (isFeeStructureUniqueViolation(err)) {
        for (const group of groupsToCreate) {
          results.skipped++;
          results.groups.push({
            key: group.key,
            programCode: group.programCode,
            batchYear: group.batchYear,
            specializationCode: group.specializationCode,
            headCount: group.headCount,
            status: 'skipped',
            message: 'A matching fee structure already exists',
          });
        }
        return results;
      }

      const message = err.message || 'Unknown error';
      for (const group of groupsToCreate) {
        const groupMessage = `${group.programCode}/${group.batchYear}/${group.specializationCode || 'base'}: ${message}`;
        results.errors.push(groupMessage);
        results.groups.push({
          key: group.key,
          programCode: group.programCode,
          batchYear: group.batchYear,
          specializationCode: group.specializationCode,
          headCount: group.headCount,
          status: 'error',
          message: groupMessage,
        });
      }
    }

    return results;
  }

  /**
   * Get all fee structures for a specific programme (ACADEMIC type)
   */
  async getForProgram(programId) {
    return prisma.feeStructure.findMany({
      where: { programId, type: 'ACADEMIC' },
      include: {
        heads: { orderBy: { headName: 'asc' } },
        specialization: {
          select: { id: true, specializationCode: true, specializationName: true },
        },
      },
      orderBy: { batchYear: 'desc' },
    });
  }

  async getAcademicTemplatePrograms() {
    return prisma.program.findMany({
      where: { isActive: true },
      select: {
        programCode: true,
        programName: true,
        durationSemesters: true,
        specializations: {
          where: { isActive: true },
          select: {
            specializationCode: true,
            specializationName: true,
            isActive: true,
          },
          orderBy: { specializationCode: 'asc' },
        },
      },
      orderBy: { programCode: 'asc' },
    });
  }
}

module.exports = new FeeStructureService();
