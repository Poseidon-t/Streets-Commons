import type { WalkabilityMetrics, RawMetricData } from '../../types';
import MetricCard from '../MetricCard';
import { translateMetrics } from '../../utils/metricTranslations';

// Map from metric index (in translateMetrics output order) to satellite key
// Indices 0-2 are OSM metrics (always available), 3-7 are satellite
const METRIC_INDEX_TO_SAT_KEY: Record<number, string> = {
  3: 'slope',
  4: 'treeCanopy',
  5: 'surfaceTemp',
  6: 'airQuality',
  7: 'heatIsland',
};

interface MetricGridProps {
  metrics: WalkabilityMetrics;
  locationName: string;
  satelliteLoaded?: Set<string>;
  rawData?: RawMetricData;
}

export default function MetricGrid({ metrics, locationName, satelliteLoaded, rawData }: MetricGridProps) {
  // Translate raw metrics to user-friendly format
  const userFriendlyMetrics = translateMetrics(metrics, locationName, rawData);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-8" style={{ color: '#2a3a2a' }}>
        What This Means For You
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        {userFriendlyMetrics.map((metric, index) => {
          const satKey = METRIC_INDEX_TO_SAT_KEY[index];
          const isLoading = satKey && satelliteLoaded ? !satelliteLoaded.has(satKey) : false;
          return (
            <MetricCard key={metric.headline} {...metric} isLoading={isLoading} />
          );
        })}
      </div>
    </div>
  );
}
