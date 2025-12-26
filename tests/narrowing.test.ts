import { describe, it, expect } from 'bun:test';
import { fromInterval, fromTestFunction, fromRational } from '../src/functions';
import { narrow, narrowWithCutter } from '../src/narrowing';
import { makeRational, width, midpoint, toNumber } from '../src/ops';
import { RationalInterval, Rational } from '../src/ratmath';

// Helper function for tests
const makeOracle = (interval: RationalInterval) => {
  // Use a dummy test function; this creates a test oracle which has default narrowing.
  // We override narrowing below in the test anyway.
  const oracle = fromTestFunction((_i: RationalInterval) => true);
  (oracle as any).yes = interval;
  return oracle;
};

describe('narrowing', () => {
  it('narrow reduces interval width', async () => {
    const o = fromRational(new Rational(1, 2));
    o.yes = new RationalInterval(new Rational(0), new Rational(2));
    const out = await narrow(o, makeRational(1));
    expect(width(out)).toBeLessThanOrEqual(1);
    expect(out.containsValue(new Rational(1, 2))).toBe(true);
  });

  it('narrow reduces width while consulting oracle', async () => {
    const half = new Rational(1, 2);
    // Use an exact oracle (fromRational) to ensure bisection can distinguish sides
    const o = fromRational(new Rational(1, 4));
    o.yes = new RationalInterval(new Rational(0), new Rational(10));
    const out = await narrow(o, half);
    expect(width(out)).toBeLessThanOrEqual(0.5);
    expect(out.containsValue(new Rational(1, 4))).toBe(true);
  });

  it('narrow uses custom narrowing function loop', async () => {
    const o = makeOracle(new RationalInterval(new Rational(0), new Rational(10)));
    // A single step narrowing function that halves the interval each call
    o.narrowing = async (current: RationalInterval, precision: Rational) => {
      let c = current;
      while (width(c) > toNumber(precision)) {
        const m = midpoint(c);
        c = new RationalInterval(c.low, m);
      }
      return c;
    };
    // We await narrow
    const out = await narrow(o, makeRational(1));
    expect(width(out)).toBeLessThanOrEqual(1);
    expect(o.yes.equals(out)).toBe(true);
  });

  it('narrowWithCutter narrows using a custom cut function', async () => {
    const containsAny = (_i: RationalInterval) => true;
    const o = fromTestFunction(containsAny);
    (o as any).yes = new RationalInterval(makeRational(0), makeRational(20));
    const quarter = new Rational(1).divide(new Rational(4));
    const out = await narrowWithCutter(
      o,
      quarter as any,
      (i) => i.low.add(i.high).divide(new Rational(2))
    );
    expect(width(out)).toBeLessThanOrEqual(0.25);
  });
});
