import { useState, useEffect } from 'react';
import AddressInput from './components/streetcheck/AddressInput';
import ScoreCard from './components/streetcheck/ScoreCard';
import MetricGrid from './components/streetcheck/MetricGrid';
import Map from './components/Map';
import CompareView from './components/CompareView';
import ShareButtons from './components/ShareButtons';
import { fetchOSMData } from './services/overpass';
import { calculateMetrics, assessDataQuality } from './utils/metrics';
import { fetchElevationProfile, calculateSlope, scoreSlopeForWalkability, calculateMaxSlope } from './services/elevation';
import { fetchNDVI, scoreTreeCanopy } from './services/treecanopy';
import { fetchSurfaceTemperature } from './services/surfacetemperature';
import { COLORS } from './constants';
import type { Location, WalkabilityMetrics, DataQuality, OSMData } from './types';

interface AnalysisData {
  location: Location;
  metrics: WalkabilityMetrics;
  quality: DataQuality;
  osmData: OSMData;
}

function App() {
  const [compareMode, setCompareMode] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [metrics, setMetrics] = useState<WalkabilityMetrics | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [osmData, setOsmData] = useState<OSMData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Compare mode state
  const [location1, setLocation1] = useState<AnalysisData | null>(null);
  const [location2, setLocation2] = useState<AnalysisData | null>(null);
  const [isAnalyzingCompare, setIsAnalyzingCompare] = useState<1 | 2 | null>(null);

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat');
    const lon = params.get('lon');
    const name = params.get('name');
    const compare = params.get('compare');

    if (lat && lon && name) {
      const urlLocation: Location = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        displayName: decodeURIComponent(name),
      };

      if (compare === 'true') {
        setCompareMode(true);
      } else {
        handleLocationSelect(urlLocation);
      }
    }
  }, []);

  const handleLocationSelect = async (selectedLocation: Location) => {
    if (compareMode) {
      if (!location1) {
        setIsAnalyzingCompare(1);
        try {
          const fetchedOsmData = await fetchOSMData(selectedLocation.lat, selectedLocation.lon);
          const calculatedMetrics = calculateMetrics(fetchedOsmData, selectedLocation.lat, selectedLocation.lon);
          const quality = assessDataQuality(fetchedOsmData);

          setLocation1({
            location: selectedLocation,
            metrics: calculatedMetrics,
            quality,
            osmData: fetchedOsmData,
          });
        } catch (error) {
          console.error('Analysis failed:', error);
          alert('Failed to analyze location 1. Please try again.');
        } finally {
          setIsAnalyzingCompare(null);
        }
      } else if (!location2) {
        setIsAnalyzingCompare(2);
        try {
          const fetchedOsmData = await fetchOSMData(selectedLocation.lat, selectedLocation.lon);
          const calculatedMetrics = calculateMetrics(fetchedOsmData, selectedLocation.lat, selectedLocation.lon);
          const quality = assessDataQuality(fetchedOsmData);

          setLocation2({
            location: selectedLocation,
            metrics: calculatedMetrics,
            quality,
            osmData: fetchedOsmData,
          });
        } catch (error) {
          console.error('Analysis failed:', error);
          alert('Failed to analyze location 2. Please try again.');
        } finally {
          setIsAnalyzingCompare(null);
        }
      }
    } else {
      setLocation(selectedLocation);
      setIsAnalyzing(true);
      setMetrics(null);

      try {
        const fetchedOsmData = await fetchOSMData(selectedLocation.lat, selectedLocation.lon);
        const calculatedMetrics = calculateMetrics(fetchedOsmData, selectedLocation.lat, selectedLocation.lon);
        const quality = assessDataQuality(fetchedOsmData);

        setOsmData(fetchedOsmData);
        setMetrics(calculatedMetrics);
        setDataQuality(quality);

        // Update URL with current location (shareable link)
        const url = new URL(window.location.href);
        url.searchParams.set('lat', selectedLocation.lat.toString());
        url.searchParams.set('lon', selectedLocation.lon.toString());
        url.searchParams.set('name', encodeURIComponent(selectedLocation.displayName));
        window.history.pushState({}, '', url);

        // Fetch satellite/elevation data in background (progressive enhancement)
        fetchAndUpdateSatelliteData(selectedLocation, fetchedOsmData);
      } catch (error) {
        console.error('Analysis failed:', error);
        alert('Failed to analyze location. Please try again.');
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleCompareMode = () => {
    setCompareMode(true);
    setLocation(null);
    setMetrics(null);
    setDataQuality(null);
    setOsmData(null);
  };

  const handleExitCompareMode = () => {
    setCompareMode(false);
    setLocation1(null);
    setLocation2(null);

    // Clear URL params
    window.history.pushState({}, '', window.location.pathname);
  };

  // Fetch satellite and elevation data (runs after initial analysis)
  const fetchAndUpdateSatelliteData = async (
    selectedLocation: Location,
    currentOsmData: OSMData
  ) => {
    let slopeScore: number | undefined;
    let treeCanopyScore: number | undefined;
    let surfaceTempScore: number | undefined;

    // Fetch slope data (SRTM elevation)
    try {
      const elevations = await fetchElevationProfile(
        selectedLocation.lat,
        selectedLocation.lon,
        800
      );

      const avgSlope = calculateSlope(elevations, 800);
      const maxSlope = calculateMaxSlope(elevations, 800);
      slopeScore = scoreSlopeForWalkability(avgSlope, maxSlope);

      // Update metrics with slope
      const updatedMetrics = calculateMetrics(
        currentOsmData,
        selectedLocation.lat,
        selectedLocation.lon,
        slopeScore,
        treeCanopyScore,
        surfaceTempScore
      );
      setMetrics(updatedMetrics);
    } catch (error) {
      console.error('Failed to fetch slope data:', error);
      // Silently fail - slope metric remains at 0
    }

    // Fetch tree canopy data (Sentinel-2 NDVI)
    try {
      const ndvi = await fetchNDVI(selectedLocation.lat, selectedLocation.lon);

      if (ndvi !== null) {
        treeCanopyScore = scoreTreeCanopy(ndvi);

        // Recalculate metrics with tree canopy included
        const updatedMetrics = calculateMetrics(
          currentOsmData,
          selectedLocation.lat,
          selectedLocation.lon,
          slopeScore,
          treeCanopyScore,
          surfaceTempScore
        );
        setMetrics(updatedMetrics);
      }
    } catch (error) {
      console.error('Failed to fetch tree canopy data:', error);
      // Silently fail - tree canopy metric remains at 0
    }

    // Fetch surface temperature data (Landsat thermal via backend)
    try {
      const result = await fetchSurfaceTemperature(
        selectedLocation.lat,
        selectedLocation.lon
      );

      if (result !== null) {
        surfaceTempScore = result.score;

        // Recalculate metrics with surface temp included
        const updatedMetrics = calculateMetrics(
          currentOsmData,
          selectedLocation.lat,
          selectedLocation.lon,
          slopeScore,
          treeCanopyScore,
          surfaceTempScore
        );
        setMetrics(updatedMetrics);
      }
    } catch (error) {
      console.error('Failed to fetch surface temperature data:', error);
      // Silently fail - surface temp metric remains at 0
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
        {/* Mode Toggle */}
        {!compareMode && location && metrics && (
          <div className="mb-6 flex justify-center">
            <button
              onClick={handleCompareMode}
              className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: COLORS.accent }}
            >
              📊 Compare with Another Location
            </button>
          </div>
        )}

        {compareMode && (
          <div className="mb-6 flex justify-center gap-4">
            <button
              onClick={handleExitCompareMode}
              className="px-6 py-3 rounded-xl font-semibold bg-gray-200 text-gray-700 transition-all hover:bg-gray-300"
            >
              ← Exit Compare Mode
            </button>
            {location1 && location2 && (
              <button
                onClick={() => {
                  setLocation1(null);
                  setLocation2(null);
                }}
                className="px-6 py-3 rounded-xl font-semibold bg-gray-200 text-gray-700 transition-all hover:bg-gray-300"
              >
                🔄 Reset Comparison
              </button>
            )}
          </div>
        )}

        {/* Address Search */}
        {compareMode ? (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Location 1 {location1 && '✓'}
                </label>
                <AddressInput
                  onSelect={handleLocationSelect}
                  placeholder="Enter first address..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Location 2 {location2 && '✓'}
                </label>
                <AddressInput
                  onSelect={handleLocationSelect}
                  placeholder="Enter second address..."
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <AddressInput
              onSelect={handleLocationSelect}
              placeholder="Enter any address worldwide..."
            />
          </div>
        )}

        {/* Compare Mode Loading */}
        {compareMode && isAnalyzingCompare && (
          <div className="flex flex-col items-center py-16">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-600">Analyzing location {isAnalyzingCompare}...</p>
            <p className="text-sm text-gray-500">Fetching OpenStreetMap data</p>
          </div>
        )}

        {/* Compare Mode Results */}
        {compareMode && location1 && location2 && !isAnalyzingCompare && (
          <CompareView
            location1={location1.location}
            metrics1={location1.metrics}
            quality1={location1.quality}
            location2={location2.location}
            metrics2={location2.metrics}
            quality2={location2.quality}
          />
        )}

        {/* Single Location Loading */}
        {!compareMode && isAnalyzing && (
          <div className="flex flex-col items-center py-16">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-600">Analyzing walkability...</p>
            <p className="text-sm text-gray-500">Fetching OpenStreetMap data</p>
          </div>
        )}

        {/* Single Location Results */}
        {!compareMode && location && metrics && !isAnalyzing && (
          <div className="space-y-8">
            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <Map location={location} osmData={osmData} />
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

            {/* Share Buttons */}
            <ShareButtons location={location} metrics={metrics} dataQuality={dataQuality || undefined} />

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

        {!compareMode && !location && !isAnalyzing && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚶</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Check Your Neighborhood
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-6">
              Get honest walkability analysis based on real OpenStreetMap data.
              We only show metrics we can verify — no fake estimates.
            </p>
            <button
              onClick={handleCompareMode}
              className="px-6 py-3 rounded-xl font-semibold transition-all hover:shadow-lg"
              style={{ backgroundColor: COLORS.accent, color: 'white' }}
            >
              Or Compare Two Locations
            </button>
          </div>
        )}

        {compareMode && !location1 && !isAnalyzingCompare && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Compare Two Locations
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Enter two addresses to compare their walkability side-by-side.
              See which location performs better in each metric.
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
