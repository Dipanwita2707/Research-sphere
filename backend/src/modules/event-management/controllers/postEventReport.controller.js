const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const { ValidationError } = require('../../../shared/utils/AppError');
const postEventReportService = require('../services/postEventReport.service');

function setFileHeaders(res, report, contentType, contentLength, dispositionType) {
  const safeName = String(report.originalFileName || 'event-report').replace(/[\r\n"]/g, ' ').trim();
  res.setHeader('Content-Type', contentType || 'application/octet-stream');
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeName}"`);
}

const uploadPostEventReport = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('Report file is required');
  }

  const report = await postEventReportService.uploadPostEventReport(
    req.params.id,
    req.user,
    req.file,
  );

  return ApiResponse.created(
    res,
    report,
    'Post event report uploaded successfully',
  );
});

const listPostEventReports = asyncHandler(async (req, res) => {
  const data = await postEventReportService.listPostEventReports(req.params.id, req.user);
  return ApiResponse.success(res, data, 'Post event reports fetched successfully');
});

const downloadPostEventReport = asyncHandler(async (req, res) => {
  const payload = await postEventReportService.getPostEventReportFile(
    req.params.id,
    req.params.reportId,
    req.user,
    { preview: false },
  );

  setFileHeaders(
    res,
    payload.report,
    payload.contentType,
    payload.contentLength,
    'attachment',
  );

  payload.stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end();
    }
  });

  payload.stream.pipe(res);
});

const previewPostEventReport = asyncHandler(async (req, res) => {
  const payload = await postEventReportService.getPostEventReportFile(
    req.params.id,
    req.params.reportId,
    req.user,
    { preview: true },
  );

  setFileHeaders(
    res,
    payload.report,
    payload.contentType,
    payload.contentLength,
    'inline',
  );

  payload.stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end();
    }
  });

  payload.stream.pipe(res);
});

module.exports = {
  uploadPostEventReport,
  listPostEventReports,
  downloadPostEventReport,
  previewPostEventReport,
};
