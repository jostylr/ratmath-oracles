import { type Oracle, type Answer, type RationalInterval } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { intersect, withinDelta, makeRational, expand } from './ops';
import { AsyncQueue, halo } from './helpers';

export type ComputeFnWithState = ((ab: RationalInterval, delta: Rational) => RationalInterval) & {
  internal?: Record<string, unknown>;
};

// --- New Factories ---

/**
 * makeTestOracle: Creates an oracle from a test function.
 * 
 * The test function `test(i)` should return:
 * - 1 (Yes) if the interval `i` definitively contains the real number.
 * - 0 (No) if the interval `i` definitively does not contain the real number.
 * - -1 (Maybe) only if the real number is potentially an endpoint of `i` (within precision limits).
 * 
 * Logic of the resulting Oracle:
 * 1. Checks current known `yes` interval. If disjoint from `ab`, returns No. 
 *    If `yes` is contained in `halo(ab, delta)`, returns Yes.
 * 2. Calls `test(ab)`.
 * 3. If `test(ab)` is ambiguous (-1), calls `test(halo(ab, delta))`.
 * 4. If result is Yes (1): updates `yes` by intersecting with the test prophecy and returns Yes.
 *    Returning 1 for `(ab, delta)` definitively states that `halo(ab, delta)` is a Yes-interval, 
 *    though `ab` itself might not be.
 * 5. If result is No (0): returns No.
 * 6. If result is still Ambiguous (-1) for the halo, an error is thrown indicating precision limitation.
 */
export function makeTestOracle(
  initialYes: RationalInterval,
  test: (ab: RationalInterval) => Answer | Promise<Answer>
): Oracle {
  // We keep state in the oracle object itself for simplicity of access
  const queue = new AsyncQueue();

  const oracle = (async (ab: RationalInterval, delta: Rational, input?: any): Promise<Answer> => {
    // 1. Check against current Yes (fast path)
    const currentYes = oracle.yes;
    const inter = ab.intersection(currentYes);
    if (inter === null) {
      return [[0, currentYes], null];
    }
    if (halo(ab, delta).contains(currentYes)) {
      return [[1, currentYes], null];
    }

    // 2. Run the test function
    let result = await test(ab);

    // If ambiguous, try the halo
    if (result[0][0] === -1) {
      result = await test(halo(ab, delta));
      if (result[0][0] === -1) {
        throw new Error(`Precision limitation in test function: both query ${ab.toString()} and its halo returned Maybe. Endpoints likely hit computational limits.`);
      }
    }

    // Process final result (1 or 0)
    if (result[0][0] === 1) {
      const prophecy = result[0][1] || ab; // Use prophecy from test or fall back to ab
      const intersection = oracle.yes.intersection(prophecy);
      if (intersection === null) {
        throw new Error(`Oracle Consistency Error: Test produced a prophecy ${prophecy.toString()} disjoint from current knowledge ${oracle.yes.toString()}`);
      }
      oracle.yes = intersection;
      return [[1, oracle.yes], result[1]];
    } else {
      return [[0, currentYes], result[1]];
    }
  }) as Oracle;

  oracle.yes = initialYes;

  // Generic Bisection Narrowing
  oracle.narrowing = async (current: RationalInterval, precision: Rational): Promise<RationalInterval> => {
    return queue.add(async () => {
      let active = oracle.yes;
      let w = active.high.subtract(active.low);
      // If we are already small enough, return.
      if (w.lessThanOrEqual(precision)) return active;

      // Bisection loop
      // We limit iterations to prevent infinite loops if test is inconsistent
      let iter = 0;
      while (w.greaterThan(precision) && iter < 100) {
        const mid = active.low.add(active.high).divide(new Rational(2));
        const leftHalf = new RMInterval(active.low, mid);
        const rightHalf = new RMInterval(mid, active.high);

        // Check left
        const ansLeft = await test(leftHalf);
        // Logic: answer is [[val, ref?], extra]
        // If 1, root is in left.
        // If 0, root is in right (assuming existence).
        // If -1 (overlapping), we might need to keep both? 
        // Simple bisection assumes unique root for now or just picks one.
        if (ansLeft[0][0] === 1) {
          active = leftHalf;
        } else if (ansLeft[0][0] === 0) {
          active = rightHalf;
        } else {
          // Left is ambiguous (-1). Check right.
          const ansRight = await test(rightHalf);
          if (ansRight[0][0] === 1) {
            active = rightHalf;
          } else if (ansRight[0][0] === 0) {
            active = leftHalf;
          } else {
            // Both halves are ambiguous. Try the middle half (between quartiles).
            // This handles cases where the root is near the midpoint.
            const L1 = active.low.add(mid).divide(new Rational(2));
            const R1 = mid.add(active.high).divide(new Rational(2));
            const middleHalf = new RMInterval(L1, R1);

            const ansMid = await test(middleHalf);
            if (ansMid[0][0] === 1) {
              active = middleHalf;
            } else {
              // The test is failing to be decisive even for an interval containing the suspected point.
              console.warn(`[makeTestOracle] Bisection stuck: Left, Right, and Middle are all ambiguous at width ${w.toString()}`);
              break;
            }
          }
        }

        w = active.high.subtract(active.low);
        iter++;
      }
      oracle.yes = active;
      return active;
    });
  };

  return oracle;
}

/**
 * makeAlgorithmOracle: Creates an oracle from a numerical refinement algorithm.
 * 
 * The algorithm function `alg(current, precision)` should return:
 * - A new `RationalInterval` that is a sub-interval of `current` and contains the real number.
 * - The goal width of the result should be approximately `precision`.
 * 
 * Logic of the resulting Oracle:
 * 1. Checks current known `yes` interval. If disjoint from query `ab`, returns No.
 *    If `yes` is contained in `halo(ab, delta)`, returns Yes.
 * 2. If the query is ambiguous, it triggers the `narrowing` method (the algorithm) to refine
 *    the internal knowledge to at least `delta` precision.
 * 3. After narrowing, it re-checks the query.
 * 4. Returns Yes, No, or Maybe based on the refined state.
 */
export function makeAlgorithmOracle(
  initialYes: RationalInterval,
  alg: (current: RationalInterval, precision: Rational) => Promise<RationalInterval>
): Oracle {
  const queue = new AsyncQueue();

  const oracle = (async (ab: RationalInterval, delta: Rational, input?: any): Promise<Answer> => {
    // Algorithm oracle primarily answers based on its current state.
    // If the query is ambiguous given current state, it might trigger refinement?
    // User request: "Calling narrow should update Yes... calling oracle itself may call narrow function"

    const currentYes = oracle.yes;

    // Fast checks
    if (ab.intersection(currentYes) === null) return [[0, currentYes], null];
    if (halo(ab, delta).contains(currentYes)) return [[1, currentYes], null];

    // Ambiguous (Intersects but not contained in halo). 
    // We MUST narrow to resolve the query.
    // We use 'delta' as the target, as any interval of width <= delta 
    // that intersects 'ab' is guaranteed to be contained in halo(ab, delta).
    const refined = await oracle.narrowing!(currentYes, delta);

    // Re-check after narrowing
    if (halo(ab, delta).contains(refined)) return [[1, refined], null];
    if (ab.intersection(refined) === null) return [[0, refined], null];

    // If still ambiguous, the narrowing failed to reach target precision.
    const finalWidth = refined.high.subtract(refined.low);
    if (finalWidth.greaterThan(delta)) {
      console.warn(`[Oracle] Narrowing failed to reach target delta: ${delta.toString()}. Current width: ${finalWidth.toString()}`);
    }

    // Return Maybe/Ambiguous
    return [[-1, refined], null];
  }) as Oracle;

  oracle.yes = initialYes;

  oracle.narrowing = async (current: RationalInterval, precision: Rational): Promise<RationalInterval> => {
    return queue.add(async () => {
      // We pass the *current state* of oracle as 'current' usually, or ignoring the arg and using oracle.yes
      const result = await alg(oracle.yes, precision);
      oracle.yes = result;
      return result;
    });
  };

  return oracle;
}

// --- Legacy Wrappers / Helpers ---

// Legacy makeOracle mapped to makeAlgorithmOracle somewhat, but 'compute' was specific.
// We will deprecate calling it directly or re-implement it using makeAlgorithmOracle.
// The old 'compute' took (ab, delta) and returned a refined interval.
// That is essentially 'narrow'.
export function makeOracle(
  yes: RationalInterval,
  compute: (ab: RationalInterval, delta: Rational) => RationalInterval | Promise<RationalInterval>
): Oracle {
  // Adapter: 'compute' was used to refine.
  const alg = async (current: RationalInterval, precision: Rational) => {
    return compute(current, precision);
  };
  return makeAlgorithmOracle(yes, alg);
}

export function fromRational(q: Rational): Oracle {
  const rq = q instanceof Rational ? q : new Rational(q as any);
  const yes: RationalInterval = new RMInterval(rq, rq);
  // Algorithm that never narrows further because it's already a point
  return makeAlgorithmOracle(yes, async () => yes);
}

export function fromInterval(i: RationalInterval): Oracle {
  const yes = i;
  return makeAlgorithmOracle(yes, async () => yes);
}

export function fromTestFunction(testFn: (i: RationalInterval) => boolean): Oracle {
  const yes: RationalInterval = new RMInterval(makeRational(-1e9), makeRational(1e9));
  // Map boolean to Answer
  const testAdapter = (i: RationalInterval): Answer => {
    const res = testFn(i);
    return res ? [[1, i], null] : [[0, i]/*roughly*/, null];
  };
  return makeTestOracle(yes, testAdapter);
}

export function makeCustomOracle(yes: RationalInterval, compute: ComputeFnWithState): Oracle {
  return makeOracle(yes, compute);
}
