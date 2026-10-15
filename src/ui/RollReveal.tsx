/**
 * What just happened on the wheel, and what to do next.
 * Effects and the next wheel's name are read from config, never hard-coded.
 */
import { useId, useState, type CSSProperties } from 'react';
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
          <motion.div key={`reveal-${outcome.step.id}-${outcome.state.stepsTaken}`} {...enter}>
            <OutcomeCard outcome={outcome} config={config} onContinue={onContinue} finishLabel="Finish character" />
          </motion.div>
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
            {outcome.roll.draw < 0 ? `${outcome.step.title}: your choice` : `${outcome.step.title}, a ${formatOdds(probability)} chance`}
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
