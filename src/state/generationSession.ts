/**
 * The UI-side flow for a run of spins, as pure functions. Character creation and
 * adventures both use it; they differ only in the engine state they carry and how a
 * wheel id is looked up.
 *
 *   ready ──spin──▶ spinning ──settled──▶ revealing ──advance──▶ ready (next wheel)
 *                         │                      ▲            └──────▶ complete (no wheel left)
 *                         └─(a ladder bump)─▶ upgrading ──upgraded──┘
 *
 * On a stat ladder with bonuses banked, the wheel first lands where the RNG said; in
 * `upgrading` the UI plays the bump (a hammer knocking the result up a position per point),
 * then the moved result is revealed.
 *
 * The winner is decided BEFORE the wheel moves: `startSpin` receives a finished
 * outcome from the engine. The wheel animation is only presentation, and the
 * character visibly changes only after the wheel lands (`revealing`).
 *
 * Nothing here branches on wheel ids or option ids. It follows `currentStepId`.
 */
import { getStep, startGeneration, type GenerationState } from '../engine/generation';
import { dealOptions } from '../engine/odds';
import { resolveSlices } from '../engine/roll';
import type { CreateCharacterOptions } from '../engine/character';
import type { LadderBump } from '../engine/ladder';
import type { Character, GameConfig, ResolvedSlice, RollResult, WheelStep, World } from '../engine/types';

export type GenerationPhase = 'ready' | 'spinning' | 'upgrading' | 'revealing' | 'complete';

/** The engine state a session can drive: a character walking a graph of wheels. */
export interface FlowState {
  character: Character;
  /** The wheel to spin next, or null when the run is over. */
  currentStepId: string | null;
  stepsTaken: number;
}

/** One decided spin: the wheel, the roll, and the state once its winner is applied. */
export interface FlowOutcome<S extends FlowState> {
  step: WheelStep;
  roll: RollResult;
  state: S;
  /** How banked bonuses moved a ladder roll after it landed, if they did. */
  bump?: LadderBump | null;
}

export interface SpinSession<S extends FlowState> {
  phase: GenerationPhase;
  /** The last state the player has seen applied. */
  state: S;
  /** A decided spin that is animating (`spinning`) or being shown (`revealing`). */
  pending: FlowOutcome<S> | null;
  /** The most recent spin once applied; lets the finished screen keep showing the last wheel. */
  last: FlowOutcome<S> | null;
  /** Increments with every spin. The wheel uses it to tell spins apart. */
  spinCount: number;
}

export type GenerationSession = SpinSession<GenerationState>;

/** A fresh session around any flow state. */
export function createFlowSession<S extends FlowState>(state: S): SpinSession<S> {
  return { phase: state.currentStepId === null ? 'complete' : 'ready', state, pending: null, last: null, spinCount: 0 };
}

export function createSession(config: GameConfig, options?: CreateCharacterOptions): GenerationSession {
  return createFlowSession(startGeneration(config, options));
}

/** ready → spinning, with the result already known. Ignored in any other phase. */
export function startSpin<S extends FlowState>(session: SpinSession<S>, outcome: FlowOutcome<S>): SpinSession<S> {
  if (session.phase !== 'ready') return session;
  return { ...session, phase: 'spinning', pending: outcome, spinCount: session.spinCount + 1 };
}

/**
 * spinning → revealing once the wheel has stopped, or → upgrading first when banked bonuses
 * move the result. Stale ids (an old spin) are ignored.
 */
export function settleSpin<S extends FlowState>(session: SpinSession<S>, spinId: number): SpinSession<S> {
  if (session.phase !== 'spinning' || spinId !== session.spinCount) return session;
  return { ...session, phase: session.pending?.bump ? 'upgrading' : 'revealing' };
}

/** upgrading → revealing, once the bump has played. Stale ids are ignored. */
export function finishUpgrade<S extends FlowState>(session: SpinSession<S>, spinId: number): SpinSession<S> {
  if (session.phase !== 'upgrading' || spinId !== session.spinCount) return session;
  return { ...session, phase: 'revealing' };
}

/** revealing → ready on the next wheel, or → complete when the graph ends. */
export function advance<S extends FlowState>(session: SpinSession<S>): SpinSession<S> {
  if (session.phase !== 'revealing' || !session.pending) return session;
  const state = session.pending.state;
  return {
    ...session,
    phase: state.currentStepId === null ? 'complete' : 'ready',
    state,
    pending: null,
    last: session.pending,
  };
}

export interface SessionView {
  /** The wheel to draw. Null only before any spin on an empty graph. */
  step: WheelStep | null;
  /** Slices to draw. Live odds while ready; frozen at spin time while spinning/revealing. */
  slices: ResolvedSlice[];
  /**
   * The slice the wheel is heading to or has landed on; once revealed, where banked bonuses
   * moved the result (the landing is `bump.from`).
   */
  winnerIndex: number | null;
  /** How banked bonuses move (or moved) this roll. Null when they don't. */
  bump: LadderBump | null;
  /** The character as the player should see it right now. */
  character: Character;
  /** The character before the latest roll, for showing deltas. Null when nothing just changed. */
  previous: Character | null;
  /** True when at least one slice can be rolled. */
  canSpin: boolean;
}

/** Everything the creation screen needs, derived from the session plus the current world. */
export function viewSession(session: GenerationSession, config: GameConfig, world: World): SessionView {
  return viewFlow(session, config, (stepId) => getStep(config, stepId), world);
}

/** Everything a spinning screen needs. `lookupStep` turns a wheel id into the wheel to draw. */
export function viewFlow<S extends FlowState>(
  session: SpinSession<S>,
  config: GameConfig,
  lookupStep: (stepId: string) => WheelStep,
  world: World,
): SessionView {
  const { phase, state, pending, last } = session;

  if (phase === 'ready' && state.currentStepId !== null) {
    const step = lookupStep(state.currentStepId);
    // Dealt to this character first, so luck and fight odds show on the wheel before it spins.
    const slices = resolveSlices(dealOptions(step, state.character, config), world, state.character);
    return {
      step,
      slices,
      winnerIndex: null,
      bump: null,
      character: state.character,
      previous: null,
      canSpin: slices.some((s) => s.effectiveWeight > 0),
    };
  }

  const shown = pending ?? last;
  const bump = shown?.bump ?? null;
  const moved = phase === 'revealing' || phase === 'complete';
  return {
    step: shown?.step ?? null,
    slices: shown?.roll.slices ?? [],
    winnerIndex: (moved && bump ? bump.to : shown?.roll.winner.index) ?? null,
    bump,
    character: phase === 'revealing' && pending ? pending.state.character : state.character,
    previous: phase === 'revealing' ? state.character : null,
    canSpin: false,
  };
}
