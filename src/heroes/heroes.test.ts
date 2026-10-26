import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createEnemy } from '../entities/factory';
import { createRun, nextId, type RunState } from '../world/run';
import { HEROES, heroDef } from './defs';
import { castSkill } from './skills';
import { heroStep } from './system';
import { pushRing, ringBack, RING_SECONDS, type RingSample } from './state';
import type { HeroId } from './index';

function run(heroId: HeroId = 'pralka', seed = 5): RunState {
  const s = createRun(seed, { heroId });
  s.enemies.length = 0;
  return s;
}

function addEnemy(s: RunState, dx: number, dy = 0) {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = 500;
  s.enemies.push(e);
  return e;
}

/** Advance the hero system by `seconds` at 60 Hz, moving the clock like the sim does. */
function tick(s: RunState, bus: ReturnType<typeof createBus>, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    heroStep(s, bus, 1 / 60);
  }
}

describe('hero definitions', () => {
  it('has five heroes with five typed skills each (the 4th and 5th gated by a permission) and no mana', () => {
    expect(HEROES.map((h) => h.id).slice(0, 5)).toEqual(['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik']); // a hero in the making (scripts/new-hero.mjs) comes after them
    for (const h of HEROES) {
      expect(h.skills.length).toBeGreaterThanOrEqual(5); // 5 for the original kit, 10 or 11 once a hero is filled (S19)
      expect(h.skills.slice(0, 3).every((sk) => sk.requires === undefined)).toBe(true);
      expect(h.skills.slice(3, 5).every((sk) => sk.requires !== undefined)).toBe(true);
      for (const sk of h.skills) {
        expect(sk.cooldown).toBeGreaterThan(0);
        expect(['mechaniczny', 'regulaminowy', 'egzystencjalny']).toContain(sk.type);
      }
    }
  });

  it('applies the hero to a fresh run', () => {
    const s = run('konsultant');
    expect(s.player.heroId).toBe('konsultant');
    expect(s.player.trialSpeed).toBe(2);
    expect(s.player.seesDefects).toBe(true);
    expect(s.player.hpMax).toBe(heroDef('konsultant').racja);
    expect(run('kartograf').player.revealsPage).toBe(true);
    expect(run('pralka').player.trialSpeed).toBe(1);
  });
});

describe('Petla ring buffer', () => {
  const sample = (t: number): RingSample => ({ t, x: t * 10, y: 0, hp: 100 - t });

  it('keeps about three seconds and drops the rest', () => {
    const ring: RingSample[] = [];
    for (let i = 0; i <= 100; i++) pushRing(ring, sample(i * 0.1));
    const span = (ring[ring.length - 1]?.t ?? 0) - (ring[0]?.t ?? 0);
    expect(span).toBeLessThanOrEqual(RING_SECONDS);
    expect(span).toBeGreaterThan(2.9);
  });

  it('returns the sample from 3 seconds ago, or the oldest if the history is shorter', () => {
    const ring: RingSample[] = [];
    for (let i = 0; i <= 50; i++) pushRing(ring, sample(i * 0.1));
    expect(ringBack(ring, 5, 3)?.t).toBeCloseTo(2, 5);
    const short: RingSample[] = [sample(1), sample(1.1)];
    expect(ringBack(short, 1.1, 3)?.t).toBe(1);
    expect(ringBack([], 0, 3)).toBeNull();
  });

  it('Petla teleports back and restores racja, never lowering it', () => {
    const s = run('petlowiec');
    const bus = createBus();
    s.player.x = 100;
    s.player.y = 100;
    tick(s, bus, 1);
    s.player.x = 400;
    s.player.y = 400;
    tick(s, bus, 2.5);
    const p = s.player;
    p.hp = p.hpMax - 30;
    const hpWas = s.hero.ring[0]?.hp ?? p.hpMax;
    s.hero.cd = [0, 0, 0, 0, 0];
    expect(castSkill(s, bus, 2)).toBe(true);
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThan(5); // three seconds ago the hero stood at 100, 100
    expect(p.hp).toBeGreaterThanOrEqual(hpWas - 0.01);
    // go back further than the history has: the oldest sample is used
    p.x = 900;
    s.hero.cd[2] = 0;
    s.hero.ring = [{ t: s.time - 1, x: 123, y: 456, hp: p.hpMax }];
    castSkill(s, bus, 2);
    expect(p.x).toBe(123);
    expect(p.hp).toBe(p.hpMax);
  });
});

describe('skill cooldowns', () => {
  it('start on cast, count down in the hero system, and block a second cast', () => {
    const s = run('pralka');
    const bus = createBus();
    addEnemy(s, 50);
    expect(castSkill(s, bus, 0)).toBe(true);
    const total = s.hero.cdTotal[0];
    expect(total).toBeGreaterThan(0);
    expect(s.hero.cd[0]).toBeCloseTo(total, 5);
    expect(castSkill(s, bus, 0)).toBe(false);
    tick(s, bus, 2);
    expect(s.hero.cd[0]).toBeCloseTo(total - 2, 1);
    tick(s, bus, total);
    expect(s.hero.cd[0]).toBe(0);
    expect(castSkill(s, bus, 0)).toBe(true);
  });

  it('a free cast neither needs nor starts a cooldown', () => {
    const s = run('pralka');
    const bus = createBus();
    s.hero.cd[0] = 5;
    expect(castSkill(s, bus, 0, true)).toBe(true);
    expect(s.hero.cd[0]).toBe(5);
  });

  it('wyciszony blocks skills and a paused run does not cast', () => {
    const s = run('konsultant');
    const bus = createBus();
    addEnemy(s, 80);
    s.player.statuses.push({ kind: 'wyciszony', remaining: 3, source: null });
    expect(castSkill(s, bus, 0)).toBe(false);
    s.player.statuses.length = 0;
    s.status = 'paused';
    expect(castSkill(s, bus, 0)).toBe(false);
    s.status = 'running';
    expect(castSkill(s, bus, 0)).toBe(true);
  });

  it('a skill with no target does nothing and costs nothing', () => {
    const s = run('konsultant');
    const bus = createBus();
    expect(castSkill(s, bus, 0)).toBe(false);
    expect(s.hero.cd[0]).toBe(0);
  });

  it('ranks make cooldowns shorter', () => {
    const a = run('pralka');
    const b = run('pralka');
    b.hero.ranks[0] = 3;
    const bus = createBus();
    addEnemy(a, 50);
    addEnemy(b, 50);
    castSkill(a, bus, 0);
    castSkill(b, bus, 0);
    expect(b.hero.cdTotal[0]).toBeLessThan(a.hero.cdTotal[0]);
  });
});

describe('skills do what the design says', () => {
  it('Pranie wstepne: a shield that soaks damage and marks touching enemies do_weryfikacji', () => {
    const s = run('pralka');
    const bus = createBus();
    const e = addEnemy(s, 20);
    expect(castSkill(s, bus, 1)).toBe(true);
    expect(s.player.shield).toBeGreaterThan(0);
    tick(s, bus, 0.1);
    expect(e.statuses.some((st) => st.kind === 'do_weryfikacji')).toBe(true);
    tick(s, bus, 5.5);
    expect(s.player.shield).toBe(0);
  });

  it('Odwirowanie: dashes, drags one enemy and leaves it zablokowany', () => {
    const s = run('pralka');
    const bus = createBus();
    s.player.x = 300;
    s.player.y = 300;
    const e = addEnemy(s, 90);
    expect(castSkill(s, bus, 2)).toBe(true);
    tick(s, bus, 0.4);
    expect(s.player.x).toBeGreaterThan(330);
    expect(e.statuses.some((st) => st.kind === 'zablokowany')).toBe(true);
  });

  it('Proszę czekać blocks the nearest enemy and draws an hourglass', () => {
    const s = run('konsultant');
    const bus = createBus();
    const near = addEnemy(s, 60);
    const far = addEnemy(s, 200);
    castSkill(s, bus, 0);
    expect(near.statuses.some((st) => st.kind === 'zablokowany')).toBe(true);
    expect(far.statuses.some((st) => st.kind === 'zablokowany')).toBe(false);
    expect(s.zones.some((z) => z.variant === 'hourglass' && z.follow === near.id)).toBe(true);
  });

  it('Przekierowuję: only enemies in the cone are zgloszony', () => {
    const s = run('konsultant');
    const bus = createBus();
    const front = addEnemy(s, 80, 0);
    const behind = addEnemy(s, -80, 0);
    s.player.facing = 1;
    castSkill(s, bus, 1);
    expect(front.statuses.some((st) => st.kind === 'zgloszony')).toBe(true);
    expect(behind.statuses.some((st) => st.kind === 'zgloszony')).toBe(false);
  });

  it('Przybycie przed wyjazdem: copies live 8 s, two at most, each with a footnote', () => {
    const s = run('petlowiec');
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const expired: number[] = [];
    bus.on('summon:expired', (e) => expired.push(e.id));
    for (let i = 0; i < 3; i++) {
      s.hero.cd[0] = 0;
      expect(castSkill(s, bus, 0)).toBe(true);
    }
    expect(s.summons.filter((m) => m.variant === 'copy')).toHaveLength(2);
    expect(expired).toHaveLength(1);
    expect(notes).toHaveLength(3);
    expect(notes.every((n) => n.startsWith('Kopia'))).toBe(true);
    tick(s, bus, 8.5);
    expect(s.summons).toHaveLength(0);
  });

  it('copies attack the nearest enemy', () => {
    const s = run('petlowiec');
    const bus = createBus();
    const e = addEnemy(s, 90);
    castSkill(s, bus, 0);
    tick(s, bus, 4);
    expect(e.hp).toBeLessThan(500);
  });

  it('Triangulacja pierces every enemy on the line and hits harder with each', () => {
    const s = run('kartograf');
    const bus = createBus();
    const a = addEnemy(s, 70, 0);
    const b = addEnemy(s, 140, 2);
    const c = addEnemy(s, 210, -2);
    const off = addEnemy(s, 140, 120);
    s.player.stats.critChance = 0;
    s.player.stats.dmgMin = s.player.stats.dmgMax = 10;
    castSkill(s, bus, 0);
    expect(s.projectiles[0]?.pierce).toBeGreaterThan(5);
    tick(s, bus, 0.6);
    const lost = (e: typeof a): number => 500 - e.hp;
    expect(lost(a)).toBeGreaterThan(0);
    expect(lost(b)).toBeGreaterThan(lost(a));
    expect(lost(c)).toBeGreaterThan(lost(b));
    expect(lost(off)).toBe(0);
  });

  it('Teren nieistniejacy marks an area: do_weryfikacji inside, existence 0.3 for those that have one', () => {
    const s = run('kartograf');
    const bus = createBus();
    const inside = addEnemy(s, 100);
    const outside = addEnemy(s, 600);
    (inside as { existence?: number }).existence = 1;
    castSkill(s, bus, 1);
    expect(s.zones.some((z) => z.variant === 'teren')).toBe(true);
    tick(s, bus, 0.2);
    expect(inside.statuses.some((st) => st.kind === 'do_weryfikacji')).toBe(true);
    expect((inside as { existence?: number }).existence).toBe(0.3);
    expect(outside.statuses.some((st) => st.kind === 'do_weryfikacji')).toBe(false);
  });

  it('Korekta blinks and leaves a decoy that taunts with przeczytane', () => {
    const s = run('kartograf');
    const bus = createBus();
    const e = addEnemy(s, 80);
    const x0 = s.player.x;
    s.player.facing = -1;
    castSkill(s, bus, 2);
    expect(s.player.x).toBeLessThan(x0 - 50);
    const decoy = s.summons.find((m) => m.variant === 'decoy');
    expect(decoy).toBeDefined();
    expect(decoy?.damageMul).toBe(0);
    const taunt = e.statuses.find((st) => st.kind === 'przeczytane');
    expect(taunt?.source).toBe(decoy?.id);
  });

  it('Czy moge jeszcze w czyms pomoc: more crit while it lasts, then back to normal', () => {
    const s = run('konsultant');
    const bus = createBus();
    const before = s.player.stats.critChance;
    castSkill(s, bus, 2);
    expect(s.player.stats.critChance).toBeGreaterThan(before);
    tick(s, bus, 7);
    expect(s.player.stats.critChance).toBeCloseTo(before, 5);
  });
});

describe('suspended and shielded', () => {
  it('suspended: enemies do not attack the player, -30% damage, no pickups', async () => {
    const { enemiesAttack } = await import('../systems/combat');
    const { collectPickups } = await import('../systems/pickups');
    const { createPickup } = await import('../entities/factory');
    const s = run('pralka');
    const bus = createBus();
    const e = addEnemy(s, 10);
    e.attackTimer = 0;
    s.player.suspended = true;
    const hp = s.player.hp;
    enemiesAttack(s, bus, 1);
    expect(s.player.hp).toBe(hp);
    s.pickups.push(createPickup(nextId(s), s.player.x, s.player.y, 1));
    collectPickups(s, bus);
    expect(s.pickups).toHaveLength(1);
    s.player.suspended = false;
    e.attackTimer = 0;
    e.stats.pewnoscSiebie = 1e6;
    for (let i = 0; i < 20 && s.player.hp === hp; i++) {
      e.attackTimer = 0;
      enemiesAttack(s, bus, 0.01);
    }
    expect(s.player.hp).toBeLessThan(hp);
  });

  it('suspended players deal 30% less damage', async () => {
    const { playerDamageMul } = await import('./shield');
    expect(playerDamageMul({ suspended: false })).toBe(1);
    expect(playerDamageMul({ suspended: true })).toBeCloseTo(0.7, 5);
  });

  it('the shield soaks damage before racja', async () => {
    const { applyDamage } = await import('../systems/combat');
    const s = run('pralka');
    const bus = createBus();
    s.player.shield = 20;
    const hp = s.player.hp;
    applyDamage(s, bus, s.player, 15, false);
    expect(s.player.shield).toBe(5);
    expect(s.player.hp).toBe(hp);
    applyDamage(s, bus, s.player, 15, false);
    expect(s.player.shield).toBe(0);
    expect(s.player.hp).toBe(hp - 10);
  });

  it('the Pralka quirk: every 10th hit fires a random skill for free, and only hers', async () => {
    const { onPlayerHit } = await import('./quirks');
    const s = run('pralka');
    const bus = createBus();
    addEnemy(s, 40);
    const casts: boolean[] = [];
    bus.on('skill:cast', (e) => casts.push(e.free));
    s.hero.cd = [3, 3, 3, 3, 3];
    for (let i = 1; i <= 9; i++) expect(onPlayerHit(s, bus)).toBe(false);
    expect(casts).toHaveLength(0);
    onPlayerHit(s, bus);
    expect(casts).toEqual([true]);
    expect(s.hero.cd).toEqual([3, 3, 3, 3, 3]);
    for (let i = 1; i <= 10; i++) onPlayerHit(s, bus);
    expect(casts).toHaveLength(2);
    const k = run('konsultant');
    for (let i = 1; i <= 10; i++) expect(onPlayerHit(k, bus)).toBe(false);
  });
});
