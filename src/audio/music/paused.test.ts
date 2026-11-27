import { describe, expect, it } from 'vitest';
import { createRun } from '../../world/run';
import { adaptTargets, BOT_BEEP_S, CALM_FLAGS, describeState, PHONE_BAND, sameFlags, type MusicFlags } from './adapt';
import { deriveFlags, holdTrackNumber, musicPaused, setMusicPaused, stopMusic } from './index';

describe('the pause sheet as hold music', () => {
  const botTime: MusicFlags = { ...CALM_FLAGS, enemiesNear: 3, botTime: true };
  const paused: MusicFlags = { ...CALM_FLAGS, enemiesNear: 3, paused: true };

  it('is treated exactly like bot hours: telephone band and a hold beep, whatever the profile', () => {
    for (const id of ['B', 'C', 'BC'] as const) {
      const p = adaptTargets(paused, id);
      expect(p).toEqual(adaptTargets(botTime, id));
      expect(p.band).toEqual(PHONE_BAND);
      expect(p.beepEvery).toBe(BOT_BEEP_S);
      expect(p.second).toBe(0);
    }
  });

  it('is a state of its own, different from calm, and dead still wins', () => {
    expect(describeState(paused)).toBe('paused');
    expect(sameFlags(CALM_FLAGS, { ...CALM_FLAGS, paused: true })).toBe(false);
    expect(adaptTargets({ ...paused, dead: true }, 'C').tempo).toBe(0);
    expect(adaptTargets(CALM_FLAGS, 'C').band).toBeNull();
  });

  it('comes from game:paused through a flag, not from the run state, and resets with the music', () => {
    const s = createRun(3);
    setMusicPaused(true);
    expect(musicPaused()).toBe(true);
    expect(deriveFlags(s).paused).toBe(false); // an inventory sheet pauses the run too; only the pause sheet sets the flag
    setMusicPaused(false);
    expect(musicPaused()).toBe(false);
    setMusicPaused(true);
    stopMusic(0);
    expect(musicPaused()).toBe(false);
  });
});

describe('currentHoldTrack', () => {
  it('is null outside a pause and without a started run, a stable 1-based number during one, new per pause', async () => {
    const { currentHoldTrack, startMusic, HOLD_TRACKS, holdTrackNumber } = await import('./index');
    const s = createRun(11);
    expect(currentHoldTrack()).toBeNull();
    setMusicPaused(true);
    expect(currentHoldTrack()).toBeNull(); // the menus have no music
    setMusicPaused(false);
    startMusic(() => s);
    expect(currentHoldTrack()).toBeNull();
    setMusicPaused(true);
    const a = currentHoldTrack();
    expect(a).not.toBeNull();
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(HOLD_TRACKS);
    setMusicPaused(true); // a repeated event does not change the track
    expect(currentHoldTrack()).toBe(a);
    expect(a).toBe(holdTrackNumber(11, 0));
    setMusicPaused(false);
    expect(currentHoldTrack()).toBeNull();
    setMusicPaused(true);
    expect(currentHoldTrack()).toBe(holdTrackNumber(11, 1));
    stopMusic(0);
    expect(currentHoldTrack()).toBeNull();
  });

  it('covers every track number over many pauses', () => {
    const seen = new Set<number>();
    for (let n = 0; n < 200; n++) seen.add(holdTrackNumber(5, n));
    expect(seen.size).toBeGreaterThan(8);
  });
});
