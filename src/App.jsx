import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import {
  MiniOSKernel,
  parseExpression,
} from './hardware/cpuAndRam.js';
import TopHeader from './components/TopHeader.jsx';
import BusArchitectureRibbon from './components/BusArchitectureRibbon.jsx';
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

  // Global hardware debugger keyboard shortcuts (Space = Step, R = Reset)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleStep();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStep, handleReset]);

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
        {/* Live SVG Silicon Bus Topology & 5-Stage Clocked Execution Pipeline */}
        <BusArchitectureRibbon
          stage={snapshot.stage}
          pcb={snapshot.pcb}
          registers={snapshot.registers}
          activeInstruction={snapshot.activeInstruction}
          fault={snapshot.fault}
          ramActivity={snapshot.ramActivity}
        />

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
            DATA 0x00–0x02 &bull; CODE 0x10–0xEF &bull; STACK 0xFF &bull; SHORTCUTS: [SPACE] STEP / [R] RESET
          </span>
        </div>
      </footer>
    </div>
  );
}
