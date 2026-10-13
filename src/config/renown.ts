/**
 * Renown: the fame tiers, and how much fame each adventure roll earns.
 *
 *   a fight won    the foe's power ÷ 25, ×2 for glory, ×1.5 for a win only some heroes have
 *   a fight lost   nothing (surviving is its own reward)
 *   a road's end   by rarity: a common outcome 2, a rare one 8, a mythical one 30
 *   along the way  nothing: the wheel that leads to a fight or a lair earns no fame itself
 *   coming home    at least 1 for the whole adventure (`floor`), so no season is wasted
 *
 * Options can set their own `fame` (a bard's song, a grave robbed). Fame unlocks the
 * crossroads' Destiny (Renowned) and Legendary Challenges (Famous), and `fameScaling` makes
 * the famous take riskier roads.
 */
import { fameStanding } from '../engine/fame';
import type { Character, FameConfig, FameTier, Rarity, WheelOption, World } from '../engine/types';

/** At 3 or 4 fame a road, a hero is usually Renowned after about 5 adventures, Famous after 9, Legendary after 15. */
export const FAME_TIERS: FameTier[] = [
  { name: 'Unknown', min: 0, description: 'Nobody has heard of them. Yet.' },
  { name: 'Known', min: 6, description: 'A name in a few taverns.' },
  { name: 'Renowned', min: 15, description: 'Bards want the details. Destiny starts to call.' },
  { name: 'Famous', min: 32, description: 'Kingdoms know the name, and the greatest challenges come looking.' },
  { name: 'Legendary', min: 60, description: 'Songs in every tongue. Every road they take is a dangerous one.' },
  { name: 'Mythic', min: 100, description: 'More story than person now.' },
];

/** Tier indexes, for conditions: `renownAtLeast(RENOWN.famous)`. */
export const RENOWN = { unknown: 0, known: 1, renowned: 2, famous: 3, legendary: 4, mythic: 5 } as const;

/** Fame for an outcome that ends the road, by its rarity. */
const RARITY_FAME: Record<Rarity, number> = { common: 2, uncommon: 4, rare: 8, epic: 12, legendary: 20, mythical: 30 };

/** A fight's fame per point of the foe's power, for a plain victory. */
const FAME_PER_POWER = 1 / 25;

export const FAME_CONFIG: FameConfig = {
  tiers: FAME_TIERS,
  floor: 1,
  earn: (option, step) => {
    if (step.foe && option.fight) {
      if (option.fight === 'lose') return 0;
      const how = option.id === 'glory' ? 2 : option.requiresTrait ? 1.5 : 1;
      return Math.max(1, Math.round(step.foe.power * FAME_PER_POWER * how));
    }
    if (option.nextStepId !== null) return 0;
    const fame = RARITY_FAME[option.rarity ?? 'common'];
    // A ladder's rarity says how rare it is to roll that high, and training is quiet work: half.
    return step.ladder ? Math.ceil(fame / 2) : fame;
  },
};

/** The character's fame tier, as an index into FAME_TIERS. */
export function renown(char: Character): number {
  return fameStanding(FAME_TIERS, char.fame ?? 0).index;
}

/** A condition (and its lock text) for options only the renowned are dealt: `...renownAtLeast(RENOWN.famous)`. */
export function renownAtLeast(tier: number): Pick<WheelOption, 'condition' | 'lockedReason'> {
  const name = FAME_TIERS[tier]!.name;
  return {
    condition: (_world: World, char: Character) => renown(char) >= tier,
    lockedReason: (_world: World, char: Character) =>
      `Only for the ${name} (${FAME_TIERS[tier]!.min} fame). They are ${FAME_TIERS[renown(char)]!.name}, with ${char.fame ?? 0}.`,
  };
}
