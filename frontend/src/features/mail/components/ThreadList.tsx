'use client';

import React, { useEffect, useState } from 'react';
import { Star, Paperclip, ChevronLeft, ChevronRight, RefreshCw, Search, X, Mail, Tag, SlidersHorizontal } from 'lucide-react';
import { useMailStore, useMailThreads, useIsMailLoading, useMailLabels } from '../store/mailStore';
import type { MailThread, MailView, MailSearchParams } from '../types';

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() ===
   now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * oneDay) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  if (date.getFullYear() ===
   now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

const VIEW_TITLES: Record<MailView, string> = {
  inbox: 'Inbox',
  sent: 'Sent',
  starred: 'Starred',
  drafts: 'Drafts',
  trash: 'Trash',
  search: 'Search Results',
  label: 'Label',
};

export default function ThreadList() {
  const {
    currentView,
    currentThreadId,
    currentLabelId,
    fetchInbox,
    fetchSent,
    fetchStarred,
    fetchTrash,
    fetchDrafts,
    fetchThread,
    toggleStar,
    refreshCurrentView,
    searchMail,
    clearSearch,
    searchPage,
    inboxPagination,
    sentPagination,
    starredPagination,
    trashPagination,
    searchPagination,
    labelPagination,
    fetchLabelThreads,
  } = useMailStore();
  const threads = useMailThreads();
  const labels = useMailLabels();
  const isLoading = useIsMailLoading();

  const currentLabel = labels.find((l) => l.id ===
   currentLabelId);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showSearchTips, setShowSearchTips] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterHasAtt, setFilterHasAtt] = useState(false);

  const hasActiveFilters = filterFrom || filterTo || filterDateFrom || filterDateTo || filterHasAtt;

  // Load data on view change
  useEffect(() => {
    switch (currentView) {
      case 'inbox': fetchInbox(); break;
      case 'sent': fetchSent(); break;
      case 'starred': fetchStarred(); break;
      case 'trash': fetchTrash(); break;
      case 'drafts': fetchDrafts(); break;
    }
  }, [currentView, fetchInbox, fetchSent, fetchStarred, fetchTrash, fetchDrafts]);

  const buildSearchParams = (): MailSearchParams => ({
    q: searchQuery.trim() || undefined,
    from: filterFrom.trim() || undefined,
    to: filterTo.trim() || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
    hasAttachments: filterHasAtt || undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = buildSearchParams();
    const hasAnything = params.q || params.from || params.to || params.dateFrom || params.dateTo || params.hasAttachments;
    if (hasAnything) {
      searchMail(params);
      setShowSearchTips(false);
      setShowFilters(false);
    }
  };

  // Live search with debounce (only plain query, not filter fields)
  useEffect(() => {
    if (!isSearchMode || !searchQuery.trim() || searchQuery.trim().length < 2) return;
    if (showFilters) return; // don't live-search while filter panel is open
    const timer = setTimeout(() => {
      searchMail(buildSearchParams());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    setFilterFrom('');
    setFilterTo('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterHasAtt(false);
    setShowFilters(false);
    clearSearch();
  };

  const getPagination = () => {
    switch (currentView) {
      case 'inbox': return inboxPagination;
      case 'sent': return sentPagination;
      case 'starred': return starredPagination;
      case 'trash': return trashPagination;
      case 'search': return searchPagination;
      case 'label': return labelPagination;
      default: return { page: 1, totalPages: 1, total: 0 };
    }
  };

  const handlePageChange = (page: number) => {
    switch (currentView) {
      case 'inbox': fetchInbox(page); break;
      case 'sent': fetchSent(page); break;
      case 'starred': fetchStarred(page); break;
      case 'trash': fetchTrash(page); break;
      case 'label': if (currentLabelId) fetchLabelThreads(currentLabelId, undefined, page); break;
      case 'search': searchPage(page); break;
    }
  };

  const pagination = getPagination();

  return (
    <div className="flex flex-col h-full border-r" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white" style={{ borderBottom: '2px solid #e8f0fe' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: '#011f4b' }}>
            {currentView ===
   'label' && currentLabel ? (
              <>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: currentLabel.color || '#6b7280' }} />
                {currentLabel.name}
              </>
            ) : (
              VIEW_TITLES[currentView]
            )}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchMode(!isSearchMode)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#6497b1' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="Search"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => refreshCurrentView()}
              className={`p-1.5 rounded-lg transition-colors ${isLoading ? 'animate-spin' : ''}`}
              style={{ color: '#6497b1' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {(isSearchMode || currentView ===
   'search') && (
          <div className="relative mt-1">
            <form onSubmit={handleSearch}>
              {/* Input row */}
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowSearchTips(true)}
                    onBlur={() => setTimeout(() => setShowSearchTips(false), 200)}
                    placeholder="Search mail..."
                    className="w-full pl-3 pr-8 py-1.5 text-sm rounded-lg outline-none"
                    style={{ background: '#f0f6ff', border: '1px solid #b3cde0', color: '#011f4b' }}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      style={{ color: '#9ca3af' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex-shrink-0 p-1.5 rounded-lg transition-colors relative"
                  style={{
                    background: showFilters || hasActiveFilters ? '#e8f0fe' : 'transparent',
                    border: '1px solid #b3cde0',
                    color: hasActiveFilters ? '#005b96' : '#6497b1',
                  }}
                  title="Advanced filters"
                >
                  <SlidersHorizontal size={15} />
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#005b96' }} />
                  )}
                </button>

                {/* Search button */}
                <button
                  type="submit"
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: '#005b96', color: '#fff' }}
                >
                  Go
                </button>
              </div>

              {/* Advanced filter panel */}
              {showFilters && (
                <div
                  className="mt-1.5 rounded-lg p-3 space-y-2 text-xs"
                  style={{ background: '#f0f6ff', border: '1px solid #b3cde0' }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1 font-medium" style={{ color: '#03396c' }}>From</label>
                      <input
                        type="text"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        placeholder="sender name or UID"
                        className="w-full px-2 py-1 rounded outline-none text-xs"
                        style={{ background: '#fff', border: '1px solid #b3cde0', color: '#011f4b' }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium" style={{ color: '#03396c' }}>To</label>
                      <input
                        type="text"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        placeholder="recipient name or UID"
                        className="w-full px-2 py-1 rounded outline-none text-xs"
                        style={{ background: '#fff', border: '1px solid #b3cde0', color: '#011f4b' }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium" style={{ color: '#03396c' }}>After (date from)</label>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="w-full px-2 py-1 rounded outline-none text-xs"
                        style={{ background: '#fff', border: '1px solid #b3cde0', color: '#011f4b' }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium" style={{ color: '#03396c' }}>Before (date to)</label>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="w-full px-2 py-1 rounded outline-none text-xs"
                        style={{ background: '#fff', border: '1px solid #b3cde0', color: '#011f4b' }}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterHasAtt}
                      onChange={(e) => setFilterHasAtt(e.target.checked)}
                      className="rounded"
                      style={{ accentColor: '#005b96' }}
                    />
                    <span style={{ color: '#03396c' }}>Has attachments</span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-1 rounded text-xs font-medium"
                      style={{ background: '#005b96', color: '#fff' }}
                    >
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterFrom(''); setFilterTo('');
                        setFilterDateFrom(''); setFilterDateTo('');
                        setFilterHasAtt(false);
                      }}
                      className="px-3 py-1 rounded text-xs"
                      style={{ background: '#e8f0fe', color: '#03396c' }}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Active filter chips */}
            {hasActiveFilters && !showFilters && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {filterFrom && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#e8f0fe', color: '#03396c' }}>
                    from:{filterFrom}
                    <button onClick={() => { setFilterFrom(''); }} style={{ color: '#6497b1' }}><X size={10} /></button>
                  </span>
                )}
                {filterTo && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#e8f0fe', color: '#03396c' }}>
                    to:{filterTo}
                    <button onClick={() => { setFilterTo(''); }} style={{ color: '#6497b1' }}><X size={10} /></button>
                  </span>
                )}
                {filterDateFrom && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#e8f0fe', color: '#03396c' }}>
                    after:{filterDateFrom}
                    <button onClick={() => { setFilterDateFrom(''); }} style={{ color: '#6497b1' }}><X size={10} /></button>
                  </span>
                )}
                {filterDateTo && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#e8f0fe', color: '#03396c' }}>
                    before:{filterDateTo}
                    <button onClick={() => { setFilterDateTo(''); }} style={{ color: '#6497b1' }}><X size={10} /></button>
                  </span>
                )}
                {filterHasAtt && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#e8f0fe', color: '#03396c' }}>
                    has:attachment
                    <button onClick={() => { setFilterHasAtt(false); }} style={{ color: '#6497b1' }}><X size={10} /></button>
                  </span>
                )}
              </div>
            )}

            {/* Search tips dropdown */}
            {showSearchTips && !searchQuery && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-lg shadow-xl p-3 text-xs space-y-1.5" style={{ border: '1px solid #b3cde0' }}>
                <p className="font-semibold mb-2" style={{ color: '#011f4b' }}>Search tips:</p>
                {[
                  ['from:dipa', 'search by sender'],
                  ['to:admin', 'search by recipient'],
                  ['subject:meeting', 'search in subject only'],
                  ['has:attachment', 'mails with files'],
                  ['filename:report.pdf', 'attachment filename'],
                  ['after:2026-02-01', 'mails after date'],
                  ['before:2026-02-28', 'mails before date'],
                  ['older_than:7d', 'older than 7 days'],
                  ['newer_than:3d', 'within last 3 days'],
                  ['is:unread', 'unread only'],
                  ['is:starred', 'starred only'],
                  ['in:sent', 'sent by me'],
                  ['"exact phrase"', 'exact phrase match'],
                ].map(([op, desc]) => (
                  <p key={op} style={{ color: '#6497b1' }}>
                    <span className="font-mono px-1 rounded mr-1" style={{ background: '#e8f0fe', color: '#03396c' }}>{op}</span>
                    — {desc}
                  </p>
                ))}
                <p className="italic mt-2" style={{ color: '#9ca3af' }}>Or just type any word to search everywhere</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination info */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between mt-2 text-xs" style={{ color: '#6497b1' }}>
            <span>
              {((pagination.page - 1) * 20) + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </span>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-0.5 rounded disabled:opacity-30"
                  style={{ color: '#005b96' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-0.5 rounded disabled:opacity-30"
                  style={{ color: '#005b96' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: '#005b96' }} />
          </div>
        ) : threads.length ===
   0 ? (
          <div className="flex flex-col items-center justify-center h-32">
            <Mail size={32} className="mb-2" style={{ color: '#b3cde0' }} />
            <p className="text-sm" style={{ color: '#6497b1' }}>No messages</p>
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              isActive={thread.id ===
   currentThreadId}
              onClick={() => fetchThread(thread.id)}
              onToggleStar={() => toggleStar(thread.id)}
              view={currentView}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ThreadRowProps {
  thread: MailThread;
  isActive: boolean;
  onClick: () => void;
  onToggleStar: () => void;
  view: MailView;
}

function ThreadRow({ thread, isActive, onClick, onToggleStar, view }: ThreadRowProps) {
  const isUnread = (thread.unreadCount ?? 0) > 0;
  const { applyLabel, removeLabel } = useMailStore();
  const labels = useMailLabels();
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const customLabels = labels.filter((l) => !l.isSystem);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 px-3 py-3 cursor-pointer transition-colors duration-100 relative group/row"
      style={{
        borderBottom: '1px solid #f0f4f8',
        background: isActive
          ? 'linear-gradient(90deg, rgba(0,91,150,0.08) 0%, rgba(0,91,150,0.04) 100%)'
          : isUnread
            ? '#ffffff'
            : '#fafbfc',
        borderLeft: isActive ? '3px solid #005b96' : isUnread ? '3px solid #6497b1' : '3px solid transparent',
      }}
    >
      {/* Star */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
        className="flex-shrink-0 mt-0.5 p-0.5 rounded transition-all duration-150 hover:scale-110"
        style={{ color: thread.isStarred ? '#f59e0b' : '#cbd5e1' }}
      >
        <Star size={14} fill={thread.isStarred ? 'currentColor' : 'none'} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-sm truncate"
            style={{ color: isUnread ? '#011f4b' : '#374151', fontWeight: isUnread ? 600 : 400 }}
          >
            {view ===
   'sent'
              ? (
                  (thread as any).recipients?.map((r: any) => r.displayName || r.uid).join(', ') ||
                  thread.participants?.map((p: any) => p.user?.displayName || p.user?.uid).join(', ') ||
                  'Unknown'
                )
              : (thread.lastSender?.displayName || thread.lastSender?.uid || 'Unknown')
            }
          </span>
          <span className="flex-shrink-0 text-xs" style={{ color: '#9ca3af' }}>
            {formatTime(thread.lastMessageAt)}
          </span>
        </div>
        <div
          className="text-sm truncate mt-0.5"
          style={{ color: isUnread ? '#03396c' : '#6b7280', fontWeight: isUnread ? 500 : 400 }}
        >
          {thread.subject}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs truncate flex-1" style={{ color: '#9ca3af' }}>
            {thread.lastMessageSnippet}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Label chips */}
            {thread.labels?.map((label) => (
              <span
                key={label.id}
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${label.color}20`, color: label.color || '#6b7280', fontSize: '10px', border: `1px solid ${label.color}40` }}
              >
                {label.name}
              </span>
            ))}
            {thread.hasAttachments && (
              <Paperclip size={11} style={{ color: '#9ca3af' }} />
            )}
            {thread.messageCount > 1 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: '#e8f0fe', color: '#03396c', fontSize: '10px' }}
              >
                {thread.messageCount}
              </span>
            )}
            {isUnread && (thread.unreadCount ?? 0) > 0 && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#005b96' }} />
            )}
          </div>
        </div>
      </div>

      {/* Apply label hover button */}
      {customLabels.length > 0 && (
        <div className="relative flex-shrink-0 hidden group-hover/row:flex items-start mt-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowLabelMenu(!showLabelMenu)}
            className="p-0.5 rounded transition-colors"
            style={{ color: '#6497b1' }}
            title="Apply label"
          >
            <Tag size={13} />
          </button>
          {showLabelMenu && (
            <div
              className="absolute right-0 top-6 z-30 bg-white rounded-lg shadow-xl py-1 min-w-[140px]"
              style={{ border: '1px solid #b3cde0' }}
              onMouseLeave={() => setShowLabelMenu(false)}
            >
              <p className="px-3 py-1 text-xs font-semibold" style={{ color: '#6497b1' }}>Apply label</p>
              {customLabels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => { applyLabel(label.id, thread.id); setShowLabelMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-blue-50"
                  style={{ color: '#011f4b' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color || '#6b7280' }} />
                  {label.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
