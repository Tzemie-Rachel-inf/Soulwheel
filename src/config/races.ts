/**
 * Races: who they are, how they bend the other wheels, and the wheels of their own.
 *
 *   Ancestry ──▶ the race's own wheel(s) ──▶ Archetype ──▶ Fate
 *      ├─ Monster ──▶ What Kind of Monster? ──▶ that monster's wheel(s) ──▶ Archetype
 *      └─ God, Demon, Angel, Construct ──▶ their wheels (otherworldly.ts) ──▶ Archetype
 *
 * Every race has at least one wheel: a human's homeland, an elf's lineage (which becomes
 * their race: Wood Elf, High Elf...), a dwarf's clan (their surname), a goblin's band and
 * their place in it, a skeleton's spark of undeath (which can make them a Lich), and so on.
 * Options there bank stat bonuses, and many earn a surname or a title (`epithet`).
 *
 * Each race's stat tiers and odds live in stats.ts. `odds` below bends everything else:
 * archetype, fate, personality, talents, the armory, the road.
 */
import type { Character, Race, Trait, WheelOption, WheelStep, World } from '../engine/types';
import { racesOf } from '../engine/character';
import { NAMES } from './names';

export { BLOOD_TAG, racesOf } from '../engine/character';

// ─── The races ──────────────────────────────────────────────────────────────

const ELF_ODDS = {
  archetype: { ranger: 2, mage: 1.6, druid: 1.6, barbarian: 0.4 },
  fate: { blessed: 1.3 },
  personality: { curious: 1.6, cautious: 1.4, cruel: 0.6 },
  talents: { arcane_savant: 1.8, shadowstep: 1.4, unbreakable: 0.6 },
  armory: { hunters_longbow: 2, runed_staff: 1.5, war_axe: 0.4 },
  road: { fey_crossing: 1.5 },
};

export const RACES = {
  human: {
    id: 'human',
    name: 'Human',
    description: 'Short lives, long ambitions. Good at everything, best at nothing.',
    names: NAMES.human,
    odds: { archetype: { paladin: 1.2, bard: 1.2 }, personality: { brave: 1.2, cautious: 1.2 }, talents: { blademaster: 1.2 } },
  },
  elf: { id: 'elf', name: 'Elf', description: 'Quick, keen, and older than they look.', names: NAMES.elf, odds: ELF_ODDS },
  wood_elf: { id: 'wood_elf', name: 'Wood Elf', family: 'elf', description: 'Bow, leaf and silence.' },
  high_elf: {
    id: 'high_elf',
    name: 'High Elf',
    family: 'elf',
    description: 'Towers of silver and very long memories.',
    odds: { archetype: { mage: 2.4 }, talents: { arcane_savant: 2.4, archmage: 2 }, personality: { ambitious: 1.6, kind: 0.8 } },
  },
  dark_elf: {
    id: 'dark_elf',
    name: 'Dark Elf',
    family: 'elf',
    description: 'Raised under the world, where trust is a weakness.',
    odds: {
      archetype: { rogue: 2, warlock: 2.2, necromancer: 1.6, cleric: 0.5 },
      fate: { cursed: 1.6, blessed: 0.7 },
      personality: { cruel: 1.6, ambitious: 1.8, kind: 0.6 },
    },
  },
  moon_elf: { id: 'moon_elf', name: 'Moon Elf', family: 'elf', description: 'Blessed by a pale sky, and quietly lucky.' },
  star_elf: { id: 'star_elf', name: 'Star Elf', family: 'elf', description: 'Fell with the stars, and never quite landed.' },
  dwarf: {
    id: 'dwarf',
    name: 'Dwarf',
    description: 'Stone-stubborn and forge-proud.',
    names: NAMES.dwarf,
    odds: {
      archetype: { warrior: 1.6, cleric: 1.4, artificer: 2.5, bard: 0.6, druid: 0.4 },
      personality: { honorable: 2, greedy: 1.6, reckless: 0.6 },
      talents: { unbreakable: 1.6, runesmith: 1.5 },
      armory: { war_axe: 2.5, warhammer: 2, hunters_longbow: 0.5 },
    },
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    description: 'Strength first. Questions later, possibly never.',
    names: NAMES.orc,
    odds: {
      archetype: { barbarian: 2.8, warrior: 1.6, mage: 0.4, bard: 0.5, cleric: 0.6 },
      fate: { cursed: 1.4, blessed: 0.7 },
      personality: { reckless: 1.8, cruel: 1.6, brave: 1.4, cautious: 0.5, curious: 0.6 },
      talents: { blademaster: 1.6, unbreakable: 1.5, arcane_savant: 0.4 },
      armory: { war_axe: 1.8, greatsword: 1.6, runed_staff: 0.5 },
    },
  },
  halfling: {
    id: 'halfling',
    name: 'Halfling',
    description: 'Small, quiet, and somehow always where the luck is.',
    names: NAMES.halfling,
    odds: {
      archetype: { rogue: 2.2, bard: 1.8, barbarian: 0.3 },
      fate: { blessed: 1.3, demon_lord: 0.5 },
      personality: { kind: 1.8, curious: 1.5, cruel: 0.3, ambitious: 0.5 },
      talents: { shadowstep: 1.8, blademaster: 0.6 },
      armory: { hunters_longbow: 1.5 },
    },
  },
  dragonborn: {
    id: 'dragonborn',
    name: 'Dragonborn',
    description: 'Scales, smoke, and a grudge older than kingdoms.',
    names: NAMES.dragonborn,
    odds: {
      archetype: { paladin: 2, warrior: 1.4, monk: 0.6 },
      personality: { brave: 1.4, ambitious: 1.8, honorable: 1.4 },
      talents: { blademaster: 1.3 },
      // Every dragon in the world wants a dragonborn's hoard.
      lairs: { dragons_den: 3 },
    },
  },
  // A natural-born angel. (The id predates the name.) Mortals raised to the light keep their own race.
  celestial: {
    id: 'celestial',
    name: 'Angel',
    description: 'Born of light, and sent down here on purpose.',
    names: NAMES.celestial,
    odds: {
      archetype: { cleric: 2.5, paladin: 2.5, warlock: 0.05, necromancer: 0.05, rogue: 0.6 },
      fate: { blessed: 2.5, cursed: 0.2, demon_lord: 0.15 },
      personality: { kind: 1.8, honorable: 2, cruel: 0.2 },
      talents: { arcane_savant: 1.6 },
    },
  },
  // Monsters: rolled on their own wheel after Ancestry's Monster slice.
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    description: 'Small, sharp, and never as alone as they look.',
    names: NAMES.goblin,
    odds: {
      archetype: { rogue: 2.2, artificer: 1.4, paladin: 0.2, cleric: 0.4 },
      fate: { cursed: 1.5, blessed: 0.6 },
      personality: { greedy: 2, reckless: 1.6, cruel: 1.4, honorable: 0.3 },
      talents: { shadowstep: 1.8 },
      armory: { empty_hands: 1.3, rusted_shortsword: 1.5, twin_daggers: 1.6 },
      road: { bandit_ambush: 1.4 },
    },
  },
  kobold: {
    id: 'kobold',
    name: 'Kobold',
    description: 'Trap-maker, tunnel-digger, dragon-worshipper.',
    names: NAMES.kobold,
    odds: {
      archetype: { artificer: 2, rogue: 1.6, warlock: 1.4 },
      fate: { cursed: 1.2 },
      personality: { cautious: 1.8, greedy: 1.4 },
      talents: { shadowstep: 1.4 },
    },
  },
  lizardfolk: {
    id: 'lizardfolk',
    name: 'Lizardfolk',
    description: 'Cold blood, patient eyes, no small talk.',
    names: NAMES.lizardfolk,
    odds: {
      archetype: { ranger: 1.8, druid: 1.8, barbarian: 1.4, bard: 0.4 },
      personality: { cautious: 1.5, kind: 0.7 },
      talents: { unbreakable: 1.6 },
      armory: { hunters_longbow: 1.4 },
    },
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    description: 'Bones that forgot how to lie still.',
    names: NAMES.skeleton,
    odds: {
      archetype: { warrior: 2, necromancer: 1.8, cleric: 0.1, paladin: 0.1, bard: 0.3 },
      fate: { cursed: 2, blessed: 0.2, demon_lord: 1.5 },
      personality: { cruel: 1.6, kind: 0.4 },
      talents: { unbreakable: 1.5 },
    },
  },
  lich: {
    id: 'lich',
    name: 'Lich',
    description: 'A skeleton that learned the one spell that matters.',
    names: NAMES.lich,
    odds: {
      archetype: { necromancer: 5, mage: 3, warrior: 0.2, barbarian: 0.1 },
      fate: { cursed: 2, blessed: 0.2, demon_lord: 2.5 },
      personality: { ambitious: 2.2, cruel: 1.6, kind: 0.3 },
      talents: { arcane_savant: 2.5, archmage: 2.5 },
      armory: { runed_staff: 3 },
    },
  },
  ogre: {
    id: 'ogre',
    name: 'Ogre',
    description: 'Very large, very hungry, surprisingly sentimental.',
    names: NAMES.ogre,
    odds: {
      archetype: { barbarian: 3, warrior: 1.6, mage: 0.5, rogue: 0.3 },
      fate: { demon_lord: 1.3 },
      personality: { greedy: 1.6, reckless: 1.4, curious: 0.5 },
      talents: { unbreakable: 1.6, arcane_savant: 0.3 },
      armory: { war_axe: 1.6 },
    },
  },
  minotaur: {
    id: 'minotaur',
    name: 'Minotaur',
    description: 'Never lost in any maze, never far from a fight.',
    names: NAMES.minotaur,
    odds: {
      archetype: { barbarian: 2.5, warrior: 2, rogue: 0.4 },
      personality: { brave: 1.6, reckless: 1.8, cautious: 0.5 },
      talents: { blademaster: 1.6 },
      armory: { war_axe: 2.5 },
    },
  },
  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    description: 'Two shapes, one appetite.',
    names: NAMES.werewolf,
    odds: {
      archetype: { barbarian: 2, ranger: 1.6, druid: 1.6 },
      fate: { cursed: 1.8 },
      personality: { reckless: 1.6, cruel: 1.3 },
      talents: { shadowstep: 1.3, unbreakable: 1.3 },
    },
  },
  vampire: {
    id: 'vampire',
    name: 'Vampire',
    description: 'Old, elegant, and always thirsty.',
    names: NAMES.vampire,
    odds: {
      archetype: { rogue: 1.8, warlock: 2, necromancer: 1.6, cleric: 0.1, paladin: 0.1 },
      fate: { cursed: 2.2, blessed: 0.1, demon_lord: 2 },
      personality: { cruel: 1.8, ambitious: 2, kind: 0.4 },
      talents: { arcane_savant: 1.5, shadowstep: 1.5 },
    },
  },
  gnome: {
    id: 'gnome',
    name: 'Gnome',
    description: 'Small hands, big ideas, frequent explosions.',
    names: NAMES.gnome,
    odds: {
      archetype: { artificer: 3, mage: 1.8, bard: 1.4, barbarian: 0.2, warrior: 0.5 },
      personality: { curious: 2.2, cautious: 1.4, cruel: 0.4 },
      talents: { arcane_savant: 1.6 },
      armory: { runed_staff: 1.6, war_axe: 0.3 },
    },
  },
  construct: {
    id: 'construct',
    name: 'Construct',
    description: 'Built, not born. Gears, runes, or stone where a heart should be.',
    names: NAMES.construct,
    odds: {
      archetype: { warrior: 2.2, artificer: 1.6, monk: 1.2, bard: 0.3, druid: 0.2 },
      fate: { blessed: 0.6, cursed: 0.8 },
      personality: { honorable: 1.8, cautious: 1.6, kind: 0.6, curious: 0.6 },
      talents: { unbreakable: 2.5 },
      armory: { war_axe: 1.4 },
    },
  },
  god: {
    id: 'god',
    name: 'God',
    description: 'Worshipped before they could walk. Every domain belongs to one god alone.',
    names: NAMES.god,
    odds: {
      archetype: { cleric: 2, paladin: 1.8, mage: 1.6, druid: 1.4 },
      fate: { blessed: 3, cursed: 0.15, demon_lord: 0.4 },
      personality: { ambitious: 1.8, honorable: 1.5, cruel: 0.6 },
      talents: { archmage: 2, holy_sword: 1.5 },
    },
  },
  // Natural-born demons: the family, and the race each sin makes of them.
  demon: {
    id: 'demon',
    name: 'Demon',
    description: 'A child of the Abyss walking the upper world.',
    names: NAMES.demon,
    odds: {
      archetype: { warlock: 3, necromancer: 2.2, barbarian: 1.4, cleric: 0.05, paladin: 0.05 },
      fate: { demon_lord: 3, cursed: 2.5, blessed: 0.05 },
      personality: { cruel: 2.5, ambitious: 2.2, greedy: 1.6, kind: 0.15, honorable: 0.2 },
      talents: { shadowstep: 1.4 },
    },
  },
  archfiend: { id: 'archfiend', name: 'Archfiend', family: 'demon', description: 'Pride given horns and a throne-shaped ambition.' },
  hoardfiend: { id: 'hoardfiend', name: 'Hoardfiend', family: 'demon', description: 'Greed with claws. Counts souls like coins.' },
  succubus: { id: 'succubus', name: 'Succubus', family: 'demon', names: NAMES.succubus, description: 'Lust in a lovely shape. The shape is a lie.' },
  incubus: { id: 'incubus', name: 'Incubus', family: 'demon', names: NAMES.incubus, description: 'Lust with a winning smile and a bargain ready.' },
  doppelganger: { id: 'doppelganger', name: 'Doppelganger', family: 'demon', description: 'Envy that wears your face better than you do.' },
  maw_demon: { id: 'maw_demon', name: 'Maw Demon', family: 'demon', description: 'Gluttony: all teeth, no bottom.' },
  balor: { id: 'balor', name: 'Balor', family: 'demon', description: 'Wrath made of fire and a whip of flame.' },
  dreamfiend: { id: 'dreamfiend', name: 'Dreamfiend', family: 'demon', description: 'Sloth that steals your sleep, then your will.' },
} satisfies Record<string, Race>;

export type RaceId = keyof typeof RACES;

/**
 * True for the race itself and every race of its family: isRace('elf') holds for a Wood Elf.
 * A hybrid counts as both of their races.
 */
export const isRace = (race: RaceId) => (_world: World, char: Character) =>
  racesOf(char).some((r) => r === race || (RACES as Record<string, Race>)[r]?.family === race);

export const RACE_TRAITS = {
  draconic_blood: { id: 'draconic_blood', name: 'Draconic Blood', description: 'Scales turn steel. Breath turns battles.', power: 25 },
  celestial_grace: { id: 'celestial_grace', name: 'Celestial Grace', description: 'A halo no one else can see. The light can.', power: 40 },
  moonstruck: { id: 'moonstruck', name: 'Moonstruck', description: 'Stronger under a full moon, and harder to kill.', power: 30 },
  vampiric: { id: 'vampiric', name: 'Vampiric', description: 'Takes back every wound, one drop at a time.', power: 45 },
  starlight: { id: 'starlight', name: 'Starlight', description: 'A little of the sky still clings to them.', power: 35 },
  dawn_herald: { id: 'dawn_herald', name: 'Herald of Dawn', description: 'Where they walk, the night gives way.', power: 40 },
  gang_boss: { id: 'gang_boss', name: 'Gang Boss', description: 'A handful of goblins do what they say. Mostly.', power: 20 },
  band_boss: { id: 'band_boss', name: 'Band Chief', description: 'A whole raiding band follows them into trouble.', power: 35 },
  horde_warboss: { id: 'horde_warboss', name: 'Horde Warboss', description: 'A sea of goblins, and one voice it listens to.', power: 60 },
  phylactery_spark: { id: 'phylactery_spark', name: 'Phylactery', description: 'Their soul is kept somewhere safer than their bones.', power: 45 },
  labyrinth_lord: { id: 'labyrinth_lord', name: 'Lord of the Labyrinth', description: 'Every maze opens for them.', power: 40 },
  pack_alpha: { id: 'pack_alpha', name: 'Pack Alpha', description: 'Where they run, wolves follow.', power: 40 },
  ancient_blood: { id: 'ancient_blood', name: 'Ancient Blood', description: 'Older than the oldest kingdom, and patient.', power: 50 },
  clockwork_companion: { id: 'clockwork_companion', name: 'Clockwork Companion', description: 'It walks, it talks, it bites strangers.', power: 40 },
} satisfies Record<string, Trait>;

// ─── Wheel 1: Ancestry ──────────────────────────────────────────────────────
// Who they are born as. Each race then has a wheel (or two) of its own.

/** How strongly an heir's ancestry follows their parent's: their parent's slice, this many times over. */
const HEIR_ANCESTRY_PULL = 15;

/** An heir is most likely born to their parent's ancestry; a different one means they were taken in. */
function withBloodline(step: WheelStep): WheelStep {
  return {
    ...step,
    options: step.options.map((o) => ({
      ...o,
      vary: (char) => (char.lineage?.ancestry === o.id ? { baseWeight: o.baseWeight * HEIR_ANCESTRY_PULL } : {}),
    })),
  };
}

/**
 * The Ancestry wheel's slices. Corrupted demons, ascended angels, undead constructs and hybrids
 * roll this same wheel again (see otherworldly.ts), minus the origin that sent them there.
 */
export const ANCESTRY_OPTIONS: WheelOption[] = [
  { id: 'human', label: 'Human', description: 'Adaptable to a fault.', baseWeight: 34, rarity: 'common', setRace: 'human', nextStepId: 'human_homeland', color: '#c2874f', icon: 'User' },
  { id: 'elf', label: 'Elf', description: 'Born listening to things no one else can hear. But which elves?', baseWeight: 16, rarity: 'uncommon', setRace: 'elf', nextStepId: 'elf_lineage', color: '#2f9e7a', icon: 'Leaf' },
  { id: 'dwarf', label: 'Dwarf', description: 'Carved more than born.', baseWeight: 16, rarity: 'uncommon', setRace: 'dwarf', nextStepId: 'dwarf_clan', color: '#9b4d32', icon: 'Pickaxe' },
  { id: 'orc', label: 'Orc', description: 'The war-drums started before you could walk.', baseWeight: 14, rarity: 'uncommon', setRace: 'orc', nextStepId: 'orc_standing', color: '#5d7d24', icon: 'BicepsFlexed' },
  {
    id: 'halfling',
    label: 'Halfling',
    description: 'Easy to overlook, and luckier than they have any right to be.',
    baseWeight: 12,
    rarity: 'uncommon',
    setRace: 'halfling',
    luckDelta: 0.5,
    nextStepId: 'halfling_hearth',
    color: '#4f86b8',
    icon: 'Clover',
  },
  { id: 'gnome', label: 'Gnome', description: 'Small hands, big ideas, frequent explosions.', baseWeight: 10, rarity: 'uncommon', setRace: 'gnome', nextStepId: 'gnome_workshop', color: '#b06ab8', icon: 'Cog' },
  {
    id: 'monster',
    label: 'Monster',
    description: 'Something people lock their doors against. But which something?',
    baseWeight: 8,
    rarity: 'uncommon',
    grantTags: ['monster'],
    nextStepId: 'monster_type',
    color: '#5c4b3c',
    icon: 'PawPrint',
  },
  {
    id: 'dragonborn',
    label: 'Dragonborn',
    description: 'Hatched, not born, and proud of it.',
    baseWeight: 5,
    rarity: 'rare',
    setRace: 'dragonborn',
    grantTraits: ['draconic_blood'],
    nextStepId: 'dragon_bloodline',
    color: '#b8323a',
    icon: 'Egg',
  },
  {
    id: 'construct',
    label: 'Construct',
    description: 'Built, not born. But by whom, and how?',
    baseWeight: 2.5,
    rarity: 'epic',
    grantTags: ['construct'],
    nextStepId: 'construct_type',
    color: '#8a8f9a',
    icon: 'Bot',
  },
  {
    id: 'celestial', // the id predates the name: rolled as Angel
    label: 'Angel',
    description: 'Born of light, or raised to it. Almost never corrupted.',
    baseWeight: 1.2,
    rarity: 'legendary',
    threatScaling: -0.1, // the heavens look away as the world darkens
    grantTags: ['angel'],
    queueSpins: { blessed_powers: 1 },
    nextStepId: 'angel_origin',
    color: '#e9dcae',
    icon: 'Feather',
  },
  {
    id: 'demon',
    label: 'Demon',
    description: 'The Abyss has a child up here. Very few stay on the right side.',
    baseWeight: 1.2,
    rarity: 'legendary',
    threatScaling: 0.2, // the dark calls its own
    grantTags: ['fiend'],
    queueSpins: { corrupted_powers: 1 },
    nextStepId: 'fiend_origin',
    color: '#9a1c2e',
    icon: 'Flame',
  },
  {
    id: 'god',
    label: 'God',
    description: 'A god, born into the world. Three blessed powers, and a domain no other god may hold.',
    baseWeight: 0.4,
    rarity: 'mythical',
    setRace: 'god',
    grantTags: ['divine'],
    queueSpins: { blessed_powers: 3 },
    nextStepId: 'god_domain',
    color: '#ffe08a',
    icon: 'Sun',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Two bloodlines in one body. Spin Ancestry twice: both races, and everything both of them give.',
    baseWeight: 1.2,
    rarity: 'legendary',
    grantTags: ['hybrid'],
    queueSpins: { hybrid_second: 1 },
    epithet: { text: 'the Twice-Born', priority: 40 },
    nextStepId: 'hybrid_first',
    color: '#ffb84d',
    icon: 'Dna',
  },
];

export const ANCESTRY: WheelStep = withBloodline({
  id: 'ancestry',
  title: 'Wheel of Ancestry',
  subtitle: 'Every soul begins here.',
  options: ANCESTRY_OPTIONS,
});

export const MONSTER_TYPE: WheelStep = {
  id: 'monster_type',
  title: 'What Kind of Monster?',
  subtitle: 'Every village has a story about one of these.',
  options: [
    { id: 'goblin', label: 'Goblin', description: 'Quick hands, quicker excuses.', baseWeight: 30, rarity: 'common', setRace: 'goblin', nextStepId: 'goblin_band', color: '#6b7a3a', icon: 'VenetianMask' },
    { id: 'kobold', label: 'Kobold', description: 'Small, clever, and always one trap ahead.', baseWeight: 22, rarity: 'common', setRace: 'kobold', luckDelta: 0.25, nextStepId: 'kobold_calling', color: '#a0603a', icon: 'Rat' },
    { id: 'lizardfolk', label: 'Lizardfolk', description: 'Hatched in the marsh, and in no hurry.', baseWeight: 20, rarity: 'common', setRace: 'lizardfolk', nextStepId: 'lizard_caste', color: '#3e7a5a', icon: 'Turtle' },
    { id: 'skeleton', label: 'Skeleton', description: 'Bones that forgot how to lie still.', baseWeight: 16, rarity: 'common', setRace: 'skeleton', nextStepId: 'undeath', color: '#c8c2b0', icon: 'Bone' },
    { id: 'ogre', label: 'Ogre', description: 'Big enough to be a weather event.', baseWeight: 12, rarity: 'uncommon', setRace: 'ogre', nextStepId: 'ogre_role', color: '#8a7a52', icon: 'Beef' },
    { id: 'minotaur', label: 'Minotaur', description: 'Horns first, questions never.', baseWeight: 9, rarity: 'uncommon', setRace: 'minotaur', nextStepId: 'labyrinth', color: '#7a3e2e', icon: 'Axe' },
    {
      id: 'werewolf',
      label: 'Werewolf',
      description: 'Bitten once. Changed forever.',
      baseWeight: 5,
      rarity: 'rare',
      setRace: 'werewolf',
      grantTraits: ['moonstruck'],
      nextStepId: 'the_turning',
      color: '#5a6478',
      icon: 'MoonStar',
    },
    {
      id: 'vampire',
      label: 'Vampire',
      description: 'Dead for a century, and only getting started.',
      baseWeight: 2,
      rarity: 'epic',
      threatScaling: 0.2, // the night grows longer
      setRace: 'vampire',
      grantTraits: ['vampiric'],
      nextStepId: 'bloodline',
      color: '#8a1c2e',
      icon: 'Droplets',
    },
  ],
};

// ─── Race wheels ────────────────────────────────────────────────────────────

/** Every race's wheels end at the Archetype wheel. */
export const ARCHETYPE_STEP = 'archetype';

/** An option on a race wheel: leads to Archetype unless it says otherwise. */
export type RaceOption = Omit<WheelOption, 'nextStepId'> & { nextStepId?: WheelOption['nextStepId'] };

export function raceWheel(id: string, title: string, subtitle: string, options: RaceOption[]): WheelStep {
  return { id, title, subtitle, options: options.map((o) => ({ nextStepId: ARCHETYPE_STEP, ...o })) };
}

/** A race wheel whose options lead somewhere other than Archetype, unless they say otherwise. */
export function leadingTo(next: string, id: string, title: string, subtitle: string, options: RaceOption[]): WheelStep {
  return raceWheel(id, title, subtitle, options.map((o) => ({ nextStepId: next, ...o })));
}

const HUMAN_HOMELAND = raceWheel('human_homeland', 'Where Were You Raised?', 'Every human comes from somewhere small.', [
  { id: 'farmstead', label: 'Farmstead', description: 'Early mornings and strong backs.', baseWeight: 34, rarity: 'common', statBonus: { vitality: 1 }, epithet: { text: 'of the Fields', priority: 5 }, color: '#a8893e', icon: 'Wheat' },
  { id: 'city_streets', label: 'City Streets', description: 'Quick feet, quicker wits.', baseWeight: 30, rarity: 'common', statBonus: { agility: 1, intellect: 1 }, epithet: { text: 'of the Alleys', priority: 5 }, color: '#5f6f86', icon: 'Landmark' },
  { id: 'frontier', label: 'The Frontier', description: 'Where the maps run out.', baseWeight: 18, rarity: 'uncommon', statBonus: { might: 1, vitality: 1 }, epithet: { text: 'of the Marches', priority: 6 }, color: '#7a5a3a', icon: 'Tent' },
  { id: 'temple_ward', label: 'Temple Ward', description: 'Raised on prayers and old books.', baseWeight: 12, rarity: 'uncommon', statBonus: { arcana: 1, intellect: 1 }, epithet: { text: 'of the Temple', priority: 6 }, color: '#8a7ab8', icon: 'Church' },
  { id: 'noble_house', label: 'Noble House', description: 'A name that opens doors, and enemies who know it.', baseWeight: 6, rarity: 'rare', luckDelta: 0.5, epithet: { text: 'of Noble Blood', priority: 30 }, color: '#c9a24c', icon: 'Castle' },
  { id: 'foretold_child', label: 'Born Under a Prophecy', description: 'A comet at their birth, and a seer at the door. The prophecy will come due on the road.', baseWeight: 3, rarity: 'epic', luckDelta: 1, grantTags: ['hook:prophecy'], epithet: { text: 'the Foretold Child', priority: 50 }, color: '#ffe08a', icon: 'Star' },
]);

const ELF_LINEAGE = raceWheel('elf_lineage', 'Which Elven Line?', 'The forests remember every family.', [
  { id: 'wood_elf', label: 'Wood Elf', description: 'Bow, leaf and silence.', baseWeight: 40, rarity: 'common', setRace: 'wood_elf', epithet: { text: 'of the Greenwood', priority: 8 }, color: '#3f8a4a', icon: 'Trees' },
  { id: 'high_elf', label: 'High Elf', description: 'Towers of silver and very long memories.', baseWeight: 24, rarity: 'uncommon', setRace: 'high_elf', epithet: { text: 'of the Silver Spires', priority: 10 }, color: '#7aa7d9', icon: 'Sparkles' },
  { id: 'dark_elf', label: 'Dark Elf', description: 'Raised under the world, where trust is a weakness.', baseWeight: 20, rarity: 'uncommon', setRace: 'dark_elf', epithet: { text: 'of the Underdark', priority: 10 }, color: '#4a3a6e', icon: 'Moon' },
  { id: 'moon_elf', label: 'Moon Elf', description: 'Blessed by a pale sky.', baseWeight: 12, rarity: 'rare', setRace: 'moon_elf', luckDelta: 0.5, epithet: { text: 'Moonblessed', priority: 25 }, color: '#b8c4e0', icon: 'MoonStar' },
  { id: 'star_elf', label: 'Star Elf', description: 'Fell with the stars, and never quite landed.', baseWeight: 4, rarity: 'epic', setRace: 'star_elf', grantTraits: ['starlight'], epithet: { text: 'the Starborn', priority: 45 }, color: '#e6d48a', icon: 'Star' },
]);

const DWARF_CLAN = raceWheel('dwarf_clan', 'Which Clan?', 'A dwarf without a clan is a rock without a mountain.', [
  { id: 'ironfist', label: 'Clan Ironfist', description: 'They solve problems by hitting them.', baseWeight: 30, rarity: 'common', statBonus: { might: 1 }, surname: 'Ironfist', color: '#7a4a3a', icon: 'Hammer' },
  { id: 'stonehelm', label: 'Clan Stonehelm', description: 'Patient as the mountain, twice as stubborn.', baseWeight: 28, rarity: 'common', statBonus: { vitality: 1 }, surname: 'Stonehelm', color: '#6e6a62', icon: 'Shield' },
  { id: 'deepdelver', label: 'Clan Deepdelver', description: 'They dug too deep, and found something worth it.', baseWeight: 18, rarity: 'uncommon', statBonus: { intellect: 1 }, luckDelta: 0.25, surname: 'Deepdelver', color: '#3f5a6e', icon: 'Shovel' },
  { id: 'goldbeard', label: 'Clan Goldbeard', description: 'Rich, and determined to stay that way.', baseWeight: 16, rarity: 'uncommon', luckDelta: 0.5, surname: 'Goldbeard', color: '#c9a24c', icon: 'Coins' },
  { id: 'runeforged', label: 'Clan Runeforged', description: 'Their names are carved into the oldest doors.', baseWeight: 8, rarity: 'rare', statBonus: { arcana: 2 }, surname: 'Runeforged', epithet: { text: 'Rune-Born', priority: 25 }, color: '#4f7a9a', icon: 'Gem' },
  { id: 'lost_hold', label: 'Heir of the Lost Hold', description: 'The last of a royal line whose mountain fell. They carry its crown.', baseWeight: 3, rarity: 'epic', grantTraits: ['old_kings_relic'], statBonus: { might: 1, vitality: 1 }, surname: 'Kingsdeep', epithet: { text: 'Heir of the Lost Hold', priority: 55 }, color: '#ffd76a', icon: 'Crown' },
]);

const ORC_STANDING = raceWheel('orc_standing', 'Standing in the Warband', 'Every orc earns a place, or takes one.', [
  { id: 'grunt', label: 'Grunt', description: 'At the front, where the shouting is.', baseWeight: 36, rarity: 'common', statBonus: { vitality: 1 }, epithet: { text: 'of the Warband', priority: 6 }, color: '#5d6b3a', icon: 'Shield' },
  { id: 'raider', label: 'Raider', description: 'First over the wall, first to the loot.', baseWeight: 26, rarity: 'common', statBonus: { agility: 1 }, epithet: { text: 'the Raider', priority: 12 }, color: '#8a5a2e', icon: 'Swords' },
  { id: 'berserker', label: 'Berserker', description: 'Stops fighting when everything else does.', baseWeight: 18, rarity: 'uncommon', statBonus: { might: 2, intellect: -1 }, epithet: { text: 'the Berserker', priority: 25 }, color: '#8a2e2e', icon: 'Flame' },
  { id: 'shaman', label: 'Shaman', description: 'Talks to the spirits. Sometimes they answer.', baseWeight: 14, rarity: 'uncommon', statBonus: { arcana: 2 }, epithet: { text: 'the Shaman', priority: 25 }, color: '#4a6e5a', icon: 'Skull' },
  { id: 'warchief_blood', label: 'Warchief’s Blood', description: 'Born to the warchief. Expected to be worth it.', baseWeight: 6, rarity: 'rare', statBonus: { might: 1 }, luckDelta: 0.5, epithet: { text: 'Blood of the Warchief', priority: 50 }, color: '#c9a24c', icon: 'Crown' },
  { id: 'war_god_marked', label: 'Marked by the War-God', description: 'Born with a scar shaped like an axe. The shamans fell silent.', baseWeight: 3, rarity: 'epic', statBonus: { might: 2 }, grantTraits: ['titans_strength'], epithet: { text: 'Chosen of the War-God', priority: 58 }, color: '#ffd76a', icon: 'Axe' },
]);

const HALFLING_HEARTH = raceWheel('halfling_hearth', 'Which Hearth?', 'There is always a kettle on somewhere.', [
  { id: 'hillfolk', label: 'Hillfolk', description: 'Round doors and second breakfasts.', baseWeight: 36, rarity: 'common', statBonus: { vitality: 1 }, surname: 'Underhill', color: '#6b8a3e', icon: 'Mountain' },
  { id: 'riverfolk', label: 'Riverfolk', description: 'Boats, fish, and gossip.', baseWeight: 30, rarity: 'common', statBonus: { agility: 1 }, surname: 'Reedwater', color: '#3f7a9a', icon: 'Fish' },
  { id: 'burglars_kin', label: 'Burglar’s Kin', description: 'Light fingers run in the family.', baseWeight: 22, rarity: 'uncommon', statBonus: { agility: 2 }, surname: 'Quickfoot', epithet: { text: 'the Light-Fingered', priority: 28 }, color: '#5a4a6e', icon: 'VenetianMask' },
  { id: 'lucky_star', label: 'Born Under a Lucky Star', description: 'Things just work out. Infuriatingly.', baseWeight: 12, rarity: 'rare', luckDelta: 0.5, surname: 'Fairbairn', epithet: { text: 'the Lucky', priority: 35 }, color: '#d9b25a', icon: 'Clover' },
  { id: 'ring_in_the_river', label: 'Found a Ring in the River', description: 'Old, plain, and humming. It hums louder when danger is near.', baseWeight: 3, rarity: 'epic', grantTraits: ['ancient_relic'], luckDelta: 0.5, surname: 'Brightwater', epithet: { text: 'the Ringfinder', priority: 48 }, color: '#ffd76a', icon: 'CircleDot' },
]);

const DRAGON_BLOODLINE = raceWheel('dragon_bloodline', 'Which Dragon’s Blood?', 'The colour of your scales is a promise.', [
  { id: 'red', label: 'Red Bloodline', description: 'Fire, pride, and a short temper.', baseWeight: 26, rarity: 'common', statBonus: { might: 2 }, epithet: { text: 'of the Red Flight', priority: 10 }, color: '#b8323a', icon: 'Flame' },
  { id: 'blue', label: 'Blue Bloodline', description: 'Lightning, and the patience to wait for it.', baseWeight: 24, rarity: 'common', statBonus: { agility: 2 }, epithet: { text: 'of the Blue Flight', priority: 10 }, color: '#3f6fb8', icon: 'Zap' },
  { id: 'green', label: 'Green Bloodline', description: 'Cunning, poison, and a pleasant smile.', baseWeight: 18, rarity: 'uncommon', statBonus: { intellect: 2 }, epithet: { text: 'of the Green Flight', priority: 10 }, color: '#3f8a4a', icon: 'Leaf' },
  { id: 'black', label: 'Black Bloodline', description: 'Acid, swamps, and a very thick hide.', baseWeight: 16, rarity: 'uncommon', statBonus: { vitality: 2 }, epithet: { text: 'of the Black Flight', priority: 10 }, color: '#3a3a42', icon: 'Shield' },
  { id: 'gold', label: 'Gold Bloodline', description: 'The rarest flight, and the kindest.', baseWeight: 10, rarity: 'rare', statBonus: { arcana: 1 }, luckDelta: 0.5, epithet: { text: 'of the Gold Flight', priority: 30 }, color: '#d9a400', icon: 'Sun' },
  { id: 'shadow', label: 'Shadow Bloodline', description: 'A flight no one admits to having seen.', baseWeight: 6, rarity: 'epic', statBonus: { arcana: 2, agility: 1 }, epithet: { text: 'of the Shadow Flight', priority: 35 }, color: '#2f2a4a', icon: 'Moon' },
]);

// Natural-born angels: which door of heaven they came through. Then their virtue (otherworldly.ts).
const CELESTIAL_ORIGIN = leadingTo('angel_virtue', 'celestial_origin', 'Where Did You Fall From?', 'Heaven has many doors.', [
  { id: 'fallen_star', label: 'Fallen Star', description: 'A spark that strayed too far.', baseWeight: 40, rarity: 'common', statBonus: { arcana: 1 }, epithet: { text: 'Starfallen', priority: 12 }, color: '#e6d48a', icon: 'Star' },
  { id: 'angelic_echo', label: 'Angelic Echo', description: 'An old choir, still faintly singing.', baseWeight: 30, rarity: 'common', statBonus: { vitality: 1, intellect: 1 }, epithet: { text: 'the Radiant', priority: 20 }, color: '#f0e6c8', icon: 'Sunrise' },
  { id: 'exiled_seraph', label: 'Exiled Seraph', description: 'Thrown out of heaven. Not sorry.', baseWeight: 20, rarity: 'uncommon', statBonus: { might: 2 }, epithet: { text: 'the Exiled', priority: 25 }, color: '#b8913a', icon: 'Flame' },
  { id: 'herald_of_dawn', label: 'Herald of Dawn', description: 'Sent ahead of the morning, on purpose.', baseWeight: 10, rarity: 'rare', luckDelta: 0.5, grantTraits: ['dawn_herald'], epithet: { text: 'Herald of Dawn', priority: 55 }, color: '#f5c46a', icon: 'Sun' },
  { id: 'highest_choir', label: 'Fell From the Throne Itself', description: 'From the highest choir, the one that sings to the gods.', baseWeight: 3, rarity: 'epic', statBonus: { arcana: 3 }, grantTraits: ['dawn_herald', 'divine_favor'], epithet: { text: 'of the Highest Choir', priority: 65 }, color: '#fff4c2', icon: 'Sunrise' },
]);


const GNOME_WORKSHOP = raceWheel('gnome_workshop', 'What Do You Tinker With?', 'Every gnome has a workbench. Most have scorch marks.', [
  { id: 'clockwork', label: 'Clockwork', description: 'Springs, cogs, and a ticking you can’t find.', baseWeight: 34, rarity: 'common', statBonus: { intellect: 1 }, surname: 'Cogsworth', epithet: { text: 'the Tinker', priority: 12 }, color: '#a8893e', icon: 'Cog' },
  { id: 'illusions', label: 'Illusions', description: 'Nothing is quite where it looks.', baseWeight: 28, rarity: 'common', statBonus: { arcana: 1 }, surname: 'Glimmerwick', epithet: { text: 'the Illusionist', priority: 15 }, color: '#8a6ae0', icon: 'Sparkles' },
  { id: 'gemcutting', label: 'Gemcutting', description: 'A good eye, and a lucky one.', baseWeight: 18, rarity: 'uncommon', luckDelta: 0.5, surname: 'Gemhollow', epithet: { text: 'the Gemcutter', priority: 12 }, color: '#3fa8a0', icon: 'Gem' },
  { id: 'pranks', label: 'Pranks', description: 'Engineering, technically.', baseWeight: 14, rarity: 'uncommon', statBonus: { agility: 1 }, surname: 'Fizzlebang', epithet: { text: 'the Prankster', priority: 14 }, color: '#d9688a', icon: 'VenetianMask' },
  { id: 'grand_invention', label: 'A Grand Invention', description: 'It walks, it talks, it follows you around.', baseWeight: 6, rarity: 'rare', grantTraits: ['clockwork_companion'], surname: 'Sparkwright', epithet: { text: 'the Inventor', priority: 40 }, color: '#c9a24c', icon: 'Bot' },
  { id: 'clockwork_dragon', label: 'A Clockwork Dragon', description: 'Brass wings, a furnace heart, and it thinks they are its mother.', baseWeight: 1.5, rarity: 'legendary', grantTraits: ['clockwork_companion', 'companion_dragon'], surname: 'Sparkwright', epithet: { text: 'Maker of the Brass Dragon', priority: 62 }, color: '#ffb84d', icon: 'Egg' },
]);

// Goblins: how big the band is, then where they stand in it.
const GOBLIN_BAND = raceWheel('goblin_band', 'How Big Is the Band?', 'Goblins are never alone. Almost never.', [
  { id: 'small_gang', label: 'Small Gang', description: 'Five goblins, one plan, no agreement.', baseWeight: 38, rarity: 'common', nextStepId: 'goblin_place_gang', color: '#6b7a3a', icon: 'Users' },
  { id: 'raiding_band', label: 'Raiding Band', description: 'Thirty goblins and a stolen cart.', baseWeight: 32, rarity: 'common', nextStepId: 'goblin_place_band', color: '#7a6a2e', icon: 'Flag' },
  { id: 'great_horde', label: 'Great Horde', description: 'A tide of goblins. The ground shakes.', baseWeight: 18, rarity: 'uncommon', nextStepId: 'goblin_place_horde', color: '#8a3e2e', icon: 'Swords' },
  { id: 'lone_goblin', label: 'Lone Goblin', description: 'The band is a band of one, and it votes for you.', baseWeight: 12, rarity: 'uncommon', statBonus: { agility: 1 }, luckDelta: 0.25, epithet: { text: 'the Lone', priority: 20 }, color: '#4a5a3a', icon: 'User' },
  { id: 'goblin_kings_child', label: 'The Goblin King’s Lost Child', description: 'Every goblin in the hills knows the face. Every one of them kneels.', baseWeight: 3, rarity: 'epic', grantTraits: ['horde_warboss'], luckDelta: 0.5, epithet: { text: 'Heir of the Goblin King', priority: 78 }, color: '#ffd76a', icon: 'Crown' },
]);

/** Where a goblin stands in its band. The bigger the band, the rarer (and grander) the boss. */
function goblinPlace(size: 'gang' | 'band' | 'horde'): WheelStep {
  const spec = {
    gang: { band: 'the Gang', weights: [25, 40, 15, 20], boss: 'Boss of the Gang', trait: 'gang_boss', priority: 45, bossRarity: 'uncommon' as const },
    band: { band: 'the Raiding Band', weights: [28, 45, 18, 9], boss: 'Chief of the Raiding Band', trait: 'band_boss', priority: 55, bossRarity: 'rare' as const },
    horde: { band: 'the Great Horde', weights: [30, 50, 16, 4], boss: 'Warboss of the Great Horde', trait: 'horde_warboss', priority: 75, bossRarity: 'epic' as const },
  }[size];
  const [runt, grunt, lieutenant, boss] = spec.weights as [number, number, number, number];
  return raceWheel(`goblin_place_${size}`, 'Your Place in the Band', `Somebody has to lead ${spec.band}. Is it you?`, [
    { id: 'runt', label: 'Runt', description: 'Last to eat, first to be blamed.', baseWeight: runt, rarity: 'common', statBonus: { agility: 1 }, epithet: { text: 'the Runt', priority: 12 }, color: '#5a5a42', icon: 'Rat' },
    { id: 'grunt', label: 'Grunt', description: 'One of the crowd. A loud part of it.', baseWeight: grunt, rarity: 'common', statBonus: { vitality: 1 }, epithet: { text: `of ${spec.band}`, priority: 6 }, color: '#6b7a3a', icon: 'Users' },
    { id: 'lieutenant', label: 'Lieutenant', description: 'Close enough to the boss to want the job.', baseWeight: lieutenant, rarity: 'uncommon', statBonus: { might: 1 }, epithet: { text: `Lieutenant of ${spec.band}`, priority: 30 }, color: '#8a6a2e', icon: 'Flag' },
    {
      id: 'boss',
      label: 'The Boss',
      description: 'They follow you. You are the leader.',
      baseWeight: boss,
      rarity: spec.bossRarity,
      luckDelta: 0.25,
      grantTraits: [spec.trait],
      epithet: { text: spec.boss, priority: spec.priority },
      color: '#c9a24c',
      icon: 'Crown',
    },
    // The horde's boss is already epic. Smaller bands have one more door: the boss of every band.
    ...(size === 'horde'
      ? []
      : [{ id: 'boss_of_bosses', label: 'Boss of Every Boss', description: 'They didn’t take over the band. They took over all of them.', baseWeight: 2, rarity: 'epic' as const, luckDelta: 0.5, grantTraits: ['horde_warboss'], epithet: { text: 'Warboss Over Them All', priority: 70 }, color: '#ffd76a', icon: 'Crown' }]),
  ]);
}

const KOBOLD_CALLING = raceWheel('kobold_calling', 'What Does the Warren Need?', 'Every kobold has a job. Usually a dangerous one.', [
  { id: 'trapmaker', label: 'Trapmaker', description: 'Wires, springs, and a nasty sense of humour.', baseWeight: 32, rarity: 'common', statBonus: { intellect: 1 }, epithet: { text: 'the Trapmaker', priority: 15 }, color: '#8a6a3a', icon: 'Bomb' },
  { id: 'tunneler', label: 'Tunneler', description: 'Dig first. Ask where later.', baseWeight: 30, rarity: 'common', statBonus: { vitality: 1 }, epithet: { text: 'the Tunneler', priority: 10 }, color: '#6e5a42', icon: 'Shovel' },
  { id: 'scout', label: 'Scout', description: 'Sees you long before you see them.', baseWeight: 22, rarity: 'uncommon', statBonus: { agility: 1 }, epithet: { text: 'the Scout', priority: 12 }, color: '#4f6a4a', icon: 'Eye' },
  { id: 'dragon_priest', label: 'Dragon-Priest', description: 'Speaks for a dragon who may or may not be listening.', baseWeight: 12, rarity: 'rare', statBonus: { arcana: 2 }, epithet: { text: 'Voice of the Dragon', priority: 45 }, color: '#b8452a', icon: 'Flame' },
  { id: 'dragon_hatched', label: 'Hatched in a Dragon’s Clutch', description: 'The egg was in the wrong nest. What hatched was more dragon than kobold.', baseWeight: 3, rarity: 'epic', setRace: 'dragonborn', grantTraits: ['draconic_blood'], epithet: { text: 'the Dragon-Hatched', priority: 55 }, color: '#ffb84d', icon: 'Egg' },
]);

const LIZARD_CASTE = raceWheel('lizard_caste', 'Which Caste?', 'The swamp sorts its children early.', [
  { id: 'hunter', label: 'Hunter', description: 'Still as a log. Then not.', baseWeight: 36, rarity: 'common', statBonus: { agility: 1 }, epithet: { text: 'the Hunter', priority: 12 }, color: '#3e7a5a', icon: 'Target' },
  { id: 'scale_warden', label: 'Scale-Warden', description: 'Guards the eggs. Guards them very well.', baseWeight: 28, rarity: 'common', statBonus: { vitality: 1 }, epithet: { text: 'the Scale-Warden', priority: 15 }, color: '#4a6e4a', icon: 'Shield' },
  { id: 'swamp_shaman', label: 'Swamp Shaman', description: 'Reads the bubbles in the mud.', baseWeight: 22, rarity: 'uncommon', statBonus: { arcana: 2 }, epithet: { text: 'the Swamp Shaman', priority: 22 }, color: '#5a4a6e', icon: 'WandSparkles' },
  { id: 'old_brood', label: 'Hatchling of the Old Brood', description: 'From eggs older than the swamp itself.', baseWeight: 14, rarity: 'rare', statBonus: { might: 1 }, luckDelta: 0.25, epithet: { text: 'of the Old Brood', priority: 35 }, color: '#8a7a3a', icon: 'Egg' },
  { id: 'swamp_gods_chosen', label: 'Chosen of the Swamp God', description: 'Something vast moved under the water, and looked at them.', baseWeight: 3, rarity: 'epic', statBonus: { arcana: 2, vitality: 2 }, grantTraits: ['divine_favor'], epithet: { text: 'Chosen of the Swamp God', priority: 52 }, color: '#ffd76a', icon: 'Eye' },
]);

const UNDEATH = raceWheel('undeath', 'What Stirs in the Bones?', 'Something woke you. What came back with it?', [
  { id: 'mindless', label: 'Mindless Bones', description: 'Clatter, shuffle, clatter.', baseWeight: 34, rarity: 'common', statBonus: { vitality: 1, intellect: -1 }, epithet: { text: 'the Mindless', priority: 10 }, color: '#9a948a', icon: 'Bone' },
  { id: 'restless', label: 'Restless Warrior', description: 'Died fighting. Still fighting.', baseWeight: 30, rarity: 'common', statBonus: { might: 2 }, epithet: { text: 'the Restless', priority: 15 }, color: '#7a6a5a', icon: 'Sword' },
  { id: 'bone_knight', label: 'Bone Knight', description: 'Rusted armour, perfect posture.', baseWeight: 22, rarity: 'uncommon', statBonus: { might: 1, vitality: 1 }, epithet: { text: 'the Bone Knight', priority: 35 }, color: '#5f6470', icon: 'Shield' },
  {
    id: 'spark_of_sorcery',
    label: 'Spark of Sorcery',
    description: 'The spark grows. You will not stay a skeleton for long: you are a Lich.',
    baseWeight: 14,
    rarity: 'rare',
    setRace: 'lich', // a new race: the Lich's stat tiers and odds apply from here on
    grantTraits: ['phylactery_spark'],
    epithet: { text: 'the Lich', priority: 70 },
    color: '#4a2f7a',
    icon: 'Sparkles',
  },
  { id: 'death_knight', label: 'A Death Knight', description: 'They swore an oath in life. Death did not release them from it.', baseWeight: 3, rarity: 'epic', statBonus: { might: 3, vitality: 2 }, grantTraits: ['iron_will'], epithet: { text: 'the Death Knight', priority: 62 }, color: '#ffd76a', icon: 'Shield' },
]);

const OGRE_ROLE = raceWheel('ogre_role', 'What Does the Clan Make of You?', 'Ogres respect two things: size, and dinner.', [
  { id: 'brute', label: 'Brute', description: 'Big. Loud. Effective.', baseWeight: 40, rarity: 'common', statBonus: { might: 1 }, epithet: { text: 'the Brute', priority: 12 }, color: '#7a6a42', icon: 'Beef' },
  { id: 'clan_cook', label: 'Clan Cook', description: 'The most important ogre in any clan.', baseWeight: 26, rarity: 'common', statBonus: { vitality: 2 }, epithet: { text: 'the Cook', priority: 15 }, color: '#8a5a3a', icon: 'Utensils' },
  { id: 'clan_chief', label: 'Clan Chief', description: 'Won the job by sitting on the last chief.', baseWeight: 24, rarity: 'uncommon', statBonus: { might: 1 }, luckDelta: 0.25, epithet: { text: 'Chief of the Clan', priority: 40 }, color: '#c9a24c', icon: 'Crown' },
  { id: 'ogre_mage', label: 'Ogre Mage', description: 'Nobody expected it. Least of all them.', baseWeight: 10, rarity: 'rare', statBonus: { arcana: 3, intellect: 1 }, epithet: { text: 'the Ogre Mage', priority: 45 }, color: '#4f5a9a', icon: 'WandSparkles' },
  { id: 'ogre_titan', label: 'An Ogre Titan', description: 'They kept growing. The clan had to build a new hall.', baseWeight: 3, rarity: 'epic', statBonus: { might: 4 }, grantTraits: ['titans_strength'], epithet: { text: 'the Ogre Titan', priority: 58 }, color: '#ffd76a', icon: 'Mountain' },
]);

const LABYRINTH = raceWheel('labyrinth', 'What Did the Labyrinth Make You?', 'Every minotaur is born in a maze. Few leave it.', [
  { id: 'maze_born', label: 'Maze-Born', description: 'Knows every turn, and every way out.', baseWeight: 38, rarity: 'common', statBonus: { intellect: 1 }, epithet: { text: 'of the Labyrinth', priority: 8 }, color: '#7a5a3a', icon: 'Route' },
  { id: 'escaped_the_pits', label: 'Escaped the Pits', description: 'The chains are still around somewhere.', baseWeight: 28, rarity: 'common', statBonus: { agility: 1 }, epithet: { text: 'the Unchained', priority: 20 }, color: '#5a5f6e', icon: 'Unlink' },
  { id: 'arena_champion', label: 'Arena Champion', description: 'The crowd still chants the name.', baseWeight: 24, rarity: 'uncommon', statBonus: { might: 2 }, epithet: { text: 'Champion of the Arena', priority: 40 }, color: '#8a2e2e', icon: 'Trophy' },
  { id: 'labyrinth_lord', label: 'Lord of the Labyrinth', description: 'The maze rearranges itself for them.', baseWeight: 10, rarity: 'rare', luckDelta: 0.25, grantTraits: ['labyrinth_lord'], epithet: { text: 'Lord of the Labyrinth', priority: 60 }, color: '#c9a24c', icon: 'Crown' },
  { id: 'first_maze', label: 'Born of the First Maze', description: 'The labyrinth all the others copy. It made them its guardian.', baseWeight: 3, rarity: 'epic', statBonus: { might: 2, intellect: 2 }, grantTraits: ['labyrinth_lord', 'guardian_oath'], epithet: { text: 'Heir of the First Maze', priority: 68 }, color: '#ffd76a', icon: 'Route' },
]);

const THE_TURNING = raceWheel('the_turning', 'How Did the Wolf Find You?', 'Some are bitten. Some are born. Some bite back.', [
  { id: 'bitten', label: 'Bitten', description: 'One bad night in the woods.', baseWeight: 40, rarity: 'common', statBonus: { vitality: 1 }, epithet: { text: 'the Bitten', priority: 10 }, color: '#5a6478', icon: 'Moon' },
  { id: 'born_wolf', label: 'Born a Wolf', description: 'The moon was full at your birth. Of course it was.', baseWeight: 30, rarity: 'common', statBonus: { agility: 1, might: 1 }, epithet: { text: 'Wolfblood', priority: 18 }, color: '#6e5a4a', icon: 'Dog' },
  { id: 'moon_mad', label: 'Moon-Mad', description: 'The wolf is in charge more often than not.', baseWeight: 20, rarity: 'uncommon', statBonus: { might: 2, intellect: -1 }, epithet: { text: 'the Moon-Mad', priority: 30 }, color: '#8a3e3e', icon: 'MoonStar' },
  { id: 'pack_alpha', label: 'Alpha of the Pack', description: 'Where they run, wolves follow.', baseWeight: 10, rarity: 'rare', luckDelta: 0.25, grantTraits: ['pack_alpha'], epithet: { text: 'Alpha of the Pack', priority: 55 }, color: '#c9a24c', icon: 'Crown' },
  { id: 'moonborn', label: 'Child of the Moon', description: 'Born in a moonbeam. The change answers to them, not the sky.', baseWeight: 3, rarity: 'epic', grantTraits: ['pack_alpha', 'moon_mastery'], epithet: { text: 'Moonborn', priority: 66 }, color: '#9ab4e8', icon: 'MoonStar' },
]);

const BLOODLINE = raceWheel('bloodline', 'Whose Blood Runs in You?', 'Every vampire was made by someone.', [
  { id: 'fledgling', label: 'Fledgling', description: 'New to the night, and very hungry.', baseWeight: 42, rarity: 'common', statBonus: { agility: 1 }, epithet: { text: 'the Fledgling', priority: 10 }, color: '#6e2a3a', icon: 'Droplet' },
  { id: 'nosferatu', label: 'Nosferatu', description: 'Not pretty. Very hard to kill.', baseWeight: 26, rarity: 'uncommon', statBonus: { might: 2 }, epithet: { text: 'the Nosferatu', priority: 25 }, color: '#3a3a42', icon: 'Skull' },
  { id: 'crimson_court', label: 'The Crimson Court', description: 'Velvet, intrigue, and long knives.', baseWeight: 22, rarity: 'uncommon', statBonus: { intellect: 1, arcana: 1 }, luckDelta: 0.25, epithet: { text: 'of the Crimson Court', priority: 35 }, color: '#8a1c2e', icon: 'Wine' },
  { id: 'ancient_blood', label: 'Ancient Blood', description: 'Made by something older than any name.', baseWeight: 10, rarity: 'rare', statBonus: { arcana: 2 }, grantTraits: ['ancient_blood'], epithet: { text: 'the Ancient', priority: 60 }, color: '#c9a24c', icon: 'Hourglass' },
  { id: 'first_vampire', label: 'Blood of the First Vampire', description: 'Turned by the one who started all of it, on the first night there ever was.', baseWeight: 2, rarity: 'legendary', grantTraits: ['ancient_blood', 'eldest_blood'], epithet: { text: 'Child of the First Night', priority: 82 }, color: '#ffb84d', icon: 'Droplets' },
]);

export const RACE_WHEELS: WheelStep[] = [
  MONSTER_TYPE,
  HUMAN_HOMELAND,
  ELF_LINEAGE,
  DWARF_CLAN,
  ORC_STANDING,
  HALFLING_HEARTH,
  DRAGON_BLOODLINE,
  CELESTIAL_ORIGIN,
  GNOME_WORKSHOP,
  GOBLIN_BAND,
  goblinPlace('gang'),
  goblinPlace('band'),
  goblinPlace('horde'),
  KOBOLD_CALLING,
  LIZARD_CASTE,
  UNDEATH,
  OGRE_ROLE,
  LABYRINTH,
  THE_TURNING,
  BLOODLINE,
];
