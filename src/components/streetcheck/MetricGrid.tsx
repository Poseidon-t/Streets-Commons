import type { WalkabilityMetrics } from '../../types';
import MetricCard from '../MetricCard';
import { translateMetrics } from '../../utils/metricTranslations';

interface MetricGridProps {
  metrics: WalkabilityMetrics;
  locationName: string;
}

export default function MetricGrid({ metrics, locationName }: MetricGridProps) {
  // Translate raw metrics to user-friendly format
  const userFriendlyMetrics = translateMetrics(metrics, locationName);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-8" style={{ color: '#2a3a2a' }}>
        What This Means For You
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        {userFriendlyMetrics.map((metric) => (
          <MetricCard key={metric.headline} {...metric} />
        ))}
      </div>
    </div>
  );
}
