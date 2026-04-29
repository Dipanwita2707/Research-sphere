'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BugReport, PaginationMetadata } from '@/features/bug-reports/types/bugReport.types';
import { cn } from '@/lib/utils';

interface BugReportTableProps {
  reports: BugReport[];
  onReportClick: (id: string) => void;
  onStatusChange: (id: string, status: 'resolved' | 'unresolved') => void;
  sortBy: 'createdAt' | 'resolutionStatus' | 'userRole';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'createdAt' | 'resolutionStatus' | 'userRole', order: 'asc' | 'desc') => void;
  pagination: PaginationMetadata;
  onPageChange: (page: number) => void;
}

export function BugReportTable({
  reports,
  onReportClick,
  onStatusChange,
  sortBy,
  sortOrder,
  onSort,
  pagination,
  onPageChange,
}: BugReportTableProps) {
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      // Toggle order
      onSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      onSort(field, 'desc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-blue-600" />
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto" role="region" aria-label="Bug reports table">
        <table className="w-full" role="table" aria-label="Bug reports">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr role="row">
              <th className="px-4 py-3 text-left" role="columnheader">
                <button
                  onClick={() => handleSort('resolutionStatus')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900"
                  aria-label={`Sort by status ${sortBy === 'resolutionStatus' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : ''}`}
                >
                  Status
                  <SortIcon field="resolutionStatus" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700" role="columnheader">User</th>
              <th className="px-4 py-3 text-left" role="columnheader">
                <button
                  onClick={() => handleSort('userRole')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900"
                  aria-label={`Sort by role ${sortBy === 'userRole' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : ''}`}
                >
                  Role
                  <SortIcon field="userRole" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700" role="columnheader">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700" role="columnheader">Page</th>
              <th className="px-4 py-3 text-left" role="columnheader">
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900"
                  aria-label={`Sort by submission date ${sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : ''}`}
                >
                  Submitted
                  <SortIcon field="createdAt" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700" role="columnheader">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reports.map((report) => (
              <tr
                key={report.id}
                onClick={() => onReportClick(report.id)}
                className={cn(
                  'hover:bg-gray-50 cursor-pointer transition-colors',
                  report.resolutionStatus === 'resolved' && 'bg-green-50/30'
                )}
                role="row"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onReportClick(report.id);
                  }
                }}
                aria-label={`Bug report from ${report.userIdentifier}, status: ${report.resolutionStatus}`}
              >
                <td className="px-4 py-3" role="cell">
                  <div className="flex items-center gap-2">
                    {report.resolutionStatus === 'resolved' ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-green-700">Resolved</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-orange-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-orange-700">Unresolved</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3" role="cell">
                  <div className="text-sm font-medium text-gray-900">{report.userIdentifier}</div>
                  {report.userEmail && <div className="text-xs text-gray-500">{report.userEmail}</div>}
                </td>
                <td className="px-4 py-3" role="cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {report.userRole}
                  </span>
                </td>
                <td className="px-4 py-3" role="cell">
                  <p className="text-sm text-gray-900 max-w-md">{truncateText(report.description, 100)}</p>
                  {report.screenshots.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{report.screenshots.length} screenshot(s)</p>
                  )}
                </td>
                <td className="px-4 py-3" role="cell">
                  <p className="text-xs text-gray-600 max-w-xs truncate" title={report.pageUrl}>
                    {report.routePath || report.pageUrl}
                  </p>
                </td>
                <td className="px-4 py-3" role="cell">
                  <p className="text-xs text-gray-600">{formatDate(report.createdAt)}</p>
                </td>
                <td className="px-4 py-3" role="cell">
                  <Button
                    size="xs"
                    variant={report.resolutionStatus === 'resolved' ? 'outline' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(
                        report.id,
                        report.resolutionStatus === 'resolved' ? 'unresolved' : 'resolved'
                      );
                    }}
                    aria-label={`Mark bug report as ${report.resolutionStatus === 'resolved' ? 'unresolved' : 'resolved'}`}
                  >
                    {report.resolutionStatus === 'resolved' ? 'Reopen' : 'Resolve'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between" role="navigation" aria-label="Pagination">
          <div className="text-sm text-gray-600" aria-live="polite" aria-atomic="true">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} reports
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Previous
            </Button>
            <div className="flex items-center gap-1" role="group" aria-label="Page numbers">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    size="sm"
                    variant={pagination.page === pageNum ? 'default' : 'outline'}
                    onClick={() => onPageChange(pageNum)}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={pagination.page === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              aria-label="Go to next page"
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
