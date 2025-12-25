// Central type definitions for the ratreals package
// This file exports all types used throughout the codebase

// Import ratmath types first
import { Rational, RationalInterval } from '../ratmath';

// Core oracle and answer types
export type { Answer, Oracle } from './oracle';

// Re-export ratmath types for convenience
export { Rational, RationalInterval } from '../ratmath';

// Additional utility types
export type RationalIntervalLike = {
  low: Rational;
  high: Rational;
};

// Import types for use in utility types
import type { Answer as TAnswer, Oracle as TOracle } from './oracle';

export type OracleFunction = (ab: RationalInterval, delta: Rational, input?: any) => TAnswer;

export type OracleResult = {
  ans: 1 | 0 | -1;
  prophecy?: RationalInterval;
  extra?: any;
};

// Type guards
export function isOracle(obj: any): obj is TOracle {
  return typeof obj === 'function' && 'yes' in obj;
}

export function isRational(obj: any): obj is Rational {
  return obj && typeof obj === 'object' && 'numerator' in obj && 'denominator' in obj;
}

export function isRationalInterval(obj: any): obj is RationalInterval {
  return obj && typeof obj === 'object' && 'low' in obj && 'high' in obj && isRational(obj.low) && isRational(obj.high);
}
