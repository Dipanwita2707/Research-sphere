import { countAxisMax, niceMax } from '../theme';

const ticks = (max: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => Math.round((max / n) * i));

describe('countAxisMax', () => {
  it('gives distinct integer ticks for small counts (no 0,1,1,2,2 axis)', () => {
    expect(countAxisMax(2)).toBe(4);
    expect(ticks(countAxisMax(2))).toEqual([0, 1, 2, 3, 4]);
    expect(countAxisMax(1)).toBe(4);
    expect(countAxisMax(5)).toBe(8);
    for (const v of [1, 2, 3, 5, 7, 9, 12, 15]) {
      const t = ticks(countAxisMax(v));
      expect(new Set(t).size).toBe(t.length);
    }
  });

  it('keeps the nice scale for larger values', () => {
    expect(countAxisMax(37)).toBe(niceMax(37));
    expect(countAxisMax(900)).toBe(1000);
  });
});
