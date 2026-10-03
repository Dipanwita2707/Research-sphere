'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/shared/api/api';
import { logger } from '@/shared/utils/logger';

/** One active claim on the same work at this university (GET /research/duplicates/check). */
export interface DuplicateClaim {
  id?: string;
  applicationNumber?: string | null;
  status: string;
  title?: string | null;
  claimedBy?: string | null;
  submittedAt?: string | null;
}

export interface DuplicateCheckParams {
  publicationType?: string;
  doi?: string;
  paperDoi?: string;
  isbn?: string;
  title?: string;
  publicationDate?: string;
  excludeId?: string | null;
}

interface DuplicateCheckResult {
  workKey: string | null;
  duplicate: boolean;
  claims: DuplicateClaim[];
}

const humanStatus = (status?: string | null) => (status ? status.replace(/_/g, ' ') : 'in progress');

/** "Already claimed by <name> (<application no>, <status>). Ask them to add you as a co-author instead of submitting again." */
export function duplicateClaimMessage(claim: DuplicateClaim): string {
  const who = claim.claimedBy || 'another author';
  const ref = [claim.applicationNumber, humanStatus(claim.status)].filter(Boolean).join(', ');
  return `Already claimed by ${who} (${ref}). Ask them to add you as a co-author instead of submitting again.`;
}

/**
 * If `error` is the submit-time 409 DUPLICATE_CLAIM from the backend, return the message to show
 * (and the existing claim when the server sent it); otherwise null.
 */
export function getDuplicateClaimError(error: unknown): { message: string; claim: DuplicateClaim | null } | null {
  if (typeof error !== 'object' || error === null) return null;
  const response = (error as { response?: { status?: number; data?: { code?: string; message?: string; existing?: DuplicateClaim } } }).response;
  const data = response?.data;
  if (!data || data.code !== 'DUPLICATE_CLAIM') return null;
  const claim = data.existing && typeof data.existing === 'object' ? data.existing : null;
  return {
    message: claim ? duplicateClaimMessage(claim) : (data.message || 'This work has already been claimed. Ask the person who submitted it to add you as a co-author instead of submitting again.'),
    claim,
  };
}

/** Enough identifying data for the server to compute a work key? (avoids pointless requests) */
const hasIdentity = (p: DuplicateCheckParams) =>
  Boolean((p.doi && p.doi.trim().length >= 7) || (p.paperDoi && p.paperDoi.trim().length >= 7)
    || (p.isbn && p.isbn.replace(/[^0-9Xx]/g, '').length >= 10)
    || (p.title && p.title.trim().length >= 12));

/**
 * Debounced live duplicate check for the submission form. Re-runs `delay` ms after the
 * identifying fields stop changing; stale responses are ignored.
 */
export function useDuplicateClaimCheck(params: DuplicateCheckParams, { enabled = true, delay = 600 } = {}) {
  const [result, setResult] = useState<{ claims: DuplicateClaim[]; checking: boolean }>({ claims: [], checking: false });
  const seq = useRef(0);
  const { publicationType, doi, paperDoi, isbn, title, publicationDate, excludeId } = params;
  const active = Boolean(enabled && publicationType && hasIdentity({ doi, paperDoi, isbn, title }));

  useEffect(() => {
    const mySeq = ++seq.current;
    if (!active) return undefined;
    const current = { publicationType, doi, paperDoi, isbn, title, publicationDate, excludeId };
    const timer = setTimeout(async () => {
      setResult((prev) => ({ ...prev, checking: true }));
      let claims: DuplicateClaim[] = [];
      try {
        const query: Record<string, string> = {};
        for (const [k, v] of Object.entries(current)) if (v) query[k] = String(v).trim();
        const response = await api.get<{ success: boolean; data: DuplicateCheckResult }>('/research/duplicates/check', { params: query });
        claims = response.data?.data?.duplicate ? response.data.data.claims || [] : [];
      } catch (err) {
        // The live check is advisory only; the server enforces the rule on submit.
        logger.debug('Duplicate check failed', err);
      }
      if (mySeq === seq.current) setResult({ claims, checking: false });
    }, delay);
    return () => clearTimeout(timer);
  }, [active, delay, publicationType, doi, paperDoi, isbn, title, publicationDate, excludeId]);

  // Without identifying data there is nothing to warn about; otherwise keep the last answer
  // on screen until the next (debounced) one replaces it.
  return active ? result : { claims: [] as DuplicateClaim[], checking: false };
}
