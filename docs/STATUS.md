# Status and handoff

Read this first in a new session, then CLAUDE.md, docs/WORKFLOW.md, docs/DESIGN.md, docs/ARCHITECTURE.md.
Keep this file current: it replaces chat memory.

## Where things are (2026-10-17, late evening)
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
- In progress at the time of writing: **controls build** (Sonnet builder): landscape default,
  orientation setting, floating joystick with a steering setting, landscape layout, the
  one-letter-word typography rule (DESIGN §2 and §12.1). After it: integrator pass, voice pass
  on ui.json/screens.json, push.

## Gates and commands
`npm run check` (typecheck, tests, lint:rules, build) · `npm run shot` · `npm run smoke`
(flow play-through + 40-enemy frame time) · `npm run render-audio` (levels, body band, clipping).
Agents: `.claude/agents/` (builder=Sonnet, integrator=Opus, voice=Opus, look=Sonnet). They
load at session start. Division of work: docs/WORKFLOW.md.

## Decisions taken in chat that are already in DESIGN.md
Modern absurdity mapping (§0–§10), fonts (Michroma/Space Mono/EB Garamond), combat b+d now
and c (Spór) next (§5), sound anchors and per-planet profiles (§14), landscape default +
joystick/tap steering (§2), editorial rules (§12.1).

## Open feedback wanted from the player
- Real-phone frame rate with a crowd; tap accuracy; joystick feel once it lands.
- Sound levels: music is −12 dB under SFX by design; the sliders' comfortable values become
  the new defaults.
- Whether bubbles/figures are readable at phone size.

## Backlog, in order
1. Integrate controls build; voice pass on ui.json/screens.json; push.
2. Spór for bosses (DESIGN §5.4).
3. Przesyłka / paczkomat deliveries (§7), tap an item on the ground to see its card first (§2).
4. Odwirowanie knockback distance; appeal-form pickup drawing; Ciasteczka empty paper behind the
   banner; Wygenerowane drawings are the busiest (simplify); "Muzyka na czekanie, utwór nr N"
   shown somewhere; sounds for enemy:miss / offTopic / gwiazdki pickup; stereo panning.
5. Heavy-metal music profile (own anchor and ban list to be written first).
6. More fidget animation, more laws/uniques/parts, quests as ticket correspondence, English.
7. When the game is fuller: move hosting to the player's Cloudflare (custom domain), then Google
   Play via Trusted Web Activity (PWABuilder/Bubblewrap; needs /.well-known/assetlinks.json at
   the origin root, a privacy policy URL, the 12-tester closed test; developer account exists).

## Known limits
- iOS ignores orientation locks; the setting only picks the layout there.
- Service worker: after a deploy, reload once (installed app: close and reopen).
- Headless Chromium frame time is at the vsync floor with 40 enemies; phones unmeasured.
