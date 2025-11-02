import { describe, it, expect } from 'bun:test';
import { makeRational } from '../src/ops';
import { Rational, RationalInterval } from '../src/ratmath';
import { fromInterval, makeCustomOracle } from '../src/functions';

function interval(a: number, b: number): RationalInterval {
  return new RationalInterval(new Rational(a as any), new Rational(b as any));
}

describe('makeOracle behavior', () => {
  it('early-return does not mutate yes and returns currentYes in cd', () => {
    const yes = interval(0, 10);
    const o = fromInterval(yes);
    const before = o.yes;
    const target = interval(1, 2);
    const delta = new Rational(0 as any);
    const ans = o(target, delta);
    // Should be early-return: withinDelta(currentYes,target,delta) true and intersects
    expect(ans.ans).toBe(1);
    expect(ans.cd.low.equals(before.low)).toBe(true);
    expect(ans.cd.high.equals(before.high)).toBe(true);
    // yes should be unchanged
    expect(o.yes.low.equals(before.low)).toBe(true);
    expect(o.yes.high.equals(before.high)).toBe(true);
  });

  it('compute path intersects and updates yes; cd equals intersection', () => {
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

    const target = interval(20, 30); // disjoint from currentYes to force compute path
    const delta = new Rational(0 as any);
    const ans = o(target, delta);

    // yes should now be updated to intersection of prophecy and previous yes, which is [2,4]
    expect(o.yes.low.equals(prophecyInterval.low)).toBe(true);
    expect(o.yes.high.equals(prophecyInterval.high)).toBe(true);

    // Returned cd should be the refined intersection as well
    expect(ans.cd.low.equals(prophecyInterval.low)).toBe(true);
    expect(ans.cd.high.equals(prophecyInterval.high)).toBe(true);

    // Since target is far away, ans may be 0; we only care about yes/cd behavior
    expect(typeof ans.ans).toBe('number');
  });
});

