/** Shared framer-motion presets, so every reveal panel enters and leaves the same way. */
export const enter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.3, ease: 'easeOut' },
} as const;

/**
 * Back to the wheel after a reveal: the reveal sits below the wheel, so landing scrolls down to
 * it; moving on brings the next wheel's title back to the top of the view and puts focus on
 * Spin, so the next spin is one key away. Waits a frame for the next wheel to render.
 */
export function returnToWheel(): void {
  requestAnimationFrame(() => {
    const title = document.getElementById('wheel-title');
    if (title && title.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      title.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
    document.querySelector<HTMLButtonElement>('[data-spin-button]')?.focus({ preventScroll: true });
  });
}
