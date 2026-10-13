import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getStep } from '../../engine/generation';
import { resolveSlices, rollWeightedOption } from '../../engine/roll';
import { createSeededRng } from '../../engine/rng';
import { createCharacter } from '../../engine/character';
import { createWorld } from '../../engine/world';
import type { WheelOption } from '../../engine/types';
import {
  boundaryCount,
  computeArcs,
  landingMargin,
  layoutSlices,
  mod,
  nearestNeighbour,
  neighboursOf,
  roundelPx,
  screenAngleOf,
  sliceAtPointer,
  sliceAtScreenAngle,
  spinEase,
  targetRotation,
} from './wheelGeometry';

const randomWeights = (rng: () => number) =>
  Array.from({ length: 2 + Math.floor(rng() * 10) }, () => (rng() < 0.15 ? rng() * 0.5 : 1 + rng() * 60));

describe('computeArcs', () => {
  it('sizes every slice by its share of the total weight', () => {
    const arcs = computeArcs([7, 93]);
    expect(arcs[0]?.sweep).toBeCloseTo(25.2, 9);
    expect(arcs[1]?.sweep).toBeCloseTo(334.8, 9);
    expect(arcs[0]?.center).toBeCloseTo(12.6, 9);
  });

  it('tiles the circle exactly, in config order', () => {
    const rng = createSeededRng(3);
    for (let trial = 0; trial < 500; trial++) {
      const arcs = computeArcs(randomWeights(rng));
      expect(arcs[0]?.start).toBe(0);
      expect(arcs.at(-1)?.end).toBe(360);
      arcs.slice(1).forEach((arc, i) => expect(arc.start).toBe(arcs[i]?.end));
    }
  });

  it('gives zero-weight options no slice, and falls back to equal slices when every weight is 0', () => {
    expect(computeArcs([1, 0, 1]).map((a) => a.sweep)).toEqual([180, 0, 180]);
    expect(computeArcs([0, 0, 0, 0]).map((a) => a.sweep)).toEqual([90, 90, 90, 90]);
    expect(computeArcs([Number.NaN, -5, 2]).map((a) => a.sweep)).toEqual([0, 0, 360]);
  });
});

describe('layoutSlices (the Zero Percent Trap)', () => {
  const world = createWorld({ rng: createSeededRng(1), now: 0 });
  const char = createCharacter(GAME_CONFIG, { rng: createSeededRng(2), now: 0 });
  const options: WheelOption[] = [
    { id: 'open', label: 'Open', baseWeight: 93, nextStepId: null },
    { id: 'locked', label: 'Locked', baseWeight: 7, nextStepId: null, condition: () => false },
  ];

  it('draws a locked option at its base size although its odds are 0', () => {
    const slices = resolveSlices(options, world, char);
    expect(slices[1]?.effectiveWeight).toBe(0);
    expect(slices[1]?.probability).toBe(0);
    expect(layoutSlices(slices)[1]?.sweep).toBeCloseTo(360 * 0.07, 9);
  });

  it('ignores threat: slices keep their base size while the odds move', () => {
    const fate = getStep(GAME_CONFIG, 'fate');
    const calm = layoutSlices(resolveSlices(fate.options, world, char));
    const dark = layoutSlices(resolveSlices(fate.options, { ...world, threatLevel: 8 }, char));
    expect(dark).toEqual(calm);
    // The Demon Lord is 5 of Fate's 67 base weight: 7.5% of the wheel.
    expect(calm[3]!.sweep / 360).toBeCloseTo(5 / 67, 9);
  });

  it('still lands every winner the RNG picks, locked slices never among them', () => {
    const rng = createSeededRng(17);
    const slices = resolveSlices(options, world, char);
    const arcs = layoutSlices(slices);
    for (let i = 0; i < 2_000; i++) {
      const { winner } = rollWeightedOption(options, world, char, rng);
      expect(winner.locked).toBe(false);
      const to = targetRotation(rng() * 1e4, arcs[winner.index]!, { offset: rng() });
      expect(sliceAtPointer(to, arcs)).toBe(winner.index);
    }
  });
});

describe('targetRotation', () => {
  it('always lands the chosen slice under the pointer, whatever the slice sizes', () => {
    const rng = createSeededRng(9);
    for (let trial = 0; trial < 5_000; trial++) {
      const arcs = computeArcs(randomWeights(rng));
      const drawn = arcs.flatMap((a, i) => (a.sweep > 0 ? [i] : []));
      const index = drawn[Math.floor(rng() * drawn.length)]!;
      const from = (rng() - 0.5) * 10_000;
      const to = targetRotation(from, arcs[index]!, { turns: 1 + Math.floor(rng() * 7), offset: rng() });
      expect(sliceAtPointer(to, arcs)).toBe(index);
    }
  });

  it('only ever spins forward, by at least the requested turns', () => {
    const arcs = computeArcs([1, 1, 1, 1, 1, 1]);
    const to = targetRotation(123, arcs[2]!, { turns: 5 });
    expect(to - 123).toBeGreaterThan(5 * 360 - 1);
    expect(to - 123).toBeLessThan(6 * 360);
  });

  it('never stops on a lead line, even at extreme offsets or on a thin slice', () => {
    for (const weights of [[1, 1, 1, 1, 1, 1, 1], [2, 98], [0.5, 99.5]]) {
      const arcs = computeArcs(weights);
      const arc = arcs[weights.length === 7 ? 3 : 0]!;
      const margin = landingMargin(arc.sweep);
      for (const offset of [0, 1, -3, 9]) {
        const into = mod(-targetRotation(0, arc, { offset }), 360) - arc.start;
        expect(into).toBeGreaterThanOrEqual(margin - 1e-9);
        expect(into).toBeLessThanOrEqual(arc.sweep - margin + 1e-9);
      }
    }
    expect(landingMargin(7.2)).toBe(1.5); // thin slices keep at least 1.5° clear
    expect(landingMargin(60)).toBe(9); // wide ones keep 15%
  });
});

describe('hit testing', () => {
  it('finds the slice under a screen point at any rotation', () => {
    const quarters = computeArcs([1, 1, 1, 1]);
    // Unrotated: slice 1 spans 90°–180° (3 o'clock to 6 o'clock).
    expect(sliceAtScreenAngle(screenAngleOf(10, 10), 0, quarters)).toBe(1);
    // Rotate a quarter turn clockwise: slice 0 now sits on the right-bottom quadrant.
    expect(sliceAtScreenAngle(screenAngleOf(10, 10), 90, quarters)).toBe(0);
  });

  it('respects proportional sizes and skips zero-width slices', () => {
    const arcs = computeArcs([10, 0, 80, 10]); // 0–36°, (none), 36–324°, 324–360°
    expect(sliceAtScreenAngle(35, 0, arcs)).toBe(0);
    expect(sliceAtScreenAngle(37, 0, arcs)).toBe(2);
    expect(sliceAtScreenAngle(323, 0, arcs)).toBe(2);
    expect(sliceAtScreenAngle(359, 0, arcs)).toBe(3);
    expect(sliceAtScreenAngle(0, 0, [])).toBe(-1);
  });

  it('measures screen angles clockwise from 12 o’clock', () => {
    expect(screenAngleOf(0, -1)).toBeCloseTo(0, 6);
    expect(screenAngleOf(1, 0)).toBeCloseTo(90, 6);
    expect(screenAngleOf(0, 1)).toBeCloseTo(180, 6);
    expect(screenAngleOf(-1, 0)).toBeCloseTo(270, 6);
  });

  it('puts slice centres where the pointer expects them', () => {
    const arcs = computeArcs([5, 20, 3, 40, 12, 20]);
    expect(sliceAtPointer(-arcs[4]!.center, arcs)).toBe(4);
  });
});

describe('animation helpers', () => {
  it('eases from 0 to 1 and clamps', () => {
    expect(spinEase(0)).toBe(0);
    expect(spinEase(1)).toBe(1);
    expect(spinEase(2)).toBe(1);
    expect(spinEase(0.5)).toBeGreaterThan(0.9); // most of the travel happens early
  });

  it('counts one boundary per lead line passed', () => {
    const six = computeArcs([1, 1, 1, 1, 1, 1]);
    expect(boundaryCount(359, six)).toBe(5);
    expect(boundaryCount(360, six)).toBe(6);
    expect(boundaryCount(720 + 61, six)).toBe(13);
  });

  it('ticks exactly when the slice under the pointer changes, for any sizes', () => {
    const rng = createSeededRng(23);
    const arcs = computeArcs([7, 30, 2, 41, 20]);
    let rotation = rng() * 360;
    let lastCount = boundaryCount(rotation, arcs);
    let lastSlice = sliceAtPointer(rotation, arcs);
    for (let step = 0; step < 20_000; step++) {
      rotation += 0.37; // small steps: never skips a whole slice
      const count = boundaryCount(rotation, arcs);
      const slice = sliceAtPointer(rotation, arcs);
      expect(count >= lastCount).toBe(true);
      expect(count !== lastCount).toBe(slice !== lastSlice);
      lastCount = count;
      lastSlice = slice;
    }
  });
});

describe('roundelPx', () => {
  it('is full size on wide slices, shrinks on thin ones, and vanishes on slivers', () => {
    const R = 279;
    expect(roundelPx(90, R)).toBeCloseTo(0.085 * R, 9);
    const thin = roundelPx(7.2, R);
    expect(thin).toBeGreaterThan(0);
    expect(thin).toBeLessThan(0.085 * R);
    expect(roundelPx(3, R)).toBe(0);
    expect(roundelPx(7.2, 150)).toBe(0); // too small to read on a small wheel
  });
});

describe('nearestNeighbour', () => {
  // Three slices: 0–90, 90–270, 270–360.
  const arcs = computeArcs([1, 2, 1]);

  it('names the slice across the nearer lead line, and how near', () => {
    // The pointer rests at wheel angle 100: just past the line into slice 1, so slice 0 is beside it.
    expect(nearestNeighbour(-100, arcs, 1)).toEqual({ index: 0, margin: 10 / 180, degrees: 10 });
    // At 250, slice 2 is the one beside it.
    expect(nearestNeighbour(-250, arcs, 1)).toEqual({ index: 2, margin: 20 / 180, degrees: 20 });
  });

  it('stops a hair inside a lead line when asked to, never on it', () => {
    // Slice 1 runs 90–270. Stopping 2° inside its start puts the pointer at wheel angle 92.
    const near = targetRotation(0, arcs[1]!, { turns: 0, edge: { side: 'start', degrees: 2 } });
    expect(nearestNeighbour(near, arcs, 1)).toMatchObject({ index: 0 });
    expect(nearestNeighbour(near, arcs, 1)!.degrees).toBeCloseTo(2, 9);
    const end = targetRotation(0, arcs[1]!, { turns: 0, edge: { side: 'end', degrees: 0.1 } });
    expect(nearestNeighbour(end, arcs, 1)).toMatchObject({ index: 2 });
    expect(nearestNeighbour(end, arcs, 1)!.degrees).toBeCloseTo(1.2, 9);
    expect(neighboursOf(arcs, 1)).toEqual({ start: 0, end: 2 });
  });

  it('wraps around the wheel, and skips slices with no room', () => {
    expect(nearestNeighbour(-5, arcs, 0)!.index).toBe(2);
    const withEmpty = computeArcs([1, 0, 1]);
    expect(nearestNeighbour(-170, withEmpty, 0)!.index).toBe(2);
  });

  it('has no neighbour on a wheel of one slice', () => {
    expect(nearestNeighbour(0, computeArcs([1]), 0)).toBeNull();
  });
});
