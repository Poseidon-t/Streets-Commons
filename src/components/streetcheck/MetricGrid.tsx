import { COLORS } from '../../constants';
import type { WalkabilityMetrics } from '../../types';

interface MetricGridProps {
  metrics: WalkabilityMetrics;
}

interface MetricCardProps {
  name: string;
  score: number;
  description: string;
  standard: string;
  icon: string;
}

function MetricCard({ name, score, description, standard, icon }: MetricCardProps) {
  const getColor = () => {
    if (score >= 8) return COLORS.excellent;
    if (score >= 6) return COLORS.good;
    if (score >= 4) return COLORS.fair;
    if (score >= 2) return COLORS.poor;
    return COLORS.critical;
  };

  const passed = score >= 5;

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-100 hover:border-gray-200 transition-all shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <h3 className="font-bold text-gray-800">{name}</h3>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: passed ? '#dcfce7' : '#fee2e2',
            color: passed ? '#166534' : '#991b1b',
          }}
        >
          {passed ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div className="text-3xl font-bold mb-2" style={{ color: getColor() }}>
        {score.toFixed(1)}
      </div>

      <p className="text-sm text-gray-600 mb-3">{description}</p>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className="h-2 rounded-full transition-all duration-1000"
          style={{
            width: `${(score / 10) * 100}%`,
            backgroundColor: getColor(),
          }}
        />
      </div>

      <div className="text-xs text-gray-500">
        <strong>Standard:</strong> {standard}
      </div>
    </div>
  );
}

export default function MetricGrid({ metrics }: MetricGridProps) {
  const metricData = [
    {
      name: 'Crossing Density',
      score: metrics.crossingGaps,
      description: 'Safe pedestrian crossings within walking distance',
      standard: '≤200m gaps between crossings',
      icon: '🚶',
    },
    {
      name: 'Tree Canopy',
      score: metrics.treeCanopy,
      description: 'Shade coverage (estimated from OSM green spaces)',
      standard: '≥30% tree coverage',
      icon: '🌳',
    },
    {
      name: 'Surface Temperature',
      score: metrics.surfaceTemp,
      description: 'Heat exposure (proxy from tree canopy)',
      standard: '≤38°C surface temp',
      icon: '🌡️',
    },
    {
      name: 'Network Efficiency',
      score: metrics.networkEfficiency,
      description: 'Street grid connectivity (detour factor)',
      standard: '≤1.3× detour ratio',
      icon: '🗺️',
    },
    {
      name: 'Slope',
      score: metrics.slope,
      description: 'Wheelchair accessibility (estimated)',
      standard: '≤5% gradient',
      icon: '⛰️',
    },
    {
      name: 'Destination Access',
      score: metrics.destinationAccess,
      description: 'Schools, shops, transit within 800m',
      standard: '≥4 destination types',
      icon: '🏪',
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Detailed Metrics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricData.map((metric) => (
          <MetricCard key={metric.name} {...metric} />
        ))}
      </div>
    </div>
  );
}
