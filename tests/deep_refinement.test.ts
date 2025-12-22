import { describe, it, expect, mock } from 'bun:test';
import { add } from '../src/arithmetic';
import { fromRational } from '../src/functions';
import { makeRational, toNumber, width } from '../src/ops';
import { Rational, RationalInterval as RMInterval } from '../src/ratmath';
import type { Oracle, Answer } from '../src/types';

describe('Deep Refinement', () => {
    it('triggers refinement on operands when high precision is requested', () => {
        // Create a mock-like oracle that tracks calls
        let precisionRequested: Rational | null = null;

        // An oracle representing 1, but tracks the smallest delta it was asked for
        const spyOracle: Oracle = ((ab: RMInterval, delta: Rational, _input?: any): Answer => {
            if (precisionRequested === null || delta.lessThan(precisionRequested)) {
                precisionRequested = delta;
            }
            // Always say yes if 1 is in bounds
            const q = makeRational(1);
            if (ab.containsValue(q)) {
                return [[1, new RMInterval(q, q)], null];
            }
            return [[0, new RMInterval(q, q)], null];
        }) as Oracle;
        spyOracle.yes = new RMInterval(makeRational(0), makeRational(2)); // Initial loose interval

        const oracleOne = fromRational(makeRational(1));

        // sum = spy + 1. We want to check if asking sum for delta triggers spy for delta/2
        const sumOracle = add(spyOracle, oracleOne);

        // Ask sum for precision 0.001
        const delta = new Rational(1, 1000);
        const target = new RMInterval(new Rational(19, 10), new Rational(21, 10)); // [1.9, 2.1]

        sumOracle(target, delta);

        expect(precisionRequested).not.toBeNull();
        // In our implementation, we refine by delta/2. 
        // 1/1000 = 0.001. Half is 0.0005.
        // Check if the requested precision is <= 0.0005. 
        // Note: Rational comparison.

        const expectedMaxParams = new Rational(1, 1900); // slightly larger than 1/2000
        // We expect precisionRequested <= 1/2000 roughly. 
        // Actually, implementation splits delta by 2.
        const halfDelta = new Rational(1, 2000);

        // The spy should have been called with approximately halfDelta
        if (precisionRequested) {
            // expect precisionRequested <= halfDelta
            expect(precisionRequested.lessThanOrEqual(halfDelta)).toBe(true);
        }
    });

    it('refines intervals recursively through addition', () => {
        // a = 1, b = 2. sum = 3.
        // We start with broad intervals.
        // asking sum for tight precision should tighten a and b.

        const a = fromRational(makeRational(1));
        const b = fromRational(makeRational(2));
        // Manually widen yes-intervals to simulate lack of knowledge
        a.yes = new RMInterval(makeRational(0), makeRational(10));
        b.yes = new RMInterval(makeRational(0), makeRational(10));

        const sum = add(a, b);
        // sum.yes should be [0, 20] initially
        expect(width(sum.yes) > 10).toBe(true);

        // Ask for high precision: check if sum is in [2.9, 3.1] with delta 0.001
        const target = new RMInterval(new Rational(29, 10), new Rational(31, 10)); // [2.9, 3.1]
        const delta = new Rational(1, 1000);

        const result = sum(target, delta);

        // The answer should be YES because 1+2=3 is in [2.9, 3.1]
        expect(result[0][0]).toBe(1);

        // Crucially, the side effect should be that a.yes and b.yes are now tight
        // because `bisect` was called on them.
        const widthA = width(a.yes);
        const widthB = width(b.yes);

        // They should be roughly size delta/2 (0.0005) or smaller
        expect(widthA < 0.01).toBe(true);
        expect(widthB < 0.01).toBe(true);
    });
});
