'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import NavigationHeader from '@/shared/layouts/NavigationHeader';
import { BugReportWidget } from '@/features/bug-reports/components/BugReportWidget';

import { usePathname } from 'next/navigation';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const pathname = usePathname();
  const isFullWidthPage = pathname ? (pathname === '/dashboard' || pathname === '/my-work' || pathname.includes('/research/profile') || pathname === '/research/my-contributions') : false;
  const mainBgClass = 'bg-blush dark:bg-gray-950';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-blush dark:bg-gray-950 transition-colors duration-200 flex flex-col overflow-x-hidden">
        <NavigationHeader />
        {isFullWidthPage ? (
          <main className={`pt-20 sm:pt-[5.5rem] flex-1 ${mainBgClass}`}>
            {children}
          </main>
        ) : (
          <main className={`pt-20 sm:pt-[5.5rem] flex-1 ${mainBgClass}`}>
            <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        )}
        {/* Bug Report Widget */}
        <BugReportWidget />
      </div>
    </ProtectedRoute>
  );
}