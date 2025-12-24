import { describe, it, expect } from 'bun:test';
import { Rational, RationalInterval } from '../src/ratmath';
import { nRoot, nRootTest, KantorovichRoot, IVTRoot } from '../src/roots';
import { Oracle } from '../src/types';
import { narrow } from '../src/narrowing';

describe('Root Finding Oracles', () => {

    const checkOracle = (oracle: Oracle, expectedVal: Rational, name: string) => {
        const delta = new Rational(1, 10000); // High precision
        const out = narrow(oracle, delta);

        if (!out.containsValue(expectedVal)) {
            console.error(`Failed ${name} (Correctness): narrow result [${out.low.toString()}, ${out.high.toString()}] does not contain ${expectedVal.toString()}`);
        }
        expect(out.containsValue(expectedVal)).toBe(true);

        const w = out.high.subtract(out.low);
        // target width roughly delta
        expect(w.lessThan(delta)).toBe(true);
    };

    describe('nRoot (Newton)', () => {
        it('Square root of 2', () => {
            // x^2 = 2
            const q = new Rational(2);
            const guess = new Rational(3, 2); // 1.5
            const oracle = nRoot(q, guess, 2);

            // Expected: sqrt(2) is irrational, but we check if it converges to an interval containing it.
            // We can check if square of interval contains 2.

            const delta = new Rational(1, 1000000);
            const out = narrow(oracle, delta);
            const sqLow = out.low.pow(2);
            const sqHigh = out.high.pow(2);

            // 2 should be between sqLow and sqHigh
            expect(sqLow.lessThanOrEqual(q)).toBe(true);
            expect(sqHigh.greaterThanOrEqual(q)).toBe(true);

            // Check width
            const w = out.high.subtract(out.low);
            expect(w.lessThan(delta)).toBe(true);
        });

        it('Cube root of 27', () => {
            const q = new Rational(27);
            const guess = new Rational(5);
            const oracle = nRoot(q, guess, 3);

            checkOracle(oracle, new Rational(3), 'cbrt(27)');
        });
    });

    describe('nRootTest', () => {
        it('Square root of 4 is 2', () => {
            const q = new Rational(4);
            const yes = new RationalInterval(new Rational(0), new Rational(4));
            const oracle = nRootTest(q, yes, 2);

            checkOracle(oracle, new Rational(2), 'sqrt(4)=2');
        });
    });

    describe('KantorovichRoot', () => {
        it('Solve x^2 - 2 = 0', () => {
            // f(x) = x^2 - 2
            const f = (x: Rational) => x.pow(2).subtract(new Rational(2));
            // f'(x) = 2x
            const fprime = (x: Rational) => x.multiply(new Rational(2));

            // Guess 1.5
            const guess = new Rational(3, 2);
            // Domain [1, 2]
            const domain = new RationalInterval(new Rational(1), new Rational(2));
            // f''(x) = 2. maxpp = 2
            const maxpp = new Rational(2);
            // f'(x) = 2x. min on [1, 2] is 2. minp = 2
            const minp = new Rational(2);

            const oracle = KantorovichRoot({ f, fprime, guess, domain, maxpp, minp });

            const delta = new Rational(1, 1000000);
            const out = narrow(oracle, delta);

            const sqLow = out.low.pow(2);
            const sqHigh = out.high.pow(2);

            expect(sqLow.lessThanOrEqual(new Rational(2))).toBe(true);
            expect(sqHigh.greaterThanOrEqual(new Rational(2))).toBe(true);
        });
    });

    describe('IVTRoot', () => {
        it('Solve x^2 - 2 = 0 on [1, 2]', () => {
            const f = (x: Rational) => x.pow(2).subtract(new Rational(2));
            const initial = new RationalInterval(new Rational(1), new Rational(2));

            const oracle = IVTRoot(f, initial);

            const delta = new Rational(1, 100);
            const out = narrow(oracle, delta);

            const sqLow = out.low.pow(2);
            const sqHigh = out.high.pow(2);

            expect(sqLow.lessThanOrEqual(new Rational(2))).toBe(true);
            expect(sqHigh.greaterThanOrEqual(new Rational(2))).toBe(true);
        });
    });

});
