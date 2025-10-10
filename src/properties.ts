/*
This is, for a given oracle, designed to test whether

1. Range. For R(a:b, delta), the output should satisfy one of
  a. (1, c:d) c:d is a subinterval of the delta-neighborhood of a:b and intersects a:b
  b. (0, c:d) c:d is disjoint from a:b
  c. (0, null). There exists a delta' such that no prophecy intersects a:b and is contained in the delta'-neighborhood a:b. This allows for not computing a prophecy such as when directly checking if an interval works.
  d. (-1, null). This should not happen for an infinitely capable system. Here it is a flag that a computational limit has been reached and none of the three items above have been established. Formally, this is an option of there being no
2. Existence. There should be an interval a:b and delta such that R(a:b, delta) = (1, c:d) for some interval c:d. It is reasonable in a practical system to have R(c:d, delta) = (1, c:d) holding true. The third argument can hold a prophecy which can satisfy this in a minimal way.
3. Separation. Given any prophecy c:d and m contained in c:d and a delta > 0, then at least one of the following holds true: R(c:m, delta) = 1 or R(m:d, delta)=1.
4. Disjointness. If c:d is a prophecy and a:b is disjoint from c:d and delta is less than the distance between c:d and a:b, then R(a:b, delta) does not have an output containing 1.
5. Consistency. If a:b contains a prophecy of R, then R(a:b) does not have an output of 0.
6. Closed. If for each delta >0, the delta neighborhood (a)_delta contains a prophecy, then for all b, R(a:b) does not have an output of 0.
7. Reasonableness. If R(a:b, delta) is not -1, then R(a:b, delta') is not equal to -1 for all delta' > delta.

*/

import { Rational, RationalInterval } from 'ratmath';
import type { Answer, Oracle } from './types';


const randomRational = (upperNumerator = 1000, upperDenominator = 100): Rational => {
  const numerator = Math.floor(Math.random() * upperNumerator) + 1; // Random integer between 1 and 1000
  const denominator = Math.floor(Math.random() * upperDenominator) + 1; // Random integer between 1 and 100
  return new Rational(numerator, denominator);
}

const lengthScale = new Rational(1, 10); // Scale factor for delta computation

/* this takes in an oracle, an interval and an optional delta, creating  a delta equal to one‑tenth of the interval's length if not present,
and then invokes the oracle with that delta, returning its answer. */
const helper = (R: Oracle, ab: RationalInterval, delta?: Rational): Answer => {
  if (delta) {
    return R(ab, delta);
  }
  // Compute the length of the interval: (b - a)
  const length: Rational = ab.end.sub(ab.start);
  // If the length is zero, set delta to randomRational()
  delta = length.isZero() ? randomRational() : length.mul(lengthScale);
  // Run the oracle with the original interval and the computed delta.
  return R(ab, delta);
};

/*Existence
Every oracle should have at least one interval a:b and delta such that R(a:b, delta) = (1, c:d) for some interval c:d. This interval should be in the yes property
of the oracle. This looks at R, grabs the Yes interval if no interval is provided, computes a delta if not present via helper, and
gets the result from the helper function. It should return a positive result. If not, it returns false.
*/

const testExistence = (R: Oracle, {interval, delta} : {interval?: RationalInterval, delta?: Rational}): boolean => {
  // Grab the yes interval from the oracle
  if(!interval) {
    interval = R.yes;
  }
  if (!interval) return false;

  // Run the helper function on the yes interval
  const result = helper(R, interval, delta );
  return result[0][0] === 1;
};

/*Separation 
This should test the Separation property. It takes in an oracle, a prophecy interval, and a midpoint within that prophecy interval. It also takes in a delta value. It splits the prophecy interval into two subintervals at the midpoint and checks if at least one of the oracle calls on these subintervals returns a positive result (1). If neither does, it returns false.  
An interval can be given as well as a point in it. If no point is given, the midpoint is used. If no interval is given, the yes interval of the oracle is used.
Also the delta can be given or not. 
*/

const testSeparation = (R: Oracle, {prophecy, midpoint, delta}: {prophecy?: RationalInterval, midpoint?: Rational, delta?: Rational}): boolean => {
  // Split the prophecy interval into two subintervals at the midpoint
  if (!prophecy) {
    prophecy = R.yes;
    if (!prophecy) return false; // If there's no prophecy, we can't proceed
  }
  if (!midpoint) {
    midpoint = prophecy.start.add(prophecy.end).div(new Rational(2)); // Default to midpoint of the prophecy interval
  }
  if (midpoint.le(prophecy.start) || midpoint.ge(prophecy.end)) {
    throw new Error("Midpoint must be within the prophecy interval");
  }
  // Create two subintervals: [start, midpoint] and [midpoint, end]
  const leftInterval = new RationalInterval(prophecy.start, midpoint);
  const rightInterval = new RationalInterval(midpoint, prophecy.end);

  // Check if at least one of the oracle calls on these subintervals returns a positive result (1)
  const leftResult = helper(R, leftInterval, delta);  
  const rightResult = helper(R, rightInterval, delta);

  return leftResult[0][0] === 1 || rightResult[0][0] === 1;
};

/* Disjointness 
This tests the Disjointness property. It takes in an oracle, a prophecy interval, and a disjoint interval.
It computes a delta value that is scaled based on the scale or is one-tenth of the distance between the two intervals.
It checks that the oracle call on the disjoint interval with this delta does not return a positive result (1).
*/

const testDisjointness = (R: Oracle, {prophecy, disjoint, scale = lengthScale}: {prophecy?: RationalInterval, disjoint: RationalInterval, scale?: Rational}): boolean => {
  if (!prophecy) {
    prophecy = R.yes;
    if (!prophecy) return false; // If there's no prophecy, we can't proceed
  }
  // Compute the distance between the two intervals
  let distance: Rational;
  if (disjoint.end.le(prophecy.start)) {
    // disjoint is to the left of prophecy
    distance = prophecy.start.sub(disjoint.end);
  } else if (disjoint.start.ge(prophecy.end)) {
    // disjoint is to the right of prophecy
    distance = disjoint.start.sub(prophecy.end);
  } else {
    throw new Error("Intervals are not disjoint");
  }
  // Delta is a scale of that distance.
  const delta: Rational = distance.mul(scale);
  // Run the oracle with the disjoint interval and the computed delta.
  const result = R(disjoint, delta);
  return result[0][0] !== 1;
}

/*Consistency 
This test the Consistency property. It takes in an oracle, an optional prophecy interval, and an optional test interval. 
If no prophecy interval is provided, it uses the oracle's yes interval. 
If no test interval is provided, it generates an interval that contains the prophecy. 
It checks if the test interval contains the prophecy interval and if so, ensures that the oracle call on the test interval does not return a negative result (0). 
If the test interval does not contain the prophecy interval, it returns true by default.
A delta value is optional, with the default computed as one-tenth of the test interval's length.
*/
 const testConsistency = (R: Oracle, {prophecy, testInterval, delta}: {prophecy?: RationalInterval, testInterval?: RationalInterval, delta?: RationalInterval}): boolean => {
  if (!prophecy) {
    prophecy = R.yes;
    if (!prophecy) return true; // If there's no prophecy, we can't proceed, return true by default
  }
  if (!testInterval) {
    // Create a test interval that contains the prophecy
    // The padding will be a randomly (all positive fractions with denominator between 1 and 100 and numerator from 1 to 1000) 
    // scaled version of the prophecy length.
    const proLength = prophecy.end.sub(prophecy.start);
    const leftPadding = randomRational();
    const rightPadding = randomRational();
    testInterval = new RationalInterval(prophecy.start.sub(leftPadding.mul(proLength)), prophecy.end.add(rightPadding.mul(proLength)));
  }
  // Check if the test interval contains the prophecy interval
  if (testInterval.start.le(prophecy.start) && testInterval.end.ge(prophecy.end)) { 
    // Run the oracle on the test interval with a small delta
    const result = helper(R, testInterval, delta);
    return result[0][0] !== 0; // Ensure the result is not negative (0)
    } else {
    return true; // If the test interval does not contain the prophecy, return true by default
  }
}
  
/*Closed 
This test the Closed Property. It takes in an oracle, a point a, an optional second point, and an optional delta.
If no second point is provided, the interval is the interval a:a.
It checks that the interval receives a 1 in the oracle call with the computed delta.
The point a ought to have the property that it for each delta >0, the delta neighborhood (a)_delta contains a prophecy. 
This is not checked here.
*/

const testClosed = (R: Oracle, {a, b, delta}: {a: Rational, b?: Rational, delta?: Rational}): boolean => {
  if (!b) {
    b = a; // If no second point is provided, use a to create a singleton interval a:a
  }
  const result = helper(R, new RationalInterval(a, b), delta);
  return result[0][0] === 1;
};

/*Reasonableness 
This tests the Reasonableness property. It takes in an oracle, an interval, and a delta.
If the oracle call on the interval with the given delta does not return -1, 
it checks that the oracle call with any larger delta also does not return -1. 
If the initial call returns -1, it returns true by default.
*/

const testReasonableness = (R: Oracle, {interval, delta}: {interval: RationalInterval, delta: Rational}): boolean => {
  const initialResult = R(interval, delta);
  if (initialResult[0][0] === -1) {
    return true; // If the initial result is -1, return true by default
  }
  // Check for a few larger delta values
  const largerDeltas = [delta.mul(new Rational(2)), delta.mul(new Rational(3)), delta.add(new Rational(1))];
  for (const largerDelta of largerDeltas) {
    const result = R(interval, largerDelta);
    if (result[0][0] === -1) {
      return false; // If any larger delta returns -1, the property is violated
    }
  }
  return true; // All larger deltas returned non -1 results
};

export { testExistence, testSeparation, testDisjointness, testConsistency, testClosed, testReasonableness };


