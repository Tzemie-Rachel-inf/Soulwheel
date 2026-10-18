/**
 * Stakes: what makes a life more than a pile of stat points.
 *
 *   Meters      pressure that builds over a life, shown as bars. Wounds (every defeat), Notoriety
 *               (cruelty and blood), and for some identities Hunger or the Moon (rising on their own).
 *               When one fills, its trigger wheel comes up as the road would end:
 *                 Wounds ──▶ The Wounds Fester     Notoriety ──▶ Bounty Hunters
 *                 Hunger ──▶ The Hunger            The Moon  ──▶ The Full Moon
 *
 *   Hooks       unfinished business, as tags: a bad result leaves one ("something followed them
 *               home"), and a later wheel deals a slice only to those who carry it, which pays it off.
 *
 *   Places      ruins, wilds, lairs, cities and rifts that heroes find. They stay on the world's map,
 *               so anyone can go back (Return to a Place You Know), deeper each time, toward its heart.
 *
 *   Identities  becoming a vampire, a werewolf, a dragonborn, a construct or the undead changes the
 *               rules: a pursuit of their own at the crossroads, a way to win any fight, a meter,
 *               doors that close, enemies that come looking. `IDENTITIES` says so in the reveal.
 *
 *   Offers      the few decisions: a hype result that costs something (the vampire's gift, the
 *               Abyss, a whispering blade, a sleeping god). Everything routine is spun.
 */
import { calculatePowerRating } from '../engine/power';
import type { Character, Foe, HookDef, IdentityKit, MeterDef, PlaceKind, StepRoute, Trait, WheelOption, WheelStep, World } from '../engine/types';
import { openPlaces } from '../engine/adventure';
import { IRON_WILL_SAVES, couldTurnOutlaw, deathCheatReason, fightWheel, gearItem, hasTrait, isUncorruptable, outlawLockReason, sealedSouls } from './common';
import { POWER_WHEELS } from './powers';
import { racesOf } from './races';

// ─── Who has what ───────────────────────────────────────────────────────────

/** A hybrid counts as both of their races. */
const raceIs = (...races: string[]) => (char: Character) => racesOf(char).some((r) => races.includes(r));
export const isVampire = raceIs('vampire');
export const isWerewolf = raceIs('werewolf');
export const isUndead = raceIs('skeleton', 'lich', 'vampire');
export const isConstruct = raceIs('construct');
/** Holy places refuse the dead and the damned. */
export const refusedByHolyPlaces = (_world: World, char: Character) => !isUndead(char) && !char.tags.includes('fiend');
export const holyRefusal = (_world: World, char: Character) => (isUndead(char) ? 'Holy places refuse the dead' : 'The light will not touch them');

// ─── Meters ─────────────────────────────────────────────────────────────────

/** In the order they are checked: who you are first, then what you've done. */
export const METERS: MeterDef[] = [
  {
    id: 'hunger',
    label: 'Hunger',
    short: 'HNG',
    description: 'Rises with every adventure. Feed it on the Hunt or in a fight, or at 5 it feeds itself.',
    max: 5,
    color: '#d0304e',
    icon: 'Droplets',
    trigger: 'frenzy',
    fills: 'The Hunger took over',
    perAdventure: 1,
    appliesTo: isVampire,
  },
  {
    id: 'moon',
    label: 'The Moon',
    short: 'MON',
    description: 'Waxes with every adventure. At full, the change comes, ready or not.',
    max: 4,
    color: '#9ab4e8',
    icon: 'MoonStar',
    trigger: 'full_moon',
    fills: 'The moon rose full',
    perAdventure: 1,
    appliesTo: (char) => isWerewolf(char) && !hasTrait(char, 'moon_mastery'),
  },
  {
    id: 'wounds',
    // Shown as Health, read the other way round (engine/hp.ts): three wounds is none left.
    label: 'Health',
    short: 'HP',
    description: 'Every lost fight and bad fall costs some, and a battle can take any of it. A night by the fire restores it. At none, the wounds fester.',
    max: 3,
    color: '#e0634a',
    icon: 'HeartCrack',
    trigger: 'festering',
    fills: 'Their wounds festered',
  },
  {
    id: 'notoriety',
    label: 'Notoriety',
    short: 'NOT',
    description: 'Theft, cruelty and blood in the streets. At 4, someone pays the bounty hunters enough.',
    max: 4,
    color: '#e8b04a',
    icon: 'Eye',
    trigger: 'bounty',
    fills: 'The price on their head grew too big to ignore',
  },
];

// ─── Places ─────────────────────────────────────────────────────────────────

export const PLACE_KINDS: Record<string, PlaceKind> = {
  ruin: {
    label: 'Ruin',
    icon: 'Landmark',
    color: '#4f8a5b',
    names: ['the Weeping Stair', 'Hollowcrown Keep', 'the Sunken Halls of Ost', 'Greyvault', 'the Drowned Chapel', 'Ashenmoor Barrow', 'the Broken Spire', 'Kel Durath', 'the Hall of Nine Doors', 'Old Ironvein', 'the Vaults of Saint Ambry', 'Mirewatch'],
  },
  wild: {
    label: 'Wild',
    icon: 'Trees',
    color: '#3f8a4a',
    names: ['the Whispering Fen', 'Thornreach', 'the Glass Woods', 'Cinder Vale', 'the Hollow Steppe', 'Briarmoor', 'the Silent Firs', 'Stormback Ridge', 'the Green Abyss', 'Wolfsong Hollow'],
  },
  lair: {
    label: 'Lair',
    icon: 'Skull',
    color: '#6e4f8a',
    names: ['the Gnawing Deep', 'Bonepit Hollow', 'the Den of Teeth', 'Blackfang Caves', 'the Rotting Warren', 'Skullridge', 'the Wyrm’s Throat', 'Ghoulmarsh'],
  },
  city: {
    label: 'Lost City',
    icon: 'Castle',
    color: '#3f7ab8',
    names: ['Velmarra', 'the City of Bells', 'Old Sareth', 'Quillon Under the Lake', 'Ys', 'the Ivory Necropolis'],
  },
  rift: {
    label: 'Rift',
    icon: 'Orbit',
    color: '#8a6ae0',
    names: ['the Door in the Sky', 'the Starfall Breach', 'the Mirror Shore', 'the Upside-Down Tower', 'the Hanging Isles'],
  },
  temple: {
    label: 'Temple',
    icon: 'Church',
    color: '#c9a24c',
    names: ['the Temple of the Drowned God', 'the Sunless Shrine', 'the House of Echoes', 'the Moonwell', 'the Chapel of Teeth'],
  },
};

/** Somewhere on the map to go back to. */
export const hasOpenPlace = (world: World) => openPlaces(world).length > 0;

// ─── Hooks: unfinished business ─────────────────────────────────────────────

export const HOOKS: Record<string, HookDef> = {
  'hook:followed': { label: 'Something Followed Them Home', description: 'Lost in the wilds, they brought something back. It is still out there.' },
  'hook:map': { label: 'An Old Map', description: 'It marks a blade worth finding.' },
  'hook:grave_claim': { label: 'Armour From a Grave', description: 'Its owner’s kin want it back.' },
  'hook:margin_name': { label: 'A Name in the Margin', description: 'Written in an old book, and underlined twice.' },
  'hook:prophecy': { label: 'A Prophecy', description: 'They dreamed it. It hasn’t happened yet.' },
  'hook:strange_tracks': { label: 'Strange Tracks', description: 'Too big for any beast on the bounty board.' },
  'hook:exiled_prince': { label: 'The Exiled Prince', description: 'Sworn to help win back a throne.' },
  'hook:blade_hungers': { label: 'A Hungry Blade', description: 'It wants blood. It is patient, but not forever.' },
  'hook:abyss_debt': { label: 'The Abyss’s Price', description: 'It taught them a power. It will come back to collect.' },
  // Marks the older content leaves, read the same way.
  rival: { label: 'A Jealous Rival', description: 'Rivals cross their road more often.' },
  hunted: { label: 'A Price on Their Head', description: 'Ambushes on the road come twice as often.' },
  hexed: { label: 'Hexed', description: 'A sorcerer’s curse that never quite lifts.' },
  marked: { label: 'Marked by the Abyss', description: 'Its envoys and champions come twice as often.' },
  haunted: { label: 'Haunted', description: 'Something followed them out of a crypt.' },
};

/** Where each hook is paid off, when it comes due at the crossroads (Unfinished Business). */
const HOOK_PAYOFFS: [tag: string, stepId: string][] = [
  ['hook:followed', 'fight_follower'],
  ['hook:grave_claim', 'fight_grave_kin'],
  ['hook:blade_hungers', 'blade_demands'],
  ['hook:strange_tracks', 'fight_apex'],
  ['hook:map', 'map_cache'],
  ['hook:margin_name', 'margin_name'],
  ['hook:abyss_debt', 'abyss_collects'],
];
export const PAYABLE_HOOKS = HOOK_PAYOFFS.map(([tag]) => tag);

/** Unfinished business comes due: the wheel for the first hook the hero carries. */
export const UNFINISHED_BUSINESS: StepRoute = {
  among: HOOK_PAYOFFS.map(([, stepId]) => stepId),
  pick: (_world, char) => HOOK_PAYOFFS.find(([tag]) => char.tags.includes(tag))?.[1] ?? null,
};

// ─── Identities ─────────────────────────────────────────────────────────────

const UNDEAD_KIT: IdentityKit = {
  headline: 'Death did not take. Something else did.',
  gains: ['Raise the Dead: a pursuit of their own at the crossroads', 'Their bones can be built into a legion, or a Lich'],
  loses: ['Temples and holy springs refuse the dead'],
};

export const IDENTITIES: Record<string, IdentityKit> = {
  vampire: {
    headline: 'Eternal life. A terrible diet. New rules.',
    gains: ['The Hunt: a pursuit of their own at the crossroads', 'Drain: a new way to win any fight', 'The Night Court may send for them'],
    loses: ['Hunger rises every adventure; at 5 it takes over', 'Dawn makes quiet roads dangerous', 'Holy springs and temple teachers turn them away', 'Vampire hunters come for them, more the more notorious they are'],
  },
  werewolf: {
    headline: 'The next full moon will be interesting.',
    gains: ['Run With the Pack: a pursuit of their own at the crossroads', 'The Beast Within: a new way to win any fight', 'Master the change, and the moon stops ruling them'],
    loses: ['The Moon waxes every adventure; at full, the change comes', 'Silver-armed hunters track them on the road'],
  },
  dragonborn: {
    headline: 'Scales by morning, and a hoard to build.',
    gains: ['Claim a Hoard: a pursuit of their own at the crossroads', 'Wings, and a seat on the Dragon Council, for the lucky'],
    loses: ['Every dragon in the world wants their hoard: dragon lairs come looking'],
  },
  construct: {
    headline: 'Built, not born. Repaired, not healed.',
    gains: ['The Artificer: repairs and upgrades instead of rest', 'A runic core, or a war-titan’s frame, for the lucky'],
    loses: ['A night by the fire no longer mends them'],
  },
  skeleton: UNDEAD_KIT,
  lich: { ...UNDEAD_KIT, headline: 'A soul kept somewhere safer than bones.' },
};

// ─── Traits ─────────────────────────────────────────────────────────────────

const trait = (id: string, name: string, description: string, power: number, item?: Trait['item']): Trait => ({ id, name, description, power, ...(item && { item }) });

export const STAKES_TRAITS: Record<string, Trait> = Object.fromEntries(
  [
    // Meters
    trait('saints_mercy', 'A Saint’s Mercy', 'Healed by someone who should not have been able to.', 35),
    trait('undying', 'Undying', 'Died once already. It didn’t take.', 30),
    trait('feared', 'Untouchable', 'No guild takes the contract on them any more.', 45),
    trait('blood_of_heroes', 'Blood of Heroes', 'Drank a hero dry, and kept a little of what made them great.', 60),
    trait('moon_mastery', 'Master of the Change', 'The wolf comes when called, and only then.', 50),
    trait('werewolf_lord', 'Lord of Wolves', 'Every pack in the land knows their howl.', 70),
    trait('wild_hunt', 'Rider of the Wild Hunt', 'Antlered riders, hounds of smoke, and a horn that wakes the dead.', 80),
    // Places
    trait('heart_of_the_deep', 'Heart of the Deep', 'The thing a whole buried place was built around. It is theirs now.', 60, 'relic'),
    trait('lair_lord', 'Lord of the Deep Places', 'Took a lair for their own, and everything that lived in it.', 50),
    trait('skyborn', 'Skyborn', 'Spent a season with the folk above the clouds.', 40),
    trait('sky_citadel', 'Lord of a Floating Citadel', 'A castle on a cloud, and it answers to them.', 90),
    trait('ghost_crown', 'The Ghost Crown', 'A dead city’s court kneels to them.', 70, 'relic'),
    trait('forgotten_godhood', 'Remade by a Forgotten God', 'Knelt at the bottom of the world, and stood up as something else.', 100),
    trait('god_slayer', 'God-Slayer', 'Killed a god in its sleep. The other gods noticed.', 120),
    // Identities
    trait('vampire_thrall', 'A Vampire’s Thrall', 'Turned, and loyal forever. It makes the beds and guards the door.', 30),
    trait('ruler_night_court', 'Sovereign of the Night Court', 'Every vampire in the realm answers to them.', 120),
    trait('vampire_slayer', 'Vampire-Slayer', 'Put a stake through something older than kingdoms.', 45),
    trait('eldest_blood', 'Blood of the Eldest', 'Drank from the oldest vampire there was.', 120),
    trait('dragon_wings', 'Dragon Wings', 'One morning, they simply had them.', 60),
    trait('dragon_council', 'Voice of the Dragon Council', 'The great dragons listen when they speak.', 90),
    trait('runic_core', 'Runic Core', 'A heart of carved light, and it never stops.', 60),
    trait('war_titan', 'War-Titan Frame', 'Rebuilt as a walking siege engine.', 110),
    trait('bone_servants', 'Bone Servants', 'They clatter, but they listen.', 25),
    trait('bone_legion', 'A Legion of Bones', 'A graveyard’s worth of soldiers, and none of them complain.', 70),
    // Hooks
    trait('shadow_hound', 'The Thing From the Wilds', 'It followed them home. Now it follows them everywhere.', 45),
    trait('ally_kin', 'Sworn Kin', 'The dead knight’s family, sworn to them instead.', 35),
    trait('sentient_blade', 'The Whispering Blade', 'A sword with opinions, and a thirst.', 50, 'weapon'),
    trait('blade_true_name', 'The Blade’s True Name', 'They know what it is called. Now it obeys.', 60),
    trait('foretold', 'The Foretold', 'A prophecy came true, and it was about them.', 70),
    trait('apex_beast', 'The Apex', 'The beast the bounty hunters were afraid of. It heels now.', 75),
    trait('royal_favor', 'Royal Favour', 'A crown owes them, and remembers.', 40),
    trait('ruler_heir', 'Heir to the Throne', 'Named heir by the prince they put back on it.', 100),
    // Fights' hype
    trait('bandit_band', 'A Bandit Band', 'Twenty cutthroats who call them boss.', 40),
    trait('goblin_horde', 'King Under the Hill', 'A warren of goblins, and a pot for a crown.', 45),
    trait('spider_brood', 'Mother of Spiders', 'The Broodmother’s children chose them.', 45),
    trait('troll_guard', 'Troll Bodyguard', 'It knelt, and has guarded their back ever since.', 55),
    trait('guardian_heart', 'Keeper of the Last Vault', 'What the guardian guarded, guarded now by them.', 70),
    trait('barrow_crown', 'Crown of the Barrow', 'The dead king handed over his crown, and his dead.', 75, 'relic'),
    trait('wyvern_brood', 'Wyvern Brood', 'A clutch of wyverns, raised from the egg.', 70),
    trait('dragon_name', 'A Dragon’s True Name', 'It told them before it died. Every dragon alive heard.', 150),
    trait('abyss_secret', 'Secrets of the Abyss', 'A redeemed champion told them where the Demon Lord is weak.', 50),
    trait('companion_maneater', 'The Man-Eater’s Cub', 'It followed them home. It is not small any more.', 40),
    trait('mage_tower', 'A Burnt Tower', 'A rogue mage’s tower, and every book in it.', 70),
    trait('secret_technique', 'A Secret Technique', 'One move nobody else knows.', 45),
    trait('warlord_banner', 'The War-Ender’s Banner', 'Armies rally to it.', 80),
    trait('sworn_rival', 'A Rival, Sworn', 'Another hero knelt: "Lead, and I follow."', 40),
    trait('ruler_usurped', 'Ruler by Right of Arms', 'Took a throne from the hero who held it.', 100),
    trait('legend_of_the_road', 'A Legend of the Road', 'A duel the bards will never stop singing.', 50),
    trait('horror_bound', 'Master of the Forbidden', 'Bound a forbidden being to their will. It waits for orders.', 120),
    trait('river_blessing', 'Blessed by the River', 'The river spirit lets them pass, always.', 35),
    trait('ghost_step', 'Ghost-Step', 'Hunters lose them like smoke.', 35),
    trait('relic_awake', 'The Relic Awake', 'The Veiled Relic woke in their hands, and chose them.', 40),
    trait('peacemaker', 'The Peacemaker', 'Ended a feud that would have burned a kingdom.', 40),
    trait('ruler_alliance', 'High Ruler of the Alliance', 'Everyone they gathered on the road made them their ruler.', 100),
    trait('abyss_scarred', 'The Unclaimed', 'The Abyss tried to take them, and they burned it out.', 55),
    trait('abyss_heir', 'Heir of the Abyss', 'Named to rule after the Demon Lord. The Abyss already bows a little.', 120),
    trait('cheated_death', 'Death Owes Them One', 'Beat Death at its own game. When it comes for them, it goes away again.', 40),
    trait('ruler_savior', 'Lord Protector', 'A city they saved made them its lord.', 90),
  ].map((t) => [t.id, t]),
);

// ─── Small helpers ──────────────────────────────────────────────────────────

/** A foe that grows with the hero: a share of their Combat Power, plus whatever `extra` adds. */
const scaled = (name: string, share: number, extra: (c: Character) => number = () => 0) => (c: Character): Foe => ({
  name,
  power: Math.max(60, Math.round(calculatePowerRating(c) * (share + extra(c)))),
});
const meter = (c: Character, id: string) => c.meters?.[id] ?? 0;
const depth = (c: Character) => c.expedition?.depth ?? 1;
const notIf = (has: (c: Character) => boolean, reason: string): Pick<WheelOption, 'condition' | 'lockedReason'> => ({
  condition: (_world, char) => !has(char),
  lockedReason: reason,
});

// ─── Meter wheels ───────────────────────────────────────────────────────────

const FESTERING: WheelStep = {
  id: 'festering',
  title: 'The Wounds Fester',
  subtitle: 'Too many hurts, too little rest. Something has to give.',
  options: [
    { id: 'long_recovery', label: 'A Long Recovery', description: 'A season in bed. They came back slower.', baseWeight: 34, rarity: 'common', statModifiers: { might: -1, agility: -1 }, nextStepId: null, color: '#6b5a4a', icon: 'Bed' },
    { id: 'scars_that_teach', label: 'Scars That Teach', description: 'Every scar a lesson in where not to stand.', baseWeight: 24, rarity: 'common', statModifiers: { vitality: 2 }, grantTags: ['scarred'], nextStepId: null, color: '#8a5a3a', icon: 'Shield' },
    { id: 'fever_dreams', label: 'Fever Dreams', description: 'Three nights of fever, and in it, a vision of something that hasn’t happened yet.', baseWeight: 14, rarity: 'uncommon', statModifiers: { arcana: 2, intellect: -1 }, grantTags: ['hook:prophecy'], nextStepId: null, color: '#7a5ad0', icon: 'Moon' },
    { id: 'never_closed', label: 'A Wound That Never Closed', description: 'It aches when it rains. It always rains.', baseWeight: 12, rarity: 'uncommon', statModifiers: { vitality: -3, might: -1 }, nextStepId: null, color: '#7a2e2e', icon: 'HeartCrack' },
    { id: 'died_of_wounds', label: 'Died of Their Wounds', description: 'Not in battle. In a bed, slowly, on the fourth night.', baseWeight: 8, rarity: 'uncommon', setStatus: 'fallen', condition: IRON_WILL_SAVES, lockedReason: deathCheatReason, fate: 'Died of wounds that never healed', nextStepId: null, color: '#7f1d1d', icon: 'Skull' },
    // Iron Will's price: they get up from every blow, and never stay down long enough to heal.
    { ...notIf(isUndead, 'Already dead, and not that kind of mercy'), id: 'saints_mercy', label: 'A Wandering Saint', description: 'A stranger laid hands on them, and every wound closed at once.', baseWeight: 4, rarity: 'epic', grantTraits: ['saints_mercy'], statModifiers: { vitality: 4 }, luckDelta: 0.5, epithet: { text: 'the Mended', priority: 40 }, nextStepId: null, color: '#ffe8a8', icon: 'HandHeart' },
    {
      ...notIf((c) => isUndead(c) || isConstruct(c), 'There is nothing left in them to come back wrong'),
      id: 'came_back_wrong',
      label: 'Came Back Wrong',
      description: 'They died on the third night. On the fourth, they got up, and the flesh did not come with them.',
      baseWeight: 4,
      rarity: 'epic',
      setRace: 'skeleton',
      grantTraits: ['undying'],
      epithet: { text: 'the Undying', priority: 44 },
      nextStepId: null,
      color: '#c8c2b0',
      icon: 'Bone',
    },
  ],
};

const BOUNTY = fightWheel({
  id: 'bounty',
  title: 'Bounty Hunters',
  subtitle: 'Someone finally paid enough. They come at night, and they come prepared.',
  foe: { name: 'The Bounty Hunters', power: 260 },
  foeOf: scaled('The Bounty Hunters', 0.85),
  deadliness: 0.3,
  victory: { label: 'Sent Them Home in Pieces', description: 'The next crew will want more money.', statModifiers: { might: 1 }, fame: 4 },
  glory: { label: 'Burned the Bounty Board', description: 'And the names on it, and the man who kept it.', rarity: 'rare', luckDelta: 0.5, weaponTierDelta: 1 },
  legend: { label: 'Too Dangerous to Hunt', description: 'The guilds strike their name from every board. Nobody takes that contract again.', rarity: 'epic', grantTraits: ['feared'], epithet: { text: 'the Untouchable', priority: 50 } },
  retreat: { label: 'Dragged Off in Chains', description: 'A cell, a trial, a window with loose bars.', statModifiers: { vitality: -1 } },
  slain: { label: 'Collected', description: 'Dead or alive, the poster said. They chose dead.' },
  turncoat: { share: 0.25, label: 'Fled Into Outlawry', description: 'If the law wants them this badly, the law can have them as an enemy.', setRole: 'outlaw', condition: couldTurnOutlaw, lockedReason: outlawLockReason },
});

const FRENZY: WheelStep = {
  id: 'frenzy',
  title: 'The Hunger',
  subtitle: 'They waited too long. Now it decides.',
  options: [
    { id: 'held_it_back', statScaling: { intellect: 0.04 }, label: 'Held It Back', description: 'Locked in a cellar until the red faded. It took a week.', baseWeight: 30, rarity: 'common', statModifiers: { vitality: -2 }, nextStepId: null, color: '#4f5a7a', icon: 'Lock' },
    { id: 'fed_on_village', label: 'Fed on a Village', description: 'Three houses. Nobody in them woke up.', baseWeight: 26, rarity: 'common', meters: { notoriety: 2 }, statModifiers: { might: 1, vitality: 2 }, fame: -4, nextStepId: null, color: '#8a1c2e', icon: 'Droplets' },
    { id: 'fed_on_friend', label: 'Fed on a Friend', description: 'They woke beside someone who trusted them.', baseWeight: 12, rarity: 'uncommon', removeTraits: ['ally_squire', 'ally_comrade'], statModifiers: { vitality: 3 }, grantTags: ['kinslayer'], nextStepId: null, color: '#6e1f2a', icon: 'HeartCrack' },
    { ...notIf(isUncorruptable, 'Uncorruptable: the Hunger cannot take all of them'), id: 'became_the_monster', label: 'Became the Monster', description: 'They stopped pretending. The night is theirs now, and the roads are not safe.', baseWeight: 6, rarity: 'rare', setRole: 'outlaw', fate: 'Gave in to the Hunger, and became the thing in the stories', nextStepId: null, color: '#3a0a1a', icon: 'Skull' },
    { id: 'drank_a_hero', label: 'Drank a Hero Dry', description: 'A famous sword, a dark alley, and a great deal of power in very little blood.', baseWeight: 4, rarity: 'epic', grantTraits: ['blood_of_heroes'], statModifiers: { might: 2, arcana: 2 }, meters: { notoriety: 2 }, epithet: { text: 'the Hero-Drinker', priority: 52 }, nextStepId: null, color: '#c0304e', icon: 'Droplet' },
    { id: 'elder_wakes', label: 'Something Older Wakes', description: 'The Hunger passes, and leaves behind something ancient. The Night Court has felt it.', baseWeight: 2, rarity: 'legendary', grantTraits: ['ancient_blood'], epithet: { text: 'the Ancient', priority: 60 }, nextStepId: 'night_court', color: '#c9a24c', icon: 'Hourglass' },
  ],
};

const FULL_MOON: WheelStep = {
  id: 'full_moon',
  title: 'The Full Moon',
  subtitle: 'It rises. So does the wolf.',
  options: [
    { id: 'chained', label: 'Chained in a Cellar', description: 'They planned for it. Mostly.', baseWeight: 30, rarity: 'common', statModifiers: { vitality: -1 }, nextStepId: null, color: '#4f5a7a', icon: 'Lock' },
    { id: 'rampage', label: 'A Night of Rampage', description: 'Livestock, fences, and one very unlucky watchman.', baseWeight: 26, rarity: 'common', meters: { notoriety: 2 }, statModifiers: { might: 2 }, fame: -3, nextStepId: null, color: '#7a3a2e', icon: 'Skull' },
    { id: 'hunted_with_pack', label: 'Hunted With the Pack', description: 'Grey shapes ran beside them all night, and one stayed.', baseWeight: 16, rarity: 'uncommon', grantTraits: ['companion_wolf'], statModifiers: { agility: 2 }, nextStepId: null, color: '#6e7a8a', icon: 'Dog' },
    { id: 'woke_in_blood', label: 'Woke Up Covered in Blood', description: 'Not theirs. Mostly.', baseWeight: 12, rarity: 'uncommon', meters: { wounds: 1, notoriety: 1 }, nextStepId: null, color: '#6e1f2a', icon: 'Droplets' },
    { id: 'mastered_the_change', label: 'Mastered the Change', description: 'This time they called the wolf, and sent it away again. The moon has no hold on them now.', baseWeight: 4, rarity: 'epic', grantTraits: ['moon_mastery'], epithet: { text: 'Moon-Master', priority: 54 }, nextStepId: null, color: '#9ab4e8', icon: 'MoonStar' },
    { id: 'pack_crowns_them', label: 'The Packs Crown Them', description: 'Every wolf for a hundred miles came to the hill, and bowed.', baseWeight: 2, rarity: 'legendary', grantTraits: ['pack_alpha', 'werewolf_lord'], epithet: { text: 'Lord of Wolves', priority: 66 }, nextStepId: null, color: '#c9a24c', icon: 'Crown' },
  ],
};

// ─── Places: going back ─────────────────────────────────────────────────────

const PLACE_RETURN: WheelStep = {
  id: 'place_return',
  title: 'Return to {place}',
  subtitle: 'Found by {founder}, explored to depth {depth}. The deeper, the richer, and the deadlier.',
  visitsPlace: true,
  options: [
    { id: 'deeper', label: 'Deeper Than Anyone Has Been', description: 'A new stair, a new level, and a name scratched on the wall: theirs.', baseWeight: 30, rarity: 'common', place: { deepen: 1 }, luckDelta: 0.25, fame: 3, nextStepId: null, color: '#4f8a5b', icon: 'ArrowDown' },
    { id: 'something_moved_in', label: 'Something Moved In', description: 'Whatever lives in {place} now did not expect visitors. It grows with the depth.', baseWeight: 26, rarity: 'common', nextStepId: 'fight_place_guardian', color: '#6e4f8a', icon: 'Skull' },
    { id: 'hidden_chamber', label: 'A Hidden Chamber', description: 'Behind a wall that sounded hollow: arms, armour, and another stair down.', baseWeight: 14, rarity: 'uncommon', weaponTierDelta: 1, armorTierDelta: 1, place: { deepen: 1 }, nextStepId: null, color: '#3f6a7a', icon: 'DoorOpen' },
    { id: 'cave_in', label: 'It Came Down Around Them', description: 'They dug their way out. Nobody is going back into {place} now.', baseWeight: 12, rarity: 'uncommon', meters: { wounds: 2 }, place: { close: 'Collapsed on {hero}' }, nextStepId: null, color: '#7a6a4f', icon: 'Mountain' },
    { id: 'marks_of_before', label: 'Marks of Those Before', description: '{founder} was here. They left a cache for whoever came next.', baseWeight: 10, rarity: 'uncommon', weaponTierDelta: 1, luckDelta: 0.5, nextStepId: null, color: '#a08a5a', icon: 'Footprints' },
    { id: 'wayfarers_way', label: 'A Way Only a Wayfarer Knows', description: 'Past the edge of the map, every stair goes somewhere.', baseWeight: 10, rarity: 'rare', requiresTrait: ['wayfarer'], place: { deepen: 2 }, luckDelta: 0.25, nextStepId: null, color: '#c9a24c', icon: 'Map' },
    {
      id: 'the_heart',
      label: 'The Heart of {place}',
      description: 'At the very bottom, the thing the whole place was built around. Likelier the deeper they have gone.',
      baseWeight: 3,
      vary: (c) => ({ baseWeight: 1 + 2 * depth(c) }),
      rarity: 'epic',
      grantTraits: ['heart_of_the_deep'],
      fame: 15,
      epithet: { text: 'the Delver', priority: 56 },
      place: { close: 'Its heart was claimed by {hero}' },
      nextStepId: null,
      color: '#ffb84d',
      icon: 'Gem',
    },
    { id: 'what_sleeps_below', label: 'What Sleeps at the Bottom', description: 'Under everything, something vast and old is dreaming. It opens one eye.', baseWeight: 1, vary: (c) => ({ baseWeight: 0.2 + 0.5 * depth(c) }), rarity: 'legendary', place: { deepen: 1 }, nextStepId: 'god_bargain', color: '#ffe08a', icon: 'Eye' },
  ],
};

const PLACE_GUARDIAN = fightWheel({
  id: 'fight_place_guardian',
  title: 'What Lives in {place}',
  subtitle: 'It grows with the depth. So does what it guards.',
  foe: { name: 'What Lives Below', power: 250 },
  foeOf: scaled('What Lives Below', 0.5, (c) => 0.15 * depth(c)),
  deadliness: 0.3,
  victory: { label: 'Cleared It Out', description: 'And found the next stair down.', place: { deepen: 1 }, weaponTierDelta: 1 },
  glory: { label: 'Its Hoard, Untouched for Centuries', description: 'Gold, and steel that never rusted.', rarity: 'rare', weaponTierDelta: 2, armorTierDelta: 1, luckDelta: 0.25 },
  legend: { label: 'Made {place} Their Own', description: 'The thing knelt. Everything else down there followed.', rarity: 'epic', grantTraits: ['lair_lord'], epithet: { text: 'Lord of the Deep Places', priority: 50 } },
  retreat: { label: 'Driven Back Up', description: 'It is still down there. So is the way deeper.' },
  slain: { label: 'Never Came Back Up', description: 'The place keeps what it takes.' },
});

const GOD_BARGAIN: WheelStep = {
  id: 'god_bargain',
  title: 'What Sleeps at the Bottom',
  subtitle: 'A forgotten god, dreaming at the bottom of {place}. It offers to remake them. It does not say into what.',
  choice: true,
  options: [
    { id: 'kneel', label: 'Kneel and Be Remade', description: 'Godhood, of a kind. Whatever it was a god of, they are now a little of it.', baseWeight: 20, rarity: 'legendary', setRace: 'god', grantTraits: ['forgotten_godhood'], epithet: { text: 'the Godborn', priority: 90 }, place: { close: 'Its god went into {hero}' }, nextStepId: null, color: '#ffe08a', icon: 'Sun' },
    { id: 'kill_it', label: 'Kill It in Its Sleep', description: 'A god, asleep. Nobody will ever get a better chance.', baseWeight: 30, rarity: 'rare', nextStepId: 'fight_sleeping_god', color: '#a35d3a', icon: 'Swords' },
    { id: 'let_it_sleep', label: 'Let It Sleep', description: 'Back up the stairs, very quietly, and seal the door.', baseWeight: 40, rarity: 'common', luckDelta: 0.5, place: { close: 'Sealed by {hero}, with something asleep below' }, nextStepId: null, color: '#4f6f8f', icon: 'Lock' },
  ],
};

const SLEEPING_GOD = fightWheel({
  id: 'fight_sleeping_god',
  title: 'The Sleeping God',
  subtitle: 'It is waking up.',
  foe: { name: 'A Forgotten God', power: 900 },
  foeOf: scaled('A Forgotten God', 1.3),
  deadliness: 0.55,
  victory: { label: 'God-Slayer', description: 'It died the way gods do: slowly, and everywhere at once.', grantTraits: ['god_slayer'], epithet: { text: 'the God-Slayer', priority: 92 }, place: { close: 'Its god was slain by {hero}' } },
  glory: { label: 'Took Its Divinity', description: 'It died, and what it was went looking for somewhere to live.', rarity: 'legendary', setRace: 'god', grantTraits: ['god_slayer', 'forgotten_godhood'], epithet: { text: 'the God-Eater', priority: 96 }, place: { close: 'Its god was eaten by {hero}' } },
  retreat: { label: 'Fled the Waking God', description: 'It is awake now. That is their fault.', story: { worldThreat: 1 } },
  slain: { label: 'Woke It', description: 'It opened both eyes.' },
});

// ─── Places: found by exploring ─────────────────────────────────────────────

const SKY_DOOR: WheelStep = {
  id: 'sky_door',
  title: 'Through the Door in the Sky',
  subtitle: 'Above the clouds there is another country, and it has been expecting someone.',
  options: [
    { id: 'fell_back', label: 'Fell Back to Earth', description: 'The door closed behind them. The ground was a long way down.', baseWeight: 30, rarity: 'common', meters: { wounds: 2 }, luckDelta: 0.25, nextStepId: null, color: '#6b7280', icon: 'CloudFog' },
    { id: 'star_forge', label: 'A Forge of Fallen Stars', description: 'A blade cooled in starlight. It never quite stops glowing.', baseWeight: 22, rarity: 'uncommon', weaponTierDelta: 3, upgrade: true, nextStepId: null, color: '#8abaf0', icon: 'Star' },
    { id: 'sky_folk', label: 'The Sky-Folk Took Them In', description: 'A season among people who have never touched the ground.', baseWeight: 18, rarity: 'uncommon', grantTraits: ['skyborn'], statModifiers: { arcana: 3, agility: 2 }, nextStepId: null, color: '#c0d8f0', icon: 'Cloud' },
    { id: 'waystation', label: 'The Gods’ Waystation', description: 'Where gods rest between worlds. One of them left something behind.', baseWeight: 8, rarity: 'epic', luckDelta: 0.5, ...{ condition: refusedByHolyPlaces, lockedReason: holyRefusal }, nextStepId: POWER_WHEELS.blessed, color: '#fff4c2', icon: 'Sun' },
    { id: 'floating_citadel', label: 'Lord of a Floating Citadel', description: 'An empty castle on a cloud, and the cloud decided they belong to it.', baseWeight: 6, rarity: 'legendary', grantTraits: ['sky_citadel'], fame: 25, epithet: { text: 'Lord of the Floating Citadel', priority: 80 }, nextStepId: null, color: '#ffe08a', icon: 'Castle' },
  ],
};

const LOST_CITY: WheelStep = {
  id: 'lost_city',
  title: 'The Lost City of {place}',
  subtitle: 'Empty streets, full vaults, and someone still on the throne.',
  options: [
    { id: 'vaults', label: 'Its Vaults', description: 'A king’s treasury, a thousand years untouched.', baseWeight: 30, rarity: 'common', ...gearItem('weapon', 4, false), luckDelta: 0.25, nextStepId: null, color: '#d9a400', icon: 'Coins' },
    { id: 'city_of_ghosts', label: 'A City of Ghosts', description: 'The citizens never left. They just stopped being alive.', baseWeight: 24, rarity: 'common', nextStepId: 'fight_wights', color: '#3c5a6e', icon: 'Ghost' },
    { id: 'great_library', label: 'Its Great Library', description: 'Shelves to the ceiling, and a ceiling very far away.', baseWeight: 16, rarity: 'uncommon', statModifiers: { intellect: 2 }, nextStepId: POWER_WHEELS.arcane, color: '#4f5a9a', icon: 'Library' },
    { id: 'old_traps', label: 'The Traps Still Work', description: 'Whoever built them was very proud of them.', baseWeight: 14, rarity: 'uncommon', meters: { wounds: 2 }, nextStepId: null, color: '#7a2e2e', icon: 'Zap' },
    { id: 'ghost_crown', label: 'Crowned by Its Ghosts', description: 'The dead court knelt. They have waited a thousand years for someone to sit down.', baseWeight: 3, rarity: 'legendary', grantTraits: ['ghost_crown'], fame: 20, epithet: { text: 'the Ghost-King', priority: 70 }, place: { close: 'Its throne was taken by {hero}' }, nextStepId: null, color: '#9a7ad0', icon: 'Crown' },
  ],
};

// ─── Identities: what each one can do ───────────────────────────────────────

const THE_HUNT: WheelStep = {
  id: 'the_hunt',
  title: 'The Hunt',
  subtitle: 'Night falls. Someone, somewhere, is about to have a very bad evening.',
  options: [
    { id: 'fed_quietly', label: 'Fed Quietly', description: 'A drunk, an alley, a little less blood. He woke up with a headache.', baseWeight: 30, rarity: 'common', meters: { hunger: -3 }, statModifiers: { vitality: 1 }, nextStepId: null, color: '#6e2a3a', icon: 'Droplet' },
    { id: 'fed_on_bandits', label: 'Fed on Bandits', description: 'Nobody misses a highwayman. They had a nice sword, too.', baseWeight: 24, rarity: 'common', meters: { hunger: -3 }, statModifiers: { might: 1 }, weaponTierDelta: 1, nextStepId: null, color: '#8a1c2e', icon: 'Droplets' },
    { id: 'seen_feeding', label: 'Seen Feeding', description: 'A scream, a lantern, a face that will be on posters by morning.', baseWeight: 16, rarity: 'uncommon', meters: { hunger: -2, notoriety: 2 }, nextStepId: null, color: '#e0a83a', icon: 'Eye' },
    { id: 'caught_by_dawn', label: 'Caught by the Dawn', description: 'They found a cellar in time. Almost.', baseWeight: 12, rarity: 'uncommon', meters: { hunger: -1, wounds: 2 }, nextStepId: null, color: '#f0c06a', icon: 'Sunrise' },
    { id: 'turned_a_mortal', label: 'Turned a Mortal', description: 'They let one live, changed. A servant, forever.', baseWeight: 8, rarity: 'rare', grantTraits: ['vampire_thrall'], meters: { hunger: -2 }, nextStepId: null, color: '#5a1a2a', icon: 'UserPlus' },
    { id: 'drank_from_a_mage', label: 'Drank From a Mage', description: 'Power in the blood. Some of it stayed.', baseWeight: 4, rarity: 'epic', meters: { hunger: -5 }, statModifiers: { arcana: 3 }, nextStepId: POWER_WHEELS.arcane, color: '#7a5ad0', icon: 'WandSparkles' },
    { id: 'court_invitation', label: 'An Invitation From the Night Court', description: 'Black wax, a crimson seal, and an address that isn’t on any map.', baseWeight: 2, rarity: 'legendary', meters: { hunger: -1 }, nextStepId: 'night_court', color: '#c9a24c', icon: 'ScrollText' },
  ],
};

const NIGHT_COURT: WheelStep = {
  id: 'night_court',
  title: 'The Night Court',
  subtitle: 'Velvet, candlelight, and every vampire older than a kingdom, turned to look at them.',
  choice: true,
  options: [
    { id: 'bend_the_knee', label: 'Bend the Knee', description: 'Sworn to the eldest. Centuries of blood, poured into them.', baseWeight: 40, rarity: 'common', grantTraits: ['ancient_blood'], statModifiers: { arcana: 2, vitality: 2 }, meters: { hunger: -5 }, epithet: { text: 'of the Night Court', priority: 50 }, nextStepId: null, color: '#8a1c2e', icon: 'Crown' },
    { id: 'decline', label: 'Decline, Politely', description: 'They have long memories. So, now, does the hero.', baseWeight: 30, rarity: 'uncommon', luckDelta: 0.25, grantTags: ['hunted'], nextStepId: null, color: '#4f5a7a', icon: 'Ban' },
    { id: 'burn_the_court', label: 'Burn the Court Down', description: 'Every elder in one room. One torch.', baseWeight: 20, rarity: 'rare', nextStepId: 'fight_night_court', color: '#e0703a', icon: 'Flame' },
    {
      id: 'take_the_throne',
      label: 'Take the Throne of Night',
      description: 'The old sovereign is tired. The hero is not. Their adventuring ends; their reign begins, and other heroes will meet them.',
      baseWeight: 10,
      rarity: 'legendary',
      claimSingleton: 'night_court',
      lockedReason: 'The Night Court already has a sovereign',
      setRole: 'npc',
      grantTraits: ['ruler_night_court'],
      grantTags: ['ruler'],
      epithet: { text: 'Sovereign of the Night', priority: 88 },
      fate: 'Took the Throne of Night, and rules the vampires of the realm',
      nextStepId: null,
      color: '#ffb84d',
      icon: 'Crown',
    },
  ],
};

const NIGHT_COURT_FIGHT = fightWheel({
  id: 'fight_night_court',
  title: 'The Court Burns',
  subtitle: 'A ballroom on fire, and twelve elders who have not had to fight in centuries.',
  foe: { name: 'The Night Court', power: 700 },
  foeOf: scaled('The Night Court', 1.15),
  deadliness: 0.45,
  victory: { label: 'The Court Is Ash', description: 'Twelve elders, one night.', grantTraits: ['vampire_slayer'], meters: { hunger: -5 }, epithet: { text: 'the Court-Burner', priority: 62 } },
  glory: { label: 'Drank the Eldest', description: 'The oldest of them, last of all, and every century of her.', rarity: 'legendary', grantTraits: ['eldest_blood'], meters: { hunger: -5 }, epithet: { text: 'Eater of Elders', priority: 85 } },
  retreat: { label: 'Escaped the Fire', description: 'Singed, hunted, alive.', grantTags: ['hunted'] },
  slain: { label: 'Burned With the Court', description: 'Nobody got out.' },
});

const PACK_RUN: WheelStep = {
  id: 'pack_run',
  title: 'Run With the Pack',
  subtitle: 'Four legs, a cold wind, and every scent in the forest.',
  options: [
    { id: 'good_hunt', label: 'A Good Hunt', description: 'A stag, a long chase, and the moon a little quieter after.', baseWeight: 30, rarity: 'common', meters: { moon: -1 }, statModifiers: { might: 1, agility: 1 }, nextStepId: null, color: '#5a6478', icon: 'MoonStar' },
    { id: 'found_a_pack', label: 'Found a Pack', description: 'Grey shapes fell in beside them, and stayed.', baseWeight: 24, rarity: 'common', grantTraits: ['companion_wolf'], nextStepId: null, color: '#6e7a8a', icon: 'Dog' },
    { id: 'ran_through_village', label: 'Ran Through a Village', description: 'Nobody died. Everybody saw.', baseWeight: 16, rarity: 'uncommon', meters: { notoriety: 2 }, nextStepId: null, color: '#e0a83a', icon: 'Eye' },
    { id: 'silver_trap', label: 'A Silver Trap', description: 'Someone knew exactly what they were.', baseWeight: 14, rarity: 'uncommon', meters: { wounds: 2 }, nextStepId: null, color: '#c8c8d0', icon: 'HeartCrack' },
    { id: 'challenged_the_alpha', label: 'Challenged the Alpha', description: 'A grey giant on a hill, and a pack watching to see who wins.', baseWeight: 8, rarity: 'rare', nextStepId: 'fight_alpha', color: '#a35d3a', icon: 'Swords' },
    { id: 'moon_spoke', label: 'The Moon Spoke to Them', description: 'The change comes when they call it now, and only then.', baseWeight: 4, rarity: 'epic', grantTraits: ['moon_mastery'], epithet: { text: 'Moon-Master', priority: 54 }, nextStepId: null, color: '#9ab4e8', icon: 'Moon' },
    { id: 'wild_hunt', label: 'Joined the Wild Hunt', description: 'Antlered riders, hounds of smoke, a horn that wakes the dead. They ride with them now, one night a year.', baseWeight: 2, rarity: 'legendary', grantTraits: ['wild_hunt'], epithet: { text: 'Rider of the Wild Hunt', priority: 72 }, nextStepId: null, color: '#ffe08a', icon: 'Wind' },
  ],
};

const ALPHA_FIGHT = fightWheel({
  id: 'fight_alpha',
  title: 'The Alpha',
  subtitle: 'Teeth, and the whole pack watching.',
  foe: { name: 'The Alpha', power: 300 },
  foeOf: scaled('The Alpha', 0.9),
  deadliness: 0.25,
  victory: { label: 'Took the Pack', description: 'The old alpha limped away. The pack stayed.', grantTraits: ['pack_alpha'], epithet: { text: 'Alpha of the Pack', priority: 55 } },
  glory: { label: 'Every Pack Answers', description: 'Word ran from hill to hill. They lead them all now.', rarity: 'rare', grantTraits: ['pack_alpha', 'companion_wolf'] },
  legend: { label: 'Lord of Wolves', description: 'The beaten alpha bowed, and every wolf for a hundred miles bowed with it.', rarity: 'epic', grantTraits: ['werewolf_lord'], epithet: { text: 'Lord of Wolves', priority: 66 } },
  retreat: { label: 'Driven Off', description: 'Bitten, beaten, and howled out of the forest.' },
  slain: { label: 'Torn Apart', description: 'The pack had a new meal and kept its old alpha.' },
});

const DRAGON_HOARD: WheelStep = {
  id: 'dragon_hoard',
  title: 'Claim a Hoard',
  subtitle: 'Every dragon has one. A dragonborn should, too.',
  options: [
    { id: 'respectable_pile', label: 'A Respectable Pile', description: 'Not a mountain. A start.', baseWeight: 30, rarity: 'common', luckDelta: 0.5, nextStepId: null, color: '#d9a400', icon: 'Coins' },
    { id: 'took_from_a_drake', label: 'Took One From a Drake', description: 'A young drake, a short argument, a bigger pile.', baseWeight: 24, rarity: 'common', weaponTierDelta: 1, armorTierDelta: 1, meters: { wounds: 1 }, nextStepId: null, color: '#b8452a', icon: 'Flame' },
    { id: 'scales_like_iron', label: 'Scales Like Iron', description: 'Sleeping on gold does something to the hide.', baseWeight: 16, rarity: 'uncommon', armorTierDelta: 2, upgrade: true, nextStepId: null, color: '#8a6a3a', icon: 'Shield' },
    { id: 'a_dragon_noticed', label: 'A Dragon Noticed', description: 'A real one. It wants its gold back, and theirs too.', baseWeight: 14, rarity: 'uncommon', nextStepId: 'fight_dragon', color: '#7a2e2e', icon: 'Skull' },
    { id: 'wings_unfurl', label: 'Wings Unfurl', description: 'One morning, they simply had them.', baseWeight: 4, rarity: 'epic', grantTraits: ['dragon_wings'], epithet: { text: 'the Winged', priority: 58 }, nextStepId: null, color: '#c0569a', icon: 'Feather' },
    { id: 'dragon_council', label: 'Summoned by the Dragon Council', description: 'Seven great dragons on seven mountains, and an empty eighth seat.', baseWeight: 2, rarity: 'legendary', grantTraits: ['dragon_council'], epithet: { text: 'Voice of the Dragon Council', priority: 74 }, nextStepId: null, color: '#ffe08a', icon: 'Crown' },
  ],
};

const ARTIFICER: WheelStep = {
  id: 'artificer',
  title: 'The Artificer',
  subtitle: 'Oil, gears, and a workshop that smells of lightning.',
  options: [
    { id: 'full_repairs', label: 'Full Repairs', description: 'Every dent hammered out, every joint oiled.', baseWeight: 34, rarity: 'common', meters: { wounds: -4 }, statModifiers: { vitality: 1 }, nextStepId: null, color: '#6a7a8a', icon: 'Wrench' },
    { id: 'reinforced_plating', label: 'Reinforced Plating', description: 'Heavier. Much heavier. Worth it.', baseWeight: 24, rarity: 'common', armorTierDelta: 1, upgrade: true, meters: { wounds: -2 }, nextStepId: null, color: '#5f6470', icon: 'Shield' },
    { id: 'a_new_arm', label: 'A New Arm', description: 'Stronger than the old one. It occasionally waves on its own.', baseWeight: 16, rarity: 'uncommon', statModifiers: { might: 3 }, nextStepId: null, color: '#b8862e', icon: 'Cog' },
    { id: 'botched_upgrade', label: 'A Botched Upgrade', description: 'Something sparked. Something else stopped.', baseWeight: 12, rarity: 'uncommon', statModifiers: { agility: -1 }, meters: { wounds: 1 }, nextStepId: null, color: '#7a3a2e', icon: 'Zap' },
    { id: 'runic_core', label: 'A Runic Core', description: 'A heart of carved light, and it never stops.', baseWeight: 4, rarity: 'epic', grantTraits: ['runic_core'], statModifiers: { arcana: 3 }, epithet: { text: 'the Rune-Driven', priority: 52 }, nextStepId: null, color: '#3fa8a0', icon: 'Cpu' },
    { id: 'war_titan', label: 'Rebuilt as a War-Titan', description: 'Twice as tall. Four times as heavy. Every army in the realm wants one.', baseWeight: 2, rarity: 'legendary', grantTraits: ['war_titan'], epithet: { text: 'the War-Titan', priority: 78 }, nextStepId: null, color: '#ffb84d', icon: 'Bot' },
  ],
};

const RAISE_THE_DEAD: WheelStep = {
  id: 'raise_the_dead',
  title: 'Raise the Dead',
  subtitle: 'There are always more bones.',
  options: [
    { id: 'bone_servants', label: 'A Few Bone Servants', description: 'They clatter, but they listen.', baseWeight: 30, rarity: 'common', grantTraits: ['bone_servants'], nextStepId: null, color: '#c8c2b0', icon: 'Bone' },
    { id: 'robbed_a_graveyard', label: 'Robbed a Graveyard', description: 'The dead don’t need swords. The living noticed anyway.', baseWeight: 24, rarity: 'common', weaponTierDelta: 1, meters: { notoriety: 1 }, nextStepId: null, color: '#5a6478', icon: 'Shovel' },
    { id: 'they_turned', label: 'They Turned on Them', description: 'Bones have long memories, and some were not friends.', baseWeight: 14, rarity: 'uncommon', meters: { wounds: 2 }, nextStepId: null, color: '#7a2e2e', icon: 'HeartCrack' },
    { id: 'bone_legion', label: 'A Legion of the Dead', description: 'A graveyard’s worth of soldiers, and none of them complain.', baseWeight: 4, rarity: 'epic', grantTraits: ['bone_legion'], meters: { notoriety: 2 }, epithet: { text: 'Lord of Bones', priority: 60 }, nextStepId: null, color: '#4a2f7a', icon: 'Skull' },
    { id: 'spark_ignites', label: 'The Spark Ignites', description: 'Enough death in one place, and the skeleton becomes a Lich.', baseWeight: 2, rarity: 'legendary', condition: (_world, char) => char.race === 'skeleton', lockedReason: 'Already more than bones', setRace: 'lich', grantTraits: ['phylactery_spark'], epithet: { text: 'the Lich', priority: 70 }, nextStepId: null, color: '#7a5ad0', icon: 'Sparkles' },
  ],
};

// ─── Identities: what comes for them ────────────────────────────────────────

const VAMPIRE_HUNTERS = fightWheel({
  id: 'fight_vampire_hunters',
  title: 'Vampire Hunters',
  subtitle: 'Stakes, garlic, and a crossbow loaded with silver. The more notorious, the more of them.',
  foe: { name: 'The Hunters of the Order', power: 260 },
  foeOf: scaled('The Hunters of the Order', 0.7, (c) => 0.06 * meter(c, 'notoriety')),
  deadliness: 0.35,
  victory: { label: 'Fed on the Hunters', description: 'They brought stakes. They should have brought more friends.', meters: { hunger: -3 } },
  glory: { label: 'Turned the Hunter', description: 'Their leader serves the night now.', rarity: 'rare', grantTraits: ['vampire_thrall'], meters: { hunger: -2 } },
  legend: { label: 'The Order Breaks', description: 'The hunters’ order disbanded rather than send anyone else.', rarity: 'epic', grantTraits: ['feared'], meters: { notoriety: -5, hunger: -3 }, epithet: { text: 'the Order-Breaker', priority: 54 } },
  retreat: { label: 'Staked, Barely', description: 'An inch to the left, and it would have been the heart.' },
  slain: { label: 'Staked Through the Heart', description: 'The Order added a name to its book.' },
});

const SILVER_HUNTERS = fightWheel({
  id: 'fight_silver_hunters',
  title: 'Silver-Armed Hunters',
  subtitle: 'They know what comes out at the full moon, and they came early.',
  foe: { name: 'The Silver Company', power: 260 },
  foeOf: scaled('The Silver Company', 0.7, (c) => 0.06 * meter(c, 'notoriety')),
  deadliness: 0.35,
  victory: { label: 'Scattered Them', description: 'Silver is no use if you can’t hit anything with it.', statModifiers: { agility: 1 }, meters: { moon: -1 } },
  glory: { label: 'Kept Their Silver', description: 'A silver blade, in the hand of the thing it was made to kill.', rarity: 'rare', weaponTierDelta: 2 },
  legend: { label: 'The Hunters Join the Pack', description: 'They came to kill a monster. They found a leader.', rarity: 'epic', grantTraits: ['werewolf_lord'], epithet: { text: 'Lord of Wolves', priority: 66 } },
  retreat: { label: 'Silver in the Wound', description: 'It burns still.' },
  slain: { label: 'A Silver Bullet', description: 'The oldest story there is.' },
});

// ─── Hooks: paid off ────────────────────────────────────────────────────────

const FOLLOWER = fightWheel({
  id: 'fight_follower',
  title: 'It Found Them',
  subtitle: 'The thing that followed them home from the wilds, at the door at last.',
  foe: { name: 'The Thing From the Wilds', power: 220 },
  foeOf: scaled('The Thing From the Wilds', 0.75),
  deadliness: 0.25,
  victory: { label: 'Killed It', description: 'Finally. They sleep with the lamp on anyway.', removeTags: ['hook:followed'], statModifiers: { might: 1, agility: 1 } },
  glory: { label: 'Tamed It', description: 'It wasn’t hunting them. It was following its new master.', rarity: 'rare', removeTags: ['hook:followed'], grantTraits: ['shadow_hound'] },
  legend: { label: 'It Was a Guardian Spirit', description: 'It bowed, and took them to a place nobody has mapped.', rarity: 'epic', removeTags: ['hook:followed'], grantTraits: ['shadow_hound'], place: { discover: 'wild' }, epithet: { text: 'Spirit-Friend', priority: 48 } },
  retreat: { label: 'It Got Away', description: 'Into the dark. It will be back.' },
  slain: { label: 'It Took Them', description: 'Whatever it was, it had come a long way for this.' },
});

const GRAVE_KIN = fightWheel({
  id: 'fight_grave_kin',
  title: 'The Owner’s Kin',
  subtitle: 'They want their dead knight’s armour back, and they brought cousins.',
  foe: { name: 'The Dead Knight’s Kin', power: 200 },
  foeOf: scaled('The Dead Knight’s Kin', 0.7),
  deadliness: 0.15,
  victory: { label: 'Kept It, Fair and Square', description: 'Duelled for it, and won. It is theirs now by right.', removeTags: ['hook:grave_claim'], armorTierDelta: 1 },
  glory: { label: 'They Swore to Them Instead', description: '"He would have liked you." The family rides with them now.', rarity: 'rare', removeTags: ['hook:grave_claim'], grantTraits: ['ally_kin'] },
  legend: { label: 'Named Heir to the Knight', description: 'The knight had no heir. The family decided they would do.', rarity: 'epic', removeTags: ['hook:grave_claim'], grantTraits: ['ally_kin'], armorTierDelta: 2, epithet: { text: 'Heir of the Fallen Knight', priority: 48 } },
  retreat: { label: 'Gave It Back', description: 'Stripped in a ditch, and lucky to keep the boots.', removeTags: ['hook:grave_claim'], armorTierDelta: -2 },
  slain: { label: 'Buried in the Same Cairn', description: 'Next to the knight. In the armour.' },
});

const BLADE_DEMANDS: WheelStep = {
  id: 'blade_demands',
  title: 'The Blade Is Thirsty',
  subtitle: 'It has been whispering for weeks. Tonight it is shouting.',
  options: [
    { id: 'fed_it_a_bandit_lord', label: 'Fed It a Bandit Lord', description: 'Someone who had it coming. The blade did not care.', baseWeight: 34, rarity: 'common', removeTags: ['hook:blade_hungers'], statModifiers: { might: 2 }, nextStepId: null, color: '#6a3a8a', icon: 'Sword' },
    { id: 'it_bit_them', label: 'It Took a Bite of Them', description: 'If nobody else will feed it.', baseWeight: 26, rarity: 'common', meters: { wounds: 2 }, nextStepId: null, color: '#7a2e2e', icon: 'HeartCrack' },
    { id: 'fed_it_an_innocent', label: 'Fed It an Innocent', description: 'It moved their arm. That is what they tell themselves.', baseWeight: 14, rarity: 'uncommon', removeTags: ['hook:blade_hungers'], meters: { notoriety: 3 }, fame: -5, nextStepId: null, color: '#3a0a1a', icon: 'Skull' },
    { id: 'woke_its_name', label: 'Woke Its True Name', description: 'It told them what it is called. Now it obeys.', baseWeight: 3, rarity: 'legendary', removeTags: ['hook:blade_hungers'], grantTraits: ['blade_true_name'], weaponTierDelta: 2, upgrade: true, epithet: { text: 'Master of the Whispering Blade', priority: 70 }, nextStepId: null, color: '#ffe08a', icon: 'Sparkles' },
  ],
};

/** Learn a New Power from the Abyss leaves this debt (powers.ts); here it is collected. */
const ABYSS_COLLECTS: WheelStep = {
  id: 'abyss_collects',
  title: 'The Abyss Collects',
  subtitle: 'The voice that taught them is back, and it has brought the bill.',
  options: [
    { id: 'paid_in_blood', label: 'Paid in Blood', description: 'A season of fevers and black dreams. They wake up lighter, and weaker.', baseWeight: 30, rarity: 'common', removeTags: ['hook:abyss_debt'], statModifiers: { vitality: -2 }, meters: { wounds: 1 }, nextStepId: null, color: '#7a1c2e', icon: 'Droplet' },
    { id: 'paid_in_luck', label: 'Paid in Luck', description: 'It took something they never saw. Dice have rolled low ever since.', baseWeight: 26, rarity: 'common', removeTags: ['hook:abyss_debt'], luckDelta: -0.5, nextStepId: null, color: '#4a3a5a', icon: 'Dices' },
    { id: 'sent_a_collector', label: 'It Sent a Collector', description: 'They refused. So the Abyss sent someone who does not take no.', baseWeight: 20, rarity: 'uncommon', removeTags: ['hook:abyss_debt'], nextStepId: 'fight_champion', color: '#8a2e2e', icon: 'Swords' },
    { id: 'outwitted_it', statScaling: { intellect: 0.06 }, label: 'Talked Their Way Out', description: 'They found the loophole in the bargain. The Abyss hates a lawyer.', baseWeight: 12, rarity: 'rare', removeTags: ['hook:abyss_debt'], fame: 6, nextStepId: null, color: '#c9a24c', icon: 'Scale' },
    { id: 'another_bargain', label: 'Paid With a New Bargain', description: 'Debt, rolled into a bigger debt. Another gift, and its mark on their soul for good.', baseWeight: 8, rarity: 'epic', grantTags: ['marked'], nextStepId: POWER_WHEELS.corrupted, color: '#3a0a1a', icon: 'Flame' },
  ],
};

const MAP_CACHE: WheelStep = {
  id: 'map_cache',
  title: 'Where the Map Leads',
  subtitle: 'An X, a hill, and a lot of digging.',
  options: [
    { id: 'exactly_there', label: 'Exactly Where It Said', description: 'A good blade, wrapped in oilcloth.', baseWeight: 40, rarity: 'common', ...gearItem('weapon', 3, false), removeTags: ['hook:map'], nextStepId: null, color: '#a16207', icon: 'Sword' },
    { id: 'someone_first', label: 'Someone Got There First', description: 'They are still standing in the hole, and they are not friendly.', baseWeight: 30, rarity: 'common', removeTags: ['hook:map'], nextStepId: 'fight_bandits', color: '#a35d3a', icon: 'Swords' },
    { id: 'a_heros_grave', label: 'A Hero’s Grave', description: 'The map was a grave marker. The blade was in the grave. So was the armour.', baseWeight: 20, rarity: 'uncommon', ...gearItem('weapon', 4, false), grantTags: ['hook:grave_claim'], removeTags: ['hook:map'], nextStepId: null, color: '#5a6478', icon: 'Skull' },
    { id: 'blade_in_stone', label: 'A Blade in a Stone', description: 'It is speaking. It knows their name.', baseWeight: 4, rarity: 'legendary', removeTags: ['hook:map'], nextStepId: 'whispering_blade', color: '#ffb84d', icon: 'Sword' },
  ],
};

const MARGIN_NAME: WheelStep = {
  id: 'margin_name',
  title: 'The Name in the Margin',
  subtitle: 'Underlined twice. They finally found out whose it was.',
  options: [
    { id: 'a_forgotten_spell', label: 'A Forgotten Spell', description: 'The name was a spell. It still works.', baseWeight: 34, rarity: 'common', removeTags: ['hook:margin_name'], nextStepId: POWER_WHEELS.arcane, color: '#7a5ad0', icon: 'WandSparkles' },
    { id: 'a_door', label: 'A Door', description: 'The name was a password. The door was real.', baseWeight: 30, rarity: 'common', removeTags: ['hook:margin_name'], nextStepId: 'hidden_place', color: '#3fa8a0', icon: 'DoorOpen' },
    { id: 'a_sealed_soul', label: 'A Sealed Soul', description: 'The name was a hero’s, and the hero is in a relic, waiting.', baseWeight: 20, rarity: 'uncommon', condition: (world) => sealedSouls(world).length > 0, lockedReason: 'No soul has been bound to a relic yet', removeTags: ['hook:margin_name'], nextStepId: 'soul_relic', color: '#9a7ad0', icon: 'Gem' },
    { id: 'a_true_name', label: 'A True Name', description: 'The real name of something terrible. It listens when spoken.', baseWeight: 5, rarity: 'epic', grantTraits: ['true_name'], removeTags: ['hook:margin_name'], epithet: { text: 'Keeper of True Names', priority: 50 }, nextStepId: null, color: '#c9a24c', icon: 'ScrollText' },
  ],
};

const PROPHECY: WheelStep = {
  id: 'prophecy',
  title: 'The Prophecy Comes True',
  subtitle: 'They dreamed this. Now it is happening.',
  options: [
    { id: 'it_was_a_warning', label: 'It Was a Warning', description: 'They saw the ambush coming, and walked into it anyway. Prophecies are like that.', baseWeight: 30, rarity: 'common', meters: { wounds: 1 }, luckDelta: 0.5, nextStepId: null, color: '#6b7280', icon: 'Eye' },
    { id: 'someone_elses', label: 'It Was About Someone Else', description: 'Another hero, the one the prophecy meant. They do not like being second.', baseWeight: 24, rarity: 'common', grantTags: ['rival'], statModifiers: { intellect: 1 }, nextStepId: null, color: '#4f86b8', icon: 'Users' },
    { id: 'a_throne_promised', label: 'A Throne Was Promised', description: 'The dream showed a crown. Here is the crown.', baseWeight: 5, rarity: 'epic', nextStepId: 'thrones', color: '#ffb84d', icon: 'Crown' },
    { id: 'the_foretold', label: 'The Foretold One', description: 'Every word of it, true, and about them.', baseWeight: 3, rarity: 'legendary', grantTraits: ['foretold'], luckDelta: 1, epithet: { text: 'the Foretold', priority: 68 }, nextStepId: null, color: '#ffe08a', icon: 'Sparkles' },
  ],
};

const APEX = fightWheel({
  id: 'fight_apex',
  title: 'The Apex',
  subtitle: 'The thing that made the strange tracks. It was hunting the hunters.',
  foe: { name: 'The Apex', power: 400 },
  foeOf: scaled('The Apex', 1),
  deadliness: 0.3,
  victory: { label: 'Brought Down the Apex', description: 'Its skull hangs in the guildhall now.', removeTags: ['hook:strange_tracks'], grantTraits: ['beast_slayer'], fame: 10 },
  glory: { label: 'A Trophy for the Ages', description: 'Its hide, its teeth, and a bounty nobody else could claim.', rarity: 'rare', removeTags: ['hook:strange_tracks'], grantTraits: ['beast_slayer'], armorTierDelta: 2 },
  legend: { label: 'Tamed the Apex', description: 'They didn’t kill it. They looked it in the eye until it lay down.', rarity: 'legendary', removeTags: ['hook:strange_tracks'], grantTraits: ['apex_beast'], epithet: { text: 'the Beastlord', priority: 62 } },
  retreat: { label: 'It Let Them Go', description: 'It wasn’t hungry. Yet.' },
  slain: { label: 'Hunted', description: 'The hunter became the hunted.' },
});

const PRINCE_WAR = fightWheel({
  id: 'fight_prince_war',
  title: 'The Prince’s War',
  subtitle: 'An exiled prince, a borrowed army, and the usurper’s walls.',
  foe: { name: 'The Usurper’s Host', power: 600 },
  foeOf: scaled('The Usurper’s Host', 1.05),
  deadliness: 0.35,
  victory: { label: 'The Prince Is Crowned', description: 'And remembers who put the crown there.', removeTags: ['hook:exiled_prince'], grantTraits: ['royal_favor'], fame: 20, epithet: { text: 'the Kingmaker', priority: 64 } },
  glory: { label: 'Made Lord Protector', description: 'Lands, a castle, and the new king’s ear.', rarity: 'rare', removeTags: ['hook:exiled_prince'], grantTraits: ['royal_favor'], armorTierDelta: 2, fame: 25 },
  legend: {
    label: 'Named Heir to the Throne',
    description: 'The prince had no children. They had a friend. Their adventuring ends; a kingdom’s heir takes their place.',
    rarity: 'legendary',
    removeTags: ['hook:exiled_prince'],
    setRole: 'npc',
    grantTraits: ['ruler_heir'],
    grantTags: ['ruler'],
    epithet: { text: 'Heir to the Throne', priority: 90 },
    fate: 'Was named heir by the prince they put back on the throne',
  },
  retreat: { label: 'The Prince Fell', description: 'In the breach, sword in hand. The cause died with him.', removeTags: ['hook:exiled_prince'] },
  slain: { label: 'Died for a Prince', description: 'At the walls, beside him.' },
});

const RAID: WheelStep = {
  id: 'raid',
  title: 'The Band Rides Out',
  subtitle: 'Twenty cutthroats, one boss, and a road full of other people’s money.',
  options: [
    { id: 'rich_pickings', label: 'Rich Pickings', description: 'A merchant, a strongbox, nobody hurt. Much.', baseWeight: 30, rarity: 'common', luckDelta: 0.5, weaponTierDelta: 1, meters: { notoriety: 1 }, nextStepId: null, color: '#b8962e', icon: 'Coins' },
    { id: 'ran_into_the_watch', label: 'Ran Into the Watch', description: 'Arrows from the walls, and a long ride home.', baseWeight: 24, rarity: 'common', meters: { wounds: 1, notoriety: 1 }, nextStepId: null, color: '#7a2e2e', icon: 'HeartCrack' },
    { id: 'nobles_caravan', label: 'A Noble’s Caravan', description: 'Fine armour, fine horses, and a noble who will never forget their face.', baseWeight: 16, rarity: 'uncommon', armorTierDelta: 2, meters: { notoriety: 2 }, grantTags: ['hunted'], nextStepId: null, color: '#7a3e8a', icon: 'Crown' },
    { id: 'band_turned', label: 'The Band Turned on Them', description: 'Someone wanted to be boss. Someone is not boss, but the band is gone.', baseWeight: 12, rarity: 'uncommon', removeTraits: ['bandit_band'], meters: { wounds: 1 }, nextStepId: null, color: '#5a4a3a', icon: 'UserX' },
    { id: 'royal_treasury', label: 'Robbed the Royal Treasury', description: 'The crown jewels, a whole season of taxes, and the most famous heist in history.', baseWeight: 3, rarity: 'legendary', luckDelta: 1, armorTierDelta: 2, weaponTierDelta: 2, meters: { notoriety: 4 }, fame: 15, epithet: { text: 'the Treasury-Thief', priority: 60 }, nextStepId: null, color: '#ffb84d', icon: 'Gem' },
  ],
};

// ─── Offers: the decisions worth making ─────────────────────────────────────

const THE_BITE: WheelStep = {
  id: 'the_bite',
  title: 'A Vampire Offers the Gift',
  subtitle: 'Eternal life, a terrible diet, and a debt to whoever made you. Say yes, or say no with steel.',
  choice: true,
  options: [
    { id: 'accept_the_gift', label: 'Accept the Gift', description: 'Become a vampire: the Hunt, Drain, the Night Court, and a Hunger that never stops.', baseWeight: 50, rarity: 'common', setRace: 'vampire', grantTraits: ['vampiric'], meters: { hunger: 1 }, epithet: { text: 'the Turned', priority: 35 }, nextStepId: null, color: '#8a1c2e', icon: 'Droplets' },
    { id: 'refuse_with_steel', label: 'Refuse, With Steel', description: 'Fight an elder vampire. Win and become a legend; lose and be turned anyway, or worse.', baseWeight: 30, rarity: 'uncommon', nextStepId: 'fight_elder_vampire', color: '#a35d3a', icon: 'Swords' },
    { id: 'run_for_the_dawn', label: 'Run for the Dawn', description: 'Safe, if they are fast enough. They will be bleeding.', baseWeight: 20, rarity: 'uncommon', meters: { wounds: 1 }, nextStepId: null, color: '#f0c06a', icon: 'Sunrise' },
    { id: 'demand_to_be_an_elder', label: 'Demand to Be Made an Elder', description: 'Not a fledgling: all of its centuries, at once. The Hunger starts almost full.', baseWeight: 8, rarity: 'epic', setRace: 'vampire', grantTraits: ['vampiric', 'ancient_blood'], meters: { hunger: 4 }, epithet: { text: 'the Ancient', priority: 60 }, nextStepId: null, color: '#ffb84d', icon: 'Hourglass' },
  ],
};

const ELDER_VAMPIRE = fightWheel({
  id: 'fight_elder_vampire',
  title: 'The Elder Vampire',
  subtitle: 'Older than the kingdom, and offended.',
  foe: { name: 'An Elder Vampire', power: 450 },
  foeOf: scaled('An Elder Vampire', 1.05),
  deadliness: 0.2,
  victory: { label: 'Staked the Elder', description: 'Dust, a ring, and a very long silence.', grantTraits: ['vampire_slayer'], epithet: { text: 'the Vampire-Slayer', priority: 50 } },
  glory: { label: 'Took Its Ring', description: 'A signet older than any crown. Doors open for it.', rarity: 'rare', grantTraits: ['vampire_slayer'], luckDelta: 0.5 },
  legend: { label: 'Drank From the Elder', description: 'They won, and drank, and woke up as something much worse than a fledgling.', rarity: 'legendary', setRace: 'vampire', grantTraits: ['vampiric', 'eldest_blood'], epithet: { text: 'the Elder-Drinker', priority: 70 } },
  retreat: { label: 'Turned Anyway', description: 'It won. It gave the gift regardless. Being refused is very rude.', setRace: 'vampire', grantTraits: ['vampiric'], meters: { hunger: 2 }, epithet: { text: 'the Unwilling', priority: 36 } },
  slain: { label: 'Drained', description: 'There is a pale shape in a crypt that looks like them.' },
});

const ABYSS_OFFER: WheelStep = {
  id: 'abyss_offer',
  title: 'The Abyss Opens',
  subtitle: 'It offers everything. It wants everything. It will take a bargain, if they are bold.',
  choice: true,
  options: [
    {
      id: 'embrace_it',
      label: 'Embrace It',
      description: 'A demon now, in body and in loyalty, and straight into the Demon Lord’s army. Their story as a hero ends.',
      baseWeight: 40,
      rarity: 'common',
      setRole: 'minion',
      grantTags: ['corrupted', 'fiend'],
      grantTraits: ['demonic_corruption', 'abyssal_pact'],
      epithet: { text: 'Claimed by the Abyss', priority: 66 },
      nextStepId: null,
      color: '#7f1d2e',
      icon: 'Flame',
    },
    { id: 'resist_it', label: 'Resist It', description: 'Arcana and will against the dark. Win, and walk away stronger. Lose, and it takes them anyway.', baseWeight: 40, rarity: 'common', nextStepId: 'abyss_resist', color: '#4f6f8f', icon: 'ShieldCheck' },
    { id: 'bargain', label: 'Bargain for Its Power', description: 'The power without the leash. For now. Notoriety rises, and the Abyss remembers the deal.', baseWeight: 15, rarity: 'rare', grantTraits: ['demonic_corruption'], grantTags: ['corrupted', 'marked'], meters: { notoriety: 2 }, epithet: { text: 'the Abyss-Touched', priority: 45 }, nextStepId: null, color: '#5a1a3a', icon: 'Handshake' },
    {
      id: 'demand_the_throne',
      label: 'Demand to Be Its Heir',
      description: 'Not a soldier: the next Demon Lord. The Abyss is impressed. Their story as a hero ends.',
      baseWeight: 8,
      rarity: 'epic',
      condition: (_world, char) => !isUncorruptable(char) && char.personality !== 'honorable',
      lockedReason: 'Only a heart that could rule the dark would ask',
      setRole: 'minion',
      grantTags: ['corrupted', 'fiend'],
      grantTraits: ['demonic_corruption', 'abyssal_pact', 'abyss_heir'],
      epithet: { text: 'Heir of the Abyss', priority: 85 },
      fate: 'Asked the Abyss for its throne, and was named the Demon Lord’s heir',
      nextStepId: null,
      color: '#ffb84d',
      icon: 'Crown',
    },
  ],
};

const ABYSS_RESIST: WheelStep = {
  id: 'abyss_resist',
  title: 'Breaking the Chain',
  subtitle: 'Will against the Abyss (Arcana and Intellect help).',
  options: [
    { id: 'broke_free', statScaling: { arcana: 0.03, intellect: 0.02 }, label: 'Broke Free', description: 'It let go. It will remember them.', baseWeight: 45, rarity: 'common', grantTags: ['marked'], statModifiers: { arcana: 1 }, nextStepId: null, color: '#4f6f8f', icon: 'ShieldCheck' },
    { id: 'scarred_by_it', label: 'Scarred by It', description: 'They won, and it cost them.', baseWeight: 30, rarity: 'common', meters: { wounds: 2 }, nextStepId: null, color: '#6e1f2a', icon: 'HeartCrack' },
    {
      ...notIf(isUncorruptable, 'Uncorruptable: no darkness can take root in them'),
      id: 'dragged_down',
      label: 'Dragged Down',
      description: 'It was stronger. A demon climbs back out wearing their face.',
      baseWeight: 18,
      rarity: 'uncommon',
      setRole: 'minion',
      grantTags: ['corrupted', 'fiend'],
      grantTraits: ['demonic_corruption', 'abyssal_pact'],
      fate: 'Dragged down into the Abyss, and sent back as its champion',
      nextStepId: null,
      color: '#3a0a1a',
      icon: 'Flame',
    },
    { id: 'burned_it_out', label: 'Burned It Out of Themselves', description: 'Every trace of the Abyss, burned away. It will never try again.', baseWeight: 6, rarity: 'epic', grantTraits: ['abyss_scarred'], epithet: { text: 'the Unclaimed', priority: 58 }, nextStepId: null, color: '#f0e6c8', icon: 'Sun' },
  ],
};

const WHISPERING_BLADE: WheelStep = {
  id: 'whispering_blade',
  title: 'The Blade Chooses You',
  subtitle: 'A sword in a stone, and it is speaking. It wants a wielder. It wants blood.',
  choice: true,
  options: [
    {
      id: 'take_it',
      label: 'Take It',
      description: 'A power 6 blade with a will of its own, and a new way to win every fight. It will get thirsty.',
      baseWeight: 50,
      rarity: 'common',
      gear: { weapon: { unique: 'whispering_blade' } },
      grantTags: ['hook:blade_hungers'],
      epithet: { text: 'Bearer of the Whispering Blade', priority: 64 },
      nextStepId: null,
      color: '#6a3a8a',
      icon: 'Sword',
    },
    { id: 'leave_it', label: 'Leave It in the Stone', description: 'Some gifts are traps with handles. Luck for the wisdom.', baseWeight: 50, rarity: 'common', luckDelta: 0.5, nextStepId: null, color: '#4f6f8f', icon: 'Ban' },
    {
      id: 'speak_its_name',
      label: 'Speak Its True Name',
      description: 'It obeys whoever knows its name. A blade that never gets thirsty, and obeys.',
      baseWeight: 10,
      rarity: 'legendary',
      condition: (_world, char) => hasTrait(char, 'true_name') || hasTrait(char, 'blade_true_name'),
      lockedReason: 'Only someone who knows a true name can command it',
      gear: { weapon: { unique: 'whispering_blade' } },
      grantTraits: ['blade_true_name'],
      epithet: { text: 'Master of the Whispering Blade', priority: 70 },
      nextStepId: null,
      color: '#ffe08a',
      icon: 'Sparkles',
    },
  ],
};

// ─── Registered ─────────────────────────────────────────────────────────────

export const STAKES_STEPS: WheelStep[] = [
  FESTERING,
  BOUNTY,
  FRENZY,
  FULL_MOON,
  PLACE_RETURN,
  PLACE_GUARDIAN,
  GOD_BARGAIN,
  SLEEPING_GOD,
  SKY_DOOR,
  LOST_CITY,
  THE_HUNT,
  NIGHT_COURT,
  NIGHT_COURT_FIGHT,
  PACK_RUN,
  ALPHA_FIGHT,
  DRAGON_HOARD,
  ARTIFICER,
  RAISE_THE_DEAD,
  VAMPIRE_HUNTERS,
  SILVER_HUNTERS,
  FOLLOWER,
  GRAVE_KIN,
  BLADE_DEMANDS,
  ABYSS_COLLECTS,
  MAP_CACHE,
  MARGIN_NAME,
  PROPHECY,
  APEX,
  PRINCE_WAR,
  RAID,
  THE_BITE,
  ELDER_VAMPIRE,
  ABYSS_OFFER,
  ABYSS_RESIST,
  WHISPERING_BLADE,
];
