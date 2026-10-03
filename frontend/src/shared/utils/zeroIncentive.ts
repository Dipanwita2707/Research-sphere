/**
 * Approvals never pay a silent ₹0: when no incentive policy applies (or the policy computes
 * ₹0) the backend answers 409 { code: 'NO_INCENTIVE_POLICY', message }. The approver must
 * confirm, and the request is resent with `confirmZeroIncentive: true`.
 */

export const NO_INCENTIVE_POLICY = 'NO_INCENTIVE_POLICY';

export const ZERO_INCENTIVE_CONFIRM_TITLE = 'Approve with ₹0 incentive?';

interface ErrorWithResponse {
  response?: { status?: number; data?: { code?: string; message?: string } };
}

/** The server's explanation when `error` is a 409 NO_INCENTIVE_POLICY, otherwise null. */
export function noIncentivePolicyMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { response } = error as ErrorWithResponse;
  if (response?.status !== 409 || response.data?.code !== NO_INCENTIVE_POLICY) return null;
  return response.data?.message || 'No incentive policy applies — approving now pays ₹0 incentive.';
}

/**
 * Send an approval; on 409 NO_INCENTIVE_POLICY ask the approver (`ask` gets the server's
 * explanation) and, if they accept, resend with confirmZeroIncentive. Returns null when the
 * approver declines. Any other error is rethrown.
 */
export async function approveWithZeroIncentiveCheck<T>(
  send: (confirmZeroIncentive: boolean) => Promise<T>,
  ask: (message: string) => Promise<boolean>,
): Promise<T | null> {
  try {
    return await send(false);
  } catch (error: unknown) {
    const reason = noIncentivePolicyMessage(error);
    if (!reason) throw error;
    if (!(await ask(reason))) return null;
    return send(true);
  }
}

/** Body of a policy preview endpoint (`/…-policies/active…`, `/research-policies/applicable`). */
interface PolicyPreviewBody {
  policyFound?: boolean;
  usedDefaultPolicy?: boolean;
  reason?: string;
}

/**
 * Notice to show next to an incentive preview, matching what the server will pay:
 * no policy → "No policy — ₹0"; built-in defaults → say so; a configured policy → null.
 */
export function policyNoticeOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { policyFound, usedDefaultPolicy, reason } = body as PolicyPreviewBody;
  if (policyFound === false) {
    return `No policy — ₹0. ${reason || 'No incentive policy covers this publication date/type'}; the incentive will be ₹0 unless a policy is configured.`;
  }
  if (usedDefaultPolicy) {
    return 'No policy is configured for this date — amounts shown come from the built-in default policy.';
  }
  return null;
}

/** Shape of the warning returned with a contribution create/edit response. */
export interface IncentiveWarning {
  code: string;
  message: string;
  reason?: string | null;
}

/** incentiveWarning from a create/update API response body (`{ data: { incentiveWarning } }`). */
export function incentiveWarningOf(responseBody: unknown): IncentiveWarning | null {
  if (typeof responseBody !== 'object' || responseBody === null) return null;
  const data = (responseBody as { data?: { incentiveWarning?: IncentiveWarning } }).data;
  const warning = data?.incentiveWarning;
  return warning && typeof warning.message === 'string' ? warning : null;
}
