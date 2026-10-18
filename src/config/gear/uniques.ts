/**
 * Predetermined items: the Holy Sword and the other named gear of the world. Each is made the
 * same every time, and only one of each is found in a world (`uniquesInWorld`).
 *
 * Their signature abilities keep the ids the old item traits had (holy_sword, dragonbone,
 * dragonscale…), so everything that asks "do they carry the Holy Sword?" still asks it the same way.
 */
import type { UniqueGear } from '../../engine/types';

const unique = (u: UniqueGear): [string, UniqueGear] => [u.id, u];

export const UNIQUE_GEAR: Record<string, UniqueGear> = Object.fromEntries([
  // ── Known from the wheels ──
  unique({ id: 'holy_sword', kind: 'weapon', name: 'The Holy Sword', base: 'longsword', rarity: 'mythical', power: 10, stat: 'might', damage: 'holy', abilities: ['holy_sword', 'gear_blessed'], lore: 'It chose them. It does not explain itself, and it will not serve a thief.', untakeable: true }),
  unique({ id: 'dragonbone_blade', kind: 'weapon', name: 'Dragonbone Blade', base: 'longsword', rarity: 'legendary', power: 5, stat: 'might', damage: 'fire', abilities: ['dragonbone', 'gear_flame'], lore: 'Carved from the last of the old wyrms. The blade remembers the dragon it came from.' }),
  unique({ id: 'songblade', kind: 'weapon', name: 'The Songblade', base: 'longsword', rarity: 'legendary', power: 5, stat: 'might', damage: 'slashing', abilities: ['legendary_weapon', 'gear_glory'], lore: 'The one from the songs. It was real, and it has a name older than kingdoms.' }),
  unique({ id: 'whispering_blade', kind: 'weapon', name: 'The Whispering Blade', base: 'longsword', rarity: 'epic', power: 6, stat: 'might', damage: 'shadow', abilities: ['sentient_blade'], lore: 'A sword with opinions, and a thirst.' }),
  unique({ id: 'deaths_scythe', kind: 'weapon', name: 'Death’s Scythe', base: 'scythe', rarity: 'legendary', power: 7, stat: 'might', damage: 'shadow', abilities: ['gear_shadow', 'gear_slaying'], lore: 'A good loser gave it up. It is very sharp.' }),
  unique({ id: 'stone_sword', kind: 'weapon', name: 'The Sword From the Stone', base: 'longsword', rarity: 'epic', power: 6, stat: 'might', damage: 'holy', abilities: ['gear_keen', 'gear_glory'], lore: 'Nobody else ever got it to move.' }),
  unique({ id: 'dragonscale_armour', kind: 'armor', name: 'Dragonscale Armour', base: 'scale', rarity: 'legendary', power: 5, stat: 'vitality', resists: 'fire', abilities: ['dragonscale', 'gear_fireproof'], lore: 'Scales that turned a dragon’s own fire.' }),
  unique({ id: 'celestial_aegis', kind: 'armor', name: 'Celestial Aegis', base: 'plate', rarity: 'legendary', power: 5, stat: 'vitality', resists: 'shadow', abilities: ['celestial_aegis', 'gear_hallowed'], lore: 'A shield of light, forged above the clouds, for a blessed hand.' }),
  unique({ id: 'storied_armour', kind: 'armor', name: 'Armour From the Songs', base: 'plate', rarity: 'legendary', power: 5, stat: 'vitality', resists: 'slashing', abilities: ['storied_armor', 'gear_renown'], lore: 'Every dent in it has a verse.' }),
  unique({ id: 'dragon_gold_mail', kind: 'armor', name: 'Dragon-Gold Mail', base: 'mail', rarity: 'legendary', power: 4, stat: 'vitality', resists: 'fire', abilities: ['dragon_gold'], lore: 'Armour of coin, and a dragon who wants it back.' }),
  unique({ id: 'broodmother_silk', kind: 'armor', name: 'Broodmother’s Silk', base: 'cloak', rarity: 'rare', power: 3, stat: 'agility', resists: 'poison', abilities: ['spider_silk'], lore: 'A cloak that turns blades like water.' }),
  unique({ id: 'wyrmscale', kind: 'armor', name: 'Wyrmscale', base: 'scale', rarity: 'mythical', power: 8, stat: 'vitality', resists: 'fire', abilities: ['wyrmscale', 'gear_fireproof'], lore: 'Cut from the Primordial Wyrm’s hide. No fire can touch it.' }),
  // ── Found only on the fallen ──
  unique({ id: 'lucky_shiv', kind: 'weapon', name: 'Grubnak’s Lucky Shiv', base: 'dagger', rarity: 'rare', power: 3, stat: 'agility', damage: 'poison', abilities: ['gear_fortune'], lore: 'The goblin chief swore by it. It did not save him.' }),
  unique({ id: 'bandit_saber', kind: 'weapon', name: 'The Bandit Lord’s Saber', base: 'shortsword', rarity: 'rare', power: 3, stat: 'agility', damage: 'slashing', abilities: ['gear_glory'], lore: 'Notched once for every coach it stopped.' }),
  unique({ id: 'broodfang', kind: 'weapon', name: 'Broodfang', base: 'dagger', rarity: 'epic', power: 4, stat: 'agility', damage: 'poison', abilities: ['gear_venom', 'gear_vampiric'], lore: 'The Broodmother’s own fang, still wet.' }),
  unique({ id: 'bridgebreaker', kind: 'weapon', name: 'Bridgebreaker', base: 'club', rarity: 'epic', power: 5, stat: 'might', damage: 'bludgeoning', abilities: ['gear_heavy', 'gear_wolf'], lore: 'A tree, trimmed. The troll collected tolls with it.' }),
  unique({ id: 'troll_hide', kind: 'armor', name: 'Troll-Hide Mantle', base: 'hide', rarity: 'rare', power: 4, stat: 'vitality', resists: 'slashing', abilities: ['gear_mending'], lore: 'It still knits itself back together.' }),
  unique({ id: 'heartstone_maul', kind: 'weapon', name: 'Heartstone Maul', base: 'warhammer', rarity: 'epic', power: 6, stat: 'might', damage: 'bludgeoning', abilities: ['gear_heavy', 'gear_slaying'], lore: 'The Guardian’s heart, on a haft. It is still warm.' }),
  unique({ id: 'barrow_blade', kind: 'weapon', name: 'The Barrow-King’s Blade', base: 'longsword', rarity: 'legendary', power: 6, stat: 'might', damage: 'shadow', abilities: ['gear_shadow', 'gear_vampiric'], lore: 'Buried with a king. He wanted it back, every night.' }),
  unique({ id: 'wyvern_spear', kind: 'weapon', name: 'Wyvern-Tail Spear', base: 'spear', rarity: 'legendary', power: 7, stat: 'agility', damage: 'poison', abilities: ['gear_venom', 'gear_swift'], lore: 'The sting, bound to ash. It still twitches.' }),
  unique({ id: 'maneater_hide', kind: 'armor', name: 'Man-Eater’s Hide', base: 'hide', rarity: 'rare', power: 4, stat: 'vitality', resists: 'piercing', abilities: ['gear_reinforced'], lore: 'Arrows bounced off it. Now they bounce off them.' }),
  unique({ id: 'last_rapier', kind: 'weapon', name: 'The Duelist’s Last Rapier', base: 'rapier', rarity: 'epic', power: 4, stat: 'agility', damage: 'piercing', abilities: ['gear_duelist', 'gear_keen'], lore: 'Forty duels. One loss. This was the one.' }),
  unique({ id: 'spellthief_staff', kind: 'weapon', name: 'Spellthief’s Staff', base: 'staff', rarity: 'epic', power: 5, stat: 'arcana', damage: 'arcane', abilities: ['gear_runed', 'gear_fortune'], lore: 'Every spell it ever stole is still inside, muttering.' }),
  unique({ id: 'tourney_lance', kind: 'weapon', name: 'The Tourney Lance', base: 'spear', rarity: 'epic', power: 5, stat: 'agility', damage: 'piercing', abilities: ['gear_glory', 'gear_heavy'], lore: 'Painted in a champion’s colours. Theirs, now.' }),
  unique({ id: 'undefeated_plate', kind: 'armor', name: 'Plate of the Undefeated', base: 'plate', rarity: 'epic', power: 6, stat: 'might', resists: 'slashing', abilities: ['gear_bastion', 'gear_renown'], lore: 'Not a scratch on it, until today.' }),
  unique({ id: 'warlord_axe', kind: 'weapon', name: 'The Warlord’s Axe', base: 'axe', rarity: 'epic', power: 6, stat: 'might', damage: 'slashing', abilities: ['gear_heavy', 'gear_glory'], lore: 'An army followed it. Some of them still might.' }),
  unique({ id: 'crown_guard', kind: 'armor', name: 'The Usurper’s Crown-Guard', base: 'plate', rarity: 'legendary', power: 8, stat: 'might', resists: 'piercing', abilities: ['gear_reinforced', 'gear_thorns'], lore: 'Made to keep a stolen crown on a stolen head.' }),
  unique({ id: 'banner_blade', kind: 'weapon', name: 'Banner-Blade of the Endless Host', base: 'greatsword', rarity: 'legendary', power: 8, stat: 'might', damage: 'slashing', abilities: ['gear_glory', 'gear_slaying'], lore: 'The host marched behind it for a hundred years.' }),
  unique({ id: 'voidglass_glaive', kind: 'weapon', name: 'Voidglass Glaive', base: 'glaive', rarity: 'legendary', power: 9, stat: 'agility', damage: 'shadow', abilities: ['gear_shadow', 'gear_ruin'], lore: 'Broken off the Thing From the Breach. You can see stars in it.' }),
  unique({ id: 'abyssal_edge', kind: 'weapon', name: 'The Abyssal Edge', base: 'greatsword', rarity: 'mythical', power: 9, stat: 'might', damage: 'shadow', abilities: ['gear_shadow', 'gear_ruin', 'gear_vampiric'], lore: 'The Demon Lord’s own blade. It is hungry, and it is patient.' }),
  unique({ id: 'mountainbreaker', kind: 'weapon', name: 'Mountainbreaker', base: 'warhammer', rarity: 'mythical', power: 10, stat: 'might', damage: 'bludgeoning', abilities: ['gear_heavy', 'gear_worldbreaker', 'gear_slaying'], lore: 'A knuckle of the Waking Titan, on a haft only a hero could lift.' }),
  unique({ id: 'phoenix_mantle', kind: 'armor', name: 'The Phoenix Mantle', base: 'cloak', rarity: 'mythical', power: 9, stat: 'agility', resists: 'fire', abilities: ['gear_phoenix', 'gear_eternity', 'gear_fireproof'], lore: 'It has burned and risen more times than anyone can count.' }),
]);
