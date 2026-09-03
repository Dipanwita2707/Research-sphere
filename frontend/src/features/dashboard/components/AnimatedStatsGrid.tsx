'use client';

import { LucideIcon } from 'lucide-react';
import { MetricCard } from '@/shared/dashboard-kit';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  progress?: number;
  sparkline?: number[];
}

export default function AnimatedStatsGrid({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, index) => (
        <MetricCard
          key={index}
          label={stat.title}
          value={stat.value}
          icon={stat.icon}
          delta={stat.change}
          deltaType={stat.changeType}
          sparkline={stat.sparkline}
        />
      ))}
    </div>
  );
}
