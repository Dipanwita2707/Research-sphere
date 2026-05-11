'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const AFFILIATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'iit delhi': { lat: 28.545, lng: 77.193 },
  'iit bombay': { lat: 19.133, lng: 72.916 },
  'iit madras': { lat: 12.991, lng: 80.233 },
  'iit kanpur': { lat: 26.512, lng: 80.232 },
  'iit kharagpur': { lat: 22.314, lng: 87.310 },
  'iit roorkee': { lat: 29.866, lng: 77.897 },
  'aiims': { lat: 28.566, lng: 77.210 },
  'aiims delhi': { lat: 28.566, lng: 77.210 },
  'delhi university': { lat: 28.690, lng: 77.213 },
  'university of delhi': { lat: 28.690, lng: 77.213 },
  'jamia millia': { lat: 28.561, lng: 77.276 },
  'jnu': { lat: 28.540, lng: 77.166 },
  'jawaharlal nehru university': { lat: 28.540, lng: 77.166 },
  'amity university': { lat: 28.544, lng: 77.329 },
  'bits pilani': { lat: 28.365, lng: 73.673 },
  'nit trichy': { lat: 10.762, lng: 78.813 },
  'vit vellore': { lat: 12.970, lng: 79.159 },
  'manipal': { lat: 13.351, lng: 74.788 },
  'manipal university': { lat: 13.351, lng: 74.788 },
  'bhu': { lat: 25.268, lng: 82.994 },
  'banaras hindu university': { lat: 25.268, lng: 82.994 },
  'anna university': { lat: 13.010, lng: 80.234 },
  'osmania university': { lat: 17.411, lng: 78.527 },
  'pune university': { lat: 18.520, lng: 73.856 },
  'university of mumbai': { lat: 18.932, lng: 72.835 },
  'calcutta university': { lat: 22.578, lng: 88.363 },
  'university of calcutta': { lat: 22.578, lng: 88.363 },
  'harvard': { lat: 42.374, lng: -71.117 },
  'harvard university': { lat: 42.374, lng: -71.117 },
  'mit': { lat: 42.360, lng: -71.092 },
  'massachusetts institute of technology': { lat: 42.360, lng: -71.092 },
  'stanford': { lat: 37.428, lng: -122.170 },
  'stanford university': { lat: 37.428, lng: -122.170 },
  'columbia university': { lat: 40.808, lng: -73.963 },
  'johns hopkins': { lat: 39.330, lng: -76.621 },
  'yale': { lat: 41.316, lng: -72.923 },
  'princeton': { lat: 40.344, lng: -74.655 },
  'university of michigan': { lat: 42.278, lng: -83.738 },
  'uc berkeley': { lat: 37.872, lng: -122.259 },
  'university of california': { lat: 37.872, lng: -122.259 },
  'carnegie mellon': { lat: 40.444, lng: -79.944 },
  'nyu': { lat: 40.729, lng: -73.997 },
  'new york university': { lat: 40.729, lng: -73.997 },
  'university of toronto': { lat: 43.663, lng: -79.396 },
  'oxford': { lat: 51.755, lng: -1.254 },
  'university of oxford': { lat: 51.755, lng: -1.254 },
  'cambridge': { lat: 52.205, lng: 0.115 },
  'university of cambridge': { lat: 52.205, lng: 0.115 },
  'imperial college': { lat: 51.499, lng: -0.175 },
  'imperial college london': { lat: 51.499, lng: -0.175 },
  'ucl': { lat: 51.524, lng: -0.134 },
  'edinburgh': { lat: 55.944, lng: -3.189 },
  'university of edinburgh': { lat: 55.944, lng: -3.189 },
  'eth zurich': { lat: 47.377, lng: 8.548 },
  'sorbonne': { lat: 48.853, lng: 2.346 },
  'tu munich': { lat: 48.150, lng: 11.575 },
  'heidelberg': { lat: 49.410, lng: 8.707 },
  'karolinska': { lat: 59.350, lng: 18.020 },
  'ku leuven': { lat: 50.878, lng: 4.703 },
  'university of tokyo': { lat: 35.713, lng: 139.767 },
  'tsinghua': { lat: 40.004, lng: 116.322 },
  'tsinghua university': { lat: 40.004, lng: 116.322 },
  'peking university': { lat: 39.999, lng: 116.316 },
  'nus': { lat: 1.297, lng: 103.776 },
  'national university of singapore': { lat: 1.297, lng: 103.776 },
  'seoul national': { lat: 37.460, lng: 126.953 },
  'nanyang': { lat: 1.348, lng: 103.683 },
  'university of hong kong': { lat: 22.283, lng: 114.137 },
  'university of melbourne': { lat: -37.796, lng: 144.963 },
  'university of sydney': { lat: -33.889, lng: 151.187 },
  'anu': { lat: -35.277, lng: 149.120 },
  'australian national university': { lat: -35.277, lng: 149.120 },
  'uct': { lat: -33.957, lng: 18.463 },
  'university of cape town': { lat: -33.957, lng: 18.463 },
  'king abdulaziz': { lat: 21.492, lng: 39.182 },
  'king saud': { lat: 24.723, lng: 46.627 },
};

function resolveCoords(name: string): { lat: number; lng: number } | null {
  const lower = name.toLowerCase();
  for (const [key, coords] of Object.entries(AFFILIATION_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

const SGT = { lat: 28.423, lng: 77.031 };

// India POV — valid lat/lng pointing directly at SGT University
const INDIA_POV = { lat: 22, lng: 78, altitude: 1.2 };

const FALLBACK = [
  { name: 'Harvard University', lat: 42.374, lng: -71.117, count: 3 },
  { name: 'MIT', lat: 42.360, lng: -71.092, count: 2 },
  { name: 'Stanford University', lat: 37.428, lng: -122.170, count: 3 },
  { name: 'University of Oxford', lat: 51.755, lng: -1.254, count: 2 },
  { name: 'University of Cambridge', lat: 52.205, lng: 0.115, count: 2 },
  { name: 'ETH Zurich', lat: 47.377, lng: 8.548, count: 1 },
  { name: 'University of Tokyo', lat: 35.713, lng: 139.767, count: 2 },
  { name: 'Tsinghua University', lat: 40.004, lng: 116.322, count: 2 },
  { name: 'NUS Singapore', lat: 1.297, lng: 103.776, count: 1 },
  { name: 'IIT Delhi', lat: 28.545, lng: 77.193, count: 4 },
  { name: 'IIT Bombay', lat: 19.133, lng: 72.916, count: 3 },
  { name: 'AIIMS Delhi', lat: 28.566, lng: 77.210, count: 5 },
  { name: 'University of Toronto', lat: 43.663, lng: -79.396, count: 1 },
  { name: 'University of Melbourne', lat: -37.796, lng: 144.963, count: 1 },
  { name: 'Sorbonne University', lat: 48.853, lng: 2.346, count: 1 },
  { name: 'TU Munich', lat: 48.150, lng: 11.575, count: 1 },
  { name: 'Seoul National University', lat: 37.460, lng: 126.953, count: 1 },
  { name: 'Imperial College London', lat: 51.499, lng: -0.175, count: 2 },
  { name: 'Columbia University', lat: 40.808, lng: -73.963, count: 2 },
  { name: 'UCT', lat: -33.957, lng: 18.463, count: 1 },
];

export interface AffiliationPoint {
  name: string;
  count: number;
}

interface Props {
  width?: number;
  height?: number;
  affiliations?: AffiliationPoint[];
}

// Convert lat/lng/altitude to Three.js XYZ (globe radius = 100)
function indiaXYZ(alt: number) {
  const PI = Math.PI;
  const lat = 22, lng = 78;
  const phi   = (90 - lat)  * PI / 180;
  const theta = (lng + 180) * PI / 180;  // globe.gl adds 180° offset
  const r = 100 * (1 + alt);
  return {
    x: -r * Math.sin(phi) * Math.cos(theta),
    y:  r * Math.cos(phi),
    z:  r * Math.sin(phi) * Math.sin(theta),
  };
}

function useForceIndiaPOV(globeRef: React.MutableRefObject<any>) {
  const rafRef = useRef<number | null>(null);

  const lock = React.useCallback(() => {
    if (!globeRef.current) return;
    const g = globeRef.current;
    const { x, y, z } = indiaXYZ(1.2);

    const applyOnce = () => {
      const cam  = typeof g.camera   === 'function' ? g.camera()   : null;
      const ctrl = typeof g.controls === 'function' ? g.controls() : null;
      if (!cam || !ctrl) return;

      // Move camera to India
      cam.position.set(x, y, z);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(true);
      g.pointOfView(INDIA_POV, 0);

      // Clear any rotation delta
      if (ctrl._sphericalDelta) ctrl._sphericalDelta.set(0, 0, 0);

      // Sync OrbitControls internal _spherical FROM camera.position
      ctrl.enableDamping = false;
      ctrl.target.set(0, 0, 0);
      ctrl.update();
      ctrl.enableDamping = true;

      ctrl.reset = () => {};
      if (typeof ctrl.saveState === 'function') ctrl.saveState();
      ctrl.enableZoom  = false;
      ctrl.autoRotate  = false;
    };

    applyOnce();

    // Run 30 frames (~0.5s) — enough since animateIn=false, no scene spin
    let frames = 0;
    const loop = () => {
      applyOnce();
      frames++;
      if (frames < 30) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        const c = typeof g.controls === 'function' ? g.controls() : null;
        if (c) { c.autoRotate = true; c.autoRotateSpeed = 0.4; }
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [globeRef]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return lock;
}

export default function ResearchGlobe({ width = 570, height = 580, affiliations }: Props): JSX.Element {
  const globeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const lockIndia = useForceIndiaPOV(globeRef);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Extra trigger: after globe mounts, wait 300ms then force India again
  // in case onGlobeReady fired before the component fully settled.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => lockIndia(), 300);
    return () => clearTimeout(t);
  }, [ready, lockIndia]);

  const handleGlobeReady = React.useCallback(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    if (ctrl) { ctrl.autoRotate = false; ctrl.enableZoom = false; }
    lockIndia();
  }, [lockIndia]);

  const partnerPoints = React.useMemo(() => {
    if (affiliations && affiliations.length > 0) {
      const seen = new Set<string>();
      const pts: { lat: number; lng: number; name: string; count: number }[] = [];
      for (const a of affiliations) {
        const coords = resolveCoords(a.name);
        if (!coords) continue;
        const key = `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pts.push({ ...coords, name: a.name, count: a.count });
        if (pts.length >= 30) break;
      }
      if (pts.length >= 3) return pts;
    }
    return FALLBACK;
  }, [affiliations]);

  const arcs = React.useMemo(() => partnerPoints.map((u, i) => ({
    startLat: SGT.lat,
    startLng: SGT.lng,
    endLat: u.lat,
    endLng: u.lng,
    color: [
      ['rgba(0,255,255,0.9)', 'rgba(0,220,255,0.6)'],
      ['rgba(255,0,200,0.9)', 'rgba(220,0,255,0.6)'],
      ['rgba(0,255,128,0.9)', 'rgba(0,200,180,0.6)'],
      ['rgba(255,200,0,0.9)', 'rgba(255,100,0,0.6)'],
      ['rgba(100,180,255,0.9)', 'rgba(60,100,255,0.6)'],
    ][i % 5],
    label: u.name,
  })), [partnerPoints]);

  const points = React.useMemo(() => [
    { lat: SGT.lat, lng: SGT.lng, size: 1.4, color: '#f97316', label: 'SGT University' },
    ...partnerPoints.map((u) => ({
      lat: u.lat,
      lng: u.lng,
      size: Math.min(0.35 + (u.count / 5) * 0.5, 1.0),
      color: '#818cf8',
      label: `${u.name} (${u.count} papers)`,
    })),
  ], [partnerPoints]);

  return (
    <div style={{ width, height, overflow: 'hidden' }} className="flex items-center justify-center">
      {ready && (
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#93c5fd"
          atmosphereAltitude={0.15}
          animateIn={false}
          onGlobeReady={handleGlobeReady}
          arcsData={arcs}
          arcColor="color"
          arcDashLength={0.45}
          arcDashGap={0.12}
          arcDashAnimateTime={1200}
          arcStroke={0.5}
          arcAltitudeAutoScale={0.4}
          pointsData={points}
          pointColor="color"
          pointAltitude={0.02}
          pointRadius="size"
          pointLabel="label"
          pointsMerge={false}
        />
      )}
    </div>
  );
}