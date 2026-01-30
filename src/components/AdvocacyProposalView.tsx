/**
 * Advocacy Proposal View - Professional HTML Report
 * Comprehensive one-page proposal for presenting to city officials
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Location, WalkabilityMetrics } from '../types';

interface ProposalData {
  location: Location;
  metrics: WalkabilityMetrics;
  proposalTitle?: string;
  authorName?: string;
}

export default function AdvocacyProposalView() {
  const [searchParams] = useSearchParams();
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);

  useEffect(() => {
    const dataStr = sessionStorage.getItem('advocacyProposalData');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setProposalData(data);
      } catch (e) {
        console.error('Failed to parse proposal data:', e);
      }
    }
  }, [searchParams]);

  if (!proposalData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">No Proposal Data</h1>
          <p className="text-gray-600">Please generate a proposal from the main analysis page.</p>
          <a href="/" className="mt-4 inline-block text-orange-500 hover:underline">
            ← Back to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  const { location, metrics, proposalTitle, authorName } = proposalData;
  const score = metrics.overallScore;
  const cityName = location.city || location.displayName.split(',')[0];
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-amber-500';
    if (score >= 4) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-amber-500';
    if (score >= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return { label: 'Excellent', desc: 'meets international standards' };
    if (score >= 6) return { label: 'Good', desc: 'above average with room for improvement' };
    if (score >= 4) return { label: 'Fair', desc: 'significant improvements needed' };
    return { label: 'Poor', desc: 'urgent intervention required' };
  };

  const getBadgeStyle = (score: number) => {
    if (score >= 7) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 5) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  // Get metrics with detailed recommendations
  const metricsArray = [
    {
      name: 'Street Network',
      score: metrics.networkEfficiency,
      icon: '🏙️',
      standard: 'NACTO: 80-150m block length',
      issue: 'Poor connectivity forces longer walking distances',
      rec: 'Create mid-block pedestrian passages, improve intersection density',
      impact: 'Reduces average walking distance by 15-25%',
      cost: 'Medium',
    },
    {
      name: 'Daily Destinations',
      score: metrics.destinationAccess,
      icon: '🏪',
      standard: 'WHO: Essential services within 400m',
      issue: 'Residents must drive for basic daily needs',
      rec: 'Incentivize mixed-use development, allow corner stores in residential zones',
      impact: 'Increases walking trips by 30-40%',
      cost: 'Low (policy)',
    },
    {
      name: 'Green Space Access',
      score: metrics.greenSpaceAccess || 0,
      icon: '🌳',
      standard: 'WHO: Green space within 300m of homes',
      issue: 'Limited access to parks affects mental health and physical activity',
      rec: 'Create pocket parks, convert vacant lots, add green corridors',
      impact: 'Improves community health outcomes by 12%',
      cost: 'Medium',
    },
    {
      name: 'Tree Canopy',
      score: metrics.treeCanopy,
      icon: '🌲',
      standard: 'Urban Forestry: 25-40% canopy coverage',
      issue: 'Lack of shade makes walking uncomfortable in warm weather',
      rec: 'Implement street tree planting program, protect existing trees',
      impact: 'Reduces surface temperature by 5-10°C',
      cost: 'Low-Medium',
    },
    {
      name: 'Terrain Accessibility',
      score: metrics.slope,
      icon: '⛰️',
      standard: 'ADA: Max 5% grade for accessible routes',
      issue: 'Steep grades limit accessibility for elderly and disabled',
      rec: 'Add handrails, rest areas, alternative accessible routes',
      impact: 'Increases accessible route coverage by 40%',
      cost: 'Medium',
    },
    {
      name: 'Pedestrian Crossings',
      score: metrics.crossingDensity,
      icon: '🚦',
      standard: 'GSDG: Crossings every 80-100m on arterials',
      issue: 'Insufficient crossings lead to jaywalking and pedestrian injuries',
      rec: 'Add marked crosswalks, pedestrian signals, and curb extensions',
      impact: 'Reduces pedestrian crashes by 25-35%',
      cost: 'Low-Medium',
    },
  ].sort((a, b) => a.score - b.score);

  const problemAreas = metricsArray.slice(0, 3);
  const strengths = metricsArray.slice(-2).reverse();

  // Calculate potential improvement
  const avgProblemScore = problemAreas.reduce((sum, m) => sum + m.score, 0) / 3;
  const potentialImprovement = Math.min(10, score + (7 - avgProblemScore) * 0.5);

  // Economic impact estimates (based on research)
  const economicBenefits = [
    { metric: 'Property Value Increase', value: '5-15%', source: 'Walk Score studies' },
    { metric: 'Retail Sales Increase', value: '20-40%', source: 'NYC DOT research' },
    { metric: 'Healthcare Cost Reduction', value: '$1,200/person/year', source: 'CDC estimates' },
    { metric: 'ROI on Walkability Investment', value: '3:1 to 5:1', source: 'AARP Livable Communities' },
  ];

  // Get country from location for contextual safety stats
  const country = location.country || location.displayName.split(',').pop()?.trim() || '';

  // Country-specific pedestrian safety statistics (WHO Global Status Report on Road Safety)
  const getSafetyStats = (countryName: string) => {
    const countryLower = countryName.toLowerCase();

    // USA
    if (countryLower.includes('united states') || countryLower.includes('usa') || countryLower === 'us') {
      return {
        stats: [
          { stat: '7,522', label: 'Pedestrians killed (2022)', detail: 'Highest in 40+ years' },
          { stat: '20', label: 'Deaths per day', detail: 'National average' },
          { stat: '75%', label: 'At non-intersections', detail: 'Due to lack of crossings' },
          { stat: '74%', label: 'In low-light conditions', detail: 'Poor lighting a factor' },
        ],
        source: 'NHTSA Fatality Analysis Reporting System (FARS), 2022',
        region: 'United States',
      };
    }

    // India
    if (countryLower.includes('india')) {
      return {
        stats: [
          { stat: '19,664', label: 'Pedestrians killed (2022)', detail: 'Highest globally' },
          { stat: '54', label: 'Deaths per day', detail: 'National average' },
          { stat: '60%', label: 'On national highways', detail: 'Lack of footpaths' },
          { stat: '45%', label: 'Age 15-44 years', detail: 'Working age population' },
        ],
        source: 'Ministry of Road Transport & Highways, India (2022)',
        region: 'India',
      };
    }

    // UK
    if (countryLower.includes('united kingdom') || countryLower.includes('uk') || countryLower.includes('england') || countryLower.includes('scotland') || countryLower.includes('wales')) {
      return {
        stats: [
          { stat: '361', label: 'Pedestrians killed (2022)', detail: '22% of road deaths' },
          { stat: '5,930', label: 'Pedestrians injured', detail: 'Seriously injured' },
          { stat: '65%', label: 'In urban areas', detail: 'Higher pedestrian activity' },
          { stat: '40%', label: 'At junctions', detail: 'Crossing locations' },
        ],
        source: 'UK Department for Transport, Road Safety Statistics 2022',
        region: 'United Kingdom',
      };
    }

    // Australia
    if (countryLower.includes('australia')) {
      return {
        stats: [
          { stat: '178', label: 'Pedestrians killed (2022)', detail: '14% of road deaths' },
          { stat: '1 in 7', label: 'Road deaths', detail: 'Are pedestrians' },
          { stat: '75%', label: 'In urban areas', detail: 'Metropolitan zones' },
          { stat: '65+', label: 'Most vulnerable age', detail: 'Elderly at highest risk' },
        ],
        source: 'Australian Road Deaths Database, BITRE 2022',
        region: 'Australia',
      };
    }

    // Canada
    if (countryLower.includes('canada')) {
      return {
        stats: [
          { stat: '333', label: 'Pedestrians killed (2021)', detail: '18% of road deaths' },
          { stat: '2,800', label: 'Pedestrians injured', detail: 'Serious injuries' },
          { stat: '80%', label: 'In urban areas', detail: 'City streets' },
          { stat: '60%', label: 'At intersections', detail: 'Crossing locations' },
        ],
        source: 'Transport Canada, Canadian Motor Vehicle Traffic Collision Statistics 2021',
        region: 'Canada',
      };
    }

    // Germany
    if (countryLower.includes('germany') || countryLower.includes('deutschland')) {
      return {
        stats: [
          { stat: '368', label: 'Pedestrians killed (2022)', detail: '14% of road deaths' },
          { stat: '27,420', label: 'Pedestrians injured', detail: 'Reported injuries' },
          { stat: '70%', label: 'In urban areas', detail: 'City environments' },
          { stat: '35%', label: 'Age 65+', detail: 'Elderly population' },
        ],
        source: 'Statistisches Bundesamt (Destatis), Germany 2022',
        region: 'Germany',
      };
    }

    // European Union (default for European countries)
    if (countryLower.includes('france') || countryLower.includes('spain') || countryLower.includes('italy') ||
        countryLower.includes('netherlands') || countryLower.includes('belgium') || countryLower.includes('portugal') ||
        countryLower.includes('austria') || countryLower.includes('sweden') || countryLower.includes('denmark') ||
        countryLower.includes('finland') || countryLower.includes('ireland') || countryLower.includes('poland')) {
      return {
        stats: [
          { stat: '4,875', label: 'Pedestrians killed (2022)', detail: 'EU-27 total' },
          { stat: '19%', label: 'Of all road deaths', detail: 'Nearly 1 in 5' },
          { stat: '70%', label: 'In urban areas', detail: 'City environments' },
          { stat: '50%', label: 'Age 65+', detail: 'Elderly at highest risk' },
        ],
        source: 'European Transport Safety Council (ETSC), 2022',
        region: 'European Union',
      };
    }

    // Brazil
    if (countryLower.includes('brazil') || countryLower.includes('brasil')) {
      return {
        stats: [
          { stat: '5,448', label: 'Pedestrians killed (2021)', detail: '16% of road deaths' },
          { stat: '15', label: 'Deaths per day', detail: 'National average' },
          { stat: '65%', label: 'In urban areas', detail: 'City streets' },
          { stat: '40%', label: 'Age 40-59', detail: 'Working age' },
        ],
        source: 'DATASUS/Ministry of Health, Brazil 2021',
        region: 'Brazil',
      };
    }

    // China
    if (countryLower.includes('china')) {
      return {
        stats: [
          { stat: '16,000+', label: 'Pedestrians killed (est.)', detail: 'Annual estimate' },
          { stat: '25%', label: 'Of road deaths', detail: 'Significant portion' },
          { stat: '80%', label: 'In urban areas', detail: 'Rapid urbanization' },
          { stat: '60%', label: 'At unmarked crossings', detail: 'Infrastructure gaps' },
        ],
        source: 'WHO Global Status Report on Road Safety, China data',
        region: 'China',
      };
    }

    // Global/default fallback
    return {
      stats: [
        { stat: '270,000', label: 'Pedestrians killed globally', detail: 'Each year worldwide' },
        { stat: '22%', label: 'Of road deaths', detail: 'Nearly 1 in 4' },
        { stat: '93%', label: 'In low/middle-income', detail: 'Countries most affected' },
        { stat: '3x', label: 'Safer with infrastructure', detail: 'Proper crossings reduce risk' },
      ],
      source: 'WHO Global Status Report on Road Safety, 2023',
      region: 'Global',
    };
  };

  const safetyData = getSafetyStats(country);

  return (
    <div className="min-h-screen bg-white">
      {/* Print Button */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-all shadow-lg"
        >
          🖨️ Print / Save as PDF
        </button>
        <a
          href="/"
          className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all shadow-lg"
        >
          ← Back
        </a>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-6 mb-6 print:rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-orange-200 text-xs uppercase tracking-wider mb-1">Walkability Improvement Proposal</p>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {proposalTitle || `${cityName} Street Safety Initiative`}
              </h1>
              <p className="text-orange-100 text-sm">{location.displayName}</p>
            </div>
            <div className="text-right">
              <p className="text-orange-200 text-xs">{dateStr}</p>
              {authorName && <p className="text-white text-sm font-medium mt-1">{authorName}</p>}
            </div>
          </div>
        </div>

        {/* Executive Summary Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Score Card */}
          <div className={`${getScoreBgColor(score)} text-white rounded-xl p-4 text-center`}>
            <p className="text-xs uppercase tracking-wider opacity-80">Current Score</p>
            <div className="text-4xl font-bold my-1">{score.toFixed(1)}</div>
            <p className="text-xs opacity-90">{getScoreLabel(score).label}</p>
          </div>

          {/* Potential Score */}
          <div className="bg-blue-500 text-white rounded-xl p-4 text-center">
            <p className="text-xs uppercase tracking-wider opacity-80">Potential Score</p>
            <div className="text-4xl font-bold my-1">{potentialImprovement.toFixed(1)}</div>
            <p className="text-xs opacity-90">+{(potentialImprovement - score).toFixed(1)} improvement</p>
          </div>

          {/* Key Stat */}
          <div className="bg-gray-100 rounded-xl p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500">Metrics Analyzed</p>
            <div className="text-4xl font-bold text-gray-800 my-1">6</div>
            <p className="text-xs text-gray-600">Data-driven insights</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left: Priority Issues */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <span className="w-1 h-4 bg-red-500 rounded-full"></span>
              Priority Issues
            </h3>

            <div className="space-y-3">
              {problemAreas.map((area, index) => (
                <div key={area.name} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-gray-800 text-sm">{area.icon} {area.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getBadgeStyle(area.score)}`}>
                      {area.score.toFixed(1)}/10
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{area.standard}</p>
                  <p className="text-xs text-red-700 font-medium">{area.issue}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Strengths */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <span className="w-1 h-4 bg-green-500 rounded-full"></span>
              Current Strengths
            </h3>

            <div className="space-y-3 mb-4">
              {strengths.map((area) => (
                <div key={area.name} className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800 text-sm">{area.icon} {area.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                      {area.score.toFixed(1)}/10
                    </span>
                  </div>
                  <p className="text-xs text-green-700">{area.standard}</p>
                </div>
              ))}
            </div>

            {/* Economic Impact */}
            <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2 uppercase tracking-wider">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              Economic Benefits
            </h3>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {economicBenefits.map((benefit) => (
                  <div key={benefit.metric}>
                    <p className="text-gray-600">{benefit.metric}</p>
                    <p className="font-bold text-blue-700">{benefit.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pedestrian Safety Statistics */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <span className="w-1 h-4 bg-red-600 rounded-full"></span>
            Why This Matters: {safetyData.region} Pedestrian Safety Crisis
          </h3>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="grid grid-cols-4 gap-4">
              {safetyData.stats.map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-2xl font-bold text-red-600">{item.stat}</div>
                  <div className="text-xs text-gray-700 font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.detail}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center italic">
              Source: {safetyData.source}
            </p>
          </div>
        </div>

        {/* Recommendations Table */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
            Recommended Actions
          </h3>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2 font-semibold text-gray-700">Issue</th>
                  <th className="text-left p-2 font-semibold text-gray-700">Recommendation</th>
                  <th className="text-left p-2 font-semibold text-gray-700">Impact</th>
                  <th className="text-center p-2 font-semibold text-gray-700">Cost</th>
                </tr>
              </thead>
              <tbody>
                {problemAreas.map((area, index) => (
                  <tr key={area.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2 font-medium text-gray-800">{area.icon} {area.name}</td>
                    <td className="p-2 text-gray-600">{area.rec}</td>
                    <td className="p-2 text-green-700">{area.impact}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        area.cost === 'Low' || area.cost === 'Low (policy)' ? 'bg-green-100 text-green-700' :
                        area.cost === 'Low-Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {area.cost}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Wins + Standards */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Quick Wins */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="font-bold text-gray-800 text-sm mb-2">⚡ Quick Wins (Low Cost, High Impact)</h4>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Paint high-visibility crosswalks at top 5 intersections</li>
              <li>• Install pedestrian countdown signals</li>
              <li>• Add temporary curb extensions (tactical urbanism)</li>
              <li>• Place benches every 200m on main routes</li>
              <li>• Improve street lighting at crossings</li>
            </ul>
          </div>

          {/* Standards Reference */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-bold text-gray-800 text-sm mb-2">📚 Standards Referenced</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><strong>NACTO</strong> - Urban Street Design Guide</li>
              <li><strong>GDCI</strong> - Global Street Design Guide</li>
              <li><strong>WHO</strong> - Healthy Cities Guidelines</li>
              <li><strong>ITDP</strong> - Pedestrians First Framework</li>
              <li><strong>ADA</strong> - Accessibility Guidelines</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2 italic">Endorsed by 100+ cities worldwide</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-5">
          <h4 className="font-bold text-lg mb-2">Request for Meeting</h4>
          <p className="text-sm text-orange-100 mb-3">
            We respectfully request a meeting with the Transportation/Public Works Department to discuss
            implementing these evidence-based improvements. Research shows that walkability investments
            generate <strong>3-5x return</strong> through increased property tax revenue, reduced healthcare
            costs, and economic activity.
          </p>
          <div className="flex gap-4 text-xs">
            <div className="bg-white/20 rounded px-3 py-1">
              <span className="opacity-80">Contact:</span> {authorName || 'Community Advocate'}
            </div>
            <div className="bg-white/20 rounded px-3 py-1">
              <span className="opacity-80">Data:</span> safestreets.app
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400">
          <p>Data: OpenStreetMap, Sentinel-2, NASA POWER</p>
          <p>Generated by SafeStreets (safestreets.app)</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-6 { padding: 1.5rem !important; }
          .print\\:rounded-lg { border-radius: 0.5rem !important; }
          @page { margin: 0.4in; size: letter; }
        }
      `}</style>
    </div>
  );
}
