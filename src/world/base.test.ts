import { describe, expect, it } from 'vitest';
import { adaptTargets, CALM_FLAGS, deriveFlags } from '../audio/music';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { dist } from '../core/vec';
import { t } from '../i18n';
import { bindAutosave, withBookmark, withCharacter } from '../save/autosave';
import { bookmarkOf, type Bookmark } from '../save/bookmark';
import { defaultMeta } from '../save/save';
import { createSim } from '../systems/step';
import {
  BASE_H,
  BASE_LAYOUTS,
  BASE_W,
  LABEL_RANGE,
  STATIONS,
  TAP_PX,
  WALK_R,
  acceptTicket,
  arrivalKey,
  bookmarkAllowed,
  exitLocked,
  generateBase,
  layoutForSeed,
  reachableCells,
  stationAt,
  stationNear,
  stationReached,
  tapRadius,
  tapStation,
  tickBase,
  unreachableGoals,
  walkableAt,
} from './base';
import { EXIT_RADIUS } from './pages';
import { beginRun, enterPage, tickPageTurn } from './pageTurn';
import { createRun, type RunState } from './run';
import { BASE_END, cutBaseHole, openTunnel, tickTunnel, tunnelPageOf } from './tunnel';

function record(bus: Bus, names: (keyof GameEvents)[]): { name: keyof GameEvents; payload: unknown }[] {
  const log: { name: keyof GameEvents; payload: unknown }[] = [];
  for (const name of names) bus.on(name, ((payload: unknown) => void log.push({ name, payload })) as never);
  return log;
}

const base = (seed = 7, extra: Parameters<typeof createRun>[1] = {}): RunState => createRun(seed, { phase: 'base', pageCount: 5, ...extra });
const seeds = (n: number): number[] => Array.from({ length: n }, (_, i) => i * 7919 + 3);

describe('the base page of a planet', () => {
  it('is a pure function of the seed', () => {
    for (const seed of [1, 2, 3, 48213, 99999]) {
      expect(JSON.stringify(generateBase(seed))).toBe(JSON.stringify(generateBase(seed)));
    }
  });

  it('comes in three layouts, chosen by the seed, each with its own arrangement of the same stations', () => {
    const seen = new Map<string, ReturnType<typeof generateBase>>();
    for (let seed = 1; seed < 80 && seen.size < 3; seed++) seen.set(layoutForSeed(seed), generateBase(seed));
    expect([...seen.keys()].sort()).toEqual([...BASE_LAYOUTS].sort());
    const where = (layout: string, id: string): string => {
      const st = seen.get(layout)?.base?.stations.find((s) => s.id === id);
      return `${Math.round((st?.x ?? 0) / 100)},${Math.round((st?.y ?? 0) / 100)}`;
    };
    for (const layout of seen.keys()) expect(seen.get(layout)?.base?.stations.map((s) => s.id).sort()).toEqual([...STATIONS].sort());
    // the desk stands in a different place in each layout
    expect(new Set(BASE_LAYOUTS.map((l) => where(l, 'biurko'))).size).toBe(3);
    // each layout has its own props
    expect(seen.get('ladowisko')?.base?.props.map((p) => p.kind)).toEqual(expect.arrayContaining(['leg', 'flag']));
    expect(seen.get('wioska')?.base?.props.some((p) => p.kind === 'hut')).toBe(true);
    expect(seen.get('miasteczko')?.base?.props.some((p) => p.kind === 'square')).toBe(true);
  });

  it('is about one screen: 900 x 700, with a torn corner and a bottom exit', () => {
    const p = generateBase(5);
    expect([p.w, p.h]).toEqual([BASE_W, BASE_H]);
    expect(p.exit?.corner[0]).toBe('b');
    expect(p.torn).not.toBe(p.exit?.corner);
    expect(p.obstacles.some((o) => o.kind === 'torn')).toBe(true);
  });

  it('keeps stations clear of each other, of the props and of the exit, with room for a figure between', () => {
    for (const seed of seeds(120)) {
      const page = generateBase(seed);
      const flagged = page.obstacles.filter((o) => o.station !== undefined);
      for (let i = 0; i < flagged.length; i++) {
        for (let j = i + 1; j < flagged.length; j++) {
          const a = flagged[i];
          const b = flagged[j];
          if (!a || !b) continue;
          for (const c of a.colliders) {
            for (const d of b.colliders) expect(dist(c, d), `seed ${seed}: ${a.station} / ${b.station}`).toBeGreaterThan(c.r + d.r + 2 * WALK_R);
          }
        }
      }
      for (const st of page.base?.stations ?? []) {
        if (page.exit) expect(dist(st, page.exit), `seed ${seed}: ${st.id} near the exit`).toBeGreaterThan(EXIT_RADIUS + 60);
        expect(walkableAt(page, { x: st.x, y: st.y + 70 }) || walkableAt(page, { x: st.x, y: st.y - 70 }) || walkableAt(page, { x: st.x + 90, y: st.y })).toBe(true);
      }
      expect(walkableAt(page, page.spawn)).toBe(true);
      if (page.exit && page.base) {
        expect(dist(page.spawn, page.exit)).toBeGreaterThan(EXIT_RADIUS + 120);
        expect(dist(page.base.hole, page.exit)).toBeGreaterThan(EXIT_RADIUS + 60);
      }
    }
  });

  it('is reachable from the landing spot: every station, the exit and the hole (grid flood fill)', () => {
    for (const seed of seeds(200)) {
      const page = generateBase(seed);
      expect(unreachableGoals(page), `seed ${seed} (${layoutForSeed(seed)})`).toEqual([]);
    }
  });

  it('is reachable on a fine grid too, and no decor stands on a station or the hole', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const page = generateBase(seed);
      const cells = reachableCells(page, page.spawn, 6);
      for (const st of page.base?.stations ?? []) expect(cells.some((c) => dist(c, st) <= LABEL_RANGE - 8)).toBe(true);
      const hole = page.base?.hole;
      if (hole) expect(cells.some((c) => dist(c, hole) < 10)).toBe(true);
      const decor = page.obstacles.filter((o) => o.station === undefined && o.kind !== 'torn');
      expect(decor.length).toBeGreaterThanOrEqual(1);
      expect(decor.length).toBeLessThanOrEqual(5);
    }
  });

  it('gives every station a tap target of at least 44 css pixels at any zoom the camera uses', () => {
    const page = generateBase(3);
    for (const st of page.base?.stations ?? []) {
      for (const zoom of [0.6, 0.75, 1, 1.4]) expect(tapRadius(st, zoom) * zoom * 2).toBeGreaterThanOrEqual(TAP_PX);
    }
  });
});

describe('stations: tap, walk, open', () => {
  it('finds the station under a tap and the station within label range', () => {
    const s = base();
    const biurko = s.page.base?.stations.find((x) => x.id === 'biurko');
    expect(biurko).toBeDefined();
    if (!biurko) return;
    expect(stationAt(s.page, biurko.x + 10, biurko.y - 5)?.id).toBe('biurko');
    expect(stationAt(s.page, biurko.x + 300, biurko.y + 300)).toBeNull();
    expect(stationNear(s.page, { x: biurko.x + LABEL_RANGE - 5, y: biurko.y })?.id).toBe('biurko');
    expect(stationNear(s.page, { x: biurko.x + LABEL_RANGE + 40, y: biurko.y })).toBeNull();
  });

  it('remembers a tapped station, forgets it on a tap elsewhere, and opens it once the player is within range', () => {
    const s = base();
    const bus = createBus();
    const log = record(bus, ['station:opened']);
    const st = s.page.base?.stations.find((x) => x.id === 'kiosk');
    if (!st) throw new Error('no kiosk');
    expect(tapStation(s, st.x, st.y, 1)).toBe('kiosk');
    expect(s.base?.pending).toBe('kiosk');
    tickBase(s, bus, 1 / 60); // far away: nothing
    expect(log).toHaveLength(0);
    expect(tapStation(s, 5, 5, 1)).toBeNull();
    expect(s.base?.pending).toBeNull();
    // joystick mode keeps a pending tap on a tap elsewhere
    tapStation(s, st.x, st.y, 1);
    tapStation(s, 5, 5, 1, true);
    expect(s.base?.pending).toBe('kiosk');
    s.player.x = st.x + 70;
    s.player.y = st.y + 20;
    expect(stationReached(s)).toBe('kiosk');
    expect(s.base?.pending).toBeNull();
    tapStation(s, st.x, st.y, 1);
    tickBase(s, bus, 1 / 60);
    tickBase(s, bus, 1 / 60);
    expect(log).toEqual([{ name: 'station:opened', payload: { station: 'kiosk' } }]);
  });
});

describe('the exit lock', () => {
  const standInExit = (s: RunState): void => {
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    s.player.x = e.x + (e.corner[1] === 'l' ? 40 : -40);
    s.player.y = e.y + (e.corner[0] === 't' ? 40 : -40);
  };

  it('stays locked until a ticket is accepted: standing in it writes a note, not a page turn', () => {
    const s = base();
    const bus = createBus();
    const log = record(bus, ['page:turn', 'margin:note']);
    expect(s.phase).toBe('base');
    expect(exitLocked(s)).toBe(true);
    standInExit(s);
    tickBase(s, bus, 1 / 60);
    expect(s.turning).toBe(false);
    expect(log.map((l) => l.name)).toEqual(['margin:note']);
    tickBase(s, bus, 1 / 60); // the note is not repeated at once
    expect(log).toHaveLength(1);
    expect((log[0]?.payload as { text: string }).text).toBe(t('screens.base.exitLocked'));
  });

  it('opens when the ticket is accepted and the page turn leads to the first page of the run', () => {
    const s = base();
    const bus = createBus();
    const log = record(bus, ['page:turn']);
    expect(acceptTicket(s)).toBe(true);
    expect(acceptTicket(s)).toBe(false); // once
    expect(exitLocked(s)).toBe(false);
    standInExit(s);
    tickBase(s, bus, 1 / 60);
    expect(s.turning).toBe(true);
    expect(log).toEqual([{ name: 'page:turn', payload: { from: -1, to: 0 } }]);
  });

  it('with a bookmark the exit leads straight to the bookmarked page, and the run starts at its clock', () => {
    const run = createRun(7, { pageCount: 5 });
    run.pageIndex = 3;
    run.time = 187.5;
    const b: Bookmark = bookmarkOf(run);
    const s = base(7, { resume: b });
    const bus = createBus();
    const log = record(bus, ['page:turn', 'run:started', 'page:entered', 'footnote']);
    expect(acceptTicket(s, b)).toBe(true);
    expect(s.pageIndex).toBe(3);
    standInExit(s);
    tickBase(s, bus, 1 / 60);
    expect(log[0]?.payload).toEqual({ from: -1, to: 3 });
    enterPage(s, bus, 3); // what the sweep does
    expect(s.phase).toBe('run');
    expect(s.base).toBeUndefined();
    expect(s.time).toBe(187.5);
    expect(s.pageIndex).toBe(3);
    expect(s.populate).toBe(true);
    expect(log.map((l) => l.name)).toEqual(['page:turn', 'run:started', 'page:entered', 'footnote']);
    expect(String((log[3]?.payload as { text: string }).text)).toContain(String(s.ticket.number));
  });

  it('refuses a ticket outside the base', () => {
    expect(acceptTicket(createRun(7))).toBe(false);
  });
});

describe('phase guards', () => {
  it('the base has no spawns, no clock, no law ticks and no page-turn watch', () => {
    for (const lawId of ['godziny-konsultanta', 'czas-wsteczny', 'ciasteczka', 'grawitacja'] as const) {
      const s = base(11, { lawId });
      const bus = createBus();
      const log = record(bus, ['run:started', 'page:entered', 'law:trigger', 'law:ask']);
      const sim = createSim(bus);
      s.player.target = { x: s.player.x + 200, y: s.player.y - 100 };
      for (let i = 0; i < 60 * 400; i++) sim.step(s, 1 / 60); // 400 s: past every clause's clock
      expect(s.time, lawId).toBe(0);
      expect(s.enemies, lawId).toHaveLength(0);
      expect(s.law.botTime, lawId).toBe(false);
      expect(s.law.reversed, lawId).toBe(false);
      expect(s.modal, lawId).toBeNull();
      expect(s.populate, lawId).toBe(false);
      expect(s.phase).toBe('base');
      expect(log).toEqual([]);
      // the player did walk
      expect(dist(s.player, s.page.spawn)).toBeGreaterThan(50);
    }
  });

  it('the walls of the base page hold the player in, and its edge writes no margin note', () => {
    const s = base();
    const bus = createBus();
    const log = record(bus, ['page:edge']);
    const sim = createSim(bus);
    s.player.target = { x: -500, y: s.player.y };
    for (let i = 0; i < 600; i++) sim.step(s, 1 / 60);
    expect(s.player.x).toBeGreaterThanOrEqual(s.page.inset);
    expect(log).toEqual([]);
  });

  it('the run proper starts with the clock, the laws and the first wave of the page', () => {
    const s = base(11, { lawId: 'godziny-konsultanta' });
    const bus = createBus();
    const log = record(bus, ['run:started', 'page:entered']);
    acceptTicket(s);
    enterPage(s, bus, 0);
    expect(s.phase).toBe('run');
    expect(s.time).toBe(0);
    expect(log.map((l) => l.name)).toEqual(['run:started', 'page:entered']);
    const sim = createSim(bus);
    for (let i = 0; i < 60; i++) sim.step(s, 1 / 60);
    expect(s.time).toBeGreaterThan(0.9);
    expect(s.enemies.length).toBeGreaterThan(0);
  });

  it('page turns of the run are untouched by the base rules', () => {
    const s = createRun(4, { pageCount: 5 });
    expect(s.phase).toBe('run');
    const bus = createBus();
    const log = record(bus, ['page:turn']);
    s.populate = false;
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    s.player.x = e.x + (e.corner[1] === 'l' ? 40 : -40);
    s.player.y = e.y + (e.corner[0] === 't' ? 40 : -40);
    tickPageTurn(s, bus);
    expect(log).toEqual([{ name: 'page:turn', payload: { from: 0, to: 1 } }]);
  });

  it('beginRun without a bookmark starts the clock at zero', () => {
    const s = base();
    s.time = 99; // would be a bug; the run proper starts at zero anyway
    beginRun(s, createBus());
    expect(s.time).toBe(0);
    expect(s.phase).toBe('run');
  });
});

describe('the bookmark is written for the run proper only', () => {
  it('leaves the meta state alone in the base and writes it in the run', () => {
    const meta = { ...defaultMeta() };
    const s = base();
    expect(bookmarkAllowed(s)).toBe(false);
    expect(withBookmark(meta, s)).toBe(meta);
    expect(withBookmark(meta, s).bookmark).toBeUndefined();
    const kept = { ...meta, bookmark: bookmarkOf(createRun(9, { pageCount: 4 })) };
    expect(withBookmark(kept, s).bookmark).toEqual(kept.bookmark); // an unfinished ticket stays where it was
    const run = createRun(7, { pageCount: 5 });
    expect(bookmarkAllowed(run)).toBe(true);
    expect(withBookmark(meta, run).bookmark?.seed).toBe(7);
  });

  it('autosave saves the character in the base, without a bookmark or the bookmarked event', () => {
    const s = base();
    const bus = createBus();
    let meta = defaultMeta();
    const log = record(bus, ['run:bookmarked']);
    const auto = bindAutosave({ bus, getState: () => s, getMeta: () => meta, commit: (m) => (meta = m), inRun: () => true, doc: null });
    expect(auto.save()).toBe(true);
    expect(meta.character).toEqual(withCharacter(defaultMeta(), s).character);
    expect(meta.bookmark).toBeUndefined();
    expect(log).toEqual([]);
    bus.emit('game:paused', { paused: true });
    expect(meta.bookmark).toBeUndefined();
    enterPage(s, bus, 1); // page:entered in the run proper writes it
    expect(meta.bookmark?.pageIndex).toBe(1);
    expect(log.map((l) => l.name)).toEqual(['run:bookmarked']);
    auto.unbind();
  });
});

describe('the Asystent arrives with the base', () => {
  it('chooses one of three notes per layout from the seed, every one written', () => {
    const seen = new Map<string, Set<string>>();
    for (const seed of seeds(200)) {
      const layout = layoutForSeed(seed);
      const key = arrivalKey(seed, layout);
      expect(key).toMatch(new RegExp(`^screens\\.base\\.arrival\\.${layout}\\.[012]$`));
      expect(arrivalKey(seed, layout)).toBe(key);
      const text = t(key);
      expect(text, key).not.toBe(key);
      expect(text).not.toContain('!');
      seen.set(layout, (seen.get(layout) ?? new Set()).add(key));
    }
    for (const layout of BASE_LAYOUTS) expect(seen.get(layout)?.size, layout).toBe(3);
  });

  it('keeps the flag and the planet of the brief', () => {
    expect(t('screens.base.arrival.ladowisko.0')).toBe('Lądowisko. Flagę wbito, nie ustalono czyją.');
  });
});

describe('the base end of the tunnel', () => {
  it('cuts the hole near the landing spot; walking into it takes the player out of the base', () => {
    const s = base();
    const bus = createBus();
    const log = record(bus, ['tunnel:entered', 'tunnel:opened']);
    const tn = cutBaseHole(s);
    expect(tn).not.toBeNull();
    expect(tn?.pageIndex).toBe(BASE_END);
    expect(tunnelPageOf(s)).toBe(BASE_END);
    expect(dist(tn ?? { x: 0, y: 0 }, s.page.spawn)).toBeLessThan(260);
    tickTunnel(s, bus); // the player stands off the hole: the hole is armed
    expect(s.tunnel?.armed).toBe(true);
    expect(log).toEqual([]);
    s.player.x = tn?.x ?? 0;
    s.player.y = tn?.y ?? 0;
    tickTunnel(s, bus);
    expect(log).toEqual([{ name: 'tunnel:entered', payload: undefined }]);
  });

  it('is not cut by the Tunel note of the HUD, and there is no hole in a base without a held run', () => {
    const s = base();
    expect(openTunnel(s, createBus())).toBe(false);
    expect(s.tunnel).toBeUndefined();
    expect(cutBaseHole(createRun(3))).toBeNull();
  });

  it('is reached by the real step: the player walks to the hole', () => {
    const s = base();
    const bus = createBus();
    const log = record(bus, ['tunnel:entered']);
    const tn = cutBaseHole(s);
    if (!tn) throw new Error('no hole');
    s.player.x = tn.x - 100;
    s.player.y = tn.y;
    s.player.target = { x: tn.x, y: tn.y };
    const sim = createSim(bus);
    for (let i = 0; i < 400 && log.length === 0; i++) sim.step(s, 1 / 60);
    expect(log).toHaveLength(1);
  });
});

describe('the music in the base', () => {
  it('is the calm layer with the base flag, 6 dB down; the run proper is not', () => {
    const s = base();
    expect(deriveFlags(s).base).toBe(true);
    expect(deriveFlags(s).enemiesNear).toBe(0);
    const calm = adaptTargets(CALM_FLAGS, 'B');
    const inBase = adaptTargets(deriveFlags(s), 'B');
    expect(inBase.level).toBeCloseTo(calm.level * 0.5, 6);
    expect(inBase.second).toBe(0);
    expect(inBase.density).toBe(calm.density);
    expect(inBase.tempo).toBe(1);
    expect(deriveFlags(createRun(3)).base).toBe(false);
  });
});
