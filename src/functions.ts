import { type Oracle, type Answer, type RationalInterval } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { intersect, withinDelta, makeRational, expand } from './ops';
import { AsyncQueue, halo } from './helpers';

export type ComputeFnWithState = ((ab: RationalInterval, delta: Rational) => RationalInterval) & {
  internal?: Record<string, unknown>;
};

// --- New Factories ---

// makeTestOracle: The user provides a test function that answers "Yes/No/Maybe" (Answer) for a given interval.
// The narrowing strategy is generic bisection.
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

    // 2. If ambiguous, run the test function
    const result = await test(ab);
    if (result[0][0] === 1 && result[0][1]) {
      const intersection = oracle.yes.intersection(result[0][1]);
      if (intersection === null) {
        throw new Error(`Oracle Consistency Error: Test produced a prophecy ${result[0][1].toString()} disjoint from current knowledge ${oracle.yes.toString()}`);
      }
      oracle.yes = intersection;
    }
    return result;
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

// makeAlgorithmOracle: The user provides an algorithm that shrinks the interval.
// The test is just "Does the query interval contain the (halo of) the current valid interval?"
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
