/**
 * What just happened on the wheel, and what to do next.
 * Effects and the next wheel's name are read from config, never hard-coded.
 */
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { findStep } from '../engine/adventure';
import { calculatePowerRating } from '../engine/power';
import type { LadderBump } from '../engine/ladder';
import { RARITIES, type Character, type GameConfig, type ResolvedSlice } from '../engine/types';
import type { GenerationPhase } from '../state/generationSession';
import { ROLE_LABELS, describeEffects, formatOdds, fullName, humanizeKey, optionLabel, heroRace, signed, unlockedBy } from './format';
import { getOptionIcon } from './icons';
import { enter } from './motion';
import { resultOf, type RevealedOutcome } from './outcome';
import { RARITY_STYLES, isSpecialRarity, rarityOf } from './rarity';
import { inkFor } from './wheel/color';
import { glassColor } from './wheel/paintWheel';
import { LifeChanged } from './Stakes';



interface RollRevealProps {
  phase: GenerationPhase;
  /** The spin being revealed, or the last one once the character is complete. */
  outcome: RevealedOutcome | null;
  character: Character;
  config: GameConfig;
  commitError: string | null;
  onContinue: () => void;
  /** Enter the world, under the name typed on the finish screen. */
  onCommit: (name: string) => void;
  onDiscard: () => void;
}

export const primaryButton = 'btn-gilt px-5 py-2';
export const secondaryButton = 'btn-plaque px-4 py-2';

export function RollReveal(props: RollRevealProps) {
  const { phase, outcome, config, onContinue } = props;
  const winner = outcome ? resultOf(outcome) : undefined;
  const announcement = phase === 'revealing' && winner ? `Rolled ${winner.option.label}.` : '';

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'revealing' && outcome && (
          <RevealPopup key={`reveal-${outcome.step.id}-${outcome.state.stepsTaken}`} jackpot={jackpotColor(outcome)}>
            <OutcomeCard outcome={outcome} config={config} onContinue={onContinue} finishLabel="Finish character" />
          </RevealPopup>
        )}
        {phase === 'complete' && (
          <motion.div key="complete" {...enter}>
            <Complete {...props} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A rare-or-better result's rarity colour: it lands as a jackpot. Null for anything less. */
export function jackpotColor(outcome: RevealedOutcome): string | null {
  const rarity = rarityOf(resultOf(outcome).option);
  return isSpecialRarity(rarity) ? RARITY_STYLES[rarity].color : null;
}

/**
 * A spin's result, as a popup in the middle of the screen: it bursts out of the wheel's hub the
 * moment the wheel lands, so the page never scrolls to find it. Continue closes it. A jackpot
 * (a rare-or-better result, `jackpot` its colour) throws gilt coins and stars out from behind it.
 */
export function RevealPopup({ children, jackpot = null }: { children: ReactNode; jackpot?: string | null }) {
  const reduce = useReducedMotion();
  // Where the Spin button (the wheel's hub) sits, relative to the middle of the screen: the popup
  // grows out of it and settles centred on its x, as far as the screen's edges allow.
  const [{ from, toX }] = useState(() => {
    const hub = (document.querySelector('[data-spin-button]') ?? document.querySelector('canvas'))?.getBoundingClientRect();
    if (!hub || hub.width === 0) return { from: { x: 0, y: 0 }, toX: 0 };
    const x = hub.left + hub.width / 2 - window.innerWidth / 2;
    const y = hub.top + hub.height / 2 - window.innerHeight / 2;
    const slack = Math.max(0, (window.innerWidth - 32 - Math.min(576, window.innerWidth - 32)) / 2); // p-4, max-w-xl
    return { from: { x, y }, toX: Math.max(-slack, Math.min(slack, x)) };
  });
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {jackpot && !reduce && <CoinBurst color={jackpot} x={toX} />}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Result"
        className="no-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto overflow-x-hidden"
        initial={reduce ? { opacity: 0, x: toX } : { opacity: 0, scale: 0.15, x: from.x, y: from.y }}
        animate={reduce ? { opacity: 1, x: toX } : { opacity: 1, scale: 1, x: toX, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
        transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 22 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface OutcomeCardProps {
  outcome: RevealedOutcome;
  config: GameConfig;
  onContinue: () => void;
  /** Button text when no wheel follows. */
  finishLabel: string;
  /** Who the wheel featured, when it cast a character from the world. */
  castName?: string;
  /** What changed hands with them: 'Took Aldric’s Dragonbone Blade'. */
  note?: string;
  /** Fame the roll earned on an adventure (negative for disgrace). */
  fame?: number;
  /** Something from the hero's past that came back on this roll. */
  callback?: string;
  /** A meter filled, and this is what came of it. */
  event?: string;
}

/**
 * The rolled option, its odds and effects. Rare-and-better rolls arrive with a burst
 * of their rarity's light; epic and legendary names shimmer.
 */
export function OutcomeCard({ outcome, config, onContinue, finishLabel, castName, note, fame, callback, event }: OutcomeCardProps) {
  const winner = resultOf(outcome);
  const { option } = winner;
  const { probability } = outcome.roll.winner; // the chance of where the wheel landed
  const bump = outcome.bump;
  const glass = glassColor(winner);
  const rarity = rarityOf(option);
  const style = RARITY_STYLES[rarity];
  const special = isSpecialRarity(rarity);
  const shimmer = rarity === 'epic' || rarity === 'legendary' || rarity === 'mythical';
  // The winner is the option as dealt to this character; the step holds it as written in config.
  const effects = describeEffects(option, config, outcome.step.options.find((o) => o.id === option.id), castName, outcome.state.character);
  const nextStep = outcome.state.currentStepId ? findStep(config, outcome.state.currentStepId) : undefined;
  const thanksTo = unlockedBy(option, config, outcome.state.character);
  // A real spin pays out its odds like a prize wheel; a smash, a decree or a choice had none.
  const spun = outcome.roll.draw >= 0;

  return (
    <div
      className={`court-panel p-5 ${special ? 'pt-11' : ''}`}
      style={special ? ({ '--panel-glow': `0 0 34px -2px ${style.color}` } as CSSProperties) : undefined}
    >
      {/* A pennon in the winning slice's colour, hung from the board's top edge. */}
      <span aria-hidden="true" className="pennon" style={{ '--tincture': glass } as CSSProperties} />
      {/* A jackpot hangs its banner from the middle of the board, like the tabs from their rod. */}
      {special && (
        <span aria-hidden="true" className="jackpot-banner absolute left-1/2 top-0 z-[2] -translate-x-1/2 font-caps text-sm font-bold tracking-[0.18em] text-candle">
          {style.label}!
        </span>
      )}
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        <RolledIcon slice={winner} glass={glass} burstColor={special ? style.color : null} />
        <div className="min-w-0 flex-1">
          <h3
            className={`font-display text-3xl leading-tight text-candle ${shimmer ? 'rarity-shimmer' : ''}`}
            style={shimmer ? ({ '--shine': style.color } as CSSProperties) : undefined}
          >
            {optionLabel(option)}
          </h3>
          <p className="text-sm text-ash">
            {outcome.roll.draw === -2
              ? `${outcome.step.title}: smashed to a stop`
              : outcome.roll.draw === -3
                ? `${outcome.step.title}: decreed`
                : outcome.roll.draw < 0
                  ? `${outcome.step.title}: your choice`
                  : outcome.step.title}
          </p>
          {event && <p className="text-sm font-semibold text-ember">{event}.</p>}
          {rarity !== 'common' && (
            <p className="font-caps text-sm font-bold tracking-wide" style={{ color: style.color }}>
              {style.label}
            </p>
          )}
          {option.description && <p className="mt-1 italic text-vellum">{option.description}</p>}
          {thanksTo && <p className="mt-1 text-sm font-semibold text-moss">Only possible thanks to {thanksTo}</p>}
          {bump && <BumpNote bump={bump} landed={optionLabel(outcome.roll.winner.option)} />}
          {note && <p className="mt-1 text-sm font-semibold text-gilt-bright">{note}.</p>}
          {callback && <p className="mt-1 text-sm font-semibold text-moss">From their past: {callback}.</p>}
        </div>
        {spun && (
          // The payout: the odds of where the wheel landed, set as the plaque's biggest number.
          // On a phone it drops to its own line under the text, so the name keeps the width.
          <p className="flex basis-full items-baseline gap-3 border-t border-lead pt-3 sm:mr-9 sm:block sm:shrink-0 sm:basis-auto sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:text-right">
            <span className="block font-caps text-xs tracking-widest text-ash">{bump ? 'landed at' : 'odds'}</span>
            <span
              className="block whitespace-nowrap font-display text-3xl leading-none sm:text-4xl"
              style={{ color: special ? style.color : 'var(--color-gilt-bright)', textShadow: special ? `0 0 18px ${style.color}66` : undefined }}
            >
              {formatOdds(probability)}
            </span>
            <span className="sr-only"> chance</span>
          </p>
        )}
      </div>
      {fame !== undefined && fame !== 0 && (
        <p className={`mt-3 text-sm font-semibold ${fame > 0 ? 'text-moss' : 'text-ember'}`}>
          {fame > 0 ? `+${fame} fame` : `${signed(fame)} fame: word gets around`}
        </p>
      )}
      {option.setRace && <LifeChanged config={config} race={option.setRace} />}
      {effects.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Effects">
          {effects.map((effect) => (
            <li key={effect} className="rounded-sm border border-lead bg-slab-raised px-2 py-1 text-sm text-vellum">
              {effect}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onContinue} className={primaryButton} autoFocus>
          {nextStep ? 'Continue' : finishLabel}
        </button>
        {nextStep && <p className="text-sm text-ash">Next: {nextStep.title}</p>}
        <Coins rarity={rarity} />
      </div>
    </div>
  );
}

/** The payout row: a gilt coin per rarity tier, one for a common roll up to six for a mythical one. */
function Coins({ rarity }: { rarity: ReturnType<typeof rarityOf> }) {
  const reduceMotion = useReducedMotion() ?? false;
  const count = RARITIES.indexOf(rarity) + 1;
  return (
    <span aria-hidden="true" className="ml-auto flex gap-1">
      {Array.from({ length: count }, (_, k) => (
        <motion.i
          key={k}
          className="coin"
          initial={reduceMotion ? false : { y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 + k * 0.08, type: 'spring', stiffness: 500, damping: 18 }}
        />
      ))}
    </span>
  );
}

/** Behind a jackpot's plaque: gilt coins and four-point stars flung outward once, then gone. */
function CoinBurst({ color, x }: { color: string; x: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: 22 }, (_, k) => {
      const angle = (k / 22) * Math.PI * 2 + Math.random() * 0.3;
      const reach = 220 + Math.random() * 200;
      return {
        coin: k % 3 !== 0,
        x: Math.cos(angle) * reach * 1.3,
        y: Math.sin(angle) * reach * 0.8 - 40,
        spin: (Math.random() - 0.5) * 540,
        delay: Math.random() * 0.18,
        size: 0.7 + Math.random() * 0.6,
      };
    }),
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ transform: `translateX(${x}px)` }}>
      {pieces.map((p, k) => (
        <motion.span
          key={k}
          className="absolute"
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 90], rotate: p.spin, opacity: [1, 1, 0], scale: p.size }}
          transition={{ duration: 1.5, delay: 0.1 + p.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.6, 1] }}
        >
          {p.coin ? (
            <i className="coin block" />
          ) : (
            <svg viewBox="0 0 20 20" className="block size-5">
              <path d="M10 0Q10 10 20 10Q10 10 10 20Q10 10 0 10Q10 10 10 0Z" fill={k % 2 ? '#fffaf0' : color} />
            </svg>
          )}
        </motion.span>
      ))}
    </div>
  );
}

/** "Landed on Average, hammered up 2 positions by banked bonuses." */
function BumpNote({ bump, landed }: { bump: LadderBump; landed: string }) {
  const n = Math.abs(bump.stages);
  const moved = n === 0 ? '' : `${bump.stages > 0 ? 'hammered up' : 'knocked down'} ${n} ${n === 1 ? 'position' : 'positions'}`;
  return (
    <p className={`mt-1 text-sm font-semibold ${bump.stages < 0 ? 'text-ember' : 'text-gilt-bright'}`}>
      Landed on {landed}
      {moved && `, ${moved} by banked bonuses`}
      {bump.overflow && `${moved ? ', then' : ','} hammered past the top: Ascension next!`}
      {!bump.overflow && '.'}
    </p>
  );
}

/** The option's roundel. For rare-and-better rolls, a ring and rays burst out of it once. */
function RolledIcon({ slice, glass, burstColor }: { slice: ResolvedSlice; glass: string; burstColor: string | null }) {
  const reduceMotion = useReducedMotion() ?? false;
  const Icon = getOptionIcon(slice.option.icon);
  return (
    <span aria-hidden="true" className="relative flex size-12 shrink-0 items-center justify-center">
      {burstColor && <span className="jackpot-rays absolute -inset-8 rounded-full" style={{ '--ray': burstColor } as CSSProperties} />}
      {burstColor && !reduceMotion && (
        <span className="pointer-events-none absolute inset-0">
          <motion.span
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: burstColor }}
            initial={{ scale: 0.7, opacity: 0.9 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          {Array.from({ length: 10 }, (_, k) => (
            <span key={k} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${k * 36}deg)` }}>
              <motion.span
                className="absolute block h-[3px] w-5 origin-left rounded-full"
                style={{ background: burstColor, top: -1.5 }}
                initial={{ x: 14, scaleX: 0.2, opacity: 1 }}
                animate={{ x: 40, scaleX: 1, opacity: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut', delay: 0.08 }}
              />
            </span>
          ))}
        </span>
      )}
      <span
        className="relative flex size-12 items-center justify-center rounded-full border-[3px] border-lead"
        style={{
          background: glass,
          color: inkFor(glass).ink,
          boxShadow: burstColor ? `0 0 0 2px ${burstColor}, 0 0 18px ${burstColor}` : undefined,
        }}
      >
        <Icon size={22} strokeWidth={2.25} />
      </span>
    </span>
  );
}

function Complete({ character, config, commitError, onCommit, onDiscard }: RollRevealProps) {
  const roles = character.singletonClaims.map(humanizeKey);
  const race = heroRace(config, character);
  const sworn = character.role === 'minion';
  const [name, setName] = useState(character.name);
  const nameId = useId();
  const named = { ...character, name: name.trim() || character.name };
  return (
    <div className="court-panel p-5">
      <p className="text-sm text-ash">{sworn ? 'Never a hero' : 'Character complete'}</p>
      <h3 className={`font-display text-3xl leading-tight ${sworn ? 'text-ember' : 'text-candle'}`}>
        {fullName(named, config)}
      </h3>
      <label htmlFor={nameId} className="mt-3 block text-sm text-ash">
        Name them (the wheels suggested one)
      </label>
      <input
        id={nameId}
        type="text"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(name.trim());
        }}
        className="mt-1 w-full max-w-sm rounded-md border-2 border-lead bg-nave px-3 py-1.5 text-vellum"
      />
      <p className="mt-1 text-vellum">
        {race ? `${race} ${ROLE_LABELS[character.role].toLowerCase()}` : ROLE_LABELS[character.role]} with{' '}
        {calculatePowerRating(character)} combat power.
        {roles.length > 0 && ` Entering the world claims: ${roles.join(', ')}.`}
        {sworn && ' They join the Demon Lord’s army, and heroes will meet them on the road as a Dark Champion.'}
      </p>
      {commitError && (
        <p role="alert" className="mt-3 text-ember">
          {commitError}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => onCommit(name.trim())} className={primaryButton} autoFocus>
          {sworn ? 'Enter the world as an enemy' : 'Enter the world'}
        </button>
        <button type="button" onClick={onDiscard} className={secondaryButton}>
          Discard
        </button>
      </div>
    </div>
  );
}
