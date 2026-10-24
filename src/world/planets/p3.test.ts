import { describe, expect, it } from 'vitest';
import { promptFor } from '../../combat/spor';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import { BOSSES, bossVariantArm, bossVariantLine, placeBoss } from '../../enemies/bosses';
import { claimNamedDrop, namedRecord } from '../../enemies/named';
import { rtOf } from '../../enemies/runtime';
import { bindEliteDeaths, spawnEnemy } from '../../enemies/spawn';
import { t } from '../../i18n';
import { drawingsOf } from '../../render/locations';
import { applyDamage } from '../../systems/combat';
import { reachableCells } from '../base';
import { headlineOf, planetDef, type TicketPlan } from '../campaign';
import { GATE_FIGURE_TAP, bindGates, gateFigureAt, gateHolds, gateLiftKey, stepGate, tapGateFigure } from '../gate';
import { npcAt } from '../npc';
import { generateRunPages, pickLocations } from '../pages';
import { populatePage } from '../pageTurn';
import { newQuests, offersFor, questById } from '../quests';
import { createRun, type RunState } from '../run';
import './index';
import { locationSpec, propColliders } from './locations';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'grawitacja' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 5): RunState => createRun(seed, { plan: plan(2), pageCount });

/** Put the run on the gated page (page index 3) the way the page turn would, without populating it. */
const onGatedPage = (s: RunState): void => {
  s.pageIndex = 3;
  s.page = s.pages[3] ?? s.page;
  s.player.x = s.page.entry.x;
  s.player.y = s.page.entry.y;
};

describe('planet 3: the record and the page split', () => {
  it('is Akt I, five pages, headline Parzystosc, locations in the order of the split', () => {
    const p = planetDef(2);
    expect(p.act).toBe(1);
    expect(p.pages).toEqual([5, 5]);
    expect(p.hostedSet).toBe('serwis');
    expect(p.boss).toBe('prototyp');
    expect(p.locations).toEqual(['przedmiescie', 'serwerownia', 'biuro']);
    expect(headlineOf(2)).toBe('parzystosc');
    expect(p.locationSplit).toEqual([2, 3]);
  });

  it('pages 1-2 przedmiescie, page 3 serwerownia, pages 4-5 and the boss page biuro; the one-cut split of planet 2 behaves as before', () => {
    const p = planetDef(2);
    expect(pickLocations(createRng(9), 5, p.locations, p.locationSplit)).toEqual(['przedmiescie', 'przedmiescie', 'serwerownia', 'biuro', 'biuro']);
    expect(pickLocations(createRng(9), 4, p.locations, p.locationSplit)).toEqual(['przedmiescie', 'przedmiescie', 'serwerownia', 'biuro']);
    for (let seed = 1; seed < 15; seed++) expect(run(seed).pages.map((q) => q.location)).toEqual(['przedmiescie', 'przedmiescie', 'serwerownia', 'biuro', 'biuro']);
    const p2 = planetDef(1);
    expect(pickLocations(createRng(9), 4, p2.locations, p2.locationSplit)).toEqual(['magazyn', 'magazyn', 'serwerownia', 'serwerownia']);
  });
});

describe('planet 3: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 3, with every text written', () => {
    const c = npcAt(2);
    expect(c.id).toBe('p3-pelnomocnik');
    expect(c.look).toBe(3);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
  });

  it('three hand-written tickets with the rewards of STORY 8.3, only on the planet 3 board', () => {
    const mine = offersFor(2, newQuests()).filter((o) => o.id.startsWith('h:p3:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p3:a', 'h:p3:b', 'h:p3:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(2);
    }
    expect(mine[0]).toMatchObject({ kind: 'kill', n: 10, family: 'urzadzenia', reward: { stars: 35, permission: 'urzadzenia' } });
    expect(mine[1]).toMatchObject({ kind: 'reach', n: 4, reward: { stars: 30, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 2, reward: { stars: 25 } });
    expect(offersFor(1, newQuests()).some((o) => o.id.startsWith('h:p3:'))).toBe(false);
  });

  it('ticket c stays at n = 2: its title is "Dwa egzemplarze" and its text says the report is filed in {count} copies, the second a variant', () => {
    const c = questById('h:p3:c');
    expect(c?.n).toBe(2);
    expect(t('story.p3.ticket.c.title')).toBe('Dwa egzemplarze');
    expect(t('story.p3.ticket.c.text', { count: 2 }).replace(/\u00a0/g, ' ')).toContain('w 2 egzemplarzach');
  });
});

describe('planet 3: the boss', () => {
  it('Prototyp, seria 3: the family racja, attackRange 60 instead of 44, the variant line and the stapler arm; other planets keep 44', () => {
    const e = placeBoss(run(5), 'urzadzenia', 300, 300);
    expect(e.attackRange).toBe(60);
    expect(BOSSES.prototyp.attackRange).toBe(44);
    expect(e.hpMax).toBe(BOSSES.prototyp.hp);
    expect(bossVariantLine(e)).toBe('story.p3.boss.variant');
    expect(bossVariantArm(e)).toBe('stapler');
    expect(known('story.p3.boss.variant')).toBe(true);
    const plain = placeBoss(createRun(5, { plan: plan(3) }), 'urzadzenia', 300, 300);
    expect(plain.attackRange).toBe(44);
    expect(bossVariantArm(plain)).toBeUndefined();
    expect(placeBoss(createRun(5, { plan: plan(1) }), 'urzadzenia', 300, 300).attackRange).toBe(44);
  });

  it('its Spor comments are the planet\'s: the right answers are mechaniczny, then egzystencjalny', () => {
    for (const [phase, right] of [[1, 'mechaniczny'], [2, 'egzystencjalny']] as const) {
      const p = promptFor('prototyp', phase, createRng(3), 2);
      expect(p.commentKey).toBe(`story.p3.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
    }
  });
});

describe('planet 3: locations', () => {
  it('biuro has at least eight drawn props and przedmiescie the three new ones; every footprint matches its drawing', () => {
    const spec = locationSpec('biuro');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(drawingsOf('biuro').sort()).toEqual([...ids].sort());
    expect(spec?.layout).toBe('rooms');
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
    const prz = (locationSpec('przedmiescie')?.props ?? []).map((p) => p.id);
    for (const id of ['lodowka', 'drzwi', 'linijka']) expect(prz).toContain(id);
    expect(drawingsOf('przedmiescie').sort()).toEqual([...prz].sort());
  });

  it('every biuro prop turns up, desks stand in rows, the exit is reachable, and the hall of the boss page keeps its middle clear', () => {
    const seen = new Set<string>();
    let rows = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const pages = generateRunPages(createRng(seed), 5, ['biuro']);
      for (const page of pages) {
        const desks = page.obstacles.filter((o) => o.variant === 'biurko');
        if (desks.some((a) => desks.some((b) => a !== b && Math.abs(a.y - b.y) < 20 && Math.abs(a.x - b.x) < 170))) rows++;
        for (const o of page.obstacles) {
          if (o.kind === 'prop' && o.variant) seen.add(o.variant);
          // the open-plan hall: nothing between the side bands and above the partition (boss spawns x 260..940, y 260..960)
          if (page.exit === null && o.kind === 'prop') for (const c of o.colliders) if (c.x > 300 && c.x < 900 && c.y > 230 && c.y < 1000) throw new Error(`seed ${seed}: ${o.variant} in the hall at ${c.x | 0},${c.y | 0}`);
        }
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - page.exit!.x, c.y - page.exit!.y) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('biuro')?.props ?? []).map((p) => p.id).sort());
    expect(rows).toBeGreaterThan(40);
  });

  it('the boss page always finds a place for the boss (open-plan hall)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = run(seed);
      s.pageIndex = 4;
      s.page = s.pages[4] ?? s.page;
      s.player.x = s.page.entry.x;
      s.player.y = s.page.entry.y;
      populatePage(s, createBus());
      expect(s.enemies.some((e) => e.boss), `seed ${seed}`).toBe(true);
    }
  });
});

describe('planet 3: the gate on page 4', () => {
  it('is placed on page index 3 only: an elite gate with a turnstile and a figure', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(seed);
      s.pages.forEach((p, i) => expect(p.gate !== undefined, `seed ${seed} page ${i}`).toBe(i === 3));
      const page = s.pages[3];
      expect(page?.gate).toMatchObject({ kind: 'elite', look: 'turnstile', key: 'story.p3.gate.note', liftKey: 'story.p3.gate.lift' });
      expect(page?.gate?.figure?.key).toBe('story.p3.gate.figure');
      expect(page?.obstacles.find((o) => o.kind === 'gate')?.variant).toBe('turnstile');
      expect(page?.location).toBe('biuro');
    }
    expect(createRun(3, { plan: plan(1), pageCount: 4 }).pages.filter((p) => p.gate)).toHaveLength(1);
    expect(createRun(3, { plan: plan(3), pageCount: 5 }).pages.some((p) => p.gate)).toBe(false);
  });

  it('the page spawns exactly one named elite with the fixed name, reachable and clear of the gate corner; no other named elite is rolled', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = run(seed);
      onGatedPage(s);
      const bus = createBus();
      populatePage(s, bus);
      const g = s.page.gate;
      const named = s.enemies.filter((e) => rtOf(e).named !== undefined);
      expect(named, `seed ${seed}`).toHaveLength(1);
      const e = named[0];
      if (!e || !g) throw new Error('no elite or gate');
      expect(rtOf(e).named?.name).toBe(t('story.p3.gate.elite'));
      expect(t('story.p3.gate.elite')).toBe('Ochrona Obiektu');
      expect(g.eliteId).toBe(e.id);
      expect(namedRecord(s, e.id)?.name).toBe('Ochrona Obiektu');
      expect((namedRecord(s, e.id)?.affixes.length ?? 0)).toBeGreaterThanOrEqual(2);
      // reachable from the entry, far from the exit corner
      const cells = reachableCells(s.page, s.page.entry, 20);
      expect(cells.some((c) => Math.hypot(c.x - e.x, c.y - e.y) < 40), `seed ${seed}`).toBe(true);
      expect(Math.hypot(e.x - (s.page.exit?.x ?? 0), e.y - (s.page.exit?.y ?? 0))).toBeGreaterThan(400);
      // more spawning does not roll another named elite on this page
      for (let i = 0; i < 200; i++) spawnEnemy(s, 0);
      expect(s.enemies.filter((q) => rtOf(q).named !== undefined), `seed ${seed}`).toHaveLength(1);
    }
  });

  it('holds until that elite is slain; another named elite or any other kill does not lift it; the drop guarantee is left', () => {
    const s = run(7);
    onGatedPage(s);
    const bus = createBus();
    bindEliteDeaths(s, bus);
    bindGates(bus, () => s);
    populatePage(s, bus);
    const g = s.page.gate;
    const elite = s.enemies.find((e) => rtOf(e).named !== undefined);
    if (!g || !elite) throw new Error('no gate or elite');
    expect(gateHolds(s, g)).toBe(true);
    expect(stepGate(s)).not.toBe('lifted');
    // a plain kill: nothing
    const other = s.enemies.find((e) => e !== elite && !e.boss);
    if (other) {
      other.hp = 1;
      applyDamage(s, bus, other, 9999, false);
    }
    expect(gateHolds(s, g)).toBe(true);
    expect(s.page.gate).toBeDefined();
    // the elite
    elite.hp = 1;
    applyDamage(s, bus, elite, 99999, false);
    expect(g.slain).toBe(true);
    expect(gateHolds(s, g)).toBe(false);
    expect(stepGate(s)).toBe('lifted');
    expect(s.page.gate).toBeUndefined();
    expect(s.page.obstacles.some((o) => o.kind === 'gate')).toBe(false);
    expect(gateFigureAt(s.page)).toBeNull();
    expect(claimNamedDrop(s, elite.id)).toEqual({ minTier: 'nietypowy', name: 'Ochrona Obiektu' });
    expect(gateLiftKey(g)).toBe('story.p3.gate.lift');
    for (const k of ['story.p3.gate.note', 'story.p3.gate.lift', 'story.p3.gate.figure', 'story.p3.gate.elite']) expect(known(k), k).toBe(true);
  });
});

describe('planet 3: the Portier', () => {
  it('a tap on the figure writes its one line; a tap elsewhere does nothing; after the lift no figure stands there', () => {
    const s = run(7);
    onGatedPage(s);
    const notes: string[] = [];
    const bus = createBus();
    bus.on('footnote', (e) => notes.push(e.text));
    const at = gateFigureAt(s.page);
    if (!at) throw new Error('no figure');
    expect(tapGateFigure(s, bus, at.x + 5, at.y - 5)).toBe(true);
    expect(notes).toEqual([t('story.p3.gate.figure')]);
    expect(tapGateFigure(s, bus, at.x + GATE_FIGURE_TAP + 40, at.y)).toBe(false);
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    g.slain = true;
    expect(stepGate(s)).toBe('lifted');
    expect(tapGateFigure(s, bus, at.x, at.y)).toBe(false);
  });
});
