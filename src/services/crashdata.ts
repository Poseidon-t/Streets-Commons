/**
 * Crash Data Service (client-side)
 *
 * Fetches fatal crash/death data directly from public APIs:
 * - US locations: NHTSA FARS via FCC Census (FIPS lookup) + FARS API
 * - International: WHO road traffic death rates (static bundled JSON)
 *
 * No backend required — all APIs are public with no auth.
 */

import type { CrashData, LocalCrashData, CountryCrashData } from '../types';
import whoRoadDeaths from '../data/whoRoadDeaths.json';

// --- ISO 3166-1 alpha-2 → alpha-3 mapping for WHO lookup ---
const iso2to3: Record<string, string> = {
  AF:'AFG',AL:'ALB',DZ:'DZA',AD:'AND',AO:'AGO',AG:'ATG',AR:'ARG',AM:'ARM',AU:'AUS',AT:'AUT',
  AZ:'AZE',BS:'BHS',BH:'BHR',BD:'BGD',BB:'BRB',BY:'BLR',BE:'BEL',BZ:'BLZ',BJ:'BEN',BT:'BTN',
  BO:'BOL',BA:'BIH',BW:'BWA',BR:'BRA',BN:'BRN',BG:'BGR',BI:'BDI',KH:'KHM',CM:'CMR',CA:'CAN',
  CV:'CPV',CF:'CAF',CL:'CHL',CN:'CHN',CO:'COL',KM:'COM',CD:'COD',CR:'CRI',CI:'CIV',HR:'HRV',
  CU:'CUB',CY:'CYP',DK:'DNK',DJ:'DJI',DM:'DMA',DO:'DOM',EC:'ECU',EG:'EGY',ER:'ERI',EE:'EST',
  ET:'ETH',FJ:'FJI',FI:'FIN',FR:'FRA',GA:'GAB',GM:'GMB',DE:'DEU',GH:'GHA',GR:'GRC',GD:'GRD',
  GT:'GTM',GN:'GIN',GW:'GNB',GY:'GUY',HT:'HTI',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',ID:'IDN',
  IR:'IRN',IQ:'IRQ',IE:'IRL',IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',KE:'KEN',
  KI:'KIR',KW:'KWT',KG:'KGZ',LA:'LAO',LV:'LVA',LB:'LBN',LS:'LSO',LY:'LBY',LT:'LTU',MG:'MDG',
  MW:'MWI',MY:'MYS',MV:'MDV',ML:'MLI',MT:'MLT',MH:'MHL',MR:'MRT',MU:'MUS',MX:'MEX',MD:'MDA',
  MC:'MCO',MN:'MNG',ME:'MNE',MZ:'MOZ',MM:'MMR',NA:'NAM',NR:'NRU',NP:'NPL',NL:'NLD',NZ:'NZL',
  NI:'NIC',NE:'NER',NG:'NGA',MK:'MKD',NO:'NOR',OM:'OMN',PK:'PAK',PW:'PLW',PS:'PSE',PA:'PAN',
  PG:'PNG',PY:'PRY',PH:'PHL',PL:'POL',PT:'PRT',PR:'PRI',QA:'QAT',KR:'KOR',RO:'ROU',RU:'RUS',
  RW:'RWA',KN:'KNA',LC:'LCA',VC:'VCT',WS:'WSM',SM:'SMR',SA:'SAU',RS:'SRB',SL:'SLE',SG:'SGP',
  SI:'SVN',SB:'SLB',SO:'SOM',ZA:'ZAF',SS:'SSD',ES:'ESP',LK:'LKA',SD:'SDN',SR:'SUR',SZ:'SWZ',
  SE:'SWE',CH:'CHE',SY:'SYR',TJ:'TJK',TZ:'TZA',TH:'THA',TL:'TLS',TG:'TGO',TO:'TON',TT:'TTO',
  TR:'TUR',TM:'TKM',TV:'TUV',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',US:'USA',UY:'URY',UZ:'UZB',
  VU:'VUT',VE:'VEN',VN:'VNM',YE:'YEM',ZM:'ZMB',GQ:'GNQ',PE:'PER',CZ:'CZE',SK:'SVK',
};

// --- Haversine distance (meters) ---
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- WHO country-level lookup (instant, no network) ---
function lookupWHO(countryCode: string): CountryCrashData | null {
  const code = countryCode.toUpperCase();
  const iso3 = iso2to3[code] || code;
  const data = whoRoadDeaths as unknown as Record<string, { rate: number; name: string }>;
  const entry = data[iso3];
  if (!entry) return null;

  const meta = (whoRoadDeaths as Record<string, unknown>)._meta as
    { year?: number } | undefined;

  return {
    type: 'country',
    deathRatePer100k: entry.rate,
    totalDeaths: 0,
    countryName: entry.name,
    year: meta?.year || 2021,
    dataSource: 'WHO Global Health Observatory',
  };
}

// --- US FARS street-level lookup (FCC + NHTSA, ~2-5s) ---
async function fetchUSCrashData(lat: number, lon: number): Promise<LocalCrashData | null> {
  // Step 1: Get state/county FIPS from FCC Census API
  const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`;
  const fccResponse = await fetch(fccUrl, { signal: AbortSignal.timeout(10000) });

  if (!fccResponse.ok) {
    console.warn(`FCC API returned ${fccResponse.status}`);
    return null;
  }

  const fccData = await fccResponse.json();
  if (!fccData.results || fccData.results.length === 0) return null;

  const stateFips = fccData.results[0].state_fips;
  const countyFips = fccData.results[0].county_fips;
  if (!stateFips || !countyFips) return null;

  // Step 2: Query FARS
  const fromYear = 2018;
  const toYear = 2022;
  const farsUrl = `https://crashviewer.nhtsa.dot.gov/CrashAPI/crashes/GetCrashesByLocation?fromCaseYear=${fromYear}&toCaseYear=${toYear}&state=${stateFips}&county=${countyFips}&format=json`;

  const farsResponse = await fetch(farsUrl, { signal: AbortSignal.timeout(15000) });

  if (!farsResponse.ok) {
    console.warn(`FARS API returned ${farsResponse.status}`);
    return null;
  }

  const farsData = await farsResponse.json();

  let crashes: Record<string, unknown>[] = Array.isArray(farsData)
    ? farsData
    : (farsData.Results || farsData.results || []);

  // Flatten if nested arrays
  if (crashes.length > 0 && Array.isArray(crashes[0])) {
    crashes = (crashes as unknown as unknown[][]).flat() as Record<string, unknown>[];
  }

  // Step 3: Filter crashes within 800m
  const radiusMeters = 800;
  const nearbyCrashes: { distance: number; fatalities: number; year: number; road: string }[] = [];

  for (const crash of crashes) {
    const crashLat = parseFloat(String(crash.LATITUDE || crash.latitude || ''));
    const crashLon = parseFloat(String(crash.LONGITUD || crash.LONGITUDE || crash.longitude || crash.longitud || ''));

    if (isNaN(crashLat) || isNaN(crashLon) || crashLat === 0 || crashLon === 0) continue;

    const dist = haversineDistance(lat, lon, crashLat, crashLon);
    if (dist <= radiusMeters) {
      nearbyCrashes.push({
        distance: Math.round(dist),
        fatalities: parseInt(String(crash.FATALS || crash.fatals || '1'), 10),
        year: parseInt(String(crash.CaseYear || crash.CASEYEAR || crash.caseyear || '0'), 10),
        road: String(crash.TWAY_ID || crash.tway_id || 'Unknown road'),
      });
    }
  }

  // Step 4: Aggregate
  const totalCrashes = nearbyCrashes.length;
  const totalFatalities = nearbyCrashes.reduce((sum, c) => sum + c.fatalities, 0);

  const yearMap: Record<number, { year: number; crashes: number; fatalities: number }> = {};
  for (let y = fromYear; y <= toYear; y++) yearMap[y] = { year: y, crashes: 0, fatalities: 0 };
  for (const c of nearbyCrashes) {
    if (yearMap[c.year]) {
      yearMap[c.year].crashes++;
      yearMap[c.year].fatalities += c.fatalities;
    }
  }

  const nearest = nearbyCrashes.sort((a, b) => a.distance - b.distance)[0] || null;

  return {
    type: 'local',
    totalCrashes,
    totalFatalities,
    yearRange: { from: fromYear, to: toYear },
    yearlyBreakdown: Object.values(yearMap),
    nearestCrash: nearest ? {
      distance: nearest.distance,
      year: nearest.year,
      fatalities: nearest.fatalities,
      road: nearest.road,
    } : undefined,
    radiusMeters,
    dataSource: 'NHTSA FARS',
  };
}

/**
 * Fetch crash/fatality data for a location.
 * US: calls FCC + FARS APIs directly (no backend needed).
 * Non-US: returns WHO data from bundled static JSON (instant).
 * Returns null on error — never blocks the main analysis.
 */
export async function fetchCrashData(
  lat: number,
  lon: number,
  countryCode?: string,
): Promise<CrashData | null> {
  try {
    const code = (countryCode || '').toUpperCase();
    const isUS = code === 'US' || code === 'USA';

    if (isUS) {
      return await fetchUSCrashData(lat, lon);
    }

    // Non-US: instant WHO lookup (no network call)
    if (code) {
      return lookupWHO(code);
    }

    return null;
  } catch (error) {
    console.warn('Crash data fetch failed (non-blocking):', error);
    return null;
  }
}
