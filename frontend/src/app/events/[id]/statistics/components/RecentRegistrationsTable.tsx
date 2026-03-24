import type { EventStatistics } from '@/features/event-management/types/event.types';

interface RecentRegistrationsTableProps {
  rows: NonNullable<EventStatistics['recentRegistrations']>;
}

export default function RecentRegistrationsTable({ rows }: RecentRegistrationsTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        No recent registrations.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#b3cde0]/60 dark:border-gray-700">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#f8fbff] dark:bg-gray-800/60">
          <tr>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Participant</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Registration ID</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Payment</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Registered At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#b3cde0]/40 bg-white dark:divide-gray-700 dark:bg-gray-900/20">
          {rows.map((registration) => (
            <tr key={registration.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-ev-900 dark:text-white">{registration.user?.name || 'Unknown User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{registration.user?.uid || registration.user?.email || 'N/A'}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{registration.registrationId}</td>
              <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">{registration.status}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {registration.paymentStatus || 'N/A'}
                {registration.amountPaid ? ` (₹${Number(registration.amountPaid).toLocaleString('en-IN')})` : ''}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {new Date(registration.registeredAt).toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
