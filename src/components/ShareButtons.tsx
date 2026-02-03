import { useState } from 'react';
import { COLORS } from '../constants';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';
import PaymentModal from './PaymentModalWithAuth';

interface ShareButtonsProps {
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality?: DataQuality;
  isPremium?: boolean;
  onUnlock?: () => void;
}

// Metric label mapping for human-readable share text
const METRIC_LABELS: Record<string, string> = {
  crossings: 'pedestrian crossings',
  'street connectivity': 'street connectivity',
  'daily needs access': 'daily needs access',
  'tree canopy': 'tree canopy coverage',
  'air quality': 'air quality',
  'heat resilience': 'surface temperature',
  'heat island': 'heat island effect',
  terrain: 'terrain accessibility',
};
const ml = (key: string): string => METRIC_LABELS[key] || key;

// Score range helper
const getRange = (s: number): 'critical' | 'poor' | 'fair' | 'good' =>
  s < 3 ? 'critical' : s < 5 ? 'poor' : s < 7 ? 'fair' : 'good';

interface ShareData {
  shortName: string;
  score: string;
  prodUrl: string;
  weakest: [string, number];
}

// -- Share text templates by platform and score range --

type TemplateFn = (d: ShareData) => string;

const SHARE_TEMPLATES: Record<string, Record<string, TemplateFn[]>> = {
  twitter: {
    critical: [
      (d) => `${d.shortName} scores ${d.score}/10 for walkability. ${ml(d.weakest[0])}: ${d.weakest[1].toFixed(1)}/10.\n\nThat's not an opinion. That's satellite imagery + NACTO standards.\n\nCheck your neighborhood \u2192 ${d.prodUrl}`,
      (d) => `${d.score}/10.\n\nThat's ${d.shortName}'s walkability score. Measured against WHO and NACTO standards using real satellite data. ${ml(d.weakest[0])} scored ${d.weakest[1].toFixed(1)}.\n\nEvery city publishes goals. This is what's actually built.\n\n${d.prodUrl}`,
      (d) => `"We're investing in walkability" \u2014 ${d.shortName} city officials\n\n${d.score}/10 \u2014 SafeStreets audit using satellite data + NACTO standards\n\nOne of these is marketing. The other is measurement.\n\n${d.prodUrl}`,
    ],
    poor: [
      (d) => `${d.shortName} walkability: ${d.score}/10.\n\n${ml(d.weakest[0])} scored ${d.weakest[1].toFixed(1)}/10 against NACTO standards.\n\nNot terrible. Not safe. Measurably below global benchmarks.\n\nRun your street \u2192 ${d.prodUrl}`,
      (d) => `${d.score}/10 \u2014 that's ${d.shortName} measured against global street design standards using satellite imagery.\n\nNot great. Not hopeless. Worth knowing.\n\nCheck yours \u2192 ${d.prodUrl}`,
      (d) => `${d.shortName}: ${d.score}/10 walkability.\n\n${ml(d.weakest[0])}: ${d.weakest[1].toFixed(1)}/10.\n\nYou can't fix what you don't measure. Real satellite data, real standards.\n\n${d.prodUrl}`,
    ],
    fair: [
      (d) => `${d.shortName}: ${d.score}/10 walkability. Above average, but ${ml(d.weakest[0])} (${d.weakest[1].toFixed(1)}/10) drags it down.\n\nMeasured with satellite imagery against NACTO standards. Close to good \u2014 not there yet.\n\n${d.prodUrl}`,
      (d) => `${d.score}/10 for ${d.shortName}. Decent.\n\nBut ${ml(d.weakest[0])} at ${d.weakest[1].toFixed(1)}/10 means there's a specific, fixable problem.\n\nData from Sentinel-2 + OpenStreetMap, measured against NACTO/WHO.\n\n${d.prodUrl}`,
      (d) => `${d.shortName} walkability: ${d.score}/10.\n\nSolid foundation but ${ml(d.weakest[0])} needs work (${d.weakest[1].toFixed(1)}/10).\n\nEvidence-based audit, not opinion. Check your area \u2192\n\n${d.prodUrl}`,
    ],
    good: [
      (d) => `${d.shortName}: ${d.score}/10 walkability. Measurably good.\n\nSatellite imagery + NACTO/WHO standards confirm it. This is what investment looks like in the data.\n\n${d.prodUrl}`,
      (d) => `${d.score}/10. ${d.shortName} is measurably walkable.\n\nSatellite data + global street design standards. Proof that good infrastructure shows up in the numbers.\n\nHow does your neighborhood compare? \u2192 ${d.prodUrl}`,
      (d) => `${d.shortName}: ${d.score}/10 walkability. Real data, real standards.\n\nEven top-scoring areas have gaps \u2014 here it's ${ml(d.weakest[0])} at ${d.weakest[1].toFixed(1)}.\n\nNo city is finished. Run yours \u2192 ${d.prodUrl}`,
    ],
  },
  linkedin: {
    critical: [
      (d) => `I ran a walkability audit on ${d.shortName} using satellite imagery (Sentinel-2, Landsat) and OpenStreetMap data, measured against NACTO Global Street Design Standards and WHO pedestrian safety guidelines.\n\nOverall score: ${d.score}/10.\nWeakest metric: ${ml(d.weakest[0])} \u2014 ${d.weakest[1].toFixed(1)}/10.\n\nThis isn't a subjective review. These are 8 verified metrics derived from real geospatial data: crossing density, street connectivity, daily needs access, tree canopy (NDVI), surface temperature, air quality, heat island effect, and terrain slope.\n\nFree, open-source, and available for any address on Earth.\n\n${d.prodUrl}`,
      (d) => `Policy question: If ${d.shortName} scores ${d.score}/10 on a satellite-verified walkability audit using NACTO and WHO benchmarks, what does that mean for the people who walk there every day?\n\nIt means the gap between stated goals and built infrastructure is measurable. And now it's public.\n\nSafeStreets analyzes any location on Earth using Sentinel-2 imagery, SRTM elevation data, and OpenStreetMap. 8 metrics. Zero self-reported data. Free.\n\n${d.prodUrl}`,
    ],
    poor: [
      (d) => `I analyzed ${d.shortName}'s walkability using SafeStreets \u2014 a tool that measures 8 verified metrics against NACTO, WHO, and ADA standards using real satellite imagery.\n\nScore: ${d.score}/10.\nKey gap: ${ml(d.weakest[0])} at ${d.weakest[1].toFixed(1)}/10.\n\nThis puts ${d.shortName} below global benchmarks but within range of meaningful improvement. The data identifies exactly where investment would have the highest impact.\n\nThe tool is free, open-source, and works for any address.\n\n${d.prodUrl}`,
      (d) => `Most cities claim to prioritize walkability. Few measure it against global standards.\n\n${d.shortName} scores ${d.score}/10 when measured using satellite imagery against NACTO and WHO benchmarks. That's a specific, verifiable number \u2014 not a talking point.\n\nSafeStreets is an open-source tool that brings this analysis to any neighborhood. Because evidence should be available to everyone, not just consultants.\n\n${d.prodUrl}`,
    ],
    fair: [
      (d) => `${d.shortName} scored ${d.score}/10 on a satellite-based walkability audit \u2014 above average, but with clear room for improvement.\n\nThe analysis identified ${ml(d.weakest[0])} at ${d.weakest[1].toFixed(1)}/10 as the primary gap.\n\nThis is what "close to good" looks like in the data. The difference between a 6 and an 8 is often one or two specific infrastructure investments. Now we can see exactly which ones.\n\nFree and open-source \u2014 ${d.prodUrl}`,
      (d) => `${d.shortName}'s walkability: ${d.score}/10. Solid, not excellent.\n\nSatellite analysis against NACTO standards shows ${ml(d.weakest[0])} at ${d.weakest[1].toFixed(1)}/10 is the bottleneck.\n\nA fair score is actually the most interesting \u2014 it means the foundation exists but specific improvements could make a real difference.\n\n${d.prodUrl}`,
    ],
    good: [
      (d) => `${d.shortName} scored ${d.score}/10 on a satellite-verified walkability audit \u2014 and the data shows why.\n\nStrong performance across NACTO, WHO, and ADA benchmarks. Even here, ${ml(d.weakest[0])} (${d.weakest[1].toFixed(1)}/10) shows where continued investment matters.\n\nThis is what good urban infrastructure looks like when you measure it with satellite imagery instead of surveys.\n\nSafeStreets is free and open-source \u2014 ${d.prodUrl}`,
      (d) => `When we say a neighborhood is "walkable," what does that actually mean in measurable terms?\n\n${d.shortName}: ${d.score}/10 across 8 verified metrics. Measured with satellite imagery against NACTO and WHO standards.\n\nThis is the benchmark. How does your city compare?\n\n${d.prodUrl}`,
    ],
  },
  facebook: {
    critical: [
      (d) => `I just ran a walkability analysis on ${d.shortName} using a tool that measures real satellite imagery against global street design standards.\n\nScore: ${d.score} out of 10. ${ml(d.weakest[0])} scored ${d.weakest[1].toFixed(1)} out of 10.\n\nThat's not my opinion \u2014 it's what shows up in Sentinel-2 satellite data measured against the same NACTO and WHO standards that cities worldwide use.\n\nThe tool is free and works for any address. If you've ever felt unsafe walking in your neighborhood, now you have the data to prove it.\n\n${d.prodUrl}`,
      (d) => `${d.score}/10.\n\nThat's how ${d.shortName} scores on walkability when you measure it with satellite imagery instead of marketing brochures.\n\nSafeStreets uses 8 verified metrics based on international standards. Free, open-source, and designed so anyone can see what the data actually says.\n\nYour neighborhood has a score too \u2014 ${d.prodUrl}`,
    ],
    poor: [
      (d) => `Ran a walkability audit on ${d.shortName} \u2014 score: ${d.score}/10.\n\nThe tool uses satellite imagery and measures against international standards. ${ml(d.weakest[0])} was the weakest at ${d.weakest[1].toFixed(1)}/10.\n\nNot great, but not hopeless. The interesting part is seeing exactly what's wrong and what would fix it. Data beats complaints.\n\nFree for any address: ${d.prodUrl}`,
      (d) => `Just checked ${d.shortName}'s walkability score: ${d.score}/10.\n\nUsed SafeStreets, which analyzes real satellite imagery against global street design standards. ${ml(d.weakest[0])} came in at ${d.weakest[1].toFixed(1)}/10 \u2014 that's the biggest gap.\n\nThe thing I like: it turns "this street feels unsafe" into actual evidence you can show to your city council.\n\nFree, any address \u2014 ${d.prodUrl}`,
    ],
    fair: [
      (d) => `${d.shortName} scores ${d.score}/10 on walkability \u2014 not bad, but ${ml(d.weakest[0])} at ${d.weakest[1].toFixed(1)}/10 shows there's still work to do.\n\nThe analysis uses satellite imagery measured against NACTO and WHO standards. A fair score means the foundation is there. It also means specific improvements could make a real difference.\n\nCheck your area: ${d.prodUrl}`,
      (d) => `Interesting \u2014 ${d.shortName} scores ${d.score}/10 on walkability when you measure it with actual satellite data instead of guessing.\n\nSafeStreets checks 8 different metrics against international standards. Free for any address.\n\nWorth checking yours: ${d.prodUrl}`,
    ],
    good: [
      (d) => `${d.shortName}: ${d.score}/10 on walkability. That's genuinely good.\n\nMeasured with satellite imagery against NACTO and WHO standards. Scores like this don't happen by accident \u2014 they reflect real infrastructure investment.\n\nCurious how your neighborhood compares? Free \u2014 ${d.prodUrl}`,
      (d) => `This is what a ${d.score}/10 walkability score looks like \u2014 ${d.shortName}, measured with real satellite imagery against international street design standards.\n\nGood infrastructure is measurable. SafeStreets checks 8 metrics and it's free for any address.\n\nWorth running on your neighborhood: ${d.prodUrl}`,
    ],
  },
};

// Pick a random template from the available variants for a platform + score range
function pickTemplate(platform: string, scoreRange: string): TemplateFn {
  const templates = SHARE_TEMPLATES[platform]?.[scoreRange];
  if (!templates || templates.length === 0) {
    // Fallback
    return (d) => `${d.shortName} walkability: ${d.score}/10. Check yours: ${d.prodUrl}`;
  }
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

export default function ShareButtons({ location, metrics, dataQuality, isPremium = false, onUnlock }: ShareButtonsProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Build shareable URL with location params
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.displayName)}`;
  const prodUrl = `https://safestreets.app/?lat=${location.lat}&lon=${location.lon}`;
  const shortName = location.city || location.displayName.split(',')[0] || 'This area';
  const score = metrics.overallScore.toFixed(1);
  const scoreRange = getRange(metrics.overallScore);

  // Find weakest metric for dynamic messaging
  const metricEntries: [string, number | undefined][] = [
    ['crossings', metrics.crossingDensity],
    ['street connectivity', metrics.networkEfficiency],
    ['daily needs access', metrics.destinationAccess],
    ['tree canopy', metrics.treeCanopy],
    ['air quality', metrics.airQuality],
    ['heat resilience', metrics.surfaceTemp],
    ['heat island', metrics.heatIsland],
    ['terrain', metrics.slope],
  ];
  const weakest: [string, number] = metricEntries
    .filter((e): e is [string, number] => typeof e[1] === 'number')
    .sort((a, b) => a[1] - b[1])[0] || ['walkability', metrics.overallScore];

  const shareData: ShareData = { shortName, score, prodUrl, weakest };

  // Build platform-specific text
  const buildText = (platform: string): string => {
    return pickTemplate(platform, scoreRange)(shareData);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link');
    }
  };

  const handleCopyShareText = async () => {
    const text = buildText('linkedin');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      alert('Could not copy. Here is the text:\n\n' + text);
    }
  };

  const handleShareTwitter = async () => {
    const tweetText = buildText('twitter');
    const popup = window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'width=550,height=420');

    if (!popup || popup.closed) {
      try {
        await navigator.clipboard.writeText(tweetText);
        alert('Tweet copied to clipboard! Paste it on X.');
      } catch {
        alert('Could not open X. Copy this post:\n\n' + tweetText);
      }
    }
  };

  const handleShareFacebook = async () => {
    const popup = window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(prodUrl)}`, '_blank', 'width=550,height=420');

    if (!popup || popup.closed) {
      try {
        await navigator.clipboard.writeText(buildText('facebook'));
        alert('Post copied to clipboard! Paste it on Facebook.');
      } catch {
        alert('Could not open Facebook. Share this link:\n\n' + prodUrl);
      }
    }
  };

  const handleShareLinkedIn = async () => {
    const popup = window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(prodUrl)}`, '_blank', 'width=550,height=420');

    if (!popup || popup.closed) {
      try {
        await navigator.clipboard.writeText(buildText('linkedin'));
        alert('Post copied to clipboard! Paste it on LinkedIn.');
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
          className={`w-full px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <span>{copied ? '\u2713' : '\uD83D\uDD17'}</span>
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>

        {/* Copy Share Text */}
        <button
          onClick={handleCopyShareText}
          className={`w-full px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border ${copiedText ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
        >
          <span>{copiedText ? '\u2713' : '\uD83D\uDCCB'}</span>
          <span>{copiedText ? 'Copied!' : 'Copy Share Text'}</span>
        </button>

        {/* Social Media Shares */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleShareTwitter}
            className="px-4 py-3 rounded-xl font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-all text-sm"
          >
            X
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
        {isPremium ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportJSON}
              className="px-4 py-3 rounded-xl font-semibold text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.accent }}
            >
              <span>{'\uD83D\uDCE5'}</span>
              <span>JSON</span>
            </button>
            <button
              onClick={handleGeneratePDF}
              className="px-4 py-3 rounded-xl font-semibold text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.primary }}
            >
              <span>{'\uD83D\uDCC4'}</span>
              <span>PDF Report</span>
            </button>
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-r from-orange-50 to-blue-50 border-2 border-orange-200 rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 mb-1">{'\uD83D\uDD12'} PDF Report + Data Export</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Download professional PDF reports and raw JSON data with the Advocate tier.
                </p>
                <p className="text-lg font-bold text-orange-600">$19 one-time</p>
              </div>
              <button
                onClick={() => onUnlock ? onUnlock() : setShowPaymentModal(true)}
                className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:shadow-lg whitespace-nowrap"
                style={{ backgroundColor: COLORS.accent }}
              >
                Unlock {'\u2192'}
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center mt-4">
          Evidence-based sharing. Every post references real data and global standards.
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
