/**
 * Which date selects a grant's incentive policy: the sanction date if set, then the date the
 * proposal was submitted to the funding agency, then the date it was submitted in the system,
 * and only as a last resort the approval date. The basis is recorded with the approval.
 */
const { toDateOrNull } = require('../../research/utils/policyWindow');

const GRANT_POLICY_DATE_LABELS = {
  sanction_date: 'sanction date',
  date_of_submission: 'submission date',
  submitted_at: 'submission date (system)',
  approval_date: 'approval date',
};

/**
 * @param {object} grant  grant application row
 * @param {Date} [approvalDate]
 * @returns {{ date: Date, basis: string, label: string }}
 */
function grantPolicyDate(grant = {}, approvalDate = new Date()) {
  const candidates = [
    ['sanction_date', grant.sanctionDate],
    ['date_of_submission', grant.dateOfSubmission],
    ['submitted_at', grant.submittedAt],
  ];
  for (const [basis, value] of candidates) {
    const date = toDateOrNull(value);
    if (date) return { date, basis, label: GRANT_POLICY_DATE_LABELS[basis] };
  }
  return { date: toDateOrNull(approvalDate) || new Date(), basis: 'approval_date', label: GRANT_POLICY_DATE_LABELS.approval_date };
}

module.exports = { grantPolicyDate, GRANT_POLICY_DATE_LABELS };
