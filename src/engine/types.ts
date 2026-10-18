/**
 * Core data model for the Roguelite Character Generator & World Simulator.
 *
 * Two families of types live here, and they are kept deliberately apart:
 *
 *  1. PERSISTED STATE: `World`, `Character`, `Trait`, `RollRecord`.
 *     Plain JSON. Saved to localStorage. Never contains functions.
 *
 *  2. CONFIG: `GameConfig`, `WheelStep`, `WheelOption`.
 *     Lives in code. May contain functions (`condition`, `lockedReason`), so it is
 *     never serialized. Persisted state refers to config by id only, and snapshots
 *     anything that must survive future rebalancing (traits).
 *
 * Combat Power is intentionally NOT stored anywhere. It is derived on demand by
 * `calculatePowerRating`, so it can never drift out of sync with what was rolled.
 */

// ─── Stats ──────────────────────────────────────────────────────────────────

export const STAT_KEYS = ['might', 'agility', 'intellect', 'arcana', 'vitality'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type StatBlock = Record<StatKey, number>;

// ─── Persisted state: Character ─────────────────────────────────────────────

/**
 * hero: adventures, can claim heroic roles.   demonLord: the one at the top of the Abyss.
 * outlaw / minion: heroes who turned bandit or swore to the Demon Lord. Still alive and in
 * the world, they no longer adventure, and turn up on other heroes' roads as enemies.
 * npc: a hero whose fate twisted into an ordinary life (shopkeeper, blacksmith, monarch).
 * Still in the world, never adventuring again.
 */
export type CharacterRole = 'hero' | 'demonLord' | 'outlaw' | 'minion' | 'npc';

/**
 * Lifecycle:  rolling ──commitCharacter──▶ alive ──completeAdventure──▶ fallen | retired | victorious | sealed
 *
 * A `rolling` character exists only inside the generation loop. It has no effect
 * on the World until it is committed.
 */
export type CharacterStatus = 'rolling' | 'alive' | ExitStatus;

/**
 * The ways a character leaves play. Fallen go to the graveyard; the rest to the hall of fame.
 * A sealed soul is bound inside an item: out of play, but another hero may find it one day.
 */
export type ExitStatus = 'fallen' | 'retired' | 'victorious' | 'sealed';

// ─── Rarity ─────────────────────────────────────────────────────────────────

/** Most common first. An option's odds come from its weight; rarity is the tier it is shown as. */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'] as const;
export type Rarity = (typeof RARITIES)[number];

/** A trait as stored on a character: a frozen copy of its config definition. */
export interface Trait {
  id: string;
  name: string;
  description: string;
  /** Flat Combat Power this trait contributes (the "Trait Modifiers" term). May be negative. */
  power: number;
  /** Multiplies the character's whole Combat Power (a god of Space: ×10). Multipliers stack. */
  multiplier?: number;
  /**
   * The stats this trait's `power` grows with: spells and powers with Arcana, a sword style with
   * Might or Agility. The best of them scales it (see `statScale`: ×1 at Average 10).
   */
  scalesWith?: StatKey[];
  /** How well it is mastered, once a mastery wheel has honed it ('Virtuoso'). Shown with its name. */
  rank?: string;
  /** Fights earn this much more fame: 0.25 = a quarter more (a gear ability, a herald's banner). */
  fameBonus?: number;
  /** Spoils wheels lean rarer by this many rarity steps, and turn up "nothing" less (a gear ability). */
  lootLuck?: number;
  /**
   * A thing they carry rather than something they are. 'relic': a cloak, a crown, a lantern;
   * relics change hands as traits (taken from the dead, handed down by a legend). 'weapon' and
   * 'armor': an ability of the weapon or armour they have equipped (`Character.weapon`), kept in
   * step with it by engine/gear.ts. These come and go with the item, never on their own.
   */
  item?: 'weapon' | 'armor' | 'relic';
}

// ─── Gear ───────────────────────────────────────────────────────────────────

/** What a weapon deals, and what armour turns. Stored and shown now; fights read it in a later update. */
export const DAMAGE_TYPES = ['slashing', 'piercing', 'bludgeoning', 'fire', 'frost', 'lightning', 'holy', 'shadow', 'arcane', 'poison'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export type GearKind = 'weapon' | 'armor';

/**
 * A weapon or a suit of armour: one in hand, one worn (`Character.weapon`, `Character.armor`).
 * A frozen snapshot, like a trait: an item keeps what it was when it was made.
 */
export interface GearItem {
  /** Unique per item made. */
  id: string;
  kind: GearKind;
  /** 'Frostbitten Steel Longsword of Mending', 'The Holy Sword'. */
  name: string;
  /** Id into `GearConfig.bases`: 'longsword', 'plate'. */
  base: string;
  /** Set for a predetermined item: id into `GearConfig.uniques`. Only one of each is found in a world. */
  uniqueId?: string;
  rarity: Rarity;
  /** 1–10. Worth `WEAPON_TIER_CP` (or `ARMOR_TIER_CP`) per point, scaled by `stat`. */
  power: number;
  /** The stat it is wielded or worn with. */
  stat: StatKey;
  /** A weapon: the damage it deals. */
  damage?: DamageType;
  /** Armour: the damage it turns. */
  resists?: DamageType;
  /** Trait ids (`GameConfig.traits`) it gives whoever has it equipped. */
  abilities: string[];
  /** Points of power added (or lost) since it was made: a smith, a deed, a beating. */
  tempered?: number;
  /** A line of story, for a unique. */
  lore?: string;
  /** Where it came from: 'Taken from the Bridge Troll'. Only the latest hand is remembered. */
  foundFrom?: string;
}

/**
 * What an option hands over. A number: a generated item of that power. `unique`: a
 * predetermined one. A spec: a generated item within those limits. `item`: this exact item
 * (a Spoils wheel's slice, a blade taken from someone).
 */
export type GearGrant =
  | number
  | { unique: string; foundFrom?: string }
  | { power: number; rarity?: Rarity; base?: string; damage?: DamageType; name?: string; foundFrom?: string }
  | { item: GearItem }
  /** A random item this much more powerful than the one in that slot now (power 1 at least, 10 at most). */
  | { better: number; foundFrom?: string };

/** One line of a loot table. */
export type LootEntry =
  | {
      kind: GearKind;
      weight: number;
      /** The lowest and highest power it can roll, 1–10. Rarity then picks within it. */
      power: [number, number];
      /** Base ids to choose from. Default: any of that kind. */
      bases?: string[];
      /** Damage types (resists, for armour) to choose from. Default: the base's own. */
      damage?: DamageType[];
    }
  | { kind: 'unique'; weight: number; id: string };

/** What a foe can drop. A Spoils wheel is drawn from it after every win. */
export interface LootTable {
  /** Weight of the "nothing worth taking" slice. */
  nothing: number;
  entries: LootEntry[];
}

/** A weapon or armour shape, before material and affixes. */
export interface GearBase {
  id: string;
  kind: GearKind;
  /** 'Longsword'. */
  name: string;
  /** The stat it is used with. */
  stat: StatKey;
  /** A weapon's damage; armour's resist. */
  damage: DamageType;
  /** Lucide icon name, for its slice and its card. */
  icon: string;
}

/** A predetermined item: the Holy Sword, the Dragonbone Blade. */
export interface UniqueGear {
  id: string;
  kind: GearKind;
  name: string;
  base: string;
  rarity: Rarity;
  power: number;
  stat: StatKey;
  damage?: DamageType;
  resists?: DamageType;
  /** Trait ids, its signature ability first. */
  abilities: string[];
  lore: string;
  /** No one can take it from its bearer: the Holy Sword chooses who carries it. */
  untakeable?: boolean;
}

/** An ability generated gear can roll: a trait, how it names the item, and where it fits. */
export interface GearAbility {
  /** Id into `GameConfig.traits`: the trait it gives (its `item` is set to the slot it is in). */
  trait: string;
  /** Which slots can roll it. */
  kind: GearKind | 'any';
  /** The least rarity an item needs to roll it. */
  minRarity: Rarity;
  /** How it names the item: 'Frostbitten …' or '… of Mending'. */
  prefix?: string;
  suffix?: string;
  /** A weapon that rolls it deals this instead of its base's damage (armour: resists it). */
  infuse?: DamageType;
}

/** Everything gear: shapes, abilities, uniques, and who drops what. */
export interface GearConfig {
  bases: Record<string, GearBase>;
  abilities: GearAbility[];
  uniques: Record<string, UniqueGear>;
  /** Material names by power, 1–10: 'Rusted', 'Iron' … 'Starmetal'. */
  materials: string[];
  /** Proper names a legendary or mythical generated item may carry: 'Gravesong'. */
  legendNames: string[];
  /** The table for a foe with none of its own, from its power. */
  lootFor: (power: number) => LootTable;
  /** The colour of a damage type, for slices and chips. */
  damageColors: Record<DamageType, string>;
  /** How the Spoils wheel and its Keep/Take choice read. */
  spoilsWheel: { title: string; nothing: string; nothingDescription: string };
}

/** A race definition. Options set it by id with `setRace`; characters store the id. */
export interface Race {
  id: string;
  name: string;
  description: string;
  /** For a race that is a kind of another (Wood Elf → 'elf'), so rules can ask for the whole family. */
  family?: string;
  /** Given names for members, picked when creation ends. Falls back to the family's, then `GameConfig.fallbackNames`. */
  names?: string[];
  /**
   * How this race bends other wheels: odds[stepId][optionId] multiplies that option's
   * weight for its members (2 = twice as likely). A family's table applies too, with the
   * race's own entries winning. Like luck, it is the character's own odds, so it resizes slices.
   */
  odds?: Record<string, Record<string, number>>;
}

/** A title an option can earn. When creation ends, the highest-priority title earned is the character's. */
export interface Epithet {
  /** 'the Brave', 'of the Greenwood', 'Warboss of the Great Horde'. */
  text: string;
  /** Higher wins; on a tie, the later roll. */
  priority: number;
}

/** A personality definition. Options set it by id with `setPersonality`; characters store the id. */
export interface Personality {
  id: string;
  name: string;
  description: string;
  /** How this personality bends other wheels, exactly like `Race.odds`: odds[stepId][optionId]. */
  odds?: Record<string, Record<string, number>>;
}

/**
 * An archetype: not what a soul does but how fate treats them. A Wise soul spins every wheel
 * twice, a Gambler bets every gain, a Brute slams the wheel to a stop. Options set it by id with
 * `setArchetype`; characters store the id, and a frozen copy of its `rules` (`Character.rules`).
 */
export interface Archetype {
  id: string;
  name: string;
  description: string;
  /** How rare it is to be born this way: the tier its slice on the Wheel of Archetypes shows. */
  rarity: Rarity;
  /** How this archetype bends other wheels, exactly like `Race.odds`: odds[stepId][optionId]. */
  odds?: Record<string, Record<string, number>>;
  /** What it changes about spinning itself. Read by engine/archetypes.ts. */
  rules?: ArchetypeRules;
}

/**
 * How an archetype bends the act of spinning. Plain data, so it can be frozen onto the character
 * like a trait, and Combat Power never needs the config to read it. See engine/archetypes.ts.
 */
export interface ArchetypeRules {
  /** Wise: every spun wheel is spun twice, side by side, and the soul keeps the result they prefer. */
  rollTwice?: boolean;
  /** Gambler: after every gain (stats, banked bonuses, gear) this wheel bets it, double or nothing. */
  gamble?: string;
  /** All-Rounder: the first stat wheel rolled sets every stat to the same value (each still gets its own bank). */
  uniformStats?: boolean;
  /** Assassin: the only stat a weapon is wielded with. */
  weaponStat?: StatKey;
  /** Assassin: armour is worn with the best of these, instead of Vitality alone. */
  armorStats?: StatKey[];
  /** Realist: the lowest and highest options are cut from every wheel. */
  trimExtremes?: boolean;
  /** Dreamer: every wheel gains a Nightmare below its worst option and a Miracle above its best. */
  dreamTiers?: boolean;
  /** Trickster: this wheel is spun before every battle; what it lands on bends the hero's power for that fight. */
  beforeFight?: string;
  /** Martial: wheels that would teach a spell become this wheel instead (by id). */
  replaceSteps?: { steps: string[]; with: string };
  /** Martial: stats held at a fixed value, whatever is rolled (Arcana 0). Their stat wheels are skipped. */
  fixedStats?: Partial<StatBlock>;
  /** Archmage: no weapon can be held. Their hand stays empty, and weapon traits give no power. */
  noWeapon?: boolean;
  /** Archmage: spells (traits that scale with Arcana) are worth this many times their power. */
  spellMultiplier?: number;
  /** Brute: a Smash button stops the spinning wheel dead, on whatever slice is under the pointer. */
  smash?: boolean;
  /** Broken: one to three options vanish from every wheel, more from bigger wheels. */
  shatter?: boolean;
  /** Hero: holy options are dealt this much more weight, and the wheel drags as it passes them. */
  holyPull?: number;
  /** Hero: the chance a death doesn't take. */
  deathSave?: number;
  /** Ancient: how many times in a life the soul may decide a roll instead of spinning it. */
  decrees?: number;
  /** Transcendent: the odds of each rarity are swapped with its mirror (common ↔ mythical, uncommon ↔ legendary...). */
  mirrorRarity?: boolean;
}

/** What rides on a Gambler's coin: the gains of the roll just made. See engine/archetypes.ts. */
export interface GambleStake {
  /** Stat points gained. Doubled again, or taken back. */
  stats?: Partial<StatBlock>;
  /** Stats set outright by a stat wheel, at the value they were set to: doubled, or knocked to 1. */
  set?: Partial<StatBlock>;
  /** Banked bonus points gained. */
  bonus?: Partial<StatBlock>;
  /** Weapon and armour power gained (tempering, or better gear taken up). */
  weapon?: number;
  armor?: number;
}

/** One spin's outcome, kept on the character for history, replays and UI flair. */
export interface RollRecord {
  stepId: string;
  optionId: string;
  /** The chance this option had at the moment it was rolled (0–1). */
  probability: number;
  /** The name of the world character this wheel featured, if it cast one. */
  cast?: string;
  /** On a ladder wheel, where the wheel landed before banked bonuses moved the result (see ladder.ts). */
  bumpedFrom?: string;
  /** Fame this adventure roll earned (or cost). Absent when none. */
  fame?: number;
  /** What changed hands with the character the wheel cast: 'Took Aldric's Dragonbone Blade'. */
  note?: string;
  /** The player picked this option (a choice wheel) rather than the wheel landing on it. */
  chosen?: boolean;
  /** How an archetype decided this roll: smashed to a stop, decreed, or picked from two spins. */
  how?: 'smash' | 'decree' | 'wise';
  /** Something from the hero's past came back on this roll: a hook paid off, a place returned to. */
  callback?: string;
  /** A meter filled and this wheel is what happened: 'The Hunger took over'. */
  event?: string;
  /** The place this roll happened in, when the adventure was exploring one. */
  place?: string;
}

/** One finished adventure. */
export interface AdventureRecord {
  /** Every spin on this adventure, in order. */
  rolls: RollRecord[];
  /** How it ended: home again, turned (outlaw, minion, a new life), or out of play (graveyard or hall of fame). */
  outcome: 'returned' | 'turned' | ExitStatus;
  /** For a 'turned' outcome, what they became. */
  turnedTo?: CharacterRole;
  /** How the story ended, when an option wrote it down: 'Crowned ruler of Ironhold'. */
  note?: string;
  /** If this adventure was a quest: what it was, and the story it told. */
  quest?: QuestRecord;
  /** The place it explored, if it found or returned to one. */
  place?: { name: string; depth: number; discovered: boolean };
}

/** A finished quest, as the hero's history keeps it. */
export interface QuestRecord {
  title: string;
  objective: string;
  /** The decisions and events that mattered, in order. */
  log: string[];
  /** The rival it made, and how that ended. */
  rival?: { name: string; title: string; fate: string };
  /** How much the world's threat moved because of it. */
  worldThreat: number;
}

// ─── Stories: the memory of a quest ─────────────────────────────────────────

/**
 * What a quest remembers while it runs. It lives on the hero (`Character.story`) for the
 * length of one adventure, so conditions, odds and foes can read it; `completeAdventure`
 * files it into the adventure record and takes it off again. It is never saved on a character.
 */
export interface StoryState {
  title: string;
  objective: string;
  /** Encounters the quest runs before its finale. */
  length: number;
  /** Encounters met so far. */
  beats: number;
  /** The quest's local danger, 0–10: noise, theft and betrayal raise it, lying low eases it. */
  threat: number;
  /** A few named counters the content reads: { allies: 2, relic: 1, mercy: 1 }. Never below 0. */
  flags: Record<string, number>;
  /** The decisions and events that mattered, in order: the quest's story. */
  log: string[];
  /** Wheels already met on this quest, so encounters and events don't repeat. */
  seen: string[];
  /** The one rival this quest made, if it made one. */
  rival: Rival | null;
}

/** Someone the hero's own actions turned into an enemy. One per quest, at most. */
export interface Rival {
  name: string;
  /** 'the Humiliated Champion'. */
  title: string;
  /** What drives them: 'Wounded pride'. */
  motivation: string;
  /** What they want: 'To see you shamed the way you shamed them'. */
  goal: string;
  /** Combat Power, set from the hero's when they were made, and changed by what happens. */
  power: number;
  /** 1 met, 2 escalating, 3 concluded. */
  stage: number;
  /** How many times they have escalated (capped, so a rivalry can't grow forever). */
  escalations: number;
  /** Swords at their back. */
  allies: number;
  /** What they remember the hero doing, oldest first: why they care, and what happened since. */
  memory: string[];
  /** How the rivalry ended, once it has. */
  fate?: string;
}

/** The kind of rival an option can create. Their name is drawn when they appear. */
export interface RivalTemplate {
  title: string;
  motivation: string;
  goal: string;
  /** Why they care about this hero: the first thing they remember. */
  grudge: string;
  /** Their power, as a share of the hero's Combat Power when they appear. */
  power: number;
}

/**
 * What an adventure option does to the quest's memory. Text can name `{rival}`, `{hero}`,
 * `{quest}` and `{cast}` (whoever the wheel featured).
 */
export interface StoryEffect {
  /** Starts a quest (ignored if one is already under way). Its length is drawn from the range. */
  begin?: { title: string; objective: string; length: [number, number] };
  /** Counts as one of the quest's encounters. */
  beat?: boolean;
  /** Added to the quest's threat (kept within 0–10). */
  threat?: number;
  /** Added to the quest's flags. */
  flags?: Record<string, number>;
  /** A line for the quest's story. */
  log?: string;
  /** Something the rival will remember (only if there is a rival). */
  remember?: string;
  rival?: {
    /** Makes the quest's rival, if it has none yet. */
    create?: RivalTemplate;
    /** They grow: power × (1 + power), more allies. Capped at RIVAL_MAX_ESCALATIONS. */
    escalate?: { power?: number; allies?: number };
    /** Their power × this. */
    weaken?: number;
    /** The rivalry ends, like this. */
    resolve?: string;
  };
  /** Added to the world's threat dial when the adventure is written: the quest spilled over. */
  worldThreat?: number;
}

export interface Character {
  id: string;
  name: string;
  createdAt: number;
  role: CharacterRole;
  status: CharacterStatus;
  /** Id into `GameConfig.races`, or null before an option has set one. */
  race: string | null;
  /** Id into `GameConfig.personalities`, or null before an option has set one. */
  personality: string | null;
  /** Id into `GameConfig.archetypes`, or null before an option has set one. */
  archetype: string | null;
  /** A frozen copy of the archetype's rules, set with it. Absent for souls without one (and older saves). */
  rules?: ArchetypeRules;
  /** Ancient: decrees left (`ArchetypeRules.decrees`). */
  decrees?: number;
  /** Gambler: the gains riding on the coin about to be spun, and where the road goes once it lands. */
  stake?: { gains: GambleStake; then: string | null };
  /** Trickster: what the last pre-battle wheel did to their power, for the fight about to happen. Spent by it. */
  fightBoost?: number;
  /** All-Rounder: the value the first stat wheel rolled, which every later stat wheel gives instead. */
  uniformStat?: number;
  /** Earned on the wheels and set when creation ends, e.g. 'Warboss of the Great Horde'. Null if none. */
  title: string | null;
  stats: StatBlock;
  /**
   * Bonuses banked by earlier wheels (race, fate, personality...). Each point moves that
   * stat's roll one position up its ladder once it lands (or down, if negative), then the
   * bank is spent. All zero once creation is over.
   */
  statBonus: StatBlock;
  /**
   * Fortune, set mostly by fate. 0 = ordinary. It bends every option with `luckScaling`:
   * stat wheels, the Armory, treasure on the road.
   */
  luck: number;
  /** The weapon in hand, or null for bare hands. Each point of its power is worth `WEAPON_TIER_CP` Combat Power. */
  weapon: GearItem | null;
  /** The armour worn, or null for travelling clothes. Each point of its power is worth `ARMOR_TIER_CP`. */
  armor: GearItem | null;
  /**
   * Gear offered while that slot was already filled, oldest first: the player keeps what they
   * have or takes it (engine/gear.ts `chooseGear`). Absent when nothing waits.
   */
  gearOffers?: GearItem[];
  /** How many items have been made for this character: seeds the next, so the same rolls make the same gear. */
  gearMinted?: number;
  /**
   * Renown, earned on adventures: more for harder foes and grander wins. Its tier (see
   * `GameConfig.fame`) bends the crossroads toward riskier roads and unlocks the greatest
   * challenges, and the endings that come with them.
   */
  fame: number;
  /** Snapshots, so a fallen hero keeps their power even if the config is rebalanced later. */
  traits: Trait[];
  /** Free-form flags that wheel conditions can read, e.g. 'cursed', 'blessed'. */
  tags: string[];
  /** One-of-a-kind roles this character will hold once committed to the world. */
  singletonClaims: SingletonKey[];
  /** Every creation spin, in order. The path through the wheel graph. */
  history: RollRecord[];
  /** Every finished adventure, oldest first. */
  adventures: AdventureRecord[];
  /**
   * Spins owed on particular wheels (`WheelOption.queueSpins`), e.g. three on Blessed
   * Powers for a god. A route spends them; spinning a queued wheel uses one up.
   */
  spinQueue: string[];
  /** Set when the character leaves play (graveyard or hall of fame). */
  fate?: { at: number; summary: string };
  /** The quest under way, during an adventure only. Never saved: see `StoryState`. */
  story?: StoryState;
  /**
   * Pressure that builds over adventures (`GameConfig.meters`): wounds, notoriety, hunger. When one
   * fills, its trigger wheel comes up as the road would end. Missing meters are 0.
   */
  meters?: Record<string, number>;
  /** The place this adventure explores, during an adventure only (like `story`): see `Expedition`. */
  expedition?: Expedition;
  /**
   * The seed this soul was rolled from, if it was: the same seed rolls the same soul, and
   * (with the same choices) the same adventures. Each adventure draws from `seed:n`.
   */
  seed?: string;
  /** The day (YYYY-MM-DD) this soul was that day's Daily Soul. */
  daily?: string;
  /** The house this soul was born into, if they are someone's heir (engine/lineage.ts). */
  lineage?: Lineage;
  /** Rolled by the world itself (a rival hero, a risen Demon Lord), never lived by the player. */
  worldBorn?: boolean;
}

/** An heir's place in a dynasty. */
export interface Lineage {
  /** The family name, passed down from the founder. */
  house: string;
  /** 2 for the founder's child, 3 for their grandchild… The founder is 1, and has no lineage. */
  generation: number;
  parentId: string;
  /** The parent's choice on the Wheel of Ancestry, which the heir's own leans toward. */
  ancestry?: string;
}

// ─── Persisted state: World ─────────────────────────────────────────────────

/**
 * Any string names a one-of-a-kind role: 'demon_lord', 'chosen_hero', 'archmage', ...
 * The engine never lists them. A key comes into existence the moment a config
 * option declares `claimSingleton: '<key>'`.
 */
export type SingletonKey = string;

/**
 * Who holds each one-of-a-kind role.
 *
 *   key present  → claimed; the value is the holder's Character id
 *   key absent   → free
 *
 * There is no list of keys anywhere in the engine, so adding a new role is a
 * config-only change.
 */
export type ActiveSingletons = Record<SingletonKey, string>;

export interface World {
  /** Bump when the persisted shape changes; `loadWorld` upgrades v2–v9 and rejects anything else. */
  schemaVersion: 10;
  id: string;
  createdAt: number;
  activeSingletons: ActiveSingletons;
  /**
   * The one hero the player is living through, from creation to the end of their story.
   * Null between lives: a new soul can only be rolled once the last one's story is over.
   */
  heroId: string | null;
  /** Characters currently in play: the player's hero, the reigning Demon Lord, and the world's own people. */
  roster: Character[];
  graveyard: Character[];
  hallOfFame: Character[];
  /**
   * Global danger dial. 0 = peaceful; the sample content is tuned for roughly 0–5.
   * It bends option weights through `WheelOption.threatScaling`, so the world's
   * history shapes every future roll.
   */
  threatLevel: number;
  /** Seasons since the world began. Every adventure takes one; four make a year. */
  season: number;
  /** What the world remembers, oldest first: arrivals, deeds, endings, and its own events. */
  chronicle: ChronicleEntry[];
  /**
   * Signs hanging over the world for a few seasons (a plague, a comet, a war), left by its
   * own events (`GameConfig.worldEvents`). Options bend to them with `omenScaling`.
   */
  omens: Omen[];
  /**
   * Places heroes have found and mapped: ruins, wilds, lairs, rifts. They outlive their finders,
   * so the next hero can go back, and deeper. Missing in older saves: none.
   */
  places?: Place[];
}

/** A place on the world's map, found on an adventure and there to return to. */
export interface Place {
  id: string;
  name: string;
  /** Id into `GameConfig.placeKinds`. */
  kind: string;
  /** How deep anyone has gone. Each return can go deeper; deeper is richer and deadlier. */
  depth: number;
  /** Who found it, by name and id. */
  foundBy: string;
  foundById: string;
  foundSeason: number;
  visits: number;
  /** Why it is done, once it is: 'Its heart was claimed by Aldric'. Closed places are never returned to. */
  closed?: string;
}

/** A place being explored on the current adventure. It is written to `World.places` with the adventure. */
export interface Expedition {
  placeId: string;
  name: string;
  kind: string;
  depth: number;
  /** Found on this very adventure. */
  isNew: boolean;
  /** Who found it first. */
  foundBy: string;
  closed?: string;
}

/** A world event's lasting mark. Active while `world.season < until`. */
export interface Omen {
  id: string;
  label: string;
  description: string;
  until: number;
}

/**
 * Something the world does on its own between seasons: a plague, a festival, a comet, the
 * Demon Lord on the march. Rolled after each of the player's adventures (state/worldTurn.ts).
 */
export interface WorldEventDef {
  id: string;
  /** How it reads in the chronicle. */
  text: string | ((world: World) => string);
  baseWeight: number;
  /** Like an option's: the darker the world, the likelier (or rarer). */
  threatScaling?: number;
  /** Only when this holds (a Demon Lord reigns, say). */
  condition?: (world: World) => boolean;
  /** Added to the world's threat, clamped to 0–10. */
  threat?: number;
  /** The mark it leaves, for this many seasons. Options name it by `id` in `omenScaling`. */
  omen?: { id: string; label: string; description: string; seasons: number };
  /** A new hero of the world's own comes of it. */
  newHero?: boolean;
  tone?: ChronicleEntry['tone'];
}

/** What kind of thing a chronicle entry records. */
export type ChronicleKind = 'arrival' | 'deed' | 'ending' | 'world' | 'rival';

/** One line in the world's history. The words are written when it happens, so later config changes never rewrite the past. */
export interface ChronicleEntry {
  season: number;
  kind: ChronicleKind;
  text: string;
  /** The character it is about, if one. */
  who?: string;
  /** How it reads: a triumph, a loss, a turn of the world. */
  tone?: 'gold' | 'ember' | 'moss';
}

// ─── Config: the wheel graph ────────────────────────────────────────────────

/** Reads the world and the character being rolled. Must be pure. */
export type WorldPredicate = (world: World, char: Character) => boolean;
/** Static text, or text computed from the current world and character. */
export type WorldText = string | ((world: World, char: Character) => string);

/**
 * A branch decided by the character rather than the roll, e.g. "Demon Lords go to the
 * Abyssal wheel, heroes to Talents". `among` lists every wheel it can pick, so the
 * graph can still be checked statically.
 */
export interface StepRoute {
  among: string[];
  /** Must be pure, and return one of `among` (or null to end). */
  pick: (world: World, char: Character) => string | null;
}

/** On a fight wheel, which side of the fight an option is. */
export type FightSide = 'win' | 'lose';

export interface WheelOption {
  /** Unique within its step. Stored in `RollRecord`, so treat it as permanent. */
  id: string;
  label: string;
  description?: string;

  // ── Odds ──
  /**
   * Relative weight before any modifiers. Together with the character's own odds (luck,
   * fights; see `dealOptions`) it sets the slice's size on the wheel, locked or not.
   * 0 makes the option unrollable and gives it no slice (it still shows in the odds list).
   */
  baseWeight: number;
  /**
   * How strongly `world.threatLevel` bends this option's odds:
   *   effectiveWeight = baseWeight × max(0, 1 + threatScaling × threatLevel)
   * Positive = more likely in dark times. Negative = fades out as threat rises.
   * Threat is the world's, so it changes the odds but never the slice's size.
   */
  threatScaling?: number;
  /**
   * How strongly the character's luck bends this option's odds:
   *   dealt weight = baseWeight × max(0, 1 + luckScaling × char.luck)
   * Luck is the character's own, so unlike threat it also resizes the slice.
   */
  luckScaling?: number;
  /**
   * How strongly the character's stats bend this option's odds, per point away from Average (10):
   *   dealt weight = baseWeight × max(0, 1 + Σ k × (stat − 10))
   * { intellect: 0.03 }: a sharp mind (16) makes it 18% likelier, a dim one (4) 18% less likely.
   * Like luck, it is the character's own, so it resizes the slice.
   */
  statScaling?: Partial<StatBlock>;
  /**
   * How strongly the character's renown bends this option's odds, per fame tier (see `GameConfig.fame`):
   *   dealt weight = baseWeight × max(0, 1 + fameScaling × tier)
   * Positive = the famous are drawn to it (wars, legendary beasts); negative = they outgrow it.
   * Like luck, it is the character's own, so it resizes the slice.
   */
  fameScaling?: number;
  /**
   * A trait-specific outcome: dealt only to characters who own one of these traits (ids into
   * `GameConfig.traits`). Everyone else never sees it, not even as a locked slice.
   */
  requiresTrait?: string[];
  /** Like `requiresTrait`, for tags: dealt only to characters carrying one of them (a hook to pay off). */
  requiresTag?: string[];
  /** Dealt only to characters of one of these races (or their families): an identity's own verbs. */
  requiresRace?: string[];
  /**
   * An outcome for one kind of cast character: dealt only when the character this wheel cast
   * passes the test (a blacksmith's offer only when the townsfolk met is a blacksmith). With no
   * one cast, it is never dealt. Must be pure.
   */
  castCondition?: (cast: Character, hero: Character) => boolean;
  /**
   * On a wheel with a `foe`: 'win' options are scaled by the chance to win the fight,
   * 'lose' options by the chance to lose it. That chance comes from Combat Power:
   * heroCP / (heroCP + foe.power). Like luck, it resizes the slice.
   */
  fight?: FightSide;
  /** On a battle's Clash wheel: what this slice does to either side (engine/battle.ts). */
  clash?: ClashSlice;
  /**
   * On the evade wheels (`AdventureConfig.evade`): 'fight' goes on to the fight the hero stood
   * before, as if nothing happened; 'escape' skips it, and the road goes where the fight would
   * have gone afterwards (`WheelStep.afterFight`). Either way `nextStepId` is not followed.
   */
  evade?: 'fight' | 'escape';
  /**
   * The tier this option is shown as. Defaults to 'common'. It never changes the odds;
   * `validateGameConfig` warns when a rarer option outweighs a more common one on the same wheel.
   */
  rarity?: Rarity;
  /**
   * A per-character twist on the option, applied when it is dealt (before race, luck and
   * fights): e.g. Mischief, whose rarity changes from soul to soul, or a hybrid's second
   * ancestry, which keeps the first race as a bloodline tag. Must be pure: the same
   * character always gets the same answer.
   */
  vary?: (char: Character) => Partial<Pick<WheelOption, 'baseWeight' | 'rarity' | 'grantTags'>>;

  // ── Effects on the character ──
  /** Added to the character's stats right away. Negative values allowed; stats floor at 0. */
  statModifiers?: Partial<StatBlock>;
  /**
   * The most `statModifiers` can raise each stat to: a teacher can't teach past what they can
   * do themselves. A stat already above it stays where it is.
   */
  statCap?: Partial<StatBlock>;
  /**
   * Banked on the character (`Character.statBonus`): each point moves that stat's roll one
   * position up its ladder when it lands. For wheels that come before the stat wheels.
   */
  statBonus?: Partial<StatBlock>;
  /** A stat roll: sets these stats outright, and spends that stat's bank. */
  setStats?: Partial<StatBlock>;
  /** Added to the character's luck. */
  luckDelta?: number;
  /**
   * Better (or worse) steel. A gain is a weapon found, this much more powerful than the one in hand
   * (`GearGrant` `{ better }`): random, and offered like any found item (Keep or Take). Only an
   * `upgrade` (a smith, a forge) tempers the weapon in hand instead. A loss always wears the one in
   * hand down (to 0, it breaks and is gone).
   */
  weaponTierDelta?: number;
  /** The same, for the armour they wear. */
  armorTierDelta?: number;
  /** A real upgrade (a smith, a forge, a blade awakened): a tier gain tempers what they carry rather than finding something new. */
  upgrade?: boolean;
  /**
   * How an omen hanging over the world (`world.omens`) bends this option: { plague: 2 }
   * doubles its weight while a plague lasts. Like threat, it changes the odds, not the slice.
   */
  omenScaling?: Record<string, number>;
  /**
   * A weapon or armour, found or made (see `GearGrant`). An empty slot takes it at once; a filled
   * one has it offered, and the player keeps what they have or takes it (`Character.gearOffers`).
   * Use it for a particular item (a rusty blade, a coat of mail); the deltas are for making
   * what they have better (a reforging, a theft).
   */
  gear?: { weapon?: GearGrant; armor?: GearGrant };
  /** A fight win that takes nothing from the fallen (spared, befriended, recruited): no Spoils wheel follows. */
  noSpoils?: boolean;
  /**
   * Fame this roll earns on an adventure (negative for disgrace; fame floors at 0). Without it,
   * `GameConfig.fame.earn` decides (more for harder foes and grander wins). Creation earns none.
   */
  fame?: number;
  /** Ids into `GameConfig.traits`. Already-owned traits are not granted twice. */
  grantTraits?: string[];
  /** Trait ids the character loses: an item given away, a gift taken back. */
  removeTraits?: string[];
  /** What it does to the quest under way (adventures only). See `StoryEffect`. */
  story?: StoryEffect;
  grantTags?: string[];
  /** Tags the character loses: a hook paid off, a mark washed away. */
  removeTags?: string[];
  /** Added to the character's meters (`GameConfig.meters`), kept within 0 and the meter's max. */
  meters?: Record<string, number>;
  /**
   * What came back from the hero's past, for the reveal and the record ('The thing that followed
   * them home caught up'). Can name `{place}`, `{cast}`, `{hero}`.
   */
  callback?: string;
  /** Adventures only: finds a new place of this kind, deepens the one being explored, or closes it. */
  place?: { discover?: string; deepen?: number; close?: string };
  setRole?: CharacterRole;
  /** Id into `GameConfig.races`. */
  setRace?: string;
  /** Id into `GameConfig.personalities`. */
  setPersonality?: string;
  /** Id into `GameConfig.archetypes`. */
  setArchetype?: string;
  /** Holy: a Hero is dealt more of it, and the wheel drags as it passes (`ArchetypeRules.holyPull`). */
  holy?: boolean;
  /** On a Gambler's wheel: what happens to the stake (`Character.stake`). A jackpot triples it. */
  gamble?: 'double' | 'triple' | 'lose';
  /** On a Trickster's wheel: their power is multiplied by this for the coming fight (`Character.fightBoost`). */
  fightBoost?: number;
  /**
   * Hones the trait the character gained most recently (a mastery wheel right after a power
   * wheel): its power is multiplied by `factor`, and it carries `rank`, e.g. 'Virtuoso'.
   */
  honeLastTrait?: { factor: number; rank: string };
  /**
   * Masters one trait the character owns (a mastery ladder after "which power?"): its power
   * becomes its base power from config × `factor`, and it carries `rank`. Unlike
   * `honeLastTrait` this sets the rank rather than stacking on it, so climbing from Expert to
   * Paragon lands on Paragon's power, not Expert's times Paragon's.
   */
  honeTrait?: { trait: string; factor: number; rank: string };
  /**
   * Spins this option owes the character on other wheels: { blessed_powers: 3 }. Added to
   * `Character.spinQueue`; a route (see `StepRoute`) sends the character to them later.
   */
  queueSpins?: Record<string, number>;
  /** A title this roll can earn. See `Epithet`. */
  epithet?: Epithet;
  /** Becomes the character's family name when creation ends: 'Thorin Ironfist'. The latest one rolled wins. */
  surname?: string;
  /**
   * Takes the character out of play. On an adventure this ends the adventure at once,
   * so the option's `nextStepId` should be null.
   */
  setStatus?: ExitStatus;
  /**
   * Make this option a one-of-a-kind role. Any string works ('demon_lord', 'archmage').
   * The engine locks the option while `world.activeSingletons[key]` exists, and
   * `commitCharacter` writes the key. Abandoning a half-rolled character claims nothing.
   */
  claimSingleton?: SingletonKey;
  /**
   * What this option does to the character the wheel cast (see `WheelStep.cast`), not to
   * the one spinning. Applied to the world when the adventure is written.
   */
  castEffect?: CastEffect;
  /**
   * What the hero takes from (or is given by) the character the wheel cast, worked out from
   * who they are when the wheel lands: their blade if it is better, the items they carry, a
   * technique they teach. Must be pure.
   */
  spoils?: (cast: Character, hero: Character) => CastSpoils;
  /**
   * How the story ends, for the record, when this option ends the hero's adventuring (out of
   * play, or a new life in the world): 'Gave their life to seal the Breach'. It replaces the
   * plain fate summary ('Fell on adventure 3') and is kept with the adventure.
   */
  fate?: string;

  // ── Graph ──
  /**
   * The next wheel to spin, a route that picks one from the character, or null to finish.
   * Required, so leaves are explicit.
   */
  nextStepId: string | null | StepRoute;

  // ── Availability ──
  /** Extra availability rule. `false` → slice is drawn grayed out with a lock, weight becomes 0. */
  condition?: WorldPredicate;
  /** Tooltip for a locked slice. Defaults to a generic message. */
  lockedReason?: WorldText;

  // ── Presentation hints (the engine never reads these) ──
  /** Slice fill colour (hex). */
  color?: string;
  /** lucide-react icon name, e.g. 'Crown'. */
  icon?: string;
}

export interface WheelStep {
  id: string;
  title: string;
  subtitle?: string;
  /** Makes this a fight: options with `fight` set are weighted by the hero's chance against this foe. */
  foe?: Foe;
  /**
   * A foe worked out from the hero as they arrive (their rival, an ambush that grows with the
   * quest's threat). Replaces `foe`, which stays as the fallback. Must be pure.
   */
  foeOf?: (char: Character) => Foe;
  /**
   * The player picks the option instead of spinning: a decision. Locked options can't be picked.
   * Each option's weight is only how likely a hero left to themselves (an autoplay) picks it.
   */
  choice?: boolean;
  /**
   * The options are a ladder of tiers, best first (a stat wheel). Their rarity marks how
   * rare it is to roll that well, not how light the slice is, so the weight-order rarity
   * check is skipped for this wheel.
   */
  ladder?: boolean;
  /** Its odds are exact by design (an even 50/50, a race's pull): common options aren't trimmed (odds.ts). */
  exactOdds?: boolean;
  /**
   * On a ladder: the wheel to spin when banked bonuses push the roll past the best position
   * (a stat's Ascension). Creation then carries on where the ladder would have led.
   */
  overflow?: string;
  /** How a ladder bump is shown, e.g. 'hammer'. Presentation only; the UI keeps the list of effects. */
  upgradeEffect?: string;
  /**
   * Feature a character from the world on this adventure wheel. With two or more to choose
   * from, a "who is it?" wheel is spun first (see `AdventureConfig.castWheel`); with one,
   * they simply appear. Guard the option that leads here with a condition, so the pool is
   * never empty.
   */
  cast?: CastSpec;
  /** Arriving here takes the hero back to a place they (or someone) found: see `Expedition`. */
  visitsPlace?: boolean;
  /** Can come up several times in a row (spin queues, re-rolls), so a cycle through it is intended. */
  repeats?: boolean;
  /** Drawn as a golden wheel: an ascension, a once-in-a-lifetime roll. Presentation only. */
  golden?: boolean;
  /** No archetype reshapes this wheel: no trimming, no dream tiers, no shattering (an archetype's own wheels). */
  fixed?: boolean;
  /** On a fight: where the road goes once it is over, by default. A hero who evades it goes here. */
  afterFight?: string | null | StepRoute;
  /** A big fight: fought as a battle of several rounds (engine/battle.ts) before this wheel says how it ended. */
  battle?: boolean;
  /** Rendered clockwise in this order. Order also defines `ResolvedSlice.index`. */
  options: WheelOption[];
}

export interface CastSpec {
  /** Who can appear, for the hero arriving (so a rival is never the hero themself). Must be pure. */
  from: (world: World, char: Character) => Character[];
  /** The cast character is the wheel's foe: their name, their Combat Power (replacing `foe`). */
  asFoe?: boolean;
}

/**
 * A change to a cast character. 'alive' brings someone back into play (out of retirement, out
 * of the grave, out of a sealed relic); 'fallen' sends them to the graveyard.
 */
export interface CastEffect {
  setStatus?: 'alive' | 'fallen';
  setRole?: CharacterRole;
  /** How their fate summary starts when they fall, before the hero's name. Default 'Brought down by'. */
  fallenBy?: string;
  /** Their weapon / armour becomes this (null once it has been taken from them). */
  weapon?: GearItem | null;
  armor?: GearItem | null;
  /** Trait ids they lose: items taken from them. */
  loseTraits?: string[];
  /** Snapshot traits they gain: a sworn bond. Already-owned ids are skipped. */
  gainTraits?: Trait[];
  /** Tags they gain, e.g. 'claimed' on a relic someone carried off. */
  addTags?: string[];
  /** Added to their fame (a ballad sung of them, or disgrace). Floors at 0. */
  fame?: number;
}

/** What a hero takes from the character a wheel cast. See `WheelOption.spoils`. */
export interface CastSpoils {
  /** Snapshot traits the hero gains: an item taken from them, a technique they taught. Already-owned ids are skipped. */
  traits?: Trait[];
  /** Their weapon, offered to the hero (who keeps their own, or takes it). */
  weapon?: GearItem;
  /** Their armour, offered likewise. */
  armor?: GearItem;
  /** Added to the hero's stats: what a teacher trained into them. */
  stats?: Partial<StatBlock>;
  /** What it does to the cast character, on top of the option's own `castEffect`. */
  effect?: CastEffect;
  /** For the reveal and the record: 'Took Aldric’s Dragonbone Blade and armour'. */
  summary?: string;
}

/** Something to fight. `power` is on the same scale as Combat Power. */
export interface Foe {
  name: string;
  power: number;
  /** What it drops: a Spoils wheel is drawn from this after a win. Default: `GearConfig.lootFor(power)`. */
  loot?: LootTable;
  /** Damage it is weak to: hits of these land harder (engine/matchup.ts). */
  weak?: DamageType[];
  /** Damage it shrugs off in part. */
  resists?: DamageType[];
  /** Damage that barely touches it. */
  immune?: DamageType[];
  /** What its ordinary blows deal: armour that turns it takes less. Default: bludgeoning. */
  strikes?: DamageType;
  /** Its signature blows, on a battle's wheel. The one it readies is announced a round ahead. */
  moves?: FoeMove[];
  /** A boss: fought as a battle of several rounds, with health bars, rather than one spin (engine/battle.ts). */
  battle?: boolean;
}

/** A power as it is cast in a battle (`BattleConfig.spells`). */
export interface BattleSpell {
  /** hit: damage at the foe. heal: health back. drain: a hit that heals what it takes. ward: the foe's next wheel shrinks. */
  kind: 'hit' | 'heal' | 'drain' | 'ward';
  damage?: DamageType;
  /** Battle units dealt (or healed). A ward deals none. */
  power: number;
  /** For the battle log: 'hurls a Fireball'. */
  verb: string;
}

/** One slice of the Crit Cascade. */
export interface CascadeSlice {
  id: string;
  label: string;
  mult: number;
  /** Doubles (its `mult`) and spins again, faster. */
  chain?: boolean;
  weight: number;
  rarity: Rarity;
  color: string;
}

/** Boss battles: what can be cast in them, the Crit Cascade, and how the Clash wheel's slices look. */
export interface BattleConfig {
  /** Keyed by trait id: the powers that can be cast. */
  spells: Record<string, BattleSpell>;
  cascade: CascadeSlice[];
  /** How many cascade wheels can stack. */
  cascadeDepth: number;
  /** A foe's crit: one spin of these multipliers. */
  foeCascade: { mult: number; weight: number }[];
  /** Keyed by `ClashSlice.kind`. `{foe}`, `{move}` are filled in. */
  look: Record<string, { label: string; description: string; icon: string; color: string }>;
}

/** A foe's signature blow in a battle: 'Fire Breath', fire. */
export interface FoeMove {
  name: string;
  damage: DamageType;
  /** What it readying it looks like: 'rears back, smoke curling from its jaws'. */
  tell?: string;
}

/**
 * What one slice of a battle's Clash wheel does (engine/battle.ts). Damage is in battle units:
 * both sides have `BATTLE_POOL` of them at full health.
 */
export interface ClashSlice {
  kind: 'strike' | 'glance' | 'crit' | 'spell' | 'execute' | 'leech' | 'stand' | 'riposte' | 'block' | 'foe_strike' | 'foe_move' | 'foe_crit' | 'thorns';
  /** Damage dealt to the foe. */
  toFoe?: number;
  /** Damage dealt to the hero. */
  toHero?: number;
  /** Health the hero gets back. */
  heal?: number;
  /** The foe's side of the next wheel shrinks. */
  ward?: boolean;
  /** The kind of damage that lands. */
  damage?: DamageType;
  /** How the damage met its target: weak, resisted, immune, or turned by armour. */
  matchup?: 'weak' | 'resisted' | 'immune' | 'turned';
  /** The spell cast, for a spell slice. */
  spellId?: string;
}

export interface GameConfig {
  /** The first wheel every character spins. */
  entryStepId: string;
  /** Every wheel, keyed by its id. Creation and adventure wheels live side by side. */
  steps: Record<string, WheelStep>;
  /** Trait definitions. Options grant these by id; characters store copies. */
  traits: Record<string, Trait>;
  /** Race definitions. Options set one by id with `setRace`. */
  races: Record<string, Race>;
  /** Personality definitions. Options set one by id with `setPersonality`. */
  personalities: Record<string, Personality>;
  /** Archetype definitions. Options set one by id with `setArchetype`. */
  archetypes: Record<string, Archetype>;
  /** Given names for anyone whose race has none. */
  fallbackNames: string[];
  /** Starting stats for every new character. */
  baseStats: StatBlock;
  /** Names a stat's value for this character ('Mighty', 'Battle Ram'), for display. Optional. */
  statName?: (stat: StatKey, value: number, char: Character) => string;
  /** Renown: its tiers, and what each adventure roll earns. */
  fame: FameConfig;
  /** Display names for the quest flags worth showing (`StoryState.flags`); unnamed flags stay hidden. */
  storyFlags?: Record<string, string>;
  adventure: AdventureConfig;
  /** What the world does on its own between seasons. None: a world that only changes when heroes change it. */
  worldEvents?: WorldEventDef[];
  /** Pressure that builds over a life, shown as bars; a full one sends the hero to its trigger wheel. */
  meters?: MeterDef[];
  /** The kinds of place a hero can find (`WheelOption.place`): names and looks. */
  placeKinds?: Record<string, PlaceKind>;
  /** Tags that are unfinished business, with how to show them: 'hook:followed' → 'Something followed them home'. */
  hooks?: Record<string, HookDef>;
  /** What becoming a race means, for the reveal: new things they can do, doors that close. Keyed by race id. */
  identities?: Record<string, IdentityKit>;
  /** Weapons, armour and loot. Without it, gear grants make plain items and fights drop nothing. */
  gear?: GearConfig;
  /** Boss battles. Without it, every fight is a single spin. */
  battle?: BattleConfig;
}

/** A pressure that builds: wounds, notoriety, a vampire's hunger. */
export interface MeterDef {
  id: string;
  label: string;
  /** Three letters for the bar. */
  short: string;
  description: string;
  max: number;
  color: string;
  icon: string;
  /** The wheel that comes up, as the road would end, once it is full. It empties. */
  trigger: string;
  /** For the record: 'The Hunger took over'. */
  fills: string;
  /** Added at the start of each adventure, for those it applies to (hunger, the moon). */
  perAdventure?: number;
  /** Who has this meter at all. Default: everyone. Must be pure. */
  appliesTo?: (char: Character) => boolean;
}

export interface PlaceKind {
  label: string;
  names: string[];
  icon: string;
  color: string;
}

export interface HookDef {
  label: string;
  description: string;
}

export interface IdentityKit {
  /** 'You are a vampire now.' */
  headline: string;
  gains: string[];
  loses: string[];
}

/** One rung of renown: 'Famous' from 60 fame. */
export interface FameTier {
  name: string;
  /** The fame it starts at. The first tier starts at 0. */
  min: number;
  /** A line about what it means, for display. */
  description?: string;
}

export interface FameConfig {
  /** Lowest first, the first at 0, each `min` higher than the last. A hero's tier is the last one their fame reaches. */
  tiers: FameTier[];
  /**
   * Fame an adventure roll earns when the option sets no `fame` of its own. Gets the wheel as the
   * hero faced it (a cast foe's power in place), so a harder fight can be worth more. Must be pure.
   */
  earn: (option: WheelOption, step: WheelStep, char: Character) => number;
  /**
   * The least fame an adventure earns when the hero comes home from it: a season on the road is
   * still a story told. Only tops up an adventure that earned less (never one that lost fame on purpose).
   */
  floor?: number;
}

export interface AdventureConfig {
  /** The first wheel of every adventure. The road ends when an option's next step is null. */
  entryStepId: string;
  /** The "who is it?" wheel, spun before a cast wheel that has two or more candidates. */
  castWheel: CastWheelConfig;
  /**
   * The way home: when the road would end before the hero has spun `minSpins` wheels on it (a
   * "who is it?" wheel doesn't count), this wheel comes up first, once per adventure, so no
   * adventure is a single errand. A full meter still has the last word before it.
   */
  roadHome?: { stepId: string; minSpins: number };
  /**
   * Slipping past a fight (Shadowstep): before any wheel with a foe, a hero with one of
   * `traits` is sent to `stepId` first, a choice wheel. Its options, and the wheels they lead
   * to, end with an option marked `evade`: on to the fight, or past it. `{foe}` and `{power}`
   * in their words name what stands in the way.
   */
  evade?: { traits: string[]; stepId: string };
  /** Boss battles: how spells are cast. 'auto': they are slices on the wheel. 'choose': the player casts them between spins. */
  battleSpells?: SpellMode;
}

/** How a battle's spells are cast (engine/battle.ts). One of these is to be retired after playtesting. */
export type SpellMode = 'auto' | 'choose';

/** The look of the "who is it?" wheel. Each candidate gets an equal slice. */
export interface CastWheelConfig {
  title: string;
  subtitle?: string;
  /** How one candidate's slice looks. Must be pure. */
  slice: (char: Character) => Pick<WheelOption, 'description' | 'color' | 'icon'>;
}

// ─── Engine outputs ─────────────────────────────────────────────────────────

/** One option evaluated against the current world and character. One per visual slice. */
export interface ResolvedSlice {
  option: WheelOption;
  /** Position on the wheel: the order of the options as dealt (a wheel's options, minus trait outcomes the character can't get). */
  index: number;
  locked: boolean;
  /** Why the slice is locked, ready to show in a tooltip. Null when unlocked. */
  lockReason: string | null;
  /** The weight the RNG actually uses. Always 0 when locked. */
  effectiveWeight: number;
  /** effectiveWeight / total of all effective weights, 0–1. */
  probability: number;
}

export interface RollResult {
  /** Every slice, locked ones included. Render all of them. */
  slices: ResolvedSlice[];
  /** The winner, decided before any animation. Spin the wheel to `winner.index`. */
  winner: ResolvedSlice;
  /** The raw RNG draw in [0, 1). Log it to replay or debug a roll. */
  draw: number;
}
