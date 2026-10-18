# Components

Custom components (no UI library). React 19 + Tailwind 4 + framer-motion + lucide-react. Wheels painted on <canvas>.
Buttons: `primaryButton` = `.btn-gilt` (flat gold plaque), `secondaryButton` = `.btn-plaque` (ebony plaque, gold hairline). Panels: `.court-panel` (ebony board in a leaf-gold frame with corner fleurons).

### `src/ui/RollReveal.tsx`

```tsx
/**
 * What just happened on the wheel, and what to do next.
 * Effects and the next wheel's name are read from config, never hard-coded.
 */
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { findStep } from '../engine/adventure';
import { calculatePowerRating } from '../engine/power';
import type { LadderBump } from '../engine/ladder';
import type { Character, GameConfig, ResolvedSlice } from '../engine/types';
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
          <RevealPopup key={`reveal-${outcome.step.id}-${outcome.state.stepsTaken}`}>
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

/**
 * A spin's result, as a popup in the middle of the screen: it bursts out of the wheel's hub the
 * moment the wheel lands, so the page never scrolls to find it. Continue closes it.
 */
export function RevealPopup({ children }: { children: ReactNode }) {
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

  return (
    <div
      className="court-panel p-5"
      style={special ? ({ '--panel-glow': `0 0 30px -4px ${style.color}` } as CSSProperties) : undefined}
    >
      {/* A pennon in the winning slice's colour, hung from the board's top edge. */}
      <span aria-hidden="true" className="pennon" style={{ '--tincture': glass } as CSSProperties} />
      <div className="flex items-start gap-4">
        <RolledIcon slice={winner} glass={glass} burstColor={special ? style.color : null} />
        <div className="min-w-0">
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
                  : `${outcome.step.title}, a ${formatOdds(probability)} chance`}
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
      </div>
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

```
### `src/ui/wheel/FateWheels.tsx`

```tsx
/**
 * The wheel as the soul's archetype has it: the screen-side half of engine/archetypes.ts.
 *
 *   Wise     two wheels side by side, spun together; once both land, the player keeps one
 *   Brute    the hub turns into a Smash button while the wheel spins
 *   Ancient  a Decree button: the next click on a slice decides the roll, once in a life (or a
 *            choice from the list of open slices, for the keyboard and screen readers)
 *   Hero     the wheel drags as holy slices pass the pointer
 *
 * Everyone else gets the one wheel, exactly as before. Creation and adventures both use this.
 */
import { useEffect, useRef, useState } from 'react';
import type { Character, ResolvedSlice, WheelStep } from '../../engine/types';
import type { GenerationPhase, SessionView, Side } from '../../state/generationSession';
import { formatPercent, optionLabel } from '../format';
import { rarityStyle } from '../rarity';
import { primaryButton, secondaryButton } from '../RollReveal';
import { SpinWheel, type SpinRequest, type UpgradeRequest } from './SpinWheel';

export interface FateWheelsProps {
  view: SessionView;
  phase: GenerationPhase;
  /** The soul spinning, as they stand before this wheel: their archetype's rules decide the wheel. */
  character: Character;
  step: WheelStep | null;
  spinRequest: SpinRequest | null;
  /** A Wise soul's second wheel. */
  altSpinRequest?: SpinRequest | null;
  upgradeRequest?: UpgradeRequest | null;
  onSpin: () => void;
  onSettled: (spinId: number) => void;
  onSettledAlt?: (spinId: number) => void;
  onUpgraded?: (spinId: number) => void;
  onPick?: (side: Side) => void;
  onSmash?: (spinId: number, index: number) => void;
  onDecree?: (index: number) => void;
  label: string;
  /** How long a spin takes (a battle's rounds go faster). Default: the wheel's own. */
  spinMs?: number;
  /** The word on the hub. Default: Spin. */
  hubLabel?: string;
}

export function FateWheels(props: FateWheelsProps) {
  const { view, phase, character, step, label } = props;
  const rules = character.rules;
  const landed = phase === 'upgrading' || phase === 'revealing' || phase === 'complete';
  const [decreeing, setDecreeing] = useState(false);
  /** Where focus goes back to when a decree is called off. */
  const decreeButton = useRef<HTMLButtonElement>(null);

  // A Hero's wheel drags over the holy.
  const drag = rules?.holyPull ? view.slices.flatMap((s, i) => (s.option.holy ? [i] : [])) : undefined;

  const twinned = view.wise ?? (phase === 'ready' && rules?.rollTwice && step && !step.fixed && !step.choice ? 'ready' : null);
  if (twinned) {
    const sides: Side[] = ['left', 'right'];
    const kept = view.wise?.kept ?? null;
    return (
      <div>
        <p className="mb-3 text-center text-sm text-ash">
          <span className="text-gilt-bright">Wise:</span> two wheels, one fate.{' '}
          {phase === 'picking' ? 'Keep the one you want.' : kept ? '' : 'Spin both, then keep the one you want.'}
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {sides.map((side) => {
            const twin = twinned === 'ready' ? null : twinned[side];
            const winner = twin ? twin.slices[twin.winnerIndex] : undefined;
            const dimmed = kept !== null && kept !== side;
            return (
              <div key={side} className="flex flex-col items-center gap-3 transition-opacity duration-500" style={{ opacity: dimmed ? 0.4 : 1 }}>
                <SpinWheel
                  slices={twin?.slices ?? view.slices}
                  spin={side === 'left' ? props.spinRequest : (props.altSpinRequest ?? null)}
                  highlightIndex={twin && (phase === 'picking' || landed) ? twin.winnerIndex : null}
                  canSpin={view.canSpin}
                  onSpinRequest={props.onSpin}
                  onSettled={side === 'left' ? props.onSettled : (props.onSettledAlt ?? (() => {}))}
                  {...(props.spinMs !== undefined && { spinMs: props.spinMs })}
                  upgrade={kept === side ? props.upgradeRequest : null}
                  onUpgraded={props.onUpgraded}
                  label={`${label} (${side === 'left' ? 'first' : 'second'} wheel)`}
                  golden={step?.golden}
                  maxSize={400}
                  drag={drag}
                />
                {phase === 'picking' && winner && props.onPick && (
                  <button type="button" className={primaryButton} onClick={() => props.onPick!(side)} autoFocus={side === 'left'}>
                    Keep {optionLabel(winner.option)}
                  </button>
                )}
                {kept === side && <p className="text-sm text-gilt-bright">Kept</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const canDecree = Boolean(props.onDecree) && (character.decrees ?? 0) > 0 && phase === 'ready' && view.canSpin && !step?.choice;
  return (
    <div>
      <SpinWheel
        slices={view.slices}
        spin={props.spinRequest}
        highlightIndex={landed ? view.winnerIndex : null}
        canSpin={view.canSpin}
        onSpinRequest={props.onSpin}
        onSettled={props.onSettled}
        upgrade={props.upgradeRequest}
        onUpgraded={props.onUpgraded}
        label={label}
        {...(props.spinMs !== undefined && { spinMs: props.spinMs })}
        {...(props.hubLabel !== undefined && { hubLabel: props.hubLabel })}
        golden={step?.golden}
        {...(rules?.smash && props.onSmash && { onSmash: props.onSmash })}
        decreeing={canDecree && decreeing}
        onDecree={(index) => {
          setDecreeing(false);
          props.onDecree?.(index);
        }}
        drag={drag}
      />
      {rules?.smash && phase === 'ready' && view.canSpin && (
        <p className="mt-3 text-center text-sm text-ash">
          <span className="text-gilt-bright">Brute:</span> spin it, then hit <span className="text-vellum">Smash!</span> to stop it dead.
        </p>
      )}
      {canDecree &&
        (decreeing ? (
          <DecreeList
            slices={view.slices}
            onDecree={(index) => {
              setDecreeing(false);
              props.onDecree?.(index);
            }}
            onCancel={() => {
              setDecreeing(false);
              requestAnimationFrame(() => decreeButton.current?.focus());
            }}
          />
        ) : (
          <div className="mt-4 flex justify-center">
            <button ref={decreeButton} type="button" className={`${secondaryButton} min-h-11`} onClick={() => setDecreeing(true)}>
              Decree the result ({character.decrees} left in this life)
            </button>
          </div>
        ))}
    </div>
  );
}

/**
 * An Ancient's decree, without pointing at the wheel: every open slice as a button, its odds
 * beside it. Focus lands on the first; Escape backs out. A click on the wheel still works too.
 */
function DecreeList({ slices, onDecree, onCancel }: { slices: readonly ResolvedSlice[]; onDecree: (index: number) => void; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const open = slices.filter((s) => !s.locked && s.effectiveWeight > 0);
  useEffect(() => first.current?.focus(), []);

  return (
    <div
      role="group"
      aria-labelledby="decree-title"
      className="mt-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p id="decree-title" className="text-sm text-gilt-bright">
          Decree the result: choose a slice, here or on the wheel.
        </p>
        <button type="button" className={`${secondaryButton} min-h-11`} onClick={onCancel}>
          Not this one
        </button>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {open.map((slice, k) => (
          <li key={slice.option.id} className="min-w-0">
            <button
              ref={k === 0 ? first : undefined}
              type="button"
              onClick={() => onDecree(slice.index)}
              className="btn-plaque flex min-h-11 w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:border-gilt"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]" style={{ color: rarityStyle(slice.option).color }}>
                {optionLabel(slice.option)}
              </span>
              <span className="shrink-0 tabular-nums text-sm text-ash">{formatPercent(slice.probability)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

```
### `src/ui/wheel/SpinWheel.tsx`

```tsx
/**
 * The spinning rose window.
 *
 * It never decides anything. The engine has already picked the winner
 * (`spin.targetIndex`); this component works out a stopping angle inside that slice
 * and animates there, with a requestAnimationFrame loop that also drives the pointer tick.
 *
 * Slices are sized by base weight (`layoutSlices`), so locked options keep their room.
 * The tooltip reports the live odds the engine will actually roll with.
 *
 * Layers, back to front:
 *   rotor   – the painted canvas, Lucide icons and rarity sparkle; the only thing that rotates
 *   sheen   – a static highlight, so the glass turns under fixed "daylight"
 *   hub     – the Spin button, which stays still
 *   pointer – gilt finial at 12 o'clock that flicks as each lead line passes
 *   burst   – when a rare-or-better slice lands, light and sparks over everything (LandingBurst)
 *   bump    – after landing, banked bonuses knock the result along the ladder: an effect
 *             (upgradeEffects.ts, the hammer for now) plays, and the wheel jolts a slice per blow
 *   near    – "So close!" when the pointer stopped near the line of a far rarer slice
 *
 * Sound (sound.ts) follows the same beats: a tick per lead line, a sting on landing by rarity,
 * a clang per blow.
 *
 * Archetypes (engine/archetypes.ts) reach in three ways, all optional:
 *   smash   – a Brute's hub turns into a Smash button while the wheel spins: it stops dead, and
 *             the slice under the pointer is reported (`onSmash`) as the roll
 *   decree  – an Ancient names the result: while `decreeing`, a click on a slice is reported (`onDecree`)
 *   drag    – a Hero's wheel slows as holy slices (`drag`) pass the pointer. The result was decided
 *             before the spin; only the time spent over them grows.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { forceNextRoll } from '../../engine/roll';
import { createSeededRng } from '../../engine/rng';
import { useDevPick } from '../devPick';
import { spinDuration, useSettings } from '../settings';
import { RARITIES, type ResolvedSlice } from '../../engine/types';
import { formatPercent, optionLabel } from '../format';
import { sound } from '../sound';
import { getOptionIcon } from '../icons';
import { RARITY_STYLES, isSpecialRarity, rarityOf, rarityStyle } from '../rarity';
import { inkFor } from './color';
import { LandingBurst } from './LandingBurst';
import { upgradeEffect } from './upgradeEffects';
import { glassColor, paintWheel } from './paintWheel';
import {
  WHEEL_LAYOUT as L,
  boundaryCount,
  layoutSlices,
  nearestNeighbour,
  neighboursOf,
  polar,
  roundelPx,
  screenAngleOf,
  sliceAtScreenAngle,
  spinEase,
  targetRotation,
  type SliceArc,
} from './wheelGeometry';

export interface SpinRequest {
  /** Changes for every spin. */
  id: number;
  /** The slice the engine picked. */
  targetIndex: number;
}

/** A ladder bump to play after landing: banked bonuses moving the result (see engine/ladder.ts). */
export interface UpgradeRequest {
  /** Changes for every bump. */
  id: number;
  /** The slices the result moves through, one per blow, ending where it stays. */
  path: number[];
  /** One more blow that breaks past the top of the ladder (into Ascension). */
  overflow: boolean;
  /** 1: up. −1: knocked down. */
  direction: 1 | -1;
  /** Which effect plays it (upgradeEffects.ts); the hammer when unset or unknown. */
  effect?: string;
}

export interface SpinWheelProps {
  slices: readonly ResolvedSlice[];
  /** Set to start a spin. Must keep the same identity until the next spin. */
  spin: SpinRequest | null;
  /** Lit up after landing; every other slice dims. */
  highlightIndex: number | null;
  canSpin: boolean;
  onSpinRequest: () => void;
  /** Called once the wheel has come to rest on the target. */
  onSettled: (spinId: number) => void;
  /** Set after landing to play a ladder bump; the wheel jolts along `path` as each blow lands. */
  upgrade?: UpgradeRequest | null;
  /** Called once the bump has played. */
  onUpgraded?: (upgradeId: number) => void;
  /** Accessible name for the wheel, e.g. its title. */
  label: string;
  hubLabel?: string;
  /** How long a spin takes. Defaults to the full 5.2 s; the dev tools speed it up. */
  spinMs?: number;
  /** A golden wheel (an ascension): a gilt ring and glow around the glass. */
  golden?: boolean;
  maxSize?: number;
  fontFamily?: string;
  /** A Brute's Smash: while spinning, the hub stops the wheel dead and reports the slice under the pointer. */
  onSmash?: (spinId: number, index: number) => void;
  /** An Ancient deciding a roll: a click on an open slice is reported instead of spinning. */
  decreeing?: boolean;
  onDecree?: (index: number) => void;
  /** Slices the wheel drags over as they pass the pointer (a Hero's holy slices), by index. */
  drag?: readonly number[];
}

/** How fast a spin runs while a dragging slice is under the pointer: under half speed. */
const DRAG_RATE = 0.4;

/**
 * How near the line still counts as a near miss: within this many degrees of it, and in the outer
 * third of the landed slice (so a sliver's centre never counts).
 */
const NEAR_MISS_DEGREES = 4;
const NEAR_MISS_MARGIN = 0.34;
/** When a big prize sits right beside the result, how often the wheel stops a hair short of it. */
const TEASE_CHANCE = 0.07;
/** Dramatic speed: a spin for something great (or past it) takes this much longer, and teases more. */
const DRAMA_STRETCH = 1.8;
const DRAMA_TEASE_CHANCE = 0.45;
/** Dramatic speed's ease: most of the way fast, then a long, agonising crawl. */
const dramaEase = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 7;

/** Worth an "So close!": a slice that is open, rarer than the one landed, and legendary or better (or epic, after a common). */
function missedBig(won: ResolvedSlice, other: ResolvedSlice): boolean {
  const w = RARITIES.indexOf(rarityOf(won.option));
  const o = RARITIES.indexOf(rarityOf(other.option));
  return !other.locked && o > w && (o >= RARITIES.indexOf('legendary') || (o >= RARITIES.indexOf('epic') && w <= RARITIES.indexOf('uncommon')));
}

const SPIN_MS = 5200;
const REDUCED_SPIN_MS = 900;
const DEFAULT_FONT = '"Alegreya SC", "Alegreya", Georgia, serif';

export function SpinWheel({
  slices,
  spin,
  highlightIndex,
  canSpin,
  onSpinRequest,
  onSettled,
  upgrade = null,
  onUpgraded,
  label,
  hubLabel = 'Spin',
  spinMs = SPIN_MS,
  golden = false,
  maxSize = 560,
  fontFamily = DEFAULT_FONT,
  onSmash,
  decreeing = false,
  onDecree,
  drag,
}: SpinWheelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const spinningRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  const onUpgradedRef = useRef(onUpgraded);
  const onSmashRef = useRef(onSmash);
  /** The frame loop of the spin under way, so a Smash can stop it. */
  const rafRef = useRef(0);
  /** Set by a Smash: the spin under way stops where it is and never settles. */
  const smashedRef = useRef(false);
  const dragRef = useRef<ReadonlySet<number>>(new Set());
  const reduceMotion = useReducedMotion() ?? false;
  const { wheelSpeed } = useSettings();
  /** The last spin a Smash stopped: the wheel shakes. */
  const [smashed, setSmashed] = useState<number | null>(null);

  const [size, setSize] = useState(0);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [spinning, setSpinning] = useState(false);
  /** The last spin that came to rest: a new value replays the landing effects. */
  const [landedSpin, setLandedSpin] = useState(0);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const devPick = useDevPick();
  /** A far rarer slice the last spin stopped beside. */
  const [nearMiss, setNearMiss] = useState<{ spin: number; index: number; slice: ResolvedSlice } | null>(null);
  /** Where the current bump has knocked the result so far. */
  const [bumpedTo, setBumpedTo] = useState<{ id: number; index: number } | null>(null);
  // While a bump plays, the lit slice follows the blows; otherwise it's the caller's.
  const lit = upgrade && bumpedTo?.id === upgrade.id ? bumpedTo.index : highlightIndex;

  // Sized by base weight: the engine's effective weights never reach the geometry.
  const arcs = useMemo(() => layoutSlices(slices), [slices]);
  const arcsRef = useRef(arcs);
  const slicesRef = useRef(slices);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);
  useEffect(() => {
    onUpgradedRef.current = onUpgraded;
  }, [onUpgraded]);
  useEffect(() => {
    onSmashRef.current = onSmash;
  }, [onSmash]);
  useEffect(() => {
    dragRef.current = new Set(drag ?? []);
  }, [drag]);
  useEffect(() => {
    arcsRef.current = arcs;
    slicesRef.current = slices;
  }, [arcs, slices]);

  // Size to the container, capped.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setSize(Math.floor(Math.min(el.clientWidth, maxSize)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxSize]);

  // Repaint once web fonts arrive, so labels are measured in the real face.
  useEffect(() => {
    let alive = true;
    const bump = () => {
      if (alive) setFontEpoch((n) => n + 1);
    };
    void document.fonts.ready.then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => {
      alive = false;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);

  // Paint the static face whenever what it shows changes. Never per frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) paintWheel(ctx, { size, dpr, slices, arcs, highlightIndex: lit, fontFamily });
  }, [size, slices, arcs, lit, fontFamily, fontEpoch]);

  const applyRotation = useCallback((degrees: number) => {
    rotationRef.current = degrees;
    if (rotorRef.current) rotorRef.current.style.transform = `rotate(${degrees}deg)`;
  }, []);

  // Each new wheel starts with its first slice centred under the pointer, never on a lead line.
  // A landed wheel keeps its resting angle until a different wheel (or different slice sizes) replaces it.
  const wheelKey = slices.map((s) => `${s.option.id}:${s.option.baseWeight}`).join('|');
  const mounted = size > 0;
  useLayoutEffect(() => {
    const first = arcsRef.current.find((a) => a.sweep > 0);
    if (!mounted || spinningRef.current || !first) return;
    applyRotation(Math.round(rotationRef.current / 360) * 360 - first.center);
  }, [wheelKey, mounted, applyRotation]);

  // The spin itself: ease from the current angle to a pre-calculated stop.
  useEffect(() => {
    if (!spin) return;
    const layout = arcsRef.current;
    const arc = layout[spin.targetIndex];
    if (!arc) {
      onSettledRef.current(spin.id); // nothing to animate to; never leave the session hanging
      return;
    }
    const from = rotationRef.current;
    // Now and then, when a big prize is right next door, stop a hair short of it: a real near miss.
    const landed = slicesRef.current[spin.targetIndex];
    const sides = neighboursOf(layout, spin.targetIndex);
    const prizes = landed && sides ? (['start', 'end'] as const).filter((side) => { const other = slicesRef.current[sides[side]]; return other && missedBig(landed, other); }) : [];
    // Dramatic: landing on something great, or right beside it, slows the end to a crawl.
    const drama = wheelSpeed === 'dramatic' && !reduceMotion && (prizes.length > 0 || (landed !== undefined && RARITIES.indexOf(rarityOf(landed.option)) >= RARITIES.indexOf('epic')));
    const base = spinDuration(spinMs, wheelSpeed);
    const duration = Math.max(1, reduceMotion ? Math.min(REDUCED_SPIN_MS, base) : drama ? base * DRAMA_STRETCH : base);
    const ease = drama ? dramaEase : spinEase;
    const tease = prizes.length > 0 && Math.random() < (drama ? DRAMA_TEASE_CHANCE : TEASE_CHANCE) ? prizes[Math.floor(Math.random() * prizes.length)] : undefined;
    const to = targetRotation(from, arc, {
      turns: reduceMotion ? 1 : 5 + Math.floor(Math.random() * 3),
      offset: 0.2 + Math.random() * 0.6, // land somewhere inside the slice, never on a lead line
      ...(tease && { edge: { side: tease, degrees: 1.5 + Math.random() * 2.5 } }),
    });

    // Time runs slower while a dragging slice is under the pointer (a Hero's holy slices).
    let elapsed = 0;
    let lastFrame: number | null = null;
    let lastBoundary = boundaryCount(from, layout);
    let tickAt = Number.NEGATIVE_INFINITY;
    spinningRef.current = true;
    smashedRef.current = false;
    setSpinning(true);
    setHover(null);
    setNearMiss(null);

    const frame = (now: number) => {
      if (smashedRef.current) return;
      const dt = lastFrame === null ? 0 : now - lastFrame;
      lastFrame = now;
      const dragging = dragRef.current.size > 0 && dragRef.current.has(sliceAtScreenAngle(0, rotationRef.current, layout));
      elapsed += dragging && !reduceMotion ? dt * DRAG_RATE : dt;
      const t = elapsed / duration;
      const rotation = from + (to - from) * ease(t);
      applyRotation(rotation);

      const boundary = boundaryCount(rotation, layout);
      if (boundary !== lastBoundary) {
        lastBoundary = boundary;
        tickAt = now;
        sound.tick(Math.max(0, 1 - t));
      }
      if (pointerRef.current) {
        const kick = Math.exp(-(now - tickAt) / 90);
        pointerRef.current.style.transform = `rotate(${(-22 * kick).toFixed(2)}deg)`;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      applyRotation(to);
      if (pointerRef.current) pointerRef.current.style.transform = 'rotate(0deg)';
      spinningRef.current = false;
      setSpinning(false);
      setLandedSpin(spin.id);
      const landed = slicesRef.current[spin.targetIndex];
      if (landed) sound.land(rarityOf(landed.option));
      const near = nearestNeighbour(to, layout, spin.targetIndex);
      const beside = near ? slicesRef.current[near.index] : undefined;
      if (landed && beside && near!.degrees <= NEAR_MISS_DEGREES && near!.margin < NEAR_MISS_MARGIN && missedBig(landed, beside)) {
        setNearMiss({ spin: spin.id, index: spin.targetIndex, slice: beside });
        window.setTimeout(() => sound.nearMiss(), 450);
      }
      onSettledRef.current(spin.id);
    };
    // Instant spins land on the spot rather than waiting for a frame.
    if (duration <= 1) {
      elapsed = duration;
      frame(performance.now());
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      spinningRef.current = false;
    };
  }, [spin, reduceMotion, spinMs, wheelSpeed, applyRotation]);

  /** A blow knocks the wheel over to slice `index`: a quick, overshooting turn (a CSS transition, so it needs no frames). */
  const joltTo = useCallback(
    (index: number) => {
      const arc = arcsRef.current[index];
      const rotor = rotorRef.current;
      if (!arc || !rotor) return;
      const centred = -arc.center;
      const to = centred + 360 * Math.round((rotationRef.current - centred) / 360);
      rotor.style.transition = 'transform 280ms cubic-bezier(0.25, 1.6, 0.45, 1)';
      applyRotation(to);
      const pointer = pointerRef.current;
      if (pointer) {
        pointer.style.transition = 'transform 260ms ease-out';
        pointer.style.transform = 'rotate(-26deg)';
        window.setTimeout(() => {
          pointer.style.transform = 'rotate(0deg)';
        }, 90);
      }
      window.setTimeout(() => {
        rotor.style.transition = '';
        if (pointer) pointer.style.transition = '';
      }, 320);
    },
    [applyRotation],
  );

  // The bump: each blow lands, the wheel jolts to the next slice; then the caller is told.
  useEffect(() => {
    if (!upgrade) return;
    const fx = upgradeEffect(upgrade.effect);
    const stageMs = reduceMotion ? fx.reducedStageMs : fx.stageMs;
    const hits = upgrade.path.length + (upgrade.overflow ? 1 : 0);
    const timers = upgrade.path.map((index, k) =>
      window.setTimeout(() => {
        setBumpedTo({ id: upgrade.id, index });
        joltTo(index);
        sound.hammer(upgrade.direction === 1);
      }, (k + fx.impactAt) * stageMs),
    );
    if (upgrade.overflow) timers.push(window.setTimeout(() => sound.ascend(), (upgrade.path.length + fx.impactAt) * stageMs));
    timers.push(window.setTimeout(() => onUpgradedRef.current?.(upgrade.id), hits * stageMs + fx.settleMs));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [upgrade, reduceMotion, joltTo]);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (spinningRef.current || size === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const r = Math.hypot(dx, dy) / (size / 2);
    if (r < L.hub || r > 1) {
      setHover(null);
      return;
    }
    const index = sliceAtScreenAngle(screenAngleOf(dx, dy), rotationRef.current, arcs);
    setHover(index < 0 ? null : { index, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Dev pick mode: a click on an open slice spins the wheel and lands it there.
  const handlePick = (e: MouseEvent<HTMLDivElement>) => {
    const picking = decreeing && onDecree;
    if ((!devPick && !picking) || !canSpin || spinningRef.current || size === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const r = Math.hypot(dx, dy) / (size / 2);
    if (r < L.hub || r > 1) return;
    const index = sliceAtScreenAngle(screenAngleOf(dx, dy), rotationRef.current, arcs);
    const slice = slices[index];
    if (!slice || slice.locked || slice.effectiveWeight <= 0) return;
    if (picking) {
      onDecree(index);
      return;
    }
    forceNextRoll(slice.option.id);
    onSpinRequest();
  };

  /** A Brute's Smash: the spin stops where it is, the wheel shakes, and the slice under the pointer is the roll. */
  const smashNow = () => {
    if (!spin || !spinningRef.current || smashedRef.current) return;
    smashedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    spinningRef.current = false;
    if (pointerRef.current) pointerRef.current.style.transform = 'rotate(0deg)';
    setSpinning(false);
    setLandedSpin(spin.id);
    setSmashed(spin.id);
    sound.hammer(true);
    if (!reduceMotion) {
      frameRef.current?.animate(
        [{ transform: 'translate(0, 0)' }, { transform: 'translate(-7px, 4px) rotate(-0.6deg)' }, { transform: 'translate(6px, -3px) rotate(0.5deg)' }, { transform: 'translate(-3px, 1px)' }, { transform: 'translate(0, 0)' }],
        { duration: 280, easing: 'ease-out' },
      );
    }
    onSmashRef.current?.(spin.id, sliceAtScreenAngle(0, rotationRef.current, arcsRef.current));
  };

  // A Smash that landed on a locked slice was moved to the nearest open one: the wheel jolts there.
  useEffect(() => {
    if (smashed === null || highlightIndex === null) return;
    if (sliceAtScreenAngle(0, rotationRef.current, arcsRef.current) !== highlightIndex) joltTo(highlightIndex);
  }, [smashed, highlightIndex, joltTo]);

  const R = size / 2;
  const paintR = size / 2 - 1; // the radius paintWheel uses, so roundels and icons agree
  const hubSize = R * L.hub * 2 - 6;
  const hovered = hover ? slices[hover.index] : undefined;
  // The rarity burst waits for any bump to finish: it celebrates where the result ends up.
  const landedRarity = !upgrade && lit !== null && slices[lit] ? rarityOf(slices[lit].option) : null;
  const effect = upgrade ? upgradeEffect(upgrade.effect) : null;
  // Only while the result still sits where it landed: a bump that moved it settles the matter.
  const missed = nearMiss && !spinning && !upgrade && nearMiss.spin === landedSpin && lit === nearMiss.index ? nearMiss.slice : null;
  const hoveredArc = hover ? arcs[hover.index] : undefined;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={label}
      className="relative mx-auto w-full select-none"
      // Never taller than the screen leaves room for (a landscape phone sees the whole wheel).
      style={{ maxWidth: `min(${maxSize}px, calc(100svh - 7rem))`, height: size || undefined }}
    >
      {size > 0 && (
        <>
          {golden && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[6%] rounded-full"
              style={{ background: 'radial-gradient(closest-side, rgba(227, 194, 113, 0.5), rgba(227, 194, 113, 0) 100%)' }}
            />
          )}
          <div
            className="absolute inset-0 rounded-full"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
            onClick={handlePick}
            style={(devPick || decreeing) && canSpin && !spinning ? { cursor: 'crosshair' } : undefined}
          >
            <div ref={rotorRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
              <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
              <RaritySparkle slices={slices} arcs={arcs} size={size} highlightIndex={lit} />
              {slices.map((slice, i) => {
                const arc = arcs[i];
                const roundel = arc ? roundelPx(arc.sweep, paintR) : 0;
                if (!arc || roundel === 0) return null;
                const p = polar(R * L.roundel, arc.center);
                const iconSize = Math.max(10, roundel * 1.15);
                const Icon = slice.locked ? Lock : getOptionIcon(slice.option.icon);
                const dimmed = lit !== null && lit !== i;
                return (
                  <Icon
                    key={slice.option.id}
                    aria-hidden="true"
                    size={iconSize}
                    strokeWidth={2.25}
                    className="pointer-events-none absolute transition-opacity duration-500"
                    style={{
                      left: R + p.x - iconSize / 2,
                      top: R + p.y - iconSize / 2,
                      transform: `rotate(${arc.center}deg)`,
                      color: inkFor(glassColor(slice)).ink,
                      opacity: dimmed ? 0.35 : slice.locked ? 0.75 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 32% 24%, rgba(255, 249, 232, 0.18), rgba(255, 249, 232, 0) 46%)',
              }}
            />
            {golden && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: '0 0 0 4px #e3c271, 0 0 28px 6px rgba(227, 194, 113, 0.55)' }}
              />
            )}
          </div>

          <button
            type="button"
            data-spin-button
            onClick={onSmash && spinning ? smashNow : onSpinRequest}
            disabled={onSmash && spinning ? false : !canSpin || spinning}
            aria-label={onSmash && spinning ? 'Smash the wheel to a stop' : undefined}
            className="font-display absolute z-10 flex items-center justify-center rounded-full border-[3px] border-lead text-candle transition-[filter,color] duration-200 enabled:hover:brightness-125 disabled:cursor-not-allowed disabled:text-candle/35"
            style={{
              width: hubSize,
              height: hubSize,
              left: R - hubSize / 2,
              top: R - hubSize / 2,
              fontSize: Math.max(18, R * 0.115),
              background: 'radial-gradient(circle at 40% 32%, #c23446, var(--color-gules) 58%, #4f0d17)',
              boxShadow:
                '0 0 0 3px var(--color-gilt-deep), 0 0 0 5px var(--color-gilt-bright), 0 0 0 6px var(--color-lead), 0 6px 16px rgba(0, 0, 0, 0.6), inset 0 0 0 2px rgba(240, 205, 108, 0.6), inset 0 -8px 14px rgba(0, 0, 0, 0.4)',
              textShadow: '0 2px 0 rgba(0, 0, 0, 0.6)',
            }}
          >
            {onSmash && spinning ? 'Smash!' : hubLabel}
          </button>

          {landedRarity && isSpecialRarity(landedRarity) && <LandingBurst key={`${landedSpin}:${lit}`} rarity={landedRarity} size={size} />}
          {missed && (
            <motion.div
              key={`near-${landedSpin}`}
              role="status"
              className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
              style={{ bottom: -R * 0.04 }}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              <span className="rounded-full border-2 border-lead bg-slab px-3 py-1 text-center text-sm text-vellum shadow-lg">
                So close!{' '}
                <span className="font-semibold" style={{ color: RARITY_STYLES[rarityOf(missed.option)].color }}>
                  {optionLabel(missed.option)}
                </span>{' '}
                was right there.
              </span>
            </motion.div>
          )}
          {upgrade && effect && (
            <effect.Component
              key={upgrade.id}
              size={size}
              hits={upgrade.path.length + (upgrade.overflow ? 1 : 0)}
              overflow={upgrade.overflow}
              direction={upgrade.direction}
              stageMs={reduceMotion ? effect.reducedStageMs : effect.stageMs}
              impactAt={effect.impactAt}
            />
          )}

          <svg
            ref={pointerRef}
            aria-hidden="true"
            viewBox="0 0 40 56"
            className="pointer-events-none absolute z-20"
            style={{
              width: R * 0.15,
              height: R * 0.21,
              left: R - R * 0.075,
              top: -R * 0.05,
              transformOrigin: '50% 27%',
              filter: 'drop-shadow(0 3px 3px rgba(0, 0, 0, 0.5))',
            }}
          >
            <defs>
              <linearGradient id="wheel-pointer-gilt" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f5e0a6" />
                <stop offset="0.55" stopColor="#c9a24c" />
                <stop offset="1" stopColor="#7d5f20" />
              </linearGradient>
            </defs>
            <path
              d="M20 54 L6.5 22 A14 14 0 1 1 33.5 22 Z"
              fill="url(#wheel-pointer-gilt)"
              stroke="#3a2508"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="15" r="4.5" fill="var(--color-gules)" stroke="#3a2508" strokeWidth="1.5" />
          </svg>

          {hover && hovered && hoveredArc && (
            <SliceTooltip
              slice={hovered}
              share={hoveredArc.sweep / 360}
              left={Math.max(4, Math.min(hover.x + 14, size - 220))}
              top={Math.max(hover.y - 64, 4)}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Name, rarity and the odds the engine will actually roll with. When locks or threat
 * have moved those odds away from the slice's drawn size, the drawn size is noted too.
 */
function SliceTooltip({ slice, share, left, top }: { slice: ResolvedSlice; share: number; left: number; top: number }) {
  const rarity = rarityOf(slice.option);
  const { label, color } = RARITY_STYLES[rarity];
  const drift = Math.abs(slice.probability - share) >= 0.005;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-max max-w-60 rounded-md border-2 border-lead bg-slab-raised px-3 py-2 text-sm shadow-lg"
      style={{ left, top }}
    >
      <p className="font-semibold text-candle">{optionLabel(slice.option)}</p>
      {rarity !== 'common' && (
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </p>
      )}
      {slice.locked && <p className="text-ash">{slice.lockReason}</p>}
      <p className="text-vellum">
        {formatPercent(slice.probability)} chance
        {drift && <span className="text-ash"> · drawn at {formatPercent(share)}</span>}
      </p>
    </div>
  );
}

/**
 * Animated rarity effects, inside the rotor so they turn with the glass: stars that
 * twinkle along the gem band of rare-and-better slices, and for epic and legendary a
 * slow pulse of light behind the pane. Locked and dimmed slices stay dark.
 * Screen-blended over the canvas, so it only ever adds light.
 */
function RaritySparkle({
  slices,
  arcs,
  size,
  highlightIndex,
}: {
  slices: readonly ResolvedSlice[];
  arcs: readonly SliceArc[];
  size: number;
  highlightIndex: number | null;
}) {
  const c = size / 2;
  const R = size / 2 - 1;
  const lit = slices.flatMap((slice, i) => {
    const arc = arcs[i];
    const style = rarityStyle(slice.option);
    const dimmed = highlightIndex !== null && highlightIndex !== i;
    return arc && arc.sweep > 0 && style.sparkles > 0 && !slice.locked && !dimmed ? [{ slice, arc, style, i }] : [];
  });
  if (lit.length === 0) return null;

  const rimRadius = R * ((L.glassEdge + 1) / 2);
  const star = R * 0.03;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: 'screen' }}
    >
      <defs>
        {lit.map(({ slice, style }) => (
          <radialGradient
            key={slice.option.id}
            id={`rarity-glow-${slice.option.id}`}
            gradientUnits="userSpaceOnUse"
            cx={c}
            cy={c}
            r={R * L.glassEdge}
          >
            <stop offset={L.hub / L.glassEdge} stopColor={style.color} stopOpacity={0} />
            <stop offset={0.72} stopColor={style.color} stopOpacity={0.9} />
            <stop offset={1} stopColor={style.color} stopOpacity={0.35} />
          </radialGradient>
        ))}
      </defs>
      {lit.map(({ slice, arc, style, i }) => {
        // Stars sit on the rim band, spread evenly with a seeded jitter, clear of the gilt studs.
        const arcLength = (rimRadius * arc.sweep * Math.PI) / 180;
        const count = Math.max(1, Math.min(style.sparkles, Math.floor(arcLength / (star * 3.2))));
        const rng = createSeededRng(i * 104729 + slices.length);
        return (
          <g key={slice.option.id}>
            {style.glow > 0 && (
              <path
                d={wedge(c, R * L.glassEdge, R * L.hub, arc)}
                fill={`url(#rarity-glow-${slice.option.id})`}
                className="rarity-pulse"
                style={{ '--glow': style.glow, animationDelay: `${-rng() * 3}s` } as CSSProperties}
              />
            )}
            {Array.from({ length: count }, (_, k) => {
              const along = 0.18 + (0.64 * (k + 0.5 + (rng() - 0.5) * 0.5)) / count;
              const p = polar(rimRadius * (0.97 + rng() * 0.06), arc.start + arc.sweep * along);
              const s = star * (0.75 + rng() * 0.45);
              return (
                <path
                  key={k}
                  d={sparklePath(c + p.x, c + p.y, s)}
                  fill={k % 2 === 0 ? '#fffaf0' : style.color}
                  className="rarity-twinkle"
                  style={{ animationDelay: `${-(rng() * 2).toFixed(2)}s`, animationDuration: `${1.6 + rng() * 1.2}s` }}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** An annular wedge between two radii, as an SVG path. */
function wedge(c: number, outer: number, inner: number, arc: SliceArc): string {
  if (arc.sweep >= 359.99) {
    // A whole ring: an SVG arc can't start and end on the same point, so draw two halves each way.
    const ring = (r: number, sweepFlag: 0 | 1) =>
      `M ${c} ${c - r} A ${r} ${r} 0 1 ${sweepFlag} ${c} ${c + r} A ${r} ${r} 0 1 ${sweepFlag} ${c} ${c - r} Z`;
    return `${ring(outer, 1)} ${ring(inner, 0)}`;
  }
  const o1 = polar(outer, arc.start);
  const o2 = polar(outer, arc.end);
  const i1 = polar(inner, arc.end);
  const i2 = polar(inner, arc.start);
  const large = arc.sweep > 180 ? 1 : 0;
  return [
    `M ${c + o1.x} ${c + o1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${c + o2.x} ${c + o2.y}`,
    `L ${c + i1.x} ${c + i1.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${c + i2.x} ${c + i2.y}`,
    'Z',
  ].join(' ');
}

/** A four-pointed twinkle star centred on (x, y). */
function sparklePath(x: number, y: number, s: number): string {
  return `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;
}

```
### `src/ui/wheel/paintWheel.ts`

```ts
/**
 * Paints the static wheel face: a rose window of stained-glass panes.
 *
 * The canvas is painted once per change (slices, size, highlight, fonts), never per
 * frame. Spinning is a CSS rotation of the finished canvas, which keeps the animation
 * on the GPU and the painter simple.
 *
 * Panes are sized by the arcs it is given (`layoutSlices`: base weight, so 7% of the
 * odds is 7% of the glass). Locked slices are painted as boarded-up grey glass at the
 * size they would have had, so they never vanish into a 0° sliver.
 *
 * Rarity shows as a band of coloured enamel set into the gilt rim over each uncommon-or-better
 * pane, glowing for rare and above. The animated sparkle and pulse sit in a DOM overlay.
 */
import { createSeededRng } from '../../engine/rng';
import type { ResolvedSlice } from '../../engine/types';
import { RARITY_STYLES, isSpecialRarity, rarityOf } from '../rarity';
import { darken, inkFor, lighten, mix, withAlpha } from './color';
import { WHEEL_LAYOUT as L, roundelPx, toCanvasRadians, type SliceArc } from './wheelGeometry';

export interface PaintWheelOptions {
  /** Width and height in CSS pixels. */
  size: number;
  /** devicePixelRatio, for crisp lines on high-density screens. */
  dpr: number;
  slices: readonly ResolvedSlice[];
  /** Where each slice sits, from `layoutSlices`. Same length and order as `slices`. */
  arcs: readonly SliceArc[];
  /** The winning slice, lit up after the wheel lands. Others dim. */
  highlightIndex: number | null;
  fontFamily: string;
}

export const LEAD = '#1e1206';
export const LOCKED_GLASS = '#4a3c33';
const RIM_GOLD = '#f2d27a';
const RIM_DEEP = '#7a561a';
const GILT = '#f0cd6c';
const FALLBACK_GLASS = '#64748b';
const DIM = 'rgba(20, 8, 8, 0.6)';
const DEG = Math.PI / 180;

/** Glass colour for a slice: its config colour, or boarded-up grey when locked. */
export function glassColor(slice: ResolvedSlice): string {
  return slice.locked ? LOCKED_GLASS : (slice.option.color ?? FALLBACK_GLASS);
}

export function paintWheel(ctx: CanvasRenderingContext2D, opts: PaintWheelOptions): void {
  const { size, dpr, slices, arcs, highlightIndex, fontFamily } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (slices.length === 0) return;

  const c = size / 2;
  const R = size / 2 - 1;
  const lead = Math.max(2.5, R * 0.02);
  const isDimmed = (i: number) => highlightIndex !== null && highlightIndex !== i;
  // Zero-weight options have no pane; everything below skips them.
  const panes = slices.flatMap((slice, i) => {
    const arc = arcs[i];
    return arc && arc.sweep > 0 ? [{ slice, arc, i }] : [];
  });

  // 1. Gilded rim: a rounded moulding, bright along its crest.
  const rim = ctx.createRadialGradient(c, c, R * L.glassEdge, c, c, R);
  rim.addColorStop(0, RIM_DEEP);
  rim.addColorStop(0.4, RIM_GOLD);
  rim.addColorStop(0.62, '#c99a3a');
  rim.addColorStop(1, RIM_DEEP);
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  // 2. Glass panes.
  for (const { slice, arc, i } of panes) {
    const start = toCanvasRadians(arc.start);
    const end = toCanvasRadians(arc.end);
    const glass = glassColor(slice);

    ctx.save();
    wedgePath(ctx, c, R * L.glassEdge, start, end);
    ctx.clip();

    // Backlit glass: bright near the hub, deeper toward the rim.
    const fill = ctx.createRadialGradient(c, c, R * L.hub, c, c, R * L.glassEdge);
    fill.addColorStop(0, lighten(glass, slice.locked ? 0.08 : 0.38));
    fill.addColorStop(0.55, glass);
    fill.addColorStop(1, darken(glass, 0.38));
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);

    // The outer pane, beyond the tracery arc, is a slightly different pour of glass.
    ctx.beginPath();
    ctx.arc(c, c, R * L.glassEdge, 0, Math.PI * 2);
    ctx.arc(c, c, R * L.tracery, 0, Math.PI * 2, true);
    ctx.fillStyle = withAlpha(darken(glass, 0.5), 0.22);
    ctx.fill();

    // Uneven glass: a seeded speckle so every redraw looks identical. Density follows pane size.
    const rng = createSeededRng(i * 7919 + slices.length);
    const specks = Math.max(6, Math.round(arc.sweep * 0.78));
    for (let s = 0; s < specks; s++) {
      const r = R * (L.hub + rng() * (L.glassEdge - L.hub));
      const t = start + rng() * (end - start);
      ctx.beginPath();
      ctx.arc(c + r * Math.cos(t), c + r * Math.sin(t), 0.6 + rng() * R * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
      ctx.fill();
    }

    // Locked: boarded up with diagonal slats.
    if (slice.locked) {
      ctx.strokeStyle = 'rgba(20, 10, 6, 0.4)';
      ctx.lineWidth = Math.max(1, R * 0.008);
      const step = Math.max(6, R * 0.045);
      for (let x = -size; x < size * 2; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + size, size);
        ctx.stroke();
      }
    }

    // After landing, everything but the winner sinks into shadow.
    if (isDimmed(i)) {
      ctx.fillStyle = DIM;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();
  }

  // 3. Rarity: coloured enamel set into the gilt rim. Rare and above glow, bleeding light into the glass edge.
  for (const { slice, arc, i } of panes) {
    const rarity = rarityOf(slice.option);
    if (rarity === 'common') continue;
    const { color } = RARITY_STYLES[rarity];
    const special = isSpecialRarity(rarity) && !slice.locked;
    const start = toCanvasRadians(arc.start);
    const end = toCanvasRadians(arc.end);

    // Uncommon is a faint tint in the stone; rare and above are bright gems, so they stand out.
    const band = ctx.createRadialGradient(c, c, R * L.glassEdge, c, c, R);
    band.addColorStop(0, special ? darken(color, 0.5) : mix(color, RIM_DEEP, 0.75));
    band.addColorStop(0.45, special ? lighten(color, 0.1) : mix(color, RIM_GOLD, 0.72));
    band.addColorStop(1, special ? darken(color, 0.6) : mix(color, RIM_DEEP, 0.8));

    ctx.save();
    wedgePath(ctx, c, R, start, end, R * L.glassEdge);
    ctx.fillStyle = band;
    if (special && !isDimmed(i)) {
      ctx.shadowColor = withAlpha(color, 0.85);
      ctx.shadowBlur = R * 0.045;
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (slice.locked || isDimmed(i)) {
      ctx.fillStyle = DIM;
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Lead came: one spoke per boundary, then the tracery arc, glass edge and hub ring.
  ctx.strokeStyle = LEAD;
  ctx.lineCap = 'round';
  ctx.lineWidth = lead;
  for (const { arc } of panes) {
    const t = toCanvasRadians(arc.start);
    ctx.beginPath();
    ctx.moveTo(c + R * L.hub * Math.cos(t), c + R * L.hub * Math.sin(t));
    ctx.lineTo(c + R * L.glassEdge * Math.cos(t), c + R * L.glassEdge * Math.sin(t));
    ctx.stroke();
  }
  for (const radius of [L.tracery, L.glassEdge, L.hub]) {
    ctx.beginPath();
    ctx.arc(c, c, R * radius, 0, Math.PI * 2);
    ctx.lineWidth = radius === L.glassEdge ? lead * 1.4 : lead * 0.8;
    ctx.stroke();
  }

  // 5. Icon roundels, shrunk to fit thin panes or left out of slivers. (The icons
  //    themselves are DOM overlays, so they stay crisp Lucide SVGs.)
  for (const { slice, arc, i } of panes) {
    const rr = roundelPx(arc.sweep, R);
    if (rr === 0) continue;
    const t = toCanvasRadians(arc.center);
    const x = c + R * L.roundel * Math.cos(t);
    const y = c + R * L.roundel * Math.sin(t);
    const glass = glassColor(slice);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, lighten(glass, slice.locked ? 0.12 : 0.5));
    g.addColorStop(1, glass);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    if (isDimmed(i)) {
      ctx.fillStyle = DIM;
      ctx.fill();
    }
    ctx.lineWidth = lead * 0.8;
    ctx.strokeStyle = LEAD;
    ctx.stroke();
  }

  // 6. Labels. Across the pane when there's room (the slice under the pointer reads
  //    upright); along the centre line for panes too thin to write across. Just the
  //    name: a stat roll's number is shown in the tooltip, odds list and reveal instead.
  for (const { slice, arc, i } of panes) {
    const plan = planLabel(ctx, slice.option.label, arc, R, roundelPx(arc.sweep, R), lead, fontFamily);
    if (!plan) continue; // too thin to label at a legible size: the tooltip and odds list carry it

    const glass = glassColor(slice);
    const dimmed = isDimmed(i);
    const { ink, halo } = inkFor(dimmed ? mix(glass, '#140808', 0.6) : glass);

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(arc.center * DEG);
    ctx.font = `700 ${plan.fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, plan.fontSize * 0.22);
    ctx.globalAlpha = slice.locked ? 0.62 : dimmed ? 0.55 : 1;

    const draw = (text: string, x: number, y: number) => {
      ctx.strokeStyle = halo;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = ink;
      ctx.fillText(text, x, y);
    };
    if (plan.kind === 'across') {
      const midRadius = (R * (L.labelInner + L.labelOuter)) / 2;
      const lineHeight = plan.fontSize * 1.08;
      plan.lines.forEach((line, k) => draw(line, 0, -midRadius - ((plan.lines.length - 1) / 2 - k) * lineHeight));
    } else {
      ctx.rotate(-Math.PI / 2); // +x now runs outward along the centre line
      draw(plan.text, plan.at, 0);
    }
    ctx.restore();
  }

  // 7. The winner gets a gilt border along its lead lines.
  const won = highlightIndex !== null ? arcs[highlightIndex] : undefined;
  if (won && won.sweep > 0) {
    ctx.save();
    wedgePath(ctx, c, R * L.glassEdge, toCanvasRadians(won.start), toCanvasRadians(won.end), R * L.hub);
    ctx.lineWidth = lead * 0.75;
    ctx.strokeStyle = GILT;
    ctx.lineJoin = 'round';
    ctx.shadowColor = withAlpha(GILT, 0.8);
    ctx.shadowBlur = R * 0.05;
    ctx.stroke();
    ctx.restore();
  }

  // 8. Gilt studs on the rim, one per spoke.
  for (const { arc } of panes) {
    const t = toCanvasRadians(arc.start);
    const r = R * ((L.glassEdge + 1) / 2);
    const x = c + r * Math.cos(t);
    const y = c + r * Math.sin(t);
    const stud = ctx.createRadialGradient(x - R * 0.006, y - R * 0.006, 0, x, y, R * 0.022);
    stud.addColorStop(0, '#fff3c4');
    stud.addColorStop(0.5, '#d2a542');
    stud.addColorStop(1, '#5c4320');
    ctx.beginPath();
    ctx.arc(x, y, R * 0.019, 0, Math.PI * 2);
    ctx.fillStyle = stud;
    ctx.fill();
  }
}

/** A pie wedge (or an annular wedge when `inner` is given). */
function wedgePath(
  ctx: CanvasRenderingContext2D,
  c: number,
  outer: number,
  start: number,
  end: number,
  inner = 0,
): void {
  ctx.beginPath();
  ctx.arc(c, c, outer, start, end);
  if (inner > 0) ctx.arc(c, c, inner, end, start, true);
  else ctx.lineTo(c, c);
  ctx.closePath();
}

// ─── Labels ─────────────────────────────────────────────────────────────────

type LabelPlan =
  | { kind: 'across'; lines: string[]; fontSize: number }
  /** `at` is the distance from the centre to the middle of the text, in px. */
  | { kind: 'along'; text: string; fontSize: number; at: number };

const MIN_FONT = 9;
const largestFont = (R: number) => Math.min(17, Math.max(11, R * 0.068));

/**
 * Choose how to set a label. Labels are measured before drawing and never clipped:
 * across the pane if it fits at a comfortable size, otherwise along the centre line
 * if that reads larger, otherwise a squeezed version across, otherwise nothing.
 */
function planLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  arc: SliceArc,
  R: number,
  roundel: number,
  lead: number,
  fontFamily: string,
): LabelPlan | null {
  const half = (Math.min(arc.sweep, 180) / 2) * DEG;
  const chord = 2 * R * L.labelInner * Math.sin(half);
  const maxWidth = Math.min(chord * 0.92, R * 0.56);
  const maxSpan = R * (L.labelOuter - L.labelInner);

  const across = fitAcross(ctx, text, maxWidth, maxSpan, R, fontFamily);
  if (across && across.fontSize >= 11) return across;

  const along = fitAlong(ctx, text, half, R, roundel, lead, fontFamily);
  if (along && (!across || along.fontSize > across.fontSize)) return along;

  return across ?? squeezeAcross(ctx, text, maxWidth, fontFamily);
}

/** Up to two lines across the pane, shrinking the font until it fits. Null if nothing fits. */
function fitAcross(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSpan: number,
  R: number,
  fontFamily: string,
): LabelPlan | null {
  for (let size = largestFont(R); size >= MIN_FONT; size -= 0.5) {
    ctx.font = `700 ${size}px ${fontFamily}`;
    const lines = wrap(ctx, text, maxWidth);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (fits && lines.length <= 2 && lines.length * size * 1.08 <= maxSpan) return { kind: 'across', lines, fontSize: size };
  }
  return null;
}

/**
 * One line along the pane's centre line, reading outward. The text is pushed as far
 * out as it can go (toward the roundel, or the rim when there is none), where a thin
 * pane is widest; it must start clear of the hub and stay between the lead lines.
 */
function fitAlong(
  ctx: CanvasRenderingContext2D,
  text: string,
  half: number,
  R: number,
  roundel: number,
  lead: number,
  fontFamily: string,
): LabelPlan | null {
  const inner = R * (L.hub + 0.06);
  const outer = roundel > 0 ? R * L.roundel - roundel - lead : R * L.glassEdge - lead * 1.5;
  for (let size = largestFont(R); size >= MIN_FONT; size -= 0.5) {
    ctx.font = `700 ${size}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    const start = outer - width;
    if (start < inner) continue;
    // Half the pane's width at the text's inner end, minus half a lead line, must hold half the text.
    const room = 2 * start * Math.tan(half) - lead;
    if (room >= size * 0.95) return { kind: 'along', text, fontSize: size, at: start + width / 2 };
  }
  return null;
}

/** Last resort across: two lines at the smallest size, the second ended with an ellipsis. Null if even that overflows. */
function squeezeAcross(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontFamily: string): LabelPlan | null {
  ctx.font = `700 ${MIN_FONT}px ${fontFamily}`;
  const lines = wrap(ctx, text, maxWidth).slice(0, 2);
  let last = lines[1] ?? '';
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  if (lines.length === 2) lines[1] = `${last}…`;
  return lines.every((l) => ctx.measureText(l).width <= maxWidth) ? { kind: 'across', lines, fontSize: MIN_FONT } : null;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(attempt).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return balance(ctx, lines, maxWidth);
}

/** "Chosen of the Holy / Sword" reads worse than "Chosen of the / Holy Sword": even out two lines. */
function balance(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number): string[] {
  if (lines.length !== 2) return lines;
  const words = lines.join(' ').split(' ');
  let best = lines;
  let bestDiff = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ');
    const b = words.slice(k).join(' ');
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    if (wa > maxWidth || wb > maxWidth) continue;
    const diff = Math.abs(wa - wb);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [a, b];
    }
  }
  return best;
}

```
### `src/ui/wheel/LandingBurst.tsx`

```tsx
/**
 * The moment a rare-or-better slice lands: a ring of its rarity's light rolls out past the
 * rim and sparks fly. Epic adds sweeping rays; legendary and mythical add a flash and a
 * banner over the glass ("Legendary!"), and mythical sparks run through every colour.
 *
 * It sits over the wheel, never rotates, never takes a click, and plays once per landing
 * (remount it with a new key to play again). Reduced motion gets a still, fading glow.
 */
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RARITIES, type Rarity } from '../../engine/types';
import { RARITY_STYLES } from '../rarity';

const SPARKS: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 14, epic: 22, legendary: 32, mythical: 44 };

/** A steady pseudo-random number in [0, 1) for spark `i`, so every render agrees. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function LandingBurst({ rarity, size }: { rarity: Rarity; size: number }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { color, label } = RARITY_STYLES[rarity];
  const level = RARITIES.indexOf(rarity);
  const mythical = rarity === 'mythical';
  const R = size / 2;

  if (reduceMotion) {
    return (
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 0 4px ${color}, 0 0 40px 10px ${color}` }}
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.6 }}
      />
    );
  }

  const count = SPARKS[rarity];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      {/* Legendary and mythical: a flash of light from the centre. */}
      {level >= RARITIES.indexOf('legendary') && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(closest-side, rgba(255, 250, 235, 0.95), ${color}aa 45%, transparent 100%)` }}
          initial={{ scale: 0.3, opacity: 0.95 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}

      {/* Epic and up: rays sweeping round behind the light. */}
      {level >= RARITIES.indexOf('epic') && (
        <motion.div
          className="absolute -inset-[12%] rounded-full"
          style={{
            background: mythical
              ? 'repeating-conic-gradient(from 0deg, #ff7ad1 0deg 6deg, transparent 6deg 18deg, #7ad1ff 18deg 24deg, transparent 24deg 36deg, #ffe07a 36deg 42deg, transparent 42deg 54deg)'
              : `repeating-conic-gradient(from 0deg, ${color} 0deg 5deg, transparent 5deg 20deg)`,
            maskImage: 'radial-gradient(closest-side, transparent 30%, black 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 30%, black 55%, transparent 100%)',
            mixBlendMode: 'screen',
          }}
          initial={{ rotate: 0, opacity: 0 }}
          animate={{ rotate: 50, opacity: [0, 0.7, 0] }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        />
      )}

      {/* Every special landing: a ring of light rolling out past the rim. */}
      <motion.div
        className="absolute rounded-full border-4"
        style={{ borderColor: color, left: R - R * 0.3, top: R - R * 0.3, width: R * 0.6, height: R * 0.6, boxShadow: `0 0 24px ${color}` }}
        initial={{ scale: 1, opacity: 0.9 }}
        animate={{ scale: 4.2, opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />

      {/* Sparks flying out from the hub. */}
      {Array.from({ length: count }, (_, i) => {
        const angle = ((i + jitter(i, 1) * 0.6) / count) * Math.PI * 2;
        const distance = R * (0.75 + jitter(i, 2) * 0.55);
        const dot = 3 + jitter(i, 3) * 4;
        const spark: CSSProperties = {
          left: R - dot / 2,
          top: R - dot / 2,
          width: dot,
          height: dot,
          background: mythical ? `hsl(${(i / count) * 360} 95% 72%)` : color,
          boxShadow: `0 0 ${dot * 2}px ${mythical ? `hsl(${(i / count) * 360} 95% 72%)` : color}`,
        };
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={spark}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9 + jitter(i, 4) * 0.6, ease: 'easeOut', delay: jitter(i, 5) * 0.15 }}
          />
        );
      })}

      {/* Epic and up: the tier, over the glass. */}
      {level >= RARITIES.indexOf('epic') && (
        <motion.p
          className="font-display absolute inset-x-0 text-center font-semibold"
          style={{ top: R * 0.36, fontSize: Math.max(22, R * 0.2), color, textShadow: `0 2px 0 #0b0e16, 0 0 18px ${color}` }}
          initial={{ opacity: 0, scale: 0.6, y: 10 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.12, 1, 1], y: [10, 0, 0, -6] }}
          transition={{ duration: 2.2, times: [0, 0.18, 0.75, 1], ease: 'easeOut' }}
        >
          {label}!
        </motion.p>
      )}
    </div>
  );
}

```
### `src/ui/wheel/HammerUpgrade.tsx`

```tsx
/**
 * The hammer: a smith's hammer swings down on the rim beside the pointer, once per
 * position the result moves. Each blow throws sparks and a "+1" (or a "−1" when banked
 * bonuses knock the roll down); a break-through blow past the top of the ladder cracks
 * the glass with gold light and calls out "Ascension!".
 *
 * Timing comes from the caller: blow k lands at (k + impactAt) × stageMs, which is when
 * the wheel itself jolts to the next slice. Reduced motion keeps the labels, drops the swing.
 */
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { UpgradeEffectProps } from './upgradeEffects';

const GOLD = '#ffd76a';

/** A steady pseudo-random number in [0, 1) for spark `i`. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function HammerUpgrade({ size, hits, overflow, direction, stageMs, impactAt }: UpgradeEffectProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const R = size / 2;
  const seconds = stageMs / 1000;
  const up = direction > 0;
  // The blow lands on the rim just right of the pointer, at 12 o'clock.
  const impact = { x: R + R * 0.12, y: R * 0.06 };
  const hammer = R * 0.62; // length, head to the end of the handle

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
      {!reduceMotion && (
        // Pivots at the end of its handle, up and to the right; swings down onto the rim.
        <motion.div
          className="absolute"
          style={{
            left: impact.x - hammer * 0.13, // the head's centre comes down on the impact point
            top: impact.y - hammer * 0.12,
            width: hammer,
            height: hammer * 0.24,
            transformOrigin: '100% 50%',
          }}
          initial={{ rotate: 70, opacity: 0 }}
          animate={{ rotate: [70, 78, -4, 8, 70], opacity: [1, 1, 1, 1, 1] }}
          transition={{
            duration: seconds,
            times: [0, impactAt * 0.6, impactAt, impactAt + 0.12, 1],
            ease: 'easeInOut',
            repeat: hits - 1,
          }}
        >
          <HammerShape />
        </motion.div>
      )}

      {Array.from({ length: hits }, (_, k) => {
        const lands = (k + impactAt) * seconds;
        const breaking = overflow && k === hits - 1;
        const color = breaking ? GOLD : up ? '#ffe7a3' : '#ec7a62';
        return (
          <div key={k}>
            {/* Shockwave from the point of impact. */}
            <motion.span
              className="absolute rounded-full border-2"
              style={{ left: impact.x - 14, top: impact.y - 14, width: 28, height: 28, borderColor: color }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 3.2], opacity: [0.95, 0] }}
              transition={{ duration: 0.55, delay: lands, ease: 'easeOut' }}
            />
            {/* Sparks off the rim. */}
            {!reduceMotion &&
              Array.from({ length: 10 }, (_, i) => {
                const angle = Math.PI + (jitter(i + k * 10, 1) - 0.1) * Math.PI * 1.2; // mostly upward
                const distance = R * (0.18 + jitter(i + k * 10, 2) * 0.22);
                const dot = 2 + jitter(i + k * 10, 3) * 3;
                const spark: CSSProperties = {
                  left: impact.x - dot / 2,
                  top: impact.y - dot / 2,
                  width: dot,
                  height: dot,
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                };
                return (
                  <motion.span
                    key={i}
                    className="absolute rounded-full"
                    style={spark}
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: [1, 0] }}
                    transition={{ duration: 0.6, delay: lands, ease: 'easeOut' }}
                  />
                );
              })}
            {/* What the blow did. */}
            <motion.span
              className="font-display absolute font-semibold"
              style={{
                left: impact.x + R * 0.1,
                top: impact.y + R * 0.04,
                fontSize: Math.max(18, R * 0.13),
                color,
                textShadow: '0 2px 0 #0b0e16, 0 0 10px rgba(0, 0, 0, 0.6)',
              }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: [6, -4, -14, -22] }}
              transition={{ duration: 0.95, delay: lands, times: [0, 0.15, 0.7, 1] }}
            >
              {breaking ? '' : up ? '+1' : '−1'}
            </motion.span>
          </div>
        );
      })}

      {overflow && <BreakThrough size={size} at={(hits - 1 + impactAt) * seconds} />}
    </div>
  );
}

/** The last blow breaks past the top: cracks of gold light across the glass, and "Ascension!". */
function BreakThrough({ size, at }: { size: number; at: number }) {
  const R = size / 2;
  return (
    <>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(closest-side, rgba(255, 246, 214, 0.9), ${GOLD}88 40%, transparent 100%)` }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1.3, 1.5] }}
        transition={{ duration: 1, delay: at, ease: 'easeOut' }}
      />
      <motion.svg className="absolute inset-0" viewBox={`0 0 ${size} ${size}`} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, delay: at }}>
        {Array.from({ length: 7 }, (_, i) => {
          const angle = (i / 7) * Math.PI * 2 + jitter(i, 9);
          const mid = R * (0.45 + jitter(i, 10) * 0.2);
          const kink = angle + (jitter(i, 11) - 0.5) * 0.5;
          const d = `M ${R} ${R * 0.06} L ${R + Math.cos(kink) * mid} ${R + Math.sin(kink) * mid} L ${R + Math.cos(angle) * R * 0.95} ${R + Math.sin(angle) * R * 0.95}`;
          return <path key={i} d={d} fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${GOLD})` }} />;
        })}
      </motion.svg>
      <motion.p
        className="font-display absolute inset-x-0 text-center font-semibold"
        style={{ top: R * 0.62, fontSize: Math.max(24, R * 0.2), color: GOLD, textShadow: `0 2px 0 #0b0e16, 0 0 18px ${GOLD}` }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1] }}
        transition={{ duration: 1.6, delay: at, times: [0, 0.2, 0.75, 1] }}
      >
        Ascension!
      </motion.p>
    </>
  );
}

/** A smith's hammer, head on the left, handle running right to the pivot. */
function HammerShape() {
  return (
    <svg viewBox="0 0 100 24" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="hammer-head" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c7ccd8" />
          <stop offset="0.5" stopColor="#8a90a2" />
          <stop offset="1" stopColor="#4a4f5e" />
        </linearGradient>
        <linearGradient id="hammer-handle" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#b07a4a" />
          <stop offset="1" stopColor="#5a3a1e" />
        </linearGradient>
      </defs>
      <rect x="20" y="9" width="80" height="6" rx="3" fill="url(#hammer-handle)" stroke="#0b0e16" strokeWidth="1.5" />
      <rect x="84" y="7.5" width="14" height="9" rx="2" fill="#3a2614" stroke="#0b0e16" strokeWidth="1.2" />
      <rect x="0" y="0" width="26" height="24" rx="3" fill="url(#hammer-head)" stroke="#0b0e16" strokeWidth="2" />
      <rect x="2" y="2" width="22" height="4" rx="1.5" fill="#e3e6ee" opacity="0.55" />
      <rect x="22" y="3" width="6" height="18" rx="1.5" fill="#c9a24c" stroke="#0b0e16" strokeWidth="1.2" />
    </svg>
  );
}

```
### `src/ui/OddsList.tsx`

```tsx
/**
 * The true odds for the current wheel. Slices are drawn at their base size, so locks,
 * threat and omens can make a slice's real chance differ from how big it looks; this list
 * (like the wheel's tooltip) always shows the effective odds the engine rolls with.
 * It is also the wheel's text alternative for screen readers.
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { archetypeFactor, personalityFactor, raceFactor } from '../engine/odds';
import { activeOmens } from '../engine/roll';
import type { Character, GameConfig, Omen, ResolvedSlice, World } from '../engine/types';
import { favouredBy, formatPercent, optionLabel, unlockedBy } from './format';
import { RARITY_STYLES, rarityOf } from './rarity';
import { glassColor } from './wheel/paintWheel';

interface OddsListProps {
  slices: readonly ResolvedSlice[];
  winnerIndex: number | null;
  title: string;
  /** The wheel's id: names who bends each slice (their race, archetype, personality). */
  stepId?: string;
  config: GameConfig;
  /** Who is spinning: names the trait behind a trait-specific outcome. */
  character?: Character;
  /** The world it is spun in: names the omens bending a slice. */
  world?: World;
}

export function OddsList({ slices, winnerIndex, title, stepId, config, character, world }: OddsListProps) {
  const omens = world ? activeOmens(world) : [];
  // Likeliest first, so the list reads top-down; locked options last. A stat ladder keeps its
  // own order (best to worst), which means more than the chances do. The wheel is never re-ordered.
  const ladder = slices.some((s) => s.option.setStats !== undefined);
  const sorted = ladder ? slices : [...slices].sort((a, b) => Number(a.locked) - Number(b.locked) || b.probability - a.probability);
  return (
    <ul aria-label={`Odds on the ${title}`} className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
      {sorted.map((slice) => {
        const won = winnerIndex === slice.index;
        const rarity = rarityOf(slice.option);
        const { label, color } = RARITY_STYLES[rarity];
        return (
          <li
            key={slice.option.id}
            className={`grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-start gap-x-3 transition-opacity duration-500 ${
              winnerIndex !== null && !won ? 'opacity-75' : ''
            }`}
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-3 rounded-full border border-lead"
              style={{ background: glassColor(slice) }}
            />
            <span className="min-w-0">
              <span
                className={`flex flex-wrap items-center gap-x-1.5 ${slice.locked ? 'text-ash' : 'text-vellum'} ${won ? 'font-semibold text-candle' : ''}`}
              >
                {slice.locked && <Lock aria-hidden="true" size={13} className="shrink-0" />}
                {optionLabel(slice.option)}
                {rarity !== 'common' && (
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color }}>
                    {label}
                  </span>
                )}
              </span>
              {slice.locked && <span className="block text-sm text-ash">{slice.lockReason}</span>}
              <OptionNotes slice={slice} stepId={stepId} config={config} character={character} omens={omens} />
            </span>
            <span className={`text-sm tabular-nums ${slice.locked ? 'text-ash' : 'text-vellum'}`}>
              {slice.locked ? 'Locked' : formatPercent(slice.probability)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Thanks to Lockpicking" for a trait-specific outcome; "Likelier with high Intellect" for one that
 * favours a stat; "Ranger ×2" for one their race, archetype or personality bends; "Festival ×3" for an omen.
 */
function OptionNotes({
  slice,
  stepId,
  config,
  character,
  omens,
}: {
  slice: ResolvedSlice;
  stepId?: string;
  config: GameConfig;
  character?: Character;
  omens: readonly Omen[];
}) {
  const trait = unlockedBy(slice.option, config, character);
  const stats = favouredBy(slice.option);
  const bends: { label: string; k: number }[] = [];
  if (character && stepId) {
    const id = slice.option.id;
    const who = [
      [character.race === null ? undefined : config.races[character.race]?.name, raceFactor(stepId, id, character, config)],
      [character.archetype === null ? undefined : config.archetypes[character.archetype]?.name, archetypeFactor(stepId, id, character, config)],
      [character.personality === null ? undefined : config.personalities[character.personality]?.name, personalityFactor(stepId, id, character, config)],
    ] as const;
    for (const [label, k] of who) if (label && k !== 1) bends.push({ label, k });
  }
  for (const o of omens) {
    const k = slice.option.omenScaling?.[o.id];
    if (k !== undefined && k !== 1) bends.push({ label: o.label, k });
  }
  if (!trait && !stats && bends.length === 0) return null;
  const parts: { key: string; node: ReactNode }[] = [
    ...(trait ? [{ key: 'trait', node: <span className="text-moss">Thanks to {trait}</span> }] : []),
    ...(stats ? [{ key: 'stats', node: <span className="text-ash">Likelier with high {stats}</span> }] : []),
    ...bends.map(({ label, k }) => ({
      key: label,
      node: (
        <span className={k > 1 ? 'text-gilt-bright' : 'text-ember'}>
          {label} ×{Math.round(k * 100) / 100}
        </span>
      ),
    })),
  ];
  return (
    <span className="block text-sm">
      {parts.map(({ key, node }, i) => (
        <span key={key}>
          {i > 0 && <span className="text-ash"> · </span>}
          {node}
        </span>
      ))}
    </span>
  );
}

```
### `src/ui/CountUp.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** A number that counts to its new value instead of jumping. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (reduceMotion) {
      current.current = value;
      setShown(value);
      return;
    }
    const controls = animate(current.current, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => {
        current.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <span className={className}>{shown}</span>;
}

```
### `src/ui/motion.ts`

```ts
/** Shared framer-motion presets, so every reveal panel enters and leaves the same way. */
export const enter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.3, ease: 'easeOut' },
} as const;

/**
 * Back to the wheel after a reveal: the reveal sits below the wheel, so landing scrolls down to
 * it; moving on brings the next wheel's title back to the top of the view and puts focus on
 * Spin, so the next spin is one key away. Waits a frame for the next wheel to render.
 */
export function returnToWheel(): void {
  requestAnimationFrame(() => {
    const title = document.getElementById('wheel-title');
    if (title && title.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      title.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
    document.querySelector<HTMLButtonElement>('[data-spin-button]')?.focus({ preventScroll: true });
  });
}

```
### `src/ui/WheelTitle.tsx`

```tsx
import { useRef } from 'react';

/**
 * The wheel's title and subtitle. When the wheel changes, the new title is lettered in from
 * the left, as a scribe would gild it; the first title on screen is simply there.
 */
export function WheelTitle({ title, subtitle, className }: { title: string; subtitle?: string | undefined; className: string }) {
  const first = useRef(title);
  const changed = useRef(false);
  if (title !== first.current) changed.current = true;
  const inscribe = changed.current;
  return (
    <div key={title}>
      <h1 id="wheel-title" className={`${className} ${inscribe ? 'inscribe' : ''}`}>
        {title}
      </h1>
      {subtitle && (
        <p className={`mt-2 line-clamp-2 text-base text-ash sm:text-lg ${inscribe ? 'inscribe-after' : ''}`} title={subtitle}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

```
### `src/ui/rarity.ts`

```ts
/**
 * How each rarity tier looks. Presentation only: the engine never reads this, and a
 * tier never changes an option's odds.
 *
 * Text colours clear 4.5:1 against the slab panels (#232a3e), so they double as
 * readable labels, not just decoration.
 */
import { RARITIES, type Rarity, type WheelOption } from '../engine/types';

export interface RarityStyle {
  label: string;
  /** Chips, labels, the gem band on the wheel's rim, and the reveal's accents. */
  color: string;
  /** Twinkling stars set into the rim over this slice. 0 = none. */
  sparkles: number;
  /** Peak opacity of the light pulsing behind the glass. 0 = none. */
  glow: number;
}

export const RARITY_STYLES: Record<Rarity, RarityStyle> = {
  common: { label: 'Common', color: '#a3a9bb', sparkles: 0, glow: 0 },
  uncommon: { label: 'Uncommon', color: '#5fcf8f', sparkles: 0, glow: 0 },
  rare: { label: 'Rare', color: '#5aa9ff', sparkles: 2, glow: 0 },
  epic: { label: 'Epic', color: '#bd85ff', sparkles: 3, glow: 0.2 },
  legendary: { label: 'Legendary', color: '#ffb84d', sparkles: 4, glow: 0.34 },
  mythical: { label: 'Mythical', color: '#ff7ad1', sparkles: 6, glow: 0.48 },
};

export function rarityOf(option: Pick<WheelOption, 'rarity'> | undefined): Rarity {
  return option?.rarity ?? 'common';
}

export function rarityStyle(option: Pick<WheelOption, 'rarity'> | undefined): RarityStyle {
  return RARITY_STYLES[rarityOf(option)];
}

/**
 * A stat's standing as a tier, for the Character Card's decorations: up to Average is common,
 * Strong (13) uncommon, Mighty (16) rare, Herculean (20) epic, the top of the ladder (25) and
 * Ascension legendary, and 80 or more mythical.
 */
export function statRarity(value: number): Rarity {
  if (value >= 80) return 'mythical';
  if (value >= 25) return 'legendary';
  if (value >= 20) return 'epic';
  if (value >= 16) return 'rare';
  if (value >= 13) return 'uncommon';
  return 'common';
}

/** Rare and above get the full treatment: sparkles on the wheel and a flourish when rolled. */
export function isSpecialRarity(rarity: Rarity): boolean {
  return RARITIES.indexOf(rarity) >= RARITIES.indexOf('rare');
}

```
