import { describe, it, expect } from 'bun:test';
import { fromInterval, fromTestFunction } from '../src/functions';
import { narrow, narrowWithCutter } from '../src/narrowing';
import { makeRational, width } from '../src/ops';
import { RationalInterval, Rational } from '../src/ratmath';

// Helper function for tests
const makeOracle = (interval: RationalInterval) => {
  const oracle = fromTestFunction((_i: RationalInterval) => true);
  (oracle as any).yes = interval;
  return oracle;
};

describe('narrowing', () => {
  it('narrow reduces interval width', () => {
    const o = makeOracle(new RationalInterval(new Rational(0), new Rational(2)));
    const out = narrow(o, makeRational(1));
    expect(width(out)).toBeLessThanOrEqual(1);
    // Use equals() for interval comparison
    expect(o.yes.equals(out)).toBe(true);
  });

  it('narrow reduces width while consulting oracle', () => {
    const half = new Rational(1, 2);
    const o = makeOracle(new RationalInterval(new Rational(0), new Rational(10)));
    const out = narrow(o, half);
    expect(width(out)).toBeLessThanOrEqual(0.5);
  });

  it('narrow uses custom narrowing function if provided', () => {
    const o = makeOracle(new RationalInterval(new Rational(0), new Rational(10)));
    const targetInterval = new RationalInterval(new Rational(1), new Rational(1));
    o.narrowing = (precision: Rational) => {
      return targetInterval;
    };
    const out = narrow(o, makeRational(1));
    expect(out).toBe(targetInterval);
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
