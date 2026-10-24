import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { bossVariantLine, placeBoss } from '../../enemies/bosses';
import { promptFor, storyEntry } from '../../combat/spor';
import { t } from '../../i18n';
import { drawingsOf } from '../../render/locations';
import { layoutForSeed, reachableCells } from '../base';
import { planetDef, type TicketPlan } from '../campaign';
import { npcAt } from '../npc';
import { generateRunPages, pickLocations, atExit } from '../pages';
import { newQuests, offersFor, questById } from '../quests';
import { createRun } from '../run';
import './index';
import { LOCATIONS, locationSpec, propColliders } from './locations';
import { hasStory } from './storyKeys';

const plan = (planet: number): TicketPlan => ({ kind: 'campaign', planet, priority: 'normalny', lawId: 'ciasteczka' });
const known = (key: string): boolean => t(key) !== key;

describe('planet 1: the clerk and the side tickets', () => {
  it('the clerk is the planet\'s own, with every text written', () => {
    const c = npcAt(0);
    expect(c.id).toBe('p1-referent');
    expect(c.look).toBe(1);
    for (const key of [c.nameKey, c.roleKey, ...c.lineKeys]) expect(known(key), key).toBe(true);
    expect(c.lineKeys).toHaveLength(3);
    expect(npcAt(1).id).not.toBe('p1-referent');
  });

  it('three hand-written tickets are on its board, with their texts and the rewards of STORY 8.1', () => {
    const offers = offersFor(0, newQuests());
    const mine = offers.filter((o) => o.id.startsWith('h:p1:'));
    expect(mine.map((o) => o.id)).toEqual(['h:p1:a', 'h:p1:b', 'h:p1:c']);
    for (const q of mine) {
      expect(known(q.titleKey), q.titleKey).toBe(true);
      expect(t(q.textKey, { count: q.n })).not.toContain('{count}');
      expect(questById(q.id)).toBe(q);
    }
    expect(mine[0]).toMatchObject({ kind: 'kill', n: 12, family: 'urzadzenia', reward: { stars: 30, permission: 'urzadzenia' } });
    expect(mine[1]).toMatchObject({ kind: 'fetch', n: 3, reward: { stars: 20, potwierdzenia: 1 } });
    expect(mine[2]).toMatchObject({ kind: 'reach', n: 3, reward: { stars: 20 } });
    expect(offersFor(1, newQuests()).some((o) => o.id.startsWith('h:p1:'))).toBe(false);
  });
});

describe('planet 1: base layout and locations', () => {
  it('the base takes its layout from the planet\'s list (ladowisko or wioska), both occur', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 120; seed++) seen.add(layoutForSeed(seed, 0));
    expect([...seen].sort()).toEqual([...planetDef(0).baseLayouts].sort());
    expect(layoutForSeed(7)).toBe(layoutForSeed(7, undefined));
  });

  it('each of the two types has at least six drawn props, with a footprint and a drawing for every one', () => {
    for (const type of ['przedmiescie', 'magazyn'] as const) {
      const spec = locationSpec(type);
      expect(spec, type).toBeDefined();
      const ids = (spec?.props ?? []).map((p) => p.id);
      expect(ids.length).toBeGreaterThanOrEqual(6);
      expect(drawingsOf(type).sort()).toEqual([...ids].sort());
      for (const p of spec?.props ?? []) expect(propColliders(p.id, 0, 0, p.size[0]).length === 0, p.id).toBe(spec?.flat.includes(p.id) === true);
    }
    expect(Object.keys(LOCATIONS).sort()).toEqual(['magazyn', 'przedmiescie']);
  });

  it('pages are given a type by seed: the first the first type, the boss page the last, and every type is seen', () => {
    const list = planetDef(0).locations;
    for (let seed = 1; seed < 60; seed++) {
      for (const count of [4, 5]) {
        const where = pickLocations(createRng(seed), count, list);
        expect(where).toHaveLength(count);
        expect(where[0]).toBe('przedmiescie');
        expect(where[count - 1]).toBe('magazyn');
        expect(new Set(where)).toEqual(new Set(list));
        expect(pickLocations(createRng(seed), count, list)).toEqual(where);
      }
    }
    expect(pickLocations(createRng(1), 4, [])).toEqual([]);
  });

  it('a run on planet 1 has location pages of both types with props, and a planet without drawings keeps the generic pages', () => {
    const s = createRun(11, { plan: plan(0) });
    expect(s.pages.every((p) => p.location !== undefined)).toBe(true);
    const types = new Set(s.pages.map((p) => p.location));
    expect(types.has('przedmiescie') && types.has('magazyn')).toBe(true);
    const variants = new Set<string>();
    for (const page of s.pages) for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) variants.add(o.variant);
    expect(variants.size).toBeGreaterThanOrEqual(6);
    // planet 4's types (miasto, biuro) have no drawings yet: its pages stay the generic ones
    const other = createRun(11, { plan: plan(3) });
    expect(other.pages.some((p) => p.obstacles.some((o) => o.kind === 'prop'))).toBe(false);
    expect(other.pages.every((p) => p.location === undefined)).toBe(true);
    expect(createRun(11).pages.every((p) => p.location === undefined)).toBe(true);
  });

  it('every prop of both types turns up on some page, and the exit is always reachable from the entry', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const pages = generateRunPages(createRng(seed), 5, planetDef(0).locations);
      for (const page of pages) {
        for (const o of page.obstacles) if (o.kind === 'prop' && o.variant) seen.add(o.variant);
        if (!page.exit) continue;
        const cells = reachableCells(page, page.entry, 20);
        expect(cells.some((c) => atExit(page, c)), `seed ${seed} page ${page.index} ${page.location}`).toBe(true);
      }
    }
    const all = Object.values(LOCATIONS).flatMap((l) => l?.props.map((p) => p.id) ?? []);
    expect([...seen].sort()).toEqual([...all].sort());
  });
});

describe('planet 1: the boss', () => {
  it('Prototyp is the demo unit on planet 1: 260 racja and a line under its name; elsewhere the plain boss', () => {
    const s = createRun(5, { plan: plan(0) });
    const e = placeBoss(s, 'urzadzenia', 300, 300);
    expect(e.hpMax).toBe(260);
    expect(e.hp).toBe(260);
    expect(bossVariantLine(e)).toBe('story.p1.boss.variant');
    expect(known('story.p1.boss.variant')).toBe(true);
    const plain = placeBoss(createRun(5, { plan: plan(1) }), 'urzadzenia', 300, 300);
    expect(plain.hpMax).toBe(300);
    expect(bossVariantLine(plain)).toBeUndefined();
    expect(placeBoss(createRun(5), 'urzadzenia', 300, 300).hpMax).toBe(300);
  });

  it('its Spor comments are the planet\'s: the right answers are regulaminowy, then mechaniczny; the family table stays elsewhere', () => {
    for (const [phase, right] of [[1, 'regulaminowy'], [2, 'mechaniczny']] as const) {
      const p = promptFor('prototyp', phase, createRng(3), 0);
      expect(p.commentKey).toBe(`story.p1.boss.spor${phase}.comment`);
      expect(known(p.commentKey)).toBe(true);
      expect(p.replies[p.correct].type).toBe(right);
      for (const r of p.replies) expect(known(r.textKey), r.textKey).toBe(true);
      expect(new Set(p.replies.map((r) => r.type)).size).toBe(3);
    }
    expect(promptFor('prototyp', 1, createRng(3)).commentKey).toBe('enemies.boss.prototyp.spor1.comment');
    expect(promptFor('prototyp', 1, createRng(3), 1).commentKey).toBe('enemies.boss.prototyp.spor1.comment');
    expect(storyEntry(0, 'weryfikacja', 1)).toBeNull();
  });
});

describe('story keys', () => {
  it('finds written texts and not unwritten ones', () => {
    expect(hasStory('p1.card.lines.1')).toBe(true);
    expect(hasStory('p1.ticket.a.text')).toBe(true);
    expect(hasStory('opening.hero.pralka')).toBe(true);
    expect(hasStory('p5.card.lines.1')).toBe(false);
    expect(hasStory('p1.card')).toBe(false);
  });
});
