const prisma = require('../../../shared/config/database');

const SINGLETON_ID = 'default';

// Ensure the audit table exists in whatever DB the server is connected to.
// Runs once on module load — safe to call multiple times (IF NOT EXISTS).
let _auditTableReady = false;
async function ensureAuditTable() {
  if (_auditTableReady) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS loan_letter_template_audit (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        version         SERIAL,
        changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        changed_by_id   UUID REFERENCES user_login(id) ON DELETE SET NULL,
        changed_by_name VARCHAR(256),
        changed_by_uid  VARCHAR(64),
        changes         JSONB NOT NULL DEFAULT '{}'
      )
    `);
    _auditTableReady = true;
  } catch (err) {
    console.error('ensureAuditTable error:', err.message);
  }
}
// Kick off immediately so it's ready before the first request
ensureAuditTable();

const DEFAULTS = {
  universityName: 'SHREE GURU GOBIND SINGH TRICENTENARY UNIVERSITY (SGT UNIVERSITY \u00ae)',
  universityShort: 'SGT University \u00ae',
  universityAddr: 'Gurugram, Haryana',
  universityLegal: '(Established by State Legislature Act 2013 & Recognized by UGC)',
  branchTitle: 'Accounts Branch',
  refPrefix: 'SGTU/Bank Loan',
  headerImageUrl: null,
  headerImageWidth: 100,
  watermarkImageUrl: null,
  watermarkOpacity: 20,
  watermarkWidth: 30,
  footerNotes: [
    'Fee for Transport/Hostel/Mess/Medical is not included in the above, but will be a part of the bank loan and the same will be intimated to the bank from time to time.',
  ],
  bankDetails: {
    accountName: 'SGT University',
    bankName: '',
    branchName: '',
    accountNumber: '',
    ifscCode: '',
    micrCode: '',
  },
  signatoryTitle: 'Authorized Signatory',
  signatoryDept: '(Finance Department)',
  signatoryOrg: 'SGT University, Gurugram',
};

/**
 * Return the singleton template, merging DB row with built-in defaults as fallback.
 */
async function getTemplate() {
  try {
    const row = await prisma.loanLetterTemplate.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) return { ...DEFAULTS };
    // Fetch new image columns via raw SQL (not yet in the generated Prisma client)
    let imageFields = {};
    try {
      const rows = await prisma.$queryRaw`
        SELECT header_image_width, watermark_image_url, watermark_opacity, watermark_width
        FROM loan_letter_template WHERE id = ${SINGLETON_ID}
      `;
      if (rows && rows[0]) {
        imageFields = {
          headerImageWidth: rows[0].header_image_width ?? 100,
          watermarkImageUrl: rows[0].watermark_image_url ?? null,
          watermarkOpacity: rows[0].watermark_opacity ?? 20,
          watermarkWidth: rows[0].watermark_width ?? 30,
        };
      }
    } catch (_) { /* columns may not exist yet — fall back to defaults */ }
    // Ensure bankDetails / footerNotes always have defaults for any missing keys
    const bankDetails = { ...DEFAULTS.bankDetails, ...(row.bankDetails || {}) };
    const footerNotes = Array.isArray(row.footerNotes) && row.footerNotes.length > 0
      ? row.footerNotes
      : DEFAULTS.footerNotes;
    return { ...DEFAULTS, ...row, bankDetails, footerNotes, ...imageFields };
  } catch {
    return { ...DEFAULTS };
  }
}

// Fields handled by Prisma upsert (schema-defined)
const ALLOWED_FIELDS = [
  'universityName', 'universityShort', 'universityAddr', 'universityLegal',
  'branchTitle', 'refPrefix', 'headerImageUrl',
  'footerNotes', 'bankDetails', 'templateBody',
  'signatoryTitle', 'signatoryDept', 'signatoryOrg',
];

// Fields that map to new raw SQL columns not yet in the Prisma-generated client
const RAW_IMAGE_FIELDS = {
  headerImageWidth: 'header_image_width',
  watermarkImageUrl: 'watermark_image_url',
  watermarkOpacity: 'watermark_opacity',
  watermarkWidth: 'watermark_width',
};

// Human-readable labels for auditable fields
const FIELD_LABELS = {
  universityName: 'University Name',
  universityShort: 'University Short Name',
  universityAddr: 'University Address',
  universityLegal: 'Legal Info',
  branchTitle: 'Branch Title',
  refPrefix: 'Reference Prefix',
  headerImageUrl: 'Header Image',
  headerImageWidth: 'Header Image Width',
  watermarkImageUrl: 'Watermark Image',
  watermarkOpacity: 'Watermark Opacity',
  watermarkWidth: 'Watermark Size',
  templateBody: 'Document Body',
  footerNotes: 'Footer Notes',
  bankDetails: 'Bank Details',
  signatoryTitle: 'Signatory Title',
  signatoryDept: 'Signatory Department',
  signatoryOrg: 'Signatory Organisation',
};

/**
 * Compare old vs new values and return a map of changed fields.
 */
function diffTemplate(oldTmpl, newData) {
  const changes = {};
  const ALL_KEYS = Object.keys(FIELD_LABELS);
  for (const key of ALL_KEYS) {
    if (newData[key] === undefined) continue;
    const oldVal = oldTmpl[key];
    const newVal = newData[key];
    const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? '');
    const newStr = typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal ?? '');
    if (oldStr !== newStr) {
      if (key === 'templateBody') {
        // Store raw HTML — the frontend renders it as a document preview with sample substitution
        changes[key] = { label: FIELD_LABELS[key], from: oldStr, to: newStr };
      } else {
        changes[key] = { label: FIELD_LABELS[key], from: oldStr, to: newStr };
      }
    }
  }
  return changes;
}

/**
 * Insert one audit row after a template save.
 */
async function insertAuditEntry(changes, updatedById) {
  if (Object.keys(changes).length === 0) return; // nothing changed
  await ensureAuditTable();
  try {
    // Fetch user details for denormalised display
    let changedByName = null;
    let changedByUid = null;
    if (updatedById) {
      try {
        const rows = await prisma.$queryRaw`
          SELECT ul.uid,
                 COALESCE(ed.display_name, CONCAT(ed.first_name, ' ', ed.last_name), ul.email, ul.uid) AS display
          FROM user_login ul
          LEFT JOIN employee_details ed ON ed.user_login_id = ul.id
          WHERE ul.id = ${updatedById}::uuid
          LIMIT 1
        `;
        if (rows && rows[0]) {
          changedByName = rows[0].display || null;
          changedByUid = rows[0].uid || null;
        }
      } catch (_) { /* ignore user lookup failure */ }
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO loan_letter_template_audit (changed_by_id, changed_by_name, changed_by_uid, changes)
       VALUES ($1::uuid, $2, $3, $4::jsonb)`,
      updatedById || null,
      changedByName,
      changedByUid,
      JSON.stringify(changes),
    );
  } catch (err) {
    console.error('Audit insert error:', err);
  }
}

/**
 * Fetch the audit log for the template (most recent first).
 */
async function getTemplateAuditLog({ page = 1, limit = 20 } = {}) {
  await ensureAuditTable();
  const offset = (page - 1) * limit;
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        version,
        changed_at      AS "changedAt",
        changed_by_id   AS "changedById",
        changed_by_name AS "changedByName",
        changed_by_uid  AS "changedByUid",
        changes
      FROM loan_letter_template_audit
      ORDER BY changed_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countRows = await prisma.$queryRaw`SELECT COUNT(*) AS total FROM loan_letter_template_audit`;
    const total = Number(countRows[0]?.total ?? 0);
    return { rows: rows || [], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  } catch (err) {
    console.error('Audit log fetch error:', err);
    return { rows: [], total: 0, page, limit, totalPages: 1 };
  }
}

/**
 * Upsert the singleton template row.
 * @param {object} data - Partial fields to update
 * @param {string} updatedById - User performing the save
 */
async function updateTemplate(data, updatedById) {
  // Snapshot current state before saving so we can diff the changes
  const previousState = await getTemplate();

  const payload = {};
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  if (updatedById) payload.updatedById = updatedById;

  await prisma.loanLetterTemplate.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...payload },
    update: payload,
  });

  // Persist raw image fields separately
  const rawUpdates = [];
  const rawValues = [];
  let paramIdx = 1;
  for (const [jsKey, col] of Object.entries(RAW_IMAGE_FIELDS)) {
    if (data[jsKey] !== undefined) {
      rawUpdates.push(`${col} = $${paramIdx++}`);
      rawValues.push(data[jsKey]);
    }
  }
  if (rawUpdates.length > 0) {
    rawValues.push(SINGLETON_ID);
    await prisma.$executeRawUnsafe(
      `UPDATE loan_letter_template SET ${rawUpdates.join(', ')} WHERE id = $${paramIdx}`,
      ...rawValues,
    );
  }

  // Compute diff against prior state and persist audit entry (fire-and-forget)
  const allChangedData = { ...data };
  const changes = diffTemplate(previousState, allChangedData);
  insertAuditEntry(changes, updatedById);

  return getTemplate();
}

/**
 * Persist the locally uploaded header image URL on the singleton template.
 */
async function saveHeaderImage(headerImageUrl, updatedById) {
  await updateTemplate({ headerImageUrl }, updatedById);
  return headerImageUrl;
}

/**
 * Persist the locally uploaded watermark image URL on the singleton template.
 */
async function saveWatermarkImage(watermarkImageUrl, updatedById) {
  await updateTemplate({ watermarkImageUrl }, updatedById);
  return watermarkImageUrl;
}

module.exports = { getTemplate, updateTemplate, saveHeaderImage, saveWatermarkImage, getTemplateAuditLog, DEFAULTS };
