import React from 'react';
import {
  Terminal,
  Sparkles,
  CornerDownLeft,
  AlertOctagon,
  BookOpen,
  Check,
  AlertTriangle,
} from 'lucide-react';

const PRESETS = [
  {
    index: '01',
    label: '14 + 9',
    tag: 'Ripple-Add',
    expression: '14 + 9',
  },
  {
    index: '02',
    label: '10 - 15',
    tag: 'Negative',
    expression: '10 - 15',
  },
  {
    index: '03',
    label: '200 + 100',
    tag: 'Overflow',
    expression: '200 + 100',
  },
  {
    index: '04',
    label: '6 * 5',
    tag: 'Shift-Add',
    expression: '6 * 5',
  },
  {
    index: '05',
    label: '10 / 0',
    tag: 'Hardware Fault',
    expression: '10 / 0',
    isFaultDemo: true,
  },
];

export default function UserShellPanel({
  expression,
  onExpressionChange,
  validationError,
  onRunExpression,
  onSelectPreset,
  output,
  fault,
  narratorLog,
  stage,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onRunExpression();
  };

  return (
    <section className="hw-panel hw-reticle flex flex-col rounded-lg">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-white" />
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.16em] text-white uppercase">
            01 // User Shell &amp; Narrator
          </h2>
        </div>
        <span className="font-mono-tech text-[10px] tracking-widest text-neutral-500">
          TTY0 :: RING 3
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Interactive Command Shell Input */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <label
            htmlFor="expression-input"
            className="flex items-center justify-between font-mono-tech text-[10px] tracking-widest text-neutral-400 uppercase"
          >
            <span>Arithmetic Instruction Input</span>
            <span className="text-neutral-500">0–255 &lt;+ - * /&gt; 0–255</span>
          </label>
          <div className="flex items-center gap-2 rounded-md border border-white/20 bg-black px-3 py-2 transition focus-within:border-white focus-within:shadow-[0_0_20px_rgba(255,255,255,0.18)]">
            <span className="select-none font-mono-tech text-xs text-neutral-500">$</span>
            <input
              id="expression-input"
              type="text"
              value={expression}
              onChange={(e) => onExpressionChange(e.target.value)}
              placeholder="14 + 9"
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-transparent font-mono-tech text-sm font-medium text-white placeholder-neutral-600 focus:outline-none"
            />
            <button
              type="submit"
              title="Execute Expression"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-white/25 bg-white/10 px-2 py-1 font-mono-tech text-[10px] font-semibold tracking-wider text-white transition hover:bg-white hover:text-black"
            >
              <span>RUN</span>
              <CornerDownLeft className="h-3 w-3" />
            </button>
          </div>
          {validationError && (
            <p className="flex items-center gap-1.5 font-mono-tech text-[11px] text-neutral-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-white" />
              <span>{validationError}</span>
            </p>
          )}
        </form>

        {/* One-Click Preset Demo Buttons with Index Tags */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-mono-tech text-[10px] tracking-widest text-neutral-400 uppercase">
            <Sparkles className="h-3 w-3 text-neutral-300" />
            <span>One-Click COA Preset Demos</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
            {PRESETS.map((preset) => {
              const isSelected = expression.trim() === preset.expression;
              return (
                <button
                  key={preset.expression}
                  type="button"
                  onClick={() => onSelectPreset(preset.expression)}
                  className={`group flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.28)]'
                      : 'border-white/12 bg-[#0d0d0d] text-neutral-200 hover:-translate-y-[1px] hover:border-white/50 hover:bg-[#151515] hover:shadow-[0_6px_16px_rgba(0,0,0,0.65)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono-tech text-[10px] font-semibold ${
                        isSelected
                          ? 'text-black/60'
                          : 'text-neutral-600 group-hover:text-neutral-400'
                      }`}
                    >
                      {preset.index}
                    </span>
                    <span className="font-mono-tech text-xs font-semibold tracking-wide">
                      {preset.label}
                    </span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono-tech text-[10px] tracking-wider uppercase ${
                      isSelected
                        ? 'bg-black/15 text-black'
                        : preset.isFaultDemo
                        ? 'border border-white/30 bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 group-hover:text-neutral-200'
                    }`}
                  >
                    {preset.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fault Exception Card (Stage 4 Trap) */}
        {fault && (
          <div className="overflow-hidden rounded-md border border-white bg-black shadow-[0_0_24px_rgba(255,255,255,0.28)]">
            <div className="hazard-stripe-bw h-2 w-full" />
            <div className="p-3">
              <div className="flex items-center gap-2 font-mono-tech text-xs font-bold tracking-wider text-white">
                <AlertOctagon className="h-4 w-4 shrink-0" />
                <span>KERNEL EXCEPTION TRAP ({fault.vector})</span>
              </div>
              <p className="mt-1.5 font-mono-tech text-xs text-neutral-200">
                {fault.message}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-white/15 pt-2 font-mono-tech text-[10px] text-neutral-400">
                <span>PID {fault.pid} ABORTED</span>
                <span className="rounded bg-white px-1.5 py-0.5 font-bold text-black">
                  STATE: FAULT
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stage 5 Final Output Readout with Inverted White-on-Black Hero Strip */}
        {output && (
          <div className="overflow-hidden rounded-md border border-white/50 bg-[#101010] shadow-[0_0_26px_rgba(255,255,255,0.16)]">
            <div className="flex items-center justify-between border-b border-white/12 px-3 py-2">
              <div className="flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold tracking-widest text-white uppercase">
                <Check className="h-3.5 w-3.5" />
                <span>Stage 5 Output // RAM[0x02]</span>
              </div>
              <span className="font-mono-tech text-[11px] font-semibold text-neutral-300">
                {output.expression}
              </span>
            </div>

            {/* High-Contrast Inverted Hero Result Strip */}
            <div className="flex items-center justify-between bg-white px-3 py-2 text-black">
              <div>
                <div className="font-mono-tech text-[9px] font-bold tracking-widest text-black/60 uppercase">
                  COMMITTED 8-BIT OUTPUT
                </div>
                <div className="font-mono-tech text-xl font-bold tracking-tight">
                  {output.hex}
                </div>
              </div>
              <div className="text-right font-mono-tech">
                <div className="text-sm font-bold">
                  DEC {output.unsigned}
                </div>
                <div className="text-[10px] font-semibold text-black/70">
                  2&apos;s Comp: {output.signed > 0 ? `+${output.signed}` : output.signed}
                </div>
              </div>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-white/12 bg-black p-2">
                  <div className="font-mono-tech text-[9px] tracking-widest text-neutral-500 uppercase">
                    8-Bit Binary
                  </div>
                  <div className="mt-0.5 font-mono-tech text-sm font-bold tracking-wider text-white">
                    {output.binary}
                  </div>
                </div>
                <div className="rounded border border-white/12 bg-black p-2">
                  <div className="font-mono-tech text-[9px] tracking-widest text-neutral-500 uppercase">
                    Hexadecimal
                  </div>
                  <div className="mt-0.5 font-mono-tech text-sm font-bold text-white">
                    {output.hex}
                  </div>
                </div>
                <div className="rounded border border-white/12 bg-black p-2">
                  <div className="font-mono-tech text-[9px] tracking-widest text-neutral-500 uppercase">
                    Unsigned Decimal
                  </div>
                  <div className="mt-0.5 font-mono-tech text-sm font-bold text-white">
                    {output.unsigned}
                  </div>
                </div>
                <div className="rounded border border-white/12 bg-black p-2">
                  <div className="font-mono-tech text-[9px] tracking-widest text-neutral-500 uppercase">
                    Signed 2&apos;s Comp
                  </div>
                  <div className="mt-0.5 font-mono-tech text-sm font-bold text-white">
                    {output.signed > 0 ? `+${output.signed}` : output.signed}
                  </div>
                </div>
              </div>

              {output.remainder !== null && (
                <div className="mt-2 flex items-center justify-between rounded border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono-tech text-[11px]">
                  <span className="text-neutral-400">DIV Remainder (BX)</span>
                  <span className="font-bold text-white">{output.remainder}</span>
                </div>
              )}

              {output.unsignedOverflow && (
                <div className="mt-2 rounded border border-white/30 bg-white/10 px-2.5 py-1.5 font-mono-tech text-[10px] text-neutral-200">
                  8-bit Unsigned Overflow (CF=1): Carry-out from Bit 7 wrapped modulo 256.
                </div>
              )}

              {output.fullProduct16 !== null && output.fullProduct16 > 255 && (
                <div className="mt-2 rounded border border-white/30 bg-white/10 px-2.5 py-1.5 font-mono-tech text-[10px] text-neutral-200">
                  16-bit Full Product = {output.fullProduct16} (truncated to 8-bit AX ={' '}
                  {output.unsigned}).
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plain-English Hardware Narrator Log with Monochrome Vertical Timeline Rail */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-white/12 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0c0c0c] px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold tracking-widest text-neutral-300 uppercase">
              <BookOpen className="h-3.5 w-3.5 text-white" />
              <span>Hardware Narrator Log</span>
            </div>
            <span className="font-mono-tech text-[10px] text-neutral-500">
              STAGE {stage}/5
            </span>
          </div>

          <div className="max-h-[340px] flex-1 overflow-y-auto p-3">
            <div className="relative space-y-2.5 border-l border-white/15 pl-3">
              {narratorLog.map((entry, idx) => {
                const isLatest = idx === 0;
                return (
                  <article
                    key={entry.id}
                    className={`relative rounded-md border p-2.5 transition-all ${
                      entry.isFault
                        ? 'border-white bg-white/10 text-white'
                        : isLatest
                        ? 'border-white/40 bg-[#121212] text-white'
                        : 'border-white/8 bg-[#080808] text-neutral-400'
                    }`}
                  >
                    {/* Timeline Node Dot */}
                    <span
                      className={`absolute top-3 -left-[17px] h-2 w-2 rounded-full border ${
                        entry.isFault
                          ? 'border-white bg-white shadow-[0_0_8px_#fff]'
                          : isLatest
                          ? 'border-white bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                          : 'border-white/30 bg-[#090909]'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono-tech text-[9px] font-bold tracking-widest uppercase ${
                          entry.isFault
                            ? 'bg-white text-black'
                            : isLatest
                            ? 'bg-white/15 text-white'
                            : 'bg-white/5 text-neutral-500'
                        }`}
                      >
                        {entry.tag}
                      </span>
                      <span className="font-mono-tech text-[10px] text-neutral-500">
                        CLK #{String(entry.cycle).padStart(3, '0')}
                      </span>
                    </div>
                    <h3
                      className={`mt-1.5 text-xs font-semibold ${
                        isLatest || entry.isFault ? 'text-white' : 'text-neutral-300'
                      }`}
                    >
                      {entry.title}
                    </h3>
                    <p
                      className={`mt-1 text-[11px] leading-relaxed ${
                        isLatest || entry.isFault ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                    >
                      {entry.message}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
