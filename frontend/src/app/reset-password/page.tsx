'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Wordmark from '@/shared/components/brand/Wordmark';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { BRAND } from '@/shared/config/brand';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertCircle size={32} className="text-red-500" strokeWidth={1.8} />
        </div>
        <h2 className="mb-2 font-serif text-[24px] font-bold text-charcoal">Invalid link</h2>
        <p className="mb-6 text-[14.5px] text-charcoal/55">
          This reset link is missing or invalid. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 rounded-xl bg-wine px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-wine-dark"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const res = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const strengthScore = (() => {
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore];
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-green-500'][strengthScore];

  return success ? (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
        <CheckCircle2 size={32} className="text-green-500" strokeWidth={1.8} />
      </div>
      <h2 className="mb-2 font-serif text-[24px] font-bold text-charcoal">Password updated!</h2>
      <p className="mb-6 text-[14.5px] text-charcoal/55">
        Your password has been reset successfully. Redirecting you to login…
      </p>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-xl bg-wine px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-wine-dark"
      >
        Go to Login
      </Link>
    </div>
  ) : (
    <>
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wine/10">
          <KeyRound size={24} className="text-wine" strokeWidth={1.8} />
        </div>
        <h2 className="font-serif text-[24px] font-bold text-charcoal">Set new password</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal/55">
          Choose a strong password that you haven&apos;t used before.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] text-red-700">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* New password */}
        <div>
          <label htmlFor="rp-new" className="mb-1.5 block text-sm font-semibold text-charcoal">
            New Password
          </label>
          <div className="relative flex items-center">
            <Lock size={18} strokeWidth={1.8} className="pointer-events-none absolute left-4 text-wine" />
            <input
              id="rp-new"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoFocus
              disabled={isLoading}
              className="w-full rounded-xl border border-black/10 bg-white py-3.5 pl-11 pr-11 text-[14.5px] text-charcoal outline-none transition-colors placeholder:text-charcoal/40 focus:border-wine"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              disabled={isLoading}
              aria-label="Toggle password visibility"
              className="absolute right-4 flex items-center text-charcoal/40 hover:text-charcoal/70"
            >
              {showNew ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
            </button>
          </div>

          {/* Strength meter */}
          {newPassword && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= strengthScore ? strengthColor : 'bg-black/10'
                    }`}
                  />
                ))}
              </div>
              <p className={`mt-1 text-[12px] font-medium ${strengthScore >= 3 ? 'text-green-600' : strengthScore === 2 ? 'text-amber-600' : 'text-red-500'}`}>
                {strengthLabel}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="rp-confirm" className="mb-1.5 block text-sm font-semibold text-charcoal">
            Confirm Password
          </label>
          <div className="relative flex items-center">
            <Lock size={18} strokeWidth={1.8} className="pointer-events-none absolute left-4 text-wine" />
            <input
              id="rp-confirm"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              disabled={isLoading}
              className="w-full rounded-xl border border-black/10 bg-white py-3.5 pl-11 pr-11 text-[14.5px] text-charcoal outline-none transition-colors placeholder:text-charcoal/40 focus:border-wine"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              disabled={isLoading}
              aria-label="Toggle confirm password visibility"
              className="absolute right-4 flex items-center text-charcoal/40 hover:text-charcoal/70"
            >
              {showConfirm ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="mt-1 text-[12px] text-red-500">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-wine py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Updating password...
            </>
          ) : (
            'Update Password'
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-blush font-sans p-6">
      <style jsx global>{`
        @keyframes rp-blob-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-18px, 14px) scale(1.04); }
        }
        .rp-blob { animation: rp-blob-float 13s ease-in-out infinite; }
        .rp-blob-2 { animation: rp-blob-float 16s ease-in-out infinite reverse; }
      `}</style>

      <div className="rp-blob pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full bg-peach/40 blur-3xl" />
      <div className="rp-blob-2 pointer-events-none fixed -bottom-32 -right-20 h-80 w-80 rounded-full bg-amber/20 blur-3xl" />

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-brand-xl sm:p-10">
          <div className="mb-7 flex justify-center">
            <Wordmark heightClassName="h-11 sm:h-12" />
          </div>
          <Suspense fallback={<div className="py-10 text-center text-charcoal/40">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-charcoal/40">
          &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
