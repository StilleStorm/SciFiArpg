import { describe, expect, it } from 'vitest';
import { newCampaign, toCardsSeen } from '../world/campaign';
import { actOf, campaignViewOf, cardToShow, markShown, noCardsSeen, startOfCampaign } from './ticketModel';

describe('campaign view', () => {
  it('follows the campaign and lets the plan on the desk name the planet', () => {
    expect(campaignViewOf(newCampaign())).toEqual(startOfCampaign());
    const c = { ...newCampaign(), current: 3, closed: [0, 1, 2] };
    expect(campaignViewOf(c).planetIndex).toBe(3);
    const done = { ...newCampaign(), current: 0, closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], caseClosed: true };
    const v = campaignViewOf(done, { kind: 'travel', planet: 5, priority: 'normalny', lawId: 'ciasteczka' });
    expect(v).toEqual({ planetIndex: 5, closed: done.closed, caseClosed: true, finale: false });
    const fin = { ...newCampaign(), closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], finalTicket: true };
    expect(campaignViewOf(fin, { kind: 'final', planet: 0, priority: 'normalny', lawId: 'ciasteczka' }).finale).toBe(true);
  });
  it('a travel return shows the rewritten card', () => {
    const done = { ...newCampaign(), closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], caseClosed: true };
    const v = campaignViewOf(done, { kind: 'travel', planet: 4, priority: 'normalny', lawId: 'ciasteczka' });
    expect(cardToShow(v, { opening: true, chapters: [0, 1, 2, 3, 4, 5, 6, 7, 8] }, 12)).toEqual({ kind: 'rewritten', planetIndex: 4 });
  });
});

describe('cards', () => {
  it('opening once, then the chapter of a planet once', () => {
    let seen = noCardsSeen();
    const view = startOfCampaign();
    const first = cardToShow(view, seen, 0);
    expect(first?.kind).toBe('opening');
    seen = markShown(seen, first ?? { kind: 'opening', planetIndex: 0 });
    expect(cardToShow(view, seen, 0)).toBeNull();
    const next = { ...view, planetIndex: 1, closed: [0] };
    const ch = cardToShow(next, seen, 1);
    expect(ch).toEqual({ kind: 'chapter', planetIndex: 1 });
    seen = markShown(seen, ch ?? { kind: 'chapter', planetIndex: 1 });
    expect(cardToShow(next, seen, 1)).toBeNull();
  });
  it('a closed planet after the case is shown rewritten, once', () => {
    let seen = { opening: true, chapters: [0, 1, 2] };
    const view = { planetIndex: 1, closed: [0, 1, 2], caseClosed: true, finale: false };
    const c = cardToShow(view, seen, 9);
    expect(c?.kind).toBe('rewritten');
    seen = markShown(seen, c ?? { kind: 'rewritten', planetIndex: 1 });
    expect(cardToShow(view, seen, 9)).toBeNull();
  });
  it('the return ticket shows its own card once, and the seen mark survives a load', () => {
    let seen = { opening: true, chapters: [0, 1, 2] };
    const view = campaignViewOf({ ...newCampaign(), closed: [0, 1, 2], finalTicket: true }, { kind: 'final', planet: 0, priority: 'normalny', lawId: 'ciasteczka' });
    const c = cardToShow(view, seen, 3);
    expect(c).toEqual({ kind: 'finale', planetIndex: 0 });
    seen = markShown(seen, c ?? { kind: 'finale', planetIndex: 0 });
    expect(cardToShow(view, seen, 3)).toBeNull();
    expect(toCardsSeen(JSON.parse(JSON.stringify(seen))).finale).toBe(true);
    expect(toCardsSeen({ opening: true, chapters: [] }).finale).toBeUndefined();
  });
  it('acts', () => {
    expect([0, 2, 3, 5, 6, 8].map(actOf)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
