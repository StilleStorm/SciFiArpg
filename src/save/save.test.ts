import { describe, expect, it } from 'vitest';
import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME, SAVE_KEY, defaultMeta, loadMeta, migrate, saveMeta, toVolume } from './save';

function memory(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(SAVE_KEY, initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('save', () => {
  it('round-trips', () => {
    const store = memory();
    const meta = { ...defaultMeta(), stamps: 4, runsCompleted: 2, heroId: 'pralka' as const };
    expect(saveMeta(meta, store)).toBe(true);
    expect(loadMeta(store)).toEqual(meta);
  });
  it('survives garbage, missing storage and throwing storage', () => {
    expect(loadMeta(memory('{not json'))).toEqual(defaultMeta());
    expect(loadMeta(memory('[1]'))).toEqual(defaultMeta());
    expect(loadMeta(null)).toEqual(defaultMeta());
    expect(saveMeta(defaultMeta(), null)).toBe(false);
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadMeta(bad)).toEqual(defaultMeta());
    expect(saveMeta(defaultMeta(), bad)).toBe(false);
  });

  it('volumes default to 80 and 100, persist, and old saves without them still load', () => {
    expect(defaultMeta().settings.musicVolume).toBe(80);
    expect(defaultMeta().settings.sfxVolume).toBe(100);
    expect(DEFAULT_MUSIC_VOLUME).toBe(80);
    expect(DEFAULT_SFX_VOLUME).toBe(100);
    const store = memory();
    saveMeta({ ...defaultMeta(), settings: { theme: 'night', leftHanded: true, musicVolume: 35, sfxVolume: 0 } }, store);
    expect(loadMeta(store).settings).toEqual({ theme: 'night', leftHanded: true, musicVolume: 35, sfxVolume: 0 });
    // a save from before the sound phase: the theme and the hand survive, the volumes take the defaults
    const old = migrate({ settings: { theme: 'day', leftHanded: true } });
    expect(old.settings).toEqual({ theme: 'day', leftHanded: true, musicVolume: 80, sfxVolume: 100 });
  });
  it('rejects nonsense volumes and clamps the rest', () => {
    expect(toVolume('loud', 80)).toBe(80);
    expect(toVolume(NaN, 100)).toBe(100);
    expect(toVolume(Infinity, 100)).toBe(100);
    expect(toVolume(-20, 80)).toBe(0);
    expect(toVolume(250, 80)).toBe(100);
    expect(toVolume(42.6, 80)).toBe(43);
    expect(migrate({ settings: { musicVolume: 'x', sfxVolume: 999 } }).settings).toMatchObject({ musicVolume: 80, sfxVolume: 100 });
  });
});
