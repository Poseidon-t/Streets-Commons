import type { WalkabilityScoreV2 } from '../../types';

interface Signals {
  airQuality: number; treeCanopy: number; noise: number;
  speedEnv: number;   destinations: number; terrain: number;
}

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

function getArchetype(cs: WalkabilityScoreV2, sig: Signals) {
  const o = cs.overallScore, net = cs.components.networkDesign.score,
        den = cs.components.densityContext.score, env = cs.components.environmentalComfort.score,
        safety = cs.components.safety.score;
  // Primary: dense, connected, high-scoring
  if (o >= 70 && den >= 65 && net >= 65) return { name: 'Vibrant Urban',         tagline: 'Dense, connected, and alive with possibility' };
  // Alternative: high accessibility + great street design — covers gaps in network data
  if (o >= 66 && den >= 78 && safety >= 78) return { name: 'Vibrant Urban',      tagline: 'Dense, connected, and alive with possibility' };
  // Primary walkable neighbourhood
  if (o >= 60 && env >= 55 && net >= 50) return { name: 'Walkable Neighborhood', tagline: 'A place where you might actually choose to walk' };
  // Alternative: good destinations + solid infrastructure
  if (o >= 57 && den >= 68 && safety >= 68) return { name: 'Walkable Neighborhood', tagline: 'A place where you might actually choose to walk' };
  if (o >= 45 && net >= 40)              return { name: 'Mixed Character',        tagline: 'Good bones, some rough edges' };
  if (sig.speedEnv < 38)                 return { name: 'Busy Arterial',          tagline: 'Built for cars, endured by people on foot' };
  if (o < 35)                            return { name: 'Difficult Environment',  tagline: 'Significant barriers to comfortable walking' };
  return                                        { name: 'Suburban',              tagline: 'Serviceable for some trips, difficult for others' };
}

type Quality = 'good' | 'moderate' | 'poor';
const qual = (s: number): Quality => s >= 65 ? 'good' : s >= 38 ? 'moderate' : 'poor';

const chipStyle: Record<Quality, { bg: string; border: string; color: string }> = {
  good:     { bg: 'rgba(56,161,105,0.13)',  border: 'rgba(56,161,105,0.32)',  color: '#276749' },
  moderate: { bg: 'rgba(214,158,46,0.13)',  border: 'rgba(214,158,46,0.32)',  color: '#7b5a0a' },
  poor:     { bg: 'rgba(229,62,62,0.13)',   border: 'rgba(229,62,62,0.32)',   color: '#9b2c2c' },
};

function getSenseChips(sig: Signals) {
  return [
    { icon: '👁', label: sig.airQuality >= 65 ? 'Clear skies' : sig.airQuality >= 38 ? 'Hazy horizon' : 'Heavy haze', q: qual(sig.airQuality) },
    { icon: '👂', label: sig.noise >= 65 ? 'Quiet' : sig.noise >= 38 ? 'Urban buzz' : 'Very loud',                    q: qual(sig.noise)       },
    { icon: '🫁', label: sig.airQuality >= 65 ? 'Clean air' : sig.airQuality >= 38 ? 'Moderate air' : 'Poor air',     q: qual(sig.airQuality)  },
    { icon: '🌡', label: sig.terrain >= 65 ? 'Flat terrain' : sig.terrain >= 38 ? 'Some incline' : 'Hilly',           q: qual(sig.terrain)     },
  ] as const;
}

interface StreetVibeProps {
  compositeScore: WalkabilityScoreV2 | null;
}

export default function StreetVibe({ compositeScore }: StreetVibeProps) {
  if (!compositeScore) {
    return (
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: '#e0dbd0' }} />
        <div className="h-3 w-52 rounded mb-3" style={{ backgroundColor: '#e8e3d8' }} />
        <div className="flex gap-2">
          {[52, 68, 60, 56].map(w => (
            <div key={w} className="h-6 rounded-full" style={{ width: w, backgroundColor: '#e8e3d8' }} />
          ))}
        </div>
      </div>
    );
  }

  const sig = extractSignals(compositeScore);
  const archetype = getArchetype(compositeScore, sig);
  const chips = getSenseChips(sig);

  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="text-base font-bold leading-tight" style={{ color: '#2a3a2a', letterSpacing: '-0.01em' }}>
          {archetype.name}
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#8a9a8a', fontStyle: 'italic' }}>
          {archetype.tagline}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map(chip => {
          const s = chipStyle[chip.q];
          return (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
            >
              {chip.icon} {chip.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
