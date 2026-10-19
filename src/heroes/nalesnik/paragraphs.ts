/** The paragraphs of Naleśnika: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.nalesnik.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  orbita: defineParagraphs('nalesnik', 'orbita', 1, { patch: { type: 'egzystencjalny', reach: 1.3 } }, { patch: { type: 'regulaminowy', dur: 2, cd: 3 } }),
  grawitacja: defineParagraphs('nalesnik', 'grawitacja', 1, { patch: { type: 'mechaniczny', dur: 0.5, dmg: 1.5 } }, { patch: { type: 'regulaminowy', area: 1.25, cd: 3 }, permission: 'powiadomienia' }),
  wniosek: defineParagraphs('nalesnik', 'wniosek', 1, { patch: { area: 0.65, dur: 1.5 } }, { patch: { aim: 'auto', type: 'egzystencjalny', dur: 0.6, cd: 3 } }),
  plywy: defineParagraphs('nalesnik', 'plywy', 5, { patch: { type: 'egzystencjalny', dmg: 0.7 } }, { patch: { type: 'regulaminowy', area: 1.2, cd: 2 } }),
  ksiezyc: defineParagraphs('nalesnik', 'ksiezyc', 7, { patch: { area: 1.5, dur: 1.5, dmg: 0.7 } }, { patch: { type: 'regulaminowy', dmg: 1.3, cd: 3 } }),
};
