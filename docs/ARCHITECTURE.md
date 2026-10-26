# Architecture (the contract builders code against)

Plain data, pure functions, one thin render layer. One `<svg id="stage">` plus an HTML overlay `<div id="ui">`; `window.__game` drives it from tests,
shots and the smoke script. Folder READMEs in `src/*/` say what each domain owns. Fonts: Michroma (titles, stamps), Space Mono (HUD, forms), EB
Garamond (narration, footnotes). Damage types: `mechaniczny | regulaminowy | egzystencjalny`. Folded through M4 (S1–S21); a new slice adds its section
at the end and the integrator folds it at the milestone end. Beyond the CLAUDE.md layout: `world/planets/`, `render/locations/`, `enemies/anomalia/`,
`narration/onramp.ts`, `balance/` (each below).

## Screens, phases, state
Router (`main.ts`): title -> profile (the roster, or the creation form when there is no case file) -> **`baza`** (the walkable base page of a planet)
-> **`run`** -> `baza`. The desk, ticket, Sklep, board, archive and settings are sheets over the base page (`openSheet`, one history entry), not
screens; cards (`ui/cards.ts`) are modal layers. `RunState` (`world/run.ts`, `createRun(seed, opts)`) is the one live state; `phase: 'base' | 'run'`.
The base is the same object as the run it becomes: `createRun(seed, {phase: 'base'})` holds `page` = the base page (900 x 700, `world/base.ts
generateBase`), `base` (`BaseState`: layout, resume bookmark) and `pageIndex` = the run page the exit leads to. Walking through the exit (always open;
`world/pageTurn.ts enterPage` -> `beginRun`) flips the phase, deletes `base`, starts the clock and emits `run:started`. In the base: no clock, laws,
spawns, fights, bookmark or `heroStep` (`heroBaseStep` cools the pads; `castSkill` ignores them). While a tunnel holds a run, that RunState waits in
`hold` (`createRunHold`, never copied) and a second, base-phase RunState is live; `Game.adopt(held)` makes the held one live again (page redrawn,
entities synced with no draw-in). Other fields: four rng streams (`ai combat loot spawn`; every roll goes through them), `time`, `status` (`running |
paused | dead`; sheets and forms use `paused`), `modal` (law sheets), `turning`, `pages` (`Page.content?`: teczki, seal, event), `player`, `enemies
projectiles pickups summons zones`, `law`, `hero` (`heroes/state.ts`), `victoryAt`, `tunnel?`, `spor?`, `plan?` (`TicketPlan`), `mix`, `campaign?`
(`CampaignState`), `quests?` (`QuestState`, saved with the character), `buffs?` (`ActiveBuff[]`, seal stamps, run only, never saved). `MetaState`
(`save/save.ts`, SAVE_VERSION 3, localStorage `zgloszenie.meta`): settings, `stamps`, `runsCompleted`, the roster `characters: CharacterRecord[]`
(`{id, name, character, bookmark?, history, archive}`), `sharedArchive`, `activeCharacterId?`. The active record is **mirrored** at the top level
(`character` (`save/character.ts`), `bookmark` (`save/bookmark.ts`: ticketNumber, seed, pageIndex, lawId, clockS, planetName, pageCount, `plan?`),
`history`, `heroId`); `syncActive` folds the mirror into its record, `withMirror` the reverse, `toStored` is what storage and the archive file get.
`migrate` reads v3 and v2 (a roster of one); loading never throws. `Character` carries level, upgrades, gear, bag, purse, `potwierdzenia`, `pads`,
`paragraphs?`, `ultimate?`, `specialization?`, `ultParagraph?`, `campaign?`, quests. Roster (`save/roster.ts`, pure: meta in, `{ok, meta}` out; the
caller writes): `createCharacter(meta, heroId, name='')` (`'hero' | 'full' | 'duplicate'`), `selectCharacter`, `deleteCharacter` (shared archive
stays), `moveItem(meta, {zone, index}, to)` (`Zone = 'bag' | 'personal' | 'shared'`, caps 20/40/40; `'noCharacter' | 'missing' | 'full' | 'same'`),
`rosterOf`, `activeRecord`, `itemsIn`, `zoneCap`, `cleanName`, `nextCaseName`; `MAX_CHARACTERS 8`, `ARCHIVE_CAP 40`, `NAME_MAX 24`.
`ui/rosterStore.ts` is the only UI file on that API (codes -> `ui/rosterModel.ts errorText`). `go('profile')` first runs `settleForRoster()`.

**Entity kinds** (`entities/types.ts`, all `{kind, id, x, y, r}`): `player`, `enemy` (family, tier, claim, defect, elite, boss, runtime bag `rtOf()`:
`affixes, packOf, packSize, named, age`), `projectile`, `pickup` (item plate, gwiazdki star, permission card, or `potwierdzenie` slip), `summon`
(copy, decoy, ghost, `moon`), `zone` (`teren`, `hourglass`, `wniosek`, `legenda`, `start`, `numer`). Radii match the drawing (`ENEMY_SCALE` 1.2,
`HERO_SCALE` 1.15, `CARD_SCALE` 1.3). Adding a kind: type + factory, array on `RunState`, a `Builder` (`create`, `patch`, `drawInMs`), a case in
`render/view.ts`.

## Loop and systems
`core/loop.ts`: fixed 60 Hz `update`, rAF `render`, `loop.after()` timers (never `setTimeout`), `pause()/resume()`, `freeze(ms)` (hit-stop).
`systems/step.ts` order (run phase): `contentPre`, law pre, statuses, `movePlayer`, enemy AI, `playerAttacks` + `enemiesAttack` (skipped in bot
hours), `heroStep`, `collectPickups`, `updateLoot` (with `tickRecovery`), `tickContent`, `trickleSpawn`, law post, `tickLaw`, `tickPageTurn`,
`tickTunnel`. Base phase: `movePlayer`, `heroBaseStep`, `tickBase`, `tickTunnel`. `systems/combat.ts applyDamage(s, bus, defender, amount, crit,
type?, credit = true)` is the only place racja changes (claims, existence, zgloszony and Spór via `enemies/hooks.ts modifyDamage`, then death); pass
`type` always; `credit = false` for a blow that is not the player's (no meter). A blow on the player calls `systems/recovery.ts onPlayerBlow` first;
`items/stats.ts wearerDefence(p, combat rng)` is the defender block of every hit on the player. Formula in `combat/damage.ts`. Update queue
(`progression/queue.ts`): a level up only queues (`pendingLevels++`, margin note, HUD line); the form opens on a calm page (no enemy within 320 for
1.5 s), a page turn or the HUD tap, never with a live boss, a sheet up, or after the boss fell (`canOpenUpdate`). In the base only the HUD tap opens
it.

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
- Input: `skill:1|2|3`, `inventory`, `player:tap {x,y}`, `skill:aim {slot, mode, x, y, dx, dy}` (while a pad is held).
- Flow: `screen:changed {screen}`, `base:entered {layout, seed, number}`, `station:opened {station}` (biurko, kiosk, tablica, paczkomat, urzednik),
  `ticket:accepted`, `base:exit` (before the exit's `page:turn`), `run:started {seed}`, `page:entered {index, count}`, `page:turn {from, to}`,
  `page:edge {x, y, side}`, `run:ended {outcome}` (exactly once per run; main files it and goes to `baza`), `game:paused {paused}`, `run:bookmarked
  {pageIndex}`.
- Tunnel: `tunnel:opened {x, y, pageIndex}`, `tunnel:entered`, `tunnel:returned`, `tunnel:closed {reason: return | second | death | end | page}` (the
  first three are taped).
- Combat: `attack:started {attackerId, attacker, x, y, tx, ty, ranged, laser?}`, `player:hit`, `enemy:hit|miss`, `enemy:died {id, x, y, tier?,
  family?}`, `boss:died`, `boss:phase`, `enemy:rebutted|offTopic|escalated`.
- Spór: `spor:posted {id, phase, commentKey, replies, params?}` (`params` interpolate the comment: the finale's `{number}`), `spor:answered {id,
  index, right}`, `spor:closed {id, reason: answered | expired | died}`.
- Hero: `skill:cast {slot, skill, free, aim}`, `ultimate:cast {heroId, ultimateId, x, y}`, `skill:fx {kind, x, y, x2, y2, r}`, `summon:expired`,
  `player:levelup`, `update:ready`, `player:died`, `player:unsuspended`.
- Presentation: `footnote {text, correction?}` (main prints `correction` as a correction), `footnote:added {n, text, correction}`, `footnote:retract`
  (main calls `Footnotes.retract()`: the last note struck in red, `.fn.struck`, kept struck in the history), `stamp {text, x, y, quiet?, away?}`
  (`quiet`: audio plays no thud; `away`: a point it must not cover), `margin:note {text, x, y, ttl?}`, `law:trigger`, `law:ask`, `pickup:taken`.
- Campaign: `campaign:advanced {from, to, finale}`, `case:closed` (both from `settleCampaign` on `run:ended 'ukonczono'`).
- Elites: `elite:named {id, x, y, name}`, `elite:slain {id, x, y, name, minTier}` (no sound yet).
- Recovery: `recovery:taken {healed, held}` (0 healed = kept), `recovery:used {auto, healed, held}`.
- Page content: `content:opened {kind, id, x, y}`, `content:sealed {seal, x, y}`, `content:event {event, id, phase, x, y}`, `content:changed {id}`.
  Quests: `quest:changed {id, what: accepted|progress|ready|done|dropped}`.
- `Bus.recent(n = 10)`: the last events (ring of 40, minus `skill:aim`, `player:tap`, `enemy:miss`, `attack:started`) as text, for the bug dump.

## The base page, stations, the tunnel, pause and save (DESIGN 4.1)
`world/base.ts`: layouts from the seed and `PlanetDef.baseLayouts`, stations (`stationAt`, `labelBox`), `tickBase` (the exit is never locked:
`base:exit`, then `page:turn`), `acceptTicket(s, bookmark?)` (re-accepts the plan or points the exit at a bookmark, any number of times),
`bookmarkAllowed`, `arrivalKey`. A bookmark is the exit's destination (`createRun(..., {phase:'base', resume})` sets `pageIndex`); `takePlan` re-lays
the base. `main.ts` settles a run held in the tunnel on `base:exit`. Stations open on a tap only (`Game.onTap` -> `station:opened`; targets >= 44 css
px). `render/stations.ts drawBase(..., {header, planet})` returns `BaseView {frame(s), ink}`; `game.ts` passes `planet: questPlanet(s)`. Base HUD:
Tunel, Potw. and pads hidden (`.pads.in-base`). Opening a station sheet (`holdBase`) disables input, `releaseBase` re-enables it. Board `ui/board.ts
open(meta, quests?)`. Desk lines `[data-desk=...]`: Nowe zgłoszenie, `roster`, `karta`, `konfiguracja`, `osobowa`, `archiwum`, `export|import`.
`go('settings')` opens pause + settings. `world/tunnel.ts`: pure `planOpen, stepTunnel, isOnHole, closeFor, fateOfHeldRun, createRunHold, carryPurse`,
thin `openTunnel, closeTunnel, tickTunnel, bindTunnel, cutBaseHole`. `returnFromTunnel` adopts the held run (`tunnelFx.restore(pageIndex)`,
`show(...)`); another ticket, the bookmark or a file change settles it. `render/tunnelFx.ts bindTunnelFx(bus, {page, pageWidth})` -> unbind + `show(x,
y, animate?, page?)`, `restore`, `tapes`. Pause: `Game.pause()/resume()` hold the same state (status `paused`, input off, `Loop.pause()`); lines
`[data-pause=resume|settings|skills|paragraphs|report|end|exit]` (report hidden by `bugButton: false`; end in the run only; exit to the roster).
Android back: `popstate` in a run toggles the pause sheet. Save: `save/autosave.ts` writes the character on `page:entered`, `game:paused`, Zakończ,
`run:ended`, hidden tab; `settleRun` files the ticket and clears the bookmark; resuming regenerates the bookmarked page. Save safety
(`save/export.ts`): `requestPersistence()` on boot; archive `{kind: 'zgloszenie-archiwum', format 1, version, exportedAt, meta}` (an export of an
import is byte-identical); `parseArchive(text)` -> `{ok, meta}` | `{ok: false, reason: parse | kind | newer}`; `describeMeta`; `main.ts importSave`.
Bug dump: `bugDump({meta, bus, planet, page, total, device})` -> `copyText` -> a footnote on the pause sheet (`PauseSheet.note`).

**Page gates** (`world/gate.ts`): `Page.gate?: PageGate {kind: boss|teczka|quest|elite, id?, need?, key?, liftKey?, look?, figure? {look, key},
keyTeczka?, eliteId?, slain?}`, set from `PlanetDef.gates: PlanetGate[] {page, gate}` by `applyPlanetGates` in `createRun`. `installGate` adds an
obstacle of kind `gate` (`GATE_RADIUS` 150 arc of colliders over the exit corner, `Obstacle.variant` = look: `parcels` planet 2, `turnstile` planet 3;
`render/obstacles.ts drawGate/redrawGate`). `tickPageTurn` calls `stepGate` (`gateHolds`; lifts with `gateLiftKey(g)`, or writes `gateKey(g)` within
`GATE_NOTE_DIST`, every `GATE_NOTE_EVERY` s). Conditions: boss (`bindGates` on `boss:died` on that page), teczka (`need` opened, or with `keyTeczka`
only the page's one key folder from `placeKeyTeczka`, `Teczka.key`), quest (`id` in the log), elite (`bindGates` sets `slain` on `elite:slain` with
`eliteId`; `enemies/spawn.ts spawnGateElite`, called first by `populatePage`, places the one forced named elite `story.p3.gate.elite`, no rolled named
elite on that page). `tapGateFigure` (from `game.ts`); a lifted turnstile figure has `data-gate-seated`.

## Heroes (DESIGN 10; `src/heroes/README.md` is the folder contract)
One folder per hero `src/heroes/<id>/` exporting `hero: HeroModule` (`heroes/module.ts`): `def` (`HeroDef`, via `defineHero`/`defineSkill`), `figure`
(`HeroFigure`: drawing, wash `hue`, attack pose, `drive/build/patch`, optional `zoneParts(z)`/`summonParts(e)`), `sounds` (one recipe per skill,
`autoStart`, `ultimate`), `casts` (`Record<skillId, SkillFn>`), `pads` (one glyph per skill), `passives` (`HeroPassive`, `rule?`), `paragraphs`,
`ultimates`, `specs`, optional `quirk` (see Hero quirk hooks). `heroes/registry.ts` is the one list: `HERO_ID_LIST` (pralka, konsultant, petlowiec,
kartograf, nalesnik), `HeroId`, `HEROES`, `HERO_IDS`, `heroById(id)`, `heroDef(id)`, `DEFAULT_HERO_ID`, `isHeroId`. No hero id outside its folder
(lint `hero-id-literal`); per-hero branches are data: `HeroDef.traits` (`trialSpeed`, `seesDefects`, `revealsPage`, `skim`, `friendlyCopy`,
`buffKillGwiazdki`), `auto.lash`, `chosenNoteKey`. Casts are step lists (`heroes/cast.ts cast(i, steps)`, `CastEnv`; a step returning `false` = no
cooldown) over the primitives in `heroes/primitives/` (`dash teleport pull push aoe cone line hitscan projectile forkProjectile zone summon
removeSummon decoy statusApply buff heal shield cooldownReset deferredDamage echo stepDeferred`). Figures: `heroes/figureKit.ts`, `heroes/poseKit.ts`,
engine `render/heroFigures.ts`. Scaffold `npm run new-hero <id>` (templates `heroes/_template/*.tpl`; fills i18n, recipes, trims, an Anomalia face and
the snapshot; undo with `npm run new-hero <id> -- --remove`; `src/heroes/README.md` has the checklist). Contract test `heroes/contract.test.ts` vs
`contract.snapshot.json` replays every skill of every hero (`-u` only for an intended change; a five-skill hero's keys never change). Numbers in
`heroes/numbers.ts`, aim geometry in `heroes/aim.ts GEOMETRY`, per-step effects in `heroes/steps2.ts`; `heroes/shield.ts projectileDamageMul` (skim),
`bindNumerBonus` (an `enemy:hit` listener). The base page animates on game.ts's render clock `animMs` (no `RunState.time` there). Skills: `SkillIndex
0..10` (`heroes/defs.ts`; `HeroDef.skills` is `readonly [SkillDef x5, ...SkillDef[]]`: ask `skillAt(def, i)`, never `skills[i]`, and
`skillIndicesOf(def)`; `SKILL_INDICES` is the whole range), `PadSlot 0..2`, `SkillDef.requires?: FamilyId` (rank 1 of skills 3 and 4), `SkillDef.aim:
'auto' | 'kierunek' | 'wskazanie'`. `HeroRun.cd/cdTotal/ranks` are `Slots<number>` keyed by SkillIndex, five long until a skill past the fifth writes
(read `?? 0`); `pads: [SkillIndex x3]`; `HeroSounds.skills`, `HeroPadGlyphs` are rest tuples. Skills 0..2 are always installed, 3+ through an update
rank (`skill<i+1>`); from `LEVELLED_FROM` 5 (`progression/update.ts`) no permission, first offered at `SkillParagraphs.level`, leading the form as the
new skill (`featureOf` `skill4..skill11`, `newSkillOf` 3..10). `HeroPassive.rule: true` (passive 7) is never an update entry, always stamped on the
Karta. `heroes/loadout.ts`: `isInstalled`, `installedSkills`, `padSkill` (carries paragraph + capstone), `padOf`, `assignPad`, `fixPads`,
`effectiveSkill(s, i)` (every read of a skill's shape). `castSkill(s, bus, slot, free, aim)` -> `fire(...)` (inside `withCapstone`) -> `skill:cast`,
`HeroRun.lastCast`. Aiming (drag > 8 px shows `render/aimFx.ts`, back over the pad cancels): `heroes/aim.ts autoTarget, dragToAim, isCancel, isTap`;
the pad hands the aim through `queueAim`. Kartograf's auto is a hitscan laser (`fireLaser`, `attack:started.laser {sx, sy, ex, ey, crit, metres,
scale?}`). Paragraphs: `heroes/paragraphs.ts` (`Paragraph {n, nameKey, descKey, patch, permission?}`, at most four patch fields, `applyParagraph`,
`PARAGRAPH_STEP {2: 6, 3: 14}`; ids `para:<0..10>:<2|3>`); engine `progression/paragraphs.ts` (`paragraphsOf`, `isParagraphUnlocked`,
`unlockedParagraphs`, `setActiveParagraph`, `runParagraph`, `setRunParagraph(s, skillId, n, force?)`, `applyParagraphs`). Update form
(`progression/update.ts`): `offerVersion`, `paragraphEntries` (`para:<i>:<n>`), `pickFeature`, `composeOffer`, `confirmUpdate`, `requirementOf`,
`newSkillOf`; a new skill goes to `UpdateForm.assign` ("Przypisz do przycisku", `.assign-pad[data-pad]`, `.report.later`). Sheets: `ui/loadout.ts
openLoadout` (`.lo-row[data-skill]`, `.lo-pad[data-pad]`), `ui/konfiguracja.ts openKonfiguracja` (`.kf-box[data-n]`, `.kf-slot[data-slot=1..3|ult]`,
`.kf-spec[data-spec]`, `.kf-cap-line`, `.kf-pad[data-pad]`, `.kf-advice`), `ui/karta.ts openKarta(root, kartaModel(input), onBack)` (`.kt-col`,
`.kt-node[data-state=granted|gated|open]`, `.kt-cap`; from `[data-desk=karta]` and `[data-profile=karta]`). Argument meter (`combat/meter.ts`,
`Player.meter` 0..1, never saved): `meterGain`, `meterSpend`, `killFill(tier)`, `tickMeter`; gains and drain are `METER_*` in `balance/meter.ts`.
Ultimates (`heroes/ultimateDefs.ts defineUltimate`, `MAX_ULT_S 8`, `MAX_ULT_RADIUS 220`, `FIRST_ULTIMATE_LEVEL 12`; three per hero at levels 12 / 24 /
36; runtime `heroes/ultimate.ts` `ultimateOf, ultimateUnlocked, castUltimate, stepUltimates, setUltimateParagraph, ultimateAuto`): a quiet stamp at
`ultStampSpot` (wider than the view: set smaller, 17 down to 11), a margin note, `ultimate:cast` (`ultimateId` always set); `render/ultFx.ts` draws a
dotted `.ult-area`. `HeroSounds.ultimate` is one name or a record by ultimate id (`audio/bindings.ts ultimateSound(heroId, ultimateId)`). UI door
`ui/ultimate.ts`; the fourth pad `.pad.ult` (`.locked`, `.off`, `.ready`). Choosing: `ui/konfiguracja.ts konfiguracjaUltimates(s)` (the chosen one
keeps its paragraph row, the others a `.kf-ultpick[data-ultimate]` button once the level has come, `commitLoadout(s, {ultimate})`); `ui/karta.ts`
prints every ultimate (chosen first, `data-node=ult`). Specializations (`heroes/specDefs.ts`, `heroes/specializations.ts`): `categoryOf`,
`specializationsOf`, `activeCapstone` (chosen column with >= 2 of its skills on the pads), `setLoadout(c, {pads, ultimate, specialization|null})`,
`loadoutAdvice`; UI door `ui/konfLoadout.ts commitLoadout`.

**Hero quirk hooks** (`HeroQuirk`, each read only through its dispatcher in `heroes/quirks.ts`): `onHit`, `tick` (steps the hero's per-run record; it
has no dt, a quirk reads the run clock), `priceCut(s)` 0..1 (both Sklep checkouts: `SklepOptions.feeCut`, `economy/sklep.ts feeRateOf, feeOf, totalOf,
buy(..., cut)`), `dealtMul` (`systems/combat.ts applyDamage`, the player's blows on enemies), `enemySpeedMul` (`enemies/ai.ts`, enemy walking speed),
`racjaBracket(s)` (racja owed or null; `ui/hud.ts bracketPath`, `.racja path.bracket`), `onSkim(s, bus, from)` (`enemies/projectiles.ts` when a shot's
damage was cut; `Projectile.from` = the firing enemy). **Per-run records** live in the hero folder in a `WeakMap` keyed by the run (never in
`HeroRun`, never saved, not in the digest). `Zone.own: true` = the quirk steps that zone (`heroes/system.ts stepZones` skips it); `Zone.angle` = a
drawn line's direction. Render hooks `HeroFigure.zoneParts(z)` / `summonParts(e)` return path strings ("~" = dotted), asked by `render/heroFx.ts
zoneBuilder` / `render/heroFigures.ts summonBuilder` before the built-in branches (`appendParts`). The five filled heroes: skills 6..10 = indices
5..9, ultimates at 12 / 24 / 36, `IX` index map in each `numbers.ts`, `GEOMETRY` entries in `heroes/aim.ts`, passive 7 = the rule, recipes
`<prefix>*`, shots `scripts/shot-<id>.mjs`.

| hero | skills 6..10 | ultimates | per-run record, hooks, variants | recipes, shot |
|---|---|---|---|---|
| pralka | `plukanie program90 trybOszczedny zmianaProgramu odpompowanie` | `pelnyCykl uznanieOsobowosci reklamacja` | `running.ts tickPralka`, `syncSpeed`; fx `steam\|puddle` | `pralka*`, 4198 |
| konsultant | `zgloszenie formularz muzyka przerwaTechniczna oddzwonimy` | `przekazanie koniecKolejki ankieta` | `state.ts` + `quirk.ts`; passive 10 = `priceCut`; `Zone formularz\|stave\|nagranie`, `Summon chair\|phone`; `hook.info()` `aims`, `types` | `kons*`, 4199 |
| kartograf | `pomiar przekroj granica punktOdniesienia rozaWiatrow` | `mapaOstateczna skreslenie pomiarKontrolny` | `state.ts`, `quirk.ts` (passive 7 misnaming; Awaria `enemySpeedMul` `AWARIA_SLOW` 0.8), `hits.ts lineHit`; passive 8 = `dealtMul`; `Zone przekroj\|granica\|roza\|skreslenie`, `Summon benchmark` (`steps2.ts benchmarkNear`) | `karto*`, 4182 |
| petlowiec | `uwaga powtorzenie paradoks opoznienie zamiana` | `zebranie cofniecie przedwczesny` | `state.ts tickPetl`; `bindPetl(bus)` on `player:hit`, `enemy:hit`, `skill:cast` via `trackedRun()`; zones `paradoks\|zapis` (`own`), fx `swap`; Opóźnienie = `racjaBracket`; Cofnięcie emits `footnote:retract`; passive 7 `traits.friendlyCopy`, `NIEZGODA_AFTER_S` 2 -> `heroes.copy.argue.N` (`death/outcomes.ts ARGUE_LINES`) | `petl*`, 4181 |
| nalesnik | `krawedz pierscien zaokraglenie upadek zmianaOrbity` | `decyzjaKomisji zderzenie pelnia` (three `moon` summons, `Summon.orbit.grow`, `.knock`, `steps2.ts stepMoon`) | `state.ts`, `quirk.ts` (`beginRound/endRound`; § 3 `Player.flat` -> `projectileDamageMul` 0), `hits.ts`; Pory = `onSkim` (0.3x mechaniczny); passive 9 via `dealtMul`; `Zone pierscien\|krater\|luk` | `nales*`, 4183 |

## Items, loot, recovery, Sklep, sets, uniques (ITEMS 2–9, 12; PLAN 8)
Items: bases (`items/bases.ts`, 40, `excludeAffixes`, `odd` via `oddStats`), affixes (`items/affixes.ts`, 32, tiers I–V `modTier`, `absurd`,
`UNWANTED_FEATURES`, `randomAffixPool`; `rollAffixIds` never rolls the free-version affix), names by `items/grammar.ts` (`withRegisterMark`).
StatBlock percentages `zasieg`, `tempo`, `gwiazdki`, `proba`, read by `recomputeStats`; stars through `economy/stars.earnStars`. `items/absurd.ts
pageEntryAll` runs on `page:entered`. `disposalRefusal(item, 'sell'|'bin'|'reklamacja'|'drop')` is the guard every way of getting rid of an item must
call. Item level `items/level.ts`: `ilvlFor({planet, priority, pageIndex, pageCount, boss})` (cap 40), `shopIlvl(planet)`, `ilvlScale`,
`TIER_BASE_MUL/TIER_BUDGET/TIER_PRICE_MUL`, `listPrice`, `actualOverClaim`.
**Drops** (`systems/loot.ts`): `DROP_TIER_WEIGHTS` has five columns (`DropWeights` zwykły / nietypowy / rzadki / zestaw / unikatowy);
`rollDropColumn(rng, weights, priority, lawBonus)` -> `DropColumn` (a tier or `'zestaw'`: a `makeSetPiece` of `planetDef(planet).hostedSet`, rzadki
where none is hosted); `rollDropTier` keeps its four-column callers (teczki, `dropGuaranteed`). `dropLevel`; `LootRank = DropSource | 'named'`:
`dropLoot(s, x, y, rank, bus?)` (potwierdzenie rolled last; `DROPS.named` 12–18 gwiazdki), `dropNamedItem(s, x, y, minTier, bus?)`. `bindLoot` on
`enemy:died`: `enemies/named.claimNamedDrop` -> `dropGuaranteed`, then `rollPermission(s, 'named' | tier, family)` (`NAMED_PERMISSION_CHANCE` 1). The
planet boss's first item is a hosted set piece at `BOSS_SET_CHANCE` 35%; `RunState.sporWon` (set by `bindLoot` on `spor:answered` right) lifts it
rzadki -> piece -> unique (or the second item one tier where no set is hosted; footnote `items.loot.komisja`). Sklep `economy/sklep.ts restock(state,
seed, visit, level, planet)`: 3 low, 1 rzadki, 1 `oferta` (`SHOP_SET_CHANCE` 10% a set piece), 1 `adapter` (`Listing.kind` as `.sk-kind` stamp);
`mountSklep(..., {planet})`, `RollOptions.shop`. Elites: `ELITE_IDS` 10, `spawnElite(..., {makeNamed, pack})`, packs of 2–4, named elites
`enemies/named.ts`. Marks `render/itemMarks.ts`: `buildTierMark` (nietypowy stamp, rzadki thread, unikatowy wax seal, zestaw paperclip), `affixMarks`,
`groundMark`, `buildAffixMarks`; all black ink but the seal's red dot. `drawingSvg(id, item)`; `itemView.itemRowText`, `declaredHead`, `isStruck`.
Recovery (`systems/recovery.ts`, numbers in `balance/recovery.ts`): `takePotwierdzenie`, `useHeld(s, bus, auto?, incoming?)`, `onPlayerBlow`. HUD
`ui/hud.ts createPotwButton` (`.potw-btn`, at most two slips, `.count` from two up). Archive: `ui/archive.ts openArchive` (`.ar-sec[data-place]
.ar-cell[data-uid]`, `.ar-move[data-to]`).
**Sets** `items/sets.ts`: `SETS` (6, one per tag; `SetId`); a piece is a rzadki `Item` with `setId`, built by `items/setPieces.makeSetPiece(rng,
setId, level, index?)`. `recomputeStats` derives (never saves) `Player.sets` (`wornSetCounts`; niekompatybilny pieces do not count),
`Player.gearSpeed` (read by `systems/movement.ts`) and `Player.grants`. Two pieces: `bonus2` (+`speed2`); three: `effect3` (`hasEffect(p, effect)`)
and `skills3` patches by skill id (`setSkillPatches`; every id acts). Event effects `items/setFx.ts bindSetEffects` (from `items/install.ts`): Obieg
on `enemy:rebutted`, Serwis on `enemy:hit` + `skill:cast`, Awaria re-roll on `page:entered` -> `Item.rollMul`; `onSetHurt` from
`enemies/hooks.onEnemyHurt`. Awaria's "the rule passive doubles" is read in place (quirks, `heroes/shield.projectileDamageMul`,
`items/reviews.trialMultiplier`, `death/outcomes.applyPetla`). **Uniques** `items/uniques.ts`: `UniqueDef.grant {skill, para, ranks}` names a skill
id, never a hero; `grantsOf(equipment)`, `grantOfItem`. A fill must keep these skill ids or remap `UNIQUES`: program95 `wirowanie` §3, pralnia
`pranieWstepne` §2, oczekiwanie `prosze` §3, windykacja `rozlaczenie` §3, przedwykonaniem `spor` §2, zapasowe `przybycie` §2, granica `triangulacja`
§3, bladpomiaru `korekta` §2, masaplanety `grawitacja` §2, atmosfera `zaokraglenie` §3. `heroes/grants.ts`: **every skill read goes through `rankOf(s,
i)`** (update + item ranks, may exceed 3; a worn grant installs its skill) **and `patchAt(s, i)`** (run paragraph, a higher carried one, set patches
laid on); `paragraphAt`, `heroOfSkill`, `layPatch`. Never read `s.hero.ranks`/`s.hero.patch` directly in a skill.
**Przesyłka** `items/delivery.ts`: `Awizo {n, item, page, age, seed?, komisja?}` in `Player.awizos` (saved as `Character.awizos`, carried by
`world/tunnel.ts carryPurse`). `sendByPost(s, bus, rng, item)` (from `dropLoot`, never a boss): a set piece or unique always, a rzadki at
`RZADKI_AWIZO_CHANCE` 30% (then `items/generate.ts freeVersionOf`, `P_FREE`: the only free-version channel), max one per page; `page` =
`paczkomatPage(s)` (kiosk page ahead, else 0 = base). `tickDelivery(s, bus, dt)` (from `updateLoot`): near the kiosk (`CODE_REACH`, `CODE_DELAY`) the
item enters the bag (`CODE_KEEP`). `bindDelivery`: `run:ended` -> `settleAwizos` (to the base; back to the sender after `AWIZO_RUNS_AT_BASE` 2);
`run:started` with another seed moves a given-up ticket's awizos to the base. `claimAwizo(p, n)` (`PACZKOMAT_FEE` 15). `QuestReward.item` (`{unique}`
or `{set, piece?}`): `completeQuest` -> `sendReward` -> an awizo at the base with `komisja`. UI `ui/paczkomat.ts awizoCard(a)` (also on the Załączniki
sheet), `openPaczkomat(root, host)`; sheet kind `paczkomat`. `highestNumber` counts awizo items.
**Reklamacja** `economy/reklamacja.ts`: `reclaim(purse, item, planet)`, `reclaimRefusal`, `reklamacjaCost` (`TIER_PRICE_MUL`, a set piece
`ZESTAW_PRICE_MUL` 10), `rerollable`, `reklamacjaWords`; `Item.reklamacje[{planet, struck, typed, mod}]`; roll
`createRng(item.uid).fork('reklamacja:<times>')`, `Item.modTier` stays. Refused: uniques, wycofany, set fixed lines, absurd / free / unwanted lines,
trial period. UI: the Reklamacja section of `ui/sklep.ts` (a refused row: reason, no button). **Bin** `economy/kosz.ts`: `binItem(p, item)`
(`BIN_SHARE` 10% of `itemValue`), `needsAsk` (rzadki and up ask once on the Załączniki sheet's one-line form).

## Campaign, page content, quests (PLAN 3, 7, 8)
`world/campaign.ts` owns the priorities (`PRIORITIES`, `PRIORITY_IDS`, `DEFAULT_PRIORITY`, `priorityUnlocked`, `availablePriorities`, `clampPriority`;
unlock 1/1/8/18), the nine planets (`PLANETS`, `planetDef(i)`; `planets.pN.name|loc` is the only planet-name source), `CampaignState {current, closed,
finalTicket, caseClosed, extras, cards?}` and the plans (`nextCampaignPlan`, `extraPlan`, `travelList`, `travelPlan`, `defaultPlan`, `closeTicket`,
`toCampaign`, `toPlan`, `toCardsSeen`), `CAMPAIGN_LAST` 3 (the return ticket follows planet 3; `extraPlan` and `travelList` stop there; a case closed
shorter is reopened by `toCampaign`, `CampaignState.reopened?`, SEAM: no card shows it yet, S24), `headlineOf(i)`, `lawForPlanet(i, seed, first)`
(`PlanetDef.headline`, else `lawPool`). `TicketPlan {kind: campaign|final|extra|travel, planet, priority, lawId}`; `createRun(seed, {plan})` uses
`world/ticket.ts ticketForPlan`; enemies scale by `planScale(s.plan)`, xp by `xpMul`, loot by `lootTierBonus`, `starMul`, `ilvlBonus`; no plan =
neutral. main.ts `enterBase(over)` picks the plan (over -> held -> bookmark -> `defaultPlan`) and shows the card (`ui/ticketModel.cardToShow`);
`acceptNow(priority)`; ticket form `ui/ticket.ts open(info, {level, view})` (`onAccept`, `onTravel`, `onExtra` -> `takePlan`). `bindCampaign(bus, ()
=> game.state)` is bound after `bindTunnel` and before main's `run:ended`; `settleCampaign` once per plan object. Cards `ui/cards.ts openCard(root,
{kind: opening|chapter|rewritten|finale, planetIndex}, {number, onDone})` (`.card-layer[data-card]`, `.card-skip`); `finale` once per character
(`CardsSeen.finale`). Page content: `world/contentKinds.ts` (`SEALS` six, `CONTENT`, `paragraphsFree(buffs)`, `waivePrice(patch)`), `world/content.ts`
(`contentPre`, `tickContent`, `grantSeal`, `activeBuffs`, `effectsOf`); `pages.placeContent` (never page 1 or the boss page); `bindContent(bus,
getState)` bound once at boot; `render/obstacles.redrawContent`. Quests `world/quests.ts`: `QuestState {active, done, log}`, kinds
kill/fetch/reach/deliver, max 3, `offersFor`, `takeQuest/dropQuest/completeQuest/visitClerk`, `bindQuests`, `questPlanet(s)`. NPC `world/npc.ts
npcAt/registerNpc`, `render/npc.ts drawNpc`, `ui/npcSheet.ts`; `ui/karta-osobowa.ts openKartaOsobowa` (desk line and the HUD `.field.rep`).
**Planet modules** (`world/planets/`, imported once by `main.ts` and the tests that need them): `pN.ts` registers the clerk (`registerNpc`), side
tickets `h:pN:*` (`registerSideTickets`) and the boss variant (`enemies/bosses.ts registerBossVariant(planet, {..., attackRange?, arm?: 'stapler'})`,
`bossVariantOf`, `bossVariantLine`, `bossVariantArm`; drawn by `render/enemyFigures.ts`); the planet's record stays in `world/campaign.ts`.
`combat/spor.ts STORY_ANSWERS[planet]`, `storyEntry`, `promptFor(..., planet?)`. `storyKeys.ts hasStory(path)`. Locations
(`world/planets/locations.ts`): `LOCATIONS` (przedmiescie, magazyn, serwerownia, biuro), `LocationSpec {layout: rows|aisles|corridors|rooms, wall?,
wallSide?, row?, props}`, `locationSpec`, `propSpec`, `propColliders`. `world/pages.ts`: obstacle kind `prop` (`Obstacle.variant` = prop id),
`Page.location?`, `pickLocations/generateRunPages(rng, count, locations?, split?)` (`PlanetDef.locationSplit`: a number or an array of cuts, cut k ->
`locations[k]`), `base.ts generateBase(seed, planet?)` from `PlanetDef.baseLayouts`. Drawings: `render/locations/` (one file per location type,
`registerDrawings(type, {id: PropDrawer})`, `drawProp`, `drawingsOf`; generic blot fallback). `CardOptions.heroId?` picks the hero's story lines.

## Narration (`narration/asystent.ts`)
One narrator per ticket (seed + number; `base:entered` for a new ticket starts it and writes the arrival note once; footnote numbers likewise,
`main.ts notesFor`); it ticks on the walkable screen, not under sheets. 1 in 8 notes is wrong and corrected 10–20 s later by number. On-ramp
(`narration/onramp.ts`, bound inside `bindAsystent` when `AsystentDeps.firstTicket()` = `meta.history.length === 0`): `bindOnramp(bus, {say, getState,
firstTicket}) -> {tick(dt), said}`; steps `ONRAMP_STEPS` `walk`, `attack` (first player `attack:started`), `rebut`, `update` (`update:ready`), `potw`
(`recovery:taken`); each once, never wrong; text `narration.onramp.*`.

## Balance (`src/balance/`, no imports from the game)
One numbers file per domain, re-exported under the same names by their readers: `recovery.ts` (`POTWIERDZENIE_DROP`, `HELD_CAP`, `HEAL_SHARE`,
`AUTO_FLOOR`, `VACUUM_RADIUS`, `REGEN_*`), `meter.ts` (`METER_*`), `loot.ts` (`DROPS`, `DROP_TIER_WEIGHTS`, `PRIORITY_TIER_SHIFT`,
`PRIORITY_STAR_MUL`, `BOSS_UNIQUE_CHANCE`, `TIER_BASE_MUL/BUDGET/PRICE_MUL`, `QUEST_STARS`), `campaign.ts` (`PRIORITY_ROWS` [hp, dmg, tierShift,
eliteMul, xp, stars, lootTier, ilvl], `PLANET_HP_GROWTH`, `PLANET_DMG_GROWTH`). Change a number here, never at the reader; `balance.test.ts` checks
the orderings, and `world/campaign.test.ts` keeps planet 1 Normalny neutral.

## Render, controls, layout (DESIGN 2)
`views.sync(entities, timeMs, {drawIn?})` creates one `<g data-id>` per entity and patches only `transform` and a few attributes. Layers: `#page`
(paper, obstacles incl. inked obstacle blots, header, exit, holes, stations; no filter) -> `#world` (entities; wobble filter re-seeded every 500 ms)
-> `#fx` (blots, strikes, stamps, margin notes) -> `#ui`. `render/bindings.ts bindFx(bus, views, page, view, damageNumbers, blocks)`: hit blots
(`blot`, pool of 20), strikes on death, the "margines" note at `marginSpot(side, x, y, page)`, stamps at `placeStamp(x, y, w, h, view, away?, blocks)`
inside `freeViewRect(camera, 'stamp')` and 80 units off `away`. Ink: `drawIn, eraseOut, strike, blot, stamp, marginNote, tapMark` (`render/ink.ts`);
`.t-note` margin notes and the pad words  carry a paper halo. Paint only via `render/wash.ts washGroup`. No gradients, glow, shadows; red only for
stamps, strikes, Racja, handwritten corrections. `stampsOnPage()` counts fx stamps until they fade. Headers: `obstacles.ts
drawHeader/headerBox/wrapLines`; `headerFor(s, view?)`, `baseHeaderFor(s, frame?)` take `headerFrame(camera)` = `{view?: portraitSpan, avoid?:
headerKeepOut}`. Camera (`render/camera.ts`): at least 390 wide, 700 tall in portrait, 520 in landscape; `bounds` follow the page shown;
`readableUnits(units, minPx=11)` for world text. Claim bubbles (`render/bubbleFocus.ts`, from game.ts render): `pickBubbles` shows at most `BUBBLE_CAP
2` (bosses, elites, nearest within 260), none while `stampsOnPage() > 0`; hidden ones stay in the DOM; shown ones are moved by `avoidBoxes` inside
`freeViewRect(camera)`, off `keepOutBlocks(camera)`, `heroBox(p)` (`HERO_BOX`) and `bubblePlaced`. Keep-out (`render/keepOut.ts`, measured by
`ui/keepOut.ts watchLayout(ui)`): `screenLayout()` = `{w, h, top, bottom, blocks, row}` in css px from the DOM. Re-measured lazily on layout change.
Never fixed pixels outside the fallback insets in camera.ts. `render/attackFx.ts` turns `attack:started` into transform-only poses;
`render/damageNumbers.ts` (setting, pool of 10). Sheets share `ui/sheet.ts` (`createSheet`, the `c.d. poniżej` cue `runsOn/cutEdge`, also under the
settings form `.set-more`; `guardGhostClicks` with the pure `isGhostOf`). Every `#ui` button >= 44 x 44 css px.
**Controls**: `ui/layout.ts` sets `data-orient` and `data-steer` on `<html>`; landscape and joystick rules live in `ui/landscape.css`. `input.ts`:
`held()` (tap mode), `steer()` (joystick), `setEnabled`, `setMode`, `setLeftHanded`, `inject`. Joystick: a quick tap calls `onTap(x, y, false)`. Pads
and notes act on `pointerdown`. HUD notes Pauza/Tunel/Potw. (`ui/{pause,tunnel,potw}.css`): 48 x 48 paper-filled circled words in 56 px slots,
mirrored when left-handed. Settings (`Settings`, kept by `migrate` only when not default): theme, hand, orientation, steering, volumes, `textSize?:
0|1|2` (`--ts` zoom, `ui/textsize.css`), `damageNumbers?: true`, `bugButton?: false`.

## Audio (`audio/`, DESIGN 14) and i18n
Web Audio only, synthesized; `audio/bindings.ts` is the one place events meet sounds; nothing exists before the first gesture; errors are swallowed.
Music flags (`deriveFlags`): enemiesNear, elite, boss, botTime, `paused`, reversed, suspended, dead, pageTurn, `base` (calm layer, 6 dB down). Music
runs from `run:started` to `run:ended` and in the base. Hero sounds from `heroById(id).sounds`; ultimates `pralkaUlt, konsUlt, petlUlt, kartoUlt,
nalesUlt`; `recovery:taken` -> `paperSlide`; Spór posted -> `footnote`, right -> `strikeThrough` + `stamp`, wrong -> `paperTear`. `npm run
render-audio`.
**i18n**: `t('domain.key', params)`; `src/i18n/pl/<domain>.json` (file name = prefix; heroes in `pl/heroes/<id>.json`). Plurals `{one, few, many}`.
One-letter words are bound to the next with U+00A0 by `t()`. No user-facing strings in `.ts`.

## Test hook and scripts
`window.__game`: `start(seed, opts)`, `go`, `state`, `meta/setMeta`, `screen`, `advance(s)`, `turnTo(page)`, `attack`, `hitEnemy`, `killEnemy`,
`hurtPlayer`, `placePlayer`, `snapshot`, `footnote(text)`, `notes()`, `giveItem`, `giveNamed({set, piece}|{unique}, {wear, ground})`,
`recomputeStats`, `giveAwizo`, `awizos`, `endRun`, `renameItem`, `demoInventory`, `openInventory`, `openSklep`, `openKiosk`, `setTheme`,
`setOrientation`, `setSteering`, `setLeftHanded`, `setSettings(patch)`, `controls`, `dropPotwierdzenie(dist)`, `heldPotwierdzenia`,
`setHeldPotwierdzenia(n)`, `usePotwierdzenie`, `exportArchive()`, `importArchive(text)`, `joystick(dx, dy)`, `pause`, `resume`, `endTicket`,
`resumeTicket`, `character`, `startBase(seed?)`, `station(name)`, `acceptTicket`, `walkToExit`, `gate.{set(kind, opts), info, approach, push(s)}`,
`openTunnel`, `enterTunnel`, `returnFromTunnel`, `tapUltimate`, `ultimatePad() {ready, off, inked, hidden}`, `keepOut()`, `setLevel(n)`,
`fillMeter(v=1)`, `setMeterUi(v)`, `castUltimate`, `ultimateInfo()`, `setSpecialization(id|null)`, `loadoutInfo()`, `aimCast`, `holdPad`,
`releasePad`, `itemGallery(mode)`, `setCampaignView(v|null)`, `showCard(kind)`, `priority()`, `spor.{answer, info}`, `finale.{start(heroId?, opts),
info, skipTo}`, `hero.{cast(slot, aim?), installSkill, openAssign, assignPad, setParagraph(skillId, n, force=true), info, levelUp, grantXp,
requestUpdate, openUpdate, pickUpdate, die, givePermission}`, `enemies.{spawnFamily, spawnBoss, spawnPack, spawnNamed, hit, clear, list}`,
`content.{list, put(kind, {seal, dist, dy}), tap, open, seal, buffs}`, `quests.{offers, active, accept(idOrKind), drop, finish, report, happen,
done}`, `audio.{renderProfile, renderSfx, music, contextState}`. DOM hooks: `[data-pause=...]`, `[data-desk=...]`,
`[data-roster=new|open|karta|remove|back]`, `.rs-case[data-case] [data-hero]`, `[data-profile=name|karta]`, `.card-skip`, `.spor-reply[data-reply]`.
`npm run check` = typecheck, vitest, `lint:rules`, build. `npm run shot`: 390x844 @2x and 844x390 into `shots/` (`SHOT_PORT`, `SHOT_OUT`). Per-domain
shots `scripts/shot-<name>.mjs` (SHOT_PORT/SHOT_OUT/SHOT_DIR in each header; port as in its usage line): base 4189, tunnel 4188, pause 4187, attacks
4186, enemies 4181, heroes 4183, items 4182, aim 4195, skills 4197, loadout 4198, s2 4182, s3 4183, s4 4184, s5 4185, recovery 4176, s6 4186, s7 4187,
s8 4182, elite-packs 4188, s10-content 4183, s10-quests 4188, s12 4192, s13 4193, s14 4194, s15 4194, s15-faces 4195, spor 4199, sets 4196, reklamacja
4197, the five heroes (table above). Port 4190 is a blocked port of the fetch standard: Node `fetch` refuses it, so `e2e:m4` probes readiness with
`node:http`; other scripts must use another port. `npm run smoke` (`SMOKE_PORT` 4191) plays a ticket with real buttons through every screen and system
(legs listed in its header; 6e3 casts every ultimate in § 1–3, 6e5 the Pory skim, 6k Reklamacja), then 5 s of frame times with 40 enemies
(`PERF_MAX_MS`, `SMOKE_UNCAPPED`). Milestone gates: `npm run e2e:m1` (`M1_PORT` 4177: every hero x orientation, loadout, ultimate); `e2e:m2`
(`M2_PORT` 4192, `M2_ONLY`: campaign at Niski, cards, teczka, packs, named elites, side ticket, finale, free travel, reload, perf); `e2e:m3`
(`M3_PORT` 4189, `M3_OUT`, `M3_DIR`, `M3_ONLY` portrait|landscape|pralka|kartograf: Akt I from a fresh profile through both gates, bosses, Spór, the
return card, the Anomalia, case closed, reload, perf); `e2e:m4` (`scripts/e2e-milestone-4.mjs`, `M4_PORT` 4190, `M4_OUT` dist-m4, `M4_DIR` shots-m4,
`M4_ONLY` portrait|landscape|heroes|depth|<hero id>, `PERF_MAX_MS`: every hero's every skill and ultimate in each paragraph, a 2- and 3-piece set, a
Reklamacja, an archive transfer across case files and a reload, perf). All exit 1 on a failed check or page error. `npm run balance`
(`scripts/balance-report.mjs`, `BAL_PORT` 4197, `BAL_OUT`): a bot plays fresh files per hero in parallel and prints a table; env `BAL_RUNS` (6; 20 =
full), `BAL_HEROES`, `BAL_PLANET` (0-based), `BAL_PRIORITY`, `BAL_LEVEL`, `BAL_MODE=finale`, `BAL_AIM=auto|nearest|claim`, `BAL_LOADOUT=<ids>`,
`BAL_SEED`, `BAL_JSON`, `BAL_VERBOSE`, `BAL_TRACE`.

## Spór (DESIGN 5.4; `combat/spor.ts`) and the Anomalia (STORY 3, 8.4; `enemies/anomalia/`)
`RunState.spor?: {prompt, bossId, phase, ttl, window, answered}`; `SPOR_TTL_S 12`, `SPOR_WINDOW_S 5`, `SPOR_WRONG_COST 0.1`; `promptFor(boss, phase,
rng)`, `postSpor` (from `enemies/bosses.ts tickBoss`: phase 1 at `rt.sporAt`, phase 2 with `boss:phase`), `answerSpor(s, bus, index)`, `tickSpor`,
`sporMul(s, defenderId)`. Keys `enemies.boss.<boss>.spor<1|2>.*`. UI `ui/spor.ts`: three `.spor-reply[data-reply]` by the footnote slip; the boss's
`.bubble.comment` in enemyFigures.
**Anomalia**: `TicketPlan.kind 'final'`: one page, `world/finale.ts finalePage(seed)` (no exit, no waves; `render/finale.ts`); `populatePage` ->
`startFinale` -> `core.ts beginFinale`; `tickBoss` calls `tickAnomalia` first. Each stage is its own body (`bodies.ts makeBody/swapBody`; the old one
ends by an `enemy:died` of tier common, no loot, `isRetired`; `boss:phase` on each change). Phases `phase1.ts` (footnote duel, `footnote
{correction}`), 2 (the hero's face), `phase3.ts` (at racja 1 `killEnemy`, unique from `finalUnique`), `run:ended ukonczono` 2.8 s later
(`settleCampaign`), main reprints `story.finale.footnote` on the base (> `ui/footnotes LONG_NOTE` grows the slip). Spór: one comment per stage via
`combat/spor.ts postPromptSpor(s, bus, boss, phase, prompt)`. Hits: `hooks.modifyDamage` -> `gate.ts anomaliaHit` (none below racja 1; phase 2 x
`face.damageMul` at `bodyPoint`; phase 3 not divided by existence); `state.ts FACE_END_FRACTION` 0.4. Faces: `AnomaliaFace {heroId, sporAnswer, start,
tick, damageMul(s,e,x,y), done, stop, figure, parts?(e)}` (`index.ts`; `parts` drawn by `render/enemyFigures.ts`), `registerFace`, `faceFor`,
`faceKeys`; one per hero in `faces/<face>.ts`, state in a WeakMap per enemy, text `story.finale.face.<hero>.*`. **Boot order**: only `game.ts` imports
`register.ts` (fills the lookup in `state.ts`); everything else reads faces through `state.ts` (`faceOf`, `faceDrawing`, `facePartsOf`,
`captionKeyOf`, `wearsOwnBody`); lint `anomalia-boot-order` rejects a value import of `anomalia/index|register|faces/*` elsewhere.
