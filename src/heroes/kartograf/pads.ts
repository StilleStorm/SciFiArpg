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
  // S20. Pomiar: a ruled line with ticks and a sight on the point measured
  ['M-16 9H16', 'M-16 6V12M-8 7V11M0 6V12M8 7V11M16 6V12', circ(6, -5, 5.5), 'M6-14V4M-3-5H15'],
  // Przekroj: five survey lines fanned from one point
  ['M0 13L-17-6', 'M0 13L-9-14', 'M0 13V-15', 'M0 13L9-14', 'M0 13L17-6', circ(0, 13, 1.6)],
  // Granica: a double ruled border with posts, and a crosser stopped (dotted) in front of it
  ['M-3-15V15', 'M3-15V15', 'M-3-8H3M-3 0H3M-3 8H3', '~M-17 0H-9', 'M-12-4L-8 0L-12 4'],
  // Punkt odniesienia: a benchmark, a triangle on its pole with a ground line and the radius (dotted)
  ['M0-10L10 8H-10Z', 'M0-10V-16', circ(0, 3, 1.4), 'M-15 12H15', '~M-15 8A15 15 0 0 1 15 8'],
  // Roza wiatrow: a four-point compass rose
  ['M0-16L4-4L16 0L4 4L0 16L-4 4L-16 0L-4-4Z', circ(0, 0, 2), 'M-2-19H2'],
];
