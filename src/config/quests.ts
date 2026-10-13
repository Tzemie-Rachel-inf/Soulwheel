/**
 * Quests: a story that grows out of the hero. Taken from the crossroads ("Take a Quest"), a
 * quest is one adventure of 5–7 encounters and a finale.
 *
 *   Take a Quest ─▶ The Quest (an objective) ─▶ The Road Ahead (spun) ─┬─ an encounter: how they meet it is SPUN (their personality ─┐
 *                                                                     │  leans the wheel), and a wheel resolves it                  │
 *                                                                     ├─ the rival strikes back, then makes a gambit (once made)    │
 *                                                                     ├─ a price comes due (a witch's bargain, hired swords)        │
 *                                                                     └─ an event: common, rare (it needs the right story), legendary
 *                 ◀────────────────────────── until the quest has run its length ◀──────────────────────────────────────────────────┘
 *                 ─▶ How Does It End? (weighted by the story so far) ─▶ the finale: the player CHOOSES ─▶ a wheel resolves it
 *
 * Decisions are kept for what is worth deciding: the finale, a relic of real power, a witch's
 * bargain and its price. Routine approaches (fight, talk, sneak, pay) are spun, leaned by who the
 * hero is: the brave fight, the kind show mercy, the greedy pay or rob. Every wheel has a hype slice.
 *
 * What a quest remembers (`Character.story`, engine/story.ts):
 *   threat   0–10. Noise, theft, betrayal and delay raise it; it makes ambushes likelier and
 *            harder, unlocks dark events, and pushes the finale toward a siege or an escape.
 *   flags    allies, relic, mercy, parley, betrayal, bargain, hired, wounded, intel, villages,
 *            company, catastrophe, kingdom_turned, and the objective (obj_siege, obj_relic...).
 *   rival    made only by certain choices (humiliating a champion, stealing the relic, robbing a
 *            wounded ally, sabotaging the Iron Company, cheating the witch), one per quest. They
 *            remember what the hero does, strike once, make one gambit, and are concluded at the
 *            finale (or earlier, by a truce or a crushing defeat).
 *   log      the decisions and events that mattered: the tale the hero comes home with.
 *
 * Every consequence is consistent: what is stolen is hunted, coin buys no loyalty, a bargain's
 * price comes due, mercy is remembered, and legendary events move the world's threat dial.
 */
import { calculatePowerRating } from '../engine/power';
import { activeRival } from '../engine/story';
import type { Character, Foe, RivalTemplate, StepRoute, StoryEffect, Trait, WheelOption, WheelStep } from '../engine/types';
import { demonLords, fightWheel, hasTrait, rivals } from './common';

// ─── Traits ─────────────────────────────────────────────────────────────────

export const QUEST_TRAITS: Record<string, Trait> = {
  veiled_relic: { id: 'veiled_relic', name: 'The Veiled Relic', description: 'Stolen from the Order of the Veil. It hums, and its keepers hunt it.', power: 40, item: 'relic' },
  witchs_gift: { id: 'witchs_gift', name: 'The Witch’s Gift', description: 'Power from the Crossroads Witch. Every gift has a price.', power: 50 },
};

/** Labels for the quest flags worth showing; the rest (the objective) stay behind the scenes. */
export const STORY_FLAG_LABELS: Record<string, string> = {
  allies: 'Allies',
  relic: 'The relic',
  mercy: 'Mercy shown',
  parley: 'Words with the rival',
  betrayal: 'Betrayal',
  bargain: 'A bargain struck',
  hired: 'Hired swords',
  wounded: 'Wounds',
  intel: 'Knows the land',
  villages: 'Friend of the villages',
  company: 'In the Company’s pay',
  catastrophe: 'A forbidden being walks',
  kingdom_turned: 'The crown turned',
};

// ─── Reading the story ──────────────────────────────────────────────────────

const flag = (c: Character, key: string) => c.story?.flags[key] ?? 0;
const threatOf = (c: Character) => c.story?.threat ?? 0;
const seen = (c: Character, id: string) => c.story?.seen.includes(id) ?? false;
const memories = (c: Character) => activeRival(c)?.memory.length ?? 0;
/** Encounters left before the finale. */
const beatsLeft = (c: Character) => (c.story ? c.story.length - c.story.beats : 0);

/** A foe that grows with the hero (a share of their Combat Power), and with the quest's threat. */
const scaledFoe = (name: string, share: number, perThreat: number, perAlly = 0) => (c: Character): Foe => ({
  name,
  power: Math.max(10, Math.round(calculatePowerRating(c) * (share + perThreat * threatOf(c)) * Math.max(0.35, 1 - perAlly * flag(c, 'allies')))),
});
/** The rival, at their current power (times `share`: a relic, allies, lieutenants). */
const rivalFoe = (share = 1, perAlly = 0, name = '{rival}') => (c: Character): Foe => ({
  name,
  power: Math.max(10, Math.round((c.story?.rival?.power ?? calculatePowerRating(c)) * share * Math.max(0.4, 1 - perAlly * flag(c, 'allies') + 0.1 * flag(c, 'hired')))),
});

/** A finale's foe, led by the rival if one is still in play: their name, and half their power, join it. */
const ledByRival = (foe: (c: Character) => Foe) => (c: Character): Foe => {
  const base = foe(c);
  const rival = activeRival(c);
  return rival ? { name: `${rival.name} and ${base.name.replace(/^The /, 'the ')}`, power: base.power + Math.round(rival.power / 2) } : base;
};

/** After an encounter: the next encounter, or the finale once the quest has run its length. */
export const QUEST_NEXT: StepRoute = {
  among: ['quest_road', 'quest_finale'],
  pick: (_world, c) => (!c.story ? null : c.story.beats >= c.story.length ? 'quest_finale' : 'quest_road'),
};

// ─── Builders ───────────────────────────────────────────────────────────────

/** An option as written here: `approach` says how a spun encounter's option meets trouble (see `encounterWheel`). */
type Opt = Omit<WheelOption, 'nextStepId' | 'rarity'> & Partial<Pick<WheelOption, 'nextStepId' | 'rarity'>> & { approach?: Approach };
type QuestOption = WheelOption & { approach?: Approach };
/** An option inside a quest: after it, the quest goes on. */
const go = (o: Opt): QuestOption => ({ rarity: 'common', nextStepId: QUEST_NEXT, ...o });
/** An option that ends the quest. */
const end = (o: Opt): QuestOption => ({ rarity: 'common', nextStepId: null, ...o });
/** A wheel the player decides on. Only for what is worth deciding. */
const decision = (id: string, title: string, subtitle: string, options: WheelOption[]): WheelStep => ({ id, title, subtitle, choice: true, options });

/** How a hero tends to meet trouble. */
type Approach = 'fight' | 'talk' | 'sneak' | 'clever' | 'mercy' | 'coin' | 'dark' | 'avoid' | 'bold';

/** How much each personality leans toward each approach (1 = no lean). */
const LEANS: Record<string, Partial<Record<Approach, number>>> = {
  brave: { fight: 1.8, bold: 1.6, avoid: 0.4, sneak: 0.7 },
  cautious: { clever: 1.5, avoid: 1.6, sneak: 1.3, bold: 0.5, fight: 0.7 },
  kind: { mercy: 2.2, talk: 1.4, dark: 0.2, fight: 0.8 },
  curious: { clever: 1.5, talk: 1.2, bold: 1.2 },
  greedy: { coin: 0.5, dark: 1.6, sneak: 1.3, mercy: 0.5 },
  reckless: { fight: 1.6, bold: 2, clever: 0.6, avoid: 0.4 },
  honorable: { fight: 1.4, mercy: 1.5, talk: 1.2, sneak: 0.6, dark: 0 },
  cruel: { dark: 2.2, fight: 1.4, mercy: 0.2, talk: 0.6 },
  ambitious: { bold: 1.5, dark: 1.4, fight: 1.2, avoid: 0.5 },
};
/** The stat each approach is best at, and how much it leans per point above Average. */
const APPROACH_STAT: Partial<Record<Approach, Partial<Record<'might' | 'agility' | 'intellect', number>>>> = {
  fight: { might: 0.03 },
  bold: { might: 0.02 },
  talk: { intellect: 0.03 },
  clever: { intellect: 0.03 },
  sneak: { agility: 0.03 },
};

/**
 * An encounter that is spun, not chosen: each option is an approach, and the hero's personality
 * and stats lean the wheel toward how they would meet it.
 */
const encounterWheel = (id: string, title: string, subtitle: string, options: QuestOption[]): WheelStep => ({
  id,
  title,
  subtitle: `${subtitle} How they meet it depends on who they are.`,
  options: options.map(({ approach, ...o }) => {
    if (!approach) return o;
    const statScaling = { ...APPROACH_STAT[approach], ...o.statScaling };
    return {
      ...o,
      ...(Object.keys(statScaling).length > 0 && { statScaling }),
      vary: (c: Character) => {
        const base = o.vary ? { ...o, ...o.vary(c) } : o;
        const lean = c.personality ? (LEANS[c.personality]?.[approach] ?? 1) : 1;
        return { ...(o.vary ? o.vary(c) : {}), baseWeight: base.baseWeight * lean };
      },
    };
  }),
});
const story = (s: StoryEffect): { story: StoryEffect } => ({ story: s });
const noHonour: Pick<WheelOption, 'condition' | 'lockedReason'> = {
  condition: (_w, c) => c.personality !== 'honorable',
  lockedReason: 'Honour forbids it',
};
const needs = (key: string, n: number, reason: string): Pick<WheelOption, 'condition' | 'lockedReason'> => ({
  condition: (_w, c) => flag(c, key) >= n,
  lockedReason: reason,
});

// ─── Rivals ─────────────────────────────────────────────────────────────────

const RIVALS = {
  champion: {
    title: 'the Humiliated Champion',
    motivation: 'Wounded pride',
    goal: 'To see you shamed the way you shamed them',
    grudge: 'You beat them, then made them crawl in front of their own men.',
    power: 1,
  },
  keeper: {
    title: 'Keeper of the Veil',
    motivation: 'A sacred duty',
    goal: 'To take back the relic, and the hand that stole it',
    grudge: 'You stole the relic their order guarded for a thousand years.',
    power: 0.9,
  },
  captain: {
    title: 'the Left-for-Dead Captain',
    motivation: 'Revenge',
    goal: 'To leave you bleeding in a ditch, the way you left them',
    grudge: 'You robbed them while they lay wounded, and walked away.',
    power: 0.85,
  },
  company: {
    title: 'Captain of the Iron Company',
    motivation: 'A ruined contract and a ruined name',
    goal: 'To break whatever you are trying to build',
    grudge: 'You sabotaged their company and turned the villages against them.',
    power: 1.1,
  },
  witch: {
    title: 'the Crossroads Witch',
    motivation: 'An insult she will not forgive',
    goal: 'To make your quest fail, slowly',
    grudge: 'You cheated her out of a bargain, and nobody cheats her.',
    power: 0.95,
  },
} satisfies Record<string, RivalTemplate>;

// ─── The quest begins ───────────────────────────────────────────────────────

const OBJECTIVES: [id: string, title: string, objective: string, description: string, icon: string, color: string][] = [
  ['relic', 'The Stolen Sunstone', 'Recover the Sunstone before the thieves sell it.', 'Thieves took the temple’s Sunstone. Get it back.', 'Gem', '#d9a400'],
  ['siege', 'The Siege of Harrowgate', 'Reach Harrowgate and break the siege.', 'Harrowgate is surrounded and starving.', 'Castle', '#8a2e2e'],
  ['beast', 'The Beast of Wyrmwood', 'Hunt the beast that is emptying the villages.', 'Something is taking whole families from Wyrmwood.', 'PawPrint', '#5b3f6e'],
  ['heir', 'The Lost Heir', 'Find the missing heir of Highmoor and bring them home alive.', 'The heir vanished on the road a month ago.', 'Crown', '#4f86b8'],
];

const QUEST_HOOK: WheelStep = {
  id: 'quest_hook',
  title: 'The Quest',
  subtitle: 'Someone needs a hero. Five to seven hard roads, and an ending nobody can predict.',
  options: [
    ...OBJECTIVES.map(([id, title, objective, description, icon, color]): WheelOption => ({
      id,
      label: title,
      description,
      baseWeight: 25,
      rarity: 'common',
      ...story({ begin: { title, objective, length: [5, 7] }, flags: { [`obj_${id}`]: 1 } }),
      nextStepId: 'quest_road',
      color,
      icon,
    })),
    {
      id: 'gods_errand',
      label: 'A God’s Errand',
      description: 'A god appeared in a dream and asked for something. Gods do not ask twice.',
      baseWeight: 2,
      rarity: 'legendary',
      luckDelta: 1,
      fame: 5,
      ...story({ begin: { title: 'The God’s Errand', objective: 'Do what a god asked, and live to tell it.', length: [5, 7] }, flags: { obj_relic: 1, allies: 1 }, threat: 2 }),
      nextStepId: 'quest_road',
      color: '#ffe08a',
      icon: 'Sun',
    },
  ],
};

// ─── The road ahead ─────────────────────────────────────────────────────────

/** A road option that leads to an encounter, met at most once a quest. */
const encounter = (o: Opt & { id: string }): WheelOption => ({
  condition: (_w, c) => !seen(c, o.id),
  lockedReason: 'Already met on this quest',
  rarity: 'common',
  nextStepId: o.id,
  ...o,
  story: { beat: true, ...o.story },
});

const QUEST_ROAD: WheelStep = {
  id: 'quest_road',
  title: 'The Road Ahead',
  subtitle: 'What waits around the next bend? The louder the quest, the more dangerous the road.',
  repeats: true,
  options: [
    encounter({ id: 'enc_champion', label: 'A Proud Champion', description: 'A lord’s champion bars the road, and laughs.', baseWeight: 14, color: '#a35d3a', icon: 'Swords' }),
    encounter({ id: 'enc_relic', label: 'A Guarded Relic', description: 'A hill-shrine, and something in it that hums.', baseWeight: 12, color: '#9a7ad0', icon: 'Gem' }),
    encounter({ id: 'enc_wounded', label: 'A Wounded Stranger', description: 'Someone bleeding in a ditch.', baseWeight: 12, color: '#7a5a3a', icon: 'HeartCrack' }),
    encounter({ id: 'enc_banners', label: 'Two Banners', description: 'Mercenaries and villagers, about to come to blows.', baseWeight: 10, color: '#8a2e2e', icon: 'Flag' }),
    encounter({ id: 'enc_flood', label: 'The Flooded Pass', description: 'The only way forward is under brown water.', baseWeight: 10, color: '#3f7ab8', icon: 'WavesHorizontal' }),
    encounter({
      id: 'enc_ambush',
      label: 'Ambush!',
      description: 'Hunters on their trail. The higher the threat, the likelier.',
      baseWeight: 8,
      vary: (c) => ({ baseWeight: 8 + 3 * threatOf(c) }),
      color: '#7a3e2e',
      icon: 'Crosshair',
    }),
    encounter({ id: 'q_events_common', label: 'Along the Way', description: 'The road itself has something to say.', baseWeight: 8, color: '#7d8a6a', icon: 'Footprints' }),
    { id: 'quiet', label: 'A Quiet Stretch', description: 'A day with nothing trying to kill them. Threat eases.', baseWeight: 6, rarity: 'common', statModifiers: { vitality: 1 }, story: { beat: true, threat: -1 }, nextStepId: QUEST_NEXT, color: '#6a8a7a', icon: 'Tent' },
    encounter({
      id: 'enc_witch',
      label: 'A Stranger’s Bargain',
      description: 'A woman at a crossroads, with an offer.',
      baseWeight: 6,
      rarity: 'uncommon',
      // She bargains only while there is road left for her price to come due on.
      condition: (_w, c) => !seen(c, 'enc_witch') && beatsLeft(c) >= 2,
      lockedReason: 'Met already, or too near the end',
      color: '#5a2a6e',
      icon: 'Eye',
    }),
    encounter({ id: 'enc_refugees', label: 'Refugees on the Road', description: 'Families fleeing what is ahead.', baseWeight: 6, rarity: 'uncommon', color: '#a08a5a', icon: 'Users' }),
    encounter({
      id: 'enc_rival_strikes',
      label: 'Your Rival Strikes',
      description: '{rival} has found them.',
      baseWeight: 6,
      rarity: 'uncommon',
      condition: (_w, c) => activeRival(c) !== null && !seen(c, 'enc_rival_strikes'),
      lockedReason: 'Only once the quest has made a rival',
      vary: (c) => ({ baseWeight: 20 + 6 * memories(c) + (beatsLeft(c) <= 2 ? 40 : 0) }),
      color: '#6e1f2a',
      icon: 'Skull',
    }),
    encounter({
      id: 'enc_rival_gambit',
      label: 'Your Rival’s Gambit',
      description: '{rival} strikes at what they care about.',
      baseWeight: 5,
      rarity: 'uncommon',
      condition: (_w, c) => activeRival(c) !== null && seen(c, 'enc_rival_strikes') && !seen(c, 'enc_rival_gambit'),
      lockedReason: 'Only after the rival has struck once',
      vary: (c) => ({ baseWeight: 16 + 4 * memories(c) + (beatsLeft(c) <= 1 ? 30 : 0) }),
      color: '#8a1c2e',
      icon: 'Flame',
    }),
    encounter({
      id: 'enc_witch_price',
      label: 'The Price Comes Due',
      description: 'The Crossroads Witch wants paying.',
      baseWeight: 5,
      rarity: 'uncommon',
      condition: (_w, c) => flag(c, 'bargain') > 0 && !seen(c, 'enc_witch_price'),
      lockedReason: 'Only once a bargain has been struck',
      vary: (c) => ({ baseWeight: beatsLeft(c) <= 1 ? 1000 : 40 }), // it always comes due before the end
      color: '#3a1a2a',
      icon: 'Coins',
    }),
    encounter({
      id: 'enc_hired_demand',
      label: 'The Hired Swords Want More',
      description: 'Coin bought them. More coin keeps them.',
      baseWeight: 5,
      rarity: 'uncommon',
      condition: (_w, c) => flag(c, 'hired') > 0 && !seen(c, 'enc_hired_demand'),
      lockedReason: 'Only with hired swords along',
      vary: (c) => ({ baseWeight: beatsLeft(c) <= 1 ? 1000 : 20 }), // coin-bought loyalty always runs out
      color: '#8a6a2e',
      icon: 'Coins',
    }),
    encounter({
      id: 'q_events_rare',
      label: 'Something Unusual',
      description: 'Not the kind of thing that happens every day. What happens depends on the story so far.',
      baseWeight: 3,
      rarity: 'rare',
      vary: (c) => ({ baseWeight: 3 + threatOf(c) }),
      color: '#3fa8a0',
      icon: 'Sparkles',
    }),
    encounter({
      id: 'q_events_legendary',
      label: 'A Turning Point',
      description: 'The kind of day the songs are written about.',
      baseWeight: 0.8,
      rarity: 'legendary',
      condition: (_w, c) => (c.story?.beats ?? 0) >= 2 && !seen(c, 'q_events_legendary'),
      lockedReason: 'Not this early in the quest',
      vary: (c) => ({ baseWeight: 0.8 + 0.25 * threatOf(c) }),
      color: '#ffb84d',
      icon: 'Star',
    }),
  ],
};

// ─── Encounters ─────────────────────────────────────────────────────────────

const ENC_CHAMPION = encounterWheel('enc_champion', 'A Proud Champion', 'A famous fighter in a lord’s colours bars the road, and laughs at them.', [
  go({ approach: 'fight', id: 'duel_honourably', label: 'Duel Them Honourably', description: 'A fair fight. Win respect, or lose blood.', baseWeight: 30, nextStepId: 'q_champion_duel', color: '#3f8a5a', icon: 'Swords' }),
  go({ approach: 'dark', id: 'shame_them', label: 'Beat Them, Then Shame Them', description: 'More glory and their sword, if they win. But the shamed do not forget.', baseWeight: 20, nextStepId: 'q_champion_shame', color: '#6e1f2a', icon: 'Skull' }),
  go({ approach: 'talk', id: 'talk_past', label: 'Talk Their Way Past', description: 'No blood at all, if their wits are sharp enough (Intellect). If not, a fight anyway.', baseWeight: 25, nextStepId: 'q_champion_talk', color: '#4f6f8f', icon: 'Brain' }),
  go({ approach: 'coin', id: 'pay_toll', label: 'Pay the Toll', description: 'Safe and certain, and a little poorer (luck).', baseWeight: 15, luckDelta: -0.25, ...story({ log: 'Paid a champion’s toll to pass.' }), color: '#6b7280', icon: 'Coins' }),
  go({ id: 'knows_the_songs', label: 'They Know the Songs', description: 'The champion bows instead of drawing, and asks to ride with a legend. Likelier the more famous.', baseWeight: 4, vary: (c) => ({ baseWeight: 1 + (c.fame ?? 0) / 15 }), rarity: 'epic', fame: 8, ...story({ flags: { allies: 2 }, log: 'A champion who knew the songs of {hero} knelt, and joined the quest.' }), color: '#ffd76a', icon: 'Music' }),
]);

const championFoe = scaledFoe('The Champion', 0.8, 0.05);

const CHAMPION_DUEL = fightWheel({
  id: 'q_champion_duel',
  title: 'A Duel at the Crossing',
  subtitle: 'Steel, a crowd, and a champion who has never lost.',
  foe: { name: 'The Champion', power: 200 },
  foeOf: championFoe,
  then: QUEST_NEXT,
  deadliness: 0.15,
  victory: { label: 'Won Fairly', description: 'They saluted. Word of it travels ahead.', ...story({ flags: { respect: 1 }, log: 'Beat a lord’s champion in a fair duel.' }) },
  glory: { label: 'Won Their Respect', description: 'They sheathed their sword, and asked to ride along.', rarity: 'rare', ...story({ flags: { allies: 1 }, log: 'Beat a champion so well they joined the quest.' }) },
  legend: { label: 'The Champion Swears Fealty', description: 'And their lord’s whole guard with them.', rarity: 'epic', ...story({ flags: { allies: 3 }, log: 'Beat a champion so well they swore fealty, and brought their lord’s guard.' }) },
  retreat: { label: 'Beaten', description: 'They let them pass, bleeding, to make a point.', statModifiers: { vitality: -2 }, ...story({ flags: { wounded: 1 }, log: 'Lost a duel to a champion, and limped on.' }) },
  slain: { label: 'Cut Down at the Crossing', description: 'The champion’s record stands.' },
});

const CHAMPION_SHAME = fightWheel({
  id: 'q_champion_shame',
  title: 'No Mercy at the Crossing',
  subtitle: 'Win, and make an example of them.',
  foe: { name: 'The Champion', power: 200 },
  foeOf: championFoe,
  then: QUEST_NEXT,
  deadliness: 0.15,
  victory: { label: 'Made Them Crawl', description: 'Their sword, their pride, in the mud. They swore revenge.', weaponTierDelta: 1, ...story({ threat: 1, rival: { create: RIVALS.champion }, log: 'Beat a champion and made them crawl. {rival} swore revenge.' }) },
  glory: { label: 'Broke Them in Front of Everyone', description: 'A legend of cruelty, and an enemy for life.', rarity: 'rare', weaponTierDelta: 2, ...story({ threat: 1, rival: { create: RIVALS.champion }, log: 'Broke a champion in front of their own men. {rival} will not rest.' }) },
  legend: { label: 'Took Their Lord’s Lands Too', description: 'The champion’s lord threw in the lands to end it. Nobody will ever forgive the hero.', rarity: 'epic', weaponTierDelta: 2, meters: { notoriety: 2 }, epithet: { text: 'the Land-Taker', priority: 52 }, ...story({ threat: 2, rival: { create: RIVALS.champion }, log: 'Broke a champion and took their lord’s lands. {rival} swore revenge.' }) },
  retreat: { label: 'Beaten and Mocked', description: 'It went the other way. Everyone laughed.', statModifiers: { vitality: -2 }, ...story({ flags: { wounded: 1 }, log: 'Tried to shame a champion and was shamed instead.' }) },
  slain: { label: 'Killed by the Champion', description: 'They should have fought fair.' },
});

const CHAMPION_TALK: WheelStep = {
  id: 'q_champion_talk',
  title: 'Words at the Crossing',
  subtitle: 'The sharper the mind, the likelier the champion steps aside.',
  options: [
    go({ id: 'talked_past', label: 'Talked Past', description: 'A joke, a compliment, a lie. They stepped aside.', baseWeight: 50, statScaling: { intellect: 0.03 }, ...story({ log: 'Talked past a champion without drawing steel.' }), color: '#4f6f8f', icon: 'Brain' }),
    go({ id: 'talk_failed', label: 'Talk Failed', description: 'They drew. So it is a duel after all.', baseWeight: 40, story: { log: 'Talk failed; the champion drew steel.' }, nextStepId: 'q_champion_duel', color: '#a35d3a', icon: 'Swords' }),
    go({ id: 'talked_into_crusade', label: 'Talked Them Into a Crusade', description: 'By the end the champion and their whole household were sworn to the quest.', baseWeight: 4, rarity: 'epic', statScaling: { intellect: 0.04 }, fame: 6, ...story({ flags: { allies: 3 }, log: 'Talked a champion and their whole household into joining the quest.' }), color: '#ffd76a', icon: 'Users' }),
    go({ id: 'impressed', label: 'Impressed Them', description: 'They liked the hero so much they rode along.', baseWeight: 10, rarity: 'rare', statScaling: { intellect: 0.04 }, ...story({ flags: { allies: 1 }, log: 'Talked a champion into joining the quest.' }), color: '#c9a24c', icon: 'Handshake' }),
  ],
};

const ENC_RELIC = decision('enc_relic', 'A Guarded Relic', 'In a hill-shrine, the Order of the Veil keeps a relic that hums with power.', [
  go({ id: 'steal_it', label: 'Steal It', description: 'Real power to keep (Agility helps). But what is stolen is hunted, and the threat rises.', baseWeight: 30, nextStepId: 'q_relic_steal', color: '#5a2a6e', icon: 'EyeOff' }),
  go({ id: 'ask_for_it', label: 'Ask the Keepers', description: 'They might lend it for the quest (Intellect helps). Lent, not given.', baseWeight: 35, nextStepId: 'q_relic_ask', color: '#4f6f8f', icon: 'Handshake' }),
  go({ id: 'leave_it', label: 'Leave It Be', description: 'Not theirs to take. A clear conscience, and a little luck.', baseWeight: 25, luckDelta: 0.25, ...story({ log: 'Left the Order’s relic where it belonged.' }), color: '#6b7280', icon: 'Ban' }),
  go({ id: 'walk_through_the_wards', label: 'Walk Through the Wards', description: 'Straight through the old protections, and let the relic decide. It will choose them, and it will hurt (Wounds +2).', baseWeight: 10, rarity: 'epic', grantTraits: ['veiled_relic', 'relic_awake'], meters: { wounds: 2 }, epithet: { text: 'Relic-Chosen', priority: 50 }, ...story({ flags: { relic: 1 }, threat: 1, log: 'Walked through the Order’s wards; the relic chose them.' }), color: '#ffb84d', icon: 'Gem' }),
]);

const RELIC_STEAL: WheelStep = {
  id: 'q_relic_steal',
  title: 'The Theft',
  subtitle: 'Quick hands, quiet feet (Agility).',
  options: [
    go({ id: 'stolen_clean', label: 'Stolen Clean', description: 'Out the window with it. The keepers will know by morning.', baseWeight: 45, statScaling: { agility: 0.04 }, grantTraits: ['veiled_relic'], ...story({ flags: { relic: 1 }, threat: 2, rival: { create: RIVALS.keeper }, log: 'Stole the Veiled Relic. Its keeper, {rival}, swore to hunt them down.' }), color: '#9a7ad0', icon: 'Gem' }),
    go({ id: 'seen_fleeing', label: 'Seen Fleeing', description: 'They have it, and the keepers saw their face.', baseWeight: 30, grantTraits: ['veiled_relic'], ...story({ flags: { relic: 1 }, threat: 3, rival: { create: RIVALS.keeper }, log: 'Stole the Veiled Relic, and was seen. {rival} is coming.' }), color: '#7a3a6e', icon: 'Eye' }),
    go({ id: 'relic_wakes', label: 'The Relic Wakes in Their Hands', description: 'It chose them. The keepers saw it glow, and lowered their spears.', baseWeight: 4, rarity: 'epic', grantTraits: ['veiled_relic', 'relic_awake'], epithet: { text: 'Relic-Chosen', priority: 50 }, ...story({ flags: { relic: 1 }, log: 'The Veiled Relic woke in their hands and chose them; its keepers let them go.' }), color: '#ffd76a', icon: 'Gem' }),
    go({ id: 'caught', label: 'Caught', description: 'Beaten and thrown down the hill, empty-handed.', baseWeight: 25, statScaling: { agility: -0.02 }, statModifiers: { vitality: -2 }, ...story({ flags: { wounded: 1 }, threat: 1, log: 'Was caught robbing the shrine, and beaten for it.' }), color: '#7a2e2e', icon: 'HeartCrack' }),
  ],
};

const RELIC_ASK: WheelStep = {
  id: 'q_relic_ask',
  title: 'Before the Keepers',
  subtitle: 'They are old and careful (Intellect).',
  options: [
    go({ id: 'refused', label: 'Refused', description: 'Politely. Firmly.', baseWeight: 45, ...story({ log: 'Asked the Order of the Veil for their relic, and was refused.' }), color: '#6b7280', icon: 'Ban' }),
    go({ id: 'lent', label: 'Lent for the Quest', description: 'The relic, and a guide to carry it back.', baseWeight: 35, statScaling: { intellect: 0.03 }, ...story({ flags: { relic: 1, allies: 1 }, log: 'The Order lent them the relic, and a guide.' }), color: '#4f86b8', icon: 'Handshake' }),
    go({ id: 'named_keeper', label: 'Named Keeper of the Veil', description: 'The old keeper had waited a lifetime for a successor. They do not have to give it back.', baseWeight: 4, rarity: 'epic', grantTraits: ['veiled_relic'], epithet: { text: 'Keeper of the Veil', priority: 50 }, ...story({ flags: { relic: 1, allies: 1 }, log: 'Was named Keeper of the Veil, and carried the relic as its own.' }), color: '#ffd76a', icon: 'Medal' }),
    go({ id: 'tested', label: 'A Test of Worth', description: 'Three days of trials. They passed, and the Order honoured them.', baseWeight: 12, rarity: 'rare', statScaling: { intellect: 0.04 }, fame: 6, ...story({ flags: { relic: 1 }, log: 'Passed the Order’s test of worth, and carried the relic with its blessing.' }), color: '#c9a24c', icon: 'Medal' }),
  ],
};

const ENC_WOUNDED = encounterWheel('enc_wounded', 'A Wounded Stranger', 'A mercenary captain, bleeding in a ditch. Their company was ambushed.', [
  go({ id: 'a_prince_in_disguise', label: 'A Prince in Disguise', description: 'Not a captain. The exiled heir to a stolen throne, and now in their debt.', baseWeight: 4, rarity: 'epic', grantTags: ['hook:exiled_prince'], ...story({ flags: { allies: 1, mercy: 1 }, log: 'Saved a wounded stranger who turned out to be an exiled prince.' }), color: '#4f86b8', icon: 'Crown' }),
  go({ approach: 'mercy', id: 'tend_wounds', label: 'Tend Their Wounds', description: 'A loyal ally for the rest of the quest. It takes time, and the danger grows.', baseWeight: 35, ...story({ flags: { allies: 1, mercy: 1 }, threat: 1, remember: 'Heard that {hero} saved a dying stranger.', log: 'Saved a wounded captain, who swore to repay it.' }), color: '#5f9a6a', icon: 'HandHeart' }),
  go({ approach: 'coin', id: 'hire_them', label: 'Hire Them', description: 'Quick and simple: an ally for coin (luck). Coin-bought loyalty has a way of running out.', baseWeight: 25, luckDelta: -0.25, ...story({ flags: { allies: 1, hired: 1 }, log: 'Hired a wounded captain’s sword.' }), color: '#b8962e', icon: 'Coins' }),
  go({ approach: 'dark', ...noHonour, id: 'rob_them', label: 'Rob Them', meters: { notoriety: 1 }, description: 'Their fine sword, right now. But they might live, and remember.', baseWeight: 15, weaponTierDelta: 1, fame: -3, ...story({ flags: { betrayal: 1 }, threat: 1, rival: { create: RIVALS.captain }, log: 'Robbed a wounded captain and left them for dead. {rival} lived.' }), color: '#6e1f2a', icon: 'Skull' }),
  go({ approach: 'avoid', id: 'walk_on', label: 'Walk On', description: 'Not their problem. No time lost.', baseWeight: 25, ...story({ log: 'Walked past a dying stranger.' }), color: '#6b7280', icon: 'Footprints' }),
]);

const ENC_BANNERS = encounterWheel('enc_banners', 'Two Banners', 'The Iron Company and the free villagers are about to fight over a mill.', [
  go({ id: 'both_lay_down_arms', label: 'Both Sides Lay Down Arms', description: 'One speech, from the mill steps. Both banners follow them now.', baseWeight: 4, rarity: 'epic', fame: 10, ...story({ flags: { allies: 2, villages: 1 }, threat: -1, log: 'Made the Iron Company and the villagers lay down their arms, and follow them.' }), color: '#ffd76a', icon: 'Handshake' }),
  go({ approach: 'mercy', id: 'stand_with_villagers', label: 'Stand With the Villagers', description: 'Friends in every village ahead, if you can hold the mill (Might).', baseWeight: 30, nextStepId: 'q_banners_hold', color: '#5f9a6a', icon: 'ShieldHalf' }),
  go({ approach: 'coin', id: 'take_the_coin', label: 'Take the Company’s Coin', description: 'Better armour, today. The mill burns, and coin buys no loyalty.', baseWeight: 25, armorTierDelta: 1, luckDelta: 0.25, ...story({ flags: { company: 1 }, log: 'Took the Iron Company’s coin. The mill burned.' }), color: '#b8962e', icon: 'Coins' }),
  go({ approach: 'sneak', id: 'sabotage', label: 'Sabotage the Company', description: 'Wreck their contract (Agility, Intellect). The villages will love you; the Company’s captain will not.', baseWeight: 20, nextStepId: 'q_banners_sabotage', color: '#6e1f2a', icon: 'Bomb' }),
  go({ approach: 'avoid', id: 'stay_out', label: 'Stay Out of It', description: 'Not their fight.', baseWeight: 25, ...story({ log: 'Stayed out of the fight at the mill.' }), color: '#6b7280', icon: 'Ban' }),
]);

const BANNERS_HOLD: WheelStep = {
  id: 'q_banners_hold',
  title: 'Holding the Mill',
  subtitle: 'Pitchforks against pikes (Might).',
  options: [
    go({ id: 'held', label: 'Held the Mill', description: 'The Company withdrew. The villages will remember.', baseWeight: 55, statScaling: { might: 0.03 }, ...story({ flags: { allies: 1, villages: 1 }, threat: 1, log: 'Held the mill with the villagers against the Iron Company.' }), color: '#5f9a6a', icon: 'ShieldCheck' }),
    go({ id: 'lord_of_the_villages', label: 'The Villages Make Them Lord', description: 'Free villages, a free lord. The first they ever chose.', baseWeight: 4, rarity: 'epic', epithet: { text: 'Lord of the Free Villages', priority: 52 }, ...story({ flags: { allies: 2, villages: 2 }, log: 'Held the mill, and the free villages made them their lord.' }), color: '#ffd76a', icon: 'Crown' }),
    go({ id: 'driven_back', label: 'Driven Back', description: 'The mill fell. The villagers still thank them for trying.', baseWeight: 45, statModifiers: { vitality: -2 }, ...story({ flags: { villages: 1, wounded: 1 }, threat: 2, log: 'Fought for the villagers and lost the mill.' }), color: '#7a2e2e', icon: 'HeartCrack' }),
  ],
};

const BANNERS_SABOTAGE: WheelStep = {
  id: 'q_banners_sabotage',
  title: 'Sabotage',
  subtitle: 'Cut the wagons, burn the contract, spread the rumours (Agility, Intellect).',
  options: [
    go({ id: 'broke_contract', label: 'Broke Their Contract', description: 'The Company is finished here. Its captain knows who did it.', baseWeight: 55, statScaling: { agility: 0.02, intellect: 0.02 }, ...story({ flags: { villages: 1, allies: 1 }, threat: 2, rival: { create: RIVALS.company }, log: 'Sabotaged the Iron Company. Its captain, {rival}, swore to ruin them.' }), color: '#5f9a6a', icon: 'Flame' }),
    go({ id: 'stole_the_war_chest', label: 'Stole the Company’s War-Chest', description: 'A whole mercenary company’s pay, in one cart, in the night.', baseWeight: 4, rarity: 'epic', luckDelta: 1, weaponTierDelta: 1, armorTierDelta: 1, ...story({ flags: { villages: 1 }, threat: 2, rival: { create: RIVALS.company }, log: 'Stole the Iron Company’s war-chest. {rival} will never forgive it.' }), color: '#ffd76a', icon: 'Coins' }),
    go({ id: 'caught_sabotaging', label: 'Caught in the Act', description: 'Torches in hand, surrounded.', baseWeight: 45, story: { log: 'Was caught sabotaging the Iron Company.' }, nextStepId: 'q_company_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const COMPANY_FIGHT = fightWheel({
  id: 'q_company_fight',
  title: 'Surrounded by the Iron Company',
  subtitle: 'Fight out, or not at all.',
  foe: { name: 'The Iron Company', power: 220 },
  foeOf: scaledFoe('The Iron Company', 0.9, 0.06),
  then: QUEST_NEXT,
  deadliness: 0.15,
  victory: { label: 'Cut Their Way Out', description: 'And left the Company in ruins behind them.', ...story({ flags: { villages: 1 }, threat: 2, rival: { create: RIVALS.company }, log: 'Fought their way out of the Iron Company’s camp. {rival} swore revenge.' }) },
  glory: { label: 'Routed the Company', description: 'The mercenaries scattered, and the villages cheered.', rarity: 'rare', ...story({ flags: { villages: 1, allies: 1 }, threat: 1, rival: { create: RIVALS.company }, log: 'Routed the Iron Company single-handed. Its captain, {rival}, will be back.' }) },
  legend: { label: 'The Company Follows Them Now', description: 'They cut their way to the captain’s tent and out again, and the Company decided it liked the winner.', rarity: 'epic', ...story({ flags: { allies: 3, villages: 1 }, log: 'Fought through the Iron Company until it changed sides.' }) },
  retreat: { label: 'Beaten and Thrown Out', description: 'Bruised, robbed of their armour.', armorTierDelta: -1, statModifiers: { vitality: -1 }, ...story({ flags: { wounded: 1 }, threat: 1, log: 'Was caught sabotaging the Iron Company, and beaten.' }) },
  slain: { label: 'Hanged by the Company', description: 'A warning to saboteurs.' },
});

const ENC_FLOOD = encounterWheel('enc_flood', 'The Flooded Pass', 'The only way forward is under brown, fast water.', [
  go({ id: 'river_spirit', label: 'The River Spirit Grants Passage', description: 'The water parted, and a voice in it said their name. Rivers will always let them pass.', baseWeight: 4, rarity: 'epic', grantTraits: ['river_blessing'], luckDelta: 0.5, ...story({ threat: -2, log: 'The river spirit parted the flood for them.' }), color: '#8abaf0', icon: 'WavesHorizontal' }),
  go({ approach: 'bold', id: 'ford', label: 'Ford the Torrent', description: 'Fast, if your body holds (Vitality, Might). If not, the river takes gear and blood.', baseWeight: 30, nextStepId: 'q_flood_ford', color: '#3f7ab8', icon: 'WavesHorizontal' }),
  go({ approach: 'clever', id: 'detour', label: 'Find Another Way', description: 'Maybe a hidden path (Intellect). Maybe days lost, while the danger grows.', baseWeight: 30, nextStepId: 'q_flood_detour', color: '#4f8a5b', icon: 'Compass' }),
  go({ approach: 'clever', id: 'build_raft', label: 'Build a Raft', description: 'Safe, quick, and lying low eases the threat.', baseWeight: 25, requiresTrait: ['skill_survival', 'skill_smithing', 'master_crafter', 'skill_riding'], ...story({ threat: -1, log: 'Built a raft and crossed the flood in an afternoon.' }), color: '#8a6a3a', icon: 'Hammer' }),
  go({ approach: 'avoid', id: 'leave_gear', label: 'Leave the Heavy Gear Behind', description: 'Swim it, lighter. Certain, at the cost of armour.', baseWeight: 15, armorTierDelta: -1, ...story({ threat: -1, log: 'Left their heavy gear on the bank and swam the flood.' }), color: '#6b7280', icon: 'Shield' }),
]);

const FLOOD_FORD: WheelStep = {
  id: 'q_flood_ford',
  title: 'Into the Torrent',
  subtitle: 'Cold, fast and loud (Vitality, Might).',
  options: [
    go({ id: 'made_it', label: 'Made It Across', description: 'Soaked, shaking, through.', baseWeight: 60, statScaling: { vitality: 0.03, might: 0.02 }, ...story({ log: 'Forded the flood.' }), color: '#3f7ab8', icon: 'Footprints' }),
    go({ id: 'rode_the_torrent', label: 'Rode the Torrent', description: 'On a log, standing up, all the way to the next valley. The river spirit was impressed.', baseWeight: 4, rarity: 'epic', grantTraits: ['river_blessing'], ...story({ threat: -1, log: 'Rode the flood standing on a log, and won the river’s blessing.' }), color: '#8abaf0', icon: 'WavesHorizontal' }),
    go({ id: 'swept_away', label: 'Swept Away', description: 'Dragged a mile downstream. Lost armour; kept their life.', baseWeight: 40, statModifiers: { vitality: -2 }, armorTierDelta: -1, ...story({ flags: { wounded: 1 }, log: 'Was swept away fording the flood, and lost their armour.' }), color: '#7a2e2e', icon: 'HeartCrack' }),
  ],
};

const FLOOD_DETOUR: WheelStep = {
  id: 'q_flood_detour',
  title: 'Another Way',
  subtitle: 'Maps, memory and guesswork (Intellect).',
  options: [
    go({ id: 'hidden_path', label: 'A Hidden Path', description: 'And a much better idea of the land ahead.', baseWeight: 50, statScaling: { intellect: 0.03 }, luckDelta: 0.25, ...story({ flags: { intel: 1 }, log: 'Found a hidden path around the flood, and learned the land.' }), color: '#4f8a5b', icon: 'Map' }),
    go({ id: 'a_lost_valley', label: 'A Valley Nobody Mapped', description: 'Green, hidden, and theirs to name. It goes on the map.', baseWeight: 4, rarity: 'epic', place: { discover: 'wild' }, ...story({ flags: { intel: 2 }, threat: -1, log: 'Found a hidden valley around the flood, and put it on the map.' }), color: '#3f8a4a', icon: 'Trees' }),
    go({ id: 'lost_days', label: 'Lost for Days', description: 'The danger ahead grew while they wandered.', baseWeight: 50, ...story({ threat: 2, log: 'Lost days finding another way. The danger grew.' }), color: '#6b7280', icon: 'CircleQuestionMark' }),
  ],
};

const ENC_AMBUSH = encounterWheel('enc_ambush', 'Ambush!', 'Hunters, sent by whoever the quest has upset. The louder it has been, the more of them.', [
  go({ id: 'hunters_defect', label: 'The Hunters Defect', description: 'Their leader lowered the bow: "We were told you were a monster." They ride with the hero now.', baseWeight: 4, rarity: 'epic', ...story({ flags: { allies: 2 }, threat: -2, log: 'The hunters sent after them defected, and joined the quest.' }), color: '#ffd76a', icon: 'Handshake' }),
  go({ approach: 'fight', id: 'stand_and_fight', label: 'Stand and Fight', description: 'Win, and the hunt eases. Their numbers grow with the threat.', baseWeight: 30, nextStepId: 'q_ambush_fight', color: '#a35d3a', icon: 'Swords' }),
  go({ approach: 'sneak', id: 'run', label: 'Run', description: 'Quick feet (Agility). If they’re quicker, a fight anyway.', baseWeight: 25, nextStepId: 'q_ambush_flee', color: '#3f8a5a', icon: 'Wind' }),
  go({ approach: 'clever', id: 'false_trail', label: 'Lay a False Trail', description: 'Fool them (Intellect) and the threat drops a lot. Fail, and they come on angrier.', baseWeight: 20, nextStepId: 'q_ambush_decoy', color: '#4f6f8f', icon: 'Footprints' }),
  go({ approach: 'coin', id: 'throw_purse', label: 'Throw Down the Purse', description: 'Certain and safe. Costs luck.', baseWeight: 15, luckDelta: -0.5, ...story({ threat: -1, log: 'Threw down their purse to buy off an ambush.' }), color: '#6b7280', icon: 'Coins' }),
]);

const AMBUSH_FIGHT = fightWheel({
  id: 'q_ambush_fight',
  title: 'The Ambush',
  subtitle: 'Arrows from the trees, then blades.',
  foe: { name: 'The Hunters', power: 150 },
  foeOf: scaledFoe('The Hunters', 0.45, 0.06),
  then: QUEST_NEXT,
  deadliness: 0.15,
  victory: { label: 'Fought Them Off', description: 'The survivors will tell their masters it is not so easy.', ...story({ threat: -1, log: 'Fought off an ambush.' }) },
  glory: { label: 'Turned the Ambush', description: 'Not one hunter went home, and their leader’s sword is theirs.', rarity: 'rare', weaponTierDelta: 1, ...story({ threat: -2, log: 'Turned an ambush on the hunters.' }) },
  legend: { label: 'Captured Their Paymaster', description: 'Whoever sent the hunters paid them in person. Now that person is talking.', rarity: 'epic', ...story({ flags: { intel: 2 }, threat: -3, log: 'Turned an ambush, and captured whoever paid for it.' }) },
  retreat: { label: 'Escaped, Bleeding', description: 'Out of the trap with an arrow in the shoulder.', statModifiers: { vitality: -2 }, ...story({ flags: { wounded: 1 }, log: 'Escaped an ambush, bleeding.' }) },
  slain: { label: 'Died in the Ambush', description: 'The hunters collected their bounty.' },
});

const AMBUSH_FLEE: WheelStep = {
  id: 'q_ambush_flee',
  title: 'Run!',
  subtitle: 'Through the brambles, over the stream (Agility).',
  options: [
    go({ id: 'got_away', label: 'Got Away', description: 'Lost them in the hills.', baseWeight: 60, statScaling: { agility: 0.04 }, ...story({ log: 'Outran an ambush.' }), color: '#3f8a5a', icon: 'Wind' }),
    go({ id: 'vanished_like_smoke', label: 'Vanished Like Smoke', description: 'The hunters will tell the story for years: there one moment, gone the next.', baseWeight: 4, rarity: 'epic', grantTraits: ['ghost_step'], ...story({ threat: -2, log: 'Vanished from under the hunters’ noses.' }), color: '#5a4a6e', icon: 'Wind' }),
    go({ id: 'cornered', label: 'Cornered', description: 'A cliff behind, hunters in front.', baseWeight: 40, story: { log: 'Was cornered by the hunters.' }, nextStepId: 'q_ambush_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const AMBUSH_DECOY: WheelStep = {
  id: 'q_ambush_decoy',
  title: 'The False Trail',
  subtitle: 'A cloak on a branch, tracks doubling back (Intellect).',
  options: [
    go({ id: 'took_the_bait', label: 'They Took the Bait', description: 'The hunters are a day behind, and confused.', baseWeight: 60, statScaling: { intellect: 0.04 }, ...story({ threat: -2, log: 'Sent the hunters down a false trail.' }), color: '#4f6f8f', icon: 'Footprints' }),
    go({ id: 'into_their_own_trap', label: 'Sent Them Into Their Own Trap', description: 'The hunters walked into the pit they had dug for the hero. Every one of them.', baseWeight: 4, rarity: 'epic', ...story({ threat: -4, log: 'Sent the hunters into their own trap.' }), color: '#ffd76a', icon: 'Crosshair' }),
    go({ id: 'saw_through_it', label: 'They Saw Through It', description: 'And now they are angry.', baseWeight: 40, ...story({ threat: 1, log: 'The hunters saw through the false trail.' }), nextStepId: 'q_ambush_fight', color: '#7a2e2e', icon: 'Eye' }),
  ],
};

const ENC_WITCH = decision('enc_witch', 'A Stranger’s Bargain', 'A woman at a crossroads offers power. She smiles too much.', [
  go({ id: 'take_the_gift', label: 'Take the Gift', description: 'Real power now. Her price comes due before the quest ends.', baseWeight: 30, grantTraits: ['witchs_gift'], ...story({ flags: { bargain: 1 }, log: 'Took a gift from the Crossroads Witch. The price will come due.' }), color: '#5a2a6e', icon: 'Sparkles' }),
  go({ id: 'refuse', label: 'Refuse', description: 'Nothing gained, nothing owed. A little luck for the wisdom.', baseWeight: 35, luckDelta: 0.25, ...story({ log: 'Refused the Crossroads Witch’s bargain.' }), color: '#4f6f8f', icon: 'Ban' }),
  go({ id: 'greatest_gift', label: 'Ask for Her Greatest Gift', description: 'Not a trinket: the gift she has given three people in three hundred years. Her price will be steep, and the road darker.', baseWeight: 10, rarity: 'epic', grantTraits: ['witchs_gift', 'true_name'], statModifiers: { arcana: 3 }, ...story({ flags: { bargain: 1 }, threat: 2, log: 'Asked the Crossroads Witch for her greatest gift, and got it. The price will come due.' }), color: '#ffb84d', icon: 'Sparkles' }),
  go({ id: 'cheat_her', label: 'Trick Her', description: 'Her gift without her price (Intellect). Cheating a witch makes an enemy, and failing earns a curse.', baseWeight: 20, nextStepId: 'q_witch_trick', color: '#c0569a', icon: 'VenetianMask' }),
]);

const WITCH_TRICK: WheelStep = {
  id: 'q_witch_trick',
  title: 'A Riddle for a Witch',
  subtitle: 'Words with two meanings (Intellect).',
  options: [
    go({ id: 'outwitted', label: 'Outwitted Her', description: 'The gift, no price. She has not been cheated in three hundred years.', baseWeight: 50, statScaling: { intellect: 0.04 }, grantTraits: ['witchs_gift'], ...story({ rival: { create: RIVALS.witch }, log: 'Cheated the Crossroads Witch out of her gift. {rival} will not forget it.' }), color: '#c0569a', icon: 'Sparkles' }),
    go({ id: 'she_likes_them', label: 'She Took a Liking to Them', description: 'Nobody had made her laugh in three hundred years. The gift, no price, and a friend.', baseWeight: 4, rarity: 'epic', grantTraits: ['witchs_gift'], ...story({ flags: { allies: 1 }, log: 'Made the Crossroads Witch laugh. She gave her gift for free, and came along.' }), color: '#c0569a', icon: 'Sparkles' }),
    go({ id: 'cursed', label: 'Cursed', description: 'She saw it coming. Their luck sours.', baseWeight: 50, luckDelta: -0.5, grantTags: ['cursed'], ...story({ threat: 1, log: 'Tried to cheat the witch, and was cursed for it.' }), color: '#5a2a3a', icon: 'Skull' }),
  ],
};

const ENC_REFUGEES = encounterWheel('enc_refugees', 'Refugees on the Road', 'Families with carts, fleeing what lies ahead.', [
  go({ id: 'a_child_seer', label: 'A Child Among Them Is a Seer', description: 'She looked at the hero and told them their future. Then she told them what lies ahead.', baseWeight: 4, rarity: 'epic', grantTags: ['hook:prophecy'], ...story({ flags: { intel: 2, mercy: 1 }, log: 'A child seer among the refugees told them their future.' }), color: '#ffe08a', icon: 'Eye' }),
  go({ approach: 'mercy', id: 'escort', label: 'Escort Them to Safety', description: 'Days lost and the danger grows. Fame, an ally among them, and mercy that is remembered.', baseWeight: 30, fame: 6, ...story({ flags: { allies: 1, mercy: 1 }, threat: 2, remember: 'Saw {hero} shepherd refugees to safety.', log: 'Escorted refugees to safety, at the cost of days.' }), color: '#5f9a6a', icon: 'HandHeart' }),
  go({ approach: 'mercy', id: 'give_supplies', label: 'Give Them Their Supplies', description: 'No time lost. Hungrier, luckier, and kinder.', baseWeight: 30, statModifiers: { vitality: -1 }, luckDelta: 0.5, ...story({ flags: { mercy: 1 }, remember: 'Heard {hero} gave their food to refugees.', log: 'Gave their supplies to refugees.' }), color: '#a08a5a', icon: 'Wheat' }),
  go({ approach: 'avoid', id: 'turn_away', label: 'Turn Them Away', description: 'Nothing gained, nothing lost, nothing remembered kindly.', baseWeight: 25, ...story({ remember: 'Saw {hero} turn away the helpless.', log: 'Turned refugees away at the bridge.' }), color: '#6b7280', icon: 'Ban' }),
]);

// ─── The rival strikes back ─────────────────────────────────────────────────

const ENC_RIVAL_STRIKES = encounterWheel('enc_rival_strikes', 'Your Rival Strikes', '{rival} has found them. They remember everything.', [
  go({ id: 'rival_brings_a_monster', label: 'They Brought Something Terrible', description: '{rival} made a deal with something old and hungry, and it came with them.', baseWeight: 4, rarity: 'epic', ...story({ rival: { escalate: { power: 0.5, allies: 2 } }, threat: 2, log: '{rival} made a pact with something terrible, and brought it to the fight.' }), nextStepId: 'q_rival_fight', color: '#3a0a1a', icon: 'Skull' }),
  go({ approach: 'fight', id: 'face_them', label: 'Face Them', description: 'Beat them and they are weakened, or broken for good. Lose, and they grow bolder.', baseWeight: 30, nextStepId: 'q_rival_fight', color: '#a35d3a', icon: 'Swords' }),
  go({ approach: 'sneak', id: 'slip_away', label: 'Slip Away', description: 'No fight today (Agility). They will gather more swords.', baseWeight: 25, nextStepId: 'q_rival_evade', color: '#3f8a5a', icon: 'Wind' }),
  go({ approach: 'talk', id: 'parley', label: 'Parley', description: 'Hear them out (Intellect; mercy shown earlier helps). It can open the way to peace, or insult them.', baseWeight: 25, nextStepId: 'q_rival_parley', color: '#4f6f8f', icon: 'Handshake' }),
  go({ approach: 'clever', id: 'set_trap', label: 'Set a Trap', description: 'Take them by surprise (Intellect), for those who know how.', baseWeight: 20, requiresTrait: ['skill_tracking', 'skill_stealth', 'skill_tactics', 'shadowstep'], nextStepId: 'q_rival_trap', color: '#8a6a3a', icon: 'Crosshair' }),
]);

const RIVAL_FIGHT = fightWheel({
  id: 'q_rival_fight',
  title: 'Steel With Your Rival',
  subtitle: 'They have been waiting for this.',
  foe: { name: 'Your rival', power: 250 },
  foeOf: rivalFoe(),
  then: QUEST_NEXT,
  deadliness: 0.2,
  victory: { label: 'Beat Them Back', description: 'They fell back, weaker, and angrier.', ...story({ rival: { weaken: 0.75 }, remember: 'Lost to {hero} on the road.', log: 'Beat {rival} in a skirmish. They fell back, weaker.' }) },
  glory: { label: 'Broke Them', description: 'They fled the land, and will not be back.', rarity: 'rare', fame: 8, ...story({ rival: { resolve: 'Broken by {hero} in battle, they fled the land' }, log: 'Broke {rival} utterly. The rivalry is over.' }) },
  legend: { label: 'Broke Them, and Took Their Followers', description: '{rival} fled alone. Everyone who followed them follows the hero now.', rarity: 'epic', fame: 10, ...story({ rival: { resolve: 'Fled alone after {hero} broke them and took their followers' }, flags: { allies: 2 }, log: 'Broke {rival}, and took every one of their followers.' }) },
  retreat: { label: 'Bested', description: 'They let the hero live, so they can enjoy it later.', statModifiers: { vitality: -2 }, ...story({ flags: { wounded: 1 }, rival: { escalate: {} }, remember: 'Beat {hero} once already.', log: 'Lost a skirmish to {rival}.' }) },
  slain: { label: 'Killed by Their Rival', description: 'The grudge ends the only way they wanted.', fate: 'Killed on the road by their rival, {rival}', story: { rival: { resolve: 'Killed {hero} on the road' } } },
});

const RIVAL_EVADE: WheelStep = {
  id: 'q_rival_evade',
  title: 'Slipping Away',
  subtitle: 'Back roads and cold camps (Agility).',
  options: [
    go({ id: 'slipped_away', label: 'Slipped Away', description: 'Gone. {rival} gathers more swords for next time.', baseWeight: 55, statScaling: { agility: 0.04 }, ...story({ rival: { escalate: { power: 0.05, allies: 1 } }, remember: 'Watched {hero} run.', log: 'Slipped away from {rival}, who gathered more swords.' }), color: '#3f8a5a', icon: 'Wind' }),
    go({ id: 'turned_their_scouts', label: 'Turned Their Own Scouts', description: 'The scouts {rival} sent now report to the hero.', baseWeight: 4, rarity: 'epic', ...story({ rival: { weaken: 0.6 }, flags: { intel: 2 }, log: 'Turned the scouts {rival} sent after them.' }), color: '#ffd76a', icon: 'Eye' }),
    go({ id: 'caught_by_rival', label: 'Caught', description: 'Not quick enough.', baseWeight: 45, story: { log: '{rival} caught them before they could slip away.' }, nextStepId: 'q_rival_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const RIVAL_PARLEY: WheelStep = {
  id: 'q_rival_parley',
  title: 'A Parley',
  subtitle: 'Two enemies, one fire (Intellect; mercy shown makes peace likelier).',
  options: [
    go({ id: 'heard_them_out', label: 'Heard Them Out', description: 'They learned what drives each other. The door to peace is open.', baseWeight: 50, statScaling: { intellect: 0.03 }, ...story({ flags: { parley: 1 }, remember: '{hero} listened.', log: 'Parleyed with {rival}, and learned what drives them.' }), color: '#4f6f8f', icon: 'Handshake' }),
    go({ id: 'insulted_them', label: 'Insulted Them', description: 'A wrong word. They leave angrier, and stronger.', baseWeight: 35, ...story({ rival: { escalate: { power: 0.1 } }, remember: '{hero} mocked them at the parley.', log: 'The parley with {rival} went badly.' }), color: '#7a2e2e', icon: 'UserX' }),
    go({ id: 'turned_out_kin', label: 'They Turned Out to Be Kin', description: 'A name, a village, a mother in common. {rival} rides with them now.', baseWeight: 4, rarity: 'epic', ...story({ rival: { resolve: 'Turned out to be kin of {hero}, and joined them' }, flags: { allies: 1 }, log: 'Discovered {rival} was kin, and ended the feud.' }), color: '#ffd76a', icon: 'Users' }),
    go({ id: 'truce', label: 'A Truce', description: 'Enough. They shake hands, and part.', baseWeight: 15, rarity: 'rare', vary: (c) => ({ baseWeight: 6 + 8 * flag(c, 'mercy') }), fame: 6, ...story({ rival: { resolve: 'Made a truce with {hero}, and went home' }, log: 'Made a truce with {rival}.' }), color: '#c9a24c', icon: 'Sun' }),
  ],
};

const RIVAL_TRAP: WheelStep = {
  id: 'q_rival_trap',
  title: 'The Trap',
  subtitle: 'Patience and a good spot (Intellect).',
  options: [
    go({ id: 'sprung', label: 'Sprung the Trap', description: 'They walked into it. They will limp to the end of this.', baseWeight: 60, statScaling: { intellect: 0.03 }, ...story({ rival: { weaken: 0.6 }, remember: 'Walked into {hero}’s trap.', log: 'Caught {rival} in a trap and badly hurt them.' }), color: '#5f9a6a', icon: 'Crosshair' }),
    go({ id: 'captured_alive', label: 'Captured Them Alive', description: 'Tied up, ransomed back to whoever wants them, and done.', baseWeight: 4, rarity: 'epic', fame: 10, ...story({ rival: { resolve: 'Was captured by {hero}, and ransomed' }, log: 'Captured {rival} alive, and ransomed them.' }), color: '#ffd76a', icon: 'Lock' }),
    go({ id: 'they_saw_it', label: 'They Saw It Coming', description: 'And they will not be so careless again.', baseWeight: 40, ...story({ rival: { escalate: { power: 0.1 } }, log: '{rival} saw through their trap.' }), color: '#7a2e2e', icon: 'Eye' }),
  ],
};

const ENC_RIVAL_GAMBIT = encounterWheel('enc_rival_gambit', 'Your Rival’s Gambit', '{rival} strikes at what they care about: their friends, their prize, their name.', [
  go({ id: 'gambit_backfires', label: 'The Gambit Backfires', description: '{rival} overreached. Their own people handed them over.', baseWeight: 4, rarity: 'epic', fame: 10, ...story({ rival: { resolve: 'Was handed over to {hero} by their own people' }, flags: { allies: 1 }, log: '{rival} overreached, and their own people handed them over.' }), color: '#ffd76a', icon: 'Handshake' }),
  go({ approach: 'fight', id: 'go_after_them', label: 'Go After Them Now', description: 'A fight with their lieutenants. Win, and the rival is weakened.', baseWeight: 30, nextStepId: 'q_gambit_fight', color: '#a35d3a', icon: 'Swords' }),
  go({ approach: 'mercy', ...needs('relic', 1, 'They have nothing the rival wants back'), id: 'give_it_back', label: 'Give Them What They Want', description: 'Hand over the relic. The raids stop and the threat drops; the power goes.', baseWeight: 20, removeTraits: ['veiled_relic'], ...story({ flags: { relic: -1, parley: 1 }, threat: -2, remember: '{hero} gave back what was taken.', log: 'Gave the relic up to {rival} to stop their raids.' }), color: '#4f6f8f', icon: 'Gem' }),
  go({ approach: 'avoid', id: 'let_it_go', label: 'Let It Go', description: 'No fight. An ally lost, and a bolder rival.', baseWeight: 20, ...story({ flags: { allies: -1 }, rival: { escalate: {} }, remember: '{hero} let them take it.', log: 'Let {rival} have their way. An ally was lost.' }), color: '#6b7280', icon: 'Ban' }),
  go({ approach: 'talk', id: 'turn_their_allies', label: 'Turn Their Allies', description: 'A few words in the right ears, for those with silver tongues.', baseWeight: 20, requiresTrait: ['skill_diplomacy', 'skill_disguise'], ...story({ rival: { weaken: 0.8 }, flags: { allies: 1 }, log: 'Turned some of {rival}’s followers to their side.' }), color: '#c9a24c', icon: 'Handshake' }),
]);

const GAMBIT_FIGHT = fightWheel({
  id: 'q_gambit_fight',
  title: 'The Rival’s Lieutenants',
  subtitle: 'Not the rival themselves. Not yet.',
  foe: { name: 'Their lieutenants', power: 200 },
  foeOf: rivalFoe(0.8, 0, '{rival}’s lieutenants'),
  then: QUEST_NEXT,
  deadliness: 0.15,
  victory: { label: 'Fought Them Off', description: 'The lieutenants are scattered.', ...story({ rival: { weaken: 0.85 }, log: 'Fought through {rival}’s lieutenants.' }) },
  glory: { label: 'Turned the Tables', description: 'One of the lieutenants switched sides.', rarity: 'rare', ...story({ rival: { weaken: 0.7 }, flags: { allies: 1 }, log: 'Beat {rival}’s lieutenants, and won one of them over.' }) },
  legend: { label: 'Turned Every Lieutenant', description: '{rival} woke up with no lieutenants. They were all with the hero.', rarity: 'epic', ...story({ rival: { weaken: 0.4 }, flags: { allies: 2 }, log: 'Turned every one of {rival}’s lieutenants.' }) },
  retreat: { label: 'Too Many of Them', description: 'They took what they came for.', statModifiers: { vitality: -1 }, ...story({ flags: { allies: -1, wounded: 1 }, rival: { escalate: { allies: 1 } }, log: '{rival}’s lieutenants took what they came for.' }) },
  slain: { label: 'Killed by the Lieutenants', description: '{rival} did not even have to be there.', story: { rival: { resolve: 'Had {hero} killed by their lieutenants' } } },
});

// ─── Prices come due ────────────────────────────────────────────────────────

const ENC_WITCH_PRICE = decision('enc_witch_price', 'The Price Comes Due', 'The Crossroads Witch is waiting on the road. A gift was given; a gift is owed.', [
  go({ id: 'pay_in_blood', label: 'Pay in Blood', description: 'She takes some of their life (Vitality −3). The gift stays.', baseWeight: 30, statModifiers: { vitality: -3 }, ...story({ flags: { bargain: -1 }, log: 'Paid the witch in blood.' }), color: '#7a1c2e', icon: 'Droplet' }),
  go({ ...needs('allies', 1, 'No ally to give'), id: 'pay_with_ally', label: 'Pay With an Ally', description: 'Someone who trusted them walks off with her.', baseWeight: 15, ...story({ flags: { allies: -1, bargain: -1, betrayal: 1 }, log: 'Paid the witch with an ally’s freedom.' }), color: '#5a2a3a', icon: 'UserX' }),
  go({ id: 'give_it_back', label: 'Give the Gift Back', description: 'Power gone, debt cleared.', baseWeight: 30, removeTraits: ['witchs_gift'], ...story({ flags: { bargain: -1 }, log: 'Gave the witch her gift back.' }), color: '#4f6f8f', icon: 'Ban' }),
  go({
    id: 'turn_her_curse',
    label: 'Turn Her Own Magic on Her',
    description: 'Keep the gift and pay nothing, for someone with the Arcana to match her (16 or more). She will never forgive it.',
    baseWeight: 10,
    rarity: 'epic',
    condition: (_w, c) => c.stats.arcana >= 16,
    lockedReason: (_w, c) => `Needs 16 Arcana to match her (they have ${c.stats.arcana})`,
    epithet: { text: 'the Witch-Breaker', priority: 52 },
    ...story({ flags: { bargain: -1 }, rival: { create: RIVALS.witch }, log: 'Turned the Crossroads Witch’s magic back on her. {rival} will not forget.' }),
    color: '#ffb84d',
    icon: 'WandSparkles',
  }),
  go({ id: 'refuse_to_pay', label: 'Refuse to Pay', description: 'Keep everything. She curses the road ahead: threat soars.', baseWeight: 25, grantTags: ['cursed'], ...story({ threat: 3, log: 'Refused to pay the witch. The road ahead was cursed.' }), color: '#3a1a2a', icon: 'Skull' }),
]);

const ENC_HIRED_DEMAND = encounterWheel('enc_hired_demand', 'The Hired Swords Want More', 'Their captain counts the days, and the danger, and names a new price.', [
  go({ id: 'captain_is_a_legend', label: 'Their Captain Is a Legend', description: 'Under the mercenary’s cloak, a hero everyone thought was dead. They stay, for free.', baseWeight: 4, rarity: 'epic', ...story({ flags: { allies: 1, hired: -1 }, log: 'The hired swords’ captain turned out to be a legend, and stayed for nothing.' }), color: '#ffd76a', icon: 'Medal' }),
  go({ approach: 'coin', id: 'pay_up', label: 'Pay Up', description: 'They stay. The purse empties (luck).', baseWeight: 40, luckDelta: -0.5, ...story({ log: 'Paid the hired swords more to stay.' }), color: '#b8962e', icon: 'Coins' }),
  go({ approach: 'avoid', id: 'let_them_go', label: 'Let Them Go', description: 'One fewer sword at the end.', baseWeight: 35, ...story({ flags: { allies: -1, hired: -1 }, log: 'Let the hired swords walk.' }), color: '#6b7280', icon: 'Footprints' }),
  go({ approach: 'talk', id: 'win_their_loyalty', label: 'Win Their Loyalty', description: 'Not coin: a reason to stay. For those who know how to talk.', baseWeight: 25, requiresTrait: ['skill_diplomacy', 'skill_tactics'], ...story({ flags: { hired: -1 }, log: 'Turned hired swords into true companions.' }), color: '#c9a24c', icon: 'Handshake' }),
]);

// ─── Events ─────────────────────────────────────────────────────────────────

const EVENTS_COMMON: WheelStep = {
  id: 'q_events_common',
  title: 'Along the Way',
  subtitle: 'Weather, strangers and bad water.',
  options: [
    go({ id: 'storm', label: 'A Storm', description: 'Miserable, but it hides their trail.', baseWeight: 25, statModifiers: { vitality: -1 }, ...story({ threat: -1, log: 'A storm hid their trail.' }), color: '#4f5a7a', icon: 'CloudLightning' }),
    go({ id: 'caravan', label: 'A Merchant Caravan', description: 'Better mail, at a fair price.', baseWeight: 22, luckScaling: 0.3, armorTierDelta: 1, ...story({ log: 'Traded with a caravan for better mail.' }), color: '#b8962e', icon: 'Package' }),
    go({ id: 'shrine', label: 'A Roadside Shrine', description: 'A prayer, a coin, a good feeling.', baseWeight: 20, luckDelta: 0.5, ...story({ log: 'Prayed at a roadside shrine.' }), color: '#d9c27a', icon: 'Church' }),
    go({ id: 'rumours', label: 'A Hunter’s Rumours', description: 'What waits ahead, and where.', baseWeight: 15, rarity: 'uncommon', ...story({ flags: { intel: 1 }, log: 'A hunter told them what lies ahead.' }), color: '#6e5a42', icon: 'Map' }),
    go({ id: 'falling_star', label: 'A Star Falls Nearby', description: 'They found it cooling in a crater, and it was warm in their hand.', baseWeight: 4, rarity: 'epic', statModifiers: { arcana: 3 }, luckDelta: 0.5, ...story({ log: 'A star fell beside the road, and they carried a piece of it.' }), color: '#ffe08a', icon: 'Star' }),
    go({ id: 'bad_water', label: 'Bad Water', description: 'Three days of fever.', meters: { wounds: 1 }, baseWeight: 12, rarity: 'uncommon', statModifiers: { vitality: -1 }, ...story({ flags: { wounded: 1 }, log: 'Drank bad water and paid for it.' }), color: '#65a30d', icon: 'Biohazard' }),
  ],
};

const EVENTS_RARE: WheelStep = {
  id: 'q_events_rare',
  title: 'Something Unusual',
  subtitle: 'What the quest has done so far decides what can happen.',
  options: [
    go({ id: 'omen', label: 'A Strange Omen', description: 'Birds flying backwards. Probably a good sign.', baseWeight: 30, luckDelta: 0.25, ...story({ log: 'Saw a strange omen.' }), color: '#7a7f8c', icon: 'Moon' }),
    go({ ...needs('company', 1, 'Only if they took the Iron Company’s coin'), id: 'company_turns', label: 'The Iron Company Turns', description: 'Coin buys no loyalty. The Company sells them out.', baseWeight: 20, rarity: 'rare', ...story({ flags: { company: -1 }, threat: 2, log: 'The Iron Company turned on them. Coin buys no loyalty.' }), color: '#7a3a2e', icon: 'UserX' }),
    go({ ...needs('villages', 1, 'Only if they stood with the villages'), id: 'villages_rise', label: 'The Villages Rise', description: 'The villages remember who stood with them.', baseWeight: 20, rarity: 'rare', ...story({ flags: { allies: 2 }, log: 'The villages rose to fight beside them.' }), color: '#5f9a6a', icon: 'Users' }),
    go({ id: 'rival_patron', label: 'A Patron for Your Rival', description: '{rival} found someone powerful to back them.', baseWeight: 20, rarity: 'rare', condition: (_w, c) => activeRival(c) !== null, lockedReason: 'Only with a rival in play', ...story({ rival: { escalate: { power: 0.3, allies: 2 } }, log: '{rival} found a powerful patron.' }), color: '#6e1f2a', icon: 'Crown' }),
    go({ id: 'hero_rides_in', label: 'A Hero of the World Rides In', description: 'Another hero, on the same road.', baseWeight: 18, rarity: 'rare', condition: (world, c) => rivals(world, c).length > 0, lockedReason: 'No other hero walks the world', nextStepId: 'q_world_hero', color: '#4f86b8', icon: 'User' }),
    go({ id: 'dragon_owes_them', label: 'A Dragon Joins the Quest', description: 'It landed in the road, sniffed them, and decided it was going the same way.', baseWeight: 1.5, rarity: 'legendary', ...story({ flags: { allies: 3 }, threat: 1, log: 'A dragon landed on the road, and joined the quest.' }), color: '#b8452a', icon: 'Flame' }),
    go({ id: 'plague', label: 'Plague in the Valley', description: 'Danger breeds disease.', baseWeight: 16, rarity: 'rare', condition: (_w, c) => threatOf(c) >= 4, lockedReason: 'Only when the threat is high', statModifiers: { vitality: -2 }, ...story({ threat: 1, flags: { wounded: 1 }, log: 'Plague broke out in the valley around them.' }), color: '#65a30d', icon: 'Biohazard' }),
  ],
};

const WORLD_HERO: WheelStep = {
  id: 'q_world_hero',
  title: 'A Hero of the World',
  subtitle: 'Another of the world’s heroes, met on the road.',
  cast: { from: rivals },
  options: [
    go({ id: 'rides_with_them', label: 'Rides With Them', description: 'For a while, two heroes on one quest.', baseWeight: 60, castEffect: { fame: 3 }, ...story({ flags: { allies: 1 }, log: '{cast}, another hero of the world, rode with them.' }), color: '#4f86b8', icon: 'Users' }),
    go({ id: 'blood_oath', label: 'A Blood-Oath', description: 'Two heroes, a cut palm each, and a promise for life.', baseWeight: 4, rarity: 'epic', grantTraits: ['blood_brother'], castEffect: { gainTraits: [{ id: 'blood_brother', name: 'Sworn Brother-in-Arms', description: 'Another hero, sworn to them in blood.', power: 25 }], fame: 3 }, ...story({ flags: { allies: 2 }, log: 'Swore a blood-oath with {cast}, another hero of the world.' }), color: '#9a3a3a', icon: 'Handshake' }),
    go({ id: 'needs_help', label: 'Needs Their Help', description: 'A detour, a good deed, and fame for both.', baseWeight: 40, fame: 5, castEffect: { fame: 3 }, ...story({ threat: 1, log: 'Took a detour to help {cast}.' }), color: '#a08a5a', icon: 'HandHeart' }),
  ],
};

const EVENTS_LEGENDARY: WheelStep = {
  id: 'q_events_legendary',
  title: 'A Turning Point',
  subtitle: 'The day the quest became something bigger.',
  options: [
    go({ id: 'comet', label: 'A Comet Splits the Sky', description: 'They felt chosen. Maybe they were.', baseWeight: 30, rarity: 'legendary', luckDelta: 1, statModifiers: { arcana: 2 }, ...story({ log: 'A comet split the sky, and they felt chosen.' }), color: '#ffe08a', icon: 'Star' }),
    go({ id: 'kingdom_turns', label: 'The Kingdom Changes Sides', description: 'The crown declares for their enemies. The whole realm grows darker.', baseWeight: 25, rarity: 'legendary', ...story({ threat: 3, flags: { kingdom_turned: 1 }, worldThreat: 1, log: 'The crown declared for their enemies. The whole realm grew darker.' }), color: '#7a3e8a', icon: 'Crown' }),
    go({ id: 'forbidden_wakes', label: 'A Forbidden Being Wakes', description: 'Something under the hills, older than names. The quest is now the world’s problem.', baseWeight: 25, rarity: 'legendary', ...story({ threat: 2, flags: { catastrophe: 1 }, worldThreat: 1, log: 'Something forbidden woke beneath the hills. This is no longer a local quarrel.' }), color: '#1a0a2a', icon: 'Orbit' }),
    go({ id: 'demon_lord_notices', label: 'The Demon Lord Takes Notice', description: 'The Abyss makes {rival} its champion.', baseWeight: 20, rarity: 'legendary', condition: (world, c) => demonLords(world).length > 0 && activeRival(c) !== null, lockedReason: 'Only with a Demon Lord in the world and a rival in play', ...story({ rival: { escalate: { power: 0.5, allies: 3 } }, worldThreat: 0.5, log: 'The Demon Lord made {rival} their champion.' }), color: '#7f1d1d', icon: 'Flame' }),
  ],
};

// ─── The finale ─────────────────────────────────────────────────────────────

/** A finale, weighted by the story so far: what happened decides how it ends. */
const finale = (o: Omit<Opt, 'baseWeight'> & { id: string; weigh: (c: Character) => number }): WheelOption => {
  const { weigh, ...rest } = o;
  return { rarity: 'common', vary: (c) => ({ baseWeight: Math.max(0, weigh(c)) }), nextStepId: o.id, ...rest, baseWeight: 10 };
};

const QUEST_FINALE: WheelStep = {
  id: 'quest_finale',
  title: 'How Does It End?',
  subtitle: 'Every choice so far has tilted this wheel: a rival who remembers, the threat, the allies, the objective.',
  options: [
    finale({ id: 'fin_siege', label: 'The Siege', description: 'Walls, fire and an army. Likelier the higher the threat (and at Harrowgate, or if the crown turned).', weigh: (c) => 4 + 2 * threatOf(c) + 16 * flag(c, 'obj_siege') + 8 * flag(c, 'kingdom_turned'), color: '#8a2e2e', icon: 'Castle' }),
    finale({ id: 'fin_escape', label: 'The Escape', description: 'Run, with everything at their heels. Likelier when threat is high, they are wounded, or there is an heir to save.', weigh: (c) => 3 + threatOf(c) + 4 * flag(c, 'wounded') + 10 * flag(c, 'obj_heir'), color: '#3f8a5a', icon: 'Wind' }),
    finale({ id: 'fin_lair', label: 'Into the Lair', description: 'Down into the dark, where the thing they came for waits. Likeliest when hunting a beast or a thief.', weigh: (c) => 3 + 16 * flag(c, 'obj_beast') + 10 * flag(c, 'obj_relic'), color: '#5b3f6e', icon: 'Skull' }),
    finale({ id: 'fin_duel', label: 'A Final Duel', description: '{rival}, at last. Likelier the more they remember, and the more they have grown. In any other finale, they lead the enemy.', condition: (_w, c) => activeRival(c) !== null, lockedReason: 'No rival left to face', weigh: (c) => 16 + 5 * memories(c) + 8 * (activeRival(c)?.escalations ?? 0), color: '#6e1f2a', icon: 'Swords' }),
    finale({ id: 'fin_parley', label: 'A Parley at the Edge', description: 'One last chance to talk {rival} down. Only if words or mercy have passed between them.', condition: (_w, c) => activeRival(c) !== null && flag(c, 'parley') + flag(c, 'mercy') > 0, lockedReason: 'No rival to talk to, or no words or mercy between them yet', weigh: (c) => 8 + 10 * flag(c, 'parley') + 5 * flag(c, 'mercy'), color: '#4f6f8f', icon: 'Handshake' }),
    end({ id: 'gods_intervene', label: 'The Gods Intervene', description: 'Before the end can begin, the sky opens. The quest is won, and the bards will argue about it for ever.', baseWeight: 1, rarity: 'legendary', fame: 30, luckDelta: 0.5, epithet: { text: 'Favoured of the Gods', priority: 66 }, ...story({ rival: { resolve: 'Was struck down when the gods took {hero}’s side' }, log: 'The gods themselves took a hand, and the quest was won. {quest}: done.' }), color: '#ffe08a', icon: 'Sun' }),
    finale({ id: 'fin_alliance', label: 'A Desperate Alliance', description: 'Everyone they gathered, against something too big for one hero. More likely with every ally, and certain against a forbidden being.', condition: (_w, c) => flag(c, 'allies') > 0 || flag(c, 'catastrophe') > 0, lockedReason: 'No allies to gather', weigh: (c) => 5 * flag(c, 'allies') + 30 * flag(c, 'catastrophe'), color: '#c9a24c', icon: 'Users' }),
  ],
};

/** Fame for an ending, by how well it went. */
const TRIUMPH = 30;
const SUCCESS = 18;
const done = '{quest}: done.';
/** What becomes of a rival still in play when the quest ends: they were part of whatever the finale was. */
const RIVAL_BEATEN = 'Stood against {hero} at the end of {quest}, and lost';
const RIVAL_AVENGED = 'Stood against {hero} at the end of {quest}, and had their revenge';
const failed = '{quest}: failed.';

// The final duel

const finalDuel = (id: string, title: string, subtitle: string, share: number, perAlly: number, how: string) =>
  fightWheel({
    id,
    title,
    subtitle,
    foe: { name: 'Your rival', power: 300 },
    foeOf: rivalFoe(share, perAlly),
    deadliness: 0.35,
    victory: { label: 'Defeated Them', description: 'The rivalry ends here.', fame: SUCCESS, ...story({ rival: { resolve: `Fell to {hero} in the final duel` }, log: `${how}{rival} fell in the final duel. ${done}` }) },
    glory: { label: 'A Duel for the Ages', description: 'They will sing about this one.', rarity: 'rare', fame: TRIUMPH, ...story({ rival: { resolve: 'Fell to {hero} in a duel the bards still sing' }, log: `${how}{rival} fell in a duel for the ages. ${done}` }) },
    legend: { label: 'A Duel That Became Legend', description: 'Sung in every tavern for a hundred years, and they never get it right.', rarity: 'legendary', fame: 40, grantTraits: ['legend_of_the_road'], epithet: { text: 'of Song and Story', priority: 70 }, ...story({ rival: { resolve: 'Fell to {hero} in the duel the whole world sings' }, log: `${how}{rival} fell in a duel that became legend. ${done}` }) },
    retreat: { label: 'Lost the Duel', description: '{rival} won, and let them live to remember it.', statModifiers: { vitality: -2 }, ...story({ rival: { resolve: 'Won the final duel, and let {hero} live with it' }, log: `Lost the final duel to {rival}. ${failed}` }) },
    slain: { label: 'Fell to Their Rival', description: 'The grudge is settled, their way.', fate: 'Killed by their rival, {rival}, at the end of {quest}', story: { rival: { resolve: 'Killed {hero} in the final duel' } } },
  });

const FIN_DUEL = decision('fin_duel', 'A Final Duel', '{rival}, at last. Everything they remember, they bring with them.', [
  end({ id: 'head_on', label: 'Fight Them to the End', description: 'Their full strength against yours.', baseWeight: 30, nextStepId: 'q_fin_duel_fight', color: '#a35d3a', icon: 'Swords' }),
  end({ ...needs('relic', 1, 'They carry no relic'), id: 'use_relic', label: 'Turn the Relic on Them', description: 'The relic burns away almost half their strength.', baseWeight: 25, nextStepId: 'q_fin_duel_relic', color: '#9a7ad0', icon: 'Gem' }),
  end({ ...needs('allies', 1, 'No allies stand with them'), id: 'call_allies', label: 'Call In Your Allies', description: 'Every ally takes a share of the fight (hired swords are less keen).', baseWeight: 25, nextStepId: 'q_fin_duel_allies', color: '#4f86b8', icon: 'Users' }),
  end({ id: 'before_the_gods', label: 'Duel Before the Gods', description: 'For the Famous: a duel on holy ground, the whole realm watching. Win it and the rivalry, and the songs, are theirs for ever.', baseWeight: 10, rarity: 'epic', condition: (_w, c) => (c.fame ?? 0) >= 32, lockedReason: 'Only the Famous are granted holy ground', nextStepId: 'q_fin_duel_fight', fame: 15, epithet: { text: 'Champion Before the Gods', priority: 66 }, ...story({ log: 'Called {rival} to a duel on holy ground, before the whole realm.' }), color: '#ffd76a', icon: 'Sun' }),
  end({
    id: 'offer_mercy',
    label: 'Offer Them Mercy',
    description: 'If words or mercy have passed between them, it might end without blood. If not, a duel anyway.',
    baseWeight: 20,
    condition: (_w, c) => flag(c, 'parley') + flag(c, 'mercy') > 0,
    lockedReason: 'No words or mercy have passed between them',
    nextStepId: 'q_fin_mercy',
    color: '#f0e6c8',
    icon: 'HandHeart',
  }),
]);

const FIN_MERCY: WheelStep = {
  id: 'q_fin_mercy',
  title: 'Mercy',
  subtitle: 'An open hand, held out to {rival}.',
  options: [
    end({ id: 'laid_down_grudge', label: 'They Laid Down the Grudge', description: 'And rode away, lighter.', baseWeight: 50, vary: (c) => ({ baseWeight: 30 + 12 * flag(c, 'parley') + 8 * flag(c, 'mercy') }), fame: SUCCESS, ...story({ rival: { resolve: 'Laid down their grudge, and rode away' }, log: `Offered {rival} mercy, and they took it. ${done}` }), color: '#f0e6c8', icon: 'Sunrise' }),
    end({ id: 'truest_friend', label: 'Their Truest Friend', description: '{rival} wept, and swore to stand beside them for the rest of their life.', baseWeight: 4, rarity: 'epic', grantTraits: ['sworn_rival'], fame: TRIUMPH, epithet: { text: 'the Merciful', priority: 60 }, ...story({ rival: { resolve: 'Became the truest friend of {hero}' }, log: `Offered {rival} mercy, and won a friend for life. ${done}` }), color: '#ffe8a8', icon: 'Users' }),
    end({ id: 'took_it_as_weakness', label: 'They Took It as Weakness', description: 'Steel, after all.', baseWeight: 50, story: { log: '{rival} took their mercy as weakness.' }, nextStepId: 'q_fin_duel_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

// The parley

const FIN_PARLEY = decision('fin_parley', 'A Parley at the Edge', 'Everything is in place for a battle. {rival} agrees to talk first.', [
  end({ id: 'offer_terms', label: 'Offer Terms', description: 'Peace, if you can find the words (Intellect; earlier parleys help). If not, a duel.', baseWeight: 35, nextStepId: 'q_fin_terms', color: '#4f6f8f', icon: 'ScrollText' }),
  end({ ...needs('relic', 1, 'They carry no relic'), id: 'hand_over_relic', label: 'Give Up the Relic', description: 'Certain peace, at the cost of the relic’s power.', baseWeight: 20, removeTraits: ['veiled_relic'], fame: 12, ...story({ flags: { relic: -1 }, rival: { resolve: 'Took back what was taken, and left in peace' }, log: `Gave {rival} the relic in exchange for peace. ${done}` }), color: '#9a7ad0', icon: 'Gem' }),
  end({ id: 'threaten', label: 'Threaten Them', description: 'Make them back down (Might). If they call the bluff, a duel.', baseWeight: 25, nextStepId: 'q_fin_threat', color: '#a35d3a', icon: 'BicepsFlexed' }),
  end({ id: 'offer_they_cannot_refuse', label: 'An Offer Nobody Refuses', description: 'For silver tongues and peacemakers: terms so good that even {rival} laughs, and shakes on it.', baseWeight: 10, rarity: 'epic', condition: (_w, c) => ['skill_diplomacy', 'peacemaker'].some((t) => hasTrait(c, t)), lockedReason: 'Only a silver tongue or a proven peacemaker', fame: TRIUMPH, grantTraits: ['peacemaker'], ...story({ rival: { resolve: 'Shook hands with {hero} on terms nobody could refuse' }, log: `Made {rival} an offer nobody could refuse. ${done}` }), color: '#ffd76a', icon: 'Handshake' }),
  end({ id: 'walk_away', label: 'Walk Away', description: 'No blood, no ending. The rival is still out there, and the quest left unfinished.', baseWeight: 20, ...story({ log: 'Walked away from the parley. {quest}: left unfinished.' }), color: '#6b7280', icon: 'Footprints' }),
]);

const FIN_TERMS: WheelStep = {
  id: 'q_fin_terms',
  title: 'Terms',
  subtitle: 'Every word weighed (Intellect).',
  options: [
    end({ id: 'terms_agreed', label: 'Terms Agreed', description: 'A handshake that holds.', baseWeight: 55, statScaling: { intellect: 0.03 }, vary: (c) => ({ baseWeight: 40 + 10 * flag(c, 'parley') }), fame: SUCCESS, ...story({ rival: { resolve: 'Made peace with {hero}' }, log: `Talked {rival} into peace. ${done}` }), color: '#4f6f8f', icon: 'Handshake' }),
    end({ id: 'peace_for_a_kingdom', label: 'A Peace That Saved a Kingdom', description: 'The terms became a treaty, and the treaty is still read aloud on its anniversary.', baseWeight: 4, rarity: 'epic', grantTraits: ['peacemaker'], fame: TRIUMPH, epithet: { text: 'the Peacemaker', priority: 66 }, ...story({ rival: { resolve: 'Signed a peace with {hero} that held for generations' }, worldThreat: -1, log: `Talked {rival} into a peace that saved a kingdom. ${done}` }), color: '#ffd76a', icon: 'ScrollText' }),
    end({ id: 'talks_collapse', label: 'Talks Collapse', description: 'Swords out.', baseWeight: 45, story: { log: 'The talks with {rival} collapsed.' }, nextStepId: 'q_fin_duel_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const FIN_THREAT: WheelStep = {
  id: 'q_fin_threat',
  title: 'The Threat',
  subtitle: 'Who blinks first (Might)?',
  options: [
    end({ id: 'backed_down', label: 'They Backed Down', description: 'And left, shamed again.', baseWeight: 50, statScaling: { might: 0.04 }, fame: SUCCESS, ...story({ rival: { resolve: 'Backed down before {hero}, and slunk away' }, log: `Stared {rival} down. ${done}` }), color: '#a35d3a', icon: 'BicepsFlexed' }),
    end({ id: 'backed_down_and_bowed', label: 'They Backed Down, and Bowed', description: 'And swore their swords to the one who stared them down.', baseWeight: 4, rarity: 'epic', grantTraits: ['sworn_rival'], fame: TRIUMPH, ...story({ rival: { resolve: 'Bowed to {hero}, and swore them their sword' }, log: `Stared {rival} down, and won their sword. ${done}` }), color: '#ffd76a', icon: 'Crown' }),
    end({ id: 'called_the_bluff', label: 'They Called the Bluff', description: 'So it is a duel.', baseWeight: 50, story: { log: '{rival} called their bluff.' }, nextStepId: 'q_fin_duel_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

// The siege

const FIN_SIEGE = decision('fin_siege', 'The Siege', 'Walls, fire, and an enemy at the gate. Every bit of threat the quest stirred up is out there.', [
  end({ id: 'lead_defence', label: 'Lead the Defence', description: 'A battle, as big as the threat (allies take some of it).', baseWeight: 30, nextStepId: 'q_fin_siege_fight', color: '#a35d3a', icon: 'ShieldHalf' }),
  end({ id: 'burn_engines', label: 'Burn Their Siege Engines', description: 'A night raid (Agility, Intellect; knowing the land helps). Caught, and it is a battle.', baseWeight: 25, nextStepId: 'q_fin_sabotage', color: '#e0703a', icon: 'Flame' }),
  end({
    id: 'rally_countryside',
    label: 'Rally the Countryside',
    description: 'Bring the villages down on the besiegers. Needs friends in the villages or two allies.',
    baseWeight: 25,
    condition: (_w, c) => flag(c, 'villages') > 0 || flag(c, 'allies') >= 2,
    lockedReason: 'No friends in the villages, and too few allies',
    nextStepId: 'q_fin_rally',
    color: '#5f9a6a',
    icon: 'Users',
  }),
  end({ id: 'call_down_the_dragon', label: 'Call Down Their Dragon', description: 'For those with a dragon: wings over the walls, fire on the siege lines, and it is over.', baseWeight: 10, rarity: 'legendary', condition: (_w, c) => ['dragon_bond', 'companion_dragon', 'dragon_council'].some((t) => hasTrait(c, t)), lockedReason: 'Only for those a dragon answers', fame: TRIUMPH + 10, epithet: { text: 'Dragonlord of the Siege', priority: 74 }, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -0.5, log: `Called down their dragon on the besiegers. ${done}` }), color: '#ffb84d', icon: 'Flame' }),
  end({ id: 'negotiate_surrender', label: 'Negotiate the Surrender', description: 'Lives saved, cause lost. The world grows a little darker.', baseWeight: 20, fame: -5, ...story({ rival: { resolve: RIVAL_AVENGED }, worldThreat: 0.5, log: `Negotiated the city’s surrender. Lives saved; ${failed}` }), color: '#6b7280', icon: 'Flag' }),
]);

const FIN_SIEGE_FIGHT = fightWheel({
  id: 'q_fin_siege_fight',
  title: 'The Battle at the Walls',
  subtitle: 'The whole quest comes down to this.',
  foe: { name: 'The Besieging Host', power: 400 },
  foeOf: ledByRival(scaledFoe('The Besieging Host', 1, 0.1, 0.12)),
  deadliness: 0.4,
  victory: { label: 'Broke the Siege', description: 'The gates open to cheering.', fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Broke the siege at the walls. ${done}` }) },
  glory: { label: 'Routed the Host', description: 'The enemy will not come back for a generation.', rarity: 'rare', fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -0.5, log: `Routed the besieging host. ${done} The land breathes easier.` }) },
  legend: { label: 'The Siege Became a Rout', description: 'The besiegers broke and ran, and the city put a statue of the hero over the gate.', rarity: 'legendary', fame: 40, epithet: { text: 'the City-Saver', priority: 70 }, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -1, log: `Turned the siege into a rout. ${done} The city raised a statue.` }) },
  retreat: { label: 'The Walls Fell', description: 'They got out. The city did not.', statModifiers: { vitality: -2 }, ...story({ rival: { resolve: RIVAL_AVENGED }, worldThreat: 0.5, log: `The walls fell. ${failed}` }) },
  slain: { label: 'Fell on the Walls', description: 'Among the last defenders.', story: { rival: { resolve: RIVAL_AVENGED } } },
});

const FIN_SABOTAGE: WheelStep = {
  id: 'q_fin_sabotage',
  title: 'Fire in the Night',
  subtitle: 'Past the pickets, to the engines (Agility, Intellect).',
  options: [
    end({ id: 'engines_burned', label: 'Engines Burned', description: 'Without them, the siege collapses in a week.', baseWeight: 50, statScaling: { agility: 0.03, intellect: 0.03 }, vary: (c) => ({ baseWeight: 40 + 12 * flag(c, 'intel') }), fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Burned the enemy’s siege engines in the night. ${done}` }), color: '#e0703a', icon: 'Flame' }),
    end({ id: 'engines_and_banner', label: 'Burned Their Engines and Their Banner', description: 'The besiegers went home without either, and told the story badly.', baseWeight: 4, rarity: 'epic', fame: TRIUMPH, epithet: { text: 'the Night-Raider', priority: 58 }, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -0.5, log: `Burned the besiegers’ engines and their banner in one night. ${done}` }), color: '#ffd76a', icon: 'Flame' }),
    end({ id: 'caught_outside', label: 'Caught Outside the Walls', description: 'So it is a battle.', baseWeight: 50, story: { log: 'Was caught outside the walls.' }, nextStepId: 'q_fin_siege_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const FIN_RALLY: WheelStep = {
  id: 'q_fin_rally',
  title: 'The Countryside Rises',
  subtitle: 'Every village they helped, every friend they made.',
  options: [
    end({ id: 'countryside_rose', label: 'The Countryside Rose', description: 'Farmers, hunters, and old friends, all at once.', baseWeight: 60, vary: (c) => ({ baseWeight: 40 + 8 * flag(c, 'allies') + 10 * flag(c, 'villages') }), fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Rallied the countryside and broke the siege. ${done}` }), color: '#5f9a6a', icon: 'Users' }),
    end({
      id: 'countryside_crowns_them',
      label: 'The Countryside Crowns Them',
      description: 'They came for the battle and stayed for the coronation. Their adventuring ends; their rule begins.',
      baseWeight: 2,
      rarity: 'legendary',
      setRole: 'npc',
      grantTraits: ['ruler_alliance'],
      grantTags: ['ruler'],
      epithet: { text: 'High Ruler of the Free Lands', priority: 88 },
      fate: 'Broke a siege with the whole countryside, and the countryside made them its ruler',
      ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Rallied the countryside, broke the siege, and was crowned by it. ${done}` }),
      color: '#ffe08a',
      icon: 'Crown',
    }),
    end({ id: 'too_few_came', label: 'Too Few Came', description: 'So it is a battle.', baseWeight: 40, story: { log: 'Too few came to their call.' }, nextStepId: 'q_fin_siege_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

// The escape

const FIN_ESCAPE = decision('fin_escape', 'The Escape', 'Everything the quest stirred up is coming for them at once. Time to go.', [
  end({ id: 'run_for_border', label: 'Run for the Border', description: 'Fast and far (Agility). Run down, and it is a fight.', baseWeight: 30, nextStepId: 'q_fin_run', color: '#3f8a5a', icon: 'Wind' }),
  end({ id: 'hold_the_pass', label: 'Hold the Pass So the Others Escape', description: 'Everyone else gets away. They may not (Vitality helps). A sacrifice, if it comes to it.', baseWeight: 20, nextStepId: 'q_fin_hold', color: '#d9688a', icon: 'ShieldHalf' }),
  end({ id: 'hide', label: 'Hide in Plain Sight', description: 'A disguise, a crowd, a calm face (Intellect). Found, and it is a fight.', baseWeight: 25, nextStepId: 'q_fin_hide', color: '#5a4a6e', icon: 'VenetianMask' }),
  end({ id: 'a_way_nobody_knows', label: 'A Way Nobody Else Knows', description: 'For wayfarers and ghosts: a path off every map, and the hunt finds nothing.', baseWeight: 10, rarity: 'epic', condition: (_w, c) => ['wayfarer', 'ghost_step', 'shadowstep'].some((t) => hasTrait(c, t)), lockedReason: 'Only a wayfarer or a ghost-stepper knows it', fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Took a way nobody else knows, and the hunt found nothing. ${done}` }), color: '#ffd76a', icon: 'Map' }),
  end({ id: 'turn_and_fight', label: 'Turn and Fight', description: 'Stop running.', baseWeight: 25, nextStepId: 'q_fin_escape_fight', color: '#a35d3a', icon: 'Swords' }),
]);

const FIN_ESCAPE_FIGHT = fightWheel({
  id: 'q_fin_escape_fight',
  title: 'Cornered',
  subtitle: 'The pursuers close in.',
  foe: { name: 'The Pursuers', power: 300 },
  foeOf: ledByRival(scaledFoe('The Pursuers', 0.7, 0.08, 0.1)),
  deadliness: 0.35,
  victory: { label: 'Fought Free', description: 'Over the bodies, and away.', fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Fought free of their pursuers. ${done}` }) },
  glory: { label: 'Turned the Hunt', description: 'The hunters became the hunted.', rarity: 'rare', fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Turned on their pursuers and broke them. ${done}` }) },
  legend: { label: 'Came Back With an Army', description: 'They escaped, gathered everyone the pursuers had wronged, and turned around.', rarity: 'epic', fame: 35, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Escaped, raised an army, and came back. ${done}` }) },
  retreat: { label: 'Escaped With Nothing', description: 'Alive, and that is all.', statModifiers: { vitality: -2 }, ...story({ rival: { resolve: RIVAL_AVENGED }, log: `Escaped with their life, and nothing else. ${failed}` }) },
  slain: { label: 'Run Down', description: 'So close to the border.', story: { rival: { resolve: RIVAL_AVENGED } } },
});

const FIN_RUN: WheelStep = {
  id: 'q_fin_run',
  title: 'The Run',
  subtitle: 'Day and night, no fires (Agility).',
  options: [
    end({ id: 'over_the_border', label: 'Over the Border', description: 'Safe, with everything that mattered.', baseWeight: 60, statScaling: { agility: 0.04 }, vary: (c) => ({ baseWeight: 50 + 8 * flag(c, 'intel') }), fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Made it over the border with everything that mattered. ${done}` }), color: '#3f8a5a', icon: 'Route' }),
    end({ id: 'founded_a_free_town', label: 'Founded a Free Town Over the Border', description: 'Everyone who ran with them stayed with them. It goes on the map, under their name.', baseWeight: 4, rarity: 'epic', fame: TRIUMPH, place: { discover: 'city' }, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Escaped over the border and founded a free town there. ${done}` }), color: '#ffd76a', icon: 'Castle' }),
    end({ id: 'run_down', label: 'Run Down', description: 'They were faster.', baseWeight: 40, story: { log: 'Was run down before the border.' }, nextStepId: 'q_fin_escape_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const FIN_HOLD: WheelStep = {
  id: 'q_fin_hold',
  title: 'Holding the Pass',
  subtitle: 'One hero, a narrow place, and everyone else running (Vitality).',
  options: [
    end({ id: 'held_and_lived', label: 'Held, and Lived', description: 'Everyone got through, and somehow, so did they.', baseWeight: 50, statScaling: { vitality: 0.04 }, fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Held the pass alone until everyone escaped, and lived. ${done}` }), color: '#c9a24c', icon: 'ShieldCheck' }),
    end({ id: 'held_and_fell', label: 'Held, and Fell', description: 'Everyone got through. They did not.', baseWeight: 30, setStatus: 'fallen', grantTags: ['martyr'], fame: TRIUMPH, epithet: { text: 'the Martyr', priority: 92 }, fate: 'Held the pass alone so the others could escape, at the end of {quest}', ...story({ log: `Held the pass to the last, so everyone else could escape. ${done}` }), color: '#d9688a', icon: 'HeartCrack' }),
    end({ id: 'the_pass_bears_their_name', label: 'The Pass Bears Their Name', description: 'They held it for three days. It has been called by their name ever since.', baseWeight: 4, rarity: 'epic', fame: 35, epithet: { text: 'of the Pass', priority: 70 }, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Held the pass for three days; it bears their name now. ${done}` }), color: '#ffd76a', icon: 'Mountain' }),
    end({ id: 'overrun', label: 'Overrun', description: 'Forced back, but most got through.', baseWeight: 20, statModifiers: { vitality: -3 }, fame: 10, ...story({ rival: { resolve: RIVAL_BEATEN }, log: 'Was overrun at the pass, but most got away. {quest}: done, barely.' }), color: '#7a2e2e', icon: 'HeartCrack' }),
  ],
};

const FIN_HIDE: WheelStep = {
  id: 'q_fin_hide',
  title: 'In Plain Sight',
  subtitle: 'A new name, a bowed head (Intellect).',
  options: [
    end({ id: 'unseen', label: 'Unseen', description: 'The hunters walked right past.', baseWeight: 55, statScaling: { intellect: 0.03 }, fame: 12, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Hid in plain sight until the hunt moved on. ${done}` }), color: '#5a4a6e', icon: 'EyeOff' }),
    end({ id: 'legend_nobody_found', label: 'A Legend Nobody Could Find', description: 'The hunt became a game, then a song. Nobody ever caught them.', baseWeight: 4, rarity: 'epic', grantTraits: ['ghost_step'], fame: TRIUMPH, epithet: { text: 'the Unseen', priority: 60 }, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Hid so well the hunt became a legend. ${done}` }), color: '#5a4a6e', icon: 'EyeOff' }),
    end({ id: 'found', label: 'Found', description: 'Someone recognised them.', baseWeight: 45, story: { log: 'Was recognised in the crowd.' }, nextStepId: 'q_fin_escape_fight', color: '#7a2e2e', icon: 'Eye' }),
  ],
};

// The alliance

const FIN_ALLIANCE = decision('fin_alliance', 'A Desperate Alliance', 'Everyone they gathered on the road, against something no one could face alone.', [
  end({ id: 'unite_them', label: 'Unite Them All', description: 'Make one army out of many (Intellect; every ally helps, hired swords less so).', baseWeight: 35, nextStepId: 'q_fin_unite', color: '#c9a24c', icon: 'Handshake' }),
  end({ id: 'lead_the_charge', label: 'Lead the Charge', description: 'At the front, where heroes go. Every ally takes a share.', baseWeight: 30, condition: (_w, c) => flag(c, 'catastrophe') === 0, lockedReason: 'There is a forbidden being to face', nextStepId: 'q_fin_alliance_fight', color: '#a35d3a', icon: 'Flag' }),
  end({ id: 'face_the_horror', label: 'Lead Them Against the Horror', description: 'The forbidden being, head on. Far stronger than any army.', baseWeight: 30, ...needs('catastrophe', 1, 'No forbidden being walks'), nextStepId: 'q_fin_horror_fight', color: '#1a0a2a', icon: 'Orbit' }),
  end({
    id: 'raise_your_banner',
    label: 'Raise Their Banner Over All of Them',
    description: 'With three allies or more: not an alliance, a kingdom. Win, and they rule it. Their adventuring ends.',
    baseWeight: 8,
    rarity: 'legendary',
    condition: (_w, c) => flag(c, 'allies') >= 3 && flag(c, 'catastrophe') === 0,
    lockedReason: 'Needs three allies, and no forbidden being to face',
    setRole: 'npc',
    grantTraits: ['ruler_alliance'],
    grantTags: ['ruler'],
    epithet: { text: 'High Ruler of the Alliance', priority: 88 },
    fate: 'Raised their banner over everyone they had gathered, and ruled them',
    ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Raised their banner over the whole alliance, and was made its ruler. ${done}` }),
    color: '#ffe08a',
    icon: 'Crown',
  }),
  end({
    ...needs('catastrophe', 1, 'No forbidden being walks'),
    id: 'seal_it',
    label: 'Seal It With Your Life',
    description: 'Certain: the horror sealed, the world safer. Certain: they do not come back.',
    baseWeight: 10,
    setStatus: 'fallen',
    grantTags: ['martyr'],
    fame: 40,
    epithet: { text: 'the Martyr', priority: 92 },
    fate: 'Sealed a forbidden being away with their own life, at the end of {quest}',
    ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -2, log: `Sealed the forbidden being away with their own life. ${done} The world is safer for it.` }),
    color: '#d9688a',
    icon: 'HeartCrack',
  }),
]);

const FIN_UNITE: WheelStep = {
  id: 'q_fin_unite',
  title: 'One Army',
  subtitle: 'Old grudges set aside, for one day (Intellect).',
  options: [
    end({ id: 'united', label: 'United Them, and Won', description: 'Shoulder to shoulder, they carried the day.', baseWeight: 55, statScaling: { intellect: 0.03 }, vary: (c) => ({ baseWeight: 35 + 8 * flag(c, 'allies') - 6 * flag(c, 'hired') }), condition: (_w, c) => flag(c, 'catastrophe') === 0, lockedReason: 'A forbidden being changes everything', fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `United everyone they had met into one army, and won. ${done}` }), color: '#c9a24c', icon: 'Users' }),
    end({ id: 'united_against_horror', label: 'United Them, and Sealed It', description: 'Together, they drove the forbidden being back into the dark.', baseWeight: 55, statScaling: { intellect: 0.03 }, vary: (c) => ({ baseWeight: 30 + 8 * flag(c, 'allies') - 6 * flag(c, 'hired') }), ...needs('catastrophe', 1, 'No forbidden being walks'), fame: 40, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -1.5, log: `United an alliance that sealed the forbidden being away. ${done} The world is safer for it.` }), color: '#ffe08a', icon: 'Sunrise' }),
    end({
      id: 'forged_a_kingdom',
      label: 'Forged a Kingdom From the Alliance',
      description: 'Everyone they gathered on the road made them their ruler. Their adventuring ends; their reign begins.',
      baseWeight: 2,
      rarity: 'legendary',
      condition: (_w, c) => flag(c, 'catastrophe') === 0,
      lockedReason: 'A forbidden being changes everything',
      setRole: 'npc',
      grantTraits: ['ruler_alliance'],
      grantTags: ['ruler'],
      epithet: { text: 'High Ruler of the Alliance', priority: 88 },
      fate: 'United everyone they met on the road, and was made their ruler',
      ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Forged a kingdom out of everyone they had gathered. ${done}` }),
      color: '#ffe08a',
      icon: 'Crown',
    }),
    end({ id: 'alliance_fractured', label: 'The Alliance Fractured', description: 'Old grudges won. They fight with whoever is left.', baseWeight: 45, story: { log: 'The alliance fractured over old grudges.' }, vary: (c) => ({ baseWeight: 45 + 10 * flag(c, 'hired') + 10 * flag(c, 'betrayal') }), nextStepId: { among: ['q_fin_alliance_fight', 'q_fin_horror_fight'], pick: (_w, c) => (flag(c, 'catastrophe') > 0 ? 'q_fin_horror_fight' : 'q_fin_alliance_fight') }, color: '#7a2e2e', icon: 'Swords' }),
  ],
};

const FIN_ALLIANCE_FIGHT = fightWheel({
  id: 'q_fin_alliance_fight',
  title: 'The Last Battle',
  subtitle: 'Everyone they gathered, against everything that came for them.',
  foe: { name: 'The Enemy Host', power: 400 },
  foeOf: ledByRival(scaledFoe('The Enemy Host', 1.1, 0.08, 0.12)),
  deadliness: 0.35,
  victory: { label: 'Carried the Day', description: 'Bloodied, together, victorious.', fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Won the last battle beside their allies. ${done}` }) },
  glory: { label: 'A Victory for the Songs', description: 'The kind of day that names a generation.', rarity: 'rare', fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Led their allies to a victory for the songs. ${done}` }) },
  legend: { label: 'A Victory That Named an Age', description: 'Every banner in the alliance flies their colours now.', rarity: 'legendary', fame: 40, grantTraits: ['warlord_banner'], epithet: { text: 'Banner of the Alliance', priority: 74 }, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -1, log: `Led the alliance to a victory that named an age. ${done}` }) },
  retreat: { label: 'The Line Broke', description: 'They scattered, and the quest with them.', statModifiers: { vitality: -2 }, ...story({ rival: { resolve: RIVAL_AVENGED }, log: `The alliance broke in the last battle. ${failed}` }) },
  slain: { label: 'Fell in the Last Battle', description: 'At the front, where they led.', story: { rival: { resolve: RIVAL_AVENGED } } },
});

const FIN_HORROR_FIGHT = fightWheel({
  id: 'q_fin_horror_fight',
  title: 'The Forbidden Being',
  subtitle: 'Older than names. Every ally takes a share of it.',
  foe: { name: 'The Forbidden Being', power: 900 },
  foeOf: scaledFoe('The Forbidden Being', 1.6, 0.08, 0.12),
  deadliness: 0.5,
  victory: { label: 'Drove It Back', description: 'Into the dark, for now.', fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -1, log: `Drove the forbidden being back into the dark. ${done}` }) },
  glory: { label: 'Destroyed It', description: 'It will not wake again.', rarity: 'rare', fame: 45, ...story({ rival: { resolve: RIVAL_BEATEN }, worldThreat: -2, log: `Destroyed the forbidden being. ${done} The whole world is safer.` }) },
  legend: { label: 'Bound It to Their Will', description: 'Not destroyed. Leashed. It waits, under the hills, for their word.', rarity: 'legendary', grantTraits: ['horror_bound'], meters: { notoriety: 2 }, epithet: { text: 'Master of the Forbidden', priority: 80 }, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Bound the forbidden being to their own will. ${done}` }) },
  retreat: { label: 'It Walks Free', description: 'They survived. The world will pay for it.', statModifiers: { vitality: -3 }, ...story({ rival: { resolve: RIVAL_AVENGED }, worldThreat: 1, log: `Could not stop the forbidden being; it walks free. ${failed} The world grew darker.` }) },
  slain: { label: 'Unmade by the Horror', description: 'There was nothing left.' },
});

// The lair

const FIN_LAIR = decision('fin_lair', 'Into the Lair', 'Down into the dark, where the thing they came for waits.', [
  end({ id: 'storm_in', label: 'Storm In', description: 'Straight at it.', baseWeight: 30, nextStepId: 'q_fin_lair_fight', color: '#a35d3a', icon: 'Swords' }),
  end({ id: 'sneak_in', label: 'Sneak In', description: 'Take it by surprise (Agility; knowing the land helps). Discovered, and it is a fight.', baseWeight: 30, nextStepId: 'q_fin_lair_sneak', color: '#4a4a5e', icon: 'EyeOff' }),
  end({ id: 'speak_its_name', label: 'Speak Its True Name', description: 'For those who know a true name: say it at the bottom of the lair, and what waits there kneels.', baseWeight: 10, rarity: 'legendary', condition: (_w, c) => hasTrait(c, 'true_name'), lockedReason: 'Only someone who knows a true name', fame: TRIUMPH + 10, grantTraits: ['lair_lord'], epithet: { text: 'Keeper of the Lair', priority: 64 }, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Spoke a true name, and what waited in the lair knelt. ${done}` }), color: '#ffe08a', icon: 'ScrollText' }),
  end({ ...needs('relic', 1, 'They carry no relic'), id: 'relic_light', label: 'Light the Way With the Relic', description: 'The relic’s power strips away almost half of what waits.', baseWeight: 25, nextStepId: 'q_fin_lair_relic', color: '#9a7ad0', icon: 'Gem' }),
]);

const lairFight = (id: string, title: string, share: number, how: string) =>
  fightWheel({
    id,
    title,
    subtitle: 'Bones, darkness, and the end of the road.',
    foe: { name: 'What Waits Below', power: 350 },
    foeOf: ledByRival(scaledFoe('What Waits Below', share, 0.08, 0.06)),
    deadliness: 0.35,
    victory: { label: 'Finished It', description: 'In the dark, at last.', fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `${how} finished what waited in the lair. ${done}` }) },
    glory: { label: 'A Hunt for the Songs', description: 'And came out with a trophy.', rarity: 'rare', fame: TRIUMPH, weaponTierDelta: 1, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `${how} won a fight for the songs in the lair. ${done}` }) },
    legend: { label: 'The Lair Is Theirs Now', description: 'And everything that lived in it, and the way down. It goes on the map.', rarity: 'epic', grantTraits: ['lair_lord'], fame: TRIUMPH, place: { discover: 'lair' }, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `${how} took the lair for their own. ${done}` }) },
    retreat: { label: 'Driven Out', description: 'Back up into the light, empty-handed.', statModifiers: { vitality: -2 }, ...story({ rival: { resolve: RIVAL_AVENGED }, log: `Was driven out of the lair. ${failed}` }) },
    slain: { label: 'Never Came Out', description: 'The lair keeps what it takes.', story: { rival: { resolve: RIVAL_AVENGED } } },
  });

const FIN_LAIR_SNEAK: WheelStep = {
  id: 'q_fin_lair_sneak',
  title: 'Into the Dark, Quietly',
  subtitle: 'One careful step at a time (Agility).',
  options: [
    end({ id: 'struck_unseen', label: 'Struck Unseen', description: 'It never knew they were there.', baseWeight: 55, statScaling: { agility: 0.04 }, vary: (c) => ({ baseWeight: 45 + 12 * flag(c, 'intel') }), fame: SUCCESS, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Crept into the lair and struck unseen. ${done}` }), color: '#4a4a5e', icon: 'EyeOff' }),
    end({ id: 'stole_its_heart', label: 'Stole the Heart of the Lair', description: 'The thing at the bottom never woke. What it slept on is theirs.', baseWeight: 4, rarity: 'epic', grantTraits: ['heart_of_the_deep'], fame: TRIUMPH, ...story({ rival: { resolve: RIVAL_BEATEN }, log: `Crept into the lair and stole its heart from under it. ${done}` }), color: '#ffd76a', icon: 'Gem' }),
    end({ id: 'discovered', label: 'Discovered', description: 'A loose stone.', baseWeight: 45, story: { log: 'Was discovered creeping into the lair.' }, nextStepId: 'q_fin_lair_fight', color: '#7a2e2e', icon: 'Swords' }),
  ],
};

// ─── Registered ─────────────────────────────────────────────────────────────

export const QUEST_STEPS: WheelStep[] = [
  QUEST_HOOK,
  QUEST_ROAD,
  ENC_CHAMPION,
  CHAMPION_DUEL,
  CHAMPION_SHAME,
  CHAMPION_TALK,
  ENC_RELIC,
  RELIC_STEAL,
  RELIC_ASK,
  ENC_WOUNDED,
  ENC_BANNERS,
  BANNERS_HOLD,
  BANNERS_SABOTAGE,
  COMPANY_FIGHT,
  ENC_FLOOD,
  FLOOD_FORD,
  FLOOD_DETOUR,
  ENC_AMBUSH,
  AMBUSH_FIGHT,
  AMBUSH_FLEE,
  AMBUSH_DECOY,
  ENC_WITCH,
  WITCH_TRICK,
  ENC_REFUGEES,
  ENC_RIVAL_STRIKES,
  RIVAL_FIGHT,
  RIVAL_EVADE,
  RIVAL_PARLEY,
  RIVAL_TRAP,
  ENC_RIVAL_GAMBIT,
  GAMBIT_FIGHT,
  ENC_WITCH_PRICE,
  ENC_HIRED_DEMAND,
  EVENTS_COMMON,
  EVENTS_RARE,
  WORLD_HERO,
  EVENTS_LEGENDARY,
  QUEST_FINALE,
  FIN_DUEL,
  finalDuel('q_fin_duel_fight', 'The Final Duel', 'Their full strength against yours.', 1, 0, ''),
  finalDuel('q_fin_duel_relic', 'The Relic’s Light', 'The relic burns away their strength.', 0.6, 0, 'The relic blazed, and '),
  finalDuel('q_fin_duel_allies', 'Shoulder to Shoulder', 'Every ally takes a share of the fight.', 1, 0.15, 'With their allies around them, '),
  FIN_MERCY,
  FIN_PARLEY,
  FIN_TERMS,
  FIN_THREAT,
  FIN_SIEGE,
  FIN_SIEGE_FIGHT,
  FIN_SABOTAGE,
  FIN_RALLY,
  FIN_ESCAPE,
  FIN_ESCAPE_FIGHT,
  FIN_RUN,
  FIN_HOLD,
  FIN_HIDE,
  FIN_ALLIANCE,
  FIN_UNITE,
  FIN_ALLIANCE_FIGHT,
  FIN_HORROR_FIGHT,
  FIN_LAIR,
  lairFight('q_fin_lair_fight', 'The Lair', 0.9, 'They'),
  lairFight('q_fin_lair_relic', 'By the Relic’s Light', 0.55, 'By the relic’s light, they'),
  FIN_LAIR_SNEAK,
];
