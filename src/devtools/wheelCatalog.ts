/**
 * Every wheel in a config, sorted the way the game reaches them, for the dev tools' list.
 *
 *   creation    walked breadth-first from `entryStepId`
 *   stats       ladder wheels (one per race and stat), race by race
 *   adventure   walked breadth-first from `adventure.entryStepId`
 *   training    the training ladders (one per race and stat), race by race
 *   unreachable anything neither walk finds
 */
import { archetypeWheels } from '../engine/archetypes';
import { STAT_KEYS, type GameConfig, type StatKey, type WheelOption, type WheelStep } from '../engine/types';
import { statStepId, trainStepId } from '../config/stats';
import { STAT_LABELS } from '../ui/format';

export type WheelGroup = 'creation' | 'stats' | 'adventure' | 'training' | 'unreachable';

export const GROUP_LABELS: Record<WheelGroup, string> = {
  creation: 'Creation',
  stats: 'Stat wheels',
  adventure: 'Adventures',
  training: 'Training wheels',
  unreachable: 'Unreachable',
};

export interface CatalogEntry {
  id: string;
  group: WheelGroup;
  /** As listed. Stat wheels carry their race: "Goblin Might". */
  name: string;
  /** The wheel as written in config. */
  step: WheelStep;
  /** Set on stat and training wheels. */
  race?: string;
  stat?: StatKey;
}

export interface WheelCatalog {
  /** Flow order: creation, stats, adventures, unreachable. Prev/next walk this. */
  entries: CatalogEntry[];
  byId: Record<string, CatalogEntry>;
}

/** The wheels an option can lead to: its id, or every wheel a route may pick. */
export function targetsOf(next: WheelOption['nextStepId']): string[] {
  if (next === null) return [];
  return typeof next === 'string' ? [next] : next.among;
}

export function buildCatalog(config: GameConfig): WheelCatalog {
  const statOf = new Map<string, { race: string; stat: StatKey }>();
  const trainOf = new Map<string, { race: string; stat: StatKey }>();
  for (const race of Object.keys(config.races)) {
    for (const stat of STAT_KEYS) {
      if (config.steps[statStepId(stat, race)]) statOf.set(statStepId(stat, race), { race, stat });
      if (config.steps[trainStepId(stat, race)]) trainOf.set(trainStepId(stat, race), { race, stat });
    }
  }

  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();
  const add = (id: string, group: WheelGroup, step: WheelStep) => {
    seen.add(id);
    const stat = statOf.get(id) ?? trainOf.get(id);
    const race = stat && config.races[stat.race];
    const name = race && stat ? `${race.name} ${STAT_LABELS[stat.stat]}${trainOf.has(id) ? ' Training' : ''}` : step.title;
    entries.push({ id, group, step, name, ...stat });
  };

  const creation = walk(config, config.entryStepId);
  for (const id of creation) if (!config.steps[id]!.ladder) add(id, 'creation', config.steps[id]!);
  // Ladders race by race, in the order the races are registered, each stat in turn.
  const ladders = [...statOf.keys(), ...creation.filter((id) => config.steps[id]!.ladder && !statOf.has(id))];
  for (const id of ladders) if (!seen.has(id)) add(id, 'stats', config.steps[id]!);
  for (const id of walk(config, config.adventure.entryStepId)) {
    if (!seen.has(id) && !trainOf.has(id)) add(id, 'adventure', config.steps[id]!);
  }
  // A meter's trigger wheel is reached by the meter filling, not by an option: adventures too.
  // So is the road home, by a short adventure.
  // And the evade wheel, by a fight.
  const roots = [
    ...(config.meters ?? []).map((m) => m.trigger),
    ...(config.adventure.roadHome ? [config.adventure.roadHome.stepId] : []),
    ...(config.adventure.evade ? [config.adventure.evade.stepId] : []),
    // And an archetype's own wheels, by its rules.
    ...archetypeWheels(config),
  ];
  for (const root of roots) {
    for (const id of walk(config, root)) if (!seen.has(id) && !trainOf.has(id)) add(id, 'adventure', config.steps[id]!);
  }
  for (const id of trainOf.keys()) if (!seen.has(id)) add(id, 'training', config.steps[id]!);
  for (const [id, step] of Object.entries(config.steps)) if (!seen.has(id)) add(id, 'unreachable', step);

  // Wheels that share a title (the three goblin "Your Place in the Band" wheels) get their id too.
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  for (const e of entries) if (counts.get(e.name)! > 1) e.name = `${e.name} (${e.id})`;

  return { entries, byId: Object.fromEntries(entries.map((e) => [e.id, e])) };
}

/** Breadth-first from one wheel: the order a player meets them. */
function walk(config: GameConfig, from: string): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const step = config.steps[id];
    if (!step || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const option of step.options) queue.push(...targetsOf(option.nextStepId));
  }
  return order;
}

/** Every option, on any wheel, that can lead to `stepId`. */
export function incomingLinks(config: GameConfig, stepId: string): { from: string; option: WheelOption }[] {
  return Object.values(config.steps).flatMap((step) =>
    step.options.filter((o) => targetsOf(o.nextStepId).includes(stepId)).map((option) => ({ from: step.id, option })),
  );
}

/** Search by wheel name, id, or any option's label or id. */
export function matchesSearch(entry: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    entry.name.toLowerCase().includes(q) ||
    entry.id.toLowerCase().includes(q) ||
    entry.step.options.some((o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
  );
}
