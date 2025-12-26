import { describe, it, expect, mock } from 'bun:test';
import { add, subtract, multiply, divide } from '../src/arithmetic';
import { fromRational } from '../src/functions';
import { makeRational, toNumber } from '../src/ops';
import { Rational, RationalInterval } from '../src/ratmath';
import { setLogger } from '../src/logger';
import type { Answer } from '../src/types';

describe('arithmetic oracles', () => {
  it('minimal oracle call test', async () => {
    console.log('Starting minimal test');
    const qa = makeRational(3);
    const oracleA = fromRational(qa);
    console.log('Created oracle, yes:', toNumber(oracleA.yes.low), '-', toNumber(oracleA.yes.high));

    const testInterval = new RationalInterval(new Rational(29, 10), new Rational(31, 10));
    const delta = new Rational(1, 1000);

    console.log('About to call oracle with interval [2.9, 3.1]');
    const result = await oracleA(testInterval, delta) as Answer;
    console.log('Oracle returned:', result[0][0]);
    expect(result[0][0]).toBe(1);
    console.log('Minimal test completed');
  });

  it('add: oracle(a) + oracle(b) matches oracle(a+b)', async () => {
    console.log('Starting add test');
    // Create two rational values
    const qa = makeRational(3);
    const qb = makeRational(5);

    // Create oracles from rationals
    const oracleA = fromRational(qa);
    const oracleB = fromRational(qb);
    console.log('Created oracles A and B');

    // Perform arithmetic on oracles
    const oracleSum = add(oracleA, oracleB);
    console.log('Created oracleSum, yes:', toNumber(oracleSum.yes.low), '-', toNumber(oracleSum.yes.high));

    // Perform arithmetic on rationals, then create oracle
    const qSum = qa.add(qb);
    const oracleExpected = fromRational(qSum);
    console.log('Created oracleExpected, yes:', toNumber(oracleExpected.yes.low), '-', toNumber(oracleExpected.yes.high));

    // Test with several narrow intervals
    const testIntervals = [
      new RationalInterval(new Rational(79, 10), new Rational(81, 10)),
      new RationalInterval(new Rational(799, 100), new Rational(801, 100)),
      new RationalInterval(makeRational(8), makeRational(8)),
      new RationalInterval(makeRational(10), makeRational(12)),
    ];

    const delta = new Rational(1, 1000);

    for (const [idx, interval] of testIntervals.entries()) {
      console.log(`Testing interval ${idx}: [${toNumber(interval.low)}, ${toNumber(interval.high)}]`);
      console.log('  Calling oracleSum...');
      const resultSum = await oracleSum(interval, delta) as Answer;
      console.log('  oracleSum returned:', resultSum[0][0]);
      console.log('  Calling oracleExpected...');
      const resultExpected = await oracleExpected(interval, delta) as Answer;
      console.log('  oracleExpected returned:', resultExpected[0][0]);

      // Both should give same YES/NO answer
      expect(resultSum[0][0]).toBe(resultExpected[0][0]);
    }
    console.log('Add test completed');
  });

  it('subtract: oracle(a) - oracle(b) matches oracle(a-b)', async () => {
    const qa = makeRational(10);
    const qb = makeRational(3);

    const oracleA = fromRational(qa);
    const oracleB = fromRational(qb);
    const oracleDiff = subtract(oracleA, oracleB);

    const qDiff = qa.subtract(qb);
    const oracleExpected = fromRational(qDiff);

    const testIntervals = [
      new RationalInterval(new Rational(69, 10), new Rational(71, 10)),
      new RationalInterval(makeRational(7), makeRational(7)),
      new RationalInterval(makeRational(5), makeRational(6)),
    ];

    const delta = new Rational(1, 1000);

    for (const interval of testIntervals) {
      const resultDiff = await oracleDiff(interval, delta) as Answer;
      const resultExpected = await oracleExpected(interval, delta) as Answer;
      expect(resultDiff[0][0]).toBe(resultExpected[0][0]);
    }
  });

  it('multiply: oracle(a) * oracle(b) matches oracle(a*b)', async () => {
    const qa = makeRational(4);
    const qb = makeRational(6);

    const oracleA = fromRational(qa);
    const oracleB = fromRational(qb);
    const oracleProd = multiply(oracleA, oracleB);

    const qProd = qa.multiply(qb);
    const oracleExpected = fromRational(qProd);

    const testIntervals = [
      new RationalInterval(new Rational(239, 10), new Rational(241, 10)),
      new RationalInterval(makeRational(24), makeRational(24)),
      new RationalInterval(makeRational(20), makeRational(25)),
      new RationalInterval(makeRational(30), makeRational(40)),
    ];

    const delta = new Rational(1, 1000);

    for (const interval of testIntervals) {
      const resultProd = await oracleProd(interval, delta) as Answer;
      const resultExpected = await oracleExpected(interval, delta) as Answer;
      expect(resultProd[0][0]).toBe(resultExpected[0][0]);
    }
  });

  it('divide: oracle(a) / oracle(b) matches oracle(a/b)', async () => {
    const qa = makeRational(15);
    const qb = makeRational(3);

    const oracleA = fromRational(qa);
    const oracleB = fromRational(qb);
    const oracleQuot = divide(oracleA, oracleB);

    const qQuot = qa.divide(qb);
    const oracleExpected = fromRational(qQuot);

    const testIntervals = [
      new RationalInterval(new Rational(49, 10), new Rational(51, 10)),
      new RationalInterval(makeRational(5), makeRational(5)),
      new RationalInterval(makeRational(3), makeRational(6)),
      new RationalInterval(makeRational(10), makeRational(20)),
    ];

    const delta = new Rational(1, 1000);

    for (const interval of testIntervals) {
      const resultQuot = await oracleQuot(interval, delta) as Answer;
      const resultExpected = await oracleExpected(interval, delta) as Answer;
      expect(resultQuot[0][0]).toBe(resultExpected[0][0]);
    }
  });

  it('division warns when denom yes contains zero and throws for known zero', () => {
    const warn = mock(() => { });
    setLogger({ warn });

    const qa = makeRational(10);
    const oracleNumer = fromRational(qa);

    const qDenomNeg = makeRational(-1);
    const qDenomPos = makeRational(1);
    const oracleDenomSpan = fromRational(qDenomNeg);
    // Manually set yes to span zero
    oracleDenomSpan.yes = new RationalInterval(qDenomNeg, qDenomPos);

    const d1 = divide(oracleNumer, oracleDenomSpan);
    expect(warn).toHaveBeenCalled();

    const qZero = makeRational(0);
    const oracleDenomZero = fromRational(qZero);
    expect(() => divide(oracleNumer, oracleDenomZero)).toThrowError();
  });

  it('arithmetic with fractional rationals', async () => {
    const qa = new Rational(7, 3);
    const qb = new Rational(5, 2);

    const oracleA = fromRational(qa);
    const oracleB = fromRational(qb);

    const oracleSum = add(oracleA, oracleB);
    const qSum = qa.add(qb);
    const oracleExpectedSum = fromRational(qSum);

    const testInterval = new RationalInterval(
      new Rational(48, 10),
      new Rational(49, 10)
    );
    const delta = new Rational(1, 100);

    const resultSum = await oracleSum(testInterval, delta) as Answer;
    const resultExpectedSum = await oracleExpectedSum(testInterval, delta) as Answer;
    expect(resultSum[0][0]).toBe(resultExpectedSum[0][0]);

    const oracleProd = multiply(oracleA, oracleB);
    const qProd = qa.multiply(qb);
    const oracleExpectedProd = fromRational(qProd);

    const testInterval2 = new RationalInterval(
      new Rational(58, 10),
      new Rational(59, 10)
    );

    const resultProd = await oracleProd(testInterval2, delta) as Answer;
    const resultExpectedProd = await oracleExpectedProd(testInterval2, delta) as Answer;
    expect(resultProd[0][0]).toBe(resultExpectedProd[0][0]);
  });
});

