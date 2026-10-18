import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBus } from '../core/events';
import { createEnemy, createPickup } from '../entities/factory';
import { createRng } from '../core/rng';
import { rollItem } from '../items/generate';
import { createRun, type RunState } from '../world/run';

const played: { name: string; opts: unknown }[] = [];
const control = { throwOnPlay: false };
const duck = vi.fn();
const music = { startMusic: vi.fn(), stopMusic: vi.fn(), tickMusic: vi.fn(), musicPhase: vi.fn(), musicTurn: vi.fn() };

vi.mock('./sfx', async (orig) => {
  const real = await orig<typeof import('./sfx')>();
  return { ...real, play: (name: string, opts?: unknown) => {
      if (control.throwOnPlay) throw new Error('boom');
      played.push({ name, opts });
    }, startHum: () => ({ stop: vi.fn() }) };
});
vi.mock('./music', () => music);
vi.mock('./context', () => ({ getMix: () => ({ duck }), getContext: () => null, isRunning: () => true }));

const { bindAudio, beastBody, HIT_STOP_MS, LAW_SOUNDS } = await import('./bindings');
const { RECIPES, HERO_SKILL_SOUNDS } = await import('./sfx');

const names = (): string[] => played.map((p) => p.name);

function setup(heroId: 'pralka' | 'konsultant' | 'petlowiec' | 'kartograf' = 'pralka') {
  const bus = createBus();
  const s: RunState = createRun(3, { heroId });
  const freeze = vi.fn();
  const audio = bindAudio(bus, { getState: () => s, freeze });
  return { bus, s, freeze, audio };
}

beforeEach(() => {
  played.length = 0;
  control.throwOnPlay = false;
  duck.mockClear();
  for (const m of Object.values(music)) m.mockClear();
});

describe('audio bindings', () => {
  it('a crit holds the game for 40 ms and plays the crit sound with the family flavour', () => {
    const { bus, s, freeze } = setup();
    const e = createEnemy(20, 0, 0, 1);
    e.family = 'powiadomienia';
    s.enemies.push(e);
    bus.emit('enemy:hit', { id: 20, x: 0, y: 0, amount: 9, crit: true });
    expect(freeze).toHaveBeenCalledWith(40);
    expect(HIT_STOP_MS).toBe(40);
    expect(names()).toEqual(['crit', 'flavNotice']);
  });

  it('a plain hit does not freeze; devices clank, beasts tick', () => {
    const { bus, s, freeze } = setup();
    const dev = createEnemy(21, 0, 0, 1);
    dev.family = 'urzadzenia';
    const beast = createEnemy(22, 0, 0, 1);
    beast.family = 'wygenerowane';
    beast.existence = 0.3;
    s.enemies.push(dev, beast);
    bus.emit('enemy:hit', { id: 21, x: 0, y: 0, amount: 3, crit: false });
    bus.emit('enemy:hit', { id: 22, x: 0, y: 0, amount: 3, crit: false });
    expect(freeze).not.toHaveBeenCalled();
    expect(names()).toEqual(['hit', 'flavDevice', 'hit', 'flavBeast']);
    // the beast's body is scaled by its existence: nearly none at 0.3
    const opts = played[2]?.opts as { scale: { body: number } };
    expect(opts.scale.body).toBeLessThan(0.1);
  });

  it('the body of a hit on a beast follows its existence coefficient', () => {
    expect(beastBody(0.3)).toBeLessThan(0.1);
    expect(beastBody(1)).toBeCloseTo(1, 6);
    expect(beastBody(undefined)).toBeCloseTo(1, 6);
    let prev = -1;
    for (let e = 0.3; e <= 1.0001; e += 0.1) {
      expect(beastBody(e)).toBeGreaterThan(prev);
      prev = beastBody(e);
    }
  });

  it('a killing blow plays the kill (two strokes), holds 40 ms and ducks the music; no separate hit sound', () => {
    const { bus, s, freeze } = setup();
    const e = createEnemy(23, 0, 0, 1);
    e.family = 'urzadzenia';
    e.hp = 0;
    s.enemies.push(e);
    bus.emit('enemy:hit', { id: 23, x: 0, y: 0, amount: 99, crit: false });
    expect(names()).toEqual([]);
    bus.emit('enemy:died', { id: 23, x: 0, y: 0, tier: 'common', family: 'urzadzenia' });
    expect(names()).toEqual(['kill', 'flavDevice']);
    expect(freeze).toHaveBeenCalledWith(40);
    expect(duck).toHaveBeenCalledTimes(1);
  });

  it('every hero maps slots 0..2 to its own three sounds', () => {
    for (const hero of ['pralka', 'konsultant', 'petlowiec', 'kartograf'] as const) {
      played.length = 0;
      const { bus } = setup(hero);
      for (const slot of [0, 1, 2] as const) bus.emit('skill:cast', { slot, free: false });
      expect(names()).toEqual([...HERO_SKILL_SOUNDS[hero]]);
    }
  });

  it('player hurt tears the paper; below 30% racja the hiss bed comes with it', () => {
    const { bus, s } = setup();
    s.player.hp = s.player.hpMax;
    bus.emit('player:hit', { x: 0, y: 0, amount: 3, crit: false });
    s.player.hp = s.player.hpMax * 0.2;
    bus.emit('player:hit', { x: 0, y: 0, amount: 3, crit: false });
    expect(names()).toEqual(['playerHurt', 'playerHurtLow']);
  });

  it('a boss phase is a hard splice: the sound, a duck and a cut in the music; the boss death ducks too', () => {
    const { bus } = setup();
    bus.emit('boss:phase', { id: 1, family: 'urzadzenia', x: 0, y: 0 });
    expect(names()).toEqual(['bossPhase']);
    expect(duck).toHaveBeenCalledTimes(1);
    expect(music.musicPhase).toHaveBeenCalledTimes(1);
    bus.emit('boss:died', { id: 1, family: 'urzadzenia', x: 0, y: 0 });
    expect(duck).toHaveBeenCalledTimes(2);
  });

  it('footnotes: a typewriter key, and a carriage return for a correction', () => {
    const { bus } = setup();
    bus.emit('footnote:added', { n: 1, text: 'x', correction: false });
    bus.emit('footnote:added', { n: 2, text: 'y', correction: true });
    expect(names()).toEqual(['footnote', 'correction']);
  });

  it('stamps, loot, the page edge and the page turn have their sounds; the turn also splices the music', () => {
    const { bus, s } = setup();
    bus.emit('stamp', { text: 'X', x: 0, y: 0 });
    bus.emit('pickup:taken', { id: 1, number: 1 });
    bus.emit('page:edge', { x: 0, y: 0, side: 'l' });
    bus.emit('page:turn', { from: 0, to: 1 });
    expect(names()).toEqual(['stamp', 'pickup', 'pageEdge', 'pageTurn']);
    expect(music.musicTurn).toHaveBeenCalledWith(s, 1);
  });

  it('enemy escalation and a rebuttal are heard', () => {
    const { bus } = setup();
    bus.emit('enemy:escalated', { id: 1, tier: 2, x: 0, y: 0 });
    bus.emit('enemy:rebutted', { id: 1 });
    expect(names()).toEqual(['escalate', 'strikeThrough']);
  });

  it('law triggers: bot hours, the consultant, reversed time, the fee, the code; unknown kinds are silent', () => {
    const { bus } = setup();
    for (const kind of Object.keys(LAW_SOUNDS)) bus.emit('law:trigger', { law: 'x', kind });
    bus.emit('law:trigger', { law: 'x', kind: 'nothing:here' });
    expect(names()).toEqual(Object.values(LAW_SOUNDS));
    for (const n of Object.values(LAW_SOUNDS)) expect(RECIPES[n]).toBeDefined();
  });

  it('the inventory sheet makes a sound when it opens and another when it closes', () => {
    const { bus, s } = setup();
    s.status = 'paused';
    bus.emit('inventory');
    s.status = 'running';
    bus.emit('inventory');
    expect(names()).toEqual(['inventoryOpen', 'inventoryClose']);
  });

  it('music follows the run: starts with the run, stops when it ends or a menu screen comes', () => {
    const { bus } = setup();
    bus.emit('run:started', { seed: 3 });
    expect(music.startMusic).toHaveBeenCalledTimes(1);
    bus.emit('run:ended', { outcome: 'ukonczono' });
    expect(music.stopMusic).toHaveBeenCalledTimes(1);
    bus.emit('screen:changed', { screen: 'profile' });
    expect(music.stopMusic).toHaveBeenCalledTimes(2);
    expect(names()).toContain('paperSlide');
  });

  it('the base page keeps the planet music: entering it restarts the profile, the screen change does not stop it', () => {
    const { bus } = setup();
    bus.emit('base:entered', { layout: 'wioska' });
    expect(music.startMusic).toHaveBeenCalledTimes(1);
    const stops = vi.mocked(music.stopMusic).mock.calls.length;
    bus.emit('screen:changed', { screen: 'baza' });
    expect(music.stopMusic).toHaveBeenCalledTimes(stops);
    expect(names()).toContain('paperSlide');
  });

  it('opening a station and accepting the ticket make paper and stamp sounds', () => {
    const { bus } = setup();
    bus.emit('station:opened', { station: 'biurko' });
    bus.emit('ticket:accepted');
    expect(names()).toEqual(['inventoryOpen', 'stamp']);
  });

  it('menus get foley only: the title screen is silent, other screens slide paper', () => {
    const { bus } = setup();
    bus.emit('screen:changed', { screen: 'title' });
    expect(names()).toEqual([]);
    bus.emit('screen:changed', { screen: 'settings' });
    expect(names()).toEqual(['paperSlide']);
  });

  it('frame ticks the music scheduler and sketches new loot cards once', () => {
    const { s, audio, bus } = setup();
    bus.emit('run:started', { seed: 3 });
    played.length = 0;
    audio.frame();
    expect(music.tickMusic).toHaveBeenCalledTimes(1);
    expect(names()).toEqual([]);
    s.pickups.push(createPickup(s.nextId++, 0, 0, 1, rollItem(createRng(1), { level: 1, source: 'common' })));
    s.pickups.push(createPickup(s.nextId++, 0, 0, 0, undefined, 2));
    audio.frame();
    audio.frame();
    expect(names()).toEqual(['cardDrawn']); // a star is not a card
  });

  it('death has no sting: the player dying plays nothing', () => {
    const { bus } = setup();
    bus.emit('player:died', { x: 0, y: 0 });
    expect(names()).toEqual([]);
  });

  it('a broken Web Audio never reaches the game: exceptions are swallowed, announced once, then the sound stays off', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { bus, audio } = setup();
    control.throwOnPlay = true;
    expect(() => {
      for (let i = 0; i < 40; i++) bus.emit('stamp', { text: 'X', x: 0, y: 0 });
      audio.frame();
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    control.throwOnPlay = false;
    bus.emit('stamp', { text: 'X', x: 0, y: 0 });
    expect(names()).toEqual([]); // switched off for the session
    warn.mockRestore();
  });
});
