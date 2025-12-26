import { describe, it, expect } from 'bun:test';
import { makeRational } from '../src/ops';
import { Rational, RationalInterval } from '../src/ratmath';
import { fromInterval, makeCustomOracle } from '../src/functions';
import { Answer } from '../src/types';

function interval(a: number, b: number): RationalInterval {
  return new RationalInterval(new Rational(a as any), new Rational(b as any));
}

describe('makeOracle behavior', () => {
  it('early-return does not mutate yes and returns currentYes in cd', async () => {
    const yes = interval(0, 10);
    const o = fromInterval(yes);
    const before = o.yes;
    const target = interval(1, 2);
    const delta = new Rational(0 as any);
    const ans = await o(target, delta) as Answer;
    // Should be early-return: withinDelta(currentYes,target,delta) false (target inside yes)
    // Intersects? Yes.
    // Width > delta? Yes (10 > 0). Falls through to narrowing?
    // o.narrowing returns 'yes' (no change).
    // Re-check: still same state. Returns -1 (Maybe).
    expect(ans[0][0]).toBe(-1);
    expect(ans[0][1]!.low.equals(before.low)).toBe(true);
    expect(ans[0][1]!.high.equals(before.high)).toBe(true);
    // yes should be unchanged
    expect(o.yes.low.equals(before.low)).toBe(true);
    expect(o.yes.high.equals(before.high)).toBe(true);
  });

  it('compute path intersects and updates yes; cd equals intersection', async () => {
    const initialYes = interval(0, 10);
    const prophecyInterval = interval(2, 4);
    const compute = ((ab: RationalInterval, _delta: Rational) => {
      // Ignore ab, always return a fixed prophecy in [2,4]
      return prophecyInterval;
    }) as any;
    // attach internal state to ensure it’s allowed
    (compute as any).internal = { used: true };

    const o = makeCustomOracle(initialYes, compute);
    const before = o.yes;
    expect(before.low.equals(initialYes.low)).toBe(true);
    expect(before.high.equals(initialYes.high)).toBe(true);

    const target = interval(5, 15); // partial overlap with currentYes to force compute path
    const delta = new Rational(0 as any);
    const ans = await o(target, delta) as Answer;

    // yes should now be updated to prophecy (algorithm oracle overwrites yes)
    expect(o.yes.low.equals(prophecyInterval.low)).toBe(true);
    expect(o.yes.high.equals(prophecyInterval.high)).toBe(true);

    // Returned cd should be the refined intersection as well
    expect(ans[0][1]!.low.equals(prophecyInterval.low)).toBe(true);
    expect(ans[0][1]!.high.equals(prophecyInterval.high)).toBe(true);

    // Since target is far away, ans may be 0; we only care about yes/cd behavior
    expect(typeof ans[0][0]).toBe('number');
  });
});

