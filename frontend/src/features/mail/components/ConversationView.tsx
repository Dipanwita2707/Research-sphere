'use client';

import React, { useState } from 'react';
import {
  Reply,
  ReplyAll,
  Forward,
  Star,
  Trash2,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Paperclip,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Clock,
  MailOpen,
  Mail,
  Tag,
  X,
} from 'lucide-react';
import { useMailStore, useCurrentConversation, useMailLabels } from '../store/mailStore';
import { useAuthStore } from '@/shared/auth/authStore';
import { getFileUrl } from '@/shared/api/api';
import type { MailMessage, GroupRecipientLabel } from '../types';

function getGroupBadgeColor(type: string) {
  if (type ===
   'central_department' || type ===
   'centralDepartment') return { bg: '#f3e8ff', text: '#7c3aed', border: '#d8b4fe' };
  if (type ===
   'school') return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
  return { bg: '#dcfce7', text: '#16a34a', border: '#86efac' }; // department
}

function GroupBadge({ group }: { group: GroupRecipientLabel }) {
  const colors = getGroupBadgeColor(group.type);
  const label = group.type ===
   'central_department' || group.type ===
   'centralDepartment'
    ? 'Central Dept'
    : group.type ===
   'school' ? 'School' : 'Department';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      <span className="opacity-60 text-[10px]">{label}:</span>
      <span>{group.displayName}</span>
    </span>
  );
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatFullDate(dateStr);
}

export default function ConversationView() {
  const conversation = useCurrentConversation();
  const authUser = useAuthStore((s) => s.user);
  const labels = useMailLabels();
  const {
    currentThreadId,
    isLoadingThread,
    clearThread,
    openCompose,
    toggleStar,
    deleteThread,
    archiveThread,
    markAsRead,
    markAsUnread,
    applyLabel,
    removeLabel,
  } = useMailStore();
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const customLabels = labels.filter((l) => !l.isSystem);

  if (isLoadingThread) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="animate-spin w-8 h-8 rounded-full" style={{ border: '2px solid #b3cde0', borderTopColor: '#005b96' }} />
      </div>
    );
  }

  if (!conversation || !currentThreadId) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: '#f8fafc' }}>
        <Mail size={48} className="mb-3" style={{ color: '#b3cde0' }} />
        <p className="text-lg font-medium" style={{ color: '#03396c' }}>Select a conversation</p>
        <p className="text-sm mt-1" style={{ color: '#6497b1' }}>Choose a thread from the list to read</p>
      </div>
    );
  }

  const thread = conversation;
  const messages = conversation.messages || [];

  // Determine if thread has multiple participants (for showing Reply All)
  const hasMultipleRecipients = messages.some((msg) => {
    const allRecipients = msg.recipients || [];
    const toCount = allRecipients.filter((r: any) => r.recipientType ===
   'TO').length;
    const ccCount = allRecipients.filter((r: any) => r.recipientType ===
   'CC').length;
    const bccCount = allRecipients.filter((r: any) => r.recipientType ===
   'BCC').length;
    // Include sender + all recipients as participants
    const totalParticipants = 1 + toCount + ccCount + bccCount; // 1 for sender
    return totalParticipants > 2; // more than just sender + 1 recipient
  });

  return (
    <div className="h-full flex flex-col min-w-0" style={{ background: '#f8fafc' }}>
      {/* Thread header */}
      <div className="flex-shrink-0 px-5 py-3 bg-white" style={{ borderBottom: '2px solid #e8f0fe' }}>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={clearThread}
            className="p-1 rounded-lg lg:hidden transition-colors"
            style={{ color: '#6497b1' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold truncate flex-1" style={{ color: '#011f4b' }}>
            {thread.subject}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <ActionButton
            icon={<Reply size={15} />}
            label="Reply"
            onClick={() => openCompose('reply', messages[messages.length - 1]?.id)}
          />
          {hasMultipleRecipients && (
            <ActionButton
              icon={<ReplyAll size={15} />}
              label="Reply All"
              onClick={() => openCompose('replyAll', messages[messages.length - 1]?.id)}
            />
          )}
          <ActionButton
            icon={<Forward size={15} />}
            label="Forward"
            onClick={() => openCompose('forward', messages[messages.length - 1]?.id)}
          />
          <div className="w-px h-4 mx-1" style={{ background: '#b3cde0' }} />
          <ActionButton
            icon={<Archive size={15} />}
            label="Archive"
            onClick={() => archiveThread(currentThreadId)}
          />
          <ActionButton
            icon={<Trash2 size={15} />}
            label="Delete"
            onClick={() => deleteThread(currentThreadId)}
          />
          <ActionButton
            icon={<Star size={15} fill={thread.isStarred ? 'currentColor' : 'none'} />}
            label={thread.isStarred ? 'Unstar' : 'Star'}
            onClick={() => toggleStar(currentThreadId)}
            style={{ color: thread.isStarred ? '#f59e0b' : undefined }}
          />

          {/* Label button */}
          {customLabels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLabelMenu(!showLabelMenu)}
                title="Apply label"
                className="p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                style={{ color: '#6497b1' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Tag size={15} />
                <span className="hidden sm:inline">Label</span>
              </button>
              {showLabelMenu && (
                <div
                  className="absolute right-0 top-8 z-30 bg-white rounded-lg shadow-xl py-1 min-w-[160px]"
                  style={{ border: '1px solid #b3cde0' }}
                >
                  <p className="px-3 py-1.5 text-xs font-semibold" style={{ color: '#6497b1', borderBottom: '1px solid #e8f0fe' }}>
                    Apply / Remove Labels
                  </p>
                  {customLabels.map((label) => {
                    const isApplied = false; // could track per-thread labels
                    return (
                      <button
                        key={label.id}
                        onClick={() => { applyLabel(label.id, currentThreadId); setShowLabelMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-blue-50"
                        style={{ color: '#011f4b' }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color || '#6b7280' }} />
                        {label.name}
                      </button>
                    );
                  })}
                  <div style={{ borderTop: '1px solid #e8f0fe' }}>
                    <p className="px-3 py-1.5 text-xs font-semibold" style={{ color: '#ef4444' }}>Remove Labels</p>
                    {customLabels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => { removeLabel(label.id, currentThreadId); setShowLabelMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-red-50"
                        style={{ color: '#374151' }}
                      >
                        <X size={11} style={{ color: '#ef4444' }} />
                        {label.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((message, i) => (
          <MessageCard
            key={message.id}
            message={message}
            isLast={i ===
   messages.length - 1}
            onReply={() => openCompose('reply', message.id)}
            onReplyAll={() => openCompose('replyAll', message.id)}
            onForward={() => openCompose('forward', message.id)}
            showReplyAll={hasMultipleRecipients}
          />
        ))}
      </div>

      {/* Quick reply bar */}
      <div className="flex-shrink-0 px-4 py-3 bg-white" style={{ borderTop: '1px solid #e8f0fe' }}>
        <button
          onClick={() => openCompose('reply', messages[messages.length - 1]?.id)}
          className="w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors"
          style={{ background: '#f8fafc', border: '1px solid #b3cde0', color: '#9ca3af' }}
        >
          Click here to reply...
        </button>
      </div>
    </div>
  );
}

// Sub-components

function ActionButton({
  icon,
  label,
  onClick,
  className = '',
  style,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs ${className}`}
      style={{ color: style?.color ?? '#6497b1', ...style }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {icon}
      <span className="hidden sm:inline" style={{ color: 'inherit' }}>{label}</span>
    </button>
  );
}

function MessageCard({
  message,
  isLast,
  onReply,
  onReplyAll,
  onForward,
  showReplyAll = false,
}: {
  message: MailMessage;
  isLast: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  showReplyAll?: boolean;
}) {
  const [expanded, setExpanded] = useState(isLast);
  const [showDetails, setShowDetails] = useState(false);

  const sender = message.sender;
  const senderName = sender?.displayName || sender?.uid || 'Unknown';
  const senderEmail = sender?.uid ? `${sender.uid}@ums.sgtu` : '';

  const toRecipients = message.recipients?.filter((r: any) => r.recipientType ===
   'TO') || [];
  const ccRecipients = message.recipients?.filter((r: any) => r.recipientType ===
   'CC') || [];
  const bccRecipients = message.recipients?.filter((r: any) => r.recipientType ===
   'BCC') || [];
  const groupInfo = (message as any).metadata?.groupRecipients;
  const toGroups: GroupRecipientLabel[] = groupInfo?.to || [];
  const ccGroups: GroupRecipientLabel[] = groupInfo?.cc || [];
  const bccGroups: GroupRecipientLabel[] = groupInfo?.bcc || [];

  return (
    <div
      className="group rounded-xl overflow-hidden shadow-sm"
      style={{
        border: expanded || isLast ? '1px solid #b3cde0' : '1px solid #e2e8f0',
        borderLeft: expanded || isLast ? '3px solid #005b96' : '3px solid transparent',
        background: '#fff',
      }}
    >
      {/* Header - always visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f0f6ff'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg, #005b96, #011f4b)' }}
        >
          {senderName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm truncate" style={{ color: '#011f4b' }}>
                {senderName}
              </span>
              <span className="text-xs truncate hidden sm:inline" style={{ color: '#6497b1' }}>
                {senderEmail}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: '#6497b1' }}>
                {formatRelativeTime(message.sentAt)}
              </span>
              {expanded
                ? <ChevronUp size={14} style={{ color: '#6497b1' }} />
                : <ChevronDown size={14} style={{ color: '#6497b1' }} />}
            </div>
          </div>

          {!expanded && (
            <p className="text-sm truncate mt-0.5" style={{ color: '#64748b' }}>
              {message.bodyPlainText?.substring(0, 120) || 'No content'}
            </p>
          )}

          {expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              className="text-xs mt-0.5 transition-colors flex items-center gap-1 flex-wrap"
              style={{ color: '#6497b1' }}
            >
              {toGroups.length > 0 ? (
                <>
                  <span>via</span>
                  {toGroups.map((g, i) => (
                    <GroupBadge key={i} group={g} />
                  ))}
                  {toRecipients.length > 0 && (
                    <span className="text-xs" style={{ color: '#9ca3af' }}>({toRecipients.length} recipients)</span>
                  )}
                </>
              ) : (
                <span>to {toRecipients.map((r: any) => r.displayName || r.uid).join(', ') || '...'}
                  {ccRecipients.length > 0 && `, cc: ${ccRecipients.length}`}
                </span>
              )}
              {showDetails ? ' ▲' : ' ▼'}
            </button>
          )}
        </div>
      </div>

      {/* Details panel */}
      {expanded && showDetails && (
        <div className="px-4 py-2 text-xs space-y-1" style={{ background: '#f0f6ff', borderTop: '1px solid #e8f0fe' }}>
          <div className="flex gap-2">
            <span className="w-12" style={{ color: '#6497b1' }}>From:</span>
            <span style={{ color: '#03396c' }}>{senderName} &lt;{senderEmail}&gt;</span>
          </div>
          <div className="flex gap-2">
            <span className="w-12" style={{ color: '#6497b1' }}>To:</span>
            <span style={{ color: '#03396c' }}>
              {toGroups.length > 0 && (
                <span className="flex flex-wrap gap-1 mb-1">
                  {toGroups.map((g, i) => <GroupBadge key={i} group={g} />)}
                  <span className="text-xs self-center" style={{ color: '#6497b1' }}>
                    → expanded to {toRecipients.length} individual recipient{toRecipients.length !== 1 ? 's' : ''}
                  </span>
                </span>
              )}
              {(!toGroups.length) && toRecipients.map((r: any) => `${r.displayName || r.uid} <${r.uid}@ums.sgtu>`).join(', ')}
            </span>
          </div>
          {(ccRecipients.length > 0 || ccGroups.length > 0) && (
            <div className="flex gap-2">
              <span className="w-12" style={{ color: '#6497b1' }}>Cc:</span>
              <span style={{ color: '#03396c' }}>
                {ccGroups.length > 0 && (
                  <span className="flex flex-wrap gap-1 mb-1">
                    {ccGroups.map((g, i) => <GroupBadge key={i} group={g} />)}
                    {ccRecipients.length > 0 && (
                      <span className="text-xs self-center" style={{ color: '#6497b1' }}>→ {ccRecipients.length} recipients</span>
                    )}
                  </span>
                )}
                {!ccGroups.length && ccRecipients.map((r: any) => `${r.displayName || r.uid} <${r.uid}@ums.sgtu>`).join(', ')}
              </span>
            </div>
          )}
          {bccRecipients.length > 0 && (
            <div className="flex gap-2">
              <span className="w-12" style={{ color: '#6497b1' }}>Bcc:</span>
              <span style={{ color: '#03396c' }}>
                {bccRecipients.map((r: any) => r.displayName || r.uid).join(', ')}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="w-12" style={{ color: '#6497b1' }}>Date:</span>
            <span style={{ color: '#03396c' }}>{formatFullDate(message.sentAt)}</span>
          </div>
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="px-4 py-4">
          <div
            className="prose prose-sm max-w-none"
            style={{ color: '#1e293b' }}
            dangerouslySetInnerHTML={{ __html: message.body }}
          />

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid #e8f0fe' }}>
              <div className="flex items-center gap-1 mb-2 text-xs" style={{ color: '#6497b1' }}>
                <Paperclip size={12} />
                <span>{message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={getFileUrl(att.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
                    style={{ background: '#f0f6ff', border: '1px solid #b3cde0' }}
                  >
                    <Paperclip size={14} style={{ color: '#6497b1' }} />
                    <span className="max-w-[150px] truncate" style={{ color: '#03396c' }}>
                      {att.fileName}
                    </span>
                    <span className="text-xs" style={{ color: '#6497b1' }}>
                      {att.fileSize ? `${(att.fileSize / 1024).toFixed(0)}KB` : ''}
                    </span>
                    <Download size={14} style={{ color: '#6497b1' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Message actions */}
          <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #e8f0fe' }}>
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors"
              style={{ border: '1px solid #b3cde0', color: '#03396c', background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Reply size={14} /> Reply
            </button>
            {showReplyAll && (
              <button
                onClick={onReplyAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors"
                style={{ border: '1px solid #b3cde0', color: '#03396c', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <ReplyAll size={14} /> Reply All
              </button>
            )}
            <button
              onClick={onForward}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors"
              style={{ border: '1px solid #b3cde0', color: '#03396c', background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Forward size={14} /> Forward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
