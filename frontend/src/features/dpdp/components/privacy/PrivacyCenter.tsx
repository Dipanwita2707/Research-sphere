'use client';

import React, { useRef, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { dpdpService } from '../../services/dpdp.service';
import { errorMessage } from '../../lib/format';
import { Card, btnPrimary } from '../ui';
import MyConsentsCard from './MyConsentsCard';
import MyRequestsCard from './MyRequestsCard';
import NomineeCard from './NomineeCard';
import ContactCard from './ContactCard';

/** "Privacy & my data" — the data principal's self-service page. */
export default function PrivacyCenter() {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const nomineeRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const name = await dpdpService.downloadMyData();
      toast.success(`Your data export (${name}) has been downloaded.`);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not prepare your data export.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-wine/10 dark:bg-wine/20 text-wine dark:text-hi">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Privacy &amp; my data</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Your rights under the Digital Personal Data Protection Act, 2023 — manage consent, request access, correction or
            erasure, and nominate someone to act for you.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <MyConsentsCard />
          <MyRequestsCard onRequestNominee={() => nomineeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        </div>
        <div className="space-y-6">
          <Card
            icon={<Download className="h-5 w-5" />}
            title="Download my data"
            description="A machine-readable (JSON) copy of the personal data we hold about you."
          >
            <button type="button" className={`${btnPrimary} w-full`} onClick={handleDownload} disabled={downloading} aria-busy={downloading}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading ? 'Preparing export…' : 'Download my data'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Keep this file safe — it contains your personal information.
            </p>
          </Card>
          <NomineeCard ref={nomineeRef} />
          <ContactCard />
        </div>
      </div>
    </div>
  );
}
