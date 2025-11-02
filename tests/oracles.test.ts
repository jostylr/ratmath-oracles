import { describe, it, expect } from 'bun:test';
import { fromRational, fromInterval } from '../src/functions';
import { makeRational, toNumber } from '../src/ops';
import { RationalInterval } from '../src/ratmath';

describe('basic oracles', () => {
  it('fromRational sets yes to q:q', () => {
    const q = makeRational(3);
    const o = fromRational(q);
    expect(toNumber(o.yes.low)).toBe(3);
    expect(toNumber(o.yes.high)).toBe(3);
  });

  it('fromInterval normalizes yes', () => {
    const o = fromInterval(new RationalInterval(makeRational(5), makeRational(1)) as any);
    expect(toNumber(o.yes.low)).toBe(1);
    expect(toNumber(o.yes.high)).toBe(5);
  });
});
