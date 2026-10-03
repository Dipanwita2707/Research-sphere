'use client';

import { useRef, useEffect, useState, useMemo, useCallback, type JSX } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { GLOBE_COLORS, readGlobeColors } from './globeColors';

export { GLOBE_COLORS };

// next/dynamic does not forward refs, so pass the ref through a named prop.
const Globe = dynamic(
  async () => {
    const GlobeGL = (await import('react-globe.gl')).default;
    return function GlobeWithRef({ forwardedRef, ...props }: any) {
      return <GlobeGL ref={forwardedRef} {...props} />;
    };
  },
  { ssr: false },
);

export interface CollaborationHome {
  name: string;
  lat: number | null;
  lng: number | null;
  city?: string | null;
  country?: string | null;
}

export interface CollaborationPartner {
  name: string;
  country: string | null;
  papers: number;
  lat: number | null;
  lng: number | null;
  precision: 'institution' | 'city' | 'country' | null;
  international: boolean;
}

interface Props {
  width?: number;
  height?: number;
  home: CollaborationHome | null;
  partners: CollaborationPartner[];
  /** Partner name to emphasise (e.g. hovered in the side list). */
  highlight?: string | null;
}


const TEXTURES = {
  earth: '/geo/earth-blue-marble.jpg',
  bump: '/geo/earth-topology.png',
  water: '/geo/earth-water.png',
  sky: '/geo/night-sky.png',
};

const MAX_ARCS = 60;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function tooltip(title: string, lines: string[]) {
  return `<div style="font:12px/1.4 Inter,system-ui,sans-serif;background:#fff;color:#1c1917;border:1px solid #e7e5e4;border-radius:8px;padding:8px 10px;box-shadow:0 6px 20px rgba(0,0,0,.18);max-width:240px">
    <div style="font-weight:600;margin-bottom:2px">${escapeHtml(title)}</div>
    ${lines.map((l) => `<div style="color:#57534e">${escapeHtml(l)}</div>`).join('')}
  </div>`;
}

export default function ResearchGlobe({ width = 520, height = 520, home, partners, highlight = null }: Props): JSX.Element {
  // Theme colours (CSS variables) resolved for WebGL on the client
  const [COLOR] = useState(() => (typeof window === 'undefined' ? GLOBE_COLORS : readGlobeColors()));
  const globeRef = useRef<any>(null);
  const [hovering, setHovering] = useState(false);

  const hasHome = home?.lat != null && home?.lng != null;

  const located = useMemo(
    () => partners.filter((p) => p.lat != null && p.lng != null).slice(0, MAX_ARCS),
    [partners],
  );
  const maxPapers = Math.max(1, ...located.map((p) => p.papers));

  const arcs = useMemo(() => {
    if (!hasHome) return [];
    return located
      // A partner in the same city as home has no visible arc; it still shows as a point.
      .filter((p) => Math.abs((p.lat as number) - (home!.lat as number)) + Math.abs((p.lng as number) - (home!.lng as number)) > 0.05)
      .map((p) => {
        const c = p.international ? COLOR.international : COLOR.domestic;
        const dim = highlight && highlight !== p.name;
        return {
          startLat: home!.lat, startLng: home!.lng, endLat: p.lat, endLng: p.lng,
          color: dim ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)'] : [COLOR.home, c],
          stroke: 0.35 + 0.9 * Math.sqrt(p.papers / maxPapers),
          label: tooltip(p.name, [
            `${p.papers} co-authored paper${p.papers === 1 ? '' : 's'}`,
            [p.country, p.international ? 'International' : 'Domestic'].filter(Boolean).join(' · '),
          ]),
        };
      });
  }, [located, hasHome, home, maxPapers, highlight, COLOR]);

  const points = useMemo(() => {
    const pts = located.map((p) => ({
      lat: p.lat, lng: p.lng,
      radius: 0.18 + 0.55 * Math.sqrt(p.papers / maxPapers),
      color: highlight && highlight !== p.name ? 'rgba(255,255,255,0.25)' : p.international ? COLOR.international : COLOR.domestic,
      label: tooltip(p.name, [
        `${p.papers} co-authored paper${p.papers === 1 ? '' : 's'}`,
        [p.country, p.precision === 'country' ? 'located by country' : p.precision === 'city' ? 'located by city' : null].filter(Boolean).join(' · '),
      ]),
    }));
    if (hasHome) {
      pts.push({
        lat: home!.lat, lng: home!.lng, radius: 0.55, color: COLOR.home,
        label: tooltip(home!.name, [[home!.city, home!.country].filter(Boolean).join(', '), 'Your university']),
      });
    }
    return pts;
  }, [located, maxPapers, highlight, hasHome, home, COLOR]);

  const rings = useMemo(() => (hasHome ? [{ lat: home!.lat, lng: home!.lng }] : []), [hasHome, home]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 160;
      controls.maxDistance = 420;
    }
    globe.pointOfView({ lat: hasHome ? (home!.lat as number) - 6 : 20, lng: hasHome ? (home!.lng as number) : 78, altitude: 2.1 }, 0);
    // Shiny oceans, matte land: the water mask drives specular highlights.
    const material = globe.globeMaterial?.();
    if (material) {
      new THREE.TextureLoader().load(TEXTURES.water, (tex) => {
        material.specularMap = tex;
        material.specular = new THREE.Color('#3a4a5c');
        material.shininess = 14;
        material.needsUpdate = true;
      });
    }
    const scene = globe.scene();
    scene?.traverse((obj: any) => {
      if (obj.isAmbientLight) obj.intensity = 2.2;
      if (obj.isDirectionalLight) obj.intensity = 1.4;
    });
  }, [hasHome, home]);

  // Pause rotation while the reader is inspecting something.
  useEffect(() => {
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = !hovering && !highlight;
  }, [hovering, highlight]);

  // Re-centre when the tenant (home) changes.
  useEffect(() => {
    if (hasHome) globeRef.current?.pointOfView?.({ lat: (home!.lat as number) - 6, lng: home!.lng, altitude: 2.1 }, 800);
  }, [hasHome, home?.lat, home?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ width, height }} className="flex items-center justify-center cursor-grab active:cursor-grabbing">
      <Globe
        forwardedRef={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={TEXTURES.earth}
        bumpImageUrl={TEXTURES.bump}
        backgroundImageUrl={TEXTURES.sky}
        showAtmosphere
        atmosphereColor={COLOR.atmosphere}
        atmosphereAltitude={0.18}
        animateIn={false}
        onGlobeReady={handleGlobeReady}

        arcsData={arcs}
        arcColor="color"
        arcStroke="stroke"
        arcLabel="label"
        arcAltitudeAutoScale={0.38}
        arcDashLength={0.5}
        arcDashGap={0.25}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={2600}
        onArcHover={(a: unknown) => setHovering(Boolean(a))}

        pointsData={points}
        pointColor="color"
        pointRadius="radius"
        pointAltitude={0.012}
        pointLabel="label"
        pointsMerge={false}
        onPointHover={(p: unknown) => setHovering(Boolean(p))}

        ringsData={rings}
        ringColor={() => (t: number) => `rgba(255,122,26,${1 - t})`}
        ringMaxRadius={4.5}
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={1400}
      />
    </div>
  );
}
