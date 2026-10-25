/** The pad glyphs of the ten skills, by SkillIndex (ui/pads.ts): a spinning drum, foam, a dragged box, a section sign, then the five of S19. */
import { glyphCircle as circ } from '../figureKit';
import type { HeroPadGlyphs } from '../module';

export const pads: HeroPadGlyphs = [
  [circ(0, 0, 11), 'M0-11V11M-11 0H11', circ(0, 0, 4), 'M-17-8A19 19 0 0 1-6-17M-8-19L-6-17L-9-14', 'M17 8A19 19 0 0 1 6 17M8 19L6 17L9 14'],
  [circ(-6, 5, 7), circ(6, 7, 5), circ(1, -7, 5.5), circ(-9, -8, 2.5), circ(10, -4, 2.2), circ(11, 14, 1.6)],
  ['M-3-9H12V5H-3Z', 'M-3-9L2-13H12M12-9L17-13V1L12 5', 'M-17-2H-8M-19 3H-8M-17 8H-8', 'M-14 13H17'],
  // an open drum with its flap and three strokes of wet load flying out
  ['M-10-4V10Q0 15 10 10V-4', 'M-10-4A10 4 0 1 0 10-4A10 4 0 1 0-10-4', 'M10-4L16-11L9-14', 'M-5-8L-8-15', 'M0-8L0-17', 'M5-8L8-15'],
  // a section sign: two stacked S-curves joined at the waist
  ['M8-12C5-19-9-18-8-11C-7-5 7-6 7 0', 'M-8 12C-5 19 9 18 8 11C7 5-7 6-7 0', 'M-7 0C-7-3 7-3 7 0'],
  // S19. Plukanie: a shower rose over falling drops
  ['M-13-8Q0-22 13-8Z', 'M0-15V-19', 'M-8-3L-10 3', 'M0-3V5', 'M8-3L10 3', 'M-5 9L-6.5 14', 'M5 9L6.5 14'],
  // Program 90: a dial turned a quarter, steam over it
  [circ(0, 4, 12), 'M0 4V-6', 'M0 4H10', 'M0-1A5 5 0 0 1 5 4', 'M-5-14Q-2-17-5-20', 'M3-15Q6-18 3-21'],
  // Tryb oszczedny: a dotted frame round a lowered bar
  ['~M-15-15H15V15H-15Z', 'M0-8V6', 'M-6 1L0 7L6 1'],
  // Zmiana programu: two arrows chasing round
  ['M-11 0A11 11 0 0 1 9-7', 'M9-7L10-13M9-7L3-6', 'M11 0A11 11 0 0 1-9 7', 'M-9 7L-10 13M-9 7L-3 6'],
  // Odpompowanie: a puddle with its drain and the plunger standing in it
  ['M-17 8A17 7 0 1 0 17 8A17 7 0 1 0-17 8', 'M-5 8A5 2.4 0 1 0 5 8A5 2.4 0 1 0-5 8', 'M0 5V-14', 'M-6-14H6', '~M-12 8H-6M6 8H12'],
];
