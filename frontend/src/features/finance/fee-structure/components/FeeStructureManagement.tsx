'use client';

import { useState } from 'react';
import { Bus, Building2, GraduationCap, FileText } from 'lucide-react';
import TransportHostelTab from './TransportHostelTab';
import AcademicFeeTab from './AcademicFeeTab';
import LoanLetterTemplateEditor from '@/features/finance/loan-letter/components/LoanLetterTemplateEditor';

type TabKey = 'TRANSPORT' | 'HOSTEL' | 'ACADEMIC' | 'LOAN_LETTER_TEMPLATE';

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'TRANSPORT', label: 'Transport', icon: <Bus className="w-4 h-4" /> },
  { key: 'HOSTEL', label: 'Hostel', icon: <Building2 className="w-4 h-4" /> },
  { key: 'ACADEMIC', label: 'Academic', icon: <GraduationCap className="w-4 h-4" /> },
  { key: 'LOAN_LETTER_TEMPLATE', label: 'Loan Letter', icon: <FileText className="w-4 h-4" /> },
];

export default function FeeStructureManagement() {
  const [activeTab, setActiveTab] = useState<TabKey>('TRANSPORT');

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-6 rounded-2xl border border-sky-100 bg-gradient-to-r from-white via-sky-50 to-blue-50 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 dark:shadow-[0_18px_48px_-28px_rgba(15,23,42,0.85)]">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Structure Configuration</h1>
        <p className="mt-1 text-gray-600 dark:text-slate-300">Configure transport, hostel, academic fee structures, and the loan letter template</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <div className="flex min-w-max">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600 dark:text-sky-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'TRANSPORT' && <TransportHostelTab type="TRANSPORT" />}
          {activeTab === 'HOSTEL' && <TransportHostelTab type="HOSTEL" />}
          {activeTab === 'ACADEMIC' && <AcademicFeeTab />}
          {activeTab === 'LOAN_LETTER_TEMPLATE' && <LoanLetterTemplateEditor />}
        </div>
      </div>
    </div>
  );
}
