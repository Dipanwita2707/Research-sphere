'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import NavigationHeader from '@/shared/layouts/NavigationHeader';

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen overflow-hidden">
        <NavigationHeader />
        {/* Offset fixed header (h-14 = 56px) */}
        <div className="flex-1 overflow-hidden pt-14">
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}
