'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
  zoom as d3zoom,
  zoomIdentity,
  type SimulationNodeDatum,
  type ZoomBehavior,
  type ZoomTransform,
} from 'd3';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { edgeWidth, nodeRadius, type GraphLinkView, type GraphNodeView } from '../../utils/graphUtils';

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
}

interface Placed {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface ForceGraphProps {
  nodes: GraphNodeView[];
  links: GraphLinkView[];
  /** accessible name for the whole graph */
  label: string;
  height?: number;
  selectedId?: string | null;
  /** node drawn with a dashed ring (e.g. the ego researcher) */
  focusId?: string | null;
  onSelect?: (id: string | null) => void;
  renderTooltip?: (node: GraphNodeView) => React.ReactNode;
  /** labels are always shown for this many of the largest nodes */
  labelCount?: number;
  hiddenGroups?: Set<string>;
  edgeTitle?: (link: GraphLinkView) => string;
}

const ZOOM_BUTTONS = [
  { action: 'in', label: 'Zoom in', Icon: ZoomIn },
  { action: 'out', label: 'Zoom out', Icon: ZoomOut },
  { action: 'fit', label: 'Fit to view', Icon: Maximize2 },
] as const;

/** Static force layout: run the simulation to rest once per data change (no jitter, no animation loop). */
function layout(nodes: GraphNodeView[], links: GraphLinkView[], width: number, height: number): Map<string, Placed> {
  const maxValue = Math.max(1, ...nodes.map((n) => n.value));
  const maxWeight = Math.max(1, ...links.map((l) => l.weight));
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  }
  const sim: SimNode[] = nodes.map((n) => ({ id: n.id, r: nodeRadius(n.value, maxValue) }));
  // Unlinked nodes are pulled in harder so they ring the graph instead of flying off and shrinking the fit.
  const pull = (d: SimNode) => (degree.get(d.id) ? 0.06 : 0.25);
  const simLinks = links.map((l) => ({ source: l.source, target: l.target, weight: l.weight }));
  const simulation = forceSimulation<SimNode>(sim)
    .force(
      'link',
      forceLink<SimNode, (typeof simLinks)[number]>(simLinks)
        .id((d) => d.id)
        .distance((l) => 70 - 30 * (l.weight / maxWeight))
        .strength((l) => 0.25 + 0.5 * (l.weight / maxWeight))
    )
    .force('charge', forceManyBody<SimNode>().strength((d) => -90 - d.r * 9))
    .force('collide', forceCollide<SimNode>().radius((d) => d.r + 5))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX<SimNode>(width / 2).strength(pull))
    .force('y', forceY<SimNode>(height / 2).strength((d) => pull(d) * 1.3))
    .stop();
  const ticks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  for (let i = 0; i < ticks; i++) simulation.tick();
  return new Map(sim.map((n) => [n.id, { id: n.id, x: n.x ?? width / 2, y: n.y ?? height / 2, r: n.r }]));
}

export function ForceGraph({
  nodes,
  links,
  label,
  height = 560,
  selectedId,
  focusId,
  onSelect,
  renderTooltip,
  labelCount = 12,
  hiddenGroups,
  edgeTitle,
}: ForceGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [width, setWidth] = useState(0);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = width && width < 640 ? Math.max(360, Math.min(height, Math.round(width * 1.05))) : height;

  // Visible subset (legend toggles hide groups).
  const shownNodes = useMemo(() => (hiddenGroups?.size ? nodes.filter((n) => !hiddenGroups.has(n.group)) : nodes), [nodes, hiddenGroups]);
  const shownLinks = useMemo(() => {
    const ids = new Set(shownNodes.map((n) => n.id));
    return links.filter((l) => ids.has(l.source) && ids.has(l.target));
  }, [links, shownNodes]);

  // Layout uses a fixed virtual canvas; the zoom transform fits it to the viewport.
  const positions = useMemo(() => layout(shownNodes, shownLinks, 1000, 700), [shownNodes, shownLinks]);
  const maxWeight = useMemo(() => Math.max(1, ...shownLinks.map((l) => l.weight)), [shownLinks]);

  const fitTransform = useCallback(() => {
    if (!width || !positions.size) return zoomIdentity;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    positions.forEach((p) => {
      x0 = Math.min(x0, p.x - p.r);
      y0 = Math.min(y0, p.y - p.r);
      x1 = Math.max(x1, p.x + p.r);
      y1 = Math.max(y1, p.y + p.r);
    });
    const pad = 36;
    const k = Math.min((width - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, y1 - y0), 1.6);
    return zoomIdentity.translate(width / 2 - (k * (x0 + x1)) / 2, h / 2 - (k * (y0 + y1)) / 2).scale(k);
  }, [positions, width, h]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .on('zoom', (e: { transform: ZoomTransform }) => setTransform(e.transform));
    zoomRef.current = z;
    select(svg).call(z).on('dblclick.zoom', null);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  // Fit on new data / resize.
  useEffect(() => {
    const svg = svgRef.current;
    if (svg && zoomRef.current && width) select(svg).call(zoomRef.current.transform, fitTransform());
  }, [fitTransform, width]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(200).call(zoomRef.current.scaleBy, factor);
  };
  const fit = () => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(250).call(zoomRef.current.transform, fitTransform());
  };

  const activeId = hoverId || focusedId || selectedId || null;
  const neighbours = useMemo(() => {
    if (!activeId) return null;
    const s = new Set<string>([activeId]);
    for (const l of shownLinks) {
      if (l.source === activeId) s.add(l.target);
      else if (l.target === activeId) s.add(l.source);
    }
    return s;
  }, [activeId, shownLinks]);

  const labelled = useMemo(() => {
    const s = new Set([...shownNodes].sort((a, b) => b.value - a.value).slice(0, labelCount).map((n) => n.id));
    if (focusId) s.add(focusId);
    if (selectedId) s.add(selectedId);
    return s;
  }, [shownNodes, labelCount, focusId, selectedId]);

  // Draw order: biggest first so small nodes stay clickable; tab order follows importance too.
  const ordered = useMemo(() => [...shownNodes].sort((a, b) => b.value - a.value), [shownNodes]);
  const tipNode = activeId ? shownNodes.find((n) => n.id === (hoverId || focusedId)) : null;
  const tipPos = tipNode ? positions.get(tipNode.id) : null;
  const [tx, ty] = tipPos ? transform.apply([tipPos.x, tipPos.y]) : [0, 0];

  const onKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(selectedId === id ? null : id);
    } else if (e.key === 'Escape') {
      onSelect?.(null);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full select-none overflow-hidden rounded-lg bg-stone-50/70 dark:bg-gray-900/40" style={{ height: h }}>
      <svg
        ref={svgRef}
        width={width || '100%'}
        height={h}
        role="group"
        aria-label={`${label}. ${shownNodes.length} nodes and ${shownLinks.length} links. Tab to move between nodes, Enter to select. A table view is available.`}
        className="block cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect?.(null);
        }}
      >
        <g transform={transform.toString()}>
          <g aria-hidden>
            {shownLinks.map((l) => {
              const a = positions.get(l.source);
              const b = positions.get(l.target);
              if (!a || !b) return null;
              const on = neighbours ? l.source === activeId || l.target === activeId : false;
              return (
                <line
                  key={`${l.source}|${l.target}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeLinecap="round"
                  className={on ? 'stroke-wine dark:stroke-amber' : 'stroke-stone-400 dark:stroke-gray-500'}
                  style={{
                    strokeWidth: edgeWidth(l.weight, maxWeight) / Math.sqrt(transform.k),
                    opacity: neighbours ? (on ? 0.9 : 0.1) : 0.45,
                  }}
                >
                  {edgeTitle && <title>{edgeTitle(l)}</title>}
                </line>
              );
            })}
          </g>
          {ordered.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const dim = neighbours && !neighbours.has(n.id);
            const selected = selectedId === n.id;
            const showLabel = labelled.has(n.id) || n.id === activeId || (!!neighbours && neighbours.size <= 10 && neighbours.has(n.id));
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                tabIndex={0}
                role="button"
                aria-label={n.ariaLabel}
                aria-pressed={selected}
                className="cursor-pointer outline-none"
                style={{ opacity: dim ? 0.25 : 1 }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setFocusedId(n.id)}
                onBlur={() => setFocusedId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(selected ? null : n.id);
                }}
                onKeyDown={(e) => onKey(e, n.id)}
              >
                {(selected || focusedId === n.id) && (
                  <circle r={p.r + 5} className="fill-none stroke-wine dark:stroke-amber" strokeWidth={2.5 / Math.sqrt(transform.k)} />
                )}
                {focusId === n.id && !selected && (
                  <circle r={p.r + 5} className="fill-none stroke-wine dark:stroke-amber" strokeWidth={1.5} strokeDasharray="3 3" />
                )}
                <circle r={p.r} style={{ fill: n.color, stroke: 'var(--viz-surface)', strokeWidth: 1.5 }} />
                {showLabel && (
                  <text
                    y={p.r + 12 / transform.k}
                    textAnchor="middle"
                    className="pointer-events-none fill-stone-700 font-medium dark:fill-gray-200"
                    style={{ paintOrder: 'stroke', stroke: 'var(--viz-surface)', strokeWidth: 3 / transform.k, strokeLinejoin: 'round' }}
                    fontSize={11.5 / transform.k}
                  >
                    {n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {tipNode && tipPos && renderTooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800"
          style={{ left: Math.min(Math.max(tx + 14, 8), Math.max(8, width - 270)), top: Math.max(ty - 10, 8) }}
          role="tooltip"
        >
          {renderTooltip(tipNode)}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
        {ZOOM_BUTTONS.map((b) => (
          <button
            key={b.action}
            type="button"
            onClick={() => (b.action === 'fit' ? fit() : zoomBy(b.action === 'in' ? 1.4 : 1 / 1.4))}
            aria-label={b.label}
            title={b.label}
            className="flex h-8 w-8 items-center justify-center text-stone-600 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wine/40 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <b.Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
