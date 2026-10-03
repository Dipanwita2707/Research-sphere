/**
 * @module reports/controllers
 * @description HTTP layer for accreditation exports (NAAC Criterion 3, NIRF research).
 */
const service = require('../services/reports.service');
const { parseYearRange, parseFinancialYears, parseEnum } = require('../utils/period');
const { createModuleLogger } = require('../../../shared/utils/logger');

const logger = createModuleLogger('reports');

const fail = (res, error, fallbackMessage) => {
  const status = error.statusCode || 500;
  if (status >= 500) logger.error(fallbackMessage, { error: error.message, stack: error.stack });
  res.status(status).json({ success: false, message: status < 500 ? error.message : fallbackMessage });
};

const naacParams = (query) => ({
  ...parseYearRange(query),
  paperBasis: parseEnum(query.paperYearBasis, ['calendar', 'academic'], 'calendar', 'paperYearBasis'),
});

const sendWorkbook = (res, { buffer, filename, mime }) => {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buffer);
};

exports.naacCriterion3 = async (req, res) => {
  try {
    const file = await service.generateNaacWorkbook(naacParams(req.query));
    sendWorkbook(res, file);
  } catch (error) {
    fail(res, error, 'Failed to generate the NAAC Criterion 3 workbook');
  }
};

exports.nirfResearch = async (req, res) => {
  try {
    const file = await service.generateNirfWorkbook(parseFinancialYears(req.query.financialYears));
    sendWorkbook(res, file);
  } catch (error) {
    fail(res, error, 'Failed to generate the NIRF research workbook');
  }
};

exports.summary = async (req, res) => {
  try {
    const data = await service.getSummary(naacParams(req.query), parseFinancialYears(req.query.financialYears));
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) {
    fail(res, error, 'Failed to load the report summary');
  }
};
