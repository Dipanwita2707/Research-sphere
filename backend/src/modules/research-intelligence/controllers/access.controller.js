/**
 * Research Intelligence access management.
 *   - University admins (rip_manage_access): per-user grants and role defaults.
 *   - Platform superadmin: enable/disable the module per university.
 */

'use strict';

const access = require('../services/access.service');
const auditLogger = require('../../../shared/utils/auditLogger');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../../audit/services/audit.service');
const { RIP_PERMISSION_DEFINITIONS, RIP_ROLE_DEFAULTABLE_KEYS } = require('../config/ripPermissions');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

/** The caller's own access; works even when the module is disabled (drives navigation). */
const getMyAccess = async (req, res) => {
  const { enabled, permissions } = await access.resolveAccess(req.user, req.tenantId);
  ok(res, { enabled, permissions });
};

const getAccessOverview = async (req, res) => {
  const [settings, grants] = await Promise.all([access.getSettings(req.tenantId), access.listGrants()]);
  ok(res, {
    settings,
    grants,
    capabilities: RIP_PERMISSION_DEFINITIONS.map(({ key, label, description }) => ({ key, label, description, roleDefaultable: RIP_ROLE_DEFAULTABLE_KEYS.includes(key) })),
    defaultableRoles: access.DEFAULTABLE_ROLES,
  });
};

const searchCandidates = async (req, res) => ok(res, await access.searchCandidates(req.query.q));

const setUserGrant = async (req, res) => {
  const result = await access.setGrant(req.user, req.params.userId, req.body || {});
  auditLogger
    .logPermissionChange(result.user, { researchIntelligence: result.permissions, expiresAt: result.expiresAt || null }, req.user.id, req)
    .catch(() => {});
  ok(res, result);
};

const removeUserGrant = async (req, res) => {
  const result = await access.setGrant(req.user, req.params.userId, { permissions: [] });
  auditLogger.logPermissionChange(result.user, { researchIntelligence: [] }, req.user.id, req).catch(() => {});
  ok(res, { removed: true });
};

const updateRoleDefaults = async (req, res) => ok(res, await access.updateRoleDefaults(req.tenantId, req.body?.roleDefaults));

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

module.exports = {
  getMyAccess,
  getAccessOverview,
  searchCandidates,
  setUserGrant,
  removeUserGrant,
  updateRoleDefaults,
  listUniversityModules,
  setUniversityModule,
};
