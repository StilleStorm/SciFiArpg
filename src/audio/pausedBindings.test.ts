import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBus } from '../core/events';
import { createRun } from '../world/run';

const played: string[] = [];
const music = { startMusic: vi.fn(), stopMusic: vi.fn(), tickMusic: vi.fn(), musicPhase: vi.fn(), musicTurn: vi.fn(), setMusicPaused: vi.fn() };

vi.mock('./sfx', async (orig) => {
  const real = await orig<typeof import('./sfx')>();
  return { ...real, play: (name: string) => void played.push(name), startHum: () => ({ stop: vi.fn() }) };
});
vi.mock('./music', () => music);
vi.mock('./context', () => ({ getMix: () => ({ duck: vi.fn() }), getContext: () => null, isRunning: () => true }));

const { bindAudio } = await import('./bindings');

beforeEach(() => {
  played.length = 0;
  for (const m of Object.values(music)) m.mockClear();
});

describe('game:paused in the audio bindings', () => {
  it('sets and clears the music flag and lays the sheet down and lifts it', () => {
    const bus = createBus();
    const s = createRun(3);
    bindAudio(bus, { getState: () => s, freeze: vi.fn() });
    bus.emit('game:paused', { paused: true });
    expect(music.setMusicPaused).toHaveBeenLastCalledWith(true);
    expect(played).toEqual(['inventoryOpen']);
    bus.emit('game:paused', { paused: false });
    expect(music.setMusicPaused).toHaveBeenLastCalledWith(false);
    expect(played).toEqual(['inventoryOpen', 'inventoryClose']);
  });
});
