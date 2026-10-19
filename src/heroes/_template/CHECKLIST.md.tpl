# __ID__: checklist

The folder compiles and plays with placeholders. A hero is done when every box is ticked.

- [ ] `def.ts`: racja, speed, base stats, auto-attack, five skills with type, cooldown, aim, permission (4 and 5).
- [ ] `figure.ts`: the drawing (DESIGN 3, 10.2), the auto-attack pose and `drive`, the wash seed and `hue`.
- [ ] Auto-attack: `heroes/auto.ts` handles a thrown shot, a lash and a hitscan; anything new is a new `def.auto` field plus a branch there.
- [ ] `skills.ts`: five casts from the primitives (`heroes/primitives`); what a skill leaves running is stepped from `heroes/system.ts`.
- [ ] `paragraphs.ts`: § 2 and § 3 of every skill as patches (at most four fields, `heroes/paragraphs.ts`), the level each skill opens at, text `heroes.__ID__.para.<skill>.<n>.{name,desc}` in `src/i18n/pl/heroes/__ID__.json`.
- [ ] `ultimates.ts`: the first ultimate (level 12) and later the 24 / 36 ones as `defineUltimate` (`heroes/ultimateDefs.ts`): ≤ 8 s, one stamp, one page reaction, radius ≤ 220 or the hero's own path, at most one page-wide and only through a status; § 2 and § 3 as patches plus `tune`. Text `heroes.__ID__.ult.<id>.{name,desc,stamp,note}` and `.para.<n>.{name,desc}` in `src/i18n/pl/heroes/__ID__.json`. `heroes/ultimates.test.ts` checks the limits for every hero; add a test of each paragraph at work.
- [ ] Passives: `traits` in `def.ts` for flags; `quirk.ts` for behaviour (`HeroModule.quirk`).
- [ ] Four recipes (one per skill 2 to 5 plus the auto) and the ultimate's (body layers, ending in the stamp thud) in `audio/recipes.ts`, five names and `ultimate` in `sounds.ts`.
- [ ] Profile text: `heroes.__ID__.{name,desc1,desc2,desc3,quirk,skillN.{name,pad,desc}}` in `src/i18n/pl/heroes.json` (voice editor).
- [ ] Upgrade pool: six passives in `passives.ts`, text `forms.update.passive.__ID__.N.{name,desc}` in `src/i18n/pl/forms.json`.
- [ ] Pad glyphs: five drawings in `pads.ts`.
- [ ] Tests: `hero.test.ts` (per skill x paragraph x aim kind), the contract snapshot (`heroes/contract.test.ts`: regenerate with `npx vitest run -u src/heroes/contract.test.ts`, only for the new hero's keys).
- [ ] Shots: add the hero to `scripts/shot-heroes.mjs` and `scripts/shot-attacks.mjs`; look at the PNGs against DESIGN 3.
- [ ] Anomalia face: the hero's face in the Anomalia (end-of-case) screen, once that exists (DESIGN 10.2).
- [ ] Remove this file.
