/** A feat just earned: a card in the corner, a sting, and gone after a few seconds. */
import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { FeatToast } from '../state/useProfileTracker';
import { getOptionIcon } from './icons';
import { sound } from './sound';

const SHOW_MS = 6000;

export function FeatToasts({ toasts, overflow, onDismiss }: { toasts: FeatToast[]; overflow: number; onDismiss: (key: string) => void }) {
  const reduce = useReducedMotion() ?? false;
  const newest = toasts.at(-1)?.key;
  useEffect(() => {
    if (newest) sound.land('epic');
  }, [newest]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t, i) => (
          <Toast key={t.key} toast={t} more={i === toasts.length - 1 ? overflow : 0} reduce={reduce} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, more, reduce, onDismiss }: { toast: FeatToast; more: number; reduce: boolean; onDismiss: (key: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.key), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [toast.key, onDismiss]);
  const Icon = getOptionIcon(toast.feat.icon);
  return (
    <motion.div
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: reduce ? 0 : 40 }}
      className="court-panel pointer-events-auto flex items-start gap-3 px-4 py-3"
    >
      <Icon aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-gilt-bright" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl leading-tight text-candle">{toast.feat.name}</p>
        <p className="font-caps text-xs tracking-wide text-gilt-bright">Feat earned</p>
        <p className="text-sm text-vellum">
          {toast.feat.description}
          {toast.by && <span className="text-ash"> · {toast.by}</span>}
        </p>
        {more > 0 && <p className="mt-1 text-sm text-gilt-bright">and {more} more. See the Chronicle.</p>}
      </div>
      <button type="button" onClick={() => onDismiss(toast.key)} aria-label="Dismiss" className="rounded p-1 text-ash hover:text-candle">
        <X aria-hidden="true" size={14} />
      </button>
    </motion.div>
  );
}
