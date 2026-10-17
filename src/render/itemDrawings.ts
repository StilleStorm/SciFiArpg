/**
 * Small ink drawings of the base items (path data), used on the ground and on the inventory plates.
 * Every drawing sits in a box of about 44 x 44 units centered on (0, 0). Strokes only; `hatch`
 * is an optional region filled with the shared hatching pattern.
 */
import { el, n2 } from './svg';

/** A circle as path data. */
const c = (cx: number, cy: number, r: number): string => `M${n2(cx - r)} ${n2(cy)}a${r} ${r} 0 1 0 ${n2(2 * r)} 0a${r} ${r} 0 1 0 ${n2(-2 * r)} 0`;

export interface Drawing {
  d: string;
  hatch?: string;
}

export const DRAWINGS: Readonly<Record<string, Drawing>> = {
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

/** The drawing as a <g> (child of an <svg> or of the world). */
export function buildDrawing(id: string): SVGGElement {
  const dr = drawingOf(id);
  const g = el('g', { class: 'item-drawing' });
  if (dr.hatch) g.append(el('path', { d: dr.hatch, fill: 'url(#hatch)', stroke: 'none' }));
  g.append(el('path', { d: dr.d }));
  return g;
}

/** Standalone inline SVG for the HTML sheets: viewBox -22..22, strokes from CSS (.fig svg). */
export function drawingSvg(id: string): SVGSVGElement {
  const svg = el('svg', { viewBox: '-23 -23 46 46', class: 'pfig-svg', 'aria-hidden': 'true' });
  svg.append(buildDrawing(id));
  return svg;
}
