---
name: automode
description: Run production of Zgłoszenie autonomously, slice by slice, with the project agents, until the player says stop. Use when the player asks to work through the plan without them. Mechanical loop; the lead needs no design judgment beyond choosing the agent.
---
# Automode: the production loop

The lead (this session) runs this loop. It plans nothing itself: the plan is in docs
(STATUS.md slice order and milestones, PLAN.md, SKILLS.md, ITEMS.md, STORY.md, DESIGN.md).
Agents do the work: `story` (Fable) for plan and story decisions, `builder` (Sonnet) for code,
`integrator` (Opus) for seams and gates, `voice` (Opus) for Polish, `tester` (Sonnet) for
end-to-end checks, `look` (Sonnet) for screenshots. The lead briefs, waits, gates by exit code,
commits, pushes, updates STATUS.md, reports, and continues.

## Before the loop
1. `/pickup` has run (STATUS read, tree clean and level with the remote).
2. Confirm the stop rule: the loop runs until the player writes "stop", or a stop condition
   below fires. Never ask the player a question inside the loop; park it instead (see Parking).

## One slice, in order
1. **Read** the next slice entry in STATUS.md "slice order" and only the sections it names.
   Budget: under 10k tokens of reading per slice.
2. **Plan gap?** If the slice needs content or decisions not yet written in the docs (per-planet
   content, NPC lines, a rule the brief would have to invent), run `story` with a brief naming
   the gap and the doc section to fill. Accept its recommendation on every open question except
   one it marks **BLOCKING FOR THE PLAYER**; a blocking question parks the slice (Parking).
3. **Brief builders.** Write one brief per builder from the template in docs/WORKFLOW.md:
   scope, owned files, allowed additive edits, forbidden files, deliverables with counts, the
   contracts to rely on and to provide, screenshot env (`SHOT_PORT` unique per builder, 4181+,
   never 4190), tests, report shape. Split a slice into at most three builders with disjoint
   folders; run them in parallel only when their owned files do not overlap. Builders do not
   commit.
4. **Integrate.** Run `integrator` with every builder report pasted in. It closes `// SEAM:`
   stubs, runs `npm run check`, `npm run shot`, `npm run smoke` (and `npm run render-audio`
   when audio changed) by exit code, updates docs/ARCHITECTURE.md, commits with explicit paths.
5. **Voice.** If any `src/i18n/pl/*.json` changed, run `voice` on those files only. Commit its
   result with explicit paths.
6. **Test.** Run `tester` to add the slice's smoke leg and contract tests; if it reports a
   failure, run `integrator` once with the reproduction to fix it, then `tester` again. Commit.
7. **Look.** Run `look` on at most six PNGs the builders flagged. A REDO verdict → one
   `integrator` round with the exact violation, then `look` again. FIX verdicts ride along.
8. **Gate and push.** The lead runs `npm run check; echo $?` and `npm run smoke; echo $?`; both
   must print 0. Then `git status --short | wc -l` must print 0 (everything committed), then
   `git push -u origin <branch>`. Wait for the deploy with the curl loop from `/pickup` until
   `completed success`. A failed deploy → read the job, one `integrator` round, push again.
9. **Record.** Update STATUS.md: mark the slice done with one line of what shipped, note
   anything parked, name the next slice. Commit and push STATUS.md.
10. **Report** to the player in at most eight lines: slice shipped, what it adds for the player,
    anything parked, what starts next. Then continue with the next slice.

## Milestones (listed in STATUS.md)
At the end of a milestone's last slice, before its push:
- `tester` writes and runs `scripts/e2e-milestone-<n>.mjs` (whole flow, both orientations,
  frame time); failures go through one `integrator` round each, at most two rounds.
- `look` reviews every PNG in `shots/` (the stock set) and reports; REDO → `integrator`.
- `story` runs a **plan review**: given STATUS and the reports of the milestone, does anything
  in PLAN/SKILLS/ITEMS/STORY need remaking? It writes decisions into the docs and may reorder
  the remaining slices in STATUS; it parks anything that needs the player.
- Then the gate and push as for a slice, and a milestone report to the player (twelve lines).

## Parking
A parked item is written in STATUS.md under "Needs the player" with the question, the
recommendation, and which slice waits on it. The loop continues with the next slice that does
not depend on it. If no slice can run, the loop stops (Stop).

## Retries and stop conditions
- Any agent that fails or reports gates red: one retry with the failure pasted in. A second
  failure on the same step stops the loop.
- A gate the lead runs that fails twice in a row on the same slice stops the loop.
- The loop also stops when the slice order is exhausted or everything is parked.
- On stop: STATUS.md gets a "Stopped: <reason>" line with what is committed, what is not
  (`git status --short`), and the next action; commit and push STATUS.md; tell the player in
  eight lines. Never leave uncommitted builder work without a note in STATUS.

## Context hygiene for the lead
- Never read agent transcripts, test logs beyond their last lines, or screenshot folders;
  the agents report, the lead relays.
- Keep every agent brief under 600 words by pointing at doc sections instead of restating them.
- One report line per slice in STATUS, not a diary.
- When the session's context grows heavy, finish the current slice through step 9, then tell
  the player it is a good moment to clear; the next session resumes with `/pickup` and
  `/automode`.
