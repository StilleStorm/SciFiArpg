/**
 * One AudioContext for the whole game, made on the first user gesture and resumed whenever the page returns.
 *
 * Before the first gesture nothing exists (`getContext()` is null), so every sound call is a no-op and the
 * browser prints no autoplay warning. iOS Safari only unlocks audio from a real gesture (touchend, click,
 * keydown), so the unlock listens to pointerdown and to those, and keeps listening until the context runs.
 * The same listeners bring it back from the 'interrupted' state after a phone call.
 */
import { createMix, type Mix } from './mix';

type Ctor = typeof AudioContext;
interface WebkitWindow {
  webkitAudioContext?: Ctor;
}

let ctx: AudioContext | null = null;
let mix: Mix | null = null;
let failed = false;
let unlocked = false;
const readyFns = new Set<(c: AudioContext, m: Mix) => void>();
let volumes = { music: 80, sfx: 100 };

export function getContext(): AudioContext | null {
  return ctx;
}

export function getMix(): Mix | null {
  return mix;
}

/** True when sound can be heard now. */
export function isRunning(): boolean {
  return ctx !== null && ctx.state === 'running';
}

/** Called once when the context first exists (and the mix is built). Returns a remover. */
export function onAudioReady(fn: (c: AudioContext, m: Mix) => void): () => void {
  readyFns.add(fn);
  if (ctx && mix) fn(ctx, mix);
  return () => readyFns.delete(fn);
}

export function setVolumes(music: number, sfx: number): void {
  volumes = { music, sfx };
  mix?.setVolumes(music, sfx);
}

function make(): void {
  if (ctx || failed) return;
  try {
    const C: Ctor | undefined = globalThis.AudioContext ?? (globalThis as unknown as WebkitWindow).webkitAudioContext;
    if (!C) {
      failed = true;
      return;
    }
    ctx = new C({ latencyHint: 'interactive' });
    mix = createMix(ctx);
    mix.setVolumes(volumes.music, volumes.sfx, undefined, true);
    // iOS: a silent one-sample buffer played inside the gesture finishes the unlock.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
    for (const fn of [...readyFns]) fn(ctx, mix);
  } catch {
    failed = true;
    ctx = null;
    mix = null;
  }
}

/** Create the context if needed and try to resume it. Safe to call from any gesture, any number of times. */
export function unlockAudio(): void {
  make();
  unlocked = true;
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
}

/**
 * Hook the unlock to the first gesture on `doc` and the suspend/resume to visibility.
 * Call once at boot. Returns a function that removes the listeners (tests).
 */
export function installUnlock(doc: Document = document): () => void {
  const gesture = (): void => {
    if (ctx && ctx.state === 'running') return;
    unlockAudio();
  };
  const types = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
  for (const type of types) doc.addEventListener(type, gesture, { capture: true, passive: true });
  const onVisibility = (): void => {
    if (!ctx) return;
    if (doc.hidden) void ctx.suspend().catch(() => undefined);
    else if (unlocked) void ctx.resume().catch(() => undefined);
  };
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    for (const type of types) doc.removeEventListener(type, gesture, { capture: true });
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
