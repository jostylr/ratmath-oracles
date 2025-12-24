import { describe, it, expect } from 'bun:test';
import { fromInterval, fromTestFunction, fromRational } from '../src/functions';
import { narrow, narrowWithCutter } from '../src/narrowing';
import { makeRational, width, midpoint } from '../src/ops';
import { RationalInterval, Rational } from '../src/ratmath';

// Helper function for tests
const makeOracle = (interval: RationalInterval) => {
  const oracle = fromTestFunction((_i: RationalInterval) => true);
  (oracle as any).yes = interval;
  return oracle;
};

describe('narrowing', () => {
  it('narrow reduces interval width', () => {
    const o = fromRational(new Rational(1, 2));
    o.yes = new RationalInterval(new Rational(0), new Rational(2));
    const out = narrow(o, makeRational(1));
    expect(width(out)).toBeLessThanOrEqual(1);
    expect(out.containsValue(new Rational(1, 2))).toBe(true);
  });

  it('narrow reduces width while consulting oracle', () => {
    const half = new Rational(1, 2);
    // Use an exact oracle (fromRational) to ensure bisection can distinguish sides
    const o = fromRational(new Rational(1, 4));
    o.yes = new RationalInterval(new Rational(0), new Rational(10));
    const out = narrow(o, half);
    expect(width(out)).toBeLessThanOrEqual(0.5);
    expect(out.containsValue(new Rational(1, 4))).toBe(true);
  });

  it('narrow uses custom narrowing function loop', () => {
    const o = makeOracle(new RationalInterval(new Rational(0), new Rational(10)));
    // A single step narrowing function that halves the interval each call
    o.narrowing = (current: RationalInterval, _precision: Rational) => {
      const m = midpoint(current);
      return new RationalInterval(current.low, m);
    };
    const out = narrow(o, makeRational(1));
    expect(width(out)).toBeLessThanOrEqual(1);
    expect(o.yes.equals(out)).toBe(true);
  });

  it('narrowWithCutter narrows using a custom cut function', () => {
    const containsAny = (_i: RationalInterval) => true;
    const o = fromTestFunction(containsAny);
    (o as any).yes = new RationalInterval(makeRational(0), makeRational(20));
    const quarter = new Rational(1).divide(new Rational(4));
    const out = narrowWithCutter(
      o,
      quarter as any,
      (i) => i.low.add(i.high).divide(new Rational(2))
    );
    expect(width(out)).toBeLessThanOrEqual(0.25);
  });
});
