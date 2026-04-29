'use client';
import { 
  Receipt,
  FileText,
  TrendingUp,
  Calculator,
} from 'lucide-react';
import Link from 'next/link';

export default function FinanceDashboardPage() {
  const cards = [
    {
      title: 'Fee Structure',
      description: 'Configure transport, hostel, and academic fee structures',
      href: '/finance/fees',
      icon: Receipt,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      linkColor: 'text-purple-600 hover:text-purple-800',
    },
    {
      title: 'Loan Letters',
      description: 'Generate and manage student loan letters',
      href: '/finance/loan-letter',
      icon: FileText,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      linkColor: 'text-orange-600 hover:text-orange-800',
    },
    {
      title: 'Finance Analytics',
      description: 'View fee structure and loan letter statistics',
      href: '/finance/analytics',
      icon: TrendingUp,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      linkColor: 'text-green-600 hover:text-green-800',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="mb-8 rounded-3xl border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(135deg,#ffffff,#eff6ff)] p-6 shadow-sm dark:border-slate-800/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.9))] dark:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.95)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300/80">Finance Workspace</p>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Finance Department</h1>
        <p className="max-w-2xl text-gray-600 dark:text-slate-300">Manage fee structures, loan letters, and financial analytics from one responsive control surface.</p>
      </div>

      {/* Main Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <div key={card.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{card.title}</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">{card.description}</p>
            <Link href={card.href} className={`${card.linkColor} text-sm font-medium`}>
              Open →
            </Link>
          </div>
        ))}
      </div>

      {/* IPR Finance Processing */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-sky-900/50 dark:from-slate-900 dark:to-slate-800">
        <h2 className="mb-4 text-xl font-semibold text-blue-900 dark:text-sky-200">IPR Finance Processing</h2>
        <p className="mb-4 text-blue-700 dark:text-slate-300">
          Process and approve financial aspects of IPR applications including incentives and reimbursements.
        </p>
        <Link
          href="/finance/ipr-processing"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <Calculator className="mr-2 h-4 w-4" />
          Process IPR Finance
        </Link>
      </div>
    </div>
  );
}
