/**
 * @module dpdp/constants
 * @description Constants for the Digital Personal Data Protection Act 2023 /
 * DPDP Rules 2025 features: default privacy notice, purposes, request SLAs and
 * retention defaults.
 */

/** Purposes shown on the default notice. `required` purposes gate use of the app. */
const DEFAULT_PURPOSES = [
  {
    key: 'core_services',
    label: 'Core services',
    description:
      'Running your account and the services your university provides through ResearchSphere: sign-in, academic and employment records, ' +
      'research, IPR and grant workflows, approvals and the notifications those workflows need.',
    required: true,
  },
  {
    key: 'communications',
    label: 'Non-essential emails',
    description: 'Newsletters, tips, digests and announcements that are not needed to complete a workflow. You can still use the app without these.',
    required: false,
  },
  {
    key: 'analytics',
    label: 'Usage analytics',
    description:
      'Aggregated, de-identified statistics about how features are used so we can improve the product. Never used for advertising. ' +
      'Not available for users under 18.',
    required: false,
  },
  {
    key: 'research_profile_public',
    label: 'Public research profile',
    description: 'Showing your name, affiliation and research outputs on a publicly visible research profile.',
    required: false,
  },
];

/** Purposes that must never be enabled for a child (DPDP s. 9(3): no tracking/behavioural monitoring). */
const MINOR_FORBIDDEN_PURPOSES = ['analytics'];

const DEFAULT_NOTICE_VERSION = '2026-09-default-1';

const DEFAULT_NOTICE_CONTENT = `## Privacy notice

This notice explains, in plain language, what personal data ResearchSphere processes on behalf of your university, why, and how you can control it. It is given under section 5 of the Digital Personal Data Protection Act, 2023 ("DPDP Act") and the DPDP Rules, 2025.

Your university is the **Data Fiduciary**: it decides why and how your data is used. ResearchSphere processes the data for the university as its **Data Processor**.

### 1. What we collect
- **Identity and contact details**: name, university ID, email address, phone number, photograph.
- **Academic or employment details**: programme, department, designation, enrolment and employment dates. For students: date of birth, address, emergency and guardian contact.
- **Research and workflow data**: publications, IPR filings, grant applications, reviews, approvals and the files you upload.
- **Technical data**: sign-in times, IP address, browser type and an audit trail of actions, kept for security.

### 2. Why we use it (purposes)
- **Core services (required)**: to run your account and the academic, research, IPR and grant workflows of your university. Without this the app cannot work for you.
- **Non-essential emails (optional)**: newsletters, digests and announcements.
- **Usage analytics (optional)**: aggregated, de-identified statistics to improve the product. Never used for advertising, and never enabled for anyone under 18.
- **Public research profile (optional)**: showing your research profile publicly.

You choose each optional purpose separately. Saying no to an optional purpose never limits the core services.

### 3. Children
If you are under 18, your parent or lawful guardian must give verifiable consent before you can use the app. We send them a link by email. We do not track, profile or show targeted advertising to children.

### 4. How to withdraw consent
You can withdraw any consent at any time, as easily as you gave it: open **Privacy & my data** in your profile and switch the purpose off. Withdrawal does not affect processing that happened before it. If you withdraw consent for core services, you will not be able to keep using the features that depend on it, and you can ask for your data to be erased.

### 5. Your rights
Under sections 11 to 14 of the DPDP Act you can:
- get a summary of your personal data and how it is processed (**access**),
- have inaccurate or incomplete data **corrected** or updated,
- have your data **erased** when it is no longer needed, unless a law requires us to keep it (for example academic, financial and research-integrity records, and security logs for at least one year; these are anonymised instead where possible),
- **nominate** a person to exercise your rights if you die or become unable to,
- raise a **grievance**.

Use **Privacy & my data → My requests** in the app. We reply within the time set by your university, and grievances within 90 days at most.

### 6. Grievances and complaints
Contact your university's Data Protection Officer first:
- **Data Protection Officer**: {{DPO_NAME}}
- **Email**: {{DPO_EMAIL}}
- **Phone**: {{DPO_PHONE}}

If you are not satisfied with the response, you may complain to the **Data Protection Board of India** through the channel notified by the Government of India (the Board accepts complaints online). You should normally raise a grievance with us first.

### 7. How long we keep data
We keep personal data only as long as the purpose requires or the law obliges, then delete or anonymise it. Security logs are kept for at least one year.

### 8. Personal data breaches
If a breach affects your data, we will tell you what happened, the likely consequences and what you can do, and we will inform the Data Protection Board within 72 hours.
`;

const DEFAULT_NOTICE = Object.freeze({
  version: DEFAULT_NOTICE_VERSION,
  language: 'en',
  title: 'ResearchSphere privacy notice',
  content: DEFAULT_NOTICE_CONTENT,
  purposes: DEFAULT_PURPOSES,
});

/** Placeholder text used when a university has not set DPO details yet. */
const DPO_PLACEHOLDER = 'Not yet published by your university: contact your university administration';

// ── Data principal requests ─────────────────────────────────────────────────
const REQUEST_TYPES = ['access', 'correction', 'erasure', 'grievance', 'consent_withdrawal', 'nomination'];
const REQUEST_STATUSES = ['submitted', 'in_review', 'completed', 'rejected'];
const OPEN_REQUEST_STATUSES = ['submitted', 'in_review'];
const DEFAULT_REQUEST_SLA_DAYS = 30;
/** DPDP Rules 2025: grievances must be answered within 90 days at most. */
const GRIEVANCE_MAX_DAYS = 90;

/**
 * Profile fields a correction request may change, and where they live.
 * Anything else (email/uid used for sign-in, academic results, roles) is changed
 * through the normal admin screens, not by a data principal request.
 */
const CORRECTABLE_FIELDS = {
  firstName: { student: 'firstName', employee: 'firstName', max: 128 },
  middleName: { student: 'middleName', max: 128 },
  lastName: { student: 'lastName', employee: 'lastName', max: 128 },
  displayName: { student: 'displayName', employee: 'displayName', max: 256 },
  phone: { user: 'phone', student: 'phone', employee: 'phoneNumber', max: 15 },
  address: { student: 'address', max: 1000 },
  dateOfBirth: { student: 'dateOfBirth', type: 'date' },
  gender: { student: 'gender', max: 16 },
  nationality: { student: 'nationality', max: 100 },
  emergencyContact: { student: 'emergencyContact', max: 20 },
};

// ── Breaches ─────────────────────────────────────────────────────────────────
const BREACH_BOARD_REPORT_HOURS = 72;
const BREACH_STATUS_ORDER = ['detected', 'contained', 'board_notified', 'principals_notified', 'closed'];
const BREACH_SEVERITIES = ['low', 'medium', 'high', 'critical'];

// ── Retention ────────────────────────────────────────────────────────────────
/**
 * Built-in platform defaults. A DataRetentionPolicy row with universityId = null
 * overrides these for every tenant; a tenant row overrides both for that tenant.
 * minDays is a legal floor that cannot be configured lower.
 */
const RETENTION_CATEGORIES = {
  audit_log: {
    label: 'Security / audit logs',
    defaultDays: 730,
    minDays: 365, // DPDP Rules 2025: logs kept at least one year
    actions: ['delete'],
    defaultAction: 'delete',
  },
  notifications: {
    label: 'In-app notifications',
    defaultDays: 180,
    minDays: 1,
    actions: ['delete'],
    defaultAction: 'delete',
  },
  password_reset_tokens: {
    label: 'Password reset tokens (platform-wide)',
    defaultDays: 1,
    minDays: 1,
    actions: ['delete'],
    defaultAction: 'delete',
    platformOnly: true,
  },
  bug_reports: {
    label: 'Resolved bug reports',
    defaultDays: 730,
    minDays: 30,
    actions: ['anonymize', 'delete'],
    defaultAction: 'anonymize',
  },
  inactive_student_accounts: {
    label: 'Student accounts after graduation',
    defaultDays: 1095,
    minDays: 365,
    actions: ['anonymize'],
    defaultAction: 'anonymize',
  },
};
const RETENTION_MAX_DAYS = 36500;

// ── Consent cache ────────────────────────────────────────────────────────────
const CONSENT_CACHE_PREFIX = 'dpdp:consent:';
const CONSENT_CACHE_TTL = 120; // seconds

/** Path prefixes (relative to /api/v1) never blocked by the consent gate. */
const CONSENT_EXEMPT_PREFIXES = ['/auth', '/dpdp', '/license', '/health', '/contact'];

const GUARDIAN_TOKEN_AUDIENCE = 'guardian-consent';
const GUARDIAN_TOKEN_TTL = '7d';

module.exports = {
  DEFAULT_PURPOSES,
  MINOR_FORBIDDEN_PURPOSES,
  DEFAULT_NOTICE,
  DEFAULT_NOTICE_VERSION,
  DPO_PLACEHOLDER,
  REQUEST_TYPES,
  REQUEST_STATUSES,
  OPEN_REQUEST_STATUSES,
  DEFAULT_REQUEST_SLA_DAYS,
  GRIEVANCE_MAX_DAYS,
  CORRECTABLE_FIELDS,
  BREACH_BOARD_REPORT_HOURS,
  BREACH_STATUS_ORDER,
  BREACH_SEVERITIES,
  RETENTION_CATEGORIES,
  RETENTION_MAX_DAYS,
  CONSENT_CACHE_PREFIX,
  CONSENT_CACHE_TTL,
  CONSENT_EXEMPT_PREFIXES,
  GUARDIAN_TOKEN_AUDIENCE,
  GUARDIAN_TOKEN_TTL,
};
