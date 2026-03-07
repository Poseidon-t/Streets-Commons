import type { WalkabilityScoreV2 } from '../../types';

interface Signals {
  speedEnv: number;
}

function extractSignals(cs: WalkabilityScoreV2): Signals {
  const nm = cs.components.networkDesign.metrics;
  const g = (arr: typeof nm, name: string, fb: number) => arr.find(m => m.name === name)?.score || fb;
  return { speedEnv: g(nm, 'Speed Environment', 50) };
}

function getArchetype(cs: WalkabilityScoreV2, sig: Signals) {
  const o = cs.overallScore, net = cs.components.networkDesign.score,
        den = cs.components.densityContext.score, env = cs.components.environmentalComfort.score,
        safety = cs.components.safety.score;
  if (o >= 70 && den >= 65 && net >= 65) return { name: 'Vibrant Urban',         tagline: 'Dense, connected, and alive with possibility' };
  if (o >= 66 && den >= 78 && safety >= 78) return { name: 'Vibrant Urban',      tagline: 'Dense, connected, and alive with possibility' };
  if (o >= 60 && env >= 55 && net >= 50) return { name: 'Walkable Neighborhood', tagline: 'A place where you might actually choose to walk' };
  if (o >= 57 && den >= 68 && safety >= 68) return { name: 'Walkable Neighborhood', tagline: 'A place where you might actually choose to walk' };
  if (o >= 45 && net >= 40)              return { name: 'Mixed Character',        tagline: 'Good bones, some rough edges' };
  if (sig.speedEnv < 38)                 return { name: 'Busy Arterial',          tagline: 'Built for cars, endured by people on foot' };
  if (o < 35)                            return { name: 'Difficult Environment',  tagline: 'Significant barriers to comfortable walking' };
  return                                        { name: 'Suburban',              tagline: 'Serviceable for some trips, difficult for others' };
}

interface StreetVibeProps {
  compositeScore: WalkabilityScoreV2 | null;
}

export default function StreetVibe({ compositeScore }: StreetVibeProps) {
  if (!compositeScore) {
    return (
      <div className="pb-3">
        <div className="h-4 w-32 rounded mb-1.5 animate-pulse" style={{ backgroundColor: '#e0dbd0' }} />
        <div className="h-3 w-52 rounded animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
      </div>
    );
  }

  const sig = extractSignals(compositeScore);
  const archetype = getArchetype(compositeScore, sig);

  return (
    <div className="pb-3">
      <div className="text-base font-bold leading-tight" style={{ color: '#2a3a2a', letterSpacing: '-0.01em' }}>
        {archetype.name}
      </div>
      <div className="text-xs mt-0.5" style={{ color: '#8a9a8a', fontStyle: 'italic' }}>
        {archetype.tagline}
      </div>
    </div>
  );
}
