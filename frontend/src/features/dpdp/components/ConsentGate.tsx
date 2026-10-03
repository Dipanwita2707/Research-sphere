'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Lock, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { logger } from '@/shared/utils/logger';
import { dpdpService } from '../services/dpdp.service';
import { installConsentInterceptor, onConsentRequired } from '../lib/consentEvents';
import SafeMarkdown from '../lib/SafeMarkdown';
import { errorMessage, formatDate } from '../lib/format';
import type { DpoContact, GuardianInput, MyConsentState } from '../types';
import { Modal, Toggle, btnPrimary, btnSecondary, inputClass, labelClass } from './ui';

/** Routes where the gate must never appear (public / pre-login pages). */
const EXEMPT_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/privacy/', '/guardian-consent/', '/superadmin', '/p/'];

const RELATIONS = ['Mother', 'Father', 'Legal guardian', 'Other'];

type Mode = 'hidden' | 'form' | 'pending';

/** Mirrors the backend gate: blocked while consent is missing or guardian verification is pending. */
function isBlocked(s: MyConsentState): boolean {
  return !!(s.needsConsent || s.guardianPending);
}

/**
 * Blocking DPDP consent gate. Mounted once in the root layout.
 * - After login it fetches GET /dpdp/consents/me and opens when needsConsent is true.
 * - It also opens whenever any API call answers 403 { code: 'CONSENT_REQUIRED' }.
 * - Superadmins never see it.
 */
export default function ConsentGate() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const role = (user?.role?.name || user?.userType || '').toLowerCase();
  const isSuperadmin = role === 'superadmin';
  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  const eligible = isAuthenticated && !!user && !isSuperadmin;

  const [state, setState] = useState<MyConsentState | null>(null);
  const [contact, setContact] = useState<DpoContact | null>(null);
  const [mode, setMode] = useState<Mode>('hidden');
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [guardian, setGuardian] = useState<GuardianInput>({ name: '', email: '', relation: RELATIONS[0] });
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  /** API calls rejected with CONSENT_REQUIRED while the gate was needed (their screens need a reload). */
  const blockedCallsRef = useRef(0);

  const applyState = useCallback((next: MyConsentState | null) => {
    setState(next);
    // The backend blocks while required consent is missing OR (for minors) the guardian has not verified.
    if (!next || !next.notice || !isBlocked(next)) {
      setMode('hidden');
      return;
    }
    if (next.guardianPending && !next.needsConsent) {
      setMode('pending');
    } else {
      setMode('form');
    }
    // Pre-fill decisions: required purposes on, others from existing records (default off — no pre-ticked boxes).
    const restricted = new Set(next.minorRestrictedPurposes || []);
    const initial: Record<string, boolean> = {};
    for (const p of next.notice.purposes || []) {
      const rec = next.records?.find((r) => r.purpose === p.key && r.noticeId === next.notice?.id);
      initial[p.key] = p.required ? true : !restricted.has(p.key) && !!(rec && rec.granted && !rec.withdrawnAt);
    }
    setDecisions(initial);
    const g = next.records?.find((r) => r.guardianEmail);
    if (g) {
      setGuardian({
        name: g.guardianName || '',
        email: g.guardianEmail || '',
        relation: g.guardianRelation || RELATIONS[0],
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const next = await dpdpService.getMyConsents();
      applyState(next);
      return next;
    } catch (error) {
      // Fail open on the client — the backend still enforces CONSENT_REQUIRED.
      logger.warn('[DPDP] Could not load consent state', errorMessage(error));
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, [applyState]);

  // Register the global 403 CONSENT_REQUIRED listener once (no edit of api.ts needed).
  useEffect(() => {
    installConsentInterceptor();
  }, []);

  // Initial check after login / user switch.
  useEffect(() => {
    if (!eligible) {
      setMode('hidden');
      setState(null);
      return;
    }
    void refresh();
  }, [eligible, user?.id, refresh]);

  // Any API call rejected with CONSENT_REQUIRED re-opens the gate.
  useEffect(() => {
    if (!eligible) return;
    return onConsentRequired(() => {
      blockedCallsRef.current += 1;
      void refresh();
    });
  }, [eligible, refresh]);

  // DPO contact for the footer (best effort).
  useEffect(() => {
    if (mode === 'hidden' || contact) return;
    dpdpService
      .getContact()
      .then(setContact)
      .catch(() => setContact({}));
  }, [mode, contact]);

  // While waiting for the guardian, poll gently when the tab regains focus.
  useEffect(() => {
    if (mode !== 'pending') return;
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [mode, refresh]);

  const notice = state?.notice || null;
  const requiresGuardian = !!state?.requiresGuardian;
  const restrictedForMinor = useMemo(() => new Set(state?.minorRestrictedPurposes || []), [state]);

  /** Consent is complete: refresh data that failed while the gate was up. */
  const onUnblocked = useCallback(() => {
    void queryClient.invalidateQueries();
    if (blockedCallsRef.current > 0) {
      blockedCallsRef.current = 0;
      // Screens that fetched with plain useEffect will not retry on their own.
      window.setTimeout(() => window.location.reload(), 600);
    }
  }, [queryClient]);

  const allRequiredGranted = useMemo(
    () => (notice?.purposes || []).every((p) => !p.required || decisions[p.key]),
    [notice, decisions],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notice) return;
    setFormError(null);
    if (!acknowledged) {
      setFormError('Please confirm that you have read the privacy notice.');
      return;
    }
    if (!allRequiredGranted) {
      setFormError('Required purposes must be accepted to use the platform.');
      return;
    }
    if (requiresGuardian) {
      if (!guardian.name.trim() || !guardian.email.trim()) {
        setFormError('Please enter your parent or guardian’s name and email address.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardian.email.trim())) {
        setFormError('Please enter a valid guardian email address.');
        return;
      }
      if (user?.email && guardian.email.trim().toLowerCase() === user.email.toLowerCase()) {
        setFormError('The guardian’s email must be different from your own.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const next = await dpdpService.submitConsent({
        noticeId: notice.id,
        decisions: (notice.purposes || []).map((p) => ({
          purpose: p.key,
          granted: p.required ? true : !restrictedForMinor.has(p.key) && !!decisions[p.key],
        })),
        ...(requiresGuardian
          ? { guardian: { name: guardian.name.trim(), email: guardian.email.trim(), relation: guardian.relation } }
          : {}),
      });
      applyState(next);
      if (next?.guardianPending) {
        if (next.guardianEmailSent === false) {
          toast.warning(
            'Your choices were saved, but we could not email your guardian right now. Try “Change guardian details / resend” later or contact your university.',
            'Guardian email not sent',
          );
        } else {
          toast.info('We have emailed your guardian a link to verify your consent.', 'Guardian verification sent');
        }
      } else if (next && !isBlocked(next)) {
        toast.success('Thank you — your consent preferences have been saved.');
        onUnblocked();
      }
    } catch (error) {
      setFormError(errorMessage(error, 'Could not save your consent. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckAgain = async () => {
    setChecking(true);
    const next = await refresh();
    setChecking(false);
    if (next && !isBlocked(next)) {
      toast.success('Your guardian has verified your consent. Welcome!');
      onUnblocked();
    } else if (next?.guardianPending) {
      toast.info('Still waiting for your guardian to verify.');
    }
  };

  const handleLogout = async () => {
    await logout();
    setMode('hidden');
    router.replace('/login');
  };

  if (!eligible || exempt || mode === 'hidden' || !notice) return null;

  const privacyHref = contact?.universitySlug ? `/privacy/${contact.universitySlug}` : null;

  const contactBlock = (
    <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
      <p>
        Questions or grievances? Contact the Data Protection Officer
        {contact?.dpoName ? ` (${contact.dpoName})` : ''}
        {contact?.dpoEmail ? (
          <>
            {' '}at{' '}
            <a className="text-wine dark:text-hi underline" href={`mailto:${contact.dpoEmail}`}>
              {contact.dpoEmail}
            </a>
          </>
        ) : null}
        {contact?.dpoPhone ? ` · ${contact.dpoPhone}` : ''}.
      </p>
      <p>
        If your grievance is not resolved, you may complain to the Data Protection Board of India under the Digital
        Personal Data Protection Act, 2023.
      </p>
    </div>
  );

  if (mode === 'pending') {
    return (
      <Modal
        open
        zIndex="z-[100]"
        size="md"
        title="Waiting for guardian verification"
        description="Because you are under 18, a parent or guardian must verify your consent (DPDP Act, s. 9)."
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={handleLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
            </button>
            <button type="button" className={btnSecondary} onClick={() => setMode('form')}>
              Change guardian details / resend
            </button>
            <button type="button" className={btnPrimary} onClick={handleCheckAgain} disabled={checking}>
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              {checking ? 'Checking…' : 'Check again'}
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-3 py-2" role="status" aria-live="polite">
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            <Clock className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            We sent a verification link to{' '}
            <strong className="text-gray-900 dark:text-white">{guardian.email || 'your guardian'}</strong>. Once they
            approve, you can continue using the platform.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ask them to check their inbox (and spam folder). This window will update when you return to it.
          </p>
        </div>
        {contactBlock}
      </Modal>
    );
  }

  return (
    <Modal
      open
      zIndex="z-[100]"
      size="lg"
      title={notice.title || 'Privacy notice'}
      description={`Version ${notice.version}${notice.effectiveFrom ? ` · effective ${formatDate(notice.effectiveFrom)}` : ''}. Please review how we use your personal data and choose your preferences.`}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={handleLogout} disabled={submitting}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
          </button>
          <button type="submit" form="dpdp-consent-form" className={btnPrimary} disabled={submitting || !acknowledged}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Saving…' : requiresGuardian ? 'Send to guardian for verification' : 'Save and continue'}
          </button>
        </>
      }
    >
      <form id="dpdp-consent-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Notice text */}
        <div>
          <div
            className={`relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-4 py-2 overflow-y-auto ${
              expanded ? 'max-h-[60vh]' : 'max-h-56'
            }`}
            tabIndex={0}
            aria-label="Privacy notice text"
          >
            <SafeMarkdown content={notice.content} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-wine dark:text-hi hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              {expanded ? 'Show less' : 'Read the full notice'}
            </button>
            {privacyHref && (
              <Link href={privacyHref} target="_blank" rel="noopener noreferrer" className="text-wine dark:text-hi hover:underline">
                Open full privacy notice in a new tab
              </Link>
            )}
            {contact?.dpoEmail && (
              <a href={`mailto:${contact.dpoEmail}`} className="inline-flex items-center gap-1 text-wine dark:text-hi hover:underline">
                <Mail className="h-4 w-4" aria-hidden="true" /> Contact the DPO
              </a>
            )}
          </div>
        </div>

        {/* Purposes */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-2">How we use your data</legend>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
            {(notice.purposes || []).map((p) => {
              const id = `dpdp-purpose-${p.key}`;
              return (
                <li key={p.key} className="flex items-start justify-between gap-4 p-3 sm:p-4">
                  <div className="min-w-0">
                    <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {p.label}
                      {p.required && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                          <Lock className="h-3 w-3" aria-hidden="true" /> Required
                        </span>
                      )}
                    </label>
                    {p.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{p.description}</p>}
                    {restrictedForMinor.has(p.key) && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Not available for users under 18 (DPDP Act, s. 9) — this stays off.
                      </p>
                    )}
                    {p.required && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Needed to provide the service. You can withdraw it later from “Privacy &amp; my data”, but features
                        that depend on it will stop working.
                      </p>
                    )}
                  </div>
                  <Toggle
                    id={id}
                    label={`${p.label}${p.required ? ' (required)' : ''}`}
                    checked={p.required ? true : !restrictedForMinor.has(p.key) && !!decisions[p.key]}
                    disabled={p.required || restrictedForMinor.has(p.key) || submitting}
                    onChange={(v) => setDecisions((d) => ({ ...d, [p.key]: v }))}
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>

        {/* Guardian (minors) */}
        {requiresGuardian && (
          <fieldset className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-900/10 p-4">
            <legend className="px-1 text-sm font-semibold text-amber-800 dark:text-amber-300">Parent / guardian consent</legend>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mb-3">
              You are under 18. Under the DPDP Act, 2023 your parent or lawful guardian must verify this consent. We will email
              them a verification link.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="dpdp-g-name" className={labelClass}>
                  Guardian name
                </label>
                <input
                  id="dpdp-g-name"
                  className={inputClass}
                  value={guardian.name}
                  onChange={(e) => setGuardian((g) => ({ ...g, name: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="dpdp-g-email" className={labelClass}>
                  Guardian email
                </label>
                <input
                  id="dpdp-g-email"
                  type="email"
                  className={inputClass}
                  value={guardian.email}
                  onChange={(e) => setGuardian((g) => ({ ...g, email: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="dpdp-g-rel" className={labelClass}>
                  Relation
                </label>
                <select
                  id="dpdp-g-rel"
                  className={inputClass}
                  value={guardian.relation}
                  onChange={(e) => setGuardian((g) => ({ ...g, relation: e.target.value }))}
                >
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        )}

        <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>
            I have read and understood this privacy notice. I give my consent for the purposes selected above, and I know I can
            withdraw it at any time.
          </span>
        </label>

        {formError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}

        <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Your choices are recorded with a timestamp as required by the Digital Personal Data Protection Act, 2023.
        </p>
      </form>
      {contactBlock}
    </Modal>
  );
}
