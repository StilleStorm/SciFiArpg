# src/heroes: one folder per hero

A hero is a folder `src/heroes/<id>/` that exports one `hero: HeroModule` (`module.ts`). The registry (`registry.ts`) lists them.
Nothing outside `src/heroes/<id>/` may write a hero id (lint rule `hero-id-literal`); ask the registry instead:
`heroById(id)`, `heroDef(id)`, `HEROES`, `HERO_IDS`.

## The folder contract

| File | Exports | What it holds |
| --- | --- | --- |
| `def.ts` | `def: HeroDef` | Numbers, auto-attack, five `defineSkill(...)` (id, damage type, cooldown, aim, permission for 4 and 5), `traits`, `chosenNoteKey`. Data only. |
| `skills.ts` | `casts: Record<skillId, SkillFn>` | One `cast(i, [step, ...])` per skill; a step calls the primitives. What a skill leaves running is stepped from `heroes/system.ts`. |
| `figure.ts` | `figure: HeroFigure`, `figureDef` | The drawing as path data, the wash, `attackMs`, `pose(t)`, and the hooks `drive`, `build`, `patch`; `stroke` names the ink stroke. |
| `sounds.ts` | `sounds: HeroSounds` | Five recipe names (by SkillIndex) and `autoStart`. Recipes live in `audio/recipes.ts`. |
| `quirk.ts` (optional) | `quirk: HeroQuirk` | `onHit`, `tick`: the passive. Flags without behaviour are `traits` in `def.ts` instead. |
| `index.ts` | `hero: HeroModule` | Assembles the above. |

A filled hero (S19) lists ten or eleven skills in `def.ts` (the first five unchanged), one `pads.ts` glyph and one `sounds.ts` recipe each, three `ultimates`, ten `passives` (7 is the `rule`), and keeps what its skills leave running in its own folder (`pralka/running.ts`, ticked from `quirk.tick`). See ARCHITECTURE.md "Filled heroes".

Shared, not per hero: `defs.ts` (types), `aim.ts`, `helpers.ts`, `numbers.ts` (numbers of skills 4 and 5), `state.ts` (`HeroRun`), `system.ts` (the per-step system),
`steps2.ts`, `layer.ts`, `loadout.ts`, `hook.ts`, `auto.ts`, `cast.ts`, `figureKit.ts`, `poseKit.ts`, `build.ts`, `primitives/`.

## Primitives (`primitives/`)

Pure functions on `Ctx {s: RunState, bus}` with plain option objects; none keeps state of its own, none touches the DOM or a timer.
Movement: `dash`, `teleport`, `pull`, `push`. Selection: `aoe`, `cone`, `line`, `hitscan`. Spawning: `projectile`, `forkProjectile`, `zone`, `summon`,
`removeSummon`, `decoy`. Effects: `statusApply`, `buff`, `heal`, `shield`, `cooldownReset`, `deferredDamage`, `echo` (with `stepDeferred`, called by the hero system).
A skill is the list of these calls with its numbers. Randomness goes through `s.rngs.combat` in the order the skill always used (the contract snapshot guards it).

## Adding a hero

`npm run new-hero <id>` makes the folder from `_template/*.tpl` (compiling placeholders), registers the id, and prints `CHECKLIST.md`:
figure, auto pose, skills, ultimates, passives, four recipes, profile text, upgrade pool, tests, shots, Anomalia face. Everything other domains
need per hero is in the folder (`sounds.ts`, `pads.ts` glyphs, `passives.ts`, the wash `hue` in `figure.ts`); no table outside it is keyed by hero id. Regenerate the contract snapshot once, for the new keys only.

## Tests

`contract.test.ts` (every hero x skill x aim kind against `contract.snapshot.json`), `primitives/primitives.test.ts`, `registry.test.ts`
(five heroes, full folders, sounds and i18n keys, the hero-id rule), and the older hero tests (`heroes.test.ts`, `aim.test.ts`, `skills45.test.ts`,
`nalesnik.test.ts`, `laser.test.ts`, `wiring.test.ts`).
