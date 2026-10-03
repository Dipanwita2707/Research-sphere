/**
 * @module reports/services/workbook
 * @description Small exceljs layer shared by the NAAC and NIRF workbooks.
 * Every string written goes through neutralizeFormula (CSV/formula injection).
 */
const ExcelJS = require('exceljs');
const { neutralizeFormula } = require('../../core/utils/spreadsheet');

const BRAND = 'FF841C43';
const TEMPLATE_FILL = 'FFFDF3E1';
const FALLBACK_FILL = 'FFFFF4CC';
const INR_FORMAT = '#,##0.00';
const LAKH_FORMAT = '#,##0.00';

const safe = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return neutralizeFormula(v);
  return v;
};

/** Excel sheet names: max 31 chars, no : \ / ? * [ ]. */
const sheetName = (name) => String(name).replace(/[:\\/?*[\]]/g, '-').slice(0, 31);

const createWorkbook = (title) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ResearchSphere';
  wb.created = new Date();
  wb.title = neutralizeFormula(title);
  return wb;
};

/**
 * Add a sheet: title row, note row, header row, data rows, optional footer rows.
 *   columns: [{ header, key, width?, numFmt? }]
 *   rows: objects keyed by column key; `_fill` on a row highlights it (e.g. fallback rows)
 *   footer: arrays of cell values appended after a blank row
 */
const addTableSheet = (wb, name, { title, note, columns, rows = [], footer = [], template = false }) => {
  const ws = wb.addWorksheet(sheetName(name), {
    views: [{ state: 'frozen', ySplit: 3 }],
    properties: { tabColor: { argb: template ? 'FFE0A100' : BRAND } },
  });
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || Math.max(12, Math.min(48, c.header.length + 4)) }));

  ws.getCell(1, 1).value = safe(title);
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: BRAND } };
  ws.getCell(2, 1).value = safe(note || '');
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF57534E' } };
  if (columns.length > 1) {
    ws.mergeCells(1, 1, 1, columns.length);
    ws.mergeCells(2, 1, 2, columns.length);
  }
  ws.getRow(2).alignment = { wrapText: true, vertical: 'top' };
  if (note && note.length > 120) ws.getRow(2).height = Math.min(90, 15 * Math.ceil(note.length / 120));

  const header = ws.getRow(3);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = safe(c.header);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: template ? 'FFB45309' : BRAND } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF44403C' } } };
  });
  header.height = 32;

  rows.forEach((r) => {
    const row = ws.addRow(columns.map((c) => safe(r[c.key])));
    columns.forEach((c, i) => {
      if (c.numFmt) row.getCell(i + 1).numFmt = c.numFmt;
    });
    if (r._fill) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r._fill } };
      });
    }
  });

  if (template) {
    // Empty, lightly tinted rows to type into.
    for (let i = 0; i < 25; i += 1) {
      const row = ws.addRow(columns.map(() => null));
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEMPLATE_FILL } };
      });
    }
  } else if (rows.length > 0) {
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: columns.length } };
  }

  if (footer.length) {
    ws.addRow([]);
    footer.forEach((values) => {
      const row = ws.addRow(values.map(safe));
      row.font = { bold: true };
    });
  }
  return ws;
};

/** "Read me" sheet: two-column key/value layout with section headings (rows of [heading]). */
const addReadMeSheet = (wb, title, entries) => {
  const ws = wb.addWorksheet('Read me', { properties: { tabColor: { argb: 'FF1C1917' } } });
  ws.columns = [{ width: 38 }, { width: 110 }];
  ws.getCell(1, 1).value = safe(title);
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.addRow([]);
  for (const entry of entries) {
    if (entry.length === 1) {
      ws.addRow([]);
      const row = ws.addRow([safe(entry[0])]);
      row.font = { bold: true, color: { argb: BRAND } };
      continue;
    }
    const row = ws.addRow([safe(entry[0]), safe(entry[1])]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.alignment = { vertical: 'top' };
  }
  return ws;
};

const toLakhs = (inr) => (inr === null || inr === undefined ? null : Math.round((inr / 100000) * 100) / 100);

module.exports = {
  ExcelJS,
  FALLBACK_FILL,
  INR_FORMAT,
  LAKH_FORMAT,
  createWorkbook,
  addTableSheet,
  addReadMeSheet,
  sheetName,
  toLakhs,
};
