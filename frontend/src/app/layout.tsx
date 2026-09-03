import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Inter } from 'next/font/google';
import AuthProvider from '@/shared/providers/AuthProvider';
import QueryProvider from '@/shared/providers/QueryProvider';
import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import ErrorBoundary from '@/shared/providers/ErrorBoundary';
import { ToastProvider } from '@/shared/ui-components/Toast';
import { ConfirmModalProvider } from '@/shared/ui-components/ConfirmModal';
import '@/styles/globals.css';

const NavigationProgress = dynamic(
  () => import('@/shared/components/common/NavigationProgress').then(mod => mod.NavigationProgress),
  { ssr: false }
);

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ResearchSphere',
  description: 'Research Management Platform',
};

export const viewport = {
  themeColor: '#841C43',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} text-gray-900 dark:text-gray-100 transition-colors duration-200`}>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmModalProvider>
                <QueryProvider>
                  <AuthProvider>
                    <NavigationProgress />
                    {children}
                  </AuthProvider>
                </QueryProvider>
              </ConfirmModalProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
