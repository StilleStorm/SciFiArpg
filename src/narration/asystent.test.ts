import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { CORRECTION_DELAY_S, IDLE_S, WRONG_CHANCE, bindAsystent, createNarrator, hasNote, poolSize } from './asystent';

/** An rng whose `chance` always answers `yes`; everything else is the real generator. */
function rigged(seed: number, yes: boolean): Rng {
  const base = createRng(seed);
  return { ...base, chance: () => yes };
}

const keys = [
  'start', 'clause', 'kill_urzadzenia', 'kill_powiadomienia', 'kill_wygenerowane', 'kill_other', 'pickup', 'page', 'edge', 'idle',
  'idle_base', 'levelup', 'death', 'law_hours_bot', 'law_hours_consultant', 'law_reverse_start', 'law_noise',
];

describe('templates', () => {
  it('has at least 40 lines, and every wrong note has a correction that names the footnote', () => {
    let lines = 0;
    for (const k of keys) {
      expect(hasNote(k)).toBe(true);
      lines += poolSize(k, 'ok') + poolSize(k, 'bad') + poolSize(k, 'fix');
      expect(poolSize(k, 'bad')).toBe(poolSize(k, 'fix'));
    }
    expect(lines).toBeGreaterThanOrEqual(40);
    expect(1 / 8).toBe(WRONG_CHANCE);
  });
});

describe('createNarrator', () => {
  it('numbers continuously and speaks the right note when it is not wrong', () => {
    const said: string[] = [];
    let n = 0;
    const nar = createNarrator(rigged(1, false), (text) => (said.push(text), ++n));
    expect(nar.note('start', { number: 48213 })).toBe(1);
    nar.tick(3);
    expect(nar.note('pickup', { n: 7 })).toBe(2);
    expect(nar.note('no_such_key')).toBe(0);
    expect(said[1]).toContain('7');
    expect(nar.pending).toBe(0);
  });

  it('is wrong about 1 in 8 times and then corrects itself 10-20 s later, naming the wrong note', () => {
    const said: { n: number; text: string }[] = [];
    let n = 0;
    const nar = createNarrator(rigged(2, true), (text) => {
      said.push({ n: ++n, text });
      return n;
    });
    nar.note('start', { number: 1 });
    nar.tick(3);
    const wrong = nar.note('kill_urzadzenia', { n: 4471 });
    expect(wrong).toBe(2);
    expect(said[1]?.text).toContain('niedźwiedzia');
    expect(nar.pending).toBe(1);
    nar.tick(CORRECTION_DELAY_S[0] - 0.5);
    expect(said).toHaveLength(2);
    nar.tick(CORRECTION_DELAY_S[1] - CORRECTION_DELAY_S[0] + 0.6);
    expect(said).toHaveLength(3);
    expect(said[2]?.text).toContain('Przepraszam za nieścisłość w\u00a0przypisie 2.');
    expect(said[2]?.text).toContain('4471');
    expect(said[2]?.n).toBe(3);
    expect(nar.pending).toBe(0);
  });

  it('wrong numbers differ from the real ones', () => {
    const said: string[] = [];
    const nar = createNarrator(rigged(3, true), (text) => (said.push(text), said.length));
    nar.note('pickup', { n: 12 });
    expect(said[0]).toMatch(/nr \d+\./);
    expect(said[0]).not.toContain('nr 12.');
    nar.tick(25);
    expect(said[1]).toContain('Przepraszam za nieścisłość w\u00a0przypisie 1');
    expect(said[1]).toContain('12');
  });

  it('is wrong roughly one time in eight over many notes', () => {
    let wrong = 0;
    const total = 800;
    const rng = createRng(11);
    const nar = createNarrator(rng, () => 1);
    for (let i = 0; i < total; i++) {
      nar.tick(30);
      const before = nar.pending;
      nar.note('pickup', { n: i + 1 });
      if (nar.pending > before) wrong++;
    }
    expect(wrong / total).toBeGreaterThan(0.08);
    expect(wrong / total).toBeLessThan(0.17);
  });

  it('drops low-priority notes that come right after another note', () => {
    let n = 0;
    const nar = createNarrator(rigged(4, false), () => ++n);
    nar.note('start', { number: 1 });
    expect(nar.note('pickup', { n: 1 })).toBe(0);
    nar.tick(2.5);
    expect(nar.note('pickup', { n: 2 })).toBeGreaterThan(0);
  });
});

describe('bindAsystent', () => {
  it('starts a fresh numbering narrator per run, speaks the first death per family once, and nags after 40 s', () => {
    const bus = createBus();
    const said: string[] = [];
    const a = bindAsystent(bus, { say: (t) => (said.push(t), said.length), getState: () => null });
    bus.emit('run:started', { seed: 5 });
    const afterStart = said.length;
    expect(afterStart).toBeGreaterThanOrEqual(1);
    bus.emit('enemy:died', { id: 1, x: 0, y: 0, family: 'urzadzenia' });
    bus.emit('enemy:died', { id: 2, x: 0, y: 0, family: 'urzadzenia' });
    expect(said.length).toBe(afterStart + 1);
    bus.emit('enemy:died', { id: 3, x: 0, y: 0, family: 'wygenerowane' });
    expect(said.length).toBe(afterStart + 2);
    for (let i = 0; i < IDLE_S + 1; i++) a.tick(1);
    expect(said.length).toBeGreaterThan(afterStart + 2);
  });

  it('answers page entry, level up, law triggers and death', () => {
    const bus = createBus();
    const said: string[] = [];
    bindAsystent(bus, { say: (t) => (said.push(t), said.length), getState: () => null });
    bus.emit('run:started', { seed: 77 });
    const base = said.length;
    bus.emit('page:entered', { index: 0, count: 5 });
    expect(said.length).toBe(base);
    bus.emit('page:entered', { index: 1, count: 5 });
    bus.emit('player:levelup', { level: 3 });
    bus.emit('law:trigger', { law: 'godziny-konsultanta', kind: 'hours:bot' });
    bus.emit('law:trigger', { law: 'ciasteczka', kind: 'cookies:all' });
    bus.emit('player:died', { x: 0, y: 0 });
    expect(said.length).toBe(base + 4);
  });

  it('keeps one narrator per ticket from the base page through the run, and starts again for another ticket', () => {
    const bus = createBus();
    const said: string[] = [];
    let phase: 'base' | 'run' = 'base';
    const state = { phase, ticket: { number: 48213, lawId: 'parzystosc' } };
    const a = bindAsystent(bus, { say: (t) => (said.push(t), said.length), getState: () => ({ ...state, phase }) as never });
    bus.emit('base:entered', { layout: 'wioska', seed: 9, number: 48213 });
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^Wioska/); // the arrival note of the place
    // in the base the idle note is the base's own: never the "40 s without a kill" line
    for (let i = 0; i < IDLE_S + 1; i++) a.tick(1);
    expect(said).toHaveLength(2);
    expect(said[1]).not.toMatch(/skreślono/);
    // the exit is walked through: the same narrator goes on (its rng is not re-seeded, so a repeat of the whole sequence differs)
    phase = 'run';
    bus.emit('run:started', { seed: 9 });
    const inRun = said.length;
    expect(inRun).toBeGreaterThanOrEqual(2);
    // the base of the held run (the tunnel) is the same ticket: nothing is said, not even the arrival, nothing starts again
    bus.emit('base:entered', { layout: 'wioska', seed: 9, number: 48213 });
    expect(said).toHaveLength(inRun);
    // another ticket: a fresh narrator with its arrival note, and the base idle line again after 40 s
    phase = 'base';
    bus.emit('base:entered', { layout: 'ladowisko', seed: 10, number: 48214 });
    expect(said[inRun]).toMatch(/^Lądowisko/);
    for (let i = 0; i < IDLE_S + 1; i++) a.tick(1);
    expect(said.length).toBe(inRun + 2);
    expect(said[inRun + 1]).not.toMatch(/skreślono/);
  });

  it('the same planet narrates the same way from a fresh base, whatever came before', () => {
    const run = (before: boolean): string[] => {
      const bus = createBus();
      const said: string[] = [];
      const a = bindAsystent(bus, { say: (t) => (said.push(t), said.length), getState: () => ({ phase: 'run', ticket: { number: 2, lawId: 'parzystosc' } }) as never });
      if (before) {
        bus.emit('base:entered', { layout: 'wioska', seed: 3, number: 1 });
        bus.emit('run:started', { seed: 3 });
        for (let i = 0; i < 200; i++) a.tick(1);
      }
      bus.emit('base:entered', { layout: 'wioska', seed: 4, number: 2 });
      const from = said.length;
      bus.emit('run:started', { seed: 4 });
      for (let i = 0; i < 200; i++) a.tick(1);
      return said.slice(from);
    };
    expect(run(true)).toEqual(run(false));
  });
});

