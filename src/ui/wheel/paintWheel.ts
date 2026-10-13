/**
 * Paints the static wheel face: a rose window of stained-glass panes.
 *
 * The canvas is painted once per change (slices, size, highlight, fonts), never per
 * frame. Spinning is a CSS rotation of the finished canvas, which keeps the animation
 * on the GPU and the painter simple.
 *
 * Panes are sized by the arcs it is given (`layoutSlices`: base weight, so 7% of the
 * odds is 7% of the glass). Locked slices are painted as boarded-up grey glass at the
 * size they would have had, so they never vanish into a 0° sliver.
 *
 * Rarity shows as a band of coloured enamel set into the gilt rim over each uncommon-or-better
 * pane, glowing for rare and above. The animated sparkle and pulse sit in a DOM overlay.
 */
import { createSeededRng } from '../../engine/rng';
import type { ResolvedSlice } from '../../engine/types';
import { RARITY_STYLES, isSpecialRarity, rarityOf } from '../rarity';
import { darken, inkFor, lighten, mix, withAlpha } from './color';
import { WHEEL_LAYOUT as L, roundelPx, toCanvasRadians, type SliceArc } from './wheelGeometry';

export interface PaintWheelOptions {
  /** Width and height in CSS pixels. */
  size: number;
  /** devicePixelRatio, for crisp lines on high-density screens. */
  dpr: number;
  slices: readonly ResolvedSlice[];
  /** Where each slice sits, from `layoutSlices`. Same length and order as `slices`. */
  arcs: readonly SliceArc[];
  /** The winning slice, lit up after the wheel lands. Others dim. */
  highlightIndex: number | null;
  fontFamily: string;
}

export const LEAD = '#1e1206';
export const LOCKED_GLASS = '#4a3c33';
const RIM_GOLD = '#f2d27a';
const RIM_DEEP = '#7a561a';
const GILT = '#f0cd6c';
const FALLBACK_GLASS = '#64748b';
const DIM = 'rgba(20, 8, 8, 0.6)';
const DEG = Math.PI / 180;

/** Glass colour for a slice: its config colour, or boarded-up grey when locked. */
export function glassColor(slice: ResolvedSlice): string {
  return slice.locked ? LOCKED_GLASS : (slice.option.color ?? FALLBACK_GLASS);
}

export function paintWheel(ctx: CanvasRenderingContext2D, opts: PaintWheelOptions): void {
  const { size, dpr, slices, arcs, highlightIndex, fontFamily } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (slices.length === 0) return;

  const c = size / 2;
  const R = size / 2 - 1;
  const lead = Math.max(2.5, R * 0.02);
  const isDimmed = (i: number) => highlightIndex !== null && highlightIndex !== i;
  // Zero-weight options have no pane; everything below skips them.
  const panes = slices.flatMap((slice, i) => {
    const arc = arcs[i];
    return arc && arc.sweep > 0 ? [{ slice, arc, i }] : [];
  });

  // 1. Gilded rim: a rounded moulding, bright along its crest.
  const rim = ctx.createRadialGradient(c, c, R * L.glassEdge, c, c, R);
  rim.addColorStop(0, RIM_DEEP);
  rim.addColorStop(0.4, RIM_GOLD);
  rim.addColorStop(0.62, '#c99a3a');
  rim.addColorStop(1, RIM_DEEP);
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  // 2. Glass panes.
  for (const { slice, arc, i } of panes) {
    const start = toCanvasRadians(arc.start);
    const end = toCanvasRadians(arc.end);
    const glass = glassColor(slice);

    ctx.save();
    wedgePath(ctx, c, R * L.glassEdge, start, end);
    ctx.clip();

    // Backlit glass: bright near the hub, deeper toward the rim.
    const fill = ctx.createRadialGradient(c, c, R * L.hub, c, c, R * L.glassEdge);
    fill.addColorStop(0, lighten(glass, slice.locked ? 0.08 : 0.38));
    fill.addColorStop(0.55, glass);
    fill.addColorStop(1, darken(glass, 0.38));
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);

    // The outer pane, beyond the tracery arc, is a slightly different pour of glass.
    ctx.beginPath();
    ctx.arc(c, c, R * L.glassEdge, 0, Math.PI * 2);
    ctx.arc(c, c, R * L.tracery, 0, Math.PI * 2, true);
    ctx.fillStyle = withAlpha(darken(glass, 0.5), 0.22);
    ctx.fill();

    // Uneven glass: a seeded speckle so every redraw looks identical. Density follows pane size.
    const rng = createSeededRng(i * 7919 + slices.length);
    const specks = Math.max(6, Math.round(arc.sweep * 0.78));
    for (let s = 0; s < specks; s++) {
      const r = R * (L.hub + rng() * (L.glassEdge - L.hub));
      const t = start + rng() * (end - start);
      ctx.beginPath();
      ctx.arc(c + r * Math.cos(t), c + r * Math.sin(t), 0.6 + rng() * R * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
      ctx.fill();
    }

    // Locked: boarded up with diagonal slats.
    if (slice.locked) {
      ctx.strokeStyle = 'rgba(20, 10, 6, 0.4)';
      ctx.lineWidth = Math.max(1, R * 0.008);
      const step = Math.max(6, R * 0.045);
      for (let x = -size; x < size * 2; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + size, size);
        ctx.stroke();
      }
    }

    // After landing, everything but the winner sinks into shadow.
    if (isDimmed(i)) {
      ctx.fillStyle = DIM;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();
  }

  // 3. Rarity: coloured enamel set into the gilt rim. Rare and above glow, bleeding light into the glass edge.
  for (const { slice, arc, i } of panes) {
    const rarity = rarityOf(slice.option);
    if (rarity === 'common') continue;
    const { color } = RARITY_STYLES[rarity];
    const special = isSpecialRarity(rarity) && !slice.locked;
    const start = toCanvasRadians(arc.start);
    const end = toCanvasRadians(arc.end);

    // Uncommon is a faint tint in the stone; rare and above are bright gems, so they stand out.
    const band = ctx.createRadialGradient(c, c, R * L.glassEdge, c, c, R);
    band.addColorStop(0, special ? darken(color, 0.5) : mix(color, RIM_DEEP, 0.75));
    band.addColorStop(0.45, special ? lighten(color, 0.1) : mix(color, RIM_GOLD, 0.72));
    band.addColorStop(1, special ? darken(color, 0.6) : mix(color, RIM_DEEP, 0.8));

    ctx.save();
    wedgePath(ctx, c, R, start, end, R * L.glassEdge);
    ctx.fillStyle = band;
    if (special && !isDimmed(i)) {
      ctx.shadowColor = withAlpha(color, 0.85);
      ctx.shadowBlur = R * 0.045;
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (slice.locked || isDimmed(i)) {
      ctx.fillStyle = DIM;
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Lead came: one spoke per boundary, then the tracery arc, glass edge and hub ring.
  ctx.strokeStyle = LEAD;
  ctx.lineCap = 'round';
  ctx.lineWidth = lead;
  for (const { arc } of panes) {
    const t = toCanvasRadians(arc.start);
    ctx.beginPath();
    ctx.moveTo(c + R * L.hub * Math.cos(t), c + R * L.hub * Math.sin(t));
    ctx.lineTo(c + R * L.glassEdge * Math.cos(t), c + R * L.glassEdge * Math.sin(t));
    ctx.stroke();
  }
  for (const radius of [L.tracery, L.glassEdge, L.hub]) {
    ctx.beginPath();
    ctx.arc(c, c, R * radius, 0, Math.PI * 2);
    ctx.lineWidth = radius === L.glassEdge ? lead * 1.4 : lead * 0.8;
    ctx.stroke();
  }

  // 5. Icon roundels, shrunk to fit thin panes or left out of slivers. (The icons
  //    themselves are DOM overlays, so they stay crisp Lucide SVGs.)
  for (const { slice, arc, i } of panes) {
    const rr = roundelPx(arc.sweep, R);
    if (rr === 0) continue;
    const t = toCanvasRadians(arc.center);
    const x = c + R * L.roundel * Math.cos(t);
    const y = c + R * L.roundel * Math.sin(t);
    const glass = glassColor(slice);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, lighten(glass, slice.locked ? 0.12 : 0.5));
    g.addColorStop(1, glass);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    if (isDimmed(i)) {
      ctx.fillStyle = DIM;
      ctx.fill();
    }
    ctx.lineWidth = lead * 0.8;
    ctx.strokeStyle = LEAD;
    ctx.stroke();
  }

  // 6. Labels. Across the pane when there's room (the slice under the pointer reads
  //    upright); along the centre line for panes too thin to write across. Just the
  //    name: a stat roll's number is shown in the tooltip, odds list and reveal instead.
  for (const { slice, arc, i } of panes) {
    const plan = planLabel(ctx, slice.option.label, arc, R, roundelPx(arc.sweep, R), lead, fontFamily);
    if (!plan) continue; // too thin to label at a legible size: the tooltip and odds list carry it

    const glass = glassColor(slice);
    const dimmed = isDimmed(i);
    const { ink, halo } = inkFor(dimmed ? mix(glass, '#140808', 0.6) : glass);

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(arc.center * DEG);
    ctx.font = `700 ${plan.fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, plan.fontSize * 0.22);
    ctx.globalAlpha = slice.locked ? 0.62 : dimmed ? 0.55 : 1;

    const draw = (text: string, x: number, y: number) => {
      ctx.strokeStyle = halo;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = ink;
      ctx.fillText(text, x, y);
    };
    if (plan.kind === 'across') {
      const midRadius = (R * (L.labelInner + L.labelOuter)) / 2;
      const lineHeight = plan.fontSize * 1.08;
      plan.lines.forEach((line, k) => draw(line, 0, -midRadius - ((plan.lines.length - 1) / 2 - k) * lineHeight));
    } else {
      ctx.rotate(-Math.PI / 2); // +x now runs outward along the centre line
      draw(plan.text, plan.at, 0);
    }
    ctx.restore();
  }

  // 7. The winner gets a gilt border along its lead lines.
  const won = highlightIndex !== null ? arcs[highlightIndex] : undefined;
  if (won && won.sweep > 0) {
    ctx.save();
    wedgePath(ctx, c, R * L.glassEdge, toCanvasRadians(won.start), toCanvasRadians(won.end), R * L.hub);
    ctx.lineWidth = lead * 0.75;
    ctx.strokeStyle = GILT;
    ctx.lineJoin = 'round';
    ctx.shadowColor = withAlpha(GILT, 0.8);
    ctx.shadowBlur = R * 0.05;
    ctx.stroke();
    ctx.restore();
  }

  // 8. Gilt studs on the rim, one per spoke.
  for (const { arc } of panes) {
    const t = toCanvasRadians(arc.start);
    const r = R * ((L.glassEdge + 1) / 2);
    const x = c + r * Math.cos(t);
    const y = c + r * Math.sin(t);
    const stud = ctx.createRadialGradient(x - R * 0.006, y - R * 0.006, 0, x, y, R * 0.022);
    stud.addColorStop(0, '#fff3c4');
    stud.addColorStop(0.5, '#d2a542');
    stud.addColorStop(1, '#5c4320');
    ctx.beginPath();
    ctx.arc(x, y, R * 0.019, 0, Math.PI * 2);
    ctx.fillStyle = stud;
    ctx.fill();
  }
}

/** A pie wedge (or an annular wedge when `inner` is given). */
function wedgePath(
  ctx: CanvasRenderingContext2D,
  c: number,
  outer: number,
  start: number,
  end: number,
  inner = 0,
): void {
  ctx.beginPath();
  ctx.arc(c, c, outer, start, end);
  if (inner > 0) ctx.arc(c, c, inner, end, start, true);
  else ctx.lineTo(c, c);
  ctx.closePath();
}

// ─── Labels ─────────────────────────────────────────────────────────────────

type LabelPlan =
  | { kind: 'across'; lines: string[]; fontSize: number }
  /** `at` is the distance from the centre to the middle of the text, in px. */
  | { kind: 'along'; text: string; fontSize: number; at: number };

const MIN_FONT = 9;
const largestFont = (R: number) => Math.min(17, Math.max(11, R * 0.068));

/**
 * Choose how to set a label. Labels are measured before drawing and never clipped:
 * across the pane if it fits at a comfortable size, otherwise along the centre line
 * if that reads larger, otherwise a squeezed version across, otherwise nothing.
 */
function planLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  arc: SliceArc,
  R: number,
  roundel: number,
  lead: number,
  fontFamily: string,
): LabelPlan | null {
  const half = (Math.min(arc.sweep, 180) / 2) * DEG;
  const chord = 2 * R * L.labelInner * Math.sin(half);
  const maxWidth = Math.min(chord * 0.92, R * 0.56);
  const maxSpan = R * (L.labelOuter - L.labelInner);

  const across = fitAcross(ctx, text, maxWidth, maxSpan, R, fontFamily);
  if (across && across.fontSize >= 11) return across;

  const along = fitAlong(ctx, text, half, R, roundel, lead, fontFamily);
  if (along && (!across || along.fontSize > across.fontSize)) return along;

  return across ?? squeezeAcross(ctx, text, maxWidth, fontFamily);
}

/** Up to two lines across the pane, shrinking the font until it fits. Null if nothing fits. */
function fitAcross(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSpan: number,
  R: number,
  fontFamily: string,
): LabelPlan | null {
  for (let size = largestFont(R); size >= MIN_FONT; size -= 0.5) {
    ctx.font = `700 ${size}px ${fontFamily}`;
    const lines = wrap(ctx, text, maxWidth);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (fits && lines.length <= 2 && lines.length * size * 1.08 <= maxSpan) return { kind: 'across', lines, fontSize: size };
  }
  return null;
}

/**
 * One line along the pane's centre line, reading outward. The text is pushed as far
 * out as it can go (toward the roundel, or the rim when there is none), where a thin
 * pane is widest; it must start clear of the hub and stay between the lead lines.
 */
function fitAlong(
  ctx: CanvasRenderingContext2D,
  text: string,
  half: number,
  R: number,
  roundel: number,
  lead: number,
  fontFamily: string,
): LabelPlan | null {
  const inner = R * (L.hub + 0.06);
  const outer = roundel > 0 ? R * L.roundel - roundel - lead : R * L.glassEdge - lead * 1.5;
  for (let size = largestFont(R); size >= MIN_FONT; size -= 0.5) {
    ctx.font = `700 ${size}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    const start = outer - width;
    if (start < inner) continue;
    // Half the pane's width at the text's inner end, minus half a lead line, must hold half the text.
    const room = 2 * start * Math.tan(half) - lead;
    if (room >= size * 0.95) return { kind: 'along', text, fontSize: size, at: start + width / 2 };
  }
  return null;
}

/** Last resort across: two lines at the smallest size, the second ended with an ellipsis. Null if even that overflows. */
function squeezeAcross(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontFamily: string): LabelPlan | null {
  ctx.font = `700 ${MIN_FONT}px ${fontFamily}`;
  const lines = wrap(ctx, text, maxWidth).slice(0, 2);
  let last = lines[1] ?? '';
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  if (lines.length === 2) lines[1] = `${last}…`;
  return lines.every((l) => ctx.measureText(l).width <= maxWidth) ? { kind: 'across', lines, fontSize: MIN_FONT } : null;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(attempt).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return balance(ctx, lines, maxWidth);
}

/** "Chosen of the Holy / Sword" reads worse than "Chosen of the / Holy Sword": even out two lines. */
function balance(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number): string[] {
  if (lines.length !== 2) return lines;
  const words = lines.join(' ').split(' ');
  let best = lines;
  let bestDiff = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ');
    const b = words.slice(k).join(' ');
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    if (wa > maxWidth || wb > maxWidth) continue;
    const diff = Math.abs(wa - wb);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [a, b];
    }
  }
  return best;
}
