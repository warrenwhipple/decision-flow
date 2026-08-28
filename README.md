# Decision Flow

Decision Flow is an early-stage exploration of AI-assisted software work organized around decisions instead of agents, tickets, or tasks.

The core bet: for ambiguous product and engineering work, the useful top-level object is often an ordered list of open questions. Agents can help research, spike, and clarify those questions while the human stays focused on the next meaningful decision.

## Current Prototypes

This repo contains a decision visualizer and small, closely related prototype skills for decision-centered work.

Start here:

- [`dviz/`](dviz/) - the `dviz` decision visualizer (CLI + local server + live outline view), the current focus
- [`skills/dviz/SKILL.md`](skills/dviz/SKILL.md) - the agent skill for capturing a deliberation through the `dviz` CLI
- [`docs/visualizer-v0-spec.md`](docs/visualizer-v0-spec.md) - visualizer design and build order
- [`skills/decision-mode/SKILL.md`](skills/decision-mode/SKILL.md) - the prototype agent behavior
- [`skills/deliberate/SKILL.md`](skills/deliberate/SKILL.md) - interview a problem one decision at a time without writing files
- [`skills/to-decisions/SKILL.md`](skills/to-decisions/SKILL.md) - capture decision state from an existing conversation
- [`docs/vision.md`](docs/vision.md) - product vision and rationale
- [`docs/manual-only-skills.md`](docs/manual-only-skills.md) - manual-only invocation across Codex, Claude Code, and Cursor
- [`docs/experience/`](docs/experience/) - timestamped dogfood notes and observations
- [`docs/experience/insights.md`](docs/experience/insights.md) - tracking and synthesis of dogfood notes
- [`docs/reports/`](docs/reports/) - timestamped research and capability reports

## dviz

`dviz` is a local decision visualizer. You run `dviz serve` in a project and keep the outline view open beside your agent conversation; the agent captures questions, options, criteria, and assessments through the `dviz` CLI, and each one appears live. Agent-created nodes land as *suggested* (rendered dotted) until you accept them, and accepting, leaning, deciding, and removing stay human verbs. Slugs are the shared handle between you, the agent, and the view.

State is a repo-local, gitignored `.dviz/space.db` behind the server. The `dviz` skill teaches the agent the CLI, the suggest-never-settle rule, and slug-minting heuristics.

```sh
cd dviz && bun install && bun link   # global `dviz` binary
cd ../some-project
dviz init                            # creates .dviz/ and gitignores it
dviz serve                           # starts the server and view
dviz --help                          # full command surface
```

## Decision Mode

Decision Mode (the `decision-mode` skill) helps decompose a complex goal into:

- questions
- options
- criteria
- background jobs
- decisions

It records progress in a `DECISION.md` file — created per working session in whatever repo you run it in, not checked in here — so an ambiguous session remains inspectable and resumable. For a real example, see lightsight's [`DECISION.md`](https://github.com/warrenwhipple/lightsight/blob/main/DECISION.md) ([local](../lightsight/DECISION.md), if lightsight is cloned as a sibling repo).

## Deliberate

`deliberate` is a conversation-only skill that interviews the user one question at a time. It distinguishes decided, leaning, and open questions, and helps identify what would close each open question without writing project artifacts.

## Try it

Run `scripts/link-skills.sh` to link the repo's skills into the user-level skill directories used by Codex, Cursor, and Claude Code. The links point back to this checkout, so skill edits are immediately available for dogfooding without copying files. Existing real directories at the same skill names are moved to timestamped backups; unrelated installed skills remain in place. Harnesses may need a new session to reload changed instructions.

Invoke the skills explicitly with `$dviz`, `$decision-mode`, `$deliberate`, or `$to-decisions` in Codex, and with the corresponding slash command in Claude Code and Cursor. All four skills are user-invoked-only; see [`docs/manual-only-skills.md`](docs/manual-only-skills.md) for the harness metadata. OpenCode manual-only adapters are intentionally deferred.

## Status

Early public iteration. Current work is on the `dviz` visualizer; `decision-mode`, `deliberate`, and `to-decisions` are parked. The repo is intentionally small while things are being dogfooded; expect rough edges and fast changes.
