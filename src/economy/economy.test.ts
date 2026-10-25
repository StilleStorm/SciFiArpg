import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { AFFIXES_BY_ID } from '../items/affixes';
import { itemValue } from '../items/generate';
import { listPrice } from '../items/level';
import { t } from '../i18n';
import { BASE_SCHEDULE, KIOSK_SCHEDULE, botLine, createHours, formatClock, hoursAt, officeOverride, setOfficeOpen } from './hours';
import {
  FEE_RATE,
  LIE_RATES,
  UPDATED_LIE_RATES,
  REPORTS_TO_UPDATE,
  buy,
  createSklep,
  feeOf,
  feeRateOf,
  lieRate,
  makeListing,
  reportProblem,
  restock,
  totalOf,
} from './sklep';
import { addStars, canAfford, spendStars } from './stars';

describe('gwiazdki', () => {
  it('adds and spends whole numbers, never goes negative', () => {
    const p = { gwiazdki: 3 };
    addStars(p, 2);
    addStars(p, -5);
    addStars(p, 1.9);
    expect(p.gwiazdki).toBe(6);
    expect(spendStars(p, 7)).toBe(false);
    expect(p.gwiazdki).toBe(6);
    expect(spendStars(p, 4)).toBe(true);
    expect(p.gwiazdki).toBe(2);
    expect(canAfford(p, 2)).toBe(true);
    expect(canAfford(p, 3)).toBe(false);
  });
});

describe('Sklep: service fee', () => {
  it('adds 20% at checkout (rounded up)', () => {
    expect(FEE_RATE).toBe(0.2);
    expect(feeOf(10)).toBe(2);
    expect(feeOf(11)).toBe(3);
    expect(totalOf(10)).toBe(12);
    expect(totalOf(1)).toBe(2);
  });
  it('a fee cut (Konsultant passive 10) lowers the fee, never below zero, and buy() charges the cut fee', () => {
    expect(feeRateOf(0.3)).toBeCloseTo(0.14, 9);
    expect(feeOf(10, 0.3)).toBe(2);
    expect(feeOf(100, 0.3)).toBe(14);
    expect(feeOf(100, 5)).toBe(0);
    const s = createSklep();
    s.updates = 0;
    const l = makeListing(createRng(1), 1, 3, 'bron', 0);
    s.stock = [l];
    const p = { gwiazdki: 1000, inventory: [] as never[] };
    const res = buy(s, p, l.id, 5, 0.3);
    expect(res.fee).toBe(feeOf(l.truePrice, 0.3));
    expect(p.gwiazdki).toBe(1000 - l.truePrice - feeOf(l.truePrice, 0.3));
  });
  it('charges listed price plus fee for an honest listing and hands over the advertised item', () => {
    const s = createSklep();
    s.updates = 0;
    const rng = createRng(1);
    let l = makeListing(rng, 1, 3, 'bron', 0);
    s.stock = [l];
    const p = { gwiazdki: 100, inventory: [] as never[] };
    const res = buy(s, p, l.id, 5);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(totalOf(l.price));
    expect(res.fee).toBe(feeOf(l.price));
    expect(p.gwiazdki).toBe(100 - totalOf(l.price));
    expect(res.item).toBe(l.item);
    expect(res.item?.number).toBe(5);
    expect(res.lie).toBeUndefined();
    expect(res.note).toBeUndefined();
    // a second purchase of the same listing is refused
    expect(buy(s, p, l.id, 6).failure).toBe('sold');
    l = makeListing(rng, 2, 3, 'odziez', 0);
    s.stock = [l];
    expect(buy(s, { gwiazdki: 0, inventory: [] }, l.id, 1).failure).toBe('poor');
  });
});

describe('Sklep: the vendor lies', () => {
  it('lies about 1 in 6 listings', () => {
    const rng = createRng(606);
    let lies = 0;
    const n = 6000;
    const kinds = { wariant: 0, cena: 0 };
    for (let i = 0; i < n; i++) {
      const l = makeListing(rng, i, 2, 'bron', lieRate(0));
      if (l.lie) {
        lies++;
        kinds[l.lie]++;
      }
    }
    expect(lies / n).toBeGreaterThan(1 / 6 - 0.025);
    expect(lies / n).toBeLessThan(1 / 6 + 0.025);
    expect(kinds.wariant).toBeGreaterThan(n / 6 / 4);
    expect(kinds.cena).toBeGreaterThan(n / 6 / 4);
  });
  it('a wariant is the same base with a different roll; a price lie costs more', () => {
    const rng = createRng(9);
    let seenV = 0;
    let seenC = 0;
    for (let i = 0; i < 400; i++) {
      const l = makeListing(rng, i, 2, 'odziez', 1);
      expect(l.lie).toBeDefined();
      if (l.lie === 'wariant') {
        seenV++;
        expect(l.delivered.baseId).toBe(l.item.baseId);
        expect(l.delivered.variant).toBe(true);
        expect(l.delivered).not.toBe(l.item);
        expect(l.truePrice).toBe(l.price);
      } else {
        seenC++;
        expect(l.truePrice).toBeGreaterThan(l.price);
        expect(l.delivered).toBe(l.item);
      }
    }
    expect(seenV).toBeGreaterThan(0);
    expect(seenC).toBeGreaterThan(0);
  });
  it('reveals the lie after the purchase, charges the true price, never refunds', () => {
    const s = createSklep();
    const rng = createRng(3);
    const l = makeListing(rng, 1, 3, 'bron', 1);
    l.lie = 'cena';
    l.truePrice = l.price + 7;
    s.stock = [l];
    const p = { gwiazdki: 200, inventory: [] as never[] };
    const res = buy(s, p, 1, 1);
    expect(res.ok).toBe(true);
    expect(res.lie).toBe('cena');
    expect(res.total).toBe(totalOf(l.price + 7));
    expect(p.gwiazdki).toBe(200 - totalOf(l.price + 7));
    expect(res.note).toContain('Sprostowanie');
    expect(res.note).toContain('nie zwraca się');
  });
  it('an unaffordable true price is refused without saying why', () => {
    const s = createSklep();
    const l = makeListing(createRng(3), 1, 3, 'bron', 0);
    l.lie = 'cena';
    l.truePrice = l.price + 20;
    s.stock = [l];
    const p = { gwiazdki: totalOf(l.price), inventory: [] as never[] };
    const res = buy(s, p, 1, 1);
    expect(res.ok).toBe(false);
    expect(res.failure).toBe('poor');
    expect(p.gwiazdki).toBe(totalOf(l.price));
  });
  it('wariant note names both items', () => {
    const s = createSklep();
    const l = makeListing(createRng(40), 1, 3, 'bron', 1);
    l.lie = 'wariant';
    s.stock = [l];
    const res = buy(s, { gwiazdki: 999, inventory: [] }, 1, 1);
    expect(res.note).toContain(l.item.name);
    expect(res.note).toContain(l.delivered.name);
    expect(res.note).toContain('wariant');
  });
  it('after 3 reports the store updates, the stock is new and the lie rate changes', () => {
    const s = createSklep();
    restock(s, 1, 4, 2);
    const before = s.stock.map((l) => l.id);
    expect(lieRate(0)).toBeCloseTo(1 / 6);
    expect(reportProblem(s, 1, 2)).toEqual({ reports: 1, updated: false });
    expect(reportProblem(s, 1, 2)).toEqual({ reports: 2, updated: false });
    const r = reportProblem(s, 1, 2);
    expect(r.updated).toBe(true);
    expect(REPORTS_TO_UPDATE).toBe(3);
    expect(s.updates).toBe(1);
    expect(s.reports).toBe(0);
    expect(lieRate(1)).not.toBeCloseTo(lieRate(0));
    expect(LIE_RATES.length).toBeGreaterThan(1);
    expect(s.stock.map((l) => l.id)).not.toEqual(before);
  });
  it('stock is deterministic per seed and visit and has six items', () => {
    const a = createSklep();
    const b = createSklep();
    restock(a, 7, 2, 3);
    restock(b, 7, 2, 3);
    expect(a.stock).toEqual(b.stock);
    expect(a.stock).toHaveLength(6);
    const c = createSklep();
    restock(c, 7, 3, 3);
    expect(c.stock.map((l) => l.item.uid)).not.toEqual(a.stock.map((l) => l.item.uid));
    for (const l of a.stock) expect(l.item.tier).not.toBe('unikatowy');
  });
});

describe('office hours', () => {
  it('the base schedule serves, then hands over to the bot, and repeats', () => {
    expect(hoursAt(BASE_SCHEDULE, 0)).toEqual({ mode: 'open', remaining: 75 });
    expect(hoursAt(BASE_SCHEDULE, 74).mode).toBe('open');
    expect(hoursAt(BASE_SCHEDULE, 75)).toEqual({ mode: 'bot', remaining: 15 });
    expect(hoursAt(BASE_SCHEDULE, 90).mode).toBe('open');
    expect(hoursAt(BASE_SCHEDULE, 90 + 80).mode).toBe('bot');
  });
  it('the kiosk window opens late and lasts two minutes', () => {
    expect(hoursAt(KIOSK_SCHEDULE, 0).mode).toBe('bot');
    expect(hoursAt(KIOSK_SCHEDULE, 0).remaining).toBe(8);
    expect(hoursAt(KIOSK_SCHEDULE, 8).mode).toBe('open');
    expect(hoursAt(KIOSK_SCHEDULE, 127).mode).toBe('open');
    expect(hoursAt(KIOSK_SCHEDULE, 128).mode).toBe('bot');
  });
  it('the machine reports each change once', () => {
    const h = createHours({ cycle: 40, openFrom: 0, openFor: 30 });
    expect(h.tick(0)).toBeNull();
    expect(h.mode()).toBe('open');
    expect(h.tick(10)).toBeNull();
    expect(h.tick(30)).toEqual({ mode: 'bot', lasts: 10 });
    expect(h.tick(35)).toBeNull();
    expect(h.tick(40)).toEqual({ mode: 'open', lasts: 30 });
  });
  it('a clause can force the mode and hand it back', () => {
    const h = createHours({ cycle: 40, openFrom: 0, openFor: 30 });
    h.tick(0);
    h.force(false);
    expect(h.tick(5)?.mode).toBe('bot');
    expect(h.view(5).mode).toBe('bot');
    h.release();
    expect(h.tick(6)?.mode).toBe('open');
    h.setSchedule({ cycle: 10, openFrom: 5, openFor: 2 });
    expect(h.view(0).mode).toBe('bot');
  });
  it('the law setter overrides and releases', () => {
    expect(officeOverride()).toBeNull();
    setOfficeOpen(true);
    expect(officeOverride()).toBe(true);
    setOfficeOpen(false);
    expect(officeOverride()).toBe(false);
    setOfficeOpen(null);
    expect(officeOverride()).toBeNull();
  });
  it('the bot replies with scripted lines in turn', () => {
    expect(botLine(0)).toBe('Rozumiem. Czy chodzi o: a) fakturę, b) dostawę, c) inne?');
    expect(botLine(6)).toBe(botLine(0));
    expect(botLine(1)).not.toBe(botLine(0));
    expect(formatClock(65)).toBe('1:05');
    expect(t('economy.hours.bot', { time: '0:10' })).toContain('0:10');
  });
});

describe('Sklep stock rules (ITEMS 7.1)', () => {
  const stockOf = (seed: number, visit = 1, level = 12) => {
    const s = createSklep();
    restock(s, seed, visit, level);
    return s.stock;
  };
  it('six plates: three low in different slots, one rzadki, one oferta with a g3 line, one adapter', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const stock = stockOf(seed);
      expect(stock).toHaveLength(6);
      expect(stock.map((l) => l.kind)).toEqual(['plate', 'plate', 'plate', 'plate', 'oferta', 'adapter']);
      const low = stock.slice(0, 3);
      for (const l of low) expect(['zwykly', 'nietypowy']).toContain(l.item.tier);
      expect(new Set(low.map((l) => l.item.slot)).size).toBe(3);
      expect(stock[3]?.item.tier).toBe('rzadki');
      expect(stock[4]?.item.tier).toBe('rzadki');
      expect(stock.every((l) => l.item.tier !== 'unikatowy')).toBe(true);
      expect(stock[5]?.item.adapter).toBe(true);
    }
  });
  it('the oferta carries a grade 3 affix in nearly every stock', () => {
    let g3 = 0;
    for (let seed = 1; seed <= 60; seed++) if (stockOf(seed)[4]?.item.affixes.some((a) => AFFIXES_BY_ID.get(a)?.grade === 3)) g3++;
    expect(g3).toBeGreaterThanOrEqual(57);
  });
  it('stock sits at the band level and prices follow price1 * (1 + 0.1 ilvl) * tier', () => {
    for (const l of stockOf(5, 1, 22)) {
      expect(l.item.level).toBe(22);
      if (l.kind !== 'adapter') expect(l.price).toBe(itemValue(l.item));
    }
    expect(listPrice(10, 22, 'rzadki')).toBe(Math.round(10 * 3.2 * 6));
  });
  it('the vendor lies about 1 in 6 at first, and after an update 1 in 4 or 1 in 10', () => {
    let lies = 0;
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      for (const l of stockOf(seed, 1)) {
        n++;
        if (l.lie) lies++;
      }
    }
    expect(lies / n).toBeGreaterThan(0.13);
    expect(lies / n).toBeLessThan(0.2);
    const seen = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) seen.add(lieRate(1, seed));
    expect([...seen].sort()).toEqual([...UPDATED_LIE_RATES].sort());
    expect(lieRate(1, 9)).toBe(lieRate(1, 9));
    expect(LIE_RATES[0]).toBeCloseTo(1 / 6);
  });
});
