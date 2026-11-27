import { describe, expect, it } from 'vitest';
import { promptFor } from '../../combat/spor';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import { BOSSES, bossHintKey, bossVariantArm, bossVariantLine, placeBoss } from '../../enemies/bosses';
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

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'grawitacja' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 6): RunState => createRun(seed, { plan: plan(7), pageCount });
const LOCS = ['rownina', 'rownina', 'jaskinia', 'jaskinia', 'wyzyna', 'wyzyna'];

/** Put the run on the gated page (page index 3, the last jaskinia page) the way the page turn would, without populating it. */
const onGatedPage = (s: RunState): void => {
  s.pageIndex = 3;
  s.page = s.pages[3] ?? s.page;
  s.player.x = s.page.entry.x;
  s.player.y = s.page.entry.y;
};

describe('planet 8: the record and the page split', () => {
  it('is Akt III, headline Grawitacja, hosts Domniemanie, locations rownina, jaskinia, wyzyna with the cuts at pages 3 and 5', () => {
    const p = planetDef(7);
    expect(p.act).toBe(3);
    expect(p.boss).toBe('hipoteza');
    expect(p.hostedSet).toBe('domniemanie');
    expect(p.locations).toEqual(['rownina', 'jaskinia', 'wyzyna']);
    expect(p.locationSplit).toEqual([2, 4]);
    expect(headlineOf(7)).toBe('grawitacja');
    expect(p.lawPool).toContain('grawitacja');
  });

  it('pages 1-2 rownina, 3-4 jaskinia, the rest and the boss page wyzyna, for five and six pages', () => {
    const p = planetDef(7);
    expect(pickLocations(createRng(9), 5, p.locations, p.locationSplit)).toEqual(LOCS.slice(0, 5));
    expect(pickLocations(createRng(9), 6, p.locations, p.locationSplit)).toEqual(LOCS);
    for (let seed = 1; seed < 12; seed++) expect(run(seed).pages.map((q) => q.location)).toEqual(LOCS);
  });
});

describe('planet 8: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 8, with every text written', () => {
    const c = npcAt(7);
    expect(c.id).toBe('p8-rzeczoznawca');
    expect(c.look).toBe(8);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
  });

  it('three hand-written tickets with the rewards of STORY 8.14, only on the planet 8 board', () => {
    const mine = offersFor(7, newQuests()).filter((o) => o.id.startsWith('h:p8:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p8:a', 'h:p8:b', 'h:p8:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(7);
    }
    expect(mine[0]).toMatchObject({ kind: 'deliver', n: 1, reward: { stars: 45, item: { set: 'domniemanie' } } });
    expect(mine[1]).toMatchObject({ kind: 'kill', n: 16, family: 'wygenerowane', reward: { stars: 45, permission: 'wygenerowane' } });
    expect(mine[2]).toMatchObject({ kind: 'reach', n: 5, reward: { stars: 40, potwierdzenia: 1 } });
    expect(offersFor(6, newQuests()).some((o) => o.id.startsWith('h:p8:'))).toBe(false);
    expect(mine.filter((q) => q.reward.item !== undefined)).toHaveLength(1);
  });

  it('ticket a pays one piece of Domniemanie by awizo, not into the bag; the same seed gets the same piece', () => {
    const piece = (seed: number): string | undefined => {
      const s = createRun(seed, { plan: plan(7), pageCount: 6 });
      const bus = createBus();
      const notes: string[] = [];
      bus.on('footnote', (e) => notes.push(e.text));
      expect(takeQuest(s, bus, 'h:p8:a')).toBe('ok');
      const a = questsOf(s).active.find((x) => x.id === 'h:p8:a');
      if (a) a.progress = 1;
      const bag = s.player.inventory.length;
      expect(completeQuest(s, bus, 'h:p8:a')).toBe(true);
      expect(s.player.inventory).toHaveLength(bag);
      const aw = awizosOf(s.player);
      expect(aw).toHaveLength(1);
      expect(aw[0]?.item.setId).toBe('domniemanie');
      expect(notes.length).toBeGreaterThan(0);
      return aw[0]?.item.baseId;
    };
    expect(piece(21)).toBe(piece(21));
    const pieces = new Set<string | undefined>();
    for (let seed = 1; seed <= 40; seed++) pieces.add(piece(seed));
    expect(pieces.size).toBeGreaterThan(1);
  });

  it('ticket b takes its count in the three Polish forms; ticket c reaches page 5, the first highland page', () => {
    for (const n of [1, 2, 5]) expect(t('story.p8.ticket.b.text', { count: n })).not.toContain('{count}');
    expect(questById('h:p8:b')?.n).toBe(16);
    expect(questById('h:p8:c')?.n).toBe(5);
    expect(run(3).pages[4]?.location).toBe('wyzyna');
  });
});

describe('planet 8: the boss', () => {
  it('Hipoteza, wygenerowana ponownie: the family racja, reach 60 instead of 42, the seven-fingered arm, the variant line, no hint override; other planets keep 42', () => {
    const e = placeBoss(run(5), 'wygenerowane', 300, 300);
    expect(e.hpMax).toBe(BOSSES.hipoteza.hp);
    expect(e.attackRange).toBe(60);
    expect(BOSSES.hipoteza.attackRange).toBe(42);
    expect(bossVariantLine(e)).toBe('story.p8.boss.variant');
    expect(bossVariantArm(e)).toBe('dlon');
    expect(known('story.p8.boss.variant')).toBe(true);
    expect(bossHintKey(e)).toBe('enemies.boss.weryfikacja.hint');
    const plain = placeBoss(createRun(5, { plan: plan(8), pageCount: 6 }), 'wygenerowane', 300, 300);
    expect(plain.attackRange).toBe(42);
    expect(bossVariantArm(plain)).toBeUndefined();
    expect(bossVariantLine(plain)).toBeUndefined();
  });

  it('its Spor comments are the planet\'s: the right answers are regulaminowy, then mechaniczny', () => {
    for (const [phase, right] of [[1, 'regulaminowy'], [2, 'mechaniczny']] as const) {
      const p = promptFor('hipoteza', phase, createRng(3), 7);
      expect(p.commentKey).toBe(`story.p8.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
    }
  });
});

describe('planet 8: wyzyna', () => {
  it('has at least twelve props, an escarpment among them, each with a drawing and a footprint; the flat marks have no body', () => {
    const spec = locationSpec('wyzyna');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(12);
    expect(spec?.layout).toBe('rooms');
    expect(spec?.wall).toBe('skarpa');
    expect(drawingsOf('wyzyna').sort()).toEqual([...ids].sort());
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
  });

  it('every wyzyna prop turns up, the exit is reachable, and the summit of the boss page keeps its middle clear', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const pages = generateRunPages(createRng(seed), 6, ['rownina', 'jaskinia', 'wyzyna'], [2, 4]);
      for (const page of pages) {
        if (page.location !== 'wyzyna') continue;
        for (const o of page.obstacles) {
          if (o.kind === 'prop' && o.variant) seen.add(o.variant);
          if (page.exit === null && o.kind === 'prop') for (const c of o.colliders) if (c.x > 300 && c.x < 900 && c.y > 230 && c.y < 1000) throw new Error(`seed ${seed}: ${o.variant} on the summit at ${c.x | 0},${c.y | 0}`);
        }
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - page.exit!.x, c.y - page.exit!.y) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('wyzyna')?.props ?? []).map((p) => p.id).sort());
  });

  it('the boss page always finds a place for the boss (open summit)', () => {
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

describe('planet 8: the gate on page 4', () => {
  it('is placed on page index 3 only: an elite gate at the default band with a Rachmistrz, on the last jaskinia page', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(seed);
      s.pages.forEach((p, i) => expect(p.gate !== undefined, `seed ${seed} page ${i}`).toBe(i === 3));
      const page = s.pages[3];
      expect(page?.gate).toMatchObject({ kind: 'elite', key: 'story.p8.gate.note', liftKey: 'story.p8.gate.lift' });
      expect(page?.gate?.look).toBeUndefined();
      expect(page?.gate?.figure).toMatchObject({ look: 84, key: 'story.p8.gate.figure' });
      expect(page?.obstacles.find((o) => o.kind === 'gate')?.variant).toBeUndefined();
      expect(page?.location).toBe('jaskinia');
    }
    expect(createRun(3, { plan: plan(8), pageCount: 6 }).pages.some((p) => p.gate)).toBe(false);
  });

  it('the page spawns exactly one named elite titled Użytkownik Potwierdzający, reachable and clear of the gate corner', () => {
    expect(t('story.p8.gate.elite')).toBe('Użytkownik Potwierdzający');
    for (let seed = 1; seed <= 25; seed++) {
      const s = run(seed);
      onGatedPage(s);
      populatePage(s, createBus());
      const g = s.page.gate;
      const named = s.enemies.filter((e) => rtOf(e).named !== undefined);
      expect(named, `seed ${seed}`).toHaveLength(1);
      const e = named[0];
      if (!e || !g) throw new Error('no elite or gate');
      expect(rtOf(e).named?.name).toBe('Użytkownik Potwierdzający');
      expect(g.eliteId).toBe(e.id);
      expect(namedRecord(s, e.id)?.name).toBe('Użytkownik Potwierdzający');
      const cells = reachableCells(s.page, s.page.entry, 20);
      expect(cells.some((c) => Math.hypot(c.x - e.x, c.y - e.y) < 40), `seed ${seed}`).toBe(true);
      expect(Math.hypot(e.x - (s.page.exit?.x ?? 0), e.y - (s.page.exit?.y ?? 0))).toBeGreaterThan(400);
      for (let i = 0; i < 200; i++) spawnEnemy(s, 0);
      expect(s.enemies.filter((q) => rtOf(q).named !== undefined), `seed ${seed}`).toHaveLength(1);
    }
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
    expect(claimNamedDrop(s, elite.id)).toEqual({ minTier: 'nietypowy', name: 'Użytkownik Potwierdzający' });
    expect(gateLiftKey(g)).toBe('story.p8.gate.lift');
    for (const k of ['story.p8.gate.note', 'story.p8.gate.lift', 'story.p8.gate.figure', 'story.p8.gate.elite']) expect(known(k), k).toBe(true);
  });
});

describe('planet 8: the Rachmistrz', () => {
  it('a tap on the figure writes its one line; a tap elsewhere does nothing; after the lift no figure stands there', () => {
    const s = run(7);
    onGatedPage(s);
    const notes: string[] = [];
    const bus = createBus();
    bus.on('footnote', (e) => notes.push(e.text));
    const at = gateFigureAt(s.page);
    if (!at) throw new Error('no figure');
    expect(tapGateFigure(s, bus, at.x + 5, at.y - 5)).toBe(true);
    expect(notes).toEqual([t('story.p8.gate.figure')]);
    expect(tapGateFigure(s, bus, at.x + GATE_FIGURE_TAP + 40, at.y)).toBe(false);
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    g.slain = true;
    expect(stepGate(s)).toBe('lifted');
    expect(tapGateFigure(s, bus, at.x, at.y)).toBe(false);
  });
});
