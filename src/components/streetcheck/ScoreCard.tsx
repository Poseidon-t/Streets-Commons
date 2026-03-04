import type { WalkabilityMetrics, WalkabilityScoreV2 } from '../../types';
import PlainLanguageSummary from './PlainLanguageSummary';
import WalkerInfographic from '../WalkerInfographic';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
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
          <div className="text-sm mt-[-2px]" style={{ color: '#8a9a8a' }}>
            out of 10
          </div>
        </div>
      </div>
    </div>
  );
}

function BestWorstCallout({ compositeScore }: { compositeScore: WalkabilityScoreV2 }) {
  const components = [
    compositeScore.components.networkDesign,
    compositeScore.components.environmentalComfort,
    compositeScore.components.safety,
    compositeScore.components.densityContext,
  ].filter(c => c.score > 0);

  if (components.length < 2) return null;

  const sorted = [...components].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="flex gap-2 mt-4">
      <div className="flex-1 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(34,197,94,0.08)' }}>
        <span className="font-semibold" style={{ color: '#16a34a' }}>✓ Strength</span>
        <div style={{ color: '#2a3a2a' }} className="mt-0.5">{best.label}</div>
      </div>
      <div className="flex-1 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
        <span className="font-semibold" style={{ color: '#dc2626' }}>↑ Needs work</span>
        <div style={{ color: '#2a3a2a' }} className="mt-0.5">{worst.label}</div>
      </div>
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

      {/* Verdict — prominent */}
      <PlainLanguageSummary metrics={metrics} compositeScore={compositeScore} />

      {/* Best / Worst callout */}
      {compositeScore && <BestWorstCallout compositeScore={compositeScore} />}

      {/* Walker Infographic */}
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
