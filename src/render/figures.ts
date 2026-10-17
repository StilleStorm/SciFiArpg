/**
 * PLACEHOLDER figures: an inked player, a crude contraption, a plate on the ground.
 * Heroes and enemies agents replace player/enemy builders (keep the Builder contract in view.ts).
 */
import { createRng } from '../core/rng';
import type { Enemy, Pickup, Player, Projectile } from '../entities';
import { el, n2 } from './svg';
import { buildPickupCard } from './pickupCard';
import type { Builder } from './view';

const LEG_PERIOD_MS = 150;
/** Figures are drawn on a ~40 unit grid and enlarged a little for readability. */
const FIG_SCALE = 1.3;
const scaled = (): SVGGElement => el('g', { transform: `scale(${FIG_SCALE})` });
const legPhase = (timeMs: number, moving: boolean): 0 | 1 => (moving ? ((Math.floor(timeMs / LEG_PERIOD_MS) % 2) as 0 | 1) : 0);

// ---------- player: drum body, funnel head, two stilt legs ----------
const PLAYER_LEGS: readonly [string, string][] = [
  ['M-5 7L-8 18L-12 18', 'M5 7L7 16L11 16'],
  ['M-5 7L-3 16L-7 16', 'M5 7L9 18L13 18'],
];

export function buildPlayer(): SVGGElement {
  const g = el('g', { class: 'player' });
  const inner = scaled();
  g.append(inner);
  inner.append(
    el('path', { d: 'M-6-23L6-23L3-15L-3-15Z' }), // funnel head
    el('path', { d: 'M0-15L0-11M-6-23Q0-25 6-23' }), // neck, rim
    el('path', { d: 'M9-10L9 5M-9-10L-9 5M-9 5Q0 10 9 5' }), // drum sides + base
    el('ellipse', { cx: 0, cy: -10, rx: 9, ry: 3 }), // drum top
    el('path', { d: 'M-9-2Q0 3 9-2' }), // hoop
    el('path', { d: 'M3-8L9-8L9 5L3 6Z', fill: 'url(#hatch)', stroke: 'none' }), // hatched flank
    el('path', { 'data-leg': 0, d: PLAYER_LEGS[0]?.[0] }),
    el('path', { 'data-leg': 1, d: PLAYER_LEGS[0]?.[1] }),
  );
  return g;
}

function patchPlayer(e: Player, g: SVGGElement, timeMs: number): void {
  const phase = legPhase(timeMs, e.moving);
  setLegs(g, PLAYER_LEGS[phase] ?? PLAYER_LEGS[0] ?? ['', ''], phase);
}

function setLegs(g: SVGGElement, ds: readonly string[], phase: number): void {
  if (g.dataset['phase'] === String(phase)) return;
  g.dataset['phase'] = String(phase);
  g.querySelectorAll<SVGPathElement>('[data-leg]').forEach((p, i) => {
    const d = ds[i];
    if (d !== undefined) p.setAttribute('d', d);
  });
}

// ---------- enemy: box, three legs, antenna ----------
interface EnemyShape {
  w: number;
  h: number;
  lean: number;
  legLen: number;
}

function enemyShape(seed: number): EnemyShape {
  const r = createRng(seed).fork('shape');
  return { w: r.range(22, 30), h: r.range(16, 22), lean: r.range(-3, 3), legLen: r.range(11, 15) };
}

function enemyLegs(s: EnemyShape, phase: number): string[] {
  const bottom = s.h / 2 - 1;
  return [-1, 0, 1].map((slot) => {
    const x = slot * (s.w / 3);
    const kick = (slot + phase) % 2 === 0 ? 3 : -3;
    const knee = bottom + s.legLen * 0.55;
    return `M${n2(x)} ${n2(bottom)}L${n2(x + kick)} ${n2(knee)}L${n2(x + kick * 0.3)} ${n2(bottom + s.legLen)}l${slot === 0 ? -3 : 3} 0`;
  });
}

export function buildEnemy(e: Enemy): SVGGElement {
  const s = enemyShape(e.seed);
  const g = el('g', { class: 'enemy' });
  const inner = scaled();
  g.append(inner);
  const top = -s.h / 2 - 2;
  const legs = enemyLegs(s, 0);
  inner.append(
    el('rect', { x: n2(-s.w / 2), y: n2(top), width: n2(s.w), height: n2(s.h), transform: `rotate(${n2(s.lean)})` }),
    el('rect', { x: n2(-s.w / 2 + 2), y: n2(top + s.h * 0.55), width: n2(s.w - 4), height: n2(s.h * 0.4), fill: 'url(#hatch)', stroke: 'none', transform: `rotate(${n2(s.lean)})` }),
    el('circle', { cx: n2(-s.w / 5), cy: n2(top + s.h * 0.32), r: 3.2 }), // gauge
    el('path', { d: `M${n2(-s.w / 5)} ${n2(top + s.h * 0.32)}l2 -2` }),
    el('circle', { cx: n2(s.w / 4), cy: n2(top + s.h * 0.3), r: 1.6 }), // lamp
    el('path', { d: `M${n2(s.w / 4)} ${n2(top)}L${n2(s.w / 4 + s.lean)} ${n2(top - 11)}` }), // antenna
    el('circle', { cx: n2(s.w / 4 + s.lean), cy: n2(top - 13), r: 2.1 }),
    ...legs.map((d, i) => el('path', { 'data-leg': i, d })),
  );
  return g;
}

function patchEnemy(e: Enemy, g: SVGGElement, timeMs: number): void {
  const phase = legPhase(timeMs, e.moving);
  setLegs(g, enemyLegs(enemyShape(e.seed), phase), phase);
}

// ---------- pickup: a small numbered plate ----------
export function buildPickup(e: Pickup): SVGGElement {
  return buildPickupCard(e);
}

// ---------- projectile ----------
export function buildProjectile(): SVGGElement {
  const g = el('g', { class: 'projectile' });
  g.append(el('path', { d: 'M-5 0L3 0' }), el('circle', { cx: 4, cy: 0, r: 1.5 }));
  return g;
}

export const placeholderBuilders = {
  player: { create: () => buildPlayer(), patch: patchPlayer, drawInMs: 0 } satisfies Builder<Player>,
  enemy: { create: buildEnemy, patch: patchEnemy, drawInMs: 320 } satisfies Builder<Enemy>,
  pickup: { create: buildPickup, drawInMs: 260 } satisfies Builder<Pickup>,
  projectile: { create: () => buildProjectile(), drawInMs: 0 } satisfies Builder<Projectile>,
};
