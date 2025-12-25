/**
 * Custom Oracle Examples for RatReals
 * 
 * This file demonstrates how to create custom oracles for specialized computations.
 */

import { makeOracle, makeCustomOracle, fromRational } from '../src/functions';
import { narrow } from '../src/narrowing';
import { Rational, RationalInterval } from '../src/ratmath';
import { add, multiply } from '../src/arithmetic';

// ============================================
// Example 1: Square Root Oracle via Bisection
// ============================================

console.log('=== Example 1: Square Root Oracle ===\n');

/**
 * Creates an oracle for √n using interval bisection.
 * The oracle maintains an interval [low, high] where low² ≤ n ≤ high²
 */
function sqrtOracle(n: Rational): ReturnType<typeof makeCustomOracle> {
  // Initial interval: [0, max(1, n)]
  const one = new Rational(1);
  const initialHigh = n.greaterThan(one) ? n : one;
  const initialYes = new RationalInterval(Rational.zero, initialHigh);
  
  return makeCustomOracle(initialYes, (target, delta) => {
    // Get current yes interval
    const current = initialYes;
    
    // Bisect: check if midpoint² < n or midpoint² > n
    const mid = current.low.add(current.high).divide(new Rational(2));
    const midSquared = mid.multiply(mid);
    
    if (midSquared.lessThan(n)) {
      // √n is in [mid, high]
      return new RationalInterval(mid, current.high);
    } else {
      // √n is in [low, mid]
      return new RationalInterval(current.low, mid);
    }
  });
}

// Create oracle for √2
const sqrt2 = sqrtOracle(new Rational(2));
console.log('Oracle for √2:');
console.log('  Initial yes:', sqrt2.yes.low.toString(), ':', sqrt2.yes.high.toString());

// Narrow to find √2 ≈ 1.414...
const sqrt2Approx = narrow(sqrt2, new Rational(1, 1000));
console.log('  Narrowed to 1/1000:', sqrt2Approx.low.toString(), ':', sqrt2Approx.high.toString());

// ============================================
// Example 2: Golden Ratio Oracle
// ============================================

console.log('\n=== Example 2: Golden Ratio Oracle ===\n');

/**
 * Creates an oracle for φ = (1 + √5) / 2
 * φ satisfies: φ² = φ + 1
 */
function goldenRatioOracle(): ReturnType<typeof makeCustomOracle> {
  // φ is between 1 and 2
  const initialYes = new RationalInterval(new Rational(1), new Rational(2));
  
  return makeCustomOracle(initialYes, (target, delta) => {
    const current = initialYes;
    const mid = current.low.add(current.high).divide(new Rational(2));
    
    // Check if mid² < mid + 1 (meaning mid < φ)
    const midSquared = mid.multiply(mid);
    const midPlusOne = mid.add(new Rational(1));
    
    if (midSquared.lessThan(midPlusOne)) {
      return new RationalInterval(mid, current.high);
    } else {
      return new RationalInterval(current.low, mid);
    }
  });
}

const phi = goldenRatioOracle();
console.log('Oracle for φ (golden ratio):');
console.log('  Initial yes:', phi.yes.low.toString(), ':', phi.yes.high.toString());

const phiApprox = narrow(phi, new Rational(1, 10000));
console.log('  Narrowed to 1/10000:', phiApprox.low.toString(), ':', phiApprox.high.toString());
console.log('  φ ≈ 1.6180339887...');

// ============================================
// Example 3: Compound Expression Oracle
// ============================================

console.log('\n=== Example 3: Compound Expressions ===\n');

// Calculate 2 * (3/4 + 1/5) using oracle arithmetic
const twoOracle = fromRational(new Rational(2));
const threeQuarters = fromRational(new Rational(3, 4));
const oneFifth = fromRational(new Rational(1, 5));

// 2 * (3/4 + 1/5) = 2 * (19/20) = 38/20 = 19/10
const sum = add(threeQuarters, oneFifth);
const result = multiply(twoOracle, sum);

console.log('2 * (3/4 + 1/5):');
console.log('  yes interval:', result.yes.low.toString(), ':', result.yes.high.toString());
console.log('  Expected: 19/10');

// Query the result
const testInterval = new RationalInterval(new Rational(19, 10), new Rational(19, 10));
const answer = result(testInterval, new Rational(1, 100));
console.log('  Is result exactly 19/10?', answer[0][0] === 1 ? 'Yes' : 'No');

// ============================================
// Example 4: Oracle with Custom Narrowing
// ============================================

console.log('\n=== Example 4: Custom Narrowing Strategy ===\n');

/**
 * An oracle that uses Newton's method-style narrowing for cube roots.
 */
function cubeRootOracle(n: Rational): ReturnType<typeof makeCustomOracle> {
  const one = new Rational(1);
  const initialHigh = n.abs().greaterThan(one) ? n.abs() : one;
  const initialYes = n.greaterThanOrEqual(Rational.zero)
    ? new RationalInterval(Rational.zero, initialHigh)
    : new RationalInterval(initialHigh.negate(), Rational.zero);
  
  return makeCustomOracle(initialYes, (target, delta) => {
    const current = initialYes;
    const mid = current.low.add(current.high).divide(new Rational(2));
    const midCubed = mid.multiply(mid).multiply(mid);
    
    if (n.greaterThanOrEqual(Rational.zero)) {
      if (midCubed.lessThan(n)) {
        return new RationalInterval(mid, current.high);
      } else {
        return new RationalInterval(current.low, mid);
      }
    } else {
      if (midCubed.greaterThan(n)) {
        return new RationalInterval(mid, current.high);
      } else {
        return new RationalInterval(current.low, mid);
      }
    }
  });
}

const cubeRoot8 = cubeRootOracle(new Rational(8));
console.log('Oracle for ∛8:');
const cubeRoot8Approx = narrow(cubeRoot8, new Rational(1, 100));
console.log('  Narrowed:', cubeRoot8Approx.low.toString(), ':', cubeRoot8Approx.high.toString());
console.log('  Expected: 2');

console.log('\n=== Examples Complete ===');
