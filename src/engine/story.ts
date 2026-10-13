/**
 * Stories: the memory of a quest, carried on the hero while it runs (`Character.story`).
 *
 *   an option's `story` effect ──▶ begin a quest │ count an encounter │ threat │ flags │ a log line
 *                                  └─ the rival: create (one per quest) ─▶ escalate (capped) / weaken ─▶ resolve
 *
 * Conditions, weights (`vary`), routes and foes (`foeOf`) all read `char.story`, so what the
 * hero did earlier shapes what can happen next. The engine knows the shape of a story, never
 * its content: which flags exist, which rivals, which encounters is all config.
 */
import { calculatePowerRating } from './power';
import type { Character, GameConfig, Rival, StoryEffect, StoryState, World } from './types';

/** The most a quest's threat can reach. */
export const STORY_THREAT_MAX = 10;
/** How many times a rival can escalate: a rivalry builds to a head, it doesn't grow forever. */
export const RIVAL_MAX_ESCALATIONS = 2;
/** How much each escalation adds to a rival's power, unless the option says otherwise. */
const ESCALATION_POWER = 0.15;

/** The rival still in play: made, and not yet concluded. */
export function activeRival(char: Character): Rival | null {
  const rival = char.story?.rival ?? null;
  return rival && rival.fate === undefined ? rival : null;
}

/**
 * Text with `{rival}`, `{hero}`, `{quest}` and `{cast}` filled in from the hero's story, and
 * `{place}`, `{depth}` and `{founder}` from the place they are exploring.
 */
export function storyText(text: string, char: Character, cast?: string): string {
  return text
    .replace(/\{rival\}/g, char.story?.rival?.name ?? 'their rival')
    .replace(/\{hero\}/g, char.name || 'the hero')
    .replace(/\{quest\}/g, char.story?.title ?? 'the quest')
    .replace(/\{cast\}/g, cast ?? 'someone')
    .replace(/\{place\}/g, char.expedition?.name ?? 'the place')
    .replace(/\{depth\}/g, String(char.expedition?.depth ?? 1))
    .replace(/\{founder\}/g, char.expedition?.foundBy ?? 'someone');
}

/** A stable number from a string, for choices that must not depend on the RNG (a rival's name). */
function hash(text: string): number {
  return Math.abs([...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7));
}

const clampThreat = (n: number) => Math.min(STORY_THREAT_MAX, Math.max(0, n));

/**
 * One option's effect on the quest. Pure: returns a new Character. Without a quest under way
 * (and no `begin`), nothing happens. A new quest's threat starts at half the world's.
 */
export function applyStory(char: Character, effect: StoryEffect, config: GameConfig, world: World, cast?: string): Character {
  let story: StoryState | undefined = char.story;
  if (effect.begin && !story) {
    const [lo, hi] = effect.begin.length;
    story = {
      title: effect.begin.title,
      objective: effect.begin.objective,
      length: lo + (hash(`${char.id}:${char.adventures.length}`) % (Math.max(lo, hi) - lo + 1)),
      beats: 0,
      threat: clampThreat(Math.round(world.threatLevel / 2)),
      flags: {},
      log: [`Took up the quest: ${effect.begin.objective}`],
      seen: [],
      rival: null,
    };
  }
  if (!story) return char;

  const flags = { ...story.flags };
  for (const [key, n] of Object.entries(effect.flags ?? {})) flags[key] = Math.max(0, (flags[key] ?? 0) + n);
  let rival: Rival | null = story.rival && { ...story.rival, memory: [...story.rival.memory] };
  const live = rival !== null && rival.fate === undefined;
  const r = effect.rival;

  if (r?.create && rival === null) {
    const pool = config.fallbackNames;
    const name = pool[hash(`${char.id}:${story.beats}:${r.create.title}`) % pool.length] ?? 'Someone';
    rival = {
      name,
      title: r.create.title,
      motivation: r.create.motivation,
      goal: r.create.goal,
      power: Math.max(1, Math.round(calculatePowerRating(char) * r.create.power)),
      stage: 1,
      escalations: 0,
      allies: 0,
      memory: [r.create.grudge],
    };
  } else if (rival && live) {
    if (r?.escalate && rival.escalations < RIVAL_MAX_ESCALATIONS) {
      rival.power = Math.round(rival.power * (1 + (r.escalate.power ?? ESCALATION_POWER)));
      rival.allies += r.escalate.allies ?? 0;
      rival.escalations += 1;
      rival.stage = 2;
    }
    if (r?.weaken !== undefined) rival.power = Math.max(1, Math.round(rival.power * r.weaken));
  }

  const next: StoryState = {
    ...story,
    beats: story.beats + (effect.beat ? 1 : 0),
    threat: clampThreat(story.threat + (effect.threat ?? 0)),
    flags,
    rival,
  };
  const withStory: Character = { ...char, story: next };
  const say = (text: string) => storyText(text, withStory, cast);
  if (rival && rival.fate === undefined) {
    // A rival made by this very option already remembers why (their grudge).
    if (effect.remember && !(r?.create && story.rival === null)) rival.memory.push(say(effect.remember));
    if (r?.resolve) {
      rival.fate = say(r.resolve);
      rival.stage = 3;
    }
  }
  if (effect.log) next.log = [...next.log, say(effect.log)];
  return withStory;
}

/** Notes a wheel as met on this quest, so it won't come up again. */
export function markSeen(char: Character, stepId: string): Character {
  const story = char.story;
  if (!story || story.seen.includes(stepId)) return char;
  return { ...char, story: { ...story, seen: [...story.seen, stepId] } };
}
