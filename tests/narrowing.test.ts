import { describe, it, expect } from 'bun:test';
import { fromInterval, fromTestFunction } from '../src/functions';
import { bisect, narrowWithCutter } from '../src/narrowing';
import { makeRational, width } from '../src/ops';
import { RationalInterval, Rational } from '../src/ratmath';

describe('narrowing', () => {
  it('bisect reduces interval width', () => {
    const o = fromInterval(new RationalInterval(makeRational(0), makeRational(10)) as any);
    const out = bisect(o, makeRational(1));
    expect(width(out)).toBeLessThanOrEqual(1);
  });

  it('bisect reduces width while consulting oracle', () => {
    const containsAny = (_i: RationalInterval) => true;
    const o = fromTestFunction(containsAny);
    // start search interval
    (o as any).yes = new RationalInterval(makeRational(0), makeRational(10));
    const half = new Rational(1).divide(new Rational(2));
    const out = bisect(o, half as any);
    expect(width(out)).toBeLessThanOrEqual(0.5);
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
