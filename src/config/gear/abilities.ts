/**
 * What gear can do. Every ability is a trait, given to whoever has the item equipped (with
 * `item` set to the slot), so it works the way any trait does:
 *
 *   power / multiplier   Combat Power, scaled by the item's stat
 *   a way to win         a slice of its own on every fight (common.ts GEAR_WINS)
 *   cheating death       the fatal slice is boarded up (common.ts DEATH_CHEATS)
 *   fameBonus            fights earn more fame (renown.ts)
 *   lootLuck             Spoils wheels lean rarer (engine/gear.ts)
 *   infuse               a weapon deals that element; armour turns it
 *
 * The signature abilities of the predetermined items (the Holy Sword's, Dragonscale's) are
 * listed with them, in uniques.ts.
 */
import type { GearAbility, Trait } from '../../engine/types';

interface AbilitySpec extends Omit<GearAbility, 'trait'> {
  id: string;
  name: string;
  description: string;
  power: number;
  multiplier?: number;
  fameBonus?: number;
  lootLuck?: number;
}

const SPECS: AbilitySpec[] = [
  // ── Weapons: an edge, an element ──
  { id: 'gear_keen', kind: 'weapon', minRarity: 'uncommon', prefix: 'Keen', name: 'Keen', description: 'Sharp enough to part a thought.', power: 14 },
  { id: 'gear_heavy', kind: 'weapon', minRarity: 'uncommon', prefix: 'Heavy', name: 'Heavy', description: 'Every blow lands like a falling door.', power: 16 },
  { id: 'gear_swift', kind: 'weapon', minRarity: 'uncommon', prefix: 'Swift', name: 'Swift', description: 'It is already moving when they think of it.', power: 14 },
  { id: 'gear_frost', kind: 'weapon', minRarity: 'uncommon', prefix: 'Frostbitten', infuse: 'frost', name: 'Frostbitten', description: 'Rime creeps along the edge. Wounds it makes go numb.', power: 12 },
  { id: 'gear_flame', kind: 'weapon', minRarity: 'uncommon', prefix: 'Flaming', infuse: 'fire', name: 'Flaming', description: 'It burns, and it does not burn its bearer.', power: 12 },
  { id: 'gear_storm', kind: 'weapon', minRarity: 'rare', prefix: 'Stormforged', infuse: 'lightning', name: 'Stormforged', description: 'Struck by lightning in the forge, and it remembers.', power: 18 },
  { id: 'gear_venom', kind: 'weapon', minRarity: 'uncommon', prefix: 'Venomous', infuse: 'poison', name: 'Venomous', description: 'Grooved for poison, and never empty.', power: 12 },
  { id: 'gear_blessed', kind: 'weapon', minRarity: 'rare', prefix: 'Blessed', infuse: 'holy', name: 'Blessed', description: 'A priest wept over it. The dead fear it.', power: 18 },
  { id: 'gear_shadow', kind: 'weapon', minRarity: 'rare', prefix: 'Shadow-Wrought', infuse: 'shadow', name: 'Shadow-Wrought', description: 'Forged at midnight, from midnight.', power: 18 },
  { id: 'gear_runed', kind: 'weapon', minRarity: 'uncommon', prefix: 'Runed', infuse: 'arcane', name: 'Runed', description: 'Letters along the blade that spell a hunger.', power: 14 },
  // ── Weapons: ways to win, and glory ──
  { id: 'gear_vampiric', kind: 'weapon', minRarity: 'rare', suffix: 'of the Leech', name: 'Lifedrinker', description: 'A new way to win: it drinks, and their wounds close.', power: 10 },
  { id: 'gear_slaying', kind: 'weapon', minRarity: 'epic', suffix: 'of Slaying', name: 'Slayer’s Edge', description: 'A new way to win: one clean stroke, where it counts.', power: 20 },
  { id: 'gear_duelist', kind: 'weapon', minRarity: 'rare', suffix: 'of the Duelist', name: 'Duelist’s Guard', description: 'A new way to win: their blade, flicked out of their hand.', power: 12 },
  { id: 'gear_wolf', kind: 'weapon', minRarity: 'uncommon', suffix: 'of the Wolf', name: 'Wolfbite', description: 'Bites, and does not let go.', power: 15 },
  { id: 'gear_glory', kind: 'weapon', minRarity: 'rare', suffix: 'of Glory', name: 'Glorious', description: 'Fights fought with it earn a quarter more fame.', power: 8, fameBonus: 0.25 },
  { id: 'gear_fortune', kind: 'weapon', minRarity: 'rare', suffix: 'of Fortune', name: 'Fortune’s Edge', description: 'What falls from the fallen is rarer.', power: 8, lootLuck: 1 },
  { id: 'gear_ruin', kind: 'weapon', minRarity: 'legendary', suffix: 'of Ruin', name: 'Ruin', description: 'All their power, a little more: ×1.05.', power: 20, multiplier: 1.05 },
  { id: 'gear_worldbreaker', kind: 'weapon', minRarity: 'mythical', suffix: 'of the Worldbreaker', name: 'Worldbreaker', description: 'All their power, a tenth more: ×1.1.', power: 30, multiplier: 1.1 },
  // ── Armour ──
  { id: 'gear_sturdy', kind: 'armor', minRarity: 'uncommon', prefix: 'Sturdy', name: 'Sturdy', description: 'Built to be hit, and to be hit again.', power: 12 },
  { id: 'gear_reinforced', kind: 'armor', minRarity: 'uncommon', prefix: 'Reinforced', name: 'Reinforced', description: 'Double-riveted where the blows fall.', power: 15 },
  { id: 'gear_warded', kind: 'armor', minRarity: 'uncommon', prefix: 'Warded', infuse: 'arcane', name: 'Warded', description: 'Spells slide off it like rain.', power: 12 },
  { id: 'gear_fireproof', kind: 'armor', minRarity: 'uncommon', prefix: 'Fire-Warded', infuse: 'fire', name: 'Fire-Warded', description: 'It has been through a dragon’s breath, and is not impressed.', power: 12 },
  { id: 'gear_frostlined', kind: 'armor', minRarity: 'uncommon', prefix: 'Frost-Lined', infuse: 'frost', name: 'Frost-Lined', description: 'Warm in a blizzard. Warm in a frost-giant’s grip.', power: 12 },
  { id: 'gear_hallowed', kind: 'armor', minRarity: 'rare', prefix: 'Hallowed', infuse: 'holy', name: 'Hallowed', description: 'Holy light finds no gap in it.', power: 16 },
  { id: 'gear_umbral', kind: 'armor', minRarity: 'rare', prefix: 'Umbral', infuse: 'shadow', name: 'Umbral', description: 'The dark rests on it like a hand.', power: 16 },
  { id: 'gear_mending', kind: 'armor', minRarity: 'rare', suffix: 'of Mending', name: 'Mending', description: 'A new way to win: their wounds close as the fight ends.', power: 10 },
  { id: 'gear_thorns', kind: 'armor', minRarity: 'epic', suffix: 'of Thorns', name: 'Thorns', description: 'A new way to win: every blow that lands costs the one who struck it.', power: 14 },
  { id: 'gear_renown', kind: 'armor', minRarity: 'uncommon', suffix: 'of Renown', name: 'Renowned', description: 'People notice it. Fights earn a fifth more fame.', power: 6, fameBonus: 0.2 },
  { id: 'gear_magpie', kind: 'armor', minRarity: 'rare', suffix: 'of the Magpie', name: 'Magpie’s Pockets', description: 'Deep pockets. What falls from the fallen is rarer.', power: 6, lootLuck: 1 },
  { id: 'gear_bastion', kind: 'armor', minRarity: 'epic', suffix: 'of the Bastion', name: 'Bastion', description: 'A wall, worn.', power: 30 },
  { id: 'gear_phoenix', kind: 'armor', minRarity: 'legendary', suffix: 'of the Phoenix', name: 'Phoenix Ward', description: 'Death comes, and burns away. While they wear it, they cannot be slain.', power: 20 },
  { id: 'gear_eternity', kind: 'armor', minRarity: 'mythical', suffix: 'of Eternity', name: 'Eternal', description: 'All their power, a little more: ×1.08.', power: 25, multiplier: 1.08 },
];

/** The ability traits, for `GameConfig.traits`. */
export const GEAR_ABILITY_TRAITS: Record<string, Trait> = Object.fromEntries(
  SPECS.map((s): [string, Trait] => [
    s.id,
    {
      id: s.id,
      name: s.name,
      description: s.description,
      power: s.power,
      ...(s.multiplier !== undefined && { multiplier: s.multiplier }),
      ...(s.fameBonus !== undefined && { fameBonus: s.fameBonus }),
      ...(s.lootLuck !== undefined && { lootLuck: s.lootLuck }),
    },
  ]),
);

/** What generated gear can roll. */
export const GEAR_ABILITIES: GearAbility[] = SPECS.map((s) => ({
  trait: s.id,
  kind: s.kind,
  minRarity: s.minRarity,
  ...(s.prefix && { prefix: s.prefix }),
  ...(s.suffix && { suffix: s.suffix }),
  ...(s.infuse && { infuse: s.infuse }),
}));

/** Abilities that cheat death while worn, and what they say about it. */
export const GEAR_DEATH_CHEATS: Record<string, string> = {
  gear_phoenix: 'Phoenix Ward: death comes, and burns away.',
};
