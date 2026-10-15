/**
 * Sample content.
 *
 * Creation, entered at Ancestry (races.ts holds Ancestry and the race wheels, otherworldly.ts
 * the God, Demon, Angel and Construct wheels, archetypes.ts the Archetype wheel, stats.ts the
 * stat wheels, powers.ts the power wheels):
 *
 *   Ancestry ──▶ the race's own wheel(s) ──▶ Archetype ──▶ Fate ─┬────────────────────▶ Personality ──▶ the race's 5 stat wheels ─┐
 *                                                                 └─▶ The Abyss Calls ──┘  (monsters, the cursed, demons, angels)     │
 *          ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *          ├─▶ Talents ──▶ Armory ──▶ Armour ──┐     (most ordinary souls roll no talent at all; Holy Sword skips the Armory)
 *          └─▶ Abyssal (Demon Lords) ──────────┴──▶ every owed power spin (gods, angels, demons, mages...) ──▶ named
 *
 *   Race wheels, Fate and Personality bank stat bonuses; Fate sets the soul's luck. Each
 *   race rolls its stats on its own ladders, with odds peaked where the race sits, and the
 *   race bends the odds of every other wheel too (`Race.odds`). When the last wheel lands,
 *   the soul is named: a name from their race, any surname they rolled, and the best title
 *   (`epithet`) they earned along the way.
 *
 * Adventures, living heroes only, entered at the crossroads (activities.ts): What Will You Do?
 * Go on an Adventure leads to The Open Road; Train, Mentor, Seek Out an Old Face, Twist of
 * Fate and twenty other pursuits have wheels of their own.
 *
 *   The Open Road ─┬─ Bandit Ambush ──▶ fight (losers may join the gang)
 *                  ├─ Monster Lair ──▶ Which Lair? ──▶ one of six lair fights
 *                  ├─ Sunken Ruins ──▶ The Ruins ──(Ancient Guardian)──▶ fight
 *                  ├─ Old Legend ──▶ a retired hero: learn from them, duel them, rob them, bring them back
 *                  ├─ A Familiar Face ──▶ fight an outlaw who was once a hero, and take what they stole
 *                  ├─ The Envoy ──▶ refuse the Demon Lord, or swear to them
 *                  ├─ A Tempting Offer ──▶ walk away, or ride with the outlaws
 *                  ├─ Dark Champion ──▶ fight a hero who swore to the Demon Lord
 *                  ├─ A grave, a rival, a ruler, a general, a shopfront, a relic ──▶ legacy.ts
 *                  └─ … ──▶ end of the road: home, with whatever fame they earned
 *
 *   Every fight weighs the hero's Combat Power against the foe's power: the Victory slices
 *   grow with CP. A fatal defeat sends the hero to the graveyard. Heroes who turn outlaw or
 *   minion, or settle into a new life, stay in the world, and other heroes meet them (cast
 *   wheels): as foes, their power is their own Combat Power. When a cast wheel has two or
 *   more candidates, a "who is it?" wheel decides which one appears.
 *
 *   There is no retirement wheel. Every adventure earns fame (renown.ts): more for harder
 *   foes and grander wins. Fame makes the riskier roads likelier, opens Destiny (Renowned)
 *   and the Legendary Challenges (Famous), and those lead to the endings: retirement, a
 *   mentor's school, a general's command, a throne, a martyr's grave, a soul sealed in a
 *   relic, the Demon Lord slain (legacy.ts).
 *
 * Everything here is data. To add a wheel: write a WheelStep, register it in `steps`, and
 * point some option's `nextStepId` at it. To add a fight: call `fightWheel`. To add a
 * one-of-a-kind role: give an option `claimSingleton: 'any_new_key'`. To add a race:
 * register it in races.ts, give it a stat profile in stats.ts, and point an option at its
 * wheel. None of these touch engine or UI code.
 *
 * Rules demonstrated:
 *  - One-of-a-kind roles:  Demon Lord, Holy Sword bearer, Archmage (three keys, zero engine code).
 *  - Races:                their own wheels, stat ladders and odds; Runesmith is dwarf-only;
 *                          Moonbow and Fey Crossing are for any elf; a skeleton can become a
 *                          Lich; monsters and the cursed may join the Demon Lord's army unborn.
 *  - Personality:          small stat bonuses, and who can turn: only the greedy, reckless,
 *                          cruel or ambitious join bandits; only dark hearts kneel to the
 *                          Demon Lord; the honourable never turn.
 *  - Recurring characters: retired legends, outlaws, minions, graves, rulers, generals, mentors,
 *                          rivals and sealed souls reappear; profession-only outcomes (`castCondition`).
 *  - Items:                named items (`Trait.item`) change hands: looted, stolen, handed down (`spoils`).
 *  - Luck:                 fate tilts every stat wheel, the Armory and the outfitter; Normal Fate most
 *                          often means setting out empty-handed, and finding a weapon on the road.
 *  - Power:                fights weigh Combat Power (stats, weapon, armour, traits) against the foe's.
 *  - Fame:                 renown tiers bend the crossroads (`fameScaling`) and gate the endings.
 *  - Rarity:               every option has a tier, and no rarer option outweighs a more
 *                          common one on its wheel (validateGameConfig checks this).
 *  - World conditions:     Echoes of the Fallen, Heirloom, Lich King, the Haunted Crypt need
 *                          souls in the graveyard, and heroes slain on adventures put them there.
 *  - Character conditions: Arcane Savant and Archmage need Arcana; Iron Will cheats death.
 *  - Cross-rule:           the Holy Sword wakes only while a Demon Lord reigns, and rejects cursed blood.
 *  - Threat scaling:       darkness, monsters and death grow likelier as threatLevel rises.
 */
import { calculatePowerRating } from '../engine/power';
import { isSingletonClaimed } from '../engine/world';
import type { CastWheelConfig, Character, GameConfig, Race, Rarity, StatBlock, StepRoute, Trait, WheelOption, WheelStep } from '../engine/types';
import { ACTIVITY_STEPS, ACTIVITY_TRAITS } from './activities';
import { ARCHETYPE, ARCHETYPES } from './archetypes';
import { ARMOR_STEPS, ARMOR_TRAITS } from './armor';
import {
  FOES,
  PERSONALITIES,
  SINGLETON,
  couldKneel,
  couldTurnOutlaw,
  darkChampions,
  fightWheel,
  generals,
  graves,
  hauntedBy,
  isUncorruptable,
  outlawLockReason,
  outlaws,
  retiredLegends,
  rivals,
  rulers,
  sealedSouls,
  townsfolk,
} from './common';
import { LEGACY_STEPS, LEGACY_TRAITS, handDownArms, learnTechnique, passTheTorch, relicName, takeEverything } from './legacy';
import { QUEST_STEPS, QUEST_TRAITS, STORY_FLAG_LABELS } from './quests';
import { FAME_CONFIG, FAME_TIERS, renown } from './renown';
import { NAMES } from './names';
import { WORLD_EVENTS } from './worldEvents';
import { OTHERWORLDLY_STEPS, OTHERWORLDLY_TRAITS, rejoining } from './otherworldly';
import { ALL_POWER_TRAITS, POWERS_ROUTE, POWER_STEPS } from './powers';
import { ANCESTRY, RACES, RACE_TRAITS, RACE_WHEELS, isRace, racesOf } from './races';
import { ASCENSION_WHEELS, STATS_START, STAT_WHEELS, TRAINING_WHEELS, TRAIN_STAT, statTierName } from './stats';
import { HOOKS, IDENTITIES, METERS, PLACE_KINDS, STAKES_STEPS, STAKES_TRAITS, isConstruct, isVampire } from './stakes';

/** Where every stat sits before its wheel is rolled. */
const BASE_STATS: StatBlock = { might: 10, agility: 10, intellect: 10, arcana: 10, vitality: 10 };

const TRAITS = {
  ...RACE_TRAITS,
  ...OTHERWORLDLY_TRAITS,
  ...ALL_POWER_TRAITS,
  ...ACTIVITY_TRAITS,
  ...ARMOR_TRAITS,
  ...LEGACY_TRAITS,
  ...QUEST_TRAITS,
  ...STAKES_TRAITS,
  // Fate
  divine_favor: { id: 'divine_favor', name: 'Divine Favor', description: 'The gods watch over this soul.', power: 40 },
  cursed_blood: { id: 'cursed_blood', name: 'Cursed Blood', description: 'Power with a price. Holy relics refuse you.', power: 20 },
  demon_lord_mantle: { id: 'demon_lord_mantle', name: 'Mantle of the Demon Lord', description: 'Sovereign of the abyss. There can be only one.', power: 150 },
  // Talents
  blademaster: { id: 'blademaster', name: 'Blademaster', description: 'Any weapon fights a tier above its make.', power: 25, scalesWith: ['might', 'agility'] },
  arcane_savant: { id: 'arcane_savant', name: 'Arcane Savant', description: 'Reads spells the way others read signs.', power: 35, scalesWith: ['arcana'] },
  iron_will: { id: 'iron_will', name: 'Iron Will', description: 'Gets back up. Every time.', power: 20 },
  shadowstep: { id: 'shadowstep', name: 'Shadowstep', description: 'Strikes from where no one is standing.', power: 25, scalesWith: ['agility'] },
  ancestral_echoes: { id: 'ancestral_echoes', name: 'Echoes of the Fallen', description: 'Guided by heroes who died before.', power: 45 },
  runesmith: { id: 'runesmith', name: 'Runesmith', description: 'Every blade they touch remembers its maker.', power: 30 },
  holy_sword: { id: 'holy_sword', name: 'Holy Sword Bearer', description: 'Chosen to end the Demon Lord’s reign.', power: 60, item: 'weapon' },
  archmage: { id: 'archmage', name: 'Archmage of the Spire', description: 'The tower answers to one mage at a time.', power: 70, scalesWith: ['arcana'] },
  // Armory
  dragonbone: { id: 'dragonbone', name: 'Dragonbone', description: 'The blade remembers the dragon it came from.', power: 20, item: 'weapon' },
  // Abyssal
  infernal_tyrant: { id: 'infernal_tyrant', name: 'Infernal Tyrant', description: 'Rules by fire and fear.', power: 40 },
  plague_sovereign: { id: 'plague_sovereign', name: 'Plague Sovereign', description: 'Every breath of the world is borrowed.', power: 35 },
  void_herald: { id: 'void_herald', name: 'Void Herald', description: 'Speaks for the space between stars.', power: 45 },
  lich_phylactery: { id: 'lich_phylactery', name: 'Phylactery', description: 'Bound to the souls of the graveyard.', power: 90 },
  // Adventures: the road
  fey_friend: { id: 'fey_friend', name: 'Friend of the Fey', description: 'The old roads remember a kindness.', power: 30 },
  titans_strength: { id: 'titans_strength', name: 'Titan’s Strength', description: 'Woke up carrying a little of something enormous.', power: 40 },
  dragon_gold: { id: 'dragon_gold', name: 'Dragon Gold', description: 'Armour of coin, and a dragon who wants it back.', power: 45, item: 'armor' },
  old_kings_relic: { id: 'old_kings_relic', name: 'Relic of the Old Kings', description: 'A crown no one remembers, that remembers everyone.', power: 40, item: 'relic' },
  // Adventures: glory in a fight
  monster_slayer: { id: 'monster_slayer', name: 'Monster Slayer', description: 'There is a cave named after them now.', power: 35 },
  spider_silk: { id: 'spider_silk', name: 'Broodmother’s Silk', description: 'A cloak that turns blades like water.', power: 30, item: 'armor' },
  troll_heart: { id: 'troll_heart', name: 'Troll Heart', description: 'Wounds close while you watch.', power: 35 },
  grave_warden: { id: 'grave_warden', name: 'Grave Warden', description: 'The restless dead step aside for you.', power: 40 },
  guardian_oath: { id: 'guardian_oath', name: 'Guardian’s Oath', description: 'Something made of stone keeps watch over you.', power: 45 },
  wyvern_rider: { id: 'wyvern_rider', name: 'Wyvern Rider', description: 'Wings, when you need them.', power: 55 },
  dragonslayer: { id: 'dragonslayer', name: 'Dragonslayer', description: 'Killed a dragon. Mentions it often.', power: 80 },
  dragon_bond: { id: 'dragon_bond', name: 'Dragon-Bonded', description: 'A dragon answers when you call.', power: 120 },
  // Adventures: the Demon Lord's war
  abyssal_pact: { id: 'abyssal_pact', name: 'Abyssal Pact', description: 'Sworn to the Demon Lord. The power is real.', power: 60 },
  envoy_bane: { id: 'envoy_bane', name: 'Envoy-Bane', description: 'Sent a messenger of the Abyss back in pieces.', power: 35 },
  redeemer: { id: 'redeemer', name: 'Redeemer', description: 'Brought a soul back from the Abyss.', power: 40 },
} satisfies Record<string, Trait>;

// ─── Fate ───────────────────────────────────────────────────────────────────
// Fate sets luck, which tilts every stat wheel and the Armory.

/** Who hears the Abyss calling: monsters, the cursed, demons and the corrupted, and (faintly) angels. */
const HEARS_THE_ABYSS = ['monster', 'cursed', 'fiend', 'corrupted', 'angel'];

/** They hear the Abyss before anything else; everyone else (and the uncorruptable) meets their personality. */
const AFTER_FATE: StepRoute = {
  among: ['abyss_calls', 'personality'],
  pick: (_world, char) =>
    char.role === 'hero' && !isUncorruptable(char) && HEARS_THE_ABYSS.some((tag) => char.tags.includes(tag))
      ? 'abyss_calls'
      : 'personality',
};

const FATE: WheelStep = {
  id: 'fate',
  title: 'Wheel of Fate',
  subtitle: 'Then the stars have their say.',
  options: [
    {
      id: 'normal_fate',
      label: 'Normal Fate',
      description: 'An ordinary birth: no luck either way. Your story is yours to write.',
      baseWeight: 30, // was 50: the stars have their say more often than not
      rarity: 'common',
      nextStepId: AFTER_FATE,
      color: '#64748b',
      icon: 'Footprints',
    },
    {
      id: 'blessed',
      label: 'Blessed by the Gods',
      description: 'Born under a favourable sky. Every wheel leans your way.',
      baseWeight: 16,
      rarity: 'uncommon',
      threatScaling: -0.1, // the gods withdraw as the world darkens
      luckDelta: 1,
      grantTraits: ['divine_favor'],
      grantTags: ['blessed'],
      epithet: { text: 'the Blessed', priority: 22 },
      nextStepId: AFTER_FATE,
      color: '#f59e0b',
      icon: 'Sun',
    },
    {
      id: 'cursed',
      label: 'Cursed Birth',
      description: 'Strength, bought with something you never agreed to sell. Luck went with it.',
      baseWeight: 16,
      rarity: 'uncommon',
      threatScaling: 0.25,
      statBonus: { might: 4, arcana: 2, vitality: -3 },
      luckDelta: -0.5,
      grantTraits: ['cursed_blood'],
      grantTags: ['cursed'],
      epithet: { text: 'the Cursed', priority: 22 },
      nextStepId: AFTER_FATE,
      color: '#8b5cf6',
      icon: 'Skull',
    },
    {
      id: 'demon_lord',
      label: 'Demon Lord',
      description: 'You are the darkness the heroes are born to fight.',
      baseWeight: 5, // keeps its old share (about 7%) of a wheel with fewer ordinary births
      rarity: 'legendary',
      threatScaling: 0.2,
      // A one-of-a-kind role. No `condition` needed: the engine locks this slice
      // whenever 'demon_lord' is a key in world.activeSingletons.
      claimSingleton: SINGLETON.demonLord,
      lockedReason: 'A Demon Lord already reigns over this world',
      setRole: 'demonLord',
      statBonus: { might: 5, arcana: 5, vitality: 8 },
      luckDelta: 1.5,
      grantTraits: ['demon_lord_mantle'],
      grantTags: ['demonic'],
      epithet: { text: 'the Demon Lord', priority: 100 },
      nextStepId: AFTER_FATE,
      color: '#dc2626',
      icon: 'Crown',
    },
  ],
};

// ─── The Abyss Calls (monsters, the cursed, demons, angels) ──────────────────

/**
 * How hard the Abyss pulls, by kind of soul: [resist, haunted, answer]. Demons almost never
 * resist; angels almost never answer. Dealt per character, so the slices show it.
 */
const ABYSS_PULL: Record<'demon' | 'angel' | 'other', [number, Rarity][]> = {
  demon: [[3, 'rare'], [4, 'rare'], [93, 'common']],
  angel: [[80, 'common'], [17, 'common'], [3, 'rare']],
  other: [[58, 'common'], [26, 'common'], [16, 'uncommon']],
};
const abyssPull = (choice: 0 | 1 | 2) => (char: Character) => {
  const kind = char.tags.includes('fiend') || char.tags.includes('corrupted') ? 'demon' : char.tags.includes('angel') ? 'angel' : 'other';
  const [baseWeight, rarity] = ABYSS_PULL[kind][choice]!;
  return { baseWeight, rarity };
};

const ABYSS_CALLS: WheelStep = {
  id: 'abyss_calls',
  title: 'The Abyss Calls',
  subtitle: 'Something below knows your name. Some never become heroes at all.',
  options: [
    {
      vary: abyssPull(0),
      id: 'resist',
      label: 'Resist the Call',
      description: 'You hear it. You refuse it. It will ask again.',
      baseWeight: 58,
      rarity: 'common',
      statBonus: { vitality: 1 },
      nextStepId: 'personality',
      color: '#4f6f8f',
      icon: 'ShieldCheck',
    },
    {
      vary: abyssPull(1),
      id: 'haunted',
      label: 'Haunted by It',
      description: 'You said no, but the voice moved in.',
      baseWeight: 26,
      rarity: 'common',
      statBonus: { arcana: 1 },
      luckDelta: -0.25,
      nextStepId: 'personality',
      color: '#3a2f4f',
      icon: 'Eye',
    },
    {
      vary: abyssPull(2),
      id: 'answer',
      label: 'Answer the Call',
      description: 'Never a hero, not for a day. Straight into the Demon Lord’s army.',
      baseWeight: 16,
      rarity: 'uncommon',
      setRole: 'minion', // a Dark Champion from birth: in the world as other heroes' foe
      grantTraits: ['abyssal_pact'],
      epithet: { text: 'Sworn to the Abyss', priority: 65 },
      nextStepId: 'personality',
      color: '#7f1d2e',
      icon: 'Flame',
    },
    {
      id: 'made_it_kneel',
      label: 'Made the Abyss Kneel',
      description: 'It called. They called back, louder. It never called again.',
      baseWeight: 2,
      rarity: 'epic',
      grantTraits: ['abyss_scarred', 'uncorruptable'],
      epithet: { text: 'the Unclaimed', priority: 58 },
      nextStepId: 'personality',
      color: '#f0e6c8',
      icon: 'Sun',
    },
  ],
};

// ─── Personality ────────────────────────────────────────────────────────────
// A small banked stat bonus, and who this soul could become: see couldTurnOutlaw, couldKneel.

const PERSONALITY: WheelStep = {
  id: 'personality',
  title: 'Wheel of Personality',
  subtitle: 'Who are they, when no one is watching?',
  options: [
    { id: 'brave', label: 'Brave', description: PERSONALITIES.brave.description, baseWeight: 20, rarity: 'common', setPersonality: 'brave', epithet: { text: 'the Brave', priority: 14 }, statBonus: { might: 1 }, nextStepId: STATS_START, color: '#b8613a', icon: 'ShieldCheck' },
    { id: 'cautious', label: 'Cautious', description: PERSONALITIES.cautious.description, baseWeight: 18, rarity: 'common', setPersonality: 'cautious', epithet: { text: 'the Cautious', priority: 14 }, statBonus: { intellect: 1 }, nextStepId: STATS_START, color: '#4f6f8f', icon: 'Eye' },
    { id: 'kind', label: 'Kind', description: PERSONALITIES.kind.description, baseWeight: 16, rarity: 'common', setPersonality: 'kind', epithet: { text: 'the Kind', priority: 14 }, statBonus: { vitality: 1 }, nextStepId: STATS_START, color: '#5f9a6a', icon: 'HandHeart' },
    { id: 'curious', label: 'Curious', description: PERSONALITIES.curious.description, baseWeight: 14, rarity: 'uncommon', setPersonality: 'curious', epithet: { text: 'the Curious', priority: 14 }, statBonus: { arcana: 1 }, nextStepId: STATS_START, color: '#7a5aa8', icon: 'Search' },
    { id: 'greedy', label: 'Greedy', description: PERSONALITIES.greedy.description, baseWeight: 10, rarity: 'uncommon', setPersonality: 'greedy', epithet: { text: 'the Greedy', priority: 14 }, luckDelta: 0.25, nextStepId: STATS_START, color: '#b8962e', icon: 'Coins' },
    { id: 'reckless', label: 'Reckless', description: PERSONALITIES.reckless.description, baseWeight: 9, rarity: 'uncommon', setPersonality: 'reckless', epithet: { text: 'the Reckless', priority: 14 }, statBonus: { agility: 1 }, nextStepId: STATS_START, color: '#c4483a', icon: 'Rocket' },
    { id: 'honorable', label: 'Honorable', description: PERSONALITIES.honorable.description, baseWeight: 7, rarity: 'rare', setPersonality: 'honorable', epithet: { text: 'the Honorable', priority: 14 }, nextStepId: STATS_START, color: '#c9b27a', icon: 'Scale' },
    { id: 'cruel', label: 'Cruel', description: PERSONALITIES.cruel.description, baseWeight: 5, rarity: 'rare', setPersonality: 'cruel', epithet: { text: 'the Cruel', priority: 14 }, statBonus: { might: 1 }, nextStepId: STATS_START, color: '#6e1f2a', icon: 'Droplet' },
    { id: 'ambitious', label: 'Ambitious', description: PERSONALITIES.ambitious.description, baseWeight: 4, rarity: 'rare', setPersonality: 'ambitious', epithet: { text: 'the Ambitious', priority: 14 }, statBonus: { intellect: 1 }, nextStepId: STATS_START, color: '#7a3e8a', icon: 'Crown' },
    { id: 'lionhearted', label: 'Lionhearted', description: 'Brave the way the songs mean it. They get back up, every time, and everyone around them stands a little taller.', baseWeight: 2, rarity: 'epic', setPersonality: 'brave', grantTraits: ['iron_will'], statBonus: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, epithet: { text: 'the Lionhearted', priority: 44 }, nextStepId: STATS_START, color: '#ffd76a', icon: 'ShieldCheck' },
  ],
};

// ─── Talents (heroes) ───────────────────────────────────────────────────────

const TALENTS: WheelStep = {
  id: 'talents',
  title: 'Wheel of Talents',
  subtitle: 'What gift did fate leave you? Most get none.',
  options: [
    {
      id: 'ordinary',
      label: 'Ordinary Soul',
      description: 'No gift worth a name. Plenty of legends started here.',
      baseWeight: 40, // with ordinary luck and no special gifts unlocked, about a third of all souls
      rarity: 'common',
      luckScaling: -0.5, // the lucky are less often ordinary
      nextStepId: 'armory',
      color: '#7a7f8c',
      icon: 'User',
    },
    {
      id: 'blademaster',
      epithet: { text: 'Blademaster', priority: 35 },
      label: 'Blademaster',
      description: 'Steel answers to you.',
      baseWeight: 25,
      rarity: 'common',
      statModifiers: { might: 3, agility: 2 },
      weaponTierDelta: 1, // mastery: whatever the Armory gives, it hits a tier harder
      grantTraits: ['blademaster'],
      nextStepId: 'armory',
      color: '#e11d48',
      icon: 'Swords',
    },
    {
      id: 'arcane_savant',
      epithet: { text: 'the Arcane', priority: 35 },
      label: 'Arcane Savant',
      description: 'The weave of magic is plain to you.',
      baseWeight: 18,
      rarity: 'uncommon',
      statModifiers: { intellect: 3, arcana: 5 },
      grantTraits: ['arcane_savant'],
      condition: (_world, char) => char.stats.arcana >= 12,
      lockedReason: (_world, char) => `Requires 12 Arcana (you have ${char.stats.arcana})`,
      nextStepId: 'armory',
      color: '#6366f1',
      icon: 'Sparkles',
    },
    {
      id: 'unbreakable',
      epithet: { text: 'the Unbroken', priority: 28 },
      label: 'Unbreakable',
      description: 'Pain is information, nothing more.',
      baseWeight: 25,
      rarity: 'common',
      statModifiers: { vitality: 5, might: 1 },
      grantTraits: ['iron_will'],
      nextStepId: 'armory',
      color: '#0d9488',
      icon: 'Shield',
    },
    {
      id: 'shadowstep',
      epithet: { text: 'Shadowstep', priority: 30 },
      label: 'Shadowstep',
      description: 'Gone before the guard turns around.',
      baseWeight: 20,
      rarity: 'common',
      statModifiers: { agility: 5 },
      grantTraits: ['shadowstep'],
      nextStepId: 'armory',
      color: '#86198f',
      icon: 'Wind',
    },
    {
      id: 'echoes',
      epithet: { text: 'Voice of the Fallen', priority: 40 },
      label: 'Echoes of the Fallen',
      description: 'The dead lend you what they learned.',
      baseWeight: 12,
      rarity: 'rare',
      statModifiers: { intellect: 2, vitality: 2 },
      grantTraits: ['ancestral_echoes'],
      condition: (world) => world.graveyard.length >= 3,
      lockedReason: (world) => `Requires 3 souls in the graveyard (${world.graveyard.length}/3)`,
      nextStepId: 'armory',
      color: '#0891b2',
      icon: 'Ghost',
    },
    {
      id: 'runesmith',
      epithet: { text: 'the Runesmith', priority: 40 },
      label: 'Runesmith',
      description: 'The forge-songs come back to you like a mother tongue.',
      baseWeight: 10,
      rarity: 'rare',
      statModifiers: { intellect: 2, might: 1 },
      weaponTierDelta: 1,
      grantTraits: ['runesmith'],
      condition: isRace('dwarf'),
      lockedReason: 'Only dwarves are taught the runes',
      nextStepId: 'armory',
      color: '#b45f2a',
      icon: 'Hammer',
    },
    {
      id: 'archmage',
      epithet: { text: 'Archmage of the Spire', priority: 90 },
      label: 'Archmage of the Spire',
      description: 'The tower has waited for you.',
      baseWeight: 6,
      rarity: 'epic',
      // A third one-of-a-kind role, added with zero engine changes.
      claimSingleton: SINGLETON.archmage,
      condition: (_world, char) => char.stats.arcana >= 13,
      lockedReason: (world, char) =>
        isSingletonClaimed(world, SINGLETON.archmage)
          ? 'The Spire already has its Archmage'
          : `Requires 13 Arcana (you have ${char.stats.arcana})`,
      statModifiers: { intellect: 4, arcana: 8 },
      grantTraits: ['archmage'],
      nextStepId: 'armory',
      color: '#2563eb',
      icon: 'Gem',
    },
    {
      id: 'holy_sword',
      epithet: { text: 'Bearer of the Holy Sword', priority: 95 },
      label: 'Chosen of the Holy Sword',
      description: 'The blade picked you. It does not explain itself.',
      baseWeight: 5,
      rarity: 'legendary',
      threatScaling: 0.5, // rises to meet the darkness
      claimSingleton: SINGLETON.holySwordBearer,
      condition: (world, char) => isSingletonClaimed(world, SINGLETON.demonLord) && !char.tags.includes('cursed'),
      lockedReason: (world, char) => {
        if (isSingletonClaimed(world, SINGLETON.holySwordBearer)) return 'The Holy Sword has already chosen a bearer';
        if (char.tags.includes('cursed')) return 'The Holy Sword rejects cursed blood';
        return 'The Holy Sword sleeps until a Demon Lord rises';
      },
      weaponTierDelta: 5,
      grantTraits: ['holy_sword'],
      nextStepId: 'outfitter', // already armed: skips the Armory, but still dresses for the road
      color: '#facc15',
      icon: 'Sword',
    },
  ],
};

// ─── The Armory (heroes) ────────────────────────────────────────────────────
// With ordinary luck, setting out empty-handed is the single likeliest result.
// Luck shrinks that slice and grows the good ones; the road has weapons to find later.
// After the Armory comes armour (armor.ts); after that (and after Abyssal), every owed power
// spin is spent: POWERS_ROUTE.

/** An Armory slice: after it, armour. */
const weapon = (o: Omit<WheelOption, 'nextStepId'>): WheelOption => ({ ...o, nextStepId: 'outfitter' });

const ARMORY: WheelStep = {
  id: 'armory',
  title: 'The Armory',
  subtitle: 'Most souls set out with nothing. The lucky ones set out armed.',
  options: [
    {
      id: 'empty_hands',
      label: 'Empty Hands',
      description: 'Nothing but fists and nerve. The road has weapons, and Find a Weapon comes up twice as often for the unarmed.',
      baseWeight: 18,
      rarity: 'common',
      luckScaling: -0.6,
      statModifiers: { agility: 2 },
      nextStepId: 'outfitter',
      color: '#6b7280',
      icon: 'Hand',
    },
    // Seventeen weapons share the rest. Their weights add up to what the eight before them
    // did (68.5 with the Heirloom unlocked); Empty Hands is about one soul in five.
    weapon({ id: 'rusted_shortsword', label: 'Rusted Shortsword', description: 'It has seen better centuries.', baseWeight: 9, rarity: 'common', weaponTierDelta: 1, color: '#a16207', icon: 'Slice' }),
    weapon({ id: 'hunting_spear', label: 'Hunting Spear', description: 'Reach, balance, and a sharp point.', baseWeight: 7.5, rarity: 'common', weaponTierDelta: 1, statModifiers: { might: 1 }, color: '#8a6a3a', icon: 'Crosshair' }),
    weapon({ id: 'iron_mace', label: 'Iron Mace', description: 'Crude, heavy, honest.', baseWeight: 7, rarity: 'common', weaponTierDelta: 1, statModifiers: { vitality: 1 }, color: '#6e7280', icon: 'Gavel' }),
    weapon({ id: 'hunters_longbow', label: 'Hunter’s Longbow', description: 'Patience, strung and waxed.', baseWeight: 6, rarity: 'uncommon', luckScaling: 0.3, weaponTierDelta: 2, statModifiers: { agility: 2 }, color: '#15803d', icon: 'Target' }),
    weapon({ id: 'runed_staff', label: 'Runed Staff', description: 'Warm to the touch, and humming.', baseWeight: 5, rarity: 'uncommon', luckScaling: 0.4, weaponTierDelta: 2, statModifiers: { arcana: 3 }, color: '#7c3aed', icon: 'WandSparkles' }),
    weapon({ id: 'war_axe', label: 'Dwarven War Axe', description: 'Heavy enough to settle arguments.', baseWeight: 5, rarity: 'uncommon', luckScaling: 0.5, weaponTierDelta: 3, statModifiers: { might: 3 }, color: '#b45309', icon: 'Axe' }),
    weapon({ id: 'twin_daggers', label: 'Twin Daggers', description: 'One for the front, one for the back.', baseWeight: 4.5, rarity: 'uncommon', luckScaling: 0.3, weaponTierDelta: 2, statModifiers: { agility: 2 }, color: '#4a4a5e', icon: 'Swords' }),
    weapon({ id: 'crossbow', label: 'Crossbow', description: 'Point, pull, problem solved.', baseWeight: 4.5, rarity: 'uncommon', luckScaling: 0.3, weaponTierDelta: 2, statModifiers: { agility: 1 }, color: '#6e5a42', icon: 'Target' }),
    weapon({ id: 'apprentice_wand', label: 'Apprentice’s Wand', description: 'A little stick that does big things, for the right hand.', baseWeight: 4, rarity: 'uncommon', luckScaling: 0.4, weaponTierDelta: 1, statModifiers: { arcana: 4 }, color: '#8a6ae0', icon: 'Wand' }),
    weapon({ id: 'warhammer', label: 'Warhammer', description: 'Armour is just a suggestion.', baseWeight: 3, rarity: 'rare', luckScaling: 0.6, weaponTierDelta: 3, statModifiers: { might: 2, vitality: 1 }, color: '#5f6470', icon: 'Hammer' }),
    weapon({ id: 'duelist_rapier', label: 'Duelist’s Rapier', description: 'Thin, quick, and very rude.', baseWeight: 3, rarity: 'rare', luckScaling: 0.6, weaponTierDelta: 3, statModifiers: { agility: 3 }, color: '#9a8a6a', icon: 'Sword' }),
    weapon({ id: 'greatsword', label: 'Greatsword', description: 'Taller than some of its owners.', baseWeight: 2.5, rarity: 'rare', luckScaling: 0.6, weaponTierDelta: 4, statModifiers: { might: 2 }, color: '#7a8a9a', icon: 'Sword' }),
    weapon({
      id: 'fallen_heirloom',
      epithet: { text: 'Heir of the Fallen', priority: 32 },
      label: 'Heirloom of the Fallen',
      description: 'Taken up from a hero who will not need it again.',
      baseWeight: 3.5,
      rarity: 'rare',
      luckScaling: 0.6,
      weaponTierDelta: 4,
      condition: (world) => world.graveyard.length >= 1,
      lockedReason: 'No hero has fallen yet',
      color: '#0e7490',
      icon: 'Medal',
    }),
    weapon({
      id: 'elven_moonbow',
      epithet: { text: 'Moonbow', priority: 42 },
      label: 'Elven Moonbow',
      description: 'Strung with moonlight. It misses only on purpose.',
      baseWeight: 2.5,
      rarity: 'epic',
      luckScaling: 0.8,
      weaponTierDelta: 4,
      statModifiers: { agility: 3 },
      condition: isRace('elf'),
      lockedReason: 'Only an elf can draw a moonbow',
      color: '#7aa7d9',
      icon: 'Moon',
    }),
    weapon({ id: 'obsidian_glaive', label: 'Obsidian Glaive', description: 'Volcanic glass on a long black haft. It never dulls.', baseWeight: 1.5, rarity: 'epic', luckScaling: 0.8, weaponTierDelta: 4, statModifiers: { might: 2, agility: 2 }, epithet: { text: 'of the Black Glaive', priority: 42 }, color: '#2a2a35', icon: 'Axe' }),
    weapon({ id: 'stormbow', label: 'Stormbow', description: 'Every arrow lands with a clap of thunder.', baseWeight: 1.25, rarity: 'epic', luckScaling: 0.9, weaponTierDelta: 4, statModifiers: { agility: 3, arcana: 2 }, epithet: { text: 'Stormcaller', priority: 44 }, color: '#4f6fb8', icon: 'CloudLightning' }),
    weapon({
      id: 'dragonbone_blade',
      epithet: { text: 'Dragonbone', priority: 48 },
      label: 'Dragonbone Blade',
      description: 'Carved from the last of the old wyrms.',
      baseWeight: 1.25,
      rarity: 'legendary',
      threatScaling: 0.3,
      luckScaling: 1.5,
      weaponTierDelta: 5,
      grantTraits: ['dragonbone'],
      color: '#d6cfb8',
      icon: 'Bone',
    }),
  ],
};

// ─── Abyssal (Demon Lord only) ──────────────────────────────────────────────

const ABYSSAL: WheelStep = {
  id: 'abyssal',
  title: 'Abyssal Wheel',
  subtitle: 'What manner of darkness do you rule?',
  options: [
    {
      id: 'infernal_tyrant',
      epithet: { text: 'the Infernal Tyrant', priority: 101 },
      label: 'Infernal Tyrant',
      description: 'The world will burn on your schedule.',
      baseWeight: 35,
      rarity: 'common',
      statModifiers: { might: 10, vitality: 5 },
      weaponTierDelta: 3,
      armorTierDelta: 4,
      grantTraits: ['infernal_tyrant'],
      nextStepId: POWERS_ROUTE,
      color: '#b91c1c',
      icon: 'Flame',
    },
    {
      id: 'plague_sovereign',
      epithet: { text: 'the Plague Sovereign', priority: 101 },
      label: 'Plague Sovereign',
      description: 'Your court coughs in unison.',
      baseWeight: 30,
      rarity: 'common',
      statModifiers: { arcana: 8, vitality: 4 },
      weaponTierDelta: 2,
      armorTierDelta: 2,
      grantTraits: ['plague_sovereign'],
      nextStepId: POWERS_ROUTE,
      color: '#65a30d',
      icon: 'Biohazard',
    },
    {
      id: 'void_herald',
      epithet: { text: 'Herald of the Void', priority: 101 },
      label: 'Void Herald',
      description: 'Something vast speaks through you.',
      baseWeight: 25,
      rarity: 'uncommon',
      statModifiers: { agility: 6, arcana: 6 },
      weaponTierDelta: 2,
      armorTierDelta: 2,
      grantTraits: ['void_herald'],
      nextStepId: POWERS_ROUTE,
      color: '#4c1d95',
      icon: 'Orbit',
    },
    {
      id: 'lich_king',
      epithet: { text: 'the Lich King', priority: 102 },
      label: 'Lich King',
      description: 'Death was a door, and you kept the key.',
      baseWeight: 10,
      rarity: 'epic',
      threatScaling: 0.3,
      statModifiers: { arcana: 12, intellect: 6 },
      weaponTierDelta: 2,
      armorTierDelta: 3,
      grantTraits: ['lich_phylactery'],
      condition: (world) => world.graveyard.length >= 5,
      lockedReason: (world) => `Requires 5 souls in the graveyard (${world.graveyard.length}/5)`,
      nextStepId: POWERS_ROUTE,
      color: '#0f766e',
      icon: 'Skull',
    },
  ],
};

// ─── Fights ─────────────────────────────────────────────────────────────────

const FIGHTS = [
  fightWheel({
    id: 'fight_bandits',
    traitWins: [
      { id: 'slipped_past', label: 'Slipped Past Unseen', description: 'They never knew you were there. Their purses did not notice either.', requiresTrait: ['skill_stealth', 'shadowstep'], luckDelta: 0.25, weaponTierDelta: 1, icon: 'EyeOff' },
      { id: 'talked_down', label: 'Talked Them Down', description: 'By the end, they were apologising.', requiresTrait: ['skill_diplomacy'], statModifiers: { intellect: 2 }, icon: 'Handshake' },
    ],
    title: 'Bandit Ambush',
    subtitle: 'Steel in the dark, and a demand for your purse.',
    foe: FOES.bandits,
    deadliness: 0.15,
    victory: { label: 'Sent Packing', description: 'They run. You keep everything, and some of theirs.', statModifiers: { might: 2, agility: 1 } },
    glory: { statScaling: { might: 0.02 }, label: 'The Chief’s Own Blade', description: 'You took it from his hand. He will not need it.', rarity: 'rare', weaponTierDelta: 2 },
    retreat: { label: 'Robbed Blind', description: 'Purse, boots and pride, in that order.', weaponTierDelta: -1 },
    legend: { label: 'The Bandit King Kneels', description: 'Their chief threw down his sword and swore to follow whoever beat him. The band rides for them now.', rarity: 'epic', grantTraits: ['bandit_band'], epithet: { text: 'King of the Road', priority: 50 } },
    slain: { label: 'Knifed in the Dark', description: 'Over a purse that was nearly empty.' },
    turncoat: {
      share: 0.3,
      label: 'Joined the Gang',
      description: 'They offered a cut instead of a knife. You took it.',
      setRole: 'outlaw', // an outlaw now: off the hero roster, onto other heroes' roads
      statModifiers: { agility: 1 },
      condition: couldTurnOutlaw,
      lockedReason: outlawLockReason,
    },
  }),
  fightWheel({
    id: 'fight_goblins',
    traitWins: [
      { id: 'goblin_tribute', label: 'They Know a Boss', description: 'The warren takes one look, bows, and pays tribute.', requiresTrait: ['gang_boss', 'band_boss', 'horde_warboss'], weaponTierDelta: 2, epithet: { text: 'King of the Warren', priority: 46 }, icon: 'Crown' },
    ],
    title: 'Goblin Warren',
    subtitle: 'Many small knives, one very bad smell.',
    foe: FOES.goblins,
    deadliness: 0.25,
    victory: { label: 'Warren Cleared', description: 'You walk out with a goblin-forged blade and a story.', weaponTierDelta: 1, statModifiers: { agility: 1 } },
    glory: { statScaling: { might: 0.02 }, label: 'Goblin King Toppled', description: 'The crown was a pot. The trophy is real.', rarity: 'rare', statModifiers: { might: 2 }, grantTraits: ['monster_slayer'] },
    retreat: { label: 'Chased Out', description: 'There were more of them. There are always more of them.', statModifiers: { vitality: -1 } },
    legend: { label: 'Crowned King of the Warren', description: 'The goblins put a pot on their head and started calling them Boss. They meant it.', rarity: 'epic', grantTraits: ['goblin_horde'], epithet: { text: 'King Under the Hill', priority: 50 } },
    slain: { label: 'Overrun', description: 'Buried under a hundred small hands.' },
  }),
  fightWheel({
    id: 'fight_spiders',
    traitWins: [
      { id: 'burned_out', label: 'Burned It All', description: 'Webs burn. So do spiders.', requiresTrait: ['fireball', 'hellfire', 'holy_flame'], statModifiers: { arcana: 2 }, grantTraits: ['monster_slayer'], icon: 'Flame' },
    ],
    title: 'Spider Nest',
    subtitle: 'The webs are thicker than rope, and something is coming down them.',
    foe: FOES.spiders,
    deadliness: 0.3,
    victory: { label: 'Nest Burned', description: 'The webs went up like paper.', statModifiers: { agility: 2, vitality: 1 } },
    glory: { statScaling: { agility: 0.03 }, label: 'Silk of the Broodmother', description: 'Woven into a cloak that turns blades.', rarity: 'rare', grantTraits: ['spider_silk'] },
    retreat: { label: 'Poisoned and Fleeing', description: 'The fever broke on the third night.', statModifiers: { vitality: -2 } },
    legend: { label: 'The Broodmother’s Heir', description: 'She died, and her brood chose them. They are very loyal, and very many.', rarity: 'epic', grantTraits: ['spider_brood'], epithet: { text: 'Mother of Spiders', priority: 52 } },
    slain: { label: 'Cocooned', description: 'Wrapped up and saved for later.' },
  }),
  fightWheel({
    id: 'fight_troll',
    traitWins: [
      { id: 'out_wrestled', label: 'Out-Wrestled the Troll', description: 'Hand to hand, and the troll lost.', requiresTrait: ['titans_strength', 'companion_bear'], statModifiers: { might: 3 }, grantTraits: ['monster_slayer'], icon: 'BicepsFlexed' },
    ],
    title: 'Troll Bridge',
    subtitle: 'The toll is your life. It accepts no other coin.',
    foe: FOES.troll,
    deadliness: 0.35,
    victory: { label: 'Troll Toppled', description: 'It took three tries and a river.', statModifiers: { might: 3 }, weaponTierDelta: 1 },
    glory: { statScaling: { vitality: 0.03 }, label: 'Heart of the Troll', description: 'You ate it. It is still beating, somewhere inside you.', rarity: 'rare', grantTraits: ['troll_heart'] },
    retreat: { label: 'Thrown in the River', description: 'You washed up a mile downstream, alive and furious.', statModifiers: { vitality: -2 } },
    legend: { label: 'The Troll Pays the Toll', description: 'It knelt in the river, and has guarded their back ever since.', rarity: 'epic', grantTraits: ['troll_guard'], epithet: { text: 'Troll-Friend', priority: 48 } },
    slain: { label: 'Crushed', description: 'The bridge has a new stone in it.' },
  }),
  fightWheel({
    id: 'fight_guardian',
    traitWins: [
      { id: 'true_name_spoken', label: 'Spoke Its True Name', description: 'It stopped, listened, and knelt.', requiresTrait: ['true_name'], grantTraits: ['guardian_oath'], icon: 'ScrollText' },
      { id: 'side_door', label: 'Never Fought It', description: 'They picked the vault’s side door while it watched the front.', requiresTrait: ['skill_lockpicking'], weaponTierDelta: 2, icon: 'KeyRound' },
    ],
    title: 'The Ancient Guardian',
    subtitle: 'It has waited a thousand years for someone to try.',
    foe: FOES.guardian,
    deadliness: 0.35,
    victory: { label: 'Guardian Shattered', description: 'The vault behind it was worth the bruises: a blade, and a breastplate.', weaponTierDelta: 2, armorTierDelta: 1 },
    glory: { statScaling: { intellect: 0.05 }, label: 'Oath of the Guardian', description: 'It knelt instead of falling. It guards you now.', rarity: 'epic', grantTraits: ['guardian_oath'] },
    retreat: { label: 'Driven Out', description: 'Stone fists, stone patience.', statModifiers: { vitality: -2 } },
    legend: { label: 'The Vault Beneath the Vault', description: 'What the guardian really guarded was underneath. It is theirs to keep now.', rarity: 'legendary', grantTraits: ['guardian_heart'], weaponTierDelta: 2, armorTierDelta: 2, epithet: { text: 'Keeper of the Last Vault', priority: 60 } },
    slain: { label: 'Turned to Stone', description: 'A new statue in an old hall.' },
  }),
  fightWheel({
    id: 'fight_wights',
    traitWins: [
      { id: 'commanded_dead', label: 'Commanded the Dead', description: 'They bowed to a stronger will.', requiresTrait: ['raise_dead', 'phylactery_spark', 'lich_phylactery'], grantTraits: ['grave_warden'], icon: 'Bone' },
      { id: 'burned_by_light', label: 'Burned Away by Light', description: 'The dead could not bear to look at them.', requiresTrait: ['holy_flame', 'smite', 'radiant_aura', 'born_of_light'], statModifiers: { arcana: 2 }, luckDelta: 0.25, icon: 'Sun' },
    ],
    title: 'Haunted Crypt',
    subtitle: 'The cold gets in before the dead do.',
    foe: FOES.wights,
    deadliness: 0.4,
    victory: { label: 'Laid to Rest', description: 'They thanked you, in their way.', statModifiers: { arcana: 3 }, weaponTierDelta: 1 },
    glory: { statScaling: { arcana: 0.03 }, label: 'Warden of the Barrow', description: 'The restless dead now step aside for you.', rarity: 'epic', grantTraits: ['grave_warden'] },
    retreat: { label: 'Fled the Cold', description: 'Your hair went white on one side.', statModifiers: { vitality: -2 }, grantTags: ['haunted'] },
    legend: { label: 'The Barrow King Abdicates', description: 'The dead king took off his crown and put it on their head. His dead came with it.', rarity: 'legendary', grantTraits: ['barrow_crown'], epithet: { text: 'King of the Barrow', priority: 68 } },
    slain: { label: 'Joined the Dead', description: 'There is always room for one more.' },
  }),
  fightWheel({
    id: 'fight_wyvern',
    traitWins: [
      { id: 'shot_down', label: 'Shot Out of the Sky', description: 'One arrow, one wing, one very long fall.', requiresTrait: ['skill_archery'], statModifiers: { agility: 2 }, weaponTierDelta: 1, icon: 'Target' },
      { id: 'griffin_duel', label: 'Griffin Against Wyvern', description: 'Their griffin drove it out of the sky.', requiresTrait: ['companion_griffin'], statModifiers: { agility: 2 }, epithet: { text: 'the Sky-Hunter', priority: 40 }, icon: 'Feather' },
    ],
    title: 'Wyvern Roost',
    subtitle: 'Wings, venom, and a very long fall.',
    foe: FOES.wyvern,
    deadliness: 0.45,
    victory: { label: 'Wyvern Felled', description: 'It came down hard, and so did you, but you got up.', statModifiers: { agility: 2 }, weaponTierDelta: 2 },
    glory: { statScaling: { agility: 0.03 }, label: 'Wyvern Rider', description: 'You broke it instead of killing it. It answers to you now.', rarity: 'epic', grantTraits: ['wyvern_rider'] },
    retreat: { label: 'Clawed and Running', description: 'Three scars, one for each talon.', statModifiers: { vitality: -3 }, grantTags: ['scarred'] },
    legend: { label: 'A Clutch of Wyvern Eggs', description: 'The nest was full. They raised every one.', rarity: 'legendary', grantTraits: ['wyvern_brood'], epithet: { text: 'Wyvern-Lord', priority: 64 } },
    slain: { label: 'Carried Off', description: 'Up, and up, and then the nest.' },
  }),
  fightWheel({
    id: 'fight_dragon',
    traitWins: [
      { id: 'kin_of_dragons', label: 'Kin of Dragons', description: 'It smelled its own blood in theirs, and parleyed. It paid them to leave.', requiresTrait: ['draconic_blood', 'dragon_taught'], grantTraits: ['dragon_gold'], icon: 'Egg' },
      { id: 'through_the_fire', label: 'Walked Through the Fire', description: 'The flame broke on their shield. Their blade did not.', requiresTrait: ['divine_shield', 'arcane_shield'], grantTraits: ['dragonslayer'], icon: 'ShieldPlus' },
      { id: 'time_stopped', label: 'Stopped Time Mid-Breath', description: 'The fire hung in the air while they walked up and struck.', requiresTrait: ['time_stop', 'wish'], grantTraits: ['dragonslayer'], icon: 'Hourglass' },
    ],
    title: 'Dragon’s Den',
    subtitle: 'The gold is real. So is the dragon.',
    foe: FOES.dragon,
    deadliness: 0.6,
    victory: { label: 'Dragonslayer', description: 'Songs will get the details wrong, but not the ending.', rarity: 'common', grantTraits: ['dragonslayer'], weaponTierDelta: 2 },
    glory: { statScaling: { arcana: 0.03 }, label: 'Dragon-Bonded', description: 'It bowed its head. Nobody will believe you, until they see it.', rarity: 'legendary', grantTraits: ['dragon_bond'] },
    retreat: { label: 'Singed and Fleeing', description: 'Half your hair and all your dignity.', statModifiers: { vitality: -4 }, grantTags: ['scarred'] },
    legend: { label: 'The Dragon Yields Its Name', description: 'It told them its true name before it died. Every dragon alive heard it.', rarity: 'mythical', grantTraits: ['dragon_name', 'dragonslayer'], epithet: { text: 'Dragon-Named', priority: 88 } },
    slain: { label: 'Ash on the Wind', description: 'There was not enough left to bury.' },
  }),
  fightWheel({
    id: 'fight_outlaw',
    traitWins: [
      { id: 'talked_home', label: 'Talked Them Home', description: 'Words did what swords couldn’t. They ride as a hero again.', requiresTrait: ['skill_diplomacy', 'redeemer'], castEffect: { setRole: 'hero' }, icon: 'Handshake' },
      { id: 'saw_ambush', label: 'Saw the Ambush Coming', description: 'They knew where the outlaw would be. The outlaw did not know that.', requiresTrait: ['mind_read', 'skill_tracking'], statModifiers: { intellect: 1 }, weaponTierDelta: 1, icon: 'Eye' },
    ],
    title: 'A Familiar Face',
    subtitle: 'An old ally, gone bad, blocks the road.',
    foe: { name: 'An outlaw', power: 120 },
    cast: { from: outlaws, asFoe: true },
    deadliness: 0.3,
    victory: { label: 'Sent Them Running', description: 'They will be back. Outlaws always come back.', statModifiers: { might: 2 }, weaponTierDelta: 1 },
    glory: {
      label: 'Brought to Justice',
      description: 'The road is safer now, and everything they stole goes to the one who stopped them.',
      rarity: 'rare',
      castEffect: { setStatus: 'fallen' }, // the outlaw goes to the graveyard
      spoils: takeEverything, // their blade, armour and stolen relics
      statModifiers: { might: 1 },
    },
    retreat: { label: 'Robbed by an Old Friend', description: 'They knew exactly where you keep your purse.', weaponTierDelta: -1 },
    legend: { label: 'Took Their Gang', description: 'They put the outlaw down, and the gang knelt to the new boss.', rarity: 'epic', castEffect: { setStatus: 'fallen' }, spoils: takeEverything, grantTraits: ['bandit_band'], epithet: { text: 'Breaker of Outlaws', priority: 50 } },
    slain: { label: 'Betrayed', description: 'Killed by someone who used to watch their back.' },
  }),
  fightWheel({
    id: 'fight_champion',
    traitWins: [
      { id: 'purged', label: 'Purged by the Holy Sword', description: 'The blade burned the Abyss out of them. A hero again.', requiresTrait: ['holy_sword'], castEffect: { setRole: 'hero' }, grantTraits: ['redeemer'], icon: 'Sword' },
      { id: 'light_breaks', label: 'The Light Breaks Through', description: 'Their light reached what was left of the hero inside.', requiresTrait: ['radiant_aura', 'born_of_light', 'celestial_grace'], castEffect: { setRole: 'hero' }, icon: 'Sunrise' },
    ],
    title: 'The Demon Lord’s Champion',
    subtitle: 'Someone you once fought beside, wearing the Abyss like armour.',
    foe: { name: 'A dark champion', power: 220 },
    cast: { from: darkChampions, asFoe: true },
    deadliness: 0.45,
    victory: { label: 'Champion Driven Back', description: 'They fled to their master, bleeding shadow.', statModifiers: { might: 2, arcana: 2 } },
    glory: {
      statScaling: { arcana: 0.03 },
      label: 'Redeemed',
      description: 'You reached them. They walk away from the Abyss, and back to the heroes.',
      rarity: 'epic',
      castEffect: { setRole: 'hero' }, // a hero again, free to adventure
      grantTraits: ['redeemer'],
    },
    retreat: { label: 'Burned by Abyssal Fire', description: 'The scar never quite stops smoking.', statModifiers: { vitality: -3 }, grantTags: ['scarred'] },
    legend: { label: 'Turned Them Against Their Master', description: 'Redeemed, and they brought the Demon Lord’s secrets with them.', rarity: 'legendary', castEffect: { setRole: 'hero' }, grantTraits: ['redeemer', 'abyss_secret'], epithet: { text: 'the Turner of Champions', priority: 62 } },
    slain: { label: 'Fell to a Former Friend', description: 'They did not even look away.' },
  }),
];

// ─── Adventure 1: The Open Road ─────────────────────────────────────────────

const ROAD: WheelStep = {
  id: 'road',
  title: 'The Open Road',
  subtitle: 'Where does it take you this time?',
  options: [
    {
      id: 'quiet_roads',
      omenScaling: { plague: 0.5, peace: 1.5, festival: 1.3 },
      label: 'A Night by the Fire',
      description: 'Nothing tried to kill them. They slept, and healed (Wounds −2).',
      baseWeight: 24,
      // Vampires don't get a quiet night (Dawn Catches Them), and fires don't mend constructs.
      vary: (char) => (isVampire(char) || isConstruct(char) ? { baseWeight: 0 } : {}),
      rarity: 'common',
      fameScaling: -0.15, // the famous rarely get a quiet road
      statModifiers: { vitality: 1 },
      meters: { wounds: -2 },
      nextStepId: null,
      color: '#7d8a6a',
      icon: 'Footprints',
    },
    {
      id: 'bandit_ambush',
      omenScaling: { bandits: 2.5 },
      label: 'Bandit Ambush',
      description: `A gang on the road, ${FOES.bandits.power} power between them. Twice as likely for the hunted.`,
      ...hauntedBy('hunted', 20, 2), // a spurned noble's money, a bandit lord's bounty
      rarity: 'common',
      nextStepId: 'fight_bandits',
      color: '#a35d3a',
      icon: 'Swords',
    },
    {
      id: 'monster_lair',
      omenScaling: { dragon: 1.5 },
      label: 'Monster Lair',
      description: 'Bones at the entrance. Fresh ones. Which lair, though?',
      baseWeight: 22,
      rarity: 'common',
      threatScaling: 0.15, // the dark breeds more monsters
      fameScaling: 0.1, // and the famous go looking for them
      nextStepId: 'lairs',
      color: '#5b3f6e',
      icon: 'Skull',
    },
    {
      id: 'wandering_smith',
      label: 'Wandering Smith',
      description: 'A smith on the road takes pity on your empty hands.',
      baseWeight: 10,
      rarity: 'uncommon',
      weaponTierDelta: 2,
      condition: (_world, char) => char.weaponTier < 2,
      lockedReason: 'The smith only stops for the poorly armed',
      nextStepId: null,
      color: '#8a6a3a',
      icon: 'Anvil',
    },
    {
      id: 'drowned_library',
      label: 'Drowned Library',
      description: 'The books were wet. The spells were not.',
      baseWeight: 10,
      rarity: 'uncommon',
      statModifiers: { intellect: 2, arcana: 3 },
      nextStepId: null,
      color: '#2f6f8f',
      icon: 'BookOpen',
    },
    {
      id: 'sunken_ruins',
      label: 'Sunken Ruins',
      description: 'Someone left in a hurry. Something stayed behind. It goes on the map.',
      baseWeight: 9,
      rarity: 'uncommon',
      place: { discover: 'ruin' },
      nextStepId: 'ruins',
      color: '#4f8a5b',
      icon: 'Landmark',
    },
    {
      id: 'fey_crossing',
      label: 'Fey Crossing',
      description: 'The old roads open, briefly, for the right feet.',
      baseWeight: 6,
      rarity: 'rare',
      statModifiers: { arcana: 4, agility: 1 },
      grantTraits: ['fey_friend'],
      condition: isRace('elf'),
      lockedReason: 'The fey roads open only for elves',
      nextStepId: null,
      color: '#c0569a',
      icon: 'Sparkle',
    },
    {
      id: 'familiar_face',
      omenScaling: { bandits: 2 },
      label: 'A Familiar Face',
      description: 'An outlaw on the road, and you know that walk.',
      baseWeight: 10,
      rarity: 'uncommon',
      condition: (world) => outlaws(world).length > 0,
      lockedReason: 'No hero has turned outlaw yet',
      nextStepId: 'fight_outlaw',
      color: '#5a4a3a',
      icon: 'UserX',
    },
    {
      id: 'demon_envoy',
      omenScaling: { war: 2 },
      label: 'The Envoy',
      description: 'A messenger from the Demon Lord, with an offer. Twice as likely for the marked.',
      ...hauntedBy('marked', 9, 2),
      rarity: 'uncommon',
      condition: (world) => isSingletonClaimed(world, SINGLETON.demonLord),
      lockedReason: 'No Demon Lord reigns to send one',
      nextStepId: 'envoy',
      color: '#4a1d3a',
      icon: 'ScrollText',
    },
    {
      id: 'dark_champion',
      omenScaling: { war: 2 },
      label: 'Dark Champion',
      description: 'A hero who swore to the Demon Lord rides out to meet you. Twice as likely for the marked.',
      ...hauntedBy('marked', 8, 2),
      rarity: 'uncommon',
      condition: (world) => darkChampions(world).length > 0,
      lockedReason: 'No hero has sworn to the Demon Lord yet',
      nextStepId: 'fight_champion',
      color: '#6e1f1f',
      icon: 'Flame',
    },
    {
      id: 'tempting_offer',
      omenScaling: { eclipse: 2 },
      label: 'A Tempting Offer',
      description: 'Easy money, if you do not ask where it came from.',
      baseWeight: 8,
      rarity: 'uncommon',
      condition: couldTurnOutlaw,
      lockedReason: 'Only tempts the greedy, the reckless and the cursed',
      nextStepId: 'temptation',
      color: '#8a6a2e',
      icon: 'Coins',
    },
    // What comes for who they have become (stakes.ts has the wheels).
    { id: 'dawn_caught', label: 'Dawn Catches Them', description: 'No cellar, no cave, no coffin. Just a ditch, and the sun coming up.', baseWeight: 14, rarity: 'uncommon', requiresRace: ['vampire'], meters: { wounds: 2, hunger: 1 }, nextStepId: null, color: '#f0c06a', icon: 'Sunrise' },
    { id: 'vampire_hunters', label: 'Vampire Hunters', description: 'Stakes and silver, and they know the face. Likelier the more notorious.', baseWeight: 8, vary: (char) => ({ baseWeight: 6 + 4 * (char.meters?.notoriety ?? 0) }), rarity: 'uncommon', requiresRace: ['vampire'], nextStepId: 'fight_vampire_hunters', color: '#c8c8d0', icon: 'Crosshair' },
    { id: 'silver_hunters', label: 'Silver-Armed Hunters', description: 'They know what comes out at the full moon. Likelier the more notorious.', baseWeight: 8, vary: (char) => ({ baseWeight: 6 + 4 * (char.meters?.notoriety ?? 0) }), rarity: 'uncommon', requiresRace: ['werewolf'], nextStepId: 'fight_silver_hunters', color: '#c8c8d0', icon: 'Crosshair' },
    { id: 'rust_in_the_rain', label: 'Rust in the Rain', description: 'A week of rain, and every joint seized. No fire mends that.', baseWeight: 14, rarity: 'uncommon', requiresRace: ['construct'], meters: { wounds: 1 }, nextStepId: null, color: '#8a6a4a', icon: 'CloudRain' },
    // Unfinished business, coming due.
    { id: 'it_found_them', label: 'It Found Them', description: 'The thing that followed them home from the wilds.', baseWeight: 14, rarity: 'uncommon', requiresTag: ['hook:followed'], callback: 'The thing that followed them home from the wilds caught up', nextStepId: 'fight_follower', color: '#3a2f4f', icon: 'Eye' },
    { id: 'owners_kin', label: 'The Owner’s Kin', description: 'They recognise the armour. They want it back.', baseWeight: 14, rarity: 'uncommon', requiresTag: ['hook:grave_claim'], callback: 'The dead knight’s family came for their armour', nextStepId: 'fight_grave_kin', color: '#5a6478', icon: 'Shield' },
    { id: 'blade_thirsts', label: 'The Blade Is Thirsty', description: 'It has been whispering for weeks.', baseWeight: 14, rarity: 'uncommon', requiresTag: ['hook:blade_hungers'], callback: 'The whispering blade demanded blood', nextStepId: 'blade_demands', color: '#6a3a8a', icon: 'Sword' },
    // Chance meetings with the world's past heroes (legacy.ts has the wheels).
    {
      id: 'familiar_grave',
      omenScaling: { restless_dead: 2 },
      label: 'A Familiar Grave',
      description: 'A cairn by the road, and a name you know on it.',
      baseWeight: 8,
      rarity: 'uncommon',
      condition: (world) => graves(world).length > 0,
      lockedReason: 'No hero lies in the graveyard yet',
      nextStepId: 'grave',
      color: '#5a6478',
      icon: 'Skull',
    },
    {
      id: 'rival_on_the_road',
      label: 'A Rival on the Road',
      description: 'Another hero, coming the other way. Neither steps aside. Likelier for those with a jealous rival.',
      ...hauntedBy('rival', 8, 2.5),
      rarity: 'uncommon',
      condition: (world, char) => rivals(world, char).length > 0,
      lockedReason: 'No other hero walks the world',
      nextStepId: 'rival',
      color: '#4f86b8',
      icon: 'Swords',
    },
    {
      id: 'royal_procession',
      label: 'A Royal Procession',
      description: 'Banners, trumpets, and a ruler who used to be one of you.',
      baseWeight: 7,
      rarity: 'uncommon',
      condition: (world) => rulers(world).length > 0,
      lockedReason: 'No hero rules anywhere yet',
      nextStepId: 'ruler_audience',
      color: '#ffb84d',
      icon: 'Crown',
    },
    {
      id: 'recruiters',
      label: 'Recruiters',
      description: 'A general’s banner, and a sergeant looking for heroes.',
      baseWeight: 6,
      rarity: 'uncommon',
      condition: (world) => generals(world).length > 0,
      lockedReason: 'No hero commands an army yet',
      nextStepId: 'general_summons',
      color: '#8a2e2e',
      icon: 'Flag',
    },
    {
      id: 'familiar_shopfront',
      label: 'A Familiar Shopfront',
      description: 'The name over the door belongs to an old hero.',
      baseWeight: 6,
      rarity: 'uncommon',
      condition: (world) => townsfolk(world).length > 0,
      lockedReason: 'No hero has settled down yet',
      nextStepId: 'townsfolk',
      color: '#3f8a7a',
      icon: 'Store',
    },
    {
      id: 'glinting_relic',
      label: 'Something Glinting in the Mud',
      description: 'A relic, warm to the touch, with a soul inside it.',
      baseWeight: 3,
      rarity: 'rare',
      condition: (world) => sealedSouls(world).length > 0,
      lockedReason: 'No soul has been bound to a relic yet',
      nextStepId: 'soul_relic',
      color: '#9a7ad0',
      icon: 'Gem',
    },
    {
      id: 'old_legend',
      label: 'Old Legend',
      description: 'A retired hero by the fire, with stories and a sword on the wall.',
      baseWeight: 6,
      rarity: 'rare',
      condition: (world) => retiredLegends(world).length > 0,
      lockedReason: 'No hero has retired yet',
      nextStepId: 'legend',
      color: '#a08a4a',
      icon: 'Medal',
    },
    {
      id: 'titans_grave',
      label: 'Titan’s Grave',
      description: 'You slept on its chest. You woke up stronger.',
      baseWeight: 3,
      rarity: 'epic',
      luckScaling: 0.5,
      statModifiers: { might: 4, vitality: 3 },
      grantTraits: ['titans_strength'],
      nextStepId: null,
      color: '#56648f',
      icon: 'Mountain',
    },
    {
      id: 'dragons_hoard',
      label: 'Dragon’s Hoard',
      description: 'It was asleep. You were quiet. You are rich.',
      baseWeight: 2,
      rarity: 'legendary',
      luckScaling: 1, // only the lucky stumble on a sleeping dragon
      weaponTierDelta: 2,
      grantTraits: ['dragon_gold'],
      nextStepId: null,
      color: '#d9a400',
      icon: 'Coins',
    },
  ],
};

// ─── Adventure 2: Which Lair? ───────────────────────────────────────────────

const LAIRS: WheelStep = {
  id: 'lairs',
  title: 'Which Lair?',
  subtitle: 'The wheel picks the door. Whatever is behind it picks the fight.',
  options: [
    {
      id: 'goblin_warren',
      label: 'Goblin Warren',
      description: `Noisy, numerous and badly organised. Power ${FOES.goblins.power}.`,
      baseWeight: 30,
      rarity: 'common',
      fameScaling: -0.1, // beneath a famous hero
      nextStepId: 'fight_goblins',
      color: '#6b7a3a',
      icon: 'Tent',
    },
    {
      id: 'spider_nest',
      label: 'Spider Nest',
      description: `Something large waits at the centre of the web. Power ${FOES.spiders.power}.`,
      baseWeight: 24,
      rarity: 'common',
      nextStepId: 'fight_spiders',
      color: '#4a3b5c',
      icon: 'Bug',
    },
    {
      id: 'troll_bridge',
      label: 'Troll Bridge',
      description: `The only crossing for miles, and it has a tenant. Power ${FOES.troll.power}.`,
      baseWeight: 18,
      rarity: 'uncommon',
      threatScaling: 0.1,
      nextStepId: 'fight_troll',
      color: '#5a6e5e',
      icon: 'Hammer',
    },
    {
      id: 'haunted_crypt',
      label: 'Haunted Crypt',
      description: `The dead here do not stay down. Power ${FOES.wights.power}.`,
      baseWeight: 14,
      rarity: 'uncommon',
      threatScaling: 0.15,
      condition: (world) => world.graveyard.length >= 2,
      lockedReason: (world) => `The dead walk only where the dead lie (${world.graveyard.length}/2 in the graveyard)`,
      nextStepId: 'fight_wights',
      color: '#3c5a6e',
      icon: 'Ghost',
    },
    {
      id: 'wyvern_roost',
      label: 'Wyvern Roost',
      description: `A cliff, a nest, and a shadow overhead. Power ${FOES.wyvern.power}.`,
      baseWeight: 9,
      rarity: 'rare',
      threatScaling: 0.2,
      fameScaling: 0.2,
      nextStepId: 'fight_wyvern',
      color: '#8a5a2e',
      icon: 'Feather',
    },
    {
      id: 'dragons_den',
      label: 'Dragon’s Den',
      description: `The mountain is warm from the inside. Power ${FOES.dragon.power}.`,
      baseWeight: 3,
      rarity: 'legendary',
      threatScaling: 0.3,
      fameScaling: 0.3, // dragons hear about the famous
      nextStepId: 'fight_dragon',
      color: '#b8452a',
      icon: 'Flame',
    },
  ],
};

// ─── Adventure 3: The Ruins ─────────────────────────────────────────────────

const RUINS: WheelStep = {
  id: 'ruins',
  title: 'The Sunken Ruins',
  subtitle: 'Something is still down here.',
  options: [
    {
      id: 'dusty_cache',
      label: 'Dusty Cache',
      description: 'Under the rubble, a blade worth keeping.',
      baseWeight: 30,
      rarity: 'common',
      weaponTierDelta: 1,
      nextStepId: null,
      color: '#7a6a4f',
      icon: 'Package',
    },
    {
      id: 'trapped_corridor',
      label: 'Trapped Corridor',
      description: 'You learned to watch your feet. The hard way.',
      baseWeight: 26,
      rarity: 'common',
      statModifiers: { agility: 1 },
      meters: { wounds: 1 },
      nextStepId: null,
      color: '#6e4a3a',
      icon: 'Zap',
    },
    {
      id: 'ancient_guardian',
      label: 'Ancient Guardian',
      description: `It still guards the vault. Power ${FOES.guardian.power}.`,
      baseWeight: 22,
      rarity: 'common',
      nextStepId: 'fight_guardian',
      color: '#5f6470',
      icon: 'Castle',
    },
    {
      id: 'forgotten_armory',
      label: 'Forgotten Armory',
      description: 'Racks of old steel, still sharp, and mail still bright.',
      baseWeight: 10,
      rarity: 'uncommon',
      weaponTierDelta: 2,
      armorTierDelta: 1,
      nextStepId: null,
      color: '#3f6a7a',
      icon: 'Swords',
    },
    {
      id: 'relic_of_kings',
      statScaling: { intellect: 0.04 },
      label: 'Relic of the Old Kings',
      description: 'A crown on a throne of bones. It fits.',
      baseWeight: 4,
      rarity: 'epic',
      luckScaling: 0.5,
      grantTraits: ['old_kings_relic'],
      nextStepId: null,
      color: '#9a7a2a',
      icon: 'Crown',
    },
    { id: 'deeper_still', label: 'A Stair Going Down', description: 'Further than anyone mapped. They will be back.', baseWeight: 4, rarity: 'epic', place: { deepen: 2 }, gear: { weapon: 4 }, luckDelta: 0.5, nextStepId: null, color: '#3f8a7a', icon: 'ArrowDown' },
    { id: 'picked_the_vault', label: 'Picked the Vault Lock', description: 'The real treasure was behind a door nobody else could open.', baseWeight: 10, rarity: 'rare', requiresTrait: ['skill_lockpicking'], weaponTierDelta: 2, luckDelta: 0.25, nextStepId: null, color: '#5a5f6e', icon: 'KeyRound' },
    { id: 'blinked_past', label: 'Blinked Past the Traps', description: 'Every trap sprang on empty air.', baseWeight: 10, rarity: 'rare', requiresTrait: ['blink', 'shadowstep'], weaponTierDelta: 1, statModifiers: { agility: 1 }, nextStepId: null, color: '#a07ae0', icon: 'Sparkle' },
  ],
};

// ─── Adventure 4: An Old Legend ─────────────────────────────────────────────

const LEGEND: WheelStep = {
  id: 'legend',
  title: 'An Old Legend',
  subtitle: 'They swore they were done with all this.',
  cast: { from: retiredLegends },
  options: [
    {
      id: 'words_of_wisdom',
      label: 'Words of Wisdom',
      description: 'Everything they wish someone had told them.',
      baseWeight: 40,
      rarity: 'common',
      statModifiers: { intellect: 2, agility: 1 },
      nextStepId: null,
      color: '#4f6f8f',
      icon: 'ScrollText',
    },
    {
      id: 'sparring',
      label: 'A Few Lessons',
      description: 'They still hit hard. You hit harder, by the end.',
      baseWeight: 30,
      rarity: 'common',
      statModifiers: { might: 2, vitality: 1 },
      nextStepId: null,
      color: '#8a5a3a',
      icon: 'Swords',
    },
    {
      id: 'gift_of_arms',
      label: 'Gift of Arms',
      description: 'Their old blade and armour, for a new hand, if they are better than yours.',
      baseWeight: 17,
      rarity: 'uncommon',
      spoils: handDownArms, // the legend's weapon, armour and named arms change hands
      nextStepId: null,
      color: '#3f6a7a',
      icon: 'Sword',
    },
    {
      id: 'signature_move',
      label: 'Their Signature Move',
      description: 'The one the songs are about. They teach it, slowly.',
      baseWeight: 17,
      rarity: 'uncommon',
      spoils: learnTechnique,
      nextStepId: null,
      color: '#8a6ae0',
      icon: 'Sparkles',
    },
    {
      id: 'challenged_them',
      label: 'Challenged Them',
      description: 'Old or not, there is only one way to know who is better.',
      baseWeight: 17,
      rarity: 'uncommon',
      nextStepId: 'fight_legend',
      color: '#a35d3a',
      icon: 'Swords',
    },
    {
      id: 'one_last_ride',
      label: 'One Last Ride',
      description: 'The legend takes the sword off the wall. The Hall of Fame has an empty seat.',
      baseWeight: 12,
      rarity: 'rare',
      castEffect: { setStatus: 'alive' }, // out of retirement, back on the roster
      luckDelta: 0.25,
      nextStepId: null,
      color: '#c9a24c',
      icon: 'UserPlus',
    },
    {
      id: 'passed_the_torch',
      label: 'Passed the Torch',
      description: 'They took one long look, and named them their successor: arms, art, and name.',
      baseWeight: 3,
      rarity: 'epic',
      spoils: passTheTorch,
      fame: 10,
      epithet: { text: 'Heir of a Legend', priority: 58 },
      nextStepId: null,
      color: '#ffd76a',
      icon: 'Flame',
    },
    {
      id: 'robbed_the_legend',
      label: 'Robbed Them Blind',
      description: 'The sword on the wall, the mail in the chest, the relic on the mantel.',
      baseWeight: 6,
      rarity: 'rare',
      condition: couldTurnOutlaw,
      lockedReason: (_world, char) => (char.personality === 'honorable' ? 'Honour forbids it' : 'Not the kind to steal'),
      spoils: takeEverything,
      fame: -5,
      meters: { notoriety: 2 },
      nextStepId: null,
      color: '#5a4a3a',
      icon: 'EyeOff',
    },
    {
      id: 'murdered_the_legend',
      label: 'Murdered Them',
      description: 'A legend’s treasure, and a legend’s blood on their hands.',
      baseWeight: 4,
      rarity: 'rare',
      condition: couldKneel,
      lockedReason: (_world, char) => (char.personality === 'honorable' ? 'Honour forbids it' : 'Their heart is not that dark'),
      castEffect: { setStatus: 'fallen', fallenBy: 'Murdered by' },
      spoils: takeEverything,
      grantTags: ['kinslayer'],
      fame: -12,
      meters: { notoriety: 3 },
      epithet: { text: 'the Legend-Killer', priority: 47 },
      nextStepId: null,
      color: '#6e1f2a',
      icon: 'Skull',
    },
  ],
};

// ─── Adventure 5: The Demon Lord's Envoy ────────────────────────────────────

const ENVOY: WheelStep = {
  id: 'envoy',
  title: 'The Envoy',
  subtitle: 'It offers power. It always offers power.',
  options: [
    {
      id: 'sent_away',
      label: 'Sent Away',
      description: 'You told it exactly where to go.',
      baseWeight: 40,
      rarity: 'common',
      statModifiers: { might: 1 },
      nextStepId: null,
      color: '#4f5f6f',
      icon: 'Ban',
    },
    {
      id: 'whispers',
      label: 'Haunting Whispers',
      description: 'You said no. You still hear the offer at night.',
      baseWeight: 22,
      rarity: 'uncommon',
      statModifiers: { intellect: -1, arcana: 2 },
      nextStepId: null,
      color: '#3a2f4f',
      icon: 'Eye',
    },
    {
      id: 'swear_fealty',
      label: 'Swear Fealty',
      description: 'You kneel. The power is real, and so is the leash.',
      baseWeight: 30,
      rarity: 'common',
      setRole: 'minion', // a Demon Lord's champion now: off the hero roster, onto other heroes' roads
      statModifiers: { might: 3, arcana: 3 },
      grantTraits: ['abyssal_pact'],
      condition: couldKneel,
      lockedReason: (_world, char) =>
        char.personality === 'honorable' ? 'Honour will not bend the knee' : 'Their heart is not dark enough to kneel',
      nextStepId: null,
      color: '#7f1d2e',
      icon: 'Handshake',
    },
    {
      id: 'banish',
      statScaling: { arcana: 0.04 },
      label: 'Banish the Envoy',
      description: 'Sent back to the Abyss in several pieces.',
      baseWeight: 8,
      rarity: 'rare',
      statModifiers: { arcana: 2 },
      grantTraits: ['envoy_bane'],
      nextStepId: null,
      color: '#d9b25a',
      icon: 'Sparkles',
    },
    { id: 'turned_the_envoy', label: 'Turned the Envoy', description: 'It defected on the spot, and told them where the Demon Lord is weak.', baseWeight: 4, rarity: 'epic', grantTraits: ['abyss_secret', 'envoy_bane'], epithet: { text: 'the Envoy-Turner', priority: 54 }, nextStepId: null, color: '#ffd76a', icon: 'Sparkles' },
    { id: 'burned_by_light', label: 'Burned by Their Light', description: 'The envoy took one look at them and fled, smoking.', baseWeight: 12, rarity: 'rare', requiresTrait: ['born_of_light', 'celestial_grace', 'radiant_aura'], grantTraits: ['envoy_bane'], nextStepId: null, color: '#f5c46a', icon: 'Sun' },
    { id: 'read_its_purpose', label: 'Read Its True Purpose', description: 'They saw every lie in the offer, and learned from them.', baseWeight: 12, rarity: 'rare', requiresTrait: ['mind_read'], statModifiers: { intellect: 2, arcana: 1 }, nextStepId: null, color: '#8abaf0', icon: 'Brain' },
    { id: 'out_negotiated', label: 'Out-Negotiated the Abyss', description: 'The envoy left with nothing, and paid for the privilege.', baseWeight: 12, rarity: 'rare', requiresTrait: ['skill_diplomacy'], luckDelta: 0.5, nextStepId: null, color: '#4f6f8f', icon: 'Handshake' },
  ],
};

// ─── Adventure 6: A Tempting Offer ──────────────────────────────────────────

const TEMPTATION: WheelStep = {
  id: 'temptation',
  title: 'A Tempting Offer',
  subtitle: 'Why be a hero, when you could be rich?',
  options: [
    {
      id: 'walk_away',
      label: 'Walk Away',
      description: 'You know how these stories end.',
      baseWeight: 45,
      rarity: 'common',
      statModifiers: { intellect: 1 },
      nextStepId: null,
      color: '#4f6f8f',
      icon: 'Ban',
    },
    {
      id: 'one_job',
      label: 'Just One Job',
      description: 'Nobody got hurt. Much. You kept the sword.',
      baseWeight: 33,
      rarity: 'common',
      weaponTierDelta: 1,
      meters: { notoriety: 1 },
      nextStepId: null,
      color: '#8a6a2e',
      icon: 'Coins',
    },
    {
      id: 'ride_with_them',
      label: 'Ride With Them',
      description: 'The road is wide, and the purses on it are heavy.',
      baseWeight: 22,
      rarity: 'uncommon',
      setRole: 'outlaw', // an outlaw now: off the hero roster, onto other heroes' roads
      statModifiers: { agility: 2 },
      nextStepId: null,
      color: '#4a3a5a',
      icon: 'UserX',
    },
    { id: 'took_over_the_gang', label: 'Took Over the Gang', description: 'They came to recruit a hero. They left with a new boss.', baseWeight: 4, rarity: 'epic', grantTraits: ['bandit_band'], meters: { notoriety: 2 }, epithet: { text: 'King of the Road', priority: 50 }, nextStepId: null, color: '#b8962e', icon: 'Crown' },
    { id: 'saw_through_it', label: 'Saw Through the Scheme', description: 'They knew a con when they heard one, and kept the advance.', baseWeight: 15, rarity: 'rare', requiresTrait: ['mind_read', 'skill_diplomacy'], statModifiers: { intellect: 1 }, weaponTierDelta: 1, luckDelta: 0.25, nextStepId: null, color: '#8abaf0', icon: 'Eye' },
  ],
};

// ─── Who crosses your path ──────────────────────────────────────────────────

/** The "who is it?" wheel's slices: tinted by what the candidate is now, each a slightly different shade. */
const CAST_LOOK: Record<string, { icon: string; shades: string[] }> = {
  legend: { icon: 'Medal', shades: ['#c9a24c', '#a8862e', '#d9b25a', '#b8962e'] },
  hero: { icon: 'User', shades: ['#4f86b8', '#3f6f9a', '#5f9ac4', '#46789e'] },
  outlaw: { icon: 'UserX', shades: ['#7a5a3a', '#5a4a3a', '#8a6a3a', '#6e4a2e'] },
  minion: { icon: 'Flame', shades: ['#7f1d2e', '#9a2a3a', '#6e1f2a', '#8a2e3e'] },
  npc: { icon: 'Store', shades: ['#3f8a7a', '#4f7a6a', '#2f7a6a', '#5a9a8a'] },
  ruler: { icon: 'Crown', shades: ['#e0a83a', '#d9952e', '#f0b84d', '#c98a2e'] },
  general: { icon: 'Flag', shades: ['#8a2e2e', '#9a3a2e', '#7a2a2a', '#a0443a'] },
  mentor: { icon: 'GraduationCap', shades: ['#5f9a6a', '#4f8a5a', '#6aa878', '#57905f'] },
  grave: { icon: 'Skull', shades: ['#5a6478', '#4f5a6e', '#646e84', '#566070'] },
  martyr: { icon: 'Sunrise', shades: ['#d9688a', '#c8587a', '#e07898', '#cf6080'] },
  relic: { icon: 'Gem', shades: ['#9a7ad0', '#8a6ac0', '#a888dc', '#9070c8'] },
  demonLord: { icon: 'Crown', shades: ['#dc2626'] },
};

/** Which look a candidate gets, from what they are now. */
function castLookOf(char: Character): string {
  if (char.status === 'fallen') return char.tags.includes('martyr') ? 'martyr' : 'grave';
  if (char.status === 'sealed') return 'relic';
  if (char.status === 'retired' || char.status === 'victorious') return 'legend';
  if (char.role === 'npc') return ['ruler', 'general', 'mentor'].find((tag) => char.tags.includes(tag)) ?? 'npc';
  return char.role;
}

const CAST_WHEEL: CastWheelConfig = {
  title: 'Who Crosses Your Path?',
  slice: (char) => {
    const look = CAST_LOOK[castLookOf(char)] ?? CAST_LOOK.hero!;
    const shade = [...char.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0);
    const races = racesOf(char).map((id) => (RACES as Record<string, Race>)[id]?.name ?? id);
    const race = races.length === 0 ? 'Unknown' : races.length === 1 ? races[0]! : `${[...races.slice(1), races[0]].join('–')} Hybrid`;
    const renowned = FAME_TIERS[renown(char)]!.name;
    const what =
      char.status === 'sealed'
        ? `Sealed in ${relicName(char)}`
        : char.status === 'fallen'
          ? (char.fate?.summary ?? 'Fallen')
          : `${race}, ${calculatePowerRating(char)} Combat Power`;
    return {
      description: `${char.title ? `${char.title}. ` : ''}${what}. ${renowned}.`,
      color: look.shades[Math.abs(shade) % look.shades.length],
      icon: look.icon,
    };
  },
};

// ─── Assembled config ───────────────────────────────────────────────────────

const register = (steps: WheelStep[]): Record<string, WheelStep> => Object.fromEntries(steps.map((s) => [s.id, s]));

export const GAME_CONFIG: GameConfig = {
  entryStepId: 'ancestry',
  steps: register([
    // Race wheels end at Archetype, unless a detour (a corrupted mortal's Sin, a hybrid's second half) is waiting.
    ...[ANCESTRY, ...RACE_WHEELS, ...OTHERWORLDLY_STEPS].map(rejoining),
    ARCHETYPE,
    FATE,
    ABYSS_CALLS,
    PERSONALITY,
    ...STAT_WHEELS,
    TALENTS,
    ARMORY,
    ...ARMOR_STEPS,
    ABYSSAL,
    ...POWER_STEPS,
    ...ACTIVITY_STEPS,
    TRAIN_STAT,
    ...TRAINING_WHEELS,
    ...ASCENSION_WHEELS,
    ROAD,
    LAIRS,
    RUINS,
    LEGEND,
    ENVOY,
    TEMPTATION,
    ...FIGHTS,
    ...LEGACY_STEPS,
    ...QUEST_STEPS,
    ...STAKES_STEPS,
  ]),
  traits: TRAITS,
  races: RACES,
  personalities: PERSONALITIES,
  archetypes: ARCHETYPES,
  fallbackNames: NAMES.human,
  baseStats: BASE_STATS,
  statName: statTierName,
  fame: FAME_CONFIG,
  storyFlags: STORY_FLAG_LABELS,
  adventure: {
    entryStepId: 'crossroads',
    castWheel: CAST_WHEEL,
    roadHome: { stepId: 'road_home', minSpins: 3 },
  },
  worldEvents: WORLD_EVENTS,
  meters: METERS,
  placeKinds: PLACE_KINDS,
  hooks: HOOKS,
  identities: IDENTITIES,
};
