'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import NavigationHeader from '@/shared/layouts/NavigationHeader';
import { BugReportWidget } from '@/features/bug-reports/components/BugReportWidget';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 flex flex-col overflow-x-hidden">
        <NavigationHeader />
        <main className="pt-14 sm:pt-16 flex-1">
          <div className="px-4 sm:px-6 pt-4 sm:pt-8 pb-0 max-w-[1920px] mx-auto">
            {children}
          </div>
        </main>
        {/* Bug Report Widget - Fixed position in bottom-right corner */}
        <BugReportWidget />
      </div>
    </ProtectedRoute>
  );
}