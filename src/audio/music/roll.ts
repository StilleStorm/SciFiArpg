/**
 * Profile C: the page as a punched roll (DESIGN 14.4).
 *
 * The obstacles of the current page are read like holes in a paper roll: x is time across one loop, y is pitch
 * (the top of the page is the highest note, quantized into the planet's scale), the size of the obstacle is
 * the loudness and the length. Every collider circle of an obstacle is a short figure along its upper edge, so a QR
 * code is a quick four-circle run and a small clip a single tick. The reading is a pure function of the page and the scale.
 */
import type { Obstacle, ObstacleKind } from '../../world/pages';
import { STEPS_PER_BAR } from './profiles';
import type { Scale } from './scale';

/** How a pin sounds: a plucked string, an FM bell, or a short tick. */
export type Voice = 'pluck' | 'bell' | 'tick' | 'swell';

export interface RollNote {
  /** Position in the loop, in steps. */
  step: number;
  /** Degree index into the scale (can exceed one period). */
  degree: number;
  /** Length in steps. */
  steps: number;
  /** 0.3..1. */
  vel: number;
  voice: Voice;
  /** 0 = most important pin, 1 = least; a note sounds when rank <= density. */
  rank: number;
}

export interface RollPage {
  w: number;
  h: number;
  inset: number;
  obstacles: readonly Pick<Obstacle, 'kind' | 'colliders'>[];
}

const VOICE_OF: Record<ObstacleKind, Voice> = {
  blot: 'pluck',
  ring: 'bell',
  torn: 'pluck',
  note: 'pluck',
  qr: 'bell',
  sticky: 'pluck',
  clip: 'tick',
  kiosk: 'bell',
  gate: 'tick',
};

/** Pitch range of the roll in scale degrees: two repeats of the scale. */
export function rollRange(scale: Scale): number {
  return scale.degrees.length * 2;
}

export function readRoll(page: RollPage, scale: Scale, loopSteps: number): RollNote[] {
  const pins: (RollNote & { weight: number })[] = [];
  const spanX = Math.max(1, page.w - 2 * page.inset);
  const spanY = Math.max(1, page.h - 2 * page.inset);
  const range = rollRange(scale);
  const seen = new Set<string>();
  for (const o of page.obstacles) {
    for (const c of o.colliders) {
      // A big hole is a little figure: sample its upper edge from left to right, one pin per ~15 units of radius.
      const k = Math.max(1, Math.min(6, 1 + Math.floor(c.r / 15)));
      for (let i = 0; i < k; i++) {
        const t = k === 1 ? 0 : (i / (k - 1)) * 2 - 1;
        const dx = t * c.r * 0.9;
        const x = c.x + dx;
        const y = c.y - Math.sqrt(Math.max(0, c.r * c.r - dx * dx)) * 0.7;
        const fx = Math.min(0.999, Math.max(0, (x - page.inset) / spanX));
        const fy = Math.min(1, Math.max(0, (y - page.inset) / spanY));
        const step = Math.floor(fx * loopSteps);
        const degree = Math.round((1 - fy) * (range - 1));
        const key = `${step}:${degree}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const weight = Math.min(1, c.r / 70) * (1 - Math.abs(t) * 0.35);
        pins.push({
          step,
          degree,
          steps: 1 + Math.round(weight * 3),
          vel: 0.45 + 0.55 * weight,
          voice: VOICE_OF[o.kind],
          rank: 0,
          weight,
        });
      }
    }
  }
  // rank within each bar: the biggest pin of a bar always survives, the rest thin out as the density drops,
  // so a calm page is sparse everywhere instead of silent in half of the loop
  const bars = new Map<number, (RollNote & { weight: number })[]>();
  for (const p of pins) {
    const bar = Math.floor(p.step / STEPS_PER_BAR);
    const list = bars.get(bar) ?? [];
    list.push(p);
    bars.set(bar, list);
  }
  for (const list of bars.values()) {
    list.sort((a, b) => b.weight - a.weight || a.step - b.step || a.degree - b.degree);
    list.forEach((p, i) => {
      p.rank = i / list.length;
    });
  }
  return pins
    .sort((a, b) => a.step - b.step || a.degree - b.degree)
    .map(({ weight: _w, ...note }) => note);
}
