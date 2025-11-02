import { describe, it, expect, mock } from 'bun:test';
import { add, subtract, multiply, divide } from '../src/arithmetic';
import { fromRational, fromInterval } from '../src/functions';
import { makeRational, toNumber } from '../src/ops';
import { RationalInterval } from '../src/ratmath';
import { setLogger } from '../src/logger';

describe('arithmetic oracles', () => {
  it('add/subtract/multiply combine yes intervals', () => {
    const a = fromInterval(new RationalInterval(makeRational(1), makeRational(2)) as any);
    const b = fromInterval(new RationalInterval(makeRational(3), makeRational(4)) as any);
    const s = add(a, b);
    expect(toNumber(s.yes.low)).toBe(4);
    expect(toNumber(s.yes.high)).toBe(6);
    const d = subtract(b, a);
    expect(toNumber(d.yes.low)).toBe(1);
    expect(toNumber(d.yes.high)).toBe(3);
    const m = multiply(a, b);
    expect(toNumber(m.yes.low)).toBe(3);
    expect(toNumber(m.yes.high)).toBe(8);
  });

  it('division warns when denom yes contains zero and throws for known zero', () => {
    const warn = mock(() => {});
    setLogger({ warn });
    const numer = fromInterval(new RationalInterval(makeRational(1), makeRational(2)) as any);
    // denom spans zero -> warn
    const denomWarn = fromInterval(new RationalInterval(makeRational(-1), makeRational(1)) as any);
    const d1 = divide(numer, denomWarn);
    expect(warn).toHaveBeenCalled();

    // denom known zero -> throw
    const denomZero = fromInterval(new RationalInterval(makeRational(0), makeRational(0)) as any);
    expect(() => divide(numer, denomZero)).toThrowError();
  });
});
