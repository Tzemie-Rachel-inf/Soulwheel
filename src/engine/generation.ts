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
import { applyOption, createCharacter, nameCharacter, type CreateCharacterOptions } from './character';
import { EngineError } from './errors';
import { bumpLadder, type LadderBump } from './ladder';
import { dealOptions } from './odds';
import { defaultRng, type Rng } from './rng';
import { rollWeightedOption } from './roll';
import type { Character, GameConfig, RollResult, WheelOption, WheelStep, World } from './types';

/** Safety valve for graphs that loop (e.g. a "spin again" option). */
export const MAX_GENERATION_STEPS = 64;

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

/** Spin the current wheel once. Pure: the input state is left untouched. */
export function spinCurrentStep(
  state: GenerationState,
  config: GameConfig,
  world: World,
  rng: Rng = defaultRng,
): SpinOutcome {
  if (state.currentStepId === null) {
    throw new EngineError('GENERATION_COMPLETE', 'This character has no wheels left to spin.');
  }
  if (state.stepsTaken >= MAX_GENERATION_STEPS) {
    throw new EngineError(
      'STEP_LIMIT',
      `Generation exceeded ${MAX_GENERATION_STEPS} spins. Check the wheel graph for an unintended loop.`,
    );
  }

  const step = getStep(config, state.currentStepId);
  const roll = rollWeightedOption(dealOptions(step, state.character, config), world, state.character, rng);

  // Banked bonuses move a stat roll after it lands; the history keeps where it landed.
  const bump = bumpLadder(step, roll.slices, roll.winner.index, state.character);
  const result = bump ? roll.slices[bump.to]! : roll.winner;
  const applied = applyOption(
    state.character,
    result,
    step.id,
    config,
    bump ? { probability: roll.winner.probability, bumpedFrom: roll.winner.option.id } : undefined,
  );

  const onward = resolveNextStep(result.option.nextStepId, world, applied);
  let next = onward;
  let resume = state.resume;
  if (bump?.overflow) {
    next = step.overflow!; // past the top of the ladder: Ascension first, then on as planned
    resume = onward;
  } else if (onward === null && resume !== undefined) {
    next = resume; // the detour is over
    resume = undefined;
  }
  // The last wheel names them, from everything they rolled.
  const character = next === null ? nameCharacter(config, applied, rng) : applied;

  return {
    step,
    roll,
    bump,
    state: {
      character,
      currentStepId: next,
      stepsTaken: state.stepsTaken + 1,
      ...(resume !== undefined && { resume }),
    },
  };
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
    const outcome = spinCurrentStep(state, config, world, rng);
    spins.push(outcome);
    state = outcome.state;
  }

  return { character: state.character, spins };
}
