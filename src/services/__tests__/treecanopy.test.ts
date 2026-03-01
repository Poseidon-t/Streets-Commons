import { describe, it, expect } from 'vitest';
import { scoreTreeCanopy } from '../treecanopy';

describe('Tree Canopy Service - Pure Functions', () => {
  describe('scoreTreeCanopy', () => {
    it('should return 10 for dense vegetation (NDVI >= 0.6)', () => {
      expect(scoreTreeCanopy(0.6)).toBe(10);
      expect(scoreTreeCanopy(0.8)).toBe(10);
      expect(scoreTreeCanopy(1.0)).toBe(10);
    });

    it('should return 5-10 for healthy vegetation (NDVI 0.4-0.6)', () => {
      expect(scoreTreeCanopy(0.4)).toBe(5);
      const mid = scoreTreeCanopy(0.5);
      expect(mid).toBeGreaterThanOrEqual(5);
      expect(mid).toBeLessThanOrEqual(10);
    });

    it('should return 0-5 for moderate vegetation (NDVI 0.2-0.4)', () => {
      expect(scoreTreeCanopy(0.2)).toBe(0);
      const mid = scoreTreeCanopy(0.3);
      expect(mid).toBeGreaterThanOrEqual(0);
      expect(mid).toBeLessThanOrEqual(5);
      expect(scoreTreeCanopy(0.4)).toBe(5);
    });

    it('should return 0-2 for sparse vegetation (NDVI 0-0.2)', () => {
      expect(scoreTreeCanopy(0)).toBe(0);
      const mid = scoreTreeCanopy(0.1);
      expect(mid).toBeGreaterThanOrEqual(0);
      expect(mid).toBeLessThanOrEqual(2);
    });

    it('should return 0 for negative NDVI (water/bare soil)', () => {
      expect(scoreTreeCanopy(-0.1)).toBe(0);
      expect(scoreTreeCanopy(-0.5)).toBe(0);
    });

    it('should scale linearly within healthy range (0.4-0.6)', () => {
      const low = scoreTreeCanopy(0.4);   // 5
      const mid = scoreTreeCanopy(0.5);   // 7.5
      const high = scoreTreeCanopy(0.6);  // 10
      expect(mid).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(mid);
    });

    it('should scale linearly within moderate range (0.2-0.4)', () => {
      const low = scoreTreeCanopy(0.2);   // 0
      const mid = scoreTreeCanopy(0.3);   // 2.5
      const high = scoreTreeCanopy(0.4);  // 5
      expect(mid).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(mid);
    });
  });
});
