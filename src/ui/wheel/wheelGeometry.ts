/**
 * Pure wheel math. No DOM, no React: unit-tested on its own.
 *
 * Conventions used everywhere in the wheel:
 *  - Angles are degrees, measured clockwise from 12 o'clock (where the pointer sits).
 *  - "Wheel space" is the wheel's own frame. Slice i spans [arcs[i].start, arcs[i].end).
 *  - `rotation` is the CSS rotation applied to the wheel, clockwise-positive. A point at
 *    wheel-space angle θ appears on screen at θ + rotation.
 *  - Slices are sized by each option's BASE weight (`layoutSlices`), so a 7% option fills
 *    7% of the wheel. Locked options keep the room they would have had instead of
 *    collapsing into a 0° sliver. The live odds, bent by locks and threat, are shown in
 *    the tooltip and odds list.
 *  - The RNG never reads any of this. The engine has already picked a winner by effective
 *    weight; the geometry only works out where that winner's slice is drawn.
 */
import type { ResolvedSlice } from '../../engine/types';

/** Radii as fractions of the wheel radius. Shared by the painter and the DOM overlays. */
export const WHEEL_LAYOUT = {
  /** The static Spin button in the middle. */
  hub: 0.22,
  /** Labels sit between these two radii. */
  labelInner: 0.36,
  labelOuter: 0.67,
  /** Lead-line arc splitting each pane into inner and outer glass. */
  tracery: 0.71,
  /** Icon roundel: centre radius and the roundel's full-size radius. */
  roundel: 0.815,
  roundelRadius: 0.085,
  /** Where the glass ends and the stone rim begins. */
  glassEdge: 0.915,
} as const;

/** Roundels smaller than this many CSS pixels are left out: the icon would be a smudge. */
const MIN_ROUNDEL_PX = 8;
const DEG = Math.PI / 180;

/** One slice's place on the wheel, in wheel-space degrees. */
export interface SliceArc {
  start: number;
  /** Equals the next slice's start; the last slice ends at exactly 360. */
  end: number;
  /** end − start. 0 for a zero-weight option, which has no slice. */
  sweep: number;
  /** Angle of the slice's centre line. */
  center: number;
}

/** Euclidean modulo: always in [0, n). */
export function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}

/**
 * Lay slices out clockwise from 12 o'clock, each sized in proportion to its weight.
 * Negative and non-finite weights count as 0. If every weight is 0 the slices fall back
 * to equal sizes, so a wheel never draws as nothing.
 */
export function computeArcs(weights: readonly number[]): SliceArc[] {
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = clean.reduce((sum, w) => sum + w, 0);
  const shares = total > 0 ? clean.map((w) => w / total) : clean.map(() => 1 / clean.length);

  const arcs: SliceArc[] = [];
  let cursor = 0;
  shares.forEach((share, i) => {
    // The last slice closes the circle exactly, whatever rounding did along the way.
    const end = i === shares.length - 1 ? 360 : cursor + share * 360;
    arcs.push({ start: cursor, end, sweep: end - cursor, center: (cursor + end) / 2 });
    cursor = end;
  });
  return arcs;
}

/**
 * The visual layout for a wheel: every slice sized by its option's `baseWeight`,
 * never its effective weight. A locked option (effective weight 0) is drawn at the
 * size it would have had if it were open.
 */
export function layoutSlices(slices: readonly ResolvedSlice[]): SliceArc[] {
  return computeArcs(slices.map((s) => s.option.baseWeight));
}

/** Which slice contains a wheel-space angle. Zero-width slices are never hit. -1 for an empty wheel. */
export function sliceAtWheelAngle(angle: number, arcs: readonly SliceArc[]): number {
  const a = mod(angle, 360);
  let last = -1;
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]!;
    if (arc.sweep <= 0) continue;
    last = i;
    if (a < arc.end) return i;
  }
  return last;
}

/**
 * Which slice is at a given screen angle when the wheel is rotated by `rotation`.
 * Screen angle 0 is the pointer.
 */
export function sliceAtScreenAngle(screenAngle: number, rotation: number, arcs: readonly SliceArc[]): number {
  return sliceAtWheelAngle(screenAngle - rotation, arcs);
}

/** Which slice the pointer is on. */
export function sliceAtPointer(rotation: number, arcs: readonly SliceArc[]): number {
  return sliceAtScreenAngle(0, rotation, arcs);
}

/** Screen angle (clockwise from 12 o'clock) of a point relative to the wheel's centre. */
export function screenAngleOf(dx: number, dy: number): number {
  return mod((Math.atan2(dx, -dy) * 180) / Math.PI, 360);
}

export interface SpinTargetOptions {
  /** Whole turns before landing. More turns = more drama. */
  turns?: number;
  /**
   * Where inside the slice to stop, 0–1 (0.5 = dead centre). Kept `landingMargin`
   * degrees clear of both lead lines, so the result never looks like a tie.
   */
  offset?: number;
  /**
   * Stop just inside one lead line instead, `degrees` from it: a near miss on purpose. Wins over
   * `offset`. Never closer than 1.2° (so it never looks like a tie) nor past the slice's centre.
   */
  edge?: { side: 'start' | 'end'; degrees: number };
}

/**
 * How close to a lead line the pointer may stop, in degrees: 15% of the slice, but at
 * least 1.5° so thin slices don't land on the line. Capped at 40% of the slice so even
 * a sliver keeps a landing zone around its centre.
 */
export function landingMargin(sweep: number): number {
  return Math.min(sweep * 0.4, Math.max(sweep * 0.15, 1.5));
}

/**
 * The rotation that puts `arc` under the pointer, travelling clockwise from `from`
 * through at least `turns` full turns.
 *
 * This is how the wheel "animates to a pre-calculated result": the engine has already
 * picked the slice; this only works out where to stop.
 */
export function targetRotation(
  from: number,
  arc: SliceArc,
  { turns = 6, offset = 0.5, edge }: SpinTargetOptions = {},
): number {
  const margin = landingMargin(arc.sweep);
  const inset = edge && clamp(edge.degrees, 1.2, arc.sweep / 2);
  const landing =
    edge && inset !== undefined
      ? arc.start + (edge.side === 'start' ? inset : arc.sweep - inset)
      : arc.start + clamp(offset * arc.sweep, margin, arc.sweep - margin);
  const desired = mod(-landing, 360);
  const delta = mod(desired - mod(from, 360), 360);
  return from + turns * 360 + delta;
}

/**
 * Prize-wheel deceleration: quick release, then a long slow crawl so the last
 * few slices tick past one by one.
 */
export function spinEase(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) ** 4;
}

/**
 * Counts lead lines that have passed under the pointer. The pointer "ticks" whenever this
 * number changes. It only ever grows as the wheel turns clockwise, whatever the slice sizes.
 */
export function boundaryCount(rotation: number, arcs: readonly SliceArc[]): number {
  const turns = Math.floor(rotation / 360);
  const within = rotation - turns * 360;
  let passed = 0;
  for (const arc of arcs) {
    // The lead line at wheel angle `start` is under the pointer when rotation ≡ −start (mod 360).
    const at = mod(-arc.start, 360);
    if (at > 0 && at <= within) passed++;
  }
  return turns * arcs.length + passed;
}

/**
 * Radius in CSS pixels of a slice's icon roundel: full size when it fits, shrunk to sit
 * between the lead lines of a thin slice, and 0 when the slice is too thin for one.
 * The painter and the icon overlay both call this, so they always agree.
 */
export function roundelPx(sweep: number, radius: number): number {
  const toLeadLine = WHEEL_LAYOUT.roundel * Math.sin((Math.min(sweep, 180) / 2) * DEG);
  const r = Math.min(WHEEL_LAYOUT.roundelRadius, toLeadLine * 0.8) * radius;
  return r >= Math.max(MIN_ROUNDEL_PX, WHEEL_LAYOUT.roundelRadius * 0.45 * radius) ? r : 0;
}

/** Converts a wheel angle (clockwise from 12) to a canvas angle in radians (clockwise from 3 o'clock). */
export function toCanvasRadians(degrees: number): number {
  return (degrees - 90) * DEG;
}

/** Point on the wheel at a radius and wheel-space angle, relative to the centre (screen y points down). */
export function polar(radius: number, degrees: number): { x: number; y: number } {
  const rad = degrees * DEG;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The slice on the far side of the nearer lead line from where the pointer rests, and how
 * close the pointer came to it: as a share of the landed slice's sweep (0 = on the line,
 * 0.5 = dead centre), and in degrees. Zero-width slices are skipped. Null for a wheel of one slice.
 */
export function nearestNeighbour(rotation: number, arcs: readonly SliceArc[], landed: number): { index: number; margin: number; degrees: number } | null {
  const arc = arcs[landed];
  const live = arcs.flatMap((a, i) => (a.sweep > 0 ? [i] : []));
  if (!arc || arc.sweep <= 0 || live.length < 2) return null;
  const a = mod(-rotation, 360);
  const intoSlice = mod(a - arc.start, 360);
  const toStart = intoSlice;
  const toEnd = arc.sweep - intoSlice;
  const at = live.indexOf(landed);
  const index = toStart <= toEnd ? live[(at - 1 + live.length) % live.length]! : live[(at + 1) % live.length]!;
  const degrees = Math.max(0, Math.min(toStart, toEnd));
  return { index, margin: degrees / arc.sweep, degrees };
}

/** The slices on either side of `landed` (zero-width ones skipped): `start` across its first lead line, `end` across its last. */
export function neighboursOf(arcs: readonly SliceArc[], landed: number): { start: number; end: number } | null {
  const live = arcs.flatMap((a, i) => (a.sweep > 0 ? [i] : []));
  const at = live.indexOf(landed);
  if (at < 0 || live.length < 2) return null;
  return { start: live[(at - 1 + live.length) % live.length]!, end: live[(at + 1) % live.length]! };
}
