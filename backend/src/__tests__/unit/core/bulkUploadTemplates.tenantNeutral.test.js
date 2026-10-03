/**
 * Bulk-upload templates are downloaded by every university's admins: their sample rows must
 * not carry another university's name, domain or city.
 */
jest.mock('../../../shared/config/database', () => ({
  facultySchoolList: { findMany: jest.fn(async () => []) },
  department: { findMany: jest.fn(async () => []) },
  program: { findMany: jest.fn(async () => []) },
}));

const ExcelJS = require('exceljs');
const ctrl = require('../../../modules/core/controllers/bulkUpload.controller');

const download = async (handler) => {
  let body = null;
  const res = {
    setHeader: jest.fn(),
    send: jest.fn((b) => { body = b; }),
    status: jest.fn(() => res),
    json: jest.fn((j) => { throw new Error(`template failed: ${JSON.stringify(j)}`); }),
  };
  await handler({ user: { role: 'admin' }, query: {} }, res);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(body);
  const text = [];
  wb.eachSheet((ws) => ws.eachRow((row) => text.push(row.values.filter(Boolean).join(' | '))));
  return text.join('\n');
};

describe('bulk upload templates are tenant-neutral', () => {
  const handlers = Object.entries(ctrl).filter(([name]) => /^get\w*Template$/.test(name));

  it('exposes the template handlers', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(3);
  });

  it.each(handlers)('%s names no particular university', async (_name, handler) => {
    const text = await download(handler);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/sgtuniversity|\bSGT\b|Shree Guru|Gurugram/i);
  });
});
