/** The Argument meter (S3): every source, the cap, the drain out of combat, the hold while an ultimate runs, and that it is never saved. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createEnemy } from '../entities/factory';
import { placeBoss } from '../enemies/bosses';
import { serializeCharacter } from '../save/character';
import { applyDamage, attack, killEnemy } from '../systems/combat';
import { createRun, nextId, type RunState } from '../world/run';
import {
  killFill,
  meterGain,
  meterOf,
  METER_COMBAT_R,
  METER_DRAIN_PER_S,
  METER_IDLE_S,
  METER_KILL,
  METER_KILL_BOSS,
  METER_KILL_ELITE,
  METER_REBUTTAL,
  METER_SPOR,
  tickMeter,
  ultimateReady,
} from './meter';
import { answerSpor, postSpor } from './spor';

function scene(): { s: RunState; bus: ReturnType<typeof createBus> } {
  const s = createRun(3);
  s.enemies.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.hp = s.player.hpMax = 1000;
  return { s, bus: createBus() };
}

function foe(s: RunState, dx = 40, hp = 500) {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y, 1);
  e.hp = e.hpMax = hp;
  e.stats.resist = {};
  e.claim = { textKey: 'x', type: 'mechaniczny' };
  s.enemies.push(e);
  return e;
}

describe('the meter: sources', () => {
  it('starts empty and is not ready', () => {
    const { s } = scene();
    expect(meterOf(s.player)).toBe(0);
    expect(ultimateReady(s.player)).toBe(false);
  });

  it('a rebuttal (the hit matches the standing claim) adds METER_REBUTTAL, once per claim', () => {
    const { s, bus } = scene();
    const e = foe(s);
    applyDamage(s, bus, e, 5, false, 'mechaniczny');
    expect(s.player.meter).toBeCloseTo(METER_REBUTTAL, 9);
    applyDamage(s, bus, e, 5, false, 'mechaniczny'); // the claim is struck: no second rebuttal
    expect(s.player.meter).toBeCloseTo(METER_REBUTTAL, 9);
  });

  it('a hit of another type, a hit without a type, and a blow with no credit add nothing', () => {
    const { s, bus } = scene();
    applyDamage(s, bus, foe(s), 5, false, 'egzystencjalny');
    applyDamage(s, bus, foe(s), 5, false);
    applyDamage(s, bus, foe(s), 5, false, 'mechaniczny', false);
    expect(s.player.meter).toBe(0);
  });

  it('an enemy striking another enemy (an attack, not the player\'s) earns no rebuttal; the player\'s attack does', () => {
    const { s, bus } = scene();
    const a = foe(s, 40);
    a.damageType = 'mechaniczny';
    a.stats.pewnoscSiebie = 1e6;
    const b = foe(s, 60);
    for (let i = 0; i < 20 && !b.claim?.struck; i++) attack(s, bus, a, b);
    expect(b.claim?.struck).toBe(true);
    expect(s.player.meter).toBe(0);
    const c = foe(s, 30);
    s.player.damageType = 'mechaniczny';
    s.player.stats.pewnoscSiebie = 1e6;
    for (let i = 0; i < 20 && s.player.meter === 0; i++) attack(s, bus, s.player, c);
    expect(s.player.meter).toBeCloseTo(METER_REBUTTAL, 9);
  });

  it('a hit on the player never fills it', () => {
    const { s, bus } = scene();
    applyDamage(s, bus, s.player, 5, false, 'mechaniczny');
    expect(s.player.meter).toBe(0);
  });

  it('a kill adds METER_KILL, an elite more, a boss most; slower than a rebuttal', () => {
    const { s, bus } = scene();
    killEnemy(s, bus, foe(s));
    expect(s.player.meter).toBeCloseTo(METER_KILL, 9);
    const el = foe(s);
    el.elite = { affix: 'zweryfikowany' };
    killEnemy(s, bus, el);
    expect(s.player.meter).toBeCloseTo(METER_KILL + METER_KILL_ELITE, 9);
    const boss = placeBoss(s, 'urzadzenia', 700, 800);
    killEnemy(s, bus, boss);
    expect(s.player.meter).toBeCloseTo(METER_KILL + METER_KILL_ELITE + METER_KILL_BOSS, 9);
    expect(METER_KILL).toBeLessThan(METER_REBUTTAL);
    expect(killFill('common')).toBe(METER_KILL);
  });

  it('a right Spor reply adds half of the meter, a wrong one nothing', () => {
    const { s, bus } = scene();
    const boss = placeBoss(s, 'urzadzenia', 700, 800);
    postSpor(s, bus, boss, 1);
    const prompt = s.spor?.prompt;
    expect(prompt).toBeTruthy();
    const wrong = ([0, 1, 2] as const).find((i) => i !== prompt?.correct) ?? 0;
    expect(answerSpor(s, bus, wrong)).toBe('wrong');
    expect(s.player.meter).toBe(0);
    postSpor(s, bus, boss, 2);
    expect(answerSpor(s, bus, s.spor?.prompt?.correct ?? 0)).toBe('right');
    expect(s.player.meter).toBeCloseTo(METER_SPOR, 9);
    expect(METER_SPOR).toBe(0.5);
  });

  it('is capped at 1 and ready exactly when full', () => {
    const { s } = scene();
    meterGain(s, 0.7);
    expect(ultimateReady(s.player)).toBe(false);
    expect(meterGain(s, 0.7)).toBeCloseTo(0.3, 9);
    expect(s.player.meter).toBe(1);
    expect(ultimateReady(s.player)).toBe(true);
  });

  it('does not fill while an ultimate runs', () => {
    const { s } = scene();
    s.hero.ult = { para: 1, idle: 0, active: [{ id: 'x', para: 1, left: 1, dur: 1, dmg: 1, x: 0, y: 0, acc: 0, ids: [], seen: 0 }] };
    expect(meterGain(s, 0.5)).toBe(0);
    expect(s.player.meter).toBe(0);
  });
});

describe('the meter: drain out of combat', () => {
  it('holds while an enemy is near, and drains only after METER_IDLE_S of quiet', () => {
    const { s } = scene();
    s.player.meter = 0.5;
    const clock = { idle: 0 };
    const e = foe(s, METER_COMBAT_R - 10);
    for (let i = 0; i < 600; i++) tickMeter(s, clock, 1 / 60);
    expect(s.player.meter).toBe(0.5);
    s.enemies.splice(s.enemies.indexOf(e), 1);
    for (let i = 0; i < 60 * (METER_IDLE_S - 0.5); i++) tickMeter(s, clock, 1 / 60);
    expect(s.player.meter).toBe(0.5);
    for (let i = 0; i < 60 * 10; i++) tickMeter(s, clock, 1 / 60);
    expect(s.player.meter).toBeCloseTo(0.5 - METER_DRAIN_PER_S * 10.5, 1);
  });

  it('comes back to rest when an enemy returns, and never goes below 0', () => {
    const { s } = scene();
    s.player.meter = 0.02;
    const clock = { idle: 99 };
    for (let i = 0; i < 600; i++) tickMeter(s, clock, 1 / 60);
    expect(s.player.meter).toBe(0);
    foe(s, 50);
    tickMeter(s, clock, 1 / 60);
    expect(clock.idle).toBe(0);
  });

  it('is slow: a full meter lasts well over a minute of quiet', () => {
    expect(1 / METER_DRAIN_PER_S).toBeGreaterThan(60);
  });
});

describe('the meter is not saved', () => {
  it('the character record has no meter', () => {
    const { s } = scene();
    s.player.meter = 0.9;
    const c = serializeCharacter(s);
    expect(JSON.stringify(c)).not.toContain('meter');
    expect(createRun(4).player.meter).toBe(0);
  });
});
