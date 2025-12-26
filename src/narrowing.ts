import { type Oracle, type RationalInterval } from './types';
import { RationalInterval as RMInterval, Rational } from './ratmath';
import { midpoint, widthRational } from './ops';

export async function narrow(oracle: Oracle, precision: Rational): Promise<RationalInterval> {
  if (oracle.narrowing) {
    const next = await oracle.narrowing(oracle.yes, precision);
    oracle.yes = next;
    return next;
  }
  throw new Error("Oracle does not implement narrowing method. All oracles must provide a narrowing strategy.");
}

export function refine(oracle: Oracle, precision: Rational): Oracle {
  // Refine cannot be synchronous if narrow is async. 
  // However, refine returns an Oracle.
  // We can't immediately update 'yes' synchronously. 
  // But we can return an oracle that awaits the narrowing internally?
  // Actually, 'refine' typically returns a *new* oracle that is 'better'.
  // If we want 'refine' to return an Oracle immediately, we can't await narrow inside it.
  // BUT the user plan didn't explicitly mention 'refine'.
  // 'refine' updates 'yes'.
  // Let's make refineAsync.
  // Or just make refine return Promise<Oracle>?
  // The 'refine' function in the original code seems to return a wrapper that delegates.
  // But it calls 'narrow(oracle, precision)' *before* returning the wrapper.
  // So 'refine' must be async.
  throw new Error("refine must be async via refineAsync");
}
// Replacing refine with refineAsync below in valid TS

export async function refineAsync(oracle: Oracle, precision: Rational): Promise<Oracle> {
  const refinedYes = await narrow(oracle, precision);
  const fn = (async (ab: RationalInterval, delta: Rational) => {
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
export async function narrowWithCutter(
  oracle: Oracle,
  precision: Rational,
  cutter: (i: RationalInterval) => Rational
): Promise<RationalInterval> {
  let current = oracle.yes;
  const targetWidth = precision.abs();
  let guard = 0;
  while (widthRational(current).greaterThan(targetWidth) && guard++ < 10_000) {
    const cut = cutter(current);
    // Ensure cut is inside [low, high]; if not, clamp to bounds
    const safeCut = (cut.lessThan(current.low) ? current.low : (cut.greaterThan(current.high) ? current.high : cut));
    const left: RationalInterval = new RMInterval(current.low, safeCut);
    const leftAns = await oracle(left, precision);
    // Answer is now always [[status, interval], extra]
    const answerValue = leftAns[0][0];
    if (answerValue === 1) {
      current = left;
    } else if (answerValue === 0) {
      current = new RMInterval(safeCut, current.high);
    } else {
      // answerValue === -1 (Maybe)
      break;
    }
  }
  oracle.yes = current;
  return current;
}

/**
 * Refine an oracle's yes-interval using a custom cutter strategy.
 */
export async function refineWithCutter(
  oracle: Oracle,
  precision: Rational,
  cutter: (i: RationalInterval) => Rational
): Promise<Oracle> {
  const refinedYes = await narrowWithCutter(oracle, precision, cutter);
  const fn = (async (ab: RationalInterval, delta: Rational) => {
    return oracle(ab, delta);
  }) as Oracle;
  fn.yes = refinedYes;
  return fn;
}
