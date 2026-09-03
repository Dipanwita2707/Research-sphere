import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Users, Filter, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { CoAuthor, NetworkNode } from '@/shared/types/research-profile.types';
import { scopusAuthorProfileUrl } from '@/features/research-profile/utils/externalProfileLinks';

export interface NetworkFilters {
  minCollaborations: number;
  timeRange: 'all' | 'recent' | 'last5years';
  showLabels: boolean;
}

interface CoAuthorNetworkProps {
  coAuthors: CoAuthor[];
  mainAuthorName: string;
  onNodeClick?: (coAuthor: CoAuthor) => void;
  filters?: NetworkFilters;
  showToolbar?: boolean;
  onZoomReady?: (handlers: { zoomIn: () => void; zoomOut: () => void; reset: () => void }) => void;
}

const COLORS = {
  maroon: '#7d1a34',
  gold: '#c8973f',
  purple: '#8b6fc0',
  gray: '#8a7f86',
  grayLight: '#b5abb2',
  textDark: '#2b1d22',
  textGray: '#7a7178',
};

type NodeTier = 'main' | 'high' | 'medium' | 'low';

interface LayoutNode extends NetworkNode {
  x: number;
  y: number;
  tier: NodeTier;
  radius: number;
  spokeIndex?: number;
}

type SimNode = LayoutNode & d3.SimulationNodeDatum & {
  targetX: number;
  targetY: number;
  z: number;
  floatPhase: number;
  floatSpeed: number;
  curveSeed: number;
};

const SPOKE_ANGLES = [-Math.PI / 2, -2.64, -0.5, 2.44, 0.61];

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.length > 14 ? `${name.slice(0, 12)}…` : name;
  const titles = ['dr.', 'prof.', 'mr.', 'ms.', 'mrs.'];
  const hasTitle = titles.includes(parts[0].toLowerCase());
  if (hasTitle && parts.length > 2) return `${parts[0]} ${parts[1].slice(0, 1)}. ${parts[parts.length - 1]}`;
  if (hasTitle) return name.length > 16 ? `${parts[0]} ${parts[1]?.slice(0, 1) ?? ''}. …` : name;
  return `${parts[0].slice(0, 1)}. ${parts[parts.length - 1]}`;
}

function nodeDisplayOpacity(tier: NodeTier, rz: number): number {
  const depth = 0.6 + (rz + 0.5) * 0.2;
  switch (tier) {
    case 'main': return 1;
    case 'high': return Math.min(1, depth + 0.25);
    case 'medium': return Math.max(0.92, depth + 0.38);
    case 'low': return Math.max(0.88, depth + 0.42);
  }
}

function getGradientId(tier: NodeTier): string {
  switch (tier) {
    case 'main': return 'url(#sphere-gold)';
    case 'high': return 'url(#sphere-maroon)';
    case 'medium': return 'url(#sphere-purple)';
    case 'low': return 'url(#sphere-gray)';
  }
}

function polar(cx: number, cy: number, angle: number, dist: number) {
  return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
}

function midAngle(a: number, b: number): number {
  let diff = b - a;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff / 2;
}

/** Quadratic bezier arc — bulges outward, never a straight line */
function curvedPath(
  x1: number, y1: number, x2: number, y2: number,
  seed: number, tier: NodeTier
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const sign = seed % 2 === 0 ? 1 : -1;
  const bulgeFactor = tier === 'high' ? 0.32 : tier === 'medium' ? 0.38 : 0.42 + (seed % 5) * 0.04;
  const bulge = dist * bulgeFactor * sign;
  const mx = (x1 + x2) / 2 + nx * bulge;
  const my = (y1 + y2) / 2 + ny * bulge;
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
}

function depthScale(z: number): number {
  return 1 + z * 0.22;
}

function computeRadialLayout(
  coAuthorNodes: NetworkNode[],
  width: number,
  height: number,
  mainAuthorName: string
): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2 + 12;
  const scale = Math.min(width / 900, height / 720);
  const spread = 1.32;
  const rHigh = 228 * scale * spread;
  const rMedium = 128 * scale * spread;
  const rLow = 318 * scale * spread;

  const sorted = [...coAuthorNodes].sort((a, b) => b.collaborationCount - a.collaborationCount);
  const maxCount = sorted[0]?.collaborationCount ?? 1;

  const nodes: LayoutNode[] = [{
    id: 'main',
    name: mainAuthorName,
    affiliation: 'ResearchSphere',
    collaborationCount: 0,
    isMainAuthor: true,
    x: cx, y: cy,
    tier: 'main',
    radius: 34 * scale,
  }];

  const highPositions: { x: number; y: number; angle: number }[] = [];

  sorted.slice(0, 5).forEach((node, i) => {
    const angle = SPOKE_ANGLES[i % SPOKE_ANGLES.length];
    const pos = polar(cx, cy, angle, rHigh);
    highPositions.push({ ...pos, angle });
    nodes.push({
      ...node,
      x: pos.x, y: pos.y,
      tier: 'high',
      radius: (16 + (node.collaborationCount / maxCount) * 6) * scale,
      spokeIndex: i,
    });
  });

  const mediumSlots: { angle: number; dist: number }[] = [];
  SPOKE_ANGLES.forEach(angle => mediumSlots.push({ angle, dist: rMedium }));
  for (let i = 0; i < SPOKE_ANGLES.length; i++) {
    mediumSlots.push({
      angle: midAngle(SPOKE_ANGLES[i], SPOKE_ANGLES[(i + 1) % SPOKE_ANGLES.length]),
      dist: rMedium * 0.92,
    });
  }

  sorted.slice(5, 15).forEach((node, i) => {
    const slot = mediumSlots[i % mediumSlots.length];
    const jitter = (i % 2 === 0 ? 1 : -1) * 18 * scale;
    const angleOffset = ((i % 5) - 2) * 0.06;
    const pos = polar(cx, cy, slot.angle + angleOffset + jitter * 0.006, slot.dist * 1.04);
    nodes.push({ ...node, x: pos.x, y: pos.y, tier: 'medium', radius: 10 * scale, spokeIndex: i % 5 });
  });

  const lowBySpoke: NetworkNode[][] = Array.from({ length: 5 }, () => []);
  sorted.slice(15).forEach((node, i) => lowBySpoke[i % 5].push(node));

  lowBySpoke.forEach((group, spokeIdx) => {
    const anchor = highPositions[spokeIdx] ?? { ...polar(cx, cy, SPOKE_ANGLES[spokeIdx], rHigh), angle: SPOKE_ANGLES[spokeIdx] };
    const clusterCap = 4;

    group.slice(0, clusterCap).forEach((node, idx) => {
      const branch = idx % 2 === 0 ? -0.42 : 0.42;
      const step = Math.floor(idx / 2);
      const along = (58 + step * 44) * scale;
      const perp = branch * (30 + (step % 3) * 16) * scale;
      const clusterAngle = anchor.angle + branch * 0.12;
      nodes.push({
        ...node,
        x: anchor.x + Math.cos(clusterAngle) * along + Math.cos(clusterAngle + Math.PI / 2) * perp,
        y: anchor.y + Math.sin(clusterAngle) * along + Math.sin(clusterAngle + Math.PI / 2) * perp,
        tier: 'low', radius: 9 * scale, spokeIndex: spokeIdx,
      });
    });

    group.slice(clusterCap).forEach((node, idx) => {
      const a1 = SPOKE_ANGLES[spokeIdx];
      const a2 = SPOKE_ANGLES[(spokeIdx + 1) % 5];
      const overflow = group.length - clusterCap;
      const t = (idx + 1) / (overflow + 1);
      const arcSpan = 0.42;
      const arcAngle = midAngle(a1, a2) + (t - 0.5) * arcSpan + (idx % 2 === 0 ? 0.08 : -0.08);
      const dist = rLow + (idx % 5) * 24 * scale;
      const pos = polar(cx, cy, arcAngle, dist);
      nodes.push({ ...node, x: pos.x, y: pos.y, tier: 'low', radius: 9 * scale, spokeIndex: spokeIdx });
    });
  });

  return nodes;
}

function showTooltip(event: MouseEvent, d: SimNode) {
  d3.selectAll('.net-tooltip').remove();
  const tierColors: Record<NodeTier, string> = { main: COLORS.gold, high: COLORS.maroon, medium: COLORS.purple, low: COLORS.gray };
  const scopusUrl = scopusAuthorProfileUrl(d.scopusAuthorId);
  let html = `<div style="border-bottom:1px solid #f0e2d2;padding-bottom:6px;margin-bottom:6px;">`;
  if (scopusUrl && !d.isMainAuthor) {
    html += `<a href="${scopusUrl}" target="_blank" rel="noopener noreferrer" style="color:${tierColors[d.tier]};font-size:13px;font-weight:700;text-decoration:none;">${d.name}</a>`;
    html += `<div style="color:#7a7178;font-size:10px;margin-top:4px;">Open Scopus profile ↗</div>`;
  } else {
    html += `<strong style="color:${tierColors[d.tier]};font-size:13px;">${d.name}</strong>`;
  }
  html += `</div>`;
  html += `<div style="color:#7a7178;font-size:11px;margin-bottom:4px;">${d.affiliation}</div>`;
  if (!d.isMainAuthor) {
    html += `<div style="color:${COLORS.maroon};font-weight:600;font-size:11px;">${d.collaborationCount} collaboration${d.collaborationCount !== 1 ? 's' : ''}</div>`;
  }
  d3.select('body').append('div')
    .attr('class', 'net-tooltip')
    .style('position', 'fixed').style('background', '#fff').style('color', COLORS.textDark)
    .style('padding', '12px 14px').style('border-radius', '8px').style('font-size', '12px')
    .style('pointer-events', scopusUrl && !d.isMainAuthor ? 'auto' : 'none').style('z-index', '9999')
    .style('border', '1px solid #f0e2d2').style('box-shadow', '0 8px 20px rgba(0,0,0,0.08)')
    .style('max-width', '220px').html(html)
    .style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
}

function makeSphereGradient(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>, id: string, light: string, mid: string, dark: string) {
  const g = defs.append('radialGradient').attr('id', id).attr('cx', '35%').attr('cy', '30%').attr('r', '65%');
  g.append('stop').attr('offset', '0%').attr('stop-color', light);
  g.append('stop').attr('offset', '55%').attr('stop-color', mid);
  g.append('stop').attr('offset', '100%').attr('stop-color', dark);
}

export default function CoAuthorNetwork({
  coAuthors, mainAuthorName, onNodeClick, filters: externalFilters, showToolbar = true, onZoomReady,
}: CoAuthorNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const parallaxRef = useRef({ mx: 0, my: 0 });
  const [internalFilters, setInternalFilters] = useState<NetworkFilters>({ minCollaborations: 1, timeRange: 'all', showLabels: true });
  const filters = externalFilters ?? internalFilters;
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const networkData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const filtered = coAuthors.filter(ca => {
      if (ca.collaborationCount < filters.minCollaborations) return false;
      if (filters.timeRange === 'recent') return ca.lastCollaboration >= currentYear - 1;
      if (filters.timeRange === 'last5years') return ca.lastCollaboration >= currentYear - 5;
      return true;
    });
    return {
      coAuthorNodes: filtered.map(ca => ({
        id: ca.id, name: ca.name, affiliation: ca.affiliation || 'Unknown',
        collaborationCount: ca.collaborationCount, isMainAuthor: false,
        scopusAuthorId: ca.scopusAuthorId || null, orcid: ca.orcid || null,
      })),
    };
  }, [coAuthors, filters]);

  const handleZoom = useCallback((dir: 'in' | 'out') => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, dir === 'in' ? 1.4 : 0.7);
  }, []);

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  useEffect(() => { onZoomReady?.({ zoomIn: () => handleZoom('in'), zoomOut: () => handleZoom('out'), reset: resetZoom }); }, [onZoomReady, handleZoom, resetZoom]);

  useEffect(() => {
    if (!svgRef.current || networkData.coAuthorNodes.length === 0) return;
    selectedIdRef.current = null;
    cancelAnimationFrame(rafRef.current);

    const container = svgRef.current.parentElement;
    const width = container?.clientWidth || 700;
    const height = 720;
    const layoutNodes = computeRadialLayout(networkData.coAuthorNodes, width, height, mainAuthorName);
    const mainNode = layoutNodes.find(n => n.isMainAuthor)!;
    const cx = mainNode.x;
    const cy = mainNode.y;

    const simNodes: SimNode[] = layoutNodes.map(n => {
      const seed = hashSeed(n.id);
      const zBase = n.tier === 'main' ? 0.3 : n.tier === 'high' ? 0.15 + (seed % 10) * 0.02 : n.tier === 'medium' ? -0.05 - (seed % 8) * 0.02 : -0.2 - (seed % 12) * 0.025;
      return {
        ...n, targetX: n.x, targetY: n.y,
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        z: zBase,
        floatPhase: (seed % 628) / 100,
        floatSpeed: 0.45 + (seed % 20) / 40,
        curveSeed: seed,
      };
    });

    const mainSim = simNodes.find(n => n.isMainAuthor)!;
    mainSim.fx = cx; mainSim.fy = cy; mainSim.x = cx; mainSim.y = cy;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    makeSphereGradient(defs, 'sphere-gold', '#f5d89a', COLORS.gold, '#8a6420');
    makeSphereGradient(defs, 'sphere-maroon', '#c4567a', COLORS.maroon, '#4a0f22');
    makeSphereGradient(defs, 'sphere-purple', '#e8dff5', '#9b7fd4', '#5c4688');
    makeSphereGradient(defs, 'sphere-gray', '#ece6ea', '#a3949c', '#6b5f66');

    const shadow = defs.append('filter').attr('id', 'node-shadow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    shadow.append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 4).attr('flood-color', '#2b1d22').attr('flood-opacity', 0.18);

    const glow = defs.append('filter').attr('id', 'node-glow').attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
    glow.append('feGaussianBlur').attr('stdDeviation', 6).attr('result', 'blur');
    const gm = glow.append('feMerge');
    gm.append('feMergeNode').attr('in', 'blur');
    gm.append('feMergeNode').attr('in', 'SourceGraphic');

    defs.append('style').text(`
      @keyframes net-orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes net-pulse-glow { 0%,100% { opacity: 0.08; } 50% { opacity: 0.2; } }
      @keyframes net-dash-flow { to { stroke-dashoffset: -30; } }
      .net-orbit { transform-origin: ${cx}px ${cy}px; animation: net-orbit-spin 32s linear infinite; }
      .net-pulse-outer { animation: net-pulse-glow 3.5s ease-in-out infinite; }
      .net-pulse-inner { animation: net-pulse-glow 3.5s ease-in-out infinite 0.7s; }
      .net-flow-line { animation: net-dash-flow 3s linear infinite; }
    `);

    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    const tiltLayer = zoomLayer.append('g').attr('class', 'tilt-layer');
    const sceneLayer = tiltLayer.append('g').attr('class', 'scene-layer');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', event => zoomLayer.attr('transform', event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    svg.on('mousemove.parallax', (event) => {
      const rect = (svg.node() as SVGSVGElement).getBoundingClientRect();
      parallaxRef.current.mx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      parallaxRef.current.my = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }).on('mouseleave.parallax', () => { parallaxRef.current.mx = 0; parallaxRef.current.my = 0; });

    const coAuthorsOnly = simNodes.filter(n => !n.isMainAuthor);

    const linksLayer = sceneLayer.append('g').attr('class', 'links');
    const spokeLinks = linksLayer.selectAll('.spoke-link')
      .data(coAuthorsOnly).enter().append('path')
      .attr('class', 'spoke-link').attr('fill', 'none')
      .attr('stroke', COLORS.gray)
      .attr('stroke-width', d => (d.tier === 'low' ? 1 : d.tier === 'medium' ? 1.1 : 1.2))
      .attr('stroke-dasharray', '5 5').attr('opacity', 0);

    const strongLinks = linksLayer.selectAll('.strong-link')
      .data(coAuthorsOnly.filter(n => n.tier === 'high')).enter().append('path')
      .attr('class', 'strong-link net-flow-line').attr('fill', 'none')
      .attr('stroke', COLORS.maroon).attr('stroke-width', 2)
      .attr('stroke-dasharray', '7 4').attr('opacity', 0);

    sceneLayer.append('ellipse')
      .attr('class', 'net-orbit').attr('cx', cx).attr('cy', cy)
      .attr('rx', 58).attr('ry', 22)
      .attr('fill', 'none').attr('stroke', COLORS.gold)
      .attr('stroke-width', 0.7).attr('stroke-dasharray', '4 7').attr('opacity', 0.35);

    sceneLayer.append('circle')
      .attr('class', 'net-orbit').attr('cx', cx).attr('cy', cy).attr('r', 54)
      .attr('fill', 'none').attr('stroke', COLORS.gold)
      .attr('stroke-width', 0.6).attr('stroke-dasharray', '3 8').attr('opacity', 0.3);

    const nodesLayer = sceneLayer.append('g').attr('class', 'nodes-layer');
    const nodeGroups = nodesLayer.selectAll<SVGGElement, SimNode>('.node-group')
      .data(simNodes, d => d.id)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('opacity', 0)
      .style('cursor', d => (d.isMainAuthor ? 'default' : 'grab'));

    nodeGroups.filter(d => d.tier === 'main').append('circle').attr('class', 'net-pulse-outer')
      .attr('r', 78).attr('fill', COLORS.gold).attr('opacity', 0.1);
    nodeGroups.filter(d => d.tier === 'main').append('circle').attr('class', 'net-pulse-inner')
      .attr('r', 52).attr('fill', COLORS.gold).attr('opacity', 0.14);
    nodeGroups.filter(d => d.tier === 'high').append('circle').attr('class', 'hover-ring')
      .attr('r', d => d.radius + 12).attr('fill', 'none').attr('stroke', COLORS.maroon)
      .attr('stroke-width', 0).attr('opacity', 0);
    nodeGroups.filter(d => d.tier === 'medium' || d.tier === 'low').append('circle').attr('class', 'node-halo')
      .attr('r', d => d.radius + 4).attr('fill', 'none')
      .attr('stroke', d => (d.tier === 'medium' ? COLORS.purple : COLORS.grayLight))
      .attr('stroke-width', 1.5).attr('opacity', d => (d.tier === 'medium' ? 0.55 : 0.65));
    nodeGroups.append('circle').attr('class', 'node-shadow')
      .attr('r', d => d.radius * 0.95).attr('fill', '#2b1d22').attr('opacity', d => (d.tier === 'low' ? 0.18 : 0.12))
      .attr('transform', 'translate(2, 4)');
    nodeGroups.append('circle').attr('class', 'node-circle').attr('r', 0)
      .attr('fill', d => getGradientId(d.tier))
      .attr('stroke', d => {
        if (d.tier === 'main') return '#fff';
        if (d.tier === 'high') return '#f2d9df';
        if (d.tier === 'medium') return '#ece4f4';
        return '#ffffff';
      })
      .attr('stroke-width', d => {
        if (d.tier === 'main') return 4;
        if (d.tier === 'high') return 5;
        if (d.tier === 'medium') return 2.5;
        return 2;
      })
      .attr('filter', d => (d.tier === 'main' ? 'url(#node-glow)' : 'url(#node-shadow)'));
    nodeGroups.filter(d => d.tier === 'medium' || d.tier === 'low').append('text').attr('class', 'node-ball-initial')
      .text(d => getInitials(d.name))
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', d => (d.tier === 'medium' ? '8px' : '7px'))
      .attr('font-weight', '700')
      .attr('fill', '#fff')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(43,29,34,0.45)');
    nodeGroups.filter(d => d.tier === 'main').append('text').attr('class', 'node-initials')
      .text(getInitials(mainAuthorName)).attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', '16px').attr('font-weight', '800').attr('fill', '#fff').attr('opacity', 0)
      .style('pointer-events', 'none');
    const labelGroups = nodeGroups.append('g').attr('class', 'labels').attr('opacity', 0);
    labelGroups.filter(d => d.tier === 'main').append('text').text(mainAuthorName)
      .attr('text-anchor', 'middle').attr('dy', d => d.radius + 24)
      .attr('font-size', '14.5px').attr('font-weight', '700').attr('fill', COLORS.textDark)
      .style('pointer-events', 'none');
    labelGroups.filter(d => d.tier === 'high').append('text').attr('class', 'name-label')
      .text(d => d.name).attr('text-anchor', 'middle').attr('dy', d => d.radius + 22)
      .attr('font-size', '15px').attr('font-weight', '700').attr('fill', COLORS.textDark)
      .style('pointer-events', 'none');
    labelGroups.filter(d => d.tier === 'high').append('text').attr('class', 'count-label')
      .text(d => `${d.collaborationCount} collaborations`).attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 40).attr('font-size', '12.5px').attr('fill', COLORS.textGray)
      .style('pointer-events', 'none');
    labelGroups.filter(d => d.tier === 'medium').append('text').attr('class', 'small-name-label')
      .text(d => abbreviateName(d.name)).attr('text-anchor', 'middle').attr('dy', d => d.radius + 18)
      .attr('font-size', '11px').attr('font-weight', '600').attr('fill', COLORS.textDark)
      .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
      .style('pointer-events', 'none');
    labelGroups.filter(d => d.tier === 'medium').append('text').attr('class', 'small-count-label')
      .text(d => `${d.collaborationCount}`).attr('text-anchor', 'middle').attr('dy', d => d.radius + 32)
      .attr('font-size', '9.5px').attr('font-weight', '700').attr('fill', COLORS.purple)
      .attr('stroke', '#fff').attr('stroke-width', 2).attr('paint-order', 'stroke')
      .style('pointer-events', 'none');
    labelGroups.filter(d => d.tier === 'low').append('text').attr('class', 'small-name-label')
      .text(d => abbreviateName(d.name)).attr('text-anchor', 'middle').attr('dy', d => d.radius + 17)
      .attr('font-size', '10px').attr('font-weight', '600').attr('fill', COLORS.textDark)
      .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
      .style('pointer-events', 'none');

    function getDisplayPos(n: SimNode, t: number) {
      const bx = n.x ?? cx;
      const by = n.y ?? cy;
      const zOsc = Math.sin(t * 0.7 + n.floatPhase) * 0.12;
      const rz = n.z + zOsc;
      const floatX = Math.sin(t * n.floatSpeed + n.floatPhase) * (3 + n.radius * 0.05);
      const floatY = Math.cos(t * n.floatSpeed * 0.85 + n.floatPhase * 1.3) * (2.5 + n.radius * 0.04);
      const px = parallaxRef.current.mx * (8 + rz * 20);
      const py = parallaxRef.current.my * (6 + rz * 16);
      const sc = depthScale(rz);
      return {
        x: bx + floatX + px,
        y: by + floatY + py - rz * 18,
        z: rz,
        scale: sc,
        opacity: nodeDisplayOpacity(n.tier, rz),
      };
    }

    function highlightNode(activeId: string | null) {
      spokeLinks.attr('opacity', d => {
        if (!activeId) return d.tier === 'low' ? 0.58 : d.tier === 'medium' ? 0.72 : 0.85;
        return d.id === activeId ? 0.95 : 0.06;
      });
      strongLinks.attr('opacity', d => (!activeId ? 0.8 : d.id === activeId ? 1 : 0.04));
      nodeGroups.select('.hover-ring')
        .attr('stroke-width', d => (d.id === activeId ? 2.5 : 0))
        .attr('opacity', d => (d.id === activeId ? 0.65 : 0));
    }

    nodeGroups
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.isMainAuthor) return;
        selectedIdRef.current = selectedIdRef.current === d.id ? null : d.id;
        highlightNode(selectedIdRef.current);
          const ca = coAuthors.find(c => c.id === d.id);
        if (ca && onNodeClick) onNodeClick(ca);
      })
      .on('mouseover', (event, d) => { highlightNode(selectedIdRef.current ?? d.id); showTooltip(event, d); })
      .on('mousemove', (event) => {
        d3.selectAll('.net-tooltip').style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
      })
      .on('mouseout', () => { highlightNode(selectedIdRef.current); d3.selectAll('.net-tooltip').remove(); });

    svg.on('click.clear', () => { selectedIdRef.current = null; highlightNode(null); });

    const simulation = d3.forceSimulation(simNodes)
      .force('x', d3.forceX<SimNode>(d => d.targetX).strength(d => (d.isMainAuthor ? 1 : d.tier === 'high' ? 0.07 : 0.04)))
      .force('y', d3.forceY<SimNode>(d => d.targetY).strength(d => (d.isMainAuthor ? 1 : d.tier === 'high' ? 0.07 : 0.04)))
      .force('collide', d3.forceCollide<SimNode>().radius(d => d.radius + (d.tier === 'low' ? 16 : d.tier === 'medium' ? 18 : 22)).strength(0.85))
      .force('charge', d3.forceManyBody<SimNode>().strength(d => {
        if (d.isMainAuthor) return 0;
        if (d.tier === 'high') return -65;
        if (d.tier === 'medium') return -32;
        return -22;
      }))
      .alpha(1).alphaDecay(0.014).velocityDecay(0.42);

    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (d.isMainAuthor) return;
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x; d.fy = d.y;
        d3.select(event.sourceEvent.target.closest('.node-group')).style('cursor', 'grabbing');
      })
      .on('drag', (event, d) => { if (!d.isMainAuthor) { d.fx = event.x; d.fy = event.y; } })
      .on('end', (event, d) => {
        if (d.isMainAuthor) return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
        d3.select(event.sourceEvent.target.closest('.node-group')).style('cursor', 'grab');
      });
    nodeGroups.filter(d => !d.isMainAuthor).call(drag as never);

    const startTime = performance.now();
    let frameCount = 0;

    function updateScene(now: number) {
      const t = (now - startTime) / 1000;
      const { mx, my } = parallaxRef.current;
      const activeId = selectedIdRef.current;

      const tiltNode = tiltLayer.node();
      if (tiltNode) {
        tiltNode.setAttribute('transform', `skewY(${my * 1.4}) skewX(${mx * -1.8})`);
      }

      spokeLinks.each(function (d) {
        const p = getDisplayPos(d, t);
        this.setAttribute('d', curvedPath(cx, cy, p.x, p.y, d.curveSeed, d.tier));
      });
      strongLinks.each(function (d) {
        const p = getDisplayPos(d, t);
        this.setAttribute('d', curvedPath(cx, cy, p.x, p.y, d.curveSeed, 'high'));
      });

      nodeGroups.each(function (d) {
        const pos = getDisplayPos(d, t);
        const dimmed = activeId && d.id !== activeId && !d.isMainAuthor;
        const baseOpacity = nodeDisplayOpacity(d.tier, pos.z);
        this.setAttribute('transform', `translate(${pos.x},${pos.y}) scale(${pos.scale})`);
        this.setAttribute('opacity', String(dimmed ? 0.2 : baseOpacity));
      });

      frameCount += 1;
      if (frameCount % 120 === 0) {
        const nodes = nodesLayer.selectAll<SVGGElement, SimNode>('.node-group').nodes();
        nodes.sort((a, b) => {
          const da = d3.select(a).datum() as SimNode;
          const db = d3.select(b).datum() as SimNode;
          return getDisplayPos(da, t).z - getDisplayPos(db, t).z;
        });
        nodes.forEach(node => node.parentNode?.appendChild(node));
      }
    }

    function renderFrame(now: number) {
      updateScene(now);
      rafRef.current = requestAnimationFrame(renderFrame);
    }

    rafRef.current = requestAnimationFrame(renderFrame);

    nodeGroups.transition().duration(800).delay((_d, i) => i * 16).attr('opacity', 1);
    nodeGroups.select('.node-circle').transition().duration(700).delay((_d, i) => i * 16).attr('r', d => d.radius);
    nodeGroups.select('.node-initials').transition().duration(400).delay(250).attr('opacity', 1);
    nodeGroups.select('.labels').transition().duration(500).delay(550).attr('opacity', filters.showLabels ? 1 : 0);
    spokeLinks.transition().duration(900).delay((_d, i) => 150 + i * 6)
      .attr('opacity', d => (d.tier === 'low' ? 0.58 : d.tier === 'medium' ? 0.72 : 0.85));
    strongLinks.transition().duration(1000).delay((_d, i) => 250 + i * 55).attr('opacity', 0.8);

    simulation.restart();

    return () => {
      simulation.stop();
      cancelAnimationFrame(rafRef.current);
      svg.on('mousemove.parallax', null).on('mouseleave.parallax', null).on('click.clear', null);
      d3.selectAll('.net-tooltip').remove();
    };
  }, [networkData, filters.showLabels, coAuthors, onNodeClick, mainAuthorName]);

  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).selectAll('.labels').transition().duration(300).attr('opacity', filters.showLabels ? 1 : 0);
  }, [filters.showLabels]);

  if (coAuthors.length === 0) {
    return (
      <div className="py-14 text-center">
        <div className="w-14 h-14 rounded-full bg-[#fdf5ec] flex items-center justify-center mx-auto mb-3">
          <Users className="w-7 h-7 text-[#7a7178]" />
        </div>
        <h3 className="text-sm font-semibold text-[#2b1d22] mb-1">No co-authors yet</h3>
        <p className="text-xs text-[#7a7178]">Co-author network will appear once publications with multiple authors are added.</p>
      </div>
    );
  }

  const graphContent = (
    <div ref={containerRef} className="cn-graph-wrap relative pt-4 pl-[130px]" style={{ perspective: '900px' }}>
      <div className="cn-legend absolute left-0 top-[14px] z-[2] flex flex-col gap-2.5 text-[12.5px] text-[#2b1d22]">
        {[
          [COLORS.gold, 'You (Main Author)'],
          [COLORS.maroon, 'Co-authors (High Collaboration)'],
          [COLORS.purple, 'Co-authors (Medium Collaboration)'],
          [COLORS.grayLight, 'Co-authors (Low Collaboration)'],
        ].map(([color, label]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: color as string }} />
            {label}
          </div>
        ))}
      </div>
      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-[#9a9198] pointer-events-none select-none z-[2]">
        Curved links · 3D float · Drag nodes · Scroll to zoom · Hover to highlight
      </p>
      <svg ref={svgRef} className="w-full cursor-grab active:cursor-grabbing" style={{ minHeight: 720 }} />
    </div>
  );

  if (!showToolbar) return graphContent;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border border-[#f0e2d2] rounded-lg">
        <Filter className="w-3.5 h-3.5 text-[#7d1a34] shrink-0" />
        <span className="text-xs font-semibold text-[#7d1a34] mr-1">Filter &amp; Settings</span>
        <select value={internalFilters.minCollaborations} onChange={e => setInternalFilters(p => ({ ...p, minCollaborations: parseInt(e.target.value, 10) }))} className="text-xs border border-[#f0e2d2] rounded px-2.5 py-1 bg-white text-[#2b1d22]">
          <option value={1}>1+</option><option value={2}>2+</option><option value={5}>5+</option><option value={10}>10+</option>
        </select>
        <select value={internalFilters.timeRange} onChange={e => setInternalFilters(p => ({ ...p, timeRange: e.target.value as NetworkFilters['timeRange'] }))} className="text-xs border border-[#f0e2d2] rounded px-2.5 py-1 bg-white text-[#2b1d22]">
          <option value="all">All time</option><option value="last5years">Last 5 years</option><option value="recent">Last year</option>
        </select>
        <label className="flex items-center gap-1.5 cursor-pointer text-[#2b1d22]">
          <input type="checkbox" checked={internalFilters.showLabels} onChange={e => setInternalFilters(p => ({ ...p, showLabels: e.target.checked }))} className="rounded border-[#f0e2d2] accent-[#7d1a34] w-4 h-4" />
          <span className="text-xs font-semibold">Show Labels</span>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => handleZoom('in')} className="p-1.5 rounded border border-[#f0e2d2] text-[#7a7178] hover:text-[#7d1a34] hover:bg-[#fdf5ec]"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => handleZoom('out')} className="p-1.5 rounded border border-[#f0e2d2] text-[#7a7178] hover:text-[#7d1a34] hover:bg-[#fdf5ec]"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={resetZoom} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[#f0e2d2] text-[#7a7178] hover:text-[#7d1a34] hover:bg-[#fdf5ec]"><RotateCcw className="w-3 h-3" /> Reset</button>
        </div>
      </div>
      {graphContent}
    </div>
  );
}
