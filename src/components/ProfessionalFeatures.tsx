/**
 * Professional Tier Features Component
 * Displays advanced analyses for $79 Professional tier
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Location } from '../types';
import { calculate15MinuteCityScore, type FifteenMinuteCityScore } from '../services/fifteenMinuteCity';
import { analyzeBuildingDensity, type BuildingDensityAnalysis } from '../services/buildingDensity';
import { analyzeTransitAccess, type TransitAccessAnalysis } from '../services/transitAccess';
import { analyzeADAAccessibility, type ADAAccessibilityReport } from '../services/adaAccessibility';
import { analyzeStreetLighting, type StreetLightingAnalysis } from '../services/streetLighting';

interface ProfessionalFeaturesProps {
  location: Location;
  isProfessional: boolean;
  onUpgradeClick: () => void;
}

export default function ProfessionalFeatures({
  location,
  isProfessional,
  onUpgradeClick
}: ProfessionalFeaturesProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [fifteenMinCity, setFifteenMinCity] = useState<FifteenMinuteCityScore | null>(null);
  const [buildingDensity, setBuildingDensity] = useState<BuildingDensityAnalysis | null>(null);
  const [transitAccess, setTransitAccess] = useState<TransitAccessAnalysis | null>(null);
  const [adaReport, setAdaReport] = useState<ADAAccessibilityReport | null>(null);
  const [lighting, setLighting] = useState<StreetLightingAnalysis | null>(null);

  // Report generation functions
  const reportRoutes: Record<string, string> = {
    fifteenMinuteCity: '15-minute-city',
    buildingDensity: 'building-density',
    transitAccess: 'transit-access',
    adaAccessibility: 'ada-accessibility',
    streetLighting: 'street-lighting'
  };

  const generateReport = (reportType: string, data: Record<string, unknown>) => {
    const locationData = {
      displayName: location.displayName,
      lat: location.lat,
      lon: location.lon
    };

    sessionStorage.setItem(`${reportType}Report`, JSON.stringify({
      ...data,
      location: locationData
    }));

    navigate(`/report/${reportRoutes[reportType] || reportType}`);
  };

  const generateFullReport = () => {
    if (!fifteenMinCity || !buildingDensity || !transitAccess || !adaReport || !lighting) return;

    const locationData = {
      displayName: location.displayName,
      lat: location.lat,
      lon: location.lon
    };

    sessionStorage.setItem('fullProfessionalReport', JSON.stringify({
      location: locationData,
      fifteenMinCity,
      buildingDensity,
      transitAccess,
      adaAccessibility: adaReport,
      streetLighting: lighting
    }));

    navigate('/report/professional-full');
  };

  useEffect(() => {
    if (isProfessional) {
      loadProfessionalAnalyses();
    }
  }, [isProfessional, location.lat, location.lon]);

  const loadProfessionalAnalyses = async () => {
    setIsLoading(true);
    try {
      const [cityScore, density, transit, ada, lights] = await Promise.all([
        calculate15MinuteCityScore(location.lat, location.lon),
        analyzeBuildingDensity(location.lat, location.lon),
        analyzeTransitAccess(location.lat, location.lon),
        analyzeADAAccessibility(location.lat, location.lon),
        analyzeStreetLighting(location.lat, location.lon)
      ]);

      setFifteenMinCity(cityScore);
      setBuildingDensity(density);
      setTransitAccess(transit);
      setAdaReport(ada);
      setLighting(lights);
    } catch (error) {
      console.error('Failed to load professional analyses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show upgrade prompt if not professional
  if (!isProfessional) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4">🏢</div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3">
          Professional Tier Features
        </h3>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          Unlock advanced analyses including 15-Minute City Score, Building Density with FAR,
          Transit Access, ADA Accessibility Report, and Street Lighting Safety.
        </p>
        <button
          onClick={onUpgradeClick}
          className="px-8 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all hover:shadow-lg"
        >
          Upgrade to Professional - $79
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading professional analyses...</p>
      </div>
    );
  }

  // Check if all data is loaded for full report
  const allDataLoaded = fifteenMinCity && buildingDensity && transitAccess && adaReport && lighting;

  return (
    <div className="space-y-6">
      {/* Full Report Button */}
      {allDataLoaded && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">📊 Full Professional Analysis</h3>
              <p className="text-indigo-100">Generate comprehensive 7-page PDF report with all metrics</p>
            </div>
            <button
              onClick={generateFullReport}
              className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-lg"
            >
              Generate Full Report
            </button>
          </div>
        </div>
      )}

      {/* 15-Minute City Score */}
      {fifteenMinCity && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>🏘️</span>
              15-Minute City Score
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-purple-600">
                {fifteenMinCity.overallScore}/100
              </div>
              <button
                onClick={() => generateReport('fifteenMinuteCity', { score: fifteenMinCity })}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 font-medium rounded-lg hover:bg-indigo-200 transition-colors text-sm"
              >
                📄 Report
              </button>
            </div>
          </div>

          <p className="text-gray-600 mb-4">{fifteenMinCity.summary}</p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {Object.entries(fifteenMinCity.serviceScores).map(([key, service]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700 capitalize">{key}</span>
                  <span className={`text-sm font-bold ${service.available ? 'text-green-600' : 'text-red-600'}`}>
                    {service.available ? '✓' : '✗'}
                  </span>
                </div>
                {service.available && (
                  <div className="text-sm text-gray-600">
                    <div>{service.count} location{service.count !== 1 ? 's' : ''}</div>
                    <div>Nearest: {service.nearestDistance}m away</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {fifteenMinCity.missingServices.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800">
                Missing services: {fifteenMinCity.missingServices.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Building Density */}
      {buildingDensity && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>🏗️</span>
              Building Density (FAR)
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-purple-600">
                {buildingDensity.far}
              </div>
              <button
                onClick={() => generateReport('buildingDensity', { density: buildingDensity })}
                className="px-4 py-2 bg-orange-100 text-orange-700 font-medium rounded-lg hover:bg-orange-200 transition-colors text-sm"
              >
                📄 Report
              </button>
            </div>
          </div>

          <p className="text-gray-600 mb-4">{buildingDensity.densityCategory}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{buildingDensity.totalBuildings}</div>
              <div className="text-xs text-gray-600">Buildings</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{buildingDensity.buildingsPerHectare}</div>
              <div className="text-xs text-gray-600">Per Hectare</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{buildingDensity.averageHeight}m</div>
              <div className="text-xs text-gray-600">Avg Height</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{buildingDensity.averageFloors}</div>
              <div className="text-xs text-gray-600">Avg Floors</div>
            </div>
          </div>
        </div>
      )}

      {/* Transit Access */}
      {transitAccess && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>🚇</span>
              Transit Access
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-purple-600">
                {transitAccess.overallScore}/100
              </div>
              <button
                onClick={() => generateReport('transitAccess', { transit: transitAccess })}
                className="px-4 py-2 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 transition-colors text-sm"
              >
                📄 Report
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-gray-600 mb-2">{transitAccess.carFreeFeasibility}</p>
            {transitAccess.nearestStopDistance >= 0 && (
              <p className="text-sm text-gray-500">
                Nearest stop: {transitAccess.nearestStopDistance}m away
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {Object.entries(transitAccess.coverage).map(([type, available]) => (
              <div
                key={type}
                className={`text-center p-2 rounded-lg ${available ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}
              >
                <div className="text-xs font-medium capitalize">{type}</div>
                <div className="text-lg">{available ? '✓' : '✗'}</div>
              </div>
            ))}
          </div>

          {transitAccess.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800 mb-1">Recommendations:</p>
              <ul className="text-sm text-blue-700 space-y-1">
                {transitAccess.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ADA Accessibility */}
      {adaReport && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>♿</span>
              ADA Accessibility
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-purple-600">
                {adaReport.overallScore}/100
              </div>
              <button
                onClick={() => generateReport('adaAccessibility', { ada: adaReport })}
                className="px-4 py-2 bg-teal-100 text-teal-700 font-medium rounded-lg hover:bg-teal-200 transition-colors text-sm"
              >
                📄 Report
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${adaReport.wheelchairFriendly ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span className="text-lg">{adaReport.wheelchairFriendly ? '✓' : '✗'}</span>
              <span className="font-medium">
                {adaReport.wheelchairFriendly ? 'Wheelchair Friendly' : 'Not Wheelchair Friendly'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Compliant Routes</div>
              <div className="text-2xl font-bold text-gray-800">{adaReport.compliantRoutes}%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Avg Slope</div>
              <div className="text-2xl font-bold text-gray-800">{adaReport.averageSlope}%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Max Slope</div>
              <div className="text-2xl font-bold text-gray-800">{adaReport.maxSlope}%</div>
            </div>
          </div>

          {adaReport.violations.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">
                {adaReport.violations.length} slope violations detected
              </p>
              <p className="text-xs text-red-600 mt-1">
                ADA standard: Maximum 5% slope for wheelchair accessibility
              </p>
            </div>
          )}
        </div>
      )}

      {/* Street Lighting */}
      {lighting && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>💡</span>
              Street Lighting Safety
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-purple-600">
                {lighting.overallScore}/100
              </div>
              <button
                onClick={() => generateReport('streetLighting', { lighting })}
                className="px-4 py-2 bg-amber-100 text-amber-700 font-medium rounded-lg hover:bg-amber-200 transition-colors text-sm"
              >
                📄 Report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{lighting.litStreets}</div>
              <div className="text-xs text-gray-600">Lit Streets</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{lighting.unlitStreets}</div>
              <div className="text-xs text-gray-600">Unlit Streets</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{lighting.coveragePercent}%</div>
              <div className="text-xs text-gray-600">Coverage</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{lighting.lightingDensity}</div>
              <div className="text-xs text-gray-600">Lamps/km</div>
            </div>
          </div>

          {lighting.darkSpots.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                {lighting.darkSpots.length} dark spots identified
              </p>
              <ul className="text-xs text-yellow-700 space-y-1">
                {lighting.darkSpots.slice(0, 3).map((spot, i) => (
                  <li key={i}>
                    • {spot.streetName} ({spot.length}m) - {spot.severity} priority
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
