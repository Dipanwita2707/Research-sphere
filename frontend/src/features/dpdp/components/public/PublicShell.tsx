import React from 'react';
import Link from 'next/link';
import Wordmark from '@/shared/components/brand/Wordmark';

/** Minimal chrome for unauthenticated DPDP pages (privacy notice, guardian consent). */
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory dark:bg-gray-950 flex flex-col">
      <header className="border-b border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <Wordmark sizeClassName="text-lg" />
          </Link>
          <Link href="/login" className="text-sm font-medium text-wine dark:text-amber-400 hover:underline">
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-gray-200/70 dark:border-gray-800 py-6 text-center text-xs text-gray-500 dark:text-gray-400 px-4">
        Personal data is processed in accordance with the Digital Personal Data Protection Act, 2023 (India).
      </footer>
    </div>
  );
}
