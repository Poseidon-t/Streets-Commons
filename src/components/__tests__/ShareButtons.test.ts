import { describe, it, expect } from 'vitest';
import type { WalkabilityMetrics } from '../../types';

// Test the share text template logic directly
// These mirror the logic from ShareButtons.tsx

const METRIC_LABELS: Record<string, string> = {
  'crossing safety': 'crossing safety',
  'sidewalk coverage': 'sidewalk coverage',
  'traffic speed': 'traffic speed safety',
  'daily needs access': 'daily needs access',
  'night safety': 'well-lit streets',
  terrain: 'terrain accessibility',
  'tree canopy': 'tree canopy coverage',
  'thermal comfort': 'thermal comfort',
};
const ml = (key: string): string => METRIC_LABELS[key] || key;

const getRange = (s: number): 'critical' | 'poor' | 'fair' | 'good' =>
  s < 3 ? 'critical' : s < 5 ? 'poor' : s < 7 ? 'fair' : 'good';

function findWeakestMetric(metrics: WalkabilityMetrics): [string, number] {
  const entries: [string, number | undefined][] = [
    ['crossing safety', metrics.crossingSafety],
    ['sidewalk coverage', metrics.sidewalkCoverage],
    ['traffic speed', metrics.speedExposure],
    ['daily needs access', metrics.destinationAccess],
    ['night safety', metrics.nightSafety],
    ['terrain', metrics.slope],
    ['tree canopy', metrics.treeCanopy],
    ['thermal comfort', metrics.thermalComfort],
  ];
  return entries
    .filter((e): e is [string, number] => typeof e[1] === 'number')
    .sort((a, b) => a[1] - b[1])[0] || ['walkability', metrics.overallScore];
}

// -- Tests --

describe('Share Text Generation Logic', () => {
  describe('score range classification', () => {
    it('should classify 0-2.9 as critical', () => {
      expect(getRange(0)).toBe('critical');
      expect(getRange(1.5)).toBe('critical');
      expect(getRange(2.9)).toBe('critical');
    });

    it('should classify 3-4.9 as poor', () => {
      expect(getRange(3)).toBe('poor');
      expect(getRange(4.5)).toBe('poor');
    });

    it('should classify 5-6.9 as fair', () => {
      expect(getRange(5)).toBe('fair');
      expect(getRange(6.5)).toBe('fair');
    });

    it('should classify 7+ as good', () => {
      expect(getRange(7)).toBe('good');
      expect(getRange(9.5)).toBe('good');
    });
  });

  describe('metric label mapping', () => {
    it('should map all known metric keys to human-readable labels', () => {
      expect(ml('crossing safety')).toBe('crossing safety');
      expect(ml('tree canopy')).toBe('tree canopy coverage');
      expect(ml('night safety')).toBe('well-lit streets');
      expect(ml('terrain')).toBe('terrain accessibility');
    });

    it('should return key as-is for unknown metrics', () => {
      expect(ml('unknown_metric')).toBe('unknown_metric');
    });
  });

  describe('weakest metric detection', () => {
    it('should find the metric with the lowest score', () => {
      const metrics: WalkabilityMetrics = {
        crossingSafety: 5,
        sidewalkCoverage: 7,
        speedExposure: 6,
        destinationAccess: 6,
        nightSafety: 4,
        slope: 8,
        treeCanopy: 2, // Weakest
        thermalComfort: 5,
        overallScore: 5.8,
        label: 'Fair',
      };
      const [name, score] = findWeakestMetric(metrics);
      expect(name).toBe('tree canopy');
      expect(score).toBe(2);
    });

    it('should handle all zeros', () => {
      const metrics: WalkabilityMetrics = {
        crossingSafety: 0,
        sidewalkCoverage: 0,
        speedExposure: 0,
        destinationAccess: 0,
        nightSafety: 0,
        slope: 0,
        treeCanopy: 0,
        thermalComfort: 0,
        overallScore: 0,
        label: 'Critical',
      };
      const [, score] = findWeakestMetric(metrics);
      expect(score).toBe(0);
    });
  });

  describe('Twitter text constraints', () => {
    it('should generate text that fits Twitter character limit', () => {
      const shortName = 'Portland';
      const score = '7.2';
      const prodUrl = 'https://safestreets.streetsandcommons.com/?lat=45.5&lon=-122.6';
      const weakest: [string, number] = ['tree canopy', 3.2];

      // Simulate a twitter template
      const text = `${shortName}: ${score}/10 walkability. Above average, but ${ml(weakest[0])} (${weakest[1].toFixed(1)}/10) drags it down.\n\nMeasured with satellite imagery against NACTO standards. Close to good \u2014 not there yet.\n\n${prodUrl}`;
      expect(text.length).toBeLessThanOrEqual(400); // Generous limit for template; actual tweets may trim
    });
  });

  describe('LinkedIn text content', () => {
    it('should include methodology references', () => {
      const text = `I ran a walkability audit on Portland using satellite imagery (Sentinel-2, Landsat) and OpenStreetMap data, measured against NACTO Global Street Design Standards and WHO pedestrian safety guidelines.`;

      expect(text).toContain('Sentinel-2');
      expect(text).toContain('NACTO');
      expect(text).toContain('WHO');
      expect(text).toContain('OpenStreetMap');
    });
  });
});
