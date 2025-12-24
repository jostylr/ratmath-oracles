# Roots

This module (`src/roots.ts`) handles computing roots of polynomials and other functions using various Oracle implementations.

## Functions

### 1. nRoot

`nRoot(q: Rational, guess: Rational, n: Integer = 2): Oracle`

Returns an oracle for the n-th root of `q`.

-   **Method**: Uses Newton's method.
-   **State**: Maintains a `guess` and its `partner` ($y=q/x^{n-1}$).
-   **Yes Interval**: The interval between the current `guess` and its `partner`.
-   **Refinement**: Updates the guess using Newton's iteration: $x_{new} = \frac{(n-1)x + y}{n}$.
-   **Extra Info**: The oracle returns the current `{ guess, partner }` in the result metadata.

### 2. nRootTest

`nRootTest(q: Rational, yes: RationalInterval, n: Integer = 2): Oracle`

Returns an oracle for the n-th root of `q` based on verification.

-   **Method**: Checks if the interval $[a, b]^n$ (element-wise power) contains `q`.
-   **Narrowing**: Uses bisection on the interval.
-   **Default Yes Interval**: `[1, q]` if not provided.

### 3. KantorovichRoot

`KantorovichRoot({f, fprime, guess, domain, maxpp, minp}): Oracle`

Returns an oracle for a root of `f` using the Kantorovich theorem to guarantee convergence.

-   **Parameters**:
    -   `f`, `fprime`: Function and its derivative (taking Rational -> Rational).
    -   `guess`: Initial starting point.
    -   `domain`: Interval where bounds hold.
    -   `maxpp`: Upper bound on $|f''(x)|$ in domain.
    -   `minp`: Lower bound on $|f'(x)|$ in domain.
-   **Method**: Uses Newton's method with a safe radius $r$ derived from Kantorovich conditions ($h \le 1/4$).
-   **Yes Interval**: $[guess - r, guess + r]$.
-   **Refinement**: Updates `guess` via Newton's method and shrinks `r`.

### 4. IVTRoot

`IVTRoot(f: function, initial: RationalInterval): Oracle`

Returns an oracle for a root of `f` using the Intermediate Value Theorem.

-   **Precondition**: $f(a) \cdot f(b) < 0$ (must have opposite signs).
-   **Method**: Bisection.
-   **Yes Interval**: The current interval bracketing the root.