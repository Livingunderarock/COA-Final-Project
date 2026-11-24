import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Binary,
  GitBranch,
  AlertOctagon,
  Info,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import { toBinary8, toHex8, toSigned8 } from '../hardware/alu.js';
import { COA_TOOLTIPS, MNEMONICS } from '../hardware/cpuAndRam.js';

const BIT_WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];
const BIT_POSITIONS_DESC = [7, 6, 5, 4, 3, 2, 1, 0];

function CoaTooltip({ code, children, align = 'center' }) {
  const info = COA_TOOLTIPS[code];
  if (!info) return children;

  const alignClasses =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-50 mb-2 w-60 rounded-md border border-white/30 bg-black/95 p-2.5 opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-150 group-hover/tip:pointer-events-auto group-hover/tip:opacity-100 ${alignClasses}`}
      >
        <div className="flex items-center justify-between border-b border-white/15 pb-1">
          <span className="font-mono-tech text-[11px] font-bold tracking-wider text-white">
            {code}
          </span>
          <span className="font-mono-tech text-[9px] tracking-widest text-neutral-400 uppercase">
            {info.name}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
          {info.detail}
        </p>
      </div>
    </div>
  );
}

function LogicAnalyzerWaveform({ value, regName }) {
  const bits = BIT_POSITIONS_DESC.map((pos) => (value >>> pos) & 1);
  const segWidth = 40;
  const highY = 4;
  const lowY = 18;

  // Build orthogonal digital square-wave path across 8 bit intervals (320px wide)
  let d = '';
  bits.forEach((bit, idx) => {
    const xStart = idx * segWidth;
    const xEnd = xStart + segWidth;
    const y = bit === 1 ? highY : lowY;
    if (idx === 0) {
      d += `M ${xStart} ${y} L ${xEnd} ${y}`;
    } else {
      const prevY = bits[idx - 1] === 1 ? highY : lowY;
      if (prevY !== y) {
        d += ` L ${xStart} ${y}`;
      }
      d += ` L ${xEnd} ${y}`;
    }
  });

  const filterId = `wave-glow-${regName}`;

  return (
    <div className="mt-2.5 rounded border border-white/10 bg-[#050505] px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between font-mono-tech text-[8px] tracking-widest text-neutral-500 uppercase">
        <span>LOGIC ANALYZER // {regName}[7..0]</span>
        <span>HI=5V / LO=0V</span>
      </div>
      <svg
        viewBox="0 0 320 22"
        className="h-5 w-full overflow-visible"
        role="img"
        aria-label={`${regName} 8-bit square waveform`}
      >
        <defs>
          <filter id={filterId} x="-15%" y="-40%" width="130%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Reference rail baselines */}
        <line x1="0" y1={highY} x2="320" y2={highY} stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
        <line x1="0" y1={lowY} x2="320" y2={lowY} stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />

        {/* Bit boundary grid ticks & center nibble split */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line
            key={i}
            x1={i * segWidth}
            y1="1"
            x2={i * segWidth}
            y2="21"
            stroke={i === 4 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'}
            strokeWidth={i === 4 ? '0.9' : '0.6'}
            strokeDasharray={i === 4 ? undefined : '2 2'}
          />
        ))}

        {/* Soft luminous under-glow */}
        <path
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="3.2"
          strokeLinejoin="miter"
          filter={`url(#${filterId})`}
        />

        {/* Crisp digital square wave */}
        <path
          d={d}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinejoin="miter"
        />

        {/* Bit-center sample points */}
        {bits.map((bit, idx) => (
          <circle
            key={idx}
            cx={idx * segWidth + segWidth / 2}
            cy={bit === 1 ? highY : lowY}
            r={bit === 1 ? '1.9' : '1.4'}
            fill={bit === 1 ? '#FFFFFF' : '#4A4A4A'}
          />
        ))}
      </svg>
    </div>
  );
}

function LedBitCell({ bitPos, bitVal, weight }) {
  const isHigh = bitVal === 1;
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 font-mono-tech text-[9px] text-neutral-500">
        b{bitPos}
      </span>
      <div
        key={`${bitPos}-${bitVal}`}
        className={`relative flex h-11 w-full flex-col items-center justify-center rounded border font-mono-tech text-sm font-bold transition-all duration-300 ${
          isHigh ? 'led-on animate-bit-ignite' : 'led-off'
        }`}
      >
        {/* Sculpted 2px top interior filament bar */}
        <span
          className={`absolute top-1.5 h-[2px] w-4 rounded-full transition-all ${
            isHigh
              ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.95)] ring-1 ring-black/20'
              : 'bg-white/10'
          }`}
        />
        <span className="mt-1">{bitVal}</span>
      </div>
      <span className="mt-1 font-mono-tech text-[8px] text-neutral-600">
        {weight}
      </span>
    </div>
  );
}

function LedBitArray({ regName, value, isChanged, roleLabel }) {
  const signedVal = toSigned8(value);
  const highNibble = [7, 6, 5, 4];
  const lowNibble = [3, 2, 1, 0];

  return (
    <div
      className={`rounded-md border p-3 transition-all duration-300 ${
        isChanged
          ? 'border-white bg-[#131313] shadow-[0_0_24px_rgba(255,255,255,0.22)]'
          : 'border-white/12 bg-[#0b0b0b]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CoaTooltip code={regName} align="left">
            <span className="inline-flex cursor-help items-center gap-1 font-mono-tech text-xs font-bold tracking-wider text-white">
              <span>{regName}</span>
              <Info className="h-3 w-3 text-neutral-500" />
            </span>
          </CoaTooltip>
          <span className="rounded border border-white/12 bg-black px-1.5 py-0.5 font-mono-tech text-[9px] tracking-widest text-neutral-400 uppercase">
            {roleLabel}
          </span>
          {isChanged && (
            <span className="rounded bg-white px-1.5 py-0.5 font-mono-tech text-[9px] font-bold tracking-widest text-black">
              UPDATED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 font-mono-tech text-xs">
          <span className="font-semibold text-white">0x{toHex8(value)}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-neutral-300">
            U:<span className="font-semibold text-white">{value}</span>
          </span>
          <span className="text-neutral-600">|</span>
          <span className="text-neutral-400">
            S:
            <span className="font-semibold text-neutral-200">
              {signedVal > 0 ? `+${signedVal}` : signedVal}
            </span>
          </span>
        </div>
      </div>

      {/* 8-Bit LED Bit-Cells with Clean Nibble Divider */}
      <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))_8px_repeat(4,minmax(0,1fr))] items-center gap-1">
        {highNibble.map((bitPos, i) => (
          <LedBitCell
            key={bitPos}
            bitPos={bitPos}
            bitVal={(value >>> bitPos) & 1}
            weight={BIT_WEIGHTS[i]}
          />
        ))}
        <div className="flex h-11 items-center justify-center">
          <div className="h-7 w-[1px] bg-white/18" />
        </div>
        {lowNibble.map((bitPos, i) => (
          <LedBitCell
            key={bitPos}
            bitPos={bitPos}
            bitVal={(value >>> bitPos) & 1}
            weight={BIT_WEIGHTS[i + 4]}
          />
        ))}
      </div>

      {/* Live Logic-Analyzer Square Waveform SVG */}
      <LogicAnalyzerWaveform value={value} regName={regName} />
    </div>
  );
}

function FullAdderSchematicSvg({ step }) {
  if (!step) return null;

  const sA = step.bitA === 1;
  const sB = step.bitB === 1;
  const sCin = step.carryIn === 1;
  const sXor1 = step.xorAB === 1;
  const sAnd1 = (step.bitA & step.bitB) === 1;
  const sAnd2 = (step.carryIn & step.xorAB) === 1;
  const sSum = step.sumBit === 1;
  const sCout = step.carryOut === 1;

  const wireProps = (active) =>
    active
      ? {
          stroke: '#FFFFFF',
          strokeWidth: '2.2',
          filter: 'url(#gate-glow)',
        }
      : {
          stroke: '#2E2E2E',
          strokeWidth: '1.25',
        };

  const gates = [
    { x: 135, y: 22, w: 63, h: 38, label: 'XOR₁', sub: 'A ^ B', active: sXor1 },
    { x: 274, y: 14, w: 64, h: 38, label: 'XOR₂', sub: 'SUM', active: sSum },
    { x: 274, y: 64, w: 64, h: 36, label: 'AND₂', sub: 'Cin & X', active: sAnd2 },
    { x: 274, y: 114, w: 64, h: 36, label: 'AND₁', sub: 'A & B', active: sAnd1 },
    { x: 406, y: 88, w: 64, h: 38, label: 'OR₁', sub: 'Cout', active: sCout },
  ];

  return (
    <div className="rounded-md border border-white/15 bg-[#050505] p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-[9px] tracking-widest text-neutral-400 uppercase">
        <span>LIVE SILICON SCHEMATIC // FULL-ADDER BIT {step.bit}</span>
        <span className="text-neutral-500">WHITE TRACE = 1 // GRAPHITE = 0</span>
      </div>
      <svg
        viewBox="0 0 560 156"
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Full Adder gate schematic for bit ${step.bit}`}
      >
        <defs>
          <filter id="gate-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wire: A[i] -> XOR₁ & tap down to AND₁ */}
        <path
          d="M 58 28 L 112 28 L 112 33 L 135 33"
          fill="none"
          {...wireProps(sA)}
        />
        <path
          d="M 82 28 L 82 124 L 274 124"
          fill="none"
          {...wireProps(sA)}
        />
        <circle cx="82" cy="28" r="2.6" fill={sA ? '#FFFFFF' : '#3A3A3A'} />

        {/* Wire: B[i] -> XOR₁ & tap down to AND₁ */}
        <path
          d="M 58 62 L 112 62 L 112 49 L 135 49"
          fill="none"
          {...wireProps(sB)}
        />
        <path
          d="M 98 62 L 98 140 L 274 140"
          fill="none"
          {...wireProps(sB)}
        />
        <circle cx="98" cy="62" r="2.6" fill={sB ? '#FFFFFF' : '#3A3A3A'} />

        {/* Wire: Cin -> XOR₂ & tap to AND₂ */}
        <path
          d="M 58 100 L 222 100 L 222 42 L 274 42"
          fill="none"
          {...wireProps(sCin)}
        />
        <path
          d="M 222 90 L 274 90"
          fill="none"
          {...wireProps(sCin)}
        />
        <circle cx="222" cy="90" r="2.6" fill={sCin ? '#FFFFFF' : '#3A3A3A'} />

        {/* Wire: X (XOR₁ out) -> XOR₂ & tap to AND₂ */}
        <path
          d="M 198 41 L 236 41 L 236 24 L 274 24"
          fill="none"
          {...wireProps(sXor1)}
        />
        <path
          d="M 236 41 L 236 74 L 274 74"
          fill="none"
          {...wireProps(sXor1)}
        />
        <circle cx="236" cy="41" r="2.6" fill={sXor1 ? '#FFFFFF' : '#3A3A3A'} />

        {/* Wire: AND₂ out -> OR₁ */}
        <path
          d="M 338 82 L 372 82 L 372 98 L 406 98"
          fill="none"
          {...wireProps(sAnd2)}
        />

        {/* Wire: AND₁ out -> OR₁ */}
        <path
          d="M 338 132 L 372 132 L 372 116 L 406 116"
          fill="none"
          {...wireProps(sAnd1)}
        />

        {/* Wire: XOR₂ out -> SUM output */}
        <line x1="338" y1="33" x2="496" y2="33" {...wireProps(sSum)} />

        {/* Wire: OR₁ out -> Cout output */}
        <line x1="470" y1="107" x2="496" y2="107" {...wireProps(sCout)} />

        {/* Input Nodes */}
        {[
          { y: 16, label: `A${step.bit}`, val: step.bitA, active: sA },
          { y: 50, label: `B${step.bit}`, val: step.bitB, active: sB },
          { y: 88, label: 'Cin', val: step.carryIn, active: sCin },
        ].map((inp) => (
          <g key={inp.label}>
            <rect
              x="6"
              y={inp.y}
              width="52"
              height="24"
              rx="3"
              fill={inp.active ? '#FFFFFF' : '#0B0B0B'}
              stroke={inp.active ? '#FFFFFF' : 'rgba(255,255,255,0.2)'}
              strokeWidth="1"
            />
            <text
              x="21"
              y={inp.y + 15}
              textAnchor="middle"
              className="font-mono-tech"
              fontSize="9"
              fontWeight="700"
              fill={inp.active ? '#000000' : '#999999'}
            >
              {inp.label}
            </text>
            <text
              x="46"
              y={inp.y + 15}
              textAnchor="middle"
              className="font-mono-tech"
              fontSize="10"
              fontWeight="700"
              fill={inp.active ? '#000000' : '#666666'}
            >
              {inp.val}
            </text>
          </g>
        ))}

        {/* Logic Gate Blocks */}
        {gates.map((g) => (
          <g
            key={g.label}
            filter={g.active ? 'url(#gate-glow)' : undefined}
          >
            <rect
              x={g.x}
              y={g.y}
              width={g.w}
              height={g.h}
              rx="4"
              fill={g.active ? '#161616' : '#090909'}
              stroke={g.active ? '#FFFFFF' : 'rgba(255,255,255,0.18)'}
              strokeWidth={g.active ? '1.5' : '1'}
            />
            <text
              x={g.x + g.w / 2}
              y={g.y + 15}
              textAnchor="middle"
              className="font-mono-tech"
              fontSize="9.5"
              fontWeight="700"
              fill={g.active ? '#FFFFFF' : '#888888'}
            >
              {g.label}
            </text>
            <text
              x={g.x + g.w / 2}
              y={g.y + 27}
              textAnchor="middle"
              className="font-mono-tech"
              fontSize="7.2"
              fill={g.active ? '#D4D4D4' : '#555555'}
            >
              {g.sub} · {g.active ? '1' : '0'}
            </text>
          </g>
        ))}

        {/* Output Nodes */}
        {[
          { y: 20, label: `S${step.bit}`, val: step.sumBit, active: sSum },
          { y: 94, label: 'Cout', val: step.carryOut, active: sCout },
        ].map((out) => (
          <g
            key={out.label}
            filter={out.active ? 'url(#gate-glow)' : undefined}
          >
            <rect
              x="496"
              y={out.y}
              width="58"
              height="26"
              rx="3"
              fill={out.active ? '#FFFFFF' : '#0B0B0B'}
              stroke={out.active ? '#FFFFFF' : 'rgba(255,255,255,0.22)'}
              strokeWidth="1.2"
            />
            <text
              x="514"
              y={out.y + 16.5}
              textAnchor="middle"
              className="font-mono-tech"
              fontSize="9"
              fontWeight="700"
              fill={out.active ? '#000000' : '#999999'}
            >
              {out.label}
            </text>
            <text
              x="541"
              y={out.y + 16.5}
              textAnchor="middle"
              className="font-mono-tech"
              fontSize="10.5"
              fontWeight="700"
              fill={out.active ? '#000000' : '#666666'}
            >
              {out.val}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CarryChainViewer({ gateSteps, operandA, operandB, result, carryOut, labelB }) {
  const [selectedBit, setSelectedBit] = useState(0);

  useEffect(() => {
    setSelectedBit(0);
  }, [operandA, operandB, result]);

  // Display MSB (Bit 7) on left -> LSB (Bit 0) on right
  const stepsDesc = [...gateSteps].reverse();
  const activeStep = gateSteps[selectedBit] || gateSteps[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tech text-[10px] text-neutral-400">
        <span className="flex items-center gap-1.5 tracking-wider uppercase">
          <ArrowLeft className="h-3 w-3 text-white" />
          <span>Carry Propagation Chain (Bit 0 &rarr; Bit 7)</span>
        </span>
        <span>
          Cout7 ={' '}
          <strong className={carryOut ? 'text-white' : 'text-neutral-500'}>
            {carryOut}
          </strong>
        </span>
      </div>

      {/* Bit-by-Bit Matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-[440px] rounded-md border border-white/12 bg-black p-2.5">
          {/* Header Row: Bit Indices */}
          <div className="grid grid-cols-[64px_repeat(8,minmax(0,1fr))] items-center gap-1 text-center font-mono-tech text-[9px] text-neutral-500">
            <div className="text-left uppercase">BIT</div>
            {stepsDesc.map((s) => (
              <button
                key={`hdr-${s.bit}`}
                type="button"
                onClick={() => setSelectedBit(s.bit)}
                className={`cursor-pointer rounded py-0.5 transition ${
                  selectedBit === s.bit
                    ? 'bg-white font-bold text-black shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                    : 'hover:bg-white/10 hover:text-white'
                }`}
              >
                b{s.bit}
              </button>
            ))}
          </div>

          {/* Carry Out Row (animated ripple from Bit 0 -> Bit 7) */}
          <div className="mt-1.5 grid grid-cols-[64px_repeat(8,minmax(0,1fr))] items-center gap-1 text-center font-mono-tech text-[11px]">
            <div className="text-left text-[9px] text-neutral-400 uppercase">C_out</div>
            {stepsDesc.map((s) => (
              <div
                key={`cout-${s.bit}-${operandA}-${operandB}`}
                style={{ animationDelay: `${s.bit * 55}ms` }}
                onClick={() => setSelectedBit(s.bit)}
                className={`animate-carry-step cursor-pointer rounded border py-1 text-[10px] font-bold transition ${
                  s.carryOut === 1
                    ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                    : 'border-white/8 bg-[#090909] text-neutral-600'
                } ${selectedBit === s.bit ? 'ring-1 ring-white' : ''}`}
              >
                {s.carryOut}
              </div>
            ))}
          </div>

          {/* Operand A Row */}
          <div className="mt-1.5 grid grid-cols-[64px_repeat(8,minmax(0,1fr))] items-center gap-1 text-center font-mono-tech text-xs">
            <div className="text-left text-[9px] text-neutral-400">AX (A)</div>
            {stepsDesc.map((s) => (
              <div
                key={`a-${s.bit}`}
                onClick={() => setSelectedBit(s.bit)}
                className={`cursor-pointer rounded py-1 ${
                  s.bitA ? 'font-semibold text-white' : 'text-neutral-600'
                }`}
              >
                {s.bitA}
              </div>
            ))}
          </div>

          {/* Operand B Row */}
          <div className="mt-0.5 grid grid-cols-[64px_repeat(8,minmax(0,1fr))] items-center gap-1 border-b border-white/15 pb-1.5 text-center font-mono-tech text-xs">
            <div className="text-left text-[9px] text-neutral-400">{labelB}</div>
            {stepsDesc.map((s) => (
              <div
                key={`b-${s.bit}`}
                onClick={() => setSelectedBit(s.bit)}
                className={`cursor-pointer rounded py-1 ${
                  s.bitB ? 'font-semibold text-white' : 'text-neutral-600'
                }`}
              >
                {s.bitB}
              </div>
            ))}
          </div>

          {/* Sum Output Row */}
          <div className="mt-1.5 grid grid-cols-[64px_repeat(8,minmax(0,1fr))] items-center gap-1 text-center font-mono-tech text-xs">
            <div className="text-left text-[9px] font-bold text-white uppercase">SUM</div>
            {stepsDesc.map((s) => (
              <div
                key={`sum-${s.bit}`}
                onClick={() => setSelectedBit(s.bit)}
                className={`cursor-pointer rounded py-1 font-bold transition ${
                  s.sumBit === 1
                    ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                    : 'bg-[#0e0e0e] text-neutral-500'
                } ${
                  selectedBit === s.bit
                    ? 'ring-1 ring-white ring-offset-1 ring-offset-black'
                    : ''
                }`}
              >
                {s.sumBit}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Glowing-Wire Full-Adder Logic-Gate Circuit Schematic */}
      <FullAdderSchematicSvg step={activeStep} />

      {/* Selected Full-Adder Gate Equation Inspector */}
      {activeStep && (
        <div className="rounded-md border border-white/15 bg-[#0a0a0a] p-2.5 font-mono-tech text-[11px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-semibold text-white">
              FULL ADDER GATE // BIT {activeStep.bit}
            </span>
            <span className="text-[10px] text-neutral-400">
              Click any bit column (b0–b7) to energize gate wires
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <div className="rounded border border-white/10 bg-black px-2.5 py-1.5">
              <div className="text-[9px] text-neutral-500">SUM = A &oplus; B &oplus; Cin</div>
              <div className="mt-0.5 text-neutral-200">
                {activeStep.bitA} ^ {activeStep.bitB} ^ {activeStep.carryIn} ={' '}
                <span className="font-bold text-white">{activeStep.sumBit}</span>
              </div>
            </div>
            <div className="rounded border border-white/10 bg-black px-2.5 py-1.5">
              <div className="text-[9px] text-neutral-500">
                Cout = (A &amp; B) | (Cin &amp; (A &oplus; B))
              </div>
              <div className="mt-0.5 text-neutral-200">
                ({activeStep.bitA}&amp;{activeStep.bitB}) | ({activeStep.carryIn}&amp;
                {activeStep.xorAB}) ={' '}
                <span className="font-bold text-white">{activeStep.carryOut}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CpuCorePanel({
  registers,
  flags,
  changedRegisters,
  changedFlags,
  aluTrace,
  stage,
}) {
  const [selectedMulCycle, setSelectedMulCycle] = useState(null);

  useEffect(() => {
    setSelectedMulCycle(null);
  }, [aluTrace]);

  const controlRegs = [
    { key: 'PC', value: registers.PC, sub: `DEC ${registers.PC}` },
    {
      key: 'IR',
      value: registers.IR,
      sub: MNEMONICS[registers.IR] ? `OP ${MNEMONICS[registers.IR]}` : 'NOP',
    },
    { key: 'MAR', value: registers.MAR, sub: `ADDR ${registers.MAR}` },
    { key: 'MDR', value: registers.MDR, sub: `DATA ${registers.MDR}` },
    { key: 'SP', value: registers.SP, sub: `STACK ${registers.SP}` },
  ];

  const flagKeys = ['ZF', 'SF', 'CF', 'OF'];

  return (
    <section className="hw-panel hw-reticle flex flex-col rounded-lg">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-white" />
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.16em] text-white uppercase">
            02 // CPU Core &amp; Gate-Level ALU
          </h2>
        </div>
        <span className="font-mono-tech text-[10px] tracking-widest text-neutral-500">
          8-BIT DATAPATH
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Control & Bus Register File */}
        <div>
          <div className="mb-2 flex items-center justify-between font-mono-tech text-[10px] tracking-widest text-neutral-400 uppercase">
            <span>Control &amp; Bus Registers</span>
            <span className="text-neutral-500">Hover acronyms for COA definitions</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {controlRegs.map((reg, idx) => {
              const isChanged = changedRegisters.includes(reg.key);
              return (
                <div
                  key={reg.key}
                  className={`rounded-md border p-2.5 transition-all duration-300 ${
                    isChanged
                      ? 'animate-hw-pulse border-white bg-[#151515]'
                      : 'border-white/12 bg-[#0b0b0b]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <CoaTooltip
                      code={reg.key}
                      align={idx === 0 ? 'left' : idx === 4 ? 'right' : 'center'}
                    >
                      <span className="inline-flex cursor-help items-center gap-1 font-mono-tech text-[11px] font-bold tracking-wider text-neutral-300 hover:text-white">
                        <span>{reg.key}</span>
                        <Info className="h-2.5 w-2.5 text-neutral-500" />
                      </span>
                    </CoaTooltip>
                    {isChanged && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    )}
                  </div>
                  <div className="mt-1.5 font-mono-tech text-lg font-bold tracking-tight text-white">
                    0x{toHex8(reg.value)}
                  </div>
                  <div className="mt-0.5 font-mono-tech text-[10px] text-neutral-500">
                    {reg.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 8-Bit LED Bit-Cells for AX and BX */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between font-mono-tech text-[10px] tracking-widest text-neutral-400 uppercase">
            <span className="flex items-center gap-1.5">
              <Binary className="h-3.5 w-3.5 text-white" />
              <span>8-Bit LED Bit-Cell Registers (AX / BX)</span>
            </span>
            <span className="text-neutral-500">1 = LIT // 0 = DIM</span>
          </div>

          <LedBitArray
            regName="AX"
            value={registers.AX}
            isChanged={changedRegisters.includes('AX')}
            roleLabel="Accumulator / Op1"
          />
          <LedBitArray
            regName="BX"
            value={registers.BX}
            isChanged={changedRegisters.includes('BX')}
            roleLabel="Base / Op2 / Rem"
          />
        </div>

        {/* FLAGS LEDs (ZF, SF, CF, OF) */}
        <div className="rounded-md border border-white/12 bg-[#0b0b0b] p-3">
          <div className="mb-2.5 flex items-center justify-between font-mono-tech text-[10px] tracking-widest text-neutral-400 uppercase">
            <span>Processor Status Register (FLAGS)</span>
            <span className="text-neutral-500">Hover LEDs for flag semantics</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {flagKeys.map((fk, idx) => {
              const active = flags[fk] === 1;
              const updated = changedFlags.includes(fk);
              return (
                <CoaTooltip
                  key={fk}
                  code={fk}
                  align={idx === 0 ? 'left' : idx === 3 ? 'right' : 'center'}
                >
                  <div
                    className={`flex w-full cursor-help items-center justify-between rounded-md border px-3 py-2 transition-all duration-300 ${
                      active
                        ? 'border-white bg-white/12 shadow-[0_0_16px_rgba(255,255,255,0.24)]'
                        : 'border-white/10 bg-black'
                    } ${updated && active ? 'ring-1 ring-white/80' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                          active
                            ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]'
                            : 'border border-white/20 bg-[#141414]'
                        }`}
                      />
                      <span
                        className={`font-mono-tech text-xs font-bold tracking-wider ${
                          active ? 'text-white' : 'text-neutral-500'
                        }`}
                      >
                        {fk}
                      </span>
                    </div>
                    <span
                      className={`font-mono-tech text-xs font-bold ${
                        active ? 'text-white' : 'text-neutral-600'
                      }`}
                    >
                      {flags[fk]}
                    </span>
                  </div>
                </CoaTooltip>
              );
            })}
          </div>
        </div>

        {/* Interactive Gate-Level ALU Trace Viewer */}
        <div className="flex-1 rounded-md border border-white/15 bg-[#0a0a0a] p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-white" />
              <span className="font-mono-tech text-xs font-semibold tracking-wider text-white uppercase">
                Gate-Level ALU Trace Viewer
              </span>
            </div>
            <span className="rounded border border-white/15 bg-black px-2 py-0.5 font-mono-tech text-[10px] text-neutral-300">
              {aluTrace ? `MODE: ${aluTrace.type}` : `STAGE ${stage} // STANDBY`}
            </span>
          </div>

          {/* Idle / Pre-Stage 4 State */}
          {!aluTrace && (
            <div className="scanlines flex flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-black/70 px-4 py-7 text-center">
              <Layers className="h-6 w-6 text-neutral-500" />
              <p className="mt-2 font-mono-tech text-xs font-medium text-neutral-300">
                Pure Bitwise Logic-Gate ALU Standing By
              </p>
              <p className="mt-1 max-w-md font-mono-tech text-[11px] text-neutral-500">
                Advance to Stage 4 to observe live Full-Adder carry propagation, Two&apos;s
                Complement inversion, 8-cycle Shift-and-Add multiplication, or Restoring Division.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 font-mono-tech text-[10px] text-neutral-500">
                <span className="rounded border border-white/10 bg-[#0d0d0d] px-2 py-1">
                  Sum = A ^ B ^ Cin
                </span>
                <span className="rounded border border-white/10 bg-[#0d0d0d] px-2 py-1">
                  Cout = (A &amp; B) | (Cin &amp; (A ^ B))
                </span>
              </div>
            </div>
          )}

          {/* ADD Trace */}
          {aluTrace?.type === 'ADD' && (
            <CarryChainViewer
              gateSteps={aluTrace.gateSteps}
              operandA={aluTrace.operandA}
              operandB={aluTrace.operandB}
              result={aluTrace.result}
              carryOut={aluTrace.carryOut}
              labelB="BX (B)"
            />
          )}

          {/* SUB Trace (Two's Complement + Carry Chain) */}
          {aluTrace?.type === 'SUB' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded border border-white/12 bg-black p-2 font-mono-tech">
                  <div className="text-[9px] text-neutral-500 uppercase">1. Original BX</div>
                  <div className="mt-0.5 text-xs font-semibold text-neutral-200">
                    {toBinary8(aluTrace.steps.operandB)}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    DEC {aluTrace.steps.operandB} (0x{toHex8(aluTrace.steps.operandB)})
                  </div>
                </div>
                <div className="rounded border border-white/12 bg-black p-2 font-mono-tech">
                  <div className="text-[9px] text-neutral-500 uppercase">
                    2. Invert (~BX &amp; 0xFF)
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-neutral-200">
                    {toBinary8(aluTrace.steps.onesComplement)}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    1&apos;s Comp (0x{toHex8(aluTrace.steps.onesComplement)})
                  </div>
                </div>
                <div className="rounded border border-white/35 bg-[#121212] p-2 font-mono-tech">
                  <div className="text-[9px] text-neutral-300 uppercase">
                    3. Add 1 (~BX + 1)
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-white">
                    {toBinary8(aluTrace.steps.twosComplementB)}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    2&apos;s Comp = {toSigned8(aluTrace.steps.twosComplementB)} (0x
                    {toHex8(aluTrace.steps.twosComplementB)})
                  </div>
                </div>
              </div>

              <CarryChainViewer
                gateSteps={aluTrace.gateSteps}
                operandA={aluTrace.operandA}
                operandB={aluTrace.steps.twosComplementB}
                result={aluTrace.result}
                carryOut={aluTrace.carryOut}
                labelB="-BX (2C)"
              />
            </div>
          )}

          {/* MUL Trace (8-Cycle Shift-and-Add) */}
          {aluTrace?.type === 'MUL' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tech text-[10px] text-neutral-400">
                <span>
                  8-CYCLE SHIFT-AND-ADD: {aluTrace.operandA} &times; {aluTrace.operandB} ={' '}
                  <strong className="text-white">{aluTrace.fullProduct16}</strong>
                </span>
                <span>Click an ADD row to inspect carry bits</span>
              </div>

              <div className="overflow-x-auto rounded-md border border-white/12 bg-black">
                <table className="w-full text-left font-mono-tech text-[11px]">
                  <thead className="border-b border-white/12 bg-[#0d0d0d] text-[9px] tracking-wider text-neutral-400 uppercase">
                    <tr>
                      <th className="px-2.5 py-2">Cyc</th>
                      <th className="px-2 py-2">LSB</th>
                      <th className="px-2 py-2">Operation</th>
                      <th className="px-2 py-2">Partial Product (Bin)</th>
                      <th className="px-2.5 py-2 text-right">Dec</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {aluTrace.cycles.map((c) => {
                      const isSel = selectedMulCycle === c.cycle;
                      return (
                        <tr
                          key={c.cycle}
                          onClick={() =>
                            setSelectedMulCycle(isSel ? null : c.cycle)
                          }
                          className={`cursor-pointer transition ${
                            isSel
                              ? 'bg-white text-black'
                              : c.added
                              ? 'bg-white/[0.06] text-white hover:bg-white/[0.12]'
                              : 'text-neutral-500 hover:bg-white/[0.03]'
                          }`}
                        >
                          <td className="px-2.5 py-1.5 font-semibold">C{c.cycle}</td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isSel
                                  ? 'bg-black text-white'
                                  : c.lsb === 1
                                  ? 'bg-white text-black'
                                  : 'border border-white/15 text-neutral-500'
                              }`}
                            >
                              {c.lsb}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-[10px] font-medium">
                            {c.added ? 'ADD & SHIFT' : 'SHIFT ONLY'}
                          </td>
                          <td className="px-2 py-1.5 tracking-wider">
                            {toBinary8(c.partialProduct)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-semibold">
                            {c.partialProduct}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedMulCycle && (() => {
                const cyc = aluTrace.cycles.find((x) => x.cycle === selectedMulCycle);
                if (!cyc) return null;
                return (
                  <div className="rounded border border-white/20 bg-black p-2.5 font-mono-tech text-[10px] text-neutral-300">
                    <div className="font-semibold text-white">
                      CYCLE {cyc.cycle} REGISTER SNAPSHOT // {cyc.action}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-neutral-400">
                      <span>
                        Multiplicand: <strong className="text-white">{toBinary8(cyc.multiplicandBefore)}</strong> &rarr;{' '}
                        {toBinary8(cyc.multiplicandAfter)}
                      </span>
                      <span>
                        Multiplier: <strong className="text-white">{toBinary8(cyc.multiplierBefore)}</strong> &rarr;{' '}
                        {toBinary8(cyc.multiplierAfter)}
                      </span>
                      {cyc.carryBits && (
                        <span>
                          Carry Bits (MSB&larr;LSB):{' '}
                          <strong className="text-white">
                            {[...cyc.carryBits].reverse().join('')}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* DIV Trace (8-Cycle Restoring Division) */}
          {aluTrace?.type === 'DIV' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tech text-[10px] text-neutral-400">
                <span>
                  8-CYCLE RESTORING DIVISION: {aluTrace.operandA} / {aluTrace.operandB}
                </span>
                <span>
                  AX(Q) = <strong className="text-white">{aluTrace.quotient}</strong> | BX(R) ={' '}
                  <strong className="text-white">{aluTrace.remainder}</strong>
                </span>
              </div>

              <div className="overflow-x-auto rounded-md border border-white/12 bg-black">
                <table className="w-full text-left font-mono-tech text-[11px]">
                  <thead className="border-b border-white/12 bg-[#0d0d0d] text-[9px] tracking-wider text-neutral-400 uppercase">
                    <tr>
                      <th className="px-2 py-2">Cyc</th>
                      <th className="px-2 py-2">Shift Rem</th>
                      <th className="px-2 py-2">Action</th>
                      <th className="px-2 py-2">Rem (A)</th>
                      <th className="px-2 py-2 text-right">Quotient (Q)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {aluTrace.cycles.map((c) => (
                      <tr
                        key={c.cycle}
                        className={
                          c.qBit === 1
                            ? 'bg-white/[0.06] text-white'
                            : 'text-neutral-500'
                        }
                      >
                        <td className="px-2 py-1.5 font-semibold">C{c.cycle}</td>
                        <td className="px-2 py-1.5">
                          {c.shiftedRemainder} <span className="text-neutral-600">(in:{c.incomingBit})</span>
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              c.qBit === 1
                                ? 'bg-white text-black'
                                : 'border border-white/15 text-neutral-400'
                            }`}
                          >
                            {c.restored ? 'RESTORE (Q=0)' : 'KEEP (Q=1)'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">{toBinary8(c.remainderAfter)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">
                          {toBinary8(c.quotientSoFar)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hardware Fault Trace */}
          {aluTrace?.type === 'FAULT' && (
            <div className="overflow-hidden rounded-md border border-white bg-black">
              <div className="hazard-stripe-bw h-2 w-full" />
              <div className="p-3.5 font-mono-tech">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <AlertOctagon className="h-4 w-4 shrink-0" />
                  <span>{aluTrace.error}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                  <div className="rounded border border-white/15 bg-[#0e0e0e] p-2">
                    <div className="text-[9px] text-neutral-500">DIVIDEND (AX)</div>
                    <div className="mt-0.5 font-semibold text-white">
                      {aluTrace.operandA} [{toBinary8(aluTrace.operandA)}]
                    </div>
                  </div>
                  <div className="rounded border border-white bg-white p-2 text-black">
                    <div className="text-[9px] font-semibold">DIVISOR (BX) = ZERO</div>
                    <div className="mt-0.5 font-bold">
                      0 [0000 0000]
                    </div>
                  </div>
                  <div className="rounded border border-white/15 bg-[#0e0e0e] p-2">
                    <div className="text-[9px] text-neutral-500">VECTOR ASSERTED</div>
                    <div className="mt-0.5 font-semibold text-white">
                      IVT[{aluTrace.vector}] &rarr; HALT
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
