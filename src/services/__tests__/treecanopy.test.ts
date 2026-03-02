import { describe, it, expect } from 'vitest';
import { scoreTreeCanopy } from '../treecanopy';

describe('Tree Canopy Service - Pure Functions', () => {
  describe('scoreTreeCanopy - urban-calibrated curve', () => {
    it('should return 10 for dense vegetation (NDVI >= 0.50)', () => {
      expect(scoreTreeCanopy(0.50)).toBe(10);
      expect(scoreTreeCanopy(0.7)).toBe(10);
      expect(scoreTreeCanopy(1.0)).toBe(10);
    });

    it('should return 7.5-10 for excellent tree cover (NDVI 0.35-0.50)', () => {
      expect(scoreTreeCanopy(0.35)).toBe(7.5);
      const mid = scoreTreeCanopy(0.42);
      expect(mid).toBeGreaterThanOrEqual(7.5);
      expect(mid).toBeLessThanOrEqual(10);
    });

    it('should return 5-7.5 for good tree cover (NDVI 0.20-0.35)', () => {
      expect(scoreTreeCanopy(0.20)).toBe(5);
      const mid = scoreTreeCanopy(0.28);
      expect(mid).toBeGreaterThanOrEqual(5);
      expect(mid).toBeLessThanOrEqual(7.5);
    });

    it('should return 3-5 for moderate urban greenery (NDVI 0.10-0.20)', () => {
      expect(scoreTreeCanopy(0.10)).toBe(3);
      const mid = scoreTreeCanopy(0.15);
      expect(mid).toBeGreaterThanOrEqual(3);
      expect(mid).toBeLessThanOrEqual(5);
    });

    it('should return 1-3 for sparse urban greenery (NDVI 0-0.10)', () => {
      expect(scoreTreeCanopy(0)).toBe(1);
      const mid = scoreTreeCanopy(0.05);
      expect(mid).toBeGreaterThanOrEqual(1);
      expect(mid).toBeLessThanOrEqual(3);
    });

    it('should score Hayes Valley NDVI (0.099) around 3', () => {
      const score = scoreTreeCanopy(0.099);
      expect(score).toBeGreaterThanOrEqual(2.5);
      expect(score).toBeLessThanOrEqual(3.5);
    });

    it('should return 0 for negative NDVI (water/bare soil)', () => {
      expect(scoreTreeCanopy(-0.1)).toBe(0);
      expect(scoreTreeCanopy(-0.5)).toBe(0);
    });

    it('should increase monotonically across all ranges', () => {
      const values = [0, 0.05, 0.10, 0.15, 0.20, 0.28, 0.35, 0.42, 0.50];
      for (let i = 1; i < values.length; i++) {
        expect(scoreTreeCanopy(values[i])).toBeGreaterThan(scoreTreeCanopy(values[i - 1]));
      }
    });
  });
});
