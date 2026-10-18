/**
 * Music for a run: `startMusic(getState)` when the run begins, `tickMusic()` once per frame from the game loop,
 * `stopMusic()` when it ends. The menus have no music (DESIGN 14.1), only foley.
 * Flags are derived from the run state here (a pure `deriveFlags`); `setMusicState` overrides them for tests and renders.
 */
import { dist } from '../../core/vec';
import type { RunState } from '../../world/run';
import { getContext, getMix, isRunning } from '../context';
import { CALM_FLAGS, sameFlags, type MusicFlags } from './adapt';
import { createMusicEngine, type MusicEngine } from './engine';
import { profileForFamily, rollProfile, type ProfileParams } from './profiles';

export * from './adapt';
export { profileForFamily, rollProfile, type ProfileParams } from './profiles';

/** Enemies this close count as "near". */
export const NEAR_RADIUS = 380;
/** An elite this close brings the splices. */
export const ELITE_RADIUS = 700;

/** The music flags of a run state. Pure. */
export function deriveFlags(s: RunState): MusicFlags {
  const p = s.player;
  let near = 0;
  let elite = false;
  let boss = false;
  for (const e of s.enemies) {
    if (e.boss) boss = true;
    const d = dist(e, p);
    if (d < NEAR_RADIUS) near++;
    if (e.elite && d < ELITE_RADIUS) elite = true;
  }
  return {
    enemiesNear: near,
    elite,
    boss,
    botTime: s.law.botTime,
    paused: false, // the pause sheet is not in the run state (inventory and forms also pause it): `setMusicPaused` sets it
    reversed: s.law.reversed,
    suspended: p.suspended,
    dead: s.status === 'dead' || p.hp <= 0,
    pageTurn: s.turning,
    base: s.phase === 'base',
  };
}

let engine: MusicEngine | null = null;
let getStateFn: (() => RunState | null) | null = null;
let override: Partial<MusicFlags> | null = null;
let applied: MusicFlags = CALM_FLAGS;
let seed = 0;
let pausedFlag = false;

export function currentProfile(): ProfileParams | null {
  return engine?.params ?? null;
}

export function musicEngine(): MusicEngine | null {
  return engine;
}

function ensure(): void {
  if (engine || !getStateFn || !isRunning()) return;
  const ctx = getContext();
  const mix = getMix();
  const s = getStateFn();
  if (!ctx || !mix || !s) return;
  const rng = s.rng.fork('music');
  const params = rollProfile(profileForFamily(s.ticket.family), rng);
  seed = s.seed;
  applied = { ...deriveFlags(s), paused: pausedFlag, ...override };
  engine = createMusicEngine({ ctx, out: mix.music, clock: { now: () => ctx.currentTime }, params, rng: rng.fork('voices'), page: s.page, flags: applied });
}

/** The run began: music starts as soon as the audio context runs. */
export function startMusic(getState: () => RunState | null): void {
  // The base of a planet already plays its profile: the run proper that begins with the same seed goes on with it, no restart.
  const live = getState();
  if (engine && live && live.seed === seed) {
    getStateFn = getState;
    return;
  }
  stopMusic(0.2);
  getStateFn = getState;
  ensure();
}

/** The run is over (or the player left it): fade out. */
export function stopMusic(fadeS = 1.5): void {
  engine?.stop(fadeS);
  engine = null;
  getStateFn = null;
  applied = CALM_FLAGS;
  pausedFlag = false;
}

/** Called every frame. Cheap: the engine gates itself to one run per 25 ms. */
export function tickMusic(): void {
  ensure();
  if (!engine || !getStateFn) return;
  const s = getStateFn();
  if (s && s.seed === seed) {
    const next = { ...deriveFlags(s), paused: pausedFlag, ...override };
    if (!sameFlags(applied, next)) {
      applied = next;
      engine.setFlags(next);
    }
  }
  engine.tick();
}

/** Force some flags regardless of the run (tests, renders); `null` goes back to the real state. */
export function setMusicState(flags: Partial<MusicFlags> | null): void {
  override = flags;
  if (engine) {
    applied = { ...applied, ...flags };
    engine.setFlags(applied);
  }
}

/** The pause sheet holds the run (`game:paused`): the music goes to the telephone band with the hold beep, as in bot hours. */
export function setMusicPaused(paused: boolean): void {
  pausedFlag = paused;
}

/** Whether the music is on hold because the run is paused. */
export function musicPaused(): boolean {
  return pausedFlag;
}

/** The new page's roll takes over (page turn). */
export function musicTurn(s: RunState, to: number): void {
  const page = s.pages[to];
  if (!engine || !page) return;
  engine.setPage(page);
  engine.cut('turn');
}

export function musicPhase(): void {
  engine?.cut('phase');
}
