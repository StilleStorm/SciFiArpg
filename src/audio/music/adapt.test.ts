import { describe, expect, it } from 'vitest';
import { createRun } from '../../world/run';
import { createEnemy } from '../../entities/factory';
import { BOT_BEEP_S, CALM_FLAGS, CROSSFADE_TAU, NEAR_COUNT, PHONE_BAND, RENDER_STATES, adaptTargets, describeState, ease, sameFlags } from './adapt';
import { deriveFlags } from './index';
import { PROFILE_IDS } from './profiles';

describe('adaptation targets', () => {
  it('calm is sparse: one voice, no second voice, no reversed fragments, half the pins', () => {
    for (const id of PROFILE_IDS) {
      const t = adaptTargets(CALM_FLAGS, id);
      expect(t.second).toBe(0);
      expect(t.density).toBeLessThanOrEqual(0.55);
      expect(t.tempo).toBe(1);
      expect(t.direction).toBe(1);
      expect(t.band).toBeNull();
      expect(t.door).toBeGreaterThanOrEqual(18000);
      expect(t.level).toBe(1);
      expect(t.reversedEvery).toBe(id === 'BC' ? 16 : 0);
    }
  });

  it('splices belong to the hold line and begin with the elite', () => {
    expect(adaptTargets(CALM_FLAGS, 'C').splice).toBe(0);
    expect(adaptTargets(CALM_FLAGS, 'B').splice).toBeGreaterThan(0);
    expect(adaptTargets(RENDER_STATES.elite, 'C').splice).toBeGreaterThanOrEqual(1);
  });

  it('enemies near (more than 2): a second voice and more notes', () => {
    const calm = adaptTargets(CALM_FLAGS, 'C');
    const two = adaptTargets({ ...CALM_FLAGS, enemiesNear: NEAR_COUNT }, 'C');
    const three = adaptTargets({ ...CALM_FLAGS, enemiesNear: NEAR_COUNT + 1 }, 'C');
    expect(two.second).toBe(0);
    expect(three.second).toBeGreaterThan(0.5);
    expect(three.density).toBeGreaterThan(calm.density);
    expect(three.hiss).toBeGreaterThan(calm.hiss);
  });

  it('elite: splices begin, a reversed fragment every 8 bars', () => {
    for (const id of PROFILE_IDS) {
      const t = adaptTargets(RENDER_STATES.elite, id);
      expect(t.splice).toBeGreaterThanOrEqual(1);
      expect(t.reversedEvery).toBe(8);
      expect(t.reversed).toBeGreaterThan(0);
    }
  });

  it('boss: tempo x1.25, hiss up, harder splices', () => {
    const calm = adaptTargets(CALM_FLAGS, 'B');
    const boss = adaptTargets(RENDER_STATES.boss, 'B');
    expect(boss.tempo).toBe(1.25);
    expect(boss.hiss).toBeGreaterThanOrEqual(calm.hiss * 1.8);
    expect(boss.splice).toBeGreaterThan(adaptTargets(RENDER_STATES.elite, 'B').splice);
    expect(boss.density).toBe(1);
  });

  it('bot hours: telephone band only and a hold beep every 4 seconds', () => {
    const t = adaptTargets(RENDER_STATES.botTime, 'C');
    expect(t.band).toEqual([300, 3400]);
    expect(PHONE_BAND).toEqual([300, 3400]);
    expect(t.beepEvery).toBe(BOT_BEEP_S);
    expect(BOT_BEEP_S).toBe(4);
    expect(t.second).toBe(0);
    expect(t.reversedEvery).toBe(0);
  });

  it('Czas wsteczny: the loop runs backwards', () => {
    expect(adaptTargets(RENDER_STATES.reversed, 'C').direction).toBe(-1);
    expect(adaptTargets(CALM_FLAGS, 'C').direction).toBe(1);
  });

  it('Zawieszenie: ducked 12 dB and behind a door', () => {
    const t = adaptTargets({ ...CALM_FLAGS, suspended: true }, 'C');
    expect(20 * Math.log10(t.level)).toBeCloseTo(-12, 0);
    expect(t.door).toBeLessThan(1000);
  });

  it('death: the mechanism slows to a stop, no sting (tempo 0, level 0, nothing new)', () => {
    for (const id of PROFILE_IDS) {
      const t = adaptTargets({ ...RENDER_STATES.boss, dead: true }, id);
      expect(t.tempo).toBe(0);
      expect(t.level).toBe(0);
      expect(t.splice).toBe(0);
      expect(t.beepEvery).toBe(0);
      expect(t.reversedEvery).toBe(0);
    }
  });

  it('page turn: the level dips while the sheet is in the air', () => {
    expect(adaptTargets({ ...CALM_FLAGS, pageTurn: true }, 'C').level).toBeLessThan(0.5);
  });

  it('crossfades take 2-4 seconds: 90% in more than 2 s and less than 4 s', () => {
    const at = (s: number): number => 1 - Math.abs(ease(1, 0, s) - 0);
    expect(at(2.0)).toBeLessThan(0.9);
    expect(at(4.0)).toBeGreaterThan(0.9);
    expect(CROSSFADE_TAU * Math.log(10)).toBeGreaterThan(2);
    expect(CROSSFADE_TAU * Math.log(10)).toBeLessThan(4);
  });

  it('the dominant state is named in priority order', () => {
    expect(describeState(CALM_FLAGS)).toBe('calm');
    expect(describeState(RENDER_STATES.enemies)).toBe('near');
    expect(describeState(RENDER_STATES.elite)).toBe('elite');
    expect(describeState(RENDER_STATES.boss)).toBe('boss');
    expect(describeState(RENDER_STATES.botTime)).toBe('botTime');
    expect(describeState(RENDER_STATES.reversed)).toBe('reversed');
    expect(describeState({ ...RENDER_STATES.boss, dead: true })).toBe('death');
    expect(describeState({ ...CALM_FLAGS, suspended: true })).toBe('suspended');
  });

  it('flags compare by the threshold, not by the count', () => {
    expect(sameFlags({ ...CALM_FLAGS, enemiesNear: 3 }, { ...CALM_FLAGS, enemiesNear: 9 })).toBe(true);
    expect(sameFlags({ ...CALM_FLAGS, enemiesNear: 2 }, { ...CALM_FLAGS, enemiesNear: 3 })).toBe(false);
  });
});

describe('flags from the run state', () => {
  it('reads enemies, elite, boss, bot hours, reversed, suspended, death and page turn from the state', () => {
    const s = createRun(4);
    s.enemies.length = 0;
    expect(deriveFlags(s)).toEqual(CALM_FLAGS);
    const near = createEnemy(10, s.player.x + 100, s.player.y, 1);
    const far = createEnemy(11, s.player.x + 900, s.player.y + 900, 2);
    s.enemies.push(near, far);
    expect(deriveFlags(s).enemiesNear).toBe(1);
    near.elite = { affix: 'zweryfikowany' };
    expect(deriveFlags(s).elite).toBe(true);
    far.boss = true;
    expect(deriveFlags(s).boss).toBe(true);
    s.law.botTime = true;
    s.law.reversed = true;
    s.player.suspended = true;
    s.turning = true;
    const f = deriveFlags(s);
    expect([f.botTime, f.reversed, f.suspended, f.pageTurn]).toEqual([true, true, true, true]);
    s.status = 'dead';
    expect(deriveFlags(s).dead).toBe(true);
  });
});
