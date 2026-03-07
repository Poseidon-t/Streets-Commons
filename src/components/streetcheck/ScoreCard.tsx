import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';
import PlainLanguageSummary from './PlainLanguageSummary';
import WalkerInfographic from '../WalkerInfographic';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
  embedded?: boolean;
  compact?: boolean;
}

function getScoreTier(score: number): string {
  if (score >= 80) return 'Walkable';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Car-dependent';
  if (score >= 20) return 'Difficult';
  return 'Hostile';
}

function retroColor(score: number): string {
  if (score >= 65) return '#2a5224';
  if (score >= 42) return '#d4920c';
  return '#b8401a';
}

function retroGaugeFill(score: number): string {
  if (score >= 65) return 'retro-gauge-fill';
  if (score >= 42) return 'retro-gauge-fill retro-gauge-fill-amber';
  return 'retro-gauge-fill retro-gauge-fill-red';
}

export default function ScoreCard({ metrics, compositeScore, embedded }: ScoreCardProps) {
  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);
  const displayScore = (score / 10).toFixed(1);
  const color = retroColor(score);
  const tier = getScoreTier(score);

  const content = (
    <>
      {/* Big monospace number */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {displayScore}
        </span>
        <span style={{ fontSize: 11, color: '#5c4a2c', paddingBottom: 6 }}>/10</span>
      </div>

      {/* Gauge with tick labels */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          {['0', '2.5', '5.0', '7.5', '10'].map(t => (
            <span key={t} style={{ fontSize: 10, color: '#5c4a2c' }}>{t}</span>
          ))}
        </div>
        <div className="retro-gauge-track">
          <div className={retroGaugeFill(score)} style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Tier stamp */}
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
        textTransform: 'uppercase' as const, padding: '3px 10px',
        border: `1.5px solid ${color}`, color,
        display: 'inline-block', marginBottom: 14,
      }}>
        {tier}
      </span>

      {/* Verdict */}
      <PlainLanguageSummary metrics={metrics} compositeScore={compositeScore} />

      {/* Walker infographic */}
      <WalkerInfographic score={score / 10} compact />

      {compositeScore && compositeScore.confidence < 55 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#5c4a2c' }}>
          Building a complete picture...
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{content}</div>;
  }

  return (
    <div className="retro-card" style={{ padding: '20px 18px' }}>
      {content}
    </div>
  );
}
