/**
 * Incentive & points preview for the submission form.
 *
 * The browser never computes shares itself: it sends the in-progress submission to
 * POST /research/incentive-preview, which runs the same computation that stores the
 * shares on save and credits them at DRD approval.
 */

export interface IncentivePreviewAuthorInput {
  name?: string | null;
  authorType?: string | null;
  authorRole?: string | null;
  registrationNumber?: string | null;
  affiliation?: string | null;
  orderNumber?: number | null;
  authorPosition?: number | null;
  isCorresponding?: boolean | null;
}

export interface IncentivePreviewPayload {
  publicationType: string;
  publicationDate?: string | null;
  indexingCategories?: string[] | null;
  quartile?: string | null;
  sjr?: number | null;
  impactFactor?: number | null;
  naasRating?: number | null;
  bookPublicationType?: string | null;
  bookIndexingType?: string | null;
  nationalInternational?: string | null;
  conferenceSubType?: string | null;
  proceedingsQuartile?: string | null;
  conferenceType?: string | null;
  conferenceHeldLocation?: string | null;
  conferenceBestPaperAward?: string | boolean | null;
  authors: IncentivePreviewAuthorInput[];
}

export interface IncentivePreviewAuthor {
  index: number;
  name: string | null;
  role: string;
  isInternal: boolean;
  isStudent: boolean;
  position: number | null;
  incentive: number;
  points: number;
}

export interface IncentivePreviewWarning {
  code: string;
  message: string;
  authorIndexes?: number[];
}

export interface IncentivePreview {
  publicationType: string;
  policy: {
    found: boolean;
    usedDefault: boolean;
    id: string | null;
    name: string | null;
    distributionMethod: string | null;
    description: string | null;
    reason: string | null;
  };
  pool: { amount: number; points: number };
  totals: { amount: number; points: number; unallocatedAmount: number; unallocatedPoints: number };
  authors: IncentivePreviewAuthor[];
  warnings: IncentivePreviewWarning[];
}

const PAYLOAD_FIELDS = [
  'publicationType', 'publicationDate', 'indexingCategories', 'quartile', 'sjr', 'impactFactor', 'naasRating',
  'bookPublicationType', 'bookIndexingType', 'nationalInternational',
  'conferenceSubType', 'proceedingsQuartile', 'conferenceType', 'conferenceHeldLocation', 'conferenceBestPaperAward',
] as const;

const AUTHOR_FIELDS = [
  'name', 'authorType', 'authorRole', 'registrationNumber', 'affiliation', 'orderNumber', 'authorPosition', 'isCorresponding',
] as const;

const pick = <K extends string>(source: Record<string, unknown>, keys: readonly K[]) =>
  Object.fromEntries(keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]])) as Record<K, unknown>;

/**
 * The fields of the form's submit payload that decide the incentive, so the preview request
 * is exactly what saving would send (and stays small and stable as a query key).
 */
export function toIncentivePreviewPayload(submitData: Record<string, unknown>): IncentivePreviewPayload {
  const authors = Array.isArray(submitData.authors) ? (submitData.authors as Record<string, unknown>[]) : [];
  return {
    ...(pick(submitData, PAYLOAD_FIELDS) as Omit<IncentivePreviewPayload, 'authors'>),
    authors: authors.map((a) => pick(a, AUTHOR_FIELDS) as IncentivePreviewAuthorInput),
  };
}

/** "Research Paper Policy 2026 · role-based: first 35% · corresponding 30% · co-authors share 35%" */
export function incentivePolicyLabel(preview: IncentivePreview | undefined | null): string | null {
  if (!preview?.policy?.found) return null;
  const { name, description, usedDefault } = preview.policy;
  const parts = [name, description].filter(Boolean);
  if (!parts.length) return null;
  return `${parts.join(' · ')}${usedDefault ? ' (built-in default)' : ''}`;
}

export const formatRupees = (amount: number) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
