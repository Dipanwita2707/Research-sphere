/**
 * Research Intelligence access management.
 *   - University admins (rip_manage_access): per-user grants, bulk changes.
 *   - Platform superadmin: enable/disable the module per university.
 */

'use strict';

const access = require('../services/access.service');
const auditLogger = require('../../../shared/utils/auditLogger');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../../audit/services/audit.service');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const audit = (req, user, permissions, extra = {}) =>
  auditLogger.logPermissionChange(user, { researchIntelligence: permissions, ...extra }, req.user.id, req).catch(() => {});

/** The caller's own access; works even when the module is disabled (drives navigation). */
const getMyAccess = async (req, res) => {
  const { enabled, permissions, source } = await access.resolveAccess(req.user, req.tenantId);
  ok(res, { enabled, permissions, source });
};

const getOverview = async (req, res) => ok(res, await access.getOverview(req.tenantId));

const listUsers = async (req, res) =>
  ok(res, await access.listUsers({ q: req.query.q, role: req.query.role, access: req.query.access, page: req.query.page, pageSize: req.query.pageSize }));

const setUserGrant = async (req, res) => {
  const result = await access.setGrant(req.user, req.params.userId, req.body || {});
  audit(req, result.user, result.permissions, { expiresAt: result.expiresAt || null });
  ok(res, { userId: req.params.userId, permissions: result.permissions, expiresAt: result.expiresAt });
};

const removeUserGrant = async (req, res) => {
  const result = await access.setGrant(req.user, req.params.userId, { permissions: [] });
  audit(req, result.user, []);
  ok(res, { removed: true });
};

const bulkUpdate = async (req, res) => {
  const { updated, skipped } = await access.bulkSet(req.user, req.body || {});
  updated.forEach((r) => audit(req, r.user, r.permissions, { expiresAt: r.expiresAt || null, bulk: true, mode: req.body?.mode || 'add' }));
  ok(res, { updated: updated.length, skipped });
};

// ─── Platform (superadmin) ────────────────────────────────────────────────────

const listUniversityModules = async (req, res) => ok(res, await access.listUniversityModules());

const setUniversityModule = async (req, res) => {
  const { university, module } = await access.setUniversityModule(req.user, req.params.universityId, { enabled: req.body?.enabled, notes: req.body?.notes });
  auditService
    .log({
      actorId: req.user.id,
      action: `${module.enabled ? 'Enabled' : 'Disabled'} Research Intelligence for ${university.name}`,
      actionType: AuditActionType.CONFIG_CHANGE,
      module: AuditModule.SYSTEM,
      category: 'module-access',
      severity: AuditSeverity.INFO,
      targetTable: 'university_module',
      targetId: module.id,
      newValues: { enabled: module.enabled, notes: module.notes },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { universityId: university.id, moduleKey: access.MODULE_KEY },
    })
    .catch(() => {});
  ok(res, { universityId: university.id, enabled: module.enabled, enabledAt: module.enabledAt, disabledAt: module.disabledAt, notes: module.notes });
};

module.exports = { getMyAccess, getOverview, listUsers, setUserGrant, removeUserGrant, bulkUpdate, listUniversityModules, setUniversityModule };
