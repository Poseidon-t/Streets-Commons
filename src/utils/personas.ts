import type { WalkabilityScoreV2 } from '../types';

export interface PersonaResult {
  name: string;
  subtitle: string;
  score: number;
  verdictLabel: string;
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

export function weightedAvg(items: { score: number; weight: number }[]): number {
  const valid = items.filter(i => i.score > 0);
  if (!valid.length) return 0;
  const total = valid.reduce((s, i) => s + i.weight, 0);
  return valid.reduce((s, i) => s + i.score * i.weight, 0) / total;
}

export function verdictLabel(score: number): string {
  if (score >= 75) return 'Excellent fit';
  if (score >= 60) return 'Works well';
  if (score >= 45) return 'Some trade-offs';
  if (score >= 30) return 'Limited suitability';
  return 'Not recommended';
}

export function scoreColor(score: number): string {
  if (score >= 65) return '#22c55e';
  if (score >= 42) return '#eab308';
  return '#ef4444';
}

export function computePersonas(cs: WalkabilityScoreV2): PersonaResult[] {
  const { networkDesign, environmentalComfort, safety, densityContext } = cs.components;

  const transit      = densityContext.metrics.find(m => m.name === 'Transit Access')?.score      ?? 0;
  const destinations = densityContext.metrics.find(m => m.name === 'Nearby Destinations')?.score ?? 0;
  const noise        = environmentalComfort.metrics.find(m => m.name === 'Noise')?.score          ?? 0;
  const lighting     = environmentalComfort.metrics.find(m => m.name === 'Street Lighting')?.score ?? 0;
  const terrain      = environmentalComfort.metrics.find(m => m.name === 'Terrain')?.score        ?? 0;
  const airQuality   = environmentalComfort.metrics.find(m => m.name === 'Air Quality')?.score    ?? 0;
  const treeCanopy   = environmentalComfort.metrics.find(m => m.name === 'Tree Canopy')?.score    ?? 0;

  const commuter = clamp(Math.round(weightedAvg([
    { score: networkDesign.score,  weight: 0.35 },
    { score: transit,              weight: 0.35 },
    { score: destinations,         weight: 0.30 },
  ])));

  const families = clamp(Math.round(weightedAvg([
    { score: safety.score,               weight: 0.40 },
    { score: networkDesign.score,        weight: 0.30 },
    { score: noise,                      weight: 0.15 },
    { score: environmentalComfort.score, weight: 0.15 },
  ])));

  const elderly = clamp(Math.round(weightedAvg([
    { score: densityContext.score, weight: 0.30 },
    { score: safety.score,         weight: 0.30 },
    { score: terrain,              weight: 0.20 },
    { score: lighting,             weight: 0.10 },
    { score: transit,              weight: 0.10 },
  ])));

  const carFreeRaw = weightedAvg([
    { score: densityContext.score,  weight: 0.40 },
    { score: networkDesign.score,   weight: 0.35 },
    { score: transit,               weight: 0.25 },
  ]);
  const weakest = Math.min(densityContext.score, networkDesign.score, transit > 0 ? transit : 100);
  const carFree = clamp(Math.round(Math.min(carFreeRaw, weakest * 1.4)));

  const remote = clamp(Math.round(weightedAvg([
    { score: destinations,         weight: 0.45 },
    { score: airQuality,           weight: 0.20 },
    { score: noise,                weight: 0.15 },
    { score: treeCanopy,           weight: 0.10 },
    { score: networkDesign.score,  weight: 0.10 },
  ])));

  return [
    { name: 'Daily Commuter',   subtitle: 'Walking, transit & daily errands on foot', score: commuter, verdictLabel: verdictLabel(commuter) },
    { name: 'Families',         subtitle: 'Safe streets, parks, school runs',          score: families, verdictLabel: verdictLabel(families) },
    { name: 'Older Adults',     subtitle: 'Accessible services, flat terrain, safety', score: elderly,  verdictLabel: verdictLabel(elderly)  },
    { name: 'Car-Free Living',  subtitle: 'No vehicle  -  walking and transit only',     score: carFree,  verdictLabel: verdictLabel(carFree)  },
    { name: 'Remote Workers',   subtitle: 'Cafés, parks, midday walks',                score: remote,   verdictLabel: verdictLabel(remote)   },
  ];
}
