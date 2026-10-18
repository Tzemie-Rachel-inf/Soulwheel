/**
 * The Adventures tab: the player's one hero, between roads or on one. Once they set out it is
 * the same spin-reveal loop as creation, on the adventure wheels, until their story ends.
 * There is no retirement wheel: heroes earn fame, and fame leads to the endings. Wheels,
 * odds, outcomes and fame tiers all come from config.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Footprints } from 'lucide-react';
import { isGearStep, isWhoStep, spellModeOf } from '../engine/adventure';
import { BATTLE_POOL, FOE_HP_PER_UNIT, foeMaxHp, heroUnits, isBattleStep, poolsOf, type BattleState } from '../engine/battle';
import { describeMatchup } from '../engine/matchup';
import { pendingOffer } from '../engine/gear';
import { fameStanding } from '../engine/fame';
import { fightOdds } from '../engine/odds';
import { calculatePowerRating } from '../engine/power';
import type { Character, Foe, GameConfig, WheelStep, World } from '../engine/types';
import { findCharacter } from '../engine/world';
import type { useAdventure } from '../state/useAdventure';
import { FameMeter } from './FameMeter';
import { GearCompare } from './GearCard';
import { Epitaph } from './Headstone';
import { formatPercent, fullName, lifeOf, ordinal, heroRace, roleLabel, signed } from './format';
import { OddsList } from './OddsList';
import { enter, returnToWheel } from './motion';
import { ChoicePanel, QuestPanel, QuestTale } from './QuestPanel';
import { OutcomeCard, RevealPopup, jackpotColor, primaryButton, secondaryButton } from './RollReveal';
import { canNameHeir, houseOf } from '../engine/lineage';
import { FateWheels } from './wheel/FateWheels';
import { isSideBet, sideBetBackdrop } from './wheel/MiniSpinWheel';
import { ExpeditionBanner, HealthGauge, KnownPlaces, MeterBars, UnfinishedBusiness } from './Stakes';
import { BattleHUD } from './battle/BattleHUD';
import { CritCascade } from './battle/CritCascade';
import { SpellBar } from './battle/SpellBar';
import { pauseDuration, useSettings } from './settings';
import { WheelTitle } from './WheelTitle';

const WIDE = '(min-width: 64rem)';
/** True on a screen wide enough for the right-hand column (Tailwind's lg). */
function useWideScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(WIDE).matches,
  );
}

/** A battle's rounds spin faster than an ordinary wheel. */
const CLASH_SPIN_MS = 2300;
/** How long a landed blow shows on the HUD before the next round comes up. */
const CLASH_LINGER_MS = 1150;

interface AdventureTabProps {
  config: GameConfig;
  world: World;
  /** The player's hero, while they live. */
  hero: Character | null;
  adventure: ReturnType<typeof useAdventure>;
  onCreateHero: () => void;
  /** Their story is over: on to the next soul, or to the heir of `parent`. */
  onNextSoul: (parent?: Character) => void;
  /** Where the page's right-hand column keeps a place for this wheel's panels, on a wide screen. */
  sideSlot?: HTMLElement | null;
}

export function AdventureTab({ config, world, hero: living, adventure, onCreateHero, onNextSoul, sideSlot = null }: AdventureTabProps) {
  const wide = useWideScreen();
  const { session, view } = adventure;
  if (!session || !view) {
    return <HeroHome config={config} world={world} hero={living} error={adventure.error} onEmbark={adventure.embark} onCreateHero={onCreateHero} />;
  }

  const hero = session.state.character;
  const number = hero.adventures.length + 1;
  const landed = session.phase === 'revealing' || session.phase === 'complete';
  const outcome = session.pending ?? session.last;
  const winner = outcome?.roll.winner;
  // Who this wheel features, if it cast someone from the world. (Until the reveal is
  // dismissed, session.state is still the state the wheel was spun from.)
  const cast = session.state.cast && session.state.cast.stepId === view.step?.id ? session.state.cast.character : null;
  // The roll this outcome wrote ("who is it?" wheels write none).
  const roll = outcome && !isWhoStep(outcome.step.id) ? outcome.state.rolls.at(-1) : undefined;
  const standing = fameStanding(config.fame.tiers, hero.fame);
  const earned = session.state.fameEarned;
  // Keep or Take: what they carry beside what they found.
  const offer = view.step && isGearStep(view.step.id) ? pendingOffer(session.state.character) : undefined;
  // A boss battle: on its Clash wheels, or on its fight's wheel once decided. A landed blow shows at once.
  const clashLanded = landed && outcome && isBattleStep(outcome.step.id) ? outcome : null;
  const battle = (clashLanded ? clashLanded.state.battle : session.state.battle) ?? null;
  const onClash = !!view.step && isBattleStep(view.step.id);
  const showBattle = battle !== null && (onClash || (battle.verdict !== undefined && view.step?.id === battle.stepId));
  const blow = clashLanded ? (battle?.last ?? null) : session.phase === 'ready' && battle?.last?.cast ? battle.last : null;
  const cascade = clashLanded && session.phase === 'revealing' && blow?.cascade ? blow : null;
  const mode = spellModeOf(config, session.state);
  // A Gambler's coin or a Trickster's gambit plays over the wheel just rolled: the hall keeps showing that one.
  const backdrop = sideBetBackdrop(session, view.step, hero.rules);
  const hallStep = backdrop?.step ?? view.step;
  const hasPanels = Boolean(view.character.expedition || view.character.story || (cast && !view.step?.foe) || (showBattle && battle) || view.step?.foe);
  // What this wheel is about, which changes from wheel to wheel: beside the wheel on a wide screen (in the
  // page's right-hand column, over the hero's card), below it on a phone. Never above it: the wheel holds still.
  const panelList = (
    <>
        {view.character.expedition && <ExpeditionBanner config={config} expedition={view.character.expedition} />}
        {view.character.story && <QuestPanel story={view.character.story} hero={view.character} config={config} />}
        {cast && !view.step?.foe && <CastBanner config={config} cast={cast} />}
        {showBattle && battle ? (
          <BattleHUD
            config={config}
            hero={clashLanded ? clashLanded.state.character : hero}
            battle={battle}
            event={blow}
            eventKey={`${session.spinCount}-${battle.round}-${battle.stats.casts}`}
            mode={mode}
            onModeChange={adventure.setSpellMode}
          />
        ) : (
          view.step?.foe && <Duel hero={hero} step={view.step} foe={view.step.foe} castFoe={cast} />
        )}
        {onClash && battle && mode === 'choose' && session.phase === 'ready' && (
          <SpellBar config={config} hero={hero} battle={battle} disabled={session.phase !== 'ready'} onCast={adventure.cast} />
        )}
    </>
  );
  const sidePanels = hasPanels ? <div className="flex flex-col gap-4 *:mt-0!">{panelList}</div> : null;

  return (
    <>
      {/* What this wheel is, then what is at stake on it. The block keeps its height, so the wheel holds still. */}
      <div className="flex min-h-[11.5rem] flex-col sm:min-h-[13.75rem]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ash">
            {hero.name}’s {ordinal(number)} adventure · <span className="text-gilt-bright">{standing.tier.name}</span>,{' '}
            {hero.fame} fame
            {earned !== 0 && <span className={earned > 0 ? 'text-moss' : 'text-ember'}> ({signed(earned)} on this road)</span>}
          </p>
          <WheelTitle
            title={hallStep?.title ?? 'The road'}
            subtitle={hallStep?.subtitle}
            className="court-title mt-1 line-clamp-2 text-3xl leading-none sm:text-5xl"
          />
        </div>
        <MeterBars config={config} character={view.character} className="shrink-0 pt-1" hideHealth />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <HealthGauge
          character={view.character}
          className="min-w-0 max-w-xl flex-1 basis-60"
          {...(showBattle && battle && { fraction: heroUnits(battle) / BATTLE_POOL })}
        />
        {/* On a phone the battle panel is below the wheel: the foe's health comes up here, beside theirs. */}
        {showBattle && battle && <FoeGauge battle={battle} className="min-w-0 flex-1 basis-40 lg:hidden" />}
      </div>
      </div>
      <ClashAdvance active={session.phase === 'revealing' && clashLanded !== null && cascade === null} onNext={adventure.next} />

      <div className="relative mt-2">
        <AnimatePresence>
          {cascade?.cascade && config.battle && (
            <CritCascade
              key={`cascade-${session.spinCount}`}
              config={config.battle}
              cascade={cascade.cascade}
              foe={cascade.kind === 'foe_crit'}
              base={Math.round(((cascade.kind === 'foe_crit' ? cascade.toHero : cascade.toFoe) / (cascade.mult ?? 1)) * (cascade.kind === 'foe_crit' ? (battle?.scale.hero ?? 1) : FOE_HP_PER_UNIT))}
              total={Math.round((cascade.kind === 'foe_crit' ? cascade.toHero : cascade.toFoe) * (cascade.kind === 'foe_crit' ? (battle?.scale.hero ?? 1) : FOE_HP_PER_UNIT))}
              onDone={adventure.next}
            />
          )}
        </AnimatePresence>
        {view.step?.choice ? (
          <>
            {offer ? (
              <div className="mb-4">
                <GearCompare offer={offer} character={session.state.character} config={config} />
              </div>
            ) : (
              <p className="mb-3 text-sm text-ash">Your decision. Each choice says what it gives, what it risks, and whether a wheel decides how it goes.</p>
            )}
            <ChoicePanel
              slices={view.slices}
              config={config}
              chosenIndex={landed ? view.winnerIndex : null}
              disabled={session.phase !== 'ready'}
              onChoose={adventure.choose}
              {...(offer && { thenLabel: 'Then: the road goes on' })}
            />
          </>
        ) : (
          <FateWheels
            view={view}
            phase={session.phase}
            character={session.state.character}
            step={view.step}
            spinRequest={adventure.spinRequest}
            altSpinRequest={adventure.altSpinRequest}
            onSpin={adventure.spin}
            onSettled={adventure.settle}
            onSettledAlt={adventure.settleAlt}
            onPick={adventure.pick}
            onSmash={adventure.smash}
            onDecree={adventure.decree}
            label={view.step?.title ?? 'Adventure wheel'}
            {...(onClash && { spinMs: CLASH_SPIN_MS, hubLabel: 'Fight' })}
            onAdvance={adventure.next}
            backdrop={backdrop}
          />
        )}
      </div>
      {sidePanels && (wide && sideSlot ? createPortal(sidePanels, sideSlot) : <div className="mt-6">{sidePanels}</div>)}

      {adventure.error && (
        <p role="alert" className="mt-4 text-ember">
          {adventure.error}
        </p>
      )}

      <div className="mt-8">
        <p className="sr-only" aria-live="polite">
          {session.phase === 'revealing' && winner ? `Rolled ${winner.option.label}.` : ''}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          {session.phase === 'revealing' && outcome && !clashLanded && !isSideBet(outcome.step, hero.rules) && (
            <RevealPopup key={`reveal-${outcome.step.id}-${outcome.state.stepsTaken}`} jackpot={jackpotColor(outcome)}>
              <OutcomeCard
                outcome={outcome}
                config={config}
                onContinue={() => {
                  adventure.next();
                  returnToWheel();
                }}
                finishLabel="See how it ends"
                castName={roll?.cast}
                note={roll?.note}
                fame={roll?.fame}
                callback={roll?.callback}
                event={roll?.event}
              />
            </RevealPopup>
          )}
          {session.phase === 'complete' && (
            <motion.div key="complete" {...enter}>
              <AdventureOver
                config={config}
                hero={findCharacter(world, hero.id) ?? hero}
                ending={hero}
                fameEarned={earned}
                note={session.state.fate}
                onAgain={(again) => {
                  adventure.embark(again);
                  returnToWheel();
                }}
                onNextSoul={onNextSoul}
                canRaiseHeir={canNameHeir(world, findCharacter(world, hero.id) ?? hero)}
              />
              {(() => {
                const quest = findCharacter(world, hero.id)?.adventures.at(-1)?.quest;
                return quest ? <QuestTale quest={quest} /> : null;
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {view.step && !view.step.choice && (
        <div className="mt-8">
          <h2 className="text-sm text-ash">Odds on this wheel</h2>
          <div className="mt-3">
            <OddsList
              slices={backdrop?.slices ?? view.slices}
              winnerIndex={backdrop ? backdrop.winnerIndex : landed ? view.winnerIndex : null}
              title={backdrop?.step.title ?? view.step.title}
              stepId={backdrop?.step.id ?? view.step.id}
              config={config}
              character={session.state.character}
              world={world}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** The foe's health, compact, for the header on a phone: its name, a bar, the numbers. */
function FoeGauge({ battle, className = '' }: { battle: BattleState; className?: string }) {
  const max = foeMaxHp(battle);
  const hp = Math.round(battle.foeHp * FOE_HP_PER_UNIT);
  const pct = `${Math.max(0, Math.min(100, (battle.foeHp / poolsOf(battle).foe) * 100))}%`;
  return (
    <div className={`flex items-center gap-2 ${className}`} role="meter" aria-label={`${battle.foe.name}'s health`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <span className="max-w-[7rem] shrink-0 truncate font-caps text-sm text-ember">{battle.foe.name}</span>
      <span className="relative h-3 min-w-0 flex-1 overflow-hidden border-2 border-gilt-deep bg-[#120b09]">
        <motion.span className="absolute inset-y-0 right-0 block bg-[linear-gradient(180deg,#ff9a7a,#b52a3c)]" initial={false} animate={{ width: pct }} transition={{ duration: 0.3 }} />
      </span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-vellum">
        {hp}
        <span className="font-normal text-ash"> / {max}</span>
      </span>
    </div>
  );
}

/** On a battle's Clash wheel: once a blow has landed and shown, the next round comes up by itself. */
function ClashAdvance({ active, onNext }: { active: boolean; onNext: () => void }) {
  const { wheelSpeed } = useSettings();
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(onNext, pauseDuration(CLASH_LINGER_MS, wheelSpeed));
    return () => clearTimeout(timer);
  }, [active, onNext, wheelSpeed]);
  return null;
}

/** A character from the world, featured on this wheel: a retired legend, a grave, a ruler. */
function CastBanner({ config, cast }: { config: GameConfig; cast: Character }) {
  const gone = cast.status === 'fallen' || cast.status === 'sealed';
  return (
    <div className="mt-5 rounded-md border-2 border-gilt/60 bg-slab px-4 py-3">
      <p className="text-sm text-ash">Featuring someone you may know</p>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-display text-2xl text-candle">{fullName(cast, config)}</span>
        <span className="text-sm tabular-nums text-vellum">
          {gone ? `${calculatePowerRating(cast)} CP in life` : `${calculatePowerRating(cast)} CP`}
        </span>
      </p>
      <p className="text-sm text-ash">{castDescription(config, cast)}</p>
    </div>
  );
}

function castDescription(config: GameConfig, cast: Character): string {
  const race = heroRace(config, cast);
  const role = roleLabel(cast);
  const who = race ? `${race}, ${role.charAt(0).toLowerCase()}${role.slice(1)}` : role;
  const renown = fameStanding(config.fame.tiers, cast.fame).tier.name;
  if (cast.status === 'sealed') return `Sealed inside a relic, awake. ${cast.fate?.summary ?? ''}`.trim();
  if (cast.fate) return `${who}. ${cast.fate.summary}. ${renown} in their day.`;
  return `${who}, once a hero of this world. ${renown}.`;
}

/** Hero against foe, Combat Power against power: the odds every fight wheel is drawn at. */
function Duel({ hero, step, foe, castFoe }: { hero: Character; step: WheelStep; foe: Foe; castFoe: Character | null }) {
  const win = fightOdds(step, hero) ?? 0;
  return (
    <div className="court-panel mt-5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0">
          <span className="block truncate text-sm text-ash">{hero.name}</span>
          <span className="text-2xl font-semibold tabular-nums text-candle">{calculatePowerRating(hero)}</span>{' '}
          <span className="text-sm text-ash">CP</span>
        </p>
        <p className="min-w-0 text-right">
          <span className="block truncate text-sm text-ash">{foe.name}</span>
          <span className="text-2xl font-semibold tabular-nums text-ember">{foe.power}</span>{' '}
          <span className="text-sm text-ash">power</span>
        </p>
      </div>
      <div
        className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-[3px]"
        role="img"
        aria-label={`${formatPercent(win)} chance to win`}
      >
        <span className="bg-moss transition-[flex-grow] duration-700" style={{ flexGrow: win, flexBasis: 0 }} />
        <span className="bg-ember/70 transition-[flex-grow] duration-700" style={{ flexGrow: 1 - win, flexBasis: 0 }} />
      </div>
      <p className="mt-2 text-sm text-vellum">
        <span className="font-semibold text-moss">{formatPercent(win)}</span> to win, from power against power. The
        wheel’s win and defeat slices are drawn at these odds. The stronger the foe, the more fame a win is worth.
      </p>
      <MatchupLine hero={hero} foe={foe} />
      {castFoe && (
        <p className="mt-1 text-sm text-ember">
          {castFoe.name} once rode as a hero. Now: {roleLabel(castFoe).toLowerCase()}.
        </p>
      )}
    </div>
  );
}

/** How the hero's weapon meets the foe, and whether their armour turns its blows: already in the odds above. */
function MatchupLine({ hero, foe }: { hero: Character; foe: Foe }) {
  const m = describeMatchup(hero, foe);
  if (m.matchup === 'neutral' && !m.turned) return null;
  const hit = { weak: 'WEAK! ×1.3', resisted: 'Resisted ×0.75', immune: 'Immune ×0.5', neutral: '' }[m.matchup];
  return (
    <p className="mt-1 text-sm">
      {m.matchup !== 'neutral' && (
        <span className={m.matchup === 'weak' ? 'font-semibold text-gilt-bright' : 'text-ember'}>
          Their {m.damage}: {hit}
        </span>
      )}
      {m.matchup !== 'neutral' && m.turned && <span className="text-ash"> · </span>}
      {m.turned && <span className="text-[#739ddb]">Their armour turns its {m.strikes} (×1.15)</span>}
    </p>
  );
}

// ─── Between roads ──────────────────────────────────────────────────────────

interface HeroHomeProps {
  config: GameConfig;
  world: World;
  hero: Character | null;
  error: string | null;
  onEmbark: (hero: Character) => void;
  onCreateHero: () => void;
}

/** The player's hero at home, between roads; or, between lives, the way back to Create. */
function HeroHome({ config, world, hero, error, onEmbark, onCreateHero }: HeroHomeProps) {
  const lordReigns = world.roster.some((c) => c.role === 'demonLord');
  const done = hero?.adventures.length ?? 0;

  return (
    <>
      <h1 id="wheel-title" className="court-title text-4xl leading-none sm:text-5xl">
        Adventures
      </h1>
      <p className="mt-2 text-lg text-ash">
        One hero, from the first road to the last. Every road earns fame, and fame decides how their story ends.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-ember">
          {error}
        </p>
      )}

      {!hero ? (
        <div className="court-panel mt-8 p-5">
          <p className="font-display text-2xl text-candle">No hero walks the world</p>
          <p className="mt-1 text-vellum">
            {lordReigns
              ? 'Only the Demon Lord walks this world, and the Demon Lord does not adventure. Roll a hero to oppose them.'
              : 'Roll a soul, name them, and their story begins.'}
          </p>
          <button type="button" onClick={onCreateHero} className={`${primaryButton} mt-4`}>
            Roll a soul
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 items-center gap-x-4 gap-y-3 court-panel px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="truncate font-display text-2xl leading-tight text-candle">{hero.name}</p>
            {hero.title && <p className="truncate text-sm text-gilt-bright">{hero.title}</p>}
            <p className="text-sm text-ash">
              {[heroRace(config, hero), roleLabel(hero), `${calculatePowerRating(hero)} CP`].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-sm text-vellum">
              {done === 0 ? 'Never left home.' : `${done} adventure${done === 1 ? '' : 's'} behind them.`}
            </p>
            <FameMeter config={config} fame={hero.fame} />
            <HealthGauge character={hero} className="mt-3" unframed />
            <UnfinishedBusiness config={config} character={hero} />
          </div>
          <div className="flex items-end gap-4">
            <MeterBars config={config} character={hero} hideHealth />
          <button type="button" onClick={() => onEmbark(hero)} className={`${primaryButton} flex items-center gap-2`} autoFocus>
            <Footprints aria-hidden="true" size={16} />
            Set out
          </button>
          </div>
        </div>
      )}

      <KnownPlaces config={config} world={world} hero={hero} />
      <FameLadder config={config} />
    </>
  );
}

/** The fame tiers, read from config: what each one means. */
function FameLadder({ config }: { config: GameConfig }) {
  return (
    <div className="mt-8">
      <h2 className="text-sm text-ash">Fame</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {config.fame.tiers.map((tier) => (
          <li key={tier.name} className="rounded-md border-2 border-lead bg-slab px-3 py-2 text-sm">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-candle">{tier.name}</span>
              <span className="tabular-nums text-ash">{tier.min}+</span>
            </p>
            {tier.description && <p className="text-ash">{tier.description}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-ash">
        Harder foes and grander wins earn more fame. The famous take riskier roads, and their stories end on a
        throne, at the head of an army, in a classroom, in a grave, or sealed inside a relic for someone else to find.
      </p>
    </div>
  );
}

// ─── The end of an adventure ────────────────────────────────────────────────

interface AdventureOverProps {
  config: GameConfig;
  /** The hero as the world now holds them, this adventure included. */
  hero: Character;
  /** The hero as the adventure ended: their status and role say how. */
  ending: Character;
  /** Fame earned on this road. */
  fameEarned: number;
  /** How the story ended, if an option wrote it down. */
  note: string | null;
  onAgain: (hero: Character) => void;
  onNextSoul: (parent?: Character) => void;
  /** Their name means something, and their story is over: they can have an heir. */
  canRaiseHeir: boolean;
}

function AdventureOver({ config, hero, ending, fameEarned, note, onAgain, onNextSoul, canRaiseHeir }: AdventureOverProps) {
  const done = hero.adventures.length;
  const plural = done === 1 ? 'adventure' : 'adventures';
  const leave = (
    <Actions>
      {canRaiseHeir && (
        <button type="button" onClick={() => onNextSoul(hero)} className={primaryButton} autoFocus>
          Raise their heir
        </button>
      )}
      <button type="button" onClick={() => onNextSoul()} className={canRaiseHeir ? secondaryButton : primaryButton} autoFocus={!canRaiseHeir}>
        Roll the next soul
      </button>
      {canRaiseHeir && <p className="basis-full text-sm text-ash">An heir carries the house of {houseOf(hero)}, leans toward their parent’s ancestry, and starts with a little of their fame.</p>}
    </Actions>
  );
  const story = note && <p className="mt-1 font-semibold text-vellum">{note}.</p>;

  if (ending.status === 'fallen') {
    const martyr = ending.tags.includes('martyr');
    return (
      <EndCard eyebrow={martyr ? 'A hero’s sacrifice' : 'Adventure over'} title={martyr ? `${hero.name} gave their life` : `${hero.name} has fallen`} tone={martyr ? 'text-gilt-bright' : 'text-ember'}>
        {story}
        <p className="mt-1 text-vellum">
          {martyr
            ? 'They rest in the graveyard, and their grave becomes a shrine. Those who come after will pray there.'
            : 'They rest in the graveyard now. Those who come after may visit the grave, and what they carried may not stay buried.'}{' '}
          Any one-of-a-kind role they held is free again.
        </p>
        <div className="mt-5">
          <Epitaph character={hero} config={config} />
        </div>
        {leave}
      </EndCard>
    );
  }

  if (ending.status === 'sealed') {
    return (
      <EndCard eyebrow="Sealed away" title={`${hero.name} is bound inside a relic`} tone="text-gilt-bright">
        {story}
        <p className="mt-1 text-vellum">
          Not dead, not free. One day someone may find the relic, and carry their power, set them free, or be
          taken over by them.
        </p>
        {leave}
      </EndCard>
    );
  }

  if (ending.role === 'npc') {
    const life = lifeOf(ending);
    return (
      <EndCard eyebrow="A new life" title={life ? `${hero.name}, ${life.name}` : `${hero.name} begins a new life`} tone="text-moss">
        {story}
        <p className="mt-1 text-vellum">
          The adventuring is over, and a different story begins. They stay in the world
          {life ? `: ${life.description.charAt(0).toLowerCase()}${life.description.slice(1)}` : '.'} Those who come
          after may seek them out, learn from them, serve them, or cross them.
        </p>
        {leave}
      </EndCard>
    );
  }

  if (ending.role === 'outlaw' || ending.role === 'minion') {
    const outlaw = ending.role === 'outlaw';
    return (
      <EndCard
        eyebrow="Adventure over"
        title={outlaw ? `${hero.name} turns outlaw` : `${hero.name} kneels to the Demon Lord`}
        tone="text-ember"
      >
        <p className="mt-1 text-vellum">
          {outlaw
            ? 'They ride with the bandits now. Those who come after may meet them on the road, as a familiar face.'
            : 'They serve the Abyss now. Those who come after may meet them on the road, as its champion.'}{' '}
          Any one-of-a-kind role they held is free again.
        </p>
        {leave}
      </EndCard>
    );
  }

  if (ending.status !== 'alive') {
    return (
      <EndCard
        eyebrow="Adventure over"
        title={ending.status === 'victorious' ? `${hero.name} triumphs` : `${hero.name} retires in glory`}
        tone="text-gilt-bright"
      >
        {story}
        <p className="mt-1 text-vellum">
          After {done} {plural}, with {hero.fame} fame, they take their seat in the Hall of Fame. Those who come
          after may still seek them out for advice, or a duel. Any one-of-a-kind role they held is free again.
        </p>
        {leave}
      </EndCard>
    );
  }

  const before = fameStanding(config.fame.tiers, hero.fame - fameEarned);
  const now = fameStanding(config.fame.tiers, hero.fame);
  return (
    <EndCard eyebrow="Adventure over" title={`${hero.name} comes home`} tone="text-candle">
      <p className="mt-1 text-vellum">
        {done} {plural} behind them, {calculatePowerRating(hero)} combat power,{' '}
        {fameEarned === 0 ? 'and no new fame from this road.' : `${signed(fameEarned)} fame from this road.`}
      </p>
      {now.index > before.index && (
        <p className="mt-1 font-semibold text-gilt-bright">
          Now {now.tier.name}. {now.tier.description}
        </p>
      )}
      <FameMeter config={config} fame={hero.fame} />
      <Actions>
        <button type="button" onClick={() => onAgain(hero)} className={primaryButton} autoFocus>
          Another adventure
        </button>
      </Actions>
    </EndCard>
  );
}

function EndCard({ eyebrow, title, tone, children }: { eyebrow: string; title: string; tone: string; children: ReactNode }) {
  return (
    <div className="court-panel p-5">
      <h3 className={`font-display text-3xl leading-tight ${tone}`}>{title}</h3>
      <p className="text-sm italic text-ash">{eyebrow}</p>
      {children}
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap gap-3">{children}</div>;
}
