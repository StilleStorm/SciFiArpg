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

## Open feedback wanted from the player
- Real-phone frame rate with a crowd; tap accuracy; joystick feel once it lands.
- Sound levels: music is −12 dB under SFX by design; the sliders' comfortable values become
  the new defaults.
- Whether bubbles/figures are readable at phone size.

## Milestones (for /automode)
PRODUCTION.md's milestone table (M1 = S1–S5 … M7) supersedes the list below.
- **M1 Systems core**: slices 1–4 (hero folders + primitives, paragraphs, Argument meter +
  ultimates, loadout form + Karta uprawnień). Milestone e2e: a full run with a loadout and an
  ultimate on every hero.
- **M2 Items**: slices 5 and 8 (affix pool, bases to 40, item level, drops, Sklep, drawing
  marks, sets, legendary paragraphs, Reklamacja, Archiwum). Milestone e2e: loot across tiers,
  a set bonus, a reclamation, a stash transfer.
- **M3 Heroes filled**: slice 6 (five hero slices from SKILLS.md) and 10a–10c (recovery, elite
  packs, character sheet, save safety, settings). Milestone e2e: every skill and paragraph of
  every hero against a fixed scene; recovery and auto-use.
- **M4 Campaign frame**: slices 6a and 7 (roster screen, priority, planet sequence, final ticket,
  free travel) and 10d (page content). Milestone e2e: a whole campaign skeleton at low priority
  with placeholder chapter cards.
- **M5 Akt I + finale (MVP)**: story content for planets 1–3 and the Anomalia frame from
  STORY.md §8 (story agent plans, voice writes, builders code), chapter cards, opening page,
  clerks, side tickets, hero lines. Milestone e2e: Akt I start to finish, skipping all cards.
- **M6 Polish and balance**: slice 11, the on-ramp, phone feedback. Then Akt II and III as M7, M8.

## Needs the player
(none)

## Game plan and the slice order
The plan is docs/PRODUCTION.md: 7 milestones, 30 slices, each with a paste-ready builder brief.
Design docs: PLAN.md (+§7, §8), SKILLS.md, ITEMS.md (+§12), STORY.md, DESIGN §10.2–10.3.
Progress is recorded here, one line per slice:
- S1 done: per-hero folders behind a registry, 22 skill primitives, 25 skills as primitive lists (contract snapshot unchanged), new-hero scaffold, no hero id outside its folder (lint), smoke casts every skill of every hero.

- S2 done: 75 paragraphs (§1–3 on every skill) with the patch engine and unlock schedule (+6/+14 or permission), the update form offers paragraphs, Konfiguracja at the desk and the pause sheet, pad § tag; voice pass; DESIGN §10.2 paragraph rule relaxed to match the data.

- S3 done: Argument meter (rebuttal/kill/Spór fills, drain), first ultimate per hero with §1–3 (Pełny cykl, Przekazanie, Zebranie, Mapa ostateczna, Decyzja Komisji), stamp pad hidden below level 12, HUD Argument line, five ultimate recipes, running-area outline; look fixes: claim bubbles capped at two and hushed under stamps, stamps placed off the hero; voice pass.

- S4 done: skill categories, three specializations per hero with capstones (one column at a time, ≥2 skills on the pads), full Konfiguracja form (pads, ultimate slot, specialization, advice), Karta uprawnień chart from the desk and profile (portrait stacks the columns for readable stamps), loadout + specialization + ultimate paragraph saved; voice and look passes.

**Next pickup:** `/pickup` then `/automode`; the next slice is PRODUCTION.md S5 (last of M1; then the M1 milestone steps).

## Known limits
- Smoke leg 6e zeroes skill cooldowns between casts; a 40 s test-hook advance paused the run at ~34 s game time (likely the deferred update form; not investigated).
- iOS ignores orientation locks; the setting only picks the layout there.
- Service worker: after a deploy, reload once (installed app: close and reopen).
- Headless Chromium frame time is at the vsync floor with 40 enemies; phones unmeasured.
