'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import BrandingEditor from '@/features/branding/components/BrandingEditor';
import { tenantAdminBrandingApi } from '@/features/branding/services/branding.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { BRANDING_QUERY_KEY, useBranding } from '@/shared/providers/BrandingProvider';

/** Administration → Branding & theme: the university admin edits their own university's look. */
export default function AdminBrandingPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { branding } = useBranding();
  const isAdmin = user?.role?.name === 'admin' || user?.userType === 'admin';

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <ShieldAlert className="mx-auto h-8 w-8 text-gray-400" />
        <h1 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Administrators only</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Only your university administrator can change its branding.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Branding &amp; theme</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your university&apos;s name, logo and colours across ResearchSphere. Changes are recorded in the audit log.
        </p>
      </div>
      <BrandingEditor
        mode="edit"
        api={tenantAdminBrandingApi}
        legalName={branding?.legalName || branding?.displayName || ''}
        onSaved={() => queryClient.invalidateQueries({ queryKey: BRANDING_QUERY_KEY })}
      />
    </div>
  );
}
