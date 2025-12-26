# Async Oracle Support Plan

## Overview

This document outlines the plan for adding async oracle support to ratreals. The goal is to allow oracles to perform asynchronous operations (like fetching data or running heavy computations) while maintaining a clean and unified API.

## Design Philosophy: Unified Async-Awareness

Rather than splitting the world into `Oracle` and `AsyncOracle`, we will unify them. The `Oracle` type will be updated to allow returning either a result *or* a Promise of a result. Consumer functions (like `narrow` and arithmetic combinations) will be upgraded to handle Promises transparently.

This means:
1.  **Simplicity**: Users define oracles as they always have. If they need async, they just return a Promise (or make the function `async`).
2.  **Uniformity**: Complexity is handled in the library's core (`narrow`, `arithmetic`), not by the user.
3.  **Depth-Agnostic**: Since arithmetic operations will "await" their operands, async behavior naturally propagates up the computation tree.

## Architecture Changes

### 1. Unified Oracle Interface

The `Oracle` interface will be updated to support Promises.

```typescript
// src/types/oracle.ts

export type OracleResult = Answer | Promise<Answer>;

export interface Oracle {
  (ab: RationalInterval, delta: Rational, input?: any): OracleResult;
  
  yes: RationalInterval;
  // ... existing properties
  
  // Narrowing can also be async
  narrowing?: (current: RationalInterval, precision: Rational) => RationalInterval | Promise<RationalInterval>;
}
```

### 2. Async Narrowing

The narrowing functions will become `async`. This is the primary point where execution is suspended to wait for the oracle.

```typescript
// src/narrowing.ts

export async function narrow(oracle: Oracle, precision: Rational): Promise<RationalInterval> {
  // Loop logic...
  // await the oracle answer
  const result = await oracle(current, delta); 
  // ...
  return current;
}
```

*Note: This is a breaking change. All calls to `narrow` must now be awaited.*

### 3. Async-Aware Arithmetic

Arithmetic operations (`add`, `sub`, etc.) will return Oracles that are capable of handling async inputs. Effectively, the composed oracle function will be `async`.

```typescript
// src/arithmetic.ts

export const add = (A: Oracle, B: Oracle): Oracle => {
  const combinedOracle: Oracle = async (ab, delta) => {
     // Execute A and B in parallel if possible
     const [ansA, ansB] = await Promise.all([A(ab, delta), B(ab, delta)]);
     
     // Combine results
     // ...
     return result;
  };
  // ...
  return combinedOracle;
};
```

### 4. Backwards Compatibility & Migration

*   **Defining Oracles**: Existing synchronous oracles require NO changes. `() => Answer` is a valid `() => Answer | Promise<Answer>`.
*   **Using Oracles**: Code that calls `narrow(oracle)` MUST be updated to `await narrow(oracle)`.
*   **Tests**: All tests using `narrow` need to be updated to be `async` and `await` the results.

## Implementation Steps

1.  **Update Types**: Modify `src/types/oracle.ts` to include `Promise<Answer>`.
2.  **Update Narrowing**: Rewrite `src/narrowing.ts` to be `async/await`.
3.  **Update Arithmetic**: Ensure `src/arithmetic/*.ts` functions properly await their operands (likely by making the returned oracle function `async`).
4.  **Update Tests**: Refactor `tests/rational-arithmetic.test.ts` and others to handle async narrowing.
5.  **Verify**: Run tests to ensure no regressions in logic or performance for synchronous cases (beyond the microtick overhead).

## Future Considerations (Post-Implementation)

*   **Cancellation**: Pass an `AbortSignal` through the `input` or a new argument to allow cancelling deep async chains.
*   **Caching**: Ensure the `yes` interval update logic is safe with concurrent async calls (though JS is single-threaded, interleaving can occur).
