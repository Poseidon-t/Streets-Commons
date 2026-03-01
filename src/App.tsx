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
const FifteenMinuteCity = lazy(() => import('./components/FifteenMinuteCity'));
const ShareableReportCard = lazy(() => import('./components/ShareableReportCard'));
const StreetAuditTool = lazy(() => import('./components/StreetAuditTool'));
const EmailCaptureBanner = lazy(() => import('./components/EmailCaptureBanner'));
const ProductTour = lazy(() => import('./components/ProductTour'));
const DemoBanner = lazy(() => import('./components/DemoBanner'));
const ProUpgradeModal = lazy(() => import('./components/ProUpgradeModal'));
const AgentProfileModal = lazy(() => import('./components/AgentProfileModal'));

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
import { isPremium, isPro, canGenerateAgentReport, getAgentProfile, getProTrialReportsUsed } from './utils/clerkAccess';
import type { AgentProfile } from './utils/clerkAccess';
import { getSavedAddresses, saveAddress, removeAddress, MAX_ADDRESSES, type SavedAddress } from './utils/savedAddresses';
import { COLORS } from './constants';
import { analyzeLocalEconomy } from './utils/localEconomicAnalysis';
import { fetchCDCHealth } from './services/cdcHealth';
import { fetchFloodRisk } from './services/floodRisk';
import { computeTransitAccess, computeParkAccess, computeFoodAccess } from './utils/neighborhoodIntelligence';
import type { Location, WalkabilityMetrics, DataQuality, OSMData, RawMetricData, CrashData, WalkabilityScoreV2, DemographicData, NeighborhoodIntelligence } from './types';

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
  const [neighborhoodIntel, setNeighborhoodIntel] = useState<NeighborhoodIntelligence | null>(null);

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
  const [showMethodology, setShowMethodology] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('safestreets_seen_onboarding'); } catch { return true; }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedAddressList, setSavedAddressList] = useState<SavedAddress[]>(() => getSavedAddresses());
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);
  const [showAuditTool, setShowAuditTool] = useState(false);
  const [showProUpgradeModal, setShowProUpgradeModal] = useState(false);
  const [showAgentProfileModal, setShowAgentProfileModal] = useState(false);
  const pendingAgentReport = useRef(new URLSearchParams(window.location.search).get('agent') === 'true');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [meridianQuote, setMeridianQuote] = useState<{ text: string; author: string } | null>(null);

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

  // Auto-trigger agent report flow when arriving via ?agent=true (from ForRealEstate / CityPage / Admin Sales Pipeline)
  useEffect(() => {
    if (pendingAgentReport.current && metrics && location) {
      pendingAgentReport.current = false;
      const params = new URLSearchParams(window.location.search);
      const urlAgentName = params.get('agentName');
      // If agent profile provided via URL params (admin sales pipeline), skip modals and generate directly
      if (urlAgentName) {
        const profile: AgentProfile = {
          name: urlAgentName,
          company: params.get('agentCompany') || '',
          email: params.get('agentEmail') || '',
          phone: params.get('agentPhone') || '',
          title: params.get('agentTitle') || '',
        };
        setTimeout(() => generateAgentReport(profile), 500);
      } else {
        setTimeout(() => handleAgentReportClick(), 500);
      }
    }
  }, [metrics, location]);

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
    setNeighborhoodIntel(null);

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
    setLocation(null);
    setMetrics(null);
    setCompositeScore(null);
    setDataQuality(null);
    setCrashData(null);
    setCrashLoading(false);
    setDemographicData(null);
    setDemographicLoading(false);
    setNeighborhoodIntel(null);
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
    floodRisk: fetchFloodRisk(selectedLocation.lat, selectedLocation.lon)
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

      // Extract commute data from demographics response
      const commute = (result?.type === 'us' && (result as any).commute) ? (result as any).commute : null;

      // Update neighborhood intel with commute data
      setNeighborhoodIntel(prev => ({ ...prev, commute, transit: prev?.transit ?? null, parks: prev?.parks ?? null, food: prev?.food ?? null, health: prev?.health ?? null, flood: prev?.flood ?? null }));

      // Chain CDC health fetch using tract FIPS
      if (result?.type === 'us' && result.tractFips) {
        fetchCDCHealth(result.tractFips).then(health => {
          if (abortController.signal.aborted) return;
          setNeighborhoodIntel(prev => prev ? { ...prev, health } : { commute: null, transit: null, parks: null, food: null, health, flood: null });
        });
      }
    });

    // Compute transit, park, food access from existing OSM data (immediate, no API call)
    const transit = computeTransitAccess(currentOsmData, selectedLocation.lat, selectedLocation.lon);
    const parks = computeParkAccess(currentOsmData, selectedLocation.lat, selectedLocation.lon);
    const food = computeFoodAccess(currentOsmData, selectedLocation.lat, selectedLocation.lon);
    setNeighborhoodIntel(prev => ({
      commute: prev?.commute ?? null,
      transit,
      parks,
      food,
      health: prev?.health ?? null,
      flood: prev?.flood ?? null,
    }));

    // Flood risk (parallel fetch)
    promises.floodRisk.then(flood => {
      if (abortController.signal.aborted) return;
      setNeighborhoodIntel(prev => prev ? { ...prev, flood } : { commute: null, transit: null, parks: null, food: null, health: null, flood });
    });
  };

  // Agent Report flow: check access → profile → generate
  const handleAgentReportClick = () => {
    if (!isSignedIn || !canGenerateAgentReport(user)) {
      setShowProUpgradeModal(true);
      return;
    }
    const profile = getAgentProfile(user);
    if (!profile) {
      setShowAgentProfileModal(true);
      return;
    }
    generateAgentReport(profile);
  };

  const handleProUpgradeReady = () => {
    setShowProUpgradeModal(false);
    const profile = getAgentProfile(user);
    if (!profile) {
      setShowAgentProfileModal(true);
      return;
    }
    generateAgentReport(profile);
  };

  const handleAgentProfileSave = (profile: AgentProfile) => {
    setShowAgentProfileModal(false);
    generateAgentReport(profile);
  };

  const generateAgentReport = async (profile: AgentProfile) => {
    if (!location || !metrics) return;

    // Increment trial counter if not pro
    if (user && !isPro(user)) {
      const used = getProTrialReportsUsed(user);
      try {
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            proTrialReportsUsed: used + 1,
          },
        });
      } catch (err) {
        console.error('Failed to update trial counter:', err);
      }
    }

    // Store report data in sessionStorage
    const reportData = {
      location,
      metrics,
      compositeScore,
      dataQuality,
      crashData,
      neighborhoodIntel,
      agentProfile: profile,
    };
    sessionStorage.setItem('agentReportData', JSON.stringify(reportData));
    window.open('/report/agent', '_blank');
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

      {/* Pro Upgrade Modal */}
      <Suspense fallback={null}>
        <ProUpgradeModal
          isOpen={showProUpgradeModal}
          onClose={() => setShowProUpgradeModal(false)}
          onReady={handleProUpgradeReady}
        />
      </Suspense>

      {/* Agent Profile Modal */}
      <Suspense fallback={null}>
        <AgentProfileModal
          isOpen={showAgentProfileModal}
          onClose={() => setShowAgentProfileModal(false)}
          onSave={handleAgentProfileSave}
        />
      </Suspense>

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
            <a href="#faq" onClick={(e) => { if (location || compareMode || demoMode) { e.preventDefault(); setCompareMode(false); setLocation(null); setMetrics(null); setDemoMode(false); setShowTour(false); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); }}} className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">FAQ</a>
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
            <a href="#faq" className="block text-sm font-medium py-2 text-earth-text-body" onClick={(e) => { if (location || compareMode || demoMode) { e.preventDefault(); setCompareMode(false); setLocation(null); setMetrics(null); setDemoMode(false); setShowTour(false); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); } setMobileMenuOpen(false); }}>FAQ</a>
            <a href="/enterprise" className="block text-sm font-medium py-2 text-earth-text-body" onClick={() => setMobileMenuOpen(false)}>Enterprise</a>
            {!isSignedIn && (
              <button onClick={() => { setShowSignInModal(true); setMobileMenuOpen(false); }} className="block text-sm font-medium py-2 text-earth-text-body cursor-pointer bg-transparent border-none w-full text-left">Sign In</button>
            )}
          </div>
        )}
      </header>

      {/* Hero Section - Side-by-side with topographic texture */}
      {!compareMode && !location && !isAnalyzing && (
        <section className="relative overflow-hidden flex flex-col font-sans" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 50%, #e8f0eb 100%)' }}>
          {/* Topographic contour background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.06 }}>
            <defs>
              <pattern id="topoPattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                <path d="M 100 10 Q 140 30, 180 25 Q 195 60, 170 90 Q 150 120, 100 110 Q 50 100, 30 70 Q 15 40, 50 20 Q 70 10, 100 10 Z" fill="none" stroke="#4a8a4a" strokeWidth="1"/>
                <path d="M 100 30 Q 130 45, 160 40 Q 175 65, 155 85 Q 140 100, 100 95 Q 65 88, 50 65 Q 38 48, 60 35 Q 75 28, 100 30 Z" fill="none" stroke="#4a8a4a" strokeWidth="0.8"/>
                <path d="M 100 50 Q 120 58, 140 55 Q 150 70, 135 80 Q 125 88, 100 85 Q 78 80, 70 65 Q 64 55, 78 50 Q 88 46, 100 50 Z" fill="none" stroke="#4a8a4a" strokeWidth="0.6"/>
                <path d="M 100 65 Q 112 68, 120 66 Q 125 73, 118 78 Q 112 82, 100 80 Q 90 78, 85 72 Q 82 67, 90 65 Q 95 63, 100 65 Z" fill="none" stroke="#4a8a4a" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topoPattern)"/>
          </svg>

          {/* Two-column hero layout */}
          <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pt-10 md:pt-16 pb-8">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
              {/* Left column - Text & Search */}
              <div className="flex flex-col items-center md:items-start">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center md:text-left mb-4 tracking-tight text-earth-text-dark">
                  Is Your Neighborhood{' '}
                  <span className="text-terra">Safe to Walk</span>?
                </h1>

                <p className="text-base sm:text-lg md:text-xl text-center md:text-left max-w-lg mb-6 text-earth-text-body">
                  The walking experience, the health context, the economic reality.
                  <span className="text-earth-text-light"> Any address. Free, no sign-up.</span>
                </p>

                {/* Search Box */}
                <div className="w-full max-w-xl mb-4">
                  <div className="search-box-light bg-white rounded-2xl">
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
                    className="mt-2 block mx-auto md:mx-0 text-sm font-medium text-terra hover:text-terra/80 transition-colors"
                    aria-label="Use my current location"
                  >
                    Use my location
                  </button>
                </div>

                <button
                  onClick={activateDemoMode}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-terra/30 text-terra font-semibold text-sm rounded-xl hover:bg-terra/10 hover:border-terra/50 transition-all mb-5"
                >
                  <span className="text-base">&#9654;</span>
                  Watch Demo &mdash; Portland, OR
                </button>

                {/* Trust badges */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4">
                  <span className="text-xs sm:text-sm text-earth-text-light">
                    <span className="text-earth-green font-semibold">12</span> data layers
                  </span>
                  <span className="text-earth-text-light hidden sm:inline">·</span>
                  <span className="text-xs sm:text-sm text-earth-text-light">
                    <span className="text-earth-green font-semibold">190+</span> countries
                  </span>
                  <span className="text-earth-text-light hidden sm:inline">·</span>
                  <span className="text-xs sm:text-sm text-earth-text-light">
                    Powered by <span className="text-earth-green font-semibold">NASA</span>, <span className="text-earth-green font-semibold">Census</span> & <span className="text-earth-green font-semibold">CDC</span>
                  </span>
                </div>
              </div>

              {/* Right column - Preview Card */}
              <div className="flex justify-center md:justify-end">
                <div className="w-full max-w-md">
                  <div className="bg-white rounded-2xl shadow-xl border border-earth-border p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📍</span>
                        <span className="text-sm font-bold" style={{ color: '#2a3a2a' }}>Portland, OR</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold" style={{ color: '#22c55e' }}>7.2</span>
                        <span className="text-xs" style={{ color: '#8a9a8a' }}>/10</span>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="h-2 rounded-full mb-4" style={{ backgroundColor: '#f0ebe0' }}>
                      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: '72%', backgroundColor: '#84cc16' }} />
                    </div>
                    {/* 6 metrics grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { icon: '🔀', name: 'Street Grid', score: '7.8' },
                        { icon: '⛰️', name: 'Terrain', score: '8.2' },
                        { icon: '🌳', name: 'Tree Canopy', score: '6.5' },
                        { icon: '🚨', name: 'Crashes', score: '5.9' },
                        { icon: '🏪', name: 'Destinations', score: '7.1' },
                        { icon: '👥', name: 'Population', score: '6.8' },
                      ].map(m => (
                        <div key={m.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: '#f8f6f1' }}>
                          <span className="text-xs" style={{ color: '#6a7a6a' }}>{m.icon} {m.name}</span>
                          <span className="text-xs font-bold" style={{ color: '#2a3a2a' }}>{m.score}</span>
                        </div>
                      ))}
                    </div>
                    {/* Neighborhood Intelligence preview */}
                    <div className="border-t pt-3 space-y-2.5" style={{ borderColor: '#e0dbd0' }}>
                      <div>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: '#2a3a2a' }}>Getting Around</p>
                        <div className="flex h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
                          <div className="h-full" style={{ width: '28%', backgroundColor: '#22c55e' }} title="Walk 28%" />
                          <div className="h-full" style={{ width: '8%', backgroundColor: '#3b82f6' }} title="Bike 8%" />
                          <div className="h-full" style={{ width: '12%', backgroundColor: '#8b5cf6' }} title="Transit 12%" />
                          <div className="h-full" style={{ width: '15%', backgroundColor: '#06b6d4' }} title="WFH 15%" />
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px]" style={{ color: '#8a9a8a' }}>🟢 28% walk</span>
                          <span className="text-[10px]" style={{ color: '#8a9a8a' }}>🔵 8% bike</span>
                          <span className="text-[10px]" style={{ color: '#8a9a8a' }}>🟣 12% transit</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>🛒 3 supermarkets</span>
                        <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>🌳 5 parks</span>
                        <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>🌊 Low risk</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Credibility & Data Sources - centered */}
          <div className="relative z-10 flex flex-col items-center px-6 pb-8">
            {/* Credibility Marker */}
            <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-earth-green/[0.08]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#4a8a4a"/>
              </svg>
              <span className="text-sm text-earth-green">
                Built on <strong>NACTO</strong> & <strong>GSDG</strong> standards
              </span>
            </div>

            {/* Data Sources */}
            <div className="flex flex-wrap justify-center gap-2">
              {['NASA & Sentinel-2', 'US Census & CDC', 'OpenStreetMap', 'FEMA & NHTSA'].map((source) => (
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
            {isSignedIn && location && (
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
          {isSignedIn && savedAddressList.length > 0 && (
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
                <AddressInput
                  onSelect={handleLocationSelect}
                  placeholder="Enter any address worldwide..."
                />
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
              <MetricGrid metrics={metrics} locationName={location.displayName} satelliteLoaded={satelliteLoaded} compositeScore={compositeScore} demographicData={demographicData} demographicLoading={demographicLoading} osmData={osmData} crashData={crashData} neighborhoodIntel={neighborhoodIntel} />
            </div>

            {/* Share + Export — right after metrics so users can act immediately */}
            <div id="report-actions">
            <ErrorBoundary sectionName="Share Buttons">
              <Suspense fallback={null}>
                <ShareButtons
                  location={location}
                  metrics={metrics}
                  dataQuality={dataQuality || undefined}
                  isPremium={true}
                  onShareReport={() => setShowReportCard(true)}
                />
              </Suspense>
            </ErrorBoundary>

            {/* Agent Report CTA */}
            <div className="mt-3 rounded-xl border p-4 sm:p-5" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(30,58,95,0.04)' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-sm font-bold" style={{ color: '#1e3a5f' }}>Real Estate Agent?</h4>
                  <p className="text-xs" style={{ color: '#8a9a8a' }}>Generate a branded walkability report for this listing</p>
                </div>
                <button
                  onClick={handleAgentReportClick}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  Generate Agent Report
                </button>
              </div>
            </div>
            </div>

            {/* 15-Minute City Score (free for all users) */}
            <div id="neighborhood" className="scroll-mt-16"></div>
            <ErrorBoundary sectionName="15-Minute City">
              <Suspense fallback={null}>
                <FifteenMinuteCity location={location} osmElements={osmData?.rawElements} />
              </Suspense>
            </ErrorBoundary>



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
                      <p className="text-[#4a5a4a]">We analyze crossing safety, sidewalk coverage, traffic speed exposure, daily destinations, street lighting, terrain slope, tree canopy, and thermal comfort using data from OpenStreetMap, NASA POWER, and Sentinel-2 satellite imagery.</p>
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
                        Walkability and neighborhood intelligence calculated in seconds from satellite and government data.
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
                      <h3 className="text-xl font-bold text-earth-text-dark mb-2">Compare & Decide</h3>
                      <p className="text-earth-text-body text-sm leading-relaxed">
                        Compare neighborhoods side by side, download a PDF report, and share with family or your agent.
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

            {/* What You'll Learn */}
            <section className="py-16 bg-earth-sage/60">
              <div className="max-w-5xl mx-auto px-6">
                <h2 className="text-3xl font-bold text-center mb-4 text-earth-text-dark">
                  What You'll Learn
                </h2>
                <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                  12 data layers from satellite imagery and government sources — completely free, no sign-up required.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Walkability Metrics */}
                  <div>
                    <h3 className="text-lg font-bold text-earth-text-dark mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-earth-green/10 flex items-center justify-center text-sm">🚶</span>
                      Walkability Metrics
                    </h3>
                    <div className="space-y-3">
                      {[
                        { icon: '🔀', name: 'Street Grid', desc: 'Street connectivity and route options', source: 'OpenStreetMap' },
                        { icon: '⛰️', name: 'Terrain', desc: 'Elevation and slope difficulty', source: 'NASA SRTM' },
                        { icon: '🌳', name: 'Tree Canopy', desc: 'Shade and vegetation coverage', source: 'Sentinel-2' },
                        { icon: '🚨', name: 'Crash History', desc: 'Pedestrian crash data', source: 'NHTSA / WHO' },
                        { icon: '🏪', name: 'Destinations', desc: 'Daily needs within walking distance', source: 'OpenStreetMap' },
                        { icon: '👥', name: 'Population', desc: 'Density and urban context', source: 'GHS-POP' },
                      ].map(item => (
                        <div key={item.name} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-earth-border/60">
                          <span className="text-base mt-0.5">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-bold text-gray-900">{item.name}</span>
                              <span className="text-[10px] text-gray-400">{item.source}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Neighborhood Intelligence */}
                  <div>
                    <h3 className="text-lg font-bold text-earth-text-dark mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-earth-green/10 flex items-center justify-center text-sm">🏘️</span>
                      Neighborhood Intelligence
                    </h3>
                    <div className="space-y-3">
                      {[
                        { icon: '🚗', name: 'Commute Patterns', desc: 'How residents get to work', source: 'US Census ACS' },
                        { icon: '🚌', name: 'Transit Access', desc: 'Bus stops and rail stations nearby', source: 'OpenStreetMap' },
                        { icon: '🌳', name: 'Park Access', desc: 'Green spaces and playgrounds', source: 'OpenStreetMap' },
                        { icon: '🛒', name: 'Food Access', desc: 'Supermarkets and food desert detection', source: 'OpenStreetMap' },
                        { icon: '🏥', name: 'Health Outcomes', desc: 'Obesity, diabetes, asthma rates', source: 'CDC PLACES' },
                        { icon: '🌊', name: 'Flood Risk', desc: 'FEMA flood zone classification', source: 'FEMA NFHL' },
                      ].map(item => (
                        <div key={item.name} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-earth-border/60">
                          <span className="text-base mt-0.5">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-bold text-gray-900">{item.name}</span>
                              <span className="text-[10px] text-gray-400">{item.source}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Agent Reports CTA */}
            <section className="py-12 bg-white/30">
              <div className="max-w-5xl mx-auto px-6">
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#2a3a2a' }}>
                  <div className="p-8 sm:p-10 lg:p-12">
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                      {/* Content */}
                      <div className="flex-1 text-center lg:text-left">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ backgroundColor: 'rgba(224,120,80,0.15)', color: '#e8a070' }}>
                          For Real Estate Agents
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                          Branded Walkability Reports
                        </h3>
                        <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          Your name, company, and contact info on every page. Print-ready PDFs with walkability analysis, neighborhood intelligence, 15-minute city scores, and crash safety data for any listing.
                        </p>
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                          <a
                            href="/?agent=true"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-lg hover:brightness-110"
                            style={{ backgroundColor: '#e07850', color: '#ffffff' }}
                          >
                            Try 3 Free Reports
                          </a>
                          <a
                            href="https://buy.stripe.com/7sY5kD8XD7VL3FAgYo2Fa08"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white/10"
                            style={{ border: '1.5px solid rgba(224,120,80,0.4)', color: '#e8a070' }}
                          >
                            $99 One-Time &mdash; Unlimited
                          </a>
                        </div>
                      </div>

                      {/* Mini report preview - realistic branded report */}
                      <div className="hidden lg:block flex-shrink-0">
                        <div className="w-48 rounded-lg shadow-2xl overflow-hidden transform rotate-2" style={{ backgroundColor: '#ffffff' }}>
                          {/* Agent branding header */}
                          <div className="px-4 pt-3 pb-2" style={{ backgroundColor: '#f8f6f1', borderBottom: '2px solid #e07850' }}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#e07850' }} />
                              <div>
                                <div className="h-1.5 w-16 rounded" style={{ backgroundColor: '#2a3a2a' }} />
                                <div className="h-1 w-12 rounded mt-0.5" style={{ backgroundColor: '#8a9a8a' }} />
                              </div>
                            </div>
                          </div>
                          {/* Report content */}
                          <div className="px-4 pt-3 pb-2">
                            <div className="h-1 w-24 rounded mb-0.5" style={{ backgroundColor: '#2a3a2a' }} />
                            <div className="h-0.5 w-16 rounded mb-3" style={{ backgroundColor: '#c0b8a8' }} />
                            <div className="flex items-baseline justify-center gap-1 mb-3">
                              <span className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>8.4</span>
                              <span className="text-xs" style={{ color: '#8a9a8a' }}>/10</span>
                            </div>
                            {/* Metric rows with names */}
                            <div className="space-y-1.5 mb-3">
                              {[
                                { name: 'Grid', w: 78 },
                                { name: 'Trees', w: 65 },
                                { name: 'Safety', w: 82 },
                                { name: 'Access', w: 71 },
                                { name: 'Transit', w: 58 },
                                { name: 'Health', w: 74 },
                              ].map((m) => (
                                <div key={m.name} className="flex items-center gap-1.5">
                                  <span className="text-[6px] w-6 text-right" style={{ color: '#8a9a8a' }}>{m.name}</span>
                                  <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: '#f0ebe0' }}>
                                    <div className="h-full rounded-full" style={{ width: `${m.w}%`, backgroundColor: '#4a8a4a', opacity: 0.6 }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Footer with agent contact */}
                          <div className="px-4 py-2" style={{ backgroundColor: '#f8f6f1' }}>
                            <div className="h-0.5 w-14 mx-auto rounded mb-0.5" style={{ backgroundColor: '#c0b8a8' }} />
                            <div className="h-0.5 w-20 mx-auto rounded" style={{ backgroundColor: '#e0dbd0' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feature bar */}
                    <div className="mt-8 pt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Your branding on every page', 'Full walkability analysis', '15-min city + social indicators', 'Print-ready PDF'].map(f => (
                        <span key={f} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <svg className="w-3.5 h-3.5" style={{ color: '#4a8a4a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </span>
                      ))}
                    </div>
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


      {/* FAQ Section - Only show when no analysis is displayed */}
      {!compareMode && !location && !isAnalyzing && (
        <section id="faq" className="py-12 bg-white/40">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-10 text-earth-text-dark">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {/* FAQ 1 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
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
                    Yes! All 12 data layers, compare mode, field verification, and neighborhood intelligence are completely free with no sign-up required. We use open government data (NASA, US Census, CDC, FEMA, OpenStreetMap). Unlimited searches, works globally in 190+ countries.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 2}
                  aria-controls="faq-2-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    How is the walkability score calculated?
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
                    Your score (out of 10) is a weighted average of 6 walkability metrics: <strong>street grid connectivity</strong> (how well streets connect and offer route options), <strong>terrain</strong> (elevation and slope difficulty from NASA data), <strong>tree canopy</strong> (shade and vegetation from satellite imagery), <strong>crash history</strong> (pedestrian crash records from NHTSA/WHO), <strong>destinations</strong> (daily needs within walking distance), and <strong>population density</strong> (urban context). Each metric is scored independently so you can see exactly what's strong or weak about your area.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 3}
                  aria-controls="faq-3-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    How is this different from Walk Score?
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
                    Walk Score measures proximity to nearby amenities. SafeStreets analyzes the actual experience of living in a neighborhood &mdash; terrain, shade, crash history, transit access, food deserts, health outcomes, and flood risk. We use real satellite imagery and government data, not just distance calculations. And it's free.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 4 ? null : 4)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 4}
                  aria-controls="faq-4-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    What does Neighborhood Intelligence show?
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
                    Beyond walkability scores, Neighborhood Intelligence shows how people actually live in an area: <strong>commute patterns</strong> (walk, bike, transit, car split from Census data), <strong>transit access</strong> (bus stops and rail stations nearby), <strong>park and food access</strong> (including food desert detection), <strong>health outcomes</strong> (obesity, diabetes, asthma rates vs. US averages from CDC), and <strong>flood risk</strong> (FEMA flood zone classification). For US addresses, this data updates automatically from federal sources.
                  </p>
                </div>
              </div>

              {/* FAQ 5 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 5 ? null : 5)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 5}
                  aria-controls="faq-5-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Where does the data come from?
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
                    We use research-grade open data: <strong>Sentinel-2</strong> satellite imagery (tree canopy), <strong>NASADEM</strong> (terrain), <strong>OpenStreetMap</strong> (street infrastructure, transit stops, amenities), <strong>NHTSA FARS</strong> (US crash data), <strong>US Census ACS</strong> (commute patterns, demographics), <strong>CDC PLACES</strong> (health outcomes by census tract), <strong>FEMA NFHL</strong> (flood risk zones), and <strong>WHO</strong> (international safety data). These are the same sources used by governments and research institutions.
                  </p>
                </div>
              </div>

              {/* Remaining FAQs - hidden by default */}
              {showAllFaqs && (
              <>
              {/* FAQ 6 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 6 ? null : 6)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 6}
                  aria-controls="faq-6-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    How accurate and up-to-date is the data?
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
                    Our data sources update on different schedules: <strong>satellite imagery</strong> refreshes every few months, <strong>OpenStreetMap</strong> updates continuously from community contributors, <strong>US Census ACS</strong> releases annually, <strong>CDC PLACES</strong> updates yearly, and <strong>FEMA flood maps</strong> update as new studies are completed. Crash data typically lags 1&ndash;2 years due to government reporting timelines. We always use the most recent available data from each source.
                  </p>
                </div>
              </div>

              {/* FAQ 7 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 7 ? null : 7)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 7}
                  aria-controls="faq-7-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Is my address data private?
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
                    Yes. We don't store your search history or link addresses to your identity. Searches are processed in real time and not logged. No account is required, so there's no profile tied to your queries. We don't sell data to third parties.
                  </p>
                </div>
              </div>

              {/* FAQ 8 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 8 ? null : 8)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 8}
                  aria-controls="faq-8-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Does it work outside the US?
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
                    Yes! Walkability analysis works globally in 190+ countries using satellite data and OpenStreetMap. Neighborhood Intelligence features like commute data, health outcomes, and flood risk are US-only (powered by Census, CDC, and FEMA). International locations still get full walkability, transit, park, and food access analysis.
                  </p>
                </div>
              </div>

              {/* FAQ 9 */}
              <div className="rounded-lg border overflow-hidden bg-white/80 border-earth-border shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === 9 ? null : 9)}
                  className="w-full text-left p-6 flex justify-between items-center transition hover:opacity-80"
                  aria-expanded={openFaq === 9}
                  aria-controls="faq-9-content"
                >
                  <h3 className="text-lg font-bold text-earth-text-dark">
                    Can real estate agents use this?
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
                    Yes! Agents can generate branded walkability reports with their name, company, and contact info for any property listing. The first 3 reports are free. Unlimited reports are available with a Pro account ($99 one-time). Every Walk Score point adds approximately $3,500 to home value &mdash; give your buyers the data they need.
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
                {showAllFaqs ? 'Show fewer questions' : 'Show 4 more questions'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Newsletter subscribe - before footer */}
      {!compareMode && !location && !isAnalyzing && !demoMode && (
        <section className="py-10 bg-earth-sage/30">
          <div className="max-w-4xl mx-auto px-6">
            <Suspense fallback={null}>
              <EmailCaptureBanner
                userEmail={user?.primaryEmailAddress?.emailAddress}
              />
            </Suspense>
          </div>
        </section>
      )}

      {/* Footer - Earthy light aesthetic */}
      <footer className="mt-0 relative overflow-hidden bg-earth-forest text-earth-text-light">
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
                Neighborhood intelligence powered by satellite and government data. Walkability, transit, safety, health, and daily amenities for any address.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-earth-green/[0.15] border border-earth-green/25 text-earth-green-light">
                <span className="w-1.5 h-1.5 rounded-full bg-earth-green-light"></span>
                100% free · No sign-up required
              </div>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-bold mb-4 text-earth-border">Product</h4>
              <ul className="space-y-2 text-sm text-earth-text-light">
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  Free walkability analysis
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  Compare neighborhoods
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  PDF reports & sharing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-terra">·</span>
                  <a href="/enterprise" className="transition hover:text-white text-earth-text-light">Enterprise solutions</a>
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
