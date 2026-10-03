/**
 * Integer axis for a count chart with `steps` equal intervals: the top is the smallest multiple of
 * `steps` that is >= the data maximum, so every tick is a distinct whole number
 * (max 2 gives 4,3,2,1,0, never 2,2,1,1,0).
 */
export function integerAxis(max: number, steps = 4): { top: number; ticks: number[] } {
  const safeSteps = Math.max(1, Math.floor(steps));
  const m = Number.isFinite(max) && max > 0 ? Math.ceil(max) : 0;
  const top = Math.max(safeSteps, Math.ceil(m / safeSteps) * safeSteps);
  const ticks = Array.from({ length: safeSteps + 1 }, (_, i) => top - (top / safeSteps) * i);
  return { top, ticks };
}
