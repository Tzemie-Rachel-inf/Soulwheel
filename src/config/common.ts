/**
 * Pieces several content files share: one-of-a-kind role keys, personalities and who can
 * turn, the cast pools the road draws recurring characters from, and the fight builder.
 */
import { calculatePowerRating } from '../engine/power';
import type { CastSpec, Character, Foe, Personality, Rarity, StatBlock, StepRoute, WheelOption, WheelStep, World } from '../engine/types';

/**
 * The one-of-a-kind roles used by this config. The engine accepts any string;
 * these constants only exist so conditions and options can't drift apart by typo.
 */
export const SINGLETON = {
  demonLord: 'demon_lord',
  holySwordBearer: 'holy_sword_bearer',
  archmage: 'archmage',
} as const;

export const PERSONALITIES = {
  brave: { id: 'brave', name: 'Brave', description: 'Runs toward the screaming.' },
  cautious: { id: 'cautious', name: 'Cautious', description: 'Checks every door twice.' },
  kind: { id: 'kind', name: 'Kind', description: 'Gives away the last loaf.' },
  curious: { id: 'curious', name: 'Curious', description: 'Opens the box. Always opens the box.' },
  greedy: { id: 'greedy', name: 'Greedy', description: 'Counts everything twice and shares nothing.' },
  reckless: { id: 'reckless', name: 'Reckless', description: 'Jumps first. Looks never.' },
  honorable: { id: 'honorable', name: 'Honorable', description: 'Keeps every oath, even the stupid ones.' },
  cruel: { id: 'cruel', name: 'Cruel', description: 'Enjoys it a little too much.' },
  ambitious: { id: 'ambitious', name: 'Ambitious', description: 'Wants a throne. Any throne.' },
} satisfies Record<string, Personality>;

export type PersonalityId = keyof typeof PERSONALITIES;
export const isOneOf = (char: Character, ids: readonly PersonalityId[]) =>
  char.personality !== null && (ids as readonly string[]).includes(char.personality);

/** Who might turn bandit: the greedy, reckless, cruel and ambitious, and the cursed. Never the honourable or the uncorruptable. */
export const OUTLAW_HEARTS: readonly PersonalityId[] = ['greedy', 'reckless', 'cruel', 'ambitious'];
export const couldTurnOutlaw = (_world: World, char: Character) =>
  char.personality !== 'honorable' && !isUncorruptable(char) && (isOneOf(char, OUTLAW_HEARTS) || char.tags.includes('cursed'));
export const outlawLockReason = (_world: World, char: Character) =>
  char.personality === 'honorable' ? 'Honour will not ride with thieves' : 'Not the kind to turn bandit';

/** Who might kneel to the Demon Lord: the cruel and the ambitious, the cursed, monsters, demons. Never the honourable or the uncorruptable. */
export const couldKneel = (_world: World, char: Character) =>
  char.personality !== 'honorable' &&
  !isUncorruptable(char) &&
  (isOneOf(char, ['cruel', 'ambitious']) || ['cursed', 'monster', 'fiend', 'corrupted'].some((tag) => char.tags.includes(tag)));

/**
 * Enemies made at the crossroads come back for them: a weight for an option that grows for
 * characters carrying `tag` (hunted by a noble's assassins, marked by the Demon Lord).
 */
export function hauntedBy(tag: string, baseWeight: number, factor: number): Pick<WheelOption, 'baseWeight' | 'vary'> {
  return { baseWeight, vary: (char: Character) => (char.tags.includes(tag) ? { baseWeight: baseWeight * factor } : {}) };
}

/** The best tier a weapon or armour found on the road can be; past it, only deeds and smiths improve gear. */
export const BEST_FOUND_GEAR = 5;

/**
 * A weapon or armour of a set tier, found or made. With `lock`, the slice is locked when it is
 * no better than what they carry (a pursuit for gear, like Train); without, it is kept only
 * if better.
 */
export function gearItem(kind: 'weapon' | 'armor', tier: number, lock = true): Pick<WheelOption, 'gear' | 'condition' | 'lockedReason'> {
  const carried = (char: Character) => (kind === 'weapon' ? char.weaponTier : char.armorTier);
  return {
    gear: { [kind]: tier },
    ...(lock && {
      condition: (_world: World, char: Character) => carried(char) < tier,
      lockedReason: (_world: World, char: Character) => `Their ${kind === 'weapon' ? 'weapon' : 'armour'} is already tier ${carried(char)}`,
    }),
  };
}

// Who the road can bring back: cast pools, read from the world when a wheel comes up.
// The engine never casts the hero arriving as their own encounter.
/** Heroes who hung up the sword, or won outright, and sit in the Hall of Fame. */
export const retiredLegends = (world: World) => world.hallOfFame.filter((c) => c.status === 'retired' || c.status === 'victorious');
export const outlaws = (world: World) => world.roster.filter((c) => c.role === 'outlaw');
export const darkChampions = (world: World) => world.roster.filter((c) => c.role === 'minion');
/** Whoever reigns over the Abyss. */
export const demonLords = (world: World) => world.roster.filter((c) => c.role === 'demonLord');

/** Former heroes who took up a life in the world (shopkeepers, mentors, generals, rulers). */
export const npcs = (world: World) => world.roster.filter((c) => c.role === 'npc');
/** Who can teach: retired legends and world NPCs. */
export const mentors = (world: World) => [...retiredLegends(world), ...npcs(world)];
/** Former heroes who rule a place now. */
export const rulers = (world: World) => npcs(world).filter((c) => c.tags.includes('ruler'));
/** Former heroes who command armies now. */
export const generals = (world: World) => npcs(world).filter((c) => c.tags.includes('general'));
/** Former heroes who settled into an ordinary life: shopkeepers, smiths, mentors. Not rulers or generals. */
export const townsfolk = (world: World) => npcs(world).filter((c) => !c.tags.includes('ruler') && !c.tags.includes('general'));
/** Every grave a hero can visit. */
export const graves = (world: World) => world.graveyard;
/** The graves of those who gave their lives for others. */
export const martyrs = (world: World) => world.graveyard.filter((c) => c.tags.includes('martyr'));
/** Souls sealed inside a relic that nobody has carried off yet. */
export const sealedSouls = (world: World) => world.hallOfFame.filter((c) => c.status === 'sealed' && !c.tags.includes('claimed'));
/** Other living heroes: rivals, friends, or both. */
export const rivals = (world: World, char: Character) => world.roster.filter((c) => c.role === 'hero' && c.id !== char.id);
/** The greatest anyone remembers: the five mightiest living heroes and retired legends, the hero arriving aside. */
export const greatestLegends = (world: World, char: Character) =>
  [...rivals(world, char), ...retiredLegends(world)]
    .map((c) => ({ c, cp: calculatePowerRating(c) }))
    .sort((a, b) => b.cp - a.cp)
    .slice(0, 5)
    .map(({ c }) => c);

/** True when the character owns this trait. */
export const hasTrait = (char: Character, traitId: string) => char.traits.some((t) => t.id === traitId);
/** No darkness can take root in them: they never hear the Abyss, never kneel, never turn. */
export const isUncorruptable = (char: Character) => hasTrait(char, 'uncorruptable');

// ─── Fights ─────────────────────────────────────────────────────────────────

/**
 * Power on the Combat Power scale. A fresh hero is usually 120–320 CP (half of them under
 * about 200), and a seasoned one 250–550. The road's foes are tuned to that; the legendary
 * challenges, open only to the Famous, are tuned well past it.
 */
export const FOES = {
  goblins: { name: 'Goblin Horde', power: 100 },
  bandits: { name: 'Bandit Gang', power: 120 },
  spiders: { name: 'Broodmother', power: 190 },
  troll: { name: 'Bridge Troll', power: 300 },
  guardian: { name: 'Stone Guardian', power: 350 },
  wights: { name: 'Barrow Wights', power: 420 },
  wyvern: { name: 'Wyvern', power: 560 },
  dragon: { name: 'Elder Dragon', power: 920 },
  // The crossroads (activities.ts)
  beast: { name: 'Man-Eater', power: 200 },
  duelist: { name: 'Duelist', power: 240 },
  rogueMage: { name: 'Rogue Mage', power: 330 },
  tournament: { name: 'Tournament Champion', power: 390 },
  undefeated: { name: 'Undefeated Champion', power: 580 },
  war: { name: 'The Enemy Host', power: 650 },
  // Legendary challenges, for the Famous (legacy.ts)
  usurper: { name: 'The Usurper and Their Guard', power: 1100 },
  greatWar: { name: 'The Endless Host', power: 1300 },
  breachHorror: { name: 'The Thing From the Breach', power: 1400 },
  demonLord: { name: 'The Demon Lord', power: 1500 },
  wyrm: { name: 'The Primordial Wyrm', power: 1800 },
  titan: { name: 'The Waking Titan', power: 2400 },
} satisfies Record<string, Foe>;

/** Traits that cheat death, and what they say about it. A soul with one can't roll a fatal slice. */
const DEATH_CHEATS: Record<string, string> = {
  iron_will: 'Iron Will: they get back up. Every time.',
  phylactery_spark: 'Phylactery: their soul is kept elsewhere. They reform.',
  lich_phylactery: 'Phylactery: their soul is kept elsewhere. They reform.',
  resurrection: 'Resurrection: death is a door they open from the other side.',
  cheated_death: 'Death owes them one: it comes, and goes away again.',
};
/** True for anyone who can die: no Iron Will, no phylactery, no Resurrection. */
export const IRON_WILL_SAVES = (_world: World, char: Character) => !char.traits.some((t) => t.id in DEATH_CHEATS);
/** Why a fatal slice is boarded up for this soul. */
export const deathCheatReason = (_world: World, char: Character) =>
  DEATH_CHEATS[char.traits.find((t) => t.id in DEATH_CHEATS)?.id ?? 'iron_will']!;

/**
 * What one fight outcome does, and how it looks. Weights and the fight side are filled in by
 * `fightWheel`. An outcome may lead on to another wheel (`next`: a throne, say); otherwise it goes
 * where the fight's `then` says, and by default the road ends.
 */
export type Outcome = Omit<WheelOption, 'id' | 'baseWeight' | 'nextStepId' | 'fight'> & { next?: string | StepRoute };
type Next = WheelOption['nextStepId'];

export interface FightSpec {
  id: string;
  title: string;
  subtitle: string;
  /** Who you fight. With a `cast` foe this is only the fallback for an empty pool. */
  foe: Foe;
  /** Fight someone from the world instead: their name, their Combat Power. */
  cast?: CastSpec;
  /** A foe worked out from the hero instead (a rival, an ambush that grows with threat). `foe` is the fallback. */
  foeOf?: (char: Character) => Foe;
  /** Where every survivable outcome leads unless it says otherwise (a quest goes on). Default: the road ends. */
  then?: Next;
  /** The share of defeats that are fatal, 0.15–0.85. */
  deadliness: number;
  victory: Outcome;
  /** A rarer, grander win. Give it a rarity. */
  glory: Outcome & { rarity: Rarity };
  retreat: Outcome;
  slain: Pick<WheelOption, 'label' | 'description' | 'fate' | 'story'>;
  /** A defeat where the hero changes sides. `share` of all defeats; give it a condition. */
  turncoat?: Outcome & { share: number };
  /**
   * Trait-specific wins: a way to win only some heroes have (Archery against a wyvern, a
   * true name against a guardian). Shown only to those with one of `requiresTrait`.
   */
  traitWins?: (Outcome & { id: string; requiresTrait: string[] })[];
  /**
   * The hype slice: a thin, rare win that changes who they are or what the world is ("The Bandit
   * King Kneels"). Give it a rarity, epic or rarer.
   */
  legend?: Outcome & { rarity: Rarity };
}

/** How heavy the hype slice is: Victory gives it up, so the chance to win stays CP against CP. */
const LEGEND_WEIGHT = 6;

/**
 * Ways to win that come with who a hero has become, on every fight: a vampire drains, a
 * werewolf lets the beast out, a whispering blade drinks. Dealt only to those it fits.
 */
const KIT_WINS: (Outcome & { id: string; requiresTrait: string[] })[] = [
  { id: 'kit_drain', label: 'Drained Them Dry', description: 'They won the way a vampire wins: slowly, and up close. The Hunger eases, the wounds close.', requiresTrait: ['vampiric'], meters: { hunger: -3, wounds: -1 }, statModifiers: { vitality: 1 }, color: '#8a1c2e', icon: 'Droplets' },
  { id: 'kit_beast', label: 'The Beast Took Over', description: 'Fur, teeth, and a fight that ended very fast. Someone saw.', requiresTrait: ['moonstruck'], meters: { moon: -1, notoriety: 1 }, statModifiers: { might: 1 }, color: '#5a6478', icon: 'MoonStar' },
  { id: 'kit_blade', label: 'The Blade Drank', description: 'The whispering blade moved their arm for them. It is quiet now, and pleased.', requiresTrait: ['sentient_blade'], removeTags: ['hook:blade_hungers'], callback: 'The whispering blade was fed', statModifiers: { might: 1 }, color: '#6a3a8a', icon: 'Sword' },
];

/** Glory comes a little more often to the sharp: +3% per point of Intellect above Average. */
const GLORY_SCALING: Partial<StatBlock> = { intellect: 0.03 };

/** Every stat's scaling times `by`. */
function scaled(scaling: Partial<StatBlock>, by: number): Partial<StatBlock> {
  return Object.fromEntries(Object.entries(scaling).map(([key, k]) => [key, (k ?? 0) * by]));
}

/**
 * A fight wheel. The win slices (Victory 85 : Glory 15, a 6 of it given to the hype slice
 * if there is one, and 15 for each trait win the hero can use) are scaled by the hero's
 * chance to win, the defeat slices (survived : fatal : turncoat) by the chance to lose, so
 * the wheel is drawn at the hero's true odds. Glory also favours Intellect (and whatever stat
 * the fight names in `glory.statScaling`). Iron Will, a phylactery or Resurrection boards up
 * the fatal slice. A defeat survived leaves a wound (the Wounds meter); vampires, werewolves
 * and whispering blades bring wins of their own (KIT_WINS).
 */
export function fightWheel(spec: FightSpec): WheelStep {
  const { id, title, subtitle, foe, cast, foeOf, then = null, deadliness, victory, glory, retreat, slain, turncoat, traitWins = [], legend } = spec;
  const out = <T extends Outcome>(o: T) => outcome(o, then);
  // The hype slice's weight comes out of Victory's, and so does its share of stat scaling.
  const bonus = legend ? LEGEND_WEIGHT : 0;
  const gloryScaling = { ...GLORY_SCALING, ...glory.statScaling };
  const fatal = Math.round(deadliness * 100);
  const turned = Math.round((turncoat?.share ?? 0) * 100);
  const survived = 100 - fatal - turned;
  // The likeliest kind of defeat counts as common; the others are uncommon.
  const heaviest = Math.max(fatal, survived, turned);
  const tier = (weight: number): Rarity => (weight === heaviest ? 'common' : 'uncommon');
  return {
    id,
    title,
    subtitle,
    foe,
    ...(cast && { cast }),
    ...(foeOf && { foeOf }),
    options: [
      // Victory gives up exactly what Glory (and the hype slice) gain, so the chance to win stays CP against CP.
      { color: '#3f8a5a', icon: 'Trophy', rarity: 'common', ...out(victory), statScaling: scaled(gloryScaling, -(15 + bonus) / (85 - bonus)), id: 'victory', baseWeight: 85 - bonus, fight: 'win' },
      { color: '#c9a24c', icon: 'Crown', ...out(glory), statScaling: gloryScaling, id: 'glory', baseWeight: 15, fight: 'win' },
      ...(legend ? [{ color: '#ffb84d', icon: 'Star', ...out(legend), statScaling: gloryScaling, id: 'legend', baseWeight: LEGEND_WEIGHT, fight: 'win' } satisfies WheelOption] : []),
      ...traitWins.map((win): WheelOption => ({ color: '#5aa9a0', icon: 'Sparkles', rarity: 'rare', ...out(win), baseWeight: 15, fight: 'win' })),
      ...KIT_WINS.filter((kit) => !traitWins.some((w) => w.id === kit.id)).map((win): WheelOption => ({ rarity: 'rare', ...out(win), baseWeight: 15, fight: 'win' })),
      {
        color: '#6b5a4a',
        icon: 'HeartCrack',
        rarity: tier(survived),
        ...out(retreat),
        // Every defeat that doesn't kill leaves a wound.
        meters: { wounds: 1, ...retreat.meters },
        id: 'retreat',
        baseWeight: survived,
        fight: 'lose',
      },
      {
        ...slain,
        story: { log: `${slain.label}. ${slain.description}`, ...slain.story }, // a quest's tale says how it ended
        id: 'slain',
        baseWeight: fatal,
        rarity: tier(fatal),
        fight: 'lose',
        threatScaling: 0.15, // the dark makes defeats deadlier
        setStatus: 'fallen', // to the graveyard: the adventure ends here
        condition: IRON_WILL_SAVES,
        lockedReason: deathCheatReason,
        nextStepId: null,
        color: '#7f1d1d',
        icon: 'Skull',
      },
      ...(turncoat ? [turncoatOption(turncoat, turned, tier(turned), then)] : []),
    ],
  };
}

export function turncoatOption({ share: _share, ...rest }: NonNullable<FightSpec['turncoat']>, weight: number, rarity: Rarity, then: Next = null): WheelOption {
  return { color: '#4a3a5a', icon: 'UserX', rarity, ...outcome(rest, then), id: 'turncoat', baseWeight: weight, fight: 'lose' };
}

/** An outcome as option fields: `next` becomes where it leads (without one, `then`: by default the road ends). */
function outcome<T extends Outcome>({ next, ...rest }: T, then: Next): Omit<T, 'next'> & { nextStepId: Next } {
  return { ...rest, nextStepId: next ?? then };
}

