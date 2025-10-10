// Public-facing types for oracles, using ratmath classes directly.
import { Rational, RationalInterval } from 'ratmath';

export type Answer = [[1, RationalInterval] | [0, RationalInterval] | [0] | [-1], any];

export interface Oracle {
  (ab: RationalInterval, delta: Rational, input?: any): Answer;
  yes: RationalInterval;
  update(cd: RationalInterval): void;
  history?: [RationalInterval];
}
