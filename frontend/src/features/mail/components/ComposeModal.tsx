'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Paperclip,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  Reply,
} from 'lucide-react';
import { useMailStore } from '../store/mailStore';
import { useAuthStore } from '@/shared/auth/authStore';
import RecipientSelector from './RecipientSelector';
import * as mailService from '../services/mail.service';
import type { MailRecipientOption, ComposeMail, ReplyMail } from '../types';

export default function ComposeModal() {
  const {
    showCompose,
    composeMode,
    composeReplyToId,
    composeForwardId,
    closeCompose,
    sendMail,
    replyToMessage,
    replyAllToMessage,
    forwardMessage,
    isSending,
    saveDraft,
    conversation,
  } = useMailStore();

  const authUser = useAuthStore((s) => s.user);
  const isStudent = authUser?.userType ===
   'student' || authUser?.role?.name ===
   'student';
  const isEmployee = !isStudent;

  const [toRecipients, setToRecipients] = useState<MailRecipientOption[]>([]);
  const [ccRecipients, setCcRecipients] = useState<MailRecipientOption[]>([]);
  const [bccRecipients, setBccRecipients] = useState<MailRecipientOption[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<any[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill for reply/replyAll/forward
  useEffect(() => {
    if (!showCompose) return;

    if (composeMode ===
   'new') {
      resetForm();
      return;
    }

    // Find the message to reply/forward to
    const messageId = composeReplyToId || composeForwardId;
    if (!messageId || !conversation?.messages) return;

    const msg = conversation.messages.find((m) => m.id ===
   messageId);
    if (!msg) return;

    if (composeMode ===
   'reply') {
      setSubject(msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
      setToRecipients(msg.sender ? [{
        id: msg.sender.uid,
        uid: msg.sender.uid,
        displayName: msg.sender.displayName || msg.sender.uid,
        displayLabel: msg.sender.displayName || msg.sender.uid,
        email: `${msg.sender.uid}@ums.sgtu`,
        type: 'user',
      }] : []);
      setBody(''); // Clean blank reply
    } else if (composeMode ===
   'replyAll') {
      setSubject(msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
      
      // TO = original sender + all original TO recipients (minus self)
      const originalToRecipients = msg.recipients?.filter((r) => r.recipientType ===
   'TO') || [];
      const toRecipients: MailRecipientOption[] = [];
      
      // Add original sender if not self
      if (msg.sender && msg.sender.uid !== authUser?.uid) {
        toRecipients.push({
          id: msg.sender.uid,
          uid: msg.sender.uid,
          displayName: msg.sender.displayName || msg.sender.uid,
          displayLabel: msg.sender.displayName || msg.sender.uid,
          email: `${msg.sender.uid}@ums.sgtu`,
          type: 'user',
        });
      }
      
      // Add all original TO recipients (minus self and sender)
      originalToRecipients
        .filter((r) => r.uid !== authUser?.uid && r.uid !== msg.sender?.uid)
        .forEach((r) => {
          toRecipients.push({
            id: r.uid || r.userId,
            uid: r.uid || r.userId,
            displayName: r.displayName || r.uid || '',
            displayLabel: r.displayName || r.uid || '',
            email: `${r.uid || r.userId}@ums.sgtu`,
            type: 'user',
          });
        });
      
      setToRecipients(toRecipients);
      
      // CC = original CC recipients (minus self)
      const ccFromOriginal = (msg.recipients?.filter((r) => r.recipientType ===
   'CC') || [])
        .filter((r) => r.uid !== authUser?.uid)
        .map((r) => ({
          id: r.uid || r.userId,
          uid: r.uid || r.userId,
          displayName: r.displayName || r.uid || '',
          displayLabel: r.displayName || r.uid || '',
          email: `${r.uid || r.userId}@ums.sgtu`,
          type: 'user' as const,
        }));
      
      setCcRecipients(ccFromOriginal);
      
      // BCC = original BCC recipients that include current user (only show own BCC)
      const bccFromOriginal = (msg.recipients?.filter((r) => r.recipientType ===
   'BCC' && r.uid ===
   authUser?.uid) || [])
        .map((r) => ({
          id: r.uid || r.userId,
          uid: r.uid || r.userId,
          displayName: r.displayName || r.uid || '',
          displayLabel: r.displayName || r.uid || '',
          email: `${r.uid || r.userId}@ums.sgtu`,
          type: 'user' as const,
        }));
      
      setBccRecipients(bccFromOriginal);
      
      if (ccFromOriginal.length > 0 || bccFromOriginal.length > 0) {
        setShowCcBcc(true);
      }
      
      setBody(''); // Clean blank reply all
    } else if (composeMode ===
   'forward') {
      setSubject(msg.subject?.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`);
      setToRecipients([]);
      setBody(buildForwardBody(msg));
    }
  }, [showCompose, composeMode, composeReplyToId, composeForwardId, conversation]);

  // Auto-focus textarea for replies
  useEffect(() => {
    if (showCompose && (composeMode ===
   'reply' || composeMode ===
   'replyAll') && bodyRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        bodyRef.current?.focus();
      }, 100);
    }
  }, [showCompose, composeMode]);

  const resetForm = () => {
    setToRecipients([]);
    setCcRecipients([]);
    setBccRecipients([]);
    setSubject('');
    setBody('');
    setAttachments([]);
    setUploadedAttachments([]);
    setShowCcBcc(false);
    setError(null);
  };

  const buildQuotedBody = (msg: any) => {
    const sender = msg.sender?.displayName || msg.sender?.uid || 'Unknown';
    const date = new Date(msg.sentAt).toLocaleString();
    return `\n\n---------- Original Message ----------\nFrom: ${sender}\nDate: ${date}\nSubject: ${msg.subject}\n\n${msg.bodyPlainText || ''}`;
  };

  const buildForwardBody = (msg: any) => {
    const sender = msg.sender?.displayName || msg.sender?.uid || 'Unknown';
    const senderEmail = msg.sender?.uid ? `${msg.sender.uid}@ums.sgtu` : '';
    const date = new Date(msg.sentAt).toLocaleString();
    const toList = msg.recipients
      ?.filter((r: any) => r.recipientType ===
   'TO')
      .map((r: any) => `${r.displayName || r.uid} <${r.uid || r.userId}@ums.sgtu>`)
      .join(', ') || '';
    const ccList = msg.recipients
      ?.filter((r: any) => r.recipientType ===
   'CC')
      .map((r: any) => `${r.displayName || r.uid} <${r.uid || r.userId}@ums.sgtu>`)
      .join(', ') || '';
    
    let body = `\n\n---------- Forwarded message ---------\nFrom: ${sender} <${senderEmail}>\nDate: ${date}\nSubject: ${msg.subject}\nTo: ${toList}`;
    if (ccList) body += `\nCc: ${ccList}`;
    body += `\n\n${msg.bodyPlainText || msg.body || ''}`;
    return body;
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setAttachments((prev) => [...prev, ...newFiles]);

    // Upload files immediately
    setIsUploading(true);
    try {
      const res = await mailService.uploadAttachments(newFiles);
      const data = res.data as any;
      if (data?.attachments) {
        setUploadedAttachments((prev) => [...prev, ...data.attachments]);
      } else if (Array.isArray(data)) {
        setUploadedAttachments((prev) => [...prev, ...data]);
      }
    } catch {
      setError('Failed to upload attachments');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setUploadedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setError(null);

    if (composeMode ===
   'new' || composeMode ===
   'forward') {
      if (toRecipients.length ===
   0) {
        setError('Please add at least one recipient');
        return;
      }
      if (!subject.trim()) {
        setError('Please add a subject');
        return;
      }

      // Helper: extract group label from a recipient
      const toGroupLabel = (r: MailRecipientOption) => ({
        uid: r.email || r.uid,
        displayName: r.displayName,
        type: r.type,
      });

      const toGroups = toRecipients.filter((r) => r.type !== 'user').map(toGroupLabel);
      const ccGroups = ccRecipients.filter((r) => r.type !== 'user').map(toGroupLabel);
      const bccGroups = bccRecipients.filter((r) => r.type !== 'user').map(toGroupLabel);

      const data: ComposeMail = {
        to: toRecipients.map((r) => {
          if (r.type ===
   'user') return r.uid;
          if (r.type ===
   'central_department' || r.type ===
   'centralDepartment') return `cdept:${r.id}`;
          if (r.type ===
   'school') return `school:${r.id}`;
          if (r.type ===
   'department') return `dept:${r.id}`;
          return r.uid;
        }),
        cc: ccRecipients.map((r) => r.uid || r.id),
        bcc: bccRecipients.map((r) => r.uid || r.id),
        subject: subject.trim(),
        body: body,
        attachments: uploadedAttachments,
        ...(toGroups.length > 0 || ccGroups.length > 0 || bccGroups.length > 0
          ? { groupRecipients: { to: toGroups, cc: ccGroups, bcc: bccGroups } }
          : {}),
      };

      let success: boolean;
      if (composeMode ===
   'forward' && composeForwardId) {
        success = await forwardMessage(composeForwardId, data);
      } else {
        success = await sendMail(data);
      }

      if (success) {
        resetForm();
        closeCompose();
      }
    } else if (composeMode ===
   'reply' && composeReplyToId) {
      const data: ReplyMail = {
        body: body,
        cc: ccRecipients.map((r) => r.uid || r.id),
        bcc: bccRecipients.map((r) => r.uid || r.id),
        attachments: uploadedAttachments,
      };
      const success = await replyToMessage(composeReplyToId, data);
      if (success) {
        resetForm();
        closeCompose();
      }
    } else if (composeMode ===
   'replyAll' && composeReplyToId) {
      const data: ReplyMail = {
        body: body,
        cc: ccRecipients.map((r) => r.uid || r.id),
        bcc: bccRecipients.map((r) => r.uid || r.id),
        attachments: uploadedAttachments,
      };
      const success = await replyAllToMessage(composeReplyToId, data);
      if (success) {
        resetForm();
        closeCompose();
      }
    }
  };

  const handleSaveDraft = async () => {
    await saveDraft({
      subject,
      body,
      toRecipients: toRecipients.map((r) => ({ uid: r.uid || r.id, displayLabel: r.displayLabel || r.displayName })),
      ccRecipients: ccRecipients.map((r) => ({ uid: r.uid || r.id, displayLabel: r.displayLabel || r.displayName })),
      bccRecipients: bccRecipients.map((r) => ({ uid: r.uid || r.id, displayLabel: r.displayLabel || r.displayName })),
      threadId: conversation?.id,
      replyToId: composeReplyToId,
      mode: composeMode,
    });
    closeCompose();
  };

  const handleClose = () => {
    // Auto-save as draft if there's content
    if (subject.trim() || body.trim() || toRecipients.length > 0) {
      handleSaveDraft();
    } else {
      closeCompose();
    }
  };

  if (!showCompose) return null;

  const modeLabel = {
    new: 'New Message',
    reply: 'Reply',
    replyAll: 'Reply All',
    forward: 'Forward',
  }[composeMode];

  const modalSizeClass = isFullscreen
    ? 'fixed inset-4 z-50'
    : isMinimized
      ? 'fixed bottom-0 right-4 w-80 z-50'
      : 'fixed bottom-0 right-4 w-[560px] z-50';

  return (
    <>
      {/* Backdrop for fullscreen */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsFullscreen(false)} />
      )}

      <div className={`${modalSizeClass} rounded-t-xl shadow-2xl flex flex-col`} style={{ background: '#fff', border: '1px solid #b3cde0' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 rounded-t-xl cursor-move" style={{ background: '#011f4b' }}>
          <span className="text-sm font-medium" style={{ color: '#b3cde0' }}>{modeLabel}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded transition-colors"
              style={{ color: '#b3cde0' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Minimize2 size={14} />
            </button>
            <button
              onClick={() => { setIsFullscreen(!isFullscreen); setIsMinimized(false); }}
              className="p-1 rounded transition-colors"
              style={{ color: '#b3cde0' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={handleClose}
              className="p-1 rounded transition-colors"
              style={{ color: '#b3cde0' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Error */}
            {error && (
              <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
                <AlertCircle size={14} />
                {error}
                <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
              </div>
            )}

            {/* Student admin auto-CC notice */}
            {isStudent && (
              <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
                📋 Admin will be automatically CC&apos;d on your messages
              </div>
            )}

            {/* Reply context - show what message we're replying to */}
            {(composeMode ===
   'reply' || composeMode ===
   'replyAll') && conversation?.messages && (
              <div className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#f0f4f8', border: '1px solid #b3cde0', color: '#4a5568' }}>
                <div className="flex items-center gap-2">
                  <Reply size={12} />
                  <span>Replying to: </span>
                  <span className="font-medium">
                    {(() => {
                      const messageId = composeReplyToId;
                      const msg = conversation.messages.find((m) => m.id ===
   messageId);
                      return msg?.sender?.displayName || msg?.sender?.uid || 'Unknown';
                    })()}
                  </span>
                </div>
              </div>
            )}

            {/* From field */}
            <div className="px-4 pt-2 pb-1" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-12 text-xs font-medium" style={{ color: '#6497b1' }}>From</span>
                <div style={{ color: '#011f4b' }}>
                  {authUser?.employee?.displayName || authUser?.student?.displayName || 
                   (authUser?.firstName && authUser?.lastName ? `${authUser.firstName} ${authUser.lastName}` : '') ||
                   authUser?.username || authUser?.uid} &lt;{authUser?.uid || authUser?.username}@ums.sgtu&gt;
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div className="px-4 pt-2 space-y-2">
              {/* TO */}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <RecipientSelector
                    label="To"
                    recipients={toRecipients}
                    onChange={setToRecipients}
                    allowGroups={isEmployee}
                    disabled={false}
                  />
                </div>
                {!showCcBcc && (
                  <button
                    onClick={() => setShowCcBcc(true)}
                    className="mt-5 text-xs text-blue-600 hover:underline whitespace-nowrap"
                  >
                    Cc/Bcc
                  </button>
                )}
              </div>

              {/* CC */}
              {showCcBcc && (
                <RecipientSelector
                  label="Cc"
                  recipients={ccRecipients}
                  onChange={setCcRecipients}
                  allowGroups={isEmployee}
                />
              )}

              {/* BCC */}
              {showCcBcc && (
                <RecipientSelector
                  label="Bcc"
                  recipients={bccRecipients}
                  onChange={setBccRecipients}
                  allowGroups={isEmployee}
                />
              )}

              {/* Subject */}
              {(composeMode ===
   'new' || composeMode ===
   'forward') && (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-0 py-1.5 text-sm bg-transparent focus:outline-none"
                style={{ borderBottom: '1px solid #b3cde0', color: '#011f4b' }}
                />
              )}
              {(composeMode ===
   'reply' || composeMode ===
   'replyAll') && (
                <div className="text-xs py-1" style={{ color: '#6497b1', borderBottom: '1px solid #e2e8f0' }}>
                  Subject: {subject}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 px-4 py-2 min-h-0">
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  composeMode ===
   'reply' 
                    ? 'Type your reply...' 
                    : composeMode ===
   'replyAll' 
                      ? 'Type your reply to all...' 
                      : composeMode ===
   'forward'
                        ? 'Add a message...'
                        : 'Compose your message...'
                }
                className="w-full h-full min-h-[150px] resize-none bg-transparent text-sm focus:outline-none"
                style={{ color: '#011f4b' }}
              />
            </div>

            {/* Attachments list */}
            {attachments.length > 0 && (
              <div className="px-4 py-2" style={{ borderTop: '1px solid #e2e8f0' }}>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                      style={{ background: '#e8f0fe', border: '1px solid #b3cde0' }}
                    >
                      <Paperclip size={12} style={{ color: '#6497b1' }} />
                      <span className="max-w-[120px] truncate" style={{ color: '#011f4b' }}>
                        {file.name}
                      </span>
                      <span style={{ color: '#6497b1' }}>({(file.size / 1024).toFixed(0)}KB)</span>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions bar */}
            <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSend()}
                  disabled={isSending || isUploading}
                  className="flex items-center gap-2 px-4 py-1.5 text-white rounded-lg text-sm font-medium transition-colors"
                  style={{ background: isSending || isUploading ? '#6497b1' : '#005b96' }}
                >
                  {isSending ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send size={14} />
                  )}
                  Send
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleAttachFiles(e.target.files)}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.zip,.rar"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: '#6497b1' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e8f0fe'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  title="Attach files"
                >
                  {isUploading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                  ) : (
                    <Paperclip size={16} />
                  )}
                </button>
              </div>
              <button
                onClick={() => { resetForm(); closeCompose(); }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#6497b1' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6497b1'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                title="Discard"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
