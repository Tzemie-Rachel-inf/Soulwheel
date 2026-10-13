/** Display helpers. Pure functions, so they're easy to test and reuse. */
import type { Character, CharacterRole, ExitStatus, GameConfig, StatKey, WheelOption } from '../engine/types';

export const STAT_LABELS: Record<StatKey, string> = {
  might: 'Might',
  agility: 'Agility',
  intellect: 'Intellect',
  arcana: 'Arcana',
  vitality: 'Vitality',
};

export const ROLE_LABELS: Record<CharacterRole, string> = {
  hero: 'Hero',
  demonLord: 'Demon Lord',
  outlaw: 'Outlaw',
  minion: 'Dark Champion',
  npc: 'NPC',
};

const EXIT_EFFECTS: Record<ExitStatus, string> = {
  fallen: 'Dies',
  retired: 'Retires to the Hall of Fame',
  victorious: 'Enters the Hall of Fame in victory',
  sealed: 'Sealed inside a relic, for someone to find',
};

/** Traits that say what an NPC does with their life now: a twist of fate's profession, a mentor, a general, a ruler. */
const LIFE_TRAIT = /^(npc|legacy|ruler)_/;

/** The trait naming an NPC's new life ('Blacksmith', 'Ruler of Ironhold'), if they have one. */
export function lifeOf(char: Character): Character['traits'][number] | undefined {
  return char.role === 'npc' ? char.traits.find((t) => LIFE_TRAIT.test(t.id)) : undefined;
}

/** What a character is now: 'Hero', 'Outlaw', or for an NPC their new life ('General of the Realm'). */
export function roleLabel(char: Character): string {
  return lifeOf(char)?.name ?? ROLE_LABELS[char.role];
}

/** What an option does to the quest under way, as short sentences. */
function describeStory(option: WheelOption, config: GameConfig): string[] {
  const story = option.story;
  if (!story) return [];
  const effects: string[] = [];
  if (story.begin) effects.push(`Begins a quest of ${story.begin.length[0]}–${story.begin.length[1]} encounters`);
  if (story.threat) effects.push(`Threat ${signed(story.threat)}`);
  for (const [key, n] of Object.entries(story.flags ?? {})) {
    const label = config.storyFlags?.[key];
    if (label && n) effects.push(`${label} ${signed(n)}`);
  }
  const rival = story.rival;
  if (rival?.create) effects.push(`Makes a rival: ${rival.create.title}`);
  if (rival?.escalate) effects.push('Your rival grows stronger');
  if (rival?.weaken !== undefined) effects.push(`Your rival is weakened (×${rival.weaken} power)`);
  if (rival?.resolve) effects.push('Ends the rivalry');
  if (story.remember && !rival?.create) effects.push('A rival would remember this');
  if (story.worldThreat) effects.push(`World threat ${signed(story.worldThreat)}`);
  return effects;
}

/** A character's name, or, before their last wheel names them, what they are: "An unnamed goblin". */
export function displayName(char: Character, config: GameConfig): string {
  if (char.name) return char.name;
  const race = raceName(config, char.race);
  return race ? `An unnamed ${race.toLowerCase()}` : 'An unnamed soul';
}

/** Name and title together: "Snik the Lone", "Grukk, Warboss of the Great Horde". */
export function fullName(char: Character, config: GameConfig): string {
  const name = displayName(char, config);
  if (!char.title) return name;
  return /^(the|of) /.test(char.title) ? `${name} ${char.title}` : `${name}, ${char.title}`;
}

/** A race id as a name: from config when it's registered, readable either way. */
export function raceName(config: GameConfig, raceId: string | null): string | null {
  if (raceId === null) return null;
  return config.races[raceId]?.name ?? humanizeKey(raceId);
}

/**
 * For a trait-specific outcome: the trait that unlocked it for this character ("Lockpicking"),
 * or, without a character, the first trait it needs. Null for ordinary outcomes.
 */
export function unlockedBy(option: Pick<WheelOption, 'requiresTrait'>, config: GameConfig, char?: Character): string | null {
  if (!option.requiresTrait?.length) return null;
  const id = option.requiresTrait.find((t) => char?.traits.some((own) => own.id === t)) ?? option.requiresTrait[0]!;
  return char?.traits.find((t) => t.id === id)?.name ?? config.traits[id]?.name ?? humanizeKey(id);
}

/** "Intellect and Agility": the stats that make an outcome likelier. Null when none do. */
export function favouredBy(option: Pick<WheelOption, 'statScaling'>): string | null {
  const stats = Object.entries(option.statScaling ?? {})
    .filter(([, k]) => (k ?? 0) > 0)
    .map(([key]) => STAT_LABELS[key as StatKey]);
  if (stats.length === 0) return null;
  return stats.length === 1 ? stats[0]! : `${stats.slice(0, -1).join(', ')} and ${stats.at(-1)}`;
}

/** "+3", "−2" (a real minus sign), "0". */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** 0.384 → "38%", 0.004 → "<1%". */
export function formatPercent(p: number): string {
  if (p <= 0) return '0%';
  if (p < 0.01) return '<1%';
  if (p > 0.99 && p < 1) return '>99%';
  return `${Math.round(p * 100)}%`;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** 0.071 → "1 in 14". */
export function formatOdds(p: number): string {
  if (p <= 0) return 'impossible';
  if (p >= 0.995) return 'certain';
  return `1 in ${Math.max(2, Math.round(1 / p))}`;
}

/** 'demon_lord' → 'Demon Lord'. Any singleton key reads as a title, no lookup table needed. */
export function humanizeKey(key: string): string {
  return key
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * An option's label, with the rolled number for a stat roll: "Average (13)". Pass the
 * dealt option (as the wheel shows it), so the number already includes banked bonuses.
 * (Parentheses, because the display face's space is too narrow to separate a bare number.)
 */
export function optionLabel(option: Pick<WheelOption, 'label' | 'setStats'>): string {
  const rolled = Object.values(option.setStats ?? {});
  return rolled.length === 1 ? `${option.label} (${rolled[0]})` : option.label;
}

/**
 * What an option does to a character, as short sentences. Read entirely from config data.
 *
 * @param base     The option as written in config, when `option` is the dealt copy: a stat
 *                 roll then shows how much of the number came from banked bonuses.
 * @param castName Who the wheel featured, for options that change them (`castEffect`).
 */
export function describeEffects(
  option: WheelOption,
  config: GameConfig,
  base?: WheelOption,
  castName?: string,
  /** The character after the roll: names the power a mastery roll honed. */
  char?: Character,
): string[] {
  const stat = (key: string) => STAT_LABELS[key as StatKey] ?? key;
  const effects: string[] = [];
  for (const [key, value] of Object.entries(option.setStats ?? {})) {
    const rolled = base?.setStats?.[key as StatKey];
    const bonus = rolled === undefined ? 0 : value - rolled;
    effects.push(bonus === 0 ? `${stat(key)} ${value}` : `${stat(key)} ${value} (rolled ${rolled}, ${signed(bonus)} bonus)`);
  }
  for (const [key, value] of Object.entries(option.statModifiers ?? {})) {
    const cap = option.statCap?.[key as StatKey];
    if (value) effects.push(cap === undefined ? `${signed(value)} ${stat(key)}` : `${signed(value)} ${stat(key)} (up to ${cap})`);
  }
  for (const [key, value] of Object.entries(option.statBonus ?? {})) {
    if (value) effects.push(`${stat(key)} roll ${signed(value)} ${Math.abs(value) === 1 ? 'position' : 'positions'}`);
  }
  if (option.luckDelta) effects.push(`Luck ${signed(option.luckDelta)}`);
  if (option.weaponTierDelta) effects.push(`Weapon tier ${signed(option.weaponTierDelta)}`);
  if (option.armorTierDelta) effects.push(`Armour tier ${signed(option.armorTierDelta)}`);
  if (option.gear?.weapon) effects.push(`A tier ${option.gear.weapon} weapon, kept if better`);
  if (option.gear?.armor) effects.push(`Tier ${option.gear.armor} armour, kept if better`);
  if (option.fame) effects.push(option.fame > 0 ? `${signed(option.fame)} fame` : `${signed(option.fame)} fame (disgrace)`);
  for (const traitId of option.grantTraits ?? []) {
    effects.push(`Gains ${config.traits[traitId]?.name ?? traitId}`);
  }
  if (option.honeLastTrait) {
    const { factor, rank } = option.honeLastTrait;
    const power = char?.traits.at(-1)?.name ?? 'Their newest power';
    effects.push(factor === 1 ? `${power}: ${rank}` : `${power}: ${rank}, ×${factor} power`);
  }
  if (option.honeTrait) {
    const { trait, factor, rank } = option.honeTrait;
    const power = config.traits[trait]?.name ?? humanizeKey(trait);
    effects.push(`${power}: ${rank}, ×${factor} its base power`);
  }
  if (option.setRace) effects.push(`Race: ${raceName(config, option.setRace)}`);
  if (option.setPersonality) {
    effects.push(`Personality: ${config.personalities[option.setPersonality]?.name ?? humanizeKey(option.setPersonality)}`);
  }
  if (option.setArchetype) {
    effects.push(`Archetype: ${config.archetypes[option.setArchetype]?.name ?? humanizeKey(option.setArchetype)}`);
  }
  for (const [stepId, n] of Object.entries(option.queueSpins ?? {})) {
    effects.push(`${signed(n)} ${n === 1 ? 'spin' : 'spins'} on ${config.steps[stepId]?.title ?? humanizeKey(stepId)}`);
  }
  if (option.setRole === 'npc') effects.push('Leaves adventuring for a new life in the world');
  else if (option.setRole) effects.push(`Becomes ${ROLE_LABELS[option.setRole]}`);
  if (option.claimSingleton) effects.push(`Claims the one-of-a-kind role ${humanizeKey(option.claimSingleton)}`);
  for (const tag of option.grantTags ?? []) {
    const hook = config.hooks?.[tag];
    effects.push(hook ? `Unfinished business: ${hook.label}` : `Marked ${tag}`);
  }
  for (const tag of option.removeTags ?? []) {
    const hook = config.hooks?.[tag];
    if (hook) effects.push(`Settles: ${hook.label}`);
  }
  for (const [id, n] of Object.entries(option.meters ?? {})) {
    const meter = config.meters?.find((m) => m.id === id);
    if (meter && n) effects.push(`${meter.label} ${signed(n)}`);
  }
  if (option.place?.discover) effects.push(`Puts a new ${(config.placeKinds?.[option.place.discover]?.label ?? 'place').toLowerCase()} on the map`);
  if (option.place?.deepen) effects.push(`Goes ${option.place.deepen > 1 ? `${option.place.deepen} levels` : 'a level'} deeper`);
  if (option.place?.close) effects.push('Closes the place for good');
  if (option.setStatus) effects.push(EXIT_EFFECTS[option.setStatus]);
  for (const traitId of option.removeTraits ?? []) effects.push(`Loses ${config.traits[traitId]?.name ?? traitId}`);
  effects.push(...describeStory(option, config));
  const who = castName ?? 'This character';
  if (option.spoils) effects.push(`Takes or learns something from ${castName ?? 'them'}`);
  const { castEffect } = option;
  if (castEffect) {
    if (castEffect.setStatus === 'alive') effects.push(`${who} returns to the world`);
    if (castEffect.setStatus === 'fallen') effects.push(`${who} dies`);
    if (castEffect.setRole === 'hero') effects.push(`${who} becomes a hero again`);
    else if (castEffect.setRole) effects.push(`${who} becomes ${ROLE_LABELS[castEffect.setRole]}`);
    for (const trait of castEffect.gainTraits ?? []) effects.push(`${who} gains ${trait.name}`);
    if (castEffect.fame) effects.push(`${who}: ${signed(castEffect.fame)} fame`);
  }
  return effects;
}
