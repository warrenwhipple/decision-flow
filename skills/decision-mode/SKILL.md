---
name: decision-mode
description: Use when the user asks for decision mode or points to a DECISION.md or DECISION-{slug}.md file
---

# Decision Mode

Help the user decompose a complex goal into questions, options, and criteria. Delegate work that can inform decisions to parallel AI agents while staying focused on the highest leverage decision. Record analysis and progress in a DECISION file.

## File structure

A `decision-mode` session is centered around a single DECISION file serving as a continuously updated record of user intent and conversation progress.

Root `DECISION.md` or `docs/DECISION.md` for the entire codebase. Scoped `src/{domain}/DECISION.md` or `docs/DECISION-{feature-slug}.md` etc for narrow goals.

At startup, find and read the relevant DECISION file before steering the conversation.

Lazily create a new DECISION file only if you cannot find one related to the user's initial invocation of `decision-mode`.

## DECISION file mental model

DECISION file ontology is grounded in QOC, IBIS, wicked problem analysis and issue mapping. But use terminology below to avoid collision with common software engineering and task management terms:

**Goal** - Overarching complex issue, feature, or problem. One goal per DECISION file.

**Questions** - Decision nudges needed to advance the goal. Questions may attach directly to the goal, or to other questions, options, or criteria. Order by leverage on narrowing the open decision space.

**Options** - Possible answers to a question. Options attach to one question. Order by winning.

**Criteria** - Standards, metrics, arguments and evidence used to evaluate and compare options. Criteria that frame scope or cut across questions or options may attach directly to the goal or to a question, and optionally prepended HIGH or LOW or IGNORE. Criteria may also attach directly to an option, and should be prepended PRO or CON. Order by importance.

**Jobs** - Tasks that can be delegated to AI agents to run in the background while the main `decision-mode` conversation proceeds. Jobs may attach to a question, option, or criterion. Jobs may include codebase exploration, web/docs research, dependency code research, spike experiments. Jobs have a status of TODO, BUSY, READY, REVIEWED. Order by most recent status edit to top.

**Decision** - Current answer to a question. A decision records status, selected option or branch set, confidence, and rationale.

Decision status is OPEN, LEANING, DECIDED, or BRANCH. Confidence is TENTATIVE or SURE.

If a TODO, BUSY, or READY job informs a question, that question can be LEANING at most, never DECIDED. A spike or research job is evidence toward a decision, not the decision itself.

## DECISION file template

```md
# {Goal title}

{Goal context and framing. 1 or 2 phrases.}

{Optional issue tracker ref id or link}

**Criteria**
- {Optional HIGH|LOW|IGNORE} - {phrase}
- ...

## {Question title}

{Question statement when title is unclear? 0 to 2 phrases.}

**Criteria**
- {Optional HIGH|LOW|IGNORE} - {phrase}
- ...

**Options**
- {Option}
  - {PRO|CON} - {1 phrase}
  - ...
- {Option}
  - {PRO|CON} - {1 phrase}
  - ...

**Jobs**
- TODO/BUSY/READY/REVIEWED - Research/Spike - {Job description}

**Decision**
- Status - {OPEN|LEANING|DECIDED|BRANCH}
- Choice - {current option phrase, decided option phrase, or unresolved}
  - {branch option phrase} - {git branch}
  - ...
- Confidence - {TENTATIVE|SURE}
- Why - {Explanation}

## {Question title}
...

```

## When writing to the DECISION file

### No permission ceremony

Treat DECISION file updates as scribing user intent, not carefully editing a codebase. Record relevant decisions, questions, criteria, options, jobs, and progress without asking first.

Update after each meaningful user clarification, new criterion, new option, decision, or job result.

### Aggressively compress information

A DECISION file serves dual roles: First, efficiently capture user intent for future conversations. Second, remain glanceable and scannable for user engagement and orientation.

Sacrifice grammar for concision. Prefer short phrases over sentences. Collapse redundancies. Use order to convey priority.

No section placeholders. Omit empty lists. Prefer simple lists or comma separated lines.

### First-write restraint

When creating a DECISION file from a large brain dump, especially voice-to-text or greenfield project framing, do not fully expand every possible question, option, and criterion.

Capture a compact orientation first:

- Goal and context
- Top cross-cutting criteria
- Highest-leverage open question titles
- Options and criteria only for the 1 to 3 questions currently worth discussing

Leave lower-priority possibilities implicit until they become relevant. Expand on demand as the conversation selects a question, reveals a criterion, or needs a job.

## DECISION file captures user intent

We want the user to stay cognitively engaged in decision making. You can be suggestive and speculative with your conversational suggestions. But when you record to the DECISION file you should avoid bloating the file with your own assumptions.

## Background jobs

Use jobs to answer a specific open question, option, or criterion. Do not delegate tangential work.

Job briefs should be compact and self-contained:

- Name the question the job informs
- State the missing information or uncertainty
- Reference the DECISION file path instead of duplicating captured context
- Ask for findings shaped for synthesis back into the DECISION file
- Redact secrets, credentials, and sensitive personal data

If parallel agent delegation is unavailable or overkill, record a TODO job or do a small inline research pass.

### Implementation boundary

Treat implementation as a background job only when it is a spike to answer an open decision. Spike output is learning, not finished product work.

Do not launch full feature implementation from Decision Mode unless the user explicitly asks to leave decision work.

## When discussing incremental next steps

Operate in one of two modes: **triage** or **question focus**.

After any meaningful DECISION file write, end by re-orienting the user with a short ranked menu of up to 3 next moves. Do not end in plain edit-confirmation mode.

Use the menu order as the recommendation. Avoid an extra "I'd focus on X" sentence unless the user asks for rationale.

If the focused question just reached DECIDED or BRANCH, zoom back out to triage and rank the remaining open moves. If the focused question remains OPEN or LEANING, stay in question focus and rank the next ways to resolve it.

### Triage mode

Use triage mode when no single question is selected, when the user seems unsure what to tackle next, or when new ambiguity appears.

Help the user choose the next high-leverage decision. Offer a short ranked menu of possible next moves:

- Add or refine open questions
- Focus on one existing question
- Reconsider the goal or assumptions, only if doing so could change what we build
- Delegate background work, only if it would clarify a specific open question

Bias toward focus. Do not let triage become open-ended brainstorming.

### Question focus mode

Use question focus mode when the user selects, implies, or is already discussing a specific question.

Help drive that question toward a decision:

- Clarify the question
- Identify plausible options
- Elicit or infer criteria
- Ask why questions only when the answer could change the choice
- Suggest background jobs when missing information blocks the decision
- Press for a tentative decision when enough is known

A tentative decision is better than leaving the question open if the choice is reversible.

The goal is not perfect certainty; the goal is sustained progress without losing intent.
