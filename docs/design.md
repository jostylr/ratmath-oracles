This library is designed around the idea that a real number is a rational betweenness relation, basically the set of all rational intervals that contain the real number. There are various properties it has to avoid the circular definition that was just given, but that need not concern us. What is of relevance is that we use oracles to figure out which intervals are Yes intervals, those rational intervals that contain the real number. Rational intervals are inclusive of the rational endpoints and are considered to just be the rational numbers inclusively between the endpoints. The intersection of two Yes intervals is a Yes interval. Thus, at any given time, if two Yes intervals is have been produced, the intersection of the two can potentially produce a smaller Yes interval.

An oracle mathematically is an object that takes in a rational interval and a bit of fuzziness and outputs a Yes/No along with a rational interval guaranteed to contain the real number. The produced interval is called a prophecy. The answer is a Yes if the prophecy intersects the given rational interval and is contained within the fuzzy boundary of that given interval, e.g., if a <= b is the given rational interval, delta the rational fuzziness, then it is a Yes if the output prophecy interval c:d intersects a:b and is fully contained in (a-delta:b+delta) while it is a No if c:d does not intersect a:b. The task of the oracle is to find a sufficiently small prophecy to determine one or the other. In this way, No is definitive while Yes is a "good enough for now".

This library provides a framework for programmatically realizing such oracles. While building arithmetic chains is synchronous, the execution of the oracles (narrowing and querying) is asynchronous. This allows for complex, high-precision computations (like finding roots or deep chains) without blocking.

Every oracle is an async javascript function with the signature `(ab: RationalInterval, delta: Rational, input?: any): Promise<Answer>`. The `Answer` is `[[status, prophecy], extra]`. 
- `status`: 1 (Yes), 0 (No), -1 (Maybe/Ambiguous).
- `prophecy`: The best known `RationalInterval` for the real value.
- `extra`: Optional state for the next call.

Every oracle also has a `yes` property: a `RationalInterval` that is definitive knowledge of the real number's location.

### Oracle Factories (`src/functions.ts`)

To simplify oracle creation, we provide targeted factory functions:

1. **`makeTestOracle(initialYes, testFn)`**: 
   - Use this for oracles defined by an inclusion test (e.g., "Is the root in this interval?").
   - `testFn` returns `Answer | Promise<Answer>`.
   - Narrowing is performed automatically using generic bisection.

2. **`makeAlgorithmOracle(initialYes, algFn)`**:
   - Use this for oracles that implement a specific numerical algorithm (e.g., Newton's method).
   - `algFn` directly provides a refined `RationalInterval`.
   - The oracle function primarily answers based on the current interval and triggers `algFn` when the query is ambiguous.

3. **`makeOracle(yes, compute)`** (Legacy/Generic):
   - A wrapper that maps a computation function to the algorithm oracle pattern.

### Specialized Oracles (`src/rationals.ts`)
- `singularOracle(q)`: Knowledge of a single point.
- `reflexiveOracle(q)`: Simple inclusion test against `q`.
- `fuzzyReflexiveOracle(q)`: Inclusion test with a expanded "yes" region.
- `haloOracle(q)`: Answers "Yes" if the query intersects a small halo around `q`.
- `bisectionOracle(target, initialGuess)`: Uses bisection to find `target`.

### Narrowing (`src/narrowing.ts`)
`narrow(oracle, precision)` is the main way to refine an oracle's knowledge. It is `async` and must be `await`ed. It calls the oracle's internal `narrowing` logic and updates the `oracle.yes` property.

### Arithmetic (`src/arithmetic.ts`)
Arithmetic operations (`add`, `subtract`, `multiply`, `divide`) return new async oracles. They coordinate the narrowing of their operands automatically to produce the desired output precision. Operations are parallelized where possible.
