import { describe, expect, it } from 'vitest';
import { applyStatus, getStatus, isStunned, statusSpeedMul } from '../combat/status';
import { effectiveResist } from '../combat/damage';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import { createGrid, type Enemy } from '../entities';
import { applyDamage } from '../systems/combat';
import { createRun, type RunState } from '../world/run';
import { updateEnemyAi, tickClaimRotation, tickEscalation, tickExistence } from './ai';
import { HEIGHT_MAX, HEIGHT_MIN, assemble, assembleBoss, layoutAssembly } from './assemble';
import { GRID_NEED_S, CONFIRM_NEED_S, onHydrant, spawnBoss } from './bosses';
import { canMelee, confirmExistence, existenceOf } from './hooks';
import { DEFECTS, FAMILY_DEFS, FAMILY_IDS, bodyGender, enemyName, eliteWord, tierStats } from './families';
import { makeEnemy } from './make';
import { rtOf } from './runtime';
import { bodiesOf, BODIES, DECOS, HEADS, LEGS } from './parts';
import { spawnElite, spawnWave } from './spawn';

const run = (seed = 3): RunState => {
  const s = createRun(seed);
  s.enemies.length = 0;
  return s;
};
const put = (s: RunState, family: (typeof FAMILY_IDS)[number], x = 600, y = 600, opts = {}): Enemy => {
  const e = makeEnemy(s.nextId++, x, y, 1234, family, opts);
  e.home = { x, y };
  e.defect = undefined;
  rtOf(e).asleep = false;
  rtOf(e).age = 10; // past the settle period
  s.enemies.push(e);
  return e;
};

describe('part library', () => {
  it('has the parts DESIGN 6 asks for', () => {
    expect(bodiesOf('urzadzenia').length).toBeGreaterThanOrEqual(5);
    expect(LEGS.length).toBeGreaterThanOrEqual(4);
    expect(HEADS.length).toBeGreaterThanOrEqual(4);
    expect(DECOS.filter((d) => d.family === 'urzadzenia').length).toBeGreaterThanOrEqual(5);
    expect(bodiesOf('powiadomienia').map((b) => b.tier).sort()).toEqual([1, 2, 3, 4]);
    expect(bodiesOf('wygenerowane').length).toBeGreaterThanOrEqual(4);
    expect(BODIES.filter((b) => b.boss).length).toBe(3);
  });
});

describe('assemble', () => {
  it('is deterministic', () => {
    for (const f of FAMILY_IDS) for (let seed = 1; seed < 40; seed++) expect(assemble(seed, f, 2)).toEqual(assemble(seed, f, 2));
  });
  it('varies with the seed', () => {
    const sig = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const a = assemble(seed * 31, 'urzadzenia', 1);
      sig.add(`${a.body}/${a.legs}/${a.head}/${a.decos.map((d) => d.id).join(',')}`);
    }
    expect(sig.size).toBeGreaterThan(25);
  });
  it('keeps every common enemy between 56 and 80 units tall', () => {
    for (const f of FAMILY_IDS) {
      for (let seed = 1; seed <= 400; seed++) {
        const tier = f === 'powiadomienia' ? 1 + (seed % 4) : 1 + (seed % 3);
        const a = assemble(seed * 7919, f, tier);
        const h = a.height * a.scale;
        expect(h, `${f} ${a.body} ${a.legs} ${a.head} seed ${seed}`).toBeGreaterThanOrEqual(HEIGHT_MIN - 0.5);
        expect(h, `${f} ${a.body} ${a.legs} ${a.head} seed ${seed}`).toBeLessThanOrEqual(HEIGHT_MAX + 0.5);
      }
    }
  });
  it('gives Powiadomienia the body of their tier, each bigger than the last', () => {
    const h = [1, 2, 3, 4].map((tier) => assemble(5, 'powiadomienia', tier).height);
    expect(h).toEqual([...h].sort((a, b) => a - b));
    expect(new Set(h).size).toBe(4);
  });
  it('lays out the same number of legs in both phases', () => {
    for (const f of FAMILY_IDS) {
      for (let seed = 1; seed < 30; seed++) {
        const l = layoutAssembly(assemble(seed, f, 1 + (seed % 4)));
        expect(l.legs(0).length).toBe(l.legs(1).length);
        expect(l.legCount).toBeGreaterThan(0);
      }
    }
  });
  it('assembles the three bosses', () => {
    for (const b of ['prototyp', 'weryfikacja', 'hipoteza'] as const) {
      const a = assembleBoss(b);
      expect(a.boss).toBe(b);
      expect(layoutAssembly(a).layers.length).toBeGreaterThan(0);
    }
  });
});

describe('resist table (DESIGN 6)', () => {
  it('urzadzenia resist regulaminowy and are weak to egzystencjalny', () => {
    const r = FAMILY_DEFS.urzadzenia.resist;
    expect(r.regulaminowy).toBeGreaterThan(0);
    expect(r.egzystencjalny).toBeLessThan(0);
  });
  it('powiadomienia resist mechaniczny and are weak to regulaminowy', () => {
    const r = FAMILY_DEFS.powiadomienia.resist;
    expect(r.mechaniczny).toBeGreaterThan(0);
    expect(r.regulaminowy).toBeLessThan(0);
  });
  it('wygenerowane resist egzystencjalny and are weak to mechaniczny', () => {
    const r = FAMILY_DEFS.wygenerowane.resist;
    expect(r.egzystencjalny).toBeGreaterThan(0);
    expect(r.mechaniczny).toBeLessThan(0);
  });
  it('is on the enemy stats, with the defect vulnerability added', () => {
    const s = run();
    const e = makeEnemy(s.nextId++, 100, 100, 5, 'urzadzenia');
    const plain = effectiveResist(e.stats, 'egzystencjalny');
    expect(plain).toBeLessThanOrEqual(-40);
    expect(e.defect).toBeDefined();
    if (e.defect) expect(e.stats.resist[DEFECTS[e.defect].vuln]).toBeLessThan(FAMILY_DEFS.urzadzenia.resist[DEFECTS[e.defect].vuln] ?? 0);
  });
  it('powiadomienia tiers get tougher', () => {
    const hp = [1, 2, 3, 4].map((t) => tierStats('powiadomienia', t).hp);
    expect(hp).toEqual([...hp].sort((a, b) => a - b));
  });
});

describe('claims and rebuttals', () => {
  it('a hit of the claim type crits (x2), strikes the bubble and says so once', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.hp = e.hpMax = 1000;
    const rebutted: number[] = [];
    bus.on('enemy:rebutted', (ev) => rebutted.push(ev.id));
    const claim = e.claim;
    expect(claim).toBeDefined();
    if (!claim) return;
    const hits: { amount: number; crit: boolean }[] = [];
    bus.on('enemy:hit', (ev) => hits.push(ev));
    applyDamage(s, bus, e, 5, false, claim.type);
    expect(hits[0]).toMatchObject({ amount: 10, crit: true });
    expect(rebutted).toEqual([e.id]);
    expect(claim.struck).toBe(true);
    // the claim is refuted: the same type is no longer a rebuttal
    applyDamage(s, bus, e, 5, false, claim.type);
    expect(hits[1]).toMatchObject({ amount: 5, crit: false });
    expect(rebutted.length).toBe(1);
  });
  it('an attack that already crit is not doubled again', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.hp = e.hpMax = 1000;
    const hits: number[] = [];
    bus.on('enemy:hit', (ev) => hits.push(ev.amount));
    if (e.claim) applyDamage(s, bus, e, 8, true, e.claim.type);
    expect(hits[0]).toBe(8);
  });
  it('another type is nie na temat, noted once per enemy, damage unchanged', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.hp = e.hpMax = 1000;
    const notes: number[] = [];
    const hits: number[] = [];
    bus.on('enemy:offTopic', (ev) => notes.push(ev.id));
    bus.on('enemy:hit', (ev) => hits.push(ev.amount));
    const other = (['mechaniczny', 'regulaminowy', 'egzystencjalny'] as const).find((t) => t !== e.claim?.type);
    applyDamage(s, bus, e, 6, false, other);
    applyDamage(s, bus, e, 6, false, other);
    expect(notes).toEqual([e.id]);
    expect(hits).toEqual([6, 6]);
  });
  it('without a type there is no claim logic', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.hp = e.hpMax = 1000;
    applyDamage(s, bus, e, 6, false);
    expect(e.hp).toBe(994);
    expect(e.claim?.struck).toBeUndefined();
  });
  it('elites swap their claim every 8 seconds', () => {
    const s = run();
    const e = put(s, 'urzadzenia', 600, 600, { elite: 'nieuchronny' });
    const rng = createRng(1);
    const first = e.claim?.textKey;
    let swaps = 0;
    for (let i = 0; i < 80; i++) if (tickClaimRotation(e, rng, 0.1)) swaps++;
    expect(swaps).toBe(0);
    for (let i = 0; i < 5; i++) if (tickClaimRotation(e, rng, 0.1)) swaps++;
    expect(swaps).toBe(1);
    expect(e.claim?.textKey).not.toBe(first);
    expect(e.claim?.struck).toBeFalsy();
    const plain = put(s, 'urzadzenia');
    expect(tickClaimRotation(plain, rng, 20)).toBe(false);
  });
  it('powiadomienia claims are their tier names', () => {
    const s = run();
    const keys = [1, 2, 3, 4].map((tier) => put(s, 'powiadomienia', 600, 600, { tier }).claim?.textKey);
    expect(keys).toEqual(['enemies.claim.powiadomienia.reminder', 'enemies.claim.powiadomienia.lastChance', 'enemies.claim.powiadomienia.cart', 'enemies.claim.powiadomienia.deleted']);
  });
});

describe('statuses', () => {
  it('zgloszony: +30% damage taken', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.hp = e.hpMax = 1000;
    applyStatus(e, 'zgloszony', 6, s.player.id);
    applyDamage(s, bus, e, 10, false);
    expect(e.hp).toBe(987);
  });
  it('zablokowany: the enemy neither moves nor strikes', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 800;
    const e = put(s, 'urzadzenia', 600, 640);
    applyStatus(e, 'zablokowany', 5, s.player.id);
    grid.insert(e);
    const y0 = e.y;
    for (let i = 0; i < 60; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(e.y).toBe(y0);
    expect(isStunned(e)).toBe(true);
    expect(canMelee(s, e)).toBe(false);
    e.statuses.length = 0;
    for (let i = 0; i < 60; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(e.y).toBeGreaterThan(y0 + 10);
  });
  it('do_weryfikacji: half speed', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 850;
    const a = put(s, 'urzadzenia', 500, 700);
    const b = put(s, 'urzadzenia', 700, 700);
    applyStatus(b, 'do_weryfikacji', 60, null);
    expect(statusSpeedMul(b)).toBe(0.5);
    const ay = a.y;
    const by = b.y;
    for (let i = 0; i < 60; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    const da = a.y - ay;
    const db = b.y - by;
    expect(db / da).toBeGreaterThan(0.4);
    expect(db / da).toBeLessThan(0.6);
  });
  it('przeczytane: only the taunter is chased, and the player is not struck', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 700;
    const lure = put(s, 'powiadomienia', 200, 700);
    const e = put(s, 'urzadzenia', 400, 700);
    applyStatus(e, 'przeczytane', 10, lure.id);
    expect(canMelee(s, e)).toBe(false);
    const x0 = e.x;
    for (let i = 0; i < 60; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(e.x).toBeLessThan(x0);
  });
  it('wyciszony: a ranged enemy cannot shoot', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 700;
    let shooter: Enemy | null = null;
    for (let seed = 1; seed < 200 && !shooter; seed++) {
      const e = makeEnemy(s.nextId++, 600, 520, seed, 'urzadzenia');
      if (assemble(seed, 'urzadzenia').ranged) shooter = e;
    }
    expect(shooter).not.toBeNull();
    if (!shooter) return;
    shooter.home = { x: 600, y: 520 };
    shooter.defect = undefined;
    rtOf(shooter).asleep = false;
    s.enemies.push(shooter);
    applyStatus(shooter, 'wyciszony', 30, null);
    for (let i = 0; i < 300; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(s.projectiles.length).toBe(0);
    shooter.statuses.length = 0;
    for (let i = 0; i < 300; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(s.projectiles.length + (s.player.hp < s.player.hpMax ? 1 : 0)).toBeGreaterThan(0);
  });
  it('applyStatus renews instead of stacking', () => {
    const s = run();
    const e = put(s, 'urzadzenia');
    applyStatus(e, 'zablokowany', 1, null);
    applyStatus(e, 'zablokowany', 2, null);
    expect(e.statuses.filter((x) => x.kind === 'zablokowany').length).toBe(1);
    expect(getStatus(e, 'zablokowany')?.remaining).toBe(2);
  });
});

describe('defects', () => {
  it('thinks: an existential argument stops it for a second', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.defect = 'thinks';
    e.hp = e.hpMax = 1000;
    applyDamage(s, bus, e, 3, false, 'mechaniczny');
    expect(isStunned(e)).toBe(false);
    applyDamage(s, bus, e, 3, false, 'egzystencjalny');
    expect(getStatus(e, 'zablokowany')?.remaining).toBe(1);
  });
  it('spins: a hit sets it spinning', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    e.defect = 'spins';
    e.hp = e.hpMax = 1000;
    applyDamage(s, bus, e, 3, false);
    expect(rtOf(e).spin).toBeGreaterThan(0);
  });
  it('limp: loses a leg at half racja and slows down', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 1100;
    const e = put(s, 'urzadzenia', 600, 700);
    e.defect = 'limp';
    e.hp = e.hpMax = 100;
    applyDamage(s, bus, e, 30, false);
    expect(rtOf(e).limped).toBe(false);
    applyDamage(s, bus, e, 25, false);
    expect(rtOf(e).limped).toBe(true);
    grid.insert(e);
    const y0 = e.y;
    for (let i = 0; i < 60; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(e.y - y0).toBeLessThan(e.speed * 0.7);
  });
  it('overheat: attacks faster, then stalls, then cools down', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 900;
    const e = put(s, 'urzadzenia', 600, 700);
    e.defect = 'overheat';
    const phases = new Set<string>();
    let fast = false;
    for (let i = 0; i < 60 * 12; i++) {
      grid.clear();
      grid.insert(e);
      updateEnemyAi(s, grid, bus, 1 / 60);
      phases.add(rtOf(e).heatPhase);
      if (rtOf(e).heatPhase === 'hot' && e.attackCooldown < rtOf(e).baseCooldown) fast = true;
    }
    expect([...phases].sort()).toEqual(['cool', 'hot', 'stall']);
    expect(fast).toBe(true);
  });
  it('firmware: walks in a random direction part of the time', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 900;
    const e = put(s, 'urzadzenia', 600, 700);
    e.defect = 'firmware';
    let walking = 0;
    const total = 60 * 60;
    for (let i = 0; i < total; i++) {
      grid.clear();
      grid.insert(e);
      e.x = 600;
      e.y = 700;
      updateEnemyAi(s, grid, bus, 1 / 60);
      if (rtOf(e).fwWalk > 0) walking++;
    }
    expect(walking / total).toBeGreaterThan(0.1);
    expect(walking / total).toBeLessThan(0.35);
  });
  it('loud: double aggro radius', async () => {
    const { aggroRadius } = await import('./ai');
    const s = run();
    const a = put(s, 'urzadzenia');
    const b = put(s, 'urzadzenia');
    b.defect = 'loud';
    expect(aggroRadius(s, b)).toBe(aggroRadius(s, a) * 2);
  });
  it('standby: asleep until hit', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia');
    rtOf(e).asleep = true;
    e.hp = e.hpMax = 100;
    applyDamage(s, bus, e, 1, false);
    expect(rtOf(e).asleep).toBe(false);
  });
});

describe('escalation (Powiadomienia)', () => {
  it('a tier left alive for 20 s becomes the next, up to 4', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'powiadomienia');
    const rng = createRng(1);
    const events: number[] = [];
    bus.on('enemy:escalated', (ev) => events.push(ev.tier));
    const step = (sec: number): void => {
      for (let i = 0; i < sec * 10; i++) tickEscalation(e, rng, bus, 0.1);
    };
    step(19);
    expect(e.tier).toBe(1);
    step(1.5);
    expect(e.tier).toBe(2);
    expect(e.claim?.textKey).toBe('enemies.claim.powiadomienia.lastChance');
    step(20);
    expect(e.tier).toBe(3);
    step(20);
    expect(e.tier).toBe(4);
    step(100);
    expect(e.tier).toBe(4);
    expect(events).toEqual([2, 3, 4]);
  });
  it('keeps the hp fraction and toughens up', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'powiadomienia');
    e.hp = Math.round(e.hpMax / 2);
    const before = e.hpMax;
    tickEscalation(e, createRng(1), bus, 21);
    expect(e.hpMax).toBeGreaterThan(before);
    expect(e.hp / e.hpMax).toBeGreaterThan(0.4);
    expect(e.hp / e.hpMax).toBeLessThan(0.6);
  });
});

describe('existence (Wygenerowane)', () => {
  it('damage dealt to it is multiplied by e', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'wygenerowane');
    e.hp = e.hpMax = 1000;
    e.existence = 0.5;
    applyDamage(s, bus, e, 10, false);
    expect(e.hp).toBe(995);
    e.existence = 1;
    applyDamage(s, bus, e, 10, false);
    expect(e.hp).toBe(985);
  });
  it('damage it deals is multiplied by e', async () => {
    const { enemyOutgoing } = await import('./hooks');
    const s = run();
    const e = put(s, 'wygenerowane');
    e.existence = 0.3;
    expect(enemyOutgoing(e, 10)).toBe(3);
    e.existence = 1;
    expect(enemyOutgoing(e, 10)).toBe(10);
  });
  it('drifts inside [0.3, 1] and can be confirmed for 4 s', () => {
    const s = run();
    const e = put(s, 'wygenerowane');
    const rng = createRng(9);
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 6000; i++) {
      tickExistence(e, rng, 0.05);
      lo = Math.min(lo, existenceOf(e));
      hi = Math.max(hi, existenceOf(e));
    }
    expect(lo).toBeGreaterThanOrEqual(0.3);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.3);
    confirmExistence(e);
    for (let i = 0; i < 70; i++) tickExistence(e, rng, 0.05);
    expect(e.existence).toBe(1);
    for (let i = 0; i < 20; i++) tickExistence(e, rng, 0.05);
    for (let i = 0; i < 4000; i++) tickExistence(e, rng, 0.05);
    expect(existenceOf(e)).toBeLessThanOrEqual(1);
  });
  it('other families have none', () => {
    const s = run();
    expect(put(s, 'urzadzenia').existence).toBeUndefined();
    expect(put(s, 'powiadomienia').existence).toBeUndefined();
  });
});

describe('elites', () => {
  it('have grammar forms in the gender of the noun', () => {
    expect(bodyGender('fridge')).toBe('f');
    expect(bodyGender('vacuum')).toBe('m');
    expect(bodyGender('card')).toBe('n');
    expect(eliteWord('zweryfikowany', 'fridge')).toBe('zweryfikowana');
    expect(eliteWord('zweryfikowany', 'vacuum')).toBe('zweryfikowany');
    expect(eliteWord('sponsorowany', 'card')).toBe('sponsorowane');
    expect(enemyName('fridge', 'nieuchronny')).toBe('lodówka, nieuchronna');
  });
  it('nieuchronny has 50% more racja than a plain elite', () => {
    const s = run();
    const a = put(s, 'urzadzenia', 600, 600, { elite: 'zweryfikowany' });
    const b = put(s, 'urzadzenia', 600, 600, { elite: 'nieuchronny' });
    expect(b.hpMax / a.hpMax).toBeCloseTo(1.5, 1);
  });
  it('domniemany teleports once when hit below half', () => {
    const s = run();
    const bus = createBus();
    const e = put(s, 'urzadzenia', 600, 600, { elite: 'domniemany' });
    e.hp = e.hpMax = 100;
    applyDamage(s, bus, e, 30, false);
    expect(Math.hypot(e.x - 600, e.y - 600)).toBeLessThan(1);
    applyDamage(s, bus, e, 30, false);
    const moved = Math.hypot(e.x - 600, e.y - 600);
    expect(moved).toBeGreaterThan(100);
    const [x, y] = [e.x, e.y];
    applyDamage(s, bus, e, 5, false);
    expect(e.x).toBe(x);
    expect(e.y).toBe(y);
  });
  it('zweryfikowany raises the damage of enemies near it; sponsorowany is faster', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.suspended = true;
    const aura = put(s, 'urzadzenia', 600, 600, { elite: 'zweryfikowany' });
    const near = put(s, 'urzadzenia', 660, 600);
    const far = put(s, 'urzadzenia', 1000, 900);
    updateEnemyAi(s, grid, bus, 1 / 60);
    expect(rtOf(near).dmgMult).toBeGreaterThan(1);
    expect(rtOf(far).dmgMult).toBe(1);
    expect(rtOf(aura).dmgMult).toBe(1);
  });
});

describe('spawn API', () => {
  it('spawnWave puts the family on the page; spawnElite makes an elite', () => {
    const s = run(7);
    const w = spawnWave(s, 'powiadomienia', 4, { x: 600, y: 700 });
    expect(w.length).toBeGreaterThan(0);
    expect(w.every((e) => e.family === 'powiadomienia')).toBe(true);
    const el = spawnElite(s, 'wygenerowane', { x: 600, y: 800 });
    expect(el?.elite).toBeDefined();
  });
  it('is reproducible from the seed', () => {
    const a = run(11);
    const b = run(11);
    spawnWave(a, 'urzadzenia', 5, { x: 600, y: 700 });
    spawnWave(b, 'urzadzenia', 5, { x: 600, y: 700 });
    expect(a.enemies.map((e) => [Math.round(e.x), Math.round(e.y), e.seed])).toEqual(b.enemies.map((e) => [Math.round(e.x), Math.round(e.y), e.seed]));
  });
});

describe('bosses', () => {
  it('Prototyp: at half racja it speeds up (and drops a leg)', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.suspended = true;
    const boss = spawnBoss(s, 'urzadzenia');
    expect(boss?.boss).toBe(true);
    if (!boss) return;
    updateEnemyAi(s, grid, bus, 1 / 60);
    expect(rtOf(boss).phase).toBe(1);
    boss.hp = boss.hpMax / 2 - 1;
    updateEnemyAi(s, grid, bus, 1 / 60);
    expect(rtOf(boss).phase).toBe(2);
    expect(rtOf(boss).speedMul).toBeGreaterThan(1);
  });
  it('Weryfikacja: summons every 6 s; 2 s on the hydrants blocks it for 3 s', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    const boss = spawnBoss(s, 'powiadomienia');
    expect(boss).not.toBeNull();
    if (!boss) return;
    const g = rtOf(boss).grid;
    expect(g).toBeDefined();
    if (!g) return;
    s.player.x = boss.x + 400;
    s.player.y = boss.y;
    const before = s.enemies.length;
    for (let i = 0; i < 60 * 6.2; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(s.enemies.length).toBeGreaterThan(before);
    // stand on a hydrant square
    const cell = g.cells[0];
    const cx = g.cx + ((cell % 3) - 1) * 52;
    const cy = g.cy + (Math.floor(cell / 3) - 1) * 52;
    expect(onHydrant(g, cx, cy)).toBe(true);
    s.player.x = cx;
    s.player.y = cy;
    s.player.suspended = true; // stay out of the way; the grid does not care
    s.player.suspended = false;
    for (let i = 0; i < 60 * (GRID_NEED_S - 0.3); i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(isStunned(boss)).toBe(false);
    for (let i = 0; i < 60 * 0.6; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(getStatus(boss, 'zablokowany')?.remaining).toBeGreaterThan(2);
    expect(boss.speed).toBe(0);
  });
  it('Hipoteza: e = 0.3 until 3 s inside the outline; then e = 1 and attacks come 1.5x faster', () => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    const boss = spawnBoss(s, 'wygenerowane');
    expect(boss).not.toBeNull();
    if (!boss) return;
    s.player.x = boss.x + 400;
    s.player.y = boss.y;
    for (let i = 0; i < 120; i++) updateEnemyAi(s, grid, bus, 1 / 60);
    expect(boss.existence).toBe(0.3);
    s.player.x = boss.x + 40;
    s.player.y = boss.y;
    for (let i = 0; i < 60 * (CONFIRM_NEED_S - 0.5); i++) {
      s.player.x = boss.x + 40;
      s.player.y = boss.y;
      updateEnemyAi(s, grid, bus, 1 / 60);
    }
    expect(boss.existence).toBe(0.3);
    for (let i = 0; i < 60; i++) {
      s.player.x = boss.x + 40;
      s.player.y = boss.y;
      updateEnemyAi(s, grid, bus, 1 / 60);
    }
    expect(boss.existence).toBe(1);
    expect(rtOf(boss).atkSpeed).toBe(1.5);
    expect(boss.attackCooldown).toBeCloseTo(rtOf(boss).baseCooldown / 1.5, 5);
  });
  it('a boss death is reported with its family', () => {
    const s = run();
    const bus = createBus();
    const boss = spawnBoss(s, 'urzadzenia');
    expect(boss).not.toBeNull();
    if (!boss) return;
    const got: string[] = [];
    bus.on('boss:died', (e) => got.push(e.family));
    bus.on('enemy:died', (e) => got.push(String(e.tier)));
    applyDamage(s, bus, boss, boss.hpMax * 10, true);
    expect(got).toEqual(['boss', 'urzadzenia']);
  });
});

describe('defect footnotes', () => {
  const defectNotes = (seesDefects: boolean, hit: boolean): number => {
    const s = run();
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    s.player.x = 600;
    s.player.y = 800;
    s.player.seesDefects = seesDefects;
    const e = put(s, 'urzadzenia', 600, 600);
    e.defect = 'loud';
    e.hp = e.hpMax = 9999;
    const notes: string[] = [];
    bus.on('footnote', (n) => notes.push(n.text));
    if (hit) applyDamage(s, bus, e, 1, false);
    for (let i = 0; i < 60 * 8; i++) {
      grid.clear();
      grid.insert(e);
      s.time += 1 / 60;
      updateEnemyAi(s, grid, bus, 1 / 60);
      e.x = 600;
      e.y = 600; // stay where it is, the note is about being seen
    }
    return notes.filter((n) => n.includes('Wada fabryczna')).length;
  };
  it('the Konsultant reads the defect at first sight', () => {
    expect(defectNotes(true, false)).toBe(1);
  });
  it('other heroes read it only after the first hit on that kind', () => {
    expect(defectNotes(false, false)).toBe(0);
    expect(defectNotes(false, true)).toBe(1);
  });
});
