# Architecture (read this before the code)

Plain data, pure functions, one thin render layer. The page is one `<svg id="stage">` plus an HTML overlay
`<div id="ui">`. `npm run dev` runs it; `window.__game` drives it from tests, shots and the smoke script.
Fonts: Michroma (titles, stamps), Space Mono (HUD, forms, buttons), EB Garamond (narration, footnotes).
Damage types: `mechaniczny | regulaminowy | egzystencjalny`. Folder READMEs in `src/*/` say what each domain owns.

## Stage (index.html)
`#page` (paper, hatched border, obstacles, the exit dog-ear; no filter) -> `#world` (entities; wobble filter,
re-seeded every 500 ms) -> `#fx` (blots, strikes, stamps, margin notes) -> `#ui` (HTML: HUD, pads, footnotes, sheets).
The camera (`render/camera.ts`) shows at least 390 units wide and, by orientation (window wider than tall), at least
700 tall in portrait (390x844 -> 390 x 844 units) or 520 tall in landscape (844x390 -> about 1125 x 520, the 1200-unit
page fills the width). `viewSizeFor(vw, vh)` is the rule, `camera.resize()` stores it for `currentViewSize()`, and
`camera.viewRect()` / `viewRect()` give the rectangle clamped to the page plus 60 units of overscan.
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
`playerAttacks` (nearest enemy in range, standing or moving; a walking player keeps his facing) + `enemiesAttack`
(skipped in bot hours), `heroStep` (cooldowns, dash, summons, zones, player
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
in the real entry view (`world/pageTurn.ts` `entryView` from `currentViewSize()`), none closer than 180 units (`spawnEntryWave`). Claim bubbles are shown only for elites,
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
`update:ready`, `player:died`, `player:unsuspended`. Presentation: `footnote {text}`, `footnote:added {n, text,
correction}` (printed by `main.ts` for every footnote, the Asystent's too), `stamp`, `margin:note
{text, x, y, ttl?}`, `law:trigger`, `law:ask`, `pickup:taken`, `boss:phase {id, family, x, y}` (Prototyp at half racja,
Weryfikacja's grid solved, Hipoteza confirmed). Adding one to `GameEvents` makes the compiler check all uses.

## Render
`views.sync` creates one `<g data-id>` per entity, then patches only `transform` and a few attributes
(never rebuild children per frame). Ink primitives in `render/ink.ts`: `drawIn`, `eraseOut`, `strike`, `blot`,
`stamp`, `marginNote`, `tapMark`. No gradients, glow, shadows, translucent fills; red only for stamps, strikes, Racja.
HTML sheets share `ui/sheet.ts`; long ones scroll in their own area (`overscroll-behavior: contain`,
`touch-action: pan-y`) with the action row sticky or below the scroll, and every `#ui button` is at least 44 x 44 px.

## Audio (`audio/`, DESIGN 14)
Web Audio only, synthesized from noise, clicks and short plucks; no samples, no dependencies. State in, sound out: game
systems only emit events, `audio/bindings.ts` is the one place where events meet sounds, `audio.frame()` runs once per
rendered frame from `main.ts`. Nothing exists before the first gesture (`getContext()` is null, every call no-ops, no
autoplay warning); any `Error` inside a handler is swallowed (one `console.warn`, silent after 20), so audio can never
break the game. Hit-stop is `loop.freeze(40)` (rest period 90 ms), called by the bindings on crits and kills.
```
context.ts   one AudioContext, created on the first pointerdown/pointerup/touchend/click/keydown (and by "Akceptuję
             regulamin"), resumed on visibilitychange and after an iOS 'interrupted'; onAudioReady, setVolumes
mix.ts       sfx -> master; music -> duck -> master; master -> compressor (limiter) -> soft ceiling (-1.4 dBFS) -> out.
             music sits -12 dB under sfx at equal sliders; duck(6 dB, 300 ms) on kills and boss phases
dsp.ts       pure generators: Karplus-Strong (allpass-tuned, in buffers: DelayNode feedback is floored to 128 frames),
             2-op FM bell with detune, resonated-noise swell, motor hum, curves.  buffers.ts caches them per context
recipes.ts   every sound as data {layers: [{kind noise|click|pluck|thump|sine, freq, bandpass?, q?, attack, decay, gain,
             pitchDrop?, delay?, repeat?+spread? (grain trains), role transient|body|sub|tail}]}, validateRecipe,
             HERO_SKILL_SOUNDS (3 per hero), FAMILY_FLAVOUR.  levels.ts: per-recipe trims from the offline render
sfx.ts       playRecipe(sink, ...) builds nodes per call and disconnects them on `onended`; play(name, opts); startHum()
bindings.ts  bus -> sounds; reads hero and enemy family from the state; beast body scales with existence
hook.ts      window.__game.audio: renderProfile, renderSfx (OfflineAudioContext), music(), contextState()
music/       scale.ts (Bohlen-Pierce subsets, 7-note mode with two detuned degrees, pentatonic with one wrong note; all
             rejected until containsTriad finds no major/minor triad), profiles.ts (B hold line, C punched roll, B+C;
             tempo, scale, loop 8-16 bars, band, splice rate rolled from rng.fork('music')), roll.ts (page obstacles ->
             pins: x = step, y = degree, size = velocity and length), holdline.ts (tape chain: wow, flutter, hiss, gate
             splices, band, beep; the hold line's own loop material), adapt.ts (flags -> targets), scheduler.ts
             (100 ms look-ahead, 25 ms tick, no timers), engine.ts (one profile on any context with an injected clock),
             index.ts (startMusic, stopMusic, tickMusic, setMusicState, deriveFlags)
```
Music flags are derived from the run state each frame (`deriveFlags`): enemies within 380 units, an elite within 700, a
boss alive, `law.botTime`, `law.reversed`, `player.suspended`, dead, `turning`. Targets (`adaptTargets`) ease over about
3 s: calm sparse (the strongest pin of every bar), more than 2 near = second voice a fifth below, a little late; elite =
splices and a reversed fragment every 8 bars; boss = tempo x1.25, hiss up, hard cut per `boss:phase`; bot hours =
300-3400 Hz and a beep every 4 s; reversed = the loop runs backwards; suspended = -12 dB behind a lowpass; death =
tempo to 0, no sting; page turn = a splice and the new page's roll. Music exists only during a run (`run:started` to
`run:ended`). The engine stays under 40 nodes alive (17 persistent, at most 8 voices of 2 nodes, a beep and a tick);
`engine.test.ts` runs it on a recording fake context for 5 minutes of changing states. The roll is a pure function of the
page and the scale, so each page plays its own motif.
`npm run render-audio` builds, then renders through the real mix in the bundled Chromium: 20 s per profile and state,
a calm-to-boss crossfade and a death per profile, 1 s per sound and the composites the bindings play together, into
`audio-renders/` (gitignored); prints peak, RMS, the 60-140 Hz body share and clipping, and exits 1 on a clip, a peak
above -1 dBFS or a combat sound without body. After changing a recipe, re-measure and update `levels.ts`.

## Controls and layout (DESIGN 2)
`ui/layout.ts` writes `data-orient="landscape|portrait"` (window wider than tall) and `data-steer="joystick|tap"` on
`<html>`; `ui/landscape.css` holds every landscape rule, the joystick drawing and the portrait-joystick pad move (portrait
rules stay in `style.css`). Settings (`save/save.ts`): `orientation?` (default landscape; `lockOrientation` asks the Screen
Orientation API and never throws), `steering?` + `steeringTouched?` (until the player picks, `effectiveSteering` gives
joystick in landscape, tap in portrait). The manifest is `fullscreen`, `orientation: landscape`.
`input.ts` `Input`: `held()` (tap mode: the walking finger), `steer()` (joystick mode: `{dx, dy, mag}` or null),
`setEnabled`, `setMode(steering)`, `setLeftHanded` (steering half = right), `inject(steer)` (test hook). Joystick mode: the
first pointer on the steering half owns the stick (`ui/joystick.ts`: floating, base 56 px, dead zone 12%, `steerVector`),
other pointers stay independent; a quick tap (<260 ms, <10 px) calls `game.onTap(x, y, walk=false)`, which only reaches the
kiosk. Tap mode calls `onTap(x, y, true)`: walk there, ink "x". `game.update` copies `input.steer()` into `Player.steer`
each step (deleted on release, so the player stops on the next step); `movePlayer` lets `steer` override `target`.
Skill pads cast on `pointerdown` (a second touch gets no `click` while a thumb steers); a `click` within 700 ms of the
press is swallowed, a lone click (keyboard, script) still casts. The Załączniki pad stays on `click`.

## i18n
`t('domain.key')`; `src/i18n/pl/<domain>.json` are picked up automatically (file name = key prefix). A leaf is a
string or `{ one, few, many }` with `{count}`. `t()` ends with `bindOrphans` (`i18n/typography.ts`): the space after a
one-letter word (a i o u w z) becomes U+00A0, so tests that compare text use `\u00a0`. No UI strings in `.ts` files.

## Test hook, scripts, commands
`window.__game`: `start(seed, opts)`, `go(screen)`, `state()`, `advance(s)`, `turnTo(page)`, `hitEnemy()`,
`killEnemy()`, `hurtPlayer(n)`, `placePlayer`, `snapshot()`, `giveItem`, `demoInventory`, `openInventory`, `openSklep`,
`setOrientation`, `setSteering`, `setLeftHanded`, `controls()`, `joystick(dx, dy)` (0, 0 lets go),
`hero.{cast, levelUp, grantXp, requestUpdate, openUpdate, pickUpdate, die, givePermission}`, `enemies.{spawnFamily, spawnBoss, hit, clear, list}`,
`audio.{renderProfile, renderSfx, music, contextState, running, sfxNames}`.
`npm run dev | build | typecheck | test | lint:rules | check | render-audio`. `npm run shot` builds, serves with `vite preview`, drives the bundled
Chromium at 390x844 @2x and writes `shots/*.png`, then the same screens at 844x390 as `shots/land-*.png` (exits non-zero
on page errors). `npm run smoke` builds and plays
a whole ticket in the same browser: real buttons into a run, kills, the queued update opened from the HUD line,
inventory, boss on the last page, `baza` after it, a death form, a landscape leg at 844x390 with CDP touches (joystick by default, a
second finger taps a skill pad while the thumb steers, auto-attack while steering, stop within one step of the release),
then 5 s of `requestAnimationFrame` deltas with 40 enemies; pictures in `shots-smoke/`, exit code 1 on a page error or a failed check (`SMOKE_UNCAPPED=1` lifts the 60 Hz
limit, `PERF_MAX_MS` fails above a bound); it also checks that the real clicks unlock the audio context and that music plays. Everything must pass `npm run check`.

## Paint (render/wash.ts)
A wash (DESIGN §3.4) is a `<g class="wash">` of two flat translucent blobs, built once in a
builder's `create` and never patched. `washGroup(rng, hue, r, opts)` is the only entry point;
hues are CSS variables `--wash-<hue>` with `--wash-alpha` dimming them at night. Owners of
washes: heroFigures (hero, summon, copy), enemyFigures (family hue, elite second blob, boss
bonus), pickupCard (star halo, card by tier, permission), obstacles (coffee rings, 2–3 page
stains). `ink.ts` skips wash paths in draw-in/erase (it fades them by opacity instead).

## Attack animations
`attack:started {attackerId, attacker: 'player'|'enemy'|'summon', x, y, tx, ty, ranged}` is emitted once per attack attempt (hit or miss) from `systems/combat.ts attack()`, `heroes/auto.ts fireAuto`, the enemy shot in `enemies/ai.ts` and summon shots in `heroes/system.ts`. `render/attackFx.ts` turns it into a short transform-only pose on the attacker's figure (sub-groups marked `data-part`) plus one fx stroke for Pralka (whip) and Kartograf (measurement). `window.__game.attack('player'|'enemy')` triggers one for screenshots (`scripts/shot-attacks.mjs`).

## Pause and save (DESIGN 4.1)
`Game.pause()`/`resume()` hold the same RunState (status 'paused', input off, `Loop.pause()` stops steps and timers) and emit `game:paused {paused}`; the music treats `paused` like bot hours. `MetaState` (SAVE_VERSION 2) holds `character` (`save/character.ts`: heroId, level, xp, upgrades, permissions, pendingLevels, gwiazdki, equipment, inventory; `serializeCharacter`/`applyCharacter`, progress via `progression/persist.ts`) and `bookmark` (`save/bookmark.ts`: ticketNumber, seed, pageIndex, lawId, clockS, planetName, pageCount). `save/autosave.ts` writes the character on `page:entered`, `game:paused`, Zakończ, `run:ended` and hidden-tab; `settleRun` files the ticket and clears the bookmark. `createRun(seed, {character, resume})` applies the character, then the bookmark (regenerates pages from the seed, jumps to pageIndex, restores the clock). Baza offers "Wznów zgłoszenie nr …" while a bookmark exists. The old `stash` is migrated into the character. Test hook: `pause()`, `resume()`, `endTicket()`, `resumeTicket()`, `character()`.

## Tunel serwisowy (DESIGN 4.1)
`world/tunnel.ts` holds the rules (pure: `planOpen`, `stepTunnel`, `isOnHole`, `closeFor`, `fateOfHeldRun`, `createRunHold`) and `openTunnel`/`closeTunnel`/`tickTunnel`/`bindTunnel`. `RunState.tunnel = {x, y, pageIndex, armed}`. Events: `tunnel:opened {x,y,pageIndex}`, `tunnel:entered`, `tunnel:returned`, `tunnel:closed {reason: 'return'|'second'|'death'|'end'|'page'}`. Entering holds the exact RunState (`game.pause()`, `loop.pause()`, baza shows "Wróć do zgłoszenia"); returning restores the same object and tapes the hole (`render/tunnelFx.ts`); starting another ticket or changing the hero settles the held run (bookmark + character). Android back button: the run screen sits one history entry above baza; `popstate` in a run opens/closes the pause sheet (see the comment in `main.ts`). Test hook: `openTunnel()`, `enterTunnel()`, `returnFromTunnel()`.
