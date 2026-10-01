'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import { ResearchAssistant } from '@/features/research-intelligence';

export default function ResearchIntelligencePage() {
  return (
    <ProtectedRoute>
      <ResearchAssistant />
    </ProtectedRoute>
  );
}
