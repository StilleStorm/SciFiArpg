/** The pad glyphs of the five skills, by SkillIndex (ui/pads.ts). TODO: five small ink drawings (DESIGN 3). */
import { glyphCircle as circ } from '../figureKit';
import type { HeroPadGlyphs } from '../module';

/** Paths centred on 0,0 inside a 52 x 52 box; a leading "~" draws that stroke dotted. */
export const pads: HeroPadGlyphs = [
  [circ(0, 0, 10)],
  ['M-10 0H10M0-10V10'],
  ['M-10-10L10 10M10-10L-10 10'],
  ['M-10-10H10V10H-10Z'],
  ['~' + circ(0, 0, 12)],
];
