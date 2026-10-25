/** The paragraphs of Pętlowca: five skills x 3, § 1 the base, § 2 and § 3 patches (heroes/paragraphs.ts). Text: heroes.petlowiec.para.*. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  przybycie: defineParagraphs('petlowiec', 'przybycie', 1, { patch: { count: 1, dur: 0.62 } }, { patch: { dmg: 1.5, dur: 0.75, cost: 6 } }),
  spor: defineParagraphs('petlowiec', 'spor', 1, { patch: { type: 'regulaminowy', status: { kind: 'zgloszony', seconds: 3 } } }, { patch: { type: 'mechaniczny', dmg: 1.5, cd: 3 }, permission: 'urzadzenia' }),
  petla: defineParagraphs('petlowiec', 'petla', 1, { patch: { dur: 1.67, cd: 4 } }, { patch: { dur: 0.67, cd: -4, cost: 4 } }),
  juzBylo: defineParagraphs('petlowiec', 'juzBylo', 9, { patch: { cd: -4, cost: 5 } }, { patch: { count: 1, cd: 6 } }),
  start: defineParagraphs('petlowiec', 'start', 7, { patch: { dur: 0.25, dmg: 0.7 } }, { patch: { type: 'egzystencjalny', area: 1.3, cd: 4 } }),
  // S20 (docs/SKILLS.md §3). Each skill lists the level it opens at; § 2 follows at +6 and § 3 at +14 (heroes/paragraphs.ts PARAGRAPH_STEP).
  // Uwaga § 2 zbiorcza: regulaminowy, every copy aims at his target; § 3 nie na temat: mechaniczny, 1.4x (0.9 x 1.55), the copies do not repeat it.
  uwaga: defineParagraphs('petlowiec', 'uwaga', 1, { patch: { type: 'regulaminowy', cd: 1 } }, { patch: { type: 'mechaniczny', dmg: 1.55, cd: 2 } }),
  // Powtórzenie § 2 dosłowne: regulaminowy, the hit are wyciszony 1 s; § 3 w zapisie: the lines stay 2 s and strike 0.2x a second (count 1 = they stay).
  powtorzenie: defineParagraphs('petlowiec', 'powtorzenie', 5, { patch: { type: 'regulaminowy', status: { kind: 'wyciszony', seconds: 1 }, cd: 2 } }, { patch: { count: 1, dmg: 0.6, cd: 3 } }),
  // Paradoks § 2 dziadka: mechaniczny, the echo 0.8x (0.5 x 1.6) in r 70 (110 x 0.64); § 3 urzędowy: regulaminowy, whoever stands inside is do weryfikacji.
  paradoks: defineParagraphs('petlowiec', 'paradoks', 11, { patch: { type: 'mechaniczny', dmg: 1.6, area: 0.64, cd: 2 } }, { patch: { type: 'regulaminowy', status: { kind: 'do_weryfikacji', seconds: 1 }, dur: 0.75 } }),
  // Opóźnienie § 2 bezterminowe: 2 s, a quarter (0.5 x 0.5), cooldown +5; § 3 z winy nadawcy: egzystencjalny, what is owed goes to the nearest enemy.
  opoznienie: defineParagraphs('petlowiec', 'opoznienie', 3, { patch: { dur: 0.667, dmg: 0.5, cd: 5 } }, { patch: { type: 'egzystencjalny', cd: 4 } }),
  // Zamiana miejsc § 2 z przeciwnikiem: egzystencjalny, he swaps with the nearest enemy; § 3 planowa: regulaminowy, the copy's stay is renewed and longer.
  zamiana: defineParagraphs('petlowiec', 'zamiana', 14, { patch: { type: 'egzystencjalny', cd: 2 } }, { patch: { type: 'regulaminowy', dur: 1.25, cost: 5 } }),
};
