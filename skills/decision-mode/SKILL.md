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

**Decision** - Current answer to a question. A decision selects an option, records confidence and rationale, and closes the question unless marked BRANCH for parallel exploration.

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
- {DECIDED|BRANCH} - {decided option phrase}
  - {branch option phrase} - {git branch}
  - ...
- Leaning SURE/TENTATIVE
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

No section placeholders. Omit empty lists. Fledgeling simple lists as comma separated lines.

## DECISION file captures user intent

We want the user to stay cognitively engaged in decision making. You can be suggestive and speculative with your conversational suggestions. But when you record to the DECISION file you should avoid bloating the file with your own assumptions.

## When discussing incremental next steps

Operate in one of two modes: **triage** or **question focus**.

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
