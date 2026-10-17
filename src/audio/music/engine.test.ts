import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { generateRunPages } from '../../world/pages';
import { FakeContext } from '../fakeContext';
import { CALM_FLAGS, RENDER_STATES, type MusicFlags } from './adapt';
import { MAX_VOICES, NODES_PER_VOICE, NODE_LIMIT, TRANSIENT_NODES, createMusicEngine } from './engine';
import { PROFILE_IDS, rollProfile, type ProfileId } from './profiles';
import { LOOKAHEAD_S } from './scheduler';

interface Run {
  ctx: FakeContext;
  maxAlive: number;
  persistent: number;
  info: ReturnType<ReturnType<typeof createMusicEngine>['info']>;
}

/** Drive an engine the way the game loop does (a tick per 25 ms) and measure the nodes alive. */
function run(id: ProfileId, seed: number, seconds: number, flags: MusicFlags = CALM_FLAGS, changes: { t: number; flags: Partial<MusicFlags> }[] = []): Run {
  const ctx = new FakeContext();
  let t = 0;
  const rng = createRng(seed).fork('music');
  const params = rollProfile(id, rng);
  const page = generateRunPages(createRng(seed), 3)[1] ?? null;
  const engine = createMusicEngine({ ctx: ctx.asContext(), out: ctx.destination as unknown as AudioNode, clock: { now: () => t }, params, rng: rng.fork('voices'), page, flags });
  const persistent = engine.info().persistentNodes;
  let current = flags;
  let next = 0;
  const sorted = [...changes].sort((a, b) => a.t - b.t);
  let maxAlive = 0;
  for (t = 0; t < seconds; t += 0.025) {
    while (next < sorted.length && (sorted[next]?.t ?? Infinity) <= t) {
      current = { ...current, ...sorted[next]?.flags };
      engine.setFlags(current);
      next++;
    }
    engine.tick();
    const alive = ctx.voices().filter((v) => v.start <= t + LOOKAHEAD_S + 0.4 && v.stop > t).length;
    maxAlive = Math.max(maxAlive, persistent + alive * NODES_PER_VOICE);
  }
  return { ctx, maxAlive, persistent, info: engine.info() };
}

const timeline = (r: Run): string => r.ctx.voices().map((v) => `${v.start.toFixed(3)}-${v.stop.toFixed(3)}:${v.node.kind}`).join(',');

describe('music engine node budget', () => {
  it('the constants add up to under the limit', () => {
    const r = run('B', 1, 1);
    expect(r.persistent + MAX_VOICES * NODES_PER_VOICE + TRANSIENT_NODES).toBeLessThanOrEqual(NODE_LIMIT);
  });

  for (const id of PROFILE_IDS) {
    it(`${id}: never more than ${NODE_LIMIT} nodes alive in 5 minutes of changing states`, () => {
      const states = Object.values(RENDER_STATES);
      const changes = Array.from({ length: 30 }, (_, i) => ({ t: 10 + i * 9.5, flags: states[i % states.length] ?? CALM_FLAGS }));
      const r = run(id, 21, 300, CALM_FLAGS, changes);
      expect(r.maxAlive).toBeLessThanOrEqual(NODE_LIMIT);
      expect(r.maxAlive).toBeGreaterThan(r.persistent);
    });
  }
});

describe('music engine behaviour', () => {
  it('is deterministic for a seed and different for another', () => {
    expect(timeline(run('C', 5, 40))).toBe(timeline(run('C', 5, 40)));
    expect(timeline(run('C', 5, 40))).not.toBe(timeline(run('C', 6, 40)));
  });

  it('schedules inside the look-ahead: nothing starts before the clock, nothing starts far ahead', () => {
    const ctx = new FakeContext();
    let t = 0;
    const rng = createRng(3).fork('music');
    const engine = createMusicEngine({
      ctx: ctx.asContext(),
      out: ctx.destination as unknown as AudioNode,
      clock: { now: () => t },
      params: rollProfile('C', rng),
      rng: rng.fork('voices'),
      page: generateRunPages(createRng(3), 3)[1] ?? null,
      flags: RENDER_STATES.boss,
    });
    let seen = 0;
    for (t = 0; t < 60; t += 0.025) {
      engine.tick();
      const voices = ctx.voices();
      for (let i = seen; i < voices.length; i++) {
        const v = voices[i];
        if (!v) continue;
        expect(v.start).toBeGreaterThanOrEqual(t - 1e-9);
        // a step, plus the second voice's lateness (< 0.1 s), plus a beep's 0.2 s offset
        expect(v.start).toBeLessThanOrEqual(t + LOOKAHEAD_S + 0.35);
      }
      seen = voices.length;
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('a second voice joins when more than two enemies are near, and not before', () => {
    const calm = run('C', 8, 60, CALM_FLAGS);
    const near = run('C', 8, 60, { ...CALM_FLAGS, enemiesNear: 6 });
    const two = run('C', 8, 60, { ...CALM_FLAGS, enemiesNear: 2 });
    expect(near.ctx.voices().length).toBeGreaterThan(calm.ctx.voices().length);
    expect(two.ctx.voices().length).toBe(calm.ctx.voices().length);
  });

  it('the boss runs at 1.25x tempo: more steps in the same time', () => {
    const calm = run('C', 8, 60, CALM_FLAGS);
    const boss = run('C', 8, 60, RENDER_STATES.boss);
    expect(boss.info.bars).toBeGreaterThan(calm.info.bars * 1.15);
  });

  it('bot hours: a hold beep every 4 seconds, nothing else new', () => {
    const r = run('C', 8, 41, RENDER_STATES.botTime);
    const beeps = r.ctx.voices().filter((v) => v.node.kind === 'osc').length;
    // the tape chain has its own occasional beep only for B and BC; C has none: all oscillator voices are the bot beeps
    expect(beeps).toBeGreaterThanOrEqual(9);
    expect(beeps).toBeLessThanOrEqual(11);
  });

  it('death: the mechanism slows to a stop and schedules nothing more', () => {
    const r = run('B', 8, 40, CALM_FLAGS, [{ t: 10, flags: { dead: true } }]);
    const late = r.ctx.voices().filter((v) => v.start > 22);
    expect(late).toHaveLength(0);
    expect(r.info.parked).toBe(true);
    const early = r.ctx.voices().filter((v) => v.start < 10);
    expect(early.length).toBeGreaterThan(3);
  });

  it('after a death that is not final (Petla) the music starts again', () => {
    const r = run('B', 8, 60, CALM_FLAGS, [
      { t: 10, flags: { dead: true } },
      { t: 30, flags: { dead: false } },
    ]);
    expect(r.ctx.voices().filter((v) => v.start > 40).length).toBeGreaterThan(3);
  });

  it('every profile plays something in every state', () => {
    for (const id of PROFILE_IDS) {
      for (const [name, flags] of Object.entries(RENDER_STATES)) {
        const r = run(id, 4, 30, flags);
        expect(r.ctx.voices().length, `${id} ${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('a cut (page turn) swaps the roll and does not break the schedule', () => {
    const ctx = new FakeContext();
    let t = 0;
    const rng = createRng(9).fork('music');
    const pages = generateRunPages(createRng(9), 4);
    const engine = createMusicEngine({ ctx: ctx.asContext(), out: ctx.destination as unknown as AudioNode, clock: { now: () => t }, params: rollProfile('BC', rng), rng: rng.fork('voices'), page: pages[0] ?? null });
    for (t = 0; t < 20; t += 0.025) engine.tick();
    const before = engine.info().notes;
    engine.setPage(pages[2] ?? null);
    engine.cut('turn');
    for (; t < 40; t += 0.025) engine.tick();
    expect(engine.info().notes).not.toBe(0);
    expect(typeof before).toBe('number');
    engine.cut('phase');
    for (; t < 45; t += 0.025) engine.tick();
    expect(ctx.voices().length).toBeGreaterThan(10);
  });

  it('stop fades out and stops the oscillators', () => {
    const ctx = new FakeContext();
    let t = 0;
    const rng = createRng(2).fork('music');
    const engine = createMusicEngine({ ctx: ctx.asContext(), out: ctx.destination as unknown as AudioNode, clock: { now: () => t }, params: rollProfile('B', rng), rng, page: null });
    for (t = 0; t < 5; t += 0.025) engine.tick();
    engine.stop(1);
    for (; t < 10; t += 0.025) engine.tick();
    // nothing new starts after the stop; the wow, flutter and hiss sources are stopped once the fade is over
    expect(ctx.voices().filter((v) => v.start >= 5)).toHaveLength(0);
    const persistentSources = ctx.nodes.filter((n) => (n.kind === 'osc' || n.kind === 'buffer') && n.started === 0 && n.stopped !== null && n.stopped > 5);
    expect(persistentSources.length).toBeGreaterThanOrEqual(3);
  });
});
