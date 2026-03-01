import { useState } from 'react';
import type { WalkabilityMetrics, WalkabilityScoreV2, DemographicData, OSMData, CrashData, NeighborhoodIntelligence } from '../../types';
import EconomicContextSection from './EconomicContextSection';
import EquityContextSection from './EquityContextSection';
import NeighborhoodIntelSection from './NeighborhoodIntelSection';
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
  neighborhoodIntel?: NeighborhoodIntelligence | null;
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

function getInsight(key: string, score: number): string {
  if (score <= 0) return '';
  switch (key) {
    case 'streetGrid':
      return score >= 8 ? 'Well-connected streets, easy to navigate'
        : score >= 6 ? 'Good street network with some dead ends'
        : score >= 4 ? 'Some connectivity gaps'
        : 'Limited route options, many dead ends';
    case 'slope':
      return score >= 8 ? 'Mostly flat, easy walking'
        : score >= 6 ? 'Gentle slopes, manageable terrain'
        : score >= 4 ? 'Hilly in spots — plan your routes'
        : 'Steep terrain, challenging on foot';
    case 'treeCanopy':
      return score >= 8 ? 'Lush canopy, shaded walks'
        : score >= 6 ? 'Good shade coverage'
        : score >= 4 ? 'Some shade, but exposed stretches'
        : 'Minimal shade — hot in summer';
    case 'crashHistory':
      return score >= 8 ? 'Very few recorded incidents'
        : score >= 6 ? 'Below-average crash rate'
        : score >= 4 ? 'Moderate crash history nearby'
        : 'Elevated pedestrian safety concern';
    case 'destinations':
      return score >= 8 ? 'Shops, dining, services within walking distance'
        : score >= 6 ? 'Most daily needs accessible on foot'
        : score >= 4 ? 'Some amenities nearby, car helpful'
        : 'Few walkable destinations';
    case 'populationDensity':
      return score >= 8 ? 'Urban density supports walkable services'
        : score >= 6 ? 'Moderate density, mixed use'
        : score >= 4 ? 'Suburban density'
        : 'Low density, spread-out area';
    default:
      return '';
  }
}

// --- Metric detail content ---

interface MetricDetail {
  what: string;
  how: string;
  source: string;
  getMeans: (score: number) => string;
}

const METRIC_DETAILS: Record<string, MetricDetail> = {
  streetGrid: {
    what: 'How well-connected the street network is — intersection density, block lengths, and dead-end ratio.',
    how: '4 sub-metrics from OpenStreetMap: intersection density (30%), average block length (30%), street network density (20%), and dead-end ratio (20%). Analyzed within 800m.',
    source: 'OpenStreetMap street topology',
    getMeans: (s) =>
      s >= 8 ? 'Excellent grid — short blocks, many intersections, and very few dead-ends. Walking routes are direct and efficient.'
      : s >= 6 ? 'Good connectivity with some dead-ends. Most trips can take a fairly direct walking route.'
      : s >= 4 ? 'Mixed connectivity — some areas are well-connected but others have limited route options.'
      : 'Many dead-ends and long blocks. Walking routes are often indirect, making trips longer than they need to be.',
  },
  slope: {
    what: 'Average terrain slope around this location, measured from satellite elevation data.',
    how: 'Elevation sampled from NASA\'s 30-meter digital elevation model at 5 points. Slope calculated in degrees.',
    source: 'NASADEM via Microsoft Planetary Computer',
    getMeans: (s) =>
      s >= 8 ? 'Flat terrain — comfortable walking for all ages and abilities, including wheelchair users.'
      : s >= 6 ? 'Gentle slopes that most people can handle comfortably. Not a barrier to walking.'
      : s >= 4 ? 'Noticeable hills that may slow walkers and make some trips harder, especially for elderly or disabled residents.'
      : 'Steep terrain that significantly limits walkability. Many residents may avoid walking due to difficulty.',
  },
  treeCanopy: {
    what: 'Vegetation and tree cover measured directly from satellite imagery using NDVI (vegetation index).',
    how: 'Sentinel-2 satellite captures near-infrared and red light. NDVI formula identifies healthy vegetation. Sampled at 10m resolution across an 800m area, using the clearest image from the past year.',
    source: 'Sentinel-2 L2A satellite imagery',
    getMeans: (s) =>
      s >= 8 ? 'Dense tree canopy providing excellent shade. Walking is comfortable even in hot weather.'
      : s >= 6 ? 'Good vegetation coverage. Most walking routes have some shade.'
      : s >= 4 ? 'Moderate coverage with gaps. Some stretches are exposed to sun and heat.'
      : 'Very little tree cover. Walking is uncomfortable in warm weather — heat exposure is a concern.',
  },
  crashHistory: {
    what: 'Pedestrian and traffic crash records near this location.',
    how: 'US: NHTSA fatality data (2018-2022) filtered within 800m radius. International: WHO country-level road fatality rate per 100,000 population.',
    source: 'NHTSA FARS (US) / WHO Global Status Report',
    getMeans: (s) =>
      s >= 8 ? 'Very few crashes recorded nearby. This area has a strong safety record for pedestrians.'
      : s >= 6 ? 'Below-average crash rate. Generally safe, but stay alert at major intersections.'
      : s >= 4 ? 'Moderate crash history. Exercise caution, especially at busy roads and intersections.'
      : 'Elevated crash rate — pedestrian safety is a real concern here. Be especially careful crossing streets.',
  },
  destinations: {
    what: 'Variety and density of daily needs within walking distance — shops, schools, healthcare, restaurants, parks, and transit.',
    how: '6 categories scored by how many exist nearby (density) and how close the nearest one is (proximity). Having 3+ options within 400m scores highest.',
    source: 'OpenStreetMap amenities, 1.2km radius',
    getMeans: (s) =>
      s >= 8 ? 'Excellent access — most daily needs are a short walk away. This is a self-sufficient walkable neighborhood.'
      : s >= 6 ? 'Good access to most services. Some categories may require a slightly longer walk.'
      : s >= 4 ? 'Partial access — some daily needs require a car or long walk. Not fully self-sufficient on foot.'
      : 'Very few destinations within walking distance. Most errands require driving.',
  },
  populationDensity: {
    what: 'How many people live in this area, measured from satellite-derived population data at 100m resolution.',
    how: 'GHS-POP grid data averaged over a 500m area. Higher density neighborhoods tend to support more walkable services and transit.',
    source: 'Global Human Settlement Population (European Commission)',
    getMeans: (s) =>
      s >= 8 ? 'High density — enough people to support frequent transit, diverse shops, and walkable services.'
      : s >= 6 ? 'Moderate density with mixed land use. Some walkable services, but not all needs met on foot.'
      : s >= 4 ? 'Suburban density — services are more spread out and may require driving for some trips.'
      : 'Low density, spread-out area. Most services require a car to reach.',
  },
};

// --- Components ---

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

function MetricCardSimple({ def, score, isLoading, isExpanded, onClick }: {
  def: MetricDef;
  score: number;
  isLoading: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const color = getScoreColor(score);
  const displayScore = score > 0 ? score.toFixed(1) : '—';
  const insight = getInsight(def.key, score);

  return (
    <div
      className="rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md"
      style={{
        borderColor: isExpanded ? color : '#e0dbd0',
        backgroundColor: 'white',
        borderWidth: isExpanded ? '2px' : '1px',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse flex items-center gap-2">
            <span className="text-xl">{def.icon}</span>
            <span className="text-sm" style={{ color: '#8a9a8a' }}>Loading {def.name}...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{def.icon}</span>
              <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{def.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold" style={{ color }}>{displayScore}</span>
              <svg
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{ color: '#b0a8a0', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#f0ebe0' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(score * 10, 2)}%`, backgroundColor: color }}
            />
          </div>
          {insight && (
            <div className="text-xs leading-snug" style={{ color: '#6a7a6a' }}>
              {insight}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricDetailPanel({ metricKey, score, icon, name }: {
  metricKey: string;
  score: number;
  icon: string;
  name: string;
}) {
  const detail = METRIC_DETAILS[metricKey];
  if (!detail) return null;
  const color = getScoreColor(score);

  return (
    <div
      className="rounded-xl border p-5 animate-in fade-in duration-200"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: '#f0ebe0' }}>
        <span className="text-xl">{icon}</span>
        <span className="text-base font-bold" style={{ color: '#2a3a2a' }}>{name}</span>
        <span className="text-base font-bold ml-auto" style={{ color }}>{score.toFixed(1)}/10</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#8a9a8a' }}>
            What this measures
          </div>
          <div className="text-sm leading-relaxed" style={{ color: '#3a4a3a' }}>
            {detail.what}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#8a9a8a' }}>
            How it's scored
          </div>
          <div className="text-sm leading-relaxed" style={{ color: '#3a4a3a' }}>
            {detail.how}
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ backgroundColor: '#f8f6f1' }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color }}>
            What your {score.toFixed(1)} means
          </div>
          <div className="text-sm leading-relaxed" style={{ color: '#3a4a3a' }}>
            {detail.getMeans(score)}
          </div>
        </div>

        <div className="text-xs pt-2 border-t" style={{ color: '#b0a8a0', borderColor: '#f0ebe0' }}>
          Source: {detail.source}
        </div>
      </div>
    </div>
  );
}

export default function MetricGrid({ metrics, satelliteLoaded, compositeScore, demographicData, demographicLoading, osmData, crashData, neighborhoodIntel }: MetricGridProps) {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  const toggleMetric = (key: string) => {
    setExpandedMetric(prev => prev === key ? null : key);
  };

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
            <MetricCardSimple
              key={def.key}
              def={def}
              score={score}
              isLoading={isLoading}
              isExpanded={expandedMetric === def.key}
              onClick={() => toggleMetric(def.key)}
            />
          );
        })}
      </div>

      {/* Expanded detail panel — appears below the grid */}
      {expandedMetric && (() => {
        const def = METRICS.find(m => m.key === expandedMetric);
        if (!def) return null;
        const score = def.getScore(metrics, compositeScore);
        return (
          <div className="mt-4">
            <MetricDetailPanel
              metricKey={def.key}
              score={score}
              icon={def.icon}
              name={def.name}
            />
          </div>
        );
      })()}

      {/* Neighborhood Intelligence */}
      <NeighborhoodIntelSection neighborhoodIntel={neighborhoodIntel ?? null} />

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
