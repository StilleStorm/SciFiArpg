import { createRng } from '../core/rng';
import { el, wobblyCircle } from '../render/svg';
import { h } from './dom';

/** Radius of the base circle and of the knob, in css px. */
export const BASE_R = 56;
export const KNOB_R = 24;
/** Share of the base radius inside which the knob steers nothing. */
export const DEAD_ZONE = 0.12;

/** Unit direction and strength 0..1 (0 inside the dead zone, 1 with the knob on the rim). */
export interface Steer {
  dx: number;
  dy: number;
  mag: number;
}

const NONE: Steer = { dx: 0, dy: 0, mag: 0 };

/** The knob's offset from the base centre for a finger offset (dx, dy): the finger clamped to the base circle. */
export function knobOffset(dx: number, dy: number, radius = BASE_R): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= radius || len === 0) return { x: dx, y: dy };
  return { x: (dx / len) * radius, y: (dy / len) * radius };
}

/**
 * Finger offset from where it first touched -> steering. Inside the dead zone nothing moves; beyond it the
 * strength rises from 0 to 1 at the rim (and stays 1 outside it), so speed scales with the distance.
 */
export function steerVector(dx: number, dy: number, radius = BASE_R, dead = DEAD_ZONE): Steer {
  const len = Math.hypot(dx, dy);
  if (len === 0) return NONE;
  const raw = Math.min(1, len / radius);
  if (raw < dead) return NONE;
  return { dx: dx / len, dy: dy / len, mag: (raw - dead) / (1 - dead) };
}

export interface Joystick {
  /** The finger landed at client (x, y): the base appears there. */
  begin(x: number, y: number): void;
  /** The finger moved to client (x, y). */
  move(x: number, y: number): void;
  /** The finger lifted: the drawing disappears and the steering stops. */
  end(): void;
  active(): boolean;
  /** Current steering, or null while no finger is on it. Do not keep the object. */
  steer(): Steer | null;
}

const BOX = BASE_R + KNOB_R + 6;

/** The floating joystick: two ink circles and a hatched dead zone, drawn where the thumb lands. */
export function createJoystick(root: HTMLElement): Joystick {
  const rng = createRng(31);
  const wrap = h('div', 'joy hidden');
  const svg = el('svg', { viewBox: `${-BOX} ${-BOX} ${2 * BOX} ${2 * BOX}`, 'aria-hidden': 'true' });
  const base = el('g', { class: 'joy-base' });
  base.append(
    el('path', { d: wobblyCircle(rng, 0, 0, BASE_R, 14, 0.025) }),
    el('path', { d: wobblyCircle(rng, 0.7, -0.5, BASE_R - 2.4, 12, 0.03), 'stroke-width': 0.9 }),
    el('circle', { class: 'joy-dead', r: BASE_R * DEAD_ZONE, fill: 'url(#hatch)', 'stroke-width': 0.9 }),
  );
  const knob = el('g', { class: 'joy-knob' });
  knob.append(
    el('path', { d: wobblyCircle(rng, 0, 0, KNOB_R, 11, 0.03) }),
    el('path', { d: wobblyCircle(rng, -0.5, 0.6, KNOB_R - 2.2, 9, 0.035), 'stroke-width': 0.9 }),
  );
  svg.append(base, knob);
  wrap.append(svg);
  root.append(wrap);

  let on = false;
  let ox = 0;
  let oy = 0;
  let last: Steer = NONE;

  const joy: Joystick = {
    begin(x, y) {
      on = true;
      ox = x;
      oy = y;
      last = NONE;
      wrap.style.transform = `translate(${x - BOX}px, ${y - BOX}px)`;
      knob.removeAttribute('transform');
      wrap.classList.remove('hidden');
    },
    move(x, y) {
      if (!on) return;
      const dx = x - ox;
      const dy = y - oy;
      const k = knobOffset(dx, dy);
      knob.setAttribute('transform', `translate(${k.x.toFixed(1)} ${k.y.toFixed(1)})`);
      last = steerVector(dx, dy);
    },
    end() {
      on = false;
      last = NONE;
      wrap.classList.add('hidden');
    },
    active: () => on,
    steer: () => (on ? last : null),
  };
  return joy;
}
