/**
 * Pieces several content files share: one-of-a-kind role keys, personalities and who can
 * turn, the cast pools the road draws recurring characters from, and the fight builder.
 */
import { calculatePowerRating } from '../engine/power';
import { armorPower, weaponPower } from '../engine/gear';
import type { CastSpec, Character, Foe, Personality, Rarity, StatBlock, StepRoute, WheelOption, WheelStep, World } from '../engine/types';
import { GEAR_DEATH_CHEATS, LOOT_TABLES } from './gear';

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
  // Each personality also bends the crossroads a little, toward what that kind of soul would do with a free season.
  brave: { id: 'brave', name: 'Brave', description: 'Runs toward the screaming.', odds: { crossroads: { challenge: 1.6, disaster: 1.6, war: 1.4 } } },
  cautious: { id: 'cautious', name: 'Cautious', description: 'Checks every door twice.', odds: { crossroads: { train: 1.5, study: 1.4, craft: 1.4, make_enemy: 0.6 } } },
  kind: { id: 'kind', name: 'Kind', description: 'Gives away the last loaf.', odds: { crossroads: { make_ally: 1.8, disaster: 1.5, make_enemy: 0.5 } } },
  curious: { id: 'curious', name: 'Curious', description: 'Opens the box. Always opens the box.', odds: { crossroads: { explore: 1.6, hidden_place: 1.6, research: 1.5 } } },
  greedy: { id: 'greedy', name: 'Greedy', description: 'Counts everything twice and shares nothing.', odds: { crossroads: { treasure: 2, find_weapon: 1.4, make_ally: 0.6 } } },
  reckless: { id: 'reckless', name: 'Reckless', description: 'Jumps first. Looks never.', odds: { crossroads: { challenge: 1.6, make_enemy: 1.6, study: 0.5 } } },
  honorable: { id: 'honorable', name: 'Honorable', description: 'Keeps every oath, even the stupid ones.', odds: { crossroads: { take_quest: 1.4, tournament: 1.6, make_enemy: 0.6 } } },
  cruel: { id: 'cruel', name: 'Cruel', description: 'Enjoys it a little too much.', odds: { crossroads: { hunt: 1.6, make_enemy: 1.6, make_ally: 0.5 } } },
  ambitious: { id: 'ambitious', name: 'Ambitious', description: 'Wants a throne. Any throne.', odds: { crossroads: { take_quest: 1.5, tournament: 1.5, war: 1.5 } } },
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
  const carried = (char: Character) => (kind === 'weapon' ? weaponPower(char) : armorPower(char));
  return {
    gear: { [kind]: tier },
    ...(lock && {
      condition: (_world: World, char: Character) => carried(char) < tier,
      lockedReason: (_world: World, char: Character) => `Their ${kind === 'weapon' ? 'weapon' : 'armour'} is already power ${carried(char)}`,
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
  goblins: {
    name: 'Goblin Horde', power: 100, loot: LOOT_TABLES.goblins,
    weak: ['fire', 'bludgeoning'], strikes: 'piercing',
    moves: [{ name: 'The Swarm', damage: 'slashing', tell: 'start chanting, and there are suddenly a great many more of them' }],
  },
  bandits: {
    name: 'Bandit Gang', power: 120, loot: LOOT_TABLES.bandits,
    strikes: 'slashing',
    moves: [{ name: 'Ambush Volley', damage: 'piercing', tell: 'melt back into the trees, bows coming up' }],
  },
  spiders: {
    name: 'Broodmother', power: 190, loot: LOOT_TABLES.spiders,
    weak: ['fire'], immune: ['poison'], strikes: 'poison',
    moves: [{ name: 'Web and Fang', damage: 'poison', tell: 'goes very still, fangs glistening' }],
  },
  troll: {
    name: 'Bridge Troll', power: 300, loot: LOOT_TABLES.troll,
    weak: ['fire'], resists: ['bludgeoning'], strikes: 'bludgeoning',
    moves: [{ name: 'Club Smash', damage: 'bludgeoning', tell: 'lifts its club over its head with both hands' }],
  },
  guardian: {
    name: 'Stone Guardian', power: 350, loot: LOOT_TABLES.guardian,
    weak: ['bludgeoning', 'lightning'], resists: ['slashing', 'piercing'], immune: ['poison'], strikes: 'bludgeoning',
    moves: [{ name: 'Stone Fist', damage: 'bludgeoning', tell: 'grinds its fist back, runes flaring' }],
  },
  wights: {
    name: 'Barrow Wights', power: 420, loot: LOOT_TABLES.wights,
    weak: ['holy', 'fire'], resists: ['frost', 'shadow'], immune: ['poison'], strikes: 'shadow',
    moves: [{ name: 'Grave Chill', damage: 'frost', tell: 'breathe out, and the air turns to frost' }],
  },
  wyvern: {
    name: 'Wyvern', power: 560, loot: LOOT_TABLES.wyvern, battle: true,
    weak: ['piercing', 'frost'], resists: ['poison'], strikes: 'piercing',
    moves: [
      { name: 'Venom Tail', damage: 'poison', tell: 'arches its tail high, the barb dripping' },
      { name: 'Diving Talons', damage: 'piercing', tell: 'climbs, and climbs, and folds its wings' },
    ],
  },
  dragon: {
    name: 'Elder Dragon', power: 920, loot: LOOT_TABLES.dragon, battle: true,
    weak: ['frost'], resists: ['slashing', 'piercing'], immune: ['fire'], strikes: 'slashing',
    moves: [
      { name: 'Fire Breath', damage: 'fire', tell: 'rears back, smoke curling from its jaws' },
      { name: 'Tail Sweep', damage: 'bludgeoning', tell: 'turns, and the tail comes round like a wall' },
    ],
  },
  // The crossroads (activities.ts)
  beast: {
    name: 'Man-Eater', power: 200, loot: LOOT_TABLES.beast,
    weak: ['piercing', 'fire'], strikes: 'slashing',
    moves: [{ name: 'Maul', damage: 'slashing', tell: 'drops low, haunches bunched' }],
  },
  duelist: {
    name: 'Duelist', power: 240, loot: LOOT_TABLES.duelist,
    weak: ['bludgeoning'], strikes: 'piercing',
    moves: [{ name: 'Riposte', damage: 'piercing', tell: 'smiles, and lowers their guard. On purpose' }],
  },
  rogueMage: {
    name: 'Rogue Mage', power: 330, loot: LOOT_TABLES.rogueMage,
    weak: ['piercing', 'bludgeoning'], resists: ['arcane'], strikes: 'arcane',
    moves: [
      { name: 'Arcane Bolt', damage: 'arcane', tell: 'traces a sigil in the air, and it stays there' },
      { name: 'Fire Burst', damage: 'fire', tell: 'cups their hands, and the light between them turns orange' },
    ],
  },
  tournament: {
    name: 'Tournament Champion', power: 390, loot: LOOT_TABLES.tournament,
    weak: ['bludgeoning'], resists: ['slashing', 'piercing'], strikes: 'bludgeoning',
    moves: [{ name: 'Lance Charge', damage: 'piercing', tell: 'wheels their horse, and lowers the lance' }],
  },
  undefeated: {
    name: 'Undefeated Champion', power: 580, loot: LOOT_TABLES.undefeated, battle: true,
    resists: ['slashing'], strikes: 'slashing',
    moves: [
      { name: 'The Perfect Cut', damage: 'slashing', tell: 'settles into a stance nobody has ever seen twice' },
      { name: 'Shield Bash', damage: 'bludgeoning', tell: 'squares up behind the shield' },
    ],
  },
  war: {
    name: 'The Enemy Host', power: 650, loot: LOOT_TABLES.war, battle: true,
    weak: ['fire', 'lightning'], resists: ['piercing'], strikes: 'piercing',
    moves: [
      { name: 'Arrow Storm', damage: 'piercing', tell: 'a thousand bows come up at once' },
      { name: 'Cavalry Charge', damage: 'bludgeoning', tell: 'the ground starts to shake' },
    ],
  },
  // Legendary challenges, for the Famous (legacy.ts)
  usurper: {
    name: 'The Usurper and Their Guard', power: 1100, loot: LOOT_TABLES.usurper, battle: true,
    weak: ['holy'], resists: ['slashing'], strikes: 'slashing',
    moves: [
      { name: 'The Guard Closes', damage: 'piercing', tell: 'raises a hand, and the spears level' },
      { name: 'Poisoned Crown', damage: 'poison', tell: 'smiles, and someone in the crowd moves' },
    ],
  },
  greatWar: {
    name: 'The Endless Host', power: 1300, loot: LOOT_TABLES.greatWar, battle: true,
    weak: ['fire', 'lightning'], resists: ['piercing', 'slashing'], strikes: 'piercing',
    moves: [
      { name: 'Arrow Storm', damage: 'piercing', tell: 'the sky goes dark with fletching' },
      { name: 'Siege Fire', damage: 'fire', tell: 'the trebuchets creak back' },
    ],
  },
  breachHorror: {
    name: 'The Thing From the Breach', power: 1400, loot: LOOT_TABLES.breachHorror, battle: true,
    weak: ['holy', 'lightning'], resists: ['arcane', 'shadow'], immune: ['poison'], strikes: 'shadow',
    moves: [
      { name: 'Reality Tear', damage: 'arcane', tell: 'opens, in a direction that should not exist' },
      { name: 'Grasping Dark', damage: 'shadow', tell: 'every shadow in the room leans toward them' },
    ],
  },
  demonLord: {
    name: 'The Demon Lord', power: 1500, loot: LOOT_TABLES.demonLord, battle: true,
    weak: ['holy'], resists: ['shadow'], immune: ['fire', 'poison'], strikes: 'fire',
    moves: [
      { name: 'Hellfire', damage: 'fire', tell: 'spreads its wings, and the floor starts to glow' },
      { name: 'Soul Rend', damage: 'shadow', tell: 'speaks their true name, slowly' },
    ],
  },
  wyrm: {
    name: 'The Primordial Wyrm', power: 1800, loot: LOOT_TABLES.wyrm, battle: true,
    weak: ['lightning'], resists: ['fire', 'frost', 'slashing'], strikes: 'bludgeoning',
    moves: [
      { name: 'Primordial Breath', damage: 'fire', tell: 'draws in a breath that pulls the clouds down' },
      { name: 'The Coils', damage: 'bludgeoning', tell: 'the mountain itself begins to move' },
    ],
  },
  titan: {
    name: 'The Waking Titan', power: 2400, loot: LOOT_TABLES.titan, battle: true,
    weak: ['lightning'], resists: ['bludgeoning', 'slashing', 'piercing'], strikes: 'bludgeoning',
    moves: [
      { name: 'Earthshatter', damage: 'bludgeoning', tell: 'raises a foot the size of a keep' },
      { name: 'Sky Fall', damage: 'lightning', tell: 'reaches up, and takes hold of the storm' },
    ],
  },
} satisfies Record<string, Foe>;

/** Traits that cheat death, and what they say about it. A soul with one can't roll a fatal slice. */
const DEATH_CHEATS: Record<string, string> = {
  ...GEAR_DEATH_CHEATS,
  phylactery_spark: 'Phylactery: their soul is kept elsewhere. They reform.',
  lich_phylactery: 'Phylactery: their soul is kept elsewhere. They reform.',
  resurrection: 'Resurrection: death is a door they open from the other side.',
  cheated_death: 'Death owes them one: it comes, and goes away again.',
};
/** True for anyone who can die: no phylactery, no Resurrection. (Iron Will only gets them up once a fight, engine/battle.ts.) */
export const IRON_WILL_SAVES = (_world: World, char: Character) => !char.traits.some((t) => t.id in DEATH_CHEATS);
/** Why a fatal slice is boarded up for this soul. */
export const deathCheatReason = (_world: World, char: Character) =>
  DEATH_CHEATS[char.traits.find((t) => t.id in DEATH_CHEATS)?.id ?? 'cheated_death']!;

/**
 * What one fight outcome does, and how it looks. Weights and the fight side are filled in by
 * `fightWheel`. An outcome may lead on to another wheel (`next`: a throne, say); otherwise it goes
 * where the fight's `then` says, and by default the road ends.
 */
export type Outcome = Omit<WheelOption, 'id' | 'baseWeight' | 'nextStepId' | 'fight'> & { next?: string | StepRoute };
type Next = WheelOption['nextStepId'];

/** A foe's damage profile, without its name and power: for foes worked out on the spot. */
export type FoeProfile = Pick<Foe, 'weak' | 'resists' | 'immune' | 'strikes' | 'moves'>;

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
  /** A boss fight: a battle of several rounds, with health bars, before this wheel says how it ended. */
  battle?: boolean;
  /** What the foe (a worked-out one included) is weak to, resists and strikes with. */
  profile?: FoeProfile;
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
  { id: 'kit_blademaster', label: 'Steel Answered', description: 'Their blade was already where the enemy’s would be. It was over in three moves.', requiresTrait: ['blademaster'], statModifiers: { agility: 1 }, color: '#e11d48', icon: 'Swords' },
  { id: 'kit_blade', label: 'The Blade Drank', description: 'The whispering blade moved their arm for them. It is quiet now, and pleased.', requiresTrait: ['sentient_blade'], removeTags: ['hook:blade_hungers'], callback: 'The whispering blade was fed', statModifiers: { might: 1 }, color: '#6a3a8a', icon: 'Sword' },
];

/**
 * Ways to win that gear brings (its abilities, config/gear/abilities.ts): a blade that drinks,
 * armour with thorns. Dealt only to those whose gear gives one.
 */
const GEAR_WINS: (Outcome & { id: string; requiresTrait: string[] })[] = [
  { id: 'gear_win_leech', label: 'Drank Their Strength', description: 'The blade drank as it cut. Their own wounds closed.', requiresTrait: ['gear_vampiric'], meters: { wounds: -1 }, statModifiers: { vitality: 1 }, color: '#9b1c3a', icon: 'Droplets' },
  { id: 'gear_win_slaying', label: 'One Clean Stroke', description: 'The edge found the one place that mattered. It was over before it started.', requiresTrait: ['gear_slaying'], statModifiers: { might: 1 }, color: '#c2410c', icon: 'Sword' },
  { id: 'gear_win_disarm', label: 'Disarmed Them', description: 'A flick, a twist, and their weapon was across the room.', requiresTrait: ['gear_duelist'], statModifiers: { agility: 1 }, color: '#a8a29e', icon: 'Swords' },
  { id: 'gear_win_mending', label: 'Wounds Closed', description: 'The armour knit itself back together, and them with it.', requiresTrait: ['gear_mending'], meters: { wounds: -2 }, color: '#4d7c5a', icon: 'HeartPulse' },
  { id: 'gear_win_thorns', label: 'The Thorns Did the Rest', description: 'Every blow they landed cost them. Soon they stopped landing.', requiresTrait: ['gear_thorns'], statModifiers: { vitality: 1 }, color: '#5b6b3a', icon: 'ShieldHalf' },
];
/** A gear win's weight, beside Victory's 85: a kit win's. */
const GEAR_WIN_WEIGHT = 15;

/** Glory comes more often to the sharp: +4% per point of Intellect above Average. */
const GLORY_SCALING: Partial<StatBlock> = { intellect: 0.04 };

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
  const { id, title, subtitle, cast, then = null, deadliness, victory, glory, retreat, slain, turncoat, traitWins = [], legend, battle, profile } = spec;
  const foe: Foe = profile ? { ...profile, ...spec.foe } : spec.foe;
  const foeOf = profile && spec.foeOf ? (c: Character): Foe => ({ ...profile, ...spec.foeOf!(c) }) : spec.foeOf;
  const out = <T extends Outcome>(o: T) => outcome(o, then);
  // A won fight's gear comes from its Spoils wheel now: wins no longer temper what they carry as well.
  const won = <T extends Outcome>(o: T) => out(spoilsInstead(o));
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
    ...((battle || foe.battle) && { battle: true }),
    afterFight: then,
    options: [
      // Victory gives up exactly what Glory (and the hype slice) gain, so the chance to win stays CP against CP.
      { color: '#3f8a5a', icon: 'Trophy', rarity: 'common', ...won(victory), statScaling: scaled(gloryScaling, -(15 + bonus) / (85 - bonus)), id: 'victory', baseWeight: 85 - bonus, fight: 'win' },
      { color: '#c9a24c', icon: 'Crown', ...won(glory), statScaling: gloryScaling, id: 'glory', baseWeight: 15, fight: 'win' },
      ...(legend ? [{ color: '#ffb84d', icon: 'Star', ...won(legend), statScaling: gloryScaling, id: 'legend', baseWeight: LEGEND_WEIGHT, fight: 'win' } satisfies WheelOption] : []),
      ...traitWins.map((win): WheelOption => ({ color: '#5aa9a0', icon: 'Sparkles', rarity: 'rare', ...won(win), baseWeight: 15, fight: 'win' })),
      ...KIT_WINS.filter((kit) => !traitWins.some((w) => w.id === kit.id)).map((win): WheelOption => ({ rarity: 'rare', ...out(win), baseWeight: 15, fight: 'win' })),
      ...GEAR_WINS.map((win): WheelOption => ({ rarity: 'rare', ...out(win), baseWeight: GEAR_WIN_WEIGHT, fight: 'win' })),
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
/** A win without the gear tempering it used to bring (a loss still costs them). A win that takes nothing keeps it. */
function spoilsInstead<T extends Outcome>(o: T): T {
  if (o.noSpoils) return o;
  const { weaponTierDelta, armorTierDelta, ...rest } = o;
  return {
    ...rest,
    ...(weaponTierDelta !== undefined && weaponTierDelta < 0 && { weaponTierDelta }),
    ...(armorTierDelta !== undefined && armorTierDelta < 0 && { armorTierDelta }),
  } as T;
}

function outcome<T extends Outcome>({ next, ...rest }: T, then: Next): Omit<T, 'next'> & { nextStepId: Next } {
  return { ...rest, nextStepId: next ?? then };
}

