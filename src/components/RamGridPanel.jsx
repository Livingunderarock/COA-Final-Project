import React, { useState } from 'react';
import { HardDrive, ArrowUpDown } from 'lucide-react';
import { toBinary8, toHex8, toSigned8 } from '../hardware/alu.js';
import {
  DATA_SEGMENT,
  CODE_SEGMENT_START,
  STACK_START,
  MNEMONICS,
} from '../hardware/cpuAndRam.js';

const HEX_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

function getSegmentInfo(addr, value) {
  if (addr === DATA_SEGMENT.OP1_ADDR) return { segment: 'DATA SEGMENT', role: 'Operand 1 (Op1)' };
  if (addr === DATA_SEGMENT.OP2_ADDR) return { segment: 'DATA SEGMENT', role: 'Operand 2 (Op2)' };
  if (addr === DATA_SEGMENT.RESULT_ADDR) return { segment: 'DATA SEGMENT', role: 'ALU Result Output' };
  if (addr < CODE_SEGMENT_START) return { segment: 'DATA SEGMENT', role: 'Reserved Data Byte' };
  if (addr === STACK_START) return { segment: 'STACK SEGMENT', role: 'Top of Stack (SP Init)' };
  if (addr >= 0xF0) return { segment: 'STACK SEGMENT', role: 'User/Kernel Stack Area' };
  const op = MNEMONICS[value];
  return {
    segment: 'CODE SEGMENT',
    role: op ? `Instruction Opcode (${op})` : 'Program Memory',
  };
}

export default function RamGridPanel({ ram, registers, ramActivity }) {
  const [inspectedAddr, setInspectedAddr] = useState(0x00);

  const activeSet = new Set(ramActivity.addresses || []);
  const activeMode = ramActivity.mode; // 'READ' | 'WRITE' | null

  const inspectedValue = ram[inspectedAddr] ?? 0;
  const inspectedMeta = getSegmentInfo(inspectedAddr, inspectedValue);

  return (
    <section className="hw-panel flex flex-col rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-white" />
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.16em] text-white uppercase">
            03 // Physical RAM (256B)
          </h2>
        </div>
        <span className="font-mono-tech text-[10px] tracking-widest text-neutral-500">
          0x00 – 0xFF
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Live Memory Bus Telemetry Bar */}
        <div
          className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 font-mono-tech text-[11px] transition-all duration-300 ${
            activeMode === 'WRITE'
              ? 'border-white bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.28)]'
              : activeMode === 'READ'
              ? 'border-white/60 bg-white/12 text-white'
              : 'border-white/12 bg-black text-neutral-400'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-semibold">
              {ramActivity.label || 'MEMORY BUS IDLE // AWAITING MAR/MDR CYCLE'}
            </span>
          </div>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ${
              activeMode === 'WRITE'
                ? 'bg-black text-white'
                : activeMode === 'READ'
                ? 'bg-white text-black'
                : 'bg-white/10 text-neutral-500'
            }`}
          >
            {activeMode || 'IDLE'}
          </span>
        </div>

        {/* Segment Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tech text-[10px] text-neutral-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs border border-white bg-white" />
              <span>Active Write</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs border border-white bg-white/25" />
              <span>Active Read</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs border border-white/30 bg-white/10" />
              <span>Populated</span>
            </span>
          </div>
          <span className="text-neutral-500">DATA 00–02 | CODE 10+</span>
        </div>

        {/* 16x16 Hexadecimal Memory Matrix */}
        <div className="overflow-x-auto rounded-md border border-white/12 bg-black p-2.5">
          <div className="min-w-[360px]">
            {/* Column Header Row */}
            <div className="mb-1 grid grid-cols-[26px_repeat(16,minmax(0,1fr))] gap-[2px] text-center font-mono-tech text-[9px] text-neutral-500">
              <div />
              {HEX_DIGITS.map((col) => (
                <div key={`col-${col}`} className="py-0.5 font-semibold">
                  {col}
                </div>
              ))}
            </div>

            {/* 16 Memory Rows (0x00..0xF0) */}
            <div className="space-y-[2px]">
              {HEX_DIGITS.map((rowHex, rowIdx) => {
                const rowBase = rowIdx << 4;
                const isDataRow = rowIdx === 0;
                const isCodeStartRow = rowIdx === 1;
                return (
                  <div
                    key={`row-${rowHex}`}
                    className={`grid grid-cols-[26px_repeat(16,minmax(0,1fr))] items-center gap-[2px] ${
                      isCodeStartRow ? 'pt-1' : ''
                    }`}
                  >
                    <div
                      className={`font-mono-tech text-[9px] font-semibold ${
                        isDataRow || isCodeStartRow ? 'text-neutral-300' : 'text-neutral-600'
                      }`}
                    >
                      {rowHex}0
                    </div>

                    {HEX_DIGITS.map((_, colIdx) => {
                      const addr = rowBase | colIdx;
                      const byteVal = ram[addr];
                      const isActive = activeSet.has(addr);
                      const isWrite = isActive && activeMode === 'WRITE';
                      const isRead = isActive && activeMode === 'READ';
                      const isInspected = inspectedAddr === addr;
                      const isDataSlot = addr <= 0x02;
                      const isPc = addr === registers.PC;
                      const isSp = addr === registers.SP;
                      const isNonZero = byteVal !== 0;

                      let cellStyle =
                        'border-transparent bg-[#0a0a0a] text-neutral-700 hover:border-white/30 hover:text-neutral-300';

                      if (isWrite) {
                        cellStyle =
                          'z-10 border-white bg-white font-bold text-black shadow-[0_0_14px_rgba(255,255,255,0.7)] scale-105';
                      } else if (isRead) {
                        cellStyle =
                          'z-10 border-white bg-white/25 font-bold text-white shadow-[0_0_12px_rgba(255,255,255,0.4)] animate-pulse';
                      } else if (isNonZero) {
                        cellStyle =
                          'border-white/20 bg-white/[0.08] font-medium text-white hover:border-white/50';
                      } else if (isDataSlot) {
                        cellStyle =
                          'border-white/15 bg-[#101010] text-neutral-400 hover:border-white/40';
                      } else if (isPc || isSp) {
                        cellStyle =
                          'border-white/25 bg-[#121212] text-neutral-300 hover:border-white/50';
                      }

                      return (
                        <button
                          key={addr}
                          type="button"
                          onMouseEnter={() => setInspectedAddr(addr)}
                          onClick={() => setInspectedAddr(addr)}
                          title={`RAM[0x${toHex8(addr)}] = 0x${toHex8(byteVal)} (${byteVal})`}
                          className={`relative flex h-6 w-full cursor-pointer items-center justify-center rounded-[3px] border font-mono-tech text-[10px] leading-none transition-all duration-200 ${cellStyle} ${
                            isInspected && !isWrite && !isRead
                              ? 'ring-1 ring-white/70'
                              : ''
                          }`}
                        >
                          <span>{toHex8(byteVal)}</span>
                          {/* Tiny micro-dot marker for Data Segment 0x00-0x02 / PC */}
                          {isDataSlot && !isWrite && (
                            <span className="absolute top-[1px] right-[1px] h-1 w-1 rounded-full bg-white/60" />
                          )}
                          {isPc && !isWrite && !isRead && (
                            <span className="absolute bottom-[1px] left-1/2 h-[2px] w-2 -translate-x-1/2 bg-white/80" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Special Segment Quick Tags */}
        <div className="grid grid-cols-3 gap-2 font-mono-tech text-[10px]">
          <button
            type="button"
            onClick={() => setInspectedAddr(0x00)}
            className="cursor-pointer rounded border border-white/12 bg-[#0b0b0b] px-2 py-1.5 text-left transition hover:border-white/40"
          >
            <div className="text-[9px] text-neutral-500">0x00 // OP1</div>
            <div className="mt-0.5 font-bold text-white">
              0x{toHex8(ram[0x00])}{' '}
              <span className="font-normal text-neutral-400">({ram[0x00]})</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setInspectedAddr(0x01)}
            className="cursor-pointer rounded border border-white/12 bg-[#0b0b0b] px-2 py-1.5 text-left transition hover:border-white/40"
          >
            <div className="text-[9px] text-neutral-500">0x01 // OP2</div>
            <div className="mt-0.5 font-bold text-white">
              0x{toHex8(ram[0x01])}{' '}
              <span className="font-normal text-neutral-400">({ram[0x01]})</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setInspectedAddr(0x02)}
            className="cursor-pointer rounded border border-white/12 bg-[#0b0b0b] px-2 py-1.5 text-left transition hover:border-white/40"
          >
            <div className="text-[9px] text-neutral-500">0x02 // RESULT</div>
            <div className="mt-0.5 font-bold text-white">
              0x{toHex8(ram[0x02])}{' '}
              <span className="font-normal text-neutral-400">({ram[0x02]})</span>
            </div>
          </button>
        </div>

        {/* Live Cell Inspector Footer */}
        <div className="rounded-md border border-white/15 bg-[#0a0a0a] p-2.5 font-mono-tech text-[11px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-white">
              CELL 0x{toHex8(inspectedAddr)}{' '}
              <span className="font-normal text-neutral-500">({inspectedAddr})</span>
            </span>
            <span className="rounded border border-white/15 bg-black px-1.5 py-0.5 text-[9px] tracking-wider text-neutral-300">
              {inspectedMeta.segment}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-400">
            <span>{inspectedMeta.role}</span>
            <span className="text-white">
              0x{toHex8(inspectedValue)} &bull; {toBinary8(inspectedValue)} &bull; U:
              {inspectedValue} / S:{toSigned8(inspectedValue)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
