import { type Oracle, type RationalInterval, type Answer } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { addIntervals, containsZero, divIntervals, makeRational, mulIntervals, subIntervals, toNumber, width, withinDelta, intersect, expand, getMagnitude, getMinMagnitude } from './ops';
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
    // Multiplication error propagation: |Δ(ab)| ≈ |a|Δb + |b|Δa
    // If we set Δa = Δb = ε, then |Δ(ab)| ≈ (|a| + |b|)ε
    // Using M = max(|a|, |b|), |Δ(ab)| ≤ 2Mε
    // To get |Δ(ab)| < delta, we need ε < delta / (2M)
    const m1 = getMagnitude(a.yes);
    const m2 = getMagnitude(b.yes);
    const M = m1.greaterThan(m2) ? m1 : m2;

    // Fallback if M is very small to avoid large subDelta
    const subDelta = M.lessThan(new Rational(1, 2))
      ? delta
      : delta.divide(M.multiply(new Rational(2)));

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
    // Division error propagation: |Δ(n/d)| ≈ |Δn/d| + |nΔd/d^2| = (ε/|d|) * (1 + |n/d|) = ε(|d|+|n|)/d^2
    // To get |Δ(n/d)| < delta, we need ε < delta * d^2 / (|d| + |n|)
    const nMag = getMagnitude(numer.yes);
    const dMin = getMinMagnitude(denom.yes);

    let subDelta: Rational;
    if (dMin.equals(Rational.zero)) {
      // If dMin is zero, we rely on the heuristic or throw if it stays zero
      subDelta = delta.divide(new Rational(4));
    } else {
      const dMinSq = dMin.multiply(dMin);
      const denominatorForDelta = dMin.add(nMag);
      subDelta = delta.multiply(dMinSq).divide(denominatorForDelta);
    }

    bisect(numer, subDelta);
    bisect(denom, subDelta);

    const dNow = denom.yes;
    if (containsZero(dNow)) {
      // If it still contains zero after bisection, we might have a problem
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
