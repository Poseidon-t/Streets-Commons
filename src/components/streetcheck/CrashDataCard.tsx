import { useState } from 'react';
import type { CrashData, LocalCrashData, CountryCrashData } from '../../types';

interface CrashDataCardProps {
  crashData: CrashData | null;
  isLoading?: boolean;
}

const WHO_GLOBAL_AVG = 15.0;
const WHO_BEST = { country: 'Norway', rate: 1.5 };

function LocalCrashView({ data }: { data: LocalCrashData }) {
  const [expanded, setExpanded] = useState(false);

  const maxCrashesInYear = Math.max(...data.yearlyBreakdown.map(y => y.crashes), 1);

  return (
    <>
      {/* Main stat */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold" style={{ color: '#dc2626' }}>
          {data.totalFatalities}
        </span>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          {data.totalFatalities === 1 ? 'death' : 'deaths'} in
        </span>
        <span className="text-lg font-semibold" style={{ color: '#2a3a2a' }}>
          {data.totalCrashes}
        </span>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          fatal {data.totalCrashes === 1 ? 'crash' : 'crashes'} within {data.radiusMeters}m
        </span>
      </div>

      <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
        {data.yearRange.from}–{data.yearRange.to}
      </div>

      {/* Zero crashes message */}
      {data.totalCrashes === 0 && (
        <p className="text-sm mt-2" style={{ color: '#16a34a' }}>
          No fatal crashes recorded within {data.radiusMeters}m during this period.
        </p>
      )}

      {/* Expand/collapse for details */}
      {data.totalCrashes > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs mt-2 underline cursor-pointer hover:no-underline"
          style={{ color: '#6b7280' }}
        >
          {expanded ? 'Hide details' : 'Show yearly breakdown'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* Yearly mini-bars */}
          <div className="flex items-end gap-1 h-12">
            {data.yearlyBreakdown.map(y => (
              <div key={y.year} className="flex flex-col items-center flex-1">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max((y.crashes / maxCrashesInYear) * 100, y.crashes > 0 ? 15 : 0)}%`,
                    backgroundColor: y.crashes > 0 ? '#fca5a5' : '#e5e7eb',
                    minHeight: y.crashes > 0 ? '4px' : '2px',
                  }}
                />
                <span className="text-[10px] mt-1" style={{ color: '#9ca3af' }}>{y.year}</span>
              </div>
            ))}
          </div>

          {/* Yearly numbers */}
          <div className="flex gap-1">
            {data.yearlyBreakdown.map(y => (
              <div key={y.year} className="flex-1 text-center">
                <span className="text-[10px] font-medium" style={{ color: y.crashes > 0 ? '#dc2626' : '#9ca3af' }}>
                  {y.crashes > 0 ? `${y.fatalities}` : '0'}
                </span>
              </div>
            ))}
          </div>

          {/* Nearest crash */}
          {data.nearestCrash && (
            <div className="text-xs pt-2 border-t" style={{ borderColor: '#fecaca', color: '#6b7280' }}>
              Nearest fatal crash: <strong>{data.nearestCrash.distance}m</strong> away
              on <strong>{data.nearestCrash.road}</strong> ({data.nearestCrash.year},{' '}
              {data.nearestCrash.fatalities} {data.nearestCrash.fatalities === 1 ? 'fatality' : 'fatalities'})
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CountryCrashView({ data }: { data: CountryCrashData }) {
  const isAboveAvg = data.deathRatePer100k > WHO_GLOBAL_AVG;
  const ratio = (data.deathRatePer100k / WHO_GLOBAL_AVG) * 100;

  return (
    <>
      {/* Country name */}
      <div className="text-sm font-medium mb-1" style={{ color: '#2a3a2a' }}>
        {data.countryName}
      </div>

      {/* Main stat */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold" style={{ color: isAboveAvg ? '#dc2626' : '#f59e0b' }}>
          {data.deathRatePer100k.toFixed(1)}
        </span>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          deaths per 100,000 people ({data.year})
        </span>
      </div>

      {/* Comparison bar */}
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[10px]" style={{ color: '#9ca3af' }}>
          <span>{WHO_BEST.country} ({WHO_BEST.rate})</span>
          <span>Global avg ({WHO_GLOBAL_AVG})</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
          {/* Global average marker */}
          <div
            className="absolute top-0 h-full w-0.5"
            style={{
              left: `${Math.min((WHO_GLOBAL_AVG / 40) * 100, 100)}%`,
              backgroundColor: '#9ca3af',
            }}
          />
          {/* Country bar */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((data.deathRatePer100k / 40) * 100, 100)}%`,
              backgroundColor: isAboveAvg ? '#fca5a5' : '#fde68a',
            }}
          />
        </div>
        <div className="text-xs" style={{ color: isAboveAvg ? '#dc2626' : '#16a34a' }}>
          {isAboveAvg
            ? `${Math.round(ratio - 100)}% above global average`
            : `${Math.round(100 - ratio)}% below global average`}
        </div>
      </div>
    </>
  );
}

function LoadingShimmer() {
  return (
    <div className="rounded-xl p-4 border animate-pulse" style={{ backgroundColor: '#fff5f5', borderColor: '#fecaca' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded bg-red-200" />
        <div className="h-4 w-48 rounded bg-red-200" />
      </div>
      <div className="h-8 w-32 rounded bg-red-100 mb-2" />
      <div className="h-3 w-56 rounded bg-red-100" />
    </div>
  );
}

export default function CrashDataCard({ crashData, isLoading }: CrashDataCardProps) {
  if (isLoading) return <LoadingShimmer />;
  if (!crashData) return null;

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: '#fff5f5', borderColor: '#fecaca' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-sm font-semibold" style={{ color: '#991b1b' }}>
          {crashData.type === 'local' ? 'Traffic Fatalities Nearby' : 'Road Traffic Deaths'}
        </h3>
      </div>

      {/* Content */}
      {crashData.type === 'local'
        ? <LocalCrashView data={crashData} />
        : <CountryCrashView data={crashData} />}

      {/* Source */}
      <div className="mt-3 pt-2 border-t text-[10px]" style={{ borderColor: '#fecaca', color: '#9ca3af' }}>
        Source: {crashData.dataSource}
        {crashData.type === 'local' && ' · Fatal crashes only · US locations'}
        {crashData.type === 'country' && ' · Country-level estimate'}
      </div>
    </div>
  );
}
