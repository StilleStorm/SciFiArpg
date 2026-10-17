import { clamp, type Vec } from '../core/vec';

/**
 * The view always shows at least MIN_VIEW_W wide and a minimum height that depends on the orientation (1 unit =
 * 1 css px at 390 px width). `preserveAspectRatio` is "slice", so the viewBox must have the window's aspect.
 * Portrait shows 390 wide and at least 700 tall (390 x 844 -> 390 x 844 units). Landscape (window wider than tall,
 * the same rule as `ui/layout.ts` `orientationOf`) shows at least 520 tall and the window's width at that scale
 * (844 x 390 -> about 1125 x 520 units), so the 1200-unit page fills the width and the figures read a third larger.
 */
export const MIN_VIEW_W = 390;
export const MIN_VIEW_H = 700;
export const MIN_VIEW_H_LANDSCAPE = 520;

/** World size of the view for a window of vw x vh css px: at least MIN_VIEW_W x the orientation's minimum height. */
export function viewSizeFor(vw: number, vh: number): { w: number; h: number } {
  const w = Math.max(1, vw);
  const h = Math.max(1, vh);
  const minH = w > h ? MIN_VIEW_H_LANDSCAPE : MIN_VIEW_H;
  const k = Math.max(MIN_VIEW_W / w, minH / h);
  return { w: w * k, h: h * k };
}

let viewSize = { w: MIN_VIEW_W, h: MIN_VIEW_H };

/** The world size the camera shows right now (set by `camera.resize()`); used to place the entry wave. */
export function currentViewSize(): { w: number; h: number } {
  return viewSize;
}

/** Set the size `currentViewSize()` reports (`camera.resize()` does this from the window; tests call it directly). */
export function setViewSize(size: { w: number; h: number }): void {
  viewSize = size;
}
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
  /** The rectangle in world units the camera shows at its current centre, clamped to the page like `apply()`. */
  viewRect(): { x0: number; y0: number; x1: number; y1: number };
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
      setViewSize(viewSizeFor(window.innerWidth, window.innerHeight));
      cam.w = viewSize.w;
      cam.h = viewSize.h;
    },
    viewRect() {
      return viewRect(cam.x, cam.y, cam.w, cam.h, bounds);
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

/** The rectangle the camera shows when it is centred on (cx, cy), clamped like `apply()` does. */
export function viewRect(cx: number, cy: number, w: number, h: number, bounds: { w: number; h: number }): { x0: number; y0: number; x1: number; y1: number } {
  const x0 = axis(cx, w, bounds.w);
  const y0 = axis(cy, h, bounds.h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** Top-left of the view along one axis, keeping the view inside page +- overscan. */
function axis(center: number, size: number, extent: number): number {
  const lo = -OVERSCAN;
  const hi = extent + OVERSCAN - size;
  if (hi < lo) return extent / 2 - size / 2;
  return clamp(center - size / 2, lo, hi);
}
