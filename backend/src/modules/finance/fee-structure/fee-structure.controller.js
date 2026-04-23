const feeStructureService = require('./fee-structure.service');
const ExcelJS = require('exceljs');

function validateHeads(heads) {
  if (!Array.isArray(heads) || heads.length === 0) return false;
  return heads.every((head) => head?.headName && head.amount != null && Number(head.amount) >= 0);
}

/**
 * List all fee structures
 */
exports.listAll = async (req, res) => {
  try {
    const { type, batchYear, programId } = req.query;
    const data = await feeStructureService.listAll({ type, batchYear, programId });
    res.json({ success: true, data });
  } catch (error) {
    console.error('List fee structures error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to fetch fee structures' });
  }
};

/**
 * Get fee structure by ID
 */
exports.getById = async (req, res) => {
  try {
    const data = await feeStructureService.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Fee structure not found' });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get fee structure error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fee structure' });
  }
};

/**
 * Create fee structure
 */
exports.create = async (req, res) => {
  try {
    const { type, batchYear, programId, specializationId, heads } = req.body;

    if (!type || !batchYear) {
      return res.status(400).json({ success: false, message: 'type and batchYear are required' });
    }
    if (!['TRANSPORT', 'HOSTEL', 'ACADEMIC'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be TRANSPORT, HOSTEL, or ACADEMIC' });
    }
    if (!validateHeads(heads)) {
      return res.status(400).json({ success: false, message: 'At least one fee head is required' });
    }

    const data = await feeStructureService.create({ type, batchYear, programId, specializationId, heads });
    res.status(201).json({ success: true, message: 'Fee structure created', data });
  } catch (error) {
    console.error('Create fee structure error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to create fee structure' });
  }
};

exports.createAcademicBatch = async (req, res) => {
  try {
    const { batchYear, programId, baseHeads = [], specializationStructures = [] } = req.body;

    if (!batchYear || !programId) {
      return res.status(400).json({ success: false, message: 'batchYear and programId are required' });
    }

    const hasValidBaseHeads = Array.isArray(baseHeads) && baseHeads.length > 0 && validateHeads(baseHeads);
    const validSpecializationStructures = Array.isArray(specializationStructures)
      ? specializationStructures.filter((structure) => structure?.specializationId && validateHeads(structure.heads))
      : [];

    if (!hasValidBaseHeads && validSpecializationStructures.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one base or specialization fee structure with valid heads is required',
      });
    }

    const data = await feeStructureService.createAcademicBatch({
      batchYear,
      programId,
      baseHeads: hasValidBaseHeads ? baseHeads : [],
      specializationStructures: validSpecializationStructures,
    });

    res.status(201).json({ success: true, message: 'Academic fee structures created', data });
  } catch (error) {
    console.error('Create academic batch fee structures error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to create academic fee structures' });
  }
};

/**
 * Update fee structure
 */
exports.update = async (req, res) => {
  try {
    const { heads, isActive } = req.body;
    const data = await feeStructureService.update(req.params.id, { heads, isActive });
    res.json({ success: true, message: 'Fee structure updated', data });
  } catch (error) {
    console.error('Update fee structure error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update fee structure' });
  }
};

/**
 * Delete fee structure
 */
exports.remove = async (req, res) => {
  try {
    await feeStructureService.remove(req.params.id);
    res.json({ success: true, message: 'Fee structure deleted' });
  } catch (error) {
    console.error('Delete fee structure error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete fee structure' });
  }
};

/**
 * Get fee structures for a programme
 */
exports.getForProgram = async (req, res) => {
  try {
    const data = await feeStructureService.getForProgram(req.params.programId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get programme fees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch programme fees' });
  }
};

exports.downloadAcademicTemplate = async (req, res) => {
  try {
    const programs = await feeStructureService.getAcademicTemplatePrograms();

    const templateSems = Math.max(...programs.map(p => p.durationSemesters || 0), 8);
    const semHeaders = Array.from({ length: templateSems }, (_, i) => `sem${i + 1}`);
    const allHeaders = ['programCode', 'programName', 'batchYear', 'specializationCode', 'headName', ...semHeaders];
    const totalCols = allHeaders.length;
    const currentYear = String(new Date().getFullYear());
    const blankSems = Array(templateSems).fill('');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SGT-UMS';
    const sheet = workbook.addWorksheet('Academic Fee Template');

    sheet.columns = [
      { width: 18 },
      { width: 44 },
      { width: 12 },
      { width: 22 },
      { width: 38 },
      ...Array.from({ length: templateSems }, () => ({ width: 13 })),
    ];

    // ── Row 1: Instructions (merged, yellow) ────────────────────────────────
    const instrRow = sheet.addRow([
      'Tip: Enter programCode, programName and batchYear ONCE per programme group. Leave those columns blank for additional fee-head rows or specialization rows — the system carries the last filled values forward automatically.',
      ...Array(totalCols - 1).fill(''),
    ]);
    sheet.mergeCells(1, 1, 1, totalCols);
    const iCell = instrRow.getCell(1);
    iCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    iCell.font = { italic: true, size: 9, color: { argb: 'FF856404' } };
    iCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    instrRow.height = 20;

    // ── Row 2: Header (dark navy, white bold) ───────────────────────────────
    const headerRow = sheet.addRow(allHeaders);
    headerRow.height = 20;
    for (let c = 1; c <= totalCols; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF4A90D9' } } };
    }

    // Freeze top 2 rows so header stays visible when scrolling
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3' }];

    // ── Data row helpers ────────────────────────────────────────────────────
    const addDataRow = (values, isFirstInGroup) => {
      const row = sheet.addRow(values);
      row.height = 17;
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        // First row of each group: pale-blue background, bold programme code
        if (isFirstInGroup) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FB' } };
          if (c === 1) cell.font = { bold: true };
          // Top border separates the group visually from the separator above
          cell.border = { top: { style: 'thin', color: { argb: 'FFADD8E6' } } };
        }
        // Sem columns right-aligned
        if (c > 5) cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    };

    const addSeparator = () => {
      const row = sheet.addRow(Array(totalCols).fill(''));
      row.height = 5;
      for (let c = 1; c <= totalCols; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }
    };

    // ── Data rows per programme ─────────────────────────────────────────────
    const programList = programs.length > 0 ? programs : [
      {
        programCode: 'BTECH-CSE',
        programName: 'Bachelor of Technology in Computer Science',
        durationSemesters: 8,
        specializations: [],
      },
    ];

    for (let gi = 0; gi < programList.length; gi++) {
      const prog = programList[gi];
      const activeSpecs = (prog.specializations || []).filter(s => s.isActive);

      // First head row — carries programme identity (programCode / programName / batchYear)
      addDataRow([prog.programCode, prog.programName, currentYear, '', 'Tuition Fee', ...blankSems], true);

      // Second head row — leaves programme columns blank to show the carry-forward convention
      addDataRow(['', '', '', '', 'Development Fee', ...blankSems], false);

      // Specialization rows — also leave programme columns blank
      for (const spec of activeSpecs) {
        addDataRow(['', '', '', spec.specializationCode, `${spec.specializationName} Additional Fee`, ...blankSems], false);
      }

      // Thin grey separator between programme groups (fully empty row — parser skips it)
      if (gi < programList.length - 1) addSeparator();
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=fee-structure-template-${new Date().getFullYear()}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Download academic fee template error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate academic fee template' });
  }
};

/**
 * Bulk create ACADEMIC fee structures from CSV row data.
 * Expects body: { rows: [{ programCode, batchYear, specializationCode, headName, sem1..sem8 }] }
 */
exports.bulkCreate = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'rows array is required and must be non-empty' });
    }
    const data = await feeStructureService.bulkCreate(rows);
    const msg = `Created ${data.created} structure(s), skipped ${data.skipped} duplicate(s)${data.errors.length ? `, ${data.errors.length} error(s)` : ''}`;
    res.json({ success: true, message: msg, data });
  } catch (error) {
    console.error('Bulk create fee structures error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Bulk upload failed' });
  }
};
