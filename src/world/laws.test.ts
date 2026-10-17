import { describe, expect, it } from 'vitest';
import { createBus, type Bus, type GameEvents } from '../core/events';
import {
  BOT_REPLY_GAP_S,
  HOURS,
  LAWS,
  OFFICE_OPENS_AFTER_S,
  acceptUpdate,
  aggroMul,
  answerCookies,
  applyLaw,
  bindLaws,
  botReply,
  canLeave,
  hoursPhase,
  lawHooks,
  lawPre,
  lunchBreak,
  neutralLaw,
  officeIsOpen,
  onPageEntered,
  submitCode,
  tickLaw,
  type LawId,
} from './laws';
import { createRun, type RunState } from './run';

function run(lawId: LawId, seed = 5): RunState {
  return createRun(seed, { lawId });
}

/** Collect every event of the given names. */
function spy(bus: Bus, names: (keyof GameEvents)[]): { name: string; payload: unknown }[] {
  const out: { name: string; payload: unknown }[] = [];
  for (const n of names) bus.on(n, ((p: unknown) => out.push({ name: n, payload: p })) as never);
  return out;
}

const step = (s: RunState, bus: Bus, seconds: number, dt = 0.05): void => {
  for (let t = 0; t < seconds; t += dt) {
    s.time += dt;
    tickLaw(s, bus, dt);
  }
};

describe('applyLaw', () => {
  it('has the nine clauses and starts neutral', () => {
    expect(LAWS).toHaveLength(9);
    const n = neutralLaw();
    expect(n.id).toBeNull();
    expect(n.speedMul).toBe(1);
    expect(n.weaponDamageMul).toBe(1);
    expect(n.killCost).toBe(0);
  });

  it('sets the modifiers of each clause and resets the previous one', () => {
    const s = run('parzystosc');
    expect(s.law.spawnPairs && s.law.lootPairs).toBe(true);
    applyLaw(s, 'grawitacja');
    expect(s.law.spawnPairs).toBe(false);
    expect(s.law.speedMul).toBeCloseTo(1.3);
    expect(s.law.knockbackMul).toBe(3);
    expect(s.law.enemyDrift).toBe(true);
    applyLaw(s, 'godziny-konsultanta');
    expect(s.law.hours).toEqual(HOURS);
    applyLaw(s, 'czas-wsteczny');
    expect(s.law.reverseAfter).toBe(300);
    applyLaw(s, 'wymagana-aktualizacja');
    expect(s.law.weaponNeedsUpdate).toBe(true);
    expect(s.law.weaponDamageMul).toBe(0.5);
    applyLaw(s, 'nie-przeszkadzac');
    expect(s.law.noiseAggroMul).toBe(2);
    applyLaw(s, 'oplata-serwisowa');
    expect(s.law.killCost).toBe(1);
    expect(s.law.lootTierBonus).toBe(1);
    applyLaw(s, 'ciasteczka');
    expect(s.law.cookies).toBe(true);
    applyLaw(s, 'weryfikacja-dwuetapowa');
    expect(s.law.twoFactorExit).toBe(true);
    expect(s.lawId).toBe('weryfikacja-dwuetapowa');
  });

  it('is chosen from the seed and can be overridden', () => {
    const ids = new Set<string>();
    for (let seed = 1; seed < 80; seed++) ids.add(createRun(seed).law.id ?? '');
    expect(ids.size).toBeGreaterThanOrEqual(7);
    expect(createRun(3).law.id).toBe(createRun(3).law.id);
    expect(run('nie-przeszkadzac', 3).law.id).toBe('nie-przeszkadzac');
  });
});

describe('Godziny konsultanta', () => {
  it('cycles 30 s consultant, 10 s bot every 40 s', () => {
    expect(hoursPhase(HOURS, 0)).toBe('consultant');
    expect(hoursPhase(HOURS, 29.9)).toBe('consultant');
    expect(hoursPhase(HOURS, 30)).toBe('bot');
    expect(hoursPhase(HOURS, 39.9)).toBe('bot');
    expect(hoursPhase(HOURS, 40)).toBe('consultant');
    expect(hoursPhase(HOURS, 70.5)).toBe('bot');
  });

  it('flips botTime in tickLaw and announces both changes', () => {
    const s = run('godziny-konsultanta');
    const bus = createBus();
    const seen = spy(bus, ['law:trigger']);
    step(s, bus, 29);
    expect(s.law.botTime).toBe(false);
    step(s, bus, 2);
    expect(s.law.botTime).toBe(true);
    step(s, bus, 10);
    expect(s.law.botTime).toBe(false);
    expect(seen.map((e) => (e.payload as { kind: string }).kind)).toEqual(['hours:bot', 'hours:consultant']);
  });

  it('answers actions with a scripted line, at most one per 3 s, only in bot time', () => {
    const s = run('godziny-konsultanta');
    s.time = 5;
    expect(botReply(s)).toBeNull();
    s.law.botTime = true;
    s.time = 31;
    const first = botReply(s);
    expect(first).toContain('fakturę');
    s.time += BOT_REPLY_GAP_S - 0.5;
    expect(botReply(s)).toBeNull();
    s.time += 0.6;
    const second = botReply(s);
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('replies through the bus when the player acts during bot hours', () => {
    const s = run('godziny-konsultanta');
    const bus = createBus();
    bindLaws(bus, () => s);
    const notes = spy(bus, ['footnote']);
    s.law.botTime = true;
    s.time = 33;
    bus.emit('skill:1');
    bus.emit('skill:2'); // inside the 3 s gap
    expect(notes).toHaveLength(1);
    s.law.botTime = false;
    s.time = 60;
    bus.emit('skill:3');
    expect(notes).toHaveLength(1);
  });

  it('opens the kiosk only during the lunch break, on the kiosk page', () => {
    const s = run('godziny-konsultanta');
    expect(lunchBreak(HOURS, HOURS.lunchFromS)).toBe(true);
    expect(lunchBreak(HOURS, HOURS.lunchToS)).toBe(false);
    expect(officeIsOpen(s.law, 15)).toBe(true);
    expect(officeIsOpen(s.law, 5)).toBe(false);
    const bus = createBus();
    const changes: boolean[] = [];
    lawHooks.officeChanged = (open) => changes.push(open);
    s.page.hasKiosk = true;
    step(s, bus, 25);
    expect(changes).toEqual([true, false]);
    lawHooks.officeChanged = undefined;
  });

  it('uses a two-minute window after entering the kiosk page when no clause decides', () => {
    const s = run('parzystosc');
    s.page.hasKiosk = true;
    s.time = 100;
    onPageEntered(s, createBus());
    expect(s.law.officeFrom).toBe(100 + OFFICE_OPENS_AFTER_S);
    expect(officeIsOpen(s.law, 100 + 5)).toBe(false);
    expect(officeIsOpen(s.law, 100 + OFFICE_OPENS_AFTER_S + 60)).toBe(true);
    expect(officeIsOpen(s.law, 100 + OFFICE_OPENS_AFTER_S + 121)).toBe(false);
  });
});

describe('Czas wsteczny', () => {
  it('reverses time after five minutes and walks chasing enemies away', () => {
    const s = run('czas-wsteczny');
    const bus = createBus();
    const seen = spy(bus, ['law:trigger']);
    step(s, bus, 299);
    expect(s.law.reversed).toBe(false);
    step(s, bus, 2);
    expect(s.law.reversed).toBe(true);
    expect(seen.some((e) => (e.payload as { kind: string }).kind === 'reverse:start')).toBe(true);
  });
});

describe('Wymagana aktualizacja', () => {
  it('halves the weapon for the step only and restores it exactly', () => {
    const s = run('wymagana-aktualizacja');
    const min = s.player.stats.dmgMin;
    const max = s.player.stats.dmgMax;
    const undo = lawPre(s);
    expect(s.player.stats.dmgMin).toBeCloseTo(min * 0.5);
    expect(s.player.stats.dmgMax).toBeCloseTo(max * 0.5);
    undo();
    expect(s.player.stats.dmgMin).toBe(min);
    expect(s.player.stats.dmgMax).toBe(max);
  });

  it('is cured by accepting, which installs a feature or a 5% slowdown, with a "Nowość!" note', () => {
    const s = run('wymagana-aktualizacja');
    const bus = createBus();
    const notes = spy(bus, ['footnote']);
    acceptUpdate(s, bus);
    expect(s.law.weaponNeedsUpdate).toBe(false);
    expect(s.law.weaponDamageMul).toBe(1);
    expect(s.law.speedMul).toBeCloseTo(0.95);
    expect(JSON.stringify(notes)).toContain('Nowość!');

    const s2 = run('wymagana-aktualizacja');
    lawHooks.unwantedFeature = () => 'Nowość! Konto założono w Twoim imieniu.';
    const notes2 = spy(bus, ['footnote']);
    acceptUpdate(s2, bus);
    lawHooks.unwantedFeature = undefined;
    expect(s2.law.speedMul).toBe(1);
    expect(JSON.stringify(notes2)).toContain('Konto założono');
  });

  it('offers the update when the first elite dies, and by page three at the latest', () => {
    const s = run('wymagana-aktualizacja');
    const bus = createBus();
    bindLaws(bus, () => s);
    bus.emit('enemy:died', { id: 99, x: 0, y: 0, tier: 'common' });
    expect(s.modal).toBeNull();
    bus.emit('enemy:died', { id: 100, x: 0, y: 0, tier: 'elite' });
    expect(s.modal).toBe('update');
    s.modal = null;

    const late = run('wymagana-aktualizacja');
    late.pageIndex = 2;
    onPageEntered(late, createBus());
    expect(late.modal).toBe('update');
  });
});

describe('Nie przeszkadzac, Opłata serwisowa, Grawitacja', () => {
  it('doubles the aggro radius for a few seconds after a skill', () => {
    const s = run('nie-przeszkadzac');
    const bus = createBus();
    bindLaws(bus, () => s);
    s.time = 10;
    expect(aggroMul(s)).toBe(1);
    bus.emit('skill:2');
    expect(aggroMul(s)).toBe(2);
    s.time = 20;
    expect(aggroMul(s)).toBe(1);
    expect(aggroMul(run('parzystosc'))).toBe(1);
  });

  it('charges one gwiazdka per kill and never below zero', () => {
    const s = run('oplata-serwisowa');
    const bus = createBus();
    bindLaws(bus, () => s);
    s.player.gwiazdki = 2;
    bus.emit('enemy:died', { id: 1, x: 0, y: 0 });
    bus.emit('enemy:died', { id: 2, x: 0, y: 0 });
    bus.emit('enemy:died', { id: 3, x: 0, y: 0 });
    expect(s.player.gwiazdki).toBe(0);
  });

  it('speeds the player up by 30% for the step and drifts enemies', () => {
    const s = run('grawitacja');
    const speed = s.player.speed;
    const undo = lawPre(s);
    expect(s.player.speed).toBeCloseTo(speed * 1.3);
    undo();
    expect(s.player.speed).toBe(speed);
  });
});

describe('Ciasteczka', () => {
  it('asks on page entry and applies the answer', () => {
    const s = run('ciasteczka');
    const bus = createBus();
    const asks = spy(bus, ['law:ask']);
    onPageEntered(s, bus);
    expect(s.modal).toBe('cookies');
    expect(asks).toHaveLength(1);
    answerCookies(s, bus, 'all');
    expect(s.modal).toBeNull();
    expect(s.law.extraElites).toBe(1);
    expect(s.law.enemyCountMul).toBeGreaterThan(1);
    answerCookies(s, bus, 'minimal');
    expect(s.law.extraElites).toBe(0);
    expect(s.law.enemyCountMul).toBeLessThan(1);
    expect(s.law.lootMul).toBeLessThan(1);
  });

  it('shows the banner again after 30 s of standing still', () => {
    const s = run('ciasteczka');
    const bus = createBus();
    onPageEntered(s, bus);
    answerCookies(s, bus, 'all');
    step(s, bus, 29);
    expect(s.modal).toBeNull();
    step(s, bus, 2);
    expect(s.modal).toBe('cookies');
  });
});

describe('Weryfikacja dwuetapowa', () => {
  it('delivers the code 6-12 s after it is requested, then the exit opens', () => {
    const s = run('weryfikacja-dwuetapowa');
    const bus = createBus();
    const notes = spy(bus, ['footnote']);
    expect(canLeave(s, bus)).toBe(false);
    const due = s.law.codeAt ?? 0;
    expect(due - s.time).toBeGreaterThanOrEqual(6);
    expect(due - s.time).toBeLessThanOrEqual(12);
    expect(canLeave(s, bus)).toBe(false);
    expect(notes).toHaveLength(1); // requested once
    step(s, bus, 5);
    expect(s.law.code).toBeNull();
    step(s, bus, 8);
    expect(s.law.code).toMatch(/^\d{6}$/);
    expect(s.modal).toBe('code');
    expect(JSON.stringify(notes)).toContain('SMS');
    submitCode(s, bus);
    expect(s.modal).toBeNull();
    expect(canLeave(s, bus)).toBe(true);
    // the next page asks again
    onPageEntered(s, bus);
    expect(s.law.exitUnlocked).toBe(false);
  });

  it('lets everyone else leave at once', () => {
    expect(canLeave(run('parzystosc'), createBus())).toBe(true);
  });
});
