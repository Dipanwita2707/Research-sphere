/**
 * Research Intelligence access management.
 *   - University admins (rip_manage_access): role templates, assigning roles to people, extra grants.
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
  const { enabled, permissions, source, roles } = await access.resolveAccess(req.user, req.tenantId);
  ok(res, { enabled, permissions, source, roles });
};

const getOverview = async (req, res) => ok(res, await access.getOverview(req.tenantId));

const listUsers = async (req, res) =>
  ok(res, await access.listUsers({ q: req.query.q, role: req.query.role, roleId: req.query.roleId, access: req.query.access, page: req.query.page, pageSize: req.query.pageSize }));

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

const auditRoles = (req, r, extra = {}) => auditLogger.logPermissionChange(r.user, { type: 'role_assignment', roleIds: r.roleIds, roleNames: r.roleNames, scope: 'research-intelligence', ...extra }, req.user.id, req).catch(() => {});

const createRoleFromTemplate = async (req, res) => {
  const { role, created } = await access.createRoleFromTemplate(req.user, req.body?.template);
  ok(res, { role, created }, created ? 201 : 200);
};

const setUserRoles = async (req, res) => {
  const r = await access.setUserRoles(req.params.userId, req.body?.roleIds);
  if (!r.unchanged) auditRoles(req, r);
  ok(res, { userId: req.params.userId, roleIds: r.roleIds });
};

const bulkRoles = async (req, res) => {
  const { updated, skipped } = await access.bulkRole(req.body || {});
  updated.filter((r) => !r.unchanged).forEach((r) => auditRoles(req, r, { bulk: true, mode: req.body?.mode }));
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

module.exports = { getMyAccess, getOverview, listUsers, createRoleFromTemplate, setUserRoles, bulkRoles, setUserGrant, removeUserGrant, listUniversityModules, setUniversityModule };
