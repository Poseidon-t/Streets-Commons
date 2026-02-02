import { COLORS } from '../constants';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';
import ScoreCard from './streetcheck/ScoreCard';

interface CompareViewProps {
  location1: Location;
  metrics1: WalkabilityMetrics;
  quality1: DataQuality;
  location2: Location;
  metrics2: WalkabilityMetrics;
  quality2: DataQuality;
}

export default function CompareView({
  location1,
  metrics1,
  quality1,
  location2,
  metrics2,
  quality2,
}: CompareViewProps) {
  const getWinner = (score1: number, score2: number): 'left' | 'right' | 'tie' => {
    if (Math.abs(score1 - score2) < 0.1) return 'tie';
    return score1 > score2 ? 'left' : 'right';
  };

  // 8 core metrics + overall
  const metrics = [
    { name: 'Street Crossings', score1: metrics1.crossingDensity, score2: metrics2.crossingDensity },
    { name: 'Street Network', score1: metrics1.networkEfficiency, score2: metrics2.networkEfficiency },
    { name: 'Daily Needs', score1: metrics1.destinationAccess, score2: metrics2.destinationAccess },
    { name: 'Terrain Slope', score1: metrics1.slope, score2: metrics2.slope },
    { name: 'Tree Canopy', score1: metrics1.treeCanopy, score2: metrics2.treeCanopy },
    { name: 'Surface Temp', score1: metrics1.surfaceTemp, score2: metrics2.surfaceTemp },
    { name: 'Air Quality', score1: metrics1.airQuality, score2: metrics2.airQuality },
    { name: 'Heat Island', score1: metrics1.heatIsland, score2: metrics2.heatIsland },
    { name: 'Overall Score', score1: metrics1.overallScore, score2: metrics2.overallScore },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Location Comparison</h2>
        <p className="text-gray-600">Side-by-side walkability analysis</p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4 truncate">
            {location1.displayName}
          </h3>
          <ScoreCard metrics={metrics1} />
          {quality1 && (
            <div className="mt-4 bg-white rounded-xl p-4 border-2 border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">Data Quality</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Crossings: {quality1.crossingCount}</div>
                <div>Streets: {quality1.streetCount}</div>
                <div>Sidewalks: {quality1.sidewalkCount}</div>
                <div>POIs: {quality1.poiCount}</div>
              </div>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  quality1.confidence === 'high' ? 'bg-green-100 text-green-800' :
                  quality1.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {quality1.confidence.toUpperCase()} CONFIDENCE
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4 truncate">
            {location2.displayName}
          </h3>
          <ScoreCard metrics={metrics2} />
          {quality2 && (
            <div className="mt-4 bg-white rounded-xl p-4 border-2 border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">Data Quality</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Crossings: {quality2.crossingCount}</div>
                <div>Streets: {quality2.streetCount}</div>
                <div>Sidewalks: {quality2.sidewalkCount}</div>
                <div>POIs: {quality2.poiCount}</div>
              </div>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  quality2.confidence === 'high' ? 'bg-green-100 text-green-800' :
                  quality2.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {quality2.confidence.toUpperCase()} CONFIDENCE
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metric-by-Metric Comparison */}
      <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 shadow-lg">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">Metric Comparison</h3>

        {/* Location Headers */}
        <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b-2 border-gray-200">
          <div className="text-center">
            <div className="text-sm font-bold text-gray-800 truncate px-2" title={location1.displayName}>
              📍 {location1.displayName.split(',')[0]}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-gray-800 truncate px-2" title={location2.displayName}>
              📍 {location2.displayName.split(',')[0]}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {metrics.map((metric) => {
            const winner = getWinner(metric.score1, metric.score2);
            const diff = Math.abs(metric.score1 - metric.score2);

            return (
              <div key={metric.name} className="border-b border-gray-200 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-700">{metric.name}</h4>
                  {winner !== 'tie' && (
                    <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 font-bold">
                      ✓ {winner === 'left' ? location1.displayName.split(',')[0] : location2.displayName.split(',')[0]} wins
                    </span>
                  )}
                  {winner === 'tie' && (
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-semibold">
                      TIE
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={`text-2xl font-bold ${winner === 'left' ? 'text-blue-600' : 'text-gray-600'}`}>
                      {metric.score1.toFixed(1)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(metric.score1 / 10) * 100}%`,
                          backgroundColor: winner === 'left' ? COLORS.excellent : COLORS.fair,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${winner === 'right' ? 'text-blue-600' : 'text-gray-600'}`}>
                      {metric.score2.toFixed(1)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(metric.score2 / 10) * 100}%`,
                          backgroundColor: winner === 'right' ? COLORS.excellent : COLORS.fair,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {diff > 0.1 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Difference: {diff.toFixed(1)} points
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8">
        <h3 className="text-xl font-bold text-blue-900 mb-4">
          📊 Comparison Summary
        </h3>
        <div className="space-y-2 text-sm text-blue-900">
          {metrics1.overallScore > metrics2.overallScore + 0.1 ? (
            <p>
              <strong>{location1.city || 'Location 1'}</strong> has better overall walkability
              ({metrics1.overallScore.toFixed(1)} vs {metrics2.overallScore.toFixed(1)})
            </p>
          ) : metrics2.overallScore > metrics1.overallScore + 0.1 ? (
            <p>
              <strong>{location2.city || 'Location 2'}</strong> has better overall walkability
              ({metrics2.overallScore.toFixed(1)} vs {metrics1.overallScore.toFixed(1)})
            </p>
          ) : (
            <p>Both locations have similar overall walkability scores</p>
          )}

          <p className="mt-4">
            <strong>Key differences:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            {metrics.slice(0, 4).map(m => {
              const winner = getWinner(m.score1, m.score2);
              const diff = Math.abs(m.score1 - m.score2);
              if (diff > 1) {
                return (
                  <li key={m.name}>
                    {m.name}: {winner === 'left' ? location1.city || 'Location 1' : location2.city || 'Location 2'}
                    {' '}is stronger (+{diff.toFixed(1)} points)
                  </li>
                );
              }
              return null;
            }).filter(Boolean)}
          </ul>
        </div>
      </div>
    </div>
  );
}
