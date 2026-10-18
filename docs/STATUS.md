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
  character. Not yet heard from the player: whether the ten read well on the pads and the sheet.

## Open feedback wanted from the player
- Real-phone frame rate with a crowd; tap accuracy; joystick feel once it lands.
- Sound levels: music is −12 dB under SFX by design; the sliders' comfortable values become
  the new defaults.
- Whether bubbles/figures are readable at phone size.

## Backlog, in order (decided with the player 2026-10-18; DESIGN §13 "Planned next")
1. (done) Paint approved; attack animations shipped.
2. (done) Pause sheet, hold music on pause, character save between runs, bookmark resume.
3. (done) Tunel serwisowy with exact-state return; Android back button opens the pause sheet.
4. (done) Walkable base page per planet (§4.1).
5. (done) Aiming; the fourth and fifth skills (§10.1).
6. **Next:** Spór for bosses (DESIGN §5.4). Own sound recipes for the ten new skills (they borrow a
   sibling's recipe, audio/recipes.ts HERO_SKILL_SOUNDS).
7. Przesyłka / paczkomat deliveries (§7), tap an item on the ground to see its card first (§2).
8. Act on phone feedback (feel of joystick, scale, sound levels, frame rate).
9. Landscape 40-enemy perf measurement; the base clause header in landscape sits under the HUD
   or above the view (portrait is fixed; landscape wants it top centre per §2); Odwirowanie knockback distance; appeal-form pickup drawing; Ciasteczka empty paper behind the
   banner; Wygenerowane drawings are the busiest (simplify); "Muzyka na czekanie, utwór nr N"
   shown somewhere; sounds for enemy:miss / offTopic / gwiazdki pickup; stereo panning.
10. Heavy-metal music profile (own anchor and ban list to be written first).
11. More fidget animation, more laws/uniques/parts, quests as ticket correspondence, English.
12. When the game is fuller: move hosting to the player's Cloudflare (custom domain), then Google
   Play via Trusted Web Activity (PWABuilder/Bubblewrap; needs /.well-known/assetlinks.json at
   the origin root, a privacy policy URL, the 12-tester closed test; developer account exists).

## Known limits
- iOS ignores orientation locks; the setting only picks the layout there.
- Service worker: after a deploy, reload once (installed app: close and reopen).
- Headless Chromium frame time is at the vsync floor with 40 enemies; phones unmeasured.
