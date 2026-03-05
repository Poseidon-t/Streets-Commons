import type { WalkabilityScoreV2 } from '../../types';

interface PersonaCardsProps {
  compositeScore: WalkabilityScoreV2;
}

interface PersonaResult {
  name: string;
  subtitle: string;
  score: number;
  verdictLabel: string;
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function weightedAvg(items: { score: number; weight: number }[]): number {
  const valid = items.filter(i => i.score > 0);
  if (!valid.length) return 0;
  const total = valid.reduce((s, i) => s + i.weight, 0);
  return valid.reduce((s, i) => s + i.score * i.weight, 0) / total;
}

function verdictLabel(score: number): string {
  if (score >= 75) return 'Excellent fit';
  if (score >= 60) return 'Works well';
  if (score >= 45) return 'Some trade-offs';
  if (score >= 30) return 'Limited suitability';
  return 'Not recommended';
}

function computePersonas(cs: WalkabilityScoreV2): PersonaResult[] {
  const { networkDesign, environmentalComfort, safety, densityContext } = cs.components;

  const transit      = densityContext.metrics.find(m => m.name === 'Transit Access')?.score      ?? 0;
  const destinations = densityContext.metrics.find(m => m.name === 'Nearby Destinations')?.score ?? 0;
  const noise        = environmentalComfort.metrics.find(m => m.name === 'Noise')?.score          ?? 0;
  const lighting     = environmentalComfort.metrics.find(m => m.name === 'Street Lighting')?.score ?? 0;
  const terrain      = environmentalComfort.metrics.find(m => m.name === 'Terrain')?.score        ?? 0;
  const airQuality   = environmentalComfort.metrics.find(m => m.name === 'Air Quality')?.score    ?? 0;
  const treeCanopy   = environmentalComfort.metrics.find(m => m.name === 'Tree Canopy')?.score    ?? 0;

  // 1. Daily commuter — network + transit + destinations
  const commuter = clamp(Math.round(weightedAvg([
    { score: networkDesign.score,  weight: 0.35 },
    { score: transit,              weight: 0.35 },
    { score: destinations,         weight: 0.30 },
  ])));

  // 2. Families — low traffic speed + safe streets + parks nearby
  const families = clamp(Math.round(weightedAvg([
    { score: safety.score,              weight: 0.40 },
    { score: networkDesign.score,       weight: 0.30 },
    { score: noise,                     weight: 0.15 },
    { score: environmentalComfort.score,weight: 0.15 },
  ])));

  // 3. Older adults — terrain, lighting, close services, transit fallback
  const elderly = clamp(Math.round(weightedAvg([
    { score: densityContext.score, weight: 0.30 },
    { score: safety.score,         weight: 0.30 },
    { score: terrain,              weight: 0.20 },
    { score: lighting,             weight: 0.10 },
    { score: transit,              weight: 0.10 },
  ])));

  // 4. Car-free living — needs ALL pillars to be decent; penalise weak links
  const carFreeRaw = weightedAvg([
    { score: densityContext.score,  weight: 0.40 },
    { score: networkDesign.score,   weight: 0.35 },
    { score: transit,               weight: 0.25 },
  ]);
  // Cap at 2× the weakest pillar (car-free breaks if any one thing fails)
  const weakest = Math.min(densityContext.score, networkDesign.score, transit > 0 ? transit : 100);
  const carFree = clamp(Math.round(Math.min(carFreeRaw, weakest * 1.4)));

  // 5. Remote workers — destinations (cafés/cowork) + pleasant environment
  const remote = clamp(Math.round(weightedAvg([
    { score: destinations,         weight: 0.45 },
    { score: airQuality,           weight: 0.20 },
    { score: noise,                weight: 0.15 },
    { score: treeCanopy,           weight: 0.10 },
    { score: networkDesign.score,  weight: 0.10 },
  ])));

  return [
    { name: 'Daily Commuter',        subtitle: 'Walking, transit & daily errands on foot', score: commuter, verdictLabel: verdictLabel(commuter) },
    { name: 'Families',              subtitle: 'Safe streets, parks, school runs',          score: families, verdictLabel: verdictLabel(families) },
    { name: 'Older Adults',          subtitle: 'Accessible services, flat terrain, safety', score: elderly,  verdictLabel: verdictLabel(elderly)  },
    { name: 'Car-Free Living',       subtitle: 'No vehicle — walking and transit only',     score: carFree,  verdictLabel: verdictLabel(carFree)  },
    { name: 'Remote Workers',        subtitle: 'Cafés, parks, midday walks',                score: remote,   verdictLabel: verdictLabel(remote)   },
  ];
}

function scoreColor(score: number): string {
  if (score >= 65) return '#22c55e';
  if (score >= 42) return '#eab308';
  return '#ef4444';
}

function PersonaRow({ name, subtitle, score, verdictLabel: verdict }: PersonaResult) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3">
      {/* Vertical accent bar */}
      <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color, minHeight: 36 }} />

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight" style={{ color: '#2a3a2a' }}>{name}</div>
        <div className="text-xs mt-0.5 leading-snug" style={{ color: '#8a9a8a' }}>{subtitle}</div>
      </div>

      {/* Score bar */}
      <div className="w-20 sm:w-28 flex-shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e3d8' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.max(score, 2)}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* Score + verdict */}
      <div className="text-right flex-shrink-0 w-[88px]">
        <div className="text-sm font-bold tabular-nums leading-tight" style={{ color }}>{score}</div>
        <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8a9a8a' }}>{verdict}</div>
      </div>
    </div>
  );
}

export default function PersonaCards({ compositeScore }: PersonaCardsProps) {
  const personas = computePersonas(compositeScore);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}
    >
      {/* Header */}
      <div
        className="px-4 sm:px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: '#e0dbd0' }}
      >
        <h3
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: '#8a9a8a', letterSpacing: '0.08em' }}
        >
          Who this street works for
        </h3>
        <span className="text-xs" style={{ color: '#b0bab0' }}>score / 100</span>
      </div>

      {/* Persona rows */}
      <div className="divide-y" style={{ borderColor: '#f0ebe2' }}>
        {personas.map(p => (
          <PersonaRow key={p.name} {...p} />
        ))}
      </div>
    </div>
  );
}
