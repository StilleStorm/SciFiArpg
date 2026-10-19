# Architecture (the contract builders code against)

Plain data, pure functions, one thin render layer. One `<svg id="stage">` plus an HTML overlay `<div id="ui">`;
`window.__game` drives it from tests, shots and the smoke script. Folder READMEs in `src/*/` say what each domain owns.
Fonts: Michroma (titles, stamps), Space Mono (HUD, forms), EB Garamond (narration, footnotes). Damage types:
`mechaniczny | regulaminowy | egzystencjalny`.

## Screens, phases, state
Router (`main.ts`): title -> profile (no hero yet) -> **`baza`** (the walkable base page of a planet) -> **`run`** -> `baza`.
The desk, ticket, Sklep and settings are sheets over the base page (`openSheet`, one history entry), not screens.
`RunState` (`world/run.ts`, `createRun(seed, opts)`) is the one live state; `phase: 'base' | 'run'`. The base is the
same object as the run it becomes: `createRun(seed, {phase: 'base'})` holds `page` = the base page (900 x 700,
`world/base.ts generateBase`), `base` (`BaseState`: layout, accepted, resume bookmark) and `pageIndex` = the run page
the exit leads to. Walking through the unlocked exit (`world/pageTurn.ts enterPage` -> `beginRun`) flips the phase,
deletes `base`, starts the clock and emits `run:started`. In the base: no clock, laws, spawns, fights, bookmark, or
`heroStep` (`heroBaseStep` only cools the pads and opens a queued update the HUD line asked for; `castSkill` ignores
the pads). While a tunnel holds a run, that RunState waits in `hold` (`createRunHold`, never copied) and a second,
base-phase RunState is live; `Game.adopt(held)` makes the held one live again (page redrawn, entities synced with no
draw-in). Other fields: four rng streams (`ai combat loot spawn`; every roll goes through them), `time`, `status`
(`running | paused | dead`; sheets and forms use `paused`), `modal` (law sheets), `turning`, `pages`, `player`,
`enemies projectiles pickups summons zones`, `law`, `hero` (`heroes/state.ts`), `victoryAt`, `tunnel?`.
`MetaState` (`save/save.ts`, SAVE_VERSION 2, localStorage `zgloszenie.meta`) holds settings, history, `character`
(`save/character.ts`) and `bookmark` (`save/bookmark.ts`: ticketNumber, seed, pageIndex, lawId, clockS, planetName,
pageCount); loading never throws.

**Entity kinds** (`entities/types.ts`, all `{kind, id, x, y, r}`): `player`, `enemy` (family, tier, claim, defect,
elite, boss, runtime bag `rtOf()`), `projectile`, `pickup` (item plate, gwiazdki star, permission card, or `potwierdzenie` slip), `summon`
(copy, decoy, ghost), `zone` (`teren`, `hourglass`). Radii match the drawing (`ENEMY_SCALE` 1.2, `HERO_SCALE` 1.15,
`CARD_SCALE` 1.3). Adding a kind: type + factory, array on `RunState`, a `Builder` (`create`, `patch`, `drawInMs`),
a case in `render/view.ts`.

## Loop and systems
`core/loop.ts`: fixed 60 Hz `update`, rAF `render`, `loop.after()` timers (never `setTimeout`), `pause()/resume()`,
`freeze(ms)` (hit-stop). `systems/step.ts` order (run phase): law pre, statuses, `movePlayer`, enemy AI,
`playerAttacks` + `enemiesAttack` (skipped in bot hours), `heroStep`, `collectPickups`, `updateLoot`, `trickleSpawn`,
law post, `tickLaw`, `tickPageTurn`, `tickTunnel`. Base phase: `movePlayer`, `heroBaseStep`, `tickBase`, `tickTunnel`.
`systems/combat.ts applyDamage(s, bus, defender, amount, crit, type?)` is the only place racja changes (claims,
existence, zgloszony via `enemies/hooks.ts modifyDamage`, then death); pass `type` always. A blow on the player calls
`systems/recovery.ts onPlayerBlow` first (regen pause; auto-use of a held potwierdzenie). Formula in `combat/damage.ts`.
Update queue (`progression/queue.ts`): a level up only queues (`pendingLevels++`, margin note, HUD line); the form opens
on a calm page (no enemy within 320 for 1.5 s), a page turn or the HUD tap, never with a live boss, a sheet up, or
after the boss fell (`canOpenUpdate`). In the base only the HUD tap opens it.

## Law flags (`world/laws.ts`; neutral values when no clause is active; read unconditionally; run phase only)
| flag | read by |
|---|---|
| `spawnPairs`, `lootPairs`, `extraElites`, `enemyCountMul`, `lootMul`, `lootTierBonus` | spawn and loot code |
| `speedMul`, `weaponDamageMul` | `lawPre/lawPost` around the step |
| `knockbackMul` | `systems/combat.ts knockback`, Wirowanie pull |
| `botTime` | step, skills, summons, player projectiles, enemy shots, bosses, music |
| `noiseAggroMul`, `noisyUntil` | `aggroMul(state)` in `enemies/ai.ts` |
| `reversed`, `reverseAfter` | `tickLaw` pushes enemies back; HUD prints negative reputacja |
| `killCost`, `cookies`, `twoFactorExit`, `officeOpen`, `hours` | economy, `ui/lawSheets.ts`, kiosk |

## Events (`core/events.ts`; adding one to `GameEvents` makes the compiler check every use)
- Input: `skill:1|2|3`, `inventory`, `player:tap {x,y}`.
- Flow: `screen:changed {screen}`, `base:entered {layout, seed, number}` (a base page is up; seed + number name the
  ticket), `station:opened {station}` (biurko, kiosk, tablica, paczkomat reached: main opens its sheet),
  `ticket:accepted` (the exit unlocks, the base header is printed), `run:started {seed}` (the exit was walked through, or
  a direct start), `page:entered {index, count}`, `page:turn {from, to}`, `page:edge {x, y, side}`,
  `run:ended {outcome}` (exactly once per run; main files it and goes to `baza`), `game:paused {paused}` (Game.pause/
  resume), `run:bookmarked {pageIndex}` (autosave wrote the bookmark).
- Tunnel: `tunnel:opened {x, y, pageIndex}`, `tunnel:entered` (player walked onto an armed hole), `tunnel:returned`,
  `tunnel:closed {reason: return | second | death | end | page}` (the first three are taped).
- Combat: `attack:started {attackerId, attacker, x, y, tx, ty, ranged}`, `player:hit`, `enemy:hit|miss`,
  `enemy:died {id, x, y, tier?, family?}`, `boss:died`, `boss:phase`, `enemy:rebutted|offTopic|escalated`.
- Hero: `skill:cast {slot, skill, free, aim}`, `ultimate:cast {heroId, ultimateId, x, y}`, `skill:fx` (kind, x, y, x2, y2, r), `summon:expired`, `player:levelup`, `update:ready`, `player:died`, `player:unsuspended`.
- Presentation: `footnote {text}`, `footnote:added {n, text, correction}` (every printed footnote), `stamp {text, x, y, quiet?, away?}` (`quiet`: another recipe carries the thud, audio plays no stamp; `away`: a point it must not cover; `render/bindings.ts placeStamp` keeps every bus stamp inside `freeViewRect(camera, 'stamp')` and 80 units off `away`),
  `margin:note {text, x, y, ttl?}`, `law:trigger`, `law:ask`, `pickup:taken`.
- Recovery: `recovery:taken {healed, held}` (0 healed = kept), `recovery:used {auto, healed, held}`.
- `Bus.recent(n = 10)`: the last events (ring of 40, minus `skill:aim`, `player:tap`, `enemy:miss`, `attack:started`) as
  `{name, payload}` text, for the bug dump.

## The base page, the tunnel, pause and save (DESIGN 4.1)
`world/base.ts`: three layouts from the seed, stations (`tapStation`, `stationReached`, `tickBase` emits
`station:opened` and the locked-exit note), `acceptTicket(s, bookmark?)`, `exitLocked`, `bookmarkAllowed`,
`arrivalKey`. `render/stations.ts drawBase` returns `BaseView {frame(s), unlock(header)}` (labels within
`LABEL_RANGE`, solid exit, clause header). HUD in the base: the page field reads "Baza" + the layout word
(`world.layout.*`), Tunel note hidden; skill pads hidden (`.pads.in-base`).
`world/tunnel.ts`: pure `planOpen, stepTunnel, isOnHole, closeFor, fateOfHeldRun, createRunHold, carryPurse`, thin
`openTunnel, closeTunnel, tickTunnel, bindTunnel, cutBaseHole`. Entering holds the exact RunState (`game.pause()`,
`hold.hold`) and shows the base of the same planet with the hole; returning (`returnFromTunnel`) adopts it, calls
`tunnelFx.restore(pageIndex)` (tapes cut earlier on that page), `tunnelFx.show(...)`, resumes and tapes the hole.
Starting another ticket, resuming the bookmark or changing the hero settles the held run (bookmark + character).
`render/tunnelFx.ts bindTunnelFx(bus, {page, pageWidth})` returns a handle: unbind function + `show(x, y, animate?,
page?)`, `restore(page)`, `tapes()`.
Pause: `Game.pause()/resume()` hold the same state (status `paused`, input off, `Loop.pause()`); the pause sheet offers
Wznów, Ustawienia, Umiejętności, Konfiguracja, Zgłoś problem z grą (`[data-pause=report]`, hidden by `bugButton: false`),
Zakończ (run only); five or six lines stand in a 3-column grid in landscape. Android back: the run sits one history entry above `baza`; `popstate` in a run
toggles the pause sheet. Save: `save/autosave.ts` writes the character on `page:entered`, `game:paused`, Zakończ,
`run:ended`, hidden tab; `settleRun` files the ticket and clears the bookmark. A bookmark makes the desk offer
"Wznów zgłoszenie"; resuming regenerates the bookmarked page from the seed (`createRun(seed, {character, resume})`).

## Narration (`narration/asystent.ts`)
One narrator per ticket, keyed by seed + number: `base:entered` for a new ticket starts it and writes the arrival note
once; the run, the tunnel's base and the base after Zakończ go on with it. Footnote numbers run on the same way
(`main.ts notesFor`). The Asystent ticks wherever the walkable screen runs (not under sheets); its idle note is
`idle_base` in the base, `idle` in the run. 1 in 8 notes is wrong and corrected 10-20 s later by number.

## Render
`views.sync(entities, timeMs, {drawIn?})` creates one `<g data-id>` per entity and patches only `transform` and a few
attributes; `drawIn: false` skips the draw-in (a redrawn page). Layers: `#page` (paper, obstacles, header, exit, holes,
base stations; no filter) -> `#world` (entities; wobble filter re-seeded every 500 ms) -> `#fx` (blots, strikes, stamps,
margin notes) -> `#ui`. `render/bindings.ts bindFx(bus, views, page, view, damageNumbers)`: the margin note sits inside the page shown
(`marginSpot(side, x, y, page)`). Headers: `obstacles.ts drawHeader/headerBox/wrapLines`; `headerFor(s, view?)`,
`baseHeaderFor(s, frame?)` take `headerFrame(camera)` = `{view?: portraitSpan, avoid?: headerKeepOut}`: in portrait the header
fits the visible span, two lines, cut after a whole sentence; `headerBox(page, view, avoidExit, avoid, topChars)` narrows it
beside the margin-note row when the form line and 240 units still fit (landscape), else sets it below the row (portrait). Camera (`render/camera.ts`): at least 390 wide, 700 tall in portrait, 520 in landscape;
`bounds` follow the page shown. Ink: `drawIn, eraseOut, strike, blot, stamp, marginNote, tapMark` (`render/ink.ts`);
paint only via `render/wash.ts washGroup`. No gradients, glow, shadows; red only for stamps, strikes, Racja. `stampsOnPage()` counts fx-layer
stamps until they fade. Claim bubbles (`render/bubbleFocus.ts`, game.ts render): `pickBubbles` shows at most `BUBBLE_CAP 2` (bosses, elites,
then nearest within 260 or in the 1.2 s new grace), none while `stampsOnPage() > 0`; hidden ones stay in the DOM (strikes kept); a shown one is
moved by `avoidBoxes` (render/keepOut.ts) inside `freeViewRect(camera)` and off `keepOutBlocks(camera)` and the bubbles placed
before it this frame (`bubblePlaced`). Stamps: `placeStamp(x, y, w, h, view, away?, blocks)` (bindFx 6th argument = blocks).
Keep-out (`render/keepOut.ts`, measured by `ui/keepOut.ts watchLayout(ui)`): `screenLayout()` = `{w, h, top, bottom, blocks, row}`
in css px from the DOM (HUD bottom and footnote band when they span the width, else blocks; pads, the update line, the
Potw./Tunel/Pauza notes; `row` = the notes as the run shows them + a pad in their corner). Re-measured lazily after a resize,
an `<html>` data-orient/data-steer/style change, a layout class change in #ui (paint-only tokens ignored) or a HUD/foot resize;
pending observer records are read synchronously, so a page drawn right after the HUD is shown sees the new layout. Never fixed
pixels; the insets in camera.ts are only the fallback before a measurement (tests). World text that must read on a phone uses
`readableUnits(units, minPx=11)` (elite word, boss name, margin notes). The swept sheet of a page turn drops its bubbles.
`render/attackFx.ts` turns `attack:started` into transform-only poses. `render/ultFx.ts createUltFx(fx).frame(s)` (game.ts
render) outlines each running ultimate with an `r` as a dotted `.ult-area` circle in #fx at its `x, y`, erased when it ends. Sheets share `ui/sheet.ts`; every `#ui` button
is at least 44 x 44.

## Controls and layout (DESIGN 2)
`ui/layout.ts` sets `data-orient` and `data-steer` on `<html>`; landscape and joystick rules live in `ui/landscape.css`.
`input.ts`: `held()` (tap mode), `steer()` (joystick), `setEnabled`, `setMode`, `setLeftHanded`, `inject`. Joystick:
the first pointer on the steering half owns the stick; a quick tap (<260 ms, <10 px) calls `onTap(x, y, false)`, which
opens the footnote history when it lands on the slip (the slip has `pointer-events: none` in joystick mode, so a thumb
landing on it steers) and otherwise only reaches the kiosk. Skill pads cast on `pointerdown`. Portrait + joystick puts Załączniki
under the HUD (right; left when left-handed, then the update line hangs under the pad). The notes' circles are paper-filled.

## Audio (`audio/`, DESIGN 14)
Web Audio only, synthesized; `audio/bindings.ts` is the one place events meet sounds; nothing exists before the first
gesture; errors are swallowed. Music flags (`deriveFlags`): enemiesNear, elite, boss, botTime, `paused` (set from
`game:paused`, played like bot hours), reversed, suspended, dead, pageTurn, `base` (calm layer, 6 dB down). Music runs
from `run:started` to `run:ended` and in the base. Hero sounds come from `heroById(id).sounds` (`skills[5]`, `autoStart?`,
`ultimate?`: played with a duck on `ultimate:cast`). `npm run render-audio` measures peaks, body band and clipping.

## i18n
`t('domain.key', params)`; `src/i18n/pl/<domain>.json` (file name = prefix). Plurals `{one, few, many}`. One-letter
words are bound to the next with U+00A0 by `t()`. No user-facing strings in `.ts`.

## Test hook and scripts
`window.__game`: `start(seed, opts)`, `go`, `state`, `meta/setMeta`, `screen`, `advance(s)`, `turnTo(page)`,
`attack`, `hitEnemy`, `killEnemy`, `hurtPlayer`, `placePlayer`, `snapshot`, `footnote(text)`, `notes()`, `giveItem`,
`demoInventory`, `openInventory`, `openSklep`, `openKiosk`, `setTheme`, `setOrientation`, `setSteering`,
`setLeftHanded`, `setSettings(patch)`, `controls`, `dropPotwierdzenie(dist)`, `heldPotwierdzenia`,
`setHeldPotwierdzenia(n)`, `usePotwierdzenie`, `exportArchive()`, `importArchive(text)` (as a confirmed import), `joystick(dx, dy)`, `pause`, `resume`, `endTicket`, `resumeTicket`, `character`,
`startBase(seed?)`, `station(name)`, `acceptTicket`, `walkToExit`, `openTunnel`, `enterTunnel`, `returnFromTunnel`,
`tapUltimate`, `ultimatePad() {ready, off, inked, hidden}`, `keepOut()` (the measured screen layout), `setLevel(n)`, `fillMeter(v=1)`, `setMeterUi(v)`, `castUltimate`,
`ultimateInfo() {meter, ready, active, paragraph}`, `setSpecialization(id|null)`, `loadoutInfo() {pads, categories, specialization, capstone, advice}`, `hero.{cast, installSkill, openAssign, assignPad, setParagraph, levelUp, grantXp, requestUpdate, openUpdate, pickUpdate, die, givePermission}`,
`enemies.{spawnFamily, spawnBoss, hit, clear, list}`, `audio.{renderProfile, renderSfx, music, contextState, ...}`.
`npm run check` = typecheck, vitest, `lint:rules`, build. `npm run shot` (390x844 @2x and 844x390 into `shots/`);
per-domain shots `scripts/shot-{base,tunnel,pause,attacks,enemies,heroes,items,aim,skills,loadout,s2,s3,s4,s5,recovery}.mjs` (each with its own
SHOT_PORT/SHOT_OUT/SHOT_DIR, usage in the header). `npm run smoke` plays a ticket with real buttons: profile, base
(HUD, margin note, update from the HUD line), desk, ticket, exit, run (header clear of the note row, no bubble under a pad or note,
the update line clear in tap/joystick x both hands), fight, update, inventory, pause, Zakończ,
the Argument meter and an ultimate (3d), bookmark resume, two tunnels and the return, boss, death, a landscape joystick leg (two touches, the footnote slip), the S4 leg (6f: desk loadout -> run -> reload, the chart), the S5 leg (6g: damage numbers, text size, drop ->
heal, full -> held, tap use, auto-use, the pause bug line, export -> import equality),
then 5 s of frame times with 40 enemies (`PERF_MAX_MS`, `SMOKE_UNCAPPED`); exit 1 on any failed check or page error.

## Aiming (DESIGN 5.6)
Every `SkillDef` has `aim: 'auto' | 'kierunek' | 'wskazanie'`. Pads (`ui/pads.ts`) press, drag and release: a drag over 8 px on a non-auto skill shows the preview (`render/aimFx.ts`: dotted arrow or dotted circle in `#fx`), release fires with the resolved `Aim`, releasing back over the pad cancels (no cooldown), a quick tap is the auto cast. Pure logic in `heroes/aim.ts` (`autoTarget` prefers a standing-claim rebuttal in range, `dragToAim`, `isCancel`, `isTap`, resolvers per skill). `castSkill(s, bus, slot, free, aim)` in `heroes/skills.ts`; the pad hands the aim over through `queueAim` because `skill:N` has no payload (integrator may move it into the payload). Events: `skill:aim {slot, mode, x, y, dx, dy}` while held; `skill:cast` carries `aim`. Hook: `aimCast`, `holdPad`, `releasePad`. Port 4190 is unsafe in Chromium; shot-aim uses 4195.

## Base stations (after player feedback)
Stations open on a tap anywhere on their drawing or label (`Game.onTap` emits `station:opened`); walking into them does nothing; labels are permanent. The notice board (`ui/board.ts`) shows three announcements and the ticket history; the desk keeps Nowe/Wznów zgłoszenie and Zmień profil; settings live only in the pause sheet (`go('settings')` opens pause + settings). `ui/sheet.ts guardGhostClicks()` drops the compatibility mouse events that follow a touch `pointerdown` so a sheet opened by a tap does not receive that tap's click. Opening a station sheet (`holdBase`) disables input and `releaseBase` re-enables it (the former hang).

## Fifth hero and the laser (2026-10-18)
Heroes: pralka, konsultant, petlowiec, kartograf, nalesnik (the list is `HERO_ID_LIST` in `heroes/registry.ts`; `HERO_IDS` in save/character.ts re-exports it and the save check uses `isHeroId`). Naleśnik logic in `heroes/nalesnik/steps.ts` (orbit roll with a satellite, gravity pull, the `Zone` variant `'wniosek'` with `inside`), quirk in `heroes/nalesnik/quirk.ts` (round up below a third of racja) and `heroes/shield.ts` (`projectileDamageMul` reads `Player.skim`, set from the `skim` trait: skim from 90% racja; `Player.round` while rounded). Kartograf's auto is a hitscan laser: `fireAuto` → `fireLaser` → shared `attack()`; `attack:started` carries `laser {sx, sy, ex, ey, crit, metres, scale?}`; crit pierces along the line. The base page animates on a render clock `animMs` in game.ts because `RunState.time` does not advance in phase 'base'. Sounds: `nalesSlap`, `nalesOrbita`, `nalesGravity`, `nalesFlag`.

## Hero folders, registry, primitives (S1)
One folder per hero, `src/heroes/<id>/`, exports `hero: HeroModule` (`heroes/module.ts`): `def` (`HeroDef` data, built with `defineHero`/`defineSkill`
of `heroes/build.ts`), `figure` (`HeroFigure`: the drawing, wash and its `hue`, attack pose, `drive`/`build`/`patch` hooks), `sounds` (five recipe names
by SkillIndex, `autoStart`; audio/bindings.ts plays them), `casts` (`Record<SkillDef.id, SkillFn>`), `pads` (`HeroPadGlyphs`, five glyphs for ui/pads.ts),
`passives` (six `HeroPassive {mods, requires?}` for progression/update.ts) and optionally `quirk` (`onHit`, `tick`). `heroes/registry.ts` is the one list of ids
(`HERO_ID_LIST`, type `HeroId`) and modules: `HEROES` (the `HeroDef`s), `HERO_IDS`, `heroById(id): HeroModule`, `heroDef(id)`, `DEFAULT_HERO_ID`.
`heroes/defs.ts` keeps the types and re-exports `HEROES/HERO_IDS/heroDef`. Nothing outside `src/heroes/<id>/` (and tests, i18n, the registry) may write a
hero id, as a string literal or a table key: `scripts/lint-rules.mjs` rule `hero-id-literal` (and `registry.test.ts`); no exceptions. Another domain
reads what it needs per hero from `heroById(id)` and uses `DEFAULT_HERO_ID` for the default. What used to be `heroId === ...` branches is data:
`HeroDef.traits` (`trialSpeed`, `seesDefects`, `revealsPage`, `skim`, `friendlyCopy` (death/outcomes.ts petla ghost), `buffKillGwiazdki`), `auto.lash`,
`chosenNoteKey` (ui/profile.ts files the note), `HeroModule.quirk/sounds/pads/passives`, `HeroFigure`.
Casts are lists of steps (`heroes/cast.ts`: `cast(i, steps)`, `CastEnv`, `firstCast`; a step returning `false` = nothing happened, no cooldown) calling the
primitives in `heroes/primitives/` (each takes `Ctx {s, bus}` and plain options; no state of its own): `dash` (dash/roll), `teleport`, `pull`, `push`
(jump/sweep), `aoe`, `cone`, `line`, `hitscan`, `projectile`, `forkProjectile`, `zone` (with `max` per variant), `summon` (with `max`, `settle`),
`removeSummon`, `decoy`, `statusApply` (`touch`), `buff`, `heal` (`amount`/`atLeast`), `shield`, `cooldownReset`, `deferredDamage`, `echo`,
`stepDeferred` (called by `heroStep`; `HeroRun.deferred?` exists only once a skill queued a hit). Figures: `heroes/figureKit.ts` (types, `Parts`, helpers) and
`heroes/poseKit.ts` (`HeroPose`, keyframes, the shared timing constants); `render/heroFigures.ts` is the engine that builds and patches the `<g>` from
`heroById(id).figure`; `render/attackFx.ts` keeps the ink strokes and re-exports `heroPose(id, t)`/`HERO_ATTACK_MS` from the figures
(`driveHeroStroke` takes the figure's `stroke: 'whip' | 'slap'`). Scaffold: `npm run new-hero <id>` (`scripts/new-hero.mjs`, templates `heroes/_template/*.tpl`,
registers the hero, prints the checklist). Contract test: `heroes/contract.test.ts` replays every hero x skill x aim kind (and Petlowiec with a copy)
on a fixed seeded scene against `heroes/contract.snapshot.json` (captured before the refactor; regenerate only for an intended change:
`npx vitest run -u src/heroes/contract.test.ts`). Folder contract: `src/heroes/README.md`.

## Fourth and fifth skills (DESIGN 10.1)
Types (`heroes/defs.ts`): `SkillIndex = 0..4` (a skill of the hero), `PadSlot = 0..2` (a pad); `HeroDef.skills` is a five-tuple;
`SkillDef.requires?: FamilyId` is the permission rank 1 of skills 3 and 4 wants. `HeroRun.cd/cdTotal/ranks` are keyed by SkillIndex
(length 5, all five cool down every step, run and base); `HeroRun.pads: [SkillIndex x3]` (default `[0, 1, 2]`).
`heroes/loadout.ts`: `isInstalled`, `installedSkills`, `padSkill`, `padOf`, `assignPad(s, slot, i)` (refuses a not-installed skill; a skill on
another pad swaps; the pads always hold three different installed skills), `fixPads` (after a load). `castSkill(s, bus, slot, free, aim)`
checks and then runs the exported `fire(s, bus, skill, slot, free, aim)`: the skill fn (`heroById(id).casts[skill.id]`), the cooldown unless free, `skill:cast {slot, skill, free, aim}`,
and `HeroRun.lastCast {skill, aim}` (resolved, concrete aim; not for free casts nor Już to było). Pralka's błąd programu (`pralka/quirk.ts`, dispatched by `quirks.ts onPlayerHit`) picks
from `installedSkills`; an off-pad skill is cast through pad 0 with `pads[0]` swapped for that one call and put back.
Code: casts in `heroes/<id>/skills.ts` (Już to było in `petlowiec/skills.ts` calls `fire` and lets each
live copy recast from its own position by standing the player there for the call), per-step effects in `heroes/steps2.ts` (called from
`heroes/system.ts` in its fixed order), all numbers in `heroes/numbers.ts`, aim geometry in `heroes/aim.ts GEOMETRY`. New `HeroRun` fields:
`reading` (Pralka's Wniosek o osobowość: until, acc, upor), `numer` (Konsultant's case number: id, until, handovers, number, x, y),
`scale` (Kartograf's Skala 1:1: until, from, to on `attackRange`), `tide` (Naleśnik's Pływy ring), `moonUpor`, `lastCast`, `noted` (first-cast
footnote bits). Numer sprawy's +35% is an `enemy:hit` listener (`bindNumerBonus`, bound once per bus) that takes the extra racja before the
death check. Skala 1:1 makes every laser pierce and sets `laser.scale` on `attack:started` (render/attackFx.ts halves the tick spacing).
Entities: `Summon.variant 'moon'` with `orbit {angle, r, ring?, hits?}`, stepped by `stepMoon` (render: `heroFx.ts buildMoon/patchMoon`);
`Zone.variant 'legenda'` (`inside`, `acc`, `order` of the wrong names), `'start'` (lands when `ttl` runs out: `landStart`), `'numer'`
(`follow`, `number`). `skill:fx` kinds added: `drum`, `wet`, `section`, `cut`, `tide`, `capsule`.
Pads (`ui/pads.ts`): `syncPads(s)` each frame (heroes/layer.ts) redraws word, label and glyph when `pads` changed (glyphs from
`heroById(id).pads`); `updatePadCooldowns` draws `cd[pads[i]]`; a press resolves the skill through `padSkill`.
Progression (`progression/update.ts`): pool `skill1..skill5`; `requirementOf` gates rank 3 of skills 0..2 by family and rank 1 of 3..4 by
`requires`; `newSkillOf(before, after)` is the index whose rank went 0 -> >0; `roman(rank)`. The update form's `onPick` (heroes/layer.ts)
snapshots `ranks`, confirms, and for a new skill calls `UpdateForm.assign(s, skill, done)`: the same sheet becomes "Przypisz do przycisku"
(`.sheet.assigning`, three `.assign-pad[data-pad]` with the words they carry, `.report.later` "Później"); `done` closes and resumes.
`ui/loadout.ts openLoadout(root, s, onBack)` (+ pure `loadoutRows`) is the sheet behind the pause line `[data-pause=skills]`
"Umiejętności" (run and base; main.ts `openPauseSkills/closePauseSkills`, `clearPause` closes it): five `.lo-row[data-skill]`, a greyed
`.off` row for a skill not installed, `.lo-pad[data-pad]` (`.on` = occupied). Save: `ProgressData.pads`; `padsFrom(v)` reads it leniently
(not three indexes 0..4 -> `[0, 1, 2]`), `applyProgress` sets it then `fixPads`; `save/character.ts toCharacter` uses `padsFrom`.
Hook: `hero.cast(slot, aim?)`, `installSkill(3|4)`, `openAssign(3|4)`, `assignPad(pad 1..3, index)`, `info().pads`. Smoke 3b covers the
assign step, the pause loadout and Później. Shots: `shot-skills.mjs` (4197), `shot-loadout.mjs` (4198).

## Paragraphs (S2, DESIGN 10.2)
Data: `heroes/paragraphs.ts` (`Paragraph {n, nameKey, descKey, patch, permission?}`, `ParagraphPatch` of at most four fields from
`type, aim, reach, area, width, count, dur, dmg, cd, cost, status`, `applyParagraph(skill, patch)`, `PARAGRAPH_STEP {2: 6, 3: 14}`);
`heroes/<id>/paragraphs.ts` gives every skill its opening level and § 1..3 (`HeroModule.paragraphs`); texts `heroes.<id>.para.<skill>.<n>.{name,desc}`
in `i18n/pl/heroes/<id>.json`. On a run `HeroRun.para` (n per SkillIndex) and `HeroRun.patch` exist only while some skill is off § 1.
Every read of a skill's shape goes through `heroes/loadout.ts effectiveSkill(s, i)` (and `padSkill`, the helpers' power/area/dur/reach):
casts, pads, aim previews, the loadout and Konfiguracja types. Engine `progression/paragraphs.ts` (pure): `paragraphsOf(heroId, skillId)`,
`paragraphLevel`, `isParagraphUnlocked(progress, skillId, n)` (§ 2 at skill level + 6, § 3 at + 14, or the paragraph's family permission;
skills 4/5 once installed), `unlockedParagraphs(c)`, `activeParagraph/setActiveParagraph(c, skillId, n)` on a `Character`; on a run
`runProgress(s)`, `runParagraph(s, i)`, `setRunParagraph(s, skillId, n, force?)` (refuses a closed paragraph unless `force`),
`applyParagraphs`, `activeParagraphsOf`, `skillWith`. Save: `Character.paragraphs?: {skillId: 2|3}` written from the run, applied after
`applyProgress` (closed ones fall back to § 1). Update form (`progression/update.ts`): `offerVersion(s)` is the level the form installs
(the oldest queued); `paragraphEntries(s)` are the paragraphs opening exactly at that version, open and not active, as offer ids
`para:<skill index>:<n>` (`paraId`, `parseParagraphId`; never stored in `upgrades`); `pickFeature` leads with a new skill, else the first
paragraph; `composeOffer` adds two passive/stat entries; `confirmUpdate` of a `para:` id calls `setRunParagraph` (the pick is the active
paragraph). One passed over stays switchable and is not offered again. UI: `ui/konfiguracja.ts openKonfiguracja(root, s, onBack)` (+ pure
`konfiguracjaRows`: per skill three `.kf-box[data-n]` `active | open | locked`, the active one stamped CZYNNY in place of its name, which
heads the row's description `.kf-dname`; a tap on an open box calls `setRunParagraph`); opened from the pause line `[data-pause=paragraphs]`
and the desk line `[data-desk=konfiguracja]` (main.ts `openKonfig` hides the sheet under it, `closeKonfig` shows it again and, at the desk,
writes the character; also closed by `clearPause`/`dropSheets`). Pads show `.ptag` "§2"/"§3" from `runParagraph`. Hook:
`hero.setParagraph(skillId, n, force = true)`, `info().paragraphs`, `info().skillIds`. Smoke 2b, 3c, 6e. Shots: `shot-s2.mjs` (4182).

## Spór (DESIGN 5.4)
State: `RunState.spor?: SporState` (`combat/spor.ts`): `{ prompt: SporPrompt | null; bossId: number; phase: 1 | 2; ttl: number;
window: number; answered: Record<number, 1 | 2> }` (`answered[bossId]` = the last phase that already posted, so each boss posts
once per phase; `window` = seconds left of the x2 against `bossId`). Pure logic in `combat/spor.ts`: `SPOR_TTL_S = 12`,
`SPOR_WINDOW_S = 5`, `SPOR_WRONG_COST = 0.1`, `promptFor(boss: BossId, phase: 1 | 2, rng): SporPrompt` (shuffles the three
replies with the seeded rng, sets `correct`), `answerSpor(s, bus, index: 0 | 1 | 2): 'right' | 'wrong' | 'none'`, `tickSpor(s, bus, dt)`
(ttl, window, erases on boss death), `sporMul(s, defenderId): 1 | 2`. The prompt data: `SPOR_PROMPTS[boss]` is two entries
(phase 1, 2) each `{ commentKey, replies: [reply per type] }`; keys `enemies.boss.<boss>.spor<1|2>.comment` and
`.reply.<mechaniczny|regulaminowy|egzystencjalny>` in `src/i18n/pl/enemies.json`.
Trigger: `enemies/bosses.ts` sets `rt.sporAt = s.time + 1.5` in `spawnBoss`; `tickBoss` posts phase 1 when `s.time >= rt.sporAt`
and phase 2 on the same branch that emits `boss:phase`, both through `postSpor(s, bus, e, phase)` (combat/spor.ts), which emits
`spor:posted {id, phase, commentKey, replies: textKey[]}`. Answers emit `spor:answered {id, index, right}`; the end of a prompt emits
`spor:closed {id, reason: 'answered' | 'expired' | 'died'}`. Wrong: `player.hp -= 10% of hpMax` (through `applyDamage` with
`type` undefined and a `footnote` 'combat.spor.offTopic'); right: `window = 5`, `stamp` 'combat.spor.stamp' over the boss.
Damage: `enemies/hooks.ts modifyDamage` multiplies by `sporMul(s, defender.id)` for an enemy defender; `applyDamage` passes `s`.
UI: `ui/spor.ts createSpor(root, bus, s)`: three `.spor-reply[data-reply]` boxed buttons in a `.spor` strip by the footnote slip
(portrait above it, landscape right margin above the pads), built on `spor:posted`, struck on a wrong answer, removed 600 ms after
`spor:closed`. Input is unchanged while a prompt is up; a tap on a reply does not steer.
Render: `render/enemyFigures.ts` adds the boss's `.bubble.comment` on `spor:posted`, strikes it on a right answer, erases it on
`spor:closed`. Audio: posted -> `footnote`, right -> `strikeThrough` + `stamp`, wrong -> `paperTear`.
Hook: `spor.answer(index)`, `spor.info()`. Smoke 5a: posted, wrong costs racja, right opens the window. Portrait stacks the comment
bubble above the claim bubble; landscape sets it beside it (mirrored when left-handed).

## Argument meter and ultimates (S3, DESIGN 10.2)
Meter: `Player.meter` 0..1, never saved. `combat/meter.ts` (pure): `meterOf`, `ultimateReady`, `meterGain(s, x)` (nothing while an
ultimate runs), `meterSpend`, `killFill(tier)`, `tickMeter(s, clock, dt)`; constants `METER_REBUTTAL 0.08`, `METER_KILL 0.03 / _ELITE
0.06 / _BOSS 0.15`, `METER_SPOR 0.5`, drain `METER_DRAIN_PER_S 0.01` after `METER_IDLE_S 4` with no enemy within `METER_COMBAT_R 320`.
Sources: `systems/combat.ts applyDamage(s, bus, defender, amount, crit, type?, credit = true)` fills on a rebuttal (an enemy defender,
`isRebuttal(claim, type)` checked before the claim is struck); pass `credit = false` for a blow that is not the player's (an enemy
redirected onto another, `heroes/system.ts stepRedirects`). `killEnemy` adds `killFill`; `combat/spor.ts answerSpor` adds half on a
right reply. Ultimates: `heroes/ultimateDefs.ts` (`defineUltimate(hero, spec)`, `UltimateDef {id, level, type, seconds, radius|null,
pageWide, keys, list: 3 x UltimateParagraph {patch, tune}, cast, tick?, end?}`, `UltEnv`, `perSecond`, `MAX_ULT_S 8`, `MAX_ULT_RADIUS
220`, `FIRST_ULTIMATE_LEVEL 12`); per hero `heroes/<id>/ultimates.ts` -> `HeroModule.ultimates` (template in `_template/ultimates.ts.tpl`).
Runtime `heroes/ultimate.ts`: `ultimateOf(s)` (`HeroRun.ultimateId`, else the first), `ultimateUnlocked(s)` (player level >= def.level),
`castUltimate(s, bus)` (refuses unless running, run phase, no modal, unlocked, meter full, not botTime/stunned/silenced, none running;
spends the meter, pays `patch.cost` in racja never fatally, pushes `ActiveUlt` onto `HeroRun.ult.active` with `r` = `tune.radius` or
`def.radius`, runs `cast`, emits one quiet `stamp` at `ultStampSpot` (above or below the hero, the emptier side, `away` = hero), one `margin:note`, `ultimate:cast`), `stepUltimates` (heroStep: drain, tick, end),
`setUltimateParagraph(s, n)` (saved as `Character.ultParagraph`), `ultimateSeconds`, `ultimateActive`, `ultimateAuto` (Kartograf: `shots`/`pierce` read by
`heroes/auto.ts fireLaser`). UI: `ui/ultimate.ts` is the only door from ui to the meter. `ui/pads.ts`: the fourth pad `.pad.ult` (stamp
pad, `ULT_STROKES 10` cushion strokes, `inkedStrokes(m)`), `.locked` (display none) below the unlock level, `.off` until full, `.ready`
(red cushion, the word in ink with a red underline); portrait above the three in the thumb column, landscape in the arc, lefty mirrored, hidden in the base; the Spór strip
makes room (`.spor` right 96 px portrait, +250 px landscape). `ui/hud.ts`: field "Argument" (`.arg`) beside Racja, an ink underline that
fills, heavier ink (`.full`) when full (not red). Audio: five recipes `pralkaUlt, konsUlt, petlUlt, kartoUlt, nalesUlt` (body layers, end in the stamp
thud), named by `HeroSounds.ultimate`. Smoke 3d (refused below 12, fill, cast, end). Shots: `shot-s3.mjs` (4183, `dist-s3`).

## Loadout, categories, specializations (S4, DESIGN 10.2–10.3)
Data: `heroes/specDefs.ts` (`SkillCategory`, `HeroSpecs {categories: skillId -> category, list: 3 Specialization}`, `defineSpec(hero, id,
skills, capstoneSkill, patch)`; `Capstone {nameKey, descKey, skill, patch}` where `CapstonePatch` = `area, dmg, dur, width, reach`
multipliers + `cd` seconds); per hero `heroes/<id>/specs.ts` -> `HeroModule.specs`; texts `heroes.<id>.spec.<spec>.{name, cap.name,
cap.desc}`, category names `forms.category.<c>`. API `heroes/specializations.ts` (pure): `categoryOf(skill|id)` (null when unknown),
`categoryNameKey`, `specializationsOf(heroId)`, `specializationOf`, `ultimatesOf`, `isSkillUnlocked/unlockedSkills(c)`,
`capstoneCount(c, specId)`, `activeCapstone(c: LoadoutView) -> {spec, capstone} | null` (only the chosen column, only with >= 2 of its
skills on the pads), `setLoadout(c, {pads, ultimate, specialization|null}) -> {ok} | {ok: false, reason}` (all or nothing; any three
different unlocked skills), `loadoutAdvice(c) -> SkillCategory[]` (advice only: the categories missing when two pads share one).
At the cast `heroes/skills.ts fire` runs inside `withCapstone(s, skill, fn)` (the run patch of that skill is swapped for
`mergeCapstone(paragraph patch, capstone)` and restored); `runCapstone(s)`. Preview: `heroes/loadout.ts padSkill` carries the capstone
(cooldown, patch); `ui/pads.ts` computes the aim preview inside `withCapstone`, so its reach and area match the cast. `effectiveSkill`
stays paragraph-only (casts read it inside `withCapstone`).
Run and save: `HeroRun.pads`, `HeroRun.ultimateId?`, `HeroRun.spec?`, `HeroRun.ult.para`; `Character.pads`, `ultimate?`,
`specialization?`, `ultParagraph?: 2|3` (validated by `toCharacter`, applied in `applyCharacter`). UI door `ui/konfLoadout.ts`:
`viewOf(s)`, `loadoutOf(s)`, `chosenSpec(s)`, `commitLoadout(s, partial) -> LoadoutResult` (through `setLoadout`, pads written in place).
`main.ts closeKonfig` writes the save on every close (base: `withCharacter`; run: `autosave.save()`).
Konfiguracja (`ui/konfiguracja.ts`): slots `.kf-slot[data-slot=1..3|ult]`, column buttons `.kf-spec[data-spec]` (`.on` = chosen, a
second tap withdraws), the capstone line `.kf-cap-line` (`i.granted|idle`), per skill row `.kf-pad[data-pad]` (swap like `assignPad`),
the category beside the type, the advice line `.kf-advice`. Karta uprawnień (`ui/karta.ts`): pure `kartaModel(KartaInput {progress,
pads, specialization?, ultimate?})`, `kartaInputFromRun(s)`; `openKarta(root, input, onBack)`; the ultimate band on top, three
`.kt-col[data-spec]` with `.kt-node[data-node][data-state=granted|gated|open]` in unlock order (stamp ZATWIERDZONO / BRAK UPRAWNIEŃ),
`.kt-cap[data-capstone]` at the foot, the passives in `.kt-band` under the columns (no column names them). Opened from the desk
(`[data-desk=karta]`, main.ts `openKartaSheet`) and the profile (`[data-profile=karta]`, from the saved character). Shots:
`scripts/shot-s4.mjs` (port 4184, `dist-s4`, `shots-s4/`).

## Recovery, save safety, small settings (S5, PLAN 8)
Potwierdzenia (`systems/recovery.ts`, pure but for the bus): `POTWIERDZENIE_DROP {common .1, elite .5, boss 1}` rolled last in
`dropLoot` on `rngs.loot`; `createPotwierdzeniePickup` (`Pickup.potwierdzenie: true`, number 0); `tickRecovery` (from `updateLoot`) pulls
slips within `VACUUM_RADIUS 90` (+ radii) while one can be taken and regenerates `REGEN_RATE 2%`/s after `REGEN_DELAY 4` s since
`Player.hurtAt`; `takePotwierdzenie` heals `HEAL_SHARE 25%` when not full, else keeps it (`Player.potwierdzenia`, cap `HELD_CAP 5`,
saved as `Character.potwierdzenia`), at the cap it stays on the ground; `useHeld(s, bus, auto?, incoming?)` (tap or auto; auto measures
against the racja after the incoming blow, so a heavy blow at full racja still uses one; stamp "Potwierdzono", footnote on auto);
`onPlayerBlow` uses one when a blow would leave under `AUTO_FLOOR 15%`. HUD: `ui/hud.ts createPotwButton` (`.potw-btn`, 44 px, one slot
beyond Tunel in every layout, `ui/potw.css`; hidden in the base) draws at most two slips (`render/pickupCard.ts buildSlip`) and types
the count (`.count`, `ui.hud.potwCount`) from two up. Audio: `recovery:taken` -> `paperSlide`; a use is heard through its `stamp`.
Save safety (`save/export.ts`): `requestPersistence()` on boot; archive `{kind: 'zgloszenie-archiwum', format 1, version, exportedAt,
meta}` with the meta written as `migrate` reads it (an export of an import is byte-identical); `parseArchive(text)` -> `{ok, meta}` or
`{ok: false, reason: parse | kind | newer}`; `describeMeta` feeds the confirmation popup at the desk (`[data-desk=export|import]`,
"Archiwum eksportowe"). A confirmed import goes through `main.ts importSave`: a run held in the tunnel is dropped unsaved, the save
replaced, settings applied, the base printed again from the new character (or the profile screen without a hero), the desk reopened.
Bug dump: `bugDump({meta, bus, planet, page, total, device})` (version, hero, planet, page, settings, viewport, last 10 events) ->
`copyText` (clipboard, textarea fallback) -> a footnote on the pause sheet (`PauseSheet.note`).
Settings (`Settings`, kept by `migrate` only when not default): `textSize?: 0|1|2` -> `--ts` 1 / 1.15 / 1.3 on `<html>` (`ui/textsize.css`
zooms `.fn-list, .pop, .ps-scroll, .ps-notes, .set-scroll`; the landscape footnote slip grows to two lines at that size, and
`ui/footnotes.ts` takes older notes off whole on a resize of the list), `damageNumbers?: true` (`render/damageNumbers.ts`: pool of 10
nodes in `#fx`, Garamond digits beside an `enemy:hit`, a crit is larger with a red underline; `bindFx` 5th argument), `bugButton?: false`.
Shots: `shot-s5.mjs` (4185, `dist-s5`, `shots-s5/`), `shot-recovery.mjs` (4176, `dist-recovery`, `shots-recovery/`).
