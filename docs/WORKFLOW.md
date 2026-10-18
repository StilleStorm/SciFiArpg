# How work is divided on Zgłoszenie

Lead (Fable, the planning model) writes the brief and the phase plan, decides scope, and reviews.
Builders (Sonnet) build bounded pieces in parallel. The integrator (Opus) owns the seams. The
voice editor (Opus) owns the Polish. The look reviewer (Sonnet) judges screenshots. Agents are
defined in `.claude/agents/` and picked by name. The `story` agent (Fable) plans storyline,
chapters, characters and plan decisions when the lead is absent; its benchmark is "did the
Diablo games have it?".

## Phases of any feature batch
1. **Plan** (lead): update DESIGN.md first; the brief is the source of truth, not the chat.
2. **Skeleton or contract** (lead or integrator): before parallel work, the seams are written
   down in ARCHITECTURE.md: event names and payloads, state flags with owners, exported APIs
   each domain provides, entity kinds. Builders code against the contract, not against each
   other's files.
3. **Build** (builders, in parallel, one per domain): each brief lists owned files, allowed
   shared files, forbidden files, the screenshot port/dirs, and the report shape (see the
   builder agent). Builders do not commit.
4. **Integrate** (integrator): closes every `// SEAM:`, runs the smoke play-through, measures
   frame time, reviews screenshots, updates ARCHITECTURE.md, commits.
5. **Voice** (voice editor): after content batches, edits `src/i18n/pl/*.json`.
6. **Gate and push** (lead): `npm run check` green, screenshots reviewed, push.

## Builder protocol (the short version builders must follow)
- Own your folders; additive edits only in allowed shared files; re-read before each edit.
- All text through `t()`; voice per DESIGN §12.
- Need something from another domain that is not in ARCHITECTURE.md: code against a typed
  stub with `// SEAM: <what you need from whom>` and list it in the report. Do not reach into
  the other domain.
- After rendering or UI changes: run shots with your own `SHOT_PORT`, `SHOT_OUT`, `SHOT_DIR`,
  open the PNGs, judge against the ban list.
- Green before reporting: `npm run typecheck && npm test && npm run lint:rules && npm run build`
  (and `npm run smoke` when the run flow is touched).

## Brief template (lead → builder)
```
Scope: <one domain>, DESIGN §<n> (list the subsections).
Own: <folders/files>. Allowed additive edits: <shared files>. Forbidden: <files>.
Deliverables: <numbered, concrete, with sizes and counts>.
Contracts you may rely on: <APIs/events/flags from ARCHITECTURE.md>.
Contracts you must provide: <exports/events with exact signatures>.
Screenshots: SHOT_PORT=<n> SHOT_OUT=dist-<name> SHOT_DIR=shots-<name>; add scripts/shot-<name>.mjs if needed.
Tests: <which pure functions>.
Report shape: files; shared-file edits; new events/fields/flags/APIs; SEAM list; unfinished; screenshot verdict.
```

## Gates
- `npm run lint:rules`: Polish literals in code, `any`, non-null `!`, setTimeout, emoji,
  gradients/shadows/blur/rounded cards/sans-serif in CSS, gradient/blur SVG primitives.
- `npm run check`: typecheck + tests + lint:rules + build.
- `npm run shot`, `npm run smoke`: look and flow. The smoke script fails on page errors and on
  any missed flow step; it prints the 40-enemy frame time.

## Model choice, in short
- Sonnet: anything with a clear brief and owned files. Content, systems, screens, drawings,
  tests, scripts. Use it for as much as possible.
- Opus: seams between domains, flow bugs across folders, performance, Polish text quality.
- Fable (lead): the brief, the plan, scope decisions, the final review.
