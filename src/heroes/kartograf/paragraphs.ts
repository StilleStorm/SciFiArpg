/** The paragraphs of Kartografa Planet Nieistniejących: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.kartograf.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  triangulacja: defineParagraphs('kartograf', 'triangulacja', 1, { patch: { reach: 1.5, dmg: 0.8 } }, { patch: { type: 'egzystencjalny', count: 2, cd: 3 }, permission: 'wygenerowane' }),
  teren: defineParagraphs('kartograf', 'teren', 1, { patch: { area: 1.4, dur: 0.67 } }, { patch: { dur: 1.5, cd: 4 } }),
  korekta: defineParagraphs('kartograf', 'korekta', 1, { patch: { reach: 1.2, dur: 1.6 } }, { patch: { aim: 'auto', cd: -4, dur: 0.4 } }),
  skala: defineParagraphs('kartograf', 'skala', 5, { patch: { dur: 1.6, cd: 3 } }, { patch: { dur: 0.6, cd: -5, cost: 5 } }),
  legenda: defineParagraphs('kartograf', 'legenda', 7, { patch: { area: 0.65, dur: 0.5, dmg: 2 } }, { patch: { type: 'regulaminowy', dmg: 1.3, cost: 8 } }),
  // S20: skills 6 to 10. Pomiar § 2 przyblizony: mechaniczny, the two nearest, no mark; § 3 kontrolowany: egzystencjalny, 1.4x on a zgloszony one.
  pomiar: defineParagraphs('kartograf', 'pomiar', 3, { patch: { type: 'mechaniczny', count: 1, cd: 1 } }, { patch: { type: 'egzystencjalny', dmg: 1.4, cd: 2 } }),
  // § 2 poprzeczny: one thick line of 2.0x and reach 160 (0.5 x 4, 220 x 0.727; width 2 is the sign of the single line); § 3 warstwowy: the lines stay 1.5 s and hold (do_weryfikacji)
  przekroj: defineParagraphs('kartograf', 'przekroj', 11, { patch: { width: 2, reach: 0.727, dmg: 4 } }, { patch: { type: 'egzystencjalny', status: { kind: 'do_weryfikacji', seconds: 1.5 }, cd: 3 } }),
  // § 2 sporna: egzystencjalny, no push, 0.8x to a crosser (count 1); § 3 panstwowa: regulaminowy, 6 s, a crosser is zablokowany 1 s
  granica: defineParagraphs('kartograf', 'granica', 3, { patch: { type: 'egzystencjalny', count: 1, cd: 2 } }, { patch: { type: 'regulaminowy', dur: 1.5, status: { kind: 'zablokowany', seconds: 1 }, cd: 3 } }),
  // § 2 niwelacyjny: two benchmarks (count 1) of 12 s; § 3 sporny: egzystencjalny, every 4 s the near read it (the status is the sign)
  punktOdniesienia: defineParagraphs('kartograf', 'punktOdniesienia', 9, { patch: { count: 1, dur: 0.6 } }, { patch: { type: 'egzystencjalny', status: { kind: 'przeczytane', seconds: 1 }, cd: 4 } }),
  // § 2 czterech: mechaniczny, 0.9x to the pushed (count 1); § 3 odwrotna: regulaminowy, pulls (the type is the sign)
  rozaWiatrow: defineParagraphs('kartograf', 'rozaWiatrow', 14, { patch: { type: 'mechaniczny', count: 1, cd: 3 } }, { patch: { type: 'regulaminowy', cd: 2 } }),
};
