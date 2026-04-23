'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [done, setDone] = useState(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const complete = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    setDone(true);
    setWidth(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setDone(false);
      setWidth(0);
    }, 400);
  };

  const start = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    setDone(false);
    setVisible(true);
    setWidth(0);

    // Rapid jump to 40%, then slow crawl toward 85%
    setTimeout(() => setWidth(15), 30);
    setTimeout(() => setWidth(40), 150);

    let current = 40;
    tickerRef.current = setInterval(() => {
      current += (85 - current) * 0.06;
      setWidth(current);
    }, 400);

    // Safety: if the route never changes (e.g. redirect to same URL, cancelled navigation),
    // force-complete after 3 s so the overlay never stays stuck indefinitely.
    safetyTimerRef.current = setTimeout(() => {
      complete();
    }, 3000);
  };

  // Detect route change → complete
  const resolvedRoute = pathname + searchParams.toString();
  const prevRouteRef = useRef(resolvedRoute);
  useEffect(() => {
    if (prevRouteRef.current !== resolvedRoute) {
      prevRouteRef.current = resolvedRoute;
      complete();
    }
  }, [resolvedRoute]);

  // Intercept internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('blob:') ||
        href.startsWith('data:') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      ) return;
      const targetPath = href.split('?')[0];
      if (targetPath !== pathname) start();
    };
    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Full-screen overlay: blocks all clicks, dims the page slightly */}
      {!done && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            background: 'rgba(0,0,0,0.18)',
            cursor: 'wait',
            backdropFilter: 'blur(1px)',
            WebkitBackdropFilter: 'blur(1px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Center spinner */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            {/* Spinning ring */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                border: '4px solid rgba(255,255,255,0.2)',
                borderTopColor: '#f97316',
                animation: 'nav-spin 0.75s linear infinite',
              }}
            />
            {/* Pulsing dots */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#f97316',
                    animation: `nav-pulse 1s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top progress bar */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          height: '3px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: 'linear-gradient(90deg, #f97316, #ef4444)',
            transition: done ? 'width 0.25s ease' : 'width 0.5s ease',
            borderRadius: '0 2px 2px 0',
            boxShadow: '0 0 10px rgba(249,115,22,0.7)',
          }}
        />
        {/* Glow tip */}
        {!done && (
          <div
            style={{
              position: 'absolute',
              left: `calc(${width}% - 40px)`,
              top: '-3px',
              width: '60px',
              height: '9px',
              background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.9) 0%, transparent 70%)',
              filter: 'blur(3px)',
              transition: 'left 0.5s ease',
            }}
          />
        )}
      </div>

      {/* Keyframes injected once */}
      <style>{`
        @keyframes nav-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nav-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}

/** Suspense wrapper required for useSearchParams() in Next.js 14 App Router */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
