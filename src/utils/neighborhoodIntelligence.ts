import type { OSMData, TransitAccessData, ParkAccessData, FoodAccessData } from '../types';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getElementCoords(el: any): { lat: number; lon: number } | null {
  if (el.lat !== undefined && el.lon !== undefined) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

export function computeTransitAccess(osmData: OSMData, lat: number, lon: number): TransitAccessData {
  const elements = osmData.rawElements || [];

  let busStops = 0;
  let railStations = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    const isRail =
      tags.railway === 'station' ||
      tags.railway === 'halt' ||
      tags.station === 'subway' ||
      tags.station === 'light_rail';
    const isBus =
      tags.highway === 'bus_stop' ||
      tags.amenity === 'bus_station' ||
      (tags.public_transport === 'stop_position' && !isRail) ||
      (tags.public_transport === 'platform' && tags.bus === 'yes');

    if (isRail) railStations++;
    else if (isBus) busStops++;
  }

  const totalStops = busStops + railStations;
  // Score: rail stations worth more; 10 if ≥15 stops or ≥2 rail stations
  const railBonus = Math.min(railStations * 3, 6);
  const busScore = Math.min(busStops / 15 * 7, 7);
  const score = Math.min(Math.round((busScore + railBonus) * 10) / 10, 10);

  return { busStops, railStations, totalStops, score };
}

export function computeParkAccess(osmData: OSMData, lat: number, lon: number): ParkAccessData {
  const elements = osmData.rawElements || [];

  let parks = 0;
  let playgrounds = 0;
  let gardens = 0;
  let nearestParkMeters: number | null = null;

  for (const el of elements) {
    const tags = el.tags || {};
    const isGreen =
      tags.leisure === 'park' ||
      tags.leisure === 'garden' ||
      tags.leisure === 'playground' ||
      tags.leisure === 'nature_reserve' ||
      tags.landuse === 'recreation_ground';

    if (!isGreen) continue;

    if (tags.leisure === 'park' || tags.leisure === 'nature_reserve' || tags.landuse === 'recreation_ground') parks++;
    else if (tags.leisure === 'playground') playgrounds++;
    else if (tags.leisure === 'garden') gardens++;

    const coords = getElementCoords(el);
    if (coords) {
      const dist = haversine(lat, lon, coords.lat, coords.lon);
      if (nearestParkMeters === null || dist < nearestParkMeters) {
        nearestParkMeters = Math.round(dist);
      }
    }
  }

  const totalGreenSpaces = parks + playgrounds + gardens;

  // Score: combination of count and proximity
  let score = 0;
  if (totalGreenSpaces > 0) {
    const countScore = Math.min(totalGreenSpaces / 5, 1) * 5; // up to 5 points for count
    const distScore = nearestParkMeters !== null
      ? Math.max(0, 5 - (nearestParkMeters / 400) * 5) // 5 points if <400m, 0 if >400m
      : 0;
    score = Math.round((countScore + distScore) * 10) / 10;
  }

  return { parks, playgrounds, gardens, totalGreenSpaces, nearestParkMeters, score };
}

export function computeFoodAccess(osmData: OSMData, lat: number, lon: number): FoodAccessData {
  const elements = osmData.rawElements || [];

  let supermarkets = 0;
  let groceryStores = 0;
  let convenienceStores = 0;
  let nearestSupermarketMeters: number | null = null;

  for (const el of elements) {
    const tags = el.tags || {};
    const shop = tags.shop;
    if (!shop) continue;

    const isSupermarket = shop === 'supermarket';
    const isGrocery = shop === 'grocery' || shop === 'greengrocer';
    const isConvenience = shop === 'convenience' || shop === 'general';

    if (isSupermarket) {
      supermarkets++;
      const coords = getElementCoords(el);
      if (coords) {
        const dist = haversine(lat, lon, coords.lat, coords.lon);
        if (nearestSupermarketMeters === null || dist < nearestSupermarketMeters) {
          nearestSupermarketMeters = Math.round(dist);
        }
      }
    } else if (isGrocery) {
      groceryStores++;
    } else if (isConvenience) {
      convenienceStores++;
    }
  }

  const totalFoodStores = supermarkets + groceryStores + convenienceStores;
  const isFoodDesert = supermarkets === 0 || (nearestSupermarketMeters !== null && nearestSupermarketMeters > 800);

  // Score: supermarkets weighted heavily
  let score = 0;
  if (totalFoodStores > 0) {
    const superScore = Math.min(supermarkets / 3, 1) * 4; // up to 4 points
    const groceryScore = Math.min(groceryStores / 3, 1) * 2; // up to 2 points
    const distScore = nearestSupermarketMeters !== null
      ? Math.max(0, 4 - (nearestSupermarketMeters / 400) * 4) // 4 points if <400m
      : 0;
    score = Math.round((superScore + groceryScore + distScore) * 10) / 10;
  }

  return { supermarkets, groceryStores, convenienceStores, totalFoodStores, nearestSupermarketMeters, isFoodDesert, score };
}
