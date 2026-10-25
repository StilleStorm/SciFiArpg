/** The pad glyphs of the five skills, by SkillIndex (ui/pads.ts): two cosmonauts, a pair of speech bubbles, a loop. */
import { glyphCircle as circ } from '../figureKit';
import type { HeroPadGlyphs } from '../module';

export const pads: HeroPadGlyphs = [
  [circ(-8, -6, 5.5), 'M-13-3H-3L-4 9H-12Z', 'M-11 9V15M-5 9V15', '~' + circ(8, -4, 5.5), '~M3 -1H13L12 11H4Z', '~M5 11V17M11 11V17'],
  ['M-15-14H3V-1H-8L-12 4V-1H-15Z', 'M-4-3H15V10H9L6 15V10H-4Z', 'M-11-9H-1M0 2H11M0 6H8'],
  ['M-12 0C-12-12-2-12 0 0C2 12 12 12 12 0C12-12 2-12 0 0C-2 12-12 12-12 0', 'M7 8L12 2L16 8'],
  // the same thing said twice: two identical speech strokes, an equals sign beneath
  ['M-16-15H-2V-3H-9L-12 1V-3H-16Z', 'M-12-9H-6', 'M2-15H16V-3H9L6 1V-3H2Z', 'M6-9H12', 'M-8 8H8M-8 14H8'],
  // a capsule above a dotted fall line and the ground
  ['M-6-15Q0-21 6-15V0Q0 6-6 0Z', circ(0, -9, 2.2), '~M0 6V14', 'M-12 16H12'],
  // S20. Uwaga: a margin rule and a scribbled remark with an arrow under it
  ['M-14-15V15', 'M-8-9Q-3-13 2-9T12-9', 'M-8-1Q-3-5 2-1T12-1', 'M-8 7H13M9 3.5L13 7L9 10.5'],
  // Powtórzenie: the same ruled line twice, the second dotted
  ['M-15-7H13', 'M9-11L14-7L9-3', '~M-15 7H13', '~M9 3L14 7L9 11'],
  // Paradoks: a clock face with its hands, a dotted face beyond it
  [circ(0, 0, 11), 'M0 0V-7', 'M0 0L5 3', '~' + circ(0, 0, 17)],
  // Opóźnienie: an hourglass with a dotted bracket beside it
  ['M-8-13H8', 'M-8 13H8', 'M-7-13C-7-4-1-2 0 0C-1 2-7 4-7 13', 'M7-13C7-4 1-2 0 0C1 2 7 4 7 13', '~M14-12H17V12H14'],
  // Zamiana miejsc: two figures, each arrow pointing at the other's place
  [circ(-9, -9, 4), circ(9, 9, 4), 'M-3-9H9M6-12L9-9L6-6', 'M3 9H-9M-6 6L-9 9L-6 12'],
];
