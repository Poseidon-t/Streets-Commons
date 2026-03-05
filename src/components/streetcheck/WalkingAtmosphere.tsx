import { useRef, useEffect } from 'react';
import type { WalkabilityScoreV2 } from '../../types';

// ── Canvas layout ──────────────────────────────────────────────────────────
const CW = 840, CH = 370;
const GROUND_Y   = CH * 0.71;
const SIDEWALK_Y = CH * 0.785;
const ROAD_Y     = CH * 0.845;
const ROAD_H     = CH * 0.155;

// ── Internal types ─────────────────────────────────────────────────────────
interface Signals {
  airQuality: number; treeCanopy: number; noise: number;
  speedEnv: number;   destinations: number; terrain: number;
}
interface Vehicle {
  x: number; y: number; vx: number; w: number; h: number;
  color: string; type: 'car' | 'bike' | 'truck'; noiseR: number; noiseA: number;
}
interface Tree {
  x: number; tH: number; w: number;
  hue: number; sat: number; lit: number; phase: number; amp: number;
}
interface Building { x: number; w: number; h: number; gray: number; windows: { x: number; y: number; lit: boolean }[]; }
interface Particle  { x: number; y: number; r: number; vx: number; vy: number; alpha: number; }

// ── Utilities ──────────────────────────────────────────────────────────────
const lerp = (a: number, b: number, f: number) => a + (b - a) * Math.max(0, Math.min(1, f));
function seeded(seed: number) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// ── Signal extraction ──────────────────────────────────────────────────────
function extractSignals(cs: WalkabilityScoreV2): Signals {
  const em = cs.components.environmentalComfort.metrics;
  const nm = cs.components.networkDesign.metrics;
  const dm = cs.components.densityContext.metrics;
  const g = (arr: typeof em, name: string, fb: number) => arr.find(m => m.name === name)?.score || fb;
  return {
    airQuality:   g(em, 'Air Quality',        55),
    treeCanopy:   g(em, 'Tree Canopy',         45),
    noise:        g(em, 'Noise',               50),
    speedEnv:     g(nm, 'Speed Environment',   50),
    destinations: g(dm, 'Nearby Destinations', 40),
    terrain:      g(em, 'Terrain',             65),
  };
}

// ── Archetype ──────────────────────────────────────────────────────────────
function getArchetype(cs: WalkabilityScoreV2, sig: Signals) {
  const o = cs.overallScore, net = cs.components.networkDesign.score,
        den = cs.components.densityContext.score, env = cs.components.environmentalComfort.score;
  if (o >= 72 && den >= 65 && net >= 65) return { name: 'Vibrant Urban',          tagline: 'Dense, connected, and alive with possibility' };
  if (o >= 62 && env >= 58 && net >= 55) return { name: 'Walkable Neighborhood',  tagline: 'A place where you might actually choose to walk' };
  if (o >= 48 && net >= 45)              return { name: 'Mixed Character',         tagline: 'Good bones, some rough edges' };
  if (sig.speedEnv < 38)                 return { name: 'Busy Arterial',           tagline: 'Built for cars, endured by people on foot' };
  if (o < 35)                            return { name: 'Difficult Environment',   tagline: 'Significant barriers to comfortable walking' };
  return                                        { name: 'Suburban',               tagline: 'Serviceable for some trips, difficult for others' };
}

// ── Sense chips ────────────────────────────────────────────────────────────
type Quality = 'good' | 'moderate' | 'poor';
const qual = (s: number): Quality => s >= 65 ? 'good' : s >= 38 ? 'moderate' : 'poor';
const chipStyle: Record<Quality, { bg: string; border: string; color: string }> = {
  good:     { bg: 'rgba(56,161,105,0.22)',  border: 'rgba(56,161,105,0.45)',  color: '#9ae6b4' },
  moderate: { bg: 'rgba(214,158,46,0.22)',  border: 'rgba(214,158,46,0.45)',  color: '#fbd38d' },
  poor:     { bg: 'rgba(229,62,62,0.22)',   border: 'rgba(229,62,62,0.45)',   color: '#feb2b2' },
};
function getSenseChips(sig: Signals) {
  return [
    { icon: '👁', label: sig.airQuality >= 65 ? 'Clear skies' : sig.airQuality >= 38 ? 'Hazy horizon' : 'Heavy haze', q: qual(sig.airQuality) },
    { icon: '👂', label: sig.noise >= 65 ? 'Quiet' : sig.noise >= 38 ? 'Urban buzz' : 'Very loud',                    q: qual(sig.noise)       },
    { icon: '🫁', label: sig.airQuality >= 65 ? 'Clean air' : sig.airQuality >= 38 ? 'Moderate air' : 'Poor air',     q: qual(sig.airQuality)  },
    { icon: '🌡', label: sig.terrain >= 65 ? 'Flat terrain' : sig.terrain >= 38 ? 'Some incline' : 'Hilly',           q: qual(sig.terrain)     },
  ] as const;
}

// ── Scene generators ───────────────────────────────────────────────────────
function genBuildings(sig: Signals): Building[] {
  const rand = seeded((sig.destinations * 1.3 + sig.airQuality * 0.7) | 0);
  const buildings: Building[] = [];
  let x = 0;
  const dense = sig.destinations > 62;
  while (x < CW + 130) {
    const bw = dense ? 22 + rand() * 44 : 58 + rand() * 88;
    const bh = dense ? 55 + rand() * 148 : 18 + rand() * 46;
    const gray = 32 + rand() * 32;
    const bTop = GROUND_Y - bh;
    const windows: Building['windows'] = [];
    if (sig.destinations > 30) {
      for (let wy = bTop + 7; wy < GROUND_Y - 6; wy += 13)
        for (let wx = x + 5; wx < x + bw - 5; wx += 11)
          if (rand() > 0.22) windows.push({ x: wx, y: wy, lit: rand() > 0.35 });
    }
    buildings.push({ x, w: bw, h: bh, gray, windows });
    x += bw + (dense ? 1 + rand() * 3 : 8 + rand() * 22);
  }
  return buildings;
}

function genTrees(sig: Signals): Tree[] {
  const count = Math.round(lerp(1, 8, sig.treeCanopy / 100));
  const rand = seeded((sig.treeCanopy * 2.1) | 0);
  return Array.from({ length: count }, (_, i) => ({
    x: (CW / (count + 1)) * (i + 1) + (rand() - 0.5) * 55,
    tH: lerp(44, 102, sig.treeCanopy / 100) * (0.76 + rand() * 0.48),
    w:  lerp(27, 56,  sig.treeCanopy / 100) * (0.76 + rand() * 0.48),
    hue: 120 + (rand() * 22) | 0,
    sat: 34 + (sig.treeCanopy * 0.34) | 0,
    lit: 22 + (sig.treeCanopy * 0.08) | 0,
    phase: rand() * Math.PI * 2,
    amp: 0.6 + rand() * 1.2,
  }));
}

function initHaze(): Particle[] {
  return Array.from({ length: 90 }, () => ({
    x: Math.random() * CW, y: Math.random() * GROUND_Y,
    r: 1 + Math.random() * 3.5,
    vx: (Math.random() - 0.5) * 0.22, vy: -0.07 - Math.random() * 0.13,
    alpha: 0.1 + Math.random() * 0.35,
  }));
}

function spawnVehicle(sig: Signals): Vehicle {
  const speed = lerp(0.55, 3.8, (100 - sig.speedEnv) / 100) * (0.85 + Math.random() * 0.3);
  const lane  = Math.random() < 0.55 ? 0 : 1;
  const laneY = ROAD_Y + ROAD_H * (lane === 0 ? 0.28 : 0.68);
  const roll  = Math.random();
  let type: Vehicle['type'], w: number, h: number, color: string;

  if (sig.speedEnv > 65 && roll < 0.18)      { type = 'bike';  w = 15; h = 10; color = '#10B981'; }
  else if (sig.speedEnv < 35 && roll < 0.18) { type = 'truck'; w = 60; h = 24; color = '#57534E'; }
  else {
    type = 'car'; w = 28 + Math.random() * 10; h = 13 + Math.random() * 4;
    const cols = sig.speedEnv > 55
      ? ['#8B9EA0','#A5B4B8','#7A8890','#B5C4C6','#95AAAC']
      : ['#3A3A3A','#4A4545','#525040','#605550','#706060'];
    color = cols[Math.floor(Math.random() * cols.length)];
  }
  return { x: -w - 10, y: laneY, vx: speed, w, h, color, type, noiseR: 0, noiseA: 0.3 };
}

// ── Canvas draw helpers ────────────────────────────────────────────────────
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function skyColors(air: number): [string, string] {
  if (air >= 70) {
    const f = (air - 70) / 30;
    return [`rgb(${lerp(108,78,f)|0},${lerp(168,148,f)|0},${lerp(208,192,f)|0})`,
            `rgb(${lerp(172,202,f)|0},${lerp(202,228,f)|0},${lerp(228,250,f)|0})`];
  } else if (air >= 40) {
    const f = (air - 40) / 30;
    return [`rgb(${lerp(145,108,f)|0},${lerp(145,168,f)|0},${lerp(118,208,f)|0})`,
            `rgb(${lerp(192,172,f)|0},${lerp(178,202,f)|0},${lerp(135,228,f)|0})`];
  }
  const f = air / 40;
  return [`rgb(${lerp(172,145,f)|0},${lerp(128,145,f)|0},${lerp(65,118,f)|0})`,
          `rgb(${lerp(212,192,f)|0},${lerp(165,178,f)|0},${lerp(85,135,f)|0})`];
}

function drawTree(ctx: CanvasRenderingContext2D, tree: Tree, t: number) {
  const sway = Math.sin(t * 0.018 + tree.phase) * tree.amp;
  const tx = tree.x + sway, base = SIDEWALK_Y;
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(tx - 3, base - tree.tH * 0.58, 6, tree.tH * 0.58);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.beginPath(); ctx.ellipse(tx + 5, base - 1, tree.w * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill();
  const layers = [{dx:0,dy:0,sw:1.0,sl:1.0},{dx:-8,dy:-10,sw:0.82,sl:1.14},{dx:9,dy:-8,sw:0.76,sl:0.9},{dx:0,dy:-19,sw:0.66,sl:1.1}];
  layers.forEach(l => {
    const cx = tx + l.dx, cy = base - tree.tH * 0.64 + l.dy, lit = tree.lit * l.sl;
    ctx.fillStyle = `hsla(${tree.hue},${tree.sat}%,${Math.round(lit*0.62)}%,0.22)`;
    ctx.beginPath(); ctx.ellipse(cx+4,cy+4,tree.w*l.sw*0.62,tree.tH*l.sw*0.57,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = `hsl(${tree.hue},${tree.sat}%,${Math.round(lit)}%)`;
    ctx.beginPath(); ctx.ellipse(cx,cy,tree.w*l.sw*0.62,tree.tH*l.sw*0.57,0,0,Math.PI*2); ctx.fill();
  });
}

function drawPedestrian(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const cycle = Math.sin(t * 0.14), y = SIDEWALK_Y + 4;
  ctx.save(); ctx.strokeStyle = '#2D3748'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.fillStyle = '#F6D794'; ctx.beginPath(); ctx.arc(x, y-15, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x,y-11); ctx.lineTo(x,y-3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x-5+cycle*2,y-5); ctx.moveTo(x,y-9); ctx.lineTo(x+5-cycle*2,y-5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y-3); ctx.lineTo(x-3+cycle*3,y+4); ctx.moveTo(x,y-3); ctx.lineTo(x+3-cycle*3,y+4); ctx.stroke();
  ctx.restore();
}

function drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle) {
  ctx.save();
  if (v.type === 'bike') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(v.x+4,  v.y+2, 4, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(v.x+14, v.y+2, 4, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v.x+4,v.y-2); ctx.lineTo(v.x+14,v.y-2); ctx.stroke();
  } else {
    const r = 4;
    rRect(ctx, v.x, v.y - v.h/2, v.w, v.h, r); ctx.fillStyle = v.color; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(v.x+r, v.y-v.h/2, v.w-r*2, 3);
    ctx.fillStyle = 'rgba(155,205,255,0.48)';
    rRect(ctx, v.x+v.w*0.55, v.y-v.h/2+2, v.w*0.25, v.h-4, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.85)';
    ctx.fillRect(v.x+v.w-5, v.y-4, 4, 3); ctx.fillRect(v.x+v.w-5, v.y+1, 4, 3);
  }
  ctx.restore();
}

// ── Main render ────────────────────────────────────────────────────────────
function renderFrame(
  ctx: CanvasRenderingContext2D,
  sig: Signals, t: number, vehicles: Vehicle[],
  trees: Tree[], buildings: Building[], haze: Particle[], pedX: number,
) {
  ctx.clearRect(0, 0, CW, CH);

  // Sky
  const [skyTop, skyBot] = skyColors(sig.airQuality);
  const skyG = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 20);
  skyG.addColorStop(0, skyTop); skyG.addColorStop(1, skyBot);
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, CW, CH);

  // Sun
  if (sig.airQuality > 44) {
    const sa = (sig.airQuality - 44) / 56, sx = CW * 0.84, sy = CH * 0.1;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    sg.addColorStop(0, `rgba(255,255,218,${0.78*sa})`);
    sg.addColorStop(0.35, `rgba(255,228,130,${0.36*sa})`);
    sg.addColorStop(1, 'rgba(255,198,80,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 50, 0, Math.PI*2); ctx.fill();
  }

  // Haze
  const hazeAlpha = Math.max(0, (64 - sig.airQuality) / 64);
  const hazeRgb   = sig.airQuality < 45 ? '172,138,68' : '152,152,138';
  if (hazeAlpha > 0.04) {
    haze.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${hazeRgb},${p.alpha * hazeAlpha})`; ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = CW; if (p.x > CW) p.x = 0;
      if (p.y < 0) p.y = Math.random() * GROUND_Y * 0.88;
    });
  }

  // Buildings
  buildings.forEach(b => {
    const bTop = GROUND_Y - b.h;
    ctx.fillStyle = `rgb(${b.gray},${b.gray},${Math.min(255, b.gray+6)})`;
    ctx.fillRect(b.x, bTop, b.w, b.h);
    b.windows.forEach(w => {
      ctx.fillStyle = w.lit ? 'rgba(255,242,180,0.55)' : 'rgba(98,108,128,0.28)';
      ctx.fillRect(w.x, w.y, 6, 7);
    });
  });

  // Horizon glow
  const hg = ctx.createLinearGradient(0, GROUND_Y-18, 0, GROUND_Y+12);
  hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(200,185,160,0.12)');
  ctx.fillStyle = hg; ctx.fillRect(0, GROUND_Y-18, CW, 30);

  // Grass
  const g = sig.treeCanopy / 100;
  ctx.fillStyle = `rgb(${lerp(88,52,g)|0},${lerp(92,112,g)|0},${lerp(58,42,g)|0})`;
  ctx.fillRect(0, GROUND_Y, CW, SIDEWALK_Y - GROUND_Y + 5);

  // Trees
  trees.forEach(tree => drawTree(ctx, tree, t));

  // Sidewalk
  ctx.fillStyle = '#CEC8B6'; ctx.fillRect(0, SIDEWALK_Y, CW, ROAD_Y - SIDEWALK_Y);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.7;
  for (let x = 50; x < CW; x += 55) { ctx.beginPath(); ctx.moveTo(x,SIDEWALK_Y); ctx.lineTo(x,ROAD_Y); ctx.stroke(); }

  // Curb
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, ROAD_Y-2, CW, 3);

  // Road
  const rg = sig.speedEnv > 60 ? 80 : 58;
  ctx.fillStyle = `rgb(${rg},${rg-2},${rg-5})`; ctx.fillRect(0, ROAD_Y, CW, ROAD_H);

  // Moving lane dashes
  const laneY = ROAD_Y + ROAD_H * 0.5;
  ctx.strokeStyle = 'rgba(255,255,200,0.33)'; ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]); ctx.lineDashOffset = -((t * 1.5) % 32);
  ctx.beginPath(); ctx.moveTo(0, laneY); ctx.lineTo(CW, laneY); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;

  // Noise rings
  const noisiness = (100 - sig.noise) / 100;
  if (noisiness > 0.18) {
    vehicles.forEach(v => {
      if (v.noiseR > 5) {
        const na = v.noiseA * noisiness;
        ctx.strokeStyle = noisiness > 0.62 ? `rgba(239,68,68,${na})` : `rgba(234,179,8,${na})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(v.x + v.w/2, v.y, v.noiseR, 0, Math.PI*2); ctx.stroke();
      }
    });
  }

  // Vehicles
  vehicles.forEach(v => drawVehicle(ctx, v));

  // Pedestrian (only when traffic is calmer)
  if (sig.speedEnv > 42) drawPedestrian(ctx, pedX, t);

  // Vignette
  const vig = ctx.createRadialGradient(CW/2, CH/2, CH*0.28, CW/2, CH/2, CH*0.88);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, CW, CH);
}

// ── Component ──────────────────────────────────────────────────────────────
interface WalkingAtmosphereProps {
  compositeScore: WalkabilityScoreV2;
}

export default function WalkingAtmosphere({ compositeScore }: WalkingAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Derive display data (runs during render, not in effect)
  const sig       = extractSignals(compositeScore);
  const archetype = getArchetype(compositeScore, sig);
  const chips     = getSenseChips(sig);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    // Build scene from current signals
    const currentSig = extractSignals(compositeScore);
    const buildings  = genBuildings(currentSig);
    const trees      = genTrees(currentSig);
    const haze       = initHaze();
    let   vehicles: Vehicle[] = [];
    let   pedX   = 60;
    let   t      = 0;
    let   animId = 0;

    const spawnRate = lerp(0.028, 0.22, (100 - currentSig.speedEnv) / 100);

    function loop() {
      t++;
      pedX += 0.48;
      if (pedX > CW + 30) pedX = -20;

      if (Math.random() < spawnRate) vehicles.push(spawnVehicle(currentSig));
      vehicles.forEach(v => {
        v.x += v.vx;
        v.noiseR += 1.5;
        v.noiseA = Math.max(0, 0.35 - v.noiseR * 0.0044);
        if (v.noiseR > 80) { v.noiseR = 0; v.noiseA = 0.35; }
      });
      vehicles = vehicles.filter(v => v.x < CW + 90);

      renderFrame(ctx, currentSig, t, vehicles, trees, buildings, haze, pedX);
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [compositeScore]);

  return (
    <div
      className="rounded-2xl border overflow-hidden relative"
      style={{ borderColor: '#e0dbd0' }}
    >
      <canvas ref={canvasRef} width={CW} height={CH} className="w-full block" />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,8,15,0.82) 0%, rgba(5,8,15,0.32) 38%, transparent 62%)' }}
      >
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          {/* Archetype */}
          <div className="mb-3">
            <div
              className="text-lg sm:text-xl font-bold leading-tight"
              style={{ color: '#fff', textShadow: '0 2px 16px rgba(0,0,0,0.5)', letterSpacing: '-0.02em' }}
            >
              {archetype.name}
            </div>
            <div
              className="text-xs sm:text-sm mt-1"
              style={{ color: 'rgba(255,255,255,0.58)', fontStyle: 'italic', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
            >
              {archetype.tagline}
            </div>
          </div>

          {/* Sense chips */}
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => {
              const s = chipStyle[chip.q];
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    color: s.color,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  {chip.icon} {chip.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
