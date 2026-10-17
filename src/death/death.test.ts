import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import type { HeroId } from '../heroes';
import { createRun, type RunState } from '../world/run';
import { maybeDropAppeal, takeAppeal } from './appeal';
import { applyPetla, applyZawieszenie, chooseOutcome, DEATH_OUTCOMES, ghostExpired, pickOutcome, takeCopyDrop } from './outcomes';

const run = (heroId: HeroId = 'pralka', seed = 4): RunState => createRun(seed, { heroId });

describe('death outcome choice', () => {
  it('is deterministic for a seed and covers all three outcomes about equally', () => {
    const counts = { zgloszenie: 0, petla: 0, zawieszenie: 0 };
    const n = 900;
    for (let seed = 1; seed <= n; seed++) {
      const s = run('pralka', seed);
      const a = chooseOutcome(s);
      expect(chooseOutcome(run('pralka', seed))).toBe(a);
      counts[a]++;
    }
    for (const o of DEATH_OUTCOMES) {
      expect(counts[o]).toBeGreaterThan(n * 0.26);
      expect(counts[o]).toBeLessThan(n * 0.41);
    }
  });

  it('the second death of a run is rolled separately from the first', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = run('pralka', seed);
      const first = chooseOutcome(s);
      s.hero.deaths = 1;
      seen.add(`${first}>${chooseOutcome(s)}`);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('dying while suspended is always a zgloszenie', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = run('pralka', seed);
      s.player.suspended = true;
      expect(chooseOutcome(s)).toBe('zgloszenie');
    }
    expect(pickOutcome(createRng(1), true)).toBe('zgloszenie');
  });
});

describe('Petla', () => {
  it('respawns at the page start with full racja and leaves a copy as an enemy that drops an item', () => {
    const s = run('pralka');
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const p = s.player;
    p.x = 700;
    p.y = 900;
    p.hp = 0;
    s.status = 'dead';
    p.stats.dmgMax = 23;
    p.inventory.push({ name: 'testowa pieczątka' } as never);
    applyPetla(s, bus);
    expect(s.status).toBe('running');
    expect(p.hp).toBe(p.hpMax);
    expect(p.x).toBe(s.page.spawn.x);
    expect(p.y).toBe(s.page.spawn.y);
    const copy = s.enemies.find((e) => e.copyOf);
    expect(copy).toBeDefined();
    expect(copy?.copyOf?.heroId).toBe('pralka');
    expect(copy?.x).toBe(700);
    expect(copy?.stats.dmgMax).toBe(23);
    expect(copy?.damageType).toBe(p.damageType);
    expect(copy?.drops).toBeDefined();
    expect(takeCopyDrop(s, copy?.id ?? -1)).toBe(copy?.drops);
    expect(takeCopyDrop(s, copy?.id ?? -1)).toBeNull();
    expect(notes.length).toBeGreaterThan(0);
  });

  it('a Petlowiec leaves a friendly ghost for 10 seconds, then it turns hostile', () => {
    const s = run('petlowiec');
    const bus = createBus();
    s.status = 'dead';
    s.player.x = 500;
    s.player.y = 500;
    applyPetla(s, bus);
    expect(s.enemies.filter((e) => e.copyOf)).toHaveLength(0);
    const ghost = s.summons.find((m) => m.variant === 'ghost');
    expect(ghost?.ttl).toBe(10);
    expect(s.hero.ghosts).toHaveLength(1);
    ghostExpired(s, bus, ghost?.id ?? -1);
    const copy = s.enemies.find((e) => e.copyOf);
    expect(copy?.copyOf?.heroId).toBe('petlowiec');
    expect(s.hero.ghosts).toHaveLength(0);
  });
});

describe('Zawieszenie and the appeal', () => {
  it('suspends: no damage dealt to the player by anyone, racja full, appeal owed', () => {
    const s = run('pralka');
    const bus = createBus();
    s.status = 'dead';
    s.player.hp = 0;
    applyZawieszenie(s, bus);
    expect(s.status).toBe('running');
    expect(s.player.suspended).toBe(true);
    expect(s.player.hp).toBe(s.player.hpMax);
    expect(s.hero.appealOwed).toBe(true);
  });

  it('the next elite drops the appeal; picking it up lifts the suspension', () => {
    const s = run('pralka');
    const bus = createBus();
    let lifted = 0;
    bus.on('player:unsuspended', () => lifted++);
    applyZawieszenie(s, bus);
    maybeDropAppeal(s, 10, 10, 'common');
    expect(s.pickups).toHaveLength(0);
    maybeDropAppeal(s, 10, 10, 'elite');
    expect(s.pickups).toHaveLength(1);
    expect(s.hero.appeals).toEqual([s.pickups[0]?.id]);
    const k = s.pickups[0];
    if (!k) throw new Error('no pickup');
    expect(takeAppeal(s, bus, k)).toBe(true);
    expect(s.player.suspended).toBe(false);
    expect(lifted).toBe(1);
    expect(takeAppeal(s, bus, k)).toBe(false);
  });

  it('without tier information the appeal drops after a dozen kills', () => {
    const s = run('pralka');
    applyZawieszenie(s, createBus());
    s.kills += 11;
    maybeDropAppeal(s, 0, 0, undefined);
    expect(s.pickups).toHaveLength(0);
    s.kills += 1;
    maybeDropAppeal(s, 0, 0, undefined);
    expect(s.pickups).toHaveLength(1);
  });
});
