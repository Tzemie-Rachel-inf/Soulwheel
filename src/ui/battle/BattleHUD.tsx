/**
 * A boss battle, as a fighting game shows it: two health bars facing each other, the round,
 * the combo, what the foe is readying, and every blow as it lands (a number that flies off
 * the bar it struck, coloured by its kind of damage, WEAK! or RESISTED, a shake on the big ones).
 * Health is shown on each side's own scale; the battle keeps it in units (engine/battle.ts).
 */
import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'framer-motion';
import { BATTLE_POOL, FOE_HP_PER_UNIT, foeMaxHp, heroUnits, poolsOf, weaponDamage, type BattleState, type ClashEvent } from '../../engine/battle';
import { GameIcon, foeIcon, gearIcon } from '../GameIcon';
import type { GameIconId } from '../gameIconPaths';
import { maxHp } from '../../engine/hp';
import { describeMatchup, turns } from '../../engine/matchup';
import type { Character, DamageType, GameConfig, SpellMode } from '../../engine/types';

const TAG: Record<string, { text: string; color: string }> = {
  weak: { text: 'WEAK!', color: '#ffd76a' },
  resisted: { text: 'RESISTED', color: '#b8a68a' },
  immune: { text: 'IMMUNE', color: '#8a94a4' },
  turned: { text: 'ARMOUR TURNS IT', color: '#739ddb' },
};

function damageColor(config: GameConfig, damage: DamageType | undefined): string {
  return (damage && config.gear?.damageColors[damage]) || '#f4dc9a';
}

/** One side's bar. `mirror` fills it from the right, as the foe's does. */
function HealthBar({ value, max, color, mirror, flash }: { value: number; max: number; color: string; mirror?: boolean; flash: string | null }) {
  const reduce = useReducedMotion() ?? false;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const low = pct <= 30;
  return (
    <div className="relative h-5 overflow-hidden border-2 border-gilt-deep bg-[#120b09] sm:h-6" style={{ transform: mirror ? 'scaleX(-1)' : undefined }}>
      {/* The ghost: what was there a moment ago, draining after the hit */}
      <motion.span
        className="absolute inset-y-0 left-0 block bg-[#f7e0b0]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.45, ease: 'easeIn' }}
      />
      <motion.span
        className="absolute inset-y-0 left-0 block"
        style={{ background: low ? 'linear-gradient(180deg, #ff6b4a, #a3282e)' : color }}
        initial={false}
        animate={{ width: `${pct}%`, opacity: low && !reduce ? [1, 0.7, 1] : 1 }}
        transition={{ width: { duration: reduce ? 0 : 0.25 }, opacity: low && !reduce ? { duration: 0.8, repeat: Infinity } : { duration: 0 } }}
      />
      {/* Segments, like a fighting game's */}
      <span aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 calc(10% - 2px), rgba(0,0,0,0.45) calc(10% - 2px) 10%)' }} />
      <AnimatePresence>
        {flash && !reduce && (
          <motion.span key={flash} className="absolute inset-0" style={{ background: flash, mixBlendMode: 'screen' }} initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/** A number that flies off a bar. */
function DamagePop({ text, color, tag, big, side }: { text: string; color: string; tag?: { text: string; color: string }; big: boolean; side: 'hero' | 'foe' }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute top-full z-20 mt-1 flex flex-col items-center ${side === 'hero' ? 'left-6' : 'right-6'}`}
      initial={{ y: 6, opacity: 0, scale: 0.6 }}
      animate={reduce ? { opacity: [0, 1, 1, 0] } : { y: [6, -28, -40], opacity: [0, 1, 1, 0], scale: [0.6, big ? 1.5 : 1.15, 1] }}
      transition={{ duration: 1.3, times: [0, 0.2, 0.75, 1] }}
    >
      <span className="font-display tabular-nums" style={{ color, fontSize: big ? 40 : 28, lineHeight: 1, textShadow: '0 2px 0 #000, 0 0 14px rgba(0,0,0,0.8)' }}>
        {text}
      </span>
      {tag && (
        <span className="mt-0.5 text-xs font-bold tracking-widest" style={{ color: tag.color, textShadow: '0 1px 0 #000' }}>
          {tag.text}
        </span>
      )}
    </motion.div>
  );
}

/**
 * One side of the face-off: their icon in a gilt frame with corner studs, their name beside it,
 * and under the name what they hit for (or how much health they have). The foe's side is
 * mirrored. On the round a battle begins, it swings in.
 */
function Fighter({ icon, tone, name, plate, sub, mirror, enter }: { icon: GameIconId; tone: 'hero' | 'foe'; name: string; plate: string; sub?: string; mirror?: boolean; enter: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const ring = tone === 'hero' ? '#3f8a5a' : '#b52a3c';
  return (
    <motion.div
      className={`flex min-w-0 items-center gap-2.5 sm:gap-3 ${mirror ? 'flex-row-reverse text-right' : ''}`}
      initial={enter && !reduce ? { opacity: 0, x: mirror ? 40 : -40, scale: 0.8 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: mirror ? 0.15 : 0 }}
    >
      <div
        className="relative grid size-14 shrink-0 place-items-center border-2 border-gilt bg-[radial-gradient(circle_at_50%_35%,#3a2a1c,#120b09_70%)] sm:size-16"
        style={{ boxShadow: `inset 0 0 0 2px #120b09, inset 0 0 0 4px ${ring}, 0 4px 14px rgba(0,0,0,0.6)` }}
      >
        {(['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'] as const).map((pos) => (
          <span key={pos} aria-hidden="true" className={`absolute size-2 rotate-45 border border-gilt-bright bg-gilt-deep ${pos}`} />
        ))}
        <GameIcon icon={icon} size={36} className={tone === 'hero' ? 'text-candle' : 'text-ember'} />
      </div>
      <div className="min-w-0">
        <p className={`font-display line-clamp-2 text-lg leading-tight sm:text-2xl ${tone === 'hero' ? 'text-candle' : 'text-ember'}`}>{name}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[0.7rem] leading-snug" style={{ justifyContent: mirror ? 'flex-end' : undefined }}>
          <span className="border border-gilt-deep bg-[#120b09] px-1.5 font-semibold uppercase tracking-wider text-vellum">{plate}</span>
          {sub && <span className="text-ash">{sub}</span>}
        </p>
      </div>
    </motion.div>
  );
}

function Chip({ children, color, title }: { children: ReactNode; color: string; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[0.7rem] font-semibold uppercase tracking-wider" style={{ borderColor: color, color }} title={title}>
      {children}
    </span>
  );
}

export interface BattleHUDProps {
  config: GameConfig;
  hero: Character;
  battle: BattleState;
  /** The blow to show landing, while it is fresh. */
  event: ClashEvent | null;
  /** Changes with every blow, so the same blow twice plays twice. */
  eventKey: string | number;
  mode: SpellMode;
  onModeChange?: (mode: SpellMode) => void;
}

export function BattleHUD({ config, hero, battle, event, eventKey, mode, onModeChange }: BattleHUDProps) {
  const reduce = useReducedMotion() ?? false;
  const { foe } = battle;
  const heroMax = maxHp(hero);
  const foeMax = foeMaxHp(battle);
  const pools = poolsOf(battle);
  const heroScale = heroMax / BATTLE_POOL;
  const foeScale = FOE_HP_PER_UNIT;
  const heroHp = Math.round(heroUnits(battle) * heroScale);
  const foeHp = Math.round(battle.foeHp * foeScale);
  // An ordinary fight can only take so much: under this, they are driven off.
  const floor = pools.base > 0 ? Math.round(pools.base * heroScale) : 0;
  const entering = battle.round === 1 && !battle.last;
  const match = describeMatchup(hero, foe);
  const move = foe.moves?.[battle.intent % Math.max(1, foe.moves.length)];
  const moveTurned = move ? turns(hero, move.damage) : false;
  const big = !!event && ((event.mult ?? 1) > 2 || event.toFoe >= 8 || event.toHero >= 8);

  // The screen shakes on a big hit; the struck bar flashes the colour of what hit it.
  const [scope, shake] = useAnimate<HTMLElement>();
  useEffect(() => {
    if (big && !reduce && scope.current) void shake(scope.current, { x: [0, -10, 9, -6, 5, -2, 0] }, { duration: 0.45 });
  }, [eventKey, big, reduce, scope, shake]);

  const foeFlash = event && event.toFoe > 0 ? `${damageColor(config, event.damage)}:${eventKey}` : null;
  const heroFlash = event && event.toHero > 0 ? `${damageColor(config, event.damage)}:${eventKey}` : null;
  const flashColor = (key: string | null) => (key ? key.split(':')[0]! : null);

  return (
    <section
      ref={scope}
      aria-label={`Battle against ${foe.name}, round ${battle.round}`}
      className="court-panel relative mt-5 px-3 pb-4 pt-3 sm:px-5"
    >
      {entering && (
        <motion.p
          className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-ember"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {battle.boss === false ? `${foe.name} appears!` : `${foe.name} bars the way!`}
        </motion.p>
      )}
      {/* The face-off: each fighter, framed and named, with the round between them */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <Fighter icon={gearIcon(hero.weapon, 'weapon')} tone="hero" name={hero.name} plate={`${weaponDamage(hero)} dmg`} sub={hero.weapon?.name ?? 'Bare hands'} enter={entering} />
        <div className="text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-ash">Round</p>
          <AnimatePresence mode="popLayout">
            <motion.p key={battle.round} className="font-display text-3xl leading-none text-gilt-bright tabular-nums" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {battle.verdict ? 'K.O.' : battle.round}
            </motion.p>
          </AnimatePresence>
        </div>
        <Fighter icon={foeIcon(foe)} tone="foe" name={foe.name} plate={`${foeMax} HP`} sub={`${foe.power} power${battle.boss === false ? '' : ' · boss'}`} mirror enter={entering} />
      </div>

      {/* The bars, facing each other */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="relative">
          <HealthBar value={heroUnits(battle)} max={BATTLE_POOL} color="linear-gradient(180deg, #9be3b9, #3f8a5a)" flash={flashColor(heroFlash)} />
          <AnimatePresence>
            {event && event.toHero > 0 && (
              <DamagePop key={`h${eventKey}`} side="hero" text={`-${Math.round(event.toHero * heroScale)}`} color={damageColor(config, event.damage)} big={big} {...(event.matchup && TAG[event.matchup] && { tag: TAG[event.matchup] })} />
            )}
            {event && event.heal > 0 && <DamagePop key={`hh${eventKey}`} side="hero" text={`+${Math.round(event.heal * heroScale)}`} color="#7fd0a6" big={false} />}
            {event?.ironWill && <DamagePop key={`iw${eventKey}`} side="hero" text="IRON WILL!" color="#ffd76a" big tag={{ text: 'BACK UP AT 1', color: '#f4dc9a' }} />}
          </AnimatePresence>
        </div>
        <span className="font-display text-lg text-gilt" aria-hidden="true">
          VS
        </span>
        <div className="relative">
          <HealthBar value={battle.foeHp} max={pools.foe} color="linear-gradient(180deg, #ff9a7a, #b52a3c)" mirror flash={flashColor(foeFlash)} />
          <AnimatePresence>
            {event && event.toFoe > 0 && (
              <DamagePop
                key={`f${eventKey}`}
                side="foe"
                text={`${event.mult && event.mult > 1 ? `×${event.mult} ` : ''}-${Math.round(event.toFoe * foeScale)}`}
                color={damageColor(config, event.damage)}
                big={big}
                {...(event.matchup && TAG[event.matchup] && { tag: TAG[event.matchup] })}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-sm tabular-nums">
        <span className="text-vellum">
          {heroHp} <span className="text-ash">/ {heroMax}</span>
          {floor > 0 && <span className="text-ash" title="An ordinary fight can take a third of their health; past that they are driven off"> · driven off at {floor}</span>}
        </span>
        <span className="text-vellum">
          {foeHp} <span className="text-ash">/ {foeMax}</span>
        </span>
      </div>

      {/* What each side brings */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip color={damageColor(config, match.damage)} title="What their blows deal">
            {match.damage}
            {match.matchup !== 'neutral' && ` · ${match.matchup === 'weak' ? 'weak ×1.3' : match.matchup === 'resisted' ? 'resisted ×0.75' : 'immune ×0.5'}`}
          </Chip>
          {hero.traits.some((t) => t.id === 'iron_will') && (
            <Chip color={battle.ironWillUsed ? '#6b6b6b' : '#ffd76a'} title="Once a fight, a blow that would drop them leaves them at 1">
              iron will {battle.ironWillUsed ? 'spent' : 'ready'}
            </Chip>
          )}
          {hero.armor?.resists && (
            <Chip color={damageColor(config, hero.armor.resists)} title="What their armour turns">
              turns {hero.armor.resists}
            </Chip>
          )}
          {battle.combo >= 2 && (
            <motion.span key={battle.combo} className="font-display text-lg leading-none text-gilt-bright" initial={{ scale: 1.6 }} animate={{ scale: 1 }}>
              {battle.combo} hit combo!
            </motion.span>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {foe.weak?.map((d) => (
            <Chip key={d} color="#7fd0a6" title={`${foe.name} is weak to ${d}`}>
              weak: {d}
            </Chip>
          ))}
          {foe.resists?.map((d) => (
            <Chip key={d} color="#b8a68a" title={`${foe.name} resists ${d}`}>
              resists: {d}
            </Chip>
          ))}
          {foe.immune?.map((d) => (
            <Chip key={d} color="#8a94a4" title={`${foe.name} is immune to ${d}`}>
              immune: {d}
            </Chip>
          ))}
        </div>
      </div>

      {/* The foe's intent */}
      {move && !battle.verdict && (
        <p className="mt-3 text-sm text-vellum">
          <span className="font-semibold text-ember">Readied: {move.name}</span>{' '}
          <span style={{ color: damageColor(config, move.damage) }}>({move.damage})</span>
          {moveTurned && <span className="text-[#739ddb]"> · their armour turns it</span>}
          {battle.warded && <span className="text-moss"> · warded this round</span>}
        </p>
      )}

      {/* The battle so far */}
      <ol className="mt-2 max-h-24 space-y-0.5 overflow-hidden text-sm text-ash" aria-label="Battle log" aria-live="polite">
        {battle.log.slice(-3).map((line, i, all) => (
          <li key={`${battle.log.length}-${i}`} className={i === all.length - 1 ? 'text-vellum' : ''}>
            {line}
          </li>
        ))}
      </ol>

      {onModeChange && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-lead/60 pt-2 text-xs text-ash">
          <span className="uppercase tracking-wider">Playtest · spells</span>
          {(['auto', 'choose'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={mode === m}
              className={`rounded-sm border px-2 py-0.5 ${mode === m ? 'border-gilt bg-gilt/20 text-candle' : 'border-lead text-ash hover:text-vellum'}`}
            >
              {m === 'auto' ? 'On the wheel' : 'Cast them'}
            </button>
          ))}
          <span>(a battle already under way keeps the odds it began with)</span>
        </div>
      )}

      {battle.verdict && (
        <motion.p
          className="font-display pointer-events-none absolute inset-x-0 top-1/3 text-center text-6xl"
          style={{ color: battle.verdict === 'win' ? 'var(--color-gilt-bright)' : 'var(--color-ember)', textShadow: '0 4px 0 #000, 0 0 30px rgba(0,0,0,0.9)' }}
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: [3, 1, 1, 1.1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.8, times: [0, 0.18, 0.75, 1] }}
        >
          {battle.verdict === 'win' ? 'VICTORY' : 'K.O.'}
        </motion.p>
      )}
    </section>
  );
}
