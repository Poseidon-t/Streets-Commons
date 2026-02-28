import { useState } from 'react';
import { COLORS } from '../constants';
import { trackEvent } from '../utils/analytics';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';

interface ShareButtonsProps {
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality?: DataQuality;
  isPremium?: boolean;
  onShareReport?: () => void;
}

// Metric label mapping for human-readable share text
const METRIC_LABELS: Record<string, string> = {
  'crossing safety': 'crossing safety',
  sidewalks: 'sidewalk coverage',
  'traffic speed safety': 'traffic speed safety',
  'daily needs access': 'daily needs access',
  'night safety': 'street lighting',
  'tree canopy': 'tree canopy coverage',
  'thermal comfort': 'thermal comfort',
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
      (d) => `I ran a walkability audit on ${d.shortName} using satellite imagery (Sentinel-2, Landsat) and OpenStreetMap data, measured against NACTO Global Street Design Standards and WHO pedestrian safety guidelines.\n\nOverall score: ${d.score}/10.\nWeakest metric: ${ml(d.weakest[0])} \u2014 ${d.weakest[1].toFixed(1)}/10.\n\nThis isn't a subjective review. These are 8 verified metrics derived from real geospatial data: crossing safety, sidewalk coverage, traffic speed, daily needs access, night safety, terrain slope, tree canopy (NDVI), and thermal comfort.\n\nFree, open-source, and available for any address on Earth.\n\n${d.prodUrl}`,
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

export default function ShareButtons({ location, metrics, dataQuality, isPremium = false, onShareReport }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Build shareable URL with location params
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.displayName)}`;
  const buildShareUrl = (platform: string) =>
    `https://safestreets.streetsandcommons.com/?lat=${location.lat}&lon=${location.lon}&utm_source=${platform}&utm_medium=social&utm_campaign=share`;
  const prodUrl = buildShareUrl('organic');
  const shortName = location.city || location.displayName.split(',')[0] || 'This area';
  const score = metrics.overallScore.toFixed(1);
  const scoreRange = getRange(metrics.overallScore);

  // Find weakest metric for dynamic messaging
  const metricEntries: [string, number | undefined][] = [
    ['crossing safety', metrics.crossingSafety],
    ['sidewalks', metrics.sidewalkCoverage],
    ['traffic speed safety', metrics.speedExposure],
    ['daily needs access', metrics.destinationAccess],
    ['night safety', metrics.nightSafety],
    ['tree canopy', metrics.treeCanopy],
    ['thermal comfort', metrics.thermalComfort],
    ['terrain', metrics.slope],
  ];
  const weakest: [string, number] = metricEntries
    .filter((e): e is [string, number] => typeof e[1] === 'number')
    .sort((a, b) => a[1] - b[1])[0] || ['walkability', metrics.overallScore];

  const shareData: ShareData = { shortName, score, prodUrl, weakest };

  // Build platform-specific text with UTM-tagged URL
  const buildText = (platform: string): string => {
    const data = { ...shareData, prodUrl: buildShareUrl(platform) };
    return pickTemplate(platform, scoreRange)(data);
  };

  const handleCopyLink = async () => {
    trackEvent('share_click', { platform: 'copy_link' });
    try {
      await navigator.clipboard.writeText(buildShareUrl('link'));
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
    trackEvent('share_click', { platform: 'twitter' });
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
    trackEvent('share_click', { platform: 'facebook' });
    const fbUrl = buildShareUrl('facebook');
    const popup = window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fbUrl)}`, '_blank', 'width=550,height=420');

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
    trackEvent('share_click', { platform: 'linkedin' });
    const liUrl = buildShareUrl('linkedin');
    const popup = window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(liUrl)}`, '_blank', 'width=550,height=420');

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
        crossingSafety: metrics.crossingSafety,
        sidewalkCoverage: metrics.sidewalkCoverage,
        speedExposure: metrics.speedExposure,
        destinationAccess: metrics.destinationAccess,
        nightSafety: metrics.nightSafety,
        slope: metrics.slope,
        treeCanopy: metrics.treeCanopy,
        thermalComfort: metrics.thermalComfort,
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
    <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: '#2a3a2a' }}>Share & Export</h3>
        <span className="text-[10px]" style={{ color: '#b0a8a0' }}>Every post references real data and global standards</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Copy buttons */}
        <button
          onClick={handleCopyLink}
          className="px-3 py-2 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5"
          style={copied ? { backgroundColor: 'rgba(101,163,13,0.1)', color: '#65a30d' } : { backgroundColor: '#f8f6f1', color: '#2a3a2a' }}
        >
          <span>{copied ? '\u2713' : '\uD83D\uDD17'}</span>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={handleCopyShareText}
          className="px-3 py-2 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5"
          style={copiedText ? { backgroundColor: 'rgba(101,163,13,0.1)', color: '#65a30d' } : { backgroundColor: '#f8f6f1', color: '#2a3a2a' }}
        >
          <span>{copiedText ? '\u2713' : '\uD83D\uDCCB'}</span>
          {copiedText ? 'Copied!' : 'Share Text'}
        </button>

        {/* Divider */}
        <div className="w-px h-5 mx-0.5" style={{ backgroundColor: '#e0dbd0' }} />

        {/* Social */}
        <button onClick={handleShareTwitter} className="px-3 py-2 rounded-lg font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-all text-xs">X</button>
        <button onClick={handleShareFacebook} className="px-3 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all text-xs">Facebook</button>
        <button onClick={handleShareLinkedIn} className="px-3 py-2 rounded-lg font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-all text-xs">LinkedIn</button>

        {/* Share Report (image card) */}
        {onShareReport && (
          <>
            <div className="w-px h-5 mx-0.5" style={{ backgroundColor: '#e0dbd0' }} />
            <button
              onClick={onShareReport}
              className="px-3 py-2 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 border"
              style={{ borderColor: '#e0dbd0', color: '#2a3a2a' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
            </button>
          </>
        )}

        {/* PDF Report — free for all users */}
        <div className="w-px h-5 mx-0.5" style={{ backgroundColor: '#e0dbd0' }} />
        <button
          onClick={handleGeneratePDF}
          className="px-3 py-2 rounded-lg font-semibold text-white hover:shadow-md transition-all text-xs"
          style={{ backgroundColor: COLORS.primary }}
        >
          PDF Report
        </button>

        {/* JSON Export — premium only */}
        {isPremium && (
          <>
            <div className="w-px h-5 mx-0.5" style={{ backgroundColor: '#e0dbd0' }} />
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-lg font-semibold text-white hover:shadow-md transition-all text-xs"
              style={{ backgroundColor: COLORS.accent }}
            >
              JSON
            </button>
          </>
        )}
      </div>
    </div>
  );
}
