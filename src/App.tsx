import { useState } from 'react';
import AddressInput from './components/streetcheck/AddressInput';
import ScoreCard from './components/streetcheck/ScoreCard';
import MetricGrid from './components/streetcheck/MetricGrid';
import Map from './components/Map';
import { fetchOSMData } from './services/overpass';
import { calculateMetrics, assessDataQuality } from './utils/metrics';
import { calculateDemographics } from './utils/demographics';
import { calculateEconomicProjections } from './utils/economics';
import { COLORS } from './constants';
import type { Location, WalkabilityMetrics, DataQuality, Demographics, EconomicProjections } from './types';

function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [metrics, setMetrics] = useState<WalkabilityMetrics | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
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
      const quality = assessDataQuality(osmData);
      const calculatedDemographics = calculateDemographics();
      const calculatedEconomics = calculateEconomicProjections(osmData);

      setMetrics(calculatedMetrics);
      setDataQuality(quality);
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
                {dataQuality && (
                  <div className="mt-4 bg-white rounded-xl p-4 border-2 border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-2">Data Quality</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Crossings: {dataQuality.crossingCount}</div>
                      <div>Streets: {dataQuality.streetCount}</div>
                      <div>Sidewalks: {dataQuality.sidewalkCount}</div>
                      <div>POIs: {dataQuality.poiCount}</div>
                    </div>
                    <div className="mt-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        dataQuality.confidence === 'high' ? 'bg-green-100 text-green-800' :
                        dataQuality.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {dataQuality.confidence.toUpperCase()} CONFIDENCE
                      </span>
                    </div>
                  </div>
                )}
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

            {/* What We Measure */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                ✅ What This Analysis Measures
              </h3>
              <div className="space-y-2 text-sm text-blue-900">
                <p><strong>✓ Crossing Density:</strong> Actual OSM-tagged pedestrian crossings</p>
                <p><strong>✓ Sidewalk Coverage:</strong> Streets with sidewalk=* tags (often incomplete)</p>
                <p><strong>✓ Network Efficiency:</strong> Street grid connectivity</p>
                <p><strong>✓ Destination Access:</strong> Variety of nearby amenities</p>
              </div>
              <div className="mt-6 p-4 bg-yellow-100 border border-yellow-300 rounded">
                <p className="text-sm text-yellow-900">
                  <strong>⚠️ NOT measured:</strong> Tree canopy, surface temperature, slope, sidewalk width,
                  pavement condition, lighting, or actual safety perception. These require satellite imagery,
                  elevation data, or on-site audits.
                </p>
              </div>
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
              Get honest walkability analysis based on real OpenStreetMap data.
              We only show metrics we can verify — no fake estimates.
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
              SafeStreets • Honest Analysis • No Fake Metrics
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
