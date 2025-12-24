// Public-facing types for oracles, using ratmath classes directly.
import { Rational, RationalInterval } from '../ratmath';

// Tuple-based Answer format (formerly LegacyAnswer)
// [ [status, interval], extra_info ]
// status: 1 (Yes), 0 (No), -1 (Maybe/Abort)
export type Answer = [[1 | 0 | -1, RationalInterval?], any];

export interface Oracle {
  (ab: RationalInterval, delta: Rational, input?: any): Answer;
  yes: RationalInterval;
  /* If true, the oracle's yes interval will be updated when a prophecy is generated */
  update?: boolean;
  /* If true, the ask helper will use the yes interval to short-circuit calls to the oracle */
  expensive?: boolean;
  /* Optional history of calls to the oracle. Each entry is a tuple of the input and the Answer. 
  Only is done if not short-circuited */
  history?: [[RationalInterval, Rational, any], Answer];
  /* optional internal function for if the oracle has extra state or needs to do something special 
  an empty call will return the internal state, if it has args then it is called to update internal*/
  internal?: (...args: any[]) => any;
  /* Optional narrowing function that can be used instead of bisection */
  narrowing?: (precision: Rational) => RationalInterval;
}
