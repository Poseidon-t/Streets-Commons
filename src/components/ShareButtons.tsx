import { COLORS } from '../constants';
import type { Location, WalkabilityMetrics } from '../types';

interface ShareButtonsProps {
  location: Location;
  metrics: WalkabilityMetrics;
}

export default function ShareButtons({ location, metrics }: ShareButtonsProps) {
  const shareUrl = window.location.href;
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

  const handleShareTwitter = () => {
    const text = encodeURIComponent(`${shareText}\n\nCheck your neighborhood's walkability:`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleShareFacebook = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
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
        sidewalkCoverage: metrics.sidewalkCoverage,
        networkEfficiency: metrics.networkEfficiency,
        destinationAccess: metrics.destinationAccess,
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
        <div className="grid grid-cols-3 gap-2">
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
        <button
          onClick={handleExportJSON}
          className="w-full px-4 py-3 rounded-xl font-semibold text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
          style={{ backgroundColor: COLORS.accent }}
        >
          <span>📥</span>
          <span>Export Data (JSON)</span>
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Share this analysis to help advocate for better walkable infrastructure
        </p>
      </div>
    </div>
  );
}
