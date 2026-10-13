/**
 * The world's own turn, after each of the player's adventures. While the hero rests, the
 * world moves:
 *
 *   1. omens that have run their course fade
 *   2. the world may do something (config/worldEvents.ts): a plague, a comet, the Demon Lord
 *      on the march; threat moves, an omen hangs over the next seasons, a newcomer arrives
 *   3. a rival hero may set out: at once if the player just made a jealous rival, and now
 *      and then when the world has none
 *   4. every hero of the world's own lives a season of their own: a whole adventure, rolled
 *      on the same wheels, so they win fame, take thrones, turn outlaw, and die, and the
 *      player meets them, or their graves, on the road
 *
 * The player's hero is kept out of the others' adventures (they can't be robbed or killed
 * while resting). Everything worth a line goes into the chronicle, at the season now begun.
 */
import { completeAdventure, rollFullAdventure } from '../engine/adventure';
import { fameStanding } from '../engine/fame';
import { EngineError } from '../engine/errors';
import { rollFullCharacter } from '../engine/generation';
import { defaultRng, type Rng } from '../engine/rng';
import type { Character, ChronicleEntry, GameConfig, WorldEventDef, World } from '../engine/types';
import { findCharacter, welcomeCharacter } from '../engine/world';
import { WORLD_EVENT_CHANCE } from '../config/worldEvents';
import { fullName } from '../ui/format';
import { whoTheyWere } from '../ui/legend';
import { arrivalLine, chronicleLines, seasonDeeds } from './chronicle';

/** The most heroes of its own the world keeps on the road at once. */
export const MAX_WORLD_HEROES = 3;
/** With no hero of its own on the road, the chance each season that one sets out. */
const LONELY_WORLD_CHANCE = 0.25;

type Line = Omit<ChronicleEntry, 'season'>;

/** The world's own heroes: alive, still heroes, and not the player's. */
export function worldHeroes(world: World): Character[] {
  return world.roster.filter((c) => c.role === 'hero' && c.status === 'alive' && c.id !== world.heroId);
}

const clampThreat = (t: number) => Math.min(10, Math.max(0, Math.round(t * 10) / 10));

function pickEvent(world: World, events: readonly WorldEventDef[], rng: Rng): WorldEventDef | null {
  const hanging = new Set(world.omens.filter((o) => o.until > world.season).map((o) => o.id));
  const weighted = events
    // A plague still raging doesn't break out again.
    .filter((e) => (!e.condition || e.condition(world)) && !(e.omen && hanging.has(e.omen.id)))
    .map((e) => ({ e, w: Math.max(0, e.baseWeight * (1 + (e.threatScaling ?? 0) * world.threatLevel)) }))
    .filter(({ w }) => w > 0);
  const total = weighted.reduce((sum, { w }) => sum + w, 0);
  if (total <= 0) return null;
  let draw = rng() * total;
  for (const { e, w } of weighted) {
    draw -= w;
    if (draw < 0) return e;
  }
  return weighted.at(-1)!.e;
}

/**
 * A newcomer of the world's own, rolled on the creation wheels like anyone: usually a hero,
 * sometimes a Demon Lord or one of their champions. Null if the wheels never gave one that fits.
 */
function spawn(world: World, config: GameConfig, rng: Rng, why?: string): { world: World; line: Line } | null {
  for (let tries = 0; tries < 8; tries++) {
    const { character } = rollFullCharacter(config, world, rng);
    // Two souls of one name would muddle the chronicle.
    if ([...world.roster, ...world.graveyard, ...world.hallOfFame].some((c) => c.name === character.name)) continue;
    try {
      const next = welcomeCharacter(world, { ...character, worldBorn: true });
      const placed = findCharacter(next, character.id)!;
      if (placed.role !== 'hero') return { world: next, line: { ...arrivalLine(placed, config), kind: 'world' } };
      const who = whoTheyWere(placed, config).toLowerCase();
      const text = `${fullName(placed, config)}, ${who}, set out to make a name for themselves${why ? `, ${why}` : ''}.`;
      return { world: next, line: { kind: 'rival', who: placed.id, text } };
    } catch (err) {
      if (err instanceof EngineError && err.code === 'SINGLETON_CONFLICT') continue;
      throw err;
    }
  }
  return null;
}

/** One world hero's season: a whole adventure, with the player's hero out of reach. */
function liveASeason(world: World, rival: Character, config: GameConfig, rng: Rng): { world: World; lines: Line[] } {
  const player = world.heroId ? world.roster.find((c) => c.id === world.heroId) : undefined;
  const without = player ? { ...world, roster: world.roster.filter((c) => c.id !== player.id) } : world;
  const { state } = rollFullAdventure(config, without, rival, rng);
  let after = completeAdventure(without, state);
  if (player) after = { ...after, roster: [player, ...after.roster] };
  // Their quests and the things they picked up are their own business; the world hears of the
  // big moments: a title, a crown, an ending, and their name once it is Famous.
  const famous = config.fame.tiers.findIndex((t) => t.name === 'Famous');
  const tierNow = fameStanding(config.fame.tiers, findCharacter(after, rival.id)?.fame ?? 0).index;
  const lines = seasonDeeds(world, after, rival.id, config)
    .filter((l) => !(l.who === rival.id && / is \S+ now\./.test(l.text) && tierNow < famous))
    .filter((l) => l.kind === 'ending' || l.kind === 'world' || l.tone === 'gold' || (l.kind === 'deed' && l.who !== rival.id))
    .map((l) => (l.kind === 'world' || l.who !== rival.id ? l : { ...l, kind: 'rival' as const }));
  return { world: after, lines };
}

/**
 * The world's turn after an adventure. `heroBefore` is the player's hero as they set out, to
 * notice a jealous rival made on the road.
 */
export function worldTurn(world: World, config: GameConfig, heroBefore: Character | undefined, rng: Rng = defaultRng): World {
  const lines: Line[] = [];
  let w: World = { ...world, omens: world.omens.filter((o) => o.until > world.season) };

  // 2. The world does something.
  if (config.worldEvents?.length && rng() < WORLD_EVENT_CHANCE) {
    const event = pickEvent(w, config.worldEvents, rng);
    if (event) {
      if (event.threat) w = { ...w, threatLevel: clampThreat(w.threatLevel + event.threat) };
      if (event.omen) {
        const omen = { id: event.omen.id, label: event.omen.label, description: event.omen.description, until: w.season + event.omen.seasons };
        w = { ...w, omens: [...w.omens.filter((o) => o.id !== omen.id), omen] };
      }
      if (event.newHero) {
        if (worldHeroes(w).length < MAX_WORLD_HEROES) {
          const arrived = spawn(w, config, rng);
          if (arrived) {
            w = arrived.world;
            lines.push(arrived.line);
          }
        }
      } else {
        lines.push({ kind: 'world', text: typeof event.text === 'function' ? event.text(w) : event.text, ...(event.tone && { tone: event.tone }) });
      }
    }
  }

  // 3. A rival sets out.
  const hero = heroBefore ? findCharacter(w, heroBefore.id) : undefined;
  const madeARival = hero && !heroBefore!.tags.includes('rival') && hero.tags.includes('rival');
  const lonely = worldHeroes(w).length === 0 && w.season >= 2 && rng() < LONELY_WORLD_CHANCE;
  if ((madeARival || lonely) && worldHeroes(w).length < MAX_WORLD_HEROES) {
    const arrived = spawn(w, config, rng, madeARival ? `sworn to outdo ${hero!.name}` : undefined);
    if (arrived) {
      w = arrived.world;
      lines.push(arrived.line);
    }
  }

  // 4. The world's heroes live their season. Newcomers set out next season.
  const newcomers = new Set(lines.flatMap((l) => (l.who ? [l.who] : [])));
  for (const id of worldHeroes(w).filter((c) => !newcomers.has(c.id)).map((c) => c.id)) {
    // An earlier hero's season may have killed, turned or crowned this one: take them as they are now.
    const rival = worldHeroes(w).find((c) => c.id === id);
    if (!rival) continue;
    const lived = liveASeason(w, rival, config, rng);
    w = lived.world;
    lines.push(...lived.lines);
  }

  return chronicleLines(w, lines);
}
