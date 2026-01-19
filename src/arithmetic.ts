import { type Oracle, type RationalInterval, isOracle, isRational, isRationalInterval } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { addIntervals, containsZero, divIntervals, mulIntervals, subIntervals, getMagnitude, getMinMagnitude } from './ops';
import { getLogger } from './logger';
import { narrow } from './narrowing';
import { makeOracle, fromRational, fromInterval } from './functions';

export type OracleLike = Oracle | Rational | RationalInterval | number | bigint | string;

function toRational(x: any): Rational {
  if (x instanceof Rational) return x;
  if (typeof x === 'number') return new Rational(x);
  if (typeof x === 'bigint') return new Rational(x);
  if (typeof x === 'string') return new Rational(x as any); // Rational accepts strings at runtime
  // Handle Integer type from parser (check constructor name for cross-module compatibility)
  if (x && x.constructor && x.constructor.name === 'Integer') {
    const val = x.value;
    if (typeof val === 'bigint') {
      return new Rational(val);
    }
  }
  // Handle objects with value property (like Integer)
  if (x && typeof x.value === 'bigint') {
    return new Rational(x.value);
  }
  if (x && typeof x.numerator !== 'undefined' && typeof x.denominator !== 'undefined') {
    return new Rational(x.numerator, x.denominator);
  }
  throw new Error(`Cannot convert to Rational: ${x}`);
}

export function toOracle(x: OracleLike): Oracle {
  if (isOracle(x)) return x;
  if (isRational(x)) return fromRational(x);
  if (isRationalInterval(x)) return fromInterval(x);
  if (typeof x === 'number' || typeof x === 'bigint' || typeof x === 'string') {
    return fromRational(toRational(x));
  }
  // Handle Integer type from parser
  if (x && (x as any).constructor && (x as any).constructor.name === 'Integer') {
    return fromRational(toRational(x));
  }
  if (x && typeof (x as any).value === 'bigint') {
    return fromRational(toRational(x));
  }
  throw new Error(`Cannot convert to Oracle: ${x}`);
}

export function negate(a: OracleLike): Oracle {
  a = toOracle(a);
  const yes = (a.yes as RMInterval).negate();
  return makeOracle(yes, async (target: RationalInterval, delta: Rational) => {
    // Refine operand to half delta
    await narrow(a, delta);
    const ans = a.yes.negate();
    return ans;
  });
}

export function add(a: OracleLike, b: OracleLike): Oracle {
  a = toOracle(a);
  b = toOracle(b);
  const yes = addIntervals(a.yes, b.yes);
  return makeOracle(yes, async (_target, delta) => {
    // Refine both operands to half the delta (conservative)
    const subDelta = delta.divide(new Rational(2));
    await Promise.all([
      narrow(a, subDelta),
      narrow(b, subDelta)
    ]);
    return addIntervals(a.yes, b.yes);
  });
}

export function subtract(a: OracleLike, b: OracleLike): Oracle {
  a = toOracle(a);
  b = toOracle(b);
  const yes = subIntervals(a.yes, b.yes);
  return makeOracle(yes, async (_target, delta) => {
    const subDelta = delta.divide(new Rational(2));
    await Promise.all([
      narrow(a, subDelta),
      narrow(b, subDelta)
    ]);
    return subIntervals(a.yes, b.yes);
  });
}

export function multiply(a: OracleLike, b: OracleLike): Oracle {
  a = toOracle(a);
  b = toOracle(b);
  const yes = mulIntervals(a.yes, b.yes);
  return makeOracle(yes, async (_target, delta) => {
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

    await Promise.all([
      narrow(a, subDelta),
      narrow(b, subDelta)
    ]);
    return mulIntervals(a.yes, b.yes);
  });
}

export function divide(numer: OracleLike, denom: OracleLike): Oracle {
  numer = toOracle(numer);
  denom = toOracle(denom);
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

  return makeOracle(yes, async (_ab, delta) => {
    // Division error propagation: |Δ(n/d)| ≈ |Δn/d| + |nΔd/d^2| = (ε/|d|) * (1 + |n/d|) = ε(|d|+|n|)/d^2
    // To get |Δ(n/d)| < delta, we need ε < delta * d^2 / (|d| + |n|)
    const nMag = getMagnitude(numer.yes);
    let dMin = getMinMagnitude(denom.yes);

    // Optimization: If dMin is small effectively amplifying subDelta requirements,
    // and the denominator interval is wide enough to be refined, try to refine it *first*
    // using the target output delta (or a multiple of it) to see if we can get a better dMin.
    // 
    // This is "speculative refinement" of the denominator.
    // If dYes is already narrower than delta, narrow does nothing.
    // Ideally we want to refine it enough to separate from zero if possible, or just reduce width.
    if (dMin.lessThan(new Rational(1))) {
      // await speculative narrowing
      const refinedDenom = await narrow(denom, delta);
      denom.yes = refinedDenom;
      // Re-read dYes and dMin after narrowion
      dMin = getMinMagnitude(denom.yes);
    }

    let subDelta: Rational;
    if (dMin.equals(Rational.zero)) {
      // If dMin is zero, we rely on the heuristic or throw if it stays zero
      subDelta = delta.divide(new Rational(4));
    } else {
      const dMinSq = dMin.multiply(dMin);
      const denominatorForDelta = dMin.add(nMag);
      subDelta = delta.multiply(dMinSq).divide(denominatorForDelta);
    }

    await Promise.all([
      narrow(numer, subDelta),
      narrow(denom, subDelta)
    ]);

    const dNow = denom.yes;
    if (containsZero(dNow)) {
      // If it still contains zero after narrowion, we might have a problem
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
