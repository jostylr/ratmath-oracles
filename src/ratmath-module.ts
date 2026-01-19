import { Rational, RationalInterval } from './ratmath';
import { fromRational, fromInterval } from './functions';
import { add, subtract, multiply, divide, negate, toOracle } from './arithmetic';
import { isOracle } from './types';
import { narrow } from './narrowing';
import { nRoot } from './roots';
import {
  oracleFromCF,
  cfFromTerms,
  cfSqrt2,
  cfE,
  cfPhi,
  convergent,
  type ContinuedFractionStream
} from './continued-fractions';

function getPrecision(context: any, prec?: any): Rational {
  if (prec !== undefined) {
    if (prec instanceof Rational) return prec;
    if (typeof prec === 'number') return new Rational(1, Math.round(1 / prec));
    return new Rational(prec);
  }
  if (context && context.variables) {
    let val;
    if (context.variables.has("_precision")) val = context.variables.get("_precision");
    else if (context.variables.has("PRECISION")) val = context.variables.get("PRECISION");

    if (val !== undefined) {
      if (val instanceof Rational) return val;
      if (val && val.toNumber) return new Rational(1, Math.round(1 / val.toNumber()));
      return new Rational(val);
    }
  }
  return new Rational(1, 1000000);
}

export const functions = {
  "Oracle": {
    type: 'js',
    body: function(this: any, x: any) {
      if (x instanceof Rational) return fromRational(x);
      if (x instanceof RationalInterval) return fromInterval(x);
      if (isOracle(x)) return x;
      throw new Error("Oracle expects a Rational, RationalInterval, or Oracle");
    },
    params: ["x"],
    doc: "Creates an oracle from a Rational or RationalInterval"
  },

  "OracleAdd": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return add(a, b);
    },
    params: ["a", "b"],
    doc: "Adds two oracles (auto-converts Rational/RationalInterval to Oracle)"
  },

  "OracleSub": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return subtract(a, b);
    },
    params: ["a", "b"],
    doc: "Subtracts oracle b from oracle a"
  },

  "OracleMul": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return multiply(a, b);
    },
    params: ["a", "b"],
    doc: "Multiplies two oracles"
  },

  "OracleDiv": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return divide(a, b);
    },
    params: ["a", "b"],
    doc: "Divides oracle a by oracle b"
  },

  "OracleNeg": {
    type: 'js',
    body: function(this: any, a: any) {
      return negate(a);
    },
    params: ["a"],
    doc: "Negates an oracle"
  },

  "Narrow": {
    type: 'js',
    body: async function(this: any, oracle: any, prec?: any) {
      const precision = getPrecision(this, prec);
      return await narrow(oracle, precision);
    },
    params: ["oracle", "precision?"],
    doc: "Narrows an oracle to the specified precision, returns refined interval"
  },

  "OracleYes": {
    type: 'js',
    body: function(this: any, oracle: any) {
      if (!isOracle(oracle)) {
        throw new Error("OracleYes expects an Oracle");
      }
      return oracle.yes;
    },
    params: ["oracle"],
    doc: "Returns the current 'yes' interval of an oracle"
  },

  "Sqrt": {
    type: 'js',
    body: function(this: any, x: any) {
      const q = x instanceof Rational ? x : new Rational(x);
      const guess = new Rational(1);
      return nRoot(q, guess, 2);
    },
    params: ["x"],
    doc: "Creates a square root oracle using Newton's method"
  },

  "NRoot": {
    type: 'js',
    body: function(this: any, x: any, n: number) {
      const q = x instanceof Rational ? x : new Rational(x);
      const guess = new Rational(1);
      return nRoot(q, guess, n);
    },
    params: ["x", "n"],
    doc: "Creates an nth root oracle using Newton's method"
  },

  "CFSqrt2": {
    type: 'js',
    body: function(this: any) {
      return oracleFromCF(cfSqrt2());
    },
    params: [],
    doc: "Creates an oracle for sqrt(2) from its continued fraction [1; 2, 2, 2, ...]"
  },

  "CFE": {
    type: 'js',
    body: function(this: any) {
      return oracleFromCF(cfE());
    },
    params: [],
    doc: "Creates an oracle for e from its continued fraction"
  },

  "CFPhi": {
    type: 'js',
    body: function(this: any) {
      return oracleFromCF(cfPhi());
    },
    params: [],
    doc: "Creates an oracle for the golden ratio from its continued fraction [1; 1, 1, 1, ...]"
  },

  "OracleFromCF": {
    type: 'js',
    body: function(this: any, terms: bigint[]) {
      const stream = cfFromTerms(terms);
      return oracleFromCF(stream);
    },
    params: ["terms"],
    doc: "Creates an oracle from an array of continued fraction terms"
  },

  "Convergent": {
    type: 'js',
    body: function(this: any, cf: ContinuedFractionStream, n: number) {
      return convergent(cf, n);
    },
    params: ["cf", "n"],
    doc: "Computes the nth convergent of a continued fraction stream"
  }
};

export const variables = {};

export default { functions, variables };
