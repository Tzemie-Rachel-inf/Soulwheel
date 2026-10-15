/**
 * The shell: two tabs over one world, and one life at a time. "Create" rolls a soul; the
 * moment it is named, "Adventures" takes it down the road, again and again, until its story
 * ends: in a grave, on a throne, in the Hall of Fame. Only then is the next soul rolled.
 *
 * There is no wheel-specific logic here. Which wheel shows, what it contains and
 * what comes next all come from GAME_CONFIG through the engine.
 */
import { Suspense, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, Volume2, VolumeX } from 'lucide-react';
import { GAME_CONFIG } from './config/gameConfig';
import { DEV_TOOLS_ENABLED, WheelInspector } from './devtools';
import { setDevPick, useDevPick } from './ui/devPick';
import { STAT_KEYS, type Character, type GameConfig, type WheelStep, type World } from './engine/types';
import { validateGameConfig } from './engine/validate';
import { findCharacter, playerHero } from './engine/world';
import { useAdventure } from './state/useAdventure';
import { useCharacterGeneration } from './state/useCharacterGeneration';
import { useProfileTracker } from './state/useProfileTracker';
import { useWorld } from './state/useWorld';
import { AdventureTab } from './ui/AdventureTab';
import { ChronicleTab } from './ui/ChronicleTab';
import { FeatToasts } from './ui/FeatToasts';
import { SeedPanel } from './ui/SeedPanel';
import { CharacterCard } from './ui/CharacterCard';
import { OddsList } from './ui/OddsList';
import { sound, useSoundMuted } from './ui/sound';
import { RollReveal, primaryButton } from './ui/RollReveal';
import { returnToWheel } from './ui/motion';
import { WorldPanel } from './ui/WorldPanel';
import { STAT_LABELS, signed } from './ui/format';
import { isSpecialRarity, rarityOf } from './ui/rarity';
import { SpinWheel } from './ui/wheel/SpinWheel';
import { withAlpha } from './ui/wheel/color';
import { glassColor } from './ui/wheel/paintWheel';

type Tab = 'create' | 'adventure' | 'chronicle' | 'wheels';
const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: 'Create' },
  { id: 'adventure', label: 'Adventures' },
  { id: 'chronicle', label: 'Chronicle' },
  // Dev tools: browse and spin any wheel. Switched off in src/devtools/index.ts.
  ...(DEV_TOOLS_ENABLED ? [{ id: 'wheels' as const, label: 'Wheels' }] : []),
];

export default function App() {
  const report = useMemo(() => validateGameConfig(GAME_CONFIG), []);
  if (report.errors.length > 0) return <ConfigErrors errors={report.errors} />;
  return <Game config={GAME_CONFIG} />;
}

function Game({ config }: { config: GameConfig }) {
  const { world, commit, finishAdventure, setThreatLevel, resetWorld } = useWorld(config);
  const generation = useCharacterGeneration(config, world);
  const adventure = useAdventure(config, world, finishAdventure);
  const tracker = useProfileTracker(world, config);
  // A living hero's place is on the road: open there, even after a reload.
  const [tab, setTab] = useState<Tab>(() => (playerHero(world) ? 'adventure' : 'create'));
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const inspected = inspectedId ? (findCharacter(world, inspectedId) ?? null) : null;
  const hero = playerHero(world);

  // The room takes on the colour of whichever pane the light just came through.
  const active =
    tab === 'create'
      ? { phase: generation.session.phase, view: generation.view }
      : tab === 'adventure' && adventure.session && adventure.view
        ? { phase: adventure.session.phase, view: adventure.view }
        : null;
  const landed = active !== null && (active.phase === 'revealing' || active.phase === 'complete');
  const winner = landed && active.view.winnerIndex !== null ? active.view.slices[active.view.winnerIndex] : undefined;
  const glow = winner ? { color: glassColor(winner), strength: isSpecialRarity(rarityOf(winner.option)) ? 0.42 : 0.3 } : null;

  const handleCommit = (name: string) => {
    const rolled = generation.view.character;
    const result = commit(name ? { ...rolled, name } : rolled);
    if (!result.ok) {
      setCommitError(result.message);
      return;
    }
    setCommitError(null);
    generation.restart();
    const committed = playerHero(result.world);
    if (committed) {
      // Named, and straight onto the road: this is their life now.
      setNotice(null);
      setInspectedId(null);
      adventure.embark(committed);
      setTab('adventure');
    } else {
      const placed = findCharacter(result.world, rolled.id);
      const fate = placed?.role === 'demonLord' ? 'now reigns as the Demon Lord' : 'takes their place in the world';
      setNotice(`${placed?.name ?? 'They'} ${fate}. Roll a hero to face what comes.`);
    }
  };

  /** A story is over: back to Create, for the next soul, or for an heir to a house. */
  const handleNextSoul = (parent?: Character) => {
    adventure.leave();
    setNotice(null);
    setInspectedId(null);
    generation.restart(parent ? { heirOf: parent } : null);
    setTab('create');
  };
  const lineage = generation.view.character.lineage;
  const heirParent = lineage ? (findCharacter(world, lineage.parentId) ?? null) : null;

  const handleDiscard = () => {
    setCommitError(null);
    generation.restart();
  };

  const handleReset = () => {
    resetWorld();
    setInspectedId(null);
    setCommitError(null);
    setNotice(null);
    generation.restart();
    adventure.leave();
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <FeatToasts toasts={tracker.toasts} overflow={tracker.overflow} onDismiss={tracker.dismiss} />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(70rem 46rem at 28% 36%, rgba(240, 190, 100, 0.09), rgba(0, 0, 0, 0) 70%)' }}
        />
        <AnimatePresence>
          {glow && (
            <motion.div
              key={glow.color}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              style={{
                background: `radial-gradient(60rem 42rem at 28% 36%, ${withAlpha(glow.color, glow.strength)}, rgba(0, 0, 0, 0) 70%)`,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <header className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <GiltRod />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex items-center gap-3 pt-4">
            <Crest />
            <div>
              <p className="font-blackletter text-4xl leading-none text-candle [text-shadow:0_2px_0_rgba(0,0,0,0.6),0_0_24px_rgba(240,205,108,0.25)]">
                Soulwheel
              </p>
              <p className="mt-1 text-sm italic text-ash">Roll a soul. Send it into the world.</p>
            </div>
          </div>
          <div className="flex w-full items-start gap-2 sm:w-auto sm:gap-3">
            <TabBar
              tab={tab}
              onChange={setTab}
              badges={{
                create: null,
                adventure: adventure.session && adventure.session.phase !== 'complete' ? 'under way' : null,
                chronicle: null,
                wheels: 'dev',
              }}
            />
            <div className="flex gap-2 pt-4">
              {DEV_TOOLS_ENABLED && <DevPickToggle />}
              <SoundToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-20 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-12">
        {tab === 'wheels' && WheelInspector ? (
          <section id="panel-wheels" role="tabpanel" aria-labelledby="tab-wheels" className="min-w-0 lg:col-span-2">
            <Suspense fallback={<p className="text-ash">Loading the dev tools…</p>}>
              <WheelInspector config={config} world={world} />
            </Suspense>
          </section>
        ) : (
          <>
            <section
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="min-w-0"
            >
              {tab === 'create' ? (
                hero ? (
                  <HeroStillAlive hero={hero} onReturn={() => setTab('adventure')} />
                ) : (
                  <CreateTab
                    config={config}
                    generation={generation}
                    parent={heirParent}
                    notice={notice}
                    commitError={commitError}
                    onCommit={handleCommit}
                    onDiscard={handleDiscard}
                  />
                )
              ) : tab === 'chronicle' ? (
                <ChronicleTab
                  world={world}
                  config={config}
                  canRaiseHeir={!hero}
                  onRaiseHeir={handleNextSoul}
                  inspectedId={inspectedId}
                  onInspect={(id) => setInspectedId((current) => (current === id ? null : id))}
                />
              ) : (
                <AdventureTab
                  config={config}
                  world={world}
                  hero={hero ?? null}
                  adventure={adventure}
                  onCreateHero={() => setTab('create')}
                  onNextSoul={handleNextSoul}
                />
              )}
            </section>

            <aside className="flex min-w-0 flex-col gap-6" aria-label="Character and world">
              <SideCard
                tab={tab}
                config={config}
                inspected={inspected}
                onCloseInspect={() => setInspectedId(null)}
                generation={generation}
                adventure={adventure}
                hero={hero ?? null}
                world={world}
              />
              <WorldPanel
                world={world}
                config={config}
                inspectedId={inspectedId}
                onInspect={(id) => setInspectedId((current) => (current === id ? null : id))}
                onThreatChange={setThreatLevel}
                onReset={handleReset}
              />
            </aside>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

/** Dev only: while on, clicking a wheel slice spins it and lands there. */
function DevPickToggle() {
  const on = useDevPick();
  return (
    <button
      type="button"
      onClick={() => setDevPick(!on)}
      aria-pressed={on}
      aria-label={on ? 'Dev pick on: click a slice to land on it. Turn it off' : 'Dev pick off. Turn it on'}
      title={on ? 'Dev pick ON: click a slice to land on it' : 'Dev pick: click a slice to land on it'}
      className="btn-plaque p-2"
    >
      <Crosshair aria-hidden="true" size={18} className={on ? 'text-candle' : 'text-ash'} />
    </button>
  );
}

function SoundToggle() {
  const muted = useSoundMuted();
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={() => sound.setMuted(!muted)}
      aria-pressed={!muted}
      aria-label={muted ? 'Sound off. Turn it on' : 'Sound on. Turn it off'}
      title={muted ? 'Sound off' : 'Sound on'}
      className="btn-plaque p-2"
    >
      <Icon aria-hidden="true" size={18} className={muted ? 'text-ash' : 'text-candle'} />
    </button>
  );
}

function TabBar({ tab, onChange, badges }: { tab: Tab; onChange: (tab: Tab) => void; badges: Record<Tab, string | null> }) {
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // Arrow keys move between tabs, as the ARIA tabs pattern expects.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!.id;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Mode" onKeyDown={onKeyDown} className="banner-rail flex min-w-0 flex-1 gap-1 sm:flex-none sm:gap-2 sm:px-1">
      {TABS.map(({ id, label }) => {
        const selected = id === tab;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[id] = el;
            }}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={`banner min-w-0 flex-auto sm:flex-none ${selected ? 'banner-active banner-sway' : ''}`}
          >
            <span className="banner-cloth">
              <span className="font-caps text-[0.8rem] font-bold leading-tight sm:text-lg sm:tracking-wide">{label}</span>
              {badges[id] && (
                <span className="mt-0.5 block text-[0.7rem] italic leading-none opacity-85">{badges[id]}</span>
              )}
              <span aria-hidden="true" className="banner-charge" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The gilt rod the banners hang from, with a finial at each end. */
function GiltRod() {
  return (
    <div aria-hidden="true" className="relative h-3">
      <div className="absolute inset-x-2 top-1 h-[5px] border-y border-gilt-deep bg-gilt shadow-[0_3px_6px_rgba(0,0,0,0.7)]" />
      <div className="absolute left-0 top-0 size-3 rotate-45 border border-gilt-deep bg-gilt-bright shadow-[0_2px_4px_rgba(0,0,0,0.7)]" />
      <div className="absolute right-0 top-0 size-3 rotate-45 border border-gilt-deep bg-gilt-bright shadow-[0_2px_4px_rgba(0,0,0,0.7)]" />
    </div>
  );
}

/** The house arms: a gilt wheel on a field of gules, under a small crown. */
function Crest() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 58" className="h-14 w-12 shrink-0 drop-shadow-[0_3px_4px_rgba(0,0,0,0.7)]">
      <defs>
        <linearGradient id="crest-gilt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0bd" />
          <stop offset="0.5" stopColor="var(--color-gilt)" />
          <stop offset="1" stopColor="#7a561a" />
        </linearGradient>
        <linearGradient id="crest-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-gules-bright)" />
          <stop offset="1" stopColor="#6a1220" />
        </linearGradient>
      </defs>
      <path d="M14 9 17 3l4 4 3-6 3 6 4-4 3 6Z" fill="url(#crest-gilt)" stroke="#3a2508" strokeWidth="1" strokeLinejoin="round" />
      <path d="M4 11h40v20c0 13-9 21-20 25C13 52 4 44 4 31Z" fill="url(#crest-gilt)" stroke="#3a2508" strokeWidth="1.2" />
      <path d="M7.5 14h33v17c0 10.5-7 17.5-16.5 21C14.5 48.5 7.5 41.5 7.5 31Z" fill="url(#crest-field)" />
      <g fill="none" stroke="url(#crest-gilt)" strokeWidth="2">
        <circle cx="24" cy="30" r="10" />
        <circle cx="24" cy="30" r="2.5" fill="var(--color-gilt-bright)" />
        <path d="M24 20v20M14 30h20M17 23l14 14M31 23 17 37" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

// ─── Create tab ─────────────────────────────────────────────────────────────

interface CreateTabProps {
  config: GameConfig;
  generation: ReturnType<typeof useCharacterGeneration>;
  /** The parent of the soul being rolled, when it is an heir. */
  parent: Character | null;
  /** What became of the last soul, when it was not a hero (a Demon Lord took the throne). */
  notice: string | null;
  commitError: string | null;
  onCommit: (name: string) => void;
  onDiscard: () => void;
}

function CreateTab({ config, generation, parent, notice, commitError, onCommit, onDiscard }: CreateTabProps) {
  const { session, view } = generation;
  const landed = session.phase === 'upgrading' || session.phase === 'revealing' || session.phase === 'complete';
  return (
    <>
      {notice && <p className="court-panel mb-4 px-4 py-2 text-gilt-bright">{notice}</p>}
      <SeedPanel
        character={session.state.character}
        fresh={session.phase === 'ready' && session.state.stepsTaken === 0}
        parent={parent}
        onRoll={generation.restart}
      />
      <h1 id="wheel-title" className="court-title text-4xl leading-none sm:text-5xl">
        {view.step?.title ?? 'No wheel'}
      </h1>
      {view.step?.subtitle && <p className="mt-2 text-lg text-ash">{view.step.subtitle}</p>}
      {view.step && <StatRollNote step={view.step} character={session.state.character} />}

      <div className="mt-8">
        <SpinWheel
          slices={view.slices}
          spin={generation.spinRequest}
          highlightIndex={landed ? view.winnerIndex : null}
          canSpin={view.canSpin}
          onSpinRequest={generation.spin}
          onSettled={generation.settle}
          upgrade={generation.upgradeRequest}
          onUpgraded={generation.upgraded}
          label={view.step?.title ?? 'Wheel'}
          golden={view.step?.golden}
        />
      </div>

      {generation.error && (
        <p role="alert" className="mt-4 text-ember">
          {generation.error}
        </p>
      )}
      {session.phase === 'ready' && !view.canSpin && !generation.error && (
        <p className="mt-4 text-ember">Every slice on this wheel is locked right now.</p>
      )}

      <div className="mt-8">
        <RollReveal
          phase={session.phase}
          outcome={session.pending ?? session.last}
          character={view.character}
          config={config}
          commitError={commitError}
          onContinue={() => {
            generation.next();
            returnToWheel();
          }}
          onCommit={onCommit}
          onDiscard={onDiscard}
        />
      </div>

      {view.step && (
        <div className="mt-8">
          <h2 className="gilt-rule font-caps text-base tracking-wider text-ash">Odds on this wheel</h2>
          <div className="mt-3">
            <OddsList
              slices={view.slices}
              winnerIndex={landed ? view.winnerIndex : null}
              title={view.step.title}
              stepId={view.step.id}
              config={config}
              character={session.state.character}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** Create, while the player's hero lives: one life at a time. */
function HeroStillAlive({ hero, onReturn }: { hero: Character; onReturn: () => void }) {
  return (
    <>
      <h1 id="wheel-title" className="court-title text-4xl leading-none sm:text-5xl">
        One life at a time
      </h1>
      <p className="mt-2 text-lg text-ash">
        {hero.name}’s story isn’t over yet. The next soul is rolled when it ends: in a grave, on a throne, or in the
        Hall of Fame.
      </p>
      <button type="button" onClick={onReturn} className={`${primaryButton} mt-6`} autoFocus>
        Back to {hero.name}
      </button>
    </>
  );
}

/** On a stat wheel: what the banked bonus will do to the roll, and what luck has done to the slices. */
function StatRollNote({ step, character }: { step: WheelStep; character: Character }) {
  const stat = STAT_KEYS.find((k) => step.options.some((o) => o.setStats?.[k] !== undefined));
  if (!stat) return null;
  const bank = character.statBonus[stat];
  const tiers = Math.abs(bank) === 1 ? 'position' : 'positions';
  const parts = [
    bank > 0 && `${signed(bank)} ${STAT_LABELS[stat]} banked: once the wheel lands, the result is hammered up ${bank} ${tiers} (past the top, into Ascension)`,
    bank < 0 && `${signed(bank)} ${STAT_LABELS[stat]} banked: once the wheel lands, the result is knocked down ${-bank} ${tiers}`,
    character.luck !== 0 &&
      `luck ${signed(character.luck)} has tilted the slices toward the ${character.luck > 0 ? 'better' : 'poorer'} tiers`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const text = parts.join('; ');
  return <p className="mt-2 text-sm text-gilt-bright">{text.charAt(0).toUpperCase() + text.slice(1)}.</p>;
}

// ─── Side card ──────────────────────────────────────────────────────────────

interface SideCardProps {
  tab: Tab;
  config: GameConfig;
  inspected: Character | null;
  onCloseInspect: () => void;
  generation: ReturnType<typeof useCharacterGeneration>;
  adventure: ReturnType<typeof useAdventure>;
  /** The player's hero, while they live. */
  hero: Character | null;
  world: World;
}

/** Whoever the player is looking at: an inspected soul, the one being rolled, or the player's hero. */
function SideCard({ tab, config, inspected, onCloseInspect, generation, adventure, hero, world }: SideCardProps) {
  if (inspected) {
    return (
      <CharacterCard
        character={inspected}
        previous={null}
        config={config}
        status={statusLine(inspected)}
        onClose={onCloseInspect}
      />
    );
  }
  if (tab === 'create' && !hero) {
    const { session, view } = generation;
    return (
      <CharacterCard
        character={view.character}
        previous={view.previous}
        config={config}
        status={session.phase === 'complete' ? 'ready to enter the world' : 'being rolled'}
      />
    );
  }
  if (adventure.session && adventure.view) {
    const { previous } = adventure.view;
    const over = adventure.session.phase === 'complete';
    // Once the road ends, the world holds the hero with this adventure written into their record.
    const character = (over && findCharacter(world, adventure.view.character.id)) || adventure.view.character;
    const status = over ? statusLine(character, 'home again') : 'on an adventure';
    return <CharacterCard character={character} previous={previous} config={config} status={status} />;
  }
  if (hero) return <CharacterCard character={hero} previous={null} config={config} status="between adventures" />;
  return null;
}

/** Where a character stands, for the card's status line. */
function statusLine(char: Character, alive = 'in the world'): string {
  if (char.status === 'fallen') return 'resting in the graveyard';
  if (char.status === 'retired' || char.status === 'victorious') return 'in the hall of fame';
  if (char.status === 'sealed') return 'sealed inside a relic';
  if (char.role === 'outlaw') return 'riding with the bandits';
  if (char.role === 'minion') return 'serving the Demon Lord';
  if (char.role === 'npc') return 'living a new life in the world';
  return alive;
}

function ConfigErrors({ errors }: { errors: string[] }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="court-title text-4xl">The wheel config has errors</h1>
      <p className="mt-2 text-vellum">Fix these in src/config/gameConfig.ts, then reload.</p>
      <ul className="mt-6 grid gap-2">
        {errors.map((e) => (
          <li key={e} className="court-panel px-4 py-2 text-ember">
            {e}
          </li>
        ))}
      </ul>
    </main>
  );
}
