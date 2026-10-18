/**
 * Talents that keep giving after creation.
 *
 *   Blademaster ──▶ crossroads: The Way of the Blade ──▶ kata, a sword school, the Thousand Cuts,
 *                   a better blade, a broken one, a student, and (rarely) the Sword Saint
 *   Shadowstep  ──▶ before every fight (AdventureConfig.evade): step past it, or stand and fight?
 *                   Stepping past is a 50/50 spin: slip by unseen, or be seen and fight anyway.
 *
 * Every fight wheel also deals Blademasters a win of their own (KIT_WINS in common.ts).
 */
import type { Trait, WheelOption, WheelStep } from '../engine/types';
import { fightWheel, hasTrait } from './common';

// ─── Traits ─────────────────────────────────────────────────────────────────

export const TALENT_TRAITS: Record<string, Trait> = {
  thousand_cuts: { id: 'thousand_cuts', name: 'The Thousand Cuts', description: 'One cut becomes a hundred before the eye can follow.', power: 35, scalesWith: ['agility'] },
  blade_school: { id: 'blade_school', name: 'Founder of a Sword School', description: 'Students in the courtyard, and their name over the gate.', power: 20 },
  sword_saint: { id: 'sword_saint', name: 'Sword Saint', description: 'Beat the one who could not be beaten. Steel kneels to them.', power: 70, scalesWith: ['might', 'agility'] },
};

const unknown = (traitId: string): Pick<WheelOption, 'condition' | 'lockedReason'> => ({
  condition: (_world, char) => !hasTrait(char, traitId),
  lockedReason: 'Already theirs',
});

// ─── Blademaster: The Way of the Blade ──────────────────────────────────────

/** On the crossroads, for Blademasters only. */
export const WAY_OF_THE_BLADE_OPTION: WheelOption = {
  id: 'way_of_the_blade',
  label: 'The Way of the Blade',
  description: 'A Blademaster’s season: steel, schools, and the masters who run them.',
  baseWeight: 14,
  rarity: 'common',
  requiresTrait: ['blademaster'],
  nextStepId: 'way_of_the_blade',
  color: '#e11d48',
  icon: 'Swords',
};

const WAY_OF_THE_BLADE: WheelStep = {
  id: 'way_of_the_blade',
  title: 'The Way of the Blade',
  subtitle: 'Steel answers to them. This season, they find out how far.',
  options: [
    { id: 'thousand_dawns', label: 'A Thousand Dawns of Kata', description: 'The same cuts, every morning, until the blade moves before the thought.', baseWeight: 30, rarity: 'common', statModifiers: { might: 1, agility: 1 }, nextStepId: null, color: '#b8613a', icon: 'Sunrise' },
    { id: 'challenge_a_school', label: 'Challenge a Sword School', description: 'Walk in the front gate, and beat their master in their own courtyard.', baseWeight: 24, rarity: 'common', nextStepId: 'fight_sword_school', color: '#a35d3a', icon: 'Swords' },
    { ...unknown('thousand_cuts'), id: 'the_thousand_cuts', label: 'The Thousand Cuts', description: 'A technique from an old scroll. Nobody has managed it in a century. Until now.', baseWeight: 14, rarity: 'uncommon', grantTraits: ['thousand_cuts'], statModifiers: { agility: 2 }, epithet: { text: 'of the Thousand Cuts', priority: 38 }, nextStepId: null, color: '#e8556a', icon: 'Sparkles' },
    { id: 'made_for_their_hand', label: 'A Blade Made for Their Hand', description: 'A smith watched them fight for a week, then went back to the forge.', baseWeight: 12, rarity: 'uncommon', weaponTierDelta: 1, upgrade: true, nextStepId: null, color: '#a16207', icon: 'Hammer' },
    { id: 'the_blade_broke', label: 'The Blade Broke', description: 'Mid-swing, on a helm that was harder than it looked. They learned more from that than from any win.', baseWeight: 10, rarity: 'uncommon', weaponTierDelta: -1, statModifiers: { intellect: 1, might: 1 }, meters: { wounds: 1 }, nextStepId: null, color: '#6b5a4a', icon: 'HeartCrack' },
    { ...unknown('blade_school'), id: 'took_a_student', label: 'Took a Student', description: 'Then ten. Then a courtyard, and their name over the gate.', baseWeight: 6, rarity: 'rare', grantTraits: ['blade_school'], luckDelta: 0.25, nextStepId: null, color: '#c9a24c', icon: 'GraduationCap' },
    { ...unknown('sword_saint'), id: 'the_sword_saint_waits', label: 'The Sword Saint Waits', description: 'On a mountain, a blind old master who has never lost. They climb.', baseWeight: 3, rarity: 'epic', nextStepId: 'fight_sword_saint', color: '#ffd76a', icon: 'Mountain' },
  ],
};

const FIGHT_SWORD_SCHOOL = fightWheel({
  id: 'fight_sword_school',
  title: 'The School’s Courtyard',
  subtitle: 'Forty students watch. Their master draws.',
  foe: { name: 'The Sword-School Master', power: 320 },
  deadliness: 0.2,
  victory: { label: 'Their Sign Comes Down', description: 'The school’s sign hangs in their room now. The students follow them in the street.', statModifiers: { might: 1, agility: 1 } },
  glory: { statScaling: { agility: 0.03 }, label: 'Not a Scratch', description: 'The master bowed before the dust settled.', rarity: 'rare', grantTraits: ['duelist'], epithet: { text: 'the School-Breaker', priority: 40 } },
  retreat: { label: 'Beaten in the Courtyard', description: 'Forty students saw it. They will hear about this one for years.', statModifiers: { agility: -1 } },
  legend: { label: 'The School Takes Their Name', description: 'The master handed over the school, and the students, and the gate.', rarity: 'epic', grantTraits: ['blade_school'], epithet: { text: 'Master of the Courtyard', priority: 46 } },
  slain: { label: 'Cut Down in the Courtyard', description: 'The students buried them with honours. It was a good fight.' },
});

const FIGHT_SWORD_SAINT = fightWheel({
  id: 'fight_sword_saint',
  title: 'The Sword Saint',
  subtitle: 'A blind old master, a mountain top, and one clean draw each.',
  foe: { name: 'The Sword Saint', power: 700 },
  deadliness: 0.3,
  victory: { label: 'The Saint Kneels', description: 'The old master smiled, laid down the sword, and named them heir to it.', grantTraits: ['sword_saint'], statModifiers: { might: 2, agility: 2 }, epithet: { text: 'the Sword Saint', priority: 70 } },
  glory: { statScaling: { agility: 0.03 }, label: 'One Cut', description: 'They drew once. The mountain went quiet. Steel kneels to them now.', rarity: 'epic', grantTraits: ['sword_saint'], weaponTierDelta: 1, statModifiers: { might: 3, agility: 3 }, epithet: { text: 'the Sword Saint', priority: 70 } },
  retreat: { label: 'Sent Down the Mountain', description: 'The flat of the blade, three times. Come back when you are ready.', statModifiers: { vitality: -1 }, luckDelta: 0.25 },
  slain: { label: 'The Saint Did Not Hold Back', description: 'It was over before they saw it begin.' },
});

// ─── Shadowstep: slip past a fight ──────────────────────────────────────────

/** The wheel before every fight, for those with Shadowstep (`AdventureConfig.evade`). */
export const SHADOWSTEP_STEP_ID = 'shadowstep';

const SHADOWSTEP: WheelStep = {
  id: SHADOWSTEP_STEP_ID,
  title: 'Into the Shadows?',
  subtitle: '{foe} ({power} power) stands in the way. Shadowstep could carry them past: even odds.',
  choice: true,
  options: [
    { id: 'step_into_shadow', label: 'Shadowstep Past', description: 'A 50% chance to slip by {foe} unseen: no fight, no wounds, no glory. Seen, and the fight happens anyway.', baseWeight: 50, rarity: 'common', fame: 0, nextStepId: 'shadowstep_roll', color: '#86198f', icon: 'Wind' },
    { id: 'stand_and_fight', label: 'Stand and Fight', description: 'No tricks. Face {foe} head on, for the glory of it.', baseWeight: 50, rarity: 'common', fame: 0, evade: 'fight', nextStepId: null, color: '#8a2e2e', icon: 'Swords' },
    {
      id: 'strike_from_nowhere',
      label: 'Strike From Nowhere',
      description: 'For the truly quick: step out of the shadow behind {foe} and land the first blow. The fight happens, and they get a little faster for it.',
      baseWeight: 10,
      rarity: 'epic',
      fame: 0,
      condition: (_world, char) => char.stats.agility >= 18,
      lockedReason: (_world, char) => `Requires 18 Agility (you have ${char.stats.agility})`,
      statModifiers: { agility: 1 },
      evade: 'fight',
      nextStepId: null,
      color: '#c026d3',
      icon: 'Sparkles',
    },
  ],
};

const SHADOWSTEP_ROLL: WheelStep = {
  id: 'shadowstep_roll',
  title: 'The Shadowstep',
  subtitle: 'One step into the dark. Does {foe} see where they come out?',
  exactOdds: true,
  options: [
    { id: 'slipped_by', label: 'Slipped By Unseen', description: 'One step into the dark, the next one past {foe}. The fight never happened.', baseWeight: 47, rarity: 'common', fame: 0, evade: 'escape', nextStepId: null, color: '#86198f', icon: 'EyeOff' },
    // Still an escape, so slipping past stays exactly even odds.
    { id: 'robbed_in_passing', label: 'Robbed Them in Passing', description: 'Past {foe}, and their purse and best blade came along. They will be looking for a ghost.', baseWeight: 3, rarity: 'epic', evade: 'escape', weaponTierDelta: 1, luckDelta: 0.5, epithet: { text: 'the Unseen', priority: 36 }, nextStepId: null, color: '#c026d3', icon: 'Sparkles' },
    { id: 'seen', label: 'Seen!', description: '{foe} turned at the last moment. The fight is on.', baseWeight: 50, rarity: 'common', fame: 0, evade: 'fight', nextStepId: null, color: '#8a2e2e', icon: 'Eye' },
  ],
};

export const TALENT_STEPS: WheelStep[] = [WAY_OF_THE_BLADE, FIGHT_SWORD_SCHOOL, FIGHT_SWORD_SAINT, SHADOWSTEP, SHADOWSTEP_ROLL];
