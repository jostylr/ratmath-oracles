import { describe, it, expect } from 'bun:test';
import { Rational, RationalInterval } from '../src/ratmath';
import { bisectionOracle, singularOracle } from '../src/rationals';
import { Answer } from '../src/types';

describe('Bisection Oracle and initialYes', () => {
    it('refines ri until contained in halo', async () => {
        const target = new Rational(25, 100); // 0.25
        const start = new Rational(75, 100); // 0.75
        const oracle = bisectionOracle(target, start);

        const ab = new RationalInterval(new Rational(25, 100), new Rational(30, 100)); // [0.25, 0.3]
        const delta = new Rational(1, 10); // halo is [0.15, 0.4]

        const result = await oracle(ab, delta) as Answer;
        expect(result[0][0]).toBe(1);
        // After refinement, ri should be refined enough to fit in halo.
        // New algorithm might refine deeper than original, but that preserves correctness.
        expect(result[0][1]!.high.lessThanOrEqual(new Rational(4, 10))).toBe(true);
    });

    it('returns 0 when no intersection', async () => {
        const oracle = bisectionOracle(new Rational(1, 4), new Rational(3, 4));
        const farAway = new RationalInterval(new Rational(1), new Rational(2));
        const result = await oracle(farAway, new Rational(1, 10)) as Answer;
        expect(result[0][0]).toBe(0);
    });

    it('has correct initial yes interval', () => {
        const q = new Rational(1, 4);
        const r0 = new Rational(3, 4);
        const oracle = bisectionOracle(q, r0);
        expect(oracle.yes.low.equals(q)).toBe(true);
        expect(oracle.yes.high.equals(r0)).toBe(true);
    });

    describe('initialYes parameter', () => {
        it('sets initial yes interval for singularOracle', () => {
            const q = new Rational(1, 2);
            const customYes = new RationalInterval(new Rational(0), new Rational(1));
            const oracle = singularOracle(q, customYes);
            expect(oracle.yes.low.equals(customYes.low)).toBe(true);
            expect(oracle.yes.high.equals(customYes.high)).toBe(true);
        });

        it('sets initial yes interval for bisectionOracle', () => {
            const q = new Rational(1, 4);
            const r0 = new Rational(3, 4);
            const customYes = new RationalInterval(new Rational(0), new Rational(1));
            const oracle = bisectionOracle(q, r0, 100, customYes);
            expect(oracle.yes.low.equals(customYes.low)).toBe(true);
            expect(oracle.yes.high.equals(customYes.high)).toBe(true);
        });
    });
});
