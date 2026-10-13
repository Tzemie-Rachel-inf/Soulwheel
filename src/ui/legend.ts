/**
 * A life, told short: the epitaph on a grave, the line on a share card, the entry in the
 * chronicle. Everything is read from what the character already carries (their adventures,
 * their fate, their fame) and from config, so nothing new is stored.
 *
 * Closing lines are picked from small pools by a hash of the character's id: the same soul
 * always gets the same words.
 */
import { fameStanding } from '../engine/fame';
import { calculatePowerRating, traitPower } from '../engine/power';
import type { Character, GameConfig, Trait } from '../engine/types';
import { fullName, ordinal, raceName, roleLabel } from './format';

/** A stable pick from a list, by the character's id. */
function pick<T>(items: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return items[(h >>> 0) % items.length]!;
}

/** The foe the last wheel of their story set against them, if it was a fight. */
function lastFoe(char: Character, config: GameConfig): string | null {
  const last = char.adventures.at(-1)?.rolls.at(-1);
  if (!last) return null;
  if (last.cast) return last.cast;
  const name = config.steps[last.stepId]?.foe?.name;
  if (!name) return null;
  // Mid-sentence: "The Enemy Host" reads as "the Enemy Host", and "Bridge Troll" as "the Bridge Troll".
  if (/^The /.test(name)) return name.replace(/^The /, 'the ');
  return /^(A|An|What|Who|Their|Your) /.test(name) ? name : `the ${name}`;
}

/** The trait they will be remembered for: the one worth the most to them. */
export function signatureTrait(char: Character): Trait | null {
  return char.traits.reduce<Trait | null>((best, t) => (!best || traitPower(t, char) > traitPower(best, char) ? t : best), null);
}

/** 'Dwarf Cleric', 'Hero', 'Orc Warlord': who they were, in two words. */
export function whoTheyWere(char: Character, config: GameConfig): string {
  const race = raceName(config, char.race);
  const calling = char.archetype ? (config.archetypes[char.archetype]?.name ?? null) : null;
  return [race, calling ?? roleLabel(char)].filter(Boolean).join(' ');
}

/**
 * How their story ended, in a sentence fragment: 'Fell to the Bandit Gang on their 3rd
 * adventure', 'Crowned ruler of Ironhold'. An ending an option wrote down wins; otherwise it
 * is worked out from the last wheel.
 */
export function howItEnded(char: Character, config: GameConfig): string | null {
  const n = char.adventures.length;
  const last = char.adventures.at(-1);
  const written = last?.note ?? char.fate?.summary;
  const generic = /^(Fell on adventure|Retired after|Victorious after|Sealed away after)/;
  if (written && !generic.test(written)) return written;
  if (char.status === 'fallen') {
    const foe = lastFoe(char, config);
    const quest = last?.quest?.title;
    if (foe) return `Fell to ${foe} on their ${ordinal(n)} adventure`;
    if (quest) return `Fell on the road of ${quest}`;
    return n > 0 ? `Fell on their ${ordinal(n)} adventure` : 'Fell before they ever set out';
  }
  return written ?? null;
}

const CLOSING: Record<string, readonly string[]> = {
  Unknown: ['Nobody sang. The grass did not mind.', 'A small stone, for a short road.', 'They meant to be someone. They were, briefly.'],
  Known: ['A few taverns still raise a cup.', 'Their name is carved here, and in one or two hearts.', 'Remembered in the villages they passed through.'],
  Renowned: ['The bards argue over the details.', 'Pilgrims leave flowers, and sometimes swords.', 'A song with too many verses, all of them true.'],
  Famous: ['Kingdoms lowered their banners.', 'Children play at being them.', 'The roads are quieter, and lesser, without them.'],
  Legendary: ['Every tongue has a song for them.', 'Even their enemies stood bareheaded at the grave.', 'The world is the shape it is because of them.'],
  Mythic: ['More story than person, and now only story.', 'Some say this grave is empty. Some say it is a door.', 'The gods themselves came to watch them go.'],
};

const MARTYR_CLOSING = ['They gave everything, and the world kept it.', 'Their sacrifice is the floor the rest of us stand on.'];

/** The lines on a headstone, top to bottom. */
export interface Epitaph {
  name: string;
  title: string | null;
  /** 'Dwarf Cleric · Renowned' */
  who: string;
  /** How it ended, or null for a life still going. */
  end: string | null;
  /** What they are remembered for: their signature trait, or their strength. */
  remembered: string;
  /** A last line, in the voice of whoever carved it. */
  closing: string;
}

export function epitaph(char: Character, config: GameConfig): Epitaph {
  const tier = fameStanding(config.fame.tiers, char.fame).tier.name;
  const signature = signatureTrait(char);
  const closingPool = char.tags.includes('martyr') ? MARTYR_CLOSING : (CLOSING[tier] ?? CLOSING.Unknown!);
  return {
    name: char.name,
    title: char.title,
    who: `${whoTheyWere(char, config)} · ${tier}`,
    end: howItEnded(char, config),
    remembered: signature ? `Remembered for ${signature.name}` : `Remembered for ${calculatePowerRating(char)} Combat Power and a stubborn heart`,
    closing: pick(closingPool, char.id),
  };
}

/** One line for lists and the chronicle: 'Brann the Bold, Dwarf Cleric. Fell to the Bandit Gang on their 3rd adventure.' */
export function lifeInOneLine(char: Character, config: GameConfig): string {
  const end = howItEnded(char, config);
  return `${fullName(char, config)}, ${whoTheyWere(char, config)}.${end ? ` ${end}.` : ''}`;
}
