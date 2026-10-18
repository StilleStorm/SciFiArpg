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

## Game plan (accepted 2026-10-18) and the slice order
The plan lives in docs/PLAN.md (game shape, skill system, slices), docs/SKILLS.md (per-hero
skills, paragraphs, ultimates, passives, loadouts), docs/ITEMS.md (bases, affix pool, sets,
legendary paragraphs, item level, drops, economy, stash, drawing marks); the accepted skill
system is DESIGN §10.2–10.3. All open questions are answered (PLAN §7, ITEMS §12). Each slice = one builder brief + integrator + voice + push,
between a pickup and a clear. Order:
1. Hero folder refactor + registry + primitives extracted from current skills; no behaviour
   change; the contract test (PLAN slice 1).
2. Paragraph system on existing skills + unlock schedule + the aktualizacja form offering
   them (PLAN 2).
3. Argument meter + ultimate pad (stamp pad above the three in portrait) + one ultimate per
   hero (PLAN 3).
4. Loadout form "Konfiguracja" at the desk and in the pause sheet; categories shown; the Karta
   uprawnień chart with three specializations and capstones (PLAN 4, DESIGN §10.3).
5. Items: affix pool, tiers I–V, name grammar (ITEMS slice a); bases to 40 with drawings (b).
6. Per-hero skill fill-in to 10–11 + 3 ultimates, one hero per slice, from SKILLS.md (PLAN 5,
   five slices).
6a. Character roster screen: create/pick a character, per-character progress, bag and archive,
    one shared Archiwum (PLAN §7). Replaces "Zmień profil".
7. Priorytet zgłoszenia + planet sequence + final ticket + climbing difficulty + free travel
   back to closed planets from the desk (PLAN 6, §7; the story plan supplies the texts).
8. Items: item level, drops, Sklep stock (ITEMS c); drawing marks (d); sets + legendary
   paragraphs (e); Reklamacja, Archiwum, sinks (f).
9. `npm run new-hero` + template + checklist (PLAN 8).
10. Przesyłka/paczkomat deliveries; tap an item on the ground to see its card.
10a. Review additions (PLAN §8): potwierdzenia recovery with the pocket button and auto-use;
    teczki, pieczęcie and page events; elite packs and named elites; Karta osobowa; persistent
    storage + save export/import; damage numbers setting; bug button; text size. Potwierdzenia
    and the Karta osobowa go early (right after slice 3), the rest with their nearest slice.
11. Balance pass from play; the first-run on-ramp footnotes; phone-feedback bucket; the polish
    bucket (landscape clause header, Odwirowanie knockback, appeal-form drawing, cookie-banner
    paper, simpler Wygenerowane, "utwór nr N", three missing sounds, stereo panning, Spór and
    other text voice passes).
Later: heavy-metal music profile, more laws/uniques/parts, English, Cloudflare + Play Store.
Far future: endgame beyond "zgłoszenia dodatkowe", multiplayer.

**Storyline (2026-10-18):** proposed in docs/STORY.md at Diablo length and shape, after three
rounds with the player (no MVP cut; Diablo hours; a cosmic horror and Diablo variety). Five acts,
sixteen planets; each planet is an act's worth of play: four pisma (quest runs on five target
primitives), two pisma dodatkowe, a boss run, załącznik page chains; 16–20 h mandatory, 22–26 h
with side tickets. Plot: the personal ticket meets the Zjawisko (sygn. 1), a phenomenon that
replaces the galaxy with its probable version; the hero's file is too improbable to average, so
the Komisja sends them as courier; the hero stops it 11 months before the law would have banned
it; the Komisja is displeased (paperwork void, no legal basis) and opens case 48214 against the
hero, which frames the endgame tickets. Variety: five document worlds, six zone types, six
families with about thirty species (new: Formularze, Opinie, Uśrednione), nine new clauses,
thirteen new bosses. Twelve open questions (STORY §14). Nothing from it is built.

**Next pickup:** read the player's answers to STORY §14 (or ask them if none), record the
decisions in STORY as a "Decisions" section, fold the accepted parts into DESIGN as §4.2
"Campaign" (families and species into §6, clauses into §4, worlds and zones into §3/§4, the
Kartoteka into §10's hero-select paragraph), re-cut the slice order in PLAN §5 and here (the
pismo system, worlds, species and boss slices join around slice 7); then start slice 1.

## Known limits
- iOS ignores orientation locks; the setting only picks the layout there.
- Service worker: after a deploy, reload once (installed app: close and reopen).
- Headless Chromium frame time is at the vsync floor with 40 enemies; phones unmeasured.
