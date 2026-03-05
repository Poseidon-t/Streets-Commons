import { useState } from 'react';
import type { WalkabilityMetrics, WalkabilityScoreV2, DemographicData, OSMData, NeighborhoodIntelligence } from '../../types';
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
  streetDesignScore?: number;
  neighborhoodIntel?: NeighborhoodIntelligence | null;
  countryCode?: string;
  mapillaryCoverageGap?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

function getCardBackground(score: number): string {
  if (score >= 7.5) return 'rgba(34,197,94,0.05)';
  if (score <= 3.0 && score > 0) return 'rgba(239,68,68,0.05)';
  return 'white';
}

function getCardBorderColor(score: number, isExpanded: boolean, expandedColor: string): string {
  if (isExpanded) return expandedColor;
  if (score >= 7.5) return 'rgba(34,197,94,0.25)';
  if (score <= 3.0 && score > 0) return 'rgba(239,68,68,0.25)';
  return '#e0dbd0';
}

function getInsight(key: string, score: number): string {
  if (score <= 0) return '';
  switch (key) {
    case 'streetGrid':
      return score >= 8 ? 'Well-connected streets, easy to navigate'
        : score >= 6 ? 'Good street network with some dead ends'
        : score >= 4 ? 'Some connectivity gaps'
        : 'Limited route options, many dead ends';
    case 'treeCanopy':
      return score >= 8 ? 'Lush canopy, shaded walks'
        : score >= 6 ? 'Good shade coverage'
        : score >= 4 ? 'Some shade, but exposed stretches'
        : 'Minimal shade — hot in summer';
    case 'streetDesign':
      return score >= 8 ? 'Connected grid, designed for walking'
        : score >= 6 ? 'Good street connectivity and access'
        : score >= 4 ? 'Mixed connectivity, some car-oriented design'
        : 'Car-dependent street layout';
    case 'destinations':
      return score >= 8 ? 'Shops, dining, services within walking distance'
        : score >= 6 ? 'Most daily needs accessible on foot'
        : score >= 4 ? 'Some amenities nearby, car helpful'
        : 'Few walkable destinations';
    case 'populationDensity':
      return score >= 8 ? 'Most residents walk, bike, or take transit'
        : score >= 6 ? 'Good share of car-free commuters'
        : score >= 4 ? 'Some alternative commuters'
        : 'Mostly car-dependent area';
    case 'transitAccess':
      return score >= 8 ? 'Excellent transit — multiple modes nearby'
        : score >= 6 ? 'Good transit coverage within walking distance'
        : score >= 4 ? 'Limited transit — infrequent or few routes'
        : 'Very little transit access';
    case 'terrain':
      return score >= 9 ? 'Flat — easy walking in any direction'
        : score >= 7 ? 'Gently rolling — minor hills only'
        : score >= 5 ? 'Moderate hills — some inclines'
        : score >= 3 ? 'Hilly — significant elevation changes'
        : 'Steep terrain — elevation limits walkable routes';
    case 'speedEnvironment':
      return score >= 9 ? 'Very low-speed streets — safe walking pace'
        : score >= 7 ? 'Calm 30 km/h network — low pedestrian risk'
        : score >= 5 ? 'Mixed speeds — some faster arterials'
        : score >= 3 ? 'Faster roads — 50–60 km/h arterials dominant'
        : 'High-speed network — hostile walking conditions';
    case 'streetLighting':
      return score >= 9 ? 'Well-lit network — safe after dark'
        : score >= 7 ? 'Good lighting on most routes'
        : score >= 5 ? 'Moderate lighting — some gaps at night'
        : score >= 3 ? 'Sparse lighting — limited after-dark safety'
        : 'Very low lighting density detected';
    case 'airQuality':
      return score >= 9 ? 'Clean air — meets WHO 2021 guidelines'
        : score >= 7 ? 'Good air quality — minor pollution'
        : score >= 5 ? 'Moderate pollution — sensitive groups should take care'
        : score >= 3 ? 'Elevated pollution — regular walkers at risk'
        : 'High pollution — air quality is a significant health concern';
    case 'noise':
      return score >= 9 ? 'Very quiet streets — pedestrian or residential only'
        : score >= 7 ? 'Calm neighbourhood — mostly residential roads'
        : score >= 5 ? 'Moderate noise — some busier roads mixed in'
        : score >= 3 ? 'Noisy arterials — significant traffic noise'
        : 'High noise environment — major roads dominate';
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
  streetDesign: {
    what: 'How well the street network is designed for walking, based on intersection density, transit proximity, and land use mix.',
    how: 'EPA National Walkability Index at the census block-group level. Combines street intersection density (50%), transit proximity (30%), and land use diversity (20%). Ranked nationally on a 1-20 scale.',
    source: 'EPA National Walkability Index',
    getMeans: (s) =>
      s >= 8 ? 'Excellent pedestrian-oriented design with dense intersections, nearby transit, and mixed land uses. Streets are built for people, not just cars.'
      : s >= 6 ? 'Good street design with reasonable connectivity and transit access. Most daily trips can be done on foot.'
      : s >= 4 ? 'Mixed design with some walkable elements but also car-oriented stretches. Transit access may be limited.'
      : 'Car-dependent street layout with low intersection density, distant transit, and separated land uses. Walking is impractical for most trips.',
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
    what: 'What share of residents commute by walking, biking, or public transit instead of driving.',
    how: 'Census ACS 5-year estimates for the census tract. Walk, bike, and transit commuter percentages combined into an alternative mode share.',
    source: 'US Census Bureau American Community Survey 2022',
    getMeans: (s) =>
      s >= 8 ? 'Strong car-optional neighborhood. Most residents can and do commute without a car.'
      : s >= 6 ? 'Good share of alternative commuters. Walking, biking, and transit are viable options here.'
      : s >= 4 ? 'Some residents use alternatives to driving, but the car remains dominant for most trips.'
      : 'Mostly car-dependent. Very few residents walk, bike, or take transit to work.',
  },
  transitAccess: {
    what: 'Number and variety of transit stops — buses, trains, trams, subways — within walking distance.',
    how: 'Counts GTFS-verified stops from Transitland within 800m. Rail/subway stations score higher than bus stops. Falls back to OpenStreetMap if Transitland is unavailable.',
    source: 'Transitland (GTFS)',
    getMeans: (s) =>
      s >= 8 ? 'Excellent transit access — multiple modes within easy walking distance. A car is completely optional for most trips.'
      : s >= 6 ? 'Good transit coverage. Regular bus or rail service is nearby and usable for most errands.'
      : s >= 4 ? 'Some transit exists but service may be infrequent or routes limited. A car still helps for many trips.'
      : 'Very limited transit. Few or no stops within walking distance — car ownership is almost necessary.',
  },
  terrain: {
    what: 'How flat or hilly the surrounding area is — steeper terrain makes walking harder and less likely.',
    how: 'Samples a 3×3 grid of elevation points (~300m spacing) using OpenTopoData SRTM global data. Calculates elevation standard deviation across the sample area — higher variance means more hills.',
    source: 'OpenTopoData SRTM 90m',
    getMeans: (s) =>
      s >= 9 ? 'Extremely flat — almost no elevation change. Walking in any direction is equally easy.'
      : s >= 7 ? 'Gently rolling terrain. Minor hills exist but won\'t discourage most walkers.'
      : s >= 5 ? 'Moderate variation in elevation. Some routes will involve noticeable inclines.'
      : s >= 3 ? 'Hilly area — significant elevation changes that can make walking tiring, especially in heat or with mobility limitations.'
      : 'Very steep terrain. Elevation change is a real barrier to walking and likely limits walkable routes to downhill segments.',
  },
  streetLighting: {
    what: 'Density of street lights detected within walking distance — more lights mean safer, more accessible streets after dark.',
    how: 'Counts street light objects detected by Mapillary\'s computer vision models across street-level photos in the 800m radius. Normalized by area (lights per km²). Requires Mapillary image coverage — areas without street-level photos show no data.',
    source: 'Mapillary (computer vision)',
    getMeans: (s) =>
      s >= 9 ? 'Excellent lighting — dense street light network. Walking after dark is well-supported across the area.'
      : s >= 7 ? 'Good street lighting. Most routes have adequate light coverage for safe evening walking.'
      : s >= 5 ? 'Moderate lighting. Main streets are lit but some residential routes may feel dark at night.'
      : s >= 3 ? 'Sparse street lights. After-dark walking requires more care — many streets lack consistent lighting.'
      : 'Very few or no street lights detected. This is a significant barrier for evening and night-time walking, particularly for women and older adults.',
  },
  speedEnvironment: {
    what: 'How fast vehicles typically move through the street network — lower speeds mean safer, more comfortable walking conditions.',
    how: 'Reads posted speed limits (OSM maxspeed tags) for every street in the 800m radius. Where tags are missing, speeds are inferred from road type (residential = 30 km/h, primary = 60 km/h, living street = 10 km/h, etc.). Calculates a length-weighted average across the whole network.',
    source: 'OpenStreetMap (maxspeed tags)',
    getMeans: (s) =>
      s >= 9 ? 'Very low-speed network — mostly living streets and pedestrian zones. Vehicles and people share space safely at walking pace.'
      : s >= 7 ? 'Calm streets. Most roads are 30 km/h or below — the threshold proven to dramatically reduce pedestrian fatality risk.'
      : s >= 5 ? 'Mixed speed environment. Residential streets exist alongside faster arterials. Walking is manageable but requires care on some routes.'
      : s >= 3 ? 'Faster street network. Arterials at 50–60 km/h dominate. Crossing roads feels more dangerous and crossings may be far apart.'
      : 'High-speed network. Roads moving at 60+ km/h create a hostile walking environment and significantly increase injury risk when crossings occur.',
  },
  airQuality: {
    what: 'Concentration of fine particulate matter (PM2.5) in the air — the primary outdoor air pollutant affecting health during walks.',
    how: 'Queries the nearest monitoring station within 25km via OpenAQ, which aggregates data from 15,000+ government stations worldwide. PM2.5 is scored against WHO 2021 air quality guidelines (annual mean target: 5 µg/m³).',
    source: 'OpenAQ (live monitoring stations)',
    getMeans: (s) =>
      s >= 9 ? 'Excellent air quality — PM2.5 meets or beats the strictest WHO 2021 annual guideline (5 µg/m³). Breathing during walks presents no elevated risk.'
      : s >= 7 ? 'Good air quality — PM2.5 is low. Occasional brief exceedances may occur, but long-term walking risk is minimal.'
      : s >= 5 ? 'Moderate air quality — PM2.5 is above WHO guidelines. Sensitive individuals (asthma, heart conditions) should consider shorter or early-morning walks.'
      : s >= 3 ? 'Elevated pollution — regular outdoor activity carries a meaningful health risk. Walkers should check daily AQI before going out.'
      : 'High pollution — PM2.5 levels create real health risk for regular walkers. This is a significant walkability barrier, particularly for children and older adults.',
  },
  noise: {
    what: 'Estimated road traffic noise exposure based on the types and speeds of roads in the area — noise is the second-largest urban health risk after air pollution.',
    how: 'Uses WHO road noise models calibrated to road type (motorway ≈76 dB, primary ≈69 dB, residential ≈54 dB, living street ≈44 dB). Computes a length-weighted average dB level across all streets in the 800m radius. No external API — derived from existing OpenStreetMap road data.',
    source: 'OpenStreetMap (road type × WHO noise model)',
    getMeans: (s) =>
      s >= 9 ? 'Very quiet streets — mostly pedestrian zones and living streets below 45 dB. Well within WHO guidelines for noise-sensitive areas.'
      : s >= 7 ? 'Calm neighbourhood — predominantly residential roads around 50–54 dB. Most people find this comfortable for walking and relaxing outdoors.'
      : s >= 5 ? 'Moderate noise — tertiary roads and some busier streets bring levels to 57–61 dB. Above WHO\'s recommended 53 dB daytime target, but typical for urban neighbourhoods.'
      : s >= 3 ? 'Noisy arterials — secondary and primary roads dominate, creating 62–65 dB exposure. Research links this level to cardiovascular effects from chronic exposure.'
      : 'High noise environment — major roads or expressways create 65+ dB exposure. At this level, outdoor walking near busy roads carries real long-term health implications.',
  },
};

// --- Components ---

interface MetricDef {
  key: string;
  name: string;
  icon: string;
  source: string;
  satKey?: string;
  usOnly?: boolean;
  internationalOnly?: boolean;
  group: 'network' | 'environment' | 'safety' | 'density';
  getScore: (metrics: WalkabilityMetrics, compositeScore?: WalkabilityScoreV2 | null) => number;
}

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  network:     { label: 'Street Network',      icon: '🔀' },
  environment: { label: 'Environment',          icon: '🌿' },
  safety:      { label: 'Safety & Design',      icon: '🛡️' },
  density:     { label: 'Access & Density',     icon: '🏙️' },
};

const METRICS: MetricDef[] = [
  {
    key: 'streetGrid',
    name: 'Street Grid',
    icon: '🔀',
    source: 'OpenStreetMap',
    internationalOnly: true,
    group: 'network',
    getScore: (_m, cs) => cs ? cs.components.networkDesign.score / 10 : 0,
  },
  {
    key: 'speedEnvironment',
    name: 'Speed Environment',
    icon: '🚗',
    source: 'OpenStreetMap',
    group: 'network',
    getScore: (_m, cs) => {
      const m = cs?.components.networkDesign.metrics.find(m => m.name === 'Speed Environment');
      return m ? m.score / 10 : 0;
    },
  },
  {
    key: 'treeCanopy',
    name: 'Tree Canopy',
    icon: '🌳',
    source: 'Sentinel-2',
    satKey: 'treeCanopy',
    group: 'environment',
    getScore: (m) => m.treeCanopy,
  },
  {
    key: 'terrain',
    name: 'Terrain',
    icon: '⛰️',
    source: 'OpenTopoData SRTM',
    satKey: 'terrain',
    group: 'environment',
    getScore: (_m, cs) => {
      const m = cs?.components.environmentalComfort.metrics.find(m => m.name === 'Terrain');
      return m ? m.score / 10 : 0;
    },
  },
  {
    key: 'streetLighting',
    name: 'Street Lighting',
    icon: '💡',
    source: 'Mapillary (computer vision)',
    satKey: 'streetLighting',
    group: 'environment',
    getScore: (_m, cs) => {
      const m = cs?.components.environmentalComfort.metrics.find(m => m.name === 'Street Lighting');
      return m ? m.score / 10 : 0;
    },
  },
  {
    key: 'airQuality',
    name: 'Air Quality',
    icon: '🌬️',
    source: 'OpenAQ',
    satKey: 'airQuality',
    group: 'environment',
    getScore: (_m, cs) => {
      const m = cs?.components.environmentalComfort.metrics.find(m => m.name === 'Air Quality');
      return m ? m.score / 10 : 0;
    },
  },
  {
    key: 'noise',
    name: 'Noise',
    icon: '🔊',
    source: 'OSM road model',
    group: 'environment',
    getScore: (_m, cs) => {
      const m = cs?.components.environmentalComfort.metrics.find(m => m.name === 'Noise');
      return m ? m.score / 10 : 0;
    },
  },
  {
    key: 'streetDesign',
    name: 'Street Design',
    icon: '🛣️',
    source: 'EPA',
    satKey: 'streetDesign',
    usOnly: true,
    group: 'safety',
    getScore: (_m, cs) => {
      const sdMetric = cs?.components.safety.metrics[0];
      return sdMetric ? sdMetric.score / 10 : 0;
    },
  },
  {
    key: 'destinations',
    name: 'Destinations',
    icon: '🏪',
    source: 'OpenStreetMap',
    group: 'density',
    getScore: (m) => m.destinationAccess,
  },
  {
    key: 'populationDensity',
    name: 'Commute Mode',
    icon: '🚶',
    source: 'Census ACS',
    satKey: 'populationDensity',
    usOnly: true,
    group: 'density',
    getScore: (_m, cs) => {
      const popMetric = cs?.components.densityContext.metrics.find(m => m.name === 'Commute Mode');
      if (popMetric) return popMetric.score / 10;
      const legacy = cs?.components.densityContext.metrics.find(m => m.name === 'Population Density');
      return legacy ? legacy.score / 10 : 0;
    },
  },
  {
    key: 'transitAccess',
    name: 'Transit Access',
    icon: '🚌',
    source: 'Transitland (GTFS)',
    satKey: 'transit',
    group: 'density',
    getScore: (_m, cs) => {
      const m = cs?.components.densityContext.metrics.find(m => m.name === 'Transit Access');
      return m ? m.score / 10 : 0;
    },
  },
];

function MetricCardSimple({ def, score, isLoading, isExpanded, noCoverage, onClick }: {
  def: MetricDef;
  score: number;
  isLoading: boolean;
  isExpanded: boolean;
  noCoverage?: boolean;
  onClick: () => void;
}) {
  const color = getScoreColor(score);
  const displayScore = score > 0 ? score.toFixed(1) : '—';
  const detail = METRIC_DETAILS[def.key];
  const contextText = detail && score > 0 ? detail.getMeans(score) : getInsight(def.key, score);
  const bg = noCoverage ? 'white' : getCardBackground(score);
  const borderColor = getCardBorderColor(score, isExpanded, color);

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        borderColor,
        backgroundColor: bg,
        borderWidth: isExpanded ? '2px' : '1px',
      }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse flex items-center gap-2">
            <span className="text-xl">{def.icon}</span>
            <span className="text-sm" style={{ color: '#8a9a8a' }}>Loading {def.name}...</span>
          </div>
        </div>
      ) : noCoverage ? (
        <div className="flex flex-col gap-1.5 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{def.icon}</span>
            <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{def.name}</span>
          </div>
          <p className="text-xs" style={{ color: '#8a9a8a' }}>No street-level imagery available for this area. Mapillary coverage is needed to detect street lights.</p>
          <span className="text-xs" style={{ color: '#b0a8a0' }}>{def.source}</span>
        </div>
      ) : (
        <>
          {/* Header row: icon + name + score */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{def.icon}</span>
              <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{def.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tabular-nums" style={{ color }}>{displayScore}</span>
              <span className="text-xs font-normal" style={{ color: '#b0a8a0' }}>/10</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: '#ede8dd' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(score * 10, 2)}%`, backgroundColor: color }}
            />
          </div>

          {/* Inline context — always visible, no click required */}
          {contextText && (
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#4a5a4a' }}>
              {contextText}
            </p>
          )}

          {/* Data source + expand toggle for methodology */}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#f0ebe0' }}>
            <span className="text-xs" style={{ color: '#b0a8a0' }}>{detail?.source ?? def.source}</span>
            <button
              className="text-xs underline cursor-pointer"
              style={{ color: '#8a9a8a' }}
              onClick={onClick}
            >
              {isExpanded ? 'Less' : 'How it\'s scored'}
            </button>
          </div>
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

export default function MetricGrid({ metrics, satelliteLoaded, compositeScore, demographicData, demographicLoading, osmData, streetDesignScore, neighborhoodIntel, countryCode, mapillaryCoverageGap }: MetricGridProps) {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const isUS = countryCode === 'us';
  const visibleMetrics = METRICS.filter(def =>
    (!def.usOnly || isUS) && (!def.internationalOnly || !isUS)
  );

  const toggleMetric = (key: string) => {
    setExpandedMetric(prev => prev === key ? null : key);
  };

  // Group metrics by component, preserving definition order within each group
  const groups = (['network', 'environment', 'safety', 'density'] as const).map(groupKey => ({
    groupKey,
    defs: visibleMetrics.filter(d => d.group === groupKey),
  })).filter(g => g.defs.length > 0);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>
          Score Breakdown
        </h2>
        <p className="text-sm mt-1" style={{ color: '#8a9a8a' }}>
          Each metric contributes to your walkability score. Green = strength, red = needs attention.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map(({ groupKey, defs }) => {
          const groupMeta = GROUP_LABELS[groupKey];
          return (
            <div key={groupKey}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">{groupMeta.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8a9a8a', letterSpacing: '0.1em' }}>
                  {groupMeta.label}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3d8' }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {defs.map(def => {
                  const score = def.getScore(metrics, compositeScore);
                  const isLoading = def.satKey && satelliteLoaded ? !satelliteLoaded.has(def.satKey) : false;
                  return (
                    <MetricCardSimple
                      key={def.key}
                      def={def}
                      score={score}
                      isLoading={isLoading}
                      isExpanded={expandedMetric === def.key}
                      noCoverage={def.key === 'streetLighting' && mapillaryCoverageGap && satelliteLoaded?.has('streetLighting')}
                      onClick={() => toggleMetric(def.key)}
                    />
                  );
                })}
              </div>

              {/* Expanded detail panel — appears directly below the expanded metric's group */}
              {expandedMetric && defs.some(d => d.key === expandedMetric) && (() => {
                const def = defs.find(m => m.key === expandedMetric);
                if (!def) return null;
                const score = def.getScore(metrics, compositeScore);
                return (
                  <div className="mt-3">
                    <MetricDetailPanel
                      metricKey={def.key}
                      score={score}
                      icon={def.icon}
                      name={def.name}
                    />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Neighborhood Intelligence */}
      <NeighborhoodIntelSection neighborhoodIntel={neighborhoodIntel ?? null} />

      {/* Equity Context */}
      {demographicData && (
        <div className="mt-8">
          <EquityContextSection
            demographicData={demographicData}
            metrics={metrics}
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
