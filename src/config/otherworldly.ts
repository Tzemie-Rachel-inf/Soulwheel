/**
 * The otherworldly ancestries: Gods, Demons, Angels and Constructs.
 *
 *   God ──▶ Domain ─┬─ Life / Death / Time / Justice / Magic / Space ──┐
 *                   ├─ Multi Domain (two more Domain spins) ───────────┤
 *                   └─ Minor Domain ─┬─ Fertility, Harvest... ─────────┤
 *                                    ├─ One of the Races ──▶ which ────┤
 *                                    └─ War ──▶ strategic or brutal ───┴──▶ Archetype
 *   Demon ──▶ Born or Made? ─┬─ natural ──▶ Sin (sets the race: lust ──▶ Succubus or Incubus) ──▶ Archetype
 *                            └─ corrupted ──▶ Ancestry again (no Demon) ──▶ that race's wheels ──▶ Sin ──▶ Archetype
 *   Angel ──▶ Born or Raised? ─┬─ natural ──▶ which door of heaven ──▶ Virtue ──▶ Archetype
 *                              └─ ascended ──▶ Ancestry again (no Angel) ──▶ that race's wheels ──▶ Virtue ──▶ Archetype
 *   Construct ──▶ what kind ──(undead ──▶ Ancestry again (no Construct) ──▶ that race's wheels)──▶ Archetype
 *   Hybrid ──▶ Ancestry (no Hybrid) ──▶ its wheels ──▶ Ancestry again ──▶ its wheels ──▶ Archetype
 *
 * "Ancestry again" is the very wheel every soul starts on, so everything stacks: a corrupted
 * elf rolls their elven line, a hybrid gets both races' wheels. The wheel that comes after the
 * detour (Sin, Virtue, the hybrid's second Ancestry) waits in the spin queue; whenever a race's
 * wheels would end at Archetype, `REJOIN` sends them back to the newest such wheel first.
 *
 * Every domain belongs to one god at a time (`claimSingleton`). Demons owe a Corrupted
 * power spin, angels a Blessed one, gods three Blessed (see powers.ts), and the Abyss
 * almost always claims demons, almost never angels (gameConfig.ts, The Abyss Calls).
 * Natural demons and angels are stronger than the mortals corrupted or raised into them.
 */
import type { Character, Rarity, StepRoute, Trait, WheelOption, WheelStep, World } from '../engine/types';
import { ANCESTRY_OPTIONS, ARCHETYPE_STEP, BLOOD_TAG, RACES, type RaceId } from './races';

// ─── Traits ─────────────────────────────────────────────────────────────────

export const OTHERWORLDLY_TRAITS = {
  // Gods
  domain_life: { id: 'domain_life', name: 'Domain of Life', description: 'Every living thing leans toward them.', power: 40 },
  domain_death: { id: 'domain_death', name: 'Domain of Death', description: 'The last door opens at their word.', power: 45 },
  domain_time: { id: 'domain_time', name: 'Domain of Time', description: 'The hours run slower near them.', power: 45 },
  uncorruptable: { id: 'uncorruptable', name: 'Uncorruptable', description: 'No darkness can take root in them. They never kneel, never turn.', power: 30 },
  domain_magic: { id: 'domain_magic', name: 'Domain of Magic', description: 'Every spell ever cast was a little bit theirs.', power: 40, scalesWith: ['arcana'] },
  cosmic_scale: { id: 'cosmic_scale', name: 'Cosmic Scale', description: 'A god of Space: their power is measured against the stars. ×10 Combat Power.', power: 0, multiplier: 10 },
  minor_divinity: { id: 'minor_divinity', name: 'Minor Divinity', description: 'Small prayers, faithfully answered.', power: 20 },
  lord_of_the_underworld: { id: 'lord_of_the_underworld', name: 'Lord of the Underworld', description: 'The dead have a king, and it is them.', power: 60 },
  // Demons
  true_demon: { id: 'true_demon', name: 'True Demon', description: 'Born in the Abyss, not dragged there.', power: 60 },
  demonic_corruption: { id: 'demonic_corruption', name: 'Demonic Corruption', description: 'Once mortal. The Abyss got in, and stayed.', power: 25 },
  // Angels
  born_of_light: { id: 'born_of_light', name: 'Born of Light', description: 'A true angel: light made flesh.', power: 60 },
  ascended_soul: { id: 'ascended_soul', name: 'Ascended Soul', description: 'Once mortal. The light reached down and lifted them.', power: 25 },
  // Constructs
  ancient_core: { id: 'ancient_core', name: 'Ancient Core', description: 'Built before the first kingdom, and still running.', power: 100 },
  masterwork_frame: { id: 'masterwork_frame', name: 'Masterwork Frame', description: 'Every rivet set by a dwarven master.', power: 60 },
  unstable_experiment: { id: 'unstable_experiment', name: 'Unstable Experiment', description: 'It works. Nobody knows why. Nobody wants to check.', power: 30 },
  golem_core: { id: 'golem_core', name: 'Golem Core', description: 'A rune-heart beating in a body of stone.', power: 35 },
  reanimated: { id: 'reanimated', name: 'Reanimated', description: 'Stitched together and brought back. It remembers some of it.', power: 20 },
} satisfies Record<string, Trait>;

/** A small, stable "random" number per character, for options that differ from soul to soul. */
function soulHash(char: Character): number {
  let h = 0;
  for (const ch of char.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// ─── Ancestry, again ────────────────────────────────────────────────────────

/** Wheels a detour through Ancestry comes back to, once that race's own wheels are done. */
const RETURN_STEPS = ['fallen_sin', 'angel_virtue', 'hybrid_second'];

/**
 * Every race wheel ends at Archetype; this sends the character back to the newest wheel a
 * detour left waiting in their spin queue first (innermost detour first), else on to Archetype.
 */
export const REJOIN: StepRoute = {
  among: [ARCHETYPE_STEP, ...RETURN_STEPS],
  pick: (_world, char) => char.spinQueue.findLast((id) => RETURN_STEPS.includes(id)) ?? ARCHETYPE_STEP,
};

/** A creation wheel whose ways to Archetype (plain or routed) go through `REJOIN` first. */
export function rejoining(step: WheelStep): WheelStep {
  const reroute = (next: WheelOption['nextStepId']): WheelOption['nextStepId'] => {
    if (next === ARCHETYPE_STEP) return REJOIN;
    if (next === null || typeof next === 'string' || !next.among.includes(ARCHETYPE_STEP)) return next;
    return {
      among: [...new Set([...next.among, ...REJOIN.among])],
      pick: (world, char) => {
        const picked = next.pick(world, char);
        return picked === ARCHETYPE_STEP ? REJOIN.pick(world, char) : picked;
      },
    };
  };
  return { ...step, options: step.options.map((o) => ({ ...o, nextStepId: reroute(o.nextStepId) })) };
}

/** Origins that can be taken only once per soul: the tag each leaves behind. */
const ONCE_ONLY: Record<string, { tag: string; reason: string }> = {
  demon: { tag: 'fiend', reason: 'Already a demon' },
  celestial: { tag: 'angel', reason: 'Already an angel' },
  construct: { tag: 'construct', reason: 'Already a construct' },
  god: { tag: 'divine', reason: 'Already a god' },
  hybrid: { tag: 'hybrid', reason: 'Already two bloodlines' },
};

/**
 * The Ancestry wheel again, without the origin that sent them here (`without`). Origins the
 * soul already took are locked, so detours can nest but never loop. `extra` adds per-slice
 * twists, such as the Fallen Angel's epithet.
 */
function ancestryMirror(
  id: string,
  title: string,
  subtitle: string,
  without: string,
  extra: Record<string, Partial<WheelOption>> = {},
): WheelStep {
  return {
    id,
    title,
    subtitle,
    repeats: true, // a soul can pass through Ancestry more than once; the locks keep it finite
    options: ANCESTRY_OPTIONS.filter((o) => o.id !== without).map((o) => {
      const once = ONCE_ONLY[o.id];
      return {
        ...o,
        ...(once && { condition: (_world: World, char: Character) => !char.tags.includes(once.tag), lockedReason: once.reason }),
        ...extra[o.id],
      };
    }),
  };
}

// ─── Gods ───────────────────────────────────────────────────────────────────

/** After a domain: back to the Domain wheel while a Multi Domain owes spins there, else on to Archetype. */
const DOMAIN_NEXT: StepRoute = {
  among: ['god_domain', ARCHETYPE_STEP],
  pick: (_world, char) => (char.spinQueue.includes('god_domain') ? 'god_domain' : ARCHETYPE_STEP),
};

/**
 * One domain, held by one god at a time. A god rolling several domains (Multi Domain)
 * can't land on one they already hold.
 */
function domain(key: string, name: string): Pick<WheelOption, 'claimSingleton' | 'condition' | 'lockedReason'> {
  const singleton = `domain_${key}`;
  return {
    claimSingleton: singleton,
    condition: (_world: World, char: Character) => !char.singletonClaims.includes(singleton),
    lockedReason: (_world: World, char: Character) =>
      char.singletonClaims.includes(singleton) ? 'Already theirs' : `Another god already rules ${name}`,
  };
}

const GOD_DOMAIN: WheelStep = {
  id: 'god_domain',
  title: 'Which Domain Is Yours?',
  subtitle: 'Every domain has exactly one god. Which one is free?',
  repeats: true, // Multi Domain comes back here
  options: [
    { id: 'minor_domain', label: 'A Minor Domain', description: 'Not the sky or the sea. Something smaller, and dearer to someone.', baseWeight: 44, rarity: 'common', nextStepId: 'minor_domain', color: '#a08a5a', icon: 'Sprout' },
    { ...domain('life', 'Life'), id: 'life', label: 'Life', description: 'Birth, healing, and one more Blessed power.', baseWeight: 8, rarity: 'uncommon', grantTraits: ['domain_life'], queueSpins: { blessed_powers: 1 }, epithet: { text: 'God of Life', priority: 86 }, nextStepId: DOMAIN_NEXT, color: '#6cc78a', icon: 'HeartPulse' },
    { ...domain('death', 'Death'), id: 'death', label: 'Death', description: 'The last door, and a Corrupted power to guard it.', baseWeight: 8, rarity: 'uncommon', grantTraits: ['domain_death'], queueSpins: { corrupted_powers: 1 }, epithet: { text: 'God of Death', priority: 86 }, nextStepId: DOMAIN_NEXT, color: '#4a4a5a', icon: 'Skull' },
    { ...domain('time', 'Time'), id: 'time', label: 'Time', description: 'Past and future, and one more Arcane power.', baseWeight: 8, rarity: 'uncommon', grantTraits: ['domain_time'], queueSpins: { arcane_powers: 1 }, epithet: { text: 'God of Time', priority: 86 }, nextStepId: DOMAIN_NEXT, color: '#c9b27a', icon: 'Hourglass' },
    { ...domain('justice', 'Justice'), id: 'justice', label: 'Justice', description: 'Law and judgement. They can never be corrupted.', baseWeight: 8, rarity: 'uncommon', grantTraits: ['uncorruptable'], epithet: { text: 'God of Justice', priority: 86 }, nextStepId: DOMAIN_NEXT, color: '#d9c27a', icon: 'Scale' },
    { ...domain('magic', 'Magic'), id: 'magic', label: 'Magic', description: 'Every spell, and two more Arcane powers.', baseWeight: 8, rarity: 'uncommon', grantTraits: ['domain_magic'], queueSpins: { arcane_powers: 2 }, epithet: { text: 'God of Magic', priority: 86 }, nextStepId: DOMAIN_NEXT, color: '#8a6ae0', icon: 'WandSparkles' },
    { ...domain('space', 'Space'), id: 'space', label: 'Space', description: 'The void between the stars. Ten times the Combat Power.', baseWeight: 8, rarity: 'uncommon', grantTraits: ['cosmic_scale'], epithet: { text: 'God of Space', priority: 86 }, nextStepId: DOMAIN_NEXT, color: '#2a2f6e', icon: 'Orbit' },
    {
      id: 'multi_domain',
      label: 'Many Domains',
      description: 'One domain was never going to be enough. Spin for two more.',
      baseWeight: 2,
      rarity: 'legendary',
      queueSpins: { god_domain: 2 },
      condition: (_world, char) => !char.spinQueue.includes('god_domain'),
      lockedReason: 'Already gathering domains',
      epithet: { text: 'of Many Domains', priority: 84 },
      nextStepId: DOMAIN_NEXT,
      color: '#ffb84d',
      icon: 'Layers',
    },
  ],
};

const MISCHIEF_TIERS: { rarity: Rarity; baseWeight: number }[] = [
  { rarity: 'common', baseWeight: 12 },
  { rarity: 'uncommon', baseWeight: 6 },
  { rarity: 'rare', baseWeight: 4 },
  { rarity: 'epic', baseWeight: 2 },
];

const minor = (key: string, name: string, title: string) => ({
  ...domain(key, name),
  grantTraits: ['minor_divinity'],
  epithet: { text: title, priority: 80 },
  nextStepId: DOMAIN_NEXT,
});

const MINOR_DOMAIN: WheelStep = {
  id: 'minor_domain',
  title: 'Which Minor Domain?',
  subtitle: 'Small domains, devoted followers.',
  options: [
    { ...minor('fertility', 'Fertility', 'God of Fertility'), id: 'fertility', label: 'Fertility', baseWeight: 12, rarity: 'common', statBonus: { vitality: 1 }, color: '#8ac46a', icon: 'Sprout' },
    { id: 'one_of_races', label: 'One of the Races', description: 'A people, and their prayers. Which people?', baseWeight: 12, rarity: 'common', nextStepId: 'god_of_race', color: '#b8a07a', icon: 'Users' },
    { ...minor('harvest', 'the Harvest', 'God of the Harvest'), id: 'harvest', label: 'Harvest', baseWeight: 12, rarity: 'common', statBonus: { vitality: 1 }, color: '#c9a24c', icon: 'Wheat' },
    { ...minor('family', 'Family', 'God of Hearth and Family'), id: 'family', label: 'Family', baseWeight: 12, rarity: 'common', luckDelta: 0.25, color: '#c2874f', icon: 'House' },
    { ...minor('nature', 'Nature', 'God of Nature'), id: 'nature', label: 'Nature', baseWeight: 12, rarity: 'common', statBonus: { arcana: 1 }, color: '#3f8a4a', icon: 'Trees' },
    { ...minor('animals', 'the Beasts', 'God of Beasts'), id: 'animals', label: 'Animals', baseWeight: 12, rarity: 'common', statBonus: { agility: 1 }, color: '#8a6a3a', icon: 'PawPrint' },
    {
      ...minor('mischief', 'Mischief', 'God of Mischief'),
      id: 'mischief',
      label: 'Mischief',
      description: 'A trickster domain. Even its odds are a joke: anywhere from common to epic.',
      baseWeight: 12,
      rarity: 'common',
      vary: (char) => MISCHIEF_TIERS[soulHash(char) % MISCHIEF_TIERS.length]!,
      luckDelta: 0.5,
      color: '#b85ac9',
      icon: 'VenetianMask',
    },
    { id: 'lost_things', label: 'Lost Things', description: 'Keys, socks, and causes. Nobody else wanted it.', baseWeight: 12, rarity: 'common', grantTraits: ['minor_divinity'], epithet: { text: 'God of Lost Things', priority: 78 }, nextStepId: DOMAIN_NEXT, color: '#7a7f8c', icon: 'Search' },
    { ...minor('water', 'the Seas', 'God of the Seas'), id: 'water', label: 'Water', baseWeight: 6, rarity: 'uncommon', statBonus: { vitality: 1, agility: 1 }, color: '#3f7ab8', icon: 'WavesHorizontal' },
    { ...minor('air', 'the Winds', 'God of the Winds'), id: 'air', label: 'Air', baseWeight: 6, rarity: 'uncommon', statBonus: { agility: 2 }, color: '#9ac4e0', icon: 'Wind' },
    { ...minor('love', 'Love', 'God of Love'), id: 'love', label: 'Love', baseWeight: 6, rarity: 'uncommon', luckDelta: 0.5, color: '#e06a8a', icon: 'Heart' },
    {
      ...minor('underworld', 'the Underworld', 'God of the Underworld'),
      id: 'underworld',
      label: 'Underworld',
      description: 'The dead have a king.',
      baseWeight: 2,
      rarity: 'epic',
      grantTraits: ['lord_of_the_underworld'],
      epithet: { text: 'God of the Underworld', priority: 84 },
      color: '#3a2f4f',
      icon: 'Ghost',
    },
    {
      ...minor('war', 'War', 'God of War'),
      id: 'war',
      label: 'War',
      description: 'Every battlefield is a temple. But what kind of war?',
      baseWeight: 2,
      rarity: 'epic',
      statBonus: { might: 2 },
      epithet: { text: 'God of War', priority: 82 },
      nextStepId: 'war_style',
      color: '#b8323a',
      icon: 'Swords',
    },
  ],
};

const WAR_STYLE: WheelStep = {
  id: 'war_style',
  title: 'What Kind of War?',
  subtitle: 'Some gods love a plan. Some love the screaming.',
  options: [
    { id: 'strategic', label: 'Strategic War', description: 'Every battle won before it starts.', baseWeight: 50, rarity: 'common', statBonus: { intellect: 3 }, epithet: { text: 'God of Strategy', priority: 83 }, nextStepId: DOMAIN_NEXT, color: '#4f6f8f', icon: 'Brain' },
    { id: 'war_itself', label: 'War Itself', description: 'Not a god of war. War, with a face.', baseWeight: 3, rarity: 'legendary', statBonus: { might: 3, intellect: 3 }, epithet: { text: 'War Incarnate', priority: 90 }, nextStepId: DOMAIN_NEXT, color: '#ffb84d', icon: 'Swords' },
    { id: 'brutal', label: 'Brutal War', description: 'No plan. Just the charge.', baseWeight: 50, rarity: 'common', statBonus: { might: 3 }, epithet: { text: 'God of Slaughter', priority: 83 }, nextStepId: DOMAIN_NEXT, color: '#8a2e2e', icon: 'Axe' },
  ],
};

/** "One of the races": a mirror of Ancestry, every people equally likely, except gods, who stay legendary. */
const PEOPLES: { id: string; label: string; plural: string; color: string; icon: string }[] = [
  { id: 'human', label: 'Humans', plural: 'Humans', color: '#c2874f', icon: 'User' },
  { id: 'elf', label: 'Elves', plural: 'Elves', color: '#2f9e7a', icon: 'Leaf' },
  { id: 'dwarf', label: 'Dwarves', plural: 'Dwarves', color: '#9b4d32', icon: 'Pickaxe' },
  { id: 'orc', label: 'Orcs', plural: 'Orcs', color: '#5d7d24', icon: 'BicepsFlexed' },
  { id: 'halfling', label: 'Halflings', plural: 'Halflings', color: '#4f86b8', icon: 'Clover' },
  { id: 'gnome', label: 'Gnomes', plural: 'Gnomes', color: '#b06ab8', icon: 'Cog' },
  { id: 'monster', label: 'Monsters', plural: 'Monsters', color: '#5c4b3c', icon: 'PawPrint' },
  { id: 'dragonborn', label: 'Dragonborn', plural: 'the Dragonborn', color: '#b8323a', icon: 'Egg' },
  { id: 'construct', label: 'Constructs', plural: 'Constructs', color: '#8a8f9a', icon: 'Bot' },
  { id: 'angel', label: 'Angels', plural: 'Angels', color: '#e9dcae', icon: 'Feather' },
  { id: 'demon', label: 'Demons', plural: 'Demons', color: '#9a1c2e', icon: 'Flame' },
];

const GOD_OF_RACE: WheelStep = {
  id: 'god_of_race',
  title: 'Whose God Are You?',
  subtitle: 'Every people prays to someone. Equal odds, except the gods themselves.',
  options: [
    ...PEOPLES.map(
      (p): WheelOption => ({
        ...domain(`people_${p.id}`, p.plural),
        id: p.id,
        label: p.label,
        description: `The god ${p.plural === 'the Dragonborn' ? 'the Dragonborn pray' : `${p.plural} pray`} to.`,
        baseWeight: 10,
        rarity: 'common',
        grantTraits: ['minor_divinity'],
        epithet: { text: `God of ${p.plural === 'the Dragonborn' ? 'the Dragonborn' : p.plural}`, priority: 81 },
        nextStepId: DOMAIN_NEXT,
        color: p.color,
        icon: p.icon,
      }),
    ),
    { id: 'forgotten', label: 'A Forgotten People', description: 'Their last worshipper died long ago. The god stayed anyway.', baseWeight: 10, rarity: 'common', grantTraits: ['minor_divinity'], epithet: { text: 'God of the Forgotten', priority: 81 }, nextStepId: DOMAIN_NEXT, color: '#6e6a62', icon: 'Ghost' },
    {
      ...domain('people_gods', 'the Gods'),
      id: 'gods',
      label: 'The Gods',
      description: 'The god that gods pray to.',
      baseWeight: 1,
      rarity: 'legendary',
      grantTraits: ['minor_divinity'],
      luckDelta: 0.5,
      epithet: { text: 'God of Gods', priority: 96 },
      nextStepId: DOMAIN_NEXT,
      color: '#ffe08a',
      icon: 'Sun',
    },
  ],
};

// ─── Demons ─────────────────────────────────────────────────────────────────

const SINS: { id: string; name: string; adjective: string; race: RaceId | null; bonus: WheelOption['statBonus']; luck?: number; color: string; icon: string }[] = [
  { id: 'pride', name: 'Pride', adjective: 'the Proud', race: 'archfiend', bonus: { intellect: 1, arcana: 1 }, luck: 0.25, color: '#7a2a8a', icon: 'Crown' },
  { id: 'greed', name: 'Greed', adjective: 'the Insatiable', race: 'hoardfiend', bonus: {}, luck: 0.5, color: '#b8962e', icon: 'Coins' },
  { id: 'lust', name: 'Lust', adjective: 'the Lustful', race: null, bonus: { agility: 1, arcana: 1 }, color: '#c0306a', icon: 'Heart' },
  { id: 'envy', name: 'Envy', adjective: 'the Envious', race: 'doppelganger', bonus: { intellect: 2 }, color: '#3f8a4a', icon: 'Eye' },
  { id: 'gluttony', name: 'Gluttony', adjective: 'the Gluttonous', race: 'maw_demon', bonus: { vitality: 3, agility: -1 }, color: '#8a5a2e', icon: 'Utensils' },
  { id: 'wrath', name: 'Wrath', adjective: 'the Wrathful', race: 'balor', bonus: { might: 3 }, color: '#b8323a', icon: 'Flame' },
  { id: 'sloth', name: 'Sloth', adjective: 'the Slothful', race: 'dreamfiend', bonus: { vitality: 2, agility: -1, arcana: 1 }, color: '#4a5a7a', icon: 'Moon' },
];

const FIEND_ORIGIN: WheelStep = {
  id: 'fiend_origin',
  title: 'Born a Demon, or Made One?',
  subtitle: 'Half the Abyss was born there. The other half fell in.',
  options: [
    { id: 'natural', label: 'Born of the Abyss', description: 'A true demon: stronger than any mortal it corrupts.', baseWeight: 50, rarity: 'common', grantTraits: ['true_demon'], nextStepId: 'demon_sin', color: '#9a1c2e', icon: 'Flame' },
    { id: 'corrupted', label: 'A Corrupted Mortal', description: 'Once something else. Spin Ancestry again: whatever they were, they keep, and the Abyss adds a sin.', baseWeight: 50, rarity: 'common', grantTags: ['corrupted'], grantTraits: ['demonic_corruption'], queueSpins: { fallen_sin: 1 }, nextStepId: 'corrupted_from', color: '#5a2a3a', icon: 'UserX' },
    { id: 'prince_of_hell', label: 'A Prince of Hell', description: 'Not born in the Abyss: born to rule part of it.', baseWeight: 3, rarity: 'legendary', setRace: 'archfiend', grantTraits: ['true_demon', 'abyss_heir'], statBonus: { might: 2, arcana: 2 }, epithet: { text: 'Prince of Hell', priority: 86 }, nextStepId: ARCHETYPE_STEP, color: '#ffb84d', icon: 'Crown' },
  ],
};

/** A natural demon's ruling sin makes them what they are: Wrath a Balor, Lust a Succubus or Incubus... */
const DEMON_SIN: WheelStep = {
  id: 'demon_sin',
  title: 'Which Sin Rules You?',
  subtitle: 'A demon is a sin with a body. Which sin?',
  options: [...SINS.map(
    (sin): WheelOption => ({
      id: sin.id,
      label: sin.name,
      description: sin.race ? `A ${RACES[sin.race].name}: ${RACES[sin.race].description}` : 'A Succubus or an Incubus. The wheel decides which.',
      baseWeight: 14,
      rarity: 'common',
      ...(sin.race && { setRace: sin.race }),
      statBonus: sin.bonus,
      ...(sin.luck ? { luckDelta: sin.luck } : {}),
      grantTags: [`sin_${sin.id}`],
      epithet: { text: `Demon of ${sin.name}`, priority: 60 },
      nextStepId: sin.race ? ARCHETYPE_STEP : 'lust_form',
      color: sin.color,
      icon: sin.icon,
    }),
  ),
    { id: 'every_sin', label: 'Every Sin at Once', description: 'Not one sin with a body. All seven, sharing one.', baseWeight: 2, rarity: 'legendary', setRace: 'archfiend', statBonus: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, luckDelta: 0.5, grantTags: SINS.map((sin) => `sin_${sin.id}`), epithet: { text: 'Demon of Every Sin', priority: 80 }, nextStepId: ARCHETYPE_STEP, color: '#ffb84d', icon: 'Flame' },
  ],
};

const LUST_FORM: WheelStep = {
  id: 'lust_form',
  title: 'Succubus or Incubus?',
  subtitle: 'Lust wears many faces. Which one is yours?',
  options: [
    { id: 'succubus', label: 'Succubus', description: RACES.succubus.description, baseWeight: 50, rarity: 'common', setRace: 'succubus', nextStepId: ARCHETYPE_STEP, color: '#c0306a', icon: 'Heart' },
    { id: 'incubus', label: 'Incubus', description: RACES.incubus.description, baseWeight: 50, rarity: 'common', setRace: 'incubus', nextStepId: ARCHETYPE_STEP, color: '#8a2a5a', icon: 'Flame' },
    { id: 'thousand_faces', label: 'The Thousand Faces', description: 'Whatever you want to see. Whoever you want to trust.', baseWeight: 3, rarity: 'epic', setRace: 'succubus', statBonus: { intellect: 2, arcana: 2 }, luckDelta: 0.5, epithet: { text: 'of the Thousand Faces', priority: 62 }, nextStepId: ARCHETYPE_STEP, color: '#ffd76a', icon: 'VenetianMask' },
  ],
};

const CORRUPTED_FROM = ancestryMirror('corrupted_from', 'What Did the Abyss Take?', 'The Wheel of Ancestry, once more. Whatever they were, they still are.', 'demon', {
  celestial: { epithet: { text: 'the Fallen Angel', priority: 75 } },
  god: { epithet: { text: 'the Fallen God', priority: 92 } },
});

/** A corrupted mortal's sin: the same seven, but they keep the race they were. */
const FALLEN_SIN: WheelStep = {
  id: 'fallen_sin',
  title: 'Which Sin Took You?',
  subtitle: 'Every fall starts with one.',
  repeats: true, // waits in the spin queue (see REJOIN)
  options: [...SINS.map(
    (sin): WheelOption => ({
      id: sin.id,
      label: sin.name,
      description: `The Abyss found them through ${sin.name.toLowerCase()}.`,
      baseWeight: 14,
      rarity: 'common',
      statBonus: sin.bonus,
      ...(sin.luck ? { luckDelta: sin.luck } : {}),
      grantTags: [`sin_${sin.id}`],
      epithet: { text: sin.adjective, priority: 24 },
      nextStepId: ARCHETYPE_STEP,
      color: sin.color,
      icon: sin.icon,
    }),
  ),
    { id: 'all_seven', label: 'All Seven, One After Another', description: 'A long fall, and they took every door on the way down.', baseWeight: 3, rarity: 'epic', statBonus: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, grantTags: SINS.map((sin) => `sin_${sin.id}`), epithet: { text: 'the Sevenfold Fallen', priority: 50 }, nextStepId: ARCHETYPE_STEP, color: '#ffd76a', icon: 'Flame' },
  ],
};

// ─── Angels ─────────────────────────────────────────────────────────────────

const ANGEL_ORIGIN: WheelStep = {
  id: 'angel_origin',
  title: 'Born of Light, or Raised to It?',
  subtitle: 'Some angels were made in heaven. Some earned their way there.',
  options: [
    { id: 'natural', label: 'A True Angel', description: 'Born of light: stronger than any mortal raised to it.', baseWeight: 50, rarity: 'common', setRace: 'celestial', grantTraits: ['born_of_light', 'celestial_grace'], nextStepId: 'celestial_origin', color: '#f0e6c8', icon: 'Sun' },
    { id: 'ascended', label: 'An Ascended Mortal', description: 'Once something else. Spin Ancestry again: whatever they were, they keep, and the light adds a virtue.', baseWeight: 50, rarity: 'common', grantTags: ['ascended'], grantTraits: ['ascended_soul'], queueSpins: { angel_virtue: 1 }, nextStepId: 'ascended_from', color: '#c9b27a', icon: 'Sunrise' },
    { id: 'archangel', label: 'An Archangel', description: 'One of the first. They remember the world being made.', baseWeight: 3, rarity: 'legendary', setRace: 'celestial', grantTraits: ['born_of_light', 'celestial_grace', 'divine_favor'], epithet: { text: 'the Archangel', priority: 88 }, nextStepId: 'celestial_origin', color: '#ffe08a', icon: 'Sun' },
  ],
};

const ASCENDED_FROM = ancestryMirror('ascended_from', 'What Did the Light Lift Up?', 'The Wheel of Ancestry, once more. Whatever they were, they still are.', 'celestial', {
  demon: { epithet: { text: 'the Redeemed', priority: 75 } },
});

const VIRTUES: { id: string; name: string; bonus: WheelOption['statBonus']; luck?: number; color: string; icon: string }[] = [
  { id: 'chastity', name: 'Purity', bonus: { arcana: 2 }, color: '#f0f0e0', icon: 'Sparkle' },
  { id: 'temperance', name: 'Temperance', bonus: { vitality: 1, intellect: 1 }, color: '#9ac4e0', icon: 'Scale' },
  { id: 'charity', name: 'Charity', bonus: {}, luck: 0.5, color: '#e0b86a', icon: 'HandHeart' },
  { id: 'diligence', name: 'Diligence', bonus: { might: 1, vitality: 1 }, color: '#c2874f', icon: 'Hammer' },
  { id: 'patience', name: 'Patience', bonus: { intellect: 2 }, color: '#6a8ac0', icon: 'Hourglass' },
  { id: 'kindness', name: 'Kindness', bonus: { vitality: 2 }, color: '#8ac46a', icon: 'Heart' },
  { id: 'humility', name: 'Humility', bonus: { arcana: 1 }, luck: 0.25, color: '#b8a07a', icon: 'Feather' },
];

const ANGEL_VIRTUE: WheelStep = {
  id: 'angel_virtue',
  title: 'Which Virtue Is Yours?',
  subtitle: 'Every angel carries one above all others.',
  repeats: true, // waits in the spin queue (see REJOIN)
  options: [...VIRTUES.map(
    (v): WheelOption => ({
      id: v.id,
      label: v.name,
      description: `An angel of ${v.name.toLowerCase()}.`,
      baseWeight: 14,
      rarity: 'common',
      statBonus: v.bonus,
      ...(v.luck ? { luckDelta: v.luck } : {}),
      epithet: { text: `Angel of ${v.name}`, priority: 58 },
      nextStepId: ARCHETYPE_STEP,
      color: v.color,
      icon: v.icon,
    }),
  ),
    { id: 'every_virtue', label: 'Every Virtue', description: 'Not one above the others. All of them, perfectly. Nothing dark can take root.', baseWeight: 2, rarity: 'legendary', statBonus: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, luckDelta: 0.5, grantTraits: ['uncorruptable'], epithet: { text: 'Angel of All Virtues', priority: 80 }, nextStepId: ARCHETYPE_STEP, color: '#ffe08a', icon: 'Sparkles' },
  ],
};

// ─── Constructs ─────────────────────────────────────────────────────────────

const CONSTRUCT_TYPE: WheelStep = {
  id: 'construct_type',
  title: 'What Kind of Construct?',
  subtitle: 'Gears, runes, stone, or something stitched together.',
  options: [
    { id: 'undead', label: 'Undead Construct', description: 'Stitched from the dead and wound up again. Spin Ancestry again: whatever they were, they keep.', baseWeight: 30, rarity: 'common', grantTags: ['undead'], grantTraits: ['reanimated'], epithet: { text: 'the Reanimated', priority: 25 }, nextStepId: 'resurrected_from', color: '#6e7a5a', icon: 'Bone' },
    { id: 'crazy_experiment', label: 'Crazy Experiment', description: 'Lightning, a laboratory, and a very bad idea that worked.', baseWeight: 14, rarity: 'uncommon', setRace: 'construct', grantTraits: ['unstable_experiment'], luckDelta: -0.25, epithet: { text: 'the Experiment', priority: 30 }, nextStepId: ARCHETYPE_STEP, color: '#7ac46a', icon: 'FlaskConical' },
    { id: 'magical_golem', label: 'Magical Golem', description: 'Stone, a rune, and a purpose.', baseWeight: 14, rarity: 'uncommon', setRace: 'construct', grantTraits: ['golem_core'], epithet: { text: 'the Golem', priority: 30 }, nextStepId: ARCHETYPE_STEP, color: '#8a7ab8', icon: 'Gem' },
    { id: 'dwarven_masterpiece', label: 'Dwarven Masterpiece', description: 'A lifetime of a master’s work, in brass and steel.', baseWeight: 4, rarity: 'epic', setRace: 'construct', grantTraits: ['masterwork_frame'], epithet: { text: 'the Dwarven Masterpiece', priority: 55 }, nextStepId: ARCHETYPE_STEP, color: '#b8862e', icon: 'Cog' },
    { id: 'ancient_construct', label: 'Ancient Construct', description: 'Built before history. Woke up yesterday.', baseWeight: 1.5, rarity: 'legendary', setRace: 'construct', grantTraits: ['ancient_core'], epithet: { text: 'the Ancient Engine', priority: 80 }, nextStepId: ARCHETYPE_STEP, color: '#3fa8a0', icon: 'Landmark' },
  ],
};

const RESURRECTED_FROM = ancestryMirror('resurrected_from', 'Whose Body Was It?', 'The Wheel of Ancestry, once more. Whatever they were, they still are.', 'construct', {
  god: { epithet: { text: 'the Risen God', priority: 90 } },
});

// ─── Hybrids ────────────────────────────────────────────────────────────────

const HYBRID_FIRST = ancestryMirror('hybrid_first', 'The First Bloodline', 'Half of them comes from here. Spin Ancestry.', 'hybrid');

/** Which ancestry a hybrid's first half rolled. */
const firstHalf = (char: Character) => char.history.find((roll) => roll.stepId === 'hybrid_first')?.optionId;

/**
 * The second half. Spinning it keeps the first race as a bloodline (`blood:<race>`): odds and
 * race checks count both. The first half's ancestry is locked (Human, the wheel's always-open
 * slice, just shrinks to nothing instead).
 */
const HYBRID_SECOND = ancestryMirror('hybrid_second', 'The Second Bloodline', 'And the other half? Spin Ancestry again.', 'hybrid');
HYBRID_SECOND.options = HYBRID_SECOND.options.map((o): WheelOption => {
  const blood = (char: Character) => (char.race === null ? {} : { grantTags: [...(o.grantTags ?? []), `${BLOOD_TAG}${char.race}`] });
  if (o.id === 'human') return { ...o, vary: (char) => ({ ...blood(char), ...(firstHalf(char) === 'human' && { baseWeight: 0 }) }) };
  return {
    ...o,
    condition: (world, char) => firstHalf(char) !== o.id && (o.condition?.(world, char) ?? true),
    lockedReason: (world, char) =>
      firstHalf(char) === o.id ? 'Already half of them' : typeof o.lockedReason === 'function' ? o.lockedReason(world, char) : (o.lockedReason ?? 'Locked'),
    vary: blood,
  };
});

export const OTHERWORLDLY_STEPS: WheelStep[] = [
  GOD_DOMAIN,
  MINOR_DOMAIN,
  WAR_STYLE,
  GOD_OF_RACE,
  FIEND_ORIGIN,
  DEMON_SIN,
  LUST_FORM,
  CORRUPTED_FROM,
  FALLEN_SIN,
  ANGEL_ORIGIN,
  ASCENDED_FROM,
  ANGEL_VIRTUE,
  CONSTRUCT_TYPE,
  RESURRECTED_FROM,
  HYBRID_FIRST,
  HYBRID_SECOND,
];
