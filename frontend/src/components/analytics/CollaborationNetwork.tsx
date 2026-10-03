'use client';

import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { GLOBE_COLOR_VARS as GLOBE_COLORS } from '@/components/globeColors';

// three.js is large: load the globe only in the browser, after the page shell.
const ResearchGlobe = dynamic(() => import('@/components/ResearchGlobe'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse bg-white/5" />,
});
import type { CollaborationNetwork as Network } from '@/features/ipr-management/services/drdAnalytics.service';
import { Globe2, MapPinOff, RefreshCw } from 'lucide-react';

/**
 * Global Research Network: the home university's real co-authorship links,
 * drawn on a globe with a ranked partner list beside it.
 */
export default function CollaborationNetwork({
  network,
  loading,
  onRefresh,
}: {
  network: Network | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Callback ref: the globe column mounts after data arrives.
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    observer.current = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    observer.current.observe(el);
  }, []);

  const partners = network?.partners ?? [];
  const summary = network?.summary;
  const unmapped = partners.filter((p) => p.lat == null).length;
  const visible = showAll ? partners : partners.slice(0, 8);
  const maxPapers = Math.max(1, ...partners.map((p) => p.papers));
  const globeHeight = Math.min(Math.max(width * 0.82, 320), 520);
  const updated = network?.generatedAt ? new Date(network.generatedAt) : null;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-gray-100">Global Research Network</h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
              Institutions your faculty co-authored with
              {network?.home?.name ? <> · centred on <span className="font-medium text-stone-700 dark:text-gray-200">{network.home.name}</span></> : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {updated ? `Synced ${updated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Syncing…'}
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Refresh collaboration network"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Globe */}
        <div className="relative bg-[#03060f]">
          <div ref={measure} className="flex min-h-[340px] items-center justify-center">
            {width > 0 && network && (
              <ResearchGlobe width={width} height={globeHeight} home={network.home} partners={partners} highlight={highlight} />
            )}
            {!network && <div className="h-[420px] w-full animate-pulse bg-white/5" />}
          </div>
          <ul className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-black/45 px-3 py-1.5 text-[11px] text-white backdrop-blur-sm" aria-label="Legend">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GLOBE_COLORS.home }} />Your university</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GLOBE_COLORS.domestic }} />Domestic partner</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GLOBE_COLORS.international }} />International partner</li>
            <li className="text-white/70">Arc width = co-authored papers</li>
          </ul>
          {network && partners.length === 0 && (
            <div className="absolute inset-x-0 top-6 mx-auto w-fit rounded-lg bg-black/50 px-3 py-2 text-xs text-stone-200">
              No external co-authors recorded for this period yet.
            </div>
          )}
        </div>

        {/* Stats + partner list */}
        <div className="flex flex-col border-t border-stone-100 dark:border-gray-700 lg:border-l lg:border-t-0">
          <dl className="grid grid-cols-2 border-b border-stone-100 dark:border-gray-700">
            {[
              { label: 'Partner institutions', value: summary?.partners ?? 0 },
              { label: 'Countries', value: summary?.countries ?? 0 },
              { label: 'International partners', value: summary?.international ?? 0 },
              { label: 'Co-authored papers', value: summary?.papers ?? 0 },
            ].map((s, i) => (
              <div key={s.label} className={`px-5 py-3.5 ${i % 2 ? 'border-l border-stone-100 dark:border-gray-700' : ''} ${i >= 2 ? 'border-t border-stone-100 dark:border-gray-700' : ''}`}>
                <dt className="text-xs text-stone-500 dark:text-gray-400">{s.label}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-stone-900 dark:text-white">{s.value.toLocaleString('en-IN')}</dd>
              </div>
            ))}
          </dl>

          <div className="flex-1 px-5 py-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-gray-400">Top collaborators</p>
            {partners.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-gray-400">
                Partners appear here as faculty add external co-authors or sync publications from Scopus.
              </p>
            ) : (
              <ol className="space-y-1">
                {visible.map((p, i) => (
                  <li key={p.name}>
                    <div
                      onMouseEnter={() => setHighlight(p.name)}
                      onMouseLeave={() => setHighlight(null)}
                      className="group grid grid-cols-[18px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-50 dark:hover:bg-gray-700/50"
                    >
                      <span className="text-xs tabular-nums text-stone-400">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-stone-800 dark:text-gray-100" title={p.name}>{p.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(p.papers / maxPapers) * 100}%`, backgroundColor: p.international ? '#14b8a6' : '#f59e0b' }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] text-stone-500 dark:text-gray-400">
                            {p.country || 'Unknown'}{p.lat == null ? ' · not on map' : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-stone-900 dark:text-white" title={`${p.papers} co-authored paper${p.papers === 1 ? '' : 's'}`}>
                        {p.papers}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {partners.length > 8 && (
              <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-wine hover:underline dark:text-amber">
                {showAll ? 'Show top 8' : `Show all ${partners.length}`}
              </button>
            )}
          </div>

          {unmapped > 0 && (
            <p className="flex items-start gap-2 border-t border-stone-100 px-5 py-3 text-xs text-stone-500 dark:border-gray-700 dark:text-gray-400">
              <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {unmapped} partner{unmapped === 1 ? '' : 's'} couldn&apos;t be placed from the affiliation text and {unmapped === 1 ? 'is' : 'are'} listed but not drawn.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
