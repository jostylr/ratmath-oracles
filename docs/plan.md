# Implementation Plan for Real Number Oracles

> Historical component design, classified 2026-09-19. This is not the active
> RiX execution queue, and unchecked items are not verified missing features.
> The umbrella `ratmath/WORK_PLAN.md` records legacy/support work under later
> product-scope decisions. Maintain compatibility; do not start a second parser,
> evaluator, or publishing architecture from this older plan.

This document outlines the action plan for implementing the real number oracle library as described in `design.md`.

## Core Data Structures and Types

First, we need to define the core data structures that will be used throughout the library. These should be in a file like `src/types.tsx`. All operations are synchronous and should leverage ratmath types/utilities directly where available.

- **`Rational`**: A type for representing rational numbers, likely as a pair of integers `[numerator, denominator]`.
- **`RationalInterval`**: A type for representing a rational interval, `[Rational, Rational]`.
- **`Oracle`**: The core function type: `(ab: RationalInterval, delta: Rational, in: any) => {ans: boolean, cd: RationalInterval, out: any}` (synchronous). The oracle function itself will have a `yes` property of type `RationalInterval`.
- **`Answer`**: The return type of an oracle call: `{ans: boolean, cd: RationalInterval, out: any}`.

---

## File-by-File Implementation Plan

### 1. `src/functions.tsx`

**Purpose**: Provides basic functions to generate oracles for common numbers and from user-defined logic.

| Function Signature | Description |
| --- | --- |
| `fromRational(q: Rational): Oracle` | Creates a perfect oracle for a single rational number. The prophecy is always the number itself. |
| `fromInterval(i: RationalInterval): Oracle` | Creates a stub oracle from a rational interval. The prophecy is always the interval itself. |
| `fromTestFunction(testFn: (i: RationalInterval) => boolean): Oracle` | Creates an oracle from a function that definitively tests if a real is in a given rational interval. |
| `sqrt(q: Rational): Oracle` | Returns an oracle for the square root of `q`. |
| `root(q: Rational, n:Rational): Oracle` | Returns an oracle for the  n-th root of `q`. |
| `exp(x: Rational): Oracle` | Returns an oracle for `e^x`. |
| `ln(x: Rational): Oracle` | Returns an oracle for the natural logarithm of `x`. |
| `fromTaylorSeries(coefficients: Rational[]): Oracle` | Generates an oracle from a Taylor series expansion. |
| `fromDifferentialEquation(de: any, initial: any): Oracle` | Generates an oracle from a differential equation. |

**Documentation**:
- Document the `fromTestFunction` and how it can be used for custom oracles.
- Provide examples for creating oracles for constants like `sqrt(2)` and `e`.

**Tests**:
- Test `fromRational` oracle always returns the rational.
- Test `sqrt(4)` results in the `fromRational(2)` oracle.
- Test `ln(1)` results in the `fromRational(0)` oracle.
- Test that the `yes` interval for `sqrt(2)` is initially `[1, 2]`.

### 2. `src/arithmetic.tsx`

**Purpose**: Facilitates arithmetic operations (+, -, *, /) on oracles.

| Function Signature | Description |
| --- | --- |
| `add(a: Oracle, b: Oracle): Oracle` | Returns a new oracle representing the sum of the two input oracles. |
| `subtract(a: Oracle, b: Oracle): Oracle` | Returns a new oracle representing the difference. |
| `multiply(a: Oracle, b: Oracle): Oracle` | Returns a new oracle representing the product. |
| `divide(a: Oracle, b: Oracle): Oracle` | Returns a new oracle representing the quotient. Requires handling of division by zero. |
| `negate(a: Oracle): Oracle` | Returns a new oracle representing the negation. |

**Documentation**:
- Explain the underlying principle: shrinking the `yes` intervals of the operands until the operation on the interval is small enough to satisfy the query.
- Division-by-zero policy: if denominator is known zero at definition, throw; if denominator `yes` contains zero at definition, warn (via pluggable logger); when producing an interval for a given `delta`, reduce and if zero still present, throw.

**Tests**:
- `add(fromRational(1), fromRational(2))` should be equivalent to `fromRational(3)`.
- `multiply(sqrt(2), sqrt(2))` should be equivalent to `fromRational(2)`.
- Test operations between different types of oracles (e.g., a rational and a `sqrt`).
- Test division by an oracle known to be non-zero and one that could be zero.

### 2.b. `src/comparison.tsx`

**Purpose**:


### 3. `src/narrowing.tsx`

**Purpose**: Implements algorithms for refining the `yes` interval of an oracle.

| Function Signature | Description |
| --- | --- |
| `bisect(oracle: Oracle, precision: Rational): Promise<RationalInterval>` | Narrows the `yes` interval of the oracle down to a specified precision using bisection. |
| `mediant(oracle: Oracle, iterations: number): Promise<Rational[]>` | Uses the mediant method to narrow the interval and generate terms of a continued fraction. |
| `refine(oracle: Oracle, max_iterations: number): Promise<Oracle>` | Runs a narrowing algorithm for a number of iterations and returns a new oracle with a smaller `yes` interval. |

**Documentation**:
- Explain the difference between the bisection and mediant strategies.
- Provide an example of how to use `refine` to get a more precise estimate of a real number.

**Tests**:
- Test that `bisect` on `sqrt(2)` with sufficient precision yields an interval like `[1.414, 1.415]`.
- Test that `mediant` on the golden ratio oracle produces the `[1; 1, 1, 1, ...]` continued fraction terms.

### 4. `src/continued-fractions.tsx`

**Purpose**: Tools for creating and working with oracles based on continued fractions.

| Function Signature | Description |
| --- | --- |
| `fromPattern(pattern: Rational[]): Oracle` | Creates an oracle from a repeating continued fraction pattern. |
| `fromGenerator(gen: () => Rational): Oracle` | Creates an oracle from a generator function that yields continued fraction terms. |
| `toContinuedFraction(oracle: Oracle, iterations: number): Promise<Rational[]>` | Generates the first `n` terms of the continued fraction for a given oracle. |
| `gosperAdd(cf_a: any, cf_b: any): Oracle` | Implements Gosper's algorithm for adding two continued fractions. |
| `gosperMultiply(cf_a: any, cf_b: any): Oracle` | Implements Gosper's algorithm for multiplying two continued fractions. |

**Documentation**:
- Provide examples for creating oracles for `phi` (from pattern `[1]`) and `e` (from pattern `[2; 1, 2, 1, 1, 4, 1, ...]`).
- Explain how Gosper's algorithm can be used for efficient arithmetic in some cases.

**Tests**:
- Create an oracle for `phi` and test that its value is correct.
- Convert `sqrt(2)` oracle to a continued fraction and check the terms.
- Test Gosper's algorithm functions.

### 5. `src/parse.tsx`

**Purpose**: A parser to translate mathematical expressions from strings into oracles.

| Function Signature | Description |
| --- | --- |
| `parse(expression: string): Oracle` | Parses a string containing mathematical expressions (e.g., "sqrt(2) + 1/2") and returns the resulting oracle. |

**Documentation**:
- Document the supported grammar, including available functions (`sqrt`, `exp`, `ln`), operators (`+`, `-`, `*`, `/`), and number formats.
- Use the ratmath parser as much as possible. Continued fractions are written as 3.~1~3~5 being equivalent to [3; 1, 3, 5]. For continued fractions with repeating pattern, use 2.~2~3#~5~3~4 to have something like [2; 2, 3, 5, 3, 4, 5, 3, 4, 5, 3, 4, ...].

**Tests**:
- `parse("1 + 2")` should be equivalent to `fromRational(3)`.
- `parse("sqrt(2) * sqrt(2)")` should be equivalent to `fromRational(2)`.
- Test parsing of complex nested expressions.
- Test for proper error handling on invalid expressions.

### 6. `index.tsx`

**Purpose**: The main entry point for the library.

**Plan**:
- Import all public functions from the `src/` modules.
- Export them as a single, unified API for consumers of the library.
- This file will be primarily exports.

**Documentation**:
- The main `README.md` should feature a comprehensive example of how to import and use the library, starting from creating oracles, performing arithmetic, and narrowing them to a final value.

**Tests**:
- Create a set of integration tests that use the final exported API to perform calculations. For example: `api.narrow(api.add(api.sqrt(2), api.fromRational(1)), 0.001)`.
