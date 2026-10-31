import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import { CLAIM_STEPS, STEP_GAP_S, rebut, staged, stepKey } from '../combat/claims';
import { createGrid, type Enemy } from '../entities';
import { t } from '../i18n';
import { applyDamage } from '../systems/combat';
import { createRun, type RunState } from '../world/run';
import type { TicketPlan } from '../world/campaign';
import { tickClaimRotation, updateEnemyAi } from './ai';
import { ODDZWANIAJACY_DELAY_S, ODDZWANIAJACY_RACJA } from './elites';
import { CLAIMS, ELITES, ELITE_IDS, FAMILY_IDS, AKT2_ELITE_IDS, eliteIdsFor, eliteWord, type EliteId } from './families';
import { makeEnemy } from './make';
import { pickNamedAffixes } from './named';
import { rtOf } from './runtime';
import { bindEliteDeaths, pendingReturns, spawnWave, tickReturns, trackElite } from './spawn';

const planOf = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'oplata-serwisowa' });
const run = (planet?: number): RunState => {
  const s = createRun(5, planet === undefined ? {} : { plan: planOf(planet) });
  s.enemies.length = 0;
  s.player.suspended = true;
  return s;
};
const put = (s: RunState, opts: Parameters<typeof makeEnemy>[5] = {}, x = 700, y = 700): Enemy => {
  const e = makeEnemy(s.nextId++, x, y, 1234, 'urzadzenia', opts);
  e.home = { x, y };
  e.defect = undefined;
  rtOf(e).asleep = false;
  rtOf(e).age = 10;
  s.enemies.push(e);
  trackElite(s, e);
  return e;
};

describe('the Akt II affixes in the pool', () => {
  it('join the pool on planets 4-6 and nowhere else', () => {
    expect(eliteIdsFor(undefined)).toBe(ELITE_IDS);
    for (const planet of [0, 1, 2, 6, 7, 8]) expect(eliteIdsFor(planet), `planet ${planet + 1}`).toBe(ELITE_IDS);
    for (const planet of [3, 4, 5]) expect(eliteIdsFor(planet)).toEqual([...ELITE_IDS, ...AKT2_ELITE_IDS]);
    expect(ELITE_IDS).toHaveLength(10);
  });
  it('are never rolled in Akt I, and are rolled in Akt II', () => {
    const seen = (planet: number): Set<EliteId> => {
      const out = new Set<EliteId>();
      for (let seed = 1; seed <= 60; seed++) {
        const s = createRun(seed, { plan: planOf(planet) });
        s.enemies.length = 0;
        s.player.suspended = true;
        for (const e of spawnWave(s, 'urzadzenia', 6, { x: s.player.x, y: s.player.y - 220 }, { elite: undefined, minPlayer: 100 })) if (e.elite) for (const a of rtOf(e).affixes) out.add(a);
        const forced = spawnWave(s, 'urzadzenia', 3, { x: s.player.x, y: s.player.y - 220 }, { makeNamed: true, minPlayer: 100 });
        for (const e of forced) for (const a of rtOf(e).affixes) out.add(a);
      }
      return out;
    };
    for (const planet of [0, 1, 2]) for (const a of AKT2_ELITE_IDS) expect(seen(planet).has(a)).toBe(false);
    expect(AKT2_ELITE_IDS.some((a) => seen(3).has(a))).toBe(true);
  });
  it('the named-elite picker keeps the Akt I sequence when it is given the ten', () => {
    const a = pickNamedAffixes(createRng(77));
    const b = pickNamedAffixes(createRng(77), ELITE_IDS);
    expect(b).toEqual(a);
    const c = [...Array(40).keys()].flatMap((i) => pickNamedAffixes(createRng(i), eliteIdsFor(4)));
    expect(c.some((x) => AKT2_ELITE_IDS.includes(x))).toBe(true);
  });
  it('have grammar forms in all four genders and an effect line', () => {
    for (const id of AKT2_ELITE_IDS) {
      const p = ELITES[id].prefix;
      for (const g of ['m', 'f', 'n', 'pl', 'effect']) expect(t(`${p}.${g}`), `${p}.${g}`).not.toBe(`${p}.${g}`);
    }
    expect(eliteWord('oddzwaniajacy', 'fridge')).toBe('oddzwaniająca');
    expect(eliteWord('dwuetapowy', 'card')).toBe('dwuetapowe');
  });
});

describe('oddzwaniajacy', () => {
  const struck = (s: RunState, bus = createBus()): Enemy => {
    bindEliteDeaths(s, bus);
    const e = put(s, { elite: 'oddzwaniajacy' });
    e.hp = 1;
    applyDamage(s, bus, e, 50, false);
    return e;
  };
  it('returns once, 4 s after it is struck, at 30% racja, with the claim Oddzwaniam', () => {
    const s = run(3);
    const bus = createBus();
    const returned: number[] = [];
    bus.on('enemy:returned', (e) => returned.push(e.id));
    const dead = struck(s, bus);
    expect(s.enemies).toHaveLength(0);
    expect(pendingReturns(s)).toBe(1);
    s.time += ODDZWANIAJACY_DELAY_S - 0.1;
    tickReturns(s, bus);
    expect(s.enemies).toHaveLength(0);
    s.time += 0.2;
    tickReturns(s, bus);
    expect(s.enemies).toHaveLength(1);
    const back = s.enemies[0] as Enemy;
    expect(back.id).not.toBe(dead.id);
    expect(returned).toEqual([back.id]);
    expect(back.seed).toBe(dead.seed);
    expect([back.x, back.y]).toEqual([dead.x, dead.y]);
    expect(back.hp).toBe(Math.round(back.hpMax * ODDZWANIAJACY_RACJA));
    expect(back.elite?.affix).toBe('oddzwaniajacy');
    expect(back.claim?.textKey).toBe('enemies.claim.oddzwaniam');
    expect(t(back.claim?.textKey ?? '')).toBe('Oddzwaniam');
    expect(pendingReturns(s)).toBe(0);
  });
  it('does not return a second time', () => {
    const s = run(3);
    const bus = createBus();
    struck(s, bus);
    s.time += ODDZWANIAJACY_DELAY_S + 0.1;
    tickReturns(s, bus);
    const back = s.enemies[0] as Enemy;
    back.hp = 1;
    applyDamage(s, bus, back, 50, false);
    expect(pendingReturns(s)).toBe(0);
    s.time += 30;
    tickReturns(s, bus);
    expect(s.enemies).toHaveLength(0);
  });
  it('is driven by the AI step on run time, keeps its claim, and is dropped when the page turns', () => {
    const s = run(3);
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    struck(s, bus);
    for (let i = 0; i < 5 * 10; i++) {
      s.time += 0.1;
      updateEnemyAi(s, grid, bus, 0.1);
    }
    expect(s.enemies).toHaveLength(1);
    const back = s.enemies[0] as Enemy;
    expect(tickClaimRotation(back, createRng(1), 30)).toBe(false); // the return keeps "Oddzwaniam"
    const s2 = run(3);
    struck(s2, bus);
    s2.pageIndex += 1;
    s2.time += 10;
    tickReturns(s2, bus);
    expect(s2.enemies).toHaveLength(0);
  });
});

describe('dwuetapowy', () => {
  it('stages a claim: textKey is the bracketed variant "1/2", and the key exists for every claim', () => {
    for (const fam of FAMILY_IDS) {
      for (const c of CLAIMS[fam]) {
        for (let n = 1; n <= CLAIM_STEPS; n++) {
          const key = stepKey(c.key, n);
          expect(t(key), key).toBe(`${t(c.key)} (${n}/${CLAIM_STEPS})`);
        }
      }
    }
    const c = staged({ textKey: 'enemies.claim.urzadzenia.update', type: 'mechaniczny' });
    expect(c).toMatchObject({ step: 1, of: 2, base: 'enemies.claim.urzadzenia.update' });
    expect(t(c.textKey)).toBe('Wymagam aktualizacji (1/2)');
    expect(staged(c)).toBe(c);
    expect(stepKey('enemies.claim.oddzwaniam', 2)).toBe('enemies.claimStep.oddzwaniam.2');
    expect(t('enemies.claimStep.oddzwaniam.1')).toBe('Oddzwaniam (1/2)');
  });
  it('needs two rebuttals: the first moves the bracket to 2/2, the second strikes it', () => {
    const c = staged({ textKey: 'enemies.claim.urzadzenia.update', type: 'mechaniczny' });
    expect(rebut(c, 10)).toBe(false);
    expect(c.struck).toBeUndefined();
    expect(c.step).toBe(2);
    expect(t(c.textKey)).toBe('Wymagam aktualizacji (2/2)');
    expect(rebut(c, 11)).toBe(true);
    expect(c.struck).toBe(true);
    const plain = { textKey: 'enemies.claim.urzadzenia.update', type: 'mechaniczny' as const };
    expect(rebut(plain)).toBe(true);
  });
  it('counts one volley once', () => {
    const c = staged({ textKey: 'enemies.claim.urzadzenia.update', type: 'mechaniczny' });
    rebut(c, 5);
    expect(rebut(c, 5 + STEP_GAP_S / 2)).toBe(false);
    expect(c.step).toBe(2);
    expect(c.struck).toBeUndefined();
  });
  it('works through the damage rule: a matching hit is a crit rebuttal each time, the bubble breaks (and the event fires) on the second', () => {
    const s = run(3);
    const bus = createBus();
    const rebuts: number[] = [];
    bus.on('enemy:rebutted', (e) => rebuts.push(e.id));
    const e = put(s, { elite: 'dwuetapowy' });
    e.hp = e.hpMax = 5000;
    expect(e.claim?.step).toBe(1);
    const type = e.claim?.type ?? 'mechaniczny';
    applyDamage(s, bus, e, 10, false, type);
    expect(e.claim?.struck).toBeUndefined();
    expect(e.claim?.step).toBe(2);
    s.time += 1;
    applyDamage(s, bus, e, 10, false, type);
    expect(e.claim?.struck).toBe(true);
    expect(rebuts).toHaveLength(1); // the event is the break of the bubble, not the first step
  });
  it('stages a claim set afresh (rotation, escalation) on the next step of the AI', () => {
    const s = run(3);
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    const e = put(s, { elite: 'dwuetapowy' });
    e.claim = { textKey: 'enemies.claim.urzadzenia.offline', type: 'egzystencjalny' };
    updateEnemyAi(s, grid, bus, 0.1);
    expect(e.claim?.step).toBe(1);
    expect(e.claim?.base).toBe('enemies.claim.urzadzenia.offline');
    e.claim.struck = true;
    rtOf(e).claimT = 0;
    updateEnemyAi(s, grid, bus, 0.1);
    expect(e.claim?.struck).toBeUndefined();
    expect(e.claim?.step).toBe(1);
  });
});
