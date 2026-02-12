/**
 * Advocacy Proposal View - Professional Data-Driven Report
 * Comprehensive proposal using real analysis data for city officials
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  Location, WalkabilityMetrics, WalkabilityScoreV2,
  CrashData, DemographicData, DataQuality, EconomicImpact,
} from '../types';
import type { LocalEconomicProfile } from '../utils/localEconomicAnalysis';
import { calculateEconomicImpact } from '../utils/economicImpact';
import { computeEquityAnalysis } from './streetcheck/EquityContextSection';

interface ProposalData {
  location: Location;
  metrics: WalkabilityMetrics;
  proposalTitle?: string;
  authorName?: string;
  compositeScore?: WalkabilityScoreV2;
  crashData?: CrashData;
  demographicData?: DemographicData;
  localEconomy?: LocalEconomicProfile;
  dataQuality?: DataQuality;
}

// Earthy palette
const C = {
  text: '#2a3a2a',
  textMuted: '#4a5a4a',
  textLight: '#8a9a8a',
  border: '#e0dbd0',
  borderLight: '#f0ebe0',
  bgWarm: '#faf8f4',
  bgCard: 'rgba(255,255,255,0.7)',
  accent: '#1e3a5f',
  accentLight: 'rgba(30,58,95,0.08)',
  green: '#16a34a',
  greenBg: 'rgba(34,197,94,0.08)',
  red: '#dc2626',
  redBg: 'rgba(220,38,38,0.06)',
  amber: '#ca8a04',
  amberBg: 'rgba(202,138,4,0.08)',
};

const GRADE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  A: { color: '#16a34a', bg: 'rgba(34,197,94,0.1)', label: 'Excellent' },
  B: { color: '#65a30d', bg: 'rgba(101,163,13,0.1)', label: 'Good' },
  C: { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)', label: 'Fair' },
  D: { color: '#ea580c', bg: 'rgba(234,88,12,0.1)', label: 'Poor' },
  F: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'Critical' },
};

const METRIC_INFO: Record<string, { icon: string; standard: string; issue: string; rec: string; impact: string; cost: string }> = {
  crossingSafety: {
    icon: '🚦', standard: 'WHO: Crossings every 200m max, NACTO: signalized on 4+ lane roads',
    issue: 'Unprotected crosswalks on high-speed roads are extremely dangerous',
    rec: 'Install traffic signals at key crossings, add refuge islands on wide roads',
    impact: 'Signalized crossings reduce pedestrian fatalities by 40-60%', cost: 'Low-Medium',
  },
  sidewalkCoverage: {
    icon: '🚶', standard: 'Complete Streets: Sidewalks on 100% of urban streets',
    issue: 'Missing sidewalks force pedestrians to walk in traffic',
    rec: 'Build continuous sidewalks on all streets, prioritize arterials and school routes',
    impact: 'Streets with sidewalks see 2-3x fewer pedestrian injuries', cost: 'Medium',
  },
  speedExposure: {
    icon: '🚗', standard: 'Vision Zero: 20-25mph on urban streets',
    issue: 'High-speed, multi-lane roads are the #1 cause of pedestrian fatalities',
    rec: 'Implement road diets, reduce speed limits, add traffic calming measures',
    impact: 'Reducing speed from 40mph to 25mph cuts fatality risk from 85% to 10%', cost: 'Low-Medium',
  },
  destinationAccess: {
    icon: '🏪', standard: 'ITDP: Essential services within 15-min walk',
    issue: 'Missing nearby services force car dependence for daily errands',
    rec: 'Support mixed-use zoning, incentivize neighborhood retail and services',
    impact: 'Reduces car trips by 20-30%, supports local economy', cost: 'Low (policy)',
  },
  nightSafety: {
    icon: '💡', standard: 'IES: Minimum 5 lux on all pedestrian routes',
    issue: 'Nearly half of pedestrian fatalities occur at night on unlit streets',
    rec: 'Install pedestrian-scale lighting on all sidewalks and crossings',
    impact: 'Good street lighting reduces pedestrian crashes by 42%', cost: 'Low-Medium',
  },
  slope: {
    icon: '⛰️', standard: 'ADA: Max 5% grade for accessible routes',
    issue: 'Steep grades limit accessibility for elderly and disabled',
    rec: 'Add handrails, rest areas, alternative accessible routes',
    impact: 'Increases accessible route coverage by 40%', cost: 'Medium',
  },
  treeCanopy: {
    icon: '🌳', standard: 'Urban Forestry: 25-40% canopy coverage',
    issue: 'Lack of shade makes walking uncomfortable in warm weather',
    rec: 'Implement street tree planting program, protect existing trees',
    impact: 'Reduces surface temperature by 5-10°C', cost: 'Low-Medium',
  },
  thermalComfort: {
    icon: '🌡️', standard: 'WHO: Thermal comfort for pedestrians, heat island < 5°C',
    issue: 'Urban heat island and high temperatures make walking dangerous',
    rec: 'Increase cool pavements, add shade structures, expand green infrastructure',
    impact: 'Reduces heat-related illness by 20-30%', cost: 'Medium',
  },
};

// Quick win recommendations based on low-scoring metrics
const QUICK_WINS: Record<string, string> = {
  crossingSafety: 'Paint high-visibility crosswalks at top 5 intersections',
  nightSafety: 'Improve street lighting at key crossings and corridors',
  speedExposure: 'Add temporary curb extensions and speed bumps (tactical urbanism)',
  sidewalkCoverage: 'Repair and widen sidewalks on primary pedestrian routes',
  treeCanopy: 'Plant shade trees along main walking corridors',
  thermalComfort: 'Install shade structures and cool pavement at bus stops',
  destinationAccess: 'Install pedestrian wayfinding signs to nearby services',
  slope: 'Add benches and rest areas every 200m on steep routes',
};

export default function AdvocacyProposalView() {
  const [searchParams] = useSearchParams();
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);

  useEffect(() => {
    const dataStr = sessionStorage.getItem('advocacyProposalData');
    if (dataStr) {
      try {
        setProposalData(JSON.parse(dataStr));
      } catch (e) {
        console.error('Failed to parse proposal data:', e);
      }
    }
  }, [searchParams]);

  if (!proposalData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bgWarm }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: C.text }}>No Proposal Data</h1>
          <p style={{ color: C.textMuted }}>Please generate a proposal from the main analysis page.</p>
          <a href="/" className="mt-4 inline-block hover:underline" style={{ color: C.accent }}>
            &larr; Back to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  const { location, metrics, proposalTitle, authorName, compositeScore, crashData, demographicData, localEconomy, dataQuality } = proposalData;
  const score = metrics.overallScore;
  const cityName = location.city || location.displayName.split(',')[0];
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Composite score info
  const grade = compositeScore?.grade || (score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F');
  const gradeConfig = GRADE_CONFIG[grade] || GRADE_CONFIG.C;

  // Build metrics array sorted by score (lowest first)
  const metricsArray = Object.entries(METRIC_INFO).map(([key, info]) => ({
    key,
    name: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
    score: (metrics as any)[key] as number ?? 5,
    ...info,
  })).sort((a, b) => a.score - b.score);

  const problemAreas = metricsArray.slice(0, 3);
  const strengths = metricsArray.slice(-2).reverse();

  // Economic impact (calculated, not hardcoded)
  const economicImpact: EconomicImpact | null = demographicData
    ? calculateEconomicImpact(demographicData, score)
    : null;

  // Data-driven quick wins from lowest 5 metrics
  const quickWins = metricsArray.slice(0, 5)
    .filter(m => m.score < 7)
    .map(m => QUICK_WINS[m.key])
    .filter(Boolean);

  // Data sources for footer
  const dataSources: string[] = ['OpenStreetMap', 'Sentinel-2', 'NASA POWER'];
  if (crashData?.type === 'local') dataSources.push('NHTSA FARS');
  if (crashData?.type === 'country') dataSources.push('WHO GHO');
  if (demographicData?.type === 'us') dataSources.push('US Census ACS');
  if (demographicData?.type === 'international') dataSources.push('World Bank');

  const formatCurrency = (v: number | null) => {
    if (v === null) return null;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bgWarm }}>
      {/* Print Button */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <button
          onClick={() => window.print()}
          className="px-6 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg"
          style={{ backgroundColor: C.accent }}
        >
          Print / Save as PDF
        </button>
        <a
          href="/"
          className="px-6 py-3 font-semibold rounded-xl transition-all shadow-lg"
          style={{ backgroundColor: '#f0ebe0', color: C.text }}
        >
          &larr; Back
        </a>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-6">
        {/* Header */}
        <div className="rounded-2xl p-6 mb-6 print:rounded-lg" style={{ backgroundColor: C.accent, color: 'white' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ opacity: 0.7 }}>Walkability Improvement Proposal</p>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {proposalTitle || `${cityName} Street Safety Initiative`}
              </h1>
              <p className="text-sm" style={{ opacity: 0.8 }}>{location.displayName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ opacity: 0.7 }}>{dateStr}</p>
              {authorName && <p className="text-sm font-medium mt-1">{authorName}</p>}
            </div>
          </div>
        </div>

        {/* Executive Summary Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Score Card */}
          <div className="rounded-xl p-4 text-center border" style={{ backgroundColor: gradeConfig.bg, borderColor: C.border }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: C.textLight }}>Current Score</p>
            <div className="text-4xl font-bold my-1" style={{ color: gradeConfig.color }}>{score.toFixed(1)}</div>
            <p className="text-xs" style={{ color: C.textMuted }}>{gradeConfig.label}</p>
          </div>

          {/* Grade Card */}
          {compositeScore ? (
            <div className="rounded-xl p-4 text-center border" style={{ backgroundColor: C.bgCard, borderColor: C.border }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: C.textLight }}>Grade</p>
              <div className="text-4xl font-bold my-1" style={{ color: gradeConfig.color }}>{grade}</div>
              <p className="text-xs" style={{ color: C.textMuted }}>
                {Math.round(compositeScore.confidence)}% confidence
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center border" style={{ backgroundColor: C.bgCard, borderColor: C.border }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: C.textLight }}>Grade</p>
              <div className="text-4xl font-bold my-1" style={{ color: gradeConfig.color }}>{grade}</div>
              <p className="text-xs" style={{ color: C.textMuted }}>{metrics.label}</p>
            </div>
          )}

          {/* Metrics Analyzed */}
          <div className="rounded-xl p-4 text-center border" style={{ backgroundColor: C.bgCard, borderColor: C.border }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: C.textLight }}>Metrics Analyzed</p>
            <div className="text-4xl font-bold my-1" style={{ color: C.text }}>8</div>
            <p className="text-xs" style={{ color: C.textMuted }}>Data-driven insights</p>
          </div>
        </div>

        {/* Component Scores + Crash Data Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Component Scores */}
          {compositeScore && (
            <div className="rounded-xl border p-4" style={{ borderColor: C.border, backgroundColor: C.bgCard }}>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.accent }} />
                Walkability Components
              </h3>
              <div className="space-y-2">
                {Object.entries(compositeScore.components).map(([key, comp]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: C.textMuted }}>{comp.label}</span>
                      <span className="text-xs font-bold" style={{ color: comp.score >= 60 ? C.green : comp.score >= 40 ? C.amber : C.red }}>
                        {comp.score.toFixed(0)}/100
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.borderLight }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${comp.score}%`,
                          backgroundColor: comp.score >= 60 ? C.green : comp.score >= 40 ? C.amber : C.red,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crash Data */}
          {crashData && (
            <div className="rounded-xl border p-4" style={{ borderColor: C.border, backgroundColor: C.redBg }}>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.red }} />
                Pedestrian Safety Data
              </h3>
              {crashData.type === 'local' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: C.red }}>{crashData.totalCrashes}</div>
                      <div className="text-xs" style={{ color: C.textMuted }}>Fatal crashes nearby</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: C.red }}>{crashData.totalFatalities}</div>
                      <div className="text-xs" style={{ color: C.textMuted }}>Total fatalities</div>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: C.textLight }}>
                    Within {(crashData.radiusMeters / 1000).toFixed(1)}km, {crashData.yearRange.from}-{crashData.yearRange.to}
                  </p>
                  {crashData.nearestCrash && (
                    <p className="text-xs" style={{ color: C.red }}>
                      Nearest fatal crash: {crashData.nearestCrash.distance.toFixed(0)}m away ({crashData.nearestCrash.year})
                    </p>
                  )}
                  <p className="text-xs italic" style={{ color: C.textLight }}>
                    Source: {crashData.dataSource}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: C.red }}>{crashData.deathRatePer100k.toFixed(1)}</div>
                      <div className="text-xs" style={{ color: C.textMuted }}>Deaths per 100k</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: C.red }}>{crashData.totalDeaths.toLocaleString()}</div>
                      <div className="text-xs" style={{ color: C.textMuted }}>Total road deaths</div>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: C.textLight }}>
                    {crashData.countryName}, {crashData.year}
                  </p>
                  <p className="text-xs italic" style={{ color: C.textLight }}>
                    Source: {crashData.dataSource}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* If no composite score, span crash data full width or show placeholder */}
          {!compositeScore && !crashData && (
            <div className="col-span-2 rounded-xl border p-4 text-center" style={{ borderColor: C.border, backgroundColor: C.bgCard }}>
              <p className="text-sm" style={{ color: C.textLight }}>Detailed component scores available with full analysis</p>
            </div>
          )}
        </div>

        {/* Two Column: Priority Issues + Strengths/Economy */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left: Priority Issues */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.red }} />
              Priority Issues
            </h3>
            <div className="space-y-3">
              {problemAreas.map((area, index) => (
                <div key={area.key} className="rounded-lg p-3 border" style={{ borderColor: C.border, backgroundColor: C.bgCard }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-bold" style={{ backgroundColor: C.red }}>
                        {index + 1}
                      </span>
                      <span className="font-semibold text-sm" style={{ color: C.text }}>{area.icon} {area.name}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                      backgroundColor: area.score >= 7 ? C.greenBg : area.score >= 5 ? C.amberBg : C.redBg,
                      color: area.score >= 7 ? C.green : area.score >= 5 ? C.amber : C.red,
                    }}>
                      {area.score.toFixed(1)}/10
                    </span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: C.textLight }}>{area.standard}</p>
                  <p className="text-xs font-medium" style={{ color: C.red }}>{area.issue}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Strengths + Economic Impact */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.green }} />
              Current Strengths
            </h3>
            <div className="space-y-3 mb-4">
              {strengths.map((area) => (
                <div key={area.key} className="rounded-lg p-3 border" style={{ borderColor: C.border, backgroundColor: C.greenBg }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm" style={{ color: C.text }}>{area.icon} {area.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: C.green }}>
                      {area.score.toFixed(1)}/10
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: C.green }}>{area.standard}</p>
                </div>
              ))}
            </div>

            {/* Economic Impact */}
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.accent }} />
              Economic Benefits
            </h3>
            <div className="rounded-lg p-3 border" style={{ borderColor: C.border, backgroundColor: C.accentLight }}>
              {economicImpact ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {economicImpact.propertyValuePremium !== null && (
                    <div>
                      <p style={{ color: C.textMuted }}>Property Value Premium</p>
                      <p className="font-bold" style={{ color: C.accent }}>+{formatCurrency(economicImpact.propertyValuePremium)}</p>
                    </div>
                  )}
                  <div>
                    <p style={{ color: C.textMuted }}>Retail Sales Uplift</p>
                    <p className="font-bold" style={{ color: C.accent }}>{economicImpact.retailUpliftPercent}%</p>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>Healthcare Savings</p>
                    <p className="font-bold" style={{ color: C.accent }}>${economicImpact.healthcareSavingsPerPerson}/person/yr</p>
                  </div>
                  {economicImpact.estimatedJobsPotential !== null && (
                    <div>
                      <p style={{ color: C.textMuted }}>Jobs per $10M Investment</p>
                      <p className="font-bold" style={{ color: C.accent }}>{economicImpact.estimatedJobsPotential} jobs</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p style={{ color: C.textMuted }}>Property Value Increase</p>
                    <p className="font-bold" style={{ color: C.accent }}>5-15%</p>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>Retail Sales Increase</p>
                    <p className="font-bold" style={{ color: C.accent }}>20-40%</p>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>Healthcare Savings</p>
                    <p className="font-bold" style={{ color: C.accent }}>$1,200/person/yr</p>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>ROI on Investment</p>
                    <p className="font-bold" style={{ color: C.accent }}>3:1 to 5:1</p>
                  </div>
                </div>
              )}
              <p className="text-xs mt-2 italic" style={{ color: C.textLight }}>
                {economicImpact ? 'Calculated from local demographic data' : 'Based on Walk Score & CDC research'}
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations Table */}
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
            <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.accent }} />
            Recommended Actions
          </h3>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: C.border }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: C.borderLight }}>
                  <th className="text-left p-2 font-semibold" style={{ color: C.text }}>Issue</th>
                  <th className="text-left p-2 font-semibold" style={{ color: C.text }}>Recommendation</th>
                  <th className="text-left p-2 font-semibold" style={{ color: C.text }}>Impact</th>
                  <th className="text-center p-2 font-semibold" style={{ color: C.text }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {problemAreas.map((area, index) => (
                  <tr key={area.key} style={{ backgroundColor: index % 2 === 0 ? 'white' : C.borderLight }}>
                    <td className="p-2 font-medium" style={{ color: C.text }}>{area.icon} {area.name}</td>
                    <td className="p-2" style={{ color: C.textMuted }}>{area.rec}</td>
                    <td className="p-2" style={{ color: C.green }}>{area.impact}</td>
                    <td className="p-2 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                        backgroundColor: area.cost.includes('Low') ? C.greenBg : C.amberBg,
                        color: area.cost.includes('Low') ? C.green : C.amber,
                      }}>
                        {area.cost}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Wins + Local Economy / Demographics */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Quick Wins */}
          <div className="rounded-lg p-4 border" style={{ borderColor: C.border, backgroundColor: C.greenBg }}>
            <h4 className="font-bold text-sm mb-2" style={{ color: C.text }}>Quick Wins (Low Cost, High Impact)</h4>
            <ul className="text-xs space-y-1" style={{ color: C.textMuted }}>
              {(quickWins.length > 0 ? quickWins : [
                'Paint high-visibility crosswalks at top 5 intersections',
                'Install pedestrian countdown signals',
                'Add temporary curb extensions (tactical urbanism)',
                'Place benches every 200m on main routes',
                'Improve street lighting at crossings',
              ]).map((win, i) => (
                <li key={i}>• {win}</li>
              ))}
            </ul>
          </div>

          {/* Local Economy or Standards */}
          {localEconomy && localEconomy.totalBusinesses > 0 ? (
            <div className="rounded-lg p-4 border" style={{ borderColor: C.border, backgroundColor: C.bgCard }}>
              <h4 className="font-bold text-sm mb-2" style={{ color: C.text }}>Local Economy Context</h4>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{
                  color: localEconomy.vitality === 'thriving' || localEconomy.vitality === 'active' ? C.green :
                    localEconomy.vitality === 'moderate' ? C.amber : C.red,
                  backgroundColor: localEconomy.vitality === 'thriving' || localEconomy.vitality === 'active' ? C.greenBg :
                    localEconomy.vitality === 'moderate' ? C.amberBg : C.redBg,
                }}>
                  {localEconomy.vitality.charAt(0).toUpperCase() + localEconomy.vitality.slice(1)}
                </span>
                <span className="text-xs" style={{ color: C.textLight }}>{localEconomy.totalBusinesses} businesses within 800m</span>
              </div>
              <div className="text-xs space-y-0.5" style={{ color: C.textMuted }}>
                {localEconomy.highlights.slice(0, 3).map((h, i) => (
                  <p key={i}>+ {h}</p>
                ))}
                {localEconomy.gaps.slice(0, 2).map((g, i) => (
                  <p key={i} style={{ color: C.red }}>- {g}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg p-4 border" style={{ borderColor: C.border, backgroundColor: C.accentLight }}>
              <h4 className="font-bold text-sm mb-2" style={{ color: C.text }}>Standards Referenced</h4>
              <ul className="text-xs space-y-1" style={{ color: C.textMuted }}>
                <li><strong>NACTO</strong> - Urban Street Design Guide</li>
                <li><strong>GDCI</strong> - Global Street Design Guide</li>
                <li><strong>WHO</strong> - Healthy Cities Guidelines</li>
                <li><strong>ITDP</strong> - Pedestrians First Framework</li>
                <li><strong>ADA</strong> - Accessibility Guidelines</li>
              </ul>
            </div>
          )}
        </div>

        {/* Demographics Row (if available) */}
        {demographicData && (
          <div className="mb-6 rounded-lg border p-4" style={{ borderColor: C.border, backgroundColor: C.bgCard }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: C.accent }} />
              Area Demographics
            </h3>
            {demographicData.type === 'us' ? (
              <div className="grid grid-cols-4 gap-3 text-center">
                {demographicData.medianHouseholdIncome !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      ${demographicData.medianHouseholdIncome.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>Median Income</div>
                  </div>
                )}
                {demographicData.medianHomeValue !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      ${demographicData.medianHomeValue.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>Home Value</div>
                  </div>
                )}
                {demographicData.unemploymentRate !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      {demographicData.unemploymentRate.toFixed(1)}%
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>Unemployment</div>
                  </div>
                )}
                {demographicData.povertyRate !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      {demographicData.povertyRate.toFixed(1)}%
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>Poverty Rate</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                {demographicData.gdpPerCapita !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      ${demographicData.gdpPerCapita.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>GDP per Capita</div>
                  </div>
                )}
                {demographicData.unemploymentRate !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      {demographicData.unemploymentRate.toFixed(1)}%
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>Unemployment</div>
                  </div>
                )}
                {demographicData.urbanPopulationPct !== null && (
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.text }}>
                      {demographicData.urbanPopulationPct.toFixed(0)}%
                    </div>
                    <div className="text-xs" style={{ color: C.textLight }}>Urban Population</div>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs mt-2 italic" style={{ color: C.textLight }}>
              Source: {demographicData.dataSource} ({demographicData.year})
            </p>
          </div>
        )}

        {/* Equity Context (if applicable) */}
        {(() => {
          const equity = computeEquityAnalysis(demographicData ?? null, metrics, crashData ?? null, compositeScore ?? null, localEconomy ?? null);
          if (!equity) return null;
          const levelColors = {
            high: { color: C.red, bg: C.redBg, label: 'High Concern' },
            moderate: { color: C.amber, bg: C.amberBg, label: 'Moderate Concern' },
            low: { color: C.green, bg: C.greenBg, label: 'Low Concern' },
          };
          const lc = levelColors[equity.level];
          return (
            <div className="mb-6 rounded-lg border p-4" style={{ borderColor: C.border, backgroundColor: C.bgCard }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider" style={{ color: C.text }}>
                  <span className="w-1 h-4 rounded-full" style={{ backgroundColor: lc.color }} />
                  Equity Context
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: lc.color, backgroundColor: lc.bg }}>
                  {lc.label}
                </span>
              </div>
              <div className="space-y-2">
                {equity.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: lc.bg }}>
                    <span className="text-sm flex-shrink-0">{insight.icon}</span>
                    <div>
                      <span className="text-xs font-semibold" style={{ color: C.text }}>{insight.label}: </span>
                      <span className="text-xs" style={{ color: C.textMuted }}>{insight.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3 italic" style={{ color: C.textLight }}>{equity.context}</p>
            </div>
          );
        })()}

        {/* Call to Action */}
        <div className="rounded-xl p-5" style={{ backgroundColor: C.accent, color: 'white' }}>
          <h4 className="font-bold text-lg mb-2">Request for Meeting</h4>
          <p className="text-sm mb-3" style={{ opacity: 0.85 }}>
            We respectfully request a meeting with the Transportation/Public Works Department to discuss
            implementing these evidence-based improvements.
            {economicImpact ? (
              <> Our analysis shows walkability investments in this area can generate property value premiums
              of {formatCurrency(economicImpact.propertyValuePremium)}, retail uplift of {economicImpact.retailUpliftPercent}%,
              and healthcare savings of ${economicImpact.healthcareSavingsPerPerson}/person/year.</>
            ) : (
              <> Research shows that walkability investments generate <strong>3-5x return</strong> through
              increased property tax revenue, reduced healthcare costs, and economic activity.</>
            )}
          </p>
          <div className="flex gap-4 text-xs">
            <div className="rounded px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <span style={{ opacity: 0.7 }}>Contact:</span> {authorName || 'Community Advocate'}
            </div>
            <div className="rounded px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <span style={{ opacity: 0.7 }}>Data:</span> safestreets.app
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 flex justify-between items-center text-xs" style={{ borderTop: `1px solid ${C.border}`, color: C.textLight }}>
          <p>Data: {dataSources.join(', ')}</p>
          <div className="flex items-center gap-3">
            {dataQuality && (
              <span className="px-2 py-0.5 rounded" style={{ backgroundColor: C.borderLight }}>
                {dataQuality.confidence} confidence
              </span>
            )}
            <p>Generated by SafeStreets</p>
          </div>
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
