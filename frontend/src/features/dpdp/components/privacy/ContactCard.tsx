'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Landmark, Mail, Phone, UserCircle2 } from 'lucide-react';
import { dpdpService } from '../../services/dpdp.service';
import type { DpoContact } from '../../types';
import { Card, LoadingState } from '../ui';

export default function ContactCard() {
  const [contact, setContact] = useState<DpoContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    dpdpService
      .getContact()
      .then((c) => alive && setContact(c))
      .catch(() => alive && setContact({}))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const hasDpo = !!(contact?.dpoName || contact?.dpoEmail || contact?.dpoPhone);

  return (
    <Card icon={<Landmark className="h-5 w-5" />} title="Grievances & contact" description="Who to contact about your personal data.">
      {loading ? (
        <LoadingState label="Loading contact details…" />
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              Data Protection Officer{contact?.universityName ? ` · ${contact.universityName}` : ''}
            </p>
            {hasDpo ? (
              <ul className="mt-2 space-y-1.5 text-gray-700 dark:text-gray-300">
                {contact?.dpoName && (
                  <li className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-gray-400" aria-hidden="true" /> {contact.dpoName}
                  </li>
                )}
                {contact?.dpoEmail && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    <a href={`mailto:${contact.dpoEmail}`} className="text-wine dark:text-amber-400 hover:underline break-all">
                      {contact.dpoEmail}
                    </a>
                  </li>
                )}
                {contact?.dpoPhone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    <a href={`tel:${contact.dpoPhone}`} className="hover:underline">
                      {contact.dpoPhone}
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Your university has not published DPO contact details yet. You can still raise a grievance using “New request”.
              </p>
            )}
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-gray-700 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-white">Your right to complain</p>
            <p className="mt-1 text-xs leading-relaxed">
              Please first raise a grievance with us — we must respond within the prescribed period. If you are not satisfied
              with the outcome, you have the right to file a complaint with the{' '}
              <strong>Data Protection Board of India</strong> under section 13 of the Digital Personal Data Protection Act, 2023.
            </p>
          </div>
          {contact?.universitySlug && (
            <Link href={`/privacy/${contact.universitySlug}`} className="inline-block text-wine dark:text-amber-400 hover:underline">
              Read the public privacy notice
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
