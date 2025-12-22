import { type Oracle, type RationalInterval, type Answer } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { addIntervals, containsZero, divIntervals, makeRational, mulIntervals, subIntervals, toNumber, width, withinDelta, intersect, expand } from './ops';
import { getLogger } from './logger';
import { bisect } from './narrowing';

function makeOracle(
  yes: RationalInterval,
  compute: (ab: RationalInterval, delta: Rational) => RationalInterval
): Oracle {
  const fn = ((ab: RationalInterval, delta: Rational): Answer => {
    const target = ab;
    const currentYes = (fn as Oracle).yes;

    // Check definitive cases against target expanded by delta
    const expandedTarget = expand(target, delta);
    const interYT = intersect(currentYes, expandedTarget);

    if (!interYT) {
      // Disjoint: definitely No
      return [[0, currentYes], null];
    }

    // If currentYes is fully contained in expandedTarget, definitely Yes
    // interYT is the intersection. If interYT == currentYes, then currentYes is subset.
    // RationalInterval.equals checks value equality.
    if (interYT.low.equals(currentYes.low) && interYT.high.equals(currentYes.high)) {
      return [[1, currentYes], null];
    }

    // Partial overlap: ambiguous. Force refinement.
    const prophecy = compute(target, delta);
    const interYY = intersect(prophecy, currentYes);
    if (interYY) {
      const refined = interYY;
      (fn as Oracle).yes = refined;
      const interWithTarget = intersect(refined, target);
      const ans = !!interWithTarget && withinDelta(refined, target, delta);
      return [[ans ? 1 : 0, refined], null];
    }
    return [[0, currentYes], null];
  }) as Oracle;
  fn.yes = yes;
  return fn;
}

export function negate(a: Oracle): Oracle {
  const yes = (a.yes as RMInterval).negate();
  return makeOracle(yes, (target: RationalInterval, delta: Rational) => {
    // Refine operand to half delta
    bisect(a, delta);
    const ans = a.yes.negate();
    return ans;
  });
}

export function add(a: Oracle, b: Oracle): Oracle {
  const yes = addIntervals(a.yes, b.yes);
  return makeOracle(yes, (_target, delta) => {
    // Refine both operands to half the delta (conservative)
    const subDelta = delta.divide(new Rational(2));
    bisect(a, subDelta);
    bisect(b, subDelta);
    return addIntervals(a.yes, b.yes);
  });
}

export function subtract(a: Oracle, b: Oracle): Oracle {
  const yes = subIntervals(a.yes, b.yes);
  return makeOracle(yes, (_target, delta) => {
    const subDelta = delta.divide(new Rational(2));
    bisect(a, subDelta);
    bisect(b, subDelta);
    return subIntervals(a.yes, b.yes);
  });
}

export function multiply(a: Oracle, b: Oracle): Oracle {
  const yes = mulIntervals(a.yes, b.yes);
  return makeOracle(yes, (_target, delta) => {
    // Multiplication error propagation is more complex, but using a smaller delta usually works.
    // For rigorous arithmetic, we'd calculate needed precision based on magnitudes.
    // Here we use a heuristic of delta/4 for safety given magnitudes can amplify error.
    const subDelta = delta.divide(new Rational(4));
    bisect(a, subDelta);
    bisect(b, subDelta);
    return mulIntervals(a.yes, b.yes);
  });
}

export function divide(numer: Oracle, denom: Oracle): Oracle {
  const dYes = denom.yes;
  if (dYes.low.equals(Rational.zero) && dYes.high.equals(Rational.zero)) {
    throw new Error('Division by zero: denominator known to be zero');
  }
  if (containsZero(dYes)) {
    getLogger().warn('Division setup warning: denominator yes-interval contains zero');
  }
  // For initial yes, attempt to contract denom away from zero if needed (logic preserved from original)
  let safeDen = dYes;
  if (containsZero(safeDen)) {
    const eps = new Rational(1, 1_000_000_000);
    const lo = dYes.low;
    const hi = dYes.high;
    if (hi.lessThanOrEqual(Rational.zero)) {
      safeDen = new RMInterval(lo, hi.subtract(eps));
    } else if (lo.greaterThanOrEqual(Rational.zero)) {
      safeDen = new RMInterval(lo.add(eps), hi);
    } else {
      const absLo = lo.abs();
      const absHi = hi.abs();
      if (absLo.greaterThan(absHi)) {
        safeDen = new RMInterval(lo, new Rational(-1).multiply(eps));
      } else {
        safeDen = new RMInterval(eps, hi);
      }
    }
  }
  const yes = divIntervals(numer.yes, safeDen);

  return makeOracle(yes, (_ab, delta) => {
    const subDelta = delta.divide(new Rational(4)); // Heuristic
    bisect(numer, subDelta);
    bisect(denom, subDelta);

    const dNow = denom.yes;
    if (containsZero(dNow)) {
      const d = subDelta;
      const nlo = dNow.low.add(d);
      const nhi = dNow.high.subtract(d);
      const spansZero = nlo.lessThanOrEqual(Rational.zero) && nhi.greaterThanOrEqual(Rational.zero);
      if (spansZero) {
        throw new Error('Division by zero under requested delta: denominator interval still spans zero');
      }
    }
    return divIntervals(numer.yes, denom.yes);
  });
}
