/**
 * Stat wheels, one set per race.
 *
 * Every stat has its own ladder of 25 named positions, one per value from 1 to 25, named
 * for that stat (Might runs Powerless → Titanic, Agility Lumbering → Blur...). Nine of them
 * are tiers that race profiles are written in (Weak, Average, Strong...). A race sees a
 * window of the ladder, at least 15 positions wide, with its odds peaked where the race
 * sits: humans crowd Average, orcs lean Strong, goblins can fall all the way to Powerless,
 * and only a minotaur's Might reaches Battle Ram. Races also rename a few signature tiers.
 *
 * The wheel shows the window best first. A position's weight is a bell curve around the
 * race's peak, with a thin tail out to the window's edges; luck tilts it (positions above
 * the peak grow, those below shrink). The wheel rolls on these plain values; then each
 * point banked by race wheels, fate, personality and the rest moves the result one
 * position up (a hammer blow on screen). Pushed past the top, the stat rolls Ascension.
 *
 *   Personality ──route──▶ Might ▶ Agility ▶ Intellect ▶ Arcana ▶ Vitality (for this race) ──route──▶ Talents | Abyssal
 *
 * Training (an adventure pursuit) rolls the same ladders again: every rung at or below the
 * stat's current value is locked. A stat already at the top of its race's window ascends
 * instead, to a golden wheel far past the ladder, mythical tiers included.
 *
 *   What Will You Train? ──route──▶ that stat's training wheel (for this race) | its Ascension wheel
 */
import type { Character, Race, Rarity, StatBlock, StatKey, StepRoute, WheelOption, WheelStep } from '../engine/types';
import { POWER_WHEELS } from './powers';
import { RACES, type RaceId } from './races';

/**
 * The value of each of the nine tiers profiles are written in (0 Powerless … 4 Average 10 …
 * 8 Titanic 25). Every value between two tiers is a position on the wheel too.
 */
export const TIER_VALUES = [1, 3, 5, 7, 10, 13, 16, 20, 25] as const;
/** The highest value a stat wheel can roll; Ascension (training) goes past it. */
const LADDER_TOP = 25;
/** Every stat wheel shows at least this many positions. */
export const MIN_POSITIONS = 15;
/** Extra positions past a race's window on each side: rare tails, for more variance. */
const TAIL_PAD = 1;
/** Width of the bell curve, in values, per unit of a profile's `spread`. */
const SIGMA_PER_SPREAD = 3.2;
/** No position below this share of the wheel (%): thin enough to keep the tails rare, wide enough for its name. */
const MIN_SHARE = 1.5;
/** How strongly luck tilts each position, per value away from the peak. */
const LUCK_PER_VALUE = 0.12;
/** Rolling at least this much Arcana in creation teaches a spell as a bonus. */
export const BONUS_SPELL_ARCANA = 16;

/** Names for values 1–25, lowest first. The tier values (1, 3, 5, 7, 10, 13, 16, 20, 25) keep their old names. */
const LADDERS: Record<StatKey, readonly string[]> = {
  might: [
    'Powerless', 'Limp', 'Puny', 'Scrawny', 'Feeble', 'Slight', 'Weak', 'Soft', 'Ordinary', 'Average', 'Sturdy', 'Firm', 'Strong',
    'Brawny', 'Burly', 'Mighty', 'Powerful', 'Iron-Armed', 'Hulking', 'Herculean', 'Colossal', 'Juggernaut', 'Bear-Strong', 'Unstoppable', 'Titanic',
  ],
  agility: [
    'Lumbering', 'Leaden', 'Clumsy', 'Stumbling', 'Sluggish', 'Plodding', 'Awkward', 'Stiff', 'Unremarkable', 'Steady', 'Light-Footed', 'Spry', 'Nimble',
    'Agile', 'Quick', 'Swift', 'Fleet', 'Darting', 'Acrobatic', 'Lightning-Fast', 'Uncatchable', 'Wind-Swift', 'Flickering', 'Phantom', 'Blur',
  ],
  intellect: [
    'Witless', 'Empty-Headed', 'Dim', 'Dense', 'Slow-Witted', 'Muddled', 'Simple', 'Plain', 'Ordinary', 'Average', 'Bright', 'Clever', 'Sharp',
    'Keen', 'Shrewd', 'Brilliant', 'Learned', 'Erudite', 'Masterful', 'Genius', 'Prodigy', 'Savant', 'Luminary', 'Sagacious', 'Sage',
  ],
  arcana: [
    'Magic-Deaf', 'Null', 'Mundane', 'Earthbound', 'Dull', 'Dim-Sparked', 'Faint', 'Tingling', 'Sensitive', 'Attuned', 'Aware', 'Kindled', 'Gifted',
    'Talented', 'Charmed', 'Spellbound', 'Rune-Touched', 'Mystic', 'Eldritch', 'Arcane', 'Ley-Touched', 'Spellwoven', 'Thaumic', 'Mage-Born', 'Spellborn',
  ],
  vitality: [
    'Frail', 'Wasting', 'Sickly', 'Pallid', 'Fragile', 'Thin-Blooded', 'Delicate', 'Tender', 'Healthy', 'Hardy', 'Hale', 'Stout', 'Robust',
    'Tough', 'Rugged', 'Ironclad', 'Stalwart', 'Unyielding', 'Enduring', 'Indomitable', 'Adamant', 'Tireless', 'Death-Defying', 'Unfading', 'Undying',
  ],
};

const STAT_INFO: Record<StatKey, { name: string; title: string; prompt: string; icon: string; dim: string; bright: string }> = {
  might: { name: 'Might', title: 'Wheel of Might', prompt: 'How hard can they hit?', icon: 'BicepsFlexed', dim: '#3a2629', bright: '#f08a62' },
  agility: { name: 'Agility', title: 'Wheel of Agility', prompt: 'How quick, how quiet, how hard to catch?', icon: 'Wind', dim: '#24382e', bright: '#7ae0a8' },
  intellect: { name: 'Intellect', title: 'Wheel of Intellect', prompt: 'How sharp is the mind behind the eyes?', icon: 'Brain', dim: '#252d40', bright: '#8abaf0' },
  arcana: { name: 'Arcana', title: 'Wheel of Arcana', prompt: 'How loudly does magic answer?', icon: 'Sparkles', dim: '#30263f', bright: '#c095f5' },
  vitality: { name: 'Vitality', title: 'Wheel of Vitality', prompt: 'How much does it take to put them down?', icon: 'Heart', dim: '#3f3226', bright: '#f5c07a' },
};

/**
 * Where a race sits on one stat, in tiers (0–8, fractions allowed for the peak): the lowest
 * and highest tier it reaches, and its likeliest. `statWindow` turns it into wheel positions.
 */
type Window = readonly [from: number, to: number, peak: number];

interface StatProfile {
  stats: Record<StatKey, Window>;
  /** How far the odds spread around the peak. Smaller crowds the middle. Default 1 (about 3 values). */
  spread?: number;
  /** Signature names for particular tiers: { might: { 8: 'Battle Ram' } }. */
  names?: Partial<Record<StatKey, Record<number, string>>>;
}

const ELF_NAMES = { agility: { 8: 'Windwalker' }, arcana: { 8: 'Starsung' } };

const WOOD_ELF: StatProfile = { stats: { might: [2, 6, 3.8], agility: [3, 8, 5.6], intellect: [3, 7, 4.4], arcana: [3, 7, 4.8], vitality: [1, 6, 3.6] }, names: ELF_NAMES };

/** Every race that rolls stats. A race without a profile uses its family's (a Balor, the Demon one), else the human one. */
export const STAT_PROFILES: Partial<Record<RaceId, StatProfile>> = {
  human: {
    // Humans crowd the middle: Average is the likeliest result on every stat.
    stats: { might: [2, 7, 4], agility: [2, 7, 4], intellect: [2, 7, 4], arcana: [2, 7, 4], vitality: [2, 7, 4] },
    spread: 0.85,
    names: { intellect: { 7: 'Polymath' } },
  },
  elf: WOOD_ELF, // an elf of no particular line, e.g. a mortal later raised or corrupted
  wood_elf: WOOD_ELF,
  high_elf: { stats: { might: [1, 6, 3.4], agility: [3, 7, 4.8], intellect: [3, 8, 5.4], arcana: [4, 8, 5.8], vitality: [1, 6, 3.4] }, names: ELF_NAMES },
  dark_elf: { stats: { might: [2, 6, 4], agility: [3, 8, 5.4], intellect: [3, 7, 4.8], arcana: [3, 8, 5.2], vitality: [1, 6, 3.6] }, names: ELF_NAMES },
  moon_elf: { stats: { might: [2, 6, 3.8], agility: [3, 8, 5], intellect: [3, 7, 4.8], arcana: [3, 8, 5.4], vitality: [2, 6, 3.8] }, names: ELF_NAMES },
  star_elf: { stats: { might: [2, 7, 4.2], agility: [3, 8, 5.4], intellect: [3, 8, 5.4], arcana: [4, 8, 6.2], vitality: [2, 7, 4] }, names: ELF_NAMES },
  dwarf: {
    stats: { might: [3, 7, 4.9], agility: [1, 5, 3.3], intellect: [2, 7, 4.2], arcana: [1, 6, 3.6], vitality: [4, 8, 5.6] },
    names: { might: { 7: 'Anvil-Armed' }, vitality: { 8: 'Mountain-Hearted' } },
  },
  orc: {
    // Orcs lean strong: above-average Might is the likeliest result.
    stats: { might: [3, 8, 5.2], agility: [2, 6, 4], intellect: [1, 5, 3.2], arcana: [1, 5, 3.2], vitality: [3, 7, 4.8] },
    spread: 1.1,
    names: { might: { 8: 'Skullsplitter' } },
  },
  halfling: {
    stats: { might: [1, 5, 3], agility: [3, 7, 5], intellect: [2, 6, 4.3], arcana: [2, 6, 3.8], vitality: [2, 6, 4] },
    names: { agility: { 7: 'Unseen' } },
  },
  dragonborn: {
    stats: { might: [3, 7, 5], agility: [2, 6, 4], intellect: [2, 6, 4], arcana: [3, 7, 4.6], vitality: [3, 8, 5] },
    names: { might: { 7: 'Dragon-Strong' }, vitality: { 8: 'Dragonhide' } },
  },
  celestial: {
    stats: { might: [2, 6, 4], agility: [2, 7, 4.4], intellect: [3, 8, 5.2], arcana: [4, 8, 5.8], vitality: [3, 7, 4.8] },
    names: { arcana: { 8: 'Starfire' } },
  },
  goblin: {
    // Goblins can fall all the way to Powerless.
    stats: { might: [0, 4, 2.4], agility: [3, 7, 5], intellect: [2, 6, 4.2], arcana: [1, 5, 3.2], vitality: [1, 5, 3] },
    spread: 1.1,
    names: { agility: { 7: 'Slippery' } },
  },
  kobold: {
    stats: { might: [0, 4, 2.4], agility: [3, 7, 4.8], intellect: [3, 7, 4.8], arcana: [2, 6, 4], vitality: [1, 5, 2.8] },
    names: { intellect: { 7: 'Trap-Genius' } },
  },
  lizardfolk: {
    stats: { might: [3, 6, 4.4], agility: [3, 7, 4.6], intellect: [2, 6, 3.8], arcana: [1, 5, 3], vitality: [4, 8, 5.4] },
    names: { vitality: { 8: 'Cold-Blooded' } },
  },
  skeleton: {
    stats: { might: [1, 6, 3.6], agility: [2, 6, 4], intellect: [0, 5, 2.6], arcana: [1, 6, 3.5], vitality: [0, 4, 2] },
    names: { vitality: { 0: 'Brittle' } },
  },
  lich: {
    stats: { might: [0, 4, 2], agility: [1, 5, 3], intellect: [5, 8, 6.4], arcana: [6, 8, 7], vitality: [1, 5, 3] },
    names: { arcana: { 8: 'Archlich' }, intellect: { 8: 'Eternal Mind' } },
  },
  ogre: {
    stats: { might: [5, 8, 6.4], agility: [0, 4, 2.4], intellect: [0, 4, 1.8], arcana: [0, 4, 2], vitality: [4, 8, 5.8] },
    names: { might: { 8: 'Mountain-Breaker' }, intellect: { 0: 'Rock-Headed' } },
  },
  minotaur: {
    // Only a minotaur's Might reaches Battle Ram.
    stats: { might: [5, 8, 6.6], agility: [2, 6, 4], intellect: [1, 5, 3], arcana: [0, 4, 2.4], vitality: [4, 8, 5.6] },
    names: { might: { 8: 'Battle Ram' } },
  },
  werewolf: {
    stats: { might: [4, 8, 5.6], agility: [4, 8, 5.6], intellect: [1, 5, 3.2], arcana: [1, 6, 3.4], vitality: [4, 8, 5.4] },
    names: { might: { 8: 'Moon-Mad' } },
  },
  vampire: {
    stats: { might: [3, 7, 5], agility: [4, 8, 5.6], intellect: [3, 8, 5.2], arcana: [4, 8, 5.6], vitality: [3, 8, 5] },
    names: { agility: { 8: 'Mistform' }, arcana: { 8: 'Blood Sorcerer' } },
  },
  gnome: {
    stats: { might: [0, 4, 2.2], agility: [2, 7, 4.6], intellect: [4, 8, 5.8], arcana: [3, 7, 4.8], vitality: [1, 5, 3] },
    names: { intellect: { 8: 'Mad Genius' }, might: { 0: 'Pocket-Sized' } },
  },
  construct: {
    stats: { might: [4, 8, 5.8], agility: [0, 4, 2.2], intellect: [1, 6, 3.4], arcana: [0, 5, 2.6], vitality: [5, 8, 6.6] },
    names: { vitality: { 8: 'Indestructible' }, agility: { 0: 'Rusted Stiff' }, might: { 8: 'Siege Engine' } },
  },
  god: {
    // Gods live near the top of every ladder.
    stats: { might: [4, 8, 6.4], agility: [4, 8, 6], intellect: [4, 8, 6.4], arcana: [5, 8, 7], vitality: [4, 8, 6.4] },
    names: { might: { 8: 'Godlike' }, agility: { 8: 'Omnipresent' }, intellect: { 8: 'Omniscient' }, arcana: { 8: 'Divine' }, vitality: { 8: 'Immortal' } },
  },
  demon: {
    // Every natural demon (Balor, Succubus...) rolls on these. Corrupted mortals keep their own race's.
    stats: { might: [4, 8, 6], agility: [3, 8, 5.4], intellect: [3, 8, 5], arcana: [4, 8, 6], vitality: [4, 8, 5.6] },
    names: { might: { 8: 'Hellforged' }, arcana: { 8: 'Infernal' }, vitality: { 8: 'Abyss-Born' } },
  },
};

const STAT_ORDER: readonly StatKey[] = ['might', 'agility', 'intellect', 'arcana', 'vitality'];

/** A tier (fractions allowed) as a value: 4 → 10, 4.5 → 11.5. */
function tierValue(tier: number): number {
  const lo = Math.floor(tier);
  const hi = Math.ceil(tier);
  return TIER_VALUES[lo]! + (TIER_VALUES[hi]! - TIER_VALUES[lo]!) * (tier - lo);
}

/**
 * A race's positions on one stat wheel: every value from its lowest tier to its highest,
 * one more on each side, widened toward the far side of the peak until there are at least
 * MIN_POSITIONS.
 */
export function statWindow(profile: StatProfile, stat: StatKey): { from: number; to: number; peak: number } {
  const [fromTier, toTier, peakTier] = profile.stats[stat];
  const peak = tierValue(peakTier);
  let from = Math.max(1, TIER_VALUES[fromTier]! - TAIL_PAD);
  let to = Math.min(LADDER_TOP, TIER_VALUES[toTier]! + TAIL_PAD);
  while (to - from + 1 < MIN_POSITIONS) {
    const down = from > 1 && (to >= LADDER_TOP || peak - from <= to - peak);
    if (down) from--;
    else to++;
  }
  return { from, to, peak };
}

export const statStepId = (stat: StatKey, race: string) => `stat_${stat}_${race}`;
export const trainStepId = (stat: StatKey, race: string) => `train_${stat}_${race}`;
export const ascendStepId = (stat: StatKey) => `ascend_${stat}`;

const profiledRaces = Object.keys(STAT_PROFILES) as RaceId[];

/** Whose ladders a character climbs: their race's, else their family's, else the human ones. */
export function profileRace(char: Character): RaceId {
  const race = char.race;
  if (race !== null && race in STAT_PROFILES) return race as RaceId;
  const family = race === null ? undefined : (RACES as Record<string, Race>)[race]?.family;
  return family !== undefined && family in STAT_PROFILES ? (family as RaceId) : 'human';
}

/** After Personality: to the first stat wheel of the character's ladders. */
export const STATS_START: StepRoute = {
  among: profiledRaces.map((race) => statStepId('might', race)),
  pick: (_world, char) => statStepId('might', profileRace(char)),
};

/** After the last stat: Demon Lords to the Abyssal wheel, everyone else to Talents. */
const AFTER_STATS: StepRoute = {
  among: ['talents', 'abyssal'],
  pick: (_world, char) => (char.role === 'demonLord' ? 'abyssal' : 'talents'),
};

/**
 * One stat wheel for one race: its window of the ladder, best first. A training wheel
 * ('train') locks every position at or below the current value, and adds a small open gain.
 */
function statWheel(race: RaceId, stat: StatKey, profile: StatProfile, next: string | StepRoute | null, mode: 'roll' | 'train' = 'roll'): WheelStep {
  const { from, to, peak } = statWindow(profile, stat);
  const sigma = (profile.spread ?? 1) * SIGMA_PER_SPREAD;
  const info = STAT_INFO[stat];
  const values = Array.from({ length: to - from + 1 }, (_, k) => from + k);

  // A bell curve around the peak, as percentages. No position below MIN_SHARE: every one
  // in the window stays visible on the wheel, and the tails stay within reach.
  const bell = values.map((v) => Math.exp(-((v - peak) ** 2) / (2 * sigma ** 2)));
  const total = bell.reduce((a, b) => a + b, 0);
  const weights = bell.map((b) => Math.max(MIN_SHARE, Math.round((b / total) * 1000) / 10));
  const share = (k: number) => weights[k]! / weights.reduce((a, b) => a + b, 0);

  // Rarity marks how rare it is to roll this well or better. At or below the peak: common.
  const rarityOf = (k: number): Rarity => {
    if (values[k]! <= Math.round(peak)) return 'common';
    const tail = values.reduce((sum, _v, j) => (j >= k ? sum + share(j) : sum), 0);
    return tail >= 0.3 ? 'uncommon' : tail >= 0.1 ? 'rare' : tail >= 0.03 ? 'epic' : 'legendary';
  };

  // Signature names are written per tier; find the value each one names.
  const renamed = new Map(Object.entries(profile.names?.[stat] ?? {}).map(([tier, name]) => [TIER_VALUES[Number(tier)], name]));
  const label = (v: number) => renamed.get(v as (typeof TIER_VALUES)[number]) ?? LADDERS[stat][v - 1]!;
  const options = values.map((v, k): WheelOption => ({
    id: slug(LADDERS[stat][v - 1]!),
    label: label(v),
    description: `${label(v)}: a ${stat} of ${v} before bonuses.`,
    baseWeight: weights[k]!,
    rarity: rarityOf(k),
    luckScaling: Math.round(LUCK_PER_VALUE * (v - peak) * 1000) / 1000,
    setStats: { [stat]: v } as Partial<StatBlock>,
    // From Mighty (16) up, a position earns a title: "the Mighty", "the Juggernaut", "the Battle Ram".
    ...(v >= 16 && { epithet: { text: `the ${label(v)}`, priority: Math.round(20 + 3.5 * (v - 16)) } }),
    ...(mode === 'train' && atLeast(stat, v)),
    // Strong Arcana at birth comes with a spell: an extra Arcane power, learned at the end of creation.
    ...(mode === 'roll' && stat === 'arcana' && v >= BONUS_SPELL_ARCANA && { queueSpins: { [POWER_WHEELS.arcane]: 1 } }),
    nextStepId: next,
    color: mixHex(info.dim, info.bright, (v - 1) / (LADDER_TOP - 1)),
    icon: info.icon,
  }));

  if (mode === 'train') {
    return {
      id: trainStepId(stat, race),
      title: `Training: ${info.name}`,
      subtitle: `Every tier you already stand on is behind you. ${RACES[race].name} tiers and odds.`,
      ladder: true,
      options: [
        ...options.reverse(),
        { id: 'small_gains', label: 'Small Gains', description: `No breakthrough, but a little more ${stat}: +1.`, baseWeight: 8, rarity: 'common', statModifiers: { [stat]: 1 }, nextStepId: null, color: info.dim, icon: info.icon },
      ],
    };
  }
  return {
    id: statStepId(stat, race),
    title: info.title,
    subtitle: `${info.prompt} ${RACES[race].name} tiers and odds.`,
    ladder: true,
    overflow: ascendStepId(stat), // banked bonuses that push past the top roll Ascension
    upgradeEffect: 'hammer',
    options: options.reverse(), // best first, clockwise from the pointer
  };
}

/** Locks a training position the character already stands on (or above). */
function atLeast(stat: StatKey, value: number): Pick<WheelOption, 'condition' | 'lockedReason'> {
  return {
    condition: (_world, char) => char.stats[stat] < value,
    lockedReason: (_world, char) => `Already ${char.stats[stat]}`,
  };
}

/** Every race's five stat wheels, chained Might → Vitality. */
export const STAT_WHEELS: WheelStep[] = profiledRaces.flatMap((race) => {
  const profile = STAT_PROFILES[race]!;
  return STAT_ORDER.map((stat, k) => {
    const next = STAT_ORDER[k + 1];
    return statWheel(race, stat, profile, next ? statStepId(next, race) : AFTER_STATS);
  });
});

// ─── Training and ascension ─────────────────────────────────────────────────

/** Training wheels: every race's five ladders again, rungs at or below the current value locked. */
export const TRAINING_WHEELS: WheelStep[] = profiledRaces.flatMap((race) =>
  STAT_ORDER.map((stat) => statWheel(race, stat, STAT_PROFILES[race]!, null, 'train')),
);

/** To this stat's training wheel, or its Ascension wheel once the stat tops the race's window. */
function trainRoute(stat: StatKey): StepRoute {
  return {
    among: [...profiledRaces.map((race) => trainStepId(stat, race)), ascendStepId(stat)],
    pick: (_world, char) => {
      const race = profileRace(char);
      const { to } = statWindow(STAT_PROFILES[race]!, stat);
      return char.stats[stat] >= to ? ascendStepId(stat) : trainStepId(stat, race);
    },
  };
}

export const TRAIN_STAT: WheelStep = {
  id: 'train_stat',
  title: 'What Will You Train?',
  subtitle: 'Push one stat further. If it is already as high as your kind can go, you ascend.',
  options: STAT_ORDER.map(
    (stat): WheelOption => ({
      id: stat,
      label: STAT_INFO[stat].name,
      description: STAT_INFO[stat].prompt,
      baseWeight: 20,
      rarity: 'common',
      nextStepId: trainRoute(stat),
      color: STAT_INFO[stat].bright,
      icon: STAT_INFO[stat].icon,
    }),
  ).concat([
    { id: 'everything_at_once', label: 'Everything at Once', description: 'A season of training so brutal it works on all of them: +2 to every stat.', baseWeight: 3, rarity: 'epic', statModifiers: { might: 2, agility: 2, intellect: 2, arcana: 2, vitality: 2 }, epithet: { text: 'the Tireless', priority: 44 }, nextStepId: null, color: '#ffd76a', icon: 'Dumbbell' },
  ]),
};

/** Ascension tiers, far past any ladder. */
const ASCENDED: Record<StatKey, readonly string[]> = {
  might: ['Earthshaker', 'Giant-Strong', 'Mountain-Mover', 'Worldbreaker', 'Titansbane', 'Godhand', 'Star-Crusher'],
  agility: ['Windrunner', 'Shadowfast', 'Untouchable', 'Time-Slipper', 'Lightning-Born', 'Here-and-Gone', 'Faster Than Thought'],
  intellect: ['Visionary', 'Mastermind', 'Oracle', 'Living Library', 'World-Mind', 'All-Knowing', 'Mind of the Cosmos'],
  arcana: ['Archmagus', 'Spellstorm', 'Leyline-Bound', 'Reality-Bender', 'Starweaver', 'Arcane Sovereign', 'Living Magic'],
  vitality: ['Unkillable', 'Deathless', 'Everlasting', 'Timeless', 'Ageless', 'Eternal', 'Immortal Flame'],
};
const ASCEND_VALUES = [30, 35, 40, 50, 65, 80, 100] as const;
const ASCEND_WEIGHTS = [36, 26, 17, 10, 6, 3.5, 1.5] as const;
const ASCEND_RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'rare', 'epic', 'legendary', 'mythical'];

/** A golden wheel for a stat that has outgrown its ladder. */
function ascendWheel(stat: StatKey): WheelStep {
  const info = STAT_INFO[stat];
  const options = ASCEND_VALUES.map((value, k): WheelOption => {
    const name = ASCENDED[stat][k]!;
    return {
      id: slug(name),
      label: name,
      description: `Past every ladder: ${stat} ${value}.`,
      baseWeight: ASCEND_WEIGHTS[k]!,
      rarity: ASCEND_RARITIES[k]!,
      luckScaling: 0.3 * (k - 1),
      setStats: { [stat]: value } as Partial<StatBlock>,
      ...atLeast(stat, value),
      ...(k >= 2 && { epithet: { text: `the ${name}`, priority: 60 + 8 * (k - 2) } }),
      nextStepId: null,
      color: k === ASCEND_VALUES.length - 1 ? '#ff9ad5' : mixHex('#8a6a1e', '#fff2b0', k / (ASCEND_VALUES.length - 2)),
      icon: info.icon,
    };
  });
  return {
    id: ascendStepId(stat),
    title: `Ascension: ${info.name}`,
    subtitle: 'Past the top of the ladder, the wheel turns gold.',
    ladder: true,
    golden: true,
    options: [
      ...options.reverse(),
      { id: 'beyond_measure', label: 'Beyond Measure', description: `Already past every tier: ${stat} +3.`, baseWeight: 6, rarity: 'common', statModifiers: { [stat]: 3 }, nextStepId: null, color: '#6e5a2a', icon: info.icon },
    ],
  };
}

export const ASCENSION_WHEELS: WheelStep[] = STAT_ORDER.map(ascendWheel);

// ─── Names for any stat value ───────────────────────────────────────────────

/**
 * What a stat's value is called, for this character: their race's signature name for it
 * if it has one ('Battle Ram'), else the ladder's ('Mighty'); past the ladder, the
 * Ascension tier it has reached ('Worldbreaker').
 */
export function statTierName(stat: StatKey, value: number, char: Character): string {
  if (value > LADDER_TOP) {
    const reached = ASCEND_VALUES.reduce((best, v, k) => (value >= v ? k : best), -1);
    return reached < 0 ? LADDERS[stat][LADDER_TOP - 1]! : ASCENDED[stat][reached]!;
  }
  const v = Math.max(1, Math.round(value));
  const renames = STAT_PROFILES[profileRace(char)]?.names?.[stat] ?? {};
  const tier = TIER_VALUES.indexOf(v as (typeof TIER_VALUES)[number]);
  return (tier >= 0 ? renames[tier] : undefined) ?? LADDERS[stat][v - 1]!;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Linear blend of two hex colours, for a ladder's glass running dim to bright. */
function mixHex(a: string, b: string, t: number): string {
  const ca = Number.parseInt(a.slice(1), 16);
  const cb = Number.parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const x = (ca >> shift) & 255;
    const y = (cb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}
