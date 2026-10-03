'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Copy, ExternalLink, Globe2, Lock, RefreshCw, Save, X } from 'lucide-react';
import {
  researchProfileService,
  type AuthorProfileSettings,
} from '@/features/research-profile/services/researchProfile.service';
import type { ProfileVisibility } from '@/shared/types/research-profile.types';
import { extractErrorMessage } from '@/shared/types/api.types';

const LEVELS: { value: ProfileVisibility; label: string; description: string; icon: typeof Globe2 }[] = [
  { value: 'public', label: 'Public', description: 'Anyone with the link can view it, no login needed.', icon: Globe2 },
  { value: 'institution', label: 'University only', description: 'Signed-in members of your university.', icon: Building2 },
  { value: 'private', label: 'Private', description: 'Only you and university admins.', icon: Lock },
];

const SECTIONS: { key: keyof AuthorProfileSettings; label: string; hint: string }[] = [
  { key: 'showPhoto', label: 'Profile photo', hint: 'The photo from your account settings' },
  { key: 'showEmail', label: 'Email address', hint: 'Your official email' },
  { key: 'showPhone', label: 'Phone number', hint: 'Off by default' },
  { key: 'showResearchInterests', label: 'Research interests', hint: 'Topics listed on your profile' },
  { key: 'showPublications', label: 'Publications', hint: 'Approved publications and their details' },
  { key: 'showCoAuthors', label: 'Co-author network', hint: 'People you have published with' },
  { key: 'showMetrics', label: 'Citation metrics', hint: 'Citations, h-index and trends' },
];

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-wine' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function ProfilePrivacySettings({
  userId,
  onMessage,
  onSaved,
}: {
  userId: string;
  onMessage: (type: 'success' | 'error', text: string) => void;
  onSaved?: (settings: AuthorProfileSettings) => void;
}) {
  const [saved, setSaved] = useState<AuthorProfileSettings | null>(null);
  const [draft, setDraft] = useState<AuthorProfileSettings | null>(null);
  const [interestInput, setInterestInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    researchProfileService
      .getProfileSettings(userId)
      .then((s) => { if (!cancelled) { setSaved(s); setDraft(s); } })
      .catch((e) => onMessage('error', extractErrorMessage(e)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const publicUrl = saved?.publicPath && typeof window !== 'undefined' ? `${window.location.origin}${saved.publicPath}` : null;

  if (loading || !draft) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-gray-100 dark:bg-gray-700" />)}
      </div>
    );
  }

  const set = <K extends keyof AuthorProfileSettings>(key: K, value: AuthorProfileSettings[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const addInterest = () => {
    const value = interestInput.trim();
    if (!value) return;
    if (!draft.researchInterests.some((i) => i.toLowerCase() === value.toLowerCase()) && draft.researchInterests.length < 15) {
      set('researchInterests', [...draft.researchInterests, value.slice(0, 60)]);
    }
    setInterestInput('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const { publicHandle: _h, publicPath: _p, ...update } = draft;
      const next = await researchProfileService.updateProfileSettings(userId, update);
      setSaved(next);
      setDraft(next);
      onSaved?.(next);
      onMessage(
        'success',
        next.profileVisibility === 'public' ? 'Saved. Your profile is now public at the link below.' : 'Profile settings saved.',
      );
    } catch (e) {
      onMessage('error', extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onMessage('error', 'Could not copy the link. Select it and copy manually.');
    }
  };

  return (
    <div className="space-y-8">
      {/* About */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">About you</h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Shown at the top of your profile.</p>
        <label htmlFor="profile-bio" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">Biography</label>
        <textarea
          id="profile-bio"
          rows={5}
          maxLength={2000}
          value={draft.bio || ''}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="Your research focus, current projects and background."
          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <p className="mt-1 text-right text-xs text-gray-400">{(draft.bio || '').length}/2000</p>

        <label htmlFor="profile-interest" className="mt-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Research interests</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {draft.researchInterests.map((interest) => (
            <span key={interest} className="inline-flex items-center gap-1 rounded-full border border-blush-line bg-blush-light px-3 py-1 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
              {interest}
              <button
                type="button"
                onClick={() => set('researchInterests', draft.researchInterests.filter((i) => i !== interest))}
                className="rounded-full p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                aria-label={`Remove ${interest}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            id="profile-interest"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
            placeholder="Add a topic and press Enter"
            maxLength={60}
            disabled={draft.researchInterests.length >= 15}
            className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button type="button" onClick={addInterest} className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            Add
          </button>
        </div>
        {draft.researchInterests.length === 0 && (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Until you add some, the keywords from your publications are shown instead.</p>
        )}
      </section>

      {/* Who can see it */}
      <section className="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Who can see your profile</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Profile visibility">
          {LEVELS.map((level) => {
            const active = draft.profileVisibility === level.value;
            return (
              <button
                key={level.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set('profileVisibility', level.value)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  active ? 'border-wine bg-wine/5 dark:bg-wine/20' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <level.icon className={`h-5 w-5 ${active ? 'text-wine dark:text-wine-200' : 'text-gray-400'}`} />
                  {active && <Check className="h-4 w-4 text-wine dark:text-wine-200" />}
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{level.label}</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{level.description}</div>
              </button>
            );
          })}
        </div>

        {saved?.profileVisibility === 'public' && publicUrl && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Your public profile link</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} className="h-9 flex-1 rounded-lg border border-emerald-200 bg-white px-3 font-mono text-xs text-gray-800 dark:border-emerald-800 dark:bg-gray-900 dark:text-gray-100" />
              <div className="flex gap-2">
                <button type="button" onClick={copyLink} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a href={saved.publicPath || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </div>
            </div>
          </div>
        )}
        {draft.profileVisibility === 'public' && saved?.profileVisibility !== 'public' && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Save to publish. Your shareable link appears here once the profile is public.</p>
        )}
      </section>

      {/* What they see */}
      <section className="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">What others can see</h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Applies to everyone except you and university admins. Your name, designation and department are always shown to people who can open the profile.
        </p>
        <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {SECTIONS.map((section) => (
            <li key={section.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{section.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{section.hint}</div>
              </div>
              <Toggle
                label={section.label}
                checked={Boolean(draft[section.key])}
                onChange={(v) => set(section.key, v as never)}
                disabled={draft.profileVisibility === 'private'}
              />
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Allow search engines</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Let Google and others list your public profile. Only applies when it is public.</div>
            </div>
            <Toggle
              label="Allow search engines"
              checked={draft.allowSearchIndexing}
              onChange={(v) => set('allowSearchIndexing', v)}
              disabled={draft.profileVisibility !== 'public'}
            />
          </li>
        </ul>
      </section>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        {dirty && <span className="mr-auto text-sm text-amber-700 dark:text-amber-300">Unsaved changes</span>}
        <button
          type="button"
          onClick={() => saved && setDraft(saved)}
          disabled={!dirty || saving}
          className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-wine px-4 text-sm font-medium text-wine-fg hover:bg-wine-dark disabled:opacity-40"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
