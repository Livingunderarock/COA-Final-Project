import React from 'react';
import {
  Cpu,
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Shield,
  ShieldAlert,
  Gauge,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export default function TopHeader({
  pcb,
  clockCycle,
  isAutoPlaying,
  clockSpeedMs,
  onClockSpeedChange,
  onExecute,
  onStep,
  onToggleAutoPlay,
  onReset,
  canExecute,
}) {
  const isKernelMode = pcb.privilegeRing === 0;
  const isFault = pcb.state === 'FAULT';
  const isRunning = pcb.state === 'RUNNING';
  const isTerminated = pcb.state === 'TERMINATED';

  // Display speed cleanly in Hz (approximate) and ms
  const hz = (1000 / clockSpeedMs).toFixed(1);

  return (
    <header className="sticky top-0 z-30 border-b border-white/12 bg-[#050505]/92 backdrop-blur-xl">
      {/* Top 2px Hardware Privilege Energy Beam */}
      <div
        className={`h-[2px] w-full transition-all duration-500 ${
          isKernelMode ? 'kernel-beam' : 'bg-white/10'
        }`}
      />

      <div className="mx-auto max-w-[1680px] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Architecture Title */}
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-all duration-300 ${
                isKernelMode
                  ? 'border-white bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.45)]'
                  : 'border-white/30 bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.2)]'
              }`}
            >
              <Cpu className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-semibold tracking-tight text-white sm:text-lg">
                  Mini-OS Kernel &amp; 8-Bit CPU Architecture Visualizer
                </h1>
              </div>
              <p className="font-mono-tech text-[10px] tracking-[0.18em] text-neutral-400 uppercase">
                COA Gate-Level ALU // 256B Physical RAM // Ring 3 &harr; Ring 0 Pipeline
              </p>
            </div>
          </div>

          {/* Live Telemetry Badges: 2-Pole Privilege Ring Switcher & PCB Status */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tactile 2-Pole Privilege Ring Switcher Housing */}
            <div
              role="status"
              aria-label={isKernelMode ? 'RING 0: KERNEL MODE' : 'RING 3: USER MODE'}
              title={
                isKernelMode
                  ? 'CPU executing privileged kernel instructions in Ring 0'
                  : 'CPU executing unprivileged shell code in Ring 3'
              }
              className="flex items-center rounded-md border border-white/20 bg-[#070707] p-0.5 font-mono-tech text-[11px] font-semibold tracking-wider shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]"
            >
              <div
                className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 transition-all duration-300 ${
                  !isKernelMode
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                    : 'text-neutral-500'
                }`}
              >
                <Shield className="h-3 w-3 stroke-[2.2]" />
                <span>RING 3: USER</span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 transition-all duration-300 ${
                  isKernelMode
                    ? 'bg-white text-black shadow-[0_0_22px_rgba(255,255,255,0.5)]'
                    : 'text-neutral-500'
                }`}
              >
                <ShieldAlert className="h-3 w-3 stroke-[2.3]" />
                {isKernelMode && (
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-black" />
                )}
                <span>RING 0: KERNEL</span>
              </div>
            </div>

            {/* Live PCB Status Pill */}
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono-tech text-xs transition-all duration-300 ${
                isFault
                  ? 'border-white bg-black text-white shadow-[0_0_18px_rgba(255,255,255,0.34)]'
                  : isRunning
                  ? 'border-white/55 bg-white/10 text-white'
                  : isTerminated
                  ? 'border-white/30 bg-[#121212] text-neutral-200'
                  : 'border-white/15 bg-[#0b0b0b] text-neutral-400'
              }`}
            >
              {isFault ? (
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
              ) : isTerminated ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              ) : (
                <Activity
                  className={`h-3.5 w-3.5 ${
                    isRunning ? 'animate-pulse text-white' : 'text-neutral-500'
                  }`}
                />
              )}
              <span className="text-neutral-400">PCB</span>
              <span className="font-semibold text-white">
                {pcb.pid ? `PID ${pcb.pid}` : 'PID ----'}
              </span>
              <span className="text-neutral-600">|</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest ${
                  isFault
                    ? 'bg-white text-black'
                    : isRunning
                    ? 'bg-white/20 text-white'
                    : isTerminated
                    ? 'border border-white/30 text-white'
                    : 'bg-white/5 text-neutral-400'
                }`}
              >
                {pcb.state}
              </span>
            </div>

            {/* Clock Cycle Counter with Auto-Play Live Pulse Dot */}
            <div className="hidden items-center gap-2 rounded-md border border-white/15 bg-[#0a0a0a] px-2.5 py-1.5 font-mono-tech text-xs text-neutral-400 xl:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  isAutoPlaying
                    ? 'animate-ping bg-white shadow-[0_0_8px_#fff]'
                    : 'bg-white/25'
                }`}
              />
              <span>CLK</span>
              <span className="font-semibold text-white">
                #{String(clockCycle).padStart(3, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Execution Control Deck */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Execute */}
            <button
              type="button"
              onClick={onExecute}
              disabled={!canExecute}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white bg-white px-3.5 py-1.5 font-mono-tech text-xs font-semibold tracking-wide text-black shadow-[0_0_16px_rgba(255,255,255,0.18)] transition hover:bg-neutral-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5 fill-black" />
              <span>EXECUTE</span>
            </button>

            {/* Step Clock Cycle */}
            <button
              type="button"
              onClick={onStep}
              disabled={!canExecute}
              title="Step one pipeline stage (Shortcut: Space)"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/25 bg-[#121212] px-3 py-1.5 font-mono-tech text-xs font-medium tracking-wide text-white transition hover:border-white/60 hover:bg-[#1a1a1a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <StepForward className="h-3.5 w-3.5" />
              <span>STEP CLOCK CYCLE</span>
              <kbd className="hidden rounded border border-white/20 bg-black px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-neutral-400 sm:inline-block">
                SPC
              </kbd>
            </button>

            {/* Auto-Play Toggle */}
            <button
              type="button"
              onClick={onToggleAutoPlay}
              disabled={!canExecute}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3.5 py-1.5 font-mono-tech text-xs font-medium tracking-wide transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                isAutoPlaying
                  ? 'border-white bg-white/15 text-white shadow-[0_0_16px_rgba(255,255,255,0.25)]'
                  : 'border-white/20 bg-[#0d0d0d] text-neutral-300 hover:border-white/45 hover:text-white'
              }`}
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>PAUSE AUTO</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>AUTO-PLAY</span>
                </>
              )}
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={onReset}
              title="Reset CPU, RAM, and Kernel state (Shortcut: R)"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-transparent px-3 py-1.5 font-mono-tech text-xs font-medium tracking-wide text-neutral-400 transition hover:border-white/40 hover:bg-white/5 hover:text-white active:scale-[0.98]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>RESET</span>
              <kbd className="hidden rounded border border-white/15 bg-black px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-neutral-500 sm:inline-block">
                R
              </kbd>
            </button>
          </div>

          {/* Clock Speed Slider */}
          <div className="flex items-center gap-3 rounded-md border border-white/12 bg-[#0a0a0a] px-3 py-1.5">
            <div className="flex items-center gap-1.5 font-mono-tech text-[11px] text-neutral-400">
              <Gauge className="h-3.5 w-3.5 text-neutral-300" />
              <span>CLOCK</span>
            </div>
            <input
              type="range"
              min="250"
              max="2200"
              step="50"
              value={2450 - clockSpeedMs}
              onChange={(e) => onClockSpeedChange(2450 - Number(e.target.value))}
              aria-label="Clock speed slider"
              className="mono-slider w-24 sm:w-32"
            />
            <span className="w-20 text-right font-mono-tech text-[11px] text-white">
              {clockSpeedMs}ms <span className="text-neutral-500">({hz}Hz)</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
