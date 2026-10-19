# __ID__: checklist

The folder compiles and plays with placeholders. A hero is done when every box is ticked.

- [ ] `def.ts`: racja, speed, base stats, auto-attack, five skills with type, cooldown, aim, permission (4 and 5).
- [ ] `figure.ts`: the drawing (DESIGN 3, 10.2), the auto-attack pose and `drive`, the wash seed; hue in `render/wash.ts` `HERO_HUE`.
- [ ] Auto-attack: `heroes/auto.ts` handles a thrown shot, a lash and a hitscan; anything new is a new `def.auto` field plus a branch there.
- [ ] `skills.ts`: five casts from the primitives (`heroes/primitives`); what a skill leaves running is stepped from `heroes/system.ts`.
- [ ] Ultimates (skill paragraphs the update form offers): add the entries in `progression` and the keys.
- [ ] Passives: `traits` in `def.ts` for flags; `quirk.ts` for behaviour (`HeroModule.quirk`).
- [ ] Four recipes (one per skill 2 to 5 plus the auto) in `audio/recipes.ts`, five names in `sounds.ts` and `HERO_SKILL_SOUNDS`.
- [ ] Profile text: `heroes.__ID__.{name,desc1,desc2,desc3,quirk,skillN.{name,pad,desc}}` in `src/i18n/pl/heroes.json` (voice editor).
- [ ] Upgrade pool: the entries for the update form (`progression/update.ts`, keyed by hero), with i18n keys.
- [ ] Pad glyphs: five drawings in `ui/pads.ts` `SKILL_DRAWINGS`.
- [ ] Tests: `hero.test.ts` (per skill x paragraph x aim kind), the contract snapshot (`heroes/contract.test.ts`: regenerate with `npx vitest run -u src/heroes/contract.test.ts`, only for the new hero's keys).
- [ ] Shots: add the hero to `scripts/shot-heroes.mjs` and `scripts/shot-attacks.mjs`; look at the PNGs against DESIGN 3.
- [ ] Anomalia face: the hero's face in the Anomalia (end-of-case) screen, once that exists (DESIGN 10.2).
- [ ] Remove this file.
