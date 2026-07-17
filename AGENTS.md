# AGENTS.md

This repo is `decision-flow`, Warren's prototype QOC/IBIS based decision ontology project.

## Repo structure

- `MIRROR.md` - human-owned mental mirror for overall project direction across prototypes
- `docs/MIRROR-decision-mode.md` - human-owned mental mirror scoped to the backburnered `decision-mode` prototype
- `docs/design-space.md` - human-owned, manually maintained structured map of the Decision Flow design space
- `docs/vision.md` - Decision Flow product vision and rationale
- `skills/decision-mode/SKILL.md` - prototype agent skill for decision-centered work
- `docs/experience/` - repo-local timestamped dogfood field notes and auto-ethnographic observations
- `docs/experience/insights.md` - rolling, agent-editable synthesis of dogfood insights, feature threads, open questions, and handled learnings
- `docs/reports/` - timestamped research and capability reports that synthesize findings from experiments

## `decision-mode` skill

Work on `decision-mode` is backburnered while Warren tries simpler prototypes.
Do not assume it is the current implementation focus. It is still too early and
confusing to run `decision-mode` on itself.

Use [`docs/experience/insights.md`](docs/experience/insights.md) for rolling
dogfood synthesis and feature/open-question tracking, not either human-owned
mirror.
The `decision-mode` SKILL.md is symlinked into Codex global user skills for dogfooding in OTHER repos.
You may read the `decision-mode` SKILL.md, but do NOT invoke it directly here.
Do NOT create a `DECISION.md` file here.

## Dogfood repos

These sibling repos are common places where Warren dogfoods `decision-mode`.
When work in this repo needs examples, field notes, or live comparison points
from actual use, look in these repos as needed:

- [`blog`](../blog) - Warren's public blog, live now
- [`convergence`](../convergence) - Warren's person focused work method, in use now
- [`lightsight`](../lightsight) - star system game with distance delayed vision and control, early prototype
- [`reversal-ledger`](../reversal-ledger) - ledger of various public commentator reversals on AI capability/risk, early prototype
- [`timeline-tool`](../timeline-tool) - displays dynamic timelines for blog posts, early prototype
- [`turtlefood`](../turtlefood) - LLM/harness evals for AI tools building AI tools, early prototype

## Related docs and notes repos

- [`notes`](../../notes) - Warren's personal Obsidian notes vault
- [`thinking`](../../notes/thinking) - Warren's personal method, templates, and notes for thinking with AI, nested git repo in `notes`

## Helpful context

Lazy read as needed

- `../../notes/thinking/topics/decision-flow/ai-coding-trajectory-framing.md` - framing around the broader AI coding tool trajectory
- `../../notes/thinking/topics/decision-flow/intellectual-history-decision.md` - decision-oriented intellectual history
- `../../notes/thinking/topics/decision-flow/intellectual-history-flow-state.md` - flow-state intellectual history

## Local live edit

- `~/.agents/skills/decision-mode` symlinks to `skills/decision-mode`
