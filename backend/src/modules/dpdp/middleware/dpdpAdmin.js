/**
 * @module dpdp/middleware/dpdpAdmin
 * @description Access to DPDP administration (requests, notices, breaches, retention,
 * DPO contact): superadmin, the tenant `admin` role (implicitly), or any user holding
 * the `dpdp_manage` permission through a central/school department or an assigned role.
 */
const { getDefaultPermissions } = require('../../../shared/config/permissions.config');

const DPDP_MANAGE = 'dpdp_manage';

const holdsPermission = (entries) => Array.isArray(entries)
  && entries.some((e) => e && e.permissions && e.permissions[DPDP_MANAGE] === true);

/** @param {object} user req.user as set by protect */
const canManageDpdp = (user) => {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  if (getDefaultPermissions(user.role)?.[DPDP_MANAGE] === true) return true;
  return holdsPermission(user.centralDeptPermissions) || holdsPermission(user.schoolDeptPermissions);
};

const requireDpdpAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (!canManageDpdp(req.user)) {
    return res.status(403).json({ success: false, message: 'You need the Data Protection (dpdp_manage) permission for this action' });
  }
  return next();
};

module.exports = { requireDpdpAdmin, canManageDpdp, DPDP_MANAGE };
