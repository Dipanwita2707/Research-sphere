'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Copy, ExternalLink, Eye, FileText, Globe2, Lock, Plus, RefreshCw, Save, UserRound, X } from 'lucide-react';
import {
  researchProfileService,
  type AuthorProfileSettings,
} from '@/features/research-profile/services/researchProfile.service';
import type { ProfileVisibility } from '@/shared/types/research-profile.types';
import { extractErrorMessage } from '@/shared/types/api.types';
import CvDetailsEditor from './CvDetailsEditor';
import { CardHeader, Toggle, panel } from './manageUi';

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
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/70 dark:bg-gray-800" />)}
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
    <div className="space-y-6 pb-2">
      {/* About */}
      <section className={panel.card}>
        <CardHeader icon={UserRound} title="About you" subtitle="Shown at the top of your profile." />
        <div className={`${panel.body} space-y-5`}>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="profile-bio" className={panel.label}>Biography</label>
              <span className="text-xs tabular-nums text-ink-subtle">{(draft.bio || '').length}/2000</span>
            </div>
            <textarea
              id="profile-bio"
              rows={5}
              maxLength={2000}
              value={draft.bio || ''}
              onChange={(e) => set('bio', e.target.value)}
              placeholder="Your research focus, current projects and background."
              className={`${panel.textarea} mt-1.5`}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="profile-interest" className={panel.label}>Research interests</label>
              <span className="text-xs tabular-nums text-ink-subtle">{draft.researchInterests.length}/15</span>
            </div>
            <div className="mt-1.5 flex gap-2">
              <input
                id="profile-interest"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
                placeholder={draft.researchInterests.length >= 15 ? 'Limit reached' : 'Add a topic and press Enter'}
                maxLength={60}
                disabled={draft.researchInterests.length >= 15}
                className={`${panel.input} flex-1`}
              />
              <button type="button" onClick={addInterest} disabled={!interestInput.trim()} className={panel.btnSecondary}>
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
            {draft.researchInterests.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.researchInterests.map((interest) => (
                  <span key={interest} className="inline-flex items-center gap-1 rounded-full border border-blush-line bg-blush-light py-1 pl-3 pr-1.5 text-sm text-ink dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                    {interest}
                    <button
                      type="button"
                      onClick={() => set('researchInterests', draft.researchInterests.filter((i) => i !== interest))}
                      className="rounded-full p-0.5 text-ink-subtle hover:bg-white hover:text-ink dark:hover:bg-gray-600 dark:hover:text-white"
                      aria-label={`Remove ${interest}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-muted dark:text-gray-400">Until you add some, the keywords from your publications are shown instead.</p>
            )}
          </div>
        </div>
      </section>

      {/* Who can see it */}
      <section className={panel.card}>
        <CardHeader icon={Globe2} title="Who can see your profile" />
        <div className={panel.body}>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Profile visibility">
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
                    active ? 'border-wine bg-wine/5 dark:bg-wine/20' : 'border-blush-line hover:border-wine/30 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-wine text-wine-fg' : 'bg-blush text-ink-muted dark:bg-gray-700 dark:text-gray-400'}`}>
                      <level.icon className="h-4 w-4" />
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${active ? 'border-wine bg-wine' : 'border-blush-line dark:border-gray-600'}`}>
                      {active && <Check className="h-3 w-3 text-wine-fg" />}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-ink dark:text-white">{level.label}</div>
                  <div className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">{level.description}</div>
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
        </div>
      </section>

      {/* What they see */}
      <section className={panel.card}>
        <CardHeader
          icon={Eye}
          title="What others can see"
          subtitle="Applies to everyone except you and university admins. Your name, designation and department are always shown to people who can open the profile."
        />
        {draft.profileVisibility === 'private' && (
          <p className="border-b border-blush-line/70 bg-blush-light/60 px-5 py-2.5 text-xs text-ink-muted sm:px-6 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
            Your profile is private, so these switches have no effect until you make it visible.
          </p>
        )}
        <ul className="divide-y divide-blush-line/70 dark:divide-gray-700">
          {SECTIONS.map((section) => (
            <li key={section.key} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
              <div>
                <div className="text-sm font-medium text-ink dark:text-white">{section.label}</div>
                <div className="text-xs text-ink-muted dark:text-gray-400">{section.hint}</div>
              </div>
              <Toggle
                label={section.label}
                checked={Boolean(draft[section.key])}
                onChange={(v) => set(section.key, v as never)}
                disabled={draft.profileVisibility === 'private'}
              />
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
            <div>
              <div className="text-sm font-medium text-ink dark:text-white">Allow search engines</div>
              <div className="text-xs text-ink-muted dark:text-gray-400">Let Google and others list your public profile. Only applies when it is public.</div>
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

      {/* Research CV */}
      <section className={panel.card}>
        <CardHeader
          icon={FileText}
          title="Research CV details"
          subtitle={<>Used by <strong className="font-semibold text-ink dark:text-gray-200">Download CV</strong> on your profile (one page). Publications, grants, patents and citation metrics are added automatically; fill in what the system cannot know.</>}
        />
        <div className={panel.body}>
          <CvDetailsEditor value={draft.cvDetails || {}} onChange={(v) => set('cvDetails', v)} />
        </div>
      </section>

      <div
        className={`sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur transition-colors sm:px-5 ${
          dirty
            ? 'border-amber-300 bg-white/95 dark:border-amber-700 dark:bg-gray-800/95'
            : 'border-blush-line bg-white/90 dark:border-gray-700 dark:bg-gray-800/90'
        }`}
      >
        <span className={`mr-auto text-sm ${dirty ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-ink-muted dark:text-gray-400'}`}>
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </span>
        <button
          type="button"
          onClick={() => saved && setDraft(saved)}
          disabled={!dirty || saving}
          className={panel.btnSecondary}
        >
          Discard
        </button>
        <button type="button" onClick={save} disabled={!dirty || saving} className={panel.btnPrimary}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
