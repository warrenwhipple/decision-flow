# MIRROR.md

This is a human-owned mental mirror that AI agents check but never edit.
Lifecycle: human edits and/or project changes → agent fact checks → repeat.
Human advice: manually edit, rephrase over copying, compress over logging.
Agent rules: focus on drift/misunderstandings, not exhaustiveness, never edit.

## Goals

- Build a `decision-mode` skill prototype of the Decision Flow vision
	- Keep it as simple as possible while capturing the feelings
	- Why: Decision Flow is my best self-directed project idea in the AI coding space. I need a prototype for my portfolio. And an idea generator for my thinking and blogging.
- Capture the "decider" + "flow" feelings
  - Reduce manager feeling - I do not feel like I am juggling agents or conversation threads or worktrees or tasks or PRs
  - Increase decider feeling - I stay focused on strategy, architecture, product feel, decision making; I offload managing to the one conversation agent
  - Reduce attention framentation feeling
  - Increase flow state feeling - always allow brain dumping; usually present numbered menu options as faux GUI
  - Why: Even if decision flow is quantitatively better on some axis, uptake will require users to emotionally experience something different than other tools.
- Provide emotional permission to focus
  - Provide background, agent controlled orchestration with tangible control and feedback without distraction
  - Why: Tokenmaxxing and maximum productivity anxieties seductively pull toward manager mode.
- Deliberate cognitive loading
  - Stretch the user to engage with decisions and to generate some analysis themselves
  - Why: Flow state requires some difficulty, engagement requires some creation

## Accepted tradeoffs

- No visual UI or visual sidecar yet - let the agent just write the focused projection of what the user needs to see, as if they were viewing a dynamic UI.
- Focus on Codex Mac app first - don't worry about Codex CLI or Claude Code.
- Psuedo UI for now - numbered menu options are stand-ins for GUI buttons/interactions.
- Postpone `decision-mode` dogfood on `decision-mode` - this has resulted in very confusing conversations, use MIRROR.md method only for now

## Basic workflow for Warren

1. Dogfood `decision-mode` skill on various sibling repos like `lightsight`
2. Voice dump autoethnographic experiences
3. Discuss possible new insights, synthesize into `docs/experience/insights.md`
4. Make some skill changes
5. Repeat

## Done

- `decision-mode` skill runs in Codex Mac app.
- Skill writes a structured `DECISION.md`.
- Triage vs focus vs rehearsal-review modes foregrounded to user.
- Explicit actions foregrounded to user, focus, rehearse, decide, etc.
- Parallel thread rehearsals working, ongoing tweaks to lifecycle.
- Various tweaks to rehearsal lifecycle and visibility.
- Background orchestration to workers.

## Recent changes ready to dogfood

- None

## Status at a glance

- Rehearsals working ish and are focus of ongoing iteration.
- Tried background orchestration, didn't seem to help the feel.
- Considering an architecture rethink, rather than iteration.

## Important insights from dogfooding

- Agent is often doing orchestration work, waiting breaks flow
- User can be pulled into rehearsal threads for approvals, juggling breaks flow
- Rehearsal control surface design and tradeoffs are load bearing and the vision is light on guidance
- Internal theoretical/implementation vocabulary is leaking into the conversation and control surface

## Future direction

- Absorb last experience dump important insights
- Decide on architecture rethink vs keep itterating
