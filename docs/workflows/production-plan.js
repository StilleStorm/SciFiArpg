export const meta = {
  name: 'production-plan',
  description: 'Draft, judge, synthesize and adversarially verify the milestone/slice production plan for Zgloszenie, then write it as brief-ready docs',
  phases: [
    { title: 'Draft', detail: 'three planners, three lenses' },
    { title: 'Judge', detail: 'score and synthesize' },
    { title: 'Verify', detail: 'one skeptic per slice, repair' },
    { title: 'Write', detail: 'brief-ready PRODUCTION.md' },
  ],
}

const DOCS = `Repo: /home/user/SciFiArpg. Read, in this order, completely: docs/STATUS.md (current state, milestones, slice order, decisions), docs/PLAN.md (game shape, skill system, decisions §7, systems §8), docs/SKILLS.md (per-hero skills, paragraphs, ultimates, passives, cross-hero rules), docs/ITEMS.md (bases, affixes, sets, uniques, drops, economy, stash, drawing marks, decisions §12), docs/STORY.md (spine, ending, Anomalia and its faces, acts, delivery rules, per-planet plan still to be written), docs/WORKFLOW.md (agents and the builder protocol), .claude/skills/automode/SKILL.md (the loop that will execute the plan), .claude/agents/*.md (roles). Then DESIGN.md only §2, §3.2–3.4, §4–4.1, §5, §6, §7, §9, §10–10.3, §12, §13 (use the Contents list at the top). Skim docs/ARCHITECTURE.md headings to know what exists in code. Do not read src/.`

const CONSTRAINTS = `Production constraints (binding):
- Execution: the /automode loop (read it). Per slice: story agent (Fable) only when a plan gap exists; 1–3 builders (Sonnet) with disjoint owned folders; integrator (Opus); voice (Opus) only if Polish text changed; tester (Sonnet) adds a smoke leg; look (Sonnet) on ≤6 PNGs; lead gates by exit code, pushes, updates STATUS, reports. Milestone end: tester milestone e2e, look over all shots, story plan review. The lead is an Opus-medium model that pastes briefs and relays reports; it must not need design judgment. Every slice must therefore ship with a READY builder brief (scope, owned files, allowed additive edits, forbidden files, numbered deliverables with counts, contracts in/out, tests, screenshot env, report shape).
- Token costs observed in this project (per run): builder 250–550k, integrator 180–400k, voice 70–150k, story 130–200k, tester 150–300k, look 30–60k. A slice with 2 builders costs ≈1.2M. Aim for the fewest slices that keep each builder brief under one domain and under ~2,500 lines of change. Batch cheap things (settings, small UI) into slices that already touch their files. Voice and look per milestone where text/visuals are light; per slice where heavy.
- Each slice fits between a pickup and a clear: one loop iteration, no hidden sequencing inside it beyond what the automode steps define.
- Dependencies must be explicit and acyclic; story content slices depend on the systems they need (chapter cards need the roster + planet sequence; side tickets need the notice board + a quest primitive; NPC figures need base stations).
- Interleave story and systems: after the core systems, Akt I content must arrive early so every milestone leaves a playable, story-bearing build. MVP = Akt I (planets 1–3) + the finale frame + the roster screen + recovery + items depth sufficient for three planets. Akt II, III after.
- Per-planet story planning (STORY.md §8) is itself slice work for the story agent: plan it per act (three planets at a time), not all nine at once, and before the builders that need it.
- Content realities: Polish is the source language; all text via i18n and the voice editor; the look rules (DESIGN §3) are hard; no new rendering technique; one-thumb mobile; the existing smoke/shot/render-audio gates.
- Existing code: five heroes with five skills each (aim modes, pads), Spór, paint, base page with stations, tunnel, pause/save/bookmark, loot with reviews/compat, store, laws, audio, landscape/joystick. The hero-folder refactor + primitives library (PLAN slice 1) is the first systems slice because everything in SKILLS.md depends on it.
- Parking: anything needing the player is a parked question in STATUS, never a blocker inside a slice.`

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    ordering_rationale: { type: 'string' },
    token_rules: { type: 'array', items: { type: 'string' } },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          goal: { type: 'string' },
          playable_result: { type: 'string' },
          exit_criteria: { type: 'array', items: { type: 'string' } },
          slices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                goal: { type: 'string' },
                depends_on: { type: 'array', items: { type: 'string' } },
                reads: { type: 'array', items: { type: 'string' } },
                story_gap: { type: 'string' },
                builders: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      owns: { type: 'array', items: { type: 'string' } },
                      allowed_additive: { type: 'array', items: { type: 'string' } },
                      forbidden: { type: 'array', items: { type: 'string' } },
                      deliverables: { type: 'array', items: { type: 'string' } },
                      contracts_in: { type: 'array', items: { type: 'string' } },
                      contracts_out: { type: 'array', items: { type: 'string' } },
                      tests: { type: 'array', items: { type: 'string' } },
                      parallel_with: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['name', 'owns', 'deliverables', 'tests'],
                  },
                },
                voice_needed: { type: 'boolean' },
                look_needed: { type: 'boolean' },
                tester_leg: { type: 'string' },
                est_tokens_k: { type: 'number' },
                risks: { type: 'array', items: { type: 'string' } },
                parked_questions: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'name', 'goal', 'depends_on', 'builders', 'tester_leg', 'est_tokens_k'],
            },
          },
        },
        required: ['id', 'name', 'goal', 'playable_result', 'exit_criteria', 'slices'],
      },
    },
  },
  required: ['lens', 'ordering_rationale', 'token_rules', 'milestones'],
}

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          plan_index: { type: 'number' },
          dependency_correctness: { type: 'number' },
          buildability_per_slice: { type: 'number' },
          token_efficiency: { type: 'number' },
          story_systems_interleave: { type: 'number' },
          completeness_vs_docs: { type: 'number' },
          total: { type: 'number' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
        },
        required: ['plan_index', 'total', 'strengths', 'weaknesses'],
      },
    },
    best_ideas_to_graft: { type: 'array', items: { type: 'string' } },
  },
  required: ['scores', 'best_ideas_to_graft'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    slice_id: { type: 'string' },
    refuted: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string' } },
    fix: { type: 'string' },
  },
  required: ['slice_id', 'refuted', 'reasons', 'fix'],
}

const LENSES = [
  { key: 'dependency', prompt: 'Lens: DEPENDENCY AND CONTRACT FIRST. Order by what the code needs: refactors and primitives before content, contracts named per slice, no slice touching the same files as another in the same milestone. Be exact about owned folders and the contracts each slice must publish in ARCHITECTURE.md.' },
  { key: 'player-value', prompt: 'Lens: EARLIEST PLAYABLE STORY. Every milestone must end in a build the player can enjoy with visible story: get Akt I content in as early as the systems allow, defer depth that does not show. Define what the player sees at the end of each milestone.' },
  { key: 'token-cost', prompt: 'Lens: TOKEN COST. Fewest loop iterations, maximum safe parallelism of builders with disjoint folders, batching of small features into slices that already touch their files, voice/look per milestone where cheap, story planning per act. Give est_tokens_k per slice honestly from the observed costs and a total to MVP.' },
]

phase('Draft')
const drafts = (await parallel(LENSES.map((l) => () => agent(
  `You are a production planner for the game Zgłoszenie. ${DOCS}\n\n${CONSTRAINTS}\n\n${l.prompt}\n\nProduce the complete milestone/slice plan to a finished game (MVP = Akt I + finale frame; then Akt II, Akt III, polish), as the schema. Every slice must carry builder entries with owned folders (paths under src/, scripts/, docs/, src/i18n/pl/), allowed additive edits, forbidden files, numbered deliverables with counts, contracts in/out, tests, and the tester leg. Mark story_gap with the exact STORY.md section the story agent must fill before the slice, or an empty string. Keep names in English; game text names in Polish.`,
  { label: `draft:${l.key}`, phase: 'Draft', schema: PLAN_SCHEMA, model: 'fable' }
)))).filter(Boolean)
log(`${drafts.length} plan drafts`)

phase('Judge')
const judged = (await parallel([0, 1, 2].map((j) => () => agent(
  `You judge production plans for the game Zgłoszenie. ${DOCS}\n\n${CONSTRAINTS}\n\nHere are ${drafts.length} plans as JSON:\n${drafts.map((d, i) => `PLAN ${i} (${d.lens}):\n${JSON.stringify(d)}`).join('\n\n')}\n\nScore each plan 1–10 on: dependency_correctness (acyclic, every contract a slice relies on is produced earlier), buildability_per_slice (each builder entry is one domain, one brief, disjoint folders when parallel), token_efficiency (fewest iterations, honest estimates), story_systems_interleave (playable story at every milestone, Akt I early, story planning per act before its builders), completeness_vs_docs (nothing decided in PLAN/SKILLS/ITEMS/STORY/DESIGN is missing, nothing undecided is invented). total = sum. List strengths and weaknesses per plan and the best ideas to graft from the losers. Judge ${j + 1} of 3: be independent.`,
  { label: `judge:${j + 1}`, phase: 'Judge', schema: SCORE_SCHEMA, model: 'opus' }
)))).filter(Boolean)
const totals = drafts.map((_, i) => judged.reduce((s, r) => s + ((r.scores.find((x) => x.plan_index === i) || {}).total || 0), 0))
const winner = totals.indexOf(Math.max(...totals))
log(`judge totals: ${totals.join(' / ')} → winner plan ${winner} (${drafts[winner].lens})`)

const synthesized = await agent(
  `You synthesize the final production plan for the game Zgłoszenie. ${DOCS}\n\n${CONSTRAINTS}\n\nWINNING PLAN:\n${JSON.stringify(drafts[winner])}\n\nOTHER PLANS:\n${drafts.filter((_, i) => i !== winner).map((d) => JSON.stringify(d)).join('\n\n')}\n\nJUDGES' VERDICTS (strengths, weaknesses, ideas to graft):\n${JSON.stringify(judged)}\n\nProduce ONE final plan as the schema: the winner's structure, with the judges' weaknesses fixed and the best ideas grafted. Every slice complete (builders with owned folders, allowed, forbidden, numbered deliverables with counts, contracts, tests, tester leg, est_tokens_k, risks, parked_questions). Dependencies acyclic. Story planning per act scheduled as story-agent slices before their builders. Total est tokens to MVP stated in ordering_rationale.`,
  { label: 'synthesize', phase: 'Judge', schema: PLAN_SCHEMA, model: 'fable' }
)
if (!synthesized) throw new Error('synthesis failed')
const allSlices = synthesized.milestones.flatMap((m) => m.slices.map((s) => ({ ...s, milestone: m.id })))
log(`synthesized: ${synthesized.milestones.length} milestones, ${allSlices.length} slices`)

phase('Verify')
const ids = new Set(allSlices.map((s) => s.id))
const verdicts = (await pipeline(
  allSlices,
  (s) => agent(
    `You are a skeptic checking ONE slice of a production plan for the game Zgłoszenie, trying to REFUTE that it is buildable as written by the /automode loop. ${DOCS}\n\nSLICE:\n${JSON.stringify(s)}\n\nALL SLICE IDS IN THE PLAN (for dependency checks): ${[...ids].join(', ')}\n\nRefute if any holds: a dependency names a slice id that does not exist or comes later in the same milestone list order; two builders in this slice own overlapping folders; a builder brief is more than one domain or would need design decisions not in the docs (name them); a contract_in is not produced by an earlier slice or by existing code (check ARCHITECTURE.md headings); the deliverables lack counts or are vague; the tester leg cannot be asserted through the test hook or real taps; est_tokens_k is implausible against the observed costs; a story_gap is needed but not named; the slice violates a decided rule in PLAN §7/§8, ITEMS §12, STORY, DESIGN §3. Default to refuted=true if uncertain, and give a concrete fix.`,
    { label: `skeptic:${s.id}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: 'sonnet', effort: 'medium' }
  )
)).filter(Boolean)
const refuted = verdicts.filter((v) => v.refuted)
log(`${refuted.length}/${verdicts.length} slices refuted`)

let finalPlan = synthesized
if (refuted.length) {
  finalPlan = await agent(
    `You repair a production plan for the game Zgłoszenie. ${DOCS}\n\n${CONSTRAINTS}\n\nPLAN:\n${JSON.stringify(synthesized)}\n\nREFUTED SLICES WITH REASONS AND FIXES:\n${JSON.stringify(refuted)}\n\nReturn the whole plan as the schema with every refutation addressed (split, reorder, add contracts, add counts, name story gaps, fix estimates). Keep everything else unchanged. Dependencies acyclic.`,
    { label: 'repair', phase: 'Verify', schema: PLAN_SCHEMA, model: 'fable' }
  ) || synthesized
  const again = (await pipeline(
    refuted.map((v) => finalPlan.milestones.flatMap((m) => m.slices).find((s) => s.id === v.slice_id)).filter(Boolean),
    (s) => agent(
      `Re-check ONE repaired slice of a production plan for the game Zgłoszenie; try to refute buildability as before. ${DOCS}\n\nSLICE:\n${JSON.stringify(s)}\n\nALL SLICE IDS: ${finalPlan.milestones.flatMap((m) => m.slices.map((x) => x.id)).join(', ')}\n\nRefute only for a concrete, remaining problem; give the fix.`,
      { label: `recheck:${s.id}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: 'sonnet', effort: 'medium' }
    )
  )).filter(Boolean)
  log(`after repair: ${again.filter((v) => v.refuted).length} still refuted (listed in the doc as risks)`)
  finalPlan.still_refuted = again.filter((v) => v.refuted)
}

phase('Write')
const doc = await agent(
  `You write the production plan document for the game Zgłoszenie from a verified JSON plan. ${DOCS}\n\nPLAN JSON:\n${JSON.stringify(finalPlan)}\n\nWrite docs/PRODUCTION.md as Markdown and return ONLY its full text. Structure: (1) title and a 10-line summary: milestones, MVP, total estimated tokens, the token rules; (2) a milestone table (id, name, goal, playable result, exit criteria, slices); (3) for EVERY slice, in order, a section "### <id> <name>" with: goal; depends on; reads (doc sections); story gap (which STORY.md section the story agent fills first, with a 3-line brief for it) or "none"; then one "#### Builder brief: <name>" block per builder, written as the text the lead will paste verbatim into the builder agent (scope; own; allowed additive edits; forbidden; numbered deliverables with counts; contracts you may rely on; contracts you must provide; screenshots with a unique SHOT_PORT (4181–4189, 4191–4199, never 4190); tests; report shape; the sentence "Do not commit."); then "Voice: yes/no", "Look: yes/no (which shots)", "Tester leg: …", "Estimate: … k tokens", "Risks", "Parked questions". (4) a final section "Still refuted at planning time" listing any entries in still_refuted with their reasons, as known risks for the integrator. Keep game names in Polish, text in English, the clerk's register for any Polish example. Do not invent decisions; where the JSON is silent, say "per docs". Length as needed.`,
  { label: 'write-doc', phase: 'Write', model: 'opus' }
)
return { summary: { milestones: finalPlan.milestones.map((m) => ({ id: m.id, name: m.name, slices: m.slices.map((s) => s.id) })), still_refuted: finalPlan.still_refuted || [], ordering_rationale: finalPlan.ordering_rationale, token_rules: finalPlan.token_rules }, doc }