# Status and handoff

Read this first in a new session. Then CLAUDE.md (auto-loaded) and only the DESIGN.md and
ARCHITECTURE.md sections the next task needs; WORKFLOW.md when you spawn agents. Keep this file
current: it replaces chat memory. Context note: the project's own files cost ~1k tokens at start
(CLAUDE.md); a large first-command context comes from the harness (tool definitions, skills,
plugins, connectors), which the player trims in Claude settings, not in the repo.

## Where things are (2026-10-18)
- Branch: `claude/scifi-arpg-concept-6vqk36`. Deploys to https://stillestorm.github.io/SciFiArpg/
  on every push (GitHub Actions; repo public; github-pages environment allows `claude/*`).
- Playable first version is live: four heroes, three enemy families with claims/rebuttals,
  statuses, three bosses, loot with grammar and reviews, inventory, store, nine regulamin
  clauses, pages with page turns, update-style level ups (deferred to a lull), three death
  outcomes, ticket history rewriting, the Asystent footnotes, settings (night, left-handed,
  volumes), PWA, save.
- Audio phase is live: paper foley for menus, weighted combat SFX (transient+body+tail),
  12 skill sounds, family flavours, boss hum, music profiles B/C/B+C with adaptation, hit-stop.
  Levels calibrated numerically, not by ear (see Open feedback).
- Polish text had one voice pass (Opus). ui.json and screens.json still need a pass after the
  controls build adds strings.
- Controls are live: landscape default (520 world units high, portrait 700), orientation
  setting with lock, floating joystick (default in landscape) or tap, auto-attack while moving,
  manifest fullscreen (Android hides the bars), one-letter-word typography rule in t().
- Voice passes done on every i18n file. Unused keys to wire or drop: ui.note.firstKill/start/pickup.
- Paint is live and approved by the player (DESIGN §3.4, render/wash.ts).
- Pause and save are live: Pauza note on the HUD, sheet with Wznów/Ustawienia/Zakończ, character
  persists between runs (level, upgrades, gear, bag, purse), bookmark resume from baza.
- Tunel serwisowy is live (hole, hold the exact run, return, tape; earlier tapes on the page are
  redrawn on the return and the figures are not drawn in again).
- The walkable base page is live (DESIGN 4.1): one of three layouts per planet (lądowisko, wioska,
  miasteczko), stations (desk = ticket, history, resume; kiosk = Sklep; notice board = settings;
  paczkomat = a note), the exit locked until the ticket is accepted, the tunnel's base end. RunState
  has `phase: 'base' | 'run'`; the same object walks out of the exit into the run. The Asystent and
  the footnote numbering run per ticket from the base into the run; the base has its own idle notes.
  In the base the pads cool down, the queued update opens from the HUD line, skills are not cast.
- Portrait: the clause header is set inside the visible span, two lines, cut after a whole sentence.
- Joystick mode: a thumb landing on the footnote slip steers; a quick tap opens the history.
- Attack animations are live: attack:started event, hero poses per hero, enemy wind-up and
  lunge, projectiles turn along velocity (render/attackFx.ts, scripts/shot-attacks.mjs).

## Gates and commands
`npm run check` (typecheck, tests, lint:rules, build) · `npm run shot` · `npm run smoke`
(flow play-through + 40-enemy frame time) · `npm run render-audio` (levels, body band, clipping).
Agents: `.claude/agents/` (builder=Sonnet, integrator=Opus, voice=Opus, look=Sonnet). They
load at session start. Division of work: docs/WORKFLOW.md.

## Decisions taken in chat that are already in DESIGN.md
Modern absurdity mapping (§0–§10), fonts (Michroma/Space Mono/EB Garamond), combat b+d now
and c (Spór) next (§5), sound anchors and per-planet profiles (§14), landscape default +
joystick/tap steering (§2), editorial rules (§12.1).

## Latest player feedback (2026-10-18, phone, landscape, joystick) and what was done
- Base: controls hung after closing a station sheet (fixed: input re-enabled on release); stations
  now open on a tap from anywhere; labels permanent and readable; settings only in the pause
  sheet; the notice board shows announcements + ticket history; Pauza double-toggle fixed
  (ghost click guard). Aiming shipped in the same push: hold a pad and drag to aim.

- Second phone round (attack feel): Pralka lash longer and thicker; Petlowiec's remark flies as
  handwriting and lands as a struck word; Konsultant whips with the headset cable (resolve
  deferred 90 ms via an invisible projectile); tunnel opens 70 units ahead; "wymaga
  zgloszenia" legible with an arrow, struck through on unlock. Other heroes' attacks may still
  be refined once the player has ideas.

- Third round: base-page figures now animate (render clock), Kartograf's auto is one measuring
  laser (hitscan, ticks, distance label, crit pierces), Naleśnik shipped (rolling walk, flip
  auto, Orbita/Grawitacja/Wniosek, hydrostatic quirk, profile, pool, four sounds, ochre wash).
  Builder's note: standing still it reads a bit like a moon; the folded edge could be stronger.
- Fourth round: the fourth and fifth skills (DESIGN 10.1) are built: ten skills, installed through
  the update form (first rank wants a family permission), three of five on the pads, the pad step
  after the install, the loadout sheet from the pause line Umiejętności, pads saved with the
  character. Look pass done (red case-number stamp, three glyphs redrawn, landscape loadout fits five
  rows). Not yet heard from the player: whether the ten read well on the pads and the sheet. Legenda's
  wrong-name labels are margin notes at the global 11 px; a bigger size would need a size field on
  margin:note (render/ink.ts).

- Fifth round (2026-10-19, M2 build): the desk's Nowe zgłoszenie was painted over by the sheet's "c.d. poniżej"
  strip (it hung from the notes' rule across the pinned action), so no main ticket could be taken and the exit stayed
  locked; the strip now ends at the body's edge. The roster moved from the desk ("Wykaz spraw") to the pause sheet as
  "Wyjdź" (run and base; saves the character and a bookmark). Side tickets from the board still do not open the exit
  by design: the exit note names the desk.

## Open feedback wanted from the player
- Real-phone frame rate with a crowd; tap accuracy; joystick feel once it lands.
- Sound levels: music is −12 dB under SFX by design; the sliders' comfortable values become
  the new defaults.
- Whether bubbles/figures are readable at phone size.

## Milestones (for /automode)
PRODUCTION.md's milestone table: M1 Systems core (S1–S5, done) · M2 Campaign frame (S6–S10,
done) · M3 Akt I + finale = MVP (S11–S16) · M4 Depth (S17–S21) · M5 Akt II · M6 Akt III · M7
Polish and release. Progress lines are below.

## Needs the player
- Capstones as built are small flat bonuses (+20–25% on one skill, DESIGN §10.3). Keep them so, or
  turn them into mechanical rules (Diablo 4 key passives) in M4 S19–S21? Recommendation: keep;
  Diablo 2 had none, they read at a glance on the Karta, and the S16 balance pass tunes magnitudes.
- Decided (player, 2026-10-19): one new boss body per act, drawn for the last planet of Akt II
  and Akt III (planets 6 and 9), built in S24 and S27; variants of the family bosses elsewhere.
  S22/S24 are unblocked.
- Decided (player, 2026-10-19): Diablo-style flow. The base exit is always open and a new or loaded
  game starts with its ticket already open (S11a, before S12); story locks are terrain or a figure on a
  page, not the base exit. Waypoints ("przystanki") on the planets with a station in the base to travel
  to them (S21a, after S21).
- MVP playtest questions to ask after M3 (not before): whether the Anomalia at `CAMPAIGN_LAST` 3
  (level ~12–15) reads as a finale, and whether the hosted-set rule (ITEMS §12.6) should change.

## Game plan and the slice order
The plan is docs/PRODUCTION.md: 7 milestones, 30 slices, each with a paste-ready builder brief.
Design docs: PLAN.md (+§7, §8), SKILLS.md, ITEMS.md (+§12), STORY.md, DESIGN §10.2–10.3.
Progress is recorded here, one line per slice:
- S1 done: per-hero folders behind a registry, 22 skill primitives, 25 skills as primitive lists (contract snapshot unchanged), new-hero scaffold, no hero id outside its folder (lint), smoke casts every skill of every hero.

- S2 done: 75 paragraphs (§1–3 on every skill) with the patch engine and unlock schedule (+6/+14 or permission), the update form offers paragraphs, Konfiguracja at the desk and the pause sheet, pad § tag; voice pass; DESIGN §10.2 paragraph rule relaxed to match the data.

- S3 done: Argument meter (rebuttal/kill/Spór fills, drain), first ultimate per hero with §1–3 (Pełny cykl, Przekazanie, Zebranie, Mapa ostateczna, Decyzja Komisji), stamp pad hidden below level 12, HUD Argument line, five ultimate recipes, running-area outline; look fixes: claim bubbles capped at two and hushed under stamps, stamps placed off the hero; voice pass.

- S4 done: skill categories, three specializations per hero with capstones (one column at a time, ≥2 skills on the pads), full Konfiguracja form (pads, ultimate slot, specialization, advice), Karta uprawnień chart from the desk and profile (portrait stacks the columns for readable stamps), loadout + specialization + ultimate paragraph saved; voice and look passes.

- S5 done: potwierdzenia (drop .1/.5/1 by rank, vacuum 90, heal 25% or held to 5, tap and auto-use under 15%, regen 2%/s after 4 s, HUD slip button), `navigator.storage.persist()`, Archiwum eksportowe export/import with confirmation, bug dump from the pause sheet, text size (3 steps), damage numbers (off by default); voice pass. Open: drop rates untested (S9/S16), DESIGN has no recovery section (PLAN §8 holds the rule).
- M1 plan review done: PRODUCTION S6, S9, S10, S16, S19 briefs adjusted to what shipped (roster keeps Karta uprawnień and the archive format, potwierdzenia rates into the drop tables, Karta osobowa as a desk line, ultimates 2/3 as data on the S3/S4 slots, ARCHITECTURE folded at each milestone end); PLAN's duplicate §8 removed. Order unchanged.

- **M1 Systems core complete** (2026-10-19): e2e:m1 green for 5 heroes × 2 orientations; look fixes (HUD keep-out for bubbles, stamps and the page header measured from the DOM; 11 px text; ink validation line; left-handed update line); voice pass; plan review adjusted S6, S9, S10, S16, S19–S21. Open polish for M7: ~25 CSS rules and a few drawn labels still under 11 px; portrait page header can drift off screen when the camera pans. From the M2 look pass (reports/M2-look.md, folded into S28): Potw./Tunel/Pauza circles ~41 CSS px; claim bubbles over HUD buttons and over each other; large blots lingering (edge, cookies, kiosk); landscape footnote box over the play area; "margines" caption and the margin wall over the hero and pad labels; "Wielkość druku" label under the Wróć button; underlined links (Przyjmuję, Zamknij) as 44 px tap boxes everywhere.

- S6 done: roster of characters as case files (create with hero pick + case number, delete with a form), SAVE_VERSION 3 with per-character progress/bag/personal archive 40 and a shared archive 40, v2 and S5-archive migration, tap-to-transfer Archiwum sheet at the desk, ghost-click guard fixed; voice and look passes. Parked: hero note on archived uniques (waits for legendary paragraphs, ITEMS 8); ARCHITECTURE.md ~370 lines, fold at M2 end; the landscape desk needs a scroll to reach the archive and export lines; the `.pen` accent is ruled for handwritten corrections only (re-check new users).

- S7 done: nine planets as data (placeholder names), priority Niski–Krytyczny scaling enemies, reputacja, stars, loot tier and item level, unlocked by level; per-character campaign (next planet, closed planets, return ticket, zgłoszenia dodatkowe, free travel); ticket form with priority picker and travel list; opening page, chapter and red rewritten card frames (TODO-story text until S11); look pass. Parked: ARCHITECTURE.md over its three-page limit (fold at the M2 end); card text is TODO-story placeholders (voice/story, S11); the chapter and opening cards cover the base stations mid-page (accepted as modals); "Dotknij, aby pominąć" hint grey at 11 px, borderline; landscape HUD box cut at the left edge (existing); the portrait ticket answers are now a sticky footer.

- S8 done: 32 affixes (6 absurd with mechanics) with m/f/n/pl forms, tiers I–V by item level, names as noun + adjectives + model «…», 40 bases (8 per slot) with 21 new drawings, tier marks (stamp, thread, wax seal; paperclip reserved for sets) on ground and card, new stats wired; voice and look passes. The rzadki thread was ruled black at the gate (DESIGN §3 keeps red for stamps, strikes, Racja, corrections; ITEMS §9 updated); per-base `excludeAffixes` with a test for noun echoes; the tier numeral sits after the model, before an unwanted tail. Parked: `disposalRefusal` waits for sell/bin/reklamacja (S9+ must call it); a noun-phrase head or `adjBefore` for prepositional bases ("czapka z daszkiem", "zegarek z krokomierzem"), readable as is; drawn mark labels (REKLAMA, Nowość) stay under 11 px at the 40–56 px sheet figures (M7 small-text polish); the inventory card footnote is clipped behind the action buttons in landscape (existing).

- S9 done: item level by planet, page and priority (cap 40) with tier budgets and lie magnitudes, drop tables per family and rank with boss guarantees, Sklep stock 6 plates per planet with prices and lies (Oferta / Z adapterem stamps), elite packs (leader + 2–4 minions sharing the aura, ink brackets), named elites with 2–3 affixes and Asystent-recorded names (≤1 per two pages, guaranteed nietypowy+ drop), elite affix pool 10; voice and look passes. Parked: elite sounds (M7); zestaw, Spór tier bonus, the unique archive rule and the przesyłka seams wait for their slices; in forced crowds a neighbour's bubble can still cover an elite caption (captions now sit on a paper halo).

- S10 done: page content (teczki 0–2/page, six timed seals, three events: form under fire, lost delivery, audit), Karta osobowa from the desk and the HUD Reputacja line, quests (kill/deliver/fetch/reach, two generated side tickets per planet) on the board, NPC primitive with a placeholder clerk per base; voice and look passes.
- M2 e2e green (`npm run e2e:m2`, both orientations): roster, opening card, nine planets at Niski with cards, packs and named elites, side tickets, the return ticket, extras, free travel, reload. M2 look over `shots/`: FIX, no REDO; the list is folded into S28 and "Open polish" below.
- M2 plan review done (story agent): STORY §2 `CAMPAIGN_LAST` (3 at the MVP, raised act by act, "Sprawę wznowiono" card), §3 finale delivery (one-page run on the struck base), §4 bosses as planet variants of the family bosses, §5 side-ticket items only as an awizo (S18) and the extras framed as the Komisja's case against the applicant, §7 one `story.json` with the key scheme, §8.0 the per-planet frame mapped onto the code; PRODUCTION S11–S18, S22–S24, S27–S28 briefs adjusted (S12 carries the story frames: cards and hero lines by planet/hero, Spór by planet, location types on pages, base layout from the record); ITEMS §12.6–8 (hosted sets rule, awizo rewards, red ruling); DESIGN §4.2 records what M2 shipped; PLAN §3.1 and §5, ITEMS §10, SKILLS questions marked superseded/answered. Order unchanged.

- **M2 Campaign frame complete** (2026-10-19): e2e:m2 green in both orientations (nine planets at Niski, roster, cards, items, elites, content, quests, return ticket, free travel); look fixes (HUD circles 48 px, bubble de-dup, drying blots, paper outlines, 11 px sheet text); ARCHITECTURE folded to under 300 lines; story plan review adjusted S12–S18, S28.

- S11 done: STORY §8.1–8.5 for planets 1–3 (23 Przydzielona, 24 Zaległa, 25 Zaktualizowana), the Anomalia finale and the opening page; gates: P2 page 2 parcel wall (teczka), P3 page 4 turnstile (named elite); final Polish in `src/i18n/pl/story.json`, planets.json p1–p3 named. Open for S12–S14 (reports/S11-story.md, S11-voice.md): the planet 1 clerk shares its name with `screens.npc.referent`; ticket p3.c "Dwa egzemplarze" breaks if n changes; the phase-3 right answer is marked existential but reads as regulamin; S14 needs a fixed-name forced elite for the P3 gate (fallback a teczka).
- S11a done: the base exit is never locked; the base opens with the plan accepted (last priority, default Normalny); a bookmark is the exit's destination ("otwarto z urzędu" on the desk); Nowe zgłoszenie over a bookmark asks first; the form applies changes with "Zatwierdź zmiany"; page gates (`src/world/gate.ts`: boss / teczka / quest, an ink barrier over the exit corner, the Asystent names the condition; `PlanetDef.gates`, none set yet); e2e:m1 two stale legs fixed. Voice pass on the new screens.base keys still due (fold into the S12 voice step).

- S12 done: planet 1 built (locations przedmiescie + magazyn with 17 prop drawings chosen per page, `src/render/locations/` registry with the generic fallback; base layout and clerk from the planet record; side tickets h:p1:a-c; boss variant "Prototyp, seria 1" with its line under the name and the planet's Spór table), the per-planet frames (cards and hero lines from `story.p<N>.*` with placeholder fallback, Spór by planet, `src/world/planets/` registry imported from main.ts), `CAMPAIGN_LAST = 3` (return ticket after planet 3; saves past it pulled back, `CampaignState.reopened` set); smoke leg 6d; e2e:m2 runs planets 1-3. Look: variant line spacing fixed; the rest folded into S28 (Pomiń tap target and the 10 px "UWAGA WNIOSKODAWCY" on the chapter card, the clerk sheet's Zamknij hit area, bubbles overprinting/clipped by HUD and footnote, lingering blots, an orange outline on the selected Spór card). Leftovers planned: the first ticket's `lawPool[0]` and free travel capped at `CAMPAIGN_LAST` (+ smoke 6c) in S13; the "Sprawę wznowiono" red card (only the `reopened` flag exists) in S24; the look items in S28. Rewritten cards carry no hero line by design (STORY has none).

- S13 done: planet 2 built (serwerownia location, 8 drawings on a `corridors` layout; magazyn gained stos/awizo/kolejka, shown on planet 1 too; `locationSplit` steers magazyn to pages 1–2 and serwerownia to page 3 and the boss page), clerk, side tickets h:p2:a-c, boss variant 360 racja with its Spór (egzystencjalny, regulaminowy), the P2 gate on page 2 (parcel wall keyed to one forced teczka "list przewozowy", the Magazynier's line on tap, struck and drawn away on the lift), `PlanetDef.headline` (first campaign ticket on an unclosed planet prints it; travel/extra roll the pool), free travel capped at `CAMPAIGN_LAST` (smoke 6c, ticket.ts rows), smoke leg 6e. New key `screens.base.plate.cisza` (voice: light check at the M3 pass). Look: the HUD pads partly cover corner exits incl. the gate (existing, S28).

- S14 done: planet 3 built (biuro location with partitioned rooms and its drawings, three new przedmieście props, split przedmieście 1–2 / serwerownia 3 / biuro 4–5 + boss), clerk Pełnomocnik ds. Aktualizacji, side tickets h:p3:a-c (c pinned at n 2 for its text), boss variant seria 3 wersja biurowa (attackRange 60, stapler arm), Spór answers [mechaniczny, egzystencjalny], a named-elite gate kind (page 4 always spawns one named elite "Ochrona Obiektu", `story.p3.gate.elite`; turnstile struck, Portier sits), smoke leg 6f. Report reports/S14-builder-planet-3.md. Side effects: planet 4 lists biuro so it gets the room layout; planet 1 przedmieście pages differ per seed (more props). Look: HUD pads over the turnstile/Portier in landscape (existing corner-exit item, S28); the Portier tap is unit-tested only.

- S15 done: the finale (final ticket = one page on planet 1's base, stations struck, the Anomalia at the desk): phase 1 three family forms with the old/new footnote duel (corrections print as corrections), phase 2 the hero's face (Serwisant, Kierownik Kolejki, Węzeł, Planeta Nieistniejąca with measured arcs, Obserwatorium), phase 3 existence from right Spór replies, SPRAWĘ ZAMKNIĘTO, a unique not yet held, case closed on the base with the final footnote shown whole; the return ticket's red card (Bilet powrotny, PRZEPISANO); `__game.finale`, smoke leg 6j per hero, lint rule `anomalia-boot-order`. Report reports/S15-integrator.md. Voice pass done (final footnote 235 chars). Look pass done (Planeta redrawn 2x solid, Węzeł 1.45x, stamp on clean paper, final footnote alone on the slip and the unique note 12 s after, first-meet notes off for Anomalia bodies). Left for S28: in landscape the bigger Planeta runs past the top of the view; the long final slip touches the pad labels for 12 s; the Spór reply cards cover the Anomalia in portrait (existing); old struck bodies linger at the desk for a moment when a stage ends fast. Balance first-pass (S16); a bookmark mid-finale restarts at phase 1.

- S16 done: on-ramp (five once-only first-ticket footnotes, `src/narration/onramp.ts`; `ui.note.start/firstKill/pickup` dropped), `npm run balance` (scripts/balance-report.mjs, BAL_* env, 6 runs/hero ~70 s, 20 ~4 min, finale mode), numbers moved to `src/balance/{recovery,meter,loot,campaign}.ts`, one tuning change (METER_KILL 0.03→0.04, METER_REBUTTAL 0.08→0.10: finale ultimates 0.67→0.90 per 100 s), `npm run e2e:m3` (Akt I + finale, Pralka and Kartograf, both orientations, M3_PORT 4189). Report reports/S16-builder-onramp-balance.md. Konsultant wins 40–50% of planet-1 Normalny bot runs vs 80–100% for the others; damage 5–9, racja 90, and racja 86 + pewność 105 + upór 48 each left it at 40–50%, so it is likely the bot's auto-aim on Konsultant's aimed skills, not the numbers: ask the player at the MVP playtest. Gwiazdki ~151/planet vs ~200 in ITEMS 7.4 (no page-boss drop rank in `DROPS`; M4). Voice pass on all Akt I text (10 lines; walk note split by steering, `narration.onramp.walkTap`; the rebut note says teza; the p4–9 stand-in clerk renamed Referent ds. Ogólnych). Look over all 58 shots: the "c.d. poniżej" mark is now its own line between body and notes rule, shown only on real overflow (src/ui/sheet.ts), which also removed a red stamp edge poking out in land-sklep; the rest KNOWN (S28). Open for the player: the p1 ticket "Potwierdzenie obecności" vs the potwierdzenie item (pun or rename); the red dot in the unikatowy seal (kept: a wax seal counts as a stamp).

**Next pickup:** the M3 milestone end (story plan review, ARCHITECTURE fold, gate, push, milestone report), then the MVP playtest.

## Known limits
- Smoke leg 6e zeroes skill cooldowns between casts; a 40 s test-hook advance paused the run at ~34 s game time (likely the deferred update form; not investigated).
- iOS ignores orientation locks; the setting only picks the layout there.
- Service worker: after a deploy, reload once (installed app: close and reopen).
- Headless Chromium frame time is at the vsync floor with 40 enemies; phones unmeasured.
