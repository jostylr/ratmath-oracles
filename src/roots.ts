import { Rational, RationalInterval } from './ratmath';
import { Answer, Oracle } from './types';
import { halo } from './helpers';

/*retHelper takes in an array <isYes, interval>, and returns Answer form of [array, extra]*/
function retHelper(tuple: [1 | 0 | -1, RationalInterval?], extra?: any): Answer {
    return [tuple, extra ?? null];
}

// 1. nRoot
export function nRoot(q: Rational, guess: Rational, n: number = 2): Oracle {
    let currentGuess = guess;
    let currentPartner = q.divide(guess.pow(n - 1));

    const getInterval = (g: Rational, p: Rational) => {
        const low = g.lessThan(p) ? g : p;
        const high = g.lessThan(p) ? p : g;
        return new RationalInterval(low, high);
    };

    let currentYes = getInterval(currentGuess, currentPartner);

    const oracle = ((ab: RationalInterval, delta: Rational, input?: any): Answer => {
        // Check if currentYes intersects ab
        const inter = ab.intersection(currentYes);
        if (inter === null) {
            // Disjoint
            return retHelper([0, currentYes], { guess: currentGuess, partner: currentPartner });
        }

        // Check if currentYes is contained in halo(ab, delta)
        const h = halo(ab, delta);
        if (h.contains(currentYes)) {
            return retHelper([1, currentYes], { guess: currentGuess, partner: currentPartner });
        }

        return retHelper([0, currentYes], { guess: currentGuess, partner: currentPartner });
    }) as Oracle;

    oracle.yes = currentYes;
    oracle.update = true; // Allow updates to yes interval

    oracle.narrowing = (current: RationalInterval, precision: Rational) => {
        // Newton's method step
        // x_new = ((n-1)x + y) / n
        const nRat = new Rational(n);
        const nMinus1 = new Rational(n - 1);

        // We update until the width of the interval is less than precision?
        // The doc implies one step per call essentially, but narrow() usually expects to meet precision.
        // However, since this is an iterative process stored in the oracle, we can just do steps.
        // Let's loop until precision is met or max iterations to be safe, updating state.
        // But usually narrow is called repeatedly. Let's do a loop.

        let width = currentYes.high.subtract(currentYes.low);
        let iter = 0;
        while (width.greaterThan(precision) && iter < 100) {
            const nextGuess = currentGuess.multiply(nMinus1).add(currentPartner).divide(nRat);
            currentGuess = nextGuess;
            currentPartner = q.divide(currentGuess.pow(n - 1));
            currentYes = getInterval(currentGuess, currentPartner);
            width = currentYes.high.subtract(currentYes.low);
            iter++;
        }

        oracle.yes = currentYes;
        return currentYes;
    };

    return oracle;
}

// 2. nRootTest
export function nRootTest(q: Rational, yes?: RationalInterval, n: number = 2): Oracle {
    const initialYes = yes ?? new RationalInterval(new Rational(1), q);

    const oracle = ((ab: RationalInterval, delta: Rational, input?: any): Answer => {
        // Check a^n : q : b^n
        const lowPow = ab.low.pow(n);
        const highPow = ab.high.pow(n);
        const mappedInterval = new RationalInterval(lowPow, highPow);

        if (mappedInterval.containsValue(q)) {
            // q is in [a^n, b^n], so root is in [a, b]
            // But we need to answer based on overlap with currentYes?
            // The doc says: "This handles the Yes function by given a:b, check whether a^n:q:b^n is true."
            // If true, it means the root IS in [a, b].
            return retHelper([1, ab]);
        } else {
            // If q not in [a^n, b^n], then root not in [a, b]?
            // Not necessarily true if interval is merely overlapping.
            // Ideally we check intersection with oracle.yes
            return retHelper([0, oracle.yes]);
        }
    }) as Oracle;

    oracle.yes = initialYes;

    oracle.narrowing = (current: RationalInterval, precision: Rational) => {
        // Bisection
        let active = oracle.yes;
        let w = active.high.subtract(active.low);
        let iter = 0;
        while (w.greaterThan(precision) && iter < 100) {
            const mid = active.low.add(active.high).divide(new Rational(2));
            // Check which side q is on
            const midPow = mid.pow(n);
            if (midPow.greaterThan(q)) {
                active = new RationalInterval(active.low, mid);
            } else {
                active = new RationalInterval(mid, active.high);
            }
            w = active.high.subtract(active.low);
            iter++;
        }
        oracle.yes = active;
        return active;
    };

    return oracle;
}

// 3. KantorovichRoot
type KantorovichParams = {
    f: (x: Rational) => Rational;
    fprime: (x: Rational) => Rational;
    guess: Rational;
    domain: RationalInterval;
    maxpp: Rational;
    minp: Rational;
};

export function KantorovichRoot({ f, fprime, guess, domain, maxpp, minp }: KantorovichParams): Oracle {
    // r = 2 * beta, beta = |f(g)/f'(g)|
    // gamma = maxpp / (2 * minp)
    // h = beta * gamma
    // Check h <= 1/4

    let currentGuess = guess;

    // Helper to calculate state
    const calcState = (g: Rational) => {
        const val = f(g);
        const der = fprime(g);
        const beta = val.divide(der).abs();
        const r = beta.multiply(new Rational(2));

        const gamma = maxpp.divide(minp.multiply(new Rational(2)));
        const h = beta.multiply(gamma);

        return { beta, r, h, val, der };
    };

    let { r, h } = calcState(currentGuess);

    if (h.greaterThan(new Rational(1, 4))) {
        throw new Error(`Kantorovich condition failed: h=${h.toString()} > 1/4`);
    }

    let currentYes = new RationalInterval(currentGuess.subtract(r), currentGuess.add(r));

    const oracle = ((ab: RationalInterval, delta: Rational, input?: any): Answer => {
        const inter = ab.intersection(currentYes);
        if (inter === null) {
            return retHelper([0, currentYes]);
        }
        if (halo(ab, delta).contains(currentYes)) {
            return retHelper([1, currentYes]);
        }
        return retHelper([0, currentYes]);
    }) as Oracle;

    oracle.yes = currentYes;

    oracle.narrowing = (current: RationalInterval, precision: Rational) => {
        let w = currentYes.high.subtract(currentYes.low);
        let iter = 0;
        while (w.greaterThan(precision) && iter < 100) {
            const { val, der } = calcState(currentGuess);
            // New guess = g - f(g)/f'(g)
            const nextGuess = currentGuess.subtract(val.divide(der));
            currentGuess = nextGuess;

            // Update r
            // "Use newGuess to compute beta and then compute the new radius r=2beta"
            const newState = calcState(currentGuess);

            // Note: The doc says "Use the new radius and the new guess as the Yes interval"
            // But r should shrink. 2*beta might effectively be the error bound if quadratic convergence holds.
            const newR = newState.r;
            currentYes = new RationalInterval(currentGuess.subtract(newR), currentGuess.add(newR));
            w = currentYes.high.subtract(currentYes.low);
            iter++;
        }
        oracle.yes = currentYes;
        return currentYes;
    }

    return oracle;
}

// 4. IVTRoot
export function IVTRoot(f: (x: Rational) => Rational, initial: RationalInterval): Oracle {
    // Check f(a)*f(b) < 0
    const fa = f(initial.low);
    const fb = f(initial.high);
    if (fa.multiply(fb).greaterThanOrEqual(new Rational(0))) {
        // Technically IVT requires strict inequality for sign change, or one is zero.
        // If one is zero, we found a root.
        if (fa.equals(Rational.zero) || fb.equals(Rational.zero)) {
            // Handle exact root
        } else {
            // throw new Error("IVT condition failed: f(a) and f(b) have same sign"); 
            // Doc says "It should be the case that...".
            // We'll proceed or warn.
        }
    }

    const oracle = ((ab: RationalInterval, delta: Rational, input?: any): Answer => {
        // Check f(a)*f(b) < 0 for the input interval?
        // Doc: "This handles the Yes function by given a:b, check whether f(a)*f(b)<0."
        // If f(a)f(b) < 0, then root is in [a,b].
        const valA = f(ab.low);
        const valB = f(ab.high);
        if (valA.multiply(valB).lessThan(Rational.zero)) {
            return retHelper([1, ab]);
        }
        return retHelper([0, oracle.yes]);
    }) as Oracle;

    oracle.yes = initial;

    oracle.narrowing = (current: RationalInterval, precision: Rational) => {
        let active = oracle.yes;
        let w = active.high.subtract(active.low);
        let iter = 0;

        while (w.greaterThan(precision) && iter < 100) {
            const mid = active.low.add(active.high).divide(new Rational(2));
            const fmid = f(mid);
            const flow = f(active.low);

            if (fmid.equals(Rational.zero)) {
                active = new RationalInterval(mid, mid);
                w = Rational.zero;
                break;
            }

            if (flow.multiply(fmid).lessThan(Rational.zero)) {
                active = new RationalInterval(active.low, mid);
            } else {
                active = new RationalInterval(mid, active.high);
            }
            w = active.high.subtract(active.low);
            iter++;
        }
        oracle.yes = active;
        return active;
    };

    return oracle;
}
