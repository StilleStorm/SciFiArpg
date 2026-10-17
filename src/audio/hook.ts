/**
 * The audio part of the test hook (`window.__game.audio`): offline renders of the music profiles and of every
 * sound through the real mix (limiter and ceiling included), as WAV bytes, for `npm run render-audio`.
 * Offline means an OfflineAudioContext: no gesture, no speakers, nothing to unlock.
 */
import { createRng } from '../core/rng';
import { generateRunPages } from '../world/pages';
import { getContext, isRunning } from './context';
import { createMix } from './mix';
import { currentProfile, musicEngine } from './music';
import { RENDER_STATES, type MusicFlags } from './music/adapt';
import { createMusicEngine } from './music/engine';
import { PROFILE_IDS, rollProfile, type ProfileId } from './music/profiles';
import { RECIPES, SFX_NAMES, humInto, playRecipe, type PlayOpts, type Recipe, type Sink } from './sfx';
import { encodeWav, toBase64 } from './wav';

export const RENDER_SR = 44100;

export interface RenderResult {
  name: string;
  sampleRate: number;
  seconds: number;
  /** Base64 of a 16-bit mono WAV. */
  wav: string;
  /** Linear peak and RMS of the float render. */
  peak: number;
  rms: number;
  /** Extra facts (profile parameters). */
  info: Record<string, string | number>;
}

export type RenderStateName = keyof typeof RENDER_STATES;

export interface ProfileRenderOpts {
  seconds?: number;
  seed?: number;
  /** Music slider 0..100 (default 80, the game's default). */
  musicVolume?: number;
  /** Flags to change at times (a crossfade or a death). */
  timeline?: { t: number; flags: Partial<MusicFlags> }[];
}

export interface SfxSpec {
  names: string[];
  opts?: PlayOpts;
}

export interface AudioHook {
  profiles(): ProfileId[];
  states(): string[];
  sfxNames(): string[];
  renderProfile(profile: ProfileId, state: RenderStateName | MusicFlags, opts?: ProfileRenderOpts): Promise<RenderResult>;
  renderSfx(spec: string | SfxSpec, seconds?: number): Promise<RenderResult>;
  /** Is the live context running? (false until the first gesture) */
  running(): boolean;
  contextState(): string;
  /** The live music engine: profile, tempo, scale kind, bars played so far; null when no run is playing music. */
  music(): { id: string; bpm: number; scale: string; loopBars: number; bars: number; voicesAlive: number; notes: number; parked: boolean } | null;
}

function stats(data: Float32Array): { peak: number; rms: number } {
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] ?? 0;
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, data.length)) };
}

function finish(name: string, data: Float32Array, info: Record<string, string | number>): RenderResult {
  const { peak, rms } = stats(data);
  return { name, sampleRate: RENDER_SR, seconds: data.length / RENDER_SR, wav: toBase64(encodeWav(data, RENDER_SR)), peak, rms, info };
}

export function createAudioHook(): AudioHook {
  return {
    profiles: () => [...PROFILE_IDS],
    states: () => Object.keys(RENDER_STATES),
    sfxNames: () => [...SFX_NAMES],
    running: () => isRunning(),
    contextState: () => getContext()?.state ?? 'none',
    music() {
      const p = currentProfile();
      const e = musicEngine();
      if (!p || !e) return null;
      const i = e.info();
      return { id: p.id, bpm: p.bpm, scale: p.scale.kind, loopBars: p.loopBars, bars: i.bars, voicesAlive: i.voicesAlive, notes: i.notes, parked: i.parked };
    },

    async renderProfile(profile, state, opts = {}) {
      const seconds = opts.seconds ?? 20;
      const seed = opts.seed ?? 1957;
      const ctx = new OfflineAudioContext(1, Math.ceil(RENDER_SR * seconds), RENDER_SR);
      const mix = createMix(ctx, () => 0);
      mix.setVolumes(opts.musicVolume ?? 80, 100, 0, true);
      const flags: MusicFlags = typeof state === 'string' ? RENDER_STATES[state] : state;
      const rng = createRng(seed).fork('music');
      const params = rollProfile(profile, rng);
      // a real page of a real run: the roll reads its obstacles
      const page = generateRunPages(createRng(seed), 4)[1] ?? null;
      let t = 0;
      const engine = createMusicEngine({ ctx, out: mix.music, clock: { now: () => t }, params, rng: rng.fork('voices'), page, flags, fadeInS: 0.05 });
      engine.setFlags(flags, true);
      const timeline = [...(opts.timeline ?? [])].sort((a, b) => a.t - b.t);
      let next = 0;
      let current = flags;
      for (t = 0; t < seconds; t += 0.025) {
        while (next < timeline.length && (timeline[next]?.t ?? Infinity) <= t) {
          current = { ...current, ...timeline[next]?.flags };
          engine.setFlags(current);
          next++;
        }
        engine.tick();
      }
      const buffer = await ctx.startRendering();
      const info = engine.info();
      return finish(`${profile}-${typeof state === 'string' ? state : 'custom'}`, buffer.getChannelData(0), {
        bpm: params.bpm,
        scale: `${params.scale.kind}/${params.scale.degrees.length}`,
        rootHz: params.rootHz,
        loopBars: params.loopBars,
        bandLo: params.band[0],
        bandHi: params.band[1],
        spliceRate: Math.round(params.spliceRate * 100) / 100,
        notes: info.notes,
        persistentNodes: info.persistentNodes,
      });
    },

    async renderSfx(spec, seconds = 1) {
      const s: SfxSpec = typeof spec === 'string' ? { names: [spec] } : spec;
      const ctx = new OfflineAudioContext(1, Math.ceil(RENDER_SR * seconds), RENDER_SR);
      const mix = createMix(ctx, () => 0);
      mix.setVolumes(80, 100, 0, true);
      const sink: Sink = { ctx, out: mix.sfx, now: () => 0, rng: createRng(1) };
      for (const name of s.names) {
        if (name === 'bossHum') {
          humInto(sink);
          continue;
        }
        const r = (RECIPES as Record<string, Recipe>)[name];
        if (r) playRecipe(sink, name, r, { rate: 1, ...s.opts }, false);
      }
      const buffer = await ctx.startRendering();
      return finish(s.names.join('+'), buffer.getChannelData(0), {});
    },
  };
}
