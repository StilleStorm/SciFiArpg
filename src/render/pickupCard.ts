import { createRng } from '../core/rng';
import type { Pickup } from '../entities';
import { t } from '../i18n';
import { buildDrawing, starPath } from './itemDrawings';
import { buildAffixMarks, buildTierMark, groundMark, numberSuffix } from './itemMarks';
import { el } from './svg';
import { TIER_HUE, washGroup } from './wash';

/** Cards on the ground are drawn this much larger than the 34 x 24 sketch below. */
export const CARD_SCALE = 1.3;

/**
 * A potwierdzenie: a small slip, two typed lines and a round stamp in the accent red. About 22 x 14 units at scale 1;
 * the same drawing is stacked in the HUD note (ui/hud.ts), so it takes only a tilt and a scale.
 */
export function buildSlip(tilt = 0, scale = 1): SVGGElement {
  const g = el('g', { class: 'slip', transform: `rotate(${tilt}) scale(${scale})` });
  g.append(
    el('rect', { x: -11, y: -7, width: 22, height: 14 }),
    el('path', { d: 'M-8.5-3H-0.5M-8.5 0.2H-2.5M-8.5 3.4H-4.5', 'stroke-width': 0.9 }),
    el('circle', { cx: 5.2, cy: 1.6, r: 3.4, style: 'stroke:var(--accent)', 'stroke-width': 1.2 }),
    el('path', { d: 'M3.6 1.8L4.8 3L6.9 0', style: 'stroke:var(--accent)', 'stroke-width': 1 }),
  );
  return g;
}

function potwierdzenieCard(e: Pickup): SVGGElement {
  const g = el('g', { class: 'pickup potwierdzenie' });
  g.append(buildSlip((e.id % 5) - 2, 1.3));
  return g;
}

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
  if (e.potwierdzenie) return potwierdzenieCard(e);
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
  // the art, then the tier mark (never omitted) and one affix mark, in the art's own coordinates
  const kind = groundMark(item);
  const art = buildDrawing(item.drawing, kind === 'dotted');
  art.setAttribute('stroke-width', '2.6');
  const marked = el('g', { transform: 'translate(-5 -0.5) scale(0.43)' });
  marked.append(art);
  const tierMark = buildTierMark(item, 2.6);
  if (tierMark) marked.append(tierMark);
  const affixMark = kind ? buildAffixMarks([kind], 2.6) : null;
  if (affixMark) marked.append(affixMark);
  plate.append(marked, el('text', { class: 't-plate', x: 12, y: 9, 'font-size': 7 }, [String(e.number)]));
  if (kind === 'ok') plate.append(el('text', { class: 't-plate', x: 12, y: 3.4, style: 'font-size:4.6px' }, [t('items.mark.ok')]));
  if (kind === 'footnote') plate.append(el('text', { class: 't-plate', x: 17.2, y: 5.2, style: 'font-size:4.6px' }, [numberSuffix(['footnote'])]));
  if (kind === 'strike') plate.append(el('path', { d: 'M7.6 9.6L16.6 3.8', 'stroke-width': 0.8 }));
  g.append(plate);
  return g;
}
