import { type Oracle, type Answer, type RationalInterval } from './types';
import { Rational, RationalInterval as RMInterval } from './ratmath';
import { intersect, withinDelta, makeRational } from './ops';

export type ComputeFnWithState = ((ab: RationalInterval, delta: Rational) => RationalInterval) & {
  internal?: Record<string, unknown>;
};

function makeOracle(
  yes: RationalInterval,
  compute: (ab: RationalInterval, delta: Rational) => RationalInterval
): Oracle {
  const fn = ((ab: RationalInterval, delta: Rational): Answer => {
    const target = ab;
    const currentYes = (fn as Oracle).yes;
    // Early path: if current yes already within delta of target, avoid compute
    if (withinDelta(currentYes, target, delta)) {
      const interYT = intersect(currentYes, target);
      if (interYT) {
        // Do not mutate yes; return currentYes as cd
        return { ans: 1, cd: currentYes };
      }
      // No intersection; answer is false, do not change yes
      return { ans: 0, cd: currentYes };
    }

    // Compute prophecy and intersect with current yes; update yes to intersection when possible
    const prophecy = compute(target, delta);
    const interYY = intersect(prophecy, currentYes);
    if (interYY) {
      const refined = interYY;
      (fn as Oracle).yes = refined; // Only update yes when compute is called and intersection exists
      const interWithTarget = intersect(refined, target);
      const ans = !!interWithTarget && withinDelta(refined, target, delta);
      return { ans: ans ? 1 : 0, cd: refined };
    }
    // No intersection: leave yes unchanged and report based on current state
    return { ans: 0, cd: currentYes };
  }) as Oracle;
  fn.yes = yes;
  return fn;
}

export function fromRational(q: Rational): Oracle {
  const rq = q instanceof Rational ? q : new Rational(q as any);
  const yes: RationalInterval = new RMInterval(rq, rq);
  return makeOracle(yes, () => yes);
}

export function fromInterval(i: RationalInterval): Oracle {
  const yes = i;
  return makeOracle(yes, () => yes);
}

export function fromTestFunction(testFn: (i: RationalInterval) => boolean): Oracle {
  // Start with a broad yes interval if not otherwise provided. Here, [-1e9, 1e9].
  const yes: RationalInterval = new RMInterval(makeRational(-1e9), makeRational(1e9));
  return makeOracle(yes, (ab) => {
    if (testFn(ab)) return ab;
    // Return a nearby point outside to force No
    const outside = new RMInterval(makeRational(1e12), makeRational(1e12));
    return outside;
  });
}

// Expose a way to create a custom oracle for tests or advanced usage.
export function makeCustomOracle(yes: RationalInterval, compute: ComputeFnWithState): Oracle {
  return makeOracle(yes, compute);
}
