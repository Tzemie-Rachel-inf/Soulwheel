import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { getStep } from '../engine/generation';
import { RARITIES } from '../engine/types';
import { describeEffects, formatOdds, formatPercent, humanizeKey, optionLabel, ordinal, signed } from './format';
import { OPTION_ICONS } from './icons';
import { RARITY_STYLES, isSpecialRarity, statRarity } from './rarity';
import { createCharacter } from '../engine/character';
import { createSeededRng } from '../engine/rng';
import type { Character } from '../engine/types';
import { epitaph, howItEnded, lifeInOneLine } from './legend';
import { legendText } from './share';
import { luminance } from './wheel/color';

describe('icon registry', () => {
  it('has a component for every icon the config names', () => {
    const missing = Object.values(GAME_CONFIG.steps)
      .flatMap((step) => step.options)
      .map((o) => o.icon)
      .filter((name): name is string => name !== undefined && !(name in OPTION_ICONS));
    expect(missing).toEqual([]);
  });
});

describe('rarity styles', () => {
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  it('styles every tier, with effects only from rare upward', () => {
    expect(Object.keys(RARITY_STYLES)).toEqual([...RARITIES]);
    for (const rarity of RARITIES) {
      expect(RARITY_STYLES[rarity].sparkles > 0).toBe(isSpecialRarity(rarity));
    }
  });

  it('keeps every tier colour readable as text on the panels', () => {
    for (const rarity of RARITIES) expect(contrast(RARITY_STYLES[rarity].color, '#232a3e')).toBeGreaterThan(4.5);
  });
});

describe('stat decorations', () => {
  it('ranks a stat from common (Average) to mythical (deep Ascension)', () => {
    expect([1, 10, 12, 13, 16, 20, 25, 50, 80].map(statRarity)).toEqual([
      'common', 'common', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'legendary', 'mythical',
    ]);
  });
});

describe('format helpers', () => {
  it('turns any singleton key into a title', () => {
    expect(humanizeKey('demon_lord')).toBe('Demon Lord');
    expect(humanizeKey('holy_sword_bearer')).toBe('Holy Sword Bearer');
    expect(humanizeKey('chosen-hero')).toBe('Chosen Hero');
  });

  it('formats odds and percentages', () => {
    expect(formatOdds(0.071)).toBe('1 in 14');
    expect(formatOdds(0.5)).toBe('1 in 2');
    expect(formatPercent(0.384)).toBe('38%');
    expect(formatPercent(0.004)).toBe('<1%');
    expect(formatPercent(0)).toBe('0%');
    expect(signed(-2)).toBe('−2');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd',
    ]);
  });

  it('describes races and deaths from option data', () => {
    const elf = getStep(GAME_CONFIG, 'elf_lineage').options.find((o) => o.id === 'high_elf');
    const clan = getStep(GAME_CONFIG, 'dwarf_clan').options.find((o) => o.id === 'ironfist');
    const slain = getStep(GAME_CONFIG, 'fight_troll').options.find((o) => o.id === 'slain');
    if (!elf || !clan || !slain) throw new Error('missing option');
    expect(describeEffects(elf, GAME_CONFIG)).toEqual(['Race: High Elf']);
    expect(describeEffects(clan, GAME_CONFIG)).toEqual(['Might roll +1 position']);
    expect(describeEffects(slain, GAME_CONFIG)).toEqual(['Dies']);
  });

  it('describes personalities, and what an option does to the character a wheel cast', () => {
    const brave = getStep(GAME_CONFIG, 'personality').options.find((o) => o.id === 'brave');
    const lastRide = getStep(GAME_CONFIG, 'legend').options.find((o) => o.id === 'one_last_ride');
    if (!brave || !lastRide) throw new Error('missing option');
    expect(describeEffects(brave, GAME_CONFIG)).toEqual(['Might roll +1 position', 'Personality: Brave']);
    expect(describeEffects(lastRide, GAME_CONFIG, undefined, 'Aldric')).toEqual(['Luck +0.25', 'Aldric returns to the world']);
  });

  it('shows stat rolls with their final number, and how much of it was banked', () => {
    const average = getStep(GAME_CONFIG, 'stat_agility_human').options.find((o) => o.id === 'steady');
    if (!average) throw new Error('missing option');
    const dealt = { ...average, setStats: { agility: 13 } };
    expect(optionLabel(average)).toBe('Steady (10)');
    expect(optionLabel(dealt)).toBe('Steady (13)');
    expect(optionLabel({ label: 'Elf' })).toBe('Elf');
    expect(describeEffects(dealt, GAME_CONFIG, average)).toEqual(['Agility 13 (rolled 10, +3 bonus)']);
    expect(describeEffects(average, GAME_CONFIG, average)).toEqual(['Agility 10']);
  });

  it('describes effects straight from option data', () => {
    const lord = getStep(GAME_CONFIG, 'fate').options.find((o) => o.id === 'demon_lord');
    if (!lord) throw new Error('missing option');
    expect(describeEffects(lord, GAME_CONFIG)).toEqual([
      'Might roll +5 positions',
      'Arcana roll +5 positions',
      'Vitality roll +8 positions',
      'Luck +1.5',
      'Gains Mantle of the Demon Lord',
      'Becomes Demon Lord',
      'Claims the one-of-a-kind role Demon Lord',
      'Marked demonic',
    ]);
  });
});

describe('legends: epitaphs and shares', () => {
  const base = (): Character => ({
    ...createCharacter(GAME_CONFIG, { name: 'Brann', rng: createSeededRng(3), now: 0 }),
    status: 'fallen',
    race: 'dwarf',
    fame: 20,
  });
  const diedIn = (stepId: string, optionId: string): Character => ({
    ...base(),
    adventures: [{ rolls: [{ stepId: 'crossroads', optionId: 'go_adventure', probability: 0.2 }], outcome: 'returned' }, { rolls: [{ stepId, optionId, probability: 0.5 }], outcome: 'fallen' }],
    fate: { at: 0, summary: 'Fell on adventure 2' },
  });

  it('names who brought a hero down, from the fight that ended them', () => {
    const fight = Object.values(GAME_CONFIG.steps).find((s) => s.foe && !/^(The|A|An|What|Who|Their|Your) /.test(s.foe.name))!;
    expect(howItEnded(diedIn(fight.id, fight.options[0]!.id), GAME_CONFIG)).toBe(`Fell to the ${fight.foe!.name} on their 2nd adventure`);
    const named = Object.values(GAME_CONFIG.steps).find((s) => s.foe?.name.startsWith('The '))!;
    expect(howItEnded(diedIn(named.id, named.options[0]!.id), GAME_CONFIG)).toBe(`Fell to the ${named.foe!.name.slice(4)} on their 2nd adventure`);
  });

  it('keeps an ending an option wrote down', () => {
    const crowned = { ...base(), status: 'retired' as const, fate: { at: 0, summary: 'Crowned ruler of Ironhold' } };
    expect(howItEnded(crowned, GAME_CONFIG)).toBe('Crowned ruler of Ironhold');
  });

  it('carves the same closing line for the same soul, by their fame', () => {
    const e = epitaph(base(), GAME_CONFIG);
    expect(e.who).toBe('Dwarf Hero · Renowned');
    expect(epitaph(base(), GAME_CONFIG).closing).toBe(e.closing);
  });

  it('tells a life in one line, and shares it with the same words', () => {
    const hero = diedIn('crossroads', 'go_adventure');
    expect(lifeInOneLine(hero, GAME_CONFIG)).toBe('Brann, Dwarf Hero. Fell on their 2nd adventure.');
    expect(legendText(hero, GAME_CONFIG).split('\n')).toEqual([
      'Brann',
      'Dwarf Hero',
      'Renowned · 50 Combat Power · 2 adventures',
      'Fell on their 2nd adventure.',
      '— rolled on Soulwheel',
    ]);
  });
});
