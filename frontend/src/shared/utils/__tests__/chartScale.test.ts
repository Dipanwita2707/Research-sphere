import { integerAxis } from '../chartScale';

describe('integerAxis', () => {
  it('never repeats a tick for small counts', () => {
    expect(integerAxis(2)).toEqual({ top: 4, ticks: [4, 3, 2, 1, 0] });
    expect(integerAxis(1).ticks).toEqual([4, 3, 2, 1, 0]);
    expect(integerAxis(0).ticks).toEqual([4, 3, 2, 1, 0]);
  });

  it('rounds the top up to a multiple of the step count', () => {
    expect(integerAxis(37)).toEqual({ top: 40, ticks: [40, 30, 20, 10, 0] });
    expect(integerAxis(40).top).toBe(40);
  });
});
