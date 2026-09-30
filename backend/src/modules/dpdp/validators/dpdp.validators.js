/**
 * @module dpdp/validators
 * @description zod schemas for the DPDP API (used with shared validateRequest).
 */
const { z } = require('zod');
const {
  REQUEST_TYPES, REQUEST_STATUSES, BREACH_STATUS_ORDER, BREACH_SEVERITIES, RETENTION_CATEGORIES,
} = require('../dpdp.constants');

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid id');
const purposeKey = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, 'Purpose keys use lowercase letters, digits and _');
const email = z.string().trim().max(256).email('Enter a valid email address');
const optionalText = (max) => z.string().trim().max(max).optional().nullable();

const idParams = z.object({ id: uuid });

const consentBody = z.object({
  noticeId: uuid,
  decisions: z.array(z.object({ purpose: purposeKey, granted: z.boolean() })).min(1).max(50),
  guardian: z.object({
    name: z.string().trim().min(2).max(256),
    email,
    relation: z.string().trim().min(2).max(64),
  }).optional().nullable(),
});

const purposeParams = z.object({ purpose: purposeKey });

const createRequestBody = z.object({
  type: z.enum(REQUEST_TYPES),
  description: optionalText(5000),
  details: z.record(z.string(), z.any()).optional().default({}),
});

const nomineeBody = z.object({
  name: z.string().trim().min(2).max(256),
  email: email.optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(32).optional().nullable(),
  relation: z.string().trim().max(64).optional().nullable(),
});

const slugParams = z.object({ universitySlug: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/i) });
const tokenParams = z.object({ token: z.string().min(20).max(4096) });
const guardianResponseBody = z.object({ approve: z.boolean() });

const listRequestsQuery = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const updateRequestBody = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  response: optionalText(10000),
}).refine((b) => b.status !== undefined || b.response !== undefined, 'Nothing to update');

const fulfilRequestBody = z.object({
  response: optionalText(10000),
  force: z.boolean().optional().default(false),
});

const noticeBody = z.object({
  version: z.string().trim().min(1).max(32),
  language: z.string().trim().min(2).max(8).optional().default('en'),
  title: z.string().trim().min(3).max(256),
  content: z.string().trim().min(50).max(100000),
  purposes: z.array(z.object({
    key: purposeKey,
    label: z.string().trim().min(2).max(128),
    description: z.string().trim().max(2000).optional().default(''),
    required: z.boolean(),
  })).min(1).max(30),
});

const breachBody = z.object({
  title: z.string().trim().min(3).max(256),
  description: z.string().trim().min(3).max(20000),
  severity: z.enum(BREACH_SEVERITIES).optional().default('medium'),
  detectedAt: z.coerce.date(),
  affectedCount: z.coerce.number().int().min(0).optional().nullable(),
  dataCategories: z.array(z.string().trim().min(1).max(64)).max(50).optional().default([]),
});

const breachUpdateBody = z.object({
  status: z.enum(BREACH_STATUS_ORDER).optional(),
  remediation: optionalText(20000),
  boardNotifiedAt: z.coerce.date().optional().nullable(),
  affectedCount: z.coerce.number().int().min(0).optional().nullable(),
});

const notifyBody = z.object({ message: z.string().trim().min(20).max(10000) });

const retentionBody = z.object({
  policies: z.array(z.object({
    category: z.enum(Object.keys(RETENTION_CATEGORIES)),
    retentionDays: z.coerce.number().int(),
    action: z.enum(['delete', 'anonymize']).optional(),
  })).min(1).max(20),
});

const contactBody = z.object({
  dpoName: optionalText(256),
  dpoEmail: email.optional().nullable().or(z.literal('')),
  dpoPhone: optionalText(32),
  requireGuardianConsentForMinors: z.boolean().optional(),
});

module.exports = {
  idParams,
  consentBody,
  purposeParams,
  createRequestBody,
  nomineeBody,
  slugParams,
  tokenParams,
  guardianResponseBody,
  listRequestsQuery,
  updateRequestBody,
  fulfilRequestBody,
  noticeBody,
  breachBody,
  breachUpdateBody,
  notifyBody,
  retentionBody,
  contactBody,
};
