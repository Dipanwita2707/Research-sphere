'use client';

import React, { useEffect } from 'react';
import { FileText, Trash2, Edit } from 'lucide-react';
import { useMailStore, useMailDrafts } from '../store/mailStore';
import type { MailDraft } from '../types';

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function DraftList() {
  const drafts = useMailDrafts();
  const { fetchDrafts, deleteDraft, openCompose, isLoading } = useMailStore();

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleOpenDraft = (draft: MailDraft) => {
    // Open compose with draft data — mode is stored in draft
    openCompose((draft.mode as any) || 'new');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
        <FileText size={32} className="mb-2 opacity-50" />
        <p className="text-sm">No drafts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Drafts</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            onClick={() => handleOpenDraft(draft)}
            className="group flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <Edit size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">Draft</span>
                <span className="text-xs text-gray-500">{formatTime(draft.updatedAt)}</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 truncate mt-0.5">
                {draft.subject || '(no subject)'}
              </div>
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {draft.toRecipients?.length
                  ? `To: ${(draft.toRecipients as any[]).map((r) => r.displayLabel || r.uid).join(', ')}`
                  : '(no recipients)'}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
