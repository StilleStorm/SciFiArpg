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
elite, boss, runtime bag `rtOf()`), `projectile`, `pickup` (item plate, gwiazdki star, or permission card), `summon`
(copy, decoy, ghost), `zone` (`teren`, `hourglass`). Radii match the drawing (`ENEMY_SCALE` 1.2, `HERO_SCALE` 1.15,
`CARD_SCALE` 1.3). Adding a kind: type + factory, array on `RunState`, a `Builder` (`create`, `patch`, `drawInMs`),
a case in `render/view.ts`.

## Loop and systems
`core/loop.ts`: fixed 60 Hz `update`, rAF `render`, `loop.after()` timers (never `setTimeout`), `pause()/resume()`,
`freeze(ms)` (hit-stop). `systems/step.ts` order (run phase): law pre, statuses, `movePlayer`, enemy AI,
`playerAttacks` + `enemiesAttack` (skipped in bot hours), `heroStep`, `collectPickups`, `updateLoot`, `trickleSpawn`,
law post, `tickLaw`, `tickPageTurn`, `tickTunnel`. Base phase: `movePlayer`, `heroBaseStep`, `tickBase`, `tickTunnel`.
`systems/combat.ts applyDamage(s, bus, defender, amount, crit, type?)` is the only place racja changes (claims,
existence, zgloszony via `enemies/hooks.ts modifyDamage`, then death); pass `type` always. Formula in `combat/damage.ts`.
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
- Hero: `skill:cast`, `skill:fx`, `summon:expired`, `player:levelup`, `update:ready`, `player:died`, `player:unsuspended`.
- Presentation: `footnote {text}`, `footnote:added {n, text, correction}` (every printed footnote), `stamp`,
  `margin:note {text, x, y, ttl?}`, `law:trigger`, `law:ask`, `pickup:taken`.

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
Wznów, Ustawienia, Zakończ (run only). Android back: the run sits one history entry above `baza`; `popstate` in a run
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
margin notes) -> `#ui`. `render/bindings.ts bindFx(bus, views, page)`: the margin note sits inside the page shown
(`marginSpot(side, x, y, page)`). Headers: `obstacles.ts drawHeader/headerBox/wrapLines`; `headerFor(s, view?)`,
`baseHeaderFor(s, view?)` take `portraitSpan(camera)` so in portrait the header fits the visible span, two lines,
cut after a whole sentence. Camera (`render/camera.ts`): at least 390 wide, 700 tall in portrait, 520 in landscape;
`bounds` follow the page shown. Ink: `drawIn, eraseOut, strike, blot, stamp, marginNote, tapMark` (`render/ink.ts`);
paint only via `render/wash.ts washGroup`. No gradients, glow, shadows; red only for stamps, strikes, Racja.
`render/attackFx.ts` turns `attack:started` into transform-only poses. Sheets share `ui/sheet.ts`; every `#ui` button
is at least 44 x 44.

## Controls and layout (DESIGN 2)
`ui/layout.ts` sets `data-orient` and `data-steer` on `<html>`; landscape and joystick rules live in `ui/landscape.css`.
`input.ts`: `held()` (tap mode), `steer()` (joystick), `setEnabled`, `setMode`, `setLeftHanded`, `inject`. Joystick:
the first pointer on the steering half owns the stick; a quick tap (<260 ms, <10 px) calls `onTap(x, y, false)`, which
opens the footnote history when it lands on the slip (the slip has `pointer-events: none` in joystick mode, so a thumb
landing on it steers) and otherwise only reaches the kiosk. Skill pads cast on `pointerdown`.

## Audio (`audio/`, DESIGN 14)
Web Audio only, synthesized; `audio/bindings.ts` is the one place events meet sounds; nothing exists before the first
gesture; errors are swallowed. Music flags (`deriveFlags`): enemiesNear, elite, boss, botTime, `paused` (set from
`game:paused`, played like bot hours), reversed, suspended, dead, pageTurn, `base` (calm layer, 6 dB down). Music runs
from `run:started` to `run:ended` and in the base. `npm run render-audio` measures peaks, body band and clipping.

## i18n
`t('domain.key', params)`; `src/i18n/pl/<domain>.json` (file name = prefix). Plurals `{one, few, many}`. One-letter
words are bound to the next with U+00A0 by `t()`. No user-facing strings in `.ts`.

## Test hook and scripts
`window.__game`: `start(seed, opts)`, `go`, `state`, `meta/setMeta`, `screen`, `advance(s)`, `turnTo(page)`,
`attack`, `hitEnemy`, `killEnemy`, `hurtPlayer`, `placePlayer`, `snapshot`, `footnote(text)`, `notes()`, `giveItem`,
`demoInventory`, `openInventory`, `openSklep`, `openKiosk`, `setTheme`, `setOrientation`, `setSteering`,
`setLeftHanded`, `controls`, `joystick(dx, dy)`, `pause`, `resume`, `endTicket`, `resumeTicket`, `character`,
`startBase(seed?)`, `station(name)`, `acceptTicket`, `walkToExit`, `openTunnel`, `enterTunnel`, `returnFromTunnel`,
`hero.{cast, levelUp, grantXp, requestUpdate, openUpdate, pickUpdate, die, givePermission}`,
`enemies.{spawnFamily, spawnBoss, hit, clear, list}`, `audio.{renderProfile, renderSfx, music, contextState, ...}`.
`npm run check` = typecheck, vitest, `lint:rules`, build. `npm run shot` (390x844 @2x and 844x390 into `shots/`);
per-domain shots `scripts/shot-{base,tunnel,pause,attacks,enemies,heroes,items}.mjs` (each with its own
SHOT_PORT/SHOT_OUT/SHOT_DIR, usage in the header). `npm run smoke` plays a ticket with real buttons: profile, base
(HUD, margin note, update from the HUD line), desk, ticket, exit, run, fight, update, inventory, pause, Zakończ,
bookmark resume, two tunnels and the return, boss, death, a landscape joystick leg (two touches, the footnote slip),
then 5 s of frame times with 40 enemies (`PERF_MAX_MS`, `SMOKE_UNCAPPED`); exit 1 on any failed check or page error.

## Aiming (DESIGN 5.6)
Every `SkillDef` has `aim: 'auto' | 'kierunek' | 'wskazanie'`. Pads (`ui/pads.ts`) press, drag and release: a drag over 8 px on a non-auto skill shows the preview (`render/aimFx.ts`: dotted arrow or dotted circle in `#fx`), release fires with the resolved `Aim`, releasing back over the pad cancels (no cooldown), a quick tap is the auto cast. Pure logic in `heroes/aim.ts` (`autoTarget` prefers a standing-claim rebuttal in range, `dragToAim`, `isCancel`, `isTap`, resolvers per skill). `castSkill(s, bus, slot, free, aim)` in `heroes/skills.ts`; the pad hands the aim over through `queueAim` because `skill:N` has no payload (integrator may move it into the payload). Events: `skill:aim {slot, mode, x, y, dx, dy}` while held; `skill:cast` carries `aim`. Hook: `aimCast`, `holdPad`, `releasePad`. Port 4190 is unsafe in Chromium; shot-aim uses 4195.

## Base stations (after player feedback)
Stations open on a tap anywhere on their drawing or label (`Game.onTap` emits `station:opened`); walking into them does nothing; labels are permanent. The notice board (`ui/board.ts`) shows three announcements and the ticket history; the desk keeps Nowe/Wznów zgłoszenie and Zmień profil; settings live only in the pause sheet (`go('settings')` opens pause + settings). `ui/sheet.ts guardGhostClicks()` drops the compatibility mouse events that follow a touch `pointerdown` so a sheet opened by a tap does not receive that tap's click. Opening a station sheet (`holdBase`) disables input and `releaseBase` re-enables it (the former hang).

## Fifth hero and the laser (2026-10-18)
Heroes: pralka, konsultant, petlowiec, kartograf, nalesnik (`HERO_IDS` in save/character.ts and the save check list it too). Naleśnik logic in `heroes/nalesnik.ts` (orbit roll with a satellite, gravity pull, the `Zone` variant `'wniosek'` with `inside`), quirk in `heroes/shield.ts` (`projectileDamageMul`: skim from 90% racja; `Player.round` while rounded). Kartograf's auto is a hitscan laser: `fireAuto` → `fireLaser` → shared `attack()`; `attack:started` carries `laser {sx, sy, ex, ey, crit, metres}`; crit pierces along the line. The base page animates on a render clock `animMs` in game.ts because `RunState.time` does not advance in phase 'base'. Sounds: `nalesSlap`, `nalesOrbita`, `nalesGravity`, `nalesFlag`.

## Fourth and fifth skills (DESIGN 10.1)
Types (`heroes/defs.ts`): `SkillIndex = 0 | 1 | 2 | 3 | 4` (a skill of the hero), `PadSlot = 0 | 1 | 2` (a pad). `HeroDef.skills` is a
five-tuple; `SkillDef` gains `requires?: FamilyId` (type-only import from `enemies/ids`; the permission the first rank of skills 3 and 4 wants;
`progression/update.ts Family` is the same union). `HeroRun.cd`, `cdTotal`, `ranks` are keyed by **SkillIndex**
(length 5); `HeroRun.pads: [SkillIndex, SkillIndex, SkillIndex]` (default `[0, 1, 2]`) says which skill each pad fires.
`heroes/loadout.ts` (heroes agent): `isInstalled(s, i)` (0..2 always; 3 and 4 when `ranks[i] > 0`), `installedSkills(s): SkillIndex[]`,
`padSkill(s, slot): SkillDef`, `assignPad(s, slot, skill): boolean` (refuses a not-installed skill; a skill already on another
pad swaps with the one on `slot`; after it the three pads always hold three different installed skills), `fixPads(s)` (after a
load: any pad holding a not-installed or duplicate skill falls back so the invariant holds). `castSkill(s, bus, slot: PadSlot, free, aim)`
casts `pads[slot]`; the free cast (Pralka's quirk) draws from `installedSkills`. `skill:cast` carries `{slot, skill: SkillIndex, free, aim}`;
`skill:aim` keeps `slot`. `HERO_SKILL_SOUNDS[hero]` has five entries (index = SkillIndex). `helpers.ts power/areaOf/durationOf/cooldownOf`
take a SkillIndex. Pads (`ui/pads.ts`): `syncPads(s)` every frame redraws a pad's word and glyph when `s.hero.pads` changed
(`SKILL_DRAWINGS[hero]` has five glyphs), `updatePadCooldowns` reads `cd[pads[i]]`, a press resolves the skill through `padSkill`.
Progression (`progression/update.ts`): pool entries `skill1..skill5` (`slot` is a SkillIndex), `requirementOf`: skills 0..2 gate rank 3 by
`SKILL_FAMILY[slot]`, skills 3..4 gate rank 1 by `SkillDef.requires`; `entryView` of a skill's rank 1 for index 3..4 reads
"Nowa umiejętność: <name>" with the skill's own desc. `applyUpgrade` sets `ranks[slot]`; the form (`ui/update.ts`) follows the
install of such a rank 1 with the step "Przypisz do przycisku" (three pad buttons with their current words, "Później"), which
calls `assignPad`. `ui/loadout.ts` is the sheet the pause line "Umiejętności" opens (run and base): five rows, pad numbers,
`assignPad` on tap. Save: `ProgressData.pads` (`progression/persist.ts`), `applyProgress` sets it then `fixPads`; `save/character.ts`
reads it leniently (missing -> `[0, 1, 2]`). New entity variants: `Summon.variant 'moon'` (Nalesnik's Księżyc; `orbit?: {angle, r}`),
`Zone.variant 'legenda' | 'start' | 'numer'` (Kartograf's legend box, Pętlowiec's landing countdown with `follow` unused, Konsultant's case number following its target).
Smoke: `.pad.s1` still fires skill 0 on a fresh character.
