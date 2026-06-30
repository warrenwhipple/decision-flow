# Decision Flow

Decision Flow is an early-stage exploration of AI-assisted software work organized around decisions instead of agents, tickets, or tasks.

The core bet: for ambiguous product and engineering work, the useful top-level object is often an ordered list of open questions. Agents can help research, spike, and clarify those questions while the human stays focused on the next meaningful decision.

## Current Prototype

This repo currently contains `decision-mode`, a small Codex skill prototype for decision-centered work.

Start here:

- `skills/decision-mode/SKILL.md` - the prototype agent behavior
- `docs/vision.md` - product vision and rationale
- `docs/experience/` - timestamped dogfood notes and observations
- `docs/experience/insights.md` - tracking and synthesis of dogfood notes

## Decision Mode

Decision Mode helps decompose a complex goal into:

- questions
- options
- criteria
- background jobs
- current decisions

It records progress in a `DECISION.md` file so an ambiguous session remains inspectable and resumable.

## Status

Private iteration. The repo is intentionally small while the behavior is being dogfooded before any broader release.
