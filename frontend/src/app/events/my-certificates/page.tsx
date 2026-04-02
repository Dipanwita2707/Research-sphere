'use client';

import React, { useState, useEffect } from 'react';
import { Award, Calendar, Download, ExternalLink, Loader2, Search, FileText } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

interface Certificate {
  id: string;
  certificateTitle: string;
  certificateType: string;
  eventName: string;
  eventId: string;
  holderName: string;
  issueDate: string;
  verificationCode: string;
  hasDownload: boolean;
}

export default function MyCertificatesPage() {
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const result = await eventService.getMyCertificates(page, 20);
      setCertificates(result.certificates);
      setPagination(result.pagination);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [page]);

  const handleDownload = async (cert: Certificate) => {
    if (!cert.hasDownload) {
      toast({ type: 'error', message: 'Certificate PDF is not available for download.' });
      return;
    }
    setDownloading(cert.verificationCode);
    try {
      const { downloadUrl } = await eventService.downloadCertificate(cert.verificationCode);
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setDownloading(null);
    }
  };

  const handleVerify = (cert: Certificate) => {
    window.open(`/verify/certificate/${cert.verificationCode}`, '_blank');
  };

  if (loading && certificates.length ===
   0) {
    return <PageSkeleton message="Loading your certificates..." />;
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-ev-700 to-ev-900 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ev-900 dark:text-white">My Certificates</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All certificates you have received from events
            </p>
          </div>
        </div>
      </div>

      {/* Certificates List */}
      {certificates.length ===
   0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-[#b3cde0] dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-ev-900 dark:text-white mb-1">No Certificates Yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Certificates you receive from events will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0] dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Info */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ev-900 dark:text-white truncate">
                      {cert.certificateTitle}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {cert.eventName}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(cert.issueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </span>
                      <span className="px-2 py-0.5 bg-ev-50 dark:bg-ev-900/30 text-ev-700 dark:text-ev-400 rounded-full font-medium capitalize">
                        {cert.certificateType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {cert.hasDownload && (
                    <button
                      onClick={() => handleDownload(cert)}
                      disabled={downloading ===
   cert.verificationCode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-ev-700 hover:bg-ev-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {downloading ===
   cert.verificationCode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => handleVerify(cert)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#b3cde0] dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Verify
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#b3cde0] dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#b3cde0] dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
