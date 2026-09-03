'use client';

import { useState } from 'react';
import Link from 'next/link';
import Wordmark from '@/shared/components/brand/Wordmark';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { BRAND } from '@/shared/config/brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const res = await fetch(`${apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-blush font-sans p-6">
      <style jsx global>{`
        @keyframes fp-blob-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -15px) scale(1.05); }
        }
        .fp-blob { animation: fp-blob-float 12s ease-in-out infinite; }
        .fp-blob-2 { animation: fp-blob-float 15s ease-in-out infinite reverse; }
      `}</style>

      {/* Background blobs */}
      <div className="fp-blob pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full bg-peach/40 blur-3xl" />
      <div className="fp-blob-2 pointer-events-none fixed -bottom-40 -left-20 h-80 w-80 rounded-full bg-amber/20 blur-3xl" />

      <div className="relative w-full max-w-[420px]">
        {/* Back to login */}
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-[13.5px] font-medium text-charcoal/50 transition-colors hover:text-wine"
        >
          <ArrowLeft size={15} />
          Back to login
        </Link>

        <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-brand-xl sm:p-10">
          {/* Logo */}
          <div className="mb-7 flex justify-center">
            <Wordmark heightClassName="h-11 sm:h-12" />
          </div>

          {success ? (
            /* Success state */
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 size={32} className="text-green-500" strokeWidth={1.8} />
              </div>
              <h2 className="mb-2 font-serif text-[24px] font-bold text-charcoal">Check your inbox</h2>
              <p className="mb-6 text-[14.5px] leading-relaxed text-charcoal/55">
                If <strong>{email}</strong> is registered, you&apos;ll receive a password reset link within a few minutes. Check your spam folder if you don&apos;t see it.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-wine px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-wine-dark"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wine/10">
                  <Mail size={24} className="text-wine" strokeWidth={1.8} />
                </div>
                <h2 className="font-serif text-[24px] font-bold text-charcoal">Forgot password?</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal/55">
                  Enter the email linked to your account and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] text-red-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-email" className="mb-1.5 block text-sm font-semibold text-charcoal">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={18} strokeWidth={1.8} className="pointer-events-none absolute left-4 text-wine" />
                    <input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoFocus
                      disabled={isLoading}
                      autoComplete="email"
                      className="w-full rounded-xl border border-black/10 bg-white py-3.5 pl-11 pr-4 text-[14.5px] text-charcoal outline-none transition-colors placeholder:text-charcoal/40 focus:border-wine"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-wine py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[12.5px] text-charcoal/40">
          &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
