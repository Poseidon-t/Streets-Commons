import { useState, useRef, useEffect } from 'react';
import { searchAddress } from '../services/nominatim';
import { fetchOSMData } from '../services/overpass';
import { calculateMetrics } from '../utils/metrics';
import { calculateCompositeScore } from '../utils/compositeScore';
import { fetchNDVI, scoreTreeCanopy } from '../services/treecanopy';
import type { Location } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SketchParams {
  name: string;
  address: string;
  overallScore: number;        // 0–10
  treeCanopy: number;          // 0–100
  buildingDensity: number;     // 0–100
  intersectionDensity: number; // 0–100 (network connectivity)
  poiCount: number;            // 0–20+ (destination dots)
  speedEnvironment: number;    // 0–100 (lower = faster cars = worse)
  streetLighting: number;      // 0–100
  hasPark: boolean;
  hasTransit: boolean;
  hasCrosswalks: boolean;
  transitStops: number;        // count of nearby transit stops
}

const DEFAULT_PARAMS: SketchParams = {
  name: 'Maplewood',
  address: '1420 Elm Blvd, Oakland, CA',
  overallScore: 6.8,
  treeCanopy: 45,
  buildingDensity: 60,
  intersectionDensity: 50,
  poiCount: 6,
  speedEnvironment: 50,
  streetLighting: 40,
  hasPark: true,
  hasTransit: true,
  hasCrosswalks: true,
  transitStops: 2,
};

// ─── SVG constants ──────────────────────────────────────────────────────────────

const SW = 640;  // sketch width
const SH = 640;  // sketch height
const SVG_W = 680;
const SVG_H = 780;

const INK        = '#1c1814';
const PAPER      = '#f7f4ed';
const ROAD       = '#ece7de';
const BLDG_FILL  = '#eee9e0';
const BLDG_SHAD  = '#cdc6bc';
const PARK_FILL  = '#cce0b4';
const TREE_FILL  = '#d8eac0';
const TREE_INK   = '#3a5828';
const LIGHT_FILL = '#f5e6a3';
const CROSS_INK  = '#888078';
const SPEED_SLOW = '#a8d5a0';
const SPEED_FAST = '#e8a8a0';

// ─── Street grid ────────────────────────────────────────────────────────────────

const V_STREETS = [
  { x: 152, w: 16, major: false },
  { x: 318, w: 24, major: true  }, // Main avenue
  { x: 486, w: 16, major: false },
];

const H_STREETS = [
  { y: 142, h: 16, major: false },
  { y: 298, h: 24, major: true  }, // Main boulevard
  { y: 456, h: 16, major: false },
];

const COLS = [
  { x1: 14,  x2: 152 },
  { x1: 168, x2: 318 },
  { x1: 342, x2: 486 },
  { x1: 502, x2: 626 },
];

const ROWS = [
  { y1: 14,  y2: 142 },
  { y1: 158, y2: 298 },
  { y1: 322, y2: 456 },
  { y1: 472, y2: 626 },
];

// ─── Primitives ─────────────────────────────────────────────────────────────────

function TreeSymbol({ x, y, r = 12 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={2} cy={2} r={r} fill={BLDG_SHAD} opacity={0.4} />
      <circle r={r} fill={TREE_FILL} stroke={TREE_INK} strokeWidth={1.3} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line
          key={a}
          x1={0} y1={0}
          x2={Math.cos((a * Math.PI) / 180) * r * 0.62}
          y2={Math.sin((a * Math.PI) / 180) * r * 0.62}
          stroke={TREE_INK} strokeWidth={0.65}
        />
      ))}
      <circle r={2} fill={TREE_INK} />
    </g>
  );
}

function Building({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  if (w <= 0 || h <= 0) return null;
  return (
    <g>
      <rect x={x + 4} y={y + 4} width={w} height={h} fill={BLDG_SHAD} />
      <rect x={x} y={y} width={w} height={h} fill={BLDG_FILL} stroke={INK} strokeWidth={1.6} />
    </g>
  );
}

function StreetLight({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1={0} y1={0} x2={0} y2={-8} stroke={INK} strokeWidth={1.2} />
      <circle cy={-8} r={3.5} fill={LIGHT_FILL} stroke={INK} strokeWidth={0.8} />
      <circle cy={-8} r={1.5} fill={INK} opacity={0.3} />
    </g>
  );
}

function CrosswalkHatch({ x, y, w, h, vertical }: { x: number; y: number; w: number; h: number; vertical?: boolean }) {
  const stripes = vertical
    ? Array.from({ length: Math.floor(h / 5) }).map((_, i) => (
        <rect key={i} x={x} y={y + i * 5} width={w} height={2.5} fill={CROSS_INK} opacity={0.4} />
      ))
    : Array.from({ length: Math.floor(w / 5) }).map((_, i) => (
        <rect key={i} x={x + i * 5} y={y} width={2.5} height={h} fill={CROSS_INK} opacity={0.4} />
      ));
  return <g>{stripes}</g>;
}

function TransitStop({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={10} fill="white" stroke={INK} strokeWidth={1.5} />
      <circle r={5} fill={INK} />
      <circle r={2} fill="white" />
      {label && (
        <text x={14} y={4} fontSize={6} fill={INK} opacity={0.5} fontFamily="'Courier New', monospace">
          {label}
        </text>
      )}
    </g>
  );
}

function IntersectionDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} fill={INK} opacity={0.25} />;
}

// ─── Block content ──────────────────────────────────────────────────────────────

function BlockContent({
  x1, y1, x2, y2, density, isPark, idx,
}: {
  x1: number; y1: number; x2: number; y2: number;
  density: number; isPark: boolean; idx: string;
}) {
  const bw = x2 - x1;
  const bh = y2 - y1;
  const pad = 8;

  if (isPark) {
    const clipId = `pc-${idx}`;
    return (
      <g>
        <rect x={x1} y={y1} width={bw} height={bh} fill={PARK_FILL} stroke={TREE_INK} strokeWidth={1.2} />
        <clipPath id={clipId}>
          <rect x={x1} y={y1} width={bw} height={bh} />
        </clipPath>
        <g clipPath={`url(#${clipId})`} opacity={0.25}>
          {Array.from({ length: 20 }).map((_, i) => {
            const off = i * 12 - 60;
            return (
              <line key={i}
                x1={x1 + off} y1={y1}
                x2={x1 + off + bh} y2={y1 + bh}
                stroke={TREE_INK} strokeWidth={0.8}
              />
            );
          })}
        </g>
        <TreeSymbol x={x1 + bw * 0.22} y={y1 + bh * 0.28} r={10} />
        <TreeSymbol x={x1 + bw * 0.68} y={y1 + bh * 0.62} r={11} />
        <TreeSymbol x={x1 + bw * 0.44} y={y1 + bh * 0.76} r={9}  />
        <text
          x={x1 + bw / 2} y={y1 + bh / 2 - 14}
          textAnchor="middle"
          fontFamily="'Courier New', monospace"
          fontSize={8} fill={TREE_INK} fontWeight="bold" letterSpacing={1.5}
        >
          PARK
        </text>
      </g>
    );
  }

  if (density >= 70) {
    const gap = 6;
    const hw = Math.max(8, (bw - 2 * pad - gap) / 2);
    const hh = Math.max(8, (bh - 2 * pad - gap) / 2);
    return (
      <g>
        <Building x={x1 + pad}          y={y1 + pad}          w={hw} h={hh} />
        <Building x={x1 + pad + hw + gap} y={y1 + pad}          w={hw} h={hh} />
        <Building x={x1 + pad}          y={y1 + pad + hh + gap} w={hw} h={hh} />
        <Building x={x1 + pad + hw + gap} y={y1 + pad + hh + gap} w={hw} h={hh} />
      </g>
    );
  }

  if (density >= 40) {
    const gap = 8;
    const hw = Math.max(8, (bw - 2 * pad - gap) / 2);
    return (
      <g>
        <Building x={x1 + pad}          y={y1 + pad} w={hw} h={bh - 2 * pad} />
        <Building x={x1 + pad + hw + gap} y={y1 + pad} w={hw} h={bh - 2 * pad} />
      </g>
    );
  }

  const sp = pad * 2.5;
  return <Building x={x1 + sp} y={y1 + sp} w={bw - 2 * sp} h={bh - 2 * sp} />;
}

// ─── Street trees ───────────────────────────────────────────────────────────────

function StreetTrees({ treeCanopy }: { treeCanopy: number }) {
  const count = Math.max(2, Math.round(treeCanopy / 11));
  const trees: Array<{ x: number; y: number; r: number }> = [];

  // Along main boulevard (H_STREETS[1], y=298-322) — above and below
  for (let i = 0; i < count + 3; i++) {
    const x = 20 + (i * SW) / (count + 3);
    if (Math.abs(x - 318) > 32) {
      trees.push({ x, y: 288, r: 10 + (i % 3) * 2 });
      trees.push({ x, y: 334, r: 9  + (i % 2) * 2 });
    }
  }

  // Along main avenue (V_STREETS[1], x=318-342) — left and right
  for (let i = 0; i < count + 3; i++) {
    const y = 20 + (i * SH) / (count + 3);
    if (Math.abs(y - 298) > 32) {
      trees.push({ x: 308, y, r: 11 + (i % 3) * 2 });
      trees.push({ x: 352, y, r: 10 + (i % 2) * 2 });
    }
  }

  // Sparse trees on minor streets when canopy is high
  if (treeCanopy > 40) {
    [65, 255, 415, 565].forEach((x, i) => {
      trees.push({ x, y: 133, r: 9 + (i % 2) });
      trees.push({ x, y: 465, r: 8 + (i % 2) });
    });
    [65, 250, 415].forEach((y, i) => {
      trees.push({ x: 143, y, r: 9 });
      trees.push({ x: 495, y, r: 8 + (i % 2) });
    });
  }

  return (
    <>
      {trees.map((t, i) => (
        <TreeSymbol key={i} x={t.x} y={t.y} r={t.r} />
      ))}
    </>
  );
}

// ─── Street lights layer ────────────────────────────────────────────────────────

function StreetLights({ lighting }: { lighting: number }) {
  if (lighting < 15) return null;
  const lights: Array<{ x: number; y: number }> = [];
  const spacing = lighting > 60 ? 80 : lighting > 30 ? 120 : 180;

  // Along main boulevard
  for (let x = 40; x < SW; x += spacing) {
    if (Math.abs(x - 330) > 30) {
      lights.push({ x, y: 292 });
      if (lighting > 50) lights.push({ x, y: 328 });
    }
  }
  // Along main avenue
  for (let y = 40; y < SH; y += spacing) {
    if (Math.abs(y - 310) > 30) {
      lights.push({ x: 312, y });
      if (lighting > 50) lights.push({ x: 346, y });
    }
  }
  // Minor streets only if lighting is high
  if (lighting > 70) {
    for (let x = 60; x < SW; x += spacing * 1.5) {
      lights.push({ x, y: 136 });
      lights.push({ x, y: 462 });
    }
  }

  return <>{lights.map((l, i) => <StreetLight key={i} x={l.x} y={l.y} />)}</>;
}

// ─── Crosswalks layer ───────────────────────────────────────────────────────────

function Crosswalks({ hasCrosswalks, intersectionDensity }: { hasCrosswalks: boolean; intersectionDensity: number }) {
  if (!hasCrosswalks) return null;
  const crossings: React.ReactElement[] = [];

  // At major intersections
  // Main boulevard × Main avenue intersection
  crossings.push(<CrosswalkHatch key="c1" x={318} y={293} w={24} h={10} />);
  crossings.push(<CrosswalkHatch key="c2" x={318} y={325} w={24} h={10} />);
  crossings.push(<CrosswalkHatch key="c3" x={313} y={298} w={10} h={24} vertical />);
  crossings.push(<CrosswalkHatch key="c4" x={337} y={298} w={10} h={24} vertical />);

  // Minor intersections if connectivity is high
  if (intersectionDensity > 40) {
    // Boulevard × minor streets
    crossings.push(<CrosswalkHatch key="c5" x={152} y={293} w={16} h={10} />);
    crossings.push(<CrosswalkHatch key="c6" x={486} y={293} w={16} h={10} />);
    crossings.push(<CrosswalkHatch key="c7" x={152} y={325} w={16} h={10} />);
    crossings.push(<CrosswalkHatch key="c8" x={486} y={325} w={16} h={10} />);
  }

  if (intersectionDensity > 60) {
    // Avenue × minor streets
    crossings.push(<CrosswalkHatch key="c9"  x={313} y={142} w={10} h={16} vertical />);
    crossings.push(<CrosswalkHatch key="c10" x={337} y={142} w={10} h={16} vertical />);
    crossings.push(<CrosswalkHatch key="c11" x={313} y={456} w={10} h={16} vertical />);
    crossings.push(<CrosswalkHatch key="c12" x={337} y={456} w={10} h={16} vertical />);
  }

  return <>{crossings}</>;
}

// ─── Speed zone indicators ──────────────────────────────────────────────────────

function SpeedZones({ speedEnvironment }: { speedEnvironment: number }) {
  if (speedEnvironment <= 0) return null;
  // Higher score = slower speeds = more pedestrian-friendly
  const color = speedEnvironment > 60 ? SPEED_SLOW : speedEnvironment > 30 ? '#e8d8a0' : SPEED_FAST;
  const label = speedEnvironment > 60 ? '20' : speedEnvironment > 30 ? '30' : '50';

  return (
    <g opacity={0.55}>
      {/* Speed zone badges at street entries */}
      <g transform="translate(8, 305)">
        <rect x={-2} y={-8} width={22} height={14} rx={2} fill="white" stroke={color} strokeWidth={1.5} />
        <text x={9} y={3} textAnchor="middle" fontSize={7} fill={INK} fontWeight="bold" fontFamily="'Courier New', monospace">{label}</text>
      </g>
      <g transform="translate(612, 305)">
        <rect x={-2} y={-8} width={22} height={14} rx={2} fill="white" stroke={color} strokeWidth={1.5} />
        <text x={9} y={3} textAnchor="middle" fontSize={7} fill={INK} fontWeight="bold" fontFamily="'Courier New', monospace">{label}</text>
      </g>
      <g transform="translate(325, 8)">
        <rect x={-2} y={-8} width={22} height={14} rx={2} fill="white" stroke={color} strokeWidth={1.5} />
        <text x={9} y={3} textAnchor="middle" fontSize={7} fill={INK} fontWeight="bold" fontFamily="'Courier New', monospace">{label}</text>
      </g>
    </g>
  );
}

// ─── POI dots (data-driven count) ───────────────────────────────────────────────

function POIDots({ poiCount }: { poiCount: number }) {
  // Spread POI dots across blocks based on count
  const positions = [
    { x: 80,  y: 78 },  { x: 425, y: 78 },  { x: 560, y: 78 },
    { x: 255, y: 225 }, { x: 95,  y: 225 }, { x: 555, y: 225 },
    { x: 80,  y: 390 }, { x: 255, y: 390 }, { x: 560, y: 390 },
    { x: 425, y: 390 }, { x: 95,  y: 530 }, { x: 255, y: 540 },
    { x: 425, y: 540 }, { x: 560, y: 540 }, { x: 80,  y: 540 },
    { x: 425, y: 225 }, { x: 560, y: 130 }, { x: 80,  y: 130 },
    { x: 255, y: 130 }, { x: 425, y: 130 },
  ];

  const count = Math.min(poiCount, positions.length);

  return (
    <>
      {positions.slice(0, count).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4.5} fill={INK} opacity={0.55} />
      ))}
    </>
  );
}

// ─── Intersection density dots ──────────────────────────────────────────────────

function IntersectionDots({ density }: { density: number }) {
  if (density < 20) return null;
  const dots: Array<{ x: number; y: number }> = [];

  // Major intersections always shown
  dots.push({ x: 330, y: 310 }); // center
  dots.push({ x: 160, y: 310 }); // boulevard × minor
  dots.push({ x: 494, y: 310 }); // boulevard × minor
  dots.push({ x: 330, y: 150 }); // avenue × minor
  dots.push({ x: 330, y: 464 }); // avenue × minor

  // Minor × minor intersections when density is high
  if (density > 50) {
    dots.push({ x: 160, y: 150 });
    dots.push({ x: 494, y: 150 });
    dots.push({ x: 160, y: 464 });
    dots.push({ x: 494, y: 464 });
  }

  return <>{dots.map((d, i) => <IntersectionDot key={i} x={d.x} y={d.y} />)}</>;
}

// ─── Transit stops (multiple) ───────────────────────────────────────────────────

function TransitStops({ hasTransit, transitStops }: { hasTransit: boolean; transitStops: number }) {
  if (!hasTransit) return null;

  const stops = [
    { x: 330, y: 310, label: '' },
    { x: 160, y: 310, label: '' },
    { x: 330, y: 150, label: '' },
    { x: 494, y: 464, label: '' },
  ];

  const count = Math.min(Math.max(1, transitStops), stops.length);

  return <>{stops.slice(0, count).map((s, i) => <TransitStop key={i} x={s.x} y={s.y} label={s.label} />)}</>;
}

// ─── Main sketch SVG ────────────────────────────────────────────────────────────

function NeighborhoodSketch({
  params,
  innerRef,
}: {
  params: SketchParams;
  innerRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const tier =
    params.overallScore >= 8 ? 'WALKABLE' :
    params.overallScore >= 6 ? 'MODERATE' :
    params.overallScore >= 4 ? 'CAR-DEPENDENT' : 'HOSTILE';

  const tierColor =
    params.overallScore >= 8 ? '#22c55e' :
    params.overallScore >= 6 ? '#84cc16' :
    params.overallScore >= 4 ? '#eab308' :
    params.overallScore >= 2 ? '#f97316' : '#ef4444';

  const streetLabel = params.name.toUpperCase().split(' ').slice(0, 2).join(' ');
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).toUpperCase();

  return (
    <svg
      ref={innerRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width={SVG_W}
      height={SVG_H}
      style={{ background: PAPER, display: 'block' }}
      fontFamily="'Courier New', monospace"
    >
      <rect width={SVG_W} height={SVG_H} fill={PAPER} />

      {/* ── Sketch area ─────────────────────────────────────────────────── */}
      <g transform="translate(20,20)">
        {/* Road surface */}
        <rect width={SW} height={SH} fill={ROAD} />

        {/* Building blocks */}
        {ROWS.map((row, ri) =>
          COLS.map((col, ci) => (
            <BlockContent
              key={`${ri}-${ci}`}
              x1={col.x1} y1={row.y1}
              x2={col.x2} y2={row.y2}
              density={params.buildingDensity}
              isPark={params.hasPark && ri === 1 && ci === 1}
              idx={`${ri}-${ci}`}
            />
          ))
        )}

        {/* Street trees (rendered above blocks, below street lines) */}
        <StreetTrees treeCanopy={params.treeCanopy} />

        {/* Crosswalks (below street lines) */}
        <Crosswalks hasCrosswalks={params.hasCrosswalks} intersectionDensity={params.intersectionDensity} />

        {/* Street edge lines — the core of the urbanist drawing */}
        {H_STREETS.map((s, i) => (
          <g key={`hl-${i}`}>
            <line x1={0} y1={s.y}       x2={SW} y2={s.y}       stroke={INK} strokeWidth={s.major ? 2.2 : 1.4} />
            <line x1={0} y1={s.y + s.h} x2={SW} y2={s.y + s.h} stroke={INK} strokeWidth={s.major ? 2.2 : 1.4} />
          </g>
        ))}
        {V_STREETS.map((s, i) => (
          <g key={`vl-${i}`}>
            <line x1={s.x}       y1={0} x2={s.x}       y2={SH} stroke={INK} strokeWidth={s.major ? 2.2 : 1.4} />
            <line x1={s.x + s.w} y1={0} x2={s.x + s.w} y2={SH} stroke={INK} strokeWidth={s.major ? 2.2 : 1.4} />
          </g>
        ))}

        {/* Edge border */}
        <rect x={0} y={0} width={SW} height={SH} fill="none" stroke={INK} strokeWidth={2} />

        {/* Centreline dashes on major streets */}
        <line x1={0} y1={310} x2={SW} y2={310} stroke={INK} strokeWidth={0.6} strokeDasharray="14,10" opacity={0.35} />
        <line x1={330} y1={0} x2={330} y2={SH} stroke={INK} strokeWidth={0.6} strokeDasharray="14,10" opacity={0.35} />

        {/* Street labels */}
        <text x={18} y={294} fontSize={8} fill={INK} letterSpacing={1.5} fontWeight="bold" opacity={0.65}>
          {streetLabel} BLVD
        </text>
        <text
          x={344} y={28}
          fontSize={8} fill={INK} letterSpacing={1.5} fontWeight="bold" opacity={0.65}
          transform="rotate(90, 344, 28)"
        >
          CEDAR AVE
        </text>

        {/* Speed zone indicators */}
        <SpeedZones speedEnvironment={params.speedEnvironment} />

        {/* Intersection density dots */}
        <IntersectionDots density={params.intersectionDensity} />

        {/* Street lights */}
        <StreetLights lighting={params.streetLighting} />

        {/* Transit stops */}
        <TransitStops hasTransit={params.hasTransit} transitStops={params.transitStops} />

        {/* POI dots — data-driven count */}
        <POIDots poiCount={params.poiCount} />

        {/* North arrow */}
        <g transform="translate(606, 606)">
          <circle r={21} fill="white" stroke={INK} strokeWidth={1.5} />
          <path d="M 0,-14 L 6,9 L 0,4 L -6,9 Z"  fill={INK} />
          <path d="M 0,14  L 6,-9 L 0,-4 L -6,-9 Z" fill="none" stroke={INK} strokeWidth={1.2} />
          <text x={0} y={-17} textAnchor="middle" fontSize={8} fill={INK} fontWeight="bold">N</text>
        </g>

        {/* Scale bar */}
        <g transform="translate(16, 622)">
          <rect x={0}  y={-7} width={80} height={7} fill={INK} />
          <rect x={80} y={-7} width={80} height={7} fill="none" stroke={INK} strokeWidth={1.2} />
          <text x={0}   y={-11} fontSize={7} fill={INK}>0</text>
          <text x={72}  y={-11} fontSize={7} fill={INK}>100m</text>
          <text x={152} y={-11} fontSize={7} fill={INK}>200m</text>
        </g>
      </g>

      {/* ── Title block ──────────────────────────────────────────────────── */}
      <g transform="translate(20, 678)">
        <rect width={SW} height={80} fill="none" stroke={INK} strokeWidth={2} />
        <line x1={0}   y1={0} x2={SW}  y2={0}  stroke={INK} strokeWidth={2.5} />
        <line x1={210} y1={0} x2={210} y2={80} stroke={INK} strokeWidth={1} />
        <line x1={460} y1={0} x2={460} y2={80} stroke={INK} strokeWidth={1} />

        {/* Left cell — neighborhood info */}
        <text x={12} y={22} fontSize={13} fill={INK} fontWeight="bold">
          {params.name.toUpperCase()}
        </text>
        <text x={12} y={37} fontSize={8} fill={INK} opacity={0.65}>
          {params.address}
        </text>
        <text x={12} y={52} fontSize={7.5} fill={INK} opacity={0.55} letterSpacing={0.5}>
          WALKABILITY SKETCH — PLAN VIEW
        </text>
        <text x={12} y={66} fontSize={7} fill={INK} opacity={0.4} letterSpacing={0.5}>
          SCALE 1:2000 · OSM / SENTINEL-2 DATA
        </text>

        {/* Centre cell — score with tier color accent */}
        <text x={335} y={32} textAnchor="middle" fontSize={28} fill={INK} fontWeight="bold">
          {params.overallScore.toFixed(1)}
        </text>
        <text x={335} y={47} textAnchor="middle" fontSize={7.5} fill={INK} opacity={0.55} letterSpacing={1}>
          WALKABILITY SCORE / 10
        </text>
        <rect x={295} y={55} width={80} height={16} rx={3} fill={tierColor} opacity={0.15} />
        <text x={335} y={66} textAnchor="middle" fontSize={9} fill={tierColor} fontWeight="bold" letterSpacing={1.5}>
          {tier}
        </text>

        {/* Right cell — attribution */}
        <text x={472} y={22} fontSize={10} fill={INK} fontWeight="bold">SAFESTREETS</text>
        <text x={472} y={36} fontSize={7.5} fill={INK} opacity={0.6}>Streets &amp; Commons</text>
        <text x={472} y={50} fontSize={7} fill={INK} opacity={0.45}>
          safestreets.streetsandcommons.com
        </text>
        <text x={472} y={66} fontSize={7} fill={INK} opacity={0.35}>{dateStr}</text>
      </g>
    </svg>
  );
}

// ─── Address search bar ─────────────────────────────────────────────────────────

function AddressSearch({ onAnalyze, isAnalyzing }: { onAnalyze: (loc: Location) => void; isAnalyzing: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 3) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const locs = await searchAddress(query);
        setResults(locs);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search any address..."
          disabled={isAnalyzing}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 disabled:opacity-50"
        />
        {searching && (
          <div className="absolute right-3 top-3">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((loc, i) => (
            <button
              key={i}
              onClick={() => { onAnalyze(loc); setQuery(loc.displayName.split(',').slice(0, 2).join(',')); setResults([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
            >
              {loc.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Slider control ─────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        <span className="text-xs font-mono font-semibold text-gray-700">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-orange-500"
      />
    </div>
  );
}

// ─── Data mapping helpers ───────────────────────────────────────────────────────

function findMetric(metrics: Array<{ name: string; score: number }>, name: string): number {
  return metrics.find(m => m.name === name)?.score ?? 0;
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function SketchGenerator() {
  const [params, setParams] = useState<SketchParams>(DEFAULT_PARAMS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'manual' | 'live'>('manual');

  const svgRef = useRef<SVGSVGElement>(null);

  function set<K extends keyof SketchParams>(key: K, value: SketchParams[K]) {
    setParams(p => ({ ...p, [key]: value }));
  }

  async function analyzeLocation(loc: Location) {
    setIsAnalyzing(true);
    setAnalysisStatus('Fetching street network...');

    try {
      // 1. Fetch OSM data (core)
      const osmData = await fetchOSMData(loc.lat, loc.lon);
      const metrics = calculateMetrics(osmData, loc.lat, loc.lon);
      setAnalysisStatus('Computing walkability score...');

      // 2. Fetch tree canopy (non-blocking enhancement)
      let treeCanopyScore = metrics.treeCanopy;
      try {
        setAnalysisStatus('Reading satellite imagery...');
        const ndvi = await fetchNDVI(loc.lat, loc.lon);
        if (ndvi !== null) {
          treeCanopyScore = scoreTreeCanopy(ndvi);
        }
      } catch { /* use OSM-derived score */ }

      // 3. Compute composite score
      const composite = calculateCompositeScore({
        legacy: { ...metrics, treeCanopy: treeCanopyScore },
        networkGraph: osmData.networkGraph,
      });

      // 4. Map to sketch params
      const net = composite.components.networkDesign;
      const env = composite.components.environmentalComfort;
      const acc = composite.components.densityContext;

      const transitScore = findMetric(acc.metrics, 'Transit Access');
      const destScore = findMetric(acc.metrics, 'Nearby Destinations');
      const lightScore = findMetric(env.metrics, 'Street Lighting');
      const speedScore = findMetric(env.metrics, 'Speed Environment');
      const intDensity = findMetric(net.metrics, 'Intersection Density');

      // Map POI count from destination score (0-100 → 0-20)
      const poiCount = Math.round((destScore / 100) * 20);
      // Transit stops from score (0-100 → 1-4)
      const transitStops = transitScore > 60 ? 3 : transitScore > 30 ? 2 : 1;
      // Building density from destination + network density
      const buildingDensity = Math.round((destScore * 0.6 + intDensity * 0.4));

      const shortName = loc.displayName.split(',')[0].trim();

      setParams({
        name: shortName,
        address: loc.displayName.split(',').slice(0, 3).join(',').trim(),
        overallScore: Math.round((composite.overallScore / 10) * 10) / 10,
        treeCanopy: Math.round(treeCanopyScore * 10), // 0-10 → 0-100
        buildingDensity: Math.min(100, buildingDensity),
        intersectionDensity: intDensity,
        poiCount,
        speedEnvironment: speedScore,
        streetLighting: lightScore,
        hasPark: osmData.pois.some((p: any) => p.tags?.leisure === 'park' || p.tags?.leisure === 'garden'),
        hasTransit: transitScore > 10,
        hasCrosswalks: osmData.crossings.length > 0,
        transitStops,
      });

      setDataSource('live');
      setAnalysisStatus(null);
    } catch (err) {
      console.error('Sketch analysis failed:', err);
      setAnalysisStatus('Analysis failed — using manual mode');
      setTimeout(() => setAnalysisStatus(null), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function exportSVG() {
    if (!svgRef.current) return;
    const data = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${params.name.toLowerCase().replace(/\s+/g, '-')}-sketch.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPNG() {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = SVG_W * 2;
    canvas.height = SVG_H * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, SVG_W * 2, SVG_H * 2);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${params.name.toLowerCase().replace(/\s+/g, '-')}-sketch.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1a2a1a' }}>Neighborhood Sketch Lab</h1>
        <p className="text-sm text-gray-500 mt-1">
          Urbanist plan drawings from live walkability data.
          {dataSource === 'live' && <span className="ml-2 text-green-600 font-medium">Live data loaded</span>}
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* ── Controls ── */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Address search */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Analyze Address</h3>
            <AddressSearch onAnalyze={analyzeLocation} isAnalyzing={isAnalyzing} />
            {isAnalyzing && (
              <div className="mt-3 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">{analysisStatus}</span>
              </div>
            )}
            {analysisStatus && !isAnalyzing && (
              <p className="mt-2 text-xs text-red-500">{analysisStatus}</p>
            )}
          </div>

          {/* Sliders */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Score & Environment
              </h3>
              <div className="space-y-4">
                <Slider label="Overall Score (0–10)" value={params.overallScore} min={0} max={10} step={0.1} onChange={v => set('overallScore', v)} />
                <Slider label="Tree Canopy %" value={params.treeCanopy} min={0} max={100} step={5} onChange={v => set('treeCanopy', v)} />
                <Slider label="Speed Environment" value={params.speedEnvironment} min={0} max={100} step={5} onChange={v => set('speedEnvironment', v)} />
                <Slider label="Street Lighting" value={params.streetLighting} min={0} max={100} step={5} onChange={v => set('streetLighting', v)} />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Urban Form
              </h3>
              <div className="space-y-4">
                <Slider label="Building Density" value={params.buildingDensity} min={0} max={100} step={5} onChange={v => set('buildingDensity', v)} />
                <Slider label="Intersection Density" value={params.intersectionDensity} min={0} max={100} step={5} onChange={v => set('intersectionDensity', v)} />
                <Slider label="POI Count" value={params.poiCount} min={0} max={20} step={1} onChange={v => set('poiCount', v)} />
                <Slider label="Transit Stops" value={params.transitStops} min={0} max={4} step={1} onChange={v => set('transitStops', v)} />
              </div>
            </div>

            {/* Feature toggles */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Features</h3>
              <div className="space-y-2">
                {([
                  { key: 'hasPark',       label: 'Park / green space' },
                  { key: 'hasTransit',    label: 'Transit stops' },
                  { key: 'hasCrosswalks', label: 'Crosswalks' },
                ] as const).map(f => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={params[f.key]}
                      onChange={e => set(f.key, e.target.checked)}
                      className="accent-orange-500"
                    />
                    <span className="text-sm text-gray-600">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Legend</h3>
              <div className="space-y-1.5 text-xs text-gray-500">
                {[
                  { color: BLDG_FILL, border: INK,      label: 'Buildings' },
                  { color: PARK_FILL, border: TREE_INK,  label: 'Park / open space' },
                  { color: TREE_FILL, border: TREE_INK,  label: 'Tree canopy' },
                  { color: ROAD,      border: INK,      label: 'Street network' },
                  { color: LIGHT_FILL, border: INK,      label: 'Street lights' },
                  { color: CROSS_INK, border: CROSS_INK, label: 'Crosswalks' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: l.color, border: `1.5px solid ${l.border}` }} />
                    {l.label}
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-white" style={{ border: `1.5px solid ${INK}` }}>
                    <div className="w-2 h-2 rounded-full bg-gray-800" />
                  </div>
                  Transit stop
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: INK, opacity: 0.65 }} />
                  </div>
                  Destinations / POIs
                </div>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                onClick={exportSVG}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#e07850' }}
              >
                Export SVG
              </button>
              <button
                onClick={exportPNG}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 border-2"
                style={{ borderColor: '#e07850', color: '#e07850' }}
              >
                Export PNG
              </button>
            </div>
          </div>
        </div>

        {/* ── Preview ── */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-auto">
          <NeighborhoodSketch params={params} innerRef={svgRef} />
        </div>
      </div>
    </div>
  );
}
