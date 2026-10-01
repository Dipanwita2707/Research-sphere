import type { RipCapability, RipPermissionKey } from '../../types';

export const errMsg = (e: unknown, fallback: string) => (e as any)?.response?.data?.message || (e as Error)?.message || fallback;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

/** "Assistant, Knowledge graph & experts, …" in catalog order. */
export const labelsFor = (keys: RipPermissionKey[], capabilities: RipCapability[]) =>
  capabilities.filter((c) => keys.includes(c.key)).map((c) => c.label);

export const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : '');
