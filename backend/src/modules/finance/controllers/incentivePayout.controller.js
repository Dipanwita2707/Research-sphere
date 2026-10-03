const payouts = require('../services/incentivePayout.service');
const financeSettings = require('../services/financeSettings.service');
const logger = require('../../../shared/utils/logger');

/** Wrap a service call: PayoutError → its status/code, anything else → 500 without internals. */
const handle = (work, fallback = 'Finance request failed') => async (req, res) => {
  try {
    const data = await work(req, res);
    if (!res.headersSent) res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({
        success: false, code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}),
      });
    }
    logger.error(fallback, error);
    return res.status(500).json({ success: false, message: fallback });
  }
};

exports.dashboard = handle((req) => payouts.dashboard({ financialYear: req.query.financialYear || undefined }));
exports.listPayouts = handle((req) => payouts.listPayouts(req.query));
exports.getPayout = handle((req) => payouts.getPayout(req.params.id));
exports.recommend = handle((req) => payouts.recommend(req.body?.ids, req.user, req.body?.comments || null));
exports.hold = handle((req) => payouts.hold(req.params.id, req.user, req.body?.reason));
exports.adjust = handle((req) => payouts.adjust(req.params.id, req.user, req.body?.amount, req.body?.reason));
exports.cancel = handle((req) => payouts.cancel(req.params.id, req.user, req.body?.reason));

exports.listBatches = handle((req) => payouts.listBatches(req.query));
exports.createBatch = handle((req) => payouts.createBatch(req.body?.ids, req.user, { title: req.body?.title }));
exports.getBatch = handle((req) => payouts.getBatch(req.params.id));
exports.approveBatch = handle((req) => payouts.approveBatch(req.params.id, req.user, req.body?.comments || null, { selfApprovalReason: req.body?.selfApprovalReason || null }));
exports.getSettings = handle(() => financeSettings.getSettings());
exports.updateSettings = handle((req) => financeSettings.updateSettings(req.body || {}, req.user));
exports.markBatchPaid = handle((req) => payouts.markBatchPaid(req.params.id, req.user, {
  paymentReference: req.body?.paymentReference,
  paymentDate: req.body?.paymentDate,
  tds: req.body?.tds && typeof req.body.tds === 'object' ? req.body.tds : {},
}));
exports.cancelBatch = handle((req) => payouts.cancelBatch(req.params.id, req.user, req.body?.reason));

exports.exportBatch = handle(async (req, res) => {
  const { filename, buffer } = await payouts.exportBatch(req.params.id);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(Buffer.from(buffer));
}, 'Failed to export batch');

/** Any signed-in author: their own incentive statement. */
exports.myIncentives = handle((req) => payouts.myPayouts(req.user.id, { financialYear: req.query.financialYear || undefined }));
