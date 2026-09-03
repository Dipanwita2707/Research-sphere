'use client';

import { ActivityList } from '@/shared/dashboard-kit';

export default function RecentNotifications() {
  return (
    <ActivityList
      items={[]}
      emptyLabel="University-wide notifications and announcements will appear here once available."
    />
  );
}
