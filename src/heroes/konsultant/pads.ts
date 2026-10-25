/** The pad glyphs of the ten skills, by SkillIndex (ui/pads.ts): an hourglass, a redirect arrow, a headset, a case ticket, a cut line, then (S19) a ticket on its bounce, a ruled form, a stave, a chair, a ringing handset. */
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
  // Zgloszenie przyjete: a ticket thrown, and its second arc (dotted) to the next one
  ['M-17-6H-3V8H-17Z', 'M-13-1H-7M-13 3H-9', '~M-1-5Q6-16 14-6', 'M10-9L14-6L9-4'],
  // Formularz kontaktowy: a ruled form with a checkbox
  ['M-14-15H14V15H-14Z', 'M-9-8H9', 'M-9-2H9', 'M-9 4H1', 'M4 3H9V8H4Z'],
  // Muzyka w sluchawce: a stave of three lines and a note on it
  ['M-16-6H16', 'M-16-1H16', 'M-16 4H16', 'M-4 10V-12L7-9V7', 'M-7 8.5a3.2 2.4 0 1 0 .01 0', 'M4 6a3.2 2.4 0 1 0 .01 0'],
  // Przerwa techniczna: a chair, and the step back (dotted)
  ['M-7-15V3H7', 'M-7 3V15M7 3V15', 'M-7-3H5', '~M10-10H17', 'M14-14L17-10L14-6'],
  // Oddzwonimy: a handset, and two arcs of its ring (dotted)
  ['M-16 7V2Q-16-5-8-5H8Q16-5 16 2V7H10V3Q10 0 7 0H-7Q-10 0-10 3V7Z', '~M-9-10Q0-16 9-10', '~M-14-15Q0-24 14-15'],
];
