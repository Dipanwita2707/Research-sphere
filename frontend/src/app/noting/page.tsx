'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Plus, Inbox, Send, Loader2, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Trash2, History, Pencil, Search, X, Filter, RotateCcw } from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { Note } from '@/features/noting-management/types/noting.types';
import { useToast } from '@/shared/ui-components/Toast';
import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: FileText },
  pending: { label: 'In Review', color: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  reverted: { label: 'Reverted', color: 'bg-orange-100 text-orange-800', icon: RotateCcw },
};

const MY_ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  approved: { label: 'Approved by you', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200', icon: CheckCircle },
  rejected: { label: 'Rejected by you', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200', icon: XCircle },
  forwarded: { label: 'Forwarded by you', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200', icon: Send },
  reverted: { label: 'Reverted by you', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200', icon: RotateCcw },
};

function getDisplayName(note: Note): string {
  const c = note.createdBy;
  if (c?.employeeDetails?.displayName) return c.employeeDetails.displayName;
  if (c?.employeeDetails?.firstName || c?.employeeDetails?.lastName) {
    return [c.employeeDetails.firstName, c.employeeDetails.lastName].filter(Boolean).join(' ');
  }
  if (c?.studentLogin?.displayName) return c.studentLogin.displayName;
  return c?.uid ?? '—';
}

const PAGE_SIZE = 20;

export default function NotingListPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'mine' | 'pending' | 'handled'>('mine');
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Block students from accessing noting system
  useEffect(() => {
    if (user && user.role === 'student') {
      toast({ type: 'error', message: 'Students are not allowed to access the noting system' });
      router.push('/dashboard');
    }
  }, [user, router, toast]);
  
  // Counts for badges
  const [counts, setCounts] = useState({ mine: 0, pending: 0, handled: 0 });
  
  // Search and filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleDeleteDraft = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if any approver has taken action
    const approverActions = note.history?.filter(h => h.performedById !== note.createdById) || [];
    if (approverActions.length > 0) {
      toast({ type: 'error', message: 'Cannot delete note after an approver has taken action' });
      return;
    }
    
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    setDeletingId(note.id);
    notingService
      .deleteDraft(note.id)
      .then(() => {
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
        toast({ type: 'success', message: 'Note deleted' });
      })
      .catch((err) => {
        const message = err.response?.data?.message || 'Failed to delete note';
        toast({ type: 'error', message });
      })
      .finally(() => setDeletingId(null));
  };

  // Fetch counts for badges
  useEffect(() => {
    notingService.getCounts()
      .then(setCounts)
      .catch(() => setCounts({ mine: 0, pending: 0, handled: 0 }));
  }, [notes]); // Refresh counts when notes change

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCategory('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [filter, search, status, category, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    const params: any = { filter, page, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (status) params.status = status;
    if (category) params.category = category;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    notingService
      .list(params)
      .then(({ data, pagination: p }) => {
        if (!cancelled) {
          setNotes(data);
          setPagination(p);
        }
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filter, page, search, status, category, startDate, endDate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-gray-50 dark:from-gray-900 dark:via-indigo-950/20 dark:to-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-indigo-900 dark:from-white dark:to-indigo-200 bg-clip-text text-transparent mb-2">
              Noting & Approval System
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create, track, and manage approval requests efficiently
            </p>
          </div>
          <Link
            href="/noting/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Create New Note
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
          <button
            onClick={() => setFilter('mine')}
            className={`relative overflow-hidden rounded-md p-2.5 text-left transition-all duration-200 ${
              filter === 'mine' 
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-[1.02]' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className={`p-1.5 rounded-md ${
                filter === 'mine' 
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30'
              }`}>
                <Send className={`w-4 h-4 ${filter === 'mine' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              </div>
              {counts.mine > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === 'mine' 
                    ? 'bg-white text-indigo-600' 
                    : 'bg-indigo-600 text-white'
                }`}>
                  {counts.mine}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold mb-0.5 leading-tight">My Notes</h3>
            <p className={`text-[11px] leading-tight ${filter === 'mine' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
              Notes created by you
            </p>
          </button>

          <button
            onClick={() => setFilter('pending')}
            className={`relative overflow-hidden rounded-md p-2.5 text-left transition-all duration-200 ${
              filter === 'pending' 
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg scale-[1.02]' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className={`p-1.5 rounded-md ${
                filter === 'pending' 
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30'
              }`}>
                <Inbox className={`w-4 h-4 ${filter === 'pending' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
              </div>
              {counts.pending > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === 'pending' 
                    ? 'bg-white text-amber-600' 
                    : 'bg-amber-600 text-white'
                }`}>
                  {counts.pending}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold mb-0.5 leading-tight">Pending for Me</h3>
            <p className={`text-[11px] leading-tight ${filter === 'pending' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
              Awaiting your review
            </p>
          </button>

          <button
            onClick={() => setFilter('handled')}
            className={`relative overflow-hidden rounded-md p-2.5 text-left transition-all duration-200 ${
              filter === 'handled' 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg scale-[1.02]' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className={`p-1.5 rounded-md ${
                filter === 'handled' 
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30'
              }`}>
                <History className={`w-4 h-4 ${filter === 'handled' ? 'text-white' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              {counts.handled > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === 'handled' 
                    ? 'bg-white text-green-600' 
                    : 'bg-green-600 text-white'
                }`}>
                  {counts.handled}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold mb-0.5 leading-tight">Handled by Me</h3>
            <p className={`text-[11px] leading-tight ${filter === 'handled' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
              Actions you've taken
            </p>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Note ID or description..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-medium flex items-center gap-2 ${showFilters ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </form>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  <option value="academic">Academic</option>
                  <option value="administrative">Administrative</option>
                  <option value="hrm">HRM</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading notes...</p>
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {filter === 'mine' && 'No Notes Created Yet'}
                {filter === 'pending' && 'No Pending Approvals'}
                {filter === 'handled' && 'No Handled Notes'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                {filter === 'mine' && 'Start by creating your first approval request. Click the button below to get started.'}
                {filter === 'pending' && 'You have no notes waiting for your review. When notes are assigned to you, they will appear here.'}
                {filter === 'handled' && 'Notes you have approved, rejected, forwarded, or reverted will appear here.'}
              </p>
              {filter === 'mine' && (
                <Link 
                  href="/noting/new" 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Note
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {notes.map((note) => {
              const statusConf = STATUS_CONFIG[note.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConf.icon;
              const isDeleting = deletingId === note.id;
              
              // Can edit/delete only if user is creator and no approver has taken action
              const approverActions = note.history?.filter(h => h.performedById !== note.createdById) || [];
              const canEditOrDelete = filter === 'mine' && approverActions.length === 0;
              
              return (
                <Link
                  key={note.id}
                  href={note.status === 'draft' || note.status === 'reverted' ? `/noting/new?draft=${note.id}` : `/noting/${note.id}`}
                  className="group"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200">
                    {/* Header Section */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Note ID and Title */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg">
                              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5">
                                {note.notingId}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(note.createdAt).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {note.category.charAt(0).toUpperCase() + note.category.slice(1)} / {note.subcategory}
                          </h3>
                          {note.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {note.description}
                            </p>
                          )}
                        </div>

                        {/* Right: Status Badge and Actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {filter === 'handled' && note.myAction ? (
                            <div className="flex flex-col items-end gap-2">
                              {(() => {
                                const actionConf = MY_ACTION_CONFIG[note.myAction.action] || MY_ACTION_CONFIG.forwarded;
                                const ActionIcon = actionConf.icon;
                                return (
                                  <span 
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm ${actionConf.color}`}
                                    title={`Action taken on ${new Date(note.myAction.performedAt).toLocaleString()}`}
                                  >
                                    <ActionIcon className="w-4 h-4" />
                                    {actionConf.label}
                                  </span>
                                );
                              })()}
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {new Date(note.myAction.performedAt).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {/* Also show current status for handled notes */}
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${statusConf.color}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConf.label}
                              </span>
                            </div>
                          ) : (
                            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm ${statusConf.color}`}>
                              <StatusIcon className="w-4 h-4" />
                              {statusConf.label}
                            </span>
                          )}
                          
                          <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                            {canEditOrDelete && note.status !== 'approved' && note.status !== 'rejected' && (
                              <Link
                                href={`/noting/new?draft=${note.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                title="Edit note"
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            )}
                            {canEditOrDelete && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDraft(e, note)}
                                disabled={isDeleting}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={approverActions.length > 0 ? "Cannot delete after approver action" : "Delete note"}
                              >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Section */}
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/30">
                      <div className="flex items-center justify-between gap-4 text-xs">
                        {/* Creator Info */}
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-xs">
                            {getDisplayName(note).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {getDisplayName(note)}
                          </span>
                        </div>

                        {/* Current Holder (for pending/in-review notes) */}
                        {filter !== 'handled' && note.currentHolder && (
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Send className="w-3.5 h-3.5" />
                            <span className="font-medium">
                              With {note.currentHolder.employeeDetails?.displayName || note.currentHolder.uid}
                            </span>
                          </div>
                        )}

                        {/* History count */}
                        {note.history && note.history.length > 0 && (
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                            <History className="w-3.5 h-3.5" />
                            <span className="font-medium">
                              {note.history.length} {note.history.length === 1 ? 'action' : 'actions'}
                            </span>
                          </div>
                        )}
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
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Showing <span className="text-gray-900 dark:text-white font-semibold">{((pagination.page - 1) * PAGE_SIZE) + 1}</span> to <span className="text-gray-900 dark:text-white font-semibold">{Math.min(pagination.page * PAGE_SIZE, pagination.total)}</span> of <span className="text-gray-900 dark:text-white font-semibold">{pagination.total}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
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
                        disabled={loading}
                        className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                          pagination.page === pageNum
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
