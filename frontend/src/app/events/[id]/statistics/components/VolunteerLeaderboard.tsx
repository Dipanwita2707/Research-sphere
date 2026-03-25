import type { EventStatisticsTopVolunteer } from '@/features/event-management/types/event.types';

interface VolunteerLeaderboardProps {
  rows: EventStatisticsTopVolunteer[];
}

export default function VolunteerLeaderboard({ rows }: VolunteerLeaderboardProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        No volunteer scan activity yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#b3cde0]/60 dark:border-gray-700">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#f8fbff] dark:bg-gray-800/60">
          <tr>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Volunteer</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Role</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Gate</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Scans</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Entries</th>
            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Exits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#b3cde0]/40 bg-white dark:divide-gray-700 dark:bg-gray-900/20">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-ev-900 dark:text-white">{row.user?.name || 'Unknown Volunteer'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{row.user?.uid || row.user?.email || 'N/A'}</p>
              </td>
              <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">{row.role || 'N/A'}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.assignedGate || 'Not assigned'}</td>
              <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{row.scans}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.entries}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.exits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
