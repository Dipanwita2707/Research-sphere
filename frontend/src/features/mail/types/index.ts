/**
 * Mail Type Definitions
 */

// Recipient types
export type MailRecipientType = 'TO' | 'CC' | 'BCC';

// Recipient search result types
export type RecipientSearchType = 'user' | 'central_department' | 'centralDepartment' | 'school' | 'department';

// Group recipient label (for sent-via-group tracking)
export interface GroupRecipientLabel {
  uid: string;           // e.g. "dept:UUID", "school:UUID", "cdept:UUID"
  displayName: string;   // e.g. "Computer Science"
  type: RecipientSearchType;
}

// Mail recipient for compose
export interface MailRecipientOption {
  id: string;
  uid: string;
  displayName: string;
  displayLabel: string;
  email: string;
  role?: string;
  designation?: string;
  department?: string;
  profileImage?: string;
  type: RecipientSearchType;
}

// Thread list item
export interface MailThread {
  id: string;
  subject: string;
  lastMessageAt: string;
  lastMessageSnippet: string | null;
  messageCount: number;
  unreadCount: number;
  isStarred: boolean;
  isMuted: boolean;
  lastSender: {
    uid: string;
    displayName: string;
    profileImage?: string;
  } | null;
  hasAttachments: boolean;
  createdAt: string;
  labels?: MailLabel[];
  participants?: Array<{
    user: {
      uid: string;
      displayName: string;
    };
  }>;
  recipients?: {
    uid: string;
    displayName: string;
    type: MailRecipientType;
  }[];
}

// Full message in conversation view
export interface MailMessage {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  bodyPlainText?: string;
  sentAt: string;
  isSystemMessage: boolean;
  sender: {
    uid: string;
    displayName: string;
    profileImage?: string;
    role: string;
  };
  recipients: {
    id: string;
    userId: string;
    uid: string;
    displayName: string;
    recipientType: MailRecipientType;
    readAt: string | null;
    isStarred: boolean;
  }[];
  attachments: MailAttachment[];
  replyTo?: {
    id: string;
    subject: string;
    sender: { uid: string };
  } | null;
  metadata?: {
    groupRecipients?: {
      to: GroupRecipientLabel[];
      cc: GroupRecipientLabel[];
      bcc: GroupRecipientLabel[];
    };
  } | null;
}

// Thread conversation - matches backend response structure
export interface MailConversation {
  id: string;
  subject: string;
  messageCount: number;
  createdAt: string;
  createdBy: {
    uid: string;
    displayName: string;
  };
  lastReadAt: string | null;
  isMuted: boolean;
  isStarred?: boolean;
  messages: MailMessage[];
}

// Attachment
export interface MailAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

// Label
export interface MailLabel {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  sortOrder: number;
  userId: string | null;
}

// Draft
export interface MailDraft {
  id: string;
  subject: string | null;
  body: string | null;
  toRecipients: any[];
  ccRecipients: any[];
  bccRecipients: any[];
  attachments?: MailAttachment[];
  threadId: string | null;
  replyToId: string | null;
  mode: 'new' | 'reply' | 'reply-all' | 'forward';
  updatedAt: string;
  createdAt: string;
}

// Sidebar counts
export interface MailCounts {
  unreadCount: number;
  draftCount: number;
  starredCount: number;
  trashCount: number;
}

// Compose payload
export interface ComposeMail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: Partial<MailAttachment>[];
  groupRecipients?: {
    to: GroupRecipientLabel[];
    cc: GroupRecipientLabel[];
    bcc: GroupRecipientLabel[];
  };
}

// Reply payload
export interface ReplyMail {
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Partial<MailAttachment>[];
}

// Search params
export interface MailSearchParams {
  q?: string;
  from?: string;
  to?: string;
  hasAttachments?: boolean;
  dateFrom?: string;
  dateTo?: string;
  labelId?: string;
  page?: number;
  limit?: number;
}

// API Response wrapper
export interface MailApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Mail view types
export type MailView = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash' | 'label' | 'search';
