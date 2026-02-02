export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
}

export interface WalkabilityMetrics {
  // OSM metrics (crowdsourced but well-mapped)
  crossingDensity: number; // OSM highway=crossing nodes
  networkEfficiency: number; // OSM street grid geometry
  destinationAccess: number; // OSM amenity/shop/leisure POIs
  // Satellite/elevation data metrics
  slope: number; // From NASADEM elevation data
  treeCanopy: number; // From Sentinel-2 NDVI data
  surfaceTemp: number; // From NASA POWER temperature data
  airQuality: number; // From OpenAQ monitoring stations
  heatIsland: number; // From Sentinel-2 SWIR heat island analysis
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

export interface Analysis {
  id: string;
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality: DataQuality;
  timestamp: Date;
}
