/** The paragraphs of Pętlowca: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.petlowiec.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  przybycie: defineParagraphs('petlowiec', 'przybycie', 1, { patch: { count: 1, dur: 0.62 } }, { patch: { dmg: 1.5, dur: 0.75, cost: 6 } }),
  spor: defineParagraphs('petlowiec', 'spor', 1, { patch: { type: 'regulaminowy', status: { kind: 'zgloszony', seconds: 3 } } }, { patch: { type: 'mechaniczny', dmg: 1.5, cd: 3 }, permission: 'urzadzenia' }),
  petla: defineParagraphs('petlowiec', 'petla', 1, { patch: { dur: 1.67, cd: 4 } }, { patch: { dur: 0.67, cd: -4, cost: 4 } }),
  juzBylo: defineParagraphs('petlowiec', 'juzBylo', 9, { patch: { cd: -4, cost: 5 } }, { patch: { count: 1, cd: 6 } }),
  start: defineParagraphs('petlowiec', 'start', 7, { patch: { dur: 0.25, dmg: 0.7 } }, { patch: { type: 'egzystencjalny', area: 1.3, cd: 4 } }),
};
