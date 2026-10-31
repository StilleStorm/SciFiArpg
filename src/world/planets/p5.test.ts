import { describe, expect, it } from 'vitest';
import { promptFor } from '../../combat/spor';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import { BOSSES, bossHintKey, bossVariantGrid, bossVariantLine, placeBoss } from '../../enemies/bosses';
import { claimNamedDrop, namedRecord } from '../../enemies/named';
import { rtOf } from '../../enemies/runtime';
import { bindEliteDeaths, spawnEnemy } from '../../enemies/spawn';
import { t } from '../../i18n';
import { awizosOf } from '../../items/delivery';
import { drawingsOf } from '../../render/locations';
import { applyDamage } from '../../systems/combat';
import { reachableCells } from '../base';
import { headlineOf, planetDef, type TicketPlan } from '../campaign';
import { GATE_FIGURE_TAP, bindGates, gateFigureAt, gateHolds, gateLiftKey, stepGate, tapGateFigure } from '../gate';
import { npcAt } from '../npc';
import { generateRunPages, pickLocations } from '../pages';
import { populatePage } from '../pageTurn';
import { completeQuest, newQuests, offersFor, questById, questsOf, takeQuest } from '../quests';
import { createRun, type RunState } from '../run';
import './index';
import { locationSpec, propColliders } from './locations';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'oplata-serwisowa' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 6): RunState => createRun(seed, { plan: plan(4), pageCount });

/** Put the run on the gated page (page index 2) the way the page turn would, without populating it. */
const onGatedPage = (s: RunState): void => {
  s.pageIndex = 2;
  s.page = s.pages[2] ?? s.page;
  s.player.x = s.page.entry.x;
  s.player.y = s.page.entry.y;
};

describe('planet 5: the record and the page split', () => {
  it('is Akt II, headline Oplata serwisowa, hosts Ostatnia mila, locations miasto then centrum with the split at page 3', () => {
    const p = planetDef(4);
    expect(p.act).toBe(2);
    expect(p.pages).toEqual([5, 6]);
    expect(p.hostedSet).toBe('ostatnia-mila');
    expect(p.boss).toBe('weryfikacja');
    expect(p.locations).toEqual(['miasto', 'centrum']);
    expect(p.locationSplit).toBe(3);
    expect(headlineOf(4)).toBe('oplata-serwisowa');
    expect(p.lawPool).toContain('oplata-serwisowa');
  });

  it('pages 1-3 miasto, the rest and the boss page centrum, for five and six pages', () => {
    const p = planetDef(4);
    expect(pickLocations(createRng(9), 5, p.locations, p.locationSplit)).toEqual(['miasto', 'miasto', 'miasto', 'centrum', 'centrum']);
    expect(pickLocations(createRng(9), 6, p.locations, p.locationSplit)).toEqual(['miasto', 'miasto', 'miasto', 'centrum', 'centrum', 'centrum']);
    for (let seed = 1; seed < 12; seed++) expect(run(seed).pages.map((q) => q.location)).toEqual(['miasto', 'miasto', 'miasto', 'centrum', 'centrum', 'centrum']);
  });
});

describe('planet 5: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 5, with every text written', () => {
    const c = npcAt(4);
    expect(c.id).toBe('p5-specjalista');
    expect(c.look).toBe(5);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
  });

  it('three hand-written tickets with the rewards of STORY 8.9, only on the planet 5 board', () => {
    const mine = offersFor(4, newQuests()).filter((o) => o.id.startsWith('h:p5:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p5:a', 'h:p5:b', 'h:p5:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(4);
    }
    expect(mine[0]).toMatchObject({ kind: 'deliver', n: 1, reward: { stars: 40, item: { set: 'ostatnia-mila' } } });
    expect(mine[1]).toMatchObject({ kind: 'kill', n: 16, family: 'powiadomienia', reward: { stars: 40, permission: 'powiadomienia' } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 3, reward: { stars: 30, potwierdzenia: 1 } });
    expect(offersFor(3, newQuests()).some((o) => o.id.startsWith('h:p5:'))).toBe(false);
    // only ticket a pays an item
    expect(mine.filter((q) => q.reward.item !== undefined)).toHaveLength(1);
  });

  it('ticket a pays one piece of Ostatnia mila by awizo, not into the bag; the same seed gets the same piece', () => {
    const piece = (seed: number): string | undefined => {
      const s = createRun(seed, { plan: plan(4), pageCount: 6 });
      const bus = createBus();
      const notes: string[] = [];
      bus.on('footnote', (e) => notes.push(e.text));
      expect(takeQuest(s, bus, 'h:p5:a')).toBe('ok');
      const a = questsOf(s).active.find((x) => x.id === 'h:p5:a');
      if (a) a.progress = 1;
      const bag = s.player.inventory.length;
      expect(completeQuest(s, bus, 'h:p5:a')).toBe(true);
      expect(s.player.inventory).toHaveLength(bag);
      const aw = awizosOf(s.player);
      expect(aw).toHaveLength(1);
      expect(aw[0]?.item.setId).toBe('ostatnia-mila');
      expect(notes.length).toBeGreaterThan(0);
      return aw[0]?.item.baseId;
    };
    expect(piece(21)).toBe(piece(21));
    const pieces = new Set<string | undefined>();
    for (let seed = 1; seed <= 40; seed++) pieces.add(piece(seed));
    expect(pieces.size).toBe(3);
  });

  it('ticket b and c texts take their count in the three Polish forms', () => {
    for (const k of ['b', 'c'] as const) {
      const q = questById(`h:p5:${k}`);
      for (const n of [1, 2, 5]) expect(t(`story.p5.ticket.${k}.text`, { count: n })).not.toContain('{count}');
      expect(q?.n).toBe(k === 'b' ? 16 : 3);
    }
  });
});

describe('planet 5: the boss', () => {
  it('Weryfikacja, wersja sklepowa: the family racja, the variant line, the koszyk grid and the hint override; other planets keep the hydrants', () => {
    const e = placeBoss(run(5), 'powiadomienia', 300, 300);
    expect(e.hpMax).toBe(BOSSES.weryfikacja.hp);
    expect(bossVariantLine(e)).toBe('story.p5.boss.variant');
    expect(bossVariantGrid(e)).toBe('koszyk');
    expect(bossHintKey(e)).toBe('story.p5.boss.hint');
    expect(t('story.p5.boss.hint').replace(/\u00a0/g, ' ')).toBe('Zaznacz wszystkie kratki z koszykami.');
    expect(known('story.p5.boss.variant')).toBe(true);
    const plain = placeBoss(createRun(5, { plan: plan(5), pageCount: 6 }), 'powiadomienia', 300, 300);
    expect(bossVariantGrid(plain)).toBeUndefined();
    expect(bossHintKey(plain)).toBe('enemies.boss.weryfikacja.hint');
    expect(bossVariantLine(plain)).toBeUndefined();
  });

  it('its Spor comments are the planet\'s: the right answers are egzystencjalny, then regulaminowy', () => {
    for (const [phase, right] of [[1, 'egzystencjalny'], [2, 'regulaminowy']] as const) {
      const p = promptFor('weryfikacja', phase, createRng(3), 4);
      expect(p.commentKey).toBe(`story.p5.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
    }
  });
});

describe('planet 5: locations', () => {
  it('centrum has at least nine props, six of them its own drawings; every footprint has a drawing (the conveyor is the magazyn\'s)', () => {
    const spec = locationSpec('centrum');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(9);
    expect(spec?.layout).toBe('rooms');
    const own = drawingsOf('centrum');
    expect(own.length).toBeGreaterThanOrEqual(6);
    expect([...own, 'tasmociag'].sort()).toEqual([...ids].sort());
    expect(drawingsOf('magazyn')).toContain('tasmociag');
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length > 0, p.id).toBe(true);
  });

  it('every centrum prop turns up, queues stand in rows, the exit is reachable, and the hall of the boss page keeps its middle clear', () => {
    const seen = new Set<string>();
    let rows = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const pages = generateRunPages(createRng(seed), 6, ['miasto', 'centrum'], 3);
      for (const page of pages) {
        if (page.location !== 'centrum') continue;
        const ropes = page.obstacles.filter((o) => o.variant === 'sznur');
        if (ropes.some((a) => ropes.some((b) => a !== b && Math.abs(a.y - b.y) < 20 && Math.abs(a.x - b.x) < 170))) rows++;
        for (const o of page.obstacles) {
          if (o.kind === 'prop' && o.variant) seen.add(o.variant);
          if (page.exit === null && o.kind === 'prop') for (const c of o.colliders) if (c.x > 300 && c.x < 900 && c.y > 230 && c.y < 1000) throw new Error(`seed ${seed}: ${o.variant} in the hall at ${c.x | 0},${c.y | 0}`);
        }
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - page.exit!.x, c.y - page.exit!.y) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('centrum')?.props ?? []).map((p) => p.id).sort());
    expect(rows).toBeGreaterThan(30);
  });

  it('the boss page always finds a place for the boss (open hall)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = run(seed);
      s.pageIndex = 5;
      s.page = s.pages[5] ?? s.page;
      s.player.x = s.page.entry.x;
      s.player.y = s.page.entry.y;
      populatePage(s, createBus());
      expect(s.enemies.some((e) => e.boss), `seed ${seed}`).toBe(true);
    }
  });
});

describe('planet 5: the gate on page 3', () => {
  it('is placed on page index 2 only: an elite gate with a wall of parcels and a Dyspozytor', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(seed);
      s.pages.forEach((p, i) => expect(p.gate !== undefined, `seed ${seed} page ${i}`).toBe(i === 2));
      const page = s.pages[2];
      expect(page?.gate).toMatchObject({ kind: 'elite', look: 'parcels', key: 'story.p5.gate.note', liftKey: 'story.p5.gate.lift' });
      expect(page?.gate?.figure).toMatchObject({ look: 52, key: 'story.p5.gate.figure' });
      expect(page?.obstacles.find((o) => o.kind === 'gate')?.variant).toBe('parcels');
      expect(page?.location).toBe('miasto');
    }
    expect(createRun(3, { plan: plan(3), pageCount: 6 }).pages.some((p) => p.gate)).toBe(false);
  });

  it('the page spawns exactly one named elite titled Doreczyciel (the planet\'s key, not planet 3\'s), reachable and clear of the gate corner', () => {
    expect(t('story.p5.gate.elite')).toBe('Doręczyciel');
    for (let seed = 1; seed <= 25; seed++) {
      const s = run(seed);
      onGatedPage(s);
      populatePage(s, createBus());
      const g = s.page.gate;
      const named = s.enemies.filter((e) => rtOf(e).named !== undefined);
      expect(named, `seed ${seed}`).toHaveLength(1);
      const e = named[0];
      if (!e || !g) throw new Error('no elite or gate');
      expect(rtOf(e).named?.name).toBe('Doręczyciel');
      expect(g.eliteId).toBe(e.id);
      expect(namedRecord(s, e.id)?.name).toBe('Doręczyciel');
      const cells = reachableCells(s.page, s.page.entry, 20);
      expect(cells.some((c) => Math.hypot(c.x - e.x, c.y - e.y) < 40), `seed ${seed}`).toBe(true);
      expect(Math.hypot(e.x - (s.page.exit?.x ?? 0), e.y - (s.page.exit?.y ?? 0))).toBeGreaterThan(400);
      for (let i = 0; i < 200; i++) spawnEnemy(s, 0);
      expect(s.enemies.filter((q) => rtOf(q).named !== undefined), `seed ${seed}`).toHaveLength(1);
    }
    // planet 3 keeps its own title
    const s3 = createRun(7, { plan: { kind: 'campaign', planet: 2, priority: 'normalny', lawId: 'grawitacja' }, pageCount: 5 });
    s3.pageIndex = 3;
    s3.page = s3.pages[3] ?? s3.page;
    s3.player.x = s3.page.entry.x;
    s3.player.y = s3.page.entry.y;
    populatePage(s3, createBus());
    expect(s3.enemies.filter((e) => rtOf(e).named !== undefined).map((e) => rtOf(e).named?.name)).toEqual(['Ochrona Obiektu']);
  });

  it('holds until that elite is slain; another kill does not lift it; the drop guarantee is left', () => {
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
    const other = s.enemies.find((e) => e !== elite && !e.boss);
    if (other) {
      other.hp = 1;
      applyDamage(s, bus, other, 9999, false);
    }
    expect(gateHolds(s, g)).toBe(true);
    elite.hp = 1;
    applyDamage(s, bus, elite, 99999, false);
    expect(g.slain).toBe(true);
    expect(gateHolds(s, g)).toBe(false);
    expect(stepGate(s)).toBe('lifted');
    expect(s.page.gate).toBeUndefined();
    expect(s.page.obstacles.some((o) => o.kind === 'gate')).toBe(false);
    expect(gateFigureAt(s.page)).toBeNull();
    expect(claimNamedDrop(s, elite.id)).toEqual({ minTier: 'nietypowy', name: 'Doręczyciel' });
    expect(gateLiftKey(g)).toBe('story.p5.gate.lift');
    for (const k of ['story.p5.gate.note', 'story.p5.gate.lift', 'story.p5.gate.figure', 'story.p5.gate.elite']) expect(known(k), k).toBe(true);
  });
});

describe('planet 5: the Dyspozytor', () => {
  it('a tap on the figure writes its one line; a tap elsewhere does nothing; after the lift no figure stands there', () => {
    const s = run(7);
    onGatedPage(s);
    const notes: string[] = [];
    const bus = createBus();
    bus.on('footnote', (e) => notes.push(e.text));
    const at = gateFigureAt(s.page);
    if (!at) throw new Error('no figure');
    expect(tapGateFigure(s, bus, at.x + 5, at.y - 5)).toBe(true);
    expect(notes).toEqual([t('story.p5.gate.figure')]);
    expect(tapGateFigure(s, bus, at.x + GATE_FIGURE_TAP + 40, at.y)).toBe(false);
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    g.slain = true;
    expect(stepGate(s)).toBe('lifted');
    expect(tapGateFigure(s, bus, at.x, at.y)).toBe(false);
  });
});
