/** Shared framer-motion presets, so every reveal panel enters and leaves the same way. */
export const enter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.3, ease: 'easeOut' },
} as const;
