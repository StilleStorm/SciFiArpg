import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { applyCharacter, serializeCharacter, toCharacter } from '../save/character';
import { dropLoot } from '../systems/loot';
import { defaultPlan, newCampaign } from '../world/campaign';
import { completeQuest, questsOf, registerSideTickets, takeQuest } from '../world/quests';
import { createRun, type RunState } from '../world/run';
import { PACZKOMAT_FEE } from '../balance/loot';
import { bindDelivery, claimAwizo, codeOf, issueAwizo, paczkomatPage, postKind, runsLeft, sendByPost, sendReward, settleAwizos, tickDelivery } from './delivery';
import { INVENTORY_CAP } from './inventory';
import { freeVersionOf, rollItem } from './generate';
import { makeSetPiece } from './setPieces';
import { UNIQUES_BY_ID } from './uniques';
import type { Item } from './types';

const planned = (seed: number, planet: number): RunState => createRun(seed, { plan: { ...defaultPlan(newCampaign(), 'normalny', seed), planet }, pageCount: 5 });
const piece = (seed = 1): Item => {
  const p = makeSetPiece(createRng(seed), 'obieg', 6, 0);
  if (!p) throw new Error('no piece');
  return p;
};
const notes = (bus: ReturnType<typeof createBus>): string[] => {
  const out: string[] = [];
  bus.on('footnote', (e) => out.push(e.text));
  return out;
};

describe('which drops go by post (ITEMS 6.4)', () => {
  it('a zestaw piece and a unique always, a rzadki sometimes, the rest never', () => {
    expect(postKind(piece())).toBe('always');
    const def = UNIQUES_BY_ID.get('odmowa');
    expect(def && postKind({ tier: 'unikatowy', uniqueId: 'odmowa' })).toBe('always');
    expect(postKind({ tier: 'rzadki' })).toBe('maybe');
    expect(postKind({ tier: 'nietypowy' })).toBe('never');
    expect(postKind({ tier: 'zwykly' })).toBe('never');
  });

  it('the paczkomat page is the run\'s kiosk page while it is ahead, 0 once passed', () => {
    const s = planned(3, 0);
    const at = s.pages.findIndex((pg) => pg.hasKiosk);
    expect(at).toBeGreaterThan(0);
    s.pageIndex = 0;
    expect(paczkomatPage(s)).toBe(at + 1);
    s.pageIndex = at;
    expect(paczkomatPage(s)).toBe(at + 1);
    s.pageIndex = at + 1;
    expect(paczkomatPage(s)).toBe(0);
  });

  it('sends at most one per page, numbered, with a footnote naming the page', () => {
    const s = planned(4, 1);
    const bus = createBus();
    const said = notes(bus);
    const rng = createRng(9);
    const a = sendByPost(s, bus, rng, piece(1));
    expect(a?.n).toBeGreaterThan(0);
    expect(a?.item.number).toBe(a?.n);
    expect(a?.page).toBe(paczkomatPage(s));
    expect(said[0]).toContain(String(a?.n));
    expect(sendByPost(s, bus, rng, piece(2))).toBeNull(); // the page has sent its one
    s.pageIndex = 1;
    expect(sendByPost(s, bus, rng, piece(3))).not.toBeNull();
    expect(sendByPost(s, bus, rng, rollItem(rng, { level: 3, tier: 'zwykly' }))).toBeNull();
  });

  it('a rzadki arrives by post 30 times in 100', () => {
    let posted = 0;
    const rng = createRng(77);
    for (let i = 0; i < 1000; i++) {
      const s = planned(5, 0);
      if (sendByPost(s, undefined, rng, rollItem(rng, { level: 3, tier: 'rzadki' }))) posted++;
    }
    expect(posted / 1000).toBeGreaterThan(0.26);
    expect(posted / 1000).toBeLessThan(0.34);
  });

  it('a delivered rzadki is the free version exactly when freeVersionOf says so; a drop on the ground never is', () => {
    const rng = createRng(78);
    let free = 0;
    for (let i = 0; i < 3000; i++) {
      const s = planned(5, 0);
      const item = rollItem(rng, { level: 3, tier: 'rzadki' });
      const expected = freeVersionOf(item);
      const a = sendByPost(s, undefined, rng, item);
      if (!a) {
        expect(item.freeVersion).toBeUndefined();
        continue;
      }
      expect(a.item.freeVersion).toBe(expected.freeVersion);
      if (a.item.freeVersion) free++;
    }
    expect(free).toBeGreaterThan(40); // about 3000 x 0.3 x 0.1 = 90
    expect(free).toBeLessThan(150);
  });

  it('dropLoot of elites: every zestaw piece and unique is an awizo, never on the ground; one per page', () => {
    const s = planned(6, 1);
    for (let page = 0; page < 3; page++) {
      s.pageIndex = page;
      for (let i = 0; i < 400; i++) dropLoot(s, 0, 0, 'elite');
    }
    const ground = s.pickups.flatMap((k) => (k.item ? [k.item] : []));
    // a second piece on the same page falls to the ground; the first of each page went by post
    expect(s.player.awizos?.length).toBe(3);
    for (const a of s.player.awizos ?? []) expect(a.page).toBeGreaterThan(0);
    expect(ground.some((i) => i.setId || i.uniqueId)).toBe(true);
  });

  it('a boss hands over in person: nothing by post', () => {
    const s = planned(7, 1);
    for (let i = 0; i < 40; i++) dropLoot(s, 0, 0, 'boss');
    expect(s.player.awizos).toBeUndefined();
  });
});

describe('the code at the paczkomat (DESIGN 7)', () => {
  const standAtKiosk = (s: RunState): void => {
    const k = s.page.obstacles.find((o) => o.kind === 'kiosk');
    if (!k) throw new Error('no kiosk on this page');
    s.player.x = k.x + 40;
    s.player.y = k.y;
  };
  const kioskRun = (): RunState => {
    const s = planned(8, 1);
    s.pageIndex = s.pages.findIndex((pg) => pg.hasKiosk);
    const page = s.pages[s.pageIndex];
    if (!page) throw new Error('no page');
    s.page = page;
    return s;
  };

  it('standing at the paczkomat requests the code; the SMS comes 6-12 s later and the item enters the bag', () => {
    const s = kioskRun();
    const bus = createBus();
    const said = notes(bus);
    const a = issueAwizo(s, piece(), s.pageIndex + 1);
    standAtKiosk(s);
    tickDelivery(s, bus, 1 / 60);
    expect(said[0]).toBe(t('economy.paczkomat.codeAsked', { n: a.n }));
    let seconds = 0;
    while (s.player.awizos?.length && seconds < 14) {
      tickDelivery(s, bus, 0.25);
      seconds += 0.25;
    }
    expect(seconds).toBeGreaterThanOrEqual(6);
    expect(seconds).toBeLessThanOrEqual(12.5);
    expect(s.player.awizos).toBeUndefined();
    expect(s.player.inventory).toContain(a.item);
    expect(said.some((x) => x.includes(codeOf(a)))).toBe(true);
  });

  it('straying from the paczkomat loses the code; a full bag waits', () => {
    const s = kioskRun();
    const bus = createBus();
    const said = notes(bus);
    const a = issueAwizo(s, piece(), s.pageIndex + 1);
    standAtKiosk(s);
    tickDelivery(s, bus, 0.1);
    s.player.x += 500;
    tickDelivery(s, bus, 0.1);
    expect(said).toContain(t('economy.paczkomat.codeLost', { n: a.n }));
    standAtKiosk(s);
    s.player.inventory = Array.from({ length: INVENTORY_CAP }, (_, i) => rollItem(createRng(i + 1), { level: 1, tier: 'zwykly' }));
    for (let i = 0; i < 80; i++) tickDelivery(s, bus, 0.25);
    expect(s.player.awizos).toHaveLength(1);
    expect(s.player.inventory).toHaveLength(INVENTORY_CAP);
  });

  it('an awizo of another page is not served here', () => {
    const s = kioskRun();
    issueAwizo(s, piece(), s.pageIndex + 3);
    standAtKiosk(s);
    for (let i = 0; i < 100; i++) tickDelivery(s, createBus(), 0.25);
    expect(s.player.awizos).toHaveLength(1);
  });
});

describe('the base paczkomat', () => {
  it('a run that ends files every awizo at the base; two more runs and it goes back to the sender', () => {
    const s = planned(9, 1);
    const bus = createBus();
    const said = notes(bus);
    bindDelivery(bus, () => s);
    const a = issueAwizo(s, piece(), 3);
    bus.emit('run:ended', { outcome: 'ukonczono' });
    expect(a.page).toBe(0);
    expect(a.age).toBe(0);
    expect(runsLeft(a)).toBe(2);
    bus.emit('run:ended', { outcome: 'zgloszenie' });
    expect(s.player.awizos).toHaveLength(1);
    expect(runsLeft(a)).toBe(1);
    bus.emit('run:ended', { outcome: 'zgloszenie' });
    expect(s.player.awizos).toBeUndefined();
    bus.emit('base:entered', { layout: 'wioska', seed: 1, number: 1 });
    expect(said).toEqual([t('economy.paczkomat.returned', { n: a.n })]);
  });

  it('a ticket given up (another seed starts) takes its awizos to the base; the same ticket resumed keeps them on their page', () => {
    const s = planned(17, 1);
    const bus = createBus();
    bindDelivery(bus, () => s);
    const a = issueAwizo(s, piece(), 3);
    bus.emit('run:started', { seed: s.seed });
    expect(a.page).toBe(3);
    bus.emit('run:started', { seed: s.seed + 1 });
    expect(a.page).toBe(0);
    expect(a.age).toBe(0);
  });

  it('settleAwizos reports the items sent back', () => {
    const s = planned(10, 1);
    const a = issueAwizo(s, piece(), 0);
    a.age = 1;
    expect(settleAwizos(s.player)).toEqual([a.item]);
  });

  it('a pickup costs 15 gwiazdki and puts the item in the bag; poor, full and away change nothing', () => {
    const s = planned(11, 1);
    const p = s.player;
    const a = issueAwizo(s, piece(), 0);
    p.gwiazdki = PACZKOMAT_FEE - 1;
    expect(claimAwizo(p, a.n).result).toBe('poor');
    expect(p.awizos).toHaveLength(1);
    p.gwiazdki = 40;
    expect(claimAwizo(p, 999).result).toBe('missing');
    p.inventory = Array.from({ length: INVENTORY_CAP }, (_, i) => rollItem(createRng(i + 1), { level: 1, tier: 'zwykly' }));
    expect(claimAwizo(p, a.n).result).toBe('full');
    expect(p.gwiazdki).toBe(40);
    p.inventory = [];
    const res = claimAwizo(p, a.n);
    expect(res.result).toBe('ok');
    expect(p.gwiazdki).toBe(40 - PACZKOMAT_FEE);
    expect(p.inventory).toEqual([a.item]);
    expect(p.awizos).toBeUndefined();
    const away = issueAwizo(s, piece(2), 3);
    expect(claimAwizo(p, away.n).result).toBe('away');
  });

  it('awizos are saved with the character and come back after a load', () => {
    const s = planned(12, 1);
    const a = issueAwizo(s, piece(), 2);
    a.age = 1;
    const record = serializeCharacter(s);
    expect(record.awizos).toHaveLength(1);
    const back = toCharacter(JSON.parse(JSON.stringify(record)));
    expect(back?.awizos?.[0]?.n).toBe(a.n);
    expect(back?.awizos?.[0]?.age).toBe(1);
    const fresh = planned(13, 1);
    if (back) applyCharacter(fresh, back);
    expect(fresh.player.awizos?.[0]?.item.uid).toBe(a.item.uid);
    // an older save has none
    const old = serializeCharacter(planned(14, 1));
    expect(old.awizos).toBeUndefined();
  });
});

describe('a side ticket\'s item reward (ITEMS 12.7)', () => {
  it('arrives as an awizo at the base paczkomat, never in the bag', () => {
    registerSideTickets([
      { id: 'h:test:nagroda', kind: 'reach', planet: 0, n: 1, titleKey: 'screens.quests.reach.0.title', textKey: 'screens.quests.reach.0.text', reward: { stars: 10, item: { unique: 'odmowa' } } },
    ]);
    const s = createRun(15, { phase: 'run' });
    const bus = createBus();
    const said = notes(bus);
    takeQuest(s, bus, 'h:test:nagroda');
    const q = questsOf(s).active[0];
    if (q) q.progress = 1;
    expect(completeQuest(s, bus, 'h:test:nagroda')).toBe(true);
    expect(s.player.inventory).toHaveLength(0);
    const awizo = s.player.awizos?.[0];
    expect(awizo?.page).toBe(0);
    expect(awizo?.komisja).toBe(true);
    expect(awizo?.item.uniqueId).toBe('odmowa');
    expect(said.some((x) => x.includes(String(awizo?.n)))).toBe(true);
  });

  it('a set piece reward and a missing id', () => {
    const s = createRun(16, { phase: 'run' });
    const a = sendReward(s, createRng(1), { set: 'serwis', piece: 1 }, 5);
    expect(a?.item.setId).toBe('serwis');
    expect(sendReward(s, createRng(1), { unique: 'nie-ma' }, 5)).toBeNull();
  });
});
