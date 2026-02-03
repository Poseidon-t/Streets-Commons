import { describe, it, expect } from 'vitest';
import { calculateSlope, calculateMaxSlope, scoreSlopeForWalkability, scoreSlopeFromDegrees, degreesToPercent } from '../elevation';

describe('Elevation Service - Pure Functions', () => {
  describe('calculateSlope', () => {
    it('should return 0 for flat terrain (all same elevation)', () => {
      const elevations = [100, 100, 100, 100, 100];
      expect(calculateSlope(elevations)).toBe(0);
    });

    it('should return 0 for single point', () => {
      expect(calculateSlope([100])).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(calculateSlope([])).toBe(0);
    });

    it('should calculate positive slope for hilly terrain', () => {
      // Center at 100m, surroundings at 110m average = 10m rise over 800m = 1.25%
      const elevations = [100, 110, 110, 110, 110];
      const slope = calculateSlope(elevations, 800);
      expect(slope).toBeGreaterThan(0);
      expect(slope).toBeCloseTo(1.3, 0);
    });

    it('should handle mixed elevation differences', () => {
      // Center at 100m, mix of higher and lower
      const elevations = [100, 120, 80, 110, 90, 115, 85, 105, 95];
      const slope = calculateSlope(elevations, 800);
      expect(slope).toBeGreaterThan(0);
    });

    it('should scale with radius', () => {
      const elevations = [100, 110, 110, 110, 110];
      const slope400 = calculateSlope(elevations, 400);
      const slope800 = calculateSlope(elevations, 800);
      // Same rise but shorter run = steeper slope
      expect(slope400).toBeGreaterThan(slope800);
    });
  });

  describe('calculateMaxSlope', () => {
    it('should return 0 for flat terrain', () => {
      expect(calculateMaxSlope([100, 100, 100])).toBe(0);
    });

    it('should return max slope, not average', () => {
      // Center 100, others: 110, 100, 100 => max diff = 10
      const elevations = [100, 110, 100, 100];
      const maxSlope = calculateMaxSlope(elevations, 800);
      const avgSlope = calculateSlope(elevations, 800);
      expect(maxSlope).toBeGreaterThanOrEqual(avgSlope);
    });

    it('should detect steep outlier', () => {
      const elevations = [100, 100, 100, 100, 150]; // One steep point
      const maxSlope = calculateMaxSlope(elevations, 800);
      // 50m rise over 800m = 6.25%
      expect(maxSlope).toBeCloseTo(6.3, 0);
    });
  });

  describe('scoreSlopeFromDegrees', () => {
    it('should return 10 for flat terrain (0-2 degrees)', () => {
      expect(scoreSlopeFromDegrees(0)).toBe(10);
      expect(scoreSlopeFromDegrees(1)).toBe(10);
      expect(scoreSlopeFromDegrees(2)).toBe(10);
    });

    it('should return 8 for gentle slope (2-5 degrees)', () => {
      expect(scoreSlopeFromDegrees(3)).toBe(8);
      expect(scoreSlopeFromDegrees(5)).toBe(8);
    });

    it('should return 6 for moderate slope (5-10 degrees)', () => {
      expect(scoreSlopeFromDegrees(7)).toBe(6);
      expect(scoreSlopeFromDegrees(10)).toBe(6);
    });

    it('should return 4 for steep slope (10-15 degrees)', () => {
      expect(scoreSlopeFromDegrees(12)).toBe(4);
      expect(scoreSlopeFromDegrees(15)).toBe(4);
    });

    it('should return 2 for very steep slope (>15 degrees)', () => {
      expect(scoreSlopeFromDegrees(20)).toBe(2);
      expect(scoreSlopeFromDegrees(45)).toBe(2);
    });
  });

  describe('scoreSlopeForWalkability', () => {
    it('should return 10 for perfectly flat terrain', () => {
      const score = scoreSlopeForWalkability(0, 0);
      expect(score).toBe(10);
    });

    it('should return 0 for very steep terrain', () => {
      const score = scoreSlopeForWalkability(5, 8);
      expect(score).toBe(0);
    });

    it('should weight average slope at 70% and max at 30%', () => {
      // avg=2.5%, max=4%
      const score = scoreSlopeForWalkability(2.5, 4);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(10);
    });

    it('should never return below 0', () => {
      const score = scoreSlopeForWalkability(10, 20);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('degreesToPercent', () => {
    it('should convert 0 degrees to 0%', () => {
      expect(degreesToPercent(0)).toBeCloseTo(0, 5);
    });

    it('should convert 45 degrees to 100%', () => {
      expect(degreesToPercent(45)).toBeCloseTo(100, 0);
    });

    it('should convert 5 degrees to ~8.7%', () => {
      const result = degreesToPercent(5);
      expect(result).toBeCloseTo(8.7, 0);
    });
  });
});
