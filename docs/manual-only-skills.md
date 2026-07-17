# Manual-only skills across harnesses

As of July 16, 2026, a workflow can remain absent from ambient model context and load only when a human invokes it in Claude Code, Cursor, and Codex. These are this repository's current targets for manual-only workflows.

## Canonical skill

Keep the shared workflow in `skills/<name>/SKILL.md`. For a workflow that must be manual-only, add this frontmatter:

```yaml
---
name: my-workflow
description: Run my manually selected workflow.
disable-model-invocation: true
---
```

Claude Code and Cursor honor `disable-model-invocation: true` and expose the skill through `/my-workflow` without advertising it to the model beforehand.

Codex uses a sidecar instead. Add `skills/<name>/agents/openai.yaml`:

```yaml
policy:
  allow_implicit_invocation: false
```

Invoke it with `$my-workflow` or select it through `/skills`. Prefer those structured invocation paths over mentioning the skill in prose. Some Codex versions have had bugs resolving explicit-only skills, so test this path when upgrading.

## Repository implications

- `decision-mode`, `deliberate`, and `to-decisions` currently follow this manual-only pattern with both forms of harness metadata.
- Continue treating `skills/<name>/SKILL.md` as the canonical workflow.
- `disable-model-invocation` is harmless extension metadata outside the core Agent Skills fields.
- Permit `agents/openai.yaml` as a Codex-specific exception to the otherwise core-only skill layout.
- Verify manual invocation in each target harness after packaging or harness upgrades; plugin-delivered Cursor skills and some Codex versions have had explicit-invocation bugs.
- Do not create an OpenCode command adapter for manual-only skills. OpenCode is undergoing changes and is not part of the current central workflow; reconsider support when that changes.

This guidance was ported from the sibling `skills` repository's harness research captured on July 16, 2026. Recheck vendor documentation before relying on it long-term because these controls are harness extensions rather than part of the core Agent Skills specification.
