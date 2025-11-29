import { type Oracle, type RationalInterval, type Answer } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { addIntervals, containsZero, divIntervals, makeRational, mulIntervals, subIntervals, toNumber, width, withinDelta, intersect } from './ops';
import { getLogger } from './logger';

function makeOracle(
  yes: RationalInterval,
  compute: (ab: RationalInterval, delta: Rational) => RationalInterval
): Oracle {
  const fn = ((ab: RationalInterval, delta: Rational): Answer => {
    const target = ab;
    const currentYes = (fn as Oracle).yes;
    if (withinDelta(currentYes, target, delta)) {
      const interYT = intersect(currentYes, target);
      if (interYT) {
        return { ans: 1, cd: currentYes };
      }
      return { ans: 0, cd: currentYes };
    }
    const prophecy = compute(target, delta);
    const interYY = intersect(prophecy, currentYes);
    if (interYY) {
      const refined = interYY;
      (fn as Oracle).yes = refined;
      const interWithTarget = intersect(refined, target);
      const ans = !!interWithTarget && withinDelta(refined, target, delta);
      return { ans: ans ? 1 : 0, cd: refined };
    }
    return { ans: 0, cd: currentYes };
  }) as Oracle;
  fn.yes = yes;
  return fn;
}

export function negate(a: Oracle): Oracle {
  const yes = (a.yes as RMInterval).negate();
  return makeOracle(yes, (target: RationalInterval, delta: Rational) => {
    const ans = a(target.negate(), delta);
    return (ans as Answer).cd.negate();
  });
}

export function add(a: Oracle, b: Oracle): Oracle {
  const yes = addIntervals(a.yes, b.yes);
  return makeOracle(yes, () => yes);
}

export function subtract(a: Oracle, b: Oracle): Oracle {
  const yes = subIntervals(a.yes, b.yes);
  return makeOracle(yes, () => yes);
}

export function multiply(a: Oracle, b: Oracle): Oracle {
  const yes = mulIntervals(a.yes, b.yes);
  return makeOracle(yes, () => yes);
}

export function divide(numer: Oracle, denom: Oracle): Oracle {
  const dYes = denom.yes;
  if (dYes.low.equals(Rational.zero) && dYes.high.equals(Rational.zero)) {
    throw new Error('Division by zero: denominator known to be zero');
  }
  if (containsZero(dYes)) {
    getLogger().warn('Division setup warning: denominator yes-interval contains zero');
  }
  // For initial yes, attempt to contract denom away from zero if needed
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
      // spans zero; pick side with larger magnitude window
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
    const dNow = denom.yes;
    if (containsZero(dNow)) {
      const d = delta instanceof Rational ? delta : new Rational(delta as any);
      const nlo = dNow.low.add(d);
      const nhi = dNow.high.subtract(d);
      const spansZero = nlo.lessThanOrEqual(Rational.zero) && nhi.greaterThanOrEqual(Rational.zero);
      if (spansZero) {
        throw new Error('Division by zero under requested delta: denominator interval still spans zero');
      }
    }
    return yes;
  });
}
