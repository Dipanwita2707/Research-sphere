'use client';

import React, { useState } from 'react';
import {
  Bug,
  User,
  Mail,
  Calendar,
  ExternalLink,
  CheckCircle,
  Clock,
  Download,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHostUrl } from '@/shared/api/api';
import type { BugReportDetail as BugReportDetailType } from '@/features/bug-reports/types/bugReport.types';
import { cn } from '@/lib/utils';

interface BugReportDetailProps {
  report: BugReportDetailType;
  onStatusUpdate: (status: 'resolved' | 'unresolved') => void;
}

export function BugReportDetail({ report, onStatusUpdate }: BugReportDetailProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleStatusUpdate = async () => {
    setIsUpdating(true);
    try {
      const newStatus = report.resolutionStatus === 'resolved' ? 'unresolved' : 'resolved';
      await onStatusUpdate(newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const getScreenshotUrl = (screenshotId: string) => {
    return `${getHostUrl()}/api/v1/bug-reports/screenshots/${screenshotId}`;
  };

  const getThumbnailUrl = (screenshotId: string) => {
    return `${getHostUrl()}/api/v1/bug-reports/screenshots/${screenshotId}/thumbnail`;
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Bug className="w-6 h-6 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bug Report Details</h1>
              <p className="text-sm text-gray-600 mt-1">ID: {report.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {report.resolutionStatus === 'resolved' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full" role="status" aria-label="Status: Resolved">
                <CheckCircle className="w-4 h-4 text-green-600" aria-hidden="true" />
                <span className="text-sm font-medium text-green-700">Resolved</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-full" role="status" aria-label="Status: Unresolved">
                <Clock className="w-4 h-4 text-orange-600" aria-hidden="true" />
                <span className="text-sm font-medium text-orange-700">Unresolved</span>
              </div>
            )}
            <Button
              size="sm"
              variant={report.resolutionStatus === 'resolved' ? 'outline' : 'default'}
              onClick={handleStatusUpdate}
              disabled={isUpdating}
              aria-label={`Mark bug report as ${report.resolutionStatus === 'resolved' ? 'unresolved' : 'resolved'}`}
            >
              {isUpdating ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true" />
                  Updating...
                </>
              ) : report.resolutionStatus === 'resolved' ? (
                'Mark as Unresolved'
              ) : (
                'Mark as Resolved'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Reporter Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reporter Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">User Identifier</p>
              <p className="text-sm text-gray-900">{report.userIdentifier}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-sm text-gray-900">{report.userEmail || 'Not provided'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Role</p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {report.userRole}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Submitted</p>
              <p className="text-sm text-gray-900">{formatDate(report.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bug Description */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bug Description</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{report.description}</p>
      </div>

      {/* Page Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Information</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Route Path</p>
            <p className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border border-gray-200">
              {report.routePath}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Full URL</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border border-gray-200 flex-1 truncate">
                {report.pageUrl}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(report.pageUrl, '_blank')}
                title="Open page in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots */}
      {report.screenshots.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Screenshots ({report.screenshots.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" role="list" aria-label="Bug report screenshots">
            {report.screenshots.map((screenshot) => (
              <LazyScreenshotThumbnail
                key={screenshot.id}
                screenshot={screenshot}
                onView={() => setSelectedScreenshot(getScreenshotUrl(screenshot.id))}
                getThumbnailUrl={getThumbnailUrl}
              />
            ))}
          </div>
        </div>
      )}

      {report.screenshots.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center py-8">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-600">No screenshots provided</p>
          </div>
        </div>
      )}

      {/* Resolution Information */}
      {report.resolutionStatus === 'resolved' && report.resolvedAt && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4">Resolution Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-green-700">Resolved At</p>
              <p className="text-sm text-green-900">{formatDate(report.resolvedAt)}</p>
            </div>
            {report.resolver && (
              <div>
                <p className="text-sm font-medium text-green-700">Resolved By</p>
                <p className="text-sm text-green-900">
                  {report.resolver.name || report.resolver.email || report.resolver.uid}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-size Screenshot Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedScreenshot(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot viewer"
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setSelectedScreenshot(null)}
              aria-label="Close screenshot viewer"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </Button>
            <img
              src={selectedScreenshot}
              alt="Full size screenshot"
              className="w-full h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Lazy loading screenshot thumbnail component
interface LazyScreenshotThumbnailProps {
  screenshot: {
    id: string;
    originalFilename: string;
    fileSize: number;
  };
  onView: () => void;
  getThumbnailUrl: (id: string) => string;
}

function LazyScreenshotThumbnail({ screenshot, onView, getThumbnailUrl }: LazyScreenshotThumbnailProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = React.useRef<HTMLDivElement>(null);

  const getScreenshotUrl = (screenshotId: string) => {
    return `${getHostUrl()}/api/v1/bug-reports/screenshots/${screenshotId}`;
  };

  React.useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before the image is visible
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="group relative" ref={imgRef}>
      <div
        className="aspect-square rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
        onClick={onView}
        role="button"
        tabIndex={0}
        aria-label={`View screenshot: ${screenshot.originalFilename}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onView();
          }
        }}
      >
        {!isVisible ? (
          // Placeholder while not visible
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <ImageIcon className="w-8 h-8 text-gray-400 animate-pulse" aria-hidden="true" />
          </div>
        ) : hasError ? (
          // Error state
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        ) : (
          // Load thumbnail instead of full image
          <img
            src={getThumbnailUrl(screenshot.id)}
            alt={`Screenshot thumbnail: ${screenshot.originalFilename}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        )}
      </div>
      <div className="mt-2">
        <p className="text-xs text-gray-600 truncate" title={screenshot.originalFilename}>
          {screenshot.originalFilename}
        </p>
        <p className="text-xs text-gray-500">{(screenshot.fileSize / 1024).toFixed(1)} KB</p>
      </div>
      <Button
        size="icon-xs"
        variant="outline"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white"
        onClick={(e) => {
          e.stopPropagation();
          window.open(getScreenshotUrl(screenshot.id), '_blank');
        }}
        aria-label={`Download screenshot: ${screenshot.originalFilename}`}
      >
        <Download className="w-3 h-3" aria-hidden="true" />
      </Button>
    </div>
  );
}
