/** The five first ultimates (S3): the limits of DESIGN 10.2 for every paragraph, the cast, and each paragraph at work. */
import { describe, expect, it } from 'vitest';
import { createGrid, type Enemy } from '../entities';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { hasStatus } from '../combat/status';
import { createEnemy } from '../entities/factory';
import { t } from '../i18n';
import { playerAttacks } from '../systems/combat';
import { createRun, nextId, type RunState } from '../world/run';
import { MAX_COPIES } from './numbers';
import { patchFields, PATCH_FIELD_LIMIT, PATCH_KEYS, type ParagraphNo } from './paragraphs';
import { HERO_IDS, heroById, type HeroId } from './registry';
import { castUltimate, setUltimateParagraph, stepUltimates, ultimateActive, ultimateOf, ultimateSeconds, ultimateUnlocked } from './ultimate';
import { FIRST_ULTIMATE_LEVEL, MAX_ULT_RADIUS, MAX_ULT_S } from './ultimateDefs';
import { heroStep } from './system';

const DT = 1 / 60;

function scene(heroId: HeroId, offsets: [number, number][]): { s: RunState; bus: Bus; log: { name: string; payload: unknown }[] } {
  const bus = createBus();
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.baseStats.stats.dmgMin = 10;
  s.player.baseStats.stats.dmgMax = 10;
  s.player.baseStats.stats.critChance = 0;
  s.player.stats.pewnoscSiebie = 1e6;
  s.player.stats.dmgMin = 10;
  s.player.stats.dmgMax = 10;
  s.player.stats.critChance = 0;
  s.player.hp = s.player.hpMax = 1000;
  s.player.level = FIRST_ULTIMATE_LEVEL;
  for (const [dx, dy] of offsets) {
    const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
    e.hp = e.hpMax = 5000;
    e.stats.upor = 0;
    e.stats.resist = {};
    e.claim = undefined;
    e.attackTimer = 999;
    s.enemies.push(e);
  }
  const log: { name: string; payload: unknown }[] = [];
  for (const name of ['stamp', 'margin:note', 'ultimate:cast'] as const) bus.on(name, (payload) => log.push({ name, payload }));
  return { s, bus, log };
}

function cast(s: RunState, bus: Bus, para: ParagraphNo = 1): boolean {
  setUltimateParagraph(s, para);
  s.player.meter = 1;
  return castUltimate(s, bus);
}

function run(s: RunState, bus: Bus, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) heroStep(s, bus, DT);
}

const hpLost = (e: Enemy): number => e.hpMax - e.hp;

describe('the gate and what the render reads', () => {
  it('refuses below the level of the first ultimate even with a full meter, and keeps the meter', () => {
    for (const id of HERO_IDS) {
      const { s, bus } = scene(id, [[60, 0]]);
      s.player.level = FIRST_ULTIMATE_LEVEL - 1;
      expect(ultimateUnlocked(s), id).toBe(false);
      expect(cast(s, bus), id).toBe(false);
      expect(s.player.meter).toBe(1);
      s.player.level = FIRST_ULTIMATE_LEVEL;
      expect(ultimateUnlocked(s), id).toBe(true);
      expect(cast(s, bus), id).toBe(true);
    }
  });

  it('stamps once and quietly (the recipe carries the thud); the record holds the radius of an area ultimate, from the paragraph', () => {
    for (const id of HERO_IDS) {
      const def = ultimateOf(scene(id, []).s);
      if (!def) throw new Error(id);
      for (const n of [1, 2, 3] as const) {
        const { s, bus, log } = scene(id, [[60, 0]]);
        expect(cast(s, bus, n)).toBe(true);
        const stamps = log.filter((l) => l.name === 'stamp');
        expect(stamps.length, `${id} ${n}`).toBe(1);
        expect((stamps[0]?.payload as GameEvents['stamp']).quiet).toBe(true);
        const u = s.hero.ult?.active[0];
        const want = def.radius === null ? undefined : def.list[n - 1]?.tune['radius'] ?? def.radius;
        expect(u?.r, `${id} ${n}`).toBe(want);
      }
    }
  });
});

describe('the ultimates as data', () => {
  it('every hero has a first ultimate at level 12 with the keys for the name, stamp, note and three paragraphs', () => {
    for (const id of HERO_IDS) {
      const m = heroById(id);
      const u = m.ultimates?.[0];
      expect(u, id).toBeDefined();
      if (!u) continue;
      expect(u.level).toBe(FIRST_ULTIMATE_LEVEL);
      for (const k of [u.nameKey, u.descKey, u.stampKey, u.noteKey, ...u.list.flatMap((p) => [p.nameKey, p.descKey])]) expect(t(k), `${id} ${k}`).not.toBe(k);
      expect(t(u.stampKey)).toBe(t(u.stampKey).toUpperCase());
      expect(t(u.stampKey).includes('!')).toBe(false);
    }
  });

  it('keeps the limits in every paragraph: at most 8 s, radius at most 220 or own path, patches of at most four fields', () => {
    for (const id of HERO_IDS) {
      const u = heroById(id).ultimates?.[0];
      if (!u) throw new Error(id);
      expect(u.radius === null || u.radius <= MAX_ULT_RADIUS, id).toBe(true);
      for (const p of u.list) {
        expect(ultimateSeconds(u, p.n), `${id} ${p.n}`).toBeLessThanOrEqual(MAX_ULT_S);
        expect(patchFields(p.patch), `${id} ${p.n}`).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
        for (const k of Object.keys(p.patch)) expect(PATCH_KEYS as readonly string[]).toContain(k);
        const r = p.tune.radius;
        if (r !== undefined) expect(r).toBeLessThanOrEqual(MAX_ULT_RADIUS);
      }
      expect(u.list.map((p) => p.n)).toEqual([1, 2, 3]);
      expect(patchFields(u.list[0].patch)).toBe(0);
      expect(JSON.stringify(u.list[1].patch)).not.toBe(JSON.stringify(u.list[2].patch));
      expect(u.list.some((p) => (p.patch.cost ?? 0) > 0), `${id} carries a cost`).toBe(true);
    }
  });

  it('at most one ultimate per hero acts page-wide', () => {
    for (const id of HERO_IDS) expect((heroById(id).ultimates ?? []).filter((u) => u.pageWide).length, id).toBeLessThanOrEqual(1);
  });
});

describe('castUltimate', () => {
  it('does nothing on an unfilled meter', () => {
    const { s, bus, log } = scene('pralka', [[80, 0]]);
    s.player.meter = 0.99;
    expect(castUltimate(s, bus)).toBe(false);
    expect(log).toHaveLength(0);
    expect(s.player.meter).toBe(0.99);
  });

  it('spends the meter and gives one stamp, one margin note and one ultimate:cast, for every hero in every paragraph', () => {
    for (const id of HERO_IDS) {
      for (const n of [1, 2, 3] as const) {
        const { s, bus, log } = scene(id, [[80, 0], [-90, 30]]);
        expect(cast(s, bus, n), `${id} ${n}`).toBe(true);
        expect(s.player.meter).toBe(0);
        expect(log.filter((l) => l.name === 'stamp'), `${id} ${n}`).toHaveLength(1);
        expect(log.filter((l) => l.name === 'margin:note'), `${id} ${n}`).toHaveLength(1);
        const evs = log.filter((l) => l.name === 'ultimate:cast').map((l) => l.payload as GameEvents['ultimate:cast']);
        expect(evs).toHaveLength(1);
        expect(evs[0]?.heroId).toBe(id);
        expect(evs[0]?.ultimateId).toBe(ultimateOf(s)?.id);
        expect(ultimateActive(s)).toBe(true);
        expect(castUltimate(s, bus)).toBe(false); // empty now, and one runs
      }
    }
  });

  it('every ultimate ends by itself within its seconds, in every paragraph', () => {
    for (const id of HERO_IDS) {
      for (const n of [1, 2, 3] as const) {
        const { s, bus } = scene(id, [[80, 0]]);
        cast(s, bus, n);
        const def = ultimateOf(s);
        if (!def) throw new Error(id);
        run(s, bus, ultimateSeconds(def, n) + 0.1);
        expect(ultimateActive(s), `${id} ${n}`).toBe(false);
      }
    }
  });

  it('pays the cost of the paragraph in racja, never fatally', () => {
    const { s, bus } = scene('pralka', [[80, 0]]);
    cast(s, bus, 3);
    expect(s.player.hp).toBe(992);
    const low = scene('pralka', [[80, 0]]);
    low.s.player.hp = 3;
    cast(low.s, low.bus, 3);
    expect(low.s.player.hp).toBeGreaterThanOrEqual(1);
  });

  it('is refused under a sheet, while stunned, and in the base', () => {
    const a = scene('pralka', []);
    a.s.modal = { kind: 'update' } as unknown as RunState['modal'];
    expect(cast(a.s, a.bus)).toBe(false);
    const b = scene('pralka', []);
    b.s.player.statuses.push({ kind: 'zablokowany', remaining: 2, source: null });
    expect(cast(b.s, b.bus)).toBe(false);
    const c = scene('pralka', []);
    c.s.phase = 'base';
    expect(cast(c.s, c.bus)).toBe(false);
  });

  it('stepUltimates drains the meter out of combat (the quiet is counted there)', () => {
    const { s, bus } = scene('pralka', []);
    s.player.meter = 0.5;
    for (let i = 0; i < 60 * 12; i++) stepUltimates(s, bus, DT);
    expect(s.player.meter).toBeLessThan(0.5);
  });
});

describe('Pelny cykl', () => {
  it('§ 1 pulls the near, damages each second, locks at the end; the far are left alone', () => {
    const { s, bus } = scene('pralka', [[120, 0], [260, 0]]);
    const [near, far] = s.enemies as [Enemy, Enemy];
    cast(s, bus, 1);
    run(s, bus, 1.05);
    expect(Math.hypot(near.x - s.player.x, near.y - s.player.y)).toBeLessThan(60);
    expect(hpLost(near)).toBeGreaterThanOrEqual(5);
    expect(hpLost(far)).toBe(0);
    expect(hasStatus(near, 'zablokowany')).toBe(false);
    run(s, bus, 4.1);
    expect(hpLost(near)).toBeGreaterThanOrEqual(25); // five ticks of 0.6 x 10
    expect(hasStatus(near, 'zablokowany')).toBe(true);
    expect(hasStatus(far, 'zablokowany')).toBe(false);
  });

  it('§ 2 delikatny lasts 8 s, hits for half, does not lock and heals her', () => {
    const { s, bus } = scene('pralka', [[100, 0]]);
    const e = s.enemies[0];
    if (!e) throw new Error('no enemy');
    s.player.hp = 500;
    cast(s, bus, 2);
    run(s, bus, 8.1);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    expect(s.player.hp).toBeGreaterThan(500 + 3 * 7);
    expect(hpLost(e)).toBeGreaterThanOrEqual(8 * 3 - 3);
    expect(hpLost(e)).toBeLessThan(8 * 5);
  });

  it('§ 3 intensywny is regulaminowy, 3 s, radius 140: an enemy at 180 is out of it', () => {
    const { s, bus } = scene('pralka', [[100, 0], [190, 0]]);
    const [near, out] = s.enemies as [Enemy, Enemy];
    cast(s, bus, 3);
    run(s, bus, 3.1);
    expect(hpLost(near)).toBeGreaterThanOrEqual(24); // three ticks of 1.2 x 10
    expect(hpLost(out)).toBe(0);
    expect(hasStatus(near, 'zablokowany')).toBe(true);
    expect(ultimateActive(s)).toBe(false);
  });
});

describe('Przekazanie do dzialu', () => {
  const page = (): [number, number][] => [[100, 0], [-300, 60], [400, -200]];

  it('§ 1 reaches every enemy on the page by a status: zgloszony, one strike of 0.8x, and a redirect', () => {
    const { s, bus } = scene('konsultant', page());
    cast(s, bus, 1);
    for (const e of s.enemies) {
      expect(hasStatus(e, 'zgloszony')).toBe(true);
      expect(hpLost(e)).toBe(8);
    }
    expect(s.hero.redirects).toHaveLength(3);
    expect(s.enemies.every((e) => e.attackTimer >= 5)).toBe(true);
  });

  it('§ 2 strikes for 1.5x with the existential type and lasts 3 s', () => {
    const { s, bus } = scene('konsultant', page());
    cast(s, bus, 2);
    for (const e of s.enemies) expect(hpLost(e)).toBe(15);
    expect(s.enemies[0]?.statuses.find((x) => x.kind === 'zgloszony')?.remaining).toBeCloseTo(3, 5);
  });

  it('§ 3 does no damage, lasts 8 s, and pays a gwiazdka for every death in it', () => {
    const { s, bus } = scene('konsultant', page());
    const before = s.player.gwiazdki;
    cast(s, bus, 3);
    for (const e of s.enemies) expect(hpLost(e)).toBe(0);
    expect(s.enemies[0]?.statuses.find((x) => x.kind === 'zgloszony')?.remaining).toBeCloseTo(8, 5);
    const first = s.enemies[0];
    const second = s.enemies[1];
    if (!first || !second) throw new Error('no enemies');
    first.hp = 0;
    second.hp = 0;
    s.enemies.splice(0, 2);
    s.kills += 2;
    run(s, bus, DT * 2);
    expect(s.player.gwiazdki).toBe(before + 2);
  });
});

describe('Zebranie wszystkich petli', () => {
  const copies = (s: RunState) => s.summons.filter((m) => m.variant === 'copy');

  it('§ 1 brings four copies for 6 s, beyond the usual limit, each speaking in an area of 85', () => {
    const { s, bus } = scene('petlowiec', [[60, 0], [400, 300]]);
    cast(s, bus, 1);
    expect(copies(s)).toHaveLength(4);
    expect(copies(s).length).toBeGreaterThan(MAX_COPIES);
    for (const m of copies(s)) expect(m.ttl).toBeCloseTo(6, 5);
    expect(hpLost(s.enemies[0] as Enemy)).toBeGreaterThan(0);
    expect(hpLost(s.enemies[1] as Enemy)).toBe(0);
  });

  it('§ 2 brings six copies for 3 s', () => {
    const { s, bus } = scene('petlowiec', [[60, 0]]);
    cast(s, bus, 2);
    expect(copies(s)).toHaveLength(6);
    for (const m of copies(s)) expect(m.ttl).toBeCloseTo(3, 5);
  });

  it('§ 3 brings two existential copies that hit harder', () => {
    const base = scene('petlowiec', [[60, 0]]);
    cast(base.s, base.bus, 1);
    const { s, bus } = scene('petlowiec', [[60, 0]]);
    cast(s, bus, 3);
    expect(copies(s)).toHaveLength(2);
    expect(copies(s)[0]?.damageType).toBe('egzystencjalny');
    expect(copies(s)[0]?.damageMul).toBeGreaterThan(copies(base.s)[0]?.damageMul ?? 99);
  });
});

describe('Mapa ostateczna', () => {
  /** Volleys of the auto-attack at the near enemy; the hits that landed, per enemy id. */
  function volleys(s: RunState, bus: Bus, n: number): Map<number, number> {
    const hits = new Map<number, number>();
    bus.on('enemy:hit', (e) => hits.set(e.id, (hits.get(e.id) ?? 0) + 1));
    for (let i = 0; i < n; i++) {
      const grid = createGrid<Enemy>(64);
      for (const e of s.enemies) grid.insert(e);
      s.player.attackTimer = 0;
      playerAttacks(s, grid, bus, DT);
    }
    return hits;
  }
  /** Two enemies on the ray from the instrument (sighted from 17 right, 31 up) through the first. */
  const line = (): [number, number][] => [[120, 0], [202, 25]];

  it('§ 1 marks every enemy zgloszony, fires twice and pierces without a crit', () => {
    const { s, bus } = scene('kartograf', [...line(), [-500, 200]]);
    for (const e of s.enemies) e.hp = e.hpMax = 1e6;
    const [front, back, far] = s.enemies as [Enemy, Enemy, Enemy];
    cast(s, bus, 1);
    for (const e of s.enemies) expect(hasStatus(e, 'zgloszony')).toBe(true);
    const hits = volleys(s, bus, 20);
    expect(hits.get(front.id) ?? 0).toBeGreaterThanOrEqual(30);
    expect(hits.get(back.id) ?? 0).toBeGreaterThanOrEqual(15);
    expect(hits.get(far.id) ?? 0).toBe(0);
  });

  it('without it a volley fires once and does not pierce', () => {
    const { s, bus } = scene('kartograf', line());
    for (const e of s.enemies) e.hp = e.hpMax = 1e6;
    const [front, back] = s.enemies as [Enemy, Enemy];
    const hits = volleys(s, bus, 20);
    expect(hits.get(front.id) ?? 0).toBeLessThanOrEqual(20);
    expect(hits.get(back.id) ?? 0).toBe(0);
  });

  it('§ 2 fires once for 8 s, § 3 fires four times for 4 s', () => {
    const one = scene('kartograf', line());
    for (const e of one.s.enemies) e.hp = e.hpMax = 1e6;
    cast(one.s, one.bus, 2);
    expect(one.s.hero.ult?.active[0]?.shots).toBe(1);
    expect(one.s.hero.ult?.active[0]?.left).toBeCloseTo(8, 5);
    const hits1 = volleys(one.s, one.bus, 20);
    expect(hits1.get(one.s.enemies[0]?.id ?? -1) ?? 0).toBeLessThanOrEqual(20);
    const four = scene('kartograf', line());
    for (const e of four.s.enemies) e.hp = e.hpMax = 1e6;
    cast(four.s, four.bus, 3);
    expect(four.s.hero.ult?.active[0]?.shots).toBe(4);
    expect(four.s.hero.ult?.active[0]?.left).toBeCloseTo(4, 5);
    const hits4 = volleys(four.s, four.bus, 20);
    expect(hits4.get(four.s.enemies[0]?.id ?? -1) ?? 0).toBeGreaterThanOrEqual(60);
  });

  it('the effect on the auto ends with the ultimate', () => {
    const { s, bus } = scene('kartograf', line());
    cast(s, bus, 3);
    run(s, bus, 4.1);
    expect(s.hero.ult?.active).toHaveLength(0);
    const front = s.enemies[0];
    for (const e of s.enemies) e.hp = e.hpMax = 1e6;
    const hits = volleys(s, bus, 20);
    expect(hits.get(front?.id ?? -1) ?? 0).toBeLessThanOrEqual(20);
  });
});

describe('Decyzja Komisji', () => {
  it('§ 1: whoever enters is zablokowany for 1.5 s and takes 1.0x once; the Wniosek follows him; he gains 6 racja a second', () => {
    const { s, bus } = scene('nalesnik', [[100, 0], [320, 0]]);
    const [in1, out] = s.enemies as [Enemy, Enemy];
    s.player.hp = 500;
    cast(s, bus, 1);
    run(s, bus, 1);
    expect(hasStatus(in1, 'zablokowany')).toBe(true);
    expect(hpLost(in1)).toBe(10);
    run(s, bus, 2);
    expect(hpLost(in1)).toBe(10); // once
    expect(s.player.hp).toBeGreaterThanOrEqual(500 + 6 * 3 - 0.5);
    s.player.x += 200; // he moves; the enemy at 320 is now inside
    run(s, bus, 0.1);
    expect(hpLost(out)).toBe(10);
    expect(hasStatus(out, 'zablokowany')).toBe(true);
  });

  it('§ 2 odmowna: 2.0x, 4 s', () => {
    const { s, bus } = scene('nalesnik', [[100, 0]]);
    cast(s, bus, 2);
    run(s, bus, 0.1);
    expect(hpLost(s.enemies[0] as Enemy)).toBe(20);
    run(s, bus, 4);
    expect(ultimateActive(s)).toBe(false);
  });

  it('§ 3 warunkowa: no lock, half damage to everyone inside every second, for 8 s', () => {
    const { s, bus } = scene('nalesnik', [[100, 0]]);
    const e = s.enemies[0];
    if (!e) throw new Error('no enemy');
    cast(s, bus, 3);
    run(s, bus, 3.05);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    expect(hpLost(e)).toBeGreaterThanOrEqual(10);
    expect(hpLost(e)).toBeLessThanOrEqual(20);
    expect(s.hero.ult?.active[0]?.left).toBeGreaterThan(4);
  });
});
