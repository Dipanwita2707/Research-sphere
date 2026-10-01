'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import IprApplicationDetails from '@/features/ipr-management/components/IprApplicationDetails';

export default function ApplicationDetailsPage() {
  const { id } = useParams() as { id: string };
  return (
    <ProtectedRoute>
      <IprApplicationDetails applicationId={id} />
    </ProtectedRoute>
  );
}
