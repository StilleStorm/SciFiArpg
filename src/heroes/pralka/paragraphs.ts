/** The paragraphs of Pralki Emancypowanej: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.pralka.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  wirowanie: defineParagraphs('pralka', 'wirowanie', 1, { patch: { type: 'regulaminowy', status: { kind: 'do_weryfikacji', seconds: 1 } } }, { patch: { status: { kind: 'zablokowany', seconds: 1 }, area: 1.2, cd: 3 } }),
  pranieWstepne: defineParagraphs('pralka', 'pranieWstepne', 1, { patch: { dur: 1.6, cd: 2 } }, { patch: { dur: 0.6, status: { kind: 'zgloszony', seconds: 2 }, cost: 6 } }),
  odwirowanie: defineParagraphs('pralka', 'odwirowanie', 1, { patch: { reach: 1.4, dmg: 1.2 } }, { patch: { aim: 'auto', type: 'regulaminowy', dmg: 1.5, cd: 3 } }),
  beben: defineParagraphs('pralka', 'beben', 5, { patch: { reach: 1.45, width: 0.25, dmg: 1.2 } }, { patch: { type: 'regulaminowy', status: { kind: 'zablokowany', seconds: 1 }, cd: 2 } }),
  osobowosc: defineParagraphs('pralka', 'osobowosc', 11, { patch: { dur: 0.67, dmg: 1.7 } }, { patch: { type: 'regulaminowy', area: 1.2, cost: 10 }, permission: 'powiadomienia' }),
};
