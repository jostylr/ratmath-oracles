/**
 * Basic Usage Examples for RatReals
 * 
 * This file demonstrates the fundamental operations with oracles.
 */

import { fromRational, fromInterval, makeOracle } from '../src/functions';
import { add, subtract, multiply, divide, negate } from '../src/arithmetic';
import { narrow } from '../src/narrowing';
import { Rational, RationalInterval } from '../src/ratmath';

// ============================================
// Example 1: Creating Oracles from Rationals
// ============================================

console.log('=== Example 1: Creating Oracles ===\n');

// Create an oracle representing the exact rational 3/4
const threeQuarters = fromRational(new Rational(3, 4));
console.log('Oracle for 3/4:');
console.log('  yes interval:', threeQuarters.yes.low.toString(), ':', threeQuarters.yes.high.toString());

// Create an oracle from an interval (representing uncertainty)
const approxPi = fromInterval(new RationalInterval(
  new Rational(314, 100),
  new Rational(315, 100)
));
console.log('\nOracle for π ≈ [3.14, 3.15]:');
console.log('  yes interval:', approxPi.yes.low.toString(), ':', approxPi.yes.high.toString());

// ============================================
// Example 2: Querying Oracles
// ============================================

console.log('\n=== Example 2: Querying Oracles ===\n');

// Query if the oracle's value is in a given interval
const queryInterval = new RationalInterval(new Rational(0), new Rational(1));
const delta = new Rational(1, 10);

const answer = threeQuarters(queryInterval, delta);
console.log('Is 3/4 in [0, 1]?');
console.log('  Answer:', answer[0][0] === 1 ? 'Yes' : 'No');
console.log('  Prophecy:', answer[0][1]?.low.toString(), ':', answer[0][1]?.high.toString());

// Query with interval that doesn't contain the value
const outsideInterval = new RationalInterval(new Rational(0), new Rational(1, 2));
const answer2 = threeQuarters(outsideInterval, delta);
console.log('\nIs 3/4 in [0, 1/2]?');
console.log('  Answer:', answer2[0][0] === 1 ? 'Yes' : 'No');

// ============================================
// Example 3: Arithmetic Operations
// ============================================

console.log('\n=== Example 3: Arithmetic Operations ===\n');

const a = fromRational(new Rational(1, 2));
const b = fromRational(new Rational(1, 3));

// Addition: 1/2 + 1/3 = 5/6
const sum = add(a, b);
console.log('1/2 + 1/3:');
console.log('  yes interval:', sum.yes.low.toString(), ':', sum.yes.high.toString());

// Subtraction: 1/2 - 1/3 = 1/6
const diff = subtract(a, b);
console.log('\n1/2 - 1/3:');
console.log('  yes interval:', diff.yes.low.toString(), ':', diff.yes.high.toString());

// Multiplication: 1/2 * 1/3 = 1/6
const prod = multiply(a, b);
console.log('\n1/2 * 1/3:');
console.log('  yes interval:', prod.yes.low.toString(), ':', prod.yes.high.toString());

// Division: (1/2) / (1/3) = 3/2
const quot = divide(a, b);
console.log('\n(1/2) / (1/3):');
console.log('  yes interval:', quot.yes.low.toString(), ':', quot.yes.high.toString());

// Negation: -(1/2) = -1/2
const neg = negate(a);
console.log('\n-(1/2):');
console.log('  yes interval:', neg.yes.low.toString(), ':', neg.yes.high.toString());

// ============================================
// Example 4: Narrowing Intervals
// ============================================

console.log('\n=== Example 4: Narrowing Intervals ===\n');

// Create an oracle with a wide initial interval
const wideOracle = fromInterval(new RationalInterval(
  new Rational(0),
  new Rational(10)
));

// For this demo, we use a rational oracle that we know is at 5
const five = fromRational(new Rational(5));

// Narrow the oracle to precision 1/100
const precision = new Rational(1, 100);
const narrowed = narrow(five, precision);
console.log('Narrowed oracle for 5 to precision 1/100:');
console.log('  yes interval:', narrowed.low.toString(), ':', narrowed.high.toString());

// ============================================
// Example 5: Chained Operations
// ============================================

console.log('\n=== Example 5: Chained Operations ===\n');

// Calculate (1/2 + 1/3) * (1/4 - 1/5) = (5/6) * (1/20) = 5/120 = 1/24
const x = fromRational(new Rational(1, 2));
const y = fromRational(new Rational(1, 3));
const z = fromRational(new Rational(1, 4));
const w = fromRational(new Rational(1, 5));

const result = multiply(add(x, y), subtract(z, w));
console.log('(1/2 + 1/3) * (1/4 - 1/5):');
console.log('  yes interval:', result.yes.low.toString(), ':', result.yes.high.toString());
console.log('  Expected: 1/24 =', new Rational(1, 24).toString());

console.log('\n=== Examples Complete ===');
