import { type Oracle, type RationalInterval } from './types';
import { RationalInterval as RMInterval, Rational } from './ratmath';
import { midpoint, width } from './ops';

export function bisect(oracle: Oracle, precision: Rational): RationalInterval {
  let current = oracle.yes;
  const targetWidth = typeof (precision as any) === 'number'
    ? Math.abs(precision as unknown as number)
    : Math.abs(Number((precision as unknown as Rational).numerator) / Number((precision as unknown as Rational).denominator));
  let guard = 0;
  while (width(current) > targetWidth && guard++ < 10_000) {
    const m = midpoint(current);
    const left: RationalInterval = new RMInterval(current.low, m);
    const right: RationalInterval = new RMInterval(m, current.high);
    // Ask the oracle which side works
    const leftAns = oracle(left, precision);
    // Handle both Answer and LegacyAnswer formats
    const answerValue = Array.isArray(leftAns) ? leftAns[0][0] : leftAns.ans;
    if (answerValue === 1) {
      current = left;
    } else {
      current = right;
    }
  }
  return current;
}

export function refine(oracle: Oracle, precision: Rational): Oracle {
  const refinedYes = bisect(oracle, precision);
  const fn = ((ab: RationalInterval, delta: Rational) => {
    // Delegate to original oracle; yes interval now refined
    return oracle(ab, delta);
  }) as Oracle;
  fn.yes = refinedYes;
  return fn;
}

/**
 * Narrow using a custom cut function. The cutter picks a rational value inside the current interval,
 * which is then used to split the interval; the oracle is asked to choose the side that works.
 */
export function narrowWithCutter(
  oracle: Oracle,
  precision: Rational,
  cutter: (i: RationalInterval) => Rational
): RationalInterval {
  let current = oracle.yes;
  const targetWidth = typeof (precision as any) === 'number'
    ? Math.abs(precision as unknown as number)
    : Math.abs(Number((precision as unknown as Rational).numerator) / Number((precision as unknown as Rational).denominator));
  let guard = 0;
  while (width(current) > targetWidth && guard++ < 10_000) {
    const cut = cutter(current);
    // Ensure cut is inside [low, high]; if not, clamp to bounds
    const safeCut = (cut.lessThan(current.low) ? current.low : (cut.greaterThan(current.high) ? current.high : cut));
    const left: RationalInterval = new RMInterval(current.low, safeCut);
    const right: RationalInterval = new RMInterval(safeCut, current.high);
    const leftAns = oracle(left, precision);
    // Handle both Answer and LegacyAnswer formats
    const answerValue = Array.isArray(leftAns) ? leftAns[0][0] : leftAns.ans;
    if (answerValue === 1) {
      current = left;
    } else {
      current = right;
    }
  }
  return current;
}

/**
 * Refine an oracle's yes-interval using a custom cutter strategy.
 */
export function refineWithCutter(
  oracle: Oracle,
  precision: Rational,
  cutter: (i: RationalInterval) => Rational
): Oracle {
  const refinedYes = narrowWithCutter(oracle, precision, cutter);
  const fn = ((ab: RationalInterval, delta: Rational) => {
    return oracle(ab, delta);
  }) as Oracle;
  fn.yes = refinedYes;
  return fn;
}
