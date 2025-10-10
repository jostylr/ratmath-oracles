# Allowing No-Prophecy Oracles — Plan & Tradeoffs

This document sketches how to adapt the oracle pipeline to allow a fast, predicate-style decision that can answer "No" without computing a prophecy (interval). The motivating example is a sqrt(2) membership test: for a query interval `a:b` (expanded by `delta`), answer Yes if `2 ∈ a^2:b^2`; otherwise answer No without producing an interval.

## Goals

1. Let oracle implementations answer `false` without producing a prophecy when a cheap, decisive predicate applies.
2. Keep existing constructive paths (with a prophecy interval) working and still refining `yes` when appropriate.
3. Preserve efficient short-circuits (e.g., early-return when current `yes` is already sufficient; quick No when current `yes` is disjoint from the target).

## Current Shape (Today)

- `Answer` type: `{ ans: boolean; cd: RationalInterval; out?: unknown }` — `cd` always present.
- `makeOracle(yes, compute)` always calls `compute` (except early-return optimization), and intersects the resulting prophecy with `currentYes`, updating `oracle.yes` only on the compute path.
- Early-return today:
  - If `withinDelta(currentYes, target, delta)` and they intersect: return `{ ans: true, cd: currentYes }` without changing `yes`.
  - If disjoint: return `{ ans: false, cd: currentYes }` without changing `yes`.

## Proposed Shape (After Change)

Introduce a discriminated union for answers to allow No-without-prophecy:

- Yes-with-prophecy: `{ ans: true; cd: RationalInterval; out?: unknown }`
- No-without-prophecy: `{ ans: false; out?: unknown }`
- Optional No-with-context (only for specific short-circuits): `{ ans: false; cd?: RationalInterval; out?: unknown }`

Notes:
- For general No results, `cd` is omitted to reflect "no interval computed". This enforces correct handling by consumers.
- For well-defined internal short-circuits (like "disjoint from currentYes"), we may include `cd: currentYes` as a helpful context, but callers must treat it as optional.

## API Surface Changes

1. Types
   - Change `Answer` to a union with optional `cd` in the `false` case.
   - Provide type guards/utilities:
     - `isYes(answer): answer is { ans: true; cd: RationalInterval }`
     - `getCd(answer): RationalInterval | undefined`

2. Oracle Construction
   - Extend `makeOracle` to optionally take a predicate-style tester in addition to (or instead of) a constructive `compute`:
     - Option A (single function): allow `compute` to return either `RationalInterval` or a sentinel like `false` to mean "No, no prophecy".
     - Option B (two functions): `makeOracle(yes, { test?: (ab, delta) => boolean, compute?: (ab, delta) => RationalInterval })`.
       - `test` is run on the delta-expanded `ab` and can return `true`/`false`.
       - If `test` returns `true`: return `{ ans: true, cd: expandedTarget }` (no `yes` mutation).
       - If `test` returns `false`: return `{ ans: false }` (no `cd`, no `yes` mutation).
       - If no `test` or inconclusive path, fall back to `compute`.

3. Callers
   - Any code that assumes `answer.cd` always exists must be updated to treat it as optional in the `false` case.
   - Narrowing functions (`bisect`, `narrowWithCutter`) should base decisions on `answer.ans` only and not read `cd` in the `false` case.

## Execution Order Inside makeOracle (Proposed)

Given query `(ab, delta)` and current `yes`:

1. Normalize `target = ab`, `currentYes = oracle.yes`.
2. Disjoint quick No: if `currentYes ∩ target = ∅`, return `{ ans: false, cd: currentYes }`.
3. Early Yes (no compute): if `withinDelta(currentYes, target, delta)` and intersection exists, return `{ ans: true, cd: currentYes }`.
4. If a `test` predicate exists:
   - Compute `expanded = expand(target, delta)`.
   - If `test(expanded)` is `true`, return `{ ans: true, cd: expanded }`.
   - If `test(expanded)` is `false`, return `{ ans: false }`.
5. If a `compute` exists:
   - `prophecy = compute(target, delta)`.
   - `refined = prophecy ∩ currentYes`.
   - If `refined` exists: set `oracle.yes = refined` and return `{ ans: withinDelta(refined, target, delta) && refined ∩ target ≠ ∅, cd: refined }`.
   - Else: return `{ ans: false }` (no `yes` mutation).

This preserves the rule: only the compute path can mutate `oracle.yes`.

## Pros

- Efficiency: Skip expensive constructive arithmetic when a cheap predicate can decide No.
- Expressiveness: Supports oracles that are fundamentally decision procedures rather than constructors.
- Correctness clarity: The absence of `cd` in No answers communicates "no new interval information".

## Cons

- Type complexity: `Answer` becomes a union; call sites must handle optional `cd`.
- Prophecy-dependent algorithms: Any logic that expects to always refine using `cd` on both branches must be adapted.
- Testing updates: Existing tests that read `cd` in No cases must be revised.

## Migration Plan

1. Update `Answer` type and add helper guards.
2. Update `makeOracle` to the new execution order and add optional `test` handling (Option B preferred for clarity).
3. Sweep internal call sites:
   - `narrowing.tsx` (bisect, narrowWithCutter): rely on `ans`; ignore `cd` for the No branch.
   - `arithmetic.tsx` and `functions.tsx` helpers: ensure new `Answer` shape is respected.
4. Tests:
   - Add tests for: predicate-only No (no `cd`), predicate Yes (returns expanded `cd`), compute path refinement, and disjoint quick No with `cd: currentYes`.
   - Adjust existing tests to not assume `cd` exists for No.

## Open Design Choices

- Unified vs split API: Using `{ test?, compute? }` is clearer than overloading a single function to return `false | RationalInterval`.
- No `cd` on No: Enforce by type to prevent accidental reliance; allow internal short-circuit to include `cd: currentYes` as optional context only.
- Expanded interval for Yes-via-test: Returning `expanded` makes the delta handling explicit to callers.

## Example: sqrt(2) Oracle (Predicate-first)

```
const sqrt2 = makeOracle(yes0, {
  test: (ab, delta) => {
    const expanded = expand(ab, delta);
    const squared = squareInterval(expanded); // via ratmath
    return contains(squared, 2); // true if 2 ∈ squared
  },
  compute: (ab, delta) => {
    // optional fallback that constructs a contraction interval
    return constructiveBoundsForSqrt2(ab, delta);
  }
});
```

Behavior:
- If the test says Yes: return `{ ans: true, cd: expand(ab, delta) }` (no yes mutation).
- If the test says No: return `{ ans: false }` (no prophecy; no yes mutation).
- If test omitted or inconclusive path desired: compute and refine as today.

## Shortcut: Disjoint From Current Yes

At the very start, if `currentYes ∩ target = ∅`, we can immediately return `{ ans: false, cd: currentYes }`. This is safe and avoids pointless test/compute work.

## Summary

By making `Answer` a union and adding an optional predicate to `makeOracle`, we can support fast, non-constructive No answers while preserving the constructive refinement path. The main costs are type complexity and minor call-site updates to treat `cd` as optional on No. The change cleanly separates: quick disjoint/within-delta checks, predicate decision, and constructive refinement.

## Progressive Compute with Internal State (Intervalized Iterations)

Beyond a one-shot `compute`, we can support an iterative, stateful refinement strategy that progressively emits smaller intervals — e.g., an intervalized Newton method. The idea: a single oracle instance captures a `compute` function with internal state that, on each invocation, emits a tighter interval than before (or the same singleton once reached). `makeOracle` can loop on this `compute` until it achieves a satisfactory result.

### API Options

- Iterative compute contract:
  - `type Refiner = ((ab: RationalInterval, delta: Rational) => RationalInterval) & { internal?: Record<string, unknown> }`
  - Strengthen the behavioral spec (not the TS type):
    - Monotone non-expanding relative to the previous emission (preferably strictly shrinking until singleton).
    - Eventually reaches an interval whose width goes below any positive epsilon (i.e., limit to 0) for well-behaved problems.
    - Emitting a singleton locks the output for subsequent calls (idempotent afterward).

- Generator-like contract (alternative):
  - `type RefinerGen = { next: (ab: RationalInterval, delta: Rational) => RationalInterval; internal?: Record<string, unknown> }`
  - Semantically similar to Refiner; slightly clearer that repeated calls are expected to advance the sequence.

### makeOracle Looping Behavior

Inside the compute path of `makeOracle`:

1. Initialize `refinedYes = currentYes`.
2. Repeat until termination:
   - `prophecy = compute(target, delta)` (or `next(...)` for generator design).
   - `interYY = prophecy ∩ refinedYes`.
   - If `interYY` is empty: terminate with `{ ans: false }` (no mutation), because the sequence has left the feasible region implied by the prior `yes`.
   - Set `refinedYes = interYY` and optionally update `oracle.yes = refinedYes` after each iteration (see below).
   - If `withinDelta(refinedYes, target, delta)` and `refinedYes ∩ target ≠ ∅`: terminate with `{ ans: true, cd: refinedYes }`.
   - If `width(refinedYes) <= targetDelta` (derived from `delta`): terminate with `{ ans: true, cd: refinedYes }`.
   - Guard with iteration caps and/or time budget to avoid infinite loops; if exceeded, return `{ ans: false }`.

### When to Mutate oracle.yes

- Option A (eager): update `oracle.yes = refinedYes` on each successful intersection. Pros: external observers see progressive contraction; subsequent calls can benefit immediately. Cons: concurrent callers targeting different intervals could interfere via shared state.
- Option B (lazy): only set `oracle.yes` upon successful termination (return Yes). Pros: avoids mid-flight mutation; simpler reasoning for callers. Cons: misses opportunity to persist partial progress.
- Option C (configurable): expose a flag to choose A vs B; default to B for safety.

Given the shared-state concerns, Option B is safer unless we guarantee serialized access or clone per-call state.

### Interaction with Predicate Test

- Keep the same ordering: disjoint quick No → early Yes → predicate test on `expand(target, delta)` → iterative compute loop.
- The predicate can short-circuit both success and failure without touching internal iterative state.

### Termination and Guarantees

- We cannot mechanically guarantee termination unless the `compute` contract guarantees eventual shrinking below any epsilon and sufficient resource budget exists.
- Add the following controls:
  - `maxIterations` default (e.g., 1_000 or configurable via the optional `input` arg to the oracle).
  - Optional `minImprovement` threshold to abort if progress stalls.
  - Optional time budget.
- If limits are hit without meeting the success condition, return `{ ans: false }` (no prophecy) to reflect inconclusive computation.

### Concurrency and Re-entrancy

- If `compute` maintains internal mutable state, concurrent or interleaved calls to the same oracle may produce surprising effects.
- Safer approaches:
  - Keep all state internal to `compute` and document that oracles are not thread-safe.
  - Clone internal state at the beginning of a call (requires a `clone()` protocol on the internal state) and update the original only upon successful termination.
  - Alternatively, keep state in `oracle.internal` (if we re-introduce it) with locking/guarding discipline; however, this re-couples oracle and compute state.

### Types and Backward Compatibility

- The `Answer` union remains as proposed above (optional `cd` for No).
- `compute` type in `makeOracle` does not need to change at the type level; its iterative behavior is a contract we enforce in docs and by loop semantics.
- Optionally, we can publish a stronger type alias (e.g., `Refiner` or `RefinerGen`) for clarity and editor tooling.

### Pros

- Captures rich iterative algorithms (Newton, secant, bisection hybrids) as pluggable strategies.
- Can significantly reduce the number of external oracle calls when a single call performs a whole refinement loop.
- Allows domain-specific convergence checks and error control to live with the algorithm.

### Cons

- Shared mutable state in `compute` complicates reasoning and concurrency.
- Potentially long-running oracle calls; requires guards and budgets.
- More complex debugging when progress stalls or oscillates.

### Minimal Implementation Steps

1. Add loop in `makeOracle` compute path with iteration guard and the success criteria described above.
2. Choose mutation policy for `oracle.yes` (recommend lazy on success only).
3. Add optional budget parameters (e.g., via `input` argument) and sensible defaults.
4. Document the iterative `compute` contract (non-expanding, eventually shrinking, singleton fixpoint behavior).
5. Add tests: fast predicate No (no cd), predicate Yes (returns expanded), iterative converge to <= delta, iteration cap triggers `{ ans: false }`, and verify `yes` mutation policy.
