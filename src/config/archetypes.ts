/**
 * Archetypes: what a soul is trained (or born) to be, rolled right after their race's
 * wheels. Each banks a little toward its stats, some owe a power spin (a Mage an arcane
 * power, a Cleric a blessed one, a Warlock or Necromancer a corrupted one), and every
 * archetype bends later wheels through `odds`: a Mage finds staves, a Ranger bows, a
 * Warrior trains Might, and each favours different pursuits at the crossroads.
 *
 * Races lean toward archetypes in their own `odds.archetype` (races.ts).
 */
import type { Archetype, WheelStep } from '../engine/types';

export const ARCHETYPES = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description: 'Steel, shield and stubbornness.',
    odds: {
      armory: { war_axe: 1.6, rusted_shortsword: 1.4, greatsword: 2, iron_mace: 1.4, empty_hands: 0.7 },
      talents: { blademaster: 2 },
      train_stat: { might: 2.5 },
      crossroads: { train: 1.6, tournament: 2, war: 2 },
    },
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    description: 'Quick hands, quiet feet, and a knife for every problem.',
    odds: {
      armory: { rusted_shortsword: 1.3, twin_daggers: 3, crossbow: 1.5 },
      talents: { shadowstep: 2.5 },
      train_stat: { agility: 2.5 },
      crossroads: { treasure: 2, hunt: 1.6, hidden_place: 1.6 },
    },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'At home where the roads run out.',
    odds: {
      armory: { hunters_longbow: 3, crossbow: 2, hunting_spear: 1.5, stormbow: 1.5 },
      train_stat: { agility: 1.6, vitality: 1.4 },
      crossroads: { hunt: 2, tame_beast: 2.5, explore: 1.6 },
    },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    description: 'Years of study, one very loud spell.',
    odds: {
      armory: { runed_staff: 3, apprentice_wand: 3, war_axe: 0.5, greatsword: 0.5 },
      talents: { arcane_savant: 2, archmage: 2 },
      train_stat: { arcana: 2.5, intellect: 1.6 },
      crossroads: { research: 2, study: 2, learn_power: 2.5 },
    },
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    description: 'Prayers that get answered, sometimes loudly.',
    odds: {
      armory: { runed_staff: 1.5, iron_mace: 2.5, warhammer: 1.5 },
      train_stat: { arcana: 1.6, vitality: 1.6 },
      crossroads: { learn_power: 1.8, mentor: 1.4 },
    },
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    description: 'An oath, a sword, and no patience for evil.',
    odds: {
      armory: { war_axe: 1.3, warhammer: 2, greatsword: 1.6 },
      talents: { holy_sword: 2.5 },
      train_stat: { might: 1.6, vitality: 1.6 },
      crossroads: { war: 1.8, challenge: 1.6 },
    },
  },
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    description: 'Rage first. Rage second. Thinking eventually.',
    odds: {
      armory: { war_axe: 2.2, greatsword: 2, obsidian_glaive: 1.5, empty_hands: 1.2 },
      talents: { unbreakable: 2 },
      train_stat: { might: 3 },
      crossroads: { war: 2, challenge: 2, study: 0.4 },
    },
  },
  bard: {
    id: 'bard',
    name: 'Bard',
    description: 'Every legend needs someone to sing it. Ideally themselves.',
    odds: { armory: { duelist_rapier: 2.5 }, train_stat: { intellect: 1.6, agility: 1.4 }, crossroads: { make_ally: 2, tournament: 1.6 } },
  },
  druid: {
    id: 'druid',
    name: 'Druid',
    description: 'Speaks for the forest, and the forest has opinions.',
    odds: { train_stat: { arcana: 1.6, vitality: 1.4 }, crossroads: { tame_beast: 2.5, transform: 2 } },
  },
  monk: {
    id: 'monk',
    name: 'Monk',
    description: 'Empty hands, full discipline.',
    odds: {
      armory: { empty_hands: 2.5 },
      train_stat: { agility: 2, vitality: 1.4 },
      crossroads: { train: 2, master_power: 2 },
    },
  },
  warlock: {
    id: 'warlock',
    name: 'Warlock',
    description: 'Power on loan from something that will collect.',
    odds: { armory: { apprentice_wand: 2 }, train_stat: { arcana: 2.5 }, crossroads: { learn_power: 2, make_enemy: 1.6 } },
  },
  artificer: {
    id: 'artificer',
    name: 'Artificer',
    description: 'If it doesn’t exist yet, they’ll build it by Tuesday.',
    odds: { armory: { crossbow: 2.5 }, train_stat: { intellect: 2.5 }, crossroads: { craft: 3, research: 1.6 } },
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    description: 'Death is a resource. A renewable one.',
    odds: {
      talents: { echoes: 2.5 },
      train_stat: { arcana: 2, intellect: 1.6 },
      crossroads: { research: 2, learn_power: 2 },
    },
  },
} satisfies Record<string, Archetype>;

const archetype = (id: keyof typeof ARCHETYPES) => ({ setArchetype: id, description: ARCHETYPES[id].description, nextStepId: 'fate' });

export const ARCHETYPE: WheelStep = {
  id: 'archetype',
  title: 'Wheel of Archetypes',
  subtitle: 'What were you made for?',
  options: [
    { ...archetype('warrior'), id: 'warrior', label: 'Warrior', baseWeight: 18, rarity: 'common', statBonus: { might: 2, vitality: 1 }, epithet: { text: 'the Warrior', priority: 16 }, color: '#9a4a3a', icon: 'Sword' },
    { ...archetype('rogue'), id: 'rogue', label: 'Rogue', baseWeight: 15, rarity: 'common', statBonus: { agility: 2, intellect: 1 }, epithet: { text: 'the Rogue', priority: 16 }, color: '#4a4a5e', icon: 'VenetianMask' },
    { ...archetype('ranger'), id: 'ranger', label: 'Ranger', baseWeight: 13, rarity: 'common', statBonus: { agility: 1, vitality: 1, intellect: 1 }, epithet: { text: 'the Ranger', priority: 16 }, color: '#3f7a4a', icon: 'Target' },
    { ...archetype('mage'), id: 'mage', label: 'Mage', baseWeight: 10, rarity: 'uncommon', statBonus: { arcana: 2, intellect: 1 }, queueSpins: { arcane_powers: 1 }, epithet: { text: 'the Mage', priority: 18 }, color: '#5a5ad0', icon: 'WandSparkles' },
    { ...archetype('cleric'), id: 'cleric', label: 'Cleric', baseWeight: 9, rarity: 'uncommon', statBonus: { arcana: 1, vitality: 1, intellect: 1 }, queueSpins: { blessed_powers: 1 }, epithet: { text: 'the Cleric', priority: 18 }, color: '#d9c27a', icon: 'Church' },
    { ...archetype('paladin'), id: 'paladin', label: 'Paladin', baseWeight: 8, rarity: 'uncommon', statBonus: { might: 1, vitality: 1, arcana: 1 }, epithet: { text: 'the Paladin', priority: 20 }, color: '#c9a24c', icon: 'ShieldCheck' },
    { ...archetype('barbarian'), id: 'barbarian', label: 'Barbarian', baseWeight: 8, rarity: 'uncommon', statBonus: { might: 3, vitality: 1, intellect: -1 }, epithet: { text: 'the Barbarian', priority: 18 }, color: '#8a2e2e', icon: 'Axe' },
    { ...archetype('bard'), id: 'bard', label: 'Bard', baseWeight: 7, rarity: 'uncommon', statBonus: { intellect: 1, agility: 1 }, luckDelta: 0.25, epithet: { text: 'the Bard', priority: 16 }, color: '#c0569a', icon: 'Music' },
    { ...archetype('druid'), id: 'druid', label: 'Druid', baseWeight: 4, rarity: 'rare', statBonus: { arcana: 1, vitality: 1 }, queueSpins: { arcane_powers: 1 }, epithet: { text: 'the Druid', priority: 22 }, color: '#4f8a3a', icon: 'Leaf' },
    { ...archetype('monk'), id: 'monk', label: 'Monk', baseWeight: 4, rarity: 'rare', statBonus: { agility: 2, vitality: 1 }, epithet: { text: 'the Monk', priority: 22 }, color: '#d98a3a', icon: 'Hand' },
    { ...archetype('warlock'), id: 'warlock', label: 'Warlock', baseWeight: 3, rarity: 'rare', statBonus: { arcana: 2 }, queueSpins: { corrupted_powers: 1 }, grantTags: ['pact'], epithet: { text: 'the Warlock', priority: 24 }, color: '#5a2a6e', icon: 'Eye' },
    { ...archetype('artificer'), id: 'artificer', label: 'Artificer', baseWeight: 3, rarity: 'rare', statBonus: { intellect: 2 }, weaponTierDelta: 1, epithet: { text: 'the Artificer', priority: 22 }, color: '#7a8a9a', icon: 'Cog' },
    { ...archetype('necromancer'), id: 'necromancer', label: 'Necromancer', baseWeight: 1.5, rarity: 'epic', statBonus: { arcana: 2, intellect: 1 }, queueSpins: { corrupted_powers: 1 }, epithet: { text: 'the Necromancer', priority: 30 }, color: '#2f5a4a', icon: 'Skull' },
  ],
};
