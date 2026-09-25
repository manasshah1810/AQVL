import { describe, it, expect } from 'vitest';
import {
  getSizeTier,
  getLineParams,
  getHierarchyParams,
  getCircularParams,
  getGridParams,
  getGridDimensions,
  getForceDirectedParams,
  computeDefaultLayoutParams,
} from '../../packages/compiler/src/codegen/defaultLayoutParams';

describe('defaultLayoutParams', () => {
  describe('getSizeTier', () => {
    it('classifies counts into small (<10) / medium (10-49) / large (>=50)', () => {
      expect(getSizeTier(1)).toBe('small');
      expect(getSizeTier(9)).toBe('small');
      expect(getSizeTier(10)).toBe('medium');
      expect(getSizeTier(49)).toBe('medium');
      expect(getSizeTier(50)).toBe('large');
      expect(getSizeTier(500)).toBe('large');
    });
  });

  describe('LINE (Array/LinkedList/Stack/Queue/HashMap)', () => {
    it('ARRAY: small count keeps the legacy spacing (2.2) exactly', () => {
      expect(getLineParams('ARRAY', 3).spacing).toBe(2.2);
      expect(getLineParams('ARRAY', 9).spacing).toBe(2.2);
    });

    it('ARRAY: spacing decreases sensibly as count grows, never below the floor', () => {
      const small = getLineParams('ARRAY', 9).spacing;
      const medium = getLineParams('ARRAY', 30).spacing;
      const large = getLineParams('ARRAY', 200).spacing;
      expect(medium).toBeLessThan(small);
      expect(large).toBeLessThan(medium);
      expect(large).toBeGreaterThanOrEqual(0.6); // ARRAY's floor
    });

    it('spacing decreases monotonically for every LINE structure kind as count grows', () => {
      for (const kind of ['ARRAY', 'LINKEDLIST', 'STACK', 'QUEUE', 'HASHMAP'] as const) {
        const counts = [5, 15, 30, 60, 300];
        const spacings = counts.map((n) => getLineParams(kind, n).spacing);
        for (let i = 1; i < spacings.length; i++) {
          expect(spacings[i]).toBeLessThanOrEqual(spacings[i - 1]);
        }
      }
    });

    it('preserves each structure kind\'s axis and origin regardless of count', () => {
      expect(getLineParams('STACK', 3)).toMatchObject({ axis: 'vertical', origin: [0, -2, 0] });
      expect(getLineParams('STACK', 300)).toMatchObject({ axis: 'vertical', origin: [0, -2, 0] });
      expect(getLineParams('QUEUE', 300).axis).toBe('horizontal');
    });
  });

  describe('HIERARCHY (Tree/BST/Heap/Trie)', () => {
    it('small count keeps the legacy levelGap/siblingGap (2.0/1.5) exactly', () => {
      expect(getHierarchyParams(3)).toMatchObject({ levelGap: 2.0, siblingGap: 1.5 });
    });

    it('levelGap grows and siblingGap shrinks as count (breadth/depth proxy) grows', () => {
      const small = getHierarchyParams(9);
      const medium = getHierarchyParams(40);
      const large = getHierarchyParams(300);
      expect(medium.levelGap).toBeGreaterThan(small.levelGap);
      expect(large.levelGap).toBeGreaterThan(medium.levelGap);
      expect(medium.siblingGap).toBeLessThan(small.siblingGap);
      expect(large.siblingGap).toBeLessThan(medium.siblingGap);
      expect(large.siblingGap).toBeGreaterThanOrEqual(0.6); // floor
    });
  });

  describe('CIRCULAR', () => {
    it('radius grows with element count', () => {
      const r1 = getCircularParams(3).radius;
      const r2 = getCircularParams(20).radius;
      const r3 = getCircularParams(100).radius;
      expect(r2).toBeGreaterThan(r1);
      expect(r3).toBeGreaterThan(r2);
    });

    it('never returns a radius below the small-ring floor', () => {
      expect(getCircularParams(1).radius).toBeGreaterThanOrEqual(3);
      expect(getCircularParams(0).radius).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GRID', () => {
    it('dimensions scale reasonably (roughly square, rows*columns >= count)', () => {
      for (const n of [1, 4, 10, 37, 100]) {
        const { rows, columns } = getGridDimensions(n);
        expect(rows * columns).toBeGreaterThanOrEqual(n);
        expect(Math.abs(rows - columns)).toBeLessThanOrEqual(Math.ceil(Math.sqrt(n)));
      }
    });

    it('cellSpacing decreases as count grows', () => {
      const small = getGridParams(5).cellSpacing;
      const large = getGridParams(200).cellSpacing;
      expect(large).toBeLessThan(small);
    });
  });

  describe('FORCE_DIRECTED (Graph)', () => {
    it('small count keeps the legacy repulsion/springLength/iterations', () => {
      const params = getForceDirectedParams(3);
      expect(params).toMatchObject({ repulsion: 5.0, springLength: 2.0, attraction: 0.1, iterations: 100 });
    });

    it('repulsion decreases and iterations drop for larger graphs (perf)', () => {
      const small = getForceDirectedParams(9);
      const medium = getForceDirectedParams(30);
      const large = getForceDirectedParams(200);
      expect(medium.repulsion).toBeLessThan(small.repulsion);
      expect(large.repulsion).toBeLessThan(medium.repulsion);
      expect(medium.iterations).toBeLessThan(small.iterations);
      expect(large.iterations).toBeLessThan(medium.iterations);
    });

    it('perf acceptable at large graphs: iterations stay bounded and positive', () => {
      const params = getForceDirectedParams(1000);
      expect(params.iterations).toBeGreaterThan(0);
      expect(params.iterations).toBeLessThanOrEqual(100);
      expect(params.repulsion).toBeGreaterThan(0);
    });
  });

  describe('computeDefaultLayoutParams (generator entry point)', () => {
    it('resolves the correct strategy per structure kind', () => {
      expect(computeDefaultLayoutParams('ARRAY', 5)!.strategy).toBe('LINE');
      expect(computeDefaultLayoutParams('BST', 5)!.strategy).toBe('HIERARCHY');
      expect(computeDefaultLayoutParams('GRAPH', 5)!.strategy).toBe('FORCE_DIRECTED');
    });

    it('returns undefined for a kind with no default, matching legacy behavior', () => {
      expect(computeDefaultLayoutParams('NODE', 5)).toBeUndefined();
    });

    it('a large ARRAY gets tighter spacing than a small one through the unified entry point', () => {
      const small = computeDefaultLayoutParams('ARRAY', 3)!.params.spacing as number;
      const large = computeDefaultLayoutParams('ARRAY', 200)!.params.spacing as number;
      expect(large).toBeLessThan(small);
    });
  });
});
