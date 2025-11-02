/* Helpers
This is for any common stuff that should likely be imported in other files.

ask: (oracle, ab, delta) => answer  This is just a wrapper for calling the oracle, 
but it also logs the call to history if that is enabled on the oracle
It also updates the Yes interval if a prophecy is generated and update flag is true.
If expensive is true, it will use Yes interval to short-circuit the call to check if Yes satisfies the question.

halo(interval, delta) => interval
This takes in an interval and a delta, and returns the interval expanded by delta on both sides.
For example, halo([1,2], 0.1) = [0.9, 2.1]
*/

import { Rational, RationalInterval } from './ratmath';
import { Answer, Oracle } from './types';


// Halo function to create an interval expanded by delta
export const halo = (interval: RationalInterval, delta: Rational): RationalInterval => {
  return new RationalInterval(interval.low.subtract(delta), interval.high.add(delta));
}




const updateYes = (oracle: Oracle, yes: RationalInterval) => {
  const oldYes = oracle.yes;
  if (!oldYes) {
    oracle.yes = yes;
  } else {
    const intersection = oldYes.intersection(yes);
    if (intersection !== null) {
      oracle.yes = intersection;
    }
  }
};

export const ask = (oracle:Oracle, ab: RationalInterval, delta: Rational, input?:any) => {
  if (oracle.expensive && oracle.yes) {
    const yes = oracle.yes;
    if (ab.intersection(yes) !== null) {
      if (halo(ab, delta).contains(yes)) {
        return {ans: 1, prophecy: yes};
      }
    } else {
      return {ans: 0, prophecy: yes};
    }
  }
  if (input === undefined) {
    input = oracle.internal ? oracle.internal() : undefined;
  }
  const answer = oracle(ab, delta, input);
  
  // Handle both Answer and LegacyAnswer formats
  const isLegacyAnswer = Array.isArray(answer);
  
  if (isLegacyAnswer) {
    // LegacyAnswer format: [[ans, interval?], extra]
    if (answer[1]?.extra && oracle.internal) {
      oracle.internal(answer[1].extra);
    }
    if (oracle.history) {
      oracle.history.push([ab, delta, input], answer);
    }
    const prophecy = answer[0][1];
    if (prophecy && oracle.update) {
      updateYes(oracle, prophecy);
    }
  } else {
    // Answer format: {ans, prophecy?, extra?}
    if (answer.extra && oracle.internal) {
      oracle.internal(answer.extra);
    }
    if (oracle.history) {
      oracle.history.push([ab, delta, input], answer);
    }
    if (answer.prophecy && oracle.update) {
      updateYes(oracle, answer.prophecy);
    }
  }
  
  return answer;
};
