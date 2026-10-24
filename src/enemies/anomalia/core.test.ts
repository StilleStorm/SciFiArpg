import { afterEach, describe, expect, it } from 'vitest';
import { answerSpor } from '../../combat/spor';
import { createBus, type Bus, type GameEvents } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { HERO_IDS, type HeroId } from '../../heroes';
import { t } from '../../i18n';
import { makeUnique, UNIQUES } from '../../items/uniques';
import { createSim } from '../../systems/step';
import { applyDamage } from '../../systems/combat';
import { bindLoot, dropLoot } from '../../systems/loot';
import { settleCampaign, CAMPAIGN_LAST } from '../../world/campaign';
import { finaleCampaign, finalePage, finalePlan, finalUnique, heldUniqueIds, uniqueRng } from '../../world/finale';
import { bindRunEvents } from '../../world/pageTurn';
import { createRun, type RunState } from '../../world/run';
import { addItem } from '../../items/inventory';
import { rtOf } from '../runtime';
import { FACE_END_FRACTION, FORM_ORDER, finaleScale } from './bodies';
import { advanceStage, deskOf, finaleInfo, skipTo } from './core';
import { anomaliaHit } from './gate';
import './register';
import { faceFor, registerFace, type AnomaliaFace } from './index';
import { captionKeyOf, faceHeroOf, finaleOf, isAnomalia, isRetired, stageOf } from './state';

interface Ctx {
  s: RunState;
  bus: Bus;
  log: { name: keyof GameEvents; payload: unknown }[];
  step(n?: number): void;
  seconds(sec: number): void;
  body(): Enemy;
  notes(): string[];
}

const EVENTS = ['footnote', 'stamp', 'spor:posted', 'spor:closed', 'enemy:died', 'boss:died', 'run:ended', 'margin:note'] as const;

function finale(heroId: HeroId = 'konsultant', seed = 7, priority: 'niski' | 'normalny' | 'wysoki' | 'krytyczny' = 'normalny'): Ctx {
  const s = createRun(seed, { heroId, plan: finalePlan(seed, priority) });
  s.campaign = finaleCampaign(CAMPAIGN_LAST);
  s.player.hp = s.player.hpMax = 1e7;
  const bus = createBus();
  const log: Ctx['log'] = [];
  for (const name of EVENTS) bus.on(name, (payload) => log.push({ name, payload }));
  bindLoot(bus, () => s);
  bindRunEvents(bus, () => s);
  const sim = createSim(bus);
  const ctx: Ctx = {
    s,
    bus,
    log,
    step: (n = 1) => {
      for (let i = 0; i < n; i++) sim.step(s, 1 / 60);
    },
    seconds: (sec) => ctx.step(Math.round(sec * 60)),
    body() {
      const f = finaleOf(s);
      const e = s.enemies.find((x) => x.id === f?.currentId);
      if (!e) throw new Error('no Anomalia on the page');
      return e;
    },
    notes: () => log.filter((l) => l.name === 'footnote').map((l) => (l.payload as { text: string }).text),
  };
  ctx.step(); // the first step populates the page: the Anomalia takes the desk
  return ctx;
}

/** The racja of the body goes down to its last point by the normal path (the gate holds it at 1). */
function wear(c: Ctx): void {
  applyDamage(c.s, c.bus, c.body(), 1e9, false, 'mechaniczny');
}

const names = (c: Ctx, n: keyof GameEvents) => c.log.filter((l) => l.name === n);

const originals = new Map<HeroId, AnomaliaFace | undefined>();
afterEach(() => {
  for (const f of originals.values()) if (f) registerFace(f);
  originals.clear();
});

function stubFace(heroId: HeroId, extra: Partial<AnomaliaFace> = {}) {
  originals.set(heroId, faceFor(heroId));
  const calls = { start: 0, tick: 0, stop: 0 };
  const flags = { done: false, mul: 1 };
  const face: AnomaliaFace = {
    heroId,
    sporAnswer: 'egzystencjalny',
    figure: 'stub',
    start: () => void calls.start++,
    tick: () => void calls.tick++,
    damageMul: () => flags.mul,
    done: () => flags.done,
    stop: () => void calls.stop++,
    ...extra,
  };
  registerFace(face);
  return { face, calls, flags };
}

describe('the final ticket as one page', () => {
  it('is a run of one page: planet 1 base layout, no exit, no desk collider, the other stations stay as walls', () => {
    const s = createRun(11, { plan: finalePlan(11) });
    expect(s.pages).toHaveLength(1);
    expect(s.pageCount).toBe(1);
    expect(s.page.exit).toBeNull();
    expect(s.page.hasKiosk).toBe(false);
    expect(s.page.base?.stations.map((st) => st.id)).toContain('biurko');
    expect(s.page.obstacles.some((o) => o.station === 'biurko')).toBe(false);
    expect(s.page.obstacles.filter((o) => o.station !== undefined && o.station !== 'prop').length).toBe(4);
    expect(s.page.w).toBe(900);
  });
  it('is the same layout as the base the player left', () => {
    const base = createRun(11, { plan: finalePlan(11), phase: 'base' });
    expect(base.page.base?.layout).toBe(finalePage(11).base?.layout);
    expect(base.page.base?.stations).toEqual(finalePage(11).base?.stations);
  });
  it('keeps the decor clear of the desk', () => {
    for (let seed = 1; seed < 40; seed++) {
      const p = finalePage(seed);
      const d = deskOf(p);
      for (const o of p.obstacles) if (o.station === undefined && o.kind !== 'torn') for (const c of o.colliders) expect(Math.hypot(c.x - d.x, c.y - d.y)).toBeGreaterThan(c.r + 100);
    }
  });
  it('never turns the page, spawns no waves and ends only with the Anomalia', () => {
    const c = finale();
    c.seconds(30);
    expect(c.s.pageIndex).toBe(0);
    expect(c.s.turning).toBe(false);
    expect(c.s.enemies).toHaveLength(1);
    expect(c.s.spawnTimer).toBe(Infinity);
  });
  it('scales like the planet after the last one, by priority', () => {
    const a = finaleScale('normalny');
    const k = finaleScale('krytyczny');
    expect(a.hp).toBeGreaterThan(1);
    expect(k.hp).toBeGreaterThan(a.hp);
    const n = finale('konsultant', 7, 'normalny').body().hpMax;
    const kk = finale('konsultant', 7, 'krytyczny').body().hpMax;
    expect(kk).toBeGreaterThan(n);
  });
});

describe('phase 1: the three family forms', () => {
  it('opens with the meet note, the first form at the desk, and the old Asystent speaking first', () => {
    const c = finale();
    const e = c.body();
    const d = deskOf(c.s.page);
    expect(e.boss).toBe(true);
    expect(e.family).toBe('urzadzenia');
    expect(Math.hypot(e.x - d.x, e.y - d.y)).toBeLessThan(40);
    expect(isAnomalia(e)).toBe(true);
    expect(stageOf(e)).toBe('form');
    const n = c.notes();
    expect(n[0]).toBe(t('story.finale.phase1.meet'));
    expect(n).toContain(t('story.finale.phase1.form.prototyp.old'));
    expect(n).not.toContain(t('story.finale.phase1.form.prototyp.new'));
  });
  it('corrects the old note a few seconds later, as a correction', () => {
    const c = finale();
    c.seconds(4);
    const corr = c.log.filter((l) => l.name === 'footnote' && (l.payload as { correction?: boolean }).correction === true);
    expect(corr.map((l) => (l.payload as { text: string }).text)).toEqual([t('story.finale.phase1.form.prototyp.new')]);
  });
  it('cycles prototyp, weryfikacja, hipoteza; each fall strikes the body and draws the next', () => {
    stubFace('konsultant');
    const c = finale();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const e = c.body();
      seen.push(e.family);
      expect(finaleInfo(c.s)?.form).toBe(i);
      wear(c);
      expect(c.s.enemies).toContain(e);
      c.step();
      expect(c.s.enemies).not.toContain(e);
      expect(isRetired(c.s, e.id)).toBe(true);
    }
    expect(seen).toEqual([...FORM_ORDER]);
    expect(finaleInfo(c.s)?.stage).toBe('face');
    expect(names(c, 'enemy:died')).toHaveLength(3);
    for (const l of names(c, 'enemy:died')) expect((l.payload as { tier?: string }).tier).toBe('common');
  });
  it('a struck form drops nothing, ends nothing', () => {
    stubFace('konsultant');
    const c = finale();
    wear(c);
    c.step();
    wear(c);
    c.step();
    expect(c.s.pickups).toHaveLength(0);
    expect(names(c, 'boss:died')).toHaveLength(0);
    expect(c.s.victoryAt).toBeNull();
  });
  it('no blow ends a form: the racja stops at 1', () => {
    const c = finale();
    const e = c.body();
    expect(applyDamage(c.s, c.bus, e, 1e9, true, 'mechaniczny')).toBe(false);
    expect(e.hp).toBe(1);
    expect(c.s.enemies).toContain(e);
    expect(applyDamage(c.s, c.bus, e, 50, false, 'mechaniczny')).toBe(false);
    expect(e.hp).toBe(1);
  });
  it('posts one Spor comment in phase 1, 1.5 s in: regulaminowy answers it, no comment of the family table follows', () => {
    const c = finale();
    c.seconds(1.6);
    const sp = c.s.spor;
    expect(sp?.prompt?.commentKey).toBe('story.finale.phase1.spor.comment');
    expect(sp?.prompt?.replies.map((r) => r.textKey).sort()).toEqual(['egzystencjalny', 'mechaniczny', 'regulaminowy'].map((ty) => `story.finale.phase1.spor.reply.${ty}`).sort());
    expect(sp?.prompt?.replies[sp.prompt.correct].type).toBe('regulaminowy');
    const posted = names(c, 'spor:posted').length;
    // half racja on the Prototyp would post the family's phase 2 comment on an ordinary boss
    c.body().hp = Math.floor(c.body().hpMax * 0.4);
    c.seconds(1);
    expect(names(c, 'spor:posted')).toHaveLength(posted);
  });
  it('the phase 1 comment carries the ticket number it names (spor:posted params)', () => {
    const c = finale();
    c.seconds(1.6);
    const posted = c.log.find((l) => l.name === 'spor:posted')?.payload as GameEvents['spor:posted'] | undefined;
    expect(posted?.params).toEqual({ number: c.s.ticket.number });
    expect(t(posted?.commentKey ?? '', posted?.params)).toContain(String(c.s.ticket.number));
  });
  it('one racja threshold: the faces end where the core ends phase 2', async () => {
    const common = await import('./faces/common');
    expect(common.FACE_END_FRACTION).toBe(FACE_END_FRACTION);
  });
  it('a correction note of phase 1 is flagged for the footnote printer', () => {
    const c = finale();
    c.seconds(4);
    const fixes = c.log.filter((l) => l.name === 'footnote' && (l.payload as GameEvents['footnote']).correction === true);
    expect(fixes.length).toBeGreaterThanOrEqual(1);
  });
  it('counts a right reply once, at the moment the window opens', () => {
    const c = finale();
    c.seconds(1.6);
    const idx = c.s.spor?.prompt?.correct ?? 0;
    expect(answerSpor(c.s, c.bus, idx)).toBe('right');
    c.seconds(0.5);
    expect(finaleInfo(c.s)?.correct).toBe(1);
    c.seconds(2);
    expect(finaleInfo(c.s)?.correct).toBe(1);
  });
  it('a wrong reply counts for nothing', () => {
    const c = finale();
    c.seconds(1.6);
    const idx = ((c.s.spor?.prompt?.correct ?? 0) + 1) % 3;
    expect(answerSpor(c.s, c.bus, idx as 0 | 1 | 2)).toBe('wrong');
    c.seconds(0.5);
    expect(finaleInfo(c.s)?.correct).toBe(0);
  });
});

describe('phase 2: the hero face (a stub in this file)', () => {
  it('starts when phase 1 ends: the phase 1 end note, the face meet note, start once, a body of the face', () => {
    const { calls } = stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    const e = c.body();
    expect(calls.start).toBe(1);
    expect(stageOf(e)).toBe('face');
    expect(faceHeroOf(e)).toBe('pralka');
    expect(captionKeyOf(e)).toBe('story.finale.face.pralka.name');
    expect(e.existence).toBeUndefined();
    const n = c.notes();
    expect(n).toContain(t('story.finale.phase1.end'));
    expect(n).toContain(t('story.finale.face.pralka.meet'));
    expect(n.indexOf(t('story.finale.phase1.end'))).toBeLessThan(n.indexOf(t('story.finale.face.pralka.meet')));
  });
  it('ticks the face every step', () => {
    const { calls } = stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    const before = calls.tick;
    c.step(30);
    expect(calls.tick - before).toBe(30);
  });
  it('multiplies a hit by the face damageMul (0 = it cannot be hurt there)', () => {
    const { flags } = stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    const e = c.body();
    const hp = e.hp;
    flags.mul = 0;
    applyDamage(c.s, c.bus, e, 40, false, 'mechaniczny');
    expect(e.hp).toBe(hp);
    flags.mul = 1;
    applyDamage(c.s, c.bus, e, 40, false, 'mechaniczny');
    const one = hp - e.hp;
    expect(one).toBeGreaterThan(0);
    const mid = e.hp;
    flags.mul = 2;
    applyDamage(c.s, c.bus, e, 40, false, 'mechaniczny');
    expect(mid - e.hp).toBe(one * 2);
  });
  it('asks damageMul with the point of the body that faces the player', () => {
    const seen: { x: number; y: number }[] = [];
    stubFace('pralka', {
      damageMul: (_s, _e, x, y) => {
        seen.push({ x, y });
        return 1;
      },
    });
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    const e = c.body();
    c.s.player.x = e.x - 400;
    c.s.player.y = e.y;
    applyDamage(c.s, c.bus, e, 5, false, 'mechaniczny');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.x).toBeCloseTo(e.x - e.r, 3);
    expect(seen[0]?.y).toBeCloseTo(e.y, 3);
  });
  it('posts the face comment from faceKeys; the right reply is the face sporAnswer', () => {
    stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    c.seconds(1.6);
    const p = c.s.spor?.prompt;
    expect(p?.commentKey).toBe('story.finale.face.pralka.spor.comment');
    expect(p?.replies[p.correct].type).toBe('egzystencjalny');
    expect(p?.replies.map((r) => r.textKey).every((k) => t(k) !== k)).toBe(true);
  });
  it('ends on done: stop once, the end note, phase 3', () => {
    const { calls, flags } = stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    c.step(5);
    expect(finaleInfo(c.s)?.stage).toBe('face');
    flags.done = true;
    c.step();
    expect(calls.stop).toBe(1);
    expect(finaleInfo(c.s)?.stage).toBe('last');
    expect(c.notes()).toContain(t('story.finale.face.pralka.end'));
    expect(c.notes()).toContain(t('story.finale.phase3.meet'));
    c.step(10);
    expect(calls.stop).toBe(1);
  });
  it('ends at its racja threshold even when the face never says done', () => {
    const { calls } = stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    const e = c.body();
    e.hp = Math.floor(e.hpMax * FACE_END_FRACTION) - 1;
    c.step();
    expect(calls.stop).toBe(1);
    expect(finaleInfo(c.s)?.stage).toBe('last');
    expect(isRetired(c.s, e.id)).toBe(true);
  });
  it('no blow ends the face either', () => {
    stubFace('pralka');
    const c = finale('pralka');
    skipTo(c.s, c.bus, 'face');
    const e = c.body();
    applyDamage(c.s, c.bus, e, 1e9, false, 'mechaniczny');
    expect(e.hp).toBe(1);
    expect(c.s.enemies).toContain(e);
  });
  it('is skipped cleanly when the hero has no face: phase 1 end note, straight to phase 3', () => {
    const c = finale('pralka');
    c.s.player.heroId = 'zzz' as HeroId;
    finaleOf(c.s)!.heroId = 'zzz' as HeroId;
    skipTo(c.s, c.bus, 'face');
    expect(finaleInfo(c.s)?.stage).toBe('last');
    expect(c.notes()).toContain(t('story.finale.phase1.end'));
    expect(c.notes()).not.toContain(t('story.finale.face.pralka.meet'));
  });
});

describe('every registered hero has a face the core can run', () => {
  it('runs all three phases for every hero with the real faces (no stubs)', () => {
    for (const id of HERO_IDS) {
      const c = finale(id, 3);
      expect(skipTo(c.s, c.bus, 'face')).toBe(true);
      expect(finaleInfo(c.s)?.stage).toBe('face');
      c.seconds(3);
      expect(skipTo(c.s, c.bus, 'last')).toBe(true);
      expect(finaleInfo(c.s)?.stage).toBe('last');
      expect(skipTo(c.s, c.bus, 'end')).toBe(true);
      expect(names(c, 'boss:died')).toHaveLength(1);
    }
  });
});

describe('phase 3: existence and the closing stamp', () => {
  function toLast(correct = 0): Ctx {
    const c = finale('konsultant');
    skipTo(c.s, c.bus, 'last');
    const f = finaleOf(c.s);
    if (f && correct) {
      f.correct = correct;
    }
    return c;
  }
  it('starts at full existence with no right reply, lower with more, never under 0.3', () => {
    const c0 = finale('konsultant');
    finaleOf(c0.s)!.correct = 0;
    skipTo(c0.s, c0.bus, 'last');
    const e0 = c0.body().existence ?? 0;
    const c2 = finale('konsultant');
    finaleOf(c2.s)!.correct = 2;
    skipTo(c2.s, c2.bus, 'last');
    const e2 = c2.body().existence ?? 0;
    const c9 = finale('konsultant');
    finaleOf(c9.s)!.correct = 9;
    skipTo(c9.s, c9.bus, 'last');
    const e9 = c9.body().existence ?? 0;
    expect(e0).toBeCloseTo(1, 5);
    expect(e2).toBeLessThan(e0);
    expect(e9).toBeCloseTo(0.3, 5);
    expect(c2.body().hpMax).toBeLessThan(c0.body().hpMax);
  });
  it('posts its comment; egzystencjalny answers it', () => {
    const c = toLast();
    c.seconds(1.6);
    expect(c.s.spor?.prompt?.commentKey).toBe('story.finale.phase3.spor.comment');
    const p = c.s.spor?.prompt;
    expect(p?.replies[p.correct].type).toBe('egzystencjalny');
  });
  it('what it takes is not paid for in existence: a hit lands whole', () => {
    const c = toLast(2);
    const e = c.body();
    e.existence = 0.5;
    const before = e.hp;
    c.s.player.x = e.x;
    applyDamage(c.s, c.bus, e, 40, false, 'regulaminowy'); // not the type of its claim: no rebuttal crit
    const lost = before - e.hp;
    expect(Math.abs(lost - 40)).toBeLessThanOrEqual(2);
  });
  it('wears thinner as it is hurt: the coefficient follows the racja', () => {
    const c = toLast();
    const e = c.body();
    const full = e.existence ?? 0;
    e.hp = Math.round(e.hpMax * 0.4);
    c.step();
    expect(e.existence ?? 1).toBeLessThan(full);
    expect(e.existence ?? 0).toBeGreaterThanOrEqual(0.3);
  });
  it('a right reply in phase 3 takes racja and existence', () => {
    const c = toLast();
    c.seconds(1.6);
    const e = c.body();
    const hp = e.hp;
    const ex = e.existence ?? 1;
    answerSpor(c.s, c.bus, c.s.spor?.prompt?.correct ?? 0);
    c.step(2);
    expect(e.hp).toBeLessThan(hp * 0.7);
    expect(e.existence ?? 1).toBeLessThan(ex);
    expect(finaleInfo(c.s)?.correct).toBe(1);
  });
  it('no blow kills it; at the last racja the stamp falls, then the notes, then the body is struck', () => {
    const c = toLast();
    const e = c.body();
    applyDamage(c.s, c.bus, e, 1e9, false, 'mechaniczny');
    expect(e.hp).toBe(1);
    expect(c.s.enemies).toContain(e);
    expect(names(c, 'boss:died')).toHaveLength(0);
    c.step();
    expect(c.s.enemies).not.toContain(e);
    const stamps = names(c, 'stamp').map((l) => (l.payload as { text: string }).text);
    expect(stamps).toEqual([t('story.finale.phase3.stamp')]);
    const n = c.notes();
    const tail = n.slice(-3);
    expect(tail).toEqual([t('story.finale.phase3.close'), t('story.finale.hero.konsultant'), t('story.finale.footnote')]);
    expect(names(c, 'boss:died')).toHaveLength(1);
    expect(finaleInfo(c.s)?.stage).toBe('done');
  });
  it('says the hero line of whoever plays', () => {
    for (const id of HERO_IDS) {
      const c = finale(id, 5);
      skipTo(c.s, c.bus, 'end');
      expect(c.notes()).toContain(t(`story.finale.hero.${id}`));
      expect(t(`story.finale.hero.${id}`)).not.toBe(`story.finale.hero.${id}`);
    }
  });
  it('runs the ticket out 2.8 s later: ukonczono, no ordinary victory stamp, the case closes', () => {
    const c = toLast();
    skipTo(c.s, c.bus, 'end');
    expect(c.s.victoryAt).not.toBeNull();
    expect(names(c, 'stamp')).toHaveLength(1);
    c.seconds(3.2);
    expect(names(c, 'run:ended').map((l) => (l.payload as { outcome: string }).outcome)).toEqual(['ukonczono']);
    const res = settleCampaign(c.s, c.bus, 'ukonczono');
    expect(res?.caseClosed).toBe(true);
    expect(c.s.campaign?.caseClosed).toBe(true);
    expect(c.s.campaign?.finalTicket).toBe(false);
  });
  it('drops the boss loot of the final ticket once: three items, the first a unique', () => {
    const c = toLast();
    skipTo(c.s, c.bus, 'end');
    const items = c.s.pickups.filter((k) => k.item).map((k) => k.item);
    expect(items.length).toBe(3);
    expect(items[0]?.tier).toBe('unikatowy');
    expect(items[0]?.uniqueId).toBeTruthy();
  });
});

describe('the unique of the final ticket', () => {
  it('is one the character does not hold yet', () => {
    const c = finale('konsultant', 9);
    const all = UNIQUES.map((u) => u.id);
    for (const id of all.slice(0, all.length - 1)) {
      const def = UNIQUES.find((u) => u.id === id);
      const it = def ? makeUnique(def, 100 + all.indexOf(id), 5) : null;
      if (it) addItem(c.s.player, it);
    }
    const left = all[all.length - 1];
    expect(heldUniqueIds(c.s).has(left ?? '')).toBe(false);
    for (let seed = 1; seed < 12; seed++) expect(finalUnique(c.s, uniqueRng(seed), 8)?.uniqueId).toBe(left);
  });
  it('falls back to any unique when all are held', () => {
    const c = finale('konsultant', 9);
    c.s.player.inventory.length = 0;
    UNIQUES.forEach((u, i) => {
      const it = makeUnique(u, 200 + i, 5);
      if (it) c.s.player.equipment[it.slot] = it;
    });
    const got = finalUnique(c.s, uniqueRng(3), 8);
    expect(got?.tier).toBe('unikatowy');
  });
  it('dropLoot of a boss on the final plan hands over only uniques not held', () => {
    const c = finale('konsultant', 9);
    c.s.pickups.length = 0;
    dropLoot(c.s, 100, 100, 'boss');
    const first = c.s.pickups.find((k) => k.item)?.item;
    expect(first?.tier).toBe('unikatowy');
  });
});

describe('the test hook helpers', () => {
  it('skipTo reaches each target and stops there', () => {
    stubFace('pralka');
    const c = finale('pralka');
    expect(skipTo(c.s, c.bus, 'face')).toBe(true);
    expect(finaleInfo(c.s)?.stage).toBe('face');
    expect(skipTo(c.s, c.bus, 'last')).toBe(true);
    expect(finaleInfo(c.s)?.stage).toBe('last');
    expect(skipTo(c.s, c.bus, 'end')).toBe(true);
    expect(finaleInfo(c.s)?.stage).toBe('done');
    expect(advanceStage(c.s, c.bus)).toBe(false);
  });
  it('Planeta exposes its measured parts to the renderer through the face contract', () => {
    const kartograf = HERO_IDS.find((id) => faceFor(id)?.parts !== undefined);
    expect(kartograf).toBeDefined();
    const c = finale(kartograf);
    skipTo(c.s, c.bus, 'face');
    const parts = faceFor(c.s.player.heroId)?.parts?.(c.body());
    expect(parts).toHaveLength(7);
    expect(parts?.every((p) => !p)).toBe(true);
  });
  it('anomaliaHit leaves any other enemy alone', () => {
    const c = finale();
    const other = { ...c.body() } as Enemy;
    expect(anomaliaHit(c.s, other, 17)).toBe(17);
    expect(rtOf(other)).toBeTruthy();
  });
});
