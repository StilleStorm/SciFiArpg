import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRun } from '../world/run';
import { movePlayer } from './movement';

function run() {
  const s = createRun(5, {});
  s.enemies.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  return s;
}

describe('joystick steering', () => {
  it('moves along the stick at speed times strength and forgets the walk target', () => {
    const s = run();
    const bus = createBus();
    s.player.target = { x: 100, y: 100 };
    s.player.steer = { dx: 1, dy: 0, mag: 0.5 };
    movePlayer(s, bus, 1);
    expect(s.player.x).toBeCloseTo(600 + s.player.speed * 0.5, 5);
    expect(s.player.y).toBeCloseTo(800, 5);
    expect(s.player.target).toBeNull();
    expect(s.player.moving).toBe(true);
    expect(s.player.facing).toBe(1);
  });
  it('stops when the stick is let go', () => {
    const s = run();
    const bus = createBus();
    s.player.steer = { dx: 0, dy: -1, mag: 1 };
    movePlayer(s, bus, 0.5);
    const y = s.player.y;
    delete s.player.steer;
    movePlayer(s, bus, 0.5);
    expect(s.player.y).toBe(y);
    expect(s.player.moving).toBe(false);
  });
  it('does nothing for a stick inside the dead zone and cannot leave the page', () => {
    const s = run();
    const bus = createBus();
    s.player.steer = { dx: 1, dy: 0, mag: 0 };
    movePlayer(s, bus, 1);
    expect(s.player.x).toBe(600);
    s.player.steer = { dx: -1, dy: 0, mag: 1 };
    for (let i = 0; i < 600; i++) movePlayer(s, bus, 1 / 60);
    expect(s.player.x).toBeGreaterThan(0);
    expect(s.player.x).toBeLessThan(200);
  });
});
