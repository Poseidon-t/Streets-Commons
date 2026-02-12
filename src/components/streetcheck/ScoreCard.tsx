import type { WalkabilityMetrics, CrashData, CountryCrashData, WalkabilityScoreV2 } from '../../types';

interface ScoreCardProps {
  metrics: WalkabilityMetrics;
  crashData?: CrashData | null;
  crashLoading?: boolean;
  compositeScore?: WalkabilityScoreV2 | null;
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#84cc16';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
    default: return '#8a9a8a';
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function CircularScore({ score, grade }: { score: number; grade: string }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getGradeColor(grade);

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
          <div className="text-4xl sm:text-5xl font-bold" style={{ color }}>{score}</div>
          <div className="text-lg sm:text-xl font-bold mt-[-2px]" style={{ color }}>
            {grade}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponentBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = getScoreColor(score);
  return (
    <div className="flex items-center gap-3">
      <div className="w-[120px] sm:w-[140px] text-xs text-right flex-shrink-0" style={{ color: '#6b7280' }}>
        <span className="font-medium" style={{ color: '#2a3a2a' }}>{label}</span>
        <span className="ml-1 text-[10px]">({Math.round(weight * 100)}%)</span>
      </div>
      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#e0dbd0' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-8 text-xs font-semibold text-right" style={{ color }}>{score}</div>
    </div>
  );
}

const WHO_GLOBAL_AVG = 15.0;

function CrashSummary({ data }: { data: CrashData }) {
  if (data.type === 'local') {
    if (data.totalCrashes === 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#16a34a' }}>No fatal crashes within {data.radiusMeters}m</span>
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>({data.yearRange.from}–{data.yearRange.to})</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>{data.totalFatalities}</span>
        <span className="text-xs" style={{ color: '#6b7280' }}>
          {data.totalFatalities === 1 ? 'death' : 'deaths'} in {data.totalCrashes} fatal {data.totalCrashes === 1 ? 'crash' : 'crashes'} within {data.radiusMeters}m
        </span>
        <span className="text-[10px]" style={{ color: '#9ca3af' }}>({data.yearRange.from}–{data.yearRange.to})</span>
      </div>
    );
  }

  const countryData = data as CountryCrashData;
  const isAboveAvg = countryData.deathRatePer100k > WHO_GLOBAL_AVG;
  const ratio = (countryData.deathRatePer100k / WHO_GLOBAL_AVG) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: isAboveAvg ? '#dc2626' : '#f59e0b' }}>
          {countryData.deathRatePer100k.toFixed(1)}
        </span>
        <span className="text-xs" style={{ color: '#6b7280' }}>
          road deaths per 100k · {countryData.countryName}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${Math.min((WHO_GLOBAL_AVG / 40) * 100, 100)}%`, backgroundColor: '#9ca3af' }}
        />
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min((countryData.deathRatePer100k / 40) * 100, 100)}%`,
            backgroundColor: isAboveAvg ? '#fca5a5' : '#fde68a',
          }}
        />
      </div>
      <div className="flex justify-between text-[10px]" style={{ color: '#9ca3af' }}>
        <span>{isAboveAvg ? `${Math.round(ratio - 100)}% above` : `${Math.round(100 - ratio)}% below`} global avg</span>
        <span>{countryData.year}</span>
      </div>
    </div>
  );
}

export default function ScoreCard({ metrics, crashData, crashLoading, compositeScore }: ScoreCardProps) {
  const score = compositeScore?.overallScore ?? Math.round(metrics.overallScore * 10);
  const grade = compositeScore?.grade ?? (score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F');
  const filledWalkers = Math.round(score / 10);
  const emptyWalkers = 10 - filledWalkers;

  const getWalkerColor = (s: number) => {
    if (s >= 80) return '#22C55E';
    if (s >= 60) return '#F59E0B';
    if (s >= 40) return '#F97316';
    return '#EF4444';
  };

  return (
    <div className="rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 border-2 flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderColor: '#e0dbd0' }}>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center" style={{ color: '#2a3a2a' }}>
        Walkability Score
      </h2>
      <div className="flex-1 flex flex-col items-center justify-center">
        <CircularScore score={score} grade={grade} />
      </div>

      {/* Component Breakdown */}
      {compositeScore && (
        <div className="mt-6 pt-4 border-t space-y-2" style={{ borderColor: '#e0dbd0' }}>
          <ComponentBar
            label={compositeScore.components.networkDesign.label}
            score={compositeScore.components.networkDesign.score}
            weight={compositeScore.components.networkDesign.weight}
          />
          <ComponentBar
            label={compositeScore.components.environmentalComfort.label}
            score={compositeScore.components.environmentalComfort.score}
            weight={compositeScore.components.environmentalComfort.weight}
          />
          <ComponentBar
            label={compositeScore.components.safety.label}
            score={compositeScore.components.safety.score}
            weight={compositeScore.components.safety.weight}
          />
          <ComponentBar
            label={compositeScore.components.densityContext.label}
            score={compositeScore.components.densityContext.score}
            weight={compositeScore.components.densityContext.weight}
          />
          {compositeScore.confidence < 80 && (
            <div className="text-[10px] text-center mt-1" style={{ color: '#9ca3af' }}>
              Confidence: {compositeScore.confidence}% — loading more data...
            </div>
          )}
        </div>
      )}

      {/* Walker Visualization */}
      <div className="mt-6 pt-6 border-t" style={{ borderColor: '#e0dbd0' }}>
        <p className="text-xs text-center mb-3" style={{ color: '#8a9a8a' }}>
          Out of 10 walkers, how many feel safe?
        </p>

        <div className="flex items-center justify-center gap-2 mb-2">
          {Array.from({ length: filledWalkers }).map((_, i) => (
            <div
              key={`filled-${i}`}
              className="text-2xl sm:text-3xl transition-transform hover:scale-110"
              style={{ color: getWalkerColor(score) }}
            >
              🚶
            </div>
          ))}
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

      {/* Crash Data */}
      {crashLoading && (
        <div className="mt-4 pt-4 border-t animate-pulse" style={{ borderColor: '#e0dbd0' }}>
          <div className="h-3 w-48 rounded bg-gray-200" />
        </div>
      )}
      {!crashLoading && crashData && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: '#e0dbd0' }}>
          <CrashSummary data={crashData} />
        </div>
      )}
    </div>
  );
}
