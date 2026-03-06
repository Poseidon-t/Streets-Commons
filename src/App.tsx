import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import AddressInput from './components/streetcheck/AddressInput';
import ScoreCard from './components/streetcheck/ScoreCard';
import MetricGrid from './components/streetcheck/MetricGrid';
import StreetNetworkPanel from './components/streetcheck/StreetNetworkPanel';
import PersonaCards from './components/streetcheck/PersonaCards';
import StreetVibe from './components/streetcheck/StreetVibe';
import Map from './components/Map';
import PaymentModalWithAuth from './components/PaymentModalWithAuth';

import ErrorBoundary from './components/ErrorBoundary';

// Lazy-load heavy components (only loaded when needed)
const CompareView = lazy(() => import('./components/CompareView'));
const ShareButtons = lazy(() => import('./components/ShareButtons'));
const FifteenMinuteCity = lazy(() => import('./components/FifteenMinuteCity'));
const ShareableReportCard = lazy(() => import('./components/ShareableReportCard'));
const StreetAuditTool = lazy(() => import('./components/StreetAuditTool'));
const ProductTour = lazy(() => import('./components/ProductTour'));
const DemoBanner = lazy(() => import('./components/DemoBanner'));
const ProUpgradeModal = lazy(() => import('./components/ProUpgradeModal'));
const AgentProfileModal = lazy(() => import('./components/AgentProfileModal'));

import { trackEvent, identifyUser } from './utils/analytics';
import { fetchOSMData } from './services/overpass';
import { calculateMetrics, assessDataQuality } from './utils/metrics';
import { fetchNDVI, scoreTreeCanopy } from './services/treecanopy';
import { fetchSurfaceTemperature } from './services/surfacetemperature';
import { fetchAirQuality } from './services/airquality';
import { fetchHeatIsland } from './services/heatisland';
import { fetchStreetDesign } from './services/streetDesign';
import { fetchPopulationDensity } from './services/populationDensity';
import { fetchDemographicData } from './services/demographics';
import { calculateCompositeScore } from './utils/compositeScore';
import { useUser, UserButton } from '@clerk/clerk-react';
import { isPremium, isPro, canGenerateAgentReport, getAgentProfile, getProTrialReportsUsed } from './utils/clerkAccess';
import type { AgentProfile } from './utils/clerkAccess';
import { getSavedAddresses, saveAddress, removeAddress, MAX_ADDRESSES, type SavedAddress } from './utils/savedAddresses';
import { COLORS } from './constants';
import { fetchCDCHealth } from './services/cdcHealth';
import { fetchFloodRisk } from './services/floodRisk';
import { fetchTerrain } from './services/terrain';
import { fetchTransitAccess } from './services/transitAccess';
import { fetchStreetFeatures } from './services/streetFeatures';
import { computeParkAccess, computeFoodAccess } from './utils/neighborhoodIntelligence';
import type { Location, WalkabilityMetrics, DataQuality, OSMData, WalkabilityScoreV2, DemographicData, NeighborhoodIntelligence, StreetCharacterAnalysis } from './types';

interface AnalysisData {
  location: Location;
  metrics: WalkabilityMetrics;
  quality: DataQuality;
  osmData: OSMData;
  compositeScore?: WalkabilityScoreV2 | null;
  streetDesignScore?: number;
}

const ANALYSIS_STEPS = [
  { label: 'Fetching street network', delay: 0 },
  { label: 'Mapping walkways & crossings', delay: 1400 },
  { label: 'Computing walkability score', delay: 3000 },
];

function AnalysisProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = ANALYSIS_STEPS.slice(1).map((s, i) =>
      setTimeout(() => setStep(i + 1), s.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="flex flex-col gap-2 mt-5">
      {ANALYSIS_STEPS.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2.5 text-sm">
          {i < step ? (
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#22c55e" />
              <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : i === step ? (
            <div className="w-4 h-4 border-2 flex-shrink-0 rounded-full border-orange-500 border-t-transparent animate-spin" />
          ) : (
            <div className="w-4 h-4 flex-shrink-0 rounded-full border-2" style={{ borderColor: '#d1cfc8' }} />
          )}
          <span style={{ color: i <= step ? '#3a4a3a' : '#a0a8a0' }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const URBANIST_QUOTES = [
  { text: 'Cities have the capability of providing something for everybody, only because, and only when, they are created by everybody.', author: 'Jane Jacobs' },
  { text: 'There must be eyes upon the street, eyes belonging to those we might call the natural proprietors of the street.', author: 'Jane Jacobs' },
  { text: 'Under the seeming disorder of the old city, wherever the old city is working successfully, is a marvelous order.', author: 'Jane Jacobs' },
  { text: 'First life, then spaces, then buildings — the other way around never works.', author: 'Jan Gehl' },
  { text: 'A good city is like a good party — people stay longer than really necessary, because they are enjoying themselves.', author: 'Jan Gehl' },
  { text: 'Walkable places are the foundations on which productive cities and healthy communities are built.', author: 'Jeff Speck' },
  { text: 'A city built for speed is a city built for nobody.', author: 'Jeff Speck' },
  { text: 'The street is the river of life of the city.', author: 'William H. Whyte' },
  { text: 'What attracts people most, it would appear, is other people.', author: 'William H. Whyte' },
  { text: 'The city is not a problem. The city is a solution.', author: 'Jaime Lerner' },
  { text: 'An advanced city is not one where even the poor use cars, but rather one where even the rich use public transport.', author: 'Enrique Peñalosa' },
  { text: 'God made us pedestrians.', author: 'Enrique Peñalosa' },
  { text: 'Men come together in cities in order to live, but they remain together in order to live the good life.', author: 'Aristotle' },
  { text: 'The automobile has not merely taken over the street, it has dissolved the living tissue of the city.', author: 'Lewis Mumford' },
  { text: 'A city is a fact in nature, like a cave or an ant-heap. But it is also a conscious work of art.', author: 'Lewis Mumford' },
];

function App() {
  const [compareMode, setCompareMode] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [metrics, setMetrics] = useState<WalkabilityMetrics | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [osmData, setOsmData] = useState<OSMData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [satelliteLoaded, setSatelliteLoaded] = useState<Set<string>>(new Set());
  const [streetDesignScore, setStreetDesignScore] = useState<number | undefined>();
  const [compositeScore, setCompositeScore] = useState<WalkabilityScoreV2 | null>(null);
  const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
  const [demographicLoading, setDemographicLoading] = useState(false);
  const [neighborhoodIntel, setNeighborhoodIntel] = useState<NeighborhoodIntelligence | null>(null);
  const [streetCharacter, setStreetCharacter] = useState<StreetCharacterAnalysis | null>(null);
  const [streetCharacterLoading, setStreetCharacterLoading] = useState(false);
  const [mapillaryCoverageGap, setMapillaryCoverageGap] = useState(false);

  // Premium access - Clerk integration
  const { user, isSignedIn } = useUser();
  const userIsPremium = isPremium(user);

  // Demo mode + product tour
  const [demoMode, setDemoMode] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Effective premium: real premium OR demo mode
  const effectivePremium = userIsPremium || demoMode;

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
  const [analysisQuote, setAnalysisQuote] = useState<{ text: string; author: string } | null>(null);
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'cancelled' | null>(null);

  // Handle post-payment redirect — detect ?payment=success or ?payment=cancelled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success' || paymentStatus === 'cancelled') {
      setPaymentBanner(paymentStatus);
      // Clean up URL so banner doesn't re-show on refresh
      params.delete('payment');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // On success, poll verify-payment to sync Clerk tier
      if (paymentStatus === 'success' && user?.id) {
        trackEvent('payment_success', { userId: user.id });
        const apiUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${apiUrl}/api/verify-payment?userId=${user.id}`)
          .then(r => r.json())
          .then(data => {
            if (data.activated) user.reload?.();
          })
          .catch(() => {/* non-critical */});
      }
      // Auto-dismiss banner after 8 seconds
      const t = setTimeout(() => setPaymentBanner(null), 8000);
      return () => clearTimeout(t);
    }
  }, [user]);


  // Identify signed-in user in PostHog
  useEffect(() => {
    if (isSignedIn && user?.id) {
      identifyUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        tier: user.publicMetadata?.tier || 'free',
      });
    }
  }, [isSignedIn, user?.id]);

  // Cleanup: abort satellite fetches on unmount
  useEffect(() => {
    return () => {
      if (satelliteAbortRef.current) {
        satelliteAbortRef.current.abort();
      }
    };
  }, []);

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

  // Auto-open upgrade modal when arriving via ?upgrade=pro (from ForRealEstate / landing CTA)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'pro') {
      if (isSignedIn) {
        setShowProUpgradeModal(true);
      } else {
        setShowSignInModal(true);
      }
      // Clean URL
      params.delete('upgrade');
      const clean = params.toString();
      window.history.replaceState({}, '', clean ? `?${clean}` : window.location.pathname);
    }
  }, [isSignedIn]);

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
    setAnalysisQuote(URBANIST_QUOTES[Math.floor(Math.random() * URBANIST_QUOTES.length)]);
    setMetrics(null);
    setSatelliteLoaded(new Set());
    setStreetDesignScore(undefined);
    setCompositeScore(null);
    setStreetCharacter(null);
    setStreetCharacterLoading(false);
    setDemographicData(null);
    setMapillaryCoverageGap(false);
    setDemographicLoading(false);
    setNeighborhoodIntel(null);

    // Cancel any in-flight satellite fetches from previous location
    if (satelliteAbortRef.current) {
      satelliteAbortRef.current.abort();
    }
    const abortController = new AbortController();
    satelliteAbortRef.current = abortController;

    // Fire OSM, satellite, and street design requests simultaneously
    const osmPromise = fetchOSMData(selectedLocation.lat, selectedLocation.lon);
    const satellitePromises = startSatelliteFetches(selectedLocation);

    try {
      // Wait for OSM data first (needed for core metrics)
      const fetchedOsmData = await osmPromise;
      const calculatedMetrics = calculateMetrics(
        fetchedOsmData,
        selectedLocation.lat,
        selectedLocation.lon,
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
      const initialComposite = calculateCompositeScore({
        legacy: calculatedMetrics,
        networkGraph: fetchedOsmData.networkGraph,
      });
      setCompositeScore(initialComposite);

      // Fetch AI street character assessment (non-blocking)
      if (initialComposite.components.networkDesign.metrics.length > 0 && initialComposite.components.networkDesign.score > 0) {
        setStreetCharacter(null);
        setStreetCharacterLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${apiUrl}/api/street-character`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metrics: initialComposite.components.networkDesign.metrics,
            locationName: selectedLocation.displayName,
          }),
          signal: abortController.signal,
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.success) setStreetCharacter(data.data); })
          .catch(() => {})
          .finally(() => setStreetCharacterLoading(false));
      }

      // Update URL with current location (shareable link)
      const url = new URL(window.location.href);
      url.searchParams.set('lat', selectedLocation.lat.toString());
      url.searchParams.set('lon', selectedLocation.lon.toString());
      url.searchParams.set('name', encodeURIComponent(selectedLocation.displayName));
      window.history.pushState({}, '', url);

      // Progressively update metrics as satellite data arrives
      // (requests were already fired above, now just await results)
      progressivelyUpdateMetrics(selectedLocation, fetchedOsmData, satellitePromises, abortController);

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
      DEMO_DEMOGRAPHIC_DATA, DEMO_OSM_DATA, DEMO_SATELLITE_SOURCES,
    } = await import('./data/demoData');

    setLocation(DEMO_LOCATION);
    setMetrics(DEMO_METRICS);
    setCompositeScore(DEMO_COMPOSITE_SCORE);
    setDataQuality(DEMO_DATA_QUALITY);
    setStreetDesignScore(65);
    setDemographicData(DEMO_DEMOGRAPHIC_DATA);
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
    setStreetDesignScore(undefined);
    setDemographicData(null);
    setDemographicLoading(false);
    setNeighborhoodIntel(null);
    setOsmData(null);
    setSatelliteLoaded(new Set());

    // Clean URL
    window.history.pushState({}, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Start all satellite fetches immediately (called before OSM completes)
  const startSatelliteFetches = (selectedLocation: Location) => ({
    ndvi: fetchNDVI(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    groundTruth: fetch(
      `/api/ground-truth-greenery?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&name=${encodeURIComponent(selectedLocation.displayName || '')}`
    ).then(r => r.json()).then(d => d.success ? d.data : null).catch(() => null),
    surfaceTemp: fetchSurfaceTemperature(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    airQuality: fetchAirQuality(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    heatIsland: fetchHeatIsland(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    populationDensity: fetchPopulationDensity(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    streetDesign: fetchStreetDesign(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    demographics: fetchDemographicData(selectedLocation.lat, selectedLocation.lon, selectedLocation.countryCode)
      .catch(() => null),
    floodRisk: fetchFloodRisk(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    terrain: fetchTerrain(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    transitAccess: fetchTransitAccess(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
    streetFeatures: fetchStreetFeatures(selectedLocation.lat, selectedLocation.lon)
      .catch(() => null),
  });

  // Progressively update metrics as each satellite result arrives
  const progressivelyUpdateMetrics = (
    selectedLocation: Location,
    currentOsmData: OSMData,
    promises: ReturnType<typeof startSatelliteFetches>,
    abortController: AbortController,
  ) => {
    const scores: {
      ndvi?: number;
      surfaceTemp?: number;
      heatIsland?: number;
    } = {};
    const extra: {
      populationDensity?: number;
      streetDesign?: number;
      transitAccess?: number;
      terrain?: number;
      streetLighting?: number;
      airQuality?: number;
    } = {};
    const recalc = () => {
      if (abortController.signal.aborted) return;
      const updatedMetrics = calculateMetrics(
        currentOsmData,
        selectedLocation.lat,
        selectedLocation.lon,
        scores.ndvi,
      );
      setMetrics(updatedMetrics);

      // Recompute composite score with latest data
      const composite = calculateCompositeScore({
        legacy: updatedMetrics,
        networkGraph: currentOsmData.networkGraph,
        populationDensityScore: extra.populationDensity,
        streetDesignScore: extra.streetDesign,
        transitAccessScore: extra.transitAccess,
        terrainScore: extra.terrain,
        streetLightingScore: extra.streetLighting,
        airQualityScore: extra.airQuality,
      });
      setCompositeScore(composite);
    };

    const markLoaded = (key: string) => {
      if (abortController.signal.aborted) return;
      setSatelliteLoaded(prev => new Set(prev).add(key));
    };

    // For non-US locations, mark US-only sources as loaded immediately
    if (selectedLocation.countryCode !== 'us') {
      markLoaded('populationDensity');
      markLoaded('streetDesign');
    }

    promises.ndvi.then(ndvi => {
      if (ndvi !== null) {
        scores.ndvi = scoreTreeCanopy(ndvi);
      }
      // Claude primary, NDVI as fallback for low-confidence areas
      promises.groundTruth.then(gt => {
        if (gt?.score != null && (gt.confidence === 'high' || gt.confidence === 'medium')) {
          scores.ndvi = gt.score;
        }
        markLoaded('treeCanopy');
        recalc();
      });
    });
    promises.surfaceTemp.then(result => {
      if (result) {
        scores.surfaceTemp = result.score;
      }
      recalc();
    });
    promises.airQuality.then(result => {
      if (result) {
        extra.airQuality = result.score * 10; // 0-10 → 0-100
      }
      markLoaded('airQuality');
      recalc();
    });
    promises.heatIsland.then(result => {
      if (result) {
        scores.heatIsland = result.score;
      }
      recalc();
    });
    promises.populationDensity.then(result => {
      if (result) {
        extra.populationDensity = result.score;
        markLoaded('populationDensity');
      }
      recalc();
    });
    promises.streetDesign.then(result => {
      if (result) {
        extra.streetDesign = result.score;
        setStreetDesignScore(result.score);
        markLoaded('streetDesign');
      }
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

    // Compute park, food access from existing OSM data (immediate, no API call)
    const parks = computeParkAccess(currentOsmData, selectedLocation.lat, selectedLocation.lon);
    const food = computeFoodAccess(currentOsmData, selectedLocation.lat, selectedLocation.lon);
    setNeighborhoodIntel(prev => ({
      commute: prev?.commute ?? null,
      transit: null,
      parks,
      food,
      health: prev?.health ?? null,
      flood: prev?.flood ?? null,
    }));

    // Transit Access metric: Transitland GTFS only
    promises.transitAccess.then(result => {
      if (abortController.signal.aborted) return;
      if (result) {
        extra.transitAccess = result.score * 10; // 0-10 → 0-100
        setNeighborhoodIntel(prev => prev ? { ...prev, transit: { busStops: result.busStops, railStops: result.railStops, ferryStops: result.ferryStops, totalStops: result.totalStops, score: result.score } } : prev);
      }
      markLoaded('transit');
      recalc();
    });

    // Terrain (async, from OpenTopoData)
    promises.terrain.then(result => {
      if (abortController.signal.aborted) return;
      if (result) {
        extra.terrain = result.score * 10; // 0-10 → 0-100
        markLoaded('terrain');
      }
      recalc();
    });

    // Street features (Mapillary CV) — street lights, crosswalk markings, speed signs
    promises.streetFeatures.then(result => {
      if (abortController.signal.aborted) return;
      if (!result || result.coverageInsufficient) {
        // Mapillary has no coverage — fall back to OSM lit tags if available
        const osmLit = currentOsmData.networkGraph?.osmLitScore;
        if (osmLit != null) {
          extra.streetLighting = osmLit * 10; // 0-10 → 0-100
          setMapillaryCoverageGap(false); // have fallback data, no gap
        } else {
          setMapillaryCoverageGap(true);
        }
      } else if (result.streetLighting) {
        extra.streetLighting = result.streetLighting.score * 10; // 0-10 → 0-100
        setMapillaryCoverageGap(false);
      }
      markLoaded('streetLighting');
      recalc();
    });

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
      neighborhoodIntel,
      agentProfile: profile,
    };
    sessionStorage.setItem('agentReportData', JSON.stringify(reportData));
    window.open('/report/agent', '_blank');
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #f2f0eb 30%, #eef5f0 60%, #f0ede8 100%)' }}>
      {/* Payment status banner */}
      {paymentBanner && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all
          ${paymentBanner === 'success' ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}>
          {paymentBanner === 'success' ? (
            <>✓ Payment successful — Pro access activated!</>
          ) : (
            <>Payment cancelled — no charge was made.</>
          )}
          <button onClick={() => setPaymentBanner(null)} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

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
            <img src="/logo.svg" alt="SafeStreets logo" className="w-10 h-10" />
            <span className="text-xl font-bold tracking-tight font-sans text-earth-text-dark">SafeStreets</span>
          </button>
          <div className="flex items-center gap-4">
            {!isSignedIn && (
              <button onClick={() => setShowSignInModal(true)} className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body cursor-pointer bg-transparent border-none">Sign In</button>
            )}
            <a href="#faq" onClick={(e) => { if (location || compareMode || demoMode) { e.preventDefault(); setCompareMode(false); setLocation(null); setMetrics(null); setDemoMode(false); setShowTour(false); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); }}} className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">FAQ</a>
            <a href="/blog" className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">Blog</a>
            <a href="/learn" className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">Learn</a>
            <a href="/platform" className="text-sm font-medium transition-colors hidden sm:block text-earth-text-body">Platform</a>
            <div className="flex items-center gap-1.5">
              {isSignedIn && userIsPremium && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: '#e07850' }}>Pro</span>
              )}
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-9 h-9 rounded-full border-2 border-gray-300 shadow-sm',
                    userButtonPopoverCard: 'shadow-xl',
                  },
                }}
              />
            </div>
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
            <a href="/platform" className="block text-sm font-medium py-2 text-earth-text-body" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            {!isSignedIn && (
              <button onClick={() => { setShowSignInModal(true); setMobileMenuOpen(false); }} className="block text-sm font-medium py-2 text-earth-text-body cursor-pointer bg-transparent border-none w-full text-left">Sign In</button>
            )}
          </div>
        )}
      </header>

      {/* Hero Section - Side-by-side with topographic texture */}
      {!compareMode && !location && !isAnalyzing && (
        <section className="relative flex flex-col font-sans" style={{ background: 'linear-gradient(160deg, #fdf6f0 0%, #f8f0e8 25%, #f0ece4 55%, #eaf0e8 100%)' }}>
          {/* Topographic contour background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.06 }}>
            <defs>
              <pattern id="topoPattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                <path d="M 100 10 Q 140 30, 180 25 Q 195 60, 170 90 Q 150 120, 100 110 Q 50 100, 30 70 Q 15 40, 50 20 Q 70 10, 100 10 Z" fill="none" stroke="#c06030" strokeWidth="1"/>
                <path d="M 100 30 Q 130 45, 160 40 Q 175 65, 155 85 Q 140 100, 100 95 Q 65 88, 50 65 Q 38 48, 60 35 Q 75 28, 100 30 Z" fill="none" stroke="#c06030" strokeWidth="0.8"/>
                <path d="M 100 50 Q 120 58, 140 55 Q 150 70, 135 80 Q 125 88, 100 85 Q 78 80, 70 65 Q 64 55, 78 50 Q 88 46, 100 50 Z" fill="none" stroke="#c06030" strokeWidth="0.6"/>
                <path d="M 100 65 Q 112 68, 120 66 Q 125 73, 118 78 Q 112 82, 100 80 Q 90 78, 85 72 Q 82 67, 90 65 Q 95 63, 100 65 Z" fill="none" stroke="#c06030" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topoPattern)"/>
          </svg>

          {/* Two-column hero layout */}
          <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pt-10 lg:pt-16 pb-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left column - Text & Search */}
              <div className="flex flex-col items-center lg:items-start">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center lg:text-left mb-4 tracking-tight text-earth-text-dark max-w-xl">
                  How Walkable Is Your Street,{' '}
                  <span className="text-terra">Really</span>?
                </h1>

                <p className="text-base sm:text-lg md:text-xl text-center lg:text-left max-w-xl mb-6 text-earth-text-body">
                  Walkability scores, street design analysis, and neighborhood health for any address.
                  <span className="text-earth-text-light"> Free, no sign-up.</span>
                </p>

                {/* Search Box */}
                <div className="w-full max-w-xl mb-4">
                  <div className="search-box-light bg-white rounded-2xl">
                    <AddressInput
                      onSelect={handleLocationSelect}
                      placeholder="Enter any address worldwide..."
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
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
                      className="text-sm font-medium text-terra hover:text-terra/80 transition-colors"
                      aria-label="Use my current location"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Use my location
                      </span>
                    </button>
                    <span className="text-earth-text-light text-sm">·</span>
                    <button
                      onClick={activateDemoMode}
                      className="text-sm font-medium text-terra hover:text-terra/80 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Watch Demo
                      </span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Right column — Live example card */}
              <div className="flex justify-center">
                <div className="w-full max-w-md">
                  <div className="bg-white rounded-2xl shadow-xl border border-earth-border p-5 relative overflow-hidden">

                    {/* Warm top accent strip */}
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #e07850 0%, #f59e0b 100%)' }} />

                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 mt-1">
                      <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e07850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span className="text-sm font-bold" style={{ color: '#2a3a2a' }}>Brooklyn, NY</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#fef3ec', color: '#c05c30' }}>Example</span>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-2xl font-bold" style={{ color: '#22c55e' }}>7.4</span>
                          <span className="text-xs" style={{ color: '#8a9a8a' }}>/10</span>
                        </div>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="h-2 rounded-full mb-4" style={{ backgroundColor: '#f0ebe0' }}>
                      <div className="h-full rounded-full" style={{ width: '74%', background: 'linear-gradient(90deg, #84cc16, #22c55e)' }} />
                    </div>

                    {/* Component bars */}
                    <div className="space-y-2 mb-4">
                      {[
                        { label: 'Network Design',         score: 82, color: '#22c55e' },
                        { label: 'Density & Destinations', score: 78, color: '#22c55e' },
                        { label: 'Environmental Comfort',  score: 61, color: '#84cc16' },
                        { label: 'Safety',                 score: 55, color: '#eab308' },
                      ].map(c => (
                        <div key={c.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs" style={{ color: '#4a5a4a' }}>{c.label}</span>
                            <span className="text-xs font-bold tabular-nums" style={{ color: c.color }}>{(c.score / 10).toFixed(1)}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#f0ebe0' }}>
                            <div className="h-full rounded-full" style={{ width: `${c.score}%`, backgroundColor: c.color }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Persona quick row */}
                    <div className="border-t pt-3" style={{ borderColor: '#f0ebe0' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#b0a898' }}>Who it works for</div>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { name: 'Daily Commuter', color: '#22c55e', score: 79 },
                          { name: 'Car-Free Living', color: '#84cc16', score: 71 },
                          { name: 'Remote Workers', color: '#eab308', score: 58 },
                        ].map(p => (
                          <div key={p.name} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor: '#f8f6f1', color: '#4a5a4a' }}>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                            {p.name}
                            <span style={{ color: p.color, fontWeight: 700 }}>{p.score}</span>
                          </div>
                        ))}
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
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-earth-green/[0.08]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#4a8a4a"/>
                </svg>
                <span className="text-sm text-earth-green">
                  Built on <strong>NACTO</strong> & <strong>Vision Zero</strong> standards
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-earth-green/[0.08]">
                <span className="text-sm text-earth-green"><strong>190+</strong> countries</span>
              </div>
            </div>

            {/* Data Sources */}
            <div className="flex flex-wrap justify-center gap-2">
              {['Sentinel-2 Satellite', 'US Census & CDC', 'OpenStreetMap', 'FEMA & EPA'].map((source) => (
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
              className="px-4 sm:px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg text-sm sm:text-base"
              style={{ backgroundColor: '#e07850' }}
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
                          // Fire OSM, satellite, and street design requests simultaneously
                          const osmPromise = fetchOSMData(selectedLocation.lat, selectedLocation.lon);
                          const satellitePromises = startSatelliteFetches(selectedLocation);

                          const fetchedOsmData = await osmPromise;
                          const calculatedMetrics = calculateMetrics(
                            fetchedOsmData,
                            selectedLocation.lat,
                            selectedLocation.lon,
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
                          const extra: { populationDensity?: number; streetDesign?: number } = {};
                          const recalc = () => {
                            const updated = calculateMetrics(
                              fetchedOsmData,
                              selectedLocation.lat,
                              selectedLocation.lon,
                              scores.ndvi,
                            );
                            const composite = calculateCompositeScore({
                              legacy: updated,
                              networkGraph: fetchedOsmData.networkGraph,

                              populationDensityScore: extra.populationDensity,
                              streetDesignScore: extra.streetDesign,
                            });
                            setLocation1(prev => prev ? { ...prev, metrics: updated, compositeScore: composite } : prev);
                          };
                          satellitePromises.ndvi.then(v => {
                            if (v !== null) { scores.ndvi = scoreTreeCanopy(v); }
                            satellitePromises.groundTruth.then(gt => {
                              if (gt?.score != null && (gt.confidence === 'high' || gt.confidence === 'medium')) {
                                scores.ndvi = gt.score;
                              }
                              recalc();
                            });
                          });
                          satellitePromises.surfaceTemp.then(v => { if (v) { scores.surfaceTemp = v.score; recalc(); } });
                          satellitePromises.airQuality.then(v => { if (v) { scores.airQuality = v.score; recalc(); } });
                          satellitePromises.heatIsland.then(v => { if (v) { scores.heatIsland = v.score; recalc(); } });
                          satellitePromises.populationDensity.then(v => { if (v) { extra.populationDensity = v.score; recalc(); } });
                          satellitePromises.streetDesign.then(v => { if (v) { extra.streetDesign = v.score; recalc(); } });
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
                          // Fire OSM, satellite, and street design requests simultaneously
                          const osmPromise = fetchOSMData(selectedLocation.lat, selectedLocation.lon);
                          const satellitePromises = startSatelliteFetches(selectedLocation);

                          const fetchedOsmData = await osmPromise;
                          const calculatedMetrics = calculateMetrics(
                            fetchedOsmData,
                            selectedLocation.lat,
                            selectedLocation.lon,
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
                          const extra: { populationDensity?: number; streetDesign?: number } = {};
                          const recalc = () => {
                            const updated = calculateMetrics(
                              fetchedOsmData,
                              selectedLocation.lat,
                              selectedLocation.lon,
                              scores.ndvi,
                            );
                            const composite = calculateCompositeScore({
                              legacy: updated,
                              networkGraph: fetchedOsmData.networkGraph,

                              populationDensityScore: extra.populationDensity,
                              streetDesignScore: extra.streetDesign,
                            });
                            setLocation2(prev => prev ? { ...prev, metrics: updated, compositeScore: composite } : prev);
                          };
                          satellitePromises.ndvi.then(v => {
                            if (v !== null) { scores.ndvi = scoreTreeCanopy(v); }
                            satellitePromises.groundTruth.then(gt => {
                              if (gt?.score != null && (gt.confidence === 'high' || gt.confidence === 'medium')) {
                                scores.ndvi = gt.score;
                              }
                              recalc();
                            });
                          });
                          satellitePromises.surfaceTemp.then(v => { if (v) { scores.surfaceTemp = v.score; recalc(); } });
                          satellitePromises.airQuality.then(v => { if (v) { scores.airQuality = v.score; recalc(); } });
                          satellitePromises.heatIsland.then(v => { if (v) { scores.heatIsland = v.score; recalc(); } });
                          satellitePromises.populationDensity.then(v => { if (v) { extra.populationDensity = v.score; recalc(); } });
                          satellitePromises.streetDesign.then(v => { if (v) { extra.streetDesign = v.score; recalc(); } });
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
              location2={location2.location}
              metrics2={location2.metrics}
              quality2={location2.quality}
              compositeScore2={location2.compositeScore}
            />
          </Suspense>
          </ErrorBoundary>
        )}

        {/* Single Location Loading */}
        {!compareMode && isAnalyzing && (
          <div className="flex flex-col items-center py-16">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-5" />
            <p className="text-lg font-semibold" style={{ color: '#2a3a2a' }} aria-live="polite">Analyzing walkability...</p>
            <AnalysisProgress />
            {analysisQuote && (
              <div className="mt-10 max-w-sm text-center px-6">
                <p className="text-sm leading-relaxed" style={{ color: '#5a6a5a', fontStyle: 'italic' }}>
                  "{analysisQuote.text}"
                </p>
                <p className="text-xs mt-2 font-semibold tracking-wide" style={{ color: '#8a9a8a' }}>
                  — {analysisQuote.author}
                </p>
              </div>
            )}
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
            {/* Location name — show first 2 comma-separated segments to avoid wrapping */}
            <h2 className="text-2xl font-bold text-center text-earth-text-dark">
              {location.displayName.split(',').slice(0, 2).join(',')}
            </h2>

            {/* Unified panel: Map | Score + Walking atmosphere below */}
            <div id="score" className="rounded-2xl overflow-hidden border scroll-mt-16" style={{ borderColor: '#e0dbd0', backgroundColor: '#faf7f2' }}>
              {/* Top row: Map left, ScoreCard right */}
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="overflow-hidden lg:border-r" style={{ minHeight: 280, borderColor: '#e0dbd0' }}>
                  <Map location={location} osmData={osmData} seamless />
                </div>
                <div className="p-5 sm:p-6 lg:p-7">
                  <ScoreCard metrics={metrics} compositeScore={compositeScore} embedded />
                </div>
              </div>
              {/* Street vibe — archetype + sense chips */}
              <div style={{ borderTop: '1px solid #e0dbd0' }}>
                <StreetVibe compositeScore={compositeScore} />
              </div>
            </div>

            {/* Persona quick-answers — always rendered, skeleton until compositeScore loads */}
            <PersonaCards compositeScore={compositeScore} />

            {/* 15-Minute City Score — surfaced early for immediate impact */}
            <div id="neighborhood" className="scroll-mt-16">
              <ErrorBoundary sectionName="15-Minute City">
                <Suspense fallback={null}>
                  <FifteenMinuteCity location={location} osmElements={osmData?.rawElements} />
                </Suspense>
              </ErrorBoundary>
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
                <span className="hidden sm:inline">OSM · Sentinel-2 · {location.countryCode === 'US' ? 'Census ACS · EPA' : 'OpenStreetMap'}</span>
              </div>
            )}

            {/* First-time onboarding tip */}
            {showOnboarding && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-gray-600">
                <span>Scores are 0 to 10 (10 = best). Green = strengths, red = needs attention. Scroll down for more.</span>
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

            {/* Metrics Grid — fully free including detail expansion */}
            <div id="metrics" className="scroll-mt-16">
              <MetricGrid metrics={metrics} locationName={location.displayName} satelliteLoaded={satelliteLoaded} compositeScore={compositeScore} demographicData={demographicData} demographicLoading={demographicLoading} osmData={osmData} streetDesignScore={streetDesignScore} neighborhoodIntel={neighborhoodIntel} countryCode={location.countryCode} mapillaryCoverageGap={mapillaryCoverageGap} />
            </div>

            {/* Street Network Analysis — free for all */}
            {compositeScore?.components.networkDesign && (
              <StreetNetworkPanel
                networkDesign={compositeScore.components.networkDesign}
                streetCharacter={streetCharacter}
                streetCharacterLoading={streetCharacterLoading}
              />
            )}

            {/* Street Audit CTA — direct action after seeing all the data */}
            <div
              className="rounded-2xl border p-5 flex items-center justify-between gap-4"
              style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#2a3a2a' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                    <path d="M9 12h6M9 16h4"/>
                  </svg>
                  Want to take action on this analysis?
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#8a9a8a' }}>
                  Generate a structured report to share with landlords, property managers, or local authorities
                </div>
              </div>
              <button
                onClick={() => setShowAuditTool(true)}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition hover:opacity-80"
                style={{ borderColor: '#e0dbd0', color: '#2a3a2a', backgroundColor: 'white' }}
              >
                Generate report →
              </button>
            </div>

            {/* Street Audit Tool modal */}
            {showAuditTool && (
              <ErrorBoundary sectionName="Street Audit Tool">
                <Suspense fallback={null}>
                  <StreetAuditTool
                    address={location.displayName}
                    metrics={metrics}
                    compositeScore={compositeScore}
                    onClose={() => setShowAuditTool(false)}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {/* Share + Export */}
            <div id="report-actions">
              <ErrorBoundary sectionName="Share Buttons">
                <Suspense fallback={null}>
                  <ShareButtons
                    location={location}
                    metrics={metrics}
                    compositeScore={compositeScore}
                    dataQuality={dataQuality || undefined}
                    isPremium={effectivePremium}
                    onShareReport={() => setShowReportCard(true)}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>




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
                      <strong className="block mb-1">Walkability Metrics</strong>
                      <p className="text-[#4a5a4a]">US locations get 4 metrics: tree canopy, street design, destinations, and commute mode from Sentinel-2 satellite imagery, EPA National Walkability Index, OpenStreetMap, and Census ACS. International locations get 3 metrics with OSM street grid analysis replacing US-only data sources.</p>
                    </div>
                    <div>
                      <strong className="block mb-1">Global Standards</strong>
                      <p className="text-[#4a5a4a]">Each metric is compared against international standards from WHO, UN-Habitat, ADA, and leading urban planning organizations.</p>
                    </div>
                    <div>
                      <strong className="block mb-1">Free & Open Data</strong>
                      <p className="text-[#4a5a4a]">All data comes from publicly available sources: OpenStreetMap, Sentinel-2 satellite imagery, EPA National Walkability Index, US Census ACS, CDC PLACES, and FEMA NFHL.</p>
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

                <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl shadow-2xl border" style={{ borderColor: '#e0dbd0' }}>
                  <video
                    src="/demo.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full block"
                    style={{ aspectRatio: '1280/772', backgroundColor: '#f5f2ec' }}
                  />
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
                  Satellite imagery and open government data — completely free, no sign-up required.
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
                        { icon: '🌳', name: 'Tree Canopy', desc: 'Shade and vegetation coverage', source: 'Sentinel-2' },
                        { icon: '🛣️', name: 'Street Design', desc: 'Intersection density, transit proximity, land use mix', source: 'EPA (US)' },
                        { icon: '🏪', name: 'Destinations', desc: 'Daily needs within walking distance', source: 'OpenStreetMap' },
                        { icon: '🚶', name: 'Commute Mode', desc: 'Walk, bike, and transit commute share', source: 'Census ACS (US)' },
                        { icon: '🔀', name: 'Street Grid', desc: 'Street connectivity and route options (international)', source: 'OpenStreetMap' },
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

            {/* Pricing / Pro Section */}
            <section className="py-16 bg-white/50">
              <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-10">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: '#2a3a2a' }}>Simple, Honest Pricing</h2>
                  <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: '#6b7a6b' }}>
                    The core analysis is free forever. Pro unlocks comparison, reports, and branding — one payment, no subscription.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Free tier */}
                  <div className="rounded-2xl border p-6 flex flex-col" style={{ backgroundColor: '#faf8f4', borderColor: '#e0dbd0' }}>
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ backgroundColor: 'rgba(74,138,74,0.1)', color: '#4a8a4a' }}>Free</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold" style={{ color: '#2a3a2a' }}>$0</span>
                        <span className="text-sm" style={{ color: '#8a9a8a' }}>forever</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#8a9a8a' }}>No sign-up required</p>
                    </div>
                    <ul className="space-y-2.5 flex-1">
                      {[
                        'Walkability score for any address worldwide',
                        'Street metrics — canopy, design, destinations',
                        'Interactive map with OSM data',
                        'Neighborhood intelligence (health, flood, transit)',
                        'Persona analysis for 5 buyer types',
                        'Walking atmosphere visualization',
                      ].map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#4a5a4a' }}>
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="#4a8a4a" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => document.querySelector<HTMLInputElement>('input[type="text"]')?.focus()}
                      className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-[#f0ebe0]"
                      style={{ borderColor: '#c8c0b0', color: '#4a5a4a' }}
                    >
                      Get started free
                    </button>
                  </div>

                  {/* Pro tier */}
                  <div className="rounded-2xl border-2 p-6 flex flex-col relative" style={{ backgroundColor: '#ffffff', borderColor: '#e07850' }}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: '#e07850' }}>Most Popular</span>
                    </div>
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ backgroundColor: 'rgba(224,120,80,0.1)', color: '#e07850' }}>Pro</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold" style={{ color: '#2a3a2a' }}>$49</span>
                        <span className="text-sm" style={{ color: '#8a9a8a' }}>one-time</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#8a9a8a' }}>Lifetime access, no renewal</p>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#8a9a8a' }}>Everything in Free, plus:</p>
                    <ul className="space-y-2.5 flex-1">
                      {[
                        { text: 'Compare up to 4 addresses side-by-side', bold: true },
                        { text: 'Shareable walkability reports (PDF + link)', bold: true },
                        { text: 'Your logo & branding on every report', bold: true },
                        { text: '3 free branded reports to try before you pay', bold: false },
                        { text: 'Perfect for real estate agents & urban planners', bold: false },
                      ].map(f => (
                        <li key={f.text} className="flex items-start gap-2.5 text-sm" style={{ color: '#4a5a4a' }}>
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="#e07850" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span style={{ fontWeight: f.bold ? 600 : 400 }}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => isSignedIn ? setShowProUpgradeModal(true) : setShowSignInModal(true)}
                      className="mt-6 w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-md"
                      style={{ backgroundColor: '#e07850' }}
                    >
                      Get Pro — $49 One-Time
                    </button>
                    <div className="mt-3 flex items-center justify-center gap-1 text-xs" style={{ color: '#8a9a8a' }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Secure checkout via Stripe
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Branded Reports CTA */}
            <section className="py-12 bg-white/30">
              <div className="max-w-5xl mx-auto px-6">
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#2a3a2a' }}>
                  <div className="p-8 sm:p-10 lg:p-12">
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                      {/* Content */}
                      <div className="flex-1 text-center lg:text-left">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ backgroundColor: 'rgba(224,120,80,0.15)', color: '#e8a070' }}>
                          Branded Reports
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                          Branded Walkability Reports for Any Address
                        </h3>
                        <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          Generate branded walkability reports for any listing. Your logo, brand colors, and contact details on every page — with data your clients can't find anywhere else.
                        </p>
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                          <a
                            href="/?agent=true"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-lg hover:brightness-110"
                            style={{ backgroundColor: '#e07850', color: '#ffffff' }}
                          >
                            Try 3 Free Reports
                          </a>
                          <button
                            onClick={() => isSignedIn ? setShowProUpgradeModal(true) : setShowSignInModal(true)}
                            className="inline-flex items-center gap-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white/10 cursor-pointer"
                            style={{ border: '1.5px solid rgba(224,120,80,0.4)', color: '#e8a070', background: 'transparent' }}
                          >
                            $49 One-Time / Unlimited
                          </button>
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
                                { name: 'Design', w: 82 },
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
                      {['Compare 2-4 neighborhoods side-by-side', 'Shareable links', 'Your logo & brand colors', 'Walkability value premium estimates'].map(f => (
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
                    Yes! All data layers, compare mode, field verification, and neighborhood intelligence are completely free with no sign-up required. We use open government data (Sentinel-2, US Census, CDC, EPA, FEMA, OpenStreetMap). Unlimited searches, works globally in 190+ countries.
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
                    Your score (out of 10) is a weighted average of walkability metrics. For US locations: <strong>tree canopy</strong> (shade and vegetation from satellite imagery), <strong>street design</strong> (intersection density and transit proximity from EPA Walkability Index), <strong>destinations</strong> (daily needs within walking distance), and <strong>commute mode</strong> (walk, bike, and transit commute share from Census ACS). International locations use <strong>street grid</strong> (OSM network connectivity) instead of EPA and Census metrics. Each metric is scored independently so you can see exactly what's strong or weak about your area.
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
                    What makes SafeStreets different from other tools?
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
                    Most tools give you a single number with no breakdown. SafeStreets analyzes the actual experience of walking in a neighborhood: shade, street design quality, transit access, food deserts, health outcomes, and flood risk. We use real satellite imagery and government data — not just distance calculations. And it's completely free, no sign-up.
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
                    Beyond walkability scores, Neighborhood Intelligence shows how people actually live in an area: <strong>transit access</strong> (bus stops and rail stations nearby), <strong>park and food access</strong> (including food desert detection). For US locations, you also get <strong>commute patterns</strong> (walk, bike, transit, car split from Census ACS), <strong>health outcomes</strong> (obesity, diabetes, asthma, physical inactivity rates vs. US averages from CDC PLACES), and <strong>flood risk</strong> (FEMA flood zone classification). All data updates automatically from federal and open sources.
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
                    We use research-grade open data: <strong>Sentinel-2</strong> satellite imagery (tree canopy), <strong>OpenStreetMap</strong> (street infrastructure, transit stops, amenities), <strong>EPA National Walkability Index</strong> (street design quality), <strong>US Census ACS</strong> (commute patterns, demographics), <strong>CDC PLACES</strong> (health outcomes by census tract), <strong>FEMA NFHL</strong> (flood risk zones), and <strong>WHO</strong> (international health data). These are the same sources used by governments and research institutions.
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
                    Our data sources update on different schedules: <strong>satellite imagery</strong> refreshes every few months, <strong>OpenStreetMap</strong> updates continuously from community contributors, <strong>US Census ACS</strong> releases annually, <strong>EPA Walkability Index</strong> updates periodically, <strong>CDC PLACES</strong> updates yearly, and <strong>FEMA flood maps</strong> update as new studies are completed. We always use the most recent available data from each source.
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
                    Yes. We don't link addresses to your identity and no account is required, so there's no personal profile tied to your queries. We collect anonymous usage analytics (address searches, not personal data) to improve the tool. We don't sell data to third parties.
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
                  <p className="mb-3">
                    Yes! The core walkability analysis (5 metric scores, overall score, compare mode) works globally in 190+ countries using satellite data and OpenStreetMap.
                  </p>
                  <p className="mb-3">
                    <strong>US locations get extra data layers</strong> powered by federal sources: <strong>commute patterns</strong> (walk/bike/transit/car split from Census ACS), <strong>tract-level demographics</strong> (income, poverty rate, education from Census ACS), <strong>street design quality</strong> (intersection density and transit proximity from EPA Walkability Index), <strong>community health</strong> (obesity, diabetes, asthma, physical inactivity rates from CDC PLACES), and <strong>flood risk</strong> (FEMA flood zone classification).
                  </p>
                  <p>
                    <strong>International locations</strong> get 3 core walkability metrics (Street Grid, Tree Canopy, Destinations), transit stops, parks, food access, and equity context, plus country-level data from the World Bank (GDP, unemployment) and WHO (health data).
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
                    Yes! Use the agent link above to generate branded walkability reports for any listing. Enter the address, complete your agent profile once, and export a print-ready PDF with your name, title, and contact details. The first 3 reports are free — unlimited reports with Pro ($49 one-time). Research consistently shows walkable neighborhoods command a significant home value premium — give your buyers the data they need to decide.
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


      {/* Footer - Earthy light aesthetic */}
      <footer className="mt-0 relative overflow-hidden bg-earth-forest text-earth-text-light">
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8">
            {/* About Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.svg" alt="SafeStreets logo" style={{ width: 32, height: 32 }} />
                <h3 className="text-xl font-bold text-terra">SafeStreets</h3>
              </div>
              <p className="text-sm mb-4 leading-relaxed text-earth-text-light">
                Neighborhood intelligence powered by satellite and government data. Walkability, street design, transit, health, and daily amenities for any address.
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
                  <a href="/platform" className="transition hover:text-white text-earth-text-light">Platform</a>
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
                  4 walkability metrics (US), 3 international
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
                  WHO walkability guidelines
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
                  <a href="https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    Sentinel-2 Satellite
                  </a>
                </li>
                <li>
                  <a href="https://www.epa.gov/smartgrowth/national-walkability-index" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    EPA Walkability Index
                  </a>
                </li>
                <li>
                  <a href="https://data.census.gov" className="transition flex items-center gap-2 text-earth-text-light" target="_blank" rel="noopener noreferrer">
                    <span className="w-1 h-1 rounded-full bg-earth-text-body"></span>
                    US Census ACS
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
                <a href="/platform" className="transition hover:text-white text-earth-text-muted">Platform</a>
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
