/**
 * The side bets of fate, played the way the Crit Cascade plays a crit: the Gambler's coin
 * (Double or Nothing) and the Trickster's gambit drop in over the hall on the little casino
 * wheel, spin themselves, land with a shower of coins and the result in big letters, and the
 * road goes on by itself. No Spin button and no reveal card: like a crit, it just happens. The
 * wheel just rolled stays in the hall underneath (`sideBetBackdrop`); the little wheel is only
 * ever the overlay.
 *
 * Same contract as SpinWheel underneath: the engine decides the roll (`onSpin`), this spins to
 * it and says when it has landed (`onSettled`), then moves on (`onAdvance`).
 *
 * Reduced motion (or Instant wheels): no spinning, the result appears.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { calculatePowerRating } from '../../engine/power';
import type { ArchetypeRules, Character, ResolvedSlice, WheelStep } from '../../engine/types';
import { Coins, MiniWheel, type MiniSlice } from '../battle/CritCascade';
import { optionLabel } from '../format';
import { pauseDuration, spinDuration, useSettings } from '../settings';
import type { GenerationPhase } from '../../state/generationSession';
import type { SpinRequest } from './SpinWheel';

const SPIN_MS = 2600;
/** Even on Fast wheels, it takes its time to come to rest. */
const MIN_SPIN_MS = 1500;
const SIZE = 230;
/** The beat before it spins itself, once it has dropped in. */
const DROP_MS = 450;
/** How long the result holds before the road goes on. */
const HOLD_MS = 2000;
const HOLD_BIG_MS = 2600;

/** True for a wheel that is played as a side bet: the soul's Gambler coin or Trickster gambit. */
export function isSideBet(step: Pick<WheelStep, 'id'> | null | undefined, rules: ArchetypeRules | undefined): boolean {
  return !!step && !!rules && (step.id === rules.gamble || step.id === rules.beforeFight);
}

/** What the hall keeps showing while a side bet plays over it: the wheel just rolled, on its result. */
export interface SideBetBackdrop {
  step: WheelStep;
  slices: ResolvedSlice[];
  winnerIndex: number;
}

/**
 * The wheel the side bet is played over: the roll that led to it (`session.last`), not the bet's
 * own wheel. Null when the current wheel is no side bet, or nothing was rolled before it.
 */
export function sideBetBackdrop(
  session: { last: { step: WheelStep; roll: { slices: ResolvedSlice[]; winner: ResolvedSlice } } | null },
  step: WheelStep | null | undefined,
  rules: ArchetypeRules | undefined,
): SideBetBackdrop | null {
  const last = session.last;
  if (!isSideBet(step, rules) || !last || isSideBet(last.step, rules)) return null;
  return { step: last.step, slices: last.roll.slices, winnerIndex: last.roll.winner.index };
}

/** A slice's word on the little wheel: the bet's multiplier where it has one. */
function shortLabel(slice: ResolvedSlice): string {
  const o = slice.option;
  if (o.gamble === 'double') return '×2';
  if (o.gamble === 'triple') return '×3!';
  if (o.gamble === 'lose') return 'BUST';
  if (o.fightBoost !== undefined) return `×${o.fightBoost}`;
  return optionLabel(o).split(' ')[0] ?? '';
}

/** A result worth the full marquee: a jackpot, or a multiplier of three or more. */
function isBig(slice: ResolvedSlice): boolean {
  return slice.option.gamble === 'triple' || (slice.option.fightBoost ?? 0) >= 3;
}

/** A result that went against them. */
function isBad(slice: ResolvedSlice): boolean {
  return slice.option.gamble === 'lose' || (slice.option.fightBoost ?? 1) < 1;
}

export interface SideBetProps {
  step: WheelStep;
  slices: readonly ResolvedSlice[];
  phase: GenerationPhase;
  spin: SpinRequest | null;
  /** The slice it landed on, once landed. */
  winnerIndex: number | null;
  canSpin: boolean;
  /** The soul betting, as they stood before the wheel. */
  character: Character;
  onSpin: () => void;
  onSettled: (spinId: number) => void;
  /** The result has shown: on with the road. */
  onAdvance?: (() => void) | undefined;
}

export function SideBet({ step, slices, phase, spin, winnerIndex, canSpin, character, onSpin, onSettled, onAdvance }: SideBetProps) {
  const { wheelSpeed } = useSettings();
  const reduce = (useReducedMotion() ?? false) || wheelSpeed === 'instant';
  const open = slices.filter((s) => !s.locked && s.probability > 0);
  const mini: MiniSlice[] = open.map((s) => ({ id: String(s.index), label: shortLabel(s), weight: s.probability, color: s.option.color ?? '#6b6b6b' }));
  const landed = phase === 'revealing' || phase === 'complete' || phase === 'upgrading';
  const winner = landed && winnerIndex !== null ? slices[winnerIndex] : undefined;
  const gambler = step.id === character.rules?.gamble;
  // The spin, kept after it lands, so the same wheel stays put on its result instead of being swapped for one that jumps there.
  const [spun, setSpun] = useState<SpinRequest | null>(spin);
  if (spin && spin !== spun) setSpun(spin);
  const spinMs = reduce ? 1 : Math.max(MIN_SPIN_MS, spinDuration(SPIN_MS, wheelSpeed));

  // It spins itself, a beat after dropping in.
  useEffect(() => {
    if (phase !== 'ready' || !canSpin) return;
    const t = setTimeout(onSpin, pauseDuration(DROP_MS, wheelSpeed));
    return () => clearTimeout(t);
  }, [phase, canSpin, onSpin, wheelSpeed]);

  // The result holds, then the road goes on (once per landing).
  const advanceRef = useRef(onAdvance);
  useEffect(() => {
    advanceRef.current = onAdvance;
  }, [onAdvance]);
  const holding = phase === 'revealing' && winner !== undefined;
  const hold = winner ? (reduce ? 900 : isBig(winner) ? HOLD_BIG_MS : HOLD_MS) : 0;
  useEffect(() => {
    if (!holding) return;
    const t = setTimeout(() => advanceRef.current?.(), pauseDuration(hold, wheelSpeed));
    return () => clearTimeout(t);
  }, [holding, hold, wheelSpeed]);

  const big = winner ? isBig(winner) : false;
  const bad = winner ? isBad(winner) : false;
  const power = calculatePowerRating(character);
  const boost = winner?.option.fightBoost;
  const title = gambler ? 'DOUBLE OR NOTHING!' : 'THE GAMBIT!';
  const glow = bad ? 'rgba(127,29,29,0.55)' : 'rgba(240,205,108,0.25)';

  return (
    <>
      <AnimatePresence>
        {phase !== 'complete' && (
          <motion.div
            role="dialog"
            aria-label={gambler ? 'Double or nothing' : 'The Trickster’s gambit'}
            className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          >
            <div className="absolute inset-0 transition-[background] duration-500" style={{ background: `radial-gradient(circle, ${glow}, rgba(0,0,0,0.82) 70%)`, backgroundColor: 'rgba(12,7,6,0.55)' }} />
            <motion.p
              className="font-display relative text-3xl tracking-wide sm:text-4xl"
              style={{ color: 'var(--color-gilt-bright)', textShadow: '0 0 18px rgba(255,200,90,0.6), 0 2px 0 #000' }}
              initial={{ scale: 0.4, rotate: -6 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            >
              {title}
            </motion.p>
            {step.subtitle && <p className="relative mt-1 max-w-md text-center text-sm text-vellum">{step.subtitle}</p>}
            <motion.div
              className="relative mt-4"
              style={{ width: SIZE, height: SIZE }}
              initial={{ y: '-60%', scale: 0.6, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {spun && (landed || spin) ? (
                <MiniWheel key={`spin-${spun.id}`} slices={mini} target={String(spun.targetIndex)} spinMs={spinMs} reduce={reduce} size={SIZE} onLanded={() => onSettled(spun.id)} minLabelSpan={8} settle />
              ) : (
                <MiniWheel key="waiting" slices={mini} target="" spinMs={1} reduce size={SIZE} onLanded={() => {}} minLabelSpan={8} />
              )}
              {winner && !reduce && !bad && <Coins salt={winner.index + 1} big={big} />}
            </motion.div>
            {/* The result */}
            <div className="relative mt-4 flex min-h-[5.5rem] flex-col items-center text-center" aria-live="polite">
              {winner && (
                <>
                  <motion.span
                    key={winner.index}
                    className="font-display text-5xl tabular-nums"
                    style={{ color: bad ? '#ff9a8a' : '#fff4c2', textShadow: bad ? '0 0 20px rgba(163,40,46,0.9), 0 3px 0 #000' : '0 0 24px rgba(255,190,80,0.85), 0 3px 0 #000' }}
                    initial={{ y: 10, opacity: 0, filter: 'blur(6px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {shortLabel(winner)} <span className="text-3xl">{optionLabel(winner.option)}</span>
                  </motion.span>
                  <motion.span className="mt-1 max-w-md text-sm text-vellum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.45 }}>
                    {boost !== undefined ? (
                      <>
                        Power for this fight: <span className="tabular-nums">{power}</span> →{' '}
                        <span className={`font-semibold tabular-nums ${bad ? 'text-ember' : 'text-gilt-bright'}`}>{Math.round(power * boost)}</span>
                      </>
                    ) : (
                      winner.option.description
                    )}
                  </motion.span>
                </>
              )}
            </div>
            {big && winner && (
              <motion.p
                className="font-display absolute top-[12%] text-6xl"
                style={{ color: '#ffd76a', textShadow: '0 0 30px #ffb84d, 0 4px 0 #000' }}
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: [0, 1.25, 1], rotate: [-12, 4, 0] }}
                transition={{ duration: 0.6 }}
              >
                {gambler ? 'JACKPOT' : 'FATE LAUGHS'}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
