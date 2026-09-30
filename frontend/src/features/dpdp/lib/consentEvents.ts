import api from '@/shared/api/api';

/**
 * Tiny event bus used to open the consent gate from anywhere, e.g. when the
 * backend answers any request with 403 { code: 'CONSENT_REQUIRED' }.
 *
 * The listener is attached to the shared axios instance from the outside
 * (api.interceptors.response.use) so `src/shared/api/api.ts` stays untouched.
 */

export const CONSENT_REQUIRED_CODE = 'CONSENT_REQUIRED';

type Listener = () => void;
const listeners = new Set<Listener>();

export function onConsentRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitConsentRequired(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a broken listener must not break the request chain */
    }
  });
}

interface MaybeHttpError {
  response?: { status?: number; data?: unknown };
}

export function isConsentRequiredError(error: unknown): boolean {
  const res = (error as MaybeHttpError | null)?.response;
  if (!res || res.status !== 403) return false;
  const data = res.data as { code?: unknown; error?: { code?: unknown } } | null | undefined;
  return data?.code === CONSENT_REQUIRED_CODE || data?.error?.code === CONSENT_REQUIRED_CODE;
}

let interceptorId: number | null = null;

/** Idempotently registers the CONSENT_REQUIRED listener on the shared api client. */
export function installConsentInterceptor(): void {
  if (interceptorId !== null || typeof window === 'undefined') return;
  interceptorId = api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (isConsentRequiredError(error)) emitConsentRequired();
      return Promise.reject(error);
    },
  );
}
