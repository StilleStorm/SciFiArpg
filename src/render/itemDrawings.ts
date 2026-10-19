/**
 * Small ink drawings of the base items (path data), used on the ground and on the inventory plates.
 * Every drawing sits in a box of about 44 x 44 units centered on (0, 0). Strokes only; `hatch`
 * is an optional region filled with the shared hatching pattern.
 */
import { affixMarks, buildAffixMarks, buildTierMark, type MarkSubject } from './itemMarks';
import { el, n2 } from './svg';

/** A circle as path data. */
const c = (cx: number, cy: number, r: number): string => `M${n2(cx - r)} ${n2(cy)}a${r} ${r} 0 1 0 ${n2(2 * r)} 0a${r} ${r} 0 1 0 ${n2(-2 * r)} 0`;

export interface Drawing {
  d: string;
  hatch?: string;
}

const FIRST: Record<string, Drawing> = {
  // rubber stamp: knob, flange, body, pad, impression
  pieczatka: {
    d: 'M-3-20Q0-23 3-20L2-11H-2ZM-9-11H9V-7H-9ZM-7-7V3H7V-7M-2-3H2M-11 6H11V10H-11ZM-8 14H8M-5 17H5M-10 13V10M10 13V10',
    hatch: 'M-11 6H11V10H-11Z',
  },
  // handheld vacuum cleaner
  odkurzacz: {
    d: `M-17-3H4Q10-3 10 4V9H-17ZM-17-3V-11Q-17-15-13-15H-9Q-5-15-5-11V-3M10 4H20L18 9H10M-13 9V12M-3 9V12M-15 12H-1M-8-9H-13${c(-9, 15, 3)}M2 4H6M2 6H6`,
    hatch: 'M-14 0H-2V6H-14Z',
  },
  // laser pointer with rays
  wskaznik: {
    d: 'M-18 8L8-16L12-12L-14 12ZM-14 12L-18 8M-10 6L-6 10M-4 0L0 4M13-14L18-19M16-9L21-10M10-18L11-23M-18 8L-20 14L-14 12',
  },
  // cable with plugs and a loop
  kabel: {
    d: `M-20 5H-15V12H-20ZM-17.5 5V1M-19.5 1H-15.5M-15 8Q-8 14-4 5T6 1T14-9M14-9L18-13M16-7L20-11M12-11L16-15${c(-6, -5, 4)}M-4-5Q2-12 8-8`,
  },
  // barcode scanner gun
  czytnik: {
    d: 'M-15-8H6L10-2V4H-15ZM-7 4L-9 17H-1L1 4M12-8V4M14.5-8V4M18-8V4M-11-4H-3M-11 0H-6M10-2H20M-1 8H3',
    hatch: 'M-15-8H-2V4H-15Z',
  },
  // courier helmet with a box on top
  kask: {
    d: 'M-17 7Q-17-13 0-13Q17-13 17 7ZM-20 7H20M-5-13V-17H5V-13M-6-16H6M-6 7Q-6-6 0-8M6 7Q6-6 0-8M10-4L14-4M10 0L15 0',
    hatch: 'M-17 7Q-17-4-12-9L-12 7Z',
  },
  // headphones with a mic boom
  sluchawki: {
    d: 'M-14 6V-2Q-14-17 0-17Q14-17 14-2V6M-18-2H-11V9H-18ZM11-2H18V9H11ZM-14 9Q-12 16-4 15M-5 13H-1V17H-5Z',
    hatch: 'M11-2H18V9H11Z',
  },
  // cap with a logo
  czapka: {
    d: `M-15 5Q-15-12 0-12Q15-12 15 5ZM11 5Q24 4 21 9H8M0-12V-16M-3-17H3${c(0, -3, 3.4)}M-15 5Q-17 9-14 9H8`,
  },
  // reflective vest
  kamizelka: {
    d: 'M-11-17L-5-17Q0-10 5-17L11-17L17-8L13-2V17H-13V-2L-17-8ZM-13 4H13M-13 10H13M0-10V17',
    hatch: 'M-13 4H13V10H-13Z',
  },
  // work apron
  fartuch: {
    d: 'M-8-18H8L10-7L15 17H-15L-10-7ZM-8-18Q0-8 8-18M-10-7L-17-3M10-7L17-3M-6 4H6V11H-6ZM-6 4L-4 1H4L6 4',
    hatch: 'M-6 4H6V11H-6Z',
  },
  // touch gloves
  rekawiczki: {
    d: 'M-10 17V3H10V17ZM-10 3V-10H-6V3M-6 3V-13H-2V3M-2 3V-14H2V3M2 3V-12H6V3M10 9L17 3L19 6L10 14M-10 12H10M-8-8H-8.1M-4-11H-4.1',
    hatch: 'M-10 12H10V17H-10Z',
  },
  // charger: block, prongs, cable
  ladowarka: {
    d: `M-9-9H9V8H-9ZM-4-9V-15M4-9V-15M-6-15H-2M2-15H6M0 8Q0 16 9 16L15 12M-2-3L2-3L-1 3L3 3${c(15, 12, 1.5)}`,
    hatch: 'M3-9H9V8H3Z',
  },
  // USB dongle on a loop
  dongle: {
    d: `M-6-6H6V14H-6ZM-4-6V-17H4V-6M-2-14H-1.9M2-14H2.1M-3 4H3M-3 8H3${c(0, 18, 3)}`,
    hatch: 'M-6 8H6V14H-6Z',
  },
  // loyalty card with a stripe and a star
  karta: {
    d: `M-17-11H17V11H-17ZM-17-5H17M-13 3H-2M-13 7H4${c(10, 5, 3.4)}M10 2V3M-17-11L-15-13H19L17-11`,
    hatch: 'M-17-5H17V-8H-17Z',
  },
  // an unspecified device: box, screen, dial, antenna
  urzadzenie: {
    d: `M-15-9H15V12H-15ZM-11-5H-1V2H-11ZM8-9L12-18M10-19.5H14M-11 6H-3${c(8, 0, 4)}M8 0L10-2M-12 12V16M12 12V16M4 7H12`,
    hatch: 'M-11-5H-1V2H-11Z',
  },
  // regulamin: many pages, a section sign
  regulamin: {
    d: 'M-12-17H7L12-12V17H-12ZM7-17V-12H12M-8-9H3M-8-5H6M-8-1H6M-8 3H2M-8 7H6M-8 11H0M-14-14V19H10',
  },
  // certificate with a rosette
  certyfikat: {
    d: `M-18-12H18V9H-18ZM-15-9H15V6H-15ZM-11-4H3M-11 0H1${c(10, 3, 4.5)}M7 7L5 15L10 12L15 15L13 7M-9-7H-3`,
  },
  // screenshot: phone frame, selection corners, a mountain
  zrzut: {
    d: 'M-11-18H11V18H-11ZM-7-10H-3M-7-10V-6M7-10H3M7-10V-6M-7 10H-3M-7 10V6M7 10H3M7 10V6M-5 5L-1 0L2 3L5-2M0-18V-16',
    hatch: 'M-7 6H7V10H-7Z',
  },
  // official letter with a stamp and a signature
  zaswiadczenie: {
    d: `M-13-17H13V17H-13ZM-9-11H5M-9-7H8M-9-3H3${c(6, 5, 6)}M3 5H9M6 2V8M-10 12Q-8 6-5 12T0 12T4 13`,
  },
};

/** Dots (tiny circles) on a grid, for buttons and beads. */
const dots = (xs: readonly number[], ys: readonly number[], r: number): string => ys.map((y) => xs.map((x) => c(x, y, r)).join('')).join('');

/** The 21 bases of S8 (ITEMS 2). */
const MORE: Record<string, Drawing> = {
  // stapler: hinged wedge on a base, two staples in flight
  zszywacz: {
    d: 'M-18 7H17V11H-18ZM-18 7V1Q-18-3-14-4L14-8Q17-9 17-5V7M-13-1L10-4M13-15H18V-12M13-15V-12M3-19H8V-16M3-19V-16',
    hatch: 'M-18 7H17V11H-18Z',
  },
  // lever-arch binder: spine, two rings, label window
  segregator: {
    d: `M-10-19H10V19H-10ZM-10-14H10M-10 14H10M10-6H16V6H10${c(0, -9, 2.6)}${c(0, 9, 2.6)}M-6-3H6V4H-6Z`,
    hatch: 'M-6-3H6V4H-6Z',
  },
  // magnifier with a dotted beetle in the lens
  lupa: {
    d: `${c(-4, -4, 12)}M5 5L16 16L19 13L8 2M-9-8L-7-6M-9-1L-7-3M1-8L-1-6M1-1L-1-3${c(-4, -4, 3.2)}`,
    hatch: 'M-12-9Q-8-15-2-14L-9 -6Z',
  },
  // safety goggles: two lenses, side shields
  okulary: {
    d: 'M-18-6H-3V6H-18ZM3-6H18V6H3ZM-3-2H3M-18-4L-21-7M18-4L21-7M-18 6L-20 9M18 6L20 9',
    hatch: 'M-18-6H-3V6H-18Z',
  },
  // sun visor: a sweatband and a wide flat brim, no crown
  daszek: {
    d: 'M-17-5Q0-12 17-5V0Q0-7-17 0ZM-17-5V0M17-5V0M-17 0Q0-7 17 0L22 10Q0 3-22 10ZM-14 6L-10 9',
    hatch: 'M-17 0Q0-7 17 0L22 10Q0 3-22 10Z',
  },
  // headband with a headlamp that is not lit
  opaska: {
    d: `M-18-5Q0-11 18-5V6Q0 12-18 6ZM-18 6V-5M18 6V-5${c(0, 1, 3.6)}M-6-14L-8-18M0-15V-19M6-14L8-18`,
    hatch: 'M-18-5Q-12-7-6-7V9Q-12 8-18 6Z',
  },
  // hood with a face opening, a drawstring and a loose thread
  kaptur: {
    d: 'M-16 18Q-19-6 0-18Q19-6 16 18ZM-8 14Q-10 0 0-7Q10 0 8 14M-8 14Q0 18 8 14M-5 16L-6 21Q-7 23-4 22M5 16V21',
    hatch: 'M-16 18Q-19-6 0-18Q-12-6-10 14L-8 14Q-10 0 0-7Q-14 2-16 18Z',
  },
  // shower cap: gathered edge and crinkles
  czepek: {
    d: 'M-16 4Q-18-4-12-10Q-8-16 0-15Q8-16 12-10Q18-4 16 4Q14 9 0 9Q-14 9-16 4ZM-10-8Q-8-4-10 0M-4-12Q-2-8-4-4M3-12Q5-8 3-4M9-8Q11-4 9 0M-14 9Q-12 14-8 12T0 13T8 12T14 9',
  },
  // long double-breasted coat
  plaszcz: {
    d: 'M-8-18H8L11-14L17-4L13 0V19H-13V0L-17-4L-11-14ZM0-12V19M-4-14L0-8L4-14M-7-6H-5M-7-1H-5M-7 4H-5M-7 9H-5M5-6H7M5-1H7M5 4H7M5 9H7',
  },
  // promotional T-shirt with a slogan box
  koszulka: {
    d: 'M-7-17Q0-12 7-17L16-12L20-4L14-1L12-3V17H-12V-3L-14-1L-20-4L-16-12ZM-7 1H7V9H-7ZM-4 4H4M-4 6.5H2',
    hatch: 'M-7 1H7V9H-7Z',
  },
  // overall with a zip and a badge
  kombinezon: {
    d: 'M-6-19H6L9-14L17-8L14-2L10-4V4L11 19H3L0 8L-3 19H-11L-10 4V-4L-14-2L-17-8L-9-14ZM0-14V8M-7-7H-3V-2H-7Z',
    hatch: 'M-7-7H-3V-2H-7Z',
  },
  // adjustable braces with clips
  szelki: {
    d: 'M-12-19H-7V-2L0 8L7-2V-19H12V0L3 12V19H-3V12L-12 0ZM-13-22H-6V-19M6-22H13V-19M-15 0H-8V4H-15ZM8 0H15V4H8Z',
    hatch: 'M-3 12H3V19H-3Z',
  },
  // consultant's jacket: lapels, one button
  marynarka: {
    d: `M-8-18H-3L0-10L3-18H8L18-8L15 19H-15L-18-8ZM-3-18L-8 2L0 8L8 2L3-18M0 8V19${c(0, 13, 1.6)}M-12-3L-12 12M12-3L12 12`,
  },
  // power bank: four bars, three filled
  powerbank: {
    d: 'M-9-17H9V18H-9ZM-3-17V-20H3V-17M-5-11H5V-7H-5ZM-5-5H5V-1H-5ZM-5 1H5V5H-5ZM-5 7H5V11H-5Z',
    hatch: 'M-5-5H5V11H-5Z',
  },
  // universal remote: slab with a grid of buttons
  pilot: {
    d: `M-8-19H8V19H-8Z${c(0, -13, 2.4)}${dots([-3.6, 3.6], [-5, 1, 7, 13], 1.7)}`,
  },
  // abacus: frame, rows of beads
  liczydlo: {
    d: `M-18-16H18V16H-18ZM-18-8H18M-18 0H18M-18 8H18${dots([-12, -8, -4, 10, 14], [-12], 2)}${dots([-13, -9, 3, 7, 11], [-4], 2)}${dots([-12, 8, 12, 16], [4], 2)}${dots([-5, -1, 3], [12], 2)}`,
  },
  // wristwatch: face, one hand, strap, crown
  zegarek: {
    d: `${c(0, 0, 10)}M0 0V-6M0 0L4 2M-5-10L-6-19H6L5-10M-5 10L-6 19H6L5 10M10-2H13V2H10ZM0-8V-7M8 0H7M0 8V7M-8 0H-7`,
    hatch: 'M-6-19H6L5-10H-5Z',
  },
  // invoice: lines and a totals box
  faktura: {
    d: 'M-12-18H12V18H-12ZM-8-12H4M-8-8H8M-8-4H8M-8 0H8M0 6H8V13H0ZM-8 6H-4M-8 9H-4',
    hatch: 'M0 6H8V13H0Z',
  },
  // till receipt: a narrow strip with a torn edge, text fading into dots
  paragon: {
    d: 'M-6-19H6V17L4 19L2 17L0 19L-2 17L-4 19L-6 17ZM-3-13H3M-3-9H3M-3-5H1M-3 0H-2.9M0 0H0.1M3 0H3.1M-3 4H-2.9M2 4H2.1M-1 9H-0.9',
  },
  // policy: a sheet with an umbrella
  polisa: {
    d: 'M-12-18H12V18H-12ZM-8-13H8M-8-9H3M-8 0Q0-14 8 0Q4-2.5 0 0Q-4-2.5-8 0M0 0V8Q0 11-3 10M-8 14H6',
    hatch: 'M-8 0Q0-14 8 0Q4-2.5 0 0Q-4-2.5-8 0Z',
  },
  // authorization: a blank line and a signature
  upowaznienie: {
    d: 'M-12-18H12V18H-12ZM-8-11H8M-8-7H4M-8-1H8M-8 3H-4M0 3H4M-9 13Q-7 5-4 13T1 13T6 14',
  },
};

export const DRAWINGS: Readonly<Record<string, Drawing>> = { ...FIRST, ...MORE };

const FALLBACK = DRAWINGS['urzadzenie'];

export function drawingOf(id: string): Drawing {
  return DRAWINGS[id] ?? FALLBACK ?? { d: '' };
}

/** A five-pointed star as one continuous scribble (a little off, not quite closed). */
export function starPath(r = 8): string {
  const pts: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
    const wob = i === 5 ? 1.06 : 1;
    pts.push(`${i === 0 ? 'M' : 'L'}${n2(Math.cos(a) * r * wob)} ${n2(Math.sin(a) * r * wob)}`);
  }
  return pts.join('');
}

/** The drawing as a <g> (child of an <svg> or of the world). `dotted` redraws it in dotted stroke (domniemany). */
export function buildDrawing(id: string, dotted = false): SVGGElement {
  const dr = drawingOf(id);
  const g = el('g', { class: 'item-drawing' });
  if (dr.hatch) g.append(el('path', { d: dr.hatch, fill: 'url(#hatch)', stroke: 'none' }));
  g.append(el('path', dotted ? { d: dr.d, 'stroke-dasharray': '0.1 2.6', 'stroke-width': 1.8 } : { d: dr.d }));
  return g;
}

/**
 * Standalone inline SVG for the HTML sheets: viewBox -22..22, strokes from CSS (.fig svg).
 * With `item` the tier mark and the affix marks are drawn over the art (they are never left out of a sheet).
 */
export function drawingSvg(id: string, item?: MarkSubject): SVGSVGElement {
  const svg = el('svg', { viewBox: '-23 -23 46 46', class: 'pfig-svg', 'aria-hidden': 'true' });
  const kinds = item ? affixMarks(item) : [];
  svg.append(buildDrawing(id, kinds.includes('dotted')));
  if (item) {
    const tier = buildTierMark(item);
    const aff = buildAffixMarks(kinds);
    if (tier) svg.append(tier);
    if (aff) svg.append(aff);
  }
  return svg;
}
