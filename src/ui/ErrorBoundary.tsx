/**
 * If something fails while a screen is being drawn, React unmounts everything and leaves an
 * empty page. This catches it instead: the error is shown, and the game can be reloaded.
 * The world is saved after every change, so a reload loses at most the spin in progress.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { primaryButton } from './RollReveal';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Soulwheel hit an error while drawing the screen:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-4xl text-candle">Something broke on this screen</h1>
        <p className="mt-2 text-vellum">
          Your world is safe: it is saved after every change. Reloading loses at most the spin that was in progress.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-md border-2 border-lead bg-slab px-4 py-3 text-sm text-ember">{error.message}</pre>
        <button type="button" onClick={() => window.location.reload()} className={`${primaryButton} mt-6`}>
          Reload the game
        </button>
      </main>
    );
  }
}
