import { describe, it, expect } from 'bun:test';
import {
  singularOracle,
  reflexiveOracle,
  fuzzyReflexiveOracle,
  haloOracle,
  randomOracle,
  bisectionOracle
} from '../src/rationals';
import { add, subtract, multiply, divide } from '../src/arithmetic';
import { fromRational } from '../src/functions';
import { Rational, RationalInterval } from '../src/ratmath';
import { Answer } from '../src/types';

describe('rational oracles', () => {
  const q = new Rational(3, 4); // 3/4
  const intervalContainingQ = new RationalInterval(new Rational(1, 2), new Rational(1)); // [1/2, 1]
  const intervalNotContainingQ = new RationalInterval(new Rational(1), new Rational(2)); // [1, 2]
  const delta = new Rational(1, 10); // 1/10

  describe('singularOracle', () => {
    it('returns (1, q:q) when q is in interval', async () => {
      const oracle = singularOracle(q);
      const result = await oracle(intervalContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(1);
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('returns (0, q:q) when q is not in interval', async () => {
      const oracle = singularOracle(q);
      const result = await oracle(intervalNotContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(0);
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('has correct yes interval', () => {
      const oracle = singularOracle(q);
      expect(oracle.yes.low.equals(q)).toBe(true);
      expect(oracle.yes.high.equals(q)).toBe(true);
    });
  });

  describe('reflexiveOracle', () => {
    it('returns (1, a:b) when q is in interval', async () => {
      const oracle = reflexiveOracle(q);
      const result = await oracle(intervalContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(1);
      // Returns tightest knwon bounds (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('returns (0, q:q) when q is not in interval', async () => {
      const oracle = reflexiveOracle(q);
      const result = await oracle(intervalNotContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(0);
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('has correct yes interval', () => {
      const oracle = reflexiveOracle(q);
      expect(oracle.yes.low.equals(q)).toBe(true);
      expect(oracle.yes.high.equals(q)).toBe(true);
    });
  });

  describe('fuzzyReflexiveOracle', () => {
    it('returns (1, halo[a:b, delta]) when q is in interval', async () => {
      const oracle = fuzzyReflexiveOracle(q);
      const result = await oracle(intervalContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(1);
      // Returns tightest bounds (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('returns (0) when q is not in interval', async () => {
      const oracle = fuzzyReflexiveOracle(q);
      const result = await oracle(intervalNotContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(0);
      // Returns currentYes (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
    });

    it('has correct yes interval', () => {
      const oracle = fuzzyReflexiveOracle(q);
      expect(oracle.yes.low.equals(q)).toBe(true);
      expect(oracle.yes.high.equals(q)).toBe(true);
    });
  });

  describe('haloOracle', () => {
    it('returns (1, I) when halo intersects interval', async () => {
      const oracle = haloOracle(q);
      const closeInterval = new RationalInterval(new Rational(7, 10), new Rational(8, 10)); // [0.7, 0.8]
      const result = await oracle(closeInterval, delta) as Answer;

      expect(result[0][0]).toBe(1);
      // Returns tightest bounds (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('returns (0, I) when halo does not intersect interval', async () => {
      const oracle = haloOracle(q);
      const result = await oracle(intervalNotContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(0);
      // Returns currentYes (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
    });

    it('has correct yes interval', () => {
      const oracle = haloOracle(q);
      expect(oracle.yes.low.equals(q)).toBe(true);
      expect(oracle.yes.high.equals(q)).toBe(true);
    });
  });

  describe('randomOracle', () => {
    it('uses provided random function', async () => {
      const mockRandomFunc = (delta: Rational) => delta.divide(new Rational(2));
      const oracle = randomOracle(q, mockRandomFunc);
      const result = await oracle(intervalContainingQ, delta) as Answer;

      expect(result[0][0]).toBe(1);
      // Returns tightest bounds (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('uses input function when provided', async () => {
      const mockRandomFunc = (delta: Rational) => delta;
      const inputFunc = (delta: Rational) => delta.divide(new Rational(3));
      const oracle = randomOracle(q, mockRandomFunc);
      const result = await oracle(intervalContainingQ, delta, inputFunc) as Answer;

      expect(result[0][0]).toBe(1);
      // Returns tightest bounds (q:q)
      expect(result[0][1]!.low.equals(q)).toBe(true);
      expect(result[0][1]!.high.equals(q)).toBe(true);
    });

    it('has correct yes interval', () => {
      const oracle = randomOracle(q, () => delta);
      expect(oracle.yes.low.equals(q)).toBe(true);
      expect(oracle.yes.high.equals(q)).toBe(true);
    });
  });
});

describe('rational oracle arithmetic commutation', () => {
  const q1 = new Rational(3, 4); // 3/4
  const q2 = new Rational(2, 3); // 2/3
  const delta = new Rational(1, 100);

  describe('addition commutation', () => {
    it('singularOracle: convert->add equals add->convert', () => {
      // Convert to arithmetic oracle then add
      const arithOracle1 = fromRational(q1);
      const arithOracle2 = fromRational(q2);
      const addedArith = add(arithOracle1, arithOracle2);

      // Add rational values then convert
      const sum = q1.add(q2);
      const convertedSum = fromRational(sum);

      expect(addedArith.yes.low.equals(convertedSum.yes.low)).toBe(true);
      expect(addedArith.yes.high.equals(convertedSum.yes.high)).toBe(true);
    });
  });

  describe('subtraction commutation', () => {
    it('singularOracle: convert->subtract equals subtract->convert', () => {
      const arithOracle1 = fromRational(q1);
      const arithOracle2 = fromRational(q2);
      const subArith = subtract(arithOracle1, arithOracle2);

      const diff = q1.subtract(q2);
      const convertedDiff = fromRational(diff);

      expect(subArith.yes.low.equals(convertedDiff.yes.low)).toBe(true);
      expect(subArith.yes.high.equals(convertedDiff.yes.high)).toBe(true);
    });
  });

  describe('multiplication commutation', () => {
    it('singularOracle: convert->multiply equals multiply->convert', () => {
      const arithOracle1 = fromRational(q1);
      const arithOracle2 = fromRational(q2);
      const mulArith = multiply(arithOracle1, arithOracle2);

      const product = q1.multiply(q2);
      const convertedProduct = fromRational(product);

      expect(mulArith.yes.low.equals(convertedProduct.yes.low)).toBe(true);
      expect(mulArith.yes.high.equals(convertedProduct.yes.high)).toBe(true);
    });
  });

  describe('division commutation', () => {
    it('singularOracle: convert->divide equals divide->convert', () => {
      const arithOracle1 = fromRational(q1);
      const arithOracle2 = fromRational(q2);
      const divArith = divide(arithOracle1, arithOracle2);

      const quotient = q1.divide(q2);
      const convertedQuotient = fromRational(quotient);

      expect(divArith.yes.low.equals(convertedQuotient.yes.low)).toBe(true);
      expect(divArith.yes.high.equals(convertedQuotient.yes.high)).toBe(true);
    });
  });

  describe('oracle type arithmetic consistency', () => {
    it('different oracle types give same arithmetic results', () => {
      // These are just checking the 'yes' interval compatibility property, which is synchronous.
      const singular = singularOracle(q1);
      const reflexive = reflexiveOracle(q1);
      const fuzzy = fuzzyReflexiveOracle(q1);
      const halo = haloOracle(q1);

      expect(singular.yes.low.equals(reflexive.yes.low)).toBe(true);
      expect(singular.yes.low.equals(fuzzy.yes.low)).toBe(true);
      expect(singular.yes.low.equals(halo.yes.low)).toBe(true);

      const arithSingular = fromRational(q1);
      const arithReflexive = fromRational(q1);
      const arithFuzzy = fromRational(q1);
      const arithHalo = fromRational(q1);

      expect(arithSingular.yes.low.equals(arithReflexive.yes.low)).toBe(true);
      expect(arithSingular.yes.low.equals(arithFuzzy.yes.low)).toBe(true);
      expect(arithSingular.yes.low.equals(arithHalo.yes.low)).toBe(true);
    });
  });

  describe('complex arithmetic chains', () => {
    it('handles chained operations with rational oracle conversion', () => {
      const q1 = new Rational(1, 2);
      const q2 = new Rational(1, 3);
      const q3 = new Rational(1, 4);

      const arith1 = fromRational(q1);
      const arith2 = fromRational(q2);
      const arith3 = fromRational(q3);

      const result1 = add(arith1, multiply(arith2, arith3));
      const expected1 = fromRational(q1.add(q2.multiply(q3)));

      expect(result1.yes.low.equals(expected1.yes.low)).toBe(true);

      const result2 = subtract(divide(arith1, arith2), arith3);
      const expected2 = fromRational(q1.divide(q2).subtract(q3));

      expect(result2.yes.low.equals(expected2.yes.low)).toBe(true);
    });
  });
});
