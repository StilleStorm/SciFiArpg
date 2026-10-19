/**
 * Hero figures in the manner of Mroz: spindly, assembled from small parts, hatched. About 64 world units tall,
 * origin near the middle of the body. Legs swap between two frames (patch); nothing is rebuilt per frame.
 * Also the builders for summons (a dotted copy "z innej petli"), projectiles (a short ink dash), and a wrapper
 * that draws an enemy with `copyOf` as the hero it copies.
 */
import { createRng } from '../core/rng';
import type { Enemy, Player, Projectile, Summon } from '../entities/types';
import { circlePath, hide, setPart, syncInner, type DriveFx, type FigureDef, type Parts, type PartDef, type PartName, type Walker } from '../heroes/figureKit';
import { heroById, type HeroId } from '../heroes/registry';
import { t } from '../i18n';
import { attackAt, driveHeroStroke, driveLash, driveLaser, scribblePath, setStroke, trackRemark } from './attackFx';
import { buildMoon, patchMoon } from './heroFx';
import { el, n2 } from './svg';
import type { Builder } from './view';
import { HERO_HUE, washGroup } from './wash';
import '../ui/forms.css';

const LEG_PERIOD_MS = 150;
/** Heroes, summons and hero copies are drawn this much larger on the page (the profile card keeps 1). */
export const HERO_SCALE = 1.15;

const parts = new WeakMap<SVGGElement, Parts>();

/** The render-layer calls a hero's `drive` may make (heroes/figureKit.ts). */
const DRIVE_FX: DriveFx = { driveLash, driveLaser, setStroke };

function buildPart(name: PartName, def: PartDef): SVGGElement {
  const g = el('g', { 'data-part': name });
  for (const d of def.hatch ?? []) g.append(el('path', { d, fill: 'url(#hatch)', stroke: 'none' }));
  for (const [cx, cy, r] of def.hatchCircles ?? []) g.append(el('path', { d: circlePath(cx, cy, r), fill: 'url(#hatch)', stroke: 'none' }));
  for (const d of def.body ?? []) g.append(el('path', { d }));
  for (const [cx, cy, r] of def.circles ?? []) g.append(el('path', { d: circlePath(cx, cy, r) }));
  if (def.tail) g.append(el('g', { 'data-tail': 1 }, def.tail.map((d) => el('path', { d }))));
  return g;
}

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
  /** Paint a wash under the strokes (on the page only; the profile card stays plain). */
  wash?: boolean;
  /** Half-strength stain (copies and decoys of the hero). */
  faint?: boolean;
}

/** One hero figure as a `<g>`. Its legs are `data-leg` paths; `patchFigure` swaps them. */
export function buildHeroFigure(heroId: HeroId, opts: FigureOpts = {}): SVGGElement {
  const figure = heroById(heroId).figure;
  const def: FigureDef = figure.def;
  const g = el('g', { class: `hero hero-${heroId}${opts.dotted ? ' fig-dotted' : ''}` });
  const sc = def.scale * (opts.size ?? 1);
  const inner = el('g', { class: 'fig', transform: `scale(${n2(sc)})` });
  g.append(inner);
  let wash: SVGGElement | null = null;
  if (opts.wash) {
    // DESIGN 3.4: a stain in the hero's hue, offset from the figure, under every stroke and scaling with it
    const at = figure.wash;
    wash = washGroup(createRng(at.seed).fork('wash'), HERO_HUE[heroId], at.r, { cx: at.cx, cy: at.cy, faint: opts.faint === true });
    inner.append(wash);
  }
  for (const [cx, cy, r] of def.echo ?? []) {
    const echo = el('path', { d: circlePath(cx, cy, r), 'stroke-dasharray': '1.5 2.5' });
    inner.append(echo);
  }
  for (const d of def.hatch) inner.append(el('path', { d, fill: 'url(#hatch)', stroke: 'none' }));
  for (const [cx, cy, r] of def.hatchCircles ?? []) inner.append(el('path', { d: circlePath(cx, cy, r), fill: 'url(#hatch)', stroke: 'none' }));
  for (const d of def.body) inner.append(el('path', { d }));
  for (const [cx, cy, r] of def.circles) inner.append(el('path', { d: circlePath(cx, cy, r) }));
  inner.dataset['part'] = 'body';
  const named: Partial<Record<PartName, SVGGElement>> = {};
  for (const [name, partDef] of Object.entries(def.parts ?? {}) as [PartName, PartDef][]) {
    const part = buildPart(name, partDef);
    named[name] = part;
    inner.append(part);
  }
  let rim: SVGPathElement | null = null;
  const extras = figure.build?.(inner, named);
  if (extras?.rim) rim = extras.rim;
  let speech: SVGGElement | null = null;
  const speechPaths: SVGPathElement[] = [];
  if (extras?.speech) {
    speech = extras.speech;
    speechPaths.push(...(extras.speechPaths ?? []));
  }
  const legs = [0, 1].map((i) => el('path', { 'data-leg': i, d: def.legs[0][i as 0 | 1] }));
  inner.append(...legs);
  const foam = opts.foam ? foamGroup() : null;
  if (foam) inner.append(foam);
  let caption: SVGTextElement | null = null;
  if (opts.caption) {
    caption = el('text', { class: 't-caption', x: 0, y: Math.round(36 * (opts.size ?? 1)) }, [opts.caption]);
    g.append(caption);
  }
  const tail = named.cable?.querySelector<SVGGElement>('[data-tail]') ?? null;
  parts.set(g, { inner, named, tail, speech, speechPaths, bob: 0, lx: 0, ly: 0, sig: {}, posed: false, legs, foam, caption, wash, heroId, scale: sc, rim, pancake: { squash: 1, roll: 0, flip: 1, lastMs: 0, px: null, py: null } });
  return g;
}

/**
 * The auto-attack animation of the hero's own drawing (render/attackFx.ts has the timing; the hero's figure.ts has the pose and
 * the moves of its parts): lurch, then whatever `drive` of the figure moves, and the ink stroke of the attack. A few attribute
 * writes per frame while it lasts, none when idle. Rotations are mirrored when the target is behind the way the figure faces.
 */
function patchAttack(e: Walker, g: SVGGElement, p: Parts, timeMs: number): void {
  const figure = heroById(p.heroId).figure;
  const live = attackAt(g, timeMs, figure.attackMs);
  if (!live) {
    if (!p.posed) return;
    p.posed = false;
    p.pancake.flip = 1;
    p.lx = 0;
    p.ly = 0;
    syncInner(p);
    for (const name of ['arm', 'ticket', 'drum', 'door', 'instrument', 'head'] as const) setPart(p, name, p.named[name], '');
    const ticket = p.named.ticket;
    if (ticket) hide(ticket, false);
    if (p.tail) hide(p.tail, false);
    if (p.speech) {
      hide(p.speech, true);
      setPart(p, 'speech', p.speech, '');
    }
    return;
  }
  p.posed = true;
  const { a, t } = live;
  const pose = figure.pose(t);
  // the figure is mirrored as a whole when it faces left: the target's direction in the figure's own frame
  const lux = a.ux * (e.facing ?? 1);
  const side = lux < 0 ? -1 : 1;
  p.lx = lux * pose.lurch;
  p.ly = a.uy * pose.lurch;
  syncInner(p);
  figure.drive?.({ e, p, pose, a, t, lux, side, fx: DRIVE_FX });
  driveHeroStroke(a, figure.stroke, pose.draw, pose.erase);
}

/** Legs, bob, foam, suspension, caption direction, the attack. Attribute writes only when something changed. */
export function patchFigure(e: Walker, g: SVGGElement, timeMs: number): void {
  const p = parts.get(g);
  if (!p) return;
  const phase = e.moving ? Math.floor(timeMs / LEG_PERIOD_MS) % 2 : 0;
  if (g.dataset['phase'] !== String(phase)) {
    g.dataset['phase'] = String(phase);
    const frame = heroById(p.heroId).figure.def.legs[phase as 0 | 1];
    p.legs.forEach((leg, i) => leg.setAttribute('d', frame[i as 0 | 1]));
    p.bob = phase ? -1 : 0;
    syncInner(p);
  }
  patchAttack(e, g, p, timeMs);
  heroById(p.heroId).figure.patch?.(e, p, timeMs);
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
  if ((p.caption || p.wash) && e.facing !== undefined && g.dataset['face'] !== String(e.facing)) {
    g.dataset['face'] = String(e.facing);
    p.caption?.setAttribute('transform', e.facing < 0 ? 'scale(-1 1)' : '');
    p.wash?.setAttribute('transform', e.facing < 0 ? 'scale(-1 1)' : '');
  }
}

// ---------- builders ----------

export const playerBuilder: Builder<Player> = {
  create: (e) => buildHeroFigure(e.heroId, { foam: heroById(e.heroId).figure.foam === true, size: HERO_SCALE, wash: true }),
  patch: patchFigure,
  drawInMs: 0,
};

export const summonBuilder: Builder<Summon> = {
  create: (e) => {
    if (e.variant === 'moon') return buildMoon(e);
    const opts: FigureOpts = { dotted: true, size: HERO_SCALE, wash: true, faint: true };
    if (e.variant === 'decoy') opts.caption = t('heroes.kartograf.decoy');
    return buildHeroFigure(e.heroId, opts);
  },
  patch: (e, g, timeMs) => (e.variant === 'moon' ? patchMoon(e, g) : patchFigure(e, g, timeMs)),
  drawInMs: 260,
};

/** The Petlowiec's remark in flight: a scribble of handwriting that is drawn in as it leaves the hand. */
interface Remark {
  line: SVGPathElement;
  ttl0: number;
  drawn: boolean;
}
const remarks = new WeakMap<SVGGElement, Remark>();
/** The scribble draws itself in over this long, in seconds of flight. */
const REMARK_DRAW_S = 0.06;

/**
 * A short dash with a nub, pointing along the velocity (set once at creation). Regulaminowy is a ticket card turned along
 * the flight (mirrored when it flies left, so its lines stay readable); the Konsultant's own auto-attack (`roll`) is not drawn
 * here at all, because its cable lash is (render/attackFx.ts) and the projectile is only the hit arriving with the tip. The
 * Petlowiec's own remark is a line of handwriting, 5 to 7 bumps like an illegible "mmm", along the flight, upright; other
 * egzystencjalny shots are a question mark.
 */
export const projectileBuilder: Builder<Projectile> = {
  create: (e) => {
    const g = el('g', { class: 'projectile' });
    const angle = (Math.atan2(e.vy, e.vx) * 180) / Math.PI;
    const inner = el('g', { transform: `rotate(${n2(angle)})` });
    const long = (e.pierce ?? 0) > 3;
    if (e.damageType === 'regulaminowy' && e.roll === true) {
      // nothing: the lash is the picture
    } else if (e.damageType === 'regulaminowy') {
      const sheet = el('g', { transform: `rotate(${n2(angle)})${e.vx < 0 ? ' scale(1 -1)' : ''}` });
      sheet.append(el('path', { d: 'M-4.5-3.5H2.5L5 -1V3.5H-4.5Z' }), el('path', { d: 'M2.5-3.5V-1H5M-2.5 0H2M-2.5 2H1' }));
      g.append(sheet);
    } else if (e.damageType === 'egzystencjalny' && e.roll === true) {
      const rng = createRng(Math.imul(e.id, 977) + 13);
      const line = el('path', { d: scribblePath(rng, rng.int(5, 7), 30, 6), 'stroke-width': 1.7, pathLength: 1 });
      // along the flight, but never upside down: a leftward flight is the same line turned the other way up
      const deg = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
      g.append(el('g', { transform: `rotate(${n2(deg)})` }, [line]));
      remarks.set(g, { line, ttl0: e.ttl + 1 / 60, drawn: false });
      trackRemark(g, e.x, e.y);
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
  patch(e, g) {
    const r = remarks.get(g);
    if (!r) return;
    trackRemark(g, e.x, e.y);
    if (r.drawn) return;
    const p = (r.ttl0 - e.ttl) / REMARK_DRAW_S;
    if (p >= 1) {
      r.drawn = true;
      r.line.removeAttribute('stroke-dasharray');
      r.line.removeAttribute('stroke-dashoffset');
    } else setStroke(r.line, Math.max(0.05, p), 0);
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
      const g = buildHeroFigure(e.copyOf.heroId, { caption: t('heroes.copy.caption'), size: HERO_SCALE, wash: true, faint: true });
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
