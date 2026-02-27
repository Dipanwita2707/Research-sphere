'use client';

import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';
import EventFeedbackScanner from '@/features/event-management/components/EventFeedbackScanner';

export default function EventFeedbackScannerPage() {
  return (
    <AuthenticatedLayout>
      <EventFeedbackScanner />
    </AuthenticatedLayout>
  );
}
