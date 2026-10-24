/**
 * The page of the finale (STORY 3, 8.4): the base of planet 1 again, but every station is struck through and hatched over by the
 * editor's pen, none opens, and the desk's place is the Anomalia's. The drawings are the base's own (`render/stations.ts`); on top of
 * each one go a hatched patch and two strokes of the red pen, and the word "skreslono" beside it. The exit is not drawn: there is none.
 * Everything lives in the #page layer like the base; nothing here owns state.
 */
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { STATION_BOX, type Station } from '../world/base';
import type { Page } from '../world/pages';
import { drawIn } from './ink';
import { drawHeader, drawPage, type PageHeader } from './obstacles';
import { drawProp, drawStation } from './stations';
import { el, n2, wobblyLine } from './svg';

/** Two strokes across a station and its hatched patch, in the pen's red, seeded by the station so the redraw is the same. */
function struckOver(st: Station): SVGGElement {
  const box = STATION_BOX[st.id];
  const rng = createRng(Math.round(st.x * 17 + st.y * 5)).fork('struck');
  const g = el('g', { 'data-struck': st.id, transform: `translate(${n2(st.x)} ${n2(st.y)})` });
  const patch = el('path', {
    d: `M${n2(box.x0)} ${n2(box.y0)}H${n2(box.x1)}V${n2(box.y1)}H${n2(box.x0)}Z`,
    fill: 'url(#hatch-wide)',
    stroke: 'none',
  });
  patch.style.opacity = '0.55';
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const pen = (d: string): SVGPathElement => {
    const p = el('path', { d, 'stroke-width': 2.2 });
    p.style.stroke = 'var(--accent)';
    p.style.fill = 'none';
    return p;
  };
  const a = pen(wobblyLine(rng, box.x0 - 6, box.y0 + h * 0.1, box.x1 + 6, box.y1 - h * 0.14, 5, 1.6));
  const b = pen(wobblyLine(rng, box.x1 + 6, box.y0 + h * 0.24, box.x0 - 6, box.y1 - h * 0.04, 5, 1.6));
  const word = el('text', { class: 't-struck', x: n2(box.x1 - w * 0.25), y: n2(box.y0 - 4), transform: `rotate(-7 ${n2(box.x1)} ${n2(box.y0)})` }, [t('ui.ink.struck')]);
  g.append(patch, a, b, word);
  return g;
}

/**
 * Draw the finale's one page into the #page layer: paper, frame and decor of the base layout, the props, the five stations drawn
 * and struck, the header. Returns the ink group.
 */
export function drawFinalePage(layer: SVGGElement, page: Page, header: PageHeader | null, planet = 0): SVGGElement {
  const info = page.base;
  const decorOnly: Page = { ...page, obstacles: page.obstacles.filter((o) => o.station === undefined), exit: null };
  const ink = drawPage(layer, decorOnly);
  if (!info) return ink;
  const props = el('g', { class: 'base-props' });
  for (const p of [...info.props].sort((a, b) => a.y - b.y)) props.append(drawProp(p));
  const stations = el('g', { class: 'base-stations finale-struck' });
  for (const st of [...info.stations].sort((a, b) => a.y - b.y)) stations.append(drawStation(st, planet), struckOver(st));
  ink.append(props, stations);
  if (header) ink.append(drawHeader(page, header, { cls: 'base-header', avoidExit: false }));
  drawIn(props, 400);
  drawIn(stations, 600);
  return ink;
}
