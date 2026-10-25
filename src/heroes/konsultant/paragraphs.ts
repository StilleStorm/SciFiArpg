/** The paragraphs of Konsultanta Infolinii: ten skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.konsultant.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  prosze: defineParagraphs('konsultant', 'prosze', 1, { patch: { count: 1, dur: 0.67 } }, { patch: { type: 'egzystencjalny', dur: 2, cd: 4 } }),
  przekierowuje: defineParagraphs('konsultant', 'przekierowuje', 1, { patch: { width: 0.3, reach: 1.45 } }, { patch: { aim: 'auto', status: { kind: 'wyciszony', seconds: 2 }, cd: 3 } }),
  pomoc: defineParagraphs('konsultant', 'pomoc', 9, { patch: { dur: 1.5 } }, { patch: { dur: 0.5, cd: -8, cost: 6 } }),
  numer: defineParagraphs('konsultant', 'numer', 5, { patch: { dur: 0.5, dmg: 1.6 } }, { patch: { type: 'egzystencjalny', status: { kind: 'zgloszony', seconds: 6 }, cd: 3 }, permission: 'wygenerowane' }),
  rozlaczenie: defineParagraphs('konsultant', 'rozlaczenie', 7, { patch: { width: 4, dur: 0.5 } }, { patch: { aim: 'auto', type: 'regulaminowy', dmg: 1.4, cost: 8 } }),
  // S19: skills 6 to 10. § 2 zbiorcze: three tickets of 0.5x (0.8 x 0.625); § 3 pilne: 1.3x (0.8 x 1.625), no bounce (reach 0).
  zgloszenie: defineParagraphs('konsultant', 'zgloszenie', 1, { patch: { count: 2, dmg: 0.625, cd: 1 } }, { patch: { type: 'egzystencjalny', dmg: 1.625, reach: 0, cd: 2 } }),
  // § 2 mechaniczny: the first in the form is zablokowany 1 s; § 3 pole obowiazkowe: none inside may leave for 1.5 s (count 1), half the damage
  formularz: defineParagraphs('konsultant', 'formularz', 3, { patch: { type: 'mechaniczny', status: { kind: 'zablokowany', seconds: 1 }, cd: 2 } }, { patch: { count: 1, dmg: 0.5, cd: 3 } }),
  // § 2 na zywo: egzystencjalny, r 180, 15% instead of 30%; § 3 cisza: 2 s, wyciszony within 120
  muzyka: defineParagraphs('konsultant', 'muzyka', 1, { patch: { type: 'egzystencjalny', area: 1.5, dmg: 0.5, cd: 2 } }, { patch: { dur: 0.5, status: { kind: 'wyciszony', seconds: 2 } } }),
  // § 2 dluzsza: the chair 4 s, the step 80; § 3 z winy klienta: regulaminowy, the chair strikes back for 0.6x (count 1)
  przerwaTechniczna: defineParagraphs('konsultant', 'przerwaTechniczna', 3, { patch: { dur: 2, reach: 0.667, cd: 3 } }, { patch: { type: 'regulaminowy', count: 1, dmg: 0.6, cd: 2 } }),
  // § 2 w ciagu 24 h: rings after 1 s, radius 80; § 3 z innego numeru: mechaniczny, the nearest is thrown 120 (count 1)
  oddzwonimy: defineParagraphs('konsultant', 'oddzwonimy', 14, { patch: { dur: 0.333, area: 0.727, cd: 4 } }, { patch: { type: 'mechaniczny', count: 1, cost: 6 } }),
};
