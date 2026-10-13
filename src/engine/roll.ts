import { EngineError } from './errors';
import { defaultRng, type Rng } from './rng';
import type { Character, ResolvedSlice, RollResult, WheelOption, World } from './types';
import { isSingletonClaimed } from './world';

/**
 * The weight the RNG uses for an *unlocked* option.
 *
 *   effectiveWeight = baseWeight × max(0, 1 + threatScaling × world.threatLevel) × omens
 *
 * where omens is the product of `omenScaling[id]` for every omen hanging over the world.
 * Threat can fade an option to 0 but never push it negative. Non-finite results
 * (a NaN in config, say) collapse to 0 rather than poisoning the whole wheel.
 */
export function computeEffectiveWeight(option: WheelOption, world: World): number {
  const threatFactor = Math.max(0, 1 + (option.threatScaling ?? 0) * world.threatLevel);
  const weight = option.baseWeight * threatFactor * omenFactor(option, world);
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

/** Omens active this season. */
export function activeOmens(world: World): World['omens'] {
  return (world.omens ?? []).filter((o) => o.until > world.season);
}

/** How the omens over the world bend an option: 1 when none touch it. */
export function omenFactor(option: WheelOption, world: World): number {
  if (!option.omenScaling) return 1;
  return activeOmens(world).reduce((f, o) => f * Math.max(0, option.omenScaling![o.id] ?? 1), 1);
}

/**
 * Why an option cannot be rolled right now, or `null` if it can.
 *
 * Two independent gates, both of which must pass:
 *   1. Singleton gate (automatic): `claimSingleton` names a key that is already in
 *      `world.activeSingletons`. Works for any key, with no list to maintain.
 *   2. Condition gate (authored): `condition(world, char)` returned false.
 */
export function getLockReason(option: WheelOption, world: World, char: Character): string | null {
  const singletonTaken = option.claimSingleton !== undefined && isSingletonClaimed(world, option.claimSingleton);
  const conditionFailed = option.condition !== undefined && !option.condition(world, char);

  if (!singletonTaken && !conditionFailed) return null;

  const { lockedReason } = option;
  if (typeof lockedReason === 'function') return lockedReason(world, char);
  return lockedReason ?? (singletonTaken ? 'Already claimed in this world' : 'Locked');
}

/**
 * Evaluate every option on a wheel against the current world and character.
 *
 * The UI renders these slices directly: locked ones grayed out with a lock icon
 * and their `lockReason` as a tooltip. The RNG reads the exact same data, so what
 * the player sees is exactly what can be rolled.
 */
export function resolveSlices(
  options: readonly WheelOption[],
  world: World,
  char: Character,
): ResolvedSlice[] {
  const slices: ResolvedSlice[] = options.map((option, index) => {
    const lockReason = getLockReason(option, world, char);
    const locked = lockReason !== null;
    return {
      option,
      index,
      locked,
      lockReason,
      effectiveWeight: locked ? 0 : computeEffectiveWeight(option, world),
      probability: 0,
    };
  });

  const total = totalWeight(slices);
  if (total > 0) {
    for (const slice of slices) slice.probability = slice.effectiveWeight / total;
  }
  return slices;
}

/**
 * Pick a winner by weighted random draw.
 *
 * Physics plays no part in this. The result is decided here, instantly; the UI then
 * animates the wheel to land on `winner.index`. Locked options have weight 0 and
 * are skipped by the math, but they are still returned in `slices` so the wheel
 * can draw them.
 *
 * @throws EngineError('NO_ELIGIBLE_OPTIONS') when every option is locked or weightless.
 */
export function rollWeightedOption(
  options: readonly WheelOption[],
  world: World,
  char: Character,
  rng: Rng = defaultRng,
): RollResult {
  const slices = resolveSlices(options, world, char);
  const total = totalWeight(slices);

  if (total <= 0) {
    throw new EngineError(
      'NO_ELIGIBLE_OPTIONS',
      `No rollable options among [${options.map((o) => o.id).join(', ')}]. ` +
        'Every slice is locked or has zero weight. Give the wheel an always-available option.',
    );
  }

  const draw = rng();
  let remaining = draw * total;
  let winner: ResolvedSlice | undefined;

  for (const slice of slices) {
    if (slice.effectiveWeight <= 0) continue;
    // Track the last eligible slice: it doubles as the fallback if floating-point
    // rounding leaves `remaining` a hair above zero after the final slice.
    winner = slice;
    if (remaining < slice.effectiveWeight) break;
    remaining -= slice.effectiveWeight;
  }

  // Unreachable while total > 0, but it keeps the types honest without a `!`.
  if (!winner) throw new EngineError('NO_ELIGIBLE_OPTIONS', 'No eligible slice was found.');

  return { slices, winner, draw };
}

function totalWeight(slices: readonly ResolvedSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.effectiveWeight, 0);
}
