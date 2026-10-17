/**
 * The buses (DESIGN 14.1, 14.5): sfx and music into one master with a limiter.
 *
 *   sfx --------------------------------\
 *   music -> duck (300 ms dips) ----------> master -> compressor (limiter) -> ceiling -> destination
 *
 * Music sits 12 dB under the SFX at equal sliders, and ducks a further 6 dB for 300 ms on kills and boss phases.
 * The ceiling is a soft-knee waveshaper that cannot exceed -1.4 dBFS, so nothing clips whatever the compressor missed.
 */
import { ceilingCurve, dbToGain } from './dsp';

export const MUSIC_BASE_DB = -12;
export const DUCK_DB = 6;
export const DUCK_MS = 300;

/** Slider 0..100 to a gain: a squared curve, so the lower half of the slider is still useful. */
export function volumeToGain(v: number): number {
  const x = Math.min(100, Math.max(0, v)) / 100;
  return x * x;
}

export interface Mix {
  readonly ctx: BaseAudioContext;
  /** Where SFX nodes connect. */
  readonly sfx: GainNode;
  /** Where the music engine connects (already under the duck and the base level). */
  readonly music: GainNode;
  readonly limiter: DynamicsCompressorNode;
  /** `immediate` sets the gains at once (a fresh context, an offline render) instead of easing over 30 ms. */
  setVolumes(music: number, sfx: number, at?: number, immediate?: boolean): void;
  /** Dip the music by `db` for `holdMs` (on the audio clock). */
  duck(db?: number, holdMs?: number, at?: number): void;
}

export function createMix(ctx: BaseAudioContext, now: () => number = () => ctx.currentTime): Mix {
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.14;
  const ceiling = ctx.createWaveShaper();
  ceiling.curve = ceilingCurve();
  master.connect(limiter);
  limiter.connect(ceiling);
  ceiling.connect(ctx.destination);

  const sfx = ctx.createGain();
  sfx.connect(master);

  const musicVol = ctx.createGain();
  const duckGain = ctx.createGain();
  musicVol.connect(duckGain);
  duckGain.connect(master);

  let musicBase = 1;
  const apply = (at: number, immediate: boolean): void => {
    const g = musicBase * dbToGain(MUSIC_BASE_DB);
    if (immediate) musicVol.gain.setValueAtTime(g, at);
    else musicVol.gain.setTargetAtTime(g, at, 0.03);
  };
  apply(now(), true);

  return {
    ctx,
    sfx,
    music: musicVol,
    limiter,
    setVolumes(music, sfxV, at = now(), immediate = false) {
      musicBase = volumeToGain(music);
      apply(at, immediate);
      if (immediate) sfx.gain.setValueAtTime(volumeToGain(sfxV), at);
      else sfx.gain.setTargetAtTime(volumeToGain(sfxV), at, 0.03);
    },
    duck(db = DUCK_DB, holdMs = DUCK_MS, at = now()) {
      const g = duckGain.gain;
      g.cancelScheduledValues(at);
      g.setTargetAtTime(dbToGain(-db), at, 0.008);
      g.setTargetAtTime(1, at + holdMs / 1000, 0.12);
    },
  };
}
