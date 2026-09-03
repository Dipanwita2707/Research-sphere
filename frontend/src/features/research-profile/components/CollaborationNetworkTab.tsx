'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  Filter,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Building2,
  Globe,
  Heart,
  Calendar,
  Star,
  TrendingUp,
  LineChart,
} from 'lucide-react';
import type { CoAuthor } from '@/shared/types/research-profile.types';
import { scopusAuthorProfileUrl } from '@/features/research-profile/utils/externalProfileLinks';

const CoAuthorNetwork = dynamic(
  () => import('@/features/research-profile/components/CoAuthorNetwork'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[620px] bg-[#fdf5ec] rounded-xl animate-pulse border border-[#f0e2d2]" />
    ),
  }
);

export interface NetworkFilters {
  minCollaborations: number;
  timeRange: 'all' | 'recent' | 'last5years';
  showLabels: boolean;
}

interface CollaborationNetworkTabProps {
  coAuthors: CoAuthor[];
  mainAuthorName: string;
}

function getInitials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function extractCountry(affiliation: string | null | undefined): string | null {
  if (!affiliation) return null;
  const parts = affiliation.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return null;
}

function computeNetworkStats(coAuthors: CoAuthor[]) {
  const currentYear = new Date().getFullYear();
  const totalCollaborations = coAuthors.reduce((sum, ca) => sum + ca.collaborationCount, 0);
  const institutions = new Set(
    coAuthors.map(ca => ca.affiliation?.trim()).filter(Boolean) as string[]
  );
  const countries = new Set(
    coAuthors.map(ca => extractCountry(ca.affiliation)).filter(Boolean) as string[]
  );
  const sorted = [...coAuthors].sort((a, b) => b.collaborationCount - a.collaborationCount);
  const top = sorted[0];
  const activeThisYear = coAuthors.filter(
    ca => ca.lastCollaboration >= currentYear || ca.firstCollaboration >= currentYear
  ).length;
  const activeLastYear = coAuthors.filter(
    ca => ca.lastCollaboration === currentYear - 1
  ).length;
  const trendPct =
    activeLastYear > 0
      ? ((activeThisYear - activeLastYear) / activeLastYear) * 100
      : activeThisYear > 0
        ? 100
        : 0;

  return {
    totalCoAuthors: coAuthors.length,
    totalCollaborations,
    institutions: institutions.size,
    countries: countries.size,
    topCollaborator: top,
    activeThisYear,
    avgPerAuthor: coAuthors.length > 0 ? totalCollaborations / coAuthors.length : 0,
    trendPct,
    sortedTop5: sorted.slice(0, 5),
    maxCount: sorted[0]?.collaborationCount ?? 1,
  };
}

export default function CollaborationNetworkTab({
  coAuthors,
  mainAuthorName,
}: CollaborationNetworkTabProps) {
  const [filters, setFilters] = useState<NetworkFilters>({
    minCollaborations: 1,
    timeRange: 'all',
    showLabels: true,
  });
  const [zoomHandlers, setZoomHandlers] = useState<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
  } | null>(null);

  const stats = useMemo(() => computeNetworkStats(coAuthors), [coAuthors]);

  if (coAuthors.length === 0) {
    return (
      <div className="collab-network-tab">
        <div className="cn-page-head">
          <div>
            <h2 className="cn-title">Collaboration Network</h2>
            <p className="cn-subtitle">Explore co-authorship connections and collaborative relationships</p>
          </div>
          <div className="cn-count-badge">
            <Users className="w-4 h-4 text-[#7d1a34]" />
            0 collaborators
          </div>
        </div>
        <div className="cn-empty">
          <div className="cn-empty-icon">
            <Users className="w-6 h-6 text-[#7d1a34]" />
          </div>
          <h3>No collaborations found</h3>
          <p>This researcher hasn&apos;t logged any co-authored publications yet.</p>
        </div>
        <style>{NETWORK_CSS}</style>
      </div>
    );
  }

  return (
    <div className="collab-network-tab">
      <div className="cn-page-head">
        <div>
          <h2 className="cn-title">Collaboration Network</h2>
          <p className="cn-subtitle">Explore co-authorship connections and collaborative relationships</p>
        </div>
        <div className="cn-count-badge">
          <Users className="w-4 h-4 text-[#7d1a34]" />
          {coAuthors.length} collaborator{coAuthors.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="cn-main-panel">
        <div className="cn-toolbar">
          <span className="cn-filter-label">
            <Filter className="w-4 h-4" />
            Filter &amp; Settings
          </span>
          <span className="cn-field">
            Min. Collaborations
            <select
              value={filters.minCollaborations}
              onChange={e =>
                setFilters(p => ({ ...p, minCollaborations: parseInt(e.target.value, 10) }))
              }
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={5}>5+</option>
              <option value={10}>10+</option>
            </select>
          </span>
          <span className="cn-field">
            Time Period
            <select
              value={filters.timeRange}
              onChange={e =>
                setFilters(p => ({ ...p, timeRange: e.target.value as NetworkFilters['timeRange'] }))
              }
            >
              <option value="all">All time</option>
              <option value="last5years">Last 5 years</option>
              <option value="recent">Last year</option>
            </select>
          </span>
          <label className="cn-checkbox">
            <input
              type="checkbox"
              checked={filters.showLabels}
              onChange={e => setFilters(p => ({ ...p, showLabels: e.target.checked }))}
            />
            Show Labels
          </label>
          <div className="cn-toolbar-right">
            <button type="button" className="cn-tool-icon" onClick={() => zoomHandlers?.zoomIn()} aria-label="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button type="button" className="cn-tool-icon" onClick={() => zoomHandlers?.zoomOut()} aria-label="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button type="button" className="cn-tool-icon" aria-label="Fit view" onClick={() => zoomHandlers?.reset()}>
              <Maximize2 className="w-4 h-4" />
            </button>
            <button type="button" className="cn-reset-btn" onClick={() => zoomHandlers?.reset()}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="cn-graph-layout">
          <CoAuthorNetwork
            coAuthors={coAuthors}
            mainAuthorName={mainAuthorName}
            filters={filters}
            showToolbar={false}
            onZoomReady={setZoomHandlers}
          />

          <div className="cn-side-panel">
            <div className="cn-overview-card">
              <h3>Network Overview</h3>
              <div className="cn-ov-grid">
                <div className="cn-ov-item">
                  <span className="cn-ov-icon">
                    <Users className="w-[17px] h-[17px]" />
                  </span>
                  <div>
                    <div className="cn-ov-value">{stats.totalCoAuthors}</div>
                    <div className="cn-ov-label">Total Co-authors</div>
                  </div>
                </div>
                <div className="cn-ov-item">
                  <span className="cn-ov-icon">
                    <GitBranch className="w-[17px] h-[17px]" />
                  </span>
                  <div>
                    <div className="cn-ov-value">{stats.totalCollaborations}</div>
                    <div className="cn-ov-label">Total Collaborations</div>
                  </div>
                </div>
                <div className="cn-ov-item">
                  <span className="cn-ov-icon">
                    <Building2 className="w-[17px] h-[17px]" />
                  </span>
                  <div>
                    <div className="cn-ov-value">{stats.institutions}</div>
                    <div className="cn-ov-label">Institutions</div>
                  </div>
                </div>
                <div className="cn-ov-item">
                  <span className="cn-ov-icon">
                    <Globe className="w-[17px] h-[17px]" />
                  </span>
                  <div>
                    <div className="cn-ov-value">{stats.countries || '—'}</div>
                    <div className="cn-ov-label">Countries</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cn-top-collab-card">
              <div className="cn-tc-head">
                <h3>Top Collaborators</h3>
                <span className="cn-view-all">View all</span>
              </div>
              {stats.sortedTop5.map((ca, idx) => {
                const scopusUrl = scopusAuthorProfileUrl(ca.scopusAuthorId);
                return (
                <div key={ca.id} className="cn-tc-row">
                  <span className="cn-tc-rank">{idx + 1}</span>
                  <span className="cn-tc-avatar">{getInitials(ca.name)}</span>
                  <div className="cn-tc-info">
                    <div className="cn-tc-name">
                      {scopusUrl ? (
                        <a
                          href={scopusUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cn-tc-scopus-link"
                          title="View Scopus author profile"
                        >
                          {ca.name}
                        </a>
                      ) : (
                        ca.name
                      )}
                    </div>
                    <div className="cn-tc-bar-track">
                      <div
                        className="cn-tc-bar-fill"
                        style={{ width: `${(ca.collaborationCount / stats.maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="cn-tc-count">{ca.collaborationCount}</span>
                </div>
              );
              })}
              <div className="cn-report-wrap">
                <button type="button" className="cn-view-report-btn">
                  <LineChart className="w-[15px] h-[15px] text-[#7d1a34]" />
                  View Full Network Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cn-bottom-row">
        <div className="cn-bottom-card">
          <span className="cn-bc-icon">
            <Heart className="w-[19px] h-[19px]" />
          </span>
          <div>
            <div className="cn-bc-label">Strongest Collaboration</div>
            <div className="cn-bc-value-sm">{stats.topCollaborator?.name ?? '—'}</div>
            <div className="cn-bc-sub">
              {stats.topCollaborator?.collaborationCount ?? 0} collaborations
            </div>
          </div>
        </div>
        <div className="cn-bottom-card">
          <span className="cn-bc-icon">
            <Calendar className="w-[19px] h-[19px]" />
          </span>
          <div>
            <div className="cn-bc-label">Active This Year</div>
            <div className="cn-bc-value">{stats.activeThisYear}</div>
            <div className="cn-bc-sub">New collaborations</div>
          </div>
        </div>
        <div className="cn-bottom-card">
          <span className="cn-bc-icon">
            <Star className="w-[19px] h-[19px]" />
          </span>
          <div>
            <div className="cn-bc-label">Avg. Collaborations per Author</div>
            <div className="cn-bc-value">{stats.avgPerAuthor.toFixed(2)}</div>
            <div className="cn-bc-sub">Across all co-authors</div>
          </div>
        </div>
        <div className="cn-bottom-card">
          <span className="cn-bc-icon">
            <TrendingUp className="w-[19px] h-[19px]" />
          </span>
          <div>
            <div className="cn-bc-label">Collaboration Trend</div>
            <div className={`cn-bc-value ${stats.trendPct >= 0 ? 'cn-up' : ''}`}>
              {stats.trendPct >= 0 ? '+' : ''}
              {stats.trendPct.toFixed(1)}% ↑
            </div>
            <div className="cn-bc-sub">vs last year</div>
          </div>
        </div>
      </div>

      <style>{NETWORK_CSS}</style>
    </div>
  );
}

const NETWORK_CSS = `
.collab-network-tab { font-family: Arial, Helvetica, sans-serif; }
.cn-page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
.cn-title { font-family: Georgia, serif; font-size: 28px; margin-bottom: 8px; color: #2b1d22; font-weight: 700; }
.cn-subtitle { color: #7a7178; font-size: 14px; }
.cn-count-badge {
  display: flex; align-items: center; gap: 9px; background: #fff;
  border: 1px solid #f0e2d2; border-radius: 10px; padding: 11px 18px;
  font-size: 13.5px; font-weight: 700; color: #2b1d22; white-space: nowrap;
}
.cn-main-panel {
  background: #fff; border: 1px solid #f0e2d2; border-radius: 18px;
  padding: 24px 26px; margin-bottom: 20px;
}
.cn-toolbar {
  display: flex; align-items: center; gap: 22px; padding-bottom: 20px;
  border-bottom: 1px solid #f0e2d2; margin-bottom: 10px; flex-wrap: wrap;
}
.cn-filter-label {
  display: flex; align-items: center; gap: 8px; color: #7d1a34;
  font-weight: 700; font-size: 14px;
}
.cn-field {
  display: flex; align-items: center; gap: 10px; font-size: 13.5px;
  font-weight: 600; color: #2b1d22;
}
.cn-field select {
  border: 1px solid #f0e2d2; border-radius: 8px; padding: 7px 10px;
  font-size: 13px; color: #2b1d22; background: #fff;
}
.cn-checkbox {
  display: flex; align-items: center; gap: 8px; font-size: 13.5px;
  font-weight: 600; cursor: pointer; color: #2b1d22;
}
.cn-checkbox input { width: 16px; height: 16px; accent-color: #7d1a34; }
.cn-toolbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.cn-tool-icon {
  width: 38px; height: 38px; border-radius: 9px; border: 1px solid #f0e2d2;
  display: flex; align-items: center; justify-content: center; color: #7a7178;
  background: #fff; cursor: pointer;
}
.cn-tool-icon:hover { color: #7d1a34; background: #fdf5ec; }
.cn-reset-btn {
  display: flex; align-items: center; gap: 8px; border: 1px solid #f0e2d2;
  border-radius: 9px; padding: 9px 16px; font-size: 13px; font-weight: 700;
  color: #2b1d22; background: #fff; cursor: pointer;
}
.cn-reset-btn:hover { background: #fdf5ec; color: #7d1a34; }
.cn-graph-layout {
  display: grid; grid-template-columns: 2.1fr 1fr; gap: 20px;
}
@media (max-width: 1024px) {
  .cn-graph-layout { grid-template-columns: 1fr; }
}
.cn-side-panel { display: flex; flex-direction: column; gap: 18px; }
.cn-overview-card, .cn-top-collab-card {
  border: 1px solid #f0e2d2; border-radius: 16px; padding: 22px;
}
.cn-overview-card h3, .cn-top-collab-card h3 {
  font-size: 15.5px; font-weight: 700; margin-bottom: 16px; color: #2b1d22;
}
.cn-ov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cn-ov-item {
  border: 1px solid #f0e2d2; border-radius: 12px; padding: 14px;
  display: flex; align-items: center; gap: 10px;
}
.cn-ov-icon {
  width: 36px; height: 36px; border-radius: 9px; background: #fbe3e8;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  color: #7d1a34;
}
.cn-ov-value { font-size: 19px; font-weight: 800; color: #7d1a34; line-height: 1; }
.cn-ov-label { font-size: 10.5px; color: #7a7178; margin-top: 4px; }
.cn-tc-head {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.cn-view-all { font-size: 12.5px; font-weight: 700; color: #7d1a34; cursor: pointer; }
.cn-tc-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
.cn-tc-rank { font-size: 12.5px; color: #9a9198; width: 14px; }
.cn-tc-avatar {
  width: 30px; height: 30px; border-radius: 50%; background: #5e1024; color: #fff;
  font-size: 12px; font-weight: 700; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}
.cn-tc-info { flex: 1; min-width: 0; }
.cn-tc-name {
  font-size: 13.5px; font-weight: 600; margin-bottom: 5px; color: #2b1d22;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cn-tc-scopus-link {
  color: inherit; text-decoration: none; border-bottom: 1px solid transparent;
}
.cn-tc-scopus-link:hover {
  color: #7d1a34; border-bottom-color: #c8973f;
}
.cn-tc-bar-track { height: 4px; background: #f1e6e9; border-radius: 2px; overflow: hidden; }
.cn-tc-bar-fill { height: 100%; background: #7d1a34; border-radius: 2px; }
.cn-tc-count { font-size: 13px; font-weight: 700; color: #2b1d22; width: 26px; text-align: right; }
.cn-report-wrap { margin-top: 16px; }
.cn-view-report-btn {
  width: 100%; border: 1px solid #f0e2d2; border-radius: 10px; padding: 12px;
  text-align: center; font-size: 13.5px; font-weight: 700; color: #2b1d22;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: #fff; cursor: pointer;
}
.cn-view-report-btn:hover { background: #fdf5ec; }
.cn-bottom-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px;
}
@media (max-width: 900px) {
  .cn-bottom-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px) {
  .cn-bottom-row { grid-template-columns: 1fr; }
}
.cn-bottom-card {
  background: #fff; border: 1px solid #f0e2d2; border-radius: 16px;
  padding: 18px 20px; display: flex; align-items: center; gap: 14px;
}
.cn-bc-icon {
  width: 42px; height: 42px; border-radius: 10px; background: #fbecd2;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  color: #c8973f;
}
.cn-bc-label { font-size: 12px; color: #7a7178; margin-bottom: 4px; }
.cn-bc-value { font-size: 19px; font-weight: 800; color: #2b1d22; }
.cn-bc-value-sm { font-size: 15px; font-weight: 800; color: #2b1d22; line-height: 1.3; }
.cn-bc-sub { font-size: 11.5px; color: #9a9198; margin-top: 2px; }
.cn-up { color: #28a24d; }
.cn-empty {
  text-align: center; background: #fff; border: 1px dashed #f0e2d2;
  border-radius: 18px; padding: 56px 24px;
}
.cn-empty-icon {
  width: 48px; height: 48px; border-radius: 50%; background: #fdf5ec;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
}
.cn-empty h3 { font-size: 14px; font-weight: 600; color: #2b1d22; margin-bottom: 4px; }
.cn-empty p { font-size: 12px; color: #7a7178; }
`;
