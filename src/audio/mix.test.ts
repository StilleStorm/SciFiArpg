import { describe, expect, it } from 'vitest';
import { FakeContext, type FakeNode } from './fakeContext';
import { DUCK_DB, DUCK_MS, MUSIC_BASE_DB, createMix, volumeToGain } from './mix';

describe('volume sliders', () => {
  it('map 0..100 to a monotonic gain from silence to unity', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(-5)).toBe(0);
    expect(volumeToGain(140)).toBe(1);
    let prev = -1;
    for (let v = 0; v <= 100; v += 5) {
      expect(volumeToGain(v)).toBeGreaterThan(prev);
      prev = volumeToGain(v);
    }
  });
});

describe('mix', () => {
  const build = () => {
    const ctx = new FakeContext();
    const mix = createMix(ctx.asContext(), () => 1);
    const nodes = ctx.nodes;
    return { ctx, mix, nodes };
  };

  it('chains sfx and music into a master with a limiter and a ceiling into the destination', () => {
    const { ctx, nodes } = build();
    const kinds = nodes.map((n) => n.kind);
    expect(kinds).toContain('compressor');
    expect(kinds).toContain('shaper');
    const limiter = nodes.find((n) => n.kind === 'compressor');
    const ceiling = nodes.find((n) => n.kind === 'shaper');
    expect(limiter?.ratio.value).toBeGreaterThanOrEqual(12);
    expect(limiter?.attack.value).toBeLessThanOrEqual(0.003);
    expect(ceiling?.connected).toContain(ctx.destination);
    expect(limiter?.connected).toContain(ceiling);
  });

  it('music sits 12 dB under the sfx at equal sliders', () => {
    expect(MUSIC_BASE_DB).toBe(-12);
    const { mix, nodes } = build();
    mix.setVolumes(100, 100, 1, true);
    const music = mix.music as unknown as FakeNode;
    const last = music.gain.calls[music.gain.calls.length - 1];
    expect(20 * Math.log10(last?.value ?? 0)).toBeCloseTo(-12, 1);
    expect(last?.kind).toBe('set'); // at once: no 100 ms of full volume while the target is still being approached
    const sfx = mix.sfx as unknown as FakeNode;
    expect(sfx.gain.calls[sfx.gain.calls.length - 1]?.value).toBe(1);
    expect(nodes.length).toBeGreaterThan(5);
  });

  it('the sliders drive the gains (settings-driven)', () => {
    const { mix } = build();
    mix.setVolumes(0, 50, 1, true);
    const music = mix.music as unknown as FakeNode;
    const sfx = mix.sfx as unknown as FakeNode;
    expect(music.gain.calls[music.gain.calls.length - 1]?.value).toBe(0);
    expect(sfx.gain.calls[sfx.gain.calls.length - 1]?.value).toBeCloseTo(0.25, 6);
  });

  it('ducks the music 6 dB for 300 ms on the audio clock', () => {
    expect(DUCK_DB).toBe(6);
    expect(DUCK_MS).toBe(300);
    const ctx = new FakeContext();
    const mix = createMix(ctx.asContext(), () => 2);
    mix.duck();
    // the duck node is the gain between the music volume and the master
    const duck = (mix.music as unknown as FakeNode).connected[0];
    const calls = duck?.gain.calls ?? [];
    const down = calls.find((c) => c.kind === 'target' && c.value < 1);
    const up = calls.find((c) => c.kind === 'target' && c.value === 1);
    expect(20 * Math.log10(down?.value ?? 0)).toBeCloseTo(-6, 1);
    expect(down?.time).toBe(2);
    expect((up?.time ?? 0) - 2).toBeCloseTo(0.3, 6);
  });
});
