# Architecture (read this before the code)

Plain data, pure functions, one thin render layer. The page is one `<svg id="stage">` plus an HTML
overlay `<div id="ui">`. `npm run dev` runs it; `window.__game` drives it from tests and shots.

## Brief changes already applied
Fonts: Michroma (titles, stamps, screen headers; `--title`), Space Mono (HUD, labels, buttons, forms;
`--mono`), EB Garamond (narration, footnotes; `--serif`). Damage types are `mechaniczny |
regulaminowy | egzystencjalny`. HUD labels: Racja, Reputacja, Gwiazdki, Strona. Title screen is
"ZGLOSZENIE NR 48213" with the stamp "ZGLOSZENIE PRZYJETO". Stubs exist for claims, statuses, spor.

## Layout of the stage (index.html)
`#page` (paper beyond the edge, grain, hatched border, obstacles; no filter) -> `#world` (entities;
wobble filter) -> `#fx` (blots, strikes, stamps, margin notes, tap marks) -> `#ui` (HTML: HUD form,
pads, footnotes, cover, death form). `<defs>` hold `#wobble`, `#wobble-cover`, `#hatch`, `#hatch-wide`,
`#stamp-mask`, `#paper`. The camera shows at least 390 x 700 world units; the `#wobble` filter region is
moved to the visible area each frame by `camera.apply()`. Colors are CSS variables on `:root`
(`--paper --paper-edge --ink --ink-wet --accent`); `data-theme="night"` on `<html>` swaps them
(`setTheme('day'|'night'|'auto')` in `render/stage.ts`). SVG layers get stroke styles from CSS (`#world`
etc.); never set stroke width on a figure's root `<g>`.

## State
`RunState` (`world/run.ts`), created by `createRun(seed)`:
`{ seed, rng, rngs:{ai,combat,loot,spawn}, time (s), status:'running'|'dead', page, pageIndex, pageCount,
lawId, player, enemies[], projectiles[], pickups[], nextId, nextItemNumber, kills, edgeCooldown, spawnTimer }`.
`Page` = `{ w:1200, h:1600, inset, spawn, obstacles[] }`; each obstacle has `colliders: Circle[]`.
Entities (`entities/types.ts`): `Player`, `Enemy`, `Projectile`, `Pickup`, all `{ kind, id, x, y, r }`;
fighters add `hp, hpMax` (Racja), `speed, facing, moving, stats, damageType, attackRange, attackCooldown,
attackTimer, statuses[]`. `Enemy.claim?: Claim`. `MetaState` (`save/save.ts`): `{ version, heroId?, stamps,
runsCompleted }`, localStorage key `zgloszenie.meta`, `loadMeta()/saveMeta()` never throw.
Random: every gameplay roll uses `s.rngs.<stream>` (mulberry32, `rng.fork(label)` depends only on seed+label).
Render-only randomness uses its own generators in `render/` and never touches `s.rng*`.

## Loop and systems
`core/loop.ts`: fixed 60 Hz `update(dt)`, rAF `render(frameDt, alpha)`, pauses on `visibilitychange`,
`loop.after(seconds, fn)` for timers (never setTimeout). `main.ts` wires: update -> `game.update`;
render -> `tickTweens`, wobble re-seed (every 500 ms), `game.render`, `hud.update`.
`systems/step.ts` fixes the order: statuses, `movePlayer`, `updateEnemies`, `playerAttacks`,
`enemiesAttack`, `collectPickups`, `trickleSpawn`. A system is `(state, bus, dt)`. Add one by writing a
file in `systems/` and calling it in `step.ts`. `systems/combat.ts` has `attack()` and `applyDamage()`
(the only place hp changes and `enemy:hit|player:hit|enemy:died|player:died` are emitted).
Damage formula: `combat/damage.ts` `rollDamage(attacker, defender, type, rng)` (roll order: hit, crit,
range). Hit chance `clamp(2A/(A+D), .05, .95)`, crit x2 before resist, resist capped at 75, min 1.

## Events (`core/events.ts`, typed bus: `bus.on(name, fn)`, `bus.emit(name, payload)`)
`skill:1|2|3`, `inventory` (no payload; pads only emit these) - `screen:changed {screen}` -
`run:started {seed}` - `player:hit {x,y,amount,crit}` - `player:died {x,y}` -
`enemy:hit {id,x,y,amount,crit}` - `enemy:miss {id}` - `enemy:died {id,x,y}` - `pickup:taken {id,number}` -
`page:edge {x,y,side}` - `footnote {text}` (shows a footnote) - `stamp {text,x,y}` (slams a stamp at world x,y).
To add an event: add it to `GameEvents`; TypeScript then checks every emit/on.

## Adding an entity kind
1. Type in `entities/types.ts` (add to the `Entity` union), factory in `entities/factory.ts`.
2. Array on `RunState` and a system for it.
3. A `Builder` in `render/`: `{ create(e): SVGGElement, patch?(e, g, timeMs), drawInMs? }` and add it to the
   `Builders` map that `createGame` passes to `createViews` (see `render/figures.ts`, `placeholderBuilders`).
   Extend the `switch` in `render/view.ts` `make`/`patch` (the compiler flags it).

## How `render/view.ts` patches
`views.sync(entities, timeMs)` each frame: unseen id -> `builder.create`, append to `#world` (pickups
are prepended so they lie under actors), `data-id` and `data-kind` set, `drawIn` if `drawInMs`; seen id -> only
`transform` (`translate(x y)` plus `scale(-1 1)` when `facing < 0`; written only when the string changes)
and `builder.patch` (legs: swap `d` when the 150 ms phase changes); ids that vanished -> node removed.
`views.detach(id)` forgets a view but leaves the node so `strike()` can finish and remove it
(done in `render/bindings.ts` on `enemy:died`). Never rebuild children in `patch`.

## Ink primitives (`render/ink.ts`; call `initInk(stage.fx)` once, `tickTweens(ms)` per frame)
- `drawIn(g, ms)` / `eraseOut(g, ms, delay?, done?)`: dash animation of every stroked descendant; hatch fills pop in at 60%.
- `strike(g)`: two red strokes across the bbox, "skreslono" (`ui.ink.struck`), rub-out, fade, removes `g`. `g` must be in the DOM and out of the view map (`detach`).
- `blot(x, y, radiusUnits, crit?)`: pooled (20), darkens over 300 ms via `color-mix`; crit adds 3-5 dots.
- `stamp(text, x, y, {parent?, ttl?, rotation?, fontSize?})`: uppercased, Michroma, red, mask `#stamp-mask`; scale 1.4 -> 1 in 120 ms; `ttl: Infinity` keeps it. `parent` lets HTML-hosted SVG (cover) use it.
- `marginNote(text, x, y, rot?, ttl?)`, `tapMark(x, y)`. Tweens: `render/tween.ts` `tween(ms, step(p), {delay, ease, done})`.
Rules: no gradients, glow, shadows, translucent fills; red only for stamps, strikes, Racja.

## i18n
`t('ui.hud.racja')`; files `src/i18n/pl/<domain>.json` are picked up automatically, file name = key prefix,
nested keys are joined with dots. A leaf is a string or `{ "one", "few", "many" }`; pass `{ count }` to select
(1 -> one; 2-4 except 12-14 -> few; else many). `{name}` placeholders. Missing key returns the key and warns
once. `genderForm({m,f,n,pl}, gender)` for generated names. No UI strings in `.ts` files; no `!` outside tests.

## Test hook (`src/testHook.ts`, always installed as `window.__game`)
`start(seed=1)`, `screen()`, `go('title'|'run'|'death')`, `hitEnemy()` (4 damage to nearest; if farther than 150 it is
pulled next to the player first), `killEnemy()`, `hurtPlayer(n)` (lethal values kill and lead to the death form after 1 s),
`placePlayer(x, y)`, `setTheme('day'|'night'|'auto')`, `theme()`, `footnote(text)`, `snapshot()` (plain data).

## Commands
`npm run dev | build | preview | typecheck | test | icons`; `npm run shot` builds, serves `dist` with
`vite preview`, drives the bundled Chromium (`scripts/browser.mjs` finds it under `/opt/pw-browsers`; override
with `PLAYWRIGHT_CHROMIUM`) at 390x844 @2x and writes `shots/{title,run,strike,tap,edge,run-night,hurt,death}.png`.
It exits non-zero on page errors or console errors. Look at the PNGs after every rendering change.

## Placeholders to replace (each owner agent)
`render/figures.ts` (player, enemy, pickup, projectile drawings), `systems/enemies.ts` (AI, spawning),
`narration/placeholder.ts` (three notes), `ui/pads.ts` words and drawings (skills are not wired to anything),
`world/laws.ts` (`applyLaw` no-op), `items` (`placeholderItem`), the death form (`ui/death.ts`).
