'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  Download,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import type { ChatMessage, ChatSession, ChatSource, PipelineRun, RipStatus, ToolStep } from '../../types';
import { Markdown } from './Markdown';

const SUGGESTIONS = [
  { title: 'Find experts', prompt: 'Who are our strongest researchers in machine learning, and what have they published recently?' },
  { title: 'Research strengths', prompt: 'What are our main research strengths across domains, with the leading researchers in each?' },
  { title: 'Trending topics', prompt: 'Which research topics are growing fastest at our university over the last two years?' },
  { title: 'Executive briefing', prompt: 'Write an executive research briefing for the university: key figures, quality (quartiles), top topics and recommendations.' },
];

const STAGE_LABEL: Record<string, string> = {
  taxonomy_seed: 'Preparing taxonomy',
  keywords: 'Extracting keywords',
  keyword_metrics: 'Computing topic metrics',
  classification: 'Classifying topics with AI',
  specializations: 'Organising specializations',
  taxonomy_stats: 'Updating domain statistics',
  expertise: 'Profiling researcher expertise',
};

interface LiveTurn {
  userText: string;
  steps: (ToolStep & { id: string })[];
  text: string;
  phase: 'thinking' | 'answering';
  sources: ChatSource[];
}

const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

function groupSessions(sessions: ChatSession[]) {
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const groups: { label: string; items: ChatSession[] }[] = [
    { label: 'Pinned', items: [] },
    { label: 'Today', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const s of sessions) {
    const t = new Date(s.lastActiveAt).getTime();
    if (s.pinned) groups[0].items.push(s);
    else if (t >= startOfToday) groups[1].items.push(s);
    else if (t >= startOfToday - 7 * 86400000) groups[2].items.push(s);
    else groups[3].items.push(s);
  }
  return groups.filter((g) => g.items.length);
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
      title="Copy answer"
    >
      {done ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Steps({ steps, live }: { steps: ToolStep[]; live?: boolean }) {
  const [open, setOpen] = useState(!!live);
  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);
  if (!steps.length) return null;
  const running = steps.some((s) => s.state === 'start');
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" /> : <Database className="w-3.5 h-3.5" />}
        {running ? 'Looking through research records…' : `Checked ${steps.length} source${steps.length === 1 ? '' : 's'}`}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="mt-2 ml-1.5 border-l border-slate-200 dark:border-white/10 pl-3.5 space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.id || i} className="flex items-start gap-2 text-[12.5px] text-slate-600 dark:text-slate-400">
              {s.state === 'start' ? (
                <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin text-brand-600 shrink-0" />
              ) : s.failed ? (
                <XCircle className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
              )}
              <span>
                {s.label}
                {s.summary && s.state !== 'start' && <span className="text-slate-400"> · {s.summary}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Sources({ sources }: { sources: ChatSource[] }) {
  const [showAll, setShowAll] = useState(false);
  const cited = sources.filter((s) => s.cited);
  const list = showAll ? sources : cited;
  if (!sources.length) return null;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">Sources</span>
        {sources.length > cited.length && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11.5px] text-brand-600 hover:underline dark:text-brand-300">
            {showAll ? 'Show cited only' : `Show all ${sources.length} retrieved`}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-slate-500">No records were cited in this answer.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((s) => (
            <Link
              key={`${s.type}-${s.id}`}
              id={`src-${s.ref}`}
              href={s.type === 'publication' ? `/research/contribution/${s.id}` : `/research/profile/${s.id}`}
              className="group flex gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm transition dark:bg-white/[0.03] dark:border-white/10 dark:hover:border-brand-400/50 scroll-mt-24"
            >
              <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md bg-brand-100/70 text-brand-700 text-[10.5px] font-semibold dark:bg-brand-600/25 dark:text-brand-200">{s.ref}</span>
              <span className="min-w-0">
                {s.type === 'publication' ? (
                  <>
                    <span className="flex items-center gap-1 text-[12.5px] font-medium text-slate-800 group-hover:text-brand-700 dark:text-slate-200 line-clamp-2">
                      <BookOpen className="w-3 h-3 shrink-0 text-slate-400" />
                      {s.title}
                    </span>
                    <span className="block text-[11.5px] text-slate-500 truncate">
                      {[s.journal, s.year, s.citations ? `${s.citations} citations` : null].filter(Boolean).join(' · ')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-[12.5px] font-medium text-slate-800 group-hover:text-brand-700 dark:text-slate-200">
                      <User className="w-3 h-3 shrink-0 text-slate-400" />
                      {s.name}
                    </span>
                    <span className="block text-[11.5px] text-slate-500 truncate">{[s.designation, s.department].filter(Boolean).join(' · ')}</span>
                  </>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function downloadMarkdown(content: string, sources: ChatSource[]) {
  const refs = sources
    .filter((s) => s.cited)
    .map((s) => (s.type === 'publication' ? `[${s.ref}] ${s.authors?.join(', ') || ''}${s.authors?.length ? '. ' : ''}${s.title}. ${s.journal || ''}${s.year ? ` (${s.year})` : ''}${s.doi ? `. https://doi.org/${s.doi}` : ''}` : `[${s.ref}] ${s.name}${s.department ? `, ${s.department}` : ''}`));
  const body = refs.length ? `${content}\n\n---\n\n### References\n\n${refs.join('\n\n')}\n` : content;
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `research-answer-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function IndexStatus({ status, onRefresh }: { status: RipStatus; onRefresh: () => void }) {
  const [run, setRun] = useState<PipelineRun | null>(status.lastRun);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const canManage = status.permissions.rip_manage_taxonomy;
  const active = run && (run.status === 'queued' || run.status === 'running');

  useEffect(() => setRun(status.lastRun), [status.lastRun]);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(async () => {
      try {
        const [latest] = await svc.listPipelineRuns(1);
        setRun(latest || null);
        if (latest && !['queued', 'running'].includes(latest.status)) onRefresh();
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(t);
  }, [active, onRefresh]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      setRun(await svc.startPipeline({}));
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="m-3 p-3 rounded-xl border border-slate-200 bg-white text-[12px] dark:bg-white/[0.03] dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Research index</span>
        {canManage && (
          <button type="button" onClick={start} disabled={!!active || starting} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-300" title="Rebuild keywords, topics and expertise">
            <RefreshCw className={`w-3.5 h-3.5 ${active ? 'animate-spin' : ''}`} />
            {active ? 'Updating' : 'Refresh'}
          </button>
        )}
      </div>
      {active ? (
        <div className="mt-2">
          <div className="flex justify-between text-slate-500">
            <span>{STAGE_LABEL[run!.stage || ''] || 'Queued'}</span>
            <span>{run!.progress}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${run!.progress}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-slate-500">
          {status.keywords.total.toLocaleString()} topics · {status.keywords.taxonomyCoverage}% classified
          {run?.finishedAt && <> · updated {timeAgo(run.finishedAt)}</>}
          {run?.status === 'failed' && <span className="block text-red-600">Last update failed{canManage && run.error ? `: ${run.error.slice(0, 120)}` : ''}</span>}
        </p>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ResearchAssistant() {
  const [status, setStatus] = useState<RipStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await svc.getStatus());
    } catch (e: any) {
      setStatusError(e?.response?.data?.message || 'Research Intelligence is unavailable.');
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await svc.listSessions(search || undefined));
    } catch {
      // sidebar stays as is
    }
  }, [search]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const canChat = status?.permissions.rip_access_research_gpt;
  useEffect(() => {
    if (!canChat) return undefined;
    const t = setTimeout(loadSessions, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [canChat, loadSessions, search]);

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebarOpen(false);
    return () => abortRef.current?.abort();
  }, []);

  // Keep the view pinned to the newest content unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, live]);

  const openSession = async (id: string) => {
    if (live) return;
    setSessionId(id);
    setError(null);
    setLoadingMessages(true);
    stickToBottom.current = true;
    try {
      setMessages(await svc.getMessages(id));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load this conversation.');
    } finally {
      setLoadingMessages(false);
    }
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebarOpen(false);
  };

  const newChat = () => {
    if (live) return;
    setSessionId(null);
    setMessages([]);
    setError(null);
    setInput('');
    inputRef.current?.focus();
  };

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || live) return;
    setError(null);
    setInput('');
    stickToBottom.current = true;

    let sid = sessionId;
    try {
      if (!sid) {
        const s = await svc.createSession();
        sid = s.id;
        setSessionId(s.id);
        setSessions((prev) => [s, ...prev]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not start a conversation.');
      setInput(text);
      return;
    }

    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setLive({ userText: text, steps: [], text: '', phase: 'thinking', sources: [] });
    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;

    try {
      await svc.streamMessage(
        sid!,
        text,
        (e) => {
          if (e.event === 'status') setLive((l) => l && { ...l, phase: e.data.phase });
          else if (e.event === 'delta') setLive((l) => l && { ...l, text: l.text + e.data.text });
          else if (e.event === 'tool') {
            setLive((l) => {
              if (!l) return l;
              const known = l.steps.some((s) => s.id === e.data.id);
              const steps = known ? l.steps.map((s) => (s.id === e.data.id ? e.data : s)) : [...l.steps, e.data];
              return { ...l, steps };
            });
          } else if (e.event === 'sources') setLive((l) => l && { ...l, sources: e.data.items });
          else if (e.event === 'done') {
            finished = true;
            setMessages((m) => [...m, e.data.message]);
            if (e.data.title) setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title: e.data.title! } : s)));
          } else if (e.event === 'error') setError(e.data.message);
        },
        controller.signal
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Something went wrong.');
    } finally {
      abortRef.current = null;
      setLive(null);
      if (!finished && sid) {
        // Stopped or failed: reload what the server kept.
        svc.getMessages(sid).then(setMessages).catch(() => {});
      }
      setSessions((prev) => {
        const cur = prev.find((s) => s.id === sid);
        return cur ? [{ ...cur, lastActiveAt: new Date().toISOString() }, ...prev.filter((s) => s.id !== sid)] : prev;
      });
    }
  };

  const stop = () => abortRef.current?.abort();

  const regenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) send(lastUser.content);
  };

  const rate = async (m: ChatMessage, value: 1 | -1) => {
    const next = m.feedback === value ? 0 : value;
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, feedback: next || null } : x)));
    svc.setFeedback(m.id, next as 1 | -1 | 0).catch(() => {});
  };

  const togglePin = async (s: ChatSession) => {
    const updated = await svc.updateSession(s.id, { pinned: !s.pinned }).catch(() => null);
    if (updated) setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, pinned: updated.pinned } : x)));
  };

  const saveRename = async () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    setRenaming(null);
    if (!title) return;
    setSessions((prev) => prev.map((x) => (x.id === renaming.id ? { ...x, title } : x)));
    svc.updateSession(renaming.id, { title }).catch(() => loadSessions());
  };

  const remove = async (s: ChatSession) => {
    if (!window.confirm(`Delete "${s.title || 'Untitled chat'}"? This cannot be undone.`)) return;
    await svc.deleteSession(s.id).catch(() => null);
    setSessions((prev) => prev.filter((x) => x.id !== s.id));
    if (sessionId === s.id) newChat();
  };

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  // ── Gate states ──
  if (statusError) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center p-8 rounded-2xl border border-slate-200 bg-white dark:bg-white/[0.03] dark:border-white/10">
        <AlertTriangle className="w-8 h-8 mx-auto text-brand-400" />
        <p className="mt-3 text-slate-700 dark:text-slate-200">{statusError}</p>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex justify-center mt-24">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }
  if (!canChat) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center p-8 rounded-2xl border border-slate-200 bg-white dark:bg-white/[0.03] dark:border-white/10">
        <Sparkles className="w-8 h-8 mx-auto text-brand-600" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">Research Assistant</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">You don&apos;t have access to the AI research assistant yet. Ask your Directorate of Research to grant the “AI Research Assistant” permission.</p>
      </div>
    );
  }

  const emptyIndex = status.keywords.total === 0;

  return (
    <div className="relative flex h-[calc(100vh-8.5rem)] min-h-[520px] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:bg-[#171717] dark:border-white/10">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'flex' : 'hidden'} absolute inset-y-0 left-0 z-20 lg:static w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 backdrop-blur dark:bg-[#131313] dark:border-white/10`}>
        <div className="p-3 flex items-center gap-2">
          <button type="button" onClick={newChat} disabled={!!live} className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
            <MessageSquarePlus className="w-4 h-4" /> New chat
          </button>
          <button type="button" onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10" title="Hide sidebar">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        <div className="px-3">
          <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-sm dark:bg-white/5 dark:border-white/10">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="flex-1 bg-transparent outline-none text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
          </label>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {grouped.length === 0 && <p className="px-2 text-[12.5px] text-slate-500">{search ? 'No matching chats.' : 'Your conversations will appear here.'}</p>}
          {grouped.map((g) => (
            <div key={g.label}>
              <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
              {g.items.map((s) => (
                <div key={s.id} className={`group flex items-center rounded-lg ${s.id === sessionId ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/10' : 'hover:bg-slate-200/60 dark:hover:bg-white/5'}`}>
                  {renaming?.id === s.id ? (
                    <input
                      autoFocus
                      value={renaming.title}
                      onChange={(e) => setRenaming({ id: s.id, title: e.target.value })}
                      onBlur={saveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      className="flex-1 m-1 px-2 py-1 text-[13px] rounded-md border border-brand-300 outline-none bg-white dark:bg-black/30 dark:text-slate-100"
                    />
                  ) : (
                    <button type="button" onClick={() => openSession(s.id)} className="flex-1 min-w-0 text-left px-2.5 py-2 text-[13px] text-slate-700 dark:text-slate-300 truncate">
                      {s.title || 'New conversation'}
                    </button>
                  )}
                  <div className="hidden group-hover:flex items-center pr-1">
                    <button type="button" onClick={() => togglePin(s)} className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title={s.pinned ? 'Unpin' : 'Pin'}>
                      {s.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => setRenaming({ id: s.id, title: s.title || '' })} className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Rename">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(s)} className="p-1 rounded text-slate-400 hover:text-red-600" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </nav>
        {status.permissions.rip_manage_access && (
          <Link href="/research/intelligence/access" className="mx-3 -mb-1 inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-brand-700 dark:hover:text-brand-300">
            <ShieldCheck className="w-3.5 h-3.5" /> Manage who has access
          </Link>
        )}
        <IndexStatus status={status} onRefresh={loadStatus} />
      </aside>

      {/* Conversation */}
      <section className="relative flex-1 min-w-0 flex flex-col">
        <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-slate-100 dark:border-white/5">
          {!sidebarOpen && (
            <button type="button" onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" title="Show chats">
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <Sparkles className="w-4 h-4 text-brand-600" />
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {sessions.find((s) => s.id === sessionId)?.title || 'Research Assistant'}
          </h1>
        </header>

        {!status.ai.configured && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-brand-50 border border-brand-200 text-[13px] text-brand-800 dark:bg-brand-600/10 dark:border-brand-600/30 dark:text-brand-100">
            The AI service is not configured on the server (GEMINI_API_KEY / GROQ_API_KEY). The assistant can&apos;t answer until an administrator sets one.
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 py-6">
            {loadingMessages ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
              </div>
            ) : messages.length === 0 && !live ? (
              <div className="pt-10 sm:pt-16">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">What would you like to know about our research?</h2>
                <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400 max-w-xl">
                  Ask about experts, publications, topics, trends or departments. Every answer is drawn from the university&apos;s research records and cites its sources.
                </p>
                {emptyIndex && (
                  <p className="mt-3 text-[13px] text-slate-500">
                    Topic intelligence is still being built{status.permissions.rip_manage_taxonomy ? '. Use Refresh in the sidebar to index publications now' : ''}; publication search works already.
                  </p>
                )}
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      type="button"
                      key={s.title}
                      onClick={() => send(s.prompt)}
                      className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 transition dark:border-white/10 dark:hover:bg-white/5"
                    >
                      <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{s.title}</span>
                      <span className="block mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400 line-clamp-2">{s.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-7">
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-slate-100 text-[14.5px] text-slate-800 whitespace-pre-wrap dark:bg-white/10 dark:text-slate-100">{m.content}</div>
                    </div>
                  ) : (
                    <div key={m.id}>
                      <Steps steps={(m.toolTrace || []).map((s) => ({ ...s, state: 'end' as const }))} />
                      <Markdown content={m.content} sources={m.sources || []} />
                      <Sources sources={m.sources || []} />
                      <div className="mt-2 flex items-center gap-0.5">
                        <CopyButton text={m.content} />
                        <button type="button" onClick={() => downloadMarkdown(m.content, m.sources || [])} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-slate-200" title="Download as Markdown">
                          <Download className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => rate(m, 1)} className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 ${m.feedback === 1 ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'}`} title="Helpful">
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => rate(m, -1)} className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 ${m.feedback === -1 ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'}`} title="Not helpful">
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        {m.id === lastAssistantId && !live && (
                          <button type="button" onClick={regenerate} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10" title="Ask again">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {m.responseTimeMs ? <span className="ml-2 text-[11px] text-slate-400">{(m.responseTimeMs / 1000).toFixed(1)}s</span> : null}
                      </div>
                    </div>
                  )
                )}
                {live && (
                  <div>
                    <Steps steps={live.steps} live />
                    {live.text ? (
                      <Markdown content={live.text} sources={live.sources} streaming />
                    ) : (
                      live.steps.length === 0 && (
                        <div className="flex items-center gap-2 text-[13px] text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin text-brand-600" /> Thinking…
                        </div>
                      )
                    )}
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="max-w-3xl mx-auto flex items-end gap-2 p-2 rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 dark:bg-white/5 dark:border-white/10 dark:focus-within:ring-brand-600/20"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Ask about publications, experts, topics or departments…"
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[14.5px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            {live ? (
              <button type="button" onClick={stop} className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-xl bg-slate-800 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900" title="Stop">
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10" title="Send">
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </form>
          <p className="max-w-3xl mx-auto mt-1.5 text-center text-[11px] text-slate-400">Answers are generated by AI from institutional records. Check cited sources before relying on them.</p>
        </div>
      </section>
    </div>
  );
}
