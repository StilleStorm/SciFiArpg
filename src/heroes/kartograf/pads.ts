/** The pad glyphs of the five skills, by SkillIndex (ui/pads.ts): a theodolite, a dashed area, a crossed pin. */
import { glyphCircle as circ } from '../figureKit';
import type { HeroPadGlyphs } from '../module';

export const pads: HeroPadGlyphs = [
  ['M0 3L-10 15M0 3L10 15M0 3V15', 'M-6-8H6V3H-6Z', 'M-6-4H-15M-15-7V-1', circ(0, -2.5, 2.6), 'M-3-12H3V-8H-3Z'],
  ['~' + 'M-15 0A15 10 0 1 0 15 0A15 10 0 1 0 -15 0', 'M-6 0H6M0-5V5', 'M-10-6l2 2M10 6l2 2M10-6l-2 2M-10 6l-2 2'],
  ['M0-12C-6-12-7-4 0 5C7-4 6-12 0-12Z', circ(0, -7, 2), 'M0 5V13', 'M-13 12L13-12'],
  // a ruler with ticks and the scale 1:1 above it
  ['M-16-1H16V9H-16Z', 'M-12-1V4M-8-1V2M-4-1V4M0-1V2M4-1V4M8-1V2M12-1V4', 'M-9-14V-7', 'M-4-12.5v.1M-4-9v.1', 'M1-14V-7'],
  // a legend box with three ruled lines, each with its swatch
  ['M-14-13H14V13H-14Z', 'M-10-8H-6V-5H-10Z', 'M-2-6.5H10', 'M-10-1H-6V2H-10Z', 'M-2 0.5H10', 'M-10 6H-6V9H-10Z', 'M-2 7.5H10'],
];
