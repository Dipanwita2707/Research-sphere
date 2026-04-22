const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fsPromises = fs.promises;

const prisma = require('../../../shared/config/database');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require('../../../shared/utils/AppError');
const { uploadToS3, downloadFromS3 } = require('../../../shared/utils/s3');
const { resolveEvent, canManageEvent } = require('../utils/eventHelpers');
const { invalidateEventCaches } = require('./event.service');

const LOCAL_UPLOADS_ROOT = path.join(__dirname, '../../../uploads');
const REPORT_FOLDER = 'event-post-reports';

const MAX_REPORT_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isS3CredentialError(err) {
  const msg = (err && err.message) ? err.message : '';
  return (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    /credential|not valid|InvalidCredential|Missing credentials/i.test(msg)
  );
}

function sanitizeOriginalFileName(fileName) {
  const base = path.basename(fileName || 'report');
  return base.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeEventNameForFile(eventName) {
  return String(eventName || 'event')
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'event';
}

function buildEventReportFileName(eventName, version, originalFileName, mimeType) {
  const fromOriginal = path.extname(originalFileName || '').toLowerCase();
  const ext = fromOriginal
    || (mimeType === 'application/pdf' ? '.pdf' : '')
    || (mimeType === 'application/msword' ? '.doc' : '')
    || (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? '.docx' : '');

  return `${sanitizeEventNameForFile(eventName)}-post-event-report-v${version}${ext}`;
}

function buildStoredFileName(originalFileName) {
  const ext = path.extname(originalFileName).toLowerCase();
  const baseName = path.basename(originalFileName, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `${timestamp}-${random}-${baseName}${ext}`;
}

function hasExplicitPermission(user, keys) {
  const allBuckets = [
    ...(Array.isArray(user?.centralDeptPermissions) ? user.centralDeptPermissions : []),
    ...(Array.isArray(user?.schoolDeptPermissions) ? user.schoolDeptPermissions : []),
  ];

  return allBuckets.some((bucket) => {
    const perms = bucket?.permissions || {};
    return keys.some((key) => perms[key] === true);
  });
}

function inferMimeFromExtension(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function getDisplayName(user) {
  if (!user) return null;
  return (
    user.employeeDetails?.displayName ||
    [user.employeeDetails?.firstName, user.employeeDetails?.lastName].filter(Boolean).join(' ') ||
    user.studentLogin?.displayName ||
    [user.studentLogin?.firstName, user.studentLogin?.lastName].filter(Boolean).join(' ') ||
    user.uid ||
    null
  );
}

function mapReportSummary(report) {
  if (!report) return null;

  return {
    id: report.id,
    eventId: report.eventId,
    version: report.version,
    isLatest: report.isLatest,
    originalFileName: report.originalFileName,
    storedFileName: report.storedFileName,
    mimeType: report.mimeType,
    fileSize: report.fileSize,
    storageProvider: report.storageProvider,
    uploadedAt: report.uploadedAt,
    isPreviewAvailable: report.mimeType === 'application/pdf',
    uploadedBy: report.uploadedBy
      ? {
          id: report.uploadedBy.id,
          uid: report.uploadedBy.uid,
          role: report.uploadedBy.role,
          displayName: getDisplayName(report.uploadedBy),
        }
      : null,
  };
}

async function resolveEventForManagement(eventIdentifier, user) {
  const event = await resolveEvent(eventIdentifier, {
    select: { id: true, eventId: true, name: true, createdById: true },
  });

  if (event.createdById === user.id) {
    return event;
  }

  const elevated =
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    hasExplicitPermission(user, ['event_manage_all', 'event_event_manage_all']);

  if (elevated) {
    return event;
  }

  const managerAccess = await canManageEvent(prisma, event.id, user.id);
  if (managerAccess) {
    return event;
  }

  throw new ForbiddenError('You do not have permission to manage this event report');
}

async function resolveEventForView(eventIdentifier, user) {
  const event = await resolveEvent(eventIdentifier, {
    select: { id: true, eventId: true, name: true, createdById: true },
  });

  if (event.createdById === user.id) {
    return event;
  }

  const elevated =
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    hasExplicitPermission(user, [
      'event_view_reports',
      'event_event_view_reports',
      'event_manage_all',
      'event_event_manage_all',
    ]);

  if (elevated) {
    return event;
  }

  const managerAccess = await canManageEvent(prisma, event.id, user.id);
  if (managerAccess) {
    return event;
  }

  throw new ForbiddenError('You do not have permission to view this event report');
}

function validateIncomingFile(file) {
  if (!file) {
    throw new ValidationError('Report file is required');
  }

  if (!file.size || file.size <= 0) {
    throw new ValidationError('Uploaded report is empty');
  }

  if (file.size > MAX_REPORT_SIZE_BYTES) {
    throw new ValidationError('Report file must be 20 MB or smaller');
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError('Only PDF, DOC, and DOCX files are allowed');
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ValidationError('Invalid report MIME type');
  }
}

async function uploadReportBinary(event, userId, file) {
  const safeOriginalName = sanitizeOriginalFileName(file.originalname);

  try {
    const s3Result = await uploadToS3(
      file.buffer,
      path.posix.join(REPORT_FOLDER, event.eventId || event.id),
      userId,
      safeOriginalName,
      file.mimetype || inferMimeFromExtension(safeOriginalName),
    );

    return {
      key: s3Result.key,
      storageProvider: 's3',
      storedFileName: path.posix.basename(s3Result.key),
      originalFileName: safeOriginalName,
      mimeType: file.mimetype || inferMimeFromExtension(safeOriginalName),
      fileSize: file.size,
      sha256Hash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    };
  } catch (err) {
    if (!isS3CredentialError(err)) {
      throw err;
    }

    const storedFileName = buildStoredFileName(safeOriginalName);
    const relativePath = path.posix.join(REPORT_FOLDER, event.eventId || event.id, storedFileName);
    const absolutePath = path.join(LOCAL_UPLOADS_ROOT, ...relativePath.split('/'));
    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsPromises.writeFile(absolutePath, file.buffer);

    return {
      key: relativePath,
      storageProvider: 'local',
      storedFileName,
      originalFileName: safeOriginalName,
      mimeType: file.mimetype || inferMimeFromExtension(safeOriginalName),
      fileSize: file.size,
      sha256Hash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    };
  }
}

async function createVersionedReport(eventId, eventName, uploadedById, uploadMeta) {
  let attempt = 0;

  while (attempt < 3) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const previousLatest = await tx.eventPostReport.findFirst({
          where: { eventId, isLatest: true },
          orderBy: { version: 'desc' },
          select: { id: true, version: true },
        });

        if (previousLatest) {
          await tx.eventPostReport.updateMany({
            where: { eventId, isLatest: true },
            data: { isLatest: false },
          });
        }

        const nextVersion = (previousLatest?.version || 0) + 1;
        const eventBasedFileName = buildEventReportFileName(
          eventName,
          nextVersion,
          uploadMeta.originalFileName,
          uploadMeta.mimeType,
        );

        return tx.eventPostReport.create({
          data: {
            eventId,
            uploadedById,
            version: nextVersion,
            previousReportId: previousLatest?.id || null,
            originalFileName: eventBasedFileName,
            storedFileName: uploadMeta.storedFileName,
            filePath: uploadMeta.key,
            mimeType: uploadMeta.mimeType,
            fileSize: uploadMeta.fileSize,
            storageProvider: uploadMeta.storageProvider,
            sha256Hash: uploadMeta.sha256Hash,
            isLatest: true,
          },
          include: {
            uploadedBy: {
              select: {
                id: true,
                uid: true,
                role: true,
                employeeDetails: {
                  select: { displayName: true, firstName: true, lastName: true },
                },
                studentLogin: {
                  select: { displayName: true, firstName: true, lastName: true },
                },
              },
            },
          },
        });
      });

      return created;
    } catch (err) {
      attempt += 1;
      if (!(err && err.code === 'P2002') || attempt >= 3) {
        throw err;
      }
    }
  }

  throw new ValidationError('Failed to create event report version');
}

function toSafeLocalAbsolutePath(relativePath) {
  const normalizedRoot = path.normalize(LOCAL_UPLOADS_ROOT);
  const absolutePath = path.normalize(path.join(LOCAL_UPLOADS_ROOT, ...relativePath.split('/')));

  if (!absolutePath.startsWith(normalizedRoot)) {
    throw new ForbiddenError('Invalid report path');
  }

  return absolutePath;
}

async function getReportWithUploader(where) {
  return prisma.eventPostReport.findFirst({
    where,
    include: {
      uploadedBy: {
        select: {
          id: true,
          uid: true,
          role: true,
          employeeDetails: {
            select: { displayName: true, firstName: true, lastName: true },
          },
          studentLogin: {
            select: { displayName: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });
}

async function uploadPostEventReport(eventIdentifier, user, file) {
  validateIncomingFile(file);

  const event = await resolveEventForManagement(eventIdentifier, user);
  const uploadMeta = await uploadReportBinary(event, user.id, file);
  const created = await createVersionedReport(event.id, event.name, user.id, uploadMeta);

  invalidateEventCaches(event.id).catch(() => {});

  return mapReportSummary(created);
}

async function listPostEventReports(eventIdentifier, user) {
  const event = await resolveEventForView(eventIdentifier, user);

  const reports = await prisma.eventPostReport.findMany({
    where: { eventId: event.id },
    orderBy: [{ version: 'desc' }],
    include: {
      uploadedBy: {
        select: {
          id: true,
          uid: true,
          role: true,
          employeeDetails: {
            select: { displayName: true, firstName: true, lastName: true },
          },
          studentLogin: {
            select: { displayName: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  const mapped = reports.map(mapReportSummary);

  return {
    latestReport: mapped.find((item) => item.isLatest) || mapped[0] || null,
    versions: mapped,
  };
}

async function getPostEventReportFile(eventIdentifier, reportId, user, options = {}) {
  const { preview = false } = options;
  const event = await resolveEventForView(eventIdentifier, user);

  const report = await getReportWithUploader({ id: reportId, eventId: event.id });
  if (!report) {
    throw new NotFoundError('Event report');
  }

  if (preview && report.mimeType !== 'application/pdf') {
    throw new ValidationError('Preview is available only for PDF reports');
  }

  if (report.storageProvider === 'local') {
    const absolutePath = toSafeLocalAbsolutePath(report.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundError('Event report file');
    }

    const stat = fs.statSync(absolutePath);
    return {
      report: mapReportSummary(report),
      stream: fs.createReadStream(absolutePath),
      contentType: report.mimeType || inferMimeFromExtension(report.originalFileName),
      contentLength: stat.size,
    };
  }

  const s3Data = await downloadFromS3(report.filePath);

  return {
    report: mapReportSummary(report),
    stream: s3Data.stream,
    contentType: s3Data.contentType || report.mimeType || inferMimeFromExtension(report.originalFileName),
    contentLength: s3Data.contentLength,
  };
}

module.exports = {
  MAX_REPORT_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  uploadPostEventReport,
  listPostEventReports,
  getPostEventReportFile,
};
