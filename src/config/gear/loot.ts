/**
 * Who drops what. After every win a Spoils wheel is drawn from the fallen foe's table: a few
 * items made from its entries, and a slice for nothing worth taking. Foes without a table of
 * their own (an ambush that grows with the quest, a rival) drop by their power (`lootFor`).
 *
 * Power ranges follow the foe: goblins drop crude daggers, dragons drop what dragons guard.
 */
import type { DamageType, LootEntry, LootTable } from '../../engine/types';

const weapon = (weight: number, power: [number, number], bases?: string[], damage?: DamageType[]): LootEntry => ({
  kind: 'weapon',
  weight,
  power,
  ...(bases && { bases }),
  ...(damage && { damage }),
});
const armor = (weight: number, power: [number, number], bases?: string[], resists?: DamageType[]): LootEntry => ({
  kind: 'armor',
  weight,
  power,
  ...(bases && { bases }),
  ...(resists && { damage: resists }),
});
const unique = (id: string, weight: number): LootEntry => ({ kind: 'unique', id, weight });

/** Loot tables, by the foe ids in common.ts `FOES`. */
export const LOOT_TABLES = {
  goblins: { nothing: 50, entries: [weapon(30, [1, 3], ['dagger', 'spear', 'club', 'shortsword']), armor(18, [1, 2], ['leather', 'hide', 'gambeson']), unique('lucky_shiv', 3)] },
  bandits: { nothing: 45, entries: [weapon(28, [1, 3], ['shortsword', 'longsword', 'dagger', 'crossbow', 'bow']), armor(22, [1, 3], ['leather', 'gambeson', 'mail', 'cloak']), unique('bandit_saber', 3)] },
  spiders: { nothing: 45, entries: [weapon(22, [2, 4], ['dagger', 'spear'], ['poison']), armor(22, [2, 4], ['cloak', 'leather'], ['poison']), unique('broodfang', 3), unique('broodmother_silk', 4)] },
  troll: { nothing: 45, entries: [weapon(26, [2, 5], ['club', 'mace', 'warhammer', 'axe']), armor(20, [2, 5], ['hide', 'mail']), unique('bridgebreaker', 3), unique('troll_hide', 3)] },
  guardian: { nothing: 45, entries: [weapon(24, [3, 6], ['warhammer', 'mace', 'staff', 'greatsword']), armor(24, [3, 6], ['plate', 'scale', 'robes'], ['bludgeoning', 'arcane']), unique('heartstone_maul', 3)] },
  wights: { nothing: 45, entries: [weapon(26, [3, 6], ['longsword', 'scythe', 'axe', 'wand'], ['shadow', 'frost', 'slashing']), armor(22, [3, 6], ['mail', 'plate', 'cloak'], ['shadow', 'frost']), unique('barrow_blade', 3)] },
  wyvern: { nothing: 45, entries: [weapon(24, [4, 7], ['spear', 'bow', 'glaive'], ['poison', 'piercing']), armor(24, [4, 7], ['scale', 'leather', 'hide'], ['poison', 'piercing']), unique('wyvern_spear', 3)] },
  dragon: { nothing: 40, entries: [weapon(24, [6, 9], undefined, ['fire', 'slashing', 'piercing']), armor(24, [6, 9], ['scale', 'plate', 'mail'], ['fire']), unique('dragonbone_blade', 4), unique('dragonscale_armour', 4), unique('dragon_gold_mail', 3)] },
  beast: { nothing: 50, entries: [weapon(20, [2, 4], ['spear', 'bow', 'axe']), armor(26, [2, 4], ['hide', 'leather']), unique('maneater_hide', 3)] },
  duelist: { nothing: 45, entries: [weapon(34, [2, 5], ['rapier', 'shortsword', 'longsword', 'dagger']), armor(14, [2, 4], ['leather', 'cloak', 'gambeson']), unique('last_rapier', 3)] },
  rogueMage: { nothing: 45, entries: [weapon(28, [3, 6], ['staff', 'wand', 'tome']), armor(20, [3, 6], ['robes', 'cloak'], ['arcane', 'fire', 'lightning']), unique('spellthief_staff', 3)] },
  tournament: { nothing: 45, entries: [weapon(26, [3, 6], ['spear', 'longsword', 'greatsword', 'mace']), armor(24, [3, 6], ['plate', 'mail']), unique('tourney_lance', 3)] },
  undefeated: { nothing: 45, entries: [weapon(24, [4, 7]), armor(24, [4, 7], ['plate', 'scale', 'mail']), unique('undefeated_plate', 3)] },
  war: { nothing: 40, entries: [weapon(28, [4, 7], ['axe', 'longsword', 'spear', 'crossbow', 'warhammer']), armor(26, [4, 7], ['mail', 'plate', 'scale']), unique('warlord_axe', 3)] },
  usurper: { nothing: 35, entries: [weapon(26, [6, 9]), armor(26, [6, 9], ['plate', 'mail', 'scale']), unique('crown_guard', 4)] },
  greatWar: { nothing: 35, entries: [weapon(28, [6, 9], ['greatsword', 'axe', 'spear', 'warhammer']), armor(26, [6, 9], ['plate', 'scale']), unique('banner_blade', 4)] },
  breachHorror: { nothing: 35, entries: [weapon(26, [7, 10], undefined, ['shadow', 'arcane', 'lightning']), armor(26, [7, 10], undefined, ['shadow', 'arcane']), unique('voidglass_glaive', 4)] },
  demonLord: { nothing: 30, entries: [weapon(26, [7, 10], undefined, ['shadow', 'fire']), armor(26, [7, 10], undefined, ['holy', 'shadow', 'fire']), unique('abyssal_edge', 5)] },
  wyrm: { nothing: 30, entries: [weapon(24, [7, 10], undefined, ['fire']), armor(26, [7, 10], ['scale', 'plate'], ['fire']), unique('wyrmscale', 5)] },
  titan: { nothing: 30, entries: [weapon(26, [8, 10], ['warhammer', 'greatsword', 'axe', 'club']), armor(26, [8, 10], ['plate', 'hide']), unique('mountainbreaker', 4), unique('phoenix_mantle', 3)] },
} satisfies Record<string, LootTable>;

/**
 * The table for a foe with none of its own, from its power on the Combat Power scale: a
 * goblin-sized ambush drops tier 1–3, something dragon-sized drops tier 6–9.
 */
export function lootFor(power: number): LootTable {
  const top = Math.max(2, Math.min(10, Math.round(power / 140) + 2));
  const range: [number, number] = [Math.max(1, top - 3), top];
  return { nothing: power >= 1000 ? 35 : 45, entries: [weapon(28, range), armor(26, range)] };
}
