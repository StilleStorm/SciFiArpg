/**
 * The area of a running ultimate (DESIGN 10.2): a dotted ink circle of its radius in #fx, drawn in at the cast, moved with the
 * record's `x, y` every frame (the heroes' ticks keep them on the hero) and rubbed out when the ultimate ends. Reads
 * `s.hero.ult.active` (heroes/state.ts ActiveUlt); an ultimate without `r` (page-wide, or on the hero's own path) draws nothing here.
 * Per frame only `transform` changes.
 */
import { createRng } from '../core/rng';
import type { ActiveUlt } from '../heroes/state';
import type { RunState } from '../world/run';
import { drawIn, eraseOut } from './ink';
import { blobPoints, el, n2, smoothClosed } from './svg';

const pen = createRng(0x0a7e);
const DOTS = '2 6';

interface Outline {
  g: SVGGElement;
  x: number;
  y: number;
}

export interface UltFx {
  frame(s: RunState): void;
}

export function createUltFx(layer: SVGGElement): UltFx {
  const shown = new Map<ActiveUlt, Outline>();
  const live = new Set<ActiveUlt>();
  return {
    frame(s) {
      live.clear();
      for (const u of s.hero.ult?.active ?? []) {
        if (u.r === undefined) continue;
        live.add(u);
        let o = shown.get(u);
        if (!o) {
          const g = el('g', { class: 'ult-area' });
          const path = el('path', { d: smoothClosed(blobPoints(pen, 0, 0, u.r, 18, 0.03)), 'stroke-dasharray': DOTS, 'stroke-width': 1.3 });
          g.append(path);
          layer.append(g);
          o = { g, x: Number.NaN, y: Number.NaN };
          shown.set(u, o);
          drawIn(g, 260);
        }
        if (o.x !== u.x || o.y !== u.y) {
          o.x = u.x;
          o.y = u.y;
          o.g.setAttribute('transform', `translate(${n2(u.x)} ${n2(u.y)})`);
        }
      }
      for (const [u, o] of shown) {
        if (live.has(u)) continue;
        shown.delete(u);
        eraseOut(o.g, 320, 0, () => o.g.remove());
      }
    },
  };
}
