import {
  HardwareInterruptError,
  rippleCarryAdd,
  twosComplementSub,
  shiftAndAddMul,
  restoringDiv,
  toBinary8,
  toHex8,
  toSigned8,
} from './alu.js';

export const OPCODES = {
  '+': 0x01,
  '-': 0x02,
  '*': 0x03,
  '/': 0x04,
};

export const MNEMONICS = {
  0x01: 'ADD',
  0x02: 'SUB',
  0x03: 'MUL',
  0x04: 'DIV',
};

export const DATA_SEGMENT = {
  OP1_ADDR: 0x00,
  OP2_ADDR: 0x01,
  RESULT_ADDR: 0x02,
};

export const CODE_SEGMENT_START = 0x10;
export const CODE_SEGMENT_END = 0xEF;
export const STACK_START = 0xFF;

export const PIPELINE_STAGES = [
  {
    id: 1,
    short: 'INT 0x80',
    title: 'System Call & PCB',
    subtitle: 'Ring 3 -> Ring 0',
  },
  {
    id: 2,
    short: 'FETCH',
    title: 'Fetch & Decode',
    subtitle: 'PC -> MAR -> MDR -> IR',
  },
  {
    id: 3,
    short: 'LOAD',
    title: 'Mem-to-Reg Load',
    subtitle: 'RAM[00..01] -> AX, BX',
  },
  {
    id: 4,
    short: 'ALU EXEC',
    title: 'Gate-Level ALU',
    subtitle: 'Bitwise Logic & Flags',
  },
  {
    id: 5,
    short: 'WB / IRET',
    title: 'Write-Back & IRET',
    subtitle: 'RAM[02] & Ring 0 -> 3',
  },
];

export const COA_TOOLTIPS = {
  PC: {
    name: 'Program Counter',
    detail: 'Holds the 8-bit RAM address of the next instruction opcode in the Code Segment (starts at 0x10).',
  },
  IR: {
    name: 'Instruction Register',
    detail: 'Latches the fetched opcode byte (0x01 ADD, 0x02 SUB, 0x03 MUL, 0x04 DIV) for the Control Unit decoder.',
  },
  MAR: {
    name: 'Memory Address Register',
    detail: 'Drives the 8-bit Address Bus during every Physical RAM read or write bus cycle.',
  },
  MDR: {
    name: 'Memory Data Register',
    detail: 'Buffers the 8-bit data byte travelling across the bidirectional Data Bus between CPU and RAM.',
  },
  SP: {
    name: 'Stack Pointer',
    detail: 'Points to the top of the process stack in high memory (grows downward from 0xFF).',
  },
  AX: {
    name: 'Accumulator Register (8-Bit)',
    detail: 'Primary ALU operand register (Op1) and destination for arithmetic results (or Quotient in DIV).',
  },
  BX: {
    name: 'Base Register (8-Bit)',
    detail: 'Secondary ALU operand register (Op2) and destination for the Remainder after Restoring Division.',
  },
  ZF: {
    name: 'Zero Flag',
    detail: 'Set to 1 when the 8-bit ALU output equals 0x00 (all 8 bits are 0).',
  },
  SF: {
    name: 'Sign Flag',
    detail: 'Mirrors Bit 7 (MSB) of the 8-bit ALU result. Set to 1 when the Two\'s Complement value is negative.',
  },
  CF: {
    name: 'Carry / Borrow Flag',
    detail: 'Set to 1 on unsigned 8-bit carry-out (ADD), unsigned borrow (SUB), or upper-byte overflow (MUL).',
  },
  OF: {
    name: 'Overflow Flag',
    detail: 'Set to 1 when a signed Two\'s Complement result exceeds [-128, +127] or 8-bit MUL exceeds 255.',
  },
};

export function parseExpression(rawInput) {
  const trimmed = (rawInput || '').trim();
  const match = trimmed.match(/^(-?\d+)\s*([+\-*/])\s*(-?\d+)$/);
  if (!match) {
    return {
      valid: false,
      error: 'Enter an expression like "14 + 9", "10 - 15", "6 * 5", or "10 / 0".',
    };
  }

  const num1 = Number.parseInt(match[1], 10);
  const operator = match[2];
  const num2 = Number.parseInt(match[3], 10);

  if (Number.isNaN(num1) || Number.isNaN(num2)) {
    return { valid: false, error: 'Operands must be valid integers.' };
  }

  if (num1 < 0 || num1 > 255 || num2 < 0 || num2 > 255) {
    return {
      valid: false,
      error: 'Operands must fit in an unsigned 8-bit byte (0 to 255).',
    };
  }

  return {
    valid: true,
    num1,
    operator,
    num2,
    opcode: OPCODES[operator],
    mnemonic: MNEMONICS[OPCODES[operator]],
    normalized: `${num1} ${operator} ${num2}`,
  };
}

export class PhysicalRAM {
  constructor(size = 256) {
    this.size = size;
    this.bytes = new Array(size).fill(0x00);
  }

  read(address) {
    return this.bytes[address & 0xFF];
  }

  write(address, value) {
    this.bytes[address & 0xFF] = value & 0xFF;
  }

  reset() {
    this.bytes.fill(0x00);
  }

  snapshot() {
    return [...this.bytes];
  }
}

export class MiniOSKernel {
  constructor() {
    this.ram = new PhysicalRAM(256);
    this.reset();
  }

  reset() {
    this.ram.reset();
    this.registers = {
      PC: CODE_SEGMENT_START,
      IR: 0x00,
      MAR: 0x00,
      MDR: 0x00,
      SP: STACK_START,
      AX: 0x00,
      BX: 0x00,
    };
    this.flags = { ZF: 0, SF: 0, CF: 0, OF: 0 };
    this.pidCounter = 1001;
    this.pcb = {
      pid: null,
      state: 'IDLE', // IDLE | READY | RUNNING | TERMINATED | FAULT
      privilegeRing: 3, // 3 = USER MODE, 0 = KERNEL MODE
      syscall: null,
    };
    this.stage = 0; // 0 = idle, 1..5 = pipeline stages
    this.clockCycle = 0;
    this.activeInstruction = null;
    this.changedRegisters = [];
    this.changedFlags = [];
    this.ramActivity = {
      addresses: [],
      mode: null, // 'READ' | 'WRITE' | null
      label: '',
    };
    this.aluTrace = null;
    this.output = null;
    this.fault = null;
    this.narratorLog = [
      {
        id: 'boot-0',
        cycle: 0,
        stage: 0,
        tag: 'BOOT',
        title: 'Mini-OS Kernel Initialized',
        message:
          '256-Byte Physical RAM zeroed (0x00–0xFF). CPU registers reset (PC = 0x10, SP = 0xFF). Processor idling in Ring 3 (User Mode). Enter an expression or choose a preset to begin.',
      },
    ];
  }

  /**
   * Loads a new arithmetic job and immediately executes Stage 1 (Syscall INT 0x80)
   * or prepares the pipeline to start stepping from Stage 1.
   */
  loadInstruction(parsed) {
    // Wrap PC safely within Code Segment [0x10..0xEF]
    if (this.registers.PC < CODE_SEGMENT_START || this.registers.PC > CODE_SEGMENT_END) {
      this.registers.PC = CODE_SEGMENT_START;
    }

    this.activeInstruction = {
      num1: parsed.num1 & 0xFF,
      operator: parsed.operator,
      num2: parsed.num2 & 0xFF,
      opcode: parsed.opcode,
      mnemonic: parsed.mnemonic,
      expression: parsed.normalized,
      codeAddr: this.registers.PC,
    };

    this.stage = 0;
    this.aluTrace = null;
    this.output = null;
    this.fault = null;
    this.changedRegisters = [];
    this.changedFlags = [];
    this.ramActivity = { addresses: [], mode: null, label: '' };
    this.pcb = {
      pid: null,
      state: 'IDLE',
      privilegeRing: 3,
      syscall: null,
    };
    return this.getSnapshot();
  }

  canStep() {
    if (!this.activeInstruction) return false;
    if (this.pcb.state === 'FAULT' || this.pcb.state === 'TERMINATED') return false;
    return this.stage < 5;
  }

  pushLog(entry) {
    this.narratorLog = [
      {
        id: `log-${this.clockCycle}-${this.stage}-${this.narratorLog.length}`,
        cycle: this.clockCycle,
        stage: this.stage,
        ...entry,
      },
      ...this.narratorLog,
    ].slice(0, 40);
  }

  /**
   * Advances the 5-stage hardware execution pipeline by exactly 1 clock stage.
   */
  step() {
    if (!this.canStep()) {
      return this.getSnapshot();
    }

    this.clockCycle += 1;
    const nextStage = this.stage + 1;
    this.stage = nextStage;
    this.changedRegisters = [];
    this.changedFlags = [];
    this.ramActivity = { addresses: [], mode: null, label: '' };

    const instr = this.activeInstruction;

    if (nextStage === 1) {
      this._executeStage1(instr);
    } else if (nextStage === 2) {
      this._executeStage2(instr);
    } else if (nextStage === 3) {
      this._executeStage3(instr);
    } else if (nextStage === 4) {
      this._executeStage4(instr);
    } else if (nextStage === 5) {
      this._executeStage5(instr);
    }

    return this.getSnapshot();
  }

  _executeStage1(instr) {
    const pid = this.pidCounter;
    this.pidCounter += 1;

    // Write Data Segment operands & Code Segment opcode to Physical RAM
    this.ram.write(DATA_SEGMENT.OP1_ADDR, instr.num1);
    this.ram.write(DATA_SEGMENT.OP2_ADDR, instr.num2);
    this.ram.write(instr.codeAddr, instr.opcode);

    // Transition Ring 3 (User) -> Ring 0 (Kernel) via INT 0x80
    this.pcb = {
      pid,
      state: 'RUNNING',
      privilegeRing: 0,
      syscall: 'INT 0x80 // SYSCALL #42 (sys_alu_compute)',
    };

    this.ramActivity = {
      addresses: [DATA_SEGMENT.OP1_ADDR, DATA_SEGMENT.OP2_ADDR, instr.codeAddr],
      mode: 'WRITE',
      label: `DMA WRITE: OP1->0x00, OP2->0x01, OPCODE(${instr.mnemonic})->0x${toHex8(instr.codeAddr)}`,
    };

    this.pushLog({
      tag: 'STAGE 1 // INT 0x80',
      title: `Process PID ${pid} Created -> Kernel Trap (Ring 3 -> Ring 0)`,
      message: `Allocated PCB (PID ${pid}, READY -> RUNNING) and invoked software interrupt INT 0x80 (sys_alu_compute). CPU elevated to RING 0 (Kernel Mode). Wrote Op1=${instr.num1} (0x${toHex8(instr.num1)}) to RAM[0x00], Op2=${instr.num2} (0x${toHex8(instr.num2)}) to RAM[0x01], and opcode 0x${toHex8(instr.opcode)} (${instr.mnemonic}) to Code Segment RAM[0x${toHex8(instr.codeAddr)}].`,
    });
  }

  _executeStage2(instr) {
    // Load PC into MAR, read opcode from RAM into MDR and IR, increment PC
    const fetchAddr = this.registers.PC;
    this.registers.MAR = fetchAddr;
    const fetchedByte = this.ram.read(fetchAddr);
    this.registers.MDR = fetchedByte;
    this.registers.IR = fetchedByte;
    this.registers.PC = rippleCarryAdd(fetchAddr, 1).sum;

    this.changedRegisters = ['MAR', 'MDR', 'IR', 'PC'];
    this.ramActivity = {
      addresses: [fetchAddr],
      mode: 'READ',
      label: `BUS READ: RAM[0x${toHex8(fetchAddr)}] -> MDR -> IR (0x${toHex8(fetchedByte)} ${MNEMONICS[fetchedByte] || 'NOP'})`,
    };

    this.pushLog({
      tag: 'STAGE 2 // FETCH & DECODE',
      title: `Instruction Fetch via Memory Bus (${instr.mnemonic})`,
      message: `Copied PC (0x${toHex8(fetchAddr)}) into MAR and drove the Address Bus. Read opcode 0x${toHex8(fetchedByte)} from RAM[0x${toHex8(fetchAddr)}] across the Data Bus into MDR and latched it into IR. Control Unit decoded 0x${toHex8(fetchedByte)} as ${instr.mnemonic}. Incremented PC -> 0x${toHex8(this.registers.PC)}.`,
    });
  }

  _executeStage3(instr) {
    // Fetch RAM[0x00] -> AX and RAM[0x01] -> BX
    this.registers.MAR = DATA_SEGMENT.OP1_ADDR;
    const op1Val = this.ram.read(DATA_SEGMENT.OP1_ADDR);
    this.registers.MDR = op1Val;
    this.registers.AX = op1Val;

    this.registers.MAR = DATA_SEGMENT.OP2_ADDR;
    const op2Val = this.ram.read(DATA_SEGMENT.OP2_ADDR);
    this.registers.MDR = op2Val;
    this.registers.BX = op2Val;

    this.changedRegisters = ['MAR', 'MDR', 'AX', 'BX'];
    this.ramActivity = {
      addresses: [DATA_SEGMENT.OP1_ADDR, DATA_SEGMENT.OP2_ADDR],
      mode: 'READ',
      label: `BUS READ: RAM[0x00]->AX (0x${toHex8(op1Val)}), RAM[0x01]->BX (0x${toHex8(op2Val)})`,
    };

    this.pushLog({
      tag: 'STAGE 3 // MEM->REG LOAD',
      title: `Loaded Operands into 8-Bit Registers AX & BX`,
      message: `Executed two Data Segment bus reads: RAM[0x00] loaded ${op1Val} [${toBinary8(op1Val)}] into AX, and RAM[0x01] loaded ${op2Val} [${toBinary8(op2Val)}] into BX. Both 8-bit LED bit-cell arrays are now primed for the ALU.`,
    });
  }

  _executeStage4(instr) {
    const a = this.registers.AX;
    const b = this.registers.BX;
    const prevFlags = { ...this.flags };

    try {
      let resultByte = 0;
      let carryFlag = 0;
      let overflowFlag = 0;
      let trace = null;
      let narrative = '';

      if (instr.operator === '+') {
        const res = rippleCarryAdd(a, b);
        resultByte = res.sum;
        carryFlag = res.carryOut;
        overflowFlag = res.overflow;
        trace = {
          type: 'ADD',
          mnemonic: 'ADD',
          operandA: a,
          operandB: b,
          result: resultByte,
          carryOut: res.carryOut,
          carryBits: res.carryBits,
          gateSteps: res.gateSteps,
          overflow: overflowFlag,
        };
        this.registers.AX = resultByte;
        this.changedRegisters = ['AX'];

        const overflowNote =
          carryFlag === 1
            ? ` UNSIGNED 8-BIT OVERFLOW: Carry-out from Bit 7 set CF=1 (wrapped mod 256 to ${resultByte}).`
            : overflowFlag === 1
            ? ` SIGNED OVERFLOW: Result crossed 8-bit Two's Complement boundary (OF=1).`
            : '';

        narrative = `Chained 8 full-adder gates (XOR/AND/OR) on AX=${a} and BX=${b}. Carry chain propagated [${[...res.carryBits].reverse().join('')}] (MSB<-LSB). Output 0x${toHex8(resultByte)} (${resultByte}) stored in AX.${overflowNote}`;
      } else if (instr.operator === '-') {
        const res = twosComplementSub(a, b);
        resultByte = res.result;
        carryFlag = res.borrow;
        overflowFlag = res.overflow;
        trace = {
          type: 'SUB',
          mnemonic: 'SUB',
          operandA: a,
          operandB: b,
          result: resultByte,
          carryOut: res.carryOut,
          borrow: res.borrow,
          carryBits: res.carryBits,
          gateSteps: res.gateSteps,
          steps: res.steps,
          overflow: overflowFlag,
        };
        this.registers.AX = resultByte;
        this.changedRegisters = ['AX'];

        const signedRes = toSigned8(resultByte);
        const negNote =
          (resultByte & 0x80) !== 0
            ? ` MSB=1 sets SF=1 -> Two's Complement signed value is ${signedRes} (Borrow CF=${carryFlag}).`
            : '';

        narrative = `Computed Two's Complement of BX (${b}): ~BX = ${toBinary8(res.steps.onesComplement)}, +1 = ${toBinary8(res.steps.twosComplementB)}. Ripple-added AX + (-BX) -> 0x${toHex8(resultByte)} [${toBinary8(resultByte)}] in AX.${negNote}`;
      } else if (instr.operator === '*') {
        const res = shiftAndAddMul(a, b);
        resultByte = res.product;
        carryFlag = res.carryOut;
        overflowFlag = res.overflow;
        trace = {
          type: 'MUL',
          mnemonic: 'MUL',
          operandA: a,
          operandB: b,
          result: resultByte,
          fullProduct16: res.fullProduct16,
          carryOut: res.carryOut,
          overflow: overflowFlag,
          cycles: res.cycles,
        };
        this.registers.AX = resultByte;
        this.changedRegisters = ['AX'];

        const addCount = res.cycles.filter((c) => c.added).length;
        const ovNote =
          overflowFlag === 1
            ? ` 16-bit product (${res.fullProduct16}) exceeded 8 bits (CF=1, OF=1); lower byte 0x${toHex8(resultByte)} latched in AX.`
            : '';

        narrative = `Executed 8-cycle Hardware Shift-and-Add Multiplier (${addCount} ADD & SHIFT cycles, ${8 - addCount} SHIFT ONLY cycles). Final 8-bit product ${resultByte} (0x${toHex8(resultByte)}) written to AX.${ovNote}`;
      } else if (instr.operator === '/') {
        const res = restoringDiv(a, b);
        resultByte = res.quotient;
        carryFlag = 0;
        overflowFlag = 0;
        trace = {
          type: 'DIV',
          mnemonic: 'DIV',
          operandA: a,
          operandB: b,
          result: res.quotient,
          quotient: res.quotient,
          remainder: res.remainder,
          cycles: res.cycles,
        };
        this.registers.AX = res.quotient;
        this.registers.BX = res.remainder;
        this.changedRegisters = ['AX', 'BX'];

        narrative = `Executed 8-cycle Hardware Restoring Division (${a} / ${b}). Latched Quotient=${res.quotient} (0x${toHex8(res.quotient)}) into AX and Remainder=${res.remainder} (0x${toHex8(res.remainder)}) into BX.`;
      }

      // Update CPU Status Flags
      const nextFlags = {
        ZF: resultByte === 0 ? 1 : 0,
        SF: (resultByte & 0x80) !== 0 ? 1 : 0,
        CF: carryFlag,
        OF: overflowFlag,
      };
      this.flags = nextFlags;
      this.changedFlags = Object.keys(nextFlags).filter(
        (key) => nextFlags[key] !== prevFlags[key] || nextFlags[key] === 1
      );
      this.aluTrace = trace;

      this.pushLog({
        tag: `STAGE 4 // ALU (${instr.mnemonic})`,
        title: `Bitwise Gate-Level Execution Complete`,
        message: narrative,
      });
    } catch (err) {
      if (err instanceof HardwareInterruptError) {
        this.pcb = {
          ...this.pcb,
          state: 'FAULT',
          privilegeRing: 0,
          syscall: 'IVT[0x00] // KERNEL EXCEPTION HANDLER',
        };
        this.fault = {
          vector: err.vector,
          code: err.code,
          message: err.message,
          pid: this.pcb.pid,
          expression: instr.expression,
          details: err.details,
        };
        this.aluTrace = {
          type: 'FAULT',
          mnemonic: 'DIV',
          operandA: a,
          operandB: b,
          error: err.message,
          vector: err.vector,
        };
        this.pushLog({
          tag: 'FAULT // INT 0x00',
          title: err.message,
          message: `ALU Restoring Divider detected divisor BX = 0x00 during ${instr.expression}. CPU asserted Hardware Exception Vector 0x00. Kernel Exception Handler aborted PID ${this.pcb.pid} (State -> FAULT) to protect memory integrity.`,
          isFault: true,
        });
      } else {
        throw err;
      }
    }
  }

  _executeStage5(instr) {
    const resultByte = this.registers.AX;
    this.registers.MAR = DATA_SEGMENT.RESULT_ADDR;
    this.registers.MDR = resultByte;
    this.ram.write(DATA_SEGMENT.RESULT_ADDR, resultByte);

    this.changedRegisters = ['MAR', 'MDR'];
    this.ramActivity = {
      addresses: [DATA_SEGMENT.RESULT_ADDR],
      mode: 'WRITE',
      label: `WRITE-BACK: AX (0x${toHex8(resultByte)}) -> RAM[0x02]`,
    };

    // IRET: Kernel Ring 0 -> User Ring 3, PCB -> TERMINATED
    this.pcb = {
      ...this.pcb,
      state: 'TERMINATED',
      privilegeRing: 3,
      syscall: 'IRET // RETURN TO USER MODE',
    };

    const signedVal = toSigned8(resultByte);
    this.output = {
      expression: instr.expression,
      mnemonic: instr.mnemonic,
      binary: toBinary8(resultByte),
      hex: `0x${toHex8(resultByte)}`,
      unsigned: resultByte,
      signed: signedVal,
      remainder: instr.operator === '/' ? this.registers.BX : null,
      fullProduct16: instr.operator === '*' ? this.aluTrace?.fullProduct16 ?? null : null,
      unsignedOverflow: instr.operator === '+' && this.flags.CF === 1,
      signedOverflow: this.flags.OF === 1,
    };

    const remNote =
      this.output.remainder !== null ? ` (Remainder BX = ${this.output.remainder})` : '';

    this.pushLog({
      tag: 'STAGE 5 // WB & IRET',
      title: `Write-Back to RAM[0x02] & IRET -> Ring 3`,
      message: `Committed AX (0x${toHex8(resultByte)}) to Data Segment RAM[0x02]. Executed IRET instruction to restore RING 3 (User Mode) and marked PID ${this.pcb.pid} as TERMINATED. Result: Binary ${this.output.binary} | Unsigned ${this.output.unsigned} | Signed 2's Comp ${this.output.signed}${remNote}.`,
    });
  }

  getSnapshot() {
    return {
      ram: this.ram.snapshot(),
      registers: { ...this.registers },
      flags: { ...this.flags },
      pcb: { ...this.pcb },
      stage: this.stage,
      clockCycle: this.clockCycle,
      activeInstruction: this.activeInstruction ? { ...this.activeInstruction } : null,
      changedRegisters: [...this.changedRegisters],
      changedFlags: [...this.changedFlags],
      ramActivity: {
        addresses: [...this.ramActivity.addresses],
        mode: this.ramActivity.mode,
        label: this.ramActivity.label,
      },
      aluTrace: this.aluTrace,
      output: this.output ? { ...this.output } : null,
      fault: this.fault ? { ...this.fault } : null,
      narratorLog: [...this.narratorLog],
      canStep: this.canStep(),
    };
  }
}
