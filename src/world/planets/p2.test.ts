import { describe, expect, it } from 'vitest';
import { promptFor } from '../../combat/spor';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import { bossVariantLine, placeBoss } from '../../enemies/bosses';
import { t } from '../../i18n';
import { drawingsOf } from '../../render/locations';
import { reachableCells } from '../base';
import { headlineOf, lawForPlanet, nextCampaignPlan, newCampaign, planetDef, type TicketPlan } from '../campaign';
import { openTeczka } from '../content';
import { GATE_FIGURE_TAP, gateFigureAt, gateHolds, gateLiftKey, stepGate, tapGateFigure } from '../gate';
import { npcAt } from '../npc';
import { generateRunPages, pickLocations } from '../pages';
import { newQuests, offersFor, questById } from '../quests';
import { createRun, type RunState } from '../run';
import './index';
import { locationSpec, propColliders } from './locations';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'ciasteczka' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 4): RunState => createRun(seed, { plan: plan(1), pageCount });

/** Put the run on the gated page (page index 1) the way the page turn would. */
const onGatedPage = (s: RunState): void => {
  s.pageIndex = 1;
  s.page = s.pages[1] ?? s.page;
  s.player.x = s.page.entry.x;
  s.player.y = s.page.entry.y;
};

describe('planet 2: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 2, with every text written', () => {
    const c = npcAt(1);
    expect(c.id).toBe('p2-referent');
    expect(c.look).toBe(2);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
  });

  it('three hand-written tickets with the rewards of STORY 8.2, only on the planet 2 board', () => {
    const mine = offersFor(1, newQuests()).filter((o) => o.id.startsWith('h:p2:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p2:a', 'h:p2:b', 'h:p2:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(1);
    }
    expect(mine[0]).toMatchObject({ kind: 'deliver', n: 1, reward: { stars: 35, permission: 'urzadzenia' } });
    expect(mine[1]).toMatchObject({ kind: 'kill', n: 8, family: 'powiadomienia', reward: { stars: 25, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 4, reward: { stars: 25 } });
    expect(offersFor(0, newQuests()).some((o) => o.id.startsWith('h:p2:'))).toBe(false);
  });
});

describe('planet 2: the boss', () => {
  it('Prototyp, seria 2: 360 racja and the variant line; planet 1 keeps 260', () => {
    const e = placeBoss(run(5), 'urzadzenia', 300, 300);
    expect(e.hpMax).toBe(360);
    expect(e.hp).toBe(360);
    expect(bossVariantLine(e)).toBe('story.p2.boss.variant');
    expect(known('story.p2.boss.variant')).toBe(true);
    expect(placeBoss(createRun(5, { plan: plan(0) }), 'urzadzenia', 300, 300).hpMax).toBe(260);
  });

  it('its Spor comments are the planet\'s: the right answers are egzystencjalny, then regulaminowy', () => {
    for (const [phase, right] of [[1, 'egzystencjalny'], [2, 'regulaminowy']] as const) {
      const p = promptFor('prototyp', phase, createRng(3), 1);
      expect(p.commentKey).toBe(`story.p2.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
    }
  });
});

describe('planet 2: locations', () => {
  it('serwerownia has at least eight drawn props, each with a footprint and a drawing; magazyn has the three new ones', () => {
    const spec = locationSpec('serwerownia');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(drawingsOf('serwerownia').sort()).toEqual([...ids].sort());
    expect(spec?.layout).toBe('corridors');
    expect(spec?.wall).toBe('rack');
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
    const mag = (locationSpec('magazyn')?.props ?? []).map((p) => p.id);
    for (const id of ['stos', 'awizo', 'kolejka']) expect(mag).toContain(id);
    expect(drawingsOf('magazyn').sort()).toEqual([...mag].sort());
  });

  it('the pages are placed by the record: pages 1-2 magazyn, page 3+ and the boss page serwerownia; other planets keep the seeded pick', () => {
    const p = planetDef(1);
    expect(p.locationSplit).toBe(2);
    for (const count of [4, 5]) {
      const where = pickLocations(createRng(9), count, p.locations, p.locationSplit);
      expect(where).toEqual(count === 4 ? ['magazyn', 'magazyn', 'serwerownia', 'serwerownia'] : ['magazyn', 'magazyn', 'serwerownia', 'serwerownia', 'serwerownia']);
    }
    for (let seed = 1; seed < 20; seed++) {
      const s = createRun(seed, { plan: plan(1) });
      expect(s.pages.map((q) => q.location).slice(0, 2)).toEqual(['magazyn', 'magazyn']);
      expect(s.pages[s.pages.length - 1]?.location).toBe('serwerownia');
    }
    expect(planetDef(0).locationSplit).toBeUndefined();
  });

  it('every serwerownia prop turns up, the corridors stay open, the middle one is clear, and the exit is reachable', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const pages = generateRunPages(createRng(seed), 5, ['serwerownia']);
      for (const page of pages) {
        for (const o of page.obstacles) {
          if (o.kind === 'prop' && o.variant) seen.add(o.variant);
          // nothing but the clear middle corridor between x 520 and 680 (racks stand at 450 and 750)
          if (o.kind === 'prop' && o.variant !== 'siatka' && o.variant !== 'koryto' && o.variant !== 'kurtyna') for (const c of o.colliders) expect(Math.abs(c.x - 600) - c.r, `seed ${seed}`).toBeGreaterThan(80);
        }
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - page.exit!.x, c.y - page.exit!.y) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('serwerownia')?.props ?? []).map((p) => p.id).sort());
  });
});

describe('planet 2: the gate on page 2', () => {
  it('is placed on page index 1 only, as a teczka gate keyed to the forced folder, parcel wall and a figure', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(seed);
      s.pages.forEach((p, i) => expect(p.gate !== undefined, `seed ${seed} page ${i}`).toBe(i === 1));
      const page = s.pages[1];
      expect(page?.gate).toMatchObject({ kind: 'teczka', keyTeczka: true, look: 'parcels', key: 'story.p2.gate.note', liftKey: 'story.p2.gate.lift' });
      expect(page?.gate?.figure?.key).toBe('story.p2.gate.figure');
      expect(page?.obstacles.find((o) => o.kind === 'gate')?.variant).toBe('parcels');
      const keys = (page?.content ?? []).filter((c) => c.kind === 'teczka' && c.key);
      expect(keys, `seed ${seed}`).toHaveLength(1);
      // the folder is reachable from the entry, outside the walled corner
      const key = keys[0];
      const cells = page ? reachableCells(page, page.entry, 20) : [];
      expect(cells.some((c) => Math.hypot(c.x - (key?.x ?? -999), c.y - (key?.y ?? -999)) < 40)).toBe(true);
    }
    // planet 1 and the planet without a gate carry none
    expect(createRun(3, { plan: plan(0), pageCount: 4 }).pages.some((p) => p.gate)).toBe(false);
    expect(createRun(3, { plan: plan(3), pageCount: 4 }).pages.some((p) => p.gate)).toBe(false);
  });

  it('lifts only when that teczka is opened, not another one; the lift has its own footnote', () => {
    const s = run(7);
    onGatedPage(s);
    const bus = createBus();
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    const list = (s.page.content ??= []);
    const other = { kind: 'teczka' as const, id: 777, x: 400, y: 400, seed: 5, opened: false };
    list.push(other);
    expect(gateHolds(s, g)).toBe(true);
    expect(stepGate(s)).not.toBe('lifted');
    // any other folder, opened, does nothing
    openTeczka(s, bus, other);
    expect(other.opened).toBe(true);
    expect(gateHolds(s, g)).toBe(true);
    expect(stepGate(s)).not.toBe('lifted');
    expect(s.page.gate).toBeDefined();
    const key = list.find((c) => c.kind === 'teczka' && c.key);
    if (!key || key.kind !== 'teczka') throw new Error('no key');
    expect(key.opened).toBe(false);
    openTeczka(s, bus, key);
    expect(gateHolds(s, g)).toBe(false);
    expect(stepGate(s)).toBe('lifted');
    expect(s.page.gate).toBeUndefined();
    expect(s.page.obstacles.some((o) => o.kind === 'gate')).toBe(false);
    expect(gateLiftKey(g)).toBe('story.p2.gate.lift');
    for (const k of ['story.p2.gate.note', 'story.p2.gate.lift', 'story.p2.gate.figure']) expect(known(k), k).toBe(true);
  });

  it('a tap on the figure at the gap writes its one line; a tap elsewhere does nothing; after the lift no figure is there', () => {
    const s = run(7);
    onGatedPage(s);
    const notes: string[] = [];
    const bus = createBus();
    bus.on('footnote', (e) => notes.push(e.text));
    const at = gateFigureAt(s.page);
    if (!at) throw new Error('no figure');
    expect(tapGateFigure(s, bus, at.x + 5, at.y - 5)).toBe(true);
    expect(notes).toEqual([t('story.p2.gate.figure')]);
    expect(tapGateFigure(s, bus, at.x + GATE_FIGURE_TAP + 40, at.y)).toBe(false);
    expect(notes).toHaveLength(1);
    const key = (s.page.content ?? []).find((c) => c.kind === 'teczka' && c.key);
    if (key?.kind === 'teczka') openTeczka(s, bus, key);
    expect(stepGate(s)).toBe('lifted');
    expect(gateFigureAt(s.page)).toBeNull();
    expect(tapGateFigure(s, bus, at.x, at.y)).toBe(false);
  });
});

describe('planet 2: headline clause', () => {
  it('the first campaign ticket prints the headline (ciasteczka), whatever the seed; pools without a headline use lawPool[0]', () => {
    expect(headlineOf(0)).toBe('wymagana-aktualizacja');
    expect(headlineOf(1)).toBe('ciasteczka');
    expect(headlineOf(2)).toBe('parzystosc');
    expect(headlineOf(3)).toBe(planetDef(3).lawPool[0]);
    const c = { ...newCampaign(), current: 1, closed: [0] };
    for (let seed = 1; seed < 40; seed++) expect(nextCampaignPlan(c, 'normalny', seed)?.lawId).toBe('ciasteczka');
    const rolled = new Set<string>();
    for (let seed = 1; seed < 80; seed++) rolled.add(lawForPlanet(1, seed));
    expect(rolled.size).toBeGreaterThan(1);
  });
});
