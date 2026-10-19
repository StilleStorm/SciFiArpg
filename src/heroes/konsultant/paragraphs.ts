/** The paragraphs of Konsultanta Infolinii: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.konsultant.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  prosze: defineParagraphs('konsultant', 'prosze', 1, { patch: { count: 1, dur: 0.67 } }, { patch: { type: 'egzystencjalny', dur: 2, cd: 4 } }),
  przekierowuje: defineParagraphs('konsultant', 'przekierowuje', 1, { patch: { width: 0.3, reach: 1.45 } }, { patch: { aim: 'auto', status: { kind: 'wyciszony', seconds: 2 }, cd: 3 } }),
  pomoc: defineParagraphs('konsultant', 'pomoc', 9, { patch: { dur: 1.5 } }, { patch: { dur: 0.5, cd: -8, cost: 6 } }),
  numer: defineParagraphs('konsultant', 'numer', 5, { patch: { dur: 0.5, dmg: 1.6 } }, { patch: { type: 'egzystencjalny', status: { kind: 'zgloszony', seconds: 6 }, cd: 3 }, permission: 'wygenerowane' }),
  rozlaczenie: defineParagraphs('konsultant', 'rozlaczenie', 7, { patch: { width: 4, dur: 0.5 } }, { patch: { aim: 'auto', type: 'regulaminowy', dmg: 1.4, cost: 8 } }),
};
