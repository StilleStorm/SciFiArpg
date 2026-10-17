# Zgłoszenie — rules for agents working in this repo

Read `docs/DESIGN.md` first, whole. It is the source of truth for mechanics, look, and voice.
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
- `npm install` · `npm run dev` · `npm run build` · `npm test` · `npm run shot` · `npm run typecheck`
- Everything must pass `npm run typecheck && npm test && npm run build` before a commit.

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
  combat/            damage.ts (types, resist, crit, racja vocab), claims.ts (teza/rebuttal), status.ts, spor.ts (stub), targeting
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
