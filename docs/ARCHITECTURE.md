# Architecture (the contract builders code against)

Plain data, pure functions, one thin render layer. One `<svg id="stage">` plus an HTML overlay `<div id="ui">`;
`window.__game` drives it from tests, shots and the smoke script. Folder READMEs in `src/*/` say what each domain owns.
Fonts: Michroma (titles, stamps), Space Mono (HUD, forms), EB Garamond (narration, footnotes). Damage types:
`mechaniczny | regulaminowy | egzystencjalny`. Folded through M2 (S1–S10); a new slice adds its section at the end and the
integrator folds it at the milestone end.

## Screens, phases, state
Router (`main.ts`): title -> profile (the roster, or the creation form when there is no case file) -> **`baza`** (the
walkable base page of a planet) -> **`run`** -> `baza`. The desk, ticket, Sklep, board, archive and settings are sheets over
the base page (`openSheet`, one history entry), not screens; cards (`ui/cards.ts`) are modal layers.
`RunState` (`world/run.ts`, `createRun(seed, opts)`) is the one live state; `phase: 'base' | 'run'`. The base is the same
object as the run it becomes: `createRun(seed, {phase: 'base'})` holds `page` = the base page (900 x 700,
`world/base.ts generateBase`), `base` (`BaseState`: layout, accepted, resume bookmark) and `pageIndex` = the run page the
exit leads to. Walking through the exit (always open; `world/pageTurn.ts enterPage` -> `beginRun`) flips the phase, deletes
`base`, starts the clock and emits `run:started`. In the base: no clock, laws, spawns, fights, bookmark or `heroStep`
(`heroBaseStep` only cools the pads and opens a queued update the HUD line asked for; `castSkill` ignores the pads). While
a tunnel holds a run, that RunState waits in `hold` (`createRunHold`, never copied) and a second, base-phase RunState is
live; `Game.adopt(held)` makes the held one live again (page redrawn, entities synced with no draw-in).
Other fields: four rng streams (`ai combat loot spawn`; every roll goes through them), `time`, `status` (`running |
paused | dead`; sheets and forms use `paused`), `modal` (law sheets), `turning`, `pages` (`Page.content?`: teczki, seal,
event), `player`, `enemies projectiles pickups summons zones`, `law`, `hero` (`heroes/state.ts`), `victoryAt`, `tunnel?`,
`spor?`, `plan?` (`TicketPlan`), `mix`, `campaign?` (`CampaignState`), `quests?` (`QuestState`, saved with the character),
`buffs?` (`ActiveBuff[]`, seal stamps, run only, never saved).
`MetaState` (`save/save.ts`, SAVE_VERSION 3, localStorage `zgloszenie.meta`): settings, `stamps`, `runsCompleted`, the
roster `characters: CharacterRecord[]` (`{id, name, character, bookmark?, history, archive}`), `sharedArchive`,
`activeCharacterId?`. The active record is **mirrored** at the top level (`character` (`save/character.ts`), `bookmark`
(`save/bookmark.ts`: ticketNumber, seed, pageIndex, lawId, clockS, planetName, pageCount, `plan?`), `history`, `heroId`);
`syncActive` folds the mirror into its record, `withMirror` the reverse, `toStored` is what storage and the archive file
get. `migrate` reads v3 and v2 (a roster of one; the S5 archive too); loading never throws. `Character` carries level,
upgrades, gear, bag, purse, `potwierdzenia`, `pads`, `paragraphs?`, `ultimate?`, `specialization?`, `ultParagraph?`,
`campaign?`, quests.
Roster (`save/roster.ts`, pure: meta in, `{ok, meta}` out; the caller writes): `createCharacter(meta, heroId, name='')`
(`'hero' | 'full' | 'duplicate'`), `selectCharacter`, `deleteCharacter` (shared archive stays), `moveItem(meta, {zone,
index}, to)` (`Zone = 'bag' | 'personal' | 'shared'`, caps 20/40/40; `'noCharacter' | 'missing' | 'full' | 'same'`),
`rosterOf`, `activeRecord`, `itemsIn`, `zoneCap`, `cleanName`, `nextCaseName`; `MAX_CHARACTERS 8`, `ARCHIVE_CAP 40`,
`NAME_MAX 24`. `ui/rosterStore.ts` is the only UI file on that API (codes -> `ui/rosterModel.ts errorText`). `go('profile')`
first runs `settleForRoster()` (a held run is settled like Zakończ; a live base/run writes its character), so nothing live
is mirrored into another file.

**Entity kinds** (`entities/types.ts`, all `{kind, id, x, y, r}`): `player`, `enemy` (family, tier, claim, defect, elite,
boss, runtime bag `rtOf()`: `affixes, packOf, packSize, named, age`), `projectile`, `pickup` (item plate, gwiazdki star,
permission card, or `potwierdzenie` slip), `summon` (copy, decoy, ghost, `moon`), `zone` (`teren`, `hourglass`, `wniosek`,
`legenda`, `start`, `numer`). Radii match the drawing (`ENEMY_SCALE` 1.2, `HERO_SCALE` 1.15, `CARD_SCALE` 1.3). Adding a
kind: type + factory, array on `RunState`, a `Builder` (`create`, `patch`, `drawInMs`), a case in `render/view.ts`.

## Loop and systems
`core/loop.ts`: fixed 60 Hz `update`, rAF `render`, `loop.after()` timers (never `setTimeout`), `pause()/resume()`,
`freeze(ms)` (hit-stop). `systems/step.ts` order (run phase): `contentPre`, law pre, statuses, `movePlayer`, enemy AI,
`playerAttacks` + `enemiesAttack` (skipped in bot hours), `heroStep`, `collectPickups`, `updateLoot` (with `tickRecovery`),
`tickContent`, `trickleSpawn`, law post, `tickLaw`, `tickPageTurn`, `tickTunnel`. Base phase: `movePlayer`, `heroBaseStep`,
`tickBase`, `tickTunnel`.
`systems/combat.ts applyDamage(s, bus, defender, amount, crit, type?, credit = true)` is the only place racja changes
(claims, existence, zgloszony and Spór via `enemies/hooks.ts modifyDamage`, then death); pass `type` always; `credit =
false` for a blow that is not the player's (no meter). A blow on the player calls `systems/recovery.ts onPlayerBlow` first;
`items/stats.ts wearerDefence(p, combat rng)` is the defender block of every hit on the player. Formula in `combat/damage.ts`.
Update queue (`progression/queue.ts`): a level up only queues (`pendingLevels++`, margin note, HUD line); the form opens on a
calm page (no enemy within 320 for 1.5 s), a page turn or the HUD tap, never with a live boss, a sheet up, or after the boss
fell (`canOpenUpdate`). In the base only the HUD tap opens it.

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
- Flow: `screen:changed {screen}`, `base:entered {layout, seed, number}`, `station:opened {station}` (biurko, kiosk,
  tablica, paczkomat, urzednik), `ticket:accepted`, `run:started {seed}`, `page:entered {index, count}`, `page:turn {from,
  to}`, `page:edge {x, y, side}`, `run:ended {outcome}` (exactly once per run; main files it and goes to `baza`),
  `game:paused {paused}`, `run:bookmarked {pageIndex}`.
- Tunnel: `tunnel:opened {x, y, pageIndex}`, `tunnel:entered`, `tunnel:returned`, `tunnel:closed {reason: return |
  second | death | end | page}` (the first three are taped).
- Combat: `attack:started {attackerId, attacker, x, y, tx, ty, ranged, laser?}`, `player:hit`, `enemy:hit|miss`,
  `enemy:died {id, x, y, tier?, family?}`, `boss:died`, `boss:phase`, `enemy:rebutted|offTopic|escalated`.
- Spór: `spor:posted {id, phase, commentKey, replies}`, `spor:answered {id, index, right}`, `spor:closed {id, reason:
  answered | expired | died}`.
- Hero: `skill:cast {slot, skill, free, aim}`, `ultimate:cast {heroId, ultimateId, x, y}`, `skill:fx {kind, x, y, x2, y2,
  r}`, `summon:expired`, `player:levelup`, `update:ready`, `player:died`, `player:unsuspended`.
- Presentation: `footnote {text}`, `footnote:added {n, text, correction}`, `stamp {text, x, y, quiet?, away?}` (`quiet`:
  audio plays no thud; `away`: a point it must not cover), `margin:note {text, x, y, ttl?}`, `law:trigger`, `law:ask`,
  `pickup:taken`.
- Campaign: `campaign:advanced {from, to, finale}`, `case:closed` (both from `settleCampaign` on `run:ended 'ukonczono'`).
- Elites: `elite:named {id, x, y, name}`, `elite:slain {id, x, y, name, minTier}` (no sound yet).
- Recovery: `recovery:taken {healed, held}` (0 healed = kept), `recovery:used {auto, healed, held}`.
- Page content: `content:opened {kind, id, x, y}`, `content:sealed {seal, x, y}`, `content:event {event, id, phase, x, y}`,
  `content:changed {id}`. Quests: `quest:changed {id, what: accepted|progress|ready|done|dropped}`.
- `Bus.recent(n = 10)`: the last events (ring of 40, minus `skill:aim`, `player:tap`, `enemy:miss`, `attack:started`) as
  text, for the bug dump.

## The base page, stations, the tunnel, pause and save (DESIGN 4.1)
`world/base.ts`: three layouts from the seed, stations (`tapStation`, `stationReached`), `tickBase` (the exit is never locked:
it emits `base:exit`, then `page:turn`), `acceptTicket(s, bookmark?)` (re-accepts the plan / points the exit at a bookmark; no
`accepted` flag), `bookmarkAllowed`, `arrivalKey`. The base is entered with the plan already open at the last chosen priority
(default Normalny); a saved bookmark is the destination of the exit (`createRun(..., {phase:'base', resume})` sets `pageIndex`),
the desk shows "zgłoszenie otwarto z urzędu" and "Nowe zgłoszenie" (asks, drops the bookmark). The ticket form only changes
priority (re-accepts), free travel and extras (`takePlan` re-lays the base). `main.ts` settles a run held in the tunnel on
`base:exit`. **Page gates** (`world/gate.ts`): `Page.gate?: PageGate {kind: boss|teczka|quest, id?, need?, key?}` (from
`PlanetDef.gates`, none yet; fixture `__game.gate.*`) adds an obstacle of kind `gate` (an inked arc of colliders over the exit
corner, `render/obstacles.ts drawGate/redrawGate`); `tickPageTurn` calls `stepGate` (lifts when the condition holds, writes
`screens.base.gate.<kind>` as a footnote near the corner); `bindGates` opens a boss gate on `boss:died`. Stations open on a tap on their
drawing or label (`Game.onTap` emits `station:opened`; targets >= 44 css px at any zoom); walking into them does nothing.
`render/stations.ts drawBase` returns `BaseView {frame(s), unlock(header)}`; `game.ts` passes `planet: questPlanet(s)`.
HUD in the base: the page field reads "Baza" + the layout word, Tunel and Potw. notes and skill pads hidden
(`.pads.in-base`). Opening a station sheet (`holdBase`) disables input, `releaseBase` re-enables it. Board
(`ui/board.ts open(meta, quests?)`): announcements, the quest block, ticket history. Desk lines `[data-desk=...]`:
Nowe/Wznów zgłoszenie, `roster`, `karta`, `konfiguracja`, `osobowa`, `archiwum`, `export|import`. Settings live only in the
pause sheet (`go('settings')` opens pause + settings).
`world/tunnel.ts`: pure `planOpen, stepTunnel, isOnHole, closeFor, fateOfHeldRun, createRunHold, carryPurse`, thin
`openTunnel, closeTunnel, tickTunnel, bindTunnel, cutBaseHole`. Entering holds the exact RunState and shows the base with
the hole; returning (`returnFromTunnel`) adopts it, calls `tunnelFx.restore(pageIndex)` and `show(...)`, resumes and tapes
the hole. Starting another ticket, resuming the bookmark or changing the file settles the held run.
`render/tunnelFx.ts bindTunnelFx(bus, {page, pageWidth})` -> unbind + `show(x, y, animate?, page?)`, `restore`, `tapes`.
Pause: `Game.pause()/resume()` hold the same state (status `paused`, input off, `Loop.pause()`); lines `[data-pause=resume|
settings|skills|paragraphs|report|end]` (report hidden by `bugButton: false`; end in the run only); a 3-column grid in
landscape. Android back: `popstate` in a run toggles the pause sheet. Save: `save/autosave.ts` writes the character on
`page:entered`, `game:paused`, Zakończ, `run:ended`, hidden tab; `settleRun` files the ticket and clears the bookmark;
resuming regenerates the bookmarked page (`createRun(seed, {character, resume})`). Save safety (`save/export.ts`):
`requestPersistence()` on boot; archive `{kind: 'zgloszenie-archiwum', format 1, version, exportedAt, meta}` (an export of
an import is byte-identical); `parseArchive(text)` -> `{ok, meta}` | `{ok: false, reason: parse | kind | newer}`;
`describeMeta` feeds the confirmation; `main.ts importSave` replaces the save and reprints the base. Bug dump: `bugDump({meta,
bus, planet, page, total, device})` -> `copyText` -> a footnote on the pause sheet (`PauseSheet.note`).

## Heroes (DESIGN 10; `src/heroes/README.md` is the folder contract)
One folder per hero `src/heroes/<id>/` exporting `hero: HeroModule` (`heroes/module.ts`): `def` (`HeroDef`, via
`defineHero`/`defineSkill`), `figure` (`HeroFigure`: drawing, wash `hue`, attack pose, `drive/build/patch`), `sounds` (five
recipe names, `autoStart`, `ultimate`), `casts` (`Record<skillId, SkillFn>`), `pads` (five glyphs), `passives` (six
`HeroPassive`), `paragraphs`, `ultimates`, `specs`, optional `quirk` (`onHit`, `tick`). `heroes/registry.ts` is the one list:
`HERO_ID_LIST` (pralka, konsultant, petlowiec, kartograf, nalesnik), `HeroId`, `HEROES`, `HERO_IDS`, `heroById(id)`,
`heroDef(id)`, `DEFAULT_HERO_ID`, `isHeroId`. No hero id outside its folder (lint `hero-id-literal`); per-hero branches are
data: `HeroDef.traits` (`trialSpeed`, `seesDefects`, `revealsPage`, `skim`, `friendlyCopy`, `buffKillGwiazdki`),
`auto.lash`, `chosenNoteKey`. Casts are step lists (`heroes/cast.ts cast(i, steps)`, `CastEnv`; a step returning `false` =
no cooldown) over the primitives in `heroes/primitives/` (`dash teleport pull push aoe cone line hitscan projectile
forkProjectile zone summon removeSummon decoy statusApply buff heal shield cooldownReset deferredDamage echo stepDeferred`).
Figures: `heroes/figureKit.ts`, `heroes/poseKit.ts`, engine `render/heroFigures.ts`. Scaffold `npm run new-hero <id>`
(templates `heroes/_template/*.tpl`). Contract test `heroes/contract.test.ts` against `contract.snapshot.json`
(`npx vitest run -u src/heroes/contract.test.ts` only for an intended change). Numbers in `heroes/numbers.ts`, aim
geometry in `heroes/aim.ts GEOMETRY`, per-step effects in `heroes/steps2.ts`; `heroes/shield.ts projectileDamageMul` (skim),
`bindNumerBonus` (an `enemy:hit` listener). The base page animates on game.ts's render clock `animMs` (no `RunState.time` there).
Skills: `SkillIndex 0..4`, `PadSlot 0..2`, `SkillDef.requires?: FamilyId` (rank 1 of skills 3 and 4), `SkillDef.aim: 'auto'
| 'kierunek' | 'wskazanie'`. `HeroRun.cd/cdTotal/ranks` keyed by SkillIndex, `pads: [SkillIndex x3]`. `heroes/loadout.ts`:
`isInstalled`, `installedSkills`, `padSkill` (carries paragraph + capstone), `padOf`, `assignPad`, `fixPads`,
`effectiveSkill(s, i)` (every read of a skill's shape). `castSkill(s, bus, slot, free, aim)` -> `fire(...)` (inside
`withCapstone`) -> `skill:cast`, `HeroRun.lastCast`. Aiming: pads press, drag (> 8 px shows `render/aimFx.ts`), release
fires, back over the pad cancels; `heroes/aim.ts autoTarget, dragToAim, isCancel, isTap`; the pad hands the aim through
`queueAim`. Kartograf's auto is a hitscan laser (`fireLaser`, `attack:started.laser {sx, sy, ex, ey, crit, metres, scale?}`).
Paragraphs: `heroes/paragraphs.ts` (`Paragraph {n, nameKey, descKey, patch, permission?}`, at most four patch fields,
`applyParagraph`, `PARAGRAPH_STEP {2: 6, 3: 14}`); engine `progression/paragraphs.ts` (`paragraphsOf`, `isParagraphUnlocked`,
`unlockedParagraphs`, `setActiveParagraph`, `runParagraph`, `setRunParagraph(s, skillId, n, force?)`, `applyParagraphs`).
Update form (`progression/update.ts`): `offerVersion`, `paragraphEntries` (`para:<i>:<n>`), `pickFeature`, `composeOffer`,
`confirmUpdate`, `requirementOf`, `newSkillOf`; a new skill goes to `UpdateForm.assign` ("Przypisz do przycisku",
`.assign-pad[data-pad]`, `.report.later`). Sheets: `ui/loadout.ts openLoadout` (`.lo-row[data-skill]`, `.lo-pad[data-pad]`),
`ui/konfiguracja.ts openKonfiguracja` (`.kf-box[data-n]`, `.kf-slot[data-slot=1..3|ult]`, `.kf-spec[data-spec]`,
`.kf-cap-line`, `.kf-pad[data-pad]`, `.kf-advice`), `ui/karta.ts openKarta(root, kartaModel(input), onBack)` (`.kt-col`,
`.kt-node[data-state=granted|gated|open]`, `.kt-cap`; from `[data-desk=karta]` and `[data-profile=karta]`).
Argument meter (`combat/meter.ts`, `Player.meter` 0..1, never saved): `meterGain`, `meterSpend`, `killFill(tier)`,
`tickMeter`; rebuttal .08, kill .03/.06/.15, Spór .5, drain .01/s after 4 s calm. Ultimates (`heroes/ultimateDefs.ts
defineUltimate`, `MAX_ULT_S 8`, `MAX_ULT_RADIUS 220`, `FIRST_ULTIMATE_LEVEL 12`; runtime `heroes/ultimate.ts`
`ultimateOf, ultimateUnlocked, castUltimate, stepUltimates, setUltimateParagraph, ultimateAuto`): a quiet stamp at
`ultStampSpot`, a margin note, `ultimate:cast`; `render/ultFx.ts` draws a dotted `.ult-area`. UI door `ui/ultimate.ts`; the
fourth pad `.pad.ult` (`.locked`, `.off`, `.ready`). Specializations (`heroes/specDefs.ts`, `heroes/specializations.ts`):
`categoryOf`, `specializationsOf`, `activeCapstone` (chosen column with >= 2 of its skills on the pads), `setLoadout(c,
{pads, ultimate, specialization|null})`, `loadoutAdvice`; UI door `ui/konfLoadout.ts commitLoadout`.

## Spór (DESIGN 5.4; `combat/spor.ts`)
`RunState.spor?: {prompt, bossId, phase, ttl, window, answered}`; `SPOR_TTL_S 12`, `SPOR_WINDOW_S 5`, `SPOR_WRONG_COST 0.1`;
`promptFor(boss, phase, rng)`, `postSpor` (from `enemies/bosses.ts tickBoss`: phase 1 at `rt.sporAt`, phase 2 with
`boss:phase`), `answerSpor(s, bus, index)`, `tickSpor`, `sporMul(s, defenderId)`. Keys `enemies.boss.<boss>.spor<1|2>.*`.
UI `ui/spor.ts`: three `.spor-reply[data-reply]` by the footnote slip; the boss's `.bubble.comment` in enemyFigures.

## Items, loot, recovery, Sklep (ITEMS 2–9, PLAN 8)
Items: bases (`items/bases.ts`, 40, `excludeAffixes`, `odd` via `oddStats`), affixes (`items/affixes.ts`, 32, tiers I–V
`modTier`, `absurd`, `UNWANTED_FEATURES`, `randomAffixPool`), names by `items/grammar.ts` (`withRegisterMark`: the tier
numeral after the model, before an unwanted tail). StatBlock percentages `zasieg`, `tempo`, `gwiazdki`, `proba`, read by
`recomputeStats`; stars through `economy/stars.earnStars`. `items/absurd.ts pageEntryAll` runs on `page:entered`.
`disposalRefusal(item, 'sell'|'bin'|'reklamacja'|'drop')` is the guard every way of getting rid of an item must call.
Item level `items/level.ts`: `ilvlFor({planet, priority, pageIndex, pageCount, boss})` (cap 40), `shopIlvl(planet)`,
`ilvlScale`, `TIER_BASE_MUL/TIER_BUDGET/TIER_PRICE_MUL`, `listPrice`, `actualOverClaim`. Drops `systems/loot.ts`:
`DROP_TIER_WEIGHTS`, `rollDropTier`, `dropLevel`, `dropGuaranteed`; `bindLoot` on `enemy:died`: `dropLoot` (potwierdzenie
rolled last), `enemies/named.claimNamedDrop` -> `dropGuaranteed`, the permission card. Sklep `economy/sklep.ts restock(state,
seed, visit, level)`: 3 low, 1 rzadki, 1 `oferta`, 1 `adapter` (`Listing.kind` as `.sk-kind` stamp); `mountSklep(...,
{planet})`, `RollOptions.shop`. Elites: `ELITE_IDS` 10, `spawnElite(..., {makeNamed, pack})`, packs of 2–4, named elites
(`enemies/named.ts`, one per two pages). Marks `render/itemMarks.ts`: `buildTierMark` (nietypowy stamp, rzadki thread,
unikatowy wax seal, zestaw paperclip), `affixMarks`, `groundMark`, `buildAffixMarks`; all black ink but the seal's red dot
(ITEMS §9). `drawingSvg(id, item)`; `itemView.itemRowText`, `declaredHead`, `isStruck`.
Recovery (`systems/recovery.ts`): `POTWIERDZENIE_DROP {common .1, elite .5, boss 1}`, `VACUUM_RADIUS 90`, `REGEN_RATE 2%`/s
after `REGEN_DELAY 4` s, `HEAL_SHARE 25%`, `HELD_CAP 5`, `AUTO_FLOOR 15%`; `takePotwierdzenie`, `useHeld(s, bus, auto?,
incoming?)`, `onPlayerBlow`. HUD `ui/hud.ts createPotwButton` (`.potw-btn`, draws at most two slips, `.count` from two up).
Archive: `ui/archive.ts openArchive` (`.ar-sec[data-place] .ar-cell[data-uid]`, `.ar-move[data-to]`).

## Campaign, page content, quests (PLAN 3, 7, 8)
`world/campaign.ts` owns the priorities (`PRIORITIES`, `PRIORITY_IDS`, `DEFAULT_PRIORITY`, `priorityUnlocked`,
`availablePriorities`, `clampPriority`; unlock 1/1/8/18), the nine planets (`PLANETS`, `planetDef(i)`; `planets.pN.name|loc`
is the only planet-name source), `CampaignState {current, closed, finalTicket, caseClosed, extras, cards?}` and the plans
(`nextCampaignPlan`, `extraPlan`, `travelList`, `travelPlan`, `defaultPlan`, `closeTicket`, `toCampaign`, `toPlan`,
`toCardsSeen`). `TicketPlan {kind: campaign|final|extra|travel, planet, priority, lawId}`; `createRun(seed, {plan})` uses
`world/ticket.ts ticketForPlan`; enemies scale by `planScale(s.plan)`, xp by `xpMul`, loot by `lootTierBonus`, `starMul`,
`ilvlBonus`; no plan = neutral. main.ts `enterBase(over)` picks the plan (over -> held -> bookmark -> `defaultPlan`) and
shows the card (`ui/ticketModel.cardToShow`); `acceptNow(priority)`; ticket form `ui/ticket.ts open(info, {level, view})`
(`onAccept`, `onTravel`, `onExtra` -> `takePlan`). `bindCampaign(bus, () => game.state)` is bound after `bindTunnel` and
before main's `run:ended`; `settleCampaign` once per plan object. Cards `ui/cards.ts openCard(root, {kind:
opening|chapter|rewritten, planetIndex}, {number, onDone})` (`.card-layer[data-card]`, `.card-skip`; text TODO-story until S11).
Page content: `world/contentKinds.ts` (`SEALS` six, `CONTENT`, `paragraphsFree(buffs)`, `waivePrice(patch)`),
`world/content.ts` (`contentPre`, `tickContent`, `grantSeal`, `activeBuffs`, `effectsOf`); `pages.placeContent` puts 0–2
teczki, 0–1 seal, 0–1 event (never page 1 or the boss page); `bindContent(bus, getState)` bound once at boot;
`render/obstacles.redrawContent`. Quests `world/quests.ts`: `QuestState {active, done, log}`, kinds kill/fetch/reach/deliver,
max 3, `offersFor`, `takeQuest/dropQuest/completeQuest/visitClerk`, `bindQuests`, `questPlanet(s)`. NPC `world/npc.ts
npcAt/registerNpc`, `render/npc.ts drawNpc`, `ui/npcSheet.ts`; `ui/karta-osobowa.ts openKartaOsobowa` (desk line and the HUD
`.field.rep`). Open SEAMs: hand-written side tickets and clerks (`registerSideTickets`, `registerNpc`) wait for S11/S12;
zestaw, the won-Spór tier bonus, the unarchived final unique, przesyłka wait for S17/S18.

## Narration (`narration/asystent.ts`)
One narrator per ticket, keyed by seed + number: `base:entered` for a new ticket starts it and writes the arrival note once;
the run, the tunnel's base and the base after Zakończ go on with it; footnote numbers likewise (`main.ts notesFor`). It
ticks wherever the walkable screen runs (not under sheets); idle note `idle_base` in the base, `idle` in the run. 1 in 8
notes is wrong and corrected 10–20 s later by number.

## Render
`views.sync(entities, timeMs, {drawIn?})` creates one `<g data-id>` per entity and patches only `transform` and a few
attributes. Layers: `#page` (paper, obstacles incl. inked obstacle blots, header, exit, holes, stations; no filter) ->
`#world` (entities; wobble filter re-seeded every 500 ms) -> `#fx` (blots, strikes, stamps, margin notes) -> `#ui`.
`render/bindings.ts bindFx(bus, views, page, view, damageNumbers, blocks)`: hit blots (`blot`: wet 45% -> full ink in
300 ms, held 500 ms, dried to a 22% stain over 1.8 s; pool of 20), strikes on death, the "margines" note at
`marginSpot(side, x, y, page)` (above the hero at a side wall, 72 units beside him at the top or bottom wall), stamps at
`placeStamp(x, y, w, h, view, away?, blocks)` inside `freeViewRect(camera, 'stamp')` and 80 units off `away`. Ink:
`drawIn, eraseOut, strike, blot, stamp, marginNote, tapMark` (`render/ink.ts`); `.t-note` margin notes and the pad words
carry a paper halo (paint-order stroke). Paint only via `render/wash.ts washGroup`. No gradients, glow, shadows; red only
for stamps, strikes, Racja, handwritten corrections. `stampsOnPage()` counts fx stamps until they fade.
Headers: `obstacles.ts drawHeader/headerBox/wrapLines`; `headerFor(s, view?)`, `baseHeaderFor(s, frame?)` take
`headerFrame(camera)` = `{view?: portraitSpan, avoid?: headerKeepOut}` (portrait: two lines in the visible span, cut after a
sentence; landscape: beside the note row). Camera (`render/camera.ts`): at least 390 wide, 700 tall in portrait, 520 in
landscape; `bounds` follow the page shown; `readableUnits(units, minPx=11)` for world text.
Claim bubbles (`render/bubbleFocus.ts`, from game.ts render): `pickBubbles` shows at most `BUBBLE_CAP 2` (bosses, elites, then
nearest within 260 or in the 1.2 s new grace; never two with the same claim text), none while `stampsOnPage() > 0`; hidden
ones stay in the DOM; a shown one is moved by `avoidBoxes` inside `freeViewRect(camera)`, off `keepOutBlocks(camera)`, off
the hero (`heroBox(p)`, `HERO_BOX`) and off the bubbles placed before it (`bubblePlaced`).
Keep-out (`render/keepOut.ts`, measured by `ui/keepOut.ts watchLayout(ui)`): `screenLayout()` = `{w, h, top, bottom, blocks,
row}` in css px from the DOM (HUD and footnote band; pads, the update line, the Potw./Tunel/Pauza notes; `row` = the notes
as the run shows them). Re-measured lazily after a resize, orientation/steering/style change, a layout class change in #ui
(paint-only tokens ignored) or a HUD/foot resize. Never fixed pixels outside the fallback insets in camera.ts.
`render/attackFx.ts` turns `attack:started` into transform-only poses; `render/damageNumbers.ts` (setting, pool of 10).
Sheets share `ui/sheet.ts` (`createSheet`, the `c.d. poniżej` cue `runsOn/cutEdge`, also under the settings form
`.set-more`; `guardGhostClicks` with the pure `isGhostOf`). Every `#ui` button is at least 44 x 44 css px.

## Controls and layout (DESIGN 2)
`ui/layout.ts` sets `data-orient` and `data-steer` on `<html>`; landscape and joystick rules live in `ui/landscape.css`.
`input.ts`: `held()` (tap mode), `steer()` (joystick), `setEnabled`, `setMode`, `setLeftHanded`, `inject`. Joystick: the
first pointer on the steering half owns the stick; a quick tap (< 260 ms, < 10 px) calls `onTap(x, y, false)` (footnote
history on the slip, else the kiosk). Pads and notes act on `pointerdown`. HUD notes Pauza/Tunel/Potw. (`ui/pause.css`,
`ui/tunnel.css`, `ui/potw.css`): 48 x 48 circled words, a slot is 56 px (right 12/68/124; portrait joystick under the
Załączniki pad 24/80/136; landscape 30/86/142, mirrored when left-handed). Notes and pad circles are paper-filled.
Settings (`Settings`, kept by `migrate` only when not default): theme, hand, orientation, steering, volumes, `textSize?:
0|1|2` (`--ts` zoom, `ui/textsize.css`), `damageNumbers?: true`, `bugButton?: false`.

## Audio (`audio/`, DESIGN 14)
Web Audio only, synthesized; `audio/bindings.ts` is the one place events meet sounds; nothing exists before the first
gesture; errors are swallowed. Music flags (`deriveFlags`): enemiesNear, elite, boss, botTime, `paused`, reversed,
suspended, dead, pageTurn, `base` (calm layer, 6 dB down). Music runs from `run:started` to `run:ended` and in the base.
Hero sounds from `heroById(id).sounds`; ultimates `pralkaUlt, konsUlt, petlUlt, kartoUlt, nalesUlt`; `recovery:taken` ->
`paperSlide`; Spór posted -> `footnote`, right -> `strikeThrough` + `stamp`, wrong -> `paperTear`. `npm run render-audio`.

## i18n
`t('domain.key', params)`; `src/i18n/pl/<domain>.json` (file name = prefix; heroes in `pl/heroes/<id>.json`). Plurals
`{one, few, many}`. One-letter words are bound to the next with U+00A0 by `t()`. No user-facing strings in `.ts`.

## Test hook and scripts
`window.__game`: `start(seed, opts)`, `go`, `state`, `meta/setMeta`, `screen`, `advance(s)`, `turnTo(page)`, `attack`,
`hitEnemy`, `killEnemy`, `hurtPlayer`, `placePlayer`, `snapshot`, `footnote(text)`, `notes()`, `giveItem`, `demoInventory`,
`openInventory`, `openSklep`, `openKiosk`, `setTheme`, `setOrientation`, `setSteering`, `setLeftHanded`, `setSettings(patch)`,
`controls`, `dropPotwierdzenie(dist)`, `heldPotwierdzenia`, `setHeldPotwierdzenia(n)`, `usePotwierdzenie`, `exportArchive()`,
`importArchive(text)`, `joystick(dx, dy)`, `pause`, `resume`, `endTicket`, `resumeTicket`, `character`, `startBase(seed?)`,
`station(name)`, `acceptTicket`, `walkToExit`, `gate.{set(kind, opts), info, approach, push(s)}`, `openTunnel`, `enterTunnel`, `returnFromTunnel`, `tapUltimate`,
`ultimatePad() {ready, off, inked, hidden}`, `keepOut()`, `setLevel(n)`, `fillMeter(v=1)`, `setMeterUi(v)`, `castUltimate`,
`ultimateInfo()`, `setSpecialization(id|null)`, `loadoutInfo()`, `aimCast`, `holdPad`, `releasePad`, `itemGallery(mode)`,
`setCampaignView(v|null)`, `showCard(kind)`, `priority()`, `spor.{answer, info}`,
`hero.{cast(slot, aim?), installSkill, openAssign, assignPad, setParagraph(skillId, n, force=true), info, levelUp, grantXp,
requestUpdate, openUpdate, pickUpdate, die, givePermission}`, `enemies.{spawnFamily, spawnBoss, spawnPack, spawnNamed, hit,
clear, list}`, `content.{list, put(kind, {seal, dist, dy}), tap, open, seal, buffs}`, `quests.{offers, active,
accept(idOrKind), drop, finish, report, happen, done}`, `audio.{renderProfile, renderSfx, music, contextState, ...}`.
DOM hooks: `[data-pause=...]`, `[data-desk=...]`, `[data-roster=new|open|karta|remove|back]`, `.rs-case[data-case]
[data-hero]`, `[data-profile=name|karta]`, `.card-skip`, `.spor-reply[data-reply]`.
`npm run check` = typecheck, vitest, `lint:rules`, build. `npm run shot`: 390x844 @2x and 844x390 into `shots/`
(`SHOT_PORT`, `SHOT_OUT`). Per-domain shots, each with SHOT_PORT/SHOT_OUT/SHOT_DIR in its header: `scripts/shot-{base,
tunnel,pause,attacks,enemies,heroes,items,aim (4195),skills (4197),loadout (4198),s2 (4182),s3 (4183),s4 (4184),s5 (4185),
recovery (4176),s6 (4186),s7 (4187),s8,elite-packs (4188),s10-content (4183),s10-quests (4188)}.mjs`. Port 4190 is unsafe
in Chromium. `npm run smoke` (`SMOKE_PORT` 4191) plays a ticket with real buttons: creation form, base, desk, ticket, exit,
run (header clear of the note row, no bubble under a pad or note, the update line clear in tap/joystick x both hands),
fight, update (3b assign, 2b/3c paragraphs, 3d ultimate), inventory, pause, Zakończ, bookmark resume, two tunnels, boss,
Spór (5a), death, landscape joystick, 6c campaign, 6e skills, 6f loadout, 6g S5 settings and recovery, 6h roster and
archive, item marks, S9 elites and Sklep stamps, S10 content and quests, then 5 s of frame times with 40 enemies
(`PERF_MAX_MS`, `SMOKE_UNCAPPED`). Milestone gates: `npm run e2e:m1` (`M1_PORT` 4177: every hero x orientation, loadout and
ultimate), `npm run e2e:m2` (`M2_PORT` 4192, `M2_ONLY`: roster, nine planets at Niski, cards, teczka, packs, named elites,
a side ticket, finale, free travel, reload, 40-enemy perf). All exit 1 on a failed check or page error.
