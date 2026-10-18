/**
 * Archetypes: not what a soul is trained to do, but how fate treats them. Rolled right after
 * their race's wheels, each one changes the act of spinning itself (`rules`, read by
 * engine/archetypes.ts):
 *
 *   Wise (common)          every wheel is spun twice, side by side; they keep the result they prefer
 *   Gambler (common)       every gain is bet on a coin: doubled, or lost (a stat set by a wheel falls to 1); a rare jackpot triples it
 *   All-Rounder (common)   the first stat wheel sets every stat (each still gets its own banked bonus)
 *   Assassin (uncommon)    weapons with Agility only; armour worn with Vitality or Agility, whichever is better
 *   Realist (uncommon)     the lowest and highest options are cut from every wheel
 *   Dreamer (rare)         every wheel gains a Nightmare below its worst and a Miracle above its best
 *   Trickster (rare)       a wheel before every battle doubles their power, halves it, or worse, or better
 *   Martial (rare)         a wheel that would teach a spell is a training wheel instead; Arcana is always 0
 *   Archmage (rare)        no weapon can be held; spells are worth double
 *   Vessel (epic)          host to something vast (a god, a dragon, a thing from beyond), and how far it has taken them
 *   Brute (epic)           a Smash button stops the spinning wheel dead, wherever it is
 *   Broken (epic)          one to three slices vanish from every wheel
 *   Hero (legendary)       the Holy Sword looks for them; holy slices pull at the wheel; death misses 1 time in 10
 *   Ancient (legendary)    once in a life, they decide a roll instead of spinning it
 *   Transcendent (mythical) the odds of every rarity are swapped with its mirror: common for mythical, and so on
 *
 * The Gambler's coin, the Trickster's gambit and Martial training are this file's own wheels.
 */
import type { Archetype, Trait, WheelOption, WheelStep } from '../engine/types';
import { POWER_WHEELS, POWERS_ROUTE } from './powers';

export const GAMBLE_STEP = 'gamble';
export const TRICKSTER_STEP = 'trickster_gambit';
export const MARTIAL_STEP = 'martial_training';
const VESSEL_STEP = 'vessel_of';
const ASSIMILATION_STEP = 'vessel_assimilation';

export const ARCHETYPES = {
  wise: {
    id: 'wise',
    name: 'Wise',
    rarity: 'common',
    description: 'Every wheel turns twice for them, and they choose which fate to keep.',
    rules: { rollTwice: true },
  },
  gambler: {
    id: 'gambler',
    name: 'Gambler',
    rarity: 'common',
    description: 'Every gain goes back on the table: double it, or lose it all.',
    rules: { gamble: GAMBLE_STEP },
  },
  all_rounder: {
    id: 'all_rounder',
    name: 'All-Rounder',
    rarity: 'common',
    description: 'One stat wheel decides them all. Never the best at anything; never the worst.',
    rules: { uniformStats: true },
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    rarity: 'uncommon',
    description: 'Weapons in quick hands only (Agility), and armour worn light: Vitality or Agility, whichever is better.',
    odds: { armory: { twin_daggers: 3, duelist_rapier: 2, crossbow: 1.5 }, talents: { shadowstep: 2.5 } },
    rules: { weaponStat: 'agility', armorStats: ['vitality', 'agility'] },
  },
  realist: {
    id: 'realist',
    name: 'Realist',
    rarity: 'uncommon',
    description: 'No miracles, no catastrophes. The best and worst slices of every wheel are cut away.',
    rules: { trimExtremes: true },
  },
  dreamer: {
    id: 'dreamer',
    name: 'Dreamer',
    rarity: 'rare',
    description: 'Every wheel holds a Nightmare below its worst and a Miracle above its best.',
    rules: { dreamTiers: true },
  },
  trickster: {
    id: 'trickster',
    name: 'Trickster',
    rarity: 'rare',
    description: 'Before every battle, fate shuffles the deck: their power doubled, halved, or stranger.',
    rules: { beforeFight: TRICKSTER_STEP },
  },
  martial: {
    id: 'martial',
    name: 'Martial',
    rarity: 'rare',
    description: 'Magic slides off them. Every spell they would learn is a season of training instead. Arcana: 0.',
    rules: { replaceSteps: { steps: Object.values(POWER_WHEELS), with: MARTIAL_STEP }, fixedStats: { arcana: 0 } },
  },
  archmage: {
    id: 'archmage',
    name: 'Archmage',
    rarity: 'rare',
    description: 'Their hands are for casting. No weapon, ever; every spell worth double.',
    odds: { crossroads: { learn_power: 2, research: 1.5 } },
    rules: { noWeapon: true, spellMultiplier: 2 },
  },
  vessel: {
    id: 'vessel',
    name: 'Vessel',
    rarity: 'epic',
    description: 'Something vast lives inside them. Its power is theirs, as far as it lets them have it.',
    rules: {},
  },
  brute: {
    id: 'brute',
    name: 'Brute',
    rarity: 'epic',
    description: 'They don’t wait for the wheel to slow down. They hit it.',
    rules: { smash: true },
  },
  broken: {
    id: 'broken',
    name: 'Broken',
    rarity: 'epic',
    description: 'Fate has cracks in it. Every wheel they face is missing pieces.',
    rules: { shatter: true },
  },
  hero: {
    id: 'hero',
    name: 'Hero',
    rarity: 'legendary',
    description: 'The Holy Sword looks for them. Holy things pull at their wheels, and death misses one time in ten.',
    odds: { talents: { holy_sword: 12 } },
    rules: { holyPull: 1.3, deathSave: 0.1 },
  },
  ancient: {
    id: 'ancient',
    name: 'Ancient',
    rarity: 'legendary',
    description: 'Older than the wheels. Once in this life, they decide a roll instead of spinning it.',
    rules: { decrees: 1 },
  },
  transcendent: {
    id: 'transcendent',
    name: 'Transcendent',
    rarity: 'mythical',
    description: 'Fate turned inside out: the commonest outcomes are their rarest, and the impossible is ordinary.',
    rules: { mirrorRarity: true },
  },
} satisfies Record<string, Archetype>;

type ArchetypeId = keyof typeof ARCHETYPES;

const WEIGHTS: Record<Archetype['rarity'], number> = { common: 16, uncommon: 9, rare: 4, epic: 1.8, legendary: 0.7, mythical: 0.25 };

const LOOK: Record<ArchetypeId, { color: string; icon: string; priority: number }> = {
  wise: { color: '#4f6a9a', icon: 'BookOpen', priority: 16 },
  gambler: { color: '#9a3a4a', icon: 'Dices', priority: 16 },
  all_rounder: { color: '#6a7a5a', icon: 'Scale', priority: 16 },
  assassin: { color: '#3a3a4e', icon: 'VenetianMask', priority: 20 },
  realist: { color: '#7a7064', icon: 'Search', priority: 18 },
  dreamer: { color: '#7a5ad0', icon: 'MoonStar', priority: 24 },
  trickster: { color: '#c0569a', icon: 'Shuffle', priority: 24 },
  martial: { color: '#b8613a', icon: 'Hand', priority: 24 },
  archmage: { color: '#3a5ae0', icon: 'WandSparkles', priority: 26 },
  vessel: { color: '#2f5a4a', icon: 'Ghost', priority: 34 },
  brute: { color: '#8a2e2e', icon: 'Hammer', priority: 30 },
  broken: { color: '#4a3a3a', icon: 'HeartCrack', priority: 30 },
  hero: { color: '#facc15', icon: 'Sword', priority: 44 },
  ancient: { color: '#c9a24c', icon: 'Hourglass', priority: 44 },
  transcendent: { color: '#fff4c2', icon: 'Orbit', priority: 60 },
};

const archetypeOption = (id: ArchetypeId): WheelOption => {
  const a: Archetype = ARCHETYPES[id];
  return {
    id,
    label: a.name,
    description: a.description,
    baseWeight: WEIGHTS[a.rarity],
    rarity: a.rarity,
    setArchetype: id,
    epithet: { text: `the ${a.name}`, priority: LOOK[id].priority },
    // An Archmage starts out knowing one spell.
    ...(id === 'archmage' && { queueSpins: { [POWER_WHEELS.arcane]: 1 } }),
    nextStepId: id === 'vessel' ? VESSEL_STEP : 'fate',
    color: LOOK[id].color,
    icon: LOOK[id].icon,
  };
};

export const ARCHETYPE: WheelStep = {
  id: 'archetype',
  title: 'Wheel of Archetypes',
  subtitle: 'Not what you do. How fate treats you.',
  options: (Object.keys(ARCHETYPES) as ArchetypeId[]).map(archetypeOption),
};

// ─── Vessel: what lives inside them, and how much of them is left ───────────

interface Host {
  id: string;
  label: string;
  description: string;
  weight: number;
  rarity: NonNullable<WheelOption['rarity']>;
  trait: Omit<Trait, 'id'>;
  bonus: WheelOption['statBonus'];
  luck?: number;
  tags?: string[];
  holy?: boolean;
  color: string;
  icon: string;
}

const HOSTS: Host[] = [
  { id: 'beast', label: 'A Great Beast', description: 'The spirit of something that hunted before there were people.', weight: 22, rarity: 'common', trait: { name: 'Beast Within', description: 'Claws behind the eyes.', power: 20, scalesWith: ['might', 'agility'] }, bonus: { might: 1, agility: 1 }, color: '#7a5a3a', icon: 'PawPrint' },
  { id: 'ancestor', label: 'A Restless Ancestor', description: 'Great-great-grandmother never really left.', weight: 18, rarity: 'common', trait: { name: 'Ancestor’s Voice', description: 'Advice from the grave, mostly good.', power: 15 }, bonus: { intellect: 1, vitality: 1 }, luck: 0.25, color: '#6a7a8a', icon: 'Ghost' },
  { id: 'storm', label: 'A Storm Elemental', description: 'Thunder where the heartbeat should be.', weight: 14, rarity: 'uncommon', trait: { name: 'Living Storm', description: 'Lightning answers when they are angry.', power: 30, scalesWith: ['agility'] }, bonus: { agility: 1, arcana: 1 }, color: '#5a8ab8', icon: 'CloudLightning' },
  { id: 'archfey', label: 'An Archfey', description: 'A noble of the hollow hills, bored and curious.', weight: 12, rarity: 'uncommon', trait: { name: 'Fey Court', description: 'Glamours and bargains.', power: 30, scalesWith: ['intellect'] }, bonus: { agility: 1, intellect: 1 }, luck: 0.5, color: '#9ac46a', icon: 'Flower' },
  { id: 'demon', label: 'A Demon Prince', description: 'Bound inside them, and always negotiating.', weight: 8, rarity: 'rare', trait: { name: 'Demon Within', description: 'Hellfire, on loan.', power: 45, scalesWith: ['might'] }, bonus: { might: 2, arcana: 1 }, tags: ['corrupted'], color: '#8a1c2e', icon: 'Flame' },
  { id: 'dragon', label: 'An Elder Dragon', description: 'A dragon’s soul, too proud to die properly.', weight: 7, rarity: 'rare', trait: { name: 'Dragon Soul', description: 'Scales under the skin; fire under the scales.', power: 50, scalesWith: ['vitality'] }, bonus: { might: 2, vitality: 2 }, color: '#b8323a', icon: 'Flame' },
  { id: 'titan', label: 'A Sleeping Titan', description: 'It dreams of mountains. They carry the weight.', weight: 3, rarity: 'epic', trait: { name: 'Titan’s Dream', description: 'Strength from before the world.', power: 60, scalesWith: ['might'] }, bonus: { might: 3, vitality: 3 }, color: '#7a6a5a', icon: 'Mountain' },
  { id: 'eldritch', label: 'Something From Beyond', description: 'It has no name in any language with vowels.', weight: 3, rarity: 'epic', trait: { name: 'The Thing Beyond', description: 'Geometry that hurts.', power: 70, scalesWith: ['intellect'] }, bonus: { arcana: 3, intellect: 2 }, luck: -0.25, color: '#2a3a4f', icon: 'Eye' },
  { id: 'god', label: 'A Forgotten God', description: 'No temples left. One worshipper, and they live inside them.', weight: 1.2, rarity: 'legendary', trait: { name: 'Forgotten God', description: 'Divinity, slightly used.', power: 90, multiplier: 1.2 }, bonus: { might: 2, agility: 2, intellect: 2, arcana: 2, vitality: 2 }, luck: 0.5, holy: true, color: '#ffd76a', icon: 'Sun' },
  { id: 'primordial', label: 'A Primordial', description: 'The first thing. Before light, before the gods. It fits inside them, somehow.', weight: 0.3, rarity: 'mythical', trait: { name: 'The Primordial', description: 'Creation, held in one body.', power: 150, multiplier: 1.5 }, bonus: { might: 3, agility: 3, intellect: 3, arcana: 3, vitality: 3 }, color: '#fff4c2', icon: 'Orbit' },
];

const hostTraitId = (host: Host) => `vessel_${host.id}`;

export const VESSEL_TRAITS: Record<string, Trait> = Object.fromEntries(HOSTS.map((h) => [hostTraitId(h), { id: hostTraitId(h), ...h.trait }]));

/** Epithet priority per rarity, so a rarer host outranks a commoner one. */
const RARITY_STEP: Record<NonNullable<WheelOption['rarity']>, number> = { common: 0, uncommon: 6, rare: 14, epic: 24, legendary: 40, mythical: 56 };

const VESSEL: WheelStep = {
  id: VESSEL_STEP,
  title: 'Vessel of…',
  subtitle: 'Something lives inside you. What?',
  options: HOSTS.map((h) => ({
    id: h.id,
    label: h.label,
    description: h.description,
    baseWeight: h.weight,
    rarity: h.rarity,
    grantTraits: [hostTraitId(h)],
    statBonus: h.bonus,
    ...(h.luck && { luckDelta: h.luck }),
    ...(h.tags && { grantTags: h.tags }),
    ...(h.holy && { holy: true }),
    epithet: { text: `Vessel of ${h.label.replace(/^An? /, '')}`, priority: 30 + RARITY_STEP[h.rarity] },
    nextStepId: ASSIMILATION_STEP,
    color: h.color,
    icon: h.icon,
  })),
};

const ASSIMILATION: WheelStep = {
  id: ASSIMILATION_STEP,
  title: 'Assimilation',
  subtitle: 'How much of it has become them, and how much of them is still in charge?',
  options: [
    { id: 'dormant', label: 'Dormant', description: 'It sleeps. Its power trickles through: half strength, no say.', baseWeight: 26, rarity: 'common', honeLastTrait: { factor: 0.5, rank: 'Dormant' }, nextStepId: 'fate', color: '#4a4a52', icon: 'Bed' },
    { id: 'whispering', label: 'Whispering', description: 'It talks at night. They listen, mostly.', baseWeight: 26, rarity: 'common', honeLastTrait: { factor: 1, rank: 'Whispering' }, nextStepId: 'fate', color: '#5a6a7a', icon: 'Wind' },
    { id: 'bonded', label: 'Bonded', description: 'Two minds, one body, an understanding.', baseWeight: 20, rarity: 'uncommon', honeLastTrait: { factor: 1.5, rank: 'Bonded' }, nextStepId: 'fate', color: '#4f8a9a', icon: 'Handshake' },
    { id: 'entwined', label: 'Entwined', description: 'Where they end and it begins is a matter of opinion.', baseWeight: 12, rarity: 'rare', honeLastTrait: { factor: 2.25, rank: 'Entwined' }, statBonus: { intellect: -1 }, nextStepId: 'fate', color: '#5a7ae0', icon: 'Dna' },
    { id: 'overtaken', label: 'Overtaken', description: 'It drives. They ride along, and watch.', baseWeight: 8, rarity: 'rare', honeLastTrait: { factor: 3.5, rank: 'Overtaken' }, statBonus: { intellect: -2 }, luckDelta: -0.5, grantTags: ['possessed'], nextStepId: 'fate', color: '#6e2a5a', icon: 'EyeOff' },
    { id: 'consumed', label: 'Consumed', description: 'Very little of them is left, and that little is screaming.', baseWeight: 4, rarity: 'epic', honeLastTrait: { factor: 5, rank: 'Consumed' }, statBonus: { intellect: -3, vitality: 2 }, grantTags: ['possessed'], epithet: { text: 'the Hollowed', priority: 52 }, nextStepId: 'fate', color: '#2a1a2a', icon: 'Skull' },
    { id: 'perfect_union', label: 'Perfect Union', description: 'Two souls, one will. It chose them as much as they chose it.', baseWeight: 2, rarity: 'legendary', honeLastTrait: { factor: 4, rank: 'In Perfect Union' }, statBonus: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, epithet: { text: 'the Twin-Souled', priority: 72 }, nextStepId: 'fate', color: '#ffb84d', icon: 'Sparkles' },
  ],
};

// ─── The Gambler's coin ─────────────────────────────────────────────────────

/** Spun after every gain a Gambler makes. Where it goes next is the stake's (`Character.stake`), not its own. */
const GAMBLE: WheelStep = {
  id: GAMBLE_STEP,
  title: 'Double or Nothing',
  subtitle: 'Everything that roll gave you, on one coin.',
  fixed: true,
  repeats: true,
  options: [
    { id: 'double', label: 'Double It', description: 'Every gain doubled. A stat the wheel set is doubled outright.', baseWeight: 49, rarity: 'common', gamble: 'double', fame: 0, nextStepId: null, color: '#c9a24c', icon: 'Coins' },
    { id: 'lose', label: 'Lose It All', description: 'Every gain gone. A stat the wheel set falls to 1.', baseWeight: 49, rarity: 'common', gamble: 'lose', fame: 0, nextStepId: null, color: '#3a2629', icon: 'HeartCrack' },
    { id: 'jackpot', label: 'Jackpot', description: 'The coin lands on its edge. Every gain tripled.', baseWeight: 2, rarity: 'epic', gamble: 'triple', fame: 0, nextStepId: null, color: '#ffd76a', icon: 'Gem' },
  ],
};

// ─── The Trickster's gambit ─────────────────────────────────────────────────

/** Before every fight. Its options all go on to the fight (`evade: 'fight'`), with their power bent. */
const TRICKSTER: WheelStep = {
  id: TRICKSTER_STEP,
  title: 'The Trickster’s Gambit',
  subtitle: 'Before facing {foe}, fate shuffles the deck.',
  fixed: true,
  repeats: true,
  options: (
    [
      ['as_you_are', 'As You Are', 'No tricks this time. Their own power, nothing more.', 1, 26, 'common', '#6a6a72', 'CircleDot'],
      ['emboldened', 'Emboldened', 'A grin, a feint, a lucky angle: power ×1.5.', 1.5, 20, 'common', '#7ae0a8', 'Wind'],
      ['shaken', 'Shaken', 'A bad omen at the worst time: power ×0.75.', 0.75, 16, 'uncommon', '#8a7a6a', 'CloudFog'],
      ['halved', 'Halved', 'The trick backfires: power ×0.5.', 0.5, 13, 'uncommon', '#5a4a5a', 'ArrowDown'],
      ['doubled', 'Doubled', 'Two of them, somehow, for one fight: power ×2.', 2, 12, 'rare', '#c0569a', 'Users'],
      ['quartered', 'Quartered', 'They trick themselves: power ×0.25.', 0.25, 5, 'epic', '#2a1a2a', 'HeartCrack'],
      ['tripled', 'Tripled', 'The whole battlefield is in on the joke: power ×3.', 3, 5, 'epic', '#9a5ae0', 'Shuffle'],
      ['tenfold', 'Tenfold', 'Fate itself laughs along: power ×10.', 10, 0.8, 'legendary', '#ffb84d', 'Sparkles'],
    ] as const
  ).map(([id, label, description, boost, weight, rarity, color, icon]): WheelOption => ({
    id,
    label,
    description,
    baseWeight: weight,
    rarity,
    fightBoost: boost,
    evade: 'fight',
    fame: 0,
    nextStepId: null,
    color,
    icon,
  })),
};

// ─── Martial training ───────────────────────────────────────────────────────

/** A Martial soul's spell wheels, under their own ids: a season of training instead of a spell. Never Arcana. */
const MARTIAL: WheelStep = {
  id: MARTIAL_STEP,
  title: 'Training, Not Spells',
  subtitle: 'Magic would have come. Discipline came instead.',
  repeats: true,
  options: [
    { id: 'drill_might', label: 'Strength Drills', description: 'Stones lifted until the stones gave up: Might +2.', baseWeight: 20, rarity: 'common', statModifiers: { might: 2 }, nextStepId: POWERS_ROUTE, color: '#f08a62', icon: 'BicepsFlexed' },
    { id: 'drill_agility', label: 'Footwork', description: 'A thousand steps, then a thousand more: Agility +2.', baseWeight: 20, rarity: 'common', statModifiers: { agility: 2 }, nextStepId: POWERS_ROUTE, color: '#7ae0a8', icon: 'Footprints' },
    { id: 'drill_vitality', label: 'Endurance', description: 'Running, cold water, no complaints: Vitality +2.', baseWeight: 20, rarity: 'common', statModifiers: { vitality: 2 }, nextStepId: POWERS_ROUTE, color: '#f5c07a', icon: 'Heart' },
    { id: 'drill_intellect', label: 'Tactics', description: 'A war table and an old soldier: Intellect +2.', baseWeight: 16, rarity: 'common', statModifiers: { intellect: 2 }, nextStepId: POWERS_ROUTE, color: '#8abaf0', icon: 'Brain' },
    { id: 'iron_body', label: 'Iron Body', description: 'Hit until nothing hurts: Might +2, Vitality +2.', baseWeight: 6, rarity: 'rare', statModifiers: { might: 2, vitality: 2 }, nextStepId: POWERS_ROUTE, color: '#8a94a4', icon: 'ShieldHalf' },
    { id: 'everything_at_once', label: 'Everything at Once', description: 'A brutal season that works on all of it: +2 to every stat but Arcana.', baseWeight: 3, rarity: 'epic', statModifiers: { might: 2, agility: 2, intellect: 2, vitality: 2 }, nextStepId: POWERS_ROUTE, color: '#ffd76a', icon: 'Dumbbell' },
    { id: 'perfect_form', label: 'Perfect Form', description: 'One motion, perfected: Might +4, Agility +4.', baseWeight: 0.8, rarity: 'legendary', statModifiers: { might: 4, agility: 4 }, nextStepId: POWERS_ROUTE, color: '#ffb84d', icon: 'Swords' },
  ],
};

export const ARCHETYPE_STEPS: WheelStep[] = [ARCHETYPE, VESSEL, ASSIMILATION, GAMBLE, TRICKSTER, MARTIAL];
