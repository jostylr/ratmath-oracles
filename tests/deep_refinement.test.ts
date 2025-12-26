import { describe, it, expect } from 'bun:test';
import { add } from '../src/arithmetic';
import { fromRational } from '../src/functions';
import { makeRational, width } from '../src/ops';
import { Rational, RationalInterval as RMInterval } from '../src/ratmath';
import type { Oracle, Answer } from '../src/types';

describe('Deep Refinement', () => {
    it('triggers refinement on operands when high precision is requested', async () => {
        // Create a mock-like oracle that tracks calls
        let precisionRequested: Rational | null = null;

        // An oracle representing 1, but tracks the smallest delta it was asked for
        const spyOracle: Oracle = (async (ab: RMInterval, delta: Rational, _input?: any): Promise<Answer> => {
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

        // Attach narrowing spy
        spyOracle.narrowing = async (current: RMInterval, precision: Rational) => {
            if (precisionRequested === null || precision.lessThan(precisionRequested)) {
                precisionRequested = precision;
            }
            return new RMInterval(makeRational(1), makeRational(1));
        };

        const oracleOne = fromRational(makeRational(1));

        // sum = spy + 1. We want to check if asking sum for delta triggers spy for delta/2
        const sumOracle = add(spyOracle, oracleOne);

        // Ask sum for precision 0.001
        const delta = new Rational(1, 1000);
        const target = new RMInterval(new Rational(19, 10), new Rational(21, 10)); // [1.9, 2.1]

        await sumOracle(target, delta);

        expect(precisionRequested).not.toBeNull();

        // expect precisionRequested <= 1/2000
        const halfDelta = new Rational(1, 2000);

        if (precisionRequested) {
            expect(precisionRequested.lessThanOrEqual(halfDelta)).toBe(true);
        }
    });

    it('refines intervals recursively through addition', async () => {
        // Override fromRational relative to use test-like behavior to allow "refining" from broad yes.
        const makeBisc = (val: Rational, width: RMInterval) => {
            const o = fromRational(val);
            o.yes = width;
            o.narrowing = async (_current, _prec) => {
                return new RMInterval(val, val);
            };
            return o;
        };

        const a2 = makeBisc(makeRational(1), new RMInterval(makeRational(0), makeRational(10)));
        const b2 = makeBisc(makeRational(2), new RMInterval(makeRational(0), makeRational(10)));

        const sum = add(a2, b2);
        // Expect width > 10.
        expect(width(sum.yes) > 10).toBe(true);

        // Ask for high precision: check if sum is in [2.9, 3.1] with delta 0.001
        const target = new RMInterval(new Rational(29, 10), new Rational(31, 10)); // [2.9, 3.1]
        const delta = new Rational(1, 1000);

        const result = await sum(target, delta);

        // The answer should be YES because 1+2=3 is in [2.9, 3.1]
        expect(result[0][0]).toBe(1);

        // Crucially, the side effect should be that a.yes and b.yes are now tight
        expect(width(a2.yes) < 0.01).toBe(true);
        expect(width(b2.yes) < 0.01).toBe(true);
    });
});
