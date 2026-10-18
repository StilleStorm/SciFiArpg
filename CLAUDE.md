# Zgłoszenie — rules for agents working in this repo

Start of a session: read `docs/STATUS.md` (short, the handoff), then only the `docs/DESIGN.md`
sections the task needs (it has a table of contents; it is the source of truth for mechanics,
look and voice) and the `docs/ARCHITECTURE.md` sections for the code you will touch. Do not
read the whole brief or whole screenshots folders at start; context is a budget.
This file is about how we build.

## Stack (fixed)
- TypeScript (strict), Vite, **SVG rendered in the DOM**. No Canvas, no WebGL, no UI framework,
  no CSS framework, no icon font, no emoji.
- `vite-plugin-pwa` for manifest + service worker. Deployed to GitHub Pages by
  `.github/workflows/deploy.yml` (base path `/SciFiArpg/`).
- Tests: `vitest` for pure logic (combat formulas, item grammar, loot rolls, laws, i18n).
- Screenshots: `npm run shot` renders key screens with Playwright + the bundled Chromium
  (`executablePath: '/opt/pw-browsers/chromium'` or via `PLAYWRIGHT_BROWSERS_PATH`) into
  `shots/`. Any change to rendering or UI must be followed by `npm run shot` and a look at the PNGs.
- Fonts live in `public/fonts/` (OFL). Load with `@font-face` only.

## Commands
- `npm install` · `npm run dev` · `npm run build` · `npm test` · `npm run shot` · `npm run smoke` · `npm run typecheck` · `npm run lint:rules` · `npm run check`
- Everything must pass `npm run check` (typecheck, tests, lint:rules, build) before a commit; `npm run smoke` when the run flow is touched.

## How work is divided
See `docs/WORKFLOW.md`. Builders (Sonnet) own folders and code against the contracts in `docs/ARCHITECTURE.md`; the integrator (Opus) closes every `// SEAM:`; the voice editor (Opus) owns `src/i18n/pl/*.json`; the look reviewer judges screenshots. Agent definitions are in `.claude/agents/`. Any need from another domain that is not in ARCHITECTURE.md becomes a typed stub with a `// SEAM:` comment, never a reach into the other domain's files.

## Architecture
Plain data + pure functions + one thin render layer. No classes with deep hierarchies.
```
src/
  main.ts            boot, screen router (title → akta → baza → bieg → śmierć)
  core/              loop (fixed 60 Hz step, rAF render), rng (seeded, mulberry32), events (typed bus), vec
  i18n/              t(), plural rules, gender helper, pl/*.json by domain
  render/            svg helpers, paper + ink filter defs, camera (viewBox), entity view sync,
                     stamp(), inkBlot(), strike(), drawIn(), footnote area, night edition
  world/             run generation, pages, obstacles, page turn, laws (modifiers)
  entities/          types for player, enemy, projectile, pickup, summon; spatial grid
  systems/           per-step systems (movement, combat, ai, pickups) and their fixed order (step.ts)
  combat/            damage.ts (types, resist, crit, racja vocab), claims.ts (teza/rebuttal), status.ts, spor.ts (stub), targeting
  audio/             context, mix (buses, limiter, ducking), sfx recipes, bindings (events -> sounds), music/ (profiles, roll, holdline, adapt, scheduler)
  enemies/           parts (SVG part library as path data), assemble (procedural contraption),
                     families (stats, resist, traits: defect / escalation / existence), ai, bosses
  items/             bases, affixes, grammar (gender agreement), generate, audit, opinions, warranty, uniques
  heroes/            four hero definitions, skills, quirks
  progression/       xp, wniosek o awans, attachments, appeal
  death/             three outcomes
  economy/           stamps, forms, kiosk, vendor lies, office hours
  narration/         footnotes (incl. wrong ones + corrections), expedition log
  ui/                form HUD, plates/inventory, modal forms, screens, settings (night, left-handed)
  save/              localStorage schema with version
```
- Game state is a single plain object (`RunState`, `MetaState`); systems are functions
  `(state, dt) => void`. Rendering reads state and patches SVG attributes; it never owns state.
- Every entity gets one `<g data-id>` created on spawn and removed on despawn. Per frame only
  `transform` and a few attributes change. Never rebuild innerHTML in the loop.
- All random rolls go through the seeded rng so runs are reproducible from a seed.
- No `any`. No `!` non-null assertions outside tests. No `setTimeout` for game logic (use the
  loop's timers).

## i18n rules
- No Polish (or any) user-facing string literal in `.ts` files. Use `t('domain.key')`.
- Generated names use `items/grammar.ts` with gender forms; see DESIGN §11.
- Plural forms via `t()` with `{count}`; Polish has one/few/many.

## Look rules (short form; full list in DESIGN §3)
Cream paper, black ink strokes, one red accent, Michroma titles + Space Mono forms + Garamond narration, wobble filter on the
world group, drawn-in spawns, crossed-out deaths, ink blots for hits, stamps for events,
HUD as a filled form, footnotes as tooltips. No gradients, glow, shadows, blur, neon, rounded
glass cards, emoji, icon fonts, sans-serif, particle bursts, big shake.

## Git
- Commit small, descriptive, imperative. No emoji. Never mention model names in commits.
- Do not add dependencies beyond: vite, typescript, vitest, vite-plugin-pwa, playwright-core
  (dev). Ask before anything else.
