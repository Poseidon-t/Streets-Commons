import { useState } from 'react';
import AddressInput from './components/streetcheck/AddressInput';
import ScoreCard from './components/streetcheck/ScoreCard';
import MetricGrid from './components/streetcheck/MetricGrid';
import Map from './components/Map';
import { fetchOSMData } from './services/overpass';
import { calculateMetrics } from './utils/metrics';
import { calculateDemographics } from './utils/demographics';
import { calculateEconomicProjections } from './utils/economics';
import { COLORS } from './constants';
import type { Location, WalkabilityMetrics, Demographics, EconomicProjections } from './types';

function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [metrics, setMetrics] = useState<WalkabilityMetrics | null>(null);
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [economics, setEconomics] = useState<EconomicProjections | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleLocationSelect = async (selectedLocation: Location) => {
    setLocation(selectedLocation);
    setIsAnalyzing(true);
    setMetrics(null);

    try {
      const osmData = await fetchOSMData(selectedLocation.lat, selectedLocation.lon);
      const calculatedMetrics = calculateMetrics(osmData, selectedLocation.lat, selectedLocation.lon);
      const calculatedDemographics = calculateDemographics();
      const calculatedEconomics = calculateEconomicProjections(osmData);

      setMetrics(calculatedMetrics);
      setDemographics(calculatedDemographics);
      setEconomics(calculatedEconomics);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze location. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      {/* Header */}
      <header className="shadow-md" style={{ backgroundColor: COLORS.primary }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-5xl font-bold text-white mb-3">SafeStreets</h1>
          <p className="text-xl text-gray-200">
            Is your neighborhood walkable? Free tool to find out in seconds.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Address Search */}
        <div className="mb-8">
          <AddressInput
            onSelect={handleLocationSelect}
            placeholder="Enter any address worldwide..."
          />
        </div>

        {isAnalyzing && (
          <div className="flex flex-col items-center py-16">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-600">Analyzing walkability...</p>
            <p className="text-sm text-gray-500">Fetching OpenStreetMap data</p>
          </div>
        )}

        {location && metrics && !isAnalyzing && (
          <div className="space-y-8">
            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <Map location={location} />
              </div>
              <div>
                <ScoreCard metrics={metrics} />
              </div>
            </div>

            {/* Metrics Grid */}
            <MetricGrid metrics={metrics} />

            {/* Who's Affected */}
            {demographics && (
              <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Who's Affected</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: COLORS.primary }}>
                      {demographics.totalPopulation.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Residents (800m radius)</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold" style={{ color: COLORS.accent }}>
                      {demographics.children.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Children (0-14)</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold" style={{ color: COLORS.accent }}>
                      {demographics.elderly.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Elderly (65+)</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold" style={{ color: COLORS.primary }}>
                      {demographics.dailyVisitors.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Daily visitors</div>
                  </div>
                </div>
              </div>
            )}

            {/* Economic Case */}
            {economics && (
              <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Economic Projections</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Estimated economic impact of walkability improvements (10-year projections)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">Retail Uplift</div>
                    <div className="text-2xl font-bold" style={{ color: COLORS.excellent }}>
                      ${economics.retailUplift.toLocaleString()}/yr
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">Health Savings</div>
                    <div className="text-2xl font-bold" style={{ color: COLORS.excellent }}>
                      ${economics.healthSavings.toLocaleString()}/yr
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">10-Year ROI</div>
                    <div className="text-2xl font-bold" style={{ color: COLORS.accent }}>
                      {economics.roi.toFixed(1)}×
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Limitations */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-yellow-900 mb-4">
                ⚠️ What This Analysis Can & Cannot Measure
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-800 mb-2">✅ What We CAN Measure (Remote)</h4>
                  <ul className="text-sm text-green-900 space-y-1">
                    <li>• Crossing locations from OpenStreetMap</li>
                    <li>• Street network connectivity</li>
                    <li>• Green space presence (parks, trees)</li>
                    <li>• Destination types and locations</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-red-800 mb-2">❌ What We CANNOT Measure</h4>
                  <ul className="text-sm text-red-900 space-y-1">
                    <li>• Actual sidewalk width or condition</li>
                    <li>• Real surface temperature (using proxy)</li>
                    <li>• Precise slope (using estimates)</li>
                    <li>• Obstacles, lighting, or safety perception</li>
                  </ul>
                </div>
              </div>
              <p className="text-sm text-yellow-800 mt-4">
                <strong>Transparency:</strong> SafeStreets provides approximately 40-50% of a complete walkability assessment using entirely free global data sources. For full assessments, on-site audits are recommended.
              </p>
            </div>
          </div>
        )}

        {!location && !isAnalyzing && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚶</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Check Your Neighborhood
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Enter any address worldwide to get a detailed walkability analysis based on OpenStreetMap data.
              We measure crossing safety, green coverage, network connectivity, and more.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p className="mb-2">
              Data from{' '}
              <a href="https://www.openstreetmap.org" className="hover:underline" style={{ color: COLORS.accent }}>
                OpenStreetMap
              </a>{' '}
              contributors
            </p>
            <p className="text-xs text-gray-500">
              SafeStreets Phase 1 MVP • Open Source • Free Forever
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
