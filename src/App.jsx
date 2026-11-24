import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  Check,
  ChevronRight,
  RotateCcw,
  Radio,
} from 'lucide-react';
import {
  MiniOSKernel,
  PIPELINE_STAGES,
  parseExpression,
} from './hardware/cpuAndRam.js';
import TopHeader from './components/TopHeader.jsx';
import UserShellPanel from './components/UserShellPanel.jsx';
import CpuCorePanel from './components/CpuCorePanel.jsx';
import RamGridPanel from './components/RamGridPanel.jsx';

export default function App() {
  const kernelRef = useRef(null);
  if (!kernelRef.current) {
    kernelRef.current = new MiniOSKernel();
  }

  const [snapshot, setSnapshot] = useState(() => kernelRef.current.getSnapshot());
  const [expression, setExpression] = useState('14 + 9');
  const [validationError, setValidationError] = useState('');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [clockSpeedMs, setClockSpeedMs] = useState(900);

  const parsedCheck = parseExpression(expression);

  const startAndRun = useCallback((exprString, autoPlayAfterStage1) => {
    const parsed = parseExpression(exprString);
    if (!parsed.valid) {
      setValidationError(parsed.error);
      setIsAutoPlaying(false);
      return;
    }
    setValidationError('');
    kernelRef.current.loadInstruction(parsed);
    const afterStage1 = kernelRef.current.step();
    setSnapshot(afterStage1);
    setIsAutoPlaying(autoPlayAfterStage1 && afterStage1.canStep);
  }, []);

  const handleExecute = useCallback(() => {
    startAndRun(expression, true);
  }, [expression, startAndRun]);

  const handleStep = useCallback(() => {
    setIsAutoPlaying(false);
    if (kernelRef.current.canStep()) {
      setSnapshot(kernelRef.current.step());
    } else {
      startAndRun(expression, false);
    }
  }, [expression, startAndRun]);

  const handleToggleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      return;
    }
    if (kernelRef.current.canStep()) {
      setIsAutoPlaying(true);
    } else {
      startAndRun(expression, true);
    }
  }, [isAutoPlaying, expression, startAndRun]);

  const handleSelectPreset = useCallback(
    (presetExpr) => {
      setExpression(presetExpr);
      startAndRun(presetExpr, true);
    },
    [startAndRun]
  );

  const handleReset = useCallback(() => {
    setIsAutoPlaying(false);
    setValidationError('');
    kernelRef.current.reset();
    setSnapshot(kernelRef.current.getSnapshot());
  }, []);

  const handleExpressionChange = useCallback((val) => {
    setExpression(val);
    setValidationError('');
  }, []);

  // Clocked Auto-Play timer
  useEffect(() => {
    if (!isAutoPlaying) return undefined;

    if (!snapshot.canStep) {
      setIsAutoPlaying(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const next = kernelRef.current.step();
      setSnapshot(next);
      if (!next.canStep) {
        setIsAutoPlaying(false);
      }
    }, clockSpeedMs);

    return () => window.clearTimeout(timer);
  }, [isAutoPlaying, snapshot.clockCycle, snapshot.canStep, clockSpeedMs]);

  const isFaulted = snapshot.pcb.state === 'FAULT';

  return (
    <div className="flex min-h-screen flex-col text-white">
      {/* Top Architecture Header & Controls */}
      <TopHeader
        pcb={snapshot.pcb}
        clockCycle={snapshot.clockCycle}
        isAutoPlaying={isAutoPlaying}
        clockSpeedMs={clockSpeedMs}
        onClockSpeedChange={setClockSpeedMs}
        onExecute={handleExecute}
        onStep={handleStep}
        onToggleAutoPlay={handleToggleAutoPlay}
        onReset={handleReset}
        canExecute={parsedCheck.valid}
      />

      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
        {/* 5-Stage Clocked Execution Pipeline Ribbon */}
        <section
          aria-label="5-Stage Clocked Execution Pipeline"
          className="hw-panel rounded-lg px-4 py-3"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono-tech text-[10px] font-semibold tracking-[0.18em] text-neutral-300 uppercase">
              <Radio
                className={`h-3.5 w-3.5 ${
                  snapshot.pcb.state === 'RUNNING'
                    ? 'animate-pulse text-white'
                    : 'text-neutral-500'
                }`}
              />
              <span>5-Stage Clocked Execution Pipeline</span>
            </div>
            <div className="font-mono-tech text-[11px] text-neutral-400">
              {snapshot.activeInstruction ? (
                <span>
                  ACTIVE JOB:{' '}
                  <strong className="text-white">
                    {snapshot.activeInstruction.expression}
                  </strong>{' '}
                  <span className="text-neutral-500">
                    ({snapshot.activeInstruction.mnemonic})
                  </span>
                </span>
              ) : (
                <span>PIPELINE IDLE // SELECT A PRESET OR EXECUTE AN INSTRUCTION</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {PIPELINE_STAGES.map((st, idx) => {
              const isCurrent = snapshot.stage === st.id;
              const isCompleted =
                snapshot.stage > st.id ||
                (snapshot.stage === 5 && st.id === 5 && snapshot.pcb.state === 'TERMINATED');
              const isStageFault = isCurrent && isFaulted;

              return (
                <div key={st.id} className="relative flex items-center">
                  <div
                    className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 transition-all duration-300 ${
                      isStageFault
                        ? 'border-white bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.45)]'
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
                          ? 'bg-white text-black'
                          : isCompleted
                          ? 'border border-white/40 bg-white/15 text-white'
                          : 'border border-white/10 bg-black text-neutral-600'
                      }`}
                    >
                      {isStageFault ? (
                        '!'
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
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-neutral-700 sm:block" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Global Monochrome Hardware Exception Banner */}
        {snapshot.fault && (
          <div
            role="alert"
            className="overflow-hidden rounded-lg border border-white bg-black shadow-[0_0_32px_rgba(255,255,255,0.28)]"
          >
            <div className="hazard-stripe-bw h-2 w-full" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white bg-white text-black">
                  <AlertOctagon className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-mono-tech">
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-black">
                      HARDWARE EXCEPTION
                    </span>
                    <span className="text-sm font-bold tracking-wide text-white">
                      {snapshot.fault.message}
                    </span>
                  </div>
                  <p className="mt-1 font-mono-tech text-xs text-neutral-300">
                    Vector IVT[{snapshot.fault.vector}] trapped during{' '}
                    <span className="font-semibold text-white">
                      {snapshot.fault.expression}
                    </span>{' '}
                    (PID {snapshot.fault.pid}). Restoring Divider halted before Stage 5
                    Write-Back; PCB marked FAULT to protect Physical RAM.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-white bg-white px-3 py-1.5 font-mono-tech text-xs font-semibold text-black transition hover:bg-neutral-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>CLEAR FAULT &amp; RESET</span>
              </button>
            </div>
          </div>
        )}

        {/* Main 3-Column Hardware Architecture Workbench */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Column 1: User Shell & Hardware Narrator */}
          <div className="lg:col-span-3">
            <UserShellPanel
              expression={expression}
              onExpressionChange={handleExpressionChange}
              validationError={validationError}
              onRunExpression={handleExecute}
              onSelectPreset={handleSelectPreset}
              output={snapshot.output}
              fault={snapshot.fault}
              narratorLog={snapshot.narratorLog}
              stage={snapshot.stage}
            />
          </div>

          {/* Column 2: 8-Bit CPU Core, Registers, LEDs & Gate-Level ALU */}
          <div className="lg:col-span-5">
            <CpuCorePanel
              registers={snapshot.registers}
              flags={snapshot.flags}
              changedRegisters={snapshot.changedRegisters}
              changedFlags={snapshot.changedFlags}
              aluTrace={snapshot.aluTrace}
              stage={snapshot.stage}
            />
          </div>

          {/* Column 3: 256-Byte Physical RAM Hex Grid */}
          <div className="lg:col-span-4">
            <RamGridPanel
              ram={snapshot.ram}
              registers={snapshot.registers}
              ramActivity={snapshot.ramActivity}
            />
          </div>
        </div>
      </main>

      {/* Subtle Technical Footer */}
      <footer className="mt-auto border-t border-white/8 bg-[#050505] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2 font-mono-tech text-[10px] tracking-wider text-neutral-500">
          <span>
            PURE BITWISE 8-BIT ALU (XOR / AND / OR / NOT / SHIFTS) &bull; ZERO NATIVE + - * / OPERATORS
          </span>
          <span>
            DATA 0x00–0x02 &bull; CODE 0x10–0xEF &bull; STACK 0xFF
          </span>
        </div>
      </footer>
    </div>
  );
}
