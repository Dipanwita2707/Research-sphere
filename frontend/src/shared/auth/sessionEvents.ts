/**
 * Auth/session events raised by the API client and handled by AuthProvider.
 *
 * The API client must not import the auth store (the store imports the API
 * client through auth.service), so it reports problems through window events.
 */

export const SESSION_ENDED_EVENT = 'auth:session-ended';
export const ACCESS_BLOCKED_EVENT = 'auth:access-blocked';

/** 403/503 codes that mean "your university/installation cannot use the app right now". */
export const ACCESS_BLOCKED_CODES = [
  'TENANT_SUSPENDED',
  'TENANT_NOT_FOUND',
  'SUBSCRIPTION_REQUIRED',
  'SUBSCRIPTION_EXPIRED',
  'NO_TENANT',
  'LICENSE_INVALID',
] as const;

export type AccessBlockedCode = (typeof ACCESS_BLOCKED_CODES)[number];

export interface SessionEndedDetail {
  code?: string;
  message?: string;
}

export interface AccessBlockedDetail {
  code: AccessBlockedCode;
  message?: string;
}

/** Query value put on /login?reason=… after a forced sign-out. */
export const LOGIN_REASON_SESSION_ENDED = 'session_ended';
export const LOGIN_REASON_SIGNED_OUT_EVERYWHERE = 'signed_out_everywhere';

export const isAccessBlockedCode = (code: unknown): code is AccessBlockedCode =>
  typeof code === 'string' && (ACCESS_BLOCKED_CODES as readonly string[]).includes(code);

export const emitSessionEnded = (detail: SessionEndedDetail): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SessionEndedDetail>(SESSION_ENDED_EVENT, { detail }));
};

export const emitAccessBlocked = (detail: AccessBlockedDetail): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AccessBlockedDetail>(ACCESS_BLOCKED_EVENT, { detail }));
};
