/**
 * Hero figures in the manner of Mroz: spindly, assembled from small parts, hatched. About 64 world units tall,
 * origin near the middle of the body. Legs swap between two frames (patch); nothing is rebuilt per frame.
 * Also the builders for summons (a dotted copy "z innej petli"), projectiles (a short ink dash), and a wrapper
 * that draws an enemy with `copyOf` as the hero it copies.
 */
import { createRng } from '../core/rng';
import type { Enemy, Player, Projectile, Summon } from '../entities/types';
import type { HeroId } from '../heroes';
import { t } from '../i18n';
import { el, n2 } from './svg';
import type { Builder } from './view';
import '../ui/forms.css';

const LEG_PERIOD_MS = 150;
/** Heroes, summons and hero copies are drawn this much larger on the page (the profile card keeps 1). */
export const HERO_SCALE = 1.15;

interface FigureDef {
  scale: number;
  /** Strokes. */
  body: readonly string[];
  /** Hatched fills (no stroke). */
  hatch: readonly string[];
  /** Hatched circles [cx, cy, r]. */
  hatchCircles?: readonly (readonly [number, number, number])[];
  /** Circles [cx, cy, r]. */
  circles: readonly (readonly [number, number, number])[];
  /** Two leg frames, each [left, right]. */
  legs: readonly [readonly [string, string], readonly [string, string]];
  /** Dotted extras that stay dotted even on a solid figure. */
  echo?: readonly (readonly [number, number, number])[];
}

const FIGURES: Record<HeroId, FigureDef> = {
  // a washing machine with opinions, a hose and a pending application
  pralka: {
    scale: 1.4,
    body: [
      'M-17-21H17V12H-17Z', // cabinet
      'M-17-13H17', // control panel
      'M3-18.5H13V-15.5H3Z', // detergent slot
      'M-14-9L-8-7.5M14-9L8-7.5', // brows
      'M-5 9.5Q0 7.5 5 9.5', // mouth
      'M0-21V-25M-3-25Q0-28.5 3-25', // lint tuft
      'M-17-6Q-25-5-26 3', // left arm
      'M17-6Q25-8 27-1', // right arm
      'M24-1L33-3L34 9L25 11Z', // application form
      'M26 2.5L32 1.5M26.5 5.5L32.5 4.5', // typed lines
      'M-17 6Q-24 9-22 15Q-20 19-15 17', // hose
      'M-3.5-4.5Q-1-6.5 2-5.5', // glare on the glass
      'M-15-19h.01M15-19h.01M-15 10h.01M15 10h.01M7-17h.01M10-17h.01', // rivets and dials
      'M-12 12V14M12 12V14', // adjustable feet
    ],
    hatch: ['M10-12H17V12H10Z'],
    hatchCircles: [[0, -2, 6]],
    circles: [
      [-11, -17, 2.2],
      [-5, -17, 1.5],
      [0, -2, 8.5], // porthole
      [0, -2, 6.8],
      [-26, 4, 1.6],
      [27, -1, 1.4],
    ],
    legs: [
      ['M-8 12L-9 17.5L-12 18.5', 'M8 12L9 17L12 17'],
      ['M-8 12L-6 17L-9 18.5', 'M8 12L11 17.5L14 18.5'],
    ],
  },
  // a helpline consultant who left the queue, still wearing the headset and dragging the cable
  konsultant: {
    scale: 1.35,
    body: [
      'M-6.5-26A6.5 6.5 0 0 1 6.5-26', // headband
      'M-8.5-27H-6V-22H-8.5Z', // ear cup
      'M-7.5-22Q-8-17-2.5-17', // boom
      'M-2-24.2h.01M2-24.2h.01M-1.5-21.3H1.5', // face
      'M0-18.5V-16',
      'M-8-16L8-16L9.5 3L-9.5 3Z', // jacket
      'M-8-16L0-7.5L8-16', // lapels
      'M0-16L-1.8-13L0-3L1.8-13Z', // tie
      'M-8-15L-14-8L-13-1', // arm with ticket
      'M-20-6L-11-8L-9 4L-18 6Z',
      'M-18-3L-12-4.5M-17.5 0L-11.5-1.5',
      'M8-15L13-8L12-1', // arm with cable
      'M12-1Q22 3 15 9Q8 14 20 17M20 16h3v3h-3Z', // cable and plug
      'M-6.5-10H-2.5V-8H-6.5Z', // name plate
      'M-5-29Q0-32 5-29', // hair
    ],
    hatch: ['M-1.6-13L0-3L1.6-13Z', 'M3.5-14L8.5-15L9.5 3L4 3Z'],
    circles: [
      [0, -24, 5.5],
      [-2, -17, 1.2],
    ],
    legs: [
      ['M-4.5 3L-5 12L-6.5 19H-2', 'M4.5 3L5.5 12L8 19H12'],
      ['M-4.5 3L-2.5 12L-4 19H0.5', 'M4.5 3L8 12L9.5 19H14'],
    ],
  },
  // a cosmonaut who arrived before departing: a second helmet, dotted, a little behind the first
  petlowiec: {
    scale: 1.3,
    body: [
      'M-6.5-24Q0-29 6.5-24L6-19Q0-15.5-6-19Z', // visor
      'M6-30L9-36', // antenna
      'M-5-12.5H5',
      'M-8-12H8L9 4H-9Z', // suit
      'M-4-9H4V-2H-4Z', // panel
      'M-9 1H9', // belt
      'M-8-10H-13.5V2H-8', // backpack
      'M-13.5-6Q-17-6-17 0', // tube
      'M-8-10L-14-4L-13 3', // arms
      'M8-10L14-5L16 1',
      'M-8.5-22h.01M8.5-22h.01M0-31.5h.01', // helmet rivets
      'M-13.5-6H-8M-13.5-2H-8', // tank ribs
      'M-4 9h.01M4 9h.01', // knee pads
    ],
    hatch: ['M-6-23.5Q0-27.5 6-23.5L5.6-19.8Q0-17 -5.6-19.8Z', 'M-3.2-8.2H3.2V-2.8H-3.2Z', 'M4-12H8L9 4H4.5Z'],
    circles: [
      [0, -22, 9.5],
      [9.5, -37, 1.3],
      [-13, 4, 1.8],
      [16, 2, 1.8],
      [0, -5.5, 1],
    ],
    echo: [[4.5, -24, 9.5]],
    legs: [
      ['M-4 4L-4.5 12L-8 17H-2.5', 'M4 4L5 11L8.5 17H14'],
      ['M-4 4L-2 12L-4.5 17H1', 'M4 4L8 12L7 17H12.5'],
    ],
  },
  // a surveyor of planets that only the navigation app confirms; carries the range pole and the map
  kartograf: {
    scale: 1.25,
    body: [
      'M-12-25Q0-29 12-25', // brim
      'M-6-26L-5-33H5L6-26', // crown
      'M-5.8-28.5H5.8',
      'M2-21.6h.01',
      'M-5.5-16L5.5-16L9 5L-9 5Z', // coat
      'M0-13h.01M0-9h.01M0-5h.01',
      'M3.5-11l1-1.5', // compass needle
      'M5.5-15L11-9L15-8', // arm and pole
      'M15-36V20',
      'M15-36L24-33L15-30Z', // flag
      'M13-24H17M13-14H17M13-4H17M13 6H17M13 16H17', // pole marks
      'M-17-10L-6-5L-7.5-1.5L-18.5-6.5Z', // rolled map
      'M-5.5-15L-10-9',
      'M-12-8.5l1 2.5',
    ],
    hatch: ['M-9 1L9 1L9 5L-9 5Z', 'M15-35.4L22.8-33L15-30.6Z', 'M2.5-15L5.5-15L9 5L3.5 5Z', 'M-5.8-30H5.8V-28.5H-5.8Z'],
    circles: [
      [0, -21, 4.8],
      [3.5, -11, 2],
    ],
    legs: [
      ['M-3 5L-4 13L-5 20H-1', 'M3 5L4.5 13L7 20H11'],
      ['M-3 5L-1 13L-2.5 20H1.5', 'M3 5L7 13L8.5 20H12.5'],
    ],
  },
};

interface Parts {
  inner: SVGGElement;
  legs: SVGPathElement[];
  foam: SVGGElement | null;
  caption: SVGTextElement | null;
  heroId: HeroId;
  scale: number;
}
const parts = new WeakMap<SVGGElement, Parts>();

const circlePath = (cx: number, cy: number, r: number): string => `M${n2(cx - r)} ${n2(cy)}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0`;

/** The shield: a ring of foam bubbles around the washing machine. */
function foamGroup(): SVGGElement {
  const g = el('g', { class: 'foam' });
  const rng = createRng(0xf0a);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const rr = rng.range(27, 32);
    g.append(el('circle', { cx: n2(Math.cos(a) * rr), cy: n2(-4 + Math.sin(a) * rr * 0.95), r: n2(rng.range(3, 5.6)) }));
  }
  for (let i = 0; i < 4; i++) g.append(el('circle', { cx: n2(rng.range(-22, 22)), cy: n2(rng.range(-24, 16)), r: n2(rng.range(1.2, 2.4)) }));
  g.style.display = 'none';
  return g;
}

export interface FigureOpts {
  /** Drawn in dotted line (a summon, "z innej petli"). */
  dotted?: boolean;
  /** Add the foam shield group (the player). */
  foam?: boolean;
  /** Caption written under the figure (kept upright when the figure faces left). */
  caption?: string;
  /** Extra size factor (HERO_SCALE on the page). */
  size?: number;
}

/** One hero figure as a `<g>`. Its legs are `data-leg` paths; `patchFigure` swaps them. */
export function buildHeroFigure(heroId: HeroId, opts: FigureOpts = {}): SVGGElement {
  const def = FIGURES[heroId];
  const g = el('g', { class: `hero hero-${heroId}${opts.dotted ? ' fig-dotted' : ''}` });
  const sc = def.scale * (opts.size ?? 1);
  const inner = el('g', { class: 'fig', transform: `scale(${n2(sc)})` });
  g.append(inner);
  for (const [cx, cy, r] of def.echo ?? []) {
    const echo = el('path', { d: circlePath(cx, cy, r), 'stroke-dasharray': '1.5 2.5' });
    inner.append(echo);
  }
  for (const d of def.hatch) inner.append(el('path', { d, fill: 'url(#hatch)', stroke: 'none' }));
  for (const [cx, cy, r] of def.hatchCircles ?? []) inner.append(el('path', { d: circlePath(cx, cy, r), fill: 'url(#hatch)', stroke: 'none' }));
  for (const d of def.body) inner.append(el('path', { d }));
  for (const [cx, cy, r] of def.circles) inner.append(el('path', { d: circlePath(cx, cy, r) }));
  const legs = [0, 1].map((i) => el('path', { 'data-leg': i, d: def.legs[0][i as 0 | 1] }));
  inner.append(...legs);
  const foam = opts.foam ? foamGroup() : null;
  if (foam) inner.append(foam);
  let caption: SVGTextElement | null = null;
  if (opts.caption) {
    caption = el('text', { class: 't-caption', x: 0, y: Math.round(36 * (opts.size ?? 1)) }, [opts.caption]);
    g.append(caption);
  }
  parts.set(g, { inner, legs, foam, caption, heroId, scale: sc });
  return g;
}

interface Walker {
  moving: boolean;
  facing?: 1 | -1;
  shield?: number;
  suspended?: boolean;
}

/** Legs, bob, foam, suspension, caption direction. Attribute writes only when something changed. */
export function patchFigure(e: Walker, g: SVGGElement, timeMs: number): void {
  const p = parts.get(g);
  if (!p) return;
  const phase = e.moving ? Math.floor(timeMs / LEG_PERIOD_MS) % 2 : 0;
  if (g.dataset['phase'] !== String(phase)) {
    g.dataset['phase'] = String(phase);
    const frame = FIGURES[p.heroId].legs[phase as 0 | 1];
    p.legs.forEach((leg, i) => leg.setAttribute('d', frame[i as 0 | 1]));
    p.inner.setAttribute('transform', `translate(0 ${phase ? -1 : 0}) scale(${p.scale})`);
  }
  if (p.foam) {
    const on = (e.shield ?? 0) > 0;
    if (g.dataset['foam'] !== String(on)) {
      g.dataset['foam'] = String(on);
      p.foam.style.display = on ? '' : 'none';
    }
  }
  const sus = e.suspended === true;
  if (g.dataset['sus'] !== String(sus)) {
    g.dataset['sus'] = String(sus);
    g.classList.toggle('suspended', sus);
  }
  if (p.caption && e.facing !== undefined && g.dataset['face'] !== String(e.facing)) {
    g.dataset['face'] = String(e.facing);
    p.caption.setAttribute('transform', e.facing < 0 ? 'scale(-1 1)' : '');
  }
}

// ---------- builders ----------

export const playerBuilder: Builder<Player> = {
  create: (e) => buildHeroFigure(e.heroId, { foam: e.heroId === 'pralka', size: HERO_SCALE }),
  patch: patchFigure,
  drawInMs: 0,
};

export const summonBuilder: Builder<Summon> = {
  create: (e) => {
    const opts: FigureOpts = { dotted: true, size: HERO_SCALE };
    if (e.variant === 'decoy') opts.caption = t('heroes.kartograf.decoy');
    return buildHeroFigure(e.heroId, opts);
  },
  patch: patchFigure,
  drawInMs: 260,
};

/** A short dash with a nub; regulaminowy is a folded sheet, egzystencjalny a question mark. Rotated once at creation. */
export const projectileBuilder: Builder<Projectile> = {
  create: (e) => {
    const g = el('g', { class: 'projectile' });
    const angle = (Math.atan2(e.vy, e.vx) * 180) / Math.PI;
    const inner = el('g', { transform: `rotate(${n2(angle)})` });
    const long = (e.pierce ?? 0) > 3;
    if (e.damageType === 'regulaminowy') {
      const sheet = el('g', { transform: `rotate(${n2(-angle)})` });
      sheet.append(el('path', { d: 'M-4.5-3.5H2.5L5 -1V3.5H-4.5Z' }), el('path', { d: 'M2.5-3.5V-1H5M-2.5 0H2M-2.5 2H1' }));
      g.append(sheet);
    } else if (e.damageType === 'egzystencjalny') {
      const mark = el('g', { transform: `rotate(${n2(-angle)})` });
      mark.append(el('path', { d: 'M-3.5-2.5Q-3.5-6 0-6Q3.5-6 3.5-2.8Q3.5-0.5 0 0.8V2.2M0 5h.01' }));
      g.append(mark);
    } else {
      inner.append(
        el('path', { d: long ? 'M-20 0L6 0M-13-2L-13 2M-6-2L-6 2' : 'M-6 0L3 0' }),
        el('path', { d: 'M3-1.8L7 0L3 1.8' }),
      );
      g.append(inner);
    }
    return g;
  },
  drawInMs: 0,
};

/**
 * Draw enemies with `copyOf` as the hero they copy, in plain ink, with a margin caption "kopia";
 * every other enemy goes to `base` (the enemies agent's builder).
 */
export function wrapEnemyBuilder(base: Builder<Enemy>): Builder<Enemy> {
  const wrapped: Builder<Enemy> = {
    create(e) {
      if (!e.copyOf) return base.create(e);
      const g = buildHeroFigure(e.copyOf.heroId, { caption: t('heroes.copy.caption'), size: HERO_SCALE });
      g.dataset['copy'] = '1';
      return g;
    },
    patch(e, g, timeMs) {
      if (g.dataset['copy'] === '1') patchFigure(e, g, timeMs);
      else base.patch?.(e, g, timeMs);
    },
  };
  if (base.drawInMs !== undefined) wrapped.drawInMs = base.drawInMs;
  return wrapped;
}

export const heroBuilders = {
  player: playerBuilder,
  summon: summonBuilder,
  projectile: projectileBuilder,
};
