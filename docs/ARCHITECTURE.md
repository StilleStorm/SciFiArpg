# Architecture (read this before the code)

Plain data, pure functions, one thin render layer. The page is one `<svg id="stage">` plus an HTML overlay
`<div id="ui">`. `npm run dev` runs it; `window.__game` drives it from tests, shots and the smoke script.
Fonts: Michroma (titles, stamps), Space Mono (HUD, forms, buttons), EB Garamond (narration, footnotes).
Damage types: `mechaniczny | regulaminowy | egzystencjalny`. Folder READMEs in `src/*/` say what each domain owns.

## Stage (index.html)
`#page` (paper, hatched border, obstacles, the exit dog-ear; no filter) -> `#world` (entities; wobble filter,
re-seeded every 500 ms) -> `#fx` (blots, strikes, stamps, margin notes) -> `#ui` (HTML: HUD, pads, footnotes, sheets).
The camera shows at least 390 x 700 world units (`render/camera.ts`, `viewRect()` gives the clamped rectangle).
Colours are CSS variables on `:root`; `data-theme="night"` swaps them. SVG layers get their strokes from CSS; never
set a stroke width on a figure's root `<g>`. `#stage` has `touch-action: none`.

## State
`RunState` (`world/run.ts`, `createRun(seed, opts)`): seed and four rng streams (`ai combat loot spawn`),
`time`, `status` (`running | paused | dead`; sheets and forms use `paused`), `modal` (law sheets), `turning`
(page sweep), pages, `player`, arrays `enemies projectiles pickups summons zones`, `law` (flags), `hero`
(`heroes/state.ts`: cooldowns, update ranks, ring buffer, `pendingLevels`, death bookkeeping), `victoryAt`.
Every roll goes through `s.rngs.*`; render-only randomness never touches them. `MetaState` (`save/save.ts`) is
localStorage (`zgloszenie.meta`, plus `.sklep`); loading never throws.

### Entity kinds (`entities/types.ts`, all `{ kind, id, x, y, r }`)
`player`, `enemy` (family, tier, claim, defect, elite, boss, `rt` runtime bag via `rtOf()`), `projectile`, `pickup`
(an item plate, a gwiazdki star, or a **permission card**: `permission?: FamilyId`), **`summon`** (`copy` of the
Petlowiec, `decoy` of the Kartograf, `ghost`; they walk and shoot in `heroes/system.ts`) and **`zone`** (`teren`
marked area, `hourglass` over a blocked enemy). Collision radii match the drawing: enemies are drawn x1.2
(`ENEMY_SCALE`), heroes x1.15 (`HERO_SCALE`), ground cards x1.3 (`CARD_SCALE`).
Adding a kind: type + factory, array on `RunState`, a `Builder` in `render/` (`create`, `patch`, `drawInMs`),
a case in `render/view.ts`.

## Loop and systems
`core/loop.ts`: fixed 60 Hz `update`, rAF `render`, `loop.after()` for timers (never `setTimeout`).
`systems/step.ts` fixes the order: law pre, statuses, `movePlayer` (statuses slow or hold the player), enemy AI,
`playerAttacks` + `enemiesAttack` (skipped in bot hours), `heroStep` (cooldowns, dash, summons, zones, player
projectiles, update queue), `collectPickups`, `updateLoot`, `trickleSpawn`, law post, `tickLaw`, `tickPageTurn`.
`systems/combat.ts` `applyDamage(s, bus, defender, amount, crit, type?)` is the only place racja changes: it runs
`enemies/hooks.ts` `modifyDamage` (claim rebuttal = crit and struck bubble, existence, zgloszony), then death.
Pass `type` always: skills do (`heroes/helpers.ts` `skillDamage`). Crits shove an enemy 12 units x `law.knockbackMul`.
Damage formula: `combat/damage.ts` (hit `clamp(2A/(A+D), .05, .95)`, crit x2 before resist, resist cap 75).

## Hero layer (`heroes/`)
Four heroes (`defs.ts`), twelve skills (`skills.ts`, `castSkill` refuses during bot hours, while `zablokowany`, and
while `wyciszony` with a margin note), quirks (`quirks.ts`: Pralka's 10th hit, Konsultant's trial speed and
`seesDefects`, Kartograf's `revealsPage`), the per-step `system.ts`. `layer.ts` ties it to the forms: update form
(`ui/update.ts`), death forms (`ui/deathForms.ts`), pads (`ui/pads.ts`). Death (`death/outcomes.ts`): zgloszenie,
petla (a hostile copy that carries one of your items away and drops it when crossed out), zawieszenie (suspended
until the appeal form from the next elite is filed).

## Deferred update queue (`progression/queue.ts`)
A level up (`player:levelup`) only does `hero.pendingLevels++`, writes the margin note "Dostepna aktualizacja"
and shows the typed HUD line under Reputacja (a 44 px button). `heroStep` ticks the queue and emits `update:ready`
when no enemy has been within 320 units for 1.5 s, or `hero.updateRequested` is set (page turn, HUD tap).
`canOpenUpdate` refuses while a boss lives, while any sheet holds the screen (`status !== running`, `modal`,
`turning`, form open) and after the boss fell. Queued updates open one after another.

## Enemies and loot
Families, assembly of drawn parts, claims, AI, bosses: `enemies/` (README). The first wave of every page is placed
in the 390 x 700 entry view, none closer than 180 units (`spawnEntryWave`). Claim bubbles are shown only for elites,
bosses, the nearest enemy within 260 units and for 2 s after draw-in (`render/bubbleFocus.ts`, class `bubble-off`).
`systems/loot.ts`: `dropLoot` (items, stars; tables per tier), `rollPermission` (elite 1/3, boss always) and
`dropPermission` (a checkbox card with the family word). `takePickup` pushes the family into `player.permissions`
(read by `progression/update.ts` `hasPermission`); a permission never enters the inventory. A copy's item comes back
through `heroes/layer.ts`. The exit dog-ear is drawn in when the player is within 400 units, at once for the
Kartograf, who also gets a footnote naming the corner (`render/exitReveal.ts`, `world/pages.ts` `exitVisible`).

## Law flags (`world/laws.ts`, neutral values when no clause is active; read them unconditionally)
| flag | read by |
|---|---|
| `spawnPairs`, `lootPairs`, `extraElites`, `enemyCountMul`, `lootMul`, `lootTierBonus` | spawn and loot code |
| `speedMul`, `weaponDamageMul` | `lawPre/lawPost` around the step |
| `knockbackMul` | `systems/combat.ts` `knockback`, Wirowanie pull |
| `botTime` | `step.ts`, skills, summons, player projectiles, enemy shots and bosses (nobody deals damage) |
| `noiseAggroMul`, `noisyUntil` | `aggroMul(state)` in `enemies/ai.ts` |
| `reversed`, `reverseAfter` | `tickLaw` pushes enemies back; HUD prints negative reputacja |
| `killCost`, `cookies`, `twoFactorExit`, `officeOpen`, `hours` | economy, `ui/lawSheets.ts`, kiosk |

## Events (`core/events.ts`, typed bus; `bus.on`, `bus.emit`)
Input: `skill:1|2|3`, `inventory`, `player:tap`. Run: `run:started`, `run:ended {outcome}`, `screen:changed`,
`page:entered`, `page:turn`, `page:edge`. Combat: `player:hit`, `enemy:hit|miss|died {tier, family}`, `boss:died`,
`enemy:rebutted|offTopic|escalated`. Heroes: `skill:cast`, `skill:fx`, `summon:expired`, `player:levelup`,
`update:ready`, `player:died`, `player:unsuspended`. Presentation: `footnote {text}`, `stamp`, `margin:note
{text, x, y, ttl?}`, `law:trigger`, `law:ask`, `pickup:taken`. Adding one to `GameEvents` makes the compiler check all uses.

## Render
`views.sync` creates one `<g data-id>` per entity, then patches only `transform` and a few attributes
(never rebuild children per frame). Ink primitives in `render/ink.ts`: `drawIn`, `eraseOut`, `strike`, `blot`,
`stamp`, `marginNote`, `tapMark`. No gradients, glow, shadows, translucent fills; red only for stamps, strikes, Racja.
HTML sheets share `ui/sheet.ts`; long ones scroll in their own area (`overscroll-behavior: contain`,
`touch-action: pan-y`) with the action row sticky or below the scroll, and every `#ui button` is at least 44 x 44 px.

## i18n
`t('domain.key')`; `src/i18n/pl/<domain>.json` are picked up automatically (file name = key prefix). A leaf is a
string or `{ one, few, many }` with `{count}`. No UI strings in `.ts` files, no `any`, no `!` outside tests.

## Test hook, scripts, commands
`window.__game`: `start(seed, opts)`, `go(screen)`, `state()`, `advance(s)`, `turnTo(page)`, `hitEnemy()`,
`killEnemy()`, `hurtPlayer(n)`, `placePlayer`, `snapshot()`, `giveItem`, `demoInventory`, `openInventory`, `openSklep`,
`hero.{cast, levelUp, grantXp, openUpdate, pickUpdate, die, givePermission}`, `enemies.{spawnFamily, spawnBoss, hit, clear, list}`.
`npm run dev | build | typecheck | test`. `npm run shot` builds, serves with `vite preview`, drives the bundled
Chromium at 390x844 @2x and writes `shots/*.png` (exits non-zero on page errors). `npm run smoke` builds and plays
a whole ticket in the same browser: real buttons into a run, kills, the queued update opened from the HUD line,
inventory, boss on the last page, `baza` after it, a death form, then 5 s of `requestAnimationFrame` deltas with 40
enemies; pictures in `shots-smoke/`, exit code 1 on a page error or a failed check (`SMOKE_UNCAPPED=1` lifts the 60 Hz
limit, `PERF_MAX_MS` fails above a bound). Everything must pass `npm run typecheck && npm test && npm run build`.
