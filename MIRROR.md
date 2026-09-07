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
- Build prototypes I will use regularly
  - Why: The most useful dogfooding is motivated by authentic use

## Basic dogfooding workflow for Warren

1. Dogfood prototype skill(s) and/or app on a sibling repo
2. Voice dump autoethnographic experiences
3. Discuss possible new insights, synthesize into `docs/experience/insights.md`
4. Make some skill/app changes
5. Repeat

## Work so far

- Some progress with `decision-mode`, paused, see [MIRROR-decision-mode](docs/MIRROR-decision-mode.md)
- [design-space](docs/design-space.md) applies manual decision method to the design space itself
- Some progress on simpler `deliberate` and `to-decisions` skills
- Some progress on `dviz` decision visualizer

## Recent changes ready to dogfood

- Waiting on new dviz changes

## Status at a glance

- Parked for now: `decision-mode`, `deliberate`, and `to-decisions` skills
- Focusing on `dviz` visualizer
  - v0 is coded according to spec
  - `bun dev` works for quick ui iteration
  - `dviz` refactored to run outside repos with sidebar library of spaces

## Possible future direction

- `dviz` needs changes to promote my regular use
- If visualizer feels good, consider how `deliberate` and `to-decisions` compose with it
