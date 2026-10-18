/**
 * The generation loop: the only flow control in character creation, and it holds no
 * content-specific branching at all.
 *
 *   deal → spin → apply modifiers → load the next step → repeat until it is null
 *
 * Which wheel comes next is decided entirely by the winning option's `nextStepId`
 * (or, for a `StepRoute`, by the character the option has just produced).
 *
 * How the UI drives it, one spin at a time:
 *   1. outcome = spinCurrentStep(state, config, world, rng)   // winner decided instantly
 *   2. animate the wheel to outcome.roll.winner.index
 *   3. when the animation ends: setState(outcome.state)       // reveal effects, load next wheel
 *
 * The World is read-only during generation. Nothing about the rolling character
 * touches it until `commitCharacter` (see world.ts).
 */
import { nearestOpen, preferOutcome, settleStake, spinSalt, stakeOf, substituteStep } from './archetypes';
import { applyOption, createCharacter, nameCharacter, type CreateCharacterOptions } from './character';
import { EngineError } from './errors';
import { chooseGear, offerIsBetter, pendingOffer } from './gear';
import { GEAR_STEP_ID, createGearStep, isGearStep } from './gearStep';
import { bumpLadder, ladderStat, type LadderBump } from './ladder';
import { dealOptions } from './odds';
import { defaultRng, type Rng } from './rng';
import { resolveSlices, rollWeightedOption } from './roll';
import type { Character, GameConfig, ResolvedSlice, RollRecord, RollResult, WheelOption, WheelStep, World } from './types';

/** Safety valve for graphs that loop (e.g. a "spin again" option). Nested ancestry detours run long. */
export const MAX_GENERATION_STEPS = 96;

export interface GenerationState {
  character: Character;
  /** The wheel to spin next, or null when generation is finished. */
  currentStepId: string | null;
  stepsTaken: number;
  /**
   * During a ladder's overflow detour (Ascension), where creation picks up once that wheel
   * is done: a wheel id, or null to finish. Absent otherwise.
   */
  resume?: string | null;
  /** While a found item waits on Keep or Take (`GEAR_STEP_ID`): where creation goes once it is decided. */
  gearChoice?: { then: string | null };
}

export interface SpinOutcome {
  /** The wheel that was spun. */
  step: WheelStep;
  /** All slices plus the pre-calculated winner. */
  roll: RollResult;
  /** The state after applying the winner. Commit it once the animation lands. */
  state: GenerationState;
  /**
   * On a stat ladder with bonuses banked: how they moved the result after it landed. The
   * applied result is `roll.slices[bump.to]`, not the winner. Null when nothing moved.
   */
  bump: LadderBump | null;
  /** A Wise soul's second roll of the same wheel, resolved from the same state. The player keeps one. */
  alt?: SpinOutcome;
}

export function startGeneration(config: GameConfig, options?: CreateCharacterOptions): GenerationState {
  return { character: createCharacter(config, options), currentStepId: config.entryStepId, stepsTaken: 0 };
}

export function isGenerationComplete(state: GenerationState): boolean {
  return state.currentStepId === null;
}

/** Look up a wheel by id, failing loudly on a broken link. */
export function getStep(config: GameConfig, stepId: string): WheelStep {
  const step = config.steps[stepId];
  if (!step) throw new EngineError('UNKNOWN_STEP', `No wheel with id "${stepId}".`);
  return step;
}

/**
 * Where an option leads, for the character it has just produced. A plain id or null is
 * returned as is; a route picks.
 *
 * @throws EngineError('UNKNOWN_STEP') if a route picks a wheel outside its `among` list.
 */
export function resolveNextStep(next: WheelOption['nextStepId'], world: World, char: Character): string | null {
  if (next === null || typeof next === 'string') return next;
  const picked = next.pick(world, char);
  if (picked !== null && !next.among.includes(picked)) {
    throw new EngineError('UNKNOWN_STEP', `A route picked "${picked}", which is not among [${next.among.join(', ')}].`);
  }
  return picked;
}

/** How a roll was decided when it wasn't simply spun: smashed to a stop (Brute) or decreed (Ancient). */
export type Decision = 'smash' | 'decree';

/**
 * The `draw` a decided roll carries instead of a random number, so a reveal can say how it was
 * decided: -1 is a choice wheel's decision, -2 a Smash, -3 a decree.
 */
export const DECIDED_DRAW: Record<Decision, number> = { smash: -2, decree: -3 };

/** The wheel creation is on, as this soul faces it (a Martial soul's spell wheels are training). */
export function currentGenerationStep(state: GenerationState, config: GameConfig): WheelStep {
  if (state.currentStepId === null) {
    throw new EngineError('GENERATION_COMPLETE', 'This character has no wheels left to spin.');
  }
  if (state.stepsTaken >= MAX_GENERATION_STEPS) {
    throw new EngineError(
      'STEP_LIMIT',
      `Generation exceeded ${MAX_GENERATION_STEPS} spins. Check the wheel graph for an unintended loop.`,
    );
  }
  return lookupGenerationStep(config, state.currentStepId, state.character);
}

/** A creation wheel by id, as this soul faces it: the Keep / Take choice is built on the spot. */
export function lookupGenerationStep(config: GameConfig, stepId: string, char: Character): WheelStep {
  if (isGearStep(stepId)) return createGearStep(config, char);
  return substituteStep(config, getStep(config, stepId), char);
}

/** The current wheel's options, dealt to this soul in this world: exactly what a spin rolls on. */
export function dealCurrentStep(state: GenerationState, config: GameConfig, world: World): { step: WheelStep; options: WheelOption[] } {
  const step = currentGenerationStep(state, config);
  return { step, options: dealOptions(step, state.character, config, { world, salt: spinSalt(state.character, state.stepsTaken) }) };
}

/**
 * Spin the current wheel once. Pure: the input state is left untouched.
 *
 * A Wise soul spins it twice: the outcome carries the second roll as `alt`, and the player keeps
 * one (`pickOutcome`). Headless runs keep the better (`autoPick`).
 */
export function spinCurrentStep(
  state: GenerationState,
  config: GameConfig,
  world: World,
  rng: Rng = defaultRng,
): SpinOutcome {
  // Keep or Take is never spun: left to themselves, they take whichever is better.
  if (state.currentStepId !== null && isGearStep(state.currentStepId)) {
    const offer = pendingOffer(state.character);
    return chooseCurrentStep(state, config, world, offer && offerIsBetter(state.character, offer, config) ? 'take' : 'keep', rng);
  }
  const { step, options } = dealCurrentStep(state, config, world);
  const roll = rollWeightedOption(options, world, state.character, rng);
  const outcome = resolveGenerationRoll(state, config, world, rng, step, roll);
  if (!state.character.rules?.rollTwice || step.fixed) return outcome;
  const second = rollWeightedOption(options, world, state.character, rng);
  return { ...outcome, alt: resolveGenerationRoll(state, config, world, rng, step, second, 'wise') };
}

/**
 * A decision on a choice wheel (creation has one: Keep or Take, for an item found while that
 * slot is filled). The next offer, if another waits, comes up next; else creation goes on. Pure.
 *
 * @throws EngineError('INVALID_CHOICE') off a choice wheel, or for an option it doesn't have.
 */
export function chooseCurrentStep(state: GenerationState, config: GameConfig, world: World, optionId: string, rng: Rng = defaultRng): SpinOutcome {
  const step = currentGenerationStep(state, config);
  if (!isGearStep(step.id)) throw new EngineError('INVALID_CHOICE', `"${step.title}" is not a choice.`);
  const slices = resolveSlices(step.options, world, state.character);
  const winner = slices.find((s) => s.option.id === optionId);
  if (!winner) throw new EngineError('INVALID_CHOICE', `"${step.title}" has no option "${optionId}".`);
  const { character } = chooseGear(state.character, optionId === 'take', config);
  const roll = { slices, winner, draw: -1 };
  if (pendingOffer(character)) {
    return { step, roll, bump: null, state: { ...state, character, stepsTaken: state.stepsTaken + 1 } };
  }
  const { gearChoice, ...rest } = state;
  return { step, roll, bump: null, state: onward(rest, config, world, rng, step, character, gearChoice?.then ?? null, false) };
}

/**
 * A roll decided rather than spun: a Brute's Smash (the slice under the pointer, or the nearest
 * open one) or an Ancient's decree (which spends one, and must name an open slice). Pure.
 *
 * @throws EngineError('INVALID_CHOICE') for a decree with none left, or on a slice that can't be rolled.
 */
export function decideCurrentStep(
  state: GenerationState,
  config: GameConfig,
  world: World,
  index: number,
  how: Decision,
  rng: Rng = defaultRng,
): SpinOutcome {
  const { step, options } = dealCurrentStep(state, config, world);
  const slices = resolveSlices(options, world, state.character);
  const { character, winner } = decided(state.character, slices, index, how);
  return resolveGenerationRoll({ ...state, character }, config, world, rng, step, { slices, winner, draw: DECIDED_DRAW[how] }, how);
}

/** The slice a decision lands on, and the soul once it has spent a decree on it. Shared with adventures. */
export function decided(char: Character, slices: readonly ResolvedSlice[], index: number, how: Decision): { character: Character; winner: ResolvedSlice } {
  if (how === 'decree') {
    const winner = slices[index];
    if ((char.decrees ?? 0) <= 0) throw new EngineError('INVALID_CHOICE', 'No decrees left.');
    if (!winner || winner.effectiveWeight <= 0) throw new EngineError('INVALID_CHOICE', 'That slice cannot be decreed.');
    return { character: { ...char, decrees: (char.decrees ?? 0) - 1 }, winner };
  }
  return { character: char, winner: slices[nearestOpen(slices, index)]! };
}

/** A Wise outcome's two rolls, as the player keeps one: `second` true keeps the second. */
export function pickOutcome<O extends { alt?: O }>(outcome: O, second: boolean): O {
  const { alt, ...first } = outcome;
  return (second && alt ? alt : first) as O;
}

/** A Wise soul left to themselves keeps whichever result leaves them stronger. */
export function autoPick<O extends { alt?: O; roll: RollResult; state: { character: Character } }>(outcome: O): O {
  if (!outcome.alt) return outcome;
  const a = { roll: outcome.roll, character: outcome.state.character };
  const b = { roll: outcome.alt.roll, character: outcome.alt.state.character };
  return pickOutcome(outcome, preferOutcome(a, b));
}

/** Apply a decided roll to creation: effects, the bump, the archetype's detours, and where it leads. Pure. */
function resolveGenerationRoll(
  state: GenerationState,
  config: GameConfig,
  world: World,
  rng: Rng,
  step: WheelStep,
  roll: RollResult,
  how?: RollRecord['how'],
): SpinOutcome {
  const before = state.character;
  const rules = before.rules;
  const record = (extra?: Partial<RollRecord>) => (how || extra ? { ...extra, ...(how && { how }) } : undefined);

  // The Gambler's coin lands: the stake doubles or is lost, and creation goes where it was going.
  if (roll.winner.option.gamble && before.stake) {
    const landed = applyOption(before, roll.winner, step.id, config, record());
    const { stake: _spent, ...character } = settleStake(landed, before.stake.gains, roll.winner.option.gamble, config);
    return { step, roll, bump: null, state: onward(state, config, world, rng, step, character, before.stake.then, false) };
  }

  // Banked bonuses move a stat roll after it lands; the history keeps where it landed.
  const bump = bumpLadder(step, roll.slices, roll.winner.index, state.character);
  const result = bump ? roll.slices[bump.to]! : roll.winner;
  let applied = applyOption(
    state.character,
    result,
    step.id,
    config,
    record(bump ? { probability: roll.winner.probability, bumpedFrom: roll.winner.option.id } : undefined),
  );
  // An All-Rounder's first stat roll is every stat's.
  const stat = step.ladder ? ladderStat(step) : undefined;
  if (rules?.uniformStats && stat !== undefined && applied.uniformStat === undefined && result.option.setStats?.[stat] !== undefined) {
    applied = { ...applied, uniformStat: applied.stats[stat] };
  }

  const next = onward(state, config, world, rng, step, applied, resolveNextStep(result.option.nextStepId, world, applied), bump?.overflow ?? false);
  // A Gambler bets what this roll gained, before going on.
  const gamble = rules?.gamble;
  const stake = gamble && !step.fixed && config.steps[gamble] ? stakeOf(before, applied, result.option) : null;
  if (stake && gamble) {
    // Named too early if this was the last wheel: the name waits until the coin has landed.
    const character = { ...next.character, name: before.name, title: before.title, stake: { gains: stake, then: next.currentStepId } };
    return { step, roll, bump, state: { ...next, character, currentStepId: gamble } };
  }
  return { step, roll, bump, state: next };
}

/**
 * Where creation goes after a roll: the overflow detour (Ascension) and its way back, the stat
 * wheels the archetype rolls for them, and the name once nothing is left.
 */
function onward(
  state: GenerationState,
  config: GameConfig,
  world: World,
  rng: Rng,
  step: WheelStep,
  applied: Character,
  onwardId: string | null,
  overflow: boolean,
): GenerationState {
  let character = applied;
  // Already on the way to Keep or Take (a Gambler's coin went first): it still comes up next.
  if (onwardId !== null && isGearStep(onwardId)) {
    return { character, currentStepId: onwardId, stepsTaken: state.stepsTaken + 1, ...(state.resume !== undefined && { resume: state.resume }), ...(state.gearChoice && { gearChoice: state.gearChoice }) };
  }
  let next = onwardId;
  let resume = state.resume;
  if (overflow) {
    next = step.overflow!; // past the top of the ladder: Ascension first, then on as planned
    resume = onwardId;
  }
  for (let guard = 0; guard < MAX_GENERATION_STEPS; guard++) {
    if (next === null && resume !== undefined) {
      next = resume; // the detour is over
      resume = undefined;
    }
    const skipped = next === null ? null : skipStatWheel(config, world, character, next);
    if (!skipped) break;
    character = skipped.character;
    next = skipped.next;
  }
  // An item found for a filled slot: Keep or Take, as on the road, before anything else. They are named after it.
  if (pendingOffer(character)) {
    return { character, currentStepId: GEAR_STEP_ID, stepsTaken: state.stepsTaken + 1, gearChoice: { then: next }, ...(resume !== undefined && { resume }) };
  }
  // The last wheel names them, from everything they rolled.
  if (next === null) character = nameCharacter(config, character, rng);
  return {
    character,
    currentStepId: next,
    stepsTaken: state.stepsTaken + 1,
    ...(resume !== undefined && { resume }),
  };
}

/**
 * A stat wheel the soul's archetype rolls for them: a stat it holds fixed (a Martial soul's Arcana),
 * or, for an All-Rounder, every stat after the first, which takes the first's value plus its own
 * bank. The position at that value is applied as if rolled, so a title or a spell it brings still
 * comes. Null when the wheel is spun as usual. Creation's stat wheels only (they have an Ascension).
 */
function skipStatWheel(config: GameConfig, world: World, char: Character, stepId: string): { character: Character; next: string | null } | null {
  const step = config.steps[stepId];
  const stat = step?.ladder && step.overflow !== undefined ? ladderStat(step) : undefined;
  if (!step || stat === undefined) return null;
  const fixed = char.rules?.fixedStats?.[stat];
  if (fixed !== undefined) {
    const character = { ...char, stats: { ...char.stats, [stat]: fixed }, statBonus: { ...char.statBonus, [stat]: 0 } };
    return { character, next: resolveNextStep(step.options[0]!.nextStepId, world, character) };
  }
  if (!char.rules?.uniformStats || char.uniformStat === undefined) return null;
  const target = Math.max(1, char.uniformStat + Math.trunc(char.statBonus[stat]));
  const rungs = resolveSlices(step.options, world, char).filter((s) => s.option.setStats?.[stat] !== undefined);
  if (rungs.length === 0) return null;
  const gap = (s: ResolvedSlice) => Math.abs(s.option.setStats![stat]! - target);
  const rung = rungs.reduce((best, s) => (gap(s) < gap(best) ? s : best));
  const applied = applyOption(char, rung, step.id, config);
  const character = { ...applied, stats: { ...applied.stats, [stat]: target } };
  return { character, next: resolveNextStep(rung.option.nextStepId, world, character) };
}

/**
 * Run the whole loop headlessly. For auto-roll buttons, tests and balance simulations.
 * The returned character is still `rolling`; pass it to `commitCharacter` to place it in the world.
 */
export function rollFullCharacter(
  config: GameConfig,
  world: World,
  rng: Rng = defaultRng,
  options: Omit<CreateCharacterOptions, 'rng'> = {},
): { character: Character; spins: SpinOutcome[] } {
  let state = startGeneration(config, { ...options, rng });
  const spins: SpinOutcome[] = [];

  while (!isGenerationComplete(state)) {
    const outcome = autoPick(spinCurrentStep(state, config, world, rng));
    spins.push(outcome);
    state = outcome.state;
  }

  return { character: state.character, spins };
}
