/**
 * Boss battles (engine/battle.ts): which powers can be cast in one, and what they do.
 *
 *   hit    typed damage at the foe (Fireball, Smite)
 *   heal   health back (Healing Light)
 *   drain  a hit that heals by what it takes (Life Drain)
 *   ward   the foe's side of the next wheel shrinks (Divine Shield, Blink)
 *
 * `power` is the hit (or heal) in battle units, where both sides have BATTLE_POOL (24) at full
 * health and an ordinary strike is 4. Powers not listed here are not cast in a fight
 * (Resurrection already works its own way: it cheats death).
 */
import type { BattleConfig, BattleSpell, CascadeSlice } from '../engine/types';

const BATTLE_SPELLS: Record<string, BattleSpell> = {
  // Blessed
  healing_light: { kind: 'heal', power: 8, verb: 'calls down Healing Light' },
  divine_shield: { kind: 'ward', power: 0, verb: 'raises a Divine Shield' },
  smite: { kind: 'hit', damage: 'holy', power: 6, verb: 'Smites' },
  holy_flame: { kind: 'hit', damage: 'holy', power: 6, verb: 'wreathes the foe in Holy Flame' },
  radiant_aura: { kind: 'ward', power: 0, verb: 'blazes with a Radiant Aura' },
  sanctuary: { kind: 'heal', power: 6, verb: 'stands in Sanctuary' },
  fortunes_blessing: { kind: 'ward', power: 0, verb: 'is touched by Fortune' },
  angelic_wings: { kind: 'hit', damage: 'holy', power: 7, verb: 'dives on white wings' },
  miracle: { kind: 'hit', damage: 'holy', power: 12, verb: 'works a Miracle' },
  // Corrupted
  shadow_bolt: { kind: 'hit', damage: 'shadow', power: 6, verb: 'throws a Shadow Bolt' },
  life_drain: { kind: 'drain', damage: 'shadow', power: 5, verb: 'Drains their life' },
  aura_of_dread: { kind: 'ward', power: 0, verb: 'lets the Dread out' },
  hellfire: { kind: 'hit', damage: 'fire', power: 7, verb: 'calls up Hellfire' },
  raise_dead: { kind: 'hit', damage: 'shadow', power: 6, verb: 'Raises the Dead against them' },
  plague_touch: { kind: 'hit', damage: 'poison', power: 6, verb: 'lays on a Plague Touch' },
  curse_of_ruin: { kind: 'ward', power: 0, verb: 'speaks a Curse of Ruin' },
  demonic_wings: { kind: 'hit', damage: 'shadow', power: 7, verb: 'falls on them on leathern wings' },
  soul_rend: { kind: 'hit', damage: 'shadow', power: 10, verb: 'Rends their soul' },
  the_unmaking: { kind: 'hit', damage: 'arcane', power: 12, verb: 'begins The Unmaking' },
  // Arcane
  fireball: { kind: 'hit', damage: 'fire', power: 6, verb: 'hurls a Fireball' },
  frost_lance: { kind: 'hit', damage: 'frost', power: 6, verb: 'throws a Frost Lance' },
  chain_lightning: { kind: 'hit', damage: 'lightning', power: 7, verb: 'looses Chain Lightning' },
  arcane_shield: { kind: 'ward', power: 0, verb: 'throws up an Arcane Shield' },
  blink: { kind: 'ward', power: 0, verb: 'Blinks out of the way' },
  mind_read: { kind: 'ward', power: 0, verb: 'reads the next move in their mind' },
  summon_elemental: { kind: 'hit', damage: 'lightning', power: 7, verb: 'Summons an Elemental' },
  meteor_swarm: { kind: 'hit', damage: 'fire', power: 10, verb: 'calls down a Meteor Swarm' },
  time_stop: { kind: 'hit', damage: 'arcane', power: 10, verb: 'Stops Time, and takes their time about it' },
  wish: { kind: 'hit', damage: 'arcane', power: 14, verb: 'speaks a Wish' },
};

/**
 * The Crit Cascade: a critical hit spins this. A multiplier ends it; CHAIN doubles and spins
 * again, faster. Every multiplier landed multiplies the hit. The last wheel has no CHAIN.
 */
const CASCADE_SLICES: CascadeSlice[] = [
  { id: 'x2', label: '×2', mult: 2, weight: 38, rarity: 'common', color: '#8a6a3a' },
  { id: 'x3', label: '×3', mult: 3, weight: 25, rarity: 'uncommon', color: '#b8842a' },
  { id: 'x5', label: '×5', mult: 5, weight: 12, rarity: 'rare', color: '#e0a83a' },
  { id: 'jackpot', label: 'JACKPOT ×10', mult: 10, weight: 3, rarity: 'legendary', color: '#ffd76a' },
  { id: 'chain', label: 'CHAIN ×2', mult: 2, chain: true, weight: 22, rarity: 'epic', color: '#c04ae0' },
];
/** How many cascade wheels can stack. */
const CASCADE_DEPTH = 4;
/** A foe's crit spins once: ×2 or ×3. */
const FOE_CASCADE: BattleConfig['foeCascade'] = [
  { mult: 2, weight: 70 },
  { mult: 3, weight: 30 },
];

/** How each kind of Clash slice looks. `{foe}`, `{move}` and `{spell}` are filled in. */
const CLASH_LOOK: BattleConfig['look'] = {
  strike: { label: 'Strike', description: 'A clean hit.', icon: 'Sword', color: '#3f8a5a' },
  glance: { label: 'Glancing Blow', description: 'It lands, barely.', icon: 'Swords', color: '#5a7a5a' },
  crit: { label: 'CRITICAL!', description: 'Spins the Crit Cascade: every multiplier stacks.', icon: 'Star', color: '#ffd76a' },
  execute: { label: 'Execute', description: 'Finishes {foe} if it is down to a quarter of its health.', icon: 'Crosshair', color: '#e11d48' },
  leech: { label: 'Lifedrinking Strike', description: 'The blade drinks, and their wounds close.', icon: 'Droplets', color: '#9b1c3a' },
  stand: { label: 'Last Stand', description: 'On their knees, they get up one more time.', icon: 'Crown', color: '#f0c06a' },
  riposte: { label: 'Riposte', description: 'Parried, and answered.', icon: 'Swords', color: '#a8a29e' },
  block: { label: 'Steel on Steel', description: 'Neither gives an inch.', icon: 'Shield', color: '#4a4a55' },
  foe_strike: { label: '{foe} Strikes', description: 'It gets through.', icon: 'HeartCrack', color: '#8a2e2e' },
  foe_move: { label: '{move}', description: 'Its signature blow.', icon: 'Skull', color: '#a3282e' },
  foe_crit: { label: 'Brutal Blow', description: '{foe} finds an opening. ×2 or ×3.', icon: 'Bomb', color: '#5a0f14' },
  thorns: { label: 'Thorns Bite Back', description: 'It hits them, and the thorns hit it.', icon: 'ShieldHalf', color: '#5b6b3a' },
};

export const BATTLE_CONFIG: BattleConfig = {
  spells: BATTLE_SPELLS,
  cascade: CASCADE_SLICES,
  cascadeDepth: CASCADE_DEPTH,
  foeCascade: FOE_CASCADE,
  look: CLASH_LOOK,
};
