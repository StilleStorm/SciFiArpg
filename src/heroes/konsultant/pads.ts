/** The pad glyphs of the five skills, by SkillIndex (ui/pads.ts): an hourglass, a redirect arrow, a headset. */
import { glyphCircle as circ } from '../figureKit';
import type { HeroPadGlyphs } from '../module';

export const pads: HeroPadGlyphs = [
  ['M-8-13H8M-8 13H8M-7-13C-7-4-1-2 0 0C-1 2-7 4-7 13M7-13C7-4 1-2 0 0C1 2 7 4 7 13', 'M-3.5 11H3.5M0 3V9'],
  ['M-13 12V0Q-13-11-2-11H11', 'M6-17L12-11L6-5', 'M-13 12H-6'],
  ['M-11 3A11 11 0 0 1 11 3', 'M-14 0H-10V9H-14Z', 'M10 0H14V9H10Z', 'M-12 9Q-10 15 0 15', circ(1, 15, 1.6)],
  // a ticket with three digit-like strokes, its stub torn off along a perforated edge
  ['M11-10H-16V10H11', 'M-12-4L-9-6V6', 'M-5-6H0L-3 6', 'M3-6H6.5L4.5-1Q8-1 7.5 2.5Q7 6 3 6', '~M11-10V10', 'M11-10H17V10H11'],
  // a line cut by a short bar, a handset at one end
  ['M-17-5H-12V5H-17Z', 'M-12 0H-4', '~M4 0H17', 'M-3 8L3-8'],
];
