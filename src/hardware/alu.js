/**
 * Pure Hardware-Level 8-Bit Bitwise Arithmetic Logic Unit (ALU)
 *
 * STRICT COA CONSTRAINT:
 * Zero native arithmetic operators (+, -, *, /) are used for calculations.
 * Every operation is constructed strictly from bitwise logic gates:
 * XOR (^), AND (&), OR (|), NOT (~), and bit shifts (<<, >>, >>>).
 */

const BIT_INDICES_8_ASC = [0, 1, 2, 3, 4, 5, 6, 7];
const BIT_INDICES_8_DESC = [7, 6, 5, 4, 3, 2, 1, 0];
const BIT_INDICES_16_ASC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const CYCLE_LABELS = [1, 2, 3, 4, 5, 6, 7, 8];

export class HardwareInterruptError extends Error {
  constructor(message = 'INTERRUPT 0x00: Divide-by-Zero Fault', details = {}) {
    super(message);
    this.name = 'HardwareInterruptError';
    this.vector = details.vector || '0x00';
    this.code = details.code || 'DIVIDE_BY_ZERO';
    this.details = details;
  }
}

/**
 * Pure bitwise 8-bit sign extension to signed JavaScript integer [-128, 127].
 */
export function toSigned8(value) {
  const byte = value & 0xFF;
  return (byte & 0x80) !== 0 ? (byte | ~0xFF) : byte;
}

/**
 * Pure bitwise formatting helper: 8-bit spaced binary string (e.g. "0000 1110").
 */
export function toBinary8(value) {
  const byte = value & 0xFF;
  const hi = [7, 6, 5, 4].map((b) => String((byte >>> b) & 1)).join('');
  const lo = [3, 2, 1, 0].map((b) => String((byte >>> b) & 1)).join('');
  return `${hi} ${lo}`;
}

export function toHex8(value) {
  return (value & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Internal 16-bit Ripple-Carry Adder (pure bitwise) used by multiplier
 * and restoring divider for full-width intermediate precision.
 */
function rippleCarryAdd16(a, b) {
  const opA = a & 0xFFFF;
  const opB = b & 0xFFFF;
  let carryIn = 0;
  let sum = 0;

  for (const bit of BIT_INDICES_16_ASC) {
    const bitA = (opA >>> bit) & 1;
    const bitB = (opB >>> bit) & 1;
    const xorAB = bitA ^ bitB;
    const sumBit = xorAB ^ carryIn;
    const carryOut = (bitA & bitB) | (carryIn & xorAB);

    sum |= (sumBit << bit);
    carryIn = carryOut;
  }

  return {
    sum: sum & 0xFFFF,
    carryOut: carryIn,
  };
}

/**
 * 8-Bit Ripple-Carry Adder using chained Full-Adder logic gates:
 *   Sum_i  = A_i XOR B_i XOR Cin_i
 *   Cout_i = (A_i AND B_i) OR (Cin_i AND (A_i XOR B_i))
 *
 * Returns:
 *   - sum: 8-bit unsigned result (0..255)
 *   - carryOut: final carry-out bit from Bit 7 (0 or 1)
 *   - carryBits: array of all 8 carry-out bits [Bit 0 .. Bit 7]
 *   - gateSteps: per-bit gate evaluation details for visual animation
 *   - overflow: hardware signed Two's Complement overflow flag (0 or 1)
 */
export function rippleCarryAdd(a, b) {
  const opA = a & 0xFF;
  const opB = b & 0xFF;
  let carryIn = 0;
  let sum = 0;
  const carryBits = [];
  const gateSteps = [];

  for (const bit of BIT_INDICES_8_ASC) {
    const bitA = (opA >>> bit) & 1;
    const bitB = (opB >>> bit) & 1;

    const xorAB = bitA ^ bitB;
    const sumBit = xorAB ^ carryIn;
    const carryOut = (bitA & bitB) | (carryIn & xorAB);

    sum |= (sumBit << bit);
    carryBits.push(carryOut);
    gateSteps.push({
      bit,
      bitA,
      bitB,
      carryIn,
      xorAB,
      sumBit,
      carryOut,
    });

    carryIn = carryOut;
  }

  const finalSum = sum & 0xFF;
  // Hardware signed overflow gate: (~(A7 ^ B7) & (A7 ^ S7))
  const overflow = ((~(opA ^ opB) & (opA ^ finalSum)) >>> 7) & 1;

  return {
    sum: finalSum,
    carryOut: carryIn,
    carryBits,
    gateSteps,
    overflow,
  };
}

/**
 * 8-Bit Two's Complement Subtractor: A - B = A + (~B + 1)
 *
 * 1. Invert B via bitwise NOT masked to 8 bits (~B & 0xFF)
 * 2. Add 1 via rippleCarryAdd to form Two's Complement (-B)
 * 3. Add A and (-B) via rippleCarryAdd
 */
export function twosComplementSub(a, b) {
  const opA = a & 0xFF;
  const opB = b & 0xFF;

  const onesComplement = (~opB) & 0xFF;
  const negateStep = rippleCarryAdd(onesComplement, 1);
  const twosComplementB = negateStep.sum;
  const addStep = rippleCarryAdd(opA, twosComplementB);

  // Account for B === 0 where (~0 + 1) produces an internal carry-out of 1
  const effectiveCarryOut = addStep.carryOut | negateStep.carryOut;
  const borrow = effectiveCarryOut ^ 1;
  // Hardware signed subtraction overflow gate: ((A7 ^ B7) & (A7 ^ Diff7))
  const overflow = (((opA ^ opB) & (opA ^ addStep.sum)) >>> 7) & 1;

  return {
    sum: addStep.sum,
    result: addStep.sum,
    carryOut: addStep.carryOut,
    effectiveCarryOut,
    borrow,
    carryBits: addStep.carryBits,
    gateSteps: addStep.gateSteps,
    overflow,
    steps: {
      operandA: opA,
      operandB: opB,
      onesComplement,
      addOneCarryBits: negateStep.carryBits,
      twosComplementB,
      finalCarryBits: addStep.carryBits,
    },
  };
}

/**
 * 8-Cycle Hardware Shift-and-Add Multiplier
 *
 * Logs every cycle:
 *   LSB === 1 -> ADD & SHIFT
 *   LSB === 0 -> SHIFT ONLY
 * along with partial products and shifted multiplicand/multiplier registers.
 */
export function shiftAndAddMul(a, b) {
  const opA = a & 0xFF;
  const opB = b & 0xFF;

  let multiplicand8 = opA;
  let multiplicand16 = opA;
  let multiplier = opB;
  let product8 = 0;
  let product16 = 0;
  const cycles = [];

  for (const idx of BIT_INDICES_8_ASC) {
    const lsb = multiplier & 1;
    const multiplicandBefore = multiplicand8;
    const multiplierBefore = multiplier;
    const productBefore = product8;

    let action = 'LSB === 0 -> SHIFT ONLY';
    let added = false;
    let carryBits = null;

    if (lsb === 1) {
      const add8 = rippleCarryAdd(product8, multiplicand8);
      const add16 = rippleCarryAdd16(product16, multiplicand16);
      product8 = add8.sum;
      product16 = add16.sum;
      action = 'LSB === 1 -> ADD & SHIFT';
      added = true;
      carryBits = add8.carryBits;
    }

    multiplicand8 = (multiplicand8 << 1) & 0xFF;
    multiplicand16 = (multiplicand16 << 1) & 0xFFFF;
    multiplier = multiplier >>> 1;

    cycles.push({
      cycle: CYCLE_LABELS[idx],
      lsb,
      added,
      action,
      multiplicandBefore,
      multiplierBefore,
      productBefore,
      partialProduct: product8,
      partialProduct16: product16,
      multiplicandAfter: multiplicand8,
      multiplierAfter: multiplier,
      carryBits,
    });
  }

  const upperByte = (product16 >>> 8) & 0xFF;
  const overflow = upperByte !== 0 ? 1 : 0;

  return {
    product: product8,
    fullProduct16: product16,
    carryOut: overflow,
    overflow,
    cycles,
  };
}

/**
 * 8-Cycle Hardware Restoring Division Algorithm
 *
 * Shifts Remainder (A) left pulling in the next MSB of Dividend (Q),
 * performs trial subtraction A - Divisor via bitwise Two's Complement,
 * and restores A if negative (setting Q_bit = 0) or commits if >= 0 (Q_bit = 1).
 *
 * Throws HardwareInterruptError("INTERRUPT 0x00: Divide-by-Zero Fault") if divisor === 0.
 */
export function restoringDiv(dividend, divisor) {
  const opDividend = dividend & 0xFF;
  const opDivisor = divisor & 0xFF;

  if (opDivisor === 0) {
    throw new HardwareInterruptError('INTERRUPT 0x00: Divide-by-Zero Fault', {
      vector: '0x00',
      code: 'DIVIDE_BY_ZERO',
      dividend: opDividend,
      divisor: 0,
    });
  }

  // Precompute 16-bit Two's Complement of divisor (-M) via pure bitwise ops
  const negDivisor16 = rippleCarryAdd16((~opDivisor) & 0xFFFF, 1).sum;

  let quotient = 0;
  let remainder = 0;
  const cycles = [];

  for (const idx of BIT_INDICES_8_ASC) {
    const bit = BIT_INDICES_8_DESC[idx];
    const incomingBit = (opDividend >>> bit) & 1;
    const remainderBefore = remainder;

    // Shift remainder left by 1 and pull in current dividend bit
    const shiftedRemainder = (remainder << 1) | incomingBit;

    // Trial subtraction: shiftedRemainder - divisor
    const trial = rippleCarryAdd16(shiftedRemainder, negDivisor16);
    const isNegative = (trial.sum & 0x8000) !== 0;

    let qBit = 0;
    let restored = false;
    let action = '';

    if (isNegative) {
      // Restore previous shifted remainder
      remainder = shiftedRemainder & 0xFF;
      qBit = 0;
      restored = true;
      action = 'TRIAL < 0 -> RESTORE & Q=0';
    } else {
      remainder = trial.sum & 0xFF;
      quotient |= (1 << bit);
      qBit = 1;
      restored = false;
      action = 'TRIAL >= 0 -> KEEP & Q=1';
    }

    cycles.push({
      cycle: CYCLE_LABELS[idx],
      bitIndex: bit,
      incomingBit,
      remainderBefore,
      shiftedRemainder,
      trialResultSigned: (trial.sum & 0x8000) !== 0 ? (trial.sum | ~0xFFFF) : trial.sum,
      restored,
      qBit,
      action,
      remainderAfter: remainder,
      quotientSoFar: quotient,
    });
  }

  return {
    quotient: quotient & 0xFF,
    remainder: remainder & 0xFF,
    carryOut: 0,
    overflow: 0,
    cycles,
  };
}
