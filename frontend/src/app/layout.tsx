import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AuthProvider from '@/shared/providers/AuthProvider';
import QueryProvider from '@/shared/providers/QueryProvider';
import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import ErrorBoundary from '@/shared/providers/ErrorBoundary';
import { ToastProvider } from '@/shared/ui-components/Toast';
import { ConfirmModalProvider } from '@/shared/ui-components/ConfirmModal';
import ConsentGate from '@/features/dpdp/components/ConsentGate';
import NavigationProgress from '@/shared/components/common/NavigationProgressLoader';
import BrandingProvider from '@/shared/providers/BrandingProvider';
import { BRANDING_BOOT_SCRIPT } from '@/shared/theme/brandingCache';
import '@/styles/globals.css';

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
      <head>
        {/* Paints the cached university theme + dark mode before first render (no flash) */}
        <script id="rs-branding-boot" dangerouslySetInnerHTML={{ __html: BRANDING_BOOT_SCRIPT }} />
      </head>
      <body className={`${inter.className} text-gray-900 dark:text-gray-100 transition-colors duration-200`}>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmModalProvider>
                <QueryProvider>
                  <AuthProvider>
                    <BrandingProvider>
                      <NavigationProgress />
                      {children}
                      <ConsentGate />
                    </BrandingProvider>
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
