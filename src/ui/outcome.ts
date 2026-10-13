/** A finished spin as the reveal reads it. Creation and adventure outcomes both fit. */
import type { LadderBump } from '../engine/ladder';
import type { Character, ResolvedSlice, RollResult, WheelStep } from '../engine/types';

export interface RevealedOutcome {
  step: WheelStep;
  roll: RollResult;
  /** The state the spin led to; its character names the trait behind a trait-specific outcome. */
  state: { currentStepId: string | null; stepsTaken: number; character?: Character };
  /** How banked bonuses moved a stat roll after it landed. The result is `roll.slices[bump.to]`. */
  bump?: LadderBump | null;
}

/** The result a spin ended on: where the wheel landed, or where banked bonuses moved it. */
export function resultOf(outcome: RevealedOutcome): ResolvedSlice {
  return outcome.bump ? (outcome.roll.slices[outcome.bump.to] ?? outcome.roll.winner) : outcome.roll.winner;
}
