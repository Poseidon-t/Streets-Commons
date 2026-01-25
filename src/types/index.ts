export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
}

export interface WalkabilityMetrics {
  crossingGaps: number;
  treeCanopy: number;
  surfaceTemp: number;
  networkEfficiency: number;
  slope: number;
  destinationAccess: number;
  overallScore: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
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

export interface CountryContext {
  name: string;
  gdpPerCapita: number;
  roadDeaths: number;
  urbanization: number;
  currency: string;
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
  demographics: Demographics;
  countryContext: CountryContext;
  economicProjections: EconomicProjections;
  timestamp: Date;
}
