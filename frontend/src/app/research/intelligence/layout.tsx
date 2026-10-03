'use client';

import { RipSubNav } from '@/features/research-intelligence/components/shared/RipSubNav';

export default function ResearchIntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RipSubNav />
      {children}
    </>
  );
}
