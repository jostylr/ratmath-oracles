// Type declarations for ratmath library
// This file provides TypeScript type definitions for Rational and RationalInterval classes

declare module 'ratmath' {
  export class Rational {
    constructor(numerator: number | bigint, denominator?: number | bigint);
    
    readonly numerator: bigint;
    readonly denominator: bigint;
    
    // Arithmetic operations
    add(other: Rational): Rational;
    subtract(other: Rational): Rational;
    multiply(other: Rational): Rational;
    divide(other: Rational): Rational;
    negate(): Rational;
    reciprocal(): Rational;
    pow(exponent: number): Rational;
    
    // Comparison operations
    equals(other: Rational): boolean;
    compareTo(other: Rational): number;
    lessThan(other: Rational): boolean;
    lessThanOrEqual(other: Rational): boolean;
    greaterThan(other: Rational): boolean;
    greaterThanOrEqual(other: Rational): boolean;
    
    // Utility methods
    abs(): Rational;
    toString(): string;
    toMixedString(): string;
    toNumber(): number;
    toDecimal(precision?: number): string;
    toRepeatingDecimal(): string;
    toScientificNotation(): string;
    toContinuedFraction(): number[];
    toContinuedFractionString(): string;
    
    // Static properties
    static zero: Rational;
    static one: Rational;
    
    // Static methods
    static E(numerator: number | bigint, denominator?: number | bigint): Rational;
  }
  
  export class RationalInterval {
    constructor(low: Rational, high: Rational);
    
    readonly low: Rational;
    readonly high: Rational;
    
    // Arithmetic operations
    add(other: RationalInterval): RationalInterval;
    subtract(other: RationalInterval): RationalInterval;
    multiply(other: RationalInterval): RationalInterval;
    divide(other: RationalInterval): RationalInterval;
    negate(): RationalInterval;
    reciprocate(): RationalInterval;
    pow(exponent: number): RationalInterval;
    
    // Set operations
    intersection(other: RationalInterval): RationalInterval | null;
    union(other: RationalInterval): RationalInterval;
    overlaps(other: RationalInterval): boolean;
    contains(other: RationalInterval): boolean;
    containsValue(value: Rational): boolean;
    containsZero(): boolean;
    equals(other: RationalInterval): boolean;
    
    // Utility methods
    toString(): string;
    toMixedString(): string;
    toRepeatingDecimal(): string;
    compactedDecimalInterval(): string;
    relativeMidDecimalInterval(): string;
    relativeDecimalInterval(): string;
    mediant(): Rational;
    midpoint(): Rational;
    shortestDecimal(): string;
    randomRational(): Rational;
    
    // Static methods
    static E(low: Rational, high: Rational): RationalInterval;
  }
}
