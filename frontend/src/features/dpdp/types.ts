// DPDP Act 2023 — shared types (mirrors backend contract in src/modules/dpdp)

export interface NoticePurpose {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

export interface ConsentNotice {
  id: string;
  version: string;
  language: string;
  title: string;
  content: string; // markdown
  purposes: NoticePurpose[];
  isActive: boolean;
  effectiveFrom: string;
  createdAt?: string;
  universityId?: string | null;
  /** true for the platform-wide default notice (universityId null) */
  isPlatformDefault?: boolean;
}

export interface ConsentRecord {
  id: string;
  noticeId: string;
  purpose: string;
  granted: boolean;
  grantedAt?: string | null;
  withdrawnAt?: string | null;
  givenBy?: 'self' | 'guardian' | string;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianRelation?: string | null;
  guardianVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MyConsentState {
  notice: ConsentNotice | null;
  records: ConsentRecord[];
  needsConsent: boolean;
  isMinor: boolean;
  requiresGuardian: boolean;
  /** true when required purposes are granted but the guardian has not verified yet (still blocked) */
  guardianPending: boolean;
  /** purposes that can never be enabled for a minor (DPDP s. 9(3)), e.g. ['analytics'] */
  minorRestrictedPurposes?: string[];
  /** POST /consents only: false when the guardian email could not be sent */
  guardianEmailSent?: boolean | null;
  /** POST /consents only: purposes the server switched off because the user is a minor */
  forcedOffForMinor?: string[];
}

export interface GuardianInput {
  name: string;
  email: string;
  relation: string;
}

export interface ConsentSubmission {
  noticeId: string;
  decisions: Array<{ purpose: string; granted: boolean }>;
  guardian?: GuardianInput;
}

export type RequestType =
  | 'access'
  | 'correction'
  | 'erasure'
  | 'grievance'
  | 'consent_withdrawal'
  | 'nomination';

export type RequestStatus = 'submitted' | 'in_review' | 'completed' | 'rejected';

export interface DataPrincipalRequest {
  id: string;
  userId: string;
  type: RequestType;
  status: RequestStatus;
  description?: string | null;
  details?: Record<string, unknown> | null;
  response?: string | null;
  dueAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** admin list only */
  overdue?: boolean;
  user?: {
    id?: string;
    uid?: string | null;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    erased?: boolean;
  } | null;
  handledBy?: { id: string; uid?: string | null } | null;
}

export interface NewRequestInput {
  type: RequestType;
  description?: string;
  details?: Record<string, unknown>;
}

export interface Nominee {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  relation?: string | null;
  updatedAt?: string;
}

export interface NomineeInput {
  name: string;
  email?: string;
  phone?: string;
  relation?: string;
}

export interface DpoContact {
  universityId?: string | null;
  universityName?: string | null;
  universitySlug?: string | null;
  dpoName?: string | null;
  dpoEmail?: string | null;
  dpoPhone?: string | null;
  requireGuardianConsentForMinors?: boolean;
}

export interface PublicPrivacy {
  universityName: string;
  notice: ConsentNotice | null;
  dpo: { name?: string | null; email?: string | null; phone?: string | null };
}

export interface GuardianConsentInfo {
  studentName: string;
  universityName: string;
  purposes: Array<NoticePurpose | string>;
  alreadyVerified: boolean;
}

// ---------- Admin ----------

export interface DpdpOverview {
  openRequests: number;
  overdueRequests: number;
  openBreaches: number;
  breachesDueSoon: number;
  consentCoverage: { users: number; consented: number };
  activeNotice: (Pick<ConsentNotice, 'id' | 'version' | 'title'> & { isPlatformDefault?: boolean }) | null;
  /** 'platform' for a superadmin without a selected university */
  scope?: 'university' | 'platform';
}

export interface RequestListResult {
  items: DataPrincipalRequest[];
  total: number;
}

export interface RequestFilters {
  status?: RequestStatus | '';
  type?: RequestType | '';
  page?: number;
  limit?: number;
}

export interface NoticeInput {
  version: string;
  language?: string;
  title: string;
  content: string;
  purposes: NoticePurpose[];
}

export type BreachStatus =
  | 'detected'
  | 'contained'
  | 'board_notified'
  | 'principals_notified'
  | 'closed';

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BreachIncident {
  id: string;
  title: string;
  description: string;
  severity: BreachSeverity | string;
  status: BreachStatus;
  detectedAt: string;
  boardReportDueAt: string;
  boardNotifiedAt?: string | null;
  principalsNotifiedAt?: string | null;
  affectedCount?: number | null;
  dataCategories?: string[] | null;
  remediation?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** server-computed: Board deadline passed without intimation */
  overdue?: boolean;
  /** server-computed: Board deadline within 24h */
  dueSoon?: boolean;
  hoursToBoardDeadline?: number | null;
}

export interface BreachInput {
  title: string;
  description: string;
  severity: BreachSeverity;
  detectedAt: string;
  affectedCount?: number;
  dataCategories?: string[];
}

export interface BreachUpdate {
  status?: BreachStatus;
  remediation?: string;
  boardNotifiedAt?: string;
  affectedCount?: number;
}

export type RetentionAction = 'delete' | 'anonymize';

export interface RetentionPolicy {
  id?: string;
  universityId?: string | null;
  category: string;
  retentionDays: number;
  action: RetentionAction | string;
  isActive?: boolean;
  label?: string;
  /** legal floor — cannot be configured lower (audit_log: 365) */
  minDays?: number;
  allowedActions?: string[];
  platformOnly?: boolean;
  source?: 'tenant' | 'platform' | 'default';
}

export interface ContactSettingsInput {
  dpoName?: string;
  dpoEmail?: string;
  dpoPhone?: string;
  requireGuardianConsentForMinors?: boolean;
}

/** Sections of the admin "Data protection" console. */
export type AdminTab = 'overview' | 'requests' | 'notices' | 'breaches' | 'retention' | 'contact';
