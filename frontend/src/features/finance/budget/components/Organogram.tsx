'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Maximize2, Minus, Plus, Rows3, UnfoldVertical } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { BudgetStatusBadge, Figure, UtilisationBar } from './BudgetBits';
import { fitTransform, layoutOrganogram, nodeKey, parentOf, findNode, type LaidOutNode } from '../budgetTree';
import type { BudgetNode } from '../types';

interface Props {
  root: BudgetNode;
  warnPct: number;
  selectedKey: string | null;
  onSelect: (node: BudgetNode) => void;
  /** Keys matching the search box; others are dimmed. Empty = no search. */
  matches: Set<string>;
  /** Schools to force open (search hits inside them). */
  forceExpand: Set<string>;
}

const NODE_LABEL: Record<string, string> = { university: 'University', school: 'School', department: 'Department', unassigned: 'Unassigned' };
/** Short level names for the card eyebrow (the status badge shares the line). */
const CARD_LABEL: Record<string, string> = { university: 'University', school: 'School', department: 'Dept', unassigned: 'Unassigned' };
const MIN_SCALE = 0.3;
const MAX_VIEW_H = 860;
const MIN_VIEW_H = 380;
const MAX_SCALE = 1.6;

function NodeCard({
  item, warnPct, selected, focused, dimmed, expanded, onToggle, onSelect, onKeyDown, onFocus, refCb,
}: {
  item: LaidOutNode;
  warnPct: number;
  selected: boolean;
  focused: boolean;
  dimmed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  refCb: (el: HTMLDivElement | null) => void;
}) {
  const n = item.node;
  const isSchool = n.nodeType === 'school';
  const isUnassigned = n.nodeType === 'unassigned';
  const kids = n.children.length;
  return (
    <div
      ref={refCb}
      role="treeitem"
      aria-level={item.depth + 1}
      aria-selected={selected}
      aria-expanded={isSchool && kids > 0 ? expanded : undefined}
      aria-label={`${NODE_LABEL[n.nodeType]} ${n.name}`}
      tabIndex={focused ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={onSelect}
      data-node-card=""
      className={`absolute flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-3 text-left shadow-[0_1px_2px_rgba(28,25,23,0.06)] outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-wine/50 dark:bg-gray-800 dark:focus-visible:ring-amber/60 ${
        selected ? 'border-wine ring-2 ring-wine/30 dark:border-amber dark:ring-amber/30' : 'border-stone-200 hover:border-stone-300 dark:border-gray-700 dark:hover:border-gray-500'
      } ${dimmed ? 'opacity-35' : ''} ${n.nodeType === 'university' ? 'border-t-4 border-t-wine dark:border-t-amber' : ''}`}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-gray-400">
          {CARD_LABEL[n.nodeType]}{n.code ? ` · ${n.code}` : ''}{!n.isActive ? ' · inactive' : ''}
        </p>
        <BudgetStatusBadge status={n.status} warnPct={warnPct} compact />
      </div>
      <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-stone-900 dark:text-white" title={n.name}>{n.name}</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {isUnassigned ? (
          <>
            <Figure label="Committed" value={n.committed} />
            <Figure label="Utilised" value={n.utilised} />
            <Figure label="Pending" value={n.pending} />
          </>
        ) : (
          <>
            <Figure label="Allocated" value={n.allocated} />
            <Figure label="Available" value={n.available} tone={n.available < 0 ? 'negative' : undefined} />
            <Figure label="Committed" value={n.committed} />
            <Figure label="Utilised" value={n.utilised} />
          </>
        )}
      </dl>
      <div className="mt-auto flex items-center gap-2 pt-2">
        {isUnassigned ? (
          <span className="text-[11px] text-stone-500 dark:text-gray-400">Counts against the university total</span>
        ) : (
          <>
            <UtilisationBar figures={n} className="min-w-0 flex-1" showLabel={false} />
            <span className="shrink-0 text-[11px] tabular-nums text-stone-600 dark:text-gray-300">{n.utilisationPct == null ? '—' : `${n.utilisationPct}%`}</span>
          </>
        )}
        {isSchool && kids > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${n.name} (${kids} department${kids === 1 ? '' : 's'})`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {expanded ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            {kids}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Budget tree as an org chart. Pan by dragging the background, zoom with the buttons or
 * Ctrl/⌘ + wheel, "Fit" to see everything. Keyboard: arrows move between nodes, Enter opens
 * the node, +/− expand or collapse a school.
 */
export default function Organogram({ root, warnPct, selectedKey, onSelect, matches, forceExpand }: Props) {
  const schoolKeys = useMemo(() => root.children.filter((c) => c.children.length).map(nodeKey), [root]);
  const totalDepts = root.children.reduce((s, c) => s + c.children.length, 0);
  const [expandedState, setExpanded] = useState<Set<string>>(() => new Set(totalDepts <= 24 ? schoolKeys : []));
  const expanded = useMemo(() => new Set([...expandedState, ...forceExpand]), [expandedState, forceExpand]);
  const layout = useMemo(() => layoutOrganogram(root, expanded), [root, expanded]);
  const byKey = useMemo(() => new Map(layout.nodes.map((n) => [n.key, n])), [layout]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [view, setView] = useState({ scale: 1, x: 0, y: 24 });
  const [viewport, setViewport] = useState({ width: 900, height: 560 });
  const [focusKey, setFocusKey] = useState<string>(nodeKey(root));
  /** Until the user pans or zooms, the chart keeps fitting itself to the available width. */
  const userMoved = useRef(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fit = useCallback(() => setView(fitTransform(layout, { width: viewport.width, height: MAX_VIEW_H })), [layout, viewport.width]);
  useEffect(() => {
    if (userMoved.current || viewport.width < 50) return;
    fit();
  }, [fit, viewport.width]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    userMoved.current = true;
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const px = cx ?? viewport.width / 2;
      const py = cy ?? viewport.height / 2;
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, [viewport]);

  // Ctrl/⌘ + wheel zooms; a plain wheel keeps scrolling the page.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Drag to pan (background or cards; a click without movement still selects).
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      userMoved.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      // Swallow the click that ends a drag.
      const stop = (ev: MouseEvent) => { ev.stopPropagation(); window.removeEventListener('click', stop, true); };
      window.addEventListener('click', stop, true);
      setTimeout(() => window.removeEventListener('click', stop, true), 0);
    }
  };

  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  /** Keep the focused card inside the viewport. */
  const reveal = useCallback((key: string) => {
    const item = byKey.get(key);
    if (!item) return;
    setView((v) => {
      const left = v.x + item.x * v.scale;
      const top = v.y + item.y * v.scale;
      const right = left + item.w * v.scale;
      const bottom = top + item.h * v.scale;
      let { x, y } = v;
      const pad = 16;
      if (left < pad) x += pad - left;
      else if (right > viewport.width - pad) x -= right - (viewport.width - pad);
      if (top < pad) y += pad - top;
      else if (bottom > viewport.height - pad) y -= bottom - (viewport.height - pad);
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
  }, [byKey, viewport]);

  const focusNode = (key: string) => {
    setFocusKey(key);
    reveal(key);
    requestAnimationFrame(() => cardRefs.current.get(key)?.focus({ preventScroll: true }));
  };

  const onKeyDown = (item: LaidOutNode) => (e: React.KeyboardEvent) => {
    const n = item.node;
    const key = item.key;
    const parent = parentOf(root, key);
    const siblings = parent ? parent.children : [root];
    const idx = siblings.findIndex((s) => nodeKey(s) === key);
    const isOpen = expanded.has(key);
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(n);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (n.nodeType === 'university' && n.children[0]) focusNode(nodeKey(n.children[0]));
        else if (n.nodeType === 'school' && n.children[0]) {
          if (!isOpen) toggle(key);
          focusNode(nodeKey(n.children[0]));
        } else if (n.nodeType === 'department' && idx < siblings.length - 1) focusNode(nodeKey(siblings[idx + 1]));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (n.nodeType === 'department' && idx > 0) focusNode(nodeKey(siblings[idx - 1]));
        else if (parent) focusNode(nodeKey(parent));
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (n.nodeType === 'school' && idx < siblings.length - 1) focusNode(nodeKey(siblings[idx + 1]));
        else if (n.nodeType === 'department' && parent) {
          const schools = root.children;
          const si = schools.findIndex((s) => nodeKey(s) === nodeKey(parent));
          if (si < schools.length - 1) focusNode(nodeKey(schools[si + 1]));
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (n.nodeType === 'school' && idx > 0) focusNode(nodeKey(siblings[idx - 1]));
        else if (n.nodeType === 'department' && parent) focusNode(nodeKey(parent));
        break;
      case 'Home':
        e.preventDefault();
        focusNode(nodeKey(root));
        break;
      case '+':
      case '=':
        if (n.nodeType === 'school' && !isOpen) toggle(key);
        break;
      case '-':
        if (n.nodeType === 'school' && isOpen) toggle(key);
        break;
      default:
    }
  };

  // The viewport follows the content (at the current zoom) between MIN and MAX height.
  const viewHeight = Math.round(Math.min(MAX_VIEW_H, Math.max(MIN_VIEW_H, layout.height * view.scale + 48)));

  // If the focused node disappears (collapsed), fall back to its school.
  const effectiveFocus = byKey.has(focusKey) ? focusKey : nodeKey(parentOf(root, focusKey) || root);
  const anySearch = matches.size > 0;
  const selectedInTree = selectedKey && findNode(root, selectedKey) ? selectedKey : null;

  return (
    <div className={`overflow-hidden ${ui.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 dark:border-gray-700">
        <p className="hidden text-xs text-stone-500 dark:text-gray-400 sm:block">
          Drag to pan · Ctrl/⌘ + scroll to zoom · arrow keys to move, Enter to open
        </p>
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Organogram view">
          <button type="button" onClick={() => zoomAt(1 / 1.2)} className={`${ui.btnSecondary} !h-8 !px-2`} aria-label="Zoom out"><Minus className="h-4 w-4" aria-hidden="true" /></button>
          <span className="w-12 text-center text-xs tabular-nums text-stone-600 dark:text-gray-300" aria-live="polite">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomAt(1.2)} className={`${ui.btnSecondary} !h-8 !px-2`} aria-label="Zoom in"><Plus className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => { userMoved.current = false; fit(); }} aria-label="Fit to view" className={`${ui.btnSecondary} !h-8 !px-2.5 text-xs`}><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">Fit</span></button>
          <button type="button" onClick={() => setExpanded(new Set(schoolKeys))} aria-label="Expand all schools" className={`${ui.btnSecondary} !h-8 !px-2.5 text-xs`}><UnfoldVertical className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">Expand all</span></button>
          <button type="button" onClick={() => setExpanded(new Set())} aria-label="Collapse all schools" className={`${ui.btnSecondary} !h-8 !px-2.5 text-xs`}><Rows3 className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">Collapse</span></button>
        </div>
      </div>
      <div
        ref={viewportRef}
        style={{ height: viewHeight }}
        className="relative touch-none select-none overflow-hidden bg-[radial-gradient(circle,_var(--viz-grid)_1px,_transparent_1px)] [background-size:20px_20px] cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
      >
        <div
          role="tree"
          aria-label={`Research budget organogram for ${root.name}`}
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <svg width={layout.width} height={layout.height} className="pointer-events-none absolute left-0 top-0 overflow-visible" aria-hidden="true">
            {layout.edges.map((e) => (
              <path key={`${e.from}>${e.to}`} d={e.d} fill="none" style={{ stroke: 'var(--viz-axis)' }} strokeWidth={2} strokeLinejoin="round" />
            ))}
          </svg>
          {layout.nodes.map((item) => (
            <NodeCard
              key={item.key}
              item={item}
              warnPct={warnPct}
              selected={selectedInTree === item.key}
              focused={effectiveFocus === item.key}
              dimmed={anySearch && !matches.has(item.key)}
              expanded={expanded.has(item.key)}
              onToggle={() => toggle(item.key)}
              onSelect={() => { setFocusKey(item.key); onSelect(item.node); }}
              onKeyDown={onKeyDown(item)}
              onFocus={() => setFocusKey(item.key)}
              refCb={(el) => { if (el) cardRefs.current.set(item.key, el); else cardRefs.current.delete(item.key); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
