'use client';

import AdminRouteGuard from '@/features/event-management/components/AdminRouteGuard';

export default function EventStatisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
}
