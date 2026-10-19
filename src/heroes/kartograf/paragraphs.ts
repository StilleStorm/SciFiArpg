/** The paragraphs of Kartografa Planet Nieistniejących: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.kartograf.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  triangulacja: defineParagraphs('kartograf', 'triangulacja', 1, { patch: { reach: 1.5, dmg: 0.8 } }, { patch: { type: 'egzystencjalny', count: 2, cd: 3 }, permission: 'wygenerowane' }),
  teren: defineParagraphs('kartograf', 'teren', 1, { patch: { area: 1.4, dur: 0.67 } }, { patch: { dur: 1.5, cd: 4 } }),
  korekta: defineParagraphs('kartograf', 'korekta', 1, { patch: { reach: 1.2, dur: 1.6 } }, { patch: { aim: 'auto', cd: -4, dur: 0.4 } }),
  skala: defineParagraphs('kartograf', 'skala', 5, { patch: { dur: 1.6, cd: 3 } }, { patch: { dur: 0.6, cd: -5, cost: 5 } }),
  legenda: defineParagraphs('kartograf', 'legenda', 7, { patch: { area: 0.65, dur: 0.5, dmg: 2 } }, { patch: { type: 'regulaminowy', dmg: 1.3, cost: 8 } }),
};
