/**
 * Sound, synthesized with Web Audio: no files to load. A tick for every lead line the pointer
 * passes, a sting when the wheel lands that grows with the slice's rarity (a chime for common,
 * a choir for mythical), and a clang for every hammer blow.
 *
 * The AudioContext is made on first use, which is always after a click (a spin), so browsers
 * let it play. Muting is a per-viewer preference, kept in localStorage when it is available.
 * Everything here fails silent: no audio support simply means no sound.
 */
import { useSyncExternalStore } from 'react';
import type { Rarity } from '../engine/types';

const STORAGE_KEY = 'soulwheel.sound';
const VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();
let lastTick = 0;

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ctx, out: master! };
  } catch {
    return null;
  }
}

/** One enveloped oscillator: attack to `peak`, then an exponential fall over `decay` seconds. */
function tone(
  a: { ctx: AudioContext; out: AudioNode },
  { freq, type = 'sine', at = 0, peak = 0.2, attack = 0.005, decay = 0.4, glideTo }: {
    freq: number;
    type?: OscillatorType;
    at?: number;
    peak?: number;
    attack?: number;
    decay?: number;
    glideTo?: number;
  },
) {
  const t0 = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + decay);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(gain).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

/** A short burst of filtered noise: the click of wood on the pointer, the ring of struck iron. */
function noise(a: { ctx: AudioContext; out: AudioNode }, { at = 0, decay = 0.05, peak = 0.15, freq = 3000, q = 1 }) {
  const t0 = a.ctx.currentTime + at;
  const length = Math.ceil(a.ctx.sampleRate * (decay + 0.02));
  const buffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  src.connect(filter).connect(gain).connect(a.out);
  src.start(t0);
}

/** Semitones above A4, as a frequency. */
const note = (semitones: number) => 440 * 2 ** (semitones / 12);

export const sound = {
  /**
   * The pointer flicks past a lead line. `speed` (0–1) lifts the pitch while the wheel is
   * fast; ticks closer together than the ear can follow are dropped.
   */
  tick(speed = 0.5) {
    const a = audio();
    if (!a) return;
    const now = a.ctx.currentTime;
    if (now - lastTick < 0.028) return;
    lastTick = now;
    noise(a, { decay: 0.03, peak: 0.12, freq: 2200 + 1600 * speed, q: 2.5 });
    tone(a, { freq: 900 + 500 * speed, type: 'triangle', peak: 0.04, decay: 0.03 });
  },

  /** The wheel comes to rest: the rarer the slice, the grander the sting. */
  land(rarity: Rarity = 'common') {
    const a = audio();
    if (!a) return;
    switch (rarity) {
      case 'common':
        tone(a, { freq: note(3), peak: 0.16, decay: 0.7 });
        tone(a, { freq: note(15), peak: 0.04, decay: 0.5 });
        break;
      case 'uncommon':
        [3, 10].forEach((n, i) => tone(a, { freq: note(n), at: i * 0.09, peak: 0.15, decay: 0.8 }));
        break;
      case 'rare':
        [3, 7, 10, 15].forEach((n, i) => tone(a, { freq: note(n), at: i * 0.08, peak: 0.14, decay: 0.9 }));
        break;
      case 'epic':
        [-2, 2, 5, 10, 14].forEach((n, i) => tone(a, { freq: note(n), type: 'triangle', at: i * 0.07, peak: 0.12, decay: 1.1 }));
        [26, 29, 33].forEach((n, i) => tone(a, { freq: note(n), at: 0.35 + i * 0.05, peak: 0.03, decay: 0.6 }));
        break;
      case 'legendary': {
        // A swelling major chord and a run of sparks above it.
        [-9, -5, -2, 3].forEach((n) => tone(a, { freq: note(n), type: 'triangle', attack: 0.25, peak: 0.09, decay: 1.8 }));
        [15, 19, 22, 27, 31, 34].forEach((n, i) => tone(a, { freq: note(n), at: 0.15 + i * 0.06, peak: 0.05, decay: 0.7 }));
        break;
      }
      case 'mythical': {
        // A choir: detuned voices on a fifth, slow to swell, slow to fade.
        for (const n of [-14, -9, -2, 3, 10]) {
          for (const detune of [-0.08, 0.08]) {
            tone(a, { freq: note(n + detune), type: 'sawtooth', attack: 0.6, peak: 0.025, decay: 2.6 });
          }
          tone(a, { freq: note(n), attack: 0.5, peak: 0.06, decay: 2.6 });
        }
        [27, 31, 34, 39].forEach((n, i) => tone(a, { freq: note(n), at: 0.6 + i * 0.12, peak: 0.04, decay: 1 }));
        break;
      }
    }
  },

  /** A hammer blow on a ladder: a thud and a ring of iron. `up` false is a blow that knocks it down. */
  hammer(up = true) {
    const a = audio();
    if (!a) return;
    tone(a, { freq: 140, glideTo: 55, peak: 0.35, decay: 0.25 });
    noise(a, { decay: 0.12, peak: 0.2, freq: up ? 2600 : 1400, q: 6 });
    tone(a, { freq: up ? 1870 : 990, type: 'triangle', peak: 0.05, decay: 0.5 });
  },

  /** A near miss: two soft falling notes, the sound a crowd makes when the ball hits the post. */
  nearMiss() {
    const a = audio();
    if (!a) return;
    tone(a, { freq: note(10), type: 'triangle', peak: 0.08, decay: 0.25 });
    tone(a, { freq: note(5), glideTo: note(3), type: 'triangle', at: 0.18, peak: 0.08, decay: 0.55 });
  },

  /** The ladder breaks past its top: a rising shimmer into Ascension. */
  ascend() {
    const a = audio();
    if (!a) return;
    tone(a, { freq: note(-2), glideTo: note(22), type: 'triangle', attack: 0.05, peak: 0.12, decay: 0.9 });
    [10, 14, 17, 22].forEach((n, i) => tone(a, { freq: note(n), at: 0.3 + i * 0.07, peak: 0.06, decay: 0.8 }));
  },

  isMuted: () => muted,

  setMuted(next: boolean) {
    muted = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'off' : 'on');
    } catch {
      // No storage: the choice lasts until the page closes.
    }
    if (next && ctx?.state === 'running') void ctx.suspend();
    listeners.forEach((l) => l());
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether sound is muted, kept in sync across every component that asks. */
export function useSoundMuted(): boolean {
  return useSyncExternalStore(subscribe, sound.isMuted, sound.isMuted);
}
