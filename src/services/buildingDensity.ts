/**
 * Building Density 3D Analysis
 * Calculates Floor Area Ratio (FAR) and building density metrics
 * Uses OpenStreetMap building data with robust error handling
 *
 * Key Metrics:
 * - Floor Area Ratio (FAR) = (building footprint × floors) / land area
 * - Buildings per hectare
 * - Average building height
 * - 3D visualization data
 */

import { executeOverpassQuery } from './overpassClient';

export interface BuildingDensityAnalysis {
  far: number; // Floor Area Ratio
  buildingsPerHectare: number;
  averageHeight: number; // meters
  averageFloors: number;
  totalBuildings: number;
  totalBuildingFootprint: number; // m²
  landArea: number; // m² (analysis area)
  densityCategory: string; // Low/Medium/High/Very High
  buildings: BuildingInfo[];
  visualization3D: Building3DData[];
}

interface BuildingInfo {
  id: string;
  lat: number;
  lon: number;
  height?: number; // meters
  floors?: number;
  area: number; // m²
}

interface Building3DData {
  geometry: [number, number][]; // Polygon coordinates
  height: number;
  floors: number;
  color: string; // For visualization
}

/**
 * Calculate Building Density metrics with FAR
 */
export async function analyzeBuildingDensity(
  latitude: number,
  longitude: number,
  radius: number = 800 // meters
): Promise<BuildingDensityAnalysis> {

  const query = `
    [out:json][timeout:30];
    (
      way["building"](around:${radius},${latitude},${longitude});
      relation["building"](around:${radius},${latitude},${longitude});
    );
    out geom;
  `.trim();

  try {
    const data = await executeOverpassQuery(query, {
      maxRetries: 3,
      timeout: 35000,
    });

    const buildings: BuildingInfo[] = [];
    const visualization3D: Building3DData[] = [];

    let totalFootprint = 0;

    for (const element of data.elements as Array<{
      id: number;
      tags?: Record<string, string>;
      geometry?: Array<{ lat: number; lon: number }>;
    }>) {
      // Extract building properties
      const heightTag = element.tags?.['height'];
      const levelsTag = element.tags?.['building:levels'];

      // Parse height (from tag or estimate from levels)
      let height = 10; // default
      if (heightTag) {
        height = parseFloat(heightTag.replace(/[^0-9.]/g, '')) || 10;
      } else if (levelsTag) {
        height = parseFloat(levelsTag) * 3.5;
      }

      // Parse floors
      const floors = levelsTag ? parseInt(levelsTag) : Math.round(height / 3.5);

      // Calculate building footprint area
      const geometry = element.geometry || [];
      if (geometry.length < 3) continue; // Need at least 3 points for polygon

      const area = calculatePolygonArea(geometry.map(pt => [pt.lat, pt.lon]));
      if (area <= 0) continue; // Skip invalid areas

      totalFootprint += area;

      buildings.push({
        id: element.id.toString(),
        lat: geometry[0].lat,
        lon: geometry[0].lon,
        height,
        floors,
        area
      });

      // 3D visualization data
      visualization3D.push({
        geometry: geometry.map(pt => [pt.lat, pt.lon]),
        height,
        floors,
        color: getColorByHeight(height)
      });
    }

    // Calculate land area (circle with given radius)
    const landArea = Math.PI * radius * radius;

    // Calculate total floor area (sum of footprint × floors)
    const totalFloorArea = buildings.reduce((sum, b) => sum + (b.area * (b.floors || 3)), 0);

    // Floor Area Ratio (FAR)
    const far = landArea > 0 ? totalFloorArea / landArea : 0;

    // Buildings per hectare
    const buildingsPerHectare = landArea > 0 ? (buildings.length / landArea) * 10000 : 0;

    // Average metrics
    const averageHeight = buildings.length > 0
      ? buildings.reduce((sum, b) => sum + (b.height || 10), 0) / buildings.length
      : 0;

    const averageFloors = buildings.length > 0
      ? buildings.reduce((sum, b) => sum + (b.floors || 3), 0) / buildings.length
      : 0;

    // Density category
    const densityCategory = categorizeDensity(far);

    return {
      far: parseFloat(far.toFixed(2)),
      buildingsPerHectare: Math.round(buildingsPerHectare),
      averageHeight: parseFloat(averageHeight.toFixed(1)),
      averageFloors: parseFloat(averageFloors.toFixed(1)),
      totalBuildings: buildings.length,
      totalBuildingFootprint: Math.round(totalFootprint),
      landArea: Math.round(landArea),
      densityCategory,
      buildings,
      visualization3D
    };

  } catch (error) {
    console.error('Building density analysis failed:', error);
    // Return default values
    return {
      far: 0,
      buildingsPerHectare: 0,
      averageHeight: 0,
      averageFloors: 0,
      totalBuildings: 0,
      totalBuildingFootprint: 0,
      landArea: Math.round(Math.PI * radius * radius),
      densityCategory: 'Unknown - Analysis Error',
      buildings: [],
      visualization3D: []
    };
  }
}

/**
 * Calculate area of polygon using Shoelace formula
 * Returns area in square meters
 */
function calculatePolygonArea(coordinates: [number, number][]): number {
  if (coordinates.length < 3) return 0;

  let area = 0;
  const n = coordinates.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lat1, lon1] = coordinates[i];
    const [lat2, lon2] = coordinates[j];

    // Convert to meters using approximate conversion at given latitude
    const avgLat = (lat1 + lat2) / 2;
    const x1 = lon1 * 111320 * Math.cos(avgLat * Math.PI / 180);
    const y1 = lat1 * 110540;
    const x2 = lon2 * 111320 * Math.cos(avgLat * Math.PI / 180);
    const y2 = lat2 * 110540;

    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

/**
 * Categorize density based on FAR
 * FAR standards:
 * - Low: < 0.5 (suburban)
 * - Medium: 0.5-1.5 (urban residential)
 * - High: 1.5-3.0 (urban mixed-use)
 * - Very High: > 3.0 (downtown)
 */
function categorizeDensity(far: number): string {
  if (far < 0.5) return 'Low Density (Suburban)';
  if (far < 1.5) return 'Medium Density (Urban Residential)';
  if (far < 3.0) return 'High Density (Urban Mixed-Use)';
  return 'Very High Density (Downtown)';
}

/**
 * Get color for building height visualization
 */
function getColorByHeight(height: number): string {
  if (height < 10) return '#90EE90'; // Light green - low
  if (height < 20) return '#FFA500'; // Orange - medium
  if (height < 40) return '#FF6347'; // Tomato - high
  return '#8B0000'; // Dark red - very high
}

/**
 * Export FAR data for professional reports
 */
export function generateFARReport(analysis: BuildingDensityAnalysis): string {
  return `
Building Density Analysis (FAR Method)

Floor Area Ratio (FAR): ${analysis.far}
Density Category: ${analysis.densityCategory}

Metrics:
• Total Buildings: ${analysis.totalBuildings}
• Buildings per Hectare: ${analysis.buildingsPerHectare}
• Average Height: ${analysis.averageHeight}m (${analysis.averageFloors} floors)
• Total Building Footprint: ${(analysis.totalBuildingFootprint / 1000000).toFixed(2)} km²
• Land Area: ${(analysis.landArea / 1000000).toFixed(2)} km²

FAR Interpretation:
${getFARInterpretation(analysis.far)}
  `.trim();
}

function getFARInterpretation(far: number): string {
  if (far < 0.5) {
    return 'Low-density suburban area. Single-family homes, wide spacing. Car-dependent.';
  } else if (far < 1.5) {
    return 'Medium-density urban residential. Mix of apartments and townhomes. Walkable with good transit.';
  } else if (far < 3.0) {
    return 'High-density urban mixed-use. Multi-story buildings, active street life, excellent walkability.';
  } else {
    return 'Very high-density downtown core. Skyscrapers, intensive land use, pedestrian-oriented.';
  }
}
