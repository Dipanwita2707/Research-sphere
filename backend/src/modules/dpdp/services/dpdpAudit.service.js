/**
 * @module dpdp/services/dpdpAudit
 * @description Audit trail for every DPDP action. Only ids, types, counts and
 * purpose keys are recorded, never the personal data itself.
 */
const { auditService, AuditActionType, AuditSeverity } = require('../../audit/services/audit.service');
const { getIp } = require('../../../shared/utils/auditLogger');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { safeIp } = require('../dpdp.utils');

const DPDP_AUDIT_MODULE = 'dpdp';

/**
 * @param {object} p
 * @param {import('express').Request} [p.req]
 * @param {string|null} [p.actorId]
 * @param {string|null} [p.universityId] required outside a request context (public/job)
 * @param {string} p.action short human description, without personal data
 * @param {string} [p.actionType]
 * @param {string} [p.category]
 * @param {string} [p.targetTable]
 * @param {string} [p.targetId]
 * @param {object} [p.details] ids/counts/keys only
 * @param {string} [p.severity]
 */
const dpdpAudit = async ({
  req, actorId, universityId, action, actionType = AuditActionType.OTHER, category = 'dpdp',
  targetTable = null, targetId = null, details = {}, severity = AuditSeverity.INFO,
}) => {
  const ctxTenant = tenantContext.getTenantId();
  const uni = universityId !== undefined ? universityId : ctxTenant;
  const write = () => auditService.log({
    actorId: actorId !== undefined ? actorId : req?.user?.id || null,
    universityId: uni || null,
    action: String(action).slice(0, 256),
    actionType,
    module: DPDP_AUDIT_MODULE,
    category,
    severity,
    targetTable,
    targetId,
    details,
    ipAddress: req ? safeIp(getIp(req)) : null,
    userAgent: req ? String(req.headers?.['user-agent'] || '').slice(0, 512) || null : null,
    requestPath: req ? String(req.originalUrl || req.url || '').split('?')[0].slice(0, 512) : null,
    requestMethod: req?.method || null,
  });
  // Inside another tenant's context (e.g. superadmin acting on X-University-Id) the extension
  // would block a cross-tenant audit row; outside any context a university must be given explicitly.
  if (uni && ctxTenant && uni !== ctxTenant) return tenantContext.runForTenant(uni, write);
  if (uni && !ctxTenant) return tenantContext.runForTenant(uni, write);
  return write();
};

module.exports = { dpdpAudit, AuditActionType, AuditSeverity, DPDP_AUDIT_MODULE };
