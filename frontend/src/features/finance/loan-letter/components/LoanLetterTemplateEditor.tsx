'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Save, Upload, X, CheckCircle, AlertCircle, Eye, Plus, Trash2,
  Building2, CreditCard, FileText, User, Code2, RotateCcw,
  ChevronDown, ChevronRight, Layers, FileUp, ImageIcon, History,
} from 'lucide-react';
import LoanLetterTemplateAuditLog from './LoanLetterTemplateAuditLog';
import { useLoanLetterTemplate } from '../hooks/useLoanLetterTemplate';
import { LoanLetterTemplate, LoanLetterBankDetails } from '../services/loanLetterTemplate.service';
import {
  PLACEHOLDER_GROUPS,
  DEFAULT_TEMPLATE_BODY,
  renderTemplatePreview,
} from '../utils/templateRenderer';
import { getFileUrl } from '@/shared/api/api';
import type ReactQuill from 'react-quill';

const DocumentBodyEditor = dynamic(
  () => import('./DocumentBodyEditor'),
  { ssr: false, loading: () => <div className="h-[540px] bg-gray-50 rounded-lg animate-pulse" /> },
);

type EditorTab = 'document' | 'images' | 'institution' | 'bank' | 'notes' | 'preview' | 'audit';

interface Props {
  onTemplateSaved?: (template: LoanLetterTemplate) => void;
}

export default function LoanLetterTemplateEditor({ onTemplateSaved }: Props) {
  const { template, loading, saving, uploading, error, saveSuccess, saveTemplate, uploadHeaderImage, uploadWatermarkImage } = useLoanLetterTemplate();
  const [tab, setTab] = useState<EditorTab>('document');
  const [draft, setDraft] = useState<LoanLetterTemplate | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [docBody, setDocBody] = useState<string>('');
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Student: true });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill | null>(null);

  useEffect(() => {
    if (template) {
      setDraft(template);
      setDocBody(template.templateBody || DEFAULT_TEMPLATE_BODY);
    }
  }, [template]);

  // Must be declared before any early returns to satisfy Rules of Hooks
  const insertPlaceholder = useCallback((key: string, isSpecial?: boolean) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    const index = range?.index ?? quill.getLength() - 1;
    const cls = isSpecial ? 'll-ph ll-ph-special' : 'll-ph';
    quill.clipboard.dangerouslyPasteHTML(index, `<span class="${cls}">{{${key}}}</span>`);
    quill.setSelection(index + 1, 0);
  }, []);

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
        <span className="animate-spin mr-2 w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full" />
        Loading template&#x2026;
      </div>
    );
  }

  function set<K extends keyof LoanLetterTemplate>(key: K, value: LoanLetterTemplate[K]) {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  }
  function setBank<K extends keyof LoanLetterBankDetails>(key: K, value: string) {
    setDraft(prev => prev ? { ...prev, bankDetails: { ...prev.bankDetails, [key]: value } } : prev);
  }
  function setNote(index: number, value: string) {
    setDraft(prev => {
      if (!prev) return prev;
      const notes = [...prev.footerNotes];
      notes[index] = value;
      return { ...prev, footerNotes: notes };
    });
  }
  function addNote() {
    setDraft(prev => prev ? { ...prev, footerNotes: [...prev.footerNotes, ''] } : prev);
  }
  function removeNote(index: number) {
    setDraft(prev => prev ? { ...prev, footerNotes: prev.footerNotes.filter((_, i) => i !== index) } : prev);
  }

  async function handleSave() {
    if (!draft) return;
    setSaveError(null);
    try {
      const { id, updatedAt, ...payload } = draft;
      void id; void updatedAt;
      const finalPayload = {
        ...payload,
        templateBody: docBody || null,
        headerImageWidth: draft.headerImageWidth ?? 100,
        watermarkImageUrl: draft.watermarkImageUrl ?? null,
        watermarkOpacity: draft.watermarkOpacity ?? 20,
        watermarkWidth: draft.watermarkWidth ?? 30,
      };
      await saveTemplate(finalPayload);
      onTemplateSaved?.({ ...draft, templateBody: docBody || null });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save template');
    }
  }

  async function handleImageFile(file: File | null) {
    if (!file) return;
    try {
      const url = await uploadHeaderImage(file);
      setDraft(prev => prev ? { ...prev, headerImageUrl: url } : prev);
    } catch { /* shown by hook */ }
  }
  function removeHeaderImage() {
    setDraft(prev => prev ? { ...prev, headerImageUrl: null } : prev);
  }

  async function handleWatermarkFile(file: File | null) {
    if (!file) return;
    try {
      const url = await uploadWatermarkImage(file);
      setDraft(prev => prev ? { ...prev, watermarkImageUrl: url } : prev);
    } catch { /* shown by hook */ }
  }
  function removeWatermarkImage() {
    setDraft(prev => prev ? { ...prev, watermarkImageUrl: null } : prev);
  }

  async function handleDocxFile(file: File | null) {
    if (!file) return;
    setDocxError(null);
    if (!file.name.match(/\.docx$/i)) {
      setDocxError('Only .docx files are supported for import.');
      return;
    }
    setDocxLoading(true);
    try {
      const formData = new FormData();
      formData.append('docx', file);
      // Read auth token from localStorage (same mechanism as axios interceptor)
      let authHeader: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
          const token = parsed?.state?.token;
          if (token) authHeader = { Authorization: `Bearer ${token}` };
        }
      } catch (_) { /* ignore */ }
      const res = await fetch('/api/v1/finance/loan-letters/template/import-docx', {
        method: 'POST',
        body: formData,
        headers: authHeader,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to parse DOCX file.');
      }
      if (json.data?.html) {
        setDocBody(json.data.html);
      } else {
        setDocxError('The document appears to be empty after conversion.');
      }
    } catch (err) {
      console.error('[DOCX import]', err);
      setDocxError(err instanceof Error ? `Import failed: ${err.message}` : 'Failed to parse DOCX file.');
    } finally {
      setDocxLoading(false);
      if (docxInputRef.current) docxInputRef.current.value = '';
    }
  }

  function toggleGroup(category: string) {
    setOpenGroups(prev => ({ ...prev, [category]: !prev[category] }));
  }

  const COLOR_MAP: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';

  const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'document',    label: 'Document Body',     icon: <Layers className="w-4 h-4" /> },
    { id: 'images',      label: 'Images',            icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'institution', label: 'Institution',       icon: <Building2 className="w-4 h-4" /> },
    { id: 'bank',        label: 'Bank Details',      icon: <CreditCard className="w-4 h-4" /> },
    { id: 'notes',       label: 'Notes & Signatory', icon: <FileText className="w-4 h-4" /> },
    { id: 'preview',     label: 'Preview',           icon: <Eye className="w-4 h-4" /> },
    { id: 'audit',       label: 'Audit Log',         icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Letter Template Settings</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Design the letter body with rich text and dynamic placeholders.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
          {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving&#x2026;' : 'Save Template'}
        </button>
      </div>

      {(error || saveError) && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error || saveError}</span>
        </div>
      )}
      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 shrink-0" />Template saved successfully.
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-slate-700">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600 dark:text-sky-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DOCUMENT BODY TAB */}
      {tab === 'document' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => docxInputRef.current?.click()} disabled={docxLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700 disabled:opacity-50">
              {docxLoading ? <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-primary-500 rounded-full" /> : <FileUp className="w-4 h-4 text-gray-500" />}
              {docxLoading ? 'Importing&#x2026;' : 'Import DOCX'}
            </button>
            <input ref={docxInputRef} type="file" accept=".docx" className="hidden" onChange={e => handleDocxFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => { if (window.confirm('Reset to default template?')) setDocBody(DEFAULT_TEMPLATE_BODY); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700">
              <RotateCcw className="w-4 h-4 text-gray-500" />Reset to Default
            </button>
            <button onClick={() => setShowPreview(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${showPreview ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 hover:bg-gray-50 dark:border-slate-600'}`}>
              <Eye className="w-4 h-4" />{showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <span className="ml-auto text-xs text-gray-400 hidden md:block">Click a placeholder to insert at cursor.</span>
          </div>

          {docxError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{docxError}</span>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <strong>How to use:</strong> Edit your letter content in the editor below. Click any placeholder on the right to insert it at cursor. Upload a DOCX to import existing content.
          </div>

          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              {showPreview ? (
                <div className="rounded-lg border border-gray-200 bg-white p-6 overflow-auto max-h-[600px]" style={{ position: 'relative' }}>
                  <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Preview (sample data)</div>
                  <div className="prose prose-sm max-w-none" style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                    dangerouslySetInnerHTML={{ __html: renderTemplatePreview(docBody, {
                      ...draft,
                      headerImageUrl: draft.headerImageUrl ? getFileUrl(draft.headerImageUrl) : null,
                      watermarkImageUrl: draft.watermarkImageUrl ? getFileUrl(draft.watermarkImageUrl) : null,
                    }) }} />
                </div>
              ) : (
                <DocumentBodyEditor value={docBody} onChange={setDocBody} quillRef={quillRef} />
              )}
            </div>

            <div className="w-64 shrink-0 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto max-h-[620px]">
              <div className="sticky top-0 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 py-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> Placeholders</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Click to insert at cursor</p>
              </div>
              <div className="p-2 space-y-1">
                {PLACEHOLDER_GROUPS.map(group => {
                  const isOpen = openGroups[group.category] ?? false;
                  const chipCls = COLOR_MAP[group.color] ?? COLOR_MAP.slate;
                  return (
                    <div key={group.category}>
                      <button onClick={() => toggleGroup(group.category)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md">
                        <span>{group.category}</span>
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      {isOpen && (
                        <div className="ml-2 space-y-0.5 mb-1">
                          {group.items.map(item => (
                            <button key={item.key} onClick={() => insertPlaceholder(item.key, item.special)}
                              title={item.description ?? item.label}
                              className={`w-full text-left px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${chipCls}`}>
                              <span className="flex items-center gap-1">{item.special && <span className="opacity-60 text-[10px]">&#x229E;</span>}<span>{item.label}</span></span>
                              <span className="block text-[9px] opacity-50 font-mono mt-0.5">{`{{${item.key}}}`}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGES TAB */}
      {tab === 'images' && (
        <div className="space-y-6">

          {/* ── HEADER / LETTERHEAD IMAGE ─────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary-600" />
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Header / Letterhead Image</h4>
              <span className="ml-auto text-xs text-gray-400">Use <code className="bg-gray-100 rounded px-1">{'{{LETTERHEAD}}'}</code> in doc body to place it</span>
            </div>

            {draft.headerImageUrl ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFileUrl(draft.headerImageUrl)}
                    alt="Header"
                    style={{ width: `${Math.min(draft.headerImageWidth ?? 100, 100)}%`, maxHeight: 120, objectFit: 'contain' }}
                    className="rounded border border-gray-200 bg-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600 dark:text-slate-300 w-24 shrink-0">Width: {draft.headerImageWidth ?? 100}%</label>
                  <input
                    type="range" min={10} max={100} step={5}
                    value={draft.headerImageWidth ?? 100}
                    onChange={e => set('headerImageWidth', Number(e.target.value))}
                    className="flex-1 accent-primary-600"
                  />
                  <button onClick={() => set('headerImageWidth', 100)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded">Reset</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 border border-primary-200 rounded">
                    <Upload className="w-3 h-3" />Replace
                  </button>
                  <button onClick={removeHeaderImage} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded">
                    <X className="w-3 h-3" />Remove
                  </button>
                </div>
                <p className="text-xs text-gray-400">Drag the slider to resize. Changes apply when you <strong>Save Template</strong>.</p>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
                {uploading
                  ? <span className="animate-spin w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full" />
                  : <Upload className="w-7 h-7 text-gray-400" />}
                <p className="text-sm text-gray-500 text-center">{uploading ? 'Uploading…' : 'Click to upload header image'}</p>
                <p className="text-xs text-gray-400">PNG / JPG / WEBP — max 10 MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleImageFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* ── WATERMARK IMAGE ───────────────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Watermark Image</h4>
              <span className="ml-1 text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5">optional</span>
              <span className="ml-auto text-xs text-gray-400">Printed as a centered background overlay</span>
            </div>
            <p className="text-xs text-gray-500">When set, the watermark is printed behind the letter content (centre of page). Adjust opacity and size below.</p>

            {draft.watermarkImageUrl ? (
              <div className="space-y-3">
                <div className="relative flex items-center justify-center p-4 rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 min-h-[100px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFileUrl(draft.watermarkImageUrl)}
                    alt="Watermark preview"
                    style={{
                      width: `${Math.min(draft.watermarkWidth ?? 30, 100)}%`,
                      opacity: (draft.watermarkOpacity ?? 20) / 100,
                      objectFit: 'contain',
                    }}
                    className="rounded"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-600 dark:text-slate-300 w-24 shrink-0">Opacity: {draft.watermarkOpacity ?? 20}%</label>
                    <input
                      type="range" min={5} max={80} step={5}
                      value={draft.watermarkOpacity ?? 20}
                      onChange={e => set('watermarkOpacity', Number(e.target.value))}
                      className="flex-1 accent-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-600 dark:text-slate-300 w-24 shrink-0">Size: {draft.watermarkWidth ?? 30}%</label>
                    <input
                      type="range" min={10} max={100} step={5}
                      value={draft.watermarkWidth ?? 30}
                      onChange={e => set('watermarkWidth', Number(e.target.value))}
                      className="flex-1 accent-amber-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => watermarkInputRef.current?.click()} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 border border-primary-200 rounded">
                    <Upload className="w-3 h-3" />Replace
                  </button>
                  <button onClick={removeWatermarkImage} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded">
                    <X className="w-3 h-3" />Remove Watermark
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => watermarkInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-amber-200 rounded-lg p-8 cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-colors">
                {uploading
                  ? <span className="animate-spin w-6 h-6 border-2 border-amber-300 border-t-amber-600 rounded-full" />
                  : <ImageIcon className="w-7 h-7 text-amber-300" />}
                <p className="text-sm text-gray-500 text-center">{uploading ? 'Uploading…' : 'Click to upload watermark image'}</p>
                <p className="text-xs text-gray-400">PNG recommended (with transparent background) — max 10 MB</p>
              </div>
            )}
            <input ref={watermarkInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleWatermarkFile(e.target.files?.[0] ?? null)} />
          </div>

        </div>
      )}

      {/* INSTITUTION TAB */}
      {tab === 'institution' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Full University Name</label><input className={inputCls} value={draft.universityName} onChange={e => set('universityName', e.target.value)} /></div>
          <div><label className={labelCls}>Short / Display Name</label><input className={inputCls} value={draft.universityShort} onChange={e => set('universityShort', e.target.value)} /></div>
          <div><label className={labelCls}>Address</label><input className={inputCls} value={draft.universityAddr} onChange={e => set('universityAddr', e.target.value)} /></div>
          <div><label className={labelCls}>Legal / Establishment Line</label><input className={inputCls} value={draft.universityLegal} onChange={e => set('universityLegal', e.target.value)} /></div>
          <div><label className={labelCls}>Branch / Department Title</label><input className={inputCls} value={draft.branchTitle} onChange={e => set('branchTitle', e.target.value)} /></div>
          <div>
            <label className={labelCls}>Reference Number Prefix</label>
            <div className="flex items-center gap-1">
              <input className={inputCls} value={draft.refPrefix} onChange={e => set('refPrefix', e.target.value)} />
              <span className="text-xs text-gray-400 whitespace-nowrap">/2025-26</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">The year is appended automatically.</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-gray-400 mt-2">To manage header and watermark images, go to the <button onClick={() => setTab('images')} className="text-primary-600 underline hover:text-primary-700">Images tab</button>.</p>
          </div>
        </div>
      )}

      {/* BANK DETAILS TAB */}
      {tab === 'bank' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">These details fill the <code className="bg-gray-100 rounded px-1">{'{{BANK_TABLE}}'}</code> placeholder and the remittance page.</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-slate-300 w-8">S.No.</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-slate-300">Particulars</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-slate-300">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {([['1','Name of Account','accountName'],['2','Bank Name','bankName'],['3','Branch Name & Address','branchName'],['4','Account Number','accountNumber'],['5','IFSC Code','ifscCode'],['6','MICR Code','micrCode']] as [string,string,keyof LoanLetterBankDetails][]).map(([no,label,field]) => (
                  <tr key={field}>
                    <td className="px-4 py-2 text-gray-400">{no}</td>
                    <td className="px-4 py-2 font-medium text-gray-700 dark:text-slate-200">{label}</td>
                    <td className="px-4 py-2"><input className={inputCls} value={draft.bankDetails[field] || ''} onChange={e => setBank(field, e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTES & SIGNATORY TAB */}
      {tab === 'notes' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' !mb-0'}>Footer Notes</label>
              <button onClick={addNote} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"><Plus className="w-3.5 h-3.5" /> Add Note</button>
            </div>
            <p className="text-xs text-gray-400 mb-3">Used by <code className="bg-gray-100 rounded px-1">{'{{FOOTER_NOTES}}'}</code> — renders as asterisk-prefixed lines.</p>
            <div className="space-y-2">
              {draft.footerNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 text-xs text-gray-400 font-mono">*</span>
                  <textarea rows={2} className={inputCls + ' resize-none flex-1'} value={note} onChange={e => setNote(i, e.target.value)} placeholder="Enter footer note&#x2026;" />
                  <button onClick={() => removeNote(i)} className="mt-1 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {draft.footerNotes.length === 0 && <p className="text-sm text-gray-400 italic py-3 text-center">No footer notes.</p>}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><User className="w-4 h-4 text-gray-500" /><span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Authorized Signatory</span></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>Title</label><input className={inputCls} value={draft.signatoryTitle} onChange={e => set('signatoryTitle', e.target.value)} placeholder="Authorized Signatory" /></div>
              <div><label className={labelCls}>Department</label><input className={inputCls} value={draft.signatoryDept} onChange={e => set('signatoryDept', e.target.value)} placeholder="(Finance Department)" /></div>
              <div><label className={labelCls}>Organisation</label><input className={inputCls} value={draft.signatoryOrg} onChange={e => set('signatoryOrg', e.target.value)} placeholder="SGT University, Gurugram" /></div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW TAB */}
      {tab === 'preview' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">Full letter preview with sample data substituted. Save the template to persist changes.</p>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white p-8 overflow-auto max-h-[700px]" style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: renderTemplatePreview(docBody, {
                ...draft,
                headerImageUrl: draft.headerImageUrl ? getFileUrl(draft.headerImageUrl) : null,
                watermarkImageUrl: draft.watermarkImageUrl ? getFileUrl(draft.watermarkImageUrl) : null,
              }) }} />
          </div>
        </div>
      )}

      {/* AUDIT LOG TAB */}
      {tab === 'audit' && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <LoanLetterTemplateAuditLog />
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
          {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving&#x2026;' : 'Save Template'}
        </button>
      </div>

    </div>
  );
}
