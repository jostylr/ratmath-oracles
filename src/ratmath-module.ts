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

// Convert parser output types (RationalInterval, Integer, etc.) to Rational
function toRationalFromParser(x: any): Rational {
  if (x instanceof Rational) return x;
  // Handle RationalInterval - use midpoint or low if it's a point interval
  if (x instanceof RationalInterval) {
    // If it's a point interval, use that value
    if (x.low.equals(x.high)) return x.low;
    // Otherwise use midpoint
    return x.low.add(x.high).divide(new Rational(2));
  }
  // Handle Integer type from parser (check constructor name for cross-module compatibility)
  if (x && x.constructor && x.constructor.name === 'Integer') {
    const val = x.value;
    if (typeof val === 'bigint') {
      return new Rational(val);
    }
  }
  // Handle Integer type from parser (check for value property)
  if (x && typeof x.value === 'bigint') {
    return new Rational(x.value);
  }
  // Handle raw types
  if (typeof x === 'number') return new Rational(BigInt(Math.floor(x)));
  if (typeof x === 'bigint') return new Rational(x);
  // Try direct construction as last resort
  try {
    return new Rational(x);
  } catch {
    throw new Error(`Cannot convert to Rational: ${typeof x} ${x}`);
  }
}

// Attach arithmetic methods to an oracle for natural syntax support (a + b, a * b, etc)
function withArithmetic(oracle: any): any {
  if (!oracle || typeof oracle !== 'function') return oracle;
  oracle.add = (other: any) => withArithmetic(add(oracle, other));
  oracle.subtract = (other: any) => withArithmetic(subtract(oracle, other));
  oracle.multiply = (other: any) => withArithmetic(multiply(oracle, other));
  oracle.divide = (other: any) => withArithmetic(divide(oracle, other));
  oracle.negate = () => withArithmetic(negate(oracle));
  return oracle;
}

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
      return withArithmetic(toOracle(x));
    },
    params: ["x"],
    doc: "Creates an oracle from a number, Rational, RationalInterval, or Oracle"
  },

  "OracleAdd": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return withArithmetic(add(a, b));
    },
    params: ["a", "b"],
    doc: "Adds two oracles (auto-converts Rational/RationalInterval to Oracle)"
  },

  "OracleSub": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return withArithmetic(subtract(a, b));
    },
    params: ["a", "b"],
    doc: "Subtracts oracle b from oracle a"
  },

  "OracleMul": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return withArithmetic(multiply(a, b));
    },
    params: ["a", "b"],
    doc: "Multiplies two oracles"
  },

  "OracleDiv": {
    type: 'js',
    body: function(this: any, a: any, b: any) {
      return withArithmetic(divide(a, b));
    },
    params: ["a", "b"],
    doc: "Divides oracle a by oracle b"
  },

  "OracleNeg": {
    type: 'js',
    body: function(this: any, a: any) {
      return withArithmetic(negate(a));
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
      const q = toRationalFromParser(x);
      const guess = new Rational(1);
      return withArithmetic(nRoot(q, guess, 2));
    },
    params: ["x"],
    doc: "Creates a square root oracle using Newton's method"
  },

  "NRoot": {
    type: 'js',
    body: function(this: any, x: any, n: any) {
      const q = toRationalFromParser(x);
      const nVal = toRationalFromParser(n);
      const nNum = Number(nVal.numerator / nVal.denominator);
      const guess = new Rational(1);
      return withArithmetic(nRoot(q, guess, nNum));
    },
    params: ["x", "n"],
    doc: "Creates an nth root oracle using Newton's method"
  },

  "CFSqrt2": {
    type: 'js',
    body: function(this: any) {
      return withArithmetic(oracleFromCF(cfSqrt2()));
    },
    params: [],
    doc: "Creates an oracle for sqrt(2) from its continued fraction [1; 2, 2, 2, ...]"
  },

  "CFE": {
    type: 'js',
    body: function(this: any) {
      return withArithmetic(oracleFromCF(cfE()));
    },
    params: [],
    doc: "Creates an oracle for e from its continued fraction"
  },

  "CFPhi": {
    type: 'js',
    body: function(this: any) {
      return withArithmetic(oracleFromCF(cfPhi()));
    },
    params: [],
    doc: "Creates an oracle for the golden ratio from its continued fraction [1; 1, 1, 1, ...]"
  },

  "OracleFromCF": {
    type: 'js',
    body: function(this: any, terms: bigint[]) {
      const stream = cfFromTerms(terms);
      return withArithmetic(oracleFromCF(stream));
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
  },

  "Ask": {
    type: 'js',
    body: async function(this: any, oracle: any, interval: any, delta?: any) {
      const o = withArithmetic(toOracle(oracle));
      const precision = getPrecision(this, delta);
      
      // Narrow the oracle to the given precision
      const yesInterval = await narrow(o, precision);
      
      // Convert interval argument to RationalInterval
      let queryInterval: RationalInterval;
      if (interval instanceof RationalInterval) {
        queryInterval = interval;
      } else if (interval instanceof Rational) {
        queryInterval = new RationalInterval(interval, interval);
      } else if (typeof interval === 'number' || typeof interval === 'bigint') {
        const r = new Rational(interval as any);
        queryInterval = new RationalInterval(r, r);
      } else {
        throw new Error("Ask expects interval to be a RationalInterval or Rational");
      }
      
      // Check if yesInterval intersects or is disjoint from queryInterval
      const intersection = yesInterval.intersection(queryInterval);
      if (intersection !== null) {
        return 1; // Yes - oracle's yes interval intersects query
      } else {
        return 0; // No - disjoint
      }
    },
    params: ["oracle", "interval", "delta?"],
    doc: "Ask if oracle's value is in interval (with fuzziness delta). Returns 1 if yes, 0 if no."
  },

  "Midpoint": {
    type: 'js',
    body: async function(this: any, oracle: any, precision?: any) {
      const o = withArithmetic(toOracle(oracle));
      
      // Get precision - default to 1E-2 if not specified and _precision not set
      let prec: Rational;
      if (precision !== undefined) {
        prec = toRationalFromParser(precision);
      } else if (this && this.variables && this.variables.has('_precision')) {
        prec = this.variables.get('_precision');
      } else {
        prec = new Rational(1, 100); // 1E-2 = 0.01
      }
      
      // Narrow the oracle to the specified precision
      const yesInterval = await narrow(o, prec);
      
      // Return the midpoint as a Rational
      const low = yesInterval.low;
      const high = yesInterval.high;
      const midpoint = low.add(high).divide(new Rational(2));
      
      return midpoint;
    },
    params: ["oracle", "precision?"],
    doc: "Return exact midpoint of oracle's narrowed Yes interval as a Rational."
  },

  "Estimate": {
    type: 'js',
    body: async function(this: any, oracle: any, precision?: any) {
      const o = withArithmetic(toOracle(oracle));
      
      // Get precision - default to 1E-2 if not specified and _precision not set
      let prec: Rational;
      if (precision !== undefined) {
        prec = toRationalFromParser(precision);
      } else if (this && this.variables && this.variables.has('_precision')) {
        prec = this.variables.get('_precision');
      } else {
        prec = new Rational(1, 100); // 1E-2 = 0.01
      }
      
      // Narrow the oracle to the specified precision
      const yesInterval = await narrow(o, prec);
      
      const low = yesInterval.low;
      const high = yesInterval.high;
      
      // Find a decimal (power of 10 denominator) that fits in the interval
      // Start with precision-based power of 10
      const precNum = Number(prec.numerator) / Number(prec.denominator);
      let power = Math.ceil(-Math.log10(precNum));
      
      // Try to find a decimal that fits in [low, high]
      for (let attempt = 0; attempt < 20; attempt++) {
        const denom = BigInt(10) ** BigInt(power);
        const denomRat = new Rational(denom);
        
        // Find the floor and ceiling of low and high scaled by denom
        const lowScaled = low.multiply(denomRat);
        const highScaled = high.multiply(denomRat);
        
        // Get integer bounds
        const lowInt = lowScaled.numerator / lowScaled.denominator;
        const highInt = highScaled.numerator / highScaled.denominator;
        
        // Check if there's an integer in [lowScaled, highScaled]
        const lowCeil = lowScaled.numerator % lowScaled.denominator === 0n 
          ? lowInt 
          : lowInt + 1n;
        
        if (lowCeil <= highInt) {
          // Found a decimal that fits: lowCeil / denom
          return new Rational(lowCeil, denom);
        }
        
        // Need more precision
        power++;
      }
      
      // Fallback to midpoint if no decimal found (shouldn't happen)
      return low.add(high).divide(new Rational(2));
    },
    params: ["oracle", "precision?"],
    doc: "Return a terminating decimal (power of 10 denominator) within the Yes interval."
  },

  "Mediant": {
    type: 'js',
    body: async function(this: any, oracle: any, precision?: any) {
      const o = withArithmetic(toOracle(oracle));
      
      // Get precision for narrowing
      let prec: Rational;
      if (precision !== undefined) {
        prec = toRationalFromParser(precision);
      } else if (this && this.variables && this.variables.has('_precision')) {
        prec = this.variables.get('_precision');
      } else {
        prec = new Rational(1, 100);
      }
      
      // Narrow the oracle to get the Yes interval
      const yesInterval = await narrow(o, prec);
      const low = yesInterval.low;
      const high = yesInterval.high;
      
      // Farey mediant search
      // Start with 0/1 and 1/0 (infinity) as initial Farey pair
      // But we need to handle the general case, so use wider bounds
      
      // Find initial Farey pair containing the interval
      // Use floor(low) and ceil(high) + 1 as bounds
      const lowNum = Number(low.numerator) / Number(low.denominator);
      const highNum = Number(high.numerator) / Number(high.denominator);
      
      let leftNum = BigInt(Math.floor(lowNum));
      let leftDen = 1n;
      let rightNum = BigInt(Math.ceil(highNum)) + 1n;
      let rightDen = 1n;
      
      // Maximum iterations to prevent infinite loops
      const maxIterations = 1000;
      
      for (let i = 0; i < maxIterations; i++) {
        // Compute mediant
        const medNum = leftNum + rightNum;
        const medDen = leftDen + rightDen;
        const mediant = new Rational(medNum, medDen);
        
        // Check if mediant is in [low, high]
        const inInterval = mediant.compareTo(low) >= 0 && mediant.compareTo(high) <= 0;
        
        if (inInterval) {
          return mediant;
        }
        
        // Mediant not in interval - choose which half to continue with
        if (mediant.compareTo(low) < 0) {
          // Mediant is below interval, search right half
          leftNum = medNum;
          leftDen = medDen;
        } else {
          // Mediant is above interval, search left half
          rightNum = medNum;
          rightDen = medDen;
        }
      }
      
      // Fallback: return the last mediant computed
      return new Rational(leftNum + rightNum, leftDen + rightDen);
    },
    params: ["oracle", "precision?"],
    doc: "Return the simplest rational (smallest Farey mediant) within the Yes interval."
  }
};

export const variables = {};

export default { functions, variables };
