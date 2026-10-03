'use client';

/**
 * "Branding & theme" editor: university name, logos, theme preset, custom colours and
 * dashboard hero text, with a live light/dark preview.
 *
 * - mode "edit": loads and saves through a BrandingApi (superadmin or tenant admin).
 * - mode "create": no university exists yet; the parent reads values + chosen images via
 *   onDraftChange and saves them after provisioning (see uploadDraftImages).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, Palette, RotateCcw, Trash2, Upload } from 'lucide-react';
import BrandPreview from '@/features/branding/components/BrandPreview';
import {
  BRAND_IMAGE_ACCEPT,
  checkBrandImage,
  type BrandAssetVariant,
  type BrandingApi,
  type BrandingEditorData,
  type BrandingValues,
} from '@/features/branding/services/branding.service';
import { isHexColor } from '@/shared/theme/color';
import { PRESETS, THEME_PRESET_KEYS, DEFAULT_PRESET } from '@/shared/theme/presets';
import { buildTheme } from '@/shared/theme/theme';

export const EMPTY_BRANDING_VALUES: BrandingValues = {
  displayName: null,
  shortName: null,
  tagline: null,
  heroHeading: null,
  heroSubheading: null,
  themePreset: DEFAULT_PRESET,
  primaryColor: null,
  accentColor: null,
};

export interface BrandingDraft {
  values: BrandingValues;
  files: Partial<Record<BrandAssetVariant, File>>;
}

type Props =
  | { mode: 'edit'; api: BrandingApi; legalName: string; onSaved?: (data: BrandingEditorData) => void; title?: string }
  | { mode: 'create'; legalName: string; onDraftChange: (draft: BrandingDraft) => void; title?: string };

const ASSETS: { variant: BrandAssetVariant; label: string; hint: string }[] = [
  { variant: 'light', label: 'Logo', hint: 'Shown in the header on light backgrounds. Wide logos work best.' },
  { variant: 'dark', label: 'Dark-mode logo (optional)', hint: 'Used in dark mode. Falls back to the main logo.' },
  { variant: 'favicon', label: 'Favicon (optional)', hint: 'Square icon for the browser tab.' },
];

const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-wine focus:ring-2 focus:ring-wine/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400';

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Upload the images chosen while creating a university, once it exists. */
export async function uploadDraftImages(api: BrandingApi, draft: BrandingDraft): Promise<string[]> {
  const failures: string[] = [];
  for (const [variant, file] of Object.entries(draft.files) as [BrandAssetVariant, File][]) {
    try {
      await api.upload(variant, file);
    } catch (err: any) {
      failures.push(`${variant} logo: ${err?.response?.data?.message || 'upload failed'}`);
    }
  }
  return failures;
}

function ColorField({ id, label: text, value, fallback, onChange }: { id: string; label: string; value: string | null; fallback: string; onChange: (v: string | null) => void }) {
  const [textValue, setTextValue] = useState(value ?? '');
  // Follow the picker / preset reset (derived state, updated during render)
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setTextValue(value ?? '');
  }
  const invalid = textValue.trim() !== '' && !isHexColor(textValue.trim().startsWith('#') ? textValue.trim() : `#${textValue.trim()}`);
  return (
    <div>
      <label htmlFor={id} className={label}>{text}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${text} picker`}
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          id={id}
          type="text"
          inputMode="text"
          placeholder={`Preset (${fallback})`}
          value={textValue}
          onChange={(e) => {
            const raw = e.target.value;
            setTextValue(raw);
            const hex = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
            if (raw.trim() === '') onChange(null);
            else if (isHexColor(hex)) onChange(hex.toUpperCase());
          }}
          aria-invalid={invalid}
          className={`${input} font-mono ${invalid ? '!border-red-400' : ''}`}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className="whitespace-nowrap text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            Use preset
          </button>
        )}
      </div>
      {invalid && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Enter a hex colour like #1D4ED8.</p>}
    </div>
  );
}

export default function BrandingEditor(props: Props) {
  const { legalName } = props;
  const [values, setValues] = useState<BrandingValues>(EMPTY_BRANDING_VALUES);
  const [saved, setSaved] = useState<BrandingValues>(EMPTY_BRANDING_VALUES);
  const [images, setImages] = useState<Partial<Record<BrandAssetVariant, string | null>>>({});
  const [files, setFiles] = useState<Partial<Record<BrandAssetVariant, File>>>({});
  const [loading, setLoading] = useState(props.mode === 'edit');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const objectUrls = useRef<string[]>([]);

  const editApi = props.mode === 'edit' ? props.api : null;

  const applyData = (data: BrandingEditorData) => {
    setValues(data.values);
    setSaved(data.values);
    setImages({ light: data.branding.logoUrl, dark: data.branding.logoDarkUrl, favicon: data.branding.faviconUrl });
  };

  useEffect(() => {
    if (!editApi) return;
    let alive = true;
    editApi
      .get()
      .then((data) => alive && applyData(data))
      .catch(() => alive && setMessage({ kind: 'error', text: 'Could not load branding.' }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [editApi]);

  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const onDraftChange = props.mode === 'create' ? props.onDraftChange : null;
  useEffect(() => {
    onDraftChange?.({ values, files });
  }, [values, files, onDraftChange]);

  const theme = useMemo(() => buildTheme(values), [values]);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const set = <K extends keyof BrandingValues>(key: K, v: BrandingValues[K]) => setValues((prev) => ({ ...prev, [key]: v }));

  const previewBrand = {
    displayName: clean(values.displayName) || legalName || 'Your University',
    shortName: clean(values.shortName),
    tagline: clean(values.tagline),
    heroHeading: clean(values.heroHeading),
    heroSubheading: clean(values.heroSubheading),
    logoUrl: images.light ?? null,
    logoDarkUrl: images.dark ?? null,
  };

  const run = async (key: string, fn: () => Promise<BrandingEditorData>, ok: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const data = await fn();
      applyData(data);
      setMessage({ kind: 'ok', text: ok });
      if (props.mode === 'edit') props.onSaved?.(data);
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.response?.data?.message || 'Saving branding failed.' });
    } finally {
      setBusy(null);
    }
  };

  const pickFile = (variant: BrandAssetVariant, file: File | undefined) => {
    if (!file) return;
    const problem = checkBrandImage(file);
    if (problem) {
      setMessage({ kind: 'error', text: problem });
      return;
    }
    if (editApi) {
      run(`upload-${variant}`, () => editApi.upload(variant, file), 'Image uploaded.');
    } else {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      setFiles((f) => ({ ...f, [variant]: file }));
      setImages((i) => ({ ...i, [variant]: url }));
    }
  };

  const removeFile = (variant: BrandAssetVariant) => {
    if (editApi) {
      run(`remove-${variant}`, () => editApi.remove(variant), 'Image removed.');
    } else {
      setFiles(({ [variant]: _drop, ...rest }) => rest);
      setImages((i) => ({ ...i, [variant]: null }));
    }
  };

  const save = () => {
    if (!editApi) return;
    run('save', () => editApi.update(values), 'Branding saved. Users see it on their next page load.');
  };

  const reset = () => {
    if (!editApi) {
      setValues(EMPTY_BRANDING_VALUES);
      setFiles({});
      setImages({});
      return;
    }
    if (!window.confirm('Reset branding to the default ResearchSphere theme? This removes the logos, colours and custom text.')) return;
    run('reset', () => editApi.reset(), 'Branding reset to the default theme.');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading branding…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8" aria-labelledby="branding-title" data-testid="branding-editor">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-wine/10">
            <Palette className="h-4 w-4 text-wine" />
          </div>
          <div>
            <h3 id="branding-title" className="text-lg font-bold text-gray-900 dark:text-white">{props.title || 'Branding & theme'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Name, logo and colours the university&apos;s users see across the whole app.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Reset to default
        </button>
      </div>

      <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6">
          {/* Names */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="brand-display-name" className={label}>University name (as displayed)</label>
              <input id="brand-display-name" className={input} placeholder={legalName || 'e.g. Example University'} value={values.displayName ?? ''} onChange={(e) => set('displayName', e.target.value || null)} maxLength={256} />
            </div>
            <div>
              <label htmlFor="brand-short-name" className={label}>Short name</label>
              <input id="brand-short-name" className={input} placeholder="e.g. EU" value={values.shortName ?? ''} onChange={(e) => set('shortName', e.target.value || null)} maxLength={32} />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Shown in the browser tab and on small screens.</p>
            </div>
            <div>
              <label htmlFor="brand-tagline" className={label}>Tagline (optional)</label>
              <input id="brand-tagline" className={input} placeholder="e.g. Excellence in research" value={values.tagline ?? ''} onChange={(e) => set('tagline', e.target.value || null)} maxLength={160} />
            </div>
          </div>

          {/* Logos */}
          <div>
            <p className={label}>Logos</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {ASSETS.map(({ variant, label: text, hint }) => {
                const url = images[variant];
                return (
                  <div key={variant} className="flex flex-col rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{text}</p>
                    <div className={`mt-2 flex h-20 items-center justify-center rounded-lg ${variant === 'dark' ? 'bg-gray-900' : 'bg-gray-50 dark:bg-gray-900'} border border-dashed border-gray-200 dark:border-gray-700`}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local preview or branding API image
                        <img src={url} alt={`${text} preview`} className={`${variant === 'favicon' ? 'h-10 w-10' : 'max-h-16 max-w-full'} object-contain`} />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                      )}
                    </div>
                    <p className="mt-2 flex-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{hint}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-wine px-2.5 py-1.5 text-xs font-semibold text-wine-fg hover:bg-wine-dark">
                        {busy === `upload-${variant}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {url ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept={BRAND_IMAGE_ACCEPT}
                          className="sr-only"
                          aria-label={`Upload ${text}`}
                          onChange={(e) => {
                            pickFile(variant, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {url && (
                        <button type="button" onClick={() => removeFile(variant)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400" aria-label={`Remove ${text}`}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">PNG, JPG, WebP or SVG, up to 1 MB. Images are re-encoded to PNG; SVGs are converted to PNG.</p>
          </div>

          {/* Presets */}
          <div>
            <p className={label} id="preset-label">Theme</p>
            <div role="radiogroup" aria-labelledby="preset-label" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {THEME_PRESET_KEYS.map((key) => {
                const p = PRESETS[key];
                const selected = values.themePreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set('themePreset', key)}
                    className={`rounded-xl border p-2.5 text-left transition ${selected ? 'border-wine ring-2 ring-wine/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}`}
                  >
                    <span className="flex h-9 overflow-hidden rounded-lg" aria-hidden="true">
                      <span className="flex-[3]" style={{ background: p.light.primary }} />
                      <span className="flex-1" style={{ background: p.light.accent }} />
                      <span className="flex-1" style={{ background: p.light.canvasDeep }} />
                      <span className="flex-1" style={{ background: p.dark.primaryText }} />
                    </span>
                    <span className="mt-1.5 block text-xs font-semibold text-gray-800 dark:text-gray-100">{p.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{PRESETS[theme.preset].description}</p>
          </div>

          {/* Custom colours */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="brand-primary" label="Custom primary colour" value={values.primaryColor} fallback={PRESETS[theme.preset].light.primary} onChange={(v) => set('primaryColor', v)} />
            <ColorField id="brand-accent" label="Custom accent colour" value={values.accentColor} fallback={PRESETS[theme.preset].light.accent} onChange={(v) => set('accentColor', v)} />
          </div>
          {theme.warnings.length > 0 && (
            <div role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              {theme.warnings.map((w) => (
                <p key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{w}</p>
              ))}
            </div>
          )}
          <details className="text-xs text-gray-600 dark:text-gray-300">
            <summary className="cursor-pointer font-semibold">Contrast checks (WCAG AA ≥ 4.5:1)</summary>
            <table className="mt-2 w-full text-left">
              <tbody>
                {theme.checks.map((c) => (
                  <tr key={`${c.mode}-${c.label}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1 pr-2 capitalize">{c.mode}</td>
                    <td className="py-1 pr-2">{c.label}</td>
                    <td className="py-1 pr-2 tabular-nums">{c.ratio.toFixed(2)}:1</td>
                    <td className={`py-1 font-semibold ${c.pass ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{c.pass ? 'Pass' : 'Fail'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {/* Hero text */}
          <div className="grid gap-4">
            <div>
              <label htmlFor="brand-hero-heading" className={label}>Dashboard heading (optional)</label>
              <input id="brand-hero-heading" className={input} placeholder="Where Ideas Become Impact" value={values.heroHeading ?? ''} onChange={(e) => set('heroHeading', e.target.value || null)} maxLength={120} />
            </div>
            <div>
              <label htmlFor="brand-hero-sub" className={label}>Dashboard subheading (optional)</label>
              <textarea id="brand-hero-sub" rows={2} className={input} placeholder="A sentence under the heading on the home dashboard" value={values.heroSubheading ?? ''} onChange={(e) => set('heroSubheading', e.target.value || null)} maxLength={280} />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className={label}>Live preview</p>
          <div className="2xl:sticky 2xl:top-28">
            <BrandPreview theme={theme} brand={previewBrand} />
          </div>
        </div>
      </div>

      {message && (
        <p role="status" className={`mt-6 flex items-center gap-2 text-sm ${message.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </p>
      )}

      {props.mode === 'edit' && (
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setValues(saved)}
            disabled={!dirty || busy !== null}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-wine px-5 py-2 text-sm font-semibold text-wine-fg shadow-sm hover:bg-wine-dark disabled:opacity-50"
          >
            {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
            Save branding
          </button>
        </div>
      )}
    </section>
  );
}
