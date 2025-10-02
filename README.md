# RatReals

This is an extension of the RatMath library. It uses the rational interval arithmetic of that library to represent reals via an oracle structure.

This library uses the notion of real numbers as presented in [Reals as Oracles](https://github.com/jostylr/reals-as-oracles). In programming form, a real number oracle is a function that takes in `R(a:b, delta, {} )~`and outputs a tuple (array as javascript) of the form `=[1 || 0 || -1, c:d || null, {}]` where a:b  and c:d are rational intervals, delta is a rational number, and the third entry in either can be whatever data is required for the internals of the function. The intervals c:d that are in the outputs are called prophecies and are considered to contain the real number. These functions need not be deterministic though ideally the third argument contains state that converts most of the real functions into something reproducible.

Any function that is to be considered a real number oracle must satisfy the following requirements (third arguments are auxiliary and suppressed in the notation that follows):
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

These oracles are sufficient for naming a real number. The real number definition itself is that of a relation on rational intervals such that a is x-related to b if a:b contains the real number x. This is a bit circular as a definition so there are properties, similar to the above, that state when a relation on rational numbers qualifies as a rational betweenness relation. Each relation represents a distinct real number and the set of all such relations is the set of real numbers. These are the theoretical entities, but for finite beings such as ourselves and our computers, it is not possible to clearly pull out a relation for all desired descriptions of real numbers. As an example, solving f(x)=0 with a numerical algorithm, such as Newton's method in a region of known, estimable convergence, leads to an oracle and that points out a real number, but we cannot say with certainty which one. The value of this approach is to give a theoretical foundation for all the computations involving the oracles and have that the computations of the oracles are tracking along with the actual computation of real numbers that an infinite creature could do.


The intervals of inputs and outputs are inclusive of the endpoints. In particular, a:a is a singleton. The delta neighborhoods, however, are considered exclusive of the endpoints. Also a:b is considered to be an unordered presentation so 1:2 and 2:1 are equally fine ways of representing the set of all rationals between and including 1 and 2.

From a practical point of view, initiating an oracle should be to give a known Yes interval and be able to use Separation to create smaller intervals. Disjointness and Consistency are basically built in. Closed is somewhat orthogonal from a computational point of view and cannot be computed by, say, exhausting computational cases, but it can be established by a proof. Singletons should definitely be permitted as Yes intervals.

These should be established for any given oracle one is working with. Also, from a practical point of view, the oracles here ought to be limited to those that can actually produce the answer in a finite time. That is, we can only concern ourselves with the computable numbers or, at least, numbers that are computable up to the point that we care about.

This is developed with Bun, but should work in various javascript runtimes.

## Quick Start (sync API)

```ts
import { fromRational } from './src/functions';
import { add, divide } from './src/arithmetic';
import { bisect } from './src/narrowing';
import { makeRational } from './src/ops';

// Create oracles for 2 and 3
const two = fromRational(makeRational(2));
const three = fromRational(makeRational(3));

// Arithmetic behaves like normal math (synchronously)
const five = add(two, three);

// Narrow an interval to target precision
const approx = bisect(five, makeRational(0.001));
// approx is a RationalInterval around 5 with width <= 0.001

// Division semantics:
// - If denominator is known to be 0 at definition -> throws
// - If denominator yes-interval contains 0 at definition -> warns via logger
// - When producing an interval at a given delta, if 0 remains -> throws
```

Note: Internal interval helpers currently use a minimal numeric fallback; they are structured to be replaced by ratmath’s precise interval/rational operations.
