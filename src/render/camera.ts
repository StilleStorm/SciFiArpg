import { clamp, type Vec } from '../core/vec';
import { cssToWorld, screenLayout, type Box } from './keepOut';

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
/** css px per world unit right now (1 in portrait on a 390 px phone, 0.75 in landscape on the same phone). */
let zoom = 1;

/** How many css px one world unit covers at the moment (set by `camera.resize()`). */
export function viewZoom(): number {
  return zoom;
}

/**
 * A world-text size in units that reads at least `minPx` css px at the zoom now (landscape shows a unit as 0.75 px on a
 * phone): `units` when that is already enough, otherwise scaled up, in half units. Pure but for the zoom.
 */
export function readableUnits(units: number, minPx = 11): number {
  return Math.max(units, Math.ceil((minPx / zoom) * 2) / 2);
}

/** Set what `viewZoom()` reports (tests). */
export function setViewZoom(z: number): void {
  zoom = z > 0 ? z : 1;
}

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
  /** The page the view is clamped to (kept in step with the page shown). */
  readonly bounds: { w: number; h: number };
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
    bounds,
    resize() {
      setViewSize(viewSizeFor(window.innerWidth, window.innerHeight));
      setViewZoom(Math.max(1, window.innerWidth) / viewSize.w);
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

/**
 * The horizontal span of the page the camera shows now, when the view is portrait (taller than wide); undefined in landscape,
 * where the whole page width is on screen. Text printed on the page in portrait (the clause header) is set inside it.
 */
export function portraitSpan(cam: Pick<Camera, 'w' | 'h' | 'viewRect'>): { x0: number; x1: number } | undefined {
  if (cam.h <= cam.w) return undefined;
  const r = cam.viewRect();
  return { x0: r.x0, x1: r.x1 };
}

/**
 * The part of the view not covered by the HUD form (top) and the footnote band (bottom), in world units: where claim
 * bubbles and stamps are kept (render/bubbleFocus, render/bindings). The bands are measured from the DOM (render/keepOut);
 * before the first measurement (tests) the insets below, in css px, stand in. What covers only part of the width (pads,
 * margin notes, a corner HUD) is in `keepOutBlocks`.
 */
const FREE_INSET = {
  bubble: { portrait: { top: 70, bottom: 110 }, landscape: { top: 58, bottom: 62 } },
  // a stamp is nearly as wide as a phone held upright, so in portrait it also keeps above the pads (the stamp pad tops them at ~330 px from the bottom)
  stamp: { portrait: { top: 70, bottom: 330 }, landscape: { top: 58, bottom: 62 } },
};
export function freeViewRect(cam: Pick<Camera, 'w' | 'h' | 'viewRect'>, use: 'bubble' | 'stamp' = 'bubble'): Box {
  const r = cam.viewRect();
  const z = viewZoom();
  const l = screenLayout();
  if (l) return { x0: r.x0, y0: r.y0 + l.top / z, x1: r.x1, y1: r.y0 + l.bottom / z };
  const ins = cam.h > cam.w ? FREE_INSET[use].portrait : FREE_INSET[use].landscape;
  return { x0: r.x0, y0: r.y0 + ins.top / z, x1: r.x1, y1: r.y1 - ins.bottom / z };
}

/** The pads, margin notes and other partial covers in world units at the camera's view now, grown by `margin` units. */
export function keepOutBlocks(cam: Pick<Camera, 'viewRect'>, margin = 0): Box[] {
  const l = screenLayout();
  if (!l) return [];
  const r = cam.viewRect();
  const z = viewZoom();
  return l.blocks.map((b) => {
    const w = cssToWorld(b, r, z);
    return { x0: w.x0 - margin, y0: w.y0 - margin, x1: w.x1 + margin, y1: w.y1 + margin };
  });
}

/**
 * Where the margin-note row can stand over the top of the page, in page units: the row measured on screen, carried over
 * every left edge the camera can take while the page top is in view (the header is printed once for the page and the
 * camera then pans under the screen-fixed row; in portrait that leaves no room beside the row, so the header goes below it).
 */
export function headerKeepOut(cam: Pick<Camera, 'w' | 'h' | 'viewRect' | 'bounds'>): Box | undefined {
  const l = screenLayout();
  if (!l?.row) return undefined;
  const z = viewZoom();
  const top = viewRect(0, -1e9, cam.w, cam.h, cam.bounds).y0;
  const lo = viewRect(-1e9, 0, cam.w, cam.h, cam.bounds).x0;
  const hi = viewRect(1e9, 0, cam.w, cam.h, cam.bounds).x0;
  return { x0: lo + l.row.x0 / z, x1: hi + l.row.x1 / z, y0: top + l.row.y0 / z, y1: top + l.row.y1 / z };
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

/** How the page header is set for this camera: inside the portrait span (`portraitSpan`) and clear of the note row (`headerKeepOut`). */
export function headerFrame(cam: Pick<Camera, 'w' | 'h' | 'viewRect' | 'bounds'>): { view?: { x0: number; x1: number }; avoid?: Box } {
  const view = portraitSpan(cam);
  const avoid = headerKeepOut(cam);
  return { ...(view ? { view } : {}), ...(avoid ? { avoid } : {}) };
}
