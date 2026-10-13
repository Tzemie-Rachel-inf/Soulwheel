/**
 * The chronicle's scribe: what the world writes down when a soul arrives, when a hero comes
 * home from a season on the road, and when a story ends. It compares the world before and
 * after, so whatever changed is noticed without each wheel having to announce itself.
 *
 *   commit ──▶ an arrival            (a hero sets out, a Demon Lord rises)
 *   an adventure ──▶ one season passes, and its deeds: a quest, a new title, a new fame tier,
 *                    a crown, things that changed hands, the people it changed, the world's
 *                    threat, and the ending, if it was one
 *
 * Only what is worth a line is written: a quiet season leaves no trace but the date.
 * A world from before the chronicle has its history written once from what it remembers
 * (`backfillChronicle`).
 */
import { fameStanding } from '../engine/fame';
import type { Character, ChronicleEntry, GameConfig, World } from '../engine/types';
import { findCharacter } from '../engine/world';
import { fullName, humanizeKey, lifeOf } from '../ui/format';
import { howItEnded, whoTheyWere } from '../ui/legend';

/** The most entries a world keeps; the oldest are let go first. */
export const CHRONICLE_LIMIT = 2000;

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

/** 'Year 3, Autumn' for a season count. */
export function seasonLabel(season: number): { year: number; season: (typeof SEASONS)[number]; label: string } {
  const year = Math.floor(season / 4) + 1;
  const name = SEASONS[((season % 4) + 4) % 4]!;
  return { year, season: name, label: `Year ${year}, ${name}` };
}

/** Lower-cases a sentence's first letter, to follow a name: 'Fell to…' → 'fell to…'. */
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

function write(world: World, entries: readonly Omit<ChronicleEntry, 'season'>[], season = world.season): World {
  if (entries.length === 0) return world;
  const chronicle = [...world.chronicle, ...entries.map((e) => ({ ...e, season }))];
  return { ...world, chronicle: chronicle.length > CHRONICLE_LIMIT ? chronicle.slice(-CHRONICLE_LIMIT) : chronicle };
}

// ─── Arrivals ───────────────────────────────────────────────────────────────

/** `titled` false for a life written after the fact: the title they have now came later. */
function arrival(char: Character, config: GameConfig, titled = true): Omit<ChronicleEntry, 'season'> {
  const name = titled ? fullName(char, config) : char.name;
  if (char.role === 'demonLord') return { kind: 'arrival', who: char.id, tone: 'ember', text: `${name} rose as the Demon Lord.` };
  if (char.role === 'minion') return { kind: 'arrival', who: char.id, tone: 'ember', text: `${name} was born to serve the Abyss.` };
  const house = char.lineage ? ` of House ${char.lineage.house}, generation ${char.lineage.generation},` : '';
  return { kind: 'arrival', who: char.id, text: `${name},${house} ${whoTheyWere(char, config).toLowerCase()}, set out into the world.` };
}

/** A soul has been committed: write their arrival. */
export function chronicleArrival(world: World, char: Character, config: GameConfig): World {
  const placed = findCharacter(world, char.id) ?? char;
  return write(world, [arrival(placed, config)]);
}

// ─── A season on the road ───────────────────────────────────────────────────

/** How a story ended, as a line after the name. */
function ending(after: Character, config: GameConfig): Omit<ChronicleEntry, 'season'> | null {
  const name = after.name;
  if (after.role === 'outlaw') return { kind: 'ending', who: after.id, tone: 'ember', text: `${name} turned outlaw, and rides with the bandits now.` };
  if (after.role === 'minion') return { kind: 'ending', who: after.id, tone: 'ember', text: `${name} knelt to the Demon Lord.` };
  if (after.role === 'npc' && after.status === 'alive') {
    const life = lifeOf(after);
    const note = after.adventures.at(-1)?.note;
    return { kind: 'ending', who: after.id, tone: 'moss', text: note ? `${name}: ${sentence(lower(note))}` : `${name} began a new life${life ? ` as ${life.name}` : ''}.` };
  }
  if (after.status === 'alive') return null;
  const end = howItEnded(after, config);
  const tone = after.status === 'fallen' && !after.tags.includes('martyr') ? 'ember' : 'gold';
  return { kind: 'ending', who: after.id, tone, text: end ? `${name} ${sentence(lower(end))}` : `${name}’s story ended.` };
}

/** What changed for someone else on the hero's road: a legend killed, a sealed soul set free. */
function othersChanged(before: World, after: World, heroId: string, config: GameConfig): Omit<ChronicleEntry, 'season'>[] {
  const lines: Omit<ChronicleEntry, 'season'>[] = [];
  for (const now of [...after.roster, ...after.graveyard, ...after.hallOfFame]) {
    if (now.id === heroId) continue;
    const was = findCharacter(before, now.id);
    if (!was) continue;
    if (was.status !== 'fallen' && now.status === 'fallen') {
      lines.push({ kind: 'deed', who: now.id, tone: 'ember', text: `${fullName(now, config)} ${sentence(lower(now.fate?.summary ?? 'fell'))}` });
    } else if (was.status === 'sealed' && now.status === 'alive') {
      lines.push({ kind: 'deed', who: now.id, tone: 'gold', text: `${now.name} walked free of the relic that held them.` });
    } else if (was.status !== 'alive' && now.status === 'alive' && was.status !== 'sealed') {
      lines.push({ kind: 'deed', who: now.id, tone: 'gold', text: `${now.name} came back into the world.` });
    } else if (was.role !== now.role && now.role === 'outlaw') {
      lines.push({ kind: 'deed', who: now.id, tone: 'ember', text: `${now.name} turned outlaw.` });
    }
  }
  return lines;
}

/** The world's threat moved: a line when it crossed into a new mood. */
export function threatLine(before: number, after: number): Omit<ChronicleEntry, 'season'> | null {
  const mood = (t: number) => (t < 1 ? 0 : t < 3 ? 1 : t < 5 ? 2 : t < 7.5 ? 3 : 4);
  if (mood(after) === mood(before)) return null;
  const words = ['peaceful again', 'uneasy', 'dangerous', 'dire', 'apocalyptic'];
  const rising = after > before;
  return { kind: 'world', tone: rising ? 'ember' : 'moss', text: `The world grew ${rising ? 'darker' : 'calmer'}: ${words[mood(after)]} now (threat ${after.toFixed(1)}).` };
}

/**
 * A hero's adventure has been written into the world: a season passes, and its deeds go in
 * the chronicle under it.
 */
export function chronicleAdventure(before: World, after: World, heroId: string, config: GameConfig): World {
  return write({ ...after, season: before.season + 1 }, seasonDeeds(before, after, heroId, config), before.season);
}

/** What one character's adventure changed, worth a line each: the world before it and after. */
export function seasonDeeds(before: World, after: World, heroId: string, config: GameConfig): Omit<ChronicleEntry, 'season'>[] {
  const was = findCharacter(before, heroId);
  const now = findCharacter(after, heroId);
  if (!was || !now) return [];

  const lines: Omit<ChronicleEntry, 'season'>[] = [];
  const adventure = now.adventures.at(-1);
  const quest = adventure?.quest;
  if (quest) {
    const outcome = quest.log.at(-1);
    lines.push({ kind: 'deed', who: heroId, text: `${now.name} took up ${quest.title}${outcome && quest.log.length > 1 ? `. ${sentence(outcome)}` : '.'}` });
    if (quest.rival) lines.push({ kind: 'rival', who: heroId, tone: 'ember', text: `Their rival ${quest.rival.name}, ${quest.rival.title}: ${sentence(lower(quest.rival.fate))}` });
  }
  for (const note of adventure?.rolls.flatMap((r) => (r.note ? [r.note] : [])).slice(0, 2) ?? []) {
    lines.push({ kind: 'deed', who: heroId, text: `${now.name}: ${sentence(lower(note))}` });
  }
  if (now.title && now.title !== was.title) {
    lines.push({ kind: 'deed', who: heroId, tone: 'gold', text: `${was.name} became known as ${fullName(now, config)}.` });
  }
  for (const key of now.singletonClaims.filter((k) => !was.singletonClaims.includes(k))) {
    lines.push({ kind: 'deed', who: heroId, tone: 'gold', text: `${now.name} claimed a one-of-a-kind role: ${humanizeKey(key)}.` });
  }
  const tierBefore = fameStanding(config.fame.tiers, was.fame);
  const tierAfter = fameStanding(config.fame.tiers, now.fame);
  if (tierAfter.index > tierBefore.index) {
    lines.push({ kind: 'deed', who: heroId, tone: 'gold', text: `${now.name} is ${tierAfter.tier.name} now. ${tierAfter.tier.description ?? ''}`.trim() });
  }
  lines.push(...othersChanged(before, after, heroId, config));
  const threat = threatLine(before.threatLevel, after.threatLevel);
  if (threat) lines.push(threat);
  const end = ending(now, config);
  if (end) lines.push(end);
  return lines;
}

/** Entries for the chronicle, written at a season (the world's own turn writes through this). */
export function chronicleLines(world: World, entries: readonly Omit<ChronicleEntry, 'season'>[], season = world.season): World {
  return write(world, entries, season);
}

/** A soul's arrival line, for the world's own newcomers. */
export function arrivalLine(char: Character, config: GameConfig): Omit<ChronicleEntry, 'season'> {
  return arrival(char, config);
}

// ─── Old worlds ─────────────────────────────────────────────────────────────

/**
 * A world from before the chronicle: its history, written once from what its characters
 * remember. Lives are told one after another, oldest soul first, a season per adventure.
 * Only arrivals, endings and quests can be recovered; titles and tiers along the way cannot.
 */
export function backfillChronicle(world: World, config: GameConfig): World {
  const everyone = [...world.roster, ...world.graveyard, ...world.hallOfFame].sort((a, b) => a.createdAt - b.createdAt);
  if (world.chronicle.length > 0 || everyone.length === 0) return world;
  const chronicle: ChronicleEntry[] = [];
  let season = 0;
  for (const char of everyone) {
    chronicle.push({ ...arrival(char, config, false), season });
    for (const adventure of char.adventures) {
      if (adventure.quest) chronicle.push({ kind: 'deed', who: char.id, season, text: `${char.name} took up ${adventure.quest.title}.` });
      season++;
    }
    const end = ending(char, config);
    if (end) chronicle.push({ ...end, season: Math.max(0, season - 1) });
  }
  return { ...world, season: Math.max(world.season, season), chronicle: chronicle.slice(-CHRONICLE_LIMIT) };
}
