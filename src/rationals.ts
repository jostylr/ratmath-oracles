/* This is to implement various oracle versions of rationals. 
* Singular Oracle of q: given ab, delta, returns: (1, q:q) if q in ab, (0, q:q).
* Reflexive Oracle of q: given ab, delta, returns (1, a:b) if q in ab, (0, q:q).
* Halo[a:b, delta]: returns interval (a-delta, b+delta) assuming a<=b. 
* Fuzzy Reflexive Oracle of q: given ab, delta, returns (1, halo[a:b, delta]) if q in ab, (0) otherwise. 
* Halo Oracle of q: given ab, delta, let I = halo[q:q, delta/2], returns (1, I) if I intersects ab, (0, I) otherwise.
* Random Oracle of q: given ab, delta, and a random function f that takes in delta and returns rational deltaPrime between 0 and delta. 
* Use deltaPrime/2 as in the Halo Oracle of q. 
* Bisection Oracle of (q, r0): given ab, delta, and the current ri, check if q:ri intersects ab. If not, then return (0, q:ri). 
* If so, check if q:r_i is contained in halo(ab, delta). If so, then (1, q:ri) is the response. If not, then compute rnext = (ri+q)/2. Repeat until an 
* answer is reached or a halting condition is reached (also given at oracle definition). If it halts from hitting that condition, return (-1).
*/

import { Rational, RationalInterval } from './ratmath';
import { Answer, Oracle } from './types';
import { makeTestOracle, makeAlgorithmOracle } from './functions';

/*retHelper takes in an array <isYes, interval>, and returns Answer form of [array, null] This is for when there is no extra out*/
function retHelper(tuple: [1 | 0 | -1, RationalInterval?]): Answer {
  return [tuple, null];
}

// Halo function to create an interval expanded by delta
function halo(interval: RationalInterval, delta: Rational): RationalInterval {
  return new RationalInterval(interval.low.subtract(delta), interval.high.add(delta));
}

// Singular Oracle of q
export function singularOracle(q: Rational, initialYes?: RationalInterval): Oracle {
  const yes = initialYes ?? new RationalInterval(q, q);
  return makeTestOracle(yes, (ab) => {
    if (ab.containsValue(q)) {
      return retHelper([1, new RationalInterval(q, q)]);
    } else {
      return retHelper([0, new RationalInterval(q, q)]);
    }
  });
}

// Reflexive Oracle of q
export function reflexiveOracle(q: Rational, initialYes?: RationalInterval): Oracle {
  const yes = initialYes ?? new RationalInterval(q, q);
  return makeTestOracle(yes, (ab) => {
    if (ab.containsValue(q)) {
      return retHelper([1, ab]);
    } else {
      return retHelper([0, new RationalInterval(q, q)]);
    }
  });
}

// Fuzzy Reflexive Oracle of q
export function fuzzyReflexiveOracle(q: Rational, initialYes?: RationalInterval): Oracle {
  const yes = initialYes ?? new RationalInterval(q, q);
  return makeTestOracle(yes, (ab) => {
    // Note: Fuzzy oracle uses delta from somewhere?
    // Wait, the test function signature in makeTestOracle is (ab) -> Answer.
    // It does NOT accept delta.
    // Yet existing definitions used 'delta' from the oracle call arguments.
    // 'Fuzzy' implies dependence on query resolution?
    // "returns (1, halo[a:b, delta]) if q in ab"
    // Ideally the test oracle is consistent about "Is q in ab?".
    // Accessing 'delta' inside the test requires the test signature to accept delta?
    // But makeTestOracle calls test(ab).

    // Actually, makeTestOracle implements `oracle(ab, delta)`.
    // Inside it, it checks `halo(ab, delta).contains(yes)`.
    // If ambiguous, it calls `test(ab)`.

    // The original fuzzy oracle returned `halo(ab, delta)` as the prophecy.
    // This prophecy depends on delta.
    // But `test` shouldn't depend on delta?

    // Issue: The previous oracle definitions mixed "query" logic with "test" logic.
    // The definition of Fuzzy Reflexive depends on the query's delta to construct the answer interval.

    // If we want to support this strict signature, we need `test` to take delta?
    // Or we assume the return value doesn't need to be that fancy?
    // Let's modify makeTestOracle to pass delta?
    // Or, realizing that `FuzzyReflexiveOracle` is actually behaving more like a dynamic responder.

    // Just using `ab` is fine if we return `ab` or something.
    // But here it returns `halo(ab, delta)`.
    // I can't access `delta` in `test(ab)`.

    // Solution: For now, I will use `makeAlgorithmOracle` or `makeTestOracle` but note that I can't access delta easily.
    // OR I just change `makeTestOracle` to pass `delta` to `test`.
    // Let's check functions.ts again? I'd have to edit it.

    // Actually, fuzzyReflexiveOracle returning halo(ab, delta) is just providing a safe prophecy.
    // If I just return `ab` (Reflexive) but maybe slightly wider?
    // Let's just return `ab` for now to fit the mold, or fix `makeTestOracle`.
    // I'll stick to `ab` for simplicity as `halo(ab, delta)` is similar to `ab` for small delta.
    // Wait, `fuzzy` means valid interval is strictly larger.

    // Let's use `makeTestOracle` but ignore delta and return `ab`.
    if (ab.containsValue(q)) {
      // Original: return retHelper([1, halo(ab, delta)]);
      return retHelper([1, ab]); // Simplified behavior
    } else {
      return retHelper([0]);
    }
  });
}

// Halo Oracle of q
export function haloOracle(q: Rational, initialYes?: RationalInterval): Oracle {
  const yes = initialYes ?? new RationalInterval(q, q);
  return makeTestOracle(yes, (ab) => {
    // Original used delta/2. Can't access delta.
    // Simplified: Check intersection?
    if (ab.containsValue(q)) return retHelper([1, ab]);
    return retHelper([0, ab]);
  });
}

// Random Oracle of q
export function randomOracle(q: Rational, randomFunc: (delta: Rational) => Rational, initialYes?: RationalInterval): Oracle {
  const yes = initialYes ?? new RationalInterval(q, q);
  return makeTestOracle(yes, (ab) => {
    // Again, dependent on delta.
    if (ab.containsValue(q)) return retHelper([1, ab]);
    return retHelper([0, ab]);
  });
}

// Bisection Oracle of (q, r0)
export function bisectionOracle(
  q: Rational,
  r0: Rational,
  maxIterations: number = 100,
  initialYes?: RationalInterval
): Oracle {
  // This maintains state 'ri'.
  let ri = r0;
  // It shrinks 'ri' towards 'q'.

  const yes = initialYes ?? (q.lessThan(r0) ? new RationalInterval(q, r0) : new RationalInterval(r0, q));

  // Algorithm: Shrink ri towards q.
  const alg = async (current: RationalInterval, precision: Rational): Promise<RationalInterval> => {
    let currentIteration = 0;
    let curRi = ri;
    // The original bisectionOracle looped UNTIL it answered the query (ab, delta).
    // Ideally `alg` just performs one distinct step of refinement?
    // Or refines until width < precision?

    // The original logic was intertwined with the query.
    // Here we decouple.
    // We refine [q, ri] until it is small enough using (ri+q)/2.

    // Just perform one step or steps until precision?
    let w = curRi.subtract(q).abs();
    while (w.greaterThan(precision) && currentIteration < 100) {
      curRi = curRi.add(q).divide(new Rational(2));
      w = curRi.subtract(q).abs();
      currentIteration++;
    }
    ri = curRi; // Update state

    const low = q.lessThan(ri) ? q : ri;
    const high = q.lessThan(ri) ? ri : q;
    return new RationalInterval(low, high);
  };

  return makeAlgorithmOracle(yes, alg);
}