import api from '@/shared/api/api';
import type { Branding } from '@/shared/theme/theme';

/** Editable branding values as stored (null = not set / default). */
export interface BrandingValues {
  displayName: string | null;
  shortName: string | null;
  tagline: string | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  primaryColor: string | null;
  accentColor: string | null;
}

export interface BrandingEditorData {
  branding: Branding;
  values: BrandingValues;
}

export type BrandAssetVariant = 'light' | 'dark' | 'favicon';

/** Endpoints behind one editor: the superadmin (any university) or the tenant admin (own). */
export interface BrandingApi {
  get(): Promise<BrandingEditorData>;
  update(values: Partial<BrandingValues>): Promise<BrandingEditorData>;
  reset(): Promise<BrandingEditorData>;
  upload(variant: BrandAssetVariant, file: File): Promise<BrandingEditorData>;
  remove(variant: BrandAssetVariant): Promise<BrandingEditorData>;
}

const unwrap = (res: { data: { data: BrandingEditorData } }) => res.data.data;

function makeApi(base: string): BrandingApi {
  return {
    get: async () => unwrap(await api.get(base)),
    update: async (values) => unwrap(await api.put(base, values)),
    reset: async () => unwrap(await api.post(`${base}/reset`)),
    upload: async (variant, file) => {
      const form = new FormData();
      form.append('file', file);
      return unwrap(await api.post(`${base}/assets/${variant}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
    },
    remove: async (variant) => unwrap(await api.delete(`${base}/assets/${variant}`)),
  };
}

/** Superadmin editing university `id` (platform portal). */
export const superadminBrandingApi = (universityId: string): BrandingApi =>
  makeApi(`/superadmin/universities/${encodeURIComponent(universityId)}/branding`);

/** Tenant admin editing their own university. */
export const tenantAdminBrandingApi: BrandingApi = makeApi('/branding/admin');

export const BRAND_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';
export const BRAND_IMAGE_MAX_BYTES = 1024 * 1024;

/** Client-side pre-check (the server re-validates and re-encodes every image). */
export function checkBrandImage(file: File): string | null {
  if (!/\.(png|jpe?g|webp|svg)$/i.test(file.name)) return 'Use a PNG, JPG, WebP or SVG image.';
  if (file.size > BRAND_IMAGE_MAX_BYTES) return 'The image must be 1 MB or smaller.';
  return null;
}
