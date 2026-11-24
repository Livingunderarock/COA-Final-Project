import React from 'react';
import { Check, ChevronRight, Radio, AlertOctagon } from 'lucide-react';
import { PIPELINE_STAGES, MNEMONICS } from '../hardware/cpuAndRam.js';
import { toHex8 } from '../hardware/alu.js';

export default function BusArchitectureRibbon({
  stage,
  pcb,
  registers,
  activeInstruction,
  fault,
  ramActivity,
}) {
  const isFaulted = pcb.state === 'FAULT' || Boolean(fault);
  const isRunning = pcb.state === 'RUNNING';

  // Stage-synchronized active silicon blocks
  const activeBlocks = {
    shell: stage === 0 || stage === 1 || stage === 5,
    kernel: stage === 1 || (stage === 4 && isFaulted) || stage === 5,
    control: stage === 2,
    ram:
      stage === 1 ||
      stage === 2 ||
      stage === 3 ||
      stage === 5 ||
      (ramActivity?.addresses?.length ?? 0) > 0,
    alu: stage === 3 || stage === 4 || (stage === 5 && !isFaulted),
  };

  // Stage-synchronized bus trace activations
  const traceSyscall = stage === 1; // USER SHELL -> KERNEL
  const traceDmaWrite = stage === 1; // KERNEL -> RAM (top DMA bus)
  const traceDecode = stage === 2; // KERNEL -> CONTROL UNIT
  const traceFetch = stage === 2; // CONTROL UNIT <-> RAM
  const traceOperands = stage === 3; // RAM -> ALU CORE
  const traceWriteBack = stage === 5 && !isFaulted; // ALU CORE -> RAM
  const traceIret = stage === 5 && !isFaulted; // RAM/KERNEL -> USER SHELL (bottom IRET loop)
  const traceIrqFault = isFaulted; // ALU CORE -> KERNEL (IRQ 0x00 TRAP)

  const blocks = [
    {
      id: 'shell',
      x: 20,
      title: 'USER SHELL',
      sub: 'RING 3 // TTY0',
      live: activeInstruction ? activeInstruction.expression : 'AWAITING CMD',
      active: activeBlocks.shell,
      faulted: false,
    },
    {
      id: 'kernel',
      x: 223,
      title: 'KERNEL / PCB',
      sub: 'INT 0x80 // IVT',
      live: `PID ${pcb.pid || '----'} · ${pcb.state}`,
      active: activeBlocks.kernel,
      faulted: isFaulted,
    },
    {
      id: 'control',
      x: 426,
      title: 'CONTROL UNIT',
      sub: 'DECODE // BUS',
      live: `PC:${toHex8(registers.PC)} IR:${toHex8(registers.IR)} ${
        MNEMONICS[registers.IR] || 'NOP'
      }`,
      active: activeBlocks.control,
      faulted: false,
    },
    {
      id: 'ram',
      x: 629,
      title: 'PHYSICAL RAM',
      sub: '256B // 00–FF',
      live: `MAR:${toHex8(registers.MAR)} MDR:${toHex8(registers.MDR)}`,
      active: activeBlocks.ram,
      faulted: false,
    },
    {
      id: 'alu',
      x: 832,
      title: '8-BIT ALU CORE',
      sub: 'BITWISE GATES',
      live: `AX:${toHex8(registers.AX)} BX:${toHex8(registers.BX)}`,
      active: activeBlocks.alu,
      faulted: isFaulted,
    },
  ];

  const progressPct = Math.min(100, Math.max(0, (stage / 5) * 100));

  return (
    <section
      aria-label="Silicon Datapath and 5-Stage Clocked Execution Pipeline"
      className="hw-panel hw-reticle rounded-lg px-4 py-3.5"
    >
      {/* Header Row */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono-tech text-[10px] font-semibold tracking-[0.18em] text-neutral-300 uppercase">
          <Radio
            className={`h-3.5 w-3.5 ${
              isRunning
                ? 'animate-pulse text-white'
                : isFaulted
                ? 'text-white'
                : 'text-neutral-500'
            }`}
          />
          <span>Silicon Datapath &amp; 5-Stage Clocked Execution Pipeline</span>
        </div>

        <div className="flex items-center gap-3 font-mono-tech text-[11px] text-neutral-400">
          {activeInstruction ? (
            <span>
              ACTIVE JOB:{' '}
              <strong className="text-white">{activeInstruction.expression}</strong>{' '}
              <span className="text-neutral-500">
                ({activeInstruction.mnemonic})
              </span>
            </span>
          ) : (
            <span>PIPELINE IDLE // SELECT A PRESET OR EXECUTE AN INSTRUCTION</span>
          )}
          <span className="hidden rounded border border-white/15 bg-black px-2 py-0.5 text-[10px] text-neutral-300 sm:inline-block">
            STAGE {stage}/5
          </span>
        </div>
      </div>

      {/* Upper Band: Live Interactive SVG Hardware Bus Topology */}
      <div className="mb-3 overflow-hidden rounded-md border border-white/10 bg-[#050505] px-2 py-1.5">
        <svg
          viewBox="0 0 1000 128"
          className="h-auto w-full select-none"
          role="img"
          aria-label="Live CPU, Kernel, RAM, and ALU bus datapath diagram"
        >
          <defs>
            <filter id="mono-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Top DMA Bus Trace: KERNEL / PCB -> PHYSICAL RAM (Stage 1) */}
          <path
            d="M 297 24 L 297 9 L 703 9 L 703 24"
            fill="none"
            stroke={traceDmaWrite ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}
            strokeWidth={traceDmaWrite ? 1.8 : 1}
          />
          {traceDmaWrite && (
            <path
              d="M 297 24 L 297 9 L 703 9 L 703 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              filter="url(#mono-glow)"
              className="animate-bus-flow"
            />
          )}
          <rect
            x="456"
            y="2"
            width="88"
            height="13"
            rx="2"
            fill={traceDmaWrite ? '#FFFFFF' : '#080808'}
            stroke={traceDmaWrite ? '#FFFFFF' : 'rgba(255,255,255,0.12)'}
            strokeWidth="0.8"
          />
          <text
            x="500"
            y="11"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="7.5"
            fontWeight={traceDmaWrite ? '700' : '500'}
            fill={traceDmaWrite ? '#000000' : '#666666'}
            letterSpacing="0.8"
          >
            DMA WRITE
          </text>

          {/* 2. Inter-Block Trace: USER SHELL -> KERNEL (SYSCALL) */}
          <line
            x1="168"
            y1="52"
            x2="223"
            y2="52"
            stroke={traceSyscall ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={traceSyscall ? 2 : 1}
          />
          {traceSyscall && (
            <line
              x1="168"
              y1="52"
              x2="223"
              y2="52"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              filter="url(#mono-glow)"
              className="animate-bus-flow"
            />
          )}
          <rect
            x="173"
            y="34"
            width="45"
            height="11"
            rx="2"
            fill={traceSyscall ? '#FFFFFF' : '#070707'}
            stroke={traceSyscall ? '#FFFFFF' : 'rgba(255,255,255,0.12)'}
            strokeWidth="0.7"
          />
          <text
            x="195.5"
            y="42"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="6.5"
            fontWeight="700"
            fill={traceSyscall ? '#000000' : '#666666'}
          >
            SYSCALL
          </text>

          {/* 3. Inter-Block Trace: KERNEL -> CONTROL UNIT (DISPATCH / FETCH) */}
          <line
            x1="371"
            y1="52"
            x2="426"
            y2="52"
            stroke={traceDecode ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={traceDecode ? 2 : 1}
          />
          {traceDecode && (
            <line
              x1="371"
              y1="52"
              x2="426"
              y2="52"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              filter="url(#mono-glow)"
              className="animate-bus-flow"
            />
          )}
          <rect
            x="378"
            y="34"
            width="41"
            height="11"
            rx="2"
            fill={traceDecode ? '#FFFFFF' : '#070707'}
            stroke={traceDecode ? '#FFFFFF' : 'rgba(255,255,255,0.12)'}
            strokeWidth="0.7"
          />
          <text
            x="398.5"
            y="42"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="6.5"
            fontWeight="700"
            fill={traceDecode ? '#000000' : '#666666'}
          >
            FETCH
          </text>

          {/* 4. Inter-Block Trace: CONTROL UNIT <-> PHYSICAL RAM (DATA BUS) */}
          <line
            x1="574"
            y1="47"
            x2="629"
            y2="47"
            stroke={traceFetch ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={traceFetch ? 1.8 : 1}
          />
          <line
            x1="574"
            y1="57"
            x2="629"
            y2="57"
            stroke={traceFetch ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={traceFetch ? 1.8 : 1}
          />
          {traceFetch && (
            <>
              <line
                x1="574"
                y1="47"
                x2="629"
                y2="47"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                filter="url(#mono-glow)"
                className="animate-bus-flow"
              />
              <line
                x1="574"
                y1="57"
                x2="629"
                y2="57"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                filter="url(#mono-glow)"
                className="animate-bus-flow-reverse"
              />
            </>
          )}
          <rect
            x="578"
            y="31"
            width="47"
            height="11"
            rx="2"
            fill={traceFetch ? '#FFFFFF' : '#070707'}
            stroke={traceFetch ? '#FFFFFF' : 'rgba(255,255,255,0.12)'}
            strokeWidth="0.7"
          />
          <text
            x="601.5"
            y="39"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="6.5"
            fontWeight="700"
            fill={traceFetch ? '#000000' : '#666666'}
          >
            DATA BUS
          </text>

          {/* 5. Inter-Block Trace: PHYSICAL RAM <-> 8-BIT ALU CORE (OPERANDS / WB) */}
          <line
            x1="777"
            y1="47"
            x2="832"
            y2="47"
            stroke={traceOperands ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={traceOperands ? 1.8 : 1}
          />
          <line
            x1="777"
            y1="57"
            x2="832"
            y2="57"
            stroke={traceWriteBack ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={traceWriteBack ? 1.8 : 1}
          />
          {traceOperands && (
            <line
              x1="777"
              y1="47"
              x2="832"
              y2="47"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              filter="url(#mono-glow)"
              className="animate-bus-flow"
            />
          )}
          {traceWriteBack && (
            <line
              x1="777"
              y1="57"
              x2="832"
              y2="57"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              filter="url(#mono-glow)"
              className="animate-bus-flow-reverse"
            />
          )}
          <rect
            x="780"
            y="31"
            width="49"
            height="11"
            rx="2"
            fill={traceOperands || traceWriteBack ? '#FFFFFF' : '#070707'}
            stroke={
              traceOperands || traceWriteBack ? '#FFFFFF' : 'rgba(255,255,255,0.12)'
            }
            strokeWidth="0.7"
          />
          <text
            x="804.5"
            y="39"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="6.2"
            fontWeight="700"
            fill={traceOperands || traceWriteBack ? '#000000' : '#666666'}
          >
            {traceWriteBack ? 'WB 0x02' : 'OPERANDS'}
          </text>

          {/* 6. Bottom Fault Interrupt Trace: 8-BIT ALU CORE -> KERNEL / PCB (IRQ 0x00) */}
          <path
            d="M 906 80 L 906 99 L 297 99 L 297 80"
            fill="none"
            stroke={traceIrqFault ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={traceIrqFault ? 2 : 1}
          />
          {traceIrqFault && (
            <path
              d="M 906 80 L 906 99 L 297 99 L 297 80"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              filter="url(#mono-glow)"
              className="animate-bus-flow"
            />
          )}
          <rect
            x="558"
            y="92"
            width="86"
            height="13"
            rx="2"
            fill={traceIrqFault ? '#FFFFFF' : '#070707'}
            stroke={traceIrqFault ? '#FFFFFF' : 'rgba(255,255,255,0.1)'}
            strokeWidth="0.8"
          />
          <text
            x="601"
            y="101"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="7"
            fontWeight="700"
            fill={traceIrqFault ? '#000000' : '#555555'}
            letterSpacing="0.7"
          >
            IRQ 0x00 TRAP
          </text>

          {/* 7. Bottom IRET Return Trace: RAM / KERNEL -> USER SHELL (Stage 5) */}
          <path
            d="M 703 80 L 703 117 L 94 117 L 94 80"
            fill="none"
            stroke={traceIret ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={traceIret ? 1.8 : 1}
          />
          {traceIret && (
            <path
              d="M 703 80 L 703 117 L 94 117 L 94 80"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              filter="url(#mono-glow)"
              className="animate-bus-flow"
            />
          )}
          <rect
            x="333"
            y="110"
            width="130"
            height="13"
            rx="2"
            fill={traceIret ? '#FFFFFF' : '#070707'}
            stroke={traceIret ? '#FFFFFF' : 'rgba(255,255,255,0.1)'}
            strokeWidth="0.8"
          />
          <text
            x="398"
            y="119"
            textAnchor="middle"
            className="font-mono-tech"
            fontSize="7"
            fontWeight="700"
            fill={traceIret ? '#000000' : '#555555'}
            letterSpacing="0.7"
          >
            IRET // RING 0 &rarr; RING 3
          </text>

          {/* 5 Precision Silicon Hardware Blocks */}
          {blocks.map((blk) => {
            const isHighlighted = blk.active || blk.faulted;
            const rectFill = blk.faulted
              ? '#FFFFFF'
              : blk.active
              ? '#141414'
              : '#090909';
            const strokeColor = blk.faulted
              ? '#FFFFFF'
              : blk.active
              ? '#FFFFFF'
              : 'rgba(255,255,255,0.16)';
            const titleColor = blk.faulted
              ? '#000000'
              : blk.active
              ? '#FFFFFF'
              : '#B3B3B3';
            const subColor = blk.faulted
              ? '#333333'
              : blk.active
              ? '#A3A3A3'
              : '#595959';
            const liveColor = blk.faulted
              ? '#000000'
              : blk.active
              ? '#FFFFFF'
              : '#737373';

            return (
              <g
                key={blk.id}
                filter={isHighlighted ? 'url(#mono-glow)' : undefined}
              >
                <rect
                  x={blk.x}
                  y="24"
                  width="148"
                  height="56"
                  rx="4"
                  fill={rectFill}
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? '1.5' : '1'}
                />
                {/* Top active hairline */}
                {blk.active && !blk.faulted && (
                  <line
                    x1={blk.x + 8}
                    y1="25.5"
                    x2={blk.x + 140}
                    y2="25.5"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                )}
                {/* Status micro-LED */}
                <circle
                  cx={blk.x + 137}
                  cy="34"
                  r="2.4"
                  fill={
                    blk.faulted
                      ? '#000000'
                      : blk.active
                      ? '#FFFFFF'
                      : 'rgba(255,255,255,0.14)'
                  }
                />
                <text
                  x={blk.x + 10}
                  y="37.5"
                  className="font-mono-tech"
                  fontSize="9"
                  fontWeight="700"
                  letterSpacing="1.1"
                  fill={titleColor}
                >
                  {blk.title}
                </text>
                <text
                  x={blk.x + 10}
                  y="49"
                  className="font-mono-tech"
                  fontSize="7"
                  letterSpacing="0.8"
                  fill={subColor}
                >
                  {blk.sub}
                </text>
                <line
                  x1={blk.x + 10}
                  y1="56"
                  x2={blk.x + 138}
                  y2="56"
                  stroke={
                    blk.faulted
                      ? 'rgba(0,0,0,0.2)'
                      : 'rgba(255,255,255,0.12)'
                  }
                  strokeWidth="0.8"
                />
                <text
                  x={blk.x + 10}
                  y="70"
                  className="font-mono-tech"
                  fontSize="8.2"
                  fontWeight="600"
                  fill={liveColor}
                >
                  {blk.live}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Slim Animated Pipeline Progress Rail */}
      <div className="mb-3 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Lower Band: 5-Stage Clocked Execution Stepper */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {PIPELINE_STAGES.map((st, idx) => {
          const isCurrent = stage === st.id;
          const isCompleted =
            stage > st.id ||
            (stage === 5 && st.id === 5 && pcb.state === 'TERMINATED');
          const isStageFault = isCurrent && isFaulted;

          return (
            <div key={st.id} className="relative flex items-center">
              <div
                className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 transition-all duration-300 ${
                  isStageFault
                    ? 'border-white bg-white text-black shadow-[0_0_26px_rgba(255,255,255,0.5)]'
                    : isCurrent
                    ? 'animate-hw-pulse border-white bg-[#171717] text-white'
                    : isCompleted
                    ? 'border-white/30 bg-[#101010] text-neutral-200'
                    : 'border-white/10 bg-[#080808] text-neutral-600'
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono-tech text-[11px] font-bold ${
                    isStageFault
                      ? 'bg-black text-white'
                      : isCurrent
                      ? 'bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                      : isCompleted
                      ? 'border border-white/40 bg-white/15 text-white'
                      : 'border border-white/10 bg-black text-neutral-600'
                  }`}
                >
                  {isStageFault ? (
                    <AlertOctagon className="h-3.5 w-3.5" />
                  ) : isCompleted && !isCurrent ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    st.id
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate font-mono-tech text-[11px] font-bold tracking-wide ${
                        isStageFault
                          ? 'text-black'
                          : isCurrent || isCompleted
                          ? 'text-white'
                          : 'text-neutral-500'
                      }`}
                    >
                      {st.short}
                    </span>
                  </div>
                  <div
                    className={`truncate font-mono-tech text-[9px] ${
                      isStageFault
                        ? 'text-black/80'
                        : isCurrent
                        ? 'text-neutral-300'
                        : 'text-neutral-500'
                    }`}
                  >
                    {st.subtitle}
                  </div>
                </div>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && (
                <ChevronRight
                  className={`hidden h-4 w-4 shrink-0 sm:block ${
                    stage > st.id ? 'text-white/60' : 'text-neutral-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
