import { type Oracle, type RationalInterval } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { makeAlgorithmOracle } from './functions';
import { narrow } from './narrowing';

export type CFTerm = bigint;

function floorRational(r: Rational): number {
  const n = r.numerator;
  const d = r.denominator;
  if (d === 1n) return Number(n);
  if (n >= 0n) {
    return Number(n / d);
  } else {
    return Number((n - d + 1n) / d);
  }
}

export interface ContinuedFractionStream {
  next(): CFTerm | undefined;
  peek(): CFTerm | undefined;
  clone(): ContinuedFractionStream;
}

export function makeCFStream(generator: () => Generator<CFTerm, void, unknown>): ContinuedFractionStream {
  const terms: CFTerm[] = [];
  let gen = generator();
  let done = false;

  function ensureTerms(n: number): void {
    while (terms.length < n && !done) {
      const result = gen.next();
      if (result.done) {
        done = true;
      } else {
        terms.push(result.value);
      }
    }
  }

  let index = 0;

  return {
    next(): CFTerm | undefined {
      ensureTerms(index + 1);
      if (index >= terms.length) return undefined;
      return terms[index++];
    },
    peek(): CFTerm | undefined {
      ensureTerms(index + 1);
      if (index >= terms.length) return undefined;
      return terms[index];
    },
    clone(): ContinuedFractionStream {
      const cloned = makeCFStream(generator);
      for (let i = 0; i < index; i++) cloned.next();
      return cloned;
    }
  };
}

export function cfFromTerms(terms: CFTerm[]): ContinuedFractionStream {
  return makeCFStream(function* () {
    for (const t of terms) yield t;
  });
}

export function convergent(cf: ContinuedFractionStream, n: number): Rational {
  const terms: CFTerm[] = [];
  const stream = cf.clone();
  for (let i = 0; i < n; i++) {
    const t = stream.next();
    if (t === undefined) break;
    terms.push(t);
  }

  if (terms.length === 0) return Rational.zero;

  let h_prev = BigInt(0);
  let h_curr = BigInt(1);
  let k_prev = BigInt(1);
  let k_curr = BigInt(0);

  for (const a of terms) {
    const h_next = a * h_curr + h_prev;
    const k_next = a * k_curr + k_prev;
    h_prev = h_curr;
    h_curr = h_next;
    k_prev = k_curr;
    k_curr = k_next;
  }

  return new Rational(h_curr, k_curr);
}

export function convergentInterval(cf: ContinuedFractionStream, n: number): RationalInterval {
  const pn = convergent(cf, n);
  const pn1 = convergent(cf, n + 1);
  const lo = pn.lessThan(pn1) ? pn : pn1;
  const hi = pn.greaterThan(pn1) ? pn : pn1;
  return new RMInterval(lo, hi);
}

export function oracleFromCF(cf: ContinuedFractionStream): Oracle {
  const p0 = convergent(cf, 1);
  const p1 = convergent(cf, 2);
  const lo = p0.lessThan(p1) ? p0 : p1;
  const hi = p0.greaterThan(p1) ? p0 : p1;
  const initialYes = new RMInterval(lo, hi);
  let depth = 2;

  return makeAlgorithmOracle(initialYes, async (current, precision) => {
    let interval = current;
    let width = interval.high.subtract(interval.low);

    while (width.greaterThan(precision)) {
      depth++;
      interval = convergentInterval(cf, depth);
      width = interval.high.subtract(interval.low);
      if (depth > 10000) {
        console.warn('[oracleFromCF] Reached maximum depth 10000');
        break;
      }
    }

    return interval;
  });
}

export function* cfFromOracle(oracle: Oracle, maxTerms: number = 1000): Generator<CFTerm, void, unknown> {
  let precision = new Rational(1, 2);
  let count = 0;

  let h_prev = BigInt(0);
  let h_curr = BigInt(1);
  let k_prev = BigInt(1);
  let k_curr = BigInt(0);

  while (count < maxTerms) {
    const interval = oracle.yes;
    const lo = interval.low;
    const hi = interval.high;

    const a_lo = floorRational(lo);
    const a_hi = floorRational(hi);

    if (a_lo !== a_hi) {
      const nextPrec = precision.divide(new Rational(2));
      const wait = narrow(oracle, nextPrec);
      if (wait instanceof Promise) {
        throw new Error('cfFromOracle generator cannot handle async narrowing. Use cfFromOracleAsync instead.');
      }
      precision = nextPrec;
      continue;
    }

    const a = BigInt(a_lo);
    yield a;
    count++;

    const h_next = a * h_curr + h_prev;
    const k_next = a * k_curr + k_prev;
    h_prev = h_curr;
    h_curr = h_next;
    k_prev = k_curr;
    k_curr = k_next;

    const newLo = lo.subtract(new Rational(a_lo));
    const newHi = hi.subtract(new Rational(a_hi));

    if (newLo.equals(Rational.zero) || newHi.equals(Rational.zero)) {
      break;
    }

    const invLo = newHi.reciprocal();
    const invHi = newLo.reciprocal();
    const orderedLo = invLo.lessThan(invHi) ? invLo : invHi;
    const orderedHi = invLo.greaterThan(invHi) ? invLo : invHi;

    oracle.yes = new RMInterval(orderedLo, orderedHi);
  }
}

export async function cfFromOracleAsync(
  oracle: Oracle,
  maxTerms: number = 1000
): Promise<ContinuedFractionStream> {
  const terms: CFTerm[] = [];
  let precision = new Rational(1, 2);
  let workingOracle = oracle;

  for (let count = 0; count < maxTerms; count++) {
    let interval = workingOracle.yes;
    let lo = interval.low;
    let hi = interval.high;

    let a_lo = floorRational(lo);
    let a_hi = floorRational(hi);

    while (a_lo !== a_hi) {
      precision = precision.divide(new Rational(2));
      await narrow(workingOracle, precision);
      interval = workingOracle.yes;
      lo = interval.low;
      hi = interval.high;
      a_lo = floorRational(lo);
      a_hi = floorRational(hi);

      if (precision.lessThan(new Rational(1, BigInt(10) ** BigInt(100)))) {
        console.warn('[cfFromOracleAsync] Precision limit reached');
        return cfFromTerms(terms);
      }
    }

    const a = BigInt(a_lo);
    terms.push(a);

    const newLo = lo.subtract(new Rational(a_lo));
    const newHi = hi.subtract(new Rational(a_hi));

    if (newLo.equals(Rational.zero) || newHi.equals(Rational.zero)) {
      break;
    }

    const invLo = newHi.reciprocal();
    const invHi = newLo.reciprocal();
    const orderedLo = invLo.lessThan(invHi) ? invLo : invHi;
    const orderedHi = invLo.greaterThan(invHi) ? invLo : invHi;

    workingOracle.yes = new RMInterval(orderedLo, orderedHi);
  }

  return cfFromTerms(terms);
}

export function cfSqrt2(): ContinuedFractionStream {
  return makeCFStream(function* () {
    yield BigInt(1);
    while (true) yield BigInt(2);
  });
}

export function cfE(): ContinuedFractionStream {
  return makeCFStream(function* () {
    yield BigInt(2);
    let k = BigInt(1);
    while (true) {
      yield BigInt(1);
      yield BigInt(2) * k;
      yield BigInt(1);
      k++;
    }
  });
}

export function cfPhi(): ContinuedFractionStream {
  return makeCFStream(function* () {
    while (true) yield BigInt(1);
  });
}
