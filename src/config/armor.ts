/**
 * Armour: a second kind of gear beside the weapon. Each point of an armour's power is worth 20
 * Combat Power, scaled by the stat it is worn with (Vitality for mail, Agility for leathers…).
 *
 *   creation   The Armory ──▶ What Do You Wear? ──▶ owed power spins (the Holy Sword skips
 *              the Armory, but still dresses here; Demon Lords are armoured by the Abyss)
 *   adventures Find Armour (a pursuit at the crossroads), the forge, treasure, ruins, rulers
 *              who knight a hero, and the dead, whose armour can be taken (legacy.ts)
 *
 * Like the Armory, most souls set out with nothing; luck shrinks that slice.
 */
import type { Trait, WheelOption, WheelStep } from '../engine/types';
import { gearItem, graves } from './common';
import { POWERS_ROUTE } from './powers';
import { isRace } from './races';

export const ARMOR_TRAITS: Record<string, Trait> = {
  dragonscale: { id: 'dragonscale', name: 'Dragonscale Armour', description: 'Scales that turned a dragon’s own fire.', power: 25, item: 'armor' },
  celestial_aegis: { id: 'celestial_aegis', name: 'Celestial Aegis', description: 'A shield of light, forged above the clouds.', power: 30, item: 'armor' },
  storied_armor: { id: 'storied_armor', name: 'Armour From the Songs', description: 'Every dent in it has a verse.', power: 35, item: 'armor' },
};

/** An outfitter slice: after it, any owed power spins. */
const wear = (o: Omit<WheelOption, 'nextStepId'>): WheelOption => ({ ...o, nextStepId: POWERS_ROUTE });

export const OUTFITTER: WheelStep = {
  id: 'outfitter',
  title: 'What Do You Wear?',
  subtitle: 'Most souls set out in their travelling clothes. The lucky ones set out in steel.',
  options: [
    wear({ id: 'travelling_clothes', label: 'Travelling Clothes', description: 'A good cloak and sturdy boots. The road has armour, for those who survive it.', baseWeight: 30, rarity: 'common', luckScaling: -0.6, color: '#6b6f7a', icon: 'Shirt' }),
    wear({ id: 'padded_gambeson', label: 'Padded Gambeson', description: 'Quilted cloth, thick enough to stop a knife. Usually.', baseWeight: 12, rarity: 'common', gear: { armor: { power: 1, rarity: 'common', base: 'gambeson', name: 'Padded Gambeson' } }, color: '#8a7a5a', icon: 'Shirt' }),
    wear({ id: 'leather_jerkin', label: 'Leather Jerkin', description: 'Light, quiet, and it smells of the tannery.', baseWeight: 11, rarity: 'common', gear: { armor: { power: 1, rarity: 'common', base: 'leather', name: 'Leather Jerkin' } }, statModifiers: { agility: 1 }, color: '#7a5a3a', icon: 'Shirt' }),
    wear({ id: 'hide_armor', label: 'Hide Armour', description: 'The bear wore it first.', baseWeight: 9, rarity: 'common', gear: { armor: { power: 1, rarity: 'common', base: 'hide', name: 'Hide Armour' } }, statModifiers: { vitality: 1 }, color: '#6e5a42', icon: 'PawPrint' }),
    wear({ id: 'chain_shirt', label: 'Chain Shirt', description: 'Ten thousand little rings, and every one of them heavy.', baseWeight: 7, rarity: 'uncommon', luckScaling: 0.3, gear: { armor: { power: 2, rarity: 'uncommon', base: 'mail', name: 'Chain Shirt' } }, color: '#7a8290', icon: 'Shield' }),
    wear({ id: 'brigandine', label: 'Brigandine', description: 'Steel plates riveted inside a soldier’s coat.', baseWeight: 6, rarity: 'uncommon', luckScaling: 0.3, gear: { armor: { power: 2, rarity: 'uncommon', base: 'scale', name: 'Brigandine' } }, statModifiers: { might: 1 }, color: '#8a4a3a', icon: 'Shield' }),
    wear({ id: 'shield_and_helm', label: 'Shield and Helm', description: 'Round shield, iron cap, and the sense to hide behind both.', baseWeight: 6, rarity: 'uncommon', luckScaling: 0.3, gear: { armor: { power: 2, rarity: 'uncommon', base: 'mail', name: 'Shield and Helm' } }, color: '#5f6a7a', icon: 'ShieldHalf' }),
    wear({ id: 'robes_of_warding', label: 'Robes of Warding', description: 'Embroidered with runes that turn a blade aside, and amplify a spell.', baseWeight: 5, rarity: 'uncommon', luckScaling: 0.4, gear: { armor: { power: 1, rarity: 'uncommon', base: 'robes', name: 'Robes of Warding' } }, statModifiers: { arcana: 3 }, color: '#5a4a9a', icon: 'Sparkles' }),
    wear({ id: 'scale_mail', label: 'Scale Mail', description: 'Overlapping steel, like a fish that went to war.', baseWeight: 3.5, rarity: 'rare', luckScaling: 0.6, gear: { armor: { power: 3, rarity: 'rare', base: 'scale', name: 'Scale Mail' } }, color: '#6a8a8a', icon: 'Layers' }),
    wear({ id: 'full_plate', label: 'Full Plate', description: 'A walking fortress. Stairs are a problem.', baseWeight: 3, rarity: 'rare', luckScaling: 0.6, gear: { armor: { power: 4, rarity: 'rare', base: 'plate', name: 'Full Plate' } }, statModifiers: { agility: -1 }, epithet: { text: 'Iron-Clad', priority: 26 }, color: '#8a94a4', icon: 'ShieldCheck' }),
    wear({
      id: 'armour_of_the_fallen',
      label: 'Armour of the Fallen',
      description: 'Dented where its last owner was not quick enough.',
      baseWeight: 3,
      rarity: 'rare',
      luckScaling: 0.6,
      gear: { armor: { power: 3, rarity: 'rare', base: 'plate', name: 'Armour of the Fallen' } },
      condition: (world) => graves(world).length >= 1,
      lockedReason: 'No hero has fallen yet',
      color: '#4f6a7a',
      icon: 'Medal',
    }),
    wear({ id: 'elven_mithril', label: 'Elven Mithril', description: 'Light as silk, hard as a promise.', baseWeight: 2.5, rarity: 'epic', luckScaling: 0.8, gear: { armor: { power: 4, rarity: 'epic', base: 'mail', name: 'Elven Mithril' } }, statModifiers: { agility: 2 }, condition: isRace('elf'), lockedReason: 'Only an elf is given mithril', epithet: { text: 'Mithril-Clad', priority: 40 }, color: '#b8c8d8', icon: 'Sparkle' }),
    wear({ id: 'dwarven_plate', label: 'Dwarven Plate', description: 'Forged under the mountain, for someone exactly this tall.', baseWeight: 2.5, rarity: 'epic', luckScaling: 0.8, gear: { armor: { power: 4, rarity: 'epic', base: 'plate', name: 'Dwarven Plate' } }, statModifiers: { vitality: 1 }, condition: isRace('dwarf'), lockedReason: 'Only dwarves are fitted for it', epithet: { text: 'the Anvil-Clad', priority: 40 }, color: '#8a6a4a', icon: 'Anvil' }),
    wear({ id: 'dragonscale_armour', label: 'Dragonscale Armour', description: 'Scales that turned a dragon’s own fire.', baseWeight: 1.2, rarity: 'legendary', threatScaling: 0.3, luckScaling: 1.5, gear: { armor: { unique: 'dragonscale_armour' } }, epithet: { text: 'Dragonscale', priority: 48 }, color: '#b8452a', icon: 'Flame' }),
    wear({
      id: 'celestial_aegis',
      label: 'Celestial Aegis',
      description: 'A shield of light, forged above the clouds, for a blessed hand.',
      baseWeight: 1,
      rarity: 'legendary',
      luckScaling: 1.5,
      gear: { armor: { unique: 'celestial_aegis' } },
      epithet: { text: 'of the Aegis', priority: 48 },
      condition: (_world, char) => (char.tags.includes('blessed') || char.tags.includes('angel')) && !char.tags.includes('fiend'),
      lockedReason: 'Only the blessed may bear it',
      color: '#f0e6c8',
      icon: 'Sun',
    }),
  ],
};

/** A crossroads pursuit: something to wear that is better than what they have. */
export const FIND_ARMOR: WheelStep = {
  id: 'find_armor',
  title: 'What Armour Do You Find?',
  subtitle: 'Steel, leather, or something that used to belong to a knight.',
  options: [
    { id: 'dented_helm', label: 'A Dented Helm', description: 'It has stopped one blow already. It might stop another.', baseWeight: 32, rarity: 'common', ...gearItem('armor', 1), nextStepId: null, color: '#6e7280', icon: 'Shield' },
    { id: 'nothing_fits', label: 'Armour From a Grave', description: 'Nothing on the road fit, but the knight under the cairn was their size. The knight’s family might want it back.', baseWeight: 22, rarity: 'common', armorTierDelta: 1, grantTags: ['hook:grave_claim'], nextStepId: null, color: '#6b7280', icon: 'Skull' },
    { id: 'coat_of_mail', label: 'A Coat of Mail', description: 'Rusty in places. Rings in all the right ones.', baseWeight: 20, rarity: 'common', ...gearItem('armor', 2), nextStepId: null, color: '#7a8290', icon: 'Shield' },
    { id: 'knights_plate', label: 'A Fallen Knight’s Plate', description: 'Found by the roadside, polished, and worn with respect.', baseWeight: 10, rarity: 'uncommon', ...gearItem('armor', 3), nextStepId: null, color: '#8a94a4', icon: 'ShieldCheck' },
    { id: 'forged_their_own', label: 'Forged Their Own', description: 'A borrowed forge, a long week, and a suit that fits like skin.', baseWeight: 8, rarity: 'rare', requiresTrait: ['skill_smithing', 'master_crafter', 'runesmith'], ...gearItem('armor', 4), nextStepId: null, color: '#8a6a3a', icon: 'Anvil' },
    { id: 'cursed_armour', label: 'Cursed Armour', description: 'It will not come off. It also will not let anything through.', baseWeight: 5, rarity: 'rare', ...gearItem('armor', 4), luckDelta: -0.5, grantTags: ['cursed'], epithet: { text: 'the Iron-Cursed', priority: 30 }, nextStepId: null, color: '#5a2a6e', icon: 'Skull' },
    { id: 'mithril_shirt', statScaling: { intellect: 0.02 }, label: 'A Mithril Shirt', description: 'Under a dead king’s robes. He won’t miss it.', baseWeight: 4, rarity: 'rare', ...gearItem('armor', 3), statModifiers: { agility: 1 }, nextStepId: null, color: '#b8c8d8', icon: 'Sparkle' },
    { id: 'storied_armour', statScaling: { intellect: 0.03 }, label: 'Armour From the Songs', description: 'Every dent in it has a verse, and now they get to add one.', baseWeight: 1.2, rarity: 'legendary', ...gearItem('armor', 5), gear: { armor: { unique: 'storied_armour' } }, epithet: { text: 'the Unbreachable', priority: 60 }, nextStepId: null, color: '#ffb84d', icon: 'ShieldPlus' },
  ],
};

export const ARMOR_STEPS: WheelStep[] = [OUTFITTER, FIND_ARMOR];
