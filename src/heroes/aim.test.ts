import { describe, expect, it } from 'vitest';
import { createBus, type GameEvents } from '../core/events';
import { createEnemy } from '../entities/factory';
import { createRun, nextId, type RunState } from '../world/run';
import {
  AHEAD,
  AUTO_AIM,
  autoTarget,
  blinkOf,
  clearQueuedAim,
  DRAG_SCALE,
  dragToAim,
  fitAim,
  isCancel,
  isTap,
  PAD_R,
  pickTarget,
  PICK_RADIUS,
  previewOf,
  queueAim,
  reachOf,
  resolveAim,
  TARGET_RING,
  resolveDirection,
  terenCentre,
} from './aim';
import { heroDef } from './defs';
import type { HeroId } from './index';
import { castSkill } from './skills';
import { heroStep } from './system';

function run(heroId: HeroId): RunState {
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.page.obstacles.length = 0; // an open page: a dash or a blink is never stopped by a drawing
  s.player.x = 600;
  s.player.y = 400;
  s.player.facing = 1;
  return s;
}

function addEnemy(s: RunState, dx: number, dy = 0) {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = 500;
  s.enemies.push(e);
  return e;
}

const skillOf = (s: RunState, slot: 0 | 1 | 2) => heroDef(s.player.heroId).skills[slot];

function tick(s: RunState, bus: ReturnType<typeof createBus>, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    heroStep(s, bus, 1 / 60);
  }
}

describe('the skills declare an aim mode', () => {
  it('as DESIGN 5.6 lists them', () => {
    const modes = (id: HeroId): string[] => heroDef(id).skills.map((sk) => sk.aim);
    expect(modes('pralka')).toEqual(['auto', 'auto', 'kierunek', 'kierunek', 'auto', 'auto', 'auto', 'auto', 'auto', 'wskazanie']);
    expect(modes('konsultant')).toEqual(['wskazanie', 'kierunek', 'auto', 'wskazanie', 'kierunek', 'auto', 'wskazanie', 'auto', 'kierunek', 'wskazanie']);
    expect(modes('petlowiec')).toEqual(['auto', 'auto', 'auto', 'auto', 'wskazanie', 'auto', 'kierunek', 'wskazanie', 'auto', 'auto']);
    expect(modes('kartograf')).toEqual(['kierunek', 'wskazanie', 'wskazanie', 'auto', 'wskazanie', 'auto', 'kierunek', 'kierunek', 'wskazanie', 'auto']);
    expect(modes('nalesnik')).toEqual(['kierunek', 'auto', 'wskazanie', 'auto', 'kierunek', 'auto', 'auto', 'auto', 'wskazanie', 'wskazanie']);
  });
});

describe('autoTarget', () => {
  it('takes the nearest enemy in range', () => {
    const s = run('pralka');
    addEnemy(s, 150);
    const near = addEnemy(s, 60, 10);
    expect(autoTarget(s, skillOf(s, 2))).toBe(near);
  });

  it('takes an enemy whose claim has the skill type (a rebuttal) before a nearer one', () => {
    const s = run('pralka'); // Odwirowanie is mechaniczny
    const near = addEnemy(s, 50);
    const match = addEnemy(s, 180);
    near.claim = { textKey: 'x', type: 'regulaminowy' };
    match.claim = { textKey: 'x', type: 'mechaniczny' };
    expect(autoTarget(s, skillOf(s, 2))).toBe(match);
  });

  it('the nearest of several matching enemies wins; a struck claim no longer matches', () => {
    const s = run('pralka');
    const a = addEnemy(s, 200);
    const b = addEnemy(s, 120);
    const struck = addEnemy(s, 40);
    a.claim = { textKey: 'x', type: 'mechaniczny' };
    b.claim = { textKey: 'x', type: 'mechaniczny' };
    struck.claim = { textKey: 'x', type: 'mechaniczny', struck: true };
    expect(autoTarget(s, skillOf(s, 2))).toBe(b);
  });

  it('a matching enemy out of range does not count; nobody in range is null', () => {
    const s = run('pralka');
    const near = addEnemy(s, 80);
    const far = addEnemy(s, 400);
    far.claim = { textKey: 'x', type: 'mechaniczny' };
    expect(autoTarget(s, skillOf(s, 2))).toBe(near);
    s.enemies.splice(s.enemies.indexOf(near), 1);
    expect(autoTarget(s, skillOf(s, 2))).toBeNull();
  });
});

describe('dragToAim, isCancel, isTap', () => {
  const pad = { x: 300, y: 700 };
  const hero = { x: 500, y: 400 };

  it('kierunek: the unit vector of the drag from the pad centre', () => {
    const a = dragToAim('kierunek', pad, { x: 300, y: 600 }, hero, 200);
    expect(a).toEqual({ kind: 'kierunek', dx: 0, dy: -1 });
    const b = dragToAim('kierunek', pad, { x: 360, y: 780 }, hero, 200);
    expect(b.kind).toBe('kierunek');
    if (b.kind === 'kierunek') {
      expect(Math.hypot(b.dx, b.dy)).toBeCloseTo(1, 6);
      expect(b.dx).toBeCloseTo(0.6, 6);
      expect(b.dy).toBeCloseTo(0.8, 6);
    }
  });

  it('wskazanie: the hero position plus the drag, 1 px = 1.6 units', () => {
    const a = dragToAim('wskazanie', pad, { x: 350, y: 650 }, hero, 500);
    expect(a).toEqual({ kind: 'wskazanie', x: 500 + 50 * DRAG_SCALE, y: 400 - 50 * DRAG_SCALE });
  });

  it('wskazanie: held to the skill range from the hero', () => {
    const a = dragToAim('wskazanie', pad, { x: 300, y: 300 }, hero, 150);
    expect(a.kind).toBe('wskazanie');
    if (a.kind === 'wskazanie') {
      expect(Math.hypot(a.x - hero.x, a.y - hero.y)).toBeCloseTo(150, 6);
      expect(a.x).toBeCloseTo(500, 6);
      expect(a.y).toBeCloseTo(250, 6);
    }
  });

  it('an auto skill or a drag without length is the auto aim', () => {
    expect(dragToAim('auto', pad, { x: 100, y: 100 }, hero, 200)).toBe(AUTO_AIM);
    expect(dragToAim('kierunek', pad, pad, hero, 200)).toBe(AUTO_AIM);
  });

  it('cancel: the pointer is back over the pad circle', () => {
    expect(isCancel({ x: 305, y: 705 }, pad)).toBe(true);
    expect(isCancel({ x: 300 + PAD_R, y: 700 }, pad)).toBe(true);
    expect(isCancel({ x: 300 + PAD_R + 1, y: 700 }, pad)).toBe(false);
  });

  it('a tap is under 180 ms and under 8 px', () => {
    expect(isTap(120, 3)).toBe(true);
    expect(isTap(180, 3)).toBe(false);
    expect(isTap(100, 8)).toBe(false);
  });

  it('an aim of the wrong kind for the skill is the auto aim', () => {
    const s = run('pralka');
    expect(fitAim(skillOf(s, 2), { kind: 'wskazanie', x: 1, y: 2 })).toBe(AUTO_AIM);
    const k = { kind: 'kierunek', dx: 1, dy: 0 } as const;
    expect(fitAim(skillOf(s, 2), k)).toBe(k);
  });
});

describe('a tap on a kierunek skill', () => {
  it('uses the joystick direction while the stick is held', () => {
    const s = run('pralka');
    addEnemy(s, 100, 0);
    s.player.steer = { dx: 0, dy: -1, mag: 0.7 };
    const d = resolveDirection(s, skillOf(s, 2), AUTO_AIM);
    expect(d.dx).toBeCloseTo(0, 6);
    expect(d.dy).toBeCloseTo(-1, 6);
  });

  it('else the direction to the auto target', () => {
    const s = run('pralka');
    addEnemy(s, 0, 100);
    const d = resolveDirection(s, skillOf(s, 2), AUTO_AIM);
    expect(d.dy).toBeCloseTo(1, 6);
    expect(d.target).not.toBeNull();
  });

  it('else the way the hero faces', () => {
    const s = run('pralka');
    s.player.facing = -1;
    expect(resolveDirection(s, skillOf(s, 2), AUTO_AIM)).toEqual({ dx: -1, dy: 0, target: null });
  });
});

describe('each aimed skill honours its aim', () => {
  it('Odwirowanie dashes in the aimed direction, away from the enemy it would have chosen', () => {
    const s = run('pralka');
    const bus = createBus();
    addEnemy(s, 90, 0);
    const x0 = s.player.x;
    const y0 = s.player.y;
    expect(castSkill(s, bus, 2, false, { kind: 'kierunek', dx: 0, dy: 1 })).toBe(true);
    tick(s, bus, 0.4);
    expect(s.player.y - y0).toBeGreaterThan(100);
    expect(Math.abs(s.player.x - x0)).toBeLessThan(5);
  });

  it('Odwirowanie on a tap goes for the rebuttal target, not the nearest', () => {
    const s = run('pralka');
    const bus = createBus();
    addEnemy(s, 80, 0);
    const match = addEnemy(s, 0, 150);
    match.claim = { textKey: 'x', type: 'mechaniczny' };
    castSkill(s, bus, 2);
    expect(s.hero.dash?.drag).toBe(match.id);
    expect(s.hero.dash?.dy).toBeCloseTo(1, 6);
  });

  it('Przekierowuję opens the cone in the aimed direction', () => {
    const s = run('konsultant');
    const bus = createBus();
    s.player.facing = 1;
    const up = addEnemy(s, 0, -90);
    const right = addEnemy(s, 90, 0);
    expect(castSkill(s, bus, 1, false, { kind: 'kierunek', dx: 0, dy: -1 })).toBe(true);
    expect(up.statuses.some((st) => st.kind === 'zgloszony')).toBe(true);
    expect(right.statuses.some((st) => st.kind === 'zgloszony')).toBe(false);
  });

  it('Triangulacja fires along the aimed direction', () => {
    const s = run('kartograf');
    const bus = createBus();
    addEnemy(s, 120, 0);
    expect(castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 0, dy: 1 })).toBe(true);
    const shot = s.projectiles[0];
    expect(shot?.vx).toBeCloseTo(0, 6);
    expect(shot?.vy ?? 0).toBeGreaterThan(600);
  });

  it('no skill is cast while a sheet holds the clock', () => {
    const s = run('kartograf');
    s.modal = 'cookies';
    expect(castSkill(s, createBus(), 0, false, { kind: 'kierunek', dx: 0, dy: 1 })).toBe(false);
  });

  it('Triangulacja reports a line as long as the shot flies', () => {
    const s = run('kartograf');
    const bus = createBus();
    const lines: { x2: number; y2: number }[] = [];
    bus.on('skill:fx', (e) => e.kind === 'line' && lines.push(e));
    castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 });
    expect(lines[0]?.x2).toBeCloseTo(s.player.x + reachOf(s, skillOf(s, 0)), 6);
  });

  it('Proszę czekać takes the enemy nearest to the aimed point, within 60 units', () => {
    const s = run('konsultant');
    const bus = createBus();
    const nearHero = addEnemy(s, 50, 0);
    const atPoint = addEnemy(s, 0, 200);
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: s.player.x + PICK_RADIUS - 5, y: s.player.y + 200 })).toBe(true);
    expect(atPoint.statuses.some((st) => st.kind === 'zablokowany')).toBe(true);
    expect(nearHero.statuses.some((st) => st.kind === 'zablokowany')).toBe(false);
    expect(s.zones.some((z) => z.variant === 'hourglass' && z.follow === atPoint.id)).toBe(true);
  });

  it('Proszę czekać with a point that has nobody near falls back to the auto target', () => {
    const s = run('konsultant');
    const bus = createBus();
    const e = addEnemy(s, 100, 0);
    expect(pickTarget(s, skillOf(s, 0), { kind: 'wskazanie', x: s.player.x - 200, y: s.player.y - 200 })).toBe(e);
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: s.player.x - 200, y: s.player.y - 200 })).toBe(true);
    s.enemies.length = 0;
    s.hero.cd[0] = 0;
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: s.player.x, y: s.player.y })).toBe(false);
    expect(s.hero.cd[0]).toBe(0);
  });

  it('Teren nieistniejący marks the area at the aimed point', () => {
    const s = run('kartograf');
    const bus = createBus();
    addEnemy(s, 100, 0);
    expect(castSkill(s, bus, 1, false, { kind: 'wskazanie', x: 700, y: 520 })).toBe(true);
    const zone = s.zones.find((z) => z.variant === 'teren');
    expect(zone?.x).toBe(700);
    expect(zone?.y).toBe(520);
  });

  it('Teren nieistniejący on a tap marks the auto target, else a point ahead', () => {
    const s = run('kartograf');
    const e = addEnemy(s, 150, 40);
    expect(terenCentre(s, skillOf(s, 1), AUTO_AIM)).toEqual({ x: e.x, y: e.y });
    s.enemies.length = 0;
    expect(terenCentre(s, skillOf(s, 1), AUTO_AIM)).toEqual({ x: s.player.x + AHEAD, y: s.player.y });
    s.player.steer = { dx: 0, dy: 1, mag: 1 };
    const c = terenCentre(s, skillOf(s, 1), AUTO_AIM);
    expect(c.x).toBeCloseTo(s.player.x, 6);
    expect(c.y).toBeCloseTo(s.player.y + AHEAD, 6);
  });

  it('Teren nieistniejący holds a far point to its range', () => {
    const s = run('kartograf');
    const c = terenCentre(s, skillOf(s, 1), { kind: 'wskazanie', x: s.player.x + 900, y: s.player.y });
    expect(c.x).toBeCloseTo(s.player.x + reachOf(s, skillOf(s, 1)), 6);
  });

  it('Korekta blinks to the aimed point', () => {
    const s = run('kartograf');
    const bus = createBus();
    const e = addEnemy(s, 80, 0);
    const x0 = s.player.x;
    const y0 = s.player.y;
    expect(castSkill(s, bus, 2, false, { kind: 'wskazanie', x: x0, y: y0 - 100 })).toBe(true);
    expect(s.player.x).toBeCloseTo(x0, 3);
    expect(s.player.y).toBeCloseTo(y0 - 100, 3);
    expect(e.statuses.some((st) => st.kind === 'przeczytane')).toBe(true);
  });

  it('Korekta blinks no farther than its reach, and a tap goes ahead, not into the nearest enemy', () => {
    const s = run('kartograf');
    const reach = reachOf(s, skillOf(s, 2));
    expect(blinkOf(s, skillOf(s, 2), { kind: 'wskazanie', x: s.player.x + 900, y: s.player.y }).len).toBeCloseTo(reach, 6);
    addEnemy(s, 80, 0);
    s.player.facing = -1;
    const b = blinkOf(s, skillOf(s, 2), AUTO_AIM);
    expect(b.dx).toBe(-1);
    expect(b.len).toBe(AHEAD);
  });

  it('Korekta on a tap blinks toward where the hero walks', () => {
    const s = run('kartograf');
    s.player.target = { x: s.player.x, y: s.player.y + 60 };
    const b = blinkOf(s, skillOf(s, 2), AUTO_AIM);
    expect(b.dy).toBeCloseTo(1, 6);
    expect(b.len).toBeCloseTo(60, 6);
  });

  it('auto skills ignore an aim', () => {
    const s = run('pralka');
    const bus = createBus();
    const e = addEnemy(s, 50, 0);
    const hp = e.hp;
    expect(castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 0, dy: 1 })).toBe(true);
    expect(e.hp).toBeLessThan(hp);
  });
});

describe('castSkill and the aim', () => {
  it('takes the queued aim of the pad when it is called without one, once', () => {
    const s = run('pralka');
    const bus = createBus();
    queueAim(2, { kind: 'kierunek', dx: 0, dy: 1 });
    castSkill(s, bus, 2);
    clearQueuedAim();
    expect(s.hero.dash?.dy).toBeCloseTo(1, 6);
    s.hero.cd[2] = 0;
    s.hero.dash = null;
    castSkill(s, bus, 2);
    const dash = s.hero.dash as { dy: number } | null;
    expect(dash?.dy).toBe(0); // the queue was spent: this one is a tap
  });

  it('a queued aim for another slot is not used', () => {
    const s = run('pralka');
    const bus = createBus();
    queueAim(0, { kind: 'kierunek', dx: 0, dy: 1 });
    castSkill(s, bus, 2);
    clearQueuedAim();
    expect(s.hero.dash?.dy).toBe(0);
  });

  it('a free cast (błąd programu) is the auto cast whatever is queued', () => {
    const s = run('pralka');
    const bus = createBus();
    queueAim(2, { kind: 'kierunek', dx: 0, dy: 1 });
    castSkill(s, bus, 2, true);
    clearQueuedAim();
    expect(s.hero.dash?.dy).toBe(0);
  });

  it('skill:cast reports the aim it used', () => {
    const s = run('kartograf');
    const bus = createBus();
    const seen: GameEvents['skill:cast'][] = [];
    bus.on('skill:cast', (e) => seen.push(e));
    castSkill(s, bus, 1, false, { kind: 'wskazanie', x: 650, y: 450 });
    expect(seen[0]?.aim).toMatchObject({ kind: 'wskazanie', x: 650, y: 450 });
    castSkill(s, bus, 0);
    expect(seen[1]?.aim?.kind).toBe('auto');
  });

  it('a cooldown is spent only by a cast that happened', () => {
    const s = run('konsultant');
    const bus = createBus();
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: 0, y: 0 })).toBe(false);
    expect(s.hero.cd[0]).toBe(0);
  });
});

describe('the preview says what the skill will do', () => {
  it('kierunek: an arrow from the hero, as long as the skill reaches', () => {
    const s = run('pralka');
    const sk = skillOf(s, 2);
    const pv = previewOf(s, sk, { kind: 'kierunek', dx: 0, dy: 1 });
    expect(pv).toEqual({ kind: 'arrow', x: s.player.x, y: s.player.y, x2: s.player.x, y2: s.player.y + reachOf(s, sk) });
    const k = run('kartograf');
    const line = previewOf(k, skillOf(k, 0), { kind: 'kierunek', dx: 1, dy: 0 });
    expect(line?.kind === 'arrow' && line.x2 - line.x).toBeCloseTo(reachOf(k, skillOf(k, 0)), 6);
  });

  it('wskazanie: Teren draws its radius, Korekta a small circle at the blink point', () => {
    const s = run('kartograf');
    const t = previewOf(s, skillOf(s, 1), { kind: 'wskazanie', x: 700, y: 450 });
    expect(t).toEqual({ kind: 'circle', x: 700, y: 450, r: 85 });
    const k = previewOf(s, skillOf(s, 2), { kind: 'wskazanie', x: 600, y: 300 });
    expect(k).toEqual({ kind: 'circle', x: 600, y: 300, r: 14 });
  });

  it('Proszę czekać: a circle on the enemy that would be targeted, else on the point; nothing for a tap with nobody', () => {
    const s = run('konsultant');
    const sk = skillOf(s, 0);
    expect(previewOf(s, sk, AUTO_AIM)).toBeNull();
    const e = addEnemy(s, 0, 150);
    expect(previewOf(s, sk, { kind: 'wskazanie', x: s.player.x + 20, y: s.player.y + 150 })).toEqual({ kind: 'circle', x: e.x, y: e.y, r: e.r + TARGET_RING });
    expect(previewOf(s, sk, { kind: 'wskazanie', x: s.player.x - 300, y: s.player.y - 100 })).toMatchObject({ kind: 'circle', x: e.x, y: e.y });
    s.enemies.length = 0;
    expect(previewOf(s, sk, { kind: 'wskazanie', x: 650, y: 400 })).toEqual({ kind: 'circle', x: 650, y: 400, r: 14 });
  });

  it('an auto skill has no preview, and resolveAim fills both direction and point', () => {
    const s = run('pralka');
    expect(previewOf(s, skillOf(s, 0), AUTO_AIM)).toBeNull();
    const r = resolveAim(s, skillOf(s, 2), { kind: 'kierunek', dx: 0, dy: 2 });
    expect(r.kind).toBe('kierunek');
    expect(r.dy).toBeCloseTo(1, 6);
    expect(r.y).toBeCloseTo(s.player.y + reachOf(s, skillOf(s, 2)), 6);
    expect(resolveAim(s, skillOf(s, 2), AUTO_AIM).kind).toBe('auto');
  });
});
