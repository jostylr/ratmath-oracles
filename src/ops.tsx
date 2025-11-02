import { Rational, RationalInterval } from './ratmath';

export const ZERO: Rational = Rational.zero;

export function makeRational(n: number | string | bigint): Rational {
  return new Rational(n as any);
}

export function toNumber(q: Rational): number {
  return Number(q.numerator) / Number(q.denominator);
}

export function normalizeInterval(i: RationalInterval): RationalInterval {
  // Instances are always normalized in constructor; create a new one to enforce ordering
  return i instanceof RationalInterval ? i : new RationalInterval((i as any).low, (i as any).high);
}

export function width(i: RationalInterval): number {
  const diff = i.high.subtract(i.low);
  return Number(diff.numerator) / Number(diff.denominator);
}

export function containsZero(i: RationalInterval): boolean {
  return i.containsZero();
}

export function expand(i: RationalInterval, delta: Rational): RationalInterval {
  const d = delta instanceof Rational ? delta : new Rational(delta as any);
  return new RationalInterval(i.low.subtract(d), i.high.add(d));
}

export function intersect(a: RationalInterval, b: RationalInterval): RationalInterval | null {
  return a.intersection(b);
}

export function withinDelta(prophecy: RationalInterval, target: RationalInterval, delta: Rational) {
  const expanded = expand(target, delta);
  return prophecy.intersection(expanded) !== null;
}

export function addIntervals(a: RationalInterval, b: RationalInterval): RationalInterval {
  return a.add(b) as RationalInterval;
}

export function subIntervals(a: RationalInterval, b: RationalInterval): RationalInterval {
  return a.subtract(b) as RationalInterval;
}

export function mulIntervals(a: RationalInterval, b: RationalInterval): RationalInterval {
  return a.multiply(b) as RationalInterval;
}

export function divIntervals(a: RationalInterval, b: RationalInterval): RationalInterval {
  return a.divide(b) as RationalInterval; // will throw if b contains zero
}

export function midpoint(i: RationalInterval): Rational {
  return i.low.add(i.high).divide(new Rational(2));
}
