import { describe, expect, it } from 'vitest';
import { createEnemy } from '../entities/factory';
import { createRun, nextId, type RunState } from '../world/run';
import { CALM_RADIUS, CALM_SECONDS, bossAlive, canOpenUpdate, requestUpdate, tickUpdateQueue } from './queue';

function run(): RunState {
  const s = createRun(3);
  s.enemies.length = 0;
  s.hero.pendingLevels = 1;
  return s;
}

function enemyAt(s: RunState, dx: number, boss = false) {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y, 1);
  if (boss) e.boss = true;
  s.enemies.push(e);
  return e;
}

/** Step the queue for `seconds`; returns the first time it said "open", or null. */
function until(s: RunState, seconds: number): number | null {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt); i++) if (tickUpdateQueue(s, dt)) return (i + 1) * dt;
  return null;
}

describe('update queue', () => {
  it('nothing queued: never opens', () => {
    const s = run();
    s.hero.pendingLevels = 0;
    expect(until(s, 5)).toBeNull();
    expect(canOpenUpdate(s, false)).toBe(false);
  });

  it('opens after 1.5 s without an enemy within 320 units', () => {
    const s = run();
    const t = until(s, 3);
    expect(t).not.toBeNull();
    expect(t ?? 0).toBeGreaterThanOrEqual(CALM_SECONDS - 0.02);
    expect(t ?? 9).toBeLessThan(CALM_SECONDS + 0.05);
  });

  it('an enemy near keeps it closed and restarts the calm', () => {
    const s = run();
    const e = enemyAt(s, CALM_RADIUS - 20);
    expect(until(s, 4)).toBeNull();
    e.x = s.player.x + CALM_RADIUS + 40;
    const t = until(s, 3);
    expect(t ?? 0).toBeGreaterThanOrEqual(CALM_SECONDS - 0.02);
  });

  it('a request (page turn or HUD tap) opens it at once, even with enemies near', () => {
    const s = run();
    enemyAt(s, 100);
    expect(until(s, 1)).toBeNull();
    expect(requestUpdate(s)).toBe(true);
    expect(tickUpdateQueue(s, 1 / 60)).toBe(true);
    s.hero.pendingLevels = 0;
    expect(requestUpdate(s)).toBe(false);
  });

  it('never opens while a boss lives, requested or not, and opens once it is gone', () => {
    const s = run();
    const boss = enemyAt(s, 900, true);
    expect(bossAlive(s)).toBe(true);
    requestUpdate(s);
    expect(until(s, 5)).toBeNull();
    expect(canOpenUpdate(s, false)).toBe(false);
    s.enemies.splice(s.enemies.indexOf(boss), 1);
    expect(bossAlive(s)).toBe(false);
    expect(tickUpdateQueue(s, 1 / 60)).toBe(true);
  });

  it('does not open over another sheet, a turning page, an open form or a dead run', () => {
    const s = run();
    expect(canOpenUpdate(s, false)).toBe(true);
    expect(canOpenUpdate(s, true)).toBe(false);
    s.status = 'paused'; // the inventory sheet pauses the run
    expect(canOpenUpdate(s, false)).toBe(false);
    s.status = 'running';
    s.modal = 'cookies';
    expect(canOpenUpdate(s, false)).toBe(false);
    s.modal = null;
    s.turning = true;
    expect(canOpenUpdate(s, false)).toBe(false);
  });

  it('several level ups queue: each opening spends one and the next is ready right after', () => {
    const s = run();
    s.hero.pendingLevels = 3;
    for (let n = 3; n >= 1; n--) {
      expect(canOpenUpdate(s, false)).toBe(true);
      s.hero.pendingLevels--; // what a pick does
    }
    expect(canOpenUpdate(s, false)).toBe(false);
  });
});
