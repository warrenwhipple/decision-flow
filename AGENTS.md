# AGENTS.md

This repo is `decision-flow`, Warren's prototype QOC/IBIS based decision ontology project.

## Repo structure

- `MIRROR.md` - human-owned mental mirror for overall project direction across prototypes
- `docs/MIRROR-decision-mode.md` - human-owned mental mirror scoped to the backburnered `decision-mode` prototype
- `docs/design-space.md` - human-owned, manually maintained structured map of the Decision Flow design space
- `docs/vision.md` - Decision Flow product vision and rationale
- `docs/manual-only-skills.md` - cross-harness metadata and invocation guidance for manual-only skills
- `docs/visualizer-v0-spec.md` - spec for the `dviz` decision visualizer prototype, the current focus
- `dviz/` - the `dviz` visualizer: single Bun package with CLI, server, SQLite store, and React outline view (`src/cli/`, `src/server/`, `src/db/`, `src/view/`, `test/`)
- `skills/dviz/SKILL.md` - manual-only agent skill for driving the `dviz` CLI during a live deliberation
- `skills/decision-mode/SKILL.md` - prototype agent skill for decision-centered work
- `skills/deliberate/SKILL.md` - manual-only conversational skill for examining a problem one decision at a time
- `skills/to-decisions/SKILL.md` - prototype skill for capturing decisions already present in a conversation
- `scripts/link-skills.sh` - links repo-local skills into user-level harness skill directories
- `docs/experience/` - repo-local timestamped dogfood field notes and auto-ethnographic observations
- `docs/experience/insights.md` - rolling, agent-editable synthesis of dogfood insights, feature threads, open questions, and handled learnings
- `docs/reports/` - timestamped research and capability reports that synthesize findings from experiments

## `dviz` visualizer and skill

`dviz` is the current focus. Warren runs `dviz serve` in a dogfood repo and keeps
the outline view open beside the conversation; the agent captures questions,
options, criteria, and assessments through the `dviz` CLI and they render live.

- State lives in a repo-local `.dviz/space.db` (gitignored) behind the server. Agents go through the CLI only; never read or edit `.dviz/` directly.
- Everything an agent creates lands as `suggested` (dotted in the view). `accept`, `lean`, `decide`, `reopen`, and `remove` are Warren's verbs — only issue them when asked.
- Slugs are the shared handle across CLI, speech, and view. Slug-minting heuristics live in the skill, not the CLI or schema.
- `dviz --help` is the authoritative command surface; `docs/visualizer-v0-spec.md` holds the design and build order.
- Develop with `cd dviz && bun test` / `bun run typecheck`; `bun link` in `dviz/` provides the global `dviz` binary.

## `decision-mode` skill

Work on `decision-mode` is backburnered while Warren tries simpler prototypes.
Do not assume it is the current implementation focus.

Use [`docs/experience/insights.md`](docs/experience/insights.md) for rolling
dogfood synthesis and feature/open-question tracking, not either human-owned
mirror.

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

## Skill conventions and local live edit

- Keep canonical skills directly under `skills/<name>/` with matching kebab-case frontmatter names.
- Keep the shared workflow in `SKILL.md`; use optional `scripts/`, `references/`, and `assets/` for supporting material.
- Keep `SKILL.md` below 500 lines when practical and move longer detail into `references/`.
- Run `scripts/link-skills.sh` to link every repo-local skill into `~/.agents/skills/` for Codex and Cursor and into `~/.claude/skills/` for Claude Code. Symlinked edits are live; rerun the script only after adding, renaming, or moving a skill.
- See [`docs/manual-only-skills.md`](docs/manual-only-skills.md) before making a skill explicit-invocation-only. `decision-mode`, `deliberate`, `to-decisions`, and `dviz` are all manual-only. Claude Code and Cursor use skill frontmatter, while Codex uses `agents/openai.yaml`.
- Do not build an OpenCode command adapter for manual-only skills for now; OpenCode is outside the current central workflow.
