/**
 * The aim preview (DESIGN 5.6), drawn in the ink layer while a pad is held: a dotted arrow from the hero for a direction,
 * a dotted circle for a point. Ink only; rubbed out when the pad is released or the cast cancelled. One group, patched in place.
 */
import type { AimPreview } from '../heroes/aim';
import { el, n2 } from './svg';

const ERASE_MS = 140;

interface Nodes {
  g: SVGGElement;
  shaft: SVGPathElement;
  head: SVGPathElement;
  ring: SVGCircleElement;
}

let nodes: Nodes | null = null;
let shown = false;
let last = '';

function ensure(): Nodes | null {
  if (nodes && nodes.g.isConnected) return nodes;
  const layer = document.getElementById('fx');
  if (!layer) return null;
  const g = el('g', { id: 'aim-fx' });
  g.style.opacity = '0';
  g.style.pointerEvents = 'none';
  // dots, not dashes: a round cap on a near-zero dash
  const shaft = el('path', { 'stroke-dasharray': '0.1 8', 'stroke-width': 3.6, fill: 'none' });
  const head = el('path', { 'stroke-width': 2.8, fill: 'none' });
  const ring = el('circle', { 'stroke-dasharray': '0.1 7.5', 'stroke-width': 3.6, fill: 'none' });
  g.append(shaft, head, ring);
  layer.append(g);
  nodes = { g, shaft, head, ring };
  return nodes;
}

/** Draw (or move) the preview. Null erases it. Call as often as you like: unchanged previews touch nothing. */
export function showAim(preview: AimPreview | null): void {
  if (!preview) {
    hideAim();
    return;
  }
  const n = ensure();
  if (!n) return;
  const key = preview.kind === 'arrow' ? `a${n2(preview.x)},${n2(preview.y)},${n2(preview.x2)},${n2(preview.y2)}` : `c${n2(preview.x)},${n2(preview.y)},${n2(preview.r)}`;
  if (key !== last) {
    last = key;
    if (preview.kind === 'arrow') {
      const dx = preview.x2 - preview.x;
      const dy = preview.y2 - preview.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // the shaft starts a little off the hero so the figure is not scribbled over
      const x0 = preview.x + ux * 22;
      const y0 = preview.y + uy * 22;
      n.shaft.setAttribute('d', len > 24 ? `M${n2(x0)} ${n2(y0)}L${n2(preview.x2)} ${n2(preview.y2)}` : '');
      const bx = preview.x2 - ux * 16;
      const by = preview.y2 - uy * 13;
      n.head.setAttribute(
        'd',
        `M${n2(bx - uy * 9)} ${n2(by + ux * 9)}L${n2(preview.x2)} ${n2(preview.y2)}L${n2(bx + uy * 9)} ${n2(by - ux * 9)}`,
      );
      n.ring.setAttribute('display', 'none');
      n.shaft.removeAttribute('display');
      n.head.removeAttribute('display');
    } else {
      n.ring.setAttribute('cx', n2(preview.x));
      n.ring.setAttribute('cy', n2(preview.y));
      n.ring.setAttribute('r', n2(Math.max(4, preview.r)));
      n.ring.removeAttribute('display');
      n.shaft.setAttribute('display', 'none');
      n.head.setAttribute('display', 'none');
    }
  }
  if (!shown) {
    shown = true;
    n.g.style.transition = 'none';
    n.g.style.opacity = '1';
  }
}

/** Rub the preview out. */
export function hideAim(): void {
  if (!nodes || !shown) return;
  shown = false;
  last = '';
  nodes.g.style.transition = `opacity ${ERASE_MS}ms ease-out`;
  nodes.g.style.opacity = '0';
}

/** Whether a preview is on the page now (tests and shots). */
export function aimShown(): boolean {
  return shown;
}
