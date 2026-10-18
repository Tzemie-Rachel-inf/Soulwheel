/**
 * The Settings tab: how the game plays out on screen, remembered per browser (ui/settings.ts).
 */
import { setSetting, useSettings, type WheelSpeed } from './settings';

const SPEEDS: { id: WheelSpeed; label: string; description: string }[] = [
  { id: 'normal', label: 'Normal', description: 'Every wheel spins out in full, as it always has.' },
  { id: 'dramatic', label: 'Dramatic', description: 'When a wheel is about to land on something great, or brush right past it, it slows to an agonising crawl.' },
  { id: 'fast', label: 'Fast', description: 'Wheels spin in about a third of the time.' },
  { id: 'instant', label: 'Instant', description: 'No spinning: every result lands at once.' },
];

export function SettingsTab() {
  const { wheelSpeed } = useSettings();
  return (
    <>
      <h1 id="wheel-title" className="court-title text-4xl leading-none sm:text-5xl">
        Settings
      </h1>
      <p className="mt-2 text-lg text-ash">Saved in this browser.</p>

      <fieldset className="court-panel mt-8 px-5 py-4">
        <legend className="font-display px-1 text-2xl text-candle">Wheel speed</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SPEEDS.map(({ id, label, description }) => {
            const on = wheelSpeed === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-start gap-3 border-2 px-3 py-2 transition-colors ${on ? 'border-gilt bg-gilt/15' : 'border-lead bg-slab-raised hover:bg-slab-hover'}`}
              >
                <input type="radio" name="wheel-speed" value={id} checked={on} onChange={() => setSetting('wheelSpeed', id)} className="mt-1.5 accent-[var(--color-gilt)]" />
                <span>
                  <span className="font-display block text-lg text-candle">{label}</span>
                  <span className="block text-sm text-vellum">{description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
