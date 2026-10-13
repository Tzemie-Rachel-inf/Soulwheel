/**
 * Dev tools: the Wheels tab. Pick any wheel, see it as a chosen test subject would face
 * it, spin it (or force a result), and follow its links to the next wheel. Spins here
 * never touch the saved world or any character in it.
 *
 * Switched on and off in ./index.ts.
 */
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from 'lucide-react';
import { MAX_ARMOR_TIER, MAX_WEAPON_TIER, applyOption } from '../engine/character';
import { fameStanding } from '../engine/fame';
import { rollFullCharacter } from '../engine/generation';
import { dealOptions, fightOdds } from '../engine/odds';
import { calculatePowerRating } from '../engine/power';
import { resolveSlices, rollWeightedOption } from '../engine/roll';
import { STAT_KEYS, type Character, type GameConfig, type RollResult, type WheelStep, type World } from '../engine/types';
import { validateGameConfig } from '../engine/validate';
import { ROLE_LABELS, STAT_LABELS, formatPercent, raceName, signed } from '../ui/format';
import { OutcomeCard, secondaryButton } from '../ui/RollReveal';
import { SpinWheel, type SpinRequest, type UpgradeRequest } from '../ui/wheel/SpinWheel';
import { bumpLadder, ladderStat, type LadderBump } from '../engine/ladder';
import { asSubject, blankSubject, labStep, nextWheel } from './lab';
import { OptionTable } from './OptionTable';
import { buildCatalog, GROUP_LABELS, incomingLinks } from './wheelCatalog';
import { WheelList } from './WheelList';

const SPEEDS = { normal: 5200, fast: 1200, instant: 1 } as const;
type Speed = keyof typeof SPEEDS;

/** A spin in the lab: decided up front like the game's, then animated. */
interface LabSpin {
  id: number;
  /** spinning → (upgrading, while banked bonuses play out) → landed */
  phase: 'spinning' | 'upgrading' | 'landed';
  step: WheelStep;
  roll: RollResult;
  /** How the subject's banked bonuses move this roll, if they do. */
  bump: LadderBump | null;
}

// Per-browser conveniences only: the last wheel looked at, spin speed, carry-forward.
const PREFS_KEY = 'soulwheel:devtools';
interface Prefs {
  stepId?: string;
  speed?: Speed;
  carry?: boolean;
}
function loadPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Prefs;
  } catch {
    return {};
  }
}
function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the tools still work, they just forget.
  }
}

export default function WheelInspector({ config, world }: { config: GameConfig; world: World }) {
  const catalog = useMemo(() => buildCatalog(config), [config]);
  const warnings = useMemo(() => validateGameConfig(config).warnings, [config]);
  const [stepId, setStepId] = useState(() => {
    const saved = loadPrefs().stepId;
    return saved && catalog.byId[saved] ? saved : config.entryStepId;
  });
  const [speed, setSpeed] = useState<Speed>(() => loadPrefs().speed ?? 'fast');
  const [carry, setCarry] = useState(() => loadPrefs().carry ?? false);
  const [trail, setTrail] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [subject, setSubjectState] = useState(() => blankSubject(config));
  const [threat, setThreatState] = useState<number | null>(null);
  const [castIds, setCastIds] = useState<Record<string, string>>({});
  const [spin, setSpin] = useState<LabSpin | null>(null);
  const [nextSpinId, setNextSpinId] = useState(1);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => savePrefs({ stepId, speed, carry }), [stepId, speed, carry]);

  const entry = catalog.byId[stepId] ?? catalog.entries[0]!;
  const position = catalog.entries.indexOf(entry);
  const labWorld = useMemo(() => (threat === null ? world : { ...world, threatLevel: threat }), [world, threat]);
  const pool = useMemo(() => entry.step.cast?.from(labWorld, subject).filter((c) => c.id !== subject.id) ?? [], [entry, labWorld, subject]);
  const cast = pool.find((c) => c.id === castIds[entry.id]) ?? pool[0] ?? null;
  const step = useMemo(() => labStep(config, entry.id, cast, subject), [config, entry, cast, subject]);
  const dealt = useMemo(() => dealOptions(step, subject, config), [step, subject, config]);
  const liveSlices = useMemo(() => resolveSlices(dealt, labWorld, subject), [dealt, labWorld, subject]);

  const shownStep = spin?.step ?? step;
  const slices = spin?.roll.slices ?? liveSlices;
  const landed = spin?.phase === 'landed' ? spin : null;
  const spinning = spin?.phase === 'spinning' || spin?.phase === 'upgrading';
  const canSpin = !spinning && liveSlices.some((s) => s.effectiveWeight > 0);

  /** Anything that changes the wheel puts the last spin away. */
  const clearSpin = () => {
    setSpin(null);
    setApplied(false);
    setError(null);
  };

  const goTo = useCallback(
    (id: string) => {
      if (id === stepId) return;
      setTrail((t) => [...t.slice(-49), stepId]);
      setStepId(id);
      setSpin(null);
      setApplied(false);
      setError(null);
    },
    [stepId],
  );

  const move = useCallback(
    (by: number) => {
      const n = catalog.entries.length;
      goTo(catalog.entries[(position + by + n) % n]!.id);
    },
    [catalog, position, goTo],
  );

  const back = () => {
    const previous = trail.at(-1);
    if (previous === undefined) return;
    setTrail((t) => t.slice(0, -1));
    setStepId(previous);
    clearSpin();
  };

  // ← and → step through every wheel in flow order, unless a field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      move(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const startSpin = (forced?: number) => {
    if (spinning) return;
    try {
      const roll: RollResult =
        forced === undefined
          ? rollWeightedOption(dealt, labWorld, subject)
          : { slices: liveSlices, winner: liveSlices[forced]!, draw: -1 };
      setSpin({ id: nextSpinId, phase: 'spinning', step, roll, bump: bumpLadder(step, roll.slices, roll.winner.index, subject) });
      setNextSpinId((n) => n + 1);
      setApplied(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const spinRequest = useMemo<SpinRequest | null>(
    () => (spin?.phase === 'spinning' ? { id: spin.id, targetIndex: spin.roll.winner.index } : null),
    [spin],
  );
  const settle = useCallback(
    (id: number) =>
      setSpin((s) => (s && s.id === id && s.phase === 'spinning' ? { ...s, phase: s.bump ? 'upgrading' : 'landed' } : s)),
    [],
  );
  const upgraded = useCallback(
    (id: number) => setSpin((s) => (s && s.id === id && s.phase === 'upgrading' ? { ...s, phase: 'landed' } : s)),
    [],
  );
  const upgradeRequest = useMemo<UpgradeRequest | null>(
    () =>
      spin?.phase === 'upgrading' && spin.bump
        ? {
            id: spin.id,
            path: spin.bump.path,
            overflow: spin.bump.overflow,
            direction: spin.bump.stages < 0 ? -1 : 1,
            effect: spin.step.upgradeEffect,
          }
        : null,
    [spin],
  );

  const setSubject = (next: Character) => {
    setSubjectState(next);
    clearSpin();
  };
  const applyWinner = () => {
    if (!landed) return;
    const record = landed.bump ? { probability: landed.roll.winner.probability, bumpedFrom: landed.roll.winner.option.id } : undefined;
    setSubjectState(applyOption(subject, result!, landed.step.id, config, record));
    setApplied(true);
  };
  /** On to the wheel the result leads to, keeping the result first when carrying forward. */
  const follow = (id: string) => {
    if (carry && !applied) applyWinner();
    goTo(id);
  };

  // Where the roll ends up: banked bonuses may have moved it from where the wheel landed.
  const result = landed ? (landed.bump ? landed.roll.slices[landed.bump.to]! : landed.roll.winner) : null;
  const next: ReturnType<typeof nextWheel> | null = !landed
    ? null
    : landed.bump?.overflow && landed.step.overflow
      ? { kind: 'step', id: landed.step.overflow }
      : nextWheel(config, landed.step, result!.option, subject, labWorld, entry.group);
  const nextId = next?.kind === 'step' ? next.id : null;
  const incoming = useMemo(() => incomingLinks(config, entry.id), [config, entry]);
  const ownWarnings = warnings.filter((w) => w.includes(`"${entry.id}"`));

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <WheelList
          config={config}
          catalog={catalog}
          currentId={entry.id}
          query={query}
          onQueryChange={setQuery}
          onSelect={goTo}
        />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ash">
            <span className="rounded-sm border border-dashed border-gilt px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-gilt-bright">
              Dev
            </span>{' '}
            {GROUP_LABELS[entry.group]} · wheel {position + 1} of {catalog.entries.length}
          </p>
          <div className="flex gap-2">
            <NavButton onClick={back} disabled={trail.length === 0} label="Back to the last wheel">
              <ArrowLeft aria-hidden="true" size={16} /> Back
            </NavButton>
            <NavButton onClick={() => move(-1)} label="Previous wheel (←)">
              <ChevronLeft aria-hidden="true" size={16} /> Prev
            </NavButton>
            <NavButton onClick={() => move(1)} label="Next wheel (→)">
              Next <ChevronRight aria-hidden="true" size={16} />
            </NavButton>
          </div>
        </div>

        <h1 className="mt-3 court-title text-4xl leading-none sm:text-5xl">{entry.name}</h1>
        {step.subtitle && <p className="mt-2 text-lg text-ash">{step.subtitle}</p>}
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ash">
          <code className="select-all rounded-sm bg-slab px-1.5 font-mono text-vellum">{entry.id}</code>
          <span>{step.options.length} options</span>
          {step.ladder && <span>ladder</span>}
          {step.cast && <span>casts from the world{step.cast.asFoe ? ' as the foe' : ''}</span>}
        </p>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            <SpinWheel
              slices={slices}
              spin={spinRequest}
              highlightIndex={landed ? result!.index : spin?.phase === 'upgrading' ? spin.roll.winner.index : null}
              canSpin={canSpin}
              onSpinRequest={() => startSpin()}
              onSettled={settle}
              upgrade={upgradeRequest}
              onUpgraded={upgraded}
              label={entry.name}
              spinMs={SPEEDS[speed]}
              golden={shownStep.golden}
              maxSize={480}
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="text-ash">Spin speed</span>
              <Segmented value={speed} options={Object.keys(SPEEDS) as Speed[]} onChange={setSpeed} />
            </div>
            {error && (
              <p role="alert" className="mt-4 text-ember">
                {error}
              </p>
            )}
            {!canSpin && !spinning && !error && (
              <p className="mt-4 text-center text-ember">Every slice is locked for this subject and world. Force one below.</p>
            )}
            {landed && (
              <div className="mt-6">
                <OutcomeCard
                  key={landed.id}
                  outcome={{
                    step: landed.step,
                    roll: landed.roll,
                    bump: landed.bump,
                    state: { currentStepId: nextId, stepsTaken: landed.id, character: subject },
                  }}
                  config={config}
                  castName={cast?.name}
                  onContinue={() => (nextId ? follow(nextId) : startSpin())}
                  finishLabel="Spin again"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {nextId && (
                    <button type="button" onClick={() => startSpin()} className={secondaryButton}>
                      Spin again
                    </button>
                  )}
                  <button type="button" onClick={applyWinner} disabled={applied} className={`${secondaryButton} disabled:opacity-50`}>
                    {applied ? 'Applied to the test subject' : 'Apply to the test subject'}
                  </button>
                  <label className="flex items-center gap-2 text-sm text-ash">
                    <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.currentTarget.checked)} className="accent-gilt" />
                    Keep results when continuing
                  </label>
                  {next?.kind === 'end' && <span className="text-sm text-ash">Ends here: {next.reason}.</span>}
                  {next?.kind === 'error' && <span className="text-sm text-ember">{next.message}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <WheelContext
              step={step}
              subject={subject}
              onSubject={setSubject}
              pool={pool}
              cast={cast}
              onCast={(id) => {
                setCastIds((ids) => ({ ...ids, [entry.id]: id }));
                clearSpin();
              }}
            />
            <SubjectPanel
              config={config}
              world={world}
              labWorld={labWorld}
              subject={subject}
              onChange={setSubject}
              threat={threat}
              onThreat={(t) => {
                setThreatState(t);
                clearSpin();
              }}
            />
          </div>
        </div>

        <h2 className="mt-10 text-sm text-ash">Options as this subject is dealt them</h2>
        <div className="mt-3">
          <OptionTable
            config={config}
            catalog={catalog}
            group={entry.group}
            step={shownStep}
            slices={slices}
            subject={subject}
            world={labWorld}
            castName={cast?.name}
            winnerIndex={landed ? landed.roll.winner.index : null}
            busy={spinning}
            onGo={goTo}
            onForce={(i) => startSpin(i)}
          />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="text-sm text-ash">Reached from</h2>
            {entry.id === config.entryStepId || entry.id === config.adventure.entryStepId ? (
              <p className="mt-2 text-vellum">
                {entry.id === config.entryStepId ? 'The start of every new soul.' : 'The start of every adventure.'}
              </p>
            ) : incoming.length === 0 ? (
              <p className="mt-2 text-ember">Nothing leads here.</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm">
                {incoming.map(({ from, option }) => (
                  <li key={`${from}:${option.id}`}>
                    <button
                      type="button"
                      onClick={() => goTo(from)}
                      className="text-left text-vellum underline decoration-lead underline-offset-2 hover:decoration-gilt"
                    >
                      {catalog.byId[from]?.name ?? from}
                    </button>
                    <span className="text-ash"> · {option.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-sm text-ash">Validation</h2>
            {ownWarnings.length === 0 ? (
              <p className="mt-2 text-moss">No warnings for this wheel.</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm text-ember">
                {ownWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Wheel context: foe, cast, banked stats ────────────────────────────────

interface WheelContextProps {
  step: WheelStep;
  subject: Character;
  onSubject: (subject: Character) => void;
  pool: Character[];
  cast: Character | null;
  onCast: (id: string) => void;
}

function WheelContext({ step, subject, onSubject, pool, cast, onCast }: WheelContextProps) {
  const win = fightOdds(step, subject);
  const stat = step.ladder ? ladderStat(step) : undefined;
  if (!step.foe && !step.cast && !stat) return null;
  return (
    <Panel title="This wheel">
      {stat && (
        <div>
          <Slider
            label={`Banked ${STAT_LABELS[stat]} (positions)`}
            value={subject.statBonus[stat]}
            min={-3}
            max={5}
            step={1}
            format={signed}
            onChange={(n) => onSubject({ ...subject, statBonus: { ...subject.statBonus, [stat]: n } })}
          />
          <p className="mt-1 text-sm text-ash">
            After the wheel lands, each point moves the result a position (shown with the {step.upgradeEffect ?? 'hammer'}).
            {step.overflow && ' Past the top, it rolls Ascension.'}
          </p>
        </div>
      )}
      {step.cast && (
        <Field label={step.cast.asFoe ? 'Foe from the world' : 'Featuring'}>
          {pool.length === 0 ? (
            <p className="text-sm text-ash">Nobody in the world fits; the wheel rolls without anyone.</p>
          ) : (
            <select value={cast?.id ?? ''} onChange={(e) => onCast(e.currentTarget.value)} className={selectClass}>
              {pool.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Unnamed'} · {ROLE_LABELS[c.role]} · {calculatePowerRating(c)} CP
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {step.foe && win !== null && (
        <p className="text-sm text-vellum">
          {step.foe.name}, {step.foe.power} CP, against the subject’s {calculatePowerRating(subject)} CP:{' '}
          <span className="text-candle">wins {formatPercent(win)}</span>
        </p>
      )}
    </Panel>
  );
}

// ─── Test subject ───────────────────────────────────────────────────────────

interface SubjectPanelProps {
  config: GameConfig;
  /** The saved world: where characters can be loaded from. */
  world: World;
  /** The lab's copy, threat override applied: what a random soul is rolled against. */
  labWorld: World;
  subject: Character;
  onChange: (subject: Character) => void;
  threat: number | null;
  onThreat: (threat: number | null) => void;
}

function SubjectPanel({ config, world, labWorld, subject, onChange, threat, onThreat }: SubjectPanelProps) {
  const everyone = [...world.roster, ...world.hallOfFame, ...world.graveyard];
  const race = raceName(config, subject.race);
  const banked = STAT_KEYS.filter((k) => subject.statBonus[k] !== 0);

  return (
    <Panel title="Test subject">
      <div>
        <p className="text-vellum">
          <span className="text-candle">{subject.name || 'Unnamed'}</span>
          {subject.title && ` ${subject.title}`}
        </p>
        <p className="text-sm text-ash">
          {[race ?? 'no race', ROLE_LABELS[subject.role], subject.personality && config.personalities[subject.personality]?.name]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1 text-sm tabular-nums text-vellum">
          {STAT_KEYS.map((k) => `${STAT_LABELS[k].slice(0, 3)} ${subject.stats[k]}`).join(' · ')}
        </p>
        <p className="text-sm tabular-nums text-ash">
          {calculatePowerRating(subject)} CP
          {banked.length > 0 && ` · banked ${banked.map((k) => `${signed(subject.statBonus[k])} ${STAT_LABELS[k]}`).join(', ')}`}
        </p>
        {(subject.traits.length > 0 || subject.tags.length > 0) && (
          <p className="text-sm text-ash">{[...subject.traits.map((t) => t.name), ...subject.tags].join(' · ')}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(blankSubject(config, subject.race, subject.luck))}
          className={smallButton}
          title="A fresh soul with this race and luck"
        >
          <RotateCcw aria-hidden="true" size={14} /> Blank
        </button>
        <button
          type="button"
          onClick={() => onChange(asSubject(rollFullCharacter(config, labWorld).character))}
          className={smallButton}
          title="Roll a whole soul instantly, no wheels"
        >
          <Shuffle aria-hidden="true" size={14} /> Random soul
        </button>
      </div>

      {everyone.length > 0 && (
        <Field label="Load from the world">
          <select
            value=""
            onChange={(e) => {
              const picked = everyone.find((c) => c.id === e.currentTarget.value);
              if (picked) onChange(asSubject(picked));
            }}
            className={selectClass}
          >
            <option value="">Pick a character…</option>
            {everyone.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Unnamed'} · {raceName(config, c.race) ?? 'no race'} · {calculatePowerRating(c)} CP
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Give a trait">
        <select
          value=""
          onChange={(e) => {
            const trait = config.traits[e.currentTarget.value];
            if (trait && !subject.traits.some((t) => t.id === trait.id)) onChange({ ...subject, traits: [...subject.traits, { ...trait }] });
          }}
          className={selectClass}
        >
          <option value="">Pick a trait to test its outcomes…</option>
          {Object.values(config.traits)
            .filter((t) => !subject.traits.some((own) => own.id === t.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </Field>

      <Field label="Race">
        <select
          value={subject.race ?? ''}
          onChange={(e) => onChange({ ...subject, race: e.currentTarget.value || null })}
          className={selectClass}
        >
          <option value="">No race yet</option>
          {Object.values(config.races).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>

      <Slider
        label="Luck"
        value={subject.luck}
        min={-3}
        max={3}
        step={0.25}
        format={signed}
        onChange={(luck) => onChange({ ...subject, luck })}
      />
      <Slider
        label="Weapon tier"
        value={subject.weaponTier}
        min={0}
        max={MAX_WEAPON_TIER}
        step={1}
        format={String}
        onChange={(weaponTier) => onChange({ ...subject, weaponTier })}
      />
      <Slider
        label="Armour tier"
        value={subject.armorTier}
        min={0}
        max={MAX_ARMOR_TIER}
        step={1}
        format={String}
        onChange={(armorTier) => onChange({ ...subject, armorTier })}
      />
      <Slider
        label={`Fame (${fameStanding(config.fame.tiers, subject.fame).tier.name})`}
        value={subject.fame}
        min={0}
        max={Math.max(200, ...config.fame.tiers.map((t) => t.min + 20))}
        step={5}
        format={String}
        onChange={(fame) => onChange({ ...subject, fame })}
      />
      <div>
        <Slider
          label={threat === null ? 'Threat (live world)' : 'Threat (lab only)'}
          value={labWorld.threatLevel}
          min={0}
          max={10}
          step={0.5}
          format={(n) => n.toFixed(1)}
          onChange={onThreat}
        />
        {threat !== null && (
          <button type="button" onClick={() => onThreat(null)} className="mt-1 text-sm text-ash underline underline-offset-2">
            Back to the world’s {world.threatLevel.toFixed(1)}
          </button>
        )}
      </div>
    </Panel>
  );
}

// ─── Small parts ────────────────────────────────────────────────────────────

const selectClass = 'w-full rounded-sm border border-lead bg-nave px-2 py-1.5 text-sm text-vellum';
const smallButton =
  'flex items-center gap-1.5 rounded-sm border border-lead bg-slab-raised px-2.5 py-1 text-sm text-vellum transition-colors hover:bg-slab-hover';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border-2 border-dashed border-lead bg-slab p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ash">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-ash">{label}</span>
      {children}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-ash">{label}</span>
        <span className="tabular-nums text-vellum">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.currentTarget.value))}
        className="mt-1 w-full accent-gilt"
      />
    </label>
  );
}

function NavButton({
  onClick,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex items-center gap-1 rounded-md border-2 border-lead bg-slab-raised px-3 py-1 text-sm text-vellum transition-colors hover:bg-slab-hover disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label="Spin speed" className="flex rounded-md border-2 border-lead bg-slab p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={`rounded-[4px] px-3 py-0.5 capitalize transition-colors ${
            option === value ? 'bg-gilt font-semibold text-ink' : 'text-vellum hover:bg-slab-raised'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
