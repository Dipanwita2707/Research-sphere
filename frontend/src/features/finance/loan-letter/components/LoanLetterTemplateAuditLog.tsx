'use client';

import { useEffect, useState, useCallback } from 'react';
import { History, User, Calendar, RefreshCw, X, FileEdit, ChevronRight } from 'lucide-react';
import {
  loanLetterTemplateService,
  TEMPLATE_DEFAULTS,
  type LoanLetterTemplate,
  type TemplateAuditEntry,
  type TemplateAuditLog,
} from '../services/loanLetterTemplate.service';
import { renderTemplatePreview } from '../utils/templateRenderer';

// ── Word-level diff ────────────────────────────────────────────────────────────

type DiffPart = { text: string; type: 'same' | 'removed' | 'added' };

function wordDiff(oldText: string, newText: string): DiffPart[] {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ text: newText, type: 'added' }];
  if (!newText) return [{ text: oldText, type: 'removed' }];

  const ow = oldText.trim().split(/\s+/);
  const nw = newText.trim().split(/\s+/);

  // Cap at 400 words each to keep LCS fast
  if (ow.length > 400 || nw.length > 400) {
    return [
      { text: oldText, type: 'removed' },
      { text: newText, type: 'added' },
    ];
  }

  const m = ow.length, n = nw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = ow[i - 1] === nw[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const parts: DiffPart[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ow[i - 1] === nw[j - 1]) {
      parts.unshift({ text: ow[i - 1], type: 'same' }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      parts.unshift({ text: nw[j - 1], type: 'added' }); j--;
    } else {
      parts.unshift({ text: ow[i - 1], type: 'removed' }); i--;
    }
  }
  return parts;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toRenderableTemplateBody(raw: string): string {
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return `<p>${escapeHtml(raw).replace(/\n/g, '<br/>')}</p>`;
}

function parseAuditJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type TemplateTextKey =
  | 'templateBody'
  | 'universityName'
  | 'universityShort'
  | 'universityAddr'
  | 'universityLegal'
  | 'branchTitle'
  | 'refPrefix'
  | 'headerImageUrl'
  | 'watermarkImageUrl'
  | 'signatoryTitle'
  | 'signatoryDept'
  | 'signatoryOrg';

type TemplateNumberKey = 'headerImageWidth' | 'headerImageX' | 'headerImageY' | 'watermarkOpacity' | 'watermarkWidth' | 'watermarkX' | 'watermarkY';
type TemplateBooleanKey = 'headerInlineWithText';

function setTemplateTextValue(snapshot: LoanLetterTemplate, key: TemplateTextKey, value: string) {
  snapshot[key] = value;
}

function setTemplateNumberValue(snapshot: LoanLetterTemplate, key: TemplateNumberKey, value: string) {
  snapshot[key] = Number(value || 0);
}

function setTemplateBooleanValue(snapshot: LoanLetterTemplate, key: TemplateBooleanKey, value: string) {
  snapshot[key] = value === 'true';
}

function buildTemplateSnapshot(
  baseTemplate: LoanLetterTemplate,
  entry: TemplateAuditEntry,
  version: 'from' | 'to',
): LoanLetterTemplate {
  const snapshot: LoanLetterTemplate = {
    ...baseTemplate,
    bankDetails: { ...baseTemplate.bankDetails },
    footerNotes: [...(baseTemplate.footerNotes ?? [])],
  };

  for (const [key, change] of Object.entries(entry.changes)) {
    const rawValue = version === 'from' ? change.from : change.to;
    switch (key) {
      case 'templateBody':
      case 'universityName':
      case 'universityShort':
      case 'universityAddr':
      case 'universityLegal':
      case 'branchTitle':
      case 'refPrefix':
      case 'headerImageUrl':
      case 'watermarkImageUrl':
      case 'signatoryTitle':
      case 'signatoryDept':
      case 'signatoryOrg':
        setTemplateTextValue(snapshot, key, rawValue);
        break;
      case 'headerImageWidth':
      case 'headerImageX':
      case 'headerImageY':
      case 'watermarkOpacity':
      case 'watermarkWidth':
      case 'watermarkX':
      case 'watermarkY':
        setTemplateNumberValue(snapshot, key, rawValue);
        break;
      case 'headerInlineWithText':
        setTemplateBooleanValue(snapshot, key, rawValue);
        break;
      case 'footerNotes':
        snapshot.footerNotes = parseAuditJson<string[]>(rawValue, snapshot.footerNotes);
        break;
      case 'bankDetails':
        snapshot.bankDetails = parseAuditJson<LoanLetterTemplate['bankDetails']>(rawValue, snapshot.bankDetails);
        break;
      default:
        break;
    }
  }

  return snapshot;
}

type TextEntry = {
  node: Text;
  tokens: string[];
  wordStart: number;
};

function collectTextEntries(root: HTMLElement): { entries: TextEntry[]; words: string[] } {
  const entries: TextEntry[] = [];
  const words: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent ?? '';
      const parent = (node as Text).parentElement;
      if (!text.trim() || !parent) return NodeFilter.FILTER_REJECT;
      if (['SCRIPT', 'STYLE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const tokens = node.nodeValue?.match(/\S+|\s+/g) ?? [];
    const wordStart = words.length;
    tokens.forEach(token => {
      if (!/^\s+$/.test(token)) words.push(token);
    });
    entries.push({ node, tokens, wordStart });
    current = walker.nextNode();
  }

  return { entries, words };
}

function highlightDocumentHtml(beforeHtml: string, afterHtml: string): { beforeHtml: string; afterHtml: string } {
  if (typeof DOMParser === 'undefined') {
    return { beforeHtml, afterHtml };
  }

  const parser = new DOMParser();
  const beforeDoc = parser.parseFromString(beforeHtml, 'text/html');
  const afterDoc = parser.parseFromString(afterHtml, 'text/html');
  const beforeRoot = beforeDoc.body;
  const afterRoot = afterDoc.body;

  const beforeData = collectTextEntries(beforeRoot);
  const afterData = collectTextEntries(afterRoot);
  const parts = wordDiff(beforeData.words.join(' '), afterData.words.join(' '));
  const beforeStatus: ('same' | 'removed')[] = Array.from(
    { length: beforeData.words.length },
    () => 'same',
  );
  const afterStatus: ('same' | 'added')[] = Array.from(
    { length: afterData.words.length },
    () => 'same',
  );

  let beforeIndex = 0;
  let afterIndex = 0;
  parts.forEach(part => {
    if (part.type === 'same') {
      beforeIndex += 1;
      afterIndex += 1;
      return;
    }
    if (part.type === 'removed') {
      beforeStatus[beforeIndex] = 'removed';
      beforeIndex += 1;
      return;
    }
    afterStatus[afterIndex] = 'added';
    afterIndex += 1;
  });

  const wrapTextNodes = (
    entries: TextEntry[],
    statuses: Array<'same' | 'removed' | 'added'>,
    type: 'before' | 'after',
  ) => {
    entries.forEach(({ node, tokens, wordStart }) => {
      let wordIndex = wordStart;
      let html = '';
      tokens.forEach(token => {
        if (/^\s+$/.test(token)) {
          html += token;
          return;
        }
        const escaped = escapeHtml(token);
        const status = statuses[wordIndex] ?? 'same';
        if (type === 'before' && status === 'removed') {
          html += `<span style="background:#fee2e2;color:#b91c1c;text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:#dc2626;border-radius:4px;padding:0 2px;">${escaped}</span>`;
        } else if (type === 'after' && status === 'added') {
          html += `<span style="background:#dcfce7;color:#166534;font-weight:700;border-radius:4px;padding:0 2px;box-shadow:inset 0 -1px 0 rgba(34,197,94,.35);">${escaped}</span>`;
        } else {
          html += escaped;
        }
        wordIndex += 1;
      });
      const template = document.createElement('template');
      template.innerHTML = html;
      node.replaceWith(template.content);
    });
  };

  wrapTextNodes(beforeData.entries, beforeStatus, 'before');
  wrapTextNodes(afterData.entries, afterStatus, 'after');

  return {
    beforeHtml: beforeRoot.innerHTML,
    afterHtml: afterRoot.innerHTML,
  };
}

// ── Document body diff — renders as proper letter preview side by side ─────────

function DocumentBodyDiff({ entry, template }: { entry: TemplateAuditEntry; template: LoanLetterTemplate | null }) {
  const [highlighted, setHighlighted] = useState<{ beforeHtml: string; afterHtml: string } | null>(null);
  const from = entry.changes.templateBody?.from ?? '';
  const to = entry.changes.templateBody?.to ?? '';

  const baseTemplate = template ?? TEMPLATE_DEFAULTS;
  const beforeTemplate = buildTemplateSnapshot(baseTemplate, entry, 'from');
  const afterTemplate = buildTemplateSnapshot(baseTemplate, entry, 'to');
  const previewBefore = renderTemplatePreview(toRenderableTemplateBody(from), beforeTemplate);
  const previewAfter = renderTemplatePreview(toRenderableTemplateBody(to), afterTemplate);

  useEffect(() => {
    setHighlighted(highlightDocumentHtml(previewBefore, previewAfter));
  }, [previewBefore, previewAfter]);

  const docStyle: React.CSSProperties = {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: '13px',
    lineHeight: '1.9',
    color: '#1f2937',
    textAlign: 'justify',
  };

  return (
    <div className="grid grid-cols-1 gap-4 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_10%)] p-4 md:grid-cols-2">
      {/* Before */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-red-100 bg-white shadow-[0_12px_30px_rgba(15,23,42,.06)]">
        <div className="flex items-center gap-1.5 border-b border-red-100 bg-red-50 px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Before</span>
        </div>
        <div
          className="overflow-y-auto bg-white px-5 py-4"
          style={{ ...docStyle, maxHeight: '480px' }}
          dangerouslySetInnerHTML={{ __html: highlighted?.beforeHtml ?? previewBefore }}
        />
      </div>
      {/* After */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-green-100 bg-white shadow-[0_12px_30px_rgba(15,23,42,.06)]">
        <div className="flex items-center gap-1.5 border-b border-green-100 bg-green-50 px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-green-500">After</span>
        </div>
        <div
          className="overflow-y-auto bg-white px-5 py-4"
          style={{ ...docStyle, maxHeight: '480px' }}
          dangerouslySetInnerHTML={{ __html: highlighted?.afterHtml ?? previewAfter }}
        />
      </div>
    </div>
  );
}


function ShortDiff({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-4 py-3">
      <span className="text-sm bg-red-50 text-red-700 line-through px-3 py-1 rounded-md border border-red-200 max-w-[280px] truncate" title={from}>
        {from || '—'}
      </span>
      <span className="text-gray-400 font-bold text-base">→</span>
      <span className="text-sm bg-green-50 text-green-700 font-medium px-3 py-1 rounded-md border border-green-200 max-w-[280px] truncate" title={to}>
        {to || '—'}
      </span>
    </div>
  );
}

// Long field: split Before | After panels
function SplitDiff({ from, to }: { from: string; to: string }) {
  const parts = wordDiff(from, to);
  const beforeParts = parts.filter(p => p.type !== 'added');
  const afterParts  = parts.filter(p => p.type !== 'removed');

  return (
    <div className="grid grid-cols-2 divide-x divide-gray-200">
      <div className="px-4 py-4 bg-red-50/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
          Before
        </p>
        <p className="text-sm leading-7 text-gray-700 font-serif">
          {beforeParts.map((p, i) =>
            p.type === 'removed'
              ? <span key={i} className="line-through text-red-600 bg-red-100 px-0.5 rounded">{p.text} </span>
              : <span key={i}>{p.text} </span>
          )}
        </p>
      </div>
      <div className="px-4 py-4 bg-green-50/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-3 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          After
        </p>
        <p className="text-sm leading-7 text-gray-700 font-serif">
          {afterParts.map((p, i) =>
            p.type === 'added'
              ? <span key={i} className="text-green-700 bg-green-100 font-medium px-0.5 rounded">{p.text} </span>
              : <span key={i}>{p.text} </span>
          )}
        </p>
      </div>
    </div>
  );
}

function FieldDiff({ fieldKey, from, to, entry, template }: { fieldKey: string; from: string; to: string; entry: TemplateAuditEntry; template: LoanLetterTemplate | null }) {
  if (fieldKey === 'templateBody') return <DocumentBodyDiff entry={entry} template={template} />;
  const isLong = (from + to).length > 120;
  return isLong ? <SplitDiff from={from} to={to} /> : <ShortDiff from={from} to={to} />;
}

// ── Diff Dialog ────────────────────────────────────────────────────────────────

function DiffDialog({ entry, template, onClose }: { entry: TemplateAuditEntry; template: LoanLetterTemplate | null; onClose: () => void }) {
  const changeKeys = Object.keys(entry.changes);
  const formattedDate = entry.changedAt
    ? new Date(entry.changedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10">
              <FileEdit className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">
                Version {entry.version} — Template Changes
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {entry.changedByName || 'Unknown'}
                  {entry.changedByUid ? <span className="font-mono text-slate-400 ml-0.5">({entry.changedByUid})</span> : null}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formattedDate}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-200 bg-white/10 px-2.5 py-1 rounded-full">
              {changeKeys.length} field{changeKeys.length !== 1 ? 's' : ''} changed
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Column headers (for split-view fields) ── */}
        <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          <div className="px-6 py-2 border-r border-gray-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Previous
          </div>
          <div className="px-6 py-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Updated
          </div>
        </div>

        {/* ── Diffs ── */}
        <div className="overflow-y-auto flex-1">
          {changeKeys.map((key, idx) => {
            const { label, from, to } = entry.changes[key];
            const isLong = key === 'templateBody' || (from + to).length > 120;
            return (
              <div key={key} className={idx > 0 ? 'border-t border-gray-200' : ''}>
                {/* Field label bar */}
                <div className="px-6 py-2 bg-slate-50 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                  {!isLong && (
                    <span className="text-[10px] text-gray-400 ml-auto">Value changed</span>
                  )}
                </div>
                {/* Diff content */}
                <FieldDiff fieldKey={key} from={from} to={to} entry={entry} template={template} />
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="line-through text-red-500">word</span> = removed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-600 font-medium">word</span> = added
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audit card (click opens dialog) ───────────────────────────────────────────

function AuditEntryCard({ entry, onOpen }: { entry: TemplateAuditEntry; onOpen: () => void }) {
  const changeKeys = Object.keys(entry.changes);
  const formattedDate = entry.changedAt
    ? new Date(entry.changedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 bg-white hover:bg-indigo-50/50 hover:border-indigo-300 transition-all group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">v{entry.version}</span>
          <span className="text-xs font-semibold text-gray-700">
            {changeKeys.length} field{changeKeys.length !== 1 ? 's' : ''} changed
          </span>
          <span className="text-xs text-gray-400 truncate max-w-[280px]">
            {changeKeys.slice(0, 3).map(k => entry.changes[k].label).join(', ')}
            {changeKeys.length > 3 ? ` +${changeKeys.length - 3} more` : ''}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
      </div>
      <div className="flex items-center gap-4 mt-1.5">
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <User className="w-3 h-3" />
          {entry.changedByName || 'Unknown'}
          {entry.changedByUid ? <span className="font-mono text-gray-400 ml-0.5">({entry.changedByUid})</span> : null}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Calendar className="w-3 h-3" /> {formattedDate}
        </span>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LoanLetterTemplateAuditLog() {
  const [log, setLog] = useState<TemplateAuditLog | null>(null);
  const [template, setTemplate] = useState<LoanLetterTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TemplateAuditEntry | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await loanLetterTemplateService.getAuditLog(p, 20);
      if (res.success) setLog(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  useEffect(() => {
    let active = true;
    loanLetterTemplateService.get()
      .then(res => {
        if (active && res.success) setTemplate(res.data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Template Change History</h3>
          {log && (
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              {log.total} record{log.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <p className="text-xs text-gray-400">Click any record to see the full word-level diff.</p>

      {loading && !log ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : !log || log.rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No changes recorded yet. Save the template to start tracking.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {log.rows.map(entry => (
              <AuditEntryCard key={entry.id} entry={entry} onOpen={() => setSelected(entry)} />
            ))}
          </div>

          {log.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
              <span>Page {log.page} of {log.totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={log.page <= 1 || loading}
                  className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(log.totalPages, p + 1))}
                  disabled={log.page >= log.totalPages || loading}
                  className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Diff dialog */}
      {selected && <DiffDialog entry={selected} template={template} onClose={() => setSelected(null)} />}
    </div>
  );
}
