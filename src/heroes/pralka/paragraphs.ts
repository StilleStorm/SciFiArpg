/** The paragraphs of Pralki Emancypowanej: ten skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.pralka.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  wirowanie: defineParagraphs('pralka', 'wirowanie', 1, { patch: { type: 'regulaminowy', status: { kind: 'do_weryfikacji', seconds: 1 } } }, { patch: { status: { kind: 'zablokowany', seconds: 1 }, area: 1.2, cd: 3 } }),
  pranieWstepne: defineParagraphs('pralka', 'pranieWstepne', 1, { patch: { dur: 1.6, cd: 2 } }, { patch: { dur: 0.6, status: { kind: 'zgloszony', seconds: 2 }, cost: 6 } }),
  odwirowanie: defineParagraphs('pralka', 'odwirowanie', 1, { patch: { reach: 1.4, dmg: 1.2 } }, { patch: { aim: 'auto', type: 'regulaminowy', dmg: 1.5, cd: 3 } }),
  beben: defineParagraphs('pralka', 'beben', 5, { patch: { reach: 1.45, width: 0.25, dmg: 1.2 } }, { patch: { type: 'regulaminowy', status: { kind: 'zablokowany', seconds: 1 }, cd: 2 } }),
  osobowosc: defineParagraphs('pralka', 'osobowosc', 11, { patch: { dur: 0.67, dmg: 1.7 } }, { patch: { type: 'regulaminowy', area: 1.2, cost: 10 }, permission: 'powiadomienia' }),
  // S19 (docs/SKILLS.md §1). Each skill lists the level it opens at; § 2 follows at +6 and § 3 at +14 (heroes/paragraphs.ts PARAGRAPH_STEP).
  plukanie: defineParagraphs('pralka', 'plukanie', 3, { patch: { type: 'egzystencjalny', status: { kind: 'zgloszony', seconds: 2 }, cd: 2 } }, { patch: { dmg: 0.67, cd: -1 } }),
  program90: defineParagraphs('pralka', 'program90', 9, { patch: { dur: 1.67, dmg: 0.63 } }, { patch: { type: 'egzystencjalny', cost: 5 } }),
  trybOszczedny: defineParagraphs('pralka', 'trybOszczedny', 3, { patch: { dur: 1.5 } }, { patch: { type: 'regulaminowy', dur: 0.5, cd: 4 } }),
  zmianaProgramu: defineParagraphs('pralka', 'zmianaProgramu', 7, { patch: { count: 1, cd: 4 } }, { patch: { type: 'mechaniczny', cd: 6 } }),
  odpompowanie: defineParagraphs('pralka', 'odpompowanie', 14, { patch: { type: 'mechaniczny', area: 0.6 } }, { patch: { type: 'egzystencjalny', cost: 6 } }),
};
