import type { EventStatisticsSponsor } from '@/features/event-management/types/event.types';

interface SponsorTableProps {
  sponsors: EventStatisticsSponsor[];
}

export default function SponsorTable({ sponsors }: SponsorTableProps) {
  if (!sponsors.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        No sponsor records available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#b3cde0]/60 dark:border-gray-700">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#f8fbff] dark:bg-gray-800/60">
          <tr>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Sponsor</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Contribution</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Source</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#b3cde0]/40 bg-white dark:divide-gray-700 dark:bg-gray-900/20">
          {sponsors.map((sponsor, index) => (
            <tr key={`${sponsor.id || sponsor.name}-${index}`}>
              <td className="px-4 py-3">
                <p className="font-medium text-ev-900 dark:text-white">{sponsor.name}</p>
                {sponsor.contributionType ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{sponsor.contributionType.replace(/_/g, ' ')}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 font-semibold text-ev-800 dark:text-ev-300">
                ₹{Number(sponsor.contributionAmount || 0).toLocaleString('en-IN')}
              </td>
              <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">
                {sponsor.source === 'noting' ? 'Noting' : 'Manual'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    sponsor.statusBucket === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}
                >
                  {sponsor.statusBucket === 'confirmed' ? 'Confirmed' : 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
