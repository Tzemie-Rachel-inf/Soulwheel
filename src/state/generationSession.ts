/**
 * The UI-side flow for a run of spins, as pure functions. Character creation and
 * adventures both use it; they differ only in the engine state they carry and how a
 * wheel id is looked up.
 *
 *   ready ──spin──▶ spinning ──settled──▶ revealing ──advance──▶ ready (next wheel)
 *                         │                      ▲            └──────▶ complete (no wheel left)
 *                         └─(a ladder bump)─▶ upgrading ──upgraded──┘
 *
 * A Wise soul spins two wheels at once (`SpinSession.wise`): once both have landed the session
 * waits in `picking` until the player keeps one, then goes on as if only that one had spun.
 * A Brute's Smash ends a spin early (`smashSpin`): the wheel stops where it is, and the slice
 * under the pointer is the result.
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
import { lookupGenerationStep, startGeneration, type GenerationState } from '../engine/generation';
import { spinSalt } from '../engine/archetypes';
import { dealOptions } from '../engine/odds';
import { resolveSlices } from '../engine/roll';
import type { CreateCharacterOptions } from '../engine/character';
import type { LadderBump } from '../engine/ladder';
import type { Character, GameConfig, ResolvedSlice, RollResult, WheelStep, World } from '../engine/types';

export type GenerationPhase = 'ready' | 'spinning' | 'picking' | 'upgrading' | 'revealing' | 'complete';

/** The two wheels a Wise soul spins: left is the first roll, right the second. */
export type Side = 'left' | 'right';

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
  /** A Wise soul's second roll of the same wheel (see `SpinSession.wise`). */
  alt?: FlowOutcome<S>;
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
  /**
   * A Wise soul's two rolls, while they spin and until the next wheel: which have landed, and
   * which one the player kept (then `pending` is that one).
   */
  wise?: { left: FlowOutcome<S>; right: FlowOutcome<S>; landed: Record<Side, boolean>; kept: Side | null };
}

export type GenerationSession = SpinSession<GenerationState>;

/** A fresh session around any flow state. */
export function createFlowSession<S extends FlowState>(state: S): SpinSession<S> {
  return { phase: state.currentStepId === null ? 'complete' : 'ready', state, pending: null, last: null, spinCount: 0 };
}

export function createSession(config: GameConfig, options?: CreateCharacterOptions): GenerationSession {
  return createFlowSession(startGeneration(config, options));
}

/** ready → spinning, with the result already known (both results, for a Wise soul). Ignored in any other phase. */
export function startSpin<S extends FlowState>(session: SpinSession<S>, outcome: FlowOutcome<S>): SpinSession<S> {
  if (session.phase !== 'ready') return session;
  const { alt, ...left } = outcome;
  const { wise: _done, ...rest } = session;
  return {
    ...rest,
    phase: 'spinning',
    pending: alt ? left : outcome,
    spinCount: session.spinCount + 1,
    ...(alt && { wise: { left, right: alt, landed: { left: false, right: false }, kept: null } }),
  };
}

/** Where a decided result goes once it is shown: the bump first, if banked bonuses move it. */
const onLanding = (outcome: FlowOutcome<FlowState> | null): GenerationPhase => (outcome?.bump ? 'upgrading' : 'revealing');

/**
 * spinning → revealing once the wheel has stopped, or → upgrading first when banked bonuses
 * move the result. A Wise soul's two wheels each settle (`side`); once both have, → picking.
 * Stale ids (an old spin) are ignored.
 */
export function settleSpin<S extends FlowState>(session: SpinSession<S>, spinId: number, side: Side = 'left'): SpinSession<S> {
  if (session.phase !== 'spinning' || spinId !== session.spinCount) return session;
  const { wise } = session;
  if (!wise) return { ...session, phase: onLanding(session.pending) };
  const landed = { ...wise.landed, [side]: true };
  return { ...session, phase: landed.left && landed.right ? 'picking' : 'spinning', wise: { ...wise, landed } };
}

/** picking → revealing (or upgrading): the Wise soul keeps one of their two rolls. Ignored in any other phase. */
export function pickSpin<S extends FlowState>(session: SpinSession<S>, side: Side): SpinSession<S> {
  if (session.phase !== 'picking' || !session.wise) return session;
  const pending = session.wise[side];
  return { ...session, phase: onLanding(pending), pending, wise: { ...session.wise, kept: side } };
}

/**
 * spinning → revealing (or upgrading) at once: a Brute's Smash stopped the wheel, and `outcome` is
 * the roll decided where it stopped. Stale ids are ignored.
 */
export function smashSpin<S extends FlowState>(session: SpinSession<S>, spinId: number, outcome: FlowOutcome<S>): SpinSession<S> {
  if (session.phase !== 'spinning' || spinId !== session.spinCount || session.wise) return session;
  return { ...session, phase: onLanding(outcome), pending: outcome };
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
  const { wise: _done, ...rest } = session;
  return {
    ...rest,
    phase: state.currentStepId === null ? 'complete' : 'ready',
    state,
    pending: null,
    last: session.pending,
  };
}

/** One of a Wise soul's two wheels, as drawn: its roll, and where it landed (or where the bump moved it, once kept). */
export interface TwinWheel {
  slices: ResolvedSlice[];
  winnerIndex: number;
  bump: LadderBump | null;
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
  /** A Wise soul's two wheels, while they spin and until the next wheel; which one was kept. */
  wise?: { left: TwinWheel; right: TwinWheel; kept: Side | null };
}

/** Everything the creation screen needs, derived from the session plus the current world. */
export function viewSession(session: GenerationSession, config: GameConfig, world: World): SessionView {
  // As this soul faces it: a Martial soul's spell wheels are training, a Gambler's coin names its stake.
  return viewFlow(session, config, (stepId) => lookupGenerationStep(config, stepId, session.state.character), world);
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
    // Dealt exactly as the spin will deal it (a Broken soul's cracks depend on the spin).
    const dealt = dealOptions(step, state.character, config, { world, salt: spinSalt(state.character, state.stepsTaken) });
    const slices = resolveSlices(dealt, world, state.character);
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
  const twin = (side: Side): TwinWheel => {
    const o = session.wise![side];
    const kept = session.wise!.kept === side && moved;
    return { slices: o.roll.slices, winnerIndex: kept && o.bump ? o.bump.to : o.roll.winner.index, bump: o.bump ?? null };
  };
  return {
    ...(session.wise && { wise: { left: twin('left'), right: twin('right'), kept: session.wise.kept } }),
    step: shown?.step ?? null,
    slices: shown?.roll.slices ?? [],
    winnerIndex: (moved && bump ? bump.to : shown?.roll.winner.index) ?? null,
    bump,
    character: phase === 'revealing' && pending ? pending.state.character : state.character,
    previous: phase === 'revealing' ? state.character : null,
    canSpin: false,
  };
}
