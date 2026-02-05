import { useState } from 'react';
import type { WalkabilityMetrics, RawMetricData } from '../../types';
import MetricCard from '../MetricCard';
import { translateMetrics } from '../../utils/metricTranslations';

// Map from metric index (in translateMetrics output order) to satellite key
// Indices 0-4 are OSM metrics (always available), 5-7 are satellite
const METRIC_INDEX_TO_SAT_KEY: Record<number, string> = {
  5: 'slope',
  6: 'treeCanopy',
  7: 'thermalComfort',
};

interface MetricGridProps {
  metrics: WalkabilityMetrics;
  locationName: string;
  satelliteLoaded?: Set<string>;
  rawData?: RawMetricData;
}

export default function MetricGrid({ metrics, locationName, satelliteLoaded, rawData }: MetricGridProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Translate raw metrics to user-friendly format
  const userFriendlyMetrics = translateMetrics(metrics, locationName, rawData);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-8" style={{ color: '#2a3a2a' }}>
        What This Means For You
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {userFriendlyMetrics.map((metric, index) => {
          const satKey = METRIC_INDEX_TO_SAT_KEY[index];
          const isLoading = satKey && satelliteLoaded ? !satelliteLoaded.has(satKey) : false;
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={metric.headline}
              className={isExpanded ? 'col-span-1 sm:col-span-2 lg:col-span-3' : ''}
            >
              <MetricCard
                {...metric}
                isLoading={isLoading}
                isExpanded={isExpanded}
                onToggle={() => setExpandedIndex(isExpanded ? null : index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
