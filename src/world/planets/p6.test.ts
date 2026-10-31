import { describe, expect, it } from 'vitest';
import { promptFor, storyEntry } from '../../combat/spor';
import { hasStatus } from '../../combat/status';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import { BOSSES, SURVEY_CELLS, SURVEY_EVERY_S, SURVEY_EVERY_S2, SURVEY_FIRST_S, SURVEY_REMIND_S, bossIdOf, bossVariantLine, placeBoss, surveyCellAt, surveyCellCenter, tickBoss } from '../../enemies/bosses';
import { assembleBoss } from '../../enemies/assemble';
import { rtOf } from '../../enemies/runtime';
import { t } from '../../i18n';
import { drawingsOf } from '../../render/locations';
import { reachableCells } from '../base';
import { headlineOf, planetDef, type TicketPlan } from '../campaign';
import { openTeczka } from '../content';
import { GATE_FIGURE_TAP, gateFigureAt, gateHolds, gateLiftKey, stepGate, tapGateFigure } from '../gate';
import { npcAt } from '../npc';
import { generateRunPages, pickLocations } from '../pages';
import { populatePage } from '../pageTurn';
import { newQuests, offersFor, questById } from '../quests';
import { createRun, type RunState } from '../run';
import './index';
import { locationSpec, propColliders } from './locations';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'weryfikacja-dwuetapowa' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 6): RunState => createRun(seed, { plan: plan(5), pageCount });

const onPage = (s: RunState, i: number): void => {
  s.pageIndex = i;
  s.page = s.pages[i] ?? s.page;
  s.player.x = s.page.entry.x;
  s.player.y = s.page.entry.y;
};

describe('planet 6: the record and the page split', () => {
  it('is Akt II, headline Weryfikacja dwuetapowa, hosts Infolinia, boss Ankieta, locations centrum, serwerownia, archiwum with the split [2, 3]', () => {
    const p = planetDef(5);
    expect(p.act).toBe(2);
    expect(p.pages).toEqual([5, 6]);
    expect(p.hostedSet).toBe('infolinia');
    expect(p.boss).toBe('ankieta');
    expect(p.locations).toEqual(['centrum', 'serwerownia', 'archiwum']);
    expect(p.locationSplit).toEqual([2, 3]);
    expect(headlineOf(5)).toBe('weryfikacja-dwuetapowa');
    expect(planetDef(4).boss).toBe('weryfikacja');
  });

  it('pages 1-2 centrum, page 3 serwerownia, pages 4-6 and the boss page archiwum, for five and six pages', () => {
    const p = planetDef(5);
    expect(pickLocations(createRng(9), 5, p.locations, p.locationSplit)).toEqual(['centrum', 'centrum', 'serwerownia', 'archiwum', 'archiwum']);
    expect(pickLocations(createRng(9), 6, p.locations, p.locationSplit)).toEqual(['centrum', 'centrum', 'serwerownia', 'archiwum', 'archiwum', 'archiwum']);
    for (let seed = 1; seed < 12; seed++) expect(run(seed).pages.map((q) => q.location)).toEqual(['centrum', 'centrum', 'serwerownia', 'archiwum', 'archiwum', 'archiwum']);
  });
});

describe('planet 6: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 6, with every text written', () => {
    const c = npcAt(5);
    expect(c.id).toBe('p6-infolinia');
    expect(c.look).toBe(6);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
  });

  it('three hand-written tickets with the rewards of STORY 8.10, only on the planet 6 board', () => {
    const mine = offersFor(5, newQuests()).filter((o) => o.id.startsWith('h:p6:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p6:a', 'h:p6:b', 'h:p6:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      for (const n of [1, 2, 5]) expect(t(q.textKey, { count: n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(5);
    }
    expect(mine[0]).toMatchObject({ kind: 'kill', n: 6, family: 'wygenerowane', reward: { stars: 40, permission: 'wygenerowane' } });
    expect(mine[1]).toMatchObject({ kind: 'reach', n: 4, reward: { stars: 35, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 5, reward: { stars: 35 } });
    expect(offersFor(4, newQuests()).some((o) => o.id.startsWith('h:p6:'))).toBe(false);
  });
});

describe('planet 6: locations', () => {
  it('archiwum has its own drawings for every footprint but the serwerownia\'s plate; the stacks are the walls', () => {
    const spec = locationSpec('archiwum');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(spec?.layout).toBe('corridors');
    expect(spec?.wall).toBe('regal');
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect([...drawingsOf('archiwum'), 'cisza'].sort()).toEqual([...ids].sort());
    expect(drawingsOf('serwerownia')).toContain('cisza');
    for (const p of spec?.props ?? []) if (!spec?.flat.includes(p.id)) expect(propColliders(p.id, 0, 0, p.size[0]).length > 0, p.id).toBe(true);
  });

  it('every archiwum prop turns up, the exit is reachable, the middle aisle of the boss page is clear', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const page of generateRunPages(createRng(seed), 6, planetDef(5).locations, planetDef(5).locationSplit)) {
        if (page.location !== 'archiwum') continue;
        for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) seen.add(o.variant);
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - (page.exit?.x ?? 0), c.y - (page.exit?.y ?? 0)) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('archiwum')?.props ?? []).map((p) => p.id).sort());
  });

  it('miasto has the storefront props of STORY 8.9, each with a drawing and a footprint', () => {
    const ids = ['vitryna', 'baner', 'furgon', 'kartony-plaskie', 'manekin'];
    const spec = locationSpec('miasto');
    for (const id of ids) {
      expect(spec?.props.some((p) => p.id === id), id).toBe(true);
      expect(drawingsOf('miasto'), id).toContain(id);
      expect(propColliders(id, 0, 0, 100).length, id).toBeGreaterThan(0);
    }
    expect([...drawingsOf('miasto')].sort()).toEqual((spec?.props ?? []).map((p) => p.id).sort());
  });
});

describe('planet 6: the gate on page 4', () => {
  it('is placed on page index 3 only: a teczka gate keyed to the forced folder, the default band and an Archiwista', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(seed);
      s.pages.forEach((p, i) => expect(p.gate !== undefined, `seed ${seed} page ${i}`).toBe(i === 3));
      const page = s.pages[3];
      expect(page?.gate).toMatchObject({ kind: 'teczka', keyTeczka: true, key: 'story.p6.gate.note', liftKey: 'story.p6.gate.lift' });
      expect(page?.gate?.look).toBeUndefined();
      expect(page?.gate?.figure).toMatchObject({ look: 63, key: 'story.p6.gate.figure' });
      expect(page?.location).toBe('archiwum');
      const keys = (page?.content ?? []).filter((c) => c.kind === 'teczka' && c.key);
      expect(keys, `seed ${seed}`).toHaveLength(1);
      const key = keys[0];
      const cells = page ? reachableCells(page, page.entry, 20) : [];
      expect(cells.some((c) => Math.hypot(c.x - (key?.x ?? -999), c.y - (key?.y ?? -999)) < 40), `seed ${seed}`).toBe(true);
    }
    expect(createRun(3, { plan: plan(4), pageCount: 6 }).pages.some((p) => p.gate?.key === 'story.p6.gate.note')).toBe(false);
  });

  it('lifts only when the key folder is opened; the Archiwista answers a tap and walks off at the lift', () => {
    const s = run(7);
    onPage(s, 3);
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    const at = gateFigureAt(s.page);
    if (!at) throw new Error('no figure');
    expect(tapGateFigure(s, bus, at.x + 5, at.y - 5)).toBe(true);
    expect(notes).toEqual([t('story.p6.gate.figure')]);
    expect(tapGateFigure(s, bus, at.x + GATE_FIGURE_TAP + 40, at.y)).toBe(false);
    const list = (s.page.content ??= []);
    const other = { kind: 'teczka' as const, id: 777, x: 400, y: 400, seed: 5, opened: false };
    list.push(other);
    openTeczka(s, bus, other);
    expect(gateHolds(s, g)).toBe(true);
    const key = list.find((c) => c.kind === 'teczka' && c.key);
    if (!key || key.kind !== 'teczka') throw new Error('no key');
    openTeczka(s, bus, key);
    expect(gateHolds(s, g)).toBe(false);
    expect(stepGate(s)).toBe('lifted');
    expect(s.page.gate).toBeUndefined();
    expect(gateFigureAt(s.page)).toBeNull();
    expect(gateLiftKey(g)).toBe('story.p6.gate.lift');
    for (const k of ['story.p6.gate.note', 'story.p6.gate.lift', 'story.p6.gate.figure']) expect(known(k), k).toBe(true);
  });
});

describe('planet 6: the Ankieta', () => {
  const boss = (seed = 5): { s: RunState; e: ReturnType<typeof placeBoss> } => {
    const s = run(seed);
    onPage(s, 5);
    s.player.x = 700;
    s.player.y = 700;
    return { s, e: placeBoss(s, 'powiadomienia', 300, 300) };
  };
  const bus = createBus();
  const step = (s: RunState, e: ReturnType<typeof placeBoss>, secs: number): void => {
    for (let i = 0; i < Math.round(secs / 0.05); i++) tickBoss(s, e, bus, 0.05);
  };
  /** Wait for the first row and stand the player on square `i` of it. */
  const standOn = (s: RunState, e: ReturnType<typeof placeBoss>, i: number): void => {
    const sv = rtOf(e).survey;
    if (!sv?.on) step(s, e, SURVEY_FIRST_S + 0.2);
    const row = rtOf(e).survey;
    if (!row?.on) throw new Error('no row');
    const c = surveyCellCenter(row.cx, row.cy, i);
    s.player.x = c.x;
    s.player.y = c.y;
  };

  it('is the planet\'s body: Powiadomienia, racja 300, claim regulaminowy, no variant line; other planets keep Weryfikacja', () => {
    const { e } = boss();
    expect(bossIdOf(e)).toBe('ankieta');
    expect(e.hpMax).toBe(BOSSES.ankieta.hp);
    expect(e.family).toBe('powiadomienia');
    expect(e.claim?.type).toBe('regulaminowy');
    expect(e.claim?.textKey).toBe('enemies.claim.boss.ankieta');
    expect(known('enemies.claim.boss.ankieta')).toBe(true);
    expect(bossVariantLine(e)).toBeUndefined();
    expect(assembleBoss('ankieta', 3).body).toBe('ankieta');
    const other = placeBoss(createRun(5, { plan: plan(4), pageCount: 6 }), 'powiadomienia', 300, 300);
    expect(bossIdOf(other)).toBe('weryfikacja');
    expect(rtOf(other).survey).toBeUndefined();
    // a ticket on another family of this planet still gets that family's boss
    expect(bossIdOf(placeBoss(run(5), 'urzadzenia', 300, 300))).toBe('prototyp');
  });

  it('every footnote and the boss name are written; the page always finds a place for it, whatever the spawn stream did before', () => {
    for (const k of ['name', 'meet', 'hint', 'filed', 'thanked', 'reminder', 'half']) expect(known(`enemies.boss.ankieta.${k}`), k).toBe(true);
    for (let seed = 1; seed <= 120; seed++) {
      const s = run(seed);
      for (let k = 0; k < seed % 7; k++) s.rngs.spawn.int(1, 100);
      onPage(s, 5);
      populatePage(s, createBus());
      const e = s.enemies.find((q) => q.boss);
      expect(e, `seed ${seed}`).toBeDefined();
      if (e) expect(bossIdOf(e)).toBe('ankieta');
    }
  });

  it('squares: five in a line, 52 apart, the player is on at most one', () => {
    expect(SURVEY_CELLS).toBe(5);
    const c0 = surveyCellCenter(500, 400, 0);
    const c4 = surveyCellCenter(500, 400, 4);
    expect(c4.x - c0.x).toBe(4 * 52);
    expect((c0.x + c4.x) / 2).toBe(500);
    expect(surveyCellAt(500, 400, c0.x, 400)).toBe(0);
    expect(surveyCellAt(500, 400, 500, 400)).toBe(2);
    expect(surveyCellAt(500, 400, c4.x + 30, 400)).toBe(-1);
    expect(surveyCellAt(500, 400, 500, 440)).toBe(-1);
  });

  it('keeps the whole row on a phone held upright: every square within 195 units across of the player, whichever side the boss stands', () => {
    for (const [bx, by] of [[300, 300], [1100, 700], [300, 700], [700, 300]] as const) {
      const { s } = boss();
      const e = placeBoss(s, 'powiadomienia', bx, by);
      e.x = bx;
      e.y = by;
      step(s, e, SURVEY_FIRST_S + 0.3);
      const sv = rtOf(e).survey;
      expect(sv?.on).toBe(true);
      if (!sv) continue;
      for (let i = 0; i < SURVEY_CELLS; i++) expect(Math.abs(surveyCellCenter(sv.cx, sv.cy, i).x - s.player.x) + 26).toBeLessThanOrEqual(195);
    }
  });

  it('sends the first row after 4 s between itself and the player', () => {
    const { s, e } = boss();
    step(s, e, SURVEY_FIRST_S - 0.5);
    expect(rtOf(e).survey?.on).toBe(false);
    step(s, e, 0.8);
    const sv = rtOf(e).survey;
    expect(sv?.on).toBe(true);
    if (!sv) return;
    expect(sv.cx).toBeGreaterThan(300);
    expect(sv.cy).toBeGreaterThan(300);
    expect(sv.cx).toBeLessThan(700 + 1);
  });

  it('outcome 1: 1.5 s on the 1-star square files a complaint: zablokowany for 3 s, the row goes, the next after 8 s', () => {
    const { s, e } = boss();
    standOn(s, e, 0);
    const hp = e.hp;
    step(s, e, 1.2);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    step(s, e, 0.5);
    expect(hasStatus(e, 'zablokowany')).toBe(true);
    expect(rtOf(e).survey?.on).toBe(false);
    expect(e.hp).toBe(hp);
    expect(rtOf(e).survey?.wait).toBeCloseTo(SURVEY_EVERY_S, 0);
  });

  it('outcome 2: 1.5 s on the 5-star square thanks it: 10% racja back, the row goes, no block', () => {
    const { s, e } = boss();
    standOn(s, e, 4);
    e.hp = 100;
    step(s, e, 1.7);
    expect(e.hp).toBeCloseTo(100 + e.hpMax * 0.1, 5);
    expect(rtOf(e).survey?.on).toBe(false);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    e.hp = e.hpMax - 3;
    s.player.x = 700;
    s.player.y = 700;
    step(s, e, SURVEY_EVERY_S + 0.2);
    standOn(s, e, 4);
    step(s, e, 1.7);
    expect(e.hp).toBe(e.hpMax);
  });

  it('standing on the middle squares answers nothing; a row left 6 s summons two Przypomnienia and a new row', () => {
    const { s, e } = boss();
    standOn(s, e, 2);
    const before = s.enemies.filter((q) => q.family === 'powiadomienia' && !q.boss).length;
    const firstAge = rtOf(e).survey?.age ?? 0;
    step(s, e, SURVEY_REMIND_S - firstAge - 0.3);
    expect(rtOf(e).survey?.on).toBe(true);
    expect(s.enemies.filter((q) => q.family === 'powiadomienia' && !q.boss).length).toBe(before);
    step(s, e, 0.6);
    expect(s.enemies.filter((q) => q.family === 'powiadomienia' && !q.boss).length).toBe(before + 2);
    expect(rtOf(e).survey?.on).toBe(true);
    expect(rtOf(e).survey?.age ?? 99).toBeLessThan(1);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
  });

  it('at half racja: phase 2, the second comment is posted, the row is drawn round the player every 6 s', () => {
    const { s, e } = boss();
    const posted: number[] = [];
    bus.on('spor:posted', (ev) => posted.push(ev.phase));
    step(s, e, 0.1);
    e.hp = e.hpMax / 2 - 1;
    step(s, e, 0.1);
    expect(rtOf(e).phase).toBe(2);
    expect(posted).toContain(2);
    s.player.x = 640;
    s.player.y = 820;
    const sv = rtOf(e).survey;
    if (!sv) throw new Error('no survey');
    sv.on = false;
    sv.wait = 0.05;
    step(s, e, 0.2);
    expect(sv.on).toBe(true);
    expect(sv.cx).toBeCloseTo(640, 0);
    expect(sv.cy).toBeCloseTo(820, 0);
    expect(surveyCellAt(sv.cx, sv.cy, 640, 820)).toBe(2);
    expect(SURVEY_EVERY_S2).toBeLessThan(SURVEY_EVERY_S);
  });
});

describe('planet 6: the Spor', () => {
  it('its comments are the planet\'s: the right answers are regulaminowy, then egzystencjalny', () => {
    for (const [phase, right] of [[1, 'regulaminowy'], [2, 'egzystencjalny']] as const) {
      const p = promptFor('ankieta', phase, createRng(3), 5);
      expect(p.commentKey).toBe(`story.p6.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
      expect(storyEntry(5, 'ankieta', phase)?.answer).toBe(right);
      // without the planet the family table points at the same words
      const fam = promptFor('ankieta', phase, createRng(3));
      expect(fam.commentKey).toBe(p.commentKey);
    }
  });
});
