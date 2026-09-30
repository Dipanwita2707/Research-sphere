'use client';

import { useState } from 'react';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import type { AccessBlockedCode } from '@/shared/auth/sessionEvents';

const TITLES: Record<AccessBlockedCode, string> = {
  TENANT_SUSPENDED: 'University account suspended',
  TENANT_NOT_FOUND: 'University account not found',
  SUBSCRIPTION_REQUIRED: 'No active subscription',
  SUBSCRIPTION_EXPIRED: 'Subscription expired',
  NO_TENANT: 'Account not linked to a university',
  LICENSE_INVALID: 'Service unavailable',
};

const DEFAULT_MESSAGES: Record<AccessBlockedCode, string> = {
  TENANT_SUSPENDED: 'Your university account is suspended. Please contact your administrator.',
  TENANT_NOT_FOUND: 'Your university account no longer exists. Please contact your administrator.',
  SUBSCRIPTION_REQUIRED: 'Your university has no active subscription. Please contact your administrator.',
  SUBSCRIPTION_EXPIRED: 'Your university subscription has expired. Please contact your administrator.',
  NO_TENANT: 'Your account is not linked to any university. Please contact your administrator.',
  LICENSE_INVALID: 'This installation is not licensed. Please contact the platform administrator.',
};

interface AccessBlockedScreenProps {
  code: AccessBlockedCode;
  message?: string;
  onSignOut: () => Promise<void> | void;
}

/** Full-page notice shown instead of the app when the tenant or installation is blocked. */
export default function AccessBlockedScreen({ code, message, onSignOut }: AccessBlockedScreenProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div role="alertdialog" aria-labelledby="access-blocked-title" className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 text-center shadow-lg dark:border-white/10 dark:bg-gray-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <h1 id="access-blocked-title" className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
          {TITLES[code]}
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {message || DEFAULT_MESSAGES[code]}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
