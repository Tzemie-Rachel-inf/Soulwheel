/**
 * Phones only: the hero rides along at the bottom of the screen, in thumb reach, while the wheel
 * keeps the top. On a desktop the full card stands beside the wheel; on a phone it would sit a
 * thousand pixels below it, so a soul would form out of sight. Here the bar shows who they are,
 * their Combat Power (and what the last roll did to it) and all five stats; a tap opens the full
 * card as a sheet over the hall.
 *
 * The sheet is a native <dialog>: focus moves in and stays, Escape and the backdrop close it.
 * Someone picked in the world (a grave, a rival) opens in the same sheet, hero or not.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, X } from 'lucide-react';
import { currentHp, hpFraction, maxHp } from '../engine/hp';
import { calculatePowerRating } from '../engine/power';
import { STAT_KEYS, type Character, type GameConfig } from '../engine/types';
import { CharacterCard, rolledStats } from './CharacterCard';
import { STAT_LABELS, displayName, heroRace, signed } from './format';
import { healthColor } from './Stakes';

/** A character as a card shows them. */
export interface CardSubject {
  character: Character;
  previous: Character | null;
  status: string;
}

export interface HeroBarProps {
  /** The player's own soul or hero, for the bar. Null: no bar (the sheet still opens for `inspected`). */
  own: CardSubject | null;
  /** Someone picked in the world (a grave, a rival): the sheet opens on them, and closing it lets them go. */
  inspected: CardSubject | null;
  config: GameConfig;
  onCloseInspect: () => void;
}

export function HeroBar({ own, inspected, config, onCloseInspect }: HeroBarProps) {
  const sheet = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const shown = inspected ?? own;

  const show = () => {
    if (!sheet.current?.open) sheet.current?.showModal();
    setOpen(true);
    // The dialog opens before React's autoFocus could act: put focus on Close ourselves.
    requestAnimationFrame(() => closeButton.current?.focus());
  };

  // Picking someone in the world shows them at once on a phone, where no card stands beside the list
  // (from 64rem, the desktop layout, the card beside the wheel shows them instead).
  const inspectedId = inspected?.character.id;
  useEffect(() => {
    if (inspectedId && !window.matchMedia('(min-width: 64rem)').matches) show();
  }, [inspectedId]);

  return (
    <>
      {own && <Bar subject={own} config={config} open={open} onOpen={show} />}
      <dialog
        ref={sheet}
        id="hero-sheet"
        aria-label={shown ? `${displayName(shown.character, config)}: character card` : 'Character card'}
        className="hero-sheet"
        onClose={() => {
          setOpen(false);
          if (inspected) onCloseInspect();
        }}
        onClick={(e) => {
          // A tap on the backdrop (the dialog itself, outside its panel) closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="hero-sheet-panel">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slab/95 px-4 py-2">
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-lead" />
            <button ref={closeButton} type="button" onClick={() => sheet.current?.close()} className="btn-plaque flex min-h-11 items-center gap-1.5 px-3 text-sm">
              <X aria-hidden="true" size={16} />
              Close
            </button>
          </div>
          {open && shown && (
            <div className="px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CharacterCard character={shown.character} previous={shown.previous} config={config} status={shown.status} />
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

/** The bar itself: who, how strong, the five stats. The whole bar opens the sheet. */
function Bar({ subject, config, open, onOpen }: { subject: CardSubject; config: GameConfig; open: boolean; onOpen: () => void }) {
  const { character, previous, status } = subject;
  const power = calculatePowerRating(character);
  const delta = previous ? power - calculatePowerRating(previous) : 0;
  const rolled = rolledStats(character, config);
  const race = heroRace(config, character);
  const archetype = character.archetype ? config.archetypes[character.archetype]?.name : undefined;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="hero-sheet"
        onClick={onOpen}
        className="hero-bar relative block w-full px-[max(1rem,env(safe-area-inset-left))] pb-2.5 pt-2 text-left"
      >
        {/* Health runs along the bar's top edge: always in sight, no extra row over the wheel. */}
        {character.status === 'alive' && <HealthStrip character={character} />}
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-display text-lg leading-tight ${character.name ? 'text-candle' : 'text-ash'}`}>
              {displayName(character, config)}
            </span>
            <span className="block truncate text-xs italic text-ash">
              {[race, archetype, status].filter(Boolean).join(' · ')}
              {character.status === 'alive' && (
                <span className={`not-italic tabular-nums ${hpFraction(character) <= 1 / 3 ? 'text-ember' : 'text-vellum'}`}>
                  {' · '}
                  {currentHp(character)}/{maxHp(character)} HP
                </span>
              )}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-display text-xl leading-none tabular-nums text-gilt-bright">{power}</span>
            <span className="block font-caps text-[0.7rem] tracking-wider text-ash">
              {delta !== 0 ? <span className={delta > 0 ? 'text-moss' : 'text-ember'}>{signed(delta)} </span> : null}
              CP
            </span>
          </span>
          <ChevronUp aria-hidden="true" className="size-5 shrink-0 self-center text-gilt" strokeWidth={2.25} />
        </span>
        {/* Short screens (a phone on its side) keep the bar to one line: the stats are a tap away. */}
        <span className="mt-1.5 grid grid-cols-5 gap-1 border-t border-lead pt-1.5 [@media(max-height:30rem)]:hidden">
          {STAT_KEYS.map((key) => {
            const value = character.stats[key];
            const change = previous && rolled.has(key) ? value - previous.stats[key] : 0;
            return (
              <span key={key} className="flex min-w-0 flex-col items-center leading-tight">
                <span className="font-caps text-[0.7rem] tracking-wider text-ash">{STAT_LABELS[key].slice(0, 3)}</span>
                <span className={`text-sm tabular-nums ${change > 0 ? 'text-moss' : change < 0 ? 'text-ember' : rolled.has(key) ? 'text-vellum' : 'text-ash'}`}>
                  {rolled.has(key) ? value : '–'}
                </span>
              </span>
            );
          })}
        </span>
        <span className="sr-only">Open the full hero card</span>
      </button>
    </div>
  );
}

/** The hero's health as a strip along the top edge of the bar. */
function HealthStrip({ character }: { character: Character }) {
  const fraction = hpFraction(character);
  return (
    <span aria-hidden="true" className="absolute inset-x-0 top-0 block h-1.5 bg-[#120b09]">
      <span className="block h-full transition-[width] duration-500" style={{ width: `${fraction * 100}%`, background: healthColor(fraction) }} />
    </span>
  );
}
