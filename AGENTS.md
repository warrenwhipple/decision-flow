# AGENTS.md

This repo is `decision-flow`, Warren's prototype QOC/IBIS based decision ontology project.

## Repo structure

- `skills/decision-mode/` - dead-simple prototype agent skill for decision-centered work
- `docs/experience/` - repo-local timestamped dogfood field notes and auto-ethnographic observations
- `docs/reports/` - timestamped research and capability reports that synthesize findings from experiments

## Building `decision-mode` skill

Warren is actively building and iterating on `decision-mode`.
But it is too early and confusing to run it on itself.
Warren is using [`HITL.md`](HITL.md) (a human owned status file) to drive development.
When Warren asks you to "check HITL" or "review HITL", only audit it for claims
that are now false or based on false assumptions. Do not treat its `Next`
section as an instruction to start coding unless Warren separately asks for that
work.
The `decision-mode` SKILL.md is symlinked into both Codex and Claude Code global user skills for dogfooding in OTHER repos.
You may read the `decision-mode` SKILL.md, but do NOT invoke it directly here.
Do NOT create a `DECISION.md` file here.

## Dogfood repos

These sibling repos are common places where Warren dogfoods `decision-mode`.
When work in this repo needs examples, field notes, or live comparison points
from actual use, look in these repos as needed:

- [`blog`](../blog) - Warren's public blog, live now
- [`convergence`](../convergence) - Warren's person focused work method, in use now
- [`lightsight`](../lightsight) - star system game with distance delayed vision and control, early prototype
- [`reversal-ledger`](../reversal-ledger) - ledger of various poublic commentator reversals on AI capability/risk, early prototype
- [`timeline-tool`](../timeline-tool) - displays dynamic timelines for blog posts, early prototype
- [`turtlefood`](../turtlefood) - LLM/harness evals for AI tools building AI tools, early prototype

## Related docs and notes repos

- [`notes`](../../notes) - Warren's personal Obsidian notes vault
- [`thinking`](../../notes/thinking) - Warren's personal method, templates, and notes for thinking with AI, nested git repo in `notes`

## Helpful context

Lookup as needed

- `../../notes/thinking/topics/decision-flow/mission-control.md` - Obsidian working hub for Decision Flow knowledge work; use its Core Context section as the current top-level map
- `../../notes/thinking/topics/decision-flow/vision.md` - Decision Flow product vision and rationale
- `../../notes/thinking/topics/decision-flow/ai-coding-trajectory-framing.md` - framing around the broader AI coding tool trajectory
- `../../notes/thinking/topics/decision-flow/intellectual-history-decision.md` - decision-oriented intellectual history
- `../../notes/thinking/topics/decision-flow/intellectual-history-flow-state.md` - flow-state intellectual history
- `skills/decision-mode/SKILL.md` - prototype agent behavior

## Local live edit

- `~/.agents/skills/decision-mode` symlinks to `skills/decision-mode`
