/**
 * Weapons and armour as real items: made (generated or predetermined), equipped, tempered,
 * offered, and dropped by foes.
 *
 * A hero holds one weapon and wears one armour. An item's abilities are traits, kept on the
 * character with `item` set to the slot, so everything that reads traits (Combat Power,
 * trait-gated wins, death cheats) sees them; `syncGearTraits` keeps them in step with what is
 * equipped. A new item for a filled slot is never swapped in on its own: it waits in
 * `Character.gearOffers` until the player keeps what they have or takes it (`chooseGear`).
 * Autoplay and the world's own people take whichever is better (`settleGearOffers`).
 */
import { ARMOR_TIER_CP, WEAPON_TIER_CP, statScale, traitPower } from './power';
import { createId, seededFrom, type Rng } from './rng';
import {
  RARITIES,
  type Character,
  type DamageType,
  type GameConfig,
  type GearConfig,
  type GearGrant,
  type GearItem,
  type GearKind,
  type LootTable,
  type Rarity,
  type StatKey,
  type Trait,
  type World,
} from './types';

/** The most power an item can have. */
export const MAX_GEAR_POWER = 10;

/** The power an item of each rarity is made at. Tempering can take it past its band, never past 10. */
export const RARITY_POWER: Record<Rarity, [number, number]> = {
  common: [1, 3],
  uncommon: [2, 4],
  rare: [3, 6],
  epic: [5, 7],
  legendary: [7, 9],
  mythical: [9, 10],
};

/** How many abilities a generated item of each rarity rolls. */
export const RARITY_ABILITIES: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 2, mythical: 3 };

/** How often each rarity drops, where its power fits the table: the rarer, the thinner. */
const RARITY_DROP_WEIGHT: Record<Rarity, number> = { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2.5, mythical: 0.8 };

export const GEAR_KIND_LABEL: Record<GearKind, string> = { weapon: 'weapon', armor: 'armour' };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rarityRank = (r: Rarity) => RARITIES.indexOf(r);
const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
const between = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));

/** The power of the weapon in hand: 0 for bare hands. */
export const weaponPower = (char: Pick<Character, 'weapon'>): number => char.weapon?.power ?? 0;
/** The power of the armour worn: 0 for travelling clothes. */
export const armorPower = (char: Pick<Character, 'armor'>): number => char.armor?.power ?? 0;
/** What sits in a slot. */
export const slotOf = (char: Pick<Character, 'weapon' | 'armor'>, kind: GearKind): GearItem | null => (kind === 'weapon' ? char.weapon : char.armor);

/**
 * The stat an item is used with by this character: its own, unless their archetype says how
 * they fight (an Assassin wields everything with Agility), or lets them wear armour with a
 * better stat than the armour's own.
 */
export function gearStat(item: Pick<GearItem, 'kind' | 'stat'>, char: Pick<Character, 'stats' | 'rules'>): StatKey {
  if (item.kind === 'weapon') return char.rules?.weaponStat ?? item.stat;
  const options = [item.stat, ...(char.rules?.armorStats ?? [])];
  return options.reduce((best, key) => (char.stats[key] > char.stats[best] ? key : best));
}

/** An item's ability traits as the bearer gets them: snapshots, marked with the slot, scaled by the item's stat. */
export function abilityTraits(item: GearItem, config: Pick<GameConfig, 'traits'>): Trait[] {
  return item.abilities.flatMap((id) => {
    const def = config.traits[id];
    if (!def) return [];
    return [{ ...def, item: item.kind, ...(def.power !== 0 && !def.scalesWith && { scalesWith: [item.stat] }) }];
  });
}

/**
 * What an item is worth to this character, in Combat Power: its power scaled by the stat they
 * use it with, plus its abilities. What the Keep/Take choice compares, before multipliers.
 */
export function itemCP(item: GearItem | null, char: Character, config: Pick<GameConfig, 'traits'>): number {
  if (!item) return 0;
  if (item.kind === 'weapon' && char.rules?.noWeapon) return 0;
  const perPoint = item.kind === 'weapon' ? WEAPON_TIER_CP : ARMOR_TIER_CP;
  const base = item.power * perPoint * statScale(char.stats[gearStat(item, char)]);
  const abilities = abilityTraits(item, config).reduce((sum, t) => sum + traitPower(t, char), 0);
  return Math.round(base + abilities);
}

/**
 * Their traits with the gear abilities rebuilt from what they have equipped: the weapon's, then
 * the armour's (an ability both give counts once). Every other trait is left as it is.
 */
export function syncGearTraits(char: Character, config: Pick<GameConfig, 'traits'>): Character {
  const own = char.traits.filter((t) => t.item !== 'weapon' && t.item !== 'armor');
  const gear: Trait[] = [];
  const held = char.rules?.noWeapon ? [char.armor] : [char.weapon, char.armor];
  for (const item of held) {
    if (!item) continue;
    for (const trait of abilityTraits(item, config)) {
      if (!gear.some((t) => t.id === trait.id) && !own.some((t) => t.id === trait.id)) gear.push(trait);
    }
  }
  return { ...char, traits: [...own, ...gear] };
}

/** Put an item in its slot (or empty the slot, with null), abilities and all. What was there is gone. */
export function equip(char: Character, kind: GearKind, item: GearItem | null, config: Pick<GameConfig, 'traits'>): Character {
  if (item && item.kind !== kind) throw new Error(`A ${item.kind} can't go in the ${kind} slot.`);
  return syncGearTraits({ ...char, [kind]: item }, config);
}

/**
 * Hand an item to a character. An empty slot takes it at once. A filled one has it offered:
 * it waits in `gearOffers` for the player to keep what they have or take it. Never offered:
 * the very item they hold, a second copy of a unique they hold, and a weapon for a soul who
 * can't hold one.
 */
export function offerGear(char: Character, item: GearItem, config: Pick<GameConfig, 'traits'>): Character {
  if (item.kind === 'weapon' && char.rules?.noWeapon) return char;
  const current = slotOf(char, item.kind);
  if (current && (current.id === item.id || (item.uniqueId !== undefined && current.uniqueId === item.uniqueId))) return char;
  if ((char.gearOffers ?? []).some((o) => o.id === item.id)) return char;
  if (!current) return equip(char, item.kind, item, config);
  return { ...char, gearOffers: [...(char.gearOffers ?? []), item] };
}

/** The offer the player is deciding on now, if any. */
export const pendingOffer = (char: Pick<Character, 'gearOffers'>): GearItem | undefined => char.gearOffers?.[0];

/** True when taking the offer would make them stronger than keeping what they have. */
export function offerIsBetter(char: Character, offer: GearItem, config: Pick<GameConfig, 'traits'>): boolean {
  return itemCP(offer, char, config) > itemCP(slotOf(char, offer.kind), char, config);
}

/**
 * The player's decision on the oldest offer: keep what they have (the offer is left behind)
 * or take it (what they had is left behind). Returns the character and a line for the record.
 */
export function chooseGear(char: Character, take: boolean, config: Pick<GameConfig, 'traits'>): { character: Character; note: string } {
  const offer = pendingOffer(char);
  if (!offer) return { character: char, note: '' };
  const rest = (char.gearOffers ?? []).slice(1);
  const current = slotOf(char, offer.kind);
  const { gearOffers: _offers, ...without } = char;
  const base: Character = rest.length > 0 ? { ...without, gearOffers: rest } : without;
  if (!take) return { character: base, note: `Kept ${current?.name ?? 'what they had'}; left ${offer.name} behind` };
  return {
    character: equip(base, offer.kind, offer, config),
    note: current ? `Took ${offer.name}; left ${current.name} behind` : `Took ${offer.name}`,
  };
}

/** Every waiting offer decided the way a hero left to themselves would: take it if it is better. */
export function settleGearOffers(char: Character, config: Pick<GameConfig, 'traits'>): { character: Character; notes: string[] } {
  let character = char;
  const notes: string[] = [];
  while (pendingOffer(character)) {
    const decided = chooseGear(character, offerIsBetter(character, pendingOffer(character)!, config), config);
    character = decided.character;
    notes.push(decided.note);
  }
  return { character, notes };
}

/**
 * Temper what is in a slot: its power moves by `delta`, up to 10. Worn to nothing, it breaks and
 * the slot is empty. An empty slot raised is given a plain item of that power instead.
 */
export function temper(char: Character, kind: GearKind, delta: number, config: Pick<GameConfig, 'gear' | 'traits'>): Character {
  if (delta === 0) return char;
  if (kind === 'weapon' && char.rules?.noWeapon) return char;
  const item = slotOf(char, kind);
  if (!item) {
    if (delta < 0) return char;
    const { item: made, char: minted } = mintGear(config, char, kind, { power: clamp(delta, 1, MAX_GEAR_POWER), rarity: 'common' });
    return equip(minted, kind, made, config);
  }
  const power = clamp(item.power + delta, 0, MAX_GEAR_POWER);
  if (power === item.power) return char;
  if (power === 0) return equip(char, kind, null, config);
  return equip(char, kind, { ...item, power, tempered: (item.tempered ?? 0) + (power - item.power) }, config);
}

// ─── Making gear ────────────────────────────────────────────────────────────

export interface GearSpec {
  kind: GearKind;
  /** The power range it is made in; rarity picks within it. */
  power: [number, number];
  rarity?: Rarity;
  bases?: string[];
  damage?: DamageType[];
  foundFrom?: string;
  /** Rarity steps up from what the table would give (a glorious win, a lucky blade). */
  rarityShift?: number;
}

/** The rarities whose power band meets this range. */
function raritiesFor([lo, hi]: [number, number]): Rarity[] {
  return RARITIES.filter((r) => RARITY_POWER[r][0] <= hi && RARITY_POWER[r][1] >= lo);
}

function weightedPick<T>(items: readonly { value: T; weight: number }[], rng: Rng): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let draw = rng() * total;
  for (const item of items) {
    draw -= item.weight;
    if (draw < 0) return item.value;
  }
  return items.at(-1)!.value;
}

/**
 * A generated item. Rarity first (from the spec, or by drop weight among those that fit its
 * power range, shifted up for luck), then its power within that rarity's band, then a base
 * (half the time one the bearer is good with), abilities by rarity, and a name from all of it.
 */
export function generateGear(gear: GearConfig, spec: GearSpec, rng: Rng, bearer?: Pick<Character, 'stats'>): GearItem {
  const lo = clamp(Math.min(spec.power[0], spec.power[1]), 1, MAX_GEAR_POWER);
  const hi = clamp(Math.max(spec.power[0], spec.power[1]), 1, MAX_GEAR_POWER);
  const fits = raritiesFor([lo, hi]);
  let rarity = spec.rarity ?? weightedPick(fits.map((r) => ({ value: r, weight: RARITY_DROP_WEIGHT[r] })), rng);
  if (spec.rarityShift && !spec.rarity) {
    const shifted = rarityRank(rarity) + spec.rarityShift;
    rarity = fits.filter((r) => rarityRank(r) <= shifted).at(-1) ?? rarity;
  }
  const band = RARITY_POWER[rarity];
  const power = between(clamp(band[0], lo, hi), clamp(band[1], lo, hi), rng);

  const pool = (spec.bases?.length ? spec.bases : Object.keys(gear.bases)).map((id) => gear.bases[id]).filter((b) => b !== undefined && b.kind === spec.kind);
  if (pool.length === 0) throw new Error(`No ${spec.kind} bases to make an item from.`);
  // Half the time, something they are good with: a base whose stat is their best among the pool's.
  const bestStat = bearer ? pool.map((b) => b.stat).reduce((best, s) => (bearer.stats[s] > bearer.stats[best] ? s : best)) : undefined;
  const suited = bestStat ? pool.filter((b) => b.stat === bestStat) : [];
  const base = suited.length > 0 && rng() < 0.5 ? pick(suited, rng) : pick(pool, rng);

  const abilities: typeof gear.abilities = [];
  const open = gear.abilities.filter((a) => (a.kind === 'any' || a.kind === spec.kind) && rarityRank(a.minRarity) <= rarityRank(rarity));
  for (let n = RARITY_ABILITIES[rarity]; n > 0; n--) {
    // At most one prefix and one suffix; past that, any that is left.
    const prefix = abilities.some((a) => a.prefix);
    const suffix = abilities.some((a) => a.suffix);
    const left = open.filter((a) => !abilities.includes(a));
    const named = left.filter((a) => (a.prefix ? !prefix : true) && (a.suffix ? !suffix : true));
    const choices = named.length > 0 ? named : left;
    if (choices.length === 0) break;
    abilities.push(pick(choices, rng));
  }
  const infused = abilities.find((a) => a.infuse)?.infuse;
  const element = infused ?? (spec.damage?.length ? pick(spec.damage, rng) : base.damage);

  const material = gear.materials[clamp(power, 1, gear.materials.length) - 1] ?? '';
  const prefix = abilities.find((a) => a.prefix)?.prefix;
  const suffix = abilities.find((a) => a.suffix)?.suffix;
  const plain = [prefix, material, base.name].filter(Boolean).join(' ') + (suffix ? ` ${suffix}` : '');
  const proper = rarityRank(rarity) >= rarityRank('legendary') && gear.legendNames.length > 0 && rng() < 0.6;
  const name = proper ? `${pick(gear.legendNames, rng)}, ${[material, base.name].filter(Boolean).join(' ')}` : plain;

  return {
    id: createId('gear', rng),
    kind: spec.kind,
    name,
    base: base.id,
    rarity,
    power,
    stat: base.stat,
    ...(spec.kind === 'weapon' ? { damage: element } : { resists: element }),
    abilities: abilities.map((a) => a.trait),
    ...(spec.foundFrom && { foundFrom: spec.foundFrom }),
  };
}

/** A predetermined item, made fresh. */
export function uniqueGear(gear: GearConfig, id: string, foundFrom?: string, rng?: Rng): GearItem {
  const def = gear.uniques[id];
  if (!def) throw new Error(`Unknown unique gear "${id}".`);
  return {
    id: rng ? createId(`gear_${id}`, rng) : `gear_${id}`,
    kind: def.kind,
    name: def.name,
    base: def.base,
    uniqueId: def.id,
    rarity: def.rarity,
    power: def.power,
    stat: def.stat,
    ...(def.damage && { damage: def.damage }),
    ...(def.resists && { resists: def.resists }),
    abilities: [...def.abilities],
    lore: def.lore,
    ...(foundFrom && { foundFrom }),
  };
}

/** The power a grant hands over, when it can be told from the grant alone (a unique: from the gear config). */
export function grantPower(grant: GearGrant, gear?: GearConfig): number | undefined {
  if (typeof grant === 'number') return grant;
  if ('better' in grant) return undefined; // it depends on what they carry
  if ('item' in grant) return grant.item.power;
  if ('unique' in grant) return gear?.uniques[grant.unique]?.power;
  return grant.power;
}

/** A grant made stronger or weaker by `delta` power (a dreamt-up slice): uniques and exact items stay as they are. */
export function shiftGrant(grant: GearGrant, delta: number): GearGrant {
  if (typeof grant === 'number') return clamp(grant + delta, 1, MAX_GEAR_POWER);
  if ('item' in grant || 'unique' in grant) return grant;
  if ('better' in grant) return { ...grant, better: grant.better + delta };
  return { ...grant, power: clamp(grant.power + delta, 1, MAX_GEAR_POWER) };
}

/** The rarity a plain item of this power would be: the most common whose band holds it. */
export function rarityForPower(power: number): Rarity {
  return RARITIES.find((r) => RARITY_POWER[r][0] <= power && power <= RARITY_POWER[r][1]) ?? 'common';
}

/**
 * Make the item a grant describes, for this character. Generated items draw from the
 * character's own gear stream (`gearMinted`), so the same rolls always make the same gear:
 * the returned character has the counter moved on.
 */
export function mintGear(config: Pick<GameConfig, 'gear'>, char: Character, kind: GearKind, grant: GearGrant): { item: GearItem; char: Character } {
  if (typeof grant === 'object' && 'item' in grant) return { item: grant.item, char };
  const n = char.gearMinted ?? 0;
  const rng = seededFrom(`${char.id}:gear:${n}`);
  const next = { ...char, gearMinted: n + 1 };
  const gear = config.gear;
  if (typeof grant === 'object' && 'unique' in grant) {
    if (!gear) throw new Error(`Unique gear "${grant.unique}" needs a gear config.`);
    return { item: { ...uniqueGear(gear, grant.unique, grant.foundFrom), id: `gear_${grant.unique}_${char.id}_${n}` }, char: next };
  }
  // Better than what they carry: a random item that much stronger.
  const spec =
    typeof grant === 'number'
      ? { power: grant }
      : 'better' in grant
        ? { power: (slotOf(char, kind)?.power ?? 0) + grant.better, ...(grant.foundFrom && { foundFrom: grant.foundFrom }) }
        : grant;
  const power = clamp(spec.power, 1, MAX_GEAR_POWER);
  const rarity = 'rarity' in spec && spec.rarity ? spec.rarity : rarityForPower(power);
  if (!gear) {
    const item: GearItem = { id: `gear_${char.id}_${n}`, kind, name: kind === 'weapon' ? 'Weapon' : 'Armour', base: kind, rarity, power, stat: kind === 'weapon' ? 'might' : 'vitality', abilities: [] };
    return { item, char: next };
  }
  const made = generateGear(
    gear,
    {
      kind,
      power: [power, power],
      rarity,
      ...('base' in spec && spec.base && { bases: [spec.base] }),
      ...('damage' in spec && spec.damage && { damage: [spec.damage] }),
      ...('foundFrom' in spec && spec.foundFrom && { foundFrom: spec.foundFrom }),
    },
    rng,
    char,
  );
  const name = 'name' in spec && spec.name ? spec.name : made.name;
  return { item: { ...made, name, power, id: `gear_${char.id}_${n}` }, char: next };
}

/**
 * A character saved before gear was items (schema v9 and older): a weapon and armour tier, and
 * perhaps a named item trait (the Holy Sword, Dragonscale). The trait becomes the unique whose
 * signature ability it is, at the tier they carried; a bare tier becomes a plain item of that
 * power, made from the character's own gear stream so the same save always upgrades the same way.
 */
export function upgradeLegacyGear(char: Character & { weaponTier?: unknown; armorTier?: unknown }, config: Pick<GameConfig, 'gear' | 'traits'>): Character {
  const { weaponTier, armorTier, ...rest } = char;
  if (rest.weapon !== undefined && rest.armor !== undefined && weaponTier === undefined && armorTier === undefined) return rest as Character;
  let next: Character = { ...rest, weapon: rest.weapon ?? null, armor: rest.armor ?? null };
  const tiers: Record<GearKind, number> = {
    weapon: typeof weaponTier === 'number' && Number.isFinite(weaponTier) ? clamp(Math.round(weaponTier), 0, MAX_GEAR_POWER) : 0,
    armor: typeof armorTier === 'number' && Number.isFinite(armorTier) ? clamp(Math.round(armorTier), 0, MAX_GEAR_POWER) : 0,
  };
  for (const kind of ['weapon', 'armor'] as const) {
    if (slotOf(next, kind)) continue;
    const named = next.traits.find((t) => t.item === kind && Object.values(config.gear?.uniques ?? {}).some((u) => u.abilities[0] === t.id));
    const unique = named && Object.values(config.gear!.uniques).find((u) => u.abilities[0] === named.id);
    if (unique) {
      const made = mintGear(config, next, kind, { unique: unique.id });
      next = { ...made.char, [kind]: { ...made.item, power: tiers[kind] > 0 ? tiers[kind] : made.item.power } };
    } else if (tiers[kind] > 0) {
      const made = mintGear(config, next, kind, tiers[kind]);
      next = { ...made.char, [kind]: made.item };
    }
  }
  // The old item traits are the items' abilities now.
  return syncGearTraits({ ...next, traits: next.traits.filter((t) => t.item !== 'weapon' && t.item !== 'armor') }, config);
}

// ─── Loot ───────────────────────────────────────────────────────────────────

/** Every unique someone in the world holds, wears, or was buried with. Only one of each is ever found. */
export function uniquesInWorld(world: World): Set<string> {
  const held = new Set<string>();
  for (const c of [...world.roster, ...world.graveyard, ...world.hallOfFame]) {
    for (const item of [c.weapon, c.armor, ...(c.gearOffers ?? [])]) if (item?.uniqueId) held.add(item.uniqueId);
  }
  return held;
}

/** The most items a Spoils wheel shows, besides "nothing". */
export const MAX_SPOILS = 4;

export interface LootRoll {
  item: GearItem;
  /** Its slice's weight on the Spoils wheel. */
  weight: number;
}

/**
 * Roll a foe's loot table into concrete items for a Spoils wheel: up to `MAX_SPOILS` draws
 * from its entries, each made into an item. Uniques someone already has are left out, as are
 * weapons for a soul who can't hold one. `shift` leans every draw rarer (a glorious win, luck).
 */
export function rollLoot(
  gear: GearConfig,
  table: LootTable,
  rng: Rng,
  bearer: Character,
  { shift = 0, claimed = new Set<string>(), foundFrom }: { shift?: number; claimed?: Set<string>; foundFrom?: string } = {},
): LootRoll[] {
  const entries = table.entries.filter((e) => {
    if (e.weight <= 0) return false;
    const kind = e.kind === 'unique' ? gear.uniques[e.id]?.kind : e.kind;
    if (kind === undefined || (kind === 'weapon' && bearer.rules?.noWeapon)) return false;
    return e.kind !== 'unique' || !claimed.has(e.id);
  });
  const rolls: LootRoll[] = [];
  const seenUniques = new Set<string>();
  for (let draws = 0; draws < MAX_SPOILS && entries.length > 0; draws++) {
    const entry = weightedPick(entries.map((e) => ({ value: e, weight: e.weight })), rng);
    if (entry.kind === 'unique') {
      if (seenUniques.has(entry.id)) continue;
      seenUniques.add(entry.id);
      rolls.push({ item: uniqueGear(gear, entry.id, foundFrom, rng), weight: entry.weight });
      continue;
    }
    const item = generateGear(
      gear,
      { kind: entry.kind, power: entry.power, ...(entry.bases && { bases: entry.bases }), ...(entry.damage && { damage: entry.damage }), ...(foundFrom && { foundFrom }), rarityShift: shift },
      rng,
      bearer,
    );
    rolls.push({ item, weight: entry.weight });
  }
  return rolls;
}

/** How many rarity steps luck leans their loot: their gear's `lootLuck`, plus one for a glorious win. */
export function lootShift(char: Character, glorious: boolean): number {
  return char.traits.reduce((sum, t) => sum + (t.lootLuck ?? 0), 0) + (glorious ? 1 : 0);
}

/** Fights earn this much more fame for them: the sum of their traits' `fameBonus`. */
export function fameBonus(char: Pick<Character, 'traits'>): number {
  return char.traits.reduce((sum, t) => sum + (t.fameBonus ?? 0), 0);
}
