/**
 * The plain figures that remain from the skeleton: the small contraption on the title screen, the plate or
 * star on the ground and the projectile stroke. Heroes, enemies and summons have their own builders
 * (heroFigures.ts, enemyFigures.ts).
 */
import { createRng } from '../core/rng';
import type { Enemy, Pickup, Projectile } from '../entities';
import { el, n2 } from './svg';
import { buildPickupCard } from './pickupCard';
import type { Builder } from './view';

/** Figures are drawn on a ~40 unit grid and enlarged a little for readability. */
const FIG_SCALE = 1.3;
const scaled = (): SVGGElement => el('g', { transform: `scale(${FIG_SCALE})` });

// ---------- title screen contraption: box, three legs, antenna ----------
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
    ...legs.map((d) => el('path', { d })),
  );
  return g;
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

export const groundBuilders = {
  pickup: { create: buildPickup, drawInMs: 260 } satisfies Builder<Pickup>,
  projectile: { create: () => buildProjectile(), drawInMs: 0 } satisfies Builder<Projectile>,
};
