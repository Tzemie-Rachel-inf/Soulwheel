/**
 * Powers: three wheels of them, Blessed (holy), Corrupted and Arcane. Each power is a
 * trait with Combat Power, and no power can be learned twice.
 *
 * Every power learned is followed by the Mastery wheel: how well this soul wields that one
 * power, from Novice (×0.75 its power) to Transcendent (×4). Strong Arcana tilts it up.
 *
 * Spins on these wheels are mostly owed: a god owes three Blessed spins, an angel one, a
 * demon one Corrupted, a Mage one Arcane (`queueSpins`). At the end of creation POWERS_ROUTE
 * spends every owed spin, one wheel at a time, before the soul is named. On adventures,
 * Learn a New Power, a Magic Ring or a Secret Library lead to these wheels directly.
 *
 * Master a Power (an adventure pursuit) works like Train: pick one of the powers they know,
 * then climb its mastery ladder. Every rank they already hold is locked.
 *
 *   Master a Power ──▶ Which Power? (only the powers they know) ──▶ Mastery: that power
 */
import type { Character, StepRoute, Trait, WheelOption, WheelStep } from '../engine/types';
import { hasTrait } from './common';

export const POWER_WHEELS = {
  blessed: 'blessed_powers',
  corrupted: 'corrupted_powers',
  arcane: 'arcane_powers',
} as const;

const POWER_WHEEL_IDS: string[] = Object.values(POWER_WHEELS);

/** Spends owed power spins, first owed first. Null once none are left: the road (or creation) goes on. */
export const POWERS_ROUTE: StepRoute = {
  among: POWER_WHEEL_IDS,
  pick: (_world, char) => char.spinQueue.find((id) => POWER_WHEEL_IDS.includes(id)) ?? null,
};

type School = keyof typeof POWER_WHEELS;

interface PowerSpec {
  id: string;
  name: string;
  description: string;
  power: number;
  weight: number;
  rarity: WheelOption['rarity'];
  icon: string;
  color: string;
  multiplier?: number;
  luckDelta?: number;
  epithet?: WheelOption['epithet'];
}

const SCHOOLS: Record<School, { title: string; subtitle: string; powers: PowerSpec[]; surge: Omit<WheelOption, 'id' | 'nextStepId'> }> = {
  blessed: {
    title: 'Blessed Powers',
    subtitle: 'The light offers a gift. Which one?',
    powers: [
      { id: 'healing_light', name: 'Healing Light', description: 'Wounds close at a touch.', power: 25, weight: 18, rarity: 'common', icon: 'HeartPulse', color: '#f3e3a0' },
      { id: 'divine_shield', name: 'Divine Shield', description: 'A wall of light no blade can pass.', power: 30, weight: 16, rarity: 'common', icon: 'ShieldPlus', color: '#e6d48a' },
      { id: 'smite', name: 'Smite', description: 'Holy wrath, delivered by hand.', power: 35, weight: 14, rarity: 'common', icon: 'Zap', color: '#f5c46a' },
      { id: 'holy_flame', name: 'Holy Flame', description: 'Fire that burns only the wicked.', power: 35, weight: 10, rarity: 'uncommon', icon: 'Flame', color: '#f0a84a' },
      { id: 'radiant_aura', name: 'Radiant Aura', description: 'The dark backs away from them.', power: 40, weight: 9, rarity: 'uncommon', icon: 'Sun', color: '#ffd76a' },
      { id: 'sanctuary', name: 'Sanctuary', description: 'Where they stand, no harm can enter.', power: 30, weight: 8, rarity: 'uncommon', icon: 'Church', color: '#d9c9a0' },
      { id: 'fortunes_blessing', name: 'Fortune’s Blessing', description: 'Luck, delivered by an angel.', power: 20, weight: 8, rarity: 'uncommon', icon: 'Clover', color: '#9ac46a', luckDelta: 0.5 },
      { id: 'angelic_wings', name: 'Angelic Wings', description: 'White wings, for when walking is beneath you.', power: 60, weight: 3, rarity: 'epic', icon: 'Feather', color: '#f8f2e0', epithet: { text: 'the Winged', priority: 50 } },
      { id: 'resurrection', name: 'Resurrection', description: 'Death is a door they can open from the other side.', power: 80, weight: 1.5, rarity: 'legendary', icon: 'Sunrise', color: '#ffcf6a', epithet: { text: 'the Twice-Born', priority: 70 } },
      { id: 'miracle', name: 'Miracle', description: 'The impossible, once a day.', power: 150, weight: 0.4, rarity: 'mythical', icon: 'Sparkles', color: '#fff4c2', multiplier: 1.5, epithet: { text: 'the Miracle-Worker', priority: 88 } },
    ],
    surge: { label: 'Fleeting Grace', description: 'The light touches them, and moves on.', baseWeight: 10, rarity: 'common', luckDelta: 0.25, statModifiers: { vitality: 1 }, color: '#bdb08a', icon: 'Sparkle' },
  },
  corrupted: {
    title: 'Corrupted Powers',
    subtitle: 'The Abyss offers a gift. It always wants something back.',
    powers: [
      { id: 'shadow_bolt', name: 'Shadow Bolt', description: 'A spear of darkness, thrown.', power: 25, weight: 18, rarity: 'common', icon: 'Moon', color: '#4a3a6e' },
      { id: 'life_drain', name: 'Life Drain', description: 'Every wound they deal heals them.', power: 30, weight: 16, rarity: 'common', icon: 'Droplet', color: '#7a1c2e' },
      { id: 'aura_of_dread', name: 'Aura of Dread', description: 'Brave men run. Cowards faint.', power: 30, weight: 14, rarity: 'common', icon: 'Eye', color: '#3a2f4f' },
      { id: 'hellfire', name: 'Hellfire', description: 'Fire from below. It does not go out.', power: 40, weight: 10, rarity: 'uncommon', icon: 'Flame', color: '#b8323a' },
      { id: 'raise_dead', name: 'Raise the Dead', description: 'The fallen get up and follow them.', power: 40, weight: 9, rarity: 'uncommon', icon: 'Bone', color: '#9a948a' },
      { id: 'plague_touch', name: 'Plague Touch', description: 'Sickness spreads where they walk.', power: 35, weight: 8, rarity: 'uncommon', icon: 'Biohazard', color: '#65a30d' },
      { id: 'curse_of_ruin', name: 'Curse of Ruin', description: 'Their enemies’ luck sours and dies.', power: 30, weight: 8, rarity: 'uncommon', icon: 'Skull', color: '#5a4a5a' },
      { id: 'demonic_wings', name: 'Demonic Wings', description: 'Leathern wings, and a shadow that falls first.', power: 60, weight: 3, rarity: 'epic', icon: 'Feather', color: '#3a1a2a', epithet: { text: 'the Dark-Winged', priority: 50 } },
      { id: 'soul_rend', name: 'Soul Rend', description: 'They tear the soul out first. The body follows.', power: 85, weight: 1.5, rarity: 'legendary', icon: 'HeartCrack', color: '#8a1c3a', epithet: { text: 'the Soul-Render', priority: 70 } },
      { id: 'the_unmaking', name: 'The Unmaking', description: 'What they touch was never there.', power: 150, weight: 0.4, rarity: 'mythical', icon: 'Orbit', color: '#1a0a2a', multiplier: 1.5, epithet: { text: 'the Unmaker', priority: 88 } },
    ],
    surge: { label: 'Dark Hunger', description: 'The Abyss feeds them a little. Just a taste.', baseWeight: 10, rarity: 'common', statModifiers: { might: 2 }, color: '#5a2a3a', icon: 'Ghost' },
  },
  arcane: {
    title: 'Arcane Powers',
    subtitle: 'Which spell answers when they call?',
    powers: [
      { id: 'fireball', name: 'Fireball', description: 'The classic. Still works.', power: 30, weight: 18, rarity: 'common', icon: 'Flame', color: '#e0703a' },
      { id: 'frost_lance', name: 'Frost Lance', description: 'Ice, thrown very hard.', power: 28, weight: 16, rarity: 'common', icon: 'Snowflake', color: '#7ac4e0' },
      { id: 'chain_lightning', name: 'Chain Lightning', description: 'One bolt, everyone it can reach.', power: 35, weight: 14, rarity: 'common', icon: 'Zap', color: '#7a9ae0' },
      { id: 'arcane_shield', name: 'Arcane Shield', description: 'A shimmer that turns aside steel.', power: 30, weight: 10, rarity: 'uncommon', icon: 'Shield', color: '#6a6ad0' },
      { id: 'blink', name: 'Blink', description: 'Here. Now there. Now behind you.', power: 35, weight: 9, rarity: 'uncommon', icon: 'Sparkle', color: '#a07ae0' },
      { id: 'mind_read', name: 'Mind Reading', description: 'Every secret, in a glance.', power: 25, weight: 8, rarity: 'uncommon', icon: 'Brain', color: '#8abaf0' },
      { id: 'summon_elemental', name: 'Summon Elemental', description: 'Earth, wind or fire: it comes when called.', power: 45, weight: 8, rarity: 'uncommon', icon: 'Wind', color: '#5aa08a' },
      { id: 'meteor_swarm', name: 'Meteor Swarm', description: 'The sky falls, on request.', power: 70, weight: 3, rarity: 'epic', icon: 'Star', color: '#c06a3a', epithet: { text: 'the Starcaller', priority: 50 } },
      { id: 'time_stop', name: 'Time Stop', description: 'Everything waits while they think.', power: 90, weight: 1.5, rarity: 'legendary', icon: 'Hourglass', color: '#c9b27a', epithet: { text: 'the Timeless', priority: 70 } },
      { id: 'wish', name: 'Wish', description: 'Reality, rewritten in a sentence.', power: 160, weight: 0.4, rarity: 'mythical', icon: 'WandSparkles', color: '#e0c4ff', multiplier: 1.5, epithet: { text: 'Who Spoke the Wish', priority: 88 } },
    ],
    surge: { label: 'Arcane Spark', description: 'Not a spell yet. A start.', baseWeight: 10, rarity: 'common', statModifiers: { arcana: 2 }, color: '#5a5a8a', icon: 'WandSparkles' },
  },
};

export const POWER_TRAITS: Record<string, Trait> = Object.fromEntries(
  Object.values(SCHOOLS).flatMap((school) =>
    school.powers.map((p) => [
      p.id,
      // Every power is a spell: it grows with Arcana.
      { id: p.id, name: p.name, description: p.description, power: p.power, scalesWith: ['arcana'], ...(p.multiplier ? { multiplier: p.multiplier } : {}) },
    ]),
  ),
);

/** How much each point of Arcana above Average helps land the rarest powers. */
const ARCANA_FAVOURED: Partial<Record<NonNullable<WheelOption['rarity']>, number>> = { epic: 0.03, legendary: 0.04, mythical: 0.04 };

function powerWheel(school: School): WheelStep {
  const { title, subtitle, powers, surge } = SCHOOLS[school];
  return {
    id: POWER_WHEELS[school],
    title,
    subtitle,
    repeats: true, // owed spins come back to back
    options: [
      ...powers.map(
        (p): WheelOption => ({
          id: p.id,
          label: p.name,
          description: p.description,
          baseWeight: p.weight,
          rarity: p.rarity,
          grantTraits: [p.id],
          grantTags: ['power'],
          ...(p.luckDelta ? { luckDelta: p.luckDelta } : {}),
          ...(ARCANA_FAVOURED[p.rarity ?? 'common'] ? { statScaling: { arcana: ARCANA_FAVOURED[p.rarity ?? 'common'] } } : {}),
          ...(p.epithet && { epithet: p.epithet }),
          condition: (_world, char) => !hasTrait(char, p.id),
          lockedReason: 'Already known',
          nextStepId: POWER_MASTERY_STEP,
          color: p.color,
          icon: p.icon,
        }),
      ),
      // A power wheel teaches a power. The surge only gets a slice once every power here is known.
      {
        ...surge,
        id: 'surge',
        vary: (char) => ({ baseWeight: powers.every((p) => hasTrait(char, p.id)) ? surge.baseWeight : 0 }),
        nextStepId: POWERS_ROUTE,
      },
    ],
  };
}

// ─── Mastery of each power ──────────────────────────────────────────────────

const POWER_MASTERY_STEP = 'power_mastery';

interface MasteryRank {
  id: string;
  rank: string;
  description: string;
  /** The power's base power is multiplied by this. */
  factor: number;
  weight: number;
  rarity: NonNullable<WheelOption['rarity']>;
  /** Sharp Arcana pushes toward the top ranks (dull Arcana toward Novice). */
  arcana?: number;
  color: string;
  icon: string;
  epithet?: WheelOption['epithet'];
}

/** How well a power is wielded, worst first. One table for creation and for mastering it later. */
export const MASTERY_RANKS: readonly MasteryRank[] = [
  { id: 'novice', rank: 'Novice', description: 'It works about half the time. The other half is exciting.', factor: 0.75, weight: 28, rarity: 'common', arcana: -0.02, color: '#5a5a62', icon: 'CircleDot' },
  { id: 'practised', rank: 'Practised', description: 'Reliable, if unremarkable.', factor: 1, weight: 34, rarity: 'common', color: '#6a7a8a', icon: 'Sparkle' },
  { id: 'expert', rank: 'Expert', description: 'Smooth, quick, and on purpose.', factor: 1.35, weight: 22, rarity: 'uncommon', arcana: 0.02, color: '#4f8a9a', icon: 'Sparkles' },
  { id: 'virtuoso', rank: 'Virtuoso', description: 'They improvise with it. It still works.', factor: 1.75, weight: 10, rarity: 'rare', arcana: 0.03, color: '#5a7ae0', icon: 'WandSparkles' },
  { id: 'paragon', rank: 'Paragon', description: 'Scholars write books about how they cast it.', factor: 2.5, weight: 4.5, rarity: 'epic', arcana: 0.04, color: '#9a5ae0', icon: 'Star' },
  { id: 'transcendent', rank: 'Transcendent', description: 'The power is less something they use than something they are.', factor: 4, weight: 1.2, rarity: 'legendary', arcana: 0.04, color: '#ffb84d', icon: 'Sun', epithet: { text: 'the Transcendent', priority: 66 } },
];

const TOP_RANK = MASTERY_RANKS.at(-1)!;

const rankOption = (r: MasteryRank): Omit<WheelOption, 'nextStepId'> => ({
  id: r.id,
  label: r.rank,
  description: r.description,
  baseWeight: r.weight,
  rarity: r.rarity,
  ...(r.arcana && { statScaling: { arcana: r.arcana } }),
  ...(r.epithet && { epithet: r.epithet }),
  color: r.color,
  icon: r.icon,
});

/** How well they wield the power they just learned. Sharp Arcana pushes toward the top ranks. */
const POWER_MASTERY: WheelStep = {
  id: POWER_MASTERY_STEP,
  title: 'Mastery of the Power',
  subtitle: 'Knowing a spell is one thing. How well do they wield it?',
  repeats: true, // after every owed power
  // Most likely first, as the wheel has always been drawn.
  options: [...MASTERY_RANKS]
    .sort((a, b) => b.weight - a.weight)
    .map((r) => ({ ...rankOption(r), honeLastTrait: { factor: r.factor, rank: r.rank }, nextStepId: POWERS_ROUTE })),
};

/**
 * How far along its mastery ladder a power stands: the factor its rank gives. A power with
 * no rank from the ladder (a lesson a legend taught) is measured by its power against its base.
 */
export function masteryFactor(trait: Trait): number {
  const ranked = MASTERY_RANKS.find((r) => r.rank === trait.rank);
  if (ranked) return ranked.factor;
  const base = POWER_TRAITS[trait.id]?.power;
  return base ? trait.power / base : 1;
}

/** The powers a character knows: traits from the three power wheels. */
export function knownPowers(char: Character): Trait[] {
  return char.traits.filter((t) => POWER_TRAITS[t.id] !== undefined);
}

/** True if they know a power that has a rank left to climb. */
export function canMasterAPower(char: Character): boolean {
  return knownPowers(char).some((t) => masteryFactor(t) < TOP_RANK.factor);
}

const masterStepId = (powerId: string) => `master_${powerId}`;

// ─── Adventures: learning and mastering powers ──────────────────────────────

const darkSoul = (tags: readonly string[]) => tags.includes('fiend') || tags.includes('corrupted');

/** Learn a New Power: which school answers. */
const POWER_SCHOOL: WheelStep = {
  id: 'power_school',
  title: 'Which Power Answers?',
  subtitle: 'Something is willing to teach. What kind of something?',
  options: [
    { id: 'arcane', label: 'The Arcane', description: 'Study, and a spark of talent.', baseWeight: 50, rarity: 'common', nextStepId: POWER_WHEELS.arcane, color: '#5a5ad0', icon: 'WandSparkles' },
    { id: 'all_three', label: 'All Three Answer', description: 'The arcane, the light and the dark, all at once. A power from each.', baseWeight: 2, rarity: 'legendary', queueSpins: { blessed_powers: 1, corrupted_powers: 1 }, nextStepId: POWER_WHEELS.arcane, color: '#ffe08a', icon: 'Sparkles' },
    {
      id: 'blessed',
      label: 'The Light',
      description: 'A prayer, finally answered.',
      baseWeight: 25,
      rarity: 'uncommon',
      condition: (_world, char) => !darkSoul(char.tags),
      lockedReason: 'The light will not answer them',
      nextStepId: POWER_WHEELS.blessed,
      color: '#e6d48a',
      icon: 'Sun',
    },
    { id: 'corrupted', omenScaling: { eclipse: 2 }, label: 'The Abyss', description: 'A voice in the dark, offering help. It will want paying, later.', baseWeight: 25, rarity: 'uncommon', grantTags: ['hook:abyss_debt'], nextStepId: POWER_WHEELS.corrupted, color: '#7f1d2e', icon: 'Flame' },
  ],
};

/**
 * The ranks of Master a Power before it climbed a single power's ladder. No wheel grants them
 * now; heroes who earned them keep them, so they stay in config.
 */
const MASTERY_TRAITS: Record<string, Trait> = {
  power_adept: { id: 'power_adept', name: 'Adept of Power', description: 'Their powers come easily now.', power: 25, scalesWith: ['arcana'] },
  power_master: { id: 'power_master', name: 'Master of Power', description: 'Their powers do what they are told, and more.', power: 60, scalesWith: ['arcana'] },
  power_grandmaster: { id: 'power_grandmaster', name: 'Grandmaster of Power', description: 'Few alive can match them.', power: 120, multiplier: 1.2, scalesWith: ['arcana'] },
};

const ALL_POWERS: PowerSpec[] = Object.values(SCHOOLS).flatMap((school) => school.powers);

/** Master a Power: which of the powers they know. Like Train's "which stat", every one is an even pick. */
const MASTER_POWER: WheelStep = {
  id: 'master_power',
  title: 'Which Power?',
  subtitle: 'Practice, pain, and one moment where it all clicks. Which power do they work on?',
  options: [
    ...ALL_POWERS.map(
      (p): WheelOption => ({
        id: p.id,
        label: p.name,
        description: p.description,
        baseWeight: 20,
        rarity: 'common',
        requiresTrait: [p.id], // only the powers they know are dealt
        condition: (_world, char) => {
          const known = char.traits.find((t) => t.id === p.id);
          return known !== undefined && masteryFactor(known) < TOP_RANK.factor;
        },
        lockedReason: `Already ${TOP_RANK.rank}`,
        nextStepId: masterStepId(p.id),
        color: p.color,
        icon: p.icon,
      }),
    ),
    {
      id: 'the_source',
      label: 'The Source Itself',
      description: 'No one power: the magic under all of them. +1 Arcana, and every power grows with Arcana.',
      baseWeight: 6,
      rarity: 'common',
      statModifiers: { arcana: 1 },
      nextStepId: null,
      color: '#5a5a8a',
      icon: 'Orbit',
    },
    {
      id: 'a_power_of_their_own',
      label: 'A Power of Their Own',
      description: 'Practice went sideways, and they invented something nobody has cast before.',
      baseWeight: 2,
      rarity: 'epic',
      statModifiers: { arcana: 2 },
      epithet: { text: 'the Spell-Maker', priority: 48 },
      nextStepId: POWER_WHEELS.arcane,
      color: '#ffd76a',
      icon: 'Sparkles',
    },
  ],
};

/**
 * One power's mastery ladder, best first, like a training wheel: every rank at or below the
 * one they hold is locked, and a small open gain sits beside the ladder.
 */
function masteryLadder(p: PowerSpec): WheelStep {
  return {
    id: masterStepId(p.id),
    title: `Mastery: ${p.name}`,
    subtitle: 'Every rank they already hold is behind them. Sharp Arcana pushes toward the top.',
    ladder: true,
    options: [
      ...[...MASTERY_RANKS].reverse().map(
        (r): WheelOption => ({
          ...rankOption(r),
          description: `${p.name}, wielded at ${r.rank}: ×${r.factor} its base power.`,
          honeTrait: { trait: p.id, factor: r.factor, rank: r.rank },
          condition: (_world, char) => {
            const known = char.traits.find((t) => t.id === p.id);
            return known !== undefined && masteryFactor(known) < r.factor;
          },
          lockedReason: (_world, char) => {
            const known = char.traits.find((t) => t.id === p.id);
            return known?.rank ? `Already ${known.rank}` : 'Already past this rank';
          },
          nextStepId: null,
        }),
      ),
      {
        id: 'small_gains',
        label: 'Small Gains',
        description: 'No breakthrough, but the practice sharpens their Arcana: +1.',
        baseWeight: 8,
        rarity: 'common',
        statModifiers: { arcana: 1 },
        nextStepId: null,
        color: '#5a5a8a',
        icon: p.icon,
      },
    ],
  };
}

export const ALL_POWER_TRAITS: Record<string, Trait> = { ...POWER_TRAITS, ...MASTERY_TRAITS };

export const POWER_STEPS: WheelStep[] = [
  powerWheel('blessed'),
  powerWheel('corrupted'),
  powerWheel('arcane'),
  POWER_MASTERY,
  POWER_SCHOOL,
  MASTER_POWER,
  ...ALL_POWERS.map(masteryLadder),
];
