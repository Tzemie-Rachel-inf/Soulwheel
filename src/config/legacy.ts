/**
 * Legacies: what heroes leave behind, and how the ones who come after meet it.
 *
 * Past characters, met on purpose or by chance:
 *
 *   Seek Out an Old Face (crossroads) ─┬─ A Grave ──▶ pay respects, hear a last lesson, rob it, raise it, bring them back
 *      (or chance meetings on the road) ├─ A Rival Hero ──▶ spar, swear brotherhood, duel, rob, betray
 *                                       ├─ A Legend in Retirement ──▶ (the Old Legend wheel) learn, duel, rob, murder
 *                                       ├─ The Townsfolk ──▶ trade on what they do now (a smith reforges, a bard sings)
 *                                       ├─ A Ruler ──▶ fealty, a knighthood, a commission, a dungeon, a coup
 *                                       ├─ A General ──▶ serve, learn tactics, desert, be promoted
 *                                       ├─ A Martyr's Shrine ──▶ pray, take their blessing, loot the shrine
 *                                       └─ A Relic With a Name ──▶ claim the sealed soul's power, free them, or be possessed
 *
 * Items change hands (`Trait.item`): the dead can be robbed, the living stolen from or killed
 * for what they carry, a legend can hand down their arms. Gear goes to whoever has the better.
 *
 * Endings, now that no wheel asks "retire?" after every road. Fame decides when they come:
 *
 *   Destiny Calls (crossroads, Renowned+) ──▶ not yet │ retire │ mentor │ general │ a throne │ the last stand │ bound to a relic
 *   A Legendary Challenge (crossroads, Famous+) ──▶ storm the Abyss │ the Great War │ the Primordial Wyrm │ an empty throne │
 *                                                   the Breach │ the Soul Reliquary │ the greatest living legend │ the Titan
 *
 * Mentors, generals and rulers stay in the world as NPCs, and other heroes meet them. A
 * martyr's grave becomes a shrine. A soul bound to a relic waits, sealed, for someone to find it.
 */
import { calculatePowerRating } from '../engine/power';
import type { CastSpoils, Character, GearItem, Trait, WheelOption, WheelStep, World } from '../engine/types';
import { UNIQUE_GEAR } from './gear/uniques';
import {
  FOES,
  IRON_WILL_SAVES,
  couldKneel,
  couldTurnOutlaw,
  darkChampions,
  deathCheatReason,
  demonLords,
  fightWheel,
  generals,
  graves,
  greatestLegends,
  hasTrait,
  isOneOf,
  isUncorruptable,
  martyrs,
  outlaws,
  retiredLegends,
  rivals,
  rulers,
  sealedSouls,
  townsfolk,
} from './common';
import { POWER_TRAITS, POWER_WHEELS } from './powers';
import { holyRefusal, refusedByHolyPlaces } from './stakes';
import { RENOWN, renownAtLeast } from './renown';

// ─── Traits ─────────────────────────────────────────────────────────────────

interface Throne {
  id: string;
  place: string;
  title: string;
  weight: number;
  rarity: WheelOption['rarity'];
  /** One ruler at a time. */
  unique: boolean;
  color: string;
  icon: string;
}

/** The places a hero can come to rule. Each throne holds one ruler at a time (but anyone can carve out a frontier realm). */
const THRONES: Throne[] = [
  { id: 'frontier', place: 'a Frontier Realm', title: 'Lord of the Frontier', weight: 30, rarity: 'common', unique: false, color: '#7d8a6a', icon: 'Tent' },
  { id: 'ironhold', place: 'Ironhold', title: 'Thane of Ironhold', weight: 14, rarity: 'common', unique: true, color: '#8a6a4a', icon: 'Mountain' },
  { id: 'greenwood', place: 'the Greenwood', title: 'Warden-King of the Greenwood', weight: 14, rarity: 'common', unique: true, color: '#3f7a4a', icon: 'Trees' },
  { id: 'port_vael', place: 'Port Vael', title: 'Prince of Port Vael', weight: 14, rarity: 'common', unique: true, color: '#3f7ab8', icon: 'WavesHorizontal' },
  { id: 'northern_marches', place: 'the Northern Marches', title: 'Margrave of the Northern Marches', weight: 10, rarity: 'uncommon', unique: true, color: '#6a8ac0', icon: 'Snowflake' },
  { id: 'sunspire', place: 'Sunspire', title: 'Sultan of Sunspire', weight: 10, rarity: 'uncommon', unique: true, color: '#d9a400', icon: 'Sun' },
  { id: 'ashen_wastes', place: 'the Ashen Wastes', title: 'Warlord of the Ashen Wastes', weight: 8, rarity: 'uncommon', unique: true, color: '#7a3a2e', icon: 'Flame' },
  { id: 'skyreach', place: 'Skyreach', title: 'High Lord of Skyreach', weight: 4, rarity: 'rare', unique: true, color: '#8abaf0', icon: 'Castle' },
];

export const LEGACY_TRAITS: Record<string, Trait> = Object.fromEntries(
  ([
    // Lives after adventuring: these mark an NPC's new life, like a twist of fate's profession
    { id: 'legacy_mentor', name: 'Mentor of Heroes', description: 'Teaches the next generation what the road taught them.', power: 20 },
    { id: 'legacy_general', name: 'General of the Realm', description: 'When they say march, armies march.', power: 70 },
    ...THRONES.map((t): Trait => ({ id: `ruler_${t.id}`, name: `Ruler of ${t.place}`, description: 'A throne, a court, and a guard at their back.', power: 80 })),
    // Bonds and deeds
    { id: 'blood_brother', name: 'Sworn Brother-in-Arms', description: 'Another hero, sworn to them in blood.', power: 25 },
    { id: 'demon_slayer', name: 'Slayer of the Demon Lord', description: 'Ended the long night.', power: 150 },
    { id: 'wyrm_slayer', name: 'Wyrm-Slayer', description: 'Killed the first dragon, the one the others are afraid of.', power: 120 },
    { id: 'wyrmscale', name: 'Wyrmscale', description: 'Armour cut from the Primordial Wyrm’s hide.', power: 90, item: 'armor' },
    { id: 'titanslayer', name: 'Titanslayer', description: 'Brought down a mountain that walked.', power: 200 },
    { id: 'breach_warden', name: 'Warden of the Breach', description: 'The rift remembers who closed it.', power: 60 },
    { id: 'reliquary_shard', name: 'Shard of the Reliquary', description: 'A sliver of a soul-eating relic. It hums with stolen strength.', power: 70, item: 'relic' },
    { id: 'reliquary_breaker', name: 'Breaker of the Reliquary', description: 'Set a thousand trapped souls free.', power: 50 },
  ] satisfies Trait[]).map((t) => [t.id, t]),
);

// ─── Taking, teaching, and relics ───────────────────────────────────────────

/** Relics no one can take. (The Holy Sword is one of the gear uniques marked `untakeable`: it chooses its bearer.) */
const UNTAKEABLE = new Set(['holy_sword']);
/** The relics a character carries that can change hands. Weapons and armour are gear: see `takeableGear`. */
export const carriedItems = (char: Character) => char.traits.filter((t) => t.item === 'relic' && !UNTAKEABLE.has(t.id));
/** Their weapon or armour, if it can change hands (the Holy Sword will not serve a thief). */
export const takeableGear = (item: GearItem | null): GearItem | null =>
  item && !(item.uniqueId && (UNIQUE_GEAR[item.uniqueId]?.untakeable || UNTAKEABLE.has(item.uniqueId))) ? item : null;

const firstName = (char: Character) => char.name.split(' ')[0] || 'Someone';
const listing = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

/** An item's description, with where it came from: only the latest hand is remembered. */
const PROVENANCE = / (Taken from|Handed down by|Won from) [^.]+\.$/;
const handed = (item: Trait, how: string, from: Character): Trait => ({
  ...item,
  description: `${item.description.replace(PROVENANCE, '')} ${how} ${from.name}.`,
});

/** An item as it changes hands: only the latest hand is remembered. */
const handedGear = (item: GearItem, how: string, from: Character): GearItem => ({ ...item, foundFrom: `${how} ${from.name}` });

/**
 * What changes hands when `kinds` of gear go from `from` to `to`: their weapon and armour (offered:
 * the hero keeps their own or takes it), and every relic, if relics go too.
 */
function transfer(from: Character, to: Character, kinds: readonly ('weapon' | 'armor' | 'relic')[], how: string, verb: string): CastSpoils {
  const items = kinds.includes('relic') ? carriedItems(from) : [];
  const gained = items.filter((t) => !hasTrait(to, t.id));
  const weapon = kinds.includes('weapon') ? takeableGear(from.weapon) : null;
  const armor = kinds.includes('armor') ? takeableGear(from.armor) : null;
  const parts = [...gained.map((t) => t.name), ...(weapon ? [weapon.name] : []), ...(armor ? [armor.name] : [])];
  return {
    traits: gained.map((t) => handed(t, how, from)),
    ...(weapon && { weapon: handedGear(weapon, how, from) }),
    ...(armor && { armor: handedGear(armor, how, from) }),
    effect: {
      ...(weapon && { weapon: null }),
      ...(armor && { armor: null }),
      ...(items.length > 0 && { loseTraits: items.map((t) => t.id) }),
    },
    summary:
      parts.length > 0 ? `${verb} ${listing(parts)} from ${from.name}` : `${from.name} carried nothing worth taking`,
  };
}

/** Everything they carry: weapon and armour (if better), and every item. For the dead, the robbed and the murdered. */
export const takeEverything = (cast: Character, hero: Character): CastSpoils =>
  transfer(cast, hero, ['weapon', 'armor', 'relic'], 'Taken from', 'Took');
/** Their arms, handed down: weapon and armour, and the items among them. */
export const handDownArms = (cast: Character, hero: Character): CastSpoils =>
  transfer(cast, hero, ['weapon', 'armor'], 'Handed down by', 'Received');
/** Their weapon, won in a duel. */
export const winTheirBlade = (cast: Character, hero: Character): CastSpoils =>
  transfer(cast, hero, ['weapon'], 'Won from', 'Won');

/** Traits that are techniques, which a teacher can pass on: skills, spells, and a few fighting arts. */
const TEACHABLE = new Set(['blademaster', 'shadowstep', 'arcane_savant', 'duelist', 'true_name', 'dragon_taught']);
const isTeachable = (t: Trait) =>
  !t.item && !t.multiplier && (t.id.startsWith('skill_') || TEACHABLE.has(t.id) || t.id in POWER_TRAITS);

/**
 * Their best technique the hero doesn't know: a skill, a spell, a fighting art. A student never
 * quite matches the master: it comes at three quarters of the teacher's power.
 */
export function learnTechnique(cast: Character, hero: Character): CastSpoils {
  const lesson = cast.traits.filter((t) => isTeachable(t) && !hasTrait(hero, t.id)).sort((a, b) => b.power - a.power)[0];
  if (!lesson) return { summary: `${cast.name} had nothing left to teach them that they didn’t already know` };
  const taught: Trait = { ...lesson, power: Math.round(lesson.power * 0.75), rank: `Taught by ${firstName(cast)}` };
  return { traits: [taught], summary: `Learned ${lesson.name} from ${cast.name}` };
}

/** A legend names their successor: their arms (where better) and their best technique, together. */
export function passTheTorch(cast: Character, hero: Character): CastSpoils {
  const arms = handDownArms(cast, hero);
  const art = learnTechnique(cast, hero);
  return {
    traits: [...(arms.traits ?? []), ...(art.traits ?? [])],
    ...(arms.weapon && { weapon: arms.weapon }),
    ...(arms.armor && { armor: arms.armor }),
    ...(arms.effect && { effect: arms.effect }),
    summary: `${cast.name} named them their successor`,
  };
}

const RELIC_KINDS = ['Blade', 'Shield', 'Amulet', 'Crown', 'Ring', 'Lantern', 'Mirror', 'Gauntlet'];

/** The relic a sealed soul is bound into: 'the Lantern of Aldric'. The same soul always gets the same relic. */
export function relicName(char: Character): string {
  const hash = [...char.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0);
  return `the ${RELIC_KINDS[Math.abs(hash) % RELIC_KINDS.length]} of ${firstName(char)}`;
}

/** Carry off a sealed soul's relic: their spirit fights for whoever holds it, at a quarter of their power. */
export function claimSoulRelic(cast: Character): CastSpoils {
  const name = relicName(cast);
  const relic: Trait = {
    id: `soulbound_${cast.id}`,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    description: `${cast.name}’s spirit is bound inside, and fights for whoever carries it.`,
    power: Math.max(20, Math.round(calculatePowerRating(cast) / 4)),
    item: 'relic',
  };
  return { traits: [relic], effect: { addTags: ['claimed'] }, summary: `Carried off ${name}` };
}

/** A martyr's blessing: something of them watches over whoever prays at their shrine. */
export function martyrBlessing(cast: Character): CastSpoils {
  const blessing: Trait = {
    id: `blessing_${cast.id}`,
    name: `Blessing of ${firstName(cast)}`,
    description: `${cast.name} gave their life for others. Something of them still watches.`,
    power: 30,
  };
  return { traits: [blessing], summary: `Received the blessing of ${cast.name}` };
}

// ─── Small helpers ──────────────────────────────────────────────────────────

const someone = (pool: (world: World, char: Character) => Character[], reason: string): Pick<WheelOption, 'condition' | 'lockedReason'> => ({
  condition: (world, char) => pool(world, char).length > 0,
  lockedReason: reason,
});
const profession = (traitId: string) => (cast: Character) => hasTrait(cast, traitId);
const notHonourable: Pick<WheelOption, 'condition' | 'lockedReason'> = {
  condition: (_world, char) => char.personality !== 'honorable',
  lockedReason: 'Honour forbids it',
};
const outlawHearted: Pick<WheelOption, 'condition' | 'lockedReason'> = {
  condition: couldTurnOutlaw,
  lockedReason: (_world, char) => (char.personality === 'honorable' ? 'Honour forbids it' : 'Not the kind to steal'),
};
const darkHearted: Pick<WheelOption, 'condition' | 'lockedReason'> = {
  condition: couldKneel,
  lockedReason: (_world, char) => (char.personality === 'honorable' ? 'Honour forbids it' : 'Their heart is not that dark'),
};
const murder = { castEffect: { setStatus: 'fallen' as const, fallenBy: 'Murdered by' }, grantTags: ['kinslayer'], spoils: takeEverything };

// ─── Seeking out an old face ────────────────────────────────────────────────

const OLD_FACES: WheelStep = {
  id: 'old_faces',
  title: 'Who Do You Look For?',
  subtitle: 'Someone from the old stories. Living, dead, or somewhere in between.',
  options: [
    { id: 'no_one', label: 'Nobody Where You Left Them', description: 'The faces have moved on. The road hasn’t.', baseWeight: 26, rarity: 'common', nextStepId: 'road', color: '#7d8a6a', icon: 'Footprints' },
    { ...someone(graves, 'No hero lies in the graveyard yet'), id: 'visit_grave', label: 'A Grave You Know', description: 'Someone who did not come home.', baseWeight: 22, rarity: 'common', nextStepId: 'grave', color: '#5a6478', icon: 'Skull' },
    { ...someone(rivals, 'No other hero walks the world'), id: 'rival_hero', label: 'A Rival Hero', description: 'Another legend in the making. Friend, foe, or both.', baseWeight: 20, rarity: 'common', nextStepId: 'rival', color: '#4f86b8', icon: 'Swords' },
    { ...someone(retiredLegends, 'No hero has retired yet'), id: 'call_on_legend', label: 'A Legend in Retirement', description: 'They swore they were done with all this.', baseWeight: 18, rarity: 'common', nextStepId: 'legend', color: '#c9a24c', icon: 'Medal' },
    { ...someone(townsfolk, 'No hero has settled down yet'), id: 'settled_down', label: 'Someone Who Settled Down', description: 'An old hero with a shop, a forge or a pulpit now.', baseWeight: 14, rarity: 'uncommon', nextStepId: 'townsfolk', color: '#3f8a7a', icon: 'Store' },
    { ...someone(rulers, 'No hero rules anywhere yet'), id: 'seek_audience', label: 'An Audience With a Ruler', description: 'An old adventurer, on a throne now.', baseWeight: 12, rarity: 'uncommon', nextStepId: 'ruler_audience', color: '#ffb84d', icon: 'Crown' },
    { ...someone(outlaws, 'No hero has turned outlaw yet'), id: 'outlaw_trail', label: 'An Outlaw’s Trail', description: 'A hero gone bad. Time someone caught up with them.', baseWeight: 10, rarity: 'uncommon', nextStepId: 'fight_outlaw', color: '#5a4a3a', icon: 'UserX' },
    { ...someone(generals, 'No hero commands an army yet'), id: 'report_to_general', label: 'Report to a General', description: 'An old hero with an army, and a use for one more sword.', baseWeight: 10, rarity: 'uncommon', nextStepId: 'general_summons', color: '#8a2e2e', icon: 'Flag' },
    { ...someone(martyrs, 'No hero has given their life for others yet'), id: 'martyr_shrine', label: 'A Martyr’s Shrine', description: 'Candles, flowers, and a name carved deep.', baseWeight: 8, rarity: 'uncommon', nextStepId: 'martyr_shrine', color: '#f0d8a0', icon: 'Sunrise' },
    { ...someone(darkChampions, 'No hero has sworn to the Demon Lord yet'), id: 'fallen_friend', label: 'A Friend in Black Armour', description: 'They knelt to the Demon Lord. Maybe they can be reached.', baseWeight: 8, rarity: 'uncommon', nextStepId: 'fight_champion', color: '#6e1f1f', icon: 'Flame' },
    {
      ...someone(graves, 'No hero lies in the graveyard yet'),
      id: 'ghost_who_remembers',
      label: 'A Ghost Who Remembers Them',
      description: 'They went looking for someone, and someone dead came looking for them. It stays, and teaches.',
      baseWeight: 3,
      rarity: 'epic',
      grantTraits: ['ancestral_echoes'],
      statModifiers: { intellect: 2, arcana: 2 },
      epithet: { text: 'Voice of the Fallen', priority: 40 },
      nextStepId: null,
      color: '#9ac0e0',
      icon: 'Ghost',
    },
    { ...someone(sealedSouls, 'No soul has been bound to a relic yet'), id: 'lost_relic', label: 'A Relic With a Name', description: 'An old story about a hero who never died, only went inside something.', baseWeight: 6, rarity: 'rare', nextStepId: 'soul_relic', color: '#9a7ad0', icon: 'Gem' },
  ],
};

const GRAVE: WheelStep = {
  id: 'grave',
  title: 'A Hero’s Grave',
  subtitle: 'Moss on the stone, and a name you know.',
  cast: { from: graves },
  options: [
    { id: 'pay_respects', label: 'Paid Their Respects', description: 'A few words, a flower, a promise. The dead are generous.', baseWeight: 30, rarity: 'common', luckDelta: 0.25, nextStepId: null, color: '#5a6478', icon: 'Flower' },
    { id: 'last_words', label: 'Heard Their Last Lesson', description: 'A voice from under the stone, with one thing left to teach.', baseWeight: 16, rarity: 'uncommon', statModifiers: { intellect: 1 }, spoils: learnTechnique, nextStepId: null, color: '#6a8ac0', icon: 'Ghost' },
    { ...notHonourable, id: 'took_their_gear', label: 'Took Their Gear', description: 'They won’t need it. Somebody should.', baseWeight: 14, rarity: 'uncommon', spoils: takeEverything, fame: -2, meters: { notoriety: 1 }, nextStepId: null, color: '#7a6a4f', icon: 'Shovel' },
    { id: 'haunted_by_them', label: 'Haunted', description: 'They followed them home, and stayed.', baseWeight: 12, rarity: 'uncommon', statModifiers: { vitality: -1, arcana: 1 }, grantTags: ['haunted'], nextStepId: null, color: '#3c5a6e', icon: 'Ghost' },
    {
      id: 'raised_them',
      label: 'Raised Them',
      description: 'They rise, wrong-eyed, and walk off to join the Demon Lord’s dead.',
      baseWeight: 6,
      rarity: 'rare',
      requiresTrait: ['raise_dead', 'lich_phylactery', 'phylactery_spark', 'domain_death', 'lord_of_the_underworld'],
      castEffect: { setStatus: 'alive', setRole: 'minion' },
      grantTags: ['necromancer'],
      fame: -5,
      nextStepId: null,
      color: '#2f5a4a',
      icon: 'Bone',
    },
    {
      id: 'desecrated',
      label: 'Desecrated the Grave',
      description: 'Dug up, picked clean, and the bones left for the crows.',
      baseWeight: 5,
      rarity: 'rare',
      condition: (_world, char) => isOneOf(char, ['cruel']),
      lockedReason: 'Only the cruel would do this',
      spoils: takeEverything,
      grantTags: ['cursed'],
      luckDelta: -0.5,
      fame: -6,
      meters: { notoriety: 2 },
      nextStepId: null,
      color: '#4a2a2a',
      icon: 'Skull',
    },
    {
      id: 'brought_back',
      label: 'Brought Them Back',
      description: 'A word, a light, a gasp. They walk out of the graveyard a hero again.',
      baseWeight: 3,
      rarity: 'epic',
      requiresTrait: ['resurrection', 'miracle', 'domain_life', 'wish'],
      castEffect: { setStatus: 'alive', setRole: 'hero' },
      fame: 20,
      epithet: { text: 'the Life-Giver', priority: 58 },
      nextStepId: null,
      color: '#ffcf6a',
      icon: 'Sunrise',
    },
  ],
};

const MARTYR_SHRINE: WheelStep = {
  id: 'martyr_shrine',
  title: 'A Martyr’s Shrine',
  subtitle: 'They gave their life so others could keep theirs.',
  cast: { from: martyrs },
  options: [
    { id: 'prayed', label: 'Prayed at the Shrine', description: 'Quiet, candlelight, and the feeling of being watched over.', baseWeight: 34, rarity: 'common', luckDelta: 0.5, statModifiers: { vitality: 1 }, nextStepId: null, color: '#f0d8a0', icon: 'Church' },
    { id: 'their_blessing', label: 'Their Blessing', description: 'Something of them went with the hero when they left.', baseWeight: 16, rarity: 'uncommon', spoils: martyrBlessing, nextStepId: null, color: '#ffd76a', icon: 'HandHeart' },
    { id: 'a_vision', label: 'A Vision', description: 'Light, a voice, and a gift.', baseWeight: 6, rarity: 'rare', condition: refusedByHolyPlaces, lockedReason: holyRefusal, nextStepId: POWER_WHEELS.blessed, color: '#fff4c2', icon: 'Sun' },
    { id: 'martyr_speaks', label: 'The Martyr Speaks', description: 'Out loud, in the candlelight. They chose the hero to carry on what they died for.', baseWeight: 4, rarity: 'epic', spoils: martyrBlessing, luckDelta: 1, epithet: { text: 'Chosen of the Martyr', priority: 50 }, nextStepId: null, color: '#ffe8a8', icon: 'Sunrise' },
    { ...outlawHearted, id: 'looted_the_shrine', label: 'Looted the Shrine', description: 'The relics on the altar were real. So is the curse.', baseWeight: 5, rarity: 'rare', spoils: takeEverything, luckDelta: -0.5, fame: -5, meters: { notoriety: 2 }, nextStepId: null, color: '#5a4a3a', icon: 'Coins' },
  ],
};

// ─── Rivals ─────────────────────────────────────────────────────────────────

const RIVAL: WheelStep = {
  id: 'rival',
  title: 'A Rival Hero',
  subtitle: 'Two legends, one road. Something has to give.',
  cast: { from: rivals },
  options: [
    { id: 'sparred', label: 'Sparred', description: 'Friendly. Mostly. Both walked away better.', baseWeight: 30, rarity: 'common', statModifiers: { might: 1, agility: 1 }, nextStepId: null, color: '#4f86b8', icon: 'Swords' },
    { id: 'duel_for_pride', label: 'A Duel for Pride', description: 'Steel, a crowd, and only one of them walks off the winner.', baseWeight: 22, rarity: 'common', nextStepId: 'fight_rival', color: '#a35d3a', icon: 'Swords' },
    {
      id: 'swore_brotherhood',
      label: 'Swore Brotherhood',
      description: 'A cut palm, a clasp, an oath. Each will come if the other calls.',
      baseWeight: 16,
      rarity: 'uncommon',
      grantTraits: ['blood_brother'],
      castEffect: { gainTraits: [LEGACY_TRAITS['blood_brother']!] },
      condition: (_world, char) => !hasTrait(char, 'blood_brother'),
      lockedReason: 'Already sworn to another',
      nextStepId: null,
      color: '#9a3a3a',
      icon: 'Handshake',
    },
    { id: 'hunted_together', label: 'Hunted Together', description: 'Two blades on one beast. The bards will argue about who struck the blow.', baseWeight: 12, rarity: 'uncommon', luckDelta: 0.25, castEffect: { fame: 3 }, nextStepId: 'lairs', color: '#5b3f6e', icon: 'Crosshair' },
    { id: 'friendship_for_songs', label: 'A Friendship for the Songs', description: 'They argued all night and rode out together at dawn. The other hero knelt: "Lead, and I follow."', baseWeight: 4, rarity: 'epic', grantTraits: ['sworn_rival'], castEffect: { fame: 5 }, epithet: { text: 'First Among Heroes', priority: 55 }, nextStepId: null, color: '#ffd76a', icon: 'Users' },
    { ...outlawHearted, id: 'stole_their_gear', label: 'Stole Their Gear', description: 'While they slept. Everything worth carrying.', baseWeight: 10, rarity: 'uncommon', spoils: takeEverything, grantTags: ['thief'], fame: -4, meters: { notoriety: 1 }, nextStepId: null, color: '#5a4a3a', icon: 'EyeOff' },
    {
      ...darkHearted,
      ...murder,
      id: 'betrayed',
      label: 'Betrayed and Murdered Them',
      description: 'A knife in the back, and everything they carried.',
      baseWeight: 5,
      rarity: 'rare',
      fame: -10,
      meters: { notoriety: 3 },
      epithet: { text: 'the Kinslayer', priority: 46 },
      nextStepId: null,
      color: '#6e1f2a',
      icon: 'Skull',
    },
  ],
};

// ─── Townsfolk: heroes who settled down ─────────────────────────────────────

/** What a settled hero can do for a visitor, by what they do now. Dealt only for that profession. */
const TRADE: [traitId: string, option: Omit<WheelOption, 'baseWeight' | 'rarity' | 'castCondition' | 'nextStepId'> & Partial<Pick<WheelOption, 'nextStepId'>>][] = [
  ['npc_blacksmith', { id: 'reforged', label: 'Reforged Their Gear', description: 'An old hero’s hands on a new hero’s blade and mail.', weaponTierDelta: 1, upgrade: true, armorTierDelta: 1, color: '#7a4a3a', icon: 'Anvil' }],
  ['npc_shopkeeper', { id: 'back_room', label: 'The Back Room', description: 'Not for sale to just anyone: armour from their own adventuring days.', armorTierDelta: 2, color: '#8a7a52', icon: 'Store' }],
  ['npc_innkeeper', { id: 'rumour', label: 'A Rumour Over Ale', description: 'About a chest nobody has found yet.', nextStepId: 'treasure', color: '#b8862e', icon: 'Beer' }],
  ['npc_farmer', { id: 'hospitality', label: 'A Hot Meal and a Warm Bed', description: 'The best night’s sleep in a year.', statModifiers: { vitality: 2 }, color: '#8ac46a', icon: 'Wheat' }],
  ['npc_elder', { id: 'old_tales', label: 'The Old Tales', description: 'How the last generation did it, and where they went wrong.', statModifiers: { intellect: 2 }, luckDelta: 0.25, color: '#a08a5a', icon: 'ScrollText' }],
  ['npc_bard', { id: 'their_song', label: 'A Song of Their Deeds', description: 'Sung in every tavern by the end of the month.', fame: 12, color: '#c0569a', icon: 'Music' }],
  ['npc_court_wizard', { id: 'tower_lesson', label: 'A Lesson in the Tower', description: 'A spell, taught by someone who used to throw them at dragons.', nextStepId: POWER_WHEELS.arcane, color: '#5a5ad0', icon: 'WandSparkles' }],
  ['npc_high_priest', { id: 'altar_blessing', label: 'Blessed at the Altar', description: 'The gods listen to this one.', luckDelta: 0.5, statModifiers: { vitality: 1 }, color: '#d9c27a', icon: 'Church' }],
  ['npc_guildmaster', { id: 'guild_contract', label: 'A Guild Contract', description: 'Good pay, better gear, and no questions.', weaponTierDelta: 1, armorTierDelta: 1, luckDelta: 0.25, color: '#b8962e', icon: 'Coins' }],
  ['npc_monarch', { id: 'royal_favour', label: 'Royal Favour', description: 'A knighthood, a suit of royal armour, and the realm watching.', armorTierDelta: 2, fame: 10, epithet: { text: 'Knight of the Realm', priority: 48 }, color: '#ffb84d', icon: 'Crown' }],
  ['legacy_mentor', { id: 'one_more_lesson', label: 'One More Lesson', description: 'They never stopped teaching. They just stopped travelling.', spoils: learnTechnique, color: '#c9a24c', icon: 'GraduationCap' }],
];

const TOWNSFOLK: WheelStep = {
  id: 'townsfolk',
  title: 'An Old Hero, Settled Down',
  subtitle: 'They hung up the sword for a quieter life. What can they do for you?',
  cast: { from: townsfolk },
  options: [
    { id: 'swapped_stories', label: 'A Ruin Nobody Mapped', description: 'Over a drink, they mentioned a ruin they never got round to. It goes on the map, and the hero goes.', baseWeight: 30, rarity: 'common', statModifiers: { intellect: 1 }, place: { discover: 'ruin' }, nextStepId: 'ruins', color: '#3f8a7a', icon: 'Beer' },
    { id: 'one_last_adventure', label: 'One Last Adventure', description: 'They took the old sword off the wall. Not to come with you: to go on their own. A hero of the world again.', baseWeight: 4, rarity: 'epic', castEffect: { setRole: 'hero' }, fame: 5, luckDelta: 0.5, nextStepId: null, color: '#ffd76a', icon: 'Sword' },
    ...TRADE.map(([traitId, option]): WheelOption => ({ nextStepId: null, ...option, baseWeight: 22, rarity: 'common', castCondition: profession(traitId) })),
    { ...outlawHearted, id: 'robbed_them', label: 'Robbed Them', description: 'Their old adventuring gear was hanging on the wall.', baseWeight: 12, rarity: 'uncommon', spoils: takeEverything, fame: -3, meters: { notoriety: 1 }, nextStepId: null, color: '#5a4a3a', icon: 'EyeOff' },
    { ...darkHearted, ...murder, id: 'murdered_them', label: 'Killed Them for Their Treasure', description: 'Retirement is no protection.', baseWeight: 4, rarity: 'rare', fame: -8, meters: { notoriety: 3 }, nextStepId: null, color: '#6e1f2a', icon: 'Skull' },
  ],
};

// ─── Rulers and generals ────────────────────────────────────────────────────

const RULER_AUDIENCE: WheelStep = {
  id: 'ruler_audience',
  title: 'An Audience',
  subtitle: 'An old adventurer on a throne. They remember what the road was like. Mostly.',
  cast: { from: rulers },
  options: [
    { id: 'swore_fealty', label: 'Swore Fealty', description: 'A knee, an oath, and a royal armourer’s attention.', baseWeight: 26, rarity: 'common', luckDelta: 0.25, armorTierDelta: 1, nextStepId: null, color: '#c9a24c', icon: 'Crown' },
    { id: 'royal_commission', label: 'A Royal Commission', description: 'A sharper sword, and a name on a list to go and deal with.', baseWeight: 24, rarity: 'common', weaponTierDelta: 1, nextStepId: 'hunt', color: '#8a5a3a', icon: 'ScrollText' },
    { id: 'taxed', label: 'Taxed to the Bone', description: 'The crown remembers heroes owe it, too.', baseWeight: 20, rarity: 'common', luckDelta: -0.25, nextStepId: null, color: '#6b7280', icon: 'Coins' },
    { id: 'knighted', label: 'Knighted', description: 'A sword on each shoulder, and armour with the royal crest.', baseWeight: 14, rarity: 'uncommon', armorTierDelta: 2, fame: 8, epithet: { text: 'Knight of the Realm', priority: 48 }, nextStepId: null, color: '#ffd76a', icon: 'Award' },
    { id: 'thrown_in_dungeon', label: 'Thrown in the Dungeon', description: 'For a joke at court. They escaped through the sewers.', baseWeight: 12, rarity: 'uncommon', statModifiers: { vitality: -2, agility: 1 }, nextStepId: null, color: '#3a3a4a', icon: 'Lock' },
    { id: 'champion_of_the_crown', label: 'Named Champion of the Crown', description: 'The crown’s own sword, armour, and the right to speak for it.', baseWeight: 4, rarity: 'epic', grantTraits: ['royal_favor'], armorTierDelta: 2, fame: 15, epithet: { text: 'Champion of the Crown', priority: 60 }, nextStepId: null, color: '#ffd76a', icon: 'Crown' },
    {
      id: 'plotted_coup',
      label: 'Plotted to Overthrow Them',
      description: 'A throne is just a chair someone else is sitting in.',
      baseWeight: 6,
      rarity: 'rare',
      condition: (_world, char) => char.personality !== 'honorable' && isOneOf(char, ['ambitious', 'cruel', 'reckless', 'greedy']),
      lockedReason: 'Only the ambitious, the cruel, the reckless and the greedy plot against a crown',
      nextStepId: 'fight_ruler',
      color: '#7a3e8a',
      icon: 'Swords',
    },
  ],
};

const GENERAL_SUMMONS: WheelStep = {
  id: 'general_summons',
  title: 'The General’s Summons',
  subtitle: 'An old hero with an army now, and a use for one more sword.',
  cast: { from: generals },
  options: [
    { id: 'served', label: 'Served With Distinction', description: 'A hard season under a hard commander.', baseWeight: 30, rarity: 'common', statModifiers: { might: 1, vitality: 1 }, fame: 6, nextStepId: null, color: '#8a2e2e', icon: 'Flag' },
    { id: 'drilled', label: 'Drilled Without Mercy', description: 'Dawn to dusk, until the moves came without thinking.', baseWeight: 24, rarity: 'common', statModifiers: { vitality: 2, agility: 1 }, nextStepId: null, color: '#8a5a3a', icon: 'Dumbbell' },
    { id: 'sent_into_battle', label: 'Sent Into Battle', description: 'The general points. The hero goes.', baseWeight: 16, rarity: 'uncommon', nextStepId: 'fight_war', color: '#6e1f1f', icon: 'Swords' },
    { id: 'learned_tactics', label: 'Learned From the General', description: 'How they won their wars, explained over maps and wine.', baseWeight: 12, rarity: 'uncommon', statModifiers: { intellect: 1 }, spoils: learnTechnique, nextStepId: null, color: '#4f6f8f', icon: 'Map' },
    { ...outlawHearted, id: 'deserted', label: 'Deserted', description: 'Over the wall one night, and into the hills with the bandits.', baseWeight: 10, rarity: 'uncommon', setRole: 'outlaw', fame: -5, nextStepId: null, color: '#4a3a5a', icon: 'UserX' },
    { id: 'army_of_their_own', label: 'Given an Army of Their Own', description: 'A banner, ten thousand soldiers, and the general’s blessing.', baseWeight: 4, rarity: 'epic', grantTraits: ['warlord_banner'], fame: 10, epithet: { text: 'Warlord', priority: 62 }, nextStepId: null, color: '#ffd76a', icon: 'Flag' },
    { id: 'promoted', label: 'Promoted to Captain', description: 'Their own company, their own colours, and the general’s trust.', baseWeight: 6, rarity: 'rare', armorTierDelta: 2, weaponTierDelta: 1, fame: 10, epithet: { text: 'Captain of the Guard', priority: 50 }, nextStepId: null, color: '#c9a24c', icon: 'Medal' },
  ],
};

// ─── Sealed souls ───────────────────────────────────────────────────────────

const SOUL_RELIC: WheelStep = {
  id: 'soul_relic',
  title: 'A Relic With a Name',
  subtitle: 'It is warm to the touch. Something inside it is awake.',
  cast: { from: sealedSouls },
  options: [
    { id: 'left_it', label: 'Left It Where It Lay', description: 'Some doors are better left shut.', baseWeight: 26, rarity: 'common', luckDelta: 0.25, nextStepId: null, color: '#6b7280', icon: 'Ban' },
    { id: 'claimed_it', label: 'Claimed It', description: 'The spirit inside stirs, and decides to fight for its new bearer.', baseWeight: 24, rarity: 'common', spoils: claimSoulRelic, nextStepId: null, color: '#9a7ad0', icon: 'Gem' },
    { id: 'freed_them', label: 'Freed the Soul Inside', description: 'A crack, a light, and an old hero stands blinking in the sun.', baseWeight: 14, rarity: 'uncommon', castEffect: { setStatus: 'alive', setRole: 'hero' }, fame: 15, nextStepId: null, color: '#f0e6c8', icon: 'Sunrise' },
    {
      id: 'possessed',
      label: 'Possessed',
      description: 'The spirit walks out wearing their body. They are the one inside the relic now.',
      baseWeight: 10,
      rarity: 'uncommon',
      condition: (_world, char) => !isUncorruptable(char),
      lockedReason: 'Uncorruptable: no spirit can take them',
      setStatus: 'sealed',
      castEffect: { setStatus: 'alive', setRole: 'hero' },
      fate: 'Possessed by the spirit in a relic, and sealed inside it in its place',
      nextStepId: null,
      color: '#3a2f4f',
      icon: 'Ghost',
    },
    { id: 'merged_with_them', label: 'Merged With the Soul Inside', description: 'Two heroes, one body, and a great deal of arguing. Twice the strength.', baseWeight: 4, rarity: 'epic', spoils: claimSoulRelic, statModifiers: { might: 2, agility: 2, intellect: 2, arcana: 2, vitality: 2 }, epithet: { text: 'Two Souls in One', priority: 60 }, nextStepId: null, color: '#ffd76a', icon: 'Sparkles' },
    { id: 'shattered_it', label: 'Shattered It', description: 'The soul inside sighs, and is finally allowed to die.', baseWeight: 6, rarity: 'rare', castEffect: { setStatus: 'fallen', fallenBy: 'Released into death by' }, luckDelta: 0.25, fame: 5, nextStepId: null, color: '#c8c2b0', icon: 'Unlink' },
  ],
};

// ─── Destiny: how a famous hero's story ends ────────────────────────────────

/** Settles into a new life in the world: still there for other heroes to meet. */
const newLife = (
  traits: string[],
  tag: string,
  epithet: WheelOption['epithet'],
  fate: string,
): Pick<WheelOption, 'setRole' | 'grantTraits' | 'grantTags' | 'epithet' | 'fate'> => ({
  setRole: 'npc',
  grantTraits: traits,
  grantTags: [tag],
  epithet,
  fate,
});

const DESTINY: WheelStep = {
  id: 'destiny',
  title: 'Destiny Calls',
  subtitle: 'Every story ends somewhere. The more famous the hero, the louder the call. This one is their decision.',
  choice: true,
  options: [
    { id: 'not_yet', label: 'Not Yet', description: 'One more road. There is always one more road.', baseWeight: 26, rarity: 'common', fameScaling: -0.12, fame: 2, nextStepId: null, color: '#3f6f9a', icon: 'Route' },
    { id: 'hang_up_the_sword', label: 'Hang Up the Sword', description: 'A quiet house, a loud tavern, and a seat in the Hall of Fame.', baseWeight: 24, rarity: 'common', setStatus: 'retired', fate: 'Hung up the sword, a legend in their own time', nextStepId: null, color: '#c9a24c', icon: 'House' },
    {
      ...newLife(['legacy_mentor'], 'mentor', { text: 'Mentor of Heroes', priority: 80 }, 'Laid down the sword to teach the next generation'),
      id: 'take_an_apprentice',
      label: 'Take an Apprentice',
      description: 'Everything the road taught them, passed on. Other heroes will seek them out.',
      baseWeight: 20,
      rarity: 'common',
      statScaling: { intellect: 0.03 },
      nextStepId: null,
      color: '#5f9a6a',
      icon: 'GraduationCap',
    },
    {
      ...newLife(['legacy_general'], 'general', { text: 'General of the Realm', priority: 84 }, 'Took command of the realm’s armies'),
      id: 'call_to_arms',
      label: 'Answer the Call to Arms',
      description: 'The realm needs a general. The armies need someone to follow.',
      baseWeight: 14,
      rarity: 'uncommon',
      statScaling: { might: 0.03 },
      nextStepId: null,
      color: '#8a2e2e',
      icon: 'Flag',
    },
    { ...renownAtLeast(RENOWN.famous), id: 'claim_a_throne', label: 'Claim a Throne', description: 'Somewhere needs a ruler. Why not a hero?', baseWeight: 8, rarity: 'rare', nextStepId: 'thrones', color: '#ffb84d', icon: 'Crown' },
    {
      id: 'the_last_stand',
      label: 'The Last Stand',
      description: 'A city falls. They hold the gate alone, so everyone else can run.',
      baseWeight: 6,
      rarity: 'rare',
      threatScaling: 0.15,
      setStatus: 'fallen',
      grantTags: ['martyr'],
      epithet: { text: 'the Martyr', priority: 92 },
      fate: 'Held the gate alone, so that a city could flee',
      nextStepId: null,
      color: '#d9688a',
      icon: 'ShieldHalf',
    },
    {
      id: 'bound_to_a_relic',
      label: 'Bound to a Relic',
      description: 'Their soul goes into a blade, a ring, a crown, to fight on in other hands. Someone will find it.',
      baseWeight: 3,
      rarity: 'epic',
      setStatus: 'sealed',
      epithet: { text: 'the Soul-Bound', priority: 76 },
      fate: 'Bound their soul into a relic, to fight on in other hands',
      nextStepId: null,
      color: '#9a7ad0',
      icon: 'Gem',
    },
  ],
};

const THRONES_WHEEL: WheelStep = {
  id: 'thrones',
  title: 'Which Throne?',
  subtitle: 'A crown, a court, and a hero who used to sleep in ditches.',
  options: [
    ...THRONES.map(({ id, place, title, weight, rarity, unique, color, icon }): WheelOption => ({
      ...newLife([`ruler_${id}`], 'ruler', { text: title, priority: 90 }, unique ? `Crowned ${title}` : 'Carved out a realm of their own on the frontier'),
      id,
      label: unique ? place.replace(/^the /, 'The ') : 'A Realm of Their Own',
      description: unique ? `${title}: one ruler at a time, and it is theirs now.` : 'Empty land past the last border. Theirs, if they can hold it.',
      baseWeight: weight,
      rarity,
      ...(unique && { claimSingleton: `throne_${id}`, lockedReason: `${place.charAt(0).toUpperCase()}${place.slice(1)} already has a ruler` }),
      nextStepId: null,
      color,
      icon,
    })),
    {
      ...newLife(['npc_monarch'], 'ruler', { text: 'Monarch of the Realm', priority: 99 }, 'Took the Crown of the Realm'),
      id: 'crown_of_the_realm',
      label: 'The Crown of the Realm',
      description: 'Not a city, not a province. All of it.',
      baseWeight: 1.5,
      rarity: 'legendary',
      claimSingleton: 'monarch',
      lockedReason: 'The realm already has a monarch',
      nextStepId: null,
      color: '#ffe08a',
      icon: 'Crown',
    },
  ],
};

// ─── Legendary challenges (for the Famous) ──────────────────────────────────

const GRAND_CHALLENGE: WheelStep = {
  id: 'grand_challenge',
  title: 'A Legendary Challenge',
  subtitle: 'Only the famous are asked. Not all of them come back.',
  options: [
    { id: 'great_war', label: 'The Great War', description: `Every kingdom at once, against a host ${FOES.greatWar.power} strong.`, baseWeight: 22, rarity: 'common', nextStepId: 'fight_great_war', color: '#8a2e2e', icon: 'Flag' },
    { ...someone(demonLords, 'No Demon Lord reigns to be overthrown'), id: 'storm_the_abyss', label: 'Storm the Abyss', description: 'Down into the dark, to the throne at the bottom, to end it.', baseWeight: 20, rarity: 'common', nextStepId: 'fight_demon_lord', color: '#7f1d1d', icon: 'Flame' },
    { id: 'primordial_wyrm', label: 'The Primordial Wyrm', description: `The first dragon, older than mountains. Power ${FOES.wyrm.power}.`, baseWeight: 14, rarity: 'uncommon', nextStepId: 'fight_wyrm', color: '#b8452a', icon: 'Egg' },
    { id: 'empty_throne', label: 'A Throne Lies Empty', description: `A usurper holds it, with ${FOES.usurper.power} power at their back.`, baseWeight: 14, rarity: 'uncommon', nextStepId: 'fight_usurper', color: '#ffb84d', icon: 'Crown' },
    { id: 'the_breach', label: 'The Breach', description: 'The sky has torn open, and something is pushing through.', baseWeight: 12, rarity: 'uncommon', nextStepId: 'breach', color: '#4c1d95', icon: 'Orbit' },
    { id: 'soul_reliquary', label: 'The Soul Reliquary', description: 'A relic that eats souls, and has been very hungry for a very long time.', baseWeight: 8, rarity: 'rare', nextStepId: 'reliquary', color: '#5a2a6e', icon: 'Gem' },
    { ...someone(greatestLegends, 'No other legend to measure themselves against'), id: 'greatest_legend', label: 'The Greatest Living Legend', description: 'There can only be one greatest. Time to find out who.', baseWeight: 8, rarity: 'rare', nextStepId: 'fight_greatest', color: '#c9a24c', icon: 'Medal' },
    { id: 'titan_wakes', label: 'The Titan Wakes', description: `A mountain stands up. Power ${FOES.titan.power}.`, baseWeight: 4, rarity: 'epic', nextStepId: 'fight_titan', color: '#56648f', icon: 'Mountain' },
  ],
};

const BREACH: WheelStep = {
  id: 'breach',
  title: 'The Breach',
  subtitle: 'A wound in the sky, and the world leaking out of it.',
  options: [
    { id: 'held_the_line', label: 'Held the Line', description: 'Until it closed on its own. Every hour of it hurt.', baseWeight: 30, rarity: 'common', statModifiers: { vitality: -2 }, fame: 15, nextStepId: null, color: '#4f6f8f', icon: 'ShieldHalf' },
    {
      id: 'sealed_with_their_life',
      label: 'Sealed It With Their Life',
      description: 'They stepped into the wound, and it closed behind them.',
      baseWeight: 24,
      rarity: 'common',
      setStatus: 'fallen',
      grantTags: ['martyr'],
      epithet: { text: 'the Martyr', priority: 92 },
      fate: 'Sealed the Breach with their own life',
      nextStepId: null,
      color: '#d9688a',
      icon: 'HeartCrack',
    },
    { id: 'something_comes_through', label: 'Something Comes Through', description: `Teeth first. Power ${FOES.breachHorror.power}.`, baseWeight: 18, rarity: 'uncommon', nextStepId: 'fight_breach_horror', color: '#3a1a2a', icon: 'Skull' },
    { id: 'swallowed', label: 'Swallowed by the Breach', description: 'The sky opened its mouth.', baseWeight: 10, rarity: 'uncommon', threatScaling: 0.15, setStatus: 'fallen', condition: IRON_WILL_SAVES, lockedReason: deathCheatReason, fate: 'Swallowed by the Breach', nextStepId: null, color: '#1a0a2a', icon: 'Orbit' },
    { id: 'walked_between_worlds', label: 'Stepped Through, and Came Back', description: 'A season on the other side, in an hour. They mapped the way, and they are not quite the same.', baseWeight: 4, rarity: 'epic', grantTraits: ['breach_warden', 'skyborn'], place: { discover: 'rift' }, epithet: { text: 'Walker Between Worlds', priority: 74 }, nextStepId: null, color: '#b68be8', icon: 'Orbit' },
    { id: 'sealed_with_magic', statScaling: { arcana: 0.05 }, label: 'Sealed It With Magic', description: 'A spell nobody had cast in an age, stitched across the sky.', baseWeight: 8, rarity: 'rare', statModifiers: { arcana: 3 }, grantTraits: ['breach_warden'], fame: 30, epithet: { text: 'Warden of the Breach', priority: 72 }, nextStepId: null, color: '#8a6ae0', icon: 'WandSparkles' },
  ],
};

const RELIQUARY: WheelStep = {
  id: 'reliquary',
  title: 'The Soul Reliquary',
  subtitle: 'It whispers their name. It has room for one more.',
  options: [
    { id: 'resisted', label: 'Resisted Its Pull', description: 'They walked away. It took a long time.', baseWeight: 30, rarity: 'common', statModifiers: { arcana: 1 }, nextStepId: null, color: '#4f6f8f', icon: 'ShieldCheck' },
    { id: 'took_a_shard', label: 'Took a Shard of It', description: 'A sliver of stolen souls, humming in their pocket.', baseWeight: 18, rarity: 'uncommon', grantTraits: ['reliquary_shard'], grantTags: ['cursed'], nextStepId: null, color: '#5a2a6e', icon: 'Gem' },
    {
      id: 'bound_inside',
      label: 'Bound Inside It',
      description: 'It had room for one more. Someone will find them in there one day.',
      baseWeight: 16,
      rarity: 'uncommon',
      condition: (_world, char) => !isUncorruptable(char),
      lockedReason: 'Uncorruptable: it cannot take hold of them',
      setStatus: 'sealed',
      epithet: { text: 'the Soul-Bound', priority: 76 },
      fate: 'Bound inside the Soul Reliquary',
      nextStepId: null,
      color: '#3a2f4f',
      icon: 'Lock',
    },
    { id: 'soul_torn', label: 'A Piece of Their Soul Torn Away', description: 'It took a bite before they got free.', baseWeight: 14, rarity: 'uncommon', statModifiers: { vitality: -3 }, luckDelta: -0.5, nextStepId: null, color: '#6e1f2a', icon: 'HeartCrack' },
    { id: 'keeper_of_souls', label: 'Mastered It', description: 'It eats souls. Now it eats the souls they point it at.', baseWeight: 4, rarity: 'epic', grantTraits: ['reliquary_shard'], meters: { notoriety: 2 }, epithet: { text: 'Keeper of Souls', priority: 70 }, nextStepId: null, color: '#7a3a8a', icon: 'Gem' },
    { id: 'shattered_the_reliquary', statScaling: { might: 0.02, arcana: 0.02 }, label: 'Shattered It', description: 'A thousand trapped souls went free in one breath.', baseWeight: 8, rarity: 'rare', grantTraits: ['reliquary_breaker'], fame: 25, epithet: { text: 'the Soul-Freer', priority: 66 }, nextStepId: null, color: '#f0e6c8', icon: 'Sparkles' },
  ],
};

// ─── Fights with legacies and legends ───────────────────────────────────────

const LEGACY_FIGHTS: WheelStep[] = [
  fightWheel({
    id: 'fight_rival',
    title: 'A Duel for Pride',
    subtitle: 'Another hero, a crowd, and only one winner.',
    foe: { name: 'A rival hero', power: 300 },
    cast: { from: rivals, asFoe: true },
    deadliness: 0.15,
    victory: { label: 'First Blood', description: 'A scratch, a bow, and the crowd chanting their name.', statModifiers: { might: 1, agility: 1 } },
    glory: { label: 'Won Their Blade', description: 'The loser’s weapon goes to the winner. That was the bet.', rarity: 'rare', spoils: winTheirBlade },
    legend: { label: 'Won Their Oath', description: 'Beaten, they knelt: "Lead, and I follow."', rarity: 'epic', grantTraits: ['sworn_rival'], castEffect: { fame: -5 }, epithet: { text: 'First Among Heroes', priority: 55 } },
    retreat: { label: 'Yielded', description: 'They will hear about this for years.', luckDelta: -0.25 },
    slain: { label: 'Killed in a Duel of Pride', description: 'It was meant to be friendly.' },
  }),
  fightWheel({
    id: 'fight_legend',
    title: 'Challenging a Legend',
    subtitle: 'They are old. They are not slow.',
    foe: { name: 'An old legend', power: 400 },
    cast: { from: retiredLegends, asFoe: true },
    deadliness: 0.15,
    victory: { label: 'Held Their Own', description: 'The legend laughed, and poured them a drink.', statModifiers: { might: 1, vitality: 1 } },
    glory: { label: 'Bested a Legend', description: 'The old hero handed over their blade, grinning. "About time."', rarity: 'rare', spoils: winTheirBlade },
    retreat: { label: 'Taught a Hard Lesson', description: 'On their back in the mud, wiser.', statModifiers: { vitality: -1, intellect: 1 } },
    legend: { label: 'Named Their Successor', description: 'The old legend laughed, bleeding, and gave them everything: arms, art and name.', rarity: 'epic', spoils: passTheTorch, epithet: { text: 'Heir of a Legend', priority: 58 } },
    slain: { label: 'The Old Lion Still Bites', description: 'They should not have pushed it.' },
  }),
  fightWheel({
    id: 'fight_ruler',
    title: 'The Coup',
    subtitle: 'Palace guards, a throne room, and an old hero who has not forgotten how to fight.',
    foe: { name: 'A ruler and their guard', power: 500 },
    cast: { from: rulers, asFoe: true },
    deadliness: 0.45,
    victory: { label: 'Drove Them Into Exile', description: 'They fled the palace, and took to the hills as a bandit.', castEffect: { setRole: 'outlaw' }, statModifiers: { might: 1 } },
    glory: {
      label: 'Overthrew Them',
      description: 'The crown rolled across the floor. Everything else they had went to the victor.',
      rarity: 'epic',
      castEffect: { setStatus: 'fallen', fallenBy: 'Overthrown by' },
      spoils: takeEverything,
      epithet: { text: 'the Kingbreaker', priority: 52 },
    },
    retreat: { label: 'Fled the Palace Guard', description: 'Over the wall, a price on their head.', statModifiers: { vitality: -2 }, grantTags: ['wanted'] },
    legend: {
      label: 'Took the Throne Itself',
      description: 'They sat down on it while it was still warm. Their adventuring ends; their reign begins.',
      rarity: 'legendary',
      castEffect: { setStatus: 'fallen', fallenBy: 'Overthrown by' },
      spoils: takeEverything,
      ...newLife(['ruler_usurped'], 'ruler', { text: 'the Usurper', priority: 86 }, 'Overthrew a ruler, and took the throne for themselves'),
    },
    slain: { label: 'Executed for Treason', description: 'The ruler watched from the balcony.' },
  }),
  fightWheel({
    id: 'fight_demon_lord',
    title: 'The Throne of the Abyss',
    subtitle: 'At the bottom of everything, the Demon Lord rises to meet them.',
    foe: FOES.demonLord,
    cast: { from: demonLords, asFoe: true },
    deadliness: 0.7,
    traitWins: [
      {
        id: 'struck_its_weakness',
        label: 'Struck Where It Was Weak',
        description: 'A redeemed champion told them where. The envoy told them when.',
        requiresTrait: ['abyss_secret'],
        setStatus: 'victorious',
        castEffect: { setStatus: 'fallen', fallenBy: 'Slain by' },
        grantTraits: ['demon_slayer'],
        epithet: { text: 'Slayer of the Demon Lord', priority: 98 },
        fate: 'Knew where the Demon Lord was weak, and struck there',
        icon: 'Eye',
      },
      {
        id: 'holy_sword_strikes',
        label: 'The Holy Sword Finds Its Heart',
        description: 'The blade was made for this one moment.',
        requiresTrait: ['holy_sword'],
        setStatus: 'victorious',
        castEffect: { setStatus: 'fallen', fallenBy: 'Slain by' },
        grantTraits: ['demon_slayer'],
        epithet: { text: 'Slayer of the Demon Lord', priority: 98 },
        fate: 'Drove the Holy Sword into the Demon Lord’s heart, and ended the long night',
        icon: 'Sword',
      },
    ],
    victory: { label: 'Drove Them Back', description: 'The Demon Lord retreats into the deep, wounded and furious.', statModifiers: { might: 3, arcana: 3, vitality: 2 }, epithet: { text: 'Bane of the Abyss', priority: 70 } },
    glory: {
      label: 'Slew the Demon Lord',
      description: 'The long night is over. There will be songs for a thousand years.',
      rarity: 'legendary',
      setStatus: 'victorious',
      castEffect: { setStatus: 'fallen', fallenBy: 'Slain by' },
      grantTraits: ['demon_slayer'],
      epithet: { text: 'Slayer of the Demon Lord', priority: 98 },
      fate: 'Slew the Demon Lord, and ended the long night',
    },
    retreat: { label: 'Burned by the Abyss', description: 'They climbed out. Part of them did not.', statModifiers: { vitality: -4 }, grantTags: ['scarred'] },
    slain: { label: 'Fell Before the Throne', description: 'One more skull at the foot of the Abyss.' },
  }),
  fightWheel({
    id: 'fight_great_war',
    title: 'The Great War',
    subtitle: 'Every banner in the realm, and an enemy that does not end.',
    foe: FOES.greatWar,
    deadliness: 0.55,
    traitWins: [
      { id: 'veteran_of_wars', label: 'A Veteran of Wars', description: 'They had done this before, and it showed.', requiresTrait: ['war_hero'], armorTierDelta: 2, statModifiers: { might: 2 }, icon: 'Shield' },
    ],
    victory: { label: 'Survived the Great War', description: 'They came home. The songs did too.', statModifiers: { might: 3, vitality: 2 }, armorTierDelta: 1, grantTraits: ['war_hero'] },
    glory: {
      label: 'Given Command of the Armies',
      description: 'The kings knelt, and handed over their banners.',
      rarity: 'epic',
      ...newLife(['legacy_general', 'war_hero'], 'general', { text: 'General of the Realm', priority: 84 }, 'Won the Great War, and was given the realm’s armies'),
    },
    retreat: { label: 'Carried From the Field', description: 'On a shield, but breathing.', statModifiers: { vitality: -4 }, grantTags: ['scarred'] },
    legend: { label: 'The Endless Host Breaks', description: 'It ended. The whole world breathed out at once.', rarity: 'legendary', grantTraits: ['war_hero', 'warlord_banner'], fame: 40, story: { worldThreat: -2 }, epithet: { text: 'Breaker of the Endless Host', priority: 84 } },
    slain: { label: 'Lost in the Endless Host', description: 'Nobody found the body.' },
    turncoat: { share: 0.15, label: 'Deserted the Great War', description: 'Nobody could blame them. The realm did anyway.', setRole: 'outlaw', condition: couldTurnOutlaw, lockedReason: (_world, char) => (char.personality === 'honorable' ? 'Honour holds the line' : 'Not the kind to run') },
  }),
  fightWheel({
    id: 'fight_wyrm',
    title: 'The Primordial Wyrm',
    subtitle: 'The first dragon. The others learned fire from it.',
    foe: FOES.wyrm,
    deadliness: 0.7,
    traitWins: [
      { id: 'dragon_against_wyrm', label: 'Dragon Against Wyrm', description: 'Their own dragon met it in the sky, and they struck while it was busy.', requiresTrait: ['dragon_bond', 'companion_dragon', 'draconic_blood'], grantTraits: ['wyrm_slayer'], icon: 'Egg' },
    ],
    victory: { label: 'Wyrm-Slayer', description: 'The first dragon is dead. The rest have heard.', rarity: 'common', grantTraits: ['wyrm_slayer'] },
    glory: { label: 'Clad in Wyrmscale', description: 'Its hide, made into armour no fire can touch.', rarity: 'legendary', grantTraits: ['wyrm_slayer'], gear: { armor: { unique: 'wyrmscale' } }, epithet: { text: 'the Wyrmscaled', priority: 75 } },
    retreat: { label: 'Barely Escaped', description: 'Through a crack in the mountain, smoking.', statModifiers: { vitality: -5 }, grantTags: ['scarred'] },
    slain: { label: 'Swallowed Whole', description: 'It did not even chew.' },
  }),
  fightWheel({
    id: 'fight_usurper',
    title: 'A Throne Lies Empty',
    subtitle: 'A usurper sits on it, and an army stands around it.',
    foe: FOES.usurper,
    deadliness: 0.5,
    victory: { label: 'Restored the Rightful Heir', description: 'The heir is grateful, and generous.', armorTierDelta: 2, luckDelta: 0.5, epithet: { text: 'the Kingmaker', priority: 64 } },
    glory: { label: 'Crowned in Their Place', description: 'The court looked at the usurper’s body, then at them, and knelt.', rarity: 'epic', next: 'thrones' },
    retreat: { label: 'Driven Off', description: 'The usurper’s guard knew their business.', statModifiers: { vitality: -3 } },
    legend: { label: 'The Crown Chooses Them', description: 'The rightful heir was dead. The court looked around, and knelt to the one holding the sword.', rarity: 'legendary', fame: 30, next: 'thrones' },
    slain: { label: 'Hanged as a Traitor', description: 'From the castle wall, as a warning.' },
  }),
  fightWheel({
    id: 'fight_breach_horror',
    title: 'The Thing From the Breach',
    subtitle: 'It has too many of everything.',
    foe: FOES.breachHorror,
    deadliness: 0.6,
    victory: { label: 'Drove It Back Through', description: 'Back into the wound it came from.', statModifiers: { arcana: 3 }, grantTraits: ['breach_warden'] },
    glory: { label: 'Sealed It Behind Them', description: 'They pushed it through and stitched the sky shut after it.', rarity: 'epic', grantTraits: ['breach_warden'], luckDelta: 0.5, epithet: { text: 'Warden of the Breach', priority: 72 } },
    retreat: { label: 'Fled the Breach', description: 'It got a taste. It will remember.', statModifiers: { vitality: -4 }, grantTags: ['haunted'] },
    legend: { label: 'Closed Every Breach', description: 'Not just this one. Every rip in the sky, stitched shut in one night.', rarity: 'legendary', grantTraits: ['breach_warden'], story: { worldThreat: -2 }, fame: 30, epithet: { text: 'Sealer of the Sky', priority: 80 } },
    slain: { label: 'Dragged Into the Breach', description: 'Through the wound, and gone.' },
  }),
  fightWheel({
    id: 'fight_titan',
    title: 'The Titan Wakes',
    subtitle: 'The mountain is standing up.',
    foe: FOES.titan,
    deadliness: 0.6,
    traitWins: [
      { id: 'strength_against_strength', label: 'Strength Against Strength', description: 'A little of a titan, against all of one.', requiresTrait: ['titans_strength'], grantTraits: ['titanslayer'], icon: 'BicepsFlexed' },
    ],
    victory: { label: 'Put It Back to Sleep', description: 'It lay down. The valley it lay on is a lake now.', statModifiers: { might: 4, vitality: 3 } },
    glory: { label: 'Titanslayer', description: 'They brought down a walking mountain.', rarity: 'legendary', grantTraits: ['titanslayer'], epithet: { text: 'the Titanslayer', priority: 85 } },
    retreat: { label: 'Ran for the Hills', description: 'Which were also moving.', statModifiers: { vitality: -4 } },
    slain: { label: 'Crushed', description: 'Beneath a mountain that walked.' },
  }),
  fightWheel({
    id: 'fight_greatest',
    title: 'The Greatest Living Legend',
    subtitle: 'There can only be one greatest.',
    foe: { name: 'The greatest living legend', power: 900 },
    cast: { from: greatestLegends, asFoe: true },
    deadliness: 0.3,
    victory: { label: 'Earned Their Respect', description: 'Not the greatest yet. Close.', statModifiers: { might: 1, agility: 1, intellect: 1 } },
    glory: { label: 'The Greatest, Now', description: 'The songs change their names overnight.', rarity: 'epic', castEffect: { fame: -15 }, epithet: { text: 'the Greatest of Their Age', priority: 82 } },
    retreat: { label: 'Outclassed', description: 'It was not close. Everyone saw.', luckDelta: -0.25 },
    legend: { label: 'A Legend Among Legends', description: 'The duel lasted three days. The songs about it will last longer.', rarity: 'legendary', fame: 40, castEffect: { fame: -20 }, epithet: { text: 'Greatest of All Ages', priority: 90 } },
    slain: { label: 'Fell to a Living Legend', description: 'At least it was someone worth falling to.' },
  }),
];

export const LEGACY_STEPS: WheelStep[] = [
  OLD_FACES,
  GRAVE,
  MARTYR_SHRINE,
  RIVAL,
  TOWNSFOLK,
  RULER_AUDIENCE,
  GENERAL_SUMMONS,
  SOUL_RELIC,
  DESTINY,
  THRONES_WHEEL,
  GRAND_CHALLENGE,
  BREACH,
  RELIQUARY,
  ...LEGACY_FIGHTS,
];
