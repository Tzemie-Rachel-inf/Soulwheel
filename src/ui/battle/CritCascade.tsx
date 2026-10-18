/**
 * The Crit Cascade, played back: the cascade was rolled when the crit landed (engine/battle.ts),
 * so this only shows it. A small wheel of multipliers spins, fast; if it lands on CHAIN, another,
 * faster one drops on top of it, and so on. The running multiplier rolls up in the corner and
 * every landing throws coins. A JACKPOT gets the whole marquee.
 *
 * Reduced motion: no spinning, the wheels' results appear one after another.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CascadeRoll } from '../../engine/battle';
import type { BattleConfig } from '../../engine/types';
import { pauseDuration, spinDuration, useSettings } from '../settings';

/** How long each wheel in the stack spins: each one faster. */
const SPIN_MS = [1700, 1100, 800, 600];
/** The pause on each landing before the next wheel drops in. */
const LAND_MS = 520;

export interface MiniSlice {
  id: string;
  label: string;
  weight: number;
  color: string;
}

/** The slices of the cascade wheel at this depth (the last one has no CHAIN), or a foe's ×2 / ×3. */
function slicesAt(config: BattleConfig, depth: number, foe: boolean): MiniSlice[] {
  if (foe) return config.foeCascade.map((s) => ({ id: `x${s.mult}`, label: `×${s.mult}`, weight: s.weight, color: s.mult >= 3 ? '#7f1d1d' : '#a3282e' }));
  return config.cascade.filter((s) => !s.chain || depth < config.cascadeDepth).map((s) => ({ id: s.id, label: s.chain ? 'CHAIN' : s.label.replace('JACKPOT ', ''), weight: s.weight, color: s.color }));
}

/** A slice's middle, in degrees clockwise from the top. */
function middleOf(slices: MiniSlice[], id: string): number {
  const total = slices.reduce((sum, s) => sum + s.weight, 0);
  let at = 0;
  for (const s of slices) {
    const span = (s.weight / total) * 360;
    if (s.id === id) return at + span / 2;
    at += span;
  }
  return 0;
}

function arc(r: number, from: number, to: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M 0 0 L ${p(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)} Z`;
}

export function MiniWheel({ slices, target, spinMs, reduce, onLanded, size, minLabelSpan = 0, settle = false }: { slices: MiniSlice[]; target: string; spinMs: number; reduce: boolean; onLanded: () => void; size: number; minLabelSpan?: number; settle?: boolean }) {
  const total = slices.reduce((sum, s) => sum + s.weight, 0);
  // Several whole turns, then the target's middle under the pointer at the top.
  const turns = useMemo(() => 360 * (3 + Math.floor(spinMs / 600)) - middleOf(slices, target), [slices, target, spinMs]);
  const done = useRef(false);
  const land = () => {
    if (done.current) return;
    done.current = true;
    onLanded();
  };
  useEffect(() => {
    if (!reduce) return;
    const t = setTimeout(land, 280);
    return () => clearTimeout(t);
  });
  const r = 50;
  // Where each slice starts, clockwise from the top.
  const starts = slices.map((_s, i) => slices.slice(0, i).reduce((sum, s) => sum + (s.weight / total) * 360, 0));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* The pointer */}
      <span aria-hidden="true" className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid var(--color-gilt-bright)' }} />
      <motion.svg
        viewBox="-54 -54 108 108"
        width={size}
        height={size}
        initial={{ rotate: 0 }}
        // `settle`: a long ease out that creeps a hair past the result and rocks back onto it, as a real wheel does.
        animate={{ rotate: reduce ? -middleOf(slices, target) : settle ? [0, turns + 2.5, turns] : turns }}
        transition={
          reduce
            ? { duration: 0 }
            : settle
              ? { duration: spinMs / 1000, times: [0, 0.84, 1], ease: [[0.18, 0.62, 0.22, 1], [0.45, 0, 0.4, 1]] }
              : { duration: spinMs / 1000, ease: [0.12, 0.7, 0.18, 1] }
        }
        onAnimationComplete={land}
        style={{ filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.6))' }}
      >
        <circle r={53} fill="#1b1210" stroke="var(--color-gilt)" strokeWidth={2} />
        {slices.map((s, i) => {
          const span = (s.weight / total) * 360;
          const from = starts[i]!;
          const mid = ((from + span / 2 - 90) * Math.PI) / 180;
          // Wide slices write across the slice, narrow ones along the spoke where there is room;
          // either way a label turns over rather than read upside down at rest.
          const centre = from + span / 2;
          const narrow = span < 40;
          const turn = narrow ? (centre > 180 ? centre + 90 : centre - 90) : centre > 90 && centre < 270 ? centre + 180 : centre;
          const lr = r * (narrow ? 0.66 : 0.64);
          return (
            <g key={s.id}>
              <path d={arc(r, from, from + span)} fill={s.color} stroke="#1b1210" strokeWidth={0.8} />
              {span >= minLabelSpan && <text
                x={Math.cos(mid) * lr}
                y={Math.sin(mid) * lr}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={span < 30 ? 7 : 9.5}
                fontWeight={700}
                fill="#fff8e6"
                style={{ fontFamily: 'var(--font-display)' }}
                transform={`rotate(${turn} ${Math.cos(mid) * lr} ${Math.sin(mid) * lr})`}
              >
                {s.label}
              </text>}
            </g>
          );
        })}
        {/* Marquee lights round the rim */}
        {Array.from({ length: 16 }, (_, i) => {
          const a = ((i * 22.5 - 90) * Math.PI) / 180;
          return (
            <motion.circle
              key={i}
              cx={Math.cos(a) * 51.5}
              cy={Math.sin(a) * 51.5}
              r={1.6}
              fill="#ffe9a8"
              animate={reduce ? { opacity: 0.8 } : { opacity: i % 2 ? [1, 0.2, 1] : [0.2, 1, 0.2] }}
              transition={reduce ? { duration: 0 } : { duration: 0.5, repeat: Infinity }}
            />
          );
        })}
        <circle r={9} fill="#2a1d17" stroke="var(--color-gilt)" strokeWidth={1.5} />
      </motion.svg>
    </div>
  );
}

/** A steady pseudo-random number in [0, 1), so every render agrees. */
const jitter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function Coins({ salt, big }: { salt: number; big: boolean }) {
  const n = big ? 36 : 14;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: n }, (_, i) => {
        const angle = jitter(i, salt) * Math.PI * 2;
        const dist = (big ? 160 : 90) * (0.5 + jitter(i, salt + 1));
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 block rounded-full"
            style={{ width: 9, height: 9, background: 'radial-gradient(circle at 35% 35%, #fff4c2, #e0a83a 60%, #8a6420)', boxShadow: '0 0 6px rgba(255,215,106,0.8)' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 40, opacity: 0, scale: 1.1, rotate: 360 }}
            transition={{ duration: 0.9 + jitter(i, salt + 2) * 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export interface CritCascadeProps {
  config: BattleConfig;
  /** The wheels as they landed. */
  cascade: CascadeRoll[];
  /** The hit before the multipliers, and after them, in the health the struck side shows. */
  base: number;
  total: number;
  /** A foe's brutal blow: one red wheel, ×2 or ×3. */
  foe?: boolean;
  onDone: () => void;
}

export function CritCascade({ config, cascade, base, total, foe = false, onDone }: CritCascadeProps) {
  const { wheelSpeed } = useSettings();
  // Instant wheels: the results appear at once, as for reduced motion.
  const reduce = (useReducedMotion() ?? false) || wheelSpeed === 'instant';
  /** Wheels landed so far. */
  const [landed, setLanded] = useState(0);
  const finished = landed >= cascade.length;
  const mult = cascade.slice(0, landed).reduce((m, r) => m * r.mult, 1);
  const jackpot = cascade.some((r) => r.id === 'jackpot');
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => doneRef.current(), pauseDuration(reduce ? 900 : jackpot ? 1900 : 1200, wheelSpeed));
    return () => clearTimeout(t);
  }, [finished, reduce, jackpot, wheelSpeed]);

  // Each wheel waits a beat on its landing before the next drops in.
  const [showing, setShowing] = useState(1);
  useEffect(() => {
    if (landed === 0 || landed >= cascade.length) return;
    const t = setTimeout(() => setShowing(landed + 1), reduce ? 200 : LAND_MS);
    return () => clearTimeout(t);
  }, [landed, cascade.length, reduce]);

  return (
    <motion.div
      role="dialog"
      aria-label={foe ? 'A brutal blow' : 'Critical hit: the Crit Cascade'}
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: foe ? 'radial-gradient(circle, rgba(127,29,29,0.55), rgba(0,0,0,0.75) 70%)' : 'radial-gradient(circle, rgba(240,205,108,0.25), rgba(0,0,0,0.78) 70%)' }} />
      <motion.p
        className="font-display relative text-3xl tracking-wide sm:text-4xl"
        style={{ color: foe ? '#ff9a8a' : 'var(--color-gilt-bright)', textShadow: '0 0 18px rgba(255,200,90,0.6), 0 2px 0 #000' }}
        initial={{ scale: 0.4, rotate: -6 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 14 }}
      >
        {foe ? 'BRUTAL BLOW!' : 'CRITICAL!'}
      </motion.p>
      <div className="relative mt-3" style={{ width: 230, height: 230 }}>
        {cascade.slice(0, showing).map((roll, depth) => (
          <motion.div
            key={depth}
            className="absolute left-1/2 top-1/2"
            style={{ zIndex: depth + 1 }}
            initial={{ x: '-50%', y: '-160%', scale: 0.6, opacity: 0 }}
            animate={{ x: '-50%', y: `calc(-50% + ${depth * -10}px)`, scale: 1 - depth * 0.12, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <MiniWheel
              slices={slicesAt(config, depth + 1, foe)}
              target={roll.id}
              spinMs={spinDuration(SPIN_MS[depth] ?? 600, wheelSpeed)}
              reduce={reduce}
              size={210}
              onLanded={() => setLanded((n) => Math.max(n, depth + 1))}
            />
            {landed > depth && !reduce && <Coins salt={depth + 1} big={roll.id === 'jackpot'} />}
          </motion.div>
        ))}
      </div>
      {/* The running multiplier */}
      <div className="relative mt-4 flex items-baseline gap-3">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={mult}
            className="font-display text-5xl tabular-nums"
            style={{ color: '#fff4c2', textShadow: '0 0 24px rgba(255,190,80,0.85), 0 3px 0 #000' }}
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 16 }}
          >
            ×{mult}
          </motion.span>
        </AnimatePresence>
        {finished && (
          <motion.span className="font-display text-3xl tabular-nums text-vellum" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            {base} → <span className={foe ? 'text-ember' : 'text-gilt-bright'}>{total}</span>
          </motion.span>
        )}
      </div>
      <p className="relative mt-1 h-5 text-sm text-ash">{cascade.slice(0, landed).map((r) => (r.id === 'chain' ? 'CHAIN ×2' : r.label)).join('  →  ')}</p>
      {jackpot && finished && (
        <motion.p
          className="font-display absolute top-[12%] text-6xl"
          style={{ color: '#ffd76a', textShadow: '0 0 30px #ffb84d, 0 4px 0 #000' }}
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: [0, 1.25, 1], rotate: [-12, 4, 0] }}
          transition={{ duration: 0.6 }}
        >
          JACKPOT
        </motion.p>
      )}
    </motion.div>
  );
}
