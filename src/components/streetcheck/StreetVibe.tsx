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
      <div style={{ paddingBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#3d3020', marginBottom: 4 }}>
          Street character
        </div>
        <div className="animate-pulse" style={{ height: 20, width: 140, backgroundColor: '#c4b59a', marginBottom: 4 }} />
        <div className="animate-pulse" style={{ height: 12, width: 200, backgroundColor: '#d8d0c4' }} />
      </div>
    );
  }

  const sig = extractSignals(compositeScore);
  const archetype = getArchetype(compositeScore, sig);

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#3d3020', marginBottom: 4 }}>
        Street character
      </div>
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 24,
        fontWeight: 700,
        color: '#1a1208',
        letterSpacing: '-0.01em',
        lineHeight: 1.15,
        marginBottom: 4,
      }}>
        {archetype.name}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2010', lineHeight: 1.4 }}>
        {archetype.tagline}
      </div>
    </div>
  );
}
