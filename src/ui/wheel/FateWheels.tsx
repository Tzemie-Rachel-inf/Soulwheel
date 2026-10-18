/**
 * The wheel as the soul's archetype has it: the screen-side half of engine/archetypes.ts.
 *
 *   Wise     two wheels side by side, spun together; once both land, the player keeps one
 *   Brute    the hub turns into a Smash button while the wheel spins
 *   Ancient  a Decree button: the next click on a slice decides the roll, once in a life (or a
 *            choice from the list of open slices, for the keyboard and screen readers)
 *   Hero     the wheel drags as holy slices pass the pointer
 *
 * Everyone else gets the one wheel, exactly as before. Creation and adventures both use this.
 */
import { useEffect, useRef, useState } from 'react';
import type { Character, ResolvedSlice, WheelStep } from '../../engine/types';
import type { GenerationPhase, SessionView, Side } from '../../state/generationSession';
import { formatPercent, optionLabel } from '../format';
import { rarityStyle } from '../rarity';
import { primaryButton, secondaryButton } from '../RollReveal';
import { SpinWheel, type SpinRequest, type UpgradeRequest } from './SpinWheel';
import { SideBet, isSideBet, type SideBetBackdrop } from './MiniSpinWheel';

export interface FateWheelsProps {
  view: SessionView;
  phase: GenerationPhase;
  /** The soul spinning, as they stand before this wheel: their archetype's rules decide the wheel. */
  character: Character;
  step: WheelStep | null;
  spinRequest: SpinRequest | null;
  /** A Wise soul's second wheel. */
  altSpinRequest?: SpinRequest | null;
  upgradeRequest?: UpgradeRequest | null;
  onSpin: () => void;
  onSettled: (spinId: number) => void;
  onSettledAlt?: (spinId: number) => void;
  onUpgraded?: (spinId: number) => void;
  onPick?: (side: Side) => void;
  onSmash?: (spinId: number, index: number) => void;
  onDecree?: (index: number) => void;
  label: string;
  /** How long a spin takes (a battle's rounds go faster). Default: the wheel's own. */
  spinMs?: number;
  /** The word on the hub. Default: Spin. */
  hubLabel?: string;
  /** A side bet (Gambler, Trickster) has shown its result: on with the road. */
  onAdvance?: () => void;
  /** During a side bet, the wheel just rolled, to keep in the hall under it. */
  backdrop?: SideBetBackdrop | null;
}

export function FateWheels(props: FateWheelsProps) {
  const { view, phase, character, step, label } = props;
  const rules = character.rules;
  const landed = phase === 'upgrading' || phase === 'revealing' || phase === 'complete';
  const [decreeing, setDecreeing] = useState(false);
  /** Where focus goes back to when a decree is called off. */
  const decreeButton = useRef<HTMLButtonElement>(null);

  // A Hero's wheel drags over the holy.
  const drag = rules?.holyPull ? view.slices.flatMap((s, i) => (s.option.holy ? [i] : [])) : undefined;

  const twinned = view.wise ?? (phase === 'ready' && rules?.rollTwice && step && !step.fixed && !step.choice ? 'ready' : null);
  if (twinned) {
    const sides: Side[] = ['left', 'right'];
    const kept = view.wise?.kept ?? null;
    return (
      <div>
        <p className="mb-3 text-center text-sm text-ash">
          <span className="text-gilt-bright">Wise:</span> two wheels, one fate.{' '}
          {phase === 'picking' ? 'Keep the one you want.' : kept ? '' : 'Spin both, then keep the one you want.'}
        </p>
        {/* Side by side at every size: stacked on a phone, the second wheel's Keep fell under the hero bar. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {sides.map((side) => {
            const twin = twinned === 'ready' ? null : twinned[side];
            const winner = twin ? twin.slices[twin.winnerIndex] : undefined;
            const dimmed = kept !== null && kept !== side;
            return (
              <div key={side} className="flex min-w-0 flex-col items-center gap-3 transition-opacity duration-500" style={{ opacity: dimmed ? 0.4 : 1 }}>
                <SpinWheel
                  slices={twin?.slices ?? view.slices}
                  spin={side === 'left' ? props.spinRequest : (props.altSpinRequest ?? null)}
                  highlightIndex={twin && (phase === 'picking' || landed) ? twin.winnerIndex : null}
                  canSpin={view.canSpin}
                  onSpinRequest={props.onSpin}
                  onSettled={side === 'left' ? props.onSettled : (props.onSettledAlt ?? (() => {}))}
                  {...(props.spinMs !== undefined && { spinMs: props.spinMs })}
                  upgrade={kept === side ? props.upgradeRequest : null}
                  onUpgraded={props.onUpgraded}
                  label={`${label} (${side === 'left' ? 'first' : 'second'} wheel)`}
                  golden={step?.golden}
                  maxSize={400}
                  drag={drag}
                />
                {phase === 'picking' && winner && props.onPick && (
                  <button
                    type="button"
                    className={`${primaryButton} min-h-11 w-full max-w-xs !px-3 text-sm sm:w-auto sm:!px-5 sm:text-base`}
                    onClick={() => props.onPick!(side)}
                    autoFocus={side === 'left'}
                  >
                    Keep {optionLabel(winner.option)}
                  </button>
                )}
                {kept === side && <p className="text-sm text-gilt-bright">Kept</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // The Gambler's coin and the Trickster's gambit play out like a crit: the little wheel, over the hall.
  const mini = isSideBet(step, rules);
  const canDecree = Boolean(props.onDecree) && (character.decrees ?? 0) > 0 && phase === 'ready' && view.canSpin && !step?.choice && !mini;
  return (
    <div>
      {mini && (
        <SideBet
          step={step!}
          slices={view.slices}
          phase={phase}
          spin={props.spinRequest}
          winnerIndex={landed ? view.winnerIndex : null}
          canSpin={view.canSpin}
          character={character}
          onSpin={props.onSpin}
          onSettled={props.onSettled}
          onAdvance={props.onAdvance}
        />
      )}
      {/* During a side bet the hall keeps the wheel just rolled, still, on its result: the little wheel spins over it. */}
      <SpinWheel
        slices={mini && props.backdrop ? props.backdrop.slices : view.slices}
        spin={mini ? null : props.spinRequest}
        highlightIndex={mini && props.backdrop ? props.backdrop.winnerIndex : landed ? view.winnerIndex : null}
        canSpin={mini ? false : view.canSpin}
        onSpinRequest={props.onSpin}
        onSettled={props.onSettled}
        upgrade={mini ? null : props.upgradeRequest}
        onUpgraded={props.onUpgraded}
        label={label}
        {...(props.spinMs !== undefined && { spinMs: props.spinMs })}
        {...(props.hubLabel !== undefined && { hubLabel: props.hubLabel })}
        golden={step?.golden}
        {...(rules?.smash && props.onSmash && { onSmash: props.onSmash })}
        decreeing={canDecree && !mini && decreeing}
        onDecree={(index) => {
          setDecreeing(false);
          props.onDecree?.(index);
        }}
        drag={drag}
      />
      {mini && props.upgradeRequest && <SkipUpgrade request={props.upgradeRequest} onUpgraded={props.onUpgraded} />}
      {rules?.smash && phase === 'ready' && view.canSpin && (
        <p className="mt-3 text-center text-sm text-ash">
          <span className="text-gilt-bright">Brute:</span> spin it, then hit <span className="text-vellum">Smash!</span> to stop it dead.
        </p>
      )}
      {canDecree &&
        (decreeing ? (
          <DecreeList
            slices={view.slices}
            onDecree={(index) => {
              setDecreeing(false);
              props.onDecree?.(index);
            }}
            onCancel={() => {
              setDecreeing(false);
              requestAnimationFrame(() => decreeButton.current?.focus());
            }}
          />
        ) : (
          <div className="mt-4 flex justify-center">
            <button ref={decreeButton} type="button" className={`${secondaryButton} min-h-11`} onClick={() => setDecreeing(true)}>
              Decree the result ({character.decrees} left in this life)
            </button>
          </div>
        ))}
    </div>
  );
}

/**
 * An Ancient's decree, without pointing at the wheel: every open slice as a button, its odds
 * beside it. Focus lands on the first; Escape backs out. A click on the wheel still works too.
 */
function DecreeList({ slices, onDecree, onCancel }: { slices: readonly ResolvedSlice[]; onDecree: (index: number) => void; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const open = slices.filter((s) => !s.locked && s.effectiveWeight > 0);
  useEffect(() => first.current?.focus(), []);

  return (
    <div
      role="group"
      aria-labelledby="decree-title"
      className="mt-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p id="decree-title" className="text-sm text-gilt-bright">
          Decree the result: choose a slice, here or on the wheel.
        </p>
        <button type="button" className={`${secondaryButton} min-h-11`} onClick={onCancel}>
          Not this one
        </button>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {open.map((slice, k) => (
          <li key={slice.option.id} className="min-w-0">
            <button
              ref={k === 0 ? first : undefined}
              type="button"
              onClick={() => onDecree(slice.index)}
              className="btn-plaque flex min-h-11 w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:border-gilt"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]" style={{ color: rarityStyle(slice.option).color }}>
                {optionLabel(slice.option)}
              </span>
              <span className="shrink-0 tabular-nums text-sm text-ash">{formatPercent(slice.probability)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The little wheel has no hammer: an upgrade over it is done at once. */
function SkipUpgrade({ request, onUpgraded }: { request: UpgradeRequest; onUpgraded?: ((spinId: number) => void) | undefined }) {
  useEffect(() => onUpgraded?.(request.id), [request, onUpgraded]);
  return null;
}
