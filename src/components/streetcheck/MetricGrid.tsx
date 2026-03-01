import type { WalkabilityMetrics, WalkabilityScoreV2, DemographicData, OSMData, CrashData } from '../../types';
import EconomicContextSection from './EconomicContextSection';
import EquityContextSection from './EquityContextSection';
import { analyzeLocalEconomy } from '../../utils/localEconomicAnalysis';

interface MetricGridProps {
  metrics: WalkabilityMetrics;
  locationName: string;
  satelliteLoaded?: Set<string>;
  compositeScore?: WalkabilityScoreV2 | null;
  demographicData?: DemographicData | null;
  demographicLoading?: boolean;
  osmData?: OSMData | null;
  crashData?: CrashData | null;
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

interface MetricDef {
  key: string;
  name: string;
  icon: string;
  source: string;
  satKey?: string;
  getScore: (metrics: WalkabilityMetrics, compositeScore?: WalkabilityScoreV2 | null) => number;
}

const METRICS: MetricDef[] = [
  {
    key: 'streetGrid',
    name: 'Street Grid',
    icon: '🔀',
    source: 'OpenStreetMap',
    getScore: (_m, cs) => cs ? cs.components.networkDesign.score / 10 : 0,
  },
  {
    key: 'slope',
    name: 'Terrain',
    icon: '⛰️',
    source: 'NASA SRTM',
    satKey: 'slope',
    getScore: (m) => m.slope,
  },
  {
    key: 'treeCanopy',
    name: 'Tree Canopy',
    icon: '🌳',
    source: 'Sentinel-2',
    satKey: 'treeCanopy',
    getScore: (m) => m.treeCanopy,
  },
  {
    key: 'crashHistory',
    name: 'Crash History',
    icon: '🚨',
    source: 'NHTSA / WHO',
    getScore: (_m, cs) => {
      const crashMetric = cs?.components.safety.metrics[0];
      return crashMetric ? crashMetric.score / 10 : 0;
    },
  },
  {
    key: 'destinations',
    name: 'Destinations',
    icon: '🏪',
    source: 'OpenStreetMap',
    getScore: (m) => m.destinationAccess,
  },
  {
    key: 'populationDensity',
    name: 'Population',
    icon: '👥',
    source: 'GHS-POP',
    satKey: 'populationDensity',
    getScore: (_m, cs) => {
      const popMetric = cs?.components.densityContext.metrics.find(m => m.name === 'Population Density');
      return popMetric ? popMetric.score / 10 : 0;
    },
  },
];

function MetricCardSimple({ def, score, isLoading }: { def: MetricDef; score: number; isLoading: boolean }) {
  const color = getScoreColor(score);
  const displayScore = score > 0 ? score.toFixed(1) : '—';

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-pulse flex items-center gap-2">
            <span className="text-xl">{def.icon}</span>
            <span className="text-sm" style={{ color: '#8a9a8a' }}>Loading {def.name}...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{def.icon}</span>
              <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{def.name}</span>
            </div>
            <span className="text-lg font-bold" style={{ color }}>{displayScore}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(score * 10, 2)}%`, backgroundColor: color }}
            />
          </div>
          <div className="mt-2 text-xs" style={{ color: '#8a9a8a' }}>
            {def.source}
          </div>
        </>
      )}
    </div>
  );
}

export default function MetricGrid({ metrics, satelliteLoaded, compositeScore, demographicData, demographicLoading, osmData, crashData }: MetricGridProps) {
  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#2a3a2a' }}>
        What This Means For You
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {METRICS.map(def => {
          const score = def.getScore(metrics, compositeScore);
          const isLoading = def.satKey && satelliteLoaded ? !satelliteLoaded.has(def.satKey) : false;
          return (
            <MetricCardSimple key={def.key} def={def} score={score} isLoading={isLoading} />
          );
        })}
      </div>

      {/* Equity Context */}
      {demographicData && (
        <div className="mt-8">
          <EquityContextSection
            demographicData={demographicData}
            metrics={metrics}
            crashData={crashData ?? null}
            compositeScore={compositeScore ?? null}
            localEconomy={osmData ? analyzeLocalEconomy(osmData) : null}
          />
        </div>
      )}

      {/* Local Economy */}
      {osmData && (
        <div className="mt-8">
          <EconomicContextSection
            osmData={osmData}
            demographicData={demographicData ?? null}
            demographicLoading={demographicLoading ?? false}
          />
        </div>
      )}
    </div>
  );
}
