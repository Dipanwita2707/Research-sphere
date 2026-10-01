import React from 'react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import IprApplicationDetails from '@/features/ipr-management/components/IprApplicationDetails';

export default async function ApplicationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProtectedRoute>
      <IprApplicationDetails applicationId={id} />
    </ProtectedRoute>
  );
}