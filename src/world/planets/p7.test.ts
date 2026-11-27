import { describe, expect, it } from 'vitest';
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

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'nie-przeszkadzac' });
const known = (key: string): boolean => t(key) !== key;
const run = (seed: number, pageCount = 6): RunState => createRun(seed, { plan: plan(6), pageCount });

describe('planet 7: the record and the page split', () => {
  it('is Akt III, headline Nie przeszkadzac, no hosted set, locations jaskinia then rownina with the split at page 3, no gate', () => {
    const p = planetDef(6);
    expect(p.act).toBe(3);
    expect(p.pages).toEqual([5, 6]);
    expect(p.hostedSet).toBeNull();
    expect(p.boss).toBe('hipoteza');
    expect(p.locations).toEqual(['jaskinia', 'rownina']);
    expect(p.locationSplit).toBe(3);
    expect(p.gates).toBeUndefined();
    expect(headlineOf(6)).toBe('nie-przeszkadzac');
    expect(p.lawPool).toContain('nie-przeszkadzac');
  });

  it('pages 1-3 jaskinia, the rest and the boss page rownina, for five and six pages', () => {
    const p = planetDef(6);
    expect(pickLocations(createRng(9), 5, p.locations, p.locationSplit)).toEqual(['jaskinia', 'jaskinia', 'jaskinia', 'rownina', 'rownina']);
    for (let seed = 1; seed < 12; seed++) {
      expect(run(seed).pages.map((q) => q.location)).toEqual(['jaskinia', 'jaskinia', 'jaskinia', 'rownina', 'rownina', 'rownina']);
      expect(run(seed).pages.some((q) => q.gate)).toBe(false);
    }
  });
});

describe('planet 7: the story texts', () => {
  it('the chapter card, the five hero lines and the red variant are written', () => {
    for (const k of ['1', '2', '3']) expect(known(`story.p7.card.lines.${k}`), k).toBe(true);
    for (const h of ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik']) expect(known(`story.p7.card.hero.${h}`), h).toBe(true);
    for (const k of ['1', '2']) expect(known(`story.p7.rewritten.lines.${k}`), k).toBe(true);
  });
});

describe('planet 7: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, look seed 7, with every text written', () => {
    const c = npcAt(6);
    expect(c.id).toBe('p7-inspektor');
    expect(c.look).toBe(7);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
    expect(t(c.nameKey)).toBe('Inspektor ds. Weryfikacji');
  });

  it('three hand-written tickets with the rewards of STORY 8.13, no item, only on the planet 7 board', () => {
    const mine = offersFor(6, newQuests()).filter((o) => o.id.startsWith('h:p7:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p7:a', 'h:p7:b', 'h:p7:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
      expect(q.planet).toBe(6);
      expect(q.reward.item).toBeUndefined();
    }
    expect(mine[0]).toMatchObject({ kind: 'kill', n: 16, family: 'wygenerowane', reward: { stars: 45, permission: 'wygenerowane' } });
    expect(mine[1]).toMatchObject({ kind: 'reach', n: 4, reward: { stars: 40, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'fetch', n: 5, reward: { stars: 35 } });
    expect(offersFor(5, newQuests()).some((o) => o.id.startsWith('h:p7:'))).toBe(false);
  });
});

describe('planet 7: the boss', () => {
  it('Hipoteza, wersja robocza, uzupelniona: racja 300 instead of 260, the variant line, no part; other planets keep 260', () => {
    const e = placeBoss(run(5), 'wygenerowane', 300, 300);
    expect(e.hpMax).toBe(300);
    expect(BOSSES.hipoteza.hp).toBe(260);
    expect(e.attackRange).toBe(BOSSES.hipoteza.attackRange);
    expect(bossVariantLine(e)).toBe('story.p7.boss.variant');
    expect(bossVariantArm(e)).toBeUndefined();
    expect(known('story.p7.boss.variant')).toBe(true);
    expect(placeBoss(createRun(5, { plan: plan(2) }), 'wygenerowane', 300, 300).hpMax).toBe(260);
  });

  it('the planet 7 Spor texts are written (the answers table is combat/spor.ts)', () => {
    for (const phase of [1, 2]) {
      expect(known(`story.p7.boss.spor${phase}.comment`)).toBe(true);
      for (const type of ['mechaniczny', 'regulaminowy', 'egzystencjalny']) expect(known(`story.p7.boss.spor${phase}.reply.${type}`), `${phase} ${type}`).toBe(true);
    }
  });
});

describe('planet 7: jaskinia', () => {
  it('is the rooms layout with rock faces for walls and stalagmites in rows; every prop but the serwerownia\'s plate is drawn', () => {
    const spec = locationSpec('jaskinia');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(spec?.layout).toBe('rooms');
    expect(spec?.wall).toBe('urwisko');
    expect(spec?.wallSide).toBe('urwisko-boczne');
    expect(spec?.row).toBe('stalagmity');
    expect(spec?.flat).toEqual(['kaluza']);
    expect(drawingsOf('jaskinia').sort()).toEqual(ids.filter((id) => id !== 'cisza').sort());
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
  });

  it('every jaskinia prop turns up over 60 seeds and the exit of every page is reachable', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const page of generateRunPages(createRng(seed), 5, ['jaskinia'])) {
        for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) seen.add(o.variant);
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - (page.exit?.x ?? 0), c.y - (page.exit?.y ?? 0)) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('jaskinia')?.props ?? []).map((p) => p.id).sort());
  });
});

describe('planet 7: rownina', () => {
  it('is the rows layout, wide and sparse, with a flat patch of grass; every prop is drawn', () => {
    const spec = locationSpec('rownina');
    const ids = (spec?.props ?? []).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(spec?.layout).toBe('rows');
    expect(spec?.flat).toEqual(['trawa']);
    expect(drawingsOf('rownina').sort()).toEqual([...ids].sort());
    for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
  });

  it('every rownina prop turns up over 60 seeds and the exit of every page is reachable', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const page of generateRunPages(createRng(seed), 5, ['rownina'])) {
        for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) seen.add(o.variant);
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => Math.hypot(c.x - (page.exit?.x ?? 0), c.y - (page.exit?.y ?? 0)) < 100), `seed ${seed} page ${page.index}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual((locationSpec('rownina')?.props ?? []).map((p) => p.id).sort());
  });

  it('the boss page (rownina) always finds a place for the boss', () => {
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
