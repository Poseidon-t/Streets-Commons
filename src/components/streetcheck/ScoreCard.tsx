import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';
import PlainLanguageSummary from './PlainLanguageSummary';
import WalkerInfographic from '../WalkerInfographic';
import { scoreColor100 as getScoreColor } from '../../utils/colors';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
}

function getScoreTier(score: number): string {
  if (score >= 80) return 'Walkable';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Car-dependent';
  if (score >= 20) return 'Difficult';
  return 'Hostile';
}

function CircularScore({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  const displayScore = (score / 10).toFixed(1);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[120px] h-[120px] sm:w-[160px] sm:h-[160px]">
        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
          <circle cx="80" cy="80" r={radius} stroke="#e0dbd0" strokeWidth="12" fill="none" />
          <circle
            cx="80" cy="80" r={radius}
            stroke={color} strokeWidth="12" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl sm:text-5xl font-bold" style={{ color }}>{displayScore}</div>
          <div className="text-xs mt-[-2px]" style={{ color: '#8a9a8a' }}>out of 10</div>
          <div className="text-xs font-semibold mt-1" style={{ color }}>{getScoreTier(score)}</div>
        </div>
      </div>
    </div>
  );
}

function ComponentBreakdown({ compositeScore }: { compositeScore: WalkabilityScoreV2 }) {
  const components = [
    compositeScore.components.networkDesign,
    compositeScore.components.environmentalComfort,
    compositeScore.components.safety,
    compositeScore.components.densityContext,
  ].filter(c => c.score > 0);

  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => b.score - a.score);

  return (
    <div className="mt-5 space-y-2.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-center" style={{ color: '#8a9a8a', letterSpacing: '0.08em' }}>
        Component Scores
      </div>
      {sorted.map(c => {
        const pct = Math.round(c.score);
        const color = getScoreColor(pct);
        return (
          <div key={c.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: '#4a5a4a' }}>{c.label}</span>
              <span className="text-xs font-bold tabular-nums" style={{ color }}>{(c.score / 10).toFixed(1)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e3d8' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreCard({ metrics, compositeScore }: ScoreCardProps) {
  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);

  return (
    <div className="rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 border flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center" style={{ color: '#2a3a2a' }}>
        Walkability Score
      </h2>
      <div className="flex-1 flex flex-col items-center justify-center">
        <CircularScore score={score} />
      </div>

      {/* Component breakdown bars */}
      {compositeScore && <ComponentBreakdown compositeScore={compositeScore} />}

      {/* Verdict — prominent */}
      <PlainLanguageSummary metrics={metrics} compositeScore={compositeScore} />

      {/* Walker Infographic — human translation of the score */}
      <WalkerInfographic score={score / 10} />

      {/* Confidence note while still loading */}
      {compositeScore && compositeScore.confidence < 80 && (
        <div className="mt-4 text-xs text-center" style={{ color: '#8a9a8a' }}>
          Loading more data... ({compositeScore.confidence}% confidence)
        </div>
      )}
    </div>
  );
}
