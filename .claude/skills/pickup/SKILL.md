---
name: pickup
description: Resume work on Zgłoszenie in a fresh session from the repo's handoff files, reading only what the next task needs. Use right after a clear or at the start of a new session instead of reading the conversation history.
---
# Pickup: resume from files, not from history

Budget: under 15k tokens of reading before the first action. Do not open screenshots, test
logs, agent transcripts or the whole brief. Do not summarise the history; there is none to read.

1. `docs/STATUS.md` whole (about 1k words). It holds: where things are, the latest player
   feedback and what was done, the ordered backlog, known limits, the gates.
2. `git status --short && git log --oneline -8 && git fetch -q origin && git status -sb | head -1`.
   The tree must be clean and level with the remote; if not, read the diff before anything else.
3. The next backlog item in STATUS.md names its DESIGN sections. Open `docs/DESIGN.md` only at
   those section headings (use the Contents list at the top; `grep -n "^## \|^### " docs/DESIGN.md`
   gives line numbers, then read that range). Always also §3.2–§3.3 if the task touches rendering
   or UI, §12 if it touches Polish text.
4. `docs/ARCHITECTURE.md` only the sections for the code the task touches (grep its headings).
5. `docs/WORKFLOW.md` only when about to spawn agents (builder = Sonnet, integrator = Opus,
   voice = Opus, look = Sonnet; definitions in `.claude/agents/`).
6. Then act: write the builder brief from the template in WORKFLOW.md, or start the task.
   The lead (this session) plans, briefs, reviews screenshots, gates by exit code
   (`npm run check; echo $?`, likewise shot and smoke), commits, pushes, and keeps STATUS.md current.

Rules of thumb that cost tokens when forgotten:
- Gate with exit codes, never by grepping output.
- Deploy status: `curl -sS -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/StilleStorm/SciFiArpg/actions/runs?branch=claude/scifi-arpg-concept-6vqk36&per_page=3"` and read `status`/`conclusion` of the run whose `head_sha` matches HEAD; no MCP needed.
- Screenshot review: open at most two or three PNGs per build, the ones the builder flags.
- Update STATUS.md in the same commit as the feature; it is the next session's memory.
