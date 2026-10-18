/**
 * The spinning rose window.
 *
 * It never decides anything. The engine has already picked the winner
 * (`spin.targetIndex`); this component works out a stopping angle inside that slice
 * and animates there, with a requestAnimationFrame loop that also drives the pointer tick.
 *
 * Slices are sized by base weight (`layoutSlices`), so locked options keep their room.
 * The tooltip reports the live odds the engine will actually roll with.
 *
 * Layers, back to front:
 *   rotor   – the painted canvas, Lucide icons and rarity sparkle; the only thing that rotates
 *   sheen   – a static highlight, so the glass turns under fixed "daylight"
 *   hub     – the Spin button, which stays still
 *   pointer – gilt finial at 12 o'clock that flicks as each lead line passes
 *   burst   – when a rare-or-better slice lands, light and sparks over everything (LandingBurst)
 *   bump    – after landing, banked bonuses knock the result along the ladder: an effect
 *             (upgradeEffects.ts, the hammer for now) plays, and the wheel jolts a slice per blow
 *   near    – "So close!" when the pointer stopped near the line of a far rarer slice
 *
 * Sound (sound.ts) follows the same beats: a tick per lead line, a sting on landing by rarity,
 * a clang per blow.
 *
 * Archetypes (engine/archetypes.ts) reach in three ways, all optional:
 *   smash   – a Brute's hub turns into a Smash button while the wheel spins: it stops dead, and
 *             the slice under the pointer is reported (`onSmash`) as the roll
 *   decree  – an Ancient names the result: while `decreeing`, a click on a slice is reported (`onDecree`)
 *   drag    – a Hero's wheel slows as holy slices (`drag`) pass the pointer. The result was decided
 *             before the spin; only the time spent over them grows.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { forceNextRoll } from '../../engine/roll';
import { createSeededRng } from '../../engine/rng';
import { useDevPick } from '../devPick';
import { spinDuration, useSettings } from '../settings';
import { RARITIES, type ResolvedSlice } from '../../engine/types';
import { formatPercent, optionLabel } from '../format';
import { sound } from '../sound';
import { getOptionIcon } from '../icons';
import { RARITY_STYLES, isSpecialRarity, rarityOf, rarityStyle } from '../rarity';
import { inkFor } from './color';
import { LandingBurst } from './LandingBurst';
import { upgradeEffect } from './upgradeEffects';
import { glassColor, paintWheel } from './paintWheel';
import {
  WHEEL_LAYOUT as L,
  boundaryCount,
  layoutSlices,
  nearestNeighbour,
  neighboursOf,
  polar,
  roundelPx,
  screenAngleOf,
  sliceAtScreenAngle,
  spinEase,
  targetRotation,
  type SliceArc,
} from './wheelGeometry';

export interface SpinRequest {
  /** Changes for every spin. */
  id: number;
  /** The slice the engine picked. */
  targetIndex: number;
}

/** A ladder bump to play after landing: banked bonuses moving the result (see engine/ladder.ts). */
export interface UpgradeRequest {
  /** Changes for every bump. */
  id: number;
  /** The slices the result moves through, one per blow, ending where it stays. */
  path: number[];
  /** One more blow that breaks past the top of the ladder (into Ascension). */
  overflow: boolean;
  /** 1: up. −1: knocked down. */
  direction: 1 | -1;
  /** Which effect plays it (upgradeEffects.ts); the hammer when unset or unknown. */
  effect?: string;
}

export interface SpinWheelProps {
  slices: readonly ResolvedSlice[];
  /** Set to start a spin. Must keep the same identity until the next spin. */
  spin: SpinRequest | null;
  /** Lit up after landing; every other slice dims. */
  highlightIndex: number | null;
  canSpin: boolean;
  onSpinRequest: () => void;
  /** Called once the wheel has come to rest on the target. */
  onSettled: (spinId: number) => void;
  /** Set after landing to play a ladder bump; the wheel jolts along `path` as each blow lands. */
  upgrade?: UpgradeRequest | null;
  /** Called once the bump has played. */
  onUpgraded?: (upgradeId: number) => void;
  /** Accessible name for the wheel, e.g. its title. */
  label: string;
  hubLabel?: string;
  /** How long a spin takes. Defaults to the full 5.2 s; the dev tools speed it up. */
  spinMs?: number;
  /** A golden wheel (an ascension): a gilt ring and glow around the glass. */
  golden?: boolean;
  maxSize?: number;
  fontFamily?: string;
  /** A Brute's Smash: while spinning, the hub stops the wheel dead and reports the slice under the pointer. */
  onSmash?: (spinId: number, index: number) => void;
  /** An Ancient deciding a roll: a click on an open slice is reported instead of spinning. */
  decreeing?: boolean;
  onDecree?: (index: number) => void;
  /** Slices the wheel drags over as they pass the pointer (a Hero's holy slices), by index. */
  drag?: readonly number[];
}

/** How fast a spin runs while a dragging slice is under the pointer: under half speed. */
const DRAG_RATE = 0.4;

/**
 * How near the line still counts as a near miss: within this many degrees of it, and in the outer
 * third of the landed slice (so a sliver's centre never counts).
 */
const NEAR_MISS_DEGREES = 4;
const NEAR_MISS_MARGIN = 0.34;
/** When a big prize sits right beside the result, how often the wheel stops a hair short of it. */
const TEASE_CHANCE = 0.07;
/** Dramatic speed: a spin for something great (or past it) takes this much longer, and teases more. */
const DRAMA_STRETCH = 1.8;
const DRAMA_TEASE_CHANCE = 0.45;
/** Dramatic speed's ease: most of the way fast, then a long, agonising crawl. */
const dramaEase = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 7;

/** Worth an "So close!": a slice that is open, rarer than the one landed, and legendary or better (or epic, after a common). */
function missedBig(won: ResolvedSlice, other: ResolvedSlice): boolean {
  const w = RARITIES.indexOf(rarityOf(won.option));
  const o = RARITIES.indexOf(rarityOf(other.option));
  return !other.locked && o > w && (o >= RARITIES.indexOf('legendary') || (o >= RARITIES.indexOf('epic') && w <= RARITIES.indexOf('uncommon')));
}

const SPIN_MS = 5200;
const REDUCED_SPIN_MS = 900;
const DEFAULT_FONT = '"Alegreya SC", "Alegreya", Georgia, serif';

export function SpinWheel({
  slices,
  spin,
  highlightIndex,
  canSpin,
  onSpinRequest,
  onSettled,
  upgrade = null,
  onUpgraded,
  label,
  hubLabel = 'Spin',
  spinMs = SPIN_MS,
  golden = false,
  maxSize = 560,
  fontFamily = DEFAULT_FONT,
  onSmash,
  decreeing = false,
  onDecree,
  drag,
}: SpinWheelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<SVGSVGElement>(null);
  const marqueeRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const spinningRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  const onUpgradedRef = useRef(onUpgraded);
  const onSmashRef = useRef(onSmash);
  /** The frame loop of the spin under way, so a Smash can stop it. */
  const rafRef = useRef(0);
  /** Set by a Smash: the spin under way stops where it is and never settles. */
  const smashedRef = useRef(false);
  const dragRef = useRef<ReadonlySet<number>>(new Set());
  const reduceMotion = useReducedMotion() ?? false;
  const { wheelSpeed } = useSettings();
  /** The last spin a Smash stopped: the wheel shakes. */
  const [smashed, setSmashed] = useState<number | null>(null);

  const [size, setSize] = useState(0);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [spinning, setSpinning] = useState(false);
  /** The last spin that came to rest: a new value replays the landing effects. */
  const [landedSpin, setLandedSpin] = useState(0);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const devPick = useDevPick();
  /** A far rarer slice the last spin stopped beside. */
  const [nearMiss, setNearMiss] = useState<{ spin: number; index: number; slice: ResolvedSlice } | null>(null);
  /** Where the current bump has knocked the result so far. */
  const [bumpedTo, setBumpedTo] = useState<{ id: number; index: number } | null>(null);
  // While a bump plays, the lit slice follows the blows; otherwise it's the caller's.
  const lit = upgrade && bumpedTo?.id === upgrade.id ? bumpedTo.index : highlightIndex;

  // Sized by base weight: the engine's effective weights never reach the geometry.
  const arcs = useMemo(() => layoutSlices(slices), [slices]);
  const arcsRef = useRef(arcs);
  const slicesRef = useRef(slices);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);
  useEffect(() => {
    onUpgradedRef.current = onUpgraded;
  }, [onUpgraded]);
  useEffect(() => {
    onSmashRef.current = onSmash;
  }, [onSmash]);
  useEffect(() => {
    dragRef.current = new Set(drag ?? []);
  }, [drag]);
  useEffect(() => {
    arcsRef.current = arcs;
    slicesRef.current = slices;
  }, [arcs, slices]);

  // Size to the container, capped.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setSize(Math.floor(Math.min(el.clientWidth, maxSize)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxSize]);

  // Repaint once web fonts arrive, so labels are measured in the real face.
  useEffect(() => {
    let alive = true;
    const bump = () => {
      if (alive) setFontEpoch((n) => n + 1);
    };
    void document.fonts.ready.then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => {
      alive = false;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);

  // Paint the static face whenever what it shows changes. Never per frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) paintWheel(ctx, { size, dpr, slices, arcs, highlightIndex: lit, fontFamily });
  }, [size, slices, arcs, lit, fontFamily, fontEpoch]);

  const applyRotation = useCallback((degrees: number) => {
    rotationRef.current = degrees;
    if (rotorRef.current) rotorRef.current.style.transform = `rotate(${degrees}deg)`;
  }, []);

  // Each new wheel starts with its first slice centred under the pointer, never on a lead line.
  // A landed wheel keeps its resting angle until a different wheel (or different slice sizes) replaces it.
  const wheelKey = slices.map((s) => `${s.option.id}:${s.option.baseWeight}`).join('|');
  const mounted = size > 0;
  useLayoutEffect(() => {
    const first = arcsRef.current.find((a) => a.sweep > 0);
    if (!mounted || spinningRef.current || !first) return;
    applyRotation(Math.round(rotationRef.current / 360) * 360 - first.center);
  }, [wheelKey, mounted, applyRotation]);

  // The spin itself: ease from the current angle to a pre-calculated stop.
  useEffect(() => {
    if (!spin) return;
    const layout = arcsRef.current;
    const arc = layout[spin.targetIndex];
    if (!arc) {
      onSettledRef.current(spin.id); // nothing to animate to; never leave the session hanging
      return;
    }
    const from = rotationRef.current;
    // Now and then, when a big prize is right next door, stop a hair short of it: a real near miss.
    const landed = slicesRef.current[spin.targetIndex];
    const sides = neighboursOf(layout, spin.targetIndex);
    const prizes = landed && sides ? (['start', 'end'] as const).filter((side) => { const other = slicesRef.current[sides[side]]; return other && missedBig(landed, other); }) : [];
    // Dramatic: landing on something great, or right beside it, slows the end to a crawl.
    const drama = wheelSpeed === 'dramatic' && !reduceMotion && (prizes.length > 0 || (landed !== undefined && RARITIES.indexOf(rarityOf(landed.option)) >= RARITIES.indexOf('epic')));
    const base = spinDuration(spinMs, wheelSpeed);
    const duration = Math.max(1, reduceMotion ? Math.min(REDUCED_SPIN_MS, base) : drama ? base * DRAMA_STRETCH : base);
    const ease = drama ? dramaEase : spinEase;
    const tease = prizes.length > 0 && Math.random() < (drama ? DRAMA_TEASE_CHANCE : TEASE_CHANCE) ? prizes[Math.floor(Math.random() * prizes.length)] : undefined;
    const to = targetRotation(from, arc, {
      turns: reduceMotion ? 1 : 5 + Math.floor(Math.random() * 3),
      offset: 0.2 + Math.random() * 0.6, // land somewhere inside the slice, never on a lead line
      ...(tease && { edge: { side: tease, degrees: 1.5 + Math.random() * 2.5 } }),
    });

    // Time runs slower while a dragging slice is under the pointer (a Hero's holy slices).
    let elapsed = 0;
    let lastFrame: number | null = null;
    let lastBoundary = boundaryCount(from, layout);
    let tickAt = Number.NEGATIVE_INFINITY;
    spinningRef.current = true;
    smashedRef.current = false;
    setSpinning(true);
    setHover(null);
    setNearMiss(null);

    const frame = (now: number) => {
      if (smashedRef.current) return;
      const dt = lastFrame === null ? 0 : now - lastFrame;
      lastFrame = now;
      const dragging = dragRef.current.size > 0 && dragRef.current.has(sliceAtScreenAngle(0, rotationRef.current, layout));
      elapsed += dragging && !reduceMotion ? dt * DRAG_RATE : dt;
      const t = elapsed / duration;
      const rotation = from + (to - from) * ease(t);
      applyRotation(rotation);

      const boundary = boundaryCount(rotation, layout);
      if (boundary !== lastBoundary) {
        lastBoundary = boundary;
        tickAt = now;
        sound.tick(Math.max(0, 1 - t));
        // The marquee chases one step per lead line: fast off the mark, crawling at the end.
        const marquee = marqueeRef.current;
        if (marquee) marquee.dataset.phase = marquee.dataset.phase === '0' ? '1' : '0';
      }
      if (pointerRef.current) {
        const kick = Math.exp(-(now - tickAt) / 90);
        pointerRef.current.style.transform = `rotate(${(-22 * kick).toFixed(2)}deg)`;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      applyRotation(to);
      if (pointerRef.current) pointerRef.current.style.transform = 'rotate(0deg)';
      spinningRef.current = false;
      setSpinning(false);
      setLandedSpin(spin.id);
      const landed = slicesRef.current[spin.targetIndex];
      if (landed) sound.land(rarityOf(landed.option));
      const near = nearestNeighbour(to, layout, spin.targetIndex);
      const beside = near ? slicesRef.current[near.index] : undefined;
      if (landed && beside && near!.degrees <= NEAR_MISS_DEGREES && near!.margin < NEAR_MISS_MARGIN && missedBig(landed, beside)) {
        setNearMiss({ spin: spin.id, index: spin.targetIndex, slice: beside });
        window.setTimeout(() => sound.nearMiss(), 450);
      }
      onSettledRef.current(spin.id);
    };
    // Instant spins land on the spot rather than waiting for a frame.
    if (duration <= 1) {
      elapsed = duration;
      frame(performance.now());
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      spinningRef.current = false;
    };
  }, [spin, reduceMotion, spinMs, wheelSpeed, applyRotation]);

  /** A blow knocks the wheel over to slice `index`: a quick, overshooting turn (a CSS transition, so it needs no frames). */
  const joltTo = useCallback(
    (index: number) => {
      const arc = arcsRef.current[index];
      const rotor = rotorRef.current;
      if (!arc || !rotor) return;
      const centred = -arc.center;
      const to = centred + 360 * Math.round((rotationRef.current - centred) / 360);
      rotor.style.transition = 'transform 280ms cubic-bezier(0.25, 1.6, 0.45, 1)';
      applyRotation(to);
      const pointer = pointerRef.current;
      if (pointer) {
        pointer.style.transition = 'transform 260ms ease-out';
        pointer.style.transform = 'rotate(-26deg)';
        window.setTimeout(() => {
          pointer.style.transform = 'rotate(0deg)';
        }, 90);
      }
      window.setTimeout(() => {
        rotor.style.transition = '';
        if (pointer) pointer.style.transition = '';
      }, 320);
    },
    [applyRotation],
  );

  // The bump: each blow lands, the wheel jolts to the next slice; then the caller is told.
  useEffect(() => {
    if (!upgrade) return;
    const fx = upgradeEffect(upgrade.effect);
    const stageMs = reduceMotion ? fx.reducedStageMs : fx.stageMs;
    const hits = upgrade.path.length + (upgrade.overflow ? 1 : 0);
    const timers = upgrade.path.map((index, k) =>
      window.setTimeout(() => {
        setBumpedTo({ id: upgrade.id, index });
        joltTo(index);
        sound.hammer(upgrade.direction === 1);
      }, (k + fx.impactAt) * stageMs),
    );
    if (upgrade.overflow) timers.push(window.setTimeout(() => sound.ascend(), (upgrade.path.length + fx.impactAt) * stageMs));
    timers.push(window.setTimeout(() => onUpgradedRef.current?.(upgrade.id), hits * stageMs + fx.settleMs));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [upgrade, reduceMotion, joltTo]);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (spinningRef.current || size === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const r = Math.hypot(dx, dy) / (size / 2);
    if (r < L.hub || r > 1) {
      setHover(null);
      return;
    }
    const index = sliceAtScreenAngle(screenAngleOf(dx, dy), rotationRef.current, arcs);
    setHover(index < 0 ? null : { index, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Dev pick mode: a click on an open slice spins the wheel and lands it there.
  const handlePick = (e: MouseEvent<HTMLDivElement>) => {
    const picking = decreeing && onDecree;
    if ((!devPick && !picking) || !canSpin || spinningRef.current || size === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const r = Math.hypot(dx, dy) / (size / 2);
    if (r < L.hub || r > 1) return;
    const index = sliceAtScreenAngle(screenAngleOf(dx, dy), rotationRef.current, arcs);
    const slice = slices[index];
    if (!slice || slice.locked || slice.effectiveWeight <= 0) return;
    if (picking) {
      onDecree(index);
      return;
    }
    forceNextRoll(slice.option.id);
    onSpinRequest();
  };

  /** A Brute's Smash: the spin stops where it is, the wheel shakes, and the slice under the pointer is the roll. */
  const smashNow = () => {
    if (!spin || !spinningRef.current || smashedRef.current) return;
    smashedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    spinningRef.current = false;
    if (pointerRef.current) pointerRef.current.style.transform = 'rotate(0deg)';
    setSpinning(false);
    setLandedSpin(spin.id);
    setSmashed(spin.id);
    sound.hammer(true);
    if (!reduceMotion) {
      frameRef.current?.animate(
        [{ transform: 'translate(0, 0)' }, { transform: 'translate(-7px, 4px) rotate(-0.6deg)' }, { transform: 'translate(6px, -3px) rotate(0.5deg)' }, { transform: 'translate(-3px, 1px)' }, { transform: 'translate(0, 0)' }],
        { duration: 280, easing: 'ease-out' },
      );
    }
    onSmashRef.current?.(spin.id, sliceAtScreenAngle(0, rotationRef.current, arcsRef.current));
  };

  // A Smash that landed on a locked slice was moved to the nearest open one: the wheel jolts there.
  useEffect(() => {
    if (smashed === null || highlightIndex === null) return;
    if (sliceAtScreenAngle(0, rotationRef.current, arcsRef.current) !== highlightIndex) joltTo(highlightIndex);
  }, [smashed, highlightIndex, joltTo]);

  const R = size / 2;
  const paintR = size / 2 - 1; // the radius paintWheel uses, so roundels and icons agree
  const hubSize = R * L.hub * 2 - 6;
  const hovered = hover ? slices[hover.index] : undefined;
  // The rarity burst waits for any bump to finish: it celebrates where the result ends up.
  const landedRarity = !upgrade && lit !== null && slices[lit] ? rarityOf(slices[lit].option) : null;
  const effect = upgrade ? upgradeEffect(upgrade.effect) : null;
  const marqueeMode: MarqueeMode = spinning ? 'spinning' : lit !== null ? 'landed' : 'idle';
  // Only while the result still sits where it landed: a bump that moved it settles the matter.
  const missed = nearMiss && !spinning && !upgrade && nearMiss.spin === landedSpin && lit === nearMiss.index ? nearMiss.slice : null;
  const hoveredArc = hover ? arcs[hover.index] : undefined;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={label}
      className="relative mx-auto w-full select-none"
      // Never taller than the screen leaves room for (a landscape phone sees the whole wheel).
      style={{ maxWidth: `min(${maxSize}px, calc(100svh - 7rem))`, height: size || undefined }}
    >
      {size > 0 && (
        <>
          {golden && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[6%] rounded-full"
              style={{ background: 'radial-gradient(closest-side, rgba(227, 194, 113, 0.5), rgba(227, 194, 113, 0) 100%)' }}
            />
          )}
          <div
            className="absolute inset-0 rounded-full"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
            onClick={handlePick}
            style={(devPick || decreeing) && canSpin && !spinning ? { cursor: 'crosshair' } : undefined}
          >
            <div ref={rotorRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
              <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
              <RaritySparkle slices={slices} arcs={arcs} size={size} highlightIndex={lit} />
              <Marquee
                slices={slices}
                arcs={arcs}
                size={size}
                mode={marqueeMode}
                litIndex={lit}
                jackpot={landedRarity && isSpecialRarity(landedRarity) ? RARITY_STYLES[landedRarity].color : null}
                marqueeRef={marqueeRef}
              />
              {slices.map((slice, i) => {
                const arc = arcs[i];
                const roundel = arc ? roundelPx(arc.sweep, paintR) : 0;
                if (!arc || roundel === 0) return null;
                const p = polar(R * L.roundel, arc.center);
                const iconSize = Math.max(10, roundel * 1.15);
                const Icon = slice.locked ? Lock : getOptionIcon(slice.option.icon);
                const dimmed = lit !== null && lit !== i;
                return (
                  <Icon
                    key={slice.option.id}
                    aria-hidden="true"
                    size={iconSize}
                    strokeWidth={2.25}
                    className="pointer-events-none absolute transition-opacity duration-500"
                    style={{
                      left: R + p.x - iconSize / 2,
                      top: R + p.y - iconSize / 2,
                      transform: `rotate(${arc.center}deg)`,
                      color: inkFor(glassColor(slice)).ink,
                      opacity: dimmed ? 0.35 : slice.locked ? 0.75 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 32% 24%, rgba(255, 249, 232, 0.18), rgba(255, 249, 232, 0) 46%)',
              }}
            />
            {golden && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: '0 0 0 4px #e3c271, 0 0 28px 6px rgba(227, 194, 113, 0.55)' }}
              />
            )}
          </div>

          <button
            type="button"
            data-spin-button
            onClick={onSmash && spinning ? smashNow : onSpinRequest}
            disabled={onSmash && spinning ? false : !canSpin || spinning}
            aria-label={onSmash && spinning ? 'Smash the wheel to a stop' : undefined}
            className="font-display absolute z-10 flex items-center justify-center rounded-full border-[3px] border-lead text-candle transition-[filter,color] duration-200 enabled:hover:brightness-125 disabled:cursor-not-allowed disabled:text-candle/35"
            style={{
              width: hubSize,
              height: hubSize,
              left: R - hubSize / 2,
              top: R - hubSize / 2,
              fontSize: Math.max(18, R * 0.115),
              background: 'radial-gradient(circle at 40% 32%, #c23446, var(--color-gules) 58%, #4f0d17)',
              boxShadow:
                '0 0 0 3px var(--color-gilt-deep), 0 0 0 5px var(--color-gilt-bright), 0 0 0 6px var(--color-lead), 0 6px 16px rgba(0, 0, 0, 0.6), inset 0 0 0 2px rgba(240, 205, 108, 0.6), inset 0 -8px 14px rgba(0, 0, 0, 0.4)',
              textShadow: '0 2px 0 rgba(0, 0, 0, 0.6)',
            }}
          >
            {onSmash && spinning ? 'Smash!' : hubLabel}
          </button>

          {landedRarity && isSpecialRarity(landedRarity) && <LandingBurst key={`${landedSpin}:${lit}`} rarity={landedRarity} size={size} />}
          {missed && (
            <motion.div
              key={`near-${landedSpin}`}
              role="status"
              className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
              style={{ bottom: -R * 0.04 }}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              <span className="rounded-full border-2 border-lead bg-slab px-3 py-1 text-center text-sm text-vellum shadow-lg">
                So close!{' '}
                <span className="font-semibold" style={{ color: RARITY_STYLES[rarityOf(missed.option)].color }}>
                  {optionLabel(missed.option)}
                </span>{' '}
                was right there.
              </span>
            </motion.div>
          )}
          {upgrade && effect && (
            <effect.Component
              key={upgrade.id}
              size={size}
              hits={upgrade.path.length + (upgrade.overflow ? 1 : 0)}
              overflow={upgrade.overflow}
              direction={upgrade.direction}
              stageMs={reduceMotion ? effect.reducedStageMs : effect.stageMs}
              impactAt={effect.impactAt}
            />
          )}

          <svg
            ref={pointerRef}
            aria-hidden="true"
            viewBox="0 0 40 64"
            className="pointer-events-none absolute z-20"
            style={{
              width: R * 0.15,
              height: R * 0.24,
              left: R - R * 0.075,
              top: -R * 0.05,
              transformOrigin: '50% 23.4%',
              filter: 'drop-shadow(0 3px 3px rgba(0, 0, 0, 0.5))',
            }}
          >
            <defs>
              <linearGradient id="wheel-pointer-gilt" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f5e0a6" />
                <stop offset="0.55" stopColor="#c9a24c" />
                <stop offset="1" stopColor="#7d5f20" />
              </linearGradient>
            </defs>
            {/* The clapper: a leather tongue that slaps each stud as it passes, the way a prize wheel clacks. */}
            <path d="M17 49 L20 63 L23 49 Z" fill="#6b3a1c" stroke="#2a1508" strokeWidth="1.5" strokeLinejoin="round" />
            <path
              d="M20 54 L6.5 22 A14 14 0 1 1 33.5 22 Z"
              fill="url(#wheel-pointer-gilt)"
              stroke="#3a2508"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="15" r="4.5" fill="var(--color-gules)" stroke="#3a2508" strokeWidth="1.5" />
          </svg>

          {hover && hovered && hoveredArc && (
            <SliceTooltip
              slice={hovered}
              share={hoveredArc.sweep / 360}
              left={Math.max(4, Math.min(hover.x + 14, size - 220))}
              top={Math.max(hover.y - 64, 4)}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Name, rarity and the odds the engine will actually roll with. When locks or threat
 * have moved those odds away from the slice's drawn size, the drawn size is noted too.
 */
function SliceTooltip({ slice, share, left, top }: { slice: ResolvedSlice; share: number; left: number; top: number }) {
  const rarity = rarityOf(slice.option);
  const { label, color } = RARITY_STYLES[rarity];
  const drift = Math.abs(slice.probability - share) >= 0.005;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-max max-w-60 rounded-md border-2 border-lead bg-slab-raised px-3 py-2 text-sm shadow-lg"
      style={{ left, top }}
    >
      <p className="font-semibold text-candle">{optionLabel(slice.option)}</p>
      {rarity !== 'common' && (
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </p>
      )}
      {slice.locked && <p className="text-ash">{slice.lockReason}</p>}
      <p className="text-vellum">
        {formatPercent(slice.probability)} chance
        {drift && <span className="text-ash"> · drawn at {formatPercent(share)}</span>}
      </p>
    </div>
  );
}

/**
 * Light pulsing behind the glass of epic-and-better slices, inside the rotor so it turns with
 * the panes. (Rare-and-better twinkle lives in the marquee bulbs over their stretch of rim.)
 * Locked and dimmed slices stay dark. Screen-blended over the canvas, so it only ever adds light.
 */
function RaritySparkle({
  slices,
  arcs,
  size,
  highlightIndex,
}: {
  slices: readonly ResolvedSlice[];
  arcs: readonly SliceArc[];
  size: number;
  highlightIndex: number | null;
}) {
  const c = size / 2;
  const R = size / 2 - 1;
  const lit = slices.flatMap((slice, i) => {
    const arc = arcs[i];
    const style = rarityStyle(slice.option);
    const dimmed = highlightIndex !== null && highlightIndex !== i;
    return arc && arc.sweep > 0 && style.glow > 0 && !slice.locked && !dimmed ? [{ slice, arc, style, i }] : [];
  });
  if (lit.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: 'screen' }}
    >
      <defs>
        {lit.map(({ slice, style }) => (
          <radialGradient
            key={slice.option.id}
            id={`rarity-glow-${slice.option.id}`}
            gradientUnits="userSpaceOnUse"
            cx={c}
            cy={c}
            r={R * L.glassEdge}
          >
            <stop offset={L.hub / L.glassEdge} stopColor={style.color} stopOpacity={0} />
            <stop offset={0.72} stopColor={style.color} stopOpacity={0.9} />
            <stop offset={1} stopColor={style.color} stopOpacity={0.35} />
          </radialGradient>
        ))}
      </defs>
      {lit.map(({ slice, arc, style, i }) => (
        <path
          key={slice.option.id}
          d={wedge(c, R * L.glassEdge, R * L.hub, arc)}
          fill={`url(#rarity-glow-${slice.option.id})`}
          className="rarity-pulse"
          style={{ '--glow': style.glow, animationDelay: `${-createSeededRng(i * 104729 + slices.length)() * 3}s` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/** Candle-gold glass for an ordinary bulb; rare-and-better slices' bulbs burn in their rarity. */
const BULB_GOLD = '#f0cd6c';
/** About one bulb per this many wheel radii of rim, kept clear of the gilt studs on the lead lines. */
const BULB_SPACING = 0.105;

export type MarqueeMode = 'idle' | 'spinning' | 'landed';

/**
 * The marquee: bulbs set into the gilt rim, a run of them along each slice's stretch, inside the
 * rotor so they turn with the wheel. What they do is all CSS (index.css, "marquee"), keyed off
 * data attributes the wheel sets:
 *   idle     – a slow, warm two-step chase
 *   spinning – the chase steps once per lead line passing the pointer (`data-phase`, flipped from
 *              the spin's frame loop without a render), so it slows as the wheel slows
 *   landed   – the winner's bulbs flare; the rest go dark. A rare-or-better landing first flashes
 *              every bulb in its rarity (`data-jackpot`), then settles.
 */
function Marquee({
  slices,
  arcs,
  size,
  mode,
  litIndex,
  jackpot,
  marqueeRef,
}: {
  slices: readonly ResolvedSlice[];
  arcs: readonly SliceArc[];
  size: number;
  mode: MarqueeMode;
  litIndex: number | null;
  jackpot: string | null;
  marqueeRef: Ref<SVGSVGElement>;
}) {
  const c = size / 2;
  const R = size / 2 - 1;
  const ring = R * ((L.glassEdge + 1) / 2);
  const bulb = Math.max(2.2, R * 0.019);
  return (
    <svg
      ref={marqueeRef}
      aria-hidden="true"
      viewBox={`0 0 ${size} ${size}`}
      className="marquee pointer-events-none absolute inset-0 h-full w-full"
      data-mode={mode}
      data-phase="0"
      {...(jackpot && { 'data-jackpot': '' })}
      style={jackpot ? ({ '--jackpot': jackpot } as CSSProperties) : undefined}
    >
      {slices.map((slice, i) => {
        const arc = arcs[i];
        if (!arc || arc.sweep <= 0) return null;
        // Bulbs sit between the studs: none closer than a bulb-and-a-half to either lead line.
        const length = (ring * arc.sweep * Math.PI) / 180;
        const count = Math.floor(length / (R * BULB_SPACING));
        if (count === 0) return null;
        const rarity = rarityOf(slice.option);
        const tint = isSpecialRarity(rarity) ? RARITY_STYLES[rarity].color : BULB_GOLD;
        const hot = mode === 'landed' && litIndex === i;
        return (
          <g key={slice.option.id} className={hot ? 'bulbs-hot' : isSpecialRarity(rarity) ? 'bulbs-rare' : undefined} style={{ '--tint': tint } as CSSProperties}>
            {Array.from({ length: count }, (_, k) => {
              const p = polar(ring, arc.start + (arc.sweep * (k + 0.5)) / count);
              return <circle key={k} className={k % 2 === 0 ? 'bulb bulb-a' : 'bulb bulb-b'} cx={c + p.x} cy={c + p.y} r={bulb} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** An annular wedge between two radii, as an SVG path. */
function wedge(c: number, outer: number, inner: number, arc: SliceArc): string {
  if (arc.sweep >= 359.99) {
    // A whole ring: an SVG arc can't start and end on the same point, so draw two halves each way.
    const ring = (r: number, sweepFlag: 0 | 1) =>
      `M ${c} ${c - r} A ${r} ${r} 0 1 ${sweepFlag} ${c} ${c + r} A ${r} ${r} 0 1 ${sweepFlag} ${c} ${c - r} Z`;
    return `${ring(outer, 1)} ${ring(inner, 0)}`;
  }
  const o1 = polar(outer, arc.start);
  const o2 = polar(outer, arc.end);
  const i1 = polar(inner, arc.end);
  const i2 = polar(inner, arc.start);
  const large = arc.sweep > 180 ? 1 : 0;
  return [
    `M ${c + o1.x} ${c + o1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${c + o2.x} ${c + o2.y}`,
    `L ${c + i1.x} ${c + i1.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${c + i2.x} ${c + i2.y}`,
    'Z',
  ].join(' ');
}
