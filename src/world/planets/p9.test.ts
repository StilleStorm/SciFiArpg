import { describe, expect, it } from 'vitest';
import { promptFor, storyEntry } from '../../combat/spor';
import { hasStatus } from '../../combat/status';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import {
  BOSSES,
  BOSS_WIZUALIZACJA_E,
  POST_EVERY_S,
  POST_EVERY_S2,
  POST_FIRST_S,
  POST_R,
  POST_REACH,
  POST_REMIND_S,
  POST_SEEN_S,
  bossIdOf,
  bossVariantLine,
  placeBoss,
  postAt,
  tickBoss,
} from '../../enemies/bosses';
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

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'czas-wsteczny' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 6): RunState => createRun(seed, { plan: plan(8), pageCount });
const LOCS = ['archiwum', 'archiwum', 'archiwum', 'biuro', 'biuro', 'biuro'];

const onPage = (s: RunState, i: number): void => {
  s.pageIndex = i;
  s.page = s.pages[i] ?? s.page;
  s.player.x = s.page.entry.x;
  s.player.y = s.page.entry.y;
};

describe('planet 9: the record and the page split', () => {
  it('is Akt III, headline Czas wsteczny, hosts Awaria, boss Wizualizacja, locations archiwum and biuro with the cut at page 3', () => {
    const p = planetDef(8);
    expect(p.act).toBe(3);
    expect(p.pages).toEqual([6, 6]);
    expect(p.hostedSet).toBe('awaria');
    expect(p.boss).toBe('wizualizacja');
    expect(p.locations).toEqual(['archiwum', 'biuro']);
    expect(p.locationSplit).toBe(3);
    expect(headlineOf(8)).toBe('czas-wsteczny');
    expect(planetDef(7).boss).toBe('hipoteza');
  });

  it('pages 1-3 archiwum, 4-6 and the boss page biuro', () => {
    const p = planetDef(8);
    expect(pickLocations(createRng(9), 6, p.locations, p.locationSplit)).toEqual(LOCS);
    for (let seed = 1; seed < 12; seed++) expect(run(seed).pages.map((q) => q.location)).toEqual(LOCS);
  });
});

describe('planet 9: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 9, with every text written', () => {
    const c = npcAt(8);
    expect(c.id).toBe('p9-koordynator');
    expect(c.look).toBe(9);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
  });

  it('three hand-written tickets with the rewards of STORY 8.15, no item ticket, only on the planet 9 board', () => {
    const mine = offersFor(8, newQuests()).filter((o) => o.id.startsWith('h:p9:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p9:a', 'h:p9:b', 'h:p9:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      for (const n of [1, 2, 5]) expect(t(q.textKey, { count: n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(8);
      expect(q.reward.item).toBeUndefined();
    }
    expect(mine[0]).toMatchObject({ kind: 'kill', n: 18, family: 'wygenerowane', reward: { stars: 50, permission: 'wygenerowane' } });
    expect(mine[1]).toMatchObject({ kind: 'reach', n: 4, reward: { stars: 40, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 6, reward: { stars: 40 } });
    expect(offersFor(7, newQuests()).some((o) => o.id.startsWith('h:p9:'))).toBe(false);
  });
});

describe('planet 9: locations', () => {
  it('archiwum and biuro each have their observatory props with a drawing and a footprint; the ladder arc is a flat mark', () => {
    const arch = locationSpec('archiwum');
    const bur = locationSpec('biuro');
    const archIds = (arch?.props ?? []).map((p) => p.id);
    const burIds = (bur?.props ?? []).map((p) => p.id);
    for (const id of ['plyty-szklane', 'tuby-map', 'stol-swietlny', 'dziennik-obserwacji', 'skrzynia-soczewek', 'przyrzad-pod-plachta']) expect(archIds, id).toContain(id);
    for (const id of ['teleskop', 'zegar-bez-cyfr', 'tablica-rysunkowa', 'drabina-do-kopuly', 'rama-pusta']) expect(burIds, id).toContain(id);
    expect([...drawingsOf('archiwum'), 'cisza'].sort()).toEqual([...archIds].sort());
    expect(drawingsOf('biuro').sort()).toEqual([...burIds].sort());
    expect(bur?.flat).toContain('drabina-do-kopuly');
    for (const p of bur?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(bur?.flat.includes(p.id) === true);
  });

  it('the observatory props turn up on planet 9 pages, each page reaches its exit, and the boss hall keeps its middle clear', () => {
    const seenA = new Set<string>();
    const seenB = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const pages = generateRunPages(createRng(seed), 6, planetDef(8).locations, planetDef(8).locationSplit);
      for (const page of pages) {
        for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) (page.location === 'archiwum' ? seenA : seenB).add(o.variant);
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - (page.exit?.x ?? 0), c.y - (page.exit?.y ?? 0)) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    for (const id of ['plyty-szklane', 'tuby-map', 'stol-swietlny', 'dziennik-obserwacji', 'skrzynia-soczewek', 'przyrzad-pod-plachta']) expect(seenA.has(id), id).toBe(true);
    for (const id of ['teleskop', 'zegar-bez-cyfr', 'tablica-rysunkowa', 'drabina-do-kopuly', 'rama-pusta']) expect(seenB.has(id), id).toBe(true);
  });
});

describe('planet 9: the gate on page 3', () => {
  it('is placed on page index 2 only: a teczka gate keyed to the forced folder, the default band and a Dyżurny', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(seed);
      s.pages.forEach((p, i) => expect(p.gate !== undefined, `seed ${seed} page ${i}`).toBe(i === 2));
      const page = s.pages[2];
      expect(page?.gate).toMatchObject({ kind: 'teczka', keyTeczka: true, key: 'story.p9.gate.note', liftKey: 'story.p9.gate.lift' });
      expect(page?.gate?.look).toBeUndefined();
      expect(page?.gate?.figure).toMatchObject({ look: 93, key: 'story.p9.gate.figure' });
      expect(page?.location).toBe('archiwum');
      const keys = (page?.content ?? []).filter((c) => c.kind === 'teczka' && c.key);
      expect(keys, `seed ${seed}`).toHaveLength(1);
      const cells = page ? reachableCells(page, page.entry, 20) : [];
      expect(cells.some((c) => Math.hypot(c.x - (keys[0]?.x ?? -999), c.y - (keys[0]?.y ?? -999)) < 40), `seed ${seed}`).toBe(true);
    }
    expect(createRun(3, { plan: plan(7), pageCount: 6 }).pages.some((p) => p.gate?.key === 'story.p9.gate.note')).toBe(false);
  });

  it('lifts only when the key folder is opened; the Dyżurny answers a tap and walks off at the lift', () => {
    const s = run(7);
    onPage(s, 2);
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    const at = gateFigureAt(s.page);
    if (!at) throw new Error('no figure');
    expect(tapGateFigure(s, bus, at.x + 5, at.y - 5)).toBe(true);
    expect(notes).toEqual([t('story.p9.gate.figure')]);
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
    expect(gateLiftKey(g)).toBe('story.p9.gate.lift');
    for (const k of ['story.p9.gate.note', 'story.p9.gate.lift', 'story.p9.gate.figure']) expect(known(k), k).toBe(true);
  });
});

describe('planet 9: the Wizualizacja', () => {
  const boss = (seed = 5): { s: RunState; e: ReturnType<typeof placeBoss> } => {
    const s = run(seed);
    onPage(s, 5);
    s.player.x = 700;
    s.player.y = 700;
    return { s, e: placeBoss(s, 'wygenerowane', 300, 300) };
  };
  const bus = createBus();
  const step = (s: RunState, e: ReturnType<typeof placeBoss>, secs: number): void => {
    for (let i = 0; i < Math.round(secs / 0.05); i++) tickBoss(s, e, bus, 0.05);
  };
  const waitPost = (s: RunState, e: ReturnType<typeof placeBoss>): void => {
    if (rtOf(e).obs?.posts.length) return;
    step(s, e, POST_FIRST_S + 0.2);
    if (!rtOf(e).obs?.posts.length) throw new Error('no post');
  };
  const standIn = (s: RunState, e: ReturnType<typeof placeBoss>, i: number): void => {
    waitPost(s, e);
    const q = rtOf(e).obs?.posts[i];
    if (!q) throw new Error('no post ' + i);
    s.player.x = q.x;
    s.player.y = q.y;
  };

  it('is the planet\'s body: Wygenerowane, racja 320, claim mechaniczny, existence 0.4, no variant line; other planets keep Hipoteza', () => {
    const { e } = boss();
    expect(bossIdOf(e)).toBe('wizualizacja');
    expect(e.hpMax).toBe(BOSSES.wizualizacja.hp);
    expect(BOSSES.wizualizacja).toMatchObject({ hp: 320, speed: 34, dmgMin: 6, dmgMax: 9, attackRange: 44 });
    expect(e.family).toBe('wygenerowane');
    expect(e.claim?.type).toBe('mechaniczny');
    expect(e.claim?.textKey).toBe('enemies.claim.boss.wizualizacja');
    expect(known('enemies.claim.boss.wizualizacja')).toBe(true);
    expect(e.existence).toBe(BOSS_WIZUALIZACJA_E);
    expect(bossVariantLine(e)).toBeUndefined();
    const a = assembleBoss('wizualizacja', 3);
    expect(a.body).toBe('wizualizacja');
    expect(a.legs).toBe('stilts');
    const other = placeBoss(createRun(5, { plan: plan(7), pageCount: 6 }), 'wygenerowane', 300, 300);
    expect(bossIdOf(other)).toBe('hipoteza');
    expect(rtOf(other).obs).toBeUndefined();
    expect(bossIdOf(placeBoss(run(5), 'urzadzenia', 300, 300))).toBe('prototyp');
  });

  it('every footnote and the boss name are written; the page always finds a place for it', () => {
    for (const k of ['name', 'meet', 'hint', 'observed', 'details', 'half', 'false']) expect(known(`enemies.boss.wizualizacja.${k}`), k).toBe(true);
    for (let seed = 1; seed <= 120; seed++) {
      const s = run(seed);
      for (let k = 0; k < seed % 7; k++) s.rngs.spawn.int(1, 100);
      onPage(s, 5);
      populatePage(s, createBus());
      const e = s.enemies.find((q) => q.boss);
      expect(e, `seed ${seed}`).toBeDefined();
      if (e) expect(bossIdOf(e)).toBe('wizualizacja');
    }
  });

  it('marks the first post after 4 s toward the player, within sight of a phone held upright, and says what it is once', () => {
    const { s, e } = boss();
    const notes: string[] = [];
    bus.on('footnote', (ev) => notes.push(ev.text));
    step(s, e, POST_FIRST_S - 0.5);
    expect(rtOf(e).obs?.posts).toHaveLength(0);
    step(s, e, 0.8);
    const q = rtOf(e).obs?.posts[0];
    expect(rtOf(e).obs?.posts).toHaveLength(1);
    expect(q?.generated).toBe(false);
    if (!q) return;
    expect(Math.abs(q.x - s.player.x)).toBeLessThanOrEqual(POST_REACH + 0.5);
    expect(Math.hypot(q.x - 300, q.y - 300)).toBeGreaterThan(100);
    expect(notes.filter((n) => n === t('enemies.boss.wizualizacja.hint'))).toHaveLength(1);
    expect(postAt([q], q.x + POST_R - 1, q.y)).toBe(0);
    expect(postAt([q], q.x + POST_R + 1, q.y)).toBe(-1);
  });

  it('2 s in the post is an observation: exists at 1 for 6 s, zablokowany for the first 3, the post goes, the next after 8 s', () => {
    const { s, e } = boss();
    standIn(s, e, 0);
    step(s, e, 1.7);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    expect(e.existence).toBe(BOSS_WIZUALIZACJA_E);
    step(s, e, 0.5);
    expect(hasStatus(e, 'zablokowany')).toBe(true);
    expect(rtOf(e).obs?.posts).toHaveLength(0);
    expect(e.existence).toBe(1);
    expect(rtOf(e).obs?.wait).toBeCloseTo(POST_EVERY_S, 0);
    // statuses are ticked by the combat system, not by the boss: only the 6 s of the observed state are the boss's own
    step(s, e, 3.2);
    expect(e.existence).toBe(1);
    step(s, e, POST_SEEN_S - 3.2 + 0.2);
    expect(e.existence).toBe(BOSS_WIZUALIZACJA_E);
  });

  it('a post left 6 s is filled in: two Wygenerowane of tier 1 (cap 6), a new post, no block', () => {
    const { s, e } = boss();
    waitPost(s, e);
    const before = s.enemies.filter((q) => q.family === 'wygenerowane' && !q.boss).length;
    const age = rtOf(e).obs?.age ?? 0;
    step(s, e, POST_REMIND_S - age - 0.3);
    expect(s.enemies.filter((q) => q.family === 'wygenerowane' && !q.boss).length).toBe(before);
    step(s, e, 0.6);
    const after = s.enemies.filter((q) => q.family === 'wygenerowane' && !q.boss);
    expect(after.length).toBe(before + 2);
    expect(after.slice(-2).every((q) => q.tier === 1)).toBe(true);
    expect(rtOf(e).obs?.posts).toHaveLength(1);
    expect(rtOf(e).obs?.age ?? 99).toBeLessThan(1);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    for (let i = 0; i < 6; i++) {
      rtOf(e).obs!.age = POST_REMIND_S;
      step(s, e, 0.1);
    }
    expect(s.enemies.filter((q) => q.family === 'wygenerowane' && !q.boss).length).toBeLessThanOrEqual(6);
  });

  it('at half racja: phase 2, the second comment is posted, two posts round the player every 6 s, one solid and one dotted', () => {
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
    step(s, e, 4.5);
    const posts = rtOf(e).obs?.posts ?? [];
    expect(posts).toHaveLength(2);
    expect(posts.filter((q) => q.generated)).toHaveLength(1);
    expect(postAt(posts, 640, 820)).toBe(-1);
    expect(Math.hypot((posts[0]?.x ?? 0) - (posts[1]?.x ?? 0), (posts[0]?.y ?? 0) - (posts[1]?.y ?? 0))).toBeGreaterThan(2 * POST_R);
    expect(POST_EVERY_S2).toBeLessThan(POST_EVERY_S);
  });

  it('phase 2: 2 s in the dotted post heals 10% and clears both; 2 s in the true one observes as before', () => {
    const { s, e } = boss();
    e.hp = e.hpMax / 2 - 1;
    step(s, e, 0.1);
    s.player.x = 640;
    s.player.y = 820;
    step(s, e, 4.5);
    const posts = rtOf(e).obs?.posts ?? [];
    const dotted = posts.findIndex((q) => q.generated);
    const q = posts[dotted];
    if (!q) throw new Error('no dotted post');
    s.player.x = q.x;
    s.player.y = q.y;
    const hp = e.hp;
    step(s, e, 2.2);
    expect(e.hp).toBeCloseTo(hp + e.hpMax * 0.1, 5);
    expect(rtOf(e).obs?.posts).toHaveLength(0);
    expect(hasStatus(e, 'zablokowany')).toBe(false);
    expect(e.existence).toBe(BOSS_WIZUALIZACJA_E);
    rtOf(e).obs!.wait = 0.05;
    s.player.x = 640;
    s.player.y = 820;
    step(s, e, 0.3);
    const again = rtOf(e).obs?.posts ?? [];
    const solid = again.find((p) => !p.generated);
    if (!solid) throw new Error('no solid post');
    s.player.x = solid.x;
    s.player.y = solid.y;
    step(s, e, 2.2);
    expect(hasStatus(e, 'zablokowany')).toBe(true);
    expect(e.existence).toBe(1);
    expect(rtOf(e).obs?.posts).toHaveLength(0);
  });
});

describe('planet 9: the Spor', () => {
  it('its comments are the planet\'s: the right answers are egzystencjalny, then regulaminowy', () => {
    for (const [phase, right] of [[1, 'egzystencjalny'], [2, 'regulaminowy']] as const) {
      const p = promptFor('wizualizacja', phase, createRng(3), 8);
      expect(p.commentKey).toBe(`story.p9.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
      expect(storyEntry(8, 'wizualizacja', phase)?.answer).toBe(right);
      expect(promptFor('wizualizacja', phase, createRng(3)).commentKey).toBe(p.commentKey);
    }
  });
});
