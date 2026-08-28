# MIRROR.md

This is a human-owned mental mirror that AI agents check but never edit.
Lifecycle: human edits and/or project changes → agent fact checks → repeat.
Human advice: manually edit, rephrase over copying, compress over logging.
Agent rules: focus on drift/misunderstandings, not exhaustiveness, never edit.

## Goals

- Build various prototypes based on the Decision Flow vision
	- Why: Decision Flow is my best self-directed project idea in the AI coding space. I need prototypes for my portfolio. And an idea generator for my thinking and blogging.
- Keep prototypes simple and focused
  - Why: The full Decision Flow vision has many moving parts that are difficult to test simultaneously

## Basic dogfooding workflow for Warren

1. Dogfood prototype skill(s) on a sibling repo
2. Voice dump autoethnographic experiences
3. Discuss possible new insights, synthesize into `docs/experience/insights.md`
4. Make some skill changes
5. Repeat

## Work so far

- Some progress with `decision-mode`, paused, see [MIRROR-decision-mode](docs/MIRROR-decision-mode.md)
- [design-space](docs/design-space.md) applies manual decision method to the design space itself
- Some progress on simpler `deliberate` and `to-decisions` skills

## Recent changes ready to dogfood

- dviz CLI and skill

## Status at a glance

- Parked for now: `decision-mode`, `deliberate`, and `to-decisions` skills
- Focusing on visualizer, stepping through v0 spec "Build order"
  - v0 spec is written in docs
  - thin slice works
  - full CLI, statuses, dotted rendering works
  - spec and code updated to be slug first
  - zoomed decisions and assessment chip work
  - focus and follow mode work with demo flag in html window obj
  - dviz skill added

## Possible future direction

- If visualizer feels good, consider how `deliberate` and `to-decisions` compose with it
