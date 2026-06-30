# Decision Flow

Decision Flow is an early-stage exploration of AI-assisted software work organized around decisions instead of agents, tickets, or tasks.

The core bet: for ambiguous product and engineering work, the useful top-level object is often an ordered list of open questions. Agents can help research, spike, and clarify those questions while the human stays focused on the next meaningful decision.

## Current Prototype

This repo currently contains `decision-mode`, a small Codex skill for decision-centered work.

Start here:

- [`skills/decision-mode/SKILL.md`](skills/decision-mode/SKILL.md) - the prototype agent behavior
- [`docs/vision.md`](docs/vision.md) - product vision and rationale
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

`decision-mode` is a single skill folder, dogfooded with Codex. To use it, symlink `skills/decision-mode` into your Codex global user skills directory, then invoke `decision-mode` on a real, ambiguous task in *another* repo. It is still too early to run on itself, so don't point it at this repo expecting it to work well.

## Status

Private iteration. The repo is intentionally small while the behavior is being dogfooded before any broader release.
