---
name: to-decisions
description: Turn the current conversation into a compact structured decision document—no interview, only synthesis of what was already discussed.
---

# To Decisions

Compile the decision state already present in the live conversation. Use other sources only when the user explicitly points to them.

## Process

1. Capture only what happened in the source. Do not interview the user, explore the repo, research the subject, produce a spec, suggest next steps, or implement anything.
2. Distinguish explicit user decisions from inferred leanings. Mark only capture that involved judgment, such as `LEANING (inferred)` or `agent-suggested, user accepted`. Never manufacture closure or a rationale that was not discussed.
3. Write one timestamped Markdown file. Follow a project note convention already known from context; otherwise use `docs/decisions/{YYYY-MM-DD HHMM} {slug}.md`.
4. Print a compact summary with DECIDED, LEANING, and OPEN counts plus any inference marks worth checking, then stop.

## Artifact

```markdown
# {Decision topic}

## Goal / context

{Why the decision work happened and the relevant situation.}

## Decisions

- **{DECIDED | LEANING | OPEN}{inference mark, when needed} — {decision}.** {Short why, when discussed.}

## Open questions

- {Question still unresolved.}

## Alternatives and criteria

- {Alternative or criterion actually discussed.}

## Contradictions / reversals

- {Change or conflict in the conversation.}
```

Include alternatives, criteria, contradictions, and reversals only when they appeared in the source. Explicit user decisions need no inference mark.
