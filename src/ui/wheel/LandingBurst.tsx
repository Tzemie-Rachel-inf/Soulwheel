/**
 * The moment a rare-or-better slice lands: a ring of its rarity's light rolls out past the
 * rim and sparks fly. Epic adds sweeping rays; legendary and mythical add a flash and a
 * banner over the glass ("Legendary!"), and mythical sparks run through every colour.
 *
 * It sits over the wheel, never rotates, never takes a click, and plays once per landing
 * (remount it with a new key to play again). Reduced motion gets a still, fading glow.
 */
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RARITIES, type Rarity } from '../../engine/types';
import { RARITY_STYLES } from '../rarity';

const SPARKS: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 14, epic: 22, legendary: 32, mythical: 44 };

/** A steady pseudo-random number in [0, 1) for spark `i`, so every render agrees. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function LandingBurst({ rarity, size }: { rarity: Rarity; size: number }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { color, label } = RARITY_STYLES[rarity];
  const level = RARITIES.indexOf(rarity);
  const mythical = rarity === 'mythical';
  const R = size / 2;

  if (reduceMotion) {
    return (
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 0 4px ${color}, 0 0 40px 10px ${color}` }}
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.6 }}
      />
    );
  }

  const count = SPARKS[rarity];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      {/* Legendary and mythical: a flash of light from the centre. */}
      {level >= RARITIES.indexOf('legendary') && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(closest-side, rgba(255, 250, 235, 0.95), ${color}aa 45%, transparent 100%)` }}
          initial={{ scale: 0.3, opacity: 0.95 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}

      {/* Epic and up: rays sweeping round behind the light. */}
      {level >= RARITIES.indexOf('epic') && (
        <motion.div
          className="absolute -inset-[12%] rounded-full"
          style={{
            background: mythical
              ? 'repeating-conic-gradient(from 0deg, #ff7ad1 0deg 6deg, transparent 6deg 18deg, #7ad1ff 18deg 24deg, transparent 24deg 36deg, #ffe07a 36deg 42deg, transparent 42deg 54deg)'
              : `repeating-conic-gradient(from 0deg, ${color} 0deg 5deg, transparent 5deg 20deg)`,
            maskImage: 'radial-gradient(closest-side, transparent 30%, black 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 30%, black 55%, transparent 100%)',
            mixBlendMode: 'screen',
          }}
          initial={{ rotate: 0, opacity: 0 }}
          animate={{ rotate: 50, opacity: [0, 0.7, 0] }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        />
      )}

      {/* Every special landing: a ring of light rolling out past the rim. */}
      <motion.div
        className="absolute rounded-full border-4"
        style={{ borderColor: color, left: R - R * 0.3, top: R - R * 0.3, width: R * 0.6, height: R * 0.6, boxShadow: `0 0 24px ${color}` }}
        initial={{ scale: 1, opacity: 0.9 }}
        animate={{ scale: 4.2, opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />

      {/* Sparks flying out from the hub. */}
      {Array.from({ length: count }, (_, i) => {
        const angle = ((i + jitter(i, 1) * 0.6) / count) * Math.PI * 2;
        const distance = R * (0.75 + jitter(i, 2) * 0.55);
        const dot = 3 + jitter(i, 3) * 4;
        const spark: CSSProperties = {
          left: R - dot / 2,
          top: R - dot / 2,
          width: dot,
          height: dot,
          background: mythical ? `hsl(${(i / count) * 360} 95% 72%)` : color,
          boxShadow: `0 0 ${dot * 2}px ${mythical ? `hsl(${(i / count) * 360} 95% 72%)` : color}`,
        };
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={spark}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9 + jitter(i, 4) * 0.6, ease: 'easeOut', delay: jitter(i, 5) * 0.15 }}
          />
        );
      })}

      {/* Epic and up: the tier, over the glass. */}
      {level >= RARITIES.indexOf('epic') && (
        <motion.p
          className="font-display absolute inset-x-0 text-center font-semibold"
          style={{ top: R * 0.36, fontSize: Math.max(22, R * 0.2), color, textShadow: `0 2px 0 #0b0e16, 0 0 18px ${color}` }}
          initial={{ opacity: 0, scale: 0.6, y: 10 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.12, 1, 1], y: [10, 0, 0, -6] }}
          transition={{ duration: 2.2, times: [0, 0.18, 0.75, 1], ease: 'easeOut' }}
        >
          {label}!
        </motion.p>
      )}
    </div>
  );
}
