'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import { useAuthStore } from '@/shared/auth/authStore';

function MyResearchProfileRedirect() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      router.replace(`/research/profile/${user.id}`);
    }
  }, [router, user?.id]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#7d1a34]" />
    </div>
  );
}

export default function MyResearchProfilePage() {
  return (
    <ProtectedRoute>
      <MyResearchProfileRedirect />
    </ProtectedRoute>
  );
}
