import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createGrid, type Enemy } from '../entities';
import { t } from '../i18n';
import { applyDamage } from '../systems/combat';
import { createRun, type RunState } from '../world/run';
import { updateEnemyAi } from './ai';
import {
  NADGORLIWY_CAP,
  ODNAWIALNY_QUIET_S,
  POUFNY_DMG_MUL,
  POWIELONY_COPIES,
  WIELOKROTNY_REACH,
  affixSpeedMul,
  affixTempoMul,
  hasAffix,
  ownAffixes,
} from './elites';
import { ELITES, ELITE_IDS, SPONSOR_SPEED_MUL, eliteWord } from './families';
import { makeEnemy } from './make';
import { ADJ_IDS, NOUN_IDS, TAIL_IDS, claimNamedDrop, composeName, generateName, namedRecord } from './named';
import { createRng } from '../core/rng';
import { rtOf } from './runtime';
import { PACK_MAX, PACK_MIN, bindEliteDeaths, spawnElite, spawnPack, spawnWave, trackElite } from './spawn';

const run = (seed = 5): RunState => {
  const s = createRun(seed);
  s.enemies.length = 0;
  return s;
};
const put = (s: RunState, x = 700, y = 700, opts = {}): Enemy => {
  const e = makeEnemy(s.nextId++, x, y, 1234, 'urzadzenia', opts);
  e.home = { x, y };
  e.defect = undefined;
  rtOf(e).asleep = false;
  rtOf(e).age = 10;
  s.enemies.push(e);
  trackElite(s, e);
  return e;
};

describe('the elite pool', () => {
  it('has ten affixes, each with four grammar forms and an effect line', () => {
    expect(ELITE_IDS).toHaveLength(10);
    for (const id of ELITE_IDS) {
      const p = ELITES[id].prefix;
      for (const g of ['m', 'f', 'n', 'pl', 'effect']) expect(t(`${p}.${g}`), `${p}.${g}`).not.toBe(`${p}.${g}`);
    }
    expect(eliteWord('wielokrotny', 'fridge')).toBe('wielokrotna');
    expect(eliteWord('odnawialny', 'card')).toBe('odnawialne');
  });
  it('pilny attacks half again as often; nadgorliwy speeds up with age up to the cap', () => {
    const s = run();
    const a = put(s, 700, 700, { elite: 'pilny' });
    expect(affixTempoMul(a)).toBe(1.5);
    const b = put(s, 700, 700, { elite: 'nadgorliwy' });
    rtOf(b).age = 0;
    expect(affixSpeedMul(b, SPONSOR_SPEED_MUL)).toBe(1);
    rtOf(b).age = 20;
    expect(affixSpeedMul(b, SPONSOR_SPEED_MUL)).toBeCloseTo(1.3, 5);
    rtOf(b).age = 500;
    expect(affixSpeedMul(b, SPONSOR_SPEED_MUL)).toBeCloseTo(1 + NADGORLIWY_CAP, 5);
  });
  it('odnawialny heals after a quiet spell and not before', () => {
    const s = run();
    s.player.suspended = true;
    const bus = createBus();
    const grid = createGrid<Enemy>(64);
    const e = put(s, 700, 700, { elite: 'odnawialny' });
    e.hp = Math.round(e.hpMax / 2);
    const hurt = e.hp;
    s.time = 10;
    rtOf(e).hurtAt = 9;
    updateEnemyAi(s, grid, bus, 0.5);
    expect(e.hp).toBe(hurt);
    s.time = 9 + ODNAWIALNY_QUIET_S + 1;
    updateEnemyAi(s, grid, bus, 0.5);
    expect(e.hp).toBeGreaterThan(hurt);
  });
  it('poufny takes 30% less unless the hit answers the claim', () => {
    const s = run();
    const bus = createBus();
    const plain = put(s, 700, 700);
    const conf = put(s, 900, 700, { elite: 'poufny' });
    plain.hp = plain.hpMax = conf.hp = conf.hpMax = 1000;
    // a damage type that is not the rebuttal of the claim
    const wrong = (['mechaniczny', 'regulaminowy', 'egzystencjalny'] as const).find((ty) => plain.claim && conf.claim && !isReb(plain, ty) && !isReb(conf, ty));
    expect(wrong).toBeDefined();
    if (!wrong) return;
    applyDamage(s, bus, plain, 100, false, wrong);
    applyDamage(s, bus, conf, 100, false, wrong);
    const lostPlain = 1000 - plain.hp;
    const lostConf = 1000 - conf.hp;
    expect(lostConf / lostPlain).toBeCloseTo(POUFNY_DMG_MUL, 1);
  });
  it('powielony leaves two ordinary copies of its family where it falls', () => {
    const s = run();
    const bus = createBus();
    bindEliteDeaths(s, bus);
    const e = put(s, 700, 700, { elite: 'powielony' });
    e.hp = 1;
    const before = s.enemies.length;
    applyDamage(s, bus, e, 50, false);
    expect(s.enemies.length).toBe(before - 1 + POWIELONY_COPIES);
    expect(s.enemies.every((x) => x.elite === undefined && x.family === 'urzadzenia')).toBe(true);
  });
  it('wielokrotny reaches further in melee', () => {
    const s = run();
    const plain = put(s, 700, 700, { elite: 'zweryfikowany' });
    const w = put(s, 700, 700, { elite: 'wielokrotny' });
    if (w.attackRange > 18) expect(w.attackRange / plain.attackRange).toBeCloseTo(WIELOKROTNY_REACH, 1);
  });
});

function isReb(e: Enemy, ty: string): boolean {
  return e.claim?.type === ty;
}

describe('packs', () => {
  it('a leader comes with 2-4 minions of its family that share its aura', () => {
    const s = run();
    const leader = spawnElite(s, 'wygenerowane', { x: 800, y: 800 }, 'sponsorowany', { pack: true });
    expect(leader).not.toBeNull();
    if (!leader) return;
    const minions = s.enemies.filter((e) => rtOf(e).packOf === leader.id);
    expect(minions.length).toBeGreaterThanOrEqual(1);
    expect(minions.length).toBeLessThanOrEqual(PACK_MAX);
    expect(rtOf(leader).packSize).toBe(minions.length);
    expect(minions.every((m) => m.family === 'wygenerowane' && m.tier === leader.tier && m.elite === undefined)).toBe(true);
    s.player.suspended = true;
    updateEnemyAi(s, createGrid<Enemy>(64), createBus(), 1 / 60);
    for (const m of minions) expect(hasAffix(m, 'sponsorowany')).toBe(true);
    expect(minions.length).toBeGreaterThanOrEqual(1);
    expect(PACK_MIN).toBe(2);
  });
  it('the aura reaches minions that stray beyond its radius; the share ends with the leader', () => {
    const s = run();
    s.player.suspended = true;
    const bus = createBus();
    const leader = put(s, 300, 300, { elite: 'zweryfikowany' });
    const m = put(s, 1100, 1100);
    rtOf(m).packOf = leader.id;
    const grid = createGrid<Enemy>(64);
    updateEnemyAi(s, grid, bus, 1 / 60);
    expect(rtOf(m).dmgMult).toBeGreaterThan(1);
    s.enemies.splice(s.enemies.indexOf(leader), 1);
    updateEnemyAi(s, grid, bus, 1 / 60);
    expect(rtOf(m).dmgMult).toBe(1);
    expect(rtOf(m).shared).toEqual([]);
  });
  it('a wave of rolled elites makes packs, and is reproducible from the seed', () => {
    const sig = (seed: number): string => {
      const s = run(seed);
      for (let i = 0; i < 40; i++) spawnWave(s, 'urzadzenia', 4, { x: 900, y: 900 + (i % 5) * 20 }, { minPlayer: 0 });
      return s.enemies.map((e) => `${Math.round(e.x)}:${Math.round(e.y)}:${e.seed}:${rtOf(e).packOf ?? '-'}:${ownAffixes(e).join('+')}`).join('|');
    };
    expect(sig(21)).toBe(sig(21));
  });
  it('spawnPack on its own marks the leader', () => {
    const s = run();
    const leader = put(s, 800, 800, { elite: 'pilny' });
    const got = spawnPack(s, leader);
    expect(rtOf(leader).packSize).toBe(got.length);
  });
});

describe('named elites', () => {
  it('has 30 name parts, all present in the string table', () => {
    expect(NOUN_IDS.length + ADJ_IDS.length + TAIL_IDS.length).toBe(30);
    for (const n of NOUN_IDS) expect(t(`enemies.named.noun.${n}.text`)).not.toContain('enemies.');
    for (const a of ADJ_IDS) for (const g of ['m', 'f', 'n']) expect(t(`enemies.named.adj.${a}.${g}`)).not.toContain('enemies.');
    for (const a of TAIL_IDS) for (const g of ['m', 'f', 'n']) expect(t(`enemies.named.tail.${a}.${g}`)).not.toContain('enemies.');
  });
  it('agrees the adjective and the tail with the noun', () => {
    const plain = (x: string): string => x.replace(/\u00a0/g, ' ');
    expect(plain(composeName('monit', 'zbiorczy', 'nieodebrany'))).toBe('Monit Zbiorczy, nieodebrany od 2019');
    expect(plain(composeName('decyzja', 'ostateczny', 'uznany'))).toBe('Decyzja Ostateczna, uznana za doręczoną');
    expect(plain(composeName('pismo', 'wtorny', 'wycofany'))).toBe('Pismo Wtórne, wycofane i przywrócone');
  });
  it('names are drawn from the seed', () => {
    const a = generateName(createRng(9));
    expect(generateName(createRng(9))).toBe(a);
    const set = new Set(Array.from({ length: 60 }, (_, i) => generateName(createRng(i))));
    expect(set.size).toBeGreaterThan(30);
  });
  it('carries two or three distinct affixes and a recorded name', () => {
    for (let seed = 1; seed < 12; seed++) {
      const s = run(seed);
      const e = spawnElite(s, 'powiadomienia', { x: 900, y: 900 }, 'pilny', { makeNamed: true, pack: false });
      expect(e).not.toBeNull();
      if (!e) continue;
      const list = ownAffixes(e);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(new Set(list).size).toBe(list.length);
      expect(list[0]).toBe('pilny');
      expect(e.rt?.named?.name).toBe(namedRecord(s, e.id)?.name);
    }
  });
  it('appears at most once per two pages', () => {
    const s = run(33);
    const pages: number[] = [];
    for (let page = 0; page < 24; page++) {
      s.pageIndex = page;
      s.enemies.length = 0;
      for (let k = 0; k < 6; k++) spawnWave(s, 'urzadzenia', 3, { x: 900 + k * 5, y: 900 }, { minPlayer: 0 });
      if (s.enemies.some((e) => e.rt?.named)) pages.push(page);
    }
    expect(pages.length).toBeGreaterThan(2);
    for (let i = 1; i < pages.length; i++) expect((pages[i] ?? 0) - (pages[i - 1] ?? 0)).toBeGreaterThanOrEqual(2);
  });
  it('is sturdier than a plain elite', () => {
    const s = run();
    const a = put(s, 700, 700, { elite: 'zweryfikowany' });
    const b = put(s, 700, 700, { elite: 'zweryfikowany', affixes: ['zweryfikowany', 'pilny'], named: 'X' });
    expect(b.hpMax).toBeGreaterThan(a.hpMax);
  });
  it('guarantees one drop of at least nietypowy, once, and announces the kill', () => {
    const s = run(4);
    const bus = createBus();
    const seen: string[] = [];
    bus.on('elite:slain', (e) => seen.push(`${e.name}|${e.minTier}`));
    const notes: string[] = [];
    bus.on('footnote', (f) => notes.push(f.text));
    bindEliteDeaths(s, bus);
    const e = spawnElite(s, 'urzadzenia', { x: 900, y: 900 }, 'poufny', { makeNamed: true, pack: false });
    expect(e).not.toBeNull();
    if (!e) return;
    const name = e.rt?.named?.name ?? '';
    e.hp = 1;
    applyDamage(s, bus, e, 9999, false);
    expect(seen).toEqual([`${name}|nietypowy`]);
    expect(notes.some((n) => n.includes(name))).toBe(true);
    expect(claimNamedDrop(s, e.id)).toEqual({ minTier: 'nietypowy', name });
    expect(claimNamedDrop(s, e.id)).toBeNull();
    expect(claimNamedDrop(s, 99999)).toBeNull();
  });
  it('is entered in the Asystent record at the first meeting', () => {
    const s = run(6);
    const bus = createBus();
    const notes: string[] = [];
    const named: string[] = [];
    bus.on('footnote', (f) => notes.push(f.text));
    bus.on('elite:named', (e) => named.push(e.name));
    const e = spawnWave(s, 'urzadzenia', 1, { x: s.player.x + 120, y: s.player.y }, { elite: 'zweryfikowany', makeNamed: true, pack: false, minRadius: 0, maxRadius: 10, minPlayer: 0 })[0];
    expect(e).toBeDefined();
    if (!e) return;
    const grid = createGrid<Enemy>(64);
    for (const time of [20, 23, 26]) {
      s.time = time; // the family note comes first; the record follows after the gap
      updateEnemyAi(s, grid, bus, 1 / 60);
    }
    const name = e.rt?.named?.name ?? '?';
    expect(named).toEqual([name]);
    expect(notes.some((n) => n.includes(name) && n.includes('Cechy'))).toBe(true);
  });
});
