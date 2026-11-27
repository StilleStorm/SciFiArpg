import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LAST, LEGACY_FINALE_LAST, clearReopened, cloneCampaign, newCampaign, toCampaign, toCardsSeen } from '../world/campaign';
import { t } from '../i18n';
import { actOf, campaignViewOf, CASE_LETTERS, cardToShow, extraLetterIndex, markShown, noCardsSeen, startOfCampaign } from './ticketModel';

describe('campaign view', () => {
  it('follows the campaign and lets the plan on the desk name the planet', () => {
    expect(campaignViewOf(newCampaign())).toEqual(startOfCampaign());
    const c = { ...newCampaign(), current: 3, closed: [0, 1, 2] };
    expect(campaignViewOf(c).planetIndex).toBe(3);
    const done = { ...newCampaign(), current: 0, closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], caseClosed: true };
    const v = campaignViewOf(done, { kind: 'travel', planet: 5, priority: 'normalny', lawId: 'ciasteczka' });
    expect(v).toEqual({ planetIndex: 5, closed: done.closed, caseClosed: true, finale: false, extras: 0 });
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
    expect(toCardsSeen(JSON.parse(JSON.stringify(seen))).finale).toBe(CAMPAIGN_LAST);
    expect(toCardsSeen({ opening: true, chapters: [] }).finale).toBeUndefined();
  });
  it('the return card comes once per CAMPAIGN_LAST: an old boolean mark is the LAST of its time, so a longer campaign shows it again', () => {
    const view = campaignViewOf({ ...newCampaign(), closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], finalTicket: true }, { kind: 'final', planet: 0, priority: 'normalny', lawId: 'ciasteczka' });
    const old = toCardsSeen({ opening: true, chapters: [0], finale: true });
    expect(old.finale).toBe(LEGACY_FINALE_LAST);
    expect(LEGACY_FINALE_LAST).toBeLessThan(CAMPAIGN_LAST);
    expect(cardToShow(view, old, 30)).toEqual({ kind: 'finale', planetIndex: 0 });
    const again = markShown(old, { kind: 'finale', planetIndex: 0 });
    expect(again.finale).toBe(CAMPAIGN_LAST);
    expect(cardToShow(view, again, 30)).toBeNull();
    expect(toCardsSeen({ opening: true, chapters: [], finale: 9 }).finale).toBe(9);
    expect(toCardsSeen({ opening: true, chapters: [], finale: 0 }).finale).toBeUndefined();
    expect(toCardsSeen({ opening: true, chapters: [], finale: 'x' }).finale).toBeUndefined();
    expect(toCardsSeen({ opening: true, chapters: [], finale: 99 }).finale).toBeUndefined();
  });
  it('the reopened case shows "Sprawę wznowiono" once, before the chapter card of planet 4', () => {
    // a save whose closed list ends at the old CAMPAIGN_LAST (3): toCampaign reopens it and goes on from planet 4
    let camp = toCampaign({ closed: [0, 1, 2], caseClosed: true });
    expect(camp).toMatchObject({ reopened: true, current: 3, caseClosed: false });
    const seen = { opening: true, chapters: [0, 1, 2] };
    const view = campaignViewOf(camp);
    expect(view.reopened).toBe(true);
    expect(cardToShow(view, seen, 12)).toEqual({ kind: 'reopened', planetIndex: 3 });
    expect(markShown(seen, { kind: 'reopened', planetIndex: 3 })).toBe(seen); // the card is remembered by the flag, not in the seen list
    // taken as shown: the flag goes (cloning keeps everything else), and the chapter card of planet 4 is next
    camp = clearReopened({ ...camp, cards: seen });
    expect(camp.reopened).toBeUndefined();
    expect(camp).toMatchObject({ current: 3, closed: [0, 1, 2], cards: seen });
    expect(cardToShow(campaignViewOf(camp), seen, 12)).toEqual({ kind: 'chapter', planetIndex: 3 });
    // it does not come back after a save and load, nor for a campaign that was never closed short
    expect(toCampaign(JSON.parse(JSON.stringify(camp))).reopened).toBeUndefined();
    expect(campaignViewOf(toCampaign({ closed: [0, 1], current: 2 })).reopened).toBeUndefined();
    // the return ticket's card wins over it, and cloning keeps the finale mark
    expect(cardToShow({ ...view, finale: true }, seen, 12)).toEqual({ kind: 'finale', planetIndex: 3 });
    expect(cloneCampaign({ ...newCampaign(), cards: { opening: true, chapters: [], finale: 6 } }).cards?.finale).toBe(6);
  });
  it('acts', () => {
    expect([0, 2, 3, 5, 6, 8].map(actOf)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe('the Komisja case letters (S27)', () => {
  it('every extra is the next letter and they cycle', () => {
    expect(extraLetterIndex(0)).toBe(0);
    expect(extraLetterIndex(5)).toBe(CASE_LETTERS - 1);
    expect(extraLetterIndex(CASE_LETTERS)).toBe(0);
    expect(extraLetterIndex(-3)).toBe(0);
    expect(t('screens.ticket.caseLetters').split('|')).toHaveLength(CASE_LETTERS);
    expect(campaignViewOf({ ...newCampaign(), caseClosed: true, extras: 7 }).extras).toBe(7);
    expect(campaignViewOf(newCampaign()).extras).toBeUndefined();
  });
});
