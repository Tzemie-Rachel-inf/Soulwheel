/**
 * Boss battles: a big fight (`WheelStep.battle`) is fought as rounds of a Clash wheel, each
 * spin a blow one way or the other, until one side's health runs out. Then the fight's own
 * wheel says how it ended, with only its winning slices (or only its losing ones) on it, so
 * every authored outcome, hype slice, death cheat and Spoils wheel works as it always has.
 *
 * Every fight is a battle. A boss (`WheelStep.battle`, `Foe.battle`) has BATTLE_POOL of health
 * and can take all of the hero's; an ordinary foe has a few blows' worth (`foePool`) and can take
 * a third of it (SKIRMISH_STAKE), after which the hero is driven off. So ordinary fights are
 * over in a few spins, and cost about what a lost one-spin fight's wound used to.
 *
 * Health is in battle units: a hero has BATTLE_POOL at full. The hero comes in with what the
 * road has left them (engine/hp.ts) and leaves with what the battle left them. The hero's Strike
 * is their weapon's (`heroStrike`): fists 3 units, a power-10 weapon 7.
 *
 * Fair odds. Each wheel is block (a tenth) and the rest split between the hero's side and the
 * foe's. The hero's share `q` is solved for at the start of the battle, exactly, over every
 * state the battle could reach (`winChance`), so that a hero at full health at even matchups
 * wins as often as Combat Power says they should: heroCP / (heroCP + foe.power). What moves it
 * from there is what the hero brings: the right damage against the foe (×1.3 on a weakness,
 * ×0.75 resisted, ×0.5 immune), armour that turns its blows (×0.7), and the health they come in with.
 *
 *   the hero's side   Strike 4 · Glancing 2 · CRITICAL! (the Crit Cascade) · spells · Execute
 *                     (the foe under a quarter) · Last Stand (the hero under 30%) · gear's own
 *   the foe's side    its Strike 4 · its signature move 6 (readied a round ahead) · Brutal Blow (×2/×3)
 *
 * The Crit Cascade: a crit spins a smaller, faster wheel of multipliers; CHAIN doubles and spins
 * another on top, and every multiplier landed multiplies the hit (×2 → CHAIN → ×3 is ×12).
 *
 * Spells (`BattleConfig.spells`) are cast one of two ways (`SpellMode`), to be decided by playtest:
 *   auto     each known spell is a slice on the hero's side, there every round
 *   choose   each is a charge the player may spend before a spin: a sure hit, heal or ward
 * Both are calibrated, so neither changes how often a hero wins on its own.
 */
import { calculatePowerRating, calculateWinProbability, statScale, weaponStat } from './power';
import { MATCHUP_MULT, TURNED_MULT, foeStrikes, heroDamage, matchupOf, turns, type Matchup } from './matchup';
import { hpFraction, maxHp } from './hp';
import type { Rng } from './rng';
import type { BattleConfig, BattleSpell, Character, ClashSlice, DamageType, Foe, Rarity, SpellMode, StatKey, WheelOption, WheelStep } from './types';

/** Battle units of health a hero has at full, and a boss. */
export const BATTLE_POOL = 24;
/** Clash wheels are addressed as `battle:<the fight's id>`. They are built on the spot, from `AdventureState.battle`. */
export const BATTLE_STEP_PREFIX = 'battle:';
/** Health a foe shows per battle unit, every foe alike, so a weapon's damage reads the same against all of them. */
export const FOE_HP_PER_UNIT = 5;
/**
 * What an ordinary (not boss) fight can take from the hero before they are driven off: a third
 * of their health, the wound a lost fight always cost.
 */
export const SKIRMISH_STAKE = BATTLE_POOL / 3;

/** An ordinary foe's health, in battle units: low, a few blows, more for the stronger ones. A boss has BATTLE_POOL. */
export function foePool(foe: Foe, boss: boolean): number {
  if (boss) return BATTLE_POOL;
  return Math.min(14, Math.max(6, Math.round(6 + foe.power / 60)));
}

type Striker = Pick<Character, 'weapon' | 'rules' | 'stats'>;

/** The stat a blow is struck with: the weapon's (its ×1.25 on the card), or Arcana for those who carry none by choice. */
export function strikeStat(char: Striker): StatKey {
  return char.rules?.noWeapon ? 'arcana' : weaponStat(char);
}

/**
 * The hero's Strike, in battle units: fists 3, a weapon more the better it is (power 10: 7), then
 * scaled by the stat it is wielded with, as its Combat Power is (`statScale`: ×1.6 at 22, ×0.44
 * at 3). Never under 1.
 */
export function heroStrike(char: Striker): number {
  const power = char.weapon?.power ?? 0;
  const base = char.rules?.noWeapon ? 4 : power <= 0 ? 3 : 3 + Math.min(4, Math.ceil(power / 3));
  return Math.max(1, Math.round(base * statScale(char.stats[strikeStat(char)])));
}

/** A weapon's damage as the game shows it (a Strike, in a foe's health): what a blow takes off any foe. */
export function weaponDamage(char: Striker): number {
  return heroStrike(char) * FOE_HP_PER_UNIT;
}

const STRIKE = 4;
const MOVE = 6;
const LEECH_HEAL = 2;
const STAND_HEAL = 6;
const THORNS = 2;
const RIPOSTE = 2;
/** The share of every Clash wheel where neither lands anything. */
const BLOCK_SHARE = 0.1;
/** What a ward leaves of the foe's side of the next wheel (the rest goes to block). */
const WARD_LEFT = 0.5;
/** Shares within the hero's side. Strike takes what is left. */
const HERO = { glance: 0.2, crit: 0.07, spells: 0.18, archmageSpells: 0.3, execute: 0.06, stand: 0.06, leech: 0.12 };
/** Shares within the foe's side. Its Strike takes what is left. */
const FOE = { move: 0.3, crit: 0.08, thorns: 0.12 };

export interface CascadeRoll {
  id: string;
  label: string;
  mult: number;
}

/** What just happened in a battle: the last spin, or a spell cast before one. For the HUD. */
export interface ClashEvent {
  kind: ClashSlice['kind'];
  label: string;
  toFoe: number;
  toHero: number;
  heal: number;
  damage?: DamageType;
  matchup?: ClashSlice['matchup'];
  /** A crit's cascade, wheel by wheel. */
  cascade?: CascadeRoll[];
  /** The total multiplier the cascade came to. */
  mult?: number;
  spellId?: string;
  ward?: boolean;
  /** Cast by the player before the spin (choose mode), not landed on. */
  cast?: boolean;
  /** The blow would have dropped them: Iron Will got them up at 1. */
  ironWill?: boolean;
}

export interface BattleState {
  /** The fight this battle decides. */
  stepId: string;
  foe: Foe;
  /** The odds Combat Power gives the hero. */
  odds: number;
  /** The hero's side's share of each wheel, solved so a hero at full health wins at `odds`. */
  q: number;
  /**
   * The hero's health in this battle, 0 to `heroPool`: at 0 they are beaten. In a boss battle
   * that is all of it; in an ordinary fight, only what the fight can take (SKIRMISH_STAKE).
   */
  heroHp: number;
  foeHp: number;
  /** What the battle can take from the hero. Default (older saves): BATTLE_POOL. */
  heroPool?: number;
  /** Their health under the battle's: what an ordinary fight can't take. Real health is `heroBase + heroHp`. */
  heroBase?: number;
  /** The foe's health at full. Default (older saves): BATTLE_POOL. */
  foePool?: number;
  /** A boss battle, rather than an ordinary fight. */
  boss?: boolean;
  /** The round about to be spun, from 1. */
  round: number;
  /** Which of the foe's moves it has readied (`Foe.moves`). */
  intent: number;
  /** Casts used, per spell. */
  spent: Record<string, number>;
  /** A ward was cast: the foe's side of this round's wheel is shrunk. */
  warded: boolean;
  /** Set when one side's health is gone. */
  verdict?: 'win' | 'lose';
  last?: ClashEvent | null;
  /** The battle so far, newest last. */
  log: string[];
  stats: { bestHit: number; crits: number; maxCascade: number; casts: number };
  /** Health shown per battle unit, either side: the hero's own scale and the foe's (for the log). */
  scale: { hero: number; foe: number };
  /** Blows the hero has landed in a row without taking one. */
  combo: number;
  /** Iron Will has got them up this battle: it works once a fight. */
  ironWillUsed?: boolean;
}

/** True for a Clash wheel id. */
export function isBattleStep(stepId: string): boolean {
  return stepId.startsWith(BATTLE_STEP_PREFIX);
}

/** True for a fight that is fought as a battle: every fight with a foe. */
export function isBattleFight(step: WheelStep): boolean {
  return !!step.foe;
}

/** True for a boss: a big fight, fought to the end. */
export function isBossFight(step: WheelStep): boolean {
  return !!step.foe && (step.battle === true || step.foe.battle === true);
}

/** The battle's pools, with older saves' defaults. */
export function poolsOf(battle: Pick<BattleState, 'heroPool' | 'foePool' | 'heroBase'>): { hero: number; foe: number; base: number } {
  return { hero: battle.heroPool ?? BATTLE_POOL, foe: battle.foePool ?? BATTLE_POOL, base: battle.heroBase ?? 0 };
}

/** The hero's real health, in battle units out of BATTLE_POOL. */
export function heroUnits(battle: Pick<BattleState, 'heroHp' | 'heroPool' | 'foePool' | 'heroBase'>): number {
  return poolsOf(battle).base + battle.heroHp;
}

/** The foe's health at full, as shown. */
export function foeMaxHp(battle: Pick<BattleState, 'foePool'>): number {
  return (battle.foePool ?? BATTLE_POOL) * FOE_HP_PER_UNIT;
}

// ─── Spells ─────────────────────────────────────────────────────────────────

/** The spells this hero can cast in a battle, in the order they learned them. */
export function battleSpells(char: Character, config: BattleConfig): { id: string; name: string; spell: BattleSpell }[] {
  return char.traits.filter((t) => config.spells[t.id]).map((t) => ({ id: t.id, name: t.name, spell: config.spells[t.id]! }));
}

/** How many times each spell can be cast in one battle: twice for an Archmage. */
export function spellCharges(char: Character): number {
  return Math.max(1, Math.round(char.rules?.spellMultiplier ?? 1));
}

/** An Archmage's spells hit harder: +50% for a doubled spell multiplier. */
function spellBoost(char: Character): number {
  return 1 + ((char.rules?.spellMultiplier ?? 1) - 1) * 0.5;
}

/** The spells not yet spent. */
export function unspentSpells(char: Character, battle: Pick<BattleState, 'spent'>, config: BattleConfig) {
  const charges = spellCharges(char);
  return battleSpells(char, config).filter((s) => (battle.spent[s.id] ?? 0) < charges);
}

// ─── The exchanges on a wheel ───────────────────────────────────────────────

/** One kind of blow on a Clash wheel, with its share of the wheel (shares sum to 1). */
interface Exchange extends ClashSlice {
  weight: number;
  label: string;
  /** A crit: its damage is multiplied by the cascade when it lands. */
  crit?: 'hero' | 'foe';
}

interface Situation {
  heroHp: number;
  foeHp: number;
  heroPool: number;
  foePool: number;
  intent: number;
  spent: Record<string, number>;
  warded: boolean;
}

/** Damage after a matchup: never below 1. */
const dealt = (base: number, mult: number) => Math.max(1, Math.round(base * mult));
const matchupTag = (m: Matchup): ClashSlice['matchup'] => (m === 'neutral' ? undefined : m);

/**
 * Every exchange on this wheel, at `q`. `neutral` evens every matchup out (for solving `q`).
 * Shares sum to 1.
 */
function exchanges(char: Character, foe: Foe, config: BattleConfig, mode: SpellMode, q: number, at: Situation, neutral: boolean): Exchange[] {
  const look = (kind: string) => config.look[kind]?.label ?? kind;
  const hits = heroDamage(char);
  const hitMatch: Matchup = neutral ? 'neutral' : matchupOf(hits, foe);
  const am = MATCHUP_MULT[hitMatch];
  const has = (id: string) => char.traits.some((t) => t.id === id);
  const strike = heroStrike(char);
  const glance = Math.ceil(strike / 2);

  // The hero's side.
  const hero: Exchange[] = [];
  let left = 1;
  const add = (share: number, ex: Omit<Exchange, 'weight'>) => {
    hero.push({ ...ex, weight: share });
    left -= share;
  };
  const tag = matchupTag(hitMatch);
  add(HERO.glance, { kind: 'glance', label: look('glance'), toFoe: dealt(glance, am), damage: hits, matchup: tag });
  add(HERO.crit * (has('gear_slaying') ? 2 : 1), { kind: 'crit', label: look('crit'), toFoe: dealt(strike, am), damage: hits, matchup: tag, crit: 'hero' });
  if (at.foeHp <= at.foePool / 4) add(HERO.execute, { kind: 'execute', label: look('execute'), toFoe: at.foeHp, damage: hits });
  if (at.heroHp <= at.heroPool * 0.3) {
    add(HERO.stand * (char.archetype === 'hero' ? 2 : 1), { kind: 'stand', label: look('stand'), toFoe: dealt(strike, am), heal: STAND_HEAL, damage: hits, matchup: tag });
  }
  if (has('gear_vampiric')) add(HERO.leech, { kind: 'leech', label: look('leech'), toFoe: dealt(strike, am), heal: LEECH_HEAL, damage: hits, matchup: tag });
  if (mode === 'auto') {
    // On the wheel for good: a spell lands as often as its slice comes up.
    const spells = battleSpells(char, config);
    const share = (char.rules?.spellMultiplier ?? 1) > 1 ? HERO.archmageSpells : HERO.spells;
    for (const s of spells) add(share / spells.length, { ...spellEffect(char, foe, s.id, s.spell, neutral), label: s.name });
  }
  hero.push({ kind: 'strike', label: look('strike'), toFoe: dealt(strike, am), damage: hits, matchup: tag, weight: Math.max(0, left) });

  // The foe's side.
  const strikes = foeStrikes(foe);
  const dm = (d: DamageType) => (!neutral && turns(char, d) ? TURNED_MULT : 1);
  const turned = (d: DamageType) => (!neutral && turns(char, d) ? ('turned' as const) : undefined);
  const move = foe.moves?.[at.intent % Math.max(1, foe.moves.length)];
  const foeSide: Exchange[] = [];
  let rest = 1;
  const push = (share: number, ex: Omit<Exchange, 'weight'>) => {
    foeSide.push({ ...ex, weight: share });
    rest -= share;
  };
  if (move) push(FOE.move, { kind: 'foe_move', label: move.name, toHero: dealt(MOVE, dm(move.damage)), damage: move.damage, matchup: turned(move.damage) });
  push(FOE.crit, { kind: 'foe_crit', label: look('foe_crit'), toHero: dealt(STRIKE, dm(strikes)), damage: strikes, matchup: turned(strikes), crit: 'foe' });
  if (has('gear_thorns')) push(FOE.thorns, { kind: 'thorns', label: look('thorns'), toHero: dealt(STRIKE, dm(strikes)), toFoe: THORNS, damage: strikes, matchup: turned(strikes) });
  foeSide.push({ kind: 'foe_strike', label: look('foe_strike').replaceAll('{foe}', foe.name), toHero: dealt(STRIKE, dm(strikes)), damage: strikes, matchup: turned(strikes), weight: Math.max(0, rest) });

  const foeShare = (1 - BLOCK_SHARE) * (1 - q) * (at.warded ? WARD_LEFT : 1);
  const heroShare = (1 - BLOCK_SHARE) * q;
  const block: Exchange = has('gear_duelist')
    ? { kind: 'riposte', label: look('riposte'), toFoe: RIPOSTE, weight: 1 - heroShare - foeShare, damage: hits }
    : { kind: 'block', label: look('block'), weight: 1 - heroShare - foeShare };
  return [...hero.map((e) => ({ ...e, weight: e.weight * heroShare })), ...foeSide.map((e) => ({ ...e, weight: e.weight * foeShare })), block].filter((e) => e.weight > 0);
}

/** What casting a spell does, as an exchange. */
function spellEffect(char: Character, foe: Foe, spellId: string, spell: BattleSpell, neutral = false): Omit<Exchange, 'weight' | 'label'> {
  const m: Matchup = neutral || !spell.damage ? 'neutral' : matchupOf(spell.damage, foe);
  const power = spell.power * spellBoost(char);
  const base = { kind: 'spell' as const, spellId, ...(spell.damage && { damage: spell.damage }), ...(matchupTag(m) && { matchup: matchupTag(m) }) };
  switch (spell.kind) {
    case 'hit':
      return { ...base, toFoe: dealt(power, MATCHUP_MULT[m]) };
    case 'drain': {
      const hit = dealt(power, MATCHUP_MULT[m]);
      return { ...base, toFoe: hit, heal: hit };
    }
    case 'heal':
      return { ...base, heal: Math.round(power) };
    case 'ward':
      return { ...base, ward: true };
  }
}

// ─── The Crit Cascade ───────────────────────────────────────────────────────

/** Every multiplier a hero's cascade can come to, with its chance. */
export function cascadeOdds(config: BattleConfig, depth = 1): Map<number, number> {
  const slices = config.cascade.filter((s) => !s.chain || depth < config.cascadeDepth);
  const total = slices.reduce((sum, s) => sum + s.weight, 0);
  const out = new Map<number, number>();
  const add = (mult: number, p: number) => out.set(mult, (out.get(mult) ?? 0) + p);
  for (const s of slices) {
    const p = s.weight / total;
    if (s.chain) for (const [mult, q] of cascadeOdds(config, depth + 1)) add(s.mult * mult, p * q);
    else add(s.mult, p);
  }
  return out;
}

function foeCascadeOdds(config: BattleConfig): Map<number, number> {
  const total = config.foeCascade.reduce((sum, s) => sum + s.weight, 0);
  return new Map(config.foeCascade.map((s) => [s.mult, s.weight / total]));
}

function pickWeighted<T extends { weight: number }>(items: readonly T[], rng: Rng): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let draw = rng() * total;
  for (const item of items) {
    draw -= item.weight;
    if (draw < 0) return item;
  }
  return items.at(-1)!;
}

/** Spin a hero's cascade: wheel after wheel while CHAIN lands, up to `cascadeDepth`. */
export function rollCascade(config: BattleConfig, rng: Rng): CascadeRoll[] {
  const rolls: CascadeRoll[] = [];
  for (let depth = 1; depth <= config.cascadeDepth; depth++) {
    const slice = pickWeighted(config.cascade.filter((s) => !s.chain || depth < config.cascadeDepth), rng);
    rolls.push({ id: slice.id, label: slice.label, mult: slice.mult });
    if (!slice.chain) break;
  }
  return rolls;
}

function rollFoeCascade(config: BattleConfig, rng: Rng): CascadeRoll[] {
  const { mult } = pickWeighted(config.foeCascade, rng);
  return [{ id: `x${mult}`, label: `×${mult}`, mult }];
}

// ─── Fair odds ──────────────────────────────────────────────────────────────

/** A foe with nothing special about it: even matchups, for solving the odds. Its moves stay (they hit harder). */
const evenFoe = (foe: Foe): Foe => ({ name: foe.name, power: foe.power, ...(foe.moves && { moves: foe.moves.map((m) => ({ ...m })) }) });

/**
 * The chance a hero at full health beats the foe, as a function of `q`, exactly: every state a
 * battle can reach (the hero's health, the foe's, the charges left, a ward up or not), every
 * cascade a crit can come to, and, in choose mode, the spells a hero left to themselves would
 * cast (`autoCast`).
 *
 * Solved level by level: fewest charges left first, then the foe's health from low to high.
 * Within a level only the hero's health and the ward move (blows, heals), so each level is
 * swept until it settles; every other move leads to a level already solved. What is cast
 * where doesn't depend on `q`, so it is worked out once.
 */
export function winChanceAt(char: Character, foe: Foe, config: BattleConfig, mode: SpellMode, pools: { hero: number; foe: number } = { hero: BATTLE_POOL, foe: BATTLE_POOL }): (q: number) => number {
  const even = evenFoe(foe);
  const heroCrit = [...cascadeOdds(config)];
  const foeCrit = [...foeCascadeOdds(config)];
  const P = pools.hero;
  const F = pools.foe;
  const spells = mode === 'choose' ? battleSpells(char, config) : [];
  const charges = spellCharges(char);
  const radix = charges + 1;
  const masks = radix ** spells.length;
  const left = (m: number, i: number) => Math.floor(m / radix ** i) % radix;
  const total = (m: number) => spells.reduce((sum, _s, i) => sum + left(m, i), 0);
  const order = Array.from({ length: masks }, (_, m) => m).sort((a, b) => total(a) - total(b));
  const at = (m: number, f: number, h: number, w: number) => ((m * (F + 1) + f) * (P + 1) + h) * 2 + w;
  const size = masks * (F + 1) * (P + 1) * 2;

  // In choose mode, where a cast takes each state: -1 nothing is cast, -2 the foe falls, else the state after it.
  const castTo = new Int32Array(size).fill(-1);
  if (spells.length > 0) {
    for (let m = 0; m < masks; m++) {
      const spent = Object.fromEntries(spells.map((s, i) => [s.id, charges - left(m, i)]));
      for (let f = 1; f <= F; f++) {
        for (let h = 1; h <= P; h++) {
          for (let w = 0; w < 2; w++) {
            const id = autoCast(config, { heroHp: h, foeHp: f, heroPool: P, foePool: F, spent, warded: w === 1, foe: even } as BattleState, char);
            if (!id) continue;
            const i = spells.findIndex((s) => s.id === id);
            const e = spellEffect(char, even, id, spells[i]!.spell, true);
            const f2 = f - (e.toFoe ?? 0);
            castTo[at(m, f, h, w)] = f2 <= 0 ? -2 : at(m - radix ** i, f2, Math.min(P, h + (e.heal ?? 0)), w === 1 || e.ward ? 1 : 0);
          }
        }
      }
    }
  }

  return (q: number) => {
    // The wheel depends on the state only through Execute (the foe under a quarter), Last Stand (the hero under 30%) and a ward.
    const table = (execute: boolean, stand: boolean, warded: boolean) =>
      exchanges(char, even, config, mode, q, { heroHp: stand ? 1 : P, foeHp: execute ? 1 : F, heroPool: P, foePool: F, intent: 0, spent: {}, warded }, true);
    const tables = [false, true].flatMap((e) => [false, true].flatMap((s) => [false, true].map((w) => table(e, s, w))));
    const win = new Float64Array(size);
    const value = (m: number, f: number, h: number, w: number): number => (f <= 0 ? 1 : h <= 0 ? 0 : win[at(m, f, h, w)]!);
    // A spin from a state: the chance of winning, with the chance of staying put left out (and the rest scaled up).
    const spin = (m: number, f: number, h: number, w: number): number => {
      let won = 0;
      let weight = 0;
      for (const ex of tables[(f <= F / 4 ? 4 : 0) + (h <= P * 0.3 ? 2 : 0) + w]!) {
        const toHero = ex.toHero ?? 0;
        if (ex.crit === 'hero') {
          weight += ex.weight;
          for (const [mult, p] of heroCrit) won += ex.weight * p * value(m, f - (ex.toFoe ?? 0) * mult, h, 0);
          continue;
        }
        if (ex.crit === 'foe') {
          weight += ex.weight;
          for (const [mult, p] of foeCrit) won += ex.weight * p * value(m, f, h - toHero * mult, 0);
          continue;
        }
        const toFoe = ex.kind === 'execute' ? f : (ex.toFoe ?? 0);
        const hurt = h - toHero;
        const h2 = hurt > 0 ? Math.min(P, hurt + (ex.heal ?? 0)) : hurt;
        const w2 = ex.ward ? 1 : 0;
        if (toFoe === 0 && h2 === h && w2 === w) continue; // nothing changes: leave it out
        weight += ex.weight;
        // The foe falling first counts as a win, as it does in the battle.
        won += ex.weight * (f - toFoe <= 0 ? 1 : value(m, f - toFoe, h2, w2));
      }
      return weight > 0 ? won / weight : 0.5;
    };
    for (const m of order) {
      for (let f = 1; f <= F; f++) {
        for (let sweep = 0; sweep < 100; sweep++) {
          let moved = 0;
          for (let h = 1; h <= P; h++) {
            for (let w = 0; w < 2; w++) {
              const i = at(m, f, h, w);
              const cast = castTo[i]!;
              const next = cast === -2 ? 1 : cast >= 0 ? win[cast]! : spin(m, f, h, w);
              moved = Math.max(moved, Math.abs(next - win[i]!));
              win[i] = next;
            }
          }
          if (moved < 1e-6) break;
        }
      }
    }
    return value(masks - 1, F, P, 0);
  };
}

/** The chance a hero at full health, at even matchups, beats the foe at `q`. */
export function winChance(char: Character, foe: Foe, config: BattleConfig, mode: SpellMode, q: number, pools?: { hero: number; foe: number }): number {
  return winChanceAt(char, foe, config, mode, pools)(q);
}

/** Solved shares, by everything they depend on: heroes meet the same odds again and again. */
const SHARES = new Map<string, number>();

/**
 * The hero's share of each wheel such that a hero at full health, at even matchups, wins at
 * `odds` (to the nearest half a percent). Found by false position (Illinois): a few solves.
 */
export function solveShare(
  char: Character,
  foe: Foe,
  config: BattleConfig,
  mode: SpellMode,
  odds: number,
  pools: { hero: number; foe: number } = { hero: BATTLE_POOL, foe: BATTLE_POOL },
): number {
  const target = Math.round(odds * 200) / 200;
  const gear = ['gear_slaying', 'gear_vampiric', 'gear_thorns', 'gear_duelist'].filter((id) => char.traits.some((t) => t.id === id));
  const key = [mode, target, battleSpells(char, config).map((s) => s.id).join(','), gear.join(','), char.archetype === 'hero', char.rules?.spellMultiplier ?? 1, foe.moves?.length ? 1 : 0, heroStrike(char), pools.hero, pools.foe].join('|');
  const known = SHARES.get(key);
  if (known !== undefined) return known;
  const chance = winChanceAt(char, foe, config, mode, pools);
  let a = 0.01;
  let b = 0.99;
  let fa = chance(a) - target;
  let fb = chance(b) - target;
  let q = fa >= 0 ? a : fb <= 0 ? b : 0.5;
  let side = 0;
  for (let i = 0; i < 24 && fa < 0 && fb > 0; i++) {
    q = (a * fb - b * fa) / (fb - fa);
    const fq = chance(q) - target;
    if (Math.abs(fq) < 5e-4) break;
    if (fq < 0) {
      a = q;
      fa = fq;
      if (side === -1) fb /= 2;
      side = -1;
    } else {
      b = q;
      fb = fq;
      if (side === 1) fa /= 2;
      side = 1;
    }
  }
  if (SHARES.size > 4000) SHARES.clear();
  SHARES.set(key, q);
  return q;
}

// ─── A battle ───────────────────────────────────────────────────────────────

/**
 * A battle about to begin. The hero comes in with the health the road has left them. A boss
 * battle can take all of it; an ordinary fight, against a foe with little health, only a third
 * (SKIRMISH_STAKE): past that they are driven off, which is how it was lost.
 */
export function startBattle(config: BattleConfig, stepId: string, foe: Foe, char: Character, mode: SpellMode, boss = true): BattleState {
  const odds = calculateWinProbability(calculatePowerRating(char) * (char.fightBoost ?? 1), foe.power);
  const pools = { hero: boss ? BATTLE_POOL : SKIRMISH_STAKE, foe: foePool(foe, boss) };
  const q = solveShare(char, foe, config, mode, odds, pools);
  const real = Math.max(1, Math.ceil(BATTLE_POOL * hpFraction(char)));
  const heroHp = Math.min(pools.hero, real);
  return {
    stepId,
    foe,
    odds,
    q,
    heroHp,
    heroPool: pools.hero,
    heroBase: real - heroHp,
    foePool: pools.foe,
    boss,
    foeHp: pools.foe,
    round: 1,
    intent: 0,
    spent: {},
    warded: false,
    last: null,
    log: [`${char.name || 'The hero'} faces ${foe.name}.`],
    stats: { bestHit: 0, crits: 0, maxCascade: 0, casts: 0 },
    scale: { hero: maxHp(char) / BATTLE_POOL, foe: FOE_HP_PER_UNIT },
    combo: 0,
  };
}

const RARITY: Record<ClashSlice['kind'], Rarity> = {
  strike: 'common',
  glance: 'common',
  crit: 'epic',
  spell: 'rare',
  execute: 'rare',
  leech: 'uncommon',
  stand: 'epic',
  riposte: 'uncommon',
  block: 'common',
  foe_strike: 'common',
  foe_move: 'uncommon',
  foe_crit: 'rare',
  thorns: 'uncommon',
};

/** A line for a slice: what it would do, in the health either side shows. */
function describeExchange(ex: Exchange, char: Character, foe: Foe, config: BattleConfig, scale: { hero: number; foe: number }): string {
  const parts: string[] = [];
  const base = config.look[ex.kind]?.description?.replaceAll('{foe}', foe.name);
  if (ex.toFoe) parts.push(`${ex.crit ? `${Math.round(ex.toFoe * scale.foe)} × the cascade` : Math.round(ex.toFoe * scale.foe)} ${ex.damage ?? ''} damage to ${foe.name}`.replace('  ', ' '));
  if (ex.toHero) parts.push(`${ex.crit ? `${Math.round(ex.toHero * scale.hero)} × 2 or 3` : Math.round(ex.toHero * scale.hero)} ${ex.damage ?? ''} damage to ${char.name || 'the hero'}`.replace('  ', ' '));
  if (ex.heal) parts.push(`heals ${Math.round(ex.heal * scale.hero)}`);
  if (ex.ward) parts.push(`${foe.name}'s next blows are halved in number`);
  const tag = ex.matchup === 'weak' ? ' WEAK!' : ex.matchup === 'resisted' ? ' Resisted.' : ex.matchup === 'immune' ? ' Immune.' : ex.matchup === 'turned' ? ' Armour turns it.' : '';
  const spell = ex.spellId ? config.spells[ex.spellId]?.verb : undefined;
  return [spell ? `${char.name || 'They'} ${spell}.` : base, parts.length ? `${parts.join(', ')}.` : 'Nothing lands.'].filter(Boolean).join(' ') + tag;
}

/**
 * The Clash wheel for this round, as `char` faces it: fixed (no archetype reshapes it) and at
 * exact odds. Each slice carries what it does (`clash`).
 */
export function createClashStep(config: BattleConfig, battle: BattleState, char: Character, mode: SpellMode, heroMaxHp: number): WheelStep {
  const { foe } = battle;
  const scale = { hero: heroMaxHp / BATTLE_POOL, foe: FOE_HP_PER_UNIT };
  const move = foe.moves?.[battle.intent % Math.max(1, foe.moves.length)];
  const pools = poolsOf(battle);
  const list = exchanges(char, foe, config, mode, battle.q, { ...battle, heroPool: pools.hero, foePool: pools.foe }, false);
  const seen = new Map<string, number>();
  return {
    id: `${BATTLE_STEP_PREFIX}${battle.stepId}`,
    title: `Round ${battle.round}: ${foe.name}`,
    subtitle: move?.tell ? `${foe.name} ${move.tell}…` : battle.warded ? 'Warded: it can barely reach them.' : 'Steel, and fate.',
    fixed: true,
    exactOdds: true,
    repeats: true,
    options: list.map((ex): WheelOption => {
      const key = ex.spellId ?? ex.kind;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      const look = config.look[ex.kind];
      const { weight, label, crit: _crit, ...clash } = ex;
      return {
        id: n > 1 ? `${key}_${n}` : key,
        label,
        description: describeExchange(ex, char, foe, config, scale),
        baseWeight: weight * 1000,
        rarity: RARITY[ex.kind],
        nextStepId: null,
        color: ex.kind === 'spell' && ex.damage ? (SPELL_COLORS[ex.damage] ?? '#7c5ae0') : (look?.color ?? '#6b6b6b'),
        icon: ex.kind === 'spell' ? spellIcon(ex) : (look?.icon ?? 'CircleDot'),
        clash,
      };
    }),
  };
}

const SPELL_COLORS: Partial<Record<DamageType, string>> = { fire: '#e0703a', frost: '#7ac4e0', lightning: '#7a9ae0', holy: '#f5c46a', shadow: '#4a3a6e', arcane: '#8a6ae0', poison: '#65a30d' };
function spellIcon(ex: ClashSlice): string {
  if (ex.ward) return 'Shield';
  if (ex.heal && !ex.toFoe) return 'HeartPulse';
  if (ex.heal) return 'Droplets';
  return ({ fire: 'Flame', frost: 'Snowflake', lightning: 'Zap', holy: 'Sun', shadow: 'Moon', arcane: 'WandSparkles', poison: 'Biohazard' } as Record<string, string>)[ex.damage ?? ''] ?? 'Sparkles';
}

/** The battle once `slice` has landed (or been cast): health moves, the log grows, and maybe it is over. */
export function applyClash(
  config: BattleConfig,
  battle: BattleState,
  char: Character,
  slice: ClashSlice & { label: string },
  rng: Rng,
  how: { cast?: boolean } = {},
): BattleState {
  const name = char.name || 'The hero';
  const crit = slice.kind === 'crit' ? rollCascade(config, rng) : slice.kind === 'foe_crit' ? rollFoeCascade(config, rng) : undefined;
  const mult = crit ? crit.reduce((m, r) => m * r.mult, 1) : 1;
  const toFoe = (slice.toFoe ?? 0) * (slice.kind === 'crit' ? mult : 1);
  const toHero = (slice.toHero ?? 0) * (slice.kind === 'foe_crit' ? mult : 1);
  const heal = slice.heal ?? 0;
  const foeHp = Math.max(0, battle.foeHp - toFoe);
  let heroHp = Math.min(poolsOf(battle).hero, Math.max(0, battle.heroHp - toHero) + (battle.heroHp - toHero > 0 ? heal : 0));
  // Iron Will: once a fight, the blow that would drop them leaves them standing at 1.
  const ironWill = heroHp <= 0 && !battle.ironWillUsed && char.traits.some((t) => t.id === 'iron_will');
  if (ironWill) heroHp = 1;
  const spent = slice.spellId ? { ...battle.spent, [slice.spellId]: (battle.spent[slice.spellId] ?? 0) + 1 } : battle.spent;
  const verdict = foeHp <= 0 ? 'win' : heroHp <= 0 ? 'lose' : undefined;
  const moves = battle.foe.moves ?? [];
  const event: ClashEvent = {
    kind: slice.kind,
    label: slice.label,
    toFoe,
    toHero,
    heal,
    ...(slice.damage && { damage: slice.damage }),
    ...(slice.matchup && { matchup: slice.matchup }),
    ...(crit && { cascade: crit, mult }),
    ...(slice.spellId && { spellId: slice.spellId }),
    ...(slice.ward && { ward: true }),
    ...(how.cast && { cast: true }),
    ...(ironWill && { ironWill: true }),
  };
  const line = logLine(config, event, name, battle.foe.name, battle.scale);
  return {
    ...battle,
    foeHp,
    heroHp,
    spent,
    // A cast comes before the round's spin; a spin ends the round.
    round: how.cast ? battle.round : battle.round + 1,
    intent: how.cast || moves.length < 2 ? battle.intent : Math.floor(rng() * moves.length),
    warded: how.cast ? battle.warded || !!slice.ward : !!slice.ward,
    ...(verdict && { verdict }),
    last: event,
    combo: toHero > 0 ? 0 : toFoe > 0 ? battle.combo + 1 : battle.combo,
    ...(ironWill && { ironWillUsed: true }),
    log: [...battle.log, line, ...(ironWill ? [`IRON WILL! ${name} should be down, and gets back up.`] : []), ...(verdict ? [verdict === 'win' ? `${battle.foe.name} falls.` : `${name} falls.`] : [])].slice(-12),
    stats: {
      bestHit: Math.max(battle.stats.bestHit, toFoe),
      crits: battle.stats.crits + (slice.kind === 'crit' ? 1 : 0),
      maxCascade: Math.max(battle.stats.maxCascade, slice.kind === 'crit' ? (crit?.length ?? 0) : 0),
      casts: battle.stats.casts + (how.cast ? 1 : 0),
    },
  };
}

/** A line for the battle log, in the health either side shows (not battle units). */
function logLine(config: BattleConfig, unit: ClashEvent, hero: string, foe: string, scale: BattleState['scale']): string {
  const e = { ...unit, toFoe: Math.round(unit.toFoe * scale.foe), toHero: Math.round(unit.toHero * scale.hero), heal: Math.round(unit.heal * scale.hero) };
  const spell = e.spellId ? config.spells[e.spellId] : undefined;
  const tag = e.matchup === 'weak' ? ' WEAK!' : e.matchup === 'resisted' ? ' (resisted)' : e.matchup === 'immune' ? ' (immune)' : e.matchup === 'turned' ? ' (armour turns it)' : '';
  if (spell) return `${hero} ${spell.verb}${e.toFoe ? `: ${e.toFoe}` : ''}${e.heal ? `, +${e.heal}` : ''}${e.ward ? ': warded' : ''}.${tag}`;
  const chain = !e.cascade ? '' : e.cascade.length === 1 ? ` ${e.cascade[0]!.label}` : ` ${e.cascade.map((c) => (c.id === 'chain' ? 'CHAIN ×2' : c.label)).join(' → ')} = ×${e.mult}`;
  switch (e.kind) {
    case 'block':
      return 'Steel on steel. Nothing lands.';
    case 'riposte':
      return `${hero} parries, and answers: ${e.toFoe}.`;
    case 'crit':
      return `CRITICAL!${chain}: ${e.toFoe} to ${foe}.${tag}`;
    case 'foe_crit':
      return `${foe} lands a brutal blow${chain}: ${e.toHero}.${tag}`;
    case 'foe_strike':
    case 'foe_move':
      return `${e.label}: ${e.toHero} to ${hero}.${tag}`;
    case 'thorns':
      return `${foe} hits for ${e.toHero}; the thorns bite back for ${e.toFoe}.`;
    case 'stand':
      return `Last Stand! ${hero} gets up: +${e.heal}, and ${e.toFoe} back.`;
    case 'leech':
      return `The blade drinks: ${e.toFoe}, +${e.heal}.${tag}`;
    case 'execute':
      return `Execute! ${hero} finishes it.`;
    default:
      return `${e.label}: ${e.toFoe} to ${foe}.${tag}`;
  }
}

/** Choose mode: cast a spell before the spin. Throws if it is spent or unknown. */
export function castSpell(config: BattleConfig, battle: BattleState, char: Character, spellId: string, rng: Rng): BattleState {
  const known = unspentSpells(char, battle, config).find((s) => s.id === spellId);
  if (!known) throw new Error(`"${spellId}" can't be cast now.`);
  return applyClash(config, battle, char, { ...spellEffect(char, battle.foe, known.id, known.spell), label: known.name }, rng, { cast: true });
}

/**
 * What a hero left to themselves casts before a spin (choose mode, for autoplay and the sim):
 * the hardest hit while the foe is above 40%, a heal under 35% health, else a ward while the
 * foe is still strong. Null to just spin.
 */
export function autoCast(config: BattleConfig, battle: BattleState, char: Character): string | null {
  const spells = unspentSpells(char, battle, config).map((s) => ({ ...s, effect: spellEffect(char, battle.foe, s.id, s.spell) }));
  if (spells.length === 0) return null;
  const pools = poolsOf(battle);
  if (battle.heroHp < pools.hero * 0.35) {
    const heal = spells.filter((s) => s.effect.heal).sort((a, b) => (b.effect.heal ?? 0) - (a.effect.heal ?? 0))[0];
    if (heal) return heal.id;
  }
  if (battle.foeHp > pools.foe * 0.4) {
    const hit = spells.filter((s) => s.effect.toFoe).sort((a, b) => (b.effect.toFoe ?? 0) - (a.effect.toFoe ?? 0))[0];
    if (hit) return hit.id;
    if (!battle.warded) return spells.find((s) => s.effect.ward)?.id ?? null;
  }
  return null;
}
