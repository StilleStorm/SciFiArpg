---
name: automode
description: Run production of Zgłoszenie autonomously, slice by slice, with the project agents, until the player says stop. Use when the player asks to work through the plan without them. Mechanical loop; the lead needs no design judgment beyond choosing the agent.
---
# Automode: the production loop

The lead (this session) runs this loop. It plans nothing itself: the plan is docs/PRODUCTION.md
(milestones, slices, briefs); the design is PLAN.md, SKILLS.md, ITEMS.md, STORY.md, DESIGN.md.
Never use the Workflow tool; never read docs/workflows/ or agent transcripts.
Agents do the work: `story` (Fable) for plan and story decisions, `builder` (Sonnet) for code,
`integrator` (Opus) for seams, gates, push and deploy, `voice` (Opus) for Polish, `tester`
(Sonnet) for end-to-end checks, `look` (Sonnet) for screenshots.

**The lead is a router, not a reader.** Its context is the budget for the whole session; aim for
under 10k tokens per slice. Agents read the docs and each other's reports from `reports/`
(docs/WORKFLOW.md "Reports"); the lead sees only their five-line replies. The lead never pastes a
report, a doc section or a plan brief into a prompt: it passes paths and slice ids.

## Before the loop
1. `/pickup` has run (STATUS read, tree clean and level with the remote). Automode needs from
   pickup only steps 1–2; skip reading slice sections and DESIGN, the agents do that.
2. Confirm the stop rule: the loop runs until the player writes "stop", or a stop condition
   below fires. Never ask the player a question inside the loop; park it instead (see Parking).

## One slice, in order
1. **Find it.** The next slice is the first in docs/PRODUCTION.md not marked done in STATUS.md.
   Read only its heading and builder list: `grep -n "^### S<n>" -A4 docs/PRODUCTION.md`. Do not
   read its Reads sections.
2. **Plan gap?** Only if the slice entry says it needs story or plan content (or a builder
   reports the brief would have to invent a rule): run `story` pointing at the slice and the gap.
   Accept its recommendations except one marked **BLOCKING FOR THE PLAYER**, which parks the
   slice (Parking).
3. **Builders.** One `builder` per builder named in the entry, in parallel when their owned files
   do not overlap (at most three). The prompt is a pointer, under 80 words:
   > Slice S<n>, builder `<name>`. Your brief: docs/PRODUCTION.md §S<n> (your builder's part) under
   > §"Standard builder header". SHOT_PORT=<4181+, unique, never 4190>, SHOT_OUT=dist-<name>,
   > SHOT_DIR=shots-<name>. Report to reports/S<n>-builder-<name>.md; reply in five lines.
   Builders do not commit.
4. **Integrate.** `integrator`: "Slice S<n>. Read reports/S<n>-builder-*.md. Close seams, run
   check/shot/smoke (and render-audio if audio changed), update ARCHITECTURE.md, commit with
   explicit paths. Do not push. Report to reports/S<n>-integrator.md."
5. **Voice.** If its reply or a builder reply says `src/i18n/pl/*.json` changed: `voice` on those
   files, "commit with explicit paths, report to reports/S<n>-voice.md".
6. **Test.** `tester`: "Slice S<n>. Read reports/S<n>-*.md. Add the smoke leg and contract tests,
   commit, report to reports/S<n>-tester.md." A RED reply → one `integrator` round pointing at
   reports/S<n>-tester.md, then `tester` again.
7. **Look.** `look`: "Slice S<n>. Review at most six PNGs flagged in reports/S<n>-builder-*.md;
   report to reports/S<n>-look.md." REDO → one `integrator` round pointing at that file, then
   `look` again. FIX verdicts ride along with the next integrator round.
8. **Gate, push, deploy, record.** `integrator`: "Slice S<n> gate-and-push. Gate by exit code
   (check, smoke), tree clean, push to <branch>, wait for the deploy of HEAD, one fix round on
   failure. Then mark S<n> done in STATUS.md with this line: <one line of what shipped>; note
   parked items; name S<n+1>; commit and push." The lead then checks only
   `git status --short | wc -l` (0) and `git log origin/<branch> -1 --oneline` (the STATUS commit).
9. **Report** to the player in at most eight lines: slice shipped, what it adds for the player,
   anything parked, what starts next. Then continue with the next slice.

## Milestones (listed in STATUS.md)
At the end of a milestone's last slice, before step 8 (the same pointer style):
- `tester` writes and runs `scripts/e2e-milestone-<n>.mjs` (whole flow, both orientations,
  frame time), report to reports/M<n>-tester.md; failures go through one `integrator` round
  each, at most two rounds.
- `look` reviews every PNG in `shots/`, report to reports/M<n>-look.md; REDO → `integrator`.
- `story` runs a **plan review**: reads STATUS and reports/M<n>-*.md plus the slices' integrator
  reports; does anything in PLAN/SKILLS/ITEMS/STORY need remaking? It writes decisions into the
  docs, may reorder the remaining slices in STATUS, parks anything that needs the player.
- `integrator` folds the milestone's ARCHITECTURE.md sections (PRODUCTION.md "Milestone end"),
  then step 8, then a milestone report to the player (twelve lines).

## Parking
A parked item is written in STATUS.md under "Needs the player" with the question, the
recommendation, and which slice waits on it (the integrator writes it in step 8; if the slice
stops before step 8, a one-line `integrator` or the lead's own small edit does). The loop
continues with the next slice that does not depend on it. If no slice can run, the loop stops.

## Retries and stop conditions
- Any agent that replies RED: one retry, pointing at its own report file. A second RED on the
  same step stops the loop.
- Step 8 RED twice on the same slice stops the loop.
- The loop also stops when the slice order is exhausted or everything is parked.
- On stop: an `integrator` (or the lead, if that is what failed) writes a "Stopped: <reason>"
  line in STATUS.md with what is committed, what is not (`git status --short`), and the next
  action; commit and push STATUS.md; tell the player in eight lines. Never leave uncommitted
  builder work without a note in STATUS.

## Context hygiene for the lead
- Never open reports/, agent transcripts, logs, screenshots or doc sections; agents do.
- Never re-paste text from one agent into another's prompt; name the file.
- Gate output the lead runs is exit codes and counts only (`; echo $?`, `| wc -l`).
- Agents run in the background; wait for their notification, never poll.
- When the session's context grows heavy, finish the current slice through step 8, then tell
  the player it is a good moment to clear; the next session resumes with `/pickup` and
  `/automode`.
