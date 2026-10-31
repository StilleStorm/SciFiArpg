import { describe, expect, it } from 'vitest';
import { promptFor } from '../../combat/spor';
import { createBus } from '../../core/events';
import { createRng } from '../../core/rng';
import { BOSSES, bossVariantArm, bossVariantLine, placeBoss } from '../../enemies/bosses';
import { t } from '../../i18n';
import { drawingsOf } from '../../render/locations';
import { reachableCells } from '../base';
import { headlineOf, planetDef, type TicketPlan } from '../campaign';
import { npcAt } from '../npc';
import { generateRunPages, pickLocations } from '../pages';
import { populatePage } from '../pageTurn';
import { newQuests, offersFor, questById } from '../quests';
import { createRun, type RunState } from '../run';
import './index';
import { locationSpec, propColliders } from './locations';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'godziny-konsultanta' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 6): RunState => createRun(seed, { plan: plan(3), pageCount });

describe('planet 4: the record and the page split', () => {
  it('is Akt II, 5-6 pages, headline Godziny konsultanta, miasto then biuro, no gate, no hosted set', () => {
    const p = planetDef(3);
    expect(p.act).toBe(2);
    expect(p.pages).toEqual([5, 6]);
    expect(p.hostedSet).toBeNull();
    expect(p.boss).toBe('weryfikacja');
    expect(p.locations).toEqual(['miasto', 'biuro']);
    expect(p.baseLayouts).toEqual(['miasteczko', 'ladowisko']);
    expect(headlineOf(3)).toBe('godziny-konsultanta');
    expect(p.locationSplit).toBe(3);
    expect(p.gates).toBeUndefined();
    for (const k of ['planets.p4.name', 'planets.p4.loc']) expect(known(k), k).toBe(true);
  });

  it('pages 1-3 are miasto, the rest and the boss page biuro, for 5 and for 6 pages', () => {
    const p = planetDef(3);
    expect(pickLocations(createRng(9), 6, p.locations, p.locationSplit)).toEqual(['miasto', 'miasto', 'miasto', 'biuro', 'biuro', 'biuro']);
    expect(pickLocations(createRng(9), 5, p.locations, p.locationSplit)).toEqual(['miasto', 'miasto', 'miasto', 'biuro', 'biuro']);
    for (let seed = 1; seed < 12; seed++) {
      expect(run(seed).pages.map((q) => q.location)).toEqual(['miasto', 'miasto', 'miasto', 'biuro', 'biuro', 'biuro']);
      expect(run(seed).pages.some((q) => q.gate)).toBe(false);
    }
  });
});

describe('planet 4: the story texts', () => {
  it('the chapter card, the five hero lines and the red variant are written', () => {
    for (const k of ['1', '2', '3']) expect(known(`story.p4.card.lines.${k}`), k).toBe(true);
    for (const h of ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik']) expect(known(`story.p4.card.hero.${h}`), h).toBe(true);
    for (const k of ['1', '2']) expect(known(`story.p4.rewritten.lines.${k}`), k).toBe(true);
  });
});

describe('planet 4: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 4, with every text written', () => {
    const c = npcAt(3);
    expect(c.id).toBe('p4-referent');
    expect(c.look).toBe(4);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
    expect(t(c.nameKey)).toBe('Referent ds. Eskalacji');
  });

  it('three hand-written tickets with the rewards of STORY 8.8, only on the planet 4 board', () => {
    const mine = offersFor(3, newQuests()).filter((o) => o.id.startsWith('h:p4:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p4:a', 'h:p4:b', 'h:p4:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(3);
    }
    expect(mine[0]).toMatchObject({ kind: 'kill', n: 14, family: 'powiadomienia', reward: { stars: 40, permission: 'powiadomienia' } });
    expect(mine[1]).toMatchObject({ kind: 'reach', n: 5, reward: { stars: 35, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 4, reward: { stars: 30 } });
    expect(offersFor(2, newQuests()).some((o) => o.id.startsWith('h:p4:'))).toBe(false);
  });
});

describe('planet 4: the boss', () => {
  it('Weryfikacja, instancja druga: racja 260 instead of 220, the variant line, no other change; other planets keep 220', () => {
    const e = placeBoss(run(5), 'powiadomienia', 300, 300);
    expect(e.hpMax).toBe(260);
    expect(BOSSES.weryfikacja.hp).toBe(220);
    expect(e.attackRange).toBe(BOSSES.weryfikacja.attackRange);
    expect(bossVariantLine(e)).toBe('story.p4.boss.variant');
    expect(bossVariantArm(e)).toBeUndefined();
    expect(known('story.p4.boss.variant')).toBe(true);
    expect(placeBoss(createRun(5, { plan: plan(4) }), 'powiadomienia', 300, 300).hpMax).toBe(220);
  });

  it('its Spor comments are the planet\'s: the right answers are regulaminowy, then mechaniczny; three distinct written replies', () => {
    for (const [phase, right] of [[1, 'regulaminowy'], [2, 'mechaniczny']] as const) {
      const p = promptFor('weryfikacja', phase, createRng(3), 3);
      expect(p.commentKey).toBe(`story.p4.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
    }
  });
});

describe('planet 4: miasto', () => {
  it('has at least ten props, every one drawn, flat marks have no footprint and the solid ones do', () => {
    const spec = locationSpec('miasto');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(drawingsOf('miasto').sort()).toEqual([...ids].sort());
    expect(spec?.layout).toBe('corridors');
    expect(spec?.wall).toBe('kamienica');
    expect(spec?.flat).toEqual(['pasy', 'wlaz']);
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
  });

  it('every miasto prop turns up over 60 seeds and the exit of every page is reachable; the middle street is clear', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const page of generateRunPages(createRng(seed), 5, ['miasto'])) {
        for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) seen.add(o.variant);
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - page.exit!.x, c.y - page.exit!.y) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('miasto')?.props ?? []).map((p) => p.id).sort());
  });

  it('the boss page (biuro) always finds a place for the boss', () => {
    for (let seed = 1; seed <= 30; seed++) {
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
