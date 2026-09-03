'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';

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
  
  // Country fallbacks
  if (lower.includes('india') || lower.includes('iit') || lower.includes('nit') || lower.includes('delhi') || lower.includes('bombay') || lower.includes('madras')) {
    return { lat: 20.5937, lng: 78.9629 };
  }
  if (lower.includes('usa') || lower.includes('united states') || lower.includes('mit') || lower.includes('harvard') || lower.includes('stanford') || lower.includes('california')) {
    return { lat: 37.0902, lng: -95.7129 };
  }
  if (lower.includes('uk') || lower.includes('united kingdom') || lower.includes('oxford') || lower.includes('cambridge') || lower.includes('london')) {
    return { lat: 55.3781, lng: -3.4360 };
  }
  if (lower.includes('china') || lower.includes('peking') || lower.includes('tsinghua')) {
    return { lat: 35.8617, lng: 104.1954 };
  }
  if (lower.includes('singapore') || lower.includes('nus') || lower.includes('nanyang')) {
    return { lat: 1.3521, lng: 103.8198 };
  }
  if (lower.includes('australia') || lower.includes('sydney') || lower.includes('melbourne') || lower.includes('anu')) {
    return { lat: -25.2744, lng: 133.7751 };
  }
  if (lower.includes('canada') || lower.includes('toronto')) {
    return { lat: 56.1304, lng: -106.3468 };
  }
  if (lower.includes('germany') || lower.includes('munich') || lower.includes('berlin')) {
    return { lat: 51.1657, lng: 10.4515 };
  }
  if (lower.includes('france') || lower.includes('paris') || lower.includes('sorbonne')) {
    return { lat: 46.2276, lng: 2.2137 };
  }
  if (lower.includes('japan') || lower.includes('tokyo')) {
    return { lat: 36.2048, lng: 138.2529 };
  }
  if (lower.includes('switzerland') || lower.includes('eth') || lower.includes('zurich')) {
    return { lat: 46.8182, lng: 8.2275 };
  }

  // Deterministic hash fallback
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = ((Math.abs(hash) % 100) - 50); // -50 to 50
  const lng = ((Math.abs(hash >> 8) % 320) - 160); // -160 to 160
  return { lat, lng };
}

const ResearchSphere = { lat: 28.423, lng: 77.031 };

// India POV — valid lat/lng pointing directly at ResearchSphere
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

export default function ResearchGlobe({ width = 520, height = 520, affiliations }: Props): JSX.Element {
  const globeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [bumpTexture, setBumpTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);

    // Manually load the bump texture using Three.js TextureLoader to ensure it maps correctly on the custom material
    const loader = new THREE.TextureLoader();
    loader.load(
      'https://unpkg.com/three-globe/example/img/earth-topology.png',
      (texture) => {
        setBumpTexture(texture);
      },
      undefined,
      (err) => console.error('Error loading bump texture for globe:', err)
    );

    return () => clearTimeout(t);
  }, []);

  // Create a custom material that overrides the react-globe.gl default material entirely
  const customMaterial = React.useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f8fafc'), // pure white clay color
      roughness: 0.55,
      metalness: 0.05,
      bumpScale: 14.0, // High relief contrast
    });
    if (bumpTexture) {
      mat.bumpMap = bumpTexture;
    }
    return mat;
  }, [bumpTexture]);

  const handleGlobeReady = React.useCallback(() => {
    if (!globeRef.current) return;
    
    const globe = globeRef.current;
    
    // Configure controls for auto-rotation and interactive zooming
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.65;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 120;
      controls.maxDistance = 400;
    }
    
    // Center on India
    globe.pointOfView({ lat: 22, lng: 78, altitude: 1.25 }, 0);

    // Configure Three.js lighting to highlight the reliefs and add the soft ice-blue backlight
    const scene = globe.scene();
    if (scene) {
      scene.traverse((obj: any) => {
        if (obj.isDirectionalLight) {
          // Position key light at top-left to cast gorgeous shadows in the relief crevices
          obj.position.set(-180, 220, 100);
          obj.intensity = 1.9;
          obj.color.set('#ffffff');
        }
        if (obj.isAmbientLight) {
          obj.intensity = 0.9;
          obj.color.set('#f1f5f9'); // Soft ambient fill
        }
      });

      // Add a custom ice-blue backlight/glow from the right-back to replicate the image glow
      const backlightId = 'globe-ice-backlight';
      const existing = scene.getObjectByName(backlightId);
      if (!existing) {
        const iceBacklight = new THREE.DirectionalLight('#93c5fd', 1.8);
        iceBacklight.name = backlightId;
        iceBacklight.position.set(180, -80, -180);
        scene.add(iceBacklight);
      }
    }
  }, []);

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
        if (pts.length >= 35) break;
      }
      if (pts.length >= 1) return pts;
    }
    return FALLBACK;
  }, [affiliations]);

  const arcs = React.useMemo(() => partnerPoints.map((u, i) => ({
    startLat: ResearchSphere.lat,
    startLng: ResearchSphere.lng,
    endLat: u.lat,
    endLng: u.lng,
    color: [
      ['rgba(124, 58, 237, 0.9)', 'rgba(99, 102, 241, 0.6)'], // Violet to Indigo
      ['rgba(236, 72, 153, 0.9)', 'rgba(219, 39, 119, 0.6)'], // Pink to Rose
      ['rgba(59, 130, 246, 0.9)', 'rgba(37, 99, 235, 0.6)'],  // Blue
      ['rgba(20, 184, 166, 0.9)', 'rgba(13, 148, 136, 0.6)'],  // Teal
      ['rgba(245, 158, 11, 0.9)', 'rgba(217, 119, 6, 0.6)'],   // Amber
    ][i % 5],
    label: u.name,
  })), [partnerPoints]);

  const points = React.useMemo(() => [
    { lat: ResearchSphere.lat, lng: ResearchSphere.lng, size: 1.6, color: '#f97316', label: 'ResearchSphere (You)' },
    ...partnerPoints.map((u) => ({
      lat: u.lat,
      lng: u.lng,
      size: Math.min(0.4 + (u.count / 5) * 0.4, 1.2),
      color: '#4f46e5',
      label: `${u.name} (${u.count} collaborations)`,
    })),
  ], [partnerPoints]);

  return (
    <div style={{ width, height, overflow: 'hidden' }} className="flex items-center justify-center cursor-grab active:cursor-grabbing">
      {ready && (
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={customMaterial}
          showAtmosphere={true}
          atmosphereColor="#93c5fd" // Glowing ice-blue atmosphere
          atmosphereAltitude={0.22}  // Wide glowing atmosphere to match reference image
          animateIn={false}
          onGlobeReady={handleGlobeReady}
          
          // Arcs representing collaborations
          arcsData={arcs}
          arcColor="color"
          arcDashLength={0.45}
          arcDashGap={0.12}
          arcDashAnimateTime={1200}
          arcStroke={0.65}
          arcAltitudeAutoScale={0.4}
          
          // Points
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