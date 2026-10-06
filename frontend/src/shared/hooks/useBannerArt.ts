'use client';

import { useState } from 'react';
import defaultArt from '@/assets/hero-art.jpg';
import { useBranding } from '@/shared/providers/BrandingProvider';

const DEFAULT_SRC = typeof defaultArt === 'string' ? defaultArt : defaultArt.src;

/**
 * Banner illustration for the research profile and My Work pages: the university's own image
 * (Branding & theme → Profile banner image) when one is uploaded, otherwise the built-in art.
 * If the uploaded image fails to load the built-in art is used; if that fails too, `src` is null
 * and the page shows no image.
 */
export function useBannerArt(): { src: string | null; onError: () => void } {
  const { branding } = useBranding();
  const [failed, setFailed] = useState<string[]>([]);
  const src = [branding?.heroImageUrl, DEFAULT_SRC].find((s): s is string => Boolean(s) && !failed.includes(s as string)) ?? null;
  return { src, onError: () => { if (src) setFailed((f) => [...f, src]); } };
}
