import { clamp, type Vec } from '../core/vec';

/** The view always shows at least 390 x 700 world units (1 unit = 1 css px at 390 px width). */
export const MIN_VIEW_W = 390;
export const MIN_VIEW_H = 700;
/** How much blank paper may show beyond the page edge. */
const OVERSCAN = 60;
/** Camera lag: bigger = snappier. */
const FOLLOW_RATE = 5;

export interface Camera {
  /** Center of the view in world units. */
  x: number;
  y: number;
  w: number;
  h: number;
  resize(): void;
  follow(tx: number, ty: number, dtSec: number): void;
  snap(tx: number, ty: number): void;
  /** Write viewBox and filter region to the DOM. */
  apply(): void;
  screenToWorld(clientX: number, clientY: number): Vec;
}

export function createCamera(
  svg: SVGSVGElement,
  filter: SVGFilterElement,
  bounds: { w: number; h: number },
): Camera {
  let lastView = '';
  let lastFilter = '';

  const cam: Camera = {
    x: bounds.w / 2,
    y: bounds.h / 2,
    w: MIN_VIEW_W,
    h: MIN_VIEW_H,
    resize() {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const k = Math.max(MIN_VIEW_W / vw, MIN_VIEW_H / vh);
      cam.w = vw * k;
      cam.h = vh * k;
    },
    follow(tx, ty, dt) {
      const a = 1 - Math.exp(-FOLLOW_RATE * dt);
      cam.x += (tx - cam.x) * a;
      cam.y += (ty - cam.y) * a;
    },
    snap(tx, ty) {
      cam.x = tx;
      cam.y = ty;
    },
    apply() {
      const left = axis(cam.x, cam.w, bounds.w);
      const top = axis(cam.y, cam.h, bounds.h);
      const view = `${left.toFixed(1)} ${top.toFixed(1)} ${cam.w.toFixed(1)} ${cam.h.toFixed(1)}`;
      if (view !== lastView) {
        lastView = view;
        svg.setAttribute('viewBox', view);
      }
      // The wobble filter only needs to cover what is on screen.
      const f = `${(left - 8).toFixed(0)} ${(top - 8).toFixed(0)} ${(cam.w + 16).toFixed(0)} ${(cam.h + 16).toFixed(0)}`;
      if (f !== lastFilter) {
        lastFilter = f;
        const [fx = '0', fy = '0', fw = '0', fh = '0'] = f.split(' ');
        filter.setAttribute('x', fx);
        filter.setAttribute('y', fy);
        filter.setAttribute('width', fw);
        filter.setAttribute('height', fh);
      }
    },
    screenToWorld(clientX, clientY) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: cam.x, y: cam.y };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
  };
  return cam;
}

/** Top-left of the view along one axis, keeping the view inside page +- overscan. */
function axis(center: number, size: number, extent: number): number {
  const lo = -OVERSCAN;
  const hi = extent + OVERSCAN - size;
  if (hi < lo) return extent / 2 - size / 2;
  return clamp(center - size / 2, lo, hi);
}
