import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { ONRAMP_STEPS, WALK_AFTER_S, bindOnramp } from './onramp';
import type { RunState } from '../world/run';
import { t } from '../i18n';

const stateAt = (x: number, y: number): RunState => ({ phase: 'run', player: { x, y } }) as unknown as RunState;

function setup(first = true) {
  const bus = createBus();
  const said: string[] = [];
  let s = stateAt(0, 0);
  const on = bindOnramp(bus, { say: (x) => (said.push(x), said.length), getState: () => s, firstTicket: () => first });
  return { bus, said, on, move: (x: number) => (s = stateAt(x, 0)) };
}

describe('on-ramp', () => {
  it('has text for every step', () => {
    for (const k of ONRAMP_STEPS) expect(t(`narration.onramp.${k}`)).not.toBe(`narration.onramp.${k}`);
  });
  it('says each step once, on its event', () => {
    const { bus, said } = setup();
    bus.emit('attack:started', { attackerId: 1, attacker: 'enemy', x: 0, y: 0, tx: 0, ty: 0, ranged: false });
    expect(said).toHaveLength(0);
    for (let i = 0; i < 2; i++) {
      bus.emit('attack:started', { attackerId: 1, attacker: 'player', x: 0, y: 0, tx: 0, ty: 0, ranged: false });
      bus.emit('enemy:rebutted', { id: 2 });
      bus.emit('update:ready');
      bus.emit('recovery:taken', { healed: 5, held: 0 });
    }
    expect(said).toHaveLength(4);
  });
  it('says the walk note only to a player who stands still', () => {
    const a = setup();
    a.on.tick(WALK_AFTER_S + 0.1);
    expect(a.said).toHaveLength(1);
    const b = setup();
    b.on.tick(1);
    b.move(200);
    b.on.tick(WALK_AFTER_S + 1);
    expect(b.said).toHaveLength(0);
  });
  it('is silent once the file has a Historia entry', () => {
    const { bus, said, on } = setup(false);
    on.tick(10);
    bus.emit('update:ready');
    expect(said).toHaveLength(0);
  });
});
