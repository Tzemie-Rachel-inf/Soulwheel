/**
 * Sharing a legend: as text for the clipboard, or as a card image (PNG) to save. Both are
 * built from the same pieces as the epitaph (legend.ts), so a share always matches the stone.
 */
import { fameStanding } from '../engine/fame';
import { calculatePowerRating } from '../engine/power';
import type { Character, GameConfig } from '../engine/types';
import { fullName } from './format';
import { howItEnded, signatureTrait, whoTheyWere } from './legend';

/** How their story stands: ended, or still being written. */
function standing(char: Character, config: GameConfig): string {
  const end = howItEnded(char, config);
  if (end) return `${end}.`;
  const n = char.adventures.length;
  return n === 0 ? 'Their story has not begun.' : `Still on the road after ${n} adventure${n === 1 ? '' : 's'}.`;
}

/** The lines of a shared legend, top to bottom. */
export function legendLines(char: Character, config: GameConfig): { name: string; lines: string[] } {
  const tier = fameStanding(config.fame.tiers, char.fame).tier.name;
  const signature = signatureTrait(char);
  const n = char.adventures.length;
  return {
    name: fullName(char, config),
    lines: [
      whoTheyWere(char, config),
      `${tier} · ${calculatePowerRating(char)} Combat Power · ${n} adventure${n === 1 ? '' : 's'}`,
      ...(signature ? [`Remembered for ${signature.name}${signature.rank ? ` (${signature.rank})` : ''}`] : []),
      standing(char, config),
    ],
  };
}

export function legendText(char: Character, config: GameConfig): string {
  const { name, lines } = legendLines(char, config);
  return [name, ...lines, '— rolled on Soulwheel'].join('\n');
}

/** Copies the legend; false if the clipboard is unavailable or refused. */
export async function copyLegend(char: Character, config: GameConfig): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(legendText(char, config));
    return true;
  } catch {
    return false;
  }
}

const CARD = { w: 1200, h: 630 };

/** Wraps text to a width, at most `max` lines (the last one ellipsed if it had to be cut). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = `${kept[max - 1]!.replace(/\s+\S*$/, '')}…`;
    return kept;
  }
  return lines;
}

/** Paints the card: a slab of night-blue stone, gilt lead, the name in the display face. */
export async function legendImage(char: Character, config: GameConfig): Promise<Blob | null> {
  try {
    await document.fonts.ready;
  } catch {
    // Paint in whatever face is there.
  }
  const canvas = document.createElement('canvas');
  canvas.width = CARD.w;
  canvas.height = CARD.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const nave = token('--color-nave', '#1b2033');
  const slab = token('--color-slab', '#232a3e');
  const lead = token('--color-lead', '#0b0e16');
  const gilt = token('--color-gilt', '#c9a24c');
  const candle = token('--color-candle', '#f1d9a6');
  const vellum = token('--color-vellum', '#dcd6c9');
  const ash = token('--color-ash', '#9298ad');
  const display = '"IM Fell English SC", Georgia, serif';
  const sans = '"Alegreya", Georgia, serif';

  ctx.fillStyle = nave;
  ctx.fillRect(0, 0, CARD.w, CARD.h);
  const glow = ctx.createRadialGradient(360, 220, 0, 360, 220, 700);
  glow.addColorStop(0, 'rgba(201, 162, 76, 0.18)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  // The slab, its lead border and a gilt inner rule.
  ctx.fillStyle = slab;
  ctx.fillRect(40, 40, CARD.w - 80, CARD.h - 80);
  ctx.lineWidth = 6;
  ctx.strokeStyle = lead;
  ctx.strokeRect(40, 40, CARD.w - 80, CARD.h - 80);
  ctx.lineWidth = 2;
  ctx.strokeStyle = gilt;
  ctx.strokeRect(58, 58, CARD.w - 116, CARD.h - 116);

  const { name, lines } = legendLines(char, config);
  const [who, stats, ...rest] = lines;
  const x = 100;
  const width = CARD.w - 200;
  let y = 165;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = candle;
  ctx.font = `76px ${display}`;
  for (const l of wrap(ctx, name, width, 2)) {
    ctx.fillText(l, x, y);
    y += 78;
  }
  y += 4;
  ctx.fillStyle = gilt;
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(who ?? '', x, y);
  y += 48;
  ctx.fillStyle = ash;
  ctx.font = `28px ${sans}`;
  ctx.fillText(stats ?? '', x, y);
  y += 58;
  ctx.fillStyle = vellum;
  ctx.font = `32px ${sans}`;
  for (const text of rest) {
    for (const l of wrap(ctx, text, width, 2)) {
      if (y > CARD.h - 110) break;
      ctx.fillText(l, x, y);
      y += 42;
    }
    y += 6;
  }

  ctx.fillStyle = gilt;
  ctx.font = `30px ${display}`;
  ctx.textAlign = 'right';
  ctx.fillText('Soulwheel', CARD.w - 100, CARD.h - 86);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Saves the card image under the character's name. */
export async function saveLegendImage(char: Character, config: GameConfig): Promise<boolean> {
  const blob = await legendImage(char, config);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${char.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'legend'}-soulwheel.png`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
