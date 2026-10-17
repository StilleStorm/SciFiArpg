/**
 * The single renderer for status markers (DESIGN 5.3): one small `<g data-status>` per status, drawn in ink.
 * zablokowany: a padlock scribble. wyciszony: a crossed speech bubble. zgloszony: a red "!" stamp.
 * przeczytane: an eye scribble. do_weryfikacji: a dotted outline around the whole figure.
 * Works for any figure: pass the box the figure occupies. Never rebuilds a marker that is already there.
 */
import type { Status, StatusKind } from '../combat/status';
import { box, circ, pl, poly, rectPath } from '../enemies/partsBase';
import { drawIn } from './ink';
import { el } from './svg';

/** Figure box in the host's coordinates: half width, y of the top, y of the feet. */
export interface MarkerBox {
  hw: number;
  top: number;
  feet: number;
}

const MARKER_ORDER: readonly StatusKind[] = ['zablokowany', 'wyciszony', 'zgloszony', 'przeczytane', 'do_weryfikacji'];

function path(d: string, attrs: Record<string, string | number> = {}): SVGPathElement {
  return el('path', { d, ...attrs });
}

function glyph(kind: StatusKind, b: MarkerBox): SVGGElement {
  const g = el('g', { 'data-status': kind });
  switch (kind) {
    case 'zablokowany': {
      g.append(
        path(box(-5, -2, 5, 6, 0.8)),
        path('M-3-2L-3-5Q-3-9.5 0-9.5Q3-9.5 3-5L3-2'),
        path(rectPath(-4.2, -1.2, 4.2, 5.2), { fill: 'url(#hatch)', stroke: 'none' }),
        path(circ(0, 2.4, 0.9), { style: 'fill: var(--ink); stroke: none' }),
      );
      break;
    }
    case 'wyciszony': {
      g.append(path(poly(-6.5, -6, 6.5, -6, 6.5, 2.5, 1.5, 2.5, -2, 7, -2, 2.5, -6.5, 2.5)), path(pl(-9, -8, 9, 7) + pl(9, -8, -9, 7), { 'stroke-width': 1.2 }));
      break;
    }
    case 'zgloszony': {
      const sq = el('g', { transform: 'rotate(-9)' });
      const frame = path(box(-6.5, -7, 6.5, 7, 0.8));
      frame.style.stroke = 'var(--accent)';
      frame.style.strokeWidth = '1.6';
      const mark = el('path', { d: 'M0-4.2L0 1.6' });
      mark.style.stroke = 'var(--accent)';
      mark.style.strokeWidth = '2.2';
      const dot = el('path', { d: circ(0, 4.4, 1) });
      dot.style.fill = 'var(--accent)';
      dot.style.stroke = 'none';
      sq.append(frame, mark, dot);
      g.append(sq);
      break;
    }
    case 'przeczytane': {
      g.append(
        path('M-8 0Q0-6.5 8 0Q0 6.5-8 0Z'),
        path(circ(0, 0, 2.4)),
        path(circ(0, 0, 0.9), { style: 'fill: var(--ink); stroke: none' }),
        path(pl(-4, -5.4, -5.4, -8) + pl(0, -6.6, 0, -9.4) + pl(4, -5.4, 5.4, -8), { 'stroke-width': 0.9 }),
      );
      break;
    }
    case 'do_weryfikacji': {
      const hw = b.hw + 5;
      const top = b.top - 4;
      const bot = b.feet + 4;
      const r = 7;
      const d = `M${-hw + r} ${top}L${hw - r} ${top}Q${hw} ${top} ${hw} ${top + r}L${hw} ${bot - r}Q${hw} ${bot} ${hw - r} ${bot}L${-hw + r} ${bot}Q${-hw} ${bot} ${-hw} ${bot - r}L${-hw} ${top + r}Q${-hw} ${top} ${-hw + r} ${top}Z`;
      g.append(path(d, { 'stroke-dasharray': '1.6 3.6', 'stroke-width': 1.3 }));
      break;
    }
  }
  return g;
}

function place(g: SVGGElement, kind: StatusKind, slot: number, b: MarkerBox): void {
  if (kind === 'do_weryfikacji') {
    g.setAttribute('transform', '');
    return;
  }
  g.setAttribute('transform', `translate(${b.hw + 12} ${b.top + 8 + slot * 19})`);
}

/**
 * Make the markers inside `host` match `statuses`. Cheap when nothing changed (a signature string is kept
 * on the host). Call every frame.
 */
export function syncStatusMarkers(host: SVGGElement, statuses: readonly Status[], b: MarkerBox): void {
  const kinds = MARKER_ORDER.filter((k) => statuses.some((s) => s.kind === k));
  const sig = kinds.join('|');
  if (host.dataset['sig'] === sig) return;
  host.dataset['sig'] = sig;
  const have = new Map<string, SVGGElement>();
  host.querySelectorAll<SVGGElement>(':scope > [data-status]').forEach((g) => have.set(g.dataset['status'] ?? '', g));
  for (const [k, g] of have) if (!kinds.includes(k as StatusKind)) g.remove();
  let slot = 0;
  for (const k of kinds) {
    let g = have.get(k);
    const fresh = !g;
    if (!g) {
      g = glyph(k, b);
      host.append(g);
    }
    place(g, k, k === 'do_weryfikacji' ? 0 : slot, b);
    if (k !== 'do_weryfikacji') slot++;
    if (fresh) drawIn(g, 160);
  }
}
