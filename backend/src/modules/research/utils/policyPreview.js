/**
 * Policy preview responses (the "which policy applies?" endpoints the submission forms call).
 * They must agree with what the calculator pays:
 *
 *   - a configured policy covers the date      → data = policy, policyFound:true
 *   - none, but the calculator has defaults     → data = the built-in defaults, policyFound:true,
 *     (books, chapters, conferences, IPR)          usedDefaultPolicy:true
 *   - none and no defaults (research, grants)   → data = null, policyFound:false + reason (₹0)
 */
const { NO_POLICY_REASON } = require('../services/incentive-calculator');
const { toDateOrNull } = require('./policyWindow');

const DEFAULT_POLICY_REASON = 'No policy is configured for this date — the built-in default policy applies';

/**
 * Date to select the policy for, from a query parameter (publicationDate / onDate).
 * Missing → today. Invalid → throws a 400.
 */
function previewDate(value) {
  if (value === undefined || value === null || value === '') return new Date();
  const date = toDateOrNull(value);
  if (!date) {
    const err = new Error('Invalid date: use YYYY-MM-DD');
    err.statusCode = 400;
    throw err;
  }
  return date;
}

function sendPolicyPreview(res, { policy, defaultPolicy = null, reason = NO_POLICY_REASON, extra = {} }) {
  if (policy) {
    return res.json({
      success: true,
      policyFound: true,
      usedDefaultPolicy: false,
      ...extra,
      data: { ...policy, policyFound: true, usedDefaultPolicy: false },
    });
  }
  if (defaultPolicy) {
    return res.json({
      success: true,
      policyFound: true,
      usedDefaultPolicy: true,
      reason: DEFAULT_POLICY_REASON,
      ...extra,
      data: { ...defaultPolicy, isDefault: true, policyFound: true, usedDefaultPolicy: true, reason: DEFAULT_POLICY_REASON },
    });
  }
  return res.json({ success: true, policyFound: false, usedDefaultPolicy: false, reason, ...extra, data: null });
}

module.exports = { previewDate, sendPolicyPreview, DEFAULT_POLICY_REASON, NO_POLICY_REASON };
