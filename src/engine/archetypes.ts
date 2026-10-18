/**
 * Archetypes bend the act of spinning, not just the odds. Their rules (`ArchetypeRules`) are
 * frozen onto the character with the archetype (`Character.rules`); everything that reads them
 * lives here, or is a one-line hook in the flow it touches:
 *
 *   dealing     `shapeOptions`, called last by `dealOptions`: a Realist's wheels lose their
 *               extremes, a Dreamer's gain a Nightmare and a Miracle, a Broken soul's lose a
 *               few slices, a Transcendent's rarities swap odds, a Hero is dealt more of the
 *               holy, an Archmage can't take up a weapon
 *   wheels      `substituteStep`: a Martial soul's spell wheels become training
 *   gains       `stakeOf` / `settleStake`: what a Gambler bets on the coin, and how it lands
 *   choosing    `preferOutcome` (a Wise soul's autoplay), `nearestOpen` (where a Smash lands)
 *
 * Combat Power (power.ts) reads the rules too: an Assassin's Agility, an Archmage's spells, a
 * Trickster's boost. The flows (generation.ts, adventure.ts) do the detours: the Gambler's coin,
 * the Trickster's wheel before every fight, the All-Rounder's skipped stat wheels.
 */
import { armorPower, grantPower, shiftGrant, temper, weaponPower } from './gear';
import { ladderStat } from './ladder';
import { calculatePowerRating } from './power';
import { createSeededRng, hashSeed } from './rng';
import { getLockReason } from './roll';
import {
  RARITIES,
  STAT_KEYS,
  type Character,
  type GambleStake,
  type GameConfig,
  type Rarity,
  type ResolvedSlice,
  type StatBlock,
  type StatKey,
  type WheelOption,
  type WheelStep,
  type World,
} from './types';

/** A Dreamer's extra tiers: each takes this share of the wheel. */
const DREAM_SHARE = 0.035;
/** How far past the ladder a Dreamer's tiers reach, in stat points. */
const DREAM_REACH = 3;
/** Realist and Dreamer only touch wheels with at least this many open options; fewer have no middle to keep. */
const MIN_TRIMMED = 4;

/** The world a wheel is dealt in, when the caller has one: locks then count when picking which slices to touch. */
export interface DealContext {
  world?: World;
  /** Tells spins apart for a Broken soul's cracks: the same spin always breaks the same slices. */
  salt?: number;
}

/** What tells one spin from the next, for a soul's cracks: the spins taken, on this adventure or in creation. */
export function spinSalt(char: Character, stepsTaken: number): number {
  return stepsTaken + 1000 * char.adventures.length;
}

/**
 * The last word on a dealt wheel, by the soul's archetype. Pure; options it doesn't touch are
 * returned as they are. Choice wheels and `fixed` wheels (an archetype's own) are left alone,
 * apart from a Hero's pull and an Archmage's empty hands.
 */
export function shapeOptions(step: WheelStep, options: WheelOption[], char: Character, config: GameConfig, ctx: DealContext = {}): WheelOption[] {
  const rules = char.rules;
  if (!rules) return options;
  let out = options;
  if (rules.holyPull && rules.holyPull !== 1) out = out.map((o) => (o.holy ? { ...o, baseWeight: o.baseWeight * rules.holyPull! } : o));
  if (rules.noWeapon) out = disarm(out, char, config, ctx);
  if (step.fixed || step.choice) return out;
  if (rules.trimExtremes) out = trim(step, out, char, ctx);
  if (rules.dreamTiers) out = dream(step, out, char, ctx);
  if (rules.shatter) out = shatter(step, out, char, ctx);
  if (rules.mirrorRarity) out = mirror(out, char, ctx);
  return out;
}

/**
 * A wheel as this soul faces it, by their archetype: a Martial soul's spell wheels are their
 * training wheel (under the same id, so owed spins are spent as if the spell wheel was spun), and
 * a Gambler's coin says what is riding on it.
 */
export function substituteStep(config: GameConfig, step: WheelStep, char: Character): WheelStep {
  let faced = step;
  const swap = char.rules?.replaceSteps;
  const replacement = swap?.steps.includes(step.id) ? config.steps[swap.with] : undefined;
  if (replacement) faced = { ...replacement, id: step.id, ...(step.repeats && { repeats: true }) };
  if (char.stake && step.id === char.rules?.gamble) faced = { ...faced, subtitle: `On the coin: ${describeStake(char.stake.gains)}.` };
  return faced;
}

// ─── Dealing ────────────────────────────────────────────────────────────────

/** Can this option be rolled, as far as dealing can tell? */
function isOpen(option: WheelOption, char: Character, ctx: DealContext): boolean {
  if (option.baseWeight <= 0) return false;
  return ctx.world === undefined || getLockReason(option, ctx.world, char) === null;
}

/**
 * How good each option is on this wheel, higher better, or undefined for one that isn't on the
 * scale. A stat ladder by its value; a wheel of gear or mastery ranks by tier or factor;
 * anything else by rarity (rarer is "higher": the most common slice is the bottom).
 */
function ranking(step: WheelStep, options: readonly WheelOption[]): (number | undefined)[] {
  if (step.ladder) {
    const stat = ladderStat(step);
    return options.map((o) => (stat === undefined ? undefined : o.setStats?.[stat]));
  }
  const gearOf = (o: WheelOption) => (o.gear?.weapon !== undefined ? grantPower(o.gear.weapon) : o.gear?.armor !== undefined ? grantPower(o.gear.armor) : undefined);
  const tiered = options.map((o) => gearOf(o) ?? o.honeLastTrait?.factor ?? o.honeTrait?.factor);
  if (tiered.filter((v) => v !== undefined).length * 2 >= options.length) return tiered.map((v) => v ?? 0);
  return options.map((o) => RARITIES.indexOf(o.rarity ?? 'common') * 1e6 - o.baseWeight);
}

/** The open options with a place on the scale, worst first. */
function scale(step: WheelStep, options: readonly WheelOption[], char: Character, ctx: DealContext) {
  const ranks = ranking(step, options);
  return options
    .map((option, index) => ({ option, index, rank: ranks[index] }))
    .filter((e): e is { option: WheelOption; index: number; rank: number } => e.rank !== undefined && isOpen(e.option, char, ctx))
    .sort((a, b) => a.rank - b.rank);
}

/** Realist: the worst and the best open options are cut. Wheels too small to have a middle are left. */
function trim(step: WheelStep, options: WheelOption[], char: Character, ctx: DealContext): WheelOption[] {
  const ranked = scale(step, options, char, ctx);
  if (ranked.length < MIN_TRIMMED) return options;
  const cut = new Set([ranked[0]!.index, ranked.at(-1)!.index]);
  return options.filter((_o, i) => !cut.has(i));
}

/** Dreamer: a Nightmare below the worst open option and a Miracle above the best, each a sliver of the wheel. */
function dream(step: WheelStep, options: WheelOption[], char: Character, ctx: DealContext): WheelOption[] {
  const ranked = scale(step, options, char, ctx);
  if (ranked.length < 2) return options;
  const total = options.reduce((sum, o) => sum + (isOpen(o, char, ctx) ? o.baseWeight : 0), 0);
  const weight = Math.round(total * DREAM_SHARE * 100) / 100;
  const worst = ranked[0]!;
  const best = ranked.at(-1)!;
  const miracle = dreamt(step, best.option, 'miracle', weight, char);
  const nightmare = dreamt(step, worst.option, 'nightmare', weight, char);
  // On a ladder (best first) the Miracle tops it and the Nightmare ends it; elsewhere each sits beside its source.
  const out: WheelOption[] = [];
  options.forEach((o, i) => {
    if (i === best.index && step.ladder) out.push(miracle);
    out.push(o);
    if (i === best.index && !step.ladder) out.push(miracle);
    if (i === worst.index) out.push(nightmare);
  });
  return out;
}

/** Whether a stat wheel has set this stat yet (`stat_<stat>_<race>`): until then, gains are banked for it. */
function statRolled(char: Character, stat: StatKey): boolean {
  return char.status !== 'rolling' || char.history.some((r) => r.stepId.startsWith(`stat_${stat}_`));
}

/** A dream tier made from a real option: the same outcome, pushed past what the wheel can do. */
function dreamt(step: WheelStep, source: WheelOption, kind: 'miracle' | 'nightmare', weight: number, char: Character): WheelOption {
  const up = kind === 'miracle';
  const stat = step.ladder ? ladderStat(step) : undefined;
  const option: WheelOption = {
    ...source,
    id: `${source.id}~${kind}`,
    label: up ? `Miracle: ${source.label}` : `Nightmare: ${source.label}`,
    description: up ? `Beyond the best this wheel has. ${source.description ?? ''}`.trim() : `Below the worst this wheel has. ${source.description ?? ''}`.trim(),
    baseWeight: weight,
    rarity: up ? 'mythical' : 'epic',
    color: up ? '#fff4c2' : '#1a1020',
    icon: up ? 'Sparkles' : 'Moon',
  };
  delete option.epithet;
  delete option.vary;
  if (stat !== undefined && source.setStats?.[stat] !== undefined) {
    const value = Math.max(1, source.setStats[stat] + (up ? DREAM_REACH : -DREAM_REACH));
    return { ...option, setStats: { [stat]: value }, description: `${up ? 'A dream' : 'A nightmare'}: a ${stat} of ${value} before bonuses.`, ...(!up && { luckDelta: (source.luckDelta ?? 0) - 1 }) };
  }
  const gear = source.gear && {
    ...(source.gear.weapon !== undefined && { weapon: shiftGrant(source.gear.weapon, up ? 2 : -2) }),
    ...(source.gear.armor !== undefined && { armor: shiftGrant(source.gear.armor, up ? 2 : -2) }),
  };
  const hone = (h: { factor: number; rank: string } | undefined) => h && { ...h, factor: h.factor * (up ? 1.5 : 0.5), rank: up ? `Dreamt ${h.rank}` : `Nightmare ${h.rank}` };
  // A Nightmare is a Miracle's mirror: every stat down where a Miracle lifts every one.
  const step1 = up ? 1 : -1;
  const lift: Partial<StatBlock> = { might: step1, agility: step1, intellect: step1, arcana: step1, vitality: step1 };
  // A stat its wheel hasn't rolled yet would be overwritten by that roll: bank the lift for it instead.
  const statModifiers: Partial<StatBlock> = { ...source.statModifiers };
  const statBonus: Partial<StatBlock> = { ...source.statBonus };
  for (const key of STAT_KEYS) {
    if (!lift[key]) continue;
    const into = statRolled(char, key) ? statModifiers : statBonus;
    into[key] = (into[key] ?? 0) + lift[key]!;
  }
  return {
    ...option,
    statBonus,
    ...(gear && { gear }),
    ...(source.honeLastTrait && { honeLastTrait: hone(source.honeLastTrait)! }),
    ...(source.honeTrait && { honeTrait: { ...hone(source.honeTrait)!, trait: source.honeTrait.trait } }),
    statModifiers,
    luckDelta: (source.luckDelta ?? 0) + (up ? 0.5 : -0.5),
    // And it hurts: a wound on top of whatever the slice it darkens does (not while being rolled).
    ...(!up && char.status !== 'rolling' && { meters: { ...source.meters, wounds: (source.meters?.wounds ?? 0) + 1 } }),
  };
}

/** Broken: one to three open options vanish, more on bigger wheels, never leaving fewer than two. The same spin breaks the same slices. */
function shatter(step: WheelStep, options: WheelOption[], char: Character, ctx: DealContext): WheelOption[] {
  const open = options.flatMap((o, i) => (isOpen(o, char, ctx) ? [i] : []));
  const n = open.length;
  const breaks = Math.min(n <= 5 ? 1 : n <= 10 ? 2 : 3, n - 2);
  if (breaks <= 0) return options;
  const rng = createSeededRng(hashSeed(`${char.id}|${step.id}|${ctx.salt ?? 0}`));
  const pool = [...open];
  const gone = new Set<number>();
  for (let k = 0; k < breaks; k++) gone.add(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  return options.filter((_o, i) => !gone.has(i));
}

/**
 * Transcendent: each rarity tier on the wheel takes the odds of its mirror. The tiers present
 * are paired outside in (the most common with the rarest, and so on), so the swap works on any
 * wheel; within a tier, options keep their proportions.
 */
function mirror(options: WheelOption[], char: Character, ctx: DealContext): WheelOption[] {
  const mass = new Map<Rarity, number>();
  for (const o of options) if (isOpen(o, char, ctx)) mass.set(o.rarity ?? 'common', (mass.get(o.rarity ?? 'common') ?? 0) + o.baseWeight);
  const tiers = [...mass.keys()].sort((a, b) => RARITIES.indexOf(a) - RARITIES.indexOf(b));
  if (tiers.length < 2) return options;
  const swapped = new Map(tiers.map((t, i) => [t, tiers[tiers.length - 1 - i]!]));
  return options.map((o) => {
    const tier = o.rarity ?? 'common';
    const from = mass.get(tier);
    const to = mass.get(swapped.get(tier) ?? tier);
    if (!from || !to || from === to) return o;
    return { ...o, baseWeight: (o.baseWeight * to) / from };
  });
}

/** Does this option arm the soul? */
function armsThem(option: WheelOption, config: GameConfig): boolean {
  return option.gear?.weapon !== undefined || (option.weaponTierDelta ?? 0) > 0 || (option.grantTraits ?? []).some((id) => config.traits[id]?.item === 'weapon');
}

/** Archmage: options that would arm them are locked, as long as something else on the wheel is still open. */
function disarm(options: WheelOption[], char: Character, config: GameConfig, ctx: DealContext): WheelOption[] {
  const arming = options.map((o) => armsThem(o, config));
  if (!arming.some(Boolean) || !options.some((o, i) => !arming[i] && isOpen(o, char, ctx))) return options;
  return options.map((o, i) => (arming[i] ? { ...o, condition: () => false, lockedReason: 'An Archmage holds no weapon' } : o));
}

// ─── The Gambler's coin ─────────────────────────────────────────────────────

/**
 * What a roll gained, for a Gambler to bet: stat points, stats set outright, banked bonus points,
 * weapon and armour power. Losses are never bet. Null when nothing was gained.
 */
export function stakeOf(before: Character, after: Character, option: WheelOption): GambleStake | null {
  const stake: GambleStake = {};
  const add = (field: 'stats' | 'set' | 'bonus', key: keyof StatBlock, n: number) => {
    stake[field] = { ...stake[field], [key]: n };
  };
  for (const key of STAT_KEYS) {
    if (option.setStats?.[key] !== undefined) add('set', key, after.stats[key]);
    else if (after.stats[key] > before.stats[key]) add('stats', key, after.stats[key] - before.stats[key]);
    if (after.statBonus[key] > before.statBonus[key] && option.setStats?.[key] === undefined) add('bonus', key, after.statBonus[key] - before.statBonus[key]);
  }
  if (weaponPower(after) > weaponPower(before)) stake.weapon = weaponPower(after) - weaponPower(before);
  if (armorPower(after) > armorPower(before)) stake.armor = armorPower(after) - armorPower(before);
  return Object.keys(stake).length > 0 ? stake : null;
}

/** The coin lands: every gain doubles (or triples, on a jackpot), or every gain is lost (a stat set outright falls to 1). */
export function settleStake(char: Character, stake: GambleStake, how: 'double' | 'triple' | 'lose', config: GameConfig): Character {
  // Gains are already in: winning adds them again (once more for a jackpot), losing takes them back.
  const again = how === 'lose' ? -1 : how === 'triple' ? 2 : 1;
  const stats = { ...char.stats };
  const statBonus = { ...char.statBonus };
  for (const key of STAT_KEYS) {
    const gained = stake.stats?.[key];
    if (gained) stats[key] = Math.max(0, stats[key] + again * gained);
    const set = stake.set?.[key];
    if (set !== undefined) stats[key] = how === 'lose' ? 1 : set * (1 + again);
    const banked = stake.bonus?.[key];
    if (banked) statBonus[key] += again * banked;
  }
  // Gear won is tempered further, or worn back down (to nothing, it breaks).
  let settled: Character = { ...char, stats, statBonus };
  if (stake.weapon) settled = temper(settled, 'weapon', again * stake.weapon, config);
  if (stake.armor) settled = temper(settled, 'armor', again * stake.armor, config);
  return settled;
}

const STAT_NAMES: Record<keyof StatBlock, string> = { might: 'Might', agility: 'Agility', intellect: 'Intellect', arcana: 'Arcana', vitality: 'Vitality' };

/** Words for a stake, for the coin's wheel: '+2 Might, Weapon +1'. */
export function describeStake(stake: GambleStake, statName: (key: keyof StatBlock) => string = (k) => STAT_NAMES[k]): string {
  const parts: string[] = [];
  for (const key of STAT_KEYS) {
    if (stake.set?.[key] !== undefined) parts.push(`${statName(key)} ${stake.set[key]}`);
    if (stake.stats?.[key]) parts.push(`+${stake.stats[key]} ${statName(key)}`);
    if (stake.bonus?.[key]) parts.push(`+${stake.bonus[key]} banked ${statName(key)}`);
  }
  if (stake.weapon) parts.push(`Weapon +${stake.weapon}`);
  if (stake.armor) parts.push(`Armour +${stake.armor}`);
  return parts.join(', ');
}

// ─── Choosing ───────────────────────────────────────────────────────────────

/**
 * A Wise soul left to themselves (an autoplay): of two results, the one that keeps them alive;
 * then the one that leaves them stronger; on a tie, the rarer roll. True when `b` is preferred over `a`.
 */
export function preferOutcome(a: { roll: { winner: ResolvedSlice }; character: Character }, b: { roll: { winner: ResolvedSlice }; character: Character }): boolean {
  const deadA = a.character.status === 'fallen';
  const deadB = b.character.status === 'fallen';
  if (deadA !== deadB) return deadA;
  const pa = calculatePowerRating(a.character);
  const pb = calculatePowerRating(b.character);
  if (pa !== pb) return pb > pa;
  return b.roll.winner.probability < a.roll.winner.probability;
}

/** Where a Smash lands: the slice under the pointer, or the nearest one that can be rolled if that one is locked. */
export function nearestOpen(slices: readonly ResolvedSlice[], index: number): number {
  const n = slices.length;
  for (let d = 0; d < n; d++) {
    for (const i of [index + d, index - d]) {
      const at = ((i % n) + n) % n;
      if (slices[at] && slices[at].effectiveWeight > 0) return at;
    }
  }
  return index;
}

// ─── The wheels archetypes reach ────────────────────────────────────────────

/** Wheels reached by an archetype's rules rather than by an option: a Gambler's coin, a Trickster's gambit, a Martial soul's training. */
export function archetypeWheels(config: GameConfig): string[] {
  const ids = Object.values(config.archetypes).flatMap((a) => [a.rules?.gamble, a.rules?.beforeFight, a.rules?.replaceSteps?.with]);
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}
