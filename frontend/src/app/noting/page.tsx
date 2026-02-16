'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Plus, Inbox, Send, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Trash2, History, Pencil, Search, X, Filter, RotateCcw } from 'lucide-react';
import { useNotingList, useDeleteDraft } from '@/features/noting-management/hooks/useNoting';
import type { Note } from '@/features/noting-management/types/noting.types';
import { useToast } from '@/shared/ui-components/Toast';
import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { STATUS_CONFIG, MY_ACTION_CONFIG, PAGE_SIZE } from '@/features/noting-management/constants';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

function getDisplayName(note: Note): string {
  const c = note.createdBy;
  if (c?.employeeDetails?.displayName) return c.employeeDetails.displayName;
  if (c?.employeeDetails?.firstName || c?.employeeDetails?.lastName) {
    return [c.employeeDetails.firstName, c.employeeDetails.lastName].filter(Boolean).join(' ');
  }
  if (c?.studentLogin?.displayName) return c.studentLogin.displayName;
  return c?.uid ?? '—';
}

const stripHtml = (html: string) => {
  if (!html) return '';
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

export default function NotingListPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'mine' | 'pending' | 'handled'>('mine');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const listParams = {
    filter,
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { data: listResult, isLoading } = useNotingList(listParams);
  const deleteMutation = useDeleteDraft();

  const notes = listResult?.data ?? [];
  const pagination = listResult?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };
  // Counts come from list response when includeCounts=true (avoids separate /counts call)
  const counts = listResult?.counts ?? { mine: 0, pending: 0, handled: 0 };

  // Block students from accessing noting system
  useEffect(() => {
    if (user && user.role === 'student') {
      toast({ type: 'error', message: 'Students are not allowed to access the noting system' });
      router.push('/dashboard');
    }
  }, [user, router, toast]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, search, status, category, startDate, endDate]);

  const handleDeleteDraft = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();

    const approverActions = note.history?.filter((h) => h.performedById !== note.createdById) || [];
    if (approverActions.length > 0) {
      toast({ type: 'error', message: 'Cannot delete note after an approver has taken action' });
      return;
    }

    if (!window.confirm('Delete this note? This cannot be undone.')) return;

    deleteMutation.mutate(note.id, {
      onSuccess: () => {
        toast({ type: 'success', message: 'Note deleted' });
      },
      onError: (err) => {
        toast({ type: 'error', message: getErrorMessage(err) });
      },
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCategory('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const TABS = [
    { key: 'mine' as const, label: 'My Notes', desc: 'Notes created by you', icon: Send, count: counts.mine },
    { key: 'pending' as const, label: 'Pending for Me', desc: 'Awaiting your review', icon: Inbox, count: counts.pending },
    { key: 'handled' as const, label: 'Handled by Me', desc: "Actions you've taken", icon: History, count: counts.handled },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-sgt-700 dark:text-white">
              Noting & Approval System
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Create, track, and manage approval requests
            </p>
          </div>
          <Link
            href="/noting/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 bg-sgt-600 text-white text-sm font-medium rounded-lg hover:bg-sgt-700 transition-colors shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Create New Note
          </Link>
        </div>

        {/* Tab Filters - scrollable on mobile */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex-shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'border-sgt-600 text-sgt-700 dark:text-sgt-300'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-sgt-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search and Filters */}
        <div className="mb-5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Note ID or description..."
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
            <button
              type="submit"
              className="flex-1 sm:flex-none px-4 py-2 bg-sgt-600 text-white text-sm rounded-lg hover:bg-sgt-700 font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                showFilters
                  ? 'bg-sgt-50 dark:bg-sgt-900/20 text-sgt-700 border-sgt-300'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            </div>
          </form>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="reverted">Reverted</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                >
                  <option value="">All Categories</option>
                  <option value="academic">Academic</option>
                  <option value="administrative">Administrative</option>
                  <option value="hrm">HRM</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <LoadingSpinner size="lg" className="mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading notes...</p>
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-sgt-50 dark:bg-sgt-900/20 rounded-full flex items-center justify-center">
                <FileText className="w-7 h-7 text-sgt-600 dark:text-sgt-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">
                {filter === 'mine' && 'No Notes Created Yet'}
                {filter === 'pending' && 'No Pending Approvals'}
                {filter === 'handled' && 'No Handled Notes'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
                {filter === 'mine' && 'Start by creating your first approval request.'}
                {filter === 'pending' && 'No notes waiting for your review right now.'}
                {filter === 'handled' && 'Notes you have acted upon will appear here.'}
              </p>
              {filter === 'mine' && (
                <Link
                  href="/noting/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-lg hover:bg-sgt-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Note
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const statusConf = STATUS_CONFIG[note.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConf.icon;
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === note.id;

              const approverActions = note.history?.filter((h) => h.performedById !== note.createdById) || [];
              const canEditOrDelete = filter === 'mine' && approverActions.length === 0;

              return (
                <Link
                  key={note.id}
                  href={
                    note.status === 'draft' || note.status === 'reverted'
                      ? `/noting/new?draft=${note.id}`
                      : `/noting/${note.id}`
                  }
                  className="group block"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-sgt-300 dark:hover:border-sgt-700 hover:shadow-sm transition-all duration-150">
                    <div className="px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <span className="font-mono text-xs font-semibold text-sgt-600 dark:text-sgt-400">
                              {note.notingId}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(note.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-sgt-700 dark:group-hover:text-sgt-400 transition-colors capitalize">
                            {note.category} / {note.subcategory}
                          </h3>
                          {note.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                              {stripHtml(note.description)}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-sgt-100 dark:bg-sgt-900/30 flex items-center justify-center text-sgt-700 dark:text-sgt-400 text-[10px] font-bold">
                                {getDisplayName(note).charAt(0).toUpperCase()}
                              </span>
                              {getDisplayName(note)}
                            </span>
                            {filter !== 'handled' && note.currentHolder && (
                              <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                With {note.currentHolder.employeeDetails?.displayName || note.currentHolder.uid}
                              </span>
                            )}
                            {(note._count?.history ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <History className="w-3 h-3" />
                                {note._count!.history} {note._count!.history === 1 ? 'action' : 'actions'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row flex-wrap items-center justify-end gap-2 shrink-0">
                          {filter === 'handled' && note.myAction ? (
                            <div className="flex flex-col items-end gap-1.5">
                              {(() => {
                                const actionConf = MY_ACTION_CONFIG[note.myAction.action] || MY_ACTION_CONFIG.forwarded;
                                const ActionIcon = actionConf.icon;
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${actionConf.color}`}
                                  >
                                    <ActionIcon className="w-3 h-3" />
                                    {actionConf.label}
                                  </span>
                                );
                              })()}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusConf.color}`}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusConf.label}
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${statusConf.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {statusConf.label}
                            </span>
                          )}

                          <div className="flex items-center gap-0.5" onClick={(e) => e.preventDefault()}>
                            {canEditOrDelete && note.status !== 'approved' && note.status !== 'rejected' && (
                              <Link
                                href={`/noting/new?draft=${note.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-gray-400 hover:text-sgt-600 hover:bg-sgt-50 dark:hover:bg-sgt-900/20 rounded-md transition-colors"
                                title="Edit note"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Link>
                            )}
                            {canEditOrDelete && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDraft(e, note)}
                                disabled={isDeleting}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                                title="Delete note"
                              >
                                {isDeleting ? (
                                  <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="mt-5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {(pagination.page - 1) * PAGE_SIZE + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {Math.min(pagination.page * PAGE_SIZE, pagination.total)}
                </span>{' '}
                of <span className="font-medium text-gray-700 dark:text-gray-200">{pagination.total}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || isLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
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
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        disabled={isLoading}
                        className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-sgt-600 text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
