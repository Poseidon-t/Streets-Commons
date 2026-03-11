import { useState } from 'react';
import type { WalkabilityMetrics, WalkabilityScoreV2, DemographicData, OSMData, StreetCharacterAnalysis, StreetNetworkType } from '../../types';
import { scoreColor10 as getScoreColor } from '../../utils/colors';

interface MetricGridProps {
  metrics: WalkabilityMetrics;
  locationName: string;
  satelliteLoaded?: Set<string>;
  compositeScore?: WalkabilityScoreV2 | null;
  demographicData?: DemographicData | null;
  demographicLoading?: boolean;
  osmData?: OSMData | null;
  streetDesignScore?: number;
  countryCode?: string;
  mapillaryCoverageGap?: boolean;
  streetCharacter?: StreetCharacterAnalysis | null;
  streetCharacterLoading?: boolean;
  airQualityReading?: { pm25: number | null; category: string | null } | null;
}

// Sub-metric display for Street Grid card
const SUB_METRIC_LABELS: Record<string, string> = {
  'Intersection Density': 'Grid Connectivity',
  'Block Length': 'Block Scale',
  'Network Density': 'Network Density',
  'Dead-End Ratio': 'Route Directness',
};

const NETWORK_TYPE_STYLE: Record<StreetNetworkType, { bg: string; text: string }> = {
  'Complete Streets':     { bg: '#dcfce7', text: '#15803d' },
  'Well-Connected Grid':  { bg: '#d1fae5', text: '#065f46' },
  'Organic Urban':        { bg: '#dbeafe', text: '#1d4ed8' },
  'Mixed Pattern':        { bg: '#fef9c3', text: '#a16207' },
  'Car-Centric Grid':     { bg: '#ffedd5', text: '#c2410c' },
  'Suburban Sprawl':      { bg: '#fee2e2', text: '#b91c1c' },
  'Disconnected Network': { bg: '#fee2e2', text: '#991b1b' },
};

function subMetricBarColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 55) return '#84cc16';
  if (score >= 35) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function getCardBackground(score: number): string {
  if (score >= 7.5) return 'rgba(26,122,40,0.03)';
  if (score <= 3.0 && score > 0) return 'rgba(184,64,26,0.03)';
  return '#fff';
}

function getCardBorderColor(score: number, isExpanded: boolean, expandedColor: string): string {
  if (isExpanded) return expandedColor;
  if (score >= 7.5) return 'rgba(26,122,40,0.35)';
  if (score <= 3.0 && score > 0) return 'rgba(184,64,26,0.35)';
  return '#d8d0c0';
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
      return score >= 8 ? 'Diverse, active neighbourhood — shops, dining, parks, culture all nearby'
        : score >= 6 ? 'Good variety of daily destinations within walking distance'
        : score >= 4 ? 'Some destinations nearby but limited variety'
        : 'Few destinations — low diversity and density';
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
    what: 'How diverse and active the surrounding neighbourhood is — scored across 8 categories: grocery, dining, health, education, parks, culture, services, and transit.',
    how: 'Shannon entropy across 8 POI categories within 1.2km. A perfectly diverse neighbourhood (equal spread across all categories) scores highest. Density and evening economy (dining + culture share) also contribute. Monocultures — all restaurants, or all shops — score lower even with high counts.',
    source: 'OpenStreetMap amenities, 1.2km radius',
    getMeans: (s) =>
      s >= 8 ? 'Rich, diverse neighbourhood. Multiple categories are well-represented — this is the kind of place where daily life happens on foot.'
      : s >= 6 ? 'Good variety nearby. Most categories are represented, with some gaps. A typical active urban neighbourhood.'
      : s >= 4 ? 'Limited diversity. A few categories dominate — the neighbourhood may feel one-note despite having some destinations.'
      : 'Low diversity and density. Few walkable options across categories — most daily needs require a car.',
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
  /** True when score is derived/modelled rather than measured — shows "Estimated" badge */
  estimated?: boolean;
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
    group: 'network',
    getScore: (_m, cs) => cs ? cs.components.networkDesign.score / 10 : 0,
  },
  {
    key: 'speedEnvironment',
    name: 'Speed Environment',
    icon: '🚗',
    source: 'OpenStreetMap',
    estimated: true,
    group: 'environment',
    getScore: (_m, cs) => {
      const m = cs?.components.environmentalComfort.metrics.find(m => m.name === 'Speed Environment');
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
    estimated: true,
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
    group: 'network',
    getScore: (_m, cs) => {
      const sdMetric = cs?.components.safety.metrics[0];
      return sdMetric ? sdMetric.score / 10 : 0;
    },
  },
  {
    key: 'destinations',
    name: 'Street Life',
    icon: '🏙️',
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

function MetricCardSimple({ def, score, isLoading, isExpanded, onClick, subMetrics, streetCharacter, airQualityReading }: {
  def: MetricDef;
  score: number;
  isLoading: boolean;
  isExpanded: boolean;
  onClick: () => void;
  subMetrics?: { name: string; score: number; rawValue?: string }[];
  streetCharacter?: StreetCharacterAnalysis | null;
  airQualityReading?: { pm25: number | null; category: string | null } | null;
}) {
  const color = getScoreColor(score);
  const displayScore = score > 0 ? score.toFixed(1) : '—';
  const detail = METRIC_DETAILS[def.key];
  const contextText = detail && score > 0 ? detail.getMeans(score) : getInsight(def.key, score);
  const bg = getCardBackground(score);
  const borderColor = getCardBorderColor(score, isExpanded, color);

  return (
    <div
      className="transition-all"
      style={{
        borderColor,
        backgroundColor: bg,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse flex items-center gap-2">
            <span className="text-xl">{def.icon}</span>
            <span style={{ color: '#3d3020', fontSize: '14px', fontWeight: 500 }}>Loading {def.name}...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Header row: icon + name + score */}
          <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
            <div className="flex items-center" style={{ gap: '6px' }}>
              <span style={{ fontSize: '20px' }}>{def.icon}</span>
              <span style={{ color: '#1a3a1a', fontSize: '17px', fontWeight: 800 }}>{def.name}</span>
            </div>
            <div className="flex items-center" style={{ gap: '4px' }}>
              <span style={{ color, fontSize: '26px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{displayScore}</span>
              <span style={{ color: '#2a2010', fontSize: '15px', fontWeight: 700 }}>/10</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ backgroundColor: '#ede8dd', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' }}>
            <div
              style={{ height: '100%', borderRadius: '5px', width: `${Math.max(score * 10, 2)}%`, backgroundColor: color, transition: 'width 0.5s' }}
            />
          </div>

          {/* Live reading — shown for Air Quality */}
          {def.key === 'airQuality' && airQualityReading && (
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
              {airQualityReading.pm25 !== null && (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a3a1a' }}>
                  PM2.5: {airQualityReading.pm25.toFixed(1)} µg/m³
                </span>
              )}
              {airQualityReading.category && (
                <span style={{ fontSize: 12, fontWeight: 600, color: color, backgroundColor: `${color}18`, padding: '2px 8px', borderRadius: 4 }}>
                  {airQualityReading.category}
                </span>
              )}
            </div>
          )}

          {/* Sub-metrics — shown for Street Grid */}
          {subMetrics && subMetrics.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {subMetrics.map(m => {
                const label = SUB_METRIC_LABELS[m.name] ?? m.name;
                const c = subMetricBarColor(m.score);
                return (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 120, fontSize: 12, fontWeight: 600, color: '#2a2010', flexShrink: 0 }}>
                      {label}
                      {m.rawValue && <span style={{ color: '#8a9a8a', fontWeight: 400 }}> · {m.rawValue}</span>}
                    </span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#ede8dd' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.max(m.score, 2)}%`, backgroundColor: c, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ width: 28, textAlign: 'right', fontSize: 11, fontWeight: 700, color: c, flexShrink: 0 }}>{m.score}</span>
                  </div>
                );
              })}
              {streetCharacter && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#2a2010', lineHeight: 1.5 }}>
                  {streetCharacter.assessment}
                </div>
              )}
            </div>
          )}

          {/* Inline context — always visible, no click required */}
          {!subMetrics && contextText && (
            <p style={{ color: '#1a3a1a', fontSize: '15px', fontWeight: 500, lineHeight: '1.65', marginBottom: '10px' }}>
              {contextText}
            </p>
          )}

          {/* Data source + estimated badge + expand toggle */}
          <div className="flex items-center justify-between" style={{ paddingTop: '8px', borderTop: '1px solid #f0ebe0' }}>
            <div className="flex items-center" style={{ gap: '6px' }}>
              <span style={{ color: '#2a2010', fontSize: '14px', fontWeight: 700 }}>{detail?.source ?? def.source}</span>
              {def.estimated && (
                <span
                  style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1.5px solid #fde68a', fontSize: '13px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px' }}
                >
                  Estimated
                </span>
              )}
            </div>
            <button
              style={{ color: '#1a7a28', fontSize: '14px', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}
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

const SEASONAL_AQ_COUNTRIES = new Set(['th', 'mm', 'la', 'kh', 'vn', 'id']);
const CHRONIC_AQ_COUNTRIES = new Set(['in', 'cn', 'pk', 'bd', 'ng']);

function airQualitySeasonalNote(countryCode?: string): string | null {
  if (!countryCode) return null;
  const cc = countryCode.toLowerCase();
  if (SEASONAL_AQ_COUNTRIES.has(cc)) {
    return 'Seasonal burning periods (typically Feb–Apr in SE Asia) can push AQI to 200–400+. This score reflects readings at time of analysis and may not capture annual or worst-case conditions.';
  }
  if (CHRONIC_AQ_COUNTRIES.has(cc)) {
    return 'This region frequently exceeds WHO annual PM2.5 guidelines. Scores can fluctuate significantly with season and local conditions.';
  }
  return null;
}

function MetricDetailPanel({ metricKey, score, icon, name, countryCode }: {
  metricKey: string;
  score: number;
  icon: string;
  name: string;
  countryCode?: string;
}) {
  const detail = METRIC_DETAILS[metricKey];
  if (!detail) return null;
  const color = getScoreColor(score);
  const seasonalNote = metricKey === 'airQuality' ? airQualitySeasonalNote(countryCode) : null;

  return (
    <div
      className="rounded-xl border p-5 animate-in fade-in duration-200"
      style={{ borderColor: '#e0dbd0', backgroundColor: '#faf7f2' }}
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: '#f0ebe0' }}>
        <span className="text-xl">{icon}</span>
        <span className="text-base font-bold" style={{ color: '#1a3a1a' }}>{name}</span>
        <span className="text-base font-bold ml-auto" style={{ color }}>{score.toFixed(1)}/10</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="font-bold uppercase mb-1" style={{ color: '#1a3a1a', fontSize: '12px', letterSpacing: '0.08em' }}>
            What this measures
          </div>
          <div className="leading-relaxed" style={{ color: '#1a3a1a', fontSize: '14px' }}>
            {detail.what}
          </div>
        </div>

        <div>
          <div className="font-bold uppercase mb-1" style={{ color: '#1a3a1a', fontSize: '12px', letterSpacing: '0.08em' }}>
            How it's scored
          </div>
          <div className="leading-relaxed" style={{ color: '#1a3a1a', fontSize: '14px' }}>
            {detail.how}
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ backgroundColor: '#f8f6f1' }}>
          <div className="font-bold uppercase mb-1" style={{ color, fontSize: '12px', letterSpacing: '0.08em' }}>
            What your {score.toFixed(1)} means
          </div>
          <div className="leading-relaxed" style={{ color: '#1a3a1a', fontSize: '14px' }}>
            {detail.getMeans(score)}
          </div>
        </div>

        {seasonalNote && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid #fde68a' }}>
            <div className="font-bold uppercase mb-1" style={{ color: '#92400e', fontSize: '11px', letterSpacing: '0.08em' }}>
              Seasonal variation
            </div>
            <div className="leading-relaxed" style={{ color: '#78350f', fontSize: '13px' }}>
              {seasonalNote}
            </div>
          </div>
        )}

        <div className="pt-2 border-t font-semibold" style={{ color: '#3d3020', borderColor: '#f0ebe0', fontSize: '13px' }}>
          Source: {detail.source}
        </div>
      </div>
    </div>
  );
}

export default function MetricGrid({ metrics, satelliteLoaded, compositeScore, demographicData, demographicLoading, osmData, streetDesignScore, countryCode, mapillaryCoverageGap, streetCharacter, streetCharacterLoading, airQualityReading }: MetricGridProps) {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const isUS = countryCode === 'us';
  const visibleMetrics = METRICS.filter(def =>
    (!def.usOnly || isUS) && (!def.internationalOnly || !isUS)
  );

  const toggleMetric = (key: string) => {
    setExpandedMetric(prev => prev === key ? null : key);
  };

  // Group metrics by component, preserving definition order within each group
  const groups = (['network', 'environment', 'density'] as const).map(groupKey => ({
    groupKey,
    defs: visibleMetrics.filter(d => d.group === groupKey),
  })).filter(g => g.defs.length > 0);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#1a3a1a' }}>
          Score Breakdown
        </h2>
        <p style={{ color: '#1a3a1a', fontSize: '16px', fontWeight: 500, marginTop: '4px' }}>
          Each metric contributes to your walkability score. Green = strength, red = needs attention.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map(({ groupKey, defs }) => {
          const groupMeta = GROUP_LABELS[groupKey];

          // Resolve visibility for each metric in this group
          const cards = defs.map(def => {
            const score = def.getScore(metrics, compositeScore);
            const isLoading = def.satKey && satelliteLoaded ? !satelliteLoaded.has(def.satKey) : false;
            // Hide when: still loading OR (finished loading with no data AND metric is optional/external)
            const isCoverageGap = def.key === 'streetLighting' && !!mapillaryCoverageGap && !!satelliteLoaded?.has('streetLighting');
            const hidden = !isLoading && (isCoverageGap || (score === 0 && !!def.satKey));
            return { def, score, isLoading, hidden };
          });

          const visibleCards = cards.filter(c => !c.hidden);
          // Skip entire group if nothing to show (and nothing is still loading)
          const hasLoadingCards = cards.some(c => c.isLoading && !c.hidden);
          if (visibleCards.length === 0 && !hasLoadingCards) return null;

          const networkTypeStyle = streetCharacter && groupKey === 'network'
            ? (NETWORK_TYPE_STYLE[streetCharacter.type] ?? NETWORK_TYPE_STYLE['Mixed Pattern'])
            : null;

          return (
            <div key={groupKey}>
              {/* Group header */}
              <div className="flex items-center" style={{ gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '18px' }}>{groupMeta.icon}</span>
                <span style={{ color: '#1a3a1a', letterSpacing: '0.1em', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase' as const }}>
                  {groupMeta.label}
                </span>
                {networkTypeStyle && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: networkTypeStyle.bg, color: networkTypeStyle.text }}>
                    {streetCharacter!.type}
                  </span>
                )}
                {streetCharacterLoading && groupKey === 'network' && !streetCharacter && (
                  <div className="animate-pulse" style={{ height: 18, width: 90, background: '#d8d0c4', borderRadius: 4 }} />
                )}
                <div className="flex-1" style={{ height: '2px', backgroundColor: '#c4b59a' }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.filter(c => !c.hidden || c.isLoading).map(({ def, score, isLoading }) => {
                  const streetGridSubMetrics = def.key === 'streetGrid'
                    ? compositeScore?.components.networkDesign.metrics
                    : undefined;
                  return (
                  <MetricCardSimple
                    key={def.key}
                    def={def}
                    score={score}
                    isLoading={isLoading}
                    isExpanded={expandedMetric === def.key}
                    onClick={() => toggleMetric(def.key)}
                    subMetrics={streetGridSubMetrics}
                    streetCharacter={def.key === 'streetGrid' ? streetCharacter : undefined}
                    airQualityReading={def.key === 'airQuality' ? airQualityReading : undefined}
                  />
                  );
                })}
              </div>

              {/* Expanded detail panel — appears directly below the expanded metric's group */}
              {expandedMetric && visibleCards.some(c => c.def.key === expandedMetric) && (() => {
                const card = visibleCards.find(c => c.def.key === expandedMetric);
                if (!card) return null;
                return (
                  <div className="mt-3">
                    <MetricDetailPanel
                      metricKey={card.def.key}
                      score={card.score}
                      icon={card.def.icon}
                      name={card.def.name}
                      countryCode={countryCode}
                    />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

    </div>
  );
}
