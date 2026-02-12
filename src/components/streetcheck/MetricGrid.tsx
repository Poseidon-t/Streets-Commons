import { useState } from 'react';
import type { WalkabilityMetrics, RawMetricData, WalkabilityScoreV2, ComponentScore } from '../../types';
import MetricCard from '../MetricCard';
import { translateMetrics, type UserFriendlyMetric } from '../../utils/metricTranslations';

interface MetricGridProps {
  metrics: WalkabilityMetrics;
  locationName: string;
  satelliteLoaded?: Set<string>;
  rawData?: RawMetricData;
  compositeScore?: WalkabilityScoreV2 | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function SectionHeader({ component }: { component: ComponentScore }) {
  const color = getScoreColor(component.score);
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-lg font-bold" style={{ color: '#2a3a2a' }}>{component.label}</h3>
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 rounded-full overflow-hidden" style={{ backgroundColor: '#e0dbd0' }}>
          <div className="h-full rounded-full" style={{ width: `${component.score}%`, backgroundColor: color }} />
        </div>
        <span className="text-sm font-semibold" style={{ color }}>{component.score}</span>
        <span className="text-xs" style={{ color: '#9ca3af' }}>({Math.round(component.weight * 100)}%)</span>
      </div>
    </div>
  );
}

// Build grouped metric sections from composite score
function buildSections(
  compositeScore: WalkabilityScoreV2,
  legacyMetrics: UserFriendlyMetric[],
): { component: ComponentScore; metrics: { metric: UserFriendlyMetric; satKey?: string }[] }[] {
  // Map legacy metrics by approximate name matching
  const crossingSafety = legacyMetrics[0]; // index 0
  const sidewalkCoverage = legacyMetrics[1]; // index 1
  const speedExposure = legacyMetrics[2]; // index 2
  const dailyNeeds = legacyMetrics[3]; // index 3
  const nightSafety = legacyMetrics[4]; // index 4
  const slope = legacyMetrics[5]; // index 5
  const treeCanopy = legacyMetrics[6]; // index 6
  const thermalComfort = legacyMetrics[7]; // index 7

  // Network Design sub-metrics (from compositeScore, not legacy)
  const networkSubMetrics = compositeScore.components.networkDesign.metrics.map(m => ({
    metric: {
      icon: m.name === 'Intersection Density' ? '🔀' : m.name === 'Block Length' ? '📏' : m.name === 'Network Density' ? '🛣️' : '🚧',
      headline: m.name,
      score: Math.max(1, Math.round(m.score / 10)),
      badge: (m.score >= 80 ? 'excellent' : m.score >= 50 ? 'good' : m.score >= 30 ? 'moderate' : m.score >= 20 ? 'needs-improvement' : 'safety-concern') as UserFriendlyMetric['badge'],
      description: m.rawValue ? `Current value: ${m.rawValue}` : '',
      whyItMatters: m.name === 'Intersection Density' ? 'More intersections mean more route choices and shorter walks. Dense grids let pedestrians take direct paths.'
        : m.name === 'Block Length' ? 'Shorter blocks mean more crossing opportunities and direct routes. Long blocks force detours.'
        : m.name === 'Network Density' ? 'More street coverage per area means better connectivity and more walking routes available.'
        : 'Dead-end streets force backtracking. Connected networks provide multiple route options.',
      technicalMeasurement: m.rawValue || 'Computed from OSM way topology',
      recommendedStandard: m.name === 'Intersection Density' ? '150+ intersections/km² (dense urban grid)'
        : m.name === 'Block Length' ? '100m or less (Portland-style short blocks)'
        : m.name === 'Network Density' ? '20+ km/km² (well-connected street network)'
        : '<10% dead-end ratio (connected grid)',
      dataSource: 'OpenStreetMap street network topology',
    } as UserFriendlyMetric,
  }));

  return [
    {
      component: compositeScore.components.networkDesign,
      metrics: networkSubMetrics,
    },
    {
      component: compositeScore.components.environmentalComfort,
      metrics: [
        { metric: treeCanopy, satKey: 'treeCanopy' },
        {
          metric: {
            icon: '🏗️',
            headline: 'Building Density',
            score: Math.max(1, Math.round((compositeScore.components.environmentalComfort.metrics.find(m => m.name === 'Building Density')?.score || 50) / 10)),
            badge: 'good' as UserFriendlyMetric['badge'],
            description: 'Building density measured via satellite NDBI index. Less built-up areas provide better environmental comfort.',
            whyItMatters: 'Dense built-up areas retain heat and reduce airflow. Green spaces between buildings improve walking comfort.',
            technicalMeasurement: 'NDBI (Normalized Difference Built-up Index) from Sentinel-2 SWIR and NIR bands',
            recommendedStandard: 'NDBI below 0.1 (balanced mix of buildings and green space)',
            dataSource: 'Sentinel-2 L2A via Microsoft Planetary Computer',
          } as UserFriendlyMetric,
          satKey: 'buildingDensity',
        },
        { metric: thermalComfort, satKey: 'thermalComfort' },
      ],
    },
    {
      component: compositeScore.components.safety,
      metrics: [
        { metric: speedExposure },
        { metric: crossingSafety },
        { metric: nightSafety },
        {
          metric: {
            icon: '🚨',
            headline: 'Crash History',
            score: Math.max(1, Math.round((compositeScore.components.safety.metrics.find(m => m.name === 'Crash Data')?.score || 50) / 10)),
            badge: 'good' as UserFriendlyMetric['badge'],
            description: 'Historical crash and fatality data for this area.',
            whyItMatters: 'Past crashes indicate dangerous street designs. Areas with frequent pedestrian crashes need safety interventions.',
            technicalMeasurement: 'NHTSA FARS (US) or WHO road death rates (international)',
            recommendedStandard: 'Vision Zero: zero pedestrian fatalities',
            dataSource: 'NHTSA FARS / WHO Global Health Observatory',
          } as UserFriendlyMetric,
        },
      ],
    },
    {
      component: compositeScore.components.densityContext,
      metrics: [
        {
          metric: {
            icon: '👥',
            headline: 'Population Density',
            score: Math.max(1, Math.round((compositeScore.components.densityContext.metrics[0]?.score || 0) / 10)),
            badge: 'good' as UserFriendlyMetric['badge'],
            description: 'Higher population density correlates with better walkability infrastructure, transit access, and nearby destinations.',
            whyItMatters: 'Dense neighborhoods justify investment in sidewalks, crossings, and transit. Sprawl makes walking impractical.',
            technicalMeasurement: 'People per km² from GHS-POP satellite population estimates',
            recommendedStandard: '5,000+ people/km² for walkable urban areas',
            dataSource: 'GHS-POP R2023 (European Commission JRC)',
          } as UserFriendlyMetric,
          satKey: 'populationDensity',
        },
        { metric: dailyNeeds },
        { metric: slope, satKey: 'slope' },
      ],
    },
  ];
}

export default function MetricGrid({ metrics, locationName, satelliteLoaded, rawData, compositeScore }: MetricGridProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const userFriendlyMetrics = translateMetrics(metrics, locationName, rawData);

  // If no composite score yet, fall back to flat grid
  if (!compositeScore) {
    // Map from metric index to satellite key (legacy)
    const METRIC_INDEX_TO_SAT_KEY: Record<number, string> = { 5: 'slope', 6: 'treeCanopy', 7: 'thermalComfort' };

    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-8" style={{ color: '#2a3a2a' }}>
          What This Means For You
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {userFriendlyMetrics.map((metric, index) => {
            const satKey = METRIC_INDEX_TO_SAT_KEY[index];
            const isLoading = satKey && satelliteLoaded ? !satelliteLoaded.has(satKey) : false;
            const key = `legacy-${index}`;
            const isExpanded = expandedKey === key;
            return (
              <div key={metric.headline} className={isExpanded ? 'col-span-1 sm:col-span-2 lg:col-span-3' : ''}>
                <MetricCard
                  {...metric}
                  isLoading={isLoading}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedKey(isExpanded ? null : key)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grouped sections from composite score
  const sections = buildSections(compositeScore, userFriendlyMetrics);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-8" style={{ color: '#2a3a2a' }}>
        What This Means For You
      </h2>
      <div className="space-y-8">
        {sections.map((section, sIdx) => (
          <div key={section.component.label}>
            <SectionHeader component={section.component} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {section.metrics.map(({ metric, satKey }, mIdx) => {
                const isLoading = satKey && satelliteLoaded ? !satelliteLoaded.has(satKey) : false;
                const key = `${sIdx}-${mIdx}`;
                const isExpanded = expandedKey === key;
                return (
                  <div
                    key={metric.headline}
                    className={isExpanded ? 'col-span-1 sm:col-span-2 lg:col-span-3' : ''}
                  >
                    <MetricCard
                      {...metric}
                      isLoading={isLoading}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedKey(isExpanded ? null : key)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
