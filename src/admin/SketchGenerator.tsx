import { useState, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SketchParams {
  name: string;
  address: string;
  overallScore: number;
  treeCanopy: number;      // 0–100
  buildingDensity: number; // 0–100
  hasPark: boolean;
  hasTransit: boolean;
}

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

// ─── Main sketch SVG ────────────────────────────────────────────────────────────

function NeighborhoodSketch({
  params,
  innerRef,
}: {
  params: SketchParams;
  innerRef?: React.RefObject<SVGSVGElement>;
}) {
  const tier =
    params.overallScore >= 8 ? 'WALKABLE' :
    params.overallScore >= 6 ? 'MODERATE' :
    params.overallScore >= 4 ? 'CAR-DEPENDENT' : 'HOSTILE';

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

        {/* Transit stop */}
        {params.hasTransit && (
          <g transform="translate(330, 310)">
            <circle r={10} fill="white" stroke={INK} strokeWidth={1.5} />
            <circle r={5}  fill={INK} />
            <circle r={2}  fill="white" />
          </g>
        )}

        {/* POI dots — shops/destinations */}
        <circle cx={80}  cy={78}  r={4.5} fill={INK} opacity={0.65} />
        <circle cx={425} cy={78}  r={4.5} fill={INK} opacity={0.65} />
        <circle cx={255} cy={390} r={4.5} fill={INK} opacity={0.65} />
        <circle cx={560} cy={390} r={4.5} fill={INK} opacity={0.65} />

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

        {/* Centre cell — score */}
        <text x={335} y={32} textAnchor="middle" fontSize={28} fill={INK} fontWeight="bold">
          {params.overallScore.toFixed(1)}
        </text>
        <text x={335} y={47} textAnchor="middle" fontSize={7.5} fill={INK} opacity={0.55} letterSpacing={1}>
          WALKABILITY SCORE / 10
        </text>
        <text x={335} y={63} textAnchor="middle" fontSize={9} fill={INK} fontWeight="bold" letterSpacing={1.5}>
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

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function SketchGenerator() {
  const [params, setParams] = useState<SketchParams>({
    name: 'Maplewood',
    address: '1420 Elm Blvd, Oakland, CA',
    overallScore: 6.8,
    treeCanopy: 45,
    buildingDensity: 60,
    hasPark: true,
    hasTransit: true,
  });

  const svgRef = useRef<SVGSVGElement>(null);

  function set<K extends keyof SketchParams>(key: K, value: SketchParams[K]) {
    setParams(p => ({ ...p, [key]: value }));
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1a2a1a' }}>Neighborhood Sketch Lab</h1>
        <p className="text-sm text-gray-500 mt-1">
          Urbanist plan drawings from walkability data. Prototype — grid network only.
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* ── Controls ── */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5">
          {/* Neighborhood */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Neighborhood</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name</label>
                <input
                  type="text" value={params.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Address</label>
                <input
                  type="text" value={params.address}
                  onChange={e => set('address', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
            </div>
          </div>

          {/* Scores */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Data</h3>
            <div className="space-y-4">
              <Slider label="Overall Score (0–10)" value={params.overallScore} min={0} max={10} step={0.1} onChange={v => set('overallScore', v)} />
              <Slider label="Tree Canopy %" value={params.treeCanopy} min={0} max={100} step={5} onChange={v => set('treeCanopy', v)} />
              <Slider label="Building Density" value={params.buildingDensity} min={0} max={100} step={5} onChange={v => set('buildingDensity', v)} />
            </div>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Features</h3>
            <div className="space-y-2">
              {([
                { key: 'hasPark',    label: 'Park / green space' },
                { key: 'hasTransit', label: 'Transit stop' },
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

          <button
            onClick={exportSVG}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#e07850' }}
          >
            Export SVG
          </button>
        </div>

        {/* ── Preview ── */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-auto">
          <NeighborhoodSketch params={params} innerRef={svgRef} />
        </div>
      </div>
    </div>
  );
}
