# Decision Flow

Decision Flow is an early-stage exploration of AI-assisted software work organized around decisions instead of agents, tickets, or tasks.

The core bet: for ambiguous product and engineering work, the useful top-level object is often an ordered list of open questions. Agents can help research, spike, and clarify those questions while the human stays focused on the next meaningful decision.

## Current Prototypes

This repo contains small, closely related prototype skills for decision-centered work.

Start here:

- [`skills/decision-mode/SKILL.md`](skills/decision-mode/SKILL.md) - the prototype agent behavior
- [`skills/to-decisions/SKILL.md`](skills/to-decisions/SKILL.md) - capture decision state from an existing conversation
- [`docs/vision.md`](docs/vision.md) - product vision and rationale
- [`docs/manual-only-skills.md`](docs/manual-only-skills.md) - manual-only invocation across Codex, Claude Code, and Cursor
- [`docs/experience/`](docs/experience/) - timestamped dogfood notes and observations
- [`docs/experience/insights.md`](docs/experience/insights.md) - tracking and synthesis of dogfood notes
- [`docs/reports/`](docs/reports/) - timestamped research and capability reports

## Decision Mode

Decision Mode (the `decision-mode` skill) helps decompose a complex goal into:

- questions
- options
- criteria
- background jobs
- decisions

It records progress in a `DECISION.md` file — created per working session in whatever repo you run it in, not checked in here — so an ambiguous session remains inspectable and resumable. For a real example, see lightsight's [`DECISION.md`](https://github.com/warrenwhipple/lightsight/blob/main/DECISION.md) ([local](../lightsight/DECISION.md), if lightsight is cloned as a sibling repo).

## Try it

Run `scripts/link-skills.sh` to link the repo's skills into the user-level skill directories used by Codex, Cursor, and Claude Code. The links point back to this checkout, so skill edits are immediately available for dogfooding without copying files. Existing real directories at the same skill names are moved to timestamped backups; unrelated installed skills remain in place. Harnesses may need a new session to reload changed instructions.

Invoke `decision-mode` explicitly with `$decision-mode` in Codex or `/decision-mode` in Claude Code and Cursor. Both prototype skills are user-invoked-only; see [`docs/manual-only-skills.md`](docs/manual-only-skills.md) for the harness metadata. OpenCode manual-only adapters are intentionally deferred.

## Status

Private iteration. The repo is intentionally small while the behavior is being dogfooded before any broader release.
