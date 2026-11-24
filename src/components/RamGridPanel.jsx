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
const BIT_INDICES_DESC = [7, 6, 5, 4, 3, 2, 1, 0];

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

  const activeAddrs = ramActivity.addresses || [];
  const activeSet = new Set(activeAddrs);
  const activeMode = ramActivity.mode; // 'READ' | 'WRITE' | null

  // Crosshair targeting: prefer active bus addresses, otherwise inspected address
  const crosshairAddrs = activeAddrs.length > 0 ? activeAddrs : [inspectedAddr];
  const activeRows = new Set(crosshairAddrs.map((a) => (a >>> 4) & 0x0F));
  const activeCols = new Set(crosshairAddrs.map((a) => a & 0x0F));

  const inspectedValue = ram[inspectedAddr] ?? 0;
  const inspectedMeta = getSegmentInfo(inspectedAddr, inspectedValue);

  return (
    <section className="hw-panel hw-reticle flex flex-col rounded-lg">
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
              ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.32)]'
              : activeMode === 'READ'
              ? 'border-white/60 bg-white/12 text-white shadow-[0_0_14px_rgba(255,255,255,0.16)]'
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

        {/* 16x16 Hexadecimal Memory Matrix with Bus Targeting Crosshairs */}
        <div className="overflow-x-auto rounded-md border border-white/12 bg-[#050505] p-2">
          <div className="min-w-[300px]">
            {/* Column Header Row */}
            <div className="mb-1 grid grid-cols-[20px_repeat(16,minmax(0,1fr))] gap-[1.5px] text-center font-mono-tech text-[9px]">
              <div />
              {HEX_DIGITS.map((col, colIdx) => {
                const isColTarget = activeCols.has(colIdx);
                return (
                  <div
                    key={`col-${col}`}
                    className={`rounded-xs py-0.5 font-semibold transition-colors ${
                      isColTarget
                        ? 'bg-white/15 text-white'
                        : 'text-neutral-600'
                    }`}
                  >
                    {col}
                  </div>
                );
              })}
            </div>

            {/* 16 Memory Rows (0x00..0xF0) */}
            <div className="space-y-[1.5px]">
              {HEX_DIGITS.map((rowHex, rowIdx) => {
                const rowBase = rowIdx << 4;
                const isDataRow = rowIdx === 0;
                const isCodeStartRow = rowIdx === 1;
                const isRowTarget = activeRows.has(rowIdx);
                return (
                  <div
                    key={`row-${rowHex}`}
                    className={`grid grid-cols-[20px_repeat(16,minmax(0,1fr))] items-center gap-[1.5px] ${
                      isCodeStartRow ? 'pt-1' : ''
                    }`}
                  >
                    <div
                      className={`rounded-xs py-0.5 text-center font-mono-tech text-[8.5px] font-semibold transition-colors ${
                        isRowTarget
                          ? 'bg-white/15 text-white'
                          : isDataRow || isCodeStartRow
                          ? 'text-neutral-400'
                          : 'text-neutral-600'
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
                      const isCrosshair = isRowTarget || activeCols.has(colIdx);
                      const isDataSlot = addr <= 0x02;
                      const isPc = addr === registers.PC;
                      const isSp = addr === registers.SP;
                      const isNonZero = byteVal !== 0;

                      let cellStyle = isCrosshair
                        ? 'border-white/10 bg-white/[0.045] text-neutral-500 hover:border-white/35 hover:text-neutral-200'
                        : 'border-transparent bg-[#0a0a0a] text-neutral-700 hover:border-white/30 hover:text-neutral-300';

                      if (isWrite) {
                        cellStyle =
                          'z-10 border-white bg-white font-bold text-black shadow-[0_0_16px_rgba(255,255,255,0.75)] scale-105';
                      } else if (isRead) {
                        cellStyle =
                          'z-10 border-white bg-white/25 font-bold text-white shadow-[0_0_12px_rgba(255,255,255,0.45)] animate-pulse';
                      } else if (isNonZero) {
                        cellStyle =
                          'border-white/25 bg-white/[0.1] font-medium text-white hover:border-white/55';
                      } else if (isDataSlot) {
                        cellStyle =
                          'border-white/18 bg-[#111111] text-neutral-400 hover:border-white/40';
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
                          className={`relative flex h-6 w-full cursor-pointer items-center justify-center rounded-[3px] border font-mono-tech text-[9px] leading-none transition-all duration-200 xl:text-[10px] ${cellStyle} ${
                            isInspected && !isWrite && !isRead
                              ? 'ring-1 ring-white/80'
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
          {[
            { addr: 0x00, label: '0x00 // OP1' },
            { addr: 0x01, label: '0x01 // OP2' },
            { addr: 0x02, label: '0x02 // RESULT' },
          ].map((slot) => {
            const isActiveSlot = activeSet.has(slot.addr);
            const isSel = inspectedAddr === slot.addr;
            return (
              <button
                key={slot.addr}
                type="button"
                onClick={() => setInspectedAddr(slot.addr)}
                className={`cursor-pointer rounded border px-2 py-1.5 text-left transition ${
                  isActiveSlot
                    ? 'border-white bg-white/12 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                    : isSel
                    ? 'border-white/45 bg-[#121212]'
                    : 'border-white/12 bg-[#0b0b0b] hover:border-white/40'
                }`}
              >
                <div className="text-[9px] text-neutral-500">{slot.label}</div>
                <div className="mt-0.5 font-bold text-white">
                  0x{toHex8(ram[slot.addr])}{' '}
                  <span className="font-normal text-neutral-400">
                    ({ram[slot.addr]})
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Cell Inspector Footer with Inline 8-Bit Mini-LED Preview */}
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

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-400">
            <span>{inspectedMeta.role}</span>
            <span className="text-white">
              0x{toHex8(inspectedValue)} &bull; {toBinary8(inspectedValue)} &bull; U:
              {inspectedValue} / S:{toSigned8(inspectedValue)}
            </span>
          </div>

          {/* Inline 8-Bit Mini-LED Byte Preview */}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/8 pt-2">
            <span className="text-[9px] tracking-widest text-neutral-500 uppercase">
              Byte Bits (b7–b0)
            </span>
            <div className="flex items-center gap-1">
              {BIT_INDICES_DESC.map((b, idx) => {
                const bit = (inspectedValue >>> b) & 1;
                return (
                  <React.Fragment key={b}>
                    {idx === 4 && <span className="mx-0.5 h-3 w-[1px] bg-white/20" />}
                    <span
                      title={`b${b} = ${bit}`}
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border text-[8px] font-bold transition-all ${
                        bit === 1
                          ? 'border-white bg-white text-black shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                          : 'border-white/15 bg-black text-neutral-600'
                      }`}
                    >
                      {bit}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
