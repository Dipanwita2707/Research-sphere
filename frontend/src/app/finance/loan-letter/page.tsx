'use client';

import { useState } from 'react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import LoanLetterForm from '@/features/finance/loan-letter/components/LoanLetterForm';
import LoanLetterList from '@/features/finance/loan-letter/components/LoanLetterList';

export default function LoanLetterPage() {
  const [tab, setTab] = useState<'form' | 'history'>('form');

  const tabCls = (t: typeof tab) =>
    `px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-primary-600 text-primary-600 dark:text-sky-300'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'
    }`;

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-6 rounded-2xl border border-sky-100 bg-gradient-to-r from-white via-sky-50 to-blue-50 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 dark:shadow-[0_18px_48px_-28px_rgba(15,23,42,0.85)]">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loan Letters</h1>
          <p className="mt-1 text-gray-600 dark:text-slate-300">Generate and manage loan letters for students</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <div className="flex min-w-max">
                <button onClick={() => setTab('form')} className={tabCls('form')}>
                  Generate New
                </button>
                <button onClick={() => setTab('history')} className={tabCls('history')}>
                  History
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {tab === 'form'     && <LoanLetterForm />}
            {tab === 'history'  && <LoanLetterList />}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
