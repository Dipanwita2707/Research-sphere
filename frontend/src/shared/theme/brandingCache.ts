/**
 * Last applied university theme, kept in localStorage so the next page load can paint
 * the right colours before React hydrates (see BRANDING_BOOT_SCRIPT). Every access is
 * wrapped in try/catch: storage may be unavailable (private mode, blocked site data).
 */

export const BRANDING_CACHE_KEY = 'rs-branding-v1';

export interface BrandingCache {
  v: 1;
  /** Signed-in user the theme belongs to; ignored for anyone else on this browser. */
  userId: string;
  /** CSS from themeCss() (light vars on :root[data-brand], dark on :root[data-brand].dark); '' for the default theme */
  css: string;
  /** Re-tint brand artwork (anything but the default theme). */
  tint: boolean;
  faviconUrl: string | null;
  shortName: string | null;
  /** Branding payload, so the header/hero render the right name and logo immediately. */
  branding?: import('./theme').Branding;
}

/**
 * Routes that always show the default ResearchSphere theme: the platform's own pages
 * (landing, marketing, login/password flows, superadmin) and public profile pages, which
 * render the profile owner's university theme server-side instead.
 */
export const DEFAULT_THEME_ROUTE_SOURCE =
  '^/($|login|forgot-password|reset-password|superadmin|p/|about-us|contact|pricing|resources|guardian-consent|privacy)';

export function isDefaultThemeRoute(pathname: string | null | undefined): boolean {
  return new RegExp(DEFAULT_THEME_ROUTE_SOURCE).test(pathname || '/');
}

export function readBrandingCache(): BrandingCache | null {
  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === 1 && typeof parsed.css === 'string' ? (parsed as BrandingCache) : null;
  } catch {
    return null;
  }
}

export function writeBrandingCache(value: BrandingCache | null): void {
  try {
    if (value) window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(BRANDING_CACHE_KEY);
  } catch {
    // storage unavailable: the theme still applies once /branding/me loads
  }
}

/**
 * Inline <head> script, run before first paint. Applies the saved dark-mode choice and,
 * on tenant routes, the cached university theme of the user who is signed in on this
 * browser. Self-contained ES5; never throws.
 */
export const BRANDING_BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,ls=window.localStorage;
try{if(ls.getItem('theme')==='dark'){d.classList.add('dark');}}catch(e){}
if(new RegExp(${JSON.stringify(DEFAULT_THEME_ROUTE_SOURCE)}).test(location.pathname))return;
var c=JSON.parse(ls.getItem(${JSON.stringify(BRANDING_CACHE_KEY)})||'null');
if(!c||c.v!==1||typeof c.css!=='string')return;
var a=JSON.parse(ls.getItem('auth-storage')||'null');
var u=a&&a.state&&a.state.user;
if(!u||u.id!==c.userId)return;
if(c.css){var s=document.createElement('style');s.id='rs-brand-theme';s.textContent=c.css;
document.head.appendChild(s);
d.setAttribute('data-brand','');
if(c.tint)d.setAttribute('data-brand-tint','');}
if(c.faviconUrl){var l=document.createElement('link');l.rel='icon';l.id='rs-brand-favicon';l.href=c.faviconUrl;document.head.appendChild(l);}
}catch(e){}})();`;
