/**
 * The dev tools' sandbox: any wheel, dealt to a stand-in character ("the test subject"),
 * against a copy of the world. Pure helpers over the engine; nothing here is written back.
 */
import { canAdventure, getAdventureStep } from '../engine/adventure';
import { applyEffects, createCharacter } from '../engine/character';
import { resolveNextStep } from '../engine/generation';
import { archetypeFactor, fightOdds, luckFactor, raceFactor, statFactor } from '../engine/odds';
import type { Character, GameConfig, WheelOption, WheelStep, World } from '../engine/types';
import type { WheelGroup } from './wheelCatalog';

/** A blank soul, alive so the adventure wheels treat them as a hero on the road. */
export function blankSubject(config: GameConfig, race: string | null = null, luck = 0): Character {
  return { ...createCharacter(config, { name: 'Test Subject' }), status: 'alive', race, luck };
}

/** Any character, ready to stand in: alive, whatever happened to them. */
export function asSubject(char: Character): Character {
  const { fate: _fate, ...rest } = char;
  return { ...rest, status: 'alive' };
}

/** The wheel as the subject would face it: whoever it casts in place (their outcomes, their power as the foe). */
export function labStep(config: GameConfig, stepId: string, cast: Character | null, subject: Character): WheelStep {
  return getAdventureStep(config, stepId, { cast: cast ? { stepId, character: cast } : null, character: subject });
}

/** Why an option's dealt weight differs from its base weight. Every factor is 1 when nothing applies. */
export function dealFactors(step: WheelStep, option: WheelOption, subject: Character, config: GameConfig) {
  const win = fightOdds(step, subject);
  return {
    race: raceFactor(step.id, option.id, subject, config),
    archetype: archetypeFactor(step.id, option.id, subject, config),
    luck: luckFactor(option, subject),
    stats: statFactor(option, subject),
    fight: win === null || !option.fight ? 1 : option.fight === 'win' ? win : 1 - win,
  };
}

export type NextWheel = { kind: 'step'; id: string } | { kind: 'end'; reason: string } | { kind: 'error'; message: string };

/**
 * Where an option would send the subject, following the same rules as the game: routes pick
 * for the subject as the option leaves them; an adventure road that ends takes them home.
 */
export function nextWheel(
  config: GameConfig,
  step: WheelStep,
  option: WheelOption,
  subject: Character,
  world: World,
  group: WheelGroup,
): NextWheel {
  try {
    const after = applyEffects(subject, option, step.id, config);
    if (group === 'adventure' || group === 'training') {
      if (!canAdventure(after)) return { kind: 'end', reason: 'adventure ends' };
      const next = resolveNextStep(option.nextStepId, world, after);
      return next === null ? { kind: 'end', reason: 'home' } : { kind: 'step', id: next };
    }
    const next = resolveNextStep(option.nextStepId, world, after);
    return next === null ? { kind: 'end', reason: 'named, creation ends' } : { kind: 'step', id: next };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
