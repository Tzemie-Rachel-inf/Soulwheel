import { archetypeWheels } from './archetypes';
import { STAT_BASELINE } from './power';
import { DAMAGE_TYPES, RARITIES, STAT_KEYS, type GameConfig, type GearGrant, type LootTable, type Rarity, type WheelOption, type WheelStep } from './types';

export interface ValidationReport {
  /** The config is broken: a spin will throw. */
  errors: string[];
  /** Legal but suspicious: worth a look. */
  warnings: string[];
}

/**
 * Static checks on the wheel graph. Run it once at startup (and in tests) so a typo
 * in a `nextStepId` fails loudly on load instead of halfway through a spin.
 *
 * Errors:   missing entry step (creation or adventure), broken nextStepId or route target,
 *           unknown trait, race or personality, bad weight, unknown rarity, duplicate option
 *           id, a fight option on a wheel with no foe (or cast foe), a cast effect on a wheel
 *           that casts no one, a cast on an entry wheel, race or archetype odds or a family naming
 *           something that doesn't exist, a queued spin on a wheel that doesn't exist, no fallback
 *           names, a registry key that doesn't match its id, fame tiers out of order, spoils or a
 *           cast condition on a wheel that casts no one, a gear grant or loot table naming an unknown
 *           unique, base or ability or a power outside 1–10, a gear ability granted as a bare trait.
 * Warnings: a wheel that some character or world could make unspinnable (NO_ELIGIBLE_OPTIONS),
 *           a rarer option that outweighs a more common one, a life-ending option whose
 *           nextStepId would be ignored, unreachable wheels, and cycles (allowed, but
 *           capped by MAX_GENERATION_STEPS) unless they pass through a wheel marked `repeats`.
 */
export function validateGameConfig(config: GameConfig): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries = [config.entryStepId, config.adventure.entryStepId];

  if (!config.steps[config.entryStepId]) {
    errors.push(`entryStepId "${config.entryStepId}" does not match any wheel.`);
  }
  if (config.adventure.roadHome && !config.steps[config.adventure.roadHome.stepId]) {
    errors.push(`adventure.roadHome "${config.adventure.roadHome.stepId}" does not match any wheel.`);
  }
  if (!config.steps[config.adventure.entryStepId]) {
    errors.push(`adventure.entryStepId "${config.adventure.entryStepId}" does not match any wheel.`);
  }

  for (const [key, trait] of Object.entries(config.traits)) {
    if (trait.id !== key) errors.push(`Trait registered as "${key}" has id "${trait.id}".`);
  }
  const checkOdds = (who: string, table: Record<string, Record<string, number>> | undefined) => {
    for (const [stepId, odds] of Object.entries(table ?? {})) {
      const step = config.steps[stepId];
      if (!step) {
        errors.push(`${who}: odds for unknown wheel "${stepId}".`);
        continue;
      }
      for (const [optionId, factor] of Object.entries(odds)) {
        if (!step.options.some((o) => o.id === optionId)) errors.push(`${who}: odds for unknown option "${stepId} › ${optionId}".`);
        if (!Number.isFinite(factor) || factor < 0) errors.push(`${who}: odds for "${stepId} › ${optionId}" must be ≥ 0.`);
      }
    }
  };
  for (const [key, race] of Object.entries(config.races)) {
    if (race.id !== key) errors.push(`Race registered as "${key}" has id "${race.id}".`);
    if (race.family !== undefined && !config.races[race.family]) {
      errors.push(`Race "${key}": family "${race.family}" is not a race.`);
    }
    checkOdds(`Race "${key}"`, race.odds);
  }
  for (const [key, archetype] of Object.entries(config.archetypes)) {
    if (archetype.id !== key) errors.push(`Archetype registered as "${key}" has id "${archetype.id}".`);
    checkOdds(`Archetype "${key}"`, archetype.odds);
  }
  for (const [key, personality] of Object.entries(config.personalities)) {
    checkOdds(`Personality "${key}"`, personality.odds);
  }
  if (config.fallbackNames.length === 0) errors.push('fallbackNames must have at least one name.');
  const tiers = config.fame.tiers;
  if (tiers.length === 0) errors.push('fame.tiers must list at least one tier.');
  else if (tiers[0]!.min !== 0) errors.push('fame.tiers: the first tier must start at 0.');
  tiers.forEach((tier, i) => {
    if (!tier.name.trim()) errors.push(`fame.tiers[${i}] needs a name.`);
    if (!Number.isFinite(tier.min) || (i > 0 && tier.min <= tiers[i - 1]!.min)) {
      errors.push(`fame.tiers[${i}] ("${tier.name}"): each tier must start higher than the one before.`);
    }
  });
  const topTier = Math.max(0, tiers.length - 1);
  for (const [key, personality] of Object.entries(config.personalities)) {
    if (personality.id !== key) errors.push(`Personality registered as "${key}" has id "${personality.id}".`);
  }
  for (const entry of entries) {
    // Nothing has picked who appears before the first spin.
    if (config.steps[entry]?.cast) errors.push(`Entry wheel "${entry}" cannot cast a character.`);
  }

  for (const [key, step] of Object.entries(config.steps)) {
    if (step.id !== key) errors.push(`Wheel registered as "${key}" has id "${step.id}".`);
    if (step.options.length === 0) errors.push(`Wheel "${key}" has no options.`);
    if (step.foe && (!Number.isFinite(step.foe.power) || step.foe.power < 0)) {
      errors.push(`Wheel "${key}": foe power must be a finite number ≥ 0.`);
    }

    const seen = new Set<string>();
    for (const option of step.options) {
      const where = `${key} › ${option.id}`;
      if (seen.has(option.id)) errors.push(`${where}: duplicate option id.`);
      seen.add(option.id);

      if (!Number.isFinite(option.baseWeight) || option.baseWeight < 0) {
        errors.push(`${where}: baseWeight must be a finite number ≥ 0.`);
      }
      const next = option.nextStepId;
      if (next !== null && typeof next === 'object' && next.among.length === 0) {
        errors.push(`${where}: a route needs at least one wheel in "among".`);
      }
      for (const target of targetsOf(option)) {
        if (!config.steps[target]) errors.push(`${where}: nextStepId "${target}" does not match any wheel.`);
      }
      if (option.fight !== undefined && !step.foe && !step.foeOf && !step.cast?.asFoe) {
        errors.push(`${where}: a fight option needs a wheel with a foe.`);
      }
      for (const traitId of option.grantTraits ?? []) {
        if (!config.traits[traitId]) errors.push(`${where}: unknown trait "${traitId}".`);
      }
      if (option.requiresTrait !== undefined && option.requiresTrait.length === 0) {
        errors.push(`${where}: requiresTrait needs at least one trait.`);
      }
      for (const traitId of option.removeTraits ?? []) {
        if (!config.traits[traitId]) errors.push(`${where}: removes unknown trait "${traitId}".`);
      }
      const story = option.story;
      if (story?.begin) {
        const [lo, hi] = story.begin.length;
        if (!(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi >= lo)) {
          errors.push(`${where}: a quest's length must be whole numbers [min, max] with 1 ≤ min ≤ max.`);
        }
      }
      if (story?.rival?.create && !(story.rival.create.power > 0)) errors.push(`${where}: a rival's power share must be above 0.`);
      if (story?.rival?.weaken !== undefined && !(story.rival.weaken > 0)) errors.push(`${where}: weakening a rival must keep their power above 0.`);
      for (const traitId of option.requiresTrait ?? []) {
        if (!config.traits[traitId]) errors.push(`${where}: requires unknown trait "${traitId}".`);
      }
      if (option.requiresTag !== undefined && option.requiresTag.length === 0) errors.push(`${where}: requiresTag needs at least one tag.`);
      for (const race of option.requiresRace ?? []) {
        if (!config.races[race]) errors.push(`${where}: requires unknown race "${race}".`);
      }
      for (const [id, n] of Object.entries(option.meters ?? {})) {
        if (!config.meters?.some((m) => m.id === id)) errors.push(`${where}: moves unknown meter "${id}".`);
        if (!Number.isFinite(n)) errors.push(`${where}: meter "${id}" must move by a finite number.`);
      }
      if (option.place?.discover !== undefined && !config.placeKinds?.[option.place.discover]) {
        errors.push(`${where}: finds a place of unknown kind "${option.place.discover}".`);
      }
      if (option.honeLastTrait && !(Number.isFinite(option.honeLastTrait.factor) && option.honeLastTrait.factor > 0)) {
        errors.push(`${where}: honeLastTrait factor must be a number above 0.`);
      }
      if (option.honeTrait) {
        if (!config.traits[option.honeTrait.trait]) errors.push(`${where}: masters unknown trait "${option.honeTrait.trait}".`);
        if (!(Number.isFinite(option.honeTrait.factor) && option.honeTrait.factor > 0)) {
          errors.push(`${where}: honeTrait factor must be a number above 0.`);
        }
      }
      for (const [omen, k] of Object.entries(option.omenScaling ?? {})) {
        if (!(Number.isFinite(k) && k >= 0)) errors.push(`${where}: omenScaling for "${omen}" must be a number from 0.`);
      }
      for (const [kind, grant] of Object.entries(option.gear ?? {})) {
        errors.push(...gearGrantErrors(config, `${where}: gear ${kind}`, kind, grant));
      }
      for (const id of option.grantTraits ?? []) {
        const item = config.traits[id]?.item;
        if (item === 'weapon' || item === 'armor') errors.push(`${where}: "${id}" comes with a ${item === 'weapon' ? 'weapon' : 'suit of armour'}; grant the item (gear) instead of the trait.`);
      }
      for (const [key, cap] of Object.entries(option.statCap ?? {})) {
        if (!(STAT_KEYS as readonly string[]).includes(key)) errors.push(`${where}: statCap names unknown stat "${key}".`);
        if (!Number.isFinite(cap)) errors.push(`${where}: statCap for "${key}" must be a finite number.`);
      }
      for (const [key, k] of Object.entries(option.statScaling ?? {})) {
        if (!(STAT_KEYS as readonly string[]).includes(key)) errors.push(`${where}: statScaling names unknown stat "${key}".`);
        if (!Number.isFinite(k)) errors.push(`${where}: statScaling for "${key}" must be a finite number.`);
      }
      if (option.setRace !== undefined && !config.races[option.setRace]) {
        errors.push(`${where}: unknown race "${option.setRace}".`);
      }
      if (option.setPersonality !== undefined && !config.personalities[option.setPersonality]) {
        errors.push(`${where}: unknown personality "${option.setPersonality}".`);
      }
      if (option.setArchetype !== undefined && !config.archetypes[option.setArchetype]) {
        errors.push(`${where}: unknown archetype "${option.setArchetype}".`);
      }
      for (const [stepId, n] of Object.entries(option.queueSpins ?? {})) {
        if (!config.steps[stepId]) errors.push(`${where}: queues spins on unknown wheel "${stepId}".`);
        if (!Number.isInteger(n) || n < 1) errors.push(`${where}: queued spins on "${stepId}" must be a whole number ≥ 1.`);
      }
      if (option.castEffect !== undefined && !step.cast) {
        errors.push(`${where}: a cast effect needs a wheel that casts a character.`);
      }
      if (option.spoils !== undefined && !step.cast) {
        errors.push(`${where}: spoils need a wheel that casts a character.`);
      }
      if (option.castCondition !== undefined && !step.cast) {
        errors.push(`${where}: a cast condition needs a wheel that casts a character.`);
      }
      if (option.fameScaling !== undefined && !Number.isFinite(option.fameScaling)) {
        errors.push(`${where}: fameScaling must be a finite number.`);
      }
      if (option.fame !== undefined && !Number.isFinite(option.fame)) {
        errors.push(`${where}: fame must be a finite number.`);
      }
      if (option.rarity !== undefined && !RARITIES.includes(option.rarity)) {
        errors.push(`${where}: unknown rarity "${option.rarity}".`);
      }
      if (option.claimSingleton !== undefined && option.claimSingleton.trim() === '') {
        errors.push(`${where}: claimSingleton must be a non-empty key.`);
      }
      if (option.setStatus !== undefined && option.nextStepId !== null) {
        warnings.push(`${where}: sets status "${option.setStatus}", so its nextStepId is never followed on an adventure.`);
      }
    }

    if (step.overflow !== undefined) {
      if (!step.ladder) errors.push(`Wheel "${key}": overflow is only for ladder wheels.`);
      if (!config.steps[step.overflow]) errors.push(`Wheel "${key}": overflow "${step.overflow}" does not match any wheel.`);
    }

    if (!alwaysSpinnable(step, topTier)) {
      warnings.push(`Wheel "${key}" has no always-available option; some worlds could make it unspinnable.`);
    }

    if (!step.ladder) warnings.push(...rarityWarnings(key, step.options));
  }

  // Reachability and cycles, by depth-first search from both entry wheels.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: string[]): void => {
    if (visiting.has(id)) {
      const loop = [...path.slice(path.indexOf(id)), id];
      if (!loop.some((s) => config.steps[s]?.repeats)) warnings.push(`Cycle: ${[...path, id].join(' → ')} (allowed, but capped per character).`);
      return;
    }
    if (visited.has(id)) return;
    const step = config.steps[id];
    if (!step) return; // already reported above
    visiting.add(id);
    const onward = [...step.options.flatMap(targetsOf), ...(step.overflow ? [step.overflow] : [])];
    for (const next of new Set(onward)) visit(next, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const entry of entries) visit(entry, []);
  // A meter's trigger wheel is reached by the meter, not by an option.
  for (const meter of config.meters ?? []) visit(meter.trigger, []);
  // So is the road home, by a short adventure.
  if (config.adventure.roadHome) visit(config.adventure.roadHome.stepId, []);
  // And the evade wheel, by a fight.
  if (config.adventure.evade) {
    if (!config.steps[config.adventure.evade.stepId]) errors.push(`adventure.evade: "${config.adventure.evade.stepId}" does not match any wheel.`);
    visit(config.adventure.evade.stepId, []);
  }

  // And an archetype's own wheels, by its rules.
  for (const id of archetypeWheels(config)) {
    if (!config.steps[id]) errors.push(`An archetype's rules name "${id}", which does not match any wheel.`);
    visit(id, []);
  }

  for (const key of Object.keys(config.steps)) {
    if (!visited.has(key)) warnings.push(`Wheel "${key}" is unreachable from "${entries.join('" or "')}".`);
  }

  for (const meter of config.meters ?? []) {
    if (!config.steps[meter.trigger]) errors.push(`Meter "${meter.id}": trigger "${meter.trigger}" does not match any wheel.`);
    if (!(Number.isInteger(meter.max) && meter.max >= 1)) errors.push(`Meter "${meter.id}": max must be a whole number from 1.`);
  }
  for (const [key, kind] of Object.entries(config.placeKinds ?? {})) {
    if (kind.names.length === 0) errors.push(`Place kind "${key}" needs at least one name.`);
  }

  // Omens: every one an option bends to should be one a world event can leave.
  const omens = new Set((config.worldEvents ?? []).flatMap((e) => (e.omen ? [e.omen.id] : [])));
  for (const [key, step] of Object.entries(config.steps)) {
    for (const option of step.options) {
      for (const omen of Object.keys(option.omenScaling ?? {})) {
        if (!omens.has(omen)) warnings.push(`${key} › ${option.id}: omenScaling names "${omen}", which no world event leaves.`);
      }
    }
  }
  for (const event of config.worldEvents ?? []) {
    if (!(event.baseWeight >= 0 && Number.isFinite(event.baseWeight))) errors.push(`World event "${event.id}": baseWeight must be a number from 0.`);
    if (event.omen && !(Number.isInteger(event.omen.seasons) && event.omen.seasons >= 1)) errors.push(`World event "${event.id}": an omen lasts a whole number of seasons, at least 1.`);
  }

  errors.push(...gearConfigErrors(config));
  for (const [key, step] of Object.entries(config.steps)) {
    if (step.foe?.loot) errors.push(...lootTableErrors(config, `${key}: loot of ${step.foe.name}`, step.foe.loot));
  }

  return { errors, warnings };
}

const isPower = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10;

/** What is wrong with an option's gear grant: an unknown unique or base, a power outside 1–10. */
export function gearGrantErrors(config: GameConfig, where: string, kind: string, grant: GearGrant | undefined): string[] {
  if (grant === undefined) return [];
  const errors: string[] = [];
  if (typeof grant === 'number') {
    if (!isPower(grant)) errors.push(`${where}: power must be a whole number from 1 to 10.`);
    return errors;
  }
  if ('item' in grant) {
    if (grant.item.kind !== kind) errors.push(`${where}: the item is a ${grant.item.kind}.`);
    return errors;
  }
  if ('better' in grant) {
    if (!Number.isInteger(grant.better) || grant.better < 1) errors.push(`${where}: "better" must be a whole number of power, 1 or more.`);
    return errors;
  }
  if ('unique' in grant) {
    const def = config.gear?.uniques[grant.unique];
    if (!def) errors.push(`${where}: unknown unique gear "${grant.unique}".`);
    else if (def.kind !== kind) errors.push(`${where}: "${grant.unique}" is a ${def.kind}.`);
    return errors;
  }
  if (!isPower(grant.power)) errors.push(`${where}: power must be a whole number from 1 to 10.`);
  if (grant.rarity !== undefined && !RARITIES.includes(grant.rarity)) errors.push(`${where}: unknown rarity "${grant.rarity}".`);
  if (grant.base !== undefined) {
    const base = config.gear?.bases[grant.base];
    if (!base) errors.push(`${where}: unknown base "${grant.base}".`);
    else if (base.kind !== kind) errors.push(`${where}: base "${grant.base}" is a ${base.kind}.`);
  }
  if (grant.damage !== undefined && !DAMAGE_TYPES.includes(grant.damage)) errors.push(`${where}: unknown damage type "${grant.damage}".`);
  return errors;
}

/** What is wrong with a loot table: weights, power ranges, unknown bases, damage types or uniques, nothing to drop. */
export function lootTableErrors(config: GameConfig, where: string, table: LootTable): string[] {
  const errors: string[] = [];
  if (!(Number.isFinite(table.nothing) && table.nothing >= 0)) errors.push(`${where}: the nothing slice's weight must be a number from 0.`);
  if (!table.entries.some((e) => e.weight > 0)) errors.push(`${where}: nothing to drop.`);
  for (const entry of table.entries) {
    if (!(Number.isFinite(entry.weight) && entry.weight > 0)) errors.push(`${where}: every entry needs a weight above 0.`);
    if (entry.kind === 'unique') {
      if (!config.gear?.uniques[entry.id]) errors.push(`${where}: unknown unique gear "${entry.id}".`);
      continue;
    }
    const [lo, hi] = entry.power;
    if (!isPower(lo) || !isPower(hi) || lo > hi) errors.push(`${where}: a ${entry.kind}'s power range must be whole numbers within 1–10, lowest first.`);
    for (const id of entry.bases ?? []) {
      const base = config.gear?.bases[id];
      if (!base) errors.push(`${where}: unknown base "${id}".`);
      else if (base.kind !== entry.kind) errors.push(`${where}: base "${id}" is a ${base.kind}.`);
    }
    for (const d of entry.damage ?? []) if (!DAMAGE_TYPES.includes(d)) errors.push(`${where}: unknown damage type "${d}".`);
  }
  return errors;
}

/** The gear config itself: bases and uniques registered under their ids, abilities and uniques naming real traits. */
function gearConfigErrors(config: GameConfig): string[] {
  const gear = config.gear;
  if (!gear) return [];
  const errors: string[] = [];
  for (const [key, base] of Object.entries(gear.bases)) {
    if (base.id !== key) errors.push(`Gear base registered as "${key}" has id "${base.id}".`);
    if (!DAMAGE_TYPES.includes(base.damage)) errors.push(`Gear base "${key}": unknown damage type "${base.damage}".`);
  }
  for (const ability of gear.abilities) {
    if (!config.traits[ability.trait]) errors.push(`Gear ability "${ability.trait}" names no trait.`);
  }
  for (const [key, u] of Object.entries(gear.uniques)) {
    if (u.id !== key) errors.push(`Unique gear registered as "${key}" has id "${u.id}".`);
    if (!isPower(u.power)) errors.push(`Unique gear "${key}": power must be a whole number from 1 to 10.`);
    const base = gear.bases[u.base];
    if (!base) errors.push(`Unique gear "${key}": unknown base "${u.base}".`);
    else if (base.kind !== u.kind) errors.push(`Unique gear "${key}": base "${u.base}" is a ${base.kind}.`);
    for (const id of u.abilities) if (!config.traits[id]) errors.push(`Unique gear "${key}": ability "${id}" names no trait.`);
  }
  if (gear.materials.length < 10) errors.push('Gear materials: one is needed for every power, 1 to 10.');
  return errors;
}

/** Every wheel an option can lead to: its nextStepId, or all of a route's choices. */
function targetsOf(option: WheelOption): string[] {
  const next = option.nextStepId;
  if (next === null) return [];
  return typeof next === 'string' ? [next] : next.among;
}

/**
 * Some option can always be rolled, whatever the world and character:
 *  - open options (no condition, no trait or kind of cast needed, and no stats or fame can
 *    scale them to nothing)
 *    that luck pushes both ways (one with luckScaling ≥ 0, one with ≤ 0;
 *    a single option with none counts as both): whatever the sign of a soul's luck, one
 *    of them is at least its base weight. Stat ladders work this way. Or:
 *  - on a fight wheel, an unlocked 'win' and an unlocked 'lose' option: their odds
 *    sum to 1, so at least one is always above zero.
 */
function alwaysSpinnable(step: WheelStep, topTier: number): boolean {
  const open = (o: WheelOption) =>
    !o.condition &&
    !o.claimSingleton &&
    !o.requiresTrait &&
    !o.castCondition &&
    lowestStatFactor(o) > 0 &&
    1 + Math.min(0, o.fameScaling ?? 0) * topTier > 0 &&
    o.baseWeight > 0 &&
    (o.threatScaling ?? 0) >= 0;
  const plain = step.options.filter((o) => open(o) && !o.fight);
  if (plain.some((o) => (o.luckScaling ?? 0) >= 0) && plain.some((o) => (o.luckScaling ?? 0) <= 0)) return true;
  const sure = (side: 'win' | 'lose') => step.options.some((o) => open(o) && o.fight === side && !o.luckScaling);
  return (step.foe !== undefined || step.foeOf !== undefined || step.cast?.asFoe === true) && sure('win') && sure('lose');
}

/** The smallest `statScaling` factor any stats can give, for stats anywhere from 0 to 100. */
function lowestStatFactor(option: WheelOption): number {
  return Object.values(option.statScaling ?? {}).reduce(
    (factor, k) => factor + Math.min(k * (0 - STAT_BASELINE), k * (100 - STAT_BASELINE)),
    1,
  );
}

/**
 * A rarer option should never be more likely than a more common one on the same wheel,
 * or the tiers stop meaning anything. One warning per offending option, naming the
 * lightest more-common option it outweighs.
 */
function rarityWarnings(stepKey: string, options: readonly WheelOption[]): string[] {
  const rank = (o: WheelOption) => RARITIES.indexOf(o.rarity ?? 'common');
  const tier = (o: WheelOption): Rarity => o.rarity ?? 'common';
  const warnings: string[] = [];
  for (const rarer of options) {
    if (rank(rarer) < 0) continue; // unknown rarity, already an error
    const lighter = options
      .filter((o) => rank(o) >= 0 && rank(o) < rank(rarer) && o.baseWeight < rarer.baseWeight)
      .sort((a, b) => a.baseWeight - b.baseWeight)[0];
    if (lighter) {
      warnings.push(
        `${stepKey} › ${rarer.id}: marked ${tier(rarer)} (weight ${rarer.baseWeight}) but outweighs ` +
          `${lighter.id}, which is ${tier(lighter)} (weight ${lighter.baseWeight}).`,
      );
    }
  }
  return warnings;
}

/** The tiers that count as a hype slice: something a player hopes to land. */
export const HYPE_RARITIES: readonly Rarity[] = ['epic', 'legendary', 'mythical'];

/**
 * The design rule every wheel follows: at least one epic-or-rarer slice, even on menus, doorways
 * and decisions (What Will You Do? has Transform; Which Clan? has the Lost Hold). Returns the ids
 * of wheels that break it, for tests and tools.
 */
export function wheelsWithoutHype(config: GameConfig): string[] {
  return Object.values(config.steps)
    .filter((step) => !step.options.some((o) => HYPE_RARITIES.includes(o.rarity ?? 'common')))
    .map((step) => step.id);
}
