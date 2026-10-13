/**
 * Ladder bumps: banked bonuses move a stat roll up (or down) its ladder.
 *
 * A ladder wheel (`WheelStep.ladder`) lists one stat's positions, best first. The wheel is
 * rolled on its plain values, exactly as drawn; then the character's banked bonus for that
 * stat (`Character.statBonus`) moves the result one position per point: +2 on a landing at
 * Average gives the position two better. A push past the best position goes to the wheel's
 * `overflow` wheel (Ascension) if it has one; past the worst, the result simply stops there.
 *
 * The RNG never sees any of this: roll.ts picks the landing, and this moves it afterwards.
 */
import type { Character, ResolvedSlice, StatKey, WheelStep } from './types';

export interface LadderBump {
  stat: StatKey;
  /** Where the wheel landed (an index into the rolled slices). */
  from: number;
  /** Where the bonus moved the result. */
  to: number;
  /** Every position the result moves through, in order, ending at `to`: one per stage. */
  path: number[];
  /** Positions moved: positive up, negative down. */
  stages: number;
  /** The bonus pushed past the best position: the wheel's `overflow` wheel is spun next. */
  overflow: boolean;
}

/** The stat a ladder wheel rolls: the one its options set. */
export function ladderStat(step: WheelStep): StatKey | undefined {
  const option = step.options.find((o) => o.setStats && Object.keys(o.setStats).length === 1);
  return option ? (Object.keys(option.setStats!)[0] as StatKey) : undefined;
}

/**
 * How the character's banked bonus moves a ladder roll that landed on `landed`. Null when
 * nothing moves: not a ladder, no bonus banked, a landing off the ladder (an extra option
 * such as Small Gains), or a negative bonus on the worst position.
 */
export function bumpLadder(step: WheelStep, slices: readonly ResolvedSlice[], landed: number, char: Character): LadderBump | null {
  if (!step.ladder) return null;
  const stat = ladderStat(step);
  if (!stat) return null;
  const bonus = Math.trunc(char.statBonus[stat]);
  if (bonus === 0) return null;

  const rungs = slices.flatMap((s, i) => (s.option.setStats?.[stat] !== undefined ? [i] : [])); // best first
  let at = rungs.indexOf(landed);
  if (at < 0) return null;

  const path: number[] = [];
  let overflow = false;
  for (let n = 0; n < Math.abs(bonus); n++) {
    if (bonus > 0 && at === 0) {
      overflow = step.overflow !== undefined;
      break;
    }
    if (bonus < 0 && at === rungs.length - 1) break;
    at += bonus > 0 ? -1 : 1;
    path.push(rungs[at]!);
  }
  if (path.length === 0 && !overflow) return null;
  return { stat, from: landed, to: path.at(-1) ?? landed, path, stages: Math.sign(bonus) * path.length, overflow };
}
