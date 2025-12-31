// Central exports for ratmath library
// Import all ratmath types and re-export them for consistent usage across the codebase

import { Rational, RationalInterval } from '@ratmath/core';

// Re-export the main classes
export { Rational, RationalInterval };

// Also export some commonly used static properties for convenience
export const ZERO = Rational.zero;
export const ONE = Rational.one;

// Utility functions for creating rationals and intervals
export const createRational = (numerator: number | bigint, denominator?: number | bigint): Rational => {
  return new Rational(numerator, denominator);
};

export const createInterval = (low: Rational, high: Rational): RationalInterval => {
  return new RationalInterval(low, high);
};

export const createRationalInterval = (lowNum: number | bigint, lowDen: number | bigint, highNum: number | bigint, highDen: number | bigint): RationalInterval => {
  return new RationalInterval(new Rational(lowNum, lowDen), new Rational(highNum, highDen));
};
