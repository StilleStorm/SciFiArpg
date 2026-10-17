import type { Pickup } from '../entities';
import { buildDrawing, starPath } from './itemDrawings';
import { el } from './svg';

/** A card sketched into the margin: a small plate with the item's drawing and its number; a star for gwiazdki. */
export function buildPickupCard(e: Pickup): SVGGElement {
  const g = el('g', { class: 'pickup' });
  const item = e.item;
  if (!item) {
    g.append(el('path', { d: starPath(9.5), class: 'star' }), el('path', { d: 'M-5 12Q0 14 5 12', 'stroke-width': 0.9 }));
    return g;
  }
  const tilt = (e.number % 5) - 2;
  const plate = el('g', { transform: `rotate(${tilt})` });
  plate.append(el('rect', { x: -17, y: -12, width: 34, height: 24 }));
  if (item.tier === 'rzadki' || item.tier === 'unikatowy') {
    plate.append(el('rect', { x: -14.5, y: -9.5, width: 29, height: 19, 'stroke-width': 0.8 }));
  }
  if (item.tier === 'unikatowy') plate.append(el('path', { d: 'M-5-12V-16H5V-12M-3-14H3', 'stroke-width': 1.1 }));
  const art = buildDrawing(item.drawing);
  art.setAttribute('transform', 'translate(-5 -0.5) scale(0.43)');
  art.setAttribute('stroke-width', '2.6');
  plate.append(art, el('text', { class: 't-plate', x: 12, y: 9, 'font-size': 7 }, [String(e.number)]));
  g.append(plate);
  return g;
}
