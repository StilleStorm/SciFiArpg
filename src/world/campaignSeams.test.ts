import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { gainXp } from '../progression/xp';
import { bookmarkOf, toBookmark } from '../save/bookmark';
import { dropLevel } from '../systems/loot';
import { defaultPlan, extraPlan, lawForPlanet, newCampaign, toCampaign, toCardsSeen, type TicketPlan } from './campaign';
import { createRun } from './run';

const plan = (priority: TicketPlan['priority'], planet = 2): TicketPlan => ({ kind: 'campaign', planet, priority, lawId: lawForPlanet(planet, 3) });

describe('campaign seams', () => {
  it('the default plan is the next campaign ticket, or an extra after the case', () => {
    expect(defaultPlan(newCampaign(), 'normalny', 7)).toMatchObject({ kind: 'campaign', planet: 0 });
    const done = { ...newCampaign(), closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], caseClosed: true };
    expect(defaultPlan(done, 'normalny', 7)).toEqual(extraPlan(done, 'normalny', 7));
  });

  it('a bookmark carries the plan, and a resumed run keeps planet and priority', () => {
    const s = createRun(11, { plan: plan('wysoki') });
    const b = toBookmark(JSON.parse(JSON.stringify(bookmarkOf(s))));
    expect(b?.plan).toEqual(s.plan);
    const r = createRun(11, b ? { resume: b } : {});
    expect(r.plan).toEqual(s.plan);
    expect(r.ticket.planet).toBe(s.ticket.planet);
    expect(toBookmark({ ...bookmarkOf(s), plan: { kind: 'x', planet: 2, priority: 'wysoki', lawId: 'ciasteczka' } })?.plan).toBeUndefined();
    expect(bookmarkOf(createRun(11)).plan).toBeUndefined();
  });

  it('the priority multiplies reputacja and raises the item level', () => {
    const bus = createBus();
    const a = createRun(5, { plan: plan('normalny') });
    const b = createRun(5, { plan: plan('krytyczny') });
    const c = createRun(5);
    gainXp(a, bus, 10);
    gainXp(b, bus, 10);
    gainXp(c, bus, 10);
    expect(b.player.xp).toBeGreaterThan(a.player.xp);
    expect(c.player.xp).toBe(a.player.xp);
    expect(dropLevel(b)).toBe(dropLevel(a) + 6);
    expect(dropLevel(c)).toBe(dropLevel(a));
  });

  it('seen cards live in the campaign record and survive validation', () => {
    expect(toCardsSeen({ opening: true, chapters: [0, 0, -3, 99, 'x'] })).toEqual({ opening: true, chapters: [0, -3] });
    const c = toCampaign({ current: 1, closed: [0], cards: { opening: true, chapters: [0, 1] } });
    expect(c.cards).toEqual({ opening: true, chapters: [0, 1] });
    expect(toCampaign({ current: 1, closed: [0] }).cards).toBeUndefined();
  });
});
