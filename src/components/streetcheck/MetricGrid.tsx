import { COLORS } from '../../constants';
import type { WalkabilityMetrics } from '../../types';

interface MetricGridProps {
  metrics: WalkabilityMetrics;
}

interface MetricCardProps {
  name: string;
  score: number;
  description: string;
  calculation: string;
  standard: string;
  dataSource: string;
  icon: string;
}

function MetricCard({ name, score, description, calculation, standard, dataSource, icon }: MetricCardProps) {
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

      <div className="text-3xl font-bold mb-3" style={{ color: getColor() }}>
        {score.toFixed(1)}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="h-2 rounded-full transition-all duration-1000"
          style={{
            width: `${(score / 10) * 100}%`,
            backgroundColor: getColor(),
          }}
        />
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <strong className="text-gray-700">What it measures:</strong>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>
        <div>
          <strong className="text-gray-700">How it's calculated:</strong>
          <p className="text-gray-600 mt-1">{calculation}</p>
        </div>
        <div>
          <strong className="text-gray-700">Standard:</strong>
          <p className="text-gray-600 mt-1">{standard}</p>
        </div>
        <div>
          <strong className="text-gray-700">Data source:</strong>
          <p className="text-blue-600 mt-1">{dataSource}</p>
        </div>
      </div>
    </div>
  );
}

export default function MetricGrid({ metrics }: MetricGridProps) {
  const metricData = [
    {
      name: 'Crossing Density',
      score: metrics.crossingDensity,
      description: 'How many marked pedestrian crossings exist in the area and how well-distributed they are',
      calculation: 'Counts OSM nodes tagged as highway=crossing, calculates crossings per km of road, and measures maximum gap from center point. Combines density score (ideal: 8+ crossings/km) with gap score (penalty if furthest crossing >200m away)',
      standard: 'Score 10 = 8+ crossings/km with no crossing >200m away. Score 5 = 4 crossings/km or moderate gaps. Score 0 = no marked crossings',
      dataSource: 'OpenStreetMap highway=crossing nodes',
      icon: '🚶',
    },
    {
      name: 'Sidewalk Coverage',
      score: metrics.sidewalkCoverage,
      description: 'Percentage of streets that have documented sidewalk infrastructure',
      calculation: 'Counts streets with sidewalk=* tags (values: both, left, right, yes) and divides by total street count. Does NOT count sidewalk=no or sidewalk=none',
      standard: 'Score 10 = 90%+ streets have sidewalk tags. Score 5 = 45% coverage. Score 0 = no sidewalk data. Note: OSM sidewalk tagging is often incomplete',
      dataSource: 'OpenStreetMap sidewalk=* tags on highway ways',
      icon: '🚶‍♀️',
    },
    {
      name: 'Network Efficiency',
      score: metrics.networkEfficiency,
      description: 'How well-connected the street grid is for walking (more intersections = shorter, more direct routes)',
      calculation: 'Ratio of crossing points to street segments. Grid-like neighborhoods have ~0.5 ratio (1 intersection per 2 street segments). Cul-de-sac sprawl has low ratios',
      standard: 'Score 10 = ratio ≥0.5 (dense grid). Score 5 = ratio 0.25 (moderate). Score 0 = ratio near 0 (disconnected streets)',
      dataSource: 'Calculated from OSM crossings and street segments',
      icon: '🗺️',
    },
    {
      name: 'Destination Access',
      score: metrics.destinationAccess,
      description: 'Variety of daily destinations (school, shops, transit, healthcare, food, recreation) within 800m walking distance',
      calculation: 'Checks for presence of 6 destination categories: education (school, kindergarten), transit (bus/rail stations), shopping (any shop tag), healthcare (hospital, clinic, pharmacy), food (restaurant, cafe, bar), recreation (park, playground, sports)',
      standard: 'Score 10 = all 6 destination types present. Score 5 = 3 types. Score 0 = no destinations. Does NOT measure distance to each destination, only variety',
      dataSource: 'OpenStreetMap amenity=*, shop=*, leisure=*, railway=* tags',
      icon: '🏪',
    },
    {
      name: 'Slope',
      score: metrics.slope,
      description: 'Terrain gradient affecting wheelchair accessibility and ease of walking',
      calculation: 'Fetches elevation data from SRTM (30m resolution) for 9 points in 800m radius. Calculates average slope (70% weight) and maximum slope (30% weight). Progressive enhancement - loads after initial analysis.',
      standard: 'Score 10 = ≤2% avg slope (flat/gentle). Score 5 = 5% avg slope (moderate). Score 0 = ≥5% avg slope (steep/inaccessible). Wheelchair standard: ≤5% gradient',
      dataSource: 'SRTM elevation data via Open-Elevation API',
      icon: '⛰️',
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
