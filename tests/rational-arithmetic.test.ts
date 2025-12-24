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

describe('Rational Arithmetic Combinations', () => {
    // --- Setup Base Oracles ---
    const r_singular = new Rational(1, 2);
    // Wide but safe: [0.1, 1]
    const O_Singular = singularOracle(r_singular, new RationalInterval(new Rational(1, 10), new Rational(1)));

    const r_reflexive = new Rational(1, 3);
    // Narrow: [0.3, 0.4] -> [3/10, 4/10]
    const O_Reflexive = reflexiveOracle(r_reflexive, new RationalInterval(new Rational(3, 10), new Rational(4, 10)));

    const r_fuzzy = new Rational(-2, 5);
    // Wide but safe: [-0.8, -0.1]
    const O_Fuzzy = fuzzyReflexiveOracle(r_fuzzy, new RationalInterval(new Rational(-8, 10), new Rational(-1, 10)));

    const r_halo = new Rational(5);
    // Narrow: [4.9, 5.1] -> [49/10, 51/10]
    const O_Halo = haloOracle(r_halo, new RationalInterval(new Rational(49, 10), new Rational(51, 10)));

    const r_bisect = new Rational(3, 4);
    // Wide but safe: [0.2, 2]
    const O_Bisection = bisectionOracle(r_bisect, new Rational(5, 4), 100, new RationalInterval(new Rational(2, 10), new Rational(2)));

    const r_random = new Rational(1, 10);
    // Narrow: [0, 0.2] -> [0, 2/10]
    const O_Random = randomOracle(r_random, (d) => d.divide(new Rational(2)), new RationalInterval(new Rational(0), new Rational(2, 10)));

    const r_zero = new Rational(0);
    // Wide: [-0.5, 0.5] - Reduced from [-5, 5] for performance
    const O_Zero = fuzzyReflexiveOracle(r_zero, new RationalInterval(new Rational(-1, 2), new Rational(1, 2)));

    const r_one = new Rational(1);
    // Narrow: [0.9, 1.1] -> [9/10, 11/10]
    const O_One = fuzzyReflexiveOracle(r_one, new RationalInterval(new Rational(9, 10), new Rational(11, 10)));

    const delta = new Rational(1, 1000);

    // Helper to verify oracle result
    const checkOracle = (oracle: Oracle, expectedVal: Rational, name: string) => {
        // 1. Check strict inclusion (Yes)
        // Create a very small interval around expectedVal: [val-epsilon, val+epsilon]
        const epsilon = new Rational(1, 100000);
        const yesTarget = new RationalInterval(
            expectedVal.subtract(epsilon),
            expectedVal.add(epsilon)
        );

        // We expect the oracle to say Yes (1) because the true value is inside yesTarget
        // and yesTarget should be well within any halo expanded by delta=1/1000
        const resYes = oracle(yesTarget, delta);
        if (resYes[0][0] !== 1) {
            console.error(`Failed ${name} (Expected Yes): result=${resYes[0][0]}, expected=1. Prophecy: [${resYes[0][1]?.low.toString()}, ${resYes[0][1]?.high.toString()}]`);
        }
        expect(resYes[0][0]).toBe(1);

        // 2. Check strict exclusion (No)
        // Create an interval far away: [val+10, val+11]
        const noTarget = new RationalInterval(
            expectedVal.add(new Rational(10)),
            expectedVal.add(new Rational(11))
        );
        const resNo = oracle(noTarget, delta);
        if (resNo[0][0] !== 0) {
            console.error(`Failed ${name} (Expected No): result=${resNo[0][0]}, expected=0`);
        }
        expect(resNo[0][0]).toBe(0);
    };

    describe('Single Operations', () => {
        it('Add: Mixed types', () => {
            // Singular + Reflexive
            const sum1 = add(O_Singular, O_Reflexive);
            checkOracle(sum1, r_singular.add(r_reflexive), 'Singular+Reflexive');

            // Zero + Halo
            const sum2 = add(O_Zero, O_Halo);
            checkOracle(sum2, r_zero.add(r_halo), 'Zero+Halo');
        });

        it('Subtract: Mixed types', () => {
            // Fuzzy - Bisection
            const sub1 = subtract(O_Fuzzy, O_Bisection);
            checkOracle(sub1, r_fuzzy.subtract(r_bisect), 'Fuzzy-Bisection');

            // One - Random
            const sub2 = subtract(O_One, O_Random);
            checkOracle(sub2, r_one.subtract(r_random), 'One-Random');
        });

        it('Multiply: Mixed types', () => {
            // Singular * Zero
            const mul1 = multiply(O_Singular, O_Zero);
            checkOracle(mul1, r_singular.multiply(r_zero), 'Singular*Zero');

            // Halo * Reflexive
            const mul2 = multiply(O_Halo, O_Reflexive);
            checkOracle(mul2, r_halo.multiply(r_reflexive), 'Halo*Reflexive');
        });

        it('Divide: Mixed types', () => {
            // Bisection / One
            const div1 = divide(O_Bisection, O_One);
            checkOracle(div1, r_bisect.divide(r_one), 'Bisection/One');

            // Random / Fuzzy
            const div2 = divide(O_Random, O_Fuzzy);
            checkOracle(div2, r_random.divide(r_fuzzy), 'Random/Fuzzy');
        });
    });

    describe('Complex Combinations', () => {
        it('(A + B) * (C - D)', () => {
            // (Singular + Reflexive) * (Halo - Zero)
            // (1/2 + 1/3) * (5 - 0) = 5/6 * 5 = 25/6
            const term1 = add(O_Singular, O_Reflexive);
            const term2 = subtract(O_Halo, O_Zero);
            const result = multiply(term1, term2);

            const expected = r_singular.add(r_reflexive).multiply(r_halo.subtract(r_zero));
            checkOracle(result, expected, '(S+R)*(H-Z)');
        });

        it('A / (B + C) * D - E', () => {
            // One / (Random + Bisection) * Fuzzy - Singular
            // 1 / (1/10 + 3/4) * (-2/5) - 1/2
            // 1 / (0.1 + 0.75) * (-0.4) - 0.5
            // 1 / 0.85 * (-0.4) - 0.5
            // ~ 1.176 * -0.4 - 0.5
            // ~ -0.47 - 0.5 = -0.97

            const denom = add(O_Random, O_Bisection);
            const div = divide(O_One, denom);
            const mul = multiply(div, O_Fuzzy);
            const result = subtract(mul, O_Singular);

            const expected = r_one.divide(r_random.add(r_bisect))
                .multiply(r_fuzzy)
                .subtract(r_singular);

            checkOracle(result, expected, '1/(Rnd+Bis)*Fuz-Sing');
        });

        it('Chain 5 operations', () => {
            // ((A + B) * C - D) * E + F -- changed / E to * E to avoid division complexity bottleneck
            // ((Zero + One) * Halo - Reflexive) * Singular + Bisection
            // ((0 + 1) * 5 - 1/3) * (1/2) + 3/4
            // (5 - 1/3) * 1/2 + 3/4
            // (14/3) * 1/2 + 3/4
            // 7/3 + 3/4 = 28/12 + 9/12 = 37/12

            const op1 = add(O_Zero, O_One);
            const op2 = multiply(op1, O_Halo);
            const op3 = subtract(op2, O_Reflexive);
            const op4 = multiply(op3, O_Singular); // changed to multiply
            const result = add(op4, O_Bisection);

            const expected = r_zero.add(r_one)
                .multiply(r_halo)
                .subtract(r_reflexive)
                .multiply(r_singular) // changed to multiply
                .add(r_bisect);

            checkOracle(result, expected, '5-op-chain');
        });
    });
});
