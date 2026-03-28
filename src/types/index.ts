export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. "us", "fr")
}

export interface WalkabilityMetrics {
  destinationAccess: number; // OSM amenity/shop/leisure POIs (density + proximity)
  treeCanopy: number; // From Sentinel-2 NDVI data
  streetGrid?: number; // OSM network topology (intersections, block length, dead-ends)
  streetDesign?: number; // EPA National Walkability Index (street connectivity, transit, land use)
  commuteMode?: number; // Census ACS walk/bike/transit commute share
  transitAccess?: number; // Transit stops within 800m (Transitland / OSM)
  terrain?: number;       // Terrain flatness from elevation variance (OpenTopoData SRTM)
  speedEnvironment?: number; // Vehicle speed environment (OSM maxspeed + highway type inference)
  overallScore: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
}

export interface DataQuality {
  crossingCount: number;
  streetCount: number;
  sidewalkCount: number;
  poiCount: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface OSMData {
  crossings: any[];
  sidewalks: any[];
  streets: any[];
  pois: any[];
  nodes: Map<string, { lat: number; lon: number }>;
  networkGraph?: NetworkGraph;
  rawElements?: any[];
}

// --- Network Graph (computed from OSM way topology) ---

export interface IntersectionNode {
  id: string;
  lat: number;
  lon: number;
  degree: number; // number of ways meeting at this node
}

export interface NetworkGraph {
  intersections: IntersectionNode[];
  deadEnds: IntersectionNode[];
  totalStreetLengthKm: number;
  areaKm2: number;
  averageBlockLengthM: number;
  speedEnvironment?: {
    score: number;       // 0-10
    avgSpeedKmh: number; // length-weighted average speed
    lowSpeedPct: number; // % of network ≤30 km/h
  };
  noiseEnvironment?: {
    score: number;       // 0-10 (10 = quietest)
    avgNoiseDb: number;  // length-weighted avg estimated dB
  };
  osmLitScore?: number | null;  // 0-10 from OSM lit tags; null = insufficient tagging coverage
  betweennessCentrality?: {
    mean: number;   // mean normalized betweenness (0-1), lower = more evenly connected
    max: number;    // max normalized betweenness (0-1), high = dominant chokepoint exists
    gini: number;   // Gini coefficient of distribution (0-1), lower = more uniform connectivity
  };
}

// --- 4-Component Scoring System (0-100 + A-F) ---

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SubMetric {
  name: string;
  score: number;       // 0-100
  rawValue?: string;   // human-readable raw value
  weight: number;      // 0-1 within the component
}

export interface ComponentScore {
  label: string;       // e.g. "Network Design"
  score: number;       // 0-100
  weight: number;      // 0-1 (how much it counts toward overall)
  metrics: SubMetric[];
}

export interface WalkabilityScoreV2 {
  overallScore: number;    // 0-100
  grade: LetterGrade;
  components: {
    networkDesign: ComponentScore;
    environmentalComfort: ComponentScore;
    safety: ComponentScore;
    densityContext: ComponentScore;
  };
  confidence: number;      // 0-100 confidence
  legacy: WalkabilityMetrics; // backward compat
}

export interface StreetAttributes {
  name: string;
  nameEn?: string;
  highway: 'primary' | 'secondary' | 'tertiary' | 'residential' | 'living_street';
  lanes?: number;
  width?: number;
  cycleway?: string;
  cyclewayLeft?: string;
  cyclewayRight?: string;
  surface?: string;
  maxspeed?: number;
  parkingLeft?: string;
  parkingRight?: string;
  sidewalk?: string;
  oneway?: boolean;
  lit?: boolean;
  osmId?: number;
}

// --- Street Character (AI-generated synthesis of network metrics) ---

export type StreetNetworkType =
  | 'Complete Streets'
  | 'Well-Connected Grid'
  | 'Organic Urban'
  | 'Mixed Pattern'
  | 'Car-Centric Grid'
  | 'Suburban Sprawl'
  | 'Disconnected Network';

export interface StreetCharacterAnalysis {
  type: StreetNetworkType;
  assessment: string;  // 2-3 sentences of plain-English analysis
  strength: string;    // single biggest walkability strength
  concern: string;     // single biggest walkability concern
}

// --- Street Design data (EPA National Walkability Index) ---

export interface StreetDesignData {
  score: number;
  category: string;
  d3bRank: number;         // Street intersection density (1-20)
  d4aRank: number;         // Transit proximity (1-20)
  d2bRank: number;         // Land use mix (1-20)
  natWalkInd: number;      // EPA composite walkability (1-20)
  natWalkIndRank: number | null;  // National percentile
  zeroCarPct: number | null;
  totalPop: number | null;
  metroArea: string | null;
  dataSource: string;
}

// --- Raw metric data ---

export interface RawMetricData {
  // Thermal Comfort (consolidated)
  temperature?: number;       // °C (from NASA POWER)
  heatDifference?: number;    // °C (urban vs vegetation)

  // Tree Canopy
  ndvi?: number;              // 0-1 scale

  // OSM metrics
  crossingCount?: number;     // count
  streetLength?: number;      // km
  poiCount?: number;          // count

  // Speed Exposure
  avgSpeedLimit?: number;     // mph
  avgLanes?: number;          // count
  highSpeedStreetPct?: number; // percentage of streets >= 35mph

  // Night Safety
  litStreetPct?: number;      // percentage of lit streets

  // Sidewalk Coverage
  sidewalkPct?: number;       // percentage
}

// --- Demographic / Economic Data ---

/** US Census ACS tract-level data */
export interface USCensusData {
  type: 'us';
  tractFips: string;
  medianHouseholdIncome: number | null;
  medianHomeValue: number | null;
  unemploymentRate: number | null;
  povertyRate: number | null;
  medianAge: number | null;
  bachelorOrHigherPct: number | null;
  dataSource: 'US Census Bureau ACS 5-Year';
  year: number;
}

/** International World Bank country-level data */
export interface InternationalDemographicData {
  type: 'international';
  countryCode: string;
  countryName: string;
  gdpPerCapita: number | null;
  unemploymentRate: number | null;
  urbanPopulationPct: number | null;
  dataSource: 'World Bank Open Data';
  year: number;
}

export type DemographicData = USCensusData | InternationalDemographicData;

// --- Neighborhood Intelligence Data ---

/** Census ACS commute mode data (tract-level) */
export interface CommuteData {
  totalWorkers: number;
  walkPct: number;
  bikePct: number;
  transitPct: number;
  carpoolPct: number;
  wfhPct: number;
  zeroCar: number;        // % of households with 0 vehicles
  totalHouseholds: number;
}

/** CDC PLACES tract-level health outcomes */
export interface CDCHealthData {
  tractFips: string;
  obesity: number | null;
  diabetes: number | null;
  physicalInactivity: number | null;
  mentalHealth: number | null;
  asthma: number | null;
  dataYear: number;
  dataSource: 'CDC PLACES';
}

/** FEMA National Flood Hazard Layer */
export interface FloodRiskData {
  floodZone: string;
  isHighRisk: boolean;
  description: string;
  dataSource: 'FEMA NFHL';
}

/** Transit access from Transitland GTFS */
export interface TransitAccessData {
  busStops: number;
  railStops: number;
  ferryStops: number;
  totalStops: number;
  score: number;
}

/** Park/green space access computed from OSM data */
export interface ParkAccessData {
  parks: number;
  playgrounds: number;
  gardens: number;
  totalGreenSpaces: number;
  nearestParkMeters: number | null;
  score: number;
}

/** Food access computed from OSM data */
export interface FoodAccessData {
  supermarkets: number;
  groceryStores: number;
  convenienceStores: number;
  totalFoodStores: number;
  nearestSupermarketMeters: number | null;
  isFoodDesert: boolean;
  score: number;
}

/** Socioeconomic data from Census ACS */
export interface EconomicsData {
  medianIncome: number | null;
  medianHomeValue: number | null;
  dataSource: string;
}

/** Aggregated neighborhood intelligence */
export interface NeighborhoodIntelligence {
  commute: CommuteData | null;
  transit: TransitAccessData | null;
  parks: ParkAccessData | null;
  food: FoodAccessData | null;
  economics?: EconomicsData | null;
  health: CDCHealthData | null;
  flood: FloodRiskData | null;
}

/** Computed economic impact estimates */
export interface EconomicImpact {
  propertyValuePremium: number | null;
  retailUpliftPercent: number;
  estimatedJobsPotential: number | null;
  healthcareSavingsPerPerson: number;
  walkScore: number;
}

// ── Ground Intelligence ───────────────────────────────────────────────────────

export interface MapillaryPhoto {
  url: string;
  lat: number;
  lon: number;
  capturedAt: string;
}

export interface MapillaryIntelligence {
  coverage: boolean;
  imageCount: number;
  features: {
    crossings: number;
    lighting: number;
    pedestrianSignals: number;
    bikeInfra: number;
    streetFurniture: number;
  };
  infrastructureScore: number; // 0-10
  photos: MapillaryPhoto[];
}

export interface SatelliteVisionAnalysis {
  parkingCoverage: 'low' | 'medium' | 'high';
  streetWidth: 'narrow' | 'medium' | 'wide';
  buildingDensity: 'low' | 'medium' | 'high';
  greenCoverage: 'low' | 'medium' | 'high';
  urbanPattern: 'grid' | 'organic' | 'sprawl' | 'mixed';
  activeStreetFrontage: 'low' | 'medium' | 'high';
  satelliteAssessment: string;
}

export interface GroundRealityNarrative {
  narrative: string;
  keyInsights: [string, string, string];
  dataSources: string[];
  confidence: 'high' | 'medium' | 'low';
}

// ── Premium Features ($29 tier) ──────────────────────────────────────────────

export type RouteSegmentSafety = 'safe' | 'caution' | 'danger';

export interface RouteSegment {
  streetName: string;
  streetType: string; // residential, collector, arterial, etc.
  description: string;
  distanceMi: number;
  walkMinutes: number;
  isCrossing: boolean;
  sidewalkCoverage: string; // "both sides", "one side", "none"
  speedLimit: number | null; // mph
  lanes: number | null;
  signal: string | null; // "stop sign", "signal", "none", etc.
  safety: RouteSegmentSafety;
  badges: { label: string; type: RouteSegmentSafety | 'info' }[];
}

export interface CrossingAlert {
  streetName: string;
  intersection: string;
  speedLimit: number;
  lanes: number;
  signal: string;
  hasCrosswalk: boolean;
  hasMedianRefuge: boolean;
  description: string;
}

export type SchoolRouteVerdict = 'Safe' | 'Walk with Caution' | 'Not Recommended';

export interface SchoolRouteSafetyResult {
  schoolName: string;
  schoolLat: number;
  schoolLon: number;
  totalDistanceMi: number;
  totalWalkMinutes: number;
  totalCrossings: number;
  highSpeedCrossings: number;
  sidewalkCoverage: number; // 0-100%
  segments: RouteSegment[];
  crossingAlerts: CrossingAlert[];
  verdict: SchoolRouteVerdict;
  verdictReason: string;
}

export interface CommuteJourneyLeg {
  mode: 'walk' | 'bus' | 'train' | 'transfer' | 'cycle';
  label: string; // "Walk", "Bus #7", "Blue Line", "Transfer"
  durationMinutes: number;
  detail: string; // "To Bus Stop #42 · 0.4 mi"
  icon: string; // emoji
}

export interface CommuteWalkLegQuality {
  legLabel: string;
  sidewalkCoverage: number; // 0-100%
  maxSpeedMph: number;
  crossings: string;
  lighting: string;
  safety: RouteSegmentSafety;
}

export interface CommuteComparisonMode {
  mode: string;
  icon: string;
  durationMinutes: number;
  isThisRoute?: boolean;
}

export interface CommuteAnalysisResult {
  homeName: string;
  workName: string;
  journeyLegs: CommuteJourneyLeg[];
  totalMinutes: number;
  walkLegs: CommuteWalkLegQuality[];
  comparison: CommuteComparisonMode[];
  annualSavingsVsDriving: number;
  assessment: string;
}

export interface PremiumReportData {
  schoolRoute: SchoolRouteSafetyResult | null;
  commute: CommuteAnalysisResult | null;
  purchasedAt: string;
  addressKey: string; // lat,lon key
}
