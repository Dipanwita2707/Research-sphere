'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import NavigationHeader from '@/shared/layouts/NavigationHeader';

export default function ChatPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="h-[100dvh] overflow-hidden">
        <NavigationHeader />
        {/* Render chat content in the exact space below the fixed 64px header */}
        <div className="mt-16 h-[calc(100dvh-4rem)] overflow-hidden">
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}

