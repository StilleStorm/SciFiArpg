/** The paragraphs of Naleśnika: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.nalesnik.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  orbita: defineParagraphs('nalesnik', 'orbita', 1, { patch: { type: 'egzystencjalny', reach: 1.3 } }, { patch: { type: 'regulaminowy', dur: 2, cd: 3 } }),
  grawitacja: defineParagraphs('nalesnik', 'grawitacja', 1, { patch: { type: 'mechaniczny', dur: 0.5, dmg: 1.5 } }, { patch: { type: 'regulaminowy', area: 1.25, cd: 3 }, permission: 'powiadomienia' }),
  wniosek: defineParagraphs('nalesnik', 'wniosek', 1, { patch: { area: 0.65, dur: 1.5 } }, { patch: { aim: 'auto', type: 'egzystencjalny', dur: 0.6, cd: 3 } }),
  plywy: defineParagraphs('nalesnik', 'plywy', 5, { patch: { type: 'egzystencjalny', dmg: 0.7 } }, { patch: { type: 'regulaminowy', area: 1.2, cd: 2 } }),
  ksiezyc: defineParagraphs('nalesnik', 'ksiezyc', 7, { patch: { area: 1.5, dur: 1.5, dmg: 0.7 } }, { patch: { type: 'regulaminowy', dmg: 1.3, cd: 3 } }),
  // S21: skills 6 to 10. Krawedz § 2 zlozona: regulaminowy, everyone on the path (count 1) for 0.6x; § 3 ostra: egzystencjalny, 1.2x, the target waits for verification (the status is the sign)
  krawedz: defineParagraphs('nalesnik', 'krawedz', 3, { patch: { type: 'regulaminowy', count: 1, dmg: 0.75 } }, { patch: { type: 'egzystencjalny', dmg: 1.5, status: { kind: 'do_weryfikacji', seconds: 1 }, cd: 2 } }),
  // § 2 wewnetrzny: the band moves in (reach 0.62: 90-120 becomes 50-80), 0.9x (0.6 x 1.5), 3 s (4 x 0.75); § 3 planetarny: egzystencjalny, 6 s, the Wygenerowane crossing exist at 0.5 (the type is the sign)
  pierscien: defineParagraphs('nalesnik', 'pierscien', 11, { patch: { reach: 0.62, dmg: 1.5, dur: 0.75 } }, { patch: { type: 'egzystencjalny', dur: 1.5, cd: 3 } }),
  // § 2 w gore: 5 s (3 x 5/3), 20% not taken (35 x 4/7), no slowing (count 1); § 3 w dol: regulaminowy, flat (count 2): projectiles skim off, melee costs 20% more
  zaokraglenie: defineParagraphs('nalesnik', 'zaokraglenie', 3, { patch: { dur: 5 / 3, dmg: 4 / 7, count: 1 } }, { patch: { type: 'regulaminowy', count: 2, cd: 3 } }),
  // § 2 kontrolowany: regulaminowy, radius 60 (100 x 0.6), 2.4x (1.6 x 1.5), no push (count 1); § 3 z wysokosci: egzystencjalny, a crater (count 2) striking 0.3x a second for 3 s
  upadek: defineParagraphs('nalesnik', 'upadek', 9, { patch: { type: 'regulaminowy', area: 0.6, dmg: 1.5, count: 1 } }, { patch: { type: 'egzystencjalny', count: 2, cd: 3 } }),
  // § 2 na wniosek: mechaniczny, 0.7x to the crossed (count 1); § 3 o 180 stopni: egzystencjalny, lands with a ring of 80 (count 2)
  zmianaOrbity: defineParagraphs('nalesnik', 'zmianaOrbity', 14, { patch: { type: 'mechaniczny', count: 1 } }, { patch: { type: 'egzystencjalny', count: 2, cd: 3 } }),
};
