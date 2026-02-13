'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Loader2, Calendar, MapPin, CheckCircle, Ticket as TicketIcon } from 'lucide-react';
import QRCodeGenerator from 'qrcode';
import { useToast } from '@/shared/ui-components/Toast';
import type { EventRegistration } from '@/features/event-management/types/event.types';

interface TicketModalProps {
  registration: EventRegistration | null;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  waitlisted: { label: 'Waitlisted', color: 'bg-gray-100 text-gray-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  incomplete_team: { label: 'Incomplete Team', color: 'bg-orange-100 text-orange-800' },
};

export default function TicketModal({ registration, onClose }: TicketModalProps) {
  const { toast } = useToast();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (registration?.qrCode) {
      QRCodeGenerator.toDataURL(registration.qrCode, {
        width: 400,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then(setQrUrl)
        .catch(err => {
          console.error('QR generation error:', err);
          toast({ type: 'error', message: 'Failed to generate QR code' });
        });
    }
  }, [registration, toast]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'short'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const downloadTicket = async () => {
    if (!ticketRef.current || !registration) return;

    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        backgroundColor: null, // Transparent to capture the rounded corners properly
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `SGT_Ticket_${registration.registrationId}.png`;
      link.click();

      toast({ type: 'success', message: 'Ticket downloaded successfully!' });
    } catch (error) {
      console.error('Download error:', error);
      toast({ type: 'error', message: 'Failed to download ticket' });
    } finally {
      setDownloading(false);
    }
  };

  if (!registration) return null;

  const eventName = (registration as any).Event?.name || registration.event?.name || 'Event Name';
  const eventDate = (registration as any).Event?.startDate || registration.event?.startDate;
  const eventVenue = (registration as any).Event?.venue || registration.event?.venue;
  const eventType = (registration as any).Event?.eventType || registration.event?.eventType;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl flex flex-col items-center">
        {/* Header Actions */}
        <div className="w-full flex justify-end mb-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* THE TICKET */}
        <div
          ref={ticketRef}
          className="w-full bg-[#f0f0f0] dark:bg-[#1a1a1a] rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl relative"
        >
          {/* Decorative Cutouts (Simulated with absolute positioning matching the backdrop if possible, but here using neutral colors) */}
          <div className="absolute top-0 bottom-0 left-[70%] w-[1px] border-l-2 border-dashed border-gray-300 dark:border-gray-700 hidden md:block" />
          <div className="absolute -top-3 left-[70%] transform -translate-x-1/2 w-6 h-6 bg-black/80 rounded-full hidden md:block" />
          <div className="absolute -bottom-3 left-[70%] transform -translate-x-1/2 w-6 h-6 bg-black/80 rounded-full hidden md:block" />

          {/* LEFT SECTION (Main Info) */}
          <div className="flex-1 p-8 md:p-10 bg-white dark:bg-black relative">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-bold">
                  <TicketIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-widest text-gray-500 uppercase">Official Entry Pass</h2>
                  <h1 className="text-xl font-black text-black dark:text-white tracking-tight">SGT UNIVERSITY</h1>
                </div>
              </div>
              <div className={`px-4 py-1.5 border-2 rounded-lg text-xs font-bold uppercase tracking-wider ${registration.status === 'confirmed' ? 'border-black text-black dark:border-white dark:text-white' : 'border-gray-400 text-gray-400'
                }`}>
                {registration.status}
              </div>
            </div>

            <div className="mb-8">
              <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-[10px] font-bold tracking-widest uppercase rounded-sm mb-4">
                {eventType || 'General Event'}
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-black dark:text-white leading-[0.9] uppercase break-words mb-2">
                {eventName}
              </h1>
              <div className="h-1 w-24 bg-black dark:bg-white mt-6"></div>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-auto">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-black dark:text-white" />
                  <p className="text-lg font-bold text-black dark:text-white">
                    {eventDate ? formatDate(eventDate) : 'TBA'}
                  </p>
                </div>
                <p className="text-sm text-gray-500 font-medium pl-6">
                  {eventDate ? formatTime(eventDate) : ''}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Venue</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-black dark:text-white" />
                  <p className="text-lg font-bold text-black dark:text-white truncate">
                    {eventVenue || 'To Be Announced'}
                  </p>
                </div>
                <p className="text-sm text-gray-500 font-medium pl-6">
                  Campus Grounds
                </p>
              </div>
            </div>

            {/* Bottom Barcode Simulation */}
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-900 flex justify-between items-end">
              <div className="flex flex-col">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Registration ID</p>
                <p className="font-mono text-base font-medium text-black dark:text-white tracking-tight">
                  {registration.registrationId}
                </p>
              </div>
              <div className="hidden sm:flex gap-1 h-8 opacity-40">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className={`w-${Math.random() > 0.5 ? '1' : '0.5'} bg-black dark:bg-white h-full`} style={{ width: Math.random() * 4 + 1 }} />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SECTION (Stub) */}
          <div className="w-full md:w-[30%] bg-gray-100 dark:bg-[#111] p-8 flex flex-col items-center justify-center relative border-t md:border-t-0 border-dashed border-gray-300 dark:border-gray-800">
            <div className="text-center mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Scan for Entry</p>
              <div className="p-3 bg-white rounded-xl shadow-sm inline-block">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR" className="w-32 h-32 object-contain mix-blend-multiply dark:mix-blend-normal" />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center bg-gray-50">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                  </div>
                )}
              </div>
            </div>

            <div className="w-full space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-500 uppercase">Gate</span>
                <span className="text-sm font-bold text-black dark:text-white">01</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-500 uppercase">Section</span>
                <span className="text-sm font-bold text-black dark:text-white">GEN</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-500 uppercase">Admit</span>
                <span className="text-sm font-bold text-black dark:text-white">01 Only</span>
              </div>
            </div>

            <div className="mt-8">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center mx-auto opacity-50">
                <span className="text-[10px] font-bold text-gray-400 -rotate-12">VALID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8 w-full max-w-md">
          <button
            onClick={downloadTicket}
            disabled={downloading}
            className="flex-1 py-4 bg-white text-black hover:bg-gray-100 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Pass
          </button>
        </div>
      </div>
    </div>
  );
}
