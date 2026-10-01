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
}

export interface RipCapability {
  key: RipPermissionKey;
  label: string;
  description: string;
  roleDefaultable: boolean;
}

export interface RipGrant {
  userId: string;
  name: string;
  uid: string;
  email: string | null;
  role: string;
  department: string | null;
  permissions: RipPermissionKey[];
  expiresAt: string | null;
  expired: boolean;
  note: string | null;
  grantedBy: string | null;
  updatedAt: string;
}

export interface RipAccessOverview {
  settings: { enabled: boolean; enabledAt: string | null; roleDefaults: Partial<Record<string, RipPermissionKey[]>> };
  grants: RipGrant[];
  capabilities: RipCapability[];
  defaultableRoles: string[];
}

export interface RipCandidate {
  userId: string;
  name: string;
  uid: string;
  email: string | null;
  role: string;
  department: string | null;
  currentPermissions: RipPermissionKey[];
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
