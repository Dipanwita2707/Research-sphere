/**
 * Bulk upload spreadsheet parsing (exceljs) and formula-injection neutralisation.
 */
const ExcelJS = require('exceljs');
const {
  readSpreadsheet,
  buildWorkbookBuffer,
  neutralizeFormula,
  cellToString,
  parseCsvMatrix,
  SpreadsheetError,
} = require('../spreadsheet');

const xlsxBuffer = async (rows, mutate) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  rows.forEach((r) => ws.addRow(r));
  if (mutate) mutate(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
};

describe('readSpreadsheet (.xlsx)', () => {
  it('maps the header row to keys, strips "*" from required headers and skips empty rows', async () => {
    const buffer = await xlsxBuffer([
      ['facultyCode*', 'facultyName*', 'establishedYear'],
      ['SOCS', 'School of Computing', 2010],
      [],
      ['SOM', 'School of Management', ''],
    ]);
    const { headers, rows } = await readSpreadsheet({ buffer, originalname: 'schools.xlsx' });
    expect(headers).toEqual(['facultyCode', 'facultyName', 'establishedYear']);
    expect(rows).toEqual([
      { facultyCode: 'SOCS', facultyName: 'School of Computing', establishedYear: '2010' },
      { facultyCode: 'SOM', facultyName: 'School of Management', establishedYear: '' },
    ]);
  });

  it('uses the cached result of formula cells, never the formula text', async () => {
    const buffer = await xlsxBuffer([['email', 'total']], (ws) => {
      ws.getCell('A2').value = 'a@b.co';
      ws.getCell('B2').value = { formula: 'HYPERLINK("http://evil","x")', result: 'x' };
    });
    const { rows } = await readSpreadsheet({ buffer, originalname: 'f.xlsx' });
    expect(rows[0]).toEqual({ email: 'a@b.co', total: 'x' });
  });

  it('flattens rich text, hyperlinks and dates', () => {
    expect(cellToString({ richText: [{ text: 'Ab' }, { text: 'c ' }] })).toBe('Abc');
    expect(cellToString({ text: 'site', hyperlink: 'https://x.y' })).toBe('site');
    expect(cellToString(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
    expect(cellToString({ error: '#REF!' })).toBe('');
    expect(cellToString(null)).toBe('');
  });

  it('rejects uploads with more rows than the cap', async () => {
    const rows = [['id']];
    for (let i = 0; i < 12; i++) rows.push([`R${i}`]);
    const buffer = await xlsxBuffer(rows);
    await expect(readSpreadsheet({ buffer, originalname: 'x.xlsx' }, { maxRows: 10 }))
      .rejects.toThrow(/at most 10 data rows/);
  });

  it('rejects oversized, empty, legacy .xls and unknown files with a SpreadsheetError', async () => {
    await expect(readSpreadsheet({ buffer: Buffer.alloc(0) })).rejects.toBeInstanceOf(SpreadsheetError);
    await expect(readSpreadsheet({ buffer: Buffer.alloc(20), originalname: 'a.xlsx' }, { maxBytes: 10 }))
      .rejects.toThrow(/too large/);
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    await expect(readSpreadsheet({ buffer: ole, originalname: 'old.xls' })).rejects.toThrow(/\.xls files are not supported/);
    await expect(readSpreadsheet({ buffer: Buffer.from('hello'), originalname: 'a.pdf', mimetype: 'application/pdf' }))
      .rejects.toThrow(/Unsupported file type/);
  });

  it('reports a corrupt .xlsx as a user-facing error', async () => {
    const fake = Buffer.concat([Buffer.from('PK'), Buffer.alloc(50, 1)]);
    await expect(readSpreadsheet({ buffer: fake, originalname: 'x.xlsx' })).rejects.toThrow(/valid \.xlsx/);
  });
});

describe('readSpreadsheet (.csv)', () => {
  it('handles quoted fields with commas, escaped quotes and embedded newlines', async () => {
    const csv = '﻿name,description\r\n"Doe, Jane","He said ""hi""\nthen left"\r\nBob,plain\r\n';
    const { rows } = await readSpreadsheet({ buffer: Buffer.from(csv), originalname: 'p.csv', mimetype: 'text/csv' });
    expect(rows).toEqual([
      { name: 'Doe, Jane', description: 'He said "hi"\nthen left' },
      { name: 'Bob', description: 'plain' },
    ]);
  });

  it('applies the row cap to CSV too', async () => {
    const csv = ['id', ...Array.from({ length: 8 }, (_, i) => `${i}`)].join('\n');
    await expect(readSpreadsheet({ buffer: Buffer.from(csv), originalname: 'a.csv' }, { maxRows: 5 }))
      .rejects.toThrow(/at most 5 data rows/);
  });

  it('parseCsvMatrix stops early once past the line budget', () => {
    const csv = Array.from({ length: 100 }, (_, i) => `${i}`).join('\n');
    expect(parseCsvMatrix(csv, 3).length).toBeLessThanOrEqual(5);
  });
});

describe('formula injection', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('neutralises %j', (v) => {
    expect(neutralizeFormula(v)).toBe(`'${v}`);
  });

  it('leaves safe values and non-strings alone', () => {
    expect(neutralizeFormula('SOCS')).toBe('SOCS');
    expect(neutralizeFormula(42)).toBe(42);
    expect(neutralizeFormula(null)).toBe(null);
  });

  it('buildWorkbookBuffer writes neutralised strings into every sheet', async () => {
    const buffer = await buildWorkbookBuffer([
      { name: 'Template', rows: [['code', 'name'], ['=HYPERLINK("x")', 'ok'], [5, '@SUM(1)']] },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Template');
    expect(ws.getCell('A2').value).toBe('\'=HYPERLINK("x")');
    expect(ws.getCell('B2').value).toBe('ok');
    expect(ws.getCell('A3').value).toBe(5);
    expect(ws.getCell('B3').value).toBe("'@SUM(1)");
  });

  it('round-trips a generated template through the parser', async () => {
    const buffer = await buildWorkbookBuffer([
      { name: 'Employees', rows: [['empId*', 'email*'], ['EMP1', 'a@b.co']] },
      { name: 'Instructions', rows: [['read me']] },
    ]);
    const { rows } = await readSpreadsheet({ buffer, originalname: 'employees_template.xlsx' });
    expect(rows).toEqual([{ empId: 'EMP1', email: 'a@b.co' }]);
  });
});
