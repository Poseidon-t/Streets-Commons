import { useState } from 'react';
import { COLORS } from '../constants';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';
import PaymentModal from './PaymentModalWithAuth';

interface ShareButtonsProps {
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality?: DataQuality;
}

export default function ShareButtons({ location, metrics, dataQuality }: ShareButtonsProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Build shareable URL with location params
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.displayName)}`;
  const shareText = `${location.displayName} walkability score: ${metrics.overallScore.toFixed(1)}/10 (${metrics.label})`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link');
    }
  };

  const handleShareTwitter = async () => {
    const prodUrl = `https://safestreets.app/?lat=${location.lat}&lon=${location.lon}`;
    const shortName = location.city || location.displayName.split(',')[0] || 'This area';
    const tweetText = `${shortName} walkability score: ${metrics.overallScore.toFixed(1)}/10 - ${metrics.label}\n\n${prodUrl}`;

    // Try to open Twitter, fallback to clipboard
    const popup = window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'width=550,height=420');

    if (!popup || popup.closed) {
      try {
        await navigator.clipboard.writeText(tweetText);
        alert('Tweet copied to clipboard! Paste it on Twitter.');
      } catch {
        alert('Could not open Twitter. Copy this tweet:\n\n' + tweetText);
      }
    }
  };

  const handleShareFacebook = async () => {
    const prodUrl = `https://safestreets.app/?lat=${location.lat}&lon=${location.lon}`;
    const popup = window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(prodUrl)}`, '_blank', 'width=550,height=420');

    if (!popup || popup.closed) {
      try {
        await navigator.clipboard.writeText(prodUrl);
        alert('Link copied to clipboard! Share it on Facebook.');
      } catch {
        alert('Could not open Facebook. Share this link:\n\n' + prodUrl);
      }
    }
  };

  const handleShareLinkedIn = async () => {
    const prodUrl = `https://safestreets.app/?lat=${location.lat}&lon=${location.lon}`;
    const popup = window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(prodUrl)}`, '_blank', 'width=550,height=420');

    if (!popup || popup.closed) {
      try {
        await navigator.clipboard.writeText(prodUrl);
        alert('Link copied to clipboard! Share it on LinkedIn.');
      } catch {
        alert('Could not open LinkedIn. Share this link:\n\n' + prodUrl);
      }
    }
  };

  const handleExportJSON = () => {
    const data = {
      location: {
        name: location.displayName,
        lat: location.lat,
        lon: location.lon,
        city: location.city,
        country: location.country,
      },
      metrics: {
        overallScore: metrics.overallScore,
        label: metrics.label,
        crossingDensity: metrics.crossingDensity,
        networkEfficiency: metrics.networkEfficiency,
        destinationAccess: metrics.destinationAccess,
        slope: metrics.slope,
        treeCanopy: metrics.treeCanopy,
        surfaceTemp: metrics.surfaceTemp,
        airQuality: metrics.airQuality,
        heatIsland: metrics.heatIsland,
      },
      timestamp: new Date().toISOString(),
      tool: 'SafeStreets',
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safestreets-${location.city || 'location'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGeneratePDF = () => {
    if (!dataQuality) {
      alert('Data quality information not available');
      return;
    }

    // Store report data in sessionStorage
    const reportData = {
      location,
      metrics,
      dataQuality,
    };
    sessionStorage.setItem('reportData', JSON.stringify(reportData));

    // Open report in new window
    window.open('/report', '_blank');
  };

  return (
    <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Share Results</h3>

      <div className="space-y-4">
        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="w-full px-4 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <span>🔗</span>
          <span>Copy Link</span>
        </button>

        {/* Social Media Shares */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleShareTwitter}
            className="px-4 py-3 rounded-xl font-semibold bg-blue-400 text-white hover:bg-blue-500 transition-all text-sm"
          >
            Twitter
          </button>
          <button
            onClick={handleShareFacebook}
            className="px-4 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all text-sm"
          >
            Facebook
          </button>
          <button
            onClick={handleShareLinkedIn}
            className="px-4 py-3 rounded-xl font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-all text-sm"
          >
            LinkedIn
          </button>
        </div>

        {/* Export Data */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportJSON}
            className="px-4 py-3 rounded-xl font-semibold text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: COLORS.accent }}
          >
            <span>📥</span>
            <span>JSON</span>
          </button>
          <button
            onClick={handleGeneratePDF}
            className="px-4 py-3 rounded-xl font-semibold text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: COLORS.primary }}
          >
            <span>📄</span>
            <span>View Report</span>
          </button>
        </div>

        {/* Premium Features CTA */}
        <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-blue-50 border-2 border-orange-200 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 mb-1">🔓 Premium Tools</h4>
              <p className="text-xs text-gray-600 mb-2">
                Streetmix + 3DStreet + Policy Reports + Budget Analysis
              </p>
              <p className="text-lg font-bold text-orange-600">From $19 one-time</p>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:shadow-lg whitespace-nowrap"
              style={{ backgroundColor: COLORS.accent }}
            >
              Unlock →
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Share this analysis to help advocate for better walkable infrastructure
        </p>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        locationName={location.displayName}
      />
    </div>
  );
}
