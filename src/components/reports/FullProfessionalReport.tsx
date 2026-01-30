/**
 * Full Professional Analysis Report
 * Combined comprehensive report with all 5 Professional features
 * ~7-8 page document for print/PDF export
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FifteenMinuteCityScore } from '../../services/fifteenMinuteCity';
import type { BuildingDensityAnalysis } from '../../services/buildingDensity';
import type { TransitAccessAnalysis } from '../../services/transitAccess';
import type { ADAAccessibilityReport } from '../../services/adaAccessibility';
import type { StreetLightingAnalysis } from '../../services/streetLighting';
import {
  ReportHeader,
  ScoreHero,
  MetricCard,
  DataSourceFooter,
  PrintStyles,
  AvoidBreak
} from './shared';

interface ReportData {
  location: {
    displayName: string;
    lat: number;
    lon: number;
  };
  fifteenMinCity: FifteenMinuteCityScore;
  buildingDensity: BuildingDensityAnalysis;
  transitAccess: TransitAccessAnalysis;
  adaAccessibility: ADAAccessibilityReport;
  streetLighting: StreetLightingAnalysis;
}

// Service icons for 15-minute city
const serviceIcons: Record<string, string> = {
  grocery: '🛒', healthcare: '🏥', education: '📚',
  recreation: '🌳', transit: '🚌', dining: '🍽️'
};

export default function FullProfessionalReport() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('fullProfessionalReport');
    if (stored) {
      setData(JSON.parse(stored));
    }
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Report Data</h1>
          <p className="text-gray-600 mb-4">Please generate a report from the analysis page first.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Go to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { location, fifteenMinCity, buildingDensity, transitAccess, adaAccessibility, streetLighting } = data;

  // Calculate overall professional grade
  const overallGrade = Math.round(
    (fifteenMinCity.overallScore +
     (buildingDensity.far >= 0.5 ? Math.min(buildingDensity.far * 25, 100) : buildingDensity.far * 50) +
     transitAccess.overallScore +
     adaAccessibility.overallScore +
     streetLighting.overallScore) / 5
  );

  return (
    <div className="min-h-screen bg-white">
      <PrintStyles />

      {/* Print Button */}
      <div className="fixed top-4 right-4 z-50 flex gap-3 no-print">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* PAGE 1: Executive Summary Dashboard */}
      <div className="page-break p-8 print:p-6">
        <ReportHeader
          title="Professional Urban Analysis"
          subtitle="Comprehensive Walkability & Livability Assessment"
          location={location}
          accentColor="from-indigo-600 to-purple-600"
        />

        <div className="mt-8">
          {/* Overall Grade */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Professional Grade Summary</h2>

            <div className="flex justify-center mb-8">
              <ScoreHero
                score={overallGrade}
                label="Overall Grade"
                sublabel="Composite of all metrics"
                size="lg"
              />
            </div>

            {/* 5 Score Cards in a Row */}
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <ScoreHero score={fifteenMinCity.overallScore} label="15-Min City" size="sm" showEmoji={false} />
              </div>
              <div className="text-center">
                <div className="flex flex-col items-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                    buildingDensity.far >= 1.5 ? 'bg-purple-100' :
                    buildingDensity.far >= 0.5 ? 'bg-blue-100' : 'bg-emerald-100'
                  }`}>
                    <span className={`text-3xl font-bold ${
                      buildingDensity.far >= 1.5 ? 'text-purple-600' :
                      buildingDensity.far >= 0.5 ? 'text-blue-600' : 'text-emerald-600'
                    }`}>{buildingDensity.far}</span>
                  </div>
                  <div className="mt-2 font-semibold text-gray-700 text-sm">FAR</div>
                </div>
              </div>
              <div className="text-center">
                <ScoreHero score={transitAccess.overallScore} label="Transit" size="sm" showEmoji={false} />
              </div>
              <div className="text-center">
                <ScoreHero score={adaAccessibility.overallScore} label="ADA" size="sm" showEmoji={false} />
              </div>
              <div className="text-center">
                <ScoreHero score={streetLighting.overallScore} label="Lighting" size="sm" showEmoji={false} />
              </div>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
            Key Findings
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl ${fifteenMinCity.missingServices.length === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <div className="text-2xl mb-2">🏘️</div>
              <div className="font-bold text-gray-800">15-Minute City</div>
              <div className="text-sm text-gray-600">
                {fifteenMinCity.missingServices.length === 0
                  ? 'All essential services nearby'
                  : `Missing: ${fifteenMinCity.missingServices.slice(0, 2).join(', ')}`}
              </div>
            </div>

            <div className={`p-4 rounded-xl ${
              buildingDensity.far >= 0.5 ? 'bg-blue-50' : 'bg-gray-50'
            }`}>
              <div className="text-2xl mb-2">🏗️</div>
              <div className="font-bold text-gray-800">Building Density</div>
              <div className="text-sm text-gray-600">{buildingDensity.densityCategory}</div>
            </div>

            <div className={`p-4 rounded-xl ${
              transitAccess.overallScore >= 60 ? 'bg-emerald-50' : 'bg-amber-50'
            }`}>
              <div className="text-2xl mb-2">🚇</div>
              <div className="font-bold text-gray-800">Transit Access</div>
              <div className="text-sm text-gray-600">{transitAccess.carFreeFeasibility.split(' - ')[0]}</div>
            </div>

            <div className={`p-4 rounded-xl ${
              adaAccessibility.wheelchairFriendly ? 'bg-emerald-50' : 'bg-amber-50'
            }`}>
              <div className="text-2xl mb-2">♿</div>
              <div className="font-bold text-gray-800">ADA Accessibility</div>
              <div className="text-sm text-gray-600">
                {adaAccessibility.wheelchairFriendly ? 'Wheelchair Friendly' : `${adaAccessibility.violations.length} issues found`}
              </div>
            </div>

            <div className={`p-4 rounded-xl ${
              streetLighting.coveragePercent >= 70 ? 'bg-emerald-50' : 'bg-amber-50'
            }`}>
              <div className="text-2xl mb-2">💡</div>
              <div className="font-bold text-gray-800">Street Lighting</div>
              <div className="text-sm text-gray-600">{streetLighting.coveragePercent}% coverage</div>
            </div>

            <div className={`p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50`}>
              <div className="text-2xl mb-2">⭐</div>
              <div className="font-bold text-gray-800">Overall Assessment</div>
              <div className="text-sm text-gray-600">
                {overallGrade >= 80 ? 'Excellent livability' :
                 overallGrade >= 60 ? 'Good with improvements needed' :
                 overallGrade >= 40 ? 'Fair - significant gaps' : 'Needs major improvements'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2: 15-Minute City Analysis */}
      <div className="page-break p-8 print:p-6">
        <div className="border-b-4 border-indigo-500 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-3xl">🏘️</span>
            15-Minute City Analysis
          </h2>
          <p className="text-gray-600">Essential services within walking distance</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-lg text-gray-700">{fifteenMinCity.summary}</p>
          </div>
          <ScoreHero score={fifteenMinCity.overallScore} label="Score" size="md" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(fifteenMinCity.serviceScores).map(([key, service]) => (
            <AvoidBreak key={key}>
              <div className={`rounded-xl p-4 border-2 ${service.available ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{serviceIcons[key]}</span>
                  <div>
                    <div className="font-bold text-gray-800 capitalize">{key}</div>
                    <div className="text-xs text-gray-500">
                      {service.available ? `${service.count} found, ${service.nearestDistance}m away` : 'Not available'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-2 flex-1 bg-gray-200 rounded-full mr-3">
                    <div
                      className={`h-full rounded-full ${service.score >= 75 ? 'bg-emerald-500' : service.score >= 50 ? 'bg-blue-500' : service.score >= 25 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${service.score}%` }}
                    />
                  </div>
                  <span className="font-bold text-gray-700">{service.score}</span>
                </div>
              </div>
            </AvoidBreak>
          ))}
        </div>

        {fifteenMinCity.missingServices.length > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="font-bold text-red-800 mb-2">⚠️ Missing Services</h4>
            <div className="flex flex-wrap gap-2">
              {fifteenMinCity.missingServices.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PAGE 3: Building Density Analysis */}
      <div className="page-break p-8 print:p-6">
        <div className="border-b-4 border-orange-500 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-3xl">🏗️</span>
            Building Density Analysis
          </h2>
          <p className="text-gray-600">Floor Area Ratio and urban form</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-5xl font-bold text-orange-600 mb-2">{buildingDensity.far}</div>
            <div className="text-lg text-gray-700">{buildingDensity.densityCategory}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard icon="🏢" label="Buildings" value={buildingDensity.totalBuildings} color="blue" />
            <MetricCard icon="📏" label="Avg Height" value={`${buildingDensity.averageHeight}m`} color="amber" />
          </div>
        </div>

        {/* Density Scale */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex h-8 rounded-full overflow-hidden">
            <div className="flex-1 bg-emerald-400 text-white text-xs flex items-center justify-center">Low</div>
            <div className="flex-1 bg-blue-400 text-white text-xs flex items-center justify-center">Medium</div>
            <div className="flex-1 bg-orange-400 text-white text-xs flex items-center justify-center">High</div>
            <div className="flex-1 bg-purple-500 text-white text-xs flex items-center justify-center">Very High</div>
          </div>
          <div
            className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-800 mx-auto mt-2"
            style={{ marginLeft: `${Math.min((buildingDensity.far / 4) * 100, 95)}%` }}
          />
        </div>

        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-gray-700">
            {buildingDensity.far < 0.5 && 'Low-density suburban area. Car-dependent with limited walkability.'}
            {buildingDensity.far >= 0.5 && buildingDensity.far < 1.5 && 'Medium-density urban residential. Supports walkable neighborhoods and transit.'}
            {buildingDensity.far >= 1.5 && buildingDensity.far < 3.0 && 'High-density mixed-use. Excellent for pedestrian activity and public transit.'}
            {buildingDensity.far >= 3.0 && 'Very high-density downtown core. Maximum walkability and transit efficiency.'}
          </p>
        </div>
      </div>

      {/* PAGE 4: Transit Access Analysis */}
      <div className="page-break p-8 print:p-6">
        <div className="border-b-4 border-purple-500 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-3xl">🚇</span>
            Transit Access Analysis
          </h2>
          <p className="text-gray-600">Public transportation accessibility</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-lg text-gray-700 mb-3">{transitAccess.carFreeFeasibility}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(transitAccess.coverage).map(([type, available]) => (
                <span
                  key={type}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    available ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} {available ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
          <ScoreHero score={transitAccess.overallScore} label="Score" size="md" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard
            icon="📍"
            label="Nearest Stop"
            value={transitAccess.nearestStopDistance >= 0 ? `${transitAccess.nearestStopDistance}m` : 'N/A'}
            color="purple"
          />
          <MetricCard icon="🚏" label="Stops < 500m" value={transitAccess.stopsWithin500m} color="blue" />
          <MetricCard icon="🔄" label="Transit Types" value={transitAccess.transitTypes.length} color="green" />
        </div>

        {transitAccess.recommendations.length > 0 && (
          <div className="bg-purple-50 rounded-xl p-4">
            <h4 className="font-bold text-purple-800 mb-2">Recommendations</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              {transitAccess.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* PAGE 5: ADA Accessibility Analysis */}
      <div className="page-break p-8 print:p-6">
        <div className="border-b-4 border-teal-500 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-3xl">♿</span>
            ADA Accessibility Analysis
          </h2>
          <p className="text-gray-600">Wheelchair accessibility and slope compliance</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3 ${
              adaAccessibility.wheelchairFriendly ? 'bg-emerald-100' : 'bg-amber-100'
            }`}>
              <span className="text-2xl">{adaAccessibility.wheelchairFriendly ? '♿✓' : '♿⚠️'}</span>
              <span className={`font-bold ${adaAccessibility.wheelchairFriendly ? 'text-emerald-700' : 'text-amber-700'}`}>
                {adaAccessibility.wheelchairFriendly ? 'Wheelchair Friendly' : 'Accessibility Concerns'}
              </span>
            </div>
            <p className="text-gray-700">
              {adaAccessibility.compliantRoutes}% of routes meet ADA standards
            </p>
          </div>
          <ScoreHero score={adaAccessibility.overallScore} label="Score" size="md" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard icon="✓" label="Compliant" value={`${adaAccessibility.compliantRoutes}%`} color={adaAccessibility.compliantRoutes >= 80 ? 'green' : 'amber'} />
          <MetricCard icon="📐" label="Avg Slope" value={`${adaAccessibility.averageSlope}%`} color={adaAccessibility.averageSlope <= 5 ? 'blue' : 'orange'} />
          <MetricCard icon="⚠️" label="Violations" value={adaAccessibility.violations.length} color={adaAccessibility.violations.length === 0 ? 'green' : 'red'} />
        </div>

        {adaAccessibility.violations.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-4">
            <h4 className="font-bold text-amber-800 mb-2">
              Violations: {adaAccessibility.violations.filter(v => v.severity === 'Severe').length} severe,{' '}
              {adaAccessibility.violations.filter(v => v.severity === 'Moderate').length} moderate,{' '}
              {adaAccessibility.violations.filter(v => v.severity === 'Minor').length} minor
            </h4>
            <p className="text-sm text-amber-700">
              ADA requires maximum 5% slope (1:20 ratio). {adaAccessibility.rampLocations.length} priority locations for ramp installation.
            </p>
          </div>
        )}
      </div>

      {/* PAGE 6: Street Lighting Analysis */}
      <div className="page-break p-8 print:p-6">
        <div className="border-b-4 border-amber-500 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-3xl">💡</span>
            Street Lighting Analysis
          </h2>
          <p className="text-gray-600">Nighttime pedestrian safety</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-5xl font-bold text-amber-600 mb-2">{streetLighting.coveragePercent}%</div>
            <div className="text-lg text-gray-700">Streets with lighting coverage</div>
          </div>
          <div className="flex gap-4">
            <ScoreHero score={streetLighting.overallScore} label="Overall" size="sm" />
            <ScoreHero score={streetLighting.nighttimeSafetyScore} label="Safety" size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard icon="✓" label="Lit Streets" value={streetLighting.litStreets} color="green" />
          <MetricCard icon="✗" label="Unlit" value={streetLighting.unlitStreets} color="red" />
          <MetricCard icon="💡" label="Density" value={`${streetLighting.lightingDensity}/km`} color="amber" />
          <MetricCard icon="🌙" label="Dark Spots" value={streetLighting.darkSpots.length} color={streetLighting.darkSpots.length === 0 ? 'green' : 'orange'} />
        </div>

        {streetLighting.darkSpots.length > 0 && (
          <div className="bg-red-50 rounded-xl p-4">
            <h4 className="font-bold text-red-800 mb-2">🚨 Priority Dark Spots</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {streetLighting.darkSpots.slice(0, 4).map((spot, i) => (
                <div key={i} className="bg-white rounded p-2">
                  <span className="font-medium">{spot.streetName}</span>
                  <span className="text-gray-500 ml-2">{spot.length}m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PAGE 7: Combined Recommendations */}
      <div className="page-break p-8 print:p-6">
        <div className="border-b-4 border-indigo-500 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-3xl">📋</span>
            Combined Recommendations
          </h2>
          <p className="text-gray-600">Priority actions across all analysis areas</p>
        </div>

        {/* Priority Matrix */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Priority Action Matrix</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* High Impact / Quick Wins */}
            <div className="bg-emerald-50 rounded-xl p-4">
              <h4 className="font-bold text-emerald-800 mb-3">⚡ Quick Wins</h4>
              <ul className="text-sm text-emerald-700 space-y-2">
                {streetLighting.coveragePercent < 70 && (
                  <li>• Install LED lights on priority dark spots</li>
                )}
                {transitAccess.overallScore < 60 && (
                  <li>• Advocate for additional bus routes</li>
                )}
                {adaAccessibility.violations.length > 0 && (
                  <li>• Install ramps at severe slope violations</li>
                )}
                {fifteenMinCity.missingServices.length > 0 && (
                  <li>• Identify sites for missing services</li>
                )}
              </ul>
            </div>

            {/* Strategic Improvements */}
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-bold text-blue-800 mb-3">🎯 Strategic Improvements</h4>
              <ul className="text-sm text-blue-700 space-y-2">
                {buildingDensity.far < 0.5 && (
                  <li>• Support gentle density increases</li>
                )}
                {transitAccess.transitTypes.length < 2 && (
                  <li>• Explore additional transit modes</li>
                )}
                {adaAccessibility.compliantRoutes < 80 && (
                  <li>• Comprehensive sidewalk grading plan</li>
                )}
                <li>• Create connected pedestrian network</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Overall Assessment */}
        <div className={`rounded-xl p-6 mb-6 ${
          overallGrade >= 70 ? 'bg-emerald-50' :
          overallGrade >= 50 ? 'bg-blue-50' : 'bg-amber-50'
        }`}>
          <h3 className="text-lg font-bold text-gray-800 mb-3">📊 Overall Assessment</h3>
          <p className="text-gray-700 leading-relaxed">
            {overallGrade >= 80 && (
              <>This location demonstrates <strong>excellent urban livability</strong>. All essential services are accessible, transit is comprehensive, and the built environment supports walking and accessibility. Minor improvements can further enhance the pedestrian experience.</>
            )}
            {overallGrade >= 60 && overallGrade < 80 && (
              <>This location shows <strong>good livability potential</strong> with some areas needing improvement. Focus on addressing identified gaps in transit access, lighting coverage, or accessibility to create a more complete walkable neighborhood.</>
            )}
            {overallGrade >= 40 && overallGrade < 60 && (
              <>This location has <strong>moderate livability</strong> with significant improvement opportunities. Strategic investments in infrastructure, particularly in the lowest-scoring areas, can substantially improve pedestrian experience and accessibility.</>
            )}
            {overallGrade < 40 && (
              <>This location currently has <strong>limited walkability</strong> and requires comprehensive improvements. Prioritize establishing basic pedestrian infrastructure, transit access, and essential services to support car-free living options.</>
            )}
          </p>
        </div>

        <DataSourceFooter
          sources={[
            { name: 'OpenStreetMap', description: 'Infrastructure, POIs, and transit data' },
            { name: 'Overpass API', description: 'Geospatial data queries' },
            { name: 'Open-Elevation API', description: 'Terrain elevation data' },
            { name: 'ADA Standards', description: 'Accessibility compliance guidelines' }
          ]}
          methodology="This comprehensive analysis combines five specialized assessments covering essential services (15-minute city), building density (FAR), public transit access, ADA accessibility (slope analysis), and street lighting safety. Each metric uses authoritative open data sources and standardized evaluation criteria."
        />
      </div>
    </div>
  );
}
