'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Loader2, QrCode, Download, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import QRCodeGenerator from 'qrcode';
import { eventService } from '@/features/event-management/services/event.service';
import type { EventRegistration } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
  waitlisted: { label: 'Waitlisted', color: 'bg-gray-100 text-gray-800', icon: Clock },
};

export default function MyRegistrationsPage() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const result = await eventService.getMyRegistrations(page, 20, statusFilter || undefined);
      setRegistrations(result.registrations);
      setPagination(result.pagination);
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to load registrations' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [page, statusFilter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Generate QR code when modal opens
  useEffect(() => {
    if (selectedQR) {
      QRCodeGenerator.toDataURL(selectedQR, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then(setQrDataUrl)
        .catch(err => {
          console.error('QR generation error:', err);
          toast({ type: 'error', message: 'Failed to generate QR code' });
        });
    }
  }, [selectedQR]);

  const downloadQRCode = async (qrCode: string, registration: EventRegistration) => {
    try {
      // Generate QR code as data URL
      const dataUrl = await QRCodeGenerator.toDataURL(qrCode, {
        width: 600,
        margin: 2,
      });
      
      // Download the image
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${registration.event?.name?.replace(/\s+/g, '_')}_${registration.registrationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ type: 'success', message: 'QR code downloaded' });
    } catch (error) {
      console.error('Download error:', error);
      toast({ type: 'error', message: 'Failed to download QR code' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Registrations</h1>
          <p className="text-gray-600 dark:text-gray-400">Events you're registered to attend - view tickets and QR codes</p>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
        </div>

        {/* Registrations List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No registrations found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't registered for any events yet.
            </p>
            <Link
              href="/events"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {registrations.map((registration) => {
                const StatusIcon = STATUS_CONFIG[registration.status]?.icon;
                
                return (
                  <div
                    key={registration.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt hover:shadow-sgt-lg hover:-translate-y-0.5 transition-all duration-200 p-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {(registration as any).Event?.name || registration.event?.name || 'Event'}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[registration.status]?.color}`}>
                            <StatusIcon className="inline h-3 w-3 mr-1" />
                            {STATUS_CONFIG[registration.status]?.label}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">
                              {((registration as any).Event?.startDate || registration.event?.startDate) && formatDate((registration as any).Event?.startDate || registration.event?.startDate)}
                            </span>
                          </div>
                          
                          {((registration as any).Event?.venue || registration.event?.venue) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              <span>{(registration as any).Event?.venue || registration.event?.venue}</span>
                            </div>
                          )}
                          
                          {((registration as any).Event?.eventType || registration.event?.eventType) && (
                            <div className="inline-block">
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                {((registration as any).Event?.eventType || registration.event?.eventType).charAt(0).toUpperCase() + ((registration as any).Event?.eventType || registration.event?.eventType).slice(1)}
                              </span>
                            </div>
                          )}
                          
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              <span className="font-semibold">Registration ID:</span> {registration.registrationId}
                            </p>
                          </div>
                          
                          {registration.hasEntered && registration.enteredAt && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ Checked in at {formatDate(registration.enteredAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        {registration.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => setSelectedQR(registration.qrCode)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                            >
                              <QrCode className="h-4 w-4" />
                              Show QR
                            </button>
                            
                            <button
                              onClick={() => downloadQRCode(registration.qrCode, registration)}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </button>
                          </>
                        )}
                        
                        <Link
                          href={`/events/${(registration as any).Event?.id || registration.event?.id}`}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center"
                        >
                          View Event
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* QR Code Modal */}
        {selectedQR && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your QR Code</h3>
                <button
                  onClick={() => setSelectedQR(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-700 p-8 rounded-lg text-center mb-4">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="QR Code" 
                    className="mx-auto rounded-lg shadow-lg"
                    style={{ maxWidth: '300px', width: '100%' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
                  </div>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-4 font-mono break-all">
                  {selectedQR}
                </p>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                Show this QR code at the event entrance
              </p>
              
              <button
                onClick={() => setSelectedQR(null)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
