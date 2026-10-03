export type RipPermissionKey =
  | 'rip_view_overview'
  | 'rip_view_keyword_intelligence'
  | 'rip_view_taxonomy'
  | 'rip_manage_taxonomy'
  | 'rip_view_knowledge_graph'
  | 'rip_view_citation_analytics'
  | 'rip_manage_access'
  | 'rip_access_research_gpt';

/** The current user's effective access in their university. */
export interface RipAccess {
  enabled: boolean;
  permissions: Record<RipPermissionKey, boolean>;
  /** admin = administrator, role = via an assigned role, grant = individual extra, none = no access */
  source: 'admin' | 'role' | 'grant' | 'none';
  roles?: string[];
}

export interface RipCapability {
  key: RipPermissionKey;
  label: string;
  group: 'Use' | 'Manage';
  description: string;
}

/** A role (reusable permission template) that grants Research Intelligence capabilities. */
export interface RipRole {
  id: string;
  name: string;
  roleCode: string;
  description: string | null;
  permissions: RipPermissionKey[];
  /** permissions in the role outside Research Intelligence; such roles are managed on the Roles page only */
  otherPermissionCount: number;
  /** Research-Intelligence-only: safe to assign from this screen */
  assignable: boolean;
  assignedCount: number;
}

export interface RipTemplate {
  key: string;
  label: string;
  description: string;
  permissions: RipPermissionKey[];
  existingRoleId: string | null;
}

export interface RipAccessOverview {
  enabled: boolean;
  enabledAt: string | null;
  summary: { extraGrants: number; extraExpired: number; admins: number; assigned: number };
  capabilities: RipCapability[];
  templates: RipTemplate[];
  roles: RipRole[];
  filterRoles: string[];
}

export type RipAccessFilter = 'all' | 'with' | 'without' | 'expired';

export interface RipExtraGrant {
  permissions: RipPermissionKey[];
  expiresAt: string | null;
  expired: boolean;
  note: string | null;
  grantedBy: string | null;
  updatedAt: string | null;
}

/** One row of the people table. */
export interface RipUserRow {
  userId: string;
  name: string;
  uid: string;
  email: string | null;
  role: string;
  department: string | null;
  designation: string | null;
  isAdmin: boolean;
  roles: { id: string; name: string; assignable: boolean }[];
  /** effective capabilities right now (roles + active extra grant; everything for admins) */
  permissions: RipPermissionKey[];
  extra: RipExtraGrant | null;
}

export interface RipUserPage {
  items: RipUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UniversityModuleState {
  universityId: string;
  code: string;
  name: string;
  universityActive: boolean;
  enabled: boolean;
  enabledAt: string | null;
  disabledAt: string | null;
  notes: string | null;
  userGrants: number;
}

export interface PipelineRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string | null;
  progress: number;
  stats: Record<string, any>;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface RipStatus {
  ai: { configured: boolean; providers: { provider: string; model: string }[] };
  lastRun: PipelineRun | null;
  keywords: { total: number; mapped: number; taxonomyCoverage: number; pendingReview: number; growing: number };
  permissions: Record<RipPermissionKey, boolean>;
}

export interface ChatSession {
  id: string;
  title: string | null;
  pinned: boolean;
  messageCount: number;
  lastActiveAt: string;
  createdAt: string;
}

export interface ChatSource {
  ref: number;
  type: 'publication' | 'researcher';
  id: string;
  cited: boolean;
  // publication
  title?: string;
  journal?: string | null;
  year?: number | null;
  doi?: string | null;
  citations?: number;
  authors?: string[];
  // researcher
  name?: string;
  designation?: string | null;
  department?: string | null;
}

export interface ToolStep {
  id?: string;
  tool?: string;
  name?: string;
  label: string;
  summary?: string;
  state?: 'start' | 'end';
  failed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolTrace?: ToolStep[];
  sources?: ChatSource[];
  provider?: string | null;
  model?: string | null;
  responseTimeMs?: number | null;
  feedback?: number | null;
  createdAt: string;
}

export type StreamEvent =
  | { event: 'status'; data: { phase: 'thinking' | 'answering' } }
  | { event: 'tool'; data: ToolStep & { id: string; state: 'start' | 'end' } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'sources'; data: { items: ChatSource[] } }
  | { event: 'done'; data: { message: ChatMessage; title?: string } }
  | { event: 'error'; data: { message: string } };

export * from './graph.types';
