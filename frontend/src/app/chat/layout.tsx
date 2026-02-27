'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import NavigationHeader from '@/shared/layouts/NavigationHeader';

export default function ChatPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen overflow-hidden">
        <NavigationHeader />
        {/* Offset the fixed 64px header */}
        <div className="flex-1 overflow-hidden pt-16">
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}

