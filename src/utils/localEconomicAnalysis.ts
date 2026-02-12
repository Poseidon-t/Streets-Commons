import type { OSMData } from '../types';
import { ANALYSIS_RADIUS } from '../constants';

export interface LocalEconomicProfile {
  totalBusinesses: number;
  businessDensityPerKm2: number;
  categories: {
    retail: number;
    dining: number;
    healthcare: number;
    education: number;
    financial: number;
    transit: number;
    recreation: number;
    services: number;
  };
  categoryCount: number; // how many of 8 categories have at least 1 POI
  vitality: 'thriving' | 'active' | 'moderate' | 'developing' | 'limited';
  highlights: string[];
  gaps: string[];
  areaKm2: number;
}

const RETAIL_TAGS = new Set([
  'supermarket', 'convenience', 'grocery', 'greengrocer', 'bakery', 'butcher',
  'clothes', 'shoes', 'department_store', 'mall', 'hardware', 'electronics',
  'furniture', 'books', 'stationery', 'jewelry', 'optician', 'mobile_phone',
  'variety_store', 'chemist', 'kiosk', 'newsagent', 'general',
]);

const DINING_AMENITIES = new Set([
  'restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream',
]);

const HEALTHCARE_AMENITIES = new Set([
  'hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'veterinary',
]);

const EDUCATION_AMENITIES = new Set([
  'school', 'kindergarten', 'university', 'college', 'library', 'language_school',
]);

const FINANCIAL_AMENITIES = new Set([
  'bank', 'atm', 'bureau_de_change', 'money_transfer',
]);

const TRANSIT_TAGS = new Set([
  'bus_station', 'ferry_terminal',
]);

const RECREATION_LEISURE = new Set([
  'park', 'playground', 'sports_centre', 'fitness_centre', 'swimming_pool',
  'stadium', 'pitch', 'garden',
]);

const SERVICE_AMENITIES = new Set([
  'post_office', 'police', 'fire_station', 'townhall', 'community_centre',
  'marketplace', 'fuel', 'car_wash', 'car_rental',
]);

export function analyzeLocalEconomy(osmData: OSMData): LocalEconomicProfile {
  const areaKm2 = Math.PI * (ANALYSIS_RADIUS / 1000) ** 2;

  const categories = {
    retail: 0,
    dining: 0,
    healthcare: 0,
    education: 0,
    financial: 0,
    transit: 0,
    recreation: 0,
    services: 0,
  };

  for (const poi of osmData.pois) {
    const tags = poi.tags || {};
    const amenity = tags.amenity;
    const shop = tags.shop;
    const leisure = tags.leisure;
    const railway = tags.railway;

    // Retail: any shop tag that matches, or generic shop
    if (shop) {
      if (RETAIL_TAGS.has(shop)) {
        categories.retail++;
      } else {
        // Any other shop type still counts as retail
        categories.retail++;
      }
    }

    // Dining
    if (amenity && DINING_AMENITIES.has(amenity)) {
      categories.dining++;
    }

    // Healthcare
    if (amenity && HEALTHCARE_AMENITIES.has(amenity)) {
      categories.healthcare++;
    }

    // Education
    if (amenity && EDUCATION_AMENITIES.has(amenity)) {
      categories.education++;
    }

    // Financial
    if (amenity && FINANCIAL_AMENITIES.has(amenity)) {
      categories.financial++;
    }

    // Transit
    if (railway === 'station' || railway === 'tram_stop' || railway === 'subway_entrance') {
      categories.transit++;
    }
    if (amenity && TRANSIT_TAGS.has(amenity)) {
      categories.transit++;
    }

    // Recreation
    if (leisure && RECREATION_LEISURE.has(leisure)) {
      categories.recreation++;
    }

    // Services
    if (amenity && SERVICE_AMENITIES.has(amenity)) {
      categories.services++;
    }
  }

  const totalBusinesses = categories.retail + categories.dining + categories.healthcare
    + categories.education + categories.financial + categories.services;
  const businessDensityPerKm2 = Math.round(totalBusinesses / areaKm2);

  // Count how many categories have presence
  const categoryCount = Object.values(categories).filter(v => v > 0).length;

  // Determine vitality
  let vitality: LocalEconomicProfile['vitality'];
  if (businessDensityPerKm2 >= 200 && categoryCount >= 6) vitality = 'thriving';
  else if (businessDensityPerKm2 >= 80 && categoryCount >= 4) vitality = 'active';
  else if (businessDensityPerKm2 >= 30 && categoryCount >= 3) vitality = 'moderate';
  else if (totalBusinesses >= 5) vitality = 'developing';
  else vitality = 'limited';

  // Build highlights
  const highlights: string[] = [];
  if (categories.dining >= 10) highlights.push(`${categories.dining} dining options nearby`);
  else if (categories.dining >= 3) highlights.push(`${categories.dining} restaurants & cafes`);
  if (categories.retail >= 10) highlights.push(`${categories.retail} shops within walking distance`);
  else if (categories.retail >= 3) highlights.push(`${categories.retail} retail shops nearby`);
  if (categories.healthcare >= 2) highlights.push(`${categories.healthcare} healthcare facilities`);
  if (categories.transit >= 2) highlights.push(`${categories.transit} transit stations`);
  else if (categories.transit === 1) highlights.push('Transit station accessible');
  if (categories.education >= 2) highlights.push(`${categories.education} schools & libraries`);
  if (categories.recreation >= 3) highlights.push(`${categories.recreation} parks & recreation spaces`);

  // Build gaps
  const gaps: string[] = [];
  if (categories.healthcare === 0) gaps.push('No healthcare within walking distance');
  if (categories.retail === 0) gaps.push('No retail shops nearby');
  if (categories.dining === 0) gaps.push('No dining options nearby');
  if (categories.transit === 0) gaps.push('No transit stations within reach');
  if (categories.education === 0 && categories.financial === 0) gaps.push('Limited community services');

  return {
    totalBusinesses,
    businessDensityPerKm2,
    categories,
    categoryCount,
    vitality,
    highlights: highlights.slice(0, 4),
    gaps: gaps.slice(0, 3),
    areaKm2,
  };
}
