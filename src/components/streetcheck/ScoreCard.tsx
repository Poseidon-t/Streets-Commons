import { COLORS } from '../../constants';
import type { WalkabilityMetrics } from '../../types';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
}

function CircularScore({ score, label }: { score: number; label: string }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getColor = () => {
    if (score >= 8) return COLORS.excellent;
    if (score >= 6) return COLORS.good;
    if (score >= 4) return COLORS.fair;
    if (score >= 2) return COLORS.poor;
    return COLORS.critical;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[120px] h-[120px] sm:w-[160px] sm:h-[160px]">
        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#e0dbd0"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={getColor()}
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl sm:text-5xl font-bold" style={{ color: getColor() }}>
            {score.toFixed(1)}
          </div>
          <div className="text-xs sm:text-sm" style={{ color: '#8a9a8a' }}>out of 10</div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold" style={{ color: getColor() }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function ScoreCard({ metrics }: ScoreCardProps) {
  const score = metrics.overallScore;
  const filledWalkers = Math.round(score); // 7.8 -> 8 green walkers
  const emptyWalkers = 10 - filledWalkers;

  const getWalkerColor = (score: number) => {
    if (score >= 8) return '#22C55E'; // green
    if (score >= 6) return '#F59E0B'; // amber
    if (score >= 4) return '#F97316'; // orange
    return '#EF4444'; // red
  };

  return (
    <div className="rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 border-2" style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderColor: '#e0dbd0' }}>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center" style={{ color: '#2a3a2a' }}>
        Walkability Score
      </h2>
      <CircularScore score={metrics.overallScore} label={metrics.label} />

      {/* Walker Visualization */}
      <div className="mt-6 pt-6 border-t" style={{ borderColor: '#e0dbd0' }}>
        <p className="text-xs text-center mb-3" style={{ color: '#8a9a8a' }}>
          Out of 10 walkers, how many feel safe?
        </p>

        <div className="flex items-center justify-center gap-2 mb-2">
          {/* Filled walkers */}
          {Array.from({ length: filledWalkers }).map((_, i) => (
            <div
              key={`filled-${i}`}
              className="text-2xl sm:text-3xl transition-transform hover:scale-110"
              style={{ color: getWalkerColor(score) }}
            >
              🚶
            </div>
          ))}

          {/* Empty walkers */}
          {Array.from({ length: emptyWalkers }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="text-2xl sm:text-3xl opacity-20 grayscale"
            >
              🚶
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs mt-2">
          <span className="font-semibold" style={{ color: getWalkerColor(score) }}>
            {filledWalkers} feel comfortable
          </span>
          {emptyWalkers > 0 && (
            <span style={{ color: '#8a9a8a' }}>
              {emptyWalkers} don't feel safe
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
