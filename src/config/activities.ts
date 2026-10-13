/**
 * The crossroads: every adventure now starts by deciding what the hero does with it.
 *
 *   What Will You Do? ─┬─ Go on an Adventure ──▶ The Open Road (as before)
 *                      ├─ Train ──▶ which stat ──▶ its training wheel, or Ascension (stats.ts)
 *                      ├─ Mentor ──▶ who ──▶ their own lessons: only skills they know, magic if they
 *                      │                     have it, a stat only up to their own level
 *                      ├─ Twist of Fate (legendary) ──▶ a new life as one of the world's NPCs
 *                      ├─ Take a Quest ──▶ a 5–7 encounter story: the player chooses, wheels resolve (quests.ts)
 *                      ├─ Seek Out an Old Face ──▶ graves, rivals, legends, rulers... (legacy.ts)
 *                      ├─ Destiny Calls (Renowned+) ──▶ how the story ends (legacy.ts)
 *                      ├─ A Legendary Challenge (Famous+) ──▶ the greatest fights there are (legacy.ts)
 *                      └─ Find a Weapon, Find Armour, Tame a Beast, Make an Ally or an Enemy, Hunt,
 *                         a Challenge, a Tournament, War, Craft, Research, Study, a Hidden Place, a
 *                         Disaster, Evolve, Transform, Explore, a Skill, a Power, Mastery, Treasure
 *
 * There is no retirement wheel any more: every adventure earns fame (renown.ts), and fame
 * steers the crossroads. The famous are dealt war, disasters, challenges and destiny more
 * often (`fameScaling`), and study, crafts and quiet training less. Archetypes favour
 * different pursuits (archetypes.ts, `odds.crossroads`).
 */
import { STAT_KEYS, type CastSpoils, type Character, type StatBlock, type StatKey, type Trait, type WheelOption, type WheelStep } from '../engine/types';
import {
  FOES,
  IRON_WILL_SAVES,
  SINGLETON,
  deathCheatReason,
  couldTurnOutlaw,
  darkChampions,
  fightWheel,
  gearItem,
  BEST_FOUND_GEAR,
  hasTrait,
  isUncorruptable,
  mentors,
  outlawLockReason,
  outlaws,
} from './common';
import { isSingletonClaimed } from '../engine/world';
import { calculatePowerRating } from '../engine/power';
import { handDownArms, learnTechnique, passTheTorch } from './legacy';
import { POWER_WHEELS, canMasterAPower, knownPowers } from './powers';
import { isRace } from './races';
import { RENOWN, renownAtLeast } from './renown';
import { PAYABLE_HOOKS, UNFINISHED_BUSINESS, hasOpenPlace, holyRefusal, isUndead, refusedByHolyPlaces } from './stakes';

// ─── Traits ─────────────────────────────────────────────────────────────────

const trait = (id: string, name: string, description: string, power: number, scalesWith?: Trait['scalesWith'], item?: Trait['item']): Trait => ({
  id,
  name,
  description,
  power,
  ...(scalesWith && { scalesWith }),
  ...(item && { item }),
});

export const ACTIVITY_TRAITS: Record<string, Trait> = Object.fromEntries(
  [
    // Explore, weapons, allies, enemies
    trait('wayfarer', 'Wayfarer', 'Has walked off the edge of every map.', 25),
    trait('legendary_weapon', 'Legendary Weapon', 'A blade with a name older than kingdoms.', 40, undefined, 'weapon'),
    trait('ally_squire', 'Loyal Squire', 'Carries the bags and, sometimes, the day.', 15),
    trait('ally_ranger', 'Ranger Friend', 'Knows every trail and most shortcuts.', 20),
    trait('ally_witch', 'Hedge Witch Ally', 'Potions, hexes, and very good soup.', 25),
    trait('ally_comrade', 'Old Comrade', 'Fought beside them once. Will again.', 20),
    trait('ally_patron', 'Noble Patron', 'Money opens doors. So do friends at court.', 15),
    trait('ally_hero', 'Sworn Companion', 'Another hero, sworn to their side.', 30),
    trait('marked_by_darkness', 'Marked by the Demon Lord', 'The Abyss knows their name now.', 10),
    trait('shadow_nemesis', 'Shadow Nemesis', 'Their own shadow hunts them. It makes them sharp.', 30),
    // Fights
    trait('duelist', 'Undefeated Duelist', 'Nobody has drawn first blood on them. Yet.', 25, ['agility']),
    trait('champion_slayer', 'Breaker of Champions', 'Beat the one nobody beats.', 50),
    trait('realm_champion', 'Champion of the Realm', 'The tournament crown sits on their helm.', 40),
    trait('war_hero', 'Hero of the War', 'Songs are sung. Some of them are true.', 60),
    trait('spell_thief', 'Spell-Thief', 'Took a rogue mage’s spellbook, and read it.', 45, ['arcana']),
    trait('beast_slayer', 'Beast-Slayer', 'The man-eater will not eat again.', 30),
    // Craft, research, study
    trait('master_crafter', 'Master Crafter', 'Their work outlives them, and everyone knows it.', 20),
    trait('relic_forger', 'Relic-Forger', 'Made something that will be in a museum one day.', 50),
    trait('true_name', 'Keeper of a True Name', 'Knows the real name of something terrible.', 50, ['arcana']),
    // Beasts
    trait('companion_wolf', 'Wolf Companion', 'A grey shadow at their heel.', 20),
    trait('companion_hawk', 'Hawk Companion', 'Eyes in the sky.', 15),
    trait('companion_horse', 'Warhorse', 'Fearless, fast, and very large.', 20),
    trait('companion_bear', 'Bear Companion', 'A friend, as long as there is honey.', 30),
    trait('companion_griffin', 'Griffin Mount', 'Half eagle, half lion, all loyalty.', 50),
    trait('companion_dragon', 'Dragon Companion', 'Small now. Not for long.', 90),
    // Disasters, treasure, evolution
    trait('savior', 'Savior', 'Hundreds owe them their lives.', 25),
    trait('ancient_relic', 'Ancient Relic', 'It hums when danger is near.', 35, undefined, 'relic'),
    trait('apotheosis', 'Apotheosis', 'A mortal who became a god.', 80),
    // Mentors and skills
    trait('dragon_taught', 'Dragon-Taught', 'Learned from something that has lived a thousand years.', 40),
    trait('skill_swordplay', 'Swordplay', 'Proper footwork, proper form.', 15, ['might', 'agility']),
    trait('skill_archery', 'Archery', 'Splits arrows, on a good day.', 15, ['agility']),
    trait('skill_lockpicking', 'Lockpicking', 'No door stays shut for long.', 12),
    trait('skill_herbalism', 'Herbalism', 'Knows which leaf heals and which one kills.', 12),
    trait('skill_tracking', 'Tracking', 'Reads the ground like a letter.', 12),
    trait('skill_smithing', 'Smithing', 'Mends their own gear, and yours.', 15),
    trait('skill_diplomacy', 'Diplomacy', 'Talks their way out of fights. Usually.', 12),
    trait('skill_stealth', 'Stealth', 'Was never here.', 15),
    trait('skill_riding', 'Riding', 'At home in the saddle.', 12),
    trait('skill_alchemy', 'Alchemy', 'Potions, poisons, and the occasional explosion.', 18),
    trait('skill_tactics', 'Tactics', 'Sees the fight before it starts.', 15, ['intellect']),
    trait('skill_disguise', 'Disguise', 'A new face, a new walk, a new name.', 12),
    trait('skill_survival', 'Survival', 'Fire, shelter and supper, anywhere.', 12, ['vitality']),
    // A twist of fate: professions (no Combat Power: a different kind of life)
    trait('npc_shopkeeper', 'Shopkeeper', 'Runs a shop. Has seen every kind of hero walk in.', 0),
    trait('npc_blacksmith', 'Blacksmith', 'Forges the blades other heroes carry.', 0),
    trait('npc_innkeeper', 'Innkeeper', 'Pours the drinks and hears the rumours.', 0),
    trait('npc_farmer', 'Farmer', 'Traded the sword for a plough.', 0),
    trait('npc_elder', 'Village Elder', 'Settles disputes and remembers the old days.', 0),
    trait('npc_court_wizard', 'Court Wizard', 'Advises a monarch, and occasionally turns one into a frog.', 0),
    trait('npc_high_priest', 'High Priest', 'Speaks for the gods, loudly.', 0),
    trait('npc_bard', 'Bard of the Realm', 'Sings other heroes’ songs now.', 0),
    trait('npc_guildmaster', 'Guildmaster', 'Every merchant in the city answers to them.', 0),
    trait('npc_monarch', 'Monarch of the Realm', 'Wears the crown. Heroes kneel now.', 0),
  ].map((t) => [t.id, t]),
);

// ─── The crossroads ─────────────────────────────────────────────────────────

export const CROSSROADS: WheelStep = {
  id: 'crossroads',
  title: 'What Will You Do?',
  subtitle: 'A free season and a full pack. Who they are tilts the wheel; the more famous they are, the riskier the roads they take.',
  options: [
    { id: 'go_adventure', label: 'Go on an Adventure', description: 'The open road, and whatever is on it.', baseWeight: 24, rarity: 'common', nextStepId: 'road', color: '#7d8a6a', icon: 'Route' },
    { id: 'train', label: 'Train', description: 'Push one stat past where it stands.', baseWeight: 12, rarity: 'common', fameScaling: -0.1, nextStepId: 'train_stat', color: '#b8613a', icon: 'Dumbbell' },
    { id: 'explore', label: 'Explore', description: 'Find out what is past the last map.', baseWeight: 9, rarity: 'common', nextStepId: 'explore', color: '#4f8a5b', icon: 'Compass' },
    { id: 'find_weapon', label: 'Find a Weapon', description: 'Something sharper than what they carry. Twice as likely for empty hands.', baseWeight: 8, vary: (char) => (char.weaponTier === 0 ? { baseWeight: 16 } : {}), rarity: 'common', condition: (_world, char) => char.weaponTier < BEST_FOUND_GEAR, lockedReason: 'Nothing on the road beats the weapon they carry', nextStepId: 'find_weapon', color: '#a16207', icon: 'Sword' },
    { id: 'find_armor', label: 'Find Armour', description: 'Something between them and the next blade.', baseWeight: 7, rarity: 'common', condition: (_world, char) => char.armorTier < BEST_FOUND_GEAR, lockedReason: 'Nothing on the road beats the armour they wear', nextStepId: 'find_armor', color: '#6f7a8a', icon: 'Shield' },
    { id: 'take_quest', label: 'Take a Quest', description: 'A real story: five to seven hard roads, choices that matter, maybe a rival, and an ending shaped by all of it.', baseWeight: 16, rarity: 'common', fameScaling: 0.1, nextStepId: 'quest_hook', color: '#e0a83a', icon: 'ScrollText' },
    { id: 'seek_old_face', label: 'Seek Out an Old Face', description: 'A grave, a rival, a legend, a ruler: someone from the old stories.', baseWeight: 7, rarity: 'common', nextStepId: 'old_faces', color: '#4f86b8', icon: 'Users' },
    { id: 'make_ally', label: 'Make an Ally', description: 'Every legend has a friend in it.', baseWeight: 7, rarity: 'common', nextStepId: 'make_ally', color: '#3f7a9a', icon: 'Handshake' },
    { id: 'hunt', omenScaling: { dragon: 1.5 }, label: 'Hunt a Target', description: 'A bounty, a beast, a name on a list.', baseWeight: 7, rarity: 'common', fameScaling: 0.1, nextStepId: 'hunt', color: '#7a3e2e', icon: 'Crosshair' },
    { id: 'learn_skill', label: 'Learn a New Skill', description: 'Something useful, finally.', baseWeight: 7, rarity: 'common', fameScaling: -0.12, nextStepId: 'skills', color: '#5f9a6a', icon: 'GraduationCap' },
    { id: 'make_enemy', label: 'Make an Enemy', description: 'It happens to the best of us, and most to the famous.', baseWeight: 6, rarity: 'common', fameScaling: 0.15, nextStepId: 'make_enemy', color: '#6e1f2a', icon: 'UserX' },
    { id: 'craft', label: 'Craft', description: 'Hammer, anvil, and patience.', baseWeight: 6, rarity: 'common', fameScaling: -0.1, nextStepId: 'craft', color: '#8a6a3a', icon: 'Hammer' },
    { id: 'research', label: 'Research', description: 'Old books, older secrets.', baseWeight: 6, rarity: 'common', fameScaling: -0.1, nextStepId: 'research', color: '#4f5a9a', icon: 'BookOpen' },
    { id: 'study', label: 'Study', description: 'A season with the books.', baseWeight: 6, rarity: 'common', fameScaling: -0.12, nextStepId: 'study', color: '#5a6e8a', icon: 'Library' },
    { id: 'mentor', label: 'Find a Mentor', description: 'Someone who has done it all before.', baseWeight: 5, rarity: 'uncommon', fameScaling: -0.08, nextStepId: 'mentor', color: '#c9a24c', icon: 'Users' },
    { id: 'tame_beast', label: 'Tame a Beast', description: 'A companion with teeth.', baseWeight: 5, rarity: 'uncommon', nextStepId: 'tame_beast', color: '#8a6a3a', icon: 'PawPrint' },
    { id: 'challenge', omenScaling: { festival: 2 }, label: 'Receive a Challenge', description: 'Someone thinks they are better. The famous get a lot of these.', baseWeight: 5, rarity: 'uncommon', fameScaling: 0.2, nextStepId: 'challenge', color: '#a35d3a', icon: 'Swords' },
    { id: 'tournament', omenScaling: { festival: 3 }, label: 'Enter a Tournament', description: `Banners, lances, and a champion of ${FOES.tournament.power} power.`, baseWeight: 4, rarity: 'uncommon', fameScaling: 0.15, nextStepId: 'fight_tournament', color: '#c0569a', icon: 'Trophy' },
    { id: 'disaster', omenScaling: { plague: 2, peace: 0.5 }, label: 'Face a Disaster', description: 'The world breaks. Someone has to stand in the gap, and everyone looks at the famous.', baseWeight: 4, rarity: 'uncommon', threatScaling: 0.15, fameScaling: 0.2, nextStepId: 'disaster', color: '#8a3e2e', icon: 'CloudLightning' },
    { id: 'learn_power', omenScaling: { comet: 2.5 }, label: 'Learn a New Power', description: 'Something answers when they call.', baseWeight: 4, rarity: 'uncommon', nextStepId: 'power_school', color: '#7a5ad0', icon: 'Sparkles' },
    { id: 'treasure', label: 'Find a Treasure', description: 'X marks the spot. Probably.', baseWeight: 4, rarity: 'uncommon', luckScaling: 0.3, nextStepId: 'treasure', color: '#d9a400', icon: 'Gem' },
    { id: 'war', omenScaling: { war: 3 }, label: 'Go to War', description: `The kingdom calls its banners, the famous first. The enemy host is ${FOES.war.power} strong.`, baseWeight: 3, rarity: 'rare', threatScaling: 0.2, fameScaling: 0.3, nextStepId: 'fight_war', color: '#8a2e2e', icon: 'Flag' },
    { id: 'hidden_place', label: 'Discover a Hidden Place', description: 'A door that was not there yesterday.', baseWeight: 3, rarity: 'rare', fameScaling: 0.15, nextStepId: 'hidden_place', color: '#3fa8a0', icon: 'DoorOpen' },
    {
      ...renownAtLeast(RENOWN.famous),
      id: 'legendary_challenge',
      label: 'A Legendary Challenge',
      description: 'The Demon Lord, the first dragon, the Great War. Only the famous are asked.',
      baseWeight: 2.5,
      rarity: 'rare',
      fameScaling: 2,
      nextStepId: 'grand_challenge',
      color: '#ffb84d',
      icon: 'Crown',
    },
    {
      id: 'master_power',
      omenScaling: { comet: 2 },
      label: 'Master a Power',
      description: 'Pick one of their powers and practise it until it climbs a rank.',
      baseWeight: 3,
      rarity: 'rare',
      condition: (_world, char) => canMasterAPower(char),
      lockedReason: (_world, char) => (knownPowers(char).length > 0 ? 'Every power they know is already Transcendent' : 'They have no power to master yet'),
      nextStepId: 'master_power',
      color: '#8a6ae0',
      icon: 'Flame',
    },
    { id: 'evolve', label: 'Evolve', description: 'Grow into something more.', baseWeight: 2.5, rarity: 'rare', nextStepId: 'evolve', color: '#5a9a6a', icon: 'Sprout' },
    // The map: somewhere someone found, to go back to, deeper.
    { id: 'return_to_a_place', label: 'Return to a Place You Know', description: 'A ruin, a wild, a lair, a rift: somewhere on the map, found by them or by someone before them. Deeper is richer, and deadlier.', baseWeight: 7, rarity: 'common', fameScaling: 0.05, condition: (world) => hasOpenPlace(world), lockedReason: 'Nobody has put a place on the map yet', nextStepId: 'place_return', color: '#3f8a7a', icon: 'Map' },
    // Who they have become: a pursuit only they have.
    { id: 'the_hunt', label: 'The Hunt', description: 'Feed the Hunger, before it feeds itself.', baseWeight: 10, rarity: 'common', requiresRace: ['vampire'], nextStepId: 'the_hunt', color: '#8a1c2e', icon: 'Droplets' },
    { id: 'pack_run', label: 'Run With the Pack', description: 'Four legs, a cold wind, and the moon a little quieter after.', baseWeight: 10, rarity: 'common', requiresRace: ['werewolf'], nextStepId: 'pack_run', color: '#5a6478', icon: 'MoonStar' },
    { id: 'claim_a_hoard', label: 'Claim a Hoard', description: 'Every dragon has one.', baseWeight: 8, rarity: 'common', requiresRace: ['dragonborn'], nextStepId: 'dragon_hoard', color: '#b8452a', icon: 'Coins' },
    { id: 'the_artificer', label: 'Visit the Artificer', description: 'Repairs and upgrades: what rest and training are to the living.', baseWeight: 10, rarity: 'common', requiresRace: ['construct'], nextStepId: 'artificer', color: '#6a7a8a', icon: 'Wrench' },
    { id: 'raise_the_dead', label: 'Raise the Dead', description: 'There are always more bones.', baseWeight: 8, rarity: 'common', requiresRace: ['skeleton', 'lich'], nextStepId: 'raise_the_dead', color: '#c8c2b0', icon: 'Bone' },
    { id: 'raid', label: 'Ride Out With the Band', description: 'Twenty cutthroats, one boss.', baseWeight: 6, rarity: 'common', requiresTrait: ['bandit_band'], nextStepId: 'raid', color: '#7a5a3a', icon: 'Swords' },
    // Unfinished business, come due.
    { id: 'unfinished_business', label: 'Unfinished Business', description: 'Something they left behind has caught up with them: a map, a grudge, a thing that followed them home.', baseWeight: 10, rarity: 'common', requiresTag: PAYABLE_HOOKS, callback: 'Their unfinished business came due', nextStepId: UNFINISHED_BUSINESS, color: '#c9a24c', icon: 'ScrollText' },
    { id: 'prophecy', label: 'The Prophecy Comes True', description: 'They dreamed this. Now it is happening.', baseWeight: 10, rarity: 'common', requiresTag: ['hook:prophecy'], removeTags: ['hook:prophecy'], callback: 'The prophecy they dreamed came true', nextStepId: 'prophecy', color: '#ffe08a', icon: 'Sparkles' },
    { id: 'restore_the_prince', label: 'Restore the Prince', description: 'The exiled prince has an army, almost. It needs a champion.', baseWeight: 10, rarity: 'common', requiresTag: ['hook:exiled_prince'], callback: 'The exiled prince called in their oath', nextStepId: 'fight_prince_war', color: '#4f86b8', icon: 'Crown' },
    { id: 'transform', label: 'Transform', description: 'Something changes them, body and blood: a vampire, a werewolf, a dragonborn, a living statue, the undead.', baseWeight: 2.5, rarity: 'epic', fameScaling: 0.1, nextStepId: 'transform', color: '#6e2a5a', icon: 'Repeat' },
    {
      ...renownAtLeast(RENOWN.renowned),
      id: 'destiny',
      label: 'Destiny Calls',
      description: 'A throne, an apprentice, an army, a last stand. The more famous they are, the louder it calls.',
      baseWeight: 2.5,
      rarity: 'rare',
      fameScaling: 3,
      nextStepId: 'destiny',
      color: '#e8c060',
      icon: 'Sunrise',
    },
    { id: 'twist_fate', label: 'Twist of Fate', description: 'They stop being a hero, and start a whole new life in the world.', baseWeight: 0.6, rarity: 'legendary', nextStepId: 'twist_fate', color: '#ffb84d', icon: 'Shuffle' },
  ],
};

// ─── Small helpers ──────────────────────────────────────────────────────────

const unknown = (traitId: string): Pick<WheelOption, 'condition' | 'lockedReason'> => ({
  condition: (_world, char) => !hasTrait(char, traitId),
  lockedReason: 'Already theirs',
});

/**
 * A contest of one stat (riddles: Intellect; strength: Might; drinking: Vitality). The
 * higher the stat, the bigger the winning slices: the odds are dealt per character.
 */
function contest(
  id: string,
  title: string,
  subtitle: string,
  stat: keyof Character['stats'],
  win: Omit<WheelOption, 'id' | 'baseWeight' | 'nextStepId'>,
  lose: Omit<WheelOption, 'id' | 'baseWeight' | 'nextStepId'>,
  glory: Omit<WheelOption, 'id' | 'baseWeight' | 'nextStepId'>,
  legend: Omit<WheelOption, 'id' | 'baseWeight' | 'nextStepId'>,
): WheelStep {
  return {
    id,
    title,
    subtitle: `${subtitle} The higher their ${stat}, the better their odds.`,
    options: [
      { rarity: 'common', ...win, id: 'win', baseWeight: 10, vary: (c) => ({ baseWeight: Math.max(1, c.stats[stat]) }), nextStepId: null },
      { rarity: 'common', ...lose, id: 'lose', baseWeight: 10, vary: (c) => ({ baseWeight: Math.max(1, 26 - c.stats[stat]) }), nextStepId: null },
      { rarity: 'rare', ...glory, id: 'glory', baseWeight: 2, vary: (c) => ({ baseWeight: Math.max(0.5, (c.stats[stat] - 8) / 3) }), nextStepId: null },
      { rarity: 'epic', ...legend, id: 'legend', baseWeight: 0.6, vary: (c) => ({ baseWeight: Math.max(0.2, (c.stats[stat] - 8) / 10) }), nextStepId: null },
    ],
  };
}

// ─── Pursuits ───────────────────────────────────────────────────────────────

const EXPLORE: WheelStep = {
  id: 'explore',
  title: 'Where Does the Map End?',
  subtitle: 'Pick a direction. Keep walking. Whatever they find goes on the map, for them or whoever comes next.',
  options: [
    { id: 'old_ruins', label: 'A Ruin Nobody Mapped', description: 'Someone built here, long ago. It goes on the map, theirs to come back to.', baseWeight: 26, rarity: 'common', place: { discover: 'ruin' }, nextStepId: 'ruins', color: '#4f8a5b', icon: 'Landmark' },
    { id: 'uncharted_wilds', label: 'Uncharted Wilds', description: 'Nobody has been here. Now somebody has, and it has a name.', baseWeight: 22, rarity: 'common', place: { discover: 'wild' }, statModifiers: { agility: 1, vitality: 1 }, luckDelta: 0.25, nextStepId: null, color: '#3f8a4a', icon: 'Trees' },
    { id: 'lost', label: 'Hopelessly Lost', description: 'Three days in circles, and on the third night, something followed them back.', baseWeight: 16, rarity: 'common', meters: { wounds: 1 }, grantTags: ['hook:followed'], nextStepId: null, color: '#6e6a62', icon: 'CircleQuestionMark' },
    { id: 'monster_country', label: 'Monster Country', description: 'The maps just say "no". Theirs will say where the lair is.', baseWeight: 14, rarity: 'uncommon', place: { discover: 'lair' }, nextStepId: 'lairs', color: '#5b3f6e', icon: 'Skull' },
    { id: 'hidden_valley', label: 'A Hidden Valley', description: 'Between two mountains that weren’t on any map, a door.', baseWeight: 10, rarity: 'uncommon', nextStepId: 'hidden_place', color: '#3fa8a0', icon: 'DoorOpen' },
    { id: 'wander', label: 'Back to the Open Road', description: 'The map ran out of interesting. The road never does.', baseWeight: 10, rarity: 'uncommon', nextStepId: 'road', color: '#7d8a6a', icon: 'Footprints' },
    { id: 'edge_of_the_map', statScaling: { intellect: 0.03 }, label: 'The Edge of the Map', description: 'They found where it ends, and kept going. Wayfarers find ways nobody else can, wherever they return.', baseWeight: 4, rarity: 'rare', grantTraits: ['wayfarer'], epithet: { text: 'the Wayfarer', priority: 30 }, nextStepId: null, color: '#c9a24c', icon: 'Map' },
    { id: 'lost_city', label: 'A Lost City', description: 'Towers under a lake, or a necropolis under the sand. Someone is still on the throne.', baseWeight: 2.5, rarity: 'epic', place: { discover: 'city' }, nextStepId: 'lost_city', color: '#3f7ab8', icon: 'Castle' },
    { id: 'door_in_the_sky', label: 'A Door in the Sky', description: 'At the top of the highest mountain, a door, standing open, with clouds behind it.', baseWeight: 1.5, rarity: 'legendary', place: { discover: 'rift' }, nextStepId: 'sky_door', color: '#ffe08a', icon: 'DoorOpen' },
  ],
};

const FIND_WEAPON: WheelStep = {
  id: 'find_weapon',
  title: 'What Do You Find?',
  subtitle: 'Somewhere out there is a better blade.',
  options: [
    { id: 'rusty_blade', label: 'A Rusty Blade', description: 'Better than nothing. Barely.', baseWeight: 34, rarity: 'common', ...gearItem('weapon', 1), nextStepId: null, color: '#a16207', icon: 'Slice' },
    { id: 'fine_steel', label: 'Fine Steel', description: 'Balanced, sharp, and theirs.', baseWeight: 26, rarity: 'common', ...gearItem('weapon', 2), nextStepId: null, color: '#6e7a8a', icon: 'Sword' },
    { id: 'nothing_useful', label: 'An Old Map Instead', description: 'No blade, but a map to one, scrawled on the back of a wanted poster.', baseWeight: 20, rarity: 'common', grantTags: ['hook:map'], nextStepId: null, color: '#6b7280', icon: 'Map' },
    { id: 'follow_the_map', label: 'Follow the Old Map', description: 'The X is two valleys over.', baseWeight: 30, rarity: 'common', requiresTag: ['hook:map'], removeTags: ['hook:map'], callback: 'They followed the old map', nextStepId: 'map_cache', color: '#a08a5a', icon: 'Map' },
    { id: 'blade_chooses_you', label: 'The Blade Chooses You', description: 'A sword in a stone, and it is speaking.', baseWeight: 1, rarity: 'legendary', nextStepId: 'whispering_blade', color: '#6a3a8a', icon: 'Sword' },
    { id: 'heirloom', statScaling: { intellect: 0.02 }, label: 'A Hero’s Heirloom', description: 'Found in a cairn, with a note: "Use it well."', baseWeight: 10, rarity: 'uncommon', ...gearItem('weapon', 3), nextStepId: null, color: '#0e7490', icon: 'Medal' },
    { id: 'cursed_blade', label: 'A Cursed Blade', description: 'It cuts anything. It whispers at night.', baseWeight: 5, rarity: 'rare', ...gearItem('weapon', 4), luckDelta: -0.5, grantTags: ['cursed'], epithet: { text: 'the Cursebound', priority: 30 }, nextStepId: null, color: '#5a2a6e', icon: 'Skull' },
    { ...gearItem('weapon', 5), id: 'legendary_weapon', statScaling: { intellect: 0.03 }, label: 'A Legendary Weapon', description: 'The one from the songs. It was real.', baseWeight: 1.2, rarity: 'legendary', grantTraits: ['legendary_weapon'], epithet: { text: 'Wielder of Legends', priority: 62 }, nextStepId: null, color: '#ffb84d', icon: 'Swords' },
    { ...gearItem('weapon', 4), id: 'reforged', label: 'Reforged an Old Blade', description: 'A broken sword, a borrowed forge, and their own two hands.', baseWeight: 8, rarity: 'rare', requiresTrait: ['skill_smithing', 'master_crafter', 'runesmith'], nextStepId: null, color: '#8a6a3a', icon: 'Anvil' },
  ],
};

const MAKE_ALLY: WheelStep = {
  id: 'make_ally',
  title: 'Who Joins You?',
  subtitle: 'A friend on the road is worth two swords.',
  options: [
    { ...unknown('ally_squire'), id: 'loyal_squire', label: 'A Loyal Squire', description: 'Young, eager, and surprisingly useful.', baseWeight: 30, rarity: 'common', grantTraits: ['ally_squire'], nextStepId: null, color: '#8a7a52', icon: 'User' },
    { ...unknown('ally_ranger'), id: 'ranger_friend', label: 'A Ranger', description: 'Knows the woods. Knows a shortcut.', baseWeight: 24, rarity: 'common', grantTraits: ['ally_ranger'], nextStepId: null, color: '#3f7a4a', icon: 'Target' },
    { id: 'false_friend', label: 'A False Friend', description: 'Gone in the night, with the good sword.', baseWeight: 16, rarity: 'common', weaponTierDelta: -1, luckDelta: -0.25, nextStepId: null, color: '#5a4a3a', icon: 'UserX' },
    { ...unknown('ally_witch'), id: 'hedge_witch', label: 'A Hedge Witch', description: 'Potions, hexes, and very good soup.', baseWeight: 14, rarity: 'uncommon', grantTraits: ['ally_witch'], nextStepId: null, color: '#5a6e4a', icon: 'FlaskConical' },
    { ...unknown('ally_comrade'), id: 'old_comrade', label: 'An Old Comrade', description: 'A familiar face, and a familiar axe.', baseWeight: 12, rarity: 'uncommon', grantTraits: ['ally_comrade'], nextStepId: null, color: '#8a5a3a', icon: 'Shield' },
    { ...unknown('ally_hero'), id: 'fellow_hero', label: 'A Fellow Hero', description: 'Another legend in the making, sworn to their side.', baseWeight: 10, rarity: 'uncommon', grantTraits: ['ally_hero'], nextStepId: null, color: '#c9a24c', icon: 'Users' },
    { ...unknown('ally_patron'), id: 'noble_patron', statScaling: { intellect: 0.04 }, label: 'A Noble Patron', description: 'Gold, introductions, and expectations.', baseWeight: 6, rarity: 'rare', grantTraits: ['ally_patron'], luckDelta: 0.5, nextStepId: null, color: '#b8962e', icon: 'Crown' },
    { id: 'exiled_prince', label: 'An Exiled Prince', description: 'Ragged, proud, and the rightful heir to a stolen throne. They swore to help win it back.', baseWeight: 4, rarity: 'epic', grantTags: ['hook:exiled_prince'], fame: 5, nextStepId: null, color: '#4f86b8', icon: 'Crown' },
    { ...unknown('dragon_bond'), id: 'dragon_in_disguise', label: 'A Dragon in Disguise', description: 'The old traveller at the inn was not an old traveller. It liked them anyway.', baseWeight: 1, rarity: 'legendary', grantTraits: ['dragon_bond'], epithet: { text: 'Dragon-Friend', priority: 70 }, nextStepId: null, color: '#b8452a', icon: 'Egg' },
    { id: 'whole_retinue', label: 'A Whole Retinue', description: 'One conversation, and half the tavern swore to follow them.', baseWeight: 6, rarity: 'rare', requiresTrait: ['skill_diplomacy'], grantTraits: ['ally_squire', 'ally_comrade'], luckDelta: 0.25, nextStepId: null, color: '#4f6f8f', icon: 'Users' },
  ],
};

const MAKE_ENEMY: WheelStep = {
  id: 'make_enemy',
  title: 'Who Hates You Now?',
  subtitle: 'Fame has a price. Here is the bill.',
  options: [
    { id: 'jealous_rival', label: 'A Jealous Rival', description: 'Wants what they have. Makes them better, out of spite, and rivals cross their road more often.', baseWeight: 30, rarity: 'common', grantTags: ['rival'], statModifiers: { might: 1 }, nextStepId: null, color: '#8a5a2e', icon: 'Swords' },
    { id: 'spurned_noble', label: 'A Spurned Noble', description: 'Never forgets, never forgives, never pays their own assassins. Ambushes on the road double.', baseWeight: 22, rarity: 'common', grantTags: ['hunted'], luckDelta: -0.25, nextStepId: null, color: '#7a3e8a', icon: 'Crown' },
    { id: 'made_peace', statScaling: { intellect: 0.03 }, label: 'Made Peace Instead', description: 'The feud ended over a drink, and the enemy became an old comrade.', baseWeight: 18, rarity: 'common', statModifiers: { intellect: 1 }, grantTraits: ['ally_comrade'], nextStepId: null, color: '#4f6f8f', icon: 'Handshake' },
    { id: 'bandit_lord', label: 'A Bandit Lord', description: 'A price on their head. They sleep lighter now, and ambushes on the road double.', baseWeight: 14, rarity: 'uncommon', grantTags: ['hunted'], statModifiers: { agility: 1 }, nextStepId: null, color: '#5a4a3a', icon: 'UserX' },
    { id: 'vengeful_sorcerer', label: 'A Vengeful Sorcerer', description: 'A hex that never quite lifts: their luck sours.', baseWeight: 12, rarity: 'uncommon', grantTags: ['hexed'], statModifiers: { arcana: 1, vitality: -1 }, luckDelta: -0.25, nextStepId: null, color: '#4a2f7a', icon: 'WandSparkles' },
    {
      id: 'demon_lord_notices',
      label: 'The Demon Lord Notices',
      description: 'The Abyss turns its eye on them. Its envoys and champions come twice as often.',
      baseWeight: 5,
      rarity: 'rare',
      grantTraits: ['marked_by_darkness'],
      grantTags: ['marked'],
      epithet: { text: 'Marked by the Demon Lord', priority: 45 },
      condition: (world) => isSingletonClaimed(world, SINGLETON.demonLord),
      lockedReason: 'No Demon Lord reigns to notice anyone',
      nextStepId: null,
      color: '#7f1d1d',
      icon: 'Eye',
    },
    { ...unknown('shadow_nemesis'), id: 'your_own_shadow', label: 'Their Own Shadow', description: 'It peeled off one night and walked away. It is waiting.', baseWeight: 2, rarity: 'epic', grantTraits: ['shadow_nemesis'], epithet: { text: 'the Shadow-Haunted', priority: 40 }, nextStepId: null, color: '#1f1f2a', icon: 'Ghost' },
    { id: 'enemy_to_friend', label: 'Turned an Enemy Into a Friend', description: 'The rival came to fight and stayed for dinner.', baseWeight: 10, rarity: 'rare', requiresTrait: ['skill_diplomacy'], grantTraits: ['ally_comrade'], statModifiers: { intellect: 1 }, nextStepId: null, color: '#4f6f8f', icon: 'Handshake' },
  ],
};

const HUNT: WheelStep = {
  id: 'hunt',
  title: 'What Are You Hunting?',
  subtitle: 'A name on a bounty board, or tracks in the mud.',
  options: [
    { id: 'man_eater', label: 'A Man-Eater', description: `Something has been taking travellers. Power ${FOES.beast.power}.`, baseWeight: 30, rarity: 'common', nextStepId: 'fight_beast', color: '#7a5a3a', icon: 'PawPrint' },
    { id: 'rogue_mage', label: 'A Rogue Mage', description: `Burned a village, and laughed. Power ${FOES.rogueMage.power}.`, baseWeight: 22, rarity: 'common', nextStepId: 'fight_rogue_mage', color: '#4a2f7a', icon: 'WandSparkles' },
    { id: 'bridge_troll', label: 'The Bridge Troll', description: `The toll got too high. Power ${FOES.troll.power}.`, baseWeight: 18, rarity: 'common', nextStepId: 'fight_troll', color: '#5a6e5e', icon: 'Hammer' },
    { id: 'cold_trail', label: 'Strange Tracks', description: 'The bounty’s trail went cold, but they found other tracks. Far too big. Something else is out there.', baseWeight: 16, rarity: 'common', statModifiers: { intellect: 1 }, grantTags: ['hook:strange_tracks'], nextStepId: null, color: '#6e6a62', icon: 'Footprints' },
    { id: 'follow_the_tracks', label: 'Follow the Strange Tracks', description: 'They go into the hills, and they get bigger.', baseWeight: 30, rarity: 'common', requiresTag: ['hook:strange_tracks'], callback: 'They followed the strange tracks to the end', nextStepId: 'fight_apex', color: '#7a5a3a', icon: 'Footprints' },
    { id: 'most_wanted', label: 'The Kingdom’s Most Wanted', description: 'A name every bounty hunter gave up on. They brought it in, alive.', baseWeight: 4, rarity: 'epic', grantTraits: ['royal_favor'], fame: 15, epithet: { text: 'the Bounty-Breaker', priority: 52 }, nextStepId: null, color: '#ffd76a', icon: 'Crosshair' },
    { id: 'outlaw_bounty', label: 'An Outlaw’s Bounty', description: 'A hero who went bad. The board wants them back.', baseWeight: 14, rarity: 'uncommon', condition: (world) => outlaws(world).length > 0, lockedReason: 'No hero has turned outlaw yet', nextStepId: 'fight_outlaw', color: '#5a4a3a', icon: 'UserX' },
    { id: 'wyvern', omenScaling: { dragon: 2 }, label: 'A Wyvern', description: `A shadow over the herds. Power ${FOES.wyvern.power}.`, baseWeight: 10, rarity: 'uncommon', nextStepId: 'fight_wyvern', color: '#8a5a2e', icon: 'Feather' },
    { id: 'dark_champion_bounty', label: 'A Dark Champion', description: 'A hero who knelt to the Demon Lord. Bring them down.', baseWeight: 8, rarity: 'uncommon', condition: (world) => darkChampions(world).length > 0, lockedReason: 'No hero has sworn to the Demon Lord yet', nextStepId: 'fight_champion', color: '#6e1f1f', icon: 'Flame' },
    { id: 'hawk_spotted', label: 'The Hawk Spotted It First', description: 'A cry from above, and the quarry had nowhere left to hide.', baseWeight: 8, rarity: 'rare', requiresTrait: ['companion_hawk', 'skill_tracking'], grantTraits: ['beast_slayer'], statModifiers: { agility: 1 }, nextStepId: null, color: '#8a6a3a', icon: 'Bird' },
  ],
};

const CHALLENGE: WheelStep = {
  id: 'challenge',
  title: 'Who Challenges You?',
  subtitle: 'A glove on the floor. Pick it up.',
  options: [
    { id: 'duel', label: 'A Duel', description: `Steel at dawn, against a duelist of ${FOES.duelist.power} power.`, baseWeight: 34, rarity: 'common', nextStepId: 'fight_duel', color: '#a35d3a', icon: 'Swords' },
    { id: 'riddle_contest', label: 'A Riddle Contest', description: 'A sphinx, or a very smug scholar.', baseWeight: 24, rarity: 'common', nextStepId: 'riddle_contest', color: '#4f6f8f', icon: 'Brain' },
    { id: 'feat_of_strength', label: 'A Feat of Strength', description: 'Lift it, throw it, or break it.', baseWeight: 22, rarity: 'common', nextStepId: 'feat_of_strength', color: '#b8613a', icon: 'BicepsFlexed' },
    { id: 'drinking_contest', omenScaling: { festival: 2 }, label: 'A Drinking Contest', description: 'The dwarves started it.', baseWeight: 14, rarity: 'uncommon', nextStepId: 'drinking_contest', color: '#b8862e', icon: 'Beer' },
    { id: 'death_itself', label: 'Death Itself', description: 'A pale rider at the crossroads, offering a game. The stakes are what you think they are.', baseWeight: 1, rarity: 'legendary', nextStepId: 'fight_death', color: '#e8e8f0', icon: 'Skull' },
    { id: 'champion_challenge', label: 'An Undefeated Champion', description: `Nobody has ever beaten them. Power ${FOES.undefeated.power}.`, baseWeight: 6, rarity: 'rare', nextStepId: 'fight_champion_duel', color: '#c9a24c', icon: 'Crown' },
  ],
};

const CONTESTS: WheelStep[] = [
  contest(
    'riddle_contest',
    'The Riddle Contest',
    'Three riddles. Wrong answers are remembered.',
    'intellect',
    { label: 'Answered Them All', description: 'The sphinx sulked. The prize was real.', statModifiers: { intellect: 1 }, luckDelta: 0.25, color: '#4f6f8f', icon: 'Brain' },
    { label: 'Stumped', description: '"What has roots nobody sees?" They still don’t know.', luckDelta: -0.25, color: '#6e6a62', icon: 'CircleQuestionMark' },
    { label: 'Out-Riddled the Riddler', description: 'They asked one back. Nobody has answered it yet.', statModifiers: { intellect: 3 }, epithet: { text: 'the Riddle-Breaker', priority: 35 }, color: '#8abaf0', icon: 'Sparkles' },
    { label: 'The Sphinx Tells Its Secret', description: 'It was so pleased to lose that it told them the one thing it never tells anyone: a true name.', grantTraits: ['true_name'], statModifiers: { intellect: 2 }, epithet: { text: 'Sphinx-Friend', priority: 50 }, color: '#ffd76a', icon: 'ScrollText' },
  ),
  contest(
    'feat_of_strength',
    'A Feat of Strength',
    'The stone has never moved. Today might be different.',
    'might',
    { label: 'Lifted It', description: 'The crowd roared. Their back complained.', statModifiers: { might: 1 }, color: '#b8613a', icon: 'BicepsFlexed' },
    { label: 'Didn’t Budge', description: 'The stone won. It always wins. Their back lost.', meters: { wounds: 1 }, color: '#6e6a62', icon: 'Mountain' },
    { label: 'Threw It', description: 'Over the wall. Into the next village.', statModifiers: { might: 3 }, epithet: { text: 'the Stone-Thrower', priority: 35 }, color: '#f08a62', icon: 'Trophy' },
    { label: 'Pulled the Sword From the Stone', description: 'The stone had a sword in it all along. Nobody else ever got it to move.', gear: { weapon: 6 }, fame: 20, epithet: { text: 'Who Drew the Sword', priority: 75 }, color: '#ffe08a', icon: 'Sword' },
  ),
  contest(
    'drinking_contest',
    'The Drinking Contest',
    'Last one standing wins the keg.',
    'vitality',
    { label: 'Still Standing', description: 'Mostly. With help.', statModifiers: { vitality: 1 }, color: '#b8862e', icon: 'Beer' },
    { label: 'Under the Table', description: 'They woke up in a different town.', luckDelta: -0.25, color: '#6e6a62', icon: 'Moon' },
    { label: 'Drank the Dwarves Dry', description: 'The dwarves have written a song about it. It is not flattering.', statModifiers: { vitality: 2 }, luckDelta: 0.25, epithet: { text: 'the Bottomless', priority: 35 }, color: '#f5c07a', icon: 'Trophy' },
    { label: 'Drank With a God', description: 'The last one standing beside them was the god of revels, in disguise. It was impressed.', grantTraits: ['divine_favor'], luckDelta: 0.5, epithet: { text: 'Drinking-Companion of a God', priority: 52 }, color: '#ffd76a', icon: 'Wine' },
  ),
];

const CRAFT: WheelStep = {
  id: 'craft',
  title: 'What Do You Make?',
  subtitle: 'The forge is hot. Make something worth the burns.',
  options: [
    { id: 'sturdy_weapon', label: 'A Sturdy Weapon', description: 'Plain, sharp, reliable.', baseWeight: 30, rarity: 'common', ...gearItem('weapon', 1), nextStepId: null, color: '#6e7a8a', icon: 'Sword' },
    { id: 'armor', label: 'A Suit of Armour', description: 'Dented on day one. Still holding.', baseWeight: 24, rarity: 'common', ...gearItem('armor', 2), nextStepId: null, color: '#5f6470', icon: 'Shield' },
    { id: 'trinket', label: 'A Lucky Charm', description: 'Hammered into a buckler. It probably does nothing. It feels like it does something.', baseWeight: 18, rarity: 'common', luckDelta: 0.25, armorTierDelta: 1, nextStepId: null, color: '#9ac46a', icon: 'Clover' },
    { id: 'botched', label: 'Botched It', description: 'Burnt fingers and a lesson.', baseWeight: 16, rarity: 'common', statModifiers: { intellect: 1 }, meters: { wounds: 1 }, nextStepId: null, color: '#7a3a2e', icon: 'Flame' },
    { id: 'arcane_focus', statScaling: { arcana: 0.03 }, label: 'An Arcane Focus', description: 'A crystal that hums when magic is near.', baseWeight: 12, rarity: 'uncommon', statModifiers: { arcana: 2 }, nextStepId: null, color: '#7a5ad0', icon: 'Gem' },
    { ...unknown('master_crafter'), id: 'masterwork', statScaling: { intellect: 0.04 }, label: 'A Masterwork', description: 'Smiths come from three kingdoms to see it.', baseWeight: 5, rarity: 'rare', ...gearItem('weapon', 3, false), grantTraits: ['master_crafter'], epithet: { text: 'the Master Smith', priority: 40 }, nextStepId: null, color: '#c9a24c', icon: 'Anvil' },
    { ...unknown('relic_forger'), id: 'relic', statScaling: { intellect: 0.04 }, label: 'A Relic for the Ages', description: 'It will outlive them, and their name with it.', baseWeight: 1, rarity: 'legendary', ...gearItem('weapon', 4, false), grantTraits: ['relic_forger'], epithet: { text: 'the Relic-Forger', priority: 60 }, nextStepId: null, color: '#ffb84d', icon: 'Hammer' },
    { id: 'smiths_masterpiece', label: 'A Smith’s Masterpiece', description: 'Years at the anvil, poured into one blade.', baseWeight: 10, rarity: 'rare', requiresTrait: ['skill_smithing', 'runesmith'], ...gearItem('weapon', 4, false), grantTraits: ['master_crafter'], nextStepId: null, color: '#c9a24c', icon: 'Anvil' },
    { id: 'perfect_elixir', label: 'A Perfect Elixir', description: 'It glows. It tastes awful. It works.', baseWeight: 10, rarity: 'rare', requiresTrait: ['skill_alchemy', 'ally_witch'], statModifiers: { vitality: 3 }, luckDelta: 0.25, nextStepId: null, color: '#7ac46a', icon: 'FlaskConical' },
  ],
};

const RESEARCH: WheelStep = {
  id: 'research',
  title: 'What Do You Uncover?',
  subtitle: 'Dusty shelves, and something between the pages.',
  options: [
    { id: 'ancient_tome', label: 'An Ancient Tome', description: 'Hard going. In the back, a ruin nobody has found. It goes on the map.', baseWeight: 30, rarity: 'common', statModifiers: { intellect: 2 }, place: { discover: 'ruin' }, nextStepId: null, color: '#6e5a3a', icon: 'BookOpen' },
    { id: 'dead_end', label: 'A Name in the Margin', description: 'Months of reading about turnips, and then, in the margin, underlined twice, a name.', baseWeight: 24, rarity: 'common', grantTags: ['hook:margin_name'], nextStepId: null, color: '#6b7280', icon: 'ScrollText' },
    { id: 'whose_name', label: 'Whose Name It Was', description: 'They finally worked it out.', baseWeight: 30, rarity: 'common', requiresTag: ['hook:margin_name'], removeTags: ['hook:margin_name'], callback: 'They found out whose name was in the margin', nextStepId: 'margin_name', color: '#4f5a9a', icon: 'BookOpen' },
    { id: 'forgotten_spell', statScaling: { arcana: 0.03 }, label: 'A Forgotten Spell', description: 'Written in the margin. It still works.', baseWeight: 14, rarity: 'uncommon', nextStepId: POWER_WHEELS.arcane, color: '#7a5ad0', icon: 'WandSparkles' },
    { id: 'treasure_map', label: 'A Treasure Map', description: 'Tucked in the back cover. X marks the spot.', baseWeight: 12, rarity: 'uncommon', nextStepId: 'treasure', color: '#d9a400', icon: 'Map' },
    { id: 'hidden_door', label: 'A Hidden Door', description: 'Behind the shelf. Of course it was.', baseWeight: 10, rarity: 'uncommon', nextStepId: 'hidden_place', color: '#3fa8a0', icon: 'DoorOpen' },
    { id: 'forbidden_lore', label: 'Forbidden Lore', description: 'Some books read you back.', baseWeight: 5, rarity: 'rare', grantTags: ['cursed'], epithet: { text: 'the Forbidden Scholar', priority: 30 }, nextStepId: POWER_WHEELS.corrupted, color: '#5a2a3a', icon: 'Skull' },
    { ...unknown('true_name'), id: 'true_name', statScaling: { intellect: 0.05 }, label: 'A True Name', description: 'The real name of something terrible. It listens when spoken.', baseWeight: 2, rarity: 'epic', grantTraits: ['true_name'], epithet: { text: 'Keeper of True Names', priority: 50 }, nextStepId: null, color: '#c9a24c', icon: 'ScrollText' },
    { id: 'lost_cipher', label: 'Decoded the Lost Cipher', description: 'A spell nobody has cast in a thousand years.', baseWeight: 10, rarity: 'rare', requiresTrait: ['arcane_savant', 'archmage'], nextStepId: POWER_WHEELS.arcane, color: '#7a5ad0', icon: 'ScrollText' },
  ],
};

const STUDY: WheelStep = {
  id: 'study',
  title: 'What Do You Study?',
  subtitle: 'Candles, ink, and a sore back.',
  options: [
    { id: 'letters', label: 'History and Letters', description: 'Kings, wars, and the mistakes they made.', baseWeight: 28, rarity: 'common', statModifiers: { intellect: 2 }, nextStepId: null, color: '#6e5a3a', icon: 'ScrollText' },
    { id: 'tactics', label: 'Tactics', description: 'How battles are won before they start.', baseWeight: 24, rarity: 'common', statModifiers: { might: 1, intellect: 1 }, nextStepId: null, color: '#8a5a3a', icon: 'Flag' },
    { id: 'arcane_theory', label: 'Arcane Theory', description: 'Why spells work. Mostly.', baseWeight: 20, rarity: 'common', statModifiers: { arcana: 2 }, nextStepId: null, color: '#5a5ad0', icon: 'WandSparkles' },
    { id: 'meditation', label: 'Meditation', description: 'Stillness. Breath. A calmer heart.', baseWeight: 14, rarity: 'uncommon', statModifiers: { vitality: 1 }, luckDelta: 0.25, nextStepId: null, color: '#5f9a6a', icon: 'Leaf' },
    { id: 'fell_asleep', label: 'Fell Asleep in the Library', description: 'They dozed off over a star-chart and dreamed something that hasn’t happened yet.', baseWeight: 12, rarity: 'uncommon', grantTags: ['hook:prophecy'], nextStepId: null, color: '#6b7280', icon: 'Moon' },
    { id: 'library_speaks', label: 'The Library Speaks', description: 'A book opened itself, and read to them.', baseWeight: 4, rarity: 'epic', statModifiers: { intellect: 2 }, nextStepId: POWER_WHEELS.arcane, color: '#8abaf0', icon: 'BookOpen' },
    { id: 'wrote_the_book', label: 'Wrote the Book', description: 'The one every scholar will read for a hundred years.', baseWeight: 1, rarity: 'legendary', statModifiers: { intellect: 4, arcana: 2 }, fame: 15, epithet: { text: 'the Sage', priority: 60 }, nextStepId: null, color: '#ffe08a', icon: 'Feather' },
    { id: 'breakthrough', statScaling: { intellect: 0.05 }, label: 'A Breakthrough', description: 'Everything clicked at once.', baseWeight: 4, rarity: 'rare', statModifiers: { intellect: 3, arcana: 2 }, epithet: { text: 'the Learned', priority: 28 }, nextStepId: null, color: '#8abaf0', icon: 'Lightbulb' },
    { id: 'lectured', label: 'Lectured the Lecturers', description: 'They came to learn, and ended up teaching.', baseWeight: 10, rarity: 'rare', requiresTrait: ['arcane_savant', 'archmage'], statModifiers: { intellect: 2, arcana: 2 }, nextStepId: null, color: '#6a6ad0', icon: 'GraduationCap' },
  ],
};

const SKILLS_LIST: [id: string, label: string, icon: string, color: string, weight: number, rarity: WheelOption['rarity']][] = [
  ['swordplay', 'Swordplay', 'Sword', '#9a4a3a', 12, 'common'],
  ['archery', 'Archery', 'Target', '#3f7a4a', 12, 'common'],
  ['tracking', 'Tracking', 'Footprints', '#6e5a42', 12, 'common'],
  ['riding', 'Riding', 'Route', '#8a6a3a', 12, 'common'],
  ['herbalism', 'Herbalism', 'Leaf', '#5f9a6a', 12, 'common'],
  ['lockpicking', 'Lockpicking', 'KeyRound', '#5a5f6e', 7, 'uncommon'],
  ['stealth', 'Stealth', 'EyeOff', '#4a4a5e', 7, 'uncommon'],
  ['smithing', 'Smithing', 'Anvil', '#8a6a3a', 7, 'uncommon'],
  ['diplomacy', 'Diplomacy', 'Handshake', '#4f6f8f', 7, 'uncommon'],
  ['alchemy', 'Alchemy', 'FlaskConical', '#7ac46a', 7, 'uncommon'],
  ['tactics', 'Tactics', 'Flag', '#8a5a3a', 7, 'uncommon'],
  ['disguise', 'Disguise', 'VenetianMask', '#5a4a6e', 7, 'uncommon'],
  ['survival', 'Survival', 'Tent', '#6e7a4a', 7, 'uncommon'],
];

const SKILLS: WheelStep = {
  id: 'skills',
  title: 'Which Skill?',
  subtitle: 'Something they can do now that they couldn’t before.',
  options: [
    ...SKILLS_LIST.map(
      ([id, label, icon, color, weight, rarity]): WheelOption => ({
        ...unknown(`skill_${id}`),
        id,
        label,
        description: ACTIVITY_TRAITS[`skill_${id}`]!.description,
        baseWeight: weight,
        rarity,
        grantTraits: [`skill_${id}`],
        nextStepId: null,
        color,
        icon,
      }),
    ),
    { id: 'odd_jobs', label: 'Odd Jobs', description: 'A bit of everything, mastery of nothing.', baseWeight: 12, rarity: 'common', statModifiers: { agility: 1, intellect: 1 }, nextStepId: null, color: '#7a7f8c', icon: 'Wrench' },
    { ...unknown('secret_technique'), id: 'secret_technique', label: 'A Secret Technique', description: 'One move nobody else knows. They worked it out alone, in a barn, at night.', baseWeight: 4, rarity: 'epic', grantTraits: ['secret_technique'], epithet: { text: 'the Prodigy', priority: 45 }, nextStepId: null, color: '#ffd76a', icon: 'Sparkles' },
  ],
};

// ─── Mentors ────────────────────────────────────────────────────────────────
//
// A teacher can only teach what they know: the skills they have, their magic if they have
// any, and a stat only as far as their own. Each mentor has a lesson wheel of their own;
// a living legend teaches from their actual sheet (their skills, their stats, their spells).

const STAT_NAMES: Record<StatKey, string> = { might: 'Might', agility: 'Agility', intellect: 'Intellect', arcana: 'Arcana', vitality: 'Vitality' };
/** How much one season of lessons raises a stat, never past the teacher's own level. */
const LESSON_GAIN = 2;

interface MentorProfile {
  id: string;
  /** The lesson wheel's subtitle. */
  subtitle: string;
  /** Skill ids (`skill_<id>`) they can teach. */
  skills: string[];
  /** Their own level in each stat they can train: the highest they can take a student. */
  stats: Partial<StatBlock>;
  /** A power wheel, if they teach magic. */
  magic?: string;
}

const MENTOR_PROFILES: Record<string, MentorProfile> = {
  swordmaster: { id: 'swordmaster', subtitle: 'Footwork, steel and horses. Nothing else interests them.', skills: ['swordplay', 'riding', 'tactics'], stats: { might: 18, agility: 16, vitality: 17 } },
  hermit_mage: { id: 'hermit_mage', subtitle: 'Spells, potions, and the herbs that go in them.', skills: ['alchemy', 'herbalism'], stats: { arcana: 22, intellect: 19 }, magic: POWER_WHEELS.arcane },
  spymaster: { id: 'spymaster', subtitle: 'Locks, shadows, faces and lies.', skills: ['lockpicking', 'stealth', 'disguise', 'diplomacy'], stats: { agility: 18, intellect: 17 } },
  forest_warden: { id: 'forest_warden', subtitle: 'Tracks, bows, and how not to starve in the woods.', skills: ['tracking', 'archery', 'herbalism', 'survival'], stats: { agility: 16, vitality: 16, arcana: 14 } },
  temple_elder: { id: 'temple_elder', subtitle: 'Patience, prayer, and the right word at the right time.', skills: ['diplomacy', 'herbalism'], stats: { vitality: 15, intellect: 16, arcana: 15 }, magic: POWER_WHEELS.blessed },
  ancient_dragon: { id: 'ancient_dragon', subtitle: 'A thousand years of magic and might. No small talk.', skills: [], stats: { might: 25, intellect: 25, arcana: 25 }, magic: POWER_WHEELS.arcane },
};

const lessonStepId = (mentorId: string) => `lesson_${mentorId}`;

/** Every mentor helps a little: a good teacher tilts the lesson (luck) their way. */
const mentorOption = (o: Omit<WheelOption, 'nextStepId' | 'luckDelta'>): WheelOption => ({ luckDelta: 0.25, nextStepId: lessonStepId(o.id), ...o });

const skillName = (id: string) => ACTIVITY_TRAITS[`skill_${id}`]!.name;

/** One mentor's lesson wheel: their skills, their stats up to their own level, their magic. */
function lessonWheel({ id, subtitle, skills, stats, magic }: MentorProfile): WheelStep {
  const trained = Object.entries(stats) as [StatKey, number][];
  return {
    id: lessonStepId(id),
    title: 'What Will They Teach?',
    subtitle,
    options: [
      ...skills.map((skill): WheelOption => ({
        ...unknown(`skill_${skill}`),
        id: skill,
        label: skillName(skill),
        description: ACTIVITY_TRAITS[`skill_${skill}`]!.description,
        baseWeight: 20,
        rarity: 'common',
        grantTraits: [`skill_${skill}`],
        nextStepId: null,
        color: '#5f9a6a',
        icon: 'GraduationCap',
      })),
      ...trained.map(([stat, level]): WheelOption => ({
        id: `train_${stat}`,
        label: `Train ${STAT_NAMES[stat]}`,
        description: `Up to their own ${level}, and not a point further.`,
        baseWeight: 16,
        rarity: 'common',
        statModifiers: { [stat]: LESSON_GAIN },
        statCap: { [stat]: level },
        condition: (_world, char) => char.stats[stat] < level,
        lockedReason: (_world, char) => `They can’t teach ${STAT_NAMES[stat]} past ${level} (you have ${char.stats[stat]})`,
        nextStepId: null,
        color: '#b8613a',
        icon: 'Dumbbell',
      })),
      ...(magic ? [{ id: 'magic', label: 'Their Magic', description: 'A spell of theirs, under a patient eye.', baseWeight: 16, rarity: 'common' as const, nextStepId: magic, color: '#7a5ad0', icon: 'WandSparkles' }] : []),
      { id: 'practice', label: 'Practice Under Their Eye', description: 'Nothing new, but everything a little sharper.', baseWeight: 10, rarity: 'common', luckDelta: 0.25, nextStepId: null, color: '#6a7a8a', icon: 'Target' },
      {
        id: 'everything',
        statScaling: { intellect: 0.04 },
        label: 'Everything They Know',
        description: 'A season of everything they are good at, as far as they are good at it.',
        baseWeight: 4,
        rarity: 'rare',
        statModifiers: Object.fromEntries(trained.map(([stat]) => [stat, 1])),
        statCap: stats,
        epithet: { text: 'Disciple of a Master', priority: 32 },
        nextStepId: null,
        color: '#c9a24c',
        icon: 'Crown',
      },
      {
        id: 'final_lesson',
        label: 'The Final Lesson',
        description: 'The one they never taught anyone. It took a whole season, and it changed everything.',
        baseWeight: 2,
        rarity: 'epic',
        statModifiers: Object.fromEntries(trained.map(([stat]) => [stat, 3])),
        statCap: Object.fromEntries(trained.map(([stat, level]) => [stat, level + 2])),
        grantTraits: ['secret_technique'],
        epithet: { text: 'Last Student of a Master', priority: 46 },
        nextStepId: null,
        color: '#ffd76a',
        icon: 'Sparkles',
      },
    ],
  };
}

const MENTOR: WheelStep = {
  id: 'mentor',
  title: 'Who Will Teach You?',
  subtitle: 'The right teacher at the right time. Each teaches only what they know.',
  options: [
    mentorOption({ id: 'swordmaster', label: 'A Grizzled Swordmaster', description: 'Forty years of scars. Teaches swordplay, riding, tactics, and the body to use them.', baseWeight: 26, rarity: 'common', color: '#9a4a3a', icon: 'Swords' }),
    mentorOption({ id: 'hermit_mage', label: 'A Hermit Archmage', description: 'Lives on a mountain. Teaches magic, alchemy and herbs, to a sharp mind.', baseWeight: 22, rarity: 'common', color: '#5a5ad0', icon: 'WandSparkles' }),
    mentorOption({ id: 'spymaster', label: 'A Guild Spymaster', description: 'Knows everyone’s secrets. Teaches locks, stealth, disguise and silver words.', baseWeight: 14, rarity: 'uncommon', color: '#4a4a5e', icon: 'EyeOff' }),
    mentorOption({ id: 'forest_warden', label: 'A Forest Warden', description: 'Speaks to the trees. Teaches tracking, archery, herbs and survival.', baseWeight: 12, rarity: 'uncommon', color: '#3f7a4a', icon: 'Trees' }),
    mentorOption({ id: 'temple_elder', label: 'A Temple Elder', description: 'Patient as stone. Teaches blessings, diplomacy and healing herbs.', baseWeight: 12, rarity: 'uncommon', condition: refusedByHolyPlaces, lockedReason: holyRefusal, color: '#d9c27a', icon: 'Church' }),
    {
      id: 'living_legend',
      label: 'A Living Legend',
      description: 'A retired hero, or someone the world remembers. They teach what they know.',
      baseWeight: 8,
      rarity: 'rare',
      condition: (world) => mentors(world).length > 0,
      lockedReason: 'No legend has retired, and no one has settled in the world yet',
      nextStepId: 'mentor_legend',
      color: '#c9a24c',
      icon: 'Medal',
    },
    mentorOption({ ...unknown('dragon_taught'), id: 'ancient_dragon', label: 'An Ancient Dragon', description: 'It has taught three heroes in a thousand years. You are the fourth.', baseWeight: 1, rarity: 'legendary', grantTraits: ['dragon_taught'], epithet: { text: 'Dragon-Taught', priority: 55 }, color: '#b8452a', icon: 'Flame' }),
  ],
};

const MENTOR_LESSONS: WheelStep[] = Object.values(MENTOR_PROFILES).map(lessonWheel);

/** A legend trains one stat toward their own level: up to LESSON_GAIN points, never past them. */
const trainStat = (stat: StatKey) => (cast: Character, hero: Character): CastSpoils => {
  const gain = Math.max(0, Math.min(LESSON_GAIN, cast.stats[stat] - hero.stats[stat]));
  return {
    stats: { [stat]: gain },
    summary: `Trained ${STAT_NAMES[stat]} to ${hero.stats[stat] + gain} under ${cast.name}, who stands at ${cast.stats[stat]}`,
  };
};

const MENTOR_LEGEND: WheelStep = {
  id: 'mentor_legend',
  title: 'A Living Legend',
  subtitle: 'They have done it all. They can teach what they know, and no more.',
  cast: { from: mentors },
  options: [
    { id: 'encouragement', label: 'Words of Encouragement', description: 'Not a lesson, exactly. It helps anyway.', baseWeight: 24, rarity: 'common', luckDelta: 0.5, nextStepId: null, color: '#c9a24c', icon: 'HandHeart' },
    // A skill they know and the hero doesn't.
    ...SKILLS_LIST.map(([id, label]): WheelOption => ({
      id: `skill_${id}`,
      label: `Teaches ${label}`,
      description: `They know it. Now so will you.`,
      baseWeight: 20,
      rarity: 'common',
      castCondition: (cast, hero) => hasTrait(cast, `skill_${id}`) && !hasTrait(hero, `skill_${id}`),
      grantTraits: [`skill_${id}`],
      nextStepId: null,
      color: '#5f9a6a',
      icon: 'GraduationCap',
    })),
    // A stat where they stand above the hero, trained toward their level.
    ...STAT_KEYS.map((stat): WheelOption => ({
      id: `train_${stat}`,
      label: `Trains Your ${STAT_NAMES[stat]}`,
      description: 'As far as their own, and no further.',
      baseWeight: 16,
      rarity: 'common',
      castCondition: (cast, hero) => cast.stats[stat] > hero.stats[stat],
      spoils: trainStat(stat),
      nextStepId: null,
      color: '#b8613a',
      icon: 'Dumbbell',
    })),
    {
      id: 'signature_technique',
      label: 'Teaches Their Signature Technique',
      description: 'The one that made their name: a spell, a skill, a way with a blade.',
      baseWeight: 14,
      rarity: 'uncommon',
      castCondition: (cast, hero) => learnTechnique(cast, hero).traits !== undefined,
      spoils: learnTechnique,
      nextStepId: null,
      color: '#8a6ae0',
      icon: 'Sparkles',
    },
    { id: 'gift_of_arms', label: 'Hands Down Their Arms', description: '"I won’t be needing them." Their blade and armour, if better than yours.', baseWeight: 12, rarity: 'uncommon', spoils: handDownArms, nextStepId: null, color: '#3f6a7a', icon: 'Sword' },
    { id: 'named_successor', label: 'Named Their Successor', description: 'Their arms, their art, and their name to carry on.', baseWeight: 4, rarity: 'epic', spoils: passTheTorch, fame: 10, epithet: { text: 'Heir of a Legend', priority: 58 }, nextStepId: null, color: '#ffd76a', icon: 'Flame' },
  ],
};

// ─── Beasts, disasters, treasure, hidden places ─────────────────────────────

const TAME_BEAST: WheelStep = {
  id: 'tame_beast',
  title: 'What Do You Tame?',
  subtitle: 'Patience, raw meat, and nerve.',
  options: [
    { ...unknown('companion_wolf'), id: 'wolf', label: 'A Wolf', description: 'A grey shadow that chose them.', baseWeight: 30, rarity: 'common', grantTraits: ['companion_wolf'], nextStepId: null, color: '#6e7a8a', icon: 'Dog' },
    { ...unknown('companion_hawk'), id: 'hawk', label: 'A Hawk', description: 'Sees everything, tells them most of it.', baseWeight: 24, rarity: 'common', grantTraits: ['companion_hawk'], nextStepId: null, color: '#8a6a3a', icon: 'Bird' },
    { ...unknown('companion_horse'), id: 'warhorse', label: 'A Warhorse', description: 'Fearless and very large.', baseWeight: 20, rarity: 'common', grantTraits: ['companion_horse'], nextStepId: null, color: '#5a3a2a', icon: 'Route' },
    { id: 'mauled', label: 'Mauled', description: 'The beast did not want to be tamed.', baseWeight: 16, rarity: 'common', statModifiers: { vitality: -1 }, meters: { wounds: 2 }, grantTags: ['scarred'], nextStepId: null, color: '#7a2e2e', icon: 'HeartCrack' },
    { ...unknown('companion_bear'), id: 'bear', label: 'A Bear', description: 'Loyal, as long as there is honey.', baseWeight: 12, rarity: 'uncommon', grantTraits: ['companion_bear'], nextStepId: null, color: '#6e4a2a', icon: 'PawPrint' },
    { ...unknown('companion_griffin'), id: 'griffin', statScaling: { agility: 0.03 }, label: 'A Griffin', description: 'Half eagle, half lion, all loyalty.', baseWeight: 5, rarity: 'rare', grantTraits: ['companion_griffin'], epithet: { text: 'the Griffin Rider', priority: 45 }, nextStepId: null, color: '#c9a24c', icon: 'Feather' },
    { ...unknown('companion_dragon'), id: 'young_dragon', statScaling: { intellect: 0.03 }, label: 'A Young Dragon', description: 'Small, furious, and theirs.', baseWeight: 1, rarity: 'legendary', grantTraits: ['companion_dragon'], epithet: { text: 'Dragon-Friend', priority: 70 }, nextStepId: null, color: '#b8452a', icon: 'Egg' },
    { id: 'pack_comes', label: 'The Pack Comes to Them', description: 'They howled once. The forest answered.', baseWeight: 10, rarity: 'rare', requiresTrait: ['pack_alpha', 'moonstruck'], grantTraits: ['companion_wolf', 'companion_bear'], nextStepId: null, color: '#5a6478', icon: 'MoonStar' },
    { id: 'dragon_answers', label: 'A Dragon Answers the Call', description: 'Dragon blood calls to dragon blood.', baseWeight: 4, rarity: 'epic', requiresTrait: ['draconic_blood', 'dragon_taught'], grantTraits: ['companion_dragon'], epithet: { text: 'Dragon-Friend', priority: 70 }, nextStepId: null, color: '#b8452a', icon: 'Egg' },
  ],
};

const DISASTER: WheelStep = {
  id: 'disaster',
  title: 'What Strikes?',
  subtitle: 'No warning. Just the sound.',
  options: [
    { id: 'flood', label: 'A Flood', description: 'The river forgot where it lived.', baseWeight: 30, rarity: 'common', nextStepId: 'disaster_outcome', color: '#3f7ab8', icon: 'WavesHorizontal' },
    { id: 'wildfire', label: 'A Wildfire', description: 'The forest is burning, and the wind is wrong.', baseWeight: 26, rarity: 'common', nextStepId: 'disaster_outcome', color: '#e0703a', icon: 'Flame' },
    { id: 'plague', label: 'A Plague', description: 'Coughing in every house.', baseWeight: 14, rarity: 'uncommon', statModifiers: { vitality: -1 }, nextStepId: 'disaster_outcome', color: '#65a30d', icon: 'Biohazard' },
    { id: 'earthquake', label: 'An Earthquake', description: 'The ground opens its mouth.', baseWeight: 12, rarity: 'uncommon', nextStepId: 'disaster_outcome', color: '#8a6a3a', icon: 'Mountain' },
    { id: 'dragon_attack', label: 'A Dragon Attack', description: 'Wings over the city, fire in the streets.', baseWeight: 5, rarity: 'rare', threatScaling: 0.2, nextStepId: 'disaster_outcome', color: '#b8452a', icon: 'Flame' },
    { id: 'falling_star', label: 'A Falling Star', description: 'The sky cracked, and a piece came down.', baseWeight: 2, rarity: 'epic', nextStepId: 'disaster_outcome', color: '#c06a3a', icon: 'Star' },
  ],
};

const DISASTER_OUTCOME: WheelStep = {
  id: 'disaster_outcome',
  title: 'How Do You Fare?',
  subtitle: 'In the middle of it, with everyone else running the other way.',
  options: [
    { id: 'hero_of_the_hour', label: 'Hero of the Hour', description: 'They held the line until help came. The smith whose forge they saved made them a blade.', baseWeight: 30, rarity: 'common', luckDelta: 0.25, weaponTierDelta: 1, fame: 4, nextStepId: null, color: '#c9a24c', icon: 'ShieldCheck' },
    { id: 'survived', label: 'Survived, Barely', description: 'Bruised, burned, alive.', baseWeight: 28, rarity: 'common', meters: { wounds: 1 }, nextStepId: null, color: '#6b5a4a', icon: 'HeartCrack' },
    { id: 'lost_everything', label: 'Lost Everything', description: 'The pack, the sword, the boots, the mail.', baseWeight: 14, rarity: 'uncommon', weaponTierDelta: -2, armorTierDelta: -1, nextStepId: null, color: '#5a4a3a', icon: 'Ban' },
    { ...unknown('savior'), id: 'saved_many', statScaling: { intellect: 0.03, vitality: 0.02 }, label: 'Saved Hundreds', description: 'There are children named after them now.', baseWeight: 12, rarity: 'uncommon', grantTraits: ['savior'], epithet: { text: 'the Savior', priority: 45 }, nextStepId: null, color: '#f5c46a', icon: 'HandHeart' },
    {
      id: 'perished',
      label: 'Perished',
      description: 'They went back in for one more. They didn’t come out.',
      baseWeight: 8,
      rarity: 'uncommon',
      threatScaling: 0.2,
      setStatus: 'fallen',
      condition: IRON_WILL_SAVES,
      lockedReason: deathCheatReason,
      nextStepId: null,
      color: '#7f1d1d',
      icon: 'Skull',
    },
    { id: 'risen_from_ruin', statScaling: { vitality: 0.03 }, label: 'Risen From the Ruin', description: 'The disaster made them harder than it was.', baseWeight: 4, rarity: 'rare', statModifiers: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, epithet: { text: 'Risen From Ruin', priority: 40 }, nextStepId: null, color: '#d9688a', icon: 'Sunrise' },
    {
      id: 'crowned_by_the_city',
      label: 'The City Crowns Its Saviour',
      description: 'When the dust settled, the city had no lord, and one obvious choice. Their adventuring ends; their rule begins.',
      baseWeight: 1,
      rarity: 'legendary',
      setRole: 'npc',
      grantTraits: ['ruler_savior'],
      grantTags: ['ruler'],
      epithet: { text: 'Lord Protector', priority: 86 },
      fate: 'Saved a city from disaster, and the city made them its lord',
      nextStepId: null,
      color: '#ffe08a',
      icon: 'Crown',
    },
    { id: 'healed_the_wounded', label: 'Healed the Wounded', description: 'Herbs, prayers and long nights. Nobody they reached died.', baseWeight: 8, rarity: 'rare', requiresTrait: ['healing_light', 'skill_herbalism', 'sanctuary'], grantTraits: ['savior'], statModifiers: { vitality: 1 }, epithet: { text: 'the Healer', priority: 45 }, nextStepId: null, color: '#6cc78a', icon: 'HeartPulse' },
  ],
};

const TREASURE: WheelStep = {
  id: 'treasure',
  title: 'What’s Inside?',
  subtitle: 'The chest creaks open.',
  options: [
    { id: 'gold', label: 'A Pile of Gold', description: 'Shiny, heavy, and immediately spent on better armour.', baseWeight: 30, rarity: 'common', luckDelta: 0.25, armorTierDelta: 1, nextStepId: null, color: '#d9a400', icon: 'Coins' },
    { id: 'gem_blade', label: 'A Gem-Studded Blade', description: 'Pretty and sharp.', baseWeight: 22, rarity: 'common', ...gearItem('weapon', 2, false), nextStepId: null, color: '#3fa8a0', icon: 'Sword' },
    { id: 'gilded_breastplate', label: 'A Gilded Breastplate', description: 'Too fancy to wear. They wear it anyway.', baseWeight: 12, rarity: 'uncommon', ...gearItem('armor', 2, false), nextStepId: null, color: '#c9a24c', icon: 'Shield' },
    { id: 'mimic', label: 'It Was a Mimic', description: 'The chest had teeth.', baseWeight: 16, rarity: 'common', statModifiers: { vitality: -1 }, meters: { wounds: 2 }, nextStepId: null, color: '#7a3a2e', icon: 'Package' },
    { id: 'magic_ring', label: 'A Magic Ring', description: 'It whispers a spell when they put it on.', baseWeight: 12, rarity: 'uncommon', nextStepId: POWER_WHEELS.arcane, color: '#7a5ad0', icon: 'CircleDot' },
    { ...unknown('ancient_relic'), id: 'ancient_relic', statScaling: { intellect: 0.03 }, label: 'An Ancient Relic', description: 'It hums when danger is near.', baseWeight: 10, rarity: 'uncommon', grantTraits: ['ancient_relic'], nextStepId: null, color: '#9a7a2a', icon: 'Crown' },
    { id: 'cursed_idol', label: 'A Cursed Idol', description: 'Power, and a very bad feeling.', baseWeight: 8, rarity: 'uncommon', statModifiers: { arcana: 2 }, luckDelta: -0.5, grantTags: ['cursed'], nextStepId: null, color: '#5a2a6e', icon: 'Skull' },
    { ...unknown('companion_dragon'), id: 'dragon_egg', statScaling: { intellect: 0.03 }, label: 'A Dragon Egg', description: 'It was warm. Then it hatched.', baseWeight: 1, rarity: 'legendary', grantTraits: ['companion_dragon'], epithet: { text: 'Dragon-Friend', priority: 70 }, nextStepId: null, color: '#b8452a', icon: 'Egg' },
    { id: 'hidden_compartment', label: 'The Hidden Compartment', description: 'Under the false bottom, the real treasure.', baseWeight: 8, rarity: 'rare', requiresTrait: ['skill_lockpicking'], ...gearItem('weapon', 3, false), luckDelta: 0.25, nextStepId: null, color: '#5a5f6e', icon: 'KeyRound' },
  ],
};

const HIDDEN_PLACE: WheelStep = {
  id: 'hidden_place',
  title: 'What Did You Find?',
  subtitle: 'Behind the waterfall, under the hill, between two trees that weren’t there.',
  options: [
    { id: 'lost_temple', label: 'A Lost Temple', description: 'Old stones, older guardians. It goes on the map.', baseWeight: 28, rarity: 'common', place: { discover: 'temple' }, nextStepId: 'ruins', color: '#4f8a5b', icon: 'Landmark' },
    { id: 'fey_glade', label: 'A Fey Glade', description: 'The music never stops. They left a little luckier.', baseWeight: 24, rarity: 'common', luckDelta: 0.5, grantTraits: ['fey_friend'], nextStepId: null, color: '#c0569a', icon: 'Sparkle' },
    { id: 'secret_library', statScaling: { intellect: 0.03 }, label: 'A Secret Library', description: 'Every book ever burned, still here.', baseWeight: 14, rarity: 'uncommon', nextStepId: POWER_WHEELS.arcane, color: '#4f5a9a', icon: 'Library' },
    { id: 'sunken_city', label: 'A Sunken City', description: 'Towers under the lake, and someone still on the throne. It goes on the map.', baseWeight: 12, rarity: 'uncommon', place: { discover: 'city' }, statModifiers: { intellect: 1 }, nextStepId: 'lost_city', color: '#3f7ab8', icon: 'WavesHorizontal' },
    { id: 'dragons_lair', label: 'A Dragon’s Lair', description: `The mountain is warm from the inside. Power ${FOES.dragon.power}.`, baseWeight: 8, rarity: 'uncommon', nextStepId: 'fight_dragon', color: '#b8452a', icon: 'Flame' },
    { id: 'heavenly_spring', statScaling: { arcana: 0.03 }, label: 'A Spring of Heaven', description: 'They drank. The light drank them back.', baseWeight: 2, rarity: 'epic', statModifiers: { vitality: 2 }, condition: refusedByHolyPlaces, lockedReason: (world, char) => (isUndead(char) ? holyRefusal(world, char) : 'The water burns their lips'), nextStepId: POWER_WHEELS.blessed, color: '#f0e6c8', icon: 'Sun' },
    { id: 'abyssal_rift', label: 'A Rift to the Abyss', description: 'They looked in. Something looked back, and gave them a gift.', baseWeight: 2, rarity: 'epic', grantTags: ['cursed'], nextStepId: POWER_WHEELS.corrupted, color: '#3a1a2a', icon: 'Orbit' },
    { id: 'fey_court', label: 'The Fey Court Welcomes Them', description: 'An old friend of the fey is never a stranger here.', baseWeight: 8, rarity: 'rare', requiresTrait: ['fey_friend', 'starlight'], luckDelta: 0.5, statModifiers: { arcana: 2 }, nextStepId: null, color: '#c0569a', icon: 'Sparkles' },
  ],
};

// ─── Change ─────────────────────────────────────────────────────────────────

const EVOLVE: WheelStep = {
  id: 'evolve',
  title: 'How Do You Change?',
  subtitle: 'Something inside them grows. What?',
  options: [
    { id: 'awakened', label: 'Awakened Potential', description: 'A little more of everything.', baseWeight: 30, rarity: 'common', statModifiers: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 }, nextStepId: null, color: '#5a9a6a', icon: 'Sprout' },
    { id: 'hardened', label: 'A Hardened Body', description: 'Scars over scars. Nothing hurts the same.', baseWeight: 24, rarity: 'common', statModifiers: { vitality: 3 }, nextStepId: null, color: '#5f6470', icon: 'Shield' },
    { id: 'sharper', label: 'A Sharper Mind', description: 'They see three moves ahead now.', baseWeight: 20, rarity: 'common', statModifiers: { intellect: 3 }, nextStepId: null, color: '#6a8ac0', icon: 'Brain' },
    { id: 'primal', label: 'Primal Surge', description: 'Something old and fast wakes up in them.', baseWeight: 14, rarity: 'uncommon', statModifiers: { might: 2, agility: 2 }, nextStepId: null, color: '#b8613a', icon: 'Zap' },
    { id: 'spark_ignites', label: 'The Spark Ignites', description: 'The skeleton becomes a Lich.', baseWeight: 6, rarity: 'rare', setRace: 'lich', grantTraits: ['phylactery_spark'], epithet: { text: 'the Lich', priority: 70 }, condition: isRace('skeleton'), lockedReason: 'Only a skeleton can become a Lich', nextStepId: null, color: '#4a2f7a', icon: 'Sparkles' },
    { id: 'draconic_awakening', label: 'Draconic Awakening', description: 'The kobold’s dragon-blood wakes. Scales, wings, fire.', baseWeight: 6, rarity: 'rare', setRace: 'dragonborn', grantTraits: ['draconic_blood'], epithet: { text: 'the Awakened Wyrm', priority: 50 }, condition: isRace('kobold'), lockedReason: 'Only kobolds carry the dragon’s spark', nextStepId: null, color: '#b8323a', icon: 'Egg' },
    { ...unknown('pack_alpha'), id: 'alpha', label: 'Rise to Alpha', description: 'The pack bows.', baseWeight: 6, rarity: 'rare', grantTraits: ['pack_alpha'], epithet: { text: 'Alpha of the Pack', priority: 55 }, condition: (world, char) => isRace('werewolf')(world, char) && !hasTrait(char, 'pack_alpha'), lockedReason: 'Only a werewolf can lead the pack', nextStepId: null, color: '#5a6478', icon: 'Crown' },
    { ...unknown('ancient_blood'), id: 'elder_blood', label: 'Elder Blood', description: 'Centuries settle into the vampire’s veins all at once.', baseWeight: 6, rarity: 'rare', grantTraits: ['ancient_blood'], epithet: { text: 'the Ancient', priority: 60 }, condition: (world, char) => isRace('vampire')(world, char) && !hasTrait(char, 'ancient_blood'), lockedReason: 'Only a vampire can grow old enough', nextStepId: null, color: '#8a1c2e', icon: 'Hourglass' },
    { ...unknown('apotheosis'), id: 'apotheosis', label: 'Apotheosis', description: 'They stop being mortal. They become a god.', baseWeight: 0.3, rarity: 'mythical', setRace: 'god', grantTraits: ['apotheosis'], queueSpins: { blessed_powers: 1 }, epithet: { text: 'the Ascended God', priority: 95 }, nextStepId: POWER_WHEELS.blessed, color: '#ffe08a', icon: 'Sun' },
  ],
};

const TRANSFORM: WheelStep = {
  id: 'transform',
  title: 'What Do You Become?',
  subtitle: 'Body and blood, rewritten.',
  options: [
    { id: 'wolf_bite', label: 'Bitten by a Werewolf', description: 'The next full moon will be interesting.', baseWeight: 28, rarity: 'common', setRace: 'werewolf', grantTraits: ['moonstruck'], epithet: { text: 'the Bitten', priority: 25 }, nextStepId: null, color: '#5a6478', icon: 'MoonStar' },
    { id: 'dragon_blood', label: 'Dragon’s Blood', description: 'They drank it. Scales came in by morning.', baseWeight: 22, rarity: 'common', setRace: 'dragonborn', grantTraits: ['draconic_blood'], epithet: { text: 'Dragon-Blooded', priority: 35 }, nextStepId: null, color: '#b8323a', icon: 'Egg' },
    { id: 'living_stone', label: 'Flesh Turned to Stone', description: 'A curse, a statue, and then the statue moved.', baseWeight: 20, rarity: 'common', setRace: 'construct', grantTraits: ['golem_core'], epithet: { text: 'the Living Statue', priority: 40 }, nextStepId: null, color: '#8a7ab8', icon: 'Gem' },
    { id: 'vampire_turned', label: 'A Vampire’s Offer', description: 'Eternal life. Terrible diet. Theirs, if they say yes.', baseWeight: 14, rarity: 'uncommon', nextStepId: 'the_bite', color: '#8a1c2e', icon: 'Droplets' },
    { id: 'dragon_ascendant', label: 'Dragon Ascendant', description: 'Not scales: wings, fire and a dragon’s whole heart. More dragon than dragonborn.', baseWeight: 2, rarity: 'legendary', setRace: 'dragonborn', grantTraits: ['draconic_blood', 'dragon_wings'], epithet: { text: 'the Dragon Reborn', priority: 72 }, nextStepId: null, color: '#ffb84d', icon: 'Flame' },
    { id: 'death_refused', label: 'Death Refused Them', description: 'They died. They got up. The flesh did not.', baseWeight: 12, rarity: 'uncommon', setRace: 'skeleton', grantTraits: ['undying'], epithet: { text: 'the Undying', priority: 40 }, nextStepId: null, color: '#c8c2b0', icon: 'Bone' },
    {
      id: 'touched_by_heaven',
      label: 'Touched by Heaven',
      description: 'The light reached down and lifted them. A Blessed power comes with it.',
      baseWeight: 5,
      rarity: 'rare',
      grantTags: ['ascended', 'angel'],
      grantTraits: ['ascended_soul'],
      epithet: { text: 'the Ascended', priority: 55 },
      condition: (world, char) => refusedByHolyPlaces(world, char),
      lockedReason: 'Heaven will not take them',
      nextStepId: POWER_WHEELS.blessed,
      color: '#f0e6c8',
      icon: 'Sunrise',
    },
    {
      id: 'claimed_by_abyss',
      label: 'The Abyss Opens',
      description: 'It offers everything, and wants everything. Embrace it, resist it, or bargain.',
      baseWeight: 5,
      rarity: 'rare',
      condition: (_world, char) => !isUncorruptable(char) && char.personality !== 'honorable',
      lockedReason: (_world, char) =>
        isUncorruptable(char) ? 'Uncorruptable: no darkness can take root in them' : 'Honour holds, even against the Abyss',
      nextStepId: 'abyss_offer',
      color: '#7f1d2e',
      icon: 'Flame',
    },
  ],
};

/** A twist of fate: the hero becomes one of the world's NPCs. They stay in the world, never adventuring again. */
const npcLife = (id: string, label: string, title: string, description: string, weight: number, rarity: WheelOption['rarity'], color: string, icon: string): WheelOption => ({
  id,
  label,
  description,
  baseWeight: weight,
  rarity,
  setRole: 'npc',
  grantTraits: [`npc_${id}`],
  epithet: { text: title, priority: 61 },
  nextStepId: null,
  color,
  icon,
});

const TWIST_FATE: WheelStep = {
  id: 'twist_fate',
  title: 'A Different Life',
  subtitle: 'The hero’s story ends here. A new one begins: who do they become?',
  options: [
    npcLife('shopkeeper', 'Shopkeeper', 'the Shopkeeper', 'A little shop at the crossroads. Heroes buy their rope here.', 24, 'common', '#8a7a52', 'Store'),
    npcLife('blacksmith', 'Blacksmith', 'the Blacksmith', 'Forges the blades other heroes carry.', 22, 'common', '#7a4a3a', 'Anvil'),
    npcLife('innkeeper', 'Innkeeper', 'the Innkeeper', 'Pours the drinks and hears every rumour first.', 20, 'common', '#b8862e', 'Beer'),
    npcLife('farmer', 'Farmer', 'the Farmer', 'Traded the sword for a plough, and sleeps well.', 16, 'common', '#8ac46a', 'Wheat'),
    npcLife('elder', 'Village Elder', 'Elder of the Village', 'Settles disputes, tells stories, remembers everything.', 10, 'uncommon', '#a08a5a', 'Landmark'),
    npcLife('bard', 'Bard of the Realm', 'Bard of the Realm', 'Sings other heroes’ songs now, and improves them.', 8, 'uncommon', '#c0569a', 'Music'),
    npcLife('court_wizard', 'Court Wizard', 'the Court Wizard', 'Advises a monarch. Occasionally turns one into a frog.', 8, 'uncommon', '#5a5ad0', 'WandSparkles'),
    npcLife('high_priest', 'High Priest', 'the High Priest', 'Speaks for the gods, loudly and often.', 7, 'uncommon', '#d9c27a', 'Church'),
    npcLife('guildmaster', 'Guildmaster', 'the Guildmaster', 'Every merchant in the city answers to them.', 5, 'rare', '#b8962e', 'Coins'),
    {
      ...npcLife('monarch', 'Monarch', 'Monarch of the Realm', 'The crown, the throne, and every hero bowing.', 1, 'legendary', '#ffb84d', 'Crown'),
      claimSingleton: 'monarch',
      lockedReason: 'The realm already has a monarch',
      epithet: { text: 'Monarch of the Realm', priority: 99 },
    },
  ],
};

// ─── New fights ─────────────────────────────────────────────────────────────

const ACTIVITY_FIGHTS: WheelStep[] = [
  fightWheel({
    id: 'fight_beast',
    traitWins: [
      { id: 'tracked_den', label: 'Tracked It to Its Den', description: 'They found it asleep. It did not wake up.', requiresTrait: ['skill_tracking'], grantTraits: ['beast_slayer'], icon: 'Footprints' },
      { id: 'pack_hunt', label: 'The Pack Hunts Together', description: 'Wolves on every side, and they at the head.', requiresTrait: ['companion_wolf', 'pack_alpha'], grantTraits: ['beast_slayer'], icon: 'Dog' },
    ],
    title: 'The Man-Eater',
    subtitle: 'Tracks, bones, and a growl in the dark.',
    foe: FOES.beast,
    deadliness: 0.3,
    victory: { label: 'Beast Brought Down', description: 'The villages can sleep again.', statModifiers: { might: 1, agility: 1 } },
    glory: { statScaling: { agility: 0.03 }, label: 'Beast-Slayer', description: 'They wear its pelt now.', rarity: 'rare', grantTraits: ['beast_slayer'] },
    retreat: { label: 'Clawed and Running', description: 'It let them go. This time.', statModifiers: { vitality: -2 } },
    legend: { label: 'Its Cub Followed Them Home', description: 'There was a cub in the den. It is not small any more.', rarity: 'epic', grantTraits: ['companion_maneater', 'beast_slayer'], epithet: { text: 'the Beast-Raiser', priority: 45 } },
    slain: { label: 'Eaten', description: 'The man-eater ate well.' },
  }),
  fightWheel({
    id: 'fight_rogue_mage',
    traitWins: [
      { id: 'spell_turned', label: 'Turned the Spell Back', description: 'The fireball went home to its maker.', requiresTrait: ['arcane_shield', 'divine_shield'], grantTraits: ['spell_thief'], icon: 'Shield' },
      { id: 'read_mind', label: 'Knew Every Spell Before It Came', description: 'Hard to win a duel when your thoughts are being read.', requiresTrait: ['mind_read'], statModifiers: { arcana: 2 }, icon: 'Brain' },
    ],
    title: 'The Rogue Mage',
    subtitle: 'Fire in one hand, lightning in the other.',
    foe: FOES.rogueMage,
    deadliness: 0.35,
    victory: { label: 'Mage Defeated', description: 'Their staff snapped. So did their nerve.', statModifiers: { arcana: 2 } },
    glory: { statScaling: { arcana: 0.03 }, label: 'Stole the Spellbook', description: 'And read it. Every page.', rarity: 'epic', grantTraits: ['spell_thief'], statModifiers: { arcana: 2, intellect: 1 } },
    retreat: { label: 'Singed and Fleeing', description: 'Their eyebrows will grow back.', statModifiers: { vitality: -2 } },
    legend: { label: 'Took Their Tower', description: 'And every book in it, and the view.', rarity: 'legendary', grantTraits: ['mage_tower', 'spell_thief'], statModifiers: { arcana: 3 }, epithet: { text: 'Master of the Burnt Tower', priority: 62 } },
    slain: { label: 'Turned to Ash', description: 'A small pile, and a smell of ozone.' },
  }),
  fightWheel({
    id: 'fight_duel',
    traitWins: [
      { id: 'riposte', label: 'A Flawless Riposte', description: 'Parry, step, touch. Over in a heartbeat.', requiresTrait: ['skill_swordplay', 'blademaster'], grantTraits: ['duelist'], epithet: { text: 'the Duelist', priority: 35 }, icon: 'Swords' },
    ],
    title: 'A Duel at Dawn',
    subtitle: 'Seconds, swords, and a field of wet grass.',
    foe: FOES.duelist,
    deadliness: 0.2,
    victory: { label: 'First Blood', description: 'A scratch, a bow, a story.', statModifiers: { might: 1, agility: 1 } },
    glory: { statScaling: { agility: 0.03 }, label: 'Undefeated', description: 'Not a scratch on them.', rarity: 'rare', grantTraits: ['duelist'], epithet: { text: 'the Duelist', priority: 35 } },
    retreat: { label: 'Yielded', description: 'They lived. Their pride did not.', luckDelta: -0.25 },
    legend: { label: 'The Duelist’s Last Lesson', description: 'Beaten, the duelist bowed and showed them the one move that had never failed.', rarity: 'epic', grantTraits: ['duelist', 'secret_technique'], epithet: { text: 'the Unscratched', priority: 50 } },
    slain: { label: 'Run Through', description: 'Honour satisfied. Hero not.' },
  }),
  fightWheel({
    id: 'fight_champion_duel',
    traitWins: [
      { id: 'blade_against_blade', label: 'Blade Against Blade', description: 'Steel met steel for an hour. Theirs held.', requiresTrait: ['skill_swordplay', 'blademaster', 'duelist'], grantTraits: ['champion_slayer'], epithet: { text: 'Breaker of Champions', priority: 58 }, icon: 'Swords' },
    ],
    title: 'The Undefeated Champion',
    subtitle: 'Nobody has ever beaten them. Nobody.',
    foe: FOES.undefeated,
    deadliness: 0.3,
    victory: { label: 'Held Their Own', description: 'A draw, the crowd said. A win, they said.', statModifiers: { might: 2, vitality: 1 } },
    glory: { statScaling: { might: 0.03 }, label: 'Broke the Streak', description: 'The champion’s first loss. Their first legend.', rarity: 'epic', grantTraits: ['champion_slayer'], epithet: { text: 'Breaker of Champions', priority: 58 } },
    retreat: { label: 'Humbled', description: 'They knew it would happen. It still hurt.', statModifiers: { vitality: -2 } },
    legend: { label: 'Took Their Place', description: 'The undefeated champion is them now, and the streak starts again.', rarity: 'legendary', grantTraits: ['realm_champion', 'champion_slayer'], fame: 20, epithet: { text: 'the Undefeated', priority: 70 } },
    slain: { label: 'Another Name on the List', description: 'The champion’s streak goes on.' },
  }),
  fightWheel({
    id: 'fight_tournament',
    traitWins: [
      { id: 'unhorsed_all', label: 'Unhorsed Them All', description: 'Every lance, every rider, face down in the sand.', requiresTrait: ['skill_riding', 'companion_horse'], grantTraits: ['realm_champion'], epithet: { text: 'Champion of the Realm', priority: 60 }, icon: 'Trophy' },
    ],
    title: 'The Grand Tournament',
    subtitle: 'Banners, lances, and the realm watching.',
    foe: FOES.tournament,
    deadliness: 0.15,
    victory: { label: 'A Fine Showing', description: 'Top of the bracket, and a purse to prove it.', weaponTierDelta: 1, luckDelta: 0.25 },
    glory: { statScaling: { agility: 0.03 }, label: 'Champion of the Realm', description: 'The crown of the tourney, and every eye on them.', rarity: 'rare', grantTraits: ['realm_champion'], epithet: { text: 'Champion of the Realm', priority: 60 } },
    retreat: { label: 'Unhorsed', description: 'Face first into the sand, in front of everyone.', statModifiers: { vitality: -1 } },
    legend: { label: 'The Queen’s Favour', description: 'A ribbon from the royal box, and the crown’s attention for life.', rarity: 'epic', grantTraits: ['royal_favor', 'realm_champion'], luckDelta: 0.5, epithet: { text: 'Favoured of the Crown', priority: 55 } },
    slain: { label: 'A Lance Through the Heart', description: 'The tournament was called off. Too late.' },
  }),
  fightWheel({
    id: 'fight_war',
    traitWins: [
      { id: 'cavalry_charge', label: 'Led the Cavalry Charge', description: 'The charge that broke the enemy, and they at its point.', requiresTrait: ['skill_riding', 'companion_horse'], grantTraits: ['war_hero'], epithet: { text: 'Hero of the War', priority: 66 }, icon: 'Flag' },
      { id: 'broke_the_line', label: 'Broke the Line With Magic', description: 'Fire from the sky, and a hole in the enemy where an army was.', requiresTrait: ['meteor_swarm', 'time_stop', 'chain_lightning', 'summon_elemental'], grantTraits: ['war_hero'], epithet: { text: 'Hero of the War', priority: 66 }, icon: 'Star' },
    ],
    title: 'The War',
    subtitle: 'Two armies, one field, and no way around.',
    foe: FOES.war,
    deadliness: 0.4,
    victory: { label: 'Survived the War', description: 'They came home. Many didn’t.', statModifiers: { might: 2, vitality: 2 } },
    glory: { statScaling: { intellect: 0.05 }, label: 'Hero of the War', description: 'They turned the battle. The songs say so, and for once the songs are right.', rarity: 'epic', grantTraits: ['war_hero'], epithet: { text: 'Hero of the War', priority: 66 } },
    retreat: { label: 'Wounded and Sent Home', description: 'An arrow, a cart, and a long road back.', statModifiers: { vitality: -2 }, meters: { wounds: 2 }, grantTags: ['scarred'] },
    legend: { label: 'Ended the War in a Day', description: 'One charge, one banner, one very short war. The world is a little safer.', rarity: 'legendary', grantTraits: ['war_hero', 'warlord_banner'], story: { worldThreat: -1 }, epithet: { text: 'the War-Ender', priority: 76 } },
    slain: { label: 'Fell on the Field', description: 'One more name on the monument.' },
    turncoat: {
      share: 0.15,
      label: 'Deserted',
      description: 'They ran, and kept running, and joined the bandits in the hills.',
      setRole: 'outlaw',
      condition: couldTurnOutlaw,
      lockedReason: outlawLockReason,
    },
  }),
  fightWheel({
    id: 'fight_death',
    title: 'A Game With Death',
    subtitle: 'The pale rider plays fair. It has never needed to cheat.',
    foe: { name: 'Death', power: 600 },
    foeOf: (c) => ({ name: 'Death', power: Math.max(200, Math.round(calculatePowerRating(c) * 1.2)) }),
    deadliness: 0.6,
    victory: { label: 'Beat Death at Its Own Game', description: 'It paid up. Death owes them one, now: the next time it comes, it will go away again.', grantTraits: ['cheated_death'], epithet: { text: 'Who Beat Death', priority: 80 } },
    glory: { label: 'Death Gave Them Its Scythe', description: 'A good loser. A very sharp scythe.', rarity: 'legendary', grantTraits: ['cheated_death'], gear: { weapon: 7 }, epithet: { text: 'Death’s Equal', priority: 86 } },
    retreat: { label: 'Death Let Them Go', description: 'This time. It wrote their name down.', luckDelta: -0.5 },
    slain: { label: 'Lost the Game', description: 'Death collected.', fate: 'Challenged Death to a game, and lost' },
  }),
];

/**
 * The way home, for an adventure that would otherwise be over in a spin or two
 * (`AdventureConfig.roadHome`). Every slice is something: a story, a fight, a thread for later.
 */
const ROAD_HOME: WheelStep = {
  id: 'road_home',
  title: 'On the Road Home',
  subtitle: 'The errand is done. The road back is never quite empty.',
  options: [
    { id: 'tavern_tale', label: 'A Tale at the Tavern', description: 'They told it well. By morning, half the room was telling it too.', baseWeight: 24, rarity: 'common', fame: 3, nextStepId: null, color: '#c9a24c', icon: 'Beer' },
    { id: 'waylaid', label: 'Waylaid', description: 'Steel in the dark, a mile from home.', baseWeight: 20, rarity: 'common', nextStepId: 'fight_bandits', color: '#a35d3a', icon: 'Swords' },
    { id: 'followed_home', label: 'Followed', description: 'Footprints behind theirs, every night. Whatever it is, it is patient.', baseWeight: 12, rarity: 'common', grantTags: ['hook:followed'], fame: 1, nextStepId: null, color: '#6e6a62', icon: 'Footprints' },
    { id: 'stranger_in_need', label: 'A Stranger in Need', description: 'A cart in a ditch, a family beside it. Someone like that remembers a kindness.', baseWeight: 12, rarity: 'common', nextStepId: 'make_ally', color: '#3f7a9a', icon: 'Handshake' },
    { id: 'strange_tracks', label: 'Strange Tracks', description: 'Too big for any beast they know. They made a note of where.', baseWeight: 10, rarity: 'uncommon', grantTags: ['hook:strange_tracks'], fame: 1, nextStepId: null, color: '#5b3f6e', icon: 'PawPrint' },
    { id: 'an_old_map', label: 'An Old Map in a Dead Man’s Pack', description: 'An X, a hill, and a blade drawn beside it.', baseWeight: 8, rarity: 'uncommon', grantTags: ['hook:map'], fame: 1, nextStepId: null, color: '#a16207', icon: 'Map' },
    { id: 'shortcut_ruins', label: 'A Shortcut Through Old Ruins', description: 'It was not on the map. It is now.', baseWeight: 6, rarity: 'rare', place: { discover: 'ruin' }, nextStepId: 'ruins', color: '#4f8a5b', icon: 'Landmark' },
    { id: 'omen', label: 'An Omen in the Sky', description: 'A comet, and that night a dream that will not let them go.', baseWeight: 3, rarity: 'epic', grantTags: ['hook:prophecy'], fame: 4, nextStepId: null, color: '#ffe08a', icon: 'Sparkles' },
  ],
};

export const ACTIVITY_STEPS: WheelStep[] = [
  CROSSROADS,
  ROAD_HOME,
  EXPLORE,
  FIND_WEAPON,
  MAKE_ALLY,
  MAKE_ENEMY,
  HUNT,
  CHALLENGE,
  ...CONTESTS,
  CRAFT,
  RESEARCH,
  STUDY,
  SKILLS,
  MENTOR,
  MENTOR_LEGEND,
  ...MENTOR_LESSONS,
  TAME_BEAST,
  DISASTER,
  DISASTER_OUTCOME,
  TREASURE,
  HIDDEN_PLACE,
  EVOLVE,
  TRANSFORM,
  TWIST_FATE,
  ...ACTIVITY_FIGHTS,
];
