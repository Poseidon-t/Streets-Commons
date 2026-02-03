import { describe, it, expect } from 'vitest';
import { scoreTreeCanopy } from '../treecanopy';

describe('Tree Canopy Service - Pure Functions', () => {
  describe('scoreTreeCanopy', () => {
    it('should return 10 for dense vegetation (NDVI >= 0.6)', () => {
      expect(scoreTreeCanopy(0.6)).toBe(10);
      expect(scoreTreeCanopy(0.8)).toBe(10);
      expect(scoreTreeCanopy(1.0)).toBe(10);
    });

    it('should return 5-10 for moderate vegetation (NDVI 0.4-0.6)', () => {
      const score = scoreTreeCanopy(0.5);
      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should return exactly 5 for NDVI = 0.4', () => {
      expect(scoreTreeCanopy(0.4)).toBe(5);
    });

    it('should return 0-5 for sparse vegetation (NDVI 0.2-0.4)', () => {
      const score = scoreTreeCanopy(0.3);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should return 0 for no vegetation (NDVI < 0.2)', () => {
      expect(scoreTreeCanopy(0.1)).toBe(0);
      expect(scoreTreeCanopy(0)).toBe(0);
      expect(scoreTreeCanopy(-0.1)).toBe(0);
    });

    it('should scale linearly within moderate range', () => {
      const low = scoreTreeCanopy(0.4);  // Should be 5
      const mid = scoreTreeCanopy(0.5);  // Should be 7.5
      const high = scoreTreeCanopy(0.6); // Should be 10
      expect(mid).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(mid);
    });

    it('should scale linearly within sparse range', () => {
      const low = scoreTreeCanopy(0.2);  // Should be 0
      const mid = scoreTreeCanopy(0.3);  // Should be 2.5
      const high = scoreTreeCanopy(0.4); // Should be 5
      expect(mid).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(mid);
    });
  });
});
