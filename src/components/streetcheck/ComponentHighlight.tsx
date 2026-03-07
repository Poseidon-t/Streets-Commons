import type { WalkabilityScoreV2 } from '../../types';

interface ComponentHighlightProps {
  compositeScore: WalkabilityScoreV2 | null;
}

// Zone boundary points on the semicircle arc (pre-computed)
// 42%: angle = π*(1-0.42) = π*0.58
const Z42X = +(40 + 32 * Math.cos(Math.PI * 0.58)).toFixed(1); // ≈ 32.0
const Z42Y = +(44 - 32 * Math.sin(Math.PI * 0.58)).toFixed(1); // ≈ 13.0
// 65%: angle = π*(1-0.65) = π*0.35
const Z65X = +(40 + 32 * Math.cos(Math.PI * 0.35)).toFixed(1); // ≈ 54.5
const Z65Y = +(44 - 32 * Math.sin(Math.PI * 0.35)).toFixed(1); // ≈ 15.5

// SVG arc path for score 0–100, filled counterclockwise from left to score point
function gaugeArc(score: number): string {
  const pct = Math.max(0, Math.min(99.9, score)) / 100;
  if (pct < 0.01) return '';
  const angle = Math.PI * (1 - pct);
  const x = (40 + 32 * Math.cos(angle)).toFixed(1);
  const y = (44 - 32 * Math.sin(angle)).toFixed(1);
  return `M 8 44 A 32 32 0 0 0 ${x} ${y}`;
}

function retroColor(score: number): string {
  if (score >= 65) return '#2a5224';
  if (score >= 42) return '#d4920c';
  return '#b8401a';
}

const LABEL_LINES: Record<string, [string, string]> = {
  'Network Design':         ['Network', 'Design'],
  'Environmental Comfort':  ['Env.', 'Comfort'],
  'Safety':                 ['Safety', ''],
  'Density & Destinations': ['Density &', 'Dest.'],
};

const EXPLANATIONS: Record<string, (score: number) => string> = {
  'Network Design': (s) =>
    s >= 65 ? 'Well-connected grid with frequent crossings and good footpath coverage'
    : s >= 42 ? 'Reasonable connectivity but some gaps in the pedestrian network'
    : 'Fragmented street network makes walking routes indirect or difficult',
  'Environmental Comfort': (s) =>
    s >= 65 ? 'Pleasant walking environment with shade, low noise, and good air quality'
    : s >= 42 ? 'Moderate comfort — some noise or limited shade on key routes'
    : 'High noise, limited tree canopy, or poor air quality reduces walking comfort',
  'Safety': (s) =>
    s >= 65 ? 'Low traffic speeds and good pedestrian infrastructure make walking safe'
    : s >= 42 ? 'Moderate safety — main arterials are more exposed to traffic'
    : 'High traffic speeds or missing crossings create hazards for pedestrians',
  'Density & Destinations': (s) =>
    s >= 65 ? 'Excellent access to daily needs and services within walking distance'
    : s >= 42 ? 'Good access to some destinations; transit coverage is moderate'
    : 'Limited destinations within walking distance; car often needed for errands',
};

function GaugeDial({ score, label, isTop, isBottom }: {
  score: number;
  label: string;
  isTop: boolean;
  isBottom: boolean;
}) {
  const color = retroColor(score);
  const arc = gaugeArc(score);
  const [line1, line2] = LABEL_LINES[label] ?? [label, ''];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 2px' }}>
      <svg viewBox="0 0 80 52" width={72} height={47} style={{ display: 'block', overflow: 'visible' }}>
        {/* Zone background arcs */}
        <path d={`M 8 44 A 32 32 0 0 0 ${Z42X} ${Z42Y}`} stroke="#b8401a" strokeWidth={7} fill="none" opacity={0.18} />
        <path d={`M ${Z42X} ${Z42Y} A 32 32 0 0 0 ${Z65X} ${Z65Y}`} stroke="#d4920c" strokeWidth={7} fill="none" opacity={0.18} />
        <path d={`M ${Z65X} ${Z65Y} A 32 32 0 0 0 72 44`} stroke="#2a5224" strokeWidth={7} fill="none" opacity={0.18} />
        {/* Score arc */}
        {arc && <path d={arc} stroke={color} strokeWidth={7} fill="none" />}
        {/* Tick marks */}
        <line x1={8} y1={44} x2={11.5} y2={44} stroke="#1e1608" strokeWidth={1} opacity={0.35} />
        <line x1={40} y1={12} x2={40} y2={15.5} stroke="#1e1608" strokeWidth={1} opacity={0.35} />
        <line x1={72} y1={44} x2={68.5} y2={44} stroke="#1e1608" strokeWidth={1} opacity={0.35} />
        {/* Tick labels */}
        <text x={5} y={50} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={7} fill="#5c4a2c">0</text>
        <text x={40} y={10} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={7} fill="#5c4a2c">5</text>
        <text x={75} y={50} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={7} fill="#5c4a2c">10</text>
        {/* Score number */}
        <text x={40} y={42} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={13} fontWeight={700} fill={color}>
          {(score / 10).toFixed(1)}
        </text>
      </svg>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d2f18', textAlign: 'center', lineHeight: 1.3, marginTop: 3, minHeight: 20 }}>
        {line1}{line2 ? <><br />{line2}</> : null}
      </div>
      {isTop && (
        <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1px 4px', border: '1px solid #2a5224', color: '#2a5224', marginTop: 4, display: 'block' }}>
          Strength
        </span>
      )}
      {isBottom && (
        <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1px 4px', border: '1px solid #b8401a', color: '#b8401a', marginTop: 4, display: 'block' }}>
          Challenge
        </span>
      )}
    </div>
  );
}

export default function ComponentHighlight({ compositeScore }: ComponentHighlightProps) {
  if (!compositeScore) {
    return (
      <div className="retro-card">
        <div className="retro-card-header">
          <span className="retro-card-header-title">Score Breakdown · Component Analysis</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '16px 8px 8px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px', borderRight: i < 3 ? '1px solid #c4b59a' : 'none' }}>
              <div className="animate-pulse" style={{ width: 60, height: 38, background: '#d8d0c4' }} />
              <div className="animate-pulse" style={{ height: 8, width: 44, background: '#e0d8cc', marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px 14px', borderTop: '1px dashed #c4b59a', marginTop: 8 }}>
          {[120, 56, 96, 140].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <div className="animate-pulse" style={{ height: 8, width: 56, background: '#d8d0c4', flexShrink: 0 }} />
              <div className="animate-pulse" style={{ height: 8, width: w, background: '#e0d8cc' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { networkDesign, environmentalComfort, safety, densityContext } = compositeScore.components;
  const components = [networkDesign, environmentalComfort, safety, densityContext].filter(c => c.score > 0);
  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => b.score - a.score);
  const topScore = sorted[0].score;
  const bottomScore = sorted[sorted.length - 1].score;

  return (
    <div className="retro-card">
      <div className="retro-card-header">
        <span className="retro-card-header-title">Score Breakdown · Component Analysis</span>
      </div>

      {/* Gauge dials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '16px 8px 8px' }}>
        {sorted.map((c, i) => (
          <div key={c.label} style={{ borderRight: i < sorted.length - 1 ? '1px solid #c4b59a' : 'none' }}>
            <GaugeDial
              score={c.score}
              label={c.label}
              isTop={c.score === topScore}
              isBottom={c.score === bottomScore && c.score < 50 && sorted.length > 1}
            />
          </div>
        ))}
      </div>

      {/* Explanation rows */}
      <div style={{ padding: '8px 14px 14px', borderTop: '1px dashed #c4b59a' }}>
        {sorted.map((c, i) => {
          const color = retroColor(c.score);
          const shortName = (LABEL_LINES[c.label] ?? [c.label])[0];
          return (
            <div key={c.label} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'flex-start', borderBottom: i < sorted.length - 1 ? '1px solid rgba(196,181,154,0.25)' : 'none' }}>
              <div style={{ width: 6, height: 6, background: color, flexShrink: 0, marginTop: 4 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#8a7a60', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, width: 60 }}>
                {shortName}
              </span>
              <span style={{ fontSize: 9, color: '#3d2f18', lineHeight: 1.5, fontStyle: 'italic' }}>
                {EXPLANATIONS[c.label]?.(c.score) ?? ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
