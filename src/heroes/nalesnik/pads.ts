/** The pad glyphs of the five skills, by SkillIndex (ui/pads.ts): a rolling disc seen edge-on with its trail, a spiral of dots falling in, a small flag. */
import { glyphCircle as circ } from '../figureKit';
import type { HeroPadGlyphs } from '../module';

export const pads: HeroPadGlyphs = [
  ['M5-14A6.5 14 0 1 0 5 14A6.5 14 0 1 0 5-14', circ(5, -6, 1.7), circ(6.5, 2, 2.1), circ(4, 9, 1.3), '~M-17-8H-4', '~M-17 0H-5', '~M-17 8H-4'],
  ['~M15.7 6.6L10.8 12.2L4.3 15.1L-2.5 14.8L-8.2 11.8L-11.9 6.7L-13.0 0.9L-11.5 -4.6L-8.0 -8.6L-3.3 -10.6L1.5 -10.3L5.4 -8.1L7.8 -4.6L8.4 -0.8L7.3 2.7L5.0 5.1L2.1 6.1L-0.7 5.8L-2.8 4.3L-3.8 2.4L-3.8 0.4L-3.0 -1.0L-1.8 -1.8', circ(0, 0, 2.6), 'M12-12L14-8L10-8'],
  ['M-5 15V-15', 'M-5-15L12-10L-5-5Z', 'M-14 15Q-5 11 6 15', 'M-5 15L-9 17M-5 15L-1 17'],
  // two rings pushing out from a small disc
  [circ(0, 0, 5), '~' + circ(0, 0, 10), 'M-12-12A17 17 0 0 1 12-12', 'M-12 12A17 17 0 0 0 12 12'],
  // a dotted orbit with a pebble on it
  ['~M-16 0A16 8 0 1 0 16 0A16 8 0 1 0 -16 0', circ(0, 0, 4.5), circ(11, -6, 2.4)],
];
