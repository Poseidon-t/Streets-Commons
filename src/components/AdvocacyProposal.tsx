/**
 * Advocacy Proposal Generator
 * Creates a one-page professional proposal for city officials
 * Opens as HTML report that can be printed/saved as PDF
 */

import { useState } from 'react';
import { COLORS } from '../constants';
import type { Location, WalkabilityMetrics, WalkabilityScoreV2, CrashData, DemographicData, OSMData, RawMetricData, DataQuality } from '../types';
import { analyzeLocalEconomy } from '../utils/localEconomicAnalysis';

interface AdvocacyProposalProps {
  isPremium: boolean;
  location?: Location;
  metrics?: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
  crashData?: CrashData | null;
  demographicData?: DemographicData | null;
  osmData?: OSMData | null;
  rawMetricData?: RawMetricData;
  dataQuality?: DataQuality | null;
}

export default function AdvocacyProposal({ isPremium, location, metrics, compositeScore, crashData, demographicData, osmData, rawMetricData, dataQuality }: AdvocacyProposalProps) {
  const [proposalTitle, setProposalTitle] = useState('');
  const [authorName, setAuthorName] = useState('');

  if (!isPremium) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
        <div className="text-center">
          <div className="text-5xl mb-4">&#x1F4CB;</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Street Improvement Proposal
          </h2>
          <p className="text-gray-600 mb-4">
            Generate a professional one-page proposal to present to city officials
          </p>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(224,120,80,0.06)', border: '2px solid rgba(224,120,80,0.2)' }}>
            <p className="text-sm font-semibold" style={{ color: '#e07850' }}>
              Advocacy Toolkit — $49 one-time payment
            </p>
            <p className="text-xs mt-1" style={{ color: '#8a9a8a' }}>
              Unlock proposals, AI letters, street redesign, and more.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const generateProposal = () => {
    if (!location || !metrics) return;

    // Store data in sessionStorage for the proposal view
    const proposalData = {
      location,
      metrics,
      proposalTitle: proposalTitle || undefined,
      authorName: authorName || undefined,
      compositeScore: compositeScore || undefined,
      crashData: crashData || undefined,
      demographicData: demographicData || undefined,
      localEconomy: osmData ? analyzeLocalEconomy(osmData) : undefined,
      rawMetricData: rawMetricData || undefined,
      dataQuality: dataQuality || undefined,
    };

    sessionStorage.setItem('advocacyProposalData', JSON.stringify(proposalData));

    // Open in new tab
    window.open('/proposal', '_blank');
  };

  const cityName = location?.city || location?.displayName?.split(',')[0] || 'this area';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        📋 Street Improvement Proposal
      </h2>

      <p className="text-gray-600 mb-6">
        Generate a professional one-page proposal to present to city council or local officials.
        Perfect for advocacy meetings and public hearings.
      </p>

      {/* Location Info */}
      {location && metrics && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600">📍</span>
            <span className="font-semibold text-gray-800">{location.displayName}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              Current Score: <strong className="text-lg">{metrics.overallScore.toFixed(1)}/10</strong>
            </span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              metrics.overallScore >= 8 ? 'bg-green-100 text-green-700' :
              metrics.overallScore >= 6 ? 'bg-amber-100 text-amber-700' :
              metrics.overallScore >= 4 ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {metrics.label}
            </span>
          </div>
        </div>
      )}

      {/* Customization Options */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proposal Title (optional)
          </label>
          <input
            type="text"
            value={proposalTitle}
            onChange={(e) => setProposalTitle(e.target.value)}
            placeholder={`Street Improvement Proposal: ${cityName}`}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name / Organization (optional)
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="e.g., Jane Smith, Walkable Neighborhoods Coalition"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* What's Included */}
      <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(240,235,224,0.5)', border: '1px solid #e0dbd0' }}>
        <h3 className="font-semibold mb-2" style={{ color: '#2a3a2a' }}>What's Included:</h3>
        <ul className="space-y-1 text-sm" style={{ color: '#4a5a4a' }}>
          <li>✓ 4-component walkability score with letter grade</li>
          <li>✓ Real crash & fatality data for your area</li>
          <li>✓ Calculated economic impact (property, retail, healthcare)</li>
          <li>✓ Local economy analysis with business breakdown</li>
          <li>✓ Data-driven quick wins from lowest-scoring metrics</li>
          <li>✓ References to NACTO, GDCI, WHO, ADA standards</li>
          <li>✓ Professional call-to-action for officials</li>
        </ul>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateProposal}
        disabled={!location || !metrics}
        className="w-full px-6 py-4 rounded-xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: COLORS.primary }}
      >
        Generate Advocacy Proposal for {cityName}
      </button>

      {/* Tips */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs text-amber-800">
          <strong>Tip:</strong> The proposal opens in a new tab. Use your browser's print function (Ctrl/Cmd+P)
          to save as PDF or print directly. The one-page format is designed for busy officials who need key information quickly.
        </p>
      </div>
    </div>
  );
}
