import { createRng, type Rng } from '../core/rng';
import { type Vec } from '../core/vec';
import { FOLD, type Obstacle, type Page, type PageExit } from '../world/pages';
import { t } from '../i18n';
import { blobPoints, dotPath, el, n2, polyline, smoothClosed, wobblyCircle } from './svg';

const solid = (node: SVGElement, fill: string): void => {
  node.style.fill = fill;
  node.style.stroke = 'none';
};

function drawBlot(o: Obstacle, r: Rng): SVGGElement {
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)})` });
  let d = smoothClosed(blobPoints(r, 0, 0, o.size * 0.85, 11, 0.3));
  for (let i = 0; i < r.int(2, 4); i++) {
    const a = r.range(0, 6.28);
    d += dotPath(Math.cos(a) * o.size * r.range(1.05, 1.5), Math.sin(a) * o.size * r.range(1.05, 1.5), r.range(1.2, 3));
  }
  const p = el('path', { d });
  solid(p, 'var(--ink)');
  g.append(p);
  return g;
}

function drawRing(o: Obstacle, r: Rng): SVGGElement {
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)})` });
  const outer = el('path', { d: wobblyCircle(r, 0, 0, o.size, 14, 0.035) });
  const inner = el('path', { d: wobblyCircle(r, 0, 0, o.size * 0.88, 12, 0.04) });
  inner.setAttribute('stroke-width', '1');
  g.append(outer, inner);
  const dots = el('path', { d: dotPath(o.size * 0.7, o.size * 1.1, 2.2) + dotPath(-o.size * 0.4, o.size * 1.2, 1.4) });
  solid(dots, 'var(--ink)');
  g.append(dots);
  return g;
}

function drawNote(o: Obstacle, r: Rng): SVGGElement {
  const w = o.size;
  const h = o.size * 0.68;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) rotate(${n2((o.rot * 180) / Math.PI)})` });
  const sheet = el('path', { d: polyline([{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }], true) });
  sheet.style.fill = 'var(--paper)';
  // hatched "thickness" along the lower and right edges instead of a shadow
  const edge = el('path', {
    d: polyline([{ x: w / 2, y: -h / 2 + 4 }, { x: w / 2 + 6, y: -h / 2 + 8 }, { x: w / 2 + 6, y: h / 2 + 5 }, { x: -w / 2 + 6, y: h / 2 + 5 }, { x: -w / 2, y: h / 2 }, { x: w / 2, y: h / 2 }], true),
    fill: 'url(#hatch)',
  });
  g.append(edge, sheet);
  for (let i = 0; i < 3; i++) {
    const y = -h / 2 + 14 + i * 11;
    const len = w * r.range(0.55, 0.8);
    g.append(el('path', { d: scribble(r, -w / 2 + 9, y, len), 'stroke-width': 0.9 }));
  }
  // staple
  g.append(el('path', { d: `M${n2(-w / 2 + 7)} ${n2(-h / 2 + 3)}l9 -1`, 'stroke-width': 2.2 }), el('path', { d: `M${n2(-w / 2 + 7)} ${n2(-h / 2 + 3)}l0 3M${n2(-w / 2 + 16)} ${n2(-h / 2 + 2)}l0 3`, 'stroke-width': 1 }));
  return g;
}

/** A line of fake handwriting. */
function scribble(r: Rng, x: number, y: number, len: number): string {
  const pts: Vec[] = [];
  for (let px = 0; px <= len; px += 4) pts.push({ x: x + px, y: y + (px % 8 === 0 ? -1.6 : 1.6) * r.range(0.5, 1.2) });
  return polyline(pts);
}

function drawTorn(o: Obstacle, r: Rng, page: Page): SVGGElement {
  const s = o.size;
  // drawn for the top-right corner, then moved onto the corner the obstacle sits in
  const fx = o.x <= 0 ? -1 : 1;
  const fy = o.y <= 0 ? 1 : -1;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) scale(${fx} ${fy}) translate(${n2(-page.w)} 0)` });
  const pts: Vec[] = [{ x: page.w - s, y: 0 }];
  const steps = 9;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    pts.push({ x: page.w - s + s * t + r.range(-5, 5), y: s * t + r.range(-5, 5) });
  }
  pts.push({ x: page.w, y: s });
  // the missing corner, then the same cut offset inward and hatched like a fibrous torn edge
  const hole = el('path', { d: polyline([...pts, { x: page.w + 4, y: -4 }, { x: page.w - s, y: -4 }], true) });
  solid(hole, 'var(--paper-edge)');
  const inner = pts.map((p) => ({ x: p.x - 9 + r.range(-2, 2), y: p.y - 9 + r.range(-2, 2) }));
  const fibre = el('path', { d: polyline([...pts, ...[...inner].reverse()], true), fill: 'url(#hatch)', stroke: 'none' });
  const cut = el('path', { d: polyline(pts) });
  g.append(hole, fibre, cut);
  return g;
}

/** A hand-drawn QR code: three finder squares and a grid of hatched cells. */
function drawQr(o: Obstacle, r: Rng): SVGGElement {
  const n = 9;
  const cell = o.size / n;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) rotate(${n2((o.rot * 180) / Math.PI)})` });
  const x0 = -o.size / 2;
  const y0 = -o.size / 2;
  const j = (): number => r.range(-0.7, 0.7);
  const box = (cx: number, cy: number, w: number, h: number): string =>
    polyline(
      [
        { x: x0 + cx * cell + j(), y: y0 + cy * cell + j() },
        { x: x0 + (cx + w) * cell + j(), y: y0 + cy * cell + j() },
        { x: x0 + (cx + w) * cell + j(), y: y0 + (cy + h) * cell + j() },
        { x: x0 + cx * cell + j(), y: y0 + (cy + h) * cell + j() },
      ],
      true,
    );
  const finder = (cx: number, cy: number): void => {
    g.append(el('path', { d: box(cx, cy, 3, 3), 'stroke-width': 2 }));
    const core = el('path', { d: box(cx + 0.9, cy + 0.9, 1.2, 1.2) });
    solid(core, 'var(--ink)');
    g.append(core);
  };
  g.append(el('path', { d: box(-0.4, -0.4, n + 0.8, n + 0.8), 'stroke-width': 1 }));
  finder(0, 0);
  finder(n - 3, 0);
  finder(0, n - 3);
  let hatched = '';
  for (let cy = 0; cy < n; cy++) {
    for (let cx = 0; cx < n; cx++) {
      const inFinder = (cx < 4 && cy < 4) || (cx > n - 5 && cy < 4) || (cx < 4 && cy > n - 5);
      if (inFinder || !r.chance(0.5)) continue;
      hatched += box(cx + 0.08, cy + 0.08, 0.84, 0.84);
    }
  }
  g.append(el('path', { d: hatched, fill: 'url(#hatch)', 'stroke-width': 0.8 }));
  return g;
}

/** A sticky note: curled corner, a gummed strip, two lines and an exclamation mark. */
function drawSticky(o: Obstacle, r: Rng): SVGGElement {
  const w = o.size;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) rotate(${n2((o.rot * 180) / Math.PI)})` });
  const c = w * 0.22;
  const sheet = el('path', {
    d: polyline([{ x: -w / 2, y: -w / 2 }, { x: w / 2, y: -w / 2 }, { x: w / 2, y: w / 2 - c }, { x: w / 2 - c, y: w / 2 }, { x: -w / 2, y: w / 2 }], true),
  });
  sheet.style.fill = 'var(--paper)';
  const curl = el('path', { d: polyline([{ x: w / 2, y: w / 2 - c }, { x: w / 2 - c * 0.9, y: w / 2 - c * 0.9 }, { x: w / 2 - c, y: w / 2 }]), fill: 'url(#hatch)' });
  const strip = el('path', { d: polyline([{ x: -w / 2, y: -w / 2 }, { x: w / 2, y: -w / 2 }, { x: w / 2, y: -w / 2 + 9 }, { x: -w / 2, y: -w / 2 + 9 }], true), fill: 'url(#hatch-wide)', 'stroke-width': 1 });
  g.append(sheet, strip, curl);
  for (let i = 0; i < 3; i++) g.append(el('path', { d: scribble(r, -w / 2 + 8, -w / 2 + 24 + i * 12, w * r.range(0.4, 0.72)), 'stroke-width': 0.9 }));
  g.append(el('path', { d: `M${n2(w / 2 - 14)} ${n2(-w / 2 + 18)}l-1 12`, 'stroke-width': 2.2 }), el('path', { d: dotPath(w / 2 - 15, -w / 2 + 38, 1.6), 'stroke-width': 1 }));
  return g;
}

/** A paperclip lying on the sheet. */
function drawClip(o: Obstacle): SVGGElement {
  const hl = o.size / 2;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)}) rotate(${n2((o.rot * 180) / Math.PI)})` });
  g.append(
    el('path', {
      d: `M${n2(-hl + 12)} 3H${n2(hl - 10)}a6.5 6.5 0 0 0 0 -13H${n2(-hl + 6)}a9 9 0 0 0 0 18H${n2(hl - 18)}`,
      'stroke-width': 2,
    }),
  );
  return g;
}

/** The paczkomat: a column of lockers on stilts, a hatched screen, an antenna, a label. */
function drawKiosk(o: Obstacle, r: Rng): SVGGElement {
  const w = o.size * 0.62;
  const h = o.size * 1.05;
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y - 4)})` });
  const body = el('path', { d: polyline([{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }], true), 'stroke-width': 2 });
  body.style.fill = 'var(--paper)';
  g.append(body);
  g.append(el('path', { d: `M${n2(w / 2 - 9)} ${n2(-h / 2)}L${n2(w / 2 - 9)} ${n2(-h / 2 - 22)}M${n2(w / 2 - 9)} ${n2(-h / 2 - 22)}l-5 -4M${n2(w / 2 - 9)} ${n2(-h / 2 - 22)}l5 -4`, 'stroke-width': 1.3 }));
  const screen = el('path', { d: polyline([{ x: -w / 2 + 7, y: -h / 2 + 18 }, { x: w / 2 - 7, y: -h / 2 + 18 }, { x: w / 2 - 7, y: -h / 2 + 36 }, { x: -w / 2 + 7, y: -h / 2 + 36 }], true), fill: 'url(#hatch)', 'stroke-width': 1.2 });
  g.append(screen);
  const label = el('text', { class: 't-plate', x: 0, y: n2(-h / 2 + 12), 'font-size': 8 }, [t('laws.kiosk.label')]);
  g.append(label);
  const cols = 3;
  const rows = 4;
  const cw = (w - 14) / cols;
  const ch = (h - 58) / rows;
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = -w / 2 + 7 + cx * cw;
      const y = -h / 2 + 44 + ry * ch;
      const door = el('path', { d: polyline([{ x, y }, { x: x + cw - 2, y }, { x: x + cw - 2, y: y + ch - 2 }, { x, y: y + ch - 2 }], true), 'stroke-width': 1 });
      if (r.chance(0.35)) door.setAttribute('fill', 'url(#hatch)');
      g.append(door);
    }
  }
  for (const side of [-1, 1]) {
    const lx = side * (w / 2 - 9);
    g.append(el('path', { d: `M${n2(lx)} ${n2(h / 2)}L${n2(lx + side * 3)} ${n2(h / 2 + 15)}M${n2(lx + side * 3)} ${n2(h / 2 + 15)}h${n2(side * 8)}`, 'stroke-width': 1.7 }));
  }
  return g;
}

/**
 * The exit: the page's corner folded over (a dog-ear). The cut-off corner shows the table; the flap is
 * the back of the sheet, hatched, with an arrow into the corner. Drawn for the top-left corner, mirrored for the rest.
 */
function drawExit(page: Page, exit: PageExit, seed: number): SVGGElement {
  const r = createRng(seed);
  const fx = exit.corner[1] === 'l' ? 1 : -1;
  const fy = exit.corner[0] === 't' ? 1 : -1;
  const a = FOLD;
  const pad = page.inset + 5;
  const g = el('g', { transform: `translate(${n2(exit.x)} ${n2(exit.y)}) scale(${fx} ${fy})` });
  const j = (): number => r.range(-1.6, 1.6);
  // the missing corner, with the table showing through
  const hole = el('path', { d: polyline([{ x: -pad, y: -pad }, { x: a + pad, y: -pad }, { x: -pad, y: a + pad }], true) });
  solid(hole, 'var(--paper-edge)');
  // the flap: reflection of the cut-off corner across the fold line
  const flapPts: Vec[] = [{ x: a + pad, y: -pad }, { x: a * 0.5 + j(), y: a * 0.5 + j() }, { x: -pad, y: a + pad }, { x: a + pad + j(), y: a + pad + j() }];
  const flap = el('path', { d: polyline([flapPts[0] as Vec, flapPts[2] as Vec, flapPts[3] as Vec], true), 'stroke-width': 1.9 });
  flap.style.fill = 'var(--paper)';
  const back = el('path', { d: polyline([flapPts[0] as Vec, flapPts[2] as Vec, flapPts[3] as Vec], true), fill: 'url(#hatch-wide)', stroke: 'none' });
  const crease = el('path', { d: `M${n2(a + pad - 6)} ${n2(-pad + 2)}Q${n2(a * 0.5)} ${n2(a * 0.5 - 6)} ${n2(-pad + 2)} ${n2(a + pad - 6)}`, 'stroke-width': 0.9 });
  g.append(hole, flap, back, crease);
  // a pen arrow on the flap pointing at the corner
  const arrow = el('g', { transform: `translate(${n2(a * 0.62)} ${n2(a * 0.62)}) rotate(-135)` });
  arrow.append(el('path', { d: 'M-16 0H16M6-7L17 0L6 7', 'stroke-width': 2.2 }));
  g.append(arrow);
  const cx = exit.x + fx * (a + pad - 14);
  const cy = exit.y + fy * (a + pad + 22);
  const word = el('text', { class: 't-note', x: n2(cx), y: n2(cy), 'text-anchor': 'middle', 'font-size': 13 }, [t('ui.exit.next')]);
  const wrap = el('g', {}, [g, word]);
  return wrap;
}

export interface PageHeader {
  /** The form line: ticket number, page "n z m". */
  top: string;
  /** The regulamin clause as printed. */
  clause: string;
}

/** Break a text into lines of at most `max` characters. */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    if (cur && cur.length + 1 + word.length > max) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** The page header: one printed form with the HUD above it. Mono form line, then the clause in italic. */
function drawHeader(page: Page, header: PageHeader): SVGGElement {
  const g = el('g', {});
  const topLeft = page.torn === 'tl' || page.exit?.corner === 'tl';
  const topRight = page.torn === 'tr' || page.exit?.corner === 'tr';
  const x0 = topLeft ? 180 : 52;
  const x1 = topRight ? page.w - 180 : page.w - 52;
  const maxChars = Math.floor((x1 - x0) / 7.4);
  const top = el('text', { class: 't-head-top', x: x0, y: 52 }, [header.top]);
  g.append(top);
  const lines = wrapText(header.clause, maxChars).slice(0, 3);
  lines.forEach((line, i) => g.append(el('text', { class: 't-head', x: x0, y: 74 + i * 20 }, [line])));
  const ruleY = 74 + lines.length * 20 - 6;
  g.append(el('path', { d: `M${x0} ${ruleY}H${n2(Math.min(x1, x0 + 300))}`, 'stroke-width': 0.9 }));
  return g;
}

/** Fill the #page layer: the margin, the frame, the hatched edge and every obstacle. */
export function drawPage(layer: SVGGElement, page: Page, header?: PageHeader): SVGGElement {
  layer.replaceChildren();
  const { w, h, inset } = page;
  const pad = 600;

  // beyond the paper: a darker surface, with the page cut out of it
  const beyond = el('path', {
    d: `M${-pad} ${-pad}H${w + pad}V${h + pad}H${-pad}ZM0 0V${h}H${w}V0Z`,
    'fill-rule': 'evenodd',
  });
  solid(beyond, 'var(--paper-edge)');
  // paper grain, in world space so it moves with the page
  const grain = el('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#paper)', stroke: 'none' });
  // hatched edge strip between the paper's edge and the inner frame
  const strip = el('path', {
    d: `M0 0H${w}V${h}H0ZM${inset - 5} ${inset - 5}V${h - inset + 5}H${w - inset + 5}V${inset - 5}Z`,
    'fill-rule': 'evenodd',
    fill: 'url(#hatch-wide)',
    stroke: 'none',
  });
  const frame = el('path', {
    d: `M${inset} ${inset}H${w - inset}V${h - inset}H${inset}Z`,
    'stroke-width': 1.3,
  });
  const frame2 = el('path', {
    d: `M${inset - 5} ${inset - 5}H${w - inset + 5}V${h - inset + 5}H${inset - 5}Z`,
    'stroke-width': 0.8,
  });
  const ink = el('g', {});
  layer.append(beyond, grain, ink);
  ink.append(strip, frame2, frame);

  for (const o of page.obstacles) {
    const r = createRng(o.seed);
    switch (o.kind) {
      case 'blot':
        ink.append(drawBlot(o, r));
        break;
      case 'ring':
        ink.append(drawRing(o, r));
        break;
      case 'note':
        ink.append(drawNote(o, r));
        break;
      case 'torn':
        ink.append(drawTorn(o, r, page));
        break;
      case 'qr':
        ink.append(drawQr(o, r));
        break;
      case 'sticky':
        ink.append(drawSticky(o, r));
        break;
      case 'clip':
        ink.append(drawClip(o));
        break;
      case 'kiosk':
        ink.append(drawKiosk(o, r));
        break;
    }
  }
  if (page.exit) ink.append(drawExit(page, page.exit, page.index * 977 + 13));
  if (header) ink.append(drawHeader(page, header));
  return ink;
}
