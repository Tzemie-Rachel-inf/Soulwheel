import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { STATS_START } from '../config/stats';
import { getStep } from '../engine/generation';
import { createWorld } from '../engine/world';
import { blankSubject, labStep, nextWheel } from './lab';
import { buildCatalog, incomingLinks, matchesSearch } from './wheelCatalog';

const catalog = buildCatalog(GAME_CONFIG);
const world = createWorld({ now: 0 });

describe('wheel catalog', () => {
  it('lists every wheel exactly once', () => {
    const ids = catalog.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(GAME_CONFIG.steps).sort());
  });

  it('orders the list the way the game reaches it', () => {
    const groups = catalog.entries.map((e) => e.group);
    expect(catalog.entries[0]!.id).toBe(GAME_CONFIG.entryStepId);
    expect(groups.indexOf('stats')).toBeGreaterThan(groups.lastIndexOf('creation'));
    expect(groups.indexOf('adventure')).toBeGreaterThan(groups.lastIndexOf('stats'));
    expect(groups).not.toContain('unreachable');
    expect(catalog.byId['destiny']!.group).toBe('adventure');
  });

  it('files the stat wheels by race and stat', () => {
    const might = catalog.byId['stat_might_minotaur']!;
    expect(might).toMatchObject({ group: 'stats', race: 'minotaur', stat: 'might', name: 'Minotaur Might' });
    expect(catalog.entries.filter((e) => e.group === 'stats').every((e) => e.race && e.stat)).toBe(true);
    expect(catalog.byId['train_might_minotaur']).toMatchObject({ group: 'training', name: 'Minotaur Might Training' });
  });

  it('searches names, ids and option labels', () => {
    const found = catalog.entries.filter((e) => matchesSearch(e, 'battle ram')).map((e) => e.id);
    expect(found).toEqual(['stat_might_minotaur', 'train_might_minotaur']);
    expect(catalog.entries.filter((e) => matchesSearch(e, '  ')).length).toBe(catalog.entries.length);
  });

  it('finds what leads to a wheel', () => {
    expect(incomingLinks(GAME_CONFIG, 'goblin_band')).toEqual([
      { from: 'monster_type', option: expect.objectContaining({ id: 'goblin' }) },
    ]);
  });
});

describe('lab', () => {
  it('follows an option for the subject, routes included', () => {
    const monsters = getStep(GAME_CONFIG, 'monster_type');
    const goblin = monsters.options.find((o) => o.id === 'goblin')!;
    expect(nextWheel(GAME_CONFIG, monsters, goblin, blankSubject(GAME_CONFIG), world, 'creation')).toEqual({
      kind: 'step',
      id: 'goblin_band',
    });

    // A route picks for the subject as the option leaves them: an orc goes to orc stat wheels.
    const personality = getStep(GAME_CONFIG, 'personality');
    const option = { ...personality.options[0]!, nextStepId: STATS_START };
    expect(nextWheel(GAME_CONFIG, personality, option, blankSubject(GAME_CONFIG, 'orc'), world, 'creation')).toEqual({
      kind: 'step',
      id: 'stat_might_orc',
    });
  });

  it('sends a road that ends home, and a hero who retires nowhere', () => {
    const destiny = labStep(GAME_CONFIG, 'destiny', null, blankSubject(GAME_CONFIG));
    const retire = destiny.options.find((o) => o.setStatus === 'retired')!;
    const subject = blankSubject(GAME_CONFIG, 'human');
    expect(nextWheel(GAME_CONFIG, destiny, retire, subject, world, 'adventure')).toEqual({ kind: 'end', reason: 'adventure ends' });
    const ending = Object.values(GAME_CONFIG.steps)
      .filter((s) => catalog.byId[s.id]?.group === 'adventure')
      .flatMap((s) => s.options.map((o) => ({ step: s, option: o })))
      .find(({ option }) => option.nextStepId === null && !option.setStatus && !option.setRole)!;
    expect(nextWheel(GAME_CONFIG, ending.step, ending.option, subject, world, 'adventure')).toEqual({ kind: 'end', reason: 'home' });
  });

  it('deals a cast wheel as it would be with that character, profession outcomes included', () => {
    const smith = { ...blankSubject(GAME_CONFIG, 'dwarf'), id: 'chr_smith', role: 'npc' as const, traits: [GAME_CONFIG.traits['npc_blacksmith']!] };
    const ids = (cast: typeof smith | null) => labStep(GAME_CONFIG, 'townsfolk', cast, blankSubject(GAME_CONFIG)).options.map((o) => o.id);
    expect(ids(smith)).toContain('reforged');
    expect(ids(smith)).not.toContain('their_song');
    expect(ids(null)).not.toContain('reforged');
  });
});
