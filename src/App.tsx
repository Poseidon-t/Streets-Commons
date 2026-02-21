import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import AddressInput from './components/streetcheck/AddressInput';
import ScoreCard from './components/streetcheck/ScoreCard';
import MetricGrid from './components/streetcheck/MetricGrid';
import Map from './components/Map';
import ActivationHandler from './components/ActivationHandler';
import PaymentModalWithAuth from './components/PaymentModalWithAuth';

import ErrorBoundary from './components/ErrorBoundary';

// Lazy-load heavy components (only loaded when needed)
const CompareView = lazy(() => import('./components/CompareView'));
const ShareButtons = lazy(() => import('./components/ShareButtons'));
const StreetCrossSection = lazy(() => import('./components/StreetCrossSection'));
const AdvocacyLetterModal = lazy(() => import('./components/AdvocacyLetterModal'));
const FifteenMinuteCity = lazy(() => import('./components/FifteenMinuteCity'));
const AdvocacyChatbot = lazy(() => import('./components/AdvocacyChatbot'));
const ShareableReportCard = lazy(() => import('./components/ShareableReportCard'));
const StreetAuditTool = lazy(() => import('./components/StreetAuditTool'));
const EmailCaptureBanner = lazy(() => import('./components/EmailCaptureBanner'));
const ProductTour = lazy(() => import('./components/ProductTour'));
const DemoBanner = lazy(() => import('./components/DemoBanner'));

import { captureUTMParams } from './utils/utm';
import { trackEvent } from './utils/analytics';
import { fetchOSMData } from './services/overpass';
import { calculateMetrics, assessDataQuality } from './utils/metrics';
import { fetchSlope, scoreSlopeFromDegrees } from './services/elevation';
import { fetchNDVI, scoreTreeCanopy } from './services/treecanopy';
import { fetchSurfaceTemperature } from './services/surfacetemperature';
import { fetchAirQuality } from './services/airquality';
import { fetchHeatIsland } from './services/heatisland';
import { fetchCrashData } from './services/crashdata';
import { fetchPopulationDensity } from './services/populationDensity';
import { fetchDemographicData } from './services/demographics';
import { calculateCompositeScore } from './utils/compositeScore';
import { getAccessInfo } from './utils/premiumAccess';
import { useUser, UserButton } from '@clerk/clerk-react';
import { isPremium } from './utils/clerkAccess';
import { getSavedAddresses, saveAddress, removeAddress, MAX_ADDRESSES, type SavedAddress } from './utils/savedAddresses';
import { COLORS } from './constants';
import { analyzeLocalEconomy } from './utils/localEconomicAnalysis';
import type { Location, WalkabilityMetrics, DataQuality, OSMData, RawMetricData, CrashData, WalkabilityScoreV2, DemographicData } from './types';
import type { CrossSectionSnapshot } from './components/StreetCrossSection';

interface AnalysisData {
  location: Location;
  metrics: WalkabilityMetrics;
  quality: DataQuality;
  osmData: OSMData;
  compositeScore?: WalkabilityScoreV2 | null;
  crashData?: CrashData | null;
}

function App() {
  const [compareMode, setCompareMode] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [metrics, setMetrics] = useState<WalkabilityMetrics | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [osmData, setOsmData] = useState<OSMData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [satelliteLoaded, setSatelliteLoaded] = useState<Set<string>>(new Set());
  const [rawMetricData, setRawMetricData] = useState<RawMetricData>({});
  const [crashData, setCrashData] = useState<CrashData | null>(null);
  const [crashLoading, setCrashLoading] = useState(false);
  const [compositeScore, setCompositeScore] = useState<WalkabilityScoreV2 | null>(null);
  const [buildingDensityScore, setBuildingDensityScore] = useState<number | undefined>();
  const [populationDensityScore, setPopulationDensityScore] = useState<number | undefined>();
  const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
  const [demographicLoading, setDemographicLoading] = useState(false);
  const [crossSectionSnapshot, setCrossSectionSnapshot] = useState<CrossSectionSnapshot | null>(null);

  // Premium access - Clerk integration
  const { user, isSignedIn } = useUser();
  const userIsPremium = isPremium(user);

  // Backward compatibility with magic link system
  const accessInfo = getAccessInfo();

  // Demo mode + product tour
  const [demoMode, setDemoMode] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Effective premium: real premium OR demo mode (used for 6 of 8 gates)
  const effectivePremium = userIsPremium || accessInfo.tier !== 'free' || demoMode;

  // Compare mode state
  const [location1, setLocation1] = useState<AnalysisData | null>(null);
  const [location2, setLocation2] = useState<AnalysisData | null>(null);
  const [isAnalyzingCompare, setIsAnalyzingCompare] = useState<1 | 2 | null>(null);

  // Abort controller for satellite data fetches (prevents stale updates on location change)
  const satelliteAbortRef = useRef<AbortController | null>(null);

  // FAQ accordion state (for mobile)
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);

  // Sign-in modal state (was payment modal — now all features are free)
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('safestreets_seen_onboarding'); } catch { return true; }
  });

  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentPollingFailed, setPaymentPollingFailed] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedAddressList, setSavedAddressList] = useState<SavedAddress[]>(() => getSavedAddresses());
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);
  const [showAuditTool, setShowAuditTool] = useState(false);
  const [demoNudge, setDemoNudge] = useState(false);
  const demoNudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [meridianQuote, setMeridianQuote] = useState<{ text: string; author: string } | null>(null);

  // Show demo upgrade nudge after using a premium feature
  const showDemoNudge = () => {
    if (!demoMode) return;
    if (demoNudgeTimer.current) clearTimeout(demoNudgeTimer.current);
    setDemoNudge(true);
    demoNudgeTimer.current = setTimeout(() => setDemoNudge(false), 6000);
  };

  // Capture UTM params on mount
  useEffect(() => { captureUTMParams(); }, []);

  // Cleanup: abort satellite fetches on unmount
  useEffect(() => {
    return () => {
      if (satelliteAbortRef.current) {
        satelliteAbortRef.current.abort();
      }
    };
  }, []);

  // Meridian philosophy quote — show when analysis completes
  const MERIDIAN_QUOTES = useRef([
    // Score-agnostic (always relevant)
    { text: 'Cities have the capability of providing something for everybody, only because, and only when, they are created by everybody.', author: 'Jane Jacobs' },
    { text: 'First life, then spaces, then buildings — the other way around never works.', author: 'Jan Gehl' },
    { text: 'The city is not a problem. The city is a solution.', author: 'Jaime Lerner' },
    { text: 'A good city is like a good party — people stay longer than really necessary, because they are enjoying themselves.', author: 'Jan Gehl' },
    { text: 'Walkable places are the foundations on which productive cities and healthy communities are built.', author: 'Jeff Speck' },
    { text: 'The street is the river of life of the city.', author: 'William H. Whyte' },
    { text: 'There is no logic that can be superimposed on the city; people make it, and it is to them, not buildings, that we must fit our plans.', author: 'Jane Jacobs' },
    { text: 'A city built for speed is a city built for nobody.', author: 'Jeff Speck' },
  ]).current;

  useEffect(() => {
    if (!metrics) { setMeridianQuote(null); return; }
    const quote = MERIDIAN_QUOTES[Math.floor(Math.random() * MERIDIAN_QUOTES.length)];
    setMeridianQuote(quote);
    const timer = setTimeout(() => setMeridianQuote(null), 12000);
    return () => clearTimeout(timer);
  }, [metrics, MERIDIAN_QUOTES]);

  // Payment return flow: detect ?payment=success, poll for confirmation, reload
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');

    // Clean URL params regardless of outcome
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('tier');
      window.history.replaceState({}, '', url.toString());
    };

    if (paymentStatus === 'success' && user?.id) {
      setShowPaymentSuccess(true);
      cleanUrl();

      const apiUrl = import.meta.env.VITE_API_URL || '';
      let attempts = 0;
      const maxAttempts = 30; // 30 × 2s = 60s

      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`${apiUrl}/api/verify-payment?userId=${user.id}`);
          if (!res.ok) return; // Server error — keep polling
          const data = await res.json();
          if (data.tier === 'advocate') {
            clearInterval(poll);
            // Reload to pick up fresh Clerk user object with updated metadata
            window.location.reload();
          }
        } catch {
          // Network error — keep polling
        }
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setPaymentPollingFailed(true);
        }
      }, 2000);

      return () => clearInterval(poll);
    } else if (paymentStatus === 'cancelled') {
      cleanUrl();
    } else if (paymentStatus) {
      cleanUrl();
    }
  }, [user?.id]);

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

  // Dynamic page title — updates when analysis loads
  useEffect(() => {
    if (location && compositeScore) {
      const shortName = location.displayName.split(',').slice(0, 2).join(',').trim();
      const grade = compositeScore.grade || '';
      const score = compositeScore.overallScore ? (compositeScore.overallScore / 10).toFixed(1) : '';
      document.title = `${shortName} — Walkability Score ${score}/10 (${grade}) | SafeStreets`;
    } else if (isAnalyzing && location) {
      document.title = `Analyzing ${location.displayName.split(',')[0]}... | SafeStreets`;
    } else if (compareMode) {
      document.title = 'Compare Mode — SafeStreets Walkability Analysis';
    } else {
      document.title = 'SafeStreets — Is Your Street Safe to Walk? | Free Satellite Analysis';
    }
  }, [location, compositeScore, isAnalyzing, compareMode]);

  const handleLocationSelect = async (selectedLocation: Location) => {
    // Single location mode only (compare mode has inline handlers)
    setLocation(selectedLocation);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setMetrics(null);
    setSatelliteLoaded(new Set());
    setCrashData(null);
    setCrashLoading(true);
    setCompositeScore(null);
    setBuildingDensityScore(undefined);
    setPopulationDensityScore(undefined);
    setDemographicData(null);
    setDemographicLoading(false);

    // Cancel any in-flight satellite fetches from previous location
    if (satelliteAbortRef.current) {
      satelliteAbortRef.current.abort();
    }
    const abortController = new AbortController();
    satelliteAbortRef.current = abortController;

    // Fire OSM, satellite, and crash data requests simultaneously
    const osmPromise = fetchOSMData(selectedLocation.lat, selectedLocation.lon);
    const satellitePromises = startSatelliteFetches(selectedLocation);

    // Crash data fetch (non-blocking, runs in parallel — also piped into satellite promises)
    const crashPromise = fetchCrashData(selectedLocation.lat, selectedLocation.lon, selectedLocation.countryCode)
      .then(data => {
        if (!abortController.signal.aborted) {
          setCrashData(data);
          setCrashLoading(false);
        }
        return data;
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setCrashLoading(false);
        }
        return null;
      });

    try {
      // Wait for OSM data first (needed for core metrics)
      const fetchedOsmData = await osmPromise;
      const calculatedMetrics = calculateMetrics(
        fetchedOsmData,
        selectedLocation.lat,
        selectedLocation.lon,
        undefined, undefined, undefined, undefined, undefined
      );
      const quality = assessDataQuality(fetchedOsmData);

      setOsmData(fetchedOsmData);
      setMetrics(calculatedMetrics);
      setDataQuality(quality);
      setIsAnalyzing(false);

      // Track analysis completion
      trackEvent('analysis_complete', {
        location: { displayName: selectedLocation.displayName, lat: selectedLocation.lat, lon: selectedLocation.lon },
      });

      // Compute initial composite score from OSM data alone
      setCompositeScore(calculateCompositeScore({
        legacy: calculatedMetrics,
        networkGraph: fetchedOsmData.networkGraph,
      }));

      // Update URL with current location (shareable link)
      const url = new URL(window.location.href);
      url.searchParams.set('lat', selectedLocation.lat.toString());
      url.searchParams.set('lon', selectedLocation.lon.toString());
      url.searchParams.set('name', encodeURIComponent(selectedLocation.displayName));
      window.history.pushState({}, '', url);

      // Progressively update metrics as satellite data arrives
      // (requests were already fired above, now just await results)
      progressivelyUpdateMetrics(selectedLocation, fetchedOsmData, satellitePromises, abortController, crashPromise);

    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisError('Failed to analyze location. Please try again.');
      setIsAnalyzing(false);
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

  // Demo mode: load pre-baked Portland data, show all features
  const activateDemoMode = async () => {
    setDemoMode(true);
    setCompareMode(false);
    setIsAnalyzing(true);

    const {
      DEMO_LOCATION, DEMO_METRICS, DEMO_COMPOSITE_SCORE, DEMO_DATA_QUALITY,
      DEMO_CRASH_DATA, DEMO_DEMOGRAPHIC_DATA, DEMO_RAW_METRIC_DATA,
      DEMO_OSM_DATA, DEMO_SATELLITE_SOURCES,
    } = await import('./data/demoData');

    setLocation(DEMO_LOCATION);
    setMetrics(DEMO_METRICS);
    setCompositeScore(DEMO_COMPOSITE_SCORE);
    setDataQuality(DEMO_DATA_QUALITY);
    setCrashData(DEMO_CRASH_DATA);
    setCrashLoading(false);
    setDemographicData(DEMO_DEMOGRAPHIC_DATA);
    setRawMetricData(DEMO_RAW_METRIC_DATA);
    setOsmData(DEMO_OSM_DATA as any);
    setSatelliteLoaded(new Set(DEMO_SATELLITE_SOURCES));
    setIsAnalyzing(false);

    // Always start tour in demo mode — users clicking "Watch Demo" expect the guided walkthrough
    setTimeout(() => setShowTour(true), 800);
  };

  const exitDemoMode = () => {
    setDemoMode(false);
    setShowTour(false);
    setDemoNudge(false);
    if (demoNudgeTimer.current) { clearTimeout(demoNudgeTimer.current); demoNudgeTimer.current = null; }
    setLocation(null);
    setMetrics(null);
    setCompositeScore(null);
    setDataQuality(null);
    setCrashData(null);
    setCrashLoading(false);
    setDemographicData(null);
    setDemographicLoading(false);
    setRawMetricData({});
    setOsmData(null);
    setSatelliteLoaded(new Set());
    setBuildingDensityScore(undefined);
    setPopulationDensityScore(undefined);

    // Clean URL
    window.history.pushState({}, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Start all satellite fetches immediately (called before OSM completes)
  const startSatelliteFetches = (selectedLocation: Location) => ({
    slope: fetchSlope(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    ndvi: fetchNDVI(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    surfaceTemp: fetchSurfaceTemperature(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    airQuality: fetchAirQuality(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    heatIsland: fetchHeatIsland(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    populationDensity: fetchPopulationDensity(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    demographics: fetchDemographicData(selectedLocation.lat, selectedLocation.lon, selectedLocation.countryCode)
      .catch(() => null),
  });

  // Progressively update metrics as each satellite result arrives
  const progressivelyUpdateMetrics = (
    selectedLocation: Location,
    currentOsmData: OSMData,
    promises: ReturnType<typeof startSatelliteFetches>,
    abortController: AbortController,
    crashPromise: Promise<CrashData | null>
  ) => {
    const scores: {
      slope?: number;
      ndvi?: number;
      surfaceTemp?: number;
      airQuality?: number;
      heatIsland?: number;
    } = {};
    const extra: {
      buildingDensity?: number;
      populationDensity?: number;
      crashData?: CrashData | null;
    } = {};
    const raw: RawMetricData = {
      crossingCount: currentOsmData.crossings?.length,
      poiCount: currentOsmData.pois?.length,
      streetLength: currentOsmData.streets?.reduce((sum, s) => sum + (s.length || 0), 0),
    };

    const recalc = () => {
      if (abortController.signal.aborted) return;
      const updatedMetrics = calculateMetrics(
        currentOsmData,
        selectedLocation.lat,
        selectedLocation.lon,
        scores.slope,
        scores.ndvi,
        scores.surfaceTemp,
        scores.airQuality,
        scores.heatIsland
      );
      setMetrics(updatedMetrics);
      setRawMetricData({ ...raw });

      // Recompute composite score with latest data
      const composite = calculateCompositeScore({
        legacy: updatedMetrics,
        networkGraph: currentOsmData.networkGraph,
        buildingDensityScore: extra.buildingDensity,
        populationDensityScore: extra.populationDensity,
        crashData: extra.crashData,
      });
      setCompositeScore(composite);
    };

    const markLoaded = (key: string) => {
      if (abortController.signal.aborted) return;
      setSatelliteLoaded(prev => new Set(prev).add(key));
    };

    promises.slope.then(slopeDeg => {
      if (slopeDeg !== null) {
        raw.slopeDegrees = slopeDeg;
        scores.slope = scoreSlopeFromDegrees(slopeDeg);
      }
      markLoaded('slope');
      recalc();
    });
    promises.ndvi.then(ndvi => {
      if (ndvi !== null) {
        raw.ndvi = ndvi;
        scores.ndvi = scoreTreeCanopy(ndvi);
      }
      markLoaded('treeCanopy');
      recalc();
    });
    promises.surfaceTemp.then(result => {
      if (result) {
        raw.temperature = result.tempCelsius;
        scores.surfaceTemp = result.score;
      }
      if (scores.heatIsland !== undefined) markLoaded('thermalComfort');
      recalc();
    });
    promises.airQuality.then(result => {
      if (result) {
        scores.airQuality = result.score;
      }
      recalc();
    });
    promises.heatIsland.then(result => {
      if (result) {
        raw.heatDifference = result.effect ?? undefined;
        scores.heatIsland = result.score;
        // Extract building density (NDBI) from same response
        if (result.buildingDensity) {
          extra.buildingDensity = result.buildingDensity.score;
          setBuildingDensityScore(result.buildingDensity.score);
          markLoaded('buildingDensity');
        }
      }
      if (scores.surfaceTemp !== undefined) markLoaded('thermalComfort');
      recalc();
    });
    promises.populationDensity.then(result => {
      if (result) {
        extra.populationDensity = result.score;
        setPopulationDensityScore(result.score);
        markLoaded('populationDensity');
      }
      recalc();
    });
    crashPromise.then(data => {
      extra.crashData = data;
      recalc();
    });
    setDemographicLoading(true);
    promises.demographics.then(result => {
      setDemographicData(result);
      setDemographicLoading(false);
      markLoaded('demographics');
    });
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #f2f0eb 30%, #eef5f0 60%, #f0ede8 100%)' }}>
      {/* Activation Handler - Processes magic link tokens */}
      <ActivationHandler />

      {/* Sign-In Modal */}
      <PaymentModalWithAuth
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        locationName={location?.displayName || ''}
      />

      {/* Shareable Report Card Modal */}
      {location && metrics && (
        <Suspense fallback={null}>
          <ShareableReportCard
            isOpen={showReportCard}
            onClose={() => setShowReportCard(false)}
            location={location}
            metrics={metrics}
            compositeScore={compositeScore}
          />
        </Suspense>
      )}

      {/* AI Advocacy Letter Modal */}
      {location && metrics && (
        <Suspense fallback={null}>
          <AdvocacyLetterModal
            isOpen={showLetterModal}
            onClose={() => setShowLetterModal(false)}
            location={location}
            metrics={metrics}
            compositeScore={compositeScore}
            crashData={crashData}
            demographicData={demographicData}
          />
        </Suspense>
      )}

      {/* Custom styles for light aesthetic */}
      <style>{`
        .search-box-light {
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
          transition: box-shadow 0.3s ease, transform 0.3s ease;
        }
        .search-box-light:focus-within {
          box-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
        .source-tag-light {
          transition: all 0.2s ease;
        }
        .source-tag-light:hover {
          background: rgba(74, 138, 60, 0.15) !important;
          transform: translateY(-1px);
        }
      `}</style>

      {/* Header - Light earthy aesthetic */}
      <header className="relative z-20 border-b border-earth-border bg-earth-cream">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              setLocation(null);
              setMetrics(null);
              setDataQuality(null);
              setOsmData(null);
              setCompareMode(false);
              setLocation1(null);
              setLocation2(null);
              setDemoMode(false);
              setShowTour(false);
              setDemoNudge(false);
              if (demoNudgeTimer.current) { clearTimeout(demoNudgeTimer.current); demoNudgeTimer.current = null; }
              setMobileMenuOpen(false);
              setShowSignInModal(false);
              window.history.pushState({}, '', window.location.pathname);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <svg width="40" height="40" viewBox="0 0 44 44">
              <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850"/>
              <rect x="10" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="19" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="28" y="14" width="6" height="16" fill="white" rx="1"/>
            </svg>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight font-sans text-earth-text-dark">SafeStreets</h1>
              <p className="text-xs tracking-wider uppercase font-mono text-earth-text-mid">Walkability Analysis</p>
            </div>
          </button>
          <div className="flex items-center gap-4">
            {!isSignedIn && (
              <button onClick={() => setShowSignInModal(true)} className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body cursor-pointer bg-transparent border-none">Sign In</button>
            )}
            {!effectivePremium && (
              <button
                onClick={() => setShowSignInModal(true)}
                className="text-sm font-bold px-4 py-1.5 rounded-lg transition-all hover:shadow-md bg-terra text-white"
              >
                Go Premium — $49
              </button>
            )}
            <a href="#faq" onClick={(e) => { if (location || compareMode || demoMode) { e.preventDefault(); setCompareMode(false); setLocation(null); setMetrics(null); setDemoMode(false); setShowTour(false); setDemoNudge(false); if (demoNudgeTimer.current) { clearTimeout(demoNudgeTimer.current); demoNudgeTimer.current = null; } setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); }}} className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">FAQ</a>
            <a href="/blog" className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">Blog</a>
            <a href="/learn" className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">Learn</a>
            <a href="/enterprise" className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">Enterprise</a>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9 rounded-full border-2 border-gray-300 shadow-sm',
                  userButtonPopoverCard: 'shadow-xl',
                },
              }}
            />
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg transition-colors text-earth-text-body"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-earth-border bg-earth-cream px-6 py-3 space-y-2">
            <a href="/blog" className="block text-sm font-medium py-2 text-earth-text-body" onClick={() => setMobileMenuOpen(false)}>Blog</a>
            <a href="/learn" className="block text-sm font-medium py-2 text-earth-text-body" onClick={() => setMobileMenuOpen(false)}>Learn</a>
            <a href="#faq" className="block text-sm font-medium py-2 text-earth-text-body" onClick={(e) => { if (location || compareMode || demoMode) { e.preventDefault(); setCompareMode(false); setLocation(null); setMetrics(null); setDemoMode(false); setShowTour(false); setDemoNudge(false); if (demoNudgeTimer.current) { clearTimeout(demoNudgeTimer.current); demoNudgeTimer.current = null; } setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); } setMobileMenuOpen(false); }}>FAQ</a>
            <a href="/enterprise" className="block text-sm font-medium py-2 text-earth-text-body" onClick={() => setMobileMenuOpen(false)}>Enterprise</a>
            {!isSignedIn && (
              <button onClick={() => { setShowSignInModal(true); setMobileMenuOpen(false); }} className="block text-sm font-medium py-2 text-earth-text-body cursor-pointer bg-transparent border-none w-full text-left">Sign In</button>
            )}
            {!effectivePremium && (
              <button
                onClick={() => { setShowSignInModal(true); setMobileMenuOpen(false); }}
                className="block text-sm font-bold px-4 py-2 rounded-lg w-full text-left bg-terra text-white"
              >
                Go Premium — $49
              </button>
            )}
          </div>
        )}
      </header>

      {/* Payment success banner */}
      {showPaymentSuccess && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-800">
                {paymentPollingFailed
                  ? 'Payment received! Please refresh the page to activate your Advocacy Toolkit.'
                  : 'Payment successful! Activating your Advocacy Toolkit...'}
              </span>
            </div>
            {paymentPollingFailed ? (
              <button
                onClick={() => window.location.reload()}
                className="text-sm font-bold text-green-700 hover:text-green-900 underline"
              >
                Refresh now
              </button>
            ) : (
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
          </div>
        </div>
      )}

      {/* Hero Section - Light earthy aesthetic */}
      {!compareMode && !location && !isAnalyzing && (
        <section className="relative overflow-hidden flex flex-col font-sans" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 50%, #e8f0eb 100%)' }}>
          <div className="relative flex-1 flex flex-col items-center px-6 pt-8 md:pt-12 pb-6 z-10">
            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-4 tracking-tight text-earth-text-dark">
              Is Your Street{' '}
              <span className="text-terra">Safe to Walk</span>?
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-center max-w-lg mb-6 text-earth-text-body">
              Satellite data for any address. Tree cover, crash history, street network & more.
              <span className="text-earth-text-light"> Free, instant, no sign-up.</span>
            </p>

            {/* Search Box */}
            <div className="w-full max-w-xl mb-4">
              <div className="search-box-light bg-white rounded-2xl">
                <AddressInput
                  onSelect={handleLocationSelect}
                  placeholder="Enter any address worldwide..."
                />
              </div>
            </div>

            <button
              onClick={activateDemoMode}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-terra/30 text-terra font-semibold text-sm rounded-xl hover:bg-terra/10 hover:border-terra/50 transition-all mb-4"
            >
              <span className="text-base">&#9654;</span>
              Watch Demo &mdash; Portland, OR
            </button>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-6">
              <span className="text-xs sm:text-sm text-earth-text-light">
                Powered by <span className="text-earth-green font-semibold">NASA</span> & <span className="text-earth-green font-semibold">Sentinel-2</span>
              </span>
              <span className="text-earth-text-light hidden sm:inline">·</span>
              <span className="text-xs sm:text-sm text-earth-text-light">
                <span className="text-earth-green font-semibold">190+</span> countries
              </span>
              <span className="text-earth-text-light hidden sm:inline">·</span>
              <span className="text-xs sm:text-sm text-earth-text-light">
                <span className="text-earth-green font-semibold">8</span> data-driven metrics
              </span>
            </div>

          </div>

          {/* Street Cross-Section + Plan View Illustration */}
          <div className="w-full max-w-5xl mx-auto px-6 opacity-80">
            <svg viewBox="0 0 800 320" className="w-full" preserveAspectRatio="xMidYMid meet">
                {/* ==================== SECTION VIEW (TOP) ==================== */}

                {/* Sky */}
                <rect x="0" y="0" width="800" height="145" fill="#c8e4f0"/>

                {/* Clouds */}
                <ellipse cx="150" cy="35" rx="40" ry="20" fill="white" opacity="0.9"/>
                <ellipse cx="180" cy="40" rx="30" ry="16" fill="white" opacity="0.9"/>
                <ellipse cx="120" cy="43" rx="25" ry="14" fill="white" opacity="0.9"/>
                <ellipse cx="550" cy="30" rx="45" ry="22" fill="white" opacity="0.85"/>
                <ellipse cx="585" cy="37" rx="32" ry="18" fill="white" opacity="0.85"/>
                <ellipse cx="515" cy="40" rx="28" ry="15" fill="white" opacity="0.85"/>

                {/* Sun */}
                <circle cx="680" cy="45" r="32" fill="#f9d423"/>
                <circle cx="680" cy="45" r="42" fill="#f9d423" opacity="0.2"/>

                {/* Left Building */}
                <rect x="20" y="50" width="70" height="95" fill="#e8ddd0" rx="2"/>
                <rect x="28" y="62" width="20" height="26" fill="#a0c8d8" rx="2"/>
                <rect x="56" y="62" width="20" height="26" fill="#a0c8d8" rx="2"/>
                <rect x="28" y="96" width="20" height="26" fill="#a0c8d8" rx="2"/>
                <rect x="56" y="96" width="20" height="26" fill="#a0c8d8" rx="2"/>

                {/* Right Building */}
                <rect x="710" y="50" width="70" height="95" fill="#e0d5c8" rx="2"/>
                <rect x="722" y="62" width="20" height="26" fill="#a0c8d8" rx="2"/>
                <rect x="750" y="62" width="20" height="26" fill="#a0c8d8" rx="2"/>
                <rect x="722" y="96" width="20" height="26" fill="#a0c8d8" rx="2"/>
                <rect x="750" y="96" width="20" height="26" fill="#a0c8d8" rx="2"/>

                {/* Ground line */}
                <rect x="0" y="145" width="800" height="3" fill="#a09585"/>

                {/* Left Sidewalk */}
                <rect x="90" y="132" width="60" height="16" fill="#d8d0c5"/>

                {/* People on left sidewalk */}
                <g>
                  <circle cx="112" cy="114" r="5" fill="#f5d5b5"/>
                  <rect x="108" y="119" width="8" height="12" fill="#e07850" rx="2"/>
                  <rect x="108" y="131" width="3" height="8" fill="#5a6570"/>
                  <rect x="113" y="131" width="3" height="8" fill="#5a6570"/>
                </g>
                <g>
                  <circle cx="138" cy="116" r="4" fill="#e8c8a8"/>
                  <rect x="135" y="120" width="6" height="10" fill="#5090b0" rx="2"/>
                  <rect x="135" y="130" width="2" height="8" fill="#4a5560"/>
                  <rect x="139" y="130" width="2" height="8" fill="#4a5560"/>
                </g>

                {/* Left Green */}
                <rect x="150" y="132" width="50" height="16" fill="#7aaa6a"/>

                {/* Tree 1 */}
                <rect x="171" y="70" width="8" height="62" fill="#8a7050"/>
                <ellipse cx="175" cy="50" rx="30" ry="32" fill="#5a9a4a"/>
                <ellipse cx="162" cy="60" rx="18" ry="22" fill="#6aaa5a"/>
                <ellipse cx="188" cy="57" rx="16" ry="20" fill="#5aaa50"/>
                <ellipse cx="175" cy="42" rx="14" ry="18" fill="#7aba6a"/>

                {/* Street light left */}
                <rect x="155" y="88" width="3" height="44" fill="#7a7a7a"/>
                <rect x="149" y="84" width="15" height="6" fill="#8a8a8a" rx="1"/>
                <rect x="151" y="79" width="11" height="6" fill="#fff8e0" rx="1"/>

                {/* Left Bike Lane */}
                <rect x="200" y="132" width="55" height="16" fill="#e08060"/>

                {/* Cyclist left */}
                <g>
                  <circle cx="220" cy="134" r="9" fill="none" stroke="#4a4a4a" strokeWidth="2"/>
                  <circle cx="240" cy="134" r="9" fill="none" stroke="#4a4a4a" strokeWidth="2"/>
                  <path d="M 220 134 L 230 118 L 240 134" stroke="#3a7090" strokeWidth="2" fill="none"/>
                  <line x1="230" y1="118" x2="230" y2="107" stroke="#3a7090" strokeWidth="2"/>
                  <circle cx="230" cy="102" r="5" fill="#f0d0b0"/>
                  <rect x="227" y="107" width="6" height="9" fill="#3090c0" rx="1"/>
                </g>

                {/* Left Drive Lane */}
                <rect x="255" y="132" width="95" height="16" fill="#5a5a5a"/>

                {/* Bus */}
                <g>
                  <rect x="268" y="90" width="65" height="42" fill="#4aaa4a" rx="4"/>
                  <rect x="268" y="90" width="65" height="9" fill="#3a9a3a" rx="4"/>
                  <rect x="274" y="97" width="18" height="26" fill="#c8e8f0" rx="1"/>
                  <rect x="296" y="97" width="18" height="26" fill="#c8e8f0" rx="1"/>
                  <rect x="318" y="97" width="8" height="26" fill="#c8e8f0" rx="1"/>
                  <ellipse cx="282" cy="135" rx="7" ry="4" fill="#2a2a2a"/>
                  <ellipse cx="318" cy="135" rx="7" ry="4" fill="#2a2a2a"/>
                  <rect x="272" y="92" width="22" height="4" fill="white" opacity="0.9" rx="1"/>
                </g>

                {/* Center Median */}
                <rect x="350" y="132" width="100" height="16" fill="#5a9a5a"/>
                <ellipse cx="375" cy="130" rx="8" ry="6" fill="#6aaa5a"/>
                <ellipse cx="400" cy="128" rx="10" ry="8" fill="#5a9a4a"/>
                <ellipse cx="425" cy="130" rx="8" ry="6" fill="#6aaa5a"/>

                {/* Right Drive Lane */}
                <rect x="450" y="132" width="95" height="16" fill="#5a5a5a"/>

                {/* Car */}
                <g>
                  <rect x="472" y="106" width="50" height="26" fill="#e8e8e8" rx="4"/>
                  <rect x="479" y="99" width="35" height="14" fill="#b8d8e8" rx="3"/>
                  <ellipse cx="484" cy="135" rx="7" ry="4" fill="#2a2a2a"/>
                  <ellipse cx="510" cy="135" rx="7" ry="4" fill="#2a2a2a"/>
                </g>

                {/* Right Bike Lane */}
                <rect x="545" y="132" width="55" height="16" fill="#e08060"/>

                {/* Cyclist right */}
                <g>
                  <circle cx="560" cy="134" r="9" fill="none" stroke="#4a4a4a" strokeWidth="2"/>
                  <circle cx="580" cy="134" r="9" fill="none" stroke="#4a4a4a" strokeWidth="2"/>
                  <path d="M 560 134 L 570 118 L 580 134" stroke="#3a7090" strokeWidth="2" fill="none"/>
                  <line x1="570" y1="118" x2="570" y2="107" stroke="#3a7090" strokeWidth="2"/>
                  <circle cx="570" cy="102" r="5" fill="#e8c8a0"/>
                  <rect x="567" y="107" width="6" height="9" fill="#e06050" rx="1"/>
                </g>

                {/* Right Green */}
                <rect x="600" y="132" width="50" height="16" fill="#7aaa6a"/>

                {/* Tree 2 */}
                <rect x="621" y="70" width="8" height="62" fill="#8a7050"/>
                <ellipse cx="625" cy="50" rx="30" ry="32" fill="#5a9a4a"/>
                <ellipse cx="612" cy="60" rx="18" ry="22" fill="#6aaa5a"/>
                <ellipse cx="638" cy="57" rx="16" ry="20" fill="#5aaa50"/>
                <ellipse cx="625" cy="42" rx="14" ry="18" fill="#7aba6a"/>

                {/* Street light right */}
                <rect x="642" y="88" width="3" height="44" fill="#7a7a7a"/>
                <rect x="636" y="84" width="15" height="6" fill="#8a8a8a" rx="1"/>
                <rect x="638" y="79" width="11" height="6" fill="#fff8e0" rx="1"/>

                {/* Right Sidewalk */}
                <rect x="650" y="132" width="60" height="16" fill="#d8d0c5"/>

                {/* Bench + person right */}
                <rect x="665" y="125" width="25" height="5" fill="#9a7a5a" rx="1"/>
                <rect x="668" y="130" width="3" height="8" fill="#8a6a4a"/>
                <rect x="684" y="130" width="3" height="8" fill="#8a6a4a"/>
                <circle cx="677" cy="114" r="5" fill="#f0d0b0"/>
                <rect x="673" y="119" width="8" height="7" fill="#7090b0" rx="1"/>

                {/* Person walking right */}
                <g>
                  <circle cx="698" cy="116" r="4" fill="#e8c8a0"/>
                  <rect x="695" y="120" width="6" height="10" fill="#d07080" rx="1"/>
                  <rect x="695" y="130" width="2" height="8" fill="#5a6570"/>
                  <rect x="699" y="130" width="2" height="8" fill="#5a6570"/>
                </g>

                {/* ==================== PLAN VIEW (BOTTOM) ==================== */}

                {/* Plan background */}
                <rect x="0" y="160" width="800" height="160" fill="#d5e5d5"/>

                {/* Building footprints */}
                <rect x="20" y="165" width="70" height="150" fill="#c8c0b5"/>
                <rect x="710" y="165" width="70" height="150" fill="#c8c0b5"/>

                {/* Left Sidewalk (plan) */}
                <rect x="90" y="165" width="60" height="150" fill="#e8e0d8"/>
                <line x1="115" y1="165" x2="115" y2="315" stroke="#d8d0c8" strokeWidth="1"/>
                <line x1="135" y1="165" x2="135" y2="315" stroke="#d8d0c8" strokeWidth="1"/>
                <ellipse cx="110" cy="200" rx="4" ry="4" fill="#e07850"/>
                <ellipse cx="135" cy="255" rx="4" ry="4" fill="#5090b0"/>
                <ellipse cx="120" cy="300" rx="4" ry="4" fill="#90b080"/>

                {/* Left Green (plan) */}
                <rect x="150" y="165" width="50" height="150" fill="#7aaa6a"/>
                <ellipse cx="175" cy="210" rx="26" ry="26" fill="#5a9a4a"/>
                <ellipse cx="175" cy="210" rx="16" ry="16" fill="#6aaa5a"/>
                <ellipse cx="175" cy="280" rx="22" ry="22" fill="#5a9a4a"/>
                <ellipse cx="175" cy="280" rx="14" ry="14" fill="#6aaa5a"/>

                {/* Left Bike (plan) */}
                <rect x="200" y="165" width="55" height="150" fill="#e08060"/>
                <circle cx="227" cy="210" r="9" fill="none" stroke="white" strokeWidth="2" opacity="0.8"/>
                <path d="M 227 250 L 227 280 M 222 272 L 227 280 L 232 272" stroke="white" strokeWidth="2" opacity="0.8"/>

                {/* Left Drive (plan) */}
                <rect x="255" y="165" width="95" height="150" fill="#6a6a6a"/>
                <rect x="300" y="165" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="300" y="188" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="300" y="211" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="300" y="234" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="300" y="257" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="300" y="280" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="300" y="303" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="265" y="205" width="28" height="58" fill="#4aaa4a" rx="3"/>
                <rect x="268" y="210" width="22" height="10" fill="#c8e8f0" rx="1"/>

                {/* Center Median (plan) */}
                <rect x="350" y="165" width="100" height="150" fill="#5a9a5a"/>
                <ellipse cx="375" cy="200" rx="10" ry="10" fill="#6aaa5a"/>
                <ellipse cx="400" cy="240" rx="14" ry="14" fill="#5a9a4a"/>
                <ellipse cx="425" cy="280" rx="10" ry="10" fill="#6aaa5a"/>
                <ellipse cx="400" cy="305" rx="8" ry="8" fill="#5a9a4a"/>

                {/* Right Drive (plan) */}
                <rect x="450" y="165" width="95" height="150" fill="#6a6a6a"/>
                <rect x="496" y="165" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="496" y="188" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="496" y="211" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="496" y="234" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="496" y="257" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="496" y="280" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="496" y="303" width="3" height="12" fill="white" opacity="0.8"/>
                <rect x="462" y="245" width="22" height="42" fill="#e8e8e8" rx="3"/>
                <rect x="465" y="250" width="16" height="9" fill="#b8d8e8" rx="1"/>

                {/* Right Bike (plan) */}
                <rect x="545" y="165" width="55" height="150" fill="#e08060"/>
                <circle cx="572" cy="265" r="9" fill="none" stroke="white" strokeWidth="2" opacity="0.8"/>
                <path d="M 572 225 L 572 195 M 567 203 L 572 195 L 577 203" stroke="white" strokeWidth="2" opacity="0.8"/>

                {/* Right Green (plan) */}
                <rect x="600" y="165" width="50" height="150" fill="#7aaa6a"/>
                <ellipse cx="625" cy="210" rx="26" ry="26" fill="#5a9a4a"/>
                <ellipse cx="625" cy="210" rx="16" ry="16" fill="#6aaa5a"/>
                <ellipse cx="625" cy="280" rx="22" ry="22" fill="#5a9a4a"/>
                <ellipse cx="625" cy="280" rx="14" ry="14" fill="#6aaa5a"/>

                {/* Right Sidewalk (plan) */}
                <rect x="650" y="165" width="60" height="150" fill="#e8e0d8"/>
                <line x1="670" y1="165" x2="670" y2="315" stroke="#d8d0c8" strokeWidth="1"/>
                <line x1="690" y1="165" x2="690" y2="315" stroke="#d8d0c8" strokeWidth="1"/>
                <ellipse cx="665" cy="210" rx="4" ry="4" fill="#d07080"/>
                <ellipse cx="690" cy="260" rx="4" ry="4" fill="#7090b0"/>
                <ellipse cx="675" cy="300" rx="4" ry="4" fill="#90a060"/>
                <rect x="655" y="235" width="5" height="18" fill="#9a7a5a" rx="1"/>

                {/* Crosswalk */}
                <rect x="200" y="165" width="400" height="3" fill="white"/>
                <rect x="200" y="172" width="400" height="3" fill="white"/>
                <rect x="200" y="179" width="400" height="3" fill="white"/>

                {/* Street lights from above */}
                <circle cx="160" cy="310" r="3" fill="#fff8d0" stroke="#aaa" strokeWidth="1"/>
                <circle cx="640" cy="310" r="3" fill="#fff8d0" stroke="#aaa" strokeWidth="1"/>

                {/* Zone Labels */}
                <g style={{ fontFamily: "'Space Mono', monospace", fontSize: '7px' }} fill="#5a6a5a">
                  <text x="120" y="157" textAnchor="middle">WALK</text>
                  <text x="175" y="157" textAnchor="middle">GREEN</text>
                  <text x="227" y="157" textAnchor="middle">BIKE</text>
                  <text x="302" y="157" textAnchor="middle">DRIVE</text>
                  <text x="400" y="157" textAnchor="middle">MEDIAN</text>
                  <text x="497" y="157" textAnchor="middle">DRIVE</text>
                  <text x="572" y="157" textAnchor="middle">BIKE</text>
                  <text x="625" y="157" textAnchor="middle">GREEN</text>
                  <text x="680" y="157" textAnchor="middle">WALK</text>
                </g>
            </svg>
          </div>

          {/* Credibility & Data Sources - centered */}
          <div className="flex flex-col items-center px-6 pb-8">
            {/* Credibility Marker */}
            <div className="flex items-center justify-center gap-2 mt-6 mb-4 px-4 py-2 rounded-full bg-earth-green/[0.08]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#4a8a4a"/>
              </svg>
              <span className="text-sm text-earth-green">
                Built on <strong>NACTO</strong> & <strong>GSDG</strong> standards — trusted by urban planners worldwide
              </span>
            </div>

            {/* Data Sources */}
            <div className="flex flex-wrap justify-center gap-2">
              {['Sentinel-2 Satellite', 'OpenStreetMap', 'NASADEM Elevation', 'GSDG Standards'].map((source) => (
                <div
                  key={source}
                  className="source-tag-light flex items-center gap-2 px-3 py-1.5 rounded-full bg-earth-green/10 border border-earth-green/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-earth-green"/>
                  <span className="text-xs font-mono text-earth-green">
                    {source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Mode Toggle */}
        {!compareMode && location && metrics && (
          <div className="mb-6 flex flex-col items-center gap-3 px-4 sm:px-0">
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => {
                setLocation(null);
                setMetrics(null);
                setDataQuality(null);
                setOsmData(null);
                window.history.pushState({}, '', window.location.pathname);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all hover:shadow-lg border-2 text-sm sm:text-base border-earth-border text-earth-text-dark bg-white"
            >
              Search Another Location
            </button>
            <button
              onClick={handleCompareMode}
              className="px-4 sm:px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg text-sm sm:text-base bg-orange-500"
            >
              Compare with Another Location
            </button>
            {(userIsPremium || accessInfo.tier === 'advocate') && location && (
              <button
                onClick={() => {
                  if (!location || !metrics) return;
                  const result = saveAddress({
                    displayName: location.displayName,
                    lat: location.lat,
                    lon: location.lon,
                    overallScore: metrics.overallScore,
                  });
                  if (result) {
                    setSavedAddressList(getSavedAddresses());
                  }
                }}
                disabled={savedAddressList.length >= MAX_ADDRESSES || savedAddressList.some(a => Math.abs(a.lat - location.lat) < 0.0001 && Math.abs(a.lon - location.lon) < 0.0001)}
                className="px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all hover:shadow-lg border-2 text-sm sm:text-base disabled:opacity-40 border-earth-border text-earth-text-dark bg-white"
              >
                {savedAddressList.some(a => Math.abs(a.lat - location.lat) < 0.0001 && Math.abs(a.lon - location.lon) < 0.0001)
                  ? 'Saved'
                  : `Save (${savedAddressList.length}/${MAX_ADDRESSES})`}
              </button>
            )}
          </div>
          {/* Saved Addresses Dropdown */}
          {(userIsPremium || accessInfo.tier === 'advocate') && savedAddressList.length > 0 && (
            <div className="flex justify-center">
              <div className="relative">
                <button
                  onClick={() => setShowSavedDropdown(!showSavedDropdown)}
                  className="text-sm font-medium px-4 py-2 rounded-lg border transition-all hover:shadow-sm border-earth-border text-earth-text-dark bg-white"
                  aria-label="Saved addresses"
                  aria-expanded={showSavedDropdown}
                >
                  Saved Addresses ({savedAddressList.length}) {showSavedDropdown ? '\u25B2' : '\u25BC'}
                </button>
                {showSavedDropdown && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 bg-white rounded-xl shadow-xl border border-earth-border z-30 overflow-hidden">
                    {savedAddressList.map((addr) => (
                      <div key={addr.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-[#f0ebe0] last:border-0">
                        <button
                          className="flex-1 text-left text-sm truncate mr-2 text-earth-text-dark"
                          onClick={() => {
                            setShowSavedDropdown(false);
                            const savedLoc: Location = {
                              lat: addr.lat,
                              lon: addr.lon,
                              displayName: addr.displayName,
                            };
                            handleLocationSelect(savedLoc);
                          }}
                        >
                          <span className="font-medium">{addr.displayName.split(',')[0]}</span>
                          {addr.overallScore !== undefined && (
                            <span className="text-xs ml-1 text-earth-text-light">
                              ({addr.overallScore.toFixed(1)}/10)
                            </span>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAddress(addr.id);
                            setSavedAddressList(getSavedAddresses());
                          }}
                          className="text-sm p-2 rounded hover:bg-red-50 text-[#b0a8a0]"
                          aria-label={`Remove ${addr.displayName.split(',')[0]}`}
                        >
                          &#x2715;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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

        {/* Address Search - Only show when results are displayed or in compare mode */}
        {(location || isAnalyzing || compareMode) && (
          <>
            {compareMode ? (
              <div className="mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-800">Location 1</h3>
                      {location1 && <span className="text-green-600 font-semibold">✓ Ready</span>}
                      {isAnalyzingCompare === 1 && (
                        <span className="flex items-center gap-2 text-orange-600 text-sm font-medium">
                          <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                          Analyzing...
                        </span>
                      )}
                    </div>
                    <AddressInput
                      onSelect={async (selectedLocation) => {
                        setIsAnalyzingCompare(1);
                        setCompareError(null);
                        try {
                          // Fire OSM, satellite, and crash requests simultaneously
                          const osmPromise = fetchOSMData(selectedLocation.lat, selectedLocation.lon);
                          const satellitePromises = startSatelliteFetches(selectedLocation);
                          const crashPromise = fetchCrashData(selectedLocation.lat, selectedLocation.lon, selectedLocation.countryCode).catch(() => null);

                          const fetchedOsmData = await osmPromise;
                          const calculatedMetrics = calculateMetrics(
                            fetchedOsmData,
                            selectedLocation.lat,
                            selectedLocation.lon,
                            undefined, undefined, undefined, undefined, undefined
                          );
                          const quality = assessDataQuality(fetchedOsmData);

                          // Compute initial composite from OSM data
                          const initialComposite = calculateCompositeScore({
                            legacy: calculatedMetrics,
                            networkGraph: fetchedOsmData.networkGraph,
                          });

                          setLocation1({
                            location: selectedLocation,
                            metrics: calculatedMetrics,
                            quality,
                            osmData: fetchedOsmData,
                            compositeScore: initialComposite,
                          });

                          // Progressively update metrics + composite as satellite data arrives
                          const scores: Record<string, number> = {};
                          const extra: { buildingDensity?: number; populationDensity?: number; crashData?: CrashData | null } = {};
                          const recalc = () => {
                            const updated = calculateMetrics(
                              fetchedOsmData,
                              selectedLocation.lat,
                              selectedLocation.lon,
                              scores.slope, scores.ndvi, scores.surfaceTemp,
                              scores.airQuality, scores.heatIsland
                            );
                            const composite = calculateCompositeScore({
                              legacy: updated,
                              networkGraph: fetchedOsmData.networkGraph,
                              buildingDensityScore: extra.buildingDensity,
                              populationDensityScore: extra.populationDensity,
                              crashData: extra.crashData,
                            });
                            setLocation1(prev => prev ? { ...prev, metrics: updated, compositeScore: composite } : prev);
                          };
                          satellitePromises.slope.then(v => { if (v !== null) { scores.slope = scoreSlopeFromDegrees(v); recalc(); } });
                          satellitePromises.ndvi.then(v => { if (v !== null) { scores.ndvi = scoreTreeCanopy(v); recalc(); } });
                          satellitePromises.surfaceTemp.then(v => { if (v) { scores.surfaceTemp = v.score; recalc(); } });
                          satellitePromises.airQuality.then(v => { if (v) { scores.airQuality = v.score; recalc(); } });
                          satellitePromises.heatIsland.then(v => { if (v) { scores.heatIsland = v.score; if (v.buildingDensity) extra.buildingDensity = v.buildingDensity.score; recalc(); } });
                          satellitePromises.populationDensity.then(v => { if (v) { extra.populationDensity = v.score; recalc(); } });
                          crashPromise.then(data => { extra.crashData = data; setLocation1(prev => prev ? { ...prev, crashData: data } : prev); recalc(); });
                        } catch (error) {
                          console.error('Failed to analyze location 1:', error);
                          setCompareError('Failed to analyze location 1. Please try again.');
                        } finally {
                          setIsAnalyzingCompare(null);
                        }
                      }}
                      placeholder="Enter first address..."
                      keepValueOnSelect={true}
                    />
                  </div>
                  <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-800">Location 2</h3>
                      {location2 && <span className="text-green-600 font-semibold">✓ Ready</span>}
                      {isAnalyzingCompare === 2 && (
                        <span className="flex items-center gap-2 text-orange-600 text-sm font-medium">
                          <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                          Analyzing...
                        </span>
                      )}
                    </div>
                    <AddressInput
                      onSelect={async (selectedLocation) => {
                        setIsAnalyzingCompare(2);
                        setCompareError(null);
                        try {
                          // Fire OSM, satellite, and crash requests simultaneously
                          const osmPromise = fetchOSMData(selectedLocation.lat, selectedLocation.lon);
                          const satellitePromises = startSatelliteFetches(selectedLocation);
                          const crashPromise = fetchCrashData(selectedLocation.lat, selectedLocation.lon, selectedLocation.countryCode).catch(() => null);

                          const fetchedOsmData = await osmPromise;
                          const calculatedMetrics = calculateMetrics(
                            fetchedOsmData,
                            selectedLocation.lat,
                            selectedLocation.lon,
                            undefined, undefined, undefined, undefined, undefined
                          );
                          const quality = assessDataQuality(fetchedOsmData);

                          // Compute initial composite from OSM data
                          const initialComposite = calculateCompositeScore({
                            legacy: calculatedMetrics,
                            networkGraph: fetchedOsmData.networkGraph,
                          });

                          setLocation2({
                            location: selectedLocation,
                            metrics: calculatedMetrics,
                            quality,
                            osmData: fetchedOsmData,
                            compositeScore: initialComposite,
                          });

                          // Progressively update metrics + composite as satellite data arrives
                          const scores: Record<string, number> = {};
                          const extra: { buildingDensity?: number; populationDensity?: number; crashData?: CrashData | null } = {};
                          const recalc = () => {
                            const updated = calculateMetrics(
                              fetchedOsmData,
                              selectedLocation.lat,
                              selectedLocation.lon,
                              scores.slope, scores.ndvi, scores.surfaceTemp,
                              scores.airQuality, scores.heatIsland
                            );
                            const composite = calculateCompositeScore({
                              legacy: updated,
                              networkGraph: fetchedOsmData.networkGraph,
                              buildingDensityScore: extra.buildingDensity,
                              populationDensityScore: extra.populationDensity,
                              crashData: extra.crashData,
                            });
                            setLocation2(prev => prev ? { ...prev, metrics: updated, compositeScore: composite } : prev);
                          };
                          satellitePromises.slope.then(v => { if (v !== null) { scores.slope = scoreSlopeFromDegrees(v); recalc(); } });
                          satellitePromises.ndvi.then(v => { if (v !== null) { scores.ndvi = scoreTreeCanopy(v); recalc(); } });
                          satellitePromises.surfaceTemp.then(v => { if (v) { scores.surfaceTemp = v.score; recalc(); } });
                          satellitePromises.airQuality.then(v => { if (v) { scores.airQuality = v.score; recalc(); } });
                          satellitePromises.heatIsland.then(v => { if (v) { scores.heatIsland = v.score; if (v.buildingDensity) extra.buildingDensity = v.buildingDensity.score; recalc(); } });
                          satellitePromises.populationDensity.then(v => { if (v) { extra.populationDensity = v.score; recalc(); } });
                          crashPromise.then(data => { extra.crashData = data; setLocation2(prev => prev ? { ...prev, crashData: data } : prev); recalc(); });
                        } catch (error) {
                          console.error('Failed to analyze location 2:', error);
                          setCompareError('Failed to analyze location 2. Please try again.');
                        } finally {
                          setIsAnalyzingCompare(null);
                        }
                      }}
                      placeholder="Enter second address..."
                      keepValueOnSelect={true}
                    />
                  </div>
                </div>
                {compareError && (
                  <p className="mt-3 text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{compareError}</p>
                )}
              </div>
            ) : (
              <div className="mb-8">
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <div className="flex-1">
                    <AddressInput
                      onSelect={handleLocationSelect}
                      placeholder="Enter any address worldwide..."
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const { latitude, longitude } = position.coords;
                            handleLocationSelect({
                              lat: latitude,
                              lon: longitude,
                              displayName: 'My Current Location',
                            });
                          },
                          (error) => {
                            console.error('Geolocation error:', error);
                            alert('Unable to get your location. Please enter an address manually.');
                          }
                        );
                      } else {
                        alert('Geolocation is not supported by your browser.');
                      }
                    }}
                    className="w-full md:w-auto px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg flex items-center justify-center gap-2 bg-terra"
                    aria-label="Use my current location"
                  >
                    <span role="img" aria-label="Location pin">📍</span>
                    <span>Use My Location</span>
                  </button>
                </div>
              </div>
            )}
          </>
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
          <ErrorBoundary sectionName="Compare View">
          <Suspense fallback={<div className="flex justify-center py-8"><div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <CompareView
              location1={location1.location}
              metrics1={location1.metrics}
              quality1={location1.quality}
              compositeScore1={location1.compositeScore}
              crashData1={location1.crashData}
              location2={location2.location}
              metrics2={location2.metrics}
              quality2={location2.quality}
              compositeScore2={location2.compositeScore}
              crashData2={location2.crashData}
            />
          </Suspense>
          </ErrorBoundary>
        )}

        {/* Single Location Loading */}
        {!compareMode && isAnalyzing && (
          <div className="flex flex-col items-center py-16">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-600" aria-live="polite">Analyzing walkability...</p>
            <p className="text-sm text-gray-500">Fetching OpenStreetMap data</p>
          </div>
        )}

        {/* Analysis Error */}
        {analysisError && !isAnalyzing && (
          <div className="max-w-md mx-auto rounded-xl p-6 text-center border bg-white/90 border-earth-border">
            <p className="text-sm font-medium mb-3 text-red-700">{analysisError}</p>
            <button
              onClick={() => setAnalysisError(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-terra"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Single Location Results */}
        {!compareMode && location && metrics && !isAnalyzing && (
          <div className={`space-y-6 ${demoMode ? 'pt-12' : ''}`}>
            {/* Location name */}
            <h2 className="text-2xl font-bold text-center text-earth-text-dark">
              {location.displayName}
            </h2>

            {/* Section Navigation */}
            <nav className="sticky top-0 z-10 -mx-6 px-6 py-2 backdrop-blur-md bg-earth-cream/85">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'score', label: 'Score' },
                  { id: 'metrics', label: 'Metrics' },
                  { id: 'neighborhood', label: 'Neighborhood' },
                  { id: 'cross-section', label: 'Street' },
                  { id: 'tools', label: 'Tools' },
                  { id: 'methodology', label: 'About' },
                ].map(s => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    className="px-3 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors hover:opacity-80 bg-earth-border text-earth-text-dark"
                  >
                    {s.label}
                  </a>
                ))}
                <button
                  onClick={() => setShowTour(true)}
                  className="px-3 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors hover:opacity-80 ml-auto text-terra"
                >
                  Take a Tour
                </button>
                {!effectivePremium && (
                  <button
                    onClick={() => setShowSignInModal(true)}
                    className="px-3 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all hover:shadow-md bg-terra text-white"
                  >
                    Upgrade — $49
                  </button>
                )}
              </div>
            </nav>

            {/* Row 1: Map + Score side by side */}
            <div id="score" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-16">
              <Map location={location} osmData={osmData} />
              <ScoreCard metrics={metrics} crashData={crashData} crashLoading={crashLoading} compositeScore={compositeScore} />
            </div>

            {/* Compact data quality badge */}
            {dataQuality && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-earth-text-light">
                <span className="flex items-center gap-1.5">
                  Data Quality:
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    dataQuality.confidence === 'high' ? 'bg-green-100 text-green-700' :
                    dataQuality.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {dataQuality.confidence.toUpperCase()}
                  </span>
                </span>
                <span>{dataQuality.streetCount} streets · {dataQuality.sidewalkCount} sidewalks · {dataQuality.crossingCount} crossings · {dataQuality.poiCount} POIs</span>
                <span className="hidden sm:inline">OSM · Sentinel-2 · NASA{crashData ? ' · ' + crashData.dataSource : ''}</span>
              </div>
            )}

            {/* Meridian philosophy quote */}
            {meridianQuote && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl border animate-[fadeInUp_0.4s_ease-out] border-earth-border bg-[#faf8f5]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs italic text-earth-text-body">
                    &ldquo;{meridianQuote.text}&rdquo;
                  </p>
                  <p className="text-[10px] mt-0.5 flex items-center gap-2 text-earth-text-light">
                    <span>&mdash; {meridianQuote.author}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-earth-text-dark">
                      via Meridian
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setMeridianQuote(null)}
                  className="text-gray-300 hover:text-gray-500 text-sm flex-shrink-0"
                  aria-label="Dismiss quote"
                >&times;</button>
              </div>
            )}

            {/* First-time onboarding tip */}
            {showOnboarding && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-gray-600">
                <span>Scores are 0&ndash;10 (10 = best). Green = strengths, red = needs attention. Scroll down for more.</span>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    try { localStorage.setItem('safestreets_seen_onboarding', '1'); } catch {}
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap px-2 py-1 rounded hover:bg-blue-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Metrics Grid */}
            <div id="metrics" className="scroll-mt-16">
              <MetricGrid metrics={metrics} locationName={location.displayName} satelliteLoaded={satelliteLoaded} rawData={rawMetricData} compositeScore={compositeScore} demographicData={demographicData} demographicLoading={demographicLoading} osmData={osmData} crashData={crashData} />
            </div>

            {/* Email capture banner (hidden in demo mode) */}
            {!demoMode && (
              <Suspense fallback={null}>
                <EmailCaptureBanner
                  locationName={location.displayName}
                  score={compositeScore ? (compositeScore.overallScore / 10).toFixed(1) : ''}
                  lat={location.lat}
                  lon={location.lon}
                  userEmail={user?.primaryEmailAddress?.emailAddress}
                />
              </Suspense>
            )}

            {/* 15-Minute City Score (free for all users) */}
            <div id="neighborhood" className="scroll-mt-16"></div>
            <ErrorBoundary sectionName="15-Minute City">
              <Suspense fallback={null}>
                <FifteenMinuteCity location={location} osmElements={osmData?.rawElements} />
              </Suspense>
            </ErrorBoundary>

            {/* Mid-page upgrade nudge (free users only) */}
            {!effectivePremium && (
              <div
                className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 rounded-xl border-2 border-terra bg-terra/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">&#x1F4DD;</span>
                  <span className="text-earth-text-dark">
                    <strong className="text-base">Turn this data into action</strong>
                    <span className="text-sm block sm:inline text-earth-text-body"> — advocacy letters, street redesign mockups, PDF proposals & more</span>
                  </span>
                </div>
                <button
                  onClick={() => setShowSignInModal(true)}
                  className="px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:shadow-lg whitespace-nowrap flex-shrink-0 bg-terra"
                >
                  Unlock Toolkit — $49
                </button>
              </div>
            )}

            {/* Street Cross-Section (Current = free, Recommended = premium) */}
            <div id="cross-section" className="scroll-mt-16">
              <ErrorBoundary sectionName="Street Cross-Section">
                <Suspense fallback={null}>
                  <StreetCrossSection location={location} metrics={metrics} isPremium={effectivePremium} isDemoMode={demoMode} onUpgrade={() => setShowSignInModal(true)} onConfigChange={setCrossSectionSnapshot} />
                </Suspense>
              </ErrorBoundary>
            </div>

            {/* Share + Export */}
            <div id="report-actions">
            <ErrorBoundary sectionName="Share Buttons">
              <Suspense fallback={null}>
                <ShareButtons
                  location={location}
                  metrics={metrics}
                  dataQuality={dataQuality || undefined}
                  isPremium={effectivePremium}
                  crossSectionSnapshot={crossSectionSnapshot}
                  onShareReport={() => setShowReportCard(true)}
                />
              </Suspense>
            </ErrorBoundary>
            </div>

            {/* Advocacy Tools — Consolidated Section */}
            <div id="tools" className="scroll-mt-16">
              {effectivePremium ? (
                /* Paid users: tool grid */
                <div className="rounded-2xl border-2 overflow-hidden border-earth-border bg-white/90">
                  <div className="px-6 py-6 sm:px-8">
                    <h3 className="text-lg font-bold mb-1 text-earth-text-dark">Advocacy Tools</h3>
                    <p className="text-sm mb-5 text-earth-text-body">
                      Professional tools to advocate for safer, more walkable streets.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Advocacy Letter */}
                      <button
                        onClick={() => { setShowLetterModal(true); showDemoNudge(); }}
                        className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md hover:border-orange-200 cursor-pointer border-earth-border bg-white"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-terra/10">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e07850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-bold block text-earth-text-dark">Advocacy Letter</span>
                          <span className="text-xs text-earth-text-light">Draft data-backed letters to city council or local officials</span>
                        </div>
                      </button>

                      {/* Proposal */}
                      <button
                        onClick={() => {
                          const proposalData = {
                            location, metrics,
                            compositeScore: compositeScore || undefined,
                            crashData: crashData || undefined,
                            demographicData: demographicData || undefined,
                            localEconomy: osmData ? analyzeLocalEconomy(osmData) : undefined,
                            rawMetricData: rawMetricData || undefined,
                            dataQuality: dataQuality || undefined,
                          };
                          sessionStorage.setItem('advocacyProposalData', JSON.stringify(proposalData));
                          window.open('/proposal', '_blank');
                          showDemoNudge();
                        }}
                        className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md hover:border-orange-200 cursor-pointer border-earth-border bg-white"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-terra/10">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e07850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-bold block text-earth-text-dark">Proposal</span>
                          <span className="text-xs text-earth-text-light">Professional PDF with scores, equity data & recommendations</span>
                        </div>
                      </button>

                      {/* Street Audit */}
                      <button
                        onClick={() => { setShowAuditTool(true); showDemoNudge(); }}
                        className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md hover:border-orange-200 cursor-pointer border-earth-border bg-white"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-terra/10">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e07850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-bold block text-earth-text-dark">Street Audit</span>
                          <span className="text-xs text-earth-text-light">Walk & document issues — missing crosswalks, broken sidewalks, poor lighting</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Free users: compact upgrade banner */
                <div className="rounded-2xl border-2 overflow-hidden border-earth-border bg-[#faf8f5]">
                  <div className="px-6 py-6 sm:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-earth-text-dark">Advocacy Toolkit</h3>
                        <p className="text-sm mt-0.5 text-earth-text-light">One-time payment, no subscription</p>
                      </div>
                      <div className="text-2xl font-bold text-terra">$49</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                      {[
                        { name: 'Advocacy Letters', desc: 'Draft data-backed letters to city council, DOT, or local officials using your walkability analysis.' },
                        { name: 'Street Redesign', desc: 'Visualize how your street could look with bike lanes, wider sidewalks, or added trees.' },
                        { name: 'Formal Proposals', desc: 'Generate professional PDF proposals with scores, equity data, and improvement recommendations.' },
                        { name: 'Street Audit', desc: 'Walk your street and document issues — missing crosswalks, broken sidewalks, poor lighting.' },
                        { name: 'Meridian Chatbot', desc: 'Urbanism assistant trained on NACTO, WHO, and global street design standards. Unlimited messages.' },
                        { name: 'Export & Save', desc: 'Download PDF reports and raw JSON data. Save up to 10 addresses for tracking.' },
                      ].map((f) => (
                        <div key={f.name} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/70">
                          <span className="mt-0.5 flex-shrink-0 text-green-500">&#x2713;</span>
                          <div>
                            <span className="text-xs font-semibold block text-earth-text-dark">{f.name}</span>
                            <span className="text-[11px] leading-snug block mt-0.5 text-earth-text-light">{f.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowSignInModal(true)}
                        className="px-6 py-3 text-white font-semibold rounded-xl transition-all hover:shadow-lg cursor-pointer border-none bg-terra"
                      >
                        Unlock Advocacy Toolkit
                      </button>
                      <a
                        href="/enterprise"
                        className="px-6 py-3 font-semibold rounded-xl transition-all hover:shadow-md border-2 text-center inline-block border-enterprise-navy text-enterprise-navy bg-transparent"
                      >
                        Enterprise Intelligence &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Street Audit Tool Overlay */}
            {showAuditTool && location && effectivePremium && (
              <Suspense fallback={null}>
                <StreetAuditTool
                  address={location.displayName}
                  metrics={metrics}
                  compositeScore={compositeScore}
                  isPremium={effectivePremium}
                  onClose={() => setShowAuditTool(false)}
                />
              </Suspense>
            )}

            {/* --- Tier 4: Reference --- */}
            <div id="methodology" className="rounded-2xl border-2 overflow-hidden scroll-mt-16 bg-earth-sage/60 border-[#c8d8c8]">
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="w-full flex items-center justify-between px-8 py-5 transition hover:opacity-80"
              >
                <h3 className="text-xl font-bold text-earth-text-dark">
                  How This Analysis Works
                </h3>
                <span className="text-2xl text-gray-500" aria-hidden="true">
                  {showMethodology ? '\u2212' : '+'}
                </span>
              </button>
              {showMethodology && (
                <div className="px-8 pb-8">
                  <div className="space-y-3 text-sm text-[#3a4a3a]">
                    <div>
                      <strong className="block mb-1">8 Verified Metrics</strong>
                      <p className="text-[#4a5a4a]">We analyze crossing safety, sidewalk coverage, traffic speed exposure, daily destinations, street lighting, terrain slope, tree canopy, and thermal comfort using real data from OpenStreetMap, NASA POWER, and Sentinel-2 satellite imagery.</p>
                    </div>
                    <div>
                      <strong className="block mb-1">Global Standards</strong>
                      <p className="text-[#4a5a4a]">Each metric is compared against international standards from WHO, UN-Habitat, ADA, and leading urban planning organizations.</p>
                    </div>
                    <div>
                      <strong className="block mb-1">Free & Open Data</strong>
                      <p className="text-[#4a5a4a]">All data comes from publicly available sources: OpenStreetMap community, NASA POWER meteorological data, Sentinel-2 satellite imagery, NASADEM elevation data, NHTSA FARS crash data, and WHO health statistics.</p>
                    </div>
                  </div>
                  <div className="mt-6 p-4 rounded-lg border bg-white/60 border-[#d0dbd0]">
                    <p className="text-xs text-[#3a4a3a]">
                      <strong>Note:</strong> This analysis focuses on infrastructure and environment. It does not measure pavement condition, crime rates, or personal safety perceptions, which require local surveys or in-person audits.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Advocacy Chatbot (floating) */}
            <ErrorBoundary sectionName="Chatbot">
              <Suspense fallback={null}>
                <AdvocacyChatbot
                  location={location}
                  metrics={metrics}
                  dataQuality={dataQuality || undefined}
                  isPremium={effectivePremium}
                  onUnlock={() => setShowSignInModal(true)}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {!compareMode && !location && !isAnalyzing && (
          <>
            {/* How It Works Section */}
            <section className="py-16 relative overflow-hidden bg-white/50">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-[0.03]">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="1.5" fill="#2a3a2a"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#dots)"/>
                </svg>
              </div>

              <div className="relative max-w-5xl mx-auto px-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-earth-text-dark">
                  How It Works
                </h2>
                <p className="text-center text-gray-600 mb-8 sm:mb-12 max-w-xl mx-auto text-sm sm:text-base">
                  Three simple steps to understand any neighborhood
                </p>

                {/* Steps with connecting line */}
                <div className="relative">
                  {/* Connecting line (hidden on mobile) */}
                  <div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5" style={{ background: 'linear-gradient(to right, #e0dbd0, #e07850, #e0dbd0)' }}></div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Step 1 */}
                    <div className="text-center relative">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg relative z-10" style={{ background: 'linear-gradient(135deg, #e07850, #c86040)' }}>
                        <svg viewBox="0 0 48 48" className="w-10 h-10">
                          <circle cx="24" cy="20" r="8" fill="none" stroke="white" strokeWidth="2.5"/>
                          <path d="M24 12 L24 16 M24 24 L24 28 M16 20 L20 20 M28 20 L32 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M24 28 L24 40" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                          <circle cx="24" cy="40" r="3" fill="white"/>
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-earth-text-dark mb-2">Search Any Location</h3>
                      <p className="text-earth-text-body text-sm leading-relaxed">
                        Enter any address, city, or place worldwide. Our system works globally with coverage in 190+ countries.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="text-center relative">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg relative z-10" style={{ background: 'linear-gradient(135deg, #4a8a4a, #3a7a3a)' }}>
                        <svg viewBox="0 0 48 48" className="w-10 h-10">
                          <rect x="8" y="28" width="6" height="12" fill="white" opacity="0.6" rx="1"/>
                          <rect x="17" y="20" width="6" height="20" fill="white" opacity="0.8" rx="1"/>
                          <rect x="26" y="14" width="6" height="26" fill="white" rx="1"/>
                          <rect x="35" y="22" width="6" height="18" fill="white" opacity="0.7" rx="1"/>
                          <circle cx="36" cy="10" r="4" fill="white"/>
                          <path d="M32 10 L28 14 M40 10 L44 14 M36 6 L36 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-earth-text-dark mb-2">Get Instant Analysis</h3>
                      <p className="text-earth-text-body text-sm leading-relaxed">
                        8 walkability metrics calculated in seconds using real satellite data and OpenStreetMap infrastructure.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="text-center relative">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg relative z-10" style={{ background: 'linear-gradient(135deg, #2a3a2a, #1a2a1a)' }}>
                        <svg viewBox="0 0 48 48" className="w-10 h-10">
                          <rect x="10" y="6" width="28" height="36" fill="white" rx="2"/>
                          <rect x="14" y="12" width="12" height="2" fill="#2a3a2a"/>
                          <rect x="14" y="18" width="20" height="1.5" fill="#2a3a2a" opacity="0.5"/>
                          <rect x="14" y="22" width="18" height="1.5" fill="#2a3a2a" opacity="0.5"/>
                          <rect x="14" y="26" width="16" height="1.5" fill="#2a3a2a" opacity="0.5"/>
                          <rect x="14" y="30" width="4" height="8" fill="#4a8a4a" opacity="0.6"/>
                          <rect x="20" y="32" width="4" height="6" fill="#4a8a4a" opacity="0.8"/>
                          <rect x="26" y="28" width="4" height="10" fill="#4a8a4a"/>
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-earth-text-dark mb-2">Verify & Take Action</h3>
                      <p className="text-earth-text-body text-sm leading-relaxed">
                        Field-verify scores based on what you actually see, download a verified PDF report, share on social media, or upgrade for advocacy tools and street redesign mockups.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="text-center mt-12">
                  <p className="text-earth-text-light mb-4 text-sm">Want to compare two neighborhoods?</p>
                  <button
                    onClick={handleCompareMode}
                    className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-lg border-2 border-terra text-terra hover:bg-orange-50"
                  >
                    Compare Two Locations
                  </button>
                </div>
              </div>
            </section>

            {/* What You Get - Free Tier Features */}
            <section className="py-16 bg-earth-sage/60">
              <div className="max-w-5xl mx-auto px-6">
                <h2 className="text-3xl font-bold text-center mb-4 text-earth-text-dark">
                  8 Key Metrics, Completely Free
                </h2>
                <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                  No credit card required. No sign-up. Get satellite-powered walkability analysis instantly using real data from NASA, Sentinel-2, and OpenStreetMap. Then field-verify scores based on what you observe on the ground.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Street Crossings */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        <path d="M8 32 L56 32" stroke="#0d9488" strokeWidth="3" strokeLinecap="round"/>
                        <path d="M32 8 L32 56" stroke="#0d9488" strokeWidth="3" strokeLinecap="round"/>
                        <rect x="26" y="26" width="4" height="2" fill="#0d9488" rx="0.5"/>
                        <rect x="26" y="30" width="4" height="2" fill="#0d9488" rx="0.5"/>
                        <rect x="26" y="34" width="4" height="2" fill="#0d9488" rx="0.5"/>
                        <rect x="34" y="26" width="4" height="2" fill="#0d9488" rx="0.5"/>
                        <rect x="34" y="30" width="4" height="2" fill="#0d9488" rx="0.5"/>
                        <rect x="34" y="34" width="4" height="2" fill="#0d9488" rx="0.5"/>
                        <circle cx="22" cy="28" r="3" fill="#1e293b"/>
                        <path d="M22 31 L22 38 M19 34 L25 34 M22 38 L19 44 M22 38 L25 44" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Crossing Safety</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Pedestrian crossings weighted by protection level — signalized crossings count more than unmarked ones. Data from OpenStreetMap.</p>
                  </div>

                  {/* Daily Needs */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        <rect x="8" y="24" width="18" height="20" fill="#6366f1" opacity="0.2" rx="2"/>
                        <rect x="23" y="18" width="18" height="26" fill="#6366f1" opacity="0.3" rx="2"/>
                        <rect x="38" y="22" width="18" height="22" fill="#6366f1" opacity="0.2" rx="2"/>
                        <text x="17" y="38" textAnchor="middle" fill="#6366f1" fontSize="12">🛒</text>
                        <text x="32" y="35" textAnchor="middle" fill="#6366f1" fontSize="12">🏫</text>
                        <text x="47" y="37" textAnchor="middle" fill="#6366f1" fontSize="12">🏥</text>
                        <path d="M8 48 L56 48" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Daily Needs</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Access to groceries, healthcare, transit, schools, and restaurants within walking distance from OpenStreetMap data.</p>
                  </div>

                  {/* Sidewalk Coverage */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        <rect x="8" y="44" width="48" height="12" fill="#3b82f6" opacity="0.15" rx="2"/>
                        <rect x="8" y="44" width="12" height="12" fill="#3b82f6" opacity="0.4" rx="1"/>
                        <rect x="22" y="44" width="12" height="12" fill="#3b82f6" opacity="0.4" rx="1"/>
                        <rect x="36" y="44" width="12" height="12" fill="#3b82f6" opacity="0.4" rx="1"/>
                        <circle cx="14" cy="16" r="3" fill="#1e293b"/>
                        <path d="M14 19 L14 28 M11 23 L17 23 M14 28 L11 34 M14 28 L17 34" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="50" cy="16" r="3" fill="#1e293b"/>
                        <path d="M50 19 L50 28 M47 23 L53 23 M50 28 L47 34 M50 28 L53 34" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Sidewalk Coverage</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Percentage of streets with documented sidewalks from OpenStreetMap tags. Missing sidewalks force pedestrians into traffic.</p>
                  </div>

                  {/* Traffic Speed */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        <path d="M8 48 L56 48" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
                        <path d="M8 40 L56 40" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4,3"/>
                        <path d="M8 32 L56 32" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
                        <path d="M40 36 L52 36" stroke="#ef4444" strokeWidth="6" opacity="0.3" strokeLinecap="round"/>
                        <text x="32" y="22" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold">45mph</text>
                        <circle cx="18" cy="36" r="3" fill="#1e293b"/>
                        <path d="M18 39 L18 48" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Traffic Speed</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Speed limits and lane counts from OpenStreetMap. High-speed, multi-lane roads are exponentially more dangerous for pedestrians.</p>
                  </div>

                  {/* Night Safety */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        <rect x="8" y="8" width="48" height="48" fill="#1e293b" opacity="0.15" rx="4"/>
                        <circle cx="20" cy="28" r="10" fill="#a855f7" opacity="0.2"/>
                        <circle cx="44" cy="28" r="10" fill="#a855f7" opacity="0.2"/>
                        <rect x="18" y="16" width="4" height="20" fill="#a855f7" rx="2"/>
                        <rect x="42" y="16" width="4" height="20" fill="#a855f7" rx="2"/>
                        <path d="M20 36 L20 52" stroke="#64748b" strokeWidth="2"/>
                        <path d="M44 36 L44 52" stroke="#64748b" strokeWidth="2"/>
                        <path d="M8 52 L56 52" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Night Safety</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Street lighting coverage from OpenStreetMap lit tags. Well-lit streets are critical for pedestrian safety after dark.</p>
                  </div>

                  {/* Thermal Comfort */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        <rect x="28" y="8" width="8" height="40" rx="4" fill="#f97316" opacity="0.2"/>
                        <rect x="30" y="20" width="4" height="28" rx="2" fill="#f97316"/>
                        <circle cx="32" cy="50" r="8" fill="#f97316" opacity="0.3"/>
                        <circle cx="32" cy="50" r="5" fill="#f97316"/>
                        <path d="M12 20 L20 20" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M12 32 L20 32" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M44 20 L52 20" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M44 32 L52 32" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Thermal Comfort</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Consolidated surface temperature and urban heat island analysis from NASA POWER and Sentinel-2 satellite data.</p>
                  </div>

                  {/* Terrain Slope */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        {/* Elevation profile */}
                        <path d="M8 52 L20 40 L32 44 L44 28 L56 32 L56 52 Z" fill="#f59e0b" opacity="0.2"/>
                        <path d="M8 52 L20 40 L32 44 L44 28 L56 32" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        {/* Measurement marks */}
                        <path d="M20 40 L20 52" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2"/>
                        <path d="M44 28 L44 52" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2"/>
                        {/* Person on slope */}
                        <circle cx="38" cy="34" r="3" fill="#1e293b"/>
                        <path d="M38 37 L38 44 M35 40 L41 40 M38 44 L35 50 M38 44 L41 50" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round"/>
                        {/* Percentage label */}
                        <text x="48" y="24" fill="#f59e0b" fontSize="8" fontWeight="bold">5%</text>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Terrain Slope</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Walking difficulty based on elevation changes. Steep hills can be barriers for accessibility and comfortable walking.</p>
                  </div>

                  {/* Tree Canopy */}
                  <div className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-terra hover:shadow-lg transition-all">
                    <div className="w-16 h-16 mb-4 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <svg viewBox="0 0 64 64" className="w-10 h-10">
                        {/* Street cross-section with trees */}
                        <rect x="8" y="48" width="48" height="8" fill="#64748b" opacity="0.3"/>
                        {/* Sidewalk */}
                        <rect x="8" y="44" width="10" height="4" fill="#94a3b8"/>
                        <rect x="46" y="44" width="10" height="4" fill="#94a3b8"/>
                        {/* Tree canopy coverage */}
                        <ellipse cx="16" cy="28" rx="12" ry="14" fill="#10b981" opacity="0.7"/>
                        <ellipse cx="48" cy="28" rx="12" ry="14" fill="#10b981" opacity="0.7"/>
                        <ellipse cx="32" cy="24" rx="14" ry="16" fill="#10b981"/>
                        {/* Tree trunks */}
                        <rect x="14" y="36" width="4" height="12" fill="#854d0e"/>
                        <rect x="46" y="36" width="4" height="12" fill="#854d0e"/>
                        <rect x="30" y="34" width="4" height="14" fill="#854d0e"/>
                        {/* Shade on street */}
                        <ellipse cx="32" cy="52" rx="20" ry="3" fill="#10b981" opacity="0.2"/>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Tree Canopy</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Vegetation coverage from Sentinel-2 satellite imagery. Tree shade reduces heat stress and makes walking more pleasant.</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {compareMode && !location1 && !isAnalyzingCompare && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📊</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Compare Two Locations
            </h2>
            <p className="text-gray-600 text-sm max-w-xl mx-auto">
              Enter addresses above to see side-by-side walkability comparison
            </p>
          </div>
        )}
      </main>

      {/* Enterprise Banner - visible on landing page */}
      {!compareMode && !location && !isAnalyzing && (
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-6">
            <a
              href="/enterprise"
              className="block rounded-2xl overflow-hidden transition-all hover:shadow-xl group"
              style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #1E40AF 100%)' }}
            >
              <div className="px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-enterprise-green-light">
                    For Governments, Developers & Organizations
                  </p>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    Need Walkability & Street Intelligence?
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed max-w-xl">
                    Interactive dashboards, field audits, citizen advocacy, and 12-metric analysis. Comprehensive street intelligence starting at $50K.
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <span
                    className="px-8 py-3.5 rounded-lg font-semibold text-white transition group-hover:shadow-lg bg-enterprise-green"
                  >
                    Explore Enterprise &rarr;
                  </span>
                  <span className="text-xs text-gray-400">Dashboards &middot; Field audits &middot; Citizen advocacy</span>
                </div>
              </div>
            </a>
          </div>
        </section>
      )}

      {/* FAQ Section - Only show when no analysis is displayed */}
      {!compareMode && !location && !isAnalyzing && (
        <section id="faq" className="py-12 bg-white/40">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-10 text-earth-text-dark">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {/* FAQ 1 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 1}
                  aria-controls="faq-1-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Is it really free?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 1 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-1-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 1 ? 'block' : 'hidden'}`}
                >
                  <p>
                    Yes! All 8 key walkability metrics, compare mode, composite scoring, and field verification mode are completely free with no sign-up required. Field verification lets you adjust any metric score based on what you actually observe and download a verified PDF report. We use 100% free data sources (NASA POWER, OpenStreetMap, Sentinel-2 satellite imagery via Google Earth Engine), so our data costs are $0/year. The free tier has unlimited searches and works globally. For advanced features like the Street Audit Tool, advocacy letters & proposals, and street redesign mockups, the Advocacy Toolkit is available for a one-time $49 payment.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 2}
                  aria-controls="faq-2-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    How is this different from other walkability tools?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 2 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-2-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 2 ? 'block' : 'hidden'}`}
                >
                  <p>
                    Most walkability tools only measure proximity to destinations. SafeStreets uses <strong>real satellite data from Sentinel-2</strong> (tree canopy coverage), <strong>NASADEM elevation data</strong> (terrain slope), and comprehensive OpenStreetMap analysis of street infrastructure. We focus on the actual physical environment that makes walking comfortable and safe - not just what's nearby, but whether it's safe to get there. Plus, our <strong>field verification mode</strong> lets you adjust scores based on ground observations - something no other tool offers.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 3}
                  aria-controls="faq-3-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    What's your refund policy?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 3 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-3-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 3 ? 'block' : 'hidden'}`}
                >
                  <p>
                    We offer a <strong className="text-green-700">30-day money-back guarantee</strong>. If you're not satisfied with your purchase for any reason, we'll provide a full refund—no questions asked. You can request a refund directly from your Stripe receipt email, or contact us if you need assistance.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 4 ? null : 4)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 4}
                  aria-controls="faq-4-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Do I need to create an account?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 4 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-4-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 4 ? 'block' : 'hidden'}`}
                >
                  <p>
                    No! The 8 core walkability metrics, compare mode, and field verification mode work instantly without any account. You can adjust scores based on what you see on the ground and download a verified PDF report, all without signing up. Creating a free account gives you access to the Meridian chatbot (12 messages). The Advocacy Toolkit ($49 one-time) unlocks the Street Audit Tool, advocacy letters & proposals, street redesign mockups, unlimited Meridian chatbot, and data export.
                  </p>
                </div>
              </div>

              {/* FAQ 5 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 5 ? null : 5)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 5}
                  aria-controls="faq-5-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    What's free vs. paid?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 5 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-5-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 5 ? 'block' : 'hidden'}`}
                >
                  <p>
                    <strong className="text-green-700">Yes, the core analysis is 100% free!</strong> All 8 walkability metrics, compare mode, and field verification mode work without any sign-up. You can adjust scores based on ground observation and save a verified PDF. For advanced advocacy tools like the Street Audit Tool, advocacy letters & proposals, and street redesign mockups, the Advocacy Toolkit is available for a one-time $49 payment — no subscription.
                  </p>
                </div>
              </div>

              {/* FAQ 6 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 6 ? null : 6)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 6}
                  aria-controls="faq-6-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    What do I get with the Advocacy Toolkit?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 6 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-6-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 6 ? 'block' : 'hidden'}`}
                >
                  <p>
                    <strong className="text-gray-900">The Advocacy Toolkit ($49 one-time) unlocks:</strong> Street Audit Tool, advocacy letters & proposals, street redesign mockups, unlimited Meridian chatbot, PDF &amp; JSON data export, and the ability to save up to 10 addresses. No subscription required. Note: field verification mode and verified PDF reports are free for everyone — no toolkit purchase needed.
                  </p>
                </div>
              </div>

              {/* Remaining FAQs - hidden by default */}
              {showAllFaqs && (
              <>
              {/* FAQ 7 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 7 ? null : 7)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 7}
                  aria-controls="faq-7-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    How accurate is the satellite data?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 7 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-7-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 7 ? 'block' : 'hidden'}`}
                >
                  <p>
                    We use publicly available scientific and government data sources: <strong>OpenStreetMap</strong> (community-maintained street infrastructure — crossings, sidewalks, speed limits, lanes, lighting), <strong>Sentinel-2</strong> satellite imagery (10m resolution vegetation and heat data), <strong>NASADEM</strong> (NASA elevation model), <strong>NASA POWER</strong> (regional temperature data), <strong>NHTSA FARS</strong> (US fatal crash locations), and <strong>WHO Global Health Observatory</strong> (country-level road traffic death rates). These are the same sources used by governments and research institutions worldwide. However, remote data has limitations — OpenStreetMap coverage varies by location, and satellite/climate data is regional, not street-level. That's exactly why we built <strong>field verification mode</strong>: open the full report, toggle "Field Verify," and adjust any score based on what you actually observe. Your verified report can be saved as PDF for presentations or advocacy.
                  </p>
                </div>
              </div>

              {/* FAQ 8 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 8 ? null : 8)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 8}
                  aria-controls="faq-8-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Does it work in my city/country?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 8 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-8-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 8 ? 'block' : 'hidden'}`}
                >
                  <p>
                    Yes! SafeStreets works globally with coverage in 190+ countries. Satellite data is available worldwide, though analysis quality depends on OpenStreetMap data completeness in your area. Major cities in the US, Europe, Japan, and Australia have excellent coverage.
                  </p>
                </div>
              </div>

              {/* FAQ 9 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 9 ? null : 9)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 9}
                  aria-controls="faq-9-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Can I use this for commercial projects?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 9 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-9-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 9 ? 'block' : 'hidden'}`}
                >
                  <p>
                    The core walkability analysis is free for everyone — no sign-up needed. The Advocacy Toolkit ($49 one-time) unlocks advanced features like the Street Audit Tool, advocacy letters & proposals, street redesign mockups, and unlimited Meridian chatbot. For municipalities and organizations needing custom analysis, contact us for tailored solutions.
                  </p>
                </div>
              </div>

              {/* FAQ 10 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 10 ? null : 10)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 10}
                  aria-controls="faq-10-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    What design standards do you follow?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 10 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-10-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 10 ? 'block' : 'hidden'}`}
                >
                  <p>
                    SafeStreets follows the <strong>Global Street Design Guide (GSDG)</strong>, developed by NACTO and the Global Designing Cities Initiative. The GSDG is used by 500+ cities worldwide and provides evidence-based standards for walkable, safe streets. Our metrics align with GSDG recommendations for sidewalk widths, pedestrian crossing distances, green infrastructure, and universal accessibility.
                  </p>
                </div>
              </div>

              {/* FAQ 11 */}
              <div className="rounded-lg border overflow-hidden bg-white/60 border-earth-border">
                <button
                  onClick={() => setOpenFaq(openFaq === 11 ? null : 11)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 11}
                  aria-controls="faq-11-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    What is the Traffic Fatalities card?
                  </h3>
                  <span className="text-2xl text-gray-500" aria-hidden="true">
                    {openFaq === 11 ? '−' : '+'}
                  </span>
                </button>
                <div
                  id="faq-11-content"
                  className={`px-4 sm:px-6 pb-4 sm:pb-6 text-gray-700 ${openFaq === 11 ? 'block' : 'hidden'}`}
                >
                  <p>
                    For <strong>US addresses</strong>, we show real fatal crash data within 800 meters of your location from the <strong>NHTSA Fatality Analysis Reporting System (FARS)</strong>, covering 2018-2022. This includes crash count, fatalities, yearly breakdown, and nearest fatal crash location. For <strong>international addresses</strong>, we show your country's road traffic death rate per 100,000 people from the <strong>WHO Global Health Observatory</strong>. This data is informational context &mdash; it does not affect the walkability score. FARS only tracks fatal crashes, not injuries.
                  </p>
                </div>
              </div>
              </>
              )}

              {/* Show more / Show less toggle */}
              <button
                onClick={() => setShowAllFaqs(!showAllFaqs)}
                className="w-full py-4 text-sm font-medium transition-colors rounded-lg border border-earth-border hover:bg-white/50 text-earth-text-body"
              >
                {showAllFaqs ? 'Show fewer questions' : 'Show 5 more questions'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer - Earthy light aesthetic */}
      <footer className="mt-16 relative overflow-hidden bg-earth-forest text-earth-text-light">
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8">
            {/* About Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg width="32" height="32" viewBox="0 0 44 44">
                  <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850"/>
                  <rect x="10" y="14" width="6" height="16" fill="white" rx="1"/>
                  <rect x="19" y="14" width="6" height="16" fill="white" rx="1"/>
                  <rect x="28" y="14" width="6" height="16" fill="white" rx="1"/>
                </svg>
                <h3 className="text-xl font-bold text-terra">SafeStreets</h3>
              </div>
              <p className="text-sm mb-4 leading-relaxed text-earth-text-light">
                Satellite-powered walkability analysis. Analyze street infrastructure, terrain, and environmental conditions anywhere on Earth.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-earth-green/[0.15] border border-earth-green/25 text-earth-green-light">
                <span className="w-1.5 h-1.5 rounded-full bg-earth-green-light"></span>
                100% free · No sign-up required
              </div>
            </div>

            {/* Pricing Column */}
            <div id="pricing">
              <h4 className="font-bold mb-4 text-earth-border">Pricing</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full mt-1.5 bg-earth-text-muted"></span>
                  <div>
                    <span className="font-semibold text-earth-border">Free Tier</span>
                    <p className="text-xs text-earth-text-muted">8 metrics, compare mode, field verification, 15-min city</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full mt-1.5 bg-terra"></span>
                  <div>
                    <span className="font-semibold text-terra">Advocacy Toolkit — $49</span>
                    <p className="text-xs text-earth-text-muted">Street audit, AI documents, redesign mockups, unlimited chatbot</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full mt-1.5 bg-enterprise-navy"></span>
                  <div>
                    <a href="/enterprise" className="font-semibold transition hover:text-white text-blue-300">Safety & Infrastructure Intelligence</a>
                    <p className="text-xs text-earth-text-muted">Dashboards, field audits & citizen advocacy from $50K</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Features Column */}
            <div>
              <h4 className="font-bold mb-4 text-earth-border">Key Features</h4>
              <ul className="space-y-2 text-sm text-earth-text-light">
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  Sentinel-2 satellite (10m)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  NASADEM elevation (30m)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  Global coverage (190+ countries)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  Field verification & PDF export
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  GSDG Standards compliant
                </li>
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h4 className="font-bold mb-4 text-earth-border">Data Sources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://www.openstreetmap.org" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    OpenStreetMap
                  </a>
                </li>
                <li>
                  <a href="https://earthengine.google.com" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    Google Earth Engine
                  </a>
                </li>
                <li>
                  <a href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    Sentinel-2 Satellite
                  </a>
                </li>
                <li>
                  <a href="https://lpdaac.usgs.gov/products/nasadem_hgtv001/" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    NASADEM Elevation
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-[#3a4a3a]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-earth-text-body">
              <p>© 2026 SafeStreets. All rights reserved.</p>
              <p className="text-center text-xs">
                Built for walkable cities, inspired by Jane Jacobs
              </p>
              <div className="flex items-center gap-4">
                <a href="/enterprise" className="transition hover:text-white text-earth-text-muted">Enterprise</a>
                <a href="/blog" className="transition hover:text-white text-earth-text-muted">Blog</a>
                <a href="#faq" className="transition hover:text-white text-earth-text-muted">FAQ</a>
                <a href="mailto:hello@streetsandcommons.com" className="transition hover:text-white text-earth-text-muted">Contact</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Demo nudge toast — appears after using a premium feature in demo */}
      {demoNudge && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border animate-in bg-white border-terra max-w-[420px]"
        >
          <span className="text-sm text-earth-text-dark">
            <strong>Like this?</strong> Get it for your own address.
          </span>
          <button
            onClick={() => { setDemoNudge(false); setShowSignInModal(true); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap flex-shrink-0 bg-terra"
          >
            Go Premium — $49
          </button>
          <button
            onClick={() => setDemoNudge(false)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Demo mode banner */}
      {demoMode && (
        <Suspense fallback={null}>
          <DemoBanner onExit={exitDemoMode} onUnlock={() => setShowSignInModal(true)} />
        </Suspense>
      )}

      {/* Product tour overlay */}
      {showTour && (
        <Suspense fallback={null}>
          <ProductTour
            isActive={showTour}
            onComplete={() => { setShowTour(false); localStorage.setItem('safestreets_tour_completed', '1'); }}
            onSkip={() => { setShowTour(false); localStorage.setItem('safestreets_tour_completed', '1'); }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
