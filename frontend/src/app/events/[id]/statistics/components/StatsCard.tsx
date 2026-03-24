import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  accentClassName?: string;
}

export default function StatsCard({
  title,
  value,
  helper,
  icon: Icon,
  accentClassName = 'text-ev-700 bg-ev-50',
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-ev-900 dark:text-white">{value}</p>
          {helper ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p> : null}
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${accentClassName}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
