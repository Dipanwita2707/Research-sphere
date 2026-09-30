/**
 * @module spreadsheet
 * @description Safe spreadsheet helpers built on exceljs (replaces the vulnerable `xlsx` package).
 *
 *  - readSpreadsheet(): parses an uploaded .xlsx or .csv buffer into { headers, rows }
 *    with a row cap, so a hostile file cannot make the server process millions of rows.
 *  - neutralizeFormula()/neutralizeWorkbook(): prefix strings that a spreadsheet app would
 *    evaluate as a formula (= + - @ TAB CR) with an apostrophe (CSV/formula injection).
 *  - buildWorkbookBuffer(): writes simple sheets (array-of-arrays) to an .xlsx buffer,
 *    neutralising every string cell.
 */
const ExcelJS = require('exceljs');

const MAX_UPLOAD_ROWS = 5000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_COLUMNS = 100;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIMES = new Set(['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel']);

/** Error whose message is safe to show to the uploader. */
class SpreadsheetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SpreadsheetError';
    this.statusCode = 400;
    this.isOperational = true;
  }
}

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Prefix a string that would be interpreted as a formula so it is shown as text. */
const neutralizeFormula = (value) => {
  if (typeof value !== 'string' || !FORMULA_TRIGGER.test(value)) return value;
  return `'${value}`;
};

/** Neutralise every string cell of an exceljs workbook in place. */
const neutralizeWorkbook = (workbook) => {
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === 'string') cell.value = neutralizeFormula(cell.value);
      });
    });
  });
  return workbook;
};

const pad2 = (n) => String(n).padStart(2, '0');

/** Convert an exceljs cell value to a plain trimmed string (formulas → cached result, never the formula). */
const cellToString = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
    if ('formula' in value || 'sharedFormula' in value) return cellToString(value.result);
    if ('text' in value) return cellToString(value.text);
    if ('error' in value) return '';
    return '';
  }
  return String(value).trim();
};

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, embedded commas/newlines. */
const parseCsvMatrix = (text, maxLines) => {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const matrix = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      matrix.push(row); row = [];
      if (matrix.length > maxLines) return matrix;
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); matrix.push(row); }
  return matrix;
};

/** Turn a matrix (first non-empty row = headers) into { headers, rows }. */
const matrixToRows = (matrix, maxRows) => {
  const normalized = matrix
    .map((r) => r.slice(0, MAX_COLUMNS))
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c));
  if (normalized.length < 2) return { headers: [], rows: [] };
  const headers = normalized[0].map((h) => h.replace(/^"|"$/g, '').replace(/\*$/, '').trim());
  const dataRows = normalized.slice(1);
  if (dataRows.length > maxRows) {
    throw new SpreadsheetError(`Too many rows: a single upload may contain at most ${maxRows} data rows (found more). Split the file and upload it in parts.`);
  }
  const rows = dataRows.map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      if (header) row[header] = (values[index] || '').replace(/^"|"$/g, '');
    });
    return row;
  });
  return { headers, rows };
};

const isXlsx = (buffer) => buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" zip header
const isLegacyXls = (buffer) => buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

/**
 * Parse an uploaded spreadsheet (first worksheet of an .xlsx, or a .csv).
 * @param {{buffer: Buffer, originalname?: string, mimetype?: string}} file
 * @param {{maxRows?: number, maxBytes?: number}} [opts]
 * @returns {Promise<{headers: string[], rows: Object<string,string>[]}>}
 * @throws {SpreadsheetError} for unsupported/oversized/too-long files
 */
const readSpreadsheet = async (file, { maxRows = MAX_UPLOAD_ROWS, maxBytes = MAX_UPLOAD_BYTES } = {}) => {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new SpreadsheetError('The uploaded file is empty');
  if (buffer.length > maxBytes) throw new SpreadsheetError(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`);

  const name = String(file.originalname || '').toLowerCase();
  if (isLegacyXls(buffer) || name.endsWith('.xls')) {
    throw new SpreadsheetError('Legacy .xls files are not supported. Please save the file as .xlsx (Excel Workbook) and upload again.');
  }

  if (isXlsx(buffer)) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new SpreadsheetError('Could not read the Excel file. Please make sure it is a valid .xlsx file.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };
    // actualRowCount counts non-empty rows; +1 tolerates the header row.
    if (sheet.actualRowCount > maxRows + 1) {
      throw new SpreadsheetError(`Too many rows: a single upload may contain at most ${maxRows} data rows (found ${sheet.actualRowCount - 1}). Split the file and upload it in parts.`);
    }
    const matrix = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      const columns = Math.min(sheet.columnCount, MAX_COLUMNS);
      for (let c = 1; c <= columns; c++) values.push(cellToString(row.getCell(c).value));
      matrix.push(values);
    });
    return matrixToRows(matrix, maxRows);
  }

  if (name.endsWith('.csv') || CSV_MIMES.has(file.mimetype)) {
    return matrixToRows(parseCsvMatrix(buffer.toString('utf8'), maxRows + 1), maxRows);
  }

  throw new SpreadsheetError('Unsupported file type. Please upload an .xlsx or .csv file.');
};

/**
 * Build an .xlsx buffer from simple sheets. Every string cell is formula-neutralised.
 * @param {Array<{name: string, rows: Array<Array<*>>, widths?: number[], boldHeader?: boolean, wrapColumns?: number[]}>} sheets
 * @returns {Promise<Buffer>}
 */
const buildWorkbookBuffer = async (sheets) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ResearchSphere';
  workbook.created = new Date();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name);
    for (const r of spec.rows) sheet.addRow(r.map((v) => (v === null || v === undefined ? '' : v)));
    if (Array.isArray(spec.widths)) spec.widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
    if (spec.boldHeader !== false && spec.rows.length) {
      const header = sheet.getRow(1);
      header.font = { bold: true };
      header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
    }
    for (const col of spec.wrapColumns || []) {
      sheet.getColumn(col + 1).alignment = { vertical: 'top', wrapText: true };
    }
  }
  neutralizeWorkbook(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

module.exports = {
  MAX_UPLOAD_ROWS,
  MAX_UPLOAD_BYTES,
  XLSX_MIME,
  SpreadsheetError,
  neutralizeFormula,
  neutralizeWorkbook,
  cellToString,
  parseCsvMatrix,
  readSpreadsheet,
  buildWorkbookBuffer,
};
