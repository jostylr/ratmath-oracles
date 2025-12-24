import { describe, it, expect } from 'bun:test';
import {
    singularOracle,
    reflexiveOracle,
    fuzzyReflexiveOracle,
    haloOracle,
    bisectionOracle,
    randomOracle
} from '../src/rationals';
import { add, subtract, multiply, divide } from '../src/arithmetic';
import { Rational, RationalInterval } from '../src/ratmath';
import { Oracle } from '../src/types';

// Instrumentation Wrapper using Proxy to preserve property access
const instrumentOracle = (target: Oracle, name: string): Oracle => {
    return new Proxy(target, {
        apply: function (tgt, thisArg, argumentsList) {
            const start = performance.now();
            // @ts-ignore
            const res = Reflect.apply(tgt, thisArg, argumentsList);
            const end = performance.now();
            const duration = end - start;
            const [ab, delta] = argumentsList as [RationalInterval, Rational, any];

            const width = ab.high.subtract(ab.low);
            const answer = res[0][0];

            console.log(`[PERF][${name}] Time: ${duration.toFixed(3)}ms | Call: [${ab.low.toString()}, ${ab.high.toString()}] (w=${width.toString()}) -> Ans: ${answer}`);

            return res;
        }
    }) as Oracle;
};

describe('Performance Investigation', () => {
    // --- Setup Base Oracles (Reproducing Slow Configuration) ---
    // Wide intervals to stress test narrowing

    // Singular: Denominator in the 5-op chain. Wide [0.1, 1] - Safe for division but still wide.
    const r_singular = new Rational(1, 2);
    const raw_Singular = singularOracle(r_singular, new RationalInterval(new Rational(1, 10), new Rational(1)));
    const O_Singular = instrumentOracle(raw_Singular, 'Singular');

    const r_reflexive = new Rational(1, 3);
    const raw_Reflexive = reflexiveOracle(r_reflexive, new RationalInterval(new Rational(3, 10), new Rational(4, 10)));
    const O_Reflexive = instrumentOracle(raw_Reflexive, 'Reflexive');

    const r_fuzzy = new Rational(-2, 5);
    const raw_Fuzzy = fuzzyReflexiveOracle(r_fuzzy, new RationalInterval(new Rational(-1), new Rational(0)));
    const O_Fuzzy = instrumentOracle(raw_Fuzzy, 'Fuzzy');

    const r_halo = new Rational(5);
    const raw_Halo = haloOracle(r_halo, new RationalInterval(new Rational(49, 10), new Rational(51, 10)));
    const O_Halo = instrumentOracle(raw_Halo, 'Halo');

    const r_bisect = new Rational(3, 4);
    // Bisection with Loop. Wide [0, 2].
    const raw_Bisection = bisectionOracle(r_bisect, new Rational(5, 4), 100, new RationalInterval(new Rational(0), new Rational(2)));
    const O_Bisection = instrumentOracle(raw_Bisection, 'Bisection');

    const r_zero = new Rational(0);
    // Zero: Extremely Wide [-5, 5] as originally set, which caused slowness
    const raw_Zero = fuzzyReflexiveOracle(r_zero, new RationalInterval(new Rational(-5), new Rational(5)));
    const O_Zero = instrumentOracle(raw_Zero, 'Zero');

    const r_one = new Rational(1);
    const raw_One = fuzzyReflexiveOracle(r_one, new RationalInterval(new Rational(9, 10), new Rational(11, 10)));
    const O_One = instrumentOracle(raw_One, 'One');

    const delta = new Rational(1, 1000);

    const checkOracle = (oracle: Oracle, expectedVal: Rational, name: string) => {
        console.log(`\nStarting checkOracle for ${name}...`);
        const epsilon = new Rational(1, 100000);
        const yesTarget = new RationalInterval(
            expectedVal.subtract(epsilon),
            expectedVal.add(epsilon)
        );

        console.log(`Target Interval: [${yesTarget.low.toString()}, ${yesTarget.high.toString()}]`);

        const start = performance.now();
        const resYes = oracle(yesTarget, delta);
        const end = performance.now();
        console.log(`Total checkOracle Time: ${(end - start).toFixed(3)}ms`);

        expect(resYes[0][0]).toBe(1);
    };

    it.skip('Trace 5-op chain with Division', () => {
        // ((Zero + One) * Halo - Reflexive) / Singular + Bisection
        // Reintroduced Division / Singular to capture the bottleneck

        console.log('--- Constructing Operation Chain ---');
        const op1 = add(O_Zero, O_One);
        const op2 = multiply(op1, O_Halo);
        const op3 = subtract(op2, O_Reflexive);
        const op4 = divide(op3, O_Singular);
        const result = add(op4, O_Bisection);

        const expected = r_zero.add(r_one)
            .multiply(r_halo)
            .subtract(r_reflexive)
            .divide(r_singular)
            .add(r_bisect);

        checkOracle(result, expected, '5-op-chain-PERF');
    });

    it('Division Micro-benchmark: Divide by increasingly wide intervals', () => {
        const num = instrumentOracle(singularOracle(new Rational(1), new RationalInterval(new Rational(9, 10), new Rational(11, 10))), 'Num');

        // Case 1: Narrow Denominator [0.4, 0.6]
        console.log('\n--- Micro-bench: Narrow Denom [0.4, 0.6] ---');
        const denNarrow = instrumentOracle(singularOracle(new Rational(1, 2), new RationalInterval(new Rational(4, 10), new Rational(6, 10))), 'DenNarrow');
        const resNarrow = divide(num, denNarrow);
        checkOracle(resNarrow, new Rational(2), 'DivNarrow');

        // Case 2: Wide Denominator [0.1, 1.0]
        console.log('\n--- Micro-bench: Wide Denom [0.1, 1.0] ---');
        const denWide = instrumentOracle(singularOracle(new Rational(1, 2), new RationalInterval(new Rational(1, 10), new Rational(1))), 'DenWide');
        const resWide = divide(num, denWide);
        checkOracle(resWide, new Rational(2), 'DivWide');
    });

    it('Optimization Trigger Check', () => {
        // Goal: Verify that dividing by a wide, small-magnitude interval triggers optimization
        // and narrows the denominator.

        console.log('\n--- Optimization Check ---');
        // Re-use O_Singular from setup (instrumented)
        const num = instrumentOracle(singularOracle(new Rational(1), new RationalInterval(new Rational(9, 10), new Rational(11, 10))), 'OptNum');

        const res = divide(num, O_Singular);

        // Check needs delta
        const expected = new Rational(2); // 1 / 0.5
        checkOracle(res, expected, 'OptCheck');
    });
});
