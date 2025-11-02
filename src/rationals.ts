/* This is to implement various oracle versions of rationals. 
* Singular Oracle of q: given ab, delta, returns: (1, q:q) if q in ab, (0, q:q).
* Reflexive Oracle of q: given ab, delta, returns (1, a:b) if q in ab, (0, q:q).
* Halo[a:b, delta]: returns interval (a-delta, b+delta) assuming a<=b. 
* Fuzzy Reflexive Oracle of q: given ab, delta, returns (1, halo[a:b, delta]) if q in ab, (0) otherwise. 
* Halo Oracle of q: given ab, delta, let I = halo[q:q, delta/2], returns (1, I) if I intersects ab, (0, I) otherwise.
* Random Oracle of q: given ab, delta, and a random function f that takes in delta and returns rational deltaPrime between 0 and delta. 
Use deltaPrime/2 as in the Halo Oracle of q. 
* Bisection Oracle of (q, r0): given ab, delta, and the current ri, check if q:ri intersects ab. If not, then return (0, q:ri). 
If so, check if q:r_i is contained in halo(ab, delta). If so, then (1, q:ri) is the response. If not, then compute rnext = (ri+q)/2. Repeat until an 
answer is reached or a halting condition is reached (also given at oracle definition). If it halts from hitting that condition, return (-1).
*/

import { Rational, RationalInterval } from 'ratmath';
import { Answer, Oracle } from './types';

/*retHelper takes in an array <isYes, interval>, and returns Answer form of [array, null] This is for when there is no extra out*/
function retHelper(tuple): Answer {
    return [tuple, null];
}

const noop = (() => {}) as (...args: any[]) => any;

// Singular Oracle of q
export function singularOracle(q: Rational): Oracle {
  const oracle = (ab: RationalInterval, delta: Rational, input?: any): Answer => {
    if (ab.containsValue(q)) {
      return retHelper([1, new RationalInterval(q, q)]);
    } else {
      return retHelper([0, new RationalInterval(q, q)]);
    }
  };
  oracle.yes = new RationalInterval(q, q);
  oracle.update = noop;
  return oracle;
}

// Reflexive Oracle of q
export function reflexiveOracle(q: Rational): Oracle {
  const oracle = (ab: RationalInterval, delta: Rational, input?: any): Answer => {
    if (ab.containsValue(q)) {
      return retHelper([1, ab]);
    } else {
      return retHelper([0, new RationalInterval(q, q)]);
    }
  };
  oracle.yes = new RationalInterval(q, q);
  oracle.update = noop;
  return oracle;
}

// Halo function to create an interval expanded by delta
function halo(interval: RationalInterval, delta: Rational): RationalInterval {
  return new RationalInterval(interval.low.subtract(delta), interval.high.add(delta));
}

// Fuzzy Reflexive Oracle of q
export function fuzzyReflexiveOracle(q: Rational): Oracle {
  const oracle = (ab: RationalInterval, delta: Rational, input?: any): Answer => {
    if (ab.containsValue(q)) {
      return retHelper([1, halo(ab, delta)]);
    } else {
      return retHelper([0]);
    }
  };
  oracle.yes = new RationalInterval(q, q);
  oracle.update = noop;
  return oracle;
}

// Halo Oracle of q
export function haloOracle(q: Rational): Oracle {
  const oracle = (ab: RationalInterval, delta: Rational, input?: any): Answer => {
    const I = halo(new RationalInterval(q, q), delta.divide(new Rational(2)));
    if (ab.intersection(I) !== null) {
      return retHelper([1, I]);
    } else {
      return retHelper([0, I]);
    }
  };
  oracle.yes = new RationalInterval(q, q);
  oracle.update = noop;
  return oracle;
}

// Random Oracle of q
export function randomOracle(q: Rational, randomFunc: (delta: Rational) => Rational): Oracle {
  const oracle = (ab: RationalInterval, delta: Rational, input?: any): Answer => {
    let deltaPrime: Rational;
    if (typeof input === 'function') {
      deltaPrime = input(delta);  // Use the provided random function if available
    } else {
      deltaPrime = randomFunc(delta);
    }
    const I = halo(new RationalInterval(q, q), deltaPrime.divide(new Rational(2)));
    if (ab.intersection(I) !== null) {
      return retHelper([1, I]);
    } else {
      return retHelper([0, I]);
    }
  };
  oracle.yes = new RationalInterval(q, q);
  oracle.update = noop;
  return oracle;
}