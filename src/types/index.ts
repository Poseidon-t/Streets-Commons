export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
}

export interface WalkabilityMetrics {
  // OSM-verifiable metrics only
  crossingDensity: number;
  sidewalkCoverage: number;
  networkEfficiency: number;
  destinationAccess: number;
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
}

export interface Demographics {
  totalPopulation: number;
  children: number;
  elderly: number;
  dailyVisitors: number;
}

export interface EconomicProjections {
  retailUplift: number;
  propertyValue: number;
  healthSavings: number;
  jobsCreated: number;
  roi: number;
  currency: string;
}

export interface Analysis {
  id: string;
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality: DataQuality;
  demographics: Demographics;
  economicProjections: EconomicProjections;
  timestamp: Date;
}
