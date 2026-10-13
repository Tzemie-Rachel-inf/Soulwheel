/**
 * The Adventures tab: the player's one hero, between roads or on one. Once they set out it is
 * the same spin-reveal loop as creation, on the adventure wheels, until their story ends.
 * There is no retirement wheel: heroes earn fame, and fame leads to the endings. Wheels,
 * odds, outcomes and fame tiers all come from config.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Footprints } from 'lucide-react';
import { isWhoStep } from '../engine/adventure';
import { fameStanding } from '../engine/fame';
import { fightOdds } from '../engine/odds';
import { calculatePowerRating } from '../engine/power';
import type { Character, Foe, GameConfig, WheelStep, World } from '../engine/types';
import { findCharacter } from '../engine/world';
import type { useAdventure } from '../state/useAdventure';
import { FameMeter } from './FameMeter';
import { Epitaph } from './Headstone';
import { formatPercent, fullName, lifeOf, ordinal, raceName, roleLabel, signed } from './format';
import { OddsList } from './OddsList';
import { enter } from './motion';
import { ChoicePanel, QuestPanel, QuestTale } from './QuestPanel';
import { OutcomeCard, primaryButton, secondaryButton } from './RollReveal';
import { canNameHeir, houseOf } from '../engine/lineage';
import { SpinWheel } from './wheel/SpinWheel';
import { ExpeditionBanner, KnownPlaces, MeterBars, UnfinishedBusiness } from './Stakes';

interface AdventureTabProps {
  config: GameConfig;
  world: World;
  /** The player's hero, while they live. */
  hero: Character | null;
  adventure: ReturnType<typeof useAdventure>;
  onCreateHero: () => void;
  /** Their story is over: on to the next soul, or to the heir of `parent`. */
  onNextSoul: (parent?: Character) => void;
}

export function AdventureTab({ config, world, hero: living, adventure, onCreateHero, onNextSoul }: AdventureTabProps) {
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

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ash">
            {hero.name}’s {ordinal(number)} adventure · <span className="text-gilt-bright">{standing.tier.name}</span>,{' '}
            {hero.fame} fame
            {earned !== 0 && <span className={earned > 0 ? 'text-moss' : 'text-ember'}> ({signed(earned)} on this road)</span>}
          </p>
          <h1 id="wheel-title" className="court-title mt-1 text-4xl leading-none sm:text-5xl">
            {view.step?.title ?? 'The road'}
          </h1>
          {view.step?.subtitle && <p className="mt-2 text-lg text-ash">{view.step.subtitle}</p>}
        </div>
        <MeterBars config={config} character={view.character} className="shrink-0 pt-1" />
      </div>
      {view.character.expedition && <ExpeditionBanner config={config} expedition={view.character.expedition} />}
      {view.character.story && <QuestPanel story={view.character.story} hero={view.character} config={config} />}
      {cast && !view.step?.foe && <CastBanner config={config} cast={cast} />}
      {view.step?.foe && <Duel hero={hero} step={view.step} foe={view.step.foe} castFoe={cast} />}

      <div className="mt-8">
        {view.step?.choice ? (
          <>
            <p className="mb-3 text-sm text-ash">Your decision. Each choice says what it gives, what it risks, and whether a wheel decides how it goes.</p>
            <ChoicePanel
              slices={view.slices}
              config={config}
              chosenIndex={landed ? view.winnerIndex : null}
              disabled={session.phase !== 'ready'}
              onChoose={adventure.choose}
            />
          </>
        ) : (
          <SpinWheel
            slices={view.slices}
            spin={adventure.spinRequest}
            highlightIndex={landed ? view.winnerIndex : null}
            canSpin={view.canSpin}
            onSpinRequest={adventure.spin}
            onSettled={adventure.settle}
            label={view.step?.title ?? 'Adventure wheel'}
            golden={view.step?.golden}
          />
        )}
      </div>

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
          {session.phase === 'revealing' && outcome && (
            <motion.div key={`reveal-${outcome.step.id}-${outcome.state.stepsTaken}`} {...enter}>
              <OutcomeCard
                outcome={outcome}
                config={config}
                onContinue={adventure.next}
                finishLabel="See how it ends"
                castName={roll?.cast}
                note={roll?.note}
                fame={roll?.fame}
                callback={roll?.callback}
                event={roll?.event}
              />
            </motion.div>
          )}
          {session.phase === 'complete' && (
            <motion.div key="complete" {...enter}>
              <AdventureOver
                config={config}
                hero={findCharacter(world, hero.id) ?? hero}
                ending={hero}
                fameEarned={earned}
                note={session.state.fate}
                onAgain={(again) => adventure.embark(again)}
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
              slices={view.slices}
              winnerIndex={landed ? view.winnerIndex : null}
              title={view.step.title}
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
  const race = raceName(config, cast.race);
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
      {castFoe && (
        <p className="mt-1 text-sm text-ember">
          {castFoe.name} once rode as a hero. Now: {roleLabel(castFoe).toLowerCase()}.
        </p>
      )}
    </div>
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
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 court-panel px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-display text-2xl leading-tight text-candle">{hero.name}</p>
            {hero.title && <p className="truncate text-sm text-gilt-bright">{hero.title}</p>}
            <p className="text-sm text-ash">
              {[raceName(config, hero.race), roleLabel(hero), `${calculatePowerRating(hero)} CP`].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-sm text-vellum">
              {done === 0 ? 'Never left home.' : `${done} adventure${done === 1 ? '' : 's'} behind them.`}
            </p>
            <FameMeter config={config} fame={hero.fame} />
            <UnfinishedBusiness config={config} character={hero} />
          </div>
          <div className="flex items-end gap-4">
            <MeterBars config={config} character={hero} />
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
