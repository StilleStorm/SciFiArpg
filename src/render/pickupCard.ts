import { createRng } from '../core/rng';
import type { Pickup } from '../entities';
import { t } from '../i18n';
import { buildDrawing, starPath } from './itemDrawings';
import { el } from './svg';
import { TIER_HUE, washGroup } from './wash';

/** Cards on the ground are drawn this much larger than the 34 x 24 sketch below. */
export const CARD_SCALE = 1.3;

/** A permission: a checkbox with a tick in it and the family word under it. */
function permissionCard(e: Pickup): SVGGElement {
  const g = el('g', { class: 'pickup permission' });
  g.append(washGroup(createRng(e.id).fork('wash'), 'indigo', 34, { opacity: 0.25 }));
  const plate = el('g', { transform: `scale(${CARD_SCALE}) rotate(-2)` });
  const family = e.permission ?? 'urzadzenia';
  plate.append(
    el('rect', { x: -27, y: -15, width: 54, height: 30 }),
    el('rect', { x: -6, y: -12, width: 12, height: 12, 'stroke-width': 1.1 }),
    el('path', { d: 'M-4.2-5.5L-1.4-2.4L5.2-10.4', 'stroke-width': 1.6 }),
    el('text', { class: 't-plate', x: 0, y: 10, 'font-size': 6.4 }, [t(`forms.update.family.${family}`)]),
  );
  g.append(plate);
  return g;
}

/** A card sketched into the margin: a small plate with the item's drawing and its number; a star for gwiazdki. */
export function buildPickupCard(e: Pickup): SVGGElement {
  if (e.permission) return permissionCard(e);
  const g = el('g', { class: 'pickup' });
  const item = e.item;
  if (!item) {
    // DESIGN 3.4: a wet yellow stain about 2.2 star radii wide, and the star filled with the same yellow, so a
    // gwiazdka reads at a glance; the stain is offset, the ink stays on top
    g.append(
      washGroup(createRng(e.id).fork('wash'), 'yellow', 9.5 * 1.2 * 2.4, { opacity: 0.36 }),
      el('path', { d: starPath(9.5), class: 'star', transform: 'scale(1.2)', fill: 'var(--wash-yellow)', 'fill-opacity': 0.7 }),
      el('path', { d: 'M-5 12Q0 14 5 12', 'stroke-width': 0.9, transform: 'scale(1.2)' }),
    );
    return g;
  }
  // a stain under the plate in the rarity's hue; a wariant or a free version is brick
  const hue = item.variant || item.freeVersion ? 'brick' : TIER_HUE[item.tier];
  g.append(washGroup(createRng(item.uid).fork('wash'), hue, 25, { opacity: 0.25 }));
  const tilt = (e.number % 5) - 2;
  const plate = el('g', { transform: `scale(${CARD_SCALE}) rotate(${tilt})` });
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
