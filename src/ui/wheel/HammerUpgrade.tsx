/**
 * The hammer: a smith's hammer swings down on the rim beside the pointer, once per
 * position the result moves. Each blow throws sparks and a "+1" (or a "−1" when banked
 * bonuses knock the roll down); a break-through blow past the top of the ladder cracks
 * the glass with gold light and calls out "Ascension!".
 *
 * Timing comes from the caller: blow k lands at (k + impactAt) × stageMs, which is when
 * the wheel itself jolts to the next slice. Reduced motion keeps the labels, drops the swing.
 */
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { UpgradeEffectProps } from './upgradeEffects';

const GOLD = '#ffd76a';

/** A steady pseudo-random number in [0, 1) for spark `i`. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function HammerUpgrade({ size, hits, overflow, direction, stageMs, impactAt }: UpgradeEffectProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const R = size / 2;
  const seconds = stageMs / 1000;
  const up = direction > 0;
  // The blow lands on the rim just right of the pointer, at 12 o'clock.
  const impact = { x: R + R * 0.12, y: R * 0.06 };
  const hammer = R * 0.62; // length, head to the end of the handle

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
      {!reduceMotion && (
        // Pivots at the end of its handle, up and to the right; swings down onto the rim.
        <motion.div
          className="absolute"
          style={{
            left: impact.x - hammer * 0.13, // the head's centre comes down on the impact point
            top: impact.y - hammer * 0.12,
            width: hammer,
            height: hammer * 0.24,
            transformOrigin: '100% 50%',
          }}
          initial={{ rotate: 70, opacity: 0 }}
          animate={{ rotate: [70, 78, -4, 8, 70], opacity: [1, 1, 1, 1, 1] }}
          transition={{
            duration: seconds,
            times: [0, impactAt * 0.6, impactAt, impactAt + 0.12, 1],
            ease: 'easeInOut',
            repeat: hits - 1,
          }}
        >
          <HammerShape />
        </motion.div>
      )}

      {Array.from({ length: hits }, (_, k) => {
        const lands = (k + impactAt) * seconds;
        const breaking = overflow && k === hits - 1;
        const color = breaking ? GOLD : up ? '#ffe7a3' : '#ec7a62';
        return (
          <div key={k}>
            {/* Shockwave from the point of impact. */}
            <motion.span
              className="absolute rounded-full border-2"
              style={{ left: impact.x - 14, top: impact.y - 14, width: 28, height: 28, borderColor: color }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 3.2], opacity: [0.95, 0] }}
              transition={{ duration: 0.55, delay: lands, ease: 'easeOut' }}
            />
            {/* Sparks off the rim. */}
            {!reduceMotion &&
              Array.from({ length: 10 }, (_, i) => {
                const angle = Math.PI + (jitter(i + k * 10, 1) - 0.1) * Math.PI * 1.2; // mostly upward
                const distance = R * (0.18 + jitter(i + k * 10, 2) * 0.22);
                const dot = 2 + jitter(i + k * 10, 3) * 3;
                const spark: CSSProperties = {
                  left: impact.x - dot / 2,
                  top: impact.y - dot / 2,
                  width: dot,
                  height: dot,
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                };
                return (
                  <motion.span
                    key={i}
                    className="absolute rounded-full"
                    style={spark}
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: [1, 0] }}
                    transition={{ duration: 0.6, delay: lands, ease: 'easeOut' }}
                  />
                );
              })}
            {/* What the blow did. */}
            <motion.span
              className="font-display absolute font-semibold"
              style={{
                left: impact.x + R * 0.1,
                top: impact.y + R * 0.04,
                fontSize: Math.max(18, R * 0.13),
                color,
                textShadow: '0 2px 0 #0b0e16, 0 0 10px rgba(0, 0, 0, 0.6)',
              }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: [6, -4, -14, -22] }}
              transition={{ duration: 0.95, delay: lands, times: [0, 0.15, 0.7, 1] }}
            >
              {breaking ? '' : up ? '+1' : '−1'}
            </motion.span>
          </div>
        );
      })}

      {overflow && <BreakThrough size={size} at={(hits - 1 + impactAt) * seconds} />}
    </div>
  );
}

/** The last blow breaks past the top: cracks of gold light across the glass, and "Ascension!". */
function BreakThrough({ size, at }: { size: number; at: number }) {
  const R = size / 2;
  return (
    <>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(closest-side, rgba(255, 246, 214, 0.9), ${GOLD}88 40%, transparent 100%)` }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1.3, 1.5] }}
        transition={{ duration: 1, delay: at, ease: 'easeOut' }}
      />
      <motion.svg className="absolute inset-0" viewBox={`0 0 ${size} ${size}`} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, delay: at }}>
        {Array.from({ length: 7 }, (_, i) => {
          const angle = (i / 7) * Math.PI * 2 + jitter(i, 9);
          const mid = R * (0.45 + jitter(i, 10) * 0.2);
          const kink = angle + (jitter(i, 11) - 0.5) * 0.5;
          const d = `M ${R} ${R * 0.06} L ${R + Math.cos(kink) * mid} ${R + Math.sin(kink) * mid} L ${R + Math.cos(angle) * R * 0.95} ${R + Math.sin(angle) * R * 0.95}`;
          return <path key={i} d={d} fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${GOLD})` }} />;
        })}
      </motion.svg>
      <motion.p
        className="font-display absolute inset-x-0 text-center font-semibold"
        style={{ top: R * 0.62, fontSize: Math.max(24, R * 0.2), color: GOLD, textShadow: `0 2px 0 #0b0e16, 0 0 18px ${GOLD}` }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1] }}
        transition={{ duration: 1.6, delay: at, times: [0, 0.2, 0.75, 1] }}
      >
        Ascension!
      </motion.p>
    </>
  );
}

/** A smith's hammer, head on the left, handle running right to the pivot. */
function HammerShape() {
  return (
    <svg viewBox="0 0 100 24" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="hammer-head" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c7ccd8" />
          <stop offset="0.5" stopColor="#8a90a2" />
          <stop offset="1" stopColor="#4a4f5e" />
        </linearGradient>
        <linearGradient id="hammer-handle" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#b07a4a" />
          <stop offset="1" stopColor="#5a3a1e" />
        </linearGradient>
      </defs>
      <rect x="20" y="9" width="80" height="6" rx="3" fill="url(#hammer-handle)" stroke="#0b0e16" strokeWidth="1.5" />
      <rect x="84" y="7.5" width="14" height="9" rx="2" fill="#3a2614" stroke="#0b0e16" strokeWidth="1.2" />
      <rect x="0" y="0" width="26" height="24" rx="3" fill="url(#hammer-head)" stroke="#0b0e16" strokeWidth="2" />
      <rect x="2" y="2" width="22" height="4" rx="1.5" fill="#e3e6ee" opacity="0.55" />
      <rect x="22" y="3" width="6" height="18" rx="1.5" fill="#c9a24c" stroke="#0b0e16" strokeWidth="1.2" />
    </svg>
  );
}
