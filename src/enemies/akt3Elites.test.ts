import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import { createGrid, type Enemy } from '../entities';
import { t } from '../i18n';
import { applyDamage } from '../systems/combat';
import { createRun, type RunState } from '../world/run';
import type { TicketPlan } from '../world/campaign';
import { tickNiepotwierdzony, updateEnemyAi } from './ai';
import { NIEPOTWIERDZONY_EVERY_S, NIEPOTWIERDZONY_HOLD_S, POLUBIONY_CAP } from './elites';
import { AKT2_ELITE_IDS, ELITES, ELITE_IDS, eliteIdsFor, eliteWord } from './families';
import { AKT3_ELITE_IDS } from './ids';
import { makeEnemy } from './make';
import { confirmExistence } from './hooks';
import { pickNamedAffixes } from './named';
import { rtOf } from './runtime';
import { trackElite } from './spawn';

const planOf = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'oplata-serwisowa' });
const run = (): RunState => {
  const s = createRun(5, { plan: planOf(6) });
  s.enemies.length = 0;
  s.player.suspended = true;
  return s;
};
const put = (s: RunState, opts: Parameters<typeof makeEnemy>[5] = {}, x = 700, y = 700, family: 'urzadzenia' | 'wygenerowane' = 'urzadzenia'): Enemy => {
  const e = makeEnemy(s.nextId++, x, y, 1234, family, opts);
  e.home = { x, y };
  e.defect = undefined;
  rtOf(e).asleep = false;
  rtOf(e).age = 10;
  s.enemies.push(e);
  trackElite(s, e);
  return e;
};

describe('eliteIdsFor by act', () => {
  it('Akt I ten, planets 4-6 plus Akt II pair, planets 7 on plus Akt III pair', () => {
    expect(eliteIdsFor(undefined)).toBe(ELITE_IDS);
    for (const p of [0, 1, 2]) expect(eliteIdsFor(p)).toBe(ELITE_IDS);
    for (const p of [3, 4, 5]) expect(eliteIdsFor(p)).toEqual([...ELITE_IDS, ...AKT2_ELITE_IDS]);
    for (const p of [6, 7, 8]) expect(eliteIdsFor(p)).toEqual([...ELITE_IDS, ...AKT2_ELITE_IDS, ...AKT3_ELITE_IDS]);
  });
  it('the named picker can reach the new pair on planet 7', () => {
    const c = [...Array(80).keys()].flatMap((i) => pickNamedAffixes(createRng(i), eliteIdsFor(6)));
    for (const a of AKT3_ELITE_IDS) expect(c).toContain(a);
  });
  it('has grammar forms and an effect line', () => {
    for (const id of AKT3_ELITE_IDS) {
      const p = ELITES[id].prefix;
      for (const g of ['m', 'f', 'n', 'pl', 'effect']) expect(t(`${p}.${g}`), `${p}.${g}`).not.toBe(`${p}.${g}`);
    }
    expect(eliteWord('niepotwierdzony', 'fridge')).toBe('niepotwierdzona');
    expect(eliteWord('polubiony', 'card')).toBe('polubione');
  });
});

describe('niepotwierdzony', () => {
  it('a body without existence flickers to 0.3 for 2 s every 6 s and is solid again', () => {
    const s = run();
    const e = put(s, { elite: 'niepotwierdzony' });
    expect(e.existence).toBeUndefined();
    const step = (sec: number): void => {
      for (let i = 0; i < Math.round(sec * 60); i++) {
        tickNiepotwierdzony(e, 1 / 60);
        if (e.existence !== undefined) {
          const rt = rtOf(e);
          if (rt.ePin) {
            rt.ePin.t -= 1 / 60;
            e.existence = rt.ePin.value;
            if (rt.ePin.t <= 0) rt.ePin = null;
          }
        }
      }
    };
    step(NIEPOTWIERDZONY_EVERY_S - 0.5);
    expect(e.existence).toBeUndefined();
    step(1);
    expect(e.existence).toBe(0.3);
    step(NIEPOTWIERDZONY_HOLD_S);
    step(0.1);
    expect(e.existence).toBeUndefined();
  });
  it('through the AI step: existence 0.3 halves nothing else, hits count at 0.3 both ways', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, { elite: 'niepotwierdzony' });
    e.hp = e.hpMax = 9999;
    const grid = createGrid<Enemy>(64);
    let saw = false;
    for (let i = 0; i < 60 * 7; i++) {
      s.time += 1 / 60;
      updateEnemyAi(s, grid, bus, 1 / 60);
      if (e.existence === 0.3) {
        saw = true;
        const before = e.hp;
        applyDamage(s, bus, e, 100, false, 'mechaniczny');
        expect(before - e.hp).toBeLessThanOrEqual(31);
        break;
      }
    }
    expect(saw).toBe(true);
  });
  it('a hero\'s confirm overrides the flicker', () => {
    const s = run();
    const e = put(s, { elite: 'niepotwierdzony' });
    rtOf(e).nieT = 0;
    tickNiepotwierdzony(e, 0.01);
    expect(e.existence).toBe(0.3);
    confirmExistence(e, 4);
    expect(rtOf(e).ePin?.value).toBe(1);
    expect(e.existence).toBe(1);
  });
  it('works on a Wygenerowane body and is never given to a boss', () => {
    const s = run();
    const e = put(s, { elite: 'niepotwierdzony' }, 700, 700, 'wygenerowane');
    rtOf(e).nieT = 0;
    tickNiepotwierdzony(e, 0.01);
    expect(rtOf(e).ePin?.value).toBe(0.3);
    const b = put(s, { elite: 'niepotwierdzony' });
    b.boss = true;
    rtOf(b).nieT = 0;
    tickNiepotwierdzony(b, 0.01);
    expect(b.existence).toBeUndefined();
  });
});

describe('polubiony', () => {
  const hit = (s: RunState, e: Enemy): number => {
    e.hp = e.hpMax = 99999;
    applyDamage(s, createBus(), e, 1000, false, 'mechaniczny');
    return e.hpMax - e.hp;
  };
  it('takes 10% less per other living non-boss enemy within 200, at most 40%', () => {
    const s = run();
    const e = put(s, { elite: 'polubiony' });
    const alone = hit(s, e);
    put(s, {}, 780, 700);
    const one = hit(s, e);
    expect(one / alone).toBeCloseTo(0.9, 1);
    for (let i = 0; i < 6; i++) put(s, {}, 700 + 10 * i, 760);
    const many = hit(s, e);
    expect(many / alone).toBeCloseTo(1 - POLUBIONY_CAP, 1);
  });
  it('ignores far enemies, bosses and the dead', () => {
    const s = run();
    const e = put(s, { elite: 'polubiony' });
    const alone = hit(s, e);
    put(s, {}, 700, 1000);
    const boss = put(s, {}, 720, 700);
    boss.boss = true;
    const dead = put(s, {}, 740, 700);
    dead.hp = 0;
    expect(hit(s, e)).toBe(alone);
  });
});
