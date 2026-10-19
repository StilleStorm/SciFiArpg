import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { t } from '../i18n';
import { toCharacter, emptyCharacter, serializeCharacter, applyCharacter } from '../save/character';
import { spawnWave } from '../enemies/spawn';
import { LAWS } from './laws';
import { createRun } from './run';
import { ticketForPlan } from './ticket';
import {
  ALL_LAWS,
  PLANETS,
  PLANET_COUNT,
  PRIORITIES,
  PRIORITY_IDS,
  availablePriorities,
  bindCampaign,
  clampPriority,
  closeTicket,
  enemyScaleFor,
  extraPlan,
  ilvlBase,
  lawForPlanet,
  newCampaign,
  nextCampaignPlan,
  settleCampaign,
  toCampaign,
  travelList,
  travelPlan,
  type CampaignState,
  type TicketPlan,
} from './campaign';

const lawIds = new Set(LAWS.map((l) => l.id));

function playThrough(): CampaignState {
  let c = newCampaign();
  for (let i = 0; i < PLANET_COUNT; i++) {
    const plan = nextCampaignPlan(c, 'normalny', i + 1);
    if (!plan) throw new Error('no plan');
    c = closeTicket(c, plan).campaign;
  }
  return c;
}

describe('planet data', () => {
  it('has nine planets, three per act, with sane fields', () => {
    expect(PLANETS).toHaveLength(9);
    PLANETS.forEach((p, i) => {
      expect(p.index).toBe(i);
      expect(p.act).toBe(Math.floor(i / 3) + 1);
      expect(Object.values(p.mix).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
      expect(p.mix[p.dominant]).toBeGreaterThanOrEqual(0.5);
      expect(p.lawPool.length).toBeGreaterThanOrEqual(3);
      for (const l of p.lawPool) expect(lawIds.has(l)).toBe(true);
      expect(p.locations.length).toBeGreaterThanOrEqual(2);
      expect(p.locations.length).toBeLessThanOrEqual(3);
      expect(p.pages[0]).toBeLessThanOrEqual(p.pages[1]);
      expect(t(p.nameKey)).toMatch(/^Planeta .+ \(.+\)$/);
      expect(t(p.locKey)).toMatch(/^Planecie /);
    });
    expect(new Set(PLANETS.map((p) => t(p.nameKey))).size).toBe(9);
    expect(ALL_LAWS.length).toBe(9);
  });

  it('puts the families in the order of the acts', () => {
    expect(PLANETS.slice(0, 3).every((p) => p.dominant === 'urzadzenia')).toBe(true);
    expect(PLANETS.slice(3, 6).every((p) => p.dominant === 'powiadomienia')).toBe(true);
    expect(PLANETS.slice(6).every((p) => p.dominant === 'wygenerowane')).toBe(true);
  });

  it('item level base follows ITEMS 5.1', () => {
    expect(ilvlBase(0)).toBe(1);
    expect(ilvlBase(4)).toBe(21);
  });
});

describe('priority', () => {
  it('unlocks by level and rises in every column', () => {
    expect(availablePriorities(1)).toEqual(['niski', 'normalny']);
    expect(availablePriorities(8)).toContain('wysoki');
    expect(availablePriorities(40)).toEqual([...PRIORITY_IDS]);
    expect(clampPriority('krytyczny', 3)).toBe('normalny');
    expect(clampPriority('wysoki', 30)).toBe('wysoki');
    const rows = PRIORITY_IDS.map((id) => PRIORITIES[id]);
    for (const key of ['unlockLevel', 'hp', 'dmg', 'tierShift', 'eliteMul', 'xp', 'stars', 'lootTier', 'ilvl'] as const) {
      for (let i = 1; i < rows.length; i++) expect(rows[i]?.[key] ?? 0).toBeGreaterThanOrEqual(rows[i - 1]?.[key] ?? 0);
    }
    expect(PRIORITIES.normalny.hp).toBe(1);
    expect(PRIORITIES.normalny.ilvl).toBe(0);
  });

  it('scales enemies with planet and priority, and is neutral at planet 1 Normalny', () => {
    const base = enemyScaleFor(0, 'normalny');
    expect(base).toEqual({ hp: 1, dmg: 1, tierOffset: 0, eliteMul: 1 });
    expect(enemyScaleFor(8, 'normalny').hp).toBeGreaterThan(enemyScaleFor(0, 'normalny').hp);
    expect(enemyScaleFor(3, 'krytyczny').tierOffset).toBe(2);
    expect(enemyScaleFor(0, 'niski').hp).toBeLessThan(1);
  });

  it('every priority has its words', () => {
    for (const id of PRIORITY_IDS) {
      expect(t(PRIORITIES[id].nameKey)).not.toBe(PRIORITIES[id].nameKey);
      expect(t(PRIORITIES[id].hintKey)).not.toBe(PRIORITIES[id].hintKey);
    }
  });
});

describe('progression', () => {
  it('the next ticket is the next planet, then the return ticket, then the case is closed', () => {
    let c = newCampaign();
    for (let i = 0; i < PLANET_COUNT; i++) {
      const plan = nextCampaignPlan(c, 'normalny', 7);
      expect(plan).toMatchObject({ kind: 'campaign', planet: i });
      expect(PLANETS[i]?.lawPool).toContain(plan?.lawId);
      const out = closeTicket(c, plan as TicketPlan);
      expect(out.advanced?.from).toBe(i);
      expect(out.advanced?.finale).toBe(i === 8);
      c = out.campaign;
    }
    expect(c.closed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(c.finalTicket).toBe(true);
    expect(c.caseClosed).toBe(false);
    const final = nextCampaignPlan(c, 'wysoki', 3);
    expect(final).toMatchObject({ kind: 'final', planet: 0, priority: 'wysoki' });
    const done = closeTicket(c, final as TicketPlan);
    expect(done.caseClosed).toBe(true);
    expect(done.campaign).toMatchObject({ finalTicket: false, caseClosed: true });
    expect(nextCampaignPlan(done.campaign, 'normalny', 1)).toBeNull();
  });

  it('ignores a ticket for a planet that is not the current one, and never mutates', () => {
    const c = newCampaign();
    const before = JSON.stringify(c);
    const out = closeTicket(c, { kind: 'campaign', planet: 4, priority: 'normalny', lawId: 'ciasteczka' });
    expect(out.advanced).toBeNull();
    expect(out.campaign.closed).toEqual([]);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('extras and free travel open only after the case', () => {
    expect(extraPlan(newCampaign(), 'normalny', 5)).toBeNull();
    expect(travelList(newCampaign())).toEqual([]);
    expect(travelPlan(newCampaign(), 2, 'normalny', 1)).toBeNull();
    const c = closeTicket(playThrough(), { kind: 'final', planet: 0, priority: 'normalny', lawId: 'ciasteczka' }).campaign;
    expect(travelList(c)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(travelPlan(c, 5, 'krytyczny', 9)).toMatchObject({ kind: 'travel', planet: 5, priority: 'krytyczny' });
    const seen = new Set<number>();
    for (let seed = 1; seed < 80; seed++) {
      const e = extraPlan(c, 'normalny', seed);
      expect(e).toEqual(extraPlan(c, 'normalny', seed));
      expect(e?.kind).toBe('extra');
      expect(lawIds.has(e?.lawId ?? ('x' as never))).toBe(true);
      seen.add(e?.planet ?? -1);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
    expect(closeTicket(c, extraPlan(c, 'normalny', 3) as TicketPlan).campaign.extras).toBe(1);
    expect(closeTicket(c, travelPlan(c, 1, 'normalny', 3) as TicketPlan).campaign.extras).toBe(0);
  });

  it('the clause of a plan is a pure pick from the planet pool', () => {
    for (let seed = 1; seed < 30; seed++) expect(PLANETS[3]?.lawPool).toContain(lawForPlanet(3, seed));
    expect(lawForPlanet(2, 11)).toBe(lawForPlanet(2, 11));
  });
});

describe('events', () => {
  it('settleCampaign emits once per plan, and only for a completed run', () => {
    const bus = createBus();
    const seen: string[] = [];
    bus.on('campaign:advanced', (p) => seen.push(`adv ${p.from}>${p.to}${p.finale ? ' finale' : ''}`));
    bus.on('case:closed', () => seen.push('case'));
    const host: { plan: TicketPlan; campaign?: CampaignState } = { plan: { kind: 'campaign', planet: 0, priority: 'normalny', lawId: 'ciasteczka' } };
    expect(settleCampaign(host, bus, 'zgloszenie')).toBeNull();
    expect(settleCampaign(host, bus, 'ukonczono')).not.toBeNull();
    expect(settleCampaign(host, bus, 'ukonczono')).toBeNull();
    expect(host.campaign?.current).toBe(1);
    const last: { plan: TicketPlan; campaign: CampaignState } = {
      plan: { kind: 'campaign', planet: 8, priority: 'normalny', lawId: 'czas-wsteczny' },
      campaign: { ...newCampaign(), current: 8, closed: [0, 1, 2, 3, 4, 5, 6, 7] },
    };
    settleCampaign(last, bus, 'ukonczono');
    const fin: { plan: TicketPlan; campaign: CampaignState } = { plan: { kind: 'final', planet: 0, priority: 'normalny', lawId: 'ciasteczka' }, campaign: last.campaign };
    settleCampaign(fin, bus, 'ukonczono');
    expect(seen).toEqual(['adv 0>1', 'adv 8>0 finale', 'case']);
  });

  it('bindCampaign listens to run:ended', () => {
    const bus = createBus();
    const host: { plan: TicketPlan; campaign?: CampaignState } = { plan: { kind: 'campaign', planet: 0, priority: 'normalny', lawId: 'ciasteczka' } };
    bindCampaign(bus, () => host);
    bus.emit('run:ended', { outcome: 'ukonczono' });
    expect(host.campaign?.closed).toEqual([0]);
  });
});

describe('save', () => {
  it('toCampaign repairs damage and drops nonsense', () => {
    expect(toCampaign(null)).toEqual(newCampaign());
    expect(toCampaign({ current: 99, closed: [0, 0, 3, 'x', 12], finalTicket: 'yes', caseClosed: false, extras: -4 })).toEqual({
      current: 8,
      closed: [0, 3],
      finalTicket: false,
      caseClosed: false,
      extras: 0,
    });
  });

  it('the campaign goes through the character record both ways', () => {
    const camp: CampaignState = { current: 3, closed: [0, 1, 2], finalTicket: false, caseClosed: false, extras: 0 };
    const rec = toCharacter({ ...emptyCharacter('pralka' as never), campaign: camp });
    expect(rec?.campaign).toEqual(camp);
    expect(toCharacter(emptyCharacter())?.campaign).toBeUndefined();
    const s = createRun(4, { character: rec ?? undefined });
    expect(s.campaign).toEqual(camp);
    expect(serializeCharacter(s).campaign).toEqual(camp);
    const fresh = createRun(4);
    applyCharacter(fresh, emptyCharacter());
    expect(serializeCharacter(fresh).campaign).toBeUndefined();
  });
});

describe('ticket and run from a plan', () => {
  const plan = (planet: number, priority: TicketPlan['priority']): TicketPlan => ({ kind: 'campaign', planet, priority, lawId: lawForPlanet(planet, 5) });

  it('ticketForPlan takes planet, clause and family from the plan', () => {
    for (let i = 0; i < PLANET_COUNT; i++) {
      const p = plan(i, 'normalny');
      const tk = ticketForPlan(9, p, 50000);
      expect(tk).toEqual(ticketForPlan(9, p, 50000));
      expect(tk.number).toBe(50000);
      expect(tk.lawId).toBe(p.lawId);
      expect(tk.family).toBe(PLANETS[i]?.dominant);
      expect(tk.planet).toBe(t(PLANETS[i]?.nameKey ?? ''));
      expect(tk.pageCount).toBeGreaterThanOrEqual(PLANETS[i]?.pages[0] ?? 99);
      expect(tk.pageCount).toBeLessThanOrEqual(PLANETS[i]?.pages[1] ?? 0);
    }
  });

  it('createRun with a plan carries it and the planet mix', () => {
    const s = createRun(3, { plan: plan(4, 'wysoki') });
    expect(s.plan).toMatchObject({ planet: 4, priority: 'wysoki' });
    expect(s.mix?.dominant).toBe('powiadomienia');
    expect(s.ticket.family).toBe('powiadomienia');
    expect(createRun(3).plan).toBeUndefined();
  });

  it('enemies grow with the priority and the planet, and a run without a plan is untouched', () => {
    const hpAt = (opts: Parameters<typeof createRun>[1]): number => {
      const s = createRun(21, opts);
      s.pageIndex = 2;
      const got = spawnWave(s, 'urzadzenia', 1, { x: s.page.w / 2, y: s.page.h / 2 }, { minPlayer: 0 });
      return got[0]?.hpMax ?? 0;
    };
    const plain = hpAt({});
    const normal1 = hpAt({ plan: { kind: 'campaign', planet: 0, priority: 'normalny', lawId: 'ciasteczka' } });
    const niski = hpAt({ plan: { kind: 'campaign', planet: 0, priority: 'niski', lawId: 'ciasteczka' } });
    const krytyczny = hpAt({ plan: { kind: 'campaign', planet: 0, priority: 'krytyczny', lawId: 'ciasteczka' } });
    const late = hpAt({ plan: { kind: 'campaign', planet: 7, priority: 'normalny', lawId: 'czas-wsteczny' } });
    expect(normal1).toBe(plain);
    expect(niski).toBeLessThan(normal1);
    expect(krytyczny).toBeGreaterThan(normal1 * 2);
    expect(late).toBeGreaterThan(normal1 * 2);
  });
});
